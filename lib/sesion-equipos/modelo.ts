/**
 * JUGADORES DE LA SESIÓN: LOS EQUIPOS DE CADA TAREA.
 *
 * El cuerpo técnico recibe cada día la lista de la sesión en texto —la manda
 * el delegado así:
 *
 *   CASTILLA - SÁBADO 26/09/26
 *   ==========================
 *   LISTADO DE JUGADORES (20):
 *     - OSCAR NAASEI
 *     - MELVIN UKPEIGBE (RMC)
 *   LESIONADOS:
 *     - IZAN REGUEIRA
 *
 * y con ella hace los equipos de cada tarea. Aquí está todo lo que no es
 * pantalla: leer ese texto, la forma de lo que se guarda, el validador (nadie
 * olvidado, nadie en dos sitios, comodines y equipos cuadrados) y el reparto
 * automático. No importa nada de React, así que se puede probar en Node.
 *
 * **Cada jugador está en un solo sitio por tarea**: el reparto es un mapa
 * jugador → sitio, no una lista por equipo. Así repetir a alguien en dos
 * equipos es imposible por construcción, y el validador sólo tiene que mirar
 * los repetidos que vengan ya en la lista pegada.
 */

/* ------------------------------------------------------------------ */
/*  LA FORMA                                                           */
/* ------------------------------------------------------------------ */

export type JugadorSesion = {
  id: string;
  /** Tal y como viene en la lista: «OSCAR NAASEI». */
  nombre: string;
  /** Lo que va entre paréntesis: «RMC», «JA» (jugadores de otro equipo). */
  etiqueta?: string;
  /**
   * Si no está disponible, por qué: el nombre de su apartado en la lista
   * («Lesionados»). Un lesionado **puede** hacer alguna tarea: por defecto no
   * entra, pero se le puede meter en un equipo.
   */
  baja?: string;
  /**
   * El puesto puesto a mano. Si no está, sale de la plantilla (la pestaña
   * JUGADORES) cruzando por nombre; los de otro equipo (RMC, JA) no salen y
   * se les pone aquí.
   */
  puesto?: Puesto;
};

/* ------------------------------------------------------------------ */
/*  PUESTOS                                                            */
/* ------------------------------------------------------------------ */

/** Lo justo para repartir: que los porteros y las líneas queden parejos. */
export type Puesto = "POR" | "DEF" | "MED" | "EXT" | "DEL";

export const PUESTOS: { clave: Puesto; nombre: string }[] = [
  { clave: "POR", nombre: "Portero" },
  { clave: "DEF", nombre: "Defensa" },
  { clave: "MED", nombre: "Medio" },
  { clave: "EXT", nombre: "Extremo" },
  { clave: "DEL", nombre: "Delantero" },
];

/** La columna POSICION de la plantilla: «PORTERO», «LATERAL D.», «CENTRAL», «6», «11»… */
export function puestoDePosicion(posicion: string): Puesto | undefined {
  const p = posicion.trim().toUpperCase();

  if (!p) return undefined;
  if (/PORTER|^1$/.test(p)) return "POR";
  if (/LATERAL|CENTRAL|DEFENS|CARRILERO|^[2-5]$/.test(p)) return "DEF";
  if (/^(6|8|10)$|PIVOTE|MEDIO|INTERIOR|MEDIAPUNTA/.test(p)) return "MED";
  if (/^(7|11)$|EXTREMO/.test(p)) return "EXT";
  if (/^9$|DELANTER|PUNTA/.test(p)) return "DEL";

  return undefined;
}

const ORDEN_LISTA: (Puesto | undefined)[] = ["POR", "DEF", "MED", "EXT", "DEL", undefined];

/** Una lista ordenada como se lee un equipo: portero, defensas, medios, extremos, delanteros. */
export function ordenPorPuesto(lista: JugadorSesion[], puestoDe: (j: JugadorSesion) => Puesto | undefined) {
  return [...lista].sort((a, b) => ORDEN_LISTA.indexOf(puestoDe(a)) - ORDEN_LISTA.indexOf(puestoDe(b)));
}

export type FichaPlantilla ={ nombre: string; apodo?: string; posicion: string };

/**
 * El puesto de cada uno de la lista según la plantilla.
 *
 * La lista dice «DANIEL YAÑEZ» y la plantilla «Yáñez» o «Melvin Ukpeigbe»:
 * casa si todas las palabras del nombre de la plantilla (o su apodo) están en
 * el de la lista. Si casan dos fichas distintas, no se pone ninguna.
 */
