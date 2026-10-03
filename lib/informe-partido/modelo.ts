/**
 * EL INFORME DEL PARTIDO: PREVIA Y POST (03/10/2026).
 *
 * Junta en un solo documento lo que el cuerpo técnico tiene repartido en
 * media plataforma:
 *
 *   - el microciclo de la semana (hoja de registro de tareas),
 *   - nuestro análisis y el del rival en datos (Data Análisis · Wyscout),
 *   - el análisis colectivo del rival y su plantilla (hoja RIVALES, BeSoccer),
 *   - su posible once (el marcado en Plantillas o, si no, su último once),
 *   - y el plan de partido (Preparación de Partido).
 *
 * Sale en dos formas: un **resumen en dos diapositivas** —lo que se lee en el
 * móvil antes de entrar al vestuario— y un **informe extenso** por correo.
 *
 * Este módulo es el modelo y la síntesis: no pide nada ni pinta nada. Lo
 * llenan `carga.ts` (navegador) y lo pintan `components/informe-partido/*`
 * y `html.ts`. La regla de siempre: lo que no llega no se inventa; se dice en
 * `avisos`.
 */

/* ------------------------------------------------------------------ */
/*  LA FORMA                                                           */
/* ------------------------------------------------------------------ */

export type Momento = "previa" | "post";

export type MetricaDuelo = {
  key: string;
  nombre: string;
  unidad: string;
  mejorAlto: boolean | null;
  fase: string;
  mediana: number | null;
  nosotros: { valor: number; puesto: number; percentil: number | null } | null;
  rival: { valor: number; puesto: number; percentil: number | null } | null;
};

export type PartidoForma = { fecha: string; rival: string; gf: number; gc: number; xg: number };

export type Duelo = {
  temporada: string;
  equipos: number;
  rival: string | null;
  jugados: { nosotros: number; rival: number };
  esquema: { nosotros: string; rival: string };
  metricas: MetricaDuelo[];
  forma: { nosotros: PartidoForma[]; rival: PartidoForma[] };
  partido: null | {
    fecha: string;
    marcador: string;
    metricas: {
      key: string;
      nombre: string;
      unidad: string;
      mejorAlto: boolean | null;
      nuestro: number | null;
      suyo: number | null;
      media: number | null;
    }[];
  };
};

export type DiaMicro = {
  fecha: string;
  /** «Lun 28». */
  etiqueta: string;
  md: string;
  tareas: number;
  minutos: number;
  carga: number;
  /** Los contenidos principales del día, sin repetir. */
  contenidos: string[];
  esPartido: boolean;
};

export type TareaMicro = {
  fecha: string;
  dia: string;
  md: string;
  tarea: string;
  tipo: string;
  fase: string;
  contenido: string;
  secundario: string;
  formato: string;
  minutos: number;
  intensidad: number;
  evaluacion: number;
  analisis: string;
};

export type Microciclo = {
  micro: number;
  temporada: string;
  rival: string;
  dias: DiaMicro[];
  tareas: TareaMicro[];
  totales: {
    tareas: number;
    minutos: number;
    carga: number;
    abpMinutos: number;
    valoradas: number;
    valoracionMedia: number | null;
  };
  /** Contenidos principales por minutos, de más a menos. */
  contenidos: { nombre: string; minutos: number }[];
  /** Fases por minutos. */
  fases: { nombre: string; minutos: number }[];
};

export type JugadorRival = {
  clave: string;
  nombre: string;
  dorsal: string;
  posicion: string;
  /** POR · DEF · MED · DEL, para colocarlo. */
  linea: "POR" | "DEF" | "MED" | "DEL" | "";
  foto: string;
  pie: string;
  altura: string;
  edad: string;
  /** Las etiquetas de la ficha (IMPACTO): «Juego aéreo», «1v1»… */
  rasgos: string[];
  caracteristicas: string;
  fortalezas: string;
  debilidades: string;
  rol: string;
  goles: number | null;
  asistencias: number | null;
  partidos: number | null;
  minutos: number | null;
  /** Dónde va en el dibujo, en tanto por uno (x: banda, y: 0 portería → 1 ataque). */
  x?: number;
  y?: number;
};

export type Plan = {
  claves: string[];
  ataque: string;
  defensa: string;
  abpOf: string;
  abpDef: string;
  emocionales: string;
  estado: string;
  estructuraOf: string;
  estructuraDef: string;
  fortalezas: string;
  debilidades: string;
  duelos: { campo: string; titulo: string; texto: string }[];
};

