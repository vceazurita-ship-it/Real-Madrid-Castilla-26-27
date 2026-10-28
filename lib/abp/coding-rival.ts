/**
 * CODING DEL ABP DEL RIVAL (28/10/2026).
 *
 * La carpeta de cada jornada (`ABP\RIVAL\ABP - 10 CARTAGENA\ABP\CORNER OF\
 * CORNER OF-17.mov`…) se criba en el navegador: el analista se queda con un
 * 15 % aprox., escribe la nota de los elegidos, etiqueta de un toque y sale
 * el texto para el cuerpo técnico con su formato de siempre. Las etiquetas
 * las fijó el experto de fútbol; cuentan también las de los descartados.
 *
 * Aquí sólo lo puro: carpetas, estado, etiquetas, resumen y texto.
 */

import type { Apunte, FaseAbp, TipoAbp } from "@/lib/abp/apuntes";

export type CarpetaKey = "CORNER OF" | "FALTA OF" | "SDB OF" | "CORNER DEF" | "FALTA DEF" | "SDB DEF";

/** En el orden del texto: primero todo lo ofensivo del rival, luego lo defensivo. */
export const CARPETAS: { key: CarpetaKey; fase: FaseAbp; tipo: TipoAbp; titulo: string; corto: string }[] = [
  { key: "CORNER OF", fase: "of", tipo: "corner", titulo: "CÓRNER", corto: "Córner OF" },
  { key: "FALTA OF", fase: "of", tipo: "falta", titulo: "FALTA", corto: "Falta OF" },
  { key: "SDB OF", fase: "of", tipo: "banda", titulo: "SBO", corto: "Banda OF" },
  { key: "CORNER DEF", fase: "def", tipo: "corner", titulo: "CÓRNER", corto: "Córner DEF" },
  { key: "FALTA DEF", fase: "def", tipo: "falta-lat", titulo: "FALTAS LAT", corto: "Falta DEF" },
  { key: "SDB DEF", fase: "def", tipo: "banda", titulo: "SBD", corto: "Banda DEF" },
];

export type Estado = "pendiente" | "elegido" | "descartado";

export type Etiquetas = Partial<Record<GrupoKey, string>>;

export type ClipEstado = {
  estado: Estado;
  nota?: string;
  /** Segundo del momento clave (golpeo, contacto, remate). */
  marca?: number;
  etiquetas?: Etiquetas;
  /** Dorsales de quien saca y quien remata («11», «5»): es lo que se dice en la charla. */
  saca?: string;
  remata?: string;
  /** Ya movido a «_descartados». */
  fuera?: boolean;
};

export type CodingDoc = { clips: Record<string, ClipEstado>; actualizado?: string };

export const CODING_VACIO: CodingDoc = { clips: {} };

