"use client";

/**
 * HUELLA TÁCTICA DE LA LIGA (14/11/2026, petición del analista; idea de
 * F. Sosa · The Eye Intelligence Unit).
 *
 * Un mini-campo por equipo del grupo (atacando hacia arriba) con dónde toca
 * MÁS (rojo) y MENOS (azul) balón que el equipo medio del grupo; claro = como
 * la media. Todos con la misma escala. Ordenados por % de toques en campo
 * rival, con su diferencia con la media; en el centro, «Media de la liga» con
 * el mapa de calor normal. Pinchar un equipo lo agranda junto a la media.
 *
 * Datos: `opta:huella` (scripts/opta-huella.mjs, con el evento a evento de
 * todos los partidos guardados en opta:directo:<partido>). Aquí se suaviza
 * (≈ 5 m), se pasa a reparto (suma 1) y se resta la media del grupo.
 */

import { useEffect, useMemo, useState } from "react";

import { Botonera, Panel } from "@/app/opta/_piezas/comun";
import { CampoOpta, type Proyecta } from "@/components/campo/CampoOpta";
import { ORO, useEscudos } from "@/components/data/graficas";
import { traeOpta } from "@/lib/opta";
import { useProximoRival } from "@/hooks/useAbpLigas";
import { mismoClub } from "@/lib/rivals/mismoClub";

type EquipoHuella = { teamId: string; nombre: string; grupo: number; castilla: boolean; partidos: number; toques: number; campoRival: number; malla: number[] };
type DocHuella = { actualizado: string; mx: number; my: number; partidos: number; equipos: EquipoHuella[] };

const MAS = [232, 72, 77];
const MENOS = [64, 132, 245];
const SIGMA = 1.6;

/** Suavizado gaussiano separable con bordes pegados. */
function suaviza(m: number[], mx: number, my: number): number[] {
  const r = Math.ceil(SIGMA * 3);
  const k: number[] = [];
  for (let d = -r; d <= r; d++) k.push(Math.exp(-(d * d) / (2 * SIGMA * SIGMA)));
  const s = k.reduce((a, b) => a + b, 0);
  const n = k.map((v) => v / s);
  const a = new Array(mx * my).fill(0);
  for (let j = 0; j < my; j++)
    for (let i = 0; i < mx; i++) {
      let t = 0;
      for (let d = -r; d <= r; d++) t += m[j * mx + Math.min(mx - 1, Math.max(0, i + d))] * n[d + r];
      a[j * mx + i] = t;
    }
  const b = new Array(mx * my).fill(0);
  for (let j = 0; j < my; j++)
    for (let i = 0; i < mx; i++) {
      let t = 0;
      for (let d = -r; d <= r; d++) t += a[Math.min(my - 1, Math.max(0, j + d)) * mx + i] * n[d + r];
      b[j * mx + i] = t;
    }
  return b;
}

/**
 * La malla como imagen vertical (ataca hacia arriba): columna = y de 100 a 0,
 * fila = x de 100 a 0, que es como la pinta CampoOpta en vertical.
 */
function imagen(valores: number[], mx: number, my: number, pinta: (v: number) => [number, number, number, number]): string {
  if (typeof document === "undefined") return "";
  const lienzo = document.createElement("canvas");
  lienzo.width = my;
  lienzo.height = mx;
  const c = lienzo.getContext("2d");
  if (!c) return "";
  const img = c.createImageData(my, mx);
  for (let fila = 0; fila < mx; fila++)
    for (let col = 0; col < my; col++) {
      const i = mx - 1 - fila;
      const j = my - 1 - col;
      const [r, g, b, a] = pinta(valores[j * mx + i]);
      const o = (fila * my + col) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = a;
    }
  c.putImageData(img, 0, 0);
  return lienzo.toDataURL("image/png");
}

const diferencia = (tope: number) => (v: number): [number, number, number, number] => {
  /* Lo cercano a la media, transparente; a partir de ahí sube suave hasta el tope. */
  const f = Math.max(0, Math.min(1, (Math.abs(v) / tope - 0.12) / 0.88));
  const [r, g, b] = v >= 0 ? MAS : MENOS;
  return [r, g, b, Math.round(Math.pow(f, 0.8) * 0.92 * 255)];
};

/** Mapa de calor normal (amarillo → rojo), para la media. */
const calor = (tope: number) => (v: number): [number, number, number, number] => {
  const f = Math.min(1, v / tope);
  return [240, Math.round(220 - 190 * f), Math.round(60 - 40 * f), Math.round((0.25 + 0.65 * f) * 255)];
};

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const puntos = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")}`;

function MiniCampo({ href, etiqueta, maxAlto }: { href: string; etiqueta: string; maxAlto: number }) {
  return (
    <CampoOpta vertical ariaLabel={etiqueta} maxAlto={maxAlto}>
      {(p: Proyecta) => {
        const [ax, ay] = p(100, 100);
        const [bx, by] = p(0, 0);
        return href ? <image href={href} x={Math.min(ax, bx)} y={Math.min(ay, by)} width={Math.abs(bx - ax)} height={Math.abs(by - ay)} preserveAspectRatio="none" style={{ imageRendering: "auto" }} /> : null;
      }}
    </CampoOpta>
  );
}

