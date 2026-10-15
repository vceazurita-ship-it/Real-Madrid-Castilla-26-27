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

import { anillo, caja, cortinilla, cuenta, espaciado, fraccionDe, sale, salta, tramo } from "./movimiento";
import { SEGUNDOS_MAXIMOS, SEGUNDOS_MINIMOS, type Celda, type Corte, type CortePartido, type Escena, type GuionVideo, type MarcaPartido } from "./guion";

/*
| ANCHO×ALTO es el lienzo LÓGICO: todas las medidas de este fichero (rótulos,
| márgenes, el campo) están en esos 1280×720. El vídeo sale en Full HD
| (15/10/2026): `pintaFotograma` escala el contexto al tamaño real del lienzo,
| así que el texto y los gráficos se dibujan a 1080 de verdad y los cortes
| entran con su resolución nativa. Un lienzo de 1280 sigue valiendo (escala 1).
*/
export const ANCHO = 1280;
export const ALTO = 720;
export const ANCHO_HD = 1920;
export const ALTO_HD = 1080;
export const FPS = 30;

const FONDO = "#08111F";
const ORO = "#C8A96B";
const BLANCO = "#FFFFFF";

/** Lo que dura cada escena si la voz no manda otra cosa, y cuánto aire se deja tras la locución. */
export const SEGUNDOS: Record<Escena["tipo"], number> = { portada: 5.5, cifras: 7, claves: 8, barras: 7, once: 8, vigilar: 7, clips: 10, imagen: 7, cierre: 5.5, gancho: 3.6, contexto: 7, versus: 8, percentiles: 7, duelos: 8, fases: 9, balance: 10 };
const AIRE = 0.7;

/** Las que se sacrifican primero si no cabe en el tiempo, por este orden. */
const PRESCINDIBLES = ["abp", "duelo", "acierto", "percentiles", "contexto", "duelos", "fases", "grafico-2", "lamina-2", "grafico-1", "lamina-1", "rival", "clips-rival-2", "abp-banda", "vigilar", "clips-3", "clips-2", "grafico-0", "lamina-0", "abp-suyos", "once", "cifras", "clips-1", "clips", "abp-nuestros", "analisis-previo", "versus"];

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

/**
 * Cuánto aire se da a las escenas sin cortes si el vídeo no llega al mínimo:
 * el factor por el que se estiran (como mucho ×1,8, que más ya se nota vacío).
 */
export function estiramiento(guion: GuionVideo, minimo = SEGUNDOS_MINIMOS) {
  const cortes = guion.escenas.reduce((s, e) => s + (e.tipo === "clips" ? e.segundos : 0), 0);
  const resto = guion.escenas.reduce((s, e) => s + (e.tipo === "clips" ? 0 : SEGUNDOS[e.tipo]), 0);

  return resto > 0 && cortes + resto < minimo ? Math.min(1.8, (minimo - cortes) / resto) : 1;
}

/** Las palabras que caben en la locución de cada escena (2,4 por segundo), contando el aire que se le da si el vídeo es corto. */
export function palabrasDeEscena(e: Escena, factor = 1) {
  return Math.ceil((e.tipo === "clips" ? e.segundos : SEGUNDOS[e.tipo] * factor) * 2.4);
}

