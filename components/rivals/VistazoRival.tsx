"use client";

import Link from "next/link";

import { ArrowUpRight, Goal, LayoutGrid, Trophy } from "lucide-react";

import { chipInk } from "@/lib/theme";
import type { AspectoDestacado } from "@/lib/rivals/destacados-rival";
import type { JornadaDeEquipo } from "@/lib/rivals/orden-calendario";
import { balanceDe, fraseDelVistazo, type ResultadoForma, type Vistazo } from "@/lib/rivals/vistazo";

/*
|--------------------------------------------------------------------------
| CÓMO LLEGA EL RIVAL (21/10/2026)
|--------------------------------------------------------------------------
|
| Una franja encima de la plantilla con lo que se pregunta antes que nada:
| dónde está en la tabla, cómo le va en el campo del partido, sus últimos
| resultados, el dibujo que saca y quién le hace los goles. Todo es BeSoccer
| (`rivals:informe`) y la pantalla ya lo tiene cargado.
|
| Lo que falta no se pinta: ni casilla vacía ni «sin dato». Si no hay nada, la
| franja no sale.
*/

/* Los colores del resultado, los mismos verde/rojo del resto de la ficha. */
const COLOR_RESULTADO: Record<ResultadoForma["resultado"], string> = {
  G: "#34D399",
  E: "#C8A96B",
  P: "#F87171",
};

const PALABRA: Record<ResultadoForma["resultado"], string> = {
  G: "Ganó",
  E: "Empató",
  P: "Perdió",
};

