/**
 * El vídeo de balón parado de UN jugador (27/10/2026, segunda versión).
 *
 * La primera era su PDF en movimiento. Ahora cada acción es la jugada pintada
 * como en el laboratorio (`components/abp/pizarra/rodaje-escena.tsx`): cámara
 * de televisión, el balón por el aire, las carreras y la defensa, con él
 * resaltado. Encima, el título de la acción; debajo, SU cometido fijo todo el
 * rato, para que lo lea mientras lo ve. Arriba, una barra por acción como las
 * historias de Instagram: sabe cuánto le queda.
 *
 * Vertical 1080×1920 para el móvil, a 30 fps, sin sonido y por debajo de los
 * 16 MB que WhatsApp acepta como adjunto. WebCodecs + el `MuxorMp4` del
 * coding. Quien llama pone la escena de cada instante: aquí no se toca React.
 *
 * Nada de temporizadores encadenados: en una pestaña escondida Chrome los
 * retrasa hasta un minuto y el vídeo no acabaría nunca. Se espera al
 * codificador por su evento `dequeue`.
 */

import { MuxorMp4 } from "@/lib/coding/mp4";
import type { Bytes } from "@/lib/export/zip";
import { LADO_PIZARRA_LABEL } from "@/lib/abp/pizarra";
import { HOJA_H, HOJA_W, nombreCorto, pintaEscudo, renglones, type CometidoAccion, type ContextoJugador } from "@/lib/abp/pizarra-jugador";
import { momentoDe } from "@/lib/abp-lab/simulacion";
import { C, ajusta, chapa, cubre, fuente, rectRedondo, textoEspaciado } from "@/lib/rivals/lienzo-club";
import { codecLamina } from "@/lib/tactics/lamina";

const FPS = 30;
const W = HOJA_W;
const H = HOJA_H;
const MARGEN = 64;

/** Dónde va cada cosa en la hoja vertical. */
const ESCENA_Y = 250;
const ESCENA_ALTO = 1060;
const PANEL_Y = ESCENA_Y + ESCENA_ALTO + 8;

/** Segundos de cada tramo. */
const PORTADA_S = 1.6;
const ENTRADA_S = 0.5;
/** La jugada entera (0 → 1) dura esto a velocidad normal; cerca del remate va más despacio. */
const JUGADA_S = 5;
const REMATE = 0.76;
const FINAL_S = 1.2;
/** Fundido entre acciones: un corte seco despista (editor-video). */
const FUNDIDO = 8;

/* 3,2 Mb/s: sin bloques en las líneas del campo. Con muchas acciones se baja para no pasar de 15 MB, que WhatsApp lo admita como adjunto. */
const CAUDAL = 3_200_000;
const TOPE_BYTES = 15_000_000;

/** Los instantes de la jugada, fotograma a fotograma: quieta, en marcha (más lenta en el remate) y quieta. */
export function guionAccion(): number[] {
  const instantes: number[] = [];

  for (let k = 0; k < Math.round(ENTRADA_S * FPS); k += 1) instantes.push(0);

  const paso = 1 / (JUGADA_S * FPS);
  let t = 0;

  while (t < 1) {
    t = Math.min(1, t + paso * (Math.abs(t - REMATE) < 0.08 ? 0.45 : 1));
    instantes.push(t);
  }

  for (let k = 0; k < Math.round(FINAL_S * FPS); k += 1) instantes.push(1);

  return instantes;
}

export function duracionVideoJugador(acciones: number) {
  return PORTADA_S + (acciones * guionAccion().length) / FPS;
}

function copiaBytes(origen: AllowSharedBufferSource): Bytes {
  const vista = ArrayBuffer.isView(origen)
    ? new Uint8Array(origen.buffer, origen.byteOffset, origen.byteLength)
    : new Uint8Array(origen as ArrayBuffer);

  const salida = new Uint8Array(new ArrayBuffer(vista.byteLength));

  salida.set(vista);

  return salida as Bytes;
}

type Ctx = CanvasRenderingContext2D;

function lienzo() {
  const canvas = document.createElement("canvas");

  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d") as Ctx;

  ctx.textBaseline = "alphabetic";

  return { canvas, ctx };
}

/* ----------------------------- portada ----------------------------- */

