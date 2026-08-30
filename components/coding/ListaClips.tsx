"use client";

/**
 * La lista de clips y la ficha para corregirlos.
 *
 * Codificando en directo se falla: se marca tarde, se pulsa el jugador de al
 * lado, se cierra una acción que no era. La regla del módulo es que **nada de
 * eso obliga a rehacer el clip**: se abre la ficha, se cambia lo que sea —el
 * jugador, la categoría, el IN, el OUT, los márgenes— y el resto se recalcula
 * solo.
 *
 * La tabla es densa a propósito: en un partido salen doscientos clips y lo que
 * se necesita es verlos de golpe, no tarjetas grandes con aire.
 *
 * **Y se puede reordenar**: el orden de la lista es el orden en el que salen
 * en el vídeo unificado, así que montar una charla es arrastrar filas. Se
 * arrastra por el asa de la izquierda y también se sube y se baja con los
 * botones —en una tabla de doscientas filas, arrastrar treinta posiciones no
 * hay quien lo haga—. Ver `mueveClip` en `lib/coding/modelo.ts`.
 */

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Pencil,
  Play,
  Scissors,
  Trash2,
} from "lucide-react";

import { Button, Dialog, Field, TextArea } from "@/components/abp/ui";
import {
  duracionClip,
  formateaDuracion,
  formateaMs,
  type CategoriaCoding,
  type ClipCoding,
  type ComportamientoColectivo,
  type JugadorCoding,
} from "@/lib/coding/modelo";

