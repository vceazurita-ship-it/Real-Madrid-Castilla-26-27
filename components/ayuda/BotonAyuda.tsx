"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { ChevronDown, CircleHelp, Search, Sigma, TriangleAlert, X } from "lucide-react";

import { ItemMenuFlotante } from "@/components/ui/MenuFlotante";
import { useAdmin } from "@/hooks/useAdmin";
import { ayudaDe } from "@/lib/ayuda/paginas";

/**
 * LA CHULETA DE LA PANTALLA QUE SE ESTÁ MIRANDO.
 *
 * Vive dentro del menú de herramientas (`MenuFlotante`), junto a las alertas,
 * el tema y la exportación. Enseña, de la pantalla en la que uno está: de
 * dónde sale el dato, qué significa cada cifra y **cómo se calcula** cuando
 * hay cuenta de por medio.
 *
 * En filas de una línea a propósito. Si una explicación necesita un párrafo,
 * el problema no es la ayuda: es el gráfico.
 *
 * **Desaparece del menú en las pantallas que no tienen entrada**, en vez de
 * ofrecer un panel vacío; por eso la fila lleva el título de la ayuda como
 * pista: dice de qué va antes de abrirla.
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
      <ItemMenuFlotante
        icono={<CircleHelp className="h-4 w-4" aria-hidden />}
        titulo="Cómo se lee esta pantalla"
        pista={ayuda.titulo}
        onClick={() => setAbierto(true)}
        destacado
        /* Su cajón cuelga de esta misma fila: si el menú se cierra, se lleva
           por delante el estado que dice que está abierto. Es el mismo fallo
           que tuvo exportar. El velo del cajón ya tapa el menú de detrás. */
        mantenAbierto
      />

      {abierto && typeof document !== "undefined" && createPortal(
        /* En el body (14/11/2026): dentro del menú flotante el «fixed» quedaba atrapado en su caja y se veía pequeño. */
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Cómo se lee ${ayuda.titulo}`}
          data-export-hide
          className="modal-veil fixed inset-0 z-[85] flex justify-end bg-black/40 backdrop-blur-sm"
          onClick={() => setAbierto(false)}
        >
          <aside
            className="siempre-oscuro flex h-[100dvh] w-full flex-col overflow-hidden border-l border-white/10 shadow-2xl sm:max-w-2xl lg:max-w-3xl"
            style={{ background: "#0f141b", color: "#FFFFFF" }}
            onClick={(evento) => evento.stopPropagation()}
          >
            <PanelAyuda ayuda={ayuda} alCerrar={() => setAbierto(false)} />
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}

/*
| EL PANEL (14/11/2026, petición del analista: «caja pequeña y demasiado chorro de texto»).
|
| Más ancho y con letra más grande; arriba el resumen y un buscador; debajo, un
| atajo por bloque. Cada fila se ve plegada (su nombre y la primera frase) y se
| abre al pulsar; «Cómo se calcula» va aparte, plegado también. Al buscar, se
| abren solas las que casan.
*/
type Ayuda = NonNullable<ReturnType<typeof ayudaDe>>;

/** Lo corto que se ve plegado: la primera frase, y nunca más de `tope` letras. */
const primeraFrase = (t: string, tope = 120) => {
  const m = new RegExp(`^(.{30,${tope}}?[.:;])\\s`).exec(t);
  if (m) return m[1];
  if (t.length <= tope) return t;
  const corte = t.slice(0, tope);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(" "), tope - 20))}…`;
};
const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function PanelAyuda({ ayuda, alCerrar }: { ayuda: Ayuda; alCerrar: () => void }) {
  /* Lo técnico (scripts, documentos, claves) sólo para el administrador: el cuerpo técnico, lo que se lee. */
  const { admin: esAdmin } = useAdmin();
  const [busca, setBusca] = useState("");
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [cuentas, setCuentas] = useState<Set<string>>(new Set());
  const [verOrigen, setVerOrigen] = useState(false);
  const q = sinTildes(busca.trim());
  const bloques = useMemo(
    () =>
      ayuda.bloques
        .map((bl) => ({ ...bl, filas: q ? bl.filas.filter((f) => sinTildes(`${f.que} ${f.es} ${f.cuenta ?? ""}`).includes(q)) : bl.filas }))
        .filter((bl) => bl.filas.length),
    [ayuda, q],
  );
  const cambia = (set: Set<string>, k: string) => {
    const n = new Set(set);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  };
  const total = bloques.reduce((n, bl) => n + bl.filas.length, 0);

  return (
    <>
      <div className="border-b border-white/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-2xl bg-white/[0.06] p-2.5 text-[#C8A96B]">
              <CircleHelp size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-[28px] font-bold leading-tight">{ayuda.titulo}</h2>
            </div>
          </div>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white">
            <X size={20} aria-hidden />
          </button>
        </div>
        <p className="mt-3 max-w-4xl text-base leading-relaxed text-white/85">{primeraFrase(ayuda.resumen, 260)}</p>
        <label className="mt-3 flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2">
          <Search size={16} className="shrink-0 text-white/45" aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar en la ayuda (p. ej. xG, red de pases, alertas…)"
            className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/35"
            aria-label="Buscar en la ayuda"
          />
          {busca && (
            <button type="button" onClick={() => setBusca("")} className="text-sm text-white/50 hover:text-white">
              Borrar
            </button>
          )}
        </label>
        {!q && ayuda.bloques.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ayuda.bloques.map((bl, i) => (
              <button
                key={bl.titulo}
                type="button"
                /* Botón y no enlace «#»: el salto se queda dentro del panel, sin tocar la dirección de la página. */
                onClick={() => document.getElementById(`ayuda-bloque-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="rounded-full border border-white/15 px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                {bl.titulo.length > 38 ? `${bl.titulo.slice(0, 36)}…` : bl.titulo}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {q && <p className="mb-3 text-sm text-white/50">{total ? `${total} ${total === 1 ? "resultado" : "resultados"}` : "Nada con eso. Prueba con otra palabra."}</p>}

        {bloques.map((bl) => {
          const i = ayuda.bloques.findIndex((x) => x.titulo === bl.titulo);
          return (
            <section key={bl.titulo} id={`ayuda-bloque-${i}`} className="mb-6 scroll-mt-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[#C8A96B]">
                <Sigma size={14} aria-hidden />
                {bl.titulo}
              </h3>
              <div className="grid items-start gap-3">
                {bl.filas.map((fila) => {
                  const k = `${bl.titulo}|${fila.que}`;
                  const abierta = !!q || abiertas.has(k);
                  const corta = primeraFrase(fila.es);
                  return (
                    <div key={k} className={`rounded-2xl border bg-white/[0.03] ${abierta ? "border-[#C8A96B]/60" : "border-white/[0.09] hover:border-white/25"}`}>
                      <button
                        type="button"
                        onClick={() => setAbiertas((x) => cambia(x, k))}
                        aria-expanded={abierta}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold" style={{ color: "#E3C27E" }}>{fila.que}</p>
                          {!abierta && <p className="mt-1 text-sm leading-relaxed text-white/70">{corta}</p>}
                        </div>
                        <ChevronDown size={18} className={`mt-0.5 shrink-0 text-white/45 transition ${abierta ? "rotate-180" : ""}`} aria-hidden />
                      </button>
                      {abierta && (
                        <div className="px-4 pb-3">
                          <p className="text-[15px] leading-relaxed text-white/85">{fila.es}</p>
                          {fila.cuenta && esAdmin && (
                            <div className="mt-2">
                              <button type="button" onClick={() => setCuentas((x) => cambia(x, k))} className="text-sm font-semibold text-[#C8A96B] hover:underline">
                                {cuentas.has(k) || q ? "Ocultar cómo se calcula" : "Cómo se calcula"}
                              </button>
                              {(cuentas.has(k) || !!q) && (
                                <p className="mt-1 rounded-lg bg-white/[0.05] px-3 py-2 border-l-2 border-[#C8A96B] font-mono text-[13px] leading-relaxed text-[#E3C27E]">{fila.cuenta}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {!q && ayuda.ojo && ayuda.ojo.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-amber-300/90">
              <TriangleAlert size={14} aria-hidden />
              Ojo al leerlo
            </h3>
            <ul className="space-y-2">
              {ayuda.ojo.map((linea) => (
                <li key={linea} className="flex gap-2 text-[14px] leading-relaxed text-white/75">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" />
                  {linea}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!q && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
            <button type="button" onClick={() => setVerOrigen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.14em] text-white/55">
              De dónde salen los datos
              <ChevronDown size={16} className={`transition ${verOrigen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {verOrigen && <p className="px-4 pb-3 text-[13px] leading-relaxed text-white/65">{ayuda.origen}</p>}
          </div>
        )}
      </div>
    </>
  );
}

export default BotonAyuda;
