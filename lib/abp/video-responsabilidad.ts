/**
 * EL VÍDEO DE LA RESPONSABILIDAD DE UN JUGADOR, PARA LA TELE (01/11/2026).
 *
 * Lo pidió el analista: «el vídeo individual de la responsabilidad en la
 * pizarra de ABP de cada jugador, aprovechando la movilidad de las slides que
 * lo tienen». Sale con «Exportar ▸ Todo» y «Vídeos por jugador», junto a su
 * PDF.
 *
 * Es la MISMA diapositiva animada que el vídeo de la jugada (el material de
 * `lib/abp/rodaje-jugada.ts`, sin volver a fotografiar nada), con él delante,
 * más grande, con su brillo rosa, el aro a sus pies y «TÚ» encima, y el resto
 * en gris y apagado, como en su PDF. Por acción: un rótulo de entrada con su
 * puesto, su tarea, a quién marca y la señal, y durante la jugada lo que hace
 * él en cada fase («Atacas el 1.er palo»).
 *
 * 1920 × 1080 a 30 fps y 12 Mb/s, como los de la sala. El vídeo vertical para
 * el móvil (`lib/abp/video-jugador.ts`, con la escena del laboratorio) sigue
 * en «PDF por jugador».
 */

import { LADO_PIZARRA_LABEL } from "@/lib/abp/pizarra";
import { nombreCorto, pintaEscudo, renglones, type CometidoAccion, type ContextoJugador } from "@/lib/abp/pizarra-jugador";
import { abreEmisor, duracionSegmento, montaJugada, FPS, type EstadoCapa, type MaterialJugada, type Tiempos } from "@/lib/abp/rodaje-jugada";
import { C, ajusta, anchoEspaciado, chapa, cubre, fuente, rectRedondo, textoEspaciado } from "@/lib/rivals/lienzo-club";

const W = 1920;
const H = 1080;
const CAUDAL = 12_000_000;
const MARGEN = 96;

const PORTADA_S = 2.2;
const ENTRADA_S = 2.6;
/** Fundido de la tarjeta de cada acción sobre lo anterior. */
const FUNDIDO = 10;
const TIEMPOS: Tiempos = { salida: 1.2, movimiento: 2, pausa: 1.1, final: 2.4 };

const ORO = "#C8A96B";

export type AccionConJugada = { accion: CometidoAccion; material: MaterialJugada };

export function duracionResponsabilidad(acciones: { nFases: number }[]) {
  return PORTADA_S + acciones.reduce((s, a) => s + ENTRADA_S + duracionSegmento(a.nFases, TIEMPOS), 0);
}

type Ctx = CanvasRenderingContext2D;

const mayuscula = (t: string) => t.charAt(0).toLocaleUpperCase("es-ES") + t.slice(1);

/* ----------------------------- portada ----------------------------- */

