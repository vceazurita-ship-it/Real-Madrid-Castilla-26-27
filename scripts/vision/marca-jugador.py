"""
MARCA AL JUGADOR EN SU CLIP (26/11/2026).

Petición del analista: «que apareciera el jugador de cada vídeo en cada clip
con un foco o una marca para que se supiera que es ese».

Opta da el momento de la acción, pero no dónde está el jugador en la imagen.
Se busca así, sólo alrededor de la acción (de 1,5 s antes a 0,6 s después,
un fotograma de cada dos; YOLO pequeño a 1280 px en la CPU, ~0,3 s cada uno):
  1. Personas y balón en cada fotograma (sin la grada: lo de arriba del todo
     y lo muy pequeño fuera).
  2. Quien hace la acción es la persona pegada al balón: cada fotograma vota a
     la que tiene los pies (o el cuerpo) más cerca del balón, a menos de 1,3
     veces su altura, y sólo si la segunda no está casi igual de cerca. Gana
     si se lleva 3 votos o más y el 60 % de los que hay.
  3. Si no hay seguridad (no se ve el balón, dos a la vez, cambio de plano),
     el clip queda SIN marca: mejor eso que marcar a otro.
  4. Se le sigue hacia atrás y hacia delante, fotograma a fotograma, por la
     persona más cercana a donde estaba (si salta mucho, se deja de marcar).
Con él localizado:
  - en ese tramo, un aro dorado a sus pies y un triángulo sobre la cabeza;
  - y en el momento de la acción el vídeo se CONGELA 1 s con un foco (el
    resto más oscuro), el aro y su nombre encima.

  python marca-jugador.py <entrada.mp4> <salida.mp4> <segundo_accion> <nombre> <ffmpeg> [args de salida de ffmpeg…]

Escribe una línea JSON: {"marcado": bool, "votos": n, "motivo": "…"}.
Si no se marca, copia el clip tal cual para que el montaje siga.
"""

import json
import os
import shutil
import subprocess
import sys

import cv2
import numpy as np

CARPETA = os.path.join(os.environ.get("LOCALAPPDATA", "."), "rmcf-vision")
MODELO = os.path.join(CARPETA, "yolo11n.pt")
ORO = (107, 169, 200)  # BGR de #C8A96B
CONGELA = 25  # fotogramas (1 s)
ANTES_S = 1.5
DESPUES_S = 0.6


def sal(info):
    print(json.dumps(info, ensure_ascii=False), flush=True)


def deja_igual(entrada, salida, info):
    shutil.copyfile(entrada, salida)
    sal({"marcado": False, **info})


