import { NextRequest, NextResponse } from "next/server";

import { medidasDelCampo } from "@/lib/viaje/servidor";

/*
|--------------------------------------------------------------------------
| LAS MEDIDAS DEL CAMPO, DE OPENSTREETMAP (11/11/2026)
|--------------------------------------------------------------------------
|
| GET ?consulta=Estadio de Pinilla, Teruel → { largo, ancho, osm }
|
| Geocodifica el estadio (Nominatim), busca los polígonos `leisure=pitch` a
| menos de 450 m (Overpass) y mide el de fútbol once más cercano con su
| rectángulo mínimo. Cacheado en `viaje:rutas`. La pantalla lo coteja con lo
| que dice BeSoccer y deja escribir lo bueno.
*/

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const consulta = (request.nextUrl.searchParams.get("consulta") ?? "").trim().slice(0, 200);

  if (consulta.length < 3) {
    return NextResponse.json({ success: false, error: "Falta el estadio." }, { status: 400 });
  }

  try {
    const medidas = await medidasDelCampo(consulta);

    if (!medidas) return NextResponse.json({ success: false, error: "OpenStreetMap no tiene dibujado ese campo." }, { status: 404 });

    return NextResponse.json({ success: true, ...medidas });
  } catch (error) {
    console.error("[viaje/campo]", error);

    return NextResponse.json({ success: false, error: "OpenStreetMap no contesta ahora mismo." }, { status: 502 });
  }
}
