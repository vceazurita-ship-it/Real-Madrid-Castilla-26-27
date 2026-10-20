/*
|--------------------------------------------------------------------------
| EL GUION DEL VÍDEO RESUMEN
|--------------------------------------------------------------------------
|
| El vídeo cuenta lo mismo que el PDF del informe, entre uno y dos minutos y
| medio según lo que haya que enseñar (13/10/2026), y
| con producción: portada con los dos escudos sobre un campo en 3D, el once
| del rival colocado en ese campo, los cortes de acciones concretas que
| preparó el analista (Análisis visual, por jornada), las fotos de los que
| hay que vigilar, cifras y barras animadas y un cierre. Aquí sólo se decide
| QUÉ se cuenta y en qué orden; `monta.ts` lo pinta y lo codifica, y
| `/api/informe/video-guion` (Gemini, sin coste) pule la locución. Si la IA
| no contesta, el guion de aquí ya se puede locutar tal cual.
|
| Dos adaptadores, uno por informe: el del partido (previa/post, desde
| Microciclos) y el de ABP (la semana de balón parado).
*/

import type { InformePartido, PinceladaAbp, VeredictoDuelo } from "@/lib/informe-partido/modelo";
import type { InformeMicro } from "@/lib/abp/informe-micro";

export type Cifra = { rotulo: string; valor: string; pie?: string };

export type Corte = {
  url: string;
  /** «Córner ofensivo · VS EUROPA · J8» o «Gol · 23'»: lo que va en el rótulo bajo. */
  rotulo: string;
  /** La lectura táctica del corte (la escribe Gemini viendo el vídeo), en una frase. */
  texto?: string;
  /** Segundo del vídeo en el que empieza lo que hay que enseñar (un corte preparado empieza en 0). */
  desde?: number;
  /** O una fracción de su duración (0,5 = la mitad), para vídeos largos de los que se enseña un trozo. */
  desdeFraccion?: number;
  /** Repetición a cámara lenta (como en la tele): `velocidad` 0,5 y el rótulo «REPETICIÓN». */
  repeticion?: boolean;
  velocidad?: number;
};

/** Una celda del campo: tercio (0 propio → 2 rival, en el sentido del que ataca) y carril (0 izquierda → 2 derecha). */
export type Celda = { tercio: 0 | 1 | 2; carril: 0 | 1 | 2 };

/** Un corte del partido ya cortado por el ordenador del club (Hudl → bucket), con su lectura. */
export type CortePartido = Corte & {
  tipo: "gol" | "gol-contra" | "remate" | "remate-contra" | "contra" | "corner" | "corner-contra" | "abp" | "abp-contra" | "banda" | "banda-contra" | "robo" | "perdida" | "otro";
  /** «23'» o «45+2'». */
  minuto: string;
  /** El minuto en número, para la línea del partido. */
  minutoNum?: number;
  segundos: number;
  /** De qué equipo es la acción. */
  de: "nosotros" | "rival";
  /** Quién remata y quién asiste, tal y como lo etiqueta Hudl por jugador (fiable, a diferencia del momento de equipo). */
  remata?: string;
  asiste?: string;
  /** «gol», «parada», «palo», «fuera», «bloqueado». */
  resultado?: string;
  /** Acabó en remate u ocasión (lo dice Hudl): los balones parados con peligro van primero. */
  peligro?: boolean;
  /** De dónde sale el pase y dónde se remata, para el campo pequeño del corte. */
  desdeZona?: Celda | null;
  zona?: Celda | null;
};

/** Una marca en la línea del partido de una escena de cortes (todos los cortes del partido, no sólo los de la escena). */
export type MarcaPartido = { minuto: number; gol: boolean; de: "nosotros" | "rival" };

/** «45+2'» → 45; «79'» → 79. */
export const minutoNumero = (m: string) => Number(m.match(/^(\d+)/)?.[1] ?? 0);

/*
| LO QUE DURA CADA CORTE (20/10/2026, crítica del editor de vídeo): ni seis
| segundos fijos ni el fichero entero, sino lo que pide la jugada: 3 s antes
| de la acción, la acción y 2 s de desenlace, entre 5 y 9 s. Los cortes del
| club anclan el remate a los 5,5 s, así que un remate cabe en 8 y un gol (con
| su celebración recortada) en 9; un saque de banda, en 6. Nunca más de lo que
| dura el fichero: lo que no está grabado no se puede enseñar.
*/
const TOPE_DE_CORTE: Partial<Record<CortePartido["tipo"], number>> = { remate: 8, "remate-contra": 8, banda: 6, "banda-contra": 6 };

export const SEGUNDOS_CORTE_MINIMO = 5;
export const SEGUNDOS_CORTE_MAXIMO = 9;

/** Los segundos en pantalla de un corte del partido, según su tipo y lo que dura su fichero. */
export function segundosDeCorte(c: Pick<CortePartido, "tipo" | "segundos">, porDefecto = SEGUNDOS_POR_CORTE_PARTIDO) {
  const fichero = c.segundos || porDefecto;
  const tope = Math.min(TOPE_DE_CORTE[c.tipo] ?? SEGUNDOS_CORTE_MAXIMO, SEGUNDOS_CORTE_MAXIMO);

  /* Si el fichero es más corto que el mínimo, se ve entero (no se congela el último fotograma). */
  return Math.min(fichero, Math.max(SEGUNDOS_CORTE_MINIMO, Math.min(tope, fichero)));
}

/**
 * Cómo fue el marcador con los goles cortados (en orden de minuto): para el
 * título de la escena de goles, que dice el giro y no «Los goles».
 */
function giroDeGoles(goles: CortePartido[]) {
  let nos = 0;
  let ellos = 0;
  let ibamosPerdiendo = false;

  for (const g of goles) {
    if (g.tipo === "gol") nos += 1;
    else ellos += 1;

    if (ellos > nos) ibamosPerdiendo = true;
  }

  if (!goles.length) return "";

  if (ibamosPerdiendo && nos > ellos) return "Fuimos por detrás y le dimos la vuelta";
  if (ibamosPerdiendo && nos === ellos) return "Fuimos por detrás y lo empatamos";
  if (goles[0].tipo === "gol" && ellos > nos) return "Marcamos primero y nos remontaron";
  if (nos > ellos) return ellos ? `Así lo ganamos: ${nos}-${ellos}` : `Así marcamos: ${nos === 1 ? "el gol" : `los ${nos} goles`}`;
  if (nos === ellos) return `Así fue el ${nos}-${ellos}`;

  return `Así nos marcaron: ${nos}-${ellos}`;
}

/** Las escenas de cortes del partido, agrupadas por lo que cuentan: todos los goles, y hasta 4 llegadas nuestras y 3 suyas. */
export function escenasDeCortes(cortes: CortePartido[], rival: string, segundosPorCorte = SEGUNDOS_POR_CORTE_PARTIDO, opciones: { momento?: "previa" | "post"; rotuloPartido?: string } = {}): Escena[] {
  const previa = opciones.momento === "previa";
  /* En la previa los cortes son del ÚLTIMO partido, no de éste: se dice en el título y en la voz. */
  const de = previa ? ` · ${opciones.rotuloPartido ?? "último partido"}` : "";
  const nuestras = cortes.filter((c) => ["remate", "contra", "robo", "corner", "abp"].includes(c.tipo)).length;
  /*
  | Títulos que dicen la conclusión y locuciones que hacen de transición y
  | dicen qué mirar (20/10/2026, crítica del guionista): «Los goles» no
  | contaba nada; «Fuimos por detrás y le dimos la vuelta», sí.
  */
  const grupos: { id: string; titulo: (elegidos: CortePartido[]) => string; tipos: CortePartido["tipo"][]; locucion: (elegidos: CortePartido[]) => string }[] = [
    {
      id: "clips-1",
      titulo: (g) => `${giroDeGoles(g) || "Los goles"}${de}`,
      tipos: ["gol", "gol-contra"],
      locucion: (g) => (previa ? `Los goles ${opciones.rotuloPartido ? `de la ${opciones.rotuloPartido}` : "del último partido"}: fíjate en cómo se generó cada uno.` : `${giroDeGoles(g) || "Los goles"}. Mira de dónde nace cada gol.`),
    },
    {
      id: "clips-2",
      titulo: () => (previa ? `Así llegamos${de}` : "No fue suerte: así llegamos"),
      tipos: ["remate", "contra", "robo", "corner", "abp"],
      locucion: (g) => (previa ? `Así llegamos en el último partido: ${g.length === 1 ? "una jugada" : `${g.length} jugadas`} para repetir.` : "No fue suerte: así llegamos. Mira cómo ganamos la espalda."),
    },
    {
      id: "clips-3",
      titulo: (g) => (previa ? `Lo que concedimos${de}` : g.length < nuestras ? "Y esto es lo poco que nos hicieron" : `Por dónde nos hizo daño ${rival}`),
      tipos: ["remate-contra", "perdida"],
      locucion: (g) => (previa ? "Lo que concedimos: mira dónde perdimos la marca." : g.length < nuestras ? "Y esto es lo poco que nos hicieron: mira dónde perdimos la marca." : `Por aquí nos hizo daño ${rival}: mira dónde perdimos la marca.`),
    },
  ];

  /* Por objeto, no por URL: en el ordenador del club los cortes aún no tienen URL cuando se arma el guion. */
  const usados = new Set<CortePartido>();
  const escenas: Escena[] = [];

  /* La línea del partido: todas las acciones cortadas, para situar cada corte en el tiempo. */
  const marcas: MarcaPartido[] = cortes.map((c) => ({ minuto: c.minutoNum ?? minutoNumero(c.minuto), gol: c.tipo === "gol" || c.tipo === "gol-contra", de: c.de }));

  for (const g of grupos) {
    /*
    | Con cortes de nueve segundos enteros y hasta dos minutos y medio, caben
    | todos los goles con su repetición, cuatro llegadas nuestras y tres
    | suyas. Si sobran, el reparto quita primero lo que menos enseña.
    | Las llegadas, primero las que acabaron en remate o gol, y luego en orden de minuto.
    */
    const elegidos = cortes
      .filter((c) => g.tipos.includes(c.tipo) && !usados.has(c))
      .map((c, orden) => ({ c, orden }))
      .sort((a, b) => (g.id === "clips-1" ? 0 : Number(Boolean(b.c.resultado || b.c.peligro)) - Number(Boolean(a.c.resultado || a.c.peligro))) || a.orden - b.orden)
      .slice(0, g.id === "clips-1" ? 8 : g.id === "clips-2" ? 4 : 3)
      .sort((a, b) => a.orden - b.orden)
      .map((x) => x.c);

    if (!elegidos.length) continue;

    elegidos.forEach((c) => usados.add(c));

    /* Cada corte con su duración propia (`segundosDeCorte`, 5 a 9 s); la repetición, 4,4 s a media velocidad sobre el remate. */
    const conDuracion = elegidos.map((c) => ({ ...c, minutoNum: c.minutoNum ?? minutoNumero(c.minuto), segundos: segundosDeCorte(c, segundosPorCorte) }));

    escenas.push({
      id: g.id,
      tipo: "clips",
      titulo: g.titulo(elegidos),
      /* Cada gol lleva su repetición a cámara lenta justo detrás: los 2 s alrededor del remate, a media velocidad. */
      cortes: conDuracion.flatMap((base) => {
        const esGol = base.tipo === "gol" || base.tipo === "gol-contra";

        return esGol ? [base, { ...base, repeticion: true, velocidad: 0.5, desde: (base.desde ?? 0) + 4.3, segundos: 4.4 }] : [base];
      }),
      segundos: conDuracion.reduce((s, c) => s + c.segundos + (c.tipo === "gol" || c.tipo === "gol-contra" ? 4.4 : 0), 0),
      locucion: g.locucion(elegidos),
      marcas,
    });
  }

  return escenas;
}

