/**
 * LANZAR UN ENCARGO EN LA NUBE (10/11/2026).
 *
 * POST { tarea }: pone en marcha en GitHub Actions el proceso de esa tarea, sin
 * el ordenador del club. Lo apunta antes como pedido en `mantenimiento` con
 * `pedidoPor: "nube"` —el vigía del ordenador del club no los coge— y el
 * propio proceso de GitHub apunta después «en marcha» y cómo acabó
 * (`scripts/nube-encargo.mjs`), así que Ajustes lo enseña como cualquier otro.
 *
 * Sólo el administrador, y sólo las tareas de esta lista. Usa el mismo token
 * que el directo de Opta (GITHUB_TOKEN_DIRECTO en Render).
 */
import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { pideEncargo } from "@/lib/mantenimientoServidor";

const REPO = "vceazurita-ship-it/Real-Madrid-Castilla-26-27";

/** Qué proceso de GitHub hace cada tarea en la nube. */
const EN_LA_NUBE = {
  opta: { flujo: "opta-semanal.yml", inputs: { modo: "normal" } },
} as const;

type TareaNube = keyof typeof EN_LA_NUBE;
const esTareaNube = (t: unknown): t is TareaNube => typeof t === "string" && t in EN_LA_NUBE;

export async function POST(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ success: false, error: "Sólo el administrador." }, { status: 401 });
  }

  const cuerpo = (await request.json().catch(() => ({}))) as { tarea?: unknown };
  if (!esTareaNube(cuerpo.tarea)) {
    return NextResponse.json({ success: false, error: "Esa tarea no se puede lanzar en la nube." }, { status: 400 });
  }
  const tarea = cuerpo.tarea;

  const token = process.env.GITHUB_TOKEN_DIRECTO;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Falta GITHUB_TOKEN_DIRECTO en Render (token de GitHub con permiso de Actions)." },
      { status: 503 },
    );
  }

  const { flujo, inputs } = EN_LA_NUBE[tarea];
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${flujo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs }),
  });

  if (!r.ok) {
    return NextResponse.json(
      { success: false, error: `GitHub no lo ha lanzado (${r.status}). Revisa el token y su permiso de Actions.` },
      { status: 502 },
    );
  }

  /* Pedido «de la nube»: Ajustes lo ve pedido al momento y el vigía lo deja. */
  const estado = await pideEncargo(tarea, "nube").catch(() => null);

  return NextResponse.json({ success: true, estado });
}
