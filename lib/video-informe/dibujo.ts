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
import { SEGUNDOS_MAXIMOS, SEGUNDOS_MINIMOS, type Corte, type CortePartido, type Escena, type GuionVideo, type MarcaPartido } from "./guion";

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
/** En qué segundo de la portada se saca el póster: con el título, la jornada y la idea ya dentro. */
export const SEGUNDO_POSTER = 3;

const FONDO = "#08111F";
const ORO = "#C8A96B";
const BLANCO = "#FFFFFF";

/**
 * Lo que duraba cada escena hasta el 20/10/2026 (casi fijo, 7-8 s, dijera lo
 * que dijera). Queda como referencia; la duración la da `segundosDeEscena`.
 */
export const SEGUNDOS: Record<Escena["tipo"], number> = { portada: 5.5, cifras: 7, claves: 8, barras: 7, once: 8, vigilar: 7, clips: 10, imagen: 7, cierre: 5.5, gancho: 3.6, contexto: 7, versus: 8, percentiles: 7, duelos: 8, fases: 9, balance: 10 };
const AIRE = 0.7;

/*
| LA DURACIÓN POR CONTENIDO (20/10/2026, crítica del editor de vídeo: «el
| ritmo queda plano y hay tiempo muerto en las pantallas con poco texto»):
| 2 s de entrada + 0,35 s por palabra visible o por elemento (barra, fila,
| duelo), entre 3,5 y 8 s. Tres excepciones con su propio reloj: el gancho
| (3,5 s), las claves (3 s cada una, entran de una en una, + 1 s) y el balance
| del post (3 s por meta + 2,5 s del recuento).
*/
const ENTRADA = 2;
const POR_PALABRA = 0.35;
const SUELO = 3.5;
const TECHO = 8;

const palabras = (t: string | undefined) => (t ? t.split(/\s+/).filter(Boolean).length : 0);

/** Cuánto hay que leer en una escena: palabras visibles y elementos (sin el título, que se cuenta aparte). */
export function contenidoDeEscena(e: Escena): number {
  switch (e.tipo) {
    case "cifras":
      return e.cifras.reduce((s, c) => s + palabras(c.rotulo) + (c.valor.length > 12 ? palabras(c.valor) : 1) + palabras(c.pie), 0);
    case "barras":
      return e.barras.length;
    case "once":
      return Math.ceil(e.jugadores.length / 2);
    case "vigilar":
      return e.jugadores.reduce((s, j) => s + palabras(j.nombre) + palabras(j.texto), 0);
    case "imagen":
      return palabras(e.pie);
    case "cierre":
      return e.lineas.reduce((s, l) => s + palabras(l), 0);
    case "contexto":
      return 2 * e.equipos.length;
    case "versus":
      return Math.ceil(e.filas.length * 1.5);
    case "percentiles":
      return e.filas.length;
    case "duelos":
      return e.duelos.reduce((s, d) => s + palabras(d.texto) + 2, 0);
    case "fases":
      return e.fases.reduce((s, f) => s + palabras(f.titulo) + palabras(f.texto), 0) + e.dano.reduce((s, d) => s + palabras(d), 0);
    default:
      return 0;
  }
}

/** Lo que dura una escena si la voz no manda otra cosa. */
export function segundosDeEscena(e: Escena): number {
  if (e.tipo === "clips") return e.segundos;
  if (e.tipo === "gancho") return 3.5;
  if (e.tipo === "portada") return e.idea ? 5 : 4.5;
  if (e.tipo === "claves") return 1 + 3 * Math.min(4, e.lineas.length);
  if (e.tipo === "balance") return 2.5 + 3 * Math.min(4, e.filas.length);
  /* Dos tarjetas por escena, 4 s cada una (21/10/2026, crítica del editor); con «dónde hacerles daño», un segundo más. */
  if (e.tipo === "fases" && e.fases.length <= 2) return e.dano.length ? 5 : 4;

  /* El título se lee mientras entra lo demás: no cuenta. Y nunca por debajo de la base de su tipo (la que fijó la crítica). */
  return Math.min(TECHO, Math.max(SUELO, BASE[e.tipo] ?? 0, ENTRADA + POR_PALABRA * contenidoDeEscena(e)));
}

/** El mínimo de cada tipo de escena de datos (20/10/2026: antes 7-9 s; las barras necesitan su cascada y la comparativa, leer cinco filas). */
const BASE: Partial<Record<Escena["tipo"], number>> = { cifras: 4.5, barras: 5, contexto: 5, vigilar: 5.5, versus: 6, percentiles: 5, once: 5, fases: 6, duelos: 6, imagen: 5 };

/** Las que se sacrifican primero si no cabe en el tiempo, por este orden. */
const PRESCINDIBLES = ["abp", "duelo", "acierto", "percentiles", "contexto", "duelos", "fases-2", "fases", "grafico-2", "lamina-2", "grafico-1", "lamina-1", "rival", "clips-rival-2", "abp-banda", "vigilar", "clips-3", "clips-2", "grafico-0", "lamina-0", "abp-suyos", "once", "pronostico", "plan", "cifras", "clips-1", "clips", "abp-nuestros", "analisis-previo", "versus"];

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

/** Como mucho, cuánto aire se da a una escena sin cortes si el vídeo no llega al mínimo (20/10/2026; antes se estiraba todo ×1,8 y quedaban pantallas quietas). */
const AIRE_MAXIMO = 1;

/**
 * Los segundos de aire que recibe cada escena sin cortes si el vídeo no llega
 * al mínimo (entre 0 y 1). Se lo pasa a `palabrasDeEscena` para que la IA sepa
 * cuánto puede escribir. (Hasta el 20/10/2026 era un factor de estiramiento.)
 */
export function estiramiento(guion: GuionVideo, minimo = SEGUNDOS_MINIMOS) {
  const total = guion.escenas.reduce((s, e) => s + segundosDeEscena(e), 0);
  const sinCortes = guion.escenas.filter((e) => e.tipo !== "clips").length;

  return sinCortes && total < minimo ? Math.min(AIRE_MAXIMO, (minimo - total) / sinCortes) : 0;
}

/** Las palabras que caben en la locución de cada escena (2,4 por segundo), contando el aire que se le da si el vídeo es corto. */
export function palabrasDeEscena(e: Escena, aire = 0) {
  return Math.ceil((e.tipo === "clips" ? e.segundos : segundosDeEscena(e) + aire) * 2.4);
}

