/**
 * IDENTIDAD EN EL CAMPO (02/11/2026).
 *
 * Cruza lo que decimos que somos —la Identidad de Juego (hoja del modelo), la
 * Identidad Posicional y los valores votados por la plantilla— con lo que
 * sale en el campo (Wyscout de nuestros partidos, contra la categoría) y con
 * lo que se entrena (registro de tareas de los microciclos).
 *
 * Reglas:
 * - Sólo se nombra un principio si tiene indicador con dato. Lo que no se
 *   puede medir no sale.
 * - El índice es SIEMPRE un percentil orientado contra la categoría (0-100,
 *   más es más «nosotros»). Reutiliza `valorEnGrupo` y `percentil` de DATA.
 * - El texto de los principios es del cuerpo técnico: si llega la hoja del
 *   modelo, se pinta su redacción; si un principio ya no está en la hoja, se
 *   cae de la vista.
 */

import type { RegistroTarea } from "@/lib/abp/registro";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import { METRICA_POR_KEY, percentil, valorEnGrupo, type Metrica } from "@/lib/data-analisis/metricas";
import { competicionPrincipal } from "@/lib/data-analisis/equipo";
import { esNuestro, puestoDe, universoDe, valorDe, type Puesto } from "@/lib/data-analisis/individual";

export const NOSOTROS = "Real Madrid Castilla";
export const DESDE = "2026-07-01";

/* ------------------------------------------------------------------ */
/*  QUÉ SE MIDE                                                        */
/* ------------------------------------------------------------------ */

export type BloqueKey = "atqGeneral" | "prog" | "pos" | "tof" | "defGeneral" | "dcr" | "dcp" | "tdef";

/** Un indicador: una métrica de DATA, de nuestra fila o de la del rival, con su sentido para nosotros. */
type Indicador = { metrica: string; lado: "nuestro" | "rival"; mejorAlto: boolean; etiqueta?: string };

type DefPrincipio = { bloque: BloqueKey; busca: RegExp; texto: string; indicadores: Indicador[] };

export const BLOQUES: { key: BloqueKey; fase: "ATAQUE" | "DEFENSA"; hoja: string; label: string; entrenable: boolean }[] = [
  { key: "atqGeneral", fase: "ATAQUE", hoja: "GENERAL", label: "Ataque · lo general", entrenable: false },
  { key: "prog", fase: "ATAQUE", hoja: "Progresión desde campo propio", label: "Progresión desde campo propio", entrenable: true },
  { key: "pos", fase: "ATAQUE", hoja: "Posicional en campo rival", label: "Ataque en campo rival", entrenable: true },
  { key: "tof", fase: "ATAQUE", hoja: "Transición ofensiva", label: "Transición ofensiva", entrenable: true },
  { key: "defGeneral", fase: "DEFENSA", hoja: "GENERAL", label: "Defensa · lo general", entrenable: false },
  { key: "dcr", fase: "DEFENSA", hoja: "Defensa en campo rival", label: "Defensa en campo rival", entrenable: true },
  { key: "dcp", fase: "DEFENSA", hoja: "Defensa en campo propio", label: "Defensa en campo propio", entrenable: true },
  { key: "tdef", fase: "DEFENSA", hoja: "Transición defensiva", label: "Transición defensiva", entrenable: true },
];

const n = (metrica: string, mejorAlto = true, etiqueta?: string): Indicador => ({ metrica, lado: "nuestro", mejorAlto, etiqueta });
const r = (metrica: string, etiqueta: string): Indicador => ({ metrica, lado: "rival", mejorAlto: false, etiqueta });

