/**
 * UN PARTIDO QUE LLEGA POR LA DIRECCIÓN (10/11/2026): `?fecha=2026-11-08&rival=Hércules`.
 *
 * Lo manda «Post del partido» (`/data-analisis?area=post`) a los
 * laboratorios de robos, pérdidas y faltas para abrirlos en el mismo partido.
 * Cada laboratorio tiene sus propios ids y su propia fecha (a veces la
 * prevista y no la jugada: Sant Andreu, 21/09 a mano y 23/09 en Opta), así
 * que se busca por fecha, a 4 días como mucho, y entre dos candidatos gana el
 * que comparte palabra con el rival.
 *
 * Se lee con `useSyncExternalStore` y la instantánea de servidor vacía, como
 * `usePestanaUrl`: leerla en un `useState` rompería la hidratación.
 */

import { useSyncExternalStore } from "react";

const limpia = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 3);

const dia = (fecha: string) => Date.parse(`${fecha.slice(0, 10)}T12:00:00Z`);

/** El partido de `lista` que es el de la dirección (o null). */
export function partidoEnlazado<T extends { id: string; fecha: string; rival: string }>(lista: T[], fecha: string, rival: string): T | null {
  const objetivo = dia(fecha);
  if (!fecha || !Number.isFinite(objetivo)) return null;
  const suyas = new Set(limpia(rival));
  let mejor: { p: T; nota: number } | null = null;
  for (const p of lista) {
    const d = Math.abs(dia(p.fecha) - objetivo) / 86_400_000;
    if (!(d <= 4)) continue;
    const comparte = limpia(p.rival).some((w) => suyas.has(w));
    const nota = d - (comparte ? 10 : 0);
    if (!mejor || nota < mejor.nota) mejor = { p, nota };
  }
  return mejor?.p ?? null;
}

const nada = () => () => {};
const vacio = () => "";

/** `fecha|rival` de la dirección («» si no viene). */
export function usePartidoDeLaUrl(): { fecha: string; rival: string } {
  const crudo = useSyncExternalStore(
    nada,
    () => {
      const q = new URLSearchParams(window.location.search);
      return `${q.get("fecha") ?? ""}|${q.get("rival") ?? ""}`;
    },
    vacio,
  );
  const [fecha = "", rival = ""] = crudo.split("|");
  return { fecha, rival };
}
