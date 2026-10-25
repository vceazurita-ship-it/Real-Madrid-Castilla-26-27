/**
 * LA LECTURA DE LAS FALTAS DE UN PARTIDO (25/10/2026).
 *
 * Lo que calcula /laboratorio/faltas —dónde, cuántas, cuáles cortaron una
 * transición y cómo fue este partido frente a la media de los anteriores—
 * sacado de la pantalla para que el informe post del partido y el de balón
 * parado digan lo MISMO que la pantalla. La pantalla usa `comparativaFaltas`
 * y los ayudantes de aquí; el informe, además, `lecturaFaltas`, que lo pone
 * en frases y en «qué hacer».
 *
 * Sin la falta etiquetada no hay nada que decir: si la jornada no está en
 * `lib/faltas/datos.ts`, `faltasDeJornada` da `null` y el informe no nombra
 * las faltas.
 */

import type { MetricaComparada } from "@/components/abp/ComparativaPartido";
import { anterioresPorFecha, mediaPorPartido } from "@/lib/abp/ultimo-partido";
import { PARTIDOS, type Falta, type PartidoFaltas } from "./datos";

/**
 * Por debajo de esto, la falta cortó una transición.
 *
 * Tres defensores contando al portero es un campo abierto: si ahí hubo falta,
 * no se estaba defendiendo un balón parado, se estaba frenando una carrera. El
 * corte está puesto a mano y se dice en pantalla, que es lo honesto con un
 * umbral que nadie ha calibrado con nada.
 */
export const CORTE_TRANSICION = 3;

export const enContra = (f: Falta) => f.lado === "defensivo";
export const aFavor = (f: Falta) => f.lado === "ofensivo";

/** La que frenó una transición: con el campo abierto y fuera del último tercio. */
export const cortaTransicion = (f: Falta) => f.zona !== "campo rival" && f.entre !== null && f.entre <= CORTE_TRANSICION;

/**
 * El tercio y el carril de una falta en el campo de verdad (el Castilla
 * atacando hacia la derecha).
 *
 * El etiquetado los guarda hacia la portería que ataca QUIEN SACA. Si la
 * sacamos nosotros, coinciden con nuestro campo. Si la saca el rival, ataca
 * hacia nuestra portería: su «campo propio» es nuestro campo rival, y su
 * izquierda, nuestra derecha.
 */
export function sitioEnCampo(f: Pick<Falta, "lado" | "zona" | "carril">): { zona: string; carril: string } {
  const nuestra = f.lado === "ofensivo";

  const zona =
    f.zona === "medio campo"
      ? "medio campo"
      : f.zona === "campo propio"
        ? nuestra
          ? "nuestro campo"
          : "campo rival"
        : f.zona === "campo rival"
          ? nuestra
            ? "campo rival"
            : "nuestro campo"
          : "";

  const carril = nuestra || f.carril === "centro" ? f.carril : f.carril === "izquierda" ? "derecha" : f.carril === "derecha" ? "izquierda" : "";

  return { zona, carril };
}

/** 6.25 → "6,3". */
export const decimal = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** La clave que más se repite, con cuántas veces. */
export function laQueMas(valores: string[]) {
  const cuenta = new Map<string, number>();

  for (const v of valores) if (v) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);

  let mejor: { clave: string; veces: number } | null = null;

  for (const [clave, veces] of cuenta) {
    if (!mejor || veces > mejor.veces) mejor = { clave, veces };
  }

  return mejor;
}

const mediaDe = (valores: number[]) => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null);

/** Los defensores por delante, de media, en las faltas de un lado; `null` sin ninguna contada. */
const defensoresDe = (lado: (f: Falta) => boolean) => (faltas: Falta[]) => mediaDe(faltas.filter((f) => lado(f) && f.entre !== null).map((f) => f.entre as number));

/**
 * Este partido frente a la media de los anteriores (por fecha). Sobre el
 * partido entero, sin filtros: la cifra es la misma la mire quien la mire.
 */
