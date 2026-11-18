"use client";

/*
|--------------------------------------------------------------------------
| EL ONCE DE UN VISTAZO (17/11/2026, jueces de fútbol; minicampo 18/11/2026)
|--------------------------------------------------------------------------
|
| Un minicampo con los once titulares del once probable, cada uno en su hueco
| del dibujo y con LAS MISMAS LÍNEAS que el campograma (`lineasDelDibujo`: en
| un 4-2-3-1, 4 defensas, 2 medios, 3 por detrás del punta y 1 delantero).
| Cada ficha lleva como mucho UN veredicto (nunca «Peligro» y «Explotable» a
| la vez), y desde el 18/11/2026 (ronda 23) con jerarquía: como mucho 3 de
| cada lado, los más extremos frente a su puesto en una métrica clave
| (`lib/rivals/metricas-del-puesto.ts`, la misma lista que Scout individual):
|   rojo  = peligro (mejor que 8 de cada 10 de su puesto);
|   verde = explotable (peor que 8 de cada 10).
| Debajo, una frase con los nombres; el porqué con su cifra y su base, al
| pinchar la ficha. Las órdenes viven en «Dónde hacerles daño» y «Dónde nos
| hacen daño»: aquí no se repiten. Quien juega en un hueco que no es el suyo
| lleva el borde a rayas («fuera de su sitio»). La cuenta, en la pantalla
| (`resumenDelOnce` de app/rivals/page.tsx); aquí sólo se pinta.
*/

import { useState } from "react";

import { LEYENDA_JERARQUIA } from "@/lib/rivals/metricas-del-puesto";

const capital = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

export type Veredicto = {
  tipo: "peligro" | "explotable";
  /** Qué hace o qué le cuesta, con la cifra: «Progresión: mejor que 9 de cada 10 de su puesto». */
  porque: string;
  /** De dónde sale: «8 partidos · Wyscout», «tendencia · 2 PJ · etiqueta del analista». */
  base: string;
};

export type FichaResumen = {
  clave: string;
  nombre: string;
  dorsal: string;
  /** El hueco en el dibujo («LD», «MC»…). */
  hueco: string;
  /** Su puesto en el once, en palabras: «pivote», «extremo izquierdo». */
  puesto: string;
  /** Va a un hueco que no es el suyo (el once guardado no tenía otro). */
  fuera: boolean;
  veredicto: Veredicto | null;
};

export type LineaResumen = {
  clave: string;
  titulo: string;
  color: string;
  fichas: FichaResumen[];
};

/** Frases con comas dentro: «A (…); B (…) y C (…)». */
const lista = (frases: string[]) => (frases.length < 2 ? frases.join("") : `${frases.slice(0, -1).join("; ")} y ${frases[frases.length - 1]}`);

/*
| EL NOMBRE BAJO LA FICHA (18/11/2026, ronda 23, guionista): «Mier» salía dos
| veces (Javi y Jorge). Si el apellido se repite en el once, va con la inicial
| («J. Mier»); si también la inicial, con las tres primeras letras («Jav. Mier»
| y «Jor. Mier»), como el campograma, que pone la inicial delante.
*/
function rotulosDelOnce(fichas: FichaResumen[]): Map<string, string> {
  const partes = (n: string) => n.trim().split(/\s+/);
  const apellido = (n: string) => partes(n).slice(-1)[0] ?? n;
  const cuantos = new Map<string, number>();

  for (const f of fichas) cuantos.set(apellido(f.nombre).toLowerCase(), (cuantos.get(apellido(f.nombre).toLowerCase()) ?? 0) + 1);

  const rotulos = new Map<string, string>();

  for (const f of fichas) {
    const ap = apellido(f.nombre);
    const nombre = partes(f.nombre)[0] ?? "";

    if ((cuantos.get(ap.toLowerCase()) ?? 0) < 2 || partes(f.nombre).length < 2) {
      rotulos.set(f.clave, ap);
      continue;
    }

    const iguales = fichas.filter((o) => o.clave !== f.clave && apellido(o.nombre).toLowerCase() === ap.toLowerCase());
    const mismaInicial = iguales.some((o) => (partes(o.nombre)[0] ?? "").charAt(0).toLowerCase() === nombre.charAt(0).toLowerCase());

    rotulos.set(f.clave, `${mismaInicial ? nombre.slice(0, 3) : nombre.charAt(0)}. ${ap}`);
  }

  return rotulos;
}

function Ficha({ ficha, rotulo, activa, onClick }: { ficha: FichaResumen; rotulo: string; activa: boolean; onClick: () => void }) {
  const anillo =
    ficha.veredicto?.tipo === "peligro" ? "border-red-400" : ficha.veredicto?.tipo === "explotable" ? "border-emerald-400" : "border-white/25";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      title={`${ficha.nombre} · ${ficha.puesto || ficha.hueco}${ficha.fuera ? " · fuera de su sitio" : ""}`}
      className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 transition hover:bg-white/[0.06] ${activa ? "bg-white/[0.08]" : ""}`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-[#C8A96B] text-[12px] font-bold tabular-nums text-black ${anillo} ${ficha.fuera ? "border-dashed" : ""}`}
      >
        {ficha.dorsal || ficha.hueco.slice(0, 2)}
      </span>
      <span className="block w-full truncate text-center text-[11px] leading-tight text-white/80">{rotulo}</span>
    </button>
  );
}

