/**
 * EL DIRECTO CONTRA EL PLAN DE PARTIDO (12/11/2026).
 *
 * Petición del analista: durante el partido no hay tiempo de leer. Si juega el
 * Castilla, se cruzan las cifras de Opta en directo con el plan de partido de
 * la jornada (la fila de RIVALES que edita /match-preparation) y salen
 * tarjetas de una cifra: CERTEZA (el plan se está cumpliendo), ALERTA (no se
 * está cumpliendo) o EN DUDA (cerca del listón o aún es pronto).
 *
 * Cómo se juzga cada objetivo:
 *   - el plan se lee por temas (posesión, presión, transición defensiva,
 *     defensa del área, ABP, finalización, progresión, juego directo, uso de
 *     la falta); cada tema que el plan nombra pone uno o dos objetivos;
 *   - el listón es la MEDIA DE ESTA TEMPORADA del equipo en Opta
 *     (`opta:partidos`): lo nuestro contra lo nuestro y lo suyo contra lo
 *     suyo. Si no hay media, un listón de oficio (52 % de posesión, 50 % de
 *     aéreos, PPDA 11);
 *   - las cifras que se acumulan (remates, toques en el área, córners…) se
 *     comparan con la media llevada al minuto (media × minuto / 90); los
 *     porcentajes y cocientes (posesión, PPDA, % de pase, % de aéreos), tal
 *     cual;
 *   - antes del minuto 10 todo es «pronto»: sin muestra no hay certeza.
 *
 * Sin plan (otro partido, o el plan vacío) salen los objetivos generales del
 * Castilla, o los de los dos equipos contra su media si no jugamos.
 *
 * Además, el «momento»: con los tramos de 5 minutos de Opta (si los da en
 * directo) se mira quién manda en los últimos 15 minutos.
 *
 * Todo es puro: entra lo que ya hay en Supabase y en la hoja, sale el veredicto.
 */

export type Valores = Record<string, unknown>;

export type Estado = "certeza" | "alerta" | "duda" | "pronto";

export type Juicio = {
  id: string;
  /** Tres o cuatro palabras, en mayúsculas en la tarjeta. */
  titulo: string;
  /** El trozo del plan que lo pide (corto), o «objetivo general». */
  plan: string;
  estado: Estado;
  /** La cifra grande. */
  valor: string;
  /** «media 54 %», «a estas alturas suelen ser 6». */
  liston: string;
  /** Una frase de cinco a ocho palabras. */
  frase: string;
  /** Más arriba, más importante (se ordena alertas primero y luego por peso). */
  peso: number;
};

export type Tramo = { parte: number; tramo: number; nos: Valores; ellos: Valores };

export type Momento = {
  /** Tramos de 5' en orden, con la balanza (positivo = nosotros). */
  barras: { etiqueta: string; balanza: number }[];
  /** Últimos 15': quién manda y por qué. */
  ultimos: { manda: "nos" | "ellos" | "igual"; frase: string } | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
};

/* Media por partido de una métrica para un equipo (filas de `opta:partidos`). */
export function mediasDe(filas: Valores[], teamId: string): Record<string, number> {
  const suyas = filas.filter((f) => f.teamId === teamId);
  const medias: Record<string, number> = {};
  if (!suyas.length) return medias;
  for (const k of Object.keys(suyas[0])) {
    const xs = suyas.map((f) => num(f[k])).filter((x): x is number => x != null);
    if (xs.length >= Math.max(2, suyas.length / 2)) medias[k] = xs.reduce((s, x) => s + x, 0) / xs.length;
  }
  return medias;
}

/* ------------------------------------------------------------------ */
/*  LAS REGLAS                                                         */
/* ------------------------------------------------------------------ */

type Regla = {
  id: string;
  titulo: string;
  /** Qué del plan la enciende. Sin `re`, es general (va siempre). */
  re?: RegExp;
  /** Dónde se busca: en lo nuestro (claves, ataque, defensa, ABP) o en lo que se dice del rival. */
  donde?: "nuestro" | "rival";
  metrica: string;
  quien: "nos" | "ellos";
  /** Más es bueno para nosotros. */
  mas: boolean;
  /** Porcentaje o cociente: no se lleva al minuto. */
  tasa?: boolean;
  /** Listón cuando no hay media. */
  oficio?: number;
  /** Margen (en proporción del listón) dentro del cual es «en duda». */
  margen?: number;
  unidad?: string;
  bien: string;
  mal: string;
  peso: number;
};