const PRINCIPIOS: DefPrincipio[] = [
  { bloque: "atqGeneral", busca: /ganar duelos/i, texto: "Ganar duelos.", indicadores: [n("duelosOfensivos")] },
  { bloque: "atqGeneral", busca: /verticalidad/i, texto: "Verticalidad.", indicadores: [n("cuotaProgresivos")] },
  { bloque: "atqGeneral", busca: /amenazar la profundidad/i, texto: "Amenazar la profundidad.", indicadores: [n("desmarques"), n("pasesProfundidad")] },
  { bloque: "prog", busca: /evitar p[eé]rdidas/i, texto: "Evitar pérdidas que permitan transitar.", indicadores: [n("perdidasBajas", false)] },
  { bloque: "prog", busca: /alternancia/i, texto: "Progresar con alternancia para acelerar.", indicadores: [n("progresivosPrecisos")] },
  { bloque: "prog", busca: /env[ií]os directos/i, texto: "Reducir envíos directos sin continuidad.", indicadores: [n("pasesLargos", false, "Juego largo % (menos es mejor)")] },
  { bloque: "pos", busca: /finalizar ataques/i, texto: "Finalizar ataques evitando transición rival.", indicadores: [n("ataquesPosRemate")] },
  { bloque: "pos", busca: /conquistar espacios/i, texto: "Conquistar espacios que permitan atacar la línea defensiva.", indicadores: [n("toquesArea"), n("cuotaUltimoTercio")] },
  { bloque: "tof", busca: /r[aá]pido y vertical/i, texto: "Priorizar ataque rápido y vertical.", indicadores: [n("contras"), n("contrasRemate")] },
  { bloque: "defGeneral", busca: /ganar mi duelo/i, texto: "Ganar mi duelo.", indicadores: [n("duelosDefensivos"), n("duelosAereos")] },
  { bloque: "dcr", busca: /impedir progresi[oó]n/i, texto: "Condicionar e impedir la progresión rival.", indicadores: [n("ppda", false)] },
  { bloque: "dcr", busca: /recuperar para transitar/i, texto: "Recuperar para transitar rápido.", indicadores: [n("recuperacionesAltas")] },
  { bloque: "dcp", busca: /evitar situaciones de finalizaci[oó]n/i, texto: "Evitar situaciones de finalización en cooperación con el portero.", indicadores: [n("tirosContra", false), n("xgContra", false)] },
  { bloque: "tdef", busca: /interrumpir recuperaci[oó]n/i, texto: "Interrumpir la recuperación rival.", indicadores: [r("contras", "Contraataques del rival")] },
  { bloque: "tdef", busca: /replegar ante ataque/i, texto: "Replegar ante ataque a la última línea.", indicadores: [r("contrasRemate", "Contraataques del rival que acaban en remate %")] },
];

/** Ancla del principio en /identidad-campo: fija aunque la hoja cambie de orden. */
const anclaDe = (p: DefPrincipio) => `principio-${PRINCIPIOS.indexOf(p)}`;

/**
 * 07/11/2026: lo que /game-model enseña bajo cada principio que se mide en el
 * partido: con qué métricas y adónde saltar para verlo. Null si el principio
 * no tiene indicador (no se promete una medida que no existe).
 */
export function medidaDelPrincipio(fase: string, bloque: string, principio: string) {
  const def = PRINCIPIOS.find((p) => {
    const b = BLOQUES.find((x) => x.key === p.bloque)!;

    return b.fase === fase.trim() && b.hoja === bloque.trim() && p.busca.test(principio);
  });

  if (!def) return null;

  const metricas = def.indicadores
    .map((i) => i.etiqueta ?? METRICA_POR_KEY.get(i.metrica)?.nombre ?? "")
    .filter(Boolean);

  return metricas.length ? { ancla: anclaDe(def), metricas } : null;
}

/** Los valores del vestuario que dejan huella en el partido. El texto es el del documento de valores. */
const VALORES: { key: string; valor: string; conducta: string; indicadores: Indicador[] }[] = [
  { key: "valentia", valor: "Exigencia y valentía", conducta: "Disputar cada balón dividido como una final.", indicadores: [n("duelosGanados"), n("duelosAereos")] },
  { key: "compromiso", valor: "Compromiso", conducta: "Bajar a defender tras pérdida y mantener la presión hasta el silbato final.", indicadores: [n("ppda", false), n("recuperacionesAltas")] },
  { key: "rigor", valor: "Respeto y rigor institucional", conducta: "Representar el escudo con profesionalidad.", indicadores: [n("amarillas", false), n("rojas", false), n("faltas", false, "Faltas cometidas (menos es mejor)")] },
];

/* ------------------------------------------------------------------ */
/*  TIPOS DE SALIDA                                                    */
/* ------------------------------------------------------------------ */

