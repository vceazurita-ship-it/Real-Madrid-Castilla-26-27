"use client";

/*
|--------------------------------------------------------------------------
| LA RADIOGRAFÍA DEL ONCE PROBABLE (17/11/2026, ronda 21, jueces de análisis)
|--------------------------------------------------------------------------
|
| Scout individual abría con listas (la del canal, el selector repetido) y sin
| un resumen por jugador. Arriba va ahora la conclusión: el titular («6 clips
| de 6 titulares probables») y, por cada titular del once probable —el mismo
| que Plantillas rivales y Duelos: el marcado, o su último once de BeSoccer—,
| su mejor y su peor cifra de Wyscout contra los de su puesto en una pista de
| percentil (la raya, la mediana), cuántos clips suyos hay en el canal y en
| Hudl, y contra quién se le compara si no es su puesto de la hoja. Pinchar
| el nombre baja a su tarjeta.
*/

import { useMemo } from "react";

import { useCuentaHudl } from "@/components/rivals/ClipsDeHudl";
import { LINEAS, anclaDe, rangoDePuesto } from "@/components/rivals/VideosDelCanal";
import { MEJOR, PEOR } from "@/components/data/graficas";
import { esEtiquetaDebil, type JugadorPlantilla, type RasgoCorto } from "@/lib/rivals/youtube-listas";

const CORTO = ["POR", "DEF", "MED", "DEL", ""] as const;

const capital = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const lista = (nombres: string[]) => nombres.join(", ").replace(/, ([^,]*)$/, " y $1");

/** La pista de percentil: 0 a la izquierda, 100 a la derecha, la mediana en medio. */
function Pista({ fuerte, flojo }: { fuerte?: RasgoCorto; flojo?: RasgoCorto }) {
  return (
    <span className="relative my-1.5 block h-2 w-full rounded-full bg-white/10" aria-hidden>
      <span className="absolute -top-1 bottom-[-4px] left-1/2 w-px bg-white/45" />
      {flojo && (
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_rgb(0_0_0_/_0.35)]"
          style={{ left: `${Math.max(2, Math.min(98, flojo.percentil))}%`, background: PEOR }}
        />
      )}
      {fuerte && (
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_rgb(0_0_0_/_0.35)]"
          style={{ left: `${Math.max(2, Math.min(98, fuerte.percentil))}%`, background: MEJOR }}
        />
      )}
    </span>
  );
}

