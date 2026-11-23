/**
 * COMPARATIVA DE LIGAS (23/11/2026, petición del analista: «comparativas de
 * rendimientos de las 5 grandes ligas europeas, segunda división española y
 * Primera RFEF los dos grupos»).
 *
 * Fuente única: los «Team Stats» de Wyscout de cada equipo (las mismas
 * definiciones en todas las ligas, que es lo que hace comparable el estilo).
 * `scripts/ligas-comparativa.cjs` los compacta en
 * `public/data/ligas-comparativa.json`: por liga y equipo, la media por
 * partido de cada métrica de la temporada en curso, a favor y en contra (la
 * fila del rival del mismo partido). Aquí van la forma del fichero, las
 * métricas y las cuentas puras (sin React): las usan el script y la pantalla.
 *
 * LO QUE NO DICE: el nivel. Un 55 % de posesión en Primera RFEF y en la
 * Bundesliga no valen lo mismo; lo que se compara es CÓMO se juega en cada
 * liga (volumen, ritmo, altura, directo o elaborado), no quién es mejor.
 */

export type Lado = "f" | "c";

export type Metrica = {
  id: string;
  nombre: string;
  /** La columna de Wyscout (o, si es derivada, la de arriba de la división). */
  col: string;
  /** Derivada: col / divisor, sumando antes (xG por tiro). */
  divisor?: string;
  /** A favor (la fila del equipo) o en contra (la del rival). */
  lado: Lado;
  grupo: GrupoMetrica;
  /** Qué es bueno: alto, bajo o ninguno (estilo, no rendimiento). */
  mejor: "alto" | "bajo" | null;
  dec: number;
  unidad?: string;
  /** Una frase de qué es, para el título de la fila. */
  que: string;
};

export const GRUPOS = ["ataque", "balon", "presion", "defensa", "transicion"] as const;

export type GrupoMetrica = (typeof GRUPOS)[number];

export const NOMBRE_GRUPO: Record<GrupoMetrica, string> = {
  ataque: "Ataque y ocasiones",
  balon: "Con balón",
  presion: "Ritmo, presión y duelos",
  defensa: "Defensa",
  transicion: "Transición y balón parado",
};

const m = (id: string, nombre: string, col: string, grupo: GrupoMetrica, mejor: Metrica["mejor"], dec: number, que: string, extra: Partial<Metrica> = {}): Metrica => ({
  id,
  nombre,
  col,
  lado: "f",
  grupo,
  mejor,
  dec,
  que,
  ...extra,
});

