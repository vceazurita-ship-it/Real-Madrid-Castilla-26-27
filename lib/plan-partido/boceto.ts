/*
|--------------------------------------------------------------------------
| EL BOCETO DEL PLAN DE PARTIDO (11/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el cuerpo técnico: «replicar lo de la semana anterior exactamente
| igual y poner en interrogantes los puntos que, analizando los datos propios
| y del rival, quizás sean susceptibles de cambiar, y un asterisco para los
| ítems que por el mismo motivo sean a valorar incorporar».
|
| Esto es el motor, sin pantalla: entra el plan de la jornada anterior y los
| datos que ya tiene la plataforma del rival que viene y de nosotros, y sale
| el mismo plan, línea a línea, con tres marcas:
|
|   (nada)  la línea se queda como estaba: o no habla de nada que los datos
|           midan, o los datos del nuevo rival se parecen a los del anterior;
|   ?       a valorar cambiar: la línea habla de algo que en el nuevo rival es
|           distinto (presión, juego largo, centros, balón parado, sistema…),
|           nombra a un jugador o al propio rival de la semana pasada, o es
|           del estado del equipo, que cambia cada semana. Lleva el dato;
|   *       a valorar incorporar: lo que los datos dicen del rival y no está
|           en el plan. Cada sugerencia lleva su cifra y su sitio en la liga.
|
| Las fuentes son las de siempre, ninguna nueva: los informes de equipo de
| Wyscout (`lib/data-analisis/equipo.ts`: perfil, resumen, plantilla y síntesis),
| el balón parado de la liga y nuestras hojas (`lib/abp/rivalAbp.ts`) y lo que
| el cuerpo técnico registró en vídeo del rival (`lib/abp/rivalScout.ts`).
|
| Regla de honestidad: un «?» siempre dice POR QUÉ, y un «*» siempre lleva el
| número. Lo que no se puede contrastar no se marca (salvo en los apartados
| que describen al rival, donde todo lo del anterior es de otro equipo).
*/

import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import {
  perfilDe,
  plantillaDe,
  resumenDe,
  sintesisDe,
  type JugadorEquipo,
  type MetricaEquipo,
  type PerfilColectivo,
  type ResumenEquipo,
} from "@/lib/data-analisis/equipo";
import {
  accionesDelScouting,
  construyeRivalAbp,
  eventosDelScouting,
  type RivalAbp,
} from "@/lib/abp/rivalAbp";
import type { ComparativaAbp } from "@/lib/abp/informe-graficos";
import { groupPatterns, type RivalScoutStore } from "@/lib/abp/rivalScout";
import { ASPECTO_BY_KEY, claveAspecto, type AspectoKey } from "@/lib/abp/microciclo";
import { mismoClub } from "@/lib/rivals/mismoClub";

/* ------------------------------------------------------------------ */
/*  QUÉ SE BOCETA                                                      */
/* ------------------------------------------------------------------ */

export const CAMPOS_BOCETO = [
  "ESTADO_EQUIPO",
  "CLAVES_PARTIDO",
  "CLAVES_EMOCIONALES",
  "ATAQUE",
  "DEFENSA",
  "ABP_OF",
  "ABP_DEF",
  "DUELOS_CB_FAVOR",
  "DUELOS_CB_CONTRA",
  "DUELOS_SB_FAVOR",
  "DUELOS_SB_CONTRA",
  "FORTALEZAS",
  "DEBILIDADES",
  "ESTRUCTURA_OF",
  "ESTRUCTURA_DEF",
] as const;

export type CampoBoceto = (typeof CAMPOS_BOCETO)[number];

export const TITULO_CAMPO: Record<CampoBoceto, string> = {
  ESTADO_EQUIPO: "Estado del equipo",
  CLAVES_PARTIDO: "Claves del partido",
  CLAVES_EMOCIONALES: "Claves emocionales",
  ATAQUE: "Con balón",
  DEFENSA: "Sin balón",
  ABP_OF: "ABP ofensivo",
  ABP_DEF: "ABP defensivo",
  DUELOS_CB_FAVOR: "Duelos con balón · ventaja",
  DUELOS_CB_CONTRA: "Duelos con balón · desventaja",
  DUELOS_SB_FAVOR: "Duelos sin balón · ventaja",
  DUELOS_SB_CONTRA: "Duelos sin balón · desventaja",
  FORTALEZAS: "Fortalezas del rival",
  DEBILIDADES: "Debilidades del rival",
  ESTRUCTURA_OF: "Estructuras ofensivas del rival",
  ESTRUCTURA_DEF: "Estructuras defensivas del rival",
};

