/*
|--------------------------------------------------------------------------
| EL DIBUJO DEL VÍDEO RESUMEN (VALE EN EL NAVEGADOR Y EN NODE)
|--------------------------------------------------------------------------
|
| Todo lo que se pinta —el campo en 3D, las escenas, los rótulos, el grano—
| vive aquí y sólo necesita un contexto 2D: en el navegador lo da un
| `<canvas>` (`monta.ts`) y en el ordenador del club, `@napi-rs/canvas`
| (`scripts/partido/video-informe.mjs`). Ninguna función toca `document`,
| `fetch` ni WebCodecs: los recursos (imágenes, fotogramas de los cortes)
| llegan ya cargados y la escena se pinta con `pintaFotograma`.
|
| También está aquí el reparto del tiempo (`reparteEscenas`): cuánto dura
| cada escena según la voz y qué se sacrifica si no cabe.
*/

import { SEGUNDOS_MAXIMOS, type Celda, type Corte, type CortePartido, type Escena, type GuionVideo, type MarcaPartido } from "./guion";

export const ANCHO = 1280;
export const ALTO = 720;
export const FPS = 30;

const FONDO = "#08111F";
const ORO = "#C8A96B";
const BLANCO = "#FFFFFF";

/** Lo que dura cada escena si la voz no manda otra cosa, y cuánto aire se deja tras la locución. */
export const SEGUNDOS: Record<Escena["tipo"], number> = { portada: 5.5, cifras: 7, claves: 8, barras: 7, once: 8, vigilar: 7, clips: 10, imagen: 7, cierre: 5.5 };
const AIRE = 0.7;

/** Las que se sacrifican primero si no cabe en el tiempo, por este orden. */
const PRESCINDIBLES = ["abp", "duelo", "grafico-1", "lamina-1", "rival", "clips-rival-2", "abp-banda", "vigilar", "clips-3", "clips-2", "grafico-0", "lamina-0", "abp-suyos", "once", "cifras", "clips-1", "clips", "abp-nuestros", "analisis-previo"];

/* ------------------------------------------------------------------ */
/*  TIPOS QUE COMPARTEN LOS DOS MOTORES                                */
/* ------------------------------------------------------------------ */

/** Cualquier cosa que `drawImage` acepte: ImageBitmap, HTMLVideoElement, Image de napi… */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Dibujable = any;

export type Lienzo = CanvasRenderingContext2D;

export type Recursos = { imagenes: Map<string, Dibujable | null> };

export type EscenaMedida = { escena: Escena; segundos: number; voz: Float32Array | null };

/* ------------------------------------------------------------------ */
/*  EL REPARTO DEL TIEMPO                                              */
/* ------------------------------------------------------------------ */

export function reparteEscenas(guion: GuionVideo, pistas: (Float32Array | null)[] | null, frecuencia: number, tope = SEGUNDOS_MAXIMOS): EscenaMedida[] {
  let lista: EscenaMedida[] = guion.escenas.map((escena, i) => {
    const pista = pistas?.[i] ?? null;
    const habla = pista ? pista.length / frecuencia : 0;
    const base = escena.tipo === "clips" ? escena.segundos : SEGUNDOS[escena.tipo];

    /* Los cortes no se acortan por la voz: la acción tiene que verse entera. */
    const minimo = escena.tipo === "clips" ? base : 0;

    return { escena, voz: pista, segundos: Math.max(minimo, habla ? habla + AIRE : 0, pista ? Math.min(base, habla + AIRE + 1) : base) };
  });

  const total = () => lista.reduce((s, x) => s + x.segundos, 0);

  for (const id of PRESCINDIBLES) {
    if (total() <= tope) break;

    lista = lista.filter((x) => x.escena.id !== id);
  }

  if (total() > tope) {
    const factor = tope / total();

    lista = lista.map((x) => ({ ...x, segundos: x.segundos * factor }));
  }

  return lista;
}

