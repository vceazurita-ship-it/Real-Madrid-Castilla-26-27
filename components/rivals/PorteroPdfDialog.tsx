"use client";

/*
|--------------------------------------------------------------------------
| QUIÉN SALE EN EL INFORME DEL PORTERO — PASO PREVIO AL PDF
|--------------------------------------------------------------------------
|
| Se abre al pulsar «PORTERO» en el campograma de `/rivals`. El documento que
| sale es el mismo que el del once probable —misma portada, mismas fichas, los
| mismos saltos internos—, pero no con el equipo entero: con los jugadores que
| el portero tiene que llevarse estudiados.
|
| Por eso aquí sólo se elige **quién entra**. Vienen marcados de casa los
| extremos, los delanteros y las medias puntas del once —titulares y dudas—,
| que son los que le van a tirar; el resto está a un clic, porque un central
| que sube a rematar los córners también es cosa suya.
|
| Se elige entre los que están marcados en el once probable, que es de donde
| sale todo este flujo: quien no esté ni de titular ni de duda no tiene ficha
| que llevarse.
*/

import { useEffect, useMemo, useRef } from "react";

import { Check, FileDown, Loader2, RotateCcw, UserRound, X } from "lucide-react";

import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";

/** Lo que hace falta saber aquí de cada jugador marcado en el once. */
export type PorteroCandidato = {
  clave: string;
  dorsal: string;
  nombre: string;
  posCode: string;
  posicion: string;
  /** Rótulo de su línea ("ATAQUE", "MEDIO CAMPO"…), para agrupar la lista. */
  grupo: string;
  /** Color de su línea, el mismo que lleva en el campograma de la pantalla. */
  color: string;
  foto: string;
  estado: "titular" | "duda";
};

interface PorteroPdfDialogProps {
  equipo: string;
  /** Los del once probable, ya ordenados de portería a ataque. */
  candidatos: PorteroCandidato[];
  /** Los que vienen marcados al abrir: extremos, delanteros y medias puntas. */
  porDefecto: string[];
  /** Lo elegido la última vez en esta sesión. Sin ello mandan los de arriba. */
  elegidos: string[] | null;
  exportando: boolean;
  onCambiar: (claves: string[]) => void;
  onExportar: (claves: string[]) => void;
  onCerrar: () => void;
}

const ESTADO_COLOR: Record<PorteroCandidato["estado"], string> = {
  titular: "#4ADE80",
  duda: "#FBBF24",
};

