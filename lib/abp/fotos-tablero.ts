/**
 * Las fotos de las diapositivas para el PDF general y el PowerPoint, con lo ya
 * hecho guardado (01/11/2026). Lo comparten «Exportar todo», «Solo
 * documentos», «PowerPoint» y «PDF»: una diapositiva que no ha cambiado sale
 * de la memoria y sólo se monta y se fotografía lo que falta. Ver
 * `lib/abp/cache-exportar.ts`.
 */

import { COLORES, TABLERO_H, TABLERO_W } from "@/lib/abp/pizarra";
import { fotoGuardada, fuentesDe, guardaFoto } from "@/lib/abp/cache-exportar";
import { fuentesIncrustadas } from "@/lib/export/captura";
import { capturaLienzos, esperaFotos } from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

/** Las claves que aún no tienen foto: son las únicas que hay que montar. */
export const faltanFotos = (claves: string[]) => [...new Set(claves.filter((clave) => !fotoGuardada(clave)))];

/**
 * Fotografía lo montado en `raiz` (una diapositiva por cada clave de `montadas`,
 * en el mismo orden) y devuelve la foto de cada una de `claves`.
 */
export async function fotosDeHojas({
  raiz,
  claves,
  montadas,
  alPaso,
}: {
  raiz: HTMLElement | null;
  claves: string[];
  montadas: string[];
  alPaso?: (hechas: number, total: number) => void;
}) {
  const nuevas = new Map<string, string>();

  if (montadas.length) {
    if (!raiz) throw new Error("sin tablero");

    await esperaFuentePortada();
    await esperaFotos(raiz);

    const fontEmbedCSS = await fuentesDe(raiz, () => fuentesIncrustadas(raiz, {}));
    const imagenes = await capturaLienzos(raiz, "[data-abp-tablero]", {
      ancho: TABLERO_W,
      alto: TABLERO_H,
      fondo: COLORES.tinta,
      fontEmbedCSS,
      alPaso,
    });

    montadas.forEach((clave, i) => {
      if (!imagenes[i]) return;

      nuevas.set(clave, imagenes[i]);
      guardaFoto(clave, imagenes[i]);
    });
  }

  return claves.map((clave) => {
    const foto = nuevas.get(clave) ?? fotoGuardada(clave);

    if (!foto) throw new Error("Falta la foto de una diapositiva");

    return foto;
  });
}
