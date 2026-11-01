/*
|--------------------------------------------------------------------------
| PROPUESTA DE ONCE PARA EL PRÓXIMO PARTIDO (01/11/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «una opción de propuesta de once según el perfil del
| partido, que será el del próximo rival». Se eligen once de los disponibles,
| hueco a hueco del 4-2-3-1 de la pizarra, con cuatro factores que se pueden
| encender y apagar:
|
|   - DUELOS: el mismo cálculo de /duelos (`mideDuelo`) de cada candidato
|     contra quien tendría enfrente en su once probable.
|   - LO QUE PIDE SU JUEGO: el estilo del rival en Wyscout (`perfilDe`:
|     centros, juego largo, presión, contras, posesión) decide qué se le pide
|     a cada puesto, y la pareja se mira con las sinergias de DATA
|     (`sinergiasDe`): quién se potencia y quién se pisa.
|   - RENDIMIENTO EMOCIONAL: la media de los cuatro ejes de /emotion; quien no
|     tiene valoración lleva la media del equipo (no suma ni resta).
|   - EL ÚLTIMO PARTIDO: la nota de Valoraciones del último partido valorado,
|     contra la del equipo ese día y contra la suya de siempre.
|
| Además pesan el encaje en el puesto (el lado incluido), la regularidad
| (minutos) y un poco quien ya está en ese hueco, para que con todo apagado
| la propuesta sea el once de ahora y no un sorteo.
|
| Cada factor lleva su porcentaje (`pesosPropuesta.ts`), editable en el
| panel; con los de por defecto sale lo mismo que antes de poder tocarlos.
| Quién no puede jugar ya no sale de la columna ESTADO de la hoja, sino de
| las bajas marcadas en la pizarra (`disponibilidad.ts`).
|
| Se reparte con el método húngaro (el mejor once en conjunto, no hueco a
| hueco: si no, el primer hueco se lleva al mejor aunque haga más falta en
| otro) y después se prueba, hueco a hueco, si un cambio mejora las parejas.
|
| La explicación de cada uno es UNA línea y sólo dice conclusiones: nada de
| percentiles, puntos ni nombres de métricas.
*/

import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import { perfilDe, type PerfilColectivo } from "@/lib/data-analisis/equipo";
import { HUECOS, ladoDeWyscout, lineaDe, sitioDe, vaAlLado, type Hueco, type JugadorOnce } from "@/lib/data-analisis/once";
import { sinergiasDe, type Pareja } from "@/lib/data-analisis/sinergias";
import { puestoDe, universoDe, type Puesto } from "@/lib/data-analisis/individual";
import { mismoEquipo } from "@/lib/data-analisis/nombres";
import { DUELOS, conApellidosClaros, medida, mideDuelo, referenciasPorPuesto, type JugadorDuelo, type ResultadoDuelo } from "@/lib/duelos";
import { nuestrosDe } from "@/lib/duelos-onces";
import { idVigente } from "@/lib/fichajes";
import type { RatingsSeason } from "@/lib/ratings/types";
import { casaNombre } from "@/lib/tactics/onceDeLaPizarra";
import type { Player } from "@/types/player";

import { disponible, estadoEnPalabras, type ConBaja } from "./disponibilidad";
import { hungaro } from "./hungaro";
import { PESOS_POR_DEFECTO, multiplicador, type Pesos } from "./pesosPropuesta";

export { disponible, estadoEnPalabras };

/* ------------------------------------------------------------------ */
/*  LOS FACTORES                                                       */
/* ------------------------------------------------------------------ */

export type Factor = "duelos" | "colectivo" | "emocional" | "tendencia";

export const FACTORES: { clave: Factor; rotulo: string }[] = [
  { clave: "duelos", rotulo: "Duelos contra su once" },
  { clave: "colectivo", rotulo: "Lo que pide su juego" },
  { clave: "emocional", rotulo: "Rendimiento emocional" },
  { clave: "tendencia", rotulo: "Último partido" },
];

export const TODOS_ACTIVOS: Record<Factor, boolean> = { duelos: true, colectivo: true, emocional: true, tendencia: true };

export type EstadoFactor = {
  clave: Factor;
  disponible: boolean;
  /** Por qué no se puede usar (corto), o qué dice cuando sí (una línea). */
  nota: string;
};

/* ------------------------------------------------------------------ */
/*  LO QUE ENTRA                                                       */
/* ------------------------------------------------------------------ */

export type FilaEmocional = { jugador: string; ea: number; ie: number; ia: number; ee: number };