export function comparativaFaltas(partido: PartidoFaltas, partidos: PartidoFaltas[]) {
  const anteriores = anterioresPorFecha(partidos, partido).map((p) => p.faltas);
  const cuenta = (condicion: (f: Falta) => boolean) => (faltas: Falta[]) => faltas.filter(condicion).length;

  const metrica = (clave: string, nombre: string, condicion: (f: Falta) => boolean, mejorAlto: boolean | null, pie?: string): MetricaComparada => {
    const actual = cuenta(condicion)(partido.faltas);
    const media = mediaPorPartido(anteriores, cuenta(condicion));

    /* Con 0–2 faltas una diferencia de una no es tendencia: no se juzga y se avisa. */
    const pocas = Math.max(actual, media ?? 0) <= 2;
    /* Con menos de 5 casos tampoco se dibuja la barra: se marca como tendencia. */
    const tendencia = Math.max(actual, media ?? 0) < 5;

    return {
      clave,
      nombre,
      actual,
      media,
      tendencia,
      mejorAlto: pocas ? null : mejorAlto,
      n: actual,
      de: partido.faltas.length,
      unidad: "faltas",
      pie: pocas ? `${pie} · muestra pequeña` : pie,
    };
  };

  const metricas: MetricaComparada[] = [
    metrica("favor", "Faltas a favor", aFavor, null, "el volumen depende del estilo; lo que se juzga es dónde, en las filas de zona"),
    metrica("contra", "Faltas en contra", enContra, false, "menos, mejor"),
    metrica("favor-frontal", "A favor frontales", (f) => aFavor(f) && f.distancia === "frontal", true, "de cara a la portería rival · más, mejor"),
    metrica("contra-frontal", "En contra frontales", (f) => enContra(f) && f.distancia === "frontal", false, "de cara a nuestra portería · menos, mejor"),
    metrica("contra-nuestro", "En contra en nuestro campo", (f) => enContra(f) && sitioEnCampo(f).zona === "nuestro campo", false, "menos, mejor"),
    metrica("favor-rival", "A favor en campo rival", (f) => aFavor(f) && sitioEnCampo(f).zona === "campo rival", true, "más, mejor"),
  ];

  /* Entre partidos se promedian las medias (una por partido): cómo fue este frente a uno típico. */
  const conDefensores = (clave: string, nombre: string, lado: (f: Falta) => boolean, mejorAlto: boolean | null, pie: string) => {
    const actual = defensoresDe(lado)(partido.faltas);
    const medias = anteriores.map(defensoresDe(lado)).filter((n): n is number => n !== null);

    if (actual !== null || medias.length > 0) metricas.push({ clave, nombre, actual, media: mediaDe(medias), formato: decimal, mejorAlto, pie });
  };

  conDefensores("defensores", "Defensores por delante (a favor)", aFavor, false, "entre la falta y la portería, portero incluido · menos, mejor");
  conDefensores("defensores-contra", "Defensores por delante (en contra)", enContra, null, "los nuestros entre la falta y nuestra portería · sin juicio");

  return { partido: `${partido.jornada} · ${partido.rival}`, anteriores: anteriores.length, metricas };
}

/** El partido etiquetado de una jornada de liga («J8»), o `null` si no se ha etiquetado. */
export function faltasDeJornada(jornada: number | null | undefined, partidos: PartidoFaltas[] = PARTIDOS): PartidoFaltas | null {
  if (!jornada) return null;

  return partidos.find((p) => new RegExp(`^J0*${jornada}$`, "i").test(p.jornada.trim()) && p.faltas.length > 0) ?? null;
}

