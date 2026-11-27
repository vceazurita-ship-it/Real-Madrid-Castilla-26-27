"use client";

/**
 * EL ÚLTIMO PARTIDO EN 3D, EN LA PORTADA (14/11/2026, petición del analista).
 *
 * El retrato 3D animado (components/data/RelievePartido) del último partido
 * del Castilla en Opta, si ya tiene su evento a evento (opta:directo:<id>, lo
 * deja el directo o «Repasar otro partido»). Si no lo tiene, no ocupa sitio.
 *
 * 18/11/2026 (ronda 22, los cuatro jueces): la portada se acorta. Se ven la
 * lectura, las tres cifras (el Castilla primero, como en Análisis de datos),
 * las tres claves, las ocasiones en vídeo y una frase con lo que dice el 3D;
 * el 3D se queda plegado tras «Ver en 3D» y se monta al pulsar.
 *
 * 27/11/2026 (los tres jueces): el partido lo decide el CALENDARIO (BeSoccer,
 * el último jugado), no el último que tiene Opta. El día después de jugar con
 * el Murcia (J13) salía el Gimnàstic (J12) porque Opta aún no tenía el J13.
 * Si Opta todavía no tiene el último jugado, la tarjeta sale con su resultado,
 * su jornada y sus enlaces (análisis e informe post), sin las cifras de Opta.
 * La jornada va también en la cabecera cuando sí las hay.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, ChevronDown, FileText, Mountain } from "lucide-react";

import { CabeceraBloque } from "@/components/portada/CabeceraBloque";
import { RelievePartido } from "@/components/data/RelievePartido";
import { VideoOpta } from "@/components/opta/VideoOpta";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import { retrato, territorioRetrato } from "@/lib/opta-retrato";
import { DESDE_TRAMO_FINAL, fraseCampoPisado, nombreCorto, territorioEntre, titularPartido } from "@/lib/partido-frases";
import { urlPostDelPartido } from "@/lib/post-partido";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { useCalendario } from "@/hooks/useCalendario";
import { alrededorDe } from "@/lib/castilla/calendario";
import { CASTILLA_OPTA, DOCS_OPTA, aObjetos, traeOpta, type TablaOpta } from "@/lib/opta";

type Doc = { eventos?: TablaOpta; equipos?: TablaOpta; jugadores?: TablaOpta; fecha?: string };

export function UltimoPartido3D() {
  const { opta } = useOptaLigero();
  const { ultimo, fechaOpta } = useMemo(() => {
    const nuestros = (opta?.partidos ?? []).filter((f) => f.teamId === CASTILLA_OPTA && String(f.partido ?? ""));
    nuestros.sort((x, y) => String(y.fecha ?? "").localeCompare(String(x.fecha ?? "")));
    return { ultimo: nuestros[0] ? String(nuestros[0].partido) : "", fechaOpta: nuestros[0] ? String(nuestros[0].fecha ?? "").slice(0, 10) : "" };
  }, [opta]);
  /* El último jugado según el calendario; `ahora` se apunta en un efecto (nada de Date.now() en el render). */
  const { partidos: calendario } = useCalendario();
  const [ahora, setAhora] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0);
    return () => clearTimeout(id);
  }, []);
  const delCalendario = useMemo(() => {
    if (!ahora || !calendario.length) return null;
    const { anterior, todos } = alrededorDe(calendario, ahora);
    return { anterior: anterior?.jugado ? anterior : null, todos };
  }, [calendario, ahora]);
  const anterior = delCalendario?.anterior ?? null;
  const fechaAnterior = anterior ? anterior.cuando.slice(0, 10) : "";
  /* Opta va por detrás si su último partido es anterior (más de un día) al último jugado. */
  const optaAtrasado = Boolean(anterior && fechaOpta && fechaAnterior && Date.parse(`${fechaAnterior}T12:00:00Z`) - Date.parse(`${fechaOpta}T12:00:00Z`) > 36 * 3_600_000);
  const jornadaDe = (fecha: string) => delCalendario?.todos.find((p) => p.cuando.slice(0, 10) === fecha)?.jornada ?? 0;
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

  /* El 3D, plegado hasta que se pide (18/11/2026, ronda 22). */
  const [ver3d, setVer3d] = useState(false);

  const filas = aObjetos(doc?.equipos ?? null).sort((x, y) => (x.teamId === CASTILLA_OPTA ? -1 : y.teamId === CASTILLA_OPTA ? 1 : 0));
  const [x, y] = [filas[0], filas[1]];
  const idRival = y ? String(y.teamId ?? "") : "";

  /*
  | Lo que dice el 3D, en una frase (18/11/2026, ronda 22, análisis). Ronda 23
  | (guionista y fútbol): la MISMA función y la misma frase que el 3D de
  | Análisis de datos (`fraseCampoPisado`, lib/partido-frases), contada desde
  | nosotros: «Pisamos campo rival el 62 % del partido; en el tramo final
  | (desde el 75′), el Gimnàstic, el 89 %». Nada de «hacia el 98′».
  */
  const nombreRival = y ? nombreCorto(String(y.equipo ?? "")) : "";
  /*
  | 20/11/2026 (ronda 5, fútbol): «…en el tramo final (desde el 75′), el
  | Gimnàstic, el 73 %» no se entendía. En la portada se dice quién lo pisó y
  | qué se entrena: «desde el 75′ fue el Gimnàstic quien lo pisó el 73 % →
  | cerrar partidos: altura del bloque en los últimos 15′», con la fuente y
  | los minutos de la base. Sin tramo final, la frase de siempre.
  */
  const territorio = useMemo(() => {
    if (!doc?.eventos?.filas?.length || !idRival) return null;
    const r = retrato(leeEventos(doc.eventos), CASTILLA_OPTA, idRival);
    const total = territorioRetrato(r, null);
    if (total == null) return null;
    const pct = (v: number) => `${Math.round(v * 100)} %`;
    const fin = r.minutos - 1 > DESDE_TRAMO_FINAL + 5 ? territorioEntre(r, DESDE_TRAMO_FINAL, r.minutos - 1) : null;
    const base = `Opta · ${r.minutos}′ jugados${fin != null ? `; tramo final, del ${DESDE_TRAMO_FINAL}′ al ${r.minutos - 1}′` : ""}`;
    if (fin == null) return { frase: fraseCampoPisado(r, "Castilla", nombreRival, true) ?? "", entrenar: "", base };
    const inicio = `Pisamos campo rival el ${pct(total)} del partido`;
    return fin < 0.5
      ? {
          frase: `${inicio}; desde el ${DESDE_TRAMO_FINAL}′ fue el ${nombreRival} quien lo pisó el ${pct(1 - fin)}`,
          entrenar: `cerrar partidos: altura del bloque en los últimos 15′`,
          base,
        }
      : {
          frase: `${inicio}; desde el ${DESDE_TRAMO_FINAL}′, lo pisamos nosotros el ${pct(fin)}`,
          entrenar: "",
          base,
        };
  }, [doc, idRival, nombreRival]);

  if (anterior && (optaAtrasado || (!fechaOpta && opta))) {
    const golesF = anterior.golesFavor ?? 0;
    const golesC = anterior.golesContra ?? 0;
    const marcadorCal =
      anterior.lado === "casa" ? `Real Madrid Castilla ${golesF}-${golesC} ${anterior.rival}` : `${anterior.rival} ${golesC}-${golesF} Real Madrid Castilla`;
    const hrefPostCal = urlPostDelPartido(fechaAnterior, anterior.rival);
    const fechaCal = diaCorto(anterior.cuando);
    const lecturaCal = `${golesF > golesC ? "Ganamos" : golesF < golesC ? "Perdimos" : "Empatamos"} ${golesF}-${golesC} ${anterior.lado === "casa" ? "con el" : "en el campo del"} ${nombreCorto(anterior.rival)}`;

    return (
      <section className="portada-tarjeta p-4 sm:p-6" aria-label="El último partido">
        <CabeceraBloque
          icono={Mountain}
          titulo={anterior.jornada ? `El último partido · J${anterior.jornada}` : "El último partido"}
          sub={
            <>
              <span className="font-semibold text-white/85">{marcadorCal}</span>
              {fechaCal ? <span> · {fechaCal}</span> : null}
            </>
          }
          accion={
            <div className="flex flex-wrap gap-1.5">
              <Link href={hrefPostCal} className="portada-celda portada-viva inline-flex min-h-10 items-center gap-1.5 px-3.5 text-[13px] font-semibold text-white/85">
                <BarChart3 className="h-4 w-4" style={{ color: "var(--rmcf-gold-ink)" }} aria-hidden />
                Análisis del partido
              </Link>
              <Link href="/microcycles" className="portada-celda portada-viva inline-flex min-h-10 items-center gap-1.5 px-3.5 text-[13px] font-semibold text-white/85">
                <FileText className="h-4 w-4" style={{ color: "var(--rmcf-gold-ink)" }} aria-hidden />
                Informe post
              </Link>
            </div>
          }
        />
        <Link
          href={hrefPostCal}
          className="group fuente-club mt-4 inline-block text-[22px] font-bold uppercase leading-tight underline-offset-4 hover:underline"
          style={{ color: "var(--rmcf-gold-ink)" }}
          title="El análisis de este partido en Análisis de datos"
        >
          {lecturaCal}
          <ArrowRight size={16} className="ml-1 inline-block align-[-1px] transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </section>
    );
  }

  if (!doc?.eventos?.filas?.length || !x || !y) return null;
  const nom = (f: Record<string, unknown>) => (f.teamId === CASTILLA_OPTA ? "Real Madrid Castilla" : String(f.equipo ?? ""));
  /* El nombre corto, para las cifras y la leyenda del 3D («manda Castilla», no «manda Real»). */
  /* 18/11/2026 (ronda 23): el mismo nombre corto que Análisis de datos («Gimnàstic», no «Tarragona»). */
  const corto = (f: Record<string, unknown>) => (f.teamId === CASTILLA_OPTA ? "Castilla" : nombreCorto(String(f.equipo ?? "")));
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  /* Un decimal (17/11/2026): la misma cifra que el 3D de debajo y que Análisis de datos («0,7 – 0,5»). */
  const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
  const pos = (f: Record<string, unknown>) => `${Math.round(n(f["Poss%"]) * (n(f["Poss%"]) <= 1 ? 100 : 1))} %`;
  /* El marcador, en el orden del partido (el local primero). */
  const fuera = String(x.campo ?? "").toUpperCase() === "AWAY";
  const [loc, vis] = fuera ? [y, x] : [x, y];
  /*
  | Tres cifras que cuentan el partido sin abrirlo: ocasiones, puntería y balón.
  | 18/11/2026 (ronda 22, guionista): el Castilla primero en todas, como en
  | Análisis de datos («0,5 – 0,7 · Castilla · Tarragona»); antes iba el local.
  */
  const cifras: [string, string, string][] = [
    ["xG", coma(n(x.ExpG)), coma(n(y.ExpG))],
    /* 17/11/2026 (fútbol): «a puerta», con los remates totales en la base de la casilla. */
    ["A puerta", String(n(x.SOG)), String(n(y.SOG))],
    ["Posesión", pos(x), pos(y)],
  ];
  const gx = n(x.Goal);
  const gy = n(y.Goal);
  const dxg = n(x.ExpG) - n(y.ExpG);
  /* 18/11/2026 (ronda 23, guionista): el mismo titular que las tres claves de Análisis de datos («Ganamos 1-0 con menos goles esperados (0,5 – 0,7)»). */
  const lectura = titularPartido(gx, gy, n(x.ExpG), n(y.ExpG));
  /*
  | Tres claves para el micro (expertos, 14/11/2026): ocasiones, presión y
  | balón parado. 17/11/2026 (ronda 21, fútbol): cada una con su base (el
  | dato y sobre cuántos remates o córners) y acabada en lo que se entrena
  | («→ …»); y cada una abre el post de ESE partido en Análisis de datos.
  */
  const remX = n(x.ShtIncBl);
  const remY = n(y.ShtIncBl);
  /* El post de ESTE partido (fecha y rival), y el «Con los mapas» del mismo id. */
  const fechaIso = doc.fecha ? String(doc.fecha).slice(0, 10) : "";
  const hrefPost = fechaIso ? urlPostDelPartido(fechaIso, nom(y)) : "/data-analisis?area=post";
  /*
  | 20/11/2026 (ronda 4, análisis y marketing): las tres claves, en fichas
  | cortas —el tema, el dato en negrita, su base y la acción al final— en vez
  | de tres frases largas en gris. Cada ficha abre su análisis con el partido
  | ya elegido: ocasiones y presión, el post de este partido; el balón
  | parado, el mismo partido con sus mapas (córners y faltas).
  */
  const enRemates = (xg: unknown, rem: number, quien: string) => `${coma(n(xg))} xG ${quien}${rem > 0 ? ` en ${rem} remates` : ""}`;
  const tieneAbp = typeof x.xGSetPly === "number" && typeof y.xGSetPly === "number";
  const hrefMapas = `/data-analisis?area=directo&partido=${ultimo}`;
  const claves: { tema: string; dato: string; base: string; entrenar: string; href: string }[] = [
    {
      tema: "Ocasiones",
      dato: dxg <= -0.15 ? "Concedimos más de lo que generamos" : dxg >= 0.15 ? "Generamos más de lo que concedimos" : "Ocasiones igualadas",
      base: `${enRemates(x.ExpG, remX, "nuestros")} · ${enRemates(y.ExpG, remY, "suyos")}`,
      entrenar: dxg <= -0.15 ? "defensa del área: vigilancias y segunda jugada" : dxg >= 0.15 ? "mantener las llegadas y afinar la última acción" : "finalización: el detalle decidió",
      href: hrefPost,
    },
    ...(n(x.PPDA) > 0 && n(y.PPDA) > 0
      ? [
          {
            tema: "Presión",
            dato: n(x.PPDA) > n(y.PPDA) ? "Presionamos menos que ellos" : "Presionamos más que ellos",
            base: `PPDA ${coma(n(x.PPDA), 1)} nuestro y ${coma(n(y.PPDA), 1)} suyo (menos es más presión)`,
            entrenar: n(x.PPDA) > n(y.PPDA) ? "presión tras pérdida y altura del bloque" : "sostenerla sin partirnos",
            href: hrefPost,
          },
        ]
      : []),
    {
      tema: "Balón parado",
      dato: `${n(x.Corners)} córners nuestros y ${n(y.Corners)} suyos`,
      /* 20/11/2026 (ronda 7, fútbol): el desenlace con su base: cuántas ocasiones dio el balón parado a cada uno (Opta, ChncSetPl) y su xG. */
      base: [
        typeof x.ChncSetPl === "number" && typeof y.ChncSetPl === "number"
          ? `a balón parado: ${n(x.ChncSetPl)} ${n(x.ChncSetPl) === 1 ? "ocasión nuestra" : "ocasiones nuestras"} · ${n(y.ChncSetPl)} ${n(y.ChncSetPl) === 1 ? "suya" : "suyas"}`
          : "",
        tieneAbp ? `xG a balón parado ${coma(n(x.xGSetPly))} nuestro y ${coma(n(y.xGSetPly))} suyo` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      entrenar: n(y.Corners) > n(x.Corners) ? "defensa del córner: marcas y rechace" : "nuestros córners: primer palo y segunda jugada",
      href: hrefMapas,
    },
  ];
  const eq = (f: Record<string, unknown>) => ({ teamId: String(f.teamId ?? ""), nombre: f.teamId === CASTILLA_OPTA ? "Castilla" : nom(f), color: String(f.color ?? ""), campo: String(f.campo ?? "") });
  const fecha = doc.fecha ? diaCorto(String(doc.fecha)) : "";
  const jornadaOpta = fechaIso ? jornadaDe(fechaIso) : 0;
  const marcador = `${nom(loc)} ${String(loc.Goal ?? "")}-${String(vis.Goal ?? "")} ${nom(vis)}`;
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
        titulo={jornadaOpta ? `El último partido · J${jornadaOpta}` : "El último partido"}
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
                {corto(x)} · {corto(y)}
                {t === "A puerta" && remX + remY > 0 ? ` · de ${remX} y ${remY} remates` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>

      <ul className={`mt-4 grid gap-2 ${claves.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {claves.map((c) => (
          <li key={c.tema} className="min-w-0">
            <Link
              href={c.href}
              className="portada-celda portada-viva group flex h-full min-w-0 flex-col px-3 py-2.5 leading-snug"
              title={c.href === hrefPost ? "Abre el análisis de este partido" : "Abre este partido con sus mapas"}
            >
              <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/60">{c.tema}</span>
              <span className="mt-0.5 text-[15px] font-bold text-white">{c.dato}</span>
              {c.base ? <span className="mt-0.5 text-[12.5px] text-white/65">{c.base}</span> : null}
              <span className="mt-auto flex items-start gap-1 pt-1.5 text-[13px] font-semibold text-white/90">
                <span style={{ color: "var(--rmcf-gold-ink)" }}>→</span>
                <span className="min-w-0 flex-1">{c.entrenar}</span>
                <ArrowRight size={14} className="mt-0.5 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* 17/11/2026 (ronda 21, análisis): las jugadas en vídeo (Opta), las tres ocasiones más claras del partido. */}
      {ocasiones.length > 0 && (
        <div className="mb-4 mt-3 flex flex-wrap items-center gap-2">
          {/* 20/11/2026 (ronda 4, fútbol): con xG de 0,1-0,2 no son «las más claras»; se dice lo que son y sobre cuántos remates. */}
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60">
            Las ocasiones con más goles esperados, en vídeo
            {remX + remY > 0 ? <span className="normal-case tracking-normal text-white/55"> · de {remX} y {remY} remates</span> : null}
          </span>
          {ocasiones.map((e) => {
            /* 18/11/2026 (ronda 23, fútbol): de qué equipo es cada una («Castilla · Pol Fortuny», «Gimnàstic · Pere»). */
            const equipo = e.teamId === CASTILLA_OPTA ? "Castilla" : corto(y);
            const jugador = nombreDe.get(e.jugadorId);
            const quien = jugador ? `${equipo} · ${jugador}` : equipo;
            return (
              <span key={`${e.parte}-${e.segundo}-${e.jugadorId}`} className="inline-flex flex-wrap items-center gap-1">
                <VideoOpta
                  tipo="shots"
                  evento={{ partido: ultimo, fecha: fechaIso, parte: e.parte, segundo: e.segundo }}
                  /* 18/11/2026 (ronda 22, fútbol): un decimal, como el resto de la portada. */
                  etiqueta={`▶ ${e.minuto}′ ${quien} · xG ${coma(e.xG ?? 0)}`}
                  descripcion={`Remate de ${jugador || equipo} (${equipo}), ${e.minuto}′`}
                />
                {/* 20/11/2026 (ronda 5, análisis): nuestro jugador, a su ficha ya elegido. */}
                {e.teamId === CASTILLA_OPTA && jugador ? (
                  <Link
                    href={`/individual?nombre=${encodeURIComponent(jugador)}`}
                    title={`La ficha de ${jugador}`}
                    className="inline-flex min-h-8 items-center px-1.5 text-[12px] font-semibold underline decoration-white/30 underline-offset-2 hover:decoration-current"
                    style={{ color: "var(--rmcf-gold-ink)" }}
                  >
                    Su ficha
                  </Link>
                ) : null}
              </span>
            );
          })}
        </div>
      )}
      {ocasiones.length === 0 && <div className="mb-4" />}

      {/*
        18/11/2026 (ronda 22): la conclusión del 3D, visible; el 3D, plegado
        tras «Ver en 3D» (se monta al pulsar y arranca parado en el resumen
        del partido entero, como desde el 17/11).
      */}
      <div className="portada-celda flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3.5 py-3">
        {territorio?.frase ? (
          <div className="min-w-0 flex-1 basis-[260px] leading-snug">
            <p className="text-[14px] font-semibold text-white">
              {territorio.frase}
              {territorio.entrenar ? (
                <>
                  {" "}
                  <span style={{ color: "var(--rmcf-gold-ink)" }}>→</span> {territorio.entrenar}
                </>
              ) : (
                "."
              )}
            </p>
            <p className="mt-0.5 text-[12px] text-white/60">{territorio.base}</p>
          </div>
        ) : (
          <p className="min-w-0 flex-1 basis-[260px] text-[14px] leading-snug text-white/80">Quién mandó en cada tramo y dónde llegaron los remates.</p>
        )}
        <button
          type="button"
          onClick={() => setVer3d((v) => !v)}
          aria-expanded={ver3d}
          className="portada-viva inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 px-3.5 text-[13px] font-semibold"
          style={{ color: "var(--rmcf-gold-ink)" }}
        >
          <Mountain className="h-4 w-4" aria-hidden />
          {ver3d ? "Plegar el 3D" : "Ver en 3D"}
          <ChevronDown className={`h-4 w-4 transition-transform ${ver3d ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>

      {ver3d ? (
        <div className="mt-3">
          <RelievePartido quietoAlFinal nuestroALaIzquierda eventos={doc.eventos} jugadores={new Map(leeJugadores(doc.jugadores).map((j) => [j.id, j]))} a={eq(x)} b={eq(y)} partido={ultimo} />
        </div>
      ) : null}
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