/** Los apartados que describen al rival: lo del anterior es de otro equipo. */
const DESCRIBEN_AL_RIVAL: CampoBoceto[] = ["FORTALEZAS", "DEBILIDADES", "ESTRUCTURA_OF", "ESTRUCTURA_DEF"];

/** Los que la pantalla parte también por «;». */
const CON_PUNTO_Y_COMA: CampoBoceto[] = ["FORTALEZAS", "DEBILIDADES"];

export type Marca = "" | "?" | "*";

export type LineaBoceto = {
  texto: string;
  marca: Marca;
  /** El dato que justifica la marca (vacío si no hay marca). */
  motivo: string;
};

export type BocetoPlan = {
  rival: string;
  anterior: { jornada: string; equipo: string };
  campos: Record<CampoBoceto, LineaBoceto[]>;
  fuentes: string[];
  avisos: string[];
  /** Cuántas líneas llevan «?» y cuántas «*», para decirlo. */
  cuenta: { dudas: number; sugerencias: number };
};

export type EntradaBocetoPlan = {
  /** La fila del plan de la jornada anterior (la hoja RIVALES). */
  anterior: Record<string, string>;
  /** La fila del partido que se prepara. */
  actual: Record<string, string>;
  partidos: FilaPartido[];
  jugadores: FilaJugador[];
  comparativa: ComparativaAbp | null;
  scout: RivalScoutStore | null;
};

/* ------------------------------------------------------------------ */
/*  UTILIDADES                                                         */
/* ------------------------------------------------------------------ */

const NOSOTROS = /castilla/i;

const normaliza = (t: string) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const ordinal = (n: number) => `${n}.º`;

const cifra = (x: MetricaEquipo) => {
  const v = x.valor;
  const texto = Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1).replace(".", ",");
  return x.metrica.unidad === "porcentaje" ? `${texto} %` : texto;
};

/**
 * El nivel de un equipo en una métrica, de 0 a 100, con las de estilo
 * también: en ésas no hay «bueno», así que 100 es el que más y 0 el que
 * menos. Es lo que permite comparar dos rivales en cualquier cosa.
 */
const nivel = (x: MetricaEquipo) =>
  x.percentil ?? (x.de > 1 ? Math.round(100 * (1 - (x.puestoDeMas - 1) / (x.de - 1))) : 50);

/** «P72 (4.º de 20)» o, en las de estilo, «4.º de 20 por volumen». */
const sitio = (x: MetricaEquipo) =>
  x.percentil === null ? `${ordinal(x.puestoDeMas)} de ${x.de} por volumen` : `P${Math.round(x.percentil)} (${ordinal(x.puesto)} de ${x.de})`;

/** Un rótulo del plan («ATAQUE CP», «ÁREA»): mayúsculas y pocas palabras. No se juzga. */
const esRotulo = (linea: string) => {
  const t = linea.replace(/^[\d.\s)-]+/, "").trim();
  return t.length > 0 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t) && t.split(/\s+/).length <= 4;
};

/**
 * Los partidos de ESTA temporada de NUESTRO grupo: Wyscout trae desde 2021 y
 * los dos grupos de la categoría bajo el mismo nombre de competición, y un
 * percentil contra 71 equipos de cinco temporadas no dice nada del rival de
 * esta semana. El grupo se saca de los emparejamientos: quien ha jugado
 * contra alguien del grupo es del grupo.
 */
function partidosDelGrupo(partidos: FilaPartido[]) {
  const ultima = partidos.reduce((max, p) => (p.fecha > max ? p.fecha : max), "");
  if (!ultima) return [];
  const ano = Number(ultima.slice(0, 4)) - (Number(ultima.slice(5, 7)) >= 7 ? 0 : 1);
  const desde = `${ano}-07-01`;
  const temporada = partidos.filter((p) => p.fecha >= desde);
  const nuestro = temporada.find((p) => NOSOTROS.test(p.equipo));
  if (!nuestro) return temporada;
  const competicion = temporada.filter((p) => p.competicion === nuestro.competicion);
  const grupo = new Set<string>([nuestro.equipo]);
  let crece = true;
  while (crece) {
    crece = false;
    for (const p of competicion) {
      if (grupo.has(p.equipo) && !grupo.has(p.rival)) {
        grupo.add(p.rival);
        crece = true;
      }
    }
  }
  return competicion.filter((p) => grupo.has(p.equipo));
}

