/**
 * El enlace a /analisis-goles con un equipo y «En el campo» ya puestos
 * (16/11/2026, goles del rival en vídeo). `lado=contra` abre en los que encaja.
 * Aparte del componente para que el Plan de partido no se lleve el reproductor.
 */
export type LadoGoles = "favor" | "contra";

export function urlGolesDelEquipo(equipo: string, lado: LadoGoles = "favor") {
  const q = new URLSearchParams({ vista: "campo", equipo });

  if (lado === "contra") q.set("lado", "contra");

  return `/analisis-goles?${q.toString()}`;
}
