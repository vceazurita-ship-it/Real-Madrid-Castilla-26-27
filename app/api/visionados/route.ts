import { createClient } from "@/lib/datos/cliente";
import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";

export const dynamic = "force-dynamic";

/*
| VISIONADOS DE LOS CLIPS INDIVIDUALES DEL RIVAL (06/11/2026)
|
| Cada vez que alguien abre un clip en Scout Individual se apunta aquí: qué
| clip, de qué rival, de qué jugador y de qué puesto, y quién —si se sabe—.
| La app no tiene cuentas para todos: el administrador se reconoce por su
| sesión; los demás aparatos pueden decir su nombre una vez en /visionados
| (se guarda en el aparato y viaja con cada visionado). Si no, «sin
| identificar», y aun así se ve qué vídeos y qué puestos se miran.
|
| Va en un documento de app_documents (`visionados:clips-rivales`), con los
| últimos 5.000. Escritura condicional por `updated_at` para no perder uno si
| entran dos a la vez.
*/

const CLAVE = "visionados:clips-rivales";
const MAXIMO = 5000;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type Visionado = {
  cuando: string;
  video: string;
  titulo: string;
  equipo: string;
  jugador: string;
  puesto: string;
  quien: string;
};

const corta = (v: unknown, n = 120) => String(v ?? "").trim().slice(0, n);

export async function GET() {
  const { data } = await sb.from("app_documents").select("data").eq("key", CLAVE).maybeSingle();
  return NextResponse.json({ visionados: (data?.data as { visionados?: Visionado[] } | null)?.visionados ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<Visionado>;
    const admin = esAdmin(request.cookies.get(COOKIE_ADMIN)?.value);
    const nuevo: Visionado = {
      cuando: new Date().toISOString(),
      video: corta(body.video, 40),
      titulo: corta(body.titulo),
      equipo: corta(body.equipo, 60),
      jugador: corta(body.jugador, 60),
      puesto: corta(body.puesto, 40),
      quien: admin ? "Administrador" : corta(body.quien, 40) || "Sin identificar",
    };
    if (!nuevo.video) return NextResponse.json({ ok: false }, { status: 400 });

    for (let intento = 0; intento < 3; intento++) {
      const { data: fila } = await sb.from("app_documents").select("data, updated_at").eq("key", CLAVE).maybeSingle();
      const lista = [...(((fila?.data as { visionados?: Visionado[] } | null)?.visionados) ?? []), nuevo].slice(-MAXIMO);
      const ahora = new Date().toISOString();
      if (!fila) {
        const { error } = await sb.from("app_documents").insert({ key: CLAVE, kind: "visionados", data: { visionados: lista }, updated_at: ahora });
        if (!error) return NextResponse.json({ ok: true });
        continue;
      }
      const { data: hecho } = await sb
        .from("app_documents")
        .update({ data: { visionados: lista }, updated_at: ahora })
        .eq("key", CLAVE)
        .eq("updated_at", fila.updated_at)
        .select("key");
      if (hecho?.length) return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false }, { status: 409 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