export type DatosPropuesta = {
  /** Con la baja vigente de cada uno colgada (`conBajas`). */
  plantilla: ConBaja[];
  /** Wyscout, jugadores (todas las ligas: hace falta para los percentiles). */
  jugadores: FilaJugador[];
  /** Wyscout, «Team Stats» por partido (para el estilo del rival). */
  partidos: FilaPartido[];
  /** El rival tal y como lo escribe el calendario. */
  rival: string;
  /** Su once probable por hueco (el de /duelos). */
  onceSuyo: Record<string, JugadorDuelo | undefined>;
  /** La hoja emocional con lo editado encima. */
  emocional: FilaEmocional[];
  temporada: RatingsSeason | null;
};

/* ------------------------------------------------------------------ */
/*  LO QUE PIDE SU JUEGO                                               */
/* ------------------------------------------------------------------ */

type Demanda = {
  clave: string;
  /** Cómo se dice de ellos: «centran mucho». */
  ellos: string;
  huecos: string[];
  columna: string;
  /** Lo que se dice del nuestro que lo cumple. */
  frase: string;
};

/**
 * Qué rasgo de estilo del rival es «alto» o «bajo» en su competición. Se mira
 * el puesto de más a menos (`puestoDeMas`): en el primer tercio es alto, en el
 * último, bajo.
 */
function rasgo(perfil: PerfilColectivo, clave: string): "alto" | "bajo" | null {
  const m = perfil.metricas.find((x) => x.metrica.key === clave);

  if (!m || m.de < 6) return null;
  if (m.puestoDeMas <= Math.ceil(m.de / 3)) return "alto";
  if (m.puestoDeMas > Math.floor((m.de * 2) / 3)) return "bajo";

  return null;
}

/** Lo que el estilo del rival le pide a cada puesto nuestro. */
export function demandasDe(perfil: PerfilColectivo | null): Demanda[] {
  if (!perfil) return [];

  const lista: Demanda[] = [];
  const centros = rasgo(perfil, "centros");
  const largo = rasgo(perfil, "pasesLargos");
  /* PPDA bajo = presionan mucho: en «de más a menos» queda abajo. */
  const ppda = rasgo(perfil, "ppda");
  const altas = rasgo(perfil, "recuperacionesAltas");
  const contras = rasgo(perfil, "contras");
  const posesion = rasgo(perfil, "posesion");

  if (centros === "alto")
    lista.push({ clave: "centros", ellos: "centran mucho", huecos: ["cen-d", "cen-i", "lat-d", "lat-i"], columna: "Duelos aéreos ganados, %", frase: "ellos centran mucho y él gana por arriba" });

  if (largo === "alto")
    lista.push({ clave: "largo", ellos: "juegan en largo", huecos: ["cen-d", "cen-i", "piv-d", "piv-i"], columna: "Duelos aéreos ganados, %", frase: "juegan en largo y él gana por arriba" });

  if (ppda === "bajo" || altas === "alto")
    lista.push({ clave: "presion", ellos: "presionan arriba", huecos: ["por", "cen-d", "cen-i", "piv-d", "piv-i"], columna: "Precisión pases, %", frase: "presionan arriba y él da salida limpia" });

  if (contras === "alto") {
    lista.push({ clave: "contras", ellos: "viven de la contra", huecos: ["piv-d", "piv-i"], columna: "Interceptaciones/90", frase: "viven de la contra y él corta por delante" });
    lista.push({ clave: "contras-atras", ellos: "viven de la contra", huecos: ["cen-d", "cen-i"], columna: "Duelos defensivos ganados, %", frase: "viven de la contra y él gana los duelos atrás" });
  }

  if (posesion === "alto") {
    lista.push({ clave: "posesion", ellos: "tienen mucho el balón", huecos: ["piv-d", "piv-i", "media"], columna: "Acciones defensivas realizadas/90", frase: "tienen mucho el balón y él roba mucho" });
    lista.push({ clave: "posesion-espalda", ellos: "tienen mucho el balón", huecos: ["del", "ban-d", "ban-i"], columna: "Ataque en profundidad/90", frase: "adelantan la defensa y él ataca la espalda" });
  }

  if (posesion === "bajo") {
    lista.push({ clave: "repliegue", ellos: "ceden el balón", huecos: ["media", "ban-d", "ban-i"], columna: "Regates realizados, %", frase: "se encierran y él desequilibra en el uno contra uno" });
    lista.push({ clave: "repliegue-pase", ellos: "ceden el balón", huecos: ["media", "piv-d", "piv-i"], columna: "Jugadas claves/90", frase: "se encierran y él da el último pase" });
  }

  return lista;
}

/** «centran mucho y presionan arriba»: lo que se dice en la casilla. */
export function estiloEnUnaLinea(demandas: Demanda[]): string {
  const rasgos = [...new Set(demandas.map((d) => d.ellos))];

  if (rasgos.length === 0) return "";
  if (rasgos.length === 1) return rasgos[0];

  return `${rasgos.slice(0, -1).join(", ")} y ${rasgos[rasgos.length - 1]}`;
}

