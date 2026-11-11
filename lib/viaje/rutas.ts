/*
|--------------------------------------------------------------------------
| LUGARES, TRAYECTOS Y MEDIDAS DEL CAMPO (11/11/2026)
|--------------------------------------------------------------------------
|
| De dónde sale y adónde llega cada cita de viaje, y lo que se calcula con
| eso sin pagar a nadie:
|
| - **Lo que dura el trayecto en autobús**: OSRM público (perfil coche) sobre
|   OpenStreetMap, con las direcciones geocodificadas por Nominatim. Google
|   Maps es de pago y no se usa. Lo hace el servidor (`/api/viaje/trayecto`),
|   que cachea en Supabase y respeta la política de Nominatim (una petición
|   por segundo, User-Agent de la app). El autobús va más despacio que el
|   coche de OSRM: se multiplica por `FACTOR_BUS` y se redondea a 5 minutos.
| - **La memoria de duraciones** (`viaje:duraciones`): si el analista corrige
|   una duración, vale para ese par origen → destino en todos los viajes que
|   vengan, y gana a lo calculado.
| - **Las medidas del campo**: el polígono `leisure=pitch` de OpenStreetMap
|   junto al estadio (Overpass), medido con su rectángulo mínimo. La
|   herramienta de medir de Google Maps no se puede automatizar.
|
| Este fichero no hace red: lo comparten la pantalla y el servidor.
*/

import type { Desplazamiento, ImagenViaje } from "@/lib/viaje/modelo";

export type LugarClave = "valdebebas" | "atocha" | "chamartin" | "barajas" | "hotel" | "estadio";

/**
 * Los cuatro sitios fijos de Madrid, con sus coordenadas: no hace falta
 * geocodificarlos y así Nominatim sólo trabaja con el hotel y el estadio.
 */
export const LUGARES_FIJOS: Record<Exclude<LugarClave, "hotel" | "estadio">, { nombre: string; lat: number; lon: number }> = {
  valdebebas: { nombre: "Valdebebas", lat: 40.4769, lon: -3.6119 },
  atocha: { nombre: "Estación de Atocha", lat: 40.4066, lon: -3.69 },
  chamartin: { nombre: "Estación de Chamartín", lat: 40.4721, lon: -3.6826 },
  barajas: { nombre: "Aeropuerto de Barajas", lat: 40.4919, lon: -3.5929 },
};

export const CLAVES_LUGAR: LugarClave[] = ["valdebebas", "atocha", "chamartin", "barajas", "hotel", "estadio"];

export const esLugarFijo = (clave: string): clave is keyof typeof LUGARES_FIJOS => clave in LUGARES_FIJOS;

/** El autobús tarda más que el coche que calcula OSRM: un 15 % en carretera. */
export const FACTOR_BUS = 1.15;

export const DURACIONES_KEY = "viaje:duraciones";
export const RUTAS_CACHE_KEY = "viaje:rutas";

export type LugarResuelto = {
  clave: string;
  nombre: string;
  /** Lo que se busca en Nominatim (vacío en los fijos y si no hay datos). */
  consulta: string;
  lat?: number;
  lon?: number;
  /** La llave de la memoria: el mismo hotel o estadio en otro viaje es el mismo par. */
  memoria: string;
  foto?: ImagenViaje;
};

const limpia = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Qué es cada lugar en este viaje: nombre, qué buscar y su foto. */
export function resuelveLugar(
  clave: string | undefined,
  viaje: Desplazamiento,
  fotos: Record<string, ImagenViaje> | undefined,
): LugarResuelto | null {
  if (!clave) return null;

  if (esLugarFijo(clave)) {
    const fijo = LUGARES_FIJOS[clave];

    return { clave, nombre: fijo.nombre, consulta: "", lat: fijo.lat, lon: fijo.lon, memoria: clave, ...(fotos?.[clave]?.url ? { foto: fotos[clave] } : {}) };
  }

  if (clave === "hotel") {
    const h = viaje.hotel;
    const nombre = h.nombre.trim() || "Hotel";
    const consulta = (h.direccion.trim() || [h.nombre, viaje.estadio.ciudad].filter((x) => x.trim()).join(", ")).trim();

    return {
      clave,
      nombre,
      consulta: h.nombre.trim() || h.direccion.trim() ? consulta : "",
      memoria: `hotel:${limpia(h.nombre || h.direccion)}`,
      ...(h.foto?.url ? { foto: h.foto } : {}),
    };
  }

  if (clave === "estadio") {
    const e = viaje.estadio;
    const nombre = e.nombre.trim() || "Estadio";
    const consulta = (e.direccion.trim() || [e.nombre, e.ciudad].filter((x) => x.trim()).join(", ")).trim();

    return {
      clave,
      nombre,
      consulta: e.nombre.trim() || e.direccion.trim() ? consulta : "",
      memoria: `estadio:${limpia([e.nombre, e.ciudad].join(" ") || e.direccion)}`,
      ...(e.foto?.url ? { foto: e.foto } : e.plano?.url ? { foto: e.plano } : {}),
    };
  }

  return null;
}

