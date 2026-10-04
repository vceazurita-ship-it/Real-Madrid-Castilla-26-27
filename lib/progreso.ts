/**
 * POR DÓNDE VA CADA ENCARGO DE AJUSTES (04/10/2026).
 *
 * Los botones de Ajustes dejan un encargo y el ordenador del club lo hace
 * (`scripts/vigia.cjs`). Hasta ahora la pantalla sólo decía «En marcha desde
 * hace 12 min»: ni cuánto llevaba, ni qué quedaba. Esto es el porqué y el cómo
 * del porcentaje, y lo comparten el vigía (que lee la salida de los scripts) y
 * la pantalla (que lo pinta).
 *
 * Cada trabajo es una lista de **etapas** con lo que suelen tardar. El vigía
 * reconoce en qué etapa está por las líneas que escribe el script —«--- Descarga
 * ---», «PASO: 5/7 · …»— y, dentro de la etapa, si el script cuenta («60/532 ·
 * Teruel · …»), lleva la cuenta. El porcentaje es:
 *
 *   lo que suman las etapas hechas + la parte hecha de la actual
 *
 * pesando cada etapa por lo que suele tardar. Si la etapa no cuenta, la parte
 * hecha sale del tiempo que lleva frente a lo que suele tardar, sin pasar nunca
 * del 90 %: un porcentaje que se queda en 99 % diez minutos engaña más que uno
 * que avanza despacio.
 *
 * Lo que tarda cada etapa lo aprende el vigía de las pasadas anteriores
 * (`esperado`); lo de aquí es el punto de partida.
 *
 * Sin React ni servidor: lo carga también Node por `scripts/cargador-ts.cjs`.
 */

import type { Tarea } from "./mantenimiento";

export type Etapa = {
  nombre: string;
  /** Minutos que suele tardar (el punto de partida; el vigía aprende los suyos). */
  minutos: number;
  /** La línea de la salida que dice que empieza esta etapa. */
  marca: RegExp;
};

