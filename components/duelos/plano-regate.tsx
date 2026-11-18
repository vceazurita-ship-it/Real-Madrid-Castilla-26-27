"use client";

/**
 * El extremo rival en el plano regates intentados/90 contra completados/90,
 * con el % de duelos defensivos de nuestro lateral al lado (17/11/2026).
 * La cuenta vive en lib/duelos-regate.ts.
 */
import { ORO, tinta } from "@/components/data/graficas";
import { LECTURA_CUADRANTE, ROTULO_CUADRANTE, type RegateDelDuelo } from "@/lib/duelos-regate";

/* Rojo de alerta: se lee sobre la tarjeta clara (día) y sobre la oscura (noche). */
export const ROJO_ALERTA = "#E5484D";

const coma = (v: number, d = 1) => v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
const apellido = (nombre: string) => {
  const t = nombre.trim().split(/\s+/);
  return t.length > 1 ? t.slice(1).join(" ") : nombre;
};

const W = 320;
const H = 210;
const M = { izq: 34, der: 10, arr: 10, aba: 30 };

export function PlanoRegate({ r }: { r: RegateDelDuelo }) {
  const { plano, punto, cuadrante, defensa, alerta } = r;
  const quien = r.extremo.corto ?? apellido(r.extremo.nombre);
  const lateral = r.lateral ? (r.lateral.corto ?? apellido(r.lateral.nombre)) : "";

  const xMax = Math.max(1, ...plano.puntos.map((p) => p.intentos), punto?.intentos ?? 0) * 1.08;
  const yMax = Math.max(0.5, ...plano.puntos.map((p) => p.completados), punto?.completados ?? 0) * 1.12;
  const ancho = W - M.izq - M.der;
  const alto = H - M.arr - M.aba;
  const sx = (v: number) => M.izq + (v / xMax) * ancho;
  const sy = (v: number) => M.arr + alto - (v / yMax) * alto;

  /* La diagonal del acierto medio, cortada en el borde del plano. */
  const xFin = Math.min(xMax, yMax / plano.acierto);
  const marcasX = Array.from({ length: Math.floor(xMax) + 1 }, (_, i) => i).filter((v) => xMax <= 8 || v % 2 === 0);
  const pasoY = yMax > 4 ? 1 : 0.5;
  const marcasY = Array.from({ length: Math.floor(yMax / pasoY) + 1 }, (_, i) => i * pasoY);

  const esElSuyo = (p: { jugador: string; equipo: string }) => Boolean(r.extremo.wyscout && p.jugador === r.extremo.wyscout.jugador && p.equipo === r.extremo.wyscout.equipo);
  const nube = plano.puntos.filter((p) => !esElSuyo(p));

  return (
    <div
      className="mt-3 rounded-xl border p-3"
      style={{ borderColor: alerta ? `${ROJO_ALERTA}88` : tinta(0.1), background: alerta ? `${ROJO_ALERTA}14` : undefined }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] font-semibold text-white/80">Su extremo en el regate · los {plano.puntos.length} extremos de la categoría</p>
        {alerta && (
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${ROJO_ALERTA}22`, color: ROJO_ALERTA }}>
            ⚠ Doblar la vigilancia en esta banda
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Regates intentados contra completados por 90 de los extremos de la categoría; ${quien} resaltado`}>
          {/* Rejilla y ejes, recesivos. */}
          {marcasX.map((v) => (
            <g key={`x${v}`}>
              <line x1={sx(v)} x2={sx(v)} y1={M.arr} y2={M.arr + alto} stroke={tinta(0.06)} />
              <text x={sx(v)} y={H - M.aba + 12} textAnchor="middle" fontSize={10.5} fill={tinta(0.5)}>{v}</text>
            </g>
          ))}
          {marcasY.map((v) => (
            <g key={`y${v}`}>
              <line x1={M.izq} x2={W - M.der} y1={sy(v)} y2={sy(v)} stroke={tinta(0.06)} />
              <text x={M.izq - 4} y={sy(v) + 3} textAnchor="end" fontSize={10.5} fill={tinta(0.5)}>{coma(v, pasoY < 1 ? 1 : 0)}</text>
            </g>
          ))}
          <text x={M.izq + ancho / 2} y={H - 4} textAnchor="middle" fontSize={11} fill={tinta(0.6)}>Regates intentados / 90</text>
          <text x={10} y={M.arr + alto / 2} textAnchor="middle" fontSize={11} fill={tinta(0.6)} transform={`rotate(-90 10 ${M.arr + alto / 2})`}>Completados / 90</text>

          {/* Como el original de X: la zona buena del regate (a la derecha de la media y por encima del acierto medio), sombreada. */}
          {plano.mediaIntentos * plano.acierto < yMax && plano.mediaIntentos < xMax && (
            <polygon
              points={(xFin < xMax
                ? [[plano.mediaIntentos, plano.mediaIntentos * plano.acierto], [plano.mediaIntentos, yMax], [xFin, yMax]]
                : [[plano.mediaIntentos, plano.mediaIntentos * plano.acierto], [plano.mediaIntentos, yMax], [xMax, yMax], [xMax, xMax * plano.acierto]]
              )
                .map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`)
                .join(" ")}
              style={{ fill: "rgba(200,169,107,0.16)", stroke: "rgba(200,169,107,0.55)", strokeWidth: 1 }}
            />
          )}

          {/* Las dos líneas de la liga. */}
          <line x1={sx(plano.mediaIntentos)} x2={sx(plano.mediaIntentos)} y1={M.arr} y2={M.arr + alto} stroke={tinta(0.35)} strokeDasharray="3 3" />
          <line x1={sx(0)} y1={sy(0)} x2={sx(xFin)} y2={sy(xFin * plano.acierto)} stroke={tinta(0.35)} strokeDasharray="5 3" />

          {/* Los cuatro cuadrantes, en las esquinas. */}
          <text x={W - M.der - 2} y={M.arr + 10} textAnchor="end" fontSize={10.5} fontWeight={700} style={{ fill: ORO, letterSpacing: "0.06em" }}>{ROTULO_CUADRANTE.desequilibrante.toUpperCase()}</text>
          <text x={W - M.der - 2} y={M.arr + alto - 4} textAnchor="end" fontSize={10.5} fontWeight={600} fill={tinta(0.55)}>{ROTULO_CUADRANTE.insistente}</text>
          <text x={M.izq + 4} y={M.arr + 10} fontSize={10.5} fontWeight={600} fill={tinta(0.55)}>{ROTULO_CUADRANTE.selectivo}</text>
          <text x={sx(plano.mediaIntentos) - 4} y={M.arr + alto - 4} textAnchor="end" fontSize={10.5} fontWeight={600} fill={tinta(0.55)}>{ROTULO_CUADRANTE["no-regatea"]}</text>

          {/* La nube: cada punto dice quién es al pasar por encima. */}
          {nube.map((p) => (
            <g key={`${p.jugador}|${p.equipo}`}>
              <title>{`${p.jugador} (${p.equipo}): ${coma(p.intentos)} intentados y ${coma(p.completados)} completados por 90`}</title>
              <circle cx={sx(p.intentos)} cy={sy(p.completados)} r={7} fill="transparent" />
              <circle cx={sx(p.intentos)} cy={sy(p.completados)} r={3} fill={tinta(0.28)} />
            </g>
          ))}

          {/* El suyo, resaltado y con su nombre. */}
          {punto && (
            <g>
              <title>{`${r.extremo.nombre}: ${coma(punto.intentos)} intentados y ${coma(punto.completados)} completados por 90`}</title>
              {/* El suyo como en el original de X: un aro grande con su nombre en la letra del club. */}
              <circle className="idea-aparece" cx={sx(punto.intentos)} cy={sy(punto.completados)} r={11} style={{ fill: alerta ? `${ROJO_ALERTA}33` : "rgba(217,95,2,0.2)", stroke: alerta ? ROJO_ALERTA : "#D95F02", strokeWidth: 2 }} />
              <circle cx={sx(punto.intentos)} cy={sy(punto.completados)} r={4.5} fill={alerta ? ROJO_ALERTA : "#D95F02"} />
              <text
                x={sx(punto.intentos) + (sx(punto.intentos) > W - 90 ? -15 : 15)}
                y={sy(punto.completados) + 4.5}
                textAnchor={sx(punto.intentos) > W - 90 ? "end" : "start"}
                className="fuente-club"
                fontSize={14}
                fontWeight={700}
                style={{ fill: tinta(0.92), textTransform: "uppercase" }}
              >
                {quien}
              </text>
            </g>
          )}
        </svg>

        <div className="flex flex-col gap-2 text-xs">
          <div>
            <p className="text-white/45">{quien}</p>
            {punto && cuadrante ? (
              <>
                <p className="fuente-club text-[22px] font-bold uppercase leading-tight text-white">{ROTULO_CUADRANTE[cuadrante]}</p>
                <p className="tabular-nums text-white/55">
                  {coma(punto.intentos)} intentados y {coma(punto.completados)} completados por 90: {LECTURA_CUADRANTE[cuadrante]}.
                </p>
              </>
            ) : (
              <p className="text-white/55">Sin minutos suficientes en Wyscout para ponerlo en el plano.</p>
            )}
          </div>
          {r.lateral && defensa && (
            <div className="border-t border-white/[0.08] pt-2">
              <p className="text-white/45">{lateral} · duelos defensivos ganados</p>
              <p className="fuente-club text-[22px] font-bold tabular-nums leading-tight" style={{ color: defensa.valor < defensa.media ? (alerta ? ROJO_ALERTA : undefined) : undefined }}>
                {Math.round(defensa.valor)} %{" "}
                <span className="font-sans text-xs font-normal text-white/55">frente a {Math.round(defensa.media)} % de media de los {defensa.comparables} laterales</span>
              </p>
              <p className="text-white/55">{defensa.valor < defensa.media ? "Por debajo de la media de su puesto." : "En la media de su puesto o por encima."}</p>
            </div>
          )}
          <p className="mt-auto text-[11px] leading-snug text-white/45">
            {alerta
              ? "Desequilibrante contra un lateral por debajo de su media: ayuda del interior o del extremo en esa banda."
              : cuadrante === "desequilibrante"
                ? "Desequilibrante, pero nuestro lateral gana sus duelos como la media o mejor: se le puede dejar en el uno contra uno."
                : "Línea vertical: intentos medios de los extremos. Diagonal: el acierto medio de la liga; por encima, regatea mejor que la media."}
          </p>
        </div>
      </div>
    </div>
  );
}
