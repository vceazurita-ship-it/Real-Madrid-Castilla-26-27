"use client";

/**
 * CODING · configuración.
 *
 * Las teclas son la herramienta de trabajo, así que se cambian aquí y no en un
 * fichero: cada analista se reparte los jugadores como los tiene en la cabeza
 * —el 9 en la tecla 9, el central zurdo en la z— y las categorías igual.
 *
 * Dos avisos, porque las dos cosas rompen el coding en silencio: una tecla
 * repetida (dos jugadores que responden a la misma) y una tecla que el
 * reproductor ya usa —`I`, `O`, `J`, `K`, `L`, espacio—, que dejaría de marcar
 * el INICIO para seleccionar a alguien.
 *
 * Los comportamientos colectivos se salvan de las dos: van con `⇧` delante, en
 * un teclado propio donde no estorban a nadie, así que sólo pueden chocar
 * entre ellos.
 */

import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button, Dialog, Field, Notice } from "@/components/abp/ui";
import {
  CATEGORIAS_INICIALES,
  COMPORTAMIENTOS_INICIALES,
  TECLAS_RESERVADAS,
  apodoCoding,
  reparteTeclas,
  teclasRepetidas,
  type CategoriaCoding,
  type ComportamientoColectivo,
  type ConfigCoding,
  type JugadorCoding,
} from "@/lib/coding/modelo";