/* ------------------------------------------------------------------ */
/*  LAS PIEZAS DE LA NOTA                                              */
/* ------------------------------------------------------------------ */

type Aporte = { factor: Factor | "base"; puntos: number; frase: string };

type Candidato = {
  ficha: Player;
  duelo: JugadorDuelo | null;
  puesto: Puesto;
  lado: JugadorDuelo["lado"];
  minutos: number;
  /** Sus otros puestos: los demás que da Wyscout y el de la hoja. */
  otros: { puesto: Puesto; lado: JugadorDuelo["lado"] }[];
};

const apellido = (nombre: string) => {
  const t = nombre.trim().split(/\s+/);

  return t.length > 1 ? t.slice(1).join(" ") : nombre;
};

const y = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : (xs[0] ?? ""));

/** Lo que encaja en el hueco: puesto y lado. Un portero sólo va de portero. */
function encaje(c: Candidato, h: Hueco): number {
  if ((c.puesto === "POR") !== (h.puesto === "POR")) return -1000;
  if (c.puesto === h.puesto && c.lado === h.lado) return 30;
  if (c.puesto === h.puesto && vaAlLado(h, c.lado)) return 26;
  /* Uno de sus otros puestos (Wyscout da varios; la hoja, el del club): le vale. */
  if (c.otros.some((o) => o.puesto === h.puesto && vaAlLado(h, o.lado))) return 22;
  if (c.puesto === h.puesto) return 12;

  /* Un extremo puede bajar a lateral de su banda; un mediapunta, no. */
  if (h.puesto === "LAT" && c.puesto === "BAN" && c.lado !== "C") return c.lado === h.lado ? 0 : -10;

  /* Parientes: un medio de mediapunta, un extremo de nueve, un central de lateral. */
  const parientes: Record<string, string[]> = { MED: ["BAN"], BAN: ["MED", "DEL"], DEL: ["BAN"], LAT: ["CEN"], CEN: ["LAT", "MED"] };

  return (parientes[h.puesto] ?? []).includes(c.puesto) ? 0 : -30;
}

/** Las relaciones de las sinergias que se potencian, dichas en una frase. */
const ENCAJA_EN: Record<string, string> = {
  "Anchura por la izquierda": "dan anchura por la izquierda",
  "Anchura por la derecha": "dan anchura por la derecha",
  "Uno por fuera, otro por dentro (izquierda)": "uno va por fuera y el otro por dentro",
  "Uno por fuera, otro por dentro (derecha)": "uno va por fuera y el otro por dentro",
  "Quién vuelve por la izquierda": "uno sube y el otro vuelve",
  "Quién vuelve por la derecha": "uno sube y el otro vuelve",
  "Quién gana arriba en la pareja de centrales": "uno de los dos manda por arriba",
  "Quién saca el balón desde atrás": "uno de los dos saca el balón jugado",
  "Quién llega y quién queda en el medio": "uno llega y el otro se queda",
  "Dos medios con el mismo pase": "no se pisan con el pase",
  "El pase y el desmarque": "uno la da y el otro se desmarca",
  "El centro y el cabeceador": "uno centra y el otro remata",
  "Los dos al área": "los dos pisan el área",
};

/** Cómo se dice en una frase que gana una faceta del duelo. */
const GANA_EN: Record<string, string> = {
  "Regate contra entrada": "en el regate",
  "Cuerpo a cuerpo con balón": "en el cuerpo a cuerpo",
  "Cambio de ritmo": "en el cambio de ritmo",
  "Desmarque a la espalda": "al espacio",
  Conducción: "en la conducción",
  "Pase que rompe líneas": "con el pase que rompe líneas",
  "Pase bajo presión": "con el pase bajo presión",
  "Recibir entre líneas": "al recibir entre líneas",
  "Último pase": "en el último pase",
  "Centro contra juego aéreo": "con el centro",
  "Remate contra bloqueo": "en el remate",
  "Juego aéreo": "por arriba",
};