export type IndicadorMedido = { nombre: string; valor: number; unidad: Metrica["unidad"]; percentil: number; mediana: number };

export type PrincipioMedido = {
  id: string;
  bloque: BloqueKey;
  texto: string;
  clave: boolean;
  indice: number;
  indicadores: IndicadorMedido[];
  /** Un índice por partido, en orden de fecha. */
  tendencia: (number | null)[];
};

export type BloqueMedido = {
  key: BloqueKey;
  label: string;
  fase: "ATAQUE" | "DEFENSA";
  indice: number;
  tendencia: (number | null)[];
  principios: PrincipioMedido[];
  /** % de los minutos de entrenamiento de la temporada dedicados al bloque. */
  entreno: number | null;
  /** Las semanas que más se entrenó contra las que menos: índice medio del partido. */
  coherencia: { mas: number; menos: number; partidosMas: number; partidosMenos: number } | null;
  brecha: "entrenaYNoSale" | "saleSinEntrenar" | "coherente" | "niSeEntrenaNiSale" | null;
};

export type ValorMedido = { key: string; valor: string; conducta: string; indice: number; indicadores: IndicadorMedido[]; tendencia: (number | null)[] };

export type PartidoEje = { fecha: string; rival: string; jornada: number; marcador: string; entreno: Partial<Record<BloqueKey, number>>; minutos: number };

export type JugadorEncaje = {
  nombre: string;
  puesto: Puesto;
  minutos: number;
  encaje: number;
  rasgos: { texto: string; percentil: number }[];
};

export type IdentidadEnElCampo = {
  competicion: string;
  equipos: number;
  partidos: PartidoEje[];
  indiceGlobal: number;
  bloques: BloqueMedido[];
  valores: ValorMedido[];
  jugadores: JugadorEncaje[];
  conclusiones: string[];
};

/* ------------------------------------------------------------------ */
/*  CÁLCULO                                                            */
/* ------------------------------------------------------------------ */

const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const redondo = (v: number | null) => (v === null ? null : Math.round(v));
/* La redacción es del cuerpo técnico: sólo se quitan la marca «CLAVE» y las mayúsculas de énfasis. */
const MAYUS = /^[\p{Lu}]{2,}[.,;:]?$/u;
const sinEnfasis = (t: string) => {
  const p = t.split(/(\s+)/);
  const es = (i: number) => i >= 0 && i < p.length && MAYUS.test(p[i]);

  return p.map((w, i) => (es(i) || (/^\p{Lu}$/u.test(w) && (es(i - 2) || es(i + 2))) ? w.toLowerCase() : w)).join("");
};
const limpiaTexto = (t: string) => sinEnfasis(t.replace(/\bCLAVE\b/g, "")).replace(/\s+/g, " ").trim().replace(/\.?$/, ".");

/** Filas del rival en cada uno de nuestros partidos. */
function rivalDe(fila: FilaPartido, porLlave: Map<string, FilaPartido>) {
  return porLlave.get(`${fila.fecha}|${fila.rival}`) ?? null;
}

type FilaHoja = { FASE?: string; BLOQUE?: string; PRINCIPIO?: string; ACTIVO?: string };

/** Qué principios del código siguen en la hoja, con la redacción de la hoja. */
function principiosVigentes(hoja: FilaHoja[] | null) {
  if (!hoja?.length) return PRINCIPIOS.map((p) => ({ def: p, texto: p.texto, clave: false }));

  const activas = hoja.filter((f) => String(f.ACTIVO ?? "TRUE").toUpperCase() !== "FALSE");

  return PRINCIPIOS.flatMap((p) => {
    const bloque = BLOQUES.find((b) => b.key === p.bloque)!;
    const fila = activas.find((f) => (f.FASE ?? "").trim() === bloque.fase && (f.BLOQUE ?? "").trim() === bloque.hoja && p.busca.test(f.PRINCIPIO ?? ""));

    return fila ? [{ def: p, texto: limpiaTexto(String(fila.PRINCIPIO).split("\n")[0]), clave: /\bCLAVE\b/.test(fila.PRINCIPIO ?? "") }] : [];
  });
}

/* ---- Entrenamiento: a qué bloque va cada tarea ---- */