export function ConfiguraCoding({
  config,
  jugadores,
  onGuardar,
  onCerrar,
}: {
  config: ConfigCoding;
  jugadores: JugadorCoding[];
  onGuardar: (config: ConfigCoding) => void;
  onCerrar: () => void;
}) {
  const [borrador, setBorrador] = useState<ConfigCoding>(config);

  const repetidas = teclasRepetidas(borrador);

  const reservadas = [
    ...Object.values(borrador.teclasJugador),
    ...borrador.categorias.map((categoria) => categoria.tecla),
  ].filter((tecla) => tecla && TECLAS_RESERVADAS.includes(tecla.toLowerCase()));

  const cambiaCategoria = (id: string, cambios: Partial<CategoriaCoding>) =>
    setBorrador((actual) => ({
      ...actual,
      categorias: actual.categorias.map((categoria) =>
        categoria.id === id ? { ...categoria, ...cambios } : categoria,
      ),
    }));

  const cambiaComportamiento = (
    id: string,
    cambios: Partial<ComportamientoColectivo>,
  ) =>
    setBorrador((actual) => ({
      ...actual,
      comportamientos: actual.comportamientos.map((uno) =>
        uno.id === id ? { ...uno, ...cambios } : uno,
      ),
    }));

  return (
    <Dialog
      title="Configuración del coding"
      subtitle="Teclas, categorías y márgenes de los cortes"
      onClose={onCerrar}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onCerrar}>Cancelar</Button>

          <Button tone="primary" onClick={() => onGuardar(borrador)}>
            Guardar
          </Button>
        </div>
      }
    >
      {(repetidas.length > 0 || reservadas.length > 0) && (
        <div className="mb-4">
          <Notice tone="warn" title="Hay teclas que van a dar problemas">
            {repetidas.length > 0 && (
              <p>
                Repetidas: <b>{repetidas.join(", ")}</b>. Responderá siempre la
                primera.
              </p>
            )}

            {reservadas.length > 0 && (
              <p>
                Del reproductor: <b>{[...new Set(reservadas)].join(", ")}</b>.
                Dejarían de marcar el inicio, el final o la velocidad.
              </p>
            )}
          </Notice>
        </div>
      )}

      {/* ------------------------- MÁRGENES ------------------------- */}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Margen antes (ms)"
          type="number"
          value={String(borrador.preRollMs)}
          onChange={(valor) =>
            setBorrador((actual) => ({
              ...actual,
              preRollMs: Math.max(0, Number(valor) || 0),
            }))
          }
          hint="Se añade delante de cada clip nuevo."
        />

        <Field
          label="Margen después (ms)"
          type="number"
          value={String(borrador.postRollMs)}
          onChange={(valor) =>
            setBorrador((actual) => ({
              ...actual,
              postRollMs: Math.max(0, Number(valor) || 0),
            }))
          }
        />

        <Field
          label="Fotogramas por segundo"
          type="number"
          value={String(borrador.fps)}
          onChange={(valor) =>
            setBorrador((actual) => ({
              ...actual,
              fps: Math.max(1, Number(valor) || 25),
            }))
          }
          hint="Lo que avanza cada flecha."
        />
      </div>

      {/* ------------------------ CATEGORÍAS ------------------------ */}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white/85">Categorías</h3>

          <div className="flex gap-2">
            <Button
              icon={RotateCcw}
              onClick={() =>
                setBorrador((actual) => ({
                  ...actual,
                  categorias: CATEGORIAS_INICIALES,
                }))
              }
            >
              Restaurar
            </Button>

            <Button
              icon={Plus}
              onClick={() =>
                setBorrador((actual) => ({
                  ...actual,
                  categorias: [
                    ...actual.categorias,
                    {
                      id: `cat-${actual.categorias.length + 1}-${Date.now().toString(36)}`,
                      nombre: "Nueva",
                      color: "#CBD5E1",
                      tecla: "",
                    },
                  ],
                }))
              }
            >
              Añadir
            </Button>
          </div>
        </div>

        <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {borrador.categorias.map((categoria) => (
            <li
              key={categoria.id}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2"
            >
              <input
                type="color"
                value={categoria.color}
                onChange={(evento) =>
                  cambiaCategoria(categoria.id, { color: evento.target.value })
                }
                className="h-6 w-6 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
                title="Color en la línea de tiempo"
              />

              <input
                value={categoria.nombre}
                onChange={(evento) =>
                  cambiaCategoria(categoria.id, {
                    nombre: evento.target.value,
                    id: categoria.id.startsWith("cat-")
                      ? apodoCoding(evento.target.value)
                      : categoria.id,
                  })
                }
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[13px] text-white outline-none focus:border-[#C8A96B]/50"
              />

              <CampoTecla
                valor={categoria.tecla}
                onChange={(tecla) => cambiaCategoria(categoria.id, { tecla })}
              />

              <button
                type="button"
                title="Quitar la categoría"
                onClick={() =>
                  setBorrador((actual) => ({
                    ...actual,
                    categorias: actual.categorias.filter(
                      (una) => una.id !== categoria.id,
                    ),
                  }))
                }
                className="rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* -------------------- COMPORTAMIENTOS ----------------------- */}

      {/*
      | Lo que hace el equipo, no un jugador: la salida de balón, el repliegue.
      | Se seleccionan con ⇧ delante de su letra, así que pueden repetir las
      | letras de las categorías sin pisarlas —entre jugadores, categorías y las
      | teclas del reproductor no queda ni una libre—.
      */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white/85">
              Comportamientos colectivos
            </h3>

            <p className="text-[11px] text-white/35">
              Se eligen con <b>⇧</b> delante de la letra
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              icon={RotateCcw}
              onClick={() =>
                setBorrador((actual) => ({
                  ...actual,
                  comportamientos: COMPORTAMIENTOS_INICIALES,
                }))
              }
            >
              Restaurar
            </Button>

            <Button
              icon={Plus}
              onClick={() =>
                setBorrador((actual) => ({
                  ...actual,
                  comportamientos: [
                    ...actual.comportamientos,
                    {
                      id: `col-${actual.comportamientos.length + 1}-${Date.now().toString(36)}`,
                      nombre: "Nuevo",
                      color: "#CBD5E1",
                      tecla: "",
                    },
                  ],
                }))
              }
            >
              Añadir
            </Button>
          </div>
        </div>

        <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {borrador.comportamientos.map((uno) => (
            <li
              key={uno.id}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2"
            >
              <input
                type="color"
                value={uno.color}
                onChange={(evento) =>
                  cambiaComportamiento(uno.id, { color: evento.target.value })
                }
                className="h-6 w-6 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
                title="Color del comportamiento"
              />

              <input
                value={uno.nombre}
                onChange={(evento) =>
                  cambiaComportamiento(uno.id, {
                    nombre: evento.target.value,
                    id: uno.id.startsWith("col-")
                      ? apodoCoding(evento.target.value)
                      : uno.id,
                  })
                }
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[13px] text-white outline-none focus:border-[#C8A96B]/50"
              />

              <span className="shrink-0 font-mono text-[11px] text-white/30">
                ⇧
              </span>

              <CampoTecla
                valor={uno.tecla}
                onChange={(tecla) => cambiaComportamiento(uno.id, { tecla })}
              />

              <button
                type="button"
                title="Quitar el comportamiento"
                onClick={() =>
                  setBorrador((actual) => ({
                    ...actual,
                    comportamientos: actual.comportamientos.filter(
                      (otro) => otro.id !== uno.id,
                    ),
                  }))
                }
                className="rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ------------------------- JUGADORES ------------------------ */}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white/85">
            Teclas de los jugadores
          </h3>

          <Button
            icon={RotateCcw}
            onClick={() =>
              setBorrador((actual) => ({
                ...actual,
                teclasJugador: reparteTeclas(jugadores, {}),
              }))
            }
          >
            Repartir de nuevo
          </Button>
        </div>

        <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {jugadores.map((jugador) => (
            <li
              key={jugador.id}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-white/75">
                {jugador.dorsal !== undefined && (
                  <span className="mr-2 text-[11px] tabular-nums text-white/30">
                    {jugador.dorsal}
                  </span>
                )}
                {jugador.nombre}
              </span>

              <CampoTecla
                valor={borrador.teclasJugador[jugador.id] ?? ""}
                onChange={(tecla) =>
                  setBorrador((actual) => ({
                    ...actual,
                    teclasJugador: { ...actual.teclasJugador, [jugador.id]: tecla },
                  }))
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

/**
 * Un campo que se rellena pulsando la tecla, no escribiéndola.
 *
 * Escribir el nombre de una tecla es una fuente de erratas («Espacio», «space»,
 * « »); aquí se pulsa la que se quiere y se guarda esa.
 */
function CampoTecla({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (tecla: string) => void;
}) {
  const [escuchando, setEscuchando] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setEscuchando(true)}
      onBlur={() => setEscuchando(false)}
      onKeyDown={(evento) => {
        if (!escuchando) return;

        evento.preventDefault();

        if (evento.key === "Escape") {
          setEscuchando(false);
          return;
        }

        if (evento.key === "Backspace" || evento.key === "Delete") {
          onChange("");
          setEscuchando(false);
          return;
        }

        if (evento.key.length !== 1) return;

        onChange(evento.key.toLowerCase());
        setEscuchando(false);
      }}
      className={`h-7 w-12 shrink-0 rounded-lg border font-mono text-[12px] uppercase transition ${
        escuchando
          ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
          : "border-white/15 bg-white/[0.06] text-white/70 hover:border-white/30"
      }`}
      title="Pulsa la tecla que quieras asignar; Supr la quita"
    >
      {escuchando ? "…" : valor || "—"}
    </button>
  );
}
