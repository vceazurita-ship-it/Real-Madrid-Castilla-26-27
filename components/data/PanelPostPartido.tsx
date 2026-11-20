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

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronDown, ClipboardList, Film, Footprints, Goal, LayoutGrid, Mountain, ShieldAlert, Swords, Timer, Trophy, Video } from "lucide-react";
import { leeEventos } from "@/lib/opta-directo-mapas";
import { retrato } from "@/lib/opta-retrato";
import { fraseCampoPisado, nombreCorto } from "@/lib/partido-frases";
import { EnlacesRapidos } from "@/components/ui/EnlacesRapidos";
import { urlGolesDelEquipo } from "@/lib/rivals/goles-en-video";
import { ClavesDelPartido, fichaJugador, pc, useLaboratorioDelPartido, type CifrasLaboratorio } from "@/components/data/ClavesDelPartido";
import { ORO, PEOR } from "@/components/data/graficas";
import { VideoOpta } from "@/components/opta/VideoOpta";
import { GolesDeSeguido } from "@/app/opta/_piezas/GolesDeSeguido";
import { useAsoma } from "@/hooks/useAsoma";

import { CaraACara } from "@/app/opta/_piezas/FichaPartido";
import { Fases } from "@/app/opta/_piezas/Fases";
import { Momentum } from "@/app/opta/_piezas/Momentum";
import { MapaRemates, type RefRemates } from "@/app/opta/_piezas/Remates";
import { Botonera, Elegir } from "@/app/opta/_piezas/comun";
import { dec, nombreDe, useAcciones, useRemates } from "@/app/opta/_piezas/eventos";
import { enArea, esProgresivo, type Remate } from "@/lib/opta-eventos";
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
type OrdenMicro = {
  id: "aereo" | "centros" | "ocasiones";
  texto: string;
  /** 18/11/2026 (ronda 22): la cifra del partido contra su referencia, dibujada en la propia tarea. */
  grafico: { rotulo: string; valor: number; media: number | null; partidos: number; porcentaje: boolean; menosEsMejor: boolean } | null;
};

