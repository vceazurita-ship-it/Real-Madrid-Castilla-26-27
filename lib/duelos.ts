/**
 * DUELOS: nuestro once contra el once probable del rival, emparejado por zonas.
 *
 * La pregunta de caseta es «¿dónde les podemos hacer daño y dónde nos lo
 * pueden hacer a nosotros?», y se contesta duelo a duelo: nuestros centrales
 * contra su nueve, nuestros laterales contra sus extremos, nuestros extremos
 * contra sus laterales, la medular contra la medular…
 *
 * Cada duelo se mide con unas pocas «facetas» que lo deciden —por arriba, el
 * uno contra uno, la espalda…—, y en cada una se pone frente a frente la
 * métrica del que ataca con la del que defiende. Las dos se leen en
 * **percentil contra los de su mismo puesto en toda la categoría** (Wyscout,
 * esta temporada, con al menos 90′): comparar en bruto el % aéreo de un
 * central con el de un nueve diría siempre lo mismo —el central gana más,
 * porque es su oficio—; lo que dice algo es quién es mejor **en lo suyo**.
 * Debajo va siempre el valor de verdad.
 *
 * Reglas que vienen de DATA y no se tocan aquí: un porcentaje de muy pocas
 * acciones no cuenta (`volumenDelPorcentaje`) y el percentil es el de
 * `percentilEnPlantilla`.
 */
import type { FilaJugador } from "@/lib/data-analisis/leer";
import {
  MINUTOS_MINIMOS,
  METRICA_JUGADOR_POR_COLUMNA,
  percentilEnPlantilla,
  puestoDe,
  valorDe,
  volumenDelPorcentaje,
  type Puesto,
} from "@/lib/data-analisis/individual";
import { HUECOS, type Lado } from "@/lib/data-analisis/once";

/* ------------------------------------------------------------------ */
/*  LOS JUGADORES                                                      */
/* ------------------------------------------------------------------ */

export type JugadorDuelo = {
  /** Con la que se guarda en el once: nombre de Wyscout (nuestros) o `playerKey` de la hoja (suyos). */
  clave: string;
  nombre: string;
  foto?: string;
  dorsal?: string;
  puesto: Puesto;
  lado: Lado;
  /** Lo que se enseña como posición: la de Wyscout si hay, si no la de la hoja. */
  posicion: string;
  /**
   * El puesto de la hoja en palabras (sólo suyos), el mismo que enseña
   * Plantillas rivales: Wyscout llama «delantero centro» a un extremo que
   * jugó por dentro algún día (07/11/2026, jueces). Se enseña antes que `posicion`.
   */
  puestoHoja?: string;
  /** La columna POSICIÓN de su hoja, tal cual (sólo suyos): con ella sale el puesto común del rival. */
  posicionHoja?: string;
  /** En centímetros; null si no se sabe. */
  altura: number | null;
  pie: string;
  minutos: number;
  /** Su fila de Wyscout de esta temporada, si se ha encontrado. */
  wyscout: FilaJugador | null;
  /** Apellido con inicial cuando se repite en el once («J. Martínez»); si no, el apellido a secas. */
  corto?: string;
  /** El id de su ficha en nuestra plantilla (sólo nuestros): para casar con el último once de Valoraciones. */
  fichaId?: string;
  /** Rival de baja según la hoja (estado o etiqueta de su ficha): no entra solo en el once. */
  baja?: "lesionado" | "sancionado" | "tocado";
};

