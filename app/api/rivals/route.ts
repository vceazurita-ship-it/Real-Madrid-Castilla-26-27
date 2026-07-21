import { NextRequest, NextResponse } from "next/server";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const action =
      searchParams.get("action") ||
      "rivalesPlantillas";

    const response = await fetch(
      `${APPS_SCRIPT_URL}?action=${action}`,
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error GET /api/rivals:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error cargando datos de rivales",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        success: false,
        error: text,
      };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error POST /api/rivals:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error comunicando con Google Apps Script",
      },
      { status: 500 }
    );
  }
}