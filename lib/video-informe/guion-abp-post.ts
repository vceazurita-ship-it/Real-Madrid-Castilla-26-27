/*
|--------------------------------------------------------------------------
| EL VÍDEO POST DEL INFORME DE ABP (02/11/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «igual que creamos un vídeo post del informe del
| microciclo, habría que crearlo del ABP en el informe post». Con el MISMO
| motor que el del partido (`monta.ts`, `dibujo.ts`) y la misma historia en
| tres capítulos:
|
|   1. LO QUE PREPARAMOS: lo trabajado en la semana, aspecto por aspecto y con
|      sus minutos, y las jugadas de la pizarra de ABP animadas (las mismas
|      diapositivas de /abp-pizarra, rodadas con `VideoJugada`).
|   2. EL PARTIDO: a favor contra en contra (acciones, remates, peligro,
|      goles y goles esperados de NUESTRAS hojas), el desglose por tipo y los
|      cortes de balón parado del partido (los de Hudl que deja el ordenador
|      del club en `informe-clips:jNN`).
|   3. EL BALANCE: lo que buscábamos frente a lo que logramos, sólo con lo
|      que tiene veredicto, y la consigna para la semana que viene.
|
| Todas las cifras salen del informe ya armado (`partidoAbp`, `cierre`): el
| vídeo no calcula nada que el PDF no diga. Lo que no tiene dato no sale.
|
| Las jugadas de la pizarra van como MARCAS («pizarra:<huella>») y se
| cambian por el vídeo rodado justo antes de montar (`conJugadasResueltas`,
| el `prepara` de `trabajoVideo.pide`): así la huella del vídeo no depende de
| una URL de memoria y el informe del partido, que pide el mismo guion, se
| encuentra el vídeo ya hecho.
*/

import type { InformeMicro, LineaCruce, PartidoAbpInforme, PinceladaAbp } from "@/lib/abp/informe-micro";

import {
  capitulosEnOrden,
  consigna,
  corta,
  cortaPalabras,
  escenaBalance,
  escenaCompleta,
  escenaPlan,
  escenasDeCortesAbp,
  escudoDelRival,
  intercalaCortes,
  sinSiglas,
  tituloDeVersus,
  type Corte,
  type CortePartido,
  type Escena,
  type FilaBalance,
  type FilaVersus,
  type GuionVideo,
} from "./guion";

/** Una jugada de la pizarra que entra en el vídeo: su huella (la del vídeo ya rodado), su título y lo que dura. */
export type JugadaDelVideo = { clave: string; titulo: string; segundos: number };

/** Lo que el informe no trae y el vídeo necesita. */
export type ExtrasAbpPost = {
  escudoRival?: string | null;
  /** El rival, tal y como lo escribe el calendario. */
  rival?: string;
  /** Los cortes del partido (Hudl → `informe-clips:jNN`): sólo entran los de balón parado. */
  cortesPartido?: CortePartido[];
  /** Las jugadas de la pizarra de ese partido que se ruedan (`rodaJugadas`). */
  jugadas?: JugadaDelVideo[];
};

/** Lo más que dura el guion sin vídeo de jugadores detrás. */
export const SEGUNDOS_POST_ABP = 150;

/**
 * Con el vídeo de jugadores como cola, el guion se acorta para que el total no
 * pase de cuatro minutos: en 44 MB, cuatro minutos son ~1,5 Mb/s en 1080p,
 * lo justo para que su vídeo se siga viendo bien. Nunca menos de 45 s.
 */
export function topePostAbp(segundosCola: number | null) {
  if (!segundosCola) return SEGUNDOS_POST_ABP;

  return Math.max(45, Math.min(100, 240 - segundosCola));
}

const MARCA = "pizarra:";

/** La marca de una jugada, hasta que se rueda. */
export const marcaDeJugada = (clave: string) => `${MARCA}${clave}`;

