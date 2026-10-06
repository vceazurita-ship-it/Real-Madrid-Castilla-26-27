/**
 * EL INFORME DEL PARTIDO: DE DÓNDE SALE CADA COSA (navegador).
 *
 * Todo se pide en paralelo y nada tumba el informe: lo que no llega se apunta
 * en `avisos` y la sección no sale. Las fuentes, en el orden del informe:
 *
 *   - microciclo ........ hoja de registro de tareas (`loadRegistro`)
 *   - partido ........... `castilla:calendario` (BeSoccer)
 *   - datos ............. `/api/data-analisis?duelo=` (Wyscout)
 *   - plan y colectivo .. hoja RIVALES (`action=rivales`) + `scout-rival-colectivo-extra`
 *   - plantilla ......... `action=rivalesPlantillas` + `rivals:stats`
 *   - once .............. `rival-once:<equipo>` (el marcado) o su último once (`rivals:informe`)
 *   - contexto .......... `rivals:informe` (clasificación, racha, goleadores)
 *   - ABP ............... `rival-analisis:<equipo>` y `rival-analisis-clips:<equipo>`
 */

import { esTareaAbp, loadRegistro, type RegistroTarea } from "@/lib/abp/registro";
import { comoNuestro, soloDia, type PartidoNuestro } from "@/lib/castilla/calendario";
import { traeJson } from "@/lib/hojaCsv";
import { analisisKey, clipsKey, laminaVacia, normalizaAnalisis, ordenJornada } from "@/lib/rivals/analisis";
import { esLiga, findInforme, type InformeDoc, type InformeEquipo, type OncePartido } from "@/lib/rivals/informe";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { normalizaDocumentos, rivalDocumentosKey, ROTULO_DOCUMENTO } from "@/lib/rivals/documentos";
import { normalizarMedia, rivalMediaKey } from "@/lib/rivals/media";
import { normalizarOnce, playerKey, rivalOnceKey } from "@/lib/rivals/once";
import { reparteCampo, type OnceLinea } from "@/lib/rivals/once-campo";
import { cargaPlantilla } from "@/hooks/usePlayers";
import { duelosYVistazo } from "@/lib/informe-partido/rival-datos";
import { CONCLUSIONES, SECTIONS } from "@/lib/rivals/scout-colectivo-campos";
import { findStats, highlightSeason, type RivalStatsDoc } from "@/lib/rivals/stats";
import { fraseUtil, mismoJugador, pronostica, type Cronica } from "./modelo";
import type { PartidoBeSoccer } from "@/lib/quiniela/besoccer";

import {
  enFrases,
  sintetiza,
  type Colectivo,
  type ContextoRival,
  type Duelo,
  type InformePartido,
  type JugadorRival,
  type Microciclo,
  type Momento,
  type Plan,
} from "./modelo";

type Fila = Record<string, unknown>;

const texto = (v: unknown) => String(v ?? "").trim();

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));

  return Number.isFinite(n) ? n : 0;
};

async function doc<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent(key)}`, { cache: "no-store" });

    const j = (await r.json()) as { data?: T | null };

    return j?.data ?? null;
  } catch {
    return null;
  }
}

/** «2026-09-28» desde lo que escriba la hoja («28/09/2026» o ISO). */
function isoDeHoja(valor: string) {
  const m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  return /^\d{4}-\d{2}-\d{2}/.test(valor) ? valor.slice(0, 10) : "";
}

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const etiquetaDe = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);

  return Number.isNaN(d.getTime()) ? iso : `${DIAS_CORTOS[d.getDay()]} ${d.getDate()}`;
};

export function fechaLarga(cuando: string) {
  const d = new Date(cuando);

  if (Number.isNaN(d.getTime())) return "";

  const dia = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });

  const hora = /T\d{2}:\d{2}/.test(cuando)
    ? d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })
    : "";

  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}${hora ? ` · ${hora}` : ""}`;
}

/* ------------------------------------------------------------------ */
/*  EL MICROCICLO                                                      */
/* ------------------------------------------------------------------ */

