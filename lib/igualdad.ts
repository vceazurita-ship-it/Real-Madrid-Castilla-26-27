/**
 * ¿Dos documentos dicen lo mismo? (06/10/2026)
 *
 * Comparación profunda que NO depende del orden de las claves: Supabase guarda
 * los documentos como `jsonb`, que reordena las claves de cada objeto, así que
 * el JSON que vuelve del servidor no es texto-igual al que se mandó aunque sea
 * el mismo documento. Las listas sí respetan el orden (el orden de una lista
 * es dato).
 */
export function mismoDocumento(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    /* `undefined` dentro de un objeto no viaja en JSON: se trata como ausente. */
    return a === b;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => mismoDocumento(x, b[i]));
  }
  const oa = a as Record<string, unknown>;
  const ob = b as Record<string, unknown>;
  const claves = (o: Record<string, unknown>) => Object.keys(o).filter((k) => o[k] !== undefined);
  const ka = claves(oa);
  const kb = claves(ob);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(ob, k) && mismoDocumento(oa[k], ob[k]));
}
