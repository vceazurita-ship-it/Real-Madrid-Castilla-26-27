"use client";

/**
 * CÓMO DEFINE (ficha del jugador en /rivals, 19/11/2026).
 *
 * Para delanteros y mediapuntas: su punto en la nube de goles/90 frente a
 * xG/90 de los delanteros de la categoría (con la diagonal goles = xG), su xG
 * medio por remate y su % de remates de fuera del área, y una etiqueta que lo
 * resume. Las cuentas, en `lib/rivals/definicion-delantero.ts`; los datos,
 * Opta (`opta:remates`, `opta:jugadores`, `opta:equipos`), pedidos al asomar.
 *
 * Sin su fila en Opta o si no es delantero ni mediapunta, no sale nada.
 */

import { useMemo } from "react";
import { Crosshair } from "lucide-react";

import { COMPARADO, tinta } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, DOCS_OPTA, PUESTO_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo, pistaDe, rematesDe } from "@/lib/opta-eventos";
import { chipInk } from "@/lib/theme";
import { asignaPerfiles } from "@/lib/rivals/perfil-wyscout";
import {
  definicionDelantero,
  ETIQUETAS,
  MINUTOS_NUBE,
  rematesPorTirador,
  type DefinicionDelantero as Lectura,
  type Etiqueta,
} from "@/lib/rivals/definicion-delantero";

type FichaHoja = { JUGADOR?: unknown; "NOMBRE DEPORTIVO"?: unknown };

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

const COLOR: Record<Etiqueta, string> = {
  define: "#F87171",
  lejos: "#F59E0B",
  ocasiones: "#34D399",
  esperado: "#94A3B8",
};

export function DefinicionDelantero<T extends FichaHoja>({
  equipo,
  clave,
  plantilla,
  claveDe,
}: {
  equipo: string;
  /** La clave de la ficha abierta (la de `claveDe`). */
  clave: string;
  /** Toda su plantilla: el cruce de nombres es uno a uno (`asignaPerfiles`). */
  plantilla: T[];
  claveDe: (ficha: T) => string;
}) {
  /* Los remates son ~3 MB: se piden al asomar o, como muy tarde, a los 2 s. */
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);

  return (
    <div ref={caja} className="min-w-0">
      {abierto && <Bloque equipo={equipo} clave={clave} plantilla={plantilla} claveDe={claveDe} />}
    </div>
  );
}

function Bloque<T extends FichaHoja>({
  equipo,
  clave,
  plantilla,
  claveDe,
}: {
  equipo: string;
  clave: string;
  plantilla: T[];
  claveDe: (ficha: T) => string;
}) {
  const { docs } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.equipos, DOCS_OPTA.jugadores, DOCS_OPTA.remates);
  const [tEquipos, tJugadores, tRemates] = docs;

  const jugadores = useMemo(() => aObjetos(tJugadores), [tJugadores]);
  const equipos = useMemo(
    () => aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") })),
    [tEquipos],
  );
  const tiros = useMemo(
    () => (tRemates && jugadores.length ? rematesPorTirador(rematesDe(tRemates, pistaDe(jugadores))) : null),
    [tRemates, jugadores],
  );

  /* Su fila de Opta: entre los de su equipo, cruzando la plantilla entera. */
  const suya = useMemo(() => {
    if (!equipos.length || !jugadores.length) return null;
    const teamId = casaEquipo(equipo, equipos);
    if (!teamId) return null;
    const delEquipo = jugadores
      .filter((f) => String(f.teamId ?? "") === teamId)
      .map((f) => ({ jugador: String(f.jugador ?? ""), fila: f }));
    return asignaPerfiles(plantilla, delEquipo, claveDe).get(clave)?.fila ?? null;
  }, [equipos, jugadores, equipo, plantilla, claveDe, clave]);

  const lectura = useMemo(
    () => (suya && tiros ? definicionDelantero(suya, jugadores, tiros, (p) => PUESTO_OPTA[p] ?? p) : null),
    [suya, tiros, jugadores],
  );

  if (!lectura) return null;

  return <Tarjeta l={lectura} />;
}

