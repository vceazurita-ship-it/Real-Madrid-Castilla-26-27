/*
|--------------------------------------------------------------------------
| EL VÍDEO RESUMEN DEL INFORME, MONTADO EN EL NAVEGADOR
|--------------------------------------------------------------------------
|
| Convierte un `GuionVideo` en un MP4 (H.264 + AAC) de menos de un minuto, en
| 1280×720 a 30 fps, sin servidor: la app vive en Vercel y una función no
| puede ni ver un vídeo ni aguantar un montaje. Es el mismo camino que el
| montaje del coding (`lib/coding/rapido.ts`): WebCodecs para codificar y el
| `MuxorMp4` propio para escribir el fichero. Ver [[coding-montaje-navegador]].
|
| La producción (12/10/2026, segunda vuelta):
|   - Un campo en 3D de verdad —proyección de cámara propia, sin librería—
|     que hace de plató en todas las escenas, con la cámara siempre en
|     movimiento lento. En la portada lleva los dos escudos; en «su once»,
|     las fichas con foto de cada jugador plantadas sobre el césped, y los que
|     hay que vigilar en oro.
|   - Cortes de acciones concretas del rival (los que preparó el analista en
|     Análisis visual, 720p en el bucket) con su rótulo, uno detrás de otro.
|   - Fotos en las fichas de «a vigilar», barras con el número contando,
|     láminas y gráficos con movimiento de cámara, barrido de luz en los
|     títulos, grano y viñeta de película.
|   - Sonido: la voz de Gemini (gratis) sobre una cama sintetizada aquí mismo
|     con WebAudio —un acorde grave muy bajo— y un soplo en cada cambio de
|     escena. No hay ningún fichero de música: nada que licenciar.
|
| Tres pasos, y los dos primeros pueden fallar sin que el vídeo deje de salir:
|   1. `/api/informe/video-guion` pule la locución (Gemini, sin coste).
|   2. `/api/informe/voz` la lee (Gemini TTS, sin coste) → PCM 24 kHz mono,
|      que se remuestrea a 48 kHz porque el AAC del navegador no admite otra.
|   3. Cada escena se pinta fotograma a fotograma y se codifica.
*/

import { MuxorMp4 } from "@/lib/coding/mp4";
import type { Bytes } from "@/lib/export/zip";

import { SEGUNDOS_MAXIMOS, type Corte, type Escena, type GuionVideo, type JugadorEscena } from "./guion";

const ANCHO = 1280;
const ALTO = 720;
const FPS = 30;
/** ~11 MB el minuto: cabe con el PDF dentro del tope de adjuntos del correo (16 MB). */
const CAUDAL = 1_500_000;
const CODEC = "avc1.4d401f"; /* H.264 Main 3.1: 1280×720 a 30 fps en cualquier aparato. */

const FONDO = "#08111F";
const ORO = "#C8A96B";
const BLANCO = "#FFFFFF";

/** Lo que dura cada escena si la voz no manda otra cosa, y cuánto aire se deja tras la locución. */
const SEGUNDOS: Record<Escena["tipo"], number> = { portada: 5.5, cifras: 7, claves: 8, barras: 7, once: 8, vigilar: 7, clips: 10, imagen: 7, cierre: 5.5 };
const AIRE = 0.7;

/** Las que se sacrifican primero si no cabe en el minuto, por este orden. */
const PRESCINDIBLES = ["abp", "duelo", "grafico-1", "lamina-1", "rival", "vigilar", "clips", "grafico-0", "lamina-0", "once", "cifras"];

export type PasoVideo = (texto: string) => void;

export type OpcionesVideo = {
  alPaso?: PasoVideo;
  /** La familia de la fuente del informe (Barlow Condensed de next/font lleva un nombre propio). */
  fuente?: string;
};

export function puedeMontarVideo() {
  return typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined" && typeof VideoFrame !== "undefined" && typeof document !== "undefined";
}

/* ------------------------------------------------------------------ */
/*  LA IA: LOCUCIÓN Y VOZ                                             */
/* ------------------------------------------------------------------ */

const conPlazo = <T,>(p: Promise<T>, ms: number, siNo: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(siNo), ms))]);

async function puleLocucion(guion: GuionVideo): Promise<GuionVideo> {
  const escenas = guion.escenas.map((e) => ({ id: e.id, texto: e.locucion, palabras: Math.ceil((e.tipo === "clips" ? e.segundos : SEGUNDOS[e.tipo]) * 2.4) }));

  const r = await conPlazo(
    fetch("/api/informe/video-guion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contexto: guion.titulo, escenas }) })
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null),
    15_000,
    null,
  );

  const lista = (r as { ok?: boolean; locuciones?: { id: string; texto: string }[] } | null)?.locuciones;

  if (!lista) return guion;

  const porId = new Map(lista.map((l) => [l.id, l.texto]));

  return { ...guion, escenas: guion.escenas.map((e) => ({ ...e, locucion: porId.get(e.id)?.trim() || e.locucion })) };
}

type Voz = { frecuencia: number; pistas: (Float32Array | null)[] };

/** La única frecuencia que el codificador AAC de Chrome acepta sin protestar (además de 44,1 kHz). */
const FRECUENCIA_AAC = 48_000;

/** Remuestreo lineal: para voz a 24 kHz → 48 kHz sobra, y no hace falta nada más. */
function remuestrea(pista: Float32Array, de: number, a: number): Float32Array {
  if (de === a) return pista;

  const n = Math.round((pista.length * a) / de);
  const salida = new Float32Array(n);
  const paso = de / a;

  for (let i = 0; i < n; i += 1) {
    const x = i * paso;
    const k = Math.floor(x);
    const f = x - k;
    const a0 = pista[k] ?? 0;
    const a1 = pista[k + 1] ?? a0;

    salida[i] = a0 + (a1 - a0) * f;
  }

  return salida;
}

/**
 * Los silencios de una pista: tramos de al menos `minimoMs` por debajo del
 * umbral, como [inicio, fin] en muestras.
 */
function silenciosDe(pista: Float32Array, frecuencia: number, minimoMs = 220, umbral = 0.012) {
  const ventana = Math.round(frecuencia * 0.02);
  const minimo = Math.round(minimoMs / 20);
  const silencios: [number, number][] = [];
  let seguidas = 0;

  for (let i = 0; i + ventana <= pista.length; i += ventana) {
    let energia = 0;

    for (let k = i; k < i + ventana; k += 1) energia += pista[k] * pista[k];

    if (Math.sqrt(energia / ventana) < umbral) seguidas += 1;
    else {
      if (seguidas >= minimo) silencios.push([i - seguidas * ventana, i]);

      seguidas = 0;
    }
  }

  if (seguidas >= minimo) silencios.push([pista.length - seguidas * ventana, pista.length]);

  return silencios;
}

