/**
 * LO QUE LA LÁMINA EXPORTADA DIBUJA AUNQUE NADIE LO HAYA PUESTO (07/11/2026).
 *
 * Los jueces de los exportables de la pizarra (PDF, PPT, PDF por jugador)
 * pidieron dos cosas que el analista no tiene por qué dibujar a mano:
 *
 * - En las láminas defensivas, el rival. Un marcador sin atacante delante no
 *   marca a nadie y no se entiende su trabajo. Si no hay rivales dibujados, se
 *   pone uno pegado a cada puesto del grupo «marcas», un paso por delante de él
 *   hacia fuera del área (lo mismo que hace el vídeo por jugador,
 *   `rodaje-escena.tsx`), con el dorsal de «Quién marca a quién» si está.
 * - El portero, siempre. En las ofensivas, el suyo (la chapa «P» del rival,
 *   la convención de la pizarra); en las defensivas, el nuestro bajo palos,
 *   salvo que ya haya un portero entre las fichas.
 *
 * Sólo al enseñar (`soloVer`): en el editor no aparecen fichas que no se
 * pueden mover. La posición sale de la cámara calibrada de cada foto
 * (`aLienzo`, metros desde la línea de gol): no se inventan píxeles.
 */

import { aLienzo, aMetros } from "@/lib/abp-lab/puente-pizarra";
import { PLANTILLA_BY_KEY, puestoDe, type SlidePizarra } from "@/lib/abp/pizarra";
import type { RivalPizarra } from "@/lib/abp/trazos";

/** Prefijo de los rivales que no están en el documento: no se arrastran. */
export const PREFIJO_IMPLICITO = "auto-";

export function esImplicito(rival: RivalPizarra) {
  return rival.id.startsWith(PREFIJO_IMPLICITO);
}

/** Las plantillas sin portería que enseñar (la pizarra libre). */
const SIN_PORTERIA = new Set(["libre"]);

export function rivalesDeLaLamina(slide: SlidePizarra): RivalPizarra[] {
  const propios = slide.rivales ?? [];
  const plantilla = PLANTILLA_BY_KEY.get(slide.plantilla);

  if (!plantilla || SIN_PORTERIA.has(plantilla.key)) return propios;

  const vista = slide.vista === "porteria" ? "porteria" : "ancho";
  const extra: RivalPizarra[] = [];

  if (plantilla.lado === "defensivo" && propios.length === 0) {
    for (const ficha of slide.fichas) {
      const puesto = puestoDe(slide, ficha.puesto);

      /* 12/11/2026: el saque de banda no tiene grupo «marcas» —sus marcas
         (M1…M5) van en «ÁREA»— y la lámina salía sin un solo rival. */
      if (!puesto || (puesto.grupo !== "marcas" && !/^M\d$/.test(puesto.code))) continue;

      const m = aMetros(vista, { x: ficha.x, y: ficha.y });
      const p = aLienzo(vista, { x: m.x + 0.5, y: m.y + 1.3 });
      const dorsal = slide.marcas?.[puesto.key];

      extra.push({ id: `${PREFIJO_IMPLICITO}${ficha.id}`, x: p.x, y: p.y, ...(dorsal ? { dorsal } : {}) });
    }
  }

  /* El sacador del saque de banda, en la línea, junto a nuestro «al sacador». */
  const saque = propios.length === 0 ? saqueDeLaLamina(slide) : null;

  if (saque) extra.push({ id: `${PREFIJO_IMPLICITO}sacador`, x: saque.sacador.x, y: saque.sacador.y });

  /* Su portero en las ofensivas, si no lo han dibujado ya. */
  /* En la falta directa no: el rótulo «PENALTI» cae justo encima de la portería y lo tapaba. */
  if (plantilla.lado === "ofensivo" && plantilla.key !== "directas" && !propios.some((r) => /^p$/i.test(r.dorsal ?? ""))) {
    const p = aLienzo(vista, { x: 34, y: 0.8 });

    extra.push({ id: `${PREFIJO_IMPLICITO}portero`, x: p.x, y: p.y, dorsal: "P" });
  }

  return extra.length ? [...propios, ...extra] : propios;
}

/** Dónde va nuestro portero en una defensiva (bajo palos), o `null`. */
export function porteroPropioDeLaLamina(slide: SlidePizarra): { x: number; y: number } | null {
  const plantilla = PLANTILLA_BY_KEY.get(slide.plantilla);

  if (!plantilla || plantilla.lado !== "defensivo" || SIN_PORTERIA.has(plantilla.key)) return null;

  return aLienzo(slide.vista === "porteria" ? "porteria" : "ancho", { x: 34, y: 0.6 });
}

/**
 * El punto de saque de un saque de banda (12/11/2026, jueces): la lámina
 * defensiva salía sin balón ni sacador y no se sabía desde dónde venía. Se
 * pone en la banda más cercana a nuestro «al sacador», a su altura, y el
 * sacador rival un paso por fuera. `null` si la lámina no es de banda, si no
 * hay nadie al sacador o si ya hay un balón dibujado.
 */
export function saqueDeLaLamina(slide: SlidePizarra): { balon: { x: number; y: number }; sacador: { x: number; y: number } } | null {
  if (!slide.plantilla.startsWith("banda")) return null;

  if (slide.trazos?.some((trazo) => trazo.tipo === "balon")) return null;

  const ficha = slide.fichas.find((item) => puestoDe(slide, item.puesto)?.code === "S");

  if (!ficha) return null;

  const vista = slide.vista === "porteria" ? "porteria" : "ancho";
  const m = aMetros(vista, { x: ficha.x, y: ficha.y });
  const banda = m.x < 34 ? 0 : 68;
  const fuera = m.x < 34 ? -0.6 : 68.6;

  return {
    balon: aLienzo(vista, { x: banda, y: m.y - 0.4 }),
    sacador: aLienzo(vista, { x: fuera, y: m.y }),
  };
}