/** Lo que dura cada corte del partido en pantalla: la jugada entera cabe en seis segundos. */
export const SEGUNDOS_POR_CORTE_PARTIDO = 6;

/**
 * Las escenas de balón parado del partido (para el informe de ABP): nuestros
 * córners y faltas, los suyos y los saques de banda; hasta 4 cortes cada una
 * (3 de banda).
 * En la previa son del último partido y se dice.
 */
export function escenasDeCortesAbp(cortes: CortePartido[], rival: string, opciones: { momento?: "previa" | "post"; rotuloPartido?: string } = {}, segundosPorCorte = 7): Escena[] {
  const previa = opciones.momento === "previa";
  const de = previa ? ` · ${opciones.rotuloPartido ?? "último partido"}` : "";
  const grupos: { id: string; titulo: string; tipos: CortePartido["tipo"][]; locucion: (n: number) => string }[] = [
    { id: "abp-nuestros", titulo: previa ? `Cómo lo hicimos: nuestro balón parado${de}` : "Nuestro balón parado", tipos: ["corner", "abp"], locucion: (n) => `${n === 1 ? "Un balón parado nuestro" : `${n} balones parados nuestros`}${previa ? " del último partido" : ""}: cómo lo lanzamos.` },
    { id: "abp-suyos", titulo: previa ? `Lo que defendimos${de}` : `El balón parado de ${rival}`, tipos: ["corner-contra", "abp-contra"], locucion: (n) => `${n === 1 ? "Un balón parado suyo" : `${n} balones parados suyos`}: cómo lo defendimos.` },
    { id: "abp-banda", titulo: previa ? `Saques de banda${de}` : "Saques de banda", tipos: ["banda", "banda-contra"], locucion: (n) => `${n === 1 ? "Un saque de banda" : `${n} saques de banda`}: nuestros y suyos.` },
  ];

  const usados = new Set<CortePartido>();
  const escenas: Escena[] = [];
  const marcas: MarcaPartido[] = cortes.map((c) => ({ minuto: c.minutoNum ?? minutoNumero(c.minuto), gol: c.tipo === "gol" || c.tipo === "gol-contra", de: c.de }));

  for (const g of grupos) {
    /* Primero los que acabaron en remate o gol: son los que enseñan algo. */
    const elegidos = cortes
      .filter((c) => g.tipos.includes(c.tipo) && !usados.has(c))
      .sort((a, b) => Number(Boolean(b.peligro || b.resultado)) - Number(Boolean(a.peligro || a.resultado)))
      .slice(0, g.id === "abp-banda" ? 3 : 4)
      .sort((a, b) => (a.minutoNum ?? minutoNumero(a.minuto)) - (b.minutoNum ?? minutoNumero(b.minuto)));

    if (!elegidos.length) continue;

    elegidos.forEach((c) => usados.add(c));
    /* Con su duración propia, como los del partido (20/10/2026): de 5 a 9 s, sin pasar de lo que dura el fichero. */
    const conDuracion = elegidos.map((c) => ({ ...c, minutoNum: c.minutoNum ?? minutoNumero(c.minuto), segundos: segundosDeCorte(c, segundosPorCorte) }));

    escenas.push({ id: g.id, tipo: "clips", titulo: g.titulo, cortes: conDuracion, segundos: conDuracion.reduce((s, c) => s + c.segundos, 0), locucion: g.locucion(elegidos.length), marcas });
  }

  return escenas;
}

export type JugadorEscena = { nombre: string; dorsal: string; posicion: string; foto: string; x: number; y: number; destacado: boolean; texto?: string };

export type Escena =
  /* `idea` (20/10/2026): la idea del partido en ≤ 8 palabras bajo el título; la portada es también el póster del correo. */
  | { id: string; tipo: "portada"; titulo: string; subtitulo: string; sello: string; escudoNosotros: string | null; escudoRival: string | null; locucion: string; idea?: string }
  | { id: string; tipo: "cifras"; titulo: string; cifras: Cifra[]; locucion: string }
  /* `pies` (21/10/2026): bajo cada línea, en oro, el dato que la sostiene («3 de sus 5 goles»). */
  | { id: string; tipo: "claves"; titulo: string; lineas: string[]; locucion: string; pies?: string[] }
  | { id: string; tipo: "barras"; titulo: string; barras: { rotulo: string; valor: number; texto: string }[]; locucion: string }
  | { id: string; tipo: "once"; titulo: string; jugadores: JugadorEscena[]; locucion: string }
  | { id: string; tipo: "vigilar"; titulo: string; jugadores: JugadorEscena[]; locucion: string }
  | { id: string; tipo: "clips"; titulo: string; cortes: Corte[]; segundos: number; locucion: string; /** La línea del partido con todas sus acciones, si son cortes del partido. */ marcas?: MarcaPartido[] }
  | { id: string; tipo: "imagen"; titulo: string; src: string; pie: string; locucion: string }
  /** `pie`: el dato de la consigna, en oro debajo (21/10/2026). */
  | { id: string; tipo: "cierre"; titulo: string; lineas: string[]; locucion: string; pie?: string }
  /*
  | Las escenas de datos (14/10/2026): lo que la app ya calcula y el vídeo no
  | contaba. El gancho abre con el dato más llamativo antes de la portada; el
  | resto sale de Duelos, de DATA (el rival de un vistazo), del colectivo y
  | de la clasificación.
  */
  /*
  | El gancho (20/10/2026): el dato a casi toda la pantalla y UNA línea debajo
  | (`rotulo`); `antetitulo` es una etiqueta corta encima (el rival). El
  | `contexto` ya no se pinta (no se leía en el móvil): queda para la locución.
  */
  | { id: string; tipo: "gancho"; dato: string; rotulo: string; contexto: string; locucion: string; antetitulo?: string }
  | { id: string; tipo: "contexto"; titulo: string; equipos: EquipoContexto[]; locucion: string }
  | { id: string; tipo: "versus"; titulo: string; pie: string; filas: FilaVersus[]; locucion: string }
  | { id: string; tipo: "percentiles"; titulo: string; pie: string; filas: { nombre: string; percentil: number }[]; locucion: string }
  | { id: string; tipo: "duelos"; titulo: string; duelos: DueloEscena[]; locucion: string }
  | { id: string; tipo: "fases"; titulo: string; fases: { titulo: string; texto: string }[]; dano: string[]; locucion: string }
  /* Post (15/10/2026): lo que buscábamos frente a lo que logramos, fila a fila y con el dato. */
  | { id: string; tipo: "balance"; titulo: string; filas: FilaBalance[]; resumen: string; locucion: string };

/**
 * Una fila del balance del post: la meta del plan, lo que dio el partido y si
 * se cumplió. Sin estado «pendiente» (20/10/2026): una meta que aún no se
 * puede medir no entra (regla del usuario: lo que no tiene dato no se nombra).
 */
export type FilaBalance = { que: string; buscabamos: string; logramos: string; estado: "si" | "parcial" | "no" };

export type EquipoContexto = { nombre: string; nuestro: boolean; puesto: number | null; puntos: number | null; racha: string[] };

/** Una fila de la comparativa: los dos valores y, si la hay, la media de la liga. */
export type FilaVersus = { nombre: string; nuestro: number; suyo: number; textoNuestro: string; textoSuyo: string; media: number | null; mejorAlto: boolean | null };

export type DueloEscena = { titulo: string; nuestros: string; suyos: string; veredicto: VeredictoDuelo; texto: string };

export type GuionVideo = {
  /** Para el nombre del archivo y el rótulo de la esquina. */
  titulo: string;
  escenas: Escena[];
};

/**
 * La duración: entre un minuto y dos y medio, según lo que haya que enseñar
 * (13/10/2026; antes, tope de 90 s y antes aún 58 s). La manda el contenido
 * —la voz y los cortes enteros—; si se pasa, `reparteEscenas` quita lo que
 * menos enseña, y si se queda corto, da aire a las escenas sin cortes.
 */
export const SEGUNDOS_MAXIMOS = 150;
export const SEGUNDOS_MINIMOS = 60;

/** Cuántos cortes de acciones del rival entran (en dos escenas), y cuánto dura cada uno: la acción entera. */
const CORTES = 6;
const SEGUNDOS_POR_CORTE = 6;

/* Palabras que no pueden cerrar una frase recortada («Cerrar el pasillo de»). */
const COLGANTES = /\s+(de|del|la|las|el|los|lo|y|e|o|u|en|a|al|con|que|por|para|su|sus|un|una|se|nos|les|le|sin|tras|ante|desde|hasta|entre|cuando|si|más|muy)$/i;

