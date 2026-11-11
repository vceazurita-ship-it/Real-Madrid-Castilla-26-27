/*
| Lo que la pantalla pide al servidor sobre los trayectos (11/11/2026): ver
| `app/api/viaje/trayecto` y `app/api/viaje/campo`. Nada de esto va directo a
| OpenStreetMap desde el navegador.
*/

import { medioDeCita, type CitaHorario, type Desplazamiento, type ImagenViaje } from "@/lib/viaje/modelo";
import { clavePar, resuelveLugar, type LugarResuelto } from "@/lib/viaje/rutas";

export type RespuestaTrayecto = { minutos: number; km?: number; fuente: "osrm" | "memoria" };

const punto = (lugar: LugarResuelto) =>
  lugar.lat !== undefined && lugar.lon !== undefined ? { lat: lugar.lat, lon: lugar.lon } : lugar.consulta;

/** El par de la memoria de una cita de viaje, con el medio delante: en tren no se tarda lo mismo. */
export function parDeCita(cita: CitaHorario, viaje: Desplazamiento, lugares?: Record<string, ImagenViaje>) {
  const desde = resuelveLugar(cita.desde, viaje, lugares);
  const hasta = resuelveLugar(cita.hasta, viaje, lugares);

  if (!desde || !hasta || desde.memoria === hasta.memoria) return null;

  /* Sin nombre ni dirección no hay nada que buscar (el hotel sin rellenar). */
  const sabe = (lugar: LugarResuelto) => (lugar.lat !== undefined && lugar.lon !== undefined) || Boolean(lugar.consulta);

  if (!sabe(desde) || !sabe(hasta)) return { par: null, desde, hasta };

  return { par: `${medioDeCita(cita)}:${clavePar(desde, hasta)}`, desde, hasta };
}

/** Lo que dura: de la memoria y, si es en autobús, calculado con OSRM. */
export async function pideTrayecto(
  cita: CitaHorario,
  viaje: Desplazamiento,
  lugares?: Record<string, ImagenViaje>,
): Promise<RespuestaTrayecto | { error: string }> {
  const datos = parDeCita(cita, viaje, lugares);

  if (!datos) return { error: "Elige de dónde sale y adónde va." };

  if (!datos.par) {
    const falta = datos.desde.consulta || datos.desde.lat !== undefined ? datos.hasta : datos.desde;

    return { error: `Falta el nombre o la dirección de${falta.clave === "hotel" ? "l hotel" : "l estadio"}.` };
  }

  try {
    const respuesta = await fetch("/api/viaje/trayecto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        par: datos.par,
        desde: punto(datos.desde),
        hasta: punto(datos.hasta),
        /* El tren y el avión no van por carretera: sólo lo que el analista ya escribió una vez. */
        soloMemoria: medioDeCita(cita) !== "bus",
      }),
    });

    const json = (await respuesta.json().catch(() => null)) as (RespuestaTrayecto & { success?: boolean; error?: string }) | null;

    if (!respuesta.ok || !json?.success) return { error: json?.error || "No se ha podido calcular." };

    return { minutos: json.minutos, km: json.km, fuente: json.fuente };
  } catch {
    return { error: "Sin conexión con el servidor." };
  }
}

/** Guarda la duración corregida a mano para ese par: gana en los viajes que vengan. */
export async function recuerdaDuracion(cita: CitaHorario, viaje: Desplazamiento, minutos: number | null, lugares?: Record<string, ImagenViaje>) {
  const datos = parDeCita(cita, viaje, lugares);

  if (!datos?.par) return false;

  try {
    const respuesta = await fetch("/api/viaje/trayecto", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ par: datos.par, minutos, desde: datos.desde.nombre, hasta: datos.hasta.nombre }),
    });

    return respuesta.ok;
  } catch {
    return false;
  }
}

/** Las medidas del campo según OpenStreetMap. */
export async function pideMedidasCampo(consulta: string, senal?: AbortSignal): Promise<{ largo: number; ancho: number; osm?: string } | null> {
  if (consulta.trim().length < 3) return null;

  try {
    const respuesta = await fetch(`/api/viaje/campo?consulta=${encodeURIComponent(consulta)}`, { signal: senal });
    const json = (await respuesta.json().catch(() => null)) as { success?: boolean; largo?: number; ancho?: number; osm?: string } | null;

    if (!respuesta.ok || !json?.success || !json.largo || !json.ancho) return null;

    return { largo: json.largo, ancho: json.ancho, osm: json.osm };
  } catch {
    return null;
  }
}
