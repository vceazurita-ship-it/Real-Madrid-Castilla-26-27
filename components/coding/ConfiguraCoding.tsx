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

import { Button, Dialog, Field, Notice, sePuedeDescartar } from "@/components/abp/ui";
import {
  CATEGORIAS_INICIALES,
  COMPORTAMIENTOS_INICIALES,
  DESCRIPTORES_INICIALES,
  FASES_CODING,
  TECLAS_RESERVADAS,
  TOPE_DESCRIPTORES,
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

  /* Sólo las de esta convocatoria: ver `teclasRepetidas`. */
  const repetidas = teclasRepetidas(borrador, jugadores);

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

  /* Rehacer las teclas de una plantilla entera es media hora de trabajo: no
     se tira sin preguntar. */
  const sinGuardar = JSON.stringify(borrador) !== JSON.stringify(config);

  return (
    <Dialog
      title="Configuración del coding"
      subtitle="Teclas, categorías y márgenes de los cortes"
      onClose={onCerrar}
      sinGuardar={sinGuardar}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={() => sePuedeDescartar(sinGuardar) && onCerrar()}>
            Cancelar
          </Button>

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
          hint="Se añade delante de cada corte nuevo."
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

      {/* --------------------- MARCA DE UN TOQUE -------------------- */}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field
          label="Un toque · coge antes (s)"
          type="number"
          value={String(borrador.toqueAntesMs / 1000)}
          onChange={(valor) =>
            setBorrador((actual) => ({
              ...actual,
              toqueAntesMs: Math.min(60_000, Math.max(0, Math.round((Number(valor) || 0) * 1000))),
            }))
          }
          hint="Intro marca la acción que acaba de pasar."
        />

        <Field
          label="Un toque · coge después (s)"
          type="number"
          value={String(borrador.toqueDespuesMs / 1000)}
          onChange={(valor) =>
            setBorrador((actual) => ({
              ...actual,
              toqueDespuesMs: Math.min(60_000, Math.max(0, Math.round((Number(valor) || 0) * 1000))),
            }))
          }
          hint="Los márgenes de arriba se suman encima."
        />
      </div>

      {/* ----------------------- DESCRIPTORES ----------------------- */}

      {/*
      | Lo que se dice del corte: bien, mal, al vídeo de grupo. La tecla es la
      | posición (⇧1 el primero), así que no hay campo de tecla que pueda chocar.
      */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white/85">Descriptores</h3>

            <p className="text-[11px] text-white/35">
              Se ponen al último corte (o al elegido) con <b>⇧1</b> … <b>⇧9</b>
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              icon={RotateCcw}
              onClick={() =>
                setBorrador((actual) => ({
                  ...actual,
                  descriptores: DESCRIPTORES_INICIALES,
                }))
              }
            >
              Restaurar
            </Button>

            <Button
              icon={Plus}
              disabled={borrador.descriptores.length >= TOPE_DESCRIPTORES}
              onClick={() =>
                setBorrador((actual) => ({
                  ...actual,
                  descriptores: [
                    ...actual.descriptores,
                    {
                      id: `des-${actual.descriptores.length + 1}-${Date.now().toString(36)}`,
                      nombre: "Nuevo",
                      color: "#CBD5E1",
                    },
                  ],
                }))
              }
            >
              Añadir
            </Button>
          </div>
        </div>

        <ul className="space-y-1.5">
          {borrador.descriptores.map((descriptor, indice) => (
            <li
              key={descriptor.id}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2"
            >
              <span className="w-8 shrink-0 text-center font-mono text-[12px] text-white/50">
                ⇧{indice + 1}
              </span>

              <input
                type="color"
                value={descriptor.color}
                onChange={(evento) =>
                  setBorrador((actual) => ({
                    ...actual,
                    descriptores: actual.descriptores.map((uno) =>
                      uno.id === descriptor.id
                        ? { ...uno, color: evento.target.value }
                        : uno,
                    ),
                  }))
                }
                className="h-6 w-6 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
                title="Color del descriptor"
              />

              {/* El id no sigue al nombre: ver la nota de las categorías. */}
              <input
                value={descriptor.nombre}
                aria-label={`Nombre del descriptor ⇧${indice + 1}`}
                onChange={(evento) =>
                  setBorrador((actual) => ({
                    ...actual,
                    descriptores: actual.descriptores.map((uno) =>
                      uno.id === descriptor.id
                        ? { ...uno, nombre: evento.target.value }
                        : uno,
                    ),
                  }))
                }
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[13px] text-white outline-none focus:border-[#C8A96B]/50"
              />

              {/*
              | Lo que lee el jugador en el rótulo del vídeo. «Mal» se queda en la
              | tecla, pero en la sala sale «A corregir»; lo interno no sale.
              */}
              <label
                className="flex shrink-0 items-center gap-1 text-[11px] text-white/45"
                title="Si sale en el rótulo del vídeo. Apágalo en lo que es para ti: «Vídeo de grupo», «Repasar»…"
              >
                <input
                  type="checkbox"
                  checked={descriptor.enRotulo !== false}
                  onChange={(evento) =>
                    setBorrador((actual) => ({
                      ...actual,
                      descriptores: actual.descriptores.map((uno) =>
                        uno.id === descriptor.id
                          ? { ...uno, enRotulo: evento.target.checked }
                          : uno,
                      ),
                    }))
                  }
                  className="accent-[#C8A96B]"
                />
                En el vídeo
              </label>

              {descriptor.enRotulo !== false && (
                <input
                  value={descriptor.rotulo ?? ""}
                  placeholder={descriptor.nombre}
                  aria-label={`Cómo se lee ${descriptor.nombre} en el rótulo`}
                  title="Cómo se lee en el rótulo del vídeo; vacío, su nombre"
                  onChange={(evento) =>
                    setBorrador((actual) => ({
                      ...actual,
                      descriptores: actual.descriptores.map((uno) =>
                        uno.id === descriptor.id
                          ? { ...uno, rotulo: evento.target.value }
                          : uno,
                      ),
                    }))
                  }
                  className="w-28 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px] text-white/80 outline-none placeholder:text-white/25 focus:border-[#C8A96B]/50"
                />
              )}

              <button
                type="button"
                title="Quitar el descriptor (los cortes que ya lo llevan lo conservan)"
                aria-label={`Quitar ${descriptor.nombre}`}
                onClick={() =>
                  setBorrador((actual) => ({
                    ...actual,
                    descriptores: actual.descriptores.filter(
                      (uno) => uno.id !== descriptor.id,
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

              {/*
                EL ID NO SE TOCA AL ESCRIBIR EL NOMBRE.
                Se recalculaba a partir del nombre en cada tecla, y como la
                fila lleva `key={categoria.id}`, React desmontaba y volvía a
                montar la fila entera: el campo perdía el foco después de la
                PRIMERA letra, así que escribir «Córner» dejaba una «C». Y dos
                categorías nuevas sin nombre daban las dos `sin-id`, o sea dos
                filas con la misma llave que `cambiaCategoria` editaba a la vez.
                El id que se pone al crearla ya es único y estable, y además es
                el que llevan dentro los clips ya codificados: cambiarlo a
                media edición los dejaría huérfanos.
              */}
              <input
                value={categoria.nombre}
                onChange={(evento) =>
                  cambiaCategoria(categoria.id, { nombre: evento.target.value })
                }
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[13px] text-white outline-none focus:border-[#C8A96B]/50"
              />

              {/* La fase: el primer nivel, por el que se agrupa la matriz. */}
              <select
                value={categoria.fase ?? ""}
                aria-label={`Fase de ${categoria.nombre}`}
                title="La fase del juego a la que pertenece: la matriz agrupa por ella"
                onChange={(evento) =>
                  cambiaCategoria(categoria.id, {
                    fase: evento.target.value || undefined,
                  })
                }
                className="w-[7.5rem] shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-1 text-[12px] text-white/75 outline-none focus:border-[#C8A96B]/50"
              >
                <option value="">Sin fase</option>
                {FASES_CODING.map((fase) => (
                  <option key={fase.id} value={fase.id}>
                    {fase.corto}
                  </option>
                ))}
              </select>

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

              {/* Lo mismo que en las categorías: el id se queda quieto. */}
              <input
                value={uno.nombre}
                onChange={(evento) =>
                  cambiaComportamiento(uno.id, { nombre: evento.target.value })
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
                teclasJugador: reparteTeclas(
                  jugadores,
                  /*
                  | Se rehace lo de ESTA convocatoria, no el documento entero.
                  |
                  | Con `{}` se vaciaba `teclasJugador` de golpe, y como es un
                  | documento compartido, darle a «Repartir de nuevo» mirando a
                  | un rival borraba también el teclado del Castilla.
                  */
                  Object.fromEntries(
                    Object.entries(actual.teclasJugador).filter(
                      ([id]) => !jugadores.some((uno) => uno.id === id),
                    ),
                  ),
                  actual.categorias.map((una) => una.tecla),
                ),
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

        /*
        | La tecla se queda AQUÍ mientras se está capturando.
        |
        | `Dialog` escucha el Escape en la ventana, así que el Escape con el que
        | se cancelaba la captura de una tecla llegaba también allí y CERRABA LA
        | CONFIGURACIÓN ENTERA: media hora repartiendo el teclado de una
        | plantilla, tirada por arrepentirse de una tecla. Y la barra espaciadora
        | o una letra podían activar un botón de detrás.
        */
        evento.stopPropagation();

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
