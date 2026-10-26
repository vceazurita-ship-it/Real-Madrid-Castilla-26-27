/**
 * La pizarra de balón parado de UN jugador, en PDF para el móvil (26/10/2026).
 *
 * Sale de `/abp-pizarra`: un PDF por cada jugador del tablero para mandárselo
 * por WhatsApp antes del partido —en el autobús, en el vestuario—. Por eso va
 * en VERTICAL (9:16, lo que ocupa la pantalla de un teléfono) y no en la
 * diapositiva apaisada de la sala.
 *
 * - Portada: los dos escudos, «BALÓN PARADO», su foto, su nombre y la lista de
 *   sus acciones con su puesto en cada una (el resumen de un vistazo).
 * - Una hoja por acción en la que aparece: la diapositiva con SU cara
 *   resaltada (`TableroSlide destacado`), TU COMETIDO (sigla, puesto y una
 *   frase-misión: qué hace, con quién y para qué) y PROPÓSITO COLECTIVO (la
 *   señal y como mucho dos consignas, las que le tocan). Criterio de los
 *   agentes experto-futbol y experto-marketing: se lee en 5 segundos.
 *
 * Lenguaje de `INDIVIDUAL.pptx` (papel blanco, Barlow Condensed, chapas de
 * `lib/rivals/lienzo-club.ts`), el mismo que la portada del rival. Lo que no
 * tiene contenido no se nombra: ni compañeros, ni movimiento, ni consignas
 * vacías.
 */

import type { Player } from "@/types/player";
import {
  LADO_PIZARRA_LABEL,
  PLANTILLA_BY_KEY,
  gruposDe,
  lineasConsignas,
  normalizaConsigna,
  puestoDe,
  siglaDe,
  tituloVisible,
  type LadoPizarra,
  type LineaConsigna,
  type TableroPizarra,
} from "@/lib/abp/pizarra";
import type { TipoTrazo } from "@/lib/abp/trazos";
import {
  C,
  ajusta,
  cargaImagen,
  chapa,
  cubre,
  encaja,
  fuente,
  rectRedondo,
  textoEspaciado,
  type Ctx,
} from "@/lib/rivals/lienzo-club";

/** La hoja: 1080×1920, el teléfono en vertical. En el PDF, 540×960 pt. */
export const HOJA_W = 1080;
export const HOJA_H = 1920;

const MARGEN = 64;

/* ------------------------------------------------------------------ */
/*  LOS DATOS                                                          */
/* ------------------------------------------------------------------ */

export type CometidoAccion = {
  /** Índice de la diapositiva en el tablero (para fotografiarla). */
  indice: number;
  titulo: string;
  lado: LadoPizarra;
  /** Sus puestos en la acción: casi siempre uno; en directas, varios. */
  puestos: { sigla: string; label: string; grupo: string }[];
  /**
   * Su misión en una línea: qué hace (de sus flechas), con quién y para qué
   * (la intención). Vacía si no hay nada de eso: el puesto ya lo dice.
   */
  mision: string;
  /** La señal de la jugada, sólo en las ofensivas. */
  senal: string;
  /** Las consignas que le tocan a él (máximo 2), sin el «X:» de su grupo. */
  consignas: string[];
};

/** Lo que hace, por el tipo de su flecha. */
const VERBO: Record<LadoPizarra, Record<TipoTrazo, string>> = {
  ofensivo: { carrera: "Atacas", bloqueo: "Bloqueas", balon: "Sacas" },
  defensivo: { carrera: "Sales", bloqueo: "Bloqueas", balon: "Despejas" },
};

/** Un trazo es suyo si arranca a sus pies (igual que lo ata la pizarra). */
const PIES = 40;

/** Consignas que caben en la hoja sin encoger la letra. */
const MAX_CONSIGNAS = 2;

export const nombreCorto = (player: Player | undefined) =>
  (player?.apodo || player?.nombre || "").trim();

