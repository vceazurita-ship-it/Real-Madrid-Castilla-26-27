"use client";

/**
 * «PROPONER BOCETO» DEL PLAN DE PARTIDO (11/10/2026).
 *
 * La cara del motor de `lib/plan-partido/boceto.ts`: trae los datos que ya
 * tiene la plataforma (los informes de Wyscout, el balón parado de la liga y
 * el scouting en vídeo del rival), replica el plan de la jornada anterior y lo
 * enseña apartado por apartado con sus marcas —«?» a valorar cambiar, con el
 * dato; «*» a valorar incorporar— antes de escribir nada. Sólo «Aplicar al
 * plan» toca el plan abierto, y desde ahí se edita como siempre.
 *
 * Se puede elegir de qué jornada se parte: por defecto, la última con plan
 * escrito anterior a ésta.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Sparkles } from "lucide-react";

import { Button, Dialog, EmptyState, Notice } from "@/components/abp/ui";
import type { ComparativaAbp } from "@/lib/abp/informe-graficos";
import type { RivalScoutStore } from "@/lib/abp/rivalScout";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import {
  CAMPOS_BOCETO,
  TITULO_CAMPO,
  construyeBocetoPlan,
  textoDelBoceto,
  type BocetoPlan,
  type CampoBoceto,
  type LineaBoceto,
} from "@/lib/plan-partido/boceto";
import { useTextosExplicativos } from "@/components/ui/textos-analisis";

type Rival = Record<string, string>;

type Datos = {
  partidos: FilaPartido[];
  jugadores: FilaJugador[];
  comparativa: ComparativaAbp | null;
  scout: RivalScoutStore | null;
};

const relleno = (valor: unknown) => String(valor ?? "").trim().length > 0;

export function BocetoPlanDialog({
  actual,
  candidatas,
  onAplicar,
  onCerrar,
}: {
  /** El plan abierto: el partido que se prepara. */
  actual: Rival;
  /** Las otras jornadas con plan escrito, de la más reciente a la más antigua. */
  candidatas: Rival[];
  /** Los textos para el plan y el boceto entero, para guardar los porqués aparte. */
  onAplicar: (campos: Record<string, string>, boceto: BocetoPlan) => void;
  onCerrar: () => void;
}) {
  /* De qué jornada se parte: la última anterior a ésta con algo escrito. */
  const porDefecto = useMemo(() => {
    const miJornada = Number(actual.JORNADA ?? 0);
    const anteriores = candidatas.filter((r) => Number(r.JORNADA ?? 0) < miJornada || !miJornada);
    return anteriores[0] ?? candidatas[0] ?? null;
  }, [actual.JORNADA, candidatas]);

  const [origenId, setOrigenId] = useState<string>(String(porDefecto?.ID ?? ""));
  const origen = candidatas.find((r) => String(r.ID) === origenId) ?? porDefecto;

  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const explicativos = useTextosExplicativos();

  /* Las tres fuentes, una vez: lo que cambia después es sólo la jornada de origen. */
  useEffect(() => {
    let cancelado = false;

    const traer = async () => {
      try {
        const [informes, abp, scout] = await Promise.all([
          fetch("/api/data-analisis", { cache: "no-store" })
            .then((r) => r.json() as Promise<{ partidos?: FilaPartido[]; jugadores?: FilaJugador[] }>)
            .catch(() => ({}) as { partidos?: FilaPartido[]; jugadores?: FilaJugador[] }),
          fetch("/api/data-analisis?abpInforme=1", { cache: "no-store" })
            .then((r) => r.json() as Promise<{ abp?: ComparativaAbp }>)
            .then((d) => d?.abp ?? null)
            .catch(() => null),
          fetch("/api/docs?key=abp-rival-scout", { cache: "no-store" })
            .then((r) => r.json() as Promise<{ data?: RivalScoutStore }>)
            .then((d) => d?.data ?? null)
            .catch(() => null),
        ]);

        if (cancelado) return;

        setDatos({
          partidos: Array.isArray(informes.partidos) ? informes.partidos : [],
          jugadores: Array.isArray(informes.jugadores) ? informes.jugadores : [],
          comparativa: abp,
          scout,
        });
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se han podido leer los datos.");
      }
    };

    void traer();

    return () => {
      cancelado = true;
    };
  }, []);

  const boceto: BocetoPlan | null = useMemo(() => {
    if (!datos || !origen) return null;
    return construyeBocetoPlan({ anterior: origen, actual, ...datos });
  }, [datos, origen, actual]);

  const aplicar = () => {
    if (!boceto) return;
    const campos: Record<string, string> = {};
    for (const campo of CAMPOS_BOCETO) campos[campo] = textoDelBoceto(boceto.campos[campo]);
    onAplicar(campos, boceto);
  };

  const yaEscritos = CAMPOS_BOCETO.filter((c) => relleno(actual[c])).length;

  /*
  | Al cuerpo del documento, no donde se abre: el botón vive en la barra de
  | acciones de la cabecera, que lleva transformaciones, y un `fixed` dentro de
  | ella se queda del tamaño de la barra (el diálogo salía de 80 px de alto).
  | Este diálogo sólo se monta tras un clic, nunca en el servidor, así que
  | `document` siempre está.
  */
  return createPortal(
    <Dialog
      title="Proponer boceto del plan"
      subtitle="Se replica el plan de otra jornada y se marca lo que los datos del rival y los nuestros dicen que hay que mirar. Al plan van sólo las marcas; los porqués quedan en la sección plegada del pie, para ti. No escribe nada hasta «Aplicar al plan»."
      onClose={onCerrar}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-white/40">
            {boceto
              ? `${boceto.cuenta.dudas} ${boceto.cuenta.dudas === 1 ? "punto" : "puntos"} a valorar cambiar · ${boceto.cuenta.sugerencias} a valorar incorporar${
                  yaEscritos ? ` · sustituye ${yaEscritos} ${yaEscritos === 1 ? "apartado ya escrito" : "apartados ya escritos"} (se puede deshacer)` : ""
                }`
              : ""}
          </p>

          <div className="flex gap-2">
            <Button onClick={onCerrar}>Cancelar</Button>

            <Button tone="primary" icon={Check} onClick={aplicar} disabled={!boceto}>
              Aplicar al plan
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* De qué jornada se parte y qué significan las marcas. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2 text-sm text-white/70">
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">Partir de</span>

            <select
              value={origenId}
              onChange={(e) => setOrigenId(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white outline-none focus:border-[#C8A96B]/50"
            >
              {candidatas.map((r) => (
                <option key={String(r.ID)} value={String(r.ID)} className="bg-[#11161C]">
                  J{String(r.JORNADA ?? "--").padStart(2, "0")} · {r.EQUIPO}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <Marca marca="?" /> a valorar cambiar (lleva el dato)
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Marca marca="*" /> a valorar incorporar
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Marca marca="" /> se queda igual
            </span>
          </div>
        </div>

        {error && <Notice tone="warn" title="No se han podido leer los datos">{error}</Notice>}

        {!origen && (
          <EmptyState
            title="No hay otra jornada con plan escrito"
            description="El boceto parte del plan de la semana anterior. Escribe uno primero, o replica el de otra jornada."
          />
        )}

        {origen && !datos && !error && (
          <EmptyState
            title="Leyendo los datos…"
            description={explicativos ? `Los informes de Wyscout del ${actual.EQUIPO ?? "rival"} y los nuestros, el balón parado de la liga y el scouting en vídeo.` : undefined}
          />
        )}

        {boceto && (
          <>
            {((explicativos && boceto.fuentes.length > 0) || boceto.avisos.length > 0) && (
              <Notice
                title={`Replicado de la J${boceto.anterior.jornada} (${boceto.anterior.equipo}) y contrastado con los datos del ${boceto.rival}`}
              >
                {explicativos && boceto.fuentes.length > 0 && <p>{boceto.fuentes.join(" · ")}.</p>}

                {boceto.avisos.map((aviso) => (
                  <p key={aviso} className="mt-1 text-amber-200/80">
                    {aviso}
                  </p>
                ))}
              </Notice>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {CAMPOS_BOCETO.map((campo) => (
                <Apartado key={campo} campo={campo} lineas={boceto.campos[campo]} />
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>,
    document.body,
  );
}

function Marca({ marca }: { marca: LineaBoceto["marca"] }) {
  const estilo =
    marca === "?"
      ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
      : marca === "*"
        ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
        : "border-white/10 bg-white/[0.04] text-white/40";

  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${estilo}`}>
      {marca || "·"}
    </span>
  );
}

function Apartado({ campo, lineas }: { campo: CampoBoceto; lineas: LineaBoceto[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles size={13} className="text-[#C8A96B]" />

        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">{TITULO_CAMPO[campo]}</h3>

        <span className="ml-auto text-[10px] tabular-nums text-white/35">
          {lineas.filter((l) => l.marca === "?").length > 0 && `${lineas.filter((l) => l.marca === "?").length} ? `}
          {lineas.filter((l) => l.marca === "*").length > 0 && `${lineas.filter((l) => l.marca === "*").length} *`}
        </span>
      </div>

      {lineas.length === 0 ? (
        <p className="text-xs text-white/35">Nada en la jornada anterior ni nada que proponer.</p>
      ) : (
        <ul className="space-y-1.5">
          {lineas.map((l, i) => (
            <li key={`${i}-${l.texto}`} className="flex items-start gap-2 text-[13px] leading-snug">
              <Marca marca={l.marca} />

              <span className="min-w-0">
                <span className={l.marca === "?" ? "text-amber-100" : l.marca === "*" ? "text-emerald-100" : "text-white/80"}>{l.texto}</span>

                {l.motivo && <span className="block text-[11px] leading-snug text-white/40">{l.motivo}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BocetoPlanDialog;
