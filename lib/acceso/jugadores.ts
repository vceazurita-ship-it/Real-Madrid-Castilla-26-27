/**
 * LAS CUENTAS DE LOS JUGADORES (19/11/2026). Sin imports: la usan el servidor
 * (/api/acceso) y Ajustes → Acceso, que enseña la tabla al cuerpo técnico.
 *
 * Petición del analista: «cada jugador tiene que tener como usuario su nombre
 * y primer apellido y contraseña nombre123». Usuario «Pol Fortuny»,
 * contraseña «pol123». Da igual mayúsculas, tildes y espacios de más.
 * 19/11/2026: los usuarios se escriben SIN tildes (petición del analista);
 * quien escriba la tilde entra igual.
 *
 * El nombre completo sale de BeSoccer (`castilla:besoccer`), porque la hoja
 * JUGADORES escribe a muchos por el apellido o el apodo («Fortea»,
 * «M. Rezola»). `otros`: otras maneras de escribirlo que también valen (la
 * contraseña es entonces el nombre de esa manera: «Javier Navarro» →
 * «javier123»). Fuera, los que la plantilla esconde (lib/hiddenPlayers.ts).
 *
 * Un fichaje nuevo: una línea aquí.
 */

export type CuentaJugador = { id: string; usuario: string; otros?: string[] };

export const CUENTAS_JUGADORES: CuentaJugador[] = [
  { id: "JUG-01", usuario: "Jesus Fortea" },
  { id: "JUG-02", usuario: "Melvin Ukpeigbe" },
  { id: "JUG-04", usuario: "Diego Aguado" },
  { id: "JUG-06", usuario: "Alvaro Lezcano" },
  { id: "JUG-07", usuario: "Joan Martinez" },
  { id: "JUG-08", usuario: "Mario Rivas" },
  { id: "JUG-09", usuario: "Lamini Fati" },
  { id: "JUG-10", usuario: "Ariel Ncoghe" },
  { id: "JUG-11", usuario: "Jorge Cestero" },
  { id: "JUG-13", usuario: "Diego Lacosta" },
  { id: "JUG-14", usuario: "Manex Rezola" },
  { id: "JUG-15", usuario: "Roberto Martin" },
  { id: "JUG-16", usuario: "Pol Fortuny" },
  { id: "JUG-17", usuario: "Dani Mesonero", otros: ["Daniel Mesonero"] },
  { id: "JUG-18", usuario: "Daniel Yanez", otros: ["Dani Yanez"] },
  { id: "JUG-19", usuario: "Alexis Ciria" },
  { id: "JUG-20", usuario: "Alvaro Leiva" },
  { id: "JUG-22", usuario: "Rachad Fettal" },
  { id: "JUG-23", usuario: "Sergio Mestre" },
  { id: "JUG-24", usuario: "Javi Navarro", otros: ["Javier Navarro"] },
  { id: "JUG-25", usuario: "Ferran Quetglas" },
  { id: "JUG-26", usuario: "Angel Carvajal" },
  { id: "JUG-28", usuario: "Jaime Barroso" },
  { id: "JUG-31", usuario: "Alvaro Gines" },
  { id: "JUG-32", usuario: "Carlos Diez" },
  { id: "JUG-33", usuario: "Gabriel Castrelo" },
  { id: "JUG-35", usuario: "Diego Martinez", otros: ["Beto Martinez"] },
  { id: "JUG-37", usuario: "Javier Bailon" },
  { id: "JUG-39", usuario: "Liberto Navascues" },
  { id: "JUG-40", usuario: "Aimar Gar" },
  { id: "JUG-43", usuario: "Illia Voloshyn" },
  { id: "JUG-44", usuario: "Alvaro Gonzalez" },
  { id: "JUG-45", usuario: "Alfredo Sotres" },
  { id: "JUG-46", usuario: "Izan Regueira" },
  { id: "JUG-47", usuario: "Cherif Fofana", otros: ["Cherif Acacio"] },
  { id: "JUG-48", usuario: "Gabriel Valero", otros: ["Gabri Valero"] },
  { id: "JUG-49", usuario: "Oscar Naasei", otros: ["Oscar Nassei"] },
  { id: "JUG-50", usuario: "Sergio Martinez" },
  { id: "JUG-51", usuario: "Thiago Pitarch" },
  { id: "JUG-52", usuario: "Hugo de Llanos" },
];

/** «  Álvaro  LEIVA » → «alvaro leiva». */
export const normaliza = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** La contraseña de una manera de escribir el usuario: su nombre + 123. */
export const contrasenaDe = (usuario: string) => `${normaliza(usuario).split(" ")[0]}123`;

/** La cuenta si usuario y contraseña casan; si no, null. */
export function cuentaDe(usuario: string, contrasena: string): CuentaJugador | null {
  const u = normaliza(usuario);
  const c = normaliza(contrasena).replace(/ /g, "");
  if (!u || !c) return null;
  for (const cuenta of CUENTAS_JUGADORES) {
    for (const forma of [cuenta.usuario, ...(cuenta.otros ?? [])]) {
      if (normaliza(forma) === u && contrasenaDe(forma) === c) return cuenta;
    }
  }
  return null;
}

/** Para no dejar poner como código del staff una contraseña de jugador. */
export const esContrasenaDeJugador = (codigo: string) =>
  CUENTAS_JUGADORES.some((cuenta) => [cuenta.usuario, ...(cuenta.otros ?? [])].some((f) => contrasenaDe(f) === normaliza(codigo).replace(/ /g, "")));