function Tarjeta({ l }: { l: Lectura }) {
  const { yo } = l;
  const etiqueta = l.etiqueta ? ETIQUETAS[l.etiqueta] : null;
  const color = l.etiqueta ? COLOR[l.etiqueta] : null;

  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
          <Crosshair size={12} className="text-[#C8A96B]" />
          Cómo define · contra los delanteros de la categoría
        </h3>
        <span className="text-[10px] text-white/40">
          Opta · esta temporada · {yo.minutos}′ · sin penaltis{l.puesto ? ` · ${l.puesto}` : ""}
        </span>
      </header>

      {etiqueta && color && (
        <div className="mb-3 min-w-0">
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: chipInk(color), borderColor: `${color}66`, background: `${color}1A` }}
          >
            {etiqueta.texto}
          </span>
          <p className="mt-1.5 text-[12px] text-white/75">{etiqueta.orden}</p>
        </div>
      )}
      <p className="mb-3 text-[11px] text-white/50">{l.porque}</p>

      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Nube l={l} color={color ?? COMPARADO} />

        <dl className="grid min-w-0 content-start gap-3 text-[12px]">
          <Cifra
            nombre="Goles/90 · xG/90"
            valor={`${coma(yo.goles90)} · ${coma(yo.xg90)}`}
            nota={`${yo.goles} ${yo.goles === 1 ? "gol" : "goles"} con ${coma(yo.xg, 1)} de xG`}
          />
          <Cifra
            nombre="xG medio por remate"
            valor={l.xgPorRemate != null ? coma(l.xgPorRemate) : "—"}
            nota={`${yo.remates} ${yo.remates === 1 ? "remate" : "remates"}${l.medianaXgPorRemate != null ? ` · mediana de los delanteros ${coma(l.medianaXgPorRemate)}` : ""}`}
          />
          <Cifra
            nombre="Remates desde fuera del área"
            valor={l.pctFuera != null ? `${Math.round(l.pctFuera)} %` : "—"}
            nota={`${yo.fuera} de ${yo.remates}${l.medianaPctFuera != null ? ` · mediana de los delanteros ${Math.round(l.medianaPctFuera)} %` : ""}`}
          />
        </dl>
      </div>

      <p className="mt-3 text-[10px] text-white/35">
        Cada punto gris, un delantero de la categoría con {MINUTOS_NUBE}′ o más ({l.nube.length}). Por encima de la diagonal marca más de lo que dicen sus ocasiones; por debajo, menos. «Fuera del área» = el remate sale de fuera del rectángulo grande. Sin penaltis en goles ni en xG.
      </p>
    </section>
  );
}

function Cifra({ nombre, valor, nota }: { nombre: string; valor: string; nota: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-white/40">{nombre}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-white">{valor}</dd>
      <dd className="text-[10px] text-white/45">{nota}</dd>
    </div>
  );
}

function Nube({ l, color }: { l: Lectura; color: string }) {
  const W = 360;
  const H = 260;
  const M = { arriba: 10, derecha: 12, abajo: 34, izquierda: 40 };
  const dentroW = W - M.izquierda - M.derecha;
  const dentroH = H - M.arriba - M.abajo;

  const todos = [...l.nube, l.yo];
  /* Los dos ejes con la misma escala: así la diagonal es de verdad goles = xG. */
  const tope = Math.max(0.3, ...todos.map((p) => Math.max(p.goles90, p.xg90))) * 1.08;

  const px = (v: number) => M.izquierda + (Math.min(v, tope) / tope) * dentroW;
  const py = (v: number) => M.arriba + dentroH - (Math.min(v, tope) / tope) * dentroH;

  const paso = tope > 1.2 ? 0.5 : tope > 0.6 ? 0.2 : 0.1;
  const marcas: number[] = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) marcas.push(Math.round(v * 100) / 100);

  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Goles por 90 frente a xG por 90 de los delanteros de la categoría; ${l.yo.jugador}, resaltado`}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={px(m)} x2={px(m)} y1={M.arriba} y2={M.arriba + dentroH} stroke={tinta(0.06)} />
            <line x1={M.izquierda} x2={M.izquierda + dentroW} y1={py(m)} y2={py(m)} stroke={tinta(0.06)} />
            <text x={px(m)} y={H - M.abajo + 14} textAnchor="middle" fontSize={9} fill={tinta(0.45)}>
              {coma(m, 1)}
            </text>
            <text x={M.izquierda - 6} y={py(m) + 3} textAnchor="end" fontSize={9} fill={tinta(0.45)}>
              {coma(m, 1)}
            </text>
          </g>
        ))}

        <line x1={px(0)} y1={py(0)} x2={px(tope)} y2={py(tope)} stroke={tinta(0.35)} strokeDasharray="4 4" />
        <text x={px(tope) - 4} y={py(tope) + 12} textAnchor="end" fontSize={9} fill={tinta(0.5)}>
          goles = xG
        </text>

        {l.nube.map((p) => (
          <circle key={p.playerId} cx={px(p.xg90)} cy={py(p.goles90)} r={3} fill={tinta(0.22)}>
            <title>{`${p.jugador} (${p.equipo}): ${coma(p.goles90)} goles/90 · ${coma(p.xg90)} xG/90 · ${p.minutos}′`}</title>
          </circle>
        ))}

        <circle cx={px(l.yo.xg90)} cy={py(l.yo.goles90)} r={6.5} fill={color} stroke={tinta(0.85)} strokeWidth={1.2}>
          <title>{`${l.yo.jugador}: ${coma(l.yo.goles90)} goles/90 · ${coma(l.yo.xg90)} xG/90`}</title>
        </circle>

        <text x={M.izquierda + dentroW / 2} y={H - 4} textAnchor="middle" fontSize={10} fill={tinta(0.55)}>
          xG/90 (sin penaltis)
        </text>
        <text x={12} y={M.arriba + dentroH / 2} textAnchor="middle" fontSize={10} fill={tinta(0.55)} transform={`rotate(-90 12 ${M.arriba + dentroH / 2})`}>
          Goles/90
        </text>
      </svg>
    </figure>
  );
}

export default DefinicionDelantero;
