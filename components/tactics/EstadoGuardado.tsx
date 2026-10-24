"use client";

import { Check, CloudOff, Loader2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * La pastilla de guardado de las pizarras (19/10/2026).
 *
 * Había tres copias —la pizarra táctica, las fases de la de competición y la
 * de cada rival— y las tres mentían igual: decían «Guardado» con cambios aún
 * por subir y «Error» o «Solo local» sin decir qué pasaba ni qué hacer. Con
 * algo pendiente o un fallo la pastilla es un botón que guarda o reintenta en
 * el acto (`guardaYa` de `useRemoteDoc`), como `SaveState` en el resto de la
 * app, pero con la forma de pastilla de las pizarras.
 */
export default function EstadoGuardado({
  status,
  localOnly,
  sinGuardar = false,
  onGuardar,
  ocultoSiGuardado = false,
}: {
  /** No pinta nada mientras todo esté guardado. */
  ocultoSiGuardado?: boolean;
  status: string;
  localOnly: boolean;
  /** Hay cambios que aún no están en el servidor. */
  sinGuardar?: boolean;
  /** Guarda o reintenta sin esperar. */
  onGuardar?: () => void;
}) {
  const guardando = status === "saving";
  const cargando = status === "loading";

  const [tono, icono, texto] = localOnly
    ? (["ambar", <CloudOff key="i" size={13} />, "Sólo en este dispositivo"] as const)
    : status === "error"
      ? (["rojo", <TriangleAlert key="i" size={13} />, "No se pudo guardar · reintentar"] as const)
      : guardando || cargando
        ? ([
            "neutro",
            <Loader2 key="i" size={13} className="animate-spin" />,
            guardando ? "Guardando…" : "Cargando…",
          ] as const)
        : sinGuardar
          ? (["oro", <Loader2 key="i" size={13} className="animate-spin" />, "Sin guardar"] as const)
          : (["verde", <Check key="i" size={13} />, "Guardado"] as const);

  const tonos = {
    verde: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    ambar: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    rojo: "border-red-500/30 bg-red-500/10 text-red-300",
    oro: "border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B]",
    neutro: "border-white/15 bg-white/5 text-white/60",
  } as const;

  const clase = cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium",
    tonos[tono],
  );

  /* Con todo guardado no hay nada que avisar: sólo se habla cuando hay algo pendiente o roto. */
  if (tono === "verde" && ocultoSiGuardado) return null;

  const pulsable = onGuardar && (tono === "ambar" || tono === "rojo" || tono === "oro");

  if (!pulsable) {
    return (
      <span className={clase} role="status">
        {icono}
        {texto}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onGuardar}
      title={
        tono === "ambar"
          ? "Sin conexión con el servidor: lo hecho se guarda aquí y se sube solo al volver. Pulsa para intentarlo ya."
          : "Pulsa para guardar ahora"
      }
      className={cn(clase, "transition hover:brightness-125")}
    >
      {icono}
      {texto}
    </button>
  );
}