const REGLAS: Regla[] = [
  { id: "posesion", titulo: "Dominio con balón", re: /posesi[oó]n|control del partido|dominio/i, metrica: "Poss%", quien: "nos", mas: true, tasa: true, oficio: 52, margen: 0.04, unidad: "%", bien: "El balón es nuestro, como pide el plan", mal: "No estamos teniendo el balón", peso: 9 },
  { id: "presion", titulo: "Agresividad sin balón", re: /agresiv|presi[oó]n|apret|saltos|campo contrario/i, metrica: "PPDA", quien: "nos", mas: false, tasa: true, oficio: 11, margen: 0.12, bien: "Presionamos como siempre o más", mal: "Les dejamos dar demasiados pases", peso: 8 },
  { id: "robo-alto", titulo: "Robos arriba", re: /agresiv|presi[oó]n|apret|campo contrario|reinicio/i, metrica: "PosWonA3rd", quien: "nos", mas: true, oficio: 4, margen: 0.2, bien: "Recuperamos en su campo", mal: "Casi no robamos arriba", peso: 6 },
  { id: "falta", titulo: "Falta táctica", re: /uso de la falta|interrumpir/i, metrica: "FoulCom", quien: "nos", mas: true, oficio: 12, margen: 0.2, bien: "Cortamos con falta, lo pedido", mal: "No estamos cortando con falta", peso: 3 },
  { id: "transicion", titulo: "Transición defensiva", re: /transici[oó]n def|transitar|contragolpe|transici[oó]n ofensiva/i, metrica: "PossLost", quien: "nos", mas: false, oficio: 110, margen: 0.1, bien: "Perdemos poco el balón", mal: "Perdemos demasiados balones", peso: 7 },
  { id: "xg-contra", titulo: "Peligro que nos crean", metrica: "ExpG", quien: "ellos", mas: false, oficio: 1.1, margen: 0.2, bien: "Nos crean menos de lo que suelen", mal: "Nos están creando peligro", peso: 9 },
  { id: "area-contra", titulo: "Defensa del área", re: /defensa de [aá]rea|[aá]rea rival|segunda l[ií]nea|pisan [aá]rea/i, metrica: "TouchOpBox", quien: "ellos", mas: false, oficio: 18, margen: 0.15, bien: "Pisan poco nuestra área", mal: "Entran mucho en nuestra área", peso: 7 },
  { id: "abp-contra", titulo: "Córners en contra", re: /\babp\b|c[oó]rner|bal[oó]n parado/i, metrica: "Corners", quien: "ellos", mas: false, oficio: 5, margen: 0.2, bien: "Les damos pocos córners", mal: "Les estamos regalando córners", peso: 5 },
  { id: "abp-favor", titulo: "Córners a favor", re: /\babp\b|c[oó]rner|bal[oó]n parado/i, metrica: "Corners", quien: "nos", mas: true, oficio: 5, margen: 0.2, bien: "Sacamos córners para nuestro ABP", mal: "Apenas forzamos córners", peso: 4 },
  { id: "llegada", titulo: "Llegada al área", re: /ocupaci[oó]n de [aá]rea|finaliz|a llegar|[aá]rea/i, metrica: "TouchOpBox", quien: "nos", mas: true, oficio: 20, margen: 0.15, bien: "Llegamos al área como queremos", mal: "No pisamos su área", peso: 7 },
  { id: "progresion", titulo: "Precisión en su campo", re: /progresi|ventaja interior|v[ií]as|entre l[ií]neas/i, metrica: "Ps%InA3rd", quien: "nos", mas: true, tasa: true, oficio: 65, margen: 0.04, unidad: "%", bien: "Progresamos con pase limpio", mal: "Perdemos el pase en su campo", peso: 5 },
  { id: "directo", titulo: "Duelo aéreo", re: /directo|golpeo largo|juego largo|segunda jugada/i, metrica: "Aerial%", quien: "nos", mas: true, tasa: true, oficio: 50, margen: 0.06, unidad: "%", bien: "Ganamos el juego aéreo", mal: "Perdemos el balón largo", peso: 5 },
  { id: "pos-rival", titulo: "Su ataque posicional", re: /ataque posicional|juego propositivo/i, donde: "rival", metrica: "Pass%", quien: "ellos", mas: false, tasa: true, oficio: 78, margen: 0.03, unidad: "%", bien: "Les cuesta jugar con balón", mal: "Están jugando cómodos con balón", peso: 4 },
  /* Generales: van siempre. */
  { id: "xg-favor", titulo: "Ocasiones nuestras", metrica: "ExpG", quien: "nos", mas: true, oficio: 1.2, margen: 0.2, bien: "Generamos lo que solemos o más", mal: "Estamos generando poco", peso: 8 },
  { id: "remates", titulo: "Remates", metrica: "ShtIncBl", quien: "nos", mas: true, oficio: 12, margen: 0.2, bien: "Rematamos con frecuencia", mal: "Rematamos poco", peso: 4 },
];

