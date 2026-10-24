/**
 * Nombres completos en un texto escrito a mano (24/10/2026).
 *
 * El analista escribe «Ángel, Aleix, Paris» o «Oscar» y quien lee no sabe de
 * quién se habla. Con la plantilla del rival delante, un nombre de pila suelto
 * se completa con el apellido **sólo si en esa plantilla es único** y no lleva
 * ya el apellido detrás. Lo ambiguo se deja como está: mejor un nombre corto
 * que uno equivocado.
 */

const clave = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function completaNombres(texto: string, nombres: string[]): string {
  if (!texto || nombres.length === 0) return texto;

  const porPila = new Map<string, Set<string>>();

  for (const nombre of nombres) {
    const partes = nombre.trim().split(/\s+/);

    /* «J. Martínez» no tiene nombre de pila que completar. */
    if (partes.length < 2 || partes[0].length < 3 || partes[0].endsWith(".")) continue;

    const k = clave(partes[0]);

    if (!porPila.has(k)) porPila.set(k, new Set());
    porPila.get(k)!.add(nombre.trim());
  }

  return texto.replace(
    /(?<![\p{L}\p{N}])(\p{Lu}\p{L}{2,})(?![\p{L}\p{N}])(\s+\p{Lu}\p{L}+)?/gu,
    (todo: string, pila: string, detras?: string) => {
      if (detras) return todo;

      const candidatos = porPila.get(clave(pila));

      if (!candidatos || candidatos.size !== 1) return todo;

      const completo = [...candidatos][0];

      /* Si el apellido ya sale en el texto («Iván y Trujillo»), no se duplica. */
      return clave(texto).includes(clave(completo.split(/\s+/).slice(1).join(" "))) ? todo : completo;
    },
  );
}
