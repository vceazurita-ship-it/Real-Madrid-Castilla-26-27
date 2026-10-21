"use client";

import { Activity } from "lucide-react";

import { formatea } from "@/lib/data-analisis/metricas";
import { chipInk } from "@/lib/theme";
import { MINUTOS_PARA_LEER, type PerfilWyscout, type RasgoWyscout } from "@/lib/rivals/perfil-wyscout";

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
| (Para leer a uno se piden 270′: ver `MINUTOS_PARA_LEER`.)
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

/*
| El sentido, dicho (21/10/2026). En «faltas cometidas» menos es mejor y el
| percentil ya viene dado la vuelta: «p8» quería decir que hace más que el 92 %
| de los centrales, y con «p80 = mejor que 8 de cada 10» al pie se leía justo lo
| contrario. Ahora la fila lo cuenta con palabras y en las de «menos es mejor»
| no sale el «p» suelto. Lo marcaron análisis y guion.
*/
function lectura(rasgo: RasgoWyscout, conArticulo: string) {
  /* «de cada 100 centrales», sin el artículo de «contra los centrales». */
  const los = conArticulo.replace(/^los /, "");

  if (rasgo.mejorAlto) return `mejor que ${rasgo.percentil} de cada 100 ${los}`;

  const peor = 100 - rasgo.percentil;

  return rasgo.percentil < 50
    ? `menos es mejor · más que ${peor} de cada 100 ${los}`
    : `menos es mejor · menos que ${rasgo.percentil} de cada 100 ${los}`;
}

function Barra({ rasgo, color, los, minutos }: { rasgo: RasgoWyscout; color: string; los: string; minutos: number }) {
  return (
    <li title={rasgo.comoLeer} className="min-w-0">
      <div className="flex min-w-0 items-baseline justify-between gap-2 text-[12px]">
        <span className="min-w-0 truncate text-white/80">{rasgo.nombre}</span>
        <span className="shrink-0 tabular-nums text-white/45">
          {/* Un recuento (porterías a cero) no lleva decimales. */}
          {rasgo.unidad === "decimal" && Number.isInteger(rasgo.valor)
            ? String(rasgo.valor)
            : formatea(rasgo.valor, rasgo.unidad)}
          {rasgo.casos !== null && (
            <span className="ml-1 text-white/35">
              ({rasgo.casos} en {minutos}′)
            </span>
          )}
          {rasgo.mejorAlto && (
            <span className="ml-1.5 font-semibold" style={{ color: chipInk(color) }}>
              p{rasgo.percentil}
            </span>
          )}
        </span>
      </div>

      <p className="mt-0.5 text-[10px] text-white/40">{lectura(rasgo, los)}</p>

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

/** «… de 7 partidos y 615′»: lo que dice BeSoccer, para explicar por qué no cuadra con Wyscout. */
export type MuestraBeSoccer = { partidos: number; minutos: number };

export function PerfilWyscoutCard({ perfil, besoccer }: { perfil: PerfilWyscout; besoccer?: MuestraBeSoccer | null }) {
  const conRasgos = perfil.fuertes.length > 0 || perfil.flojos.length > 0;
  const los = LOS[perfil.puesto] ?? perfil.puestoLabel.toLowerCase();

  /*
  | BeSoccer y Wyscout no dan los mismos minutos (21/10/2026): Carmona salía
  | con 7 partidos y 615′ arriba y con 6 y 623′ aquí. BeSoccer cuenta por las
  | actas y Wyscout sólo los partidos que tiene descargados. Se dice una vez,
  | cuando no cuadran.
  */
  const noCuadra =
    besoccer && besoccer.partidos > 0 && (besoccer.partidos !== perfil.partidos || Math.abs(besoccer.minutos - perfil.minutos) > 5);

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
          Lleva {perfil.minutos}′ en {perfil.partidos} {perfil.partidos === 1 ? "partido" : "partidos"}: con menos de {MINUTOS_PARA_LEER} (tres partidos enteros) no se le saca perfil, porque una tarde buena o mala lo movería todo.
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
                  <Barra key={r.nombre} rasgo={r} color={VERDE} los={los} minutos={perfil.minutos} />
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
                  <Barra key={r.nombre} rasgo={r} color={ROJO} los={los} minutos={perfil.minutos} />
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
          Percentil contra {perfil.iguales} de {los} con 90′ o más; las cifras «por 90′» llevan entre paréntesis las veces en la temporada; los porcentajes y las que no van por 90′ salen tal como las da Wyscout. Lo que pasa una o dos veces no entra.
          {perfil.posicionTexto && ` Wyscout lo sitúa de ${perfil.posicionTexto}.`}
        </p>
      )}

      {noCuadra && besoccer && (
        <p className="mt-1 text-[10px] text-white/35">
          BeSoccer le cuenta {besoccer.partidos} {besoccer.partidos === 1 ? "partido" : "partidos"} y {besoccer.minutos}′, y Wyscout {perfil.partidos} y {perfil.minutos}′: BeSoccer cuenta por las actas y Wyscout sólo los partidos que tiene descargados, así que no siempre cuadran.
        </p>
      )}
    </section>
  );
}

export default PerfilWyscoutCard;