const sinColgantes = (t: string) => {
  let x = t.trim().replace(/[\s,;:·\-–—(]+$/, "");

  while (COLGANTES.test(x)) x = x.replace(COLGANTES, "").replace(/[\s,;:·\-–—(]+$/, "");

  return x;
};

/**
 * Un texto a la medida de la pantalla SIN puntos suspensivos (20/10/2026: el
 * «…» en un vídeo se lee como un fallo). Primero se corta en una pausa natural
 * («:», «·», «;», «,», «.») dentro del límite; si no la hay, en la última
 * palabra entera, y nunca dejando colgada una preposición o un artículo.
 */
export function corta(t: string, n = 90) {
  if (t.length <= n) return t;

  const trozo = t.slice(0, n + 1);
  const pausa = Math.max(...[": ", " · ", "; ", ", ", ". ", " (", " — "].map((s) => trozo.lastIndexOf(s)));

  if (pausa > n * 0.45) return sinColgantes(t.slice(0, pausa));

  const espacio = trozo.lastIndexOf(" ");

  return sinColgantes(espacio > 0 ? t.slice(0, espacio) : t.slice(0, n));
}

/** Como `corta`, pero por palabras (el tope de palabras por escena de la crítica de edición). */
export function cortaPalabras(t: string, maximo: number) {
  const palabras = t.split(/\s+/).filter(Boolean);

  if (palabras.length <= maximo) return t;

  return corta(t, palabras.slice(0, maximo).join(" ").length);
}

const limpia = (t: string) => t.replace(/\s+/g, " ").trim();

/**
 * Las siglas que el cuerpo técnico no usa, en palabras (20/10/2026, críticas
 * del guionista y del experto en análisis): «su xG» → «sus goles esperados».
 */
export function sinSiglas(t: string) {
  return t
    .replace(/\bsu xG\b/g, "sus goles esperados")
    .replace(/\bSu xG\b/g, "Sus goles esperados")
    .replace(/\bnuestro xG\b/g, "nuestros goles esperados")
    .replace(/\bNuestro xG\b/g, "Nuestros goles esperados")
    .replace(/\bxGA\b/g, "goles esperados en contra")
    .replace(/\bxG\b/g, "goles esperados")
    .replace(/\bPPDA\b/g, "presión (pases que les dejamos)");
}

/*
| La CONSIGNA (20/10/2026, crítica del guionista): en presente y en primera
| persona del plural, verbo + qué + dónde. Las claves del plan suelen venir en
| infinitivo («Defender el segundo palo en los córners: 3 de sus 5 goles») o
| con una etiqueta («Atacar · …»): el verbo pasa a «defendemos» y el dato de
| después de los dos puntos se queda en el informe.
*/
const IRREGULARES: Record<string, string> = { ir: "vamos", ser: "somos", hacer: "hacemos", poner: "ponemos", salir: "salimos", tener: "tenemos", seguir: "seguimos", elegir: "elegimos" };

export function consigna(t: string, maximo = 10) {
  const limpio = sinSiglas(limpia(t)).replace(/^[\s/·\-–—]+/, "");
  /* «Atacar · su lateral» → «Atacar su lateral»; y sin el dato de después de los dos puntos. */
  /* Tras la etiqueta, la palabra siguiente en minúscula salvo siglas o nombres en mayúsculas («Neutralizar · Centros…» → «neutralizamos centros…»). */
  const frase = limpio.replace(/^([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s+·\s+(\S)(\S*)/, (_, v: string, a: string, b: string) => `${v} ${b === b.toUpperCase() ? a : a.toLowerCase()}${b}`).split(/:\s/)[0];
  const [primera, ...resto] = frase.split(" ");
  const verbo = primera.toLowerCase();
  let conjugado = "";

  if (IRREGULARES[verbo]) conjugado = IRREGULARES[verbo];
  else if (/^[a-záéíóúñ]{3,}(ar|er|ir)$/.test(verbo)) conjugado = `${verbo.slice(0, -2)}${verbo.endsWith("ar") ? "amos" : verbo.endsWith("er") ? "emos" : "imos"}`;

  /* Sin verbo delante no hay consigna: mejor nada que una etiqueta suelta («Balón parado»). */
  if (!conjugado) return "";

  const salida = cortaPalabras([conjugado, ...resto].join(" "), maximo).replace(/[.;,\s]+$/, "");

  return `${salida.charAt(0).toUpperCase()}${salida.slice(1)}`;
}

/** Un vídeo del bucket se puede leer en el navegador; un enlace de YouTube, no. */
export const esClipLegible = (url: string) => /^https?:\/\/.+\.(mp4|m4v|mov|webm)(\?|$)/i.test(url) || /supabase\.co\/storage/i.test(url);

/**
 * Las fotos de fuera pasan por el proxy, como en las diapositivas. Son fotos
 * de jugadores rivales: si la ficha trae nuestro escudo de relleno, no hay
 * foto y sale el dorsal (22/10/2026, crítica de marketing).
 */
const fotoVia = (src: string) => (!src || /(^|\/)logo\.png($|\?)/i.test(src) ? "" : src.startsWith("/") || src.startsWith("data:") ? src : `/api/rivals/foto?url=${encodeURIComponent(src)}`);

/* ------------------------------------------------------------------ */
/*  LAS ESCENAS DE DATOS (14/10/2026)                                  */
/* ------------------------------------------------------------------ */

/** Un número como se lee en castellano: «1,4», «12», «58 %». */
const numero = (v: number, unidad = "") => {
  const redondo = Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  const texto = String(redondo).replace(".", ",");

  return unidad === "%" ? `${texto} %` : texto;
};

/**
 * El giro del post en pocas palabras (20/10/2026, crítica del guionista): la
 * remontada, la victoria sufrida (gol suyo en los últimos 10′), el dominio
 * con poco premio… Sale de los goles de BeSoccer (en orden) y del xG del
 * partido; `""` si el partido no tuvo giro que contar.
 */
function giroDelPartido(informe: InformePartido) {
  const { partido } = informe;

  if (partido.gf === null || partido.gc === null) return "";

  const goles = informe.cronica?.goles ?? [];
  let nos = 0;
  let ellos = 0;
  let ibamosPerdiendo = false;
  let ibamosGanando = false;

  for (const g of goles) {
    if (g.nuestro) nos += 1;
    else ellos += 1;

    if (ellos > nos) ibamosPerdiendo = true;
    if (nos > ellos) ibamosGanando = true;
  }

  const xg = informe.duelo?.partido?.metricas.find((m) => m.key === "xg");
  const dominio = xg && xg.nuestro !== null && xg.suyo !== null && xg.nuestro >= Math.max(0.6, xg.suyo * 1.6);
  const sufrido = goles.some((g) => !g.nuestro && minutoNumero(g.minuto) >= 80);

  if (partido.gf > partido.gc) {
    if (ibamosPerdiendo) return dominio ? "Remontamos y dominamos" : "Le dimos la vuelta";
    if (sufrido && partido.gf - partido.gc === 1) return "Victoria sufrida hasta el final";
    if (dominio) return "Victoria con dominio";

    return "";
  }

  if (partido.gf === partido.gc) {
    if (ibamosPerdiendo) return "Fuimos por detrás y lo empatamos";
    if (ibamosGanando) return "Se nos escapó la victoria";

    return dominio ? "Dominamos con poco premio" : "";
  }

  if (ibamosGanando) return "Nos remontaron";

  return dominio ? "Mejores en el juego, sin premio" : "";
}

/**
 * La idea del partido en ocho palabras como mucho, para la portada (y el
 * póster del correo). Post: el giro; previa: su mejor arma.
 */
function ideaDelPartido(informe: InformePartido) {
  /*
  | Sin repetir el gancho (21/10/2026, críticas del guionista y del editor: el
  | gancho y la portada decían lo mismo seguidos). Post: el gancho ya lleva el
  | giro, así que la portada lleva el hito («Contra diez desde el 57′») o la
  | pregunta que contesta el balance. Previa: el gancho es su arma y la
  | portada, nuestra consigna contra ella: el vídeo abre y cierra en bucle.
  */
  if (informe.momento === "post") {
    const hito = limpia(informe.sintesis.subtitular ?? "");

    if (hito && hito.split(" ").length <= 8 && !/\d+-\d+/.test(hito)) return hito;

    return filasDeBalance(informe).length >= 2 ? "¿Hicimos lo que buscábamos?" : "";
  }

  const [principal] = consignasDePrevia(informe);

  if (principal) return cortaPalabras(principal.linea, 8);

  /* Sin consigna, su arma, pero sólo si el gancho no la ha dicho ya. */
  const fuerte = armaDelRival(informe);

  return fuerte && !escenaGancho(informe) ? cortaPalabras(`Su arma: ${sinSiglas(fuerte.nombre).toLowerCase()}`, 8) : "";
}

/**
 * Las consignas de la previa (21/10/2026, crítica del guionista: «las claves
 * salen en infinitivo y con el dato colgado, y el cierre dice "Defendemos…":
 * dos voces en el mismo vídeo»). Cada una en presente y primera persona del
 * plural, con el dato de después de los dos puntos aparte, para ponerlo
 * debajo. Primero las claves que escribió el cuerpo técnico; si ninguna se
 * puede decir así, «Cómo lo ganamos» del informe (ya viene en esa voz).
 */
/**
 * Su mejor arma, la del gancho de la previa (la del pronóstico o, si no, la
 * de DATA), y si una consigna habla de ella: comparten una raíz de cinco
 * letras («centros» y «centro», «córner» y «córners»).
 */
function armaDelRival(informe: InformePartido) {
  const candidatas = [informe.pronostico?.suFuerte, ...(informe.vistazo?.fuertes ?? [])].filter((x): x is NonNullable<typeof x> => Boolean(x));

  if (!candidatas.length) return null;

  /* De sus armas, la que nuestras claves contestan; si ninguna, la principal. */
  const nuestras = raices([...informe.sintesis.claves, ...(informe.sintesis.plan ?? []).map((x) => x.texto)].slice(0, 3).join(" "));

  return candidatas.find((c) => [...raices(sinSiglas(c.nombre))].some((r) => nuestras.has(r))) ?? candidatas[0];
}

const raices = (t: string) =>
  new Set(
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z]+/)
      .filter((p) => p.length >= 5)
      .map((p) => p.slice(0, 5))
      /* Un córner y un balón colgado son centros al área: la misma familia. */
      .map((r) => (r === "corne" || r === "colga" ? "centr" : r)),
  );

function respondeAlArma(informe: InformePartido, texto: string) {
  const arma = armaDelRival(informe);

  if (!arma) return false;

  const suyas = raices(sinSiglas(arma.nombre));

  return [...raices(texto)].some((r) => suyas.has(r));
}

export function consignasDePrevia(informe: InformePartido): { linea: string; pie: string }[] {
  const s = informe.sintesis;
  const dato = (t: string) => {
    const [, ...resto] = sinSiglas(limpia(t)).split(/:\s/);

    const texto = resto.length ? cortaPalabras(resto.join(": ").replace(/[.;,\s]+$/, ""), 8) : "";

    return texto ? `${texto.charAt(0).toUpperCase()}${texto.slice(1)}` : "";
  };
  const deClaves = s.claves.map((c) => ({ linea: consigna(c, 9), pie: dato(c) })).filter((x) => x.linea);

  /*
  | La misma idea que el informe (24/10/2026, expertos de fútbol y guion): el
  | plan por fases ya viene con la idea principal primero (la que se entrena
  | esta semana), así que el vídeo dice lo mismo que la diapositiva 3 y el
  | WhatsApp. Las claves escritas a mano, sólo si no hay plan.
  */
  const delPlan = (s.plan ?? [])
    .map((x) => ({ linea: cortaPalabras(sinSiglas(limpia(x.texto)).split(/:\s/)[0], 9).replace(/[.;,\s]+$/, ""), pie: dato(x.texto) }))
    .filter((x) => x.linea);

  if (s.consigna?.length && delPlan.length) return delPlan.slice(0, 3);

  /*
  | La que contesta al gancho va primera (22/10/2026, crítica del guionista:
  | el vídeo abría con «2.º en centros al área» y cerraba con otra cosa, y la
  | pregunta no se contestaba). Así la portada, la primera clave y el cierre
  | hablan de lo mismo que el gancho.
  */
  const primeroLaQueResponde = (lista: { linea: string; pie: string }[]) => {
    const k = lista.findIndex((x) => respondeAlArma(informe, `${x.linea} ${x.pie}`));

    return k > 0 ? [lista[k], ...lista.filter((_, i) => i !== k)] : lista;
  };

  if (deClaves.length) return primeroLaQueResponde(deClaves).slice(0, 3);

  return primeroLaQueResponde(
    (s.plan ?? [])
    .map((x) => ({ linea: cortaPalabras(sinSiglas(limpia(x.texto)).split(/:\s/)[0], 9).replace(/[.;,\s]+$/, ""), pie: dato(x.texto) }))
    .filter((x) => x.linea),
  ).slice(0, 3);
}

/**
 * El gancho: los primeros tres segundos, antes de la portada, con el dato
 * que más llama la atención. En el post, el marcador y la cifra del partido
 * en la que más ganamos; en la previa, el punto más fuerte del rival en la
 * categoría (o los puestos de los dos).
 */
function escenaGancho(informe: InformePartido): Escena | null {
  const { partido, duelo, contexto, momento } = informe;

  if (momento === "post" && partido.gf !== null && partido.gc !== null) {
    const resultado = partido.gf > partido.gc ? "VICTORIA" : partido.gf < partido.gc ? "DERROTA" : "EMPATE";
    const mejor = (duelo?.partido?.metricas ?? [])
      .filter((m) => m.nuestro !== null && m.suyo !== null && m.mejorAlto !== null && Math.max(m.nuestro!, m.suyo!) > 0)
      .map((m) => ({ m, ventaja: ((m.nuestro! - m.suyo!) / Math.max(m.nuestro!, m.suyo!)) * (m.mejorAlto ? 1 : -1) }))
      .sort((a, b) => b.ventaja - a.ventaja)[0];
    const dato = mejor && mejor.ventaja > 0.15 ? sinSiglas(`${mejor.m.nombre}: ${numero(mejor.m.nuestro!, mejor.m.unidad)} contra ${numero(mejor.m.suyo!, mejor.m.unidad)}`) : corta(limpia(informe.sintesis.titular), 70);
    /*
    | La línea de debajo es el MISMO titular del resumen, sin el marcador, que ya
    | va en grande (25/10/2026, guionista: el vídeo decía «Remontamos con uno
    | más» cuando la vuelta llegó antes de la roja, y el PDF contaba otra
    | historia). Si el titular es largo, el giro; si no lo hay, el resultado.
    */
    const delResumen = limpia(informe.sintesis.titular ?? "")
      .replace(/s*d+s*-s*d+(?=[s,.:;]|$)/, "")
      .replace(/s+,/g, ",")
      .replace(/s{2,}/g, " ")
      .trim();
    const giro = giroDelPartido(informe);
    const rotulo = delResumen && delResumen.split(/s+/).length <= 12 ? delResumen : giro || resultado;

    return { id: "gancho", tipo: "gancho", dato: `${partido.gf}-${partido.gc}`, antetitulo: partido.rival, rotulo: rotulo.toUpperCase(), contexto: dato, locucion: `${resultado.toLowerCase()} ${partido.gf}-${partido.gc}. ${dato}.` };
  }

  /* Su mejor arma: la del pronóstico (la misma del titular del informe) y, si no, la de DATA; entre ellas, la que contestan nuestras claves (22/10/2026). */
  const fuerte = armaDelRival(informe);

  /* Previa (20/10/2026): «2º» enorme y debajo sólo en qué; el «de 20 equipos» queda para la escena fase a fase. */
  if (fuerte) {
    return {
      id: "gancho",
      tipo: "gancho",
      dato: `${fuerte.puesto}.º`,
      antetitulo: `${partido.rival} · su mejor arma`,
      /* «2.º de la liga en centros al área» (21/10/2026, marketing: el «2.º» solo no se entendía en la vista previa del móvil). */
      rotulo: `De la liga en ${sinSiglas(fuerte.nombre).toLowerCase()}`.toUpperCase(),
      contexto: `${partido.rival}, de ${fuerte.de} equipos de la categoría: su mejor arma (${fuerte.valor}).`,
      locucion: `${partido.rival} es ${fuerte.puesto}º de ${fuerte.de} en ${sinSiglas(fuerte.nombre).toLowerCase()}.`,
    };
  }

  if (contexto?.puesto && contexto.nuestroPuesto) {
    return { id: "gancho", tipo: "gancho", dato: `${contexto.nuestroPuesto}º · ${contexto.puesto}º`, antetitulo: "En la tabla", rotulo: `NOSOTROS CONTRA ${partido.rival.toUpperCase()}`, contexto: limpia(informe.sintesis.titular), locucion: `${contexto.nuestroPuesto}º contra ${contexto.puesto}º.` };
  }

  return null;
}

/** La clasificación y la racha de los dos, cara a cara. */
function escenaContexto(informe: InformePartido): Escena | null {
  const c = informe.contexto;

  if (!c || (!c.puesto && !c.racha.length)) return null;

  const equipos: EquipoContexto[] = [
    { nombre: "Real Madrid Castilla", nuestro: true, puesto: c.nuestroPuesto, puntos: c.nuestrosPuntos, racha: c.nuestraRacha.slice(0, 5) },
    { nombre: informe.partido.rival, nuestro: false, puesto: c.puesto, puntos: c.puntos, racha: c.racha.slice(0, 5) },
  ];
  const dice = (e: EquipoContexto) => `${e.nombre}${e.puesto ? `, ${e.puesto}º` : ""}${e.puntos !== null ? ` con ${e.puntos} puntos` : ""}${e.racha.length ? `; últimos: ${e.racha.join(" ")}` : ""}`;

  /* El título dice la conclusión (20/10/2026): quién llega por delante en la tabla. */
  const titulo =
    c.nuestroPuesto && c.puesto
      ? c.nuestroPuesto < c.puesto
        ? `Llegamos por delante: ${c.nuestroPuesto}º contra ${c.puesto}º`
        : `Ellos llegan por delante: ${c.puesto}º contra ${c.nuestroPuesto}º`
      : "Cómo llegamos los dos";

  return { id: "contexto", tipo: "contexto", titulo, equipos, locucion: `${dice(equipos[0])}. ${dice(equipos[1])}.` };
}

/**
 * La comparativa cara a cara. En el post, las cifras del propio partido con
 * la media de la liga; en la previa, las medias de la temporada en las que
 * más se separan los dos equipos (por percentil).
 */
function escenaVersus(informe: InformePartido): Escena | null {
  const d = informe.duelo;

  if (!d) return null;

  if (informe.momento === "post" && d.partido) {
    /*
    | Primero la cifra en la que más se separaron los dos (20/10/2026): el
    | dibujo pone en oro la primera fila y el título la cuenta.
    */
    const filas: FilaVersus[] = d.partido.metricas
      .filter((m) => m.nuestro !== null && m.suyo !== null)
      .map((m) => ({ m, separa: Math.abs(m.nuestro! - m.suyo!) / Math.max(Math.abs(m.nuestro!), Math.abs(m.suyo!), 0.0001) }))
      .sort((a, b) => b.separa - a.separa)
      .slice(0, 6)
      .map(({ m }) => ({ nombre: sinSiglas(m.nombre), nuestro: m.nuestro!, suyo: m.suyo!, textoNuestro: numero(m.nuestro!, m.unidad), textoSuyo: numero(m.suyo!, m.unidad), media: m.media, mejorAlto: m.mejorAlto }));

    if (filas.length < 3) return null;

    return { id: "versus", tipo: "versus", titulo: tituloDeVersus(filas[0], true), pie: "La raya marca la media de la liga por partido", filas, locucion: filas.slice(0, 3).map((f) => `${f.nombre}: ${f.textoNuestro} contra ${f.textoSuyo}`).join(". ") };
  }

  const filas: FilaVersus[] = d.metricas
    .filter((m) => m.nosotros && m.rival && m.nosotros.percentil !== null && m.rival.percentil !== null)
    .map((m) => ({ m, separa: Math.abs(m.nosotros!.percentil! - m.rival!.percentil!) }))
    .sort((a, b) => b.separa - a.separa)
    .slice(0, 5)
    .map(({ m }) => ({ nombre: sinSiglas(m.nombre), nuestro: m.nosotros!.valor, suyo: m.rival!.valor, textoNuestro: numero(m.nosotros!.valor, m.unidad), textoSuyo: numero(m.rival!.valor, m.unidad), media: m.media ?? m.mediana, mejorAlto: m.mejorAlto }));

  if (filas.length < 3) return null;

  return { id: "versus", tipo: "versus", titulo: tituloDeVersus(filas[0], false), pie: `Media por partido esta temporada · la raya, la mediana de los ${d.equipos} equipos`, filas, locucion: filas.slice(0, 3).map((f) => `${f.nombre}: ${f.textoNuestro} nosotros, ${f.textoSuyo} ellos`).join(". ") };
}

/** El título de la comparativa: quién manda en la cifra que más separa a los dos (20/10/2026). */
export function tituloDeVersus(f: FilaVersus, partido: boolean) {
  const nombre = f.nombre.toLowerCase();
  const cifras = `${f.textoNuestro} contra ${f.textoSuyo}`;

  if (f.mejorAlto === null || f.nuestro === f.suyo) return partido ? `El partido en datos: ${nombre}, ${cifras}` : `Donde más nos separamos: ${nombre}`;

  const ganamos = (f.nuestro > f.suyo) === f.mejorAlto;

  return partido ? `${ganamos ? "Mandamos" : "Mandaron"} en ${nombre}: ${cifras}` : `${ganamos ? "Les sacamos ventaja" : "Nos sacan ventaja"} en ${nombre}`;
}

/** El rival por fases del juego, en percentil contra su categoría (DATA → Un equipo de un vistazo). */
function escenaPercentiles(informe: InformePartido): Escena | null {
  const v = informe.vistazo;
  const filas = (v?.fases ?? []).filter((f): f is { label: string; percentil: number } => f.percentil !== null).slice(0, 6).map((f) => ({ nombre: f.label, percentil: f.percentil }));

  if (!v || filas.length < 3) return null;

  const mejor = [...filas].sort((a, b) => b.percentil - a.percentil)[0];
  const peor = [...filas].sort((a, b) => a.percentil - b.percentil)[0];

  return {
    id: "percentiles",
    tipo: "percentiles",
    /* La conclusión (20/10/2026): dónde son fuertes y dónde flojos. */
    titulo: mejor.percentil >= 60 && peor.percentil <= 40 ? `Fuertes en ${mejor.nombre.toLowerCase()}, flojos en ${peor.nombre.toLowerCase()}` : `${informe.partido.rival}, fase a fase`,
    pie: `Percentil contra los equipos de ${v.competicion} · ${v.alcance}`,
    filas,
    locucion: `Donde más destacan: ${mejor.nombre.toLowerCase()}, percentil ${Math.round(mejor.percentil)}. Donde menos: ${peor.nombre.toLowerCase()}, percentil ${Math.round(peor.percentil)}.`,
  };
}

/** Los duelos por zonas que más se despegan (Competición → Duelos). */
function escenaDuelos(informe: InformePartido): Escena | null {
  const lista = (informe.duelosJugadores?.lista ?? [])
    .filter((d) => d.veredicto !== "sin-datos" && d.nuestros.length && d.suyos.length)
    .sort((a, b) => Math.abs(b.balance ?? 0) - Math.abs(a.balance ?? 0))
    .slice(0, 3);

  if (lista.length < 2) return null;

  /* Una frase de diez palabras como mucho por duelo (20/10/2026): a 40 px en el móvil no cabe más. */
  const duelos: DueloEscena[] = lista.map((d) => ({ titulo: d.titulo, nuestros: d.nuestros.join(" · "), suyos: d.suyos.join(" · "), veredicto: d.veredicto, texto: cortaPalabras(sinSiglas(limpia(d.resumen)), 10) }));
  const aFavor = duelos.find((d) => d.veredicto === "ventaja");
  const enContra = duelos.find((d) => d.veredicto === "desventaja");
  const titulo = aFavor && enContra ? `Ganamos en ${aFavor.titulo.toLowerCase()}; sufrimos en ${enContra.titulo.toLowerCase()}` : aFavor ? `Donde les ganamos: ${aFavor.titulo.toLowerCase()}` : enContra ? `Donde sufrimos: ${enContra.titulo.toLowerCase()}` : "Los duelos que deciden";

  return { id: "duelos", tipo: "duelos", titulo, duelos, locucion: duelos.map((d) => `${d.titulo}: ${d.veredicto === "ventaja" ? "ventaja nuestra" : d.veredicto === "desventaja" ? "ventaja suya" : "parejo"}`).join(". ") };
}

/** Cómo juegan, momento a momento, y dónde hacerles daño (Scouting colectivo). */
function escenaFases(informe: InformePartido): Escena[] {
  const r = informe.colectivo?.resumen;
  /*
  | Doce palabras por fase como mucho (20/10/2026: a 40 px caben unas cuatro
  | líneas por baldosa) y sin la puntuación suelta con la que empiezan a veces
  | los textos de la hoja («/ 1-4-3-3.»): si queda en nada, la fase no sale.
  */
  const fases = (r?.fases ?? [])
    .map((f) => ({ titulo: f.titulo, texto: cortaPalabras(sinSiglas(limpia(f.texto).replace(/^[\s/·\-–—:.,;]+/, "")), 10) }))
    .filter((f) => f.texto.replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑ]/g, "").length >= 5)
    .slice(0, 4);

  if (fases.length < 3) return [];

  const dano = (r?.dano ?? []).slice(0, 2).map((t) => cortaPalabras(sinSiglas(limpia(t)), 8));

  /*
  | En dos escenas de dos tarjetas (21/10/2026, crítica del editor: cuatro
  | tarjetas de texto durante 9 s no se leen en el móvil). La segunda lleva
  | «dónde hacerles daño». Con tres fases, la segunda tarjeta va sola.
  */
  const locucion = (lista: typeof fases) => lista.map((f) => `${f.titulo}: ${f.texto}`).join(". ");

  /*
  | Tres fases sin «dónde hacerles daño»: una sola escena de tres tarjetas
  | (22/10/2026, crítica del editor: la segunda escena se quedaba con una
  | tarjeta y media pantalla muerta). Con daño, la tercera va sola y a lo
  | ancho, con la banda de oro debajo.
  */
  if (fases.length === 3 && !dano.length) return [{ id: "fases", tipo: "fases", titulo: "Así juegan", fases, dano: [], locucion: `${locucion(fases)}.` }];

  return [
    { id: "fases", tipo: "fases", titulo: "Así juegan", fases: fases.slice(0, 2), dano: [], locucion: `${locucion(fases.slice(0, 2))}.` },
    { id: "fases-2", tipo: "fases", titulo: dano.length ? "Y por dónde hacerles daño" : "Así juegan, sin balón y al robar", fases: fases.slice(2, 4), dano, locucion: `${locucion(fases.slice(2, 4))}${dano.length ? `. Dónde hacerles daño: ${dano.join("; ")}` : ""}.` },
  ];
}