export type BloqueColectivo = {
  fase: string;
  bloque: string;
  campos: { titulo: string; texto: string }[];
};

export type Colectivo = {
  bloques: BloqueColectivo[];
  conclusiones: { titulo: string; texto: string }[];
};

export type ContextoRival = {
  escudo: string;
  escudoNuestro: string;
  puesto: number | null;
  puntos: number | null;
  /** «G», «E», «P» de los últimos partidos de liga, del más reciente al más antiguo. */
  racha: string[];
  goleadores: { nombre: string; goles: number }[];
  entrenador: string;
  estructuras: string[];
  /** Nuestro puesto, para la cabecera. */
  nuestroPuesto: number | null;
  nuestrosPuntos: number | null;
};

export type InformePartido = {
  momento: Momento;
  generado: string;
  partido: {
    jornada: number | null;
    cuando: string;
    /** «Viernes 2 de octubre · 21:15». */
    fechaTexto: string;
    lado: "casa" | "fuera" | "";
    rival: string;
    gf: number | null;
    gc: number | null;
    jugado: boolean;
  };
  microciclo: Microciclo | null;
  duelo: Duelo | null;
  plan: Plan | null;
  colectivo: Colectivo | null;
  once: { jugadores: JugadorRival[]; fuente: "marcado" | "ultimo" | null; detalle: string };
  plantilla: JugadorRival[];
  contexto: ContextoRival | null;
  abp: { minutosSemana: number; laminasRival: number; documentosRival: { nombre: string; url: string }[] } | null;
  sintesis: Sintesis;
  avisos: string[];
};

export type Sintesis = {
  /** Una frase que encabeza el resumen. */
  titular: string;
  /** Las 3-4 claves del partido (previa) o lo que nos deja (post). */
  claves: string[];
  /** Dónde estamos mejor y dónde están mejor ellos, con cifra. */
  ventajas: string[];
  amenazas: string[];
  /** Los 3 del rival a vigilar. */
  vigilar: JugadorRival[];
  /** Post: lo que dijo el partido en datos, frente a lo habitual. */
  partido: string[];
};

/* ------------------------------------------------------------------ */
/*  FORMATO                                                            */
/* ------------------------------------------------------------------ */

const coma = (n: number, decimales = 1) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** Una cifra de Data con su unidad, como en la pantalla. */
export function cifra(valor: number | null | undefined, unidad: string) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";

  if (unidad === "porcentaje") return `${coma(valor)} %`;
  if (unidad === "entero") return String(Math.round(valor));
  if (unidad === "minutos") return `${coma(valor)}′`;

  return coma(valor, Math.abs(valor) >= 10 ? 1 : 2);
}

/** «1.º», «12.º». */
export const ordinal = (n: number) => `${n}.º`;

