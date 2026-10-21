"use client";

import { Activity } from "lucide-react";

import { formatea } from "@/lib/data-analisis/metricas";
import { chipInk } from "@/lib/theme";
import type { PerfilWyscout, RasgoWyscout } from "@/lib/rivals/perfil-wyscout";

/*
|--------------------------------------------------------------------------
| CÓMO JUEGA, SEGÚN WYSCOUT (21/10/2026)
|--------------------------------------------------------------------------
|
| Al lado del «cuánto juega» de BeSoccer, el «cómo»: lo que más le separa de
| los de su puesto en toda la categoría, por arriba (verde: lo que hay que
| frenar) y por abajo (rojo: por dónde se le gana). Cada rasgo lleva su
| percentil y su valor, y el pie dice contra quién y con cuántos minutos, que
| es lo que hace falta para fiarse.
|
| Sin fila en Wyscout la tarjeta no sale. Con menos de 90′ sale sólo la
| muestra, sin percentiles: con veinte minutos cualquiera es el mejor en algo.
*/

/* «contra los extremos y mediapuntas»: «los bandas» no se dice. */
const LOS: Record<string, string> = {
  POR: "los porteros",
  CEN: "los centrales",
  LAT: "los laterales",
  MED: "los medios",
  BAN: "los extremos y mediapuntas",
  DEL: "los delanteros",
};

const VERDE = "#34D399";
const ROJO = "#F87171";

function Barra({ rasgo, color }: { rasgo: RasgoWyscout; color: string }) {
  return (
    <li title={rasgo.comoLeer} className="min-w-0">
      <div className="flex min-w-0 items-baseline justify-between gap-2 text-[12px]">
        <span className="min-w-0 truncate text-white/80">{rasgo.nombre}</span>
        <span className="shrink-0 tabular-nums text-white/45">
          {formatea(rasgo.valor, rasgo.unidad)}
          <span className="ml-1.5 font-semibold" style={{ color: chipInk(color) }}>
            p{rasgo.percentil}
          </span>
        </span>
      </div>

      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full"
        style={{ background: "rgb(var(--rmcf-ink-rgb) / .08)" }}
        role="presentation"
      >
        <div className="h-full rounded-full" style={{ width: `${Math.max(4, rasgo.percentil)}%`, background: color }} />
      </div>
    </li>
  );
}

export function PerfilWyscoutCard({ perfil }: { perfil: PerfilWyscout }) {
  const conRasgos = perfil.fuertes.length > 0 || perfil.flojos.length > 0;

  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
          <Activity size={12} className="text-[#C8A96B]" />
          Cómo juega · contra {LOS[perfil.puesto] ?? perfil.puestoLabel.toLowerCase()} de la categoría
        </h3>

        <span className="text-[10px] text-white/40">
          Wyscout · esta temporada · {perfil.partidos} {perfil.partidos === 1 ? "partido" : "partidos"} · {perfil.minutos}′
        </span>
      </header>

      {perfil.muestraCorta ? (
        <p className="text-xs text-white/50">
          Lleva {perfil.minutos}′: con menos de 90 no se le compara, cualquier cifra por partido sería una extrapolación.
        </p>
      ) : conRasgos ? (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {perfil.fuertes.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: chipInk(VERDE) }}>
                Destaca en
              </p>
              <ul className="space-y-2.5">
                {perfil.fuertes.map((r) => (
                  <Barra key={r.nombre} rasgo={r} color={VERDE} />
                ))}
              </ul>
            </div>
          )}

          {perfil.flojos.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: chipInk(ROJO) }}>
                Por debajo de su puesto en
              </p>
              <ul className="space-y-2.5">
                {perfil.flojos.map((r) => (
                  <Barra key={r.nombre} rasgo={r} color={ROJO} />
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/50">
          En lo suyo está en la media de {LOS[perfil.puesto] ?? perfil.puestoLabel.toLowerCase()}: nada le separa ni por arriba ni por abajo (entre el 30 y el 70).
        </p>
      )}

      {!perfil.muestraCorta && (
        <p className="mt-3 text-[10px] text-white/35">
          Percentil contra {perfil.iguales} de {LOS[perfil.puesto] ?? perfil.puestoLabel.toLowerCase()} con 90′ o más. p80 = mejor que 8 de cada 10.
          {perfil.posicion && ` Wyscout le pone de ${perfil.posicion}.`}
        </p>
      )}
    </section>
  );
}

export default PerfilWyscoutCard;
