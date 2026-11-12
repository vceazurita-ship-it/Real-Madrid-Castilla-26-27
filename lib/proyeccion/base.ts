/**
 * PROYECCIÓN DE LA JORNADA · EL MOTOR COMÚN (12/11/2026).
 *
 * Lo comparten la proyección del balón parado (`abp.ts`) y la del juego
 * (`juego.ts`). Funciones puras: ni fetch ni estado, para probarlas en Node.
 *
 * **La materia prima** es una tabla de equipo × partido (`FilaPartido`): cada
 * partido de la liga deja DOS filas, una por equipo, con sus cifras propias.
 * Lo que un equipo CONCEDE en un partido es lo que hace el otro en esa misma
 * jornada (la otra fila).
 *
 * **El modelo** es el de «fuerza de ataque × debilidad de la defensa ÷ media»
 * (el de Dixon y Coles para los goles, aquí para cualquier recuento):
 *
 *     λ = A · D / L · H
 *
 * - A: lo que hace el que ataca por partido (ponderado hacia sus últimos
 *   partidos y encogido hacia la media de la liga cuando la muestra es corta).
 * - D: lo que concede el que defiende por partido, igual de ponderado.
 * - L: la media de la liga por equipo y partido.
 * - H: el campo (lo que hace el local, o el visitante, frente a la media).
 *
 * Para las cuotas (la posesión, que suma 1 entre los dos) lo mismo en
 * logaritmo de la razón de probabilidades: logit p = logit A + logit D − logit L.
 *
 * **El intervalo** (80 %) suma dos dudas: la del propio partido (la varianza de
 * un equipo de un partido a otro, medida en la liga y proporcional a la media)
 * y la de las tasas (con pocos partidos A y D se conocen peor).
 */

export type FilaPartido = {
  partido: string;
  /** «2026-11-08». */
  fecha: string;
  equipo: string;
  /** true en casa, false fuera, null si no se sabe. */
  local: boolean | null;
  v: Record<string, number | null>;
};

export type Tabla = {
  filas: FilaPartido[];
  /** La otra fila de cada partido: lo que el equipo concede. */
  contra: Map<FilaPartido, FilaPartido>;
};

export function tablaDe(filas: FilaPartido[]): Tabla {
  const porPartido = new Map<string, FilaPartido[]>();
  for (const f of filas) porPartido.set(f.partido, [...(porPartido.get(f.partido) ?? []), f]);
  const contra = new Map<FilaPartido, FilaPartido>();
  for (const dos of porPartido.values()) {
    if (dos.length !== 2) continue;
    contra.set(dos[0], dos[1]);
    contra.set(dos[1], dos[0]);
  }
  return { filas: [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.partido.localeCompare(b.partido)), contra };
}

/** Las filas anteriores a una fecha (para proyectar un partido ya jugado sin mirarlo). */
export function antesDe(t: Tabla, hasta: string | null): Tabla {
  if (!hasta) return t;
  return tablaDe(t.filas.filter((f) => f.fecha < hasta.slice(0, 10)));
}

export type Lado = "propio" | "concede";

/** Los valores de un equipo en orden de fecha: lo suyo o lo que concede. */
export function serie(t: Tabla, equipo: string, metrica: string, lado: Lado): number[] {
  const out: number[] = [];
  for (const f of t.filas) {
    if (f.equipo !== equipo) continue;
    const fila = lado === "propio" ? f : t.contra.get(f);
    const v = fila?.v[metrica];
    if (v != null && Number.isFinite(v)) out.push(v);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  RESUMEN DE UNA SERIE: TEMPORADA, ÚLTIMOS 5 Y TENDENCIA             */
/* ------------------------------------------------------------------ */

export const ULTIMOS = 5;
/**
 * Semivida de la ponderación: el partido de hace 8 jornadas pesa la mitad que
 * el último. Medido en el grupo (partidos del 25/09 al 08/11 proyectados con lo
 * de antes): con 8 el error es algo menor que con 4 y casi igual que sin
 * ponderar, y la tendencia sigue contando.
 */
export const SEMIVIDA = 8;

export type Resumen = {
  n: number;
  temporada: number | null;
  ultimos: number | null;
  /** Los partidos de antes de los últimos cinco. */
  previos: number | null;
  /** Media con pesos que caen a la mitad cada `SEMIVIDA` partidos. */
  ponderada: number | null;
  /** Total de la serie (para saber cuántas acciones hay detrás). */
  total: number;
  cambio: "sube" | "baja" | null;
};

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function resume(xs: number[], semivida: number = SEMIVIDA): Resumen {
  const n = xs.length;
  const temporada = media(xs);
  const ult = xs.slice(-ULTIMOS);
  const prev = xs.slice(0, Math.max(0, n - ULTIMOS));
  let sw = 0;
  let s = 0;
  xs.forEach((x, i) => {
    const w = Math.pow(0.5, (n - 1 - i) / semivida);
    sw += w;
    s += w * x;
  });
  const ultimos = media(ult);
  const previos = media(prev);
  let cambio: Resumen["cambio"] = null;
  if (n >= 8 && ultimos != null && previos != null && temporada != null && temporada > 0) {
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - temporada) ** 2, 0) / (n - 1));
    const umbral = Math.max(0.15 * temporada, sd / Math.sqrt(ULTIMOS));
    if (ultimos - previos > umbral) cambio = "sube";
    else if (previos - ultimos > umbral) cambio = "baja";
  }
  return { n, temporada, ultimos, previos, ponderada: n ? s / sw : null, total: xs.reduce((a, x) => a + x, 0), cambio };
}

