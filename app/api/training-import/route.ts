import { GoogleGenAI } from "@google/genai";
import { matchPlayers } from "@/lib/playerMatcher";
import sharp from "sharp";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const APPS_SCRIPT = process.env.APPS_SCRIPT_URL!;
async function generarConReintento(config: any) {

  for (let i = 0; i < 3; i++) {

    try {
      return await ai.models.generateContent(config);

    } catch (e: any) {

      if (e.status !== 503) throw e;

      console.log("Gemini saturado. Reintentando...");

      await new Promise(r => setTimeout(r, 2000));
    }
  }

  throw new Error("Gemini no disponible.");
}
export async function POST(req: Request) {
  try {
    console.log("========== TRAINING IMPORT ==========");

    const formData = await req.formData();

    const image = formData.get("image") as File | null;

    if (!image) {
      return Response.json(
        {
          error: "No se ha recibido ninguna imagen.",
        },
        {
          status: 400,
        }
      );
    }

    //--------------------------------------------------------
    // Imagen -> Base64
    //--------------------------------------------------------

    const bytes = Buffer.from(await image.arrayBuffer());

const optimized = await sharp(bytes)
  .resize({
    width: 1400,
    withoutEnlargement: true,
  })
  .jpeg({
    quality: 70,
  })
  .toBuffer();

const base64 = optimized.toString("base64");

//--------------------------------------------------------
// Descargar jugadores y analizar imagen en paralelo
//--------------------------------------------------------

const jugadoresPromise = fetch(
  `${APPS_SCRIPT}?action=jugadoresSesion`
);

const geminiPromise = generarConReintento({
  model: "gemini-2.5-flash",
  contents: [
    {
      role: "user",
      parts: [
        {
          text: `
Analiza esta imagen de un entrenamiento del Real Madrid Castilla.

Extrae únicamente los nombres de los jugadores.

Reglas:

- Los jugadores sobre el terreno de juego pertenecen a "available".
- Los nombres de la parte inferior pertenecen a:
  - promotion
  - injury
  - others
  - nationalTeam
- No inventes nombres.
- Si una categoría está vacía devuelve [].
- Devuelve exclusivamente JSON válido.

Formato:

{
  "available": [],
  "promotion": [],
  "injury": [],
  "others": [],
  "nationalTeam": []
}
`,
        },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64,
          },
        },
      ],
    },
  ],
});

const [jugadoresResponse, gemini] = await Promise.all([
  jugadoresPromise,
  geminiPromise,
]);

if (!jugadoresResponse.ok) {
  throw new Error("No se pudieron obtener los jugadores.");
}

const texto = await jugadoresResponse.text();

if (!jugadoresResponse.ok) {
  throw new Error(texto);
}

const jugadores = JSON.parse(texto);
    const raw =
      gemini.text
        ?.replace(/```json/g, "")
        .replace(/```/g, "")
        .trim() ?? "";
console.log("RAW GEMINI");
console.log(raw);
    const result = JSON.parse(raw);

    //--------------------------------------------------------
    // Todos los nombres detectados
    //--------------------------------------------------------

    const allDetected = [
      ...result.available,
      ...result.promotion,
      ...result.injury,
      ...result.others,
      ...result.nationalTeam,
    ];

    //--------------------------------------------------------
    // Lista de candidatos
    //--------------------------------------------------------

    const matches = matchPlayers(
      allDetected,
      jugadores
    );

    const matchesMap = new Map(
      matches.map(m => [m.original, m])
    );

console.log("MATCHES");
console.log(matches);
    //--------------------------------------------------------
    // Aprender alias automáticamente
    //--------------------------------------------------------

    await Promise.all(

  matches
    .filter(
      (m) =>
        m.player &&
        !m.ambiguous &&
        m.confidence >= 90
    )
    .map(async (m) => {

      await fetch(APPS_SCRIPT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "saveAlias",
          alias: m.original,
          id: m.player!.ID_JUGADOR,
          confidence: m.confidence,
        }),
      });

    })

);

    //--------------------------------------------------------
    // Reemplazar nombres
    //--------------------------------------------------------

   const replaceNames = (list: string[]) =>
  list.map((name) => {

    const match = matchesMap.get(name);

    return {

      detected: name,

      official: match?.player?.NOMBRE ?? null,

      id: match?.player?.ID_JUGADOR ?? null,

      confidence: match?.confidence ?? 0,

      ambiguous: match?.ambiguous ?? false,

      candidates: match?.candidates ?? [],

      photo: match?.player?.FOTO_URL ?? null

    };

});
const available = replaceNames(result.available);

const promotion = replaceNames(result.promotion);

const injury = replaceNames(result.injury);

const others = replaceNames(result.others);