/** «1,84», «1.84», «184», «184 cm» → 184. */
export function alturaEnCm(valor: unknown): number | null {
  const n = Number(String(valor ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const cm = n < 3 ? Math.round(n * 100) : Math.round(n);
  return cm >= 150 && cm <= 215 ? cm : null;
}

/* ------------------------------------------------------------------ */
/*  LOS EMPAREJAMIENTOS                                                */
/* ------------------------------------------------------------------ */

/**
 * Los dos onces se miran en espejo: **su** banda derecha es la que tiene
 * enfrente **nuestro** lateral izquierdo. Las claves de hueco son las mismas
 * para los dos equipos (las del 4-2-3-1 de `HUECOS`), cada uno desde su lado.
 */
export type TipoDuelo =
  | "central-delantero"
  | "delantero-central"
  | "lateral-extremo"
  | "extremo-lateral"
  | "pivote-mediapunta"
  | "mediapunta-pivote"
  | "medio-medio";

export type DefDuelo = {
  clave: string;
  titulo: string;
  /** Qué se juega en ese duelo, en una línea. */
  subtitulo: string;
  zona: "defensa" | "medio" | "ataque";
  nuestros: string[];
  suyos: string[];
  tipo: TipoDuelo;
};

export const DUELOS: DefDuelo[] = [
  { clave: "cen-del", titulo: "Nuestros centrales vs su delantero", subtitulo: "Lo que nos pueden hacer por dentro", zona: "defensa", nuestros: ["cen-d", "cen-i"], suyos: ["del"], tipo: "central-delantero" },
  { clave: "latd-bani", titulo: "Nuestro lateral derecho vs su extremo izquierdo", subtitulo: "Nuestra banda derecha, defendiendo", zona: "defensa", nuestros: ["lat-d"], suyos: ["ban-i"], tipo: "lateral-extremo" },
  { clave: "lati-band", titulo: "Nuestro lateral izquierdo vs su extremo derecho", subtitulo: "Nuestra banda izquierda, defendiendo", zona: "defensa", nuestros: ["lat-i"], suyos: ["ban-d"], tipo: "lateral-extremo" },
  { clave: "piv-media", titulo: "Nuestros pivotes vs su mediapunta", subtitulo: "Quién controla el espacio entre líneas", zona: "medio", nuestros: ["piv-d", "piv-i"], suyos: ["media"], tipo: "pivote-mediapunta" },
  { clave: "medio", titulo: "Nuestro doble pivote vs su doble pivote", subtitulo: "La medular: pase, progresión y duelos", zona: "medio", nuestros: ["piv-d", "piv-i"], suyos: ["piv-d", "piv-i"], tipo: "medio-medio" },
  { clave: "media-piv", titulo: "Nuestra mediapunta vs sus pivotes", subtitulo: "Si podemos recibir y girarnos entre líneas", zona: "medio", nuestros: ["media"], suyos: ["piv-d", "piv-i"], tipo: "mediapunta-pivote" },
  { clave: "band-lati", titulo: "Nuestro extremo derecho vs su lateral izquierdo", subtitulo: "Nuestra banda derecha, atacando", zona: "ataque", nuestros: ["ban-d"], suyos: ["lat-i"], tipo: "extremo-lateral" },
  { clave: "bani-latd", titulo: "Nuestro extremo izquierdo vs su lateral derecho", subtitulo: "Nuestra banda izquierda, atacando", zona: "ataque", nuestros: ["ban-i"], suyos: ["lat-d"], tipo: "extremo-lateral" },
  { clave: "del-cen", titulo: "Nuestro delantero vs sus centrales", subtitulo: "Lo que les podemos hacer por dentro", zona: "ataque", nuestros: ["del"], suyos: ["cen-d", "cen-i"], tipo: "delantero-central" },
];

export const ZONAS: { key: DefDuelo["zona"]; label: string }[] = [
  { key: "defensa", label: "Cuando nos atacan" },
  { key: "medio", label: "En el centro del campo" },
  { key: "ataque", label: "Cuando atacamos" },
];

/* ------------------------------------------------------------------ */
/*  LOS ENFRENTAMIENTOS: CON BALÓN CONTRA SIN BALÓN                    */
/* ------------------------------------------------------------------ */

/**
 * Cada enfrentamiento pone **lo que hace con balón el que ataca** contra **lo
 * que hace sin balón el que defiende** (06/10/2026): el regate contra el
 * duelo defensivo, el desmarque a la espalda contra la anticipación, el pase
 * que rompe líneas contra el corte… Comparar el pase de uno con el pase del
 * otro no dice quién gana el duelo; enfrentar el pase de uno con la presión
 * del otro, sí.
 *
 * Y cada duelo se mira **en los dos sentidos**: con el balón nuestro (nuestra
 * métrica de ataque contra su métrica defensiva) y con el balón suyo (al
 * revés). Un lateral no sólo defiende al extremo: también le ataca, y el
 * extremo también tiene que defenderle.
 */
type Enfrentamiento = { titulo: string; ataca: string; defiende: string; explica: string };

const E = {
  regate: { titulo: "Regate contra entrada", ataca: "Regates realizados, %", defiende: "Duelos defensivos ganados, %", explica: "Acierto en el regate del que lleva el balón contra duelos defensivos ganados del que defiende." },
  cuerpo: { titulo: "Cuerpo a cuerpo con balón", ataca: "Duelos atacantes ganados, %", defiende: "Duelos defensivos ganados, %", explica: "Duelos con balón ganados contra duelos defensivos ganados." },
  ritmo: { titulo: "Cambio de ritmo", ataca: "Aceleraciones/90", defiende: "Acciones defensivas realizadas/90", explica: "Aceleraciones del que ataca contra la actividad defensiva del que defiende." },
  espalda: { titulo: "Desmarque a la espalda", ataca: "Ataque en profundidad/90", defiende: "Interceptaciones/90", explica: "Ataques al espacio contra anticipación (interceptaciones)." },
  conduccion: { titulo: "Conducción", ataca: "Carreras en progresión/90", defiende: "Entradas/90", explica: "Conducciones que hacen avanzar contra entradas del que defiende." },
  rompe: { titulo: "Pase que rompe líneas", ataca: "Pases progresivos/90", defiende: "Interceptaciones/90", explica: "Pases progresivos contra cortes de línea de pase." },
  presion: { titulo: "Pase bajo presión", ataca: "Precisión pases, %", defiende: "Acciones defensivas realizadas/90", explica: "Seguridad en el pase contra la actividad del que presiona." },
  recibir: { titulo: "Recibir entre líneas", ataca: "Pases recibidos /90", defiende: "Interceptaciones/90", explica: "Cuánto la recibe contra cuánto corta el que le vigila." },
  ultimo: { titulo: "Último pase", ataca: "Jugadas claves/90", defiende: "Acciones defensivas realizadas/90", explica: "Pases clave contra la actividad defensiva del que tiene enfrente." },
  centro: { titulo: "Centro contra juego aéreo", ataca: "Precisión centros, %", defiende: "Duelos aéreos ganados, %", explica: "Acierto en el centro contra duelos aéreos ganados del que defiende." },
  remate: { titulo: "Remate contra bloqueo", ataca: "Goles esperados/90", defiende: "Tiros interceptados/90", explica: "Peligro que genera contra remates que tapa el que defiende." },
} satisfies Record<string, Enfrentamiento>;

/** El juego aéreo no tiene «con balón»: se disputa igual en los dos sentidos. */
const AEREO: Enfrentamiento = {
  titulo: "Juego aéreo",
  ataca: "Duelos aéreos ganados, %",
  defiende: "Duelos aéreos ganados, %",
  explica: "Duelos aéreos ganados, cada uno contra los de su puesto.",
};

/** Qué rol tiene cada lado en cada tipo de duelo. */
type Rol = "CEN" | "DEL" | "LAT" | "EXT" | "PIV" | "MP";

const ROLES: Record<TipoDuelo, { nuestro: Rol; suyo: Rol }> = {
  "central-delantero": { nuestro: "CEN", suyo: "DEL" },
  "delantero-central": { nuestro: "DEL", suyo: "CEN" },
  "lateral-extremo": { nuestro: "LAT", suyo: "EXT" },
  "extremo-lateral": { nuestro: "EXT", suyo: "LAT" },
  "pivote-mediapunta": { nuestro: "PIV", suyo: "MP" },
  "mediapunta-pivote": { nuestro: "MP", suyo: "PIV" },
  "medio-medio": { nuestro: "PIV", suyo: "PIV" },
};

/**
 * Los enfrentamientos de un rol con balón contra otro sin él: lo que de
 * verdad pasa en ese trozo de campo. Un central con balón no regatea a un
 * nueve: le saca el balón jugado o conducido, y el nueve presiona.
 */
const CON_BALON: Record<`${Rol}>${Rol}`, Enfrentamiento[]> = {
  "DEL>CEN": [E.cuerpo, E.espalda, E.ritmo, E.remate],
  "CEN>DEL": [E.rompe, E.presion, E.conduccion],
  "EXT>LAT": [E.regate, E.ritmo, E.conduccion, E.ultimo, E.centro],
  "LAT>EXT": [E.rompe, E.conduccion, E.regate, E.centro],
  "MP>PIV": [E.recibir, E.cuerpo, E.ultimo, E.remate],
  "PIV>MP": [E.presion, E.rompe, E.conduccion],
  "PIV>PIV": [E.presion, E.rompe, E.conduccion, E.cuerpo],
  /* No se usan (nadie pone a un central frente a un lateral), pero el tipo los pide. */
  "CEN>CEN": [], "CEN>LAT": [], "CEN>EXT": [], "CEN>PIV": [], "CEN>MP": [],
  "DEL>DEL": [], "DEL>LAT": [], "DEL>EXT": [], "DEL>PIV": [], "DEL>MP": [],
  "LAT>CEN": [], "LAT>DEL": [], "LAT>LAT": [], "LAT>PIV": [], "LAT>MP": [],
  "EXT>CEN": [], "EXT>DEL": [], "EXT>EXT": [], "EXT>PIV": [], "EXT>MP": [],
  "PIV>CEN": [], "PIV>DEL": [], "PIV>LAT": [], "PIV>EXT": [],
  "MP>CEN": [], "MP>DEL": [], "MP>LAT": [], "MP>EXT": [], "MP>MP": [],
};

/** En qué duelos se disputa el balón por arriba. */
const CON_AEREO = new Set<TipoDuelo>(["central-delantero", "delantero-central", "medio-medio", "lateral-extremo", "extremo-lateral"]);

/** En qué duelos pesa la altura (los que se juegan por arriba de verdad). */
const CON_ALTURA = new Set<TipoDuelo>(["central-delantero", "delantero-central", "medio-medio"]);

/* ------------------------------------------------------------------ */
/*  EL CÁLCULO                                                         */
/* ------------------------------------------------------------------ */

/**
 * Los de un puesto en la categoría (esta temporada, con minutos), con los que
 * se calcula el percentil. Se cachea por puesto: hay seis y se piden mil veces.
 */
export function referenciasPorPuesto(jugadores: FilaJugador[]) {
  const porPuesto = new Map<Puesto, FilaJugador[]>();
  for (const j of jugadores) {
    if (j.temporada !== "actual" || j.minutos < MINUTOS_MINIMOS) continue;
    const p = puestoDe(j.posicion);
    const lista = porPuesto.get(p) ?? [];
    lista.push(j);
    porPuesto.set(p, lista);
  }
  return porPuesto;
}

export type Medida = { jugador: JugadorDuelo; valor: number; percentil: number };

/** El valor y el percentil de un jugador en una columna, contra los de su puesto; null si no se puede decir. */
export function medida(jugador: JugadorDuelo, columna: string, referencias: Map<Puesto, FilaJugador[]>): Medida | null {
  const fila = jugador.wyscout;
  if (!fila || fila.minutos < MINUTOS_MINIMOS) return null;
  if (!volumenDelPorcentaje(fila, columna).fiable) return null;
  const valor = valorDe(fila, columna);
  if (valor === null) return null;
  const metrica = METRICA_JUGADOR_POR_COLUMNA.get(columna);
  const puesto = puestoDe(fila.posicion);
  const contra = (referencias.get(puesto) ?? [])
    .filter((c) => volumenDelPorcentaje(c, columna).fiable)
    .map((c) => valorDe(c, columna))
    .filter((v): v is number => v !== null);
  if (contra.length < 5) return null;
  const percentil = percentilEnPlantilla(valor, contra, metrica?.mejorAlto ?? true);
  return percentil === null ? null : { jugador, valor, percentil };
}

export type Veredicto = "ventaja" | "parejo" | "desventaja" | "sin-datos";

/** Diferencia de percentil a partir de la cual se habla de ventaja. */
export const UMBRAL_FACETA = 15;
export const UMBRAL_DUELO = 10;

/**
 * Un único umbral de «muestra corta» para todas las tarjetas de duelos
 * (30/10/2026, análisis): si alguno de los dos lados del cruce tiene menos
 * minutos que esto en Wyscout, la base lo dice («muestra corta: menos de
 * 450′»). Lo usan el Plan de partido y /duelos.
 */
export const MUESTRA_CORTA_DUELO = 450;

/**
 * El veredicto que enseña la cabecera de la tarjeta (29/10/2026), para que el
 * pie diga lo mismo: si pesan los dos sentidos (ganamos con balón y perdemos
 * sin él) manda la suma, y si se compensan, «se anulan».
 */
export function veredictoDeCabecera(conBalon: number | null, sinBalon: number | null, veredicto: Veredicto): Veredicto | "anulan" {
  /* Los dos desequilibrios, en cualquier sentido (10/11/2026, jueces): −34 con
     el balón nuestro y +34 con el suyo no es un duelo «parejo», se anulan. */
  if (
    ((conBalon ?? 0) >= UMBRAL_DUELO && (sinBalon ?? 0) <= -UMBRAL_DUELO) ||
    ((conBalon ?? 0) <= -UMBRAL_DUELO && (sinBalon ?? 0) >= UMBRAL_DUELO)
  ) {
    const suma = (conBalon ?? 0) + (sinBalon ?? 0);

    return Math.abs(suma) < UMBRAL_DUELO ? "anulan" : suma < 0 ? "desventaja" : "ventaja";
  }

  return veredicto;
}

export type Sentido = "con" | "sin" | "aire";

export type ResultadoFaceta = {
  titulo: string;
  explica: string;
  /** Con el balón nuestro, con el suyo, o por arriba (sin dueño). */
  sentido: Sentido;
  columnaNuestra: string;
  columnaSuya: string;
  nuestros: Medida[];
  suyos: Medida[];
  /** Media de percentiles de cada lado; null si a un lado no hay dato. */
  nuestro: number | null;
  suyo: number | null;
  diferencia: number | null;
  veredicto: Veredicto;
  /** Una frase para leer en caseta. */
  frase: string;
};

export type BloqueDuelo = {
  sentido: Sentido;
  titulo: string;
  facetas: ResultadoFaceta[];
  balance: number | null;
  veredicto: Veredicto;
};

export type ResultadoDuelo = {
  def: DefDuelo;
  nuestros: JugadorDuelo[];
  suyos: JugadorDuelo[];
  /** Con balón nosotros, con balón ellos y, donde toca, por arriba. */
  bloques: BloqueDuelo[];
  /** Todas las facetas, de los tres bloques. */
  facetas: ResultadoFaceta[];
  /** Altura media de cada lado, si se sabe. */
  altura: { nuestra: number; suya: number } | null;
  /** Media de las diferencias de las facetas con dato (+ = a favor). */
  balance: number | null;
  /** Lo que les podemos hacer con el balón (+) y lo que nos pueden hacer ellos (−). */
  conBalon: number | null;
  sinBalon: number | null;
  veredicto: Veredicto;
  /** Las dos o tres frases que lo resumen. */
  resumen: string;
  /** Facetas con dato sobre el total. */
  cobertura: { con: number; de: number };
  /**
   * El mismo duelo desglosado en uno contra uno (06/10/2026): con dos de un
   * lado —los dos centrales contra su nueve, los dos pivotes…— cada pareja por
   * separado, para ver si la ventaja es de los dos o de uno solo.
   */
  parejas: ResultadoDuelo[];
  /** Los del once que no tienen minutos en Wyscout: no entran en la media y se dice (10/11/2026). */
  sinMinutos?: JugadorDuelo[];
};

const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

const veredictoDe = (dif: number | null, umbral: number): Veredicto =>
  dif === null ? "sin-datos" : dif >= umbral ? "ventaja" : dif <= -umbral ? "desventaja" : "parejo";

const formatea = (columna: string, v: number) => {
  const m = METRICA_JUGADOR_POR_COLUMNA.get(columna);
  if (m?.unidad === "porcentaje" || /%$/.test(columna)) return `${Math.round(v)} %`;
  return `${(Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, "")).replace(".", ",")}/90`;
};

/** El nombre corto de una columna, para decir qué se enfrenta con qué. */
/* «xG» no lo entiende todo el vestuario (23/10/2026). */
const sinSiglas = (texto: string) => texto.replace(/\bxG\b/g, "goles esperados");

export const rotuloColumna = (columna: string) => sinSiglas(METRICA_JUGADOR_POR_COLUMNA.get(columna)?.nombre ?? columna);

const apellido = (nombre: string) => {
  const t = nombre.trim().split(/\s+/);
  return t.length > 1 ? t.slice(1).join(" ") : nombre;
};

const nombres = (lista: JugadorDuelo[]) => lista.map((j) => j.corto ?? apellido(j.nombre)).join(" y ");

/** Pone la inicial del nombre a quien comparte apellido con otro de la lista: «J. Martínez» y «S. Martínez». */
export function conApellidosClaros(lista: JugadorDuelo[]): JugadorDuelo[] {
  const cuenta = new Map<string, number>();

  lista.forEach((j) => {
    const a = apellido(j.nombre).toLowerCase();
    cuenta.set(a, (cuenta.get(a) ?? 0) + 1);
  });

  return lista.map((j) => {
    const a = apellido(j.nombre);
    const inicial = j.nombre.trim().split(/\s+/).length > 1 ? j.nombre.trim()[0] : "";

    return (cuenta.get(a.toLowerCase()) ?? 0) > 1 && inicial ? { ...j, corto: `${inicial.toUpperCase()}. ${a}` } : j;
  });
}

/** «ataca» / «atacan», según sean uno o dos. */
const verbo = (lista: JugadorDuelo[], singular: string) => (lista.length > 1 ? singular + "n" : singular);

function fraseDe(f: Omit<ResultadoFaceta, "frase">): string {
  if (f.veredicto === "sin-datos") {
    const falta = f.nuestro === null && f.suyo === null ? "ninguno de los dos" : f.nuestro === null ? "los nuestros" : "los suyos";
    return `${f.titulo}: sin datos fiables de ${falta}.`;
  }
  const lado = (ms: Medida[], col: string) =>
    ms.map((m) => `${m.jugador.corto ?? apellido(m.jugador.nombre)} ${formatea(col, m.valor)} (P${m.percentil})`).join(", ");
  const inicio = f.veredicto === "ventaja" ? "Ventaja" : f.veredicto === "desventaja" ? "Desventaja" : "Parejo";
  return `${inicio} en ${f.titulo.toLowerCase()}: ${lado(f.nuestros, f.columnaNuestra)} en ${rotuloColumna(f.columnaNuestra).toLowerCase()} frente a ${lado(f.suyos, f.columnaSuya)} en ${rotuloColumna(f.columnaSuya).toLowerCase()}.`;
}

/** Mide un duelo entre los que haya en cada lado, en los dos sentidos. */
export function mideDuelo(
  def: DefDuelo,
  nuestros: JugadorDuelo[],
  suyos: JugadorDuelo[],
  referencias: Map<Puesto, FilaJugador[]>,
  /** Para las parejas: no se vuelven a desglosar. */
  sinParejas = false,
): ResultadoDuelo {
  const { nuestro: rolN, suyo: rolS } = ROLES[def.tipo];

  const faceta = (en: Enfrentamiento, sentido: Sentido): ResultadoFaceta => {
    /* Con el balón nuestro, lo nuestro es la columna del que ataca; con el suyo, la del que defiende. */
    const columnaNuestra = sentido === "sin" ? en.defiende : en.ataca;
    const columnaSuya = sentido === "sin" ? en.ataca : en.defiende;
    const mN = nuestros.map((j) => medida(j, columnaNuestra, referencias)).filter((m): m is Medida => m !== null);
    const mS = suyos.map((j) => medida(j, columnaSuya, referencias)).filter((m): m is Medida => m !== null);
    const nuestro = media(mN.map((m) => m.percentil));
    const suyo = media(mS.map((m) => m.percentil));
    const diferencia = nuestro !== null && suyo !== null ? Math.round(nuestro - suyo) : null;
    const base = {
      titulo: en.titulo,
      explica: en.explica,
      sentido,
      columnaNuestra,
      columnaSuya,
      nuestros: mN,
      suyos: mS,
      nuestro: nuestro === null ? null : Math.round(nuestro),
      suyo: suyo === null ? null : Math.round(suyo),
      diferencia,
      veredicto: veredictoDe(diferencia, UMBRAL_FACETA),
    };
    return { ...base, frase: fraseDe(base) };
  };

  const bloque = (sentido: Sentido, titulo: string, lista: Enfrentamiento[]): BloqueDuelo => {
    const facetas = lista.map((en) => faceta(en, sentido));
    const difs = facetas.map((f) => f.diferencia).filter((d): d is number => d !== null);
    const balance = difs.length ? Math.round(difs.reduce((a, b) => a + b, 0) / difs.length) : null;
    return { sentido, titulo, facetas, balance, veredicto: veredictoDe(balance, UMBRAL_DUELO) };
  };

  const quienN = nombres(nuestros) || "los nuestros";
  const quienS = nombres(suyos) || "los suyos";

  const bloques: BloqueDuelo[] = [
    bloque("con", `Con balón nuestro: ${quienN} ${verbo(nuestros, "ataca")}, ${quienS} ${verbo(suyos, "defiende")}`, CON_BALON[`${rolN}>${rolS}`]),
    bloque("sin", `Con balón suyo: ${quienS} ${verbo(suyos, "ataca")}, ${quienN} ${verbo(nuestros, "defiende")}`, CON_BALON[`${rolS}>${rolN}`]),
    ...(CON_AEREO.has(def.tipo) ? [bloque("aire", "Por arriba", [AEREO])] : []),
  ];

  const facetas = bloques.flatMap((b) => b.facetas);

  const altN = media(nuestros.map((j) => j.altura).filter((a): a is number => a !== null));
  const altS = media(suyos.map((j) => j.altura).filter((a): a is number => a !== null));
  const altura = altN !== null && altS !== null ? { nuestra: Math.round(altN), suya: Math.round(altS) } : null;

  const conDato = facetas.filter((f) => f.diferencia !== null);
  const difs = conDato.map((f) => f.diferencia as number);

  /* La altura sólo pesa donde el duelo se juega por arriba, y poco: 3 puntos por centímetro, con tope. */
  if (altura && CON_ALTURA.has(def.tipo)) difs.push(Math.max(-20, Math.min(20, (altura.nuestra - altura.suya) * 3)));

  const balance = difs.length && conDato.length ? Math.round(difs.reduce((a, b) => a + b, 0) / difs.length) : null;
  const veredicto = nuestros.length && suyos.length ? veredictoDe(balance, UMBRAL_DUELO) : "sin-datos";
  const conBalon = bloques.find((b) => b.sentido === "con")?.balance ?? null;
  const sinBalon = bloques.find((b) => b.sentido === "sin")?.balance ?? null;

  const resumen = (() => {
    if (!nuestros.length || !suyos.length) return "Falta poner a alguien en uno de los dos lados.";
    if (balance === null) return `No hay datos de Wyscout suficientes de ${quienN} o de ${quienS} para medir este duelo.`;
    /*
    | EL PIE DICE LO MISMO QUE LA CABECERA, Y DESDE EL QUE GANA (29/10/2026)
    |
    | Antes el pie salía del promedio (`veredicto`) y la cabecera, de la suma
    | de los dos sentidos: «En contra −12 (−34 con su balón)» arriba y «Duelo
    | parejo» abajo. Y los «+»/«−» eran siempre del Castilla, así que «Ventaja
    | para Dacosta: con balón + regate contra entrada» se leía al revés (ese
    | «+» era de Fortea). Ahora el veredicto es `veredictoDeCabecera` y la
    | frase cuenta en qué gana el que gana y, aparte, en qué le gana el otro.
    */
    const lista = (b: BloqueDuelo | undefined, v: Veredicto) =>
      (b?.facetas ?? []).filter((f) => f.veredicto === v).map((f) => f.titulo.toLowerCase());
    const con = bloques.find((b) => b.sentido === "con");
    const sin = bloques.find((b) => b.sentido === "sin");
    const aire = bloques.find((b) => b.sentido === "aire")?.facetas[0];
    const leido = veredictoDeCabecera(conBalon, sinBalon, veredicto);
    const y = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0] ?? "");

    /* En qué gana cada lado, contado desde ese lado: «con su balón» es el balón de quien se nombra.
       El verbo concuerda con el hueco (30/10/2026): «Rivas y Naasei ganan», no «gana». */
    const ganaDe = (nuestro: boolean) => {
      const v: Veredicto = nuestro ? "ventaja" : "desventaja";
      const gana = verbo(nuestro ? nuestros : suyos, "gana");
      const conSuBalon = lista(nuestro ? con : sin, v);
      const sinBalonSuyo = lista(nuestro ? sin : con, v);
      /* «Atacando» y «defendiendo», no «con/sin balón»: con el mismo nombre de
         enfrentamiento en los dos sentidos («regate contra entrada»), la frase
         parecía decir que ganaban los dos lo mismo (10/11/2026, jueces). */
      const partes = [
        conSuBalon.length ? `atacando ${gana} en ${y(conSuBalon)}` : "",
        sinBalonSuyo.length ? `defendiendo ${gana} en ${y(sinBalonSuyo)}` : "",
        aire && aire.veredicto === v ? `${gana} por arriba` : "",
      ].filter(Boolean);
      return { partes, todo: [...conSuBalon, ...sinBalonSuyo, ...(aire && aire.veredicto === v ? ["por arriba"] : [])] };
    };
    const deN = ganaDe(true);
    const deS = ganaDe(false);
    const talla =
      altura && CON_ALTURA.has(def.tipo) && Math.abs(altura.nuestra - altura.suya) >= 4
        ? `${altura.nuestra > altura.suya ? quienN : quienS} ${verbo(altura.nuestra > altura.suya ? nuestros : suyos, "saca")} ${Math.abs(altura.nuestra - altura.suya)} cm de media`
        : "";

    if (leido === "ventaja" || leido === "desventaja") {
      const nuestro = leido === "ventaja";
      const gana = nuestro ? deN : deS;
      const pierde = nuestro ? deS : deN;
      const partes = [
        gana.partes.join("; "),
        pierde.todo.length
          ? `${nuestro ? quienS : quienN} sólo ${(nuestro ? nuestros : suyos).length > 1 ? "les" : "le"} ${verbo(nuestro ? suyos : nuestros, "gana")} en ${y(pierde.todo)}`
          : "",
        talla,
      ].filter(Boolean);
      const cabeza = `Ventaja para ${nuestro ? quienN : quienS}`;
      return partes.length ? `${cabeza}: ${partes.join("; ")}.` : `${cabeza}.`;
    }

    const cabeza =
      leido === "anulan"
        ? `Se anulan (${conBalon !== null && conBalon > 0 ? "+" : ""}${conBalon} con el balón nuestro, ${sinBalon !== null && sinBalon > 0 ? "+" : ""}${sinBalon} con el suyo)`
        : "Duelo parejo";
    const partes = [
      deN.partes.length ? `${quienN} ${deN.partes.join("; ")}` : "",
      deS.partes.length ? `${quienS} ${deS.partes.join("; ")}` : "",
      talla,
    ].filter(Boolean);
    return partes.length ? `${cabeza}: ${partes.join("; ")}.` : `${cabeza}: ningún enfrentamiento se despega.`;
  })();

  return {
    def,
    nuestros,
    suyos,
    bloques,
    facetas,
    altura,
    balance,
    conBalon,
    sinBalon,
    veredicto,
    resumen,
    cobertura: { con: conDato.length, de: facetas.length },
    parejas:
      sinParejas || (nuestros.length < 2 && suyos.length < 2)
        ? []
        : nuestros.flatMap((n) => suyos.map((x) => mideDuelo(def, [n], [x], referencias, true))),
  };
}

