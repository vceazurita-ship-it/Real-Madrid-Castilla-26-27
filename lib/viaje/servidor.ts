/*
|--------------------------------------------------------------------------
| TRAYECTOS Y CAMPOS, EN EL SERVIDOR (11/11/2026)
|--------------------------------------------------------------------------
|
| Nominatim (geocodificar), OSRM (lo que dura) y Overpass (el polígono del
| campo): los tres son servicios públicos y gratuitos de OpenStreetMap con
| una política de uso que hay que respetar, así que **todo pasa por aquí** y
| nunca desde el navegador:
|
| - Nominatim: como mucho una petición por segundo (`turnoNominatim` las pone
|   en fila dentro del proceso) y un User-Agent que diga qué aplicación es,
|   sin correo ni datos de nadie. Y caché: un hotel se geocodifica una vez.
| - OSRM y Overpass: una petición por consulta, también cacheada.
|
| La caché vive en Supabase (`viaje:rutas`) y se escribe con `cambiaDoc`, que
| no pisa lo que otra petición escriba en medio. Lo que corrige el analista va
| aparte (`viaje:duraciones`) y gana siempre a lo calculado.
*/

import { cambiaDoc, readDoc } from "@/lib/docStore";
import {
  DURACIONES_KEY,
  RUTAS_CACHE_KEY,
  esCampoDeOnce,
  medidasDePoligono,
  minutosDeBus,
  type Punto,
} from "@/lib/viaje/rutas";

const AGENTE = "RMCF-Castilla-App/1.0 (planificador de desplazamientos)";

const ESPERA_NOMINATIM = 1100;

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

/* ------------------------------------------------------------------ */
/*  CACHÉ                                                              */
/* ------------------------------------------------------------------ */

type Geocodigo = { lat: number; lon: number; nombre?: string; en: string } | { nada: true; en: string };

type RutaGuardada = { segundos: number; metros: number; en: string };

type CampoGuardado = { largo: number; ancho: number; en: string; osm?: string } | { nada: true; en: string };

export type CacheRutas = {
  lugares?: Record<string, Geocodigo>;
  rutas?: Record<string, RutaGuardada>;
  campos?: Record<string, CampoGuardado>;
};

export type DuracionManual = { minutos: number; en: string; desde?: string; hasta?: string };

export type MemoriaDuraciones = { pares?: Record<string, DuracionManual> };

const clave = (texto: string) => texto.trim().toLowerCase().replace(/\s+/g, " ");

/** Lo que no se encontró se vuelve a probar a la semana: la dirección se puede corregir. */
const SEMANA = 7 * 24 * 3600 * 1000;

const caducado = (en: string) => Date.now() - Date.parse(en) > SEMANA;

async function leeCache(): Promise<CacheRutas> {
  try {
    return ((await readDoc<CacheRutas>(RUTAS_CACHE_KEY)).data ?? {}) as CacheRutas;
  } catch {
    return {};
  }
}

async function guardaCache(cambia: (actual: CacheRutas) => CacheRutas) {
  try {
    await cambiaDoc<CacheRutas>(RUTAS_CACHE_KEY, "operativa", (actual) => cambia((actual ?? {}) as CacheRutas));
  } catch (error) {
    /* La caché es un ahorro, no un requisito: si no se escribe, se calcula otra vez. */
    console.error("[viaje] caché de rutas", error);
  }
}

export async function leeMemoria(): Promise<MemoriaDuraciones> {
  try {
    return ((await readDoc<MemoriaDuraciones>(DURACIONES_KEY)).data ?? {}) as MemoriaDuraciones;
  } catch {
    return {};
  }
}

export async function guardaDuracion(par: string, dato: DuracionManual | null) {
  return cambiaDoc<MemoriaDuraciones>(DURACIONES_KEY, "operativa", (actual) => {
    const pares = { ...(((actual ?? {}) as MemoriaDuraciones).pares ?? {}) };

    if (dato) pares[par] = dato;
    else delete pares[par];

    return { pares };
  });
}

/* ------------------------------------------------------------------ */
/*  NOMINATIM                                                          */
/* ------------------------------------------------------------------ */

