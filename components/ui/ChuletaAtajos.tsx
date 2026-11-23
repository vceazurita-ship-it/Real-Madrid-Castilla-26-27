"use client";

/**
 * CHULETA DE ATAJOS (22/11/2026). «?» la abre y la cierra desde cualquier
 * pantalla; Esc la cierra. No salta escribiendo en un campo ni en las
 * pantallas que ya tienen su propia chuleta con «?» (coding, pizarras,
 * jugadores de sesión, el coding de ABP del rival): allí manda la suya.
 */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Keyboard, X } from "lucide-react";

const CON_LA_SUYA = ["/coding", "/jugadores-sesion", "/pizarra", "/abp-pizarra", "/scout-rival-abp", "/laboratorio/abp", "/setpieces"];

const GRUPOS: { titulo: string; atajos: [string, string][] }[] = [
  {
    titulo: "En toda la plataforma",
    atajos: [
      ["Ctrl K · ⌘ K", "Buscar y abrir cualquier pantalla"],
      ["?", "Esta chuleta"],
      ["Esc", "Cerrar la ventana o el panel abierto"],
      ["Tab · Mayús Tab", "Moverse por botones y enlaces"],
    ],
  },
  {
    titulo: "Mis tareas y Tu día",
    atajos: [
      ["Ctrl Z", "Deshacer lo último movido"],
      ["H · Intro", "Modo foco: hecha"],
      ["S · →", "Modo foco: saltar"],
      ["P", "Modo foco: pasar a mañana"],
    ],
  },
  {
    titulo: "Pizarras y coding",
    atajos: [["?", "Cada una tiene su chuleta propia: pulsa «?» dentro"]],
  },
];

export function ChuletaAtajos() {
  const ruta = usePathname() ?? "/";
  const [abierta, setAbierta] = useState(false);
  const propia = CON_LA_SUYA.some((r) => ruta === r || ruta.startsWith(`${r}/`));

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierta(false);
        return;
      }
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey || propia) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector('[aria-modal="true"]') && !abierta) return;
      e.preventDefault();
      setAbierta((v) => !v);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [propia, abierta]);

  if (!abierta) return null;

  return createPortal(
    <div className="modal-veil foco-velo fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4" onClick={() => setAbierta(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Atajos de teclado"
        onClick={(e) => e.stopPropagation()}
        className="hoja-abajo cristal relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 p-5 sm:max-w-lg sm:rounded-3xl sm:p-6"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />
        <button type="button" onClick={() => setAbierta(false)} aria-label="Cerrar" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Keyboard className="h-5 w-5 text-[color:var(--rmcf-gold-ink)]" aria-hidden /> Atajos de teclado
        </h2>
        {GRUPOS.map((g) => (
          <section key={g.titulo} className="mt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">{g.titulo}</h3>
            <dl className="mt-2 divide-y divide-white/[0.06]">
              {g.atajos.map(([k, que]) => (
                <div key={k + que} className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-sm text-white/80">{que}</dt>
                  <dd>
                    <kbd className="whitespace-nowrap rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-[12px] text-white/85">{k}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
}
