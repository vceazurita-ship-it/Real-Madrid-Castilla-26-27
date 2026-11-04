/**
 * PONER AL DÍA WYSCOUT SIN EMPEZAR DE CERO (04/11/2026).
 *
 * El botón «Traer y publicar» de Ajustes bajaba siempre los veinte equipos y
 * los tres lotes de jugadores, aunque desde la última vez sólo se hubiera
 * jugado un aplazado. Ahora cada pasada mira lo que ya hay en la carpeta, el
 * calendario de BeSoccer y el punto de control de la pasada anterior, y baja
 * sólo lo que corresponde.
 *
 * **Las dos descargas no se tratan igual**:
 * - Los «Team Stats» son una fila por equipo y partido. Un equipo hace falta
 *   cuando a una jornada ya jugada le falta su partido (`repartoWyscout`, la
 *   misma regla de DATA y de la revisión de partidos pendientes: un aplazado
 *   se sigue bajando cada pasada hasta que Wyscout lo carga) o cuando su
 *   fichero se bajó el mismo día de su último partido y puede venir sin cerrar.
 * - Los jugadores son ACUMULADOS (una fila por jugador con la temporada
 *   entera; la resta por jornada sale de las fotos semanales). Un lote se
 *   vuelve a bajar entero si alguno de sus equipos ha jugado desde la última
 *   vez que se bajaron sus jugadores. Los lotes son siempre los mismos (la
 *   composición de la última pasada completa), así que «Player Stats N»
 *   sustituye al suyo y no se mezclan semanas.
 *
 * Una pasada completa se hace cuando se pide, cuando falta algo para decidir
 * (sin calendario, sin ficheros, un equipo nuevo) y, como red, si hace más de
 * cuatro semanas de la última completa.
 *
 * Sin React ni servidor: lo cargan los scripts del ordenador del club por
 * `scripts/cargador-ts.cjs` y la pantalla de Ajustes sólo usa los tipos y los
 * rótulos.
 */
import type { FilaPartido } from "./leer";
import { alcanceWyscout, pendientesWyscout, repartoWyscout, type PartidoCalendario } from "./alcance";

/* ------------------------------------------------------------------ */
/*  EL PUNTO DE CONTROL                                                */
/* ------------------------------------------------------------------ */

/** Los pasos de una pasada, en orden. */
export const PASOS_WYSCOUT = ["plan", "entrar", "equipos", "jugadores", "releer", "foto", "publicar", "hecha"] as const;

export type PasoWyscout = (typeof PASOS_WYSCOUT)[number];

export const NOMBRE_PASO: Record<PasoWyscout, string> = {
  plan: "Ver qué falta",
  entrar: "Entrar en Wyscout",
  equipos: "Bajar los equipos",
  jugadores: "Bajar los jugadores",
  releer: "Releer la carpeta",
  foto: "Foto de la jornada",
  publicar: "Publicar",
  hecha: "Terminada",
};

export type ModoPasada = "incremental" | "completa";

/** Una pasada, tal y como la va apuntando cada paso. */
export type PasadaWyscout = {
  id: string;
  empezadaEn: string;
  terminadaEn?: string;
  codigo?: number;
  modo?: ModoPasada;
  /** Por qué ese modo («pedido desde cero», «sólo lo nuevo»…). */
  motivo?: string;
  /** El último paso al que llegó. */
  paso?: PasoWyscout;
  /** Lo que había que bajar en esta pasada (equipos por nombre, lotes por número). */
  plan?: { equipos: string[]; lotes: number[] };
  hechos?: { equipos: string[]; lotes: number[] };
  fallidos?: { equipos: string[]; lotes: number[] };
  /** Lo que quedó a medias, en palabras («equipos sin bajar: Huesca»). */
  incompleto?: string[];
  /** El primer error que se vio, para explicar el fallo. */
  fallo?: { paso: PasoWyscout; detalle: string };
};

