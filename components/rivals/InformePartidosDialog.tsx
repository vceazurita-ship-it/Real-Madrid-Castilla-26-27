"use client";

/*
|--------------------------------------------------------------------------
| QUÉ PARTIDOS VAN AL INFORME — PASO PREVIO AL EDITOR
|--------------------------------------------------------------------------
|
| Se abre al pulsar «INFORME» en `/rivals`, antes de montar nada. Aquí sólo se
| decide una cosa: **de qué partidos del rival se dibujan las hojas de
| partidos**, las que llevan los dos campogramas —el once de salida y el de
| después de los cambios—, la convocatoria y los goles.
|
| Antes iban siempre los últimos que hubiera bajados, hasta seis, y salían tres
| hojas. Con la pretemporada de por medio eso son dos hojas de amistosos que a
| nadie le interesan, y el partido que de verdad se estudia —el último de liga,
| o el de su campo si se va allí— quedaba en la tercera. Ahora se marcan, y por
| defecto vienen marcados los cuatro últimos **de liga**, que es lo que se pide
| casi siempre: cuatro partidos son dos diapositivas, la 9 y la 10.
|
| El orden no lo pone quien pulsa: es siempre del más reciente al más antiguo,
| que es como se lee el documento.
*/

import { useEffect, useMemo, useRef, useState } from "react";

import { Check, FileDown, Loader2, RotateCcw, X } from "lucide-react";

import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";

import {
  FILAS_TIPOLOGIA,
  FILA_PROPIA,
  TIPOLOGIA_VACIA,
  claveTipologia,
  normalizaTipologia,
  sumaColumna,
  type TipologiaManual,
} from "@/lib/rivals/tipologia";
import {
  PROPUESTA_VACIA,
  mezclaTipologia,
  traePropuestaTipologia,
  type PropuestaTipologia,
} from "@/lib/rivals/tipologia-wyscout";

/** Un partido de los que tienen alineación bajada, que son los elegibles. */
export type PartidoElegible = {
  /** El `partidoId` del once: es la clave que viaja al informe. */
  id: string;
  /** "12 sep", ya formateada. */
  fecha: string;
  /** "Primera Federación", "Partidos Amistosos"… tal cual la da BeSoccer. */
  competicion: string;
  /** Cuenta para la tabla: lo que no lo es se marca aparte. */
  deLiga: boolean;
  /** El otro equipo. */
  rival: string;
  enCasa: boolean;
  /** "2-1", o "—" si no hay marcador. */
  marcador: string;
  resultado: "" | "G" | "E" | "P";
};

interface InformePartidosDialogProps {
  equipo: string;
  /**
   * Los goles de jugada que cuenta BeSoccer, a favor y en contra.
   *
   * Es lo que reparte la propuesta de Wyscout: los penaltis y las propias
   * puertas los pinta sola la diapositiva, y repartirlos otra vez los
   * duplicaría. Sin esto, la propuesta reparte los goles de los informes de
   * Wyscout, que son menos partidos.
   */
  golesDeJugada?: { aFavor: number; enContra: number };
  /** Del más reciente al más antiguo, ya cruzados con sus alineaciones. */
  partidos: PartidoElegible[];
  /** Los `id` marcados ahora mismo. */
  elegidos: string[];
  /** Los que se marcan solos y a los que vuelve «Los de siempre». */
  porDefecto: string[];
  /** Tope de partidos: seis son tres hojas, y más no cabe en el documento. */
  maximo: number;
  montando: boolean;
  onCambiar: (ids: string[]) => void;
  onMontar: (ids: string[]) => void;
  onCerrar: () => void;
}

const TINTA_RESULTADO: Record<string, string> = {
  G: "#4ADE80",
  E: "#FBBF24",
  P: "#F87171",
};