const CAMPOS_NUESTROS = ["CLAVES_PARTIDO", "ATAQUE", "DEFENSA", "ABP_OF", "ABP_DEF"];
const CAMPOS_RIVAL = ["FORTALEZAS", "DEBILIDADES", "ESTRUCTURA_OF", "ESTRUCTURA_DEF"];

const lineas = (plan: Valores | null, campos: string[]) =>
  campos.flatMap((c) =>
    String(plan?.[c] ?? "")
      .split(/\n|\|/)
      .map((l) => l.replace(/^\s*(?:[-•]|\d+\.(?:\s*[AB]\.)?)\s*/, "").trim())
      .filter((l) => l.length > 3),
  );

const corta = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

const fmt = (v: number, unidad?: string) => {
  const d = Math.abs(v) < 10 && !Number.isInteger(v) ? 1 : 0;
  const t = v.toLocaleString("es-ES", { maximumFractionDigits: unidad === "%" ? 0 : Math.max(d, v < 3 ? 2 : 0) });
  return unidad === "%" ? `${t} %` : t;
};

/**
 * Los juicios del momento. `nos`/`ellos` = cifras en directo de cada equipo;
 * `mediaNos`/`mediaEllos` = sus medias por partido esta temporada.
 */
export function juzga(opciones: {
  plan: Valores | null;
  minuto: number | null;
  nos: Valores;
  ellos: Valores;
  mediaNos: Record<string, number>;
  mediaEllos: Record<string, number>;
}): Juicio[] {
  const { plan, nos, ellos, mediaNos, mediaEllos } = opciones;
  const minuto = Math.max(0, Math.min(opciones.minuto ?? 45, 95));
  const nuestras = lineas(plan, CAMPOS_NUESTROS);
  const suyas = lineas(plan, CAMPOS_RIVAL);
  const conPlan = nuestras.length + suyas.length > 0;
  const juicios: Juicio[] = [];
  const vistas = new Set<string>();

  for (const r of REGLAS) {
    let cita = "Objetivo general";
    if (r.re) {
      if (!conPlan) continue;
      const linea = (r.donde === "rival" ? suyas : nuestras).find((l) => r.re!.test(l));
      if (!linea) continue;
      cita = corta(linea);
    }
    const clave = `${r.quien}:${r.metrica}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);

    /* Opta da los porcentajes en tanto por uno (0,55): a la pantalla, ×100. */
    const aCien = (x: number | null | undefined) => (x != null && r.unidad === "%" && Math.abs(x) <= 1.5 ? x * 100 : x);
    const v = aCien(num((r.quien === "nos" ? nos : ellos)[r.metrica]));
    if (v == null) continue;
    const media = aCien((r.quien === "nos" ? mediaNos : mediaEllos)[r.metrica]) ?? undefined;
    const base = media ?? r.oficio ?? null;
    if (base == null) continue;
    const liston = r.tasa ? base : (base * Math.max(minuto, 1)) / 90;
    const margen = Math.max(r.tasa ? 0 : 0.6, Math.abs(liston) * (r.margen ?? 0.15));
    const dif = r.mas ? v - liston : liston - v;

    const estado: Estado = minuto < 10 ? "pronto" : dif >= margen ? "certeza" : dif <= -margen ? "alerta" : "duda";
    const quienListon = r.quien === "nos" ? "nuestra" : "su";
    const textoListon = r.tasa
      ? `${quienListon} media ${fmt(base, r.unidad)}`
      : `a estas alturas, ${quienListon} media ${fmt(liston, r.unidad)}`;

    juicios.push({
      id: `${r.id}`,
      titulo: r.titulo,
      plan: cita,
      estado,
      valor: fmt(v, r.unidad),
      liston: media == null ? `${textoListon} (de oficio)` : textoListon,
      frase: estado === "certeza" ? r.bien : estado === "alerta" ? r.mal : estado === "pronto" ? "Aún es pronto para juzgarlo" : "En el filo: hay que vigilarlo",
      peso: r.peso + (r.re ? 2 : 0),
    });
  }

  const orden: Record<Estado, number> = { alerta: 0, duda: 1, certeza: 2, pronto: 3 };
  return juicios.sort((a, b) => orden[a.estado] - orden[b.estado] || b.peso - a.peso);
}

/* ------------------------------------------------------------------ */
/*  EL MOMENTO                                                         */
/* ------------------------------------------------------------------ */

/* Una cifra de dominio por tramo: xG pesa mucho, el área y su campo algo. */
const empuje = (v: Valores) => (num(v.ExpG) ?? 0) * 10 + (num(v.TouchOpBox) ?? 0) * 0.8 + (num(v.TchsA3) ?? 0) * 0.15 + (num(v.PosWonA3rd) ?? 0) * 0.6;

export function momento(tramos: Tramo[]): Momento {
  const orden = [...tramos].sort((a, b) => a.parte - b.parte || a.tramo - b.tramo);
  const barras = orden.map((t) => ({
    etiqueta: `${t.tramo * 5}'`,
    balanza: Math.round((empuje(t.nos) - empuje(t.ellos)) * 10) / 10,
  }));
  const ult = orden.slice(-3);
  if (ult.length < 2) return { barras, ultimos: null };
  const nos = ult.reduce((s, t) => s + empuje(t.nos), 0);
  const ellos = ult.reduce((s, t) => s + empuje(t.ellos), 0);
  const xgNos = ult.reduce((s, t) => s + (num(t.nos.ExpG) ?? 0), 0);
  const xgEllos = ult.reduce((s, t) => s + (num(t.ellos.ExpG) ?? 0), 0);
  const roboEllos = ult.reduce((s, t) => s + (num(t.ellos.PosWonA3rd) ?? 0), 0);
  const dif = nos - ellos;
  const xg = (x: number) => x.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  if (Math.abs(dif) < 3) return { barras, ultimos: { manda: "igual", frase: `Últimos 15': partido igualado (xG ${xg(xgNos)} - ${xg(xgEllos)})` } };
  if (dif > 0) return { barras, ultimos: { manda: "nos", frase: `Últimos 15': mandamos nosotros (xG ${xg(xgNos)} - ${xg(xgEllos)})` } };
  return {
    barras,
    ultimos: {
      manda: "ellos",
      frase: `Últimos 15': aprietan ellos (xG ${xg(xgNos)} - ${xg(xgEllos)}${roboEllos >= 2 ? `, ${roboEllos} robos en nuestro campo` : ""})`,
    },
  };
}