/* ------------------------------------------------------------------ */
/*  LA LIGA                                                            */
/* ------------------------------------------------------------------ */

export type Liga = {
  /** Media por equipo y partido. */
  media: number;
  local: number | null;
  visitante: number | null;
  /** Varianza de un partido a otro dentro de un mismo equipo ÷ media. */
  dispersion: number;
  /** Medias por equipo (para percentiles y puestos). */
  porEquipo: Map<string, { propio: number; concede: number | null; n: number }>;
  partidos: number;
  /** Partidos de la media que se suman a lo propio y a lo concedido (ver `fiabilidad`). */
  kPropio: number;
  kConcede: number;
};

export function liga(t: Tabla, metrica: string): Liga | null {
  const xs: number[] = [];
  const loc: number[] = [];
  const vis: number[] = [];
  const porEquipo = new Map<string, number[]>();
  const concede = new Map<string, number[]>();
  for (const f of t.filas) {
    const v = f.v[metrica];
    if (v == null || !Number.isFinite(v)) continue;
    xs.push(v);
    if (f.local === true) loc.push(v);
    if (f.local === false) vis.push(v);
    porEquipo.set(f.equipo, [...(porEquipo.get(f.equipo) ?? []), v]);
    const otro = t.contra.get(f);
    if (otro) concede.set(otro.equipo, [...(concede.get(otro.equipo) ?? []), v]);
  }
  const m = media(xs);
  if (m == null || m <= 0) return null;
  /* La varianza dentro de cada equipo (sin la diferencia entre equipos). */
  let ss = 0;
  let gl = 0;
  for (const vs of porEquipo.values()) {
    if (vs.length < 2) continue;
    const mu = media(vs) as number;
    ss += vs.reduce((a, x) => a + (x - mu) ** 2, 0);
    gl += vs.length - 1;
  }
  const varDentro = gl ? ss / gl : m;
  const salida = new Map<string, { propio: number; concede: number | null; n: number }>();
  for (const [e, vs] of porEquipo) salida.set(e, { propio: media(vs) as number, concede: media(concede.get(e) ?? []), n: vs.length });
  /* El campo sólo si hay muestra en los dos lados. */
  const ml = loc.length >= 20 ? media(loc) : null;
  const mv = vis.length >= 20 ? media(vis) : null;
  return {
    media: m,
    local: ml,
    visitante: mv,
    dispersion: varDentro / m,
    porEquipo: salida,
    partidos: xs.length / 2,
    kPropio: fiabilidad([...porEquipo.values()]),
    kConcede: fiabilidad([...concede.values()]),
  };
}

/** Tope del encogimiento: como mucho, 40 partidos de la media. */
export const K_MAX = 40;

/**
 * Cuántos partidos de la media hay que sumar a un equipo (Bayes empírico):
 * k = varianza de un partido a otro ÷ varianza real entre equipos. Si los
 * equipos apenas se distinguen en algo (los córners de un partido son casi
 * azar), k es grande y la proyección se queda cerca de la media; si se
 * distinguen mucho (la posesión, los remates), k es pequeño y manda el equipo.
 */