/** El nombre de Wyscout de un club tal y como lo escribe la hoja. */
function nombreWyscout(equipos: string[], nombre: string) {
  if (!nombre) return "";
  return equipos.find((e) => e === nombre) ?? equipos.find((e) => mismoClub(e, nombre)) ?? "";
}

function parteLineas(valor: unknown, puntoYComa: boolean) {
  const texto = String(valor ?? "");
  if (!texto.trim()) return [];
  return (puntoYComa ? texto.split(/[\n;]+/) : texto.split(/\r?\n+/))
    .map((linea) =>
      linea
        /* Un plan que ya fue boceto: se le quitan las marcas de entonces. */
        .replace(/^[\s•\-–·]*[?*]\s*/, "")
        .replace(/^[\s•\-–·]+/, "")
        .replace(/\s*\(dato: [^)]*\)\s*$/, "")
        .trim(),
    )
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  DE QUÉ HABLA CADA LÍNEA                                            */
/* ------------------------------------------------------------------ */

/**
 * Cada tema es una forma de escribir y las métricas de equipo que lo miden.
 * Si una línea del plan anterior habla de presión y el nuevo rival presiona
 * muy distinto del anterior, esa línea es la que hay que mirar.
 */
const TEMAS: { nombre: string; re: RegExp; metricas: string[]; abp?: boolean; sistema?: boolean }[] = [
  { nombre: "presión", re: /presi[oó]n|ppda|apret|robo|recuper|salida de bal[oó]n|sacar el bal[oó]n/i, metricas: ["ppda", "recuperacionesAltas", "recuperaciones", "perdidasBajas"] },
  { nombre: "posesión", re: /posesi[oó]n|circulaci|asociar|combinativ|toque|pausa/i, metricas: ["posesion", "pasesPorPosesion", "pasesPrecisos", "intensidadPase"] },
  { nombre: "transición", re: /contra|transici|vertical|espald|correr|carrera/i, metricas: ["contras", "contrasRemate", "perdidas", "cuotaProgresivos"] },
  { nombre: "centros", re: /centro|banda|lateral|extremo|amplitud|carril/i, metricas: ["centros", "centrosPrecisos"] },
  { nombre: "juego largo", re: /largo|directo|segunda jugada|segundas jugadas|despej/i, metricas: ["pasesLargos", "longitudPase", "duelosAereos"] },
  { nombre: "juego aéreo", re: /a[eé]re|cabez|altura|estatura/i, metricas: ["duelosAereos"] },
  { nombre: "finalización", re: /remat|finaliz|\bxg\b|ocasi|[aá]rea|definici/i, metricas: ["xg", "tiros", "toquesArea", "xgContra", "tirosContra"] },
  { nombre: "duelos", re: /duelo|1v1|1 v 1|uno contra uno|entrada|agresiv/i, metricas: ["duelosGanados", "duelosDefensivos", "duelosOfensivos", "entradas"] },
  { nombre: "progresión", re: /progres|profund|desmarq|entre l[ií]neas|pase interior/i, metricas: ["pasesProgresivos", "pasesProfundidad", "desmarques"] },
  { nombre: "ritmo", re: /horizontal|atr[aá]s|lento|ritmo|tempo/i, metricas: ["cuotaLaterales", "intensidadPase"] },
  { nombre: "disciplina", re: /tarjeta|amarilla|disciplin|falta/i, metricas: ["faltas", "amarillas"] },
  { nombre: "balón parado", re: /c[oó]rner|corner|bal[oó]n parado|balon parado|\babp\b|penalti|saque de banda|falta lateral|falta frontal/i, metricas: [], abp: true },
  { nombre: "sistema", re: /\b\d-\d(?:-\d){1,2}\b|sistema|dibujo|estructura|l[ií]nea de (?:3|4|5)|bloque/i, metricas: [], sistema: true },
];

type Contexto = {
  rival: string;
  anterior: string;
  perfil: PerfilColectivo | null;
  perfilAnterior: PerfilColectivo | null;
  resumen: ResumenEquipo | null;
  abp: RivalAbp | null;
  abpAnterior: RivalAbp | null;
  /** Apellidos de la plantilla del rival anterior, normalizados. */
  apellidosAnterior: string[];
  /** Palabras del nombre del rival anterior, normalizadas. */
  nombreAnterior: string[];
  cambiaCasa: boolean;
};

const metricaDe = (perfil: PerfilColectivo | null, key: string) => perfil?.metricas.find((x) => x.metrica.key === key) ?? null;