/** Los tramos de `opta:directo:<partido>` (forma {cols, filas}) partidos por equipo. */
export function tramosDe(tabla: { cols?: string[]; filas?: unknown[][] } | null | undefined, teamNos: string): Tramo[] {
  if (!tabla?.cols || !tabla.filas) return [];
  const filas = tabla.filas.map((f) => Object.fromEntries(tabla.cols!.map((c, i) => [c, f[i]])) as Valores);
  const porTramo = new Map<string, Tramo>();
  for (const f of filas) {
    const parte = num(f.parte) ?? 1;
    const tramo = num(f.tramo) ?? 0;
    if (parte < 1 || parte > 2) continue;
    const k = `${parte}-${tramo}`;
    const t = porTramo.get(k) ?? { parte, tramo, nos: {}, ellos: {} };
    if (f.teamId === teamNos) t.nos = f;
    else t.ellos = f;
    porTramo.set(k, t);
  }
  return [...porTramo.values()];
}

/** Minuto aproximado desde los tramos (el último tramo con algo, por arriba). */
export function minutoDe(tramos: Tramo[]): number | null {
  if (!tramos.length) return null;
  const ult = [...tramos].sort((a, b) => a.parte - b.parte || a.tramo - b.tramo).at(-1)!;
  /* El reloj de Opta sigue en la segunda parte (45' = tramo 9). */
  return Math.min(ult.parte === 1 ? 47 : 95, (ult.tramo + 1) * 5);
}