const plano = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const conPalabra = (texto: string, palabra: string) =>
  palabra.length > 1 &&
  new RegExp(`(^|[^a-z0-9])${palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(texto);

/** «a, b y c». */
const lista = (nombres: string[]) =>
  nombres.length < 2 ? nombres.join("") : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;

/**
 * Las consignas que le tocan (criterio del cuerpo técnico, 26/10/2026): las que
 * cuelgan de un rótulo «X:» —subtítulo o prefijo— que nombra su grupo o su
 * puesto, y las que nombran su puesto, su nombre o su sigla (de dos letras o
 * más: una «C» suelta da falsos positivos). Si no le toca ninguna, la primera
 * consigna colectiva, la que no es de ningún grupo.
 */
function consignasSuyas(
  lineas: LineaConsigna[],
  claves: string[],
  siglas: string[],
): string[] {
  let rotulo = "";

  const todas = lineas.flatMap((linea) => {
    if (linea.tipo === "subtitulo") {
      rotulo = plano(linea.texto);

      return [];
    }

    if (linea.tipo !== "consigna") return [];

    const prefijo = /^([^:]{2,30}):\s*(.+)$/.exec(linea.texto);
    const deQuien = prefijo ? plano(prefijo[1]) : rotulo;
    const cuerpo = (prefijo ? prefijo[2] : linea.texto).replace(/^\d+[.)]\s*/, "");
    const texto = plano(linea.texto);

    const suya =
      claves.some((clave) => (deQuien && conPalabra(deQuien, clave)) || conPalabra(texto, clave)) ||
      siglas.some((sigla) => new RegExp(`(^|[^A-ZÑ])${sigla}([^A-ZÑ]|$)`).test(linea.texto));

    return [{ suya, colectiva: !deQuien, cuerpo: cuerpo.charAt(0).toLocaleUpperCase("es-ES") + cuerpo.slice(1) }];
  });

  const suyas = todas.filter((c) => c.suya);
  const elegidas = suyas.length ? suyas : todas.filter((c) => c.colectiva).slice(0, 1);

  return elegidas.slice(0, MAX_CONSIGNAS).map((c) => c.cuerpo);
}

/** Las acciones en las que sale un jugador, en el orden de la charla. */
export function cometidosDe(
  tablero: TableroPizarra,
  playerId: string,
  players: Map<string, Player>,
): CometidoAccion[] {
  return tablero.slides.flatMap((slide, indice) => {
    const suyas = slide.fichas.filter((ficha) => ficha.playerId === playerId);

    if (suyas.length === 0) return [];

    const lado = PLANTILLA_BY_KEY.get(slide.plantilla)?.lado ?? "ofensivo";
    const grupos = gruposDe(slide);
    const etiquetaGrupo = (key: string) => grupos.find((grupo) => grupo.key === key)?.label ?? "";

    const puestos = suyas.flatMap((ficha) => {
      const puesto = puestoDe(slide, ficha.puesto);

      return puesto
        ? [{ sigla: siglaDe(puesto), label: puesto.label, grupo: etiquetaGrupo(puesto.grupo) }]
        : [];
    });

    /* Quien comparte grupo con él: con quién hace su trabajo. */
    const susGrupos = new Set(
      suyas.map((ficha) => puestoDe(slide, ficha.puesto)?.grupo).filter(Boolean),
    );

    const companeros = [
      ...new Set(
        slide.fichas
          .filter((ficha) => ficha.playerId !== playerId)
          .filter((ficha) => susGrupos.has(puestoDe(slide, ficha.puesto)?.grupo))
          .map((ficha) => nombreCorto(players.get(ficha.playerId)))
          .filter(Boolean),
      ),
    ].slice(0, 2);

    const verbos = [
      ...new Set(
        (slide.trazos ?? [])
          .filter((trazo) =>
            suyas.some((ficha) => Math.hypot(trazo.x1 - ficha.x, trazo.y1 - ficha.y) <= PIES),
          )
          .sort((a, b) => a.fase - b.fase)
          .map((trazo) => VERBO[lado][trazo.tipo]),
      ),
    ];

    const intencion = slide.guion?.intencion?.trim() ? normalizaConsigna(slide.guion.intencion.trim()) : "";
    const senal = lado === "ofensivo" && slide.guion?.senal?.trim() ? normalizaConsigna(slide.guion.senal.trim()) : "";

    const mision = [
      verbos.length ? lista(verbos.map((v, i) => (i ? v.toLowerCase() : v))) : "",
      companeros.length ? `con ${lista(companeros)}` : "",
      intencion ? `para ${intencion.charAt(0).toLowerCase()}${intencion.slice(1).replace(/\.$/, "")}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const claves = [
      ...new Set(
        [...puestos.flatMap((p) => [p.label, p.grupo]), nombreCorto(players.get(playerId))]
          .map(plano)
          .filter((clave) => clave.length > 2),
      ),
    ];

    const siglas = puestos.map((p) => p.sigla).filter((sigla) => sigla.length >= 2 && sigla === sigla.toUpperCase());

    return [
      {
        indice,
        titulo: tituloVisible(tablero.slides, indice),
        lado,
        puestos,
        mision: mision.charAt(0).toLocaleUpperCase("es-ES") + mision.slice(1),
        senal,
        consignas: consignasSuyas(lineasConsignas(slide.notas), claves, siglas),
      },
    ];
  });
}