/** La zona que más se aparta, dicha como en el campo. */
function zonaDe(dif: number[], mx: number, my: number, signo: 1 | -1): string {
  let mejor = -Infinity;
  let k = 0;
  dif.forEach((v, i) => {
    if (v * signo > mejor) {
      mejor = v * signo;
      k = i;
    }
  });
  const x = ((k % mx) + 0.5) / mx;
  const y = (Math.floor(k / mx) + 0.5) / my;
  const altura = x < 1 / 3 ? "en su campo" : x < 2 / 3 ? "en el medio" : "en el último tercio";
  const carril = y > 0.66 ? "por la izquierda" : y < 0.34 ? "por la derecha" : "por dentro";
  return `${altura}, ${carril}`;
}

export function HuellaLiga() {
  const proximo = useProximoRival();
  const [doc, setDoc] = useState<DocHuella | null | undefined>(undefined);
  const [grupo, setGrupo] = useState<"1" | "2">("1");
  const [elegido, setElegido] = useState("");
  const escudoDe = useEscudos();

  useEffect(() => {
    let vivo = true;
    void traeOpta<DocHuella>("opta:huella").then((d) => vivo && setDoc(d));
    return () => {
      vivo = false;
    };
  }, []);

  const calc = useMemo(() => {
    if (!doc?.equipos?.length) return null;
    const { mx, my } = doc;
    const equipos = doc.equipos
      .filter((e) => String(e.grupo) === grupo && e.toques > 0)
      .map((e) => ({ ...e, densidad: suaviza(e.malla.map((v) => v / e.toques), mx, my) }));
    if (!equipos.length) return null;
    const media = new Array(mx * my).fill(0);
    for (const e of equipos) e.densidad.forEach((v, i) => (media[i] += v / equipos.length));
    const campoMedio = equipos.reduce((s, e) => s + e.campoRival, 0) / equipos.length;
    const conDif = equipos.map((e) => ({ ...e, dif: e.densidad.map((v, i) => v - media[i]) }));
    /* La misma escala para todos: el percentil 98 de los desvíos (un pico suelto no apaga el resto). */
    const abs = conDif.flatMap((e) => e.dif.map(Math.abs)).sort((a, b) => a - b);
    const tope = abs[Math.floor(abs.length * 0.98)] || 1e-6;
    const topeMedia = Math.max(...media);
    const imagenes = new Map(conDif.map((e) => [e.teamId, imagen(e.dif, mx, my, diferencia(tope))]));
    const imagenMedia = imagen(media, mx, my, calor(topeMedia));
    return { equipos: conDif.sort((a, b) => b.campoRival - a.campoRival), media, campoMedio, imagenes, imagenMedia };
  }, [doc, grupo]);

  if (doc === undefined) return <p className="mt-6 text-sm text-white/55">Cargando la huella de la liga…</p>;
  if (!doc || !calc) {
    return (
      <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
        La huella sale del evento a evento de cada partido; aún no se ha calculado (scripts/opta-huella.mjs, cada lunes con la descarga de Opta).
      </p>
    );
  }

  const { mx, my } = doc;
  const lista = calc.equipos;
  const mitad = Math.floor(lista.length / 2);
  const celdas: ({ tipo: "equipo"; e: (typeof lista)[number] } | { tipo: "media" })[] = [
    ...lista.slice(0, mitad).map((e) => ({ tipo: "equipo" as const, e })),
    { tipo: "media" as const },
    ...lista.slice(mitad).map((e) => ({ tipo: "equipo" as const, e })),
  ];
  const sel = lista.find((e) => e.teamId === elegido) ?? null;
  /* El titular es la conclusión (expertos, 14/11/2026): dónde está el Castilla frente a la media. */
  const cas = lista.find((e) => e.castilla);
  const titular = cas
    ? `Castilla, ${lista.indexOf(cas) + 1}.º del grupo: ${pct(cas.campoRival)} de toques en campo rival (${puntos(cas.campoRival - calc.campoMedio)})`
    : null;
  /* El próximo rival, marcado como el Castilla y con su línea (expertos, 14/11/2026). */
  const riv = proximo ? lista.find((e) => !e.castilla && mismoClub(e.nombre, proximo)) : undefined;

  return (
    <Panel
      className="mt-6"
      titulo={titular ?? "Huella táctica · dónde toca cada equipo más y menos balón que la media"}
      subtitulo={`${riv ? `Próximo rival, ${riv.nombre}: ${lista.indexOf(riv) + 1}.º, ${pct(riv.campoRival)} en campo rival (${puntos(riv.campoRival - calc.campoMedio)}), con recuadro blanco en la rejilla. ` : ""}Frente al equipo medio del grupo · ordenados por % de toques en campo rival · ${doc.partidos} partidos de Opta · rojo = toca más ahí, no mejor`}
      derecha={
        <Botonera
          etiqueta="Grupo"
          valor={grupo}
          opciones={[
            { clave: "1", nombre: "Grupo del Castilla" },
            { clave: "2", nombre: "El otro grupo" },
          ]}
          alCambiar={(g) => {
            setGrupo(g);
            setElegido("");
          }}
        />
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-white/65">
        <span>Toca menos que la media</span>
        <span aria-hidden className="h-2.5 w-40 rounded-full" style={{ background: `linear-gradient(90deg, rgb(${MENOS.join(",")}), rgba(255,255,255,0.15), rgb(${MAS.join(",")}))` }} />
        <span>Toca más que la media</span>
      </div>

      {sel && (
        <div className="mb-5 rounded-2xl border p-4" style={{ borderColor: "rgba(200,169,107,0.5)", background: "rgba(200,169,107,0.06)" }}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-bold" style={{ color: sel.castilla ? ORO : undefined }}>
                {sel.castilla ? "Real Madrid Castilla" : sel.nombre}
              </p>
              <p className="text-sm text-white/70">
                Toca más que la media {zonaDe(sel.dif, mx, my, 1)}; menos {zonaDe(sel.dif, mx, my, -1)}.
              </p>
            </div>
            <button type="button" onClick={() => setElegido("")} className="rounded-xl border border-white/15 px-3 py-1.5 text-sm text-white/75 hover:text-white">
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-center text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Su huella</p>
              <MiniCampo href={calc.imagenes.get(sel.teamId) ?? ""} etiqueta={`Huella de ${sel.nombre}`} maxAlto={420} />
              <p className="mt-1 text-center text-sm tabular-nums text-white/75">
                Campo rival {pct(sel.campoRival)} <span style={{ color: sel.campoRival >= calc.campoMedio ? "#E8484D" : "#4F8FE8" }}>({puntos(sel.campoRival - calc.campoMedio)})</span>
              </p>
            </div>
            <div>
              <p className="mb-1 text-center text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Media del grupo</p>
              <MiniCampo href={calc.imagenMedia} etiqueta="Mapa de calor de la media del grupo" maxAlto={420} />
              <p className="mt-1 text-center text-sm tabular-nums text-white/75">Campo rival {pct(calc.campoMedio)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-7">
        {celdas.map((c) => {
          if (c.tipo === "media") {
            return (
              <div key="media" className="min-w-0 text-center">
                <p className="truncate text-sm font-bold" style={{ color: "#E8484D" }}>
                  Media de la liga
                </p>
                <p className="text-xs text-white/65">Campo rival: {pct(calc.campoMedio)}</p>
                <p className="text-xs text-white/45">La referencia (mapa normal)</p>
                <div className="mt-1">
                  <MiniCampo href={calc.imagenMedia} etiqueta="Mapa de calor de la media del grupo" maxAlto={190} />
                </div>
              </div>
            );
          }
          const e = c.e;
          const escudo = escudoDe(e.nombre);
          const d = e.campoRival - calc.campoMedio;
          return (
            <button
              key={e.teamId}
              type="button"
              onClick={() => setElegido(e.teamId === elegido ? "" : e.teamId)}
              aria-pressed={e.teamId === elegido}
              className="min-w-0 rounded-xl p-1 text-center transition hover:bg-white/[0.05]"
              style={e.castilla ? { boxShadow: "inset 0 0 0 2px rgba(227,194,126,0.7)" } : e.teamId === riv?.teamId ? { boxShadow: "inset 0 0 0 2px var(--foreground)" } : e.teamId === elegido ? { boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.4)" } : undefined}
            >
              <p className="flex items-center justify-center gap-1.5 truncate text-sm font-bold" style={e.castilla ? { color: ORO } : undefined}>
                {escudo && (
                  // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
                  <img src={escudo} alt="" width={16} height={16} className="h-4 w-4 shrink-0 object-contain" />
                )}
                <span className="truncate">{e.castilla ? "Real Madrid Castilla" : e.nombre}</span>
              </p>
              <p className="text-xs tabular-nums text-white/65">
                Campo rival: <b className="text-white/90">{pct(e.campoRival)}</b> <span style={{ color: d >= 0 ? "#E8484D" : "#4F8FE8" }}>({puntos(d)})</span>
              </p>
              <p className="text-xs tabular-nums text-white/45">
                {e.toques.toLocaleString("es-ES")} toques · {e.partidos} PJ
              </p>
              <div className="mt-1">
                <MiniCampo href={calc.imagenes.get(e.teamId) ?? ""} etiqueta={`Huella de ${e.nombre}`} maxAlto={190} />
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-white/55">
        Enseña la DIFERENCIA con el equipo medio del grupo: rojo = toca más ahí que la media; azul = toca menos; claro = como la media. Todos los campos usan la misma escala. Cada
        equipo ataca hacia arriba (su portería, abajo). Campo rival = % de sus toques en la mitad de arriba. Toque = toda acción con balón del evento a evento de Opta (sin faltas ni
        córners concedidos). Pincha un equipo para verlo en grande junto a la media. Idea: F. Sosa (The Eye Intelligence Unit).
      </p>
    </Panel>
  );
}
