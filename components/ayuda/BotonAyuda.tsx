"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, Sigma, TriangleAlert, X } from "lucide-react";

import { ayudaDe } from "@/lib/ayuda/paginas";

/**
 * LA CHULETA DE LA PANTALLA QUE SE ESTÁ MIRANDO.
 *
 * Va en la misma columna que los otros flotantes —alertas, día/noche,
 * exportar— porque es el sitio donde ya se busca lo que no es contenido de la
 * página. Se abre con la interrogación y enseña, de la pantalla en la que uno
 * está: de dónde sale el dato, qué significa cada cifra y **cómo se calcula**
 * cuando hay cuenta de por medio.
 *
 * En filas de una línea a propósito. Si una explicación necesita un párrafo,
 * el problema no es la ayuda: es el gráfico.
 *
 * El botón desaparece en las pantallas que no tienen entrada, en vez de abrir
 * un panel vacío. Y no sale en las capturas: lleva `data-export-hide`.
 */
export function BotonAyuda() {
  const ruta = usePathname() ?? "/";

  /*
  | Se guarda **en qué pantalla** se abrió, no un simple «sí o no».
  |
  | Así, al navegar, el panel se cierra solo porque la ruta ya no coincide: sin
  | efecto que lo cierre a mano, que es justo lo que el linter de React no deja
  | hacer —cambiar estado dentro de un efecto— y con razón, porque obliga a un
  | segundo pintado para deshacer el primero.
  */
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);

  const abierto = abiertoEn === ruta;

  const setAbierto = (quiero: boolean) => setAbiertoEn(quiero ? ruta : null);

  const ayuda = ayudaDe(ruta);

  /* Escape cierra, como en el resto de modales de la plataforma. */
  useEffect(() => {
    if (!abierto) return;

    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbiertoEn(null);
    };

    window.addEventListener("keydown", alPulsar);

    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto]);

  if (!ayuda) return null;

  return (
    <>
      <button
        type="button"
        data-export-hide
        /* Se aparta cuando hay un modal abierto: ver globals.css. */
        data-flotante
        onClick={() => setAbierto(true)}
        aria-label={`Cómo se lee esta pantalla: ${ayuda.titulo}`}
        title="Cómo se lee esta pantalla"
        className="
          fixed bottom-[248px] right-5 z-[60]
          flex h-11 w-11 items-center justify-center
          rounded-full
          border border-white/10
          bg-white/[0.06]
          text-[#C8A96B]
          shadow-xl
          backdrop-blur
          transition
          hover:bg-white/10
          print:hidden
        "
      >
        <CircleHelp className="h-5 w-5" aria-hidden />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Cómo se lee ${ayuda.titulo}`}
          data-export-hide
          className="modal-veil fixed inset-0 z-[85] flex justify-end backdrop-blur-sm"
          onClick={() => setAbierto(false)}
        >
          <aside
            className="flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#11161D] shadow-2xl"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-2xl bg-white/[0.06] p-2.5 text-[#C8A96B]">
                  <CircleHelp size={20} aria-hidden />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{ayuda.titulo}</h2>

                  <p className="text-xs text-white/40">Cómo se lee esta pantalla</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="shrink-0 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-[13px] leading-relaxed text-white/70">
                {ayuda.resumen}
              </p>

              <p className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[11.5px] leading-relaxed text-white/45">
                <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  De dónde sale
                </span>
                <br />
                {ayuda.origen}
              </p>

              {ayuda.bloques.map((bloque) => (
                <section key={bloque.titulo} className="mt-5">
                  <h3 className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#C8A96B]">
                    <Sigma size={12} aria-hidden />
                    {bloque.titulo}
                  </h3>

                  <dl className="space-y-2">
                    {bloque.filas.map((fila) => (
                      <div
                        key={fila.que}
                        className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2"
                      >
                        <dt className="text-[12.5px] font-semibold text-white/85">
                          {fila.que}
                        </dt>

                        <dd className="mt-0.5 text-[12px] leading-relaxed text-white/55">
                          {fila.es}

                          {fila.cuenta && (
                            /* La cuenta va aparte y en monoespaciado: es lo que
                               se viene a mirar, no una coletilla de la frase. */
                            <span className="mt-1 block rounded-lg bg-white/[0.04] px-2 py-1 font-mono text-[11px] leading-relaxed text-[#C8A96B]/90">
                              {fila.cuenta}
                            </span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}

              {ayuda.ojo && ayuda.ojo.length > 0 && (
                <section className="mt-5">
                  <h3 className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-amber-300/80">
                    <TriangleAlert size={12} aria-hidden />
                    Ojo al leerlo
                  </h3>

                  <ul className="space-y-1.5">
                    {ayuda.ojo.map((linea) => (
                      <li
                        key={linea}
                        className="flex gap-2 text-[12px] leading-relaxed text-white/55"
                      >
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-amber-300/70" />
                        {linea}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export default BotonAyuda;