/** Lo que dicen los duelos de este candidato en este hueco. */
function aporteDuelos(c: Candidato, h: Hueco, onceSuyo: DatosPropuesta["onceSuyo"], refs: ReturnType<typeof referenciasPorPuesto>): Aporte | null {
  if (!c.duelo?.wyscout) return null;

  const medidos: { r: ResultadoDuelo; suyos: JugadorDuelo[] }[] = [];

  for (const def of DUELOS) {
    if (!def.nuestros.includes(h.clave)) continue;

    const suyos = def.suyos.map((k) => onceSuyo[k]).filter((j): j is JugadorDuelo => Boolean(j));

    if (!suyos.length) continue;

    const r = mideDuelo(def, [c.duelo], suyos, refs, true);

    if (r.balance !== null) medidos.push({ r, suyos });
  }

  if (!medidos.length) return null;

  const puntos = (medidos.reduce((t, m) => t + (m.r.balance ?? 0), 0) / medidos.length) * 0.6;
  const mejor = [...medidos].sort((a, b) => (b.r.balance ?? 0) - (a.r.balance ?? 0))[0];
  const gana = mejor.r.facetas
    .filter((f) => f.veredicto === "ventaja")
    .sort((a, b) => (b.diferencia ?? 0) - (a.diferencia ?? 0))
    .map((f) => GANA_EN[f.titulo] ?? `en ${f.titulo.toLowerCase()}`);
  const quien = y(mejor.suyos.map((s) => s.corto ?? apellido(s.nombre)));
  const frase = (mejor.r.balance ?? 0) > 0 ? `le gana el duelo a ${quien}${gana.length ? ` ${y([...new Set(gana)].slice(0, 2))}` : ""}` : `sufre en el duelo con ${quien}`;

  return { factor: "duelos", puntos, frase };
}

/** Lo que pide su juego a este hueco, y si el candidato lo da. */
function aporteColectivo(c: Candidato, h: Hueco, demandas: Demanda[], refs: ReturnType<typeof referenciasPorPuesto>): Aporte | null {
  if (!c.duelo?.wyscout) return null;

  let puntos = 0;
  let mejor: { d: Demanda; pct: number } | null = null;

  for (const d of demandas) {
    if (!d.huecos.includes(h.clave)) continue;

    const m = medida(c.duelo, d.columna, refs);

    if (!m) continue;

    puntos += (m.percentil - 50) * 0.25;

    if (!mejor || m.percentil > mejor.pct) mejor = { d, pct: m.percentil };
  }

  if (!mejor) return null;

  return { factor: "colectivo", puntos, frase: mejor.pct >= 60 ? mejor.d.frase : "" };
}

/* ------------------------------------------------------------------ */
/*  EMOCIONAL Y ÚLTIMO PARTIDO                                         */
/* ------------------------------------------------------------------ */

const mediaEjes = (f: FilaEmocional) => (f.ea + f.ie + f.ia + f.ee) / 4;

/** La fila emocional de un jugador, por apodo o nombre (nunca por id). */
function filaEmocionalDe(p: Player, filas: FilaEmocional[]): FilaEmocional | null {
  let mejor: FilaEmocional | null = null;
  let fuerza = 0;
  let empates = 0;

  for (const f of filas) {
    const n = Math.max(casaNombre(p.apodo ?? "", f.jugador), casaNombre(p.nombre, f.jugador));

    if (n > fuerza) {
      fuerza = n;
      mejor = f;
      empates = 1;
    } else if (n === fuerza && n > 0) {
      empates += 1;
    }
  }

  /* Un nombre suelto («Mario») sólo vale si no hay otro igual de bueno. */
  if (!mejor || fuerza === 0 || (fuerza < 3 && empates > 1)) return null;

  return mejor;
}

export type UltimoPartido = { rival: string; fecha: string; mediaEquipo: number; notas: Map<string, number> };

/** El último partido con notas (cinco o más jugadores valorados). */
export function ultimoPartidoValorado(temporada: RatingsSeason | null, hoy = new Date().toISOString().slice(0, 10)): UltimoPartido | null {
  const ocultos = new Set(temporada?.ocultos ?? []);
  const partidos = Object.values(temporada?.matches ?? {})
    .filter((m) => !ocultos.has(m.match.id) && m.match.date && m.match.date <= hoy)
    .map((m) => ({ m, notas: Object.values(m.players).filter((p) => p.rating > 0 && !p.unrated) }))
    .filter((x) => x.notas.length >= 5)
    .sort((a, b) => b.m.match.date.localeCompare(a.m.match.date));

  const ultimo = partidos[0];

  if (!ultimo) return null;

  const notas = new Map(ultimo.notas.map((p) => [idVigente(p.playerId), p.rating]));

  return {
    rival: ultimo.m.match.opponent,
    fecha: ultimo.m.match.date,
    mediaEquipo: ultimo.notas.reduce((t, p) => t + p.rating, 0) / ultimo.notas.length,
    notas,
  };
}

/** La media de un jugador en todos los partidos valorados menos el último. */
function mediaPrevia(temporada: RatingsSeason | null, id: string, salvo: string): number | null {
  const notas = Object.values(temporada?.matches ?? {})
    .filter((m) => m.match.date !== salvo)
    .map((m) => Object.values(m.players).find((p) => idVigente(p.playerId) === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.rating > 0 && !p.unrated))
    .map((p) => p.rating);

  return notas.length >= 2 ? notas.reduce((t, n) => t + n, 0) / notas.length : null;
}

const nota = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/* ------------------------------------------------------------------ */
/*  LA PROPUESTA                                                       */
/* ------------------------------------------------------------------ */

