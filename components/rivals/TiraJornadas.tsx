"use client";

/**
 * Sus partidos de liga, uno por casilla, y la conclusión encima (29/10/2026;
 * revisado el 16/11/2026).
 *
 * Sale del informe de BeSoccer (`rivals:informe`), el mismo que alimenta la
 * franja «cómo llega» de Plantillas. Sólo se pintan los partidos de su liga
 * con resultado (`deSuLiga`: sin copa ni torneos de verano): lo que no se ha
 * jugado, o no tiene marcador, no se nombra y la tira no deja huecos.
 *
 * Ronda 16 de los jueces:
 * - Una sola convención de jornada: la de la cabecera es la NUESTRA («Nuestra
 *   J13»); aquí cada partido va con su fecha, sin «Su J1…».
 * - La tira se cortaba a la derecha: ahora es una rejilla que pasa a la
 *   siguiente fila.
 * - Encima, tres líneas con la base y la referencia de la liga: V/E/D y puntos
 *   por partido frente a la mediana de los equipos, goles a favor y en contra
 *   por partido frente a la mediana, y qué hacemos.
 */

import { useMemo } from "react";
import { House, Plane } from "lucide-react";
import { useRivalInforme } from "@/hooks/useRivalInforme";
import { deSuLiga, filaPropia, findInforme, jugados } from "@/lib/rivals/informe";
import { medianaLiga } from "@/lib/rivals/puesto-liga";
import { chipInk } from "@/lib/theme";
import { nombreCorto } from "@/lib/abp/informe-graficos";

const COLOR = { G: "#34D399", E: "#C8A96B", P: "#F87171" } as const;
const LETRA = { G: "V", E: "E", P: "D" } as const;
const PALABRA = { G: "Ganó", E: "Empató", P: "Perdió" } as const;

const coma = (n: number, d = 2) => n.toFixed(d).replace(".", ",");

/** «2026-09-12T18:00:00+02:00» → «12/09». */
function diaMes(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");

  return m ? `${m[3]}/${m[2]}` : "";
}

/** Más o menos que la mediana, con un margen para no llamar «más» a una décima. */
function frente(valor: number, mediana: number, margen: number) {
  if (valor > mediana + margen) return "más";
  if (valor < mediana - margen) return "menos";

  return "igual";
}