/* ------------------------------------------------------------------ */
/*  DIBUJO                                                             */
/* ------------------------------------------------------------------ */

function lienzo() {
  const canvas = document.createElement("canvas");

  canvas.width = HOJA_W;
  canvas.height = HOJA_H;

  const ctx = canvas.getContext("2d") as Ctx;

  ctx.fillStyle = C.papel;
  ctx.fillRect(0, 0, HOJA_W, HOJA_H);
  ctx.textBaseline = "alphabetic";

  return { canvas, ctx };
}

/** Parte un texto en renglones que quepan en `maxW` con la letra puesta. */
function renglones(ctx: Ctx, texto: string, maxW: number) {
  const salida: string[] = [];
  let linea = "";

  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;

    if (linea && ctx.measureText(prueba).width > maxW) {
      salida.push(linea);
      linea = palabra;
    } else {
      linea = prueba;
    }
  }

  if (linea) salida.push(linea);

  return salida;
}

function colorLado(lado: LadoPizarra) {
  return lado === "ofensivo" ? C.verde : C.navy;
}

function rotuloSeccion(ctx: Ctx, texto: string, y: number) {
  ctx.fillStyle = C.rosa;
  ctx.fillRect(MARGEN, y - 30, 10, 38);
  ctx.fillStyle = C.navy;
  fuente(ctx, 40, 700);
  textoEspaciado(ctx, texto, MARGEN + 26, y, 4);
}

function filoRosa(ctx: Ctx) {
  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, HOJA_H - 14, HOJA_W, 14);
}

type Escudos = { nuestro: HTMLImageElement | null; rival: HTMLImageElement | null };

type Contexto = {
  player: Player | undefined;
  rival: string;
  jornada?: string;
  escudos: Escudos;
};

/** Sólo «2 / 4» abajo: la cabecera ya dice quién, contra quién y qué. */
function numeroPagina(ctx: Ctx, pagina: number, total: number) {
  ctx.fillStyle = "rgba(15,30,61,.5)";
  fuente(ctx, 28, 600);
  ctx.textAlign = "right";
  ctx.fillText(`${pagina} / ${total}`, HOJA_W - MARGEN, HOJA_H - 44);
  ctx.textAlign = "left";

  filoRosa(ctx);
}