export function reparteEscenas(guion: GuionVideo, pistas: (Float32Array | null)[] | null, frecuencia: number, tope = SEGUNDOS_MAXIMOS, minimo = SEGUNDOS_MINIMOS): EscenaMedida[] {
  let lista: EscenaMedida[] = guion.escenas.map((escena, i) => {
    const pista = pistas?.[i] ?? null;
    const habla = pista ? pista.length / frecuencia : 0;
    const base = segundosDeEscena(escena);

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
  | Y si se queda corto (menos de un minuto), un poco de aire a las escenas
  | sin cortes: como mucho 1 s a cada una y primero a las que más hay que leer
  | (20/10/2026; antes ×1,8 a todas, y una pantalla con dos cifras se quedaba
  | quieta 12 s). Mejor un vídeo de 50 s con ritmo que uno de 60 con relleno.
  */
  if (total() < minimo) {
    const orden = lista
      .map((x, i) => ({ i, peso: x.escena.tipo === "clips" || x.escena.tipo === "gancho" ? -1 : contenidoDeEscena(x.escena) + palabras("titulo" in x.escena ? x.escena.titulo : "") }))
      .filter((x) => x.peso >= 0)
      .sort((a, b) => b.peso - a.peso);

    for (const { i } of orden) {
      const falta = minimo - total();

      if (falta <= 0) break;

      lista[i] = { ...lista[i], segundos: lista[i].segundos + Math.min(AIRE_MAXIMO, falta) };
    }
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

/**
 * La placa de grano: 256×256 de puntos claros y oscuros casi transparentes.
 * Se pinta con `rellenaGrano` sobre un lienzo que da el motor.
 *
 * Antes era ruido gris pintado en modo «overlay»: en el ordenador del club
 * (@napi-rs/canvas) esa fusión en 1080p costaba ~190 ms POR FOTOGRAMA (medido
 * el 16/10/2026: la portada pasaba de 100 a 890 ms). Puntos blancos y negros
 * con alfa de hasta 0,09 en modo normal dan el mismo grano a coste de nada.
 */
export function rellenaGrano(ctx: Lienzo) {
  const img = ctx.createImageData(256, 256);

  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random();
    const claro = v > 0.5 ? 255 : 0;
    img.data[i] = claro;
    img.data[i + 1] = claro;
    img.data[i + 2] = claro;
    img.data[i + 3] = Math.round(Math.abs(v - 0.5) * 2 * 22);
  }

  ctx.putImageData(img, 0, 0);
}

function acabado(ctx: Lienzo, grano: Dibujable, progreso: number, titulo: string, fuente: string, marcas: number[] = []) {
  const v = ctx.createRadialGradient(ANCHO / 2, ALTO / 2, ALTO * 0.35, ANCHO / 2, ALTO / 2, ALTO * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  /* El grano en píxeles de verdad (sin la escala del lienzo lógico) y sin suavizar: es lo más barato de pintar. */
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const anchoReal = ctx.canvas?.width || ANCHO;
  const altoReal = ctx.canvas?.height || ALTO;
  const ox = Math.floor(Math.random() * 256);
  const oy = Math.floor(Math.random() * 256);

  for (let x = -ox; x < anchoReal; x += 256) for (let y = -oy; y < altoReal; y += 256) ctx.drawImage(grano, x, y);

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
function titular(ctx: Lienzo, fuente: string, texto: string, t: number, y = 150, tamPedido = 54) {
  const mayus = texto.toUpperCase();
  const palabras = mayus.split(" ");

  /*
  | Los títulos dicen ahora la conclusión (20/10/2026) y son más largos: si
  | no caben en una línea, la letra baja, pero nunca de 38 px (56 en Full HD).
  */
  let tam = Math.max(TITULO_MINIMO, tamPedido);

  ctx.font = `700 ${tam}px ${fuente}`;

  const cabe = ANCHO - 112;
  const mide = ctx.measureText(mayus).width;

  if (mide > cabe) {
    tam = Math.max(TITULO_MINIMO, Math.floor((tam * cabe) / mide));
    ctx.font = `700 ${tam}px ${fuente}`;
  }

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
  ctx.font = `400 ${LECTURA}px ${fuente}`;
  ctx.textAlign = "left";
  ctx.fillStyle = BLANCO;

  const lineas = parteLineas(ctx, texto, ANCHO - 112).slice(0, 2);

  lineas.forEach((l, i) => ctx.fillText(l, 56, ALTO - 50 + i * 33 - (lineas.length - 1) * 33));
  ctx.globalAlpha = 1;
}

/**
 * Un rótulo bajo («lower third») de retransmisión (14/10/2026): panel con el
 * filo derecho en diagonal que se despliega con un rebote corto, bloque de
 * oro, y los textos entrando un poco después.
 */
function rotuloBajo(ctx: Lienzo, fuente: string, principal: string, secundario: string, t: number, y = ALTO - 150, alfa = 1) {
  const a = salta((t - 0.15) / 0.55);

  if (a <= 0) return;

  /* 40 y 30 px sobre 1280 (21/10/2026, crítica del editor: el rótulo era una línea pequeña, casi ilegible en el móvil). */
  ctx.textAlign = "left";
  ctx.font = `700 40px ${fuente}`;
  const w1 = ctx.measureText(principal).width;
  ctx.font = `500 30px ${fuente}`;
  const w2 = secundario ? ctx.measureText(secundario).width : 0;
  const w = Math.min(Math.max(w1, w2) + 70, ANCHO - 112);
  const alto = secundario ? 100 : 66;
  const x = 56;
  const sesgo = 18;

  ctx.save();
  ctx.globalAlpha = Math.min(1, a) * alfa;
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

  ctx.globalAlpha = b * alfa;
  ctx.fillStyle = BLANCO;
  ctx.font = `700 40px ${fuente}`;
  ctx.fillText(principal, x + 30 - (1 - b) * 16, y + 4);

  if (secundario) {
    const c = tramo(t, 0.42, 0.45);

    ctx.globalAlpha = c * alfa;
    ctx.fillStyle = "rgba(227,201,143,0.95)";
    ctx.font = `500 30px ${fuente}`;
    ctx.fillText(secundario, x + 30 - (1 - c) * 16, y + 42);
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

  /* El título, letra a letra. Con dos líneas o con la idea debajo, algo más pequeño para que quepa todo. */
  ctx.fillStyle = BLANCO;
  ctx.font = `700 92px ${fuente}`;

  const dosLineas = parteLineas(ctx, e.titulo.toUpperCase(), ANCHO - 160).length > 1;
  const tamTitulo = dosLineas ? 66 : e.idea ? 84 : 92;

  ctx.font = `700 ${tamTitulo}px ${fuente}`;

  const lineas = parteLineas(ctx, e.titulo.toUpperCase(), ANCHO - 160).slice(0, 2);
  const yTitulo = e.idea ? 490 : 506;

  lineas.forEach((l, i) => {
    const anchos = [...l].map((c) => ctx.measureText(c).width);
    const total = anchos.reduce((sum, w) => sum + w, 0);
    let x = ANCHO / 2 - total / 2;

    ctx.textAlign = "left";
    [...l].forEach((c, k) => {
      const a = tramo(t, 1.05 + i * 0.25 + k * 0.035, 0.45);

      ctx.globalAlpha = a;
      ctx.fillText(c, x, yTitulo + i * tamTitulo + (1 - a) * 36);
      x += anchos[k];
    });
  });

  /* Dos filetes de oro que se abren desde el centro bajo el título. */
  const f = tramo(t, 1.5, 0.8);
  const yf = yTitulo + 22 + (lineas.length - 1) * tamTitulo;

  ctx.globalAlpha = 1;
  ctx.fillStyle = ORO;
  ctx.fillRect(ANCHO / 2 - 12 - 200 * f, yf, 200 * f, 3);
  ctx.fillRect(ANCHO / 2 + 12, yf, 200 * f, 3);

  const c = tramo(t, 1.7, 0.6);

  ctx.globalAlpha = c * 0.85;
  ctx.textAlign = "center";
  ctx.font = `500 ${LECTURA + 1}px ${fuente}`;
  ctx.fillStyle = BLANCO;
  ctx.fillText(e.subtitulo, ANCHO / 2, yf + 40 + (1 - c) * 10);

  /* La idea del partido (20/10/2026): en oro y en una línea; con ella la portada vale de póster. */
  if (e.idea) {
    const d = tramo(t, 1.95, 0.6);

    ctx.globalAlpha = d;
    ctx.fillStyle = "#E3C98F";
    ctx.font = `700 ${TITULO_MINIMO}px ${fuente}`;
    ctx.fillText(e.idea.toUpperCase(), ANCHO / 2, yf + 92 + (1 - d) * 10);
  }

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

/*
| LOS TAMAÑOS DE LETRA (20/10/2026, crítica del editor: «los textos
| secundarios son diminutos en el móvil»). Las medidas de este fichero son
| del lienzo lógico de 1280×720 y el vídeo sale a 1080: ×1,5. Segunda ronda
| (21/10/2026): 30 px aquí son 45 de verdad (el mínimo de lectura en el
| móvil), 40 son 60 (el mínimo de un título) y las etiquetas en versalitas,
| 24 = 36. Si algo no cabe, se quitan elementos de la escena; la letra no baja.
*/
const LECTURA = 30;
const ETIQUETA = 24;
const TITULO_MINIMO = 40;

/**
 * Las claves, de una en una (20/10/2026, crítica del editor: «son lo único
 * que el entrenador debe recordar y se tratan como una escena más»): la que
 * toca ocupa el centro en grande; las anteriores suben, se encogen y se
 * atenúan al 40 %. Cada una tiene su tramo de la escena (3 s si nada aprieta).
 */
function pintaClaves(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "claves" }>, t: number, dur: number) {
  titular(ctx, fuente, e.titulo, t);

  const lista = e.lineas.slice(0, 4);
  const pies = e.pies ?? [];
  const n = lista.length;

  /*
  | Una sola (21/10/2026, crítica del productor: «una clave grande con el
  | hueco del 02 y del 03 en blanco»): sin número ni hueco; la frase en el
  | centro, grande, y su dato debajo en oro.
  */
  if (n === 1) {
    const a = salta((t - 0.4) / 0.45);

    if (a <= 0) return;

    ctx.globalAlpha = Math.min(1, a);
    tarjeta(ctx, 56, 210, ANCHO - 112, 380);
    ctx.textAlign = "center";
    ctx.fillStyle = BLANCO;
    ctx.font = `700 60px ${fuente}`;

    const partes = parteLineas(ctx, lista[0], ANCHO - 240).slice(0, 3);
    const yMedio = pies[0] ? 370 : 400;

    partes.forEach((p, k) => ctx.fillText(p, ANCHO / 2, yMedio + (k - (partes.length - 1) / 2) * 68));

    if (pies[0]) {
      ctx.globalAlpha = Math.min(1, a) * tramo(t, 1, 0.5);
      ctx.fillStyle = ORO;
      ctx.font = `600 ${LECTURA + 4}px ${fuente}`;
      ctx.fillText(parteLineas(ctx, pies[0], ANCHO - 240)[0] ?? "", ANCHO / 2, yMedio + (partes.length - 1) * 34 + 86);
    }

    ctx.textAlign = "left";
    ctx.globalAlpha = 1;

    return;
  }
  const tramoClave = Math.max(1.2, (dur - 1) / Math.max(1, n));
  const activa = Math.min(n - 1, Math.max(0, Math.floor((t - 0.4) / tramoClave)));
  const anchoTarjeta = ANCHO - 112;
  const altoCompacta = 56;
  const hueco = 10;
  const y0 = 196;

  lista.forEach((linea, i) => {
    if (i > activa) return;

    const desde = 0.4 + i * tramoClave;

    if (i === activa) {
      /* La de ahora: tarjeta grande, número enorme y el texto a 42 px (63 de verdad). */
      const a = salta((t - desde) / 0.3);

      if (a <= 0) return;

      const y = y0 + activa * (altoCompacta + hueco);
      const alto = Math.min(300, ALTO - 40 - y);

      ctx.globalAlpha = Math.min(1, a);
      ctx.save();
      ctx.translate(56 + anchoTarjeta / 2, y + alto / 2);
      ctx.scale(0.92 + 0.08 * Math.min(1, a), 0.92 + 0.08 * Math.min(1, a));
      ctx.translate(-(56 + anchoTarjeta / 2), -(y + alto / 2));

      const g = ctx.createLinearGradient(56, 0, 56 + anchoTarjeta, 0);
      g.addColorStop(0, "rgba(16,30,52,0.95)");
      g.addColorStop(1, "rgba(8,17,31,0.7)");
      ctx.fillStyle = g;
      caja(ctx, 56, y, anchoTarjeta, alto, 18);
      ctx.fill();
      ctx.fillStyle = ORO;
      caja(ctx, 56, y, 8, alto, 4);
      ctx.fill();

      ctx.font = `700 120px ${fuente}`;
      ctx.fillStyle = ORO;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1).padStart(2, "0"), 92, y + alto / 2 + 6);

      ctx.fillStyle = BLANCO;
      ctx.font = `600 44px ${fuente}`;

      /* La consigna en grande y, debajo, en oro, el dato que la sostiene (21/10/2026, crítica del guionista). */
      const pie = pies[i] ?? "";
      const caben = Math.max(1, Math.floor((alto - 30 - (pie ? 46 : 0)) / 52));
      const partes = parteLineas(ctx, linea, anchoTarjeta - 260).slice(0, caben);
      const yCentro = y + alto / 2 - (pie ? 22 : 0);

      partes.forEach((p, k) => ctx.fillText(p, 270, yCentro + (k - (partes.length - 1) / 2) * 52));

      if (pie) {
        ctx.fillStyle = ORO;
        ctx.font = `600 ${LECTURA + 2}px ${fuente}`;
        ctx.fillText(parteLineas(ctx, pie, anchoTarjeta - 260)[0] ?? "", 270, yCentro + ((partes.length - 1) / 2) * 52 + 50);
      }
      ctx.textBaseline = "alphabetic";
      ctx.restore();
      ctx.globalAlpha = 1;

      return;
    }

    /* Las ya dichas: una línea, arriba y al 40 %. */
    const y = y0 + i * (altoCompacta + hueco);

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "rgba(16,30,52,0.9)";
    caja(ctx, 56, y, anchoTarjeta, altoCompacta, 12);
    ctx.fill();
    ctx.fillStyle = ORO;
    ctx.font = `700 32px ${fuente}`;
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1).padStart(2, "0"), 80, y + altoCompacta / 2 + 2);
    ctx.fillStyle = BLANCO;
    ctx.font = `500 ${LECTURA}px ${fuente}`;
    ctx.fillText(parteLineas(ctx, linea, anchoTarjeta - 150)[0] ?? "", 140, y + altoCompacta / 2 + 2);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  });
}

function pintaCifras(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "cifras" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const n = Math.min(4, e.cifras.length);
  const hueco = 22;
  const ancho = (ANCHO - 112 - (n - 1) * hueco) / n;
  const yTarjeta = 206;
  const altoTarjeta = 360;

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

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `600 ${ETIQUETA}px ${fuente}`;
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
      ctx.font = `700 ${largo ? 32 : 92}px ${fuente}`;
      parteLineas(ctx, largo ? c.valor : cuenta(c.valor, conta), ancho - 44)
        .slice(0, largo ? 6 : 2)
        .forEach((l, k) => ctx.fillText(l, x + 22, (largo ? 100 : 160) + y + k * (largo ? 38 : 90)));
    }

    if (c.pie) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `500 ${LECTURA}px ${fuente}`;
      parteLineas(ctx, c.pie, ancho - 44)
        .slice(0, 2)
        .forEach((l, k) => ctx.fillText(l, x + 22, y + altoTarjeta - 58 + k * 31));
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

  /*
  | En cascada y con un orden de lectura (20/10/2026, crítica del editor):
  | cada barra se rellena en 0,6 s, 0,25 s después de la anterior; la
  | principal en oro y el resto en gris azulado, que a los 2 s baja a la mitad
  | para que el ojo se quede en la que importa.
  */
  const apaga = 1 - 0.5 * tramo(t, 0.45 + lista.length * 0.25 + 0.9, 0.6);

  lista.forEach((b, i) => {
    const a = tramo(t, 0.45 + i * 0.25, 0.6);
    const y = 228 + i * paso;
    const destacada = i === mayor;

    ctx.globalAlpha = tramo(t, 0.35 + i * 0.25, 0.3) * (destacada ? 1 : apaga);
    ctx.fillStyle = destacada ? BLANCO : "rgba(255,255,255,0.8)";
    ctx.font = `600 ${LECTURA + 1}px ${fuente}`;
    ctx.textAlign = "left";
    ctx.fillText(b.rotulo.toUpperCase(), 56, y + 9);

    /* La pista y la barra, redondeadas. */
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    caja(ctx, x0, y - 17, largo, 34, 17);
    ctx.fill();

    const w = Math.max(34, largo * (b.valor / maximo) * a);
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, destacada ? "#B8935A" : "rgba(122,138,164,0.75)");
    g.addColorStop(1, destacada ? "#F0D9A6" : "rgba(160,174,198,0.9)");

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

    ctx.font = `700 ${LECTURA}px ${fuente}`;
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

    /* Los nombres, al menos a 24 px (36 de verdad) sobre su banda oscura (21/10/2026; antes 20). */
    const tam = Math.max(24, radio * 0.5);
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

  /* Sin el rótulo «A vigilar» en la esquina (20/10/2026): el aro de oro lo dice en la ficha y el título lo explica. */
}

function pintaVigilar(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "vigilar" }>, rec: Recursos, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const n = Math.min(3, e.jugadores.length);
  const ancho = (ANCHO - 112 - (n - 1) * 24) / n;

  e.jugadores.slice(0, 3).forEach((j, i) => {
    const a = entra(t, 0.4 + i * 0.3, 0.6);
    const x = 56 + i * (ancho + 24);
    const dy = (1 - a) * 40;

    /* Tarjeta más alta y foto más grande (20/10/2026): la frase de cada uno a 40 px de verdad, en blanco. */
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(8,17,31,0.72)";
    ctx.fillRect(x, 196 + dy, ancho, 480);
    ctx.fillStyle = j.destacado ? ORO : "rgba(255,255,255,0.35)";
    ctx.fillRect(x, 196 + dy, ancho, 4);
    medallon(ctx, fuente, rec.imagenes.get(`${e.id}:${i}`) ?? null, x + ancho / 2, 300 + dy, 80, j.destacado ? ORO : "rgba(255,255,255,0.7)", j.dorsal || "·");
    ctx.textAlign = "center";
    ctx.fillStyle = BLANCO;
    ctx.font = `700 ${TITULO_MINIMO}px ${fuente}`;
    ctx.fillText(j.nombre.toUpperCase(), x + ancho / 2, 428 + dy);
    ctx.fillStyle = ORO;
    ctx.font = `600 ${ETIQUETA}px ${fuente}`;
    ctx.fillText([j.dorsal ? `#${j.dorsal}` : "", j.posicion].filter(Boolean).join(" · "), x + ancho / 2, 460 + dy);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `500 ${LECTURA + 3}px ${fuente}`;
    parteLineas(ctx, j.texto ?? "", ancho - 40)
      .slice(0, 4)
      .forEach((l, k) => ctx.fillText(l, x + ancho / 2, 512 + k * 40 + dy));
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

  /* Un VideoFrame (el navegador), una imagen de napi (el club) o un vídeo: cada uno dice su tamaño a su manera. */
  const vw = cuadro ? cuadro.displayWidth || cuadro.videoWidth || cuadro.width : 0;
  const vh = cuadro ? cuadro.displayHeight || cuadro.videoHeight || cuadro.height : 0;

  if (cuadro && vw && vh) {

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

  /* Entre corte y corte, un parpadeo corto (0,15 s, sin llegar a negro): con 0,25 s a fondo parecía que faltaba la jugada. */
  const borde = Math.min(tc / 0.15, (porCorte - tc) / 0.15);

  if (borde < 1) {
    ctx.fillStyle = `rgba(8,17,31,${0.85 * (1 - Math.max(0, borde))})`;
    ctx.fillRect(0, 0, ANCHO, ALTO);
  }

  titular(ctx, fuente, e.titulo, t, 110, 34);

  const corte = e.cortes[k] as Corte & Partial<CortePartido>;
  /*
  | En los cortes del partido (los de Hudl, con `tipo`) sólo la acción y el
  | minuto (15/10/2026): los nombres de rematador y asistente salen de
  | etiquetas que a veces fallan, y la jugada se explica sola.
  */
  const partes = corte.rotulo.split(" · ");
  /*
  | Los del partido (con `tipo`), con el minuto delante y en la misma línea
  | (21/10/2026, crítica del editor: «el corte empieza sin avisar de qué hay
  | que mirar»): «34' · Córner en contra». Se ve al empezar y se retira a los
  | 3,5 s para no tapar la jugada; la línea del partido sigue marcando el minuto.
  */
  /*
  | Arriba, tipo · jornada · minuto; debajo, qué mirar si el corte trae su
  | lectura (21/10/2026, crítica del editor). Los del rival («Córner ofensivo ·
  | VS EUROPA · J8») suben la jornada a la primera línea.
  */
  const jornada = partes.find((p) => /^J\d+$/i.test(p.trim()));
  const principal = corte.tipo ? [partes[0], corte.minuto].filter(Boolean).join(" · ") : [partes[0], jornada].filter(Boolean).join(" · ");
  const queMirar = corte.texto ? parteLineas(ctx, corte.texto, ANCHO - 260)[0] ?? "" : "";
  /* En los del partido el minuto ya va arriba: debajo, sólo qué mirar. */
  const resto = [queMirar || (corte.tipo ? "" : partes.slice(1).filter((p) => p !== jornada).join(" · "))].filter(Boolean);

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
    ctx.font = `700 ${ETIQUETA}px ${fuente}`;
    ctx.textAlign = "center";
    ctx.fillText("REPETICIÓN · CÁMARA LENTA", ANCHO - 56 - 145, 124);
    ctx.textAlign = "left";

    /* Al entrar, una cortinilla de oro de 0,3 s: se distingue de la jugada en directo sin mirar la velocidad. */
    if (tc < 0.3) {
      const x = (tc / 0.3) * (ANCHO + 200) - 100;

      ctx.fillStyle = "rgba(200,169,107,0.85)";
      ctx.beginPath();
      ctx.moveTo(x - 60, 0);
      ctx.lineTo(x + 60, 0);
      ctx.lineTo(x - 40, ALTO);
      ctx.lineTo(x - 160, ALTO);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* Sin la lectura táctica debajo (15/10/2026, a petición del cuerpo técnico): la jugada habla sola; queda el rótulo. */
  const retirada = corte.tipo && !corte.repeticion ? 1 - tramo(tc, 3.5, 0.4) : 1;

  if (retirada > 0 && !corte.repeticion) rotuloBajo(ctx, fuente, principal, resto.join(" · "), tc, ALTO - 140, retirada);

  if (corte.tipo === "gol" && !corte.repeticion) estallidoGol(ctx, fuente, tc);

  /* La línea del partido (arriba, bajo el título) y el campo pequeño con la jugada (arriba a la derecha). */
  if (e.marcas?.length) lineaDelPartido(ctx, fuente, e.marcas, corte.minutoNum ?? 0, tc);

  /* Sin el campo pequeño con la jugada (15/10/2026): se deducía de las zonas de Hudl y podía no ser lo que se ve. */

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
  /* Más abajo que antes (20/10/2026): el título del corte ya no baja de 38 px y el minuto chocaba con su subrayado. */
  const y = 168;
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

  ctx.font = `600 ${ETIQUETA - 2}px ${fuente}`;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
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
      ctx.font = `700 ${ETIQUETA}px ${fuente}`;
      ctx.textAlign = "center";
      ctx.fillText(`${actual}'`, x, m.de === "nosotros" ? y - 24 : y + 38);
      ctx.textAlign = "left";
    }
  }

  ctx.globalAlpha = 1;
}

function pintaCierre(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "cierre" }>, rec: Recursos, t: number, restante = 99) {
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
  ctx.font = `600 ${ETIQUETA + 2}px ${fuente}`;
  espaciado(ctx, e.titulo.toUpperCase(), ANCHO / 2, 390, 3, "center");

  /* La consigna, nunca por debajo de 64 px de verdad (43 aquí): es lo que tiene que quedarse (20/10/2026). */
  const largo = e.lineas.slice(0, 2).join("").length > 70;
  const cuerpo = largo ? 44 : 54;

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

  /* Su dato, en oro y más pequeño (21/10/2026): «3 de sus 5 goles». */
  if (e.pie) {
    ctx.globalAlpha = tramo(t, 1.5, 0.6);
    ctx.fillStyle = ORO;
    ctx.font = `600 ${LECTURA + 4}px ${fuente}`;
    ctx.fillText(parteLineas(ctx, e.pie, ANCHO - 240)[0] ?? "", ANCHO / 2, y + 14);
  }

  /* Fundido a negro de 0,4 s con la música: es la última escena. */
  if (restante < 0.4) {
    ctx.globalAlpha = 1 - restante / 0.4;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, ANCHO, ALTO);
  }

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

const VERDE = "#2EE6A6";
const ROJO = "#FF5A5F";
const TINTA = "#0B0F14";
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

  /*
  | A casi toda la pantalla (20/10/2026, críticas del editor y de marketing:
  | «un número y una frase pequeña que se lee mal en el móvil»): el dato a
  | ~45 % del alto, entrando con un golpe de escala de 0,3 s a la vez que el
  | golpe de la música, y UNA línea debajo. Encima, una etiqueta corta (el
  | rival). El contexto largo ya no se pinta.
  */
  const a = salta(t / 0.3);
  const escala = 0.6 + 0.4 * Math.min(1, a);

  /*
  | 320 px de letra (21/10/2026, crítica de marketing: en la vista previa de
  | WhatsApp, a 444 px de ancho, el «2.º» se veía y lo demás no): la cifra
  | cede sitio a la etiqueta (40 px) y a la línea (56 px).
  */
  ctx.font = `700 320px ${fuente}`;

  const ancho = ctx.measureText(e.dato).width;
  const tam = Math.round(320 * Math.min(1, (ANCHO - 160) / Math.max(1, ancho)));
  const base = 430;

  ctx.save();
  ctx.translate(ANCHO / 2, base);
  ctx.scale(escala, escala);
  ctx.globalAlpha = Math.min(1, a);
  ctx.font = `700 ${tam}px ${fuente}`;
  ctx.textAlign = "center";

  const g = ctx.createLinearGradient(0, -tam * 0.75, 0, 0);
  g.addColorStop(0, "#F6E3B4");
  g.addColorStop(1, "#B8935A");
  ctx.fillStyle = g;
  ctx.fillText(e.dato, 0, 0);
  ctx.restore();

  if (e.antetitulo) {
    ctx.globalAlpha = tramo(t, 0.15, 0.4);
    ctx.fillStyle = ORO;
    ctx.font = `700 40px ${fuente}`;
    espaciado(ctx, e.antetitulo.toUpperCase(), ANCHO / 2, base - tam * 0.75 - 40, 4, "center");
  }

  /* La línea: 56 px (84 en Full HD); si no cabe, en dos renglones y, como mucho, baja hasta 44. */
  const linea = e.rotulo.toUpperCase();
  let tamLinea = 56;

  ctx.font = `700 ${tamLinea}px ${fuente}`;

  let renglones = espaciadoAncho(ctx, linea, 2) > ANCHO - 120 ? parteLineas(ctx, linea, ANCHO - 160).slice(0, 2) : [linea];

  while (tamLinea > 44 && renglones.some((r) => espaciadoAncho(ctx, r, 2) > ANCHO - 120)) {
    tamLinea -= 2;
    ctx.font = `700 ${tamLinea}px ${fuente}`;
    renglones = parteLineas(ctx, linea, ANCHO - 160).slice(0, 2);
  }

  ctx.globalAlpha = tramo(t, 0.35, 0.45);
  ctx.fillStyle = BLANCO;
  renglones.forEach((r, i) => espaciado(ctx, r, ANCHO / 2, base + 80 + i * (tamLinea + 8), 2, "center"));

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

    ctx.fillStyle = eq.nuestro ? ORO : "rgba(255,255,255,0.8)";
    ctx.font = `600 ${ETIQUETA}px ${fuente}`;
    espaciado(ctx, eq.nombre.toUpperCase(), x + 28, y0 + 50, 1.6);

    ctx.fillStyle = BLANCO;
    ctx.font = `700 120px ${fuente}`;
    ctx.fillText(eq.puesto ? `${eq.puesto}º` : "–", x + 26, y0 + 172);

    if (eq.puntos !== null) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = `500 ${LECTURA + 3}px ${fuente}`;
      ctx.fillText(`${cuenta(String(eq.puntos), conta)} puntos`, x + 30, y0 + 216);
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
      ctx.fillStyle = TINTA;
      ctx.font = `700 26px ${fuente}`;
      ctx.textAlign = "center";
      ctx.fillText(r, cx + 26, cy + 31);
      ctx.textAlign = "left";
    });

    if (racha.length) {
      ctx.globalAlpha = Math.min(1, a) * 0.65;
      ctx.fillStyle = BLANCO;
      ctx.font = `500 ${ETIQUETA}px ${fuente}`;
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
  const paso = filas.length > 5 ? 64 : 74;
  const y0 = 262;

  ctx.globalAlpha = tramo(t, 0.3, 0.4);
  ctx.font = `700 ${ETIQUETA}px ${fuente}`;
  ctx.fillStyle = ORO;
  espaciado(ctx, "CASTILLA", cx - mitad - 120, y0 - 50, 3);
  ctx.fillStyle = BLANCO;
  ctx.textAlign = "right";
  ctx.fillText("RIVAL", cx + mitad + 120, y0 - 50);
  ctx.textAlign = "left";

  /* En cascada; la primera fila (la que más separa, la del título) se queda encendida y el resto baja a la mitad a los 2 s (20/10/2026). */
  const apaga = 1 - 0.5 * tramo(t, 0.45 + filas.length * 0.25 + 0.9, 0.6);

  filas.forEach((f, i) => {
    const a = tramo(t, 0.45 + i * 0.25, 0.6);
    const y = y0 + i * paso;
    const tope = Math.max(f.nuestro, f.suyo, f.media ?? 0, 0.0001);
    const gana = f.mejorAlto === null || f.nuestro === f.suyo ? null : (f.nuestro > f.suyo) === f.mejorAlto ? "nosotros" : "rival";

    ctx.globalAlpha = tramo(t, 0.35 + i * 0.25, 0.3) * (i === 0 ? 1 : apaga);

    /* La principal, con un resplandor de oro detrás. */
    if (i === 0) {
      ctx.fillStyle = "rgba(200,169,107,0.12)";
      caja(ctx, cx - mitad - 130, y - 40, (mitad + 130) * 2, paso - 6, 14);
      ctx.fill();
    }

    /* El nombre de la cifra, centrado, sobre las barras. */
    ctx.fillStyle = i === 0 ? ORO : "rgba(255,255,255,0.85)";
    ctx.font = `600 ${ETIQUETA}px ${fuente}`;
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
    ctx.font = `700 ${i === 0 ? 38 : 32}px ${fuente}`;
    ctx.fillStyle = gana === "nosotros" ? ORO : BLANCO;
    ctx.textAlign = "right";
    ctx.fillText(cuenta(f.textoNuestro, a), cx - mitad - 16, y + 17);
    ctx.textAlign = "left";
    ctx.fillStyle = gana === "rival" ? BLANCO : "rgba(255,255,255,0.75)";
    ctx.fillText(cuenta(f.textoSuyo, a), cx + mitad + 16, y + 17);
  });

  ctx.globalAlpha = tramo(t, 1.2, 0.6) * 0.7;
  ctx.fillStyle = BLANCO;
  ctx.font = `400 ${ETIQUETA}px ${fuente}`;
  ctx.textAlign = "center";
  ctx.fillText(e.pie, cx, ALTO - 30);
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

  /* En cascada; la fase más alta se queda encendida y el resto baja a la mitad a los 2 s (20/10/2026). */
  const mejor = filas.reduce((m, f, i) => (f.percentil > filas[m].percentil ? i : m), 0);
  const apaga = 1 - 0.5 * tramo(t, 0.45 + filas.length * 0.25 + 0.9, 0.6);

  filas.forEach((f, i) => {
    const a = tramo(t, 0.45 + i * 0.25, 0.6);
    const y = 236 + i * paso;
    const p = Math.max(0, Math.min(100, f.percentil));
    const color = i === mejor ? ORO : p >= 66 ? "rgba(227,201,143,0.75)" : p >= 33 ? "rgba(160,174,198,0.85)" : "rgba(160,174,198,0.45)";

    ctx.globalAlpha = tramo(t, 0.35 + i * 0.25, 0.3) * (i === mejor ? 1 : apaga);
    ctx.fillStyle = BLANCO;
    ctx.font = `600 ${LECTURA}px ${fuente}`;
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

    ctx.font = `700 ${i === mejor ? 36 : 30}px ${fuente}`;
    ctx.fillStyle = i === mejor ? ORO : BLANCO;
    ctx.fillText(String(Math.round(p * a)), x0 + largo + 22, y + 11);
  });

  /* El pie explica qué es un percentil (sin la sigla): 100 es el mejor de la categoría. */
  ctx.globalAlpha = tramo(t, 1.2, 0.6) * 0.7;
  ctx.fillStyle = BLANCO;
  ctx.font = `400 ${ETIQUETA}px ${fuente}`;
  ctx.fillText(`${e.pie} · 100 = el mejor; la raya, la mitad de la tabla`, 56, ALTO - 30);
  ctx.globalAlpha = 1;
}