function pintaPortada(ctx: Ctx, cx: ContextoJugador, retrato: HTMLImageElement | null, acciones: number) {
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, W, H);

  /* La foto, a la derecha, fundida con el azul. */
  if (retrato) {
    const x0 = W * 0.52;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, W - x0, H);
    ctx.clip();
    cubre(ctx, retrato, x0, 40, W - x0, H - 40, 0.1);
    ctx.restore();

    const fundido = ctx.createLinearGradient(x0, 0, x0 + 360, 0);

    fundido.addColorStop(0, "rgba(15,30,61,1)");
    fundido.addColorStop(1, "rgba(15,30,61,0)");
    ctx.fillStyle = fundido;
    ctx.fillRect(x0 - 1, 0, 362, H);
  }

  const lado = 110;

  pintaEscudo(ctx, cx.escudos.nuestro, "Real Madrid", MARGEN, 80, lado, true);
  pintaEscudo(ctx, cx.escudos.rival, cx.rival, MARGEN + lado + 120, 80, lado, true);
  chapa(ctx, "VS", { x: MARGEN + lado + 60, y: 80 + lado / 2 - 26, alto: 52, fondo: C.rosa, tinta: C.navy, tamano: 30, espaciado: 3, padding: 18, desdeCentro: true });

  ctx.textAlign = "left";
  ctx.fillStyle = C.crema;
  ajusta(ctx, "BALÓN PARADO", W * 0.5 - MARGEN, 150, 700, 2);
  textoEspaciado(ctx, "BALÓN PARADO", MARGEN, 400, 2);

  ctx.fillStyle = C.rosa;
  ctx.fillRect(MARGEN, 432, 200, 10);
  fuente(ctx, 40, 600);
  textoEspaciado(ctx, "TU RESPONSABILIDAD", MARGEN + 226, 448, 4);

  const dorsal = cx.player?.dorsal != null ? String(cx.player.dorsal).trim() : "";

  if (dorsal) {
    ctx.fillStyle = C.rosa;
    fuente(ctx, 220, 700);
    textoEspaciado(ctx, dorsal, MARGEN - 6, 700, 0);
  }

  const nombre = nombreCorto(cx.player).toUpperCase() || "BALÓN PARADO";

  chapa(ctx, nombre, { x: MARGEN, y: 760, alto: 104, fondo: C.rosa, tinta: C.navy, tamano: 66, espaciado: 3, padding: 34, anchoMax: W * 0.5 - MARGEN });

  const sub = [`${acciones} ${acciones === 1 ? "ACCIÓN" : "ACCIONES"}`, cx.jornada, cx.rival ? `VS ${cx.rival}` : ""].filter(Boolean).join(" · ").toUpperCase();

  ctx.fillStyle = C.crema;
  ajusta(ctx, sub, W * 0.5 - MARGEN, 44, 600, 3);
  textoEspaciado(ctx, sub, MARGEN, 948, 3);
}

/* ---------------------- la tarjeta de cada acción ---------------------- */

/**
 * La entrada de cada acción: qué jugada es y qué le toca, antes de verla. De
 * fondo, la salida de la diapositiva, apagada.
 */
function pintaEntrada(ctx: Ctx, accion: CometidoAccion, orden: number, total: number, salida: ImageBitmap) {
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.3;
  ctx.drawImage(salida, 0, 0, W, H);
  ctx.globalAlpha = 1;

  const velo = ctx.createLinearGradient(0, 0, W, 0);

  velo.addColorStop(0, "rgba(15,30,61,.97)");
  velo.addColorStop(0.62, "rgba(15,30,61,.9)");
  velo.addColorStop(1, "rgba(15,30,61,.35)");
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, W, H);

  const ofensiva = accion.lado === "ofensivo";
  const ancho = W * 0.66 - MARGEN;

  chapa(ctx, `ACCIÓN ${orden + 1} DE ${total} · ${LADO_PIZARRA_LABEL[accion.lado].toUpperCase()}`, {
    x: MARGEN,
    y: 92,
    alto: 54,
    fondo: ofensiva ? C.verde : C.rosa,
    tinta: ofensiva ? C.crema : C.navy,
    tamano: 30,
    espaciado: 3,
    padding: 22,
  });

  /* El título entero, en dos renglones si hace falta. */
  ctx.fillStyle = C.crema;
  ctx.textAlign = "left";
  fuente(ctx, 84, 700);
  const titulo = renglones(ctx, accion.titulo.toUpperCase(), ancho).slice(0, 2);
  let y = 250;

  for (const linea of titulo) {
    ajusta(ctx, linea, ancho, 84, 700, 1);
    textoEspaciado(ctx, linea, MARGEN, y, 1);
    y += 92;
  }

  ctx.fillStyle = C.rosa;
  ctx.fillRect(MARGEN, y - 50, 200, 10);
  y += 40;

  /* Su puesto: la sigla en el disco y el nombre del puesto al lado. */
  const sigla = accion.puestos.map((p) => p.sigla).join("·") || "TÚ";
  const papel = accion.puestos.map((p) => p.label).join(" · ").toUpperCase();
  const r = 74;

  ctx.fillStyle = C.rosa;
  ctx.beginPath();
  ctx.arc(MARGEN + r, y + r, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.navy;
  const px = ajusta(ctx, sigla, r * 1.6, 92, 700, 0);
  ctx.textAlign = "center";
  ctx.fillText(sigla, MARGEN + r, y + r + px * 0.35);
  ctx.textAlign = "left";

  const tx = MARGEN + r * 2 + 40;
  const tw = ancho - (tx - MARGEN);

  ctx.fillStyle = C.rosa;
  fuente(ctx, 30, 700);
  textoEspaciado(ctx, "TU PUESTO", tx, y + 44, 5);
  ctx.fillStyle = C.crema;
  ajusta(ctx, papel || "EN LA PIZARRA", tw, 64, 700, 1);
  textoEspaciado(ctx, papel || "EN LA PIZARRA", tx, y + 118, 1);

  y += r * 2 + 70;

  /* Su tarea, paso a paso (de sus flechas), o su misión. */
  const tarea = accion.tarea || accion.mision;

  if (tarea) {
    ctx.fillStyle = C.rosa;
    fuente(ctx, 30, 700);
    textoEspaciado(ctx, "TU TAREA", MARGEN, y, 5);
    y += 56;
    ctx.fillStyle = C.crema;
    fuente(ctx, 46, 600);

    for (const linea of renglones(ctx, tarea, ancho).slice(0, 3)) {
      ctx.fillText(linea, MARGEN, y);
      y += 58;
    }

    y += 14;
  }

  /* A quién marca y la señal, en chapas. */
  let cxChapa = MARGEN;

  for (const [rotulo, texto, fondo, tinta] of [
    ["", accion.rival, "#7A1F2B", C.crema],
    ["SEÑAL", accion.senal, C.crema, C.navy],
  ] as const) {
    if (!texto) continue;

    const t = `${rotulo ? `${rotulo}: ` : ""}${texto}`.toUpperCase();
    const w = chapa(ctx, t, { x: cxChapa, y, alto: 62, fondo, tinta, tamano: 34, espaciado: 2, padding: 24, anchoMax: ancho - (cxChapa - MARGEN) });

    cxChapa += (typeof w === "number" ? w : 0) + 18;
  }
}