/** «88'18"» → 88; «90+8'25"» → 90 con añadido. `null` sin minuto. */
function minutoDe(f: Falta): { minuto: number; anadido: boolean } | null {
  const m = f.minuto?.trim().match(/^(\d{1,3})(\+\d+)?'/);

  return m ? { minuto: Number(m[1]), anadido: Boolean(m[2]) } : null;
}

const TRAMOS = ["0-15′", "15-30′", "30-45′", "45-60′", "60-75′", "75-90′"];

/** El tramo de 15 minutos; el añadido va con el último tramo de su parte. */
const tramoDe = (m: { minuto: number; anadido: boolean }) => Math.min(5, Math.max(0, Math.floor((m.anadido ? m.minuto - 1 : m.minuto) / 15)));

/** Una fila de la tabla del informe: este partido, la media y si fue mejor o peor. */
export type FilaFaltas = { nombre: string; actual: string; media: string; lectura: "mejor" | "peor" | "igual" | null };

export type LecturaFaltas = {
  /** «J8 · Antequera CF». */
  partido: string;
  favor: number;
  contra: number;
  anteriores: number;
  /** La frase de arriba, con la cifra que manda. */
  titular: string;
  /** Hechos: dónde, cuándo, quién. Sólo los que tienen dato. */
  hechos: string[];
  /** Lo que se lleva al campo; puede ir vacío si el partido no deja nada claro. */
  queHacer: string[];
  filas: FilaFaltas[];
};

const nombreZona = (z: string) => (z === "nuestro campo" ? "nuestro campo" : z === "campo rival" ? "campo rival" : "el medio campo");
const porCarril = (c: string) => (c === "centro" ? "por el centro" : `por la ${c}`);

/**
 * Las faltas del partido en frases para el informe post: el recuento con su
 * media, dónde se cometen y se reciben, en qué tramo, quién, las que
 * cortaron una transición y qué hacer. Nada de lo que no hay dato.
 */
export function lecturaFaltas(partido: PartidoFaltas, partidos: PartidoFaltas[] = PARTIDOS): LecturaFaltas {
  const { metricas, anteriores } = comparativaFaltas(partido, partidos);
  const faltas = partido.faltas;
  const contra = faltas.filter(enContra);
  const favor = faltas.filter(aFavor);
  const valor = (clave: string) => metricas.find((m) => m.clave === clave);
  const media = (clave: string) => valor(clave)?.media ?? null;
  const conMedia = (clave: string) => (media(clave) !== null && anteriores ? ` (media ${decimal(media(clave) as number)})` : "");

  /* Peor con muestra: el `mejorAlto` ya viene a null si la muestra es pequeña. */
  const juicio = (m: MetricaComparada): FilaFaltas["lectura"] => {
    if (m.actual === null || m.media === null || m.mejorAlto === null || m.mejorAlto === undefined) return null;

    const dif = m.actual - m.media;

    if (Math.abs(dif) < 1 && !m.formato) return "igual";
    if (m.formato && Math.abs(dif) < 0.5) return "igual";

    return (dif > 0) === m.mejorAlto ? "mejor" : "peor";
  };

  const filas: FilaFaltas[] = metricas
    .filter((m) => m.actual !== null)
    .map((m) => ({
      nombre: m.nombre,
      actual: m.formato ? m.formato(m.actual as number) : String(m.actual),
      media: m.media === null ? "" : decimal(m.media),
      lectura: juicio(m),
    }));

  const hechos: string[] = [];
  const queHacer: string[] = [];

  /* Dónde las cometemos (en el campo de verdad). */
  if (contra.length) {
    const zona = laQueMas(contra.map((f) => sitioEnCampo(f).zona));
    const carril = laQueMas(contra.map((f) => sitioEnCampo(f).carril));
    const enNuestro = contra.filter((f) => sitioEnCampo(f).zona === "nuestro campo").length;
    const frontales = contra.filter((f) => f.distancia === "frontal").length;

    hechos.push(
      `Cometidas: ${contra.length}${conMedia("contra")}${zona && carril ? `, sobre todo en ${nombreZona(zona.clave)} (${zona.veces}) y ${porCarril(carril.clave)} (${carril.veces})` : ""}${enNuestro ? `; ${enNuestro} en nuestro campo` : ""}${frontales ? `, ${frontales} ${frontales === 1 ? "frontal" : "frontales"}` : ""}.`,
    );
  }

  /* Dónde nos las hacen. */
  if (favor.length) {
    const zona = laQueMas(favor.map((f) => sitioEnCampo(f).zona));
    const enRival = favor.filter((f) => sitioEnCampo(f).zona === "campo rival").length;
    const frontales = favor.filter((f) => f.distancia === "frontal").length;

    hechos.push(
      `Recibidas: ${favor.length}${conMedia("favor")}${zona ? `, sobre todo en ${nombreZona(zona.clave)} (${zona.veces})` : ""}${enRival ? `; ${enRival} en campo rival` : ""}${frontales ? `, ${frontales} ${frontales === 1 ? "frontal" : "frontales"}` : ""}.`,
    );
  }

  /* Cuándo: sólo con minuto en al menos la mitad de las faltas. */
  const conMinuto = faltas.map((f) => ({ f, m: minutoDe(f) })).filter((x): x is { f: Falta; m: { minuto: number; anadido: boolean } } => x.m !== null);

  if (conMinuto.length >= Math.max(4, faltas.length / 2)) {
    const tramoContra = laQueMas(conMinuto.filter((x) => enContra(x.f)).map((x) => TRAMOS[tramoDe(x.m)]));
    const primera = conMinuto.filter((x) => enContra(x.f) && tramoDe(x.m) <= 2).length;
    const segunda = conMinuto.filter((x) => enContra(x.f) && tramoDe(x.m) >= 3).length;

    if (tramoContra && tramoContra.veces >= 3) hechos.push(`Por minuto: ${primera} cometidas en la primera parte y ${segunda} en la segunda; el tramo con más, ${tramoContra.clave} (${tramoContra.veces}).`);
  }

  /* Las que cortaron una transición, de cada lado. */
  const cortamos = contra.filter(cortaTransicion);
  const nosCortan = favor.filter(cortaTransicion);

  if (cortamos.length || nosCortan.length) {
    hechos.push(
      [
        cortamos.length ? `${cortamos.length} ${cortamos.length === 1 ? "falta nuestra paró una contra suya" : "faltas nuestras pararon contras suyas"} con el campo abierto` : "",
        nosCortan.length ? `${nosCortan.length} ${nosCortan.length === 1 ? "suya nos paró una contra" : "suyas nos pararon contras"}` : "",
      ]
        .filter(Boolean)
        .join("; ")
        .replace(/^./, (c) => c.toUpperCase()) + ` (${CORTE_TRANSICION} defensores o menos por delante).`,
    );
  }

  /* Quién: sólo si hay jugador etiquetado y alguien repite. */
  const elQueMas = (filas: Falta[]) => laQueMas(filas.map((f) => f.jugador ?? ""));
  const comete = elQueMas(contra);
  const recibe = elQueMas(favor);

  if ((comete && comete.veces >= 2) || (recibe && recibe.veces >= 2)) {
    hechos.push(
      [comete && comete.veces >= 2 ? `más faltas cometidas: ${comete.clave} (${comete.veces})` : "", recibe && recibe.veces >= 2 ? `más faltas recibidas: ${recibe.clave} (${recibe.veces})` : ""]
        .filter(Boolean)
        .join(" · ")
        .replace(/^./, (c) => c.toUpperCase()) + ".",
    );
  }

  /* QUÉ HACER: sólo lo que el dato sostiene (peor que la media con muestra, o cifras que por sí solas son balón parado). */
  const filaPeor = (clave: string) => {
    const m = valor(clave);

    return m ? juicio(m) === "peor" : false;
  };

  const enNuestro = contra.filter((f) => sitioEnCampo(f).zona === "nuestro campo");
  const frontalesContra = contra.filter((f) => f.distancia === "frontal");

  if (frontalesContra.length >= 2 || filaPeor("contra-frontal") || filaPeor("contra-nuestro")) {
    const quien = laQueMas([...new Set([...enNuestro, ...frontalesContra])].map((f) => f.jugador ?? ""));

    queHacer.push(
      `Defender sin falta en nuestro campo: ${enNuestro.length} en nuestro campo y ${frontalesContra.length} ${frontalesContra.length === 1 ? "frontal" : "frontales"} son balón parado regalado${quien && quien.veces >= 2 ? `; revisar los duelos de ${quien.clave} (${quien.veces})` : ""}.`,
    );
  }

  if (filaPeor("contra")) {
    queHacer.unshift(`Bajar las faltas cometidas: ${contra.length}, por encima de la media (${decimal(media("contra") as number)}).`);
  }

  /* El final del partido: si el último tramo se lleva buena parte de las cometidas. */
  const alFinal = conMinuto.filter((x) => enContra(x.f) && tramoDe(x.m) === 5).length;

  if (alFinal >= 4 && alFinal >= contra.length / 3) {
    queHacer.push(`Cuidar el final: ${alFinal} de las ${contra.length} faltas cometidas llegaron en el 75-90′; ahí pesan los cambios y la gestión del marcador.`);
  }

  if (cortamos.length >= 2) {
    queHacer.push(`Vigilancia tras pérdida: ${cortamos.length} contras suyas hubo que pararlas con falta; colocar antes a los que vigilan para no depender de la falta.`);
  }

  const enRival = favor.filter((f) => sitioEnCampo(f).zona === "campo rival").length;

  if (enRival >= 3) {
    queHacer.push(`Sacarle partido: ${enRival} faltas a favor en campo rival; tener preparada la jugada de falta lateral y directa.`);
  } else if (filaPeor("favor-rival")) {
    queHacer.push(`Pisar más su campo: ${enRival} ${enRival === 1 ? "falta recibida" : "faltas recibidas"} en campo rival, por debajo de la media (${decimal(media("favor-rival") as number)}).`);
  }

  const titular = filaPeor("contra")
    ? `Faltas: ${contra.length} cometidas, por encima de la media (${decimal(media("contra") as number)})`
    : frontalesContra.length >= 2 || filaPeor("contra-nuestro")
      ? `Faltas: ${contra.length} cometidas, ${enNuestro.length} en nuestro campo`
      : `Faltas: ${contra.length} cometidas y ${favor.length} recibidas${anteriores ? ` (media ${decimal(media("contra") ?? 0)} y ${decimal(media("favor") ?? 0)})` : ""}`;

  return { partido: `${partido.jornada} · ${partido.rival}`, favor: favor.length, contra: contra.length, anteriores, titular, hechos, queHacer, filas };
}
