/**
 * Atar las listas de reproducción del canal con los rivales y sus jugadores.
 *
 * En el canal hay **una lista por equipo rival**, y dentro los cortes que se
 * han ido montando en el coding. El scouting individual necesita dos cosas de
 * ahí, y ninguna viene dada:
 *
 * 1. **Qué lista es la de este rival.** Nadie va a mantener a mano una tabla de
 *    equivalencias, así que se empareja por el nombre —«Águilas FC» con
 *    «ÁGUILAS FC 26/27», con «Aguilas», con «CD Águilas»— y lo que no case se
 *    elige una vez y se recuerda.
 * 2. **De qué jugador habla cada vídeo.** Los títulos los escribe quien monta
 *    el corte, así que lo único fiable es buscar en el título los nombres de la
 *    plantilla que ya tenemos en la hoja. El que aparezca, gana; y si no
 *    aparece ninguno, el vídeo es del equipo y no de nadie en particular, que
 *    también es una respuesta.
 *
 * Todo lo de aquí es texto: no toca red ni almacenamiento, para poder probarlo
 * sin navegador.
 */

/** Sin tildes, sin mayúsculas y sin puntuación: el nombre desnudo. */
export function desnuda(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
| Lo que se dice del equipo pero no lo identifica: la forma jurídica, la
| temporada y las palabras con las que se bautiza una lista.
|
| Se quitan para comparar, **nunca para enseñar**: la lista sigue llamándose
| como la llamó quien la creó.
*/
const RUIDO = new Set([
  "cf",
  "fc",
  "cd",
  "ud",
  "sd",
  "ad",
  "sad",
  "club",
  "deportivo",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "atletico",
  "balompie",
  "b",
  "sad",
  "rival",
  "rivales",
  "scouting",
  "scout",
  "analisis",
  "videos",
  "video",
  "cortes",
  "temporada",
  "2026",
  "2027",
  "26",
  "27",
  "26 27",
]);

/** Las palabras del nombre que de verdad dicen de quién se habla. */
export function palabrasClave(nombre: string) {
  return desnuda(nombre)
    .split(" ")
    .filter((palabra) => palabra.length > 1 && !RUIDO.has(palabra));
}

export type ListaCanal = { id: string; nombre: string; cuenta: number };

/**
 * Cuánto se parecen el nombre de una lista y el de un equipo, de 0 a 1.
 *
 * No es una distancia de edición: con nombres de club lo que funciona es mirar
 * si las palabras que identifican al equipo están en la lista. «Águilas FC» y
 * «ÁGUILAS 26/27 · cortes» comparten la única palabra que importa.
 */
export function parecido(nombreLista: string, equipo: string) {
  const dela = palabrasClave(nombreLista);
  const del = palabrasClave(equipo);

  if (dela.length === 0 || del.length === 0) return 0;

  const enLaLista = new Set(dela);

  const aciertos = del.filter((palabra) => enLaLista.has(palabra)).length;

  if (aciertos === 0) {
    /* Último intento: «torremolinos» dentro de «juventuddetorremolinos». */
    const pegado = dela.join("");

    const sueltos = del.filter(
      (palabra) => palabra.length >= 5 && pegado.includes(palabra),
    ).length;

    return sueltos ? (sueltos / del.length) * 0.7 : 0;
  }

  return aciertos / del.length;
}

/**
 * La lista de este equipo, o `null` si ninguna se le parece lo bastante.
 *
 * El listón está alto a propósito: enseñar los vídeos del Alcorcón en la ficha
 * del Águilas es peor que no enseñar ninguno, porque nadie lo comprobaría.
 */
export function buscaLista(listas: ListaCanal[], equipo: string) {
  let mejor: { lista: ListaCanal; punto: number } | null = null;

  for (const lista of listas) {
    const punto = parecido(lista.nombre, equipo);

    if (punto >= 0.6 && (!mejor || punto > mejor.punto)) {
      mejor = { lista, punto };
    }
  }

  return mejor?.lista ?? null;
}

/* ------------------------------------------------------------------ */
/*  DE QUÉ JUGADOR HABLA UN VÍDEO                                      */
/* ------------------------------------------------------------------ */

export type JugadorPlantilla = { nombre: string; dorsal?: string };

/**
 * Busca en el título a alguno de los jugadores de la plantilla.
 *
 * Tres reglas, y las tres salieron de equivocarse:
 *
 * 1. **Gana el nombre más largo que aparezca.** Con «Alex» y «Alex Revuelta» en
 *    la misma plantilla, un vídeo que diga «Alex Revuelta» es del segundo.
 * 2. **El nombre entero gana al trozo.** Si el título sólo dice «ALEX», es de
 *    quien se llama Alex, no del trozo del nombre de otro.
 * 3. **Si sigue habiendo empate, no se elige.** Dos jugadores que comparten el
 *    nombre de pila y un título que sólo lo dice es un vídeo sin dueño claro:
 *    colgárselo a uno de los dos es peor que dejarlo en el montón del equipo,
 *    porque nadie va a ir a comprobarlo.
 *
 * Se exige además que el nombre encaje entre separadores —«Ander» no puede
 * salir de «Santander»— y no se arriesga con menos de cuatro letras, que son
 * las que más falsos positivos dan.
 */
export function jugadorDelTitulo(
  titulo: string,
  plantilla: JugadorPlantilla[],
) {
  const limpio = ` ${desnuda(titulo)} `;

  const encontrados: {
    jugador: JugadorPlantilla;
    texto: string;
    completo: boolean;
  }[] = [];

  for (const jugador of plantilla) {
    const nombre = desnuda(jugador.nombre);

    if (!nombre) continue;

    const partes = nombre.split(" ").filter(Boolean);

    /* El nombre entero, y si no, cada palabra suya que sea distintiva. */
    const candidatos = [
      { texto: nombre, completo: true },
      ...partes.map((parte) => ({ texto: parte, completo: partes.length === 1 })),
    ];

    let mejor: { texto: string; completo: boolean } | null = null;

    for (const candidato of candidatos) {
      if (candidato.texto.length < 4) continue;

      if (!limpio.includes(` ${candidato.texto} `)) continue;

      if (
        !mejor ||
        candidato.texto.length > mejor.texto.length ||
        (candidato.texto.length === mejor.texto.length && candidato.completo)
      ) {
        mejor = candidato;
      }
    }

    if (mejor) encontrados.push({ jugador, ...mejor });
  }

  if (encontrados.length === 0) return null;

  encontrados.sort(
    (a, b) =>
      b.texto.length - a.texto.length ||
      Number(b.completo) - Number(a.completo),
  );

  const ganador = encontrados[0];

  /* Empate a trozo de nombre entre dos jugadores distintos: no se decide. */
  const empatan = encontrados.filter(
    (item) => item.texto === ganador.texto && item.completo === ganador.completo,
  );

  if (!ganador.completo && empatan.length > 1) return null;

  return ganador.jugador;
}

/**
 * Lo que queda del título al quitarle el nombre del jugador.
 *
 * El título de un corte suele ser «Yasser · pérdidas en salida», y una vez
 * agrupado por jugador repetir su nombre en cada ficha es ruido. Se queda lo
 * que describe el corte, que es lo que se lee.
 */
export function temaDelTitulo(titulo: string, jugador: JugadorPlantilla | null) {
  if (!jugador) return titulo.trim();

  const fuera = new RegExp(
    jugador.nombre
      .split(/\s+/)
      .filter(Boolean)
      .map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|"),
    "gi",
  );

  const resto = titulo
    .replace(fuera, " ")
    .replace(/[·—–-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return resto || titulo.trim();
}

/* ------------------------------------------------------------------ */
/*  ENLACES                                                            */
/* ------------------------------------------------------------------ */

export const enlaceVideo = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const enlaceLista = (id: string) =>
  `https://www.youtube.com/playlist?list=${id}`;

/** El reproductor incrustado. `nocookie` para no plantar publicidad ni rastro. */
export const enlaceIncrustado = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;

/** Documento donde se recuerda la lista elegida a mano para cada equipo. */
export const CLAVE_LISTAS = "youtube-listas-rivales";

export type ListasRivales = { porEquipo: Record<string, string> };

export const LISTAS_VACIAS: ListasRivales = { porEquipo: {} };