/**
 * El balance del post (15/10/2026, lo pidió el cuerpo técnico: «lo que nos
 * deja» tenía que decir qué buscábamos y qué logramos, con datos). Lo usan los
 * dos motores: el navegador con las metas del pronóstico y el ordenador del
 * club con las claves del plan medidas en el timeline de Hudl.
 * Devuelve la escena y las dos líneas del cierre; `null` si hay menos de dos filas.
 */
export function escenaBalance(filas: FilaBalance[]): { escena: Escena; cierre: string[] } | null {
  /*
  | Sólo filas medidas (20/10/2026): una meta sin dato no se nombra. Y a la
  | medida del móvil: la meta y lo logrado en ocho palabras como mucho cada
  | una (lo que va antes del primer «·» es el dato principal).
  */
  const medidas = filas.filter((x) => (x.estado as string) !== "pendiente" && x.logramos.trim());
  /*
  | Tres como mucho (21/10/2026, crítica del editor: a 45 px no caben cuatro):
  | el resultado y, del plan, primero la que no salió, luego la que sí y
  | después lo demás. El recuento cuenta todas las medidas.
  */
  const resultado = medidas.filter((x) => x.que === "El resultado");
  const resto = medidas.filter((x) => x.que !== "El resultado");
  const orden = [resto.find((x) => x.estado === "no"), resto.find((x) => x.estado === "si"), resto.find((x) => x.estado === "parcial"), ...resto];
  const elegidas = [...resultado, ...orden.filter((x, i, todas): x is FilaBalance => Boolean(x) && todas.indexOf(x) === i)].slice(0, 3);
  const lista = elegidas
    .map((x) => ({ ...x, buscabamos: cortaPalabras(sinSiglas(x.buscabamos.split(" · ")[0]), 8), logramos: cortaPalabras(sinSiglas(x.logramos.split(" · ")[0]), 8) }));

  if (lista.length < 2) return null;

  /* El resultado no es una meta del plan (25/10/2026, guionista): no entra en el recuento, que así es el mismo que el de la diapositiva 2. */
  const cuentan = resto.length ? resto : medidas;
  const cumplidas = cuentan.filter((x) => x.estado === "si").length;
  const fallo = lista.find((x) => x.estado === "no" && x.que !== "El resultado") ?? lista.find((x) => x.estado === "parcial" && x.que !== "El resultado");
  const acierto = lista.find((x) => x.estado === "si" && x.que !== "El resultado");

  /* «Cumplimos 2 de 3»: las filas ya dicen cuál quedó a medias o igual que siempre. */
  const resumen = `Cumplimos ${cumplidas} de ${cuentan.length}`;

  /* El cierre: el recuento y la consigna de la semana, en presente y primera persona (crítica del guionista). */
  const cierre = [resumen, fallo ? `Esta semana, ${consignaDeMejora(fallo.que)}` : acierto ? `Seguimos así: ${acierto.que.toLowerCase()}` : ""].filter(Boolean);

  return {
    escena: {
      id: "balance",
      tipo: "balance",
      /* El título es la conclusión: el recuento. */
      titulo: resumen,
      filas: lista,
      resumen,
      locucion: `${lista.map((x) => `${x.que}: buscábamos ${x.buscabamos.charAt(0).toLowerCase()}${x.buscabamos.slice(1)}; ${x.logramos.charAt(0).toLowerCase()}${x.logramos.slice(1)}`).join(". ")}. ${resumen}.`,
    },
    cierre,
  };
}