/**
 * La voz llega ENTERA en una sola petición (la cuota gratuita del TTS no da
 * para una por escena) y aquí se parte: el corte de cada escena se predice
 * por la fracción de texto que lleva y se ajusta al silencio más cercano
 * (la pausa entre párrafos que se le pidió a la voz).
 */
async function pideVoz(guion: GuionVideo): Promise<{ voz: Voz | null; motivo?: string }> {
  const textos = guion.escenas.map((e) => e.locucion.replace(/\s+/g, " ").trim());

  const r = await conPlazo(
    fetch("/api/informe/voz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ textos }) }).catch(() => null),
    58_000,
    null,
  );

  if (!r) return { voz: null, motivo: "La IA de voz no ha contestado a tiempo." };

  if (!r.ok) {
    const j = (await r.json().catch(() => null)) as { error?: string } | null;

    return { voz: null, motivo: j?.error ?? `La IA de voz ha fallado (${r.status}).` };
  }

  const bytes = new Uint8Array(await r.arrayBuffer());
  const deFrecuencia = Number(r.headers.get("X-Voz-Frecuencia")) || 24_000;

  /* PCM de 16 bits con signo, little-endian → flotante [-1, 1], ya a la frecuencia del AAC. */
  const enteros = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const crudo = new Float32Array(enteros.length);

  for (let i = 0; i < enteros.length; i += 1) crudo[i] = enteros[i] / 32768;

  const entera = remuestrea(crudo, deFrecuencia, FRECUENCIA_AAC);

  if (entera.length < FRECUENCIA_AAC * 0.5) return { voz: null, motivo: "La IA de voz ha devuelto un audio vacío." };

  return { voz: { frecuencia: FRECUENCIA_AAC, pistas: reparteVoz(entera, textos, FRECUENCIA_AAC) } };
}

/** Parte la voz entera por escenas: corte previsto por la fracción de texto, ajustado al silencio más cercano. Exportado para probarlo en Node. */
export function reparteVoz(entera: Float32Array, textos: string[], frecuencia: number): (Float32Array | null)[] {
  /* Dónde empieza y acaba lo hablado, sin el aire de los extremos. */
  const silencios = silenciosDe(entera, frecuencia);
  const primero = silencios[0]?.[0] === 0 ? silencios[0][1] : 0;
  const ultimo = silencios.length && silencios[silencios.length - 1][1] === entera.length ? silencios[silencios.length - 1][0] : entera.length;
  const hablado = Math.max(1, ultimo - primero);

  const largos = textos.map((t) => t.length);
  const totalTexto = largos.reduce((s, n) => s + n, 0) || 1;
  const cortes: number[] = [primero];
  let acumulado = 0;

  for (let k = 0; k < textos.length - 1; k += 1) {
    acumulado += largos[k];

    const previsto = primero + Math.round((acumulado / totalTexto) * hablado);
    const margen = frecuencia * 1.6;

    /* El silencio más cercano al corte previsto, si hay uno a menos de 1,6 s; si no, el previsto tal cual. */
    let mejor = previsto;
    let distancia = Infinity;

    for (const [a, b] of silencios) {
      const centro = Math.round((a + b) / 2);
      const d = Math.abs(centro - previsto);

      if (centro > cortes[cortes.length - 1] && d < distancia && d <= margen) {
        mejor = centro;
        distancia = d;
      }
    }

    cortes.push(Math.max(cortes[cortes.length - 1], mejor));
  }

  cortes.push(ultimo);

  return textos.map((t, k) => (t && cortes[k + 1] > cortes[k] ? entera.slice(cortes[k], cortes[k + 1]) : null));
}

/* ------------------------------------------------------------------ */
/*  LA DURACIÓN DE CADA ESCENA                                         */
/* ------------------------------------------------------------------ */

type EscenaMedida = { escena: Escena; segundos: number; voz: Float32Array | null };

function reparte(guion: GuionVideo, voz: Voz | null): EscenaMedida[] {
  let lista: EscenaMedida[] = guion.escenas.map((escena, i) => {
    const pista = voz?.pistas[i] ?? null;
    const habla = pista ? pista.length / (voz?.frecuencia || FRECUENCIA_AAC) : 0;
    const base = escena.tipo === "clips" ? escena.segundos : SEGUNDOS[escena.tipo];

    /* Los cortes no se acortan por la voz: la acción tiene que verse entera. */
    const minimo = escena.tipo === "clips" ? base : 0;

    return { escena, voz: pista, segundos: Math.max(minimo, habla ? habla + AIRE : 0, pista ? Math.min(base, habla + AIRE + 1) : base) };
  });

  const total = () => lista.reduce((s, x) => s + x.segundos, 0);

  for (const id of PRESCINDIBLES) {
    if (total() <= SEGUNDOS_MAXIMOS) break;

    lista = lista.filter((x) => x.escena.id !== id);
  }

  if (total() > SEGUNDOS_MAXIMOS) {
    const factor = SEGUNDOS_MAXIMOS / total();

    lista = lista.map((x) => ({ ...x, segundos: x.segundos * factor }));
  }

  return lista;
}

/* ------------------------------------------------------------------ */
/*  EL CAMPO EN 3D                                                     */
/* ------------------------------------------------------------------ */

type Lienzo = CanvasRenderingContext2D;

type Punto3 = [number, number, number];

type Camara = { pos: Punto3; mira: Punto3; fov: number };

type Proyector = (X: number, Y: number, Z: number) => { x: number; y: number; d: number } | null;

const norm = (v: Punto3): Punto3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;

  return [v[0] / l, v[1] / l, v[2] / l];
};

const cruz = (a: Punto3, b: Punto3): Punto3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const punto = (a: Punto3, b: Punto3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Una cámara estenopeica: mundo en metros (x banda, y altura, z largo) → pantalla. */
function proyector(c: Camara): Proyector {
  const f = norm([c.mira[0] - c.pos[0], c.mira[1] - c.pos[1], c.mira[2] - c.pos[2]]);
  const r = norm(cruz(f, [0, 1, 0]));
  const u = cruz(r, f);
  const focal = ALTO / 2 / Math.tan((c.fov * Math.PI) / 360);

  return (X, Y, Z) => {
    const p: Punto3 = [X - c.pos[0], Y - c.pos[1], Z - c.pos[2]];
    const d = punto(p, f);

    if (d < 0.5) return null;

    return { x: ANCHO / 2 + (punto(p, r) * focal) / d, y: ALTO / 2 - (punto(p, u) * focal) / d, d };
  };
}

const LARGO = 105;
const ANCHO_CAMPO = 68;

function poligono(ctx: Lienzo, P: Proyector, puntos: Punto3[]) {
  let primero = true;

  for (const [X, Y, Z] of puntos) {
    const s = P(X, Y, Z);

    if (!s) continue;

    if (primero) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);

    primero = false;
  }
}

