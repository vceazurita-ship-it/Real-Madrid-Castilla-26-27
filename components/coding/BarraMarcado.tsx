"use client";

/*
|--------------------------------------------------------------------------
| MARCAR CON EL DEDO
|--------------------------------------------------------------------------
|
| El coding se hizo para el teclado —la I y la O sin soltar la mano— y eso
| sigue siendo lo más rápido delante de un ordenador. Pero el partido se ve
| muchas veces en una tablet, en el autobús o en el banquillo, y ahí no hay
| teclas: había que enchufar un teclado o no se podía marcar nada.
|
| Esta barra es la misma marca de siempre, pulsable. Tres decisiones:
|
| **Un solo botón grande, no dos.** Marcar el inicio y cerrar el corte son dos
| momentos del mismo gesto y nunca se piden a la vez: mientras no hay marca
| sólo cabe abrir, y con la marca abierta sólo cabe cerrar. Con dos botones
| medio ancho cada uno, el dedo tiene que apuntar y en un partido no se está
| mirando la barra, se está mirando el vídeo. Uno que ocupa todo el ancho se
| pulsa sin mirar.
|
| **Del ancho entero y de 56 px de alto** (`min-h-14`), que es lo que pide un
| pulgar. Debajo de eso se falla, y fallar aquí significa un corte que empieza
| dos segundos tarde.
|
| **Quién y qué, en dos chapas que abren el selector.** Los paneles de
| jugadores y categorías viven en la columna de la derecha, que en un móvil
| cae **debajo** del vídeo: elegir jugador obligaba a bajar, elegir, y volver a
| subir para marcar. Desde aquí se abre una hoja encima y se vuelve solo.
| Y si se pulsa «marcar» sin jugador, en vez del aviso de siempre se abre esa
| misma hoja: el aviso decía qué falta, pero no llevaba a ninguna parte.
*/

import { CircleDot, Square, Undo2, X } from "lucide-react";

import type {
  CategoriaCoding,
  ComportamientoColectivo,
  JugadorCoding,
} from "@/lib/coding/modelo";
import {
  PanelCategorias,
  PanelColectivos,
  PanelJugadores,
} from "@/components/coding/piezas";

/** Lo que se sabe del sujeto elegido, ya resuelto por la pantalla. */
export type SujetoMarcado = {
  tipo: "jugador" | "colectivo";
  nombre: string;
} | null;