/** Los duelos: los nuestros a la izquierda, los suyos a la derecha y el veredicto en el centro. */
function pintaDuelos(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "duelos" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const lista = e.duelos.slice(0, 3);
  /* Tarjetas más altas (20/10/2026): la frase de cada duelo a 40 px de verdad. */
  const h = lista.length > 2 ? 148 : 170;
  const hueco = 14;

  lista.forEach((d, i) => {
    const a = salta((t - (0.45 + i * 0.3)) / 0.6);

    if (a <= 0) return;

    const y = 200 + i * (h + hueco);
    const color = d.veredicto === "ventaja" ? VERDE : d.veredicto === "desventaja" ? ROJO : GRIS;
    const veredicto = d.veredicto === "ventaja" ? "VENTAJA" : d.veredicto === "desventaja" ? "SUYA" : "PAREJO";

    ctx.globalAlpha = Math.min(1, a);
    tarjeta(ctx, 56, y, ANCHO - 112, h, null);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `600 ${ETIQUETA}px ${fuente}`;
    espaciado(ctx, d.titulo.toUpperCase(), 84, y + 34, 1.4);

    ctx.font = `700 32px ${fuente}`;
    ctx.fillStyle = ORO;
    parteLineas(ctx, d.nuestros, 420).slice(0, 1).forEach((l) => ctx.fillText(l, 84, y + 76));
    ctx.fillStyle = BLANCO;
    ctx.textAlign = "right";
    parteLineas(ctx, d.suyos, 420).slice(0, 1).forEach((l) => ctx.fillText(l, ANCHO - 84, y + 76));
    ctx.textAlign = "left";

    /* El veredicto, en una píldora de color en el centro. */
    ctx.font = `700 ${ETIQUETA}px ${fuente}`;
    const wv = ctx.measureText(veredicto).width + 34;

    ctx.fillStyle = color;
    caja(ctx, ANCHO / 2 - wv / 2, y + 52, wv, 36, 18);
    ctx.fill();
    ctx.fillStyle = TINTA;
    ctx.textAlign = "center";
    ctx.fillText(veredicto, ANCHO / 2, y + 78);

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = `500 ${LECTURA}px ${fuente}`;
    parteLineas(ctx, d.texto, ANCHO - 200).slice(0, 1).forEach((l) => ctx.fillText(l, ANCHO / 2, y + h - 22));
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  });
}