/** Lo que hay que mejorar, como consigna para la semana. */
function consignaDeMejora(que: string) {
  const q = que.toLowerCase();

  if (/cierre de partido/.test(q)) return "cerramos los partidos que vamos ganando";
  if (/^defensa\s+\S/.test(q)) return `defendemos mejor ${q.replace(/^defensa\s+/, "")}`;
  if (/sin bal[oó]n|defens/.test(q)) return "defendemos mejor sin balón";
  if (/con bal[oó]n|ataque|posesi/.test(q)) return "generamos más con balón";
  if (/transici|robo|contra/.test(q)) return "sacamos más de cada robo";
  if (/bal[oó]n parado|abp|c[oó]rner/.test(q)) return "sacamos más del balón parado";
  if (/peligros|vigilar/.test(q)) return "cerramos mejor a sus peligrosos";

  return `mejoramos ${q}`;
}

/**
 * «Lo que buscábamos» (20/10/2026, crítica del guionista): el planteamiento
 * del post, justo después de la portada, con sólo la columna de la meta. El
 * balance del final cierra el arco (buscábamos → pasó → nos deja). Recibe
 * las metas del plan, se puedan medir ya o no (el plan es el plan). `null` con
 * menos de dos.
 */
export function escenaPlan(metas: string[]): Escena | null {
  const lineas = [...new Set(metas.map((x) => cortaPalabras(sinSiglas(limpia(x).split(" · ")[0]), 10)).filter(Boolean))].slice(0, 4);

  if (lineas.length < 2) return null;

  return { id: "plan", tipo: "claves", titulo: "Lo que buscábamos", lineas, locucion: `Lo que buscábamos: ${lineas.join("; ")}.` };
}

const decimal = (n: number) => n.toFixed(2).replace(".", ",");
const apellidoDe = (nombre: string) => nombre.trim().split(/\s+/).slice(-1)[0] ?? nombre;

/** Las filas del balance con lo que sabe el informe del navegador: el resultado, las metas de xG del plan y los que había que frenar. */
function filasDeBalance(informe: InformePartido): FilaBalance[] {
  const p = informe.partido;
  const pr = informe.pronostico;
  const filas: FilaBalance[] = [];

  /*
  | Las mismas filas y el mismo recuento que la diapositiva 2 (25/10/2026,
  | guionista: el vídeo decía «Cumplimos 3 de 4» contando el resultado y el
  | resumen, «Cumplimos 1 de 3»). Con dos o más metas del plan medidas, el
  | balance son ellas y sólo ellas.
  */
  const delPlan = (informe.sintesis.cumplimiento ?? []).filter((c) => c.veredicto && c.dato);

  if (delPlan.length >= 2) {
    return delPlan.map((c) => ({
      que: c.tema || "El plan",
      buscabamos: sinSiglas(c.lectura ?? c.clave),
      logramos: sinSiglas(c.dato),
      estado: c.veredicto === "si" ? "si" : c.veredicto === "no" ? "no" : "parcial",
    }));
  }

  if (p.jugado && p.gf !== null && p.gc !== null) {
    const r = p.gf > p.gc ? "Victoria" : p.gf < p.gc ? "Derrota" : "Empate";

    filas.push({
      que: "El resultado",
      buscabamos: pr ? `Ganar · el pronóstico daba un ${Math.round(pr.victoria * 100)} %` : "Ganar",
      logramos: `${r} ${p.gf}-${p.gc}`,
      estado: r === "Victoria" ? "si" : r === "Empate" ? "parcial" : "no",
    });
  }

  /*
  | Las claves del plan revisadas con Wyscout («¿Se cumplió?» del informe,
  | 20/10/2026): van primero, porque son lo que escribió el cuerpo técnico.
  | Sin métrica (veredicto `null`) no entran: no se inventa veredicto.
  */
  for (const c of informe.sintesis.cumplimiento ?? []) {
    if (!c.veredicto || !c.dato) continue;

    filas.push({ que: c.tema || "El plan", buscabamos: sinSiglas(c.clave), logramos: sinSiglas(c.dato), estado: c.veredicto === "si" ? "si" : c.veredicto === "no" ? "no" : "parcial" });
  }

  const xg = informe.duelo?.partido?.metricas.find((m) => m.key === "xg");

  for (const palanca of pr?.palancas ?? []) {
    if (!palanca.revisa) continue;

    const suyo = palanca.revisa === "xgSuyo";
    const real = suyo ? (xg?.suyo ?? null) : (xg?.nuestro ?? null);

    /* Sin el xG del partido (Wyscout llega los martes), la meta no entra: nada de «pendiente» (20/10/2026). */
    if (real === null) continue;

    filas.push({
      que: palanca.momento,
      buscabamos: sinSiglas(palanca.objetivo),
      logramos: `${suyo ? "Sus" : "Nuestros"} goles esperados: ${decimal(real)}`,
      estado: (suyo ? real <= palanca.meta : real >= palanca.meta) ? "si" : "no",
    });
  }

  const frenados = informe.sintesis.frenados;

  if (frenados.length) {
    const malos = frenados.filter((x) => !x.bien);

    filas.push({
      que: "Sus peligrosos",
      buscabamos: `Frenar a ${frenados.map((x) => apellidoDe(x.jugador.nombre)).join(", ")}`,
      logramos: malos.length ? malos.map((x) => `${apellidoDe(x.jugador.nombre)} ${x.texto}`).join("; ") : "Ninguno marcó ni asistió",
      estado: !malos.length ? "si" : malos.length < frenados.length ? "parcial" : "no",
    });
  }

  return filas;
}