/** Todos los duelos de dos onces ya colocados por hueco. */
export function mideDuelos(
  nuestroOnce: Record<string, JugadorDuelo | undefined>,
  suyoOnce: Record<string, JugadorDuelo | undefined>,
  referencias: Map<Puesto, FilaJugador[]>,
): ResultadoDuelo[] {
  /*
  | Quien no tiene minutos en Wyscout no entra en la media (10/11/2026, jueces):
  | «Cestero y S. Martínez, P86» era la cifra de Cestero sola. Si a un lado no
  | le queda nadie con minutos, se mide con todos y el duelo sale sin datos.
  */
  const conMinutos = (lista: JugadorDuelo[]) => {
    const medibles = lista.filter((j) => j.wyscout && j.minutos > 0);
    return medibles.length ? { medibles, fuera: lista.filter((j) => !medibles.includes(j)) } : { medibles: lista, fuera: [] };
  };
  return DUELOS.map((def) => {
    const n = conMinutos(def.nuestros.map((h) => nuestroOnce[h]).filter((j): j is JugadorDuelo => Boolean(j)));
    const s = conMinutos(def.suyos.map((h) => suyoOnce[h]).filter((j): j is JugadorDuelo => Boolean(j)));
    const r = mideDuelo(def, n.medibles, s.medibles, referencias);
    const fuera = [...n.fuera, ...s.fuera];
    return fuera.length ? { ...r, sinMinutos: fuera } : r;
  });
}

