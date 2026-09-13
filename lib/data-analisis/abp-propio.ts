import Papa from "papaparse";

import { ABP_GIDS, sheetUrl, type SheetRow } from "@/lib/abp/sheets";
import { abpFamily, abpResult, num, type AbpFamily, type AbpOwner } from "@/lib/abp/model";
import { parseJornada, type JornadaAbp } from "@/lib/abp/partido";
import { traeCsv } from "@/lib/hojaCsv";

/**
 * NUESTRO BALÓN PARADO. NO ES WYSCOUT NI ES OPTA.
 *
 * Esto no baja de ninguna plataforma: lo escribe el cuerpo técnico acción por
 * acción en las cuatro hojas de ABP, y por eso tiene cosas que ningún informe
 * comprado tiene —la rutina ensayada, quién saca, la calidad del envío, cuántos
 * atacantes van al área, quién gana el rechace— y una limitación que ningún
 * informe comprado tiene: **sólo existen nuestros partidos**. No hay liga con
 * la que compararse porque nadie ha registrado los ABP de los otros veinte.
 *
 * Eso obliga a dos cosas, y las dos se respetan aquí:
 *
 * 1. **Decirlo en pantalla, siempre.** Un número de esta sección al lado de uno
 *    de Opta se leería como si fueran la misma cosa medida igual, y no lo son.
 * 2. **Separar liga de pretemporada.** De los diez partidos registrados, siete
 *    son amistosos de julio contra equipos que no son de esta categoría.
 *    Mezclarlos con las tres jornadas de liga da una media que no describe a
 *    nadie.
 *
 * La trampa de las hojas —documentada en `abpResult`— es que **no comparten
 * convención**: en la de córners en contra el sujeto implícito es el rival, de
 * modo que «Ocasión» allí es una ocasión SUYA. Se declara bloque a bloque.
 */

export type BloqueAbp = "piezasOf" | "piezasDef" | "bandaOf" | "bandaDef";

export const BLOQUES: {
  key: BloqueAbp;
  label: string;
  corto: string;
  /** De quién es el balón parado. */
  nuestro: boolean;
  /** Quién ataca, y por tanto de quién es el peligro que se cuenta. */
  dueno: AbpOwner;
  /** El sujeto implícito de `Resultado_Final` en esa hoja. */
  implicito: AbpOwner;
  pregunta: string;
}[] = [
  {
    key: "piezasOf",
    label: "Córners y faltas a favor",
    corto: "Piezas a favor",
    nuestro: true,
    dueno: "rmcf",
    implicito: "rmcf",
    pregunta: "¿Sacamos algo de lo que ensayamos?",
  },
  {
    key: "piezasDef",
    label: "Córners y faltas en contra",
    corto: "Piezas en contra",
    nuestro: false,
    dueno: "rival",
    /* Aquí el sujeto de «Ocasión» es el que ataca, que es el rival. */
    implicito: "rival",
    pregunta: "¿Cuánto nos hacen de córner y de falta?",
  },
  {
    key: "bandaOf",
    label: "Saques de banda a favor",
    corto: "Banda a favor",
    nuestro: true,
    dueno: "rmcf",
    implicito: "rmcf",
    pregunta: "¿El saque de banda nos hace progresar o lo regalamos?",
  },
  {
    key: "bandaDef",
    label: "Saques de banda en contra",
    corto: "Banda en contra",
    nuestro: false,
    dueno: "rival",
    /* Las dos hojas de banda sí son absolutas: sin sufijo es del RMCF. */
    implicito: "rmcf",
    pregunta: "¿Les dejamos salir por banda?",
  },
];

export const BLOQUE_POR_KEY = new Map(BLOQUES.map((b) => [b.key, b]));

export type AccionAbp = {
  bloque: BloqueAbp;
  jornada: JornadaAbp;
  rival: string;
  familia: AbpFamily;
  /** `Tipo_Accion` tal cual, que es donde vive la zona de la falta. */
  tipo: string;
  envio: string;
  zonaSaque: string;
  zonaCaida: string;
  calidad: number;
  atacantes: number;
  bloqueadores: number;
  remate: boolean;
  rematador: string;
  zonaRemate: string;
  xg: number;
  segundoBalon: string;
  sacador: string;
  receptor: string;
  rutina: string;
  resultado: string;
  /** Gol u ocasión para quien ataca en ese bloque. */
  peligro: boolean;
  gol: boolean;
  /** Sólo en saque de banda: el balón siguió siendo nuestro. */
  retenido: boolean;
};

const texto = (fila: SheetRow, ...nombres: string[]) => {
  for (const nombre of nombres) {
    const valor = String(fila[nombre] ?? "").trim();

    if (valor) return valor;
  }

  return "";
};

const esSi = (valor: string) => /^s[ií]$/i.test(valor.trim());