/** El aspecto de balón parado que más pesa de un lado, con su cifra. */
function dominante(abp: RivalAbp | null, lado: "ataca" | "concede") {
  if (!abp) return null;
  const [mejor] = (Object.entries(abp[lado]) as [AspectoKey, number][]).sort((a, b) => b[1] - a[1]);
  if (!mejor) return null;
  return {
    key: mejor[0],
    valor: mejor[1],
    label: ASPECTO_BY_KEY.get(mejor[0])?.label ?? mejor[0],
    motivo: abp.motivos[claveAspecto(mejor[0], lado === "ataca" ? "defensivo" : "ofensivo")] ?? "",
  };
}

/** ¿Habla esta línea de algo que en el nuevo rival es distinto? */
function juzga(linea: string, c: Contexto): { marca: Marca; motivo: string; tema: string | null } {
  const t = normaliza(linea);

  /* Nombra al rival anterior o a uno de sus jugadores: es de otro partido. */
  if (c.nombreAnterior.some((palabra) => t.includes(palabra))) {
    return { marca: "?", motivo: `habla del ${c.anterior}, el rival de la jornada pasada`, tema: "rival" };
  }
  const apellido = c.apellidosAnterior.find((a) => new RegExp(`(^|[^a-z])${a}([^a-z]|$)`).test(t));
  if (apellido) {
    return { marca: "?", motivo: `nombra a un jugador del ${c.anterior}`, tema: "jugador" };
  }

  if (c.cambiaCasa && /\bcasa\b|\bfuera\b|visitante|\blocal\b|viaje|afici|desplaz|estadio|nuestro campo|su campo/.test(t)) {
    return { marca: "?", motivo: "esta semana cambia dónde se juega", tema: "casa" };
  }

  for (const tema of TEMAS) {
    if (!tema.re.test(linea)) continue;

    if (tema.sistema) {
      const sistemaLinea = linea.match(/\b(\d-\d(?:-\d){1,2})\b/)?.[1];
      const principal = c.resumen?.sistemas[0];
      if (sistemaLinea && principal && !c.resumen?.sistemas.slice(0, 2).some((s) => s.sistema === sistemaLinea)) {
        return {
          marca: "?",
          motivo: `el ${c.rival} juega en ${principal.sistema} (${principal.partidos} de ${c.resumen?.partidos ?? 0} partidos)`,
          tema: tema.nombre,
        };
      }
      continue;
    }

    if (tema.abp) {
      const ahora = dominante(c.abp, "ataca");
      const antes = dominante(c.abpAnterior, "ataca");
      if (ahora && antes && (ahora.key !== antes.key || Math.abs(ahora.valor - antes.valor) >= 0.25)) {
        return { marca: "?", motivo: `a balón parado el ${c.rival} destaca en ${ahora.label.toLowerCase()}${ahora.motivo ? `: ${ahora.motivo}` : ""}`, tema: tema.nombre };
      }
      if (ahora && !antes && ahora.valor >= 0.7) {
        return { marca: "?", motivo: `a balón parado el ${c.rival} destaca en ${ahora.label.toLowerCase()}${ahora.motivo ? `: ${ahora.motivo}` : ""}`, tema: tema.nombre };
      }
      continue;
    }

    /* De las métricas del tema, la que más cambia entre los dos rivales. */
    let mayor: { ahora: MetricaEquipo; antes: MetricaEquipo; salto: number } | null = null;
    for (const key of tema.metricas) {
      const ahora = metricaDe(c.perfil, key);
      const antes = metricaDe(c.perfilAnterior, key);
      if (!ahora || !antes) continue;
      const salto = Math.abs(nivel(ahora) - nivel(antes));
      if (salto >= 25 && (!mayor || salto > mayor.salto)) mayor = { ahora, antes, salto };
    }
    if (mayor) {
      return {
        marca: "?",
        motivo: `${mayor.ahora.metrica.nombre}: el ${c.rival} ${cifra(mayor.ahora)}, ${sitio(mayor.ahora)}; el ${c.anterior} ${cifra(mayor.antes)}, ${sitio(mayor.antes)}`,
        tema: tema.nombre,
      };
    }

    /* Sin rival anterior en los datos: sólo si el nuevo está en un extremo. */
    if (!c.perfilAnterior) {
      for (const key of tema.metricas) {
        const ahora = metricaDe(c.perfil, key);
        if (!ahora) continue;
        const n = nivel(ahora);
        if (n <= 25 || n >= 75) {
          return { marca: "?", motivo: `${ahora.metrica.nombre}: el ${c.rival} ${cifra(ahora)}, ${sitio(ahora)}`, tema: tema.nombre };
        }
      }
    }

    /* Hay dato y se parece: la línea vale igual. */
    const comparada = tema.metricas.map((k) => metricaDe(c.perfil, k)).find(Boolean);
    if (comparada) return { marca: "", motivo: `${comparada.metrica.nombre}: ${cifra(comparada)}, ${sitio(comparada)}, parecido al rival anterior`, tema: tema.nombre };
  }

  return { marca: "", motivo: "", tema: null };
}

