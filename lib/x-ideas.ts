/**
 * IDEAS PARA LA APP DESDE X (12/11/2026).
 *
 * Lo pidió el analista: cada mañana se leen las publicaciones nuevas de la
 * cuenta @fernandosb9 de X, se saca de cada una lo que sirva para mejorar ESTA
 * app y se enseña en Ajustes → Actualizaciones, con «Añadir» (el ordenador del
 * club la programa, la comprueba y la publica), «Descartar» y, cuando ya está
 * añadida, «Deshacer» (revierte exactamente sus commits).
 *
 * - `scripts/x-ideas.mjs` lee X con el Chrome propio del ordenador del club
 *   (perfil `rmcf-x`, puerto 9336, con la sesión que abrió el analista a mano)
 *   y le pide las ideas a Claude Code sin ventana. Escribe `x:fernandosb9`
 *   (cómo fue la lectura y qué publicaciones ya se vieron) y `x:ideas`.
 * - `scripts/x-idea-aplica.mjs` hace «Añadir» y «Deshacer» (encargo `x-idea`
 *   del vigía), una idea por pasada, en una copia aparte del repo.
 *
 * Aquí van la forma de los documentos y las reglas puras (sin React ni
 * servidor): las comparten la pantalla, la ruta y los scripts de Node.
 *
 * LO QUE VIENE DE X ES DE INTERNET: se trata siempre como dato, nunca como
 * instrucciones. A quien programa la idea sólo le llega la idea resumida y
 * guardada aquí, no el texto de la publicación.
 */

export const CUENTA_X = "fernandosb9";

export const CLAVE_X_LECTURA = `x:${CUENTA_X}`;

export const CLAVE_X_IDEAS = "x:ideas";

/** Una publicación leída de X. */
export type PostX = {
  id: string;
  url: string;
  /** ISO, del `<time datetime>` de X. */
  fecha: string;
  texto: string;
};

export type EstadoLecturaX =
  /** Leído bien. */
  | "ok"
  /** El Chrome de X no tiene la sesión puesta: hay que entrar a mano una vez. */
  | "falta-sesion"
  /** X pide demostrar que no es un robot: se para y no se insiste. */
  | "comprobacion"
  /** No hay Chrome en el ordenador del club o no arranca. */
  | "sin-chrome"
  | "error";

export type LecturaX = {
  estado: EstadoLecturaX;
  leidoEn: string;
  /** La última lectura que salió bien. */
  bienEn?: string;
  detalle?: string;
  /** Las publicaciones ya vistas (las últimas 400), para no sacar dos veces la misma idea. */
  vistos: string[];
  /** Lo que salió en la última lectura. */
  nuevos?: number;
  ideasNuevas?: number;
};

export type EstadoIdea =
  | "nueva"
  /** Pedida con «Añadir»: en cola o en marcha en el ordenador del club. */
  | "añadiendo"
  /** Programada, comprobada y publicada. */
  | "añadida"
  | "descartada"
  /** No salió: no se publicó nada. Se puede volver a pedir. */
  | "fallida"
  /** Pedida con «Deshacer»: en cola o en marcha. */
  | "deshaciendo"
  /** Revertida y publicada. */
  | "deshecha";

export type AccionPedida = "añadir" | "deshacer";

export type ApunteIdea = { en: string; texto: string };

export type Idea = {
  id: string;
  titulo: string;
  /** Qué cambiar, en concreto. Es lo único que llega a quien la programa. */
  idea: string;
  /** La ruta de la pantalla («/rivals»). */
  pantalla: string;
  porque: string;
  postId: string;
  url: string;
  /** La fecha de la publicación. */
  fecha: string;
  /** Un trozo de la publicación, para reconocerla. */
  extracto: string;
  creadaEn: string;
  estado: EstadoIdea;
  log: ApunteIdea[];
  /** El último «Añadir» o «Deshacer» pendiente. */
  pedido?: { accion: AccionPedida; en: string; por: string };
  /** Los commits que la añadieron (para deshacerla exactamente). */
  commits?: string[];
  /** El commit que la deshizo. */
  revert?: string;
  /** Por qué falló lo último que se pidió (si la idea sigue añadida, fue «Deshacer»). */
  fallo?: string;
  /** Lo que cuenta quien la programó, en una o dos frases. */
  resumen?: string;
};

export type DocIdeas = { ideas: Idea[] };