export default function PorteroPdfDialog({
  equipo,
  candidatos,
  porDefecto,
  elegidos,
  exportando,
  onCambiar,
  onExportar,
  onCerrar,
}: PorteroPdfDialogProps) {
  useBodyScrollLock(true);

  /*
  | La elección vive arriba, en la página, para que no se pierda al cerrar el
  | pop-up y volver a abrirlo. Aquí sólo se resuelve qué hay marcado ahora:
  | mientras no se haya tocado nada manda lo que trae de casa.
  */
  const marcados = useMemo(
    () => new Set(elegidos ?? porDefecto),
    [elegidos, porDefecto],
  );

  const cambiar = (claves: string[]) => onCambiar(claves);

  const alternar = (clave: string) => {
    const siguiente = new Set(marcados);

    if (siguiente.has(clave)) siguiente.delete(clave);
    else siguiente.add(clave);

    /* El orden de la lista, no el de los clics: es el orden en el que van a
       salir las fichas del PDF. */
    cambiar(candidatos.map((c) => c.clave).filter((c) => siguiente.has(c)));
  };

  /* Por líneas, como la lista de la derecha del PDF y como el campograma. */
  const grupos = useMemo(() => {
    const mapa = new Map<string, PorteroCandidato[]>();

    candidatos.forEach((candidato) => {
      const grupo = mapa.get(candidato.grupo);

      if (grupo) grupo.push(candidato);
      else mapa.set(candidato.grupo, [candidato]);
    });

    return [...mapa.entries()];
  }, [candidatos]);

  const total = marcados.size;

  /* Escape cierra, como en el otro pop-up del once. */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };

    window.addEventListener("keydown", alPulsar);

    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  /* Al abrir, el foco al cuerpo: se recorre la lista con el tabulador sin
     tener que pasar antes por toda la página de debajo. */
  const cuerpoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cuerpoRef.current?.focus();
  }, []);

  return (
    <div
      className="modal-veil fixed inset-0 z-50 flex items-center justify-center p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quién sale en el informe del portero"
      onClick={onCerrar}
    >
      <div
        data-export-panel
        className="flex max-h-[96vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11161D] shadow-2xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        {/* CABECERA */}

        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
              PDF PARA EL PORTERO
              {equipo && (
                <span className="ml-2 normal-case tracking-normal text-white/30">
                  · {equipo}
                </span>
              )}
            </h2>

            <p className="mt-1 text-xs text-white/40">
              Elige a quién se lleva estudiado. Vienen marcados los extremos,
              los delanteros y las medias puntas del once —titulares y dudas—;
              quita o añade a quien quieras. Sale el mismo documento que el del
              once, con la ficha entera de cada uno.
            </p>
          </div>

          <button
            type="button"
            data-export-hide
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-full border border-white/10 p-2 text-white/40 transition hover:border-white/30 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* CUERPO */}

        <div
          ref={cuerpoRef}
          tabIndex={-1}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 outline-none"
        >
          {candidatos.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
              No hay nadie marcado en el once probable de este equipo.
            </p>
          ) : (
            grupos.map(([grupo, jugadores]) => (
              <div key={grupo}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  {grupo}
                </p>

                <ul className="mt-2 space-y-1">
                  {jugadores.map((jugador) => {
                    const puesto = marcados.has(jugador.clave);

                    return (
                      <li key={jugador.clave}>
                        <button
                          type="button"
                          data-export-hide
                          onClick={() => alternar(jugador.clave)}
                          aria-pressed={puesto}
                          className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition ${
                            puesto
                              ? "border-[#C8A96B]/40 bg-[#C8A96B]/10"
                              : "border-white/5 bg-black/20 hover:border-white/20"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              puesto
                                ? "border-[#C8A96B] bg-[#C8A96B] text-[#11161D]"
                                : "border-white/20"
                            }`}
                          >
                            {puesto && <Check size={13} strokeWidth={3} />}
                          </span>

                          <span
                            className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border bg-black/40"
                            style={{ borderColor: `${jugador.color}66` }}
                          >
                            {jugador.foto ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={jugador.foto}
                                alt={jugador.nombre}
                                draggable={false}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <UserRound
                                size={16}
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/25"
                              />
                            )}
                          </span>

                          <span className="w-6 shrink-0 text-center text-xs font-semibold text-white/50">
                            {jugador.dorsal || "—"}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-white/85">
                              {jugador.nombre}
                            </span>

                            <span className="block truncate text-[11px] text-white/35">
                              {jugador.posicion || jugador.posCode}
                            </span>
                          </span>

                          <span
                            className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase"
                            style={{
                              borderColor: `${ESTADO_COLOR[jugador.estado]}55`,
                              background: `${ESTADO_COLOR[jugador.estado]}18`,
                              color: ESTADO_COLOR[jugador.estado],
                            }}
                          >
                            {jugador.estado}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* PIE */}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-export-hide
              onClick={() => cambiar(porDefecto)}
              title="Volver a los extremos, delanteros y medias puntas"
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition hover:border-white/30 hover:text-white"
            >
              <RotateCcw size={13} />
              Los de siempre
            </button>

            <button
              type="button"
              data-export-hide
              onClick={() =>
                cambiar(
                  total === candidatos.length
                    ? []
                    : candidatos.map((candidato) => candidato.clave),
                )
              }
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition hover:border-white/30 hover:text-white"
            >
              {total === candidatos.length ? "Ninguno" : "Todos"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-white/35">
              {total} {total === 1 ? "jugador" : "jugadores"}
            </span>

            <button
              type="button"
              data-export-hide
              onClick={() => onExportar([...marcados])}
              disabled={exportando || total === 0}
              title={
                total === 0
                  ? "Marca al menos a un jugador"
                  : "Descargar el PDF del portero"
              }
              className="flex items-center gap-2 rounded-lg border border-[#C8A96B]/40 bg-[#C8A96B]/15 px-4 py-2 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/25 disabled:opacity-50"
            >
              {exportando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileDown size={14} />
              )}
              Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
