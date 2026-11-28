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

import { useEffect, useMemo, useState } from "react";
import { House, Plane, Play } from "lucide-react";
import { cargaResumenesRfef, resumenDelPartido, urlResumen } from "@/lib/rivals/resumen-de-partido";
import type { ResumenRfef } from "@/lib/rivals/resumenes-rfef";
import { useRivalInforme } from "@/hooks/useRivalInforme";
import { useRivalPerfiles } from "@/hooks/useRivalPerfiles";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { fuerteYFlojoDelRival } from "@/components/rivals/VistazoRival";
import { deSuLiga, filaPropia, findInforme, jugados } from "@/lib/rivals/informe";
import { medianaLiga } from "@/lib/rivals/puesto-liga";
import { chipInk } from "@/lib/theme";
import { nombreEquipo } from "@/lib/rivals/nombre-equipo";

const COLOR = { G: "#34D399", E: "#C8A96B", P: "#F87171" } as const;
const LETRA = { G: "V", E: "E", P: "D" } as const;
const PALABRA = { G: "Ganó", E: "Empató", P: "Perdió" } as const;

/* Un decimal como mucho (27/11/2026, jueces, ronda 9): 0,7 · 1,3, no 0,67 · 1,33. */
const coma = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

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
  /* El mismo par fuerte/flojo que Plantillas y el Plan (16/11/2026, jueces de fútbol). */
  const perfiles = useRivalPerfiles(equipo);
  const { tablas } = useOptaLigero();
  /* Los resúmenes de la RFEF en YouTube: cada partido de la tira abre el suyo (16/11/2026, ronda 18). */
  const [resumenes, setResumenes] = useState<ResumenRfef[]>([]);

  useEffect(() => {
    let vivo = true;

    cargaResumenesRfef().then((lista) => {
      if (vivo) setResumenes(lista);
    });

    return () => {
      vivo = false;
    };
  }, []);

  const par =perfiles ? fuerteYFlojoDelRival(equipo, perfiles.aspectos ?? [], perfiles.equipos ?? 0, tablas) : null;

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
          iso: String(partido.fecha ?? "").slice(0, 10),
          local: partido.local.nombre,
          visitante: partido.visitante.nombre,
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
  const golesFavor = partidos.reduce((s, j) => s + j.favor, 0);
  const golesContra = partidos.reduce((s, j) => s + j.contra, 0);
  const favor = golesFavor / n;
  const contra = golesContra / n;

  /* Qué hacemos, con lo que dicen los goles frente a la liga (0,15 por partido de margen). */
  const marca = liga ? frente(favor, liga.favor, 0.15) : "igual";
  const encaja = liga ? frente(contra, liga.contra, 0.15) : "igual";
  /* El titular: el dato que manda y la decisión, en una frase. */
  /*
  | 16/11/2026 (ronda 18, fútbol): «encaja 0,92 y marca poco» con un xG a favor
  | de 1,30 (P57). Cada palabra sale ya de la cifra que la sostiene y con su
  | mediana: «marca poco» sólo si marca por debajo de la mediana.
  */
  const med = (x: number | undefined) => (x != null ? ` (mediana ${coma(x)})` : "");
  const [dato, queHacemos] =
    encaja === "más"
      ? [`encaja ${coma(contra)} por partido${med(liga?.contra)}`, "ir a por él desde el principio y llegar con gente al área"]
      : marca === "más"
        ? [`marca ${coma(favor)} por partido${med(liga?.favor)}`, "cerrar primero su vía de gol y no partirse"]
        : encaja === "menos" && marca === "menos"
          ? [`encaja ${coma(contra)}${med(liga?.contra)} y marca ${coma(favor)} por partido${med(liga?.favor)}`, "sus partidos dan pocos goles: paciencia, y el balón parado pesa más"] /* 17/11/2026 (ronda 20, fútbol): «partido cerrado» chocaba con el tipo de partido del Plan, que proyecta el NUESTRO con Opta; aquí se habla de los suyos. */
          : encaja === "menos"
            ? [`encaja ${coma(contra)} por partido${med(liga?.contra)}, menos que la mayoría`, "paciencia con balón: el partido se abre con el balón parado y las transiciones"]
            : marca === "menos"
              ? /* 27/11/2026 (jueces de fútbol, ronda 9): marcaba 0,67 con la mediana en 1,36 y decía «como la media». A favor y en contra, por separado. */
                [`marca ${coma(favor)} por partido${med(liga?.favor)}${liga && favor > 0 && favor <= liga.favor * 0.6 ? `, ${favor <= liga.favor * 0.55 ? "la mitad" : "poco más de la mitad"} que la mediana` : ", menos que la mayoría"}`, "cerrar su poco ataque y no regalarle transiciones: el partido se nos abre con paciencia"]
              : [`marca ${coma(favor)} y encaja ${coma(contra)} por partido, como la media`, "lo deciden los detalles: balón parado y transiciones"];

  /* Las tres cifras grandes, cada una con su mediana de la liga. */
  const cifras = [
    { titulo: "Puntos por partido", valor: ppp, mediana: liga?.ppp, pie: `${v}V ${e}E ${d}D en ${n}`, mejor: "más es mejor" },
    { titulo: "Goles a favor por partido", valor: favor, mediana: liga?.favor, pie: `${golesFavor} goles`, mejor: "más es mejor" },
    { titulo: "Goles en contra por partido", valor: contra, mediana: liga?.contra, pie: `${golesContra} goles`, mejor: "menos es mejor" },
  ];

  return (
    <div className="mb-6 min-w-0">
      {/*
        La conclusión (16/11/2026, jueces): un titular con verbo y dato, y debajo
        tres líneas con su base, la referencia de la liga y el qué hacemos con el
        mismo par fuerte/flojo de Plantillas rivales.
      */}
      <div className="mb-3 min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] leading-snug text-white/80">
        <p className="mb-1 text-[15px] font-semibold leading-snug text-white">
          {equipo} {dato}: {queHacemos}.
        </p>
        {/* Tres cifras grandes con su mediana (16/11/2026, ronda 18, marketing): antes eran dos líneas de texto. */}
        <div className="my-2 grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
          {cifras.map((c) => (
            <div key={c.titulo} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 sm:px-3 sm:py-2">
              <p className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-white/60">{c.titulo}</p>
              <p className="text-xl font-black tabular-nums text-white sm:text-2xl">{coma(c.valor)}</p>
              <p className="text-[11px] leading-tight text-white/60 sm:text-[12px]">
                {c.mediana != null ? `mediana ${coma(c.mediana)} · ` : ""}
                {c.pie} · {c.mejor}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-white/60">
          {n} {n === 1 ? "partido" : "partidos"} de liga{liga ? `; la mediana es la de los ${liga.equipos} equipos de su grupo` : ""}.
        </p>
        {par?.conDato && (
          <p>
            <b className="text-white">Dónde atacarle:</b> {par.conDato}.
          </p>
        )}
        <p className="mt-0.5 text-[12px] text-white/55">
          BeSoccer, sólo su liga (sin copa ni torneos){par?.conDato ? "; lo fuerte y lo flojo, Wyscout y Opta, como en Plantillas rivales" : ""}.{n < 8 ? " Con menos de 8 partidos es tendencia." : ""}
        </p>
      </div>

      <p className="mb-1.5 text-[13px] font-semibold text-white/75">
        Partido a partido
        <span className="font-normal text-white/60"> · del más antiguo al más reciente, con su fecha</span>
      </p>
      {/* Rejilla que pasa de fila (16/11/2026): en una tira con scroll la última se cortaba («Alcorcó»). */}
      {/*
        28/11/2026 (jueces de fútbol): con 13 partidos, en el escritorio cabían
        12 por fila y el último se quedaba solo en la segunda. Desde `lg`, filas
        parejas de 7 como mucho (13 = 7 + 6); en el móvil, la rejilla de siempre.
      */}
      <ol
        aria-label={`Resultados de ${equipo} partido a partido`}
        className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-1.5 lg:[grid-template-columns:var(--tira-cols)]"
        style={{ "--tira-cols": `repeat(${Math.max(1, Math.ceil(partidos.length / Math.max(1, Math.ceil(partidos.length / 7))))}, minmax(0, 1fr))` } as React.CSSProperties}
      >
        {partidos.map((j) => {
          const resumen = j.iso ? resumenDelPartido(resumenes, j.local, j.visitante, j.iso) : null;
          const texto = `${j.fecha}: ${PALABRA[j.resultado]} ${j.marcador} ${j.enCasa ? "en casa" : "fuera"} contra ${j.rival}`;
          const cuerpo = (
            <>
              <span className="inline-flex items-center gap-1 text-xs font-medium opacity-80">
                {j.enCasa ? <House size={11} aria-hidden /> : <Plane size={11} aria-hidden />}
                {j.fecha} · {j.enCasa ? "casa" : "fuera"}
              </span>
              <span className="line-clamp-2 w-full text-center text-[12px] font-semibold leading-tight" title={nombreEquipo(j.rival)}>{nombreEquipo(j.rival)}</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                {LETRA[j.resultado]} {j.marcador}
                {resumen && <Play size={10} className="fill-current" aria-hidden />}
              </span>
            </>
          );
          const clase = `flex h-full min-w-0 flex-col items-center rounded-lg border px-1.5 py-1 text-[12px] font-bold leading-tight${resumen ? " transition hover:brightness-110" : ""}`;
          const estilo = {
            background: `${COLOR[j.resultado]}26`,
            color: chipInk(COLOR[j.resultado]),
            borderColor: `${COLOR[j.resultado]}88`,
            borderStyle: j.enCasa ? "solid" : "dashed",
          } as const;

          /* Casa con borde continuo y una casita; fuera, borde discontinuo y un avión. Con resumen de la RFEF, abre el vídeo (▶). */
          return (
            <li key={j.id} className="min-w-0">
              {resumen ? (
                <a href={urlResumen(resumen)} target="_blank" rel="noreferrer" title={`${texto} · ver el resumen en vídeo (RFEF)`} aria-label={`${texto}. Ver el resumen en vídeo`} className={clase} style={estilo}>
                  {cuerpo}
                </a>
              ) : (
                <div title={texto} aria-label={texto} className={clase} style={estilo}>
                  {cuerpo}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-xs text-white/60">V: ganó · E: empató · D: perdió. El marcador va con sus goles primero. Borde continuo: en su casa; discontinuo: fuera.{resumenes.length > 0 ? " ▶: abre el resumen en vídeo de la RFEF." : ""}</p>
    </div>
  );
}
