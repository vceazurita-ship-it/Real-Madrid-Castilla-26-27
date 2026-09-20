/**
 * LOS DÍAS DE UN MICROCICLO, SEGÚN LA HOJA DE REGISTRO.
 *
 * Un microciclo **no es una semana natural**. El del Sant Andreu va de domingo
 * a miércoles: se entrena el 20, el 21 y el 22 y se juega el 23. Planificarlo
 * de lunes a domingo deja fuera el domingo 20 —que es un día de trabajo— y
 * mete dentro el jueves y el viernes, que ya son del microciclo siguiente.
 *
 * Quién sabe los días de verdad: **la hoja de registro de tareas**
 * (`lib/abp/registro.ts`). Ahí el cuerpo técnico escribe una fila por tarea con
 * su día, su MD y su fecha, así que los días con filas son los días que se
 * entrena. Esto los ordena, los ata con el partido del calendario y rellena los
 * huecos de en medio como descanso.
 *
 * **Si el microciclo no está en la hoja, no se inventa**: se dice que hay que
 * crearlo primero. Proponer una semana sobre días imaginados es peor que no
 * proponer nada.
 */

import {
  comoNuestro,
  soloDia,
  type PartidoCastilla,
  type PartidoNuestro,
} from "@/lib/castilla/calendario";
import { teamKey } from "@/lib/abp/model";
import type { DiaKey, TipoDia } from "@/lib/abp/microciclo";
import type { RegistroTarea } from "@/lib/abp/registro";

const DIA_MS = 86_400_000;

const CLAVE_DIA: DiaKey[] = ["D", "L", "M", "X", "J", "V", "S"];

const NOMBRES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const aMedioDia = (dia: string) => Date.parse(`${dia}T12:00:00Z`);

export function diaKeyDe(fecha: string): DiaKey {
  return CLAVE_DIA[new Date(aMedioDia(fecha)).getUTCDay()];
}

export function etiquetaDia(fecha: string) {
  const dia = new Date(aMedioDia(fecha));

  /* Una fecha que no se entiende se enseña tal cual: «undefined NaN» no le
     dice a nadie que lo que hay escrito está mal. */
  if (Number.isNaN(dia.getTime())) return fecha || "sin fecha";

  return `${NOMBRES[dia.getUTCDay()]} ${dia.getUTCDate()}`;
}

