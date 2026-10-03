/**
 * MANDAR EL INFORME DE ABP DEL MICROCICLO.
 *
 * El informe **se arma en el navegador**, no aquí: la pantalla del microciclo
 * ya tiene cargados el plan, la hoja de registro, las hojas de competición y el
 * seguimiento. Aquí llega el correo ya escrito y se manda con la cuenta de
 * Google del club.
 *
 * Desde el 03/10/2026 es lo mismo que `/api/informe/correo` (se queda esta
 * dirección para no romper nada): validación común y **sólo con sesión** del
 * cuerpo técnico o de administrador —antes mandaba sin pedir nada—.
 */

export { POST } from "@/app/api/informe/correo/route";

export const dynamic = "force-dynamic";

export const maxDuration = 60;
