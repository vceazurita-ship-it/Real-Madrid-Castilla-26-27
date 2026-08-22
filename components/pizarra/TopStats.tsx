"use client";

import { useMemo } from "react";
import { HeartPulse, Shield, Users, UserCheck, Armchair } from "lucide-react";
import { useLineup } from "@/context/LineupContext";
import {
  REASON_LABEL,
  useAvailability,
  type UnavailableReason,
} from "@/context/AvailabilityContext";
import { usePlayers } from "@/hooks/usePlayers";
import { cn } from "@/lib/utils";

/** Jugadores de otra licencia permitidos en la convocatoria. */
const NON_CASTILLA_LIMIT = 4;

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  color: string;
  danger?: boolean;
}

function StatCard({
  icon,
  label,
  value,
  hint,
  color,
  danger = false,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-[135px] snap-start flex-col items-center justify-center rounded-2xl border px-3 py-3.5 text-center shadow-lg ring-1 ring-white/5 transition duration-200 sm:min-w-[150px] lg:min-w-0 lg:px-4",
        danger
          ? "border-red-500/60 bg-gradient-to-b from-red-500/15 to-red-900/20"
          : "border-[#C8A96B]/15 bg-gradient-to-b from-[#18212B] to-[#111820] lg:hover:-translate-y-1 lg:hover:border-[#C8A96B]/45"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 shadow-lg lg:h-11 lg:w-11",
          color
        )}
      >
        {icon}
      </div>

      <div className="mt-2.5 text-[26px] font-black leading-none tabular-nums text-white lg:text-[30px]">
        {value}
      </div>

      <div className="mt-1 text-[10px] uppercase leading-tight tracking-[0.08em] text-white/65">
        {label}
      </div>

      {hint && (
        <div
          className={cn(
            "mt-0.5 text-[9px] leading-tight",
            danger ? "font-semibold text-red-300" : "text-white/35"
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

/** Resumen de la convocatoria: quién hay, quién falta y quién está de baja. */
export default function TopStats() {
  const { players } = usePlayers();
  const { lineup, bench } = useLineup();
  const { bajas, isAvailable } = useAvailability();

  const titulares = lineup.filter((slot) => slot.playerId).length;

  const stats = useMemo(() => {
    const disponibles = players.filter((player) =>
      isAvailable(player.id)
    ).length;

    // El tope de licencias ajenas se mide sobre la convocatoria, no sobre
    // toda la plantilla: sólo cuentan los que van a jugar.
    const convocados = new Set(
      [...lineup.map((slot) => slot.playerId), ...bench].filter(
        (id): id is string => Boolean(id)
      )
    );

    const noCastilla = players.filter(
      (player) =>
        convocados.has(player.id) && player.licencia !== "RMCF Castilla"
    ).length;

    // Motivo más repetido, para explicar el número de bajas de un vistazo.
    const porMotivo = new Map<UnavailableReason, number>();

    for (const reason of Object.values(bajas)) {
      porMotivo.set(reason, (porMotivo.get(reason) ?? 0) + 1);
    }

    const top = [...porMotivo.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      disponibles,
      bajas: players.length - disponibles,
      noCastilla,
      motivoTop: top ? `${REASON_LABEL[top[0]]}: ${top[1]}` : undefined,
    };
  }, [players, lineup, bench, bajas, isAvailable]);

  return (
    <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth pb-2 scrollbar-none lg:grid lg:grid-cols-5 lg:gap-3 lg:overflow-visible">
      <StatCard
        icon={<Shield className="h-5 w-5 text-white" />}
        label="Disponibles"
        value={stats.disponibles}
        hint={`de ${players.length} en plantilla`}
        color="bg-emerald-600"
      />

      <StatCard
        icon={<HeartPulse className="h-5 w-5 text-white" />}
        label="Bajas"
        value={stats.bajas}
        hint={stats.motivoTop}
        color="bg-red-600"
        danger={stats.bajas > 0}
      />

      <StatCard
        icon={<UserCheck className="h-5 w-5 text-[#111]" />}
        label="En el once"
        value={`${titulares}/${lineup.length || 11}`}
        hint={titulares === lineup.length ? "Once completo" : "Faltan puestos"}
        color="bg-[#C8A96B]"
      />

      <StatCard
        icon={<Armchair className="h-5 w-5 text-white" />}
        label="Banquillo"
        value={bench.length}
        hint="Suplentes convocados"
        color="bg-sky-600"
      />

      <StatCard
        icon={<Users className="h-5 w-5 text-[#111]" />}
        label="No Castilla"
        value={`${stats.noCastilla}/${NON_CASTILLA_LIMIT}`}
        hint="En la convocatoria"
        color={
          stats.noCastilla > NON_CASTILLA_LIMIT ? "bg-red-600" : "bg-[#C8A96B]"
        }
        danger={stats.noCastilla > NON_CASTILLA_LIMIT}
      />
    </div>
  );
}