export function puestosDesdePlantilla(jugadores: JugadorSesion[], plantilla: FichaPlantilla[]) {
  const salida: Record<string, Puesto> = {};

  for (const j of jugadores) {
    const suyas = new Set(claveNombre(j.nombre).split(" "));

    const casan = plantilla.filter((f) =>
      [f.nombre, f.apodo ?? ""].some((n) => {
        const pals = claveNombre(n).split(" ").filter((p) => p.length > 1);

        return pals.length > 0 && pals.every((p) => suyas.has(p));
      }),
    );

    const puestos = [...new Set(casan.map((f) => puestoDePosicion(f.posicion)).filter(Boolean))] as Puesto[];

    if (puestos.length === 1) salida[j.id] = puestos[0];
  }

  return salida;
}

export type EquipoTarea = {
  id: string;
  nombre: string;
  /** «#F97316». */
  color: string;
  /** Su dibujo, si la tarea va «con estructura» («1-4-3-3»). Ver lib/sesion-equipos/estructura.ts. */
  estructura?: string;
  /** Ids de jugador por hueco del dibujo, tal y como se dejaron a mano («» = hueco vacío). */
  orden?: string[];
  /** El punto de cada hueco puesto a mano (mismo índice que `orden`; null = el del dibujo). */
  posiciones?: ({ x: number; y: number } | null)[];
  /** Dos en el mismo puesto (08/10/2026): titular → compañero. Ver lib/sesion-equipos/estructura.ts. */
  pares?: Record<string, string>;
};

/** Lo que cambia a mitad de tarea (08/10/2026): dónde está cada uno y cómo se colocan los equipos. Ver lib/sesion-equipos/cambio.ts. */
export type FaseCambio = {
  sitio: Record<string, Sitio>;
  equipos: Record<string, Pick<EquipoTarea, "orden" | "posiciones" | "pares">>;
};

/** Dónde está cada jugador en una tarea. Sin entrada = todavía sin sitio. */
export type Sitio = string | typeof COMODIN | typeof FUERA;

export const COMODIN = "comodin";

/** No hace esta tarea (descansa, va con el preparador, o es la baja). */
export const FUERA = "fuera";

export type TareaEquipos = {
  id: string;
  nombre: string;
  equipos: EquipoTarea[];
  /** Cuántos comodines lleva; 0 es sin comodines. */
  comodines: number;
  colorComodin: string;
  sitio: Record<string, Sitio>;
  /** Cada equipo con su dibujo en un mini campograma, o sólo los equipos (06/10/2026). */
  conEstructura?: boolean;
  /** Cómo queda la tarea tras el cambio a mitad (08/10/2026). */
  cambio?: FaseCambio;
};

export type SesionEquipos = {
  id: string;
  /** «CASTILLA - SÁBADO 26/09/26». */
  titulo: string;
  /** «2026-09-26», si el título trae fecha. */
  fecha?: string;
  /** El texto que se pegó, para poder volver a él. */
  texto: string;
  jugadores: JugadorSesion[];
  tareas: TareaEquipos[];
  creadaEn: string;
};

export type AlmacenEquipos = {
  sesiones: SesionEquipos[];
  /** Las estructuras que ha creado el cuerpo técnico (07/10/2026): salen arriba en el desplegable. */
  estructuras?: string[];
};

export const ALMACEN_VACIO: AlmacenEquipos = { sesiones: [] };

/* ------------------------------------------------------------------ */
/*  COLORES                                                            */
/* ------------------------------------------------------------------ */

/** Los petos del club. Los cuatro primeros son los de por defecto. */
export const COLORES = [
  { nombre: "Naranja", valor: "#F97316" },
  { nombre: "Verde", valor: "#22C55E" },
  { nombre: "Amarillo", valor: "#FACC15" },
  { nombre: "Azul", valor: "#3B82F6" },
  { nombre: "Rojo", valor: "#EF4444" },
  { nombre: "Rosa", valor: "#EC4899" },
  { nombre: "Morado", valor: "#8B5CF6" },
  { nombre: "Celeste", valor: "#38BDF8" },
  { nombre: "Blanco", valor: "#F4F4F5" },
  { nombre: "Gris", valor: "#71717A" },
  { nombre: "Negro", valor: "#18181B" },
] as const;

export const COLOR_COMODIN = "#F4F4F5";

export const nombreDeColor = (valor: string) =>
  COLORES.find((c) => c.valor.toLowerCase() === valor.toLowerCase())?.nombre ?? "Equipo";

/** ¿Letra clara u oscura sobre este color? Luminancia relativa de WCAG. */
export function tintaSobre(hex: string) {
  const limpio = hex.replace("#", "");

  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(limpio.slice(i, i + 2), 16) / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  const luz = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luz > 0.4 ? "#0B0F14" : "#FFFFFF";
}

/* ------------------------------------------------------------------ */
/*  IDENTIFICADORES Y NOMBRES                                          */
/* ------------------------------------------------------------------ */

