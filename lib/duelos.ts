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
  /** En centímetros; null si no se sabe. */
  altura: number | null;
  pie: string;
  minutos: number;
  /** Su fila de Wyscout de esta temporada, si se ha encontrado. */
  wyscout: FilaJugador | null;
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
  remate: { titulo: "Remate contra bloqueo", ataca: "xG/90", defiende: "Tiros interceptados/90", explica: "Peligro que genera contra remates que tapa el que defiende." },
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
  const contra = (referencias.get(puesto) ?? []).map((c) => valorDe(c, columna)).filter((v): v is number => v !== null);
  if (contra.length < 5) return null;
  const percentil = percentilEnPlantilla(valor, contra, metrica?.mejorAlto ?? true);
  return percentil === null ? null : { jugador, valor, percentil };
}

export type Veredicto = "ventaja" | "parejo" | "desventaja" | "sin-datos";

/** Diferencia de percentil a partir de la cual se habla de ventaja. */
export const UMBRAL_FACETA = 15;
export const UMBRAL_DUELO = 10;

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
export const rotuloColumna = (columna: string) => METRICA_JUGADOR_POR_COLUMNA.get(columna)?.nombre ?? columna;

const apellido = (nombre: string) => {
  const t = nombre.trim().split(/\s+/);
  return t.length > 1 ? t.slice(1).join(" ") : nombre;
};

const nombres = (lista: JugadorDuelo[]) => lista.map((j) => apellido(j.nombre)).join(" y ");

function fraseDe(f: Omit<ResultadoFaceta, "frase">): string {
  if (f.veredicto === "sin-datos") {
    const falta = f.nuestro === null && f.suyo === null ? "ninguno de los dos" : f.nuestro === null ? "los nuestros" : "los suyos";
    return `${f.titulo}: sin datos fiables de ${falta}.`;
  }
  const lado = (ms: Medida[], col: string) =>
    ms.map((m) => `${apellido(m.jugador.nombre)} ${formatea(col, m.valor)} (P${m.percentil})`).join(", ");
  const inicio = f.veredicto === "ventaja" ? "Ventaja" : f.veredicto === "desventaja" ? "Desventaja" : "Parejo";
  return `${inicio} en ${f.titulo.toLowerCase()}: ${lado(f.nuestros, f.columnaNuestra)} en ${rotuloColumna(f.columnaNuestra).toLowerCase()} frente a ${lado(f.suyos, f.columnaSuya)} en ${rotuloColumna(f.columnaSuya).toLowerCase()}.`;
}

/** Mide un duelo entre los que haya en cada lado, en los dos sentidos. */
export function mideDuelo(
  def: DefDuelo,
  nuestros: JugadorDuelo[],
  suyos: JugadorDuelo[],
  referencias: Map<Puesto, FilaJugador[]>,
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
    bloque("con", `Con balón nuestro: ${quienN} ataca, ${quienS} defiende`, CON_BALON[`${rolN}>${rolS}`]),
    bloque("sin", `Con balón suyo: ${quienS} ataca, ${quienN} defiende`, CON_BALON[`${rolS}>${rolN}`]),
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
    const lista = (b: BloqueDuelo | undefined, v: Veredicto) =>
      (b?.facetas ?? []).filter((f) => f.veredicto === v).map((f) => f.titulo.toLowerCase());
    const con = bloques.find((b) => b.sentido === "con");
    const sin = bloques.find((b) => b.sentido === "sin");
    const partes: string[] = [];
    const atacando = [...lista(con, "ventaja").map((t) => `+ ${t}`), ...lista(con, "desventaja").map((t) => `− ${t}`)];
    const defendiendo = [...lista(sin, "ventaja").map((t) => `+ ${t}`), ...lista(sin, "desventaja").map((t) => `− ${t}`)];
    if (atacando.length) partes.push(`con balón ${atacando.join(", ")}`);
    if (defendiendo.length) partes.push(`sin balón ${defendiendo.join(", ")}`);
    const aire = bloques.find((b) => b.sentido === "aire")?.facetas[0];
    if (aire && aire.veredicto !== "parejo" && aire.veredicto !== "sin-datos") partes.push(`por arriba ${aire.veredicto === "ventaja" ? "+" : "−"}`);
    if (altura && CON_ALTURA.has(def.tipo) && Math.abs(altura.nuestra - altura.suya) >= 4)
      partes.push(`${altura.nuestra > altura.suya ? "les sacamos" : "nos sacan"} ${Math.abs(altura.nuestra - altura.suya)} cm de media`);
    const cabeza =
      veredicto === "ventaja" ? `Ventaja para ${quienN}` : veredicto === "desventaja" ? `Ventaja para ${quienS}` : "Duelo parejo";
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
  };
}

/** Todos los duelos de dos onces ya colocados por hueco. */
export function mideDuelos(
  nuestroOnce: Record<string, JugadorDuelo | undefined>,
  suyoOnce: Record<string, JugadorDuelo | undefined>,
  referencias: Map<Puesto, FilaJugador[]>,
): ResultadoDuelo[] {
  return DUELOS.map((def) =>
    mideDuelo(
      def,
      def.nuestros.map((h) => nuestroOnce[h]).filter((j): j is JugadorDuelo => Boolean(j)),
      def.suyos.map((h) => suyoOnce[h]).filter((j): j is JugadorDuelo => Boolean(j)),
      referencias,
    ),
  );
}

export const ROTULO_HUECO = new Map(HUECOS.map((h) => [h.clave, h.rotulo]));

/* ------------------------------------------------------------------ */
/*  LO QUE SE GUARDA                                                   */
/* ------------------------------------------------------------------ */

/** Lo que se cambia a mano en cada lado: hueco → clave del jugador. */
export type DuelosDoc = { nuestro: Record<string, string>; suyo: Record<string, string> };

export const DUELOS_VACIO: DuelosDoc = { nuestro: {}, suyo: {} };

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