export function reparteEscenas(guion: GuionVideo, pistas: (Float32Array | null)[] | null, frecuencia: number, tope = SEGUNDOS_MAXIMOS, minimo = SEGUNDOS_MINIMOS): EscenaMedida[] {
  let lista: EscenaMedida[] = guion.escenas.map((escena, i) => {
    const pista = pistas?.[i] ?? null;
    const habla = pista ? pista.length / frecuencia : 0;
    const base = escena.tipo === "clips" ? escena.segundos : SEGUNDOS[escena.tipo];

    /* Los cortes no se acortan por la voz: la acción tiene que verse entera. */
    const minimo = escena.tipo === "clips" ? base : 0;

    return { escena, voz: pista, segundos: Math.max(minimo, habla ? habla + AIRE : 0, pista ? Math.min(base, habla + AIRE + 1) : base) };
  });

  const total = () => lista.reduce((s, x) => s + x.segundos, 0);

  /*
  | Antes de quitar escenas enteras, se quitan CORTES: el último de la escena
  | de cortes más larga, hasta dejar uno por escena. Con cinco goles (J06) el
  | vídeo perdía «nuestras llegadas» y «lo que nos generó» enteras; así queda
  | algo de cada bloque. Los cortes del partido van en orden de minuto, y se
  | conserva el primero.
  */
  /*
  | Primero caen las REPETICIONES (la última primero) y sólo después cortes:
  | con cinco goles, el recorte se llevaba los goles del 66' y del 71' y
  | dejaba las repeticiones de los primeros (J06, 12/10/2026).
  */
  const esGol = (c: Corte) => /^gol/.test((c as Corte & { tipo?: string }).tipo ?? "");

  const quita = (i: number, k: number) => {
    const x = lista[i];
    const e = x.escena as Extract<Escena, { tipo: "clips" }>;
    const quitado = e.cortes[k] as Corte & { segundos?: number };
    const menos = quitado.segundos || x.segundos / e.cortes.length;

    lista[i] = { ...x, escena: { ...e, cortes: e.cortes.filter((_, j) => j !== k), segundos: Math.max(0, e.segundos - menos) }, segundos: Math.max(0, x.segundos - menos) };
  };

  /* Los cortes que no son gol, de la escena más larga, mientras alguna tenga más de `deja`. Los goles no se tocan aquí. */
  const quitaNoGol = (deja: number) => {
    const candidatas = lista
      .map((x, i) => ({ x, i }))
      .filter(({ x }) => x.escena.tipo === "clips" && x.escena.cortes.length > deja && !x.escena.cortes.some(esGol))
      .sort((a, b) => b.x.segundos - a.x.segundos);

    if (!candidatas.length) return false;

    const { x, i } = candidatas[0];

    quita(i, (x.escena as Extract<Escena, { tipo: "clips" }>).cortes.length - 1);

    return true;
  };

  /*
  | Con 2:30 de margen (13/10/2026), primero se deja cada bloque de llegadas
  | en dos cortes, y sólo entonces caen las repeticiones: con cinco goles y
  | todas las llegadas, se perdían todas las repeticiones antes que una
  | llegada de sobra.
  */
  while (total() > tope && quitaNoGol(2));

  while (total() > tope) {
    let hecho = false;

    for (let i = lista.length - 1; i >= 0 && !hecho; i -= 1) {
      const e = lista[i].escena;

      if (e.tipo !== "clips") continue;

      for (let k = e.cortes.length - 1; k >= 0; k -= 1) {
        if (e.cortes[k].repeticion) {
          quita(i, k);
          hecho = true;
          break;
        }
      }
    }

    if (hecho) continue;

    /* Luego cortes que no sean goles, dejando uno por escena. */
    if (!quitaNoGol(1)) break;
  }

  for (const id of PRESCINDIBLES) {
    if (total() <= tope) break;

    lista = lista.filter((x) => x.escena.id !== id);
  }

  /* Y sólo si aún no cabe, los últimos goles (el primero se queda siempre). */
  for (let i = lista.findIndex((x) => x.escena.tipo === "clips" && x.escena.cortes.some(esGol)); i >= 0 && total() > tope; ) {
    const e = lista[i].escena as Extract<Escena, { tipo: "clips" }>;

    if (e.cortes.length <= 1) break;

    quita(i, e.cortes.length - 1);
  }

  /*
  | Si aún no cabe, se aprietan las escenas sin cortes, nunca por debajo de lo
  | que dura su voz: los cortes se ven enteros siempre (13/10/2026; antes se
  | escalaba todo, y un corte apretado se quedaba sin el remate).
  */
  if (total() > tope) {
    const fijo = lista.reduce((s, x) => s + (x.escena.tipo === "clips" ? x.segundos : 0), 0);
    const libre = total() - fijo;
    const factor = libre > 0 ? Math.max(0, (tope - fijo) / libre) : 1;

    lista = lista.map((x) => (x.escena.tipo === "clips" ? x : { ...x, segundos: Math.max(x.voz ? x.voz.length / frecuencia + 0.2 : 0, x.segundos * factor) }));
  }

  /* El último recurso: escalar todo (sólo pasa con guiones imposibles). */
  if (total() > tope) {
    const factor = tope / total();

    lista = lista.map((x) => ({ ...x, segundos: x.segundos * factor }));
  }

  /*
  | Y si se queda corto (menos de un minuto), aire a las escenas sin cortes:
  | la cámara sigue moviéndose y los números siguen contando, así que no se
  | nota parado. Como mucho ×1,8; los cortes no se estiran nunca.
  */
  if (total() < minimo) {
    const fijo = lista.reduce((s, x) => s + (x.escena.tipo === "clips" ? x.segundos : 0), 0);
    const libre = total() - fijo;
    const factor = libre > 0 ? Math.min(1.8, (minimo - fijo) / libre) : 1;

    if (factor > 1) lista = lista.map((x) => (x.escena.tipo === "clips" ? x : { ...x, segundos: x.segundos * factor }));
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

function acabado(ctx: Lienzo, grano: Dibujable, progreso: number, titulo: string, fuente: string, marcas: number[] = []) {
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
  espaciado(ctx, `REAL MADRID CASTILLA · ${titulo.toUpperCase()}`, 110, 56, 1.2);

  /* La barra de progreso, con una muesca en cada cambio de escena (capítulos). */
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, ALTO - 6, ANCHO, 6);
  const g = ctx.createLinearGradient(0, 0, ANCHO * Math.max(0.01, progreso), 0);
  g.addColorStop(0, "#9C7F45");
  g.addColorStop(1, "#E3C98F");
  ctx.fillStyle = g;
  ctx.fillRect(0, ALTO - 6, ANCHO * progreso, 6);

  for (const m of marcas) {
    ctx.fillStyle = m <= progreso ? "rgba(8,17,31,0.9)" : "rgba(255,255,255,0.35)";
    ctx.fillRect(ANCHO * m - 1, ALTO - 6, 2, 6);
  }
}

/* ------------------------------------------------------------------ */
/*  LOS ELEMENTOS DE TEXTO                                             */
/* ------------------------------------------------------------------ */

const suave = (t: number) => sale(t);

const rebota = (t: number) => salta(t);

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
  const mayus = texto.toUpperCase();
  const palabras = mayus.split(" ");

  ctx.font = `700 ${tam}px ${fuente}`;
  ctx.textAlign = "left";

  const espacio = ctx.measureText(" ").width;
  let x = 56;

  /* Cada palabra entra desde abajo, una detrás de otra. */
  palabras.forEach((p, i) => {
    const a = tramo(t, 0.05 + i * 0.07, 0.55);

    ctx.globalAlpha = a;
    ctx.fillStyle = BLANCO;
    ctx.fillText(p, x, y + (1 - a) * 22);
    x += ctx.measureText(p).width + espacio;
  });

  const ancho = x - espacio - 56;

  /* El subrayado de oro crece bajo el título. */
  const u = tramo(t, 0.25 + palabras.length * 0.07, 0.7);

  ctx.globalAlpha = 1;
  ctx.fillStyle = ORO;
  ctx.fillRect(56, y + 16, Math.min(ancho, 140) * u, 4);

  /* Y un barrido de luz lo cruza una vez. */
  const barrido = (t - 0.5) / 0.9;

  if (barrido > 0 && barrido < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(56, y - tam, ancho, tam * 1.25);
    ctx.clip();
    const bx = 56 - 160 + (ancho + 320) * barrido;
    const gr = ctx.createLinearGradient(bx - 120, 0, bx + 120, 0);
    gr.addColorStop(0, "rgba(200,169,107,0)");
    gr.addColorStop(0.5, "rgba(230,205,150,0.85)");
    gr.addColorStop(1, "rgba(200,169,107,0)");
    ctx.fillStyle = gr;
    ctx.fillText(mayus, 56, y);
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

/**
 * Un rótulo bajo («lower third») de retransmisión (14/10/2026): panel con el
 * filo derecho en diagonal que se despliega con un rebote corto, bloque de
 * oro, y los textos entrando un poco después.
 */
function rotuloBajo(ctx: Lienzo, fuente: string, principal: string, secundario: string, t: number, y = ALTO - 150) {
  const a = salta((t - 0.15) / 0.55);

  if (a <= 0) return;

  ctx.textAlign = "left";
  ctx.font = `700 34px ${fuente}`;
  const w1 = ctx.measureText(principal).width;
  ctx.font = `500 22px ${fuente}`;
  const w2 = secundario ? ctx.measureText(secundario).width : 0;
  const w = Math.min(Math.max(w1, w2) + 70, ANCHO - 112);
  const alto = secundario ? 86 : 60;
  const x = 56;
  const sesgo = 18;

  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.beginPath();
  ctx.moveTo(x, y - 42);
  ctx.lineTo(x + w * a + sesgo, y - 42);
  ctx.lineTo(x + w * a, y - 42 + alto);
  ctx.lineTo(x, y - 42 + alto);
  ctx.closePath();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "rgba(8,17,31,0.92)");
  g.addColorStop(1, "rgba(16,30,52,0.82)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.fillStyle = ORO;
  ctx.fillRect(x, y - 42, 10, alto);
  ctx.fillRect(x, y - 42, (w + sesgo) * Math.min(1, a), 2);

  const b = tramo(t, 0.3, 0.45);

  ctx.globalAlpha = b;
  ctx.fillStyle = BLANCO;
  ctx.font = `700 34px ${fuente}`;
  ctx.fillText(principal, x + 30 - (1 - b) * 16, y + 2);

  if (secundario) {
    const c = tramo(t, 0.42, 0.45);

    ctx.globalAlpha = c;
    ctx.fillStyle = "rgba(227,201,143,0.95)";
    ctx.font = `500 22px ${fuente}`;
    ctx.fillText(secundario, x + 30 - (1 - c) * 16, y + 33);
  }

  ctx.restore();
}

/**
 * «GOL» en grande cuando entra el balón (14/10/2026): coincide con el golpe de
 * la banda sonora (inicio del corte + 5,5 s, `musica.ts`). Sólo en los goles
 * nuestros y nunca en la repetición.
 */
function estallidoGol(ctx: Lienzo, fuente: string, tc: number) {
  const d = tc - 5.4;

  if (d < 0 || d > 1.6) return;

  const llega = salta(d / 0.35);
  const marcha = d > 1.1 ? 1 - (d - 1.1) / 0.5 : 1;
  const alfa = Math.max(0, Math.min(1, llega) * marcha);

  /* Un fogonazo de oro que se abre desde el centro. */
  const r = 120 + d * 900;
  const luz = ctx.createRadialGradient(ANCHO / 2, ALTO / 2, 0, ANCHO / 2, ALTO / 2, r);
  luz.addColorStop(0, `rgba(227,201,143,${0.35 * alfa})`);
  luz.addColorStop(1, "rgba(227,201,143,0)");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(ANCHO / 2, ALTO / 2 - 20);
  ctx.scale(0.6 + llega * 0.4, 0.6 + llega * 0.4);
  ctx.font = `700 190px ${fuente}`;
  ctx.textAlign = "center";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(8,17,31,0.85)";
  ctx.strokeText("GOL", 0, 66);
  ctx.fillStyle = ORO;
  ctx.fillText("GOL", 0, 66);
  ctx.restore();
  ctx.textAlign = "left";
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
  const nos = rec.imagenes.get(`${e.id}:nosotros`) ?? null;
  const riv = rec.imagenes.get(`${e.id}:rival`) ?? null;
  const cy = 236;

  /* Un velo de abajo arriba: el título se lee encima del césped. */
  const velo = ctx.createLinearGradient(0, ALTO * 0.38, 0, ALTO);
  velo.addColorStop(0, "rgba(8,17,31,0)");
  velo.addColorStop(0.45, "rgba(8,17,31,0.82)");
  velo.addColorStop(1, "rgba(8,17,31,0.96)");
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  /* Rayos de luz detrás de los escudos. */
  const rayos = tramo(t, 0.1, 1.2);

  ctx.save();
  ctx.globalAlpha = 0.16 * rayos;
  ctx.translate(ANCHO / 2, cy);
  ctx.rotate(t * 0.08);

  /* Los doce rayos en un solo trazo con un solo degradado radial: barato en los dos motores. */
  const luz = ctx.createRadialGradient(0, 0, 0, 0, 0, 520);
  luz.addColorStop(0, "rgba(227,201,143,0.9)");
  luz.addColorStop(1, "rgba(227,201,143,0)");
  ctx.fillStyle = luz;
  ctx.beginPath();

  for (let i = 0; i < 12; i += 1) {
    const ang = (i * Math.PI * 2) / 12;

    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang - 0.065) * 520, Math.sin(ang - 0.065) * 520);
    ctx.lineTo(Math.cos(ang + 0.065) * 520, Math.sin(ang + 0.065) * 520);
    ctx.closePath();
  }

  ctx.fill();

  ctx.restore();

  /* Los escudos caen con un pequeño rebote, uno detrás de otro. */
  const escudo = (img: Dibujable | null, lado: -1 | 1, desde: number, aro: string, siglas: string) => {
    const a = salta((t - desde) / 0.7);

    if (a <= 0) return;

    const radio = 84 * Math.max(0.2, a);

    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.4);
    halo(ctx, ANCHO / 2 + lado * 170, cy, radio * 1.55);
    medallon(ctx, fuente, img, ANCHO / 2 + lado * 170, cy, radio, aro, siglas);
    ctx.restore();
  };

  escudo(nos, -1, 0.2, "rgba(255,255,255,0.85)", "RM");
  escudo(riv, 1, 0.45, ORO, e.titulo.slice(0, 3).toUpperCase());

  /* El VS en un rombo de oro que late. */
  const vs = tramo(t, 0.75, 0.5);

  if (vs > 0) {
    const late = 1 + Math.sin(t * 3.2) * 0.03;

    ctx.save();
    ctx.globalAlpha = vs;
    ctx.translate(ANCHO / 2, cy);
    ctx.scale(late * vs, late * vs);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "rgba(8,17,31,0.92)";
    ctx.fillRect(-34, -34, 68, 68);
    ctx.lineWidth = 3;
    ctx.strokeStyle = ORO;
    ctx.strokeRect(-34, -34, 68, 68);
    ctx.restore();
    ctx.globalAlpha = vs;
    ctx.fillStyle = ORO;
    ctx.font = `700 34px ${fuente}`;
    ctx.textAlign = "center";
    ctx.fillText("VS", ANCHO / 2, cy + 12);
    ctx.globalAlpha = 1;
  }

  /* El sello en una píldora de oro. */
  const b = tramo(t, 0.9, 0.5);

  ctx.textAlign = "center";
  ctx.font = `700 24px ${fuente}`;

  const sello = e.sello.toUpperCase();
  const ws = espaciadoAncho(ctx, sello, 3) + 44;

  ctx.globalAlpha = b;
  ctx.fillStyle = ORO;
  caja(ctx, ANCHO / 2 - ws / 2, 384 + (1 - b) * 14, ws, 38, 19);
  ctx.fill();
  ctx.fillStyle = FONDO;
  espaciado(ctx, sello, ANCHO / 2, 411 + (1 - b) * 14, 3, "center");

  /* El título, letra a letra. */
  ctx.fillStyle = BLANCO;
  ctx.font = `700 92px ${fuente}`;

  const lineas = parteLineas(ctx, e.titulo.toUpperCase(), ANCHO - 160).slice(0, 2);

  lineas.forEach((l, i) => {
    const anchos = [...l].map((c) => ctx.measureText(c).width);
    const total = anchos.reduce((sum, w) => sum + w, 0);
    let x = ANCHO / 2 - total / 2;

    ctx.textAlign = "left";
    [...l].forEach((c, k) => {
      const a = tramo(t, 1.05 + i * 0.25 + k * 0.035, 0.45);

      ctx.globalAlpha = a;
      ctx.fillText(c, x, 506 + i * 92 + (1 - a) * 36);
      x += anchos[k];
    });
  });

  /* Dos filetes de oro que se abren desde el centro bajo el título. */
  const f = tramo(t, 1.5, 0.8);
  const yf = 530 + (lineas.length - 1) * 92;

  ctx.globalAlpha = 1;
  ctx.fillStyle = ORO;
  ctx.fillRect(ANCHO / 2 - 12 - 200 * f, yf, 200 * f, 3);
  ctx.fillRect(ANCHO / 2 + 12, yf, 200 * f, 3);

  const c = tramo(t, 1.7, 0.6);

  ctx.globalAlpha = c * 0.8;
  ctx.textAlign = "center";
  ctx.font = `500 28px ${fuente}`;
  ctx.fillStyle = BLANCO;
  ctx.fillText(e.subtitulo, ANCHO / 2, yf + 44 + (1 - c) * 10);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