export function ResumenDelOnce({
  equipo,
  dibujo,
  lineas,
  abrir,
}: {
  equipo: string;
  dibujo: string;
  /** De la portería al ataque. */
  lineas: LineaResumen[];
  /** Abre la ficha de ese jugador (clave del once). */
  abrir: (clave: string) => void;
}) {
  const [elegida, setElegida] = useState<string | null>(null);
  const conGente = lineas.filter((linea) => linea.fichas.length > 0);

  if (conGente.length === 0) return null;

  const fichas = conGente.flatMap((linea) => linea.fichas);
  const rotulos = rotulosDelOnce(fichas);
  /* Con su cifra (18/11/2026, ronda 23): «Flakus (xG 0,6 por 90′, mejor que 9 de cada 10 delanteros)». */
  const conCifra = (f: FichaResumen) => `${f.nombre} (${f.veredicto?.porque ?? ""})`;
  const peligros = fichas.filter((f) => f.veredicto?.tipo === "peligro").map(conCifra);
  const explotables = fichas.filter((f) => f.veredicto?.tipo === "explotable").map(conCifra);
  const fuera = fichas.filter((f) => f.fuera);
  const activa = fichas.find((f) => f.clave === elegida) ?? null;

  return (
    <section
      aria-label={`El once probable de ${equipo} de un vistazo`}
      className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
    >
      <header className="border-b border-white/10 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">El once de un vistazo</h2>
        <p className="mt-0.5 text-[12px] text-white/55">{dibujo} · pincha una ficha para ver el porqué</p>
      </header>

      {/* El minicampo: el ataque arriba, como el campograma de pie. */}
      <div className="px-3 pt-3">
        <ol className="flex min-w-0 flex-col gap-1 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-1 py-2">
          {[...conGente].reverse().map((linea) => (
            <li key={linea.clave} className="flex min-w-0 items-start justify-around" aria-label={`${linea.titulo}: ${linea.fichas.map((f) => f.nombre).join(", ")}`}>
              {linea.fichas.map((ficha) => (
                <Ficha key={ficha.clave} ficha={ficha} rotulo={rotulos.get(ficha.clave) ?? ficha.nombre} activa={ficha.clave === elegida} onClick={() => setElegida((cual) => (cual === ficha.clave ? null : ficha.clave))} />
              ))}
            </li>
          ))}
        </ol>

        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/55">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-red-400 align-[-1px]" aria-hidden />
            peligro
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-emerald-400 align-[-1px]" aria-hidden />
            explotable
          </span>
          {fuera.length > 0 && (
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-white/50 align-[-1px]" aria-hidden />
              fuera de su sitio
            </span>
          )}
        </p>
        {/* El criterio, en la leyenda (18/11/2026, ronda 23). */}
        <p className="mt-0.5 text-[11px] leading-snug text-white/50">{capital(LEYENDA_JERARQUIA)}.</p>
      </div>

      <div className="space-y-1.5 px-4 pb-3 pt-2 text-[12px] leading-snug text-white/75">
        {activa ? (
          <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
            <p className="font-semibold text-white">
              {activa.dorsal && <span className="mr-1 tabular-nums text-[#C8A96B]">{activa.dorsal}</span>}
              {activa.nombre}
              <span className="font-normal text-white/55">
                {" "}
                · {activa.puesto || activa.hueco}
                {activa.fuera ? ", fuera de su sitio" : ""}
              </span>
            </p>
            {activa.veredicto && (
              <p className="mt-1">
                <span className={`font-semibold ${activa.veredicto.tipo === "peligro" ? "text-red-300" : "text-emerald-300"}`}>
                  {activa.veredicto.tipo === "peligro" ? "▲ Peligro: " : "▼ Explotable: "}
                </span>
                {activa.veredicto.porque}
                {activa.veredicto.base && <span className="text-white/50"> · {activa.veredicto.base}</span>}
              </p>
            )}
            <button type="button" onClick={() => abrir(activa.clave)} className="mt-1 font-semibold text-[#C8A96B] underline-offset-2 hover:underline">
              Su ficha ›
            </button>
          </div>
        ) : (
          <>
            {peligros.length > 0 && (
              <p>
                <span className="font-semibold text-red-300">▲ Peligro: </span>
                {lista(peligros)}.
              </p>
            )}
            {explotables.length > 0 && (
              <p>
                <span className="font-semibold text-emerald-300">▼ Explotable: </span>
                {lista(explotables)}.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default ResumenDelOnce;