/** "20/09/2026" o "2026-09-20" → "2026-09-20". Vacío si no se entiende. */
export function fechaHoja(valor: string): string {
  const limpio = (valor || "").trim();

  const iso = limpio.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const conBarras = limpio.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);

  if (!conBarras) return "";

  const [, dia, mes, anyo] = conBarras;

  const completo = anyo.length === 2 ? `20${anyo}` : anyo;

  return `${completo}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

export type DiaMicro = {
  clave: DiaKey;
  fecha: string;
  /** "domingo 20". */
  etiqueta: string;
  tipo: TipoDia;
  /** Días hasta el partido. `null` si no se sabe cuándo se juega. */
  md: number | null;
  /** El rótulo tal y como está en la hoja («MD-3»), o el que se deduce. */
  rotulo: string;
  /** Cuántas tareas tiene ese día en la hoja (de todo, no sólo ABP). */
  tareasHoja: number;
  /** El día viene de la hoja; si no, se ha rellenado el hueco. */
  deLaHoja: boolean;
};

export type VentanaMicro = {
  dias: DiaMicro[];
  /** Los días en los que se entrena, que son los que llevan trabajo. */
  entrenos: DiaMicro[];
  /** El partido de este microciclo, atado con el calendario. */
  partido: PartidoNuestro | null;
  /** Cómo se llama el rival en la hoja. */
  rivalHoja: string;
  /** "de domingo a miércoles". */
  comoSeLlama: string;
  avisos: string[];
};

/** La hoja escribe «NO COMPETICIÓN» en las semanas sin partido. */
export function esSinPartido(rival: string) {
  return /no\s*competici/i.test(rival || "");
}

/**
 * Ata el rival escrito en la hoja con un partido del calendario.
 *
 * Por nombre y por fecha: el nombre porque es lo que hay, y la fecha porque
 * dos vueltas tienen el mismo rival y sólo la cercanía distingue la ida de la
 * vuelta. Diez días de margen, como en la quiniela.
 */
export function buscaPartidoDelMicro(
  rival: string,
  cerca: string,
  partidos: PartidoCastilla[],
): PartidoNuestro | null {
  if (!rival || esSinPartido(rival)) return null;

  const clave = teamKey(rival);

  if (!clave) return null;

  const nuestros = partidos.map(comoNuestro);

  const candidatos = nuestros.filter((uno) => {
    const suyo = teamKey(uno.rival);

    return suyo === clave || suyo.includes(clave) || clave.includes(suyo);
  });

  if (candidatos.length === 0) return null;

  if (candidatos.length === 1 || !cerca) return candidatos[0];

  const referencia = aMedioDia(cerca);

  return (
    candidatos
      .map((uno) => ({
        uno,
        lejos: Math.abs(aMedioDia(soloDia(uno.cuando)) - referencia),
      }))
      .sort((a, b) => a.lejos - b.lejos)[0]?.uno ?? null
  );
}

export type EntradaVentana = {
  /** Las tareas de la hoja **de este microciclo**, todas, no sólo las de ABP. */
  tareas: RegistroTarea[];
  /** El rival del microciclo según la hoja. */
  rival: string;
  /** Nuestro calendario, para atar el partido. */
  partidos: PartidoCastilla[];
};

/**
 * Los días del microciclo, de la hoja.
 *
 * Devuelve la lista vacía cuando la hoja no tiene ese microciclo: quien llame
 * tiene que poder decir «créala primero» en vez de inventarse una semana.
 */
export function ventanaDelMicro(entrada: EntradaVentana): VentanaMicro {
  const { tareas, rival, partidos } = entrada;

  const avisos: string[] = [];

  /* --- Los días escritos en la hoja --- */

  const porFecha = new Map<string, { clave: DiaKey; rotulo: string; tareas: number }>();

  let sinFecha = 0;

  for (const tarea of tareas) {
    const fecha = fechaHoja(tarea.fecha);

    if (!fecha) {
      sinFecha += 1;

      continue;
    }

    const suyo = porFecha.get(fecha) ?? {
      clave: diaKeyDe(fecha),
      rotulo: tarea.md || "",
      tareas: 0,
    };

    suyo.tareas += 1;

    /* El MD de la hoja manda, pero hay filas sin él. */
    if (!suyo.rotulo && tarea.md) suyo.rotulo = tarea.md;

    porFecha.set(fecha, suyo);
  }

  if (sinFecha > 0) {
    avisos.push(
      `${sinFecha} tarea(s) de la hoja no tienen fecha, así que su día no se ha podido colocar.`,
    );
  }

  const fechas = [...porFecha.keys()].sort();

  if (fechas.length === 0) {
    return {
      dias: [],
      entrenos: [],
      partido: buscaPartidoDelMicro(rival, "", partidos),
      rivalHoja: rival,
      comoSeLlama: "",
      avisos,
    };
  }

  const partido = buscaPartidoDelMicro(rival, fechas[fechas.length - 1], partidos);

  const diaDelPartido = partido ? soloDia(partido.cuando) : "";

  /* --- El último día: el partido, aunque no esté escrito en la hoja --- */

  const ultimo =
    diaDelPartido && diaDelPartido > fechas[fechas.length - 1]
      ? diaDelPartido
      : fechas[fechas.length - 1];

  /* --- Todos los días de principio a fin, huecos incluidos --- */

  const dias: DiaMicro[] = [];

  for (
    let momento = aMedioDia(fechas[0]);
    momento <= aMedioDia(ultimo);
    momento += DIA_MS
  ) {
    const fecha = new Date(momento).toISOString().slice(0, 10);

    const deLaHoja = porFecha.get(fecha);

    const esPartido =
      (diaDelPartido && fecha === diaDelPartido) ||
      /^md$/i.test((deLaHoja?.rotulo ?? "").trim());

    const crudo = diaDelPartido
      ? Math.round((aMedioDia(diaDelPartido) - momento) / DIA_MS)
      : null;

    /*
    | Un día POSTERIOR al partido no es «MD--1».
    |
    | Pasa cuando el partido se aplaza y la hoja conserva las sesiones de la
    | semana vieja: salían rótulos como «MD--2» y, peor, el boceto colocaba el
    | «ensayo del día antes» en un día que ya era después. Esos días son del
    | microciclo siguiente: se quedan sin MD.
    */
    const md = crudo != null && crudo >= 0 ? crudo : null;

    const tipo: TipoDia = esPartido ? "partido" : deLaHoja ? "entreno" : "descanso";

    dias.push({
      clave: diaKeyDe(fecha),
      fecha,
      etiqueta: etiquetaDia(fecha),
      tipo,
      md,
      rotulo:
        deLaHoja?.rotulo?.trim() ||
        (esPartido ? "MD" : md == null ? "" : `MD-${md}`),
      tareasHoja: deLaHoja?.tareas ?? 0,
      deLaHoja: Boolean(deLaHoja),
    });
  }

  /*
  | Dos días con la misma inicial no caben en el plan.
  |
  | El plan guarda los días por su letra (L, M, X…), así que un microciclo de
  | más de siete días tendría dos lunes en la misma casilla. Pasa poco —un
  | parón, una semana sin partido— pero cuando pasa hay que decirlo en vez de
  | pisar el día en silencio.
  */
  const letras = new Set(dias.map((dia) => dia.clave));

  if (letras.size < dias.length) {
    avisos.push(
      `Este microciclo tiene ${dias.length} días y el plan guarda uno por día de la semana: los días repetidos se pisan. Pártelo en dos microciclos en la hoja.`,
    );
  }

  if (dias.some((dia) => dia.md == null && dia.tipo !== "partido") && diaDelPartido) {
    avisos.push(
      "Hay días de la hoja posteriores al partido: son del microciclo siguiente y se quedan sin MD. Si el partido se aplazó, repasa las fechas.",
    );
  }

  if (!partido) {
    avisos.push(
      esSinPartido(rival)
        ? "La hoja dice que este microciclo no acaba en partido, así que no hay rival al que preparar."
        : `No encuentro en el calendario el partido contra «${rival}»: sin él no se puede saber qué día es MD-1 ni mirar su balón parado.`,
    );
  }

  const entrenos = dias.filter((dia) => dia.tipo === "entreno");

  return {
    dias,
    entrenos,
    partido,
    rivalHoja: rival,
    comoSeLlama:
      dias.length > 0
        ? `de ${NOMBRES[new Date(aMedioDia(dias[0].fecha)).getUTCDay()]} a ${
            NOMBRES[new Date(aMedioDia(dias[dias.length - 1].fecha)).getUTCDay()]
          }`
        : "",
    avisos,
  };
}
