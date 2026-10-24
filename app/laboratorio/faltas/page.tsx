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
import { BarChart3, Crosshair, LayoutDashboard, List, Map as MapIcon, Shield, Swords, Users, Zap } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Panel } from "@/components/abp/ui";
import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { ComparativaPartido, mediaPorPartido, type MetricaComparada } from "@/components/abp/ComparativaPartido";
import { anterioresPorFecha, ultimoPorFecha } from "@/lib/abp/ultimo-partido";
import { PARTIDOS, type Falta, type LadoFalta } from "@/lib/faltas/datos";
import { CampoFaltas, CARRILES_CAMPO, sitioEnCampo, ZONAS_CAMPO } from "@/components/faltas/CampoFaltas";
import { ComoActualizar } from "@/components/faltas/ComoActualizar";
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

/**
 * Por debajo de esto, la falta cortó una transición.
 *
 * Tres defensores contando al portero es un campo abierto: si ahí hubo falta,
 * no se estaba defendiendo un balón parado, se estaba frenando una carrera. El
 * corte está puesto a mano y se dice en pantalla, que es lo honesto con un
 * umbral que nadie ha calibrado con nada.
 */
const CORTE_TRANSICION = 3;

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

/** "12'03\" (táctica 12:58)" o «—» cuando no se sabe. */
const minutoDe = (f: Falta) => f.minuto?.trim() || "—";

/** Sin el segundo del vídeo táctico, que es del método: "12'03\" (táctica 12:58)" → "12'03\"". */
const minutoCorto = (f: Falta) => minutoDe(f).replace(/\s*\(t[aá]ctica[^)]*\)/i, "");

/* Las vistas de la pantalla: resumen, el campo, el detalle y la lista. */
const VISTAS = ["resumen", "campo", "detalle", "jugadores", "lista"] as const;

/* ------------------------------------------------------------------ */
/*  Por jugador (19/10/2026)                                           */
/* ------------------------------------------------------------------ */

type FaltaVista = Falta & { partido: string };

const enContra = (f: Falta) => f.lado === "defensivo";
const aFavor = (f: Falta) => f.lado === "ofensivo";

/** La que frenó una transición: con el campo abierto y fuera del último tercio (ver `cortes`). */
const cortaTransicion = (f: Falta) =>
  f.zona !== "campo rival" && f.entre !== null && f.entre <= CORTE_TRANSICION;

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

/** Si hay algún partido de pretemporada en los datos (hoy, ninguno). */
const HAY_PRETEMPORADA = PARTIDOS.some((p) => esPretemporada(p.jornada));

