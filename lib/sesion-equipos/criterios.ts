/*
|--------------------------------------------------------------------------
| CÓMO SE PROPONEN LOS EQUIPOS: EL CRITERIO (02/11/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «que al completar automáticamente los equipos pueda
| elegir: titulares contra suplentes, sinergias, por perfiles, por líneas, o
| mezcla total o parcial; y que lo haga acorde a eso».
|
| Seis criterios, todos con lo mismo debajo: los que no hacen la tarea se
| quedan fuera, los comodines se eligen primero (nunca un portero; mejor un
| medio; rotan), el tamaño de cada equipo está decidido de antemano y nadie
| queda sin sitio. Lo que cambia es QUIÉN va con quién:
|
|   - titulares:  el once de la pizarra táctica en un equipo (o en los que
|                 hagan falta para que quepa) y los suplentes en los demás;
|   - parcial:    lo mismo, cambiando de lado el porcentaje elegido (0 % es
|                 titulares contra suplentes; 100 %, mitad y mitad);
|   - mezcla:     titulares repartidos a partes iguales y líneas parejas, al azar;
|   - lineas:     cada equipo con sus líneas completas (portero, defensas,
|                 medios y arriba), laterales y centrales repartidos;
|   - sinergias:  las parejas que se potencian (Wyscout, lib/data-analisis/
|                 sinergias.ts) juntas y las que se estorban, separadas;
|   - perfiles:   el rasgo de cada uno (aéreo, salida, regate…) repartido entre
|                 los equipos o juntando a los parecidos.
|
| Sinergias y perfiles parten del reparto por líneas y sólo intercambian
| jugadores de la misma línea: lo parejo no se pierde por buscar parejas.
|
| Cada propuesta trae una línea por equipo que explica el reparto. Sin React:
| se prueba en Node con datos reales (scripts/cargador-ts.cjs).
*/

import {
  COMODIN,
  FUERA,
  type EquipoTarea,
  type JugadorSesion,
  type PuestoDe,
  type Sitio,
  type TareaEquipos,
} from "@/lib/sesion-equipos/modelo";

export type Criterio = "titulares" | "parcial" | "mezcla" | "lineas" | "sinergias" | "perfiles";

export const CRITERIOS: { clave: Criterio; rotulo: string; explica: string }[] = [
  { clave: "titulares", rotulo: "Titulares vs suplentes", explica: "El once de la pizarra táctica en un equipo y los suplentes en el otro." },
  { clave: "parcial", rotulo: "Mezcla parcial", explica: "Titulares contra suplentes, cambiando de lado el porcentaje que elijas." },
  { clave: "mezcla", rotulo: "Mezcla total", explica: "Titulares repartidos a partes iguales y líneas parejas, al azar." },
  { clave: "lineas", rotulo: "Por líneas", explica: "Cada equipo con sus líneas completas: portero, defensas, medios y arriba." },
  { clave: "sinergias", rotulo: "Sinergias", explica: "Las parejas que se potencian, juntas; las que se estorban, separadas (Wyscout)." },
  { clave: "perfiles", rotulo: "Por perfiles", explica: "El rasgo de cada uno (aéreo, salida, regate…) repartido o junto (Wyscout)." },
];

export const esCriterio = (x: unknown): x is Criterio => CRITERIOS.some((c) => c.clave === x);

/** Una pareja medida: `saldo` > 0 se potencian, < 0 se estorban. */
export type ParejaSesion = { a: string; b: string; saldo: number; motivo: string };

/** El rasgo de un jugador, para «Por perfiles». */
export type RasgoSesion = { clave: string; rotulo: string };

export type OpcionesCriterio = {
  criterio: Criterio;
  puestoDe: PuestoDe;
  azar?: () => number;
  /** Cuántas veces ha sido comodín cada uno en la sesión: que roten. */
  vecesComodin?: Record<string, number>;
  /** Ids de la sesión que son titulares en la pizarra táctica. */
  titulares?: Set<string>;
  /** «Mezcla parcial»: de 0 a 100. */
  mezcla?: number;
  parejas?: ParejaSesion[];
  rasgos?: Record<string, RasgoSesion>;
  /** «Por perfiles»: repartir cada rasgo entre los equipos o juntar a los parecidos. */
  modoPerfiles?: "repartidos" | "juntos";
};