function circulo3(cx: number, cz: number, radio: number, desde = 0, hasta = Math.PI * 2): Punto3[] {
  const puntos: Punto3[] = [];
  const n = 40;

  for (let i = 0; i <= n; i += 1) {
    const a = desde + ((hasta - desde) * i) / n;

    puntos.push([cx + Math.cos(a) * radio, 0, cz + Math.sin(a) * radio]);
  }

  return puntos;
}

/** El campo entero: césped a franjas, líneas, áreas, círculo central y las dos porterías de pie. */
function pintaCampo(ctx: Lienzo, P: Proyector, brillo: number) {
  const mx = ANCHO_CAMPO / 2;
  const mz = LARGO / 2;

  /* Césped con franjas: cada franja es un cuadrilátero proyectado. */
  const franjas = 12;

  for (let i = 0; i < franjas; i += 1) {
    const z0 = -mz - 6 + ((LARGO + 12) * i) / franjas;
    const z1 = -mz - 6 + ((LARGO + 12) * (i + 1)) / franjas;

    ctx.beginPath();
    poligono(ctx, P, [
      [-mx - 8, 0, z0],
      [mx + 8, 0, z0],
      [mx + 8, 0, z1],
      [-mx - 8, 0, z1],
    ]);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? `rgba(22,70,42,${brillo})` : `rgba(18,60,36,${brillo})`;
    ctx.fill();
  }

  ctx.strokeStyle = `rgba(255,255,255,${0.55 * brillo})`;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";

  const traza = (puntos: Punto3[], cierra = false) => {
    ctx.beginPath();
    poligono(ctx, P, puntos);

    if (cierra) ctx.closePath();

    ctx.stroke();
  };

  traza(
    [
      [-mx, 0, -mz],
      [mx, 0, -mz],
      [mx, 0, mz],
      [-mx, 0, mz],
    ],
    true,
  );
  traza([
    [-mx, 0, 0],
    [mx, 0, 0],
  ]);
  traza(circulo3(0, 0, 9.15));

  for (const lado of [-1, 1]) {
    const fondo = mz * lado;
    const hacia = -lado;

    /* Área grande y pequeña. */
    traza([
      [-20.15, 0, fondo],
      [-20.15, 0, fondo + 16.5 * hacia],
      [20.15, 0, fondo + 16.5 * hacia],
      [20.15, 0, fondo],
    ]);
    traza([
      [-9.15, 0, fondo],
      [-9.15, 0, fondo + 5.5 * hacia],
      [9.15, 0, fondo + 5.5 * hacia],
      [9.15, 0, fondo],
    ]);

    /* El arco del área: la parte del círculo de 9,15 m desde el punto de penalti que queda fuera del área. */
    const pen = fondo + 11 * hacia;
    const ang = Math.acos(5.5 / 9.15);

    traza(circulo3(0, pen, 9.15, lado > 0 ? Math.PI + ang : ang, lado > 0 ? Math.PI * 2 - ang : Math.PI - ang));

    const sp = P(0, 0, pen);

    if (sp) {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, Math.max(1.5, 60 / sp.d), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * brillo})`;
      ctx.fill();
    }

    /* La portería, de pie: dos postes, el larguero y la red insinuada. */
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * brillo})`;
    ctx.lineWidth = 3;
    traza([
      [-3.66, 0, fondo],
      [-3.66, 2.44, fondo],
      [3.66, 2.44, fondo],
      [3.66, 0, fondo],
    ]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * brillo})`;
    traza([
      [-3.66, 2.44, fondo],
      [-3.66, 0, fondo + 2 * -hacia],
      [3.66, 0, fondo + 2 * -hacia],
      [3.66, 2.44, fondo],
    ]);
    ctx.strokeStyle = `rgba(255,255,255,${0.55 * brillo})`;
    ctx.lineWidth = 2;
  }
}

/** La cámara de cada escena, con un movimiento lento que la mantiene viva. */
function camaraDe(tipo: Escena["tipo"], t: number, global: number): Camara {
  const respira = Math.sin(global * 0.35) * 2;

  /* El once: alta y encima de nuestra portería, con el campo llenando el cuadro (medido: el fondo rival a y≈190 y nuestra línea fuera por abajo). */
  if (tipo === "once") return { pos: [respira * 0.6, 70 + t * 0.3, -115 + t], mira: [0, 0, 0], fov: 36 };

  if (tipo === "portada" || tipo === "cierre") return { pos: [-40 + t * 2.5, 44, -118 + respira], mira: [6, 0, 8], fov: 48 };

  /* El resto: el campo de fondo, bajo y de lado, apagado. */
  return { pos: [-95 + global * 0.6, 34, -92 + respira], mira: [10, 0, 10], fov: 50 };
}

/* ------------------------------------------------------------------ */
/*  EL ACABADO: GRANO, VIÑETA, BARRIDO                                 */
/* ------------------------------------------------------------------ */

function lienzoDeGrano() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(256, 256);

  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 90;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }

  g.putImageData(img, 0, 0);

  return c;
}

function acabado(ctx: Lienzo, grano: HTMLCanvasElement, progreso: number, titulo: string, fuente: string) {
  /* Viñeta. */
  const v = ctx.createRadialGradient(ANCHO / 2, ALTO / 2, ALTO * 0.35, ANCHO / 2, ALTO / 2, ALTO * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  /* Grano de película: la misma placa, movida al azar cada fotograma. */
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.globalCompositeOperation = "overlay";
  const ox = Math.floor(Math.random() * 256);
  const oy = Math.floor(Math.random() * 256);

  for (let x = -ox; x < ANCHO; x += 256) for (let y = -oy; y < ALTO; y += 256) ctx.drawImage(grano, x, y);

  ctx.restore();

  /* El rótulo de la esquina y la barra del minuto. */
  ctx.fillStyle = ORO;
  ctx.fillRect(56, 48, 42, 4);
  ctx.font = `600 20px ${fuente}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(`REAL MADRID CASTILLA · ${titulo.toUpperCase()}`, 110, 56);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, ALTO - 6, ANCHO, 6);
  ctx.fillStyle = ORO;
  ctx.fillRect(0, ALTO - 6, ANCHO * progreso, 6);
}

/* ------------------------------------------------------------------ */
/*  LOS ELEMENTOS DE TEXTO                                             */
/* ------------------------------------------------------------------ */

const suave = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

/** Una entrada con rebote: pasa de 1 y vuelve. */
const rebota = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));

