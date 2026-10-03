/**
 * ¿DOS NOMBRES SON EL MISMO CLUB? (sale de hooks/useAnalisisRivalInforme.ts, 03/10/2026)
 *
 * Cada hoja escribe el equipo a su manera: «ATL MADRID B» en el registro,
 * «Atlético Madrileño» en las fichas, «AD ALCORCÓN» en ABP. Lo usan el
 * informe del microciclo de ABP y el informe del partido.
 */

const SIGLAS = /\b(ad|cd|ud|sd|cf|fc|rcd|sad|club|deportivo|deportiva|real|cultural|sociedad)\b/g;

export const claveClub = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(SIGLAS, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/*
| Los que no comparten palabras entre una hoja y otra (02/10/2026): la hoja de
| registro escribe «ATL MADRID B» y la ficha del rival es «Atlético Madrileño».
| Sin esto el informe del microciclo 15 salía sin el análisis del rival.
*/
const MISMO_CLUB: string[][] = [["atletico madrileno", "atl madrid b", "atletico madrid b", "at madrid b", "atletico de madrid b"]];

const grupoDe = (nombre: string) => MISMO_CLUB.findIndex((grupo) => grupo.includes(claveClub(nombre)));

export function mismoClub(uno: string, otro: string) {
  const a = claveClub(uno);
  const b = claveClub(otro);

  if (!a || !b) return false;

  if (a === b) return true;

  const grupo = grupoDe(uno);

  if (grupo >= 0 && grupo === grupoDe(otro)) return true;

  /* Contenerse sólo vale con nombres de verdad: «b» está dentro de todo. */
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return true;

  /*
  | Abreviaturas de la hoja: «R.FERROL», «ATL. BALEARES». Cada palabra del
  | nombre corto (de tres letras o más) es el principio de una del largo.
  */
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];

  const palabras = corto.split(" ").filter((p) => p.length >= 3);

  const suyas = largo.split(" ");

  return palabras.length > 0 && palabras.every((p) => suyas.some((q) => q.startsWith(p)));
}

