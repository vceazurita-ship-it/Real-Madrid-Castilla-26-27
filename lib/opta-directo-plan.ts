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

/* duda = en el filo (entre P25-P75 y P10-P90); habitual = dentro de P25-P75. */
export type Estado = "alerta" | "certeza" | "duda" | "habitual" | "pronto" | "sindato";

export type Juicio = {
  id: string;
  /** Tres o cuatro palabras, en mayúsculas en la tarjeta. */
  titulo: string;
  /** El trozo del plan que lo pide (corto), o «Objetivo general». */
  plan: string;
  estado: Estado;
  /** La cifra grande. */
  valor: string;
  /** El valor en número y su rango habitual a estas alturas (para la línea de rango). */
  cifra: number | null;
  rango: [number, number] | null;
  /** «habitual a estas alturas: 6-12 (nuestros 20 partidos)». */
  liston: string;
  /** Lo que pasa, en cinco a ocho palabras. */
  frase: string;
  /** Lo que se dice al banquillo (sólo en las alertas). */
  consigna?: string;
  /** Si el marcador cambia la lectura («Ganando: ceder balón es normal»). */
  nota?: string;
  peso: number;
};

export type Tramo = { parte: number; tramo: number; nos: Valores; ellos: Valores };

export type Momento = {
  /** Tramos de 5' en orden: xG y toques en el área de cada uno (positivo = nosotros). */
  barras: { etiqueta: string; balanza: number }[];
  /** Últimos 15': quién manda y por qué. */
  ultimos: { manda: "nos" | "ellos" | "igual"; frase: string } | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Lo habitual de un equipo en una métrica por partido: media y cuartiles. */
export type Banda = { media: number; p10: number; p25: number; p75: number; p90: number; n: number };

const cuantil = (orden: number[], q: number) => {
  const i = (orden.length - 1) * q;
  const a = Math.floor(i);
  return orden[a] + (orden[Math.min(a + 1, orden.length - 1)] - orden[a]) * (i - a);
};

/* Las métricas compuestas que no da Opta tal cual. */
const derivadas = (f: Valores): Valores => ({
  ...f,
  RobosMedio: (num(f.PosWonM3rd) ?? 0) + (num(f.PosWonA3rd) ?? 0),
});

/* Lo habitual por partido de cada métrica para un equipo (filas de `opta:partidos`). */
export function mediasDe(filas: Valores[], teamId: string): Record<string, Banda> {
  const suyas = filas.filter((f) => f.teamId === teamId).map(derivadas);
  const bandas: Record<string, Banda> = {};
  if (suyas.length < 3) return bandas;
  for (const k of Object.keys(suyas[0])) {
    const xs = suyas.map((f) => num(f[k])).filter((x): x is number => x != null);
    if (xs.length < 3) continue;
    const orden = [...xs].sort((a, b) => a - b);
    bandas[k] = { media: xs.reduce((s, x) => s + x, 0) / xs.length, p10: cuantil(orden, 0.1), p25: cuantil(orden, 0.25), p75: cuantil(orden, 0.75), p90: cuantil(orden, 0.9), n: xs.length };
  }
  return bandas;
}

/*
 * CURVA DE ACUMULACIÓN DE LA LIGA. Qué parte del total del partido va
 * acumulada al final de cada tramo de 5' (0-5', 5-10'… el último, 90'+).
 * Sale de `opta:momento` de Primera RFEF 26/27 (todos los partidos, 12/11/2026):
 * al descanso sólo va el 42-46 %, no la mitad; las recuperaciones y las
 * pérdidas, algo más pronto. Las cifras que no están aquí usan la de remates.
 */
const CURVAS: Record<string, number[]> = {
  ExpG: [0.035, 0.072, 0.115, 0.159, 0.202, 0.246, 0.286, 0.328, 0.376, 0.451, 0.517, 0.578, 0.63, 0.691, 0.742, 0.784, 0.838, 0.898, 1],
  ShtIncBl: [0.04, 0.085, 0.131, 0.179, 0.226, 0.276, 0.322, 0.373, 0.421, 0.505, 0.567, 0.619, 0.671, 0.726, 0.774, 0.815, 0.87, 0.92, 1],
  TouchOpBox: [0.04, 0.082, 0.129, 0.182, 0.23, 0.277, 0.323, 0.375, 0.424, 0.504, 0.564, 0.614, 0.663, 0.718, 0.765, 0.809, 0.861, 0.914, 1],
  PosWonA3rd: [0.059, 0.118, 0.171, 0.223, 0.273, 0.328, 0.379, 0.437, 0.486, 0.581, 0.638, 0.688, 0.735, 0.79, 0.832, 0.87, 0.913, 0.951, 1],
  RobosMedio: [0.063, 0.115, 0.165, 0.214, 0.265, 0.313, 0.36, 0.407, 0.459, 0.548, 0.601, 0.648, 0.692, 0.739, 0.785, 0.828, 0.875, 0.927, 1],
};

/** Parte del total que suele ir acumulada en el minuto `m`. */
export function parteAcumulada(metrica: string, m: number): number {
  const c = CURVAS[metrica] ?? CURVAS.ShtIncBl;
  const x = Math.max(0, Math.min(m, 95)) / 5;
  const i = Math.floor(x);
  if (i >= c.length - 1) return 1;
  const antes = i === 0 ? 0 : c[i - 1];
  return antes + (c[i] - antes) * (x - i);
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
  donde?: "nuestro" | "rival" | "ambos";
  metrica: string;
  quien: "nos" | "ellos";
  /** Más es bueno para nosotros. */
  mas: boolean;
  /** Porcentaje o cociente: no se lleva al minuto. */
  tasa?: boolean;
  /** Rango cuando el equipo no tiene partidos en Opta. */
  oficio: [number, number];
  unidad?: string;
  /** Si vamos ganando, esta alerta no lo es (es normal ceder). */
  cedeGanando?: boolean;
  bien: string;
  mal: string;
  consigna: string;
  peso: number;
};

const REGLAS: Regla[] = [
  { id: "xg-contra", titulo: "Peligro que nos crean", metrica: "ExpG", quien: "ellos", mas: false, oficio: [0.7, 1.5], bien: "Nos crean menos de lo que suelen", mal: "Nos están creando peligro", consigna: "Juntar líneas y cerrar el carril central", peso: 12 },
  { id: "xg-favor", titulo: "Ocasiones nuestras", metrica: "ExpG", quien: "nos", mas: true, oficio: [0.8, 1.7], cedeGanando: true, bien: "Generamos lo que solemos o más", mal: "Estamos generando poco", consigna: "Más gente en el área y llegar de segunda línea", peso: 10 },
  { id: "nos-roban", titulo: "Nos roban atrás", re: /nuestros errores|salida|p[eé]rdida|transici[oó]n|transitar/i, metrica: "PosWonA3rd", quien: "ellos", mas: false, oficio: [2, 6], bien: "Salimos limpios de atrás", mal: "Nos roban en nuestro tercio", consigna: "Salida limpia: no forzar por dentro, fijar y jugar fuera", peso: 10 },
  { id: "transicion", titulo: "Robos suyos para correr", re: /transici[oó]n|transitar|contragolpe|nuestros errores/i, metrica: "RobosMedio", quien: "ellos", mas: false, oficio: [14, 24], bien: "Les damos pocos robos para correr", mal: "Nos roban y salen a correr", consigna: "Vigilancias 2+1 y no perder por dentro", peso: 9 },
  { id: "posesion", titulo: "Dominio con balón", re: /posesi[oó]n|control del partido|dominio/i, metrica: "Poss%", quien: "nos", mas: true, tasa: true, oficio: [48, 58], unidad: "%", cedeGanando: true, bien: "El balón es nuestro, como pide el plan", mal: "No estamos teniendo el balón", consigna: "Apoyos por dentro al pivote, no rifar", peso: 9 },
  { id: "presion", titulo: "Agresividad sin balón", re: /agresiv|presi[oó]n|apret|saltos|campo contrario/i, metrica: "PPDA", quien: "nos", mas: false, tasa: true, oficio: [8, 13], cedeGanando: true, bien: "Apretamos como pide el plan", mal: "Les dejamos dar demasiados pases", consigna: "Saltar juntos y antes: equipo corto", peso: 8 },
  { id: "robo-alto", titulo: "Robos arriba", re: /agresiv|presi[oó]n|apret|campo contrario|reinicio/i, metrica: "PosWonA3rd", quien: "nos", mas: true, oficio: [2, 6], cedeGanando: true, bien: "Recuperamos en su campo", mal: "Casi no robamos arriba", consigna: "Presión tras pérdida 5 segundos", peso: 6 },
  { id: "area-contra", titulo: "Defensa del área", re: /defensa de [aá]rea|segunda l[ií]nea|pisan [aá]rea|ruptura/i, metrica: "TouchOpBox", quien: "ellos", mas: false, oficio: [12, 24], bien: "Pisan poco nuestra área", mal: "Entran mucho en nuestra área", consigna: "Vigilar la segunda línea y cerrar el rechace", peso: 8 },
  { id: "llegada", titulo: "Llegada al área", re: /llegada|a llegar|ocupaci[oó]n|pisar su [aá]rea|finaliz/i, metrica: "TouchOpBox", quien: "nos", mas: true, oficio: [14, 28], cedeGanando: true, bien: "Llegamos al área como queremos", mal: "No pisamos su área", consigna: "Ocupar el área con 4-5 y frontal con 2-3", peso: 7 },
  { id: "abp-contra", titulo: "Córners en contra", re: /abp|bal[oó]n parado|c[oó]rner/i, donde: "ambos", metrica: "Corners", quien: "ellos", mas: false, oficio: [3, 7], bien: "Les damos pocos balones parados", mal: "Les estamos dando córners", consigna: "Faltas lejos del área; córner: marcas y rechace", peso: 7 },
  { id: "progresion", titulo: "Precisión en su campo", re: /progresi|ventaja interior|v[ií]as|entre l[ií]neas/i, metrica: "Ps%InA3rd", quien: "nos", mas: true, tasa: true, oficio: [60, 72], unidad: "%", bien: "Progresamos con pase limpio", mal: "Perdemos el pase en su campo", consigna: "Una pausa más antes del último pase", peso: 5 },
  { id: "directo", titulo: "Duelo aéreo", re: /directo|golpeo largo|juego largo|segunda jugada/i, metrica: "Aerial%", quien: "nos", mas: true, tasa: true, oficio: [44, 56], unidad: "%", bien: "Ganamos el juego aéreo", mal: "Perdemos el balón largo", consigna: "Meter al MC en la línea y ganar la segunda", peso: 5 },
  { id: "pos-rival", titulo: "Su ataque posicional", re: /ataque posicional|juego propositivo/i, donde: "rival", metrica: "Pass%", quien: "ellos", mas: false, tasa: true, oficio: [72, 82], unidad: "%", bien: "Les cuesta jugar con balón", mal: "Están jugando cómodos con balón", consigna: "Orientar su salida hacia fuera y saltar", peso: 4 },
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
  const t = v.toLocaleString("es-ES", { maximumFractionDigits: unidad === "%" || Math.abs(v) >= 10 ? 0 : Math.abs(v) < 3 ? 2 : 1 });
  return unidad === "%" ? `${t} %` : t;
};

/* Antes de esto, sin muestra: los porcentajes y el PPDA bailan mucho más. */
const PRONTO_TASA = 25;
const PRONTO_CUENTA = 20;

export type Marcador = { nos: number; ellos: number };

/**
 * Los juicios del momento. `nos`/`ellos` = cifras en directo de cada equipo;
 * `bandaNos`/`bandaEllos` = lo habitual de cada uno esta temporada.
 *
 * Estado: dentro de su rango habitual (P25-P75 llevado al minuto) = «duda»
 * (lo habitual); fuera por el lado bueno = certeza; por el malo = alerta.
 */
export function juzga(opciones: {
  plan: Valores | null;
  minuto: number | null;
  nos: Valores;
  ellos: Valores;
  bandaNos: Record<string, Banda>;
  bandaEllos: Record<string, Banda>;
  marcador?: Marcador | null;
}): Juicio[] {
  const { plan, bandaNos, bandaEllos, marcador } = opciones;
  const nos = derivadas(opciones.nos);
  const ellos = derivadas(opciones.ellos);
  const minuto = Math.max(0, Math.min(opciones.minuto ?? 45, 95));
  const nuestras = lineas(plan, CAMPOS_NUESTROS);
  const suyas = lineas(plan, CAMPOS_RIVAL);
  const conPlan = nuestras.length + suyas.length > 0;
  const ganando = marcador != null && marcador.nos > marcador.ellos;
  const perdiendo = marcador != null && marcador.nos < marcador.ellos;
  const juicios: Juicio[] = [];

  for (const r of REGLAS) {
    let cita = "Objetivo general";
    if (r.re) {
      if (!conPlan) continue;
      const linea = (r.donde === "rival" ? suyas : r.donde === "ambos" ? [...nuestras, ...suyas] : nuestras).find((l) => r.re!.test(l));
      if (!linea) continue;
      cita = corta(linea);
    }

    /* Opta da los porcentajes en tanto por uno (0,55): a la pantalla, ×100. */
    const aCien = (x: number | null | undefined) => (x != null && r.unidad === "%" && Math.abs(x) <= 1.5 ? x * 100 : (x ?? null));
    const v = aCien(num((r.quien === "nos" ? nos : ellos)[r.metrica]));
    const banda = (r.quien === "nos" ? bandaNos : bandaEllos)[r.metrica];
    const lo0 = banda ? aCien(banda.p25)! : r.oficio[0];
    const hi0 = banda ? aCien(banda.p75)! : r.oficio[1];
    /* Sin cuartiles 10/90 (de oficio), un rango y medio. */
    const lo10 = banda ? aCien(banda.p10)! : lo0 - (hi0 - lo0) * 0.5;
    const hi90 = banda ? aCien(banda.p90)! : hi0 + (hi0 - lo0) * 0.5;
    const parte = r.tasa ? 1 : parteAcumulada(r.metrica, minuto);
    /* Un recuento pequeño baila más: se ensancha con ±√(esperado), como un Poisson. */
    const holgura = (x: number) => (r.tasa ? 0 : Math.sqrt(Math.max(x * parte, 0)) * (1 - parte) * (x < 5 ? 0.3 : 1));
    const lo = lo0 * parte - holgura(lo0);
    const hi = hi0 * parte + holgura(hi0);
    const muyLo = lo10 * parte - holgura(lo10);
    const muyHi = hi90 * parte + holgura(hi90);
    const quien = r.quien === "nos" ? "nuestros" : "sus";
    const liston = `${r.tasa ? "habitual" : "habitual a estas alturas"}: ${fmt(Math.max(lo, 0), r.unidad)}-${fmt(hi, r.unidad)}${banda ? ` (${quien} ${banda.n} partidos)` : " (de oficio)"}`;

    if (v == null) {
      juicios.push({ id: r.id, titulo: r.titulo, plan: cita, estado: "sindato", valor: "—", cifra: null, rango: [lo, hi], liston, frase: "Opta aún no da esta cifra", peso: 0 });
      continue;
    }

    /* Alerta o certeza sólo fuera de P10-P90 (lo raro de verdad); entre los
       dos rangos, en el filo; dentro de P25-P75, lo habitual. */
    const bueno = r.mas ? v > muyHi : v < muyLo;
    const malo = r.mas ? v < muyLo : v > muyHi;
    const fuera = v < lo || v > hi;
    let estado: Estado = minuto < (r.tasa ? PRONTO_TASA : PRONTO_CUENTA) ? "pronto" : bueno ? "certeza" : malo ? "alerta" : fuera ? "duda" : "habitual";
    let nota: string | undefined;
    let peso = r.peso + (r.re ? 2 : 0);

    if (ganando && r.cedeGanando && estado === "alerta") {
      estado = "habitual";
      nota = "Ganando: ceder balón y ritmo es normal";
    }
    /* Ganando en el tramo final, lo que más pesa es lo que nos crean. */
    if (ganando && minuto >= 70 && r.quien === "ellos") peso += 4;
    if (perdiendo && r.id === "xg-favor") peso += 4;

    juicios.push({
      id: r.id,
      titulo: r.titulo,
      plan: cita,
      estado,
      valor: fmt(v, r.unidad),
      cifra: v,
      rango: [lo, hi],
      liston,
      frase: estado === "certeza" ? r.bien : estado === "alerta" ? r.mal : estado === "pronto" ? "Aún es pronto para juzgarlo" : estado === "duda" ? `En el filo: ${((r.mas ? v < lo : v > hi) ? r.mal : r.bien).toLowerCase()}` : "Dentro de lo habitual",
      consigna: estado === "alerta" ? r.consigna : undefined,
      nota,
      peso,
    });
  }

  /* Disciplina: tres amarillas nuestras es alerta pase lo que pase. */
  const am = num(nos.Yellow);
  if (am != null && am >= 2) {
    juicios.push({
      id: "amarillas",
      titulo: "Amarillas nuestras",
      plan: nuestras.find((l) => /falta|interrumpir/i.test(l)) ? corta(nuestras.find((l) => /falta|interrumpir/i.test(l))!) : "Objetivo general",
      estado: am >= 3 ? "alerta" : "duda",
      valor: String(am),
      cifra: am,
      rango: null,
      liston: "a partir de 3, riesgo de quedarse con diez",
      frase: am >= 3 ? "Demasiadas amarillas: cuidado con la falta" : "Dos amarillas: cortar con cabeza",
      consigna: am >= 3 ? "Falta táctica sólo lejos de nuestra área y no los amonestados" : undefined,
      peso: 9,
    });
  }

  const orden: Record<Estado, number> = { alerta: 0, certeza: 1, duda: 2, habitual: 3, pronto: 4, sindato: 5 };
  return juicios.sort((a, b) => orden[a.estado] - orden[b.estado] || b.peso - a.peso);
}

/**
 * Una alerta sólo se enseña como tal si ya lo era en la lectura anterior: así
 * no parpadea con una jugada suelta. La primera vez queda «en el filo».
 */
export function confirma(ahora: Juicio[], antes: Juicio[] | null): Juicio[] {
  if (!antes) return ahora;
  const previo = new Map(antes.map((j) => [j.id, j.estado]));
  return ahora.map((j) =>
    j.estado === "alerta" && previo.has(j.id) && previo.get(j.id) !== "alerta"
      ? { ...j, estado: "duda" as Estado, frase: `Posible alerta: ${j.frase.toLowerCase()}`, nota: "Se confirma si sigue así en la próxima lectura" }
      : j,
  );
}

/* ------------------------------------------------------------------ */
/*  EL MOMENTO                                                         */
/* ------------------------------------------------------------------ */

/* La barra de cada 5' es sólo el xG (una unidad); los toques van en la frase. */
const empuje = (v: Valores) => num(v.ExpG) ?? 0;

export function momento(tramos: Tramo[]): Momento {
  const orden = [...tramos].sort((a, b) => a.parte - b.parte || a.tramo - b.tramo);
  const barras = orden.map((t) => ({
    /* Por el final del tramo: «5'» es lo que pasó del 0 al 5. */
    etiqueta: `${(t.tramo + 1) * 5}'`,
    balanza: Math.round((empuje(t.nos) - empuje(t.ellos)) * 100) / 100,
  }));
  const ult = orden.slice(-3);
  if (ult.length < 2) return { barras, ultimos: null };
  const suma = (lado: "nos" | "ellos", k: string) => ult.reduce((s, t) => s + (num(t[lado][k]) ?? 0), 0);
  const xgNos = suma("nos", "ExpG");
  const xgEllos = suma("ellos", "ExpG");
  const areaNos = suma("nos", "TouchOpBox");
  const areaEllos = suma("ellos", "TouchOpBox");
  const roboEllos = suma("ellos", "PosWonA3rd");
  const xg = (x: number) => x.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  const datos = `xG ${xg(xgNos)}-${xg(xgEllos)} · toques en el área ${areaNos}-${areaEllos}`;
  /* Manda quien gana en las dos cosas, o en una por mucho. */
  const puntos = Math.sign(xgNos - xgEllos) * (Math.abs(xgNos - xgEllos) >= 0.15 ? 2 : Math.abs(xgNos - xgEllos) >= 0.05 ? 1 : 0) + Math.sign(areaNos - areaEllos) * (Math.abs(areaNos - areaEllos) >= 4 ? 2 : Math.abs(areaNos - areaEllos) >= 2 ? 1 : 0);
  if (Math.abs(puntos) < 2) return { barras, ultimos: { manda: "igual", frase: `Últimos 15': igualado (${datos})` } };
  if (puntos > 0) return { barras, ultimos: { manda: "nos", frase: `Últimos 15': mandamos nosotros (${datos})` } };
  return { barras, ultimos: { manda: "ellos", frase: `Últimos 15': aprietan ellos (${datos}${roboEllos >= 2 ? ` · ${roboEllos} robos en nuestro campo` : ""})` } };
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
