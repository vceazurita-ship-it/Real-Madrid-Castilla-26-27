"use client";

/**
 * Cómo salió el viaje (11/11/2026): una nota general con su comentario, una
 * nota por ítem —hotel, autobús, comidas, estadio— y las incidencias, propias
 * o del rival. Las citas se valoran en su «⋯» del horario.
 *
 * Es para la próxima vez y para nadie más: se guarda con el viaje y con su
 * plan, y se lee al reutilizarlo («la última vez: el hotel 6/10, el bus llegó
 * tarde»), pero **no sale en ningún documento** —ni dossier ni horario—: el
 * PDF va a los jugadores.
 */

import { Bookmark, ClipboardCheck, Plus, Trash2 } from "lucide-react";

import { Button, Panel, TextArea } from "@/components/abp/ui";
import {
  ITEMS_VALORACION,
  nuevoId,
  resumenValoracion,
  type Desplazamiento,
  type Incidencia,
  type PlanViaje,
  type ValoracionViaje,
} from "@/lib/viaje/modelo";

function Nota({ valor, onCambia, etiqueta }: { valor?: number; onCambia: (nota: number | undefined) => void; etiqueta: string }) {
  return (
    <select
      value={valor ?? ""}
      aria-label={etiqueta}
      onChange={(evento) => onCambia(evento.target.value ? Number(evento.target.value) : undefined)}
      className="w-20 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm tabular-nums text-white outline-none transition focus:border-[#C8A96B]/50"
    >
      <option value="" className="bg-[#11161C]">—</option>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <option key={n} value={n} className="bg-[#11161C]">
          {n}/10
        </option>
      ))}
    </select>
  );
}

export function ValoracionViajePanel({
  viaje,
  onCambia,
  plan,
  onGuardaPlan,
}: {
  viaje: Desplazamiento;
  onCambia: (valoracion: ValoracionViaje) => void;
  /** El plan guardado de este rival, si lo hay (de este viaje o de otro). */
  plan: PlanViaje | null;
  onGuardaPlan: () => void;
}) {
  const v = viaje.valoracion ?? {};

  const cambia = (parche: Partial<ValoracionViaje>) => onCambia({ ...v, ...parche });

  const incidencias = v.incidencias ?? [];

  const cambiaIncidencia = (id: string, parche: Partial<Incidencia>) =>
    cambia({ incidencias: incidencias.map((uno) => (uno.id === id ? { ...uno, ...parche } : uno)) });

  const resumen = resumenValoracion(viaje);
  const delMismo = plan?.partidoId === viaje.partidoId;

  return (
    <Panel
      title="Cómo salió el viaje"
      subtitle="Para la próxima vez: no sale en el dossier ni en el horario de los jugadores"
      icon={ClipboardCheck}
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-40 shrink-0 text-[13px] font-semibold text-white/80">El viaje en general</span>
            <Nota valor={v.nota} etiqueta="Nota general del viaje" onCambia={(nota) => cambia({ nota })} />
          </div>

          {ITEMS_VALORACION.map((item) => {
            const suyo = v.items?.[item.clave] ?? {};

            return (
              <div key={item.clave} className="flex min-w-0 items-center gap-2">
                <span className="w-40 shrink-0 text-[13px] text-white/70">{item.rotulo}</span>
                <Nota
                  valor={suyo.nota}
                  etiqueta={`Nota de ${item.corto}`}
                  onCambia={(nota) => cambia({ items: { ...v.items, [item.clave]: { ...suyo, nota } } })}
                />
                <input
                  value={suyo.texto ?? ""}
                  onChange={(evento) => cambia({ items: { ...v.items, [item.clave]: { ...suyo, texto: evento.target.value } } })}
                  placeholder="Una línea: «habitaciones frías»"
                  aria-label={`Nota corta de ${item.corto}`}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white/85 outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
                />
              </div>
            );
          })}

          <TextArea
            label="Comentario"
            value={v.comentario ?? ""}
            onChange={(comentario) => cambia({ comentario })}
            placeholder="Lo que haría distinto la próxima vez"
            rows={3}
          />
        </div>

        <div className="min-w-0">
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-white/45">Incidencias</p>

          <div className="space-y-1.5">
            {incidencias.map((uno) => (
              <div key={uno.id} className="flex min-w-0 items-center gap-2">
                <select
                  value={uno.origen}
                  onChange={(evento) => cambiaIncidencia(uno.id, { origen: evento.target.value as Incidencia["origen"] })}
                  aria-label="De quién es la incidencia"
                  className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                >
                  <option value="propia" className="bg-[#11161C]">Nuestra</option>
                  <option value="rival" className="bg-[#11161C]">Del rival</option>
                </select>
                <input
                  value={uno.texto}
                  onChange={(evento) => cambiaIncidencia(uno.id, { texto: evento.target.value })}
                  placeholder={uno.origen === "rival" ? "«Vestuario sin agua caliente»" : "«El bus llegó 30 min tarde»"}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white/85 outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
                />
                <Button tone="danger" icon={Trash2} aria-label="Quitar la incidencia" onClick={() => cambia({ incidencias: incidencias.filter((otra) => otra.id !== uno.id) })} />
              </div>
            ))}
          </div>

          <div className="mt-2">
            <Button icon={Plus} onClick={() => cambia({ incidencias: [...incidencias, { id: nuevoId("IN"), origen: "propia", texto: "" }] })}>
              Añadir incidencia
            </Button>
          </div>

          {/* El plan de viaje ante este rival: se propone al volver a jugar contra él o en su campo. */}
          <div className="mt-4 rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.05] p-3">
            <p className="text-[13px] text-white/80">
              {plan && delMismo
                ? `Guardado como plan de viaje ante ${plan.rival || "este rival"} el ${new Date(plan.guardado).toLocaleDateString("es-ES")}. Al volver a jugar contra él se propondrá como punto de partida.`
                : `Guárdalo como «plan de viaje ante ${viaje.rival || "este rival"}»: la próxima vez contra él (o en su campo) saldrá propuesto, con esta valoración.`}
            </p>

            {resumen.length > 0 && (
              <p className="mt-1.5 text-[12px] text-white/55">Se leerá así: «{resumen.join(", ")}».</p>
            )}

            <div className="mt-2">
              <Button tone="primary" icon={Bookmark} onClick={onGuardaPlan} disabled={!viaje.rival.trim()}>
                {plan && delMismo ? "Actualizar el plan" : `Guardar como plan ante ${viaje.rival || "el rival"}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
