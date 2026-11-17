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

  /* «Ambidiestro» / «ambos» lleva «diestr» dentro, pero no tiene pierna mala. */
  if (/ambi|ambos|las dos/.test(limpio)) return null;
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
): { frases: string[]; conDato: string[]; accion: string; respaldo: string | null } | null {
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

  /*
  | Las frases que tienen cifra detrás (17/11/2026, jueces de fútbol): «pierde
  | duelos» salía sólo de la etiqueta, sin número. En pantalla van éstas; la
  | pierna escrita en la plantilla cuenta como dato.
  */
  const fraseConDato = (f: string) =>
    f.startsWith("sólo juega con la pierna") ? Boolean(pierna) : respaldos.has(f);

  return accion
    ? { frases: frases.slice(0, 3), conDato: frases.filter(fraseConDato).slice(0, 3), accion, respaldo: elegida ? respaldos.get(elegida.frase) ?? null : null }
    : null;
}

/*
| UNA SOLA ORDEN POR JUGADOR (16/11/2026, ronda 18, jueces de fútbol): /rivals
| mandaba «provocarle el 1 contra 1» a Jorge Mier mientras el Plan y Duelos lo
| daban por el duelo que perdemos (−62). Si el jugador está en un duelo medido
| que se despega (±10, sin muestra corta), manda la orden del duelo: la misma
| frase que /duelos y el Plan de partido. Si no, la de sus etiquetas.
*/
type DueloParaOrden = {
  titulo: string;
  suyos: string[];
  conBalon: number | null;
  sinBalon: number | null;
  consigna: string;
  base: string;
};

export function ordenDelDuelo(
  nombre: string,
  grupos: { buscar: DueloParaOrden[]; doble: DueloParaOrden[]; vigilar: DueloParaOrden[] } | null | undefined,
  mismo: (a: string, b: string) => boolean,
): {
  accion: string;
  cifra: string;
  enContra: boolean;
  /** Las piezas por separado (17/11/2026): el chip, la tarea, el objetivo y la base, para plegarlas tras «Ver el duelo». */
  duelo: { titulo: string; conBalon: number | null; sinBalon: number | null; tarea: string; objetivo: string; base: string };
} | null {
  if (!grupos || !nombre) return null;

  /* Primero donde perdemos: es la orden que no se puede contradecir. */
  const lista = [...grupos.vigilar, ...grupos.doble, ...grupos.buscar];
  const limpio = (s: string) => s.replace(/\s*\(.*\)\s*$/, "");
  /*
  | 18/11/2026 (jueces): la tarjeta «Palmberg · mediapunta» llevaba la consigna
  | «Cestero: no ir al choque con Javi Mier», porque el duelo de la zona de
  | medios tiene a los dos. Un duelo sólo da la orden de un jugador si la
  | consigna le nombra a él o no nombra a otro de los suyos.
  */
  const plano = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const nombra = (texto: string, quien: string) => {
    const piezas = plano(quien).split(/[^a-z]+/).filter((p) => p.length >= 3);
    const enTexto = new Set(plano(texto).split(/[^a-z]+/));

    return piezas.length > 0 && piezas.every((p) => enTexto.has(p));
  };
  const duelo = lista.find((d) => {
    if (!d.consigna || !d.suyos.some((s) => mismo(limpio(s), nombre))) return false;

    const otros = d.suyos.map(limpio).filter((s) => !mismo(s, nombre));

    return nombra(d.consigna, nombre) || !otros.some((o) => nombra(d.consigna, o));
  });

  if (!duelo) return null;

  const [orden, ...resto] = duelo.consigna.split(/\s(?=Tarea:|Objetivo:)/);
  const signo = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}`;
  const cifras = [
    duelo.conBalon != null ? `con nuestro balón ${signo(duelo.conBalon)}` : "",
    duelo.sinBalon != null ? `con el suyo ${signo(duelo.sinBalon)}` : "",
  ].filter(Boolean);
  /* La orden es defensiva cuando el duelo se pierde con su balón: es el sentido que elige `sentidoDeLaConsigna`. */
  const enContra = (duelo.sinBalon ?? 0) <= -10;
  const pieza = (rotulo: string) => resto.find((r) => r.startsWith(rotulo))?.slice(rotulo.length).trim().replace(/\.\s*$/, "") ?? "";

  return {
    accion: orden.replace(/\.\s*$/, ""),
    cifra: `Duelo «${duelo.titulo}» (${cifras.join(" · ")}), el mismo de Duelos y del Plan de partido.${resto.length ? ` ${resto.join(" ")}` : ""}${duelo.base ? ` ${duelo.base}.` : ""}`,
    enContra,
    duelo: { titulo: duelo.titulo, conBalon: duelo.conBalon, sinBalon: duelo.sinBalon, tarea: pieza("Tarea:"), objetivo: pieza("Objetivo:"), base: duelo.base },
  };
}
