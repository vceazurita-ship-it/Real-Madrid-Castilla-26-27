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

import { descargaVideos } from "@/lib/abp/descarga-videos";
import { trabajoPdfs, type EncargoPdfs } from "@/lib/abp/trabajo-pdfs";

const MesaPdfs = dynamic(() => import("@/components/abp/pizarra/MesaPdfs").then((m) => m.MesaPdfs), { ssr: false });
const MesaVideos = dynamic(() => import("@/components/abp/pizarra/MesaVideos").then((m) => m.MesaVideos), { ssr: false });

/** La pizarra con la ventana de los PDF abierta. */
const conVentana = (vuelta: string) => `${vuelta}${vuelta.includes("?") ? "&" : "?"}pdfs=1`;

async function notificaSistema(titulo: string, cuerpo: string, url: string, tag: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const opciones = { body: cuerpo, icon: "/logo.png", badge: "/logo.png", tag, data: { url } };

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

  const alTerminar = (encargo: EncargoPdfs, que: "PDF" | "Vídeos") => ({ listos, fallos }: { listos: number; fallos: number }) => {
    const { vuelta } = encargo;
    const titulo = listos ? `${que} de ABP listos: ${listos}` : `No se han podido preparar los ${que.toLowerCase()} de ABP`;
    const cuerpo = `${fallos ? `${fallos} no han salido. ` : ""}Toca para enviarlos por WhatsApp.`;

    navigator.vibrate?.(200);

    (listos ? toast.success : toast.error)(titulo, {
      description: cuerpo,
      duration: 30_000,
      action: listos ? { label: "Abrir", onClick: () => abre(vuelta) } : undefined,
      /* En el ordenador, los vídeos se bajan desde el aviso, sin volver a la pizarra. */
      cancel:
        listos && que === "Vídeos" && !window.matchMedia?.("(pointer: coarse)").matches
          ? {
              label: "Descargar",
              onClick: () =>
                void descargaVideos(Object.values(trabajoPdfs.foto().videos), `ABP-videos-${encargo.jornada ?? ""}-${encargo.rival}.zip`),
            }
          : undefined,
    });

    if (document.hidden || window.location.pathname !== vuelta.split("?")[0]) {
      void notificaSistema(titulo, cuerpo, conVentana(vuelta), que === "PDF" ? "abp-pdfs" : "abp-videos");
    }
  };

  const { encargo, encargoVideos } = estado;

  if (!encargo && !encargoVideos) return null;

  const vuelta = (encargo ?? encargoVideos)!.vuelta;

  const texto = [
    encargo ? `PDF ${Math.min(estado.hecho + 1, estado.total)}/${estado.total}` : "",
    encargoVideos
      ? `Vídeo ${Math.min(estado.hechoVideos + 1, estado.totalVideos)}/${estado.totalVideos} · ${Math.round(estado.avanceVideo * 100)} %`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {encargo && <MesaPdfs encargo={encargo} alTerminar={alTerminar(encargo, "PDF")} />}
      {encargoVideos && <MesaVideos encargo={encargoVideos} alTerminar={alTerminar(encargoVideos, "Vídeos")} />}

      <button
        type="button"
        onClick={() => abre(vuelta)}
        title="Los PDF y vídeos de balón parado se están preparando: puedes seguir usando la app, te aviso al terminar"
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg"
        style={{ backgroundColor: "#0F1E3D", color: "#FFFFFF", boxShadow: "0 0 0 1px rgba(216,180,90,.5), 0 8px 24px rgba(0,0,0,.35)" }}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "#D8B45A" }} />
        ABP · {texto}
      </button>
    </>
  );
}
