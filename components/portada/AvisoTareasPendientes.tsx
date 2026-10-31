"use client";

/**
 * AVISO AL ENTRAR: TAREAS DE DÍAS ANTERIORES SIN HACER (31/10/2026).
 *
 * Montado en el layout, sólo para el administrador: al abrir la app (en
 * cualquier pantalla) mira «Mis tareas» y, si queda algo sin hacer de días
 * anteriores, lo enseña con «Marcar hecha», «Pasar a hoy» e «Ir a mis tareas».
 * Sale una vez por sesión del navegador (cerrarlo cuenta como visto); al
 * volver a entrar otro día, o en otra ventana, vuelve a mirar.
 *
 * Cuenta lo mismo que el correo de las 7:00 (`pendientesAnteriores`).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Check, X } from "lucide-react";

import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import { useAdmin } from "@/hooks/useAdmin";
import { useCalendario } from "@/hooks/useCalendario";
import { useMisTareas, useSesionesDelMicro } from "@/hooks/useMisTareas";
import {
  EVENTO_ABRIR,
  alternaHechaAuto,
  alternaHechaPropia,
  edita,
  hoyEnMadrid,
  nuevoId,
  pendientesAnteriores,
  rotuloDia,
  type TareaDelDia,
} from "@/lib/portada/mis-tareas";

const VISTO = "rmcf-tareas-pendientes-visto";

const yaVisto = (hoy: string) => {
  try {
    return window.sessionStorage.getItem(VISTO) === hoy;
  } catch {
    return false;
  }
};

const marcaVisto = (hoy: string) => {
  try {
    window.sessionStorage.setItem(VISTO, hoy);
  } catch {
    /* Sin almacenamiento, sale en cada carga: mejor eso que nunca. */
  }
};

export function AvisoTareasPendientes() {
  const { admin } = useAdmin();
  const ruta = usePathname();

  if (!admin || ruta?.startsWith("/login")) return null;

  return <Vigia />;
}

function Vigia() {
  const [hoy, setHoy] = useState("");

  /* Se mira un poco después de entrar, para no competir con la carga de la pantalla. */
  useEffect(() => {
    const id = setTimeout(() => {
      const dia = hoyEnMadrid();

      if (!yaVisto(dia)) setHoy(dia);
    }, 2500);

    return () => clearTimeout(id);
  }, []);

  /*
  | Al cerrar se esconde la ventana pero el aviso sigue montado: lo marcado un
  | segundo antes tiene que terminar de guardarse y avisar a «Mis tareas».
  */
  const [cerrado, setCerrado] = useState(false);

  const cierra = useCallback(() => {
    if (hoy) marcaVisto(hoy);

    setCerrado(true);
  }, [hoy]);

  if (!hoy) return null;

  return <Aviso hoy={hoy} cerrado={cerrado} alCerrar={cierra} />;
}

function Aviso({ hoy, cerrado, alCerrar }: { hoy: string; cerrado: boolean; alCerrar: () => void }) {
  const { partidos, cargando: sinCalendario } = useCalendario();
  const { sesiones, listo } = useSesionesDelMicro();
  const { hechas, doc, cambiaHechas, cambiaDoc, cargando } = useMisTareas();

  const pendientes = useMemo(
    () => (partidos.length && listo && !cargando ? pendientesAnteriores({ partidos, hoy, hechas, doc, sesiones }) : null),
    [partidos, listo, cargando, hoy, hechas, doc, sesiones],
  );

  /* Lo que había al abrir: si se resuelve todo, se dice y se cierra. */
  const [habia, setHabia] = useState<number | null>(null);

  useEffect(() => {
    if (pendientes && habia === null) {
      const id = setTimeout(() => setHabia(pendientes.length), 0);

      return () => clearTimeout(id);
    }
  }, [pendientes, habia]);

  /* Nada pendiente al entrar (o sin calendario): visto, sin enseñar nada. */
  useEffect(() => {
    if (cerrado) return;

    if (habia === 0 || (!sinCalendario && !partidos.length)) alCerrar();
  }, [cerrado, habia, sinCalendario, partidos.length, alCerrar]);

  const abierto = !cerrado && Boolean(habia && pendientes);

  if (!abierto || !pendientes) return null;

  const marca = (t: TareaDelDia) => {
    if (t.tipo === "auto") cambiaHechas((h) => alternaHechaAuto(h, t.clave, true));
    else cambiaDoc((d) => alternaHechaPropia(d, t.id, true));
  };

  const aHoy = (t: TareaDelDia) => {
    const id = nuevoId();

    cambiaDoc((d) => edita(d, t, { fecha: hoy }, id));
  };

  const todasAHoy = () => {
    const ids = pendientes.map(() => nuevoId());

    cambiaDoc((d) => pendientes.reduce((acc, t, i) => edita(acc, t, { fecha: hoy }, ids[i]), d));
  };

  return <Ventana pendientes={pendientes} alCerrar={alCerrar} marca={marca} aHoy={aHoy} todasAHoy={todasAHoy} />;
}

function Ventana({
  pendientes,
  alCerrar,
  marca,
  aHoy,
  todasAHoy,
}: {
  pendientes: TareaDelDia[];
  alCerrar: () => void;
  marca: (t: TareaDelDia) => void;
  aHoy: (t: TareaDelDia) => void;
  todasAHoy: () => void;
}) {
  useBodyScrollLock(true);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [alCerrar]);

  const vacio = pendientes.length === 0;

  return (
    <div
      /* El fondo lo pone `.modal-veil`, no `bg-black/70` (modo día: ver AlertasPortada). */
      className="modal-veil fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto p-3 backdrop-blur-sm sm:p-6"
      data-export-hide
      role="dialog"
      aria-modal="true"
      aria-label="Tareas pendientes"
      onClick={alCerrar}
    >
      <div className="my-auto w-full max-w-xl overflow-hidden rounded-[22px] border border-white/12 bg-[#11161D] shadow-[0_24px_80px_rgba(0,0,0,.6)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-400/40 bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-300" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#C8A96B]">Mis tareas</p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                {vacio ? "Todo al día" : pendientes.length === 1 ? "Te queda una tarea de días anteriores" : `Te quedan ${pendientes.length} tareas de días anteriores`}
              </h2>
            </div>
          </div>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!vacio && (
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto px-5 py-4">
            {pendientes.map((t) => (
              <li key={t.clave} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/90">{t.texto}</p>
                  <p className="text-xs text-red-300/80">
                    {rotuloDia(t.fecha)}
                    {t.prioridad === "alta" ? " · prioridad alta" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" onClick={() => marca(t)} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10">
                    <Check className="h-3.5 w-3.5" /> Marcar hecha
                  </button>
                  <button type="button" onClick={() => aHoy(t)} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs font-semibold text-white/75 hover:bg-white/10">
                    <ArrowDownToLine className="h-3.5 w-3.5" /> Pasar a hoy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-3">
          {pendientes.length > 1 && (
            <button type="button" onClick={todasAHoy} className="rounded-full px-3 py-1.5 text-sm text-white/70 hover:text-white">
              Pasar todas a hoy
            </button>
          )}
          <Link
            href="/?tareas=1"
            onClick={() => {
              window.dispatchEvent(new Event(EVENTO_ABRIR));
              alCerrar();
            }}
            className="rounded-full bg-[#D8B45A] px-4 py-1.5 text-sm font-semibold text-[#0B0F14]"
          >
            Ir a mis tareas
          </Link>
        </div>
      </div>
    </div>
  );
}