/** 6.25 → "6,3". */
const decimal = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** La clave que más se repite, con cuántas veces. */
function laQueMas(valores: string[]) {
  const cuenta = new Map<string, number>();

  for (const v of valores) if (v) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);

  let mejor: { clave: string; veces: number } | null = null;

  for (const [clave, veces] of cuenta) {
    if (!mejor || veces > mejor.veces) mejor = { clave, veces };
  }

  return mejor;
}

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
  const [filtro, setFiltro] = useState<Filtro>("todas");
  /*
  | La pretemporada, fuera salvo que se pida: los amistosos no se leen igual
  | que la liga. Hoy no hay ninguno en los datos y el mando ni sale.
  */
  const [conPretemporada, setConPretemporada] = useState(false);

  const partidosVisibles = useMemo(
    () => (conPretemporada ? PARTIDOS : PARTIDOS.filter((p) => !esPretemporada(p.jornada))),
    [conPretemporada],
  );

  /*
  | Se abre por el último partido analizado: el lunes se quiere ver lo del
  | domingo, no la primera jornada. Si al quitar la pretemporada el elegido
  | desaparece, se vuelve al último de los que quedan.
  */
  const [partidoId, setPartidoId] = useState<string>(ultimoPorFecha(partidosVisibles)?.id ?? "");

  /** Los botones de partido, en el orden en que se jugaron (como en Robos y Pérdidas). */
  const partidosEnOrden = useMemo(
    () => [...partidosVisibles].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [partidosVisibles],
  );

  /** «Por jugador»: el partido elegido o la temporada (los partidos con jugador). */
  const [ambito, setAmbito] = useState<"partido" | "temporada">("partido");

  /** La falta que está encendida, compartida entre el campo y la tabla. */
  const [resaltada, setResaltada] = useState<string | null>(null);

  /** Lo que se ha pinchado: zona, carril, distancia y defensores. */
  const { filtros, alterna, alternaVarios, quita, limpia } = useFiltrosCruzados();

  const partido = useMemo(
    () =>
      partidosVisibles.find((p) => p.id === partidoId) ?? ultimoPorFecha(partidosVisibles),
    [partidoId, partidosVisibles],
  );

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

    if (ultimoTercio || frontales) {
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

    frases.push(
      cortes.length
        ? `${cortes.length} ${cortes.length === 1 ? "cortó" : "cortaron"} una transición con el campo abierto.`
        : "Ninguna cortó una transición: siempre con bloque hecho.",
    );

    return frases;
  }, [faltas, filtro, filtros, porLado, defensores, cortes]);

  /*
  | Este partido frente a la media de los anteriores (por fecha). Se calcula
  | sobre el partido entero, sin el lado ni lo pinchado: así la cifra es la
  | misma la mire quien la mire y no cambia al filtrar la pantalla. La zona
  | va en el campo de verdad (`sitioEnCampo`), para que «campo rival» sea lo
  | mismo en una falta nuestra que en una del rival.
  */
  const comparativa = useMemo(() => {
    if (!partido) return null;

    const anteriores = anterioresPorFecha(partidosVisibles, partido).map((p) => p.faltas);
    const aFavor = (f: Falta) => f.lado === "ofensivo";
    const enContra = (f: Falta) => f.lado === "defensivo";
    const cuenta = (condicion: (f: Falta) => boolean) => (faltas: Falta[]) =>
      faltas.filter(condicion).length;

    /** Los defensores por delante en las faltas a favor, de media; `null` sin ninguna contada. */
    const defensoresAFavor = (faltas: Falta[]) => {
      const con = faltas.filter((f) => aFavor(f) && f.entre !== null).map((f) => f.entre as number);

      return con.length === 0 ? null : con.reduce((a, b) => a + b, 0) / con.length;
    };

    const metrica = (
      clave: string,
      nombre: string,
      condicion: (f: Falta) => boolean,
      mejorAlto: boolean | null,
      pie?: string,
    ): MetricaComparada => {
      const actual = cuenta(condicion)(partido.faltas);
      const media = mediaPorPartido(anteriores, cuenta(condicion));

      /* Con 0–2 faltas una diferencia de una no es tendencia: no se juzga y se avisa. */
      const pocas = Math.max(actual, media ?? 0) <= 2;

      return {
        clave,
        nombre,
        actual,
        media,
        mejorAlto: pocas ? null : mejorAlto,
        /* Con tan pocas, «igual» parece una conclusión: la base va en la descripción de la fila. */
        pie: pocas ? `${pie} · muestra pequeña, de ${partido.faltas.length} faltas` : pie,
      };
    };

    const metricas: MetricaComparada[] = [
      metrica("favor", "Faltas a favor", aFavor, null, "sin juicio: depende del estilo"),
      metrica("contra", "Faltas en contra", enContra, false, "menos, mejor"),
      metrica("favor-frontal", "A favor frontales", (f) => aFavor(f) && f.distancia === "frontal", true, "de cara a la portería rival · más, mejor"),
      metrica("contra-frontal", "En contra frontales", (f) => enContra(f) && f.distancia === "frontal", false, "de cara a nuestra portería · menos, mejor"),
      metrica("contra-nuestro", "En contra en nuestro campo", (f) => enContra(f) && sitioEnCampo(f).zona === "nuestro campo", false, "menos, mejor"),
      metrica("favor-rival", "A favor en campo rival", (f) => aFavor(f) && sitioEnCampo(f).zona === "campo rival", true, "más, mejor"),
    ];

    /*
    | La media de defensores sólo si hay alguna falta a favor contada. Entre
    | partidos se promedian las medias (una por partido), que es lo que mide
    | el panel: cómo fue este partido frente a uno típico.
    */
    const actualDefensores = defensoresAFavor(partido.faltas);
    const conDefensores = anteriores.map(defensoresAFavor).filter((n): n is number => n !== null);

    if (actualDefensores !== null || conDefensores.length > 0) {
      metricas.push({
        clave: "defensores",
        nombre: "Defensores por delante (a favor)",
        actual: actualDefensores,
        media: conDefensores.length === 0 ? null : conDefensores.reduce((a, b) => a + b, 0) / conDefensores.length,
        formato: decimal,
        mejorAlto: false,
        pie: "entre la falta y la portería, portero incluido · menos, mejor",
      });
    }

    /* Los de las faltas en contra: la conclusión cita su media y la tabla la tiene que enseñar. */
    const defensoresEnContra = (faltas: Falta[]) => {
      const con = faltas.filter((f) => enContra(f) && f.entre !== null).map((f) => f.entre as number);

      return con.length === 0 ? null : con.reduce((a, b) => a + b, 0) / con.length;
    };
    const actualContra = defensoresEnContra(partido.faltas);
    const mediasContra = anteriores.map(defensoresEnContra).filter((n): n is number => n !== null);

    if (actualContra !== null || mediasContra.length > 0) {
      metricas.push({
        clave: "defensores-contra",
        nombre: "Defensores por delante (en contra)",
        actual: actualContra,
        media: mediasContra.length === 0 ? null : mediasContra.reduce((a, b) => a + b, 0) / mediasContra.length,
        formato: decimal,
        mejorAlto: null,
        pie: "los nuestros entre la falta y nuestra portería · sin juicio",
      });
    }

    return { partido: `${partido.jornada} · ${partido.rival}`, anteriores: anteriores.length, metricas };
  }, [partido, partidosVisibles]);

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

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
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

            {/* ---------------- mandos ---------------- */}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {partidosEnOrden.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPartidoId(p.id);
                    setResaltada(null);
                  }}
                  aria-pressed={partido?.id === p.id}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    partido?.id === p.id
                      ? "border-[#C8A96B]/40 bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                  }`}
                >
                  {p.jornada} · {p.rival}
                </button>
              ))}

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
                {faltas.length} {faltas.length === 1 ? "falta" : "faltas"}
              </span>
            </div>

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

            {vista === "resumen" && (
            <>
            {/* ---------------- el partido ---------------- */}

            {partido && (
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  {partido.jornada}
                </span>

                <span className="text-sm font-semibold text-white">
                  {partido.local
                    ? `RM Castilla · ${partido.rival}`
                    : `${partido.rival} · RM Castilla`}
                </span>

                <span
                  className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[12px] tabular-nums"
                  style={{ color: "rgb(var(--rmcf-ink-rgb) / .9)" }}
                >
                  {partido.resultado}
                </span>

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

            {/* ---------------- frente a los anteriores ---------------- */}

            {comparativa && (
              <ComparativaPartido
                partido={comparativa.partido}
                anteriores={{ n: comparativa.anteriores }}
                metricas={comparativa.metricas}
                nota={`Sobre el partido entero, sin el filtro de ${filtro === "todas" ? "lado" : `«${NOMBRE_LADO[filtro]}»`} ni lo pinchado abajo. La media es por partido. Verde: mejor que la media; naranja: peor; gris: no se juzga.`}
                className="mt-3"
              />
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
            </>
            )}

            {vista === "campo" && (
            <>
            {/* ---------------- el campo ---------------- */}

            <div className="mt-5">
              <Panel
                title="Dónde se cometen"
                subtitle={
                  explicativos
                    ? "Cada punto es una falta, en su tercio y su carril del campo de verdad: el Castilla ataca hacia la derecha, también en las faltas que saca el rival. El etiquetado guarda zonas, no metros: dentro de cada zona los puntos se reparten para no taparse"
                    : undefined
                }
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
                  onZona={(zona) => alterna("zona", zona)}
                  onCarril={(carril) => alterna("carril", carril)}
                  onLado={alternaLado}
                />

                {sinSitio > 0 && explicativos && (
                  <p className="mt-3 text-[11px] text-white/35">
                    {sinSitio}{" "}
                    {sinSitio === 1
                      ? "falta no se pudo situar"
                      : "faltas no se pudieron situar"}{" "}
                    en el campo y no salen dibujadas.
                  </p>
                )}
              </Panel>

            </div>
            </>
            )}

            {vista === "detalle" && (
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

            {vista === "jugadores" && (
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

            {vista === "lista" && (
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
                          {explicativos && <th className="pb-2 font-medium">Qué pasó</th>}
                        </tr>
                      </thead>

                      <tbody className="align-top">
                        {faltas.map((f, indice) => (
                          <tr
                            key={f.clip}
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
                              {celda("entre", LECTORES.entre(f))}
                            </td>

                            <td className="whitespace-nowrap py-2 pr-3 font-mono text-[12px] tabular-nums text-white/60">
                              {explicativos ? minutoDe(f) : minutoCorto(f)}
                            </td>

                            {explicativos && <td className="py-2 text-white/45">{f.nota}</td>}
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