function pintaPortada(ctx: Ctx, cx: ContextoJugador, retrato: HTMLImageElement | null, acciones: number) {
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, W, H);

  /* La foto grande, fundida con el azul por abajo. */
  const fotoY = 520;
  const fotoH = 1060;

  if (retrato) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, fotoY, W, fotoH);
    ctx.clip();
    cubre(ctx, retrato, 0, fotoY, W, fotoH, 0.1);
    ctx.restore();

    const fundido = ctx.createLinearGradient(0, fotoY + fotoH * 0.55, 0, fotoY + fotoH);

    fundido.addColorStop(0, "rgba(15,30,61,0)");
    fundido.addColorStop(1, "rgba(15,30,61,1)");
    ctx.fillStyle = fundido;
    ctx.fillRect(0, fotoY, W, fotoH + 2);
  }

  const lado = 120;

  pintaEscudo(ctx, cx.escudos.nuestro, "Real Madrid", W / 2 - 90 - lado, 70, lado, true);
  pintaEscudo(ctx, cx.escudos.rival, cx.rival, W / 2 + 90, 70, lado, true);
  chapa(ctx, "VS", { x: W / 2, y: 70 + lado / 2 - 28, alto: 56, fondo: C.rosa, tinta: C.navy, tamano: 34, espaciado: 3, padding: 20, desdeCentro: true });

  ctx.fillStyle = C.crema;
  ctx.textAlign = "left";
  ajusta(ctx, "BALÓN PARADO", W - MARGEN * 2, 170, 700, 2);
  textoEspaciado(ctx, "BALÓN PARADO", MARGEN, 400, 2);

  ctx.fillStyle = C.rosa;
  ctx.fillRect(MARGEN, 428, 200, 10);
  fuente(ctx, 38, 600);
  textoEspaciado(ctx, "TU RESPONSABILIDAD, EN VÍDEO", MARGEN + 224, 444, 3);

  if (cx.player?.dorsal != null) {
    ctx.fillStyle = C.rosa;
    fuente(ctx, 230, 700);
    textoEspaciado(ctx, String(cx.player.dorsal), MARGEN - 6, 760, 0);
  }

  const nombre = nombreCorto(cx.player).toUpperCase() || "JUGADOR";

  chapa(ctx, nombre, { x: MARGEN, y: 1520, alto: 104, fondo: C.rosa, tinta: C.navy, tamano: 66, espaciado: 3, padding: 34, anchoMax: W - MARGEN * 2 });

  const sub = [`${acciones} ${acciones === 1 ? "ACCIÓN" : "ACCIONES"}`, cx.jornada, `VS ${cx.rival}`].filter(Boolean).join(" · ").toUpperCase();

  ctx.fillStyle = C.crema;
  ajusta(ctx, sub, W - MARGEN * 2, 46, 600, 3);
  textoEspaciado(ctx, sub, MARGEN, 1700, 3);
}

/* ------------------------- la hoja de una acción ------------------------- */

/**
 * Lo que no se mueve en una acción: la cabecera y su cometido. Se pinta una
 * vez por acción y cada fotograma lo copia (es la mitad del dibujo).
 */