/** Una fila de hoja, traducida a lo que esta sección necesita. */
function leeAccion(fila: SheetRow, bloque: BloqueAbp): AccionAbp | null {
  const meta = BLOQUE_POR_KEY.get(bloque)!;

  const jornada = parseJornada(texto(fila, "JORNADA"));

  if (!jornada.bruto) return null;

  const tipo = texto(fila, "Tipo_Accion") || (bloque.startsWith("banda") ? "Saque de banda" : "");

  const bruto = texto(fila, "Resultado_Final");

  const resultado = abpResult(bruto, meta.implicito);

  /*
  | «PENALTI» como resultado final.
  |
  | Sacar un penalti de un córner es de lo mejor que puede pasar, y `abpResult`
  | no lo conoce —no está entre sus etiquetas— así que caía en «Sin dato» y se
  | contaba como si no hubiera pasado nada. Se corrige aquí y no en
  | `abpResult` a propósito: esa función la comparten las cinco pantallas de
  | balón parado y cambiarla movería sus números sin que nadie lo haya pedido.
  */
  const esPenalti =
    resultado.rank === 0 &&
    /penalt/i.test(bruto) &&
    /* De quién es el penalti: lo dice la celda o, si calla, la hoja. */
    (/\brival\b/i.test(bruto)
      ? meta.dueno === "rival"
      : meta.implicito === meta.dueno);

  const zonaSaque = texto(fila, "Zona_Saque");

  return {
    bloque,
    jornada,
    rival: texto(fila, "Rival"),
    familia: bloque.startsWith("banda") ? "banda" : abpFamily(tipo),
    tipo,
    envio: texto(fila, "Tipo_Envio"),
    zonaSaque,
    zonaCaida: texto(fila, "Zona_Caida"),
    calidad: num(texto(fila, "Calidad_Envio")),
    atacantes: num(texto(fila, "N_Atacantes")),
    bloqueadores: num(texto(fila, "N_Bloqueadores")),
    remate: esSi(texto(fila, "Remate")),
    rematador: texto(fila, "Rematador"),
    zonaRemate: texto(fila, "Zona_Remate"),
    xg: num(texto(fila, "xG")),
    segundoBalon: texto(fila, "Segundo_Balon"),
    sacador: texto(fila, "Sacador"),
    receptor: texto(fila, "Receptor"),
    rutina: texto(fila, "Rutina", "Patron"),
    resultado: esPenalti ? "Penalti" : resultado.label,
    peligro:
      esPenalti || (resultado.owner === meta.dueno && resultado.rank >= 4),
    gol: resultado.owner === meta.dueno && resultado.rank >= 5,
    /*
    | Retención: sólo tiene sentido en el saque de banda, y sólo del lado de
    | quien lo saca. Que el balón siga siendo suyo no es un éxito —un
    | «Posicional» no hace daño a nadie— pero perderlo en el saque sí es un
    | fallo, y es lo que mide esta columna.
    */
    retenido:
      bloque.startsWith("banda") &&
      resultado.owner === (meta.nuestro ? "rmcf" : "rival") &&
      resultado.rank >= 1,
  };
}

export type DatosAbpPropio = {
  acciones: AccionAbp[];
  /** Lo que se ha podido leer y lo que no. */
  error: string | null;
};

/**
 * Las cuatro hojas, leídas de una vez.
 *
 * Pasa por `traeCsv`, que guarda cada hoja mientras dure la pestaña: estas
 * mismas cuatro las piden también las páginas de balón parado, y bajarlas dos
 * veces por navegar entre secciones son segundos de reloj de arena.
 */
export async function leeAbpPropio(): Promise<DatosAbpPropio> {
  const acciones: AccionAbp[] = [];

  const fallos: string[] = [];

  await Promise.all(
    BLOQUES.map(async (bloque) => {
      try {
        const bruto = await traeCsv(sheetUrl(ABP_GIDS[bloque.key]));

        const parsed = Papa.parse<SheetRow>(bruto, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (cabecera) => cabecera.trim(),
        });

        for (const fila of parsed.data) {
          if (!Object.values(fila).some((v) => String(v ?? "").trim())) continue;

          const accion = leeAccion(fila, bloque.key);

          if (accion) acciones.push(accion);
        }
      } catch {
        fallos.push(bloque.label.toLowerCase());
      }
    }),
  );

  return {
    acciones,
    error: fallos.length ? `No se han podido leer: ${fallos.join(", ")}.` : null,
  };
}

/* ------------------------------------------------------------------ */
/*  LO QUE SE SACA DE LAS ACCIONES                                     */
/* ------------------------------------------------------------------ */

export type ResumenAbp = {
  acciones: number;
  partidos: number;
  porPartido: number;
  remates: number;
  cuotaRemate: number;
  xg: number;
  xgPorAccion: number;
  goles: number;
  peligros: number;
  cuotaPeligro: number;
  /** Cuántas acciones hacen falta para un gol. */
  accionesPorGol: number | null;
  /** Sólo en saque de banda: qué parte conserva quien saca. */
  retenidos: number;
  cuotaRetencion: number;
};

