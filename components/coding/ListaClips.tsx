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
 */

import { useState } from "react";
import { Copy, Pencil, Play, Scissors, Trash2 } from "lucide-react";

import { Button, Dialog, Field, TextArea } from "@/components/abp/ui";
import {
  duracionClip,
  formateaDuracion,
  formateaMs,
  type CategoriaCoding,
  type ClipCoding,
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
  exportando: boolean;
}) {
  if (clips.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-white/30">
        Todavía no hay clips. Elige un jugador, pulsa <b>I</b> cuando empiece la
        acción y <b>O</b> cuando termine.
      </p>
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.16em] text-white/30">
            <th className="px-2 py-1.5 font-medium">#</th>
            <th className="px-2 py-1.5 font-medium">Jugador</th>
            <th className="px-2 py-1.5 font-medium">Categoría</th>
            <th className="px-2 py-1.5 text-right font-medium">In</th>
            <th className="px-2 py-1.5 text-right font-medium">Out</th>
            <th className="px-2 py-1.5 text-right font-medium">Dur.</th>
            <th className="px-2 py-1.5 text-right font-medium">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {clips.map((clip) => {
            const categoria = categorias.find(
              (una) => una.id === clip.categoriaId,
            );

            const activo = clip.id === seleccionado;

            return (
              <tr
                key={clip.id}
                onClick={() => onSeleccionar(clip.id)}
                className={`cursor-pointer border-t border-white/[0.06] transition ${
                  activo ? "bg-[#C8A96B]/[0.08]" : "hover:bg-white/[0.03]"
                }`}
              >
                <td className="px-2 py-1.5 text-[11px] tabular-nums text-white/35">
                  {String(clip.numero).padStart(3, "0")}
                </td>

                <td className="max-w-[190px] px-2 py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    {clip.jugadorDorsal !== undefined && (
                      <span className="shrink-0 text-[10px] tabular-nums text-white/30">
                        {clip.jugadorDorsal}
                      </span>
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
                </td>

                <td className="px-2 py-1.5">
                  <span
                    className="flex items-center justify-end gap-0.5"
                    onClick={(evento) => evento.stopPropagation()}
                  >
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

export function FichaClip({
  clip,
  jugadores,
  categorias,
  tiempoActualMs,
  onGuardar,
  onCerrar,
}: {
  clip: ClipCoding;
  jugadores: JugadorCoding[];
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
              const jugador = jugadores.find(
                (uno) => uno.id === borrador.jugadorId,
              );

              onGuardar({
                jugadorId: borrador.jugadorId,
                jugadorNombre: jugador?.nombre ?? borrador.jugadorNombre,
                jugadorDorsal: jugador?.dorsal ?? borrador.jugadorDorsal,
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
          label="Jugador"
          value={borrador.jugadorId}
          onChange={(valor) => cambia({ jugadorId: valor })}
          opciones={jugadores.map((jugador) => ({
            valor: jugador.id,
            texto: jugador.nombre,
          }))}
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