function pintaFondoAccion(ctx: Ctx, accion: CometidoAccion, orden: number, total: number): number {
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, W, H);

  /* Cabecera: lado y número, y el título de la acción. */
  const ofensiva = accion.lado === "ofensivo";

  chapa(ctx, `${LADO_PIZARRA_LABEL[accion.lado].toUpperCase()} · ${orden + 1} DE ${total}`, {
    x: W / 2,
    y: 62,
    alto: 50,
    fondo: ofensiva ? C.verde : C.rosa,
    tinta: ofensiva ? C.crema : C.navy,
    tamano: 28,
    espaciado: 3,
    padding: 22,
    desdeCentro: true,
  });

  const titulo = accion.titulo.toUpperCase();

  ctx.fillStyle = C.crema;
  ajusta(ctx, titulo, W - MARGEN * 2, 76, 700, 2);
  ctx.textAlign = "left";
  const ancho = ctx.measureText(titulo).width + 2 * (titulo.length - 1);
  textoEspaciado(ctx, titulo, W / 2 - ancho / 2, 200, 2);

  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, ESCENA_Y + ESCENA_ALTO, W, 8);

  /* TU COMETIDO: la sigla en un disco; al lado, el puesto, con quién y sus consignas. */
  let y = PANEL_Y + 56;

  ctx.fillStyle = C.rosa;
  fuente(ctx, 32, 700);
  textoEspaciado(ctx, "TU COMETIDO", MARGEN, y, 6);

  const sigla = accion.puestos.map((p) => p.sigla).join("·") || "★";
  const papel = accion.puestos.map((p) => p.label).join(" · ").toUpperCase() || "EN LA PIZARRA";
  const discoR = 86;
  const discoX = MARGEN + discoR;
  const tx = discoX + discoR + 40;
  const maxW = W - MARGEN - tx;

  y += 22;

  /* Una consigna que sólo repite el título («Primer córner del partido») no es un cometido. */
  const plano = (x: string) => x.toLowerCase().replace(/[^a-záéíóúñü0-9]+/g, " ").trim();
  const consignas = accion.consignas.filter((c) => !plano(accion.titulo).includes(plano(c)));

  fuente(ctx, 42, 600);
  const mision = accion.mision ? renglones(ctx, accion.mision, maxW).slice(0, 2) : [];
  fuente(ctx, 40, 600);
  /* Las consignas, en su columna: abajo va la tarea paso a paso y dos órdenes a la vez confunden (experto-futbol). */
  const lineasConsigna = consignas.flatMap((c) => renglones(ctx, `· ${c}`, maxW)).slice(0, 3);
  const alto = Math.max(discoR * 2, 74 + mision.length * 50 + lineasConsigna.length * 48 + (accion.rival ? 74 : 0));

  ctx.fillStyle = C.rosa;
  ctx.beginPath();
  ctx.arc(discoX, y + alto / 2, discoR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.navy;
  const px = ajusta(ctx, sigla, discoR * 1.6, 104, 700, 0);
  ctx.textAlign = "center";
  ctx.fillText(sigla, discoX, y + alto / 2 + px * 0.35);
  ctx.textAlign = "left";

  let ty = y + 58;

  ctx.fillStyle = C.crema;
  ajusta(ctx, papel, maxW, 62, 700, 1);
  textoEspaciado(ctx, papel, tx, ty, 1);

  ty += 54;
  ctx.fillStyle = "rgba(247,244,236,.86)";
  fuente(ctx, 42, 600);

  for (const linea of mision) {
    ctx.fillText(linea, tx, ty);
    ty += 50;
  }

  ctx.fillStyle = C.crema;
  fuente(ctx, 40, 600);

  for (const linea of lineasConsigna) {
    ctx.fillText(linea, tx, ty - 4);
    ty += 48;
  }

  if (accion.rival) {
    chapa(ctx, accion.rival.toUpperCase(), { x: tx, y: ty - 34, alto: 58, fondo: "#7A1F2B", tinta: C.crema, tamano: 34, espaciado: 2, padding: 20, anchoMax: maxW });
  }

  const cy = y + alto + 64;

  /* La señal, abajo, sólo si la hay (ofensivas). */
  if (accion.senal) {
    const sy = H - 92;

    chapa(ctx, "SEÑAL", { x: MARGEN, y: sy - 38, alto: 50, fondo: C.crema, tinta: C.navy, tamano: 28, espaciado: 3, padding: 20 });
    ctx.fillStyle = C.crema;
    const texto = renglones(ctx, accion.senal, W - MARGEN * 2 - 170)[0] ?? "";
    ajusta(ctx, texto, W - MARGEN * 2 - 170, 42, 600, 0);
    ctx.fillText(texto, MARGEN + 170, sy);
  }

  /* Dónde empieza el sitio libre, para los pasos. */
  return cy;
}

/** Los instantes que abren cada paso de su tarea. */
const PASOS = [0, 0.2, 0.4, 0.7, 0.85];

/**
 * Su tarea paso a paso, con el de ahora encendido (experto-futbol): llena
 * el hueco de abajo cuando la pizarra no trae consignas para él.
 */
function pintaPasos(ctx: Ctx, t: number, accion: CometidoAccion, desde: number) {
  const hasta = accion.senal ? H - 160 : H - 50;
  const salto = 42;
  const todos = PASOS.map((p) => ({ p, texto: tareaEn(p + 0.001, accion) })).filter((x, i, lista) => i === 0 || x.texto !== lista[i - 1].texto);
  const caben = Math.floor((hasta - desde + 30) / salto);

  if (caben < 2) return;

  /* Si no caben todos, los de alrededor del de ahora. */
  const actual = Math.max(0, todos.findLastIndex((x) => t >= x.p));
  const inicio = Math.max(0, Math.min(actual - 1, todos.length - caben));
  const pasos = todos.slice(inicio, inicio + caben);

  const y0 = desde - 10;

  pasos.forEach((paso, i) => {
    const siguiente = pasos[i + 1]?.p ?? todos[inicio + i + 1]?.p ?? 2;
    const ahora = t >= paso.p && t < siguiente;
    const hecho = t >= siguiente;
    const y = y0 + i * salto;

    ctx.fillStyle = ahora ? C.rosa : hecho ? "rgba(246,175,182,.45)" : "rgba(247,244,236,.22)";
    ctx.beginPath();
    ctx.arc(MARGEN + 16, y - 12, ahora ? 12 : 8, 0, Math.PI * 2);
    ctx.fill();

    if (i < pasos.length - 1) ctx.fillRect(MARGEN + 14, y + 2, 4, salto - 26);

    ctx.fillStyle = ahora ? C.crema : "rgba(247,244,236,.55)";
    fuente(ctx, ahora ? 42 : 36, ahora ? 700 : 600);
    textoEspaciado(ctx, paso.texto.toUpperCase(), MARGEN + 50, y, 1);
  });
}

