"use client";

/*
|--------------------------------------------------------------------------
| EL ONCE DE UN VISTAZO (17/11/2026, jueces de fútbol)
|--------------------------------------------------------------------------
|
| «Encima de la lista de jugadores, en móvil y en escritorio: un resumen
| visual con el once y su conclusión (el más peligroso y el explotable de
| cada línea) antes de los 25 jugadores en lista.»
|
| Línea a línea —portería, defensa, medio, ataque— los titulares del once
| probable (en su hueco del dibujo) y dos lecturas con su cifra y su base:
|   ▲ el que más daño hace (lo mejor de Wyscout contra su puesto, sus goles
|     en BeSoccer o las etiquetas del analista);
|   ▼ por dónde se le gana (lo peor de Wyscout o las etiquetas de debilidad).
| Lo que no tiene dato no se nombra: una línea sin lectura enseña sólo a los
| titulares. La cuenta vive en la pantalla (`resumenDelOnce` de
| app/rivals/page.tsx); aquí sólo se pinta.
*/

export type FichaResumen = {
  clave: string;
  nombre: string;
  dorsal: string;
  /** El hueco en el dibujo («LD», «MCD»…). */
  hueco: string;
};

export type LecturaResumen = {
  clave: string;
  nombre: string;
  /** Qué hace o qué le cuesta, con la cifra: «Progresión: mejor que 9 de cada 10 de su puesto». */
  porque: string;
  /** De dónde sale: «8 partidos · Wyscout», «tendencia · 2 PJ · etiqueta del analista». */
  base: string;
};

export type LineaResumen = {
  clave: string;
  titulo: string;
  color: string;
  fichas: FichaResumen[];
  peligro: LecturaResumen | null;
  explotable: LecturaResumen | null;
};


function Lectura({ tipo, lectura, abrir }: { tipo: "peligro" | "explotable"; lectura: LecturaResumen; abrir: (clave: string) => void }) {
  /* Clases con su equivalente de modo día (globals.css): el color en línea salía a 1,9 de contraste sobre blanco. */
  const color = tipo === "peligro" ? "text-red-300" : "text-emerald-300";

  return (
    <p className="min-w-0 text-[12px] leading-snug text-white/75">
      <span className={`font-semibold ${color}`}>
        {tipo === "peligro" ? "▲ Peligro: " : "▼ Explotable: "}
      </span>
      <button type="button" onClick={() => abrir(lectura.clave)} className="font-semibold text-white underline-offset-2 hover:underline">
        {lectura.nombre}
      </button>
      {lectura.porque && <> — {lectura.porque}</>}
      {lectura.base && <span className="text-white/45"> · {lectura.base}</span>}
    </p>
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
  lineas: LineaResumen[];
  /** Abre la ficha de ese jugador (clave del once). */
  abrir: (clave: string) => void;
}) {
  const conGente = lineas.filter((linea) => linea.fichas.length > 0);

  if (conGente.length === 0) return null;

  return (
    <section
      aria-label={`El once probable de ${equipo} de un vistazo`}
      className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
    >
      <header className="border-b border-white/10 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">El once de un vistazo</h2>
        <p className="mt-0.5 text-[12px] text-white/55">
          {dibujo} · por línea, el que más daño hace y por dónde se le gana
        </p>
      </header>

      <ol className="divide-y divide-white/10">
        {conGente.map((linea) => (
          <li key={linea.clave} className="min-w-0 space-y-1.5 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: linea.color }} aria-hidden />
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">{linea.titulo}</span>
            </div>

            <ul className="flex min-w-0 flex-wrap gap-1">
              {linea.fichas.map((ficha) => (
                <li key={ficha.clave} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => abrir(ficha.clave)}
                    title={`${ficha.nombre}${ficha.hueco ? ` · ${ficha.hueco}` : ""}`}
                    className="flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-white/80 transition hover:border-[#C8A96B] hover:text-white"
                  >
                    {ficha.dorsal && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C8A96B] px-0.5 text-[10px] font-bold tabular-nums text-black">
                        {ficha.dorsal}
                      </span>
                    )}
                    <span className="truncate">{ficha.nombre}</span>
                  </button>
                </li>
              ))}
            </ul>

            {linea.peligro && <Lectura tipo="peligro" lectura={linea.peligro} abrir={abrir} />}
            {linea.explotable && <Lectura tipo="explotable" lectura={linea.explotable} abrir={abrir} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default ResumenDelOnce;
