"use client";

/**
 * Competición · Análisis de faltas.
 *
 * Qué mide, y por qué sólo eso: **dónde se comete cada falta** y **cuánta
 * gente defendía en ese momento entre la falta y la portería que se ataca**.
 * Con esas dos cosas se contesta a lo que se pregunta el lunes —dónde nos
 * pitan, dónde pitamos nosotros y con qué defensa enfrente— sin pedirle al que
 * mira el vídeo veinte campos por jugada, que es como se abandonan estos
 * recuentos.
 *
 * El número que manda es **cuántos defensores hay entre la falta y su propia
 * portería, portero incluido**. Una falta en el mismo sitio no vale lo mismo
 * con nueve por delante que con tres: lo primero es un balón parado contra un
 * bloque hecho y lo segundo es una transición que se ha cortado con falta. De
 * ahí el apartado de «faltas que cortaron algo», que es el que de verdad se
 * lleva a la charla.
 *
 * De dónde salen los datos: NO hay proveedor. Se etiquetan viendo el partido
 * falta a falta, con el mismo método que los robos y los saques de banda.
 * `scripts/abp-clips-preparar.mjs` prepara la carpeta y
 * `scripts/faltas-datos.mjs` convierte los CSV en `lib/faltas/datos.ts`.
 *
 * El campo y la tabla van atados: se pasa por encima de un punto y se enciende
 * su fila, y al revés. Con veintitantas faltas es la diferencia entre mirar el
 * dibujo y entenderlo.
 *
 * Está en obras porque el recuento es de un partido: con una jornada no hay
 * tendencia que leer, y la pantalla lo dice en vez de dibujar porcentajes que
 * suenan a verdad.
 *
 * Todo lo que se pincha filtra (`components/faltas/FiltrosCruzados.tsx`): una
 * casilla o un rótulo del campo, una barra de distancia, un número de
 * defensores, cualquier celda de la tabla. El lado sigue siendo el mando de
 * siempre (`filtro`), y pinchar un «A favor» en cualquier sitio lo mueve; el
 * resto vive en `filtros`. La barra de «Filtrando» enseña los dos juntos.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, ClipboardList, Crosshair, FileText, LayoutDashboard, List, Map as MapIcon, Shield, Swords, Users, Zap } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { cn } from "@/lib/utils";
import { AbpHeader, Panel } from "@/components/abp/ui";
import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { FrenteAlRival } from "@/components/analisis/FrenteAlRival";
import { ConmutadorVista, TituloConclusion, useVistaAnalisis } from "@/components/ui/VistaVisual";
import { ComparativaPartido, UMBRAL_TENDENCIA_PARTIDOS, numeroCorto, type MetricaComparada } from "@/components/abp/ComparativaPartido";
import { SelloDeFechas } from "@/components/data/SelloJornada";
import { ultimoPorFecha } from "@/lib/abp/ultimo-partido";
import { PARTIDOS as PARTIDOS_ETIQUETADOS, type Falta, type LadoFalta } from "@/lib/faltas/datos";
import { useRespaldoOpta } from "@/lib/opta-respaldo/cliente";
import { fechaEtiquetada } from "@/lib/opta-respaldo/etiquetado";
import { enlaceOptaDe, esDeOpta, type PartidoFaltasOpta } from "@/lib/opta-respaldo/tipos";
import { SelloOpta } from "@/components/opta-respaldo/SelloOpta";
import { CORTE_TRANSICION, aFavor, comparativaFaltas, cortaTransicion, decimal, enContra, laQueMas } from "@/lib/faltas/lectura";
import { CampoFaltas, CARRILES_CAMPO, sitioEnCampo, ZONAS_CAMPO } from "@/components/faltas/CampoFaltas";
import { ComoActualizar } from "@/components/faltas/ComoActualizar";
import { OptaLaboratorio } from "@/components/opta-partido/OptaLaboratorio";
import { partidoEnlazado, usePartidoDeLaUrl } from "@/lib/partido-enlazado";
import { EnlacesRapidos } from "@/components/ui/EnlacesRapidos";
import { BarrasFrenteAMedia } from "@/components/analisis/BarrasFrenteAMedia";
import { useAhora, useCalendario } from "@/hooks/useCalendario";
import { proximoPartido } from "@/lib/castilla/calendario";
import { nombreEquipo } from "@/lib/equipos";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { enlaceConPartido, urlPostDelPartido } from "@/lib/post-partido";
import { VerAccion } from "@/components/video/VerAccion";
import { opcionesDeAccion, useMenuAccion } from "@/components/video/MenuAccion";
import { PorJugador, SinJugador, type ColumnaJugador } from "@/components/analisis/PorJugador";
import {
  BarraFiltros,
  Filtrable,
  TITULO_FILTRO,
  esPretemporada,
  estaActivo,
  hayFiltro,
  marcaPieza,
  pasaFiltros,
  useFiltrosCruzados,
  type ChipFiltro,
} from "@/components/faltas/FiltrosCruzados";
import {
  Conclusiones,
  Explicativo,
  useTextosExplicativos,
} from "@/components/ui/textos-analisis";

const DISTANCIAS = ["frontal", "media", "lejana"];

const TINTA_LADO: Record<LadoFalta, string> = {
  ofensivo: "#C8A96B",
  defensivo: "#F6AFB6",
};

/* Para el TEXTO de las chapas (19/10/2026): el oro y el rosa claros, sobre la
   tarjeta del modo día, se quedaban en 1,7-2:1. Mezclados con la tinta del
   tema oscurecen de día y aclaran de noche solos. */
const TEXTO_LADO: Record<LadoFalta, string> = {
  ofensivo: "var(--rmcf-gold-ink)",
  defensivo: "color-mix(in srgb, #E8707C 60%, rgb(var(--rmcf-ink-rgb)))",
};

const NOMBRE_LADO: Record<LadoFalta, string> = {
  ofensivo: "A favor",
  defensivo: "En contra",
};

type Filtro = "todas" | LadoFalta;

/** Cómo se lee cada dimensión pinchable de una falta. */
/*
| La zona y el carril se leen en el campo de verdad, con el Castilla atacando
| hacia la derecha (05/10/2026), igual que los dibuja el campo: así «campo
| rival» quiere decir lo mismo en una falta nuestra que en una del rival.
| El etiquetado los guarda hacia la portería de quien saca (`sitioEnCampo`).
*/
const LECTORES: Record<string, (f: Falta) => string> = {
  zona: (f) => sitioEnCampo(f).zona,
  carril: (f) => sitioEnCampo(f).carril,
  distancia: (f) => f.distancia,
  entre: (f) => (f.entre === null ? "?" : String(f.entre)),
  /* El nuestro: el que la comete (en contra) o el que la recibe (a favor). */
  jugador: (f) => f.jugador ?? "",
};

/** El rótulo de cada dimensión en la barra de «Filtrando». */
const ROTULO: Record<string, string> = {
  zona: "Zona del campo",
  carril: "Carril",
  distancia: "Distancia",
  entre: "Defendían",
  jugador: "Jugador",
};

/** "12'03\" (táctica 12:58)", o nada cuando no se sabe (nunca un guion). */
const minutoDe = (f: Falta) => f.minuto?.trim() || "";

/** Sin el segundo del vídeo táctico, que es del método: "12'03\" (táctica 12:58)" → "12'03\"". */
const minutoCorto = (f: Falta) => minutoDe(f).replace(/\s*\(t[aá]ctica[^)]*\)/i, "");

/* Las vistas de la pantalla: resumen, el campo, el detalle y la lista. */
const VISTAS = ["resumen", "campo", "detalle", "jugadores", "lista"] as const;

/* ------------------------------------------------------------------ */
/*  Por jugador (19/10/2026)                                           */
/* ------------------------------------------------------------------ */

type FaltaVista = Falta & { partido: string };

/*
| Lo que pregunta el entrenador de cada jugador: cuántas comete y cuántas
| recibe, dónde, y cuáles traen peligro. El etiquetado NO apunta en qué
| acaba la falta, así que «peligro» se lee por el sitio: una en contra
| frontal o en nuestro campo es un balón parado para el rival; una a favor
| en campo rival o frontal, uno para nosotros.
*/
const COLUMNAS_COMETE: ColumnaJugador<FaltaVista>[] = [
  { clave: "comete", rotulo: "Comete", explica: "Faltas en contra que hace él", cumple: enContra, sobre: null, color: TEXTO_LADO.defensivo },
  { tipo: "zonas", clave: "dondeComete", rotulo: "Dónde comete", explica: "Tercio y carril de sus faltas en contra, con el Castilla atacando hacia la derecha", cumple: enContra },
  { clave: "cometeNuestro", rotulo: "En nuestro campo", explica: "Faltas en contra en nuestro primer tercio", cumple: (f) => enContra(f) && sitioEnCampo(f).zona === "nuestro campo", sobre: enContra, color: TEXTO_LADO.defensivo },
  { clave: "cometeFrontal", rotulo: "Frontales", explica: "Faltas en contra de cara a nuestra portería: las de más peligro", cumple: (f) => enContra(f) && f.distancia === "frontal", sobre: enContra, color: TEXTO_LADO.defensivo },
  { clave: "corta", rotulo: "Cortan contra", explica: `Faltas en contra con ${CORTE_TRANSICION} defensores o menos del rival por delante, fuera del último tercio: frenó una transición`, cumple: (f) => enContra(f) && cortaTransicion(f), sobre: enContra },
];

