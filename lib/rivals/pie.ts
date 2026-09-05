/*
|--------------------------------------------------------------------------
| EL PIE DOMINANTE, EN CRISTIANO
|--------------------------------------------------------------------------
|
| Zurdo o diestro es de lo primero que se mira de un rival: dice hacia dónde
| va a salir un lateral, por qué banda se perfila un extremo y a qué lado hay
| que achicarle el centro. Por eso se pinta ya en **todos** los campogramas
| —el pop-up del once, el PDF del once y del portero, las hojas del informe y
| el campograma de día de partido—, y no sólo en la ficha larga del jugador.
|
| Vive en su propio módulo y no dentro de `lienzo-club.ts`, que es donde
| nació, porque de allí lo tendrían que importar el PDF (jsPDF) y el pop-up
| (React): `lienzo-club` arrastra la Barlow Condensed de `next/font`, y una
| función que sólo mira una cadena no puede meter una fuente en el paquete de
| media app. `lienzo-club` lo reexporta, así que quien ya lo pedía de allí
| sigue funcionando.
*/

/**
 * Cómo se lee el pie dominante en una chapa.
 *
 * La hoja lo escribe a mano y no siempre igual —«Zurdo», «zurda»,
 * «Izquierdo»—, y esto se proyecta: se normaliza a las tres palabras que el
 * cuerpo técnico usa. Lo que no encaje se pinta tal cual en versales, que es
 * mejor que tragarse un dato que alguien se ha molestado en escribir.
 */
export function pieDominante(valor: string | undefined) {
  const texto = (valor ?? "").trim();

  if (!texto || texto === ".") return "";

  const limpio = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  /* La hoja de rivales escribe "DCHO", "IZDO" y "AMBOS" —así viene de
     BeSoccer—, pero a mano se ha escrito de todo: se aceptan las dos formas y
     se pinta siempre la palabra entera, que es la que se lee proyectada. */
  if (limpio.includes("ambi") || limpio.includes("ambos")) return "AMBIDIESTRO";

  if (
    limpio.includes("zurd") ||
    limpio.includes("izq") ||
    limpio.includes("izd")
  ) {
    return "ZURDO";
  }

  if (
    limpio.includes("diestr") ||
    limpio.includes("derech") ||
    limpio.includes("dch") ||
    limpio.includes("der")
  ) {
    return "DIESTRO";
  }

  return texto.toUpperCase();
}

/**
 * El mismo dato para una chapa de campograma, donde el sitio es el de un
 * nombre y no el de una ficha entera.
 *
 * Sólo cambia el ambidiestro: «AMBIDIESTRO» son once caracteres y en una
 * línea de cinco jugadores se comía la chapa —o la dejaba recortada en
 * «AMBIDIES…», que se lee peor que nada—. «AMBOS» dice lo mismo en la mitad
 * y es como se dice en la charla.
 */
export function pieChapa(valor: string | undefined) {
  const pie = pieDominante(valor);

  return pie === "AMBIDIESTRO" ? "AMBOS" : pie;
}

/**
 * La inicial, para cuando ni «ZURDO» cabe: las fichas de las hojas de
 * partidos del informe, donde hay cuarenta y cuatro jugadores repartidos en
 * cuatro campogramas de una misma diapositiva.
 *
 * La letra va acompañada de color —el zurdo en rosa de la casa, el diestro en
 * crema— porque a ese tamaño se lee antes el tono que el trazo: lo que se
 * busca de un vistazo en el once de un rival es **por dónde tiene a los
 * zurdos**, y con dos colores eso se ve sin llegar a leer.
 */
export function pieInicial(valor: string | undefined) {
  const pie = pieDominante(valor);

  if (pie === "ZURDO") return "Z";
  if (pie === "DIESTRO") return "D";
  if (pie === "AMBIDIESTRO") return "A";

  return "";
}

/** Si tira con la izquierda. Es lo que decide el color de la marca. */
export function esZurdo(valor: string | undefined) {
  const pie = pieDominante(valor);

  return pie === "ZURDO" || pie === "AMBIDIESTRO";
}