export type LineaExplicada = { equipo: string; nombre: string; color: string; texto: string };

export type Propuesta = {
  tarea: TareaEquipos;
  /** Una por equipo: por qué va cada uno donde va. */
  lineas: LineaExplicada[];
  /** Si el criterio no se ha podido aplicar del todo, lo que ha pasado. */
  aviso?: string;
};

/* ------------------------------------------------------------------ */
/*  PIEZAS COMUNES                                                     */
/* ------------------------------------------------------------------ */

/** La línea de cada uno: portero, defensa, medio o arriba (extremos y delanteros). */
export type Linea = "POR" | "DEF" | "MED" | "ARR" | "?";

const ORDEN_LINEA: Linea[] = ["POR", "ARR", "DEF", "MED", "?"];

export function lineaDe(j: JugadorSesion, puestoDe: PuestoDe): Linea {
  const p = puestoDe(j);

  if (!p) return "?";
  if (p === "EXT" || p === "DEL") return "ARR";

  return p;
}

function baraja<T>(lista: T[], azar: () => number) {
  const copia = [...lista];

  for (let i = copia.length - 1; i > 0; i--) {
    const k = Math.floor(azar() * (i + 1));

    [copia[i], copia[k]] = [copia[k], copia[i]];
  }

  return copia;
}

/** Con T jugadores y n equipos: todos ⌊T/n⌋ y los T mod n primeros, uno más. */
export function tamanos(total: number, n: number) {
  return Array.from({ length: n }, (_, i) => Math.floor(total / n) + (i < total % n ? 1 : 0));
}

type Estado = {
  equipos: EquipoTarea[];
  sitio: Record<string, Sitio>;
  /** Jugador → equipo (sólo los de equipo, no comodines ni fuera). */
  de: Map<string, string>;
};

const miembros = (e: Estado, equipo: string, todos: JugadorSesion[]) => todos.filter((j) => e.de.get(j.id) === equipo);

/**
 * Reparte `cola` en los equipos `ids` con el cupo de cada uno: cada jugador al
 * equipo con hueco que menos tiene de lo que dicen las `claves`, por orden
 * (primero la primera; a la par, la segunda…; al final, el más corto).
 */
function reparte(
  cola: JugadorSesion[],
  ids: string[],
  cupo: Record<string, number>,
  estado: Estado,
  todos: JugadorSesion[],
  claves: ((j: JugadorSesion) => string)[],
  azar: () => number,
) {
  const cuenta = new Map<string, Map<string, number>>();
  const tamano = new Map<string, number>();

  for (const id of ids) {
    const lista = miembros(estado, id, todos);

    tamano.set(id, lista.length);
    cuenta.set(id, new Map());

    for (const j of lista) for (const [k, f] of claves.entries()) cuenta.get(id)!.set(`${k}:${f(j)}`, (cuenta.get(id)!.get(`${k}:${f(j)}`) ?? 0) + 1);
  }

  for (const j of cola) {
    const libres = ids.filter((id) => (tamano.get(id) ?? 0) < (cupo[id] ?? 0));
    const candidatos = libres.length ? libres : ids;
    const desempate = new Map(candidatos.map((id) => [id, azar()]));

    const destino = [...candidatos].sort((a, b) => {
      for (const [k, f] of claves.entries()) {
        const d = (cuenta.get(a)!.get(`${k}:${f(j)}`) ?? 0) - (cuenta.get(b)!.get(`${k}:${f(j)}`) ?? 0);

        if (d) return d;
      }

      return (tamano.get(a) ?? 0) - (tamano.get(b) ?? 0) || desempate.get(a)! - desempate.get(b)!;
    })[0];

    estado.de.set(j.id, destino);
    estado.sitio[j.id] = destino;
    tamano.set(destino, (tamano.get(destino) ?? 0) + 1);

    for (const [k, f] of claves.entries()) cuenta.get(destino)!.set(`${k}:${f(j)}`, (cuenta.get(destino)!.get(`${k}:${f(j)}`) ?? 0) + 1);
  }
}

/** Ordena para repartir: los escasos primero (porteros, los de arriba…), al azar dentro de cada línea. */
const porEscasez = (lista: JugadorSesion[], puestoDe: PuestoDe, azar: () => number) =>
  baraja(lista, azar).sort((a, b) => ORDEN_LINEA.indexOf(lineaDe(a, puestoDe)) - ORDEN_LINEA.indexOf(lineaDe(b, puestoDe)));