export function fiabilidad(grupos: number[][]): number {
  const con = grupos.filter((g) => g.length >= 2);
  if (con.length < 4) return K_PARTIDOS;
  let ss = 0;
  let gl = 0;
  const medias: number[] = [];
  let nTotal = 0;
  for (const g of con) {
    const mu = media(g) as number;
    medias.push(mu);
    ss += g.reduce((a, x) => a + (x - mu) ** 2, 0);
    gl += g.length - 1;
    nTotal += g.length;
  }
  const dentro = ss / gl;
  const mm = media(medias) as number;
  const entre = medias.reduce((a, x) => a + (x - mm) ** 2, 0) / (medias.length - 1);
  const nMedio = nTotal / con.length;
  const real = entre - dentro / nMedio;
  if (!(real > 0)) return K_MAX;
  return Math.min(K_MAX, Math.max(1, dentro / real));
}

/** Encoge hacia `previo` como si `previo` valiera `k` partidos más. */
export const encoge = (valor: number | null, n: number, previo: number, k: number): number =>
  valor == null || !Number.isFinite(valor) ? previo : (valor * n + previo * k) / (n + k);

/** Puesto (1 = el que más) y percentil de un equipo en la liga, en lo propio o lo que concede. */
export function puestoEn(l: Liga, equipo: string, lado: Lado): { puesto: number; de: number; percentil: number } | null {
  const vals = [...l.porEquipo.entries()]
    .map(([e, x]) => ({ e, v: lado === "propio" ? x.propio : x.concede }))
    .filter((x): x is { e: string; v: number } => x.v != null && Number.isFinite(x.v));
  const yo = vals.find((x) => x.e === equipo);
  if (!yo) return null;
  const mas = vals.filter((x) => x.v > yo.v).length;
  const menos = vals.filter((x) => x.v < yo.v).length;
  const iguales = vals.length - mas - menos;
  return { puesto: mas + 1, de: vals.length, percentil: Math.round(((menos + iguales / 2) / vals.length) * 100) };
}

/* ------------------------------------------------------------------ */
/*  LA PROYECCIÓN                                                      */
/* ------------------------------------------------------------------ */

/** z de un intervalo central del 80 %. */
export const Z80 = 1.2816;
/** Cuántos partidos de la media de la liga se suman a cada equipo para encoger. */
export const K_PARTIDOS = 3;

export type Proyeccion = {
  metrica: string;
  valor: number;
  bajo: number;
  alto: number;
  liga: number;
  /** La media de la liga para quien juega en ese campo (local o visitante). */
  ligaCampo: number;
  /** Lo que hace el que ataca. */
  ataque: Resumen;
  /** Lo que concede el que defiende. */
  defensa: Resumen;
  /** Tasas ya ponderadas y encogidas. */
  A: number;
  D: number;
  H: number;
  /** El valor sin el tipo de partido (sólo si se mezcló). */
  multiplicativo?: number;
};

export type OpcionesProyeccion = {
  ataca: string;
  defiende: string;
  /** El que ataca, ¿en casa? */
  local: boolean | null;
  metrica: string;
  escala?: "conteo" | "cuota";
  /** Partidos de la media que se suman (por defecto, los de `fiabilidad`). */
  k?: number;
  semivida?: number;
};

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoide = (x: number) => 1 / (1 + Math.exp(-x));
const acota = (p: number) => Math.min(0.97, Math.max(0.03, p));

export function proyecta(t: Tabla, o: OpcionesProyeccion): Proyeccion | null {
  const L = liga(t, o.metrica);
  if (!L) return null;
  const kA = o.k ?? L.kPropio;
  const kD = o.k ?? L.kConcede;
  const ataque = resume(serie(t, o.ataca, o.metrica, "propio"), o.semivida);
  const defensa = resume(serie(t, o.defiende, o.metrica, "concede"), o.semivida);
  const A = encoge(ataque.ponderada, ataque.n, L.media, kA);
  const D = encoge(defensa.ponderada, defensa.n, L.media, kD);
  const campo = o.local === true ? L.local : o.local === false ? L.visitante : null;
  const ligaCampo = campo ?? L.media;

  if (o.escala === "cuota") {
    const x = logit(acota(A)) + logit(acota(D)) - logit(acota(L.media)) + (campo != null ? logit(acota(campo)) - logit(acota(L.media)) : 0);
    const p = sigmoide(x);
    const sdPartido = Math.sqrt(L.dispersion * L.media);
    /* La duda de las tasas, en la escala de la cuota. */
    const sdTasas = Math.sqrt((sdPartido ** 2) / Math.max(1, ataque.n + kA) + (sdPartido ** 2) / Math.max(1, defensa.n + kD));
    const sd = Math.sqrt(sdPartido ** 2 + sdTasas ** 2);
    return {
      metrica: o.metrica,
      valor: p,
      bajo: Math.max(0, p - Z80 * sd),
      alto: Math.min(1, p + Z80 * sd),
      liga: L.media,
      ligaCampo,
      ataque,
      defensa,
      A,
      D,
      H: campo != null ? campo / L.media : 1,
    };
  }

  const H = campo != null ? campo / L.media : 1;
  const lam = (A * D) / L.media * H;
  const phi = Math.max(L.dispersion, 1e-6);
  /* var(media de n partidos) = φ·tasa/n → var relativa = φ/(n·tasa). */
  const relA = phi / (Math.max(1, ataque.n + kA) * Math.max(A, 1e-6));
  const relD = phi / (Math.max(1, defensa.n + kD) * Math.max(D, 1e-6));
  const sd = Math.sqrt(phi * lam + lam * lam * (relA + relD));
  return {
    metrica: o.metrica,
    valor: lam,
    bajo: Math.max(0, lam - Z80 * sd),
    alto: lam + Z80 * sd,
    liga: L.media,
    ligaCampo,
    ataque,
    defensa,
    A,
    D,
    H,
  };
}

