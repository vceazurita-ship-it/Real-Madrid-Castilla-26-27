/*
|--------------------------------------------------------------------------
| /pdf/<ruta del PDF>: EL ENLACE CON VISTA PREVIA (18/10/2026)
|--------------------------------------------------------------------------
|
| Un enlace directo al PDF del almacén llega a WhatsApp sin nada: ni imagen
| ni título. Esta ruta devuelve una página mínima con las etiquetas Open Graph
| —el nombre del partido y la tarjeta con los dos escudos y el icono de PDF
| (`lib/informe-partido/tarjeta-pdf.ts`, subida al lado del PDF con su mismo
| nombre en .jpg)— y, al abrirla, lleva al PDF.
|
| Es un route handler y no una página para que no pase por el layout de la
| app (menú, sesión): la lee un robot de WhatsApp sin cuenta.
|
| Sólo vale para `2026/informes/…pdf`: no es un redireccionador abierto.
*/

export const dynamic = "force-dynamic";

const RUTA = /^2026\/informes\/\d{4}-\d{2}-\d{2}\/[a-z0-9]{8}-([A-Za-z0-9._-]+)\.pdf$/;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** «J8--RM-Castilla---Antequera-CF--ABP» → «J8 · RM Castilla - Antequera CF · ABP» (el nombre limpio de la subida). */
function tituloDeNombre(nombre: string) {
  return nombre
    .replace(/---/g, "\u0000")
    .replace(/--/g, " · ")
    .replace(/[-_]/g, " ")
    .replace(/\u0000/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  const ruta = (await params).ruta.map(decodeURIComponent).join("/");
  const m = ruta.match(RUTA);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!m || !base) return new Response("No encontrado", { status: 404 });

  const publica = `${base}/storage/v1/object/public/performance/${ruta}`;
  const imagen = publica.replace(/\.pdf$/, ".jpg");
  const titulo = tituloDeNombre(m[1]);
  const aqui = new URL(request.url).toString();

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="Real Madrid Castilla · informe en PDF">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Real Madrid Castilla">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="Informe en PDF · toca para abrirlo">
<meta property="og:url" content="${esc(aqui)}">
<meta property="og:image" content="${esc(imagen)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(imagen)}">
<meta http-equiv="refresh" content="0; url=${esc(publica)}">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#08111F;color:#fff;font-family:system-ui,sans-serif}a{color:#C8A96B}</style>
</head>
<body><p>Abriendo <a href="${esc(publica)}">${esc(titulo)}</a>…</p></body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