export type Elegido = {
  hueco: string;
  rotulo: string;
  ficha: Player;
  /** La línea que lo explica, ya escrita. */
  motivo: string;
  /** Si ya está en ese hueco en la pizarra. */
  repite: boolean;
};

export type Propuesta = {
  elegidos: Elegido[];
  factores: EstadoFactor[];
  /** Cuántos huecos cambian respecto a la pizarra. */
  cambios: number;
  /** Los que no entran por una baja marcada, para decirlo. */
  bajas: { nombre: string; estado: string }[];
  /** El % con el que ha pesado cada factor. */
  pesos: Pesos;
};

/** Lo que vale un candidato en un hueco, separado por factor para poder encender y apagar sin recalcular. */
type Celda = {
  c: Candidato;
  h: Hueco;
  /** Encaje en el puesto (-1000 si no puede: un portero sólo va de portero). */
  ajuste: number;
  /** Lo que dan sus minutos. */
  regularidad: number;
  /** Lo que no es un factor: la licencia sin minutos con el Castilla. */
  extra: number;
  factores: Partial<Record<Factor, Aporte>>;
};

export type PropuestaPreparada = {
  factores: EstadoFactor[];
  candidatos: Candidato[];
  tabla: Celda[][];
  /** Para las parejas: el universo ya filtrado (el mismo que filtra `sinergiasDe` por dentro). */
  universo: FilaJugador[];
  plantilla: ConBaja[];
  bajas: { nombre: string; estado: string }[];
};

/** Qué factores se pueden usar con los datos que hay, y qué dicen. */
function estadoDeFactores(d: DatosPropuesta, perfil: PerfilColectivo | null, demandas: Demanda[], ultimo: UltimoPartido | null, emocionalesCasados: number): EstadoFactor[] {
  const suyosConDatos = Object.values(d.onceSuyo).filter((j) => j?.wyscout).length;
  const suyos = Object.values(d.onceSuyo).filter(Boolean).length;

  return [
    {
      clave: "duelos",
      disponible: suyosConDatos >= 6,
      nota: suyosConDatos >= 6 ? `Contra el once probable del ${d.rival}` : suyos < 7 ? "Falta su once probable" : "Wyscout no tiene a sus titulares",
    },
    {
      clave: "colectivo",
      disponible: Boolean(perfil),
      nota: !perfil ? "Wyscout aún no tiene partidos suyos" : demandas.length ? `Ellos ${estiloEnUnaLinea(demandas)}; y qué parejas se entienden` : "Qué parejas se entienden: su juego no pide nada especial",
    },
    {
      clave: "emocional",
      disponible: emocionalesCasados >= 3,
      nota: emocionalesCasados >= 3 ? "Quien no tiene valoración lleva la media del equipo" : "No hay valoraciones emocionales",
    },
    {
      clave: "tendencia",
      disponible: Boolean(ultimo),
      nota: ultimo ? `Las notas contra el ${ultimo.rival}` : "Aún no hay un partido valorado",
    },
  ];
}

/** El jugador de la plantilla que lleva una ficha, por nombre. */
const jugadorDeNombre = (nombre: string, plantilla: Player[]) =>
  plantilla.find((x) => (x.apodo || x.nombre) === nombre) ?? plantilla.find((x) => casaNombre(nombre, x.apodo || x.nombre) >= 2 || casaNombre(nombre, x.nombre) >= 2);

/**
 * Nuestros jugadores con su fila de Wyscout (`nuestrosDe`, el de /duelos), y
 * una segunda pasada para los que la plantilla escribe con un solo nombre:
 * «Rachad» es «Rachad Fettal» y «Roberto» es «Roberto Martín», pero el cruce
 * por apellido no los ve. Sólo se casan si no hay duda (un único candidato
 * libre); si no, se quedan sin datos, como en /duelos.
 */
function nuestrosConFila(jugadores: FilaJugador[], libres: Player[]): JugadorDuelo[] {
  const fichas = (nombres: Map<string, string>) => libres.map((p) => ({ id: p.id, nombre: nombres.get(p.id) ?? p.nombre, apodo: p.apodo, foto: p.foto, posicion: String(p.posicion ?? "") }));
  const primera = nuestrosDe(jugadores, fichas(new Map()));
  const conFila = new Set(primera.filter((j) => j.fichaId && j.wyscout).map((j) => j.fichaId as string));
  const sueltas = primera.filter((j) => !j.fichaId && j.wyscout);
  const nombres = new Map<string, string>();

  for (const p of libres) {
    if (conFila.has(p.id)) continue;

    const casan = sueltas.filter((j) => Math.max(casaNombre(p.nombre, j.clave), casaNombre(p.apodo ?? "", j.clave)) >= 1);

    if (casan.length === 1 && ![...nombres.values()].includes(casan[0].clave)) nombres.set(p.id, casan[0].clave);
  }

  return nombres.size ? nuestrosDe(jugadores, fichas(nombres)) : primera;
}

