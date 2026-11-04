"use client";

import { CheckCircle2, Info, Loader2, OctagonAlert, TriangleAlert, X } from "lucide-react";
import { Toaster } from "sonner";

import { useTheme } from "@/components/theme-provider";
import { preparaAvisos } from "@/lib/avisos";

/*
| Antes del primer aviso: los `toast.error` de toda la app pasan a decir el
| fallo en palabras del analista y a quedarse hasta que se cierran (ver
| `lib/avisos.ts`). Se hace al cargar el módulo y no en un efecto para que
| valga también para un error que salte durante la hidratación.
*/
preparaAvisos();

/**
 * Los avisos de la plataforma (04/11/2026): tarjeta propia con el estilo del
 * club en vez de los colores de serie de sonner. El dibujo está en
 * `components/ui/avisos.css`; aquí van los iconos y el comportamiento.
 *
 * Los avisos de sonner tienen su propio tema, así que hay que pasárselo a mano:
 * `theme="system"` miraría la preferencia del sistema operativo, no el modo
 * que haya elegido el usuario dentro de la plataforma.
 */
export function ThemedToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-center"
      theme={theme}
      closeButton
      visibleToasts={4}
      gap={10}
      duration={4000}
      containerAriaLabel="Avisos"
      className="rmcf-avisos"
      toastOptions={{
        className: "rmcf-aviso",
        closeButtonAriaLabel: "Cerrar aviso",
      }}
      icons={{
        success: <CheckCircle2 size={18} strokeWidth={2.3} />,
        info: <Info size={18} strokeWidth={2.3} />,
        warning: <TriangleAlert size={18} strokeWidth={2.3} />,
        error: <OctagonAlert size={18} strokeWidth={2.3} />,
        loading: <Loader2 size={18} strokeWidth={2.3} className="rmcf-aviso-gira" />,
        close: <X size={14} strokeWidth={2.4} />,
      }}
    />
  );
}

export default ThemedToaster;
