/*
| ERRATAS DE LA HOJA, CORREGIDAS AL PINTAR (06/11/2026, expertos)
|
| «lanzadador», «ultimo», «Crecieminto»: se escriben deprisa en la hoja y
| salían tal cual en los informes y en los PDF de los jugadores. Se corrigen
| al leer, palabra entera y respetando la mayúscula; la hoja no se toca.
*/

const ERRATAS: Record<string, string> = {
  lanzadador: "lanzador",
  lanzadadores: "lanzadores",
  ultimo: "último",
  ultima: "última",
  ultimos: "últimos",
  ultimas: "últimas",
  penultimo: "penúltimo",
  penultima: "penúltima",
  crecieminto: "crecimiento",
  creciemiento: "crecimiento",
  despues: "después",
  rapido: "rápido",
  rapida: "rápida",
  porteria: "portería",
  balon: "balón",
  transicion: "transición",
  presion: "presión",
  segun: "según",
  tambien: "también",
  /* 10/11/2026 (jueces): «2 lineas de 4», «Primera linea». */
  linea: "línea",
  lineas: "líneas",
  area: "área",
  rapidos: "rápidos",
  /* 11/11/2026 (marketing): «tarea 2 (corner, faltas y transición)». */
  corner: "córner",
  corners: "córners",
};

export function corrigeErratas(texto: string): string {
  if (!texto) return texto;

  return texto.replace(/(?<![\p{L}\d])\p{L}+(?![\p{L}\d])/gu, (palabra) => {
    const bien = ERRATAS[palabra.toLocaleLowerCase("es-ES")];

    if (!bien || bien === palabra.toLocaleLowerCase("es-ES")) return palabra;
    if (palabra === palabra.toLocaleUpperCase("es-ES") && palabra.length > 1) return bien.toLocaleUpperCase("es-ES");
    if (palabra[0] === palabra[0].toLocaleUpperCase("es-ES")) return bien.charAt(0).toLocaleUpperCase("es-ES") + bien.slice(1);

    return bien;
  });
}