/** Por partido salvo que diga otra cosa. El orden es el de la pantalla. */
export const METRICAS: readonly Metrica[] = [
  m("goles", "Goles", "Goles", "ataque", "alto", 2, "Goles marcados por partido"),
  m("xg", "xG", "xG", "ataque", "alto", 2, "Goles esperados a favor por partido"),
  m("tiros", "Tiros", "Tiros", "ataque", "alto", 1, "Remates por partido"),
  m("tirosPct", "Tiros a puerta", "Tiros %", "ataque", "alto", 1, "Porcentaje de remates entre los tres palos", { unidad: "%" }),
  m("xgTiro", "xG por tiro", "xG", "ataque", "alto", 3, "Calidad media de cada remate (xG ÷ tiros)", { divisor: "Tiros" }),
  m("toquesArea", "Toques en el área", "Toques en el área de penalti", "ataque", "alto", 1, "Toques de balón dentro del área rival"),
  m("entradasArea", "Llegadas al área", "Entradas al área de penalti", "ataque", "alto", 1, "Veces que se entra en el área rival con balón"),
  m("distTiro", "Distancia de tiro", "Distancia media de tiro", "ataque", "bajo", 1, "Metros medios a los que se remata", { unidad: "m" }),

  m("posesion", "Posesión", "Posesión del balón, %", "balon", null, 1, "Porcentaje de posesión", { unidad: "%" }),
  m("pases", "Pases", "Pases", "balon", null, 0, "Pases intentados por partido"),
  m("pasesPct", "Acierto en el pase", "Pases %", "balon", "alto", 1, "Porcentaje de pases buenos", { unidad: "%" }),
  m("pasesPosesion", "Pases por posesión", "Promedio pases por posesión del balón", "balon", null, 2, "Pases medios en cada posesión: elaborado o directo"),
  m("progresivos", "Pases progresivos", "Pases progresivos", "balon", "alto", 1, "Pases que acercan el balón a la portería rival"),
  m("ultimoTercio", "Pases al último tercio", "Pases en el último tercio", "balon", "alto", 1, "Pases dentro o hacia el último tercio"),
  m("profundidad", "Pases en profundidad", "Pases en profundidad completados", "balon", "alto", 1, "Pases a la espalda completados"),
  m("largoPct", "Juego largo", "Lanzamiento largo %", "balon", null, 1, "Parte de los pases que son largos", { unidad: "%" }),
  m("longitudPase", "Longitud del pase", "Longitud media pases", "balon", null, 1, "Metros medios de cada pase", { unidad: "m" }),
  m("centros", "Centros", "Centros", "balon", null, 1, "Centros por partido"),

  m("intensidad", "Intensidad de paso", "Intensidad de paso", "presion", null, 2, "Pases por minuto de posesión: ritmo de circulación"),
  m("ppda", "PPDA", "PPDA", "presion", "bajo", 2, "Pases que se le dejan dar al rival por acción defensiva: cuanto más bajo, más presión"),
  m("recAltas", "Recuperaciones altas", "Balones recuperados · altos", "presion", "alto", 1, "Balones recuperados en campo rival"),
  m("recuperaciones", "Recuperaciones", "Balones recuperados", "presion", "alto", 1, "Balones recuperados en total"),
  m("duelos", "Duelos", "Duelos", "presion", null, 1, "Duelos disputados por partido"),
  m("duelosPct", "Duelos ganados", "Duelos %", "presion", "alto", 1, "Porcentaje de duelos ganados", { unidad: "%" }),
  m("aereos", "Duelos aéreos", "Duelos aéreos", "presion", null, 1, "Duelos por arriba por partido"),
  m("faltas", "Faltas", "Faltas", "presion", null, 1, "Faltas cometidas por partido"),
  m("amarillas", "Amarillas", "Tarjetas amarillas", "presion", "bajo", 2, "Tarjetas amarillas por partido"),

  m("golesContra", "Goles en contra", "Goles", "defensa", "bajo", 2, "Goles recibidos por partido", { lado: "c" }),
  m("xgContra", "xG en contra", "xG", "defensa", "bajo", 2, "Goles esperados del rival por partido", { lado: "c" }),
  m("tirosContra", "Tiros en contra", "Tiros", "defensa", "bajo", 1, "Remates del rival por partido", { lado: "c" }),
  m("toquesAreaContra", "Toques rivales en el área", "Toques en el área de penalti", "defensa", "bajo", 1, "Toques del rival dentro de nuestra área", { lado: "c" }),
  m("interceptaciones", "Interceptaciones", "Interceptaciones", "defensa", null, 1, "Pases rivales cortados por partido"),
  m("despejes", "Despejes", "Despejes", "defensa", null, 1, "Despejes por partido"),
  m("perdidasBajas", "Pérdidas en campo propio", "Balones perdidos · bajos", "defensa", "bajo", 1, "Balones perdidos cerca de la propia portería"),

  m("contraataques", "Contraataques", "Contraataques", "transicion", null, 1, "Contraataques por partido"),
  m("contraRemate", "Contras con remate", "Contraataques · con remate", "transicion", "alto", 2, "Contraataques que acaban en remate"),
  m("abp", "Jugadas a balón parado", "Jugadas a balón parado", "transicion", null, 1, "Acciones a balón parado por partido"),
  m("abpRemate", "ABP con remate", "Jugadas a balón parado · con remate", "transicion", "alto", 2, "Balones parados que acaban en remate"),
  m("corneres", "Córners", "Córneres", "transicion", null, 1, "Córners a favor por partido"),
  m("fueraJuego", "Fueras de juego", "Fuera de juego", "transicion", null, 1, "Fueras de juego por partido"),
];