/* ------------------------------------------------------------------ */
/*  EL TIPO DE PARTIDO: UNA RECTA EN LA LIGA                           */
/* ------------------------------------------------------------------ */

export type Recta = { a: number; b: number; r2: number; n: number };

/** Mínimos cuadrados de y sobre x en todas las filas de la liga. */
export function recta(t: Tabla, y: string, x: string): Recta | null {
  const ps: [number, number][] = [];
  for (const f of t.filas) {
    const vx = f.v[x];
    const vy = f.v[y];
    if (vx == null || vy == null || !Number.isFinite(vx) || !Number.isFinite(vy)) continue;
    ps.push([vx, vy]);
  }
  if (ps.length < 30) return null;
  const mx = ps.reduce((s, p) => s + p[0], 0) / ps.length;
  const my = ps.reduce((s, p) => s + p[1], 0) / ps.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [vx, vy] of ps) {
    sxy += (vx - mx) * (vy - my);
    sxx += (vx - mx) ** 2;
    syy += (vy - my) ** 2;
  }
  if (sxx <= 0 || syy <= 0) return null;
  const b = sxy / sxx;
  return { a: my - b * mx, b, r2: (sxy * sxy) / (sxx * syy), n: ps.length };
}

/** Peso máximo del tipo de partido frente al cruce de tasas. */
export const PESO_TIPO_MAX = 0.3;

/**
 * Mezcla la proyección con lo que da la recta del tipo de partido (p. ej.
 * córners según la posesión esperada). El peso es el r² de la recta, con
 * tope: si la posesión apenas explica nada, apenas cuenta.
 */
export function conTipoDePartido(p: Proyeccion, r: Recta | null, x: number | null): Proyeccion {
  if (!r || x == null) return p;
  const w = Math.min(PESO_TIPO_MAX, r.r2);
  if (w <= 0.005) return p;
  const porTipo = Math.max(0, r.a + r.b * x);
  const valor = (1 - w) * p.valor + w * porTipo;
  const f = p.valor > 0 ? valor / p.valor : 1;
  return { ...p, multiplicativo: p.valor, valor, bajo: p.bajo * f, alto: p.alto * f };
}

/* ------------------------------------------------------------------ */
/*  TEXTO                                                              */
/* ------------------------------------------------------------------ */

/** «4,9». */
export const coma = (v: number | null | undefined, d = 1): string =>
  v == null || !Number.isFinite(v) ? "" : v.toFixed(d).replace(".", ",").replace(/^-0(,0+)?$/, "0$1");

/** «58 %». */
export const pct = (v: number | null | undefined, d = 0): string => (v == null || !Number.isFinite(v) ? "" : `${coma(v * 100, d)} %`);

/** «entre 3 y 7» con enteros si es un recuento; con decimales si es otra cosa. */
export function rango(p: Pick<Proyeccion, "bajo" | "alto">, d = 0): string {
  if (d === 0) {
    const b = Math.max(0, Math.floor(p.bajo + 0.5));
    const a = Math.max(b, Math.round(p.alto));
    return b === a ? `${b}` : `${b}-${a}`;
  }
  return `${coma(p.bajo, d)}-${coma(p.alto, d)}`;
}

/** «+12 %» frente a la media. */
export function frenteA(valor: number, referencia: number): string {
  if (!referencia) return "";
  const d = valor / referencia - 1;
  if (Math.abs(d) < 0.03) return "en la media";
  return `${d > 0 ? "+" : "−"}${Math.round(Math.abs(d) * 100)} % que la media`;
}
