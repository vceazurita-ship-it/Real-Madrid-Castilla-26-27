/**
 * LOS DOCUMENTOS QUE SE SACAN DEL RIVAL, GUARDADOS (03/10/2026).
 *
 * El PDF de la plantilla (once probable) y el PPT del informe del rival se
 * sacan en Plantillas rivales y se descargaban sin más: para que el informe
 * del partido los llevara adjuntos había que volver a subirlos a mano.
 *
 * Ahora, al sacarlos, se guarda también **el último de cada tipo** por equipo:
 * el archivo en Supabase (`2026/rivales-docs/<equipo>/`, directo desde el
 * navegador, sin pasar por Vercel) y la ficha en `app_documents` bajo
 * `rival-documentos:<equipo>`. El informe del partido lo lee y lo marca para
 * adjuntar. El anterior del mismo tipo se borra: sólo vale el último.
 *
 * Hace falta la sesión del cuerpo técnico (la de la quiniela); sin ella la
 * descarga sale igual y sólo se avisa de que no se ha guardado.
 *
 * Se usa en el navegador.
 */

import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import { slugClave } from "@/lib/rivals/media";

export type TipoDocumentoRival = "plantilla-pdf" | "informe-pptx";

export type DocumentoGuardado = {
  tipo: TipoDocumentoRival;
  nombre: string;
  url: string;
  path: string;
  mime: string;
  tamano: number;
  /** ISO de cuándo se sacó. */
  creado: string;
};

export type DocumentosRival = { docs: DocumentoGuardado[] };

export const ROTULO_DOCUMENTO: Record<TipoDocumentoRival, string> = {
  "plantilla-pdf": "Plantilla y once probable (PDF)",
  "informe-pptx": "Informe del rival (PPT)",
};

/** Un documento por equipo: la clave sale del nombre de la plantilla. */
export const rivalDocumentosKey = (equipo: unknown) => `rival-documentos:${slugClave(equipo)}`;

export function normalizaDocumentos(valor: unknown): DocumentosRival {
  const docs = (valor as Partial<DocumentosRival> | null)?.docs;

  return {
    docs: Array.isArray(docs)
      ? docs.filter((d): d is DocumentoGuardado => Boolean(d && typeof d.url === "string" && typeof d.tipo === "string"))
      : [],
  };
}

const MIME: Record<TipoDocumentoRival, string> = {
  "plantilla-pdf": "application/pdf",
  "informe-pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/**
 * Guarda el documento recién sacado como el último de su tipo. Devuelve si se
 * ha guardado y, si no, por qué (para avisar sin estorbar la descarga).
 */
export async function guardaDocumentoRival(
  equipo: string,
  tipo: TipoDocumentoRival,
  blob: Blob,
  nombre: string,
): Promise<{ ok: true; doc: DocumentoGuardado } | { ok: false; motivo: string }> {
  try {
    const subido = await subeAdjunto(new File([blob], nombre, { type: MIME[tipo] }), undefined, { carpeta: "rival", equipo });

    const key = rivalDocumentosKey(equipo);

    /* Leer, sustituir el de ese tipo y escribir sobre la versión leída: si
       otro ha guardado en medio (409), se repite una vez con lo nuevo. */
    let viejo: DocumentoGuardado | undefined;

    for (let intento = 0; intento < 2; intento++) {
      const leido = (await fetch(`/api/docs?key=${encodeURIComponent(key)}`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null)) as { data?: unknown; updatedAt?: string | null } | null;

      const actual = normalizaDocumentos(leido?.data);

      viejo = actual.docs.find((d) => d.tipo === tipo);

      const nuevo: DocumentoGuardado = {
        tipo,
        nombre,
        url: subido.url,
        path: subido.path,
        mime: MIME[tipo],
        tamano: blob.size,
        creado: new Date().toISOString(),
      };

      const r = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          kind: "rival-documentos",
          data: { docs: [...actual.docs.filter((d) => d.tipo !== tipo), nuevo] },
          basadaEn: leido?.updatedAt ?? null,
        }),
      });

      if (r.status === 409) continue;

      const j = (await r.json().catch(() => null)) as { success?: boolean; error?: string } | null;

      if (!r.ok || !j?.success) return { ok: false, motivo: j?.error ?? "No se ha podido guardar la ficha del documento." };

      /* El anterior ya no lo apunta nadie. */
      if (viejo?.path && viejo.path !== subido.path) {
        void fetch("/api/informe/subida", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: viejo.path }),
        }).catch(() => undefined);
      }

      return { ok: true, doc: nuevo };
    }

    return { ok: false, motivo: "Alguien estaba guardando a la vez; vuelve a sacarlo." };
  } catch (error) {
    return { ok: false, motivo: error instanceof Error ? error.message : "No se ha podido guardar." };
  }
}