/** Las de estilo para «equipos parecidos»: sin goles ni resultados (eso es nivel y suerte). */
export const METRICAS_ESTILO = [
  "posesion",
  "pasesPosesion",
  "intensidad",
  "largoPct",
  "longitudPase",
  "progresivos",
  "profundidad",
  "centros",
  "ppda",
  "recAltas",
  "duelos",
  "aereos",
  "faltas",
  "contraataques",
  "toquesArea",
  "distTiro",
  "tiros",
  "tirosContra",
] as const;

export type Liga = {
  slug: string;
  nombre: string;
  corto: string;
  /** 1 = primera división, 2 = segunda, 3 = tercera. */
  nivel: 1 | 2 | 3;
  pais: string;
  competicion: string;
  temporada: string;
  /** Hasta qué partido llega lo bajado. */
  ultimo: string;
  equipos: EquipoLiga[];
};

export type EquipoLiga = {
  nombre: string;
  pj: number;
  /** Una cifra por métrica, en el orden de METRICAS (null si Wyscout no la trae). */
  v: (number | null)[];
};

export type ComparativaLigas = { version: 1; generado: string; metricas: string[]; ligas: Liga[] };

/** Las ligas, en el orden de la pantalla, y dónde deja cada una sus .xlsx `wyscout-liga.mjs`. */
export const CATALOGO_LIGAS = [
  { slug: "laliga", nombre: "LaLiga", corto: "LaLiga", nivel: 1, pais: "España", carpeta: "public/data/wys-ligas/laliga" },
  { slug: "premier-league", nombre: "Premier League", corto: "Premier", nivel: 1, pais: "Inglaterra", carpeta: "public/data/wys-ligas/premier-league" },
  { slug: "serie-a", nombre: "Serie A", corto: "Serie A", nivel: 1, pais: "Italia", carpeta: "public/data/wys-ligas/serie-a" },
  { slug: "bundesliga", nombre: "Bundesliga", corto: "Bundesliga", nivel: 1, pais: "Alemania", carpeta: "public/data/wys-ligas/bundesliga" },
  { slug: "ligue-1", nombre: "Ligue 1", corto: "Ligue 1", nivel: 1, pais: "Francia", carpeta: "public/data/wys-ligas/ligue-1" },
  { slug: "segunda", nombre: "Segunda División", corto: "Segunda", nivel: 2, pais: "España", carpeta: "public/data/wys-ligas/segunda" },
  { slug: "primera-rfef-g1", nombre: "Primera RFEF · Grupo 1", corto: "1.ª RFEF G1", nivel: 3, pais: "España", carpeta: "public/data/wys-ligas/primera-rfef-g1" },
  { slug: "primera-rfef-g2", nombre: "Primera RFEF · Grupo 2", corto: "1.ª RFEF G2", nivel: 3, pais: "España", carpeta: "public/data/wys" },
] as const;

export const NUESTRA_LIGA = "primera-rfef-g2";

export const CASTILLA = "Real Madrid Castilla";

/* ------------------------------------------------------------------ */
/*  CUENTAS                                                            */
/* ------------------------------------------------------------------ */

export const indiceDe = (id: string) => METRICAS.findIndex((x) => x.id === id);

const finitos = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));

export const media = (xs: (number | null | undefined)[]) => {
  const v = finitos(xs);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export function desviacion(xs: (number | null | undefined)[]) {
  const v = finitos(xs);
  const mu = media(v);
  if (mu === null || v.length < 2) return null;
  return Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length - 1));
}

