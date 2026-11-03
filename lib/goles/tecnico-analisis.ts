/*
|--------------------------------------------------------------------------
| EL ANÁLISIS TÉCNICO DE LOS GOLES, SUMADO (03/11/2026)
|--------------------------------------------------------------------------
|
| La ficha de cada gol (`lib/goles/tecnico.ts`) dice qué hicimos en ese gol.
| Aquí se suman las fichas de los goles que entran con los filtros de la
| pantalla y se sacan las frases. El eje, como pidió el analista, son tres
| cosas: la fase nuestra, el campo desde el que arranca esa fase y el tipo
| de acción que acaba en gol (y su cruce: «Transición ofensiva desde campo
| contrario: 4 goles»). Alrededor: en contra, dónde perdimos el balón, qué
| falló y quién estaba; a favor, dónde robamos, qué se repite y la cadena
| (quién recupera, quién asiste, quién remata). Sin React: lo usan la
| pestaña «Análisis técnico» y «Lo importante».
|
| Lo que no está en ninguna ficha no se cuenta ni se nombra: cada cifra dice
| sobre cuántos goles se ha calculado.
*/

import { fmt, media } from "./analisis";
import {
  ACCIONES,
  CAMPOS,
  CAUSAS_CONTRA,
  CLAVES_FAVOR,
  FASES_NUESTRAS,
  ORIGENES,
  nombreCelda,
  type Celda,
  type FichaTecnica,
} from "./tecnico";
import type { Importante } from "./lecturas";

export type GolTecnico = {
  clave: string;
  aFavor: boolean;
  /** El goleador de BeSoccer (en los nuestros, es de los nuestros). */
  jugador?: string;
  asistente?: string;
  /** «penalti», «propia» o nada. */
  tipo?: string;
  ficha: FichaTecnica;
};

export type Conteo = { clave: string; nombre: string; n: number };

/** Qué hizo un jugador nuestro en la jugada, en cinco cajones. */
export type Papel = "recupera" | "asiste" | "remata" | "pierde" | "duelo" | "otro";

export function papelDe(accion: string): Papel {
  const a = accion.toLowerCase();

  /* Lo defensivo primero: «Pierde la marca» no es «remata», ni «Bloquea y pierde el balón» un robo. Los textos los pone scripts/goles-liga.mjs. */
  if (/pierd|pérdida|perdida/.test(a)) return "pierde";
  if (/duelo|le regatean|despeje fallido|propia puerta|llega tarde/.test(a)) return "duelo";
  if (/recup|roba|intercep/.test(a)) return "recupera";
  if (/asist|centro de gol/.test(a)) return "asiste";
  if (/remat|marca de penalti|gol\b/.test(a)) return "remata";

  return "otro";
}

/** Las acciones de jugador que se ofrecen al añadir uno a mano. */
export const ACCIONES_IMPLICADO = {
  favor: ["Recupera", "Pase", "Conduce", "Asiste", "Remata"],
  contra: ["Pierde", "Duelo perdido", "Llega tarde", "Pierde la marca", "Falta"],
} as const;

/** «Transición ofensiva desde campo contrario». */
export const nombreCruce = (fase: string, campo: string) => `${fase} desde ${campo === "propio" ? "campo propio" : "campo contrario"}`;

export type Cruce = Conteo & { fase: string; campo: string };

export type LadoTecnico = {
  /** Goles de este lado que entran con los filtros. */
  total: number;
  /** Con algo en la ficha (lo de Hudl o lo escrito a mano). */
  conFicha: number;
  revisados: number;
  fases: Conteo[];
  campos: Conteo[];
  /** El cruce fase × campo, la clave es `fase|campo`. */
  cruce: Cruce[];
  /** El tipo de acción que acaba en gol. */
  acciones: Conteo[];
  origenes: Conteo[];
  /** Claves (a favor) o causas (en contra). */
  motivos: Conteo[];
  /** Sobre cuántos goles se calcula cada reparto. */
  baseFases: number;
  baseCampos: number;
  baseCruce: number;
  baseAcciones: number;
  baseOrigenes: number;
  baseMotivos: number;
  /** Dónde nace la jugada, en la referencia del Castilla. */
  zonas: { celda: Celda; n: number }[];
  baseZonas: number;
  segundos: { media: number; n: number } | null;
  /** En contra: sólo los que nacen de una pérdida nuestra. */
  segundosPerdida: { media: number; n: number } | null;
  pases: { media: number; n: number } | null;
  /** Por papel, los jugadores nuestros que más salen. */
  papeles: Partial<Record<Papel, Conteo[]>>;
};

