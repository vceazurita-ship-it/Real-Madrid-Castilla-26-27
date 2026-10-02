"use client";

/**
 * Lo analizado del rival de la semana, listo para el informe del microciclo.
 *
 * Busca en «ABP del Rival» la jornada más reciente del rival contra el que se
 * prepara el micro y devuelve sus láminas de balón parado como imágenes —que
 * es lo único que sobrevive en un correo— y las conclusiones por sección.
 *
 * El nombre del rival del microciclo sale del calendario («Alcorcón») y el de
 * la hoja de plantillas es otro («AD Alcorcón»): se cruzan quitando las siglas
 * de club, como hace la quiniela con BeSoccer.
 */

import { useEffect, useState } from "react";

import type { GraficoInforme } from "@/lib/abp/informe-graficos";
import type { RivalAnalisisInforme } from "@/lib/abp/informe-micro";
import { traeJson } from "@/lib/hojaCsv";
import {
  analisisKey,
  laminaVacia,
  normalizaAnalisis,
  ordenJornada,
  SECCION_POR_ID,
  seccionesDe,
} from "@/lib/rivals/analisis";
import { resolutorDeFichas } from "@/lib/rivals/analisis-fichas";
import { laminaImagen } from "@/lib/rivals/analisis-svg";

const SIGLAS = /\b(ad|cd|ud|sd|cf|fc|rcd|sad|club|deportivo|deportiva|real|cultural|sociedad)\b/g;

const clave = (nombre: string) =>
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

const grupoDe = (nombre: string) => MISMO_CLUB.findIndex((grupo) => grupo.includes(clave(nombre)));

function mismoEquipo(uno: string, otro: string) {
  const a = clave(uno);
  const b = clave(otro);

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

export type AnalisisRivalInforme = {
  graficos: GraficoInforme[];
  rivalAnalisis: RivalAnalisisInforme | null;
  cargando: boolean;
};

const NADA: AnalisisRivalInforme = { graficos: [], rivalAnalisis: null, cargando: false };

export function useAnalisisRivalInforme(rival: string): AnalisisRivalInforme {
  const [resultado, setResultado] = useState<AnalisisRivalInforme>({ ...NADA, cargando: true });

  useEffect(() => {
    let cancelado = false;

    async function carga(): Promise<AnalisisRivalInforme> {
      if (!rival.trim()) return NADA;

      const plantilla = await traeJson<unknown>("/api/rivals?action=rivalesPlantillas").catch(() => []);

      const filas = Array.isArray(plantilla) ? (plantilla as Record<string, unknown>[]) : [];

      const equipos = [...new Set(filas.map((f) => String(f.NOMBRE_EQUIPO ?? "").trim()).filter(Boolean))];

      const equipo = equipos.find((uno) => mismoEquipo(uno, rival));

      if (!equipo) return NADA;

      const respuesta = await fetch(`/api/docs?key=${encodeURIComponent(analisisKey(equipo))}`, {
        cache: "no-store",
      });

      const json = (await respuesta.json().catch(() => null)) as { data?: unknown } | null;

      const analisis = normalizaAnalisis(json?.data);

      const deAbp = new Set(seccionesDe("abp").map((s) => s.id));

      /* La jornada más reciente que tenga algo de balón parado. */
      const jornada = Object.keys(analisis.jornadas)
        .filter((j) => {
          const t = analisis.jornadas[j];

          return (
            t.laminas.some((l) => deAbp.has(l.seccion) && !laminaVacia(l)) ||
            Object.entries(t.notas ?? {}).some(([s, texto]) => deAbp.has(s as never) && texto?.trim())
          );
        })
        .sort(ordenJornada)
        .pop();

      if (!jornada) return NADA;

      const trabajo = analisis.jornadas[jornada];

      const ficha = resolutorDeFichas(plantilla, equipo);

      /* Sólo las que tienen algo: una lámina en blanco no dice nada. */
      const laminas = seccionesDe("abp").flatMap((s) =>
        trabajo.laminas.filter((l) => l.seccion === s.id && !laminaVacia(l)),
      );

      const graficos: GraficoInforme[] = [];

      /* En serie, como al exportar: varias a la vez tumban la pestaña. */
      for (const [i, lamina] of laminas.entries()) {
        if (cancelado) break;

        try {
          const imagen = await laminaImagen(lamina, { ficha, equipo, jornada }, { ancho: 1280, formato: "image/png" });

          graficos.push({
            cid: `rival-${i + 1}`,
            titulo: lamina.titulo || SECCION_POR_ID.get(lamina.seccion)?.titulo || "Lámina",
            area: "rival",
            leyenda: lamina.notas?.trim() || `${SECCION_POR_ID.get(lamina.seccion)?.titulo ?? ""} · ${equipo}, ${jornada}.`,
            imagen,
            ancho: 760,
          });
        } catch {
          /* Una lámina que no se deja dibujar no tumba el informe. */
        }
      }

      const conclusiones = seccionesDe("abp")
        .map((s) => ({ seccion: s.titulo, texto: trabajo.notas?.[s.id]?.trim() ?? "" }))
        .filter((una) => una.texto);

      return {
        graficos,
        rivalAnalisis: { equipo, jornada, conclusiones },
        cargando: false,
      };
    }

    carga()
      .catch(() => NADA)
      .then((listo) => {
        if (!cancelado) setResultado(listo);
      });

    return () => {
      cancelado = true;
    };
  }, [rival]);

  return resultado;
}