/** Un resplandor de oro detrás de un escudo. */
function halo(ctx: Lienzo, cx: number, cy: number, radio: number) {
  const g = ctx.createRadialGradient(cx, cy, radio * 0.4, cx, cy, radio);
  g.addColorStop(0, "rgba(200,169,107,0.45)");
  g.addColorStop(1, "rgba(200,169,107,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - radio, cy - radio, radio * 2, radio * 2);
}

/** El ancho de un texto con espaciado entre letras (para medir antes de pintar). */
function espaciadoAncho(ctx: Lienzo, texto: string, aire: number) {
  return [...texto].reduce((s, c) => s + ctx.measureText(c).width, 0) + aire * Math.max(0, texto.length - 1);
}

function pintaClaves(ctx: Lienzo, fuente: string, titulo: string, lineas: string[], t: number) {
  titular(ctx, fuente, titulo, t);

  const n = Math.min(4, lineas.length);
  const alto = n <= 3 ? 104 : 86;
  const hueco = 16;

  lineas.slice(0, 4).forEach((linea, i) => {
    const a = salta((t - (0.5 + i * 0.32)) / 0.6);

    if (a <= 0) return;

    const y = 205 + i * (alto + hueco);
    const x = 56 + (1 - Math.min(1, a)) * -60;

    ctx.globalAlpha = Math.min(1, a);

    /* La tarjeta, con degradado y filo de oro. */
    const g = ctx.createLinearGradient(x, 0, x + ANCHO - 112, 0);
    g.addColorStop(0, "rgba(16,30,52,0.92)");
    g.addColorStop(1, "rgba(8,17,31,0.55)");
    ctx.fillStyle = g;
    caja(ctx, x, y, ANCHO - 112, alto, 14);
    ctx.fill();
    ctx.fillStyle = ORO;
    caja(ctx, x, y, 6, alto, 3);
    ctx.fill();

    /* El número, grande y en oro. */
    ctx.font = `700 ${Math.round(alto * 0.62)}px ${fuente}`;
    ctx.fillStyle = ORO;
    ctx.textAlign = "left";
    ctx.fillText(String(i + 1).padStart(2, "0"), x + 30, y + alto * 0.72);

    ctx.fillStyle = BLANCO;
    ctx.font = `500 32px ${fuente}`;

    const partes = parteLineas(ctx, linea, ANCHO - 112 - 160).slice(0, 2);
    const y0 = y + alto / 2 + 11 - (partes.length - 1) * 18;

    partes.forEach((p, k) => ctx.fillText(p, x + 130, y0 + k * 36));
    ctx.globalAlpha = 1;
  });
}

function pintaCifras(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "cifras" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const n = Math.min(4, e.cifras.length);
  const hueco = 22;
  const ancho = (ANCHO - 112 - (n - 1) * hueco) / n;
  const yTarjeta = 214;
  const altoTarjeta = 316;

  e.cifras.slice(0, 4).forEach((c, i) => {
    const a = salta((t - (0.45 + i * 0.22)) / 0.6);

    if (a <= 0) return;

    const x = 56 + i * (ancho + hueco);
    const y = yTarjeta + (1 - Math.min(1, a)) * 40;
    const conta = tramo(t, 0.6 + i * 0.22, 1.3);

    ctx.globalAlpha = Math.min(1, a);

    const g = ctx.createLinearGradient(0, y, 0, y + altoTarjeta);
    g.addColorStop(0, "rgba(18,34,58,0.95)");
    g.addColorStop(1, "rgba(8,17,31,0.75)");
    ctx.fillStyle = g;
    caja(ctx, x, y, ancho, altoTarjeta, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    /* El filo de oro crece de izquierda a derecha. */
    ctx.fillStyle = ORO;
    caja(ctx, x, y, ancho * conta, 5, 2.5);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `600 19px ${fuente}`;
    espaciado(ctx, c.rotulo.toUpperCase(), x + 22, y + 44, 1.4);

    const fraccion = fraccionDe(c.valor);
    const largo = c.valor.length > 12;

    if (fraccion !== null && !largo) {
      /* Porcentaje: un anillo que se llena con el número dentro. */
      const radio = Math.min(ancho * 0.32, 82);
      const cx = x + ancho / 2;
      const cy = y + 150;

      anillo(ctx, cx, cy, radio, 12, fraccion * conta, ORO);
      ctx.fillStyle = BLANCO;
      ctx.font = `700 ${Math.round(radio * 0.62)}px ${fuente}`;
      ctx.textAlign = "center";
      ctx.fillText(cuenta(c.valor, conta), cx, cy + radio * 0.22);
      ctx.textAlign = "left";
    } else {
      ctx.fillStyle = BLANCO;
      ctx.font = `700 ${largo ? 30 : 92}px ${fuente}`;
      parteLineas(ctx, largo ? c.valor : cuenta(c.valor, conta), ancho - 44)
        .slice(0, largo ? 5 : 2)
        .forEach((l, k) => ctx.fillText(l, x + 22, (largo ? 100 : 160) + y + k * (largo ? 36 : 90)));
    }

    if (c.pie) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = `500 21px ${fuente}`;
      parteLineas(ctx, c.pie, ancho - 44)
        .slice(0, 2)
        .forEach((l, k) => ctx.fillText(l, x + 22, y + altoTarjeta - 52 + k * 25));
    }

    ctx.globalAlpha = 1;
  });
}

function pintaBarras(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "barras" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const lista = e.barras.slice(0, 5);
  const maximo = Math.max(0.01, ...lista.map((b) => b.valor));
  const mayor = lista.reduce((m, b, i) => (b.valor > lista[m].valor ? i : m), 0);
  const x0 = 300;
  const largo = ANCHO - x0 - 56 - 170;
  const paso = lista.length > 4 ? 76 : 88;

  lista.forEach((b, i) => {
    const a = tramo(t, 0.45 + i * 0.22, 1.1);
    const y = 228 + i * paso;
    const destacada = i === mayor;

    ctx.globalAlpha = tramo(t, 0.35 + i * 0.22, 0.4);
    ctx.fillStyle = destacada ? BLANCO : "rgba(255,255,255,0.72)";
    ctx.font = `600 26px ${fuente}`;
    ctx.textAlign = "left";
    ctx.fillText(b.rotulo.toUpperCase(), 56, y + 9);

    /* La pista y la barra, redondeadas. */
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    caja(ctx, x0, y - 17, largo, 34, 17);
    ctx.fill();

    const w = Math.max(34, largo * (b.valor / maximo) * a);
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, destacada ? "#B8935A" : "rgba(200,169,107,0.45)");
    g.addColorStop(1, destacada ? "#F0D9A6" : "rgba(200,169,107,0.9)");

    /* La destacada, con un resplandor (una banda más ancha y translúcida). */
    if (destacada) {
      ctx.fillStyle = "rgba(227,201,143,0.16)";
      caja(ctx, x0 - 6, y - 25, w + 12, 50, 25);
      ctx.fill();
    }

    ctx.fillStyle = g;
    caja(ctx, x0, y - 17, w, 34, 17);
    ctx.fill();

    /* El valor viaja en una píldora al final de la barra. */
    const num = b.texto.match(/^(\d+)(.*)$/);
    const texto = num ? `${Math.round(Number(num[1]) * a)}${num[2]}` : b.texto;

    ctx.font = `700 26px ${fuente}`;
    const wt = ctx.measureText(texto).width + 26;
    const px = Math.min(x0 + w + 14, ANCHO - 56 - wt);

    ctx.fillStyle = destacada ? ORO : "rgba(8,17,31,0.85)";
    caja(ctx, px, y - 19, wt, 38, 19);
    ctx.fill();
    ctx.fillStyle = destacada ? FONDO : BLANCO;
    ctx.fillText(texto, px + 13, y + 9);
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

/**
 * Dónde empieza y cuánto dura cada corte dentro de su escena. Cada corte se
 * ve ENTERO (lo que dure su fichero, `segundos`); si la escena se ha
 * escalado para caber, todos se acortan en la misma proporción. Antes la
 * escena repartía el tiempo a partes iguales y un corte de nueve segundos se
 * cortaba a los siete, antes del remate.
 */
export function limitesDeCortes(e: Extract<Escena, { tipo: "clips" }>, dur: number): { desde: number; dura: number }[] {
  const propios = e.cortes.map((c) => (c as Corte & { segundos?: number }).segundos || 0);
  const suma = propios.reduce((s, x) => s + x, 0);
  const n = Math.max(1, e.cortes.length);
  const duras = suma > 0 ? propios.map((x) => (x || suma / n) * (dur / suma)) : e.cortes.map(() => dur / n);
  const limites: { desde: number; dura: number }[] = [];
  let desde = 0;

  for (const d of duras) {
    limites.push({ desde, dura: d });
    desde += d;
  }

  return limites;
}

/** Qué corte toca en el segundo `t` de una escena de cortes, y cuánto lleva dentro de él. */
export function corteEn(e: Extract<Escena, { tipo: "clips" }>, t: number, dur: number) {
  const limites = limitesDeCortes(e, dur);
  let k = limites.findIndex((l) => t < l.desde + l.dura);

  if (k < 0) k = limites.length - 1;

  return { k, tc: t - limites[k].desde, porCorte: limites[k].dura };
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

  /* La repetición: viñeta más cerrada, una franja de oro arriba y el rótulo «REPETICIÓN» latiendo. */
  if (corte.repeticion) {
    const pulso = 0.75 + Math.sin(t * 7) * 0.25;

    ctx.fillStyle = "rgba(200,169,107,0.9)";
    ctx.fillRect(0, 0, ANCHO, 5);
    ctx.globalAlpha = pulso;
    ctx.fillStyle = ORO;
    ctx.fillRect(ANCHO - 56 - 290, 96, 290, 40);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0B0F14";
    ctx.font = `700 22px ${fuente}`;
    ctx.textAlign = "center";
    ctx.fillText("REPETICIÓN · CÁMARA LENTA", ANCHO - 56 - 145, 123);
    ctx.textAlign = "left";
  }

  /* Sin la lectura táctica debajo (15/10/2026, a petición del cuerpo técnico): la jugada habla sola; queda el rótulo. */
  rotuloBajo(ctx, fuente, principal, resto.join(" · "), tc, ALTO - 140);

  if (corte.tipo === "gol" && !corte.repeticion) estallidoGol(ctx, fuente, tc);

  /* La línea del partido (arriba, bajo el título) y el campo pequeño con la jugada (arriba a la derecha). */
  if (e.marcas?.length) lineaDelPartido(ctx, fuente, e.marcas, corte.minutoNum ?? 0, tc);

  if (corte.zona && !corte.repeticion) campoDeLaJugada(ctx, fuente, corte as CortePartido, tc);

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

function pintaCierre(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "cierre" }>, rec: Recursos, t: number) {
  const velo = ctx.createRadialGradient(ANCHO / 2, ALTO * 0.45, 60, ANCHO / 2, ALTO * 0.45, ANCHO * 0.7);
  velo.addColorStop(0, "rgba(8,17,31,0.72)");
  velo.addColorStop(1, "rgba(8,17,31,0.96)");
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  /* Nuestro escudo (el de la portada), con un anillo de oro que se cierra. */
  const escudo = [...rec.imagenes.entries()].find(([k, v]) => k.endsWith(":nosotros") && v)?.[1] ?? null;
  const cy = 210;
  const a = salta((t - 0.1) / 0.8);

  if (a > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    halo(ctx, ANCHO / 2, cy, 150);
    medallon(ctx, fuente, escudo, ANCHO / 2, cy, 78 * Math.max(0.3, a), "rgba(255,255,255,0.0)", "RM");
    ctx.restore();
    anillo(ctx, ANCHO / 2, cy, 98, 5, tramo(t, 0.3, 1.2), ORO, "rgba(255,255,255,0.08)");
  }

  const b = tramo(t, 0.7, 0.6);

  ctx.globalAlpha = b;
  ctx.fillStyle = ORO;
  ctx.font = `700 26px ${fuente}`;
  espaciado(ctx, "REAL MADRID CASTILLA", ANCHO / 2, 352, 7, "center");
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `600 24px ${fuente}`;
  espaciado(ctx, e.titulo.toUpperCase(), ANCHO / 2, 390, 3, "center");

  const largo = e.lineas.slice(0, 2).join("").length > 70;
  const cuerpo = largo ? 38 : 52;

  ctx.fillStyle = BLANCO;
  ctx.font = `700 ${cuerpo}px ${fuente}`;
  ctx.textAlign = "center";

  let y = largo ? 458 : 470;

  e.lineas.slice(0, 2).forEach((linea, i) => {
    const c = tramo(t, 1 + i * 0.3, 0.6);

    ctx.globalAlpha = c;
    /* La segunda línea (lo que hay que mejorar), en oro. */
    ctx.fillStyle = largo && i === 1 ? ORO : BLANCO;

    for (const l of parteLineas(ctx, linea, ANCHO - 200).slice(0, 2)) {
      ctx.fillText(l, ANCHO / 2, y + (1 - c) * 20);
      y += cuerpo + 8;
    }

    y += largo ? 10 : 0;
  });

  ctx.textAlign = "left";
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
  /** Dónde empieza cada escena (0→1 del vídeo), para las muescas de la barra. */
  marcas?: number[];
};

/** Pinta un fotograma completo: plató, escena, acabado y fundidos. */
/* ------------------------------------------------------------------ */
/*  LAS ESCENAS DE DATOS (14/10/2026)                                  */
/* ------------------------------------------------------------------ */

const VERDE = "#2FB67C";
const ROJO = "#E05252";
const GRIS = "#8A94A6";

const colorRacha = (r: string) => (r === "G" ? VERDE : r === "P" ? ROJO : GRIS);

/** Una tarjeta oscura con degradado, como las de las claves. */
function tarjeta(ctx: Lienzo, x: number, y: number, w: number, h: number, filo: string | null = ORO) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "rgba(18,34,58,0.95)");
  g.addColorStop(1, "rgba(8,17,31,0.78)");
  ctx.fillStyle = g;
  caja(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (filo) {
    ctx.fillStyle = filo;
    caja(ctx, x, y, w, 5, 2.5);
    ctx.fill();
  }
}

/**
 * El gancho: el dato, enorme y en oro, entra con un golpe de luz; encima lo
 * que es y debajo por qué importa. Son los tres primeros segundos, los que
 * deciden si se sigue mirando.
 */
function pintaGancho(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "gancho" }>, t: number) {
  const golpe = Math.max(0, 1 - t / 0.5);

  halo(ctx, ANCHO / 2, ALTO / 2 - 10, 520 + golpe * 120);

  if (golpe > 0) {
    ctx.fillStyle = `rgba(255,240,210,${golpe * 0.35})`;
    ctx.fillRect(0, 0, ANCHO, ALTO);
  }

  const a = salta(t / 0.55);
  const escala = 0.7 + 0.3 * Math.min(1, a);
  const largo = e.dato.length > 6;
  const tam = largo ? 150 : 230;

  ctx.save();
  ctx.translate(ANCHO / 2, ALTO / 2 + 50);
  ctx.scale(escala, escala);
  ctx.globalAlpha = Math.min(1, a);
  ctx.font = `700 ${tam}px ${fuente}`;
  ctx.textAlign = "center";

  const g = ctx.createLinearGradient(0, -tam, 0, 0);
  g.addColorStop(0, "#F6E3B4");
  g.addColorStop(1, "#B8935A");
  ctx.fillStyle = g;
  ctx.fillText(e.dato, 0, 0);
  ctx.restore();

  ctx.globalAlpha = tramo(t, 0.25, 0.5);
  ctx.fillStyle = BLANCO;
  ctx.font = `700 34px ${fuente}`;
  ctx.textAlign = "center";
  espaciado(ctx, e.rotulo, ANCHO / 2, ALTO / 2 - (largo ? 110 : 160), 4, "center");

  ctx.globalAlpha = tramo(t, 0.6, 0.6);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `500 30px ${fuente}`;
  parteLineas(ctx, e.contexto, ANCHO - 260)
    .slice(0, 2)
    .forEach((l, i) => ctx.fillText(l, ANCHO / 2, ALTO / 2 + 120 + i * 38));

  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

/** La clasificación y la racha de los dos, en dos tarjetas enfrentadas. */
function pintaContexto(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "contexto" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const w = (ANCHO - 112 - 40) / 2;
  const h = 330;
  const y0 = 210;

  e.equipos.slice(0, 2).forEach((eq, i) => {
    const a = salta((t - (0.4 + i * 0.25)) / 0.6);

    if (a <= 0) return;

    const x = 56 + i * (w + 40) + (1 - Math.min(1, a)) * (i ? 60 : -60);
    const conta = tramo(t, 0.55 + i * 0.25, 1.1);

    ctx.globalAlpha = Math.min(1, a);
    tarjeta(ctx, x, y0, w, h, eq.nuestro ? ORO : "rgba(255,255,255,0.7)");

    ctx.fillStyle = eq.nuestro ? ORO : "rgba(255,255,255,0.75)";
    ctx.font = `600 20px ${fuente}`;
    espaciado(ctx, eq.nombre.toUpperCase(), x + 28, y0 + 50, 1.6);

    ctx.fillStyle = BLANCO;
    ctx.font = `700 120px ${fuente}`;
    ctx.fillText(eq.puesto ? `${eq.puesto}º` : "–", x + 26, y0 + 172);

    if (eq.puntos !== null) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `500 26px ${fuente}`;
      ctx.fillText(`${cuenta(String(eq.puntos), conta)} puntos`, x + 30, y0 + 214);
    }

    /* La racha: una ficha por partido, del más antiguo al último, entrando de una en una. */
    const racha = [...eq.racha].reverse();

    racha.forEach((r, k) => {
      const ak = tramo(t, 0.9 + i * 0.25 + k * 0.1, 0.35);
      const cx = x + 30 + k * 64;
      const cy = y0 + h - 70;

      ctx.globalAlpha = Math.min(1, a) * ak;
      ctx.fillStyle = colorRacha(r);
      caja(ctx, cx, cy, 52, 44, 10);
      ctx.fill();
      ctx.fillStyle = BLANCO;
      ctx.font = `700 26px ${fuente}`;
      ctx.textAlign = "center";
      ctx.fillText(r, cx + 26, cy + 31);
      ctx.textAlign = "left";
    });

    if (racha.length) {
      ctx.globalAlpha = Math.min(1, a) * 0.5;
      ctx.fillStyle = BLANCO;
      ctx.font = `500 17px ${fuente}`;
      ctx.fillText("ÚLTIMOS PARTIDOS →", x + 30, y0 + h - 84);
    }

    ctx.globalAlpha = 1;
  });
}

/**
 * Cara a cara: cada cifra con su barra hacia los dos lados desde el centro,
 * la nuestra en oro y la suya en blanco. La que gana se ilumina y una raya
 * fina marca la media de la liga.
 */
function pintaVersus(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "versus" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const filas = e.filas.slice(0, 6);
  const cx = ANCHO / 2;
  const mitad = 330;
  const paso = filas.length > 5 ? 62 : 70;
  const y0 = 262;

  ctx.globalAlpha = tramo(t, 0.3, 0.4);
  ctx.font = `700 22px ${fuente}`;
  ctx.fillStyle = ORO;
  espaciado(ctx, "CASTILLA", cx - mitad - 120, y0 - 50, 3);
  ctx.fillStyle = BLANCO;
  ctx.textAlign = "right";
  ctx.fillText("RIVAL", cx + mitad + 120, y0 - 50);
  ctx.textAlign = "left";

  filas.forEach((f, i) => {
    const a = tramo(t, 0.45 + i * 0.16, 1.0);
    const y = y0 + i * paso;
    const tope = Math.max(f.nuestro, f.suyo, f.media ?? 0, 0.0001);
    const gana = f.mejorAlto === null || f.nuestro === f.suyo ? null : (f.nuestro > f.suyo) === f.mejorAlto ? "nosotros" : "rival";

    ctx.globalAlpha = tramo(t, 0.35 + i * 0.16, 0.4);

    /* El nombre de la cifra, centrado, sobre las barras. */
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = `600 19px ${fuente}`;
    ctx.textAlign = "center";
    ctx.fillText(f.nombre.toUpperCase(), cx, y - 14);
    ctx.textAlign = "left";

    /* Las pistas. */
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    caja(ctx, cx - mitad, y - 4, mitad - 8, 22, 11);
    ctx.fill();
    caja(ctx, cx + 8, y - 4, mitad - 8, 22, 11);
    ctx.fill();

    const wn = Math.max(10, (mitad - 8) * (f.nuestro / tope) * a);
    const ws = Math.max(10, (mitad - 8) * (f.suyo / tope) * a);

    ctx.fillStyle = gana === "nosotros" ? ORO : "rgba(200,169,107,0.5)";
    caja(ctx, cx - 8 - wn, y - 4, wn, 22, 11);
    ctx.fill();
    ctx.fillStyle = gana === "rival" ? BLANCO : "rgba(255,255,255,0.42)";
    caja(ctx, cx + 8, y - 4, ws, 22, 11);
    ctx.fill();

    /* La media de la liga, una raya a cada lado. */
    if (f.media !== null && f.media > 0) {
      const wm = (mitad - 8) * (f.media / tope);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(cx - 8 - wm - 1, y - 9, 2, 32);
      ctx.fillRect(cx + 8 + wm - 1, y - 9, 2, 32);
    }

    /* Los valores, en los extremos. */
    ctx.font = `700 30px ${fuente}`;
    ctx.fillStyle = gana === "nosotros" ? ORO : BLANCO;
    ctx.textAlign = "right";
    ctx.fillText(cuenta(f.textoNuestro, a), cx - mitad - 16, y + 17);
    ctx.textAlign = "left";
    ctx.fillStyle = gana === "rival" ? BLANCO : "rgba(255,255,255,0.75)";
    ctx.fillText(cuenta(f.textoSuyo, a), cx + mitad + 16, y + 17);
  });

  ctx.globalAlpha = tramo(t, 1.2, 0.6) * 0.6;
  ctx.fillStyle = BLANCO;
  ctx.font = `400 19px ${fuente}`;
  ctx.textAlign = "center";
  ctx.fillText(e.pie, cx, ALTO - 40);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

/** Fase a fase en percentil: la pista de 0 a 100 con la mediana marcada; arriba de 66 brilla, abajo de 33 se apaga. */
function pintaPercentiles(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "percentiles" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const filas = e.filas.slice(0, 6);
  const x0 = 380;
  const largo = ANCHO - x0 - 160;
  const paso = filas.length > 5 ? 66 : 76;

  filas.forEach((f, i) => {
    const a = tramo(t, 0.45 + i * 0.18, 1.1);
    const y = 236 + i * paso;
    const p = Math.max(0, Math.min(100, f.percentil));
    const color = p >= 66 ? ORO : p >= 33 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.32)";

    ctx.globalAlpha = tramo(t, 0.35 + i * 0.18, 0.4);
    ctx.fillStyle = BLANCO;
    ctx.font = `600 25px ${fuente}`;
    parteLineas(ctx, f.nombre.toUpperCase(), x0 - 90).slice(0, 1).forEach((l) => ctx.fillText(l, 56, y + 9));

    ctx.fillStyle = "rgba(255,255,255,0.07)";
    caja(ctx, x0, y - 13, largo, 26, 13);
    ctx.fill();

    ctx.fillStyle = color;
    caja(ctx, x0, y - 13, Math.max(26, largo * (p / 100) * a), 26, 13);
    ctx.fill();

    /* La mediana (percentil 50). */
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(x0 + largo / 2 - 1, y - 20, 2, 40);

    ctx.font = `700 28px ${fuente}`;
    ctx.fillStyle = p >= 66 ? ORO : BLANCO;
    ctx.fillText(String(Math.round(p * a)), x0 + largo + 22, y + 10);
  });

  ctx.globalAlpha = tramo(t, 1.2, 0.6) * 0.6;
  ctx.fillStyle = BLANCO;
  ctx.font = `400 19px ${fuente}`;
  ctx.fillText(`${e.pie} · la raya, la mediana`, 56, ALTO - 40);
  ctx.globalAlpha = 1;
}

/** Los duelos: los nuestros a la izquierda, los suyos a la derecha y el veredicto en el centro. */
function pintaDuelos(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "duelos" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const lista = e.duelos.slice(0, 3);
  const h = 128;
  const hueco = 18;

  lista.forEach((d, i) => {
    const a = salta((t - (0.45 + i * 0.3)) / 0.6);

    if (a <= 0) return;

    const y = 200 + i * (h + hueco);
    const color = d.veredicto === "ventaja" ? VERDE : d.veredicto === "desventaja" ? ROJO : GRIS;
    const veredicto = d.veredicto === "ventaja" ? "VENTAJA" : d.veredicto === "desventaja" ? "SUYA" : "PAREJO";

    ctx.globalAlpha = Math.min(1, a);
    tarjeta(ctx, 56, y, ANCHO - 112, h, null);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `600 18px ${fuente}`;
    espaciado(ctx, d.titulo.toUpperCase(), 84, y + 34, 1.4);

    ctx.font = `700 30px ${fuente}`;
    ctx.fillStyle = ORO;
    parteLineas(ctx, d.nuestros, 420).slice(0, 1).forEach((l) => ctx.fillText(l, 84, y + 76));
    ctx.fillStyle = BLANCO;
    ctx.textAlign = "right";
    parteLineas(ctx, d.suyos, 420).slice(0, 1).forEach((l) => ctx.fillText(l, ANCHO - 84, y + 76));
    ctx.textAlign = "left";

    /* El veredicto, en una píldora de color en el centro. */
    ctx.font = `700 20px ${fuente}`;
    const wv = ctx.measureText(veredicto).width + 34;

    ctx.fillStyle = color;
    caja(ctx, ANCHO / 2 - wv / 2, y + 52, wv, 34, 17);
    ctx.fill();
    ctx.fillStyle = BLANCO;
    ctx.textAlign = "center";
    ctx.fillText(veredicto, ANCHO / 2, y + 76);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `400 19px ${fuente}`;
    ctx.fillText(d.texto, ANCHO / 2, y + h - 16);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  });
}

/**
 * El balance del post: una tarjeta por meta, con lo que buscábamos a la
 * izquierda, lo que logramos a la derecha y una píldora con el veredicto. Abajo,
 * el recuento («Cumplimos 2 de 3»).
 */
function pintaBalance(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "balance" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const filas = e.filas.slice(0, 4);
  const hueco = 14;
  const h = filas.length > 3 ? 98 : 112;
  const y0 = 212;
  const xMedio = 640;

  /* Las cabeceras de las dos columnas. */
  const c = tramo(t, 0.3, 0.5);

  ctx.globalAlpha = c;
  ctx.font = `700 17px ${fuente}`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  espaciado(ctx, "LO QUE BUSCÁBAMOS", 84, y0 - 12, 2.2);
  ctx.fillStyle = ORO;
  espaciado(ctx, "LO QUE LOGRAMOS", xMedio + 20, y0 - 12, 2.2);
  ctx.globalAlpha = 1;

  filas.forEach((x, i) => {
    const a = salta((t - (0.5 + i * 0.35)) / 0.6);

    if (a <= 0) return;

    const y = y0 + i * (h + hueco);
    const color = x.estado === "si" ? VERDE : x.estado === "no" ? ROJO : x.estado === "parcial" ? ORO : GRIS;
    const veredicto = x.estado === "si" ? "CUMPLIDO" : x.estado === "no" ? "NO" : x.estado === "parcial" ? "A MEDIAS" : "PENDIENTE";

    ctx.globalAlpha = Math.min(1, a);
    tarjeta(ctx, 56, y, ANCHO - 112, h, null);

    /* El filo de color a la izquierda: el veredicto se lee de un vistazo. */
    ctx.fillStyle = color;
    ctx.fillRect(56, y, 6, h);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `600 16px ${fuente}`;
    espaciado(ctx, x.que.toUpperCase(), 84, y + 28, 1.4);

    ctx.fillStyle = BLANCO;
    ctx.font = `600 24px ${fuente}`;
    parteLineas(ctx, x.buscabamos, xMedio - 84 - 40)
      .slice(0, 2)
      .forEach((l, k) => ctx.fillText(l, 84, y + 60 + k * 28));

    /* La flecha entre las dos columnas, dibujada (Barlow no trae «→»). */
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xMedio - 26, y + h / 2 + 6);
    ctx.lineTo(xMedio + 2, y + h / 2 + 6);
    ctx.moveTo(xMedio - 6, y + h / 2 - 2);
    ctx.lineTo(xMedio + 2, y + h / 2 + 6);
    ctx.lineTo(xMedio - 6, y + h / 2 + 14);
    ctx.stroke();

    ctx.font = `700 17px ${fuente}`;
    const wv = ctx.measureText(veredicto).width + 30;
    const xv = ANCHO - 84 - wv;

    ctx.fillStyle = ORO;
    ctx.font = `700 26px ${fuente}`;
    parteLineas(ctx, x.logramos, xv - (xMedio + 20) - 16)
      .slice(0, 2)
      .forEach((l, k) => ctx.fillText(l, xMedio + 20, y + 60 + k * 30));

    ctx.fillStyle = color;
    caja(ctx, xv, y + h / 2 - 15, wv, 30, 15);
    ctx.fill();
    ctx.fillStyle = x.estado === "parcial" ? "#0B0F14" : BLANCO;
    ctx.font = `700 17px ${fuente}`;
    ctx.textAlign = "center";
    ctx.fillText(veredicto, xv + wv / 2, y + h / 2 + 6);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  });

  const r = tramo(t, 0.6 + filas.length * 0.35, 0.6);

  ctx.globalAlpha = r;
  ctx.fillStyle = BLANCO;
  ctx.font = `700 28px ${fuente}`;
  ctx.textAlign = "center";
  ctx.fillText(e.resumen, ANCHO / 2, y0 + filas.length * (h + hueco) + 34);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

/** Cómo juegan: cuatro baldosas, una por momento del juego, y debajo dónde hacerles daño. */
function pintaFases(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "fases" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const fases = e.fases.slice(0, 4);
  const n = fases.length;
  const hueco = 18;
  const w = (ANCHO - 112 - (n - 1) * hueco) / n;
  const h = e.dano.length ? 300 : 380;
  const y0 = 200;

  fases.forEach((f, i) => {
    const a = salta((t - (0.45 + i * 0.22)) / 0.6);

    if (a <= 0) return;

    const x = 56 + i * (w + hueco);
    const y = y0 + (1 - Math.min(1, a)) * 40;

    ctx.globalAlpha = Math.min(1, a);
    tarjeta(ctx, x, y, w, h);

    ctx.fillStyle = ORO;
    ctx.font = `700 46px ${fuente}`;
    ctx.fillText(String(i + 1).padStart(2, "0"), x + 22, y + 66);

    ctx.fillStyle = BLANCO;
    ctx.font = `700 24px ${fuente}`;
    parteLineas(ctx, f.titulo.toUpperCase(), w - 44).slice(0, 2).forEach((l, k) => ctx.fillText(l, x + 22, y + 108 + k * 28));

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = `400 21px ${fuente}`;
    parteLineas(ctx, f.texto, w - 44)
      .slice(0, e.dano.length ? 5 : 8)
      .forEach((l, k) => ctx.fillText(l, x + 22, y + 160 + k * 26));
    ctx.globalAlpha = 1;
  });

  if (e.dano.length) {
    const a = tramo(t, 1.4, 0.6);
    const y = y0 + h + 22;

    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(200,169,107,0.14)";
    caja(ctx, 56, y, ANCHO - 112, 86, 14);
    ctx.fill();
    ctx.fillStyle = ORO;
    ctx.font = `700 19px ${fuente}`;
    espaciado(ctx, "DÓNDE HACERLES DAÑO", 80, y + 32, 2.2);
    ctx.fillStyle = BLANCO;
    ctx.font = `500 22px ${fuente}`;
    ctx.fillText(e.dano.join("  ·  ").slice(0, 110), 80, y + 66);
    ctx.globalAlpha = 1;
  }
}

export function pintaFotograma(ctx: Lienzo, grano: Dibujable, fuente: string, titulo: string, rec: Recursos, f: Fotograma) {
  const e = f.medida.escena;
  const conCampo = e.tipo === "portada" || e.tipo === "cierre" || e.tipo === "once";
  const escala = (ctx.canvas?.width || ANCHO) / ANCHO;

  ctx.setTransform(escala, 0, 0, escala, 0, 0);
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
    else if (e.tipo === "gancho") pintaGancho(ctx, fuente, e, f.t);
    else if (e.tipo === "contexto") pintaContexto(ctx, fuente, e, f.t);
    else if (e.tipo === "versus") pintaVersus(ctx, fuente, e, f.t);
    else if (e.tipo === "percentiles") pintaPercentiles(ctx, fuente, e, f.t);
    else if (e.tipo === "duelos") pintaDuelos(ctx, fuente, e, f.t);
    else if (e.tipo === "fases") pintaFases(ctx, fuente, e, f.t);
    else if (e.tipo === "balance") pintaBalance(ctx, fuente, e, f.t);
    else pintaCierre(ctx, fuente, e, rec, f.t);

    if (e.tipo === "claves" || e.tipo === "cifras" || e.tipo === "barras" || e.tipo === "imagen" || e.tipo === "vigilar") pieLocucion(ctx, fuente, e.locucion, f.t);
  }

  acabado(ctx, grano, f.progreso, titulo, fuente, f.marcas);

  /*
  | Entre escenas, cortinilla en diagonal (14/10/2026; antes fundido a negro):
  | entra en los últimos 0,4 s de una escena y sale en los primeros 0,45 de la
  | siguiente. Los cortes de vídeo la llevan más corta para no comerse la jugada.
  */
  const entrada = e.tipo === "clips" ? 0.3 : 0.45;
  const salida = e.tipo === "clips" ? 0.25 : 0.4;

  if (f.t < entrada) cortinilla(ctx, ANCHO, ALTO, "sale", f.t / entrada, ORO, FONDO);
  else if (f.restante < salida) cortinilla(ctx, ANCHO, ALTO, "entra", 1 - f.restante / salida, ORO, FONDO);
}
