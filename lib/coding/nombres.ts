/**
 * El nombre de un fichero de vídeo, legible (08/11/2026).
 *
 * Una sola limpieza para los chips de la pantalla, la tabla de cortes y los
 * rótulos: antes la tabla decía «4-Anto n Centro» y el chip «4-Antón Centro»
 * para el mismo vídeo.
 *
 * - NFC: en macOS las tildes llegan separadas de la letra («Anto´n»).
 * - Sin extensión y sin guiones bajos.
 * - Las tildes que la descarga cambió por «_» o por un espacio
 *   («Duelos_a_reos» → «Duelos aéreos», «Anto_n» → «Antón»).
 */
export function nombreVideo(nombre: string) {
  return nombre
    .normalize("NFC")
    .replace(/\.(mp4|mov|m4v|mkv|webm|avi|mts)$/i, "")
    .replace(/_/g, " ")
    .replace(/\ba reos\b/gi, "aéreos")
    .replace(/\bAnto n\b/g, "Antón")
    .replace(/\s+/g, " ")
    .trim();
}