/** El once previsto contra el que salió (post, si había uno marcado). */
function escenaAcierto(informe: InformePartido): Escena | null {
  const a = informe.cronica?.acierto;

  if (!a || !a.total) return null;

  const cifras: Cifra[] = [
    { rotulo: "Once acertado", valor: `${a.acertados}/${a.total}`, pie: a.acertados === a.total ? "Salió el once previsto entero" : "Jugadores previstos que fueron titulares" },
    ...(a.sorpresas.length ? [{ rotulo: "Sorpresas", valor: String(a.sorpresas.length), pie: corta(a.sorpresas.join(", "), 60) }] : []),
    ...(informe.cronica?.estructura ? [{ rotulo: "Su dibujo", valor: informe.cronica.estructura }] : []),
  ];

  return { id: "acierto", tipo: "cifras", titulo: "El once que esperábamos", cifras, locucion: `Acertamos ${a.acertados} de ${a.total} de su once${a.sorpresas.length ? `; sorpresas: ${a.sorpresas.join(", ")}` : ""}.` };
}

export type ExtrasPartido = { escudoNosotros?: string | null; escudoRival?: string | null };

/* ------------------------------------------------------------------ */
/*  EL INFORME DEL PARTIDO                                             */
/* ------------------------------------------------------------------ */

/**
 * El escudo del rival, o nada (22/10/2026, crítica de marketing): si el
 * buscador no lo encuentra y devuelve el nuestro, el vídeo enseñaba el del
 * Madrid a los dos lados. Sin escudo, el rival va sólo con su nombre.
 */
export function escudoDelRival(extras: { escudoRival?: string | null; escudoNosotros?: string | null }) {
  const r = (extras.escudoRival ?? "").trim();

  if (!r) return null;

  let legible = r;

  try {
    legible = decodeURIComponent(r);
  } catch {
    /* Tal cual. */
  }

  if (r === (extras.escudoNosotros ?? "/logo.png") || /(^|\/)logo\.png($|\?)/i.test(legible) || /real[-_ ]?madrid|castilla/i.test(legible)) return null;

  return r;
}

/** Las escenas que son lámina de datos (cifras, tarjetas, barras): cada dos, una jugada. */
const DE_DATOS = new Set<Escena["tipo"]>(["contexto", "barras", "versus", "percentiles", "duelos", "cifras", "fases", "balance"]);

/**
 * Ningún tramo de más de dos láminas de datos seguidas (22/10/2026, crítica
 * del editor): si quedan cortes de vídeo más adelante, el primero se adelanta
 * y rompe la racha. Sin cortes, todo se queda como está.
 */
export function intercalaCortes(escenas: Escena[]): Escena[] {
  const lista = [...escenas];
  let racha = 0;

  for (let i = 0; i < lista.length; i += 1) {
    if (!DE_DATOS.has(lista[i].tipo)) {
      racha = 0;
      continue;
    }

    racha += 1;

    if (racha <= 2) continue;

    const j = lista.findIndex((x, k) => k > i && x.tipo === "clips");

    if (j < 0) continue;

    const [corte] = lista.splice(j, 1);

    lista.splice(i, 0, corte);
    racha = 0;
  }

  return lista;
}

export function guionDePartido(informe: InformePartido, extras: ExtrasPartido = {}): GuionVideo {
  const { partido, sintesis, pronostico, momento } = informe;
  const previa = momento === "previa";
  const lado = partido.lado === "casa" ? "en casa" : partido.lado === "fuera" ? "fuera" : "";
  const marcador = partido.gf !== null && partido.gc !== null ? `${partido.gf}-${partido.gc}` : "";
  const escenas: Escena[] = [];
  const vigilarClaves = new Set(sintesis.vigilar.map((j) => j.clave));

  /*
  | La historia (14/10/2026). Previa: gancho → portada → cómo llegamos →
  | pronóstico → su once → cómo juegan → sus acciones → fase a fase → dónde
  | nos separamos → a vigilar → duelos → claves → nuestros cortes → plan.
  | Post: gancho → portada → lo que decía el dato → los cortes → el partido
  | en datos → su once y si lo acertamos → claves → frenados → lo que deja.
  | Cada escena de datos sale sólo si hay datos para ella.
  */
  const pon = (e: Escena | null) => {
    if (e) escenas.push(e);
  };

  pon(escenaGancho(informe));

  /* La portada es también el póster del correo (20/10/2026): con la idea del partido en ocho palabras. */
  const idea = ideaDelPartido(informe);

  escenas.push({
    id: "portada",
    tipo: "portada",
    titulo: partido.rival,
    subtitulo: [partido.jornada ? `Jornada ${partido.jornada}` : "", partido.fechaTexto, lado].filter(Boolean).join(" · "),
    sello: previa ? "PREVIA" : `POST${marcador ? ` · ${marcador}` : ""}`,
    escudoNosotros: extras.escudoNosotros ?? "/logo.png",
    escudoRival: escudoDelRival(extras),
    ...(idea ? { idea } : {}),
    locucion: previa ? `${partido.rival}, ${lado || "próximo partido"}. ${limpia(sintesis.titular)}` : `${partido.rival}${marcador ? `, ${marcador}` : ""}. ${limpia(sintesis.titular)}`,
  });

  if (previa) pon(escenaContexto(informe));

  /* El pronóstico, sólo en la previa (20/10/2026): en el post el porcentaje ya va en la fila «El resultado» del balance. */
  if (pronostico && previa) {
    const p = pronostico;
    const pct = (x: number) => `${Math.round(x * 100)} %`;

    escenas.push({
      id: "pronostico",
      tipo: "barras",
      titulo: `Victoria: ${pct(p.victoria)}; con el plan, ${pct(p.conPlan.victoria)}`,
      barras: [
        { rotulo: "Victoria", valor: p.victoria, texto: pct(p.victoria) },
        { rotulo: "Empate", valor: p.empate, texto: pct(p.empate) },
        { rotulo: "Derrota", valor: p.derrota, texto: pct(p.derrota) },
        { rotulo: "Con el plan", valor: p.conPlan.victoria, texto: pct(p.conPlan.victoria) },
      ],
      locucion: `El modelo nos da un ${Math.round(p.victoria * 100)} por ciento de victoria; con el plan, un ${Math.round(p.conPlan.victoria * 100)}.`,
    });
  }

  /* El once del rival sobre el campo en 3D, con los que hay que vigilar en oro (sólo en la previa: el post cuenta el partido, 20/10/2026). */
  const once = informe.once.jugadores.filter((j) => typeof j.x === "number" && typeof j.y === "number");

  if (previa && once.length >= 7) {
    escenas.push({
      id: "once",
      tipo: "once",
      titulo: `Su once ${informe.once.fuente === "marcado" ? "previsto" : "habitual"}${sintesis.vigilar.length ? ": en oro, a quién vigilar" : ""}`,
      jugadores: once.map((j) => ({ nombre: j.nombre, dorsal: j.dorsal, posicion: j.posicion, foto: fotoVia(j.foto), x: j.x!, y: j.y!, destacado: vigilarClaves.has(j.clave) })),
      locucion: `${informe.once.detalle ? limpia(informe.once.detalle) : "Así se colocan."} ${sintesis.vigilar.length ? `En oro, ${sintesis.vigilar.map((j) => j.nombre).join(", ")}.` : ""}`.trim(),
    });
  }

  if (previa) escenas.push(...escenaFases(informe));
  else pon(escenaAcierto(informe));

  /* Las claves de la previa: cada una es una consigna (presente, «nosotros») y, debajo, su dato (21/10/2026). */
  const consignasPrevia = previa ? consignasDePrevia(informe) : [];

  /* Una sola clave no lleva escena propia (21/10/2026): la dice el cierre, con su dato, y no sale dos veces seguidas. */
  if (consignasPrevia.length > 1) {
    const lineas = consignasPrevia.map((x) => x.linea);
    const titulo = lineas.length === 1 ? "La clave para ganar el partido" : `${lineas.length === 2 ? "Dos claves" : "Tres claves"} para ganar el partido`;

    escenas.push({ id: "claves", tipo: "claves", titulo, lineas, pies: consignasPrevia.map((x) => x.pie), locucion: consignasPrevia.map((x) => (x.pie ? `${x.linea}: ${x.pie}` : x.linea)).join(". ") });
  }

  /* Post: lo que buscábamos, como planteamiento (el balance del final dice si se logró). */
  if (!previa) {
    pon(
      /* Sin «Ganar» (25/10/2026, guionista): no se entrena ni se mide; las metas del plan, contadas como en la diapositiva. */
      escenaPlan([
        ...(sintesis.cumplimiento ?? []).map((x) => x.lectura ?? x.clave),
        ...(pronostico?.palancas ?? []).map((x) => x.objetivo),
        ...(sintesis.frenados.length ? [`Frenar a ${sintesis.frenados.map((x) => apellidoDe(x.jugador.nombre)).join(", ")}`] : []),
      ]),
    );
  }

  /* Los cortes del partido cortados por el ordenador del club desde Hudl (goles, llegadas, lo que concedimos), con su lectura. En la previa son del último partido jugado. */
  escenas.push(...escenasDeCortes(informe.recursos.cortes ?? [], partido.rival, SEGUNDOS_POR_CORTE_PARTIDO, { momento, rotuloPartido: previa && partido.jornada ? `J${partido.jornada - 1}` : undefined }));

  /*
  | Los cortes de acciones concretas del rival (Análisis visual, por jornada) y, si no, sus vídeos de Recursos.
  | Sólo en la previa (15/10/2026): en el post son de partidos anteriores y no cuentan el partido jugado.
  */
  const cortes: Corte[] = !previa ? [] : informe.recursos.videos.filter((v) => esClipLegible(v.url)).map((v) => ({ url: v.url, rotulo: v.rotulo ?? v.nombre, texto: v.texto }));

  /* Dos escenas de hasta tres: la segunda es la primera en caer si no cabe. */
  for (const [i, trozo] of [cortes.slice(0, CORTES / 2), cortes.slice(CORTES / 2, CORTES)].entries()) {
    if (!trozo.length) continue;

    escenas.push({
      id: i === 0 ? "clips" : "clips-rival-2",
      tipo: "clips",
      titulo: i === 0 ? tituloDeAcciones(trozo) : "Y así nos pueden castigar",
      cortes: trozo,
      segundos: trozo.length * SEGUNDOS_POR_CORTE,
      locucion: locucionDeAcciones(trozo, i === 0),
    });
  }

  if (previa) {
    /*
    | Si las dos escenas de barras abren con la misma métrica («Fuertes en
    | centros» y «Nos sacan ventaja en centros»), queda sólo la comparativa
    | (21/10/2026, críticas del editor y de marketing).
    */
    const fasesRival = escenaPercentiles(informe);
    const cruce = escenaVersus(informe);
    const clave = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/).filter((p) => p.length > 3);
    const repite =
      fasesRival?.tipo === "percentiles" && cruce?.tipo === "versus" && cruce.filas[0]
        ? (() => {
            const mejor = [...fasesRival.filas].sort((a, b) => b.percentil - a.percentil)[0];
            const a = clave(mejor?.nombre ?? "");
            const b = clave(cruce.filas[0].nombre);

            return a.some((p) => b.includes(p));
          })()
        : false;

    if (!repite) pon(fasesRival);
    pon(cruce);

    const ventajas = sintesis.ventajas.slice(0, 2).map((v) => cortaPalabras(sinSiglas(limpia(v)), 12));
    const amenazas = sintesis.amenazas.slice(0, 2).map((v) => cortaPalabras(sinSiglas(limpia(v)), 12));

    if (ventajas.length || amenazas.length) {
      escenas.push({
        id: "duelo",
        tipo: "cifras",
        titulo: "Dónde ganamos y dónde ganan ellos",
        cifras: [...ventajas.map((v) => ({ rotulo: "A favor", valor: v })), ...amenazas.map((v) => ({ rotulo: "Vigilar", valor: v }))],
        locucion: `A favor: ${ventajas.join("; ")}. A vigilar: ${amenazas.join("; ")}.`,
      });
    }
  }

  /* Una frase de diez palabras como mucho por jugador (crítica del editor: a 40 px no cabe más en el móvil). */
  const vigilar: JugadorEscena[] = previa
    ? sintesis.vigilar.slice(0, 3).map((j) => ({ nombre: j.nombre, dorsal: j.dorsal, posicion: j.posicion, foto: fotoVia(j.foto), x: 0, y: 0, destacado: true, texto: cortaPalabras(j.rasgos.slice(0, 2).join(" · ") || limpia(j.fortalezas), 10) }))
    : sintesis.frenados.slice(0, 3).map((f) => ({ nombre: f.jugador.nombre, dorsal: f.jugador.dorsal, posicion: f.jugador.posicion, foto: fotoVia(f.jugador.foto), x: 0, y: 0, destacado: f.bien, texto: cortaPalabras(limpia(f.texto), 10) }));

  if (vigilar.length) {
    const bien = vigilar.filter((j) => j.destacado).length;

    escenas.push({
      id: "vigilar",
      tipo: "vigilar",
      titulo: previa ? `A vigilar: ${vigilar.map((j) => apellidoDe(j.nombre)).join(" y ")}` : bien === vigilar.length ? "Los frenamos a todos" : `Frenamos a ${bien} de ${vigilar.length} de sus peligrosos`,
      jugadores: vigilar,
      locucion: `${previa ? "Sus hombres a vigilar" : "Los que había que frenar"}: ${vigilar.map((j) => `${j.nombre}${j.texto ? `, ${j.texto.toLowerCase()}` : ""}`).join("; ")}.`,
    });
  }

  if (previa) pon(escenaDuelos(informe));

  const abp = informe.abp?.pincelada ?? null;

  if (abp && abp.cifras.length) {
    escenas.push({ id: "abp", tipo: "cifras", titulo: "El balón parado, en cifras", cifras: abp.cifras.slice(0, 4), locucion: `Balón parado: ${limpia(abp.titular)}` });
  }

  /* Post (15/10/2026): antes de la conclusión, los datos más significativos del partido y el balance contra el plan. */
  if (!previa) pon(escenaVersus(informe));

  const balance = previa ? null : escenaBalance(filasDeBalance(informe));

  if (balance) escenas.push(balance.escena);

  /*
  | El cierre es la CONSIGNA (20/10/2026, críticas del guionista y del
  | editor): en presente y primera persona del plural, a 64 px. Previa: las
  | dos primeras claves como consigna (una sola si la primera es larga);
  | post: el recuento del balance y lo que toca esta semana.
  */
  /*
  | Previa: primero «Cómo lo ganamos» del informe (ya viene en presente y en
  | primera persona: «Les quitamos los pases en el último tercio»), sin el dato
  | de después de los dos puntos; si no hay, las claves pasadas a consigna.
  | Post: el recuento y lo primero que toca en el microciclo.
  */
  /*
  | Previa (21/10/2026): la consigna principal, la misma que la portada y la
  | primera clave (el vídeo se cierra en bucle). Post: lo que toca esta semana
  | como consigna completa («Esta semana, cerramos los partidos que vamos
  | ganando»), no como etiqueta («Esta semana trabajamos: transición»); hasta
  | dos. El recuento ya lo dice el balance.
  */
  const consignas = consignasPrevia.map((x) => x.linea);
  const tocan = [...new Set((sintesis.microciclo ?? []).map((m) => m.split(" · ")[0].trim()).filter(Boolean).map((tema) => `Esta semana, ${consignaDeMejora(tema)}`))];
  /*
  | Un único cierre (21/10/2026, crítica del editor: la consigna salía dos
  | veces seguidas): UNA consigna a 64 px y, debajo, su dato en oro. Previa: la
  | primera clave; post: lo primero que toca, con el porqué del informe.
  */
  const cierre = previa ? consignas.slice(0, 1) : tocan.length ? tocan.slice(0, 1) : balance ? balance.cierre.slice(1, 2) : [];
  /*
  | Previa: si la consigna contesta al gancho, el dato de debajo lo dice
  | («Contra su 2.º en centros al área»): el vídeo se cierra en bucle
  | (22/10/2026, crítica del guionista).
  */
  const arma = armaDelRival(informe);
  const contraSuArma = previa && arma && consignasPrevia[0] && respondeAlArma(informe, `${consignasPrevia[0].linea} ${consignasPrevia[0].pie}`) ? `Contra su ${arma.puesto}.º en ${sinSiglas(arma.nombre).toLowerCase()}` : "";
  const pieCierre = previa ? contraSuArma || (consignasPrevia[0]?.pie ?? "") : tocan.length ? cortaPalabras(limpia((sintesis.microciclo ?? [])[0]?.split(" · ").slice(1).join(" · ") ?? ""), 12) : "";

  if (!cierre.length && !previa) cierre.push(giroDelPartido(informe) || limpia(sintesis.titular));

  escenas.push({
    id: "cierre",
    tipo: "cierre",
    titulo: previa || tocan.length ? "Nuestra consigna" : "Lo que nos deja",
    lineas: cierre.length ? cierre : [limpia(sintesis.titular)],
    ...(pieCierre ? { pie: pieCierre } : {}),
    locucion: previa ? `Nuestra consigna: ${cierre.join(". ") || limpia(sintesis.titular)}` : `Lo que nos deja: ${cierre.join(". ") || limpia(sintesis.titular)}`,
  });

  /*
  | El orden de la historia. Previa (15/10/2026): el rival (cómo llega, el
  | pronóstico, su once, cómo juega y sus acciones), dónde nos separamos y a
  | quién vigilar, cómo llegamos nosotros y, al final, el plan. Post
  | (20/10/2026, crítica del guionista): buscábamos → pasó → nos deja; el
  | gancho, la portada, lo que buscábamos, los goles, nuestras llegadas, lo
  | que nos generaron, los datos, si frenamos a sus peligrosos, el balance y
  | el cierre.
  */
  /*
  | Previa, segunda ronda (21/10/2026, críticas del guionista y del editor):
  | imagen real antes de la sexta escena (sus acciones justo tras su once),
  | una sola comparativa (la cara a cara; los percentiles sólo si no la hay),
  | «duelo» fuera si hay duelos por zonas, y de nuestro último partido sólo
  | las llegadas, justo antes de las claves, como transición hacia el plan.
  */
  if (previa) {
    const hay = (id: string) => escenas.some((e) => e.id === id);
    const fuera = new Set(["clips-1", "clips-3", ...(hay("versus") ? ["percentiles"] : []), ...(hay("duelos") ? ["duelo"] : [])]);

    for (let i = escenas.length - 1; i >= 0; i -= 1) if (fuera.has(escenas[i].id)) escenas.splice(i, 1);

    const llegadas = escenas.find((e): e is Extract<Escena, { tipo: "clips" }> => e.id === "clips-2" && e.tipo === "clips");

    if (llegadas && partido.jornada) llegadas.titulo = `Así llegamos en la J${partido.jornada - 1}: lo repetimos`;
  }

  const ORDEN = previa
    ? ["gancho", "portada", "contexto", "pronostico", "clips", "once", "fases", "fases-2", "clips-rival-2", "versus", "percentiles", "duelos", "duelo", "vigilar", "abp", "clips-2", "claves", "cierre"]
    : ["gancho", "portada", "plan", "clips-1", "clips-2", "clips-3", "versus", "vigilar", "acierto", "abp", "balance", "cierre"];
  const lugar = (id: string) => (ORDEN.includes(id) ? ORDEN.indexOf(id) : ORDEN.length - 1.5);

  escenas.sort((a, b) => lugar(a.id) - lugar(b.id));

  /* Un corte antes de su once y ninguna racha de más de dos láminas de datos (22/10/2026, crítica del editor). */
  return { titulo: `${partido.rival} · ${previa ? "previa" : "post"}`, escenas: intercalaCortes(soloCompletas(escenas)) };
}