/* ------------------------------------------------------------------ */
/*  LO QUE LOS DATOS PROPONEN AÑADIR                                   */
/* ------------------------------------------------------------------ */

type Sugerencia = { campo: CampoBoceto; texto: string };

const PORTEROS = /^(GK)/i;
const DEFENSAS = /^(CB|LCB|RCB|LB|RB|LWB|RWB|DMF|LDMF|RDMF)/i;

function sugiere(c: Contexto, plantilla: JugadorEquipo[], nosotros: { resumen: ResumenEquipo | null; perfil: PerfilColectivo | null }, patrones: ReturnType<typeof groupPatterns>, actual: Record<string, string>): Sugerencia[] {
  const s: Sugerencia[] = [];
  const { rival, perfil, resumen, abp } = c;
  const m = (key: string) => metricaDe(perfil, key);
  const con = (campo: CampoBoceto, texto: string) => s.push({ campo, texto });

  /* ---------------- el rival, descrito ---------------- */
  for (const x of perfil?.fuertes.slice(0, 3) ?? []) con("FORTALEZAS", `${x.metrica.nombre}: ${cifra(x)} (${sitio(x)} en la categoría)`);
  for (const x of perfil?.flojos.slice(0, 3) ?? []) con("DEBILIDADES", `${x.metrica.nombre}: ${cifra(x)} (${sitio(x)} en la categoría)`);

  const goleador = [...plantilla].sort((a, b) => b.goles - a.goles)[0];
  if (goleador && goleador.goles > 0) con("FORTALEZAS", `Su goleador: ${goleador.fila.jugador} (${goleador.goles} ${goleador.goles === 1 ? "gol" : "goles"})`);

  const ataca = dominante(abp, "ataca");
  if (ataca && ataca.valor >= 0.6) con("FORTALEZAS", `A balón parado: ${ataca.label.toLowerCase()}${ataca.motivo ? ` — ${ataca.motivo}` : ""}`);
  const concede = dominante(abp, "concede");
  if (concede && concede.valor >= 0.6) con("DEBILIDADES", `A balón parado concede: ${concede.label.toLowerCase()}${concede.motivo ? ` — ${concede.motivo}` : ""}`);

  if (resumen?.sistemas[0]) {
    const [p, alt] = resumen.sistemas;
    con("ESTRUCTURA_OF", `Sistema: ${p.sistema} (${p.partidos} de ${resumen.partidos} partidos)${alt ? `; alternativa ${alt.sistema} (${alt.partidos})` : ""}`);
  }
  for (const key of ["posesion", "pasesLargos", "centros", "contras", "cuotaProgresivos"]) {
    const x = m(key);
    if (x && (nivel(x) <= 30 || nivel(x) >= 70)) con("ESTRUCTURA_OF", `${x.metrica.nombre}: ${cifra(x)} (${sitio(x)})`);
  }
  const ppda = m("ppda");
  if (ppda) {
    const n = nivel(ppda);
    con("ESTRUCTURA_DEF", `Presión: PPDA ${cifra(ppda)} (${n >= 60 ? "de los que más presionan" : n <= 40 ? "de los que menos presionan" : "en la media"}, ${sitio(ppda)})`);
  }
  for (const key of ["recuperacionesAltas", "xgContra", "tirosContra", "duelosDefensivos"]) {
    const x = m(key);
    if (x && (nivel(x) <= 30 || nivel(x) >= 70)) con("ESTRUCTURA_DEF", `${x.metrica.nombre}: ${cifra(x)} (${sitio(x)})`);
  }

  /* ---------------- nuestro plan con balón: por dónde se le hace daño ---------------- */
  if (ppda) {
    const n = nivel(ppda);
    if (n <= 40) con("ATAQUE", `Salida en corto con calma: el ${rival} presiona poco (PPDA ${cifra(ppda)}, ${sitio(ppda)})`);
    if (n >= 60) con("ATAQUE", `Preparar la salida ante su presión alta (PPDA ${cifra(ppda)}, ${sitio(ppda)}): balón a la espalda y tercer hombre`);
  }
  const aereos = m("duelosAereos");
  if (aereos && nivel(aereos) <= 40) con("ATAQUE", `Juego directo y segundas jugadas: pierde duelos aéreos (${cifra(aereos)}, ${sitio(aereos)})`);
  const xgc = m("xgContra");
  if (xgc && nivel(xgc) <= 40) con("ATAQUE", `Llegar al área con gente: concede ${cifra(xgc)} xG por partido (${sitio(xgc)})`);
  const entradas = m("entradas");
  if (entradas && nivel(entradas) <= 40) con("ATAQUE", `Encarar en el 1v1: logra el ${cifra(entradas)} de sus entradas (${sitio(entradas)})`);
  const intercepta = m("interceptaciones");
  if (intercepta && nivel(intercepta) <= 40) con("ATAQUE", `Pase interior y entre líneas: intercepta poco (${cifra(intercepta)} por partido, ${sitio(intercepta)})`);
  const altas = m("recuperacionesAltas");
  if (altas && nivel(altas) <= 40) con("ATAQUE", `Su presión no llega arriba: recupera el ${cifra(altas)} en campo rival (${sitio(altas)})`);

  /* ---------------- nuestro plan sin balón: qué hay que defender ---------------- */
  const contras = m("contras");
  if (contras && nivel(contras) >= 60) con("DEFENSA", `Vigilancias en transición: ${cifra(contras)} contraataques por partido (${sitio(contras)})`);
  const centros = m("centros");
  if (centros && nivel(centros) >= 60) con("DEFENSA", `Defender el centro lateral: ${cifra(centros)} centros por partido (${sitio(centros)})`);
  const largos = m("pasesLargos");
  if (largos && nivel(largos) >= 60) con("DEFENSA", `Duelos aéreos y segundas jugadas: juego largo ${cifra(largos)} (${sitio(largos)})`);
  const posesion = m("posesion");
  if (posesion && nivel(posesion) >= 65) con("DEFENSA", `Bloque ordenado y paciencia: posesión ${cifra(posesion)} (${sitio(posesion)})`);
  const xg = m("xg");
  if (xg && nivel(xg) >= 60) con("DEFENSA", `Cerrar el área: genera ${cifra(xg)} xG por partido (${sitio(xg)})`);
  const pierde = m("perdidasBajas");
  if (pierde && nivel(pierde) <= 40) con("DEFENSA", `Presionar su salida: pierde el ${cifra(pierde)} de sus balones en campo propio (${sitio(pierde)})`);
  if (goleador && goleador.goles >= 2) con("DEFENSA", `Vigilancia a ${goleador.fila.jugador} (${goleador.goles} goles)`);

  /* ---------------- balón parado ---------------- */
  if (abp) {
    const top = (lado: "ataca" | "concede") =>
      (Object.entries(abp[lado]) as [AspectoKey, number][])
        .filter(([, v]) => v >= 0.55)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);
    for (const [key] of top("concede")) {
      const motivo = abp.motivos[claveAspecto(key, "ofensivo")];
      con("ABP_OF", `${ASPECTO_BY_KEY.get(key)?.label ?? key}: ${motivo || "concede por encima de la media"}`);
    }
    for (const [key] of top("ataca")) {
      const motivo = abp.motivos[claveAspecto(key, "defensivo")];
      con("ABP_DEF", `${ASPECTO_BY_KEY.get(key)?.label ?? key}: ${motivo || "lo usa por encima de la media"}`);
    }
  }
  for (const p of [...patrones].sort((a, b) => b.veces - a.veces).slice(0, 3)) {
    if (p.veces < 2) continue;
    const campo: CampoBoceto = p.condicion === "ofensivo" ? "ABP_DEF" : "ABP_OF";
    con(campo, `Patrón visto en vídeo: ${p.patron} (${p.veces} veces, ${p.peligro} con peligro${p.rematadores.length ? `; remata ${p.rematadores.slice(0, 2).join(" / ")}` : ""})`);
  }

  /* ---------------- duelos: quién destaca y quién flojea ---------------- */
  const conMinutos = plantilla.filter((j) => j.indice !== null && j.fila.minutos >= 180 && !PORTEROS.test(j.fila.posicion));
  const porIndice = [...conMinutos].sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0));
  const describe = (j: JugadorEquipo, lista: JugadorEquipo["destaca"]) =>
    `${j.fila.jugador} (${j.fila.posicion.split(",")[0]}, índice ${j.indice})${lista.length ? `: ${lista.slice(0, 2).map((d) => `${d.metrica.nombre} P${d.percentil}`).join(", ")}` : ""}`;
  for (const j of porIndice.filter((j) => !DEFENSAS.test(j.fila.posicion)).slice(0, 3)) con("DUELOS_CB_CONTRA", describe(j, j.destaca));
  for (const j of [...porIndice].reverse().filter((j) => DEFENSAS.test(j.fila.posicion)).slice(0, 2)) con("DUELOS_CB_FAVOR", describe(j, j.flojea));
  for (const j of porIndice.filter((j) => DEFENSAS.test(j.fila.posicion)).slice(0, 2)) con("DUELOS_SB_CONTRA", describe(j, j.destaca));
  for (const j of [...porIndice].reverse().filter((j) => !DEFENSAS.test(j.fila.posicion)).slice(0, 2)) con("DUELOS_SB_FAVOR", describe(j, j.flojea));

  /* ---------------- claves ---------------- */
  if (resumen && perfil) {
    for (const frase of sintesisDe(rival, resumen, perfil, plantilla).slice(0, 2)) con("CLAVES_PARTIDO", frase);
  }
  if (abp?.resumen) con("CLAVES_PARTIDO", `A balón parado, ${abp.resumen}`);
  if (resumen?.forma.length) {
    con(
      "CLAVES_EMOCIONALES",
      `El ${rival} llega con ${resumen.forma.map((f) => f.resultado).join("-")} en sus últimos ${resumen.forma.length} (${resumen.forma.map((f) => `${f.marcador} ${f.casa ? "vs" : "en"} ${f.rival}`).join(", ")})`,
    );
  }
  const donde = String(actual.LOCAL_VISITANTE ?? "").trim();
  if (donde) con("CLAVES_EMOCIONALES", `Esta jornada: ${donde}`);

  /* ---------------- nosotros ---------------- */
  if (nosotros.resumen?.partidos) {
    const r = nosotros.resumen;
    con("ESTADO_EQUIPO", `Nosotros: ${r.g}G ${r.e}E ${r.p}P, últimos ${r.forma.length}: ${r.forma.map((f) => f.resultado).join("-")}${r.tabla ? ` (${ordinal(r.tabla.puesto)} de ${r.tabla.de} por puntos por partido)` : ""}`);
  }
  for (const key of ["golesMenosXg", "xg", "xgContra"]) {
    const x = metricaDe(nosotros.perfil, key);
    if (x) con("ESTADO_EQUIPO", `${x.metrica.nombre}: ${cifra(x)} (${sitio(x)})`);
  }

  return s;
}

