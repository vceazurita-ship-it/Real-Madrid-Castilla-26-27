"""
EL RELOJ DEL MARCADOR DE LA TELE (26/11/2026).

Opta entrega el vídeo de cada momento unos segundos antes de lo pedido, y no
siempre lo mismo: el 20/11 eran 3 s en la primera parte y 6-7 en la segunda.
Con un fotograma de cada parte se lee el reloj del marcador y se sabe el
desfase exacto de ese partido y esa parte.

  python reloj.py <imagen> <segundos_esperados> [<imagen> <segundos_esperados> …]

Por cada imagen, una línea JSON: {"imagen": …, "reloj": segundos | null, "texto": "48:37"}.
Se lee con EasyOCR la franja de arriba (donde va el marcador) y, de lo que
salga con forma de reloj, se queda lo más cercano a lo esperado (a menos de 90 s):
así no confunde el resultado ni el minuto de la sobreimpresión. EasyOCR a veces
lee los dos puntos como un 8 («13836»): se acepta.
"""

import json
import os
import re
import sys

import cv2

CARPETA = os.path.join(os.environ.get("LOCALAPPDATA", "."), "rmcf-vision", "ocr")


def candidatos(textos):
    salida = []
    for t in textos:
        t = t.strip().replace(" ", "")
        m = re.match(r"^(\d{1,3}):(\d{2})$", t)
        if m:
            salida.append((int(m.group(1)) * 60 + int(m.group(2)), t))
            continue
        if re.match(r"^\d{4,6}$", t):
            # «13836» = 13:36 con los dos puntos leídos como 8; «4837» = 48:37 sin ellos.
            for mm, ss in ((t[:-3], t[-2:]), (t[:-2], t[-2:])):
                if mm and len(mm) <= 3 and int(ss) < 60:
                    salida.append((int(mm) * 60 + int(ss), t))
    return salida


def main():
    import easyocr

    os.makedirs(CARPETA, exist_ok=True)
    lector = easyocr.Reader(["en"], gpu=False, model_storage_directory=CARPETA, verbose=False)
    args = sys.argv[1:]
    for i in range(0, len(args) - 1, 2):
        ruta, esperado = args[i], float(args[i + 1])
        img = cv2.imread(ruta)
        if img is None:
            print(json.dumps({"imagen": ruta, "reloj": None}), flush=True)
            continue
        h, w = img.shape[:2]
        franja = cv2.resize(img[0 : int(h * 0.13), 0 : int(w * 0.5)], None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        textos = lector.readtext(franja, detail=0, allowlist="0123456789:")
        cands = [c for c in candidatos(textos) if abs(c[0] - esperado) <= 90]
        if not cands:
            print(json.dumps({"imagen": ruta, "reloj": None, "leido": textos}), flush=True)
            continue
        mejor = min(cands, key=lambda c: abs(c[0] - esperado))
        print(json.dumps({"imagen": ruta, "reloj": mejor[0], "texto": mejor[1]}), flush=True)


if __name__ == "__main__":
    main()
