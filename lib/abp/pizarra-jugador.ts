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
 *   resaltada (`TableroSlide destacado`), TU COMETIDO (sigla, puesto, con
 *   quién y su movimiento) y PROPÓSITO COLECTIVO (guion y consignas).
 *
 * Lenguaje de `INDIVIDUAL.pptx` (papel blanco, Barlow Condensed, chapas de
 * `lib/rivals/lienzo-club.ts`), el mismo que la portada del rival. Lo que no
 * tiene contenido no se nombra: ni compañeros, ni movimiento, ni consignas
 * vacías.
 */

import type { Player } from "@/types/player";
import {
  CASILLAS_GUION,
  LADO_PIZARRA_LABEL,
  PLANTILLA_BY_KEY,
  gruposDe,
  lineasDeSlide,
  puestoDe,
  siglaDe,
  tituloVisible,
  type LadoPizarra,
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

const ROSA_TINTA = "#9C4A57";

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
  companeros: string[];
  movimientos: string[];
  /** Guion (señal, rutina, intención) y consignas, ya normalizados. */
  guion: { rotulo: string; texto: string }[];
  consignas: string[];
};

const MOVIMIENTO: Record<TipoTrazo, string> = {
  carrera: "Carrera",
  balon: "Golpeo",
  bloqueo: "Bloqueo",
};

/** Un trazo es suyo si arranca a sus pies (igual que lo ata la pizarra). */
const PIES = 40;

export const nombreCorto = (player: Player | undefined) =>
  (player?.apodo || player?.nombre || "").trim();

