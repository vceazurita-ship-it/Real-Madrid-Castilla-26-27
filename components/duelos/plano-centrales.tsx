"use client";

/**
 * Los centrales del rival en el plano duelos defensivos/90 contra % ganados,
 * con la mediana de los centrales de la categoría (27/11/2026, idea de X).
 * La cuenta vive en lib/duelos-centrales.ts.
 */
import { ORO, tinta } from "@/components/data/graficas";
import { MINUTOS_FIABLES_CENTRAL, type PlanoCentrales as Plano } from "@/lib/duelos-centrales";

const coma = (v: number, d = 1) => v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
const apellido = (nombre: string) => {
  const t = nombre.trim().split(/\s+/);
  return t.length > 1 ? t.slice(1).join(" ") : nombre;
};

const NARANJA = "#D95F02";
const W = 320;
const H = 210;
const M = { izq: 34, der: 10, arr: 10, aba: 30 };

export function PlanoCentrales({ p, delantero, id }: { p: Plano; delantero: string; id?: string }) {
  const { puntos, objetivo } = p;
  const xs = [...puntos.map((c) => c.duelos), p.medianaDuelos];
  const ys = [...puntos.map((c) => c.ganados), p.medianaGanados];
  const xMin = Math.max(0, Math.floor(Math.min(...xs) - 1));
  const xMax = Math.ceil(Math.max(...xs) + 1);
  const yMin = Math.max(0, Math.floor((Math.min(...ys) - 5) / 10) * 10);
  const yMax = Math.min(100, Math.ceil((Math.max(...ys) + 5) / 10) * 10);
  const ancho = W - M.izq - M.der;
  const alto = H - M.arr - M.aba;
  const sx = (v: number) => M.izq + ((v - xMin) / (xMax - xMin || 1)) * ancho;
  const sy = (v: number) => M.arr + alto - ((v - yMin) / (yMax - yMin || 1)) * alto;
  const pasoX = xMax - xMin > 8 ? 2 : 1;
  const marcasX = Array.from({ length: Math.floor((xMax - xMin) / pasoX) + 1 }, (_, i) => xMin + i * pasoX);
  const marcasY = Array.from({ length: Math.floor((yMax - yMin) / 10) + 1 }, (_, i) => yMin + i * 10);
  const pocos = puntos.filter((c) => c.poca);
  const esObjetivo = (c: { jugador: string }) => objetivo?.jugador === c.jugador;
  /* El resaltado, el último: encima de los demás. */
  const orden = [...puntos].sort((a, b) => Number(esObjetivo(a)) - Number(esObjetivo(b)));

  return (
    <div id={id} className="mt-3 rounded-xl border p-3" style={{ borderColor: tinta(0.1) }} onClick={(e) => e.stopPropagation()}>
      <p className="text-[12px] font-semibold text-white/80">
        A qué central atacar · los {puntos.length} centrales de su plantilla contra la mediana de los {p.comparables} de la categoría
      </p>

      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="grafico-cabe h-auto w-full" role="img" aria-label="Duelos defensivos por 90 contra porcentaje de duelos defensivos ganados de los centrales del rival">
          {marcasX.map((v) => (
            <g key={`x${v}`}>
              <line x1={sx(v)} x2={sx(v)} y1={M.arr} y2={M.arr + alto} stroke={tinta(0.06)} />
              <text x={sx(v)} y={H - M.aba + 12} textAnchor="middle" fontSize={10.5} fill={tinta(0.5)}>{v}</text>
            </g>
          ))}
          {marcasY.map((v) => (
            <g key={`y${v}`}>
              <line x1={M.izq} x2={W - M.der} y1={sy(v)} y2={sy(v)} stroke={tinta(0.06)} />
              <text x={M.izq - 4} y={sy(v) + 3} textAnchor="end" fontSize={10.5} fill={tinta(0.5)}>{v}</text>
            </g>
          ))}
          <text x={M.izq + ancho / 2} y={H - 4} textAnchor="middle" fontSize={11} fill={tinta(0.6)}>Duelos defensivos / 90</text>
          <text x={10} y={M.arr + alto / 2} textAnchor="middle" fontSize={11} fill={tinta(0.6)} transform={`rotate(-90 10 ${M.arr + alto / 2})`}>% ganados</text>

          {/* La zona a atacar: muchos duelos y por debajo de la mediana del % ganado. */}
          <rect x={sx(p.medianaDuelos)} y={sy(p.medianaGanados)} width={Math.max(0, W - M.der - sx(p.medianaDuelos))} height={Math.max(0, M.arr + alto - sy(p.medianaGanados))} style={{ fill: "rgba(200,169,107,0.12)" }} />
          <line x1={sx(p.medianaDuelos)} x2={sx(p.medianaDuelos)} y1={M.arr} y2={M.arr + alto} stroke={tinta(0.35)} strokeDasharray="3 3" />
          <line x1={M.izq} x2={W - M.der} y1={sy(p.medianaGanados)} y2={sy(p.medianaGanados)} stroke={tinta(0.35)} strokeDasharray="3 3" />
          <text x={W - M.der - 2} y={M.arr + alto - 4} textAnchor="end" fontSize={10.5} fontWeight={700} style={{ fill: ORO, letterSpacing: "0.06em" }}>A CARGAR</text>
          <text x={W - M.der - 2} y={sy(p.medianaGanados) - 4} textAnchor="end" fontSize={10} fill={tinta(0.5)}>mediana {Math.round(p.medianaGanados)} %</text>
          <text x={sx(p.medianaDuelos) + 3} y={M.arr + 10} fontSize={10} fill={tinta(0.5)}>mediana {coma(p.medianaDuelos)}</text>

          {orden.map((c) => {
            const obj = esObjetivo(c);
            const color = c.poca ? tinta(0.3) : obj ? NARANJA : tinta(0.7);
            const x = sx(c.duelos);
            const y = sy(c.ganados);
            const izq = x > W - 90;
            return (
              <g key={`${c.jugador}|${c.equipo}`}>
                <title>{`${c.jugador}: ${coma(c.duelos)} duelos defensivos por 90, ${Math.round(c.ganados)} % ganados, ${coma(c.perdidos)} perdidos por 90 · ${c.minutos}′${c.poca ? ` (menos de ${MINUTOS_FIABLES_CENTRAL}′: poca muestra)` : ""}`}</title>
                {obj && <circle className="idea-aparece" cx={x} cy={y} r={11} style={{ fill: "rgba(217,95,2,0.2)", stroke: NARANJA, strokeWidth: 2 }} />}
                <circle cx={x} cy={y} r={obj ? 4.5 : 3.5} fill={c.titular || obj ? color : "transparent"} stroke={color} strokeWidth={1.5} strokeDasharray={c.poca ? "2 2" : undefined} />
                <text
                  x={x + (izq ? -(obj ? 14 : 6) : obj ? 14 : 6)}
                  y={y + 3.5}
                  textAnchor={izq ? "end" : "start"}
                  className={obj ? "fuente-club" : undefined}
                  fontSize={obj ? 13 : 10}
                  fontWeight={obj ? 700 : 500}
                  style={{ fill: c.poca ? tinta(0.4) : obj ? tinta(0.92) : tinta(0.7), textTransform: obj ? "uppercase" : undefined }}
                >
                  {apellido(c.jugador)}
                  {c.poca ? " ⚠" : ""}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex flex-col gap-2 text-xs">
          {objetivo ? (
            <div>
              <p className="text-white/45">El que más duelos pierde</p>
              <p className="fuente-club text-[22px] font-bold uppercase leading-tight" style={{ color: NARANJA }}>{apellido(objetivo.jugador)}</p>
              <p className="tabular-nums text-white/55">
                Pierde {coma(objetivo.perdidos)} duelos defensivos por 90: {coma(objetivo.duelos)} por 90 y gana el {Math.round(objetivo.ganados)} % (mediana de los centrales: {coma(p.medianaDuelos)} y {Math.round(p.medianaGanados)} %).
                {objetivo.poca ? ` Sólo ${objetivo.minutos}′: poca muestra.` : ""}
              </p>
              {objetivo.aereos !== null && (
                <p className="mt-1 border-t border-white/[0.08] pt-1 text-white/55">
                  Duelos aéreos ganados:{" "}
                  <span className="fuente-club text-[18px] font-bold tabular-nums text-white">{Math.round(objetivo.aereos)} %</span>
                </p>
              )}
              <p className="mt-1 text-white/55">
                {objetivo.aereos !== null && objetivo.aereos < 50
                  ? `Cargar a ${delantero} sobre él y dirigir ahí los balones largos y los centros.`
                  : `Cargar a ${delantero} sobre él en el juego al pie; por arriba se defiende mejor, los centros mejor al otro.`}
              </p>
            </div>
          ) : null}
          <p className="mt-auto text-[11px] leading-snug text-white/45">
            Rayas: mediana de los centrales de la categoría (90′ o más). Punto lleno: en su once. Zona en oro: muchos duelos y por debajo de la mediana del acierto.
            {pocos.length > 0 && ` En gris y con ⚠, menos de ${MINUTOS_FIABLES_CENTRAL}′: ${pocos.map((c) => `${apellido(c.jugador)} (${c.minutos}′)`).join(", ")}; su cifra es poco fiable.`}
          </p>
        </div>
      </div>
    </div>
  );
}
