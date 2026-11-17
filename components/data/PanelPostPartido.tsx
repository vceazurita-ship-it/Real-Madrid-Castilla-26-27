"use client";

/**
 * POST DEL PARTIDO (10/11/2026): la puerta con la que se abre Data análisis.
 *
 * Contesta «¿qué pasó y por qué?» del último partido del Castilla —o del que
 * se elija— con UN SOLO selector que manda sobre todo lo de abajo:
 *
 *   1. El cara a cara de las cifras, el momentum por tramos y los remates de
 *      los dos (Opta: `CaraACara`, `Momentum`, `MapaRemates` del área Opta).
 *   2. «Partido en el campo» de Wyscout (`PanelCampograma`, con el partido
 *      fijado): cada momento sobre el campo y lo que solemos hacer.
 *   3. Las fases acción a acción de Opta (`Fases`, sólo ese partido).
 *   4. Los laboratorios de robos, pérdidas y faltas abiertos en ese partido,
 *      y al pie, el microciclo.
 *
 * Las piezas se importan, no se copian. El partido se ata entre las dos
 * fuentes en `lib/post-partido.ts` (rival + fecha más cercana, ≤ 4 días). Si
 * una fuente aún no lo tiene, su bloque no se pinta y arriba lo dice.
 *
 * Los documentos pesados de Opta (remates ≈ 3 MB, acciones del Castilla
 * ≈ 3 MB, momento ≈ 1 MB) se piden sólo al montar esta puerta y se
 * comparten entre las piezas (`hooks/useDocsOpta.ts`).
 */

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList, Film, Footprints, LayoutGrid, ShieldAlert, Swords, Timer, Trophy, Video } from "lucide-react";
import { EnlacesRapidos } from "@/components/ui/EnlacesRapidos";
import { urlGolesDelEquipo } from "@/lib/rivals/goles-en-video";

import { CaraACara } from "@/app/opta/_piezas/FichaPartido";
import { Fases } from "@/app/opta/_piezas/Fases";
import { Momentum } from "@/app/opta/_piezas/Momentum";
import { MapaRemates } from "@/app/opta/_piezas/Remates";
import { Elegir } from "@/app/opta/_piezas/comun";
import { nombreDe, useAcciones, useRemates } from "@/app/opta/_piezas/eventos";
import { alturaAccion, esPerdida, esProgresivo, esRecuperacion } from "@/lib/opta-eventos";
import { useOpta, type DatosOpta } from "@/app/opta/_piezas/useOpta";
import { Notice } from "@/components/abp/ui";
import { PanelCampograma } from "@/components/data/PanelCampograma";
import { RelievePartido } from "@/components/data/RelievePartido";
import { useAdmin } from "@/hooks/useAdmin";
import { DOCS_OPTA, aObjetos, traeOpta, type TablaOpta } from "@/lib/opta";
import { useCalendarioCastilla } from "@/components/data/SelloJornada";
import { Hueso } from "@/components/ui/estados";
import { SelloFuente } from "@/components/ui/SelloFuente";
import { partidoDeFecha } from "@/lib/data-analisis/alcance";
import type { FilaPartido } from "@/lib/data-analisis/leer";
import { temporadaDe } from "@/lib/data-analisis/metricas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { fechaCorta, NOMBRE_CASTILLA } from "@/lib/opta-analisis";
import { CASTILLA_WYSCOUT, castillaWyscout, emparejaPartidos, enlaceConPartido, temporadaVigente, type PartidoPost } from "@/lib/post-partido";
import { partidoEnlazado, usePartidoDeLaUrl } from "@/lib/partido-enlazado";
import { useEtiquetadoEnVideo } from "@/hooks/useEtiquetadoEnVideo";

/**
 * QUÉ TOCA EN EL MICROCICLO (16/11/2026, expertos, ronda 17): una o dos
 * órdenes atadas a una cifra del cara a cara, sólo cuando la diferencia es
 * clara. Sin ninguna clara, no se escribe nada y quedan los enlaces.
 */
