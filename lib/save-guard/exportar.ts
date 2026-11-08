/*
|--------------------------------------------------------------------------
| RESCATE DEL CONTENIDO
|--------------------------------------------------------------------------
|
| Cuando un guardado pierde campos, lo único que queda del trabajo del usuario
| es lo que sigue en pantalla. Antes de tocar nada hay que poder sacarlo del
| navegador, así que estas funciones vuelcan el registro completo a un archivo
| local: TXT para leerlo y CSV para pegarlo de vuelta en la hoja.
*/

import { encargaDescarga } from "@/lib/trabajos/descargas";

import { CampoPerdido, explicarMotivo, normalizarValor } from "./verificar";

/** Marca de orden de bytes: sin ella Excel abre los acentos rotos. */
const BOM = "\uFEFF";

function marcaDeTiempo(): string {
  const ahora = new Date();

  const dos = (n: number) => String(n).padStart(2, "0");

  return (
    `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}` +
    `_${dos(ahora.getHours())}${dos(ahora.getMinutes())}`
  );
}

/** Nombre de archivo sin caracteres que Windows rechaza. */
export function nombreDeArchivo(base: string, extension: string): string {
  const limpio = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${limpio || "registro"}_${marcaDeTiempo()}.${extension}`;
}

export interface ContenidoRescatable {
  titulo: string;
  /** El registro entero tal y como está en pantalla. */
  registro: Record<string, unknown>;
  /** Campos que no llegaron al servidor, para destacarlos arriba del todo. */
  perdidos?: CampoPerdido[];
}

/**
 * Volcado legible. Empieza por lo perdido, que es lo urgente, y sigue con el
 * registro completo para no depender de qué se guardó y qué no.
 */
export function construirTxt({
  titulo,
  registro,
  perdidos = [],
}: ContenidoRescatable): string {
  const lineas: string[] = [];

  lineas.push(titulo);
  lineas.push("=".repeat(titulo.length));
  lineas.push("");
  lineas.push(`Exportado: ${new Date().toLocaleString("es-ES")}`);
  lineas.push("");

  if (perdidos.length) {
    lineas.push("---------------------------------------------------------");
    lineas.push("CAMPOS QUE NO SE HAN GUARDADO EN EL SERVIDOR");
    lineas.push("---------------------------------------------------------");
    lineas.push("");

    for (const perdido of perdidos) {
      lineas.push(`[${perdido.campo}]  (${explicarMotivo(perdido.motivo)})`);
      lineas.push(perdido.enviado);
      lineas.push("");
    }
  }

  lineas.push("---------------------------------------------------------");
  lineas.push("REGISTRO COMPLETO");
  lineas.push("---------------------------------------------------------");
  lineas.push("");

  for (const [campo, valor] of Object.entries(registro)) {
    const texto = normalizarValor(valor);

    if (!texto) continue;

    lineas.push(`[${campo}]`);
    lineas.push(texto);
    lineas.push("");
  }

  return lineas.join("\n");
}

function celdaCsv(valor: unknown): string {
  return `"${normalizarValor(valor).replace(/"/g, '""')}"`;
}

/**
 * CSV con la misma forma que la hoja (cabeceras arriba, un registro debajo),
 * para poder pegarlo directamente sobre la fila que se ha perdido.
 */
export function construirCsv({ registro }: ContenidoRescatable): string {
  const campos = Object.keys(registro);

  const cabeceras = campos.map((campo) => celdaCsv(campo)).join(",");
  const valores = campos.map((campo) => celdaCsv(registro[campo])).join(",");

  return `${BOM}${cabeceras}\n${valores}\n`;
}

/**
 * Encarga la descarga al anfitrión de descargas en segundo plano
 * (`lib/trabajos/descargas.ts`, 08/11/2026): el contenido ya va hecho texto,
 * así que no depende de la pantalla. En el ordenador se baja al momento; en
 * móvil y tableta sale «Descargar» en el aviso, y la píldora lo deja a mano
 * aunque se cambie de pantalla.
 */
export function descargarTexto(
  nombre: string,
  contenido: string,
  mime: string,
  titulo = `Copia · ${nombre}`
): void {
  encargaDescarga({
    titulo,
    vuelta: typeof window === "undefined" ? undefined : window.location.pathname + window.location.search,
    tarea: async () => ({
      blob: new Blob([contenido], { type: `${mime};charset=utf-8` }),
      nombre,
    }),
  });
}

export function descargarTxt(contenido: ContenidoRescatable): void {
  descargarTexto(
    nombreDeArchivo(contenido.titulo, "txt"),
    construirTxt(contenido),
    "text/plain",
    `Copia en TXT · ${contenido.titulo}`
  );
}

export function descargarCsv(contenido: ContenidoRescatable): void {
  descargarTexto(
    nombreDeArchivo(contenido.titulo, "csv"),
    construirCsv(contenido),
    "text/csv",
    `Copia en CSV · ${contenido.titulo}`
  );
}

/**
 * Descarga un documento completo en JSON.
 *
 * Para las pantallas que guardan su estado como un único documento (pizarras,
 * calendarios): ahí no hay campos sueltos que rescatar, sino el documento
 * entero, y el JSON es lo que se puede volver a cargar tal cual.
 */
export function descargarJson(titulo: string, documento: unknown): void {
  descargarTexto(
    nombreDeArchivo(titulo, "json"),
    JSON.stringify(documento, null, 2),
    "application/json",
    `Copia en JSON · ${titulo}`
  );
}

/** Copia el volcado TXT. Devuelve false si el navegador no lo permite. */
export async function copiarAlPortapapeles(
  contenido: ContenidoRescatable
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(construirTxt(contenido));

    return true;
  } catch {
    return false;
  }
}