/** Escudo, o la inicial del club en un disco si no lo hay. */
function escudo(ctx: Ctx, imagen: HTMLImageElement | null, nombre: string, x: number, y: number, lado: number, oscuro = false) {
  if (imagen) {
    encaja(ctx, imagen, x, y, lado, lado);

    return;
  }

  ctx.fillStyle = oscuro ? "rgba(255,255,255,.12)" : C.crema;
  ctx.beginPath();
  ctx.arc(x + lado / 2, y + lado / 2, lado / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = oscuro ? C.crema : C.navy;
  fuente(ctx, lado * 0.5, 700);
  ctx.textAlign = "center";
  ctx.fillText((nombre.trim()[0] ?? "").toUpperCase(), x + lado / 2, y + lado * 0.68);
  ctx.textAlign = "left";
}

/* ----------------------------- portada ----------------------------- */

function dibujaPortada(
  ctx: Ctx,
  cx: Contexto,
  foto: HTMLImageElement | null,
  acciones: CometidoAccion[],
) {
  /* Cabecera: nuestro escudo · VS · el suyo. */
  const lado = 150;
  const yEsc = 70;

  escudo(ctx, cx.escudos.nuestro, "Real Madrid", HOJA_W / 2 - 110 - lado, yEsc, lado);
  escudo(ctx, cx.escudos.rival, cx.rival, HOJA_W / 2 + 110, yEsc, lado);

  chapa(ctx, "VS", {
    x: HOJA_W / 2,
    y: yEsc + lado / 2 - 32,
    alto: 64,
    fondo: C.rosa,
    tinta: C.navy,
    tamano: 40,
    espaciado: 3,
    padding: 22,
    desdeCentro: true,
  });

  const sub = [cx.jornada, cx.rival].filter(Boolean).join(" · ").toUpperCase();

  chapa(ctx, sub, {
    x: HOJA_W / 2,
    y: yEsc + lado + 26,
    alto: 54,
    fondo: C.navy,
    tinta: C.crema,
    tamano: 32,
    espaciado: 3,
    padding: 28,
    anchoMax: HOJA_W - MARGEN * 2,
    desdeCentro: true,
  });

  /* El título, como «ANÁLISIS INDIVIDUAL»: enorme y condensado. */
  ctx.fillStyle = C.navy;
  const px = ajusta(ctx, "BALÓN PARADO", HOJA_W - MARGEN * 2, 190, 700, 2);
  textoEspaciado(ctx, "BALÓN PARADO", MARGEN, 470, 2);

  ctx.fillStyle = C.rosa;
  ctx.fillRect(MARGEN, 470 + 26, 220, 10);

  fuente(ctx, 40, 600);
  ctx.fillStyle = C.verde;
  textoEspaciado(ctx, "TU PIZARRA DEL PARTIDO", MARGEN + 240, 470 + 40, 4);

  /* La foto, desvanecida contra el papel por abajo (como la portada del rival). */
  const fotoY = 470 + Math.max(60, px * 0.3);
  const fotoH = 560;
  const fotoW = 560;
  const fotoX = HOJA_W - MARGEN - fotoW + 20;

  if (foto) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(fotoX, fotoY, fotoW, fotoH);
    ctx.clip();
    cubre(ctx, foto, fotoX, fotoY, fotoW, fotoH);
    ctx.restore();

    const fundido = ctx.createLinearGradient(0, fotoY + fotoH * 0.62, 0, fotoY + fotoH);

    fundido.addColorStop(0, "rgba(255,255,255,0)");
    fundido.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = fundido;
    ctx.fillRect(fotoX - 2, fotoY, fotoW + 4, fotoH + 2);
  }

  /* El dorsal, el nombre y el puesto, a la izquierda de la foto. */
  const izq = MARGEN;
  const anchoTexto = foto ? fotoX - izq - 24 : HOJA_W - MARGEN * 2;

  if (cx.player?.dorsal != null) {
    ctx.fillStyle = C.rosa;
    fuente(ctx, 260, 700);
    textoEspaciado(ctx, String(cx.player.dorsal), izq - 6, fotoY + 250, 0);
  }

  const nombre = nombreCorto(cx.player).toUpperCase();

  chapa(ctx, nombre || "JUGADOR", {
    x: izq,
    y: fotoY + 300,
    alto: 92,
    fondo: C.verde,
    tinta: C.crema,
    tamano: 60,
    espaciado: 3,
    padding: 34,
    anchoMax: anchoTexto,
  });

  if (cx.player?.posicion) {
    chapa(ctx, cx.player.posicion.toUpperCase(), {
      x: izq,
      y: fotoY + 410,
      alto: 58,
      fondo: C.navy,
      tinta: C.crema,
      tamano: 32,
      espaciado: 3,
      padding: 26,
      anchoMax: anchoTexto,
    });
  }

  /* TUS ACCIONES: el resumen que se lee sin pasar de página. */
  let y = fotoY + fotoH + 70;

  rotuloSeccion(ctx, `TUS ${acciones.length} ${acciones.length === 1 ? "ACCIÓN" : "ACCIONES"}`, y);

  y += 34;

  const fila = Math.min(124, Math.floor((HOJA_H - 110 - y) / Math.max(1, acciones.length)));

  acciones.forEach((accion, orden) => {
    const top = y + orden * fila;
    const alto = fila - 12;

    ctx.fillStyle = orden % 2 ? C.papel : C.crema;
    rectRedondo(ctx, MARGEN, top, HOJA_W - MARGEN * 2, alto, 14);
    ctx.fill();

    /* El lado: barra de color a la izquierda. */
    ctx.fillStyle = colorLado(accion.lado);
    rectRedondo(ctx, MARGEN, top, 12, alto, 6);
    ctx.fill();

    /* El número de la hoja donde está explicada, en un disco. */
    const r = Math.min(26, alto * 0.3);

    ctx.fillStyle = colorLado(accion.lado);
    ctx.beginPath();
    ctx.arc(MARGEN + 30 + r, top + alto / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.crema;
    fuente(ctx, r * 1.2, 700);
    ctx.textAlign = "center";
    ctx.fillText(String(orden + 2), MARGEN + 30 + r, top + alto / 2 + r * 0.42);
    ctx.textAlign = "left";

    const sigla = accion.puestos.map((p) => p.sigla).join(" · ");
    const derecha = HOJA_W - MARGEN - 18;
    const anchoSigla = sigla
      ? chapa(ctx, sigla, {
          x: derecha,
          y: top + (alto - Math.min(68, alto - 14)) / 2,
          alto: Math.min(68, alto - 14),
          fondo: C.rosa,
          tinta: C.navy,
          tamano: Math.min(40, alto * 0.45),
          espaciado: 2,
          padding: 18,
          anchoMin: 70,
          anchoMax: 260,
          desdeDerecha: true,
        })
      : 0;

    const papel = accion.puestos.map((p) => p.label).join(" · ").toUpperCase();
    const maxW = derecha - anchoSigla - 24 - (MARGEN + 100);

    ctx.fillStyle = C.navy;
    ajusta(ctx, accion.titulo.toUpperCase(), maxW, Math.min(48, alto * 0.42), 700, 1);
    textoEspaciado(ctx, accion.titulo.toUpperCase(), MARGEN + 100, top + (papel ? alto * 0.48 : alto / 2 + 12), 1);

    if (papel) {
      ctx.fillStyle = colorLado(accion.lado);
      ajusta(ctx, papel, maxW, Math.min(32, alto * 0.3), 600, 1);
      textoEspaciado(ctx, papel, MARGEN + 100, top + alto * 0.82, 1);
    }
  });

  filoRosa(ctx);
}

/* ----------------------------- una acción ----------------------------- */

const CABECERA_H = 200;
const TABLERO_Y = CABECERA_H;
const TABLERO_ALTO = Math.round((HOJA_W * 1080) / 1920);

function dibujaAccion(
  ctx: Ctx,
  cx: Contexto,
  accion: CometidoAccion,
  tablero: HTMLImageElement | null,
  pagina: number,
  total: number,
) {
  /* Cabecera en azul noche, con los dos escudos pequeños. */
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, HOJA_W, CABECERA_H);

  escudo(ctx, cx.escudos.nuestro, "Real Madrid", MARGEN - 20, 40, 96, true);
  escudo(ctx, cx.escudos.rival, cx.rival, HOJA_W - MARGEN - 76, 40, 96, true);

  const centro = HOJA_W / 2;
  const anchoTitulo = HOJA_W - (MARGEN + 110) * 2;

  chapa(ctx, `${LADO_PIZARRA_LABEL[accion.lado].toUpperCase()} · ${pagina - 1} DE ${total - 1}`, {
    x: centro,
    y: 30,
    alto: 42,
    fondo: accion.lado === "ofensivo" ? C.verde : C.rosa,
    tinta: accion.lado === "ofensivo" ? C.crema : C.navy,
    tamano: 24,
    espaciado: 3,
    padding: 20,
    desdeCentro: true,
  });

  ctx.fillStyle = C.crema;
  const titulo = accion.titulo.toUpperCase();
  ajusta(ctx, titulo, anchoTitulo, 78, 700, 2);
  ctx.textAlign = "left";
  const medida = ctx.measureText(titulo).width + 2 * (titulo.length - 1);
  textoEspaciado(ctx, titulo, centro - medida / 2, 150, 2);

  /* La diapositiva, a lo ancho, con él resaltado. */
  if (tablero) {
    ctx.drawImage(tablero, 0, TABLERO_Y, HOJA_W, TABLERO_ALTO);
  }

  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, TABLERO_Y + TABLERO_ALTO, HOJA_W, 8);

  /* TU COMETIDO: la sigla, el puesto y la misión en una línea. */
  let y = TABLERO_Y + TABLERO_ALTO + 78;

  rotuloSeccion(ctx, "TU COMETIDO", y);

  y += 30;

  const puestos = accion.puestos;
  const sigla = puestos.map((p) => p.sigla).join("·") || "★";
  const papel = puestos.map((p) => p.label).join(" · ").toUpperCase() || "EN LA PIZARRA";

  const discoR = 92;
  const tx = MARGEN + 40 + discoR * 2 + 40;
  const maxW = HOJA_W - MARGEN - 30 - tx;

  fuente(ctx, 40, 600);
  const lineasMision = accion.mision ? renglones(ctx, accion.mision, maxW) : [];
  const altoCaja = Math.max(230, 150 + lineasMision.length * 48);

  ctx.fillStyle = C.crema;
  rectRedondo(ctx, MARGEN, y, HOJA_W - MARGEN * 2, altoCaja, 22);
  ctx.fill();

  /* La sigla en un disco grande: es lo que se busca en la pizarra. */
  const discoX = MARGEN + 40 + discoR;
  const discoY = y + altoCaja / 2;

  ctx.fillStyle = C.rosa;
  ctx.beginPath();
  ctx.arc(discoX, discoY, discoR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.navy;
  const pxSigla = ajusta(ctx, sigla, discoR * 1.6, 92, 700, 0);
  ctx.textAlign = "center";
  ctx.fillText(sigla, discoX, discoY + pxSigla * 0.35);
  ctx.textAlign = "left";

  let ty = y + (lineasMision.length ? 92 : altoCaja / 2 + 24);

  ctx.fillStyle = C.navy;
  ajusta(ctx, papel, maxW, 72, 700, 1);
  textoEspaciado(ctx, papel, tx, ty, 1);

  ty += 60;
  ctx.fillStyle = colorLado(accion.lado);
  fuente(ctx, 40, 600);

  for (const linea of lineasMision) {
    ctx.fillText(linea, tx, ty);
    ty += 48;
  }

  y += altoCaja + 84;

  /* PROPÓSITO COLECTIVO: la señal y lo que le toca. Sólo si hay algo. */
  if (accion.senal || accion.consignas.length) {
    rotuloSeccion(ctx, "PROPÓSITO COLECTIVO", y);
    y += 40;

    const cuerpo = 44;
    const salto = cuerpo * 1.18;

    if (accion.senal) {
      chapa(ctx, "SEÑAL", {
        x: MARGEN,
        y,
        alto: 50,
        fondo: C.navy,
        tinta: C.crema,
        tamano: 28,
        espaciado: 3,
        padding: 20,
        anchoMin: 150,
      });

      ctx.fillStyle = C.navy;
      fuente(ctx, cuerpo, 600);

      let ly = y + 40;

      for (const linea of renglones(ctx, accion.senal, HOJA_W - MARGEN * 2 - 180)) {
        ctx.fillText(linea, MARGEN + 180, ly);
        ly += salto;
      }

      y = Math.max(y + 50, ly - salto + 10) + 30;
    }

    accion.consignas.forEach((consigna, orden) => {
      ctx.fillStyle = C.rosa;
      ctx.beginPath();
      ctx.arc(MARGEN + 30, y + cuerpo * 0.42, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.navy;
      fuente(ctx, 34, 700);
      ctx.textAlign = "center";
      ctx.fillText(String(orden + 1), MARGEN + 30, y + cuerpo * 0.42 + 12);
      ctx.textAlign = "left";

      ctx.fillStyle = C.navy;
      fuente(ctx, cuerpo, 500);

      let ly = y + cuerpo * 0.78;

      for (const linea of renglones(ctx, consigna, HOJA_W - MARGEN * 2 - 90)) {
        ctx.fillText(linea, MARGEN + 90, ly);
        ly += salto;
      }

      y = ly - salto + cuerpo * 0.3 + 28;
    });
  }

  numeroPagina(ctx, pagina, total);
}

/* ------------------------------------------------------------------ */
/*  EL PDF                                                             */
/* ------------------------------------------------------------------ */

export type PdfJugador = { nombre: string; blob: Blob; acciones: number };

export async function cargaEscudos(rivalEscudo: string | undefined): Promise<Escudos> {
  const [nuestro, rival] = await Promise.all([
    cargaImagen("/logo.png").catch(() => null),
    rivalEscudo ? cargaImagen(rivalEscudo).catch(() => null) : Promise.resolve(null),
  ]);

  return { nuestro, rival };
}

function imagenDe(dataUrl: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const imagen = new Image();

    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => resolve(null);
    imagen.src = dataUrl;
  });
}