/** Las huellas de las jugadas que el guion lleva marcadas (y aún no rodadas). */
export function jugadasPendientes(guion: GuionVideo): string[] {
  return [...new Set(guion.escenas.flatMap((e) => (e.tipo === "clips" ? e.cortes.filter((c) => c.url.startsWith(MARCA)).map((c) => c.url.slice(MARCA.length)) : [])))];
}

/**
 * El guion con cada marca cambiada por su vídeo. Una jugada que no se ha
 * podido rodar sale del vídeo, y la escena que se queda sin ninguna, también:
 * el guion nunca anuncia una jugada que no está.
 */
export function conJugadasResueltas(guion: GuionVideo, urls: Map<string, string>): GuionVideo {
  const escenas = guion.escenas.flatMap((e): Escena[] => {
    if (e.tipo !== "clips" || !e.cortes.some((c) => c.url.startsWith(MARCA))) return [e];

    const cortes = e.cortes.flatMap((c) => {
      if (!c.url.startsWith(MARCA)) return [c];

      const url = urls.get(c.url.slice(MARCA.length));

      return url ? [{ ...c, url }] : [];
    });

    if (!cortes.length) return [];

    return [{ ...e, cortes, segundos: cortes.reduce((s, c) => s + ((c as Corte & { segundos?: number }).segundos || 0), 0) || e.segundos }];
  });

  return { ...guion, escenas };
}

const limpia = (t: string) => t.replace(/\s+/g, " ").trim();

/**
 * «1 h 20 min», «45 min»: como `fmtLargo` del informe (lib/abp/informe-micro),
 * copiado para no cargar el informe entero en el diálogo del partido.
 */
