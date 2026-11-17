"use client";

/**
 * EL ÚLTIMO PARTIDO EN 3D, EN LA PORTADA (14/11/2026, petición del analista).
 *
 * El retrato 3D animado (components/data/RelievePartido) del último partido
 * del Castilla en Opta, si ya tiene su evento a evento (opta:directo:<id>, lo
 * deja el directo o «Repasar otro partido»). Si no lo tiene, no ocupa sitio.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Mountain } from "lucide-react";

import { CabeceraBloque } from "@/components/portada/CabeceraBloque";
import { RelievePartido } from "@/components/data/RelievePartido";
import { VideoOpta } from "@/components/opta/VideoOpta";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import { urlPostDelPartido } from "@/lib/post-partido";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { CASTILLA_OPTA, DOCS_OPTA, aObjetos, traeOpta, type TablaOpta } from "@/lib/opta";

type Doc = { eventos?: TablaOpta; equipos?: TablaOpta; jugadores?: TablaOpta; fecha?: string };

export function UltimoPartido3D() {
  const { opta } = useOptaLigero();
  const ultimo = useMemo(() => {
    const nuestros = (opta?.partidos ?? []).filter((f) => f.teamId === CASTILLA_OPTA && String(f.partido ?? ""));
    nuestros.sort((x, y) => String(y.fecha ?? "").localeCompare(String(x.fecha ?? "")));
    return nuestros[0] ? String(nuestros[0].partido) : "";
  }, [opta]);
  const [doc, setDoc] = useState<Doc | null>(null);
  useEffect(() => {
    if (!ultimo) return;
    let vivo = true;
    void traeOpta<Doc>(DOCS_OPTA.directo(ultimo)).then((d) => {
      if (vivo) setDoc(d);
    });
    return () => {
      vivo = false;
    };
  }, [ultimo]);

  const filas = aObjetos(doc?.equipos ?? null).sort((x, y) => (x.teamId === CASTILLA_OPTA ? -1 : y.teamId === CASTILLA_OPTA ? 1 : 0));
  const [x, y] = [filas[0], filas[1]];
  if (!doc?.eventos?.filas?.length || !x || !y) return null;
  const nom = (f: Record<string, unknown>) => (f.teamId === CASTILLA_OPTA ? "Real Madrid Castilla" : String(f.equipo ?? ""));
  /* El nombre corto, para las cifras y la leyenda del 3D («manda Castilla», no «manda Real»). */
  const corto = (f: Record<string, unknown>) => (f.teamId === CASTILLA_OPTA ? "Castilla" : String(f.equipo ?? "").split(" ").slice(-1)[0]);
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  /* Un decimal (17/11/2026): la misma cifra que el 3D de debajo y que Análisis de datos («0,7 – 0,5»). */
  const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
  const pos = (f: Record<string, unknown>) => `${Math.round(n(f["Poss%"]) * (n(f["Poss%"]) <= 1 ? 100 : 1))} %`;
  /* 16/11/2026 (fútbol): todo en el orden del marcador, el local primero, como en «Opta de un vistazo». */
  const fuera = String(x.campo ?? "").toUpperCase() === "AWAY";
  const [loc, vis] = fuera ? [y, x] : [x, y];
  /* Tres cifras que cuentan el partido sin abrirlo: ocasiones, puntería y balón. */
  const cifras: [string, string, string][] = [
    ["xG", coma(n(loc.ExpG)), coma(n(vis.ExpG))],
    /* 17/11/2026 (fútbol): «a puerta», con los remates totales en la base de la casilla. */
    ["A puerta", String(n(loc.SOG)), String(n(vis.SOG))],
    ["Posesión", pos(loc), pos(vis)],
  ];
  const gx = n(x.Goal);
  const gy = n(y.Goal);
  const dxg = n(x.ExpG) - n(y.ExpG);
  const lectura =
    gx > gy
      ? dxg >= 0.15 ? "Victoria merecida: más ocasiones que el rival." : dxg <= -0.15 ? "Victoria con menos ocasiones que el rival." : "Victoria en un partido de ocasiones igualadas."
      : gx < gy
        ? dxg >= 0.15 ? "Derrota con más ocasiones que el rival: faltó acierto." : dxg <= -0.15 ? "Derrota en la que el rival generó más." : "Derrota en un partido de ocasiones igualadas."
        : dxg >= 0.15 ? "Empate con más ocasiones nuestras." : dxg <= -0.15 ? "Empate con más ocasiones del rival." : "Empate con ocasiones igualadas.";
  /*
  | Tres claves para el micro (expertos, 14/11/2026): ocasiones, presión y
  | balón parado. 17/11/2026 (ronda 21, fútbol): cada una con su base (el
  | dato y sobre cuántos remates o córners) y acabada en lo que se entrena
  | («→ …»); y cada una abre el post de ESE partido en Análisis de datos.
  */
  const remX = n(x.ShtIncBl);
  const remY = n(y.ShtIncBl);
  const enRemates = (xg: unknown, rem: number) => `${coma(n(xg))} goles esperados${rem > 0 ? ` en ${rem} remates` : ""}`;
  const tieneAbp = typeof x.xGSetPly === "number" && typeof y.xGSetPly === "number";
  const claves: { dato: string; entrenar: string }[] = [
    dxg <= -0.15
      ? { dato: `Concedimos ${enRemates(y.ExpG, remY)} suyos; generamos ${enRemates(x.ExpG, remX)}.`, entrenar: "defensa del área: vigilancias y segunda jugada" }
      : dxg >= 0.15
        ? { dato: `Generamos ${enRemates(x.ExpG, remX)}; concedimos ${enRemates(y.ExpG, remY)} suyos.`, entrenar: "mantener las llegadas al área y afinar la última acción" }
        : { dato: `Ocasiones igualadas: ${enRemates(x.ExpG, remX)} nuestros y ${enRemates(y.ExpG, remY)} suyos.`, entrenar: "finalización: el detalle decidió" },
    ...(n(x.PPDA) > 0 && n(y.PPDA) > 0
      ? [
          n(x.PPDA) > n(y.PPDA)
            ? { dato: `Presión: dejamos dar ${coma(n(x.PPDA), 1)} pases por acción defensiva, frente a ${coma(n(y.PPDA), 1)} del rival (menos es más presión).`, entrenar: "presionamos menos que ellos: presión tras pérdida y altura del bloque" }
            : { dato: `Presión: dejamos dar ${coma(n(x.PPDA), 1)} pases por acción defensiva, frente a ${coma(n(y.PPDA), 1)} del rival (menos es más presión).`, entrenar: "presionamos más que ellos: sostenerla sin partirnos" },
        ]
      : []),
    {
      dato: `Balón parado: ${n(x.Corners)} córners nuestros y ${n(y.Corners)} suyos${tieneAbp ? ` (xG a balón parado ${coma(n(x.xGSetPly))} y ${coma(n(y.xGSetPly))})` : ""}.`,
      entrenar: n(y.Corners) > n(x.Corners) ? "defensa del córner: marcas y rechace" : "nuestros córners: primer palo y segunda jugada",
    },
  ];
  const eq = (f: Record<string, unknown>) => ({ teamId: String(f.teamId ?? ""), nombre: f.teamId === CASTILLA_OPTA ? "Castilla" : nom(f), color: String(f.color ?? ""), campo: String(f.campo ?? "") });
  const fecha = doc.fecha ? diaCorto(String(doc.fecha)) : "";
  const marcador = `${nom(loc)} ${String(loc.Goal ?? "")}-${String(vis.Goal ?? "")} ${nom(vis)}`;
  /* El post de ESTE partido (fecha y rival), y el «Con los mapas» del mismo id. */
  const fechaIso = doc.fecha ? String(doc.fecha).slice(0, 10) : "";
  const hrefPost = fechaIso ? urlPostDelPartido(fechaIso, nom(y)) : "/data-analisis?area=post";
  /* Las tres ocasiones más claras del partido (de los dos), con su vídeo en Opta. */
  const ocasiones = fechaIso
    ? leeEventos(doc.eventos)
        .filter((e) => (e.xG ?? 0) > 0)
        .sort((p, q) => (q.xG ?? 0) - (p.xG ?? 0))
        .slice(0, 3)
        .sort((p, q) => p.segundo - q.segundo)
    : [];
  const nombreDe = new Map(leeJugadores(doc.jugadores).map((j) => [j.id, j.nombre]));

  return (
    <section className="portada-tarjeta p-4 sm:p-6" aria-label="El último partido en 3D">
      <CabeceraBloque
        icono={Mountain}
        titulo="El último partido en 3D"
        sub={
          <>
            <span className="font-semibold text-white/85">{marcador}</span>
            {fecha ? <span> · {fecha}</span> : null}
          </>
        }
        accion={
          <div className="flex flex-wrap gap-1.5">
            <Link href={hrefPost} className="portada-celda portada-viva inline-flex min-h-10 items-center gap-1.5 px-3.5 text-[13px] font-semibold text-white/85">
              <BarChart3 className="h-4 w-4" style={{ color: "var(--rmcf-gold-ink)" }} aria-hidden />
              Análisis del partido
            </Link>
            <Link href={`/data-analisis?area=directo&partido=${ultimo}`} className="portada-celda portada-viva inline-flex min-h-10 items-center gap-1.5 px-3.5 text-[13px] font-semibold text-white/85">
              Con los mapas
              <ArrowRight size={14} aria-hidden />
            </Link>
            {/* 17/11/2026 (fútbol): el informe post de esa jornada, que se arma y se manda desde Microciclos. */}
            <Link href="/microcycles" className="portada-celda portada-viva inline-flex min-h-10 items-center gap-1.5 px-3.5 text-[13px] font-semibold text-white/85">
              <FileText className="h-4 w-4" style={{ color: "var(--rmcf-gold-ink)" }} aria-hidden />
              Informe post
            </Link>
          </div>
        }
      />

      <div className="mt-5 grid gap-2 sm:grid-cols-[1.3fr_repeat(3,1fr)]">
        <Link
          href={hrefPost}
          className="group fuente-club self-center text-[22px] font-bold uppercase leading-tight underline-offset-4 hover:underline"
          style={{ color: "var(--rmcf-gold-ink)" }}
          title="El análisis de este partido en Análisis de datos"
        >
          {lectura}
          <ArrowRight size={16} className="ml-1 inline-block align-[-1px] transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
        <div className="grid grid-cols-3 gap-2 sm:contents">
          {cifras.map(([t, a, b]) => (
            <div key={t} className="portada-celda min-w-0 px-2.5 py-2.5 sm:px-3">
              <p className="break-words text-[12px] font-semibold uppercase leading-tight tracking-[0.06em] text-white/65 sm:tracking-[0.12em]">{t}</p>
              <p className="fuente-club mt-1 whitespace-nowrap text-[21px] font-bold leading-none tabular-nums text-white sm:text-[26px]">
                {a} <span className="text-white/40">–</span> {b}
              </p>
              <p className="mt-1 break-words text-[12px] leading-snug text-white/60">
                {corto(loc)} · {corto(vis)}
                {t === "A puerta" && n(loc.ShtIncBl) + n(vis.ShtIncBl) > 0 ? ` · de ${n(loc.ShtIncBl)} y ${n(vis.ShtIncBl)} remates` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>

      <ul className="mt-4 grid gap-1.5">
        {claves.map((c) => (
          <li key={c.dato}>
            <Link
              href={hrefPost}
              className="portada-celda portada-viva group flex min-w-0 items-start gap-2.5 px-3 py-2.5 text-[14px] leading-snug text-white/80"
              title="Abre el análisis de este partido"
            >
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8A96B]" aria-hidden />
              <span className="min-w-0 flex-1">
                {c.dato}{" "}
                <span className="font-semibold text-white">
                  <span style={{ color: "var(--rmcf-gold-ink)" }}>→</span> {c.entrenar}
                </span>
              </span>
              <ArrowRight size={14} className="mt-1 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {/* 17/11/2026 (ronda 21, análisis): las jugadas en vídeo (Opta), las tres ocasiones más claras del partido. */}
      {ocasiones.length > 0 && (
        <div className="mb-4 mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60">Las ocasiones más claras, en vídeo</span>
          {ocasiones.map((e) => {
            const quien = nombreDe.get(e.jugadorId) || (e.teamId === CASTILLA_OPTA ? "Castilla" : corto(y));
            return (
              <VideoOpta
                key={`${e.parte}-${e.segundo}-${e.jugadorId}`}
                tipo="shots"
                evento={{ partido: ultimo, fecha: fechaIso, parte: e.parte, segundo: e.segundo }}
                etiqueta={`▶ ${e.minuto}′ ${quien} · xG ${coma(e.xG ?? 0, 2)}`}
                descripcion={`Remate de ${quien}, ${e.minuto}′`}
              />
            );
          })}
        </div>
      )}
      {ocasiones.length === 0 && <div className="mb-4" />}

      {/* 17/11/2026 (ronda 21, marketing): arranca parado en el resumen del partido entero; se reproduce al pulsar. */}
      <RelievePartido quietoAlFinal eventos={doc.eventos} jugadores={new Map(leeJugadores(doc.jugadores).map((j) => [j.id, j]))} a={eq(x)} b={eq(y)} partido={ultimo} />
    </section>
  );
}

/** «vie 13 nov», en Madrid. */
function diaCorto(cuando: string) {
  const d = new Date(cuando.length <= 10 ? `${cuando}T12:00:00Z` : cuando);

  if (Number.isNaN(d.getTime())) return "";

  return d
    .toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" })
    .replace(/\./g, "")
    .replace(",", "");
}