/** Las acciones en las que sale un jugador, en el orden de la charla. */
export function cometidosDe(
  tablero: TableroPizarra,
  playerId: string,
  players: Map<string, Player>,
): CometidoAccion[] {
  return tablero.slides.flatMap((slide, indice) => {
    const suyas = slide.fichas.filter((ficha) => ficha.playerId === playerId);

    if (suyas.length === 0) return [];

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
    ];

    const movimientos = (slide.trazos ?? [])
      .filter((trazo) =>
        suyas.some((ficha) => Math.hypot(trazo.x1 - ficha.x, trazo.y1 - ficha.y) <= PIES),
      )
      .sort((a, b) => a.fase - b.fase)
      .map((trazo) => {
        const fases = new Set((slide.trazos ?? []).map((t) => t.fase)).size;

        return fases > 1 ? `${MOVIMIENTO[trazo.tipo]} (fase ${trazo.fase})` : MOVIMIENTO[trazo.tipo];
      });

    const lineas = lineasDeSlide(slide);
    const rotulos = new Set<string>(CASILLAS_GUION.map((casilla) => casilla.rotulo));

    return [
      {
        indice,
        titulo: tituloVisible(tablero.slides, indice),
        lado: PLANTILLA_BY_KEY.get(slide.plantilla)?.lado ?? "ofensivo",
        puestos,
        companeros,
        movimientos: [...new Set(movimientos)],
        guion: lineas.flatMap((linea) =>
          linea.tipo === "guion" && rotulos.has(linea.rotulo)
            ? [{ rotulo: linea.rotulo, texto: linea.texto }]
            : [],
        ),
        consignas: lineas.flatMap((linea) =>
          linea.tipo === "consigna" ? [linea.texto] : linea.tipo === "subtitulo" ? [`${linea.texto}:`] : [],
        ),
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

function pie(ctx: Ctx, cx: Contexto, pagina: number, total: number) {
  const y = HOJA_H - 44;

  ctx.fillStyle = "rgba(15,30,61,.55)";
  fuente(ctx, 26, 600);
  textoEspaciado(
    ctx,
    [nombreCorto(cx.player), cx.jornada, `vs ${cx.rival}`].filter(Boolean).join("  ·  ").toUpperCase(),
    MARGEN,
    y,
    2,
  );

  const n = `${pagina} / ${total}`;

  ctx.textAlign = "right";
  ctx.fillText(n, HOJA_W - MARGEN, y);
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
  total: number,
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

  if (cx.player?.nombre && cx.player.apodo && cx.player.nombre !== cx.player.apodo) {
    ctx.fillStyle = C.verde;
    ajusta(ctx, cx.player.nombre.toUpperCase(), anchoTexto, 32, 600, 2);
    textoEspaciado(ctx, cx.player.nombre.toUpperCase(), izq, fotoY + 520, 2);
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

    const numero = `${orden + 2}`;

    ctx.fillStyle = "rgba(15,30,61,.45)";
    fuente(ctx, Math.min(30, alto * 0.42), 600);
    ctx.fillText(`P.${numero}`, MARGEN + 30, top + alto / 2 + 10);

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

  pie(ctx, cx, 1, total);
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

  /* TU COMETIDO */
  let y = TABLERO_Y + TABLERO_ALTO + 78;

  rotuloSeccion(ctx, "TU COMETIDO", y);

  y += 30;

  const puestos = accion.puestos.length ? accion.puestos : [];
  const extra = [
    accion.companeros.length ? `Con ${accion.companeros.join(", ")}` : "",
    accion.movimientos.length ? `Tu movimiento: ${accion.movimientos.join(" · ")}` : "",
  ].filter(Boolean);

  fuente(ctx, 34, 500);
  const lineasExtra = extra.flatMap((texto) => renglones(ctx, texto, HOJA_W - MARGEN * 2 - 260));
  const altoCaja = Math.max(220, 150 + lineasExtra.length * 42);

  ctx.fillStyle = C.crema;
  rectRedondo(ctx, MARGEN, y, HOJA_W - MARGEN * 2, altoCaja, 22);
  ctx.fill();

  /* La sigla en un disco grande: es lo que se busca en la pizarra. */
  const sigla = puestos.map((p) => p.sigla).join("·") || "★";
  const discoR = 92;
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

  const tx = discoX + discoR + 40;
  const maxW = HOJA_W - MARGEN - 30 - tx;
  let ty = y + 82;

  const papel = puestos.map((p) => p.label).join(" · ").toUpperCase() || "EN LA PIZARRA";

  ctx.fillStyle = C.navy;
  ajusta(ctx, papel, maxW, 66, 700, 1);
  textoEspaciado(ctx, papel, tx, ty, 1);

  const grupo = [...new Set(puestos.map((p) => p.grupo).filter(Boolean))].join(" · ").toUpperCase();

  /* «CORTA» dentro de «CORTA» no dice nada: el grupo sólo si añade algo. */
  if (grupo && grupo !== papel) {
    chapa(ctx, grupo, {
      x: tx,
      y: ty + 18,
      alto: 46,
      fondo: colorLado(accion.lado),
      tinta: C.crema,
      tamano: 26,
      espaciado: 3,
      padding: 20,
      anchoMax: maxW,
    });
    ty += 64;
  }

  ty += 50;
  ctx.fillStyle = C.verde;
  fuente(ctx, 34, 500);

  for (const linea of lineasExtra) {
    ctx.fillText(linea, tx, ty);
    ty += 42;
  }

  y += altoCaja + 84;

  /* PROPÓSITO COLECTIVO: sólo si hay algo escrito. */
  const fondoPagina = HOJA_H - 90;

  if (accion.guion.length || accion.consignas.length) {
    rotuloSeccion(ctx, "PROPÓSITO COLECTIVO", y);
    y += 40;

    /* Se encoge todo junto si no cabe, en vez de cortar una consigna. */
    const cabe = (cuerpo: number) => {
      fuente(ctx, cuerpo, 500);
      let alto = 0;

      for (const g of accion.guion) alto += renglones(ctx, g.texto, HOJA_W - MARGEN * 2 - 210).length * cuerpo * 1.18 + 26;
      for (const c of accion.consignas) alto += renglones(ctx, c, HOJA_W - MARGEN * 2 - 90).length * cuerpo * 1.18 + 22;

      return alto <= fondoPagina - y;
    };

    let cuerpo = 42;

    while (cuerpo > 24 && !cabe(cuerpo)) cuerpo -= 2;

    const salto = cuerpo * 1.18;

    for (const g of accion.guion) {
      chapa(ctx, g.rotulo.toUpperCase(), {
        x: MARGEN,
        y: y,
        alto: 46,
        fondo: C.navy,
        tinta: C.crema,
        tamano: 26,
        espaciado: 3,
        padding: 18,
        anchoMin: 180,
      });

      ctx.fillStyle = C.navy;
      fuente(ctx, cuerpo, 600);

      let ly = y + 36;

      for (const linea of renglones(ctx, g.texto, HOJA_W - MARGEN * 2 - 210)) {
        ctx.fillText(linea, MARGEN + 210, ly);
        ly += salto;
      }

      y = Math.max(y + 46, ly - salto + 10) + 22;
    }

    let numero = 0;

    for (const consigna of accion.consignas) {
      const esRotulo = consigna.endsWith(":");

      if (esRotulo) {
        ctx.fillStyle = ROSA_TINTA;
        fuente(ctx, cuerpo * 0.8, 700);
        textoEspaciado(ctx, consigna.slice(0, -1).toUpperCase(), MARGEN, y + cuerpo * 0.8, 3);
        y += cuerpo + 14;
        continue;
      }

      numero += 1;

      ctx.fillStyle = C.rosa;
      ctx.beginPath();
      ctx.arc(MARGEN + 30, y + cuerpo * 0.42, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.navy;
      fuente(ctx, 34, 700);
      ctx.textAlign = "center";
      ctx.fillText(String(numero), MARGEN + 30, y + cuerpo * 0.42 + 12);
      ctx.textAlign = "left";

      ctx.fillStyle = C.navy;
      fuente(ctx, cuerpo, 500);

      /* Quita el «1.» del principio: ya va en el disco. */
      const limpio = consigna.replace(/^\d+[.)]\s*/, "");
      let ly = y + cuerpo * 0.78;

      for (const linea of renglones(ctx, limpio, HOJA_W - MARGEN * 2 - 90)) {
        ctx.fillText(linea, MARGEN + 90, ly);
        ly += salto;
      }

      y = ly - salto + cuerpo * 0.3 + 22;
    }
  }

  pie(ctx, cx, pagina, total);
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
  dibujaPortada(portada.ctx, cx, retrato, acciones, total);
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