export const codingKey = (carpeta: string) =>
  `abp-coding-rival:${carpeta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

/** «CORNER OF/17». */
export const idClip = (carpeta: CarpetaKey, n: number) => `${carpeta}/${n}`;

/** El número del clip por su nombre: «CORNER OF-17.mov» → 17. */
export function numeroDeArchivo(nombre: string): number | null {
  const m = /-(\d+)\.(mov|mp4|m4v)$/i.exec(nombre);

  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------ */
/*  LAS ETIQUETAS DE UN TOQUE (experto de fútbol, 28/10/2026)          */
/* ------------------------------------------------------------------ */

export type GrupoKey = "lado" | "pie" | "envio" | "zona" | "mecanismo" | "estructura" | "arriba" | "libre" | "desenlace" | "uso";

export const GRUPOS: { key: GrupoKey; titulo: string; soloDef?: boolean; opciones: string[] }[] = [
  { key: "lado", titulo: "Lado", opciones: ["Izquierda", "Derecha", "Central"] },
  { key: "pie", titulo: "Sacador", opciones: ["Zurdo", "Diestro"] },
  { key: "envio", titulo: "Envío", opciones: ["Aéreo al área", "Corto / 2 sacadores", "Raso atrás", "Directo a portería"] },
  { key: "zona", titulo: "Caída", opciones: ["1.er palo", "Centro", "2.º palo", "Frontal / rechace"] },
  { key: "mecanismo", titulo: "Mecanismo", opciones: ["Bloqueos", "Arrastres", "Cruce", "Desde palo / línea de fondo", "Ninguno"] },
  { key: "estructura", titulo: "Estructura", soloDef: true, opciones: ["Zonal", "Individual", "Mixta"] },
  { key: "arriba", titulo: "Se quedan arriba", soloDef: true, opciones: ["0", "1", "2", "3"] },
  { key: "libre", titulo: "Zona sin nadie", soloDef: true, opciones: ["1.er palo", "Centro", "2.º palo", "Frontal"] },
  { key: "desenlace", titulo: "Desenlace", opciones: ["Gol", "Remate a puerta", "Remate fuera", "Despeje", "Segunda jugada", "Falta"] },
  { key: "uso", titulo: "Para qué", opciones: ["Charla", "Entrenar nuestra defensa", "Explotar nosotros"] },
];

/** El cerrado/abierto sale solo del lado y del pie (córner desde la izquierda con diestro = cerrado). */
export function trayectoria(e: Etiquetas | undefined): "cerrado" | "abierto" | null {
  if (!e?.lado || !e.pie || e.lado === "Central") return null;

  const izquierda = e.lado === "Izquierda";

  return (izquierda && e.pie === "Diestro") || (!izquierda && e.pie === "Zurdo") ? "cerrado" : "abierto";
}

/* ------------------------------------------------------------------ */
/*  EL RESUMEN AUTOMÁTICO                                              */
/* ------------------------------------------------------------------ */

function masRepetido(valores: string[]): [string, number] | null {
  const cuenta = new Map<string, number>();

  for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);

  const [mejor] = [...cuenta].sort((a, b) => b[1] - a[1]);

  return mejor ?? null;
}

const NOMBRE_TIPO: Record<CarpetaKey, [string, string]> = {
  "CORNER OF": ["córner", "córners"],
  "FALTA OF": ["falta", "faltas"],
  "SDB OF": ["saque de banda", "saques de banda"],
  "CORNER DEF": ["córner defendido", "córners defendidos"],
  "FALTA DEF": ["falta defendida", "faltas defendidas"],
  "SDB DEF": ["saque de banda defendido", "saques de banda defendidos"],
};

const al = (zona: string) => (zona === "Frontal / rechace" ? "a la frontal o el rechace" : zona === "Frontal" ? "a la frontal" : `al ${zona.toLowerCase()}`);

/**
 * Una frase por carpeta con lo que más se repite, de todos los clips
 * etiquetados (también los descartados), siempre con su base: «4 córners: 3
 * de 4 al 1.er palo, 2 de 3 cerrados, saca el 11 (3 de 4)…». En lo
 * defensivo acaba en dónde les hacemos daño (experto de fútbol, 28/10/2026).
 */
export function resumenDe(carpeta: CarpetaKey, clips: [number, ClipEstado][]): string {
  const vistos = clips.map(([, c]) => c).filter((c) => (c.etiquetas && Object.values(c.etiquetas).some(Boolean)) || c.saca || c.remata);

  if (vistos.length === 0) return "";

  const et = vistos.map((c) => c.etiquetas ?? {});

  const partes: string[] = [];

  const de = (valores: (string | null | undefined)[], frase: (v: string) => string, minimo = 1) => {
    const con = valores.filter((v): v is string => Boolean(v));

    const top = masRepetido(con);

    /* La base es siempre el total de la carpeta, con los que no llevan esa etiqueta dichos aparte. */
    const sin = vistos.length - con.length;

    if (top && top[1] >= minimo) partes.push(`${frase(top[0])} (${top[1]} de ${vistos.length}${sin ? `, ${sin} sin marcar` : ""})`);
  };

  de(et.map((e) => e.zona), al);
  de(et.map(trayectoria), (v) => `${v}s`);
  de(vistos.map((c) => c.saca), (v) => `saca el ${v}`);
  de(vistos.map((c) => c.remata), (v) => `remata el ${v}`);
  de(et.map((e) => e.envio), (v) => `envío ${v.toLowerCase()}`, 2);
  de(et.map((e) => (e.mecanismo === "Ninguno" ? null : e.mecanismo)), (v) => `con ${v.toLowerCase()}`, 2);
  de(et.map((e) => e.estructura), (v) => `defienden ${v.toLowerCase()}`);

  const goles = et.filter((e) => e.desenlace === "Gol").length;

  if (goles) partes.push(`${goles} ${goles === 1 ? "gol" : "goles"}`);

  /* Lo defensivo lleva a una decisión: dónde les hacemos daño. */
  const def = CARPETAS.find((c) => c.key === carpeta)?.fase === "def";

  if (def) {
    const libre = masRepetido(et.map((e) => e.libre).filter((v): v is string => Boolean(v)));

    const arriba = masRepetido(et.map((e) => e.arriba).filter((v): v is string => Boolean(v)));

    const dano = [libre ? `${libre[0].toLowerCase()} sin nadie (${libre[1]})` : "", arriba ? `${arriba[0]} arriba` : ""].filter(Boolean);

    if (dano.length) partes.push(`dónde les hacemos daño: ${dano.join(", ")}`);
  }

  const [uno, varios] = NOMBRE_TIPO[carpeta];

  return partes.length ? `${vistos.length} ${vistos.length === 1 ? uno : varios}: ${partes.join(", ")}.` : "";
}

/* ------------------------------------------------------------------ */
/*  RUTINAS QUE REPITE Y CAMPOGRAMA (segunda fase, 28/10/2026)          */
/* ------------------------------------------------------------------ */

export type Rutina = { clave: string; texto: string; clips: number[] };

/**
 * La misma acción en dos o más clips de la carpeta (también descartados): el
 * mismo envío, la misma caída y el mismo mecanismo, y el mismo lado del
 * envío (cerrado/abierto) si consta. Hacen falta al menos dos de esos datos
 * para llamarla rutina: «aéreo al 1.er palo» a secas lo hace todo el mundo.
 */
export function rutinasDe(clips: [number, ClipEstado][]): Rutina[] {
  const grupos = new Map<string, { texto: string; clips: number[] }>();

  for (const [n, c] of clips) {
    const e = c.etiquetas ?? {};

    const partes = [e.envio, e.zona ? al(e.zona) : "", trayectoria(e), e.mecanismo && e.mecanismo !== "Ninguno" ? `con ${e.mecanismo.toLowerCase()}` : ""].filter(Boolean) as string[];

    const conMecanismo = Boolean(e.mecanismo && e.mecanismo !== "Ninguno");

    if (partes.length < 2 || (!conMecanismo && partes.length < 3)) continue;

    const clave = partes.join("|");

    const g = grupos.get(clave) ?? { texto: [e.envio?.toLowerCase(), e.zona ? al(e.zona) : "", trayectoria(e), conMecanismo ? `con ${e.mecanismo!.toLowerCase()}` : ""].filter(Boolean).join(", "), clips: [] };

    g.clips.push(n);
    grupos.set(clave, g);
  }

  return [...grupos]
    .filter(([, g]) => g.clips.length >= 2)
    .map(([clave, g]) => ({ clave, texto: g.texto, clips: g.clips.sort((a, b) => a - b) }))
    .sort((a, b) => b.clips.length - a.clips.length);
}

export const ZONAS_CAIDA = ["1.er palo", "Centro", "2.º palo", "Frontal / rechace"] as const;

/** Cuántas caen en cada zona, por el lado del saque (también descartados): para el campograma. */
export function caidasDe(clips: [number, ClipEstado][]) {
  const cuenta: Record<string, Record<string, number>> = {};

  let total = 0;

  for (const [, c] of clips) {
    const z = c.etiquetas?.zona;

    if (!z) continue;

    const lado = c.etiquetas?.lado ?? "Sin lado";

    cuenta[lado] ??= {};
    cuenta[lado][z] = (cuenta[lado][z] ?? 0) + 1;
    total++;
  }

  return { cuenta, total };
}

/* ------------------------------------------------------------------ */
/*  EL TEXTO PARA EL CUERPO TÉCNICO                                    */
/* ------------------------------------------------------------------ */

/** Orden dentro de cada tipo: gol, luego para explotar, luego lo demás por número. */
const peso = (c: ClipEstado) => (c.etiquetas?.desenlace === "Gol" ? 0 : c.etiquetas?.uso === "Explotar nosotros" ? 1 : 2);

/**
 * El texto de siempre: «ABP RIVAL CARTAGENA / OF / CÓRNER / 18: GOL: …».
 * Sale sólo lo elegido; un elegido sin nota lleva sus etiquetas para no
 * quedarse en un número suelto.
 */
export function textoCoding(rival: string, porCarpeta: Map<CarpetaKey, [number, ClipEstado][]>, conResumen: boolean): string {
  const lineas = [`ABP RIVAL ${rival.toUpperCase()}`];

  for (const fase of ["of", "def"] as const) {
    const carpetas = CARPETAS.filter((c) => c.fase === fase);

    const bloques = carpetas
      .map((c) => {
        const elegidos = (porCarpeta.get(c.key) ?? []).filter(([, e]) => e.estado === "elegido").sort((a, b) => peso(a[1]) - peso(b[1]) || a[0] - b[0]);

        if (!elegidos.length) return null;

        const resumen = conResumen ? resumenDe(c.key, porCarpeta.get(c.key) ?? []) : "";

        return [
          `        ${c.titulo}`,
          ...(resumen ? [`            (${resumen.replace(/\.$/, "")})`] : []),
          ...(conResumen
            ? rutinasDe(porCarpeta.get(c.key) ?? []).map((r) => `            RUTINA QUE REPITE (${r.clips.length} veces: ${r.clips.join(", ")}): ${r.texto.toUpperCase()}`)
            : []),
          ...elegidos.map(([n, e]) => {
            const gol = e.etiquetas?.desenlace === "Gol" && !/^gol\b/i.test(e.nota ?? "") ? "GOL: " : "";

            const texto = (e.nota ?? "").trim() || etiquetasEnTexto(e.etiquetas);

            return `            ${n}: ${gol}${texto.toUpperCase()}`;
          }),
          "",
        ].join("\n");
      })
      .filter(Boolean);

    if (!bloques.length) continue;

    lineas.push(fase === "of" ? "    OF" : "    DEF", ...(bloques as string[]));
  }

  return lineas.join("\n").trimEnd();
}

export function etiquetasEnTexto(e: Etiquetas | undefined) {
  if (!e) return "";

  const tray = trayectoria(e);

  return [e.envio, e.zona, tray, e.mecanismo !== "Ninguno" ? e.mecanismo : "", e.estructura, e.libre ? `${e.libre} sin nadie` : "", e.desenlace]
    .filter(Boolean)
    .join(" · ");
}

/** Los elegidos como apuntes del cuaderno del rival (pestaña «Apuntes y vídeo»), con su número de clip. */
export function aApuntes(porCarpeta: Map<CarpetaKey, [number, ClipEstado][]>, nuevoId: () => string): Apunte[] {
  return CARPETAS.flatMap((c) =>
    (porCarpeta.get(c.key) ?? [])
      .filter(([, e]) => e.estado === "elegido")
      .sort((a, b) => a[0] - b[0])
      .map(([n, e]) => ({
        id: nuevoId(),
        fase: c.fase,
        tipo: c.tipo,
        ref: { clase: "clip" as const, n },
        texto: ((e.etiquetas?.desenlace === "Gol" ? "GOL: " : "") + ((e.nota ?? "").trim() || etiquetasEnTexto(e.etiquetas))).toUpperCase(),
      })),
  );
}