/* ------------------------------------------------------------------ */
/*  EL CAMPO EN 3D                                                     */
/* ------------------------------------------------------------------ */

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

  /* El once: alta y encima de nuestra portería, con el campo llenando el cuadro (medido: el fondo rival a y≈190). */
  if (tipo === "once") return { pos: [respira * 0.6, 70 + t * 0.3, -115 + t], mira: [0, 0, 0], fov: 36 };

  if (tipo === "portada" || tipo === "cierre") return { pos: [-40 + t * 2.5, 44, -118 + respira], mira: [6, 0, 8], fov: 48 };

  return { pos: [-95 + global * 0.6, 34, -92 + respira], mira: [10, 0, 10], fov: 50 };
}

/* ------------------------------------------------------------------ */
/*  EL ACABADO: GRANO, VIÑETA, BARRIDO                                 */
/* ------------------------------------------------------------------ */

/** La placa de grano: 256×256 de ruido gris. Se pinta con `rellenaGrano` sobre un lienzo que da el motor. */
export function rellenaGrano(ctx: Lienzo) {
  const img = ctx.createImageData(256, 256);

  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 90;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
}

function acabado(ctx: Lienzo, grano: Dibujable, progreso: number, titulo: string, fuente: string) {
  const v = ctx.createRadialGradient(ANCHO / 2, ALTO / 2, ALTO * 0.35, ANCHO / 2, ALTO / 2, ALTO * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.globalCompositeOperation = "overlay";
  const ox = Math.floor(Math.random() * 256);
  const oy = Math.floor(Math.random() * 256);

  for (let x = -ox; x < ANCHO; x += 256) for (let y = -oy; y < ALTO; y += 256) ctx.drawImage(grano, x, y);

  ctx.restore();

  ctx.fillStyle = ORO;
  ctx.fillRect(56, 48, 42, 4);
  ctx.font = `600 20px ${fuente}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
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

const rebota = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));

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
  ctx.textAlign = "left";
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
  ctx.textAlign = "left";
  ctx.fillStyle = BLANCO;

  const lineas = parteLineas(ctx, texto, ANCHO - 112).slice(0, 2);

  lineas.forEach((l, i) => ctx.fillText(l, 56, ALTO - 62 + i * 30 - (lineas.length - 1) * 30));
  ctx.globalAlpha = 1;
}

/** Un rótulo bajo («lower third») con la barra de oro. */
function rotuloBajo(ctx: Lienzo, fuente: string, principal: string, secundario: string, t: number, y = ALTO - 150) {
  const a = entra(t, 0.15, 0.5);

  if (a <= 0) return;

  ctx.textAlign = "left";
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
function medallon(ctx: Lienzo, fuente: string, img: Dibujable | null, cx: number, cy: number, radio: number, aro: string, texto: string) {
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

function pintaPortada(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "portada" }>, rec: Recursos, t: number) {
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

  e.barras.slice(0, 5).forEach((b, i) => {
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

    const num = b.texto.match(/^(\d+)(.*)$/);
    ctx.fillStyle = BLANCO;
    ctx.font = `700 30px ${fuente}`;
    ctx.fillText(num ? `${Math.round(Number(num[1]) * a)}${num[2]}` : b.texto, ANCHO - 56 - 200, y + 10);
    ctx.globalAlpha = 1;
  });
}

function pintaImagen(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "imagen" }>, img: Dibujable | null, t: number, dur: number) {
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

    ctx.globalAlpha = 0.45 * Math.min(1, a);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, radio * 0.9, radio * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, a);

    const cy = s.y - radio * 1.15;

    medallon(ctx, fuente, rec.imagenes.get(`${e.id}:${i}`) ?? null, s.x, cy, radio, j.destacado ? ORO : "rgba(255,255,255,0.85)", j.dorsal || "·");

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

/** Qué corte toca en el segundo `t` de una escena de cortes, y cuánto lleva dentro de él. */
export function corteEn(e: Extract<Escena, { tipo: "clips" }>, t: number, dur: number) {
  const porCorte = dur / Math.max(1, e.cortes.length);
  const k = Math.min(e.cortes.length - 1, Math.floor(t / porCorte));

  return { k, tc: t - k * porCorte, porCorte };
}

function pintaClips(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "clips" }>, cuadro: Dibujable | null, t: number, dur: number) {
  const { k, tc, porCorte } = corteEn(e, t, dur);

  if (cuadro && cuadro.width) {
    const vw = cuadro.videoWidth || cuadro.width;
    const vh = cuadro.videoHeight || cuadro.height;

    /*
    | Un 12 % más grande y empujado hacia arriba: así el marcador y el reloj de
    | la retransmisión (la franja de arriba) se quedan fuera del cuadro y no
    | pelean con nuestro rótulo. Y acerca despacio mientras dura el corte.
    */
    const esc = Math.max(ANCHO / vw, ALTO / vh) * 1.12 * (1 + 0.03 * (tc / porCorte));
    const w = vw * esc;
    const h = vh * esc;

    ctx.drawImage(cuadro, (ANCHO - w) / 2, -(h - ALTO) * 0.9, w, h);
  }

  const arriba = ctx.createLinearGradient(0, 0, 0, ALTO * 0.3);
  arriba.addColorStop(0, "rgba(8,17,31,0.8)");
  arriba.addColorStop(1, "rgba(8,17,31,0)");
  ctx.fillStyle = arriba;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  const g = ctx.createLinearGradient(0, ALTO * 0.5, 0, ALTO);
  g.addColorStop(0, "rgba(8,17,31,0)");
  g.addColorStop(1, "rgba(8,17,31,0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  const borde = Math.min(tc / 0.25, (porCorte - tc) / 0.25);

  if (borde < 1) {
    ctx.fillStyle = `rgba(8,17,31,${1 - Math.max(0, borde)})`;
    ctx.fillRect(0, 0, ANCHO, ALTO);
  }

  titular(ctx, fuente, e.titulo, t, 110, 34);

  const corte = e.cortes[k] as Corte & Partial<CortePartido>;
  const [principal, ...resto] = corte.rotulo.split(" · ");

  rotuloBajo(ctx, fuente, principal, resto.join(" · "), tc, corte.texto ? ALTO - 176 : ALTO - 140);

  /* La línea del partido (arriba, bajo el título) y el campo pequeño con la jugada (arriba a la derecha). */
  if (e.marcas?.length) lineaDelPartido(ctx, fuente, e.marcas, corte.minutoNum ?? 0, tc);

  if (corte.zona) campoDeLaJugada(ctx, fuente, corte as CortePartido, tc);

  /* La lectura táctica del corte, debajo del rótulo. */
  if (corte.texto) {
    const a = entra(tc, 0.5, 0.5);

    ctx.globalAlpha = a * 0.92;
    ctx.fillStyle = BLANCO;
    ctx.font = `400 24px ${fuente}`;
    ctx.textAlign = "left";
    parteLineas(ctx, corte.texto, ANCHO - 112 - 100)
      .slice(0, 2)
      .forEach((l, i) => ctx.fillText(l, 84, ALTO - 86 + i * 29));
    ctx.globalAlpha = 1;
  }

  e.cortes.forEach((_, i) => {
    ctx.fillStyle = i === k ? ORO : "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(ANCHO - 70 - (e.cortes.length - 1 - i) * 18, ALTO - 36, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * La línea del partido: de 0' a 90', con una marca por cada acción cortada
 * (las nuestras arriba, las suyas abajo; los goles en oro) y la actual
 * latiendo. Sitúa el corte en el tiempo sin decir nada.
 */
function lineaDelPartido(ctx: Lienzo, fuente: string, marcas: MarcaPartido[], actual: number, t: number) {
  const a = entra(t, 0.2, 0.5);

  if (a <= 0) return;

  const x0 = 56;
  const x1 = ANCHO - 56 - 300;
  const y = 150;
  const tope = Math.max(90, ...marcas.map((m) => m.minuto));
  const xDe = (m: number) => x0 + ((x1 - x0) * Math.min(m, tope)) / tope;

  ctx.globalAlpha = a;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();

  /* El descanso. */
  ctx.beginPath();
  ctx.moveTo(xDe(45), y - 6);
  ctx.lineTo(xDe(45), y + 6);
  ctx.stroke();

  ctx.font = `600 14px ${fuente}`;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("0'", x0, y + 24);
  ctx.textAlign = "center";
  ctx.fillText("45'", xDe(45), y + 24);
  ctx.textAlign = "right";
  ctx.fillText(`${tope}'`, x1, y + 24);
  ctx.textAlign = "left";

  for (const m of marcas) {
    const x = xDe(m.minuto);
    const esActual = m.minuto === actual;
    const r = esActual ? 6 + Math.sin(t * 6) * 1.5 : m.gol ? 5 : 3.5;
    const cy = m.de === "nosotros" ? y - 9 : y + 9;

    ctx.fillStyle = m.gol ? ORO : esActual ? BLANCO : "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();

    if (esActual) {
      ctx.strokeStyle = ORO;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, cy, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ORO;
      ctx.font = `700 15px ${fuente}`;
      ctx.textAlign = "center";
      ctx.fillText(`${actual}'`, x, m.de === "nosotros" ? y - 24 : y + 38);
      ctx.textAlign = "left";
    }
  }

  ctx.globalAlpha = 1;
}

/**
 * El campo pequeño de la jugada: nueve celdas (tercio × carril, en el sentido
 * del que ataca, siempre hacia la derecha), de dónde sale el pase y dónde se
 * remata, con la flecha entre las dos y el resultado del remate.
 */
function campoDeLaJugada(ctx: Lienzo, fuente: string, c: CortePartido, t: number) {
  const a = entra(t, 0.35, 0.5);

  if (a <= 0 || !c.zona) return;

  const w = 250;
  const h = 160;
  const x = ANCHO - 56 - w;
  const y = 96 + (1 - a) * 16;

  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(8,17,31,0.72)";
  ctx.fillRect(x - 10, y - 10, w + 20, h + 46);
  ctx.fillStyle = "rgba(22,70,42,0.9)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, h * 0.14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(x, y + h * 0.2, w * 0.16, h * 0.6);
  ctx.strokeRect(x + w - w * 0.16, y + h * 0.2, w * 0.16, h * 0.6);

  /* La celda: tercio 0-2 de izquierda a derecha, carril 0-2 de arriba abajo (visto desde la grada de enfrente, izquierda arriba). */
  const celda = (z: Celda) => ({ cx: x + (w / 3) * (z.tercio + 0.5), cy: y + (h / 3) * (z.carril + 0.5) });

  if (c.desdeZona && (c.desdeZona.tercio !== c.zona.tercio || c.desdeZona.carril !== c.zona.carril)) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + (w / 3) * c.desdeZona.tercio, y + (h / 3) * c.desdeZona.carril, w / 3, h / 3);
  }

  ctx.fillStyle = "rgba(200,169,107,0.45)";
  ctx.fillRect(x + (w / 3) * c.zona.tercio, y + (h / 3) * c.zona.carril, w / 3, h / 3);

  const hasta = celda(c.zona);
  const b = entra(t, 0.7, 0.6);

  if (c.desdeZona && b > 0) {
    const desde = celda(c.desdeZona);
    const px = desde.cx + (hasta.cx - desde.cx) * b;
    const py = desde.cy + (hasta.cy - desde.cy) * b;

    ctx.strokeStyle = BLANCO;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(desde.cx, desde.cy);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = BLANCO;
    ctx.beginPath();
    ctx.arc(desde.cx, desde.cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = ORO;
  ctx.beginPath();
  ctx.arc(hasta.cx, hasta.cy, 7 + Math.sin(t * 5) * 1.5, 0, Math.PI * 2);
  ctx.fill();

  /* El sentido del ataque y el pie. */
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `600 13px ${fuente}`;
  ctx.textAlign = "left";
  ctx.fillText(`${c.de === "nosotros" ? "CASTILLA" : "RIVAL"} ATACA →`, x, y + h + 18);

  if (c.resultado) {
    ctx.textAlign = "right";
    ctx.fillStyle = ORO;
    ctx.font = `700 15px ${fuente}`;
    ctx.fillText(c.resultado.toUpperCase(), x + w, y + h + 18);
    ctx.textAlign = "left";
  }

  ctx.globalAlpha = 1;
}

function pintaCierre(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "cierre" }>, t: number) {
  const velo = ctx.createLinearGradient(0, 0, ANCHO * 0.8, 0);
  velo.addColorStop(0, "rgba(8,17,31,0.85)");
  velo.addColorStop(1, "rgba(8,17,31,0)");
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  const a = entra(t, 0.1, 0.6);

  ctx.globalAlpha = a;
  ctx.fillStyle = ORO;
  ctx.font = `700 26px ${fuente}`;
  ctx.textAlign = "left";
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
/*  UN FOTOGRAMA ENTERO                                                 */
/* ------------------------------------------------------------------ */

export type Fotograma = {
  medida: EscenaMedida;
  /** Segundo dentro de la escena y segundo global del vídeo. */
  t: number;
  global: number;
  /** 0→1 del vídeo entero, para la barra de abajo. */
  progreso: number;
  /** Cuántos segundos quedan de la escena (para el fundido de salida). */
  restante: number;
  /** El fotograma del corte que toca, si la escena es de cortes. */
  cuadro: Dibujable | null;
};

/** Pinta un fotograma completo: plató, escena, acabado y fundidos. */
export function pintaFotograma(ctx: Lienzo, grano: Dibujable, fuente: string, titulo: string, rec: Recursos, f: Fotograma) {
  const e = f.medida.escena;
  const conCampo = e.tipo === "portada" || e.tipo === "cierre" || e.tipo === "once";

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  if (e.tipo === "clips") pintaClips(ctx, fuente, e, f.cuadro, f.t, f.medida.segundos);
  else {
    const P = proyector(camaraDe(e.tipo, f.t, f.global));

    pintaCampo(ctx, P, conCampo ? 1 : 0.42);

    if (!conCampo) {
      ctx.fillStyle = "rgba(8,17,31,0.62)";
      ctx.fillRect(0, 0, ANCHO, ALTO);
    }

    const g = ctx.createRadialGradient(ANCHO * 0.85, ALTO * 0.1, 0, ANCHO * 0.85, ALTO * 0.1, 700 + Math.sin(f.global * 0.8) * 40);
    g.addColorStop(0, "rgba(200,169,107,0.18)");
    g.addColorStop(1, "rgba(200,169,107,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ANCHO, ALTO);

    if (e.tipo === "portada") pintaPortada(ctx, fuente, e, rec, f.t);
    else if (e.tipo === "claves") pintaClaves(ctx, fuente, e.titulo, e.lineas, f.t);
    else if (e.tipo === "cifras") pintaCifras(ctx, fuente, e, f.t);
    else if (e.tipo === "barras") pintaBarras(ctx, fuente, e, f.t);
    else if (e.tipo === "imagen") pintaImagen(ctx, fuente, e, rec.imagenes.get(e.id) ?? null, f.t, f.medida.segundos);
    else if (e.tipo === "once") pintaOnce(ctx, fuente, P, e, rec, f.t);
    else if (e.tipo === "vigilar") pintaVigilar(ctx, fuente, e, rec, f.t);
    else pintaCierre(ctx, fuente, e, f.t);

    if (e.tipo === "claves" || e.tipo === "cifras" || e.tipo === "barras" || e.tipo === "imagen" || e.tipo === "vigilar") pieLocucion(ctx, fuente, e.locucion, f.t);
  }

  acabado(ctx, grano, f.progreso, titulo, fuente);

  const velo = Math.max(0, 1 - Math.min(f.t / 0.3, f.restante / 0.3));

  if (velo > 0) {
    ctx.fillStyle = `rgba(8,17,31,${velo})`;
    ctx.fillRect(0, 0, ANCHO, ALTO);
  }
}
