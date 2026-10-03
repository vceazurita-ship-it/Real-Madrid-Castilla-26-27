/**
 * SUBIR UN ADJUNTO GRANDE PARA UN INFORME (03/10/2026).
 *
 * El PDF o el PPT del rival pesan varios megas y el correo pasa por una
 * función de Vercel que no admite peticiones de más de ~4,5 MB. Así que el
 * archivo no pasa por aquí: esta ruta sólo firma una URL de subida y el
 * navegador sube los bytes **directamente** a Supabase
 * (`lib/correo/subeAdjunto.ts`). Al mandar el correo, el servidor se lo trae de
 * su URL pública y lo adjunta (`traeAdjuntosUrl`).
 *
 * Sólo con la sesión del cuerpo técnico, como mandar el correo.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ADJUNTOS_PERMITIDOS, MAX_ADJUNTOS, puedeMandar } from "@/lib/correo/peticionInforme";

export const dynamic = "force-dynamic";

const BUCKET = "performance";

const mal = (mensaje: string, estado = 400) => NextResponse.json({ ok: false, error: mensaje }, { status: estado });

/** Nombre de archivo sin acentos ni caracteres que rompan la URL pública. */
function limpiaNombre(nombre: string) {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(-100);

  return limpio || "archivo";
}

export async function POST(request: NextRequest) {
  if (!puedeMandar(request)) {
    return mal("Entra con tu cuenta del cuerpo técnico (la de la quiniela) para adjuntar archivos.", 401);
  }

  let cuerpo: { nombre?: unknown; tipo?: unknown; tamano?: unknown };

  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return mal("La petición no trae datos.");
  }

  const nombre = String(cuerpo.nombre ?? "").trim();
  const tipo = String(cuerpo.tipo ?? "");
  const tamano = Number(cuerpo.tamano);

  if (!nombre) return mal("El archivo no tiene nombre.");

  if (!ADJUNTOS_PERMITIDOS.has(tipo)) return mal("Sólo se pueden adjuntar PDF y PowerPoint (.pptx).");

  if (!Number.isFinite(tamano) || tamano <= 0) return mal("El archivo está vacío.");

  if (tamano > MAX_ADJUNTOS) {
    return mal(`El archivo pesa ${(tamano / 1048576).toFixed(1)} MB: el correo admite ${MAX_ADJUNTOS / 1048576} MB de adjuntos.`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) return mal("Falta la configuración de Supabase en el servidor.", 500);

  const supabase = createClient(url, clave);

  const dia = new Date().toISOString().slice(0, 10);

  const azar = Math.random().toString(36).slice(2, 10).padEnd(8, "0");

  const path = `2026/informes/${dia}/${azar}-${limpiaNombre(nombre)}`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[informe] firmar subida", error);

    return mal("No se ha podido preparar la subida del archivo.", 500);
  }

  const publica = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  return NextResponse.json({ ok: true, subida: data.signedUrl, token: data.token, path, url: publica });
}