/** La media de la liga en una métrica (media de los equipos, cada uno pesa igual). */
export const mediaLiga = (liga: Liga, i: number) => media(liga.equipos.map((e) => e.v[i]));

/** La media de todas las ligas juntas (cada liga pesa igual). */
export const mediaGlobal = (ligas: Liga[], i: number) => media(ligas.map((l) => mediaLiga(l, i)));

/**
 * Qué puesto tendría un valor dentro de una liga (1 = el mejor según `mejor`;
 * si la métrica no tiene «mejor», 1 = el que más). Devuelve también de cuántos.
 */
export function puestoEn(liga: Liga, i: number, valor: number, mejor: Metrica["mejor"], excluir?: string) {
  const otros = finitos(liga.equipos.filter((e) => e.nombre !== excluir).map((e) => e.v[i]));
  const delante = otros.filter((x) => (mejor === "bajo" ? x < valor : x > valor)).length;
  return { puesto: delante + 1, de: otros.length + 1 };
}

export const formatea = (x: number | null | undefined, dec: number, unidad?: string) =>
  typeof x === "number" && Number.isFinite(x)
    ? `${x.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec })}${unidad === "%" ? " %" : unidad ? ` ${unidad}` : ""}`
    : "—";

export type EquipoEn = { equipo: EquipoLiga; liga: Liga };

export const todosLosEquipos = (ligas: Liga[]): EquipoEn[] => ligas.flatMap((liga) => liga.equipos.map((equipo) => ({ equipo, liga })));

export const buscaEquipo = (ligas: Liga[], liga: string, nombre: string) => {
  const l = ligas.find((x) => x.slug === liga);
  const e = l?.equipos.find((x) => x.nombre === nombre);
  return l && e ? { liga: l, equipo: e } : null;
};

/**
 * Los equipos de las otras ligas que juegan más parecido: z-score de cada
 * métrica de estilo sobre TODOS los equipos de todas las ligas y distancia
 * euclídea media (más estable que el coseno con pocas métricas). Parecido en
 * % = 100 · e^(−d/2), para que se lea sin saber qué es una distancia.
 */