export const nuevoId = (prefijo: string) =>
  `${prefijo}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

/** «Álvaro  Leiva» → «alvaro leiva»: para casar nombres al volver a pegar. */
export const claveNombre = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();

/* ------------------------------------------------------------------ */
/*  LEER LA LISTA PEGADA                                               */
/* ------------------------------------------------------------------ */

export type ListaLeida = {
  titulo: string;
  fecha?: string;
  jugadores: Omit<JugadorSesion, "id">[];
  /** Nombres que salen dos veces en la lista: el validador los enseña. */
  repetidos: string[];
};

/** Un apartado de disponibles: «LISTADO DE JUGADORES», «CONVOCADOS»… */
const ES_DISPONIBLE = /jugador|convocad|listado|disponible|plantilla/i;

function capitaliza(texto: string) {
  const t = texto.trim().toLowerCase();

  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** «26/09/26» o «26/09/2026» → «2026-09-26». */
function fechaDe(texto: string) {
  const m = texto.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);

  if (!m) return undefined;

  const anio = m[3].length === 2 ? `20${m[3]}` : m[3];

  return `${anio}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * El nombre limpio y su etiqueta entre paréntesis (08/10/2026).
 *
 * WhatsApp marca la cursiva con guiones bajos y la negrita con asteriscos, y
 * al copiar la lista se vienen pegados: «_POL DURÁN (RMC)_». Con ellos el
 * paréntesis ya no estaba al final, la etiqueta no se separaba y el nombre
 * salía con las rayas en la pantalla y en la diapositiva.
 */
export function separaNombre(crudo: string): { nombre: string; etiqueta?: string } {
  let nombre = crudo
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[_*~]+|[_*~]+$/g, "")
    .trim();

  let etiqueta: string | undefined;

  const parentesis = nombre.match(/\(([^)]+)\)\s*$/);

  if (parentesis) {
    etiqueta = parentesis[1].replace(/[_*~]/g, "").trim() || undefined;
    nombre = nombre.slice(0, parentesis.index).replace(/[_*~]+$/g, "").trim();
  }

  return etiqueta ? { nombre, etiqueta } : { nombre };
}

/** Un jugador guardado antes de limpiar los nombres: se limpia al leer, sin tocar su id. */
export function limpiaJugador(j: JugadorSesion): JugadorSesion {
  if (!/^[_*~]|[_*~]$/.test(j.nombre) && !/\)\s*$/.test(j.nombre)) return j;

  const { nombre, etiqueta } = separaNombre(j.nombre);

  return { ...j, nombre, ...(etiqueta && !j.etiqueta ? { etiqueta } : {}) };
}

/**
 * Lee el texto del delegado.
 *
 * Es tolerante a propósito: la primera línea con letras es el título; una
 * línea que acaba en «:» abre un apartado; una que empieza por guion, punto o
 * asterisco es un jugador. Un apartado que no es el listado («LESIONADOS»,
 * «ENFERMOS», «SELECCIÓN»…) deja a sus jugadores como baja con ese motivo.
 * Si no hay ningún apartado, todas las líneas sueltas son jugadores.
 */
export function leeLista(texto: string): ListaLeida {
  const lineas = texto.replace(/\r/g, "").split("\n");

  let titulo = "";
  let apartado: string | null = null;

  const jugadores: Omit<JugadorSesion, "id">[] = [];
  const vistos = new Map<string, number>();

  const anota = (crudo: string) => {
    const { nombre, etiqueta } = separaNombre(crudo);

    if (!nombre) return;

    const clave = claveNombre(nombre);

    if (!clave) return;

    vistos.set(clave, (vistos.get(clave) ?? 0) + 1);

    const baja = apartado && !ES_DISPONIBLE.test(apartado) ? capitaliza(apartado) : undefined;

    jugadores.push({ nombre, ...(etiqueta ? { etiqueta } : {}), ...(baja ? { baja } : {}) });
  };

  const hayApartados = lineas.some((l) => /^[^-•*].*:\s*$/.test(l.trim()));

  for (const cruda of lineas) {
    const linea = cruda.trim();

    if (!linea || /^[=\-_~*\s]+$/.test(linea)) continue;

    const item = linea.match(/^[-•*·]\s*(.+)$/);

    if (item) {
      anota(item[1]);

      continue;
    }

    if (/:\s*$/.test(linea)) {
      apartado = linea.replace(/:\s*$/, "").replace(/\(\s*\d+\s*\)/, "").trim();

      continue;
    }

    if (!titulo) {
      titulo = linea;

      continue;
    }

    /* Sin apartados, una línea suelta es un jugador. */
    if (!hayApartados) anota(linea);
  }

  const repetidos = jugadores
    .filter((j, i, todos) => (vistos.get(claveNombre(j.nombre)) ?? 0) > 1 && todos.findIndex((x) => claveNombre(x.nombre) === claveNombre(j.nombre)) === i)
    .map((j) => j.nombre);

  return { titulo: titulo || "Sesión", fecha: fechaDe(titulo), jugadores, repetidos };
}

