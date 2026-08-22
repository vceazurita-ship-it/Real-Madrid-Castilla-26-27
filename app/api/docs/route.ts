import { NextRequest, NextResponse } from "next/server";
import { readDoc, writeDoc } from "@/lib/docStore";

/** Clave: letras, números, guiones y dos puntos. Evita accesos arbitrarios. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9:_-]{2,120}$/i;

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";

  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json(
      { success: false, error: "Clave no válida." },
      { status: 400 }
    );
  }

  try {
    const result = await readDoc(key);

    return NextResponse.json({
      success: true,
      data: result.data,
      updatedAt: result.updatedAt,
      missingTable: result.missingTable ?? false,
    });
  } catch (error) {
    console.error("[docs] GET", error);

    return NextResponse.json(
      { success: false, error: "No se pudo leer el documento." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const key = String(body?.key ?? "");
    const kind = String(body?.kind ?? "generic");

    if (!KEY_PATTERN.test(key)) {
      return NextResponse.json(
        { success: false, error: "Clave no válida." },
        { status: 400 }
      );
    }

    if (body?.data === undefined) {
      return NextResponse.json(
        { success: false, error: "Falta el contenido del documento." },
        { status: 400 }
      );
    }

    const result = await writeDoc(key, kind, body.data);

    return NextResponse.json({
      success: true,
      updatedAt: result.updatedAt,
      missingTable: result.missingTable ?? false,
    });
  } catch (error) {
    console.error("[docs] POST", error);

    return NextResponse.json(
      { success: false, error: "No se pudo guardar el documento." },
      { status: 500 }
    );
  }
}
