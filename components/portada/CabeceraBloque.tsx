import type { ElementType, ReactNode } from "react";

/**
 * LA CABECERA DE CADA BLOQUE DE LA PORTADA (16/11/2026, rediseño).
 *
 * Una sola forma para todos: el icono de lucide en su cuadro dorado, el
 * título con la letra del club (Barlow Condensed) y, debajo, una línea que
 * dice qué se cuenta y con qué base. A la derecha, si la hay, la acción del
 * bloque. Los estilos viven en `globals.css` (`.portada-icono`).
 */
export function CabeceraBloque({
  icono: Icono,
  titulo,
  sub,
  accion,
  className = "",
}: {
  icono: ElementType;
  titulo: ReactNode;
  sub?: ReactNode;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="portada-icono" aria-hidden>
          <Icono className="h-[18px] w-[18px]" />
        </span>

        <div className="min-w-0">
          <h2 className="fuente-club text-[22px] font-bold uppercase leading-none tracking-[0.02em] text-white sm:text-[24px]">
            {titulo}
          </h2>
          {sub ? <p className="mt-1 text-[12.5px] leading-snug text-white/60">{sub}</p> : null}
        </div>
      </div>

      {accion}
    </div>
  );
}
