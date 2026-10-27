"use client";

/**
 * El anfitrión de los PDF de ABP en segundo plano (27/10/2026). Va en el
 * layout raíz: atiende el encargo aunque se cambie de pantalla, enseña el
 * progreso en una píldora y avisa al terminar —en la app y, si la pestaña no
 * está a la vista, con una notificación del sistema—.
 *
 * La mesa de trabajo (con la pizarra) se carga sólo cuando hay encargo: el
 * resto de pantallas no pagan su peso.
 */

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { trabajoPdfs } from "@/lib/abp/trabajo-pdfs";

const MesaPdfs = dynamic(() => import("@/components/abp/pizarra/MesaPdfs").then((m) => m.MesaPdfs), { ssr: false });

/** La pizarra con la ventana de los PDF abierta. */
const conVentana = (vuelta: string) => `${vuelta}${vuelta.includes("?") ? "&" : "?"}pdfs=1`;

async function notificaSistema(titulo: string, cuerpo: string, url: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const opciones = { body: cuerpo, icon: "/logo.png", badge: "/logo.png", tag: "abp-pdfs", data: { url } };

  try {
    const registro = await navigator.serviceWorker?.getRegistration();

    /* En el móvil sólo vale la del service worker; en el ordenador, cualquiera. */
    if (registro) await registro.showNotification(titulo, opciones);
    else new Notification(titulo, opciones);
  } catch (error) {
    console.warn("[abp-pizarra] notificación", error);
  }
}

export function TrabajoPdfs() {
  const estado = useSyncExternalStore(trabajoPdfs.suscribe, trabajoPdfs.foto, trabajoPdfs.foto);
  const router = useRouter();

  const abre = (vuelta: string) => {
    if (window.location.pathname === vuelta.split("?")[0]) trabajoPdfs.pideAbrir();
    else router.push(conVentana(vuelta));
  };

  const alTerminar = (vuelta: string) => ({ listos, fallos }: { listos: number; fallos: number }) => {
    const titulo = listos ? `PDF de ABP listos: ${listos}` : "No se han podido preparar los PDF de ABP";
    const cuerpo = `${fallos ? `${fallos} no han salido. ` : ""}Toca para enviarlos por WhatsApp.`;

    navigator.vibrate?.(200);

    (listos ? toast.success : toast.error)(titulo, {
      description: cuerpo,
      duration: 30_000,
      action: listos ? { label: "Abrir", onClick: () => abre(vuelta) } : undefined,
    });

    if (document.hidden || window.location.pathname !== vuelta.split("?")[0]) {
      void notificaSistema(titulo, cuerpo, conVentana(vuelta));
    }
  };

  const encargo = estado.encargo;

  if (!encargo) return null;

  return (
    <>
      <MesaPdfs encargo={encargo} alTerminar={alTerminar(encargo.vuelta)} />

      <button
        type="button"
        onClick={() => abre(encargo.vuelta)}
        title="Los PDF de balón parado se están preparando: puedes seguir usando la app, te aviso al terminar"
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg"
        style={{ backgroundColor: "#0F1E3D", color: "#FFFFFF", boxShadow: "0 0 0 1px rgba(216,180,90,.5), 0 8px 24px rgba(0,0,0,.35)" }}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "#D8B45A" }} />
        PDF ABP · {Math.min(estado.hecho + 1, estado.total)}/{estado.total}
      </button>
    </>
  );
}
