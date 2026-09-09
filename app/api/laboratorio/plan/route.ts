import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

import {
  CAMPOS_BORRADOR,
  CAMPOS_SCOUTING,
  ESQUEMA_BORRADOR,
  MOTORES,
  MOTOR_POR_DEFECTO,
  comoTexto,
  costeEstimado,
  encargo,
  type Borrador,
  type CampoBorrador,
  type CampoRedactado,
  type Fila,
} from "@/lib/laboratorio/plan";

/**
 * Borrador del plan de partido a partir del scouting del rival.
 *
 * Es una prueba: **no escribe nada**. Lee la hoja RIVALES, arma el encargo con
 * el scouting del rival pedido y con los planes que el cuerpo técnico ya tiene
 * escritos —que son el ejemplo de estilo—, y devuelve un borrador para leer y
 * corregir en pantalla.
 *
 * La lectura de la hoja se hace **aquí, en el servidor**: la clave del modelo
 * no puede salir al navegador, y de paso el encargo entero se arma en un sitio
 * donde se puede revisar.
 */

export const dynamic = "force-dynamic";

/* El modelo tarda: un plan entero son unos dos mil tokens de salida. */
export const maxDuration = 120;

const HOJA =
  process.env.APPS_SCRIPT_URL ??
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

/** Cuántos planes ya escritos se le enseñan como ejemplo de estilo. */
const EJEMPLOS = 2;

async function leeRivales(): Promise<Fila[]> {
  const respuesta = await fetch(`${HOJA}?action=rivales`, { cache: "no-store" });

  if (!respuesta.ok) throw new Error(`la hoja respondió ${respuesta.status}`);

  const filas = await respuesta.json();

  if (!Array.isArray(filas)) throw new Error("la hoja no devolvió filas");

  return filas as Fila[];
}

/** Un plan escrito de verdad: sirve de ejemplo si tiene lo bastante relleno. */
function estaEscrito(fila: Fila) {
  return (
    CAMPOS_BORRADOR.filter((campo) => String(fila[campo] ?? "").trim() !== "")
      .length >= 8
  );
}

type Respuesta = { campos: CampoRedactado[]; huecos: string[] };

/** Se fía poco de lo que llega: sólo pasan los campos conocidos y con texto. */
function limpia(crudo: unknown): Respuesta {
  const leido = (crudo ?? {}) as Partial<Respuesta>;

  const validos = new Set<string>(CAMPOS_BORRADOR);

  const campos = Array.isArray(leido.campos)
    ? leido.campos
        .filter(
          (campo) =>
            campo &&
            validos.has(String(campo.campo)) &&
            String(campo.texto ?? "").trim() !== "",
        )
        .map((campo) => ({
          campo: campo.campo as CampoBorrador,
          texto: String(campo.texto).trim(),
          seApoyaEn: Array.isArray(campo.seApoyaEn)
            ? campo.seApoyaEn
                .map((x) => String(x))
                .filter((x) => (CAMPOS_SCOUTING as readonly string[]).includes(x))
            : [],
        }))
    : [];

  const huecos = Array.isArray(leido.huecos)
    ? leido.huecos.map((x) => String(x)).filter(Boolean)
    : [];

  return { campos, huecos };
}

export async function POST(peticion: NextRequest) {
  try {
    const cuerpo = await peticion.json();

    const rivalId = String(cuerpo?.rivalId ?? "").trim();

    const motor =
      MOTORES.find((m) => m.key === String(cuerpo?.motor ?? "")) ??
      MOTORES.find((m) => m.key === MOTOR_POR_DEFECTO)!;

    if (!rivalId) {
      return NextResponse.json(
        { error: "Falta el partido." },
        { status: 400 },
      );
    }

    const filas = await leeRivales();

    const rival = filas.find((fila) => String(fila.ID) === rivalId);

    if (!rival) {
      return NextResponse.json(
        { error: `No está la fila ${rivalId} en la hoja.` },
        { status: 404 },
      );
    }

    const scouting = comoTexto(rival, CAMPOS_SCOUTING);

    if (!scouting) {
      return NextResponse.json(
        {
          error:
            "Ese rival no tiene scouting escrito, y el borrador sale de ahí. Rellena antes el análisis del rival.",
        },
        { status: 422 },
      );
    }

    /* Los planes ya escritos, del más reciente hacia atrás y sin contar el
       propio rival: son el ejemplo de cómo escribe la casa. */
    const ejemplos = filas
      .filter((fila) => String(fila.ID) !== rivalId && estaEscrito(fila))
      .slice(-EJEMPLOS);

    if (ejemplos.length === 0) {
      return NextResponse.json(
        {
          error:
            "Todavía no hay ningún plan escrito que sirva de ejemplo de estilo. Escribe uno entero y esto podrá imitarlo.",
        },
        { status: 422 },
      );
    }

    const { sistema, peticion: encargoTexto } = encargo({ rival, ejemplos });

    let crudo: unknown;
    let entrada = 0;
    let salida = 0;

    if (motor.proveedor === "google") {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
          { error: "Falta GEMINI_API_KEY en el servidor." },
          { status: 500 },
        );
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const salidaModelo = await ai.models.generateContent({
        model: motor.modelo,
        contents: encargoTexto,
        config: {
          systemInstruction: sistema,
          responseMimeType: "application/json",
          responseSchema: ESQUEMA_BORRADOR as unknown as Record<string, unknown>,
          temperature: 0.4,
        },
      });

      entrada = salidaModelo.usageMetadata?.promptTokenCount ?? 0;
      salida = salidaModelo.usageMetadata?.candidatesTokenCount ?? 0;

      crudo = JSON.parse(salidaModelo.text ?? "{}");
    } else {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(
          { error: "Falta OPENAI_API_KEY en el servidor." },
          { status: 500 },
        );
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const salidaModelo = await openai.chat.completions.create({
        model: motor.modelo,
        messages: [
          { role: "system", content: sistema },
          {
            role: "user",
            content: `${encargoTexto}\n\nResponde SOLO con un JSON con esta forma: {"campos":[{"campo":"...","texto":"...","seApoyaEn":["..."]}],"huecos":["..."]}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      entrada = salidaModelo.usage?.prompt_tokens ?? 0;
      salida = salidaModelo.usage?.completion_tokens ?? 0;

      crudo = JSON.parse(salidaModelo.choices[0]?.message?.content ?? "{}");
    }

    const { campos, huecos } = limpia(crudo);

    const borrador: Borrador = {
      campos,
      huecos,
      motor: motor.label,
      coste: costeEstimado(motor, entrada, salida),
    };

    return NextResponse.json({
      borrador,
      /* Se devuelve lo que se le dio de comer: sin esto no hay forma de juzgar
         si el borrador es bueno o es que el scouting estaba flojo. */
      entrada: {
        rival: rival.EQUIPO ?? "",
        jornada: rival.JORNADA ?? "",
        camposScouting: CAMPOS_SCOUTING.filter(
          (campo) => String(rival[campo] ?? "").trim() !== "",
        ),
        ejemplos: ejemplos.map((fila) => String(fila.EQUIPO ?? "")),
        tokens: { entrada, salida },
      },
    });
  } catch (error) {
    console.error("[laboratorio/plan]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se ha podido montar el borrador.",
      },
      { status: 500 },
    );
  }
}