export function parecidos(ligas: Liga[], liga: string, nombre: string, cuantos = 10) {
  const yo = buscaEquipo(ligas, liga, nombre);
  if (!yo) return [];

  const idx = METRICAS_ESTILO.map(indiceDe).filter((i) => i >= 0);
  const todos = todosLosEquipos(ligas);
  const escala = idx.map((i) => {
    const xs = todos.map((t) => t.equipo.v[i]);
    return { mu: media(xs) ?? 0, sd: desviacion(xs) || 1 };
  });

  const z = (e: EquipoLiga) => idx.map((i, k) => (typeof e.v[i] === "number" ? ((e.v[i] as number) - escala[k].mu) / escala[k].sd : null));
  const mio = z(yo.equipo);

  return todos
    .filter((t) => !(t.liga.slug === liga && t.equipo.nombre === nombre))
    .map((t) => {
      const suyo = z(t.equipo);
      const pares = mio.map((a, k) => [a, suyo[k]] as const).filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null);
      if (pares.length < idx.length * 0.6) return null;
      const d = Math.sqrt(pares.reduce((s, [a, b]) => s + (a - b) ** 2, 0) / pares.length);
      /* Lo más parecido y lo más distinto, para explicar el porqué. */
      const dif = idx
        .map((i, k) => ({ id: METRICAS[i].id, d: mio[k] !== null && suyo[k] !== null ? Math.abs((mio[k] as number) - (suyo[k] as number)) : Infinity }))
        .filter((x) => Number.isFinite(x.d))
        .sort((a, b) => a.d - b.d);
      return { ...t, parecido: Math.round(100 * Math.exp(-d / 2)), igual: dif.slice(0, 3).map((x) => x.id), distinto: dif.slice(-2).reverse().map((x) => x.id) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.parecido - a.parecido)
    .slice(0, cuantos);
}

/**
 * Para la tabla de perfiles: dónde cae la media de cada liga entre la más
 * baja y la más alta de las ligas (0..1), para pintar la celda.
 */
export function posicionEntreLigas(ligas: Liga[], i: number) {
  const medias = ligas.map((l) => mediaLiga(l, i));
  const v = finitos(medias);
  const min = Math.min(...v);
  const max = Math.max(...v);
  return medias.map((x) => (x === null || !Number.isFinite(x) || max === min ? null : (x - min) / (max - min)));
}

/* ------------------------------------------------------------------ */
/*  EL CASTILLA EN TODAS PARTES (23/11/2026)                           */
/* ------------------------------------------------------------------ */
/*
| Petición del analista tras ver la primera versión: «visualizaciones y
| comparaciones muy muy pobres y el Castilla debe estar en todos los sitios».
| De aquí salen el percentil del Castilla en cada liga, cuánto encaja su estilo
| con cada una, el mapa de estilos (dos ejes o componentes principales) y la
| huella de estilo de dos equipos lado a lado.
*/

/**
 * Percentil orientado de un valor dentro de una liga: a qué parte de sus
 * equipos supera (empates a medias). Con `mejor` nulo, a cuántos tiene por
 * debajo en cifra («más que el 70 %»). `excluir` quita a ese equipo de la liga.
 */
export function percentilEn(liga: Liga, i: number, valor: number, mejor: Metrica["mejor"], excluir?: string) {
  const otros = finitos(liga.equipos.filter((e) => e.nombre !== excluir).map((e) => e.v[i]));
  if (!otros.length) return null;
  const supera = otros.filter((x) => (mejor === "bajo" ? x > valor : x < valor)).length;
  const iguales = otros.filter((x) => x === valor).length;
  return Math.round((100 * (supera + iguales / 2)) / otros.length);
}

/** Cuantil q (0..1) con interpolación lineal. */
export function cuantil(xs: (number | null | undefined)[], q: number) {
  const v = finitos(xs).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const base = Math.floor(pos);
  return v[base] + (v[Math.min(base + 1, v.length - 1)] - v[base]) * (pos - base);
}

export type EscalaEstilo = { idx: number[]; mu: number[]; sd: number[] };

/** Media y desviación de cada métrica de estilo sobre TODOS los equipos de todas las ligas. */
export function escalaEstilo(ligas: Liga[], ids: readonly string[] = METRICAS_ESTILO): EscalaEstilo {
  const idx = ids.map(indiceDe).filter((i) => i >= 0);
  const todos = todosLosEquipos(ligas);
  const mu: number[] = [];
  const sd: number[] = [];
  for (const i of idx) {
    const xs = todos.map((t) => t.equipo.v[i]);
    mu.push(media(xs) ?? 0);
    sd.push(desviacion(xs) || 1);
  }
  return { idx, mu, sd };
}

/** Un equipo (o una media) en desviaciones respecto a todos. */
export const vectorZ = (v: (number | null)[], e: EscalaEstilo) =>
  e.idx.map((i, k) => (typeof v[i] === "number" && Number.isFinite(v[i]) ? ((v[i] as number) - e.mu[k]) / e.sd[k] : null));

/** Parecido 0..100 entre dos vectores z (el mismo de `parecidos`). */
export function parecidoZ(a: (number | null)[], b: (number | null)[]) {
  const pares = a.map((x, k) => [x, b[k]] as const).filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null);
  if (pares.length < a.length * 0.6 || !pares.length) return null;
  const d = Math.sqrt(pares.reduce((s, [x, y]) => s + (x - y) ** 2, 0) / pares.length);
  return Math.round(100 * Math.exp(-d / 2));
}

/** El «equipo medio» de una liga (sin `excluir`), métrica a métrica. */
export const equipoMedio = (liga: Liga, excluir?: string): (number | null)[] =>
  METRICAS.map((_, i) => media(liga.equipos.filter((e) => e.nombre !== excluir).map((e) => e.v[i])));