const nationalTeam = replaceNames(result.nationalTeam);
    //--------------------------------------------------------
    // Construir estados
    //--------------------------------------------------------

    const estados: Record<string, string> = {};
    // Todos los jugadores que NO pertenecen a la plantilla activa
// comienzan como NO CONVOCADO.
jugadores.forEach((j: any) => {
  if (String(j.ACTIVO ?? "").toUpperCase() === "FALSE") {
    estados[j.ID_JUGADOR] = "NO CONVOCADO";
  }
});

const asignarEstado = (
  lista: {
    id: string | null;
  }[],
  estado: string
) => {

  lista.forEach((p) => {

    if (!p.id) return;

    estados[p.id] = estado;

  });

};

    const ESTADOS = {
  available: "ÓPTIMO",
  promotion: "PRIMER EQUIPO",
  injury: "LESIONADO",
  others: "OTROS",
  nationalTeam: "SELECCIÓN",
};

asignarEstado(available, ESTADOS.available);
asignarEstado(promotion, ESTADOS.promotion);
asignarEstado(injury, ESTADOS.injury);
asignarEstado(others, ESTADOS.others);
asignarEstado(nationalTeam, ESTADOS.nationalTeam);
const playersForSession = jugadores.map((j:any)=>({

  id: j.ID_JUGADOR,

  nombre: j.NOMBRE,

  apodo: j.APODO,

  posicion: j.POSICION,

  dorsal: j.DORSAL,

  foto: j.FOTO_URL,

  activo: j.ACTIVO,

  licencia: j.LICENCIA,

  estado:
    estados[j.ID_JUGADOR] ??
    "NO CONVOCADO"

}));
console.log("========== ESTADOS ==========");
console.log(estados);
    //--------------------------------------------------------
    // Actualizar estados en Google Sheets
    //--------------------------------------------------------

const fecha =
  (formData.get("fecha") as string) ??
  new Date().toISOString().slice(0, 10);
const replace = formData.get("replace") === "true";
const imageUrl =
  (formData.get("imageUrl") as string) ?? "";

// ¿Existe ya una sesión para esa fecha?
const existsResponse = await fetch(
  `${APPS_SCRIPT}?action=sessionExists&fecha=${fecha}`
);
if (!existsResponse.ok) {
  throw new Error("No se pudo comprobar si ya existe la sesión.");
}


const exists = await existsResponse.json();

if (exists.exists && !replace) {
  return Response.json(
    {
      replaceRequired: true,
      message:
        "Ya existe una sesión para esta fecha.",
    },
    { status: 409 }
  );
}

const saveResponse = await fetch(APPS_SCRIPT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
  action: "appendSessionStatus",
  fecha,
  replace,
  imageUrl,
  players: playersForSession,
}),
});

const saveResult = await saveResponse.json();

console.log("APPEND RESULT");
console.log(saveResult);

if (!saveResult.ok) {
  throw new Error(saveResult.error || "Error guardando sesión");
}

//--------------------------------------------------------
// Jugadores pendientes de crear
//--------------------------------------------------------

const pendingPlayers = [
  ...available.map(p => ({ ...p, estado: "ÓPTIMO" })),
  ...promotion.map(p => ({ ...p, estado: "PRIMER EQUIPO" })),
  ...injury.map(p => ({ ...p, estado: "LESIONADO" })),
  ...others.map(p => ({ ...p, estado: "OTROS" })),
  ...nationalTeam.map(p => ({ ...p, estado: "SELECCIÓN" })),
]
.filter(
  p => !p.id || p.ambiguous
)
.map(p => ({
  name: p.detected,
  photo: p.photo,
  estado: p.estado,
  candidates: p.candidates,
}));

//--------------------------------------------------------
// Jugadores convocados para esta sesión
//--------------------------------------------------------

const sessionPlayers = [
  ...available,
  ...promotion,
  ...injury,
  ...others,
  ...nationalTeam,
]
.filter(p => p.id)
.map(p => p.id);

    //--------------------------------------------------------
    // Respuesta
    //--------------------------------------------------------

   return Response.json({
  available,
  promotion,
  injury,
  others,
  nationalTeam,
  pendingPlayers,
  sessionPlayers,
});

  } catch (error: any) {

  console.error("========== ERROR TRAINING ==========");
  console.error(error);
  console.error(error?.stack);
  console.error(error?.cause);

  console.log("APPS_SCRIPT_URL =", process.env.APPS_SCRIPT_URL);
  console.log("GEMINI =", !!process.env.GEMINI_API_KEY);

  // Gemini sin cuota
  if (error?.status === 429) {
    return Response.json(
      {
        error:
          "Se ha alcanzado la cuota diaria de PETICIONES. Inténtalo más tarde",
      },
      {
        status: 429,
      }
    );
  }

  // Resto de errores
  return Response.json(
    {
      error: error?.message,
      stack: error?.stack,
    },
    {
      status: 500,
    }
  );

}
}