/** Progreso 0→1 de una entrada que empieza en `desde` s y dura `cuanto` s. */
const entra = (t: number, desde: number, cuanto = 0.45) => suave((t - desde) / cuanto);

function parteLineas(ctx: Lienzo, texto: string, anchoMax: number) {
  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let actual = "";

  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;

    if (ctx.measureText(prueba).width > anchoMax && actual) {
      lineas.push(actual);
      actual = p;
    } else actual = prueba;
  }

  if (actual) lineas.push(actual);

  return lineas;
}

/** Título con barrido de luz: una banda clara que lo cruza una vez. */
function titular(ctx: Lienzo, fuente: string, texto: string, t: number, y = 150, tam = 54) {
  const a = entra(t, 0.05);
  const x = 56 + (1 - a) * -30;
  const mayus = texto.toUpperCase();

  ctx.font = `700 ${tam}px ${fuente}`;
  ctx.globalAlpha = a;
  ctx.fillStyle = BLANCO;
  ctx.fillText(mayus, x, y);

  const ancho = ctx.measureText(mayus).width;
  const barrido = (t - 0.3) / 0.9;

  if (barrido > 0 && barrido < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y - tam, ancho, tam * 1.25);
    ctx.clip();
    const bx = x - 160 + (ancho + 320) * barrido;
    const g = ctx.createLinearGradient(bx - 120, 0, bx + 120, 0);
    g.addColorStop(0, "rgba(200,169,107,0)");
    g.addColorStop(0.5, "rgba(230,205,150,0.85)");
    g.addColorStop(1, "rgba(200,169,107,0)");
    ctx.fillStyle = g;
    ctx.fillText(mayus, x, y);
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

/** La locución, escrita abajo: quien lo vea sin sonido lee lo mismo que se dice. */
function pieLocucion(ctx: Lienzo, fuente: string, texto: string, t: number) {
  const a = entra(t, 0.3, 0.6);

  ctx.globalAlpha = a * 0.85;
  ctx.font = `400 24px ${fuente}`;
  ctx.fillStyle = BLANCO;

  const lineas = parteLineas(ctx, texto, ANCHO - 112).slice(0, 2);

  lineas.forEach((l, i) => ctx.fillText(l, 56, ALTO - 62 + i * 30 - (lineas.length - 1) * 30));
  ctx.globalAlpha = 1;
}

/** Un rótulo bajo («lower third») con la barra de oro. */
function rotuloBajo(ctx: Lienzo, fuente: string, principal: string, secundario: string, t: number, y = ALTO - 150) {
  const a = entra(t, 0.15, 0.5);

  if (a <= 0) return;

  ctx.font = `700 34px ${fuente}`;
  const w1 = ctx.measureText(principal).width;
  ctx.font = `500 22px ${fuente}`;
  const w2 = secundario ? ctx.measureText(secundario).width : 0;
  const w = Math.min(Math.max(w1, w2) + 60, ANCHO - 112);
  const alto = secundario ? 84 : 58;

  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(8,17,31,0.75)";
  ctx.fillRect(56, y - 40, w * a, alto);
  ctx.fillStyle = ORO;
  ctx.fillRect(56, y - 40, 8, alto);
  ctx.fillStyle = BLANCO;
  ctx.font = `700 34px ${fuente}`;
  ctx.fillText(principal, 84, y + 2 - (1 - a) * 10);

  if (secundario) {
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = `500 22px ${fuente}`;
    ctx.fillText(secundario, 84, y + 32 - (1 - a) * 10);
  }

  ctx.globalAlpha = 1;
}

/** Una foto o escudo recortados en círculo, con un aro; sin imagen, el texto (dorsal o siglas). */
function medallon(ctx: Lienzo, fuente: string, img: ImageBitmap | null, cx: number, cy: number, radio: number, aro: string, texto: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.clip();

  if (img) {
    const k = Math.max((radio * 2) / img.width, (radio * 2) / img.height);
    ctx.drawImage(img, cx - (img.width * k) / 2, cy - (img.height * k) / 2, img.width * k, img.height * k);
  } else {
    ctx.fillStyle = BLANCO;
    ctx.font = `700 ${Math.round(radio * 0.9)}px ${fuente}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, cx, cy);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, radio * 0.09);
  ctx.strokeStyle = aro;
  ctx.stroke();
}

/* ------------------------------------------------------------------ */
/*  LAS ESCENAS                                                        */
/* ------------------------------------------------------------------ */

type Recursos = { imagenes: Map<string, ImageBitmap | null>; clips: Map<string, { video: HTMLVideoElement; desde: number } | null> };

function pintaPortada(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "portada" }>, rec: Recursos, t: number) {
  /* Los dos escudos frente a frente. */
  const a = entra(t, 0.2, 0.7);
  const nos = rec.imagenes.get(`${e.id}:nosotros`) ?? null;
  const riv = rec.imagenes.get(`${e.id}:rival`) ?? null;
  const cy = 250;

  ctx.globalAlpha = a;
  medallon(ctx, fuente, nos, ANCHO / 2 - 150 - (1 - a) * 60, cy, 76, "rgba(255,255,255,0.7)", "RM");
  medallon(ctx, fuente, riv, ANCHO / 2 + 150 + (1 - a) * 60, cy, 76, ORO, e.titulo.slice(0, 3).toUpperCase());
  ctx.fillStyle = ORO;
  ctx.font = `700 40px ${fuente}`;
  ctx.textAlign = "center";
  ctx.fillText("VS", ANCHO / 2, cy + 14);
  ctx.globalAlpha = 1;

  const b = entra(t, 0.5, 0.6);

  ctx.globalAlpha = b;
  ctx.fillStyle = ORO;
  ctx.font = `700 26px ${fuente}`;
  ctx.fillText(e.sello, ANCHO / 2, 392 + (1 - b) * 20);
  ctx.fillStyle = BLANCO;
  ctx.font = `700 86px ${fuente}`;

  const lineas = parteLineas(ctx, e.titulo.toUpperCase(), ANCHO - 160).slice(0, 2);

  lineas.forEach((l, i) => ctx.fillText(l, ANCHO / 2, 490 + i * 90 + (1 - b) * 30));

  const c = entra(t, 0.9, 0.6);

  ctx.globalAlpha = c * 0.75;
  ctx.font = `400 28px ${fuente}`;
  ctx.fillText(e.subtitulo, ANCHO / 2, 500 + lineas.length * 90 - 40);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

function pintaClaves(ctx: Lienzo, fuente: string, titulo: string, lineas: string[], t: number) {
  titular(ctx, fuente, titulo, t);

  lineas.slice(0, 4).forEach((linea, i) => {
    const a = entra(t, 0.4 + i * 0.35, 0.5);

    ctx.globalAlpha = a;
    ctx.fillStyle = ORO;
    ctx.fillRect(56, 215 + i * 92, 8, 48);
    ctx.fillStyle = BLANCO;
    ctx.font = `500 34px ${fuente}`;

    const partes = parteLineas(ctx, linea, ANCHO - 170).slice(0, 2);

    partes.forEach((p, k) => ctx.fillText(p, 90 + (1 - a) * 30, 236 + i * 92 + k * 38 + (partes.length === 1 ? 10 : 0)));
    ctx.globalAlpha = 1;
  });
}

function pintaCifras(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "cifras" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const n = Math.min(4, e.cifras.length);
  const ancho = (ANCHO - 112 - (n - 1) * 20) / n;

  e.cifras.slice(0, 4).forEach((c, i) => {
    const a = entra(t, 0.4 + i * 0.3, 0.5);
    const x = 56 + i * (ancho + 20);
    const dy = (1 - a) * 30;

    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(8,17,31,0.7)";
    ctx.fillRect(x, 210 + dy, ancho, 300);
    ctx.fillStyle = ORO;
    ctx.fillRect(x, 210 + dy, ancho * a, 4);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `600 20px ${fuente}`;
    ctx.fillText(c.rotulo.toUpperCase(), x + 20, 254 + dy);
    ctx.fillStyle = BLANCO;

    const largo = c.valor.length > 12;

    ctx.font = `700 ${largo ? 30 : 64}px ${fuente}`;
    parteLineas(ctx, c.valor, ancho - 40)
      .slice(0, largo ? 5 : 2)
      .forEach((l, k) => ctx.fillText(l, x + 20, (largo ? 300 : 330) + k * (largo ? 36 : 66) + dy));

    if (c.pie) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `400 20px ${fuente}`;
      parteLineas(ctx, c.pie, ancho - 40)
        .slice(0, 2)
        .forEach((l, k) => ctx.fillText(l, x + 20, 460 + k * 24 + dy));
    }

    ctx.globalAlpha = 1;
  });
}

function pintaBarras(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "barras" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const maximo = Math.max(0.01, ...e.barras.map((b) => b.valor));
  const largo = ANCHO - 356 - 220;

  e.barras.slice(0, 4).forEach((b, i) => {
    const a = entra(t, 0.4 + i * 0.25, 0.9);
    const y = 220 + i * 80;
    const destacada = i === e.barras.length - 1 && e.barras.length > 3;

    ctx.globalAlpha = entra(t, 0.3 + i * 0.25, 0.4);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `600 26px ${fuente}`;
    ctx.fillText(b.rotulo.toUpperCase(), 56, y + 8);
    ctx.fillStyle = "rgba(8,17,31,0.6)";
    ctx.fillRect(300, y - 18, largo, 36);
    const g = ctx.createLinearGradient(300, 0, 300 + largo, 0);
    g.addColorStop(0, destacada ? "#E3C98F" : "rgba(200,169,107,0.55)");
    g.addColorStop(1, destacada ? ORO : "rgba(200,169,107,0.95)");
    ctx.fillStyle = g;
    ctx.fillRect(300, y - 18, largo * (b.valor / maximo) * a, 36);

    /* El número cuenta hasta su valor. */
    const num = b.texto.match(/^(\d+)(.*)$/);
    ctx.fillStyle = BLANCO;
    ctx.font = `700 30px ${fuente}`;
    ctx.fillText(num ? `${Math.round(Number(num[1]) * a)}${num[2]}` : b.texto, ANCHO - 56 - 200, y + 10);
    ctx.globalAlpha = 1;
  });
}

function pintaImagen(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "imagen" }>, img: ImageBitmap | null, t: number, dur: number) {
  titular(ctx, fuente, e.titulo, t, 120, 40);

  if (img) {
    const a = entra(t, 0.3, 0.6);
    const cajaW = ANCHO - 112;
    const cajaH = ALTO - 120 - 130;
    const k = Math.min(cajaW / img.width, cajaH / img.height);
    const w = img.width * k;
    const h = img.height * k;
    const x = 56 + (cajaW - w) / 2;
    const y = 140 + (1 - a) * 20;

    /* Movimiento de cámara lento sobre la imagen: acerca un 8 % y se desliza. */
    const z = 1 + 0.08 * (t / dur);
    const px = (t / dur) * 0.04;

    ctx.globalAlpha = a;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x - w * (z - 1) * (0.5 + px), y - h * (z - 1) * 0.5, w * z, h * z);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function pintaOnce(ctx: Lienzo, fuente: string, P: Proyector, e: Extract<Escena, { tipo: "once" }>, rec: Recursos, t: number) {
  titular(ctx, fuente, e.titulo, t, 120, 44);

  /* Los más lejos se pintan antes, para que los de delante tapen. */
  const colocados = e.jugadores
    .map((j, i) => {
      const X = (j.x - 0.5) * ANCHO_CAMPO * 0.92;
      const Z = 52.5 - j.y * 95 - 4;
      const s = P(X, 0, Z);

      return s ? { j, i, s } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.s.d - a.s.d);

  for (const { j, i, s } of colocados) {
    const a = rebota((t - 0.5 - i * 0.11) / 0.4);

    if (a <= 0) continue;

    /* La ficha mide más que un jugador (3,2 m): a 90-180 m de cámara salen 20-40 px, que es lo que se lee. */
    const radio = Math.max(16, (3500 / s.d) * a);

    /* Sombra en el suelo y la ficha de pie sobre ella. */
    ctx.globalAlpha = 0.45 * Math.min(1, a);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, radio * 0.9, radio * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, a);

    const cy = s.y - radio * 1.15;

    medallon(ctx, fuente, rec.imagenes.get(`${e.id}:${i}`) ?? null, s.x, cy, radio, j.destacado ? ORO : "rgba(255,255,255,0.85)", j.dorsal || "·");

    /* El apellido en una pastilla debajo. */
    const tam = Math.max(13, radio * 0.45);
    ctx.font = `700 ${tam}px ${fuente}`;
    ctx.textAlign = "center";
    const nombre = j.nombre.split(" ").slice(-1)[0].toUpperCase();
    const w = ctx.measureText(nombre).width + tam;
    ctx.fillStyle = j.destacado ? ORO : "rgba(8,17,31,0.8)";
    ctx.fillRect(s.x - w / 2, s.y + 4, w, tam * 1.4);
    ctx.fillStyle = j.destacado ? "#0B0F14" : BLANCO;
    ctx.fillText(nombre, s.x, s.y + 4 + tam * 1.05);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  const destacados = e.jugadores.filter((j) => j.destacado).map((j) => j.nombre);

  if (destacados.length) rotuloBajo(ctx, fuente, "A vigilar", destacados.join(" · "), t - 1.4, ALTO - 110);
}

function pintaVigilar(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "vigilar" }>, rec: Recursos, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const n = Math.min(3, e.jugadores.length);
  const ancho = (ANCHO - 112 - (n - 1) * 24) / n;

  e.jugadores.slice(0, 3).forEach((j, i) => {
    const a = entra(t, 0.4 + i * 0.3, 0.6);
    const x = 56 + i * (ancho + 24);
    const dy = (1 - a) * 40;

    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(8,17,31,0.72)";
    ctx.fillRect(x, 200 + dy, ancho, 330);
    ctx.fillStyle = j.destacado ? ORO : "rgba(255,255,255,0.35)";
    ctx.fillRect(x, 200 + dy, ancho, 4);
    medallon(ctx, fuente, rec.imagenes.get(`${e.id}:${i}`) ?? null, x + ancho / 2, 290 + dy, 62, j.destacado ? ORO : "rgba(255,255,255,0.7)", j.dorsal || "·");
    ctx.textAlign = "center";
    ctx.fillStyle = BLANCO;
    ctx.font = `700 30px ${fuente}`;
    ctx.fillText(j.nombre.toUpperCase(), x + ancho / 2, 392 + dy);
    ctx.fillStyle = ORO;
    ctx.font = `600 18px ${fuente}`;
    ctx.fillText([j.dorsal ? `#${j.dorsal}` : "", j.posicion].filter(Boolean).join(" · "), x + ancho / 2, 420 + dy);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `400 21px ${fuente}`;
    parteLineas(ctx, j.texto ?? "", ancho - 40)
      .slice(0, 3)
      .forEach((l, k) => ctx.fillText(l, x + ancho / 2, 458 + k * 26 + dy));
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  });
}