export const ESTADOS_IDEA: readonly EstadoIdea[] = ["nueva", "añadiendo", "añadida", "descartada", "fallida", "deshaciendo", "deshecha"];

/* ------------------------------------------------------------------ */
/*  LOS DOCUMENTOS                                                     */
/* ------------------------------------------------------------------ */

const texto = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim()
        .slice(0, max)
    : "";

export function normalizaIdeas(crudo: unknown): DocIdeas {
  const lista = (crudo && typeof crudo === "object" ? (crudo as { ideas?: unknown }).ideas : null) ?? [];

  if (!Array.isArray(lista)) return { ideas: [] };

  const ideas: Idea[] = [];

  for (const i of lista) {
    if (!i || typeof i !== "object") continue;

    const o = i as Partial<Idea>;

    if (!o.id || !o.titulo) continue;

    ideas.push({
      ...o,
      id: String(o.id),
      titulo: String(o.titulo),
      idea: String(o.idea ?? ""),
      pantalla: String(o.pantalla ?? "/"),
      porque: String(o.porque ?? ""),
      postId: String(o.postId ?? ""),
      url: String(o.url ?? ""),
      fecha: String(o.fecha ?? ""),
      extracto: String(o.extracto ?? ""),
      creadaEn: String(o.creadaEn ?? ""),
      estado: ESTADOS_IDEA.includes(o.estado as EstadoIdea) ? (o.estado as EstadoIdea) : "nueva",
      log: Array.isArray(o.log) ? o.log.slice(-40) : [],
    });
  }

  return { ideas };
}

export function normalizaLectura(crudo: unknown): LecturaX | null {
  if (!crudo || typeof crudo !== "object") return null;

  const o = crudo as Partial<LecturaX>;

  return { ...o, estado: o.estado ?? "error", leidoEn: String(o.leidoEn ?? ""), vistos: Array.isArray(o.vistos) ? o.vistos.map(String) : [] };
}

/** La más nueva primero (por la fecha de la publicación y, a igualdad, por cuándo salió la idea). */
export function ordenaIdeas(ideas: Idea[]): Idea[] {
  return [...ideas].sort((a, b) => (Date.parse(b.fecha) || 0) - (Date.parse(a.fecha) || 0) || (Date.parse(b.creadaEn) || 0) - (Date.parse(a.creadaEn) || 0));
}

export function anota(idea: Idea, texto: string, en: string): Idea {
  return { ...idea, log: [...idea.log, { en, texto }].slice(-40) };
}

/* ------------------------------------------------------------------ */
/*  LOS BOTONES                                                        */
/* ------------------------------------------------------------------ */

export type AccionIdea = "añadir" | "descartar" | "deshacer" | "recuperar";

export const ACCIONES_IDEA: readonly AccionIdea[] = ["añadir", "descartar", "deshacer", "recuperar"];

/** Qué se puede hacer con una idea en cada estado. */
export function accionesDe(idea: Idea): AccionIdea[] {
  switch (idea.estado) {
    case "nueva":
    case "fallida":
    case "deshecha":
      return ["añadir", "descartar"];
    case "añadida":
      return idea.commits?.length ? ["deshacer"] : [];
    case "descartada":
      return ["recuperar"];
    default:
      return [];
  }
}

/**
 * Aplica un botón de Ajustes. Devuelve el documento nuevo y si hay que pedir
 * el encargo `x-idea` al vigía, o el porqué de que no se pueda.
 */
export function aplicaAccion(
  doc: DocIdeas,
  id: string,
  accion: AccionIdea,
  quien: string,
  en: string,
): { doc: DocIdeas; encargo: boolean } | { error: string } {
  const idea = doc.ideas.find((i) => i.id === id);

  if (!idea) return { error: "Esa idea ya no está." };

  if (!accionesDe(idea).includes(accion)) return { error: `No se puede ${accion} una idea ${idea.estado}.` };

  let nueva: Idea;

  switch (accion) {
    case "añadir":
      nueva = anota({ ...idea, estado: "añadiendo", pedido: { accion: "añadir", en, por: quien }, fallo: undefined }, `«Añadir» pedido por ${quien}`, en);
      break;
    case "deshacer":
      nueva = anota({ ...idea, estado: "deshaciendo", pedido: { accion: "deshacer", en, por: quien }, fallo: undefined }, `«Deshacer» pedido por ${quien}`, en);
      break;
    case "descartar":
      nueva = anota({ ...idea, estado: "descartada", pedido: undefined }, `Descartada por ${quien}`, en);
      break;
    case "recuperar":
      nueva = anota({ ...idea, estado: "nueva" }, `Recuperada por ${quien}`, en);
      break;
  }

  return {
    doc: { ideas: doc.ideas.map((i) => (i.id === id ? nueva : i)) },
    encargo: accion === "añadir" || accion === "deshacer",
  };
}