/** El tipo de acción que más se repite en los cortes del rival, para el título («Así lo hacen: córner ofensivo»). */
function tituloDeAcciones(cortes: Corte[]) {
  const cuenta = new Map<string, number>();

  for (const c of cortes) {
    const tipo = c.rotulo.split(" · ")[0].trim();

    if (tipo) cuenta.set(tipo, (cuenta.get(tipo) ?? 0) + 1);
  }

  /*
  | El título no contradice al corte (24/10/2026, guion: «córner ofensivo»
  | sobre un centro lateral). Un tipo, ése; dos, los dos; más, el título
  | genérico y cada corte dice el suyo en el rótulo.
  */
  const tipos = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t.toLowerCase());

  if (!tipos.length || tipos.length > 2) return "Así lo hacen";

  const titulo = `Así lo hacen: ${tipos.join(" y ")}`;

  return titulo.split(/\s+/).length <= 8 ? titulo : "Así lo hacen";
}

/** La locución de los cortes del rival: si el primero trae lectura, se dice qué mirar; si no, qué viene. */
function locucionDeAcciones(cortes: Corte[], primera: boolean) {
  const lectura = cortes.find((c) => c.texto)?.texto;

  if (lectura) return `Mira: ${corta(limpia(lectura), 120)}`;

  return primera ? `Así lo hacen: ${cortes.map((c) => c.rotulo.split(" · ")[0].toLowerCase()).join(", ")}.` : "Y así nos pueden castigar.";
}

/** Lo que dura como mucho la pieza «Consignas» para los jugadores. */
export const SEGUNDOS_CONSIGNAS = 75;
/** Y lo que dura como poco en vertical (21/10/2026): sin estirar al minuto del informe. */
export const SEGUNDOS_CONSIGNAS_MINIMOS = 45;

/**
 * La pieza «CONSIGNAS» para los jugadores (20/10/2026, crítica del productor
 * de vídeo): 60-75 s para el móvil, sólo lo que se recuerda en el campo. Es
 * una lista blanca de escenas del mismo guion, como `entradaDeAbp`: sin barras,
 * percentiles ni comparativas. Previa: gancho, portada, a vigilar, un bloque
 * de cortes del rival, las claves y la consigna; post: gancho, portada, los
 * goles, el balance y la consigna. Se monta con `montaVideoInforme(…, { tope:
 * SEGUNDOS_CONSIGNAS })`; el diálogo del informe la descarga con «Vídeo para
 * jugadores» (21/10/2026). Sale en vertical (`montaVideoInforme(…, { vertical:
 * true })`, composición propia de cada escena en `vertical.ts`) o en 16:9.
 */
export function consignasDePartido(informe: InformePartido, extras: ExtrasPartido = {}): GuionVideo {
  const completo = guionDePartido(informe, extras);
  const entran = new Set(informe.momento === "previa" ? ["gancho", "portada", "vigilar", "clips", "claves", "cierre"] : ["gancho", "portada", "clips-1", "balance", "cierre"]);

  /* Nunca el pronóstico ni porcentajes de victoria (21/10/2026, experto de fútbol: a un jugador no se le enseña eso). */
  return { titulo: `${informe.partido.rival} · consignas`, escenas: completo.escenas.filter((e) => entran.has(e.id) && e.id !== "pronostico" && !(e.tipo === "barras" && /victoria/i.test(e.titulo))) };
}