function Casilla({
  titulo,
  children,
  pie,
  ancha = false,
}: {
  titulo: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
  /** En el móvil ocupa las dos columnas (la lista de goleadores). */
  ancha?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 ${ancha ? "col-span-2 md:col-span-1" : ""}`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {titulo}
      </p>

      <div className="mt-1 min-w-0">{children}</div>

      {pie && <p className="mt-1 truncate text-[11px] text-white/45">{pie}</p>}
    </div>
  );
}

export function VistazoRival({
  equipo,
  vistazo,
  jornada,
  aspectos = [],
  equipos = 0,
  enlaces,
}: {
  equipo: string;
  vistazo: Vistazo | null;
  jornada: JornadaDeEquipo | null;
  /** Lo que le hace distinto en Wyscout, contra la categoría. */
  aspectos?: AspectoDestacado[];
  /** De cuántos equipos es la categoría con la que se compara. */
  equipos?: number;
  /** A otras pantallas de este mismo rival. */
  enlaces: { href: string; label: string }[];
}) {
  if (!vistazo && aspectos.length === 0) return null;

  const { tabla = null, enEseCampo = null, forma = [], dibujo = null, goleadores = [] } = vistazo ?? {};

  return (
    <section
      aria-label={`Cómo llega ${equipo}`}
      className="mt-6 min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4"
    >
      <header className="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
          Cómo llega {equipo}
        </h2>

        {jornada && !jornada.jugado && (
          /* «fuera» a secas no decía de quién: es dónde jugamos nosotros. */
          <p className="shrink-0 text-[11px] text-white/45">
            {jornada.titulo.replace(/ · (fuera|en casa)$/, " · jugamos $1")}
          </p>
        )}
      </header>

      {/* Primero la lectura, luego las cifras que la sostienen. */}
      {fraseDelVistazo(vistazo) && (
        <p className="mb-3 text-sm text-white/80 sm:text-[15px]">{fraseDelVistazo(vistazo)}</p>
      )}

      {vistazo && (
      <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {tabla && (
          <Casilla
            titulo="Clasificación"
            pie={`${balanceDe(tabla)} · ${tabla.favor}-${tabla.contra} en goles`}
          >
            <p className="flex items-baseline gap-1.5">
              <Trophy size={13} className="shrink-0 self-center text-[#C8A96B]" aria-hidden />
              <span className="text-lg font-semibold tabular-nums">{tabla.puesto}.º</span>
              <span className="text-xs text-white/45">
                de {tabla.equipos} · {tabla.puntos} pts
              </span>
            </p>
          </Casilla>
        )}

        {enEseCampo && (
          <Casilla
            titulo={enEseCampo.donde === "fuera" ? "Lejos de casa" : "En su campo"}
            pie={`${enEseCampo.fila.favor}-${enEseCampo.fila.contra} en goles · ${enEseCampo.fila.jugados} ${enEseCampo.fila.jugados === 1 ? "partido" : "partidos"}`}
          >
            <p className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold tabular-nums">{balanceDe(enEseCampo.fila)}</span>
              <span className="text-xs text-white/45">{enEseCampo.fila.puntos} pts</span>
            </p>
          </Casilla>
        )}

        {forma.length > 0 && (
          <Casilla
            titulo={`Últimos ${forma.length}`}
            pie={`El último: ${forma[0].marcador} ${forma[0].enCasa ? "en casa" : "fuera"} con ${forma[0].rival}`}
          >
            {/* Del más antiguo al más reciente, de izquierda a derecha: así
                se lee la racha, como en cualquier tabla de forma. */}
            <ol className="flex items-center gap-1">
              {[...forma].reverse().map((r, i) => (
                <li
                  key={`${r.fecha}-${i}`}
                  title={`${r.fecha} · ${PALABRA[r.resultado]} ${r.marcador} ${r.enCasa ? "en casa" : "fuera"} contra ${r.rival}`}
                  aria-label={`${PALABRA[r.resultado]} ${r.marcador} contra ${r.rival}`}
                  className="flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-bold"
                  style={{
                    background: `${COLOR_RESULTADO[r.resultado]}26`,
                    color: chipInk(COLOR_RESULTADO[r.resultado]),
                  }}
                >
                  {r.resultado === "G" ? "V" : r.resultado === "E" ? "E" : "D"}
                </li>
              ))}
            </ol>
          </Casilla>
        )}

        {dibujo && (
          <Casilla
            titulo="Dibujo que más repite"
            pie={`${dibujo.veces} de sus últimas ${dibujo.de} alineaciones`}
          >
            <p className="flex items-center gap-1.5">
              <LayoutGrid size={13} className="shrink-0 text-[#C8A96B]" aria-hidden />
              <span className="text-lg font-semibold tabular-nums">{dibujo.estructura}</span>
            </p>
          </Casilla>
        )}

        {goleadores.length > 0 && (
          <Casilla titulo="Le hacen los goles" ancha>
            <ul className="min-w-0 space-y-0.5">
              {goleadores.map((g) => (
                <li key={g.nombre} className="flex min-w-0 items-center gap-1.5 text-sm">
                  <Goal size={12} className="shrink-0 text-white/40" aria-hidden />
                  <span className="min-w-0 truncate">{g.nombre}</span>
                  <span className="ml-auto shrink-0 font-semibold tabular-nums">{g.goles}</span>
                </li>
              ))}
            </ul>
          </Casilla>
        )}
      </div>

      )}

      {aspectos.length > 0 && (
        <div className="mt-3 min-w-0">
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Lo que le hace distinto · Wyscout, contra {equipos > 0 ? `los ${equipos} de` : ""} la categoría
          </p>

          <ul className="flex min-w-0 flex-wrap gap-2">
            {aspectos.map((a) => {
              /* Verde si se sale por arriba, rojo si va por detrás: lo mismo
                 que las etiquetas de los jugadores. */
              const color = a.desviacion >= 0 ? "#34D399" : "#F87171";

              return (
                <li
                  key={a.aspecto}
                  title={`${a.explica}. ${a.filas.map((f) => `${f.nombre}: p${f.percentil}`).join(" · ")}`}
                  className="flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                  style={{ borderColor: `${color}55`, background: `${color}14` }}
                >
                  <span className="min-w-0 truncate">{a.aspecto}</span>
                  <span className="shrink-0 font-semibold tabular-nums" style={{ color: chipInk(color) }}>
                    p{a.percentil}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {enlaces.length > 0 && (
        <nav aria-label="Más de este rival" className="mt-3 flex min-w-0 flex-wrap gap-2">
          {enlaces.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:border-[#C8A96B] hover:text-white"
            >
              {e.label}
              <ArrowUpRight size={12} aria-hidden />
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}

export default VistazoRival;