export const ROTULO_HUECO = new Map(HUECOS.map((h) => [h.clave, h.rotulo]));

/* ------------------------------------------------------------------ */
/*  QUÉ LE DECIMOS (16/11/2026, jueces)                                */
/* ------------------------------------------------------------------ */

/*
| Cada duelo acababa en «gana X» y le faltaba la consigna de vestuario. Sale
| del enfrentamiento que más pierde el nuestro en ese momento (con su balón o
| con el nuestro) y se escribe para el jugador: «Leiva: no saltar a Mier
| cuando conduce; temporizar y esperar la ayuda». Si en ese momento no pierde
| nada y es con nuestro balón, la consigna es buscar lo que gana.
*/
type Plantilla = (n: string, s: string) => string;

/** Defendiendo (balón suyo), el enfrentamiento que perdemos. */
const DEFENDER: Record<string, Plantilla> = {
  [E.regate.titulo]: (n, s) => `${n}: no tirarse al cruce con ${s}; orientarle hacia fuera y esperar la ayuda`,
  [E.cuerpo.titulo]: (n, s) => `${n}: no ir al choque con ${s}; defender de cara y cerrarle el pase`,
  [E.ritmo.titulo]: (n, s) => `${n}: no esperar parado a ${s}; tomar distancia antes de que arranque`,
  [E.espalda.titulo]: (n, s) => `${n}: vigilar la espalda; no quedarse en línea con ${s} y perfilarse para correr hacia atrás`,
  [E.conduccion.titulo]: (n, s) => `${n}: no saltar a ${s} cuando conduce; temporizar y esperar la ayuda`,
  [E.rompe.titulo]: (n, s) => `${n}: tapar el pase interior de ${s}; que juegue hacia fuera`,
  [E.presion.titulo]: (n, s) => `${n}: no presionar solo a ${s}, sale bien de la presión; saltar con la ayuda cerca`,
  [E.recibir.titulo]: (n, s) => `${n}: no dejar recibir a ${s} entre líneas; ir de cerca y cerrar el pase interior`,
  [E.ultimo.titulo]: (n, s) => `${n}: cerrar el último pase de ${s}; que no reciba de cara al área`,
  [E.centro.titulo]: (n, s) => `${n}: no dejar centrar cómodo a ${s}; salir al cierre y defender el área por arriba`,
  [E.remate.titulo]: (n, s) => `${n}: no dejar rematar a ${s}; achicar y tapar el disparo`,
  [AEREO.titulo]: (n, s) => `${n}: ganar la posición a ${s} antes del balón por arriba y atacar el rechace`,
};

