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
import type { JugadorPlantilla, RasgoCorto } from "@/lib/rivals/youtube-listas";
import { LEYENDA_JERARQUIA, MINUTOS_TENDENCIA, jerarquiaDelOnce } from "@/lib/rivals/metricas-del-puesto";
import { dibujoDeCampo } from "@/lib/rivals/campograma-motor";
import { dibujoDeLasClaves, lineasDelDibujo, puestoDelBloque } from "@/lib/rivals/colocacion-once";

const CORTO = ["POR", "DEF", "MED", "DEL", ""] as const;

const capital = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Frases con comas dentro: «A (…); B (…) y C (…)». */
const lista = (frases: string[]) => (frases.length < 2 ? frases.join("") : `${frases.slice(0, -1).join("; ")} y ${frases[frases.length - 1]}`);

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
  colocacion,
  className = "",
}: {
  equipo: string;
  titulares: JugadorPlantilla[];
  plantilla: JugadorPlantilla[];
  /** Cortes del canal por jugador (nombre de pantalla); `null` mientras no se sabe. */
  cortes: Record<string, number> | null;
  /** De dónde sale el once: «Once probable marcado en Plantillas rivales». */
  fuente: string;
  /**
   * Dónde cae cada titular en su once (clave → bloque): la misma cuenta del
   * campograma de /rivals (`colocacionDelCampograma` con los titulares). Con
   * ella las filas van por las líneas del dibujo —en un 4-2-3-1, 4 + 2 + 3 + 1—
   * y cada uno con el hueco de su once (18/11/2026, jueces).
   */
  colocacion?: Map<string, string>;
  className?: string;
}) {
  const paraHudl = useMemo(() => plantilla.map((j) => ({ nombres: [j.nombre, j.hoja], dorsal: j.dorsal })), [plantilla]);
  const buscados = useMemo(() => titulares.map((j) => ({ clave: j.hoja ?? j.nombre, nombres: [j.nombre, j.hoja], dorsal: j.dorsal })), [titulares]);
  const hudl = useCuentaHudl(equipo, buscados, paraHudl);

  /*
  | Las líneas del dibujo y el hueco de cada uno: las mismas del campograma y
  | de «El once de un vistazo». Sin colocación, por el puesto de la hoja.
  */
  const grupos = useMemo(() => {
    const porMinutos = (a: JugadorPlantilla, b: JugadorPlantilla) => (b.minutos ?? 0) - (a.minutos ?? 0);
    const claves = titulares.map((j) => (j.clave ? colocacion?.get(j.clave) : undefined)).filter((k): k is string => Boolean(k));

    if (!colocacion || claves.length === 0) {
      return LINEAS.map((titulo, rango) => ({
        titulo,
        jugadores: titulares.filter((j) => rangoDePuesto(j.puesto ?? "") === rango).sort(porMinutos).map((j) => ({ j, codigo: CORTO[rango], hueco: "" })),
      })).filter((g) => g.jugadores.length > 0);
    }

    const dibujo = dibujoDeLasClaves(claves);
    const bloques = dibujoDeCampo(dibujo);
    const lineas = lineasDelDibujo(dibujo);
    const bloqueDe = (j: JugadorPlantilla) => bloques.find((b) => b.key === (j.clave ? colocacion.get(j.clave) : undefined));
    const sueltos = titulares.filter((j) => !bloqueDe(j));

    return [
      ...lineas.map((linea) => ({
        titulo: linea.titulo,
        jugadores: titulares
          .filter((j) => linea.bloques.includes(bloqueDe(j)?.key ?? ""))
          .sort((a, b) => (bloqueDe(a)?.anchorX ?? 0.5) - (bloqueDe(b)?.anchorX ?? 0.5))
          .map((j) => ({ j, codigo: bloqueDe(j)?.code ?? "", hueco: puestoDelBloque(bloqueDe(j)) })),
      })),
      { titulo: "Otros", jugadores: sueltos.map((j) => ({ j, codigo: CORTO[rangoDePuesto(j.puesto ?? "")], hueco: "" })) },
    ].filter((g) => g.jugadores.length > 0);
  }, [titulares, colocacion]);

  const ordenados = useMemo(() => grupos.flatMap((g) => g.jugadores.map((x) => x.j)), [grupos]);

  if (!ordenados.length) return null;

  /* El titular de la pantalla (marketing): «6 clips de 6 titulares probables», sin dos cifras que suenen a lo mismo. */
  const conCorte = ordenados.filter((j) => (cortes?.[j.nombre] ?? 0) > 0);
  const clipsDelOnce = conCorte.reduce((s, j) => s + (cortes?.[j.nombre] ?? 0), 0);
  const deOtros = cortes ? Object.values(cortes).reduce((s, n) => s + n, 0) - clipsDelOnce : 0;
  const soloHudl = ordenados.filter((j) => !(cortes?.[j.nombre] ?? 0) && (hudl[j.hoja ?? j.nombre] ?? 0) > 0).length;
  /*
  | PELIGRO Y EXPLOTABLE CON JERARQUÍA (18/11/2026, ronda 23, fútbol y
  | guionista): «Algo que explotar en … y 7 más» nombraba a 10 de 11. Ahora,
  | como mucho 3 de cada lado, los más extremos frente a su puesto en una
  | métrica clave (`jerarquiaDelOnce`, la misma cuenta que /rivals), y con su
  | cifra: «Explotables: Palmberg por alto (duelos aéreos ganados 27,8 %, peor
  | que 9 de cada 10)». Un jugador, un veredicto.
  */
  const veredictos = jerarquiaDelOnce(
    ordenados.map((j) => ({
      id: j.hoja ?? j.nombre,
      fuerte: j.rasgos?.find((r) => r.signo === "▲"),
      flojo: j.rasgos?.find((r) => r.signo === "▼"),
    })),
  );
  const nombrados = (tipo: "peligro" | "explotable") =>
    ordenados
      .filter((j) => veredictos.get(j.hoja ?? j.nombre) === tipo)
      .map((j) => ({ j, r: j.rasgos?.find((x) => x.signo === (tipo === "peligro" ? "▲" : "▼")) }))
      .filter((x): x is { j: JugadorPlantilla; r: RasgoCorto } => Boolean(x.r))
      .sort((a, b) => (tipo === "peligro" ? b.r.percentil - a.r.percentil : a.r.percentil - b.r.percentil));
  const frase = ({ j, r }: { j: JugadorPlantilla; r: RasgoCorto }) =>
    `${j.nombre}${r.enQue ? ` ${r.enQue}` : ""} (${r.nombre ?? r.corta} ${r.cifra ?? ""}${r.marca.replace(/^·/, ",")}${j.minutosWyscout ? `, ${j.minutosWyscout.toLocaleString("es-ES")}′` : ""}${(j.minutosWyscout ?? MINUTOS_TENDENCIA) < MINUTOS_TENDENCIA ? ", tendencia" : ""})`.replace(/\s+,/g, ",");
  const peligros = nombrados("peligro");
  const explotables = nombrados("explotable");

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
        .
      </h2>
      {(peligros.length > 0 || explotables.length > 0) && (
        <div className="mt-1.5 space-y-0.5 text-[15px] leading-snug text-white/85">
          {peligros.length > 0 && (
            <p>
              <b style={{ color: MEJOR }}>▲ {peligros.length === 1 ? "Peligro" : "Peligros"}:</b> {lista(peligros.map(frase))}.
            </p>
          )}
          {explotables.length > 0 && (
            <p>
              <b style={{ color: PEOR }}>▼ {explotables.length === 1 ? "Explotable" : "Explotables"}:</b> {lista(explotables.map(frase))}.
            </p>
          )}
        </div>
      )}
      <p className="mt-1 text-[12px] leading-relaxed text-white/55">
        {fuente}. En cada fila, <span style={{ color: MEJOR }}>● su mejor cifra</span> y <span style={{ color: PEOR }}>● la peor</span> entre las métricas clave de su puesto, contra los de su puesto en la categoría (Wyscout, esta temporada): a la derecha, mejor; la raya es la mediana. Peligro y explotable: {LEYENDA_JERARQUIA}.
      </p>

      {/* Por líneas del dibujo (18/11/2026): las mismas filas del campograma de /rivals. */}
      <ol className="mt-3 min-w-0 space-y-2">
        {grupos.map((grupo) => (
          <li key={grupo.titulo} className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">
              {grupo.titulo} · {grupo.jugadores.length}
            </p>
            <ol className="grid min-w-0 grid-cols-1 gap-x-6 lg:grid-cols-2">
        {grupo.jugadores.map(({ j, codigo, hueco }) => {
          const fuerte = j.rasgos?.find((r) => r.signo === "▲");
          const flojo = j.rasgos?.find((r) => r.signo === "▼");
          const canal = cortes?.[j.nombre] ?? 0;
          const deHudl = hudl[j.hoja ?? j.nombre] ?? 0;
          /* El puesto de su once (Palmberg, pivote), el mismo de /rivals; con el de origen si es otro. */
          const puesto = j.rol || hueco || j.puesto;
          const veredicto = veredictos.get(j.hoja ?? j.nombre);

          return (
            <li key={j.hoja ?? j.nombre} className="min-w-0 border-t border-white/[0.06] py-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="w-8 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/40" title={hueco || grupo.titulo}>
                  {codigo}
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
              {/* Una sola frase (18/11/2026, ronda 23): «Pivote en su once; se le compara con 123 medios · 683′ en Wyscout». */}
              <p className="ml-10 text-[12px] leading-snug text-white/55">
                {veredicto && (
                  <b className="mr-1.5 font-semibold" style={{ color: veredicto === "peligro" ? MEJOR : PEOR }}>
                    {veredicto === "peligro" ? "▲ Peligro" : "▼ Explotable"}
                  </b>
                )}
                {capital([puesto, j.poblacion].filter(Boolean).join("; "))}
                {!j.poblacion && (j.minutosWyscout ?? MINUTOS_TENDENCIA) < MINUTOS_TENDENCIA ? ` · ${j.minutosWyscout}′ en Wyscout · tendencia` : ""}
              </p>
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
          </li>
        ))}
      </ol>
    </section>
  );
}
