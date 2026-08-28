/**
 * `ffprobe-static` no trae tipos.
 *
 * Sólo se usa una cosa de él —la ruta del binario—, así que se declara aquí en
 * vez de añadir una dependencia de tipos más al proyecto.
 */
declare module "ffprobe-static" {
  const ffprobe: { path: string };

  export default ffprobe;
}
