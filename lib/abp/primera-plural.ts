/**
 * La lectura de la liga dicha de nosotros, en primera del plural (21/10/2026).
 *
 * `construyeRivalAbp` escribe en tercera («concede 4,5 córners… y deja
 * rematar el 14 %») porque lo pensó para el rival; puesta detrás de
 * «Nosotros en la liga:» quedaba «Nosotros… concede». Sólo se conjugan los
 * verbos que escribe esa función.
 */
export function enPrimeraPlural(texto: string, equipo: string) {
  const sinEquipo = equipo && texto.startsWith(`${equipo} `) ? texto.slice(equipo.length + 1) : texto;

  return sinEquipo
    .replace(/\bconcede\b/g, "concedemos")
    .replace(/\bdeja rematar\b/g, "dejamos rematar")
    .replace(/\bcomete\b/g, "cometemos")
    .replace(/\bsaca\b/g, "sacamos")
    .replace(/\blanza\b/g, "lanzamos")
    .replace(/\bremata el\b/g, "rematamos el")
    .replace(/\ble han hecho\b/g, "nos han hecho");
}

/**
 * Un aspecto metido en medio de una frase: minúscula sólo la primera letra,
 * para que «Saque de banda Z2» quede «saque de banda Z2» y no «z2».
 */
export function enFrase(texto: string) {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}
