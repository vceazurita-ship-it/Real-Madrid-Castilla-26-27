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
  clipsKey,
  laminaVacia,
  normalizaAnalisis,
  ordenJornada,
  SECCION_POR_ID,
  seccionesDe,
  type RivalClipsDoc,
} from "@/lib/rivals/analisis";

/** Páginas de cada PDF que entran en el informe. */
const PAGINAS_POR_PDF = 8;
import { resolutorDeFichas } from "@/lib/rivals/analisis-fichas";
import { laminaImagen } from "@/lib/rivals/analisis-svg";

import { claveClub as clave, mismoClub as mismoEquipo } from "@/lib/rivals/mismoClub";

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

      /* Los vídeos y los PDF de la jornada viven aparte (los sube el vigía). */
      const clips = await fetch(`/api/docs?key=${encodeURIComponent(clipsKey(equipo))}`, { cache: "no-store" })
        .then((r) => r.json() as Promise<{ data?: RivalClipsDoc | null }>)
        .then((d) => d?.data?.jornadas ?? {})
        .catch(() => ({}) as RivalClipsDoc["jornadas"]);

      /*
      | TODO lo preparado del rival, no sólo el balón parado (02/10/2026): el
      | informe del microciclo 15 salía sin los centros laterales del
      | Atlético Madrileño ni los dos PDF de la J6. Primero ABP y luego Área.
      */
      const secciones = [...seccionesDe("abp"), ...seccionesDe("area")];

      const tieneAlgo = (j: string) => {
        const t = analisis.jornadas[j];

        return Boolean(
          t?.laminas.some((l) => !laminaVacia(l)) ||
            Object.values(t?.notas ?? {}).some((texto) => texto?.trim()) ||
            clips[j]?.docs?.length,
        );
      };

      /* La jornada más reciente que tenga algo. */
      const jornada = [...new Set([...Object.keys(analisis.jornadas), ...Object.keys(clips)])]
        .filter(tieneAlgo)
        .sort(ordenJornada)
        .pop();

      if (!jornada) return NADA;

      const trabajo = analisis.jornadas[jornada] ?? { laminas: [], notas: {} };

      const ficha = resolutorDeFichas(plantilla, equipo);

      /* Sólo las que tienen algo: una lámina en blanco no dice nada. */
      const laminas = secciones.flatMap((s) =>
        trabajo.laminas.filter((l) => l.seccion === s.id && !laminaVacia(l)),
      );

      const documentos = (clips[jornada]?.docs ?? []).filter((d) => /\.pdf($|\?)/i.test(d.url || d.path || ""));

      /* Los títulos de lo que ya va dibujado, para no repetirlo desde el PDF. */
      const titulosDibujados = laminas.map((l) => clave(l.titulo ?? ""));

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

      /*
      | Los PDF de la jornada (el informe complementario de ABP, el de centros
      | laterales…): sus páginas, como imágenes. Un correo no abre un PDF
      | dentro, y un enlace solo no se lee en el móvil. Con tope por documento
      | para que el correo no pese más de la cuenta.
      */
      if (documentos.length && !cancelado) {
        try {
          const pdfjs = await import("pdfjs-dist");

          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

          for (const doc of documentos) {
            if (cancelado) break;

            try {
              const respuesta = await fetch(doc.url);

              if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

              const datos = new Uint8Array((await respuesta.arrayBuffer()) as ArrayBuffer);

              const pdf = await pdfjs.getDocument({ data: datos }).promise;

              const paginas = Math.min(pdf.numPages, PAGINAS_POR_PDF);

              for (let n = 1; n <= paginas && !cancelado; n++) {
                const pagina = await pdf.getPage(n);

                /*
                | Sólo las páginas que son una lámina y que NO están ya dibujadas
                | arriba (02/10/2026). Los PDF se hacen sobre una plantilla y
                | traen portada y cierre —el del Atlético Madrileño llevaba aún
                | el escudo del Alcorcón en la contraportada—, y sus láminas son
                | las mismas que ya salen dibujadas. Lo demás, en el enlace.
                */
                const texto = clave(
                  ((await pagina.getTextContent()).items as { str?: string }[]).map((i) => i.str ?? "").join(" "),
                );

                /* Una portada dice «INFORME …»; una lámina, no. */
                const esLamina = /corner|falta|centro|penalti|banda|saque|area/.test(texto) && !/\binforme\b/.test(texto);

                const yaDibujada = titulosDibujados.some((t) => t && texto.includes(t));

                if (!esLamina || yaDibujada) continue;

                const base = pagina.getViewport({ scale: 1 });

                const vista = pagina.getViewport({ scale: 1100 / base.width });

                const lienzo = document.createElement("canvas");

                lienzo.width = Math.round(vista.width);
                lienzo.height = Math.round(vista.height);

                await pagina.render({ canvas: lienzo, viewport: vista }).promise;

                graficos.push({
                  cid: `rival-doc-${graficos.length + 1}`,
                  titulo: pdf.numPages > 1 ? `${doc.nombre} · ${n}/${pdf.numPages}` : doc.nombre,
                  area: "rival",
                  leyenda:
                    n === paginas && pdf.numPages > paginas
                      ? `${doc.nombre}: aquí sólo las ${paginas} primeras páginas; el PDF entero está en el enlace de arriba.`
                      : `${doc.ambito === "area" ? "Área del Rival" : "ABP del Rival"} · ${equipo}, ${jornada}.`,
                  imagen: lienzo.toDataURL("image/jpeg", 0.75),
                  ancho: 760,
                });
              }
            } catch {
              /* Un PDF que no se deja leer no tumba el informe: queda el enlace. */
            }
          }
        } catch {
          /* Sin pdf.js, quedan los enlaces. */
        }
      }

      const conclusiones = secciones
        .map((s) => ({ seccion: s.titulo, texto: trabajo.notas?.[s.id]?.trim() ?? "" }))
        .filter((una) => una.texto);

      return {
        graficos,
        rivalAnalisis: {
          equipo,
          jornada,
          conclusiones,
          documentos: documentos.map((d) => ({ nombre: d.nombre, url: d.url })),
        },
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
