import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/datos/cliente";

import { hayHueco } from "@/lib/almacen/ocupacion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file || !folder) {
      return NextResponse.json(
        { error: "Faltan parámetros." },
        { status: 400 }
      );
    }

    const fileName = file.name
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, "-")
  .replace(/[^a-zA-Z0-9._-]/g, "");

    const path = `${folder}/${fileName}`;

    /* El tope del plan gratis (07/11/2026): lo grande no entra si el almacén está lleno. */
    const hueco = await hayHueco(supabase, file.size);

    if (!hueco.cabe) return NextResponse.json({ error: hueco.mensaje }, { status: 507 });

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("performance")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error(error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const { data } = supabase.storage
      .from("performance")
      .getPublicUrl(path);

    return NextResponse.json({
      success: true,
      path,
      url: data.publicUrl,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}