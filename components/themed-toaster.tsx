"use client";

import { Toaster } from "sonner";

import { useTheme } from "@/components/theme-provider";

/**
 * Los avisos de sonner tienen su propio tema, así que hay que pasárselo a mano:
 * `theme="system"` miraría la preferencia del sistema operativo, no el modo
 * que haya elegido el usuario dentro de la plataforma.
 */
export function ThemedToaster() {
  const { theme } = useTheme();

  return <Toaster richColors position="top-center" theme={theme} />;
}

export default ThemedToaster;