function ordenesMicro(datos: DatosOpta | null, partido: string, rival: string): OrdenMicro[] {
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
  const ordenes: OrdenMicro[] = [];
  /* La misma media para el texto y para el dibujo: la de los otros partidos del Castilla en Opta. */
  const mediaDe = (vs: (number | null)[]) => {
    const ok = vs.filter((v): v is number => v != null);
    return { media: ok.length >= 3 ? ok.reduce((a, b) => a + b, 0) / ok.length : null, n: ok.length };
  };
  const delRival = (k: string) =>
    datos.partidos
      .filter((f) => f.teamId !== CASTILLA_OPTA && String(f.partido ?? "") !== partido && datos.partidos.some((g) => g.teamId === CASTILLA_OPTA && g.partido === f.partido))
      .map((f) => num(f, k));

  const aereoNos = pct(num(nos, "Aerial%"));
  if (aereoNos != null && aereoNos < 45) {
    /* 16/11/2026 (expertos, ronda 18): el objetivo sale de un dato, nuestra
       media de la temporada en Opta sin este partido, no de un 50 % suelto. */
    const { media, n } = mediaDe(datos.partidos.filter((f) => f.teamId === CASTILLA_OPTA && String(f.partido ?? "") !== partido).map((f) => pct(num(f, "Aerial%"))));
    const objetivo =
      media != null && media > aereoNos
        ? `objetivo, volver a nuestra media de la temporada, el ${coma(media)} % (Opta, ${n} partidos)`
        : "objetivo, ganar más de la mitad";
    ordenes.push({
      id: "aereo",
      texto: `Duelo aéreo: ganamos el ${coma(aereoNos)} % (${rival}, el ${coma(100 - aereoNos)} %). Tarea de duelo aéreo y segunda jugada, contando los ganados en cada serie; ${objetivo}.`,
      grafico: { rotulo: "Duelos aéreos ganados", valor: aereoNos, media, partidos: n, porcentaje: true, menosEsMejor: false },
    });
  }
  const centrosNos = num(nos, "Crosses");
  const centrosEllos = num(ellos, "Crosses");
  if (centrosNos != null && centrosEllos != null && centrosEllos >= 15 && centrosEllos >= centrosNos * 1.5) {
    /* 17/11/2026 (ronda 20, fútbol): el criterio de éxito sale de un dato: los centros que nos hacen de media en los otros partidos (Opta). */
    const { media, n } = mediaDe(delRival("Crosses"));
    ordenes.push({
      id: "centros",
      texto: `Centros: ${rival} ${centrosEllos === 1 ? "centró una vez" : `centró ${centrosEllos} veces`} y nosotros ${centrosNos}. Tarea de defensa del centro lateral (cerrar al centrador y las marcas en el área), contando los centros que nos llegan al área${
        media != null ? `; objetivo, que el rival no pase de nuestra media de centros recibidos, ${coma(media)} (Opta, ${n} partidos)` : ""
      }.`,
      grafico: { rotulo: "Centros del rival", valor: centrosEllos, media, partidos: n, porcentaje: false, menosEsMejor: true },
    });
  }
  const xgNos = num(nos, "ExpG");
  const xgEllos = num(ellos, "ExpG");
  if (ordenes.length < 2 && xgNos != null && xgEllos != null && xgEllos - xgNos >= 0.5) {
    const { media, n } = mediaDe(delRival("ExpG"));
    ordenes.push({
      id: "ocasiones",
      texto: `Ocasiones: concedimos ${coma(xgEllos)} de xG y creamos ${coma(xgNos)}. Tarea de defensa del área y de vigilancias, contando los remates que concedemos por serie.`,
      grafico: { rotulo: "xG concedido", valor: xgEllos, media, partidos: n, porcentaje: false, menosEsMejor: true },
    });
  }
  return ordenes.slice(0, 2);
}

/**
 * Las filas del cara a cara que se ven de entrada. 18/11/2026 (ronda 22,
 * análisis): cinco, las que deciden la lectura (xG, remates, a puerta,
 * toques en el área y PPDA), con la media de la temporada marcada en la
 * barra; el resultado ya lo dice la frase de arriba y el resto va plegado.
 */