const ordena = (m: Map<string, number>, nombre: (c: string) => string): Conteo[] =>
  [...m]
    .filter(([, n]) => n > 0)
    .map(([clave, n]) => ({ clave, nombre: nombre(clave), n }))
    .filter((x) => x.nombre)
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));

const suma = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export const tieneFicha = (f: FichaTecnica) =>
  Boolean(
    f.fase ||
      f.campo ||
      f.accion ||
      f.origen ||
      f.zonaOrigen ||
      f.carril !== undefined ||
      f.implicados?.length ||
      f.claves?.length ||
      f.causas?.length ||
      f.lectura?.trim() ||
      f.consigna?.trim() ||
      f.revisado,
  );

function lado(goles: GolTecnico[], aFavor: boolean): LadoTecnico {
  const bando = aFavor ? "favor" : "contra";
  const nombreFase = (c: string) => FASES_NUESTRAS[bando].find((x) => x.clave === c)?.nombre ?? "";
  const nombreCampo = (c: string) => CAMPOS.find((x) => x.clave === c)?.nombre ?? "";
  const nombreAccion = (c: string) => ACCIONES.find((x) => x.clave === c)?.nombre ?? "";
  const nombreOrigen = (c: string) => ORIGENES[bando].find((x) => x.clave === c)?.nombre ?? "";
  const nombreMotivo = (c: string) => (aFavor ? CLAVES_FAVOR : CAUSAS_CONTRA).find((x) => x.clave === c)?.nombre ?? "";

  const suyos = goles.filter((g) => g.aFavor === aFavor);
  const fases = new Map<string, number>();
  const campos = new Map<string, number>();
  const cruce = new Map<string, number>();
  const acciones = new Map<string, number>();
  const origenes = new Map<string, number>();
  const motivos = new Map<string, number>();
  const zonas = new Map<string, number>();
  const papeles = new Map<Papel, Map<string, number>>();
  const segs: number[] = [];
  const segsPerdida: number[] = [];
  const pases: number[] = [];
  const base = { fases: 0, campos: 0, cruce: 0, acciones: 0, origenes: 0, motivos: 0, zonas: 0 };

  const anota = (p: Papel, quien: string) => {
    if (!papeles.has(p)) papeles.set(p, new Map());
    suma(papeles.get(p)!, quien);
  };

  for (const g of suyos) {
    const f = g.ficha;
    const fase = f.fase && nombreFase(f.fase) ? f.fase : "";
    const campo = f.campo && nombreCampo(f.campo) ? f.campo : "";

    if (fase) {
      suma(fases, fase);
      base.fases += 1;
    }

    if (campo) {
      suma(campos, campo);
      base.campos += 1;
    }

    if (fase && campo) {
      suma(cruce, `${fase}|${campo}`);
      base.cruce += 1;
    }

    if (f.accion && nombreAccion(f.accion)) {
      suma(acciones, f.accion);
      base.acciones += 1;
    }

    if (f.origen && nombreOrigen(f.origen)) {
      suma(origenes, f.origen);
      base.origenes += 1;
    }

    const lista = ((aFavor ? f.claves : f.causas) ?? []) as string[];

    if (lista.length) base.motivos += 1;
    for (const m of lista) if (nombreMotivo(m)) suma(motivos, m);

    if (f.zonaOrigen) {
      suma(zonas, `${f.zonaOrigen.tercio}|${f.zonaOrigen.carril}`);
      base.zonas += 1;
    }

    if (typeof f.segundos === "number" && Number.isFinite(f.segundos)) {
      segs.push(f.segundos);
      if (!aFavor && f.origen?.startsWith("perdida")) segsPerdida.push(f.segundos);
    }

    if (typeof f.pases === "number" && Number.isFinite(f.pases)) pases.push(f.pases);

    /* La cadena: lo que dice la ficha y, si no lo dice, el goleador y el asistente de BeSoccer (en los nuestros). */
    const vistos = new Set<string>();

    for (const i of f.implicados ?? []) {
      const quien = i.jugador.trim();

      if (!quien) continue;

      const p = papelDe(i.accion);
      const k = `${p}|${quien}`;

      if (vistos.has(k)) continue;
      vistos.add(k);
      anota(p, quien);
    }

    if (aFavor) {
      const hay = (p: Papel) => [...vistos].some((k) => k.startsWith(`${p}|`));

      if (!hay("remata") && g.jugador && g.tipo !== "propia") anota("remata", g.jugador);
      if (!hay("asiste") && g.asistente) anota("asiste", g.asistente);
    }
  }

  const prom = (xs: number[]) => (xs.length ? { media: media(xs.reduce((s, x) => s + x, 0), xs.length), n: xs.length } : null);

  return {
    total: suyos.length,
    conFicha: suyos.filter((g) => tieneFicha(g.ficha)).length,
    revisados: suyos.filter((g) => g.ficha.revisado).length,
    fases: ordena(fases, nombreFase),
    campos: ordena(campos, nombreCampo),
    cruce: ordena(cruce, (k) => nombreCruce(nombreFase(k.split("|")[0]), k.split("|")[1])).map((x) => ({ ...x, fase: x.clave.split("|")[0], campo: x.clave.split("|")[1] })),
    acciones: ordena(acciones, nombreAccion),
    origenes: ordena(origenes, nombreOrigen),
    motivos: ordena(motivos, nombreMotivo),
    baseFases: base.fases,
    baseCampos: base.campos,
    baseCruce: base.cruce,
    baseAcciones: base.acciones,
    baseOrigenes: base.origenes,
    baseMotivos: base.motivos,
    zonas: [...zonas]
      .map(([k, n]) => {
        const [tercio, carril] = k.split("|").map(Number) as [0 | 1 | 2, 0 | 1 | 2];

        return { celda: { tercio, carril }, n };
      })
      .sort((a, b) => b.n - a.n),
    baseZonas: base.zonas,
    segundos: prom(segs),
    segundosPerdida: prom(segsPerdida),
    pases: prom(pases),
    papeles: Object.fromEntries([...papeles].map(([p, m]) => [p, ordena(m, (c) => c)])) as LadoTecnico["papeles"],
  };
}