let colaNominatim: Promise<void> = Promise.resolve();
let ultimaNominatim = 0;

/** Una petición detrás de otra y con un segundo largo entre ellas. */
function turnoNominatim<T>(trabajo: () => Promise<T>): Promise<T> {
  const turno = colaNominatim.then(async () => {
    const espera = ultimaNominatim + ESPERA_NOMINATIM - Date.now();

    if (espera > 0) await new Promise((r) => setTimeout(r, espera));

    try {
      return await trabajo();
    } finally {
      ultimaNominatim = Date.now();
    }
  });

  colaNominatim = turno.then(
    () => undefined,
    () => undefined,
  );

  return turno;
}

async function preguntaNominatim(consulta: string): Promise<Punto & { nombre?: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=es&accept-language=es&q=${encodeURIComponent(consulta)}`;

  const respuesta = await fetch(url, {
    headers: { "User-Agent": AGENTE, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });

  if (!respuesta.ok) throw new Error(`Nominatim ${respuesta.status}`);

  const lista = (await respuesta.json()) as { lat: string; lon: string; display_name?: string }[];
  const primero = lista[0];

  if (!primero) return null;

  return { lat: Number(primero.lat), lon: Number(primero.lon), nombre: primero.display_name };
}

/**
 * Las coordenadas de una dirección o un nombre. Prueba la consulta y, si no
 * da nada, la versión corta (sin el número de la calle, o sólo nombre y
 * ciudad), que es lo que suele fallar.
 */
export async function geocodifica(consulta: string, cache?: CacheRutas): Promise<(Punto & { nombre?: string }) | null> {
  const k = clave(consulta);

  if (!k) return null;

  const guardada = (cache ?? (await leeCache())).lugares?.[k];

  if (guardada && "lat" in guardada) return { lat: guardada.lat, lon: guardada.lon, nombre: guardada.nombre };
  if (guardada && "nada" in guardada && !caducado(guardada.en)) return null;

  const intentos = [consulta, consulta.split(",").slice(-2).join(",").trim()].filter((uno, i, todos) => uno && todos.indexOf(uno) === i);

  let hallado: (Punto & { nombre?: string }) | null = null;

  for (const intento of intentos) {
    hallado = await turnoNominatim(() => preguntaNominatim(intento));

    if (hallado) break;
  }

  const en = new Date().toISOString();

  await guardaCache((actual) => ({
    ...actual,
    lugares: { ...(actual.lugares ?? {}), [k]: hallado ? { ...hallado, en } : { nada: true, en } },
  }));

  return hallado;
}

/* ------------------------------------------------------------------ */
/*  OSRM                                                               */
/* ------------------------------------------------------------------ */

const claveRuta = (a: Punto, b: Punto) =>
  `${a.lat.toFixed(4)},${a.lon.toFixed(4)}>${b.lat.toFixed(4)},${b.lon.toFixed(4)}`;

/** Segundos y metros en coche de A a B por carretera (OSRM público). */
export async function rutaEnCoche(a: Punto, b: Punto, cache?: CacheRutas): Promise<{ segundos: number; metros: number } | null> {
  const k = claveRuta(a, b);
  const guardada = (cache ?? (await leeCache())).rutas?.[k];

  if (guardada) return guardada;

  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&alternatives=false&steps=false`;

  const respuesta = await fetch(url, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  if (!respuesta.ok) throw new Error(`OSRM ${respuesta.status}`);

  const datos = (await respuesta.json()) as { code?: string; routes?: { duration: number; distance: number }[] };
  const ruta = datos.code === "Ok" ? datos.routes?.[0] : undefined;

  if (!ruta) return null;

  const dato = { segundos: Math.round(ruta.duration), metros: Math.round(ruta.distance) };

  await guardaCache((actual) => ({ ...actual, rutas: { ...(actual.rutas ?? {}), [k]: { ...dato, en: new Date().toISOString() } } }));

  return dato;
}

export type Trayecto = {
  minutos: number;
  km?: number;
  fuente: "osrm" | "memoria";
};

/** Lo que dura un trayecto en autobús: la memoria del analista o, si no, OSRM. */
export async function trayecto(par: string, desde: Punto | string, hasta: Punto | string): Promise<Trayecto | null> {
  const memoria = (await leeMemoria()).pares?.[par];

  if (memoria?.minutos) return { minutos: memoria.minutos, fuente: "memoria" };

  const cache = await leeCache();

  const a = typeof desde === "string" ? await geocodifica(desde, cache) : desde;
  const b = typeof hasta === "string" ? await geocodifica(hasta, cache) : hasta;

  if (!a || !b) return null;

  const ruta = await rutaEnCoche(a, b, cache);

  if (!ruta) return null;

  return { minutos: minutosDeBus(ruta.segundos), km: Math.round(ruta.metros / 1000), fuente: "osrm" };
}

/* ------------------------------------------------------------------ */
/*  OVERPASS: EL CAMPO                                                 */
/* ------------------------------------------------------------------ */

type ElementoOverpass = {
  type: "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  geometry?: Punto[];
  members?: { role: string; geometry?: Punto[] }[];
};

const distancia = (a: Punto, b: Punto) => {
  const k = Math.cos((a.lat * Math.PI) / 180);

  return Math.hypot((a.lat - b.lat) * 111_320, (a.lon - b.lon) * 111_320 * k);
};

/**
 * Largo × ancho del campo más cercano al estadio que tenga medidas de campo
 * de once. Se prefieren los marcados `sport=soccer`; los de pádel, baloncesto
 * o el anexo de fútbol siete se descartan por sus medidas.
 */
export async function medidasDelCampo(consulta: string): Promise<{ largo: number; ancho: number; osm?: string } | null> {
  const k = clave(consulta);

  if (!k) return null;

  const cache = await leeCache();
  const guardado = cache.campos?.[k];

  if (guardado && "largo" in guardado) return guardado;
  if (guardado && "nada" in guardado && !caducado(guardado.en)) return null;

  const centro = await geocodifica(consulta, cache);

  if (!centro) return null;

  const pregunta = `[out:json][timeout:20];(way["leisure"="pitch"](around:450,${centro.lat},${centro.lon});relation["leisure"="pitch"](around:450,${centro.lat},${centro.lon}););out geom;`;

  /* El servidor principal de Overpass da 502/504 cuando va cargado: se prueba el espejo. */
  let datos: { elements?: ElementoOverpass[] } | null = null;
  let fallo = "";

  for (const servidor of OVERPASS) {
    try {
      const respuesta = await fetch(servidor, {
        method: "POST",
        headers: { "User-Agent": AGENTE, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(pregunta)}`,
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });

      if (!respuesta.ok) {
        fallo = `Overpass ${respuesta.status}`;
        continue;
      }

      datos = (await respuesta.json()) as { elements?: ElementoOverpass[] };
      break;
    } catch (error) {
      fallo = error instanceof Error ? error.message : String(error);
    }
  }

  if (!datos) throw new Error(fallo || "Overpass no contesta");

  const candidatos = (datos.elements ?? [])
    .map((el) => {
      const puntos = el.geometry ?? el.members?.find((m) => m.role === "outer")?.geometry ?? [];
      const medidas = medidasDePoligono(puntos);

      if (!medidas || !esCampoDeOnce(medidas)) return null;

      const medio = {
        lat: puntos.reduce((s, p) => s + p.lat, 0) / puntos.length,
        lon: puntos.reduce((s, p) => s + p.lon, 0) / puntos.length,
      };

      const deporte = el.tags?.sport ?? "";

      return {
        ...medidas,
        osm: `${el.type}/${el.id}`,
        lejos: distancia(centro, medio),
        futbol: /soccer|football/.test(deporte) || !deporte,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => Number(b.futbol) - Number(a.futbol) || a.lejos - b.lejos);

  const elegido = candidatos[0] ?? null;
  const en = new Date().toISOString();

  await guardaCache((actual) => ({
    ...actual,
    campos: {
      ...(actual.campos ?? {}),
      [k]: elegido ? { largo: elegido.largo, ancho: elegido.ancho, osm: elegido.osm, en } : { nada: true, en },
    },
  }));

  return elegido ? { largo: elegido.largo, ancho: elegido.ancho, osm: elegido.osm } : null;
}