const PRINCIPALES_CARA = ["ExpG", "ShtIncBl", "SOG", "TouchOpBox", "PPDA"];

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
export function PanelPostPartido({
  wyscout,
  wyscoutCaido = false,
  onIr,
}: {
  wyscout: FilaPartido[];
  wyscoutCaido?: boolean;
  /** 17/11/2026 (ronda 21): las tres claves llevan a su área de Análisis de datos. */
  onIr?: (area: string) => void;
}) {
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
  /* 17/11/2026 (ronda 21): robos y pérdidas con la cuenta de los laboratorios. */
  const lab = useLaboratorioDelPartido(visto);

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
  const nombreRival = visto.opta?.rival ? nombreDe(visto.opta.rivalId, visto.opta.rival) : visto.rival;
  const ordenes = visto.opta ? ordenesMicro(datos, visto.clave, nombreRival) : [];
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
      {/* 17/11/2026 (ronda 21): las tres conclusiones del partido, en dibujo, antes de cualquier tabla. */}
      <ClavesDelPartido datos={datos} visto={visto} rival={cortoRival(nombreRival)} lab={lab} onIr={onIr} />

      {/* 17/11/2026 (ronda 21, marketing): los botones con el mismo nombre que
          en el menú, y cada uno abre ya en este partido (o en este rival). */}
      <EnlacesRapidos
        className="mt-3"
        titulo="De este partido"
        /* 18/11/2026 (ronda 23, fútbol): robos y pérdidas salen aquí sólo si su clave de arriba no está (cada tarjeta ya lleva a su pantalla): un enlace, una vez. */
        enlaces={[
          { href: !(lab.robos && lab.robos.total > 0) && delVideo?.robos(visto) ? enlaceConPartido("/laboratorio/transiciones", visto) : null, texto: "Robos y transiciones", icono: Swords, title: "Los robos de este partido, jugada a jugada" },
          { href: !(lab.perdidas && lab.perdidas.total > 0) && delVideo?.perdidas(visto) ? enlaceConPartido("/laboratorio/perdidas", visto) : null, texto: "Pérdidas y transiciones", icono: ShieldAlert, title: "Las pérdidas de este partido y lo que hizo el rival con ellas" },
          { href: delVideo?.faltas(visto) ? enlaceConPartido("/laboratorio/faltas", visto) : null, texto: "Análisis de faltas", icono: Timer, title: "Las faltas de este partido, con cuánta gente detrás" },
          /* 18/11/2026 (analista): el pop-up de la portada con los goles de ESTE partido, los de los dos equipos; aparte, la ida a Análisis de goles. */
          {
            golesEnVideo: visto.opta && nombreRival ? { equipo: nombreRival, partido: visto.clave } : null,
            texto: "Los goles del partido en vídeo",
            icono: Video,
            title: "Los goles de este partido, de los dos equipos, de seguido o uno a uno",
          },
          { href: urlGolesDelEquipo(NOMBRE_CASTILLA), texto: "Cómo son nuestros goles", icono: Goal, title: "Todos nuestros goles de la temporada, en el campo (Análisis de goles)" },
          { href: visto.rival ? `/scout-rival-abp?equipo=${encodeURIComponent(visto.rival)}` : null, texto: `ABP del Rival · ${cortoRival(nombreRival)}`, icono: Trophy },
          { href: "/match-plans", texto: "Vídeo Análisis Partidos", icono: Film },
          { href: "/match-preparation", texto: "Plan de Partido", icono: ClipboardList },
        ]}
      />

      {/* 16/11/2026 (expertos, ronda 17): fuera el aviso «Wyscout aún no tiene
          este partido»: lo que no hay no se nombra; su bloque simplemente no sale. */}

      {/* 1 · OPTA: EL CARA A CARA, EL MOMENTUM Y LOS REMATES. Lo primero que
          lee el cuerpo técnico (16/11/2026: antes iba detrás del 3D). */}
      {visto.opta && datos && <BloqueOpta datos={datos} partido={visto} hasta={hasta} />}

      {/* 2 · EL PARTIDO EN RELIEVE (14/11/2026): parado en el final, con el resumen. */}
      {visto.opta && <RelieveDelPartido partido={visto.clave} xgFinal={xgDelPartido(datos, visto.clave)} />}

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
      {visto.opta && datos && <BloqueFases datos={datos} partido={visto.clave} hasta={hasta} lab={lab} />}

      {/* 4 · Robos, pérdidas y faltas de este partido: arriba, en «De este partido» (17/11/2026). */}

      {/* AL PIE: QUÉ SE LLEVA A LA SEMANA */}
      <div className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.06] px-4 py-3 sm:px-5">
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
            <CalendarDays size={16} className="shrink-0 text-[#C8A96B]" />
            ¿Qué toca en el microciclo?
          </p>
          {ordenes.length > 0 && datos && <TareasMicro ordenes={ordenes} datos={datos} partido={visto.clave} />}
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