const iso = (f: string) => {
  const m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : f;
};

export function bloquesDeTarea(t: Pick<RegistroTarea, "contenidoPrincipal" | "contenidoSecundario" | "fase">): Partial<Record<BloqueKey, number>> {
  const texto = `${t.contenidoPrincipal} | ${t.contenidoSecundario} | ${t.fase}`.toLowerCase();

  if (/^abp/i.test(t.fase.trim()) || /^abp/i.test(t.contenidoPrincipal.trim())) return {};

  const hits = new Set<BloqueKey>();

  if (/ataque cp|progresi|inicio|saque de puerta|saques de puerta|reinici|salida de bal/.test(texto)) hits.add("prog");
  if (/ataque cr|[uú]ltimo tercio|ind\.finaliz|finalizaci/.test(texto)) hits.add("pos");
  if (/tr ofensiva|transici[oó]n ofensiva/.test(texto) || (/^transici/i.test(t.contenidoPrincipal) && !/defens/.test(texto))) hits.add("tof");
  if (/tr defensiva|press p[eé]rdida|transici[oó]n defensiva|tras p[eé]rdida/.test(texto)) hits.add("tdef");
  if (/defensa cr|bloque alto|medio[- /]+alto|presi[oó]n alta/.test(texto)) hits.add("dcr");
  if (/defensa cp|bloque bajo|defensa [aá]rea/.test(texto)) hits.add("dcp");
  if (/bloque medio(?![- /]+alto)/.test(texto) && !hits.has("dcr") && !hits.has("dcp")) {
    hits.add("dcr");
    hits.add("dcp");
  }

  const peso = hits.size ? 1 / hits.size : 0;

  return Object.fromEntries([...hits].map((k) => [k, peso]));
}

const esCompeticion = (t: RegistroTarea) => /competici/i.test(t.fase) || /competici/i.test(t.tipoTarea) || /competici/i.test(t.contenidoPrincipal);

/** Minutos por bloque de cada semana: cada día de entrenamiento va al siguiente partido. */
function entrenoPorPartido(tareas: RegistroTarea[], fechas: string[], temporada = "2026 - 2027") {
  const delAno = tareas.filter((t) => t.temporada.replace(/\s/g, "") === temporada.replace(/\s/g, "") && t.fecha && t.tiempo > 0);
  const porFecha = new Map<string, { minutos: number; bloques: Partial<Record<BloqueKey, number>> }>();

  for (const t of delAno) {
    if (esCompeticion(t)) continue;

    const dia = iso(t.fecha);
    const destino = fechas.find((f) => f > dia && (Date.parse(f) - Date.parse(dia)) / 864e5 <= 10);

    if (!destino) continue;

    const acc = porFecha.get(destino) ?? { minutos: 0, bloques: {} };

    acc.minutos += t.tiempo;

    for (const [k, w] of Object.entries(bloquesDeTarea(t)) as [BloqueKey, number][]) acc.bloques[k] = (acc.bloques[k] ?? 0) + w * t.tiempo;

    porFecha.set(destino, acc);
  }

  return porFecha;
}

/* ---- Identidad posicional: qué se le pide a cada puesto y con qué se ve ---- */

type Rasgo = { texto: string; columna: string; mejorAlto?: boolean };

