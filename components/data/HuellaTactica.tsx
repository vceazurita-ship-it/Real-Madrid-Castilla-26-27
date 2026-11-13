"use client";

/**
 * HUELLA TÁCTICA DEL CASTILLA (13/11/2026).
 *
 * Dónde tocamos el balón en un partido comparado con lo normal nuestro. Con
 * `opta:castilla-eventos` (sólo las acciones del Castilla, `nuestra`):
 *
 * - en cada partido, la densidad de nuestros toques en el campo (105 × 68):
 *   cada toque se reparte con un suavizado gaussiano de unos 6 m, en una malla
 *   fina de 50 × 34, y la densidad suma 1 (el reparto, no el volumen);
 * - la media de la temporada es la media de esas densidades (cada partido
 *   pesa lo mismo, juegue más o menos el balón);
 * - lo que se pinta es la diferencia, como mapa de calor continuo (petición
 *   del analista: las casillas no se leían bien): rojo = ahí tocamos más que
 *   nuestra media, azul = menos, transparente = como siempre. La escala es la
 *   misma en todos los partidos (el mayor desvío de la temporada).
 *
 * La frase de abajo y el texto al pasar el ratón siguen yendo por zonas
 * gruesas (12 × 8), que es como se habla en el campo. Debajo, el % de toques
 * en campo rival (x ≥ 50) del partido frente a la media. Siempre atacando hacia
 * la derecha.
 */

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { CampoOpta } from "@/components/campo/CampoOpta";
import { Cifra, Elegir, Panel } from "@/app/opta/_piezas/comun";
import { useAcciones } from "@/app/opta/_piezas/eventos";
import type { DatosOpta } from "@/app/opta/_piezas/useOpta";
import { fechaCorta } from "@/lib/opta-analisis";
import type { AccionCastilla } from "@/lib/opta-eventos";

/* Zonas gruesas, para la frase y el texto al pasar el ratón. */
const COLUMNAS = 12;
const FILAS = 8;
const CASILLAS = COLUMNAS * FILAS;

/* La malla fina del mapa de calor (≈ 2 m por punto) y el suavizado. */
const MX = 50;
const MY = 34;
const PUNTOS = MX * MY;
/** Desviación del suavizado, en puntos de la malla (3 ≈ 6 m). */
const SIGMA = 3;

/* Sobre el césped (oscuro en los dos temas). */
const MAS = "232,72,77";
const MENOS = "77,150,255";

/** Lo que no es un toque de balón (marcas del registro, no acciones). */
const NO_ES_TOQUE = new Set(["Error", "Foul", "Card", "OffsideProvoked"]);

const casilla = (x: number, y: number) => {
  const c = Math.min(COLUMNAS - 1, Math.max(0, Math.floor((x / 100) * COLUMNAS)));
  const f = Math.min(FILAS - 1, Math.max(0, Math.floor((y / 100) * FILAS)));
  return f * COLUMNAS + c;
};

const punto = (x: number, y: number) => {
  const i = Math.min(MX - 1, Math.max(0, Math.floor((x / 100) * MX)));
  const j = Math.min(MY - 1, Math.max(0, Math.floor((y / 100) * MY)));
  return j * MX + i;
};

/** El núcleo gaussiano, ya normalizado. */
const NUCLEO = (() => {
  const r = Math.ceil(SIGMA * 3);
  const k: number[] = [];
  for (let d = -r; d <= r; d++) k.push(Math.exp(-(d * d) / (2 * SIGMA * SIGMA)));
  const s = k.reduce((a, b) => a + b, 0);
  return { r, k: k.map((v) => v / s) };
})();

/** Suavizado gaussiano separable (primero a lo largo, luego a lo ancho), con los bordes pegados. */
function suaviza(m: number[]): number[] {
  const { r, k } = NUCLEO;
  const a = new Array(PUNTOS).fill(0);
  for (let j = 0; j < MY; j++)
    for (let i = 0; i < MX; i++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += m[j * MX + Math.min(MX - 1, Math.max(0, i + d))] * k[d + r];
      a[j * MX + i] = s;
    }
  const b = new Array(PUNTOS).fill(0);
  for (let j = 0; j < MY; j++)
    for (let i = 0; i < MX; i++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += a[Math.min(MY - 1, Math.max(0, j + d)) * MX + i] * k[d + r];
      b[j * MX + i] = s;
    }
  return b;
}

type Partido = { partido: string; fecha: string; rival: string; reparto: number[]; densidad: number[]; toques: number; rival50: number };

