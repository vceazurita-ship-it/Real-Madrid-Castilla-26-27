"use client";

/**
 * Quién ocupa un puesto —o quiénes ocupan una posición entera—.
 *
 * Se abre al pulsar un hueco del campo o una línea del panel. Arriba salen los
 * **habituales**: los que ya han ocupado ese puesto otras veces, por orden de
 * prioridad y con las veces que lo han hecho. Es lo que la app ha aprendido, y
 * verlo aquí es lo que hace que «colocar automáticamente» no sea una caja
 * negra: se elige lo mismo que propondría el botón, pero a mano.
 *
 * Debajo, el resto de la plantilla, buscable. Los que ya están en otro puesto
 * de esta misma diapositiva salen marcados: se pueden elegir igual —a veces se
 * quiere mover a alguien de sitio— pero se avisa de dónde está.
 *
 * **Por grupo.** Cuando la plantilla dice que esa posición se elige entera
 * (`elegirEnGrupo`), el diálogo deja de ir de un hueco y va del sitio: se
 * marcan varios de una vez, se ven en el orden en que se han marcado y al
 * guardar caen en los puestos del grupo por ese orden. Es lo que pide una
 * falta directa —no se decide «el lanzador 2 del lado izquierdo», se decide
 * quién tira desde la izquierda y en qué orden— y los marcados se pintan todos
 * en el campo.
 */

import { useMemo, useState } from "react";
import { Check, Search, Star, Trash2 } from "lucide-react";

import { Button, Dialog } from "@/components/abp/ui";
import type { Player } from "@/types/player";
import { siglaDe, type MemoriaPuesto, type PuestoAbp } from "@/lib/abp/pizarra";

