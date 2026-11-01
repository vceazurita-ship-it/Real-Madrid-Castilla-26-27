/*
|--------------------------------------------------------------------------
| QUIÉN PUEDE JUGAR EL PRÓXIMO PARTIDO (01/11/2026)
|--------------------------------------------------------------------------
|
| Ya NO sale de la columna ESTADO de la pestaña JUGADORES: estaba obsoleta
| (cinco «SELECCIÓN» de hace semanas dejaban fuera al portero y a los dos
| laterales titulares) y desde la app no hay forma segura de escribirla —el
| Apps Script de ABP sólo deja tocar sus cuatro pestañas y `updatePlayerStatus`
| contesta `ok` sin cambiar nada—.
|
| Ahora la baja se marca en la pizarra táctica, con su motivo y, si se quiere,
| hasta qué día: documento `tactics:bajas-partido` de Supabase. Al pasar la
| fecha la baja caduca sola. Sin baja marcada, todo el que está activo puede
| jugar.
|
| La pantalla le cuelga a cada jugador su baja vigente (`conBajas`) y estas
| funciones sólo la leen: así la lista de cambio, las fichas y la propuesta
| dicen lo mismo sin pasarse el documento de mano en mano.
*/

import { normalizePlayerName } from "@/lib/playerImages";
import type { Player } from "@/types/player";

/* ------------------------------------------------------------------ */
/*  EL DOCUMENTO                                                       */
/* ------------------------------------------------------------------ */

export const CLAVE_DOC_BAJAS = "tactics:bajas-partido";
export const TIPO_DOC_BAJAS = "tactics-bajas";

export type MotivoBaja = "lesion" | "sancion" | "seleccion" | "primer-equipo" | "otro";

export const MOTIVOS_BAJA: { clave: MotivoBaja; rotulo: string }[] = [
  { clave: "lesion", rotulo: "Lesión" },
  { clave: "sancion", rotulo: "Sanción" },
  { clave: "seleccion", rotulo: "Selección" },
  { clave: "primer-equipo", rotulo: "Primer equipo" },
  { clave: "otro", rotulo: "Otro motivo" },
];

export type BajaPartido = {
  /** Como lo escribe la plantilla (apodo o nombre): el cruce es por nombre, los ID se renumeran. */
  nombre: string;
  /** El `ID_JUGADOR` del día en que se marcó. Sólo para leerlo. */
  id?: string;
  motivo: MotivoBaja;
  /** Para «Otro motivo»: lo que se quiera poner («Permiso», «Enfermo»…). */
  detalle?: string;
  /** Último día que no está (AAAA-MM-DD). Sin fecha, hasta que se quite. */
  hasta?: string;
  /** Cuándo se marcó (AAAA-MM-DD). */
  desde: string;
};

export type DocBajas = { bajas: BajaPartido[] };

export const DOC_BAJAS_VACIO: DocBajas = { bajas: [] };

const MOTIVOS = new Set<string>(MOTIVOS_BAJA.map((m) => m.clave));
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Lo que llegue del almacén, limpio: nada que no sea una baja bien escrita. */
export function normalizaDocBajas(valor: unknown): DocBajas {
  const lista = (valor as { bajas?: unknown } | null)?.bajas;

  if (!Array.isArray(lista)) return DOC_BAJAS_VACIO;

  const bajas = lista.flatMap((b): BajaPartido[] => {
    const x = (b ?? {}) as Record<string, unknown>;
    const nombre = String(x.nombre ?? "").trim();
    const motivo = String(x.motivo ?? "");

    if (!nombre || !MOTIVOS.has(motivo)) return [];

    const hasta = String(x.hasta ?? "");
    const detalle = String(x.detalle ?? "").trim();

    return [
      {
        nombre,
        ...(x.id ? { id: String(x.id) } : {}),
        motivo: motivo as MotivoBaja,
        ...(detalle ? { detalle } : {}),
        ...(FECHA.test(hasta) ? { hasta } : {}),
        desde: FECHA.test(String(x.desde ?? "")) ? String(x.desde) : "",
      },
    ];
  });

  return { bajas };
}

