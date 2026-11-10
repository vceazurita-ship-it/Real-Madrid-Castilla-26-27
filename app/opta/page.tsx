/**
 * /opta YA NO ES UNA PANTALLA (10/11/2026, fase 4).
 *
 * El «Área Opta» tenía doce pestañas por proveedor. Ahora cada una es un área
 * de «Análisis de datos» (/data-analisis), en el bloque que responde a su
 * pregunta (`components/data/AreasOpta.tsx`), y esto sólo redirige para que
 * los enlaces viejos, los marcadores y los correos sigan llevando a su sitio:
 *
 *   /opta                     → /data-analisis?area=colectivo
 *   /opta?pestana=<clave>     → /data-analisis?area=<la nueva>   (AREA_DE_PESTANA)
 *   /opta?tab=<clave>         → lo mismo (lo usaba el enlace de Ajustes)
 *
 * Las piezas siguen en `app/opta/_piezas/` (las importan las áreas nuevas, el
 * post del partido y «Datos del rival»); la carpeta `_piezas` no es ruta.
 */

import { redirect } from "next/navigation";

import { AREA_DE_PESTANA } from "@/lib/data-analisis/areas-opta";

export default async function OptaPage({ searchParams }: { searchParams: Promise<{ [clave: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const pedida = uno(sp.pestana) || uno(sp.tab);
  const area = AREA_DE_PESTANA[pedida] ?? AREA_DE_PESTANA.castilla;
  redirect(`/data-analisis?area=${area}`);
}