function pintaClips(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "clips" }>, rec: Recursos, t: number, dur: number) {
  const porCorte = dur / Math.max(1, e.cortes.length);
  const k = Math.min(e.cortes.length - 1, Math.floor(t / porCorte));
  const tc = t - k * porCorte;
  const clip = rec.clips.get(`${e.id}:${k}`) ?? null;

  if (clip && clip.video.videoWidth) {
    const esc = Math.max(ANCHO / clip.video.videoWidth, ALTO / clip.video.videoHeight) * (1 + 0.03 * (tc / porCorte));
    const w = clip.video.videoWidth * esc;
    const h = clip.video.videoHeight * esc;

    ctx.drawImage(clip.video, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
  }

  const g = ctx.createLinearGradient(0, ALTO * 0.5, 0, ALTO);
  g.addColorStop(0, "rgba(8,17,31,0)");
  g.addColorStop(1, "rgba(8,17,31,0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  /* Fundido corto entre cortes. */
  const borde = Math.min(tc / 0.25, (porCorte - tc) / 0.25);

  if (borde < 1) {
    ctx.fillStyle = `rgba(8,17,31,${1 - Math.max(0, borde)})`;
    ctx.fillRect(0, 0, ANCHO, ALTO);
  }

  titular(ctx, fuente, e.titulo, t, 110, 34);

  const [principal, ...resto] = e.cortes[k].rotulo.split(" · ");

  rotuloBajo(ctx, fuente, principal, resto.join(" · "), tc, ALTO - 140);

  /* Los puntos de «cuál de cuántos». */
  e.cortes.forEach((_, i) => {
    ctx.fillStyle = i === k ? ORO : "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(ANCHO - 70 - (e.cortes.length - 1 - i) * 18, ALTO - 36, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function pintaCierre(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "cierre" }>, t: number) {
  /* Un velo oscuro por la izquierda, que el texto no pelee con las líneas del campo. */
  const velo = ctx.createLinearGradient(0, 0, ANCHO * 0.8, 0);
  velo.addColorStop(0, "rgba(8,17,31,0.85)");
  velo.addColorStop(1, "rgba(8,17,31,0)");
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  const a = entra(t, 0.1, 0.6);

  ctx.globalAlpha = a;
  ctx.fillStyle = ORO;
  ctx.font = `700 26px ${fuente}`;
  ctx.fillText(e.titulo.toUpperCase(), 56, 240);
  ctx.globalAlpha = 1;

  const b = entra(t, 0.4, 0.7);

  ctx.globalAlpha = b;
  ctx.fillStyle = BLANCO;
  ctx.font = `700 54px ${fuente}`;

  let y = 320;

  for (const linea of e.lineas.slice(0, 2)) {
    for (const l of parteLineas(ctx, linea, ANCHO - 112).slice(0, 2)) {
      ctx.fillText(l, 56 + (1 - b) * -30, y);
      y += 62;
    }
  }

  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/*  LOS RECURSOS DE CADA ESCENA                                         */
/* ------------------------------------------------------------------ */

async function cargaImagen(src: string): Promise<ImageBitmap | null> {
  if (!src) return null;

  try {
    const r = await conPlazo(fetch(src), 8000, null);

    if (!r || !r.ok) return null;

    return await createImageBitmap(await r.blob());
  } catch {
    return null;
  }
}

/**
 * Un `<video>` del bucket listo para pedirle fotogramas. `null` si no se
 * puede abrir (CORS, códec, enlace de YouTube): la escena sale con su texto
 * sobre el fondo y nadie se entera de que faltó.
 */
async function abreClip(url: string, segundos: number): Promise<{ video: HTMLVideoElement; desde: number } | null> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  video.src = url;

  const listo = await conPlazo(
    new Promise<boolean>((r) => {
      video.addEventListener("loadeddata", () => r(true), { once: true });
      video.addEventListener("error", () => r(false), { once: true });
    }),
    8000,
    false,
  );

  if (!listo || !video.videoWidth || !Number.isFinite(video.duration)) return null;

  /* Un corte de scouting suele llevar la acción en el centro; un vídeo largo, pasada la carátula. */
  const desde = video.duration <= segundos + 1 ? 0 : Math.max(0, Math.min(video.duration - segundos, video.duration * (video.duration < 30 ? 0.5 : 0.35) - segundos / 2));

  /* Si el fotograma no se puede leer por CORS, `getImageData` revienta: se comprueba una vez. */
  try {
    const c = document.createElement("canvas");
    c.width = 2;
    c.height = 2;
    const prueba = c.getContext("2d")!;
    prueba.drawImage(video, 0, 0, 2, 2);
    prueba.getImageData(0, 0, 1, 1);
  } catch {
    return null;
  }

  return { video, desde };
}

async function buscaFotograma(video: HTMLVideoElement, segundo: number) {
  if (Math.abs(video.currentTime - segundo) < 1 / FPS / 2) return;

  await conPlazo(
    new Promise<void>((r) => {
      video.addEventListener("seeked", () => r(), { once: true });
      video.currentTime = Math.min(segundo, Math.max(0, video.duration - 0.05));
    }),
    600,
    undefined,
  );
}

/* ------------------------------------------------------------------ */
/*  LA CAMA DE SONIDO                                                  */
/* ------------------------------------------------------------------ */

/**
 * Un acorde grave, muy bajo, que respira; y un soplo de aire en cada cambio
 * de escena. Se sintetiza aquí: no hay fichero de música ni nada que
 * licenciar. Si WebAudio no está, el vídeo va sólo con la voz.
 */
async function camaDeSonido(total: number, cortes: number[]): Promise<Float32Array | null> {
  try {
    const n = Math.ceil(total * FRECUENCIA_AAC);
    const ac = new OfflineAudioContext(1, n, FRECUENCIA_AAC);
    const salida = ac.createGain();
    salida.gain.setValueAtTime(0, 0);
    salida.gain.linearRampToValueAtTime(1, 2);
    salida.gain.setValueAtTime(1, Math.max(2, total - 2.5));
    salida.gain.linearRampToValueAtTime(0, total);
    salida.connect(ac.destination);

    const filtro = ac.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 420;
    filtro.Q.value = 0.8;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filtro.frequency);
    lfo.start();
    const pad = ac.createGain();
    pad.gain.value = 0.03;
    filtro.connect(pad).connect(salida);

    for (const [hz, tipo, nivel] of [
      [55, "sine", 0.9],
      [110, "triangle", 0.5],
      [164.81, "sine", 0.35],
      [220, "sine", 0.25],
      [329.63, "sine", 0.12],
    ] as [number, OscillatorType, number][]) {
      const o = ac.createOscillator();
      o.type = tipo;
      o.frequency.value = hz;
      o.detune.value = (Math.random() - 0.5) * 6;
      const g = ac.createGain();
      g.gain.value = nivel;
      o.connect(g).connect(filtro);
      o.start();
    }

    /* El soplo: ruido blanco por un paso de banda, que se apaga en 0,35 s. */
    const ruido = ac.createBuffer(1, Math.round(FRECUENCIA_AAC * 0.4), FRECUENCIA_AAC);
    const d = ruido.getChannelData(0);

    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;

    for (const t of cortes) {
      const s = ac.createBufferSource();
      s.buffer = ruido;
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1400;
      bp.Q.value = 0.6;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      s.connect(bp).connect(g).connect(salida);
      s.start(t);
    }

    const buffer = await ac.startRendering();

    return buffer.getChannelData(0);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  EL MONTAJE                                                         */
/* ------------------------------------------------------------------ */

function copia(fuente: AllowSharedBufferSource): Bytes {
  const vista = ArrayBuffer.isView(fuente) ? new Uint8Array(fuente.buffer as ArrayBuffer, fuente.byteOffset, fuente.byteLength) : new Uint8Array(fuente as ArrayBuffer);
  const salida = new Uint8Array(new ArrayBuffer(vista.byteLength)) as Bytes;

  salida.set(vista);

  return salida;
}

const respira = () => new Promise<void>((r) => setTimeout(r, 0));

export type VideoMontado = { blob: Blob; segundos: number; conVoz: boolean; escenas: number; /** Por qué va sin voz, si va sin ella. */ motivoSinVoz?: string };

/** Monta el vídeo resumen de un guion. `alPaso` recibe el texto de progreso para la pantalla. */
export async function montaVideoInforme(guionCrudo: GuionVideo, opciones: OpcionesVideo = {}): Promise<VideoMontado> {
  if (!puedeMontarVideo()) throw new Error("Este navegador no puede montar vídeo (hace falta Chrome, Edge o Safari 17).");

  const alPaso = opciones.alPaso ?? (() => {});
  const fuente = `${opciones.fuente ? `${opciones.fuente}, ` : ""}"Barlow Condensed", "Segoe UI", Arial, sans-serif`;

  alPaso("guion…");
  const guion = await puleLocucion(guionCrudo);

  alPaso("voz…");
  const { voz, motivo: motivoSinVoz } = await pideVoz(guion);
  const escenas = reparte(guion, voz);
  const total = escenas.reduce((s, x) => s + x.segundos, 0);

  /* Recursos por adelantado: escudos, fotos, láminas y los cortes del rival. */
  alPaso("fotos y cortes…");
  const rec: Recursos = { imagenes: new Map(), clips: new Map() };

  await Promise.all(
    escenas.map(async ({ escena: e, segundos }) => {
      if (e.tipo === "imagen") rec.imagenes.set(e.id, await cargaImagen(e.src));
      else if (e.tipo === "portada") {
        rec.imagenes.set(`${e.id}:nosotros`, await cargaImagen(e.escudoNosotros ?? ""));
        rec.imagenes.set(`${e.id}:rival`, await cargaImagen(e.escudoRival ?? ""));
      } else if (e.tipo === "once" || e.tipo === "vigilar") {
        await Promise.all(e.jugadores.map(async (j: JugadorEscena, i: number) => rec.imagenes.set(`${e.id}:${i}`, await cargaImagen(j.foto))));
      } else if (e.tipo === "clips") {
        await Promise.all(e.cortes.map(async (c: Corte, i: number) => rec.clips.set(`${e.id}:${i}`, await abreClip(c.url, segundos / e.cortes.length))));
      }
    }),
  );

  if ("fonts" in document) {
    try {
      await conPlazo<unknown>(Promise.all([document.fonts.load(`700 60px ${fuente}`), document.fonts.load(`400 24px ${fuente}`)]), 2000, null);
    } catch {
      /* Con la fuente del sistema vale. */
    }
  }

  /* ---- codificadores y muxor ---- */
  const muxor = new MuxorMp4();
  let fallo: Error | null = null;

  const codificador = new VideoEncoder({
    output: (trozo, metadatos) => {
      const descripcion = metadatos?.decoderConfig?.description;

      if (descripcion) muxor.configuraVideo({ ancho: ANCHO, alto: ALTO, descripcion: copia(descripcion) });

      const datos = new Uint8Array(trozo.byteLength) as Bytes;
      trozo.copyTo(datos);
      muxor.añadeVideo(datos, Math.max(0, trozo.timestamp), trozo.duration || 1_000_000 / FPS, trozo.type === "key");
    },
    error: (e) => {
      fallo = e instanceof Error ? e : new Error(String(e));
    },
  });

  codificador.configure({ codec: CODEC, width: ANCHO, height: ALTO, bitrate: CAUDAL, framerate: FPS, latencyMode: "quality", avc: { format: "avc" } });

  const frecuencia = FRECUENCIA_AAC;
  let enMuestras = 0;

  const sonido = new AudioEncoder({
    output: (trozo, metadatos) => {
      const descripcion = metadatos?.decoderConfig?.description;

      if (descripcion) muxor.configuraAudio({ frecuencia, canales: 1, descripcion: copia(descripcion) });

      const datos = new Uint8Array(trozo.byteLength) as Bytes;
      trozo.copyTo(datos);

      const cuantas = Math.round(((trozo.duration || 0) * frecuencia) / 1e6) || 1024;
      muxor.añadeAudio(datos, enMuestras, cuantas);
      enMuestras += cuantas;
    },
    error: (e) => {
      fallo = e instanceof Error ? e : new Error(String(e));
    },
  });

  sonido.configure({ codec: "mp4a.40.2", sampleRate: frecuencia, numberOfChannels: 1, bitrate: 96_000 });

  /* ---- la pista de sonido entera: la cama debajo, la voz de cada escena en su sitio ---- */
  alPaso("sonido…");
  const totalMuestras = Math.ceil(total * frecuencia);
  const pista = new Float32Array(totalMuestras);
  const arranques: number[] = [];
  let inicio = 0;

  for (const x of escenas) {
    arranques.push(inicio);
    inicio += x.segundos;
  }

  const cama = await camaDeSonido(total, arranques.slice(1));

  if (cama) pista.set(cama.subarray(0, totalMuestras));

  escenas.forEach((x, k) => {
    if (!x.voz) return;

    const desde = Math.floor(arranques[k] * frecuencia);

    for (let i = 0; i < x.voz.length && desde + i < totalMuestras; i += 1) pista[desde + i] = Math.max(-1, Math.min(1, pista[desde + i] + x.voz[i] * 0.95));
  });

  for (let i = 0; i < totalMuestras; i += 1024) {
    const n = Math.min(1024, totalMuestras - i);
    const datos = new AudioData({ format: "f32-planar", sampleRate: frecuencia, numberOfFrames: n, numberOfChannels: 1, timestamp: Math.round((i / frecuencia) * 1e6), data: pista.subarray(i, i + n) });

    sonido.encode(datos);
    datos.close();
  }

  /* ---- los fotogramas ---- */
  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d", { alpha: false })!;
  const grano = lienzoDeGrano();
  const totalFotogramas = Math.round(total * FPS);
  let fotograma = 0;

  for (const [k, x] of escenas.entries()) {
    alPaso(`escena ${k + 1}/${escenas.length}…`);

    const cuantos = k === escenas.length - 1 ? totalFotogramas - fotograma : Math.round(x.segundos * FPS);
    const e = x.escena;
    const conCampo = e.tipo === "portada" || e.tipo === "cierre" || e.tipo === "once";

    for (let i = 0; i < cuantos; i += 1) {
      if (fallo) throw fallo;

      const t = i / FPS;
      const global = arranques[k] + t;

      if (e.tipo === "clips") {
        const porCorte = x.segundos / Math.max(1, e.cortes.length);
        const c = Math.min(e.cortes.length - 1, Math.floor(t / porCorte));
        const clip = rec.clips.get(`${e.id}:${c}`);

        if (clip) await buscaFotograma(clip.video, clip.desde + (t - c * porCorte));
      }

      /* El plató: fondo, el campo en 3D y una luz dorada que respira. */
      ctx.fillStyle = FONDO;
      ctx.fillRect(0, 0, ANCHO, ALTO);

      if (e.tipo === "clips") pintaClips(ctx, fuente, e, rec, t, x.segundos);
      else {
        const P = proyector(camaraDe(e.tipo, t, global));

        pintaCampo(ctx, P, conCampo ? 1 : 0.42);

        if (!conCampo) {
          ctx.fillStyle = "rgba(8,17,31,0.62)";
          ctx.fillRect(0, 0, ANCHO, ALTO);
        }

        const g = ctx.createRadialGradient(ANCHO * 0.85, ALTO * 0.1, 0, ANCHO * 0.85, ALTO * 0.1, 700 + Math.sin(global * 0.8) * 40);
        g.addColorStop(0, "rgba(200,169,107,0.18)");
        g.addColorStop(1, "rgba(200,169,107,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, ANCHO, ALTO);

        if (e.tipo === "portada") pintaPortada(ctx, fuente, e, rec, t);
        else if (e.tipo === "claves") pintaClaves(ctx, fuente, e.titulo, e.lineas, t);
        else if (e.tipo === "cifras") pintaCifras(ctx, fuente, e, t);
        else if (e.tipo === "barras") pintaBarras(ctx, fuente, e, t);
        else if (e.tipo === "imagen") pintaImagen(ctx, fuente, e, rec.imagenes.get(e.id) ?? null, t, x.segundos);
        else if (e.tipo === "once") pintaOnce(ctx, fuente, P, e, rec, t);
        else if (e.tipo === "vigilar") pintaVigilar(ctx, fuente, e, rec, t);
        else pintaCierre(ctx, fuente, e, t);

        if (e.tipo === "claves" || e.tipo === "cifras" || e.tipo === "barras" || e.tipo === "imagen" || e.tipo === "vigilar") pieLocucion(ctx, fuente, e.locucion, t);
      }

      acabado(ctx, grano, fotograma / totalFotogramas, guion.titulo, fuente);

      /* Fundido entre escenas. */
      const restante = (cuantos - i) / FPS;
      const velo = Math.max(0, 1 - Math.min(t / 0.3, restante / 0.3));

      if (velo > 0) {
        ctx.fillStyle = `rgba(8,17,31,${velo})`;
        ctx.fillRect(0, 0, ANCHO, ALTO);
      }

      const marca = new VideoFrame(lienzo, { timestamp: Math.round((fotograma / FPS) * 1e6), duration: Math.round(1e6 / FPS) });

      codificador.encode(marca, { keyFrame: fotograma % (FPS * 2) === 0 });
      marca.close();
      fotograma += 1;

      /* Que el codificador no se ahogue y la pantalla pueda pintar el progreso. */
      while (codificador.encodeQueueSize > 8) await respira();
    }
  }

  alPaso("cerrando el vídeo…");
  await Promise.all([codificador.flush(), sonido.flush()]);
  codificador.close();
  sonido.close();

  for (const c of rec.clips.values()) {
    if (c) {
      c.video.pause();
      c.video.removeAttribute("src");
      c.video.load();
    }
  }

  for (const img of rec.imagenes.values()) img?.close();

  if (fallo) throw fallo;

  return { blob: muxor.cierra(), segundos: Math.round(total), conVoz: Boolean(voz?.pistas.some(Boolean)), escenas: escenas.length, motivoSinVoz };
}