export function RadiografiaDelOnce({
  equipo,
  titulares,
  plantilla,
  cortes,
  fuente,
  className = "",
}: {
  equipo: string;
  titulares: JugadorPlantilla[];
  plantilla: JugadorPlantilla[];
  /** Cortes del canal por jugador (nombre de pantalla); `null` mientras no se sabe. */
  cortes: Record<string, number> | null;
  /** De dónde sale el once: «Once probable marcado en Plantillas rivales». */
  fuente: string;
  className?: string;
}) {
  const paraHudl = useMemo(() => plantilla.map((j) => ({ nombres: [j.nombre, j.hoja], dorsal: j.dorsal })), [plantilla]);
  const buscados = useMemo(() => titulares.map((j) => ({ clave: j.hoja ?? j.nombre, nombres: [j.nombre, j.hoja], dorsal: j.dorsal })), [titulares]);
  const hudl = useCuentaHudl(equipo, buscados, paraHudl);

  const ordenados = useMemo(
    () => [...titulares].sort((a, b) => rangoDePuesto(a.puesto ?? "") - rangoDePuesto(b.puesto ?? "") || (b.minutos ?? 0) - (a.minutos ?? 0)),
    [titulares],
  );

  if (!ordenados.length) return null;

  /* El titular de la pantalla (marketing): «6 clips de 6 titulares probables», sin dos cifras que suenen a lo mismo. */
  const conCorte = ordenados.filter((j) => (cortes?.[j.nombre] ?? 0) > 0);
  const clipsDelOnce = conCorte.reduce((s, j) => s + (cortes?.[j.nombre] ?? 0), 0);
  const deOtros = cortes ? Object.values(cortes).reduce((s, n) => s + n, 0) - clipsDelOnce : 0;
  const soloHudl = ordenados.filter((j) => !(cortes?.[j.nombre] ?? 0) && (hudl[j.hoja ?? j.nombre] ?? 0) > 0).length;
  const explotables = ordenados.filter((j) => (j.etiquetas ?? []).some(esEtiquetaDebil) || (j.rasgos ?? []).some((r) => r.signo === "▼" && r.percentil <= 30)).map((j) => j.nombre);

  const titular =
    cortes && conCorte.length > 0
      ? `${clipsDelOnce} ${clipsDelOnce === 1 ? "clip" : "clips"} de ${conCorte.length} ${conCorte.length === 1 ? "titular probable" : "titulares probables"}`
      : `Su once probable: ${ordenados.length} titulares`;
  const detalle = [
    cortes && deOtros > 0 ? `${deOtros} más de otros jugadores` : "",
    soloHudl > 0 ? `${soloHudl === ordenados.length - conCorte.length && conCorte.length > 0 ? "los otros " : ""}${soloHudl} con sus clips de Hudl` : "",
  ].filter(Boolean);

  return (
    <section className={`min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 ${className}`} aria-label={`Radiografía del once probable de ${equipo}`}>
      <h2 className="text-lg font-semibold text-white sm:text-xl">
        {titular}
        {detalle.length > 0 && <span className="font-normal text-white/70">; {detalle.join(" y ")}</span>}
        {explotables.length > 0 && (
          <span className="font-normal text-white/70">
            . Algo que explotar en {lista(explotables.slice(0, 3))}
            {explotables.length > 3 ? ` y ${explotables.length - 3} más` : ""}
          </span>
        )}
        .
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-white/55">
        {fuente}. En cada fila, <span style={{ color: MEJOR }}>● su mejor cifra</span> y <span style={{ color: PEOR }}>● la peor</span> contra los de su puesto en la categoría (Wyscout, esta temporada): a la derecha, mejor; la raya es la mediana.
      </p>

      <ol className="mt-3 grid min-w-0 grid-cols-1 gap-x-6 lg:grid-cols-2">
        {ordenados.map((j) => {
          const fuerte = j.rasgos?.find((r) => r.signo === "▲");
          const flojo = j.rasgos?.find((r) => r.signo === "▼");
          const canal = cortes?.[j.nombre] ?? 0;
          const deHudl = hudl[j.hoja ?? j.nombre] ?? 0;
          const rango = rangoDePuesto(j.puesto ?? "");

          return (
            <li key={j.hoja ?? j.nombre} className="min-w-0 border-t border-white/[0.06] py-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="w-8 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/40" title={LINEAS[rango]}>
                  {CORTO[rango]}
                </span>
                {j.dorsal && <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#C8A96B]">{j.dorsal}</span>}
                <a
                  href={`#${anclaDe(j.nombre)}`}
                  onClick={(e) => {
                    const destino = document.getElementById(anclaDe(j.nombre));

                    if (!destino) return;
                    e.preventDefault();
                    destino.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="min-w-0 truncate text-sm font-semibold text-white hover:text-[#C8A96B] hover:underline"
                >
                  {j.nombre}
                </a>
                <span className="ml-auto flex shrink-0 gap-1.5 text-[11px] tabular-nums text-white/60">
                  {canal > 0 && <span title="Cortes suyos en la lista del canal">▶ {canal}</span>}
                  {deHudl > 0 && <span title="Clips suyos de Hudl para ver o bajar">⬇ {deHudl} Hudl</span>}
                </span>
              </div>
              <p className="ml-10 text-[12px] leading-snug text-white/55">{capital([j.poblacion ? j.puesto : j.rol || j.puesto, j.poblacion].filter(Boolean).join(" · "))}</p>
              {(fuerte || flojo) && (
                <div className="ml-10 min-w-0">
                  <Pista fuerte={fuerte} flojo={flojo} />
                  <p className="text-[12px] leading-snug tabular-nums">
                    {fuerte && (
                      <span style={{ color: MEJOR }}>
                        ▲ {fuerte.corta} <b>{fuerte.marca}</b>
                      </span>
                    )}
                    {fuerte && flojo && <span className="text-white/35"> · </span>}
                    {flojo && (
                      <span style={{ color: PEOR }}>
                        ▼ {flojo.corta} <b>{flojo.marca}</b>
                      </span>
                    )}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