const COLUMNAS_RECIBE: ColumnaJugador<FaltaVista>[] = [
  { clave: "recibe", rotulo: "Recibe", explica: "Faltas a favor que le hacen a él", cumple: aFavor, sobre: null, color: TEXTO_LADO.ofensivo },
  { tipo: "zonas", clave: "dondeRecibe", rotulo: "Dónde recibe", explica: "Tercio y carril de las faltas que le hacen, con el Castilla atacando hacia la derecha", cumple: aFavor },
  { clave: "recibeRival", rotulo: "En campo rival", explica: "Faltas a favor en el último tercio: balón parado de ataque", cumple: (f) => aFavor(f) && sitioEnCampo(f).zona === "campo rival", sobre: aFavor, color: TEXTO_LADO.ofensivo },
  { clave: "recibeFrontal", rotulo: "Frontales", explica: "Faltas a favor de cara a la portería rival", cumple: (f) => aFavor(f) && f.distancia === "frontal", sobre: aFavor, color: TEXTO_LADO.ofensivo },
];

const jugadorDeFalta = (f: FaltaVista) => f.jugador ?? "";
const partidoDeFalta = (f: FaltaVista) => f.partido;

/* 29/10/2026: todas las jornadas se rotulan «J6», como en Robos y Pérdidas («LIGA 06» pasa a «J6»). */
/* Una fila de recuento con muy pocos casos en el partido y en la media: se pliega. */
const escasa = (m: { tendencia?: boolean; actual: number | null; media: number | null }) =>
  Boolean(m.tendencia) && Math.max(m.actual ?? 0, m.media ?? 0) <= 2;

const jornadaCorta = (j: string) => {
  const m = j.trim().match(/^(?:LIGA|J)\s*0*(\d+)$/i);

  return m ? `J${m[1]}` : j;
};

/** Si hay algún partido de pretemporada en los datos (hoy, ninguno). */
const HAY_PRETEMPORADA = PARTIDOS_ETIQUETADOS.some((p) => esPretemporada(p.jornada));

/* 30/10/2026: las fechas con faltas etiquetadas, para el sello «Datos hasta la J·». */
const FECHAS_FALTAS = PARTIDOS_ETIQUETADOS.filter((p) => p.faltas.length > 0).map((p) => p.fecha);

/** "2026-09-21" → "21 sep". */
function fechaCorta(iso: string) {
  const fecha = new Date(`${iso}T12:00:00`);

  if (Number.isNaN(fecha.getTime())) return iso;

  return fecha
    .toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    .replace(".", "");
}

