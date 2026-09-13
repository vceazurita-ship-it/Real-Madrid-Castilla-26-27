import Papa from "papaparse";

import { traeCsv } from "@/lib/hojaCsv";
import type { FilaPartido } from "./leer";
import { METRICA_POR_KEY, valorEnGrupo, valorEnPartido } from "./metricas";

/**
 * ¿LO QUE SE ENTRENA SE VE EL DOMINGO?
 *
 * La plataforma tiene las dos mitades de la pregunta y nunca se habían puesto
 * juntas: en la hoja de microciclos está **lo que se entrenó** —cada tarea con
 * su contenido, su fase, sus minutos, su carga física y su carga cognitiva— y
 * en los informes de Wyscout está **lo que pasó en el partido**. Y cada
 * microciclo lleva el nombre del rival de esa semana, que es lo que permite
 * atar las dos cosas sin inventarse nada.
 *
 * Lo que sale de cruzarlas son dos avisos, y sólo dos, porque son los que un
 * cuerpo técnico puede accionar el lunes:
 *
 * - **Se entrena y no se ve.** Muchos minutos en una fase y el rendimiento de
 *   esa fase por debajo de la categoría. No dice que la tarea sea mala: dice
 *   dónde mirar el vídeo.
 * - **Falla y no se entrena.** El rendimiento de una fase por debajo y casi
 *   sin minutos dedicados a ella esa semana.
 *
 * **Esto es una alarma, no un veredicto.** Con tres jornadas de liga, la
 * relación entre una tarea del martes y un córner del domingo no se demuestra
 * con números: se sospecha. La pantalla lo dice con esas palabras.
 */

const HOJA_MICROS =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=111318766&single=true&output=csv";