export function TiraJornadas({ equipo }: { equipo: string }) {
  const { doc } = useRivalInforme({ alEntrar: true });

  const datos = useMemo(() => {
    const informe = findInforme(doc, equipo);

    if (!informe) return null;

    const partidos = deSuLiga(jugados(informe))
      .slice()
      .reverse()
      .map((partido) => {
        const suyo = partido.enCasa ? partido.local : partido.visitante;
        const otro = partido.enCasa ? partido.visitante : partido.local;

        if (!partido.resultado || suyo.goles === null || otro.goles === null) return null;

        return {
          id: partido.id || partido.fecha,
          fecha: diaMes(partido.fecha),
          resultado: partido.resultado,
          marcador: `${suyo.goles}-${otro.goles}`,
          favor: Number(suyo.goles),
          contra: Number(otro.goles),
          rival: otro.nombre,
          enCasa: partido.enCasa,
        };
      })
      .filter((j): j is NonNullable<typeof j> => j !== null);

    /* La referencia de la liga: la clasificación de BeSoccer, equipo a equipo. */
    const total = informe.clasificacion?.total ?? [];
    const conPartidos = total.filter((f) => f.jugados > 0);
    const propia = total.length ? filaPropia(total, informe) : null;
    const liga =
      conPartidos.length >= 4
        ? {
            equipos: conPartidos.length,
            ppp: medianaLiga(conPartidos.map((f) => f.puntos / f.jugados)),
            favor: medianaLiga(conPartidos.map((f) => f.favor / f.jugados)),
            contra: medianaLiga(conPartidos.map((f) => f.contra / f.jugados)),
          }
        : null;

    return { partidos, liga, propia };
  }, [doc, equipo]);

  if (!datos || !datos.partidos.length) return null;

  const { partidos, liga } = datos;
  const n = partidos.length;
  const v = partidos.filter((j) => j.resultado === "G").length;
  const e = partidos.filter((j) => j.resultado === "E").length;
  const d = partidos.filter((j) => j.resultado === "P").length;
  const ppp = (3 * v + e) / n;
  const favor = partidos.reduce((s, j) => s + j.favor, 0) / n;
  const contra = partidos.reduce((s, j) => s + j.contra, 0) / n;

  /* Qué hacemos, con lo que dicen los goles frente a la liga (0,15 por partido de margen). */
  const marca = liga ? frente(favor, liga.favor, 0.15) : "igual";
  const encaja = liga ? frente(contra, liga.contra, 0.15) : "igual";
  const queHacemos =
    encaja === "más"
      ? "concede más que la media: ir a por él desde el principio y llegar con gente al área."
      : marca === "más"
        ? "marca más que la media: cerrar primero su vía de gol y no partirse."
        : encaja === "menos" && marca !== "más"
          ? "concede poco y marca poco: partido cerrado, paciencia con balón y el balón parado como palanca."
          : "está en la media de la liga en goles: lo deciden los detalles (balón parado y transiciones).";

  return (
    <div className="mb-6 min-w-0">
      {/* La conclusión, en tres líneas y con su base (16/11/2026, jueces de análisis). */}
      <div className="mb-3 min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] leading-snug text-white/80">
        <p>
          <b className="text-white">
            {v}V {e}E {d}D en {n} {n === 1 ? "partido" : "partidos"} de liga
          </b>
          : {coma(ppp)} puntos por partido{liga ? ` (mediana de los ${liga.equipos}: ${coma(liga.ppp)})` : ""}.
        </p>
        <p>
          Marca {coma(favor)} y encaja {coma(contra)} por partido
          {liga ? ` (mediana por equipo: ${coma(liga.favor)} a favor y ${coma(liga.contra)} en contra; en contra, menos es mejor)` : ""}.
        </p>
        <p>
          <b className="text-white">Qué hacemos:</b> {queHacemos.charAt(0).toUpperCase() + queHacemos.slice(1)}
          {n < 8 ? " Con menos de 8 partidos es tendencia." : ""}
        </p>
        <p className="mt-0.5 text-[12px] text-white/55">BeSoccer, sólo su liga (sin copa ni torneos).</p>
      </div>

      <p className="mb-1.5 text-[13px] font-semibold text-white/75">
        Partido a partido
        <span className="font-normal text-white/60"> · del más antiguo al más reciente, con su fecha</span>
      </p>
      {/* Rejilla que pasa de fila (16/11/2026): en una tira con scroll la última se cortaba («Alcorcó»). */}
      <ol
        aria-label={`Resultados de ${equipo} partido a partido`}
        className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-1.5"
      >
        {partidos.map((j) => (
          <li
            key={j.id}
            title={`${j.fecha} · ${PALABRA[j.resultado]} ${j.marcador} ${j.enCasa ? "en casa" : "fuera"} contra ${j.rival}`}
            aria-label={`${j.fecha}: ${PALABRA[j.resultado]} ${j.marcador} ${j.enCasa ? "en casa" : "fuera"} contra ${j.rival}`}
            /* Casa con borde continuo y una casita; fuera, borde discontinuo y un avión. */
            className="flex min-w-0 flex-col items-center rounded-lg border px-1.5 py-1 text-[12px] font-bold leading-tight"
            style={{
              background: `${COLOR[j.resultado]}26`,
              color: chipInk(COLOR[j.resultado]),
              borderColor: `${COLOR[j.resultado]}88`,
              borderStyle: j.enCasa ? "solid" : "dashed",
            }}
          >
            <span className="inline-flex items-center gap-1 text-xs font-medium opacity-80">
              {j.enCasa ? <House size={11} aria-hidden /> : <Plane size={11} aria-hidden />}
              {j.fecha} · {j.enCasa ? "casa" : "fuera"}
            </span>
            <span className="w-full truncate text-center text-[12px] font-semibold" title={j.rival}>{nombreCorto(j.rival)}</span>
            <span className="tabular-nums">
              {LETRA[j.resultado]} {j.marcador}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-xs text-white/60">V: ganó · E: empató · D: perdió. El marcador va con sus goles primero. Borde continuo: en su casa; discontinuo: fuera.</p>
    </div>
  );
}
