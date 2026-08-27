/*
|--------------------------------------------------------------------------
| LOS ICONOS DE LA APP INSTALADA
|--------------------------------------------------------------------------
|
| Genera los PNG del manifiesto a partir de `public/logo.png`, el mismo
| escudo que firma la barra superior, para que la app instalada se reconozca
| igual que la app abierta: fondo oscuro de la casa, escudo en blanco y el
| oro sólo como filo.
|
| Se hacen aquí y no a mano porque son cuatro tamaños con dos encuadres
| distintos, y porque el escudo se recorta a su tinta antes de encajarlo: el
| PNG original trae aire alrededor y, sin quitarlo, el escudo se ve pequeño y
| descentrado dentro del icono.
|
| Dos recortes, que es lo que pide cada sitio:
|
| - **`any`** — se ve tal cual: cuadrado con las esquinas redondeadas, que es
|   como lo pinta Windows en la barra de tareas y Chrome en el escritorio.
| - **`maskable`** — Android le pasa su propia máscara (círculo, gota,
|   cuadrado…) y se come hasta el 20% del borde, así que va a sangre y con el
|   escudo más pequeño: todo lo que importa cabe en el círculo interior.
|
| Uso: `node scripts/app-icons.mjs`
*/

import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLICO = path.join(RAIZ, "public");

/* Los colores de la app: el fondo de página y el del panel, y el oro. */
const FONDO = "#0B0F14";
const PANEL = "#141C26";
const ORO = "#C8A96B";

/* Se dibuja grande y se baja de tamaño: el escudo tiene filigrana —la corona,
   las letras entrelazadas— y reducir desde 1024 la conserva mucho mejor que
   pintarla directamente a 192. */
const LIENZO = 1024;

/**
 * El escudo, recortado a su tinta y metido en una caja cuadrada.
 *
 * `trim` quita el aire transparente del PNG original. Sin esto el escudo
 * ocupa dentro del icono bastante menos de lo que dice su medida, y encima
 * queda alto: la corona deja más margen arriba que la base abajo.
 *
 * La caja es cuadrada y el ajuste `inside` a propósito: recortado, el escudo
 * es más alto que ancho —la corona—, así que darle sólo el ancho lo dejaba
 * saliéndose por arriba y por abajo.
 */
async function escudo(caja) {
  const lado = Math.round(caja);

  return sharp(path.join(PUBLICO, "logo.png"))
    .trim()
    .resize({ width: lado, height: lado, fit: "inside" })
    .png()
    .toBuffer();
}

/**
 * El fondo del icono.
 *
 * Degradado de arriba abajo del color del panel al del fondo —el mismo salto
 * que tienen las tarjetas de la app— y un halo dorado muy tenue detrás del
 * escudo, que es lo que impide que el blanco quede plano sobre el negro.
 * `radio` a 0 lo deja a sangre, para el recorte de Android.
 */
function fondo(radio) {
  return Buffer.from(`
    <svg width="${LIENZO}" height="${LIENZO}" viewBox="0 0 ${LIENZO} ${LIENZO}"
         xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${PANEL}" />
          <stop offset="1" stop-color="${FONDO}" />
        </linearGradient>

        <radialGradient id="halo" cx="0.5" cy="0.46" r="0.5">
          <stop offset="0" stop-color="${ORO}" stop-opacity="0.20" />
          <stop offset="1" stop-color="${ORO}" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect width="${LIENZO}" height="${LIENZO}" rx="${radio}" ry="${radio}"
            fill="url(#cielo)" />

      <rect width="${LIENZO}" height="${LIENZO}" rx="${radio}" ry="${radio}"
            fill="url(#halo)" />

      ${
        radio
          ? /* El filo dorado sólo en el icono que se ve entero: en el
               recortable se lo comería la máscara y quedaría un arco suelto. */
            `<rect x="6" y="6" width="${LIENZO - 12}" height="${LIENZO - 12}"
                   rx="${radio - 6}" ry="${radio - 6}"
                   fill="none" stroke="${ORO}" stroke-opacity="0.35"
                   stroke-width="6" />`
          : ""
      }
    </svg>
  `);
}

/**
 * Un icono.
 *
 * `parte` es cuánto del lado ocupa el escudo por su medida más larga. En el
 * que se ve entero puede ir holgado; en el recortable se queda en el círculo
 * interior que Android garantiza (el 80% central), con margen para las
 * máscaras más agresivas.
 */
async function icono({ archivo, lado, radio, parte }) {
  const marca = await escudo(LIENZO * parte);
  const { width, height } = await sharp(marca).metadata();

  /* Dos pasadas y no una: sharp aplica el `resize` antes que el `composite`
     por muy detrás que se escriba, así que encadenarlos reduciría el fondo
     primero y luego intentaría pegarle encima un escudo más grande que él. */
  const grande = await sharp(fondo(radio))
    .composite([
      {
        input: marca,
        left: Math.round((LIENZO - width) / 2),
        top: Math.round((LIENZO - height) / 2),
      },
    ])
    .png()
    .toBuffer();

  const png = await sharp(grande)
    .resize(lado, lado)
    /* Sin canal alfa: el manifiesto los pinta sobre fondos que no controlamos
       y un PNG opaco pesa además bastante menos. */
    .flatten({ background: FONDO })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  await writeFile(path.join(PUBLICO, archivo), png);

  console.log(`${archivo.padEnd(28)} ${lado}×${lado}  ${(png.length / 1024).toFixed(0)} KB`);
}

/* El radio es el 22% del lado, que es el redondeo con el que se pintan las
   tarjetas de la app y el que usan los iconos del sistema. */
const RADIO = Math.round(LIENZO * 0.22);

await icono({ archivo: "icon-192.png", lado: 192, radio: RADIO, parte: 0.62 });
await icono({ archivo: "icon-512.png", lado: 512, radio: RADIO, parte: 0.62 });

/* A sangre y más pequeño: Android le pasa su máscara por encima. */
await icono({ archivo: "icon-maskable.png", lado: 512, radio: 0, parte: 0.46 });

/* iOS redondea el suyo, así que va a sangre como el recortable pero con el
   escudo a tamaño normal: la máscara de iOS apenas muerde. */
await icono({ archivo: "apple-icon.png", lado: 180, radio: 0, parte: 0.6 });