export default function FaltasPage() {
  const explicativos = useTextosExplicativos();
  const [vista, setVista] = usePestanaUrl("vista", VISTAS, "resumen");
  /*
  | VISUAL / DETALLE (16/11/2026, petición del analista). En «Visual» (lo que se
  | abre): el partido frente a los anteriores y el campo con cada falta, con su
  | conclusión en el título. «Detalle» es la pantalla de siempre.
  */
  const [vistaPantalla, setVistaPantalla] = useVistaAnalisis("laboratorio-faltas");
  const enVisual = vistaPantalla === "visual";
  /* 17/11/2026 (ronda 19): el próximo rival, para su balón parado a un toque. */
  const { partidos: calendarioFaltas } = useCalendario();
  const relojFaltas = useAhora();
  /* 21/11/2026: el próximo con la regla de la portada (`proximoPartido`, hora de Madrid y 2,5 h de gracia), no «el primero sin marcador». */
  const proximoRivalFaltas = useMemo(
    () => nombreEquipo(proximoPartido(calendarioFaltas, relojFaltas)?.rival ?? ""),
    [calendarioFaltas, relojFaltas],
  );
  const [filtro, setFiltro] = useState<Filtro>("todas");
  /*
  | La pretemporada, fuera salvo que se pida: los amistosos no se leen igual
  | que la liga. Hoy no hay ninguno en los datos y el mando ni sale.
  */
  const [conPretemporada, setConPretemporada] = useState(false);

  /*
  | RESPALDO DE OPTA (17/11/2026): el partido que aún no está etiquetado en
  | Hudl sale de las faltas del evento a evento de Opta (quién la hace, sobre
  | quién, zona, carril y distancia), con el sello «Desde Opta». En cuanto se
  | etiqueta, manda lo etiquetado.
  */
  const respaldo = useRespaldoOpta<PartidoFaltasOpta>("faltas", FECHAS_FALTAS);
  /* 17/11/2026 (ronda 20): además de la fecha, la misma jornada y el mismo club que uno etiquetado no entra dos veces. */
  const PARTIDOS = useMemo(
    () => [
      ...PARTIDOS_ETIQUETADOS,
      ...respaldo.filas.filter(
        (o) =>
          o.faltas.length > 0 &&
          !fechaEtiquetada(o.fecha, FECHAS_FALTAS) &&
          !PARTIDOS_ETIQUETADOS.some((p) => p.jornada === o.jornada && mismoClub(p.rival, o.rival)),
      ),
    ],
    [respaldo.filas],
  );

  const partidosVisibles = useMemo(
    () => (conPretemporada ? PARTIDOS : PARTIDOS.filter((p) => !esPretemporada(p.jornada))),
    [PARTIDOS, conPretemporada],
  );
  const fechasVisibles = useMemo(() => partidosVisibles.map((p) => p.fecha), [partidosVisibles]);
  const algunoOpta = partidosVisibles.some((p) => p.faltas.some(esDeOpta));

  /*
  | Se abre por el último partido analizado: el lunes se quiere ver lo del
  | domingo, no la primera jornada. Si al quitar la pretemporada el elegido
  | desaparece, se vuelve al último de los que quedan.
  */
  /* 10/11/2026: con `?fecha=&rival=` (de «Post del partido») se abre en ese partido; lo que se elija después manda. */
  const enlace = usePartidoDeLaUrl();
  const [partidoSuelto, setPartidoId] = useState<string | null>(null);
  const partidoId = partidoSuelto ?? partidoEnlazado(partidosVisibles, enlace.fecha, enlace.rival)?.id ?? ultimoPorFecha(partidosVisibles)?.id ?? "";

  /** Los botones de partido, en el orden en que se jugaron (como en Robos y Pérdidas). */
  const partidosEnOrden = useMemo(
    () => [...partidosVisibles].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [partidosVisibles],
  );

  /** «Por jugador»: el partido elegido o la temporada (los partidos con jugador). */
  const [ambito, setAmbito] = useState<"partido" | "temporada">("partido");

  /** La falta que está encendida, compartida entre el campo y la tabla. */
  const [resaltada, setResaltada] = useState<string | null>(null);
  /* El menú de cada falta del campo: su vídeo, Hudl y su fila (04/11/2026). */
  const { abre: abreMenu, menu: menuAccion } = useMenuAccion();

  /** Lo que se ha pinchado: zona, carril, distancia y defensores. */
  const { filtros, alterna, alternaVarios, quita, limpia } = useFiltrosCruzados();

  const partido = useMemo(
    () =>
      partidosVisibles.find((p) => p.id === partidoId) ?? ultimoPorFecha(partidosVisibles),
    [partidoId, partidosVisibles],
  );

  /* 17/11/2026 (ronda 20): el partido elegido sale de Opta; los rótulos lo dicen. */
  const partidoDeOpta = Boolean(partido?.faltas.some(esDeOpta));
  /* Y el que más faltas comete en él, a un toque (como en robos y pérdidas). */
  const masFaltas = (() => {
    const cuenta = new Map<string, number>();
    for (const f of partido?.faltas ?? []) if (f.lado !== "ofensivo" && f.jugador) cuenta.set(f.jugador, (cuenta.get(f.jugador) ?? 0) + 1);
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))[0] ?? null;
  })();
  const anterioresOpta = partido
    ? partidosVisibles.filter((p) => p.fecha < partido.fecha && p.faltas.some(esDeOpta)).length
    : 0;

  /** Pinchar un lado en cualquier sitio: lo pone, o lo quita si ya estaba. */
  const alternaLado = (lado: LadoFalta) => {
    setFiltro((antes) => (antes === lado ? "todas" : lado));
    setResaltada(null);
  };

  /*
  | Las faltas del partido que pasan por los filtros, menos las dimensiones de
  | `excepto` (y, con `sinLado`, sin mirar el lado). Cada gráfica se pinta con
  | las suyas: así la de una dimensión filtrada sigue teniéndolas todas.
  */
  const filtradas = (excepto: string[] = [], sinLado = false) =>
    (partido?.faltas ?? []).filter(
      (f) =>
        (sinLado || filtro === "todas" || f.lado === filtro) &&
        pasaFiltros(f, filtros, LECTORES, excepto),
    );

  const faltas = useMemo(
    () =>
      (partido?.faltas ?? []).filter(
        (f) =>
          (filtro === "todas" || f.lado === filtro) && pasaFiltros(f, filtros, LECTORES),
      ),
    [partido, filtro, filtros],
  );

  /* El campo ignora su propio filtro de sitio: lo que no sale es de ahí. */
  const paraCampo = filtradas(["zona", "carril"]);
  const sinSitio = paraCampo.filter((f) => !sitioEnCampo(f).zona || !sitioEnCampo(f).carril).length;

  /** Cuántas hay de cada lado con los demás filtros, para los mandos y el encabezado. */
  const porLado = useMemo(() => {
    const todas = (partido?.faltas ?? []).filter((f) => pasaFiltros(f, filtros, LECTORES));

    return {
      ofensivo: todas.filter((f) => f.lado === "ofensivo").length,
      defensivo: todas.filter((f) => f.lado === "defensivo").length,
    };
  }, [partido, filtros]);

  /* Las gráficas, cada una sin su propio filtro. */
  const paraDistancia = filtradas(["distancia"]);
  const paraEntre = filtradas(["entre"]);

  const porDistancia = DISTANCIAS.map((d) => ({
    clave: d,
    cuantas: paraDistancia.filter((f) => f.distancia === d).length,
  }));

  /** Cuántas faltas hubo con cada número de defensores por delante. */
  const porEntre = (() => {
    const cuenta = new Map<string, number>();

    for (const f of paraEntre) {
      const clave = LECTORES.entre(f);
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }

    return [...cuenta.entries()]
      .map(([clave, cuantas]) => ({ clave, cuantas }))
      .sort((a, b) =>
        a.clave === "?" ? 1 : b.clave === "?" ? -1 : Number(a.clave) - Number(b.clave),
      );
  })();

  /** La barra de «Filtrando»: el lado y todo lo pinchado. */
  const chips: ChipFiltro[] = [
    ...(filtro === "todas"
      ? []
      : [
          {
            clave: "lado",
            rotulo: "Lado",
            valor: NOMBRE_LADO[filtro],
            onQuitar: () => setFiltro("todas"),
          },
        ]),
    ...Object.entries(filtros).flatMap(([dimension, valores]) =>
      valores.map((valor) => ({
        clave: `${dimension}|${valor}`,
        rotulo: ROTULO[dimension] ?? dimension,
        valor: dimension === "entre" && valor === "?" ? "sin contar" : valor,
        onQuitar: () => quita(dimension, valor),
      })),
    ),
  ];

  const quitaTodo = () => {
    limpia();
    setFiltro("todas");
    setResaltada(null);
  };

  /** Una celda pinchable de la tabla o de la lista. */
  const celda = (dimension: string, valor: string, texto: string = valor) =>
    valor ? (
      <Filtrable
        activo={estaActivo(filtros, dimension, valor)}
        onClick={() => alterna(dimension, valor)}
      >
        {texto}
      </Filtrable>
    ) : (
      "—"
    );

  /** La media de defensores entre la falta y la portería que se ataca. */
  const defensores = useMemo(() => {
    const con = faltas.filter((f) => f.entre !== null).map((f) => f.entre as number);

    if (con.length === 0) return null;

    const suma = con.reduce((a, b) => a + b, 0);

    return {
      media: suma / con.length,
      minimo: Math.min(...con),
      maximo: Math.max(...con),
      contadas: con.length,
      sinContar: faltas.length - con.length,
    };
  }, [faltas]);

  /*
  | Las que se pitaron con el campo abierto: ésas cortaron algo.
  |
  | Sólo lejos del área que se ataca. Una falta lateral junto al área, o un
  | penalti, deja casi siempre a uno o dos defensores «por detrás» del balón
  | —se cuentan en profundidad, contra la línea de fondo— y no es una
  | transición cortada: es un balón parado. Metidas aquí, la lista se llenaba
  | de centros laterales.
  */
  const cortes = useMemo(
    () =>
      faltas
        .filter((f) => f.zona !== "campo rival")
        .filter((f) => f.entre !== null && (f.entre as number) <= CORTE_TRANSICION)
        .sort((a, b) => (a.entre as number) - (b.entre as number)),
    [faltas],
  );

  /*
  | Lo que dice lo que se está viendo (partido y filtro), en pocas frases.
  | La zona va hacia la portería que ataca quien saca: «campo rival» es
  | siempre el último tercio del que la saca.
  */
  const conclusiones = useMemo(() => {
    const total = faltas.length;

    if (total === 0) return [];

    const frases: string[] = [];

    /* Con algo pinchado, la primera frase lo dice: si no, parece el partido entero. */
    const conFiltro = Object.keys(filtros).length > 0 ? " con este filtro" : "";

    frases.push(
      filtro === "todas"
        ? `${porLado.ofensivo} a favor y ${porLado.defensivo} en contra${conFiltro}.`
        : `${total} ${total === 1 ? "falta" : "faltas"} ${filtro === "ofensivo" ? "a favor" : "en contra"}${conFiltro}.`,
    );

    /* La zona y el carril, en el campo de verdad (el Castilla atacando hacia la derecha). */
    const zona = laQueMas(faltas.map((f) => sitioEnCampo(f).zona));
    const carril = laQueMas(faltas.map((f) => sitioEnCampo(f).carril));

    const nombreZona = (z: string) => z;

    if (zona && carril) {
      frases.push(
        `Se concentran en ${nombreZona(zona.clave)} (${zona.veces} de ${total}) y ${carril.clave === "centro" ? "por el centro" : `por la ${carril.clave}`} (${carril.veces} de ${total}).`,
      );
    }

    const ultimoTercio = faltas.filter((f) => f.zona === "campo rival").length;
    const frontales = faltas.filter((f) => f.distancia === "frontal").length;

    if (filtro === "todas" && (ultimoTercio || frontales)) {
      /* Con las dos caras juntas, cada cifra lleva su base: a favor sobre las a favor y en contra sobre las en contra. */
      const aF = faltas.filter((f) => f.lado === "ofensivo");
      const eC = faltas.filter((f) => f.lado === "defensivo");
      /* 10/11/2026: la zona en el campo de verdad (`sitioEnCampo`), la misma
         que usa «Qué hacemos» («2 en nuestro campo»): antes iba por la zona
         de quien saca y decía «0 de 14 en nuestro campo». Y lo que es 0 no
         se escribe: va en «Casos escasos». */
      const parte = (lote: typeof faltas, texto: string) => {
        if (!lote.length) return "";
        const enZona = lote.filter((f) => sitioEnCampo(f).zona === texto).length;
        const frente = lote.filter((f) => f.distancia === "frontal").length;
        return [
          enZona ? `${enZona} de ${lote.length} en ${texto}` : "",
          frente ? `${frente} de ${lote.length} ${frente === 1 ? "frontal" : "frontales"}` : "",
        ]
          .filter(Boolean)
          .join("; ");
      };

      const pf = parte(aF, "campo rival");
      const pc = parte(eC, "nuestro campo");
      if (pf || pc) frases.push([pf ? `A favor, ${pf}` : "", pc ? `en contra, ${pc}` : ""].filter(Boolean).join("; ") + ".");
    } else if (ultimoTercio || frontales) {
      const donde =
        filtro === "ofensivo"
          ? "en campo rival"
          : filtro === "defensivo"
            ? "cerca de nuestra área"
            : "en último tercio";

      frases.push(
        `${ultimoTercio} de ${total} ${donde}; ${frontales} de ${total} ${frontales === 1 ? "frontal" : "frontales"}.`,
      );
    }

    if (defensores) {
      /*
      | La tabla de comparación cuenta sólo las faltas a favor; esta frase
      | decía la media de todas y las dos cifras no cuadraban. Con las dos
      | caras a la vista se dan por separado.
      */
      const mediaDe = (lado: "ofensivo" | "defensivo") => {
        const con = faltas.filter((f) => f.lado === lado && f.entre !== null).map((f) => f.entre as number);

        return con.length ? con.reduce((a, b) => a + b, 0) / con.length : null;
      };

      const favor = mediaDe("ofensivo");
      const contra = mediaDe("defensivo");

      if (filtro === "todas" && favor !== null && contra !== null) {
        frases.push(
          `Defensores por delante de media: ${decimal(favor)} en las faltas a favor y ${decimal(contra)} en las faltas en contra.`,
        );
      } else {
        frases.push(
          `${decimal(defensores.media)} defensores por delante de media${filtro === "ofensivo" ? " en las faltas a favor" : filtro === "defensivo" ? " en las faltas en contra" : ""} (de ${defensores.minimo} a ${defensores.maximo}).`,
        );
      }
    }

    /* 10/11/2026: con sujeto y base («1 de las 14 faltas en contra…»). */
    const enContraTodas = faltas.filter((f) => f.lado === "defensivo").length;
    const cortesNuestros = cortes.filter((f) => f.lado === "defensivo").length;
    const cortesSuyos = cortes.length - cortesNuestros;
    if (cortesNuestros) {
      frases.push(
        `${cortesNuestros} de las ${enContraTodas} faltas en contra ${cortesNuestros === 1 ? "cortó" : "cortaron"} una transición del rival con el campo abierto (falta táctica).`,
      );
    }
    if (cortesSuyos) {
      frases.push(`${cortesSuyos} de las faltas a favor nos ${cortesSuyos === 1 ? "cortó" : "cortaron"} una transición con el campo abierto.`);
    }
    /* 17/11/2026 (ronda 20, fútbol): sólo se afirma si las faltas traen los
       defensores por delante (el vídeo los cuenta; Opta no los da). */
    if (!cortes.length && faltas.some((f) => f.entre !== null && f.entre !== undefined)) frases.push("Ninguna falta cortó una transición: todas con el bloque hecho.");

    return frases;
  }, [faltas, filtro, filtros, porLado, defensores, cortes]);

  /*
  | Este partido frente a la media de los anteriores (por fecha). Se calcula
  | sobre el partido entero, sin el lado ni lo pinchado: así la cifra es la
  | misma la mire quien la mire y no cambia al filtrar la pantalla. La zona
  | va en el campo de verdad (`sitioEnCampo`), para que «campo rival» sea lo
  | mismo en una falta nuestra que en una del rival.
  */
  const comparativa = useMemo(() => (partido ? comparativaFaltas(partido, partidosVisibles) : null), [partido, partidosVisibles]);

  /* 29/10/2026: «Qué hacemos» al final de las conclusiones, con tarea y criterio de éxito (mismo formato que Robos y Pérdidas). */
  /*
  | 20/11/2026 (ronda 4, fútbol y análisis): la métrica de la semana ya no es
  | siempre el total en contra. Como en Robos y Pérdidas, se elige la que se
  | sale de la franja mínimo–máximo de los anteriores hacia su lado malo (la
  | que más se sale); si ninguna se sale, «Sin alarma esta semana» con la más
  | justa y sin tarea. La tendencia va en el titular, no sólo en el rótulo.
  */
  const queHacemos = useMemo(() => {
    if (!comparativa || !partido || comparativa.anteriores < 1) return null;

    const TAREAS: Record<string, { tarea: string; cuenta: string; lado: LadoFalta; zona?: string; distancia?: string }> = {
      contra: { tarea: "defensa de duelos sin falta", cuenta: "las faltas que cometemos en cada serie", lado: "defensivo" },
      "contra-frontal": { tarea: "defensa del pasillo central sin falta (temporizar, no entrar al cuerpo)", cuenta: "las faltas frontales que cometemos", lado: "defensivo", distancia: "frontal" },
      "contra-nuestro": { tarea: "defensa en nuestro campo sin falta (temporizar y orientar a banda)", cuenta: "las faltas que cometemos en nuestro campo", lado: "defensivo", zona: "nuestro campo" },
      "favor-frontal": { tarea: "ataque del pasillo central para provocar la falta frontal", cuenta: "las faltas frontales que nos hacen", lado: "ofensivo", distancia: "frontal" },
      "favor-rival": { tarea: "conducción y regate en el último tercio para provocar falta", cuenta: "las faltas que nos hacen en campo rival", lado: "ofensivo", zona: "campo rival" },
      defensores: { tarea: "sacar rápido la falta a favor, antes de que se arme su bloque", cuenta: "los defensores por delante en cada falta a favor", lado: "ofensivo" },
    };

    const candidatas = comparativa.metricas
      .filter((m) => TAREAS[m.clave] && m.actual !== null && m.media !== null && (m.mejorAlto === true || m.mejorAlto === false))
      .map((m) => {
        const actual = m.actual as number;
        const media = m.media as number;
        const conFranja = Boolean(m.rango && m.rango[0] !== m.rango[1]);
        const lo = conFranja && m.rango ? Math.min(m.rango[0], m.rango[1]) : null;
        const hi = conFranja && m.rango ? Math.max(m.rango[0], m.rango[1]) : null;
        const ancho = lo !== null && hi !== null ? Math.max(hi - lo, 1) : Math.max(Math.abs(media), 1);
        /* Cuánto se sale hacia lo malo (en anchos de franja); <= 0 es dentro o hacia lo bueno. */
        const fuera =
          lo !== null && hi !== null
            ? (m.mejorAlto ? lo - actual : actual - hi) / ancho
            : (m.mejorAlto ? media - actual : actual - media) / ancho - 0.25;
        /* Lo justo: cuánto se acerca a lo malo, frente a la media. */
        const justo = (m.mejorAlto ? media - actual : actual - media) / ancho;
        return { m, actual, media, lo, hi, fuera, justo };
      });

    if (candidatas.length === 0) return null;

    type Candidata = (typeof candidatas)[number];
    const peor = candidatas.filter((c) => c.fuera > 0).sort((a, b) => b.fuera - a.fuera)[0];
    const n = comparativa.anteriores;
    const jornada = jornadaCorta(partido.jornada);
    const f = (x: number, m: MetricaComparada) => (m.formato ?? numeroCorto)(x);
    const franja = (c: Candidata) => (c.lo !== null && c.hi !== null ? ` (de ${f(c.lo, c.m)} a ${f(c.hi, c.m)})` : "");
    const tendenciaDe = (c: Candidata) => n < UMBRAL_TENDENCIA_PARTIDOS || Boolean(c.m.tendencia) || partidoDeOpta;
    const deDonde = `media de ${n === 1 ? "un partido anterior" : `los ${n} anteriores`}`;

    if (!peor) {
      const justa = [...candidatas].sort((a, b) => b.justo - a.justo)[0];
      const tend = tendenciaDe(justa);
      return {
        alarma: false,
        rotulo: `Sin alarma esta semana${tend ? " · tendencia" : ""}`,
        titular: `Lo más justo: ${justa.m.nombre.toLowerCase()}, ${f(justa.actual, justa.m)} frente a ${f(justa.media, justa.m)}${franja(justa)}`,
        lineas: [`Ninguna cifra de la ${jornada} se sale de lo normal en los anteriores (${deDonde}). Sin tarea nueva; se vigila en el próximo partido.`],
        ver: null as null | { lado: LadoFalta; pinchado: [string, string][]; texto: string },
      };
    }

    const t = TAREAS[peor.m.clave];
    const tend = tendenciaDe(peor);
    const menosEsMejor = peor.m.mejorAlto === false;
    /* El objetivo: volver dentro de lo normal (el borde de la franja), no la cifra de hoy. */
    const objetivo = menosEsMejor ? (peor.hi ?? peor.media) : (peor.lo ?? peor.media);
    const conVideo = partido.faltas.filter(
      (x) => x.lado === t.lado && (!t.zona || sitioEnCampo(x).zona === t.zona) && (!t.distancia || x.distancia === t.distancia),
    ).length;
    const pinchado: [string, string][] = [];
    if (t.zona) pinchado.push(["zona", t.zona]);
    if (t.distancia) pinchado.push(["distancia", t.distancia]);

    return {
      alarma: true,
      rotulo: `Lo que pide trabajo esta semana${tend ? " · tendencia" : ""}`,
      titular: `${peor.m.nombre}: ${f(peor.actual, peor.m)} frente a ${f(peor.media, peor.m)} de media${franja(peor)} en la ${jornada} (${partido.rival})${tend ? " · tendencia" : ""}`,
      lineas: [
        `Se sale de lo normal hacia el lado malo${peor.m.porCada ? " (media por falta)" : ""}; la referencia es la ${deDonde}${tend ? (peor.m.tendencia ? ", con pocos casos: tendencia" : ", con pocos partidos detrás: tendencia") : ""}.`,
        `En el campo: tarea de ${t.tarea}, contando ${t.cuenta}.`,
        `Criterio de éxito, ${menosEsMejor ? "no pasar de" : "llegar al menos a"} ${f(objetivo, peor.m)} en el próximo partido (volver dentro de lo normal).`,
      ],
      ver: conVideo > 0 ? { lado: t.lado, pinchado, texto: `Ver ${conVideo === 1 ? "esa falta" : `las ${conVideo} faltas`} en vídeo` } : null,
    };
  }, [comparativa, partido, partidoDeOpta]);

  /*
  | Por jugador: con el lado y todo lo pinchado menos el propio jugador (así
  | al elegir uno se siguen viendo los demás). En temporada, todos los
  | partidos visibles; sólo cuentan los que tienen jugador.
  */
  const partidosJugador = ambito === "temporada" ? partidosVisibles : partido ? [partido] : [];
  const conJugador = partidosJugador.filter((p) => p.faltas.some((f) => f.jugador));
  const sinJugador = partidosJugador.filter((p) => p.faltas.length > 0 && !p.faltas.some((f) => f.jugador));
  const paraJugador: FaltaVista[] = partidosJugador
    .flatMap((p) => p.faltas.map((f) => ({ ...f, partido: p.id })))
    .filter(
      (f) =>
        (filtro === "todas" || f.lado === filtro) && pasaFiltros(f, filtros, LECTORES, ["jugador"]),
    );
  const sinNombre = paraJugador.filter((f) => !f.jugador && conJugador.some((p) => p.id === f.partido)).length;
  const columnasJugador = [
    ...(filtro === "ofensivo" ? [] : COLUMNAS_COMETE),
    ...(filtro === "defensivo" ? [] : COLUMNAS_RECIBE),
  ];

  const frasesJugador = (() => {
    const suyas = new Map<string, FaltaVista[]>();

    for (const f of paraJugador) if (f.jugador) suyas.set(f.jugador, [...(suyas.get(f.jugador) ?? []), f]);

    const lista = [...suyas.entries()].map(([jugador, filas]) => ({ jugador, filas }));
    const elQueMas = (cumple: (f: Falta) => boolean) =>
      lista
        .map((l) => ({ jugador: l.jugador, n: l.filas.filter(cumple).length }))
        .sort((a, b) => b.n - a.n || a.jugador.localeCompare(b.jugador, "es"))[0];

    const frases: string[] = [];
    const comete = elQueMas(enContra);
    const recibe = elQueMas(aFavor);
    const frontal = elQueMas((f) => enContra(f) && f.distancia === "frontal");
    const corta = elQueMas((f) => enContra(f) && cortaTransicion(f));

    if (comete?.n && filtro !== "ofensivo") frases.push(`El que más faltas comete es ${comete.jugador} (${comete.n}).`);
    if (recibe?.n && filtro !== "defensivo") frases.push(`Al que más se las hacen es a ${recibe.jugador} (${recibe.n}).`);
    if (frontal?.n && filtro !== "ofensivo") frases.push(`${frontal.jugador} es el que más faltas frontales hace en contra (${frontal.n}).`);
    if (corta?.n && filtro !== "ofensivo") frases.push(`${corta.jugador} es el que más contras corta con falta (${corta.n}).`);

    return frases;
  })();

  /* El título-conclusión del campo en «Visual»: cuántas de las que cometemos caen en nuestro tercio (las que dan balón parado cerca de nuestra área). */
  const tituloCampoFaltas = (() => {
    const enContra = paraCampo.filter((f) => f.lado !== "ofensivo");
    const aFavor = paraCampo.filter((f) => f.lado === "ofensivo");
    const pc = (n: number, de: number) => Math.round((n / de) * 100);
    const partes: string[] = [];
    if (enContra.length) {
      const atras = enContra.filter((f) => sitioEnCampo(f).zona === "nuestro campo").length;
      /* 17/11/2026 (ronda 20, análisis): con menos de 15 faltas en esa zona, la cifra es tendencia. */
      partes.push(`De las ${enContra.length} que cometemos, ${atras} (${pc(atras, enContra.length)} %${atras < 15 ? ", tendencia" : ""}) en nuestro tercio`);
    }
    if (aFavor.length) {
      const arriba = aFavor.filter((f) => sitioEnCampo(f).zona === "campo rival").length;
      partes.push(`de las ${aFavor.length} que nos hacen, ${arriba} (${pc(arriba, aFavor.length)} %${arriba < 15 ? ", tendencia" : ""}) en su tercio`);
    }
    const t = partes.join("; ");
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  })();

  /*
  | 16/11/2026 (expertos, ronda 18): en «Visual» el campo con su conclusión va
  | justo debajo del partido, antes de la tabla; en «Detalle» sigue en su
  | pestaña «En el campo».
  */
  const bloqueCampo = (
    <div className="mt-5">
      {enVisual && tituloCampoFaltas ? (
        <TituloConclusion
          pregunta="¿Dónde se cometen?"
          fuente={`${partidoDeOpta ? "Opta" : "Vídeo etiquetado"} · ${paraCampo.length} ${paraCampo.length === 1 ? "falta" : "faltas"}${partido ? ` en la ${jornadaCorta(partido.jornada)}` : ""}`}
        >
          {tituloCampoFaltas}
        </TituloConclusion>
      ) : null}
      <Panel
        title="Dónde se cometen"
        /* 11/11/2026 (expertos, ronda 2): la base del mapa, siempre a la vista. */
        subtitle={`${partido ? `${jornadaCorta(partido.jornada)} · ${partido.rival} · ` : ""}${paraCampo.length} ${paraCampo.length === 1 ? "falta" : "faltas"}: ${paraCampo.filter((f) => f.lado === "ofensivo").length} a favor y ${paraCampo.filter((f) => f.lado !== "ofensivo").length} en contra · el Castilla ataca hacia la derecha${
          explicativos
            ? ". Cada punto es una falta, en su tercio y su carril del campo de verdad, también en las faltas que saca el rival. El etiquetado guarda zonas, no metros: dentro de cada zona los puntos se reparten para no taparse"
            : ""
        }`}
        icon={Crosshair}
      >
        <CampoFaltas
          faltas={paraCampo}
          zonas={ZONAS_CAMPO}
          carriles={CARRILES_CAMPO}
          tinta={TINTA_LADO}
          resaltada={resaltada}
          onResaltar={setResaltada}
          zonasMarcadas={filtros.zona ?? []}
          carrilesMarcados={filtros.carril ?? []}
          ladoMarcado={filtro === "todas" ? null : filtro}
          onCajon={(zona, carril) =>
            alternaVarios([
              ["zona", zona],
              ["carril", carril],
            ])
          }
          onPunto={(id, origen) => {
            const f = paraCampo.find((x) => x.clip === id);

            if (!f) return;

            const opciones = opcionesDeAccion({ video: f.video, opta: enlaceOptaDe(f), hudl: f.hudl, fila: faltas.some((x) => x.clip === id) ? id : null, aLaTabla: () => {
                setVista("lista");
                setVistaPantalla("detalle");
              } });
            /* 17/11/2026 (ronda 19): de nuestra falta, la ficha y el seguimiento de quien la comete. */
            if (f.jugador && f.lado !== "ofensivo") {
              opciones.push({ clave: "ficha", etiqueta: `Ficha de ${f.jugador}`, detalle: "Individual", icono: "grafico", href: `/individual?nombre=${encodeURIComponent(f.jugador)}` });
              opciones.push({ clave: "seguimiento", etiqueta: `Seguimiento de ${f.jugador}`, detalle: "En su ficha", icono: "tabla", href: `/individual?nombre=${encodeURIComponent(f.jugador)}&pestana=seguimiento` });
            }

            /* Sin vídeo ni fila, el punto hace lo de siempre: filtra su cajón. */
            if (!abreMenu(origen, `Falta ${f.lado === "ofensivo" ? "a favor" : "en contra"}${f.minuto ? ` · ${f.minuto}` : ""}`, opciones)) {
              const sitio = sitioEnCampo(f);

              alternaVarios([
                ["zona", sitio.zona],
                ["carril", sitio.carril],
              ]);
            }
          }}
          onZona={(zona) => alterna("zona", zona)}
          onCarril={(carril) => alterna("carril", carril)}
          onLado={alternaLado}
        />

        {/* 17/11/2026 (ronda 19, marketing): lo que hace tocar un punto, a la vista (antes sólo al pasar el ratón). */}
        <p className="mt-2 text-[12px] text-white/60">Toca una falta: su vídeo, Hudl y, si es nuestra, la ficha y el seguimiento de quien la comete.</p>
        {sinSitio > 0 && explicativos && (
          <p className="mt-3 text-[11px] text-white/60">
            {sinSitio}{" "}
            {sinSitio === 1
              ? "falta no se pudo situar"
              : "faltas no se pudieron situar"}{" "}
            en el campo y no salen dibujadas.
          </p>
        )}
      </Panel>

    </div>
  );

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      {menuAccion}
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Análisis del partido"
              title="Análisis de faltas"
              lead={
                explicativos
                  ? "Dónde se comete cada falta y cuánta gente defendía entre ella y la portería. Sale de ver el partido falta a falta."
                  : undefined
              }
            />

            {/* 16/11/2026 (expertos, ronda 17): una línea, sin la franja «incompleta». */}
            {/* 17/11/2026 (ronda 20, los tres jueces): el sello cuenta también los
                partidos del respaldo de Opta, con el mismo recuento que el selector. */}
            <SelloDeFechas
              fuente={algunoOpta ? "Etiquetado propio y Opta" : "Etiquetado propio"}
              fechas={fechasVisibles}
              queEs="faltas"
              cuantos={partidosVisibles.length}
              compacto
            />

            {/* 17/11/2026: el partido elegido sale de Opta (aún sin etiquetar en Hudl). */}
            <SelloOpta className="mt-2" partidos={partido && partido.faltas.some(esDeOpta) ? [{ jornada: partido.jornada, rival: partido.rival }] : []} />

            {PARTIDOS.length === 0 || (partido?.faltas.length ?? 0) === 0 ? (
              <div className="mt-5">
                <Panel title="Todavía no hay ninguna falta etiquetada" icon={Crosshair}>
                  <Explicativo>
                    <p className="text-sm text-white/50">
                      Prepara una carpeta de clips y etiquétala: abajo están las
                      órdenes, con la carpeta que quieras.
                    </p>
                  </Explicativo>
                </Panel>
              </div>
            ) : null}

            {/* 16/11/2026 (expertos, ronda 18): a un toque, lo que completa el partido elegido. */}
            {partido ? (
              <EnlacesRapidos
                className="mt-3"
                enlaces={[
                  { href: enlaceConPartido("/laboratorio/transiciones", partido), texto: "Robos de este partido", icono: Crosshair },
                  { href: enlaceConPartido("/laboratorio/perdidas", partido), texto: "Pérdidas de este partido", icono: Swords },
                  { href: urlPostDelPartido(partido.fecha, partido.rival), texto: `Post del partido · ${jornadaCorta(partido.jornada)}`, icono: BarChart3 },
                  /* 17/11/2026 (ronda 20, análisis y marketing): el que más faltas comete, a su ficha y su seguimiento. */
                  masFaltas
                    ? { href: `/individual?nombre=${encodeURIComponent(masFaltas[0])}`, texto: `${masFaltas[0]}, el que más comete (${masFaltas[1]} de ${porLado.defensivo})`, icono: Users }
                    : { texto: "" },
                  masFaltas ? { href: `/individual?nombre=${encodeURIComponent(masFaltas[0])}&pestana=seguimiento`, texto: "Su seguimiento", icono: ClipboardList } : { texto: "" },
                  /* 17/11/2026 (ronda 19): el balón parado del próximo rival (sus faltas a favor y en contra). */
                  proximoRivalFaltas ? { href: `/scout-rival-abp?equipo=${encodeURIComponent(proximoRivalFaltas)}`, texto: `ABP del ${proximoRivalFaltas}`, icono: Shield } : { texto: "" },
                  /* 20/11/2026 (ronda 4): y su plan, en el mismo orden que en robos y pérdidas. */
                  proximoRivalFaltas ? { href: `/match-preparation?equipo=${encodeURIComponent(proximoRivalFaltas)}`, texto: `Plan contra el ${proximoRivalFaltas}`, icono: FileText } : { texto: "" },
                  { href: "/setpieces", texto: "ABP ofensivo", icono: Zap },
                ]}
              />
            ) : null}

            {/* ---------------- mandos ---------------- */}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {/* 16/11/2026 (marketing, ronda 17): un selector de partido, el
                  último arriba, en vez de nueve botones; y la base al lado. */}
              {partidosEnOrden.length > 0 ? (
                <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-white/60">
                  <span className="shrink-0">Partido</span>
                  <select
                    value={partido?.id ?? ""}
                    onChange={(e) => {
                      setPartidoId(e.target.value);
                      setResaltada(null);
                    }}
                    className="min-w-0 max-w-full rounded-xl border border-[#C8A96B]/40 bg-[#11161D] px-3 py-2 text-sm text-white"
                  >
                    {[...partidosEnOrden].reverse().map((p) => (
                      <option key={p.id} value={p.id}>
                        {jornadaCorta(p.jornada)} · {nombreEquipo(p.rival)}
                      </option>
                    ))}
                  </select>
                  <span className="shrink-0 text-[11px] text-white/50">
                    de {partidosEnOrden.length} partidos
                  </span>
                </label>
              ) : null}

              <span className="mx-1 h-6 w-px bg-white/10" />


              <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                {(
                  [
                    { key: "todas" as const, label: "Todas" },
                    { key: "ofensivo" as const, label: "A favor" },
                    { key: "defensivo" as const, label: "En contra" },
                  ] satisfies { key: Filtro; label: string }[]
                ).map((uno) => (
                  <button
                    key={uno.key}
                    type="button"
                    onClick={() => {
                      setFiltro(uno.key);
                      setResaltada(null);
                    }}
                    aria-pressed={filtro === uno.key}
                    className={`rounded-lg px-3 py-2 text-xs transition ${
                      filtro === uno.key
                        ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {uno.label}
                  </button>
                ))}
              </div>

              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/50">
                {faltas.length} {faltas.length === 1 ? "falta" : "faltas"} en {partido ? `la ${jornadaCorta(partido.jornada)}` : "el partido"}
              </span>
            </div>

            {/* 29/10/2026: sin nada pinchado la barra sólo decía «Filtrando nada más»; no se
                enseña salvo que haya pretemporada que meter o sacar. */}
            {(chips.length > 0 || HAY_PRETEMPORADA) && (
            <BarraFiltros
              chips={chips}
              onLimpiar={quitaTodo}
              cuenta={{ vistas: faltas.length, total: partido?.faltas.length ?? 0, unidad: "faltas" }}
              pretemporada={
                HAY_PRETEMPORADA
                  ? { incluida: conPretemporada, onCambiar: setConPretemporada }
                  : undefined
              }
              className="mt-3"
            />
            )}

            <div className="mt-4 flex justify-end">
              <ConmutadorVista vista={vistaPantalla} onCambia={setVistaPantalla} />
            </div>
            {!enVisual && (
            <div className="mt-4">
              <Pestanas
                etiqueta="Vistas"
                valor={vista}
                onCambia={setVista}
                opciones={[
                  { clave: "resumen", label: "Resumen", icono: LayoutDashboard },
                  { clave: "campo", label: "En el campo", icono: MapIcon },
                  { clave: "detalle", label: "Detalle", icono: BarChart3 },
                  { clave: "jugadores", label: "Por jugador", icono: Users },
                  { clave: "lista", label: "Falta a falta", icono: List, cuenta: faltas.length },
                ]}
              />
            </div>
            )}

            {(vista === "resumen" || enVisual) && (
            <>
            {/* ---------------- el partido ---------------- */}

            {partido && (
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  {jornadaCorta(partido.jornada)}
                </span>

                {/* 29/10/2026: el marcador entre los dos nombres («Algeciras 2-0 RM Castilla»):
                    suelto, «2-0 · fuera» se leía como victoria y contradecía el 0-2 de
                    Histórico Competición y Data análisis. */}
                {/* 30/10/2026: cada gol junto a su equipo, el local primero («Algeciras CF 2 · RM Castilla 0»):
                    con el marcador en medio, «2-0» se seguía leyendo como victoria (análisis). */}
                {(() => {
                  const [gl, gv] = partido.resultado.split("-").map((x) => x.trim());
                  const local = partido.local ? "RM Castilla" : partido.rival;
                  const visitante = partido.local ? partido.rival : "RM Castilla";

                  if (!gl || !gv) {
                    return (
                      <span className="text-sm font-semibold text-white">
                        {local} {partido.resultado} {visitante}
                      </span>
                    );
                  }

                  return (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-white">
                      <span>
                        {local} <span className="font-mono tabular-nums">{gl}</span>
                      </span>
                      <span className="text-white/35">·</span>
                      <span>
                        {visitante} <span className="font-mono tabular-nums">{gv}</span>
                      </span>
                    </span>
                  );
                })()}

                <span className="text-[11px] uppercase tracking-[0.12em] text-white/35">
                  {partido.local ? "en casa" : "fuera"} · {fechaCorta(partido.fecha)}
                </span>

                <span className="ml-auto flex flex-wrap items-center gap-2 text-[11px]">
                  {(["ofensivo", "defensivo"] as const).map((lado) => (
                    <button
                      key={lado}
                      type="button"
                      onClick={() => alternaLado(lado)}
                      aria-pressed={filtro === lado}
                      title={TITULO_FILTRO}
                      className="cursor-pointer rounded-full px-2.5 py-1 transition hover:opacity-100"
                      style={{
                        color: TEXTO_LADO[lado],
                        background: `${TINTA_LADO[lado]}1A`,
                        ...marcaPieza(filtro === lado, filtro !== "todas"),
                      }}
                    >
                      {porLado[lado]} {lado === "ofensivo" ? "a favor" : "en contra"}
                    </button>
                  ))}
                </span>
              </div>
            )}

            {enVisual && bloqueCampo}
            {/* 22/11/2026: el Castilla frente al rival o rivales que se elijan (Opta). */}
            {enVisual && <FrenteAlRival area="faltas" rivalPartido={partido?.rival ?? ""} className="mt-5" />}

            {/* ---------------- frente a los anteriores ---------------- */}

            {comparativa && (
              <>
              {/* 16/11/2026 (experto de fútbol): la orden de la semana, arriba y con
                  la misma forma que en Robos y Pérdidas (antes era la última conclusión). */}
              {queHacemos ? (
                <div className={cn("mt-4 rounded-2xl border px-4 py-3", queHacemos.alarma ? "border-amber-400/40 bg-amber-400/[0.06]" : "border-white/10 bg-white/[0.03]")}>
                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", queHacemos.alarma ? "text-amber-300" : "text-white/60")}>{queHacemos.rotulo}</p>
                  <p className="mt-1 text-base font-semibold text-white sm:text-lg">{queHacemos.titular}</p>
                  {queHacemos.lineas.map((l, i) => (
                    <p key={i} className={`mt-1 text-sm leading-relaxed ${i === 0 ? "text-white/85" : "text-white/75"}`}>
                      {l}
                    </p>
                  ))}
                  {/* 20/11/2026 (ronda 4, marketing): de la orden al vídeo de esas faltas, con el partido ya elegido. */}
                  {queHacemos.ver ? (
                    <button
                      type="button"
                      onClick={() => {
                        const ver = queHacemos.ver!;
                        limpia();
                        setFiltro(ver.lado);
                        if (ver.pinchado.length) alternaVarios(ver.pinchado);
                        setVista("lista");
                        setVistaPantalla("detalle");
                      }}
                      className="mr-2 mt-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 transition hover:border-[#C8A96B]/40"
                    >
                      {queHacemos.ver.texto}
                    </button>
                  ) : null}
                  {queHacemos.alarma ? (
                  <Link
                    href="/microcycles"
                    className="mt-2 inline-block rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 transition hover:border-[#C8A96B]/40"
                  >
                    Llevarla al microciclo
                  </Link>
                  ) : null}
                </div>
              ) : null}

              {/* 29/10/2026: el titular antes de las filas, para leer lo esencial en cinco segundos (marketing). */}
              {(() => {
                const f = comparativa.metricas.find((m) => m.clave === "favor");
                const c = comparativa.metricas.find((m) => m.clave === "contra");

                /* 16/11/2026: con la orden de la semana arriba, su primera línea ya lo dice. */
                if (queHacemos || !f || !c || f.actual === null || c.actual === null) return null;

                /* 30/10/2026: un titular con verbo y la cifra que manda, no la tabla
                   repetida en una frase (marketing). */
                /* 08/11/2026: dos titulares con el vocabulario de la pantalla
                   («en contra» = las que cometemos, «a favor» = las que nos
                   hacen) y el color según el sentido: en contra, menos es mejor;
                   a favor no se juzga. */
                const n = comparativa.anteriores;
                const deLos = n === 1 ? "el anterior" : `los ${n} anteriores`;
                /* 10/11/2026: un solo titular con verbo; las dos tarjetas repetían
                   la tabla de debajo. La diferencia sale de la media ya redondeada
                   (14 − 11,3 = 2,7), la misma cifra que la tabla. */
                const redondea = (x: number) => Math.round(x * 10) / 10;
                const comoVa = (m: typeof f) => {
                  if (m.media === null || n < 1) return { texto: "", dif: 0 };
                  const d = redondea((m.actual as number) - redondea(m.media));

                  return Math.abs(d) < 0.05
                    ? { texto: `igual que la media de ${deLos} (${decimal(m.media)})`, dif: 0 }
                    : { texto: `${decimal(Math.abs(d))} ${d < 0 ? "menos" : "más"} que la media de ${deLos} (${decimal(m.media)})`, dif: d };
                };
                const vc = comoVa(c);

                return (
                  <p
                    className={cn(
                      "mt-3 rounded-xl border px-3 py-2 text-base font-semibold leading-snug text-white",
                      vc.dif > 0 ? "border-amber-400/40 bg-amber-400/[0.06]" : vc.dif < 0 ? "border-emerald-400/40 bg-emerald-400/[0.06]" : "border-white/10",
                    )}
                  >
                    Cometimos {c.actual} {c.actual === 1 ? "falta" : "faltas"}
                    {vc.texto ? `, ${vc.texto}` : ""}; nos hicieron {f.actual}.
                  </p>
                );
              })()}
              {/*
              | 30/10/2026: las filas con muy pocos casos («0 frente a 1»,
              | tendencia) se pliegan en «Casos escasos»: en la tabla eran tres
              | de ocho y tapaban las que sí dicen algo (marketing).
              */}
              {enVisual ? (
                /* 17/11/2026 (ronda 19, análisis y marketing): en Visual, barras con la raya de la media y el rango; el método, una vez al pie. La tabla, en Detalle. */
                <BarrasFrenteAMedia
                  metricas={comparativa.metricas.filter((m) => !escasa(m)).map((m) => (m.formato ? m : { ...m, formato: numeroCorto }))}
                  anteriores={comparativa.anteriores}
                  titulo={`${partido ? jornadaCorta(partido.jornada) : "Este partido"}${partidoDeOpta ? " (Opta)" : ""} frente a los anteriores`}
                  tendencia={partidoDeOpta}
                  /* 17/11/2026 (ronda 20, marketing): los casos escasos, dentro del gráfico al que afectan; y de qué fuente es cada partido. */
                  pie={[
                    anterioresOpta ? `De los ${comparativa.anteriores} anteriores, ${comparativa.anteriores - anterioresOpta} del vídeo etiquetado y ${anterioresOpta} de Opta.` : "",
                    partidoDeOpta ? "Este partido sale de Opta: fuentes distintas, se lee como tendencia." : "",
                    comparativa.metricas.some(escasa)
                      ? `Fuera del gráfico, con 2 casos o menos (sólo tendencia): ${comparativa.metricas
                          .filter(escasa)
                          .map((m) => `${m.nombre.toLowerCase()}, ${m.actual ?? 0}${m.media !== null ? ` (media ${decimal(m.media)})` : ""}`)
                          .join("; ")}.`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              ) : (
              <ComparativaPartido
                partido={comparativa.partido}
                anteriores={{ n: comparativa.anteriores }}
                /* 16/11/2026 (expertos, ronda 17): los recuentos de un partido
                   sin decimales («11», no «11,0»); los decimales, en las medias
                   (numeroCorto). Y las faltas a favor, que no se juzgan, dicen
                   si el partido cae dentro de lo de siempre. */
                metricas={comparativa.metricas
                  .filter((m) => !escasa(m))
                  .map((m) => {
                    const conFormato = m.formato ? m : { ...m, formato: numeroCorto };
                    if (m.clave !== "favor" || m.actual === null || !m.rango) return conFormato;
                    const [bajo, alto] = m.rango;
                    const donde =
                      m.actual < bajo
                        ? /* 16/11/2026 (ronda 18): en neutro; «menos que en ninguno» sonaba a fallo y a favor no se juzga. */
                          `por debajo de lo habitual (los anteriores, de ${numeroCorto(bajo)} a ${numeroCorto(alto)})`
                        : m.actual > alto
                          ? `por encima de lo habitual (los anteriores, de ${numeroCorto(bajo)} a ${numeroCorto(alto)})`
                          : `dentro de lo normal (de ${numeroCorto(bajo)} a ${numeroCorto(alto)})`;
                    return { ...conFormato, pie: `${donde} · el volumen depende del estilo; lo que se juzga es dónde, en las filas de zona` };
                  })}
                nota={`Sobre el partido entero, sin el filtro de ${filtro === "todas" ? "lado" : `«${NOMBRE_LADO[filtro]}»`} ni lo pinchado abajo. La media es por partido. Verde: mejor que la media; naranja: peor; gris: no se juzga.`}
                className="mt-3"
              />
              )}
              {/* 16/11/2026 (expertos, ronda 17): «Casos escasos: …» plegado no
                  decía nada; ahora es una frase con las cifras y lo que valen. */}
              {!enVisual && comparativa.metricas.some(escasa) ? (
                <p className="mt-2 text-[12px] leading-relaxed text-white/65">
                  Con 2 casos o menos, sólo tendencia y sin veredicto:{" "}
                  {comparativa.metricas
                    .filter(escasa)
                    .map((m) => `${m.nombre.toLowerCase()}, ${m.actual ?? 0}${m.media !== null ? ` (media ${decimal(m.media)})` : ""}`)
                    .join("; ")}
                  .
                </p>
              ) : null}

              {/* 16/11/2026 (experto de fútbol): las faltas a favor en campo rival
                  son balón parado nuestro; se cuentan y se enlaza con ABP. */}
              {(() => {
                const enRival = (partido?.faltas ?? []).filter((f) => f.lado === "ofensivo" && sitioEnCampo(f).zona === "campo rival");
                if (!enRival.length) return null;
                /* Excluyentes (19/11/2026): una frontal no cuenta además como lateral; la suma da el total. */
                const frontales = enRival.filter((f) => f.distancia === "frontal").length;
                const banda = enRival.filter((f) => f.distancia !== "frontal" && f.carril && f.carril !== "centro").length;
                const trozos = [banda ? `${banda} ${banda === 1 ? "lateral" : "laterales"}` : "", frontales ? `${frontales} ${frontales === 1 ? "frontal" : "frontales"}` : ""].filter(Boolean);
                return (
                  <p className="mt-3 text-[13px] leading-relaxed text-white/75">
                    <b className="text-white/90">A balón parado:</b> {enRival.length} de {porLado.ofensivo} faltas a favor en campo rival
                    {trozos.length ? ` (${trozos.join(" y ")})` : ""}.{" "}
                    <Link href="/setpieces" className="underline decoration-dotted underline-offset-4 hover:text-white">
                      Ver qué hicimos con ellas en ABP Ofensivo
                    </Link>
                  </p>
                );
              })()}
              </>
            )}

            {partido?.notas.length ? (
              <Explicativo>
                <ul className="mt-3 space-y-1 text-[12px] text-white/40">
                  {partido.notas.map((nota) => (
                    <li key={nota}>· {nota}</li>
                  ))}
                </ul>
              </Explicativo>
            ) : null}

            <Conclusiones items={conclusiones} className="mt-4" />

            {/* 10/11/2026: Opta cuenta lo mismo (faltas pitadas): el partido al lado del etiquetado y el grupo. */}
            {/* 16/11/2026 (ronda 18): Opta es la temporada entera: en «Visual» no se mezcla con el partido. */}
            {!enVisual && (
            <OptaLaboratorio
              modo="faltas"
              partido={partido ? { rival: partido.rival, fecha: partido.fecha, jornada: jornadaCorta(partido.jornada) } : null}
              aMano={
                partido
                  ? {
                      cometidas: partido.faltas.filter((f) => f.lado === "defensivo").length,
                      recibidas: partido.faltas.filter((f) => f.lado === "ofensivo").length,
                    }
                  : null
              }
            />
            )}
            </>
            )}

            {vista === "campo" && !enVisual && bloqueCampo}

            {!enVisual && vista === "detalle" && (
            <>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <Panel title="Cuánta gente defendía" icon={Shield}>
                  {defensores ? (
                    <>
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-semibold text-[#C8A96B]">
                          {decimal(defensores.media)}
                        </span>

                        <span className="pb-1 text-sm text-white/45">
                          de media entre la falta y la portería, portero incluido
                        </span>
                      </div>

                      <p className="mt-2 text-[12px] text-white/40">
                        Entre {defensores.minimo} y {defensores.maximo}, contados en{" "}
                        {defensores.contadas} de {faltas.length}
                        {defensores.sinContar > 0 && explicativos
                          ? `. En ${defensores.sinContar} no se veía el campo entero.`
                          : "."}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-white/45">
                      Todavía no se ha podido contar en ninguna.
                    </p>
                  )}

                  {/*
                    El reparto, número a número, y cada uno se pincha: con
                    «3» marcado, la pantalla entera es de las faltas con tres
                    defensores por delante.
                  */}
                  {porEntre.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {porEntre.map((e) => (
                        <Filtrable
                          key={e.clave}
                          variante="pieza"
                          activo={estaActivo(filtros, "entre", e.clave)}
                          atenuado={hayFiltro(filtros, "entre")}
                          onClick={() => alterna("entre", e.clave)}
                          titulo={`${e.cuantas} ${e.cuantas === 1 ? "falta" : "faltas"} con ${e.clave === "?" ? "los defensores sin contar" : `${e.clave} por delante`} · ${TITULO_FILTRO}`}
                          className="inline-flex items-baseline gap-1 rounded-lg bg-white/[0.04] px-2 py-1 text-[12px]"
                        >
                          <span className="font-semibold text-white">{e.clave}</span>
                          <span className="text-white/40">×{e.cuantas}</span>
                        </Filtrable>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Faltas que cortaron algo"
                  subtitle={
                    explicativos
                      ? `Con ${CORTE_TRANSICION} defensores o menos por delante, fuera del último tercio: campo abierto`
                      : undefined
                  }
                  icon={Zap}
                >
                  {cortes.length === 0 ? (
                    <p className="text-sm text-white/45">
                      Ninguna con el campo abierto: todas se pitaron con el bloque
                      hecho.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {cortes.map((f) => (
                        <li
                          key={f.clip}
                          onMouseEnter={() => setResaltada(f.clip)}
                          onMouseLeave={() => setResaltada(null)}
                          className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 transition ${
                            resaltada === f.clip
                              ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.07]"
                              : "border-white/[0.06]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => alterna("entre", LECTORES.entre(f))}
                            aria-pressed={estaActivo(filtros, "entre", LECTORES.entre(f))}
                            title={TITULO_FILTRO}
                            className="mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-[11px] font-bold text-[#0B0F14]"
                            style={{
                              background: TINTA_LADO[f.lado],
                              ...(estaActivo(filtros, "entre", LECTORES.entre(f))
                                ? marcaPieza(true, true)
                                : {}),
                            }}
                          >
                            {f.entre}
                          </button>

                          <span className="min-w-0 text-[12px] leading-relaxed text-white/55">
                            <span className="text-white/45">{explicativos ? minutoDe(f) : minutoCorto(f)}</span>
                            {" · "}
                            <Filtrable
                              activo={filtro === f.lado}
                              onClick={() => alternaLado(f.lado)}
                              className="text-white/80"
                            >
                              {NOMBRE_LADO[f.lado]}
                            </Filtrable>
                            {" · "}
                            {celda("zona", sitioEnCampo(f).zona)}
                            {f.carril ? <> · {celda("carril", sitioEnCampo(f).carril)}</> : null}
                            {f.distancia ? <> · {celda("distancia", f.distancia)}</> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="A qué distancia" subtitle="De la portería que ataca quien la saca" icon={Swords}>
                  <div className="space-y-2">
                    {porDistancia.map((d) => (
                      <button
                        key={d.clave}
                        type="button"
                        onClick={() => alterna("distancia", d.clave)}
                        aria-pressed={estaActivo(filtros, "distancia", d.clave)}
                        title={TITULO_FILTRO}
                        style={marcaPieza(
                          estaActivo(filtros, "distancia", d.clave),
                          hayFiltro(filtros, "distancia"),
                        )}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-md text-left transition hover:opacity-100"
                      >
                        <span className="w-16 text-[11px] uppercase tracking-[0.12em] text-white/40">
                          {d.clave}
                        </span>

                        <span className="block h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <span
                            className="block h-full rounded-full bg-[#C8A96B]"
                            style={{
                              width: `${paraDistancia.length ? (d.cuantas / paraDistancia.length) * 100 : 0}%`,
                            }}
                          />
                        </span>

                        <span className="w-6 text-right text-sm text-white">
                          {d.cuantas}
                        </span>
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>
            </>
            )}

            {!enVisual && vista === "jugadores" && (
            <>
            {/* ---------------- por jugador ---------------- */}

            <Conclusiones items={frasesJugador} className="mt-5" />

            <div className="mt-4">
              <Panel
                title="Quién comete y quién recibe"
                subtitle={
                  conJugador.length === 0
                    ? undefined
                    : `${
                        ambito === "temporada"
                          ? `Temporada: suma de ${conJugador.length} ${conJugador.length === 1 ? "partido" : "partidos"} con jugador (${conJugador.map((p) => p.jornada).join(", ")})`
                          : `${conJugador[0].jornada} · ${conJugador[0].rival}`
                      }${sinJugador.length ? `. ${sinJugador.map((p) => p.jornada).join(" y ")} no ${sinJugador.length === 1 ? "entra" : "entran"}: se ${sinJugador.length === 1 ? "miró" : "miraron"} a ojo desde los clips y no ${sinJugador.length === 1 ? "tiene" : "tienen"} jugador` : ""}. Pulsa un nombre para filtrar la pantalla por él; pulsa una cabecera para ordenar`
                }
                icon={Users}
                bodyClassName="p-0"
                action={
                  <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                    {(
                      [
                        { key: "partido" as const, label: "Este partido" },
                        { key: "temporada" as const, label: "Temporada" },
                      ]
                    ).map((uno) => (
                      <button
                        key={uno.key}
                        type="button"
                        onClick={() => setAmbito(uno.key)}
                        aria-pressed={ambito === uno.key}
                        className={`rounded-lg px-3 py-1.5 text-xs transition ${
                          ambito === uno.key
                            ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        {uno.label}
                      </button>
                    ))}
                  </div>
                }
              >
                {conJugador.length === 0 ? (
                  <SinJugador>
                    {partidosJugador.every((p) => p.faltas.length === 0)
                      ? "Todavía no hay ninguna falta etiquetada."
                      : ambito === "temporada"
                        ? "Ninguno de estos partidos tiene jugador: se miraron a ojo desde los clips. El jugador sale del timeline de Hudl, desde el J5."
                        : "Este partido se miró a ojo desde los clips, sin el timeline de Hudl: no tiene jugador. Pulsa «Temporada» para ver la suma de los que sí lo tienen."}
                  </SinJugador>
                ) : paraJugador.every((f) => !f.jugador) ? (
                  <SinJugador>Ninguna falta con jugador con este filtro.</SinJugador>
                ) : (
                  <PorJugador
                    filas={paraJugador}
                    jugadorDe={jugadorDeFalta}
                    sitioDe={sitioEnCampo}
                    partidoDe={partidoDeFalta}
                    total={{ rotulo: "Faltas", explica: "Las que comete más las que recibe, con los filtros de la pantalla" }}
                    columnas={columnasJugador}
                    marcados={filtros.jugador ?? []}
                    onJugador={(j) => alterna("jugador", j)}
                  />
                )}
              </Panel>

              {explicativos && conJugador.length > 0 && (
                <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                  «Comete» son las faltas en contra que hace él; «Recibe», las que le hacen a él. El etiquetado no apunta en qué acaba cada falta, así que el peligro se lee por el sitio: en contra, las frontales y las de nuestro campo dejan un balón parado al rival; a favor, las de campo rival y las frontales nos lo dejan a nosotros. «Cortan contra»: con {CORTE_TRANSICION} defensores o menos del rival por delante, fuera del último tercio. El campo en miniatura es el de verdad: el Castilla ataca hacia la derecha y, cuanto más oro, más faltas en esa casilla.
                  {sinNombre > 0 ? ` Quedan fuera ${sinNombre} ${sinNombre === 1 ? "falta" : "faltas"} sin jugador (manos, o que no casan con una del timeline).` : ""}
                  {" "}El jugador sale del timeline de Hudl (la sesión por jugador); no se mira cuántos minutos jugó cada uno.
                </p>
              )}
            </div>
            </>
            )}

            {!enVisual && vista === "lista" && (
            <>
            {/* ---------------- una por una ---------------- */}

            {faltas.length > 0 && (
              <div className="mt-4">
                <Panel
                  title="Una por una"
                  subtitle={
                    explicativos
                      ? "En el orden en que se dieron. Pasa por encima de una fila y se enciende su punto en el campo; pincha un valor y filtra la pantalla"
                      : undefined
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">#</th>
                          <th className="pb-2 pr-3 font-medium">Lado</th>
                          {/* El nuestro: el que la comete (en contra) o el que la recibe (a favor). */}
                          <th className="pb-2 pr-3 font-medium">Jugador</th>
                          <th className="pb-2 pr-3 font-medium">Dónde</th>
                          <th className="pb-2 pr-3 font-medium">Distancia</th>
                          <th className="pb-2 pr-3 font-medium">Defendían</th>
                          {/* El minuto va siempre: es lo que hace falta para ir al vídeo. */}
                          <th className="pb-2 pr-3 font-medium">Min.</th>
                          {/* «Qué pasó» explica la jugada: sólo con los textos explicativos encendidos. */}
                          {explicativos && <th className="pb-2 pr-3 font-medium">Qué pasó</th>}
                          {/* Nuestro corte y el partido en Hudl: sólo en las que casan con una falta de Hudl. */}
                          <th className="pb-2 font-medium">Vídeo</th>
                        </tr>
                      </thead>

                      <tbody className="align-top">
                        {faltas.map((f, indice) => (
                          <tr
                            key={f.clip}
                            data-fila-accion={f.clip}
                            onMouseEnter={() => setResaltada(f.clip)}
                            onMouseLeave={() => setResaltada(null)}
                            className={`border-t border-white/[0.06] transition ${
                              resaltada === f.clip ? "bg-[#C8A96B]/[0.07]" : ""
                            }`}
                          >
                            <td className="py-2 pr-3 font-mono text-[12px] tabular-nums text-white/35">
                              {String(indice + 1).padStart(2, "0")}
                            </td>

                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                onClick={() => alternaLado(f.lado)}
                                aria-pressed={filtro === f.lado}
                                title={TITULO_FILTRO}
                                className="cursor-pointer whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                                style={{
                                  color: TINTA_LADO[f.lado],
                                  background: `${TINTA_LADO[f.lado]}1A`,
                                  ...(filtro === f.lado ? marcaPieza(true, true) : {}),
                                }}
                              >
                                {NOMBRE_LADO[f.lado]}
                              </button>
                            </td>

                            <td className="whitespace-nowrap py-2 pr-3 text-white/75">
                              {celda("jugador", f.jugador ?? "")}
                            </td>

                            <td className="py-2 pr-3 text-white/70">
                              {celda("zona", sitioEnCampo(f).zona)}
                              {f.carril ? <> · {celda("carril", sitioEnCampo(f).carril)}</> : null}
                            </td>

                            <td className="py-2 pr-3 text-white/60">
                              {celda("distancia", f.distancia)}
                            </td>

                            <td className="py-2 pr-3 font-semibold text-white">
                              {/* Sin contar (no se veía el campo entero) no se enseña. */}
                              {f.entre === null ? null : celda("entre", LECTORES.entre(f))}
                            </td>

                            <td className="whitespace-nowrap py-2 pr-3 font-mono text-[12px] tabular-nums text-white/60">
                              {explicativos ? minutoDe(f) : minutoCorto(f)}
                            </td>

                            {explicativos && <td className="py-2 pr-3 text-white/45">{f.nota}</td>}

                            <td className="py-2">
                              <VerAccion video={f.video} hudl={f.hudl} opta={enlaceOptaDe(f)} que="la falta" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            )}

            </>
            )}

            {/* ---------------- cómo se actualiza ---------------- */}

            <Explicativo>
              <div className="mt-4">
                <ComoActualizar carpetaPorDefecto={partido?.clips ?? ""} />
              </div>
            </Explicativo>
          </div>
        </section>
      </div>
    </main>
  );
}
