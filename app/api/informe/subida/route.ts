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
 *
 * Dos carpetas (03/10/2026):
 *
 *   - `2026/informes/<día>/`: lo que se sube para UN correo desde el diálogo
 *     del informe. Se barre solo: cada subida borra lo que tenga más de
 *     `DIAS_INFORMES` días (30 desde el 04/10/2026: el correo lleva enlaces de
 *     descarga a estos archivos y con 7 días morían antes de la vuelta).
 *   - `2026/rivales-docs/<equipo>/`: el PDF de la plantilla y el PPT del rival
 *     que se sacan en Plantillas rivales. Se guardan para que el informe del
 *     partido los adjunte solos; al sacar uno nuevo, el viejo se borra
 *     (`DELETE` con su ruta).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ADJUNTOS_PERMITIDOS, MAX_ADJUNTOS, puedeMandar } from "@/lib/correo/peticionInforme";

export const dynamic = "force-dynamic";

const BUCKET = "performance";

const DIAS_INFORMES = 30;

/** El tope del bucket `performance` por fichero (`file_size_limit`, medido el 15/10/2026). */
const MAX_VIDEO = 50 * 1024 * 1024;

const CARPETA_RIVALES = "2026/rivales-docs/";

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

  let cuerpo: { nombre?: unknown; tipo?: unknown; tamano?: unknown; carpeta?: unknown; equipo?: unknown; junto?: unknown };

  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return mal("La petición no trae datos.");
  }

  const nombre = String(cuerpo.nombre ?? "").trim();
  const tipo = String(cuerpo.tipo ?? "");
  const tamano = Number(cuerpo.tamano);

  if (!nombre) return mal("El archivo no tiene nombre.");

  /*
  | JUNTO A OTRO (18/10/2026): la tarjeta de vista previa de un PDF (la imagen
  | que enseñan WhatsApp y el correo) va al lado del PDF con su mismo nombre,
  | para que la página /pdf/… la encuentre sin guardar nada más.
  */
  const junto = typeof cuerpo.junto === "string" && /^2026\/informes\/\d{4}-\d{2}-\d{2}\/[a-z0-9]{8}-[A-Za-z0-9._-]+\.pdf$/.test(cuerpo.junto) ? cuerpo.junto : "";

  if (tipo === "image/jpeg" && !junto) return mal("La imagen sólo se sube como vista previa de un PDF.");

  if (!ADJUNTOS_PERMITIDOS.has(tipo) && tipo !== "image/jpeg") return mal("Sólo se pueden adjuntar PDF, PowerPoint (.pptx) y el vídeo resumen (.mp4).");

  if (!Number.isFinite(tamano) || tamano <= 0) return mal("El archivo está vacío.");

  /* El vídeo en Full HD no se adjunta (va enlazado): su tope es el del bucket, 50 MB por fichero. */
  const tope = tipo === "video/mp4" ? MAX_VIDEO : MAX_ADJUNTOS;

  if (tamano > tope) {
    return mal(
      tipo === "video/mp4"
        ? `El vídeo pesa ${(tamano / 1048576).toFixed(1)} MB: el almacén admite ${MAX_VIDEO / 1048576} MB por fichero.`
        : `El archivo pesa ${(tamano / 1048576).toFixed(1)} MB: el correo admite ${MAX_ADJUNTOS / 1048576} MB de adjuntos.`,
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) return mal("Falta la configuración de Supabase en el servidor.", 500);

  const supabase = createClient(url, clave);

  const dia = new Date().toISOString().slice(0, 10);

  const azar = Math.random().toString(36).slice(2, 10).padEnd(8, "0");

  const deRival = cuerpo.carpeta === "rival";

  const equipo = limpiaNombre(String(cuerpo.equipo ?? "")).toLowerCase();

  if (deRival && (!equipo || equipo === "archivo")) return mal("Falta el equipo del documento.");

  const path = junto ? junto.replace(/\.pdf$/, ".jpg") : deRival ? `${CARPETA_RIVALES}${equipo}/${azar}-${limpiaNombre(nombre)}` : `2026/informes/${dia}/${azar}-${limpiaNombre(nombre)}`;

  /* El barrido de lo viejo, sin esperar ni fallar por él. */
  void barreInformes(supabase.storage.from(BUCKET)).catch((error) => console.error("[informe] barrido", error));

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[informe] firmar subida", error);

    return mal("No se ha podido preparar la subida del archivo.", 500);
  }

  const publica = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  return NextResponse.json({ ok: true, subida: data.signedUrl, token: data.token, path, url: publica });
}

/** Borra las carpetas de `2026/informes/` de hace más de `DIAS_INFORMES` días. */
async function barreInformes(cubo: ReturnType<ReturnType<typeof createClient>["storage"]["from"]>) {
  const corte = new Date(Date.now() - DIAS_INFORMES * 86_400_000).toISOString().slice(0, 10);

  const { data: dias } = await cubo.list("2026/informes", { limit: 100 });

  for (const dia of dias ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia.name) || dia.name >= corte) continue;

    const { data: archivos } = await cubo.list(`2026/informes/${dia.name}`, { limit: 1000 });

    const rutas = (archivos ?? []).map((a) => `2026/informes/${dia.name}/${a.name}`);

    if (rutas.length) await cubo.remove(rutas);
  }
}

/**
 * Borra un documento de rival ya sustituido. Sólo dentro de
 * `2026/rivales-docs/`: con esta ruta no se puede borrar nada más del bucket.
 */
export async function DELETE(request: NextRequest) {
  if (!puedeMandar(request)) return mal("Entra con tu cuenta del cuerpo técnico (la de la quiniela).", 401);

  const { path } = ((await request.json().catch(() => ({}))) ?? {}) as { path?: unknown };

  const ruta = String(path ?? "");

  if (!ruta.startsWith(CARPETA_RIVALES) || ruta.includes("..")) return mal("Esa ruta no se puede borrar desde aquí.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) return mal("Falta la configuración de Supabase en el servidor.", 500);

  const { error } = await createClient(url, clave).storage.from(BUCKET).remove([ruta]);

  if (error) return mal("No se ha podido borrar el documento anterior.", 500);

  return NextResponse.json({ ok: true });
}