/**
 * El balance del post: una tarjeta por meta, con lo que buscábamos a la
 * izquierda, lo que logramos a la derecha y una píldora con el veredicto.
 *
 * De una en una (20/10/2026, crítica del editor: «tres filas en letra pequeña,
 * todas a la vez; nadie lo lee en 10 s en un móvil»): cada meta tiene su tramo
 * (3 s si nada aprieta), la de ahora encendida y las anteriores al 45 %; en
 * los últimos 2,5 s, el recuento en grande («Cumplimos 2 de 3»).
 */
function pintaBalance(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "balance" }>, t: number, dur: number) {
  titular(ctx, fuente, e.titulo, t);

  /* Tres metas como mucho (21/10/2026): a 45 px de verdad no caben cuatro; el guion elige las que más cuentan. */
  const filas = e.filas.slice(0, 3);
  const n = filas.length;
  const hueco = 12;
  const h = 134;
  const y0 = 226;
  const xMedio = 640;
  const final = Math.min(2.5, dur * 0.25);
  const tramoFila = Math.max(0.8, (dur - final - 0.5) / Math.max(1, n));
  const activa = Math.min(n - 1, Math.floor((t - 0.5) / tramoFila));
  const recuento = tramo(t, dur - final, 0.4);

  /* Las cabeceras de las dos columnas. */
  const c = tramo(t, 0.3, 0.5);

  ctx.globalAlpha = c * (1 - 0.6 * recuento);
  ctx.font = `700 ${ETIQUETA}px ${fuente}`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  espaciado(ctx, "LO QUE BUSCÁBAMOS", 84, y0 - 14, 2.2);
  ctx.fillStyle = ORO;
  espaciado(ctx, "LO QUE LOGRAMOS", xMedio + 20, y0 - 14, 2.2);
  ctx.globalAlpha = 1;

  filas.forEach((x, i) => {
    const a = salta((t - (0.5 + i * tramoFila)) / 0.4);

    if (a <= 0) return;

    const y = y0 + i * (h + hueco);
    const color = x.estado === "si" ? VERDE : x.estado === "no" ? ROJO : ORO;
    const veredicto = x.estado === "si" ? "CUMPLIDO" : x.estado === "no" ? "NO" : "A MEDIAS";
    const encendida = i === activa ? 1 : 0.45;

    ctx.globalAlpha = Math.min(1, a) * encendida * (1 - 0.65 * recuento);
    tarjeta(ctx, 56, y, ANCHO - 112, h, null);

    /* El filo de color a la izquierda: el veredicto se lee de un vistazo. */
    ctx.fillStyle = color;
    ctx.fillRect(56, y, 8, h);

    /* El veredicto primero, a la izquierda y con su icono (21/10/2026, crítica del editor): se lee antes que el texto y no depende del color. */
    iconoEstado(ctx, x.estado, 104, y + 40, color);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `600 ${ETIQUETA}px ${fuente}`;
    espaciado(ctx, x.que.toUpperCase(), 136, y + 48, 1.4);

    ctx.fillStyle = BLANCO;
    ctx.font = `600 ${LECTURA}px ${fuente}`;
    parteLineas(ctx, x.buscabamos, xMedio - 84 - 40)
      .slice(0, 2)
      .forEach((l, k) => ctx.fillText(l, 84, y + 88 + k * 34));

    /* La flecha entre las dos columnas, dibujada (Barlow no trae «→»). */
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xMedio - 26, y + h / 2 + 6);
    ctx.lineTo(xMedio + 2, y + h / 2 + 6);
    ctx.moveTo(xMedio - 6, y + h / 2 - 2);
    ctx.lineTo(xMedio + 2, y + h / 2 + 6);
    ctx.lineTo(xMedio - 6, y + h / 2 + 14);
    ctx.stroke();

    ctx.font = `700 ${ETIQUETA}px ${fuente}`;
    const wv = ctx.measureText(veredicto).width + 32;
    const xv = ANCHO - 84 - wv;

    ctx.fillStyle = ORO;
    ctx.font = `700 ${LECTURA + 2}px ${fuente}`;
    parteLineas(ctx, x.logramos, xv - (xMedio + 20) - 16)
      .slice(0, 2)
      .forEach((l, k) => ctx.fillText(l, xMedio + 20, y + 58 + k * 36));

    ctx.fillStyle = color;
    caja(ctx, xv, y + h / 2 - 18, wv, 36, 18);
    ctx.fill();
    ctx.fillStyle = TINTA;
    ctx.font = `700 ${ETIQUETA}px ${fuente}`;
    ctx.textAlign = "center";
    ctx.fillText(veredicto, xv + wv / 2, y + h / 2 + 8);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  });

  /* El recuento, en su propia «pantalla» al final. */
  if (recuento > 0) {
    const s = salta((t - (dur - final)) / 0.35);

    ctx.globalAlpha = recuento;
    ctx.fillStyle = "rgba(8,17,31,0.88)";
    caja(ctx, ANCHO / 2 - 400, ALTO / 2 - 40, 800, 150, 20);
    ctx.fill();
    ctx.fillStyle = ORO;
    caja(ctx, ANCHO / 2 - 400, ALTO / 2 - 40, 800, 6, 3);
    ctx.fill();
    ctx.save();
    ctx.translate(ANCHO / 2, ALTO / 2 + 56);
    ctx.scale(0.85 + 0.15 * Math.min(1, s), 0.85 + 0.15 * Math.min(1, s));
    ctx.fillStyle = BLANCO;
    ctx.font = `700 64px ${fuente}`;
    ctx.textAlign = "center";
    ctx.fillText(e.resumen.toUpperCase(), 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }
}