/** Cambia de equipo a dos jugadores. */
function intercambia(estado: Estado, a: string, b: string) {
  const ea = estado.de.get(a)!;
  const eb = estado.de.get(b)!;

  estado.de.set(a, eb);
  estado.de.set(b, ea);
  estado.sitio[a] = eb;
  estado.sitio[b] = ea;
}

/**
 * Que cada equipo tenga sus líneas (defensas, medios y arriba) cuando hay
 * jugadores de esa línea para todos: si a uno le falta una, se cambia uno de
 * esa línea de quien le sobra por uno de la línea que más le sobra a él.
 */
function completaLineas(estado: Estado, todos: JugadorSesion[], puestoDe: PuestoDe) {
  const ids = estado.equipos.map((e) => e.id);

  for (let vuelta = 0; vuelta < 12; vuelta++) {
    let cambio = false;

    for (const linea of ["DEF", "MED", "ARR"] as Linea[]) {
      const total = todos.filter((j) => estado.de.has(j.id) && lineaDe(j, puestoDe) === linea).length;

      if (total < ids.length) continue;

      const de = (id: string) => miembros(estado, id, todos).filter((j) => lineaDe(j, puestoDe) === linea);
      const corto = ids.find((id) => miembros(estado, id, todos).length >= 4 && de(id).length === 0);

      if (!corto) continue;

      const donante = [...ids].sort((a, b) => de(b).length - de(a).length)[0];

      if (de(donante).length < 2) continue;

      /* Del corto sale uno de la línea que más le sobra comparada con el donante. */
      const suyos = miembros(estado, corto, todos).filter((j) => !["POR", linea].includes(lineaDe(j, puestoDe)));
      const sobra = (j: JugadorSesion) =>
        suyos.filter((x) => lineaDe(x, puestoDe) === lineaDe(j, puestoDe)).length -
        miembros(estado, donante, todos).filter((x) => lineaDe(x, puestoDe) === lineaDe(j, puestoDe)).length;
      const sale = [...suyos].sort((a, b) => sobra(b) - sobra(a))[0];

      if (!sale) continue;

      intercambia(estado, de(donante)[de(donante).length - 1].id, sale.id);
      cambio = true;
    }

    if (!cambio) break;
  }
}

/**
 * Mejora un reparto cambiando jugadores de la misma línea entre equipos
 * mientras suba `valor`: lo parejo se queda como estaba.
 */
function mejoraPorCambios(estado: Estado, todos: JugadorSesion[], puestoDe: PuestoDe, valor: (e: Estado) => number) {
  const enEquipo = todos.filter((j) => estado.de.has(j.id));
  let actual = valor(estado);

  for (let vuelta = 0; vuelta < 60; vuelta++) {
    let mejor: { a: string; b: string; v: number } | null = null;

    for (let i = 0; i < enEquipo.length; i++) {
      for (let k = i + 1; k < enEquipo.length; k++) {
        const a = enEquipo[i];
        const b = enEquipo[k];

        if (estado.de.get(a.id) === estado.de.get(b.id)) continue;
        if (lineaDe(a, puestoDe) !== lineaDe(b, puestoDe)) continue;
        if ((puestoDe.grupo?.(a) ?? "") !== (puestoDe.grupo?.(b) ?? "")) continue;

        intercambia(estado, a.id, b.id);
        const v = valor(estado);
        intercambia(estado, a.id, b.id);

        if (v > actual + 1e-9 && (!mejor || v > mejor.v)) mejor = { a: a.id, b: b.id, v };
      }
    }

    if (!mejor) break;

    intercambia(estado, mejor.a, mejor.b);
    actual = mejor.v;
  }
}

/* ------------------------------------------------------------------ */
/*  LA PROPUESTA                                                       */
/* ------------------------------------------------------------------ */

const nombreEquipo = (e: EquipoTarea) => e.nombre.charAt(0).toUpperCase() + e.nombre.slice(1).toLowerCase();

/** «ÁLVARO LEIVA» → «Álvaro Leiva». */
const corto = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");