/** Primera letra en mayúscula y el resto como venga. */
const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Un texto libre de la hoja partido en frases o líneas, sin vacíos. */
export function enFrases(texto: string | undefined, maximo = 6) {
  return (texto ?? "")
    .split(/\r?\n|•|·|;|(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .map((t) => t.replace(/^[-–—*\d.)\s]+/, "").trim())
    .filter((t) => t.length > 2)
    .slice(0, maximo);
}

/* ------------------------------------------------------------------ */
/*  LA SÍNTESIS                                                        */
/* ------------------------------------------------------------------ */

/*
| Lo que se considera ventaja o amenaza en datos: el percentil ya viene
| orientado («más es mejor» o al revés, según la métrica), así que la
| diferencia de percentiles dice quién lo lleva mejor y por cuánto.
*/
const UMBRAL_DIFERENCIA = 20;

function frasePuesto(m: MetricaDuelo, quien: "nosotros" | "rival", equipos: number) {
  const dato = m[quien];

  if (!dato) return "";

  return `${m.nombre}: ${cifra(dato.valor, m.unidad)} (${ordinal(dato.puesto)} de ${equipos})`;
}

export function ventajasYAmenazas(duelo: Duelo | null) {
  if (!duelo) return { ventajas: [] as string[], amenazas: [] as string[] };

  const comparables = duelo.metricas.filter(
    (m) => m.mejorAlto !== null && m.nosotros?.percentil != null && m.rival?.percentil != null,
  );

  const dif = (m: MetricaDuelo) => (m.nosotros?.percentil ?? 0) - (m.rival?.percentil ?? 0);

  const ventajas = comparables
    .filter((m) => dif(m) >= UMBRAL_DIFERENCIA)
    .sort((a, b) => dif(b) - dif(a))
    .slice(0, 3)
    .map((m) => `${frasePuesto(m, "nosotros", duelo.equipos)} · ellos ${ordinal(m.rival!.puesto)}`);

  /* Lo que ellos hacen muy bien en la liga, aunque estemos parejos. */
  const amenazas = comparables
    .filter((m) => -dif(m) >= UMBRAL_DIFERENCIA || (m.rival?.puesto ?? 99) <= 3)
    .sort((a, b) => (a.rival?.puesto ?? 99) - (b.rival?.puesto ?? 99) || dif(a) - dif(b))
    .slice(0, 3)
    .map((m) => `${frasePuesto(m, "rival", duelo.equipos)} · nosotros ${ordinal(m.nosotros!.puesto)}`);

  return { ventajas, amenazas };
}

/** Los tres del rival que más pesan: goles + asistencias, minutos, y lo que diga la ficha. */
export function aVigilar(once: JugadorRival[], plantilla: JugadorRival[]) {
  const peso = (j: JugadorRival) =>
    (j.goles ?? 0) * 3 + (j.asistencias ?? 0) * 2 + (j.minutos ?? 0) / 300 + j.rasgos.length * 0.5 + (j.fortalezas ? 1 : 0);

  const base = once.length ? once : plantilla;

  return [...base]
    .filter((j) => j.linea !== "POR")
    .sort((a, b) => peso(b) - peso(a))
    .slice(0, 3);
}

/** Post: las métricas del partido que más se separan de lo habitual. */
export function lecturaDelPartido(duelo: Duelo | null) {
  const p = duelo?.partido;

  if (!p) return [] as string[];

  const desvios = p.metricas
    .filter((m) => m.nuestro !== null && m.media !== null && m.media !== 0 && m.mejorAlto !== null)
    .map((m) => {
      const rel = ((m.nuestro! - m.media!) / Math.abs(m.media!)) * 100;

      const bueno = m.mejorAlto ? rel > 0 : rel < 0;

      return { m, rel, bueno };
    })
    .filter((x) => Math.abs(x.rel) >= 15)
    .sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel))
    .slice(0, 4);

  return desvios.map(
    ({ m, rel, bueno }) =>
      `${capital(m.nombre)}: ${cifra(m.nuestro, m.unidad)} frente a ${cifra(m.media, m.unidad)} de media (${rel > 0 ? "+" : ""}${Math.round(rel)} %) · ${bueno ? "mejor" : "peor"} de lo habitual`,
  );
}

export function sintetiza(inf: Omit<InformePartido, "sintesis">): Sintesis {
  const { ventajas, amenazas } = ventajasYAmenazas(inf.duelo);

  const vigilar = aVigilar(inf.once.jugadores, inf.plantilla);

  const partido = inf.momento === "post" ? lecturaDelPartido(inf.duelo) : [];

  /* Las claves: las que escribió el cuerpo técnico en el plan; si no hay, las
     que dicen los datos. Nunca más de cuatro: es lo que cabe en la cabeza. */
  const delPlan = inf.plan?.claves ?? [];

  const claves =
    inf.momento === "post"
      ? partido.slice(0, 2).concat(delPlan.slice(0, 2).map((c) => `Plan: ${c}`))
      : delPlan.length >= 3
        ? delPlan.slice(0, 4)
        : /* Con dos o menos del plan, se completan con lo que dicen los datos.
             La primera ventaja y la primera amenaza ya van al pie de sus
             paneles: aquí entran las siguientes, para no repetir. */
          [
            ...delPlan,
            ...[1, 2].flatMap((i) => [
              ventajas[i] ? `Aprovechar · ${ventajas[i]}` : "",
              amenazas[i] ? `Neutralizar · ${amenazas[i]}` : "",
            ]),
          ]
            .filter(Boolean)
            .slice(0, 4);

  const rival = inf.partido.rival || "el rival";

  const titular =
    inf.momento === "post"
      ? inf.partido.jugado && inf.partido.gf !== null && inf.partido.gc !== null
        ? `${inf.partido.gf > inf.partido.gc ? "Victoria" : inf.partido.gf < inf.partido.gc ? "Derrota" : "Empate"} ${inf.partido.gf}-${inf.partido.gc} ${inf.partido.lado === "fuera" ? "en el campo del" : "ante el"} ${rival}`
        : `Post partido ante el ${rival}`
      : `${inf.partido.lado === "fuera" ? "Visitamos al" : "Recibimos al"} ${rival}${inf.contexto?.puesto ? `, ${ordinal(inf.contexto.puesto)} de la tabla` : ""}`;

  return { titular, claves, ventajas, amenazas, vigilar, partido };
}