const PERFIL_PUESTO: Partial<Record<Puesto, Rasgo[]>> = {
  CEN: [
    { texto: "Pases de superación", columna: "Pases progresivos/90" },
    { texto: "Conducir para hundir la línea rival", columna: "Carreras en progresión/90" },
    { texto: "Pases de continuidad", columna: "Precisión pases, %" },
    { texto: "Duelo aéreo", columna: "Duelos aéreos ganados, %" },
    { texto: "Anticipación", columna: "Interceptaciones/90" },
    { texto: "1 vs 1", columna: "Duelos defensivos ganados, %" },
  ],
  LAT: [
    { texto: "Conducir para hundir la línea rival", columna: "Carreras en progresión/90" },
    { texto: "Centro lateral estando y llegando", columna: "Centros/90" },
    { texto: "Juego interior y desmarque de última línea", columna: "Ataque en profundidad/90" },
    { texto: "Abrir cadera y jugar hacia delante", columna: "Pases progresivos/90" },
    { texto: "1 vs 1", columna: "Duelos defensivos ganados, %" },
    { texto: "Duelo aéreo", columna: "Duelos aéreos ganados, %" },
  ],
  MED: [
    { texto: "Pases de continuidad o superación", columna: "Pases progresivos/90" },
    { texto: "Conducción de superación", columna: "Carreras en progresión/90" },
    { texto: "Protección de balón", columna: "Duelos atacantes ganados, %" },
    { texto: "Defensa en intermedias", columna: "Interceptaciones/90" },
    { texto: "Duelo aéreo", columna: "Duelos aéreos ganados, %" },
    { texto: "Defender rupturas + 1 vs 1", columna: "Duelos defensivos ganados, %" },
  ],
  BAN: [
    { texto: "1 vs 1 en carril exterior", columna: "Regates realizados, %" },
    { texto: "Ruptura a la espalda de la última línea", columna: "Ataque en profundidad/90" },
    { texto: "Centro lateral estando y en carrera", columna: "Centros/90" },
    { texto: "Atacar área y llegar a zonas de remate", columna: "Toques en el área de penalti/90" },
    { texto: "Finalización", columna: "xG/90" },
    { texto: "Evitar ser superado", columna: "Duelos defensivos ganados, %" },
  ],
  DEL: [
    { texto: "Ruptura en profundidad", columna: "Ataque en profundidad/90" },
    { texto: "Juego de espaldas: proteger, descargar, girar", columna: "Duelos atacantes ganados, %" },
    { texto: "Atacar área", columna: "Toques en el área de penalti/90" },
    { texto: "Finalizar", columna: "xG/90" },
    { texto: "Presión y saltos", columna: "Acciones defensivas realizadas/90" },
  ],
};

const plano = (t: string) =>
  t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\bvs\.?\b/g, "contra").replace(/[^a-z0-9]+/g, " ").trim();

/** Posición de la hoja de contenidos («CENTRALES», «EXTREMOS»…) → puesto de DATA. */
const PUESTO_DE_HOJA: [RegExp, Puesto][] = [
  [/central/i, "CEN"],
  [/lateral|carrilero/i, "LAT"],
  [/mediocentro|medio|pivote|interior|mediapunta/i, "MED"],
  [/extremo|banda/i, "BAN"],
  [/delanter|punta/i, "DEL"],
];

/**
 * 07/11/2026: la métrica de Wyscout con la que /identidad-campo mide un
 * contenido del puesto, para enseñarla bajo el contenido en
 * /identidad-posicional. Null si el contenido no tiene indicador.
 */
export function medidaDelContenido(posicionHoja: string, contenido: string): string | null {
  const puesto = PUESTO_DE_HOJA.find(([re]) => re.test(posicionHoja))?.[1];
  const rasgos = puesto ? PERFIL_PUESTO[puesto] : undefined;

  if (!rasgos) return null;

  const c = plano(contenido);

  return rasgos.find((r) => {
    const t = plano(r.texto);

    return c === t || c.startsWith(`${t} `) || t.startsWith(`${c} `);
  })?.columna ?? null;
}

export const NOMBRE_PUESTO: Record<Puesto, string> = { POR: "Portero", CEN: "Central", LAT: "Lateral", MED: "Centrocampista", BAN: "Extremo", DEL: "Delantero" };

function encajes(jugadores: FilaJugador[]): JugadorEncaje[] {
  const liga = universoDe(jugadores, "liga");

  return liga
    .filter((j) => esNuestro(j) && j.minutos >= 270)
    .flatMap((j) => {
      const puesto = puestoDe(j.posicion);
      const perfil = PERFIL_PUESTO[puesto];

      if (!perfil) return [];

      const delPuesto = liga.filter((x) => puestoDe(x.posicion) === puesto);
      const rasgos = perfil.flatMap((rg) => {
        const v = valorDe(j, rg.columna);

        if (v === null || !Number.isFinite(v)) return [];

        const p = percentil(v, delPuesto.map((x) => valorDe(x, rg.columna)).filter((x): x is number => x !== null), rg.mejorAlto ?? true);

        return p === null ? [] : [{ texto: rg.texto, percentil: Math.round(p) }];
      });

      if (rasgos.length < 3) return [];

      return [{ nombre: j.jugador, puesto, minutos: j.minutos, encaje: Math.round(media(rasgos.map((x) => x.percentil)) ?? 0), rasgos }];
    })
    .sort((a, b) => b.encaje - a.encaje);
}