/** Atacando (balón nuestro), el enfrentamiento que perdemos: se evita. */
const EVITAR: Record<string, Plantilla> = {
  [E.regate.titulo]: (n, s) => `${n}: poco regate contra ${s}; mejor pared o pase y desmarque`,
  [E.cuerpo.titulo]: (n, s) => `${n}: no aguantar de espaldas contra ${s}; jugar a uno o dos toques`,
  [E.ritmo.titulo]: (n, s) => `${n}: el cambio de ritmo no le gana a ${s}; buscar el dos contra uno con el compañero`,
  [E.espalda.titulo]: (n, s) => `${n}: ${s} corta los desmarques a la espalda; mejor el apoyo y el pase al pie`,
  [E.conduccion.titulo]: (n, s) => `${n}: no conducir hacia ${s}; soltar antes y atacar el espacio después`,
  [E.rompe.titulo]: (n, s) => `${n}: ${s} corta el pase interior; circular por fuera o cambiar de orientación`,
  [E.presion.titulo]: (n, s) => `${n}: ${s} aprieta bien; jugar fácil y con apoyo cerca`,
  [E.recibir.titulo]: (n, s) => `${n}: ${s} corta lo que llega entre líneas; recibir de cara o en movimiento`,
  [E.ultimo.titulo]: (n, s) => `${n}: ${s} tapa el último pase; buscar antes el centro o el remate`,
  [E.centro.titulo]: (n, s) => `${n}: ${s} gana por arriba; centros rasos o al segundo palo`,
  [E.remate.titulo]: (n, s) => `${n}: ${s} tapa los remates; rematar tras pase atrás, no de cara al bloqueo`,
  [AEREO.titulo]: (n, s) => `${n}: ${s} gana por arriba; balón al pie, no en largo`,
};