export type PuntoControlWyscout = {
  pasada?: PasadaWyscout;
  /** Cuándo se bajó por última vez el fichero de cada equipo (por su nombre en Wyscout). */
  equipos?: Record<string, { bajadoEn: string }>;
  /** Cuándo se bajaron los jugadores de cada equipo y cuál era entonces su último partido. */
  jugadores?: Record<string, { bajadoEn: string; ultimoPartido: string | null }>;
  /** Los lotes de jugadores de la última pasada completa: el lote N es `lotes[N-1]`. */
  lotes?: string[][];
  /** La última pasada completa que salió bien. */
  ultimaCompleta?: string;
  /** Cómo quedaron los datos al acabar la última pasada (lo que enseña Ajustes). */
  estado?: EstadoDatosWyscout;
};

/** Lo que Ajustes enseña de la última pasada y de los datos (viaja en el encargo). */
export type EstadoDatosWyscout = {
  calculadoEn: string;
  pasada?: {
    empezadaEn: string;
    terminadaEn?: string;
    modo?: ModoPasada;
    motivo?: string;
    ok: boolean;
    /** El paso en el que se quedó, si no terminó bien. */
    quedoEn?: string;
    equipos: { bajados: number; deUnTotal: number };
    lotes: { bajados: number; deUnTotal: number };
    /** Lo que esta pasada tenía que bajar y no bajó: la siguiente empieza por ahí. */
    pendientes: string[];
  };
  /** La última jornada jugada con los partidos de todos los equipos. */
  ultimaCompleta: { jornada: number; fecha: string } | null;
  /** El último partido del Castilla que tienen los datos. */
  ultimoCastilla: { jornada: number; fecha: string; rival: string } | null;
  /** Jornadas ya jugadas a las que les falta algún partido. */
  faltan: { jornada: number; fecha: string; que: string; abierta: boolean }[];
  equipos: number;
};

/* ------------------------------------------------------------------ */
/*  LO QUE HAY EN LA CARPETA                                           */
/* ------------------------------------------------------------------ */

/** Un «Team Stats <equipo>.xlsx»: su nombre en Wyscout y con qué nombre sale en sus filas. */
export type FicheroEquipo = {
  /** El nombre del fichero y de la rejilla de Wyscout («Águilas»). */
  equipo: string;
  /** El nombre con el que salen sus filas (puede no ser el mismo). */
  fila: string;
  /** Cuándo se bajó (el punto de control o, si no está, la fecha del fichero). */
  bajadoEn: string;
};

const dia = (iso: string) => iso.slice(0, 10);

/** El día de Madrid de una hora ISO («2026-11-02T23:30Z» → «2026-11-03»). */
export function diaDeMadrid(iso: string) {
  const t = Date.parse(iso);

  return Number.isFinite(t) ? new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) : "";
}

const fechaCorta = (iso: string) => {
  const [, m, d] = dia(iso).split("-");

  return `${d}/${m}`;
};

/** Hace más de esto de la última pasada completa: se repasa todo. */
export const COMPLETA_CADA_DIAS = 28;

/** El último partido de cada equipo (por el nombre de sus filas), sólo en la competición dada. */
function ultimoDe(partidos: FilaPartido[], competicion: string | null) {
  const ultimo = new Map<string, string>();

  for (const p of partidos) {
    if (competicion && p.competicion !== competicion) continue;

    if (!p.fecha) continue;

    const previo = ultimo.get(p.equipo);

    if (!previo || p.fecha > previo) ultimo.set(p.equipo, dia(p.fecha));
  }

  return ultimo;
}

/** Se bajó el mismo día del partido (o antes): Wyscout puede no haberlo cerrado. */
const provisional = (bajadoEn: string | undefined, partido: string | null | undefined) =>
  Boolean(bajadoEn && partido && diaDeMadrid(bajadoEn) <= partido);

/* ------------------------------------------------------------------ */
/*  QUÉ EQUIPOS HAY QUE BAJAR                                          */
/* ------------------------------------------------------------------ */