const normaliza = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function SelectorJugador({
  puesto,
  grupo,
  players,
  memoria,
  /** playerId → código del puesto que ya ocupa en esta diapositiva. */
  ocupadoPor,
  actual,
  elegidos,
  onElegir,
  onGuardarGrupo,
  onQuitar,
  onCerrar,
}: {
  puesto: PuestoAbp;
  /** La posición entera, cuando se eligen varios de una vez. */
  grupo?: { key: string; label: string; puestos: PuestoAbp[] };
  players: Player[];
  memoria: MemoriaPuesto[];
  ocupadoPor: Map<string, string>;
  actual: string | null;
  /** Quiénes ocupan ya el grupo, por orden de puesto. */
  elegidos?: string[];
  onElegir: (playerId: string) => void;
  onGuardarGrupo?: (playerIds: string[]) => void;
  onQuitar: () => void;
  onCerrar: () => void;
}) {
  const [busca, setBusca] = useState("");

  /* Lo marcado vive aquí hasta que se guarda: elegir por grupo es una
     decisión de tres nombres y tiene que poder deshacerse antes de aplicarla. */
  const [marcados, setMarcados] = useState<string[]>(() => elegidos ?? []);

  const limite = grupo ? grupo.puestos.length : 1;

  const alterna = (playerId: string) =>
    setMarcados((previos) =>
      previos.includes(playerId)
        ? previos.filter((id) => id !== playerId)
        : previos.length >= limite
          ? previos
          : [...previos, playerId],
    );

  const porId = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  /* Los habituales que siguen en la plantilla: la memoria es de temporadas. */
  const habituales = useMemo(
    () =>
      memoria
        .map((item) => ({ item, player: porId.get(item.playerId) }))
        .filter((fila): fila is { item: MemoriaPuesto; player: Player } =>
          Boolean(fila.player),
        )
        .slice(0, 6),
    [memoria, porId],
  );

  const resto = useMemo(() => {
    const query = normaliza(busca.trim());

    return players.filter((player) => {
      if (!query) return true;

      return (
        normaliza(player.nombre).includes(query) ||
        normaliza(player.apodo ?? "").includes(query) ||
        String(player.dorsal ?? "").includes(query)
      );
    });
  }, [players, busca]);

  const Fila = ({
    player,
    veces,
  }: {
    player: Player;
    veces?: number;
  }) => {
    const donde = ocupadoPor.get(player.id);

    const orden = grupo ? marcados.indexOf(player.id) : -1;

    const esActual = grupo ? orden >= 0 : player.id === actual;

    /* Con el cupo lleno, los que no están marcados dejan de responder: es más
       honesto que aceptar el clic y tirar al último en silencio. */
    const bloqueado = Boolean(grupo) && orden < 0 && marcados.length >= limite;

    return (
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => (grupo ? alterna(player.id) : onElegir(player.id))}
        title={
          bloqueado
            ? `Ya hay ${limite}: quita a alguien para poner a otro`
            : undefined
        }
        className={`flex w-full min-w-0 items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition ${
          esActual
            ? "border-[#C8A96B] bg-[#C8A96B]/10"
            : bloqueado
              ? "border-white/5 opacity-40"
              : "border-white/10 hover:border-white/30 hover:bg-white/[0.05]"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={player.foto}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover object-top"
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">
            {player.apodo || player.nombre}
          </span>

          <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-white/35">
            {player.dorsal ? `${player.dorsal} · ` : ""}
            {player.posicion}
          </span>
        </span>

        {veces != null && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#C8A96B]/15 px-2 py-0.5 text-[10px] font-semibold text-[#C8A96B]"
            title={`Ha ocupado este puesto ${veces} ${veces === 1 ? "vez" : "veces"}`}
          >
            <Star size={10} />
            {veces}
          </span>
        )}

        {/*
        | Marcado: la chapa que le va a tocar en el campo, no un simple visto.
        | En una directa el orden ES la decisión, y así se lee sin contar filas.
        */}
        {grupo && orden >= 0 && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#C8A96B] px-2 py-0.5 text-[10px] font-bold text-black"
            title={grupo.puestos[orden].label}
          >
            <Check size={10} />
            {siglaDe(grupo.puestos[orden])}
          </span>
        )}

        {donde && !esActual && (
          <span
            className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/50"
            title="Ya está en otro puesto de esta diapositiva"
          >
            {donde}
          </span>
        )}
      </button>
    );
  };

  return (
    <Dialog
      title={grupo ? grupo.label : `${puesto.code} · ${puesto.label}`}
      subtitle={
        grupo
          ? `Quiénes lanzan desde aquí, por orden — hasta ${limite}`
          : "Quién ocupa este puesto"
      }
      onClose={onCerrar}
      footer={
        grupo ? (
          <>
            {marcados.length > 0 && (
              <Button
                tone="danger"
                icon={Trash2}
                onClick={() => setMarcados([])}
              >
                Dejar vacío
              </Button>
            )}

            <Button onClick={onCerrar}>Cancelar</Button>

            <Button tone="primary" onClick={() => onGuardarGrupo?.(marcados)}>
              Guardar
            </Button>
          </>
        ) : (
          <>
            {actual && (
              <Button tone="danger" icon={Trash2} onClick={onQuitar}>
                Dejar vacío
              </Button>
            )}

            <Button onClick={onCerrar}>Cerrar</Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {/* Lo marcado, en fila y en orden: la decisión, antes de guardarla. */}
        {grupo && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              {marcados.length}/{limite} elegidos
            </span>

            {marcados.map((playerId, indice) => (
              <button
                key={playerId}
                type="button"
                onClick={() => alterna(playerId)}
                title="Quitar de la lista"
                className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2 py-0.5 text-[11px] text-white/85 transition hover:border-red-400/60"
              >
                <span className="font-bold text-[#C8A96B]">
                  {siglaDe(grupo.puestos[indice])}
                </span>

                <span className="truncate">
                  {porId.get(playerId)?.apodo ??
                    porId.get(playerId)?.nombre ??
                    playerId}
                </span>
              </button>
            ))}

            {marcados.length === 0 && (
              <span className="text-[11px] text-white/30">
                Nadie todavía: marca abajo a quien lanza.
              </span>
            )}
          </div>
        )}

        {habituales.length > 0 && (
          <div className="min-w-0">
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
              {grupo ? "Habituales en esta posición" : "Habituales en este puesto"}
            </p>

            <div className="grid gap-1.5 sm:grid-cols-2">
              {habituales.map(({ item, player }) => (
                <Fila key={player.id} player={player} veces={item.veces} />
              ))}
            </div>
          </div>
        )}

        <div className="min-w-0">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />

            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar en la plantilla…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
            />
          </div>

          <div className="mt-2 grid max-h-[42vh] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {resto.map((player) => (
              <Fila key={player.id} player={player} />
            ))}

            {resto.length === 0 && (
              <p className="col-span-full px-1 py-4 text-center text-xs text-white/35">
                Nadie con ese nombre.
              </p>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
