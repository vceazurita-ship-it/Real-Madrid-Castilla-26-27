/**
 * Utilidades de audio para el dictado.
 *
 * Lo que graba el navegador (normalmente WebM/Opus) no siempre lo acepta el
 * modelo, así que aquí se decodifica y se vuelve a escribir como WAV mono de
 * 16 kHz: formato universal, suficiente para voz y mucho más ligero que el
 * original a 48 kHz en estéreo.
 */

/** Un dictado más largo que esto se corta solo. */
export const MAX_RECORDING_MS = 150_000;

/** Frecuencia de muestreo del WAV que se envía al modelo. */
const TARGET_SAMPLE_RATE = 16_000;

export const VOICE_MIME_TYPE = "audio/wav";

type AudioContextConstructor = typeof AudioContext;

function audioContextClass(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;

  const legacy = (window as unknown as {
    webkitAudioContext?: AudioContextConstructor;
  }).webkitAudioContext;

  return window.AudioContext ?? legacy ?? null;
}

/** ¿Se puede grabar en este navegador? */
export function canRecord() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window.MediaRecorder !== "undefined" &&
    audioContextClass() !== null
  );
}

/** Mezcla los canales a mono y remuestrea a 16 kHz. */
async function toMono16k(buffer: AudioBuffer): Promise<Float32Array> {
  const Offline =
    typeof window !== "undefined"
      ? window.OfflineAudioContext ??
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext
      : null;

  const frames = Math.max(
    1,
    Math.ceil((buffer.duration * TARGET_SAMPLE_RATE) || 1)
  );

  if (!Offline) {
    // Sin OfflineAudioContext nos quedamos con el primer canal tal cual.
    return buffer.getChannelData(0).slice();
  }

  const offline = new Offline(1, frames, TARGET_SAMPLE_RATE);

  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();

  return rendered.getChannelData(0).slice();
}

/** Escribe las muestras como WAV PCM de 16 bits. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);

  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes por segundo
  view.setUint16(32, 2, true); // bytes por muestra
  view.setUint16(34, 16, true); // bits por muestra
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));

    view.setInt16(offset, clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([bytes], { type: VOICE_MIME_TYPE });
}

/** Convierte lo grabado a WAV mono de 16 kHz. */
export async function toWav(recorded: Blob): Promise<Blob> {
  const Ctor = audioContextClass();

  if (!Ctor) throw new Error("Este navegador no puede procesar audio.");

  const context = new Ctor();

  try {
    const decoded = await context.decodeAudioData(await recorded.arrayBuffer());
    const samples = await toMono16k(decoded);

    return encodeWav(samples, TARGET_SAMPLE_RATE);
  } finally {
    void context.close();
  }
}

/** Base64 sin la cabecera `data:`, que es lo que espera el modelo. */
export async function toBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());

  let binary = "";

  // En trozos, porque `apply` con arrays enormes desborda la pila.
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  }

  return btoa(binary);
}