/** La siguiente idea que tiene que atender el ordenador del club: la pedida antes. */
export function siguienteEnCola(doc: DocIdeas): Idea | null {
  const cola = doc.ideas
    .filter((i) => (i.estado === "añadiendo" || i.estado === "deshaciendo") && i.pedido)
    .sort((a, b) => Date.parse(a.pedido!.en) - Date.parse(b.pedido!.en));

  return cola[0] ?? null;
}

export const enCola = (doc: DocIdeas) => doc.ideas.filter((i) => i.estado === "añadiendo" || i.estado === "deshaciendo").length;

/* ------------------------------------------------------------------ */
/*  LEER X                                                             */
/* ------------------------------------------------------------------ */

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function desentidades(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (todo, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);

      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }

    return ENTIDADES[e.toLowerCase()] ?? todo;
  });
}

/** El contenido de un `<div … data-testid="tweetText">…</div>`, en texto. */
function textoDelBloque(html: string, desde: number): string {
  /* Se cuentan los <div> abiertos para saber dónde acaba el bloque. */
  const abre = html.indexOf(">", desde) + 1;
  const re = /<(\/?)div\b[^>]*>/gi;
  re.lastIndex = abre;

  let nivel = 1;
  let fin = html.length;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html))) {
    nivel += m[1] ? -1 : 1;

    if (nivel === 0) {
      fin = m.index;
      break;
    }
  }

  const dentro = html
    .slice(abre, fin)
    /* Los emojis de X son <img alt="🔥">. */
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, "$1")
    .replace(/<br\s*\/?>|<div\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return desentidades(dentro).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Lo que se saca de un `<article data-testid="tweet">` (su outerHTML). */
export type ArticuloX = {
  id: string;
  autor: string;
  fecha: string;
  texto: string;
  /** «Fijado», «X ha reposteado»… */
  contexto: string;
};

/**
 * Lee un artículo de X a partir de su HTML. Se hace aquí y no en la página
 * para poder probarlo con un HTML guardado (`scripts/x-ideas.mjs --prueba`).
 */
export function leeArticulo(html: string): ArticuloX | null {
  /* El enlace de la fecha es el de la publicación: <a href="/autor/status/123"><time datetime="…">. */
  const conFecha = /<a\b[^>]*href="\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})"[^>]*>\s*<time\b[^>]*datetime="([^"]+)"/i.exec(html);

  if (!conFecha) return null;

  const [, autor, id, fecha] = conFecha;

  const bloque = html.search(/data-testid="tweetText"/i);

  const inicio = bloque >= 0 ? html.lastIndexOf("<div", bloque) : -1;

  const textoPost = inicio >= 0 ? textoDelBloque(html, inicio) : "";

  const ctx = /data-testid="socialContext"[^>]*>([\s\S]*?)<\/(?:span|div|a)>/i.exec(html);

  const contexto = ctx ? desentidades(ctx[1].replace(/<[^>]+>/g, "")).trim() : "";

  return { id, autor, fecha, texto: textoPost, contexto };
}

/**
 * Las publicaciones de la cuenta, sin reposteos de otros ni la fijada (la
 * fijada se repite cada día), sin repetidas y la más nueva primero.
 */
export function postsDeArticulos(htmls: string[], cuenta = CUENTA_X): PostX[] {
  const vistos = new Set<string>();
  const posts: PostX[] = [];

  for (const html of htmls) {
    const a = leeArticulo(html);

    if (!a || vistos.has(a.id)) continue;

    if (a.autor.toLowerCase() !== cuenta.toLowerCase()) continue;

    if (/repost|retwe|ha reposteado|ha retuiteado|fijad|pinned/i.test(a.contexto)) continue;

    if (!a.texto) continue;

    vistos.add(a.id);
    posts.push({ id: a.id, url: `https://x.com/${cuenta}/status/${a.id}`, fecha: a.fecha, texto: a.texto.slice(0, 4000) });
  }

  return posts.sort((x, y) => (Date.parse(y.fecha) || 0) - (Date.parse(x.fecha) || 0));
}