export default function InformePartidosDialog({
  equipo,
  golesDeJugada,
  partidos,
  elegidos,
  porDefecto,
  maximo,
  montando,
  onCambiar,
  onMontar,
  onCerrar,
}: InformePartidosDialogProps) {
  useBodyScrollLock(true);

  const marcados = useMemo(() => new Set(elegidos), [elegidos]);

  /* El orden de la lista, no el de los clics: es el orden en el que van a
     salir las hojas. */
  const enOrden = (siguiente: Set<string>) =>
    partidos.map((partido) => partido.id).filter((id) => siguiente.has(id));

  const alternar = (id: string) => {
    const siguiente = new Set(marcados);

    if (siguiente.has(id)) siguiente.delete(id);
    else if (siguiente.size >= maximo) return;
    else siguiente.add(id);

    onCambiar(enOrden(siguiente));
  };

  const total = marcados.size;

  const hojas = Math.ceil(total / 2);

  /* Escape cierra, como en los otros pop-ups de la pantalla. */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };

    window.addEventListener("keydown", alPulsar);

    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  const cuerpoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cuerpoRef.current?.focus();
  }, []);

  return (
    <div
      className="modal-veil fixed inset-0 z-50 flex items-center justify-center p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Qué partidos van al informe del rival"
      onClick={onCerrar}
    >
      <div
        data-export-panel
        className="flex max-h-[96vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11161D] shadow-2xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        {/* CABECERA */}

        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
              PARTIDOS DEL INFORME
              {equipo && (
                <span className="ml-2 normal-case tracking-normal text-white/30">
                  · {equipo}
                </span>
              )}
            </h2>

            <p className="mt-1 text-xs text-white/40">
              Elige de qué partidos se dibujan las hojas de partidos —once de
              salida, once tras los cambios, convocatoria y goles—. Van dos por
              diapositiva: cuatro partidos son las diapositivas 9 y 10. Vienen
              marcados los últimos de liga.
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
          className="min-h-0 flex-1 overflow-y-auto p-4 outline-none"
        >
          {partidos.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
              No hay alineaciones bajadas de este equipo. Se descargan con
              «node scripts/rivals-informe.mjs».
            </p>
          ) : (
            <ul className="space-y-1">
              {partidos.map((partido) => {
                const puesto = marcados.has(partido.id);

                /* Lleno y sin marcar: el clic no haría nada, y se dice. */
                const bloqueado = !puesto && total >= maximo;

                return (
                  <li key={partido.id}>
                    <button
                      type="button"
                      data-export-hide
                      onClick={() => alternar(partido.id)}
                      aria-pressed={puesto}
                      disabled={bloqueado}
                      title={
                        bloqueado
                          ? `Ya hay ${maximo} partidos marcados: quita uno antes`
                          : undefined
                      }
                      className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                        puesto
                          ? "border-[#C8A96B]/40 bg-[#C8A96B]/10"
                          : bloqueado
                            ? "cursor-not-allowed border-white/5 bg-black/20 opacity-40"
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
                        className="w-7 shrink-0 text-center text-sm font-bold"
                        style={{
                          color: TINTA_RESULTADO[partido.resultado] ?? "#94A3B8",
                        }}
                      >
                        {partido.resultado || "·"}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white/85">
                          {partido.enCasa ? "vs" : "@"} {partido.rival}
                        </span>

                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                          {/* Liga o no liga, que es lo primero que se mira
                              para decidir si el partido sirve de referencia. */}
                          <span
                            className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider ${
                              partido.deLiga
                                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            {partido.deLiga ? "Liga" : "No liga"}
                          </span>

                          <span className="truncate text-white/35">
                            {partido.competicion}
                          </span>

                          <span className="text-white/25">·</span>

                          <span className="text-white/35">{partido.fecha}</span>
                        </span>
                      </span>

                      <span className="shrink-0 text-base font-bold tabular-nums text-white/70">
                        {partido.marcador}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <TipologiaEditor equipo={equipo} golesDeJugada={golesDeJugada} />
        </div>

        {/* PIE */}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-3 sm:p-4">
          <button
            type="button"
            data-export-hide
            onClick={() => onCambiar(porDefecto)}
            title="Volver a los últimos partidos de liga"
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition hover:border-white/30 hover:text-white"
          >
            <RotateCcw size={13} />
            Los de siempre
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-white/35">
              {total} de {maximo} ·{" "}
              {hojas === 1 ? "1 diapositiva" : `${hojas} diapositivas`}
            </span>

            <button
              type="button"
              data-export-hide
              onClick={() => onMontar(enOrden(marcados))}
              disabled={montando || total === 0}
              title={
                total === 0
                  ? "Marca al menos un partido"
                  : "Montar el informe y abrir el editor"
              }
              className="flex items-center gap-2 rounded-lg border border-[#C8A96B]/40 bg-[#C8A96B]/15 px-4 py-2 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/25 disabled:opacity-50"
            >
              {montando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileDown size={14} />
              )}
              Montar informe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TIPOLOGÍA DE GOL                                                   */
/* ------------------------------------------------------------------ */

/**
 * Las casillas de la hoja «TIPOLOGÍA DE GOL», para escribirlas antes de montar.
 *
 * Ese reparto —cuántos goles de ataque organizado, de transición, de balón
 * parado— no lo da ningún dato: lo codifica el analista viendo el partido. Se
 * escribe aquí, se guarda solo por rival (`lib/rivals/tipologia.ts`) y sigue
 * puesto en el informe de la semana siguiente.
 *
 * En blanco se comporta como antes: la casilla sale punteada en el documento.
 */
function TipologiaEditor({
  equipo,
  golesDeJugada,
}: {
  equipo: string;
  golesDeJugada?: { aFavor: number; enContra: number };
}) {
  const doc = useRemoteDoc<TipologiaManual>({
    key: claveTipologia(equipo),
    kind: "rival-tipologia",
    fallback: TIPOLOGIA_VACIA,
    debounce: 600,
  });

  /*
  | La propuesta de Wyscout.
  |
  | No se guarda: vive aquí y en el informe, y **rellena sólo los huecos**. Lo
  | escrito sigue siendo lo único que se guarda, así que un rival que nunca se
  | ha tocado no ocupa un documento y el día que cambien los informes la
  | propuesta cambia con ellos.
  */
  const [propuesta, setPropuesta] = useState<PropuestaTipologia>(PROPUESTA_VACIA);

  /*
  | Las dos cifras sueltas y no el objeto: quien llama lo construye al vuelo en
  | cada render y, dependiendo del objeto, el efecto volvería a pedir la
  | propuesta cada vez que se pinta el pop-up.
  */
  const golesFavor = golesDeJugada?.aFavor;
  const golesContra = golesDeJugada?.enContra;

  useEffect(() => {
    let vivo = true;

    const objetivo =
      golesFavor === undefined || golesContra === undefined
        ? undefined
        : { aFavor: golesFavor, enContra: golesContra };

    void traePropuestaTipologia(equipo, objetivo).then((la) => {
      if (vivo) setPropuesta(la);
    });

    return () => {
      vivo = false;
    };
  }, [equipo, golesFavor, golesContra]);

  const escritos = useMemo(() => normalizaTipologia(doc.value), [doc.value]);

  const valores = useMemo(
    () => mezclaTipologia(propuesta.tipologia, escritos),
    [escritos, propuesta],
  );

  /** Si una casilla viene de la propuesta y no de la mano, se dice. */
  const esPropuesta = (lado: "aFavor" | "enContra", fila: string) =>
    escritos[lado][fila] === undefined &&
    propuesta.tipologia[lado][fila] !== undefined;

  const pon = (lado: "aFavor" | "enContra", fila: string, texto: string) => {
    const n = Number(texto);

    doc.setValue((actual) => {
      const base = normalizaTipologia(actual);
      const columna = { ...base[lado] };

      /* Un cero escrito **se guarda**: es la forma de decir «aquí no hubo
         ninguno» y de tapar lo que cuenta BeSoccer. Vacío es «no lo he
         codificado» y deja la casilla punteada. */
      if (!texto.trim() || !Number.isFinite(n) || n < 0) delete columna[fila];
      else columna[fila] = Math.round(n);

      return { ...base, [lado]: columna };
    });
  };

  const casilla = (lado: "aFavor" | "enContra", fila: string) => {
    const propuesto = esPropuesta(lado, fila);

    return (
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={valores[lado][fila] ?? ""}
        onChange={(evento) => pon(lado, fila, evento.target.value)}
        title={
          propuesto
            ? "Propuesto con los informes de Wyscout. Escribe encima para corregirlo."
            : undefined
        }
        /* La propuesta va en dorado y a medio tono: se ve de un vistazo qué
           ha puesto el analista y qué ha puesto el dato. */
        className={`h-7 w-14 rounded-md border text-center text-xs font-semibold tabular-nums outline-none focus:border-[#C8A96B] ${
          propuesto
            ? "border-[#C8A96B]/30 bg-[#C8A96B]/[0.07] text-[#C8A96B]"
            : "border-white/15 bg-white/[0.04] text-white"
        }`}
      />
    );
  };

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
          Tipología de gol
        </h3>

        <span className="text-[11px] text-white/35">
          {doc.sinGuardar ? "Guardando…" : "Se guarda solo"} ·{" "}
          {sumaColumna(valores.aFavor)} a favor ·{" "}
          {sumaColumna(valores.enContra)} en contra
        </span>
      </div>

      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {FILAS_TIPOLOGIA.map((bloque) => (
          <div key={bloque.seccion} className="min-w-0">
            {/* La sección, y encima de las casillas cuál es cuál: dos huecos
                iguales seguidos no dicen por sí solos quién es a favor. */}
            <div className="mb-1 mt-3 flex items-end justify-between gap-2">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#C8A96B]">
                {bloque.seccion}
              </p>

              <span className="flex shrink-0 gap-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/35">
                <span className="w-14 text-center text-emerald-300/70">
                  A favor
                </span>
                <span className="w-14 text-center text-rose-300/70">
                  En contra
                </span>
              </span>
            </div>

            {bloque.filas.map((fila) => (
              <div
                key={fila}
                className="flex items-center justify-between gap-2 py-0.5"
              >
                <span className="truncate text-xs text-white/60">{fila}</span>

                <span className="flex shrink-0 gap-1.5">
                  {casilla("aFavor", fila)}
                  {casilla("enContra", fila)}
                </span>
              </div>
            ))}
          </div>
        ))}

        {/* Las propias puertas no son una fila de la tabla —van al pie de
            cada columna—, pero se escriben igual. */}
        <div className="min-w-0">
          <div className="mb-1 mt-3 flex items-end justify-between gap-2">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#C8A96B]">
              PROPIA PUERTA
            </p>

            <span className="flex shrink-0 gap-1.5 text-[9px] font-semibold uppercase tracking-[0.08em]">
              <span className="w-14 text-center text-emerald-300/70">
                A favor
              </span>
              <span className="w-14 text-center text-rose-300/70">
                En contra
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 py-0.5">
            <span className="truncate text-xs text-white/60">
              {FILA_PROPIA}
            </span>

            <span className="flex shrink-0 gap-1.5">
              {casilla("aFavor", FILA_PROPIA)}
              {casilla("enContra", FILA_PROPIA)}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-white/30">
        Primera casilla, goles a favor; segunda, en contra. Lo que se deje en
        blanco sale punteado en el documento; las propias puertas, en blanco,
        traen las que canta el marcador.
      </p>

      {/*
        De dónde sale lo que ya viene puesto. Va escrito con todas las letras
        porque la diapositiva no distingue un dato de una estimación: los
        penaltis son dato y el resto es un reparto, y quien firma el informe
        tiene que saber cuál es cuál.
      */}
      {propuesta.base.partidos > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-[#C8A96B]/70">
          Las casillas en dorado son una{" "}
          <strong className="font-semibold">propuesta</strong>: reparten los{" "}
          {propuesta.base.golesFavor} goles de jugada a favor y los{" "}
          {propuesta.base.golesContra} en contra según{" "}
          <strong className="font-semibold">de dónde nacen los remates</strong>{" "}
          de este equipo —jugada, contra o balón parado— en sus{" "}
          {propuesta.base.partidos}{" "}
          {propuesta.base.partidos === 1 ? "informe" : "informes"} de Wyscout,
          que es lo más cerca que llega el dato: Wyscout no clasifica los goles.
          Los penaltis y las propias puertas no se tocan, que ésos los cuenta el
          marcador. Escribe encima y manda lo tuyo.
        </p>
      )}
    </div>
  );
}
