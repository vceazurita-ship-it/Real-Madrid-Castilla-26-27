"use client";

/**
 * PERFIL DE REMATE de un jugador del Castilla, con `opta:castilla` (todas las
 * métricas de jugador): las cifras de remate y tres repartos —zona, parte del
 * cuerpo y situación— con los goles de cada parte.
 *
 * Los repartos cuentan los remates SIN los bloqueados, que es como Opta parte
 * por zona y por pie: así las partes suman lo mismo que el total.
 */

import { ORO, tinta } from "@/components/data/graficas";
import { num } from "@/lib/opta";
import type { Fila } from "@/lib/opta-analisis";

import { fmt } from "./comun";

type Parte = { nombre: string; remates: number; goles: number; color: string };

const COLORES = ["#C8A96B", "#4F8FE8", "#1B9E77"];

function Reparto({ titulo, partes }: { titulo: string; partes: Parte[] }) {
  const total = partes.reduce((s, p) => s + p.remates, 0);
  if (!total) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{titulo}</p>
      <div className="flex h-3 overflow-hidden rounded-full" style={{ background: tinta(0.08) }}>
        {partes.map((p) =>
          p.remates ? <span key={p.nombre} style={{ width: `${(p.remates / total) * 100}%`, background: p.color }} title={`${p.nombre}: ${p.remates}`} /> : null,
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/65">
        {partes
          .filter((p) => p.remates)
          .map((p) => (
            <span key={p.nombre} className="inline-flex items-center gap-1">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.nombre} {p.remates}
              {p.goles ? <span className="font-semibold text-white/85">· {p.goles} {p.goles === 1 ? "gol" : "goles"}</span> : null}
            </span>
          ))}
      </div>
    </div>
  );
}

export function PerfilRemate({ fila }: { fila: Fila }) {
  const n = (a: string) => num(fila[a]) ?? 0;
  const remates = n("ShtIncBl");
  if (!remates) return null;

  const xg = num(fila.ExpG);
  const sinBloqueo = n("Shot");
  const balonParado = n("ShtStPly");

  const cifras: { rotulo: string; valor: string }[] = [
    { rotulo: "Remates", valor: String(remates) },
    { rotulo: "Goles", valor: String(n("Goal")) },
    { rotulo: "xG", valor: fmt(xg, "decimal") },
    { rotulo: "xG por remate", valor: fmt(num(fila["ExpG/Shot"]), "decimal") },
    { rotulo: "A puerta", valor: fmt(num(fila["OnTarget%"]) != null ? num(fila["OnTarget%"])! * 100 : null, "porcentaje") },
    { rotulo: "Distancia media", valor: num(fila.ShotDist) != null ? `${fmt(num(fila.ShotDist), "decimal")} m` : "" },
    { rotulo: "Goles − xG", valor: xg != null ? `${n("Goal") - xg >= 0 ? "+" : ""}${fmt(n("Goal") - xg, "decimal")}` : "" },
    { rotulo: "Al primer toque", valor: n("FirstTimeShot") ? String(n("FirstTimeShot")) : "" },
  ].filter((c) => c.valor);

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-white">Perfil de remate</h3>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cifras.map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">{c.rotulo}</p>
            <p className="text-base font-semibold tabular-nums" style={{ color: c.rotulo === "Goles" ? ORO : undefined }}>
              {c.valor}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Reparto
          titulo="Zona"
          partes={[
            { nombre: "Dentro del área", remates: n("ShtInBox"), goles: n("GoalInBx"), color: COLORES[0] },
            { nombre: "Fuera del área", remates: n("ShtOBox"), goles: n("GoalOBx"), color: COLORES[1] },
          ]}
        />
        <Reparto
          titulo="Parte del cuerpo"
          partes={[
            { nombre: "Derecha", remates: n("ShotRF"), goles: n("GoalRF"), color: COLORES[0] },
            { nombre: "Izquierda", remates: n("ShotLF"), goles: n("GoalLF"), color: COLORES[1] },
            { nombre: "Cabeza", remates: n("ShtHead"), goles: n("GoalHead"), color: COLORES[2] },
          ]}
        />
        <Reparto
          titulo="Situación"
          partes={[
            { nombre: "En juego", remates: Math.max(0, sinBloqueo - balonParado), goles: n("GoalOP"), color: COLORES[0] },
            { nombre: "Balón parado", remates: balonParado, goles: n("GoalSetPly"), color: COLORES[1] },
          ]}
        />
      </div>
      <p className="mt-2 text-[11px] text-white/45">
        Los repartos cuentan los remates que no se bloquearon ({sinBloqueo} de {remates}).
        {n("PenTaken") ? ` Incluye ${n("PenTaken")} ${n("PenTaken") === 1 ? "penalti" : "penaltis"}.` : ""}
      </p>
    </div>
  );
}