export function resumenTecnico(goles: GolTecnico[]) {
  return { favor: lado(goles, true), contra: lado(goles, false) };
}

export type ResumenTecnico = ReturnType<typeof resumenTecnico>;

/* ------------------------------------------------------------------ */
/*  Frases                                                             */
/* ------------------------------------------------------------------ */

const goles = (n: number) => (n === 1 ? "1 gol" : `${n} goles`);
const minus = (s: string) => (/^(ABP|ATP)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const seg = (v: number) => `${fmt(v, 0)} s`;

/** Los dos primeros de un reparto, «presión tras pérdida (3) y repliegue tardío (2)». */
const primeros = (xs: Conteo[], k = 2) =>
  xs
    .slice(0, k)
    .map((x) => `${minus(x.nombre)} (${x.n})`)
    .join(" y ");

/** Lo que concedemos, en frases: primero el eje (fase, campo, acción) y después el detalle. */
export function lecturaTecnicaContra(l: LadoTecnico): string[] {
  const frases: string[] = [];

  if (l.cruce[0] && l.baseCruce >= 2) frases.push(`Lo que más encajamos: ${minus(l.cruce[0].nombre)}, ${goles(l.cruce[0].n)} de ${l.baseCruce}.`);
  else if (l.fases[0] && l.baseFases >= 2) frases.push(`De los ${goles(l.baseFases)} en contra con la fase anotada, ${l.fases[0].n} nos llegan en ${minus(l.fases[0].nombre)}.`);

  if (l.acciones[0] && l.baseAcciones >= 2)
    frases.push(`La acción que más nos castiga es ${minus(l.acciones[0].nombre)} (${l.acciones[0].n} de ${l.baseAcciones})${l.acciones[1] ? `, por delante de ${minus(l.acciones[1].nombre)} (${l.acciones[1].n})` : ""}.`);

  if (l.origenes[0] && l.baseOrigenes >= 2) frases.push(`El origen que más se repite es ${minus(l.origenes[0].nombre)}: ${l.origenes[0].n} de ${l.baseOrigenes}.`);
  if (l.motivos.length) frases.push(`Lo que más nos falla: ${primeros(l.motivos)}.`);

  const z = l.zonas[0];

  if (z && z.n >= 2) frases.push(`La jugada nace sobre todo en ${minus(nombreCelda(z.celda))} (${z.n} de ${l.baseZonas}).`);

  if (l.segundosPerdida) frases.push(`De nuestra pérdida al gol pasan de media ${seg(l.segundosPerdida.media)} (${goles(l.segundosPerdida.n)}).`);
  else if (l.segundos && l.segundos.n >= 2) frases.push(`Del origen de la jugada al gol pasan de media ${seg(l.segundos.media)}.`);

  const masPierde = new Map<string, number>();

  for (const x of [...(l.papeles.pierde ?? []), ...(l.papeles.duelo ?? [])]) masPierde.set(x.clave, (masPierde.get(x.clave) ?? 0) + x.n);

  const top = [...masPierde].sort((a, b) => b[1] - a[1])[0];

  if (top && top[1] >= 2) frases.push(`${top[0]} aparece en ${top[1]} de las pérdidas o duelos que acaban en gol: conviene revisarlas con él en vídeo.`);

  return frases;
}

/** Lo que hacemos, en frases: primero el eje (fase, campo, acción) y después el detalle. */
export function lecturaTecnicaFavor(l: LadoTecnico): string[] {
  const frases: string[] = [];

  if (l.cruce[0] && l.baseCruce >= 2) frases.push(`Lo que más nos da: ${minus(l.cruce[0].nombre)}, ${goles(l.cruce[0].n)} de ${l.baseCruce}.`);
  else if (l.fases[0] && l.baseFases >= 2) frases.push(`De nuestros ${goles(l.baseFases)} con la fase anotada, ${l.fases[0].n} llegan en ${minus(l.fases[0].nombre)}.`);

  if (l.acciones[0] && l.baseAcciones >= 2)
    frases.push(`La acción con la que más marcamos es ${minus(l.acciones[0].nombre)} (${l.acciones[0].n} de ${l.baseAcciones})${l.acciones[1] ? `, y luego ${minus(l.acciones[1].nombre)} (${l.acciones[1].n})` : ""}.`);

  if (l.origenes[0] && l.baseOrigenes >= 2) frases.push(`La jugada que más nos da nace en ${minus(l.origenes[0].nombre)}: ${l.origenes[0].n} de ${l.baseOrigenes}.`);
  if (l.motivos.length) frases.push(`Lo que más se repite en nuestros goles: ${primeros(l.motivos)}.`);

  const ritmo = [l.segundos && l.segundos.n >= 2 ? `${seg(l.segundos.media)} del origen al gol` : "", l.pases && l.pases.n >= 2 ? `${fmt(l.pases.media, 1)} pases` : ""].filter(Boolean);

  if (ritmo.length) frases.push(`De media, ${ritmo.join(" y ")}.`);

  const cadena = (["recupera", "asiste", "remata"] as const)
    .map((p) => {
      const x = l.papeles[p]?.[0];

      return x && x.n >= 2 ? `${x.clave} ${p} en ${x.n}` : "";
    })
    .filter(Boolean);

  if (cadena.length) frases.push(`La cadena: ${cadena.join(", ")}.`);

  return frases;
}

/* ------------------------------------------------------------------ */
/*  Para «Lo importante»                                               */
/* ------------------------------------------------------------------ */

/** Qué se trabaja cuando se repite una causa. */
const TAREA_CAUSA: Record<string, string> = {
  presionBalon: "presión al poseedor en bloque medio; criterio de éxito, que el poseedor nunca levante la cabeza sin oposición.",
  vigilancias: "vigilancias y reacción tras pérdida; criterio de éxito, recuperar o temporizar en menos de 5 segundos.",
  repliegue: "repliegue tras pérdida por detrás de la línea del balón; criterio de éxito, siete por detrás del balón en 6 segundos.",
  basculacion: "basculación del bloque al lado del balón; criterio de éxito, ningún cambio de orientación que nos encuentre sin cerrar.",
  lineaDefensiva: "ajuste de la línea defensiva (altura, escalonamiento y achique); criterio de éxito, ningún desmarque a la espalda en línea.",
  coberturas: "coberturas y permutas en la línea; criterio de éxito, siempre un segundo jugador detrás del que salta.",
  dueloPerdido: "duelos 1×1 defensivos con orientación; criterio de éxito, ganar o retrasar el duelo sin falta.",
  centroSinOposicion: "oposición al centrador; criterio de éxito, ningún centro sin un jugador encima.",
  marcaArea: "marcas y ataque al balón dentro del área; criterio de éxito, ningún remate sin contacto.",
  rechace: "ocupación y ataque del rechace; criterio de éxito, primer contacto nuestro en la segunda jugada.",
  abpMarcas: "balón parado defensivo: marcas, zonas y primer contacto; criterio de éxito, ningún remate limpio.",
  errorTecnico: "salida de balón bajo presión con superioridad; criterio de éxito, ninguna pérdida en nuestro tercio.",
  portero: "trabajo específico del portero sobre la acción del gol, con el vídeo.",
};

/** Qué se trabaja cuando se repite una fase nuestra desde un campo. */
const TAREA_CRUCE: Record<string, string> = {
  "transicionDefensiva|contrario": "equilibrio con balón y reacción tras pérdida en campo contrario; criterio de éxito, recuperar o temporizar en menos de 5 segundos.",
  "transicionDefensiva|propio": "salida de balón bajo presión y repliegue tras pérdida en nuestro campo; criterio de éxito, ninguna pérdida por dentro en nuestra mitad.",
  "defensaOrganizada|propio": "defensa del área y del último tercio en bloque bajo; criterio de éxito, ningún remate cómodo dentro del área.",
  "defensaOrganizada|contrario": "presión alta coordinada y cierre de la salida rival; criterio de éxito, que no superen la primera línea por dentro.",
  "abpDefensiva|propio": "balón parado defensivo: marcas, zonas y primer contacto; criterio de éxito, ningún remate limpio.",
  "abpDefensiva|contrario": "vigilancias en nuestras faltas y saques en campo contrario; criterio de éxito, dos por detrás del balón en cada acción.",
};

/**
 * Lo técnico que pesa para arriba del todo: lo que más nos llega en contra
 * (con su tarea) y lo que más nos da a favor (para repetirlo). Hace falta que
 * se repita: dos goles con el mismo cruce, la misma causa o el mismo origen.
 */
export function importanteTecnico(r: ResumenTecnico): Importante[] {
  const filas: Importante[] = [];
  const c = r.contra;
  const f = r.favor;

  const cruceC = c.cruce[0];
  const causa = c.motivos[0];
  const accionC = c.acciones[0] && c.acciones[0].n >= 2 ? c.acciones[0] : null;

  if (cruceC && cruceC.n >= 2) {
    filas.push({
      texto: `Lo que más encajamos es ${minus(cruceC.nombre)}: ${goles(cruceC.n)} de ${c.baseCruce}${accionC ? `, sobre todo con ${minus(accionC.nombre)}` : ""}${causa && causa.n >= 2 ? `; lo que más falla, ${minus(causa.nombre)}` : ""}.`,
      accion: `Esta semana, ${causa && causa.n >= 2 && TAREA_CAUSA[causa.clave] ? TAREA_CAUSA[causa.clave] : TAREA_CRUCE[cruceC.clave] ?? "revisar esos goles en vídeo con los implicados y llevarlo a la tarea de la semana."}`,
    });
  } else if (causa && causa.n >= 2) {
    filas.push({
      texto: `En los goles que encajamos, lo que más nos falla es ${minus(causa.nombre)}: en ${causa.n} de ${c.baseMotivos}.`,
      accion: `Esta semana, ${TAREA_CAUSA[causa.clave] ?? "revisar esos goles en vídeo con los implicados y llevarlo a la tarea de la semana."}`,
    });
  } else if (accionC) {
    filas.push({
      texto: `La acción que más nos castiga es ${minus(accionC.nombre)}: ${accionC.n} de los ${goles(c.baseAcciones)} en contra con la acción anotada.`,
      accion: "Esta semana, defender esa acción en la tarea con el vídeo de esos goles delante.",
    });
  }

  const cruceF = f.cruce[0];
  const clave = f.motivos[0];
  const accionF = f.acciones[0] && f.acciones[0].n >= 2 ? f.acciones[0] : null;

  if (cruceF && cruceF.n >= 2) {
    filas.push({
      texto: `Lo que más gol nos da es ${minus(cruceF.nombre)}: ${goles(cruceF.n)} de ${f.baseCruce}${accionF ? `, sobre todo con ${minus(accionF.nombre)}` : ""}.`,
      accion: `Esta semana, provocar esa situación en la tarea y finalizar como en esos goles${clave && clave.n >= 2 ? `: ${minus(clave.nombre)}` : ""}.`,
    });
  } else if (clave && clave.n >= 2) {
    filas.push({
      texto: `En nuestros goles lo que más se repite es ${minus(clave.nombre)} (${clave.n} de ${f.baseMotivos}).`,
      accion: `Esta semana, repetirlo en la tarea de finalización: ${minus(clave.nombre)}, con el mismo origen y en el mismo sitio.`,
    });
  } else if (accionF) {
    filas.push({
      texto: `La acción con la que más marcamos es ${minus(accionF.nombre)}: ${accionF.n} de ${f.baseAcciones}.`,
      accion: `Esta semana, repetir ${minus(accionF.nombre)} en la tarea de finalización con oposición.`,
    });
  }

  return filas;
}
