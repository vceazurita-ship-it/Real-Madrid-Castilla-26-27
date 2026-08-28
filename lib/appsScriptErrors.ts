/**
 * Traducir los errores que devuelve el Apps Script de la hoja.
 *
 * Cuando algo se rompe dentro del script, lo que llega a la pantalla es el
 * mensaje de JavaScript tal cual —«ReferenceError: datos is not defined»—, y
 * eso no le dice nada a quien está rellenando una ficha: parece que la app ha
 * fallado cuando lo que hay que tocar está en la hoja.
 *
 * El 28/08/2026 ese error concreto tuvo parado **todo** lo que escribe en la
 * hoja —fichas de rival, alertas, altas de jugador—, porque el enganche de las
 * alertas se pegó en el `doPost` a la manera antigua y ese `doPost` no tiene
 * ninguna variable llamada `datos`. Un mensaje que dijera qué línea cambiar
 * habría ahorrado el rato de buscarlo.
 */

/** Lo que se le enseña al usuario para un error que viene de la hoja. */
export function explicaErrorScript(bruto: unknown): string {
  const mensaje = String(
    (bruto instanceof Error ? bruto.message : bruto) ?? "",
  ).trim();

  if (/datos is not defined/i.test(mensaje)) {
    return (
      "El Apps Script de la hoja está roto: su `doPost` usa una variable " +
      "`datos` que no existe, así que no se puede guardar nada. En el editor " +
      "de la hoja, cambia las dos líneas del enganche de las alertas por " +
      "`const deAlertas = manejaAlertas(e); if (deAlertas) return deAlertas;` " +
      "y vuelve a publicar (Implementar ▸ Gestionar implementaciones ▸ Nueva " +
      "versión). Los pasos están en scripts/apps-script/README.md."
    );
  }

  if (/is not defined|is not a function|SyntaxError|TypeError/i.test(mensaje)) {
    return `El Apps Script de la hoja ha fallado: ${mensaje}. Revísalo en el editor de la hoja; la app no puede arreglarlo desde aquí.`;
  }

  if (/authorization|permission|autoriza/i.test(mensaje)) {
    return (
      "La hoja ha pedido permisos que nadie ha aceptado todavía: abre el " +
      "editor de Apps Script, ejecuta cualquier función una vez y acepta lo " +
      "que pida."
    );
  }

  return mensaje || "No se pudo guardar";
}