/* ------------------------------------------------------------------ */
/*  EL BOCETO                                                          */
/* ------------------------------------------------------------------ */

/** Dos líneas que dicen lo mismo: comparten dos palabras largas o más. */
function parecidas(a: string, b: string) {
  const palabras = (t: string) => new Set(normaliza(t).split(/[^a-z0-9]+/).filter((p) => p.length >= 5));
  const pa = palabras(a);
  let comunes = 0;
  for (const p of palabras(b)) if (pa.has(p)) comunes += 1;
  return comunes >= 2;
}

export function construyeBocetoPlan(entrada: EntradaBocetoPlan): BocetoPlan {
  const { anterior, actual, partidos, jugadores, comparativa, scout } = entrada;

  const rival = String(actual.EQUIPO ?? "").trim();
  const rivalAnterior = String(anterior.EQUIPO ?? "").trim();

  const deLiga = partidosDelGrupo(partidos);
  const equipos = [...new Set(deLiga.map((p) => p.equipo))];
  const rivalW = nombreWyscout(equipos, rival);
  const anteriorW = nombreWyscout(equipos, rivalAnterior);
  const nosotrosW = equipos.find((e) => NOSOTROS.test(e)) ?? "";

  const fuentes: string[] = [];
  const avisos: string[] = [];

  const perfil = rivalW ? perfilDe(rivalW, deLiga) : null;
  const resumen = rivalW ? resumenDe(rivalW, deLiga, deLiga) : null;
  const plantilla = rivalW ? plantillaDe(rivalW, jugadores) : [];
  const perfilAnterior = anteriorW ? perfilDe(anteriorW, deLiga) : null;
  const plantillaAnterior = anteriorW ? plantillaDe(anteriorW, jugadores) : [];
  const nosotros = {
    resumen: nosotrosW ? resumenDe(nosotrosW, deLiga, deLiga) : null,
    perfil: nosotrosW ? perfilDe(nosotrosW, deLiga) : null,
  };

  if (perfil && resumen) fuentes.push(`Wyscout: ${resumen.partidos} partidos del ${rivalW} esta temporada, contra los ${perfil.equipos} equipos del grupo`);
  else avisos.push(`No hay informes de Wyscout del ${rival || "rival"}: sin ellos no se puede contrastar el juego ni proponer nada del juego.`);
  if (!anteriorW && rivalAnterior) avisos.push(`El ${rivalAnterior} no está en Wyscout: las líneas sobre el juego se comparan sólo con la liga.`);

  const acciones = accionesDelScouting(scout, rival);
  const abp = rival
    ? construyeRivalAbp({ equipo: rival, comparativa, events: [], scouting: eventosDelScouting(rival, acciones) })
    : null;
  const abpAnterior = rivalAnterior ? construyeRivalAbp({ equipo: rivalAnterior, comparativa, events: [] }) : null;
  if (abp) fuentes.push(...abp.fuentes.map((f) => `Balón parado: ${f}`));
  const patrones = groupPatterns(acciones);
  if (acciones.length && !abp?.fuentes.some((f) => f.includes("scouting"))) {
    fuentes.push(`Scouting en vídeo: ${acciones.length} ${acciones.length === 1 ? "acción registrada" : "acciones registradas"} del ${rival}`);
  }

  const contexto: Contexto = {
    rival: rivalW || rival,
    anterior: anteriorW || rivalAnterior || "rival anterior",
    perfil,
    perfilAnterior,
    resumen,
    abp,
    abpAnterior,
    apellidosAnterior: plantillaAnterior
      .map((j) => normaliza(j.fila.jugador).split(/\s+/).filter((p) => p.length >= 4).pop() ?? "")
      .filter((a) => a.length >= 4),
    nombreAnterior: normaliza(rivalAnterior)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 5 && !["club", "deportivo", "atletico", "union", "sociedad", "futbol", "balompie", "sporting", "racing"].includes(p)),
    cambiaCasa:
      Boolean(String(anterior.LOCAL_VISITANTE ?? "").trim()) &&
      Boolean(String(actual.LOCAL_VISITANTE ?? "").trim()) &&
      normaliza(anterior.LOCAL_VISITANTE ?? "") !== normaliza(actual.LOCAL_VISITANTE ?? ""),
  };

  const campos = {} as Record<CampoBoceto, LineaBoceto[]>;
  let dudas = 0;

  for (const campo of CAMPOS_BOCETO) {
    const lineas = parteLineas(anterior[campo], CON_PUNTO_Y_COMA.includes(campo));
    campos[campo] = lineas.map((texto) => {
      if (esRotulo(texto)) return { texto, marca: "" as const, motivo: "" };
      if (campo === "ESTADO_EQUIPO") {
        dudas += 1;
        return { texto, marca: "?" as const, motivo: "el estado del equipo cambia cada semana: lesionados, sanciones, cargas" };
      }
      const juicio = juzga(texto, contexto);
      if (juicio.marca === "?") {
        dudas += 1;
        return { texto, marca: "?" as const, motivo: juicio.motivo };
      }
      if (DESCRIBEN_AL_RIVAL.includes(campo) && !juicio.tema) {
        dudas += 1;
        return { texto, marca: "?" as const, motivo: `describe al ${contexto.anterior}: no hay dato que lo confirme para el ${contexto.rival}` };
      }
      return { texto, marca: "" as const, motivo: juicio.motivo };
    });
  }

  let sugerencias = 0;
  for (const s of sugiere(contexto, plantilla, nosotros, patrones, actual)) {
    const lista = campos[s.campo];
    if (lista.some((l) => parecidas(l.texto, s.texto))) continue;
    lista.push({ texto: s.texto, marca: "*", motivo: "" });
    sugerencias += 1;
  }

  return {
    rival,
    anterior: { jornada: String(anterior.JORNADA ?? ""), equipo: rivalAnterior },
    campos,
    fuentes,
    avisos,
    cuenta: { dudas, sugerencias },
  };
}

/** Cómo se escribe el boceto en los campos del plan: «? …(dato: …)» y «* …». */
export function textoDelBoceto(lineas: LineaBoceto[]) {
  return lineas
    .map((l) => {
      if (l.marca === "?") return `? ${l.texto}${l.motivo ? ` (dato: ${l.motivo})` : ""}`;
      if (l.marca === "*") return `* ${l.texto}`;
      return l.texto;
    })
    .join("\n");
}