export function BarraMarcado({
  inicioMs,
  tiempoMs,
  sujeto,
  categoria,
  formatea,
  onInicio,
  onFinal,
  onCancelar,
  onDeshacer,
  onElegirSujeto,
  onElegirCategoria,
  listo,
}: {
  /** Milisegundo del IN, o `null` si no hay marca abierta. */
  inicioMs: number | null;
  tiempoMs: number;
  sujeto: SujetoMarcado;
  categoria: CategoriaCoding | null;
  formatea: (ms: number) => string;
  onInicio: () => void;
  onFinal: () => void;
  onCancelar: () => void;
  onDeshacer: () => void;
  /** Abren la hoja de selección, ya en la sección que toca. */
  onElegirSujeto: () => void;
  onElegirCategoria: () => void;
  /** Sin vídeo no hay nada que marcar. */
  listo: boolean;
}) {
  const abierta = inicioMs !== null;

  /* Lo que llevaría el corte si se cerrara ahora mismo. */
  const largoMs = abierta ? Math.max(0, tiempoMs - inicioMs) : 0;

  return (
    <div className="mt-3 min-w-0 rounded-xl border border-white/10 bg-black/30 p-2.5">
      {/* ------------------------- QUIÉN Y QUÉ ------------------------- */}

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onElegirSujeto}
          className={`flex min-w-0 shrink items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition ${
            sujeto
              ? "border-[#C8A96B]/50 bg-[#C8A96B]/10 text-white"
              : "border-dashed border-white/20 text-white/45 hover:border-[#C8A96B]/60 hover:text-white"
          }`}
        >
          {sujeto?.tipo === "colectivo" && (
            <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-white/40">
              Col.
            </span>
          )}

          <span className="truncate font-semibold">
            {sujeto ? sujeto.nombre : "Elegir jugador"}
          </span>
        </button>

        <button
          type="button"
          onClick={onElegirCategoria}
          className={`flex min-w-0 shrink items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition ${
            categoria
              ? "text-white"
              : "border-dashed border-white/20 text-white/45 hover:border-[#C8A96B]/60 hover:text-white"
          }`}
          style={
            categoria
              ? {
                  borderColor: `${categoria.color}80`,
                  background: `${categoria.color}1A`,
                }
              : undefined
          }
        >
          <span className="truncate">
            {categoria ? categoria.nombre : "Categoría"}
          </span>
        </button>

        <button
          type="button"
          onClick={onDeshacer}
          title="Deshacer el último corte"
          aria-label="Deshacer el último corte"
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/50 transition hover:border-white/25 hover:text-white"
        >
          <Undo2 size={16} />
        </button>
      </div>

      {/* --------------------------- MARCAR ---------------------------- */}

      <div className="mt-2 flex min-w-0 items-stretch gap-2">
        <button
          type="button"
          disabled={!listo}
          onClick={abierta ? onFinal : onInicio}
          className={`flex min-h-14 min-w-0 flex-1 items-center justify-center gap-3 rounded-xl px-4 text-base font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${
            abierta
              ? "bg-[#34D399] text-black hover:bg-[#4ee0ac]"
              : "bg-[#C8A96B] text-black hover:bg-[#d8ba7c]"
          }`}
        >
          {abierta ? <Square size={18} /> : <CircleDot size={18} />}

          <span className="truncate">
            {abierta ? "Cerrar corte" : "Marcar inicio"}
          </span>

          {abierta && (
            <span className="font-mono text-sm tabular-nums opacity-70">
              {formatea(largoMs)}
            </span>
          )}
        </button>

        {/*
        | Cancelar sólo existe con la marca abierta, y va aparte y estrecho: es
        | la salida de un error, no una opción del mismo rango. Un botón fijo
        | del mismo tamaño al lado del de marcar sería el que se pulsa por
        | equivocación con el pulgar.
        */}
        {abierta && (
          <button
            type="button"
            onClick={onCancelar}
            title="Cancelar la marca"
            aria-label="Cancelar la marca"
            className="flex min-h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 text-white/55 transition hover:border-red-400/50 hover:text-red-300"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* --------------------------- LOS TIEMPOS ----------------------- */}

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] tabular-nums">
        <span className="text-white/35">
          IN{" "}
          <b className={abierta ? "text-white/80" : "text-white/30"}>
            {abierta ? formatea(inicioMs) : "—"}
          </b>
        </span>

        <span className="text-white/15">→</span>

        <span className="text-white/35">
          OUT{" "}
          <b className={abierta ? "text-white/80" : "text-white/30"}>
            {abierta ? formatea(Math.max(inicioMs, tiempoMs)) : "—"}
          </b>
        </span>

        <span className="ml-auto font-sans text-[11px] text-white/25">
          o con las teclas I y O
        </span>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| LA HOJA DE SELECCIÓN
|--------------------------------------------------------------------------
|
| Los mismos paneles de la columna de la derecha, encima del vídeo y a un
| toque. Sube desde abajo en el móvil —donde está el pulgar— y sale centrada
| en un ordenador, que es donde hay sitio.
|
| Se cierra sola al elegir. Es un selector, no un panel de trabajo: quien lo
| ha abierto quiere volver al vídeo, y obligar a cerrar a mano después de cada
| toque es un segundo toque por cada corte.
*/
export function SelectorDeMarca({
  jugadores,
  teclas,
  comportamientos,
  categorias,
  sujetoActivo,
  categoriaActiva,
  cuentasJugador,
  cuentasColectivo,
  cuentasCategoria,
  onJugador,
  onColectivo,
  onCategoria,
  onCerrar,
}: {
  jugadores: JugadorCoding[];
  teclas: Record<string, string>;
  comportamientos: ComportamientoColectivo[];
  categorias: CategoriaCoding[];
  sujetoActivo: { tipo: "jugador" | "colectivo"; id: string } | null;
  categoriaActiva: string;
  cuentasJugador: Record<string, number>;
  cuentasColectivo: Record<string, number>;
  cuentasCategoria: Record<string, number>;
  onJugador: (id: string) => void;
  onColectivo: (id: string) => void;
  onCategoria: (id: string) => void;
  onCerrar: () => void;
}) {
  return (
    <div
      /* `modal-veil` y no `bg-black/80`: esa clase de Tailwind arrastra a
         blanco el texto de dentro en modo día (ver `app/globals.css`). */
      className="modal-veil fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Elegir jugador y categoría"
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[85vh] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#11161D] shadow-2xl sm:max-w-[640px] sm:rounded-2xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-white/40">
            De quién es el corte
          </span>

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-w-0 space-y-4 overflow-y-auto p-4">
          <section className="min-w-0">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-white/25">
              Jugadores
            </span>

            <PanelJugadores
              jugadores={jugadores}
              teclas={teclas}
              activo={
                sujetoActivo?.tipo === "jugador" ? sujetoActivo.id : null
              }
              cuentas={cuentasJugador}
              onElegir={(id) => {
                onJugador(id);
                onCerrar();
              }}
            />
          </section>

          {comportamientos.length > 0 && (
            <section className="min-w-0">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-white/25">
                Comportamientos colectivos
              </span>

              <PanelColectivos
                comportamientos={comportamientos}
                activo={
                  sujetoActivo?.tipo === "colectivo" ? sujetoActivo.id : null
                }
                cuentas={cuentasColectivo}
                onElegir={(id) => {
                  onColectivo(id);
                  onCerrar();
                }}
              />
            </section>
          )}

          <section className="min-w-0">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-white/25">
              Categoría · opcional
            </span>

            <PanelCategorias
              categorias={categorias}
              activa={categoriaActiva}
              cuentas={cuentasCategoria}
              onElegir={(id) => {
                onCategoria(id);
                onCerrar();
              }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

export default BarraMarcado;
