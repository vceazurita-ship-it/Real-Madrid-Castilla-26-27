/**
 * Formato de cifras del área de jugadores: siempre con coma decimal
 * (7,4 · 18,3 · 32,1 %), como /ratings. Un único sitio para no mezclar
 * punto y coma entre pantallas.
 */
export function coma(valor: number, decimales = 1): string {
  if (!Number.isFinite(valor)) return "";
  return valor.toFixed(decimales).replace(".", ",");
}

/** Como `coma`, pero sin ceros sobrantes: 8 → «8», 7,5 → «7,5». */
export function comaCorta(valor: number, decimales = 1): string {
  if (!Number.isFinite(valor)) return "";
  const t = coma(valor, decimales);
  return t.includes(",") ? t.replace(/0+$/, "").replace(/,$/, "") : t;
}
