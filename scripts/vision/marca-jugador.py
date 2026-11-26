"""
MARCA AL JUGADOR EN SU CLIP (26/11/2026, rehecho el mismo día).

Petición del analista: «que apareciera el jugador de cada vídeo en cada clip
con un foco o una marca para que se supiera que es ese». La primera versión
marcaba al que estaba pegado al balón, y el analista vio el fallo: en «le
superan», en un duelo o en un balón dividido el más cercano era a veces el
RIVAL. Ahora va en dos pasadas y con el color de la camiseta:

  1. analiza  python marca-jugador.py analiza <clip.mp4> <segundo_accion> <salida.json>
     Personas y balón en cada fotograma de 1,5 s antes a 0,6 s después de la
     acción (y medio segundo más a cada lado para seguirle), con el color de
     la camiseta de cada persona (mediana Lab del pecho, sin césped). Dice
     también quién está más pegado al balón y su color («cabeza»).

  2. (Node junta las cabezas de los clips en que la acción es claramente SUYA
     —pase, control, conducción— y saca el color de SU camiseta en ese partido.)

  3. pinta    python marca-jugador.py pinta <clip.mp4> <salida.mp4> <analisis.json> <nombre> <L> <a> <b> <ffmpeg> [args de salida…]
     Sólo cuentan las personas con ESA camiseta: cada fotograma vota a la
     de su equipo más pegada al balón (a menos de 1,3 veces su altura) si la
     segunda de su equipo no está casi igual de cerca; gana con 3 votos o más
     y el 60 %. Si no, el clip va SIN marca. Con él: congelado 1 s con foco,
     aro dorado y su nombre; antes y después, el aro y un triángulo.

Escribe una línea JSON con lo que ha hecho. Si no marca, copia el clip tal cual.
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
CONGELA = 25
ANTES_S = 1.5
DESPUES_S = 0.6
MARGEN_S = 0.5
CERCA = 1.3
COLOR_MAX = 38.0  # distancia Lab a la camiseta para contar como «de los suyos»


def sal(info):
    print(json.dumps(info, ensure_ascii=False), flush=True)


def color_camiseta(img, caja):
    x1, y1, x2, y2 = (int(round(v)) for v in caja)
    h, w = y2 - y1, x2 - x1
    if h < 8 or w < 4:
        return None
    pecho = img[max(0, y1 + int(h * 0.15)) : max(0, y1 + int(h * 0.5)), max(0, x1 + int(w * 0.2)) : max(0, x2 - int(w * 0.2))]
    if pecho.size == 0:
        return None
    hsv = cv2.cvtColor(pecho, cv2.COLOR_BGR2HSV).reshape(-1, 3)
    lab = cv2.cvtColor(pecho, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    # Fuera el césped (verde con algo de saturación).
    no_cesped = ~((hsv[:, 0] >= 30) & (hsv[:, 0] <= 90) & (hsv[:, 1] >= 50))
    if no_cesped.sum() < 6:
        return None
    return [round(float(v), 1) for v in np.median(lab[no_cesped], axis=0)]


def analiza(entrada, t_accion, salida_json):
    from ultralytics import YOLO

    os.makedirs(CARPETA, exist_ok=True)
    modelo = YOLO(MODELO if os.path.exists(MODELO) else "yolo11n.pt")
    if not os.path.exists(MODELO) and os.path.exists("yolo11n.pt"):
        shutil.move("yolo11n.pt", MODELO)

    cap = cv2.VideoCapture(entrada)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    alto = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    centro = min(int(round(t_accion * fps)), max(n - 1, 0))
    desde = max(0, centro - int((ANTES_S + MARGEN_S) * fps))
    hasta = min(n - 1, centro + int((DESPUES_S + MARGEN_S) * fps))
    fotos = {}
    k = 0
    while k <= hasta:
        ok, img = cap.read()
        if not ok:
            break
        if k >= desde:
            r = modelo.predict(img, imgsz=1280, conf=0.08, classes=[0, 32], verbose=False)[0]
            personas, balon, mejor = [], None, 0.0
            if r.boxes is not None and len(r.boxes):
                for c, caja, p in zip(r.boxes.cls.cpu().numpy().astype(int), r.boxes.xyxy.cpu().numpy(), r.boxes.conf.cpu().numpy()):
                    x1, y1, x2, y2 = (float(v) for v in caja)
                    if c == 32 and p > mejor and p >= 0.15:
                        mejor, balon = float(p), [(x1 + x2) / 2, (y1 + y2) / 2]
                    elif c == 0 and p >= 0.3 and (y2 - y1) >= alto * 0.035 and y2 > alto * 0.2:
                        personas.append([round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1), color_camiseta(img, (x1, y1, x2, y2))])
            fotos[k] = {"p": personas, "b": balon}
        k += 1
    cap.release()

    # La «cabeza»: el más pegado al balón sin mirar equipo (para aprender la camiseta).
    votos = []
    for kk, f in fotos.items():
        if abs(kk - centro) > ANTES_S * fps or f["b"] is None or not f["p"]:
            continue
        cerca = sorted(((distancia(f["b"], p), p) for p in f["p"] if distancia(f["b"], p) < CERCA), key=lambda x: x[0])
        if not cerca or (len(cerca) > 1 and cerca[1][0] - cerca[0][0] < 0.15):
            continue
        if cerca[0][1][4] is not None:
            votos.append(cerca[0][1][4])
    cabeza = None
    if len(votos) >= 3:
        med = np.median(np.array(votos), axis=0)
        cerca_med = [v for v in votos if np.linalg.norm(np.array(v) - med) < COLOR_MAX]
        if len(cerca_med) / len(votos) >= 0.6:
            cabeza = [round(float(x), 1) for x in np.median(np.array(cerca_med), axis=0)]

    with open(salida_json, "w", encoding="utf-8") as fh:
        json.dump({"fps": fps, "centro": centro, "fotos": {str(k): v for k, v in fotos.items()}}, fh)
    sal({"cabeza": cabeza, "votos": len(votos)})


def distancia(bal, p):
    x1, y1, x2, y2 = p[:4]
    h = max(y2 - y1, 1.0)
    cx = (x1 + x2) / 2
    return min(np.hypot(bal[0] - cx, bal[1] - y2), np.hypot(bal[0] - cx, bal[1] - (y1 + y2) / 2)) / h


def pinta(entrada, salida, analisis, nombre, kit, ffmpeg, args_salida):
    with open(analisis, encoding="utf-8") as fh:
        a = json.load(fh)
    fps, centro = a["fps"], a["centro"]
    fotos = {int(k): v for k, v in a["fotos"].items()}
    kit = np.array(kit, dtype=np.float32)

    def suyo(p):
        return p[4] is not None and np.linalg.norm(np.array(p[4]) - kit) < COLOR_MAX

    votos = []
    for k, f in fotos.items():
        if abs(k - centro) > ANTES_S * fps or k - centro > DESPUES_S * fps or f["b"] is None:
            continue
        cerca = sorted(((distancia(f["b"], p), p) for p in f["p"] if suyo(p) and distancia(f["b"], p) < CERCA), key=lambda x: x[0])
        if not cerca or (len(cerca) > 1 and cerca[1][0] - cerca[0][0] < 0.15):
            continue
        votos.append((k, cerca[0][1][:4]))
    if not votos:
        shutil.copyfile(entrada, salida)
        return sal({"marcado": False, "motivo": "nadie de su camiseta pegado al balón en la acción"})

    def junto(a_, b_, factor=1.35):
        h = max(a_[3] - a_[1], b_[3] - b_[1], 1.0)
        return np.hypot((a_[0] + a_[2]) / 2 - (b_[0] + b_[2]) / 2, a_[3] - b_[3]) < factor * h

    grupos = []
    for k, caja in votos:
        for g in grupos:
            if any(junto(caja, c2) and abs(k - k2) <= 12 for k2, c2 in g):
                g.append((k, caja))
                break
        else:
            grupos.append([(k, caja)])
    grupos.sort(key=len, reverse=True)
    g = grupos[0]
    if len(g) < 3 or len(g) / len(votos) < 0.6:
        shutil.copyfile(entrada, salida)
        return sal({"marcado": False, "motivo": f"no está claro ({len(g)} de {len(votos)} votos)"})

    k0, caja0 = min(g, key=lambda x: abs(x[0] - centro))
    cajas = {k0: caja0}
    for paso in (-1, 1):
        prev, k = caja0, k0 + paso
        while k in fotos:
            propias = [p[:4] for p in fotos[k]["p"] if suyo(p)] or [p[:4] for p in fotos[k]["p"]]
            if not propias:
                break
            sig = min(propias, key=lambda c: np.hypot((c[0] + c[2]) / 2 - (prev[0] + prev[2]) / 2, c[3] - prev[3]))
            if not junto(sig, prev, 0.9):
                break
            cajas[k], prev, k = sig, sig, k + paso
    suave, ant = {}, None
    for k in sorted(cajas):
        c = cajas[k]
        ant = c if ant is None else [0.55 * c[j] + 0.45 * ant[j] for j in range(4)]
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
        (tw, th), _ = cv2.getTextSize(texto, cv2.FONT_HERSHEY_DUPLEX, 0.85, 2)
        tx = int(min(max(cx - tw / 2, 12), img.shape[1] - tw - 12))
        ty = int(max(y1 - h * 0.6 - 18, th + 16))
        cv2.rectangle(out, (tx - 12, ty - th - 12), (tx + tw + 12, ty + 12), (20, 15, 11), -1)
        cv2.rectangle(out, (tx - 12, ty - th - 12), (tx + tw + 12, ty + 12), ORO, 2)
        cv2.putText(out, texto, (tx, ty), cv2.FONT_HERSHEY_DUPLEX, 0.85, (255, 255, 255), 2, cv2.LINE_AA)
        return out

    cap = cv2.VideoCapture(entrada)
    ancho = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    alto = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    proc = subprocess.Popen(
        [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ancho}x{alto}", "-r", str(int(round(fps))), "-i", "-", *args_salida, salida],
        stdin=subprocess.PIPE,
    )
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
        shutil.copyfile(entrada, salida)
        return sal({"marcado": False, "motivo": "ffmpeg no pudo escribir"})
    sal({"marcado": True, "votos": len(g), "de": len(votos), "congela": round(k0 / fps, 2)})


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        if modo == "analiza":
            analiza(sys.argv[2], float(sys.argv[3]), sys.argv[4])
        elif modo == "pinta":
            e, s, an, nom, L, A, B, ff = sys.argv[2:10]
            pinta(e, s, an, nom, [float(L), float(A), float(B)], ff, sys.argv[10:])
        else:
            sal({"error": "modo: analiza o pinta"})
    except Exception as ex:  # nunca para el montaje
        if modo == "pinta" and len(sys.argv) > 3:
            try:
                shutil.copyfile(sys.argv[2], sys.argv[3])
            except Exception:
                pass
        sal({"marcado": False, "motivo": f"error: {ex}"})