const num = (valor?: string) =>
  Number(String(valor ?? "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;

export type TareaEntrenamiento = {
  micro: number;
  rival: string;
  dia: string;
  md: string;
  fecha: string;
  tarea: string;
  tipo: string;
  /** Nota que le pone el cuerpo técnico a la tarea, de 1 a 5. */
  evaluacion: number;
  contenido: string;
  contenidoSecundario: string;
  fase: string;
  tiempo: number;
  intensidad: number;
  carga: number;
  cargaCog: number;
  exigCog: number;
};

/**
 * Lee la hoja de microciclos.
 *
 * Es la **misma hoja** que abre `/microcycles`, leída por `traeCsv` para que
 * abrir las dos pantallas no la baje dos veces. Las columnas van por posición
 * y no por nombre porque la hoja no tiene cabecera útil: la primera fila es el
 * título del club.
 */
export async function leeEntrenamientos(): Promise<TareaEntrenamiento[]> {
  const texto = await traeCsv(HOJA_MICROS);

  const parsed = Papa.parse<string[]>(texto, {
    header: false,
    skipEmptyLines: true,
  });

  return parsed.data
    .slice(1)
    .map((r) => ({
      micro: num(r[1]),
      rival: (r[2] || "").trim(),
      dia: (r[3] || "").trim().toUpperCase(),
      md: (r[4] || "").trim(),
      fecha: (r[5] || "").trim(),
      tarea: (r[6] || "").trim(),
      tipo: (r[7] || "").trim(),
      evaluacion: num(r[8]),
      contenido: (r[14] || "").trim(),
      contenidoSecundario: (r[15] || "").trim(),
      fase: (r[16] || "").trim(),
      tiempo: num(r[17]),
      intensidad: num(r[18]),
      carga: num(r[19]),
      exigCog: num(r[20]),
      cargaCog: num(r[21]),
    }))
    .filter((t) => t.micro > 0 && t.tarea !== "");
}

/* ------------------------------------------------------------------ */
/*  LAS FASES, A LOS DOS LADOS                                         */
/* ------------------------------------------------------------------ */

/**
 * Una fase del juego, con su nombre en la hoja y su nota en el partido.
 *
 * `fases` son los valores que escribe el cuerpo técnico en la columna FASE;
 * `contenidos` afina con la columna de contenido principal, porque «Press
 * Pérdida» es transición defensiva aunque la fase diga «Defensiva».
 *
 * `metricas` son las del informe que describen esa misma fase: la nota del
 * domingo. Cada una lleva su peso, y todas se convierten a «cuánto por encima
 * o por debajo de la mediana de la categoría», que es lo único comparable entre un PPDA y
 * un porcentaje de córners.
 */
export type FaseTransferencia = {
  key: string;
  label: string;
  /** Lo que pone la hoja de microciclos. */
  fases: string[];
  contenidos: string[];
  /** Las métricas del informe que puntúan esa fase. */
  metricas: string[];
  pregunta: string;
};

export const FASES_TRANSFERENCIA: FaseTransferencia[] = [
  {
    key: "of",
    label: "Con balón",
    fases: ["ofensiva"],
    contenidos: ["ataque cp", "ataque cr", "ataque global", "ind.finalización"],
    metricas: [
      "posesion",
      "cuotaUltimoTercio",
      "pasesProgresivos",
      "entradasArea",
      "toquesArea",
      "xg",
    ],
    pregunta: "¿Lo que se trabaja con balón se ve en el ataque?",
  },
  {
    key: "def",
    label: "Sin balón",
    fases: ["defensiva"],
    contenidos: [
      "defensa global",
      "defensa cp",
      "defensa cr",
      "defensa área",
      "bloque alto",
      "bloque medio",
      "bloque bajo",
      "ind.def.duelo",
    ],
    metricas: [
      "ppda",
      "recuperacionesAltas",
      "duelosDefensivos",
      "tirosContra",
      "interceptaciones",
    ],
    pregunta: "¿Lo que se trabaja sin balón se ve en lo que se concede?",
  },
  {
    key: "trDef",
    label: "Transición defensiva",
    fases: ["tr defensiva"],
    contenidos: ["press pérdida", "transición"],
    metricas: ["perdidas", "perdidasBajas", "recuperacionesAltas", "faltas"],
    pregunta: "¿La presión tras pérdida que se entrena aparece al perderlo?",
  },
  {
    key: "trOf",
    label: "Transición ofensiva",
    fases: ["tr ofensiva"],
    contenidos: ["transición", "ataque cr"],
    metricas: ["contras", "contrasRemate", "minutosPorOcasion", "pasesPorOcasion"],
    pregunta: "¿Se sale corriendo al robar como se ensaya?",
  },
  {
    key: "abp",
    label: "Balón parado",
    fases: ["abp", "abp ofensivo", "abp defensivo", "abp global"],
    contenidos: ["abp", "abp ofensivo", "abp defensivo"],
    metricas: ["corners", "cornersRemate", "abp", "abpRemate", "cuotaRematesAbp"],
    pregunta: "¿El tiempo de estrategia se convierte en remates?",
  },
];

const sinAcentos = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** ¿Esta tarea es de esta fase? La fase manda, y el contenido afina. */
export function tareaDeFase(tarea: TareaEntrenamiento, fase: FaseTransferencia) {
  const suFase = sinAcentos(tarea.fase);
  const suContenido = sinAcentos(tarea.contenido);

  if (fase.fases.some((f) => sinAcentos(f) === suFase)) return true;

  return fase.contenidos.some((c) => sinAcentos(c) === suContenido);
}

/* ------------------------------------------------------------------ */
/*  EL CRUCE                                                           */
/* ------------------------------------------------------------------ */

/**
 * Empareja el nombre del rival de la hoja con el del informe de Wyscout.
 *
 * La hoja escribe «CD TERUEL» y el informe «Teruel»; «R.FERROL» y «Racing de
 * Ferrol». Así que se comparan sin acentos, sin las siglas del club y por
 * palabras distintivas.
 *
 * **Y se comparan palabra a palabra, no por contenido de cadena.** «REAL
 * MADRID C» está contenido dentro de «Real Madrid Castilla», así que con un
 * `includes` la semana del filial contra el Real Madrid C se ataba a nuestro
 * propio informe y la transferencia salía comparándonos con nosotros mismos.
 */
export function mismoRival(unoDeLaHoja: string, unoDelInforme: string) {
  const limpia = (texto: string) =>
    sinAcentos(texto)
      .replace(/[.]/g, " ")
      .replace(/\b(cf|cd|sd|fc|rcd|ud|club|de|del|la|el)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const a = limpia(unoDeLaHoja);
  const b = limpia(unoDelInforme);

  if (!a || !b) return false;

  if (a === b) return true;

  const palabrasA = a.split(" ").filter(Boolean);
  const palabrasB = b.split(" ").filter(Boolean);

  /*
  | Una palabra suelta de una letra —la «C» del Real Madrid C— no empareja
  | nada, pero sí **distingue**: si los dos nombres empiezan igual y sólo se
  | diferencian en la cola, son equipos distintos del mismo club.
  */
  const cortas = new Set([...palabrasA, ...palabrasB].filter((p) => p.length <= 2));

  if (cortas.size > 0) {
    const colaA = palabrasA.filter((p) => p.length <= 2).join(" ");
    const colaB = palabrasB.filter((p) => p.length <= 2).join(" ");

    if (colaA !== colaB) return false;
  }

  /* Comparten al menos una palabra larga, y esa es la distintiva. */
  const largasA = palabrasA.filter((p) => p.length >= 5);
  const largasB = palabrasB.filter((p) => p.length >= 5);

  return largasA.some((p) => largasB.includes(p));
}

export type SemanaCruzada = {
  micro: number;
  rival: string;
  /** El partido de esa semana, si se ha encontrado el informe. */
  partido: FilaPartido | null;
  /** Minutos entrenados de cada fase. */
  minutos: Record<string, number>;
  /** Carga física y cognitiva de cada fase. */
  carga: Record<string, number>;
  cargaCog: Record<string, number>;
  tareas: Record<string, number>;
  /** Nota media que el cuerpo técnico puso a las tareas de esa fase. */
  evaluacion: Record<string, number | null>;
  minutosTotales: number;
  /** Qué tal salió cada fase, en tanto por ciento sobre la mediana de la liga. */
  rendimiento: Record<string, number | null>;
};

/**
 * El nivel de una fase, medido **contra la categoría**.
 *
 * Aquí hubo que tirar la primera versión entera. Comparaba cada partido con
 * nuestra propia media y luego promediaba todos los partidos: eso da cero
 * siempre, por construcción —la media de las desviaciones respecto a la media
 * es cero— y la alarma no podía saltar nunca. Parecía funcionar porque los
 * números salían, y todos salían a cero.
 *
 * La referencia buena es la liga: «esta fase está un 12 % por debajo de la
 * categoría» sí significa algo, y es justo lo que hay que saber para decidir
 * si el tiempo de entrenamiento está bien repartido.
 *
 * Se usa la **mediana** de la liga y no su media: con veintiún equipos, uno
 * que presione como nadie arrastra la media y no la mediana.
 */
export function nivelDeFase(
  fase: FaseTransferencia,
  filas: FilaPartido[],
  liga: FilaPartido[],
  equipos: string[],
) {
  const diferencias: number[] = [];

  for (const key of fase.metricas) {
    const met = METRICA_POR_KEY.get(key);

    if (!met) continue;

    const nuestro =
      filas.length === 1
        ? valorEnPartido(met, filas[0])
        : valorEnGrupo(met, filas);

    if (nuestro === null) continue;

    const deCadaEquipo = equipos
      .map((e) => valorEnGrupo(met, liga.filter((p) => p.equipo === e)))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    if (deCadaEquipo.length < 5) continue;

    const mediana = deCadaEquipo[Math.floor(deCadaEquipo.length / 2)];

    if (mediana === 0) continue;

    const bruta = ((nuestro - mediana) / Math.abs(mediana)) * 100;

    diferencias.push(met.mejorAlto === false ? -bruta : bruta);
  }

  if (diferencias.length === 0) return null;

  return diferencias.reduce((s, d) => s + d, 0) / diferencias.length;
}

/** Las semanas, con lo entrenado y lo jugado en la misma fila. */
export function cruza(
  tareas: TareaEntrenamiento[],
  nuestros: FilaPartido[],
  liga: FilaPartido[],
  equipos: string[],
): SemanaCruzada[] {
  const micros = [...new Set(tareas.map((t) => t.micro))].sort((a, b) => a - b);

  return micros.map((micro) => {
    const suyas = tareas.filter((t) => t.micro === micro);

    const rival = suyas.find((t) => t.rival)?.rival ?? "";

    const partido = nuestros.find((p) => mismoRival(rival, p.rival)) ?? null;

    const minutos: Record<string, number> = {};
    const carga: Record<string, number> = {};
    const cargaCog: Record<string, number> = {};
    const cuenta: Record<string, number> = {};
    const notas: Record<string, number[]> = {};

    for (const fase of FASES_TRANSFERENCIA) {
      const deLaFase = suyas.filter((t) => tareaDeFase(t, fase));

      minutos[fase.key] = deLaFase.reduce((s, t) => s + t.tiempo, 0);
      carga[fase.key] = deLaFase.reduce((s, t) => s + t.carga * t.tiempo, 0);
      cargaCog[fase.key] = deLaFase.reduce((s, t) => s + t.cargaCog * t.tiempo, 0);
      cuenta[fase.key] = deLaFase.length;
      notas[fase.key] = deLaFase.map((t) => t.evaluacion).filter((n) => n > 0);
    }

    const evaluacion: Record<string, number | null> = {};

    for (const fase of FASES_TRANSFERENCIA) {
      const suyas2 = notas[fase.key];

      evaluacion[fase.key] = suyas2.length
        ? suyas2.reduce((s, n) => s + n, 0) / suyas2.length
        : null;
    }

    const rendimiento: Record<string, number | null> = {};

    for (const fase of FASES_TRANSFERENCIA) {
      rendimiento[fase.key] = partido
        ? nivelDeFase(fase, [partido], liga, equipos)
        : null;
    }

    return {
      micro,
      rival,
      partido,
      minutos,
      carga,
      cargaCog,
      tareas: cuenta,
      evaluacion,
      minutosTotales: suyas.reduce((s, t) => s + t.tiempo, 0),
      rendimiento,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  LOS AVISOS                                                         */
/* ------------------------------------------------------------------ */

export type Aviso = {
  tipo: "sin-transferencia" | "sin-trabajo" | "bien";
  fase: FaseTransferencia;
  /** Minutos dedicados a esa fase en las semanas con partido. */
  minutos: number;
  /** Qué parte del tiempo de entrenamiento se le dedicó. */
  cuotaTiempo: number;
  /** El nivel de la fase en lo jugado, en tanto por ciento sobre la liga. */
  rendimiento: number | null;
  semanas: number;
  texto: string;
};

/**
 * Lo que hay que mirar esta semana.
 *
 * Sólo se miran las semanas que tienen partido con informe: una semana de
 * pretemporada contra un equipo del que no hay datos no puede decir nada de
 * transferencia.
 */
export function avisosDe(
  semanas: SemanaCruzada[],
  nuestros: FilaPartido[],
  liga: FilaPartido[],
  equipos: string[],
): Aviso[] {
  const conPartido = semanas.filter((s) => s.partido !== null);

  if (conPartido.length === 0) return [];

  const minutosTodo = conPartido.reduce((s, w) => s + w.minutosTotales, 0);

  return FASES_TRANSFERENCIA.map((fase) => {
    const minutos = conPartido.reduce((s, w) => s + (w.minutos[fase.key] ?? 0), 0);

    /* El nivel de la fase en el conjunto de lo jugado, contra la categoría. */
    const rendimiento = nivelDeFase(fase, nuestros, liga, equipos);

    const cuotaTiempo = minutosTodo > 0 ? (minutos / minutosTodo) * 100 : 0;

    /*
    | Los dos umbrales.
    |
    | «Mucho tiempo» es más de la quinta parte del entrenamiento —hay cinco
    | fases, así que un quinto es lo que le tocaría a cada una si se repartiera
    | por igual— y «poco» es menos de la mitad de eso. «Por debajo» empieza en
    | un 5 % bajo la mediana de la liga, que es donde deja de ser ruido.
    */
    const mucho = cuotaTiempo >= 20;
    const poco = cuotaTiempo < 10;
    const flojo = rendimiento !== null && rendimiento < -5;

    if (flojo && mucho) {
      return {
        tipo: "sin-transferencia" as const,
        fase,
        minutos,
        cuotaTiempo,
        rendimiento,
        semanas: conPartido.length,
        texto: `Se le dedica el ${cuotaTiempo.toFixed(0)} % del tiempo de entrenamiento —${minutos.toFixed(0)} minutos— y en el partido esta fase queda ${Math.abs(rendimiento).toFixed(0)} % por debajo de la categoría. Es el sitio por donde empezar el vídeo: el tiempo está puesto y no se está viendo.`,
      };
    }

    if (flojo && poco) {
      return {
        tipo: "sin-trabajo" as const,
        fase,
        minutos,
        cuotaTiempo,
        rendimiento,
        semanas: conPartido.length,
        texto: `Queda ${Math.abs(rendimiento).toFixed(0)} % por debajo de la categoría y sólo se le dedica el ${cuotaTiempo.toFixed(0)} % del tiempo (${minutos.toFixed(0)} minutos). Falla y no se está trabajando.`,
      };
    }

    return {
      tipo: "bien" as const,
      fase,
      minutos,
      cuotaTiempo,
      rendimiento,
      semanas: conPartido.length,
      texto:
        rendimiento === null
          ? "No hay bastantes cifras del partido para juzgar esta fase."
          : rendimiento >= 0
            ? `${cuotaTiempo.toFixed(0)} % del tiempo y ${rendimiento.toFixed(0)} % por encima de la categoría: lo que se entrena se está viendo.`
            : `${cuotaTiempo.toFixed(0)} % del tiempo y ${Math.abs(rendimiento).toFixed(0)} % por debajo, pero dentro de lo que se mueve una muestra corta.`,
    };
  });
}
