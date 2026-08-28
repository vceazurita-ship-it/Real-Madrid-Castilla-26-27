/**
 * Modo jugador de la pizarra táctica: de la ficha redonda a una figura.
 *
 * En vez de un círculo con el dorsal, cada jugador se dibuja de cuerpo entero
 * sobre el césped: la cara sale de su foto y el cuerpo se estira o se ensancha
 * con su altura y su peso. Así, de un vistazo, se ve quién es alto en un córner
 * y quién es liviano en un duelo, sin leer una tabla aparte.
 *
 * Aquí sólo viven los números: qué mide la figura, qué colores lleva y de dónde
 * sale la foto. El dibujo está en `components/tactics/PlayerFigure.tsx`.
 */

import type { TokenKind } from "./types";

/*
|--------------------------------------------------------------------------
| MEDIDAS
|--------------------------------------------------------------------------
| El campo del SVG mide 100 x 68, así que una unidad es aproximadamente un
| metro. Una figura a escala real mediría 1,8 unidades: sobre un campo entero
| serían unos pocos píxeles y no se vería ni la cara. Se dibuja por tanto
| exagerada —tres veces el tamaño real— y las diferencias entre jugadores se
| amplían con ella para que se noten a simple vista.
*/

/** Alto de la figura, en unidades de campo, para un jugador de 180 cm. */
export const FIGURA_ALTO = 5.6;

/** Altura que se asume cuando la hoja no la trae. */
const ALTURA_BASE = 180;

/** Peso que se asume cuando la hoja no lo trae. */
const PESO_BASE = 75;

/** Cuánto se exagera la diferencia de altura entre dos jugadores. */
const EXAGERA_ALTURA = 1.6;

/** Cuánto se exagera la diferencia de corpulencia. */
const EXAGERA_ANCHO = 1.1;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Altura en centímetros a partir de "190cm", "1,90", "190"… */
export function alturaCm(value?: string | number | null): number | undefined {
  const raw = String(value ?? "").trim();

  if (!raw) return undefined;

  const parsed = Number(raw.replace(",", ".").replace(/[^\d.]/g, ""));

  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;

  /* La hoja mezcla "190cm" y "1,90": por debajo de 3 se asume metros. */
  const cm = parsed < 3 ? Math.round(parsed * 100) : Math.round(parsed);

  /* Un dato imposible (un "1" suelto, un año) vale menos que no tener dato. */
  return cm >= 140 && cm <= 220 ? cm : undefined;
}

/** Peso en kilos a partir de "78", "78 kg", "78,5"… */
export function pesoKg(value?: string | number | null): number | undefined {
  const raw = String(value ?? "").trim();

  if (!raw) return undefined;

  const parsed = Number(raw.replace(",", ".").replace(/[^\d.]/g, ""));

  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;

  return parsed >= 40 && parsed <= 130 ? Math.round(parsed) : undefined;
}

export interface FiguraMedidas {
  /** Alto total, del césped a la coronilla, en unidades de campo. */
  alto: number;
  /** Multiplicador de anchura del cuerpo: 1 es la complexión media. */
  ancho: number;
  /** Altura real usada, para el tooltip. */
  alturaCm?: number;
  /** Peso real usado, para el tooltip. */
  pesoKg?: number;
}

/**
 * Traduce altura y peso a las dos medidas con las que se dibuja la figura.
 *
 * Sin datos se devuelve la figura media, que es exactamente la del jugador de
 * 180 cm y 75 kg: una pizarra sin datos físicos sigue viéndose homogénea en
 * vez de llena de muñecos de tamaños arbitrarios.
 */
export function medidasFigura(
  altura?: number,
  peso?: number,
): FiguraMedidas {
  const cm = altura ?? ALTURA_BASE;
  const kg = peso ?? PESO_BASE;

  const alto =
    FIGURA_ALTO *
    clamp(1 + ((cm - ALTURA_BASE) / ALTURA_BASE) * EXAGERA_ALTURA, 0.82, 1.22);

  /*
  | La corpulencia sale del índice de masa corporal y no del peso a secas: 80
  | kg en un central de 1,92 son delgados y en un extremo de 1,70 no.
  */
  const imc = kg / ((cm / 100) * (cm / 100));
  const imcBase = PESO_BASE / ((ALTURA_BASE / 100) * (ALTURA_BASE / 100));

  const ancho = clamp(
    1 + ((imc - imcBase) / imcBase) * EXAGERA_ANCHO,
    0.84,
    1.24,
  );

  return { alto, ancho, alturaCm: altura, pesoKg: peso };
}

/*
|--------------------------------------------------------------------------
| EQUIPACIONES
|--------------------------------------------------------------------------
*/

export interface Equipacion {
  camiseta: string;
  /** Franja del cuello y de las mangas. */
  vivo: string;
  pantalon: string;
  medias: string;
  bota: string;
  /** Color del dorsal pintado en la camiseta. */
  dorsal: string;
  /** Contorno de la silueta: separa la figura del césped. */
  contorno: string;
}

export const EQUIPACIONES: Record<"home" | "away", Equipacion> = {
  /* La nuestra: blanca de arriba abajo, con el vivo dorado del club. */
  home: {
    camiseta: "#F8FAFC",
    vivo: "#C8A96B",
    pantalon: "#FFFFFF",
    medias: "#F1F5F9",
    bota: "#0B0F14",
    dorsal: "#0B0F14",
    contorno: "#0B0F14",
  },

  /* La del rival: oscura, con el mismo rojo que ya distingue sus fichas. */
  away: {
    camiseta: "#1E293B",
    vivo: "#F87171",
    pantalon: "#0F172A",
    medias: "#1E293B",
    bota: "#F8FAFC",
    dorsal: "#FFFFFF",
    contorno: "#0B0F14",
  },
};

/** Tonos de piel de reserva cuando el jugador no tiene foto. */
const PIEL = "#C79A72";

export const FIGURA_PIEL = PIEL;
export const FIGURA_PELO = "#2B2019";

/** Las fichas que se convierten en figura; el balón y el cono no. */
export function tieneFigura(kind: TokenKind): kind is "home" | "away" {
  return kind === "home" || kind === "away";
}

/*
|--------------------------------------------------------------------------
| FOTOS
|--------------------------------------------------------------------------
*/

/**
 * Foto lista para meterla dentro del SVG.
 *
 * `html-to-image` lee los píxeles de cada imagen para incrustarla en el PNG, y
 * una foto de otro dominio sin cabeceras CORS ensucia el lienzo y hace fallar
 * la exportación entera. Todo lo de fuera pasa por `/api/rivals/foto`, que la
 * sirve desde este mismo origen; lo que ya es de casa se deja como está.
 */
export function fotoFigura(url?: string): string | undefined {
  const limpio = String(url ?? "").trim();

  if (!limpio || limpio === ".") return undefined;

  const deCasa =
    limpio.startsWith("/") ||
    limpio.startsWith("data:") ||
    limpio.startsWith("blob:") ||
    (typeof window !== "undefined" &&
      limpio.startsWith(window.location.origin));

  if (deCasa) return limpio;

  if (!limpio.startsWith("https://")) return undefined;

  return `/api/rivals/foto?url=${encodeURIComponent(limpio)}`;
}
