/**
 * LO QUE CABE EN UN CORREO, IGUAL EN EL NAVEGADOR Y EN EL SERVIDOR (04/10/2026).
 *
 * El navegador decide qué va adjunto y qué sólo como enlace; el servidor se
 * trae lo adjunto y lo mete en el correo. Cada uno tenía su tope —16 MB uno,
 * 18 MB el otro— y el navegador contaba 6 MB por cada documento del rival que
 * no decía cuánto pesaba: con uno de 14 MB de verdad, el navegador lo daba por
 * bueno, el servidor pasaba de su tope y el correo completo **no salía**. Ahora
 * el número es uno y vive aquí, sin nada de servidor, para que lo lean los dos.
 *
 * Se puede usar en el navegador.
 */

/**
 * Lo que va adjunto, entre todos los archivos, en UN correo.
 *
 * Gmail manda hasta 35 MB por mensaje ya codificado (la base64 engorda un
 * tercio) y muchos buzones de club (Exchange) no reciben más de 25 MB: con
 * 16 MB de adjuntos y las imágenes del cuerpo, el correo entero queda en ~25 MB.
 */
export const TOPE_ADJUNTOS_CORREO = 16 * 1024 * 1024;

/**
 * Lo que admite la petición a `/api/informe/correo`.
 *
 * Pasa por una función de Vercel, que corta hacia los 4,5 MB: lo que vaya
 * dentro (HTML, imágenes del cuerpo, adjuntos pequeños) tiene que quedarse por
 * debajo con margen. Lo grande sube antes a Supabase y viaja por URL.
 */
export const TOPE_PETICION_CORREO = 4 * 1024 * 1024;
