/*
|--------------------------------------------------------------------------
| EL GUION DEL VÍDEO RESUMEN
|--------------------------------------------------------------------------
|
| El vídeo cuenta lo mismo que el PDF del informe, en menos de un minuto, y
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

import type { InformePartido, PinceladaAbp } from "@/lib/informe-partido/modelo";
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

/** Las escenas de cortes del partido, agrupadas por lo que cuentan; cada una de hasta 3 cortes. */
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
    const elegidos = cortes.filter((c) => g.tipos.includes(c.tipo) && !usados.has(c)).slice(0, 3);

    if (!elegidos.length) continue;

    elegidos.forEach((c) => usados.add(c));
    escenas.push({
      id: g.id,
      tipo: "clips",
      titulo: g.titulo,
      cortes: elegidos.map((c) => ({ ...c, minutoNum: c.minutoNum ?? minutoNumero(c.minuto) })),
      segundos: elegidos.length * segundosPorCorte,
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
 * córners y faltas, los suyos y los saques de banda; hasta 3 cortes cada una.
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
      .slice(0, 3)
      .sort((a, b) => (a.minutoNum ?? minutoNumero(a.minuto)) - (b.minutoNum ?? minutoNumero(b.minuto)));

    if (!elegidos.length) continue;

    elegidos.forEach((c) => usados.add(c));
    escenas.push({ id: g.id, tipo: "clips", titulo: g.titulo, cortes: elegidos.map((c) => ({ ...c, minutoNum: c.minutoNum ?? minutoNumero(c.minuto) })), segundos: elegidos.length * segundosPorCorte, locucion: g.locucion(elegidos.length), marcas });
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
  | { id: string; tipo: "cierre"; titulo: string; lineas: string[]; locucion: string };

export type GuionVideo = {
  /** Para el nombre del archivo y el rótulo de la esquina. */
  titulo: string;
  escenas: Escena[];
};

/** Tope duro: minuto y medio (12/10/2026; antes 58 s), que es lo que caben los cortes del partido. */
export const SEGUNDOS_MAXIMOS = 90;

/** Cuántos cortes de acciones entran, y cuánto dura cada uno. */
const CORTES = 3;
const SEGUNDOS_POR_CORTE = 3.4;

const corta = (t: string, n = 90) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

const limpia = (t: string) => t.replace(/\s+/g, " ").trim();

/** Un vídeo del bucket se puede leer en el navegador; un enlace de YouTube, no. */
export const esClipLegible = (url: string) => /^https?:\/\/.+\.(mp4|m4v|mov|webm)(\?|$)/i.test(url) || /supabase\.co\/storage/i.test(url);

/** Las fotos de fuera pasan por el proxy, como en las diapositivas. */
const fotoVia = (src: string) => (src ? (src.startsWith("/") || src.startsWith("data:") ? src : `/api/rivals/foto?url=${encodeURIComponent(src)}`) : "");

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

  const claves = (previa ? sintesis.claves : sintesis.partido.length ? sintesis.partido : sintesis.claves).slice(0, 4).map((c) => corta(limpia(c)));

  if (claves.length) {
    escenas.push({ id: "claves", tipo: "claves", titulo: previa ? "Las claves" : "Lo que dijo el partido", lineas: claves, locucion: claves.join(". ") });
  }

  /* Los cortes del partido cortados por el ordenador del club desde Hudl (goles, llegadas, lo que concedimos), con su lectura. En la previa son del último partido jugado. */
  escenas.push(...escenasDeCortes(informe.recursos.cortes ?? [], partido.rival, SEGUNDOS_POR_CORTE_PARTIDO, { momento, rotuloPartido: previa && partido.jornada ? `J${partido.jornada - 1}` : undefined }));

  /* Los cortes de acciones concretas del rival (Análisis visual, por jornada) y, si no, sus vídeos de Recursos. */
  const cortes: Corte[] = informe.recursos.videos.filter((v) => esClipLegible(v.url)).map((v) => ({ url: v.url, rotulo: v.rotulo ?? v.nombre }));

  if (cortes.length) {
    const elegidos = cortes.slice(0, CORTES);

    escenas.push({
      id: "clips",
      tipo: "clips",
      titulo: "Cómo juegan: acciones",
      cortes: elegidos,
      segundos: elegidos.length * SEGUNDOS_POR_CORTE,
      locucion: `${elegidos.length === 1 ? "Una acción suya" : `${elegidos.length} acciones suyas`} de lo preparado: ${elegidos.map((c) => c.rotulo.split(" · ")[0].toLowerCase()).join(", ")}.`,
    });
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

  const abp = informe.abp?.pincelada ?? null;

  if (abp && abp.cifras.length) {
    escenas.push({ id: "abp", tipo: "cifras", titulo: "Balón parado", cifras: abp.cifras.slice(0, 4), locucion: `Balón parado: ${limpia(abp.titular)}` });
  }

  const cierre = previa ? sintesis.claves.slice(0, 1).map((c) => corta(limpia(c), 80)) : sintesis.relato.slice(0, 2).map((c) => corta(limpia(c), 80));

  escenas.push({
    id: "cierre",
    tipo: "cierre",
    titulo: previa ? "El plan, en una frase" : "Lo que nos deja",
    lineas: cierre.length ? cierre : [limpia(sintesis.titular)],
    locucion: previa ? `En una frase: ${cierre[0] ?? limpia(sintesis.titular)}` : `Lo que nos deja: ${cierre[0] ?? limpia(sintesis.titular)}`,
  });

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
  const laminas = informe.graficos.filter((g) => esImagen(g) && /^rival-\d+$/.test(g.cid)).slice(0, 2);

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

  /* Los cortes del rival (Análisis visual): hasta dos escenas de tres, con la lectura de cada uno. */
  const delRival = (extras.cortes ?? []).filter((c) => esClipLegible(c.url));

  for (const [i, trozo] of [delRival.slice(0, 3), delRival.slice(3, 6)].entries()) {
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

  const graficos = informe.graficos.filter((g) => esImagen(g) && !g.cid.startsWith("rival-")).slice(0, 2);

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