/** La cifra del partido y, con una raya, su media de la temporada (18/11/2026, ronda 22: la referencia, en el dibujo). */
function BarraReferencia({ g }: { g: NonNullable<OrdenMicro["grafico"]> }) {
  const coma = (v: number) => v.toFixed(1).replace(".", ",");
  const texto = (v: number) => (g.porcentaje ? `${coma(v)} %` : Number.isInteger(v) ? String(v) : coma(v));
  const tope = g.porcentaje ? 100 : Math.max(g.valor, g.media ?? 0) * 1.15 || 1;
  const peor = g.media != null && (g.menosEsMejor ? g.valor > g.media : g.valor < g.media);
  return (
    <div className="mt-1.5 max-w-md" role="img" aria-label={`${g.rotulo}: ${texto(g.valor)} en este partido${g.media != null ? `; media de la temporada, ${texto(g.media)}` : ""}`}>
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="text-white/65">{g.rotulo}</span>
        <span className="tabular-nums text-white/85">
          <b className="font-semibold">{texto(g.valor)}</b>
          {g.media != null && (
            <span className="text-white/55">
              {" "}
              · media {texto(g.media)} ({g.partidos} partidos{g.partidos < 15 ? ", tendencia" : ""})
            </span>
          )}
        </span>
      </div>
      <div className="relative mt-1 h-2.5">
        <div className="h-full overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (g.valor / tope) * 100)}%`, background: peor ? PEOR : ORO }} />
        </div>
        {g.media != null && (
          <span aria-hidden className="absolute -inset-y-1 w-0.5 rounded-full" style={{ left: `calc(${Math.min(100, (g.media / tope) * 100)}% - 1px)`, background: "rgb(var(--rmcf-ink-rgb) / .85)" }} />
        )}
      </div>
    </div>
  );
}