function microDe(tareas: RegistroTarea[], temporada: string, micro: number, rival: string): Microciclo | null {
  const suyas = tareas.filter((t) => t.temporada === temporada && t.micro === micro);

  if (!suyas.length) return null;

  const porDia = new Map<string, RegistroTarea[]>();

  for (const t of suyas) {
    const f = isoDeHoja(t.fecha) || t.dia;

    porDia.set(f, [...(porDia.get(f) ?? []), t]);
  }

  const dias = [...porDia.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, lista]) => ({
      fecha,
      etiqueta: etiquetaDe(fecha),
      md: lista.find((t) => t.md)?.md ?? "",
      tareas: lista.length,
      minutos: Math.round(lista.reduce((s, t) => s + t.tiempo, 0)),
      carga: Math.round(lista.reduce((s, t) => s + (t.carga || t.tiempo * t.intensidad), 0)),
      contenidos: [...new Set(lista.map((t) => t.contenidoPrincipal).filter(Boolean))].slice(0, 4),
      esPartido: lista.some((t) => /comp|partido/i.test(`${t.tarea} ${t.tipoTarea}`) || /^MD$/i.test(t.md.trim())),
    }));

  const sumaPor = (clave: (t: RegistroTarea) => string) => {
    const m = new Map<string, number>();

    for (const t of suyas) {
      const k = clave(t).trim();

      if (k) m.set(k, (m.get(k) ?? 0) + t.tiempo);
    }

    return [...m].map(([nombre, minutos]) => ({ nombre, minutos: Math.round(minutos) })).sort((a, b) => b.minutos - a.minutos);
  };

  const valoradas = suyas.filter((t) => t.evaluacion > 0);

  return {
    micro,
    temporada,
    rival,
    dias,
    tareas: suyas
      .slice()
      .sort((a, b) => (isoDeHoja(a.fecha) || "").localeCompare(isoDeHoja(b.fecha) || ""))
      .map((t) => ({
        fecha: isoDeHoja(t.fecha),
        dia: etiquetaDe(isoDeHoja(t.fecha)),
        md: t.md,
        tarea: t.tarea,
        tipo: t.tipoTarea,
        fase: t.fase,
        contenido: t.contenidoPrincipal,
        secundario: t.contenidoSecundario,
        formato: t.formato,
        minutos: Math.round(t.tiempo),
        intensidad: t.intensidad,
        evaluacion: t.evaluacion,
        analisis: t.analisisPost,
      })),
    totales: {
      tareas: suyas.length,
      minutos: Math.round(suyas.reduce((s, t) => s + t.tiempo, 0)),
      carga: Math.round(suyas.reduce((s, t) => s + (t.carga || t.tiempo * t.intensidad), 0)),
      abpMinutos: Math.round(suyas.filter(esTareaAbp).reduce((s, t) => s + t.tiempo, 0)),
      valoradas: valoradas.length,
      valoracionMedia: valoradas.length
        ? Math.round((valoradas.reduce((s, t) => s + t.evaluacion, 0) / valoradas.length) * 10) / 10
        : null,
    },
    contenidos: sumaPor((t) => t.contenidoPrincipal).slice(0, 8),
    fases: sumaPor((t) => t.fase).slice(0, 6),
  };
}

/** El partido del micro: el primero del calendario desde el último día con tareas. */
function partidoDelMicro(partidos: PartidoBeSoccer[], tareas: RegistroTarea[], rival: string): PartidoNuestro | null {
  const nuestros = partidos.map(comoNuestro).filter((p) => p.cuando);

  const fechas = tareas.map((t) => isoDeHoja(t.fecha)).filter(Boolean).sort();

  const ultimo = fechas[fechas.length - 1];

  if (ultimo) {
    const siguiente = nuestros
      .filter((p) => soloDia(p.cuando) >= ultimo)
      .sort((a, b) => a.cuando.localeCompare(b.cuando))[0];

    /* Un partido a más de diez días no es el de esta semana. */
    if (siguiente && Date.parse(soloDia(siguiente.cuando)) - Date.parse(ultimo) <= 10 * 86_400_000) return siguiente;
  }

  return nuestros.filter((p) => mismoClub(p.rival, rival)).sort((a, b) => b.cuando.localeCompare(a.cuando))[0] ?? null;
}

/* ------------------------------------------------------------------ */
/*  EL RIVAL                                                           */
/* ------------------------------------------------------------------ */