function fmtLargo(minutos: number) {
  const total = Math.round(minutos);
  const h = Math.floor(total / 60);
  const m = total % 60;

  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const coma = (n: number) => n.toFixed(2).replace(".", ",");
const ladoEnTexto = (lado: string) => (lado === "ofensivo" ? "a favor" : "en contra");

/** El dato del gancho: lo más fuerte del partido a balón parado, nunca un cero. */
function escenaGancho(p: PartidoAbpInforme, rival: string): Escena | null {
  const total = p.favor.acciones + p.contra.acciones;
  const contexto = total ? `En ${plural(total, "acción", "acciones")} a balón parado${rival ? ` contra el ${rival}` : ""}` : "";
  const opciones: { dato: number; rotulo: string; locucion: string }[] = [
    { dato: p.favor.goles, rotulo: p.favor.goles === 1 ? "Gol nuestro a balón parado" : "Goles nuestros a balón parado", locucion: `${plural(p.favor.goles, "gol", "goles")} a balón parado a favor.` },
    { dato: p.contra.goles, rotulo: p.contra.goles === 1 ? "Gol en contra a balón parado" : "Goles en contra a balón parado", locucion: `${plural(p.contra.goles, "gol", "goles")} a balón parado en contra.` },
    { dato: p.favor.remates, rotulo: p.favor.remates === 1 ? "Remate nuestro a balón parado" : "Remates nuestros a balón parado", locucion: `${plural(p.favor.remates, "remate", "remates")} nuestros a balón parado.` },
    { dato: p.favor.peligros, rotulo: "Acciones nuestras con peligro", locucion: `${plural(p.favor.peligros, "acción", "acciones")} nuestras con peligro.` },
  ];
  const elegida = opciones.find((o) => o.dato > 0);

  if (!elegida) return null;

  return { id: "gancho", tipo: "gancho", dato: String(elegida.dato), rotulo: elegida.rotulo.toUpperCase(), contexto, locucion: elegida.locucion, ...(rival ? { antetitulo: rival.toUpperCase() } : {}) };
}

/** A favor contra en contra, como la comparativa del partido: CASTILLA a la izquierda, RIVAL a la derecha. */
function escenaVersus(p: PartidoAbpInforme): Escena | null {
  const crudas: { nombre: string; nuestro: number; suyo: number; texto: (n: number) => string }[] = [
    { nombre: "Acciones a balón parado", nuestro: p.favor.acciones, suyo: p.contra.acciones, texto: String },
    { nombre: "Remates", nuestro: p.favor.remates, suyo: p.contra.remates, texto: String },
    { nombre: "Acciones con peligro", nuestro: p.favor.peligros, suyo: p.contra.peligros, texto: String },
    { nombre: "Goles", nuestro: p.favor.goles, suyo: p.contra.goles, texto: String },
    { nombre: "Goles esperados", nuestro: p.favor.xg, suyo: p.contra.xg, texto: coma },
  ];

  /* Las que separan primero (como «El partido en datos»); una fila a cero por los dos lados no cuenta nada. */
  const filas: FilaVersus[] = crudas
    .filter((f) => f.nuestro > 0 || f.suyo > 0)
    .map((f) => ({ f, separa: Math.abs(f.nuestro - f.suyo) / Math.max(f.nuestro, f.suyo, 0.0001) }))
    .sort((a, b) => b.separa - a.separa)
    .map(({ f }) => ({ nombre: f.nombre, nuestro: f.nuestro, suyo: f.suyo, textoNuestro: f.texto(f.nuestro), textoSuyo: f.texto(f.suyo), media: null, mejorAlto: true }));

  if (filas.length < 3) return null;

  return {
    id: "versus",
    tipo: "versus",
    titulo: tituloDeVersus(filas[0], true),
    pie: "A favor y en contra, de nuestras hojas de balón parado",
    filas,
    locucion: filas.slice(0, 3).map((f) => `${f.nombre}: ${f.textoNuestro} nuestros, ${f.textoSuyo} suyos`).join(". "),
  };
}

/** El desglose por tipo de acción: hasta tres (con cuatro, «Falta lateral a favor» se montaba sobre la siguiente), lo que más pesó primero. */
function escenaTipos(p: PartidoAbpInforme): Escena | null {
  const filas = [...p.filas].filter((f) => f.acciones > 0).sort((a, b) => b.goles - a.goles || b.peligros - a.peligros || b.acciones - a.acciones).slice(0, 3);

  if (filas.length < 2) return null;

  const cifras = filas.map((f) => ({
    rotulo: `${f.etiqueta} ${ladoEnTexto(f.lado)}`,
    valor: String(f.acciones),
    pie: [f.goles ? plural(f.goles, "gol", "goles") : "", f.remates ? plural(f.remates, "remate", "remates") : "", `${f.peligros} con peligro`].filter(Boolean).join(" · "),
  }));
  const top = filas[0];

  return {
    id: "tipos",
    tipo: "cifras",
    titulo: top.goles ? `${top.etiqueta} ${ladoEnTexto(top.lado)}: ${plural(top.goles, "gol", "goles")}` : `Lo que más pesó: ${top.etiqueta.toLowerCase()} ${ladoEnTexto(top.lado)}`,
    cifras,
    locucion: cifras.map((c) => `${c.rotulo}: ${c.valor}, ${c.pie}`).join(". "),
  };
}

/** Lo trabajado en la semana que el partido puede juzgar: hojas que lo registran y acciones en el partido. */
const trabajadas = (p: PartidoAbpInforme) => p.cruce.filter((c) => c.trabajado && c.medible && c.minutos > 0);

/** «Córner directo a favor». */
const queEs = (c: LineaCruce) => `${c.aspecto} ${ladoEnTexto(c.lado)}`;

/** Lo que pasó en el partido en ese aspecto, con su cifra. */
function loQuePaso(c: LineaCruce) {
  if (c.goles > 0) return `${plural(c.goles, "gol", "goles")} ${ladoEnTexto(c.lado)}`;

  return `${c.peligros} de ${c.acciones} con peligro`;
}

/**
 * Las filas del balance: lo trabajado con veredicto (el mismo `tono` del
 * informe, que ya aplica la regla de muestra). «Pocas para concluir» no entra:
 * sin veredicto no hay «cumplido» ni «no».
 */
function filasDeBalanceAbp(p: PartidoAbpInforme): FilaBalance[] {
  return trabajadas(p)
    .filter((c) => c.acciones > 0 && (c.tono !== "neutro" || /dentro de lo normal/i.test(c.lectura)))
    .map((c) => ({
      que: queEs(c),
      buscabamos: `${fmtLargo(c.minutos)} de trabajo para ${c.lado === "ofensivo" ? "generar peligro" : "no conceder"}`,
      logramos: loQuePaso(c),
      estado: c.tono === "bien" ? "si" : c.tono === "mal" ? "no" : "parcial",
      habitual: c.tono === "neutro",
    }));
}

export function guionPostDeAbp(informe: InformeMicro, pincelada: PinceladaAbp, extras: ExtrasAbpPost = {}): GuionVideo {
  const p = informe.partidoAbp;
  const rival = (extras.rival ?? "").trim();
  const escenas: Escena[] = [];
  const pon = (e: Escena | null) => {
    if (e) escenas.push(e);
  };

  if (p) pon(escenaGancho(p, rival));

  const marcador = p?.marcador ? `${p.marcador.favor}-${p.marcador.contra}` : "";
  /* La idea entera o ninguna (02/11/2026): recortada a nueve palabras decía «y el daño llegó» sin decir dónde. */
  const titularLimpio = sinSiglas(limpia(pincelada.titular)).replace(/[.;,:\s]+$/, "");
  const idea = titularLimpio.split(/\s+/).length <= 11 ? titularLimpio : "";

  escenas.push({
    id: "portada",
    tipo: "portada",
    titulo: rival || informe.titulo,
    subtitulo: [p?.jornada ?? "", rival ? "" : informe.subtitulo].filter(Boolean).join(" · "),
    sello: `BALÓN PARADO · POST${marcador ? ` · ${marcador}` : ""}`,
    escudoNosotros: "/logo.png",
    escudoRival: escudoDelRival(extras),
    ...(idea ? { idea } : {}),
    locucion: `Balón parado, post${rival ? ` contra el ${rival}` : ""}. ${limpia(pincelada.titular)}`,
  });

  /* 1. Lo que preparamos: los aspectos trabajados con sus minutos, y las jugadas de la pizarra. */
  if (p) {
    const hechas = trabajadas(p).slice(0, 4);
    const plan = escenaPlan(hechas.map(queEs));

    if (plan?.tipo === "claves" && plan.lineas.length === hechas.length) {
      escenas.push({ ...plan, titulo: "Lo que preparamos", pies: hechas.map((c) => `${fmtLargo(c.minutos)} de trabajo en la semana`), locucion: `Lo que preparamos: ${hechas.map((c) => `${queEs(c)}, ${fmtLargo(c.minutos)}`).join("; ")}.` });
    }
  }

  const jugadas = (extras.jugadas ?? []).filter((j) => j.clave && j.segundos > 0);

  if (jugadas.length) {
    escenas.push({
      id: "pizarra",
      tipo: "clips",
      titulo: jugadas.length === 1 ? `Lo que preparamos: ${jugadas[0].titulo}` : "Lo que preparamos en la pizarra",
      cortes: jugadas.map((j) => ({ url: marcaDeJugada(j.clave), rotulo: j.titulo, pizarra: true, segundos: j.segundos }) as Corte),
      segundos: jugadas.reduce((s, j) => s + j.segundos, 0),
      locucion: `Lo que preparamos en la pizarra: ${jugadas.map((j) => j.titulo).join("; ")}.`,
    });
  }

  /* 2. El partido: la comparativa, el desglose y los cortes. */
  if (p) {
    pon(escenaVersus(p));
    pon(escenaTipos(p));
  }

  const cortesAbp = (extras.cortesPartido ?? []).filter((c) => c && typeof c.url === "string" && /^(corner|abp|banda)/.test(c.tipo));

  if (cortesAbp.length) {
    escenas.push(...escenasDeCortesAbp(cortesAbp, rival || "el rival", { momento: "post" }));
  } else if (p) {
    /* Sin cortes de Hudl, las acciones de peligro que el informe ya casó con su corte por el minuto. */
    const conCorte = p.peligrosas.filter((x) => x.clip).slice(0, 5);

    if (conCorte.length) {
      escenas.push({
        id: "peligro",
        tipo: "clips",
        titulo: "Las acciones de peligro",
        cortes: conCorte.map((x) => ({ url: x.clip!, rotulo: [`${x.aspecto} ${ladoEnTexto(x.lado)}`, x.corto.match(/^(\d+(?:\+\d+)?')/)?.[1] ?? ""].filter(Boolean).join(" · ") })),
        segundos: conCorte.length * 7,
        locucion: `${plural(conCorte.length, "acción", "acciones")} con peligro, en orden de minuto.`,
      });
    }
  }

  /* 3. El balance: buscábamos → logramos, con veredicto; si no da, lo trabajado frente a lo que salió, sin juzgar. */
  /* Con todo «dentro de lo normal», un «Cumplimos 0 de 2» engañaría: entonces va lo preparado frente a lo que salió, sin juzgar. */
  const filasBalance = p ? filasDeBalanceAbp(p) : [];
  const balance = filasBalance.some((f) => f.estado !== "parcial") ? escenaBalance(filasBalance) : null;

  if (balance?.escena.tipo === "balance") {
    const r = balance.escena.resumen;

    escenas.push({ ...balance.escena, titulo: `Lo preparado: ${r.charAt(0).toLowerCase()}${r.slice(1)}` });
  } else if (p) {
    const conAcciones = trabajadas(p).filter((c) => c.acciones > 0).slice(0, 3);

    if (conAcciones.length) {
      escenas.push({
        id: "cruce",
        tipo: "claves",
        titulo: "Lo preparado, en el partido",
        lineas: conAcciones.map(queEs),
        pies: conAcciones.map(loQuePaso),
        locucion: conAcciones.map((c) => `${queEs(c)}: ${loQuePaso(c)}`).join(". "),
      });
    }
  }

  /* La consigna de la semana que viene, la MISMA que el cierre del informe, con su porqué debajo. */
  const c = informe.cierre;
  const primeraClave = pincelada.claves[0] ? consigna(pincelada.claves[0], 10) : "";
  const lineaCierre = c?.consigna ? limpia(c.consigna) : primeraClave || corta(limpia(pincelada.titular), 90);
  const pie = c?.porQue ? cortaPalabras(sinSiglas(limpia(c.porQue)), 12).replace(/[.;,:\s]+$/, "") : "";

  if (lineaCierre) {
    escenas.push({
      id: "cierre",
      tipo: "cierre",
      titulo: c?.titulo ? limpia(c.titulo) : "Lo que nos deja",
      lineas: [lineaCierre],
      ...(pie ? { pie } : {}),
      locucion: `${c?.titulo ? limpia(c.titulo) : "Lo que nos deja"}: ${lineaCierre}`,
    });
  }

  const ORDEN = ["gancho", "portada", "plan", "pizarra", "versus", "tipos", "abp-nuestros", "abp-suyos", "abp-banda", "peligro", "balance", "cruce", "cierre"];
  const lugar = (id: string) => (ORDEN.includes(id) ? ORDEN.indexOf(id) : ORDEN.length - 1.5);

  escenas.sort((a, b) => lugar(a.id) - lugar(b.id));

  /* Las marcas de la pizarra aún no tienen vídeo: cuentan como completas (se resuelven antes de montar). */
  const finales = intercalaCortes(escenas.filter((e) => escenaCompleta(e)));

  return {
    titulo: `ABP · ${rival || informe.titulo} · post`,
    escenas: finales,
    capitulos: capitulosEnOrden(finales, {
      plan: "Lo que preparamos",
      pizarra: "Lo que preparamos",
      versus: "El partido",
      tipos: "El partido",
      "abp-nuestros": "El partido",
      "abp-suyos": "El partido",
      "abp-banda": "El partido",
      peligro: "El partido",
      balance: "El balance",
      cruce: "El balance",
      cierre: "El balance",
    }),
  };
}
