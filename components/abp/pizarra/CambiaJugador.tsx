"use client";

/**
 * Cambiar a un jugador por otro en toda la jornada.
 *
 * Se cae uno del once a mitad de semana y entra otro que hace lo mismo: remata
 * donde remataba el que sale, marca a quien marcaba. Aquí se elige **quién
 * sale** —de los que ya están en la pizarra, con el que más sale primero— y
 * **quién entra** —de la plantilla, buscando por nombre, apodo o dorsal—, y
 * antes de aplicar se dice cuántas fichas y qué diapositivas van a cambiar.
 *
 * Si el que entra ya estaba en alguna diapositiva, sustituir sin más le haría
 * salir dos veces. Para eso está «intercambiarlos», que viene marcado cuando
 * hay choque: el que sale se queda con lo que tenía el que entra.
 */

import { useMemo, useState } from "react";
import { ArrowRight, Repeat, Search } from "lucide-react";

import { Button, Dialog } from "@/components/abp/ui";
import type { Player } from "@/types/player";
import {
  alcanceDelCambio,
  jugadoresDelTablero,
  type TableroPizarra,
} from "@/lib/abp/pizarra";

const normaliza = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function CambiaJugador({
  tablero,
  players,
  inicial,
  onAplicar,
  onCerrar,
}: {
  tablero: TableroPizarra;
  players: Player[];
  /** El que sale, si se abre desde una ficha o un aviso concreto. */
  inicial?: string | null;
  onAplicar: (sale: string, entra: string, intercambia: boolean) => void;
  onCerrar: () => void;
}) {
  const porId = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const enLaPizarra = useMemo(() => jugadoresDelTablero(tablero), [tablero]);

  const [sale, setSale] = useState<string | null>(() =>
    inicial && enLaPizarra.some((item) => item.playerId === inicial) ? inicial : null,
  );

  const [entra, setEntra] = useState<string | null>(null);

  const [busca, setBusca] = useState("");

  /* `null` = lo que toque según haya choque o no; se fija en cuanto se toca. */
  const [intercambiaPedido, setIntercambiaPedido] = useState<boolean | null>(null);

  /* Sin intercambio: es lo que dice si los dos coinciden en alguna diapositiva. */
  const alcanceSimple = useMemo(
    () => (sale && entra ? alcanceDelCambio(tablero, sale, entra) : null),
    [tablero, sale, entra],
  );

  const entraYaEsta = Boolean(
    entra && enLaPizarra.some((item) => item.playerId === entra),
  );

  const intercambia =
    entraYaEsta && (intercambiaPedido ?? (alcanceSimple?.choques.length ?? 0) > 0);

  /*
  | Y el alcance de VERDAD, que es el que se enseña y el que se confirma.
  |
  | Intercambiando se tocan también las diapositivas donde sólo está el que
  | entra, así que el botón decía «cambiar en 3 diapositivas» y cambiaba siete.
  */
  const alcance = useMemo(
    () => (sale && entra ? alcanceDelCambio(tablero, sale, entra, intercambia) : null),
    [tablero, sale, entra, intercambia],
  );

  const candidatos = useMemo(() => {
    const query = normaliza(busca.trim());

    return players.filter((player) => {
      if (player.id === sale) return false;

      if (!query) return true;

      return (
        normaliza(player.nombre).includes(query) ||
        normaliza(player.apodo ?? "").includes(query) ||
        String(player.dorsal ?? "").includes(query)
      );
    });
  }, [players, busca, sale]);

  const nombre = (playerId: string | null) => {
    if (!playerId) return "";

    const player = porId.get(playerId);

    return player?.apodo || player?.nombre || playerId;
  };

  const cara = (playerId: string) => {
    const player = porId.get(playerId);

    return player?.foto ? (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={player.foto}
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover object-top"
      />
    ) : (
      <span className="h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.04]" />
    );
  };

  const listo = Boolean(sale && entra && alcance && alcance.fichas > 0);

  return (
    <Dialog
      title="Cambiar a un jugador"
      subtitle="Entra otro en su sitio en todas las diapositivas de esta jornada"
      onClose={onCerrar}
      footer={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>

          <Button
            tone="primary"
            icon={Repeat}
            disabled={!listo}
            onClick={() => sale && entra && onAplicar(sale, entra, intercambia)}
          >
            {listo && alcance
              ? `Cambiar en ${alcance.slides.length} ${
                  alcance.slides.length === 1 ? "diapositiva" : "diapositivas"
                }`
              : "Cambiar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* El cambio, en una línea: lo que se va a hacer antes de hacerlo. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
          <span className={sale ? "font-semibold text-white" : "text-white/35"}>
            {sale ? nombre(sale) : "Quién sale"}
          </span>

          <ArrowRight size={14} className="shrink-0 text-[#C8A96B]" />

          <span className={entra ? "font-semibold text-white" : "text-white/35"}>
            {entra ? nombre(entra) : "Quién entra"}
          </span>
        </div>

        {alcance && (
          <div className="space-y-2 text-[12px] leading-relaxed">
            {alcance.fichas === 0 ? (
              <p className="text-white/45">
                {nombre(sale)} no está en ninguna diapositiva de esta jornada.
              </p>
            ) : (
              <p className="text-white/60">
                Cambian{" "}
                <strong className="text-white">
                  {alcance.fichas} {alcance.fichas === 1 ? "ficha" : "fichas"}
                </strong>{" "}
                en {alcance.slides.length} de {tablero.slides.length} diapositivas:{" "}
                <span className="text-white/40">
                  {alcance.slides.map((slide) => slide.titulo).join(" · ")}
                </span>
                . Cada una conserva su puesto y su sitio en el campo.
              </p>
            )}

            {entraYaEsta && (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-white/70">
                <input
                  type="checkbox"
                  checked={intercambia}
                  onChange={(event) => setIntercambiaPedido(event.target.checked)}
                  className="mt-0.5 accent-[#C8A96B]"
                />

                <span>
                  {nombre(entra)} ya está en la pizarra
                  {alcance.choques.length > 0
                    ? `, y en ${alcance.choques.length} de esas diapositivas saldría dos veces`
                    : ""}
                  .{" "}
                  <strong className="text-white/85">Intercambiarlos</strong>:{" "}
                  {nombre(sale)} se queda con lo que tenía {nombre(entra)}.
                </span>
              </label>
            )}
          </div>
        )}

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {/* ---------------------------- SALE --------------------------- */}
          <div className="min-w-0">
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
              Sale · los que están en la pizarra
            </p>

            {enLaPizarra.length === 0 ? (
              <p className="px-1 py-4 text-xs text-white/35">
                Todavía no hay nadie colocado en esta jornada.
              </p>
            ) : (
              <div className="grid max-h-[38vh] gap-1.5 overflow-y-auto pr-1">
                {enLaPizarra.map((item) => {
                  const player = porId.get(item.playerId);

                  const activo = item.playerId === sale;

                  return (
                    <button
                      key={item.playerId}
                      type="button"
                      onClick={() => {
                        setSale(item.playerId);

                        if (entra === item.playerId) setEntra(null);
                      }}
                      className={`flex w-full min-w-0 items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition ${
                        activo
                          ? "border-[#C8A96B] bg-[#C8A96B]/10"
                          : "border-white/10 hover:border-white/30 hover:bg-white/[0.05]"
                      }`}
                    >
                      {cara(item.playerId)}

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">
                          {nombre(item.playerId)}
                        </span>

                        <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-white/35">
                          {player?.dorsal ? `${player.dorsal} · ` : ""}
                          {player ? player.posicion : "ya no está en la plantilla"}
                        </span>
                      </span>

                      <span
                        className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white/55"
                        title={`Sale en ${item.slides} de ${tablero.slides.length} diapositivas`}
                      >
                        {item.slides}/{tablero.slides.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ---------------------------- ENTRA -------------------------- */}
          <div className="min-w-0">
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
              Entra · de la plantilla
            </p>

            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />

              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Nombre, apodo o dorsal…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
              />
            </div>

            <div className="mt-2 grid max-h-[32vh] gap-1.5 overflow-y-auto pr-1">
              {candidatos.map((player) => {
                const activo = player.id === entra;

                const yaEsta = enLaPizarra.find((item) => item.playerId === player.id);

                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => setEntra(player.id)}
                    className={`flex w-full min-w-0 items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition ${
                      activo
                        ? "border-[#C8A96B] bg-[#C8A96B]/10"
                        : "border-white/10 hover:border-white/30 hover:bg-white/[0.05]"
                    }`}
                  >
                    {cara(player.id)}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">
                        {player.apodo || player.nombre}
                      </span>

                      <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-white/35">
                        {player.dorsal ? `${player.dorsal} · ` : ""}
                        {player.posicion}
                      </span>
                    </span>

                    {yaEsta && (
                      <span
                        className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/50"
                        title="Ya está en la pizarra"
                      >
                        en {yaEsta.slides}
                      </span>
                    )}
                  </button>
                );
              })}

              {candidatos.length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-white/35">
                  Nadie con ese nombre en la plantilla.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
