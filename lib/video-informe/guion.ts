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

/** Las escenas de cortes del partido, agrupadas por lo que cuentan: todos los goles, y hasta 4 llegadas nuestras y 3 suyas. */
export function escenasDeCortes(cortes: CortePartido[], rival: string, segundosPorCorte = SEGUNDOS_POR_CORTE_PARTIDO, opciones: { momento?: "previa" | "post"; rotuloPartido?: string } = {}): Escena[] {
  const previa = opciones.momento === "previa";
  /* En la previa los cortes son del ÚLTIMO partido, no de éste: se dice en el título y en la voz. */
  const de = previa ? ` · ${opciones.rotuloPartido ?? "último partido"}` : "";
  const grupos: { id: string; titulo: string; tipos: CortePartido["tipo"][]; locucion: (n: number) => string }[] = [
    { id: "clips-1", titulo: previa ? `Cómo llegamos: los goles${de}` : "Los goles", tipos: ["gol", "gol-contra"], locucion: () => (previa ? `Cómo llegamos: los goles ${opciones.rotuloPartido ? `de ${opciones.rotuloPartido}` : "del último partido"}.` : "Los goles del partido.") },
    { id: "clips-2", titulo: previa ? `Cómo llegamos: nuestras llegadas${de}` : "Nuestras llegadas", tipos: ["remate", "contra", "robo", "corner", "abp"], locucion: (n) => `${n === 1 ? "Una llegada nuestra" : `${n} llegadas nuestras`}${previa ? " del último partido" : ""}: cómo generamos.` },
    { id: "clips-3", titulo: previa ? `Lo que concedimos${de}` : `Lo que nos generó ${rival}`, tipos: ["remate-contra", "perdida"], locucion: (n) => `${n === 1 ? "Una llegada suya" : `${n} llegadas suyas`}${previa ? " en el último partido" : ""}: por dónde nos hicieron daño.` },
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
    escenas.push({
      id: g.id,
      tipo: "clips",
      titulo: g.titulo,
      /* Cada gol lleva su repetición a cámara lenta justo detrás: los 2 s alrededor del remate, a media velocidad. */
      cortes: elegidos.flatMap((c) => {
        const base = { ...c, minutoNum: c.minutoNum ?? minutoNumero(c.minuto) };
        const esGol = c.tipo === "gol" || c.tipo === "gol-contra";

        return esGol ? [base, { ...base, repeticion: true, velocidad: 0.5, desde: (c.desde ?? 0) + 4.3, segundos: 4.4 }] : [base];
      }),
      /* Cada corte entero: lo que dure su fichero (el ordenador del club lo deja en `segundos`). */
      segundos: elegidos.reduce((s, c) => s + (c.segundos || segundosPorCorte) + (c.tipo === "gol" || c.tipo === "gol-contra" ? 4.4 : 0), 0),
      locucion: g.locucion(elegidos.length),
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
    escenas.push({ id: g.id, tipo: "clips", titulo: g.titulo, cortes: elegidos.map((c) => ({ ...c, minutoNum: c.minutoNum ?? minutoNumero(c.minuto) })), segundos: elegidos.reduce((s, c) => s + (c.segundos || segundosPorCorte), 0), locucion: g.locucion(elegidos.length), marcas });
  }

  return escenas;
}

export type JugadorEscena = { nombre: string; dorsal: string; posicion: string; foto: string; x: number; y: number; destacado: boolean; texto?: string };

export type Escena =
  | { id: string; tipo: "portada"; titulo: string; subtitulo: string; sello: string; escudoNosotros: string | null; escudoRival: string | null; locucion: string }
  | { id: string; tipo: "cifras"; titulo: string; cifras: Cifra[]; locucion: string }
  | { id: string; tipo: "claves"; titulo: string; lineas: string[]; locucion: string }
  | { id: string; tipo: "barras"; titulo: string; barras: { rotulo: string; valor: number; texto: string }[]; locucion: string }
  | { id: string; tipo: "once"; titulo: string; jugadores: JugadorEscena[]; locucion: string }
  | { id: string; tipo: "vigilar"; titulo: string; jugadores: JugadorEscena[]; locucion: string }
  | { id: string; tipo: "clips"; titulo: string; cortes: Corte[]; segundos: number; locucion: string; /** La línea del partido con todas sus acciones, si son cortes del partido. */ marcas?: MarcaPartido[] }
  | { id: string; tipo: "imagen"; titulo: string; src: string; pie: string; locucion: string }
  | { id: string; tipo: "cierre"; titulo: string; lineas: string[]; locucion: string }
  /*
  | Las escenas de datos (14/10/2026): lo que la app ya calcula y el vídeo no
  | contaba. El gancho abre con el dato más llamativo antes de la portada; el
  | resto sale de Duelos, de DATA (el rival de un vistazo), del colectivo y
  | de la clasificación.
  */
  | { id: string; tipo: "gancho"; dato: string; rotulo: string; contexto: string; locucion: string }
  | { id: string; tipo: "contexto"; titulo: string; equipos: EquipoContexto[]; locucion: string }
  | { id: string; tipo: "versus"; titulo: string; pie: string; filas: FilaVersus[]; locucion: string }
  | { id: string; tipo: "percentiles"; titulo: string; pie: string; filas: { nombre: string; percentil: number }[]; locucion: string }
  | { id: string; tipo: "duelos"; titulo: string; duelos: DueloEscena[]; locucion: string }
  | { id: string; tipo: "fases"; titulo: string; fases: { titulo: string; texto: string }[]; dano: string[]; locucion: string }
  /* Post (15/10/2026): lo que buscábamos frente a lo que logramos, fila a fila y con el dato. */
  | { id: string; tipo: "balance"; titulo: string; filas: FilaBalance[]; resumen: string; locucion: string };

/** Una fila del balance del post: la meta del plan, lo que dio el partido y si se cumplió. */
export type FilaBalance = { que: string; buscabamos: string; logramos: string; estado: "si" | "parcial" | "no" | "pendiente" };

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

const corta = (t: string, n = 90) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

const limpia = (t: string) => t.replace(/\s+/g, " ").trim();

/** Un vídeo del bucket se puede leer en el navegador; un enlace de YouTube, no. */
export const esClipLegible = (url: string) => /^https?:\/\/.+\.(mp4|m4v|mov|webm)(\?|$)/i.test(url) || /supabase\.co\/storage/i.test(url);

/** Las fotos de fuera pasan por el proxy, como en las diapositivas. */
const fotoVia = (src: string) => (src ? (src.startsWith("/") || src.startsWith("data:") ? src : `/api/rivals/foto?url=${encodeURIComponent(src)}`) : "");

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
 * El gancho: los primeros tres segundos, antes de la portada, con el dato
 * que más llama la atención. En el post, el marcador y la cifra del partido
 * en la que más ganamos; en la previa, el punto más fuerte del rival en la
 * categoría (o los puestos de los dos).
 */
function escenaGancho(informe: InformePartido): Escena | null {
  const { partido, duelo, vistazo, contexto, momento } = informe;

  if (momento === "post" && partido.gf !== null && partido.gc !== null) {
    const resultado = partido.gf > partido.gc ? "VICTORIA" : partido.gf < partido.gc ? "DERROTA" : "EMPATE";
    const mejor = (duelo?.partido?.metricas ?? [])
      .filter((m) => m.nuestro !== null && m.suyo !== null && m.mejorAlto !== null && Math.max(m.nuestro!, m.suyo!) > 0)
      .map((m) => ({ m, ventaja: ((m.nuestro! - m.suyo!) / Math.max(m.nuestro!, m.suyo!)) * (m.mejorAlto ? 1 : -1) }))
      .sort((a, b) => b.ventaja - a.ventaja)[0];
    const dato = mejor && mejor.ventaja > 0.15 ? `${mejor.m.nombre}: ${numero(mejor.m.nuestro!, mejor.m.unidad)} contra ${numero(mejor.m.suyo!, mejor.m.unidad)}` : corta(limpia(informe.sintesis.titular), 70);

    return { id: "gancho", tipo: "gancho", dato: `${partido.gf}-${partido.gc}`, rotulo: `${resultado} ANTE ${partido.rival.toUpperCase()}`, contexto: dato, locucion: `${resultado.toLowerCase()} ${partido.gf}-${partido.gc}. ${dato}.` };
  }

  const fuerte = vistazo?.fuertes[0];

  if (fuerte) {
    return {
      id: "gancho",
      tipo: "gancho",
      dato: `${fuerte.puesto}º`,
      rotulo: fuerte.nombre.toUpperCase(),
      contexto: `${partido.rival}, de ${fuerte.de} equipos de la categoría: su mejor arma (${fuerte.valor}).`,
      locucion: `${partido.rival} es ${fuerte.puesto}º de ${fuerte.de} en ${fuerte.nombre.toLowerCase()}.`,
    };
  }

  if (contexto?.puesto && contexto.nuestroPuesto) {
    return { id: "gancho", tipo: "gancho", dato: `${contexto.nuestroPuesto}º · ${contexto.puesto}º`, rotulo: `NOSOTROS CONTRA ${partido.rival.toUpperCase()}`, contexto: limpia(informe.sintesis.titular), locucion: `${contexto.nuestroPuesto}º contra ${contexto.puesto}º.` };
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

  return { id: "contexto", tipo: "contexto", titulo: "Cómo llegamos los dos", equipos, locucion: `${dice(equipos[0])}. ${dice(equipos[1])}.` };
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
    const filas: FilaVersus[] = d.partido.metricas
      .filter((m) => m.nuestro !== null && m.suyo !== null)
      .slice(0, 6)
      .map((m) => ({ nombre: m.nombre, nuestro: m.nuestro!, suyo: m.suyo!, textoNuestro: numero(m.nuestro!, m.unidad), textoSuyo: numero(m.suyo!, m.unidad), media: m.media, mejorAlto: m.mejorAlto }));

    if (filas.length < 3) return null;

    return { id: "versus", tipo: "versus", titulo: "El partido en datos", pie: "La raya marca la media de la liga por partido", filas, locucion: filas.slice(0, 3).map((f) => `${f.nombre}: ${f.textoNuestro} contra ${f.textoSuyo}`).join(". ") };
  }

  const filas: FilaVersus[] = d.metricas
    .filter((m) => m.nosotros && m.rival && m.nosotros.percentil !== null && m.rival.percentil !== null)
    .map((m) => ({ m, separa: Math.abs(m.nosotros!.percentil! - m.rival!.percentil!) }))
    .sort((a, b) => b.separa - a.separa)
    .slice(0, 5)
    .map(({ m }) => ({ nombre: m.nombre, nuestro: m.nosotros!.valor, suyo: m.rival!.valor, textoNuestro: numero(m.nosotros!.valor, m.unidad), textoSuyo: numero(m.rival!.valor, m.unidad), media: m.media ?? m.mediana, mejorAlto: m.mejorAlto }));

  if (filas.length < 3) return null;

  return { id: "versus", tipo: "versus", titulo: "Donde más nos separamos", pie: `Media por partido esta temporada · la raya, la mediana de los ${d.equipos} equipos`, filas, locucion: filas.slice(0, 3).map((f) => `${f.nombre}: ${f.textoNuestro} nosotros, ${f.textoSuyo} ellos`).join(". ") };
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
    titulo: `${informe.partido.rival}, fase a fase`,
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

  const duelos: DueloEscena[] = lista.map((d) => ({ titulo: d.titulo, nuestros: d.nuestros.join(" · "), suyos: d.suyos.join(" · "), veredicto: d.veredicto, texto: corta(limpia(d.resumen), 90) }));

  return { id: "duelos", tipo: "duelos", titulo: "Los duelos que deciden", duelos, locucion: duelos.map((d) => `${d.titulo}: ${d.veredicto === "ventaja" ? "ventaja nuestra" : d.veredicto === "desventaja" ? "ventaja suya" : "parejo"}`).join(". ") };
}

/** Cómo juegan, momento a momento, y dónde hacerles daño (Scouting colectivo). */
function escenaFases(informe: InformePartido): Escena | null {
  const r = informe.colectivo?.resumen;
  const fases = (r?.fases ?? []).slice(0, 4).map((f) => ({ titulo: f.titulo, texto: corta(limpia(f.texto), 95) }));

  if (fases.length < 3) return null;

  const dano = (r?.dano ?? []).slice(0, 2).map((t) => corta(limpia(t), 80));

  return { id: "fases", tipo: "fases", titulo: "Cómo juegan", fases, dano, locucion: `${fases.map((f) => `${f.titulo}: ${f.texto}`).join(". ")}${dano.length ? `. Dónde hacerles daño: ${dano.join("; ")}` : ""}.` };
}

/**
 * El balance del post (15/10/2026, lo pidió el cuerpo técnico: «lo que nos
 * deja» tenía que decir qué buscábamos y qué logramos, con datos). Lo usan los
 * dos motores: el navegador con las metas del pronóstico y el ordenador del
 * club con las claves del plan medidas en el timeline de Hudl.
 * Devuelve la escena y las dos líneas del cierre; `null` si hay menos de dos filas.
 */
export function escenaBalance(filas: FilaBalance[]): { escena: Escena; cierre: string[] } | null {
  const lista = filas.slice(0, 4);

  if (lista.length < 2) return null;

  /* En el cierre sólo el dato principal de cada fila (lo que va antes del primer «·»), sin cortar frases. */
  const dato = (t: string) => t.split(" · ")[0];
  const medidas = lista.filter((x) => x.estado !== "pendiente");
  const cumplidas = medidas.filter((x) => x.estado === "si").length;
  const medias = medidas.filter((x) => x.estado === "parcial").length;
  const fallo = lista.find((x) => x.estado === "no" && x.que !== "El resultado") ?? lista.find((x) => x.estado === "parcial" && x.que !== "El resultado");
  const acierto = lista.find((x) => x.estado === "si" && x.que !== "El resultado");

  const resumen = medidas.length
    ? `Cumplimos ${cumplidas} de ${medidas.length}${medias ? ` y ${medias} a medias` : ""}`
    : "Pendiente de los datos de Wyscout";

  const cierre = [
    `${resumen}${acierto ? ` · bien: ${acierto.que.toLowerCase()} (${dato(acierto.logramos)})` : ""}`,
    fallo ? `A mejorar: ${fallo.que.toLowerCase()} · ${dato(fallo.logramos)}` : "",
  ].filter(Boolean);

  return {
    escena: {
      id: "balance",
      tipo: "balance",
      titulo: "Lo que buscábamos y lo que logramos",
      filas: lista,
      resumen,
      locucion: `${lista.map((x) => `${x.que}: buscábamos ${x.buscabamos.charAt(0).toLowerCase()}${x.buscabamos.slice(1)}; ${x.logramos.charAt(0).toLowerCase()}${x.logramos.slice(1)}`).join(". ")}. ${resumen}.`,
    },
    cierre,
  };
}

const decimal = (n: number) => n.toFixed(2).replace(".", ",");
const apellidoDe = (nombre: string) => nombre.trim().split(/\s+/).slice(-1)[0] ?? nombre;

/** Las filas del balance con lo que sabe el informe del navegador: el resultado, las metas de xG del plan y los que había que frenar. */
function filasDeBalance(informe: InformePartido): FilaBalance[] {
  const p = informe.partido;
  const pr = informe.pronostico;
  const filas: FilaBalance[] = [];

  if (p.jugado && p.gf !== null && p.gc !== null) {
    const r = p.gf > p.gc ? "Victoria" : p.gf < p.gc ? "Derrota" : "Empate";

    filas.push({
      que: "El resultado",
      buscabamos: pr ? `Ganar · el pronóstico daba un ${Math.round(pr.victoria * 100)} %` : "Ganar",
      logramos: `${r} ${p.gf}-${p.gc}`,
      estado: r === "Victoria" ? "si" : r === "Empate" ? "parcial" : "no",
    });
  }

  const xg = informe.duelo?.partido?.metricas.find((m) => m.key === "xg");

  for (const palanca of pr?.palancas ?? []) {
    if (!palanca.revisa) continue;

    const suyo = palanca.revisa === "xgSuyo";
    const real = suyo ? (xg?.suyo ?? null) : (xg?.nuestro ?? null);

    filas.push({
      que: palanca.momento,
      buscabamos: palanca.objetivo,
      logramos: real === null ? "Pendiente de Wyscout (los martes)" : `${suyo ? "Su" : "Nuestro"} xG: ${decimal(real)}`,
      estado: real === null ? "pendiente" : (suyo ? real <= palanca.meta : real >= palanca.meta) ? "si" : "no",
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

  escenas.push({
    id: "portada",
    tipo: "portada",
    titulo: partido.rival,
    subtitulo: [partido.jornada ? `Jornada ${partido.jornada}` : "", partido.fechaTexto, lado].filter(Boolean).join(" · "),
    sello: previa ? "PREVIA" : `POST${marcador ? ` · ${marcador}` : ""}`,
    escudoNosotros: extras.escudoNosotros ?? "/logo.png",
    escudoRival: extras.escudoRival ?? null,
    locucion: previa ? `${partido.rival}, ${lado || "próximo partido"}. ${limpia(sintesis.titular)}` : `${partido.rival}${marcador ? `, ${marcador}` : ""}. ${limpia(sintesis.titular)}`,
  });

  if (previa) pon(escenaContexto(informe));

  if (pronostico) {
    const p = pronostico;

    escenas.push({
      id: "pronostico",
      tipo: "barras",
      titulo: previa ? "Lo que dice el dato" : "Lo que decía el dato",
      barras: [
        { rotulo: "Victoria", valor: p.victoria, texto: `${Math.round(p.victoria * 100)} %` },
        { rotulo: "Empate", valor: p.empate, texto: `${Math.round(p.empate * 100)} %` },
        { rotulo: "Derrota", valor: p.derrota, texto: `${Math.round(p.derrota * 100)} %` },
        ...(previa ? [{ rotulo: "Con el plan", valor: p.conPlan.victoria, texto: `${Math.round(p.conPlan.victoria * 100)} %` }] : []),
      ],
      locucion: previa
        ? `El modelo nos da un ${Math.round(p.victoria * 100)} por ciento de victoria; con el plan, un ${Math.round(p.conPlan.victoria * 100)}. ${limpia(p.idea)}`
        : limpia(sintesis.veredicto || p.lectura),
    });
  }

  /* El once del rival sobre el campo en 3D, con los que hay que vigilar en oro. */
  const once = informe.once.jugadores.filter((j) => typeof j.x === "number" && typeof j.y === "number");

  if (once.length >= 7) {
    escenas.push({
      id: "once",
      tipo: "once",
      titulo: previa ? `Su once ${informe.once.fuente === "marcado" ? "previsto" : "habitual"}` : "Su once",
      jugadores: once.map((j) => ({ nombre: j.nombre, dorsal: j.dorsal, posicion: j.posicion, foto: fotoVia(j.foto), x: j.x!, y: j.y!, destacado: vigilarClaves.has(j.clave) })),
      locucion: `${informe.once.detalle ? limpia(informe.once.detalle) : "Así se colocan."} ${sintesis.vigilar.length ? `En oro, ${sintesis.vigilar.map((j) => j.nombre).join(", ")}.` : ""}`.trim(),
    });
  }

  pon(previa ? escenaFases(informe) : escenaAcierto(informe));

  const claves = (previa ? sintesis.claves : sintesis.partido.length ? sintesis.partido : sintesis.claves).slice(0, 4).map((c) => corta(limpia(c)));

  if (claves.length) {
    escenas.push({ id: "claves", tipo: "claves", titulo: previa ? "Las claves" : "Lo que dijo el partido", lineas: claves, locucion: claves.join(". ") });
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
      titulo: i === 0 ? "Cómo juegan: acciones" : "Cómo juegan: más acciones",
      cortes: trozo,
      segundos: trozo.length * SEGUNDOS_POR_CORTE,
      locucion: `${trozo.length === 1 ? "Una acción suya" : `${trozo.length} acciones suyas`}${i === 0 ? " de lo preparado" : " más"}: ${trozo.map((c) => c.rotulo.split(" · ")[0].toLowerCase()).join(", ")}.`,
    });
  }

  if (previa) {
    pon(escenaPercentiles(informe));
    pon(escenaVersus(informe));
  }

  const ventajas = sintesis.ventajas.slice(0, 2).map((v) => corta(limpia(v), 70));
  const amenazas = sintesis.amenazas.slice(0, 2).map((v) => corta(limpia(v), 70));

  if (ventajas.length || amenazas.length) {
    escenas.push({
      id: "duelo",
      tipo: "cifras",
      titulo: "Dónde ganamos y dónde ganan ellos",
      cifras: [...ventajas.map((v) => ({ rotulo: "A favor", valor: v })), ...amenazas.map((v) => ({ rotulo: "Vigilar", valor: v }))],
      locucion: `A favor: ${ventajas.join("; ")}. A vigilar: ${amenazas.join("; ")}.`,
    });
  }

  const vigilar: JugadorEscena[] = previa
    ? sintesis.vigilar.slice(0, 3).map((j) => ({ nombre: j.nombre, dorsal: j.dorsal, posicion: j.posicion, foto: fotoVia(j.foto), x: 0, y: 0, destacado: true, texto: j.rasgos.slice(0, 3).join(" · ") || corta(limpia(j.fortalezas), 60) }))
    : sintesis.frenados.slice(0, 3).map((f) => ({ nombre: f.jugador.nombre, dorsal: f.jugador.dorsal, posicion: f.jugador.posicion, foto: fotoVia(f.jugador.foto), x: 0, y: 0, destacado: f.bien, texto: corta(limpia(f.texto), 60) }));

  if (vigilar.length) {
    escenas.push({
      id: "vigilar",
      tipo: "vigilar",
      titulo: previa ? "A vigilar" : "¿Los frenamos?",
      jugadores: vigilar,
      locucion: `${previa ? "Sus hombres a vigilar" : "Los que había que frenar"}: ${vigilar.map((j) => `${j.nombre}${j.texto ? `, ${j.texto.toLowerCase()}` : ""}`).join("; ")}.`,
    });
  }

  if (previa) pon(escenaDuelos(informe));

  const abp = informe.abp?.pincelada ?? null;

  if (abp && abp.cifras.length) {
    escenas.push({ id: "abp", tipo: "cifras", titulo: "Balón parado", cifras: abp.cifras.slice(0, 4), locucion: `Balón parado: ${limpia(abp.titular)}` });
  }

  /* Post (15/10/2026): antes de la conclusión, los datos más significativos del partido y el balance contra el plan. */
  if (!previa) pon(escenaVersus(informe));

  const balance = previa ? null : escenaBalance(filasDeBalance(informe));

  if (balance) escenas.push(balance.escena);

  const cierre = previa
    ? sintesis.claves.slice(0, 1).map((c) => corta(limpia(c), 80))
    : balance?.cierre ?? [...sintesis.partido.slice(0, 1), ...sintesis.relato.slice(0, 1)].map((c) => corta(limpia(c), 80));

  escenas.push({
    id: "cierre",
    tipo: "cierre",
    titulo: previa ? "El plan, en una frase" : "Lo que nos deja",
    lineas: cierre.length ? cierre : [limpia(sintesis.titular)],
    locucion: previa ? `En una frase: ${cierre[0] ?? limpia(sintesis.titular)}` : `Lo que nos deja: ${cierre[0] ?? limpia(sintesis.titular)}`,
  });

  /*
  | El orden de la historia (15/10/2026), como se cuenta en la charla:
  | previa → el rival (cómo llega, el pronóstico, su once, cómo juega y sus
  | acciones), dónde nos separamos y a quién vigilar, cómo llegamos nosotros
  | y, al final, el plan; post → los goles y las llegadas, su once y a quién
  | frenamos, los datos, el balance contra el plan y lo que nos deja.
  */
  const ORDEN = previa
    ? ["gancho", "portada", "contexto", "pronostico", "once", "fases", "clips", "clips-rival-2", "percentiles", "versus", "duelo", "duelos", "vigilar", "abp", "clips-1", "clips-2", "clips-3", "claves", "cierre"]
    : ["gancho", "portada", "pronostico", "clips-1", "clips-2", "clips-3", "once", "acierto", "vigilar", "abp", "claves", "versus", "balance", "cierre"];
  const lugar = (id: string) => (ORDEN.includes(id) ? ORDEN.indexOf(id) : ORDEN.length - 1.5);

  escenas.sort((a, b) => lugar(a.id) - lugar(b.id));

  return { titulo: `${partido.rival} · ${previa ? "previa" : "post"}`, escenas };
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

  if (primera && primera.valor.length <= 8) {
    escenas.push({ id: "gancho", tipo: "gancho", dato: primera.valor, rotulo: primera.rotulo.toUpperCase(), contexto: primera.pie ? limpia(primera.pie) : corta(limpia(pincelada.titular), 80), locucion: `${primera.rotulo}: ${primera.valor}.` });
  }

  escenas.push({
    id: "portada",
    tipo: "portada",
    titulo: informe.titulo,
    subtitulo: [informe.subtitulo, informe.rango].filter(Boolean).join(" · "),
    sello: `BALÓN PARADO · ${informe.modoRotulo.toUpperCase()}`,
    escudoNosotros: "/logo.png",
    escudoRival: extras.escudoRival ?? null,
    locucion: `Balón parado, ${informe.modoRotulo}. ${limpia(pincelada.titular)}`,
  });

  const resumen = informe.resumen.slice(0, 4);

  if (resumen.length) {
    escenas.push({ id: "cifras", tipo: "cifras", titulo: "La semana en cifras", cifras: resumen, locucion: resumen.map((c) => `${c.rotulo}: ${c.valor}`).join(". ") });
  }

  const claves = pincelada.claves.slice(0, 4).map((c) => corta(limpia(c)));

  if (claves.length) {
    escenas.push({ id: "claves", tipo: "claves", titulo: "Lo que hay que mirar", lineas: claves, locucion: claves.join(". ") });
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
      titulo: "Análisis previo",
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

  const rival = pincelada.rival.slice(0, 3).map((c) => corta(limpia(c)));

  if (rival.length) {
    escenas.push({ id: "rival", tipo: "claves", titulo: "El rival a balón parado", lineas: rival, locucion: rival.join(". ") });
  }

  escenas.push({
    id: "cierre",
    tipo: "cierre",
    titulo: informe.modo === "post" ? "Lo que nos deja" : "Para esta semana",
    lineas: [corta(limpia(pincelada.titular), 90)],
    locucion: limpia(pincelada.titular),
  });

  return { titulo: `ABP · ${informe.titulo}`, escenas };
}

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
