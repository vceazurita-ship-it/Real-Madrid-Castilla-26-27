"""
VOCES DEL PODCAST «CASTILLA, POR DENTRO» (08/11/2026)

Cada réplica del guion (.cache/podcast/guiones/<guion>.json) a un .wav:
  - VICTOR (V): Chatterbox multilingüe (MIT, local, CPU), clonado con las
    notas de voz de Víctor en .cache/podcast/voz-victor/ (con su permiso).
  - ENTREVISTADOR (E): Piper (MIT, local), voz española genérica. NO imita
    la voz de ningún presentador real.

Oráculo (bucle «SPEC → oráculo → reintentar»): cada frase de Víctor se
compara con su voz real (coseno de huellas de voz del codificador de
Chatterbox, del tipo de Resemblyzer). Por debajo
de UMBRAL se repite con otra semilla, como mucho 3 veces; se queda la mejor
y todo se apunta en checks.md. Sin audios de Víctor, sale con la voz por
defecto de Chatterbox y el oráculo lo dice.

  .cache/podcast/venv/Scripts/python.exe scripts/podcast/voces.py boceto [capitulo]
"""
import json, os, subprocess, sys, glob, random

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
POD = os.path.join(RAIZ, ".cache", "podcast")
FFMPEG = os.path.join(RAIZ, "node_modules", "ffmpeg-static", "ffmpeg.exe")
UMBRAL = 0.75
INTENTOS = 3

guion_nombre = sys.argv[1] if len(sys.argv) > 1 else "boceto"
solo = int(sys.argv[2]) if len(sys.argv) > 2 else None
guion = json.load(open(os.path.join(POD, "guiones", guion_nombre + ".json"), encoding="utf-8"))
salida = os.path.join(POD, "audio", guion_nombre)
os.makedirs(salida, exist_ok=True)


def a_wav(origen, destino, sr=24000):
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", origen, "-ac", "1", "-ar", str(sr), destino], check=True)


# --- Referencia de Víctor: sus notas de voz, limpias y unidas (máx. 30 s) ---
ref = None
muestras = sorted(f for f in glob.glob(os.path.join(POD, "voz-victor", "*")) if os.path.isfile(f) and not f.endswith(".txt"))
if muestras:
    tmp = []
    for i, m in enumerate(muestras):
        w = os.path.join(POD, "voz-victor-ref", f"m{i}.wav")
        os.makedirs(os.path.dirname(w), exist_ok=True)
        a_wav(m, w)
        tmp.append(w)
    lista = os.path.join(POD, "voz-victor-ref", "lista.txt")
    open(lista, "w", encoding="utf-8").write("".join(f"file '{t}'\n" for t in tmp))
    ref = os.path.join(POD, "voz-victor-ref", "referencia.wav")
    # Une, quita silencios largos y normaliza; Chatterbox rinde mejor con 10-30 s.
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lista,
                    "-af", "silenceremove=stop_periods=-1:stop_duration=0.6:stop_threshold=-40dB,loudnorm=I=-18",
                    "-t", "30", "-ac", "1", "-ar", "24000", ref], check=True)

# --- Motores ---
import torch, torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

torch.set_num_threads(max(1, os.cpu_count() - 1))
tts = ChatterboxMultilingualTTS.from_pretrained(device="cpu")

piper_modelo = os.path.join(POD, "modelos", "es_ES-davefx-medium.onnx")
if not os.path.exists(piper_modelo):
    import urllib.request
    base = "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx"
    urllib.request.urlretrieve(base, piper_modelo)
    urllib.request.urlretrieve(base + ".json", piper_modelo + ".json")
from piper import PiperVoice
import wave
piper = PiperVoice.load(piper_modelo)

oraculo = None
if ref:
    # Huella de voz con el codificador que trae Chatterbox (el mismo tipo que Resemblyzer).
    import librosa, numpy as np

    def huella(ruta):
        w, _ = librosa.load(ruta, sr=16000)
        e = tts.ve.embeds_from_wavs([w], sample_rate=16000, as_spk=True)
        e = np.asarray(e).reshape(-1)
        return e / (np.linalg.norm(e) + 1e-9)

    huella_ref = huella(ref)
    oraculo = lambda f: float(np.dot(huella(f), huella_ref))

checks = ["| capítulo | réplica | voz | parecido | intentos | veredicto |", "|---|---|---|---|---|---|"]
for cap in guion["capitulos"]:
    if solo and cap["n"] != solo:
        continue
    for i, (voz, texto, *_resto) in enumerate(cap["r"]):
        f = os.path.join(salida, f"c{cap['n']:02d}-{i:02d}-{voz}.wav")
        if os.path.exists(f):
            continue
        if voz == "E":
            with wave.open(f, "wb") as w:
                piper.synthesize_wav(texto, w)
            checks.append(f"| {cap['n']} | {i} | E | genérica | 1 | pasa |")
            continue
        mejor, nota, n = None, -1.0, 0
        for n in range(1, INTENTOS + 1):
            torch.manual_seed(random.randint(0, 2**31 - 1))
            kw = dict(language_id="es", exaggeration=0.55, cfg_weight=0.4)
            if ref:
                kw["audio_prompt_path"] = ref
            wav = tts.generate(texto, **kw)
            tmp = f + f".t{n}.wav"
            torchaudio.save(tmp, wav, tts.sr)
            s = oraculo(tmp) if oraculo else 0.0
            if s > nota:
                if mejor and os.path.exists(mejor):
                    os.remove(mejor)
                mejor, nota = tmp, s
            else:
                os.remove(tmp)
            if not oraculo or s >= UMBRAL:
                break
        os.replace(mejor, f)
        veredicto = "sin referencia (voz por defecto)" if not oraculo else ("pasa" if nota >= UMBRAL else "falla: la mejor de 3")
        checks.append(f"| {cap['n']} | {i} | V | {nota:.2f} | {n} | {veredicto} |")
        print(cap["n"], i, voz, f"{nota:.2f}", flush=True)

open(os.path.join(salida, "checks.md"), "w", encoding="utf-8").write("\n".join(checks) + "\n")
print("hecho", salida)