def main():
    entrada, salida, t_accion, nombre, ffmpeg = sys.argv[1:6]
    args_salida = sys.argv[6:]
    t_accion = float(t_accion)

    from ultralytics import YOLO

    os.makedirs(CARPETA, exist_ok=True)
    modelo = YOLO(MODELO if os.path.exists(MODELO) else "yolo11n.pt")
    if not os.path.exists(MODELO) and os.path.exists("yolo11n.pt"):
        shutil.move("yolo11n.pt", MODELO)

    cap = cv2.VideoCapture(entrada)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    ancho = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    alto = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if n <= 0 or not ancho:
        cap.release()
        return deja_igual(entrada, salida, {"votos": 0, "motivo": "sin fotogramas"})

    centro = min(int(round(t_accion * fps)), n - 1)
    desde = max(0, centro - int(ANTES_S * fps))
    hasta = min(n - 1, centro + int(DESPUES_S * fps))
    # En memoria sólo el tramo que se mira (con medio segundo de margen): un clip entero a 720p es ~1 GB.
    margen = int(0.5 * fps)
    frames = {}
    k = 0
    while k <= hasta + margen:
        ok, img = cap.read()
        if not ok:
            break
        if k >= desde - margen:
            frames[k] = img
        k += 1
    cap.release()
    if centro not in frames:
        return deja_igual(entrada, salida, {"votos": 0, "motivo": "el momento de la acción cae fuera del clip"})

    def detecta(k):
        r = modelo.predict(frames[k], imgsz=1280, conf=0.08, classes=[0, 32], verbose=False)[0]
        personas, balon, mejor = [], None, 0.0
        if r.boxes is not None and len(r.boxes):
            for c, caja, p in zip(r.boxes.cls.cpu().numpy().astype(int), r.boxes.xyxy.cpu().numpy(), r.boxes.conf.cpu().numpy()):
                x1, y1, x2, y2 = (float(v) for v in caja)
                if c == 32 and p > mejor and p >= 0.15:
                    mejor, balon = float(p), ((x1 + x2) / 2, (y1 + y2) / 2)
                elif c == 0 and p >= 0.3 and (y2 - y1) >= alto * 0.035 and y2 > alto * 0.2:
                    personas.append((x1, y1, x2, y2))
        return personas, balon

    det = {}
    for k in range(desde, hasta + 1, 2):
        det[k] = detecta(k)

    # Votos: la persona pegada al balón.
    votos, cajas_voto = [], []
    for k, (personas, bal) in det.items():
        if bal is None or not personas:
            continue
        cerca = []
        for caja in personas:
            x1, y1, x2, y2 = caja
            h = max(y2 - y1, 1.0)
            d = min(np.hypot(bal[0] - (x1 + x2) / 2, bal[1] - y2), np.hypot(bal[0] - (x1 + x2) / 2, bal[1] - (y1 + y2) / 2))
            if d < 1.3 * h:
                cerca.append((d / h, caja))
        if not cerca:
            continue
        cerca.sort(key=lambda x: x[0])
        if len(cerca) > 1 and cerca[1][0] - cerca[0][0] < 0.15:
            continue
        votos.append(k)
        cajas_voto.append(cerca[0][1])

    if not votos:
        return deja_igual(entrada, salida, {"votos": 0, "motivo": "no se ve el balón pegado a nadie en el momento de la acción"})

    # ¿Es la misma persona en los fotogramas que votan? Se agrupan por cercanía (en altura de jugador).
    def cerca_de(a, b, factor=1.2):
        h = max(a[3] - a[1], b[3] - b[1], 1.0)
        return np.hypot((a[0] + a[2]) / 2 - (b[0] + b[2]) / 2, a[3] - b[3]) < factor * h * (1 + 0.15)

    grupos = []
    for k, caja in zip(votos, cajas_voto):
        for g in grupos:
            if any(cerca_de(caja, c2) and abs(k - k2) <= 12 for k2, c2 in g):
                g.append((k, caja))
                break
        else:
            grupos.append([(k, caja)])
    grupos.sort(key=len, reverse=True)
    g = grupos[0]
    if len(g) < 3 or len(g) / len(votos) < 0.6:
        return deja_igual(entrada, salida, {"votos": len(g), "motivo": f"no está claro quién es ({len(g)} de {len(votos)} votos)"})

    # El fotograma de la acción: el del grupo más cerca del momento de Opta.
    k0, caja0 = min(g, key=lambda x: abs(x[0] - centro))

    # Se le sigue fotograma a fotograma desde ahí (hacia atrás y hacia delante), en todo el tramo.
    cajas = {k0: caja0}
    for paso in (-1, 1):
        prev = caja0
        k = k0 + paso
        while k in frames:
            personas = det[k][0] if k in det else detecta(k)[0]
            if not personas:
                break
            sig = min(personas, key=lambda c: np.hypot((c[0] + c[2]) / 2 - (prev[0] + prev[2]) / 2, c[3] - prev[3]))
            if not cerca_de(sig, prev, 0.9):
                break
            cajas[k] = sig
            prev = sig
            k += paso
    # Suavizado de la caja (que el aro no tiemble).
    orden = sorted(cajas)
    suave, ant = {}, None
    for k in orden:
        c = cajas[k]
        ant = c if ant is None else tuple(0.55 * c[j] + 0.45 * ant[j] for j in range(4))
        suave[k] = ant

    def aro(img, c, grosor=3):
        x1, y1, x2, y2 = c
        w = max(x2 - x1, (y2 - y1) * 0.45)
        cx, pie = int((x1 + x2) / 2), int(y2)
        ax, ay = max(int(w * 0.8), 14), max(int(w * 0.28), 6)
        cv2.ellipse(img, (cx, pie), (ax, ay), 0, 0, 360, (0, 0, 0), grosor + 3, cv2.LINE_AA)
        cv2.ellipse(img, (cx, pie), (ax, ay), 0, 0, 360, ORO, grosor, cv2.LINE_AA)

    def flecha(img, c):
        x1, y1, x2, y2 = c
        cx, top = int((x1 + x2) / 2), int(y1) - 6
        s = max(int((y2 - y1) * 0.22), 9)
        pts = np.array([[cx - s, top - int(s * 1.5)], [cx + s, top - int(s * 1.5)], [cx, top]], np.int32)
        cv2.fillPoly(img, [pts], ORO, cv2.LINE_AA)
        cv2.polylines(img, [pts], True, (0, 0, 0), 1, cv2.LINE_AA)

    def foco(img, c):
        x1, y1, x2, y2 = c
        h = y2 - y1
        cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
        r = int(max(h * 1.4, 70))
        mascara = np.zeros(img.shape[:2], np.uint8)
        cv2.circle(mascara, (cx, cy), r, 255, -1, cv2.LINE_AA)
        mascara = cv2.GaussianBlur(mascara, (0, 0), r * 0.3)
        m = (mascara.astype(np.float32) / 255.0)[..., None]
        out = (img.astype(np.float32) * m + img.astype(np.float32) * 0.35 * (1 - m)).astype(np.uint8)
        aro(out, c, 4)
        flecha(out, c)
        texto = nombre.upper()
        escala = 0.85
        (tw, th), _ = cv2.getTextSize(texto, cv2.FONT_HERSHEY_DUPLEX, escala, 2)
        tx = int(min(max(cx - tw / 2, 12), img.shape[1] - tw - 12))
        ty = int(max(y1 - h * 0.6 - 18, th + 16))
        cv2.rectangle(out, (tx - 12, ty - th - 12), (tx + tw + 12, ty + 12), (20, 15, 11), -1)
        cv2.rectangle(out, (tx - 12, ty - th - 12), (tx + tw + 12, ty + 12), ORO, 2)
        cv2.putText(out, texto, (tx, ty), cv2.FONT_HERSHEY_DUPLEX, escala, (255, 255, 255), 2, cv2.LINE_AA)
        return out

    proc = subprocess.Popen(
        [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ancho}x{alto}", "-r", str(int(round(fps))), "-i", "-", *args_salida, salida],
        stdin=subprocess.PIPE,
    )
    frames = None  # fuera de memoria: se vuelve a leer el clip, fotograma a fotograma
    cap = cv2.VideoCapture(entrada)
    k = -1
    while True:
        ok, img = cap.read()
        if not ok:
            break
        k += 1
        limpia = img.copy() if k == k0 else None
        if k in suave:
            aro(img, suave[k])
            flecha(img, suave[k])
        proc.stdin.write(img.tobytes())
        if limpia is not None:
            quieto = foco(limpia, suave.get(k0, caja0)).tobytes()
            for _ in range(CONGELA):
                proc.stdin.write(quieto)
    cap.release()
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        return deja_igual(entrada, salida, {"votos": len(g), "motivo": "ffmpeg no pudo escribir"})
    sal({"marcado": True, "votos": len(g), "de": len(votos), "congela": round(k0 / fps, 2), "seguido": round(len(suave) / fps, 1)})


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # nunca para el montaje
        try:
            shutil.copyfile(sys.argv[1], sys.argv[2])
        except Exception:
            pass
        sal({"marcado": False, "votos": 0, "motivo": f"error: {e}"})