export const ETAPAS: Record<Tarea, Etapa[]> = {
  quiniela: [
    { nombre: "Qué jornadas mirar", minutos: 0.1, marca: /jornadas que se miran/i },
    { nombre: "Resultados en BeSoccer", minutos: 0.4, marca: /\[quiniela\] jornada \d+:/i },
    { nombre: "Escribir los resultados", minutos: 0.1, marca: /resultado\(s\) escritos|RESUMEN:/i },
  ],

  /* La tarea de la jornada nocturna: sus secciones son los «--- … ---» del registro. */
  rivales: [
    { nombre: "Comprobar la red", minutos: 0.5, marca: /^--- Comprobando la red/ },
    { nombre: "Informe de rivales", minutos: 12, marca: /^--- Informe de rivales/ },
    { nombre: "Estadísticas de los jugadores", minutos: 12, marca: /^--- Estadisticas de rivales/ },
    { nombre: "Nuestra plantilla", minutos: 3, marca: /^--- Nuestra plantilla/ },
    { nombre: "Altas y bajas", minutos: 5, marca: /^--- Altas y bajas/ },
    { nombre: "Dorsales", minutos: 2, marca: /^--- Dorsales/ },
    { nombre: "Fotos que faltan", minutos: 4, marca: /^--- Fotos que faltan/ },
    { nombre: "Resultados de la quiniela", minutos: 0.5, marca: /^--- Resultados de la quiniela/ },
  ],

  wyscout: [
    { nombre: "Abrir Wyscout", minutos: 1, marca: /^--- Descarga/ },
    { nombre: "Bajar los 20 equipos", minutos: 7, marca: /\d+ equipos en /i },
    { nombre: "Releer la carpeta", minutos: 0.7, marca: /^--- Releyendo la carpeta/ },
    { nombre: "Foto de la jornada", minutos: 0.5, marca: /^--- Foto de la jornada/ },
    { nombre: "Publicar", minutos: 0.5, marca: /^--- Publicando/ },
  ],

  carpeta: [
    { nombre: "Buscar la carpeta", minutos: 0.1, marca: /^.*?·.*?: \d+ vídeos en «/ },
    { nombre: "Subir los vídeos", minutos: 3, marca: /^\s*\[\d+\/\d+\]/ },
    { nombre: "Documentos y láminas", minutos: 0.3, marca: /^\s*documento:|^Láminas:/ },
  ],

  /* Las siete líneas «PASO: n/7» de `scripts/analisis-partido.cjs`. */
  partido: [
    { nombre: "Buscar el último partido", minutos: 0.5, marca: /^PASO:\s*1\// },
    { nombre: "Wyscout: la liga y el partido", minutos: 10, marca: /^PASO:\s*2\// },
    { nombre: "Hudl: el timeline", minutos: 4, marca: /^PASO:\s*3\// },
    { nombre: "La base del dato", minutos: 2, marca: /^PASO:\s*4\// },
    { nombre: "Vídeo: jugada a jugada", minutos: 150, marca: /^PASO:\s*5\// },
    { nombre: "Escribir en las hojas y publicar", minutos: 5, marca: /^PASO:\s*6\// },
    { nombre: "Comprobar cada sección", minutos: 2, marca: /^PASO:\s*7\// },
  ],
};

/** Lo que el vigía va contando de un trabajo en marcha (viaja en su latido). */
export type ProgresoVivo = {
  /** La etapa en la que está (índice en `ETAPAS[tarea]`). */
  etapa: number;
  /** Cuándo empezó el trabajo y cuándo la etapa actual (ISO). */
  desde: string;
  etapaDesde: string;
  /** Las etapas ya hechas, con lo que tardaron en minutos (las saltadas no están). */
  hechas: { etapa: number; minutos: number }[];
  /** La cuenta de la etapa, si el script cuenta: [hechos, total]. */
  cuenta?: [number, number];
  /** La última línea útil: «Teruel · MARIO SESE». */
  detalle?: string;
  /** Minutos que suele tardar cada etapa en ESTE ordenador (aprendido). */
  esperado?: number[];
  /** Las etapas que se hacen en esta pasada; sin él, todas. Las demás se aprovechan de la anterior. */
  plan?: number[];
  /** Las etapas en las que el script ha dicho que algo ha fallado. */
  fallos?: number[];
};

/** Cómo quedó cada etapa de la última pasada (se guarda en el encargo al acabar). */
export type EtapaHecha = { nombre: string; estado: "hecha" | "fallo" | "saltada" | "previa"; minutos?: number };

/** Lo que dice cada script cuando algo le sale mal (sigue o se para, según el script). */
const FALLO: Record<Tarea, RegExp> = {
  quiniela: /FALLO/,
  rivales: /^FALLO en |^LA RED NO DEJA|^BESOCCER NO CONTESTA|^NO SE LLEGA A LA HOJA/,
  wyscout: /^FALLO|CADUCADO|PUSH HA FALLADO|OTRA CUENTA/i,
  carpeta: /FALLO|no encuentro la carpeta/i,
  partido: /^✗ /,
};

/* ------------------------------------------------------------------ */
/*  LEER LA SALIDA                                                     */
/* ------------------------------------------------------------------ */

/**
 * Lleva la cuenta de un trabajo leyendo su salida línea a línea.
 * La usa el vigía; la pantalla sólo ve el resultado (`estado()`).
 */
export class Seguimiento {
  readonly tarea: Tarea;

  private etapa = -1;

  private desde: number;

  private etapaDesde: number;

  private hechas: { etapa: number; minutos: number }[] = [];

  private cuenta?: [number, number];

  private detalle = "";

  private esperado?: number[];

  private plan?: number[];

  private fallos = new Set<number>();

  /* Wyscout no cuenta: lista los equipos y luego escribe uno por línea. */
  private equipos: string[] = [];

  private equiposVistos = new Set<string>();

  constructor(tarea: Tarea, esperado?: number[], ahora = Date.now(), plan?: number[]) {
    this.tarea = tarea;
    this.desde = ahora;
    this.etapaDesde = ahora;
    this.esperado = esperado;
    this.plan = plan?.length ? plan : undefined;
  }

  /** Pasa a una etapa (sólo hacia delante). */
  private entra(etapa: number, ahora: number) {
    if (etapa <= this.etapa) return;

    if (this.etapa >= 0) this.hechas.push({ etapa: this.etapa, minutos: (ahora - this.etapaDesde) / 60_000 });

    this.etapa = etapa;
    this.etapaDesde = ahora;
    this.cuenta = undefined;
    this.detalle = "";
  }

  /** Una línea de la salida. Devuelve `true` si ha cambiado algo que enseñar. */
  linea(cruda: string, ahora = Date.now()) {
    const linea = cruda.replace(/\s+$/, "");

    if (!linea.trim()) return false;

    const etapas = ETAPAS[this.tarea];

    const antes = `${this.etapa}|${this.cuenta?.join("/")}|${this.detalle}|${this.fallos.size}`;

    const nueva = etapas.findIndex((e) => e.marca.test(linea));

    if (nueva >= 0) this.entra(nueva, ahora);

    /* La comprobación final del partido escribe «✗» por las secciones de las
       OTRAS etapas (se reparten luego por su nombre): no es ella la que falla. */
    const esComprobacion = this.tarea === "partido" && this.etapa === ETAPAS.partido.length - 1;

    if (FALLO[this.tarea].test(linea.trim()) && !esComprobacion) this.fallos.add(Math.max(0, this.etapa));

    /* Wyscout: «20 equipos en Group 2:» y en la línea siguiente los nombres. */
    if (this.tarea === "wyscout") {
      const total = /(\d+) equipos en /i.exec(linea);

      if (total) {
        this.cuenta = [0, Number(total[1])];
      } else if (this.cuenta && !this.equipos.length && linea.includes(" · ")) {
        this.equipos = linea.split(" · ").map((x) => x.trim()).filter(Boolean);
      } else if (this.equipos.length) {
        const nombre = this.equipos.find((e) => linea.trim().startsWith(e));

        if (nombre) {
          this.equiposVistos.add(nombre);
          this.cuenta = [Math.max(0, this.equiposVistos.size - 1), this.equipos.length];
          this.detalle = nombre;
        }
      }
    }

    /* La cuenta: «60/532 · Teruel · …», «[3/52] …», «fotogramas TV 97/97». No
       vale una fecha (04/10/2026) ni la del propio «PASO: 5/7». */
    const sinPaso = linea.replace(/^PASO:\s*\d+\/\d+\s*·?\s*/, "");

    const cuenta = /(?<![\d/])(\d+)\s*\/\s*(\d+)(?![\d/])/.exec(sinPaso);

    /* «fotogramas TV 97/97» es la preparación del vídeo, no las jugadas: con
       esa cuenta la etapa de horas salía hecha al primer minuto. */
    if (cuenta && this.tarea !== "wyscout" && !/fotograma/i.test(sinPaso)) {
      const [hechos, total] = [Number(cuenta[1]), Number(cuenta[2])];

      if (total > 0 && hechos <= total) this.cuenta = [hechos, total];
    }

    /* El detalle: lo que se está mirando, sin la cuenta delante. */
    if (nueva < 0 && !/^(RESUMEN|SECCIONES):/.test(linea)) {
      const limpio = sinPaso
        .replace(/^\s*\[?\d+\s*\/\s*\d+\]?\s*·?\s*/, "")
        .replace(/^vídeo · /, "")
        .trim();

      if (limpio && limpio.length < 140 && !/^[-=]+$/.test(limpio)) this.detalle = limpio;
    } else if (this.tarea === "partido" && /^vídeo · /.test(sinPaso)) {
      /* «PASO: 5/7 · vídeo · fotogramas TV 30/97»: lo de detrás es por dónde va. */
      this.detalle = sinPaso.replace(/^vídeo · /, "").trim();
    }

    return antes !== `${this.etapa}|${this.cuenta?.join("/")}|${this.detalle}|${this.fallos.size}`;
  }

  /** Lo que se publica en el latido. */
  estado(): ProgresoVivo | null {
    if (this.etapa < 0) {
      return {
        etapa: this.plan?.[0] ?? 0,
        desde: new Date(this.desde).toISOString(),
        etapaDesde: new Date(this.etapaDesde).toISOString(),
        hechas: [],
        ...(this.esperado ? { esperado: this.esperado } : {}),
        ...(this.plan ? { plan: this.plan } : {}),
      };
    }

    return {
      etapa: this.etapa,
      desde: new Date(this.desde).toISOString(),
      etapaDesde: new Date(this.etapaDesde).toISOString(),
      hechas: this.hechas,
      ...(this.cuenta ? { cuenta: this.cuenta } : {}),
      ...(this.detalle ? { detalle: this.detalle.slice(0, 140) } : {}),
      ...(this.esperado ? { esperado: this.esperado } : {}),
      ...(this.plan ? { plan: this.plan } : {}),
      ...(this.fallos.size ? { fallos: [...this.fallos] } : {}),
    };
  }

  /** Al acabar: cómo quedó cada etapa, para el encargo y para aprender. */
  cierra(ok: boolean, ahora = Date.now()): { recorrido: EtapaHecha[]; duraciones: (number | null)[] } {
    const etapas = ETAPAS[this.tarea];

    const hechas = [...this.hechas];

    if (this.etapa >= 0) hechas.push({ etapa: this.etapa, minutos: (ahora - this.etapaDesde) / 60_000 });

    const porEtapa = new Map(hechas.map((h) => [h.etapa, h.minutos]));

    const recorrido = etapas.map((e, i): EtapaHecha => {
      const minutos = porEtapa.get(i);

      const redondo = minutos === undefined ? undefined : Math.round(minutos * 10) / 10;

      /* Falla la etapa en la que el script lo dijo y, si se paró, la última. */
      /* Si no acabó bien sin decir dónde, se paró en la etapa en la que iba;
         salvo que fuera la última: entonces terminó, y lo que falta está en
         sus secciones (el partido acababa «Falló en "Comprobar cada sección"»
         con la comprobación hecha y bien). */
      const seParo = !ok && i === this.etapa && !this.fallos.size && this.etapa < etapas.length - 1;

      if (this.fallos.has(i) || seParo) return { nombre: e.nombre, estado: "fallo", minutos: redondo };

      if (redondo !== undefined) return { nombre: e.nombre, estado: "hecha", minutos: redondo };

      /* No se hizo porque venía hecha de la pasada anterior. */
      if (this.plan && !this.plan.includes(i)) return { nombre: e.nombre, estado: "previa" };

      return { nombre: e.nombre, estado: "saltada" };
    });

    /* Sólo se aprende de las etapas de una pasada que fue bien. */
    const duraciones = etapas.map((_, i) => (ok && porEtapa.has(i) ? porEtapa.get(i)! : null));

    return { recorrido, duraciones };
  }
}

/* ------------------------------------------------------------------ */
/*  EL PORCENTAJE                                                      */
/* ------------------------------------------------------------------ */

export type EstadoEtapa = "hecha" | "ahora" | "pendiente" | "saltada" | "previa" | "fallo";

export type VistaProgreso = {
  /** 0-100. */
  porcentaje: number;
  etapas: { nombre: string; estado: EstadoEtapa; minutos: number; tardo?: number; cuenta?: [number, number]; detalle?: string; peso: number }[];
  /** Minutos que quedan, estimados. */
  quedan: number;
  /** Minutos que lleva. */
  lleva: number;
  /** `true` si no hay cuenta del vigía y todo sale del reloj. */
  estimado: boolean;
};

/** La cuenta de un `paso` viejo («5/7 · vídeo · fotogramas TV 30/97»), por si el vigía no publica `progreso`. */
export function progresoDePaso(tarea: Tarea, paso: string | undefined, desde: string | undefined): ProgresoVivo | null {
  if (!paso || !desde) return null;

  const s = new Seguimiento(tarea, undefined, Date.parse(desde));

  s.linea(`PASO: ${paso}`, Date.parse(desde));

  const vivo = s.estado();

  /* No se sabe cuándo empezó la etapa ni lo que tardaron las de antes: se
     dan por hechas (minutos -1 = sin saber) y se cuenta desde el principio. */
  return vivo ? { ...vivo, etapaDesde: desde, hechas: Array.from({ length: vivo.etapa }, (_, i) => ({ etapa: i, minutos: -1 })) } : null;
}

export function vistaProgreso(tarea: Tarea, vivo: ProgresoVivo | null | undefined, empezadoEn: string | undefined, ahora: number): VistaProgreso {
  const etapas = ETAPAS[tarea];

  const esperado = etapas.map((e, i) => {
    const aprendido = vivo?.esperado?.[i];

    return typeof aprendido === "number" && aprendido > 0 ? aprendido : e.minutos;
  });

  /* Las que vienen de la pasada anterior no pesan: el porcentaje es de lo que se hace ahora. */
  const enPlan = (i: number) => !vivo?.plan || vivo.plan.includes(i);

  const total = esperado.reduce((s, m, i) => s + (enPlan(i) ? m : 0), 0) || 1;

  const inicio = Date.parse(vivo?.desde ?? empezadoEn ?? "") || ahora;

  const lleva = Math.max(0, (ahora - inicio) / 60_000);

  /*
  | Sin cuenta del vigía (uno viejo, o la tarea nocturna lanzada por su
  | cuenta), se estima con el reloj: la etapa es la que tocaría por lo que
  | suele tardar cada una.
  */
  let vista = vivo;

  const estimado = !vivo;

  if (!vista) {
    let acumulado = 0;

    let etapa = etapas.length - 1;

    for (let i = 0; i < esperado.length; i += 1) {
      if (lleva < acumulado + esperado[i]) {
        etapa = i;
        break;
      }

      acumulado += esperado[i];
    }

    vista = {
      etapa,
      desde: new Date(inicio).toISOString(),
      etapaDesde: new Date(inicio + acumulado * 60_000).toISOString(),
      hechas: Array.from({ length: etapa }, (_, i) => ({ etapa: i, minutos: esperado[i] })),
    };
  }

  const hechas = new Map(vista.hechas.map((h) => [h.etapa, h.minutos]));

  const enEtapa = Math.max(0, (ahora - (Date.parse(vista.etapaDesde) || inicio)) / 60_000);

  /* La parte hecha de la etapa actual: la cuenta si la hay; si no, el reloj, con tope. */
  const fraccion = vista.cuenta && vista.cuenta[1] > 0 ? Math.min(1, vista.cuenta[0] / vista.cuenta[1]) : Math.min(0.9, enEtapa / esperado[vista.etapa]);

  let hecho = 0;

  const filas = etapas.map((e, i) => {
    const peso = enPlan(i) ? esperado[i] / total : 0;

    let estado: EstadoEtapa;

    if (!enPlan(i)) estado = "previa";
    else if (i === vista!.etapa) estado = "ahora";
    else if (i < vista!.etapa) estado = vista!.fallos?.includes(i) ? "fallo" : hechas.has(i) ? "hecha" : "saltada";
    else estado = "pendiente";

    if (estado === "hecha" || estado === "saltada" || estado === "fallo") hecho += peso;
    if (estado === "ahora") hecho += peso * fraccion;

    return {
      nombre: e.nombre,
      estado,
      minutos: esperado[i],
      peso,
      ...(hechas.has(i) && hechas.get(i)! >= 0 ? { tardo: hechas.get(i) } : {}),
      ...(estado === "ahora" && vista!.cuenta ? { cuenta: vista!.cuenta } : {}),
      ...(estado === "ahora" && vista!.detalle ? { detalle: vista!.detalle } : {}),
    };
  });

  /*
  | Lo que queda: el resto de la etapa actual (por la cuenta, al ritmo que
  | lleva, o por lo que suele tardar) y lo que suelen tardar las pendientes.
  */
  const restoActual =
    vista.cuenta && vista.cuenta[0] > 0 && vista.cuenta[1] > vista.cuenta[0]
      ? (enEtapa / vista.cuenta[0]) * (vista.cuenta[1] - vista.cuenta[0])
      : Math.max(esperado[vista.etapa] * (1 - fraccion), esperado[vista.etapa] - enEtapa, 0.1);

  const quedan = restoActual + esperado.reduce((s, m, i) => s + (i > vista!.etapa && enPlan(i) ? m : 0), 0);

  return {
    porcentaje: Math.max(1, Math.min(99, Math.round(hecho * 100))),
    etapas: filas,
    quedan,
    lleva,
    estimado,
  };
}

/** «3 min», «1 h 20 min», «menos de un minuto» (o «<1 min» en corto). */
export function duracion(minutos: number, corto = false) {
  if (!Number.isFinite(minutos) || minutos < 1) return corto ? "<1 min" : "menos de un minuto";

  const m = Math.round(minutos);

  if (m < 60) return `${m} min`;

  const h = Math.floor(m / 60);

  const resto = m % 60;

  return resto ? `${h} h ${resto} min` : `${h} h`;
}

/* ------------------------------------------------------------------ */
/*  REPETIR SÓLO LO QUE FALTA                                          */
/* ------------------------------------------------------------------ */

/*
| Si una pasada no termina bien, no hace falta repetirla entera (04/10/2026):
| el análisis del partido tarda horas y casi todo ya está en su carpeta. Se
| propone repetir lo que falló y lo que depende de ello, y el resto se
| aprovecha. Quien lo pide puede cambiar las etapas marcadas.
|
| Cada trabajo se repite a su manera:
|   - rivales: sus secciones son independientes; la red se mira siempre.
|   - wyscout: es una cadena (bajar → releer → foto → publicar): desde la
|     primera marcada hasta el final. Abrir y bajar van juntas.
|   - partido: buscar el partido va siempre (es un momento y lo necesita todo);
|     Hudl → base → vídeo → escribir es una cadena; Wyscout va suelto, y la
|     comprobación final se hace siempre.
| La quiniela y la carpeta no: son segundos, o ya se saltan lo hecho.
*/

export const REPETIBLE: Partial<Record<Tarea, true>> = { rivales: true, wyscout: true, partido: true };

/** Las etapas que se hacen siempre. */
const FIJAS: Partial<Record<Tarea, number[]>> = { rivales: [0], partido: [0, 6] };

/** Lo que obliga a rehacer cada etapa (sólo el partido tiene cadenas sueltas). */
const ARRASTRA: Partial<Record<Tarea, Record<number, number[]>>> = {
  partido: { 2: [3, 4, 5], 3: [4, 5], 4: [5] },
};

/** Las etapas marcadas, con lo que arrastran y lo que va siempre, en orden. */
export function completaPlan(tarea: Tarea, marcadas: number[]): number[] {
  const total = ETAPAS[tarea].length;

  const plan = new Set(marcadas.filter((i) => Number.isInteger(i) && i >= 0 && i < total));

  if (tarea === "wyscout" && plan.size) {
    const primera = Math.min(...plan);

    for (let i = primera <= 1 ? 0 : primera; i < total; i += 1) plan.add(i);
  }

  for (const i of [...plan]) for (const j of ARRASTRA[tarea]?.[i] ?? []) plan.add(j);

  if (plan.size) for (const i of FIJAS[tarea] ?? []) plan.add(i);

  return [...plan].sort((a, b) => a - b);
}

/**
 * Las que no se pueden desmarcar, y por qué: «siempre» (van en toda pasada) o
 * «arrastra» (las obliga otra marcada).
 */
export function obligadas(tarea: Tarea, marcadas: number[]): Map<number, "siempre" | "arrastra"> {
  const motivo = new Map<number, "siempre" | "arrastra">();

  const elegidas = marcadas.filter((i) => !(FIJAS[tarea] ?? []).includes(i));

  if (!elegidas.length) return motivo;

  for (const i of FIJAS[tarea] ?? []) motivo.set(i, "siempre");

  /* Lo que obliga cada una de las otras: se mira sin ella misma. */
  for (const i of completaPlan(tarea, elegidas)) {
    if (motivo.has(i)) continue;

    const sinElla = elegidas.filter((j) => j !== i);

    if (sinElla.length && completaPlan(tarea, sinElla).includes(i)) motivo.set(i, "arrastra");
  }

  return motivo;
}

/** A qué etapa del partido pertenece una sección que la comprobación da por mala. */
function etapaDeSeccion(nombre: string) {
  if (/^(Wyscout|Data Análisis)/i.test(nombre)) return 1;
  if (/Hudl/i.test(nombre)) return 2;
  if (/base del timeline/i.test(nombre)) return 3;
  if (/análisis de vídeo|análisis de cada jugada/i.test(nombre)) return 4;
  if (/cámara táctica/i.test(nombre)) return null;

  /* ABP, hojas, faltas, robos, publicar: se rehacen escribiendo otra vez. */
  return 5;
}

/**
 * Lo que se propone repetir después de una pasada que no acabó bien: lo que
 * falló y lo que arrastra. `null` si no hay nada que aprovechar (todo falló,
 * o no se sabe por dónde iba).
 */
export function planRecomendado(
  tarea: Tarea,
  encargo: { ok?: boolean; recorrido?: EtapaHecha[]; secciones?: { nombre: string; ok: boolean; detalle?: string }[] } | undefined,
): number[] | null {
  if (!REPETIBLE[tarea] || !encargo || encargo.ok !== false || !encargo.recorrido?.length) return null;

  const malas = new Set<number>();

  encargo.recorrido.forEach((r, i) => {
    if (r.estado === "fallo" && !(FIJAS[tarea] ?? []).includes(i)) malas.add(i);
  });

  if (tarea === "partido") {
    for (const s of encargo.secciones ?? []) {
      if (s.ok) continue;

      /* Lo que espera a que Wyscout publique el partido (suele ser el martes)
         no se arregla repitiendo hoy: no se propone, aunque se puede marcar. */
      if (/todavía no trae el partido|no hay foto de Wyscout posterior/i.test(s.detalle ?? "")) continue;

      const etapa = etapaDeSeccion(s.nombre);

      if (etapa !== null) malas.add(etapa);
    }
  }

  /* Lo que nunca llegó a hacerse (se paró antes) también falta. */
  const ultimaHecha = encargo.recorrido.reduce((u, r, i) => (r.estado === "hecha" || r.estado === "fallo" || r.estado === "previa" ? i : u), -1);

  for (let i = ultimaHecha + 1; i < encargo.recorrido.length; i += 1) if (encargo.recorrido[i].estado === "saltada" && malas.size) malas.add(i);

  if (!malas.size) return null;

  const plan = completaPlan(tarea, [...malas]);

  /* Si hay que hacerlo todo, no hay nada que aprovechar. */
  return plan.length >= ETAPAS[tarea].length ? null : plan;
}

/**
 * El recorrido de una pasada que se cortó sin avisar (se apagó el ordenador):
 * lo último que se supo de ella. Lo usa el vigía al volver, para que la
 * pantalla pueda proponer seguir desde ahí.
 */
export function recorridoCortado(tarea: Tarea, vivo: ProgresoVivo): EtapaHecha[] {
  const hechas = new Map(vivo.hechas.map((h) => [h.etapa, h.minutos]));

  return ETAPAS[tarea].map((e, i): EtapaHecha => {
    if (vivo.plan && !vivo.plan.includes(i)) return { nombre: e.nombre, estado: "previa" };

    if (i === vivo.etapa || vivo.fallos?.includes(i)) return { nombre: e.nombre, estado: "fallo" };

    const minutos = hechas.get(i);

    if (minutos !== undefined && minutos >= 0) return { nombre: e.nombre, estado: "hecha", minutos: Math.round(minutos * 10) / 10 };

    return { nombre: e.nombre, estado: "saltada" };
  });
}
