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
    quality: 80,
  })
  .toBuffer();

const base64 = optimized.toString("base64");

//--------------------------------------------------------
// Descargar jugadores mientras Gemini analiza la imagen
//--------------------------------------------------------

const jugadoresPromise = fetch(
  `${APPS_SCRIPT}?action=jugadores`
).then(res => res.json());

    //--------------------------------------------------------
    // Gemini
    //--------------------------------------------------------

    const gemini = await generarConReintento({
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
- Los nombres de la parte inferior pertenecen a una de estas categorías:
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

    const raw =
      gemini.text
        ?.replace(/```json/g, "")
        .replace(/```/g, "")
        .trim() ?? "";

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
// Esperar a que termine la descarga
//--------------------------------------------------------

const jugadores = await jugadoresPromise;

    //--------------------------------------------------------
    // Lista de candidatos
    //--------------------------------------------------------

    const candidatos: string[] = [];

    jugadores.forEach((j: any) => {
      if (j.NOMBRE) candidatos.push(j.NOMBRE);
      if (j.APODO) candidatos.push(j.APODO);
    });

    //--------------------------------------------------------
    // Match IA
    //--------------------------------------------------------

    const matches = matchPlayers(
      allDetected,
      candidatos
    );

    //--------------------------------------------------------
    // Aprender alias automáticamente
    //--------------------------------------------------------

    await Promise.all(

  matches
    .filter(
      (m) =>
        m.matched &&
        m.confidence >= 90
    )
    .map(async (m) => {

      const jugador = jugadores.find(
        (j: any) =>
          j.NOMBRE === m.matched ||
          j.APODO === m.matched
      );

      if (!jugador) return;

      await fetch(APPS_SCRIPT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "saveAlias",
          alias: m.original,
          id: jugador.ID_JUGADOR,
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
        const match = matches.find(
          (m) => m.original === name
        );

        const jugador = jugadores.find(
  (j:any)=>
    j.NOMBRE===match?.matched ||
    j.APODO===match?.matched
);

return {

  detected:name,

  official:match?.matched ?? null,

  confidence:match?.confidence ?? 0,

  photo:
    jugador?.FOTO_URL ?? null

};
      });

    const available = replaceNames(result.available);
    const promotion = replaceNames(result.promotion);
    const injury = replaceNames(result.injury);
    const others = replaceNames(result.others);
    const nationalTeam = replaceNames(result.nationalTeam);
console.log("========== LISTAS ==========");

console.log({
  available,
  promotion,
  injury,
  others,
  nationalTeam,
});
    //--------------------------------------------------------
    // Construir estados
    //--------------------------------------------------------

    const estados: Record<string, string> = {};
    // Todos los jugadores que NO pertenecen a la plantilla activa
// comienzan como NO CONVOCADO.
jugadores.forEach((j: any) => {
  if (String(j.ACTIVO).toUpperCase() === "FALSE") {
    estados[j.ID_JUGADOR] = "NO CONVOCADO";
  }
});

    const asignarEstado = (
  lista: {
    official: string | null;
  }[],
  estado: string
) => {
  lista.forEach((p) => {
    if (!p.official) return;

    const jugador = jugadores.find(
      (j: any) =>
        j.NOMBRE === p.official ||
        j.APODO === p.official
    );

    if (!jugador) return;

    const activo =
      String(jugador.ACTIVO).toUpperCase() === "TRUE";

    // Si NO pertenece a la plantilla activa,
    // cualquier aparición en la imagen significa
    // que va a entrenaar en -> ÓPTIMO.
    estados[jugador.ID_JUGADOR] = activo
      ? estado
      : "ÓPTIMO";
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
console.log("========== ESTADOS ==========");
console.log(estados);
    //--------------------------------------------------------
    // Actualizar estados en Google Sheets
    //--------------------------------------------------------

   const res = await fetch(APPS_SCRIPT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    action: "updatePlayerStatus",
    players: estados,
  }),
});

console.log("STATUS:", res.status);
console.log("BODY:", await res.text());

//--------------------------------------------------------
// Jugadores pendientes de crear
//--------------------------------------------------------

const pendingPlayers = [
  ...available,
  ...promotion,
  ...injury,
  ...others,
  ...nationalTeam,
]
.filter((p) => !p.official)
.map((p) => ({
  name: p.detected,
  photo: p.photo,
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
  .filter((p) => p.official)
  .map((p) => p.official!);

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