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

/** Una ficha de la plantilla del rival: el nombre como sale en Plantillas y su dorsal. */
export type FichaNombre = { nombre: string; dorsal?: string };

/** Cuántas letras cambian entre dos palabras del mismo largo (Hidalgo ↔ Fidalgo = 1). */
function cambios(a: string, b: string) {
  if (a.length !== b.length) return Infinity;

  let n = 0;

  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;

  return n;
}

/**
 * El texto del analista con los nombres de la ficha (07/11/2026, jueces).
 *
 * El analista escribe de memoria y la plantilla dice otra cosa: «Hidalgo» es
 * FIDALGO, «Victor Narro» es Víctor Narro, «Mehdi Puch» es MEHDI y «23. Javi
 * J.» es el 23, Javi Jiménez. Se corrige sólo lo que no deja dudas:
 * - un dorsal con un nombre abreviado que casa con el de ese dorsal → «23 · Javi Jiménez»;
 * - el mismo nombre con otras tildes → el de la ficha;
 * - una palabra de 6 letras o más a una letra de un nombre único de la
 *   plantilla, y que no es de nadie más → el de la ficha;
 * - el nombre de una sola palabra seguido de un apellido que no es de nadie
 *   de la plantilla → el de la ficha a secas.
 */
export function conNombresDeLaPlantilla(texto: string, fichas: FichaNombre[]): string {
  if (!texto || fichas.length === 0) return texto;

  const conNombre = fichas.filter((f) => f.nombre.trim());
  const palabrasFicha = new Map<string, string>();

  for (const f of conNombre) {
    for (const p of f.nombre.trim().split(/\s+/)) {
      const limpia = p.replace(/\.$/, "");

      if (limpia.length >= 2) palabrasFicha.set(clave(limpia), limpia);
    }
  }

  let salida = texto;

  /* 1. «23. Javi J.» o «23 Javi J.» → «23 · Javi Jiménez». */
  salida = salida.replace(
    /(?<![\p{L}\p{N}])(\d{1,2})\s*[.·-]?\s+(\p{Lu}\p{L}*\.?(?:\s+\p{Lu}\p{L}*\.?)?)/gu,
    (todo: string, dorsal: string, escrito: string) => {
      const ficha = conNombre.find((f) => String(f.dorsal ?? "").trim() === dorsal);

      if (!ficha) return todo;

      const deFicha = ficha.nombre.trim().split(/\s+/).map((p) => clave(p));
      const suyas = escrito.trim().split(/\s+/).map((p) => clave(p.replace(/\.$/, "")));
      const casa = suyas.length <= deFicha.length && suyas.every((p, i) => p.length > 0 && deFicha[i].startsWith(p));

      /* El punto de «J.» es de la abreviatura: no se repone. */
      return casa ? `${dorsal} · ${ficha.nombre.trim()}` : todo;
    },
  );

  /* 2 y 4. Nombres de la ficha escritos con otras tildes, o con un apellido que la ficha no lleva. */
  for (const f of conNombre) {
    const partes = f.nombre.trim().split(/\s+/);
    const patron = partes.map((p) => `(${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\p{L}/gu, (l) => `[${l}${clave(l)}${clave(l).toUpperCase()}${l.toUpperCase()}${l.toLowerCase()}]`)})`).join("\\s+");
    const sueltoApellido = partes.length === 1 ? "(\\s+\\p{Lu}\\p{L}+)?" : "";
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${patron}${sueltoApellido}(?![\\p{L}\\p{N}])`, "gu");

    salida = salida.replace(re, (...args: unknown[]) => {
      const todo = String(args[0]);
      const apellido = partes.length === 1 ? (args[2] as string | undefined) : undefined;

      if (apellido && !palabrasFicha.has(clave(apellido.trim()))) return f.nombre.trim();
      if (apellido) return todo;

      return todo === f.nombre.trim() ? todo : clave(todo) === clave(f.nombre.trim()) ? f.nombre.trim() : todo;
    });
  }

  /* 3. «Hidalgo» → «Fidalgo»: a una letra de un único nombre de la plantilla. */
  const candidatas = [...palabrasFicha.values()].filter((p) => p.length >= 6);

  salida = salida.replace(/(?<![\p{L}\p{N}])(\p{Lu}\p{L}{5,})(?![\p{L}\p{N}])/gu, (palabra: string) => {
    const k = clave(palabra);

    if (palabrasFicha.has(k)) return palabra;

    const cerca = candidatas.filter((c) => cambios(clave(c), k) === 1);

    return cerca.length === 1 ? cerca[0] : palabra;
  });

  return salida;
}