/** ✓, ✗ o ~ en un círculo de su color, dibujados: el estado no depende sólo del color (daltónicos). */
function iconoEstado(ctx: Lienzo, estado: "si" | "parcial" | "no", cx: number, cy: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();

  if (estado === "si") {
    ctx.moveTo(cx - 9, cy);
    ctx.lineTo(cx - 2, cy + 7);
    ctx.lineTo(cx + 10, cy - 7);
  } else if (estado === "no") {
    ctx.moveTo(cx - 7, cy - 7);
    ctx.lineTo(cx + 7, cy + 7);
    ctx.moveTo(cx + 7, cy - 7);
    ctx.lineTo(cx - 7, cy + 7);
  } else {
    ctx.moveTo(cx - 9, cy + 2);
    ctx.bezierCurveTo(cx - 4, cy - 7, cx + 4, cy + 9, cx + 9, cy - 2);
  }

  ctx.stroke();
  ctx.lineCap = "butt";
}

/** Cómo juegan: cuatro baldosas, una por momento del juego, y debajo dónde hacerles daño. */
function pintaFases(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "fases" }>, t: number) {
  titular(ctx, fuente, e.titulo, t);

  const fases = e.fases.slice(0, 4);
  const n = fases.length;
  /* Con dos tarjetas (21/10/2026), el texto a 36 px y el título a 40. */
  const lectura = n <= 2 ? 36 : LECTURA;
  const interlinea = n <= 2 ? 42 : 34;
  const hueco = 18;
  const w = (ANCHO - 112 - (n - 1) * hueco) / n;
  const h = e.dano.length ? 324 : 410;
  const y0 = 196;

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
    ctx.font = `700 ${lectura + 4}px ${fuente}`;
    parteLineas(ctx, f.titulo.toUpperCase(), w - 44).slice(0, 1).forEach((l) => ctx.fillText(l, x + 22, y + 112));

    /* El texto a 40 px de verdad (20/10/2026); el guion ya lo deja en doce palabras. */
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = `500 ${lectura}px ${fuente}`;
    parteLineas(ctx, f.texto, w - 40)
      .slice(0, Math.floor((h - 130) / interlinea))
      .forEach((l, k) => ctx.fillText(l, x + 22, y + 160 + k * interlinea));
    ctx.globalAlpha = 1;
  });

  if (e.dano.length) {
    const a = tramo(t, 1.4, 0.6);
    const y = y0 + h + 16;

    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(200,169,107,0.14)";
    caja(ctx, 56, y, ANCHO - 112, 92, 14);
    ctx.fill();
    ctx.fillStyle = ORO;
    ctx.font = `700 ${ETIQUETA}px ${fuente}`;
    espaciado(ctx, "DÓNDE HACERLES DAÑO", 80, y + 32, 2.2);
    ctx.fillStyle = BLANCO;
    ctx.font = `600 ${lectura}px ${fuente}`;
    ctx.fillText(parteLineas(ctx, e.dano.join("  ·  "), ANCHO - 160)[0] ?? "", 80, y + 72);
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
    else if (e.tipo === "claves") pintaClaves(ctx, fuente, e, f.t, f.medida.segundos);
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
    else if (e.tipo === "balance") pintaBalance(ctx, fuente, e, f.t, f.medida.segundos);
    else pintaCierre(ctx, fuente, e, rec, f.t, f.restante);

    /* Sólo en las láminas: en las claves, «a vigilar», las barras y las cifras repetía lo que ya se lee en grande (20 y 21/10/2026). */
    if (e.tipo === "imagen") pieLocucion(ctx, fuente, e.locucion, f.t);
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
  /* El cierre acaba en negro, no en cortinilla. */
  else if (f.restante < salida && e.tipo !== "cierre") cortinilla(ctx, ANCHO, ALTO, "entra", 1 - f.restante / salida, ORO, FONDO);
}