export function ListaClips({
  clips,
  categorias,
  seleccionado,
  onSeleccionar,
  onReproducir,
  onEditar,
  onDuplicar,
  onBorrar,
  onExportar,
  onMover,
  pizarrasDe,
  exportando,
}: {
  clips: ClipCoding[];
  categorias: CategoriaCoding[];
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
  onReproducir: (clip: ClipCoding) => void;
  onEditar: (clip: ClipCoding) => void;
  onDuplicar: (id: string) => void;
  onBorrar: (id: string) => void;
  onExportar: (clip: ClipCoding) => void;
  /** Coloca un clip justo antes o después de otro: es el reordenar. */
  onMover: (id: string, destinoId: string, donde: "antes" | "despues") => void;
  /** Cuántas pizarras se van a quemar en cada clip, por id. */
  pizarrasDe?: (clip: ClipCoding) => number;
  exportando: boolean;
}) {
  /* La fila que se está arrastrando y por dónde va a caer. */
  const [arrastrado, setArrastrado] = useState<string | null>(null);
  const [destino, setDestino] = useState<{
    id: string;
    donde: "antes" | "despues";
  } | null>(null);

  const suelta = () => {
    if (arrastrado && destino && arrastrado !== destino.id) {
      onMover(arrastrado, destino.id, destino.donde);
    }

    setArrastrado(null);
    setDestino(null);
  };

  if (clips.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-white/30">
        Todavía no hay clips. Elige un jugador —o un comportamiento colectivo
        con <b>⇧</b>—, pulsa <b>I</b> cuando empiece la acción y <b>O</b> cuando
        termine.
      </p>
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.16em] text-white/30">
            <th className="w-6 px-1 py-1.5 font-medium" aria-label="Orden" />
            <th className="px-2 py-1.5 font-medium">#</th>
            {/* Jugador o comportamiento colectivo: los dos son el sujeto. */}
            <th className="px-2 py-1.5 font-medium">Quién</th>
            <th className="px-2 py-1.5 font-medium">Categoría</th>
            <th className="px-2 py-1.5 text-right font-medium">In</th>
            <th className="px-2 py-1.5 text-right font-medium">Out</th>
            <th className="px-2 py-1.5 text-right font-medium">Dur.</th>
            <th className="px-2 py-1.5 text-right font-medium">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {clips.map((clip, indice) => {
            const categoria = categorias.find(
              (una) => una.id === clip.categoriaId,
            );

            const activo = clip.id === seleccionado;

            const anterior = clips[indice - 1];
            const siguiente = clips[indice + 1];

            const marca =
              destino && destino.id === clip.id && arrastrado !== clip.id
                ? destino.donde
                : null;

            const pizarras = pizarrasDe?.(clip) ?? 0;

            return (
              <tr
                key={clip.id}
                onClick={() => onSeleccionar(clip.id)}
                onDragOver={(evento) => {
                  if (!arrastrado) return;

                  /* Sin esto el navegador no deja soltar: es la forma de decir
                     que aquí sí se puede. */
                  evento.preventDefault();

                  const caja = evento.currentTarget.getBoundingClientRect();

                  setDestino({
                    id: clip.id,
                    donde:
                      evento.clientY - caja.top < caja.height / 2
                        ? "antes"
                        : "despues",
                  });
                }}
                onDrop={(evento) => {
                  evento.preventDefault();
                  suelta();
                }}
                className={`cursor-pointer border-t transition ${
                  marca === "antes"
                    ? "border-t-2 border-t-[#C8A96B]"
                    : "border-white/[0.06]"
                } ${
                  marca === "despues" ? "border-b-2 border-b-[#C8A96B]" : ""
                } ${arrastrado === clip.id ? "opacity-40" : ""} ${
                  activo ? "bg-[#C8A96B]/[0.08]" : "hover:bg-white/[0.03]"
                }`}
              >
                {/*
                | El asa, y sólo el asa, arrastra.
                |
                | Con la fila entera arrastrable no se puede seleccionar texto
                | de una nota ni pulsar un botón sin que el navegador crea que
                | empieza un arrastre.
                */}
                <td className="w-6 px-1 py-1.5">
                  <span
                    draggable
                    onDragStart={(evento) => {
                      setArrastrado(clip.id);

                      evento.dataTransfer.effectAllowed = "move";
                      /* Firefox no arranca el arrastre sin datos dentro. */
                      evento.dataTransfer.setData("text/plain", clip.id);
                    }}
                    onDragEnd={suelta}
                    onClick={(evento) => evento.stopPropagation()}
                    title="Arrastra para cambiar el orden del vídeo"
                    className="flex cursor-grab justify-center text-white/20 transition hover:text-white/60 active:cursor-grabbing"
                  >
                    <GripVertical size={13} />
                  </span>
                </td>

                <td className="px-2 py-1.5 text-[11px] tabular-nums text-white/35">
                  {String(clip.numero).padStart(3, "0")}
                </td>

                <td className="max-w-[190px] px-2 py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    {/*
                    | Lo colectivo se distingue de un vistazo: en una tabla de
                    | doscientas filas, «Presión alta» entre nombres propios se
                    | lee como si fuera un jugador más.
                    */}
                    {clip.sujeto === "colectivo" ? (
                      <span className="shrink-0 rounded bg-white/[0.08] px-1 text-[9px] uppercase tracking-[0.12em] text-white/40">
                        Col
                      </span>
                    ) : (
                      clip.jugadorDorsal !== undefined && (
                        <span className="shrink-0 text-[10px] tabular-nums text-white/30">
                          {clip.jugadorDorsal}
                        </span>
                      )
                    )}

                    <span className="truncate text-[12px] font-medium text-white/80">
                      {clip.jugadorNombre}
                    </span>

                    {clip.estado === "revisar" && (
                      <span className="shrink-0 rounded-full bg-amber-400/15 px-1.5 text-[9px] uppercase tracking-[0.12em] text-amber-300">
                        Revisar
                      </span>
                    )}
                  </span>
                </td>

                <td className="px-2 py-1.5">
                  {categoria ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-white/60">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: categoria.color }}
                      />
                      {categoria.nombre}
                    </span>
                  ) : (
                    <span className="text-[11px] text-white/20">—</span>
                  )}
                </td>

                <td className="px-2 py-1.5 text-right text-[11px] tabular-nums text-white/50">
                  {formateaMs(clip.codingInicioMs)}
                </td>

                <td className="px-2 py-1.5 text-right text-[11px] tabular-nums text-white/50">
                  {formateaMs(clip.codingFinMs)}
                </td>

                <td className="px-2 py-1.5 text-right text-[11px] tabular-nums text-white/40">
                  {formateaDuracion(duracionClip(clip))}

                  {/* Cuántas pizarras se le van a quemar dentro. */}
                  {pizarras > 0 && (
                    <span
                      title={`${pizarras} ${pizarras === 1 ? "pizarra" : "pizarras"} en este corte`}
                      className="ml-1.5 rounded bg-[#C8A96B]/15 px-1 text-[9px] text-[#C8A96B]"
                    >
                      ✎{pizarras}
                    </span>
                  )}
                </td>

                <td className="px-2 py-1.5">
                  <span
                    className="flex items-center justify-end gap-0.5"
                    onClick={(evento) => evento.stopPropagation()}
                  >
                    <Icono
                      titulo="Subir: sale antes en el vídeo"
                      desactivado={!anterior}
                      onClick={() =>
                        anterior && onMover(clip.id, anterior.id, "antes")
                      }
                    >
                      <ChevronUp size={13} />
                    </Icono>

                    <Icono
                      titulo="Bajar: sale después en el vídeo"
                      desactivado={!siguiente}
                      onClick={() =>
                        siguiente && onMover(clip.id, siguiente.id, "despues")
                      }
                    >
                      <ChevronDown size={13} />
                    </Icono>

                    <Icono
                      titulo="Reproducir el clip"
                      onClick={() => onReproducir(clip)}
                    >
                      <Play size={13} />
                    </Icono>

                    <Icono titulo="Editar" onClick={() => onEditar(clip)}>
                      <Pencil size={13} />
                    </Icono>

                    <Icono
                      titulo="Exportar este clip"
                      onClick={() => onExportar(clip)}
                      desactivado={exportando}
                    >
                      <Scissors size={13} />
                    </Icono>

                    <Icono titulo="Duplicar" onClick={() => onDuplicar(clip.id)}>
                      <Copy size={13} />
                    </Icono>

                    <Icono
                      titulo="Eliminar"
                      tono="peligro"
                      onClick={() => onBorrar(clip.id)}
                    >
                      <Trash2 size={13} />
                    </Icono>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Icono({
  children,
  titulo,
  onClick,
  tono = "normal",
  desactivado = false,
}: {
  children: React.ReactNode;
  titulo: string;
  onClick: () => void;
  tono?: "normal" | "peligro";
  desactivado?: boolean;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={desactivado}
      onClick={onClick}
      className={`rounded-lg p-1.5 transition disabled:opacity-30 ${
        tono === "peligro"
          ? "text-white/35 hover:bg-red-500/10 hover:text-red-300"
          : "text-white/35 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  LA FICHA                                                           */
/* ------------------------------------------------------------------ */

/*
| El sujeto viaja por el desplegable como `jugador:ID` o `colectivo:ID`.
|
| Los dos guardan su identificador en el mismo campo del clip, así que sin el
| prefijo no habría forma de saber cuál de las dos listas mirar —y un jugador y
| un comportamiento podrían llegar a compartir identificador—.
*/
function marcaSujeto(tipo: "jugador" | "colectivo", id: string) {
  return `${tipo}:${id}`;
}

function leeSujeto(valor: string): {
  tipo: "jugador" | "colectivo";
  id: string;
} {
  const corte = valor.indexOf(":");

  if (corte < 0) return { tipo: "jugador", id: valor };

  return {
    tipo: valor.slice(0, corte) === "colectivo" ? "colectivo" : "jugador",
    id: valor.slice(corte + 1),
  };
}

export function FichaClip({
  clip,
  jugadores,
  comportamientos,
  categorias,
  tiempoActualMs,
  onGuardar,
  onCerrar,
}: {
  clip: ClipCoding;
  jugadores: JugadorCoding[];
  comportamientos: ComportamientoColectivo[];
  categorias: CategoriaCoding[];
  /** Por dónde va el vídeo: permite traer el IN o el OUT de donde se está. */
  tiempoActualMs: number;
  onGuardar: (cambios: Partial<ClipCoding>) => void;
  onCerrar: () => void;
}) {
  const [borrador, setBorrador] = useState<ClipCoding>(clip);

  const cambia = (cambios: Partial<ClipCoding>) =>
    setBorrador((actual) => ({ ...actual, ...cambios }));

  const invalido = borrador.codingFinMs <= borrador.codingInicioMs;

  return (
    <Dialog
      title={`Clip ${String(clip.numero).padStart(3, "0")}`}
      subtitle="Se puede corregir todo sin borrar ni volver a marcar"
      onClose={onCerrar}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onCerrar}>Cancelar</Button>

          <Button
            tone="primary"
            disabled={invalido}
            onClick={() => {
              const esColectivo = borrador.sujeto === "colectivo";

              const jugador = esColectivo
                ? null
                : jugadores.find((uno) => uno.id === borrador.jugadorId);

              const comportamiento = esColectivo
                ? comportamientos.find((uno) => uno.id === borrador.jugadorId)
                : null;

              onGuardar({
                sujeto: esColectivo ? "colectivo" : "jugador",
                jugadorId: borrador.jugadorId,
                jugadorNombre:
                  comportamiento?.nombre ??
                  jugador?.nombre ??
                  borrador.jugadorNombre,
                /* Un comportamiento no tiene dorsal, y arrastrar el del jugador
                   que hubiera antes dejaría un «7» delante de «Presión alta». */
                jugadorDorsal: esColectivo
                  ? undefined
                  : (jugador?.dorsal ?? borrador.jugadorDorsal),
                categoriaId: borrador.categoriaId,
                codingInicioMs: borrador.codingInicioMs,
                codingFinMs: borrador.codingFinMs,
                preRollMs: borrador.preRollMs,
                postRollMs: borrador.postRollMs,
                nota: borrador.nota,
                tags: borrador.tags,
                estado: borrador.estado,
              });
            }}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Desplegable
          label="Quién"
          value={marcaSujeto(
            borrador.sujeto === "colectivo" ? "colectivo" : "jugador",
            borrador.jugadorId,
          )}
          onChange={(valor) => {
            const { tipo, id } = leeSujeto(valor);

            cambia({ sujeto: tipo, jugadorId: id });
          }}
          opciones={[
            ...jugadores.map((jugador) => ({
              valor: marcaSujeto("jugador", jugador.id),
              texto: jugador.nombre,
            })),
            ...comportamientos.map((uno) => ({
              valor: marcaSujeto("colectivo", uno.id),
              texto: `Colectivo · ${uno.nombre}`,
            })),
          ]}
        />

        <Desplegable
          label="Categoría"
          value={borrador.categoriaId}
          onChange={(valor) => cambia({ categoriaId: valor })}
          opciones={[
            { valor: "", texto: "Sin categoría" },
            ...categorias.map((categoria) => ({
              valor: categoria.id,
              texto: categoria.nombre,
            })),
          ]}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Tiempo
          label="Inicio de la acción"
          ms={borrador.codingInicioMs}
          onChange={(ms) => cambia({ codingInicioMs: ms })}
          onDesdeVideo={() => cambia({ codingInicioMs: tiempoActualMs })}
        />

        <Tiempo
          label="Final de la acción"
          ms={borrador.codingFinMs}
          onChange={(ms) => cambia({ codingFinMs: ms })}
          onDesdeVideo={() => cambia({ codingFinMs: tiempoActualMs })}
        />
      </div>

      {invalido && (
        <p className="mt-2 text-[11px] text-red-300">
          El final tiene que ir después del inicio.
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field
          label="Margen antes (ms)"
          type="number"
          value={String(borrador.preRollMs)}
          onChange={(valor) => cambia({ preRollMs: Math.max(0, Number(valor) || 0) })}
          hint="Lo que se añade al corte por delante."
        />

        <Field
          label="Margen después (ms)"
          type="number"
          value={String(borrador.postRollMs)}
          onChange={(valor) => cambia({ postRollMs: Math.max(0, Number(valor) || 0) })}
        />
      </div>

      <div className="mt-3">
        <TextArea
          label="Nota"
          value={borrador.nota}
          onChange={(valor) => cambia({ nota: valor })}
          placeholder="Buen perfil corporal"
          rows={2}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field
          label="Etiquetas"
          value={borrador.tags.join(", ")}
          onChange={(valor) =>
            cambia({
              tags: valor
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            })
          }
          hint="Separadas por comas: perfil, pase, progresión."
        />

        <Desplegable
          label="Estado"
          value={borrador.estado}
          onChange={(valor) =>
            cambia({ estado: valor === "revisar" ? "revisar" : "ok" })
          }
          opciones={[
            { valor: "ok", texto: "Listo" },
            { valor: "revisar", texto: "Para revisar" },
          ]}
        />
      </div>
    </Dialog>
  );
}

function Desplegable({
  label,
  value,
  onChange,
  opciones,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  opciones: { valor: string; texto: string }[];
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>

      <select
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor} className="bg-[#11161C]">
            {opcion.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Un instante del vídeo: se lee escrito y se ajusta a saltos de décima. */
function Tiempo({
  label,
  ms,
  onChange,
  onDesdeVideo,
}: {
  label: string;
  ms: number;
  onChange: (ms: number) => void;
  onDesdeVideo: () => void;
}) {
  const paso = (delta: number) => onChange(Math.max(0, ms + delta));

  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>

      <div className="flex items-center gap-1.5">
        <span className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-sm tabular-nums text-white">
          {formateaMs(ms)}
        </span>

        <button
          type="button"
          title="Cien milisegundos antes"
          onClick={() => paso(-100)}
          className="rounded-lg border border-white/10 px-2 py-2 text-[11px] text-white/50 transition hover:text-white"
        >
          −
        </button>

        <button
          type="button"
          title="Cien milisegundos después"
          onClick={() => paso(100)}
          className="rounded-lg border border-white/10 px-2 py-2 text-[11px] text-white/50 transition hover:text-white"
        >
          +
        </button>

        <button
          type="button"
          title="Traer el instante en el que está el vídeo"
          onClick={onDesdeVideo}
          className="rounded-lg border border-white/10 px-2 py-2 text-[10px] uppercase tracking-[0.12em] text-white/50 transition hover:text-white"
        >
          Aquí
        </button>
      </div>
    </div>
  );
}
