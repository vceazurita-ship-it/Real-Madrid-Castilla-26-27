/**
 * MANDAR UN INFORME POR CORREO: LO COMÚN A TODOS.
 *
 * Los informes se arman en el navegador —el de ABP del microciclo y el del
 * partido— y aquí llega el correo ya escrito: asunto, HTML, texto, las
 * imágenes que el HTML llama por `cid` y, si acaso, adjuntos sueltos (el PDF
 * del resumen). Esto lo valida y lo deja listo para `envia()`.
 *
 * **Sólo con sesión** (03/10/2026): la ruta mandaba desde la cuenta de Google
 * del club a cualquier dirección sin pedir nada. Ahora hace falta la cuenta
 * del cuerpo técnico (la de la quiniela) o la de administrador.
 *
 * Sólo servidor.
 */

import type { NextRequest } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { leeDestinatarios, type Adjunto, type Correo } from "@/lib/correo/gmail";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

/** Tipos que se dejan adjuntar sueltos. */
const ADJUNTOS_PERMITIDOS = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function puedeMandar(request: NextRequest) {
  const slug = leeSesion(request.cookies.get(COOKIE)?.value);

  if (slug && PERSONA_POR_SLUG.has(slug)) return true;

  return esAdmin(request.cookies.get(COOKIE_ADMIN)?.value);
}

/** El correo listo, o el motivo por el que no se puede mandar. */
export function leePeticionInforme(cuerpo: Record<string, unknown>): Correo | { error: string } {
  const { buenas, malas } = leeDestinatarios(String(cuerpo.para ?? ""));

  if (malas.length > 0) return { error: `Esto no parecen direcciones de correo: ${malas.slice(0, 3).join(", ")}` };

  if (buenas.length === 0) return { error: "No hay ninguna dirección a la que mandar el informe." };

  const asunto = String(cuerpo.asunto ?? "").trim();
  const html = String(cuerpo.html ?? "");
  const texto = String(cuerpo.texto ?? "");

  if (!asunto) return { error: "El correo no tiene asunto." };
  if (!html.trim()) return { error: "El informe ha llegado vacío." };

  /*
  | Las imágenes viajan como partes del correo, no dentro del HTML: Gmail
  | quita los `<img src="data:…">`, así que el informe las llama por su `cid`.
  */
  const imagenes = (Array.isArray(cuerpo.imagenes) ? cuerpo.imagenes : []).flatMap((una): Adjunto[] => {
    const dato = una as { cid?: unknown; base64?: unknown; tipo?: unknown };

    const cid = String(dato.cid ?? "").trim();
    const base64 = String(dato.base64 ?? "").trim();

    if (!cid || !base64) return [];

    const tipo = dato.tipo === "image/jpeg" ? "image/jpeg" : "image/png";

    return [{ nombre: `${cid}.${tipo === "image/jpeg" ? "jpg" : "png"}`, tipo, base64, cid }];
  });

  const sueltos = (Array.isArray(cuerpo.adjuntos) ? cuerpo.adjuntos : []).flatMap((uno): Adjunto[] => {
    const dato = uno as { nombre?: unknown; base64?: unknown; tipo?: unknown };

    const tipo = String(dato.tipo ?? "");
    const base64 = String(dato.base64 ?? "").trim();
    const nombre = String(dato.nombre ?? "").replace(/[\r\n"\\/]/g, "").trim().slice(0, 120);

    if (!ADJUNTOS_PERMITIDOS.has(tipo) || !base64 || !nombre) return [];

    return [{ nombre, tipo, base64 }];
  });

  return { para: buenas, asunto, html, texto, adjuntos: [...imagenes, ...sueltos] };
}