/* ---------------------------- durante la jugada ---------------------------- */

/** Lo que hace él en cada tramo: la salida, lo de cada fase y lo del final. */
function textoDeTramo(accion: CometidoAccion, tramo: number, nFases: number) {
  const salida = accion.tarea.split(" · ")[0] || accion.puestos.map((p) => p.label).join(" · ") || accion.mision;

  if (tramo === 0) return salida;

  if (tramo > nFases) return accion.rival || accion.despues || accion.mision || salida;

  /* La fase en la que se mueve; si no se mueve en esta, lo último que hizo (o su sitio de salida). */
  const hasta = accion.pasosFase.filter((p) => p.fase <= tramo);

  return hasta.at(-1)?.texto || salida;
}

function antetitulo(tramo: number, nFases: number) {
  if (tramo === 0) return "SALIDA";
  if (tramo > nFases) return "LLEGADA";

  return nFases === 1 ? "MOVIMIENTO" : `FASE ${tramo} DE ${nFases}`;
}

/** El rótulo de abajo a la izquierda, sobre el césped, y la barra del pie. */
function pintaCapa(ctx: Ctx, accion: CometidoAccion, estado: EstadoCapa, orden: number, total: number) {
  const barra = 7;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, H - barra, W, barra);
  ctx.fillStyle = ORO;
  ctx.fillRect(0, H - barra, W * Math.min(1, estado.progreso), barra);
  ctx.fillStyle = "#0B0F14";

  for (const corte of estado.cortes) ctx.fillRect(Math.round(W * corte) - 1, H - barra, 3, barra);

  const sigla = accion.puestos.map((p) => p.sigla).join("·");
  const ante = [`TÚ${sigla ? ` · ${sigla}` : ""}`, antetitulo(estado.tramo, estado.nFases), total > 1 ? `ACCIÓN ${orden + 1} DE ${total}` : ""]
    .filter(Boolean)
    .join("   ·   ");
  const texto = mayuscula(textoDeTramo(accion, estado.tramo, estado.nFases)).toUpperCase();

  const x = 48;
  const maxW = W * 0.74 - x - 60;

  fuente(ctx, 26, 700);
  const anchoAnte = anchoEspaciado(ctx, ante, 3);
  const px = ajusta(ctx, texto, maxW, 52, 700, 1);
  const anchoTexto = anchoEspaciado(ctx, texto, 1);
  const w = Math.max(anchoAnte, anchoTexto) + 64;
  const h = px + 26 + 56;
  const y = Math.round(H * 0.775) - h;
  /* Entra al empezar cada tramo con un toque de luz. */
  const entra = Math.min(1, estado.desde / 0.25);

  ctx.globalAlpha = 0.86 + 0.14 * entra;
  ctx.fillStyle = "rgba(10,14,20,0.88)";
  rectRedondo(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.fillStyle = C.rosa;
  ctx.fillRect(x, y, 8, h);
  ctx.globalAlpha = 1;

  ctx.fillStyle = C.rosa;
  fuente(ctx, 26, 700);
  textoEspaciado(ctx, ante, x + 32, y + 42, 3);

  ctx.fillStyle = "#FFFFFF";
  fuente(ctx, px, 700);
  textoEspaciado(ctx, texto, x + 32, y + 48 + px, 1);
  ctx.restore();
}

