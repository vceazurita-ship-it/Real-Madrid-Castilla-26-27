"use client";

/**
 * Piezas compartidas del laboratorio de ABP: la plantilla, el nombre corto y
 * el campo pequeño donde se ve dónde va cada uno.
 *
 * El campo se pinta con los colores del tema (`--rmcf-ink-rgb`,
 * `--rmcf-gold-ink`, `--rmcf-on-gold`), así vale en día y en noche sin pasar
 * por la tabla de equivalencias.
 */

import { useMemo } from "react";

import { usePlayers } from "@/hooks/usePlayers";
import { PAPELES, etiqueta, type Papel, type Rol, type Zona } from "@/lib/abp-lab/modelo";
import type { Player } from "@/types/player";

export type JugadorLab = { id: string; nombre: string; foto: string; posicion: string; dorsal?: number };

const corto = (p: Player) => (p.apodo?.trim() || p.nombre.trim().split(/\s+/).slice(0, 2).join(" "));

/** Los jugadores del Castilla, por dorsal. */
export function useJugadoresLab() {
  const { players, loading } = usePlayers();

  const jugadores = useMemo<JugadorLab[]>(
    () =>
      players
        .filter((p) => p.esCastilla)
        .map((p) => ({ id: p.id, nombre: corto(p), foto: p.foto, posicion: p.posicion, dorsal: p.dorsal }))
        .sort((a, b) => (a.dorsal ?? 99) - (b.dorsal ?? 99) || a.nombre.localeCompare(b.nombre)),
    [players],
  );

  const porId = useMemo(() => new Map(jugadores.map((j) => [j.id, j])), [jugadores]);

  return { jugadores, porId, cargando: loading };
}

export const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/* ------------------------------------------------------------------ */
/*  EL CAMPO PEQUEÑO                                                   */
/* ------------------------------------------------------------------ */

/* Medio campo visto desde detrás de la portería: la portería arriba, el córner a la izquierda. */
const ANCLA: Record<Zona, { x: number; y: number }> = {
  "primer-palo": { x: 120, y: 44 },
  portero: { x: 160, y: 30 },
  centro: { x: 160, y: 62 },
  "segundo-palo": { x: 205, y: 48 },
  frontal: { x: 160, y: 128 },
  corto: { x: 30, y: 22 },
  atras: { x: 160, y: 182 },
};

const PAPEL_HUECO: Partial<Record<Papel, boolean>> = { senuelo: true, segunda: true, vigilancia: true };

export function MiniCampo({ roles, porId, alto = 200 }: { roles: Rol[]; porId: Map<string, JugadorLab>; alto?: number }) {
  /* Si varios caen en la misma zona, se reparten en abanico alrededor del ancla. */
  const colocados = useMemo(() => {
    const cuenta: Partial<Record<Zona, number>> = {};

    const total: Partial<Record<Zona, number>> = {};

    roles.forEach((r) => (total[r.zona] = (total[r.zona] ?? 0) + 1));

    return roles.map((r) => {
      const i = cuenta[r.zona] ?? 0;

      cuenta[r.zona] = i + 1;

      const n = total[r.zona] ?? 1;

      const base = ANCLA[r.zona];

      const dx = (i - (n - 1) / 2) * 22;

      return { r, x: base.x + dx, y: base.y + (i % 2 ? 10 : 0) };
    });
  }, [roles]);

  const tinta = (a: number) => `rgb(var(--rmcf-ink-rgb) / ${a})`;

  return (
    <svg viewBox="0 0 320 200" style={{ height: alto }} className="w-full" role="img" aria-label="Dónde va cada uno">
      <rect x="1" y="1" width="318" height="198" rx="12" style={{ fill: tinta(0.03), stroke: tinta(0.12) }} />
      {/* Área grande, área pequeña, portería y semicírculo */}
      <rect x="60" y="8" width="200" height="110" style={{ fill: "none", stroke: tinta(0.3) }} />
      <rect x="110" y="8" width="100" height="40" style={{ fill: "none", stroke: tinta(0.3) }} />
      <rect x="138" y="2" width="44" height="6" style={{ fill: tinta(0.25), stroke: tinta(0.45) }} />
      <path d="M 125 118 A 40 40 0 0 0 195 118" style={{ fill: "none", stroke: tinta(0.3) }} />
      <circle cx="160" cy="84" r="1.8" style={{ fill: tinta(0.45) }} />
      <path d="M 8 8 A 10 10 0 0 0 18 18" style={{ fill: "none", stroke: tinta(0.3) }} />

      {colocados.map(({ r, x, y }, i) => {
        const jugador = porId.get(r.jugador);

        const hueco = PAPEL_HUECO[r.papel];

        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <title>{`${jugador?.nombre ?? "Sin dueño"} · ${etiqueta(PAPELES, r.papel)}`}</title>
            <circle
              r="10"
              style={{
                fill: hueco ? tinta(0.06) : "var(--rmcf-gold-ink)",
                stroke: hueco ? "var(--rmcf-gold-ink)" : "none",
                strokeWidth: 1.5,
                strokeDasharray: r.papel === "senuelo" ? "3 2" : undefined,
              }}
            />
            <text textAnchor="middle" dy="3.5" style={{ fontSize: 8.5, fontWeight: 700, fill: hueco ? tinta(0.85) : "var(--rmcf-on-gold)" }}>
              {jugador ? (jugador.dorsal ?? iniciales(jugador.nombre)) : "?"}
            </text>
            {r.papel === "bloqueador" && <path d="M -7 13 L 7 13" style={{ stroke: "var(--rmcf-gold-ink)", strokeWidth: 2.5, strokeLinecap: "round" }} />}
          </g>
        );
      })}
    </svg>
  );
}

/** El rótulo de una fecha de fuente: «12/2024», «2024», o nada si no la da. */
export function fechaFuente(fecha: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;

  if (/^\d{4}-\d{2}$/.test(fecha)) return `${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;

  return fecha;
}