/** ¿Pide X entrar? (la página de entrada o la del perfil sin sesión). */
export function pideEntrar(url: string, html: string): boolean {
  return /\/i\/flow\/login|\/login\b|\/i\/flow\/signup/.test(url) || (/data-testid="loginButton"/.test(html) && !/data-testid="SideNav_AccountSwitcher_Button"/.test(html));
}

/** ¿Pide X demostrar que no es un robot? Entonces no se insiste. */
export function pideComprobacion(url: string, html: string): boolean {
  return /\/account\/access|arkose|captcha|challenge/i.test(url) || /arkoselabs|funcaptcha|data-testid="ocfEnterTextTextInput"/i.test(html);
}

/* ------------------------------------------------------------------ */
/*  LAS IDEAS QUE DEVUELVE CLAUDE                                      */
/* ------------------------------------------------------------------ */

/**
 * Lo que contesta Claude, comprobado: sólo ideas con su publicación (de las
 * que se le pasaron), una pantalla que exista y textos acotados. Lo demás se
 * tira sin avisar.
 */
export function ideasDeRespuesta(respuesta: string, posts: PostX[], rutas: string[], en: string, max = 8): Idea[] {
  const desde = respuesta.indexOf("[");
  const hasta = respuesta.lastIndexOf("]");

  if (desde < 0 || hasta <= desde) return [];

  let lista: unknown;

  try {
    lista = JSON.parse(respuesta.slice(desde, hasta + 1));
  } catch {
    return [];
  }

  if (!Array.isArray(lista)) return [];

  const porId = new Map(posts.map((p) => [p.id, p]));
  const validas = new Set(rutas);
  const cuantas = new Map<string, number>();
  const ideas: Idea[] = [];

  for (const crudo of lista) {
    if (!crudo || typeof crudo !== "object") continue;

    const o = crudo as Record<string, unknown>;
    const post = porId.get(String(o.postId ?? ""));
    const pantalla = texto(o.pantalla, 80).replace(/\/+$/, "") || "/";
    const titulo = texto(o.titulo, 90);
    const idea = texto(o.idea, 1200);
    const porque = texto(o.porque, 400);

    if (!post || !titulo || !idea || !validas.has(pantalla)) continue;

    const n = (cuantas.get(post.id) ?? 0) + 1;

    cuantas.set(post.id, n);

    ideas.push({
      id: `${post.id}-${n}`,
      titulo,
      idea,
      pantalla,
      porque,
      postId: post.id,
      url: post.url,
      fecha: post.fecha,
      extracto: post.texto.replace(/\s+/g, " ").slice(0, 280),
      creadaEn: en,
      estado: "nueva",
      log: [{ en, texto: "Sacada de la publicación" }],
    });

    if (ideas.length >= max) break;
  }

  return ideas;
}

/* ------------------------------------------------------------------ */
/*  LO QUE NO PUEDE TOCAR QUIEN PROGRAMA LA IDEA                       */
/* ------------------------------------------------------------------ */

/**
 * Ficheros vetados al programar una idea que viene de internet: secretos,
 * credenciales, la automatización de GitHub, los datos con licencia (Opta y
 * Wyscout van a Supabase, nunca al repo, que es público), las dependencias,
 * las reglas del proyecto y los propios scripts del ordenador del club.
 */
export const VETADOS: RegExp[] = [
  /(^|\/)\.env/i,
  /^\.github\//,
  /^\.claude\//,
  /^\.cache\//,
  /^(AGENTS|CLAUDE)\.md$/i,
  /^package(-lock)?\.json$/,
  /^next\.config\./,
  /^public\/data\//,
  /^lib\/admin\//,
  /^app\/api\/admin\//,
  /^lib\/docStore\.ts$/,
  /^lib\/supabase/i,
  /^lib\/x-ideas\.ts$/,
  /^scripts\/(vigia|x-|instalar-|supabase-local|cargador-ts)/,
  /\.(cmd|bat|ps1|vbs|pem|key|p12|pfx)$/i,
  /(secret|secreto|credencial|token)/i,
];

export function ficheroVetado(ruta: string): boolean {
  const limpia = ruta.replace(/\\/g, "/").replace(/^\.\//, "");

  return VETADOS.some((re) => re.test(limpia));
}