/** Una barra por acción, como las historias: la que se ve, llenándose. */
function pintaBarras(ctx: Ctx, orden: number, total: number, avance: number) {
  const hueco = 10;
  const ancho = (W - MARGEN * 2 - hueco * (total - 1)) / total;

  for (let k = 0; k < total; k += 1) {
    const x = MARGEN + k * (ancho + hueco);

    ctx.fillStyle = "rgba(247,244,236,.25)";
    rectRedondo(ctx, x, 28, ancho, 8, 4);
    ctx.fill();

    const lleno = k < orden ? 1 : k === orden ? avance : 0;

    if (lleno > 0) {
      ctx.fillStyle = C.crema;
      rectRedondo(ctx, x, 28, Math.max(8, ancho * lleno), 8, 4);
      ctx.fill();
    }
  }
}

/**
 * Lo que hace ÉL en cada momento (expertos de fútbol y vídeo, 27/10/2026):
 * el rótulo no sólo dice en qué punto va la jugada, sino su tarea ahí.
 */
function tareaEn(t: number, accion: CometidoAccion) {
  const defiende = accion.lado === "defensivo";
  const marca = defiende && accion.puestos.some((p) => /^marca/i.test(p.grupo) || /^marca/i.test(p.label));
  const momento = momentoDe(t);

  if (t >= 1) return defiende ? "Despeja y sal" : "Atento al rechace";
  if (momento === "Colocación") return defiende ? (marca ? "Pegado a tu hombre" : "Tu zona") : "Tu salida";
  if (momento === "Movimientos previos") return defiende ? (marca ? "Lado de portería" : "Atento al balón") : "Arranca con la señal";
  if (momento === "El balón en el aire") return defiende ? (marca ? "No le pierdas" : "Ataca el balón") : "Ataca tu zona";
  if (momento === "Remate") return defiende ? "Gana el duelo" : "Gana el remate";

  return defiende ? "Despeja y sal" : "Atento al rechace";
}

/** El momento de la jugada y su tarea, abajo a la izquierda de la escena, como un rótulo de televisión. */
function pintaMomento(ctx: Ctx, t: number, accion?: CometidoAccion) {
  const momento = (t >= 1 ? "Final" : momentoDe(t)).toUpperCase();
  const tarea = accion ? tareaEn(t, accion).toUpperCase() : "";
  const y = ESCENA_Y + ESCENA_ALTO - 118;

  fuente(ctx, 30, 600);
  const anchoM = ctx.measureText(momento).width + 2 * (momento.length - 1) + 48;
  fuente(ctx, 46, 700);
  const anchoT = tarea ? ctx.measureText(tarea).width + 2 * (tarea.length - 1) + 48 : 0;

  ctx.fillStyle = "rgba(11,15,20,.85)";
  ctx.fillRect(MARGEN - 24, y, anchoM, 44);
  ctx.fillStyle = C.crema;
  ctx.textAlign = "left";
  fuente(ctx, 30, 600);
  textoEspaciado(ctx, momento, MARGEN, y + 33, 2);

  if (tarea) {
    ctx.fillStyle = C.rosa;
    ctx.fillRect(MARGEN - 24, y + 44, anchoT, 66);
    ctx.fillStyle = C.navy;
    fuente(ctx, 46, 700);
    textoEspaciado(ctx, tarea, MARGEN, y + 94, 2);
  }
}

/* ------------------------------ el vídeo ------------------------------ */