export function resumeAbp(acciones: AccionAbp[]): ResumenAbp {
  const partidos = new Set(acciones.map((a) => a.jornada.clave)).size;

  const remates = acciones.filter((a) => a.remate).length;
  const goles = acciones.filter((a) => a.gol).length;
  const peligros = acciones.filter((a) => a.peligro).length;
  const retenidos = acciones.filter((a) => a.retenido).length;

  const xg = acciones.reduce((s, a) => s + a.xg, 0);

  return {
    acciones: acciones.length,
    partidos,
    porPartido: partidos ? acciones.length / partidos : 0,
    remates,
    cuotaRemate: acciones.length ? (remates / acciones.length) * 100 : 0,
    xg,
    xgPorAccion: acciones.length ? xg / acciones.length : 0,
    goles,
    peligros,
    cuotaPeligro: acciones.length ? (peligros / acciones.length) * 100 : 0,
    accionesPorGol: goles ? acciones.length / goles : null,
    retenidos,
    cuotaRetencion: acciones.length ? (retenidos / acciones.length) * 100 : 0,
  };
}

/** El reparto de un campo, de mayor a menor y sin los vacíos. */
export function repartoPor(
  acciones: AccionAbp[],
  campo: (a: AccionAbp) => string,
) {
  const mapa = new Map<string, number>();

  for (const accion of acciones) {
    const clave = campo(accion).trim();

    if (!clave || /^no aplica$/i.test(clave)) continue;

    mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
  }

  return [...mapa.entries()]
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * Cuánto daño hace cada variante de algo.
 *
 * Devuelve, por cada valor del campo, cuántas acciones hay y qué parte acaba
 * en gol u ocasión. Es la pregunta que de verdad se hace al elegir una
 * rutina: no «cuántos córners bombeamos» sino «cuántos de los bombeados hacen
 * daño».
 */
export function peligroPor(
  acciones: AccionAbp[],
  campo: (a: AccionAbp) => string,
  minimo = 3,
) {
  const mapa = new Map<string, { total: number; peligro: number; xg: number }>();

  for (const accion of acciones) {
    const clave = campo(accion).trim();

    if (!clave || /^no aplica$/i.test(clave)) continue;

    const fila = mapa.get(clave) ?? { total: 0, peligro: 0, xg: 0 };

    fila.total += 1;
    fila.peligro += accion.peligro ? 1 : 0;
    fila.xg += accion.xg;

    mapa.set(clave, fila);
  }

  return [...mapa.entries()]
    .filter(([, v]) => v.total >= minimo)
    .map(([etiqueta, v]) => ({
      etiqueta,
      total: v.total,
      peligro: v.peligro,
      cuota: (v.peligro / v.total) * 100,
      xg: v.xg,
    }))
    .sort((a, b) => b.cuota - a.cuota);
}

/** La serie por jornada, en el orden en que se jugó. */
export function porJornadaAbp(
  acciones: AccionAbp[],
  metrica: "acciones" | "peligro" | "xg",
) {
  const mapa = new Map<string, { jornada: JornadaAbp; lista: AccionAbp[] }>();

  for (const accion of acciones) {
    const fila = mapa.get(accion.jornada.clave) ?? {
      jornada: accion.jornada,
      lista: [],
    };

    fila.lista.push(accion);

    mapa.set(accion.jornada.clave, fila);
  }

  /* Cronológico de verdad: la pretemporada es de julio y va delante. */
  const orden = [...mapa.values()].sort((a, b) => {
    const bloque = (j: JornadaAbp) => (j.competicion === "amistoso" ? 0 : 1);

    if (bloque(a.jornada) !== bloque(b.jornada)) {
      return bloque(a.jornada) - bloque(b.jornada);
    }

    return (a.jornada.numero ?? 0) - (b.jornada.numero ?? 0);
  });

  return orden.map((fila) => ({
    etiqueta: fila.jornada.corto,
    valor:
      metrica === "acciones"
        ? fila.lista.length
        : metrica === "xg"
          ? Number(fila.lista.reduce((s, a) => s + a.xg, 0).toFixed(2))
          : fila.lista.length
            ? Number(
                (
                  (fila.lista.filter((a) => a.peligro).length / fila.lista.length) *
                  100
                ).toFixed(1),
              )
            : 0,
    nota: `${fila.jornada.etiqueta} · ${fila.lista[0]?.rival ?? ""}`,
  }));
}

/** Quién remata y quién saca: los dos nombres que la hoja sí guarda. */
export function porJugadorAbp(
  acciones: AccionAbp[],
  campo: (a: AccionAbp) => string,
) {
  const mapa = new Map<string, { total: number; peligro: number; xg: number }>();

  for (const accion of acciones) {
    const nombre = campo(accion).trim();

    if (!nombre || /^no aplica$/i.test(nombre)) continue;

    const fila = mapa.get(nombre) ?? { total: 0, peligro: 0, xg: 0 };

    fila.total += 1;
    fila.peligro += accion.peligro ? 1 : 0;
    fila.xg += accion.xg;

    mapa.set(nombre, fila);
  }

  return [...mapa.entries()]
    .map(([jugador, v]) => ({ jugador, ...v }))
    .sort((a, b) => b.total - a.total);
}
