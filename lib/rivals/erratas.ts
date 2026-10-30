/**
 * LAS ERRATAS DEL TEXTO DEL ANALISTA (30/10/2026).
 *
 * El informe del rival se escribe deprisa, entre partido y partido, y salía
 * tal cual en la charla: «especíalmente», «recepciónes», «tambien». Como
 * `conTildes`, esto **sólo pinta**: lo guardado en la hoja no se toca, y en
 * edición se ve lo escrito.
 *
 * Es una lista cerrada de palabras que en español sólo se escriben de una
 * manera; una palabra que no está en la lista se deja como viene.
 */

const ARREGLO: Record<string, string> = {
  /* Tilde que sobra. */
  "especíalmente": "especialmente",
  "recepciónes": "recepciones",
  "transiciónes": "transiciones",
  "posiciónes": "posiciones",
  "situaciónes": "situaciones",
  "acciónes": "acciones",
  "presiónes": "presiones",
  "intenciónes": "intenciones",
  "conducciónes": "conducciones",
  /* Tilde que falta. */
  tambien: "también",
  ademas: "además",
  despues: "después",
  rapido: "rápido",
  rapida: "rápida",
  rapidos: "rápidos",
  rapidas: "rápidas",
  balon: "balón",
  transicion: "transición",
  posicion: "posición",
  presion: "presión",
  recepcion: "recepción",
  conduccion: "conducción",
  intencion: "intención",
  situacion: "situación",
  accion: "acción",
  linea: "línea",
  lineas: "líneas",
  area: "área",
  areas: "áreas",
  practicamente: "prácticamente",
  facilmente: "fácilmente",
  dificil: "difícil",
  dificiles: "difíciles",
  util: "útil",
  utiles: "útiles",
  ultimo: "último",
  ultima: "última",
  ultimos: "últimos",
  ultimas: "últimas",
  tecnico: "técnico",
  tecnica: "técnica",
  fisico: "físico",
  fisica: "física",
  maximo: "máximo",
  minimo: "mínimo",
  segun: "según",
  aqui: "aquí",
  alli: "allí",
  tambíen: "también",
};

/* Una palabra suelta: letras (con tildes) y nada pegado. */
const PALABRA = /[\p{L}]+/gu;

/** El texto con las erratas de la lista corregidas, respetando la mayúscula inicial. */
export function sinErratas(texto: string): string {
  if (!texto) return texto;

  return texto.replace(PALABRA, (palabra) => {
    const bien = ARREGLO[palabra.toLowerCase()];

    if (!bien || bien === palabra.toLowerCase()) return palabra;

    /* «TAMBIEN» en mayúsculas se deja: es un rótulo, no una errata de tilde. */
    if (palabra === palabra.toUpperCase() && palabra.length > 1) return palabra;

    return palabra[0] === palabra[0].toUpperCase() ? bien[0].toUpperCase() + bien.slice(1) : bien;
  });
}
