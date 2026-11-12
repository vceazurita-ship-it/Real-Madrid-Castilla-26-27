/**
 * PROYECCIÓN DE LA JORNADA (12/11/2026) · SÓLO LECTURA.
 *
 * GET /api/proyeccion?rival=<nombre>&jornada=<n>&anterior=1&que=abp|juego|todo
 *
 * Arma en el servidor la proyección del balón parado y del juego del partido
 * (ver `lib/proyeccion/*`): los eventos de Opta pesan ~10 MB y no tienen por
 * qué bajar al navegador. Sin `rival` ni `jornada`, el próximo partido del
 * calendario de BeSoccer. No escribe nada en ningún sitio.
 *
 * Se guarda en memoria lo ya preparado (las tablas por partido, no los
 * documentos crudos) durante 10 minutos.
 */

import { NextRequest, NextResponse } from "next/server";

import { readDoc } from "@/lib/docStore";
import { CLAVE_CALENDARIO } from "@/lib/castilla/calendario";
import { DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import type { PartidoBeSoccer } from "@/lib/quiniela/besoccer";
import type { PartidoWyscout } from "@/lib/proyeccion/fuentes";
import { eligePartido, preparaAbp, preparaJuego, proyeccionDelPartido, type PreparadoAbp, type PreparadoJuego } from "@/lib/proyeccion/montaje";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

const VIDA = 10 * 60 * 1000;

let juegoListo: { datos: PreparadoJuego | null; en: number; actualizado: string | null } | null = null;
let abpListo: { datos: PreparadoAbp | null; en: number } | null = null;
let enCurso: Promise<void> | null = null;

/** Los Team Stats de Wyscout: del disco (Render y local) o, si no, del propio origen. */
async function leeWyscout(desde: string): Promise<PartidoWyscout[]> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const crudo = JSON.parse(await readFile(join(process.cwd(), "public", "data", "analisis.json"), "utf8"));
    if (Array.isArray(crudo?.partidos)) return crudo.partidos as PartidoWyscout[];
  } catch {
    /* sin el fichero en disco: se pide por la red */
  }
  try {
    const r = await fetch(new URL("/data/analisis.json", desde), { cache: "no-store" });
    if (!r.ok) return [];
    const crudo = await r.json();
    return Array.isArray(crudo?.partidos) ? (crudo.partidos as PartidoWyscout[]) : [];
  } catch {
    return [];
  }
}

const doc = async <T,>(clave: string) => {
  const r = await readDoc<T>(clave).catch(() => ({ data: null, updatedAt: null }));
  return r;
};

async function prepara(desde: string, conAbp: boolean) {
  const ahora = Date.now();
  const juegoVivo = juegoListo && ahora - juegoListo.en < VIDA;
  const abpVivo = abpListo && ahora - abpListo.en < VIDA;
  if (juegoVivo && (!conAbp || abpVivo)) return;
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const [equipos, partidos, wyscout] = await Promise.all([doc<TablaOpta>(DOCS_OPTA.equipos), doc<TablaOpta>(DOCS_OPTA.partidos), leeWyscout(desde)]);
    const base = { equipos: equipos.data, partidos: partidos.data, wyscout };
    juegoListo = { datos: preparaJuego(base), en: Date.now(), actualizado: partidos.updatedAt };
    if (conAbp) {
      const [abpEventos, remates, jugadores, castilla] = await Promise.all([
        doc<TablaOpta>(DOCS_OPTA.abpEventos),
        doc<TablaOpta>(DOCS_OPTA.remates),
        doc<TablaOpta>(DOCS_OPTA.jugadores),
        doc<TablaOpta>(DOCS_OPTA.castilla),
      ]);
      abpListo = {
        datos: preparaAbp({ ...base, abpEventos: abpEventos.data, remates: remates.data, jugadores: jugadores.data, castilla: castilla.data }),
        en: Date.now(),
      };
    }
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const que = q.get("que") ?? "todo";
  const conAbp = que !== "juego";
  const rival = q.get("rival")?.trim() || null;
  const jornada = Number(q.get("jornada")) || null;
  /* El último partido jugado: lo proyectado (con lo de antes) frente a lo real. */
  const anterior = q.get("anterior") === "1";

  try {
    await prepara(request.nextUrl.origin, conAbp);
    const calendario = (await doc<{ partidos?: PartidoBeSoccer[] }>(CLAVE_CALENDARIO)).data?.partidos ?? [];
    const juego = juegoListo?.datos ?? null;
    const abp = conAbp ? (abpListo?.datos ?? null) : null;
    if (!juego) return NextResponse.json({ success: false, error: "Aún no están los datos de Opta." }, { status: 503 });

    const partido = eligePartido(calendario, juego.equipos, Date.now(), { rival, jornada, anterior });
    if (!partido || !partido.rivalId) {
      return NextResponse.json({ success: false, error: "Ese partido no está en el calendario o el rival no está en Opta." }, { status: 404 });
    }
    const r = proyeccionDelPartido(partido, que === "abp" ? null : juego, abp);
    return NextResponse.json(
      { success: true, ...r, actualizado: juegoListo?.actualizado ?? null },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    console.error("[proyeccion]", error);
    return NextResponse.json({ success: false, error: "No se pudo preparar la proyección." }, { status: 500 });
  }
}
