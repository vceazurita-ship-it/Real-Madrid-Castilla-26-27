/**
 * UNA SOLA GRAFÍA PARA CADA JUGADOR EN PANTALLA (24/10/2026).
 *
 * La hoja JUGADORES escribe «Óscar Nassei» y «Hugo de LLanos»; el club, la foto
 * y el recorte dicen «Óscar Naasei» y «Hugo de Llanos». Mientras la hoja no se
 * corrija, aquí se unifica LO QUE SE PINTA.
 *
 * Es sólo para MOSTRAR. Para cruzar datos entre fuentes se sigue usando el
 * nombre tal como viene (`lib/playerMatcher.ts`, `lib/dorsales.ts`): cambiarlo
 * antes de cruzar rompería el cruce con Wyscout.
 */

const CLAVE = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const GRAFIAS: Record<string, string> = {
  [CLAVE("Óscar Nassei")]: "Óscar Naasei",
  [CLAVE("Oscar Nassei")]: "Óscar Naasei",
  [CLAVE("Oscar Naasei")]: "Óscar Naasei",
  [CLAVE("Hugo de LLanos")]: "Hugo de Llanos",
  /* Los apodos con que la hoja y las fichas llaman a quien tiene nombre
     completo (26/10/2026): el cuerpo técnico no debe dudar si es la misma persona. */
  [CLAVE("Thiago")]: "Thiago Pitarch",
  [CLAVE("Izan")]: "Izan Regueira",
  [CLAVE("Carvajal")]: "Ángel Carvajal",
  [CLAVE("Ciria")]: "Alexis Ciria",
  [CLAVE("Melvin")]: "Melvin Ukpeigbe",
};

/** El nombre con el que se pinta a un jugador; el que no está en la tabla se queda como viene. */
export function nombreVisible(nombre: string): string {
  return GRAFIAS[CLAVE(nombre)] ?? nombre;
}