/** «2026-10-02» → «2026-10-01». */
const diaAnterior = (dia: string) => new Date(Date.parse(`${dia}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

const LINEA = (posicion: string): JugadorRival["linea"] => {
  const p = posicion.toUpperCase();

  if (/PORTER/.test(p)) return "POR";
  if (/LATERAL|CENTRAL|DEFENS|CARRILERO/.test(p)) return "DEF";
  if (/MEDIO|PIVOTE|INTERIOR|MEDIAPUNTA|VOLANTE/.test(p)) return "MED";
  if (/DELANTER|EXTREMO|PUNTA|ATAC/.test(p)) return "DEL";

  return "";
};

function jugadorDe(fila: Fila, stats: RivalStatsDoc | null): JugadorRival {
  const temporada = (() => {
    const s = findStats(stats, fila as never);

    return s ? highlightSeason(s.temporadas, stats?.temporada) : null;
  })();

  const posicion = texto(fila["POSICIÓN"]);

  return {
    clave: playerKey(fila as never),
    nombre: texto(fila["NOMBRE DEPORTIVO"]) || texto(fila.JUGADOR),
    dorsal: texto(fila.DORSAL),
    posicion,
    linea: LINEA(posicion),
    foto: texto(fila.FOTO),
    pie: texto(fila["PIE DOMINANTE"]),
    altura: texto(fila.ALTURA),
    edad: texto(fila.EDAD),
    rasgos: texto(fila.IMPACTO)
      .split(/;|\n/)
      .map((t) => t.trim())
      .filter(Boolean),
    caracteristicas: texto(fila["CARACTERÍSTICAS"]),
    fortalezas: texto(fila.FORTALEZAS),
    debilidades: texto(fila.DEBILIDADES),
    rol: texto(fila.ROL),
    goles: temporada?.goles ?? null,
    asistencias: temporada?.asistencias ?? null,
    partidos: temporada?.partidos ?? null,
    minutos: temporada?.minutos ?? null,
  };
}

const LINEA_ONCE: Record<string, OnceLinea> = { POR: "portero", DEF: "defensa", MED: "medio", DEL: "ataque" };

/** El código con banda que entiende `reparteCampo` (LI, EI, LD, ED); el resto, por dentro. */
function codigoDeLado(posicion: string) {
  const p = posicion.toUpperCase();

  const izquierda = /IZQ/.test(p);
  const derecha = /DCH|DER/.test(p);

  if (/LATERAL|CARRILERO/.test(p)) return izquierda ? "LI" : derecha ? "LD" : "";
  if (/EXTREMO|BANDA/.test(p)) return izquierda ? "EI" : derecha ? "ED" : "";

  return "";
}

/** Un once de BeSoccer con las fichas de la hoja (por nombre: BeSoccer no lleva el id de la foto). */
function jugadoresDeOnce(once: OncePartido, plantilla: JugadorRival[]): JugadorRival[] {
  return [...once.jugadores].sort((a, b) => (a.puesto || 99) - (b.puesto || 99)).map((uno) => {
    const enHoja = plantilla.find((j) => mismoJugador(j.nombre, uno.nombre));

    const linea: JugadorRival["linea"] =
      uno.demarcacion === "PT" ? "POR" : uno.demarcacion === "DF" ? "DEF" : uno.demarcacion === "MC" ? "MED" : uno.demarcacion === "DL" ? "DEL" : "";

    return enHoja
      ? { ...enHoja, linea: linea || enHoja.linea }
      : ({
          clave: `once:${uno.nombre}`,
          nombre: uno.nombre,
          dorsal: uno.dorsal,
          posicion: "",
          linea,
          foto: uno.foto,
          pie: "",
          altura: "",
          edad: "",
          rasgos: [],
          caracteristicas: "",
          fortalezas: "",
          debilidades: "",
          rol: "",
          goles: null,
          asistencias: null,
          partidos: null,
          minutos: null,
        } satisfies JugadorRival);
  });
}

/** Post: el partido contado con lo que BeSoccer guarda del rival. */
function cronicaDe(informe: InformeEquipo | null, partido: PartidoNuestro | null, plantilla: JugadorRival[], previsto: JugadorRival[]): Cronica | null {
  if (!informe || !partido?.jugado) return null;

  const dia = soloDia(partido.cuando);

  const bs = informe.partidos.find((p) => p.jugado && soloDia(p.fecha) === dia);

  if (!bs) return null;

  const suOnce = informe.onces.find((o) => o.partidoId === bs.id) ?? null;

  const onceReal = suOnce ? colocaPorDibujo(jugadoresDeOnce(suOnce, plantilla), suOnce.estructura) : [];

  /* «propio» es del equipo del informe —el rival—: los demás son nuestros. */
  const goles = (bs.goles ?? []).map((g) => ({
    minuto: g.minuto,
    jugador: g.jugador,
    asistente: g.asistente ?? "",
    tipo: g.tipo,
    nuestro: !g.propio,
  }));

  const acierto =
    previsto.length && onceReal.length
      ? {
          acertados: onceReal.filter((r) => previsto.some((p) => p.clave === r.clave || mismoJugador(p.nombre, r.nombre))).length,
          total: onceReal.length,
          noSalieron: previsto.filter((p) => !onceReal.some((r) => p.clave === r.clave || mismoJugador(p.nombre, r.nombre))).map((p) => p.nombre),
          sorpresas: onceReal.filter((r) => !previsto.some((p) => p.clave === r.clave || mismoJugador(p.nombre, r.nombre))).map((r) => r.nombre),
        }
      : null;

  return {
    goles,
    estructura: suOnce?.estructura ?? "",
    onceReal,
    acierto,
    cambios: (suOnce?.cambios ?? []).map((c) => ({ minuto: c.minuto, sale: c.sale, entra: c.entra })),
    tarjetas: (suOnce?.tarjetas ?? []).map((t) => ({ minuto: t.minuto, jugador: t.jugador, tipo: t.tipo })),
  };
}

/** Izquierda 0, centro 1, derecha 2, por lo que diga la ficha de la hoja. */
const ladoDe = (j: JugadorRival) => {
  const c = codigoDeLado(j.posicion);

  return c === "LI" || c === "EI" ? 0 : c === "LD" || c === "ED" ? 2 : 1;
};

/**
 * Un once de BeSoccer con su dibujo: viene ordenado de la portería a la
 * delantera, así que «1-4-3-3» es cortarlo en 1, 4, 3 y 3. La demarcación de
 * cada uno no vale para esto: BeSoccer llama delantero a un extremo y medio a
 * otro, y un 1-4-3-3 salía dibujado como un 4-4-2.
 */
function colocaPorDibujo(once: JugadorRival[], estructura: string) {
  const lineas = (estructura.match(/\d+/g) ?? []).map(Number);

  if (lineas.reduce((a, b) => a + b, 0) !== once.length || lineas.length < 3) return colocaPorLineas(once);

  let desde = 0;

  lineas.forEach((cuantos, i) => {
    const linea = once
      .slice(desde, desde + cuantos)
      .map((j, orden) => ({ j, orden }))
      .sort((a, b) => ladoDe(a.j) - ladoDe(b.j) || a.orden - b.orden)
      .map((x) => x.j);

    desde += cuantos;

    /* La portería abajo y el resto de líneas repartidas hasta el ataque. */
    const y = i === 0 ? 0.06 : 0.3 + ((i - 1) / Math.max(1, lineas.length - 2)) * 0.55;

    linea.forEach((j, k) => {
      j.x = (k + 1) / (linea.length + 1);
      j.y = y;
    });
  });

  return once;
}

/** Coloca un once por líneas cuando nadie lo ha dibujado (portería abajo, ataque arriba). */
function colocaPorLineas(once: JugadorRival[]) {
  const filas: Record<string, JugadorRival[]> = { POR: [], DEF: [], MED: [], DEL: [], "": [] };

  for (const j of once) filas[j.linea || ""].push(j);

  /* Los que no se sabe dónde van, al medio. */
  filas.MED.push(...filas[""]);

  const alturas: Record<string, number> = { POR: 0.06, DEF: 0.3, MED: 0.58, DEL: 0.85 };

  for (const linea of ["POR", "DEF", "MED", "DEL"]) {
    const lista = filas[linea];

    lista.forEach((j, i) => {
      j.x = (i + 1) / (lista.length + 1);
      j.y = alturas[linea];
    });
  }

  return once;
}

function planDe(fila: Fila | null): Plan | null {
  if (!fila) return null;

  const plan: Plan = {
    claves: enFrases(texto(fila.CLAVES_PARTIDO) || texto(fila.PLAN_PARTIDO), 5),
    ataque: texto(fila.ATAQUE),
    defensa: texto(fila.DEFENSA),
    abpOf: texto(fila.ABP_OF),
    abpDef: texto(fila.ABP_DEF),
    emocionales: texto(fila.CLAVES_EMOCIONALES),
    estado: texto(fila.ESTADO_EQUIPO),
    estructuraOf: texto(fila.ESTRUCTURA_OF),
    estructuraDef: texto(fila.ESTRUCTURA_DEF),
    fortalezas: texto(fila.FORTALEZAS),
    debilidades: texto(fila.DEBILIDADES),
    duelos: [
      ["DUELOS_CB_FAVOR", "Con balón · a favor"],
      ["DUELOS_CB_CONTRA", "Con balón · en contra"],
      ["DUELOS_SB_FAVOR", "Sin balón · a favor"],
      ["DUELOS_SB_CONTRA", "Sin balón · en contra"],
    ]
      .map(([campo, titulo]) => ({ campo, titulo, texto: texto(fila[campo]) }))
      .filter((d) => d.texto),
  };

  const hayAlgo =
    plan.claves.length ||
    plan.ataque ||
    plan.defensa ||
    plan.abpOf ||
    plan.abpDef ||
    plan.estado ||
    plan.duelos.length;

  return hayAlgo ? plan : null;
}

function colectivoDe(fila: Fila | null, extra: Record<string, string>): Colectivo | null {
  if (!fila) return null;

  const valor = (campo: string) => texto(fila[campo]) || texto(extra[campo]);

  const bloques = SECTIONS.flatMap((s) =>
    s.bloques
      .map((b) => ({
        fase: s.titulo,
        bloque: b.titulo,
        campos: b.campos.map((c) => ({ titulo: c.titulo, texto: valor(c.campo) })).filter((c) => c.texto),
      }))
      .filter((b) => b.campos.length),
  );

  const conclusiones = CONCLUSIONES.map((c) => ({ titulo: c.titulo, texto: valor(c.campo) })).filter((c) => c.texto);

  /* Una línea por momento: el primer campo con algo, por orden de importancia. */
  const primero = (campos: string[]) => campos.map((k) => fraseUtil(valor(k), 120)).find(Boolean) ?? "";

  const fases = [
    { titulo: "Cómo salen", texto: primero(["OF_INICIO_ESTRUCTURA", "OF_REINICIO_CONTEXTO", "OF_REINICIO_REFERENCIAS", "OF_INICIO_ASOCIACIONES"]) },
    { titulo: "Cómo atacan", texto: primero(["OF_CAMPO_ESTRUCTURA", "OF_CAMPO_CARRIL_EXTERIOR", "OF_AREA_JUGADORES", "OF_AREA_CENTROS"]) },
    { titulo: "Cómo defienden", texto: primero(["DEF_BLOQUE_MEDIO_ESTRUCTURA", "DEF_BLOQUE_ALTO_ESTRUCTURA", "DEF_REINICIO_EMPAREJAN", "DEF_REINICIO_ORIENTAN"]) },
    { titulo: "Al robar", texto: primero(["TRANSICION_OF_PRIMERA_INTENCION", "TRANSICION_OF_ESPACIOS", "TRANSICION_OF_ZONAS_ROBO", "TRANSICION_OF_JUGADORES_REFERENCIA"]) },
  ].filter((f) => f.texto);

  /* Dónde hacerles daño: sus puntos débiles, sin repetir. */
  const dano = [
    "TRANSICION_DEF_DIFICULTADES_ESPALDA",
    "DEF_BLOQUE_ALTO_ESPALDA",
    "DEF_BLOQUE_MEDIO_ESPALDA",
    "OF_INICIO_JUGADOR_DEBIL_DENTRO",
    "DEF_REINICIO_JUGADORES_DEBILES",
    "DEF_AREA_JUGADOR_DEBIL",
    "DEBILIDADES_INDIVIDUALES",
  ]
    .map((k) => fraseUtil(valor(k), 110))
    .filter((t, i, todos) => t && todos.indexOf(t) === i)
    .slice(0, 3);

  return bloques.length || conclusiones.length ? { bloques, conclusiones, resumen: { fases, dano } } : null;
}

function contextoDe(informe: InformeEquipo | null, rival: string, nuestros: PartidoNuestro[], corte: string): ContextoRival | null {
  if (!informe) return null;

  const fila = informe.clasificacion.total.find((f) => f.slug === informe.slug) ?? informe.clasificacion.total.find((f) => mismoClub(f.equipo, rival));

  const nuestra = informe.clasificacion.total.find((f) => /castilla/i.test(f.equipo));

  /* Hasta el corte: en la previa, lo que había antes del partido; en el post,
     con él dentro. Así un informe de hace semanas no trae la racha de hoy. */
  const antes = (fecha: string) => !corte || soloDia(fecha) <= corte;

  const liga = informe.partidos.filter((p) => p.jugado && esLiga(p) && antes(p.fecha)).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const nuestraRacha = nuestros
    .filter((p) => p.jugado && p.golesFavor !== null && p.golesContra !== null && antes(p.cuando))
    .sort((a, b) => b.cuando.localeCompare(a.cuando))
    .slice(0, 5)
    .map((p) => (p.golesFavor! > p.golesContra! ? "G" : p.golesFavor! < p.golesContra! ? "P" : "E"));

  return {
    escudo: informe.escudo,
    escudoNuestro: nuestra?.escudo ?? "",
    puesto: fila?.puesto ?? null,
    puntos: fila?.puntos ?? null,
    racha: liga.slice(0, 5).map((p) => p.resultado).filter(Boolean),
    goleadores: informe.goleadores.slice(0, 3).map((g) => ({ nombre: g.nombre, goles: g.goles })),
    entrenador: informe.entrenador?.nombre ?? "",
    estructuras: informe.estructuras.slice(0, 2).map((e) => e.estructura),
    nuestraRacha,
    nuestroPuesto: nuestra?.puesto ?? null,
    nuestrosPuntos: nuestra?.puntos ?? null,
  };
}

/* ------------------------------------------------------------------ */
/*  TODO                                                               */
/* ------------------------------------------------------------------ */

export type MicroDisponible = { temporada: string; micro: number; rival: string };

/** Los microciclos que hay en la hoja, del más reciente al más antiguo. */
export async function microsDisponibles(): Promise<MicroDisponible[]> {
  const registro = await loadRegistro();

  return registro.micros
    .map((m) => ({ temporada: m.temporada, micro: m.micro, rival: m.rival }))
    .sort((a, b) => b.temporada.localeCompare(a.temporada) || b.micro - a.micro);
}

export async function cargaInforme(entrada: {
  temporada: string;
  micro: number;
  momento?: Momento;
}): Promise<InformePartido> {
  const avisos: string[] = [];

  const [registro, calendario, rivales, plantillas, stats, informes] = await Promise.all([
    loadRegistro().catch(() => null),
    doc<{ partidos?: PartidoBeSoccer[] }>("castilla:calendario"),
    traeJson<Fila[]>("/api/rivals?action=rivales").catch(() => [] as Fila[]),
    traeJson<Fila[]>("/api/rivals?action=rivalesPlantillas").catch(() => [] as Fila[]),
    doc<RivalStatsDoc>("rivals:stats"),
    doc<InformeDoc>("rivals:informe"),
  ]);

  const tareasMicro = (registro?.tareas ?? []).filter((t) => t.temporada === entrada.temporada && t.micro === entrada.micro);

  const rivalHoja = registro?.micros.find((m) => m.temporada === entrada.temporada && m.micro === entrada.micro)?.rival ?? "";

  const partido = partidoDelMicro(calendario?.partidos ?? [], tareasMicro, rivalHoja);

  /* El nombre bueno del rival: el del calendario; si no, el de la hoja. */
  const rival = partido?.rival || rivalHoja;

  if (!partido) avisos.push("No encuentro el partido de este microciclo en el calendario.");

  const microciclo = microDe(registro?.tareas ?? [], entrada.temporada, entrada.micro, rival);

  if (!microciclo) avisos.push("Este microciclo no tiene tareas en la hoja de registro.");

  /* Previa o post: si no se dice, lo decide el calendario. */
  const momento: Momento = entrada.momento ?? (partido?.jugado ? "post" : "previa");

  /* ---------------- la fila del rival en RIVALES ---------------- */

  const candidatos = (Array.isArray(rivales) ? rivales : []).filter((f) => mismoClub(texto(f.EQUIPO), rival));

  const filaRival =
    candidatos.find((f) => partido?.jornada && num(f.JORNADA) === partido.jornada) ?? candidatos[0] ?? null;

  const extraTodo = await doc<Record<string, Record<string, string>>>("scout-rival-colectivo-extra");

  const extra = filaRival ? extraTodo?.[texto(filaRival.ID)] ?? {} : {};

  const plan = planDe(filaRival);

  const colectivo = colectivoDe(filaRival, extra);

  if (!plan) avisos.push(`El plan de partido contra ${rival || "el rival"} está vacío en Preparación de Partido.`);
  if (!colectivo) avisos.push(`No hay análisis colectivo del ${rival || "rival"} en Scouting colectivo.`);

  /* ---------------- su plantilla y su once ---------------- */

  const suyas = (Array.isArray(plantillas) ? plantillas : []).filter((f) => mismoClub(texto(f.NOMBRE_EQUIPO), rival));

  const equipoHoja = texto(suyas[0]?.NOMBRE_EQUIPO) || rival;

  const plantilla = suyas.map((f) => jugadorDe(f, stats));

  const informeRival = findInforme(informes, equipoHoja);

  const [onceDoc, analisisDoc, clipsDoc, duelo, mediaDoc, generadosDoc] = await Promise.all([
    doc<unknown>(rivalOnceKey(equipoHoja)),
    doc<unknown>(analisisKey(equipoHoja)),
    doc<{ jornadas?: Record<string, { docs?: { nombre: string; url: string }[] }> }>(clipsKey(equipoHoja)),
    fetch(
      /* Las medias, de antes del partido (`corte`); en el post, además, el partido. */
      `/api/data-analisis?duelo=${encodeURIComponent(rival)}${partido ? `&corte=${soloDia(partido.cuando)}` : ""}${momento === "post" && partido ? `&fecha=${soloDia(partido.cuando)}` : ""}`,
    )
      .then((r) => r.json() as Promise<{ duelo?: Duelo }>)
      .then((j) => j.duelo ?? null)
      .catch(() => null),
    filaRival ? doc<unknown>(rivalMediaKey(texto(filaRival.ID))) : Promise.resolve(null),
    doc<unknown>(rivalDocumentosKey(equipoHoja)),
  ]);

  /* Lo último que se sacó en Plantillas rivales: va primero y marcado. */
  const generados = normalizaDocumentos(generadosDoc).docs.map((d) => ({
    nombre: `${ROTULO_DOCUMENTO[d.tipo]} · ${new Date(d.creado).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`,
    url: d.url,
    tipo: d.mime,
    tamano: d.tamano,
    adjuntable: true,
    generado: d.tipo,
  }));

  /* Los recursos del rival: los PDF y PPT subidos se pueden adjuntar al correo. */
  const media = normalizarMedia(mediaDoc);

  const tipoDeDoc = (nombre: string, mime?: string) =>
    mime || (/\.pptx$/i.test(nombre) ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : /\.pdf$/i.test(nombre) ? "application/pdf" : "");

  const recursos = {
    documentos: [
      ...generados,
      ...media.docs.map((d) => {
      const tipo = tipoDeDoc(d.path ?? d.url, d.mime);

      return {
        nombre: d.nombre,
        url: d.url,
        tipo,
        tamano: d.tamano ?? null,
        adjuntable: d.origen === "archivo" && /pdf|presentationml/.test(tipo),
      };
      }),
    ],
    videos: media.videos.map((v) => ({ nombre: v.nombre, url: v.url })),
    equipoPlantilla: equipoHoja,
    generados: normalizaDocumentos(generadosDoc).docs.map((d) => ({ tipo: d.tipo, creado: d.creado })),
  };

  let once: InformePartido["once"] = { jugadores: [], fuente: null, detalle: "" };

  const marcado = normalizarOnce(onceDoc);

  /*
  | Los duelos y el rival de un vistazo (06/10/2026): se lanzan ya y se
  | recogen al final, mientras se arma lo demás. Si fallan, el informe sale
  | sin esos dos bloques y lo avisa.
  */
  const extrasRival = cargaPlantilla()
    .then((fichas) =>
      duelosYVistazo({
        rival,
        equipoHoja,
        filasHoja: Array.isArray(plantillas) ? plantillas : [],
        informeRival,
        marcados: marcado.titulares,
        calendario: calendario?.partidos ?? [],
        fichas: fichas.map((f) => ({ id: f.id, nombre: f.nombre, apodo: f.apodo, foto: f.foto, posicion: f.posicion })),
      }),
    )
    .catch(() => ({ duelos: null, vistazo: null, avisos: ["No se han podido calcular los duelos ni el rival de un vistazo."] }));

  if (marcado.titulares.length) {
    const porClave = new Map(plantilla.map((j) => [j.clave, j]));

    const jugadores = marcado.titulares.map((k) => porClave.get(k)).filter((j): j is JugadorRival => Boolean(j));

    /* Como en la pantalla del once: cada uno en su línea a partes iguales y,
       quien se arrastró a mano, donde lo dejó el analista. Allí el ataque va
       arriba (y crece hacia la portería propia); aquí al revés. */
    const sitios = reparteCampo(
      jugadores.map((j) => ({ clave: j.clave, posCode: codigoDeLado(j.posicion), linea: LINEA_ONCE[j.linea] ?? "medio" })),
      marcado.campo,
    );

    const conCampo = jugadores.map((j) => {
      const sitio = sitios.get(j.clave);

      return sitio ? { ...j, x: sitio.x, y: 1 - sitio.y } : j;
    });

    once = {
      jugadores: conCampo,
      fuente: "marcado",
      detalle: "Once probable marcado por el cuerpo técnico en Plantillas",
    };
  } else if (informeRival?.onces?.length) {
    const ultimo = informeRival.onces[0];

    const jugadores = jugadoresDeOnce(ultimo, plantilla);

    once = {
      jugadores: colocaPorDibujo(jugadores, ultimo.estructura),
      fuente: "ultimo",
      detalle: `Su último once (${ultimo.estructura || "sin dibujo"}): nadie ha marcado aún el once probable en Plantillas`,
    };

    avisos.push("Nadie ha marcado el once probable del rival: sale su último once.");
  } else {
    avisos.push("No hay once del rival: ni marcado ni de sus últimos partidos.");
  }

  if (!duelo?.rival) avisos.push("Data Análisis (Wyscout) todavía no tiene partidos de este rival.");

  /* ---------------- ABP: lo preparado del rival ---------------- */

  const analisis = normalizaAnalisis(analisisDoc);

  const ultimaJornada = Object.keys(analisis.jornadas).sort(ordenJornada).pop();

  const laminasRival = ultimaJornada ? analisis.jornadas[ultimaJornada].laminas.filter((l) => !laminaVacia(l)).length : 0;

  const docsRival = Object.values(clipsDoc?.jornadas ?? {}).flatMap((j) => j.docs ?? []).map((d) => ({ nombre: d.nombre, url: d.url }));

  const cronica = momento === "post" ? cronicaDe(informeRival, partido, plantilla, once.fuente === "marcado" ? once.jugadores : []) : null;

  if (momento === "post" && partido?.jugado && !cronica) avisos.push("BeSoccer aún no tiene la ficha del partido (goles, su once): se baja cada noche.");

  const delRival = await extrasRival;

  avisos.push(...delRival.avisos);

  const sinSintesis: Omit<InformePartido, "sintesis"> = {
    momento,
    generado: new Date().toISOString(),
    partido: {
      jornada: partido?.jornada ?? null,
      cuando: partido?.cuando ?? "",
      fechaTexto: partido ? fechaLarga(partido.cuando) : "",
      lado: partido?.lado ?? "",
      rival,
      gf: partido?.golesFavor ?? null,
      gc: partido?.golesContra ?? null,
      jugado: Boolean(partido?.jugado),
    },
    microciclo,
    duelo,
    plan,
    colectivo,
    once,
    plantilla,
    contexto: contextoDe(
      informeRival,
      rival,
      (calendario?.partidos ?? []).map(comoNuestro).filter((p) => p.jornada),
      partido ? (momento === "post" ? soloDia(partido.cuando) : diaAnterior(soloDia(partido.cuando))) : "",
    ),
    cronica,
    recursos,
    pronostico: pronostica({ duelo, partido: { lado: partido?.lado ?? "" }, plan }),
    abp: microciclo || laminasRival || docsRival.length
      ? { minutosSemana: microciclo?.totales.abpMinutos ?? 0, laminasRival, documentosRival: docsRival }
      : null,
    avisos,
    duelosJugadores: delRival.duelos,
    vistazo: delRival.vistazo,
  };

  if (momento === "post" && !partido?.jugado) avisos.push("El partido aún no tiene resultado: el post saldrá completo cuando se juegue.");

  return { ...sinSintesis, sintesis: sintetiza(sinSintesis) };
}