/** Atacando, el enfrentamiento que ganamos: se busca. */
const BUSCAR: Record<string, Plantilla> = {
  [E.regate.titulo]: (n, s) => `${n}: encarar a ${s}; el uno contra uno es nuestro`,
  [E.cuerpo.titulo]: (n, s) => `${n}: aguantar y proteger el balón contra ${s}`,
  [E.ritmo.titulo]: (n, s) => `${n}: cambiar de ritmo contra ${s}`,
  [E.espalda.titulo]: (n, s) => `${n}: atacar la espalda de ${s}`,
  [E.conduccion.titulo]: (n, s) => `${n}: conducir hacia ${s} y obligarle a salir`,
  [E.rompe.titulo]: (n, s) => `${n}: buscar el pase que rompe por delante de ${s}`,
  [E.presion.titulo]: (n, s) => `${n}: sacar el balón jugado aunque apriete ${s}`,
  [E.recibir.titulo]: (n, s) => `${n}: ofrecerse entre líneas a la espalda de ${s}`,
  [E.ultimo.titulo]: (n, s) => `${n}: buscar el último pase; ${s} no llega a taparlo`,
  [E.centro.titulo]: (n, s) => `${n}: centrar; ${s} pierde por arriba`,
  [E.remate.titulo]: (n, s) => `${n}: rematar; ${s} no tapa`,
  [AEREO.titulo]: (n, s) => `${n}: balón por arriba hacia él; le gana a ${s}`,
};

