/**
 * LO QUE ESCRIBE EL ANALISTA, LISTO PARA LEER (10/11/2026, jueces).
 *
 * Dos cosas que usaban dos pantallas cada una a su manera:
 *
 * (Las erratas viven en `lib/rivals/erratas.ts`.)
 *
 * 1. **Sus centrales.** El analista escribe «Van Rijn + Royo / Fran Gil»: los
 *    de más capacidad con balón, una barra, los de menos. `/rivals` y Scout
 *    Colectivo lo leen con la misma función, para no mandar a presionar a uno
 *    en una pantalla y al otro en la otra.
 * 2. **Ausentes.** Una referencia marcada «(ausente)» o de baja en Plantillas
 *    no sirve para preparar el partido.
 */

/** Sin tildes ni mayúsculas, para comparar. */
const plano = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export type CentralesDelAnalista = { mas: string[]; menos: string[] };

/**
 * «Nico Van Rijn + Manel Royo / Fran Gil» → `{ mas: [Van Rijn, Royo], menos: [Fran Gil] }`.
 * Sin la barra, `null`: no se adivina cuál es cuál.
 */
export function centralesDelAnalista(texto: string): CentralesDelAnalista | null {
  const linea = texto.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const lados = linea.split(/\s*\/\s*/).map((t) => t.trim()).filter(Boolean);

  if (lados.length !== 2) return null;

  const nombres = (t: string) =>
    t
      .split(/\s*(?:\+|,|&|\by\b)\s*/)
      .map((n) => n.replace(/^\d+\s*[.·-]?\s*/, "").replace(/[.;]+$/, "").trim())
      .filter(Boolean);

  const mas = nombres(lados[0]);
  const menos = nombres(lados[1]);

  return mas.length && menos.length ? { mas, menos } : null;
}

/** El último apellido, para casar «Van Rijn» con «Nico Van Rijn». */
const apellido = (t: string) => plano(t).replace(/[^a-z\s]/g, " ").trim().split(/\s+/).pop() ?? "";

/** ¿El nombre es uno de la lista? Por el apellido (de tres letras o más). */
export function estaEn(nombre: string, lista: string[]) {
  const suyo = plano(nombre);

  return lista.some((n) => {
    const a = apellido(n);

    return a.length >= 3 && new RegExp(`(^|\\s)${a}(\\s|$)`).test(suyo.replace(/[^a-z\s]/g, " "));
  });
}

const y = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : (xs[0] ?? ""));

/** «El central de menor capacidad con balón es Fran Gil (los de más, Nico Van Rijn y Manel Royo).» */
export function fraseCentrales(c: CentralesDelAnalista) {
  const menor = c.menos.length > 1 ? `Los centrales de menor capacidad con balón son ${y(c.menos)}` : `El central de menor capacidad con balón es ${c.menos[0]}`;
  const mayor = c.mas.length > 1 ? `los de más, ${y(c.mas)}` : `el de más, ${c.mas[0]}`;

  return `${menor} (${mayor}).`;
}

/*
| Una referencia que no va a jugar (10/11/2026, jueces): «Meshak (ausente)».
| Se quita del texto que se lee; si no queda nada, el campo no se pinta.
*/
const MARCA_AUSENTE = /\((?:ausente|baja|lesionad[oa]|sancionad[oa]|no disponible|no juega)\)/i;

export function sinAusentes(texto: string, deBaja: (nombre: string) => boolean = () => false) {
  return texto
    .split(/\r?\n/)
    .map((linea) =>
      linea
        .split(/\s*(?:,|;|\s\+\s|\s-\s)\s*/)
        .filter((trozo) => trozo.trim() && !MARCA_AUSENTE.test(trozo) && !deBaja(trozo))
        .join(", "),
    )
    .filter((linea) => linea.trim())
    .join("\n");
}