/**
 * Cuánto se parece el estilo de un equipo al del equipo medio de cada liga, de
 * más a menos, con el equipo de esa liga que más se le parece.
 */
export function encajeEnLigas(ligas: Liga[], liga: string, nombre: string) {
  const yo = buscaEquipo(ligas, liga, nombre);
  if (!yo) return [];
  const escala = escalaEstilo(ligas);
  const mio = vectorZ(yo.equipo.v, escala);
  return ligas
    .map((l) => {
      const excluir = l.slug === liga ? nombre : undefined;
      const parecido = parecidoZ(mio, vectorZ(equipoMedio(l, excluir), escala));
      let gemelo: { nombre: string; parecido: number } | null = null;
      for (const e of l.equipos) {
        if (e.nombre === excluir) continue;
        const p = parecidoZ(mio, vectorZ(e.v, escala));
        if (p !== null && (!gemelo || p > gemelo.parecido)) gemelo = { nombre: e.nombre, parecido: p };
      }
      return { liga: l, parecido, gemelo };
    })
    .filter((x): x is typeof x & { parecido: number } => x.parecido !== null)
    .sort((a, b) => b.parecido - a.parecido);
}

/**
 * El mapa de estilos: los dos componentes principales de las métricas de
 * estilo (z sobre todos los equipos; un hueco cuenta como la media). Cada eje
 * se explica por las métricas que más pesan en él, y se orienta para que la
 * posesión vaya hacia la derecha y la presión (PPDA bajo) hacia arriba.
 */
export function mapaDeEstilos(ligas: Liga[]) {
  const escala = escalaEstilo(ligas);
  const todos = todosLosEquipos(ligas);
  const Z = todos.map((t) => vectorZ(t.equipo.v, escala).map((x) => x ?? 0));
  const p = escala.idx.length;
  const n = Z.length;
  if (n < 3 || !p) return null;

  const C = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => Z.reduce((s, fila) => s + fila[a] * fila[b], 0) / (n - 1)));
  const traza = C.reduce((s, fila, k) => s + fila[k], 0) || 1;

  const propio = (M: number[][]) => {
    let v: number[] = Array.from({ length: p }, (_, k) => 1 / Math.sqrt(p) + k * 1e-3);
    let lambda = 0;
    for (let it = 0; it < 300; it++) {
      const w = M.map((fila) => fila.reduce((s, x, k) => s + x * v[k], 0));
      const norma = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1;
      lambda = norma;
      v = w.map((x) => x / norma);
    }
    return { v, lambda };
  };

  const e1 = propio(C);
  const C2 = C.map((fila, a) => fila.map((x, b) => x - e1.lambda * e1.v[a] * e1.v[b]));
  const e2 = propio(C2);

  const orienta = (v: number[], id: string, signo: 1 | -1) => {
    const k = escala.idx.indexOf(indiceDe(id));
    return k >= 0 && v[k] * signo < 0 ? v.map((x) => -x) : v;
  };
  const v1 = orienta(e1.v, "posesion", 1);
  const v2 = orienta(e2.v, "ppda", -1);

  const explica = (v: number[]) =>
    escala.idx
      .map((i, k) => ({ id: METRICAS[i].id, peso: v[k] }))
      .sort((a, b) => Math.abs(b.peso) - Math.abs(a.peso))
      .slice(0, 4);

  const puntos = todos.map((t, r) => ({
    ...t,
    x: Z[r].reduce((s, z, k) => s + z * v1[k], 0),
    y: Z[r].reduce((s, z, k) => s + z * v2[k], 0),
  }));

  return {
    puntos,
    ejeX: { explica: explica(v1), varianza: e1.lambda / traza },
    ejeY: { explica: explica(v2), varianza: e2.lambda / traza },
  };
}