export type PlanEquipos = {
  modo: ModoPasada;
  motivo: string;
  /** Por nombre de Wyscout; en modo completo, vacío (= todos). */
  equipos: string[];
  /** Por qué cada uno. */
  porque: Record<string, string>;
};

export function planEquipos({
  partidos,
  calendario,
  hoy,
  ficheros,
  punto,
  completo = false,
  ahora = Date.now(),
}: {
  partidos: FilaPartido[];
  calendario: PartidoCalendario[];
  hoy: string;
  ficheros: FicheroEquipo[];
  punto: PuntoControlWyscout;
  completo?: boolean;
  ahora?: number;
}): PlanEquipos {
  const entera = (motivo: string): PlanEquipos => ({ modo: "completa", motivo, equipos: [], porque: {} });

  if (completo) return entera("pedida completa, desde cero");

  if (ficheros.length < 10) return entera("en la carpeta hay menos de diez equipos");

  if (!calendario.length) return entera("sin el calendario de BeSoccer no se sabe qué se ha jugado");

  const reparto = repartoWyscout(partidos, calendario, hoy);

  if (!reparto) return entera("los datos que hay no casan con el calendario del Castilla");

  const ultimaCompleta = Date.parse(punto.ultimaCompleta ?? "");

  if (Number.isFinite(ultimaCompleta) && ahora - ultimaCompleta > COMPLETA_CADA_DIAS * 86_400_000) {
    return entera(`hace más de ${COMPLETA_CADA_DIAS / 7} semanas de la última completa: se repasa todo por si Wyscout ha corregido algo`);
  }

  const porFila = new Map(ficheros.map((f) => [f.fila, f]));

  const porque: Record<string, string> = {};

  /* 1. Los partidos que faltan en jornadas ya jugadas (aplazados incluidos). */
  for (const j of reparto.jornadas) {
    if (!j.jugada) continue;

    for (const e of j.faltan) {
      const fichero = porFila.get(e);

      if (!fichero) return entera(`${e} no tiene fichero propio en la carpeta`);

      porque[fichero.equipo] ??= `le falta el partido de la J${j.jornada}${j.abierta ? " (la jornada sigue abierta)" : ""}`;
    }
  }

  /* 2. Los que se bajaron el mismo día de su último partido. */
  const ultimo = ultimoDe(partidos, reparto.competicion);

  for (const f of ficheros) {
    if (porque[f.equipo]) continue;

    if (provisional(f.bajadoEn, ultimo.get(f.fila))) porque[f.equipo] = `se bajó el mismo día de su partido del ${fechaCorta(ultimo.get(f.fila)!)}`;
  }

  const equipos = Object.keys(porque).sort((a, b) => a.localeCompare(b, "es"));

  return {
    modo: "incremental",
    motivo: equipos.length ? `sólo lo nuevo: ${equipos.length} de ${ficheros.length} equipos` : "no se ha jugado nada nuevo desde la última vez",
    equipos,
    porque,
  };
}

/* ------------------------------------------------------------------ */
/*  QUÉ LOTES DE JUGADORES HAY QUE BAJAR                               */
/* ------------------------------------------------------------------ */

export type PlanJugadores = {
  modo: ModoPasada;
  motivo: string;
  /** En modo completo, vacío (= todos, con los lotes de siempre de 7). */
  lotes: { numero: number; equipos: string[]; porque: string }[];
  /** El último partido de cada equipo (por nombre de Wyscout), para apuntarlo al bajar sus jugadores. */
  ultimoPartido: Record<string, string | null>;
};