/** Su once con el apellido claro cuando se repite («A. Jiménez» y «J. Jiménez»). */
function conCortos(once: DatosPropuesta["onceSuyo"]): DatosPropuesta["onceSuyo"] {
  const claves = Object.keys(once).filter((k) => once[k]);
  const claros = conApellidosClaros(claves.map((k) => once[k] as JugadorDuelo));

  return Object.fromEntries(claves.map((k, i) => [k, claros[i]]));
}

/** Lo pesado, una vez por datos: cada candidato en cada hueco, con cada factor por separado. */
export function preparaPropuesta(d: DatosPropuesta): PropuestaPreparada {
  const libres = d.plantilla.filter(disponible);
  const nuestros = nuestrosConFila(d.jugadores, libres);
  const porFicha = new Map(nuestros.filter((j) => j.fichaId).map((j) => [j.fichaId as string, j]));
  const onceSuyo = conCortos(d.onceSuyo);

  const candidatos: Candidato[] = libres.flatMap((p) => {
    const duelo = porFicha.get(p.id) ?? null;

    if (!duelo) return [];

    const deWyscout = (duelo.wyscout?.posicion ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(1)
      .map((s) => ({ puesto: puestoDe(s), lado: ladoDeWyscout(s) }));
    const deLaHoja = sitioDe(String(p.posicion ?? ""), null);

    return [{ ficha: p, duelo, puesto: duelo.puesto, lado: duelo.lado, minutos: duelo.minutos, otros: [...deWyscout, { puesto: deLaHoja.puesto, lado: deLaHoja.lado }] }];
  });

  const equipoWyscout = [...new Set(d.partidos.map((f) => f.equipo))].find((e) => mismoEquipo(e, d.rival)) ?? null;
  const perfil = equipoWyscout ? perfilDe(equipoWyscout, d.partidos) : null;
  const demandas = demandasDe(perfil);
  const ultimo = ultimoPartidoValorado(d.temporada);
  const refs = referenciasPorPuesto(d.jugadores);
  const medias = d.emocional.map(mediaEjes);
  const mediaEmocional = medias.length ? medias.reduce((t, n) => t + n, 0) / medias.length : null;
  const emocionalDe = new Map(candidatos.map((c) => [c.ficha.id, filaEmocionalDe(c.ficha, d.emocional)]));
  const casados = d.plantilla.filter((p) => filaEmocionalDe(p, d.emocional)).length;
  const factores = estadoDeFactores(d, perfil, demandas, ultimo, casados);
  const hay = (f: Factor) => Boolean(factores.find((x) => x.clave === f)?.disponible);

  /* Lo emocional y el último partido no dependen del hueco: una vez por jugador. */
  const emocional = new Map<string, Aporte>();
  const tendencia = new Map<string, Aporte>();

  for (const c of candidatos) {
    const f = emocionalDe.get(c.ficha.id);

    if (hay("emocional") && f && mediaEmocional !== null) {
      const diferencia = mediaEjes(f) - mediaEmocional;

      emocional.set(c.ficha.id, { factor: "emocional", puntos: diferencia * 5, frase: diferencia >= 0.8 ? "llega muy fuerte en lo emocional" : diferencia >= 0.4 ? "llega bien en lo emocional" : "" });
    }

    const suya = ultimo?.notas.get(c.ficha.id);

    if (hay("tendencia") && ultimo && suya !== undefined) {
      const previa = mediaPrevia(d.temporada, c.ficha.id, ultimo.fecha);
      const sobreEquipo = suya - ultimo.mediaEquipo;
      const sobreSuya = previa === null ? 0 : suya - previa;

      tendencia.set(c.ficha.id, {
        factor: "tendencia",
        puntos: sobreEquipo * 4 + sobreSuya * 2,
        frase:
          sobreEquipo >= 1
            ? `viene de un ${nota(suya)} contra el ${ultimo.rival}, de lo mejor del equipo`
            : sobreSuya >= 1
              ? `va a más: un ${nota(suya)} contra el ${ultimo.rival}`
              : "",
      });
    }
  }

  const tabla: Celda[][] = HUECOS.map((h) =>
    candidatos.map((c) => {
      const ajuste = encaje(c, h);
      const regularidad = (Math.min(c.minutos, 900) / 900) * 12;
      /* Licencia del RMC o del Juvenil A sin minutos con el Castilla: sólo para tapar. */
      const extra = c.ficha.esCastilla === false && c.minutos === 0 ? -25 : 0;

      const factoresCelda: Partial<Record<Factor, Aporte>> = {};

      /*
      | Duelos y estilo sólo cuentan en su puesto: medir a un mediapunta como
      | lateral contra su extremo es comparar su oficio con otro, y el número
      | sale bonito por eso, no porque vaya a defender mejor.
      */
      if (ajuste >= 12) {
        /* Sus cifras de Wyscout se miden contra los de SU puesto: sólo dicen algo en ese puesto. */
        const suPuesto = c.puesto === h.puesto;
        const duelo = suPuesto && hay("duelos") ? aporteDuelos(c, h, onceSuyo, refs) : null;
        const estilo = suPuesto && hay("colectivo") ? aporteColectivo(c, h, demandas, refs) : null;
        /* Y lo emocional y la nota, también en su puesto: un buen día no le hace lateral a un mediapunta. */
        const emo = emocional.get(c.ficha.id);
        const ten = tendencia.get(c.ficha.id);

        if (duelo) factoresCelda.duelos = duelo;
        if (estilo) factoresCelda.colectivo = estilo;
        if (emo) factoresCelda.emocional = emo;
        if (ten) factoresCelda.tendencia = ten;
      }

      return { c, h, ajuste, regularidad, extra, factores: factoresCelda };
    }),
  );

  return {
    factores,
    candidatos,
    tabla,
    universo: universoDe(d.jugadores, "liga"),
    plantilla: d.plantilla,
    bajas: d.plantilla
      .filter((p) => p.activo !== false && p.esCastilla !== false && !disponible(p))
      .map((p) => ({ nombre: p.apodo || p.nombre, estado: (estadoEnPalabras(p) ?? "").toLowerCase() })),
  };
}

/** El «JugadorOnce» mínimo que piden las sinergias, con el puesto del hueco que ocupa. */
/** El encaje con su peso; lo imposible (un portero de lateral) sigue siendo imposible. */
const encajePesado = (ajuste: number, m: number) => (ajuste <= -1000 ? ajuste : ajuste * m);

const comoJugadorOnce = (c: Candidato, h: Hueco): JugadorOnce => ({
  id: c.ficha.id,
  nombre: c.ficha.apodo || c.ficha.nombre,
  hueco: h.clave,
  puesto: h.puesto,
  lado: h.lado,
  linea: lineaDe(h.puesto),
  sitio: { puesto: h.puesto, lado: h.lado, segun: "wyscout", wyscout: c.duelo?.wyscout?.posicion ?? "", hoja: String(c.ficha.posicion ?? "") },
  wyscout: c.duelo?.wyscout ?? null,
  nuestra: null,
  opta: null,
});

/**
 * La propuesta con los factores encendidos. Barata: lo pesado ya está en
 * `preparaPropuesta`, así que encender una casilla o mover a alguien en la
 * pizarra no vuelve a medir nada.
 *
 * `onceActual` es quién está ahora en cada hueco (hueco → nombre de la ficha).
 */
export function proponOnceDelPartido(
  prep: PropuestaPreparada,
  onceActual: Record<string, string>,
  activos: Record<Factor, boolean>,
  /** El % de cada factor (los efectivos: suman 100 y los apagados van a 0). Sin ellos, los de por defecto. */
  pesos: Pesos = PESOS_POR_DEFECTO,
): Propuesta {
  const { factores, candidatos, tabla, universo } = prep;
  const usa = (f: Factor) => activos[f] && pesos[f] > 0 && Boolean(factores.find((x) => x.clave === f)?.disponible);
  const encendidos = FACTORES.map((f) => f.clave).filter(usa);
  const m = (k: keyof Pesos) => multiplicador(pesos, k);
  /* Los puntos de cada factor, ya con su peso. */
  const puntos = (x: Celda, f: Factor) => (x.factores[f]?.puntos ?? 0) * m(f);

  /* Quién está ahora en cada hueco, aunque no pueda jugar (para decir por quién entra). */
  const ocupante = new Map<string, Player>();
  const enHueco = new Map<string, string>();

  for (const [hueco, nombre] of Object.entries(onceActual)) {
    const p = nombre ? jugadorDeNombre(nombre, prep.plantilla) : undefined;

    if (!p) continue;

    ocupante.set(hueco, p);
    enHueco.set(p.id, hueco);
  }

  /* Lo que eligió el cuerpo técnico pesa: con todo apagado, la propuesta es casi su once. */
  const continuidad = (x: Celda) => {
    const suyo = enHueco.get(x.c.ficha.id);

    return (suyo === x.h.clave ? 6 : suyo ? 2 : 0) * m("continuidad");
  };

  const total = (x: Celda) =>
    encajePesado(x.ajuste, m("encaje")) + x.regularidad * m("minutos") + x.extra + continuidad(x) + encendidos.reduce((t, f) => t + puntos(x, f), 0);
  const n = HUECOS.length;

  /* El mejor once en conjunto. */
  const relleno = Math.max(0, n - candidatos.length);
  const coste = tabla.map((fila) => [...fila.map((x) => -total(x)), ...new Array(relleno).fill(1000)]);
  const elegido = (candidatos.length ? hungaro(coste) : new Array(n).fill(-1)).map((j) => (j >= 0 && j < candidatos.length ? j : -1));

  /* Las parejas (con «Lo que pide su juego»): hueco a hueco, se prueba con los mejores de ese puesto. */
  const conParejas = usa("colectivo");

  /*
  | Lo de una pareja sólo depende de los dos (`sinergiasDe` con dos jugadores
  | da lo mismo que esa pareja dentro del once): se calcula una vez cada una.
  */
  const memoria = new Map<string, Pareja | null>();

  const pareja = (i: number, j: number, k: number, l: number): Pareja | null => {
    const llave = i < k ? `${i}:${j}|${k}:${l}` : `${k}:${l}|${i}:${j}`;

    if (!memoria.has(llave)) memoria.set(llave, sinergiasDe([comoJugadorOnce(candidatos[j], HUECOS[i]), comoJugadorOnce(candidatos[l], HUECOS[k])], universo, "liga")[0] ?? null);

    return memoria.get(llave) ?? null;
  };

  const parejasDe = (sel: number[]) =>
    sel.flatMap((j, i) => sel.flatMap((l, k) => (k > i && j >= 0 && l >= 0 ? [pareja(i, j, k, l)] : []))).filter((p): p is Pareja => Boolean(p));

  const valor = (sel: number[]) => sel.reduce((t, j, i) => t + (j >= 0 ? total(tabla[i][j]) : -1000), 0) + (conParejas ? parejasDe(sel).reduce((t, p) => t + p.saldo, 0) * 5 * m("colectivo") : 0);

  if (conParejas && candidatos.length > n) {
    let actual = valor(elegido);

    for (let i = 0; i < n; i += 1) {
      const enUso = new Set(elegido);
      const alternativas = tabla[i]
        .map((x, j) => ({ j, v: total(x), ajuste: x.ajuste }))
        .filter((x) => !enUso.has(x.j) && x.ajuste >= 12)
        .sort((a, b) => b.v - a.v)
        .slice(0, 3);

      for (const { j } of alternativas) {
        const prueba = [...elegido];
        prueba[i] = j;

        const v = valor(prueba);

        if (v > actual + 0.5) {
          actual = v;
          elegido[i] = j;
        }
      }
    }
  }

  /* Con quién encaja cada uno (sólo lo que se potencia). */
  const encajes = new Map<string, { con: string; relacion: string }>();

  if (conParejas) {
    for (const p of parejasDe(elegido)) {
      const buena = p.veredictos.find((v) => v.estado === "potencia");

      if (!buena) continue;
      if (!encajes.has(p.a.id)) encajes.set(p.a.id, { con: p.b.nombre, relacion: buena.relacion.nombre });
      if (!encajes.has(p.b.id)) encajes.set(p.b.id, { con: p.a.nombre, relacion: buena.relacion.nombre });
    }
  }

  const elegidos: Elegido[] = HUECOS.flatMap((h, i) => {
    const j = elegido[i];

    if (j < 0) return [];

    const x = tabla[i][j];
    const repite = enHueco.get(x.c.ficha.id) === h.clave;
    const frases = encendidos
      .flatMap((f) => {
        const a = x.factores[f];

        return a ? [{ frase: a.frase, puntos: puntos(x, f) }] : [];
      })
      .filter((a) => Boolean(a.frase && a.puntos > 1.5))
      .sort((a, b) => b.puntos - a.puntos)
      .map((a) => a.frase);

    const conQuien = encajes.get(x.c.ficha.id);

    if (conQuien && frases.length < 2) frases.push(`se entiende con ${conQuien.con}: ${ENCAJA_EN[conQuien.relacion] ?? conQuien.relacion.toLowerCase()}`);

    const partes = [...new Set(frases)].slice(0, 2);
    const antes = ocupante.get(h.clave);

    /* Entra por una baja: es lo primero que hay que saber. */
    if (!repite && antes && !disponible(antes)) partes.unshift(`entra por ${antes.apodo || antes.nombre}, ${(estadoEnPalabras(antes) ?? "baja").toLowerCase()}`);

    if (!partes.length) partes.push(repite ? "sigue: nadie le mejora en el puesto" : "es el que mejor encaja en el puesto entre los disponibles");
    if (x.ajuste < 20) partes.push("juega fuera de su sitio habitual");

    const motivo = partes.slice(0, 3).join("; ");

    return [{ hueco: h.clave, rotulo: h.rotulo, ficha: x.c.ficha, motivo: `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)}.`, repite }];
  });

  return { elegidos, factores, cambios: elegidos.filter((e) => !e.repite).length, bajas: prep.bajas, pesos };
}

