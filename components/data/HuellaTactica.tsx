"use client";

/**
 * HUELLA TÁCTICA DEL CASTILLA (13/11/2026).
 *
 * Dónde tocamos el balón en un partido comparado con lo normal nuestro. Con
 * `opta:castilla-eventos` (sólo las acciones del Castilla, `nuestra`):
 *
 * - el campo (105 × 68) en una rejilla de 12 × 8;
 * - en cada partido, qué parte de nuestros toques cae en cada casilla;
 * - la media de la temporada es la media de esos repartos (cada partido pesa
 *   lo mismo, juegue más o menos el balón);
 * - lo que se pinta es la diferencia en puntos: rojo = ahí tocamos más que
 *   nuestra media, azul = menos. La escala es la misma en todos los partidos
 *   (el mayor desvío de la temporada), para que se puedan comparar.
 *
 * Debajo, el % de toques en campo rival (x ≥ 50) del partido frente a la
 * media. Siempre atacando hacia la derecha.
 */

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { CampoOpta } from "@/components/campo/CampoOpta";
import { Cifra, Elegir, Panel } from "@/app/opta/_piezas/comun";
import { useAcciones } from "@/app/opta/_piezas/eventos";
import type { DatosOpta } from "@/app/opta/_piezas/useOpta";
import { fechaCorta } from "@/lib/opta-analisis";
import type { AccionCastilla } from "@/lib/opta-eventos";

const COLUMNAS = 12;
const FILAS = 8;
const CASILLAS = COLUMNAS * FILAS;
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

type Partido = { partido: string; fecha: string; rival: string; reparto: number[]; toques: number; rival50: number };

function repartos(acciones: AccionCastilla[]): Partido[] {
  const m = new Map<string, { partido: string; fecha: string; rival: string; cuenta: number[]; toques: number; arriba: number }>();
  for (const a of acciones) {
    if (!a.nuestra || NO_ES_TOQUE.has(a.tipo)) continue;
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || (a.x === 0 && a.y === 0)) continue;
    let p = m.get(a.partido);
    if (!p) {
      p = { partido: a.partido, fecha: a.fecha, rival: a.rival, cuenta: new Array(CASILLAS).fill(0), toques: 0, arriba: 0 };
      m.set(a.partido, p);
    }
    p.cuenta[casilla(a.x, a.y)]++;
    p.toques++;
    if (a.x >= 50) p.arriba++;
  }
  return [...m.values()]
    .filter((p) => p.toques >= 50)
    .map((p) => ({ partido: p.partido, fecha: p.fecha, rival: p.rival, toques: p.toques, reparto: p.cuenta.map((n) => n / p.toques), rival50: p.arriba / p.toques }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

const puntos = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1).replace(".", ",")}`;
const porcentaje = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;

export function HuellaTactica({ datos }: { datos: DatosOpta }) {
  const { acciones, cargando } = useAcciones(datos);
  const partidos = useMemo(() => repartos(acciones), [acciones]);
  const [elegido, setElegido] = useState("");

  const media = useMemo(() => {
    const r = new Array(CASILLAS).fill(0);
    if (!partidos.length) return { reparto: r, rival50: 0 };
    for (const p of partidos) p.reparto.forEach((v, i) => (r[i] += v / partidos.length));
    return { reparto: r, rival50: partidos.reduce((s, p) => s + p.rival50, 0) / partidos.length };
  }, [partidos]);

  /* La misma escala en todos los partidos: el mayor desvío de la temporada. */
  const tope = useMemo(() => {
    let t = 0;
    for (const p of partidos) p.reparto.forEach((v, i) => (t = Math.max(t, Math.abs(v - media.reparto[i]))));
    return t || 0.01;
  }, [partidos, media]);

  if (cargando || partidos.length < 2) return null;
  const partido = partidos.find((p) => p.partido === elegido) ?? partidos[0];
  const dif = partido.reparto.map((v, i) => v - media.reparto[i]);
  const difRival = partido.rival50 - media.rival50;

  /* Las tres casillas que más se separan de lo nuestro, para la frase. */
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
        subtitulo={`Reparto de nuestros toques en el partido menos el reparto medio de la temporada (${partidos.length} partidos), casilla a casilla. Rojo = ahí tocamos más que nuestra media; azul = menos. La misma escala en todos los partidos.`}
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
          {(p) => (
            <>
              {dif.map((v, i) => {
                const c = i % COLUMNAS;
                const f = Math.floor(i / COLUMNAS);
                const x0 = (c / COLUMNAS) * 100;
                const x1 = ((c + 1) / COLUMNAS) * 100;
                const y0 = (f / FILAS) * 100;
                const y1 = ((f + 1) / FILAS) * 100;
                const [ax, ay] = p(x0, y1);
                const [bx, by] = p(x1, y0);
                const fuerza = Math.min(1, Math.abs(v) / tope);
                return (
                  <rect
                    key={i}
                    x={Math.min(ax, bx)}
                    y={Math.min(ay, by)}
                    width={Math.abs(bx - ax)}
                    height={Math.abs(by - ay)}
                    style={{ fill: `rgba(${v >= 0 ? MAS : MENOS},${(fuerza * 0.78).toFixed(3)})` }}
                  >
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
          )}
        </CampoOpta>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/55">
          <span className="inline-flex items-center gap-1">
            Atacamos hacia la derecha <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="inline-flex items-center gap-2" aria-label="Escala de color">
            <span className="tabular-nums">{puntos(-tope)}</span>
            <span
              className="h-2.5 w-28 rounded-full"
              style={{ background: `linear-gradient(90deg, rgba(${MENOS},0.85), rgba(${MENOS},0.05) 50%, rgba(${MAS},0.05) 50%, rgba(${MAS},0.85))` }}
            />
            <span className="tabular-nums">{puntos(tope)}</span>
            <span>puntos de % de los toques</span>
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