/** El sentido que manda en la consigna: con el balón suyo si ahí perdemos; si no, con el nuestro. */
export const sentidoDeLaConsigna = (d: Pick<ResultadoDuelo, "conBalon" | "sinBalon">): "con" | "sin" =>
  (d.sinBalon ?? 0) <= -UMBRAL_DUELO ? "sin" : "con";

/**
 * La consigna de vestuario de un duelo en un momento («con» = balón nuestro,
 * «sin» = balón suyo), con la métrica que la apoya. Vacío si no hay un
 * enfrentamiento que se despegue (lo que no tiene dato no se nombra).
 */
export function consignaDelDuelo(d: ResultadoDuelo, sentido: "con" | "sin"): string {
  const facetas = d.facetas.filter((f) => (f.sentido === sentido || f.sentido === "aire") && f.diferencia !== null);
  /*
  | La consigna sale del enfrentamiento de MÁS diferencia de ese momento, el
  | mismo que pintan las barras (16/11/2026, 3.ª vuelta, jueces): en «nuestros
  | centrales vs su delantero, con balón nuestro (+13)» se ganaba el pase y la
  | orden hablaba de la conducción, que se perdía. Con su balón, si lo de más
  | diferencia es a favor, se busca lo que se pierde; si no se pierde nada, nada.
  */
  const conDif = facetas.filter((f) => f.veredicto !== "parejo" && f.veredicto !== "sin-datos");
  const mayor = [...conDif].sort((a, b) => Math.abs(b.diferencia ?? 0) - Math.abs(a.diferencia ?? 0))[0];
  const peorDeTodas = conDif.filter((f) => f.veredicto === "desventaja").sort((a, b) => (a.diferencia ?? 0) - (b.diferencia ?? 0))[0];
  const elegida = mayor && (mayor.veredicto === "desventaja" || sentido === "con") ? mayor : peorDeTodas;
  if (!elegida) return "";
  const peor = elegida.veredicto === "desventaja";
  const tabla = peor ? (sentido === "sin" ? DEFENDER : EVITAR) : BUSCAR;
  const plantilla = tabla[elegida.titulo];
  if (!plantilla) return "";
  /* El nuestro que más lo sufre (o más lo gana) y el suyo que más lo hace. */
  const porPercentil = (ms: Medida[], alto: boolean) => [...ms].sort((a, b) => (alto ? b.percentil - a.percentil : a.percentil - b.percentil))[0];
  const n = porPercentil(elegida.nuestros, !peor)?.jugador;
  const s = porPercentil(elegida.suyos, Boolean(peor))?.jugador;
  if (!n || !s) return "";
  const nombre = (j: JugadorDuelo) => j.corto ?? apellido(j.nombre);
  /* La tarea y el objetivo medible (16/11/2026, jueces): no sólo la orden. */
  const tarea = (sentido === "sin" ? TAREA_DEFENDER : TAREA_ATACAR)[elegida.titulo];
  const columna = rotuloColumna(sentido === "sin" || peor ? elegida.columnaSuya : elegida.columnaNuestra).toLowerCase();
  const en = columna ? ` en ${columna}` : "";
  const objetivo = peor
    ? `que ${nombre(s)} no pase de la mediana de su puesto (P50)${en}; hoy está en P${elegida.suyo}`
    : `que ${nombre(n)} siga por encima de P${elegida.nuestro}${en}`;
  /* Qué se cuenta en la tarea, en la misma unidad que el objetivo (17/11/2026, ronda 19, jueces de fútbol). */
  return `${plantilla(nombre(n), nombre(s))} (${elegida.titulo.toLowerCase()}: P${elegida.nuestro} frente a P${elegida.suyo}).${tarea ? ` Tarea: ${tarea}${columna ? `, contando ${columna}` : ""}.` : ""} Objetivo: ${objetivo}.`;
}

const TAREA_DEFENDER: Record<string, string> = {
  [E.regate.titulo]: "1 contra 1 defensivo en banda con la ayuda del interior",
  [E.cuerpo.titulo]: "duelos de contacto en espacio reducido",
  [E.ritmo.titulo]: "salida reactiva y carrera de ida y vuelta",
  [E.espalda.titulo]: "línea defensiva con balón descubierto y perfilado",
  [E.conduccion.titulo]: "temporizar la conducción hasta que llega la ayuda",
  [E.rompe.titulo]: "tapar líneas de pase interiores en 4 contra 4",
  [E.presion.titulo]: "salto de presión coordinado de dos",
  [E.recibir.titulo]: "vigilancia del jugador entre líneas",
  [E.ultimo.titulo]: "defensa del último pase en 6 contra 4",
  [E.centro.titulo]: "cierre al centrador y defensa del área por arriba",
  [E.remate.titulo]: "bloqueo del remate y achique",
  [AEREO.titulo]: "juego aéreo ganando la posición",
};

const TAREA_ATACAR: Record<string, string> = {
  [E.regate.titulo]: "1 contra 1 ofensivo en banda y pared",
  [E.cuerpo.titulo]: "juego de espaldas a uno o dos toques",
  [E.ritmo.titulo]: "cambio de ritmo y desmarque de apoyo y ruptura",
  [E.espalda.titulo]: "desmarques de ruptura con pase al espacio",
  [E.conduccion.titulo]: "conducción y pase en el momento justo",
  [E.rompe.titulo]: "pase entre líneas en 4 contra 4 más 2",
  [E.presion.titulo]: "salida de balón bajo presión",
  [E.recibir.titulo]: "recepción orientada entre líneas",
  [E.ultimo.titulo]: "último pase y finalización",
  [E.centro.titulo]: "centro y llegada al área",
  [E.remate.titulo]: "finalización tras pase atrás",
  [AEREO.titulo]: "balón largo y segunda jugada",
};

