/**
 * El repositorio guardado: los documentos que se suben desde la app.
 *
 * `repositorio.ts` tiene los documentos que viven en el código —los que el
 * cuerpo técnico no puede romper sin querer—, y esto es la otra mitad: lo que
 * se sube desde la pantalla de Dinámicas y Valores queda en Supabase, en la
 * tabla `app_documents`, bajo una única clave.
 *
 * Todo el repositorio guardado va en **una sola fila**, no una por documento.
 * Son unos pocos documentos por temporada y siempre se leen juntos —la
 * estantería se pinta entera—, así que una fila evita un viaje por documento y
 * deja el orden en un solo sitio.
 */

import { DOCUMENTOS_CULTURA } from "@/lib/cultura/repositorio";
import type { DocumentoCultura } from "@/lib/cultura/modelo";

/** La clave de `app_documents`. Va con el patrón que acepta `/api/docs`. */
export const CLAVE_CULTURA = "cultura:documentos";

export const TIPO_CULTURA = "cultura";

export type RepositorioGuardado = {
  documentos: DocumentoCultura[];
};

export const REPOSITORIO_VACIO: RepositorioGuardado = { documentos: [] };

/**
 * La estantería completa: lo publicado en el código y lo subido después.
 *
 * Si un documento subido repite el `id` de uno del código, **manda el subido**:
 * es la forma de corregir un documento publicado sin tocar el repositorio, y
 * al borrarlo vuelve a salir el original.
 */
export function repositorioCompleto(
  guardado: RepositorioGuardado | null | undefined,
): DocumentoCultura[] {
  const subidos = guardado?.documentos ?? [];

  const porId = new Map(DOCUMENTOS_CULTURA.map((doc) => [doc.id, doc]));

  for (const doc of subidos) porId.set(doc.id, doc);

  return [...porId.values()].sort((a, b) =>
    a.numero.localeCompare(b.numero, "es", { numeric: true }),
  );
}

/** ¿Este documento se puede borrar? Sólo los subidos; el código no se toca. */
export function esSubido(
  documento: DocumentoCultura,
  guardado: RepositorioGuardado | null | undefined,
) {
  return (guardado?.documentos ?? []).some((doc) => doc.id === documento.id);
}

/** El número que le toca al siguiente documento: «03». */
export function siguienteNumero(documentos: DocumentoCultura[]) {
  const mayor = documentos.reduce((tope, doc) => {
    const numero = Number.parseInt(doc.numero, 10);

    return Number.isFinite(numero) && numero > tope ? numero : tope;
  }, 0);

  return String(mayor + 1).padStart(2, "0");
}

/**
 * Un identificador estable a partir del título.
 *
 * Lleva el número delante porque el id ordena y porque dos documentos pueden
 * llamarse parecido —«valores» y «valores de la cantera»— y sus apodos
 * chocarían.
 */
export function idDocumento(numero: string, titulo: string) {
  const apodo =
    titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "documento";

  return `${numero}-${apodo}`;
}