export function planJugadores({
  partidos,
  calendario,
  hoy,
  ficheros,
  punto,
  completo = false,
  existe,
}: {
  partidos: FilaPartido[];
  calendario: PartidoCalendario[];
  hoy: string;
  ficheros: FicheroEquipo[];
  punto: PuntoControlWyscout;
  completo?: boolean;
  /** ¿Está «Player Stats N.xlsx» en la carpeta? */
  existe: (numero: number) => boolean;
}): PlanJugadores {
  const reparto = calendario.length ? repartoWyscout(partidos, calendario, hoy) : null;

  const ultimo = ultimoDe(partidos, reparto?.competicion ?? null);

  const ultimoPartido: Record<string, string | null> = Object.fromEntries(ficheros.map((f) => [f.equipo, ultimo.get(f.fila) ?? null]));

  const entera = (motivo: string): PlanJugadores => ({ modo: "completa", motivo, lotes: [], ultimoPartido });

  if (completo) return entera("pedida completa, desde cero");

  const lotes = punto.lotes ?? [];

  if (!lotes.length) return entera("es la primera pasada que lleva la cuenta de los jugadores");

  const enLotes = new Set(lotes.flat());

  const nuevo = ficheros.find((f) => !enLotes.has(f.equipo));

  if (nuevo) return entera(`${nuevo.equipo} no estaba en los lotes de la última vez`);

  const suyos = punto.jugadores ?? {};

  const toca: PlanJugadores["lotes"] = [];

  lotes.forEach((equipos, i) => {
    const numero = i + 1;

    if (!existe(numero)) {
      toca.push({ numero, equipos, porque: "no está su fichero en la carpeta" });

      return;
    }

    for (const e of equipos) {
      const visto = suyos[e];

      const partido = ultimoPartido[e] ?? null;

      if (!visto) {
        toca.push({ numero, equipos, porque: `${e} no tiene sus jugadores apuntados` });

        return;
      }

      if (partido && (!visto.ultimoPartido || partido > visto.ultimoPartido)) {
        toca.push({ numero, equipos, porque: `${e} ha jugado el ${fechaCorta(partido)}` });

        return;
      }

      if (provisional(visto.bajadoEn, partido)) {
        toca.push({ numero, equipos, porque: `${e}: se bajó el mismo día de su partido` });

        return;
      }
    }
  });

  return {
    modo: "incremental",
    motivo: toca.length ? `sólo lo nuevo: ${toca.length} de ${lotes.length} lotes` : "ningún equipo ha jugado desde la última vez",
    lotes: toca,
    ultimoPartido,
  };
}

/* ------------------------------------------------------------------ */
/*  CÓMO QUEDAN LOS DATOS                                              */
/* ------------------------------------------------------------------ */

