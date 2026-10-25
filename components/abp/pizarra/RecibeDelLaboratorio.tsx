"use client";

/**
 * Lo que llega del laboratorio de ABP a la pizarra (25/10/2026).
 *
 * El laboratorio deja la diapositiva hecha —jugadores, flechas, consignas— y
 * abre la pizarra; aquí se elige en qué jornada y si entra como diapositiva
 * NUEVA o SUSTITUYENDO una que ya está. Nada se escribe hasta pulsar el botón,
 * y entonces lo escribe la propia pizarra con su `mutaTablero`, que lo deja
 * en la pila de deshacer como cualquier otro cambio.
 *
 * Si la rutina salió de una diapositiva de esta pizarra, se propone sustituir
 * ésa, y se avisa si alguien la ha cambiado aquí desde que se llevó al
 * laboratorio: sustituirla se llevaría esos cambios (se puede deshacer).
 */

import { useMemo, useState } from "react";
import { FlaskConical, Plus, Repeat } from "lucide-react";

import { Button, Dialog, Notice } from "@/components/abp/ui";
import type { SlidePizarra, TableroPizarra } from "@/lib/abp/pizarra";
import { huellaSlide } from "@/lib/abp-lab/puente-pizarra";
import type { EnvioAPizarra } from "@/lib/abp-lab/puente-envio";

export type DestinoEnvio = { modo: "nueva" } | { modo: "sustituir"; slideId: string };

export function RecibeDelLaboratorio({
  recado,
  partidos,
  elegido,
  onElige,
  tablero,
  onAplica,
  onCerrar,
}: {
  recado: EnvioAPizarra;
  /** Las jornadas del desplegable, con su rótulo. */
  partidos: { id: string; label: string }[];
  elegido: string;
  onElige: (partidoId: string) => void;
  /** El tablero de la jornada elegida, ya puesto al día. */
  tablero: TableroPizarra | null;
  onAplica: (destino: DestinoEnvio) => void;
  onCerrar: () => void;
}) {
  const esOrigen = (s: SlidePizarra) => recado.destino?.partidoId === elegido && recado.destino.slideId === s.id;

  /* Por defecto, sustituir la diapositiva de la que salió (si está en esta jornada); una variante, o si no está, nueva. */
  const propuesta = recado.variante ? "" : (tablero?.slides.find(esOrigen)?.id ?? "");

  const [eleccion, setEleccion] = useState<{ partido: string; slideId: string } | null>(null);

  /* Al cambiar de jornada la elección anterior ya no vale: se vuelve a la propuesta. */
  const marcada = eleccion && eleccion.partido === elegido ? eleccion.slideId : propuesta;

  const objetivo = tablero?.slides.find((s) => s.id === marcada) ?? null;

  const cambiadaAqui = objetivo && esOrigen(objetivo) && recado.huellaOrigen && huellaSlide(objetivo) !== recado.huellaOrigen;

  const resumen = useMemo(() => {
    const s = recado.slide;

    const flechas = (s.trazos ?? []).length;

    const consignas = s.notas.filter((n) => n.trim()).length;

    return [
      `${s.fichas.length} ${s.fichas.length === 1 ? "jugador" : "jugadores"}`,
      flechas ? `${flechas} ${flechas === 1 ? "flecha" : "flechas"}` : "",
      consignas ? `${consignas} ${consignas === 1 ? "consigna" : "consignas"}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }, [recado.slide]);

  return (
    <Dialog
      title="Llega del laboratorio"
      subtitle={`${recado.nombre} · ${resumen}`}
      onClose={onCerrar}
      footer={
        <>
          <Button onClick={onCerrar}>Ahora no</Button>
          <Button
            tone="primary"
            icon={objetivo ? Repeat : Plus}
            disabled={!tablero}
            onClick={() => onAplica(objetivo ? { modo: "sustituir", slideId: objetivo.id } : { modo: "nueva" })}
          >
            {objetivo ? `Sustituir «${objetivo.titulo}»` : "Añadir como diapositiva nueva"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-[13px] leading-relaxed text-white/70">
          <FlaskConical size={15} className="mt-0.5 shrink-0 text-[#C8A96B]" />
          <span>
            Entra con todos los jugadores, sus carreras, el balón y las consignas colocados. Después se mueve y se escribe como cualquier diapositiva, y
            <strong className="font-semibold text-white/85"> Ctrl + Z</strong> lo deshace.
          </span>
        </p>

        {recado.sinJugador > 0 && (
          <Notice tone="warn" title={`${recado.sinJugador} ${recado.sinJugador === 1 ? "papel no tiene" : "papeles no tienen"} jugador`}>
            En la pizarra sólo se dibuja su carrera: ponle cara después desde el panel.
          </Notice>
        )}

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Jornada</span>
          <select
            value={elegido}
            onChange={(e) => onElige(e.target.value)}
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/85 outline-none focus:border-[#C8A96B]/50"
          >
            {partidos.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#11161C]">
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset role="radiogroup" className="space-y-1.5">
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Dónde entra</legend>

          <Opcion
            marcada={!objetivo}
            onMarca={() => setEleccion({ partido: elegido, slideId: "" })}
            titulo="Como diapositiva nueva"
            detalle={`Al final, detrás de la ${tablero?.slides.length ?? 0}.ª`}
          />

          {(tablero?.slides ?? []).map((s, i) => (
            <Opcion
              key={s.id}
              marcada={objetivo?.id === s.id}
              onMarca={() => setEleccion({ partido: elegido, slideId: s.id })}
              titulo={`Sustituir la ${i + 1}.ª · ${s.titulo}`}
              detalle={[esOrigen(s) ? "De aquí salió" : "", `${s.fichas.length} jugadores`].filter(Boolean).join(" · ")}
              destacada={esOrigen(s)}
            />
          ))}
        </fieldset>

        {objetivo && (
          <Notice tone={cambiadaAqui ? "warn" : "info"} title={cambiadaAqui ? "Esta diapositiva ha cambiado en la pizarra desde que la llevaste al laboratorio" : `Se sustituye «${objetivo.titulo}» entera`}>
            {cambiadaAqui
              ? "Lo que se cambió aquí después se sustituye por lo del laboratorio. Si no es lo que quieres, añádela como nueva; si te equivocas, Ctrl + Z."
              : "Jugadores, flechas, rivales y consignas pasan a ser los del laboratorio. Se deshace con Ctrl + Z o con el aviso que sale al sustituir."}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}

function Opcion({
  marcada,
  onMarca,
  titulo,
  detalle,
  destacada = false,
}: {
  marcada: boolean;
  onMarca: () => void;
  titulo: string;
  detalle: string;
  destacada?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcada}
      onClick={onMarca}
      className={`flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
        marcada ? "border-[#C8A96B]/60 bg-[#C8A96B]/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"
      }`}
    >
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${marcada ? "border-[#C8A96B]" : "border-white/30"}`}>
        {marcada && <span className="h-2 w-2 rounded-full bg-[#C8A96B]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] font-semibold ${marcada ? "text-[#C8A96B]" : "text-white/85"}`}>{titulo}</span>
        <span className={`block truncate text-[11px] ${destacada ? "text-[#C8A96B]/80" : "text-white/45"}`}>{detalle}</span>
      </span>
    </button>
  );
}