/* ---- El cálculo entero ---- */

export function identidadEnElCampo(partidos: FilaPartido[], jugadores: FilaJugador[], tareas: RegistroTarea[], hoja: FilaHoja[] | null = null): IdentidadEnElCampo | null {
  const delAno = partidos.filter((f) => f.fecha >= DESDE);
  const nuestras = delAno.filter((f) => f.equipo === NOSOTROS);

  if (nuestras.length < 2) return null;

  const competicion = competicionPrincipal(nuestras);
  const comp = delAno.filter((f) => f.competicion === competicion);
  const mias = comp.filter((f) => f.equipo === NOSOTROS).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const equipos = [...new Set(comp.map((f) => f.equipo))];
  const porLlave = new Map(comp.map((f) => [`${f.fecha}|${f.equipo}`, f] as const));
  const filasDe = (equipo: string, lado: Indicador["lado"]) => {
    const suyas = comp.filter((f) => f.equipo === equipo);

    return lado === "nuestro" ? suyas : suyas.map((f) => rivalDe(f, porLlave)).filter((f): f is FilaPartido => Boolean(f));
  };

  /** Temporada contra la categoría y partido a partido contra todos los partidos de la categoría. */
  const mide = (ind: Indicador) => {
    const m = METRICA_POR_KEY.get(ind.metrica);

    if (!m) return null;

    const valor = valorEnGrupo(m, filasDe(NOSOTROS, ind.lado), "promedio");

    if (valor === null || !Number.isFinite(valor)) return null;

    const deLaLiga = equipos.map((e) => valorEnGrupo(m, filasDe(e, ind.lado), "promedio")).filter((v): v is number => v !== null && Number.isFinite(v));
    const p = percentil(valor, deLaLiga, ind.mejorAlto);

    if (p === null || deLaLiga.length < 6) return null;

    const todasLasFilas = comp.map((f) => valorEnGrupo(m, [f], "promedio")).filter((v): v is number => v !== null && Number.isFinite(v));
    const tendencia = mias.map((f) => {
      const fila = ind.lado === "nuestro" ? f : rivalDe(f, porLlave);
      const v = fila ? valorEnGrupo(m, [fila], "promedio") : null;

      return v === null || !Number.isFinite(v) ? null : percentil(v, todasLasFilas, ind.mejorAlto);
    });
    const orden = [...deLaLiga].sort((a, b) => a - b);

    return {
      medido: { nombre: ind.etiqueta ?? m.nombre, valor, unidad: m.unidad, percentil: Math.round(p), mediana: orden[Math.floor(orden.length / 2)] } satisfies IndicadorMedido,
      tendencia,
    };
  };

  const agrega = (inds: Indicador[]) => {
    const medidos = inds.map(mide).filter((x): x is NonNullable<ReturnType<typeof mide>> => Boolean(x));

    if (!medidos.length) return null;

    return {
      indicadores: medidos.map((x) => x.medido),
      indice: Math.round(media(medidos.map((x) => x.medido.percentil)) ?? 0),
      tendencia: mias.map((_, i) => redondo(media(medidos.map((x) => x.tendencia[i]).filter((v): v is number => v !== null)))),
    };
  };

  /* Entrenamiento por semana. */
  const fechas = mias.map((f) => f.fecha);
  const semanas = entrenoPorPartido(tareas, fechas);
  const totalMin = [...semanas.values()].reduce((s, x) => s + x.minutos, 0);

  const ejes: PartidoEje[] = mias.map((f, i) => {
    const s = semanas.get(f.fecha);

    return {
      fecha: f.fecha,
      rival: f.rival,
      jornada: i + 1,
      marcador: `${f.golesFavor}-${f.golesContra}`,
      minutos: s?.minutos ?? 0,
      entreno: s ? Object.fromEntries(Object.entries(s.bloques).map(([k, v]) => [k, Math.round((100 * (v as number)) / s.minutos)])) : {},
    };
  });

  const vigentes = principiosVigentes(hoja);
  const bloques: BloqueMedido[] = BLOQUES.flatMap((b) => {
    const principios: PrincipioMedido[] = vigentes
      .filter((v) => v.def.bloque === b.key)
      .flatMap((v) => {
        const a = agrega(v.def.indicadores);

        return a ? [{ id: anclaDe(v.def), bloque: b.key, texto: v.texto, clave: v.clave, ...a }] : [];
      });

    if (!principios.length) return [];

    const entrenoMin = b.entrenable && totalMin > 0 ? [...semanas.values()].reduce((s, x) => s + (x.bloques[b.key] ?? 0), 0) : null;
    const tendencia = mias.map((_, i) => redondo(media(principios.map((p) => p.tendencia[i]).filter((v): v is number => v !== null))));

    /* Coherencia semana a semana: las semanas que más se entrenó el bloque contra las que menos. */
    let coherencia: BloqueMedido["coherencia"] = null;

    if (b.entrenable) {
      const pares = ejes.map((e, i) => ({ cuota: e.minutos ? e.entreno[b.key] ?? 0 : null, indice: tendencia[i] })).filter((x): x is { cuota: number; indice: number } => x.cuota !== null && x.indice !== null);
      const orden = [...pares].sort((a, c) => c.cuota - a.cuota);
      const mitad = Math.ceil(orden.length / 2);
      const mas = orden.slice(0, mitad);
      const menos = orden.slice(mitad);
      const distintas = (media(mas.map((x) => x.cuota)) ?? 0) - (media(menos.map((x) => x.cuota)) ?? 0) >= 3;

      if (mas.length >= 2 && menos.length >= 2 && distintas) {
        coherencia = { mas: Math.round(media(mas.map((x) => x.indice))!), menos: Math.round(media(menos.map((x) => x.indice))!), partidosMas: mas.length, partidosMenos: menos.length };
      }
    }

    return [{
      key: b.key,
      label: b.label,
      fase: b.fase,
      indice: Math.round(media(principios.map((p) => p.indice)) ?? 0),
      tendencia,
      principios,
      entreno: entrenoMin === null ? null : Math.round((100 * entrenoMin) / totalMin),
      coherencia,
      brecha: null,
    }];
  });

  /* Brechas: lo que más entrenamos frente a lo que sale. */
  const entrenables = bloques.filter((b) => b.entreno !== null);
  const cuotaMedia = media(entrenables.map((b) => b.entreno as number)) ?? 0;

  for (const b of entrenables) {
    const e = b.entreno as number;

    if (e >= cuotaMedia && b.indice < 45) b.brecha = "entrenaYNoSale";
    else if (e < cuotaMedia * 0.6 && b.indice >= 60) b.brecha = "saleSinEntrenar";
    else if (e >= cuotaMedia && b.indice >= 60) b.brecha = "coherente";
    else if (e < cuotaMedia * 0.6 && b.indice < 40) b.brecha = "niSeEntrenaNiSale";
  }

  const valores: ValorMedido[] = VALORES.flatMap((v) => {
    const a = agrega(v.indicadores);

    return a ? [{ key: v.key, valor: v.valor, conducta: v.conducta, ...a }] : [];
  });

  const jugadoresEncaje = encajes(jugadores);
  const indiceGlobal = Math.round(media(bloques.map((b) => b.indice)) ?? 0);

  return {
    competicion,
    equipos: equipos.length,
    partidos: ejes,
    indiceGlobal,
    bloques,
    valores,
    jugadores: jugadoresEncaje,
    conclusiones: conclusionesDe(bloques, valores, jugadoresEncaje, ejes, indiceGlobal),
  };
}