function repartos(acciones: AccionCastilla[]): Partido[] {
  const m = new Map<string, { partido: string; fecha: string; rival: string; cuenta: number[]; fina: number[]; toques: number; arriba: number }>();
  for (const a of acciones) {
    if (!a.nuestra || NO_ES_TOQUE.has(a.tipo)) continue;
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || (a.x === 0 && a.y === 0)) continue;
    let p = m.get(a.partido);
    if (!p) {
      p = { partido: a.partido, fecha: a.fecha, rival: a.rival, cuenta: new Array(CASILLAS).fill(0), fina: new Array(PUNTOS).fill(0), toques: 0, arriba: 0 };
      m.set(a.partido, p);
    }
    p.cuenta[casilla(a.x, a.y)]++;
    p.fina[punto(a.x, a.y)]++;
    p.toques++;
    if (a.x >= 50) p.arriba++;
  }
  return [...m.values()]
    .filter((p) => p.toques >= 50)
    .map((p) => ({
      partido: p.partido,
      fecha: p.fecha,
      rival: p.rival,
      toques: p.toques,
      reparto: p.cuenta.map((n) => n / p.toques),
      densidad: suaviza(p.fina.map((n) => n / p.toques)),
      rival50: p.arriba / p.toques,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * La diferencia como imagen (una celda de la malla = un píxel); el navegador
 * la estira con suavizado y queda un mapa de calor continuo. `arriba` dice si
 * la fila de arriba de la imagen es y = 100 (como sale en el campo) y
 * `derecha` si x crece hacia la derecha.
 */
function imagenDe(dif: number[], tope: number, arriba: boolean, derecha: boolean): string {
  if (typeof document === "undefined") return "";
  const lienzo = document.createElement("canvas");
  lienzo.width = MX;
  lienzo.height = MY;
  const c = lienzo.getContext("2d");
  if (!c) return "";
  const img = c.createImageData(MX, MY);
  const [rm, gm, bm] = MAS.split(",").map(Number);
  const [rn, gn, bn] = MENOS.split(",").map(Number);
  for (let fila = 0; fila < MY; fila++)
    for (let col = 0; col < MX; col++) {
      const j = arriba ? MY - 1 - fila : fila;
      const i = derecha ? col : MX - 1 - col;
      const v = dif[j * MX + i];
      /* Raíz: los desvíos pequeños se ven algo, los grandes mandan. */
      const fuerza = Math.min(1, Math.sqrt(Math.abs(v) / tope));
      const o = (fila * MX + col) * 4;
      img.data[o] = v >= 0 ? rm : rn;
      img.data[o + 1] = v >= 0 ? gm : gn;
      img.data[o + 2] = v >= 0 ? bm : bn;
      img.data[o + 3] = Math.round(fuerza * 0.82 * 255);
    }
  c.putImageData(img, 0, 0);
  return lienzo.toDataURL("image/png");
}

const puntos = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1).replace(".", ",")}`;
const porcentaje = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;

export function HuellaTactica({ datos }: { datos: DatosOpta }) {
  const { acciones, cargando } = useAcciones(datos);
  const partidos = useMemo(() => repartos(acciones), [acciones]);
  const [elegido, setElegido] = useState("");

  const media = useMemo(() => {
    const r = new Array(CASILLAS).fill(0);
    const d = new Array(PUNTOS).fill(0);
    if (!partidos.length) return { reparto: r, densidad: d, rival50: 0 };
    for (const p of partidos) {
      p.reparto.forEach((v, i) => (r[i] += v / partidos.length));
      p.densidad.forEach((v, i) => (d[i] += v / partidos.length));
    }
    return { reparto: r, densidad: d, rival50: partidos.reduce((s, p) => s + p.rival50, 0) / partidos.length };
  }, [partidos]);

  /* La misma escala en todos los partidos: el mayor desvío de la temporada. */
  const tope = useMemo(() => {
    let t = 0;
    for (const p of partidos) p.densidad.forEach((v, i) => (t = Math.max(t, Math.abs(v - media.densidad[i]))));
    return t || 1e-4;
  }, [partidos, media]);

  const partido = partidos.find((p) => p.partido === elegido) ?? partidos[0];
  const difFina = useMemo(() => (partido ? partido.densidad.map((v, i) => v - media.densidad[i]) : []), [partido, media]);

  if (cargando || partidos.length < 2 || !partido) return null;
  const dif = partido.reparto.map((v, i) => v - media.reparto[i]);
  const difRival = partido.rival50 - media.rival50;

  /* Las zonas que más se separan de lo nuestro, para la frase. */
  const zona = (i: number) => {
    const c = i % COLUMNAS;
    const f = Math.floor(i / COLUMNAS);
    const altura = c < 4 ? "campo propio" : c < 8 ? "zona media" : "último tercio";
    const lado = f < 2 ? "banda derecha" : f >= FILAS - 2 ? "banda izquierda" : "por dentro";
    return `${altura}, ${lado}`;
  };
  const orden = dif.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const masZona = orden[0].v > 0.005 ? zona(orden[0].i) : "";
  const menosZona = orden[orden.length - 1].v < -0.005 ? zona(orden[orden.length - 1].i) : "";

  return (
    <div className="mt-6">
      <Panel
        titulo="Huella táctica: dónde tocamos más y menos que nuestra media"
        subtitulo={`Mapa de calor de nuestros toques en el partido menos el de la media de la temporada (${partidos.length} partidos). Rojo = ahí tocamos más que nuestra media; azul = menos; sin color = como siempre. La misma escala en todos los partidos.`}
        derecha={
          <Elegir
            etiqueta="Partido"
            valor={partido.partido}
            alCambiar={setElegido}
            opciones={partidos.map((p) => ({ clave: p.partido, nombre: `${fechaCorta(p.fecha)} · ${p.rival}` }))}
          />
        }
      >
        <CampoOpta ariaLabel={`Huella táctica del Castilla contra ${partido.rival}`} maxAlto={440}>
          {(p) => {
            const [ax, ay] = p(0, 100);
            const [bx, by] = p(100, 0);
            const href = imagenDe(difFina, tope, ay < by, ax < bx);
            return (
              <>
                {href && (
                  <image
                    href={href}
                    x={Math.min(ax, bx)}
                    y={Math.min(ay, by)}
                    width={Math.abs(bx - ax)}
                    height={Math.abs(by - ay)}
                    preserveAspectRatio="none"
                    style={{ imageRendering: "auto", pointerEvents: "none" }}
                  />
                )}
                {/* Zonas invisibles: sólo para el texto al pasar el ratón. */}
                {dif.map((v, i) => {
                  const c = i % COLUMNAS;
                  const f = Math.floor(i / COLUMNAS);
                  const [cx, cy] = p((c / COLUMNAS) * 100, ((f + 1) / FILAS) * 100);
                  const [dx, dy] = p(((c + 1) / COLUMNAS) * 100, (f / FILAS) * 100);
                  return (
                    <rect key={i} x={Math.min(cx, dx)} y={Math.min(cy, dy)} width={Math.abs(dx - cx)} height={Math.abs(dy - cy)} style={{ fill: "transparent" }}>
                      <title>{`${zona(i)}: ${porcentaje(partido.reparto[i])} de los toques (media ${porcentaje(media.reparto[i])}; ${puntos(v)} puntos)`}</title>
                    </rect>
                  );
                })}
                {/* Flecha del sentido de ataque, abajo en el centro. */}
                <g style={{ pointerEvents: "none" }}>
                  <line x1={455} y1={652} x2={585} y2={652} style={{ stroke: "rgba(255,255,255,0.75)", strokeWidth: 4 }} />
                  <path d="M 585 640 L 605 652 L 585 664 Z" style={{ fill: "rgba(255,255,255,0.75)" }} />
                </g>
              </>
            );
          }}
        </CampoOpta>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/55">
          <span className="inline-flex items-center gap-1">
            Atacamos hacia la derecha <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="inline-flex items-center gap-2" aria-label="Escala de color">
            <span>menos que nuestra media</span>
            <span
              className="h-2.5 w-28 rounded-full"
              style={{ background: `linear-gradient(90deg, rgba(${MENOS},0.85), rgba(${MENOS},0.05) 50%, rgba(${MAS},0.05) 50%, rgba(${MAS},0.85))` }}
            />
            <span>más</span>
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Cifra rotulo="Toques en campo rival" valor={porcentaje(partido.rival50)} detalle={`${partido.toques} toques en el partido`} />
          <Cifra rotulo="Nuestra media" valor={porcentaje(media.rival50)} detalle={`${partidos.length} partidos de la temporada`} />
          <Cifra
            rotulo="Diferencia"
            valor={`${puntos(difRival)} puntos`}
            detalle={difRival > 0.005 ? "Jugamos más arriba que de costumbre" : difRival < -0.005 ? "Jugamos más atrás que de costumbre" : "Como de costumbre"}
            color={difRival > 0.005 ? `rgb(${MAS})` : difRival < -0.005 ? `rgb(${MENOS})` : undefined}
          />
        </div>

        {(masZona || menosZona) && (
          <p className="mt-3 text-[12px] text-white/75">
            Contra {partido.rival}
            {masZona && <> tocamos más que nuestra media en {masZona} ({puntos(orden[0].v)} puntos)</>}
            {masZona && menosZona && " y"}
            {menosZona && <> menos en {menosZona} ({puntos(orden[orden.length - 1].v)} puntos)</>}.
          </p>
        )}
      </Panel>
    </div>
  );
}