export async function videoJugador(opciones: {
  cx: ContextoJugador;
  retrato: HTMLImageElement | null;
  acciones: CometidoAccion[];
  /** La jugada `accion` en el instante `t` (0 → 1), cuadrada. */
  escena: (accion: number, t: number) => Promise<CanvasImageSource>;
  alProgreso?: (fraccion: number) => void;
}): Promise<Blob> {
  const { cx, retrato, acciones, escena, alProgreso } = opciones;

  const caudal = Math.min(CAUDAL, Math.floor((TOPE_BYTES * 8 * 0.92) / duracionVideoJugador(acciones.length)));
  const codec = await codecLamina(W, H, caudal);

  if (!codec) throw new Error("Este navegador no sabe montar vídeo. Prueba con Chrome o Edge.");

  const { canvas, ctx } = lienzo();

  let fallo: Error | null = null;
  const muxor = new MuxorMp4();
  const codificador = new VideoEncoder({
    output: (trozo, metadatos) => {
      const descripcion = metadatos?.decoderConfig?.description;

      if (descripcion) muxor.configuraVideo({ ancho: W, alto: H, descripcion: copiaBytes(descripcion) });

      const datos = new Uint8Array(new ArrayBuffer(trozo.byteLength));

      trozo.copyTo(datos);
      muxor.añadeVideo(datos as Bytes, Math.max(0, trozo.timestamp), trozo.duration || 1_000_000 / FPS, trozo.type === "key");
    },
    error: (e) => {
      fallo = e instanceof Error ? e : new Error(String(e));
    },
  });

  /*
   * El hueco en la cola del codificador, por su evento (ver arriba). El
   * temporizador es sólo la red: si el codificador se cae, no llega ningún
   * `dequeue` y sin él se quedaría esperando para siempre.
   */
  const hueco = () =>
    new Promise<void>((listo) => {
      const sigue = () => {
        clearTimeout(red);
        codificador.removeEventListener("dequeue", sigue);
        listo();
      };

      const red = setTimeout(sigue, 1000);

      codificador.addEventListener("dequeue", sigue);
    });

  try {
    codificador.configure({ codec, width: W, height: H, bitrate: caudal, framerate: FPS, latencyMode: "quality", avc: { format: "avc" } });

    let cuadros = 0;

    const emite = async () => {
      if (fallo) throw fallo;

      const cuadro = new VideoFrame(canvas, { timestamp: Math.round((cuadros * 1_000_000) / FPS), duration: Math.round(1_000_000 / FPS) });

      try {
        codificador.encode(cuadro, { keyFrame: cuadros % (FPS * 2) === 0 });
      } finally {
        cuadro.close();
      }

      cuadros += 1;

      while (codificador.encodeQueueSize > 4 && !fallo) await hueco();
    };

    const guion = guionAccion();
    const totales = Math.round(PORTADA_S * FPS) + guion.length * acciones.length;
    const avisa = () => alProgreso?.(cuadros / Math.max(1, totales));

    pintaPortada(ctx, cx, retrato, acciones.length);

    for (let k = 0; k < Math.round(PORTADA_S * FPS); k += 1) await emite();

    /* Lo último que se vio, para fundir la acción siguiente encima. */
    const anterior = lienzo();
    const fondo = lienzo();

    for (const [orden, accion] of acciones.entries()) {
      anterior.ctx.drawImage(canvas, 0, 0);
      fondo.ctx.clearRect(0, 0, W, H);
      const libre = pintaFondoAccion(fondo.ctx, accion, orden, acciones.length);

      let imagen: CanvasImageSource | null = null;
      let tPintado = -1;

      for (const [n, t] of guion.entries()) {
        if (t !== tPintado) {
          imagen = await escena(orden, t);
          tPintado = t;
        }

        ctx.drawImage(fondo.canvas, 0, 0);
        if (imagen) ctx.drawImage(imagen, 0, ESCENA_Y, W, ESCENA_ALTO);
        pintaMomento(ctx, t, accion);
        pintaPasos(ctx, t, accion, libre);
        pintaBarras(ctx, orden, acciones.length, (n + 1) / guion.length);

        if (n < FUNDIDO) {
          ctx.globalAlpha = 1 - (n + 1) / (FUNDIDO + 1);
          ctx.drawImage(anterior.canvas, 0, 0);
          ctx.globalAlpha = 1;
        }

        await emite();
        avisa();
      }
    }

    await codificador.flush();

    if (fallo) throw fallo;

    return muxor.cierra();
  } finally {
    /* Abierto a medias deja a Chrome sin codificadores para el siguiente. */
    if (codificador.state !== "closed") codificador.close();
  }
}

/** Las piezas del dibujo, para ver un fotograma sin montar el vídeo (arnés en Node). */
export const dibujoVideo = { pintaPortada, pintaFondoAccion, pintaPasos, pintaBarras, pintaMomento, ESCENA_Y, ESCENA_ALTO };