function ordenesMicro(datos: DatosOpta | null, partido: string, rival: string): string[] {
  if (!datos) return [];
  const filas = datos.partidos.filter((f) => String(f.partido ?? "") === partido);
  const nos = filas.find((f) => f.teamId === CASTILLA_OPTA);
  const ellos = filas.find((f) => f.teamId !== CASTILLA_OPTA);
  if (!nos || !ellos) return [];
  const num = (f: (typeof filas)[number], k: string) => {
    const v = f[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const pct = (v: number | null) => (v == null ? null : v <= 1 ? v * 100 : v);
  const coma = (v: number) => v.toFixed(1).replace(".", ",");
  const ordenes: string[] = [];

  const aereoNos = pct(num(nos, "Aerial%"));
  if (aereoNos != null && aereoNos < 45) {
    /* 16/11/2026 (expertos, ronda 18): el objetivo sale de un dato, nuestra
       media de la temporada en Opta sin este partido, no de un 50 % suelto. */
    const otros = datos.partidos
      .filter((f) => f.teamId === CASTILLA_OPTA && String(f.partido ?? "") !== partido)
      .map((f) => pct(num(f, "Aerial%")))
      .filter((v): v is number => v != null);
    const media = otros.length >= 3 ? otros.reduce((a, b) => a + b, 0) / otros.length : null;
    const objetivo =
      media != null && media > aereoNos
        ? `objetivo, volver a nuestra media de la temporada, el ${coma(media)} % (Opta, ${otros.length} partidos)`
        : "objetivo, ganar más de la mitad";
    ordenes.push(
      `Duelo aéreo: ganamos el ${coma(aereoNos)} % (${rival}, el ${coma(100 - aereoNos)} %). Tarea de duelo aéreo y segunda jugada, contando los ganados en cada serie; ${objetivo}.`,
    );
  }
  const centrosNos = num(nos, "Crosses");
  const centrosEllos = num(ellos, "Crosses");
  if (centrosNos != null && centrosEllos != null && centrosEllos >= 15 && centrosEllos >= centrosNos * 1.5) {
    /* 17/11/2026 (ronda 20, fútbol): el criterio de éxito sale de un dato: los centros que nos hacen de media en los otros partidos (Opta). */
    const recibidos = datos.partidos
      .filter((f) => f.teamId !== CASTILLA_OPTA && String(f.partido ?? "") !== partido && datos.partidos.some((g) => g.teamId === CASTILLA_OPTA && g.partido === f.partido))
      .map((f) => num(f, "Crosses"))
      .filter((v): v is number => v != null);
    const mediaRecibidos = recibidos.length >= 3 ? recibidos.reduce((a, b) => a + b, 0) / recibidos.length : null;
    ordenes.push(
      `Centros: ${rival} centró ${centrosEllos} veces y nosotros ${centrosNos}. Tarea de defensa del centro lateral (cerrar al centrador y las marcas en el área), contando los centros que nos llegan al área${
        mediaRecibidos != null ? `; objetivo, que el rival no pase de nuestra media de centros recibidos, ${coma(mediaRecibidos)} (Opta, ${recibidos.length} partidos)` : ""
      }.`,
    );
  }
  const xgNos = num(nos, "ExpG");
  const xgEllos = num(ellos, "ExpG");
  if (ordenes.length < 2 && xgNos != null && xgEllos != null && xgEllos - xgNos >= 0.5) {
    ordenes.push(`Ocasiones: concedimos ${coma(xgEllos)} de xG y creamos ${coma(xgNos)}. Tarea de defensa del área y de vigilancias, contando los remates que concedemos por serie.`);
  }
  return ordenes.slice(0, 2);
}

/** Las filas del cara a cara que se ven de entrada (16/11/2026): resultado, ocasiones, llegada, centros, presión y duelo aéreo. */
const PRINCIPALES_CARA = ["Goal", "ExpG", "ShtIncBl", "SOG", "TouchOpBox", "Crosses", "PPDA", "Aerial%"];

/**
 * Un bloque de la puerta: `section > header h2`, que es lo que lee el índice
 * fijo de la pantalla (`IndiceBloques`) para ponerle su chip.
 */
function Bloque({ titulo, pregunta, sello, icono: Icono, children }: { titulo: string; pregunta: string; sello: ReactNode; icono: typeof Swords; children: ReactNode }) {
  return (
    <section className="mt-5 min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icono size={16} className="mt-0.5 shrink-0 text-[#C8A96B]" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">{titulo}</h2>
            <p className="mt-0.5 text-xs text-white/55">{pregunta}</p>
          </div>
        </div>
        {sello}
      </header>
      {children}
    </section>
  );
}

/**
 * `wyscoutCaido`: el informe de Wyscout no se ha podido leer. Entonces sólo se
 * quita lo de Wyscout, con un aviso corto, y lo de Opta sigue entero.
 */
export function PanelPostPartido({ wyscout, wyscoutCaido = false }: { wyscout: FilaPartido[]; wyscoutCaido?: boolean }) {
  const { datos, cargando } = useOpta();
  const calendario = useCalendarioCastilla();

  const optaPartidos = useMemo(() => datos?.partidos ?? [], [datos]);
  const optaEquipos = useMemo(() => datos?.equipos ?? [], [datos]);
  const temporada = useMemo(() => temporadaVigente(optaPartidos, wyscout), [optaPartidos, wyscout]);
  const lista = useMemo(() => emparejaPartidos(optaPartidos, optaEquipos, wyscout, temporada), [optaPartidos, optaEquipos, wyscout, temporada]);

  /* Por defecto, el último jugado; lo elegido se guarda por su clave. */
  const [elegido, setElegido] = useState("");
  /* 16/11/2026 (ronda 18): con `?fecha=&rival=` (Plan de partido, histórico,
     laboratorios) se abre en ese partido; lo que se elija después manda. */
  const enlace = usePartidoDeLaUrl();
  const desdeUrl = useMemo(
    () => partidoEnlazado(lista.map((p) => ({ id: p.clave, fecha: p.fecha, rival: p.rival })), enlace.fecha, enlace.rival)?.id ?? "",
    [lista, enlace.fecha, enlace.rival],
  );
  const visto = lista.find((p) => p.clave === (elegido || desdeUrl)) ?? lista[0] ?? null;
  const delVideo = useEtiquetadoEnVideo();

  /* Lo de Wyscout para el campograma: la temporada de liga y la de la categoría. */
  const nuestrosW = useMemo(() => castillaWyscout(wyscout, temporada), [wyscout, temporada]);
  const contrariosW = useMemo(() => {
    const claves = new Set(nuestrosW.map((p) => `${p.fecha}|${p.partido}`));
    return wyscout.filter((p) => p.rival === CASTILLA_WYSCOUT && claves.has(`${p.fecha}|${p.partido}`));
  }, [wyscout, nuestrosW]);
  const ligaW = useMemo(() => wyscout.filter((p) => temporadaDe(p.fecha) === temporada && /primera/i.test(p.competicion)), [wyscout, temporada]);
  const equiposW = useMemo(() => new Set(ligaW.map((p) => p.equipo)).size, [ligaW]);

  const jornadaDe = (p: PartidoPost) => (calendario ? (partidoDeFecha(calendario.partidos, p.fecha)?.jornada ?? null) : null);
  /* En casa o fuera: el calendario de BeSoccer manda; si no, el nombre del partido en Wyscout. */
  const enCasaDe = (p: PartidoPost): boolean | null => {
    const c = calendario ? partidoDeFecha(calendario.partidos, p.fecha) : null;
    if (c) return /castilla|real madrid/i.test(c.local);
    return p.wyscout ? p.wyscout.partido.startsWith(CASTILLA_WYSCOUT) : null;
  };
  /*
  | 16/11/2026 (expertos, ronda 17): el marcador, siempre el local primero,
  | como en el resto de la app («Gimnàstic Tarragona 0-1 Castilla»). Antes la
  | cabecera ponía el nuestro primero y el desplegable «Gimnàstic 1-0»: el
  | mismo partido se leía como derrota en un sitio y victoria en otro.
  */
  const marcadorLocal = (p: PartidoPost, nuestro: string) => {
    const casa = enCasaDe(p);
    const marcador = p.gf != null && p.gc != null ? (casa === false ? `${p.gc}-${p.gf}` : `${p.gf}-${p.gc}`) : "";
    const [l, v] = casa === false ? [p.rival, nuestro] : [nuestro, p.rival];
    return { local: l, visitante: v, marcador };
  };
  const etiqueta = (p: PartidoPost) => {
    const j = jornadaDe(p);
    const m = marcadorLocal(p, "Castilla");
    return `${j ? `J${j} · ` : ""}${m.local}${m.marcador ? ` ${m.marcador} ` : " - "}${m.visitante}`;
  };

  if (cargando) {
    return (
      <div className="mt-5 space-y-4" role="status" aria-label="Cargando el partido">
        <Hueso className="h-24" />
        <Hueso className="h-96" />
      </div>
    );
  }

  const avisoWyscout = wyscoutCaido && (
    <div className="mt-5">
      <Notice tone="warn" title="Wyscout no ha cargado">
        Falta «Partido en el campo»; lo de Opta sale abajo. Pulsa «Actualizar datos» para volver a intentarlo.
      </Notice>
    </div>
  );

  if (!visto) return avisoWyscout || null;

  const enCasa = enCasaDe(visto);
  const jornada = jornadaDe(visto);
  const cabecera = marcadorLocal(visto, NOMBRE_CASTILLA);
  const ordenes = visto.opta ? ordenesMicro(datos, visto.clave, visto.opta.rival ? nombreDe(visto.opta.rivalId, visto.opta.rival) : visto.rival) : [];
  const resultado =
    visto.gf == null || visto.gc == null ? "" : visto.gf > visto.gc ? "victoria" : visto.gf < visto.gc ? "derrota" : "empate";
  /* La jornada sólo si es la de verdad (la del calendario de BeSoccer). */
  const hasta = jornada ? `J${jornada}` : undefined;

  return (
    <>
      {avisoWyscout}

      {/* EL PARTIDO: el único selector, y lo que manda sobre todo lo de abajo. */}
      <div className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            {[jornada ? `Jornada ${jornada}` : "", fechaCorta(visto.fecha), enCasa === null ? "" : enCasa ? "en casa" : "fuera", resultado].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 break-words text-lg font-semibold text-white sm:text-xl">
            {cabecera.local}{" "}
            {cabecera.marcador && <span className="tabular-nums text-[#C8A96B]">{cabecera.marcador} </span>}
            {cabecera.visitante}
          </p>
        </div>
        {lista.length > 1 && (
          <Elegir
            etiqueta="Partido"
            valor={visto.clave}
            alCambiar={setElegido}
            className="min-w-0 max-w-full max-sm:w-full"
            opciones={lista.map((p) => ({ clave: p.clave, nombre: etiqueta(p) }))}
          />
        )}
      </div>

      {/* 17/11/2026 (ronda 19, análisis y marketing): desde el partido, a un
          toque y con el partido ya elegido, lo que lo completa. Sustituye al
          bloque «Visto en el vídeo» del pie. */}
      <EnlacesRapidos
        className="mt-3"
        titulo="De este partido"
        enlaces={[
          { href: delVideo?.robos(visto) ? enlaceConPartido("/laboratorio/transiciones", visto) : null, texto: "Sus robos", icono: Swords, title: "Robos y transiciones de este partido, jugada a jugada" },
          { href: delVideo?.perdidas(visto) ? enlaceConPartido("/laboratorio/perdidas", visto) : null, texto: "Sus pérdidas", icono: ShieldAlert, title: "Pérdidas y transiciones defensivas de este partido" },
          { href: delVideo?.faltas(visto) ? enlaceConPartido("/laboratorio/faltas", visto) : null, texto: "Sus faltas", icono: Timer, title: "Faltas de este partido, con cuánta gente detrás" },
          { href: urlGolesDelEquipo(NOMBRE_CASTILLA), texto: "Nuestros goles en vídeo", icono: Video },
          { href: visto.rival ? `/scout-rival-abp?equipo=${encodeURIComponent(visto.rival)}` : null, texto: `ABP de ${visto.rival}`, icono: Trophy },
          { href: "/match-plans", texto: "Vídeo del partido", icono: Film },
          { href: "/match-preparation", texto: "Plan del próximo partido", icono: ClipboardList },
        ]}
      />

      {/* 16/11/2026 (expertos, ronda 17): fuera el aviso «Wyscout aún no tiene
          este partido»: lo que no hay no se nombra; su bloque simplemente no sale. */}

      {/* 1 · OPTA: EL CARA A CARA, EL MOMENTUM Y LOS REMATES. Lo primero que
          lee el cuerpo técnico (16/11/2026: antes iba detrás del 3D). */}
      {visto.opta && datos && <BloqueOpta datos={datos} partido={visto} hasta={hasta} />}

      {/* 2 · EL PARTIDO EN RELIEVE (14/11/2026): parado en el final, con el resumen. */}
      {visto.opta && <RelieveDelPartido partido={visto.clave} titular={titular3D(datos, visto.clave, visto.opta.rival ? nombreDe(visto.opta.rivalId, visto.opta.rival) : visto.rival)} />}

      {/* 2 · WYSCOUT: EL PARTIDO EN EL CAMPO */}
      {visto.wyscout && (
        <Bloque
          titulo="Partido en el campo"
          pregunta="¿Qué pasó en cada momento, y es lo que solemos hacer?"
          icono={LayoutGrid}
          sello={<SelloFuente fuente="wyscout" poblacion={equiposW ? `liga (${equiposW} equipos)` : "informe del partido"} hasta={hasta} className="shrink-0" />}
        >
          {/* 10/11/2026: dos proveedores en la misma pantalla; sin esta línea,
              2,0 de xG aquí y 1,6 arriba parecían una contradicción. */}
          {visto.opta && (
            <p className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-snug text-white/70">
              Cifras de Wyscout: cuenta distinto que Opta (el cara a cara de arriba), así que xG, posesión o pases no coinciden. Aquí se comparan sólo con nuestra media de Wyscout.
            </p>
          )}
          <PanelCampograma
            /* Con la clave del partido: cambiarlo arriba empieza el bloque de cero. */
            key={visto.clave}
            nuestros={nuestrosW}
            contrarios={contrariosW}
            liga={ligaW}
            equipos={equiposW}
            temporada={temporada}
            fijo={`${visto.wyscout.fecha}|${visto.wyscout.rival}`}
          />
        </Bloque>
      )}

      {/* 3 · OPTA: LAS FASES ACCIÓN A ACCIÓN */}
      {visto.opta && datos && <BloqueFases datos={datos} partido={visto.clave} hasta={hasta} />}

      {/* 4 · Robos, pérdidas y faltas de este partido: arriba, en «De este partido» (17/11/2026). */}

      {/* AL PIE: QUÉ SE LLEVA A LA SEMANA */}
      <div className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.06] px-4 py-3 sm:px-5">
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
            <CalendarDays size={16} className="shrink-0 text-[#C8A96B]" />
            ¿Qué toca en el microciclo?
          </p>
          {ordenes.length > 0 && (
            <ul className="mt-1.5 space-y-1 text-[13px] leading-snug text-white/80">
              {ordenes.map((o) => (
                <li key={o}>· {o}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/microcycles" className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/85 hover:border-[#C8A96B]/50">
            Microciclo <ArrowRight size={14} />
          </Link>
          <Link href="/abp-microciclo" className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/85 hover:border-[#C8A96B]/50">
            Microciclo de ABP <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </>
  );
}

/** Las fases de Opta del partido; si su documento aún no trae el partido, el bloque no sale. */
function BloqueFases({ datos, partido, hasta }: { datos: DatosOpta; partido: string; hasta?: string }) {
  const { acciones, cargando } = useAcciones(datos);
  const delPartido = useMemo(() => acciones.filter((a) => a.nuestra && a.partido === partido), [acciones, partido]);
  const hay = delPartido.length > 0;
  /* 10/11/2026: tres ideas a la vista y el detalle plegado; la pantalla era muy larga. */
  /*
  | 11/11/2026 (experto de fútbol): las recuperaciones y las pérdidas, con los
  | MISMOS totales agregados de Opta que el cara a cara y los laboratorios de
  | robos y pérdidas (Recovery / PosWonA3rd, PossLost / PsLostD3). La cuenta
  | evento a evento daba 60 y 89 en el partido en que el resto de la app decía
  | 43 y 108. Sólo si la fila agregada falta se cae a los eventos, diciendo qué
  | cuentan.
  */
  const fila = useMemo(
    () => datos.partidos.find((f) => String(f.partido ?? "") === partido && f.teamId === CASTILLA_OPTA),
    [datos.partidos, partido],
  );
  const ideas = useMemo(() => {
    const num = (k: string) => {
      const v = fila?.[k];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    };
    const pases = delPartido.filter((a) => a.tipo === "Pass").length;
    const prog = delPartido.filter(esProgresivo).length;
    const pc = (n: number, de: number) => (de ? `${Math.round((n / de) * 100)} %` : "");
    const recT = num("Recovery");
    const recA = num("PosWonA3rd");
    const perT = num("PossLost");
    const perD = num("PsLostD3");
    const rec = delPartido.filter(esRecuperacion);
    const per = delPartido.filter(esPerdida);
    const recuperaciones =
      recT !== null && recA !== null
        ? `${recA} de ${recT} recuperaciones en el último tercio (${pc(recA, recT)})`
        : rec.length
          ? `${rec.filter((a) => alturaAccion(a.x) === "alta").length} de ${rec.length} recuperaciones en el último tercio (recuperaciones + intercepciones + entradas ganadas)`
          : "";
    const perdidas =
      perT !== null && perD !== null
        ? `${perD} de ${perT} pérdidas en nuestro primer tercio (${pc(perD, perT)})`
        : per.length
          ? `${per.filter((a) => alturaAccion(a.x) === "baja").length} de ${per.length} pérdidas en nuestro primer tercio (pases fallados + regates perdidos + robos en conducción)`
          : "";
    return [pases ? `${prog} pases progresivos de ${pases} (${pc(prog, pases)})` : "", recuperaciones, perdidas].filter(Boolean);
  }, [delPartido, fila]);
  if (!cargando && !hay) return null;
  return (
    <Bloque
      titulo="Acción a acción"
      pregunta="¿Cómo nos asociamos, cuánto progresamos y dónde robamos y perdimos?"
      icono={Footprints}
      sello={<SelloFuente fuente="opta" poblacion="evento a evento" hasta={hasta} partidos={1} className="shrink-0" />}
    >
      {ideas.length > 0 && (
        <ul className="mb-3 grid gap-2 sm:grid-cols-3">
          {ideas.map((t) => (
            <li key={t} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] font-medium leading-snug text-white/85">
              {t}
            </li>
          ))}
        </ul>
      )}
      <details className="group">
        <summary className="inline-flex min-h-[40px] cursor-pointer list-none items-center gap-1.5 rounded-xl border border-white/10 px-3 text-[13px] font-medium text-[#C8A96B] hover:border-[#C8A96B]/50 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Ver la red de pases, la progresión y dónde robamos y perdimos</span>
          <span className="hidden group-open:inline">Ocultar el detalle</span>
        </summary>
        <div className="mt-3">
          <Fases datos={datos} partidoFijo={partido} />
        </div>
      </details>
    </Bloque>
  );
}

/**
 * La lectura del cara a cara (10/11/2026): qué se creó, qué se marcó y qué
 * nos deja. Sale de las mismas filas de `opta:partidos`; si falta un dato,
 * no se escribe la frase.
 */
function LecturaCara({ datos, partido, rival }: { datos: DatosOpta; partido: string; rival: string }) {
  const filas = datos.partidos.filter((f) => String(f.partido ?? "") === partido);
  const nos = filas.find((f) => f.teamId === CASTILLA_OPTA);
  const ellos = filas.find((f) => f.teamId !== CASTILLA_OPTA);
  const num = (f: (typeof filas)[number] | undefined, k: string) => {
    const v = f?.[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const g1 = num(nos, "Goal");
  const x1 = num(nos, "ExpG");
  const r1 = num(nos, "ShtIncBl");
  const g2 = num(ellos, "Goal");
  const x2 = num(ellos, "ExpG");
  const r2 = num(ellos, "ShtIncBl");
  if (g1 == null || x1 == null || g2 == null || x2 == null) return null;

  const d1 = (v: number) => v.toFixed(1).replace(".", ",");
  const remates = (n: number | null) => (n == null ? "" : ` en ${n} ${n === 1 ? "remate" : "remates"}`);
  const goles = (n: number) => `${n} ${n === 1 ? "gol" : "goles"}`;
  const frase = `Creamos ${d1(x1)} de xG${remates(r1)} y marcamos ${goles(g1)}; ${rival}, ${d1(x2)}${remates(r2)}, y marcó ${goles(g2)}.`;

  /* Qué nos deja: sólo cuando la distancia entre lo creado y lo marcado es clara (≥ 0,8). */
  const nosFalta = x1 - g1 >= 0.8;
  const nosSobra = g1 - x1 >= 0.8;
  const aEllosSobra = g2 - x2 >= 0.8;
  const aEllosFalta = x2 - g2 >= 0.8;
  const deja = [
    nosFalta ? "Nos sobró ocasión y faltó gol: la tarea es la finalización, no generar más." : "",
    nosSobra ? "Marcamos por encima de lo que creamos: no contar con repetirlo sin más ocasiones." : "",
    aEllosSobra ? `${rival} marcó muy por encima de lo que generó: revisar en el vídeo cómo llegaron sus goles, más que su volumen.` : "",
    aEllosFalta ? `${rival} falló más de lo esperable: lo que concedimos pudo costar más.` : "",
  ].filter(Boolean);

  return (
    <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13px] leading-snug text-white/80">
      <p className="font-semibold text-white">{frase}</p>
      {deja.length > 0 && <p className="mt-1 text-white/70">{deja.join(" ")}</p>}
    </div>
  );
}

/** El cara a cara, el momentum y los remates de los dos, del partido de Opta. */
function BloqueOpta({ datos, partido, hasta }: { datos: DatosOpta; partido: PartidoPost; hasta?: string }) {
  const p = partido.opta!;
  const id = partido.clave;
  const { remates, cargando } = useRemates(datos);
  const delPartido = useMemo(() => remates.filter((r) => r.partido === id), [remates, id]);
  const lados = [
    { id: CASTILLA_OPTA, n: NOMBRE_CASTILLA },
    { id: p.rivalId, n: nombreDe(p.rivalId, p.rival) },
  ];

  return (
    <Bloque
      titulo="El partido, cara a cara"
      pregunta="¿Quién hizo más, cuándo mandó cada uno y desde dónde se remató?"
      icono={Swords}
      sello={<SelloFuente fuente="opta" poblacion="cifras del partido" hasta={hasta} partidos={1} className="shrink-0" />}
    >
      <LecturaCara datos={datos} partido={id} rival={lados[1].n} />
      {/* 16/11/2026 (expertos, ronda 17): 24 filas sin jerarquía; las 8 clave
          a la vista y el resto bajo «Ver todas las cifras». */}
      <CaraACara datos={datos} partido={id} teamId={CASTILLA_OPTA} principales={PRINCIPALES_CARA} />
      <Momentum datos={datos} partido={id} teamId={CASTILLA_OPTA} />

      {cargando ? (
        <div className="mt-5 h-64 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los remates" />
      ) : (
        delPartido.length > 0 && (
          <div className="mt-5 grid gap-5 border-t border-white/10 pt-4 lg:grid-cols-2">
            {lados.map((lado) => {
              const rs = delPartido.filter((r) => r.teamId === lado.id);
              /* 16/11/2026 (ronda 18): «xG por remate» de un partido, con la media del equipo en el resto de la temporada. */
              const resto = remates.filter((r) => r.teamId === lado.id && r.partido !== id);
              const nResto = new Set(resto.map((r) => r.partido)).size;
              const referencia = resto.length && nResto >= 3 ? { valor: resto.reduce((a, r) => a + r.xG, 0) / resto.length, partidos: nResto } : null;
              return (
                <div key={lado.id} className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold text-white">Remates de {lado.n}</h3>
                  {rs.length ? <MapaRemates remates={rs} ariaLabel={`Remates de ${lado.n} en el partido`} enContra={lado.id !== CASTILLA_OPTA} referenciaXgRemate={referencia} rotuloGoles={lado.id !== CASTILLA_OPTA ? "Nos marcaron" : undefined} maxAlto={360} lectura /> : <p className="text-sm text-white/55">No remató.</p>}
                </div>
              );
            })}
          </div>
        )
      )}
    </Bloque>
  );
}

/* El relieve del partido: lo deja scripts/opta-directo.mjs en opta:directo:<partido>. Si aún no está, el
   administrador lo pide (1-2 minutos, desde GitHub). */
/** El nombre corto del rival para el 3D: una sola palabra que diga quién es («Gimnàstic», «Murcia», «Andreu»). */
const GENERICAS = new Set(["cd", "ud", "cf", "sd", "fc", "ad", "rcd", "sad", "club", "deportivo", "de", "del", "la", "real", "union", "unión", "juventud", "balompie", "balompié"]);
function cortoRival(n: string) {
  const palabras = n.split(/\s+/).filter(Boolean);
  return palabras.find((p) => p.length > 4 && !GENERICAS.has(p.toLowerCase())) ?? palabras.find((p) => !GENERICAS.has(p.toLowerCase())) ?? n;
}

/* En el móvil el 3D va plegado (17/11/2026, ronda 19): no es lo primero que se ve. */
const MOVIL = "(max-width: 639px)";
const suscribeMovil = (avisa: () => void) => {
  const mq = window.matchMedia(MOVIL);
  mq.addEventListener("change", avisa);
  return () => mq.removeEventListener("change", avisa);
};
const useEsMovil = () => useSyncExternalStore(suscribeMovil, () => window.matchMedia(MOVIL).matches, () => false);

/**
 * El titular del 3D (17/11/2026, ronda 19, fútbol): los goles esperados del
 * MISMO dato de Opta que el cara a cara, con el Castilla primero y un decimal,
 * y quién creó más. El 3D por dentro pone al local a la izquierda.
 */
function titular3D(datos: DatosOpta | null, partido: string, rival: string) {
  const filas = datos?.partidos.filter((f) => String(f.partido ?? "") === partido) ?? [];
  const xg = (f: (typeof filas)[number] | undefined) => (typeof f?.ExpG === "number" && Number.isFinite(f.ExpG) ? f.ExpG : null);
  const nos = xg(filas.find((f) => f.teamId === CASTILLA_OPTA));
  const ellos = xg(filas.find((f) => f.teamId !== CASTILLA_OPTA));
  if (nos == null || ellos == null) return null;
  return { nos, ellos, rival: cortoRival(rival) };
}

/*
| 17/11/2026 (ronda 20, fútbol): el titular del 3D en el mismo orden que el
| marcador del propio 3D (el local primero, como el campo) y diciendo quién es
| local; el 3D (RelievePartido) no se toca.
*/
function textoTitular3D(t: { nos: number; ellos: number; rival: string }, castillaLocal: boolean | null) {
  const d1 = (v: number) => v.toFixed(1).replace(".", ",");
  const quien = Math.abs(t.nos - t.ellos) < 0.15 ? "parejo en ocasiones" : t.nos > t.ellos ? "creó más el Castilla" : `creó más el ${t.rival}`;
  const marcador =
    castillaLocal === false ? `${t.rival} ${d1(t.ellos)} – ${d1(t.nos)} Castilla` : `Castilla ${d1(t.nos)} – ${d1(t.ellos)} ${t.rival}`;
  return `Goles esperados, ${marcador}: ${quien}`;
}

function RelieveDelPartido({ partido, titular: datosTitular }: { partido: string; titular: { nos: number; ellos: number; rival: string } | null }) {
  const esMovil = useEsMovil();
  const [doc, setDoc] = useState<{ eventos?: TablaOpta; equipos?: TablaOpta } | null | undefined>(undefined);
  const [vuelta, setVuelta] = useState(0);
  const [pedido, setPedido] = useState(false);
  const { admin } = useAdmin();
  useEffect(() => {
    let vivo = true;
    void traeOpta<{ eventos?: TablaOpta; equipos?: TablaOpta }>(DOCS_OPTA.directo(partido)).then((d) => {
      if (vivo) setDoc(d);
    });
    return () => {
      vivo = false;
    };
  }, [partido, vuelta]);
  useEffect(() => {
    if (!pedido || doc?.eventos?.filas?.length) return;
    const t = window.setInterval(() => setVuelta((n) => n + 1), 20_000);
    return () => window.clearInterval(t);
  }, [pedido, doc]);
  const filas = aObjetos(doc?.equipos ?? null).sort((x, y) => (x.teamId === CASTILLA_OPTA ? -1 : y.teamId === CASTILLA_OPTA ? 1 : 0));
  /* El local primero (el campo de Opta). */
  const [x, y] = [...filas].sort((p, q) => Number(String(q.campo ?? "").toUpperCase() === "HOME") - Number(String(p.campo ?? "").toUpperCase() === "HOME"));
  /* 17/11/2026 (ronda 19, fútbol): «manda el Castilla / manda el Gimnàstic» en vez de «manda Real / manda Tarragona»: el 3D toma una palabra del nombre. */
  const nom = (f: Record<string, unknown>) => (f.teamId === CASTILLA_OPTA ? "Castilla" : cortoRival(String(f.equipo ?? "")));
  const castillaLocal = x ? x.teamId === CASTILLA_OPTA : null;
  const titular = datosTitular ? textoTitular3D(datosTitular, castillaLocal) : "";
  if (doc === undefined) return null;
  return (
    <details key={String(esMovil)} open={!esMovil} className="group mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">El partido en 3D</h3>
        {titular && <p className="mt-1 text-base font-semibold text-white">{titular}</p>}
        <p className="mb-2 mt-0.5 text-[12px] text-white/60">
          Minuto a minuto: la altura es la presión de ataque y cada pico, un remate (más alto, más xG).
          {x && y ? ` ${nom(x)}, el local, a la izquierda y primero en el marcador del 3D; ${nom(y)}, a la derecha. «Territorio» es el campo rival que pisa cada uno: en el tramo final y en todo el partido.` : ""}
          <span className="ml-1 font-medium text-[#C8A96B] group-open:hidden">Ver el 3D</span>
        </p>
      </summary>
      {doc?.eventos?.filas?.length && x && y ? (
        <RelievePartido quietoAlFinal eventos={doc.eventos} a={{ teamId: String(x.teamId ?? ""), nombre: nom(x), color: String(x.color ?? ""), campo: String(x.campo ?? "") }} b={{ teamId: String(y.teamId ?? ""), nombre: nom(y), color: String(y.color ?? ""), campo: String(y.campo ?? "") }} partido={partido} />
      ) : admin ? (
        <button
          type="button"
          disabled={pedido}
          onClick={() => {
            setPedido(true);
            void fetch("/api/opta/directo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partido, duracion: 15 }) });
          }}
          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {pedido ? "Pedido a Opta: sale aquí en 1-2 minutos…" : "Cargar el relieve y los mapas de este partido"}
        </button>
      ) : (
        <p className="text-xs text-white/50">Aún no está el evento a evento de este partido.</p>
      )}
    </details>
  );
}
