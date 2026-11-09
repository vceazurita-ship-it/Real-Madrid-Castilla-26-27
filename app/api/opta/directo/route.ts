/**
 * LANZAR OPTA EN DIRECTO (09/11/2026).
 *
 * POST: pone en marcha `.github/workflows/opta-directo.yml` en GitHub, que
 * sigue los partidos del día sin que el ordenador del club esté encendido.
 * Sólo el administrador. Necesita en Render la variable GITHUB_TOKEN_DIRECTO:
 * un token «fine-grained» de GitHub con permiso Actions: Read and write sobre
 * este repositorio (lo crea el analista; nunca va en el código).
 *
 * GET: si está preparado (hay token) y la última pasada.
 */
import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";

const REPO = "vceazurita-ship-it/Real-Madrid-Castilla-26-27";
const FLUJO = "opta-directo.yml";

const cabeceras = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

export async function GET(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ success: false, error: "Sólo el administrador." }, { status: 401 });
  }

  const token = process.env.GITHUB_TOKEN_DIRECTO;
  if (!token) return NextResponse.json({ success: true, preparado: false });

  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${FLUJO}/runs?per_page=1`, {
      headers: cabeceras(token),
      cache: "no-store",
    });
    const j = r.ok ? await r.json() : null;
    const ultima = j?.workflow_runs?.[0];

    return NextResponse.json({
      success: true,
      preparado: true,
      ultima: ultima
        ? { estado: ultima.status, resultado: ultima.conclusion, empezo: ultima.run_started_at, enlace: ultima.html_url }
        : null,
    });
  } catch {
    return NextResponse.json({ success: true, preparado: true, ultima: null });
  }
}

export async function POST(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ success: false, error: "Sólo el administrador." }, { status: 401 });
  }

  const token = process.env.GITHUB_TOKEN_DIRECTO;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Falta GITHUB_TOKEN_DIRECTO en Render (token de GitHub con permiso de Actions)." },
      { status: 503 },
    );
  }

  const cuerpo = (await request.json().catch(() => ({}))) as { duracion?: number; partido?: string };
  const duracion = Math.min(300, Math.max(15, Math.round(Number(cuerpo.duracion) || 150)));
  const partido = typeof cuerpo.partido === "string" && /^[a-z0-9]{10,40}$/i.test(cuerpo.partido) ? cuerpo.partido : "";

  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${FLUJO}/dispatches`, {
    method: "POST",
    headers: { ...cabeceras(token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { duracion: String(duracion), intervalo: "60", partido } }),
  });

  if (!r.ok) {
    return NextResponse.json(
      { success: false, error: `GitHub no lo ha lanzado (${r.status}). Revisa el token y su permiso de Actions.` },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, duracion });
}