/** Quita tildes y espacios para el nombre del fichero. */
function archivo(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

/**
 * Monta el PDF de un jugador. `capturas[i]` es la diapositiva `acciones[i]`
 * ya fotografiada con él resaltado (JPEG en data URL).
 */
export async function pdfJugador(opciones: {
  player: Player | undefined;
  acciones: CometidoAccion[];
  capturas: string[];
  rival: string;
  jornada?: string;
  escudos: Escudos;
}): Promise<PdfJugador> {
  const { jsPDF } = await import("jspdf");
  const { player, acciones, capturas } = opciones;

  const cx: Contexto = { player, rival: opciones.rival, jornada: opciones.jornada, escudos: opciones.escudos };

  const foto = player?.fotoLejos || player?.foto;
  const retrato = foto ? await cargaImagen(foto).catch(() => null) : null;

  const total = acciones.length + 1;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [HOJA_W / 2, HOJA_H / 2], compress: true });

  const portada = lienzo();
  dibujaPortada(portada.ctx, cx, retrato, acciones);
  doc.addImage(portada.canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, HOJA_W / 2, HOJA_H / 2);

  for (const [orden, accion] of acciones.entries()) {
    const hoja = lienzo();
    const imagen = capturas[orden] ? await imagenDe(capturas[orden]) : null;

    dibujaAccion(hoja.ctx, cx, accion, imagen, orden + 2, total);

    doc.addPage([HOJA_W / 2, HOJA_H / 2], "portrait");
    doc.addImage(hoja.canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, HOJA_W / 2, HOJA_H / 2);
  }

  const quien = nombreCorto(player) || "jugador";

  doc.setProperties({ title: `Balón parado · ${quien} · ${opciones.rival}`, author: "RMCF Castilla" });

  const nombre = `ABP-${[player?.dorsal, archivo(quien), opciones.jornada, archivo(opciones.rival)]
    .filter((parte) => parte != null && parte !== "")
    .join("-")}.pdf`;

  return { nombre, blob: doc.output("blob"), acciones: acciones.length };
}
