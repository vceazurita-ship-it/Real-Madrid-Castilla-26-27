/*
|--------------------------------------------------------------------------
| «DÓNDE HACERLES DAÑO», UNA FRASE POR JUGADOR (24/10/2026)
|--------------------------------------------------------------------------
|
| Las etiquetas de la ficha («perdedor de duelos», «lento») y los rasgos
| flojos de Wyscout («flojo en amarillas») se leían al revés y ninguna decía
| cómo atacar al jugador. Aquí se convierten en una frase con la debilidad y
| la acción: «pierde duelos y es lento → desmarques de ruptura a su espalda».
|
| Lo que no se sabe leer no se inventa: una etiqueta sin equivalencia se
| descarta, y sin ninguna debilidad con acción, el jugador no sale.
*/

type Regla = { patron: RegExp; frase: string; accion: string };

/* El orden manda: la primera acción que salga es la que se enseña. */
const REGLAS: Regla[] = [
  { patron: /perdedor de duelos|duelos (defensivos )?ganados|duelos defensivos/, frase: "pierde duelos", accion: "buscarle el 1 contra 1" },
  { patron: /^lento$|velocidad/, frase: "es lento", accion: "desmarques de ruptura a su espalda" },
  { patron: /flojo por alto|a[eé]reos?|juego a[eé]reo|de cabeza/, frase: "sufre por alto", accion: "balones largos y centros a su zona" },
  { patron: /sufre la presi[oó]n|presionable/, frase: "sufre la presión", accion: "presionarle cuando recibe" },
  { patron: /comete errores|errores no forzados|p[eé]rdidas/, frase: "pierde balones en la salida", accion: "presionar su primer pase" },
  { patron: /no repliega/, frase: "no repliega", accion: "atacar a su espalda al perder el balón" },
  { patron: /se cae f[ií]sicamente/, frase: "se cae físicamente", accion: "subir el ritmo en el último tercio del partido" },
  { patron: /s[oó]lo una pierna|perfil [uú]nico/, frase: "sólo juega con una pierna", accion: "cerrarle su perfil bueno" },
  { patron: /tarjeteable|amarillas|faltas cometidas|tarjetas/, frase: "se carga de amarillas", accion: "provocarle el 1 contra 1" },
];

/* Orden de acciones para un central; lo que no esté aquí va detrás, en su orden de siempre. */
const PRIORIDAD_CENTRAL = ["es lento", "sufre la presión", "sufre por alto", "pierde duelos"];
const rango = (frase: string) => {
  const i = PRIORIDAD_CENTRAL.indexOf(frase);

  return i < 0 ? PRIORIDAD_CENTRAL.length : i;
};

/*
| «Perfil único» con la pierna de la plantilla (16/11/2026, jueces de fútbol):
| «cerrarle su perfil bueno» no decía cuál. Con «PIE DOMINANTE» se dice la
| pierna y a qué lado se le obliga; sin pierna, la regla no da acción (no se
| inventa un perfil que nadie ha escrito).
*/
const UNA_PIERNA = "sólo juega con una pierna";

function piernaDe(pie: string) {
  const limpio = sinTildes(pie);

  if (/zurd|izq|izd/.test(limpio)) return { buena: "izquierda", mala: "derecha" };
  if (/diestr|derech|dch|\bder/.test(limpio)) return { buena: "derecha", mala: "izquierda" };

  return null;
}

function accionDePierna(pierna: { buena: string; mala: string }, esCentral: boolean, esBanda: boolean) {
  if (esCentral) return `orientarle la salida hacia su pierna ${pierna.mala} y presionarle por su ${pierna.buena}`;
  if (esBanda) return `cerrarle el perfil de dentro y obligarle a centrar con la ${pierna.mala}`;

  return `taparle la pierna ${pierna.buena} y obligarle a jugar con la ${pierna.mala}`;
}

function adaptaAccion(regla: Regla, esCentral: boolean, esLateral: boolean) {
  if (regla.frase === "pierde duelos") {
    if (esCentral) return "que nuestro 9 le fije de espaldas y le gane la primera";
    if (esLateral) return "aislar a nuestro extremo contra él";
  }

  return regla.accion;
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** «ANGEL GOMEZ» → «Angel Gomez»; las tildes las pone `conTildes` aparte. */
export const nombrePropio = (t: string) =>
  t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s\-'.])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : t;

/**
 * Una frase con la debilidad y la acción, o `null` si ninguna etiqueta tiene
 * equivalencia. `debilidades` son las etiquetas de la ficha y `flojos` los
 * nombres de los rasgos flojos en Wyscout.
 */
export function fraseDeDano(
  debilidades: string[],
  flojos: string[],
  puesto = "",
  /** «PIE DOMINANTE» de la plantilla: «ZURDO», «Diestro», «IZDO»… */
  pie = "",
): { frases: string[]; accion: string; respaldo: string | null } | null {
  const frases: string[] = [];
  /*
  | Qué rasgo de Wyscout sostiene cada regla (16/11/2026, jueces de fútbol): una
  | orden sin cifra detrás no sale como «Qué hacemos». La pierna de la
  | plantilla también cuenta como dato.
  */
  const respaldos = new Map<string, string>();
  for (const texto of flojos) {
    const regla = REGLAS.find((r) => r.patron.test(sinTildes(texto)));
    if (regla && !respaldos.has(regla.frase)) respaldos.set(regla.frase, texto);
  }
  let accion = "";
  const halladas: Regla[] = [];
  const lugar = sinTildes(puesto);
  const esCentral = /central|\bdfc\b|\bcb\b/.test(lugar);
  const esLateral = !esCentral && /lateral|carrilero|\bld\b|\bli\b|\brb\b|\blb\b/.test(lugar);
  const esBanda = esLateral || /extremo|interior|\bed\b|\bei\b|\brw|\blw/.test(lugar);
  const pierna = piernaDe(pie);

  for (const texto of [...debilidades, ...flojos]) {
    const limpio = sinTildes(texto);
    const regla = REGLAS.find((r) => r.patron.test(limpio));

    if (!regla || frases.includes(regla.frase) || (regla.frase === UNA_PIERNA && frases.some((f) => f.startsWith("sólo juega con")))) continue;

    /* Con la pierna escrita, la frase la dice; sin ella, la regla no da acción. */
    if (regla.frase === UNA_PIERNA) {
      frases.push(pierna ? `sólo juega con la pierna ${pierna.buena}` : UNA_PIERNA);

      if (pierna) halladas.push(regla);

      continue;
    }

    frases.push(regla.frase);

    halladas.push(regla);
  }

  /* Sólo las que tienen dato detrás: un rasgo flojo de Wyscout o la pierna escrita. */
  const conDato = halladas.filter((h) => respaldos.has(h.frase) || (h.frase === UNA_PIERNA && pierna));

  /* El central se ataca por su espalda y presionándole al recibir: manda la acción de mayor rango. Los demás, la primera que salió. */
  const elegida = esCentral ? [...conDato].sort((x, y) => rango(x.frase) - rango(y.frase))[0] : conDato[0];

  if (elegida) accion = elegida.frase === UNA_PIERNA && pierna ? accionDePierna(pierna, esCentral, esBanda) : adaptaAccion(elegida, esCentral, esLateral);

  return accion ? { frases: frases.slice(0, 3), accion, respaldo: elegida ? respaldos.get(elegida.frase) ?? null : null } : null;
}