/* ------------------------------------------------------------------ */
/*  CREAR Y ACTUALIZAR                                                 */
/* ------------------------------------------------------------------ */

export function equiposPorDefecto(n: number, previos: EquipoTarea[] = []): EquipoTarea[] {
  return Array.from({ length: n }, (_, i) => {
    if (previos[i]) return previos[i];

    const color = COLORES[i % COLORES.length].valor;

    return { id: nuevoId("eq"), nombre: nombreDeColor(color).toUpperCase(), color };
  });
}

export function nuevaTarea(numero: number, jugadores: JugadorSesion[]): TareaEquipos {
  /* Las bajas empiezan fuera: si alguna hace la tarea, se la mete a mano. */
  const sitio: Record<string, Sitio> = {};

  for (const j of jugadores) if (j.baja) sitio[j.id] = FUERA;

  return {
    id: nuevoId("ta"),
    nombre: `Tarea ${numero}`,
    equipos: equiposPorDefecto(2),
    comodines: 0,
    colorComodin: COLOR_COMODIN,
    sitio,
  };
}

export function nuevaSesion(texto: string): SesionEquipos {
  const lista = leeLista(texto);

  const jugadores = lista.jugadores.map((j) => ({ ...j, id: nuevoId("ju") }));

  return {
    id: nuevoId("se"),
    titulo: lista.titulo,
    ...(lista.fecha ? { fecha: lista.fecha } : {}),
    texto,
    jugadores,
    tareas: [nuevaTarea(1, jugadores)],
    creadaEn: new Date().toISOString(),
  };
}

/**
 * Vuelve a pegar la lista sobre una sesión que ya tiene equipos.
 *
 * Pasa a menudo: llega uno tarde, otro se cae. Los que siguen conservan su
 * identificador —y con él su sitio en cada tarea—; los nuevos entran sin
 * sitio (el validador los marca) y los que ya no están desaparecen de todas.
 */
export function actualizaLista(sesion: SesionEquipos, texto: string): SesionEquipos {
  const lista = leeLista(texto);

  /* Por nombre, y cada previo se usa una sola vez: con un nombre repetido en
     la lista, los dos acababan con el mismo identificador y compartían sitio. */
  const antes = new Map<string, JugadorSesion[]>();

  /* Los que estaban de baja en la lista anterior. */
  const eraBaja = new Set<string>();

  for (const j of sesion.jugadores) {
    /* Limpio: uno guardado como «_POL DURÁN (RMC)_» es el «POL DURÁN» de la lista nueva. */
    const clave = claveNombre(limpiaJugador(j).nombre);

    antes.set(clave, [...(antes.get(clave) ?? []), j]);
  }

  const jugadores: JugadorSesion[] = lista.jugadores.map((j) => {
    const previo = antes.get(claveNombre(j.nombre))?.shift();

    if (previo?.baja) eraBaja.add(previo.id);

    return { ...j, id: previo?.id ?? nuevoId("ju"), ...(previo?.puesto ? { puesto: previo.puesto } : {}) };
  });

  const ids = new Set(jugadores.map((j) => j.id));

  const tareas = sesion.tareas.map((t) => {
    const sitio: Record<string, Sitio> = {};

    for (const [id, donde] of Object.entries(t.sitio)) if (ids.has(id)) sitio[id] = donde;

    /* Una baja nueva empieza fuera; si ya tenía sitio, se respeta. */
    for (const j of jugadores) if (j.baja && !(j.id in sitio)) sitio[j.id] = FUERA;

    /* Y quien vuelve de la baja deja de estar fuera: queda sin colocar, que
       es lo que el validador avisa. Si no, seguía fuera en todas las tareas
       sin que nada lo dijera. */
    for (const j of jugadores) {
      if (!j.baja && eraBaja.has(j.id) && sitio[j.id] === FUERA) delete sitio[j.id];
    }

    return { ...t, sitio };
  });

  return {
    ...sesion,
    titulo: lista.titulo || sesion.titulo,
    ...(lista.fecha ? { fecha: lista.fecha } : {}),
    texto,
    jugadores,
    tareas,
  };
}

/** Cambia el número de equipos; los de los equipos que se quitan, sin sitio. */
export function conEquipos(tarea: TareaEquipos, n: number): TareaEquipos {
  const equipos = equiposPorDefecto(n, tarea.equipos.slice(0, n));

  const vivos = new Set(equipos.map((e) => e.id));

  const sitio: Record<string, Sitio> = {};

  for (const [id, donde] of Object.entries(tarea.sitio)) {
    if (donde === COMODIN || donde === FUERA || vivos.has(donde)) sitio[id] = donde;
  }

  /* Y lo mismo tras el cambio a mitad de tarea. */
  const cambio: FaseCambio | undefined = tarea.cambio
    ? {
        sitio: Object.fromEntries(
          Object.entries(tarea.cambio.sitio).filter(([, donde]) => donde === COMODIN || donde === FUERA || vivos.has(donde)),
        ),
        equipos: tarea.cambio.equipos,
      }
    : undefined;

  return { ...tarea, equipos, sitio, ...(cambio ? { cambio } : {}) };
}

