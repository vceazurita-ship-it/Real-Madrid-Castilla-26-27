"use client";

/**
 * EL AVISO DE «YA ESTÁ» (29/10/2026).
 *
 * Lo pidió el analista: cualquier trabajo largo se lanza, se sigue con otra
 * cosa y, al terminar, sale un aviso —donde se esté de la app— sin tener que
 * volver a la pantalla a mirar. Un toast con estilo y, si la pestaña no está
 * a la vista y el navegador lo permite, la notificación del sistema.
 *
 * `avisaHecho` es para quien termine algo en el navegador o vea terminar un
 * encargo del ordenador del club (components/ui/AvisoEncargos.tsx).
 */

import { toast } from "sonner";

export type AvisoHecho = {
  titulo: string;
  texto?: string;
  ok: boolean;
  /** A dónde lleva «Ver». */
  href?: string;
  /** Para no repetir el mismo aviso en dos pestañas. */
  clave?: string;
};

const YA = "rmcf-avisado:";

function yaAvisado(clave: string) {
  try {
    if (localStorage.getItem(YA + clave)) return true;

    localStorage.setItem(YA + clave, String(Date.now()));
  } catch {}

  return false;
}

/** Pide permiso para la notificación del sistema (sólo si aún no se ha contestado). */
export function pidePermisoAvisos() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    void Notification.requestPermission().catch(() => undefined);
  }
}

async function delSistema({ titulo, texto, href, clave }: AvisoHecho) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const opciones = { body: texto ?? "", icon: "/logo.png", badge: "/logo.png", tag: clave ?? titulo, data: { url: href ?? "/" } };

  try {
    const registro = await navigator.serviceWorker?.getRegistration();

    if (registro) await registro.showNotification(titulo, opciones);
    else new Notification(titulo, opciones);
  } catch {}
}

export function avisaHecho(aviso: AvisoHecho) {
  if (aviso.clave && yaAvisado(aviso.clave)) return;

  (aviso.ok ? toast.success : toast.error)(aviso.titulo, {
    description: aviso.texto,
    duration: 15_000,
    ...(aviso.href
      ? {
          action: {
            label: "Ver",
            onClick: () => {
              window.location.href = aviso.href!;
            },
          },
        }
      : {}),
  });

  navigator.vibrate?.(200);

  if (document.visibilityState !== "visible") void delSistema(aviso);
}
