/**
 * El repositorio de Identidad y Cultura.
 *
 * Es la lista, y sólo la lista: los documentos viven cada uno en su fichero
 * dentro de `documentos/`. Para publicar el siguiente basta con escribir su
 * contenido y añadirlo aquí, en el orden en que se presenta a la plantilla.
 *
 * El orden de este array es el del repositorio en pantalla y el de los números
 * de fichero: si un documento se coloca en medio, se renumera a mano, porque
 * el número forma parte del nombre con el que circula por el vestuario
 * («01. RMCF - Castilla Valores»).
 */

import { DOCUMENTO_VALORES } from "@/lib/cultura/documentos/valores";
import type { DocumentoCultura } from "@/lib/cultura/modelo";

export const DOCUMENTOS_CULTURA: DocumentoCultura[] = [DOCUMENTO_VALORES];

export function documentoCultura(id: string): DocumentoCultura | undefined {
  return DOCUMENTOS_CULTURA.find((documento) => documento.id === id);
}