export function estadoDatos({
  partidos,
  calendario,
  hoy,
  punto,
  ahora = new Date().toISOString(),
}: {
  partidos: FilaPartido[];
  calendario: PartidoCalendario[];
  hoy: string;
  punto: PuntoControlWyscout;
  ahora?: string;
}): EstadoDatosWyscout {
  const reparto = calendario.length ? repartoWyscout(partidos, calendario, hoy) : null;

  const completas = (reparto?.jornadas ?? []).filter((j) => j.jugada && j.faltan.length === 0);

  const ultima = completas[completas.length - 1];

  const alcance = calendario.length ? alcanceWyscout(partidos, calendario, hoy) : null;

  const faltan = calendario.length
    ? pendientesWyscout(partidos, calendario, hoy).map((p) => ({
        jornada: p.jornada,
        fecha: p.fecha,
        que: p.partido ?? (p.faltan.length > 4 ? `${p.faltan.slice(0, 4).join(", ")} y ${p.faltan.length - 4} más` : p.faltan.join(", ")),
        abierta: p.abierta,
      }))
    : [];

  const p = punto.pasada;

  let pasada: EstadoDatosWyscout["pasada"];

  if (p) {
    const ok = p.codigo === 0 || p.codigo === 3;

    const planE = p.plan?.equipos ?? [];

    const planL = p.plan?.lotes ?? [];

    const hechosE = new Set(p.hechos?.equipos ?? []);

    const hechosL = new Set(p.hechos?.lotes ?? []);

    const pendientes = [
      ...planE.filter((e) => !hechosE.has(e)).map((e) => `equipo ${e}`),
      ...planL.filter((n) => !hechosL.has(n)).map((n) => `lote ${n} de jugadores${punto.lotes?.[n - 1] ? ` (${punto.lotes[n - 1].join(", ")})` : ""}`),
    ];

    pasada = {
      empezadaEn: p.empezadaEn,
      ...(p.terminadaEn ? { terminadaEn: p.terminadaEn } : {}),
      ...(p.modo ? { modo: p.modo } : {}),
      ...(p.motivo ? { motivo: p.motivo } : {}),
      ok,
      /* Con el 8 la pasada llegó al final (publicó lo bajado): no se «quedó» en ningún paso, le faltó algo. */
      ...(!ok && p.codigo !== 8 && p.paso && p.paso !== "hecha" ? { quedoEn: NOMBRE_PASO[p.paso] } : {}),
      equipos: { bajados: hechosE.size, deUnTotal: planE.length },
      lotes: { bajados: hechosL.size, deUnTotal: planL.length },
      pendientes: ok && !p.incompleto?.length ? [] : pendientes,
    };
  }

  return {
    calculadoEn: ahora,
    ...(pasada ? { pasada } : {}),
    ultimaCompleta: ultima ? { jornada: ultima.jornada, fecha: dia(ultima.cuando) } : null,
    ultimoCastilla:
      alcance && alcance.jornada !== null && alcance.fecha ? { jornada: alcance.jornada, fecha: alcance.fecha, rival: alcance.rival } : null,
    faltan,
    equipos: reparto?.equipos.length ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/*  POR QUÉ HA FALLADO, EN CLARO                                       */
/* ------------------------------------------------------------------ */

const RED =
  /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_NETWORK|ERR_TIMED_OUT|getaddrinfo|Could not resolve host|unable to access|Failed to connect/i;

export type FalloExplicado = { paso: string; porque: string; ahora: string };

/** Lo que pasó y qué hacer, para quien mira Ajustes (sin mandar a mirar un registro). */
export function explicaFallo(codigo: number, pasada?: PasadaWyscout | null): FalloExplicado | null {
  if (codigo === 0 || codigo === 3) return null;

  const detalle = pasada?.fallo?.detalle ?? "";

  const enPaso = (paso: PasoWyscout) => NOMBRE_PASO[pasada?.fallo?.paso ?? pasada?.paso ?? paso] ?? NOMBRE_PASO[paso];

  const sigue = "Vuelve a pulsar «Traer y publicar»: sigue desde lo que faltaba, sin repetir lo ya bajado.";

  if (RED.test(detalle) && codigo !== 2 && codigo !== 6) {
    return {
      paso: enPaso(codigo === 4 ? "publicar" : "equipos"),
      porque: "el ordenador del club se ha quedado sin conexión a internet",
      ahora: `Comprueba la red del ordenador del club. ${sigue}`,
    };
  }

  switch (codigo) {
    case 2:
      return {
        paso: NOMBRE_PASO.entrar,
        porque: "la sesión de Wyscout ha caducado y la cuenta guardada no ha podido entrar sola (contraseña cambiada o sin guardar)",
        ahora: "En el ordenador del club, doble clic en scripts\\guardar-clave-wys.cmd y escribe la cuenta del Castilla. Luego vuelve a pulsar «Traer y publicar».",
      };

    case 6:
      return {
        paso: NOMBRE_PASO.entrar,
        porque: "Wyscout está abierto con otra cuenta, que no deja bajar todas las columnas",
        ahora: "En el ordenador del club, doble clic en scripts\\cambiar-cuenta-wys.cmd y entra con la cuenta del Castilla. Luego vuelve a pulsar «Traer y publicar».",
      };

    case 7:
      return /ocupado/i.test(detalle)
        ? {
            paso: NOMBRE_PASO.entrar,
            porque: "el análisis del partido estaba usando el Chrome de Wyscout desde hacía hora y media",
            ahora: "Espera a que termine el análisis del partido y vuelve a pedirlo.",
          }
        : {
            paso: enPaso("equipos"),
            porque: "el Chrome de Wyscout dejó de responder incluso después de reiniciarlo (ordenador bloqueado, sin red o sin memoria)",
            ahora: `Comprueba que el ordenador del club está encendido, desbloqueado y con internet. ${sigue}`,
          };

    case 8: {
      const que = pasada?.incompleto ?? [];

      const tope = que.some((q) => /500/.test(q));

      return {
        paso: que.some((q) => /jugador|lote/i.test(q)) && !que.some((q) => /^equipos sin bajar/i.test(q)) ? NOMBRE_PASO.jugadores : NOMBRE_PASO.equipos,
        porque: tope
          ? "un lote de jugadores pasa de 500 filas, el tope de Wyscout por descarga, y vino recortado"
          : `quedó a medias: ${que.join(" · ") || "faltan equipos o jugadores"}. Lo que sí bajó ya está publicado`,
        ahora: tope ? "Avisa para partir ese lote en dos; lo demás está publicado." : sigue,
      };
    }

    case 5:
      return {
        paso: NOMBRE_PASO.releer,
        porque: "uno de los Excel bajados no se deja leer (una descarga a medias): no se ha publicado nada para no estropear lo que hay",
        ahora: "Pulsa «Repetir sólo lo que falló» o vuelve a pedirlo: no se vuelve a bajar lo que ya está.",
      };

    case 4:
      return {
        paso: NOMBRE_PASO.publicar,
        porque: "los datos están bajados, pero la subida a GitHub no ha salido",
        ahora: "Vuelve a pedirlo cuando el ordenador del club tenga internet: sólo publica, no vuelve a bajar.",
      };

    case 9:
      return {
        paso: NOMBRE_PASO.publicar,
        porque: "en el ordenador del club hay cambios de código sin subir y esta tarea no publica trabajo ajeno",
        ahora: "Que alguien revise y suba esos cambios en el ordenador del club; después, vuelve a pedirlo.",
      };

    case 1: {
      const paso = enPaso("equipos");

      if (/columnas/i.test(detalle)) {
        return { paso, porque: "Wyscout ha entregado el Excel sin todas las columnas y no se ha usado", ahora: sigue };
      }

      if (/No (se abre|sale|encuentro)|Platform|no aparece|no carga/i.test(detalle)) {
        return {
          paso,
          porque: "la web de Wyscout no ha cargado como siempre (lenta, caída un momento o con un cambio de diseño)",
          ahora: `${sigue} Si falla dos veces seguidas en el mismo sitio, avisa para revisarlo.`,
        };
      }

      return { paso, porque: "la descarga se ha cortado a medias", ahora: sigue };
    }

    default:
      return { paso: enPaso("equipos"), porque: `se ha cortado sin decir por qué (código ${codigo})`, ahora: sigue };
  }
}

/** El texto del resultado: lo que sale en Ajustes y en el aviso al terminar. */
export function resultadoWyscout(codigo: number, punto: PuntoControlWyscout | null): { ok: boolean; texto: string } {
  const pasada = punto?.pasada ?? null;

  const fallo = explicaFallo(codigo, pasada);

  if (fallo) return { ok: false, texto: `Falló en «${fallo.paso}»: ${fallo.porque}. Qué hacer: ${fallo.ahora}` };

  const e = pasada?.hechos?.equipos.length ?? 0;

  const l = pasada?.hechos?.lotes.length ?? 0;

  const bajado =
    pasada?.modo === "completa"
      ? "pasada completa"
      : e || l
        ? `sólo lo nuevo: ${e} ${e === 1 ? "equipo" : "equipos"} y ${l} ${l === 1 ? "lote" : "lotes"} de jugadores`
        : "no se había jugado nada nuevo: no ha hecho falta bajar nada";

  return {
    ok: true,
    texto: codigo === 0 ? `Publicado (${bajado}): la plataforma lo tiene en un par de minutos` : `Al día (${bajado}); no había nada nuevo que publicar`,
  };
}