/*
| LAS TAREAS DEL MICROCICLO (18/11/2026, ronda 22, fútbol): cada una con su
| cifra contra la media dibujada, el botón que copia la tarea y abre el editor
| del microciclo (precargarla exigiría tocar el editor: se pega en la sesión)
| y, si Opta los tiene, los vídeos de esas acciones del partido.
*/
function TareasMicro({ ordenes, datos, partido }: { ordenes: OrdenMicro[]; datos: DatosOpta; partido: string }) {
  const { acciones } = useAcciones(datos);
  const [copiada, setCopiada] = useState("");
  const clips = useMemo(() => {
    const del = acciones.filter((a) => a.partido === partido);
    return {
      /* Centros del rival: pase desde la banda, en nuestro último tercio, que cae en el área. */
      centros: del.filter((a) => !a.nuestra && a.tipo === "Pass" && a.x >= 66.7 && (a.y < 21.1 || a.y > 78.9) && a.finX != null && a.finY != null && enArea(a.finX, a.finY)),
      aereo: del.filter((a) => a.nuestra && a.tipo === "Aerial"),
      ocasiones: [] as typeof del,
    };
  }, [acciones, partido]);

  return (
    <ul className="mt-1.5 space-y-3 text-[13px] leading-snug text-white/80">
      {ordenes.map((o) => {
        const suyos = clips[o.id];
        return (
          <li key={o.id} className="min-w-0">
            <p>{o.texto}</p>
            {o.grafico && <BarraReferencia g={o.grafico} />}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                href="/laboratorio/microciclo"
                onClick={() => {
                  void navigator.clipboard?.writeText(o.texto).then(
                    () => setCopiada(o.id),
                    () => setCopiada(""),
                  );
                }}
                title="Copia la tarea (qué, cómo se cuenta y el objetivo) y abre el editor del microciclo para pegarla en la sesión"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 text-[12px] font-semibold text-[#C8A96B] hover:bg-[#C8A96B]/20"
              >
                Llevar al microciclo <ArrowRight size={13} />
              </Link>
              {copiada === o.id && <span className="text-[12px] text-white/60">Tarea copiada: pégala en la sesión.</span>}
            </div>
            {suyos.length > 0 && (
              <details className="group mt-2">
                <summary className="inline-flex min-h-[36px] cursor-pointer list-none items-center rounded-lg text-[12px] font-medium text-[#C8A96B] [&::-webkit-details-marker]:hidden">
                  {o.id === "centros"
                    ? `▶ ${suyos.length === 1 ? "El centro" : `Los ${suyos.length} centros`} del rival en vídeo (Opta)`
                    : `▶ ${suyos.length === 1 ? "El duelo aéreo" : `Los ${suyos.length} duelos aéreos`} en vídeo (Opta)`}
                </summary>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {suyos.map((a, i) => (
                    <VideoOpta
                      key={`${a.parte}-${a.segundo}-${i}`}
                      evento={a}
                      tipo={o.id === "centros" ? "passes" : "touches"}
                      etiqueta={`▶ ${a.minuto}′`}
                      descripcion={`${o.id === "centros" ? "Centro" : "Duelo aéreo"} de ${a.jugador || "un jugador"}, ${a.minuto}′`}
                    />
                  ))}
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Las fases de Opta del partido; si su documento aún no trae el partido, el bloque no sale. */
function BloqueFases({
  datos,
  partido,
  hasta,
  lab,
}: {
  datos: DatosOpta;
  partido: string;
  hasta?: string;
  lab: { robos: CifrasLaboratorio | null; perdidas: CifrasLaboratorio | null };
}) {
  const { acciones, cargando } = useAcciones(datos);
  const delPartido = useMemo(() => acciones.filter((a) => a.nuestra && a.partido === partido), [acciones, partido]);
  const hay = delPartido.length > 0;
  /* 10/11/2026: tres ideas a la vista y el detalle plegado; la pantalla era muy larga. */
  /*
  | 17/11/2026 (ronda 21, análisis): robos y pérdidas con la MISMA cuenta,
  | nombre y cifra que /laboratorio/transiciones y /laboratorio/perdidas
  | (lib/transiciones/partidos-laboratorio.ts): el vídeo etiquetado y, si aún
  | no lo está, el evento a evento de Opta en juego. Antes se daban las
  | «recuperaciones» y «pérdidas» agregadas de Opta (28 y 99 en la J12 frente
  | a los 40 robos y 65 pérdidas de los laboratorios): dos cifras para lo
  | mismo. Si el laboratorio no tiene el partido, no se dice nada.
  */
  const ideas = useMemo(() => {
    const pases = delPartido.filter((a) => a.tipo === "Pass").length;
    const prog = delPartido.filter(esProgresivo).length;
    /*
    | 18/11/2026 (ronda 22): el mismo porcentaje, con un decimal, que las tres
    | claves; y los robos en campo rival y las pérdidas en campo propio ya no se
    | repiten aquí (17,5 % arriba y 18 % abajo): están en las tres claves.
    | Sólo si las claves no los tienen, salen aquí.
    */
    const enClaves = !!lab.robos?.total && !!lab.perdidas?.total;
    const robos = lab.robos && !enClaves ? `${lab.robos.clave} de ${lab.robos.total} robos en campo rival (${pc(lab.robos.clave, lab.robos.total)})` : "";
    const perdidas = lab.perdidas && !enClaves ? `${lab.perdidas.clave} de ${lab.perdidas.total} pérdidas en campo propio (${pc(lab.perdidas.clave, lab.perdidas.total)})` : "";
    return [pases ? `${prog} pases progresivos de ${pases} (${pc(prog, pases)})` : "", robos, perdidas].filter(Boolean);
  }, [delPartido, lab]);
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
      <CaraACara datos={datos} partido={id} teamId={CASTILLA_OPTA} principales={PRINCIPALES_CARA} conMedia />
      {!cargando && <GolesDelPartidoEnVideo goles={delPartido.filter((r) => r.gol)} />}

      {/*
      | 20/11/2026 (ronda 4, marketing): «El partido» pasaba de tres pantallas.
      | A la vista, las claves, el cara a cara y los goles en vídeo; los tramos
      | y la lista de remates, tras «Ver más» (el 3D ya iba plegado).
      */}
      <details className="group mt-5 min-w-0 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
        <summary className="cursor-pointer list-none text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Ver más: quién mandó en cada tramo y todos los remates ▾</span>
          <span className="hidden group-open:inline">Plegar los tramos y los remates ▴</span>
        </summary>
        {/* Los goleadores ya van en la lista de remates de abajo (con su ficha y su vídeo): aquí, sólo en el dibujo. */}
        <Momentum datos={datos} partido={id} teamId={CASTILLA_OPTA} conGoleadores={false} />
        {cargando ? (
          <div className="mt-5 h-64 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los remates" />
        ) : (
          delPartido.length > 0 && <RematesDelPartido delPartido={delPartido} remates={remates} lados={lados} partido={id} rivalApp={partido.rival} />
        )}
      </details>
    </Bloque>
  );
}

/*
| LOS REMATES DE LOS DOS, EN UNA TARJETA (18/11/2026, ronda 22, marketing):
| antes, dos columnas que doblaban la altura. Ahora una pestaña Castilla /
| rival con el mapa, sus cifras contra la temporada y, debajo, cada remate con
| su tirador (a su ficha: la nuestra en Individual, la del rival en Scout
| individual) y su vídeo en Opta. Los goles, siempre a la vista; el resto,
| plegado.
*/
type Lado = { id: string; n: string };

function RematesDelPartido({ delPartido, remates, lados, partido, rivalApp }: { delPartido: Remate[]; remates: Remate[]; lados: Lado[]; partido: string; rivalApp: string }) {
  const [elegido, setElegido] = useState(lados[0].id);
  const lado = lados.find((l) => l.id === elegido) ?? lados[0];
  const nuestro = lado.id === CASTILLA_OPTA;
  const rs = useMemo(() => delPartido.filter((r) => r.teamId === lado.id).sort((a, b) => a.parte - b.parte || a.segundo - b.segundo), [delPartido, lado.id]);
  /* La temporada del equipo sin este partido: xG por remate y, por partido, xG y remates. */
  const referencia = useMemo<RefRemates | null>(() => {
    const resto = remates.filter((r) => r.teamId === lado.id && r.partido !== partido);
    const n = new Set(resto.map((r) => r.partido)).size;
    if (!resto.length || n < 3) return null;
    const xg = resto.reduce((a, r) => a + r.xG, 0);
    return { valor: xg / resto.length, partidos: n, xgPartido: xg / n, rematesPartido: resto.length / n };
  }, [remates, lado.id, partido]);
  const fichaDe = (tirador: string) =>
    nuestro ? fichaJugador(tirador) : `/scout-rival-individual?equipo=${encodeURIComponent(rivalApp)}&jugador=${encodeURIComponent(tirador)}`;
  const goles = rs.filter((r) => r.gol);
  const otros = rs.filter((r) => !r.gol);
  const fila = (r: Remate, i: number) => (
    <li key={`${r.parte}-${r.segundo}-${i}`} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-1 text-[12.5px]">
      <span className="w-9 shrink-0 font-semibold tabular-nums text-white/75">{r.minuto}′</span>
      {r.tirador ? (
        <Link href={fichaDe(r.tirador)} className="min-w-0 font-semibold text-[#C8A96B] underline-offset-2 hover:underline" title={nuestro ? "Su ficha en Individual" : "Su ficha en Scout rival individual"}>
          {r.tirador}
        </Link>
      ) : null}
      <span className={r.gol ? "font-semibold text-white" : "text-white/60"}>
        {r.gol ? (nuestro ? "Gol" : "Gol en contra") : r.tipo === "Post" ? "Al palo" : r.aPuerta ? "A puerta" : "Fuera o bloqueado"}
      </span>
      <span className="tabular-nums text-white/55">xG {dec(r.xG)}</span>
      <VideoOpta evento={r} tipo="shots" etiqueta="▶ Vídeo en Opta" descripcion={`Remate de ${r.tirador}, ${r.minuto}′`} />
    </li>
  );

  return (
    <div className="mt-5 min-w-0 border-t border-white/10 pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Remates del partido</h3>
        <Botonera etiqueta="De qué equipo" valor={lado.id} alCambiar={setElegido} opciones={lados.map((l) => ({ clave: l.id, nombre: l.n }))} />
      </div>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0">
          {rs.length ? (
            <MapaRemates
              key={lado.id}
              remates={rs}
              ariaLabel={`Remates de ${lado.n} en el partido`}
              enContra={!nuestro}
              referenciaXgRemate={referencia}
              rotuloGoles={!nuestro ? "Nos marcaron" : undefined}
              maxAlto={360}
              lectura
            />
          ) : (
            <p className="text-sm text-white/55">No remató.</p>
          )}
        </div>
        {rs.length > 0 && (
          <div className="min-w-0">
            {goles.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{goles.length === 1 ? "El gol" : `Los ${goles.length} goles`}</p>
                <ol className="mt-1 divide-y divide-white/[0.06]">{goles.map(fila)}</ol>
              </>
            )}
            {otros.length > 0 && (
              <details className="group mt-2">
                <summary className="inline-flex min-h-[36px] cursor-pointer list-none items-center rounded-lg text-[12px] font-medium text-[#C8A96B] [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">
                    {goles.length
                      ? otros.length === 1
                        ? "Ver el otro remate, con su vídeo"
                        : `Ver los otros ${otros.length} remates, con su vídeo`
                      : otros.length === 1
                        ? "Ver el remate, con su vídeo"
                        : `Ver los ${otros.length} remates, uno a uno, con su vídeo`}
                  </span>
                  <span className="hidden group-open:inline">Ocultar los remates</span>
                </summary>
                <ol className="mt-1 divide-y divide-white/[0.06]">{otros.map(fila)}</ol>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/*
| LOS GOLES DEL PARTIDO EN VÍDEO (17/11/2026, ronda 21, análisis): antes el
| botón llevaba a todos nuestros goles de la temporada en Análisis de goles;
| ahora se ven aquí, los de este partido y de los dos equipos, con el mismo
| reproductor (`GolesDeSeguido`: corte de Opta o resumen de la RFEF). Se pide
| al asomar. Sin goles, no sale.
*/
function GolesDelPartidoEnVideo({ goles }: { goles: Remate[] }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>();
  const lista = useMemo(() => [...goles].sort((a, b) => a.minuto - b.minuto), [goles]);
  if (!lista.length) return null;
  return (
    <div ref={caja} id="goles-del-partido" className="mt-5 min-w-0 scroll-mt-44 border-t border-white/10 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-white">Los goles del partido en vídeo</h3>
      {abierto ? (
        <GolesDeSeguido goles={lista} titulo={lista.length === 1 ? "El gol del partido" : `Los ${lista.length} goles del partido`} conLista />
      ) : (
        <div className="h-40 rounded-2xl bg-white/[0.04]" />
      )}
    </div>
  );
}

/* El relieve del partido: lo deja scripts/opta-directo.mjs en opta:directo:<partido>. Si aún no está, el
   administrador lo pide (1-2 minutos, desde GitHub). */
/** El nombre corto del rival («Gimnàstic», «Murcia», «Andreu»): el mismo que la portada (lib/partido-frases). */
const cortoRival = nombreCorto;

/** Los goles esperados del partido por equipo, de la fila de Opta del cara a cara (para el panel del 3D). */
function xgDelPartido(datos: DatosOpta | null, partido: string): Record<string, number> | undefined {
  const filas = datos?.partidos.filter((f) => String(f.partido ?? "") === partido) ?? [];
  const m: Record<string, number> = {};
  for (const f of filas) if (typeof f.ExpG === "number" && Number.isFinite(f.ExpG)) m[String(f.teamId ?? "")] = f.ExpG;
  return Object.keys(m).length ? m : undefined;
}

/*
| EL PARTIDO EN 3D (18/11/2026, ronda 23, fútbol y guionista): plegado tras
| «Ver en 3D», como en la portada, con la conclusión a la vista: la MISMA
| frase del campo pisado que la portada (`fraseCampoPisado`). Dentro, el
| Castilla a la izquierda y primero en el marcador (`nuestroALaIzquierda`),
| en el mismo orden que el cara a cara. Se monta al pulsar.
*/
function RelieveDelPartido({ partido, xgFinal }: { partido: string; xgFinal?: Record<string, number> }) {
  const [doc, setDoc] = useState<{ eventos?: TablaOpta; equipos?: TablaOpta } | null | undefined>(undefined);
  const [vuelta, setVuelta] = useState(0);
  const [pedido, setPedido] = useState(false);
  const [ver3d, setVer3d] = useState(false);
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
  /* El Castilla primero. */
  const [x, y] = aObjetos(doc?.equipos ?? null).sort((p, q) => (p.teamId === CASTILLA_OPTA ? -1 : q.teamId === CASTILLA_OPTA ? 1 : 0));
  /* 17/11/2026 (ronda 19, fútbol): «manda el Castilla / manda el Gimnàstic»: el 3D toma una palabra del nombre. */
  const nom = (f: Record<string, unknown>) => (f.teamId === CASTILLA_OPTA ? "Castilla" : cortoRival(String(f.equipo ?? "")));
  const idX = x ? String(x.teamId ?? "") : "";
  const idY = y ? String(y.teamId ?? "") : "";
  const nomX = x ? nom(x) : "";
  const nomY = y ? nom(y) : "";
  const frase = useMemo(() => {
    if (!doc?.eventos?.filas?.length || !idX || !idY) return null;
    return fraseCampoPisado(retrato(leeEventos(doc.eventos), idX, idY), nomX, nomY, idX === CASTILLA_OPTA);
  }, [doc, idX, idY, nomX, nomY]);
  if (doc === undefined) return null;
  const hay = !!(doc?.eventos?.filas?.length && x && y);
  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4" aria-label="El partido en 3D">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">El partido en 3D</h3>
      <div className="mt-1 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-[260px] text-[15px] font-semibold leading-snug text-white">
          {frase ?? "Quién mandó en cada tramo y dónde llegaron los remates, minuto a minuto."}
        </p>
        {hay && (
          <button
            type="button"
            onClick={() => setVer3d((v) => !v)}
            aria-expanded={ver3d}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 px-3.5 text-[13px] font-semibold text-[#C8A96B] hover:border-[#C8A96B]/50"
          >
            <Mountain className="h-4 w-4" aria-hidden />
            {ver3d ? "Plegar el 3D" : "Ver en 3D"}
            <ChevronDown className={`h-4 w-4 transition-transform ${ver3d ? "rotate-180" : ""}`} aria-hidden />
          </button>
        )}
      </div>
      {hay && ver3d ? (
        <>
          <p className="mb-2 mt-2 text-[12px] text-white/60">
            Minuto a minuto: la altura es la presión de ataque y cada pico, un remate (más alto, más xG). {nomX}, a la izquierda y primero en el marcador del 3D; {nomY}, a la derecha.
          </p>
          <RelievePartido
            quietoAlFinal
            nuestroALaIzquierda
            xgFinal={xgFinal}
            eventos={doc!.eventos}
            a={{ teamId: idX, nombre: nomX, color: String(x.color ?? ""), campo: String(x.campo ?? "") }}
            b={{ teamId: idY, nombre: nomY, color: String(y.color ?? ""), campo: String(y.campo ?? "") }}
            partido={partido}
          />
        </>
      ) : !hay && admin ? (
        <button
          type="button"
          disabled={pedido}
          onClick={() => {
            setPedido(true);
            void fetch("/api/opta/directo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partido, duracion: 15 }) });
          }}
          className="mt-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {pedido ? "Pedido a Opta: sale aquí en 1-2 minutos…" : "Cargar el relieve y los mapas de este partido"}
        </button>
      ) : null}
    </section>
  );
}