/* ------------------------------------------------------------------ */
/*  LO QUE SE DICE                                                     */
/* ------------------------------------------------------------------ */

export const nivel = (p: number) => (p >= 75 ? "muy reconocible" : p >= 60 ? "reconocible" : p >= 40 ? "a medias" : p >= 25 ? "poco reconocible" : "no aparece");

const minus = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

function conclusionesDe(bloques: BloqueMedido[], valores: ValorMedido[], jugadores: JugadorEncaje[], ejes: PartidoEje[], global: number): string[] {
  const frases: string[] = [];
  const orden = [...bloques].sort((a, b) => b.indice - a.indice);
  const principios = bloques.flatMap((b) => b.principios);
  const mejor = [...principios].sort((a, b) => b.indice - a.indice)[0];
  const peor = [...principios].sort((a, b) => a.indice - b.indice)[0];

  frases.push(`Nuestra identidad de juego se reconoce en el campo con un ${global} sobre 100 frente a la categoría: ${nivel(global)}.`);

  if (orden[0] && orden.at(-1) && orden[0] !== orden.at(-1)) {
    frases.push(`Donde más se nos ve es en ${minus(orden[0].label)} (${orden[0].indice}); donde menos, en ${minus(orden.at(-1)!.label)} (${orden.at(-1)!.indice}).`);
  }

  if (mejor && peor && mejor !== peor) {
    frases.push(`El principio que mejor cumplimos: «${mejor.texto.replace(/\.$/, "")}» (${mejor.indice}). El que más se nos escapa: «${peor.texto.replace(/\.$/, "")}» (${peor.indice}).`);
  }

  for (const b of bloques) {
    if (b.brecha === "entrenaYNoSale") frases.push(`${b.label}: le dedicamos el ${b.entreno} % de la semana y en el partido salimos en el ${b.indice}. Se entrena y todavía no sale.`);
    if (b.brecha === "saleSinEntrenar") frases.push(`${b.label}: sólo el ${b.entreno} % de la semana y aun así salimos en el ${b.indice}. Sale casi sin entrenarlo.`);
    if (b.brecha === "niSeEntrenaNiSale") frases.push(`${b.label}: apenas el ${b.entreno} % de la semana y percentil ${b.indice} en el partido. Si es parte de lo que queremos ser, pide más sitio en el microciclo.`);
    if (b.brecha === "coherente") frases.push(`${b.label}: el ${b.entreno} % de la semana y percentil ${b.indice} en el partido. Lo que se entrena, se ve.`);
  }

  const conTransfer = bloques.filter((b) => b.coherencia && b.coherencia.mas - b.coherencia.menos >= 10);

  for (const b of conTransfer.slice(0, 2)) {
    frases.push(`Las semanas que más trabajamos ${minus(b.label)} salimos en el ${b.coherencia!.mas}; las que menos, en el ${b.coherencia!.menos}.`);
  }

  const ultimos = ejes.length >= 6 ? bloques.map((b) => ({ b, antes: media(b.tendencia.slice(-6, -3).filter((v): v is number => v !== null)), ahora: media(b.tendencia.slice(-3).filter((v): v is number => v !== null)) })) : [];
  const sube = ultimos.filter((x) => x.antes !== null && x.ahora !== null).sort((a, b) => (b.ahora! - b.antes!) - (a.ahora! - a.antes!));

  if (sube[0] && sube[0].ahora! - sube[0].antes! >= 10) frases.push(`En los tres últimos partidos crece ${minus(sube[0].b.label)}: de ${Math.round(sube[0].antes!)} a ${Math.round(sube[0].ahora!)}.`);
  if (sube.at(-1) && sube.at(-1)!.antes! - sube.at(-1)!.ahora! >= 10) frases.push(`En los tres últimos partidos cae ${minus(sube.at(-1)!.b.label)}: de ${Math.round(sube.at(-1)!.antes!)} a ${Math.round(sube.at(-1)!.ahora!)}.`);

  const v = [...valores].sort((a, b) => b.indice - a.indice);

  if (v[0]) frases.push(`De los valores del vestuario, el que más se ve en el partido es «${v[0].valor}» (${v[0].indice}).`);
  if (v.length > 1 && v.at(-1)!.indice < 45) frases.push(`«${v.at(-1)!.valor}» queda en el ${v.at(-1)!.indice}: hay margen.`);

  if (jugadores.length >= 3) {
    const top = jugadores.slice(0, 3).map((j) => j.nombre).join(", ");

    frases.push(`Los que más se parecen a lo que pedimos en su puesto: ${top}.`);
  }

  return frases;
}
