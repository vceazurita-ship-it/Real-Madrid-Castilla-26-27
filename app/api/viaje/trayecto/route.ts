import { NextRequest, NextResponse } from "next/server";

import { guardaDuracion, leeMemoria, trayecto } from "@/lib/viaje/servidor";

/*
|--------------------------------------------------------------------------
| LO QUE DURA UN TRAYECTO EN AUTOBÚS (11/11/2026)
|--------------------------------------------------------------------------
|
| POST { par, desde, hasta } → { minutos, km?, fuente }
|   `desde` y `hasta` son coordenadas ({ lat, lon }) o un texto que buscar
|   (la dirección del hotel, «Estadio de Pinilla, Teruel»). Manda la memoria
|   del analista (`viaje:duraciones`); si no hay, OSRM sobre OpenStreetMap.
|
| PUT { par, minutos, desde?, hasta? } → guarda la duración corregida a mano
|   para ese par, que gana a lo calculado en todos los viajes que vengan.
|   `minutos: null` la olvida.
|
| GET → la memoria entera, para que la pantalla diga qué pares ya lo tienen.
|
| Ver `lib/viaje/servidor.ts` (políticas de uso de Nominatim y OSRM).
*/

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAR = /^[^\n]{3,300}$/;

type Lugar = { lat: number; lon: number } | string;

function leeLugar(bruto: unknown): Lugar | null {
  if (typeof bruto === "string") return bruto.trim().slice(0, 200) || null;

  if (bruto && typeof bruto === "object") {
    const { lat, lon } = bruto as { lat?: unknown; lon?: unknown };

    if (typeof lat === "number" && typeof lon === "number" && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }

  return null;
}

export async function GET() {
  const memoria = await leeMemoria();

  return NextResponse.json({ success: true, pares: memoria.pares ?? {} });
}

export async function POST(request: NextRequest) {
  const cuerpo = (await request.json().catch(() => null)) as { par?: unknown; desde?: unknown; hasta?: unknown; soloMemoria?: unknown } | null;

  const par = typeof cuerpo?.par === "string" ? cuerpo.par : "";
  const desde = leeLugar(cuerpo?.desde);
  const hasta = leeLugar(cuerpo?.hasta);

  if (!PAR.test(par) || !desde || !hasta) {
    return NextResponse.json({ success: false, error: "Faltan el origen o el destino." }, { status: 400 });
  }

  /* El tren y el avión no van por carretera: OSRM no sirve, sólo lo que ya se escribió una vez. */
  if (cuerpo?.soloMemoria === true) {
    const memoria = (await leeMemoria()).pares?.[par];

    if (memoria?.minutos) return NextResponse.json({ success: true, minutos: memoria.minutos, fuente: "memoria" });

    return NextResponse.json({ success: false, error: "Escribe la duración una vez y se recordará." }, { status: 404 });
  }

  try {
    const dato = await trayecto(par, desde, hasta);

    if (!dato) {
      return NextResponse.json({ success: false, error: "No se ha encontrado la ruta: revisa la dirección." }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...dato });
  } catch (error) {
    console.error("[viaje/trayecto]", error);

    return NextResponse.json({ success: false, error: "El servicio de rutas no contesta ahora mismo." }, { status: 502 });
  }
}

export async function PUT(request: NextRequest) {
  const cuerpo = (await request.json().catch(() => null)) as { par?: unknown; minutos?: unknown; desde?: unknown; hasta?: unknown } | null;

  const par = typeof cuerpo?.par === "string" ? cuerpo.par : "";
  const minutos = cuerpo?.minutos === null ? null : Number(cuerpo?.minutos);

  if (!PAR.test(par) || (minutos !== null && (!Number.isFinite(minutos) || minutos <= 0 || minutos > 48 * 60))) {
    return NextResponse.json({ success: false, error: "Duración no válida." }, { status: 400 });
  }

  try {
    await guardaDuracion(
      par,
      minutos === null
        ? null
        : {
            minutos: Math.round(minutos),
            en: new Date().toISOString(),
            ...(typeof cuerpo?.desde === "string" ? { desde: cuerpo.desde.slice(0, 120) } : {}),
            ...(typeof cuerpo?.hasta === "string" ? { hasta: cuerpo.hasta.slice(0, 120) } : {}),
          },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[viaje/trayecto] guardar", error);

    return NextResponse.json({ success: false, error: "No se ha podido guardar la duración." }, { status: 500 });
  }
}