/* ------------------------------------------------------------------ */
/*  EL INFORME DE ABP DE LA SEMANA                                     */
/* ------------------------------------------------------------------ */

export type ExtrasAbp = {
  /** Los cortes del rival de Análisis visual (sólo balón parado), con su lectura. */
  cortes?: Corte[];
  /** Los cortes de balón parado del partido (post) o del último jugado (previa), cortados de Hudl. */
  cortesPartido?: CortePartido[];
  /** «J7»: de qué partido son los cortes, para decirlo en la previa. */
  rotuloPartido?: string;
  /** El vídeo de análisis previo que sube el analista: se enseñan tres trozos. */
  videoPrevio?: { url: string; nombre: string } | null;
  escudoRival?: string | null;
};

export function guionDeAbp(informe: InformeMicro, pincelada: PinceladaAbp, extras: ExtrasAbp = {}): GuionVideo {
  const escenas: Escena[] = [];
  const momento = informe.modo === "post" ? "post" : "previa";

  /* El gancho (14/10/2026): la primera cifra de la semana, enorme, antes de la portada. */
  const primera = informe.resumen[0];

  /* Un cero no engancha (20/10/2026: «0′ de trabajo» el lunes sonaba a reproche): sin gancho, se abre con la portada. */
  if (primera && primera.valor.length <= 8 && !/^0(?![,.]\d)(\D|$)/.test(primera.valor.trim())) {
    /* «4 de 27 / PRIORIDAD Nº 1» no decía de qué (21/10/2026, crítica del guionista): el aspecto y el peligro. */
    const aspecto = /^prioridad/i.test(primera.rotulo) && primera.pie ? primera.pie.split(":")[0].trim() : "";
    const rotulo = aspecto ? `${aspecto} · ${/en contra/i.test(primera.pie ?? "") ? "peligro en contra" : "con peligro"}` : primera.rotulo;

    escenas.push({ id: "gancho", tipo: "gancho", dato: primera.valor, rotulo: rotulo.toUpperCase(), contexto: primera.pie ? limpia(primera.pie) : corta(limpia(pincelada.titular), 80), locucion: `${primera.rotulo}: ${primera.valor}.` });
  }

  escenas.push({
    id: "portada",
    tipo: "portada",
    titulo: informe.titulo,
    subtitulo: [informe.subtitulo, informe.rango].filter(Boolean).join(" · "),
    sello: `BALÓN PARADO · ${informe.modoRotulo.toUpperCase()}`,
    escudoNosotros: "/logo.png",
    escudoRival: escudoDelRival(extras),
    locucion: `Balón parado, ${informe.modoRotulo}. ${limpia(pincelada.titular)}`,
  });

  const resumen = informe.resumen.slice(0, 4);

  if (resumen.length) {
    /* El título dice la conclusión (21/10/2026): la del titular del informe, hasta su primera pausa. */
    const conclusion = corta(sinSiglas(limpia(pincelada.titular)), 60);

    escenas.push({ id: "cifras", tipo: "cifras", titulo: conclusion || "La semana, en números", cifras: resumen, locucion: resumen.map((c) => `${c.rotulo}: ${c.valor}`).join(". ") });
  }

  /* En consigna si empieza por un verbo; si no, diez palabras como mucho (21/10/2026: `corta(…, 90)` dejaba unas quince). */
  const claves = pincelada.claves.slice(0, 4).map((c) => consigna(c, 10) || cortaPalabras(sinSiglas(limpia(c)), 10).replace(/[.;,:\s]+$/, ""));

  if (claves.length) {
    escenas.push({ id: "claves", tipo: "claves", titulo: `${["", "Una cosa", "Dos cosas", "Tres cosas", "Cuatro cosas"][claves.length]} ${momento === "post" ? "que nos deja el partido" : "para el partido"}`, lineas: claves, locucion: claves.join(". ") });
  }

  /* Las láminas dibujadas del rival, con movimiento de cámara; luego sus cortes; luego los dos gráficos que contestan la semana. */
  const esImagen = (g: InformeMicro["graficos"][number]) => g.imagen.startsWith("data:image/");
  const laminas = informe.graficos.filter((g) => esImagen(g) && /^rival-\d+$/.test(g.cid)).slice(0, 3);

  for (const [i, g] of laminas.entries()) {
    escenas.push({ id: `lamina-${i}`, tipo: "imagen", titulo: g.titulo, src: g.imagen, pie: corta(limpia(g.leyenda), 110), locucion: corta(limpia(g.leyenda), 140) });
  }

  /* El vídeo de análisis previo del analista: tres trozos repartidos (al 15, 45 y 75 %). */
  if (momento === "previa" && extras.videoPrevio?.url) {
    const v = extras.videoPrevio;

    escenas.push({
      id: "analisis-previo",
      tipo: "clips",
      titulo: "Su balón parado, en tres jugadas",
      cortes: [0.15, 0.45, 0.75].map((f) => ({ url: v.url, rotulo: `Análisis previo · ${v.nombre.replace(/\.[a-z0-9]+$/i, "")}`, desdeFraccion: f })),
      segundos: 3 * 7,
      locucion: "El análisis previo del rival, en tres momentos del vídeo.",
    });
  }

  /* Los cortes del rival (Análisis visual): hasta dos escenas de cuatro, con la lectura de cada uno. Primero los que traen lectura. */
  const delRival = (extras.cortes ?? []).filter((c) => esClipLegible(c.url)).sort((a, b) => Number(Boolean(b.texto)) - Number(Boolean(a.texto)));

  for (const [i, trozo] of [delRival.slice(0, 4), delRival.slice(4, 8)].entries()) {
    if (!trozo.length) continue;

    escenas.push({
      id: i === 0 ? "clips" : "clips-rival-2",
      tipo: "clips",
      titulo: i === 0 ? "Su balón parado: cómo lo hacen" : "Su balón parado: más acciones",
      cortes: trozo,
      segundos: trozo.length * 7,
      locucion: `${trozo.length === 1 ? "Una acción suya" : `${trozo.length} acciones suyas`}: ${trozo.map((c) => c.rotulo.split(" · ")[0].toLowerCase()).join(", ")}.`,
    });
  }

  /* El balón parado del partido (post) o del último jugado (previa), cortado de Hudl. */
  const rivalNombre = extras.rotuloPartido && momento === "previa" ? "el rival" : informe.titulo.replace(/^.*?·\s*/, "");

  escenas.push(...escenasDeCortesAbp((extras.cortesPartido ?? []).filter((c) => /^(corner|abp|banda)/.test(c.tipo)), rivalNombre, { momento, rotuloPartido: extras.rotuloPartido }));

  const graficos = informe.graficos.filter((g) => esImagen(g) && !g.cid.startsWith("rival-")).slice(0, 3);

  for (const [i, g] of graficos.entries()) {
    escenas.push({ id: `grafico-${i}`, tipo: "imagen", titulo: g.titulo, src: g.imagen, pie: corta(limpia(g.leyenda), 110), locucion: corta(limpia(g.leyenda), 140) });
  }

  const rival = pincelada.rival.slice(0, 3).map((c) => cortaPalabras(sinSiglas(limpia(c)), 12).replace(/[.;,:\s]+$/, ""));

  if (rival.length) {
    /* El título con la conclusión (21/10/2026): la primera lectura del rival, hasta su pausa. */
    const titulo = corta(rival[0], 48);

    escenas.push({ id: "rival", tipo: "claves", titulo: titulo && titulo !== rival[0] ? `Su balón parado: ${titulo.charAt(0).toLowerCase()}${titulo.slice(1)}` : "Así es su balón parado", lineas: rival, locucion: rival.join(". ") });
  }

  /* La consigna en presente (20/10/2026): la primera clave si empieza por un verbo; si no, el titular. */
  const primeraClave = pincelada.claves[0] ? consigna(pincelada.claves[0], 10) : "";
  const abpConsigna = primeraClave ? `Esta semana, ${primeraClave.charAt(0).toLowerCase()}${primeraClave.slice(1)}` : "";

  escenas.push({
    id: "cierre",
    tipo: "cierre",
    titulo: informe.modo === "post" ? "Lo que nos deja" : "Para esta semana",
    lineas: [abpConsigna || corta(limpia(pincelada.titular), 90)],
    locucion: abpConsigna || limpia(pincelada.titular),
  });

  return { titulo: `ABP · ${informe.titulo}`, escenas: soloCompletas(escenas) };
}

/**
 * La comprobación previa (21/10/2026, crítica del productor: «con pocos datos
 * salen escenas medio vacías»): una escena sin lo mínimo para contarse no
 * entra. Nada de huecos en pantalla (regla del usuario: lo que no tiene dato
 * no se nombra). La usan los dos guiones y `montaVideoInforme`.
 */
export function escenaCompleta(e: Escena): boolean {
  const lleno = (t: string | undefined) => Boolean(t && t.trim());

  switch (e.tipo) {
    case "claves":
    case "cierre":
      return e.lineas.some(lleno);
    case "cifras":
      return e.cifras.some((c) => lleno(c.valor));
    case "barras":
      return e.barras.length >= 2;
    case "once":
      return e.jugadores.filter((j) => lleno(j.nombre)).length >= 7;
    case "vigilar":
      return e.jugadores.some((j) => lleno(j.nombre));
    case "clips":
      /* Un corte sin vídeo es un campo vacío en pantalla (22/10/2026, crítica del productor). */
      return e.cortes.some((c) => lleno(c.url));
    case "contexto":
      return e.equipos.filter((x) => x.puesto !== null || x.racha.length).length >= 2;
    case "versus":
    case "percentiles":
      return e.filas.length >= 3;
    case "duelos":
      return e.duelos.filter((d) => lleno(d.titulo)).length >= 2;
    case "fases":
      /* Las fases van de dos en dos (21/10/2026): basta una tarjeta con texto. Antes pedía tres y se comía las dos escenas. */
      return e.fases.some((x) => lleno(x.texto));
    case "balance":
      return e.filas.filter((x) => lleno(x.logramos)).length >= 2;
    case "imagen":
      return lleno(e.src);
    case "gancho":
      return lleno(e.dato) && lleno(e.rotulo);
    default:
      return true;
  }
}

export const soloCompletas = (escenas: Escena[]) => escenas.filter(escenaCompleta);

/** Lo que dura como mucho la entrada del informe delante de nuestro vídeo de ABP. */
export const SEGUNDOS_ENTRADA_ABP = 36;

/**
 * La ENTRADA del vídeo de ABP para los jugadores (18/10/2026, lo pidió el
 * usuario): un trozo del informe —la portada, las cifras de la semana, lo que
 * hay que mirar y el rival— y detrás va nuestro vídeo entero (la «cola» de
 * `montaVideoInforme`). Sin cortes ni láminas: eso ya lo cuenta nuestro vídeo.
 */
export function entradaDeAbp(informe: InformeMicro, pincelada: PinceladaAbp, extras: Pick<ExtrasAbp, "escudoRival"> = {}): GuionVideo {
  const entran = new Set(["portada", "cifras", "claves", "rival"]);
  const completo = guionDeAbp(informe, pincelada, { escudoRival: extras.escudoRival });

  return { ...completo, escenas: completo.escenas.filter((e) => entran.has(e.id)) };
}
