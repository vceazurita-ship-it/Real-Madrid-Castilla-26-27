"use client";

/**
 * AVISO: LA CONEXIÓN CON GOOGLE SE HA CAÍDO (02/11/2026).
 *
 * El correo del club y la subida a YouTube usan el mismo permiso de Google, y
 * cuando caduca (`invalid_grant`) antes sólo se sabía al mandar un informe. La
 * portada lo pregunta a `/api/google/estado` —que canjea el token sin mandar
 * nada— y, si hay que volver a conectar, lo dice arriba con el botón que lleva
 * a la pantalla de permisos de Google.
 *
 * Sólo para el administrador: es quien puede conectar la cuenta del club, y a
 * nadie más le sirve de nada. Si todo va bien, o si el fallo es un corte de red
 * pasajero, no se pinta.
 *
 * El botón es un `<a>` y no un `Link`: `/api/youtube/conectar` es una ruta del
 * servidor que redirige a Google, no una pantalla de la app.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { useAdmin } from "@/hooks/useAdmin";
import type { SaludGoogle } from "@/lib/correo/salud-google";

export function AvisoConexionGoogle() {
  const { admin } = useAdmin();

  if (!admin) return null;

  return <Aviso />;
}

function Aviso() {
  const [salud, setSalud] = useState<SaludGoogle | null>(null);

  useEffect(() => {
    let vivo = true;

    fetch("/api/google/estado", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((datos: { salud?: SaludGoogle } | null) => {
        if (vivo && datos?.salud) setSalud(datos.salud);
      })
      .catch(() => {
        /* Sin respuesta no se avisa de nada: es un aviso, no una pantalla. */
      });

    return () => {
      vivo = false;
    };
  }, []);

  if (!salud?.hayQueReconectar) return null;

  const titulo =
    salud.estado === "faltan-permisos"
      ? "A la cuenta de Google le faltan permisos"
      : salud.estado === "sin-conectar"
        ? "No hay ninguna cuenta de Google conectada"
        : "Google ha caducado el permiso de la cuenta del club";

  const queAfecta = salud.correoPorSmtp
    ? "La subida a YouTube no funciona hasta reconectar. El correo sigue saliendo por la contraseña de aplicación."
    : "No salen los correos de los informes ni se suben vídeos a YouTube hasta reconectar.";

  return (
    <section
      role="alert"
      data-export-hide
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />

        <div className="min-w-0">
          <p className="font-semibold">{titulo}</p>
          <p className="text-amber-200/90">{queAfecta}</p>
          <p className="mt-1 text-amber-200/70">{salud.motivo}</p>
        </div>
      </div>

      <a
        href="/api/youtube/conectar"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Volver a conectar Google
      </a>
    </section>
  );
}
