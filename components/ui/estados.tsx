"use client";

/**
 * LOS TRES ESTADOS QUE TODA PANTALLA TIENE Y CASI NINGUNA DIBUJABA BIEN.
 *
 * Cargando, vacío y error. Hasta el 11/10/2026 había veinticuatro pantallas
 * con un «Cargando…» en texto, cinco `EmptyState` distintos y ningún sitio
 * donde un fallo de la hoja se dijera: la página se quedaba vacía y parecía
 * que no había datos. Aquí van los tres, con la paleta de la plataforma, para
 * que se vean igual en todas partes y para que un error tenga siempre su
 * «Reintentar».
 */

import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/** Un bloque gris que respira, del tamaño que se le pida. */
export function Hueso({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`} />;
}

/**
 * El esqueleto de una pantalla típica: título, una fila de cifras y dos
 * paneles. Vale para casi todas mientras no tengan el suyo.
 */
export function EsqueletoPantalla({ titulo, cifras = 4, paneles = 2 }: { titulo?: string; cifras?: number; paneles?: number }) {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{titulo ? `Cargando ${titulo}…` : "Cargando…"}</span>
      <Hueso className="h-8 w-64" />
      {cifras > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: cifras }).map((_, i) => (
            <Hueso key={i} className="h-24" />
          ))}
        </div>
      )}
      {paneles > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: paneles }).map((_, i) => (
            <Hueso key={i} className="h-72" />
          ))}
        </div>
      )}
    </div>
  );
}

export function EstadoVacio({
  icon: Icono,
  titulo,
  texto,
  accion,
  className = "",
}: {
  icon?: ComponentType<{ size?: number; className?: string }>;
  titulo: string;
  texto?: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center ${className}`}>
      {Icono && <Icono size={22} className="mx-auto mb-2 text-white/35" />}
      <p className="text-sm font-semibold text-white/80">{titulo}</p>
      {texto && <p className="mx-auto mt-1 max-w-md text-xs text-white/45">{texto}</p>}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}

/**
 * Un fallo de carga, dicho. El mensaje del error va pequeño debajo: suele
 * ser «La hoja respondió 500» y es lo que hay que leer para saber si es cosa
 * de Google o de la red.
 */
export function EstadoError({
  titulo = "No se han podido cargar los datos",
  error,
  onReintentar,
  reintentando = false,
  className = "",
}: {
  titulo?: string;
  error?: unknown;
  onReintentar?: () => void;
  reintentando?: boolean;
  className?: string;
}) {
  const detalle = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    <div role="alert" className={`rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-5 py-5 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <AlertTriangle size={18} className="shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white/90">{titulo}</p>
          {detalle && <p className="mt-0.5 truncate text-xs text-white/45">{detalle}</p>}
          <p className="mt-0.5 text-xs text-white/45">Si estás sin cobertura, lo que se vea es la última copia guardada.</p>
        </div>
        {onReintentar && (
          <button
            type="button"
            onClick={onReintentar}
            disabled={reintentando}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white/85 transition hover:border-white/30 disabled:opacity-50"
          >
            <RefreshCw size={14} className={reintentando ? "animate-spin" : ""} />
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