export const nombreLugar = (clave: string | undefined, viaje: Desplazamiento) =>
  resuelveLugar(clave, viaje, undefined)?.nombre ?? "";

/** La llave de un trayecto en la memoria: «valdebebas→hotel:parador teruel». */
export const clavePar = (desde: LugarResuelto, hasta: LugarResuelto) => `${desde.memoria}→${hasta.memoria}`;

/** Minutos de autobús a partir de los segundos de coche de OSRM, redondeados a 5. */
export const minutosDeBus = (segundos: number) => Math.max(5, Math.round((segundos * FACTOR_BUS) / 60 / 5) * 5);

/* ------------------------------------------------------------------ */
/*  MEDIDAS DE UN CAMPO                                                */
/* ------------------------------------------------------------------ */

export type Punto = { lat: number; lon: number };

/**
 * Largo y ancho de un polígono de campo, en metros.
 *
 * Se proyecta en plano alrededor de su centro (a esta escala la Tierra es
 * plana) y se busca el rectángulo de menor área que lo contiene probando la
 * orientación de cada lado: un campo dibujado en OSM es un cuadrilátero casi
 * perfecto, pero girado, y la caja alineada con el norte lo sobremediría.
 */
export function medidasDePoligono(puntos: Punto[]): { largo: number; ancho: number } | null {
  if (puntos.length < 3) return null;

  const lat0 = puntos.reduce((s, p) => s + p.lat, 0) / puntos.length;
  const lon0 = puntos.reduce((s, p) => s + p.lon, 0) / puntos.length;
  const R = 6_371_000;
  const k = Math.cos((lat0 * Math.PI) / 180);

  const xy = puntos.map((p) => ({
    x: (((p.lon - lon0) * Math.PI) / 180) * R * k,
    y: (((p.lat - lat0) * Math.PI) / 180) * R,
  }));

  let mejor: { area: number; a: number; b: number } | null = null;

  for (let i = 0; i < xy.length; i += 1) {
    const p = xy[i];
    const q = xy[(i + 1) % xy.length];
    const angulo = Math.atan2(q.y - p.y, q.x - p.x);
    const c = Math.cos(-angulo);
    const s = Math.sin(-angulo);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const r of xy) {
      const x = r.x * c - r.y * s;
      const y = r.x * s + r.y * c;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const a = maxX - minX;
    const b = maxY - minY;
    const area = a * b;

    if (area > 0 && (!mejor || area < mejor.area)) mejor = { area, a, b };
  }

  if (!mejor) return null;

  return { largo: Math.round(Math.max(mejor.a, mejor.b)), ancho: Math.round(Math.min(mejor.a, mejor.b)) };
}

/** Si unas medidas son de un campo de fútbol once (y no de un campo de pádel). */
export const esCampoDeOnce = (m: { largo: number; ancho: number }) => m.largo >= 88 && m.largo <= 125 && m.ancho >= 45 && m.ancho <= 92;

/** «103 x 65», «103×65 m», «103 por 65» → { largo, ancho }. */
export function leeMedidas(texto: string | undefined): { largo: number; ancho: number } | null {
  const m = (texto ?? "").match(/(\d{2,3})(?:[.,]\d+)?\s*(?:m\s*)?(?:x|×|\*|por)\s*(\d{2,3})/i);

  if (!m) return null;

  const a = Number(m[1]);
  const b = Number(m[2]);

  return { largo: Math.max(a, b), ancho: Math.min(a, b) };
}

export const comoMedidas = (m: { largo: number; ancho: number }) => `${m.largo} × ${m.ancho}`;
