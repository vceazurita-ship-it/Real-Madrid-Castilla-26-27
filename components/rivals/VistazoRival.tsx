"use client";

import Link from "next/link";

import { ArrowUpRight, Goal, LayoutGrid, Trophy, UserX } from "lucide-react";

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

      {/* Dos renglones antes que «El último: 2-0 en casa co…» en el móvil. */}
      {pie && <p className="mt-1 line-clamp-2 text-[11px] text-white/45">{pie}</p>}
    </div>
  );
}

/** «Destaca en dominio con balón y eficacia, pero se queda corto en producción de remate.» */
function fraseDeAspectos(aspectos: AspectoDestacado[]) {
  const lista = (nombres: string[]) =>
    nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;

  const fuertes = aspectos.filter((a) => a.desviacion >= 0).map((a) => a.aspecto.toLowerCase());
  const flojos = aspectos.filter((a) => a.desviacion < 0).map((a) => a.aspecto.toLowerCase());

  if (fuertes.length && flojos.length) return `Destaca en ${lista(fuertes)}, pero se queda corto en ${lista(flojos)}.`;
  if (fuertes.length) return `Destaca en ${lista(fuertes)}.`;
  if (flojos.length) return `Se queda corto en ${lista(flojos)}.`;

  return "";
}

export type AvisosRival = {
  fuera: { nombre: string; estado: string }[];
  apercibidos: { nombre: string; amarillas: number }[];
  rojas: { nombre: string; rojas: number }[];
};

export function VistazoRival({
  equipo,
  vistazo,
  jornada,
  aspectos = [],
  equipos = 0,
  avisos = null,
  enlaces,
}: {
  /** Bajas de la hoja, apercibidos y rojas de BeSoccer; `null` si no hay nada. */
  avisos?: AvisosRival | null;
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
      <div className={`grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 ${avisos ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
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

        {avisos && (
          <Casilla titulo="Bajas y apercibidos" ancha>
            <ul className="min-w-0 space-y-0.5 text-sm">
              {avisos.fuera.map((uno) => (
                <li key={`f-${uno.nombre}`} className="flex min-w-0 items-center gap-1.5">
                  <UserX size={12} className="shrink-0 text-[#F87171]" aria-hidden />
                  <span className="min-w-0 truncate">{uno.nombre}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-white/45">{uno.estado}</span>
                </li>
              ))}
              {avisos.apercibidos.map((uno) => (
                <li key={`a-${uno.nombre}`} className="flex min-w-0 items-center gap-1.5">
                  <span className="h-3 w-2 shrink-0 rounded-[2px] bg-[#FACC15]" aria-hidden />
                  <span className="min-w-0 truncate">{uno.nombre}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-white/45">a una amarilla ({uno.amarillas})</span>
                </li>
              ))}
              {avisos.rojas.map((uno) => (
                <li key={`r-${uno.nombre}`} className="flex min-w-0 items-center gap-1.5">
                  <span className="h-3 w-2 shrink-0 rounded-[2px] bg-[#EF4444]" aria-hidden />
                  <span className="min-w-0 truncate">{uno.nombre}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-white/45">
                    {uno.rojas === 1 ? "una roja esta temporada" : `${uno.rojas} rojas esta temporada`}
                  </span>
                </li>
              ))}
            </ul>
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

          {/* Primero la frase, luego los dos grupos: una lista de «p15 · p80» no se leía (guion, 21/10). */}
          {fraseDeAspectos(aspectos) && <p className="mb-2 text-sm text-white/75">{fraseDeAspectos(aspectos)}</p>}

          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {[
              { titulo: "Fuerte en", color: "#34D399", lista: aspectos.filter((a) => a.desviacion >= 0) },
              { titulo: "Flojo en", color: "#F87171", lista: aspectos.filter((a) => a.desviacion < 0) },
            ]
              .filter((grupo) => grupo.lista.length > 0)
              .map((grupo) => (
                <div key={grupo.titulo} className="min-w-0">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: chipInk(grupo.color) }}>
                    {grupo.titulo}
                  </p>
                  <ul className="flex min-w-0 flex-wrap gap-1.5">
                    {grupo.lista.map((a) => (
                      <li
                        key={a.aspecto}
                        title={`${a.explica}. ${a.filas.map((f) => `${f.nombre}: p${f.percentil}`).join(" · ")}`}
                        className="flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                        style={{ borderColor: `${grupo.color}55`, background: `${grupo.color}14` }}
                      >
                        <span className="min-w-0 truncate">{a.aspecto}</span>
                        <span className="shrink-0 tabular-nums text-white/50">
                          {a.desviacion >= 0 ? `mejor que ${Math.round(a.percentil / 10)} de cada 10` : `peor que ${10 - Math.round(a.percentil / 10)} de cada 10`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
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