/** Copia de una tarea: mismos equipos y colores, mismo reparto. */
export function duplicaTarea(tarea: TareaEquipos, nombre: string): TareaEquipos {
  const ids = new Map(tarea.equipos.map((e) => [e.id, nuevoId("eq")]));

  const sitio: Record<string, Sitio> = {};

  for (const [id, donde] of Object.entries(tarea.sitio)) sitio[id] = ids.get(donde) ?? donde;

  /* El cambio a mitad viaja con la tarea, con los equipos nuevos. */
  const cambio: FaseCambio | undefined = tarea.cambio
    ? {
        sitio: Object.fromEntries(Object.entries(tarea.cambio.sitio).map(([id, donde]) => [id, ids.get(donde) ?? donde])),
        equipos: Object.fromEntries(Object.entries(tarea.cambio.equipos).map(([id, e]) => [ids.get(id) ?? id, e])),
      }
    : undefined;

  return {
    ...tarea,
    id: nuevoId("ta"),
    nombre,
    equipos: tarea.equipos.map((e) => ({ ...e, id: ids.get(e.id)! })),
    sitio,
    ...(cambio ? { cambio } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  QUIÉN ESTÁ DÓNDE                                                   */
/* ------------------------------------------------------------------ */

export type Reparto = {
  porEquipo: Record<string, JugadorSesion[]>;
  comodines: JugadorSesion[];
  fuera: JugadorSesion[];
  sinSitio: JugadorSesion[];
};

export function repartoDe(tarea: TareaEquipos, jugadores: JugadorSesion[]): Reparto {
  const porEquipo: Record<string, JugadorSesion[]> = Object.fromEntries(tarea.equipos.map((e) => [e.id, []]));

  const reparto: Reparto = { porEquipo, comodines: [], fuera: [], sinSitio: [] };

  for (const j of jugadores) {
    const donde = tarea.sitio[j.id];

    if (donde === COMODIN) reparto.comodines.push(j);
    else if (donde === FUERA) reparto.fuera.push(j);
    else if (donde && porEquipo[donde]) porEquipo[donde].push(j);
    else reparto.sinSitio.push(j);
  }

  return reparto;
}

/* ------------------------------------------------------------------ */
/*  EL VALIDADOR                                                       */
/* ------------------------------------------------------------------ */

export type Aviso = {
  nivel: "error" | "aviso" | "info" | "ok";
  texto: string;
};

/** El puesto de un jugador: el puesto a mano, si no el de la plantilla. */
export type PuestoDe = (j: JugadorSesion) => Puesto | undefined;

const soloAMano: PuestoDe = (j) => j.puesto;

export function valida(tarea: TareaEquipos, sesion: SesionEquipos, puestoDe: PuestoDe = soloAMano): Aviso[] {
  const r = repartoDe(tarea, sesion.jugadores);

  const avisos: Aviso[] = [];

  /* 1. Nadie olvidado. */
  if (r.sinSitio.length) {
    avisos.push({
      nivel: "error",
      texto: `${r.sinSitio.length === 1 ? "Falta por colocar" : `Faltan ${r.sinSitio.length} por colocar`}: ${r.sinSitio.map((j) => j.nombre).join(", ")}`,
    });
  } else {
    avisos.push({ nivel: "ok", texto: "Nadie olvidado: todos tienen sitio" });
  }

  /* 2. Nadie repetido. En la tarea es imposible; en la lista pegada, no. */
  const repetidos = [
    ...new Set(
      sesion.jugadores
        .map((j) => claveNombre(j.nombre))
        .filter((clave, i, todas) => todas.indexOf(clave) !== i),
    ),
  ];

  if (repetidos.length) {
    avisos.push({
      nivel: "error",
      texto: `En la lista sale dos veces: ${repetidos
        .map((c) => sesion.jugadores.find((j) => claveNombre(j.nombre) === c)?.nombre ?? c)
        .join(", ")}`,
    });
  } else {
    avisos.push({ nivel: "ok", texto: "Nadie repetido: cada jugador está en un solo sitio" });
  }

  /* 3. Equipos. */
  const tamanos = tarea.equipos.map((e) => r.porEquipo[e.id]?.length ?? 0);

  const vacios = tarea.equipos.filter((e) => !(r.porEquipo[e.id]?.length));

  if (vacios.length) {
    avisos.push({ nivel: "error", texto: `Sin jugadores: ${vacios.map((e) => e.nombre).join(", ")}` });
  } else if (Math.max(...tamanos) - Math.min(...tamanos) > 1) {
    avisos.push({
      nivel: "aviso",
      texto: `Equipos descompensados: ${tarea.equipos.map((e, i) => `${e.nombre} ${tamanos[i]}`).join(" · ")}`,
    });
  } else {
    avisos.push({ nivel: "ok", texto: `Equipos de ${[...new Set(tamanos)].sort((a, b) => a - b).join(" y ")}` });
  }

  /* 4. Comodines. */
  if (tarea.comodines > 0 && r.comodines.length !== tarea.comodines) {
    avisos.push({
      nivel: "aviso",
      texto: `Comodines: ${r.comodines.length} de ${tarea.comodines}`,
    });
  } else if (tarea.comodines === 0 && r.comodines.length > 0) {
    avisos.push({ nivel: "aviso", texto: `Hay ${r.comodines.length} comodín(es) en una tarea sin comodines` });
  } else if (tarea.comodines > 0) {
    avisos.push({ nivel: "ok", texto: `${tarea.comodines} comodín(es) puestos` });
  }

  /* 5. Colores repetidos: dos equipos con el mismo peto. */
  const colores = tarea.equipos.map((e) => e.color.toLowerCase());

  if (new Set(colores).size !== colores.length) {
    avisos.push({ nivel: "aviso", texto: "Dos equipos llevan el mismo color" });
  }

  if (tarea.comodines > 0 && colores.includes(tarea.colorComodin.toLowerCase())) {
    avisos.push({ nivel: "aviso", texto: "Los comodines llevan el color de un equipo" });
  }

  /* 6. Porteros: dos en un equipo y otro equipo sin ninguno. */
  if (tarea.equipos.length > 1) {
    const porteros = tarea.equipos.map((e) => (r.porEquipo[e.id] ?? []).filter((j) => puestoDe(j) === "POR").length);

    if (Math.max(...porteros) >= 2 && Math.min(...porteros) === 0) {
      avisos.push({
        nivel: "aviso",
        texto: `Porteros mal repartidos: ${tarea.equipos.map((e, i) => `${e.nombre} ${porteros[i]}`).join(" · ")}`,
      });
    }
  }

  /* 7. Bajas que hacen la tarea: no es un error, pero que se vea. */
  const bajasDentro = sesion.jugadores.filter((j) => j.baja && tarea.sitio[j.id] && tarea.sitio[j.id] !== FUERA);

  if (bajasDentro.length) {
    avisos.push({
      nivel: "info",
      texto: `Hacen la tarea estando de baja: ${bajasDentro.map((j) => `${j.nombre} (${j.baja?.toLowerCase()})`).join(", ")}`,
    });
  }

  return avisos;
}

export const tareaLista = (avisos: Aviso[]) => !avisos.some((a) => a.nivel === "error");

/* ------------------------------------------------------------------ */
/*  REPARTO AUTOMÁTICO                                                 */
/* ------------------------------------------------------------------ */

function baraja<T>(lista: T[], azar: () => number = Math.random) {
  const copia = [...lista];

  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));

    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia;
}

export type OpcionesReparto = {
  azar?: () => number;
  puestoDe?: PuestoDe;
  /** Cuántas veces ha sido comodín cada uno en la sesión (`rotacionDe`). */
  vecesComodin?: Record<string, number>;
};

/** En qué orden se reparten las líneas: los escasos primero, para que caigan parejos. */
const ORDEN_PUESTO: (Puesto | "?")[] = ["POR", "DEL", "EXT", "DEF", "MED", "?"];

/**
 * Coloca a los que no tienen sitio. No mueve a nadie que ya esté colocado.
 *
 * Primero los comodines que falten —nunca un portero, y mejor un medio—;
 * luego línea a línea (porteros, delanteros, extremos, defensas, medios y los
 * que no tienen puesto), cada uno al equipo con menos de su línea y, a la
 * par, al más corto. Así un sorteo no deja dos porteros juntos ni a todos los
 * centrales en el mismo peto.
 */
export function completaReparto(
  tarea: TareaEquipos,
  jugadores: JugadorSesion[],
  { azar, puestoDe = soloAMano, vecesComodin = {} }: OpcionesReparto = {},
): TareaEquipos {
  const r = repartoDe(tarea, jugadores);

  const sitio = { ...tarea.sitio };

  const linea = (j: JugadorSesion) => puestoDe(j) ?? "?";

  let cola = baraja(r.sinSitio, azar);

  /* Comodines: medios primero, después cualquiera que no sea portero. */
  let faltanComodines = Math.max(0, tarea.comodines - r.comodines.length);

  /* Y entre ellos, quien menos veces lo ha sido en la sesión: que roten. */
  const porVeces = (lista: JugadorSesion[]) =>
    [...lista].sort((a, b) => (vecesComodin[a.id] ?? 0) - (vecesComodin[b.id] ?? 0));

  const candidatos = [
    ...porVeces(cola.filter((j) => linea(j) === "MED")),
    ...porVeces(cola.filter((j) => !["MED", "POR"].includes(linea(j)))),
  ];

  for (const j of candidatos) {
    if (faltanComodines <= 0) break;

    sitio[j.id] = COMODIN;
    faltanComodines -= 1;
    cola = cola.filter((x) => x.id !== j.id);
  }

  if (!tarea.equipos.length) return { ...tarea, sitio };

  const tamano: Record<string, number> = {};
  const deLinea: Record<string, Record<string, number>> = {};

  for (const e of tarea.equipos) {
    tamano[e.id] = r.porEquipo[e.id]?.length ?? 0;
    deLinea[e.id] = {};

    for (const j of r.porEquipo[e.id] ?? []) deLinea[e.id][linea(j)] = (deLinea[e.id][linea(j)] ?? 0) + 1;
  }

  cola.sort((a, b) => ORDEN_PUESTO.indexOf(linea(a)) - ORDEN_PUESTO.indexOf(linea(b)));

  const total = Object.values(tamano).reduce((s, t) => s + t, 0) + cola.length;

  const cupo = Math.ceil(total / tarea.equipos.length);

  /* Cuántos equipos pueden llegar al cupo; los demás se quedan en uno menos. */
  const llenos = tarea.equipos.length - (cupo * tarea.equipos.length - total);

  for (const j of cola) {
    const l = linea(j);

    const destino = [...tarea.equipos].sort(
      (a, b) =>
        tamano[a.id] - tamano[b.id] ||
        (deLinea[a.id][l] ?? 0) - (deLinea[b.id][l] ?? 0),
    );

    /*
    | El tamaño final de cada equipo está decidido de antemano: con T
    | jugadores y n equipos, todos llevan ⌊T/n⌋ y sólo T mod n llevan uno más.
    | Se elige sólo entre los que aún caben en ese cupo y, entre ellos, el que
    | menos tiene de su línea. Con «≤ el más corto + 1» salía 4-3-2 al
    | completar un 2-1-1.
    */
    const enCupo = tarea.equipos.filter((e) => tamano[e.id] >= cupo).length;

    const tope = enCupo < llenos ? cupo : cupo - 1;

    const caben = destino.filter((e) => tamano[e.id] < tope);

    const corto = (caben.length ? caben : destino).sort(
      (a, b) => (deLinea[a.id][l] ?? 0) - (deLinea[b.id][l] ?? 0) || tamano[a.id] - tamano[b.id],
    )[0];

    sitio[j.id] = corto.id;
    tamano[corto.id] += 1;
    deLinea[corto.id][l] = (deLinea[corto.id][l] ?? 0) + 1;
  }

  return { ...tarea, sitio };
}

/** Sortea de cero a todos los que hacen la tarea (los de fuera se quedan fuera). */
export function sorteaReparto(
  tarea: TareaEquipos,
  jugadores: JugadorSesion[],
  opciones: OpcionesReparto = {},
): TareaEquipos {
  const sitio: Record<string, Sitio> = {};

  for (const [id, donde] of Object.entries(tarea.sitio)) if (donde === FUERA) sitio[id] = FUERA;

  return completaReparto({ ...tarea, sitio }, jugadores, opciones);
}

/* ------------------------------------------------------------------ */
/*  PARA MANDAR Y PARA ROTAR                                           */
/* ------------------------------------------------------------------ */

/** La tarea en texto, para pegarla en el grupo: un equipo por línea. */
export function textoDeTarea(tarea: TareaEquipos, sesion: SesionEquipos, numero: number) {
  const r = repartoDe(tarea, sesion.jugadores);

  const linea = (titulo: string, lista: JugadorSesion[]) =>
    `*${titulo}* (${lista.length}): ${lista.map((j) => j.nombre).join(", ") || "—"}`;

  /* Con estructura, el dibujo va junto al nombre del equipo: «*AZUL · 1-4-3-3* (11)». */
  const titulo = (e: EquipoTarea) => (tarea.conEstructura && e.estructura ? `${e.nombre} · ${e.estructura}` : e.nombre);

  return [
    `*${numero}. ${tarea.nombre.toUpperCase()}*`,
    ...tarea.equipos.map((e) => linea(titulo(e), r.porEquipo[e.id] ?? [])),
    ...(tarea.comodines > 0 || r.comodines.length ? [linea("COMODINES", r.comodines)] : []),
    ...(r.fuera.length ? [`_No participan: ${r.fuera.map((j) => j.nombre).join(", ")}_`] : []),
  ].join("\n");
}

export function textoDeSesion(sesion: SesionEquipos) {
  return [`*${sesion.titulo.toUpperCase()}*`, ...sesion.tareas.map((t, i) => textoDeTarea(t, sesion, i + 1))].join("\n\n");
}

export type Rotacion = { jugador: JugadorSesion; comodin: number; fuera: number; juega: number };

/**
 * Cuántas veces ha sido cada uno comodín o se ha quedado fuera en la sesión.
 *
 * Sirve para rotar: que los comodines no recaigan siempre en los mismos y
 * que nadie descanse dos tareas seguidas sin querer.
 */
export function rotacionDe(sesion: SesionEquipos): Rotacion[] {
  return sesion.jugadores.map((jugador) => {
    const fila = { jugador, comodin: 0, fuera: 0, juega: 0 };

    for (const t of sesion.tareas) {
      const donde = t.sitio[jugador.id];

      if (donde === COMODIN) fila.comodin += 1;
      else if (donde === FUERA) fila.fuera += 1;
      else if (donde && t.equipos.some((e) => e.id === donde)) fila.juega += 1;
    }

    return fila;
  });
}

/* ------------------------------------------------------------------ */
/*  AÑADIR, QUITAR O REEMPLAZAR A UN JUGADOR (08/10/2026)              */
/* ------------------------------------------------------------------ */

/** Ya está en la sesión alguien con ese nombre (sin acentos ni mayúsculas). */
export function yaEnLaSesion(sesion: SesionEquipos, nombre: string, salvo?: string) {
  const clave = claveNombre(separaNombre(nombre).nombre);
  return sesion.jugadores.some((j) => j.id !== salvo && claveNombre(limpiaJugador(j).nombre) === clave);
}

/** Un jugador nuevo, disponible y sin sitio en ninguna tarea. */
export function anadeJugador(sesion: SesionEquipos, crudo: string): SesionEquipos {
  const { nombre, etiqueta } = separaNombre(crudo);
  if (!nombre) return sesion;
  const jugador: JugadorSesion = { id: nuevoId("ju"), nombre: nombre.toUpperCase(), ...(etiqueta ? { etiqueta: etiqueta.toUpperCase() } : {}) };
  return { ...sesion, jugadores: [...sesion.jugadores, jugador] };
}

/**
 * Otro jugador en lugar de uno: mismo identificador, así que hereda su sitio
 * en todas las tareas —equipo, hueco del campo, pareja y el cambio a mitad—.
 * El puesto a mano y la baja eran del que se va: no se heredan.
 */
export function reemplazaJugador(sesion: SesionEquipos, id: string, crudo: string): SesionEquipos {
  const { nombre, etiqueta } = separaNombre(crudo);
  if (!nombre) return sesion;
  return {
    ...sesion,
    jugadores: sesion.jugadores.map((j) =>
      j.id === id ? { id: j.id, nombre: nombre.toUpperCase(), ...(etiqueta ? { etiqueta: etiqueta.toUpperCase() } : {}) } : j,
    ),
  };
}

/** Saca a un jugador de un equipo: su hueco queda libre y, si era titular de una pareja, su compañero se queda el hueco. */
function sinJugador<E extends { orden?: string[]; pares?: Record<string, string> }>(e: E, id: string): E {
  let orden = e.orden;
  let pares = e.pares;

  if (pares) {
    const quedan: Record<string, string> = {};
    for (const [titular, companero] of Object.entries(pares)) {
      if (companero === id) continue;
      if (titular === id) {
        if (orden) orden = orden.map((x) => (x === id ? companero : x));
        continue;
      }
      quedan[titular] = companero;
    }
    pares = quedan;
  }

  if (orden?.includes(id)) orden = orden.map((x) => (x === id ? "" : x));

  return orden === e.orden && pares === e.pares ? e : { ...e, orden, pares };
}

/** Fuera de la sesión: de la lista y de todas sus tareas (también del cambio a mitad). */
export function quitaJugador(sesion: SesionEquipos, id: string): SesionEquipos {
  const sinSitio = (sitio: Record<string, Sitio>) => {
    if (!(id in sitio)) return sitio;
    const resto = { ...sitio };
    delete resto[id];
    return resto;
  };

  return {
    ...sesion,
    jugadores: sesion.jugadores.filter((j) => j.id !== id),
    tareas: sesion.tareas.map((t) => ({
      ...t,
      sitio: sinSitio(t.sitio),
      equipos: t.equipos.map((e) => sinJugador(e, id)),
      ...(t.cambio
        ? {
            cambio: {
              sitio: sinSitio(t.cambio.sitio),
              equipos: Object.fromEntries(Object.entries(t.cambio.equipos).map(([k, e]) => [k, sinJugador(e, id)])),
            },
          }
        : {}),
    })),
  };
}