/* ------------------------------ el vídeo ------------------------------ */

export async function videoResponsabilidad({
  cx,
  retrato,
  playerId,
  acciones,
  alAvance,
  software = false,
}: {
  cx: ContextoJugador;
  retrato: HTMLImageElement | null;
  playerId: string;
  /** Sus acciones con jugada, cada una con el material de su diapositiva. */
  acciones: AccionConJugada[];
  alAvance?: (fraccion: number) => void;
  software?: boolean;
}): Promise<Blob> {
  /* Caudal variable: son ~50 s por jugador y en lo quieto no hace falta más (medido: ~8 Mb/s, ~55 MB). */
  const e = await abreEmisor(W, H, CAUDAL, software, "variable");
  const total = Math.max(1, Math.round(duracionResponsabilidad(acciones.map((a) => ({ nFases: a.material.nFases }))) * FPS));
  const avisa = () => alAvance?.(Math.min(1, e.cuadros / total));

  try {
    e.ctx.textBaseline = "alphabetic";
    pintaPortada(e.ctx, cx, retrato, acciones.length);

    for (let k = 0; k < Math.round(PORTADA_S * FPS); k += 1) {
      await e.emite();
      avisa();
    }

    /* Lo último que se vio, para fundir encima la tarjeta siguiente. */
    const anterior = document.createElement("canvas");

    anterior.width = W;
    anterior.height = H;

    const actx = anterior.getContext("2d");
    const tarjeta = document.createElement("canvas");

    tarjeta.width = W;
    tarjeta.height = H;

    const tctx = tarjeta.getContext("2d");

    if (!actx || !tctx) throw new Error("El navegador no da un lienzo 2D");

    for (const [orden, { accion, material }] of acciones.entries()) {
      actx.drawImage(e.lienzo, 0, 0);

      const salida = await createImageBitmap(material.salida);

      tctx.textBaseline = "alphabetic";
      pintaEntrada(tctx, accion, orden, acciones.length, salida);
      salida.close();

      for (let k = 0; k < Math.round(ENTRADA_S * FPS); k += 1) {
        e.ctx.drawImage(tarjeta, 0, 0);

        if (k < FUNDIDO) {
          e.ctx.globalAlpha = 1 - (k + 1) / (FUNDIDO + 1);
          e.ctx.drawImage(anterior, 0, 0);
          e.ctx.globalAlpha = 1;
        }

        await e.emite();
        avisa();
      }

      actx.drawImage(e.lienzo, 0, 0);

      let enSegmento = 0;

      await montaJugada(e, material, {
        tiempos: TIEMPOS,
        destacado: playerId,
        dibuja: (ctx, foto) => {
          ctx.drawImage(foto, 0, 0, W, H);

          /* De la tarjeta a la jugada, fundido. */
          if (enSegmento < FUNDIDO) {
            ctx.globalAlpha = 1 - (enSegmento + 1) / (FUNDIDO + 1);
            ctx.drawImage(anterior, 0, 0);
            ctx.globalAlpha = 1;
          }
        },
        capa: (ctx, estado) => {
          pintaCapa(ctx, accion, estado, orden, acciones.length);
          enSegmento += 1;
        },
        alAvance: () => avisa(),
      });
    }

    anterior.width = 0;
    tarjeta.width = 0;

    return await e.cierra();
  } finally {
    e.suelta();
  }
}