/* ------------------------------------------------------------------ */
/*  LO QUE SE GUARDA                                                   */
/* ------------------------------------------------------------------ */

/** Lo que se cambia a mano en cada lado: hueco → clave del jugador. */
export type DuelosDoc = { nuestro: Record<string, string>; suyo: Record<string, string> };

export const DUELOS_VACIO: DuelosDoc = { nuestro: {}, suyo: {} };

/** Lo que se guarda en un hueco que se ha dejado vacío a mano (no es la clave de nadie). */
export const HUECO_VACIO = "∅";

export function normalizaDuelos(valor: unknown): DuelosDoc {
  const v = (valor ?? {}) as Partial<DuelosDoc>;
  const limpio = (r: unknown) =>
    Object.fromEntries(
      Object.entries(r && typeof r === "object" ? (r as Record<string, unknown>) : {}).filter(
        (e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0,
      ),
    );
  return { nuestro: limpio(v.nuestro), suyo: limpio(v.suyo) };
}

/**
 * El recuento de duelos, escrito igual en el Plan de partido y en /duelos.
 * Las partes no se pisan, así que suman el total sin hacer cuentas:
 * «8 duelos medidos: 1 para buscar, 4 de doble cara (ganamos con balón,
 * perdemos sin él), 3 parejos». Las partes a 0 no se nombran.
 * 30/10/2026: con los nombres de los grupos que pinta el Plan de partido,
 * que ahora enseña los ocho (antes salían tres tarjetas y la frase contaba
 * ocho). `fraseRecuentoPartes` da las piezas para enlazar cada número.
 */
export function fraseRecuentoPartes(medidos: number, aFavor: number, enContra: number, enLosDos: number) {
  const ambos = Math.max(0, enLosDos);
  const soloAFavor = Math.max(0, aFavor - ambos);
  const soloEnContra = Math.max(0, enContra - ambos);
  const parejos = Math.max(0, medidos - (soloAFavor + soloEnContra + ambos));

  return {
    base: `${medidos} ${medidos === 1 ? "duelo medido" : "duelos medidos"}`,
    partes: [
      { grupo: "buscar", n: soloAFavor, texto: `${soloAFavor} para buscar` },
      { grupo: "doble", n: ambos, texto: `${ambos} de doble cara` },
      { grupo: "vigilar", n: soloEnContra, texto: `${soloEnContra} para vigilar` },
      { grupo: "parejos", n: parejos, texto: `${parejos} ${parejos === 1 ? "parejo" : "parejos"}` },
    ].filter((p) => p.n > 0),
  };
}

/*
| 07/11/2026 (jueces, ronda 14): /duelos decía «2 sólo a favor, 2 sólo en
| contra, 3 que ganamos con balón…» y el Plan de partido «2 para buscar, 3 de
| doble cara, 2 para vigilar»: lo mismo con dos redacciones. Ahora la frase
| sale de `fraseRecuentoPartes`, y las dos pantallas dicen lo mismo.
*/
export function fraseRecuentoDuelos(medidos: number, aFavor: number, enContra: number, enLosDos: number): string {
  /* «medidos» (29/10/2026): la cifra tiene que ser la de tarjetas pintadas, no la de huecos del once. */
  const { base, partes } = fraseRecuentoPartes(medidos, aFavor, enContra, enLosDos);

  return partes.length > 0 ? `${base}: ${partes.map((p) => p.texto).join(", ")}` : base;
}

/**
 * Los momentos (cada duelo tiene dos: con nuestro balón y con el suyo) y el
 * umbral que decide cuál cuenta: «De los 16 momentos, 5 a favor y 5 en
 * contra (±10 de percentil o más); los otros 6, sin diferencia clara».
 */
export function fraseMomentos(medidos: number, aFavor: number, enContra: number): string {
  const total = medidos * 2;
  const resto = Math.max(0, total - aFavor - enContra);

  if (total === 0) return "";

  return `De los ${total} momentos (cada duelo con nuestro balón y con el suyo), ${aFavor} a favor y ${enContra} en contra: cuentan los que se despegan ${UMBRAL_DUELO} puntos de percentil o más${resto > 0 ? `; los otros ${resto}, sin diferencia clara` : ""}.`;
}

/*
| EL DUELO QUE DECIDE, UNA SOLA REGLA (20/11/2026, ronda 5, jueces de fútbol):
| el Plan elegía «Leiva contra Jorge Mier (−57)» y Plantillas rivales abría
| «Dónde nos hacen daño» con otro (−37), y el resumen de Duelos del Plan
| empezaba por un tercero. Ahora las tres pantallas ordenan con esto: pesa más
| el duelo con la cifra más despegada (con nuestro balón o con el suyo), y sólo
| cuenta el que tiene consigna. A igual peso, el que perdemos primero.
*/
type DueloConPeso = { conBalon: number | null; sinBalon: number | null; consigna?: string };

/** Lo que pesa un duelo: su cifra más despegada, con nuestro balón o con el suyo. */
export const pesoDelDuelo = (d: Pick<DueloConPeso, "conBalon" | "sinBalon">) => Math.max(Math.abs(d.conBalon ?? 0), Math.abs(d.sinBalon ?? 0));

/** Los duelos con consigna, del que más pesa al que menos (los que perdemos, primero a igual peso). */
export function duelosPorPeso<T extends DueloConPeso>(grupos: { buscar: T[]; doble: T[]; vigilar: T[] } | null | undefined): T[] {
  if (!grupos) return [];

  return [...grupos.vigilar, ...grupos.doble, ...grupos.buscar].filter((d) => d.consigna).sort((a, b) => pesoDelDuelo(b) - pesoDelDuelo(a));
}

/** El duelo que decide: el primero de `duelosPorPeso`. El mismo en /rivals, /match-preparation y /duelos. */
export function dueloQueDecide<T extends DueloConPeso>(grupos: { buscar: T[]; doble: T[]; vigilar: T[] } | null | undefined): T | undefined {
  return duelosPorPeso(grupos)[0];
}

/** Si el duelo que decide se pierde (alguna de sus dos cifras por debajo de −10): va en «Dónde nos hacen daño». */
export const seDecideEnContra = (d: Pick<DueloConPeso, "conBalon" | "sinBalon"> | undefined) =>
  Boolean(d && Math.min(d.conBalon ?? 0, d.sinBalon ?? 0) <= -UMBRAL_DUELO && Math.abs(Math.min(d.conBalon ?? 0, d.sinBalon ?? 0)) === pesoDelDuelo(d));