/* ------------------------------------------------------------------ */
/*  CRUCE Y CADUCIDAD                                                  */
/* ------------------------------------------------------------------ */

const claveNombre = (s?: string) => normalizePlayerName(String(s ?? ""));

/** La fecha de hoy en la hora de aquí (AAAA-MM-DD). Sólo en manejadores o relojes, nunca al pintar. */
export function hoyLocal(ahora = new Date()) {
  const dos = (n: number) => String(n).padStart(2, "0");

  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/** Sigue en vigor: sin fecha, siempre; con fecha, hasta ese día incluido. Sin «hoy» conocido no caduca. */
export const vigente = (b: BajaPartido, hoy: string) => !b.hasta || !hoy || b.hasta >= hoy;

/** ¿Es de este jugador? Por apodo o por nombre. */
export const esDe = (b: BajaPartido, p: Pick<Player, "nombre" | "apodo">) => {
  const k = claveNombre(b.nombre);

  return Boolean(k) && (k === claveNombre(p.apodo) || k === claveNombre(p.nombre));
};

/** «15/11». */
export const diaMes = (fecha: string) => (FECHA.test(fecha) ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : "");

/** «Lesión hasta 15/11», «Con la selección», «Permiso hasta 03/12». */
export function textoBaja(b: BajaPartido): string {
  const motivo =
    b.motivo === "lesion"
      ? "Lesión"
      : b.motivo === "sancion"
        ? "Sanción"
        : b.motivo === "seleccion"
          ? "Con la selección"
          : b.motivo === "primer-equipo"
            ? "Con el primer equipo"
            : b.detalle || "No disponible";

  return b.hasta ? `${motivo} hasta ${diaMes(b.hasta)}` : motivo;
}

/** Un jugador de la plantilla con su baja vigente colgada (o ninguna). */
export type ConBaja<P extends Player = Player> = P & { baja?: BajaPartido | null };

/** La plantilla con la baja vigente de cada uno. Las caducadas no cuentan. */
export function conBajas<P extends Player>(plantilla: P[], doc: DocBajas, hoy: string): ConBaja<P>[] {
  const vivas = doc.bajas.filter((b) => vigente(b, hoy));

  if (!vivas.length) return plantilla;

  return plantilla.map((p) => {
    const baja = vivas.find((b) => esDe(b, p));

    return baja ? { ...p, baja } : p;
  });
}

/** Marca (o cambia) la baja de un jugador. De paso se limpian las caducadas. */
export function marcaBaja(doc: DocBajas, p: Pick<Player, "id" | "nombre" | "apodo">, datos: Pick<BajaPartido, "motivo" | "detalle" | "hasta">, hoy: string): DocBajas {
  const resto = doc.bajas.filter((b) => vigente(b, hoy) && !esDe(b, p));
  const detalle = datos.motivo === "otro" ? datos.detalle?.trim() : undefined;

  return {
    bajas: [
      ...resto,
      {
        nombre: (p.apodo || p.nombre).trim(),
        id: p.id,
        motivo: datos.motivo,
        ...(detalle ? { detalle } : {}),
        ...(datos.hasta && FECHA.test(datos.hasta) ? { hasta: datos.hasta } : {}),
        desde: hoy,
      },
    ],
  };
}

/** Le devuelve al once. De paso se limpian las caducadas. */
export const quitaBaja = (doc: DocBajas, p: Pick<Player, "nombre" | "apodo">, hoy: string): DocBajas => ({
  bajas: doc.bajas.filter((b) => vigente(b, hoy) && !esDe(b, p)),
});

/* ------------------------------------------------------------------ */
/*  LO QUE PREGUNTAN LAS PANTALLAS                                     */
/* ------------------------------------------------------------------ */

type ConBajaMinima = Pick<Player, "activo"> & { baja?: BajaPartido | null };

export const disponible = (p: ConBajaMinima) => p.activo !== false && !p.baja;

/** «Lesión hasta 15/11»…: para la lista de cambios, las fichas y la propuesta. Null si puede jugar. */
export function estadoEnPalabras(p: ConBajaMinima): string | null {
  return p.baja ? textoBaja(p.baja) : null;
}