/** «1 POR · 3 DEF · 3 MED · 3 ARR» de una lista. */
export function lineasEnTexto(lista: JugadorSesion[], puestoDe: PuestoDe) {
  const n = (l: Linea) => lista.filter((j) => lineaDe(j, puestoDe) === l).length;
  const partes = (["POR", "DEF", "MED", "ARR"] as Linea[]).filter((l) => n(l) > 0).map((l) => `${n(l)} ${l}`);
  const sinPuesto = n("?");

  return [...partes, ...(sinPuesto ? [`${sinPuesto} por ubicar`] : [])].join(" · ");
}

/**
 * Propone los equipos de una tarea según el criterio. No toca a los que están
 * fuera; borra huecos, puntos y parejas de antes (eran de otros equipos).
 */
export function proponeConCriterio(tarea: TareaEquipos, jugadores: JugadorSesion[], opciones: OpcionesCriterio): Propuesta {
  const { puestoDe, vecesComodin = {}, titulares = new Set<string>(), parejas = [], rasgos = {} } = opciones;
  const azar = opciones.azar ?? Math.random;
  let criterio = opciones.criterio;
  let aviso: string | undefined;

  const equipos = tarea.equipos.map(({ id, nombre, color, estructura }) => ({ id, nombre, color, ...(estructura ? { estructura } : {}) }));
  const sitio: Record<string, Sitio> = {};

  for (const [id, donde] of Object.entries(tarea.sitio)) if (donde === FUERA) sitio[id] = FUERA;

  const juegan = jugadores.filter((j) => sitio[j.id] !== FUERA);
  const esTitular = (j: JugadorSesion) => titulares.has(j.id);
  const titularesQueJuegan = juegan.filter(esTitular);

  /* Lo que no se puede hacer se dice y se reparte por líneas. */
  if ((criterio === "titulares" || criterio === "parcial") && titularesQueJuegan.length === 0) {
    aviso = "Ninguno de los de la tarea está en el once de la pizarra táctica: reparto por líneas.";
    criterio = "lineas";
  }

  if (criterio === "sinergias" && !parejas.some((p) => juegan.some((j) => j.id === p.a) && juegan.some((j) => j.id === p.b))) {
    aviso = "Wyscout no tiene parejas medidas entre los que hacen la tarea: reparto por líneas.";
    criterio = "lineas";
  }

  if (criterio === "perfiles" && juegan.filter((j) => rasgos[j.id]).length < 2) {
    aviso = "Wyscout no marca rasgos en al menos dos de los que hacen la tarea: reparto por líneas.";
    criterio = "lineas";
  }

  if (equipos.length < 2 && (criterio === "titulares" || criterio === "parcial")) criterio = "lineas";

  /* 1. Comodines: medios primero, nunca un portero, y quien menos lo ha sido.
        Con titulares contra suplentes, mejor un suplente: el once va junto. */
  let cola = baraja(juegan, azar);
  const conTitulares = criterio === "titulares" || criterio === "parcial";
  const faltan = Math.max(0, tarea.comodines);
  const prioridad = (j: JugadorSesion) =>
    (lineaDe(j, puestoDe) === "MED" ? 0 : 1) + (conTitulares && esTitular(j) ? 2 : 0) + (vecesComodin[j.id] ?? 0) * 4;
  const comodines = cola
    .filter((j) => lineaDe(j, puestoDe) !== "POR")
    .sort((a, b) => prioridad(a) - prioridad(b))
    .slice(0, faltan);

  for (const j of comodines) sitio[j.id] = COMODIN;

  cola = cola.filter((j) => sitio[j.id] !== COMODIN);

  const estado: Estado = { equipos, sitio, de: new Map() };

  if (!equipos.length) return { tarea: { ...tarea, sitio, equipos }, lineas: [], aviso };

  const ids = equipos.map((e) => e.id);
  const medidas = tamanos(cola.length, ids.length);
  const cupo: Record<string, number> = Object.fromEntries(ids.map((id, i) => [id, medidas[i]]));
  const linea = (j: JugadorSesion) => lineaDe(j, puestoDe);
  const grupo = (j: JugadorSesion) => puestoDe.grupo?.(j) ?? linea(j);
  const tit = (j: JugadorSesion) => (esTitular(j) ? "T" : "S");

  /* Los equipos de los titulares: los que hagan falta para que quepa el once. */
  let equiposTitulares: string[] = [];

  if (criterio === "titulares" || criterio === "parcial") {
    const titularesCola = porEscasez(cola.filter(esTitular), puestoDe, azar);
    const cuantos = Math.min(ids.length - 1, Math.max(1, Math.round(titularesCola.length / (medidas[0] || 1))));

    equiposTitulares = ids.slice(0, cuantos);

    const sitioTit = equiposTitulares.reduce((s, id) => s + cupo[id], 0);

    /* Si no caben todos, se quedan fuera del lado titular los de la línea que más sobra. */
    const entran = [...titularesCola];
    const sobran: JugadorSesion[] = [];

    while (entran.length > sitioTit) {
      const cuenta = (l: Linea) => entran.filter((j) => linea(j) === l).length;
      const quien = [...entran].reverse().find((j) => linea(j) !== "POR" && cuenta(linea(j)) === Math.max(...entran.filter((x) => linea(x) !== "POR").map((x) => cuenta(linea(x)))));

      if (!quien) break;

      entran.splice(entran.indexOf(quien), 1);
      sobran.push(quien);
    }

    reparte(entran, equiposTitulares, cupo, estado, cola, [grupo], azar);

    /* Huecos libres del lado titular: suplentes de la línea que le falta. */
    const suplentes = porEscasez([...cola.filter((j) => !esTitular(j)), ...sobran], puestoDe, azar);
    const huecos = sitioTit - entran.length;

    if (huecos > 0) {
      const ladoTit = cola.filter((j) => estado.de.has(j.id));
      const falta = (j: JugadorSesion) => ladoTit.filter((x) => grupo(x) === grupo(j)).length;
      const porteros = ladoTit.filter((x) => linea(x) === "POR").length;
      const elegidos = [...suplentes]
        .filter((j) => linea(j) !== "POR" || porteros < equiposTitulares.length)
        .sort((a, b) => falta(a) - falta(b))
        .slice(0, huecos);

      reparte(elegidos, equiposTitulares, cupo, estado, cola, [grupo], azar);
    }

    const resto = porEscasez(cola.filter((j) => !estado.de.has(j.id)), puestoDe, azar);

    reparte(resto, ids.filter((id) => !equiposTitulares.includes(id)), cupo, estado, cola, [grupo], azar);

    /* Mezcla parcial: el porcentaje elegido de titulares cambia de lado, cada uno por un suplente de su línea. */
    if (criterio === "parcial") {
      const pct = Math.min(100, Math.max(0, opciones.mezcla ?? 50));
      const ladoT = baraja(cola.filter((j) => equiposTitulares.includes(estado.de.get(j.id) ?? "") && esTitular(j)), azar);
      /* Al 100 %, los titulares quedan a partes iguales entre los dos lados (cuenta también los que ya estaban enfrente). */
      const enfrente = cola.filter((j) => esTitular(j) && estado.de.has(j.id) && !equiposTitulares.includes(estado.de.get(j.id)!)).length;
      const lados = equiposTitulares.length / ids.length;
      const paraIgualar = Math.max(0, Math.floor(ladoT.length - (ladoT.length + enfrente) * lados));
      const k = Math.round((pct / 100) * paraIgualar);
      const usados = new Set<string>();
      let hechos = 0;

      for (const t of ladoT) {
        if (hechos >= k) break;

        const otros = cola.filter((j) => !usados.has(j.id) && !esTitular(j) && !equiposTitulares.includes(estado.de.get(j.id) ?? ""));
        const par = otros.find((j) => grupo(j) === grupo(t)) ?? otros.find((j) => linea(j) === linea(t)) ?? (linea(t) === "POR" ? undefined : otros.find((j) => linea(j) !== "POR"));

        if (!par) continue;

        intercambia(estado, t.id, par.id);
        usados.add(t.id).add(par.id);
        hechos += 1;
      }
    }
  } else if (criterio === "mezcla") {
    /* Titulares primero, repartidos a partes iguales; luego los demás, parejos por línea. */
    reparte(porEscasez(cola.filter(esTitular), puestoDe, azar), ids, cupo, estado, cola, [tit, grupo], azar);
    reparte(porEscasez(cola.filter((j) => !esTitular(j)), puestoDe, azar), ids, cupo, estado, cola, [linea, grupo, tit], azar);
    completaLineas(estado, cola, puestoDe);
  } else {
    /* Por líneas, y la base de sinergias y perfiles. */
    reparte(porEscasez(cola, puestoDe, azar), ids, cupo, estado, cola, [linea, grupo], azar);
    completaLineas(estado, cola, puestoDe);

    if (criterio === "sinergias") {
      const util = parejas.filter((p) => cola.some((j) => j.id === p.a) && cola.some((j) => j.id === p.b));

      mejoraPorCambios(estado, cola, puestoDe, (e) =>
        util.reduce((s, p) => s + (e.de.get(p.a) === e.de.get(p.b) ? p.saldo : 0), 0),
      );
    }

    if (criterio === "perfiles") {
      const juntos = opciones.modoPerfiles === "juntos";

      mejoraPorCambios(estado, cola, puestoDe, (e) => {
        let v = 0;

        for (const id of ids) {
          const cuenta = new Map<string, number>();

          for (const j of cola) if (e.de.get(j.id) === id && rasgos[j.id]) cuenta.set(rasgos[j.id].clave, (cuenta.get(rasgos[j.id].clave) ?? 0) + 1);

          for (const n of cuenta.values()) v += juntos ? n * n : -n * n;
        }

        return v;
      });
    }
  }

  /* 2. Por qué va cada uno donde va: una línea por equipo. */
  const lineas: LineaExplicada[] = equipos.map((e) => {
    const lista = miembros(estado, e.id, cola);
    const lineasTxt = lineasEnTexto(lista, puestoDe);
    const t = lista.filter(esTitular).length;
    const s = lista.length - t;
    const titYsup = `${t} ${t === 1 ? "titular" : "titulares"} y ${s} ${s === 1 ? "suplente" : "suplentes"}`;
    let texto = lineasTxt;

    if (criterio === "titulares") {
      texto = equiposTitulares.includes(e.id)
        ? `${t === lista.length ? `${t} titulares de la pizarra` : `${titYsup} (el once no llena el equipo)`} · ${lineasTxt}`
        : `${t ? titYsup : `${s} suplentes`} · ${lineasTxt}`;
    } else if (criterio === "parcial") {
      texto = `${titYsup} · ${lineasTxt}`;
    } else if (criterio === "mezcla") {
      texto = titulares.size ? `${titYsup} · ${lineasTxt}` : lineasTxt;
    } else if (criterio === "sinergias") {
      const juntas = parejas.filter((p) => p.saldo > 0 && estado.de.get(p.a) === e.id && estado.de.get(p.b) === e.id);
      const nombre = (id: string) => corto(cola.find((j) => j.id === id)?.nombre ?? "");

      texto = juntas.length
        ? `juntos ${juntas
            .slice(0, 3)
            .map((p) => `${nombre(p.a)} y ${nombre(p.b)} (${p.motivo})`)
            .join("; ")} · ${lineasTxt}`
        : lineasTxt;
    } else if (criterio === "perfiles") {
      const cuenta = new Map<string, { rotulo: string; n: number }>();

      for (const j of lista) {
        const r = rasgos[j.id];

        if (r) cuenta.set(r.clave, { rotulo: r.rotulo, n: (cuenta.get(r.clave)?.n ?? 0) + 1 });
      }

      const partes = [...cuenta.values()].sort((a, b) => b.n - a.n).map((x) => `${x.rotulo.toLowerCase()}${x.n > 1 ? ` ×${x.n}` : ""}`);

      texto = partes.length ? `${partes.join(", ")} · ${lineasTxt}` : lineasTxt;
    }

    return { equipo: e.id, nombre: nombreEquipo(e), color: e.color, texto };
  });

  const nComodines = Object.values(sitio).filter((d) => d === COMODIN).length;

  if (nComodines) {
    const suyos = juegan.filter((j) => sitio[j.id] === COMODIN).map((j) => corto(j.nombre));

    lineas.push({ equipo: COMODIN, nombre: nComodines === 1 ? "Comodín" : "Comodines", color: tarea.colorComodin, texto: `${suyos.join(", ")} (rotan: antes quien menos lo ha sido hoy)` });
  }

  return { tarea: { ...tarea, sitio: estado.sitio, equipos }, lineas, aviso };
}
