/**
 * REVULSIVOS (Plantillas rivales, 16/11/2026): quién le cambia el partido al
 * rival saliendo desde el banquillo.
 *
 * Fuentes (Opta, para todos los equipos de la categoría):
 * - `opta:jugadores-partidos` (jugador × partido): `GS` (1 = titular), `Min`,
 *   `Goal`, `Ast`. Suplente = GS distinto de 1 y con minutos. Sólo cuenta lo
 *   hecho con ESTE equipo (`teamId`).
 * - `opta:remates` (ya de uno en uno, `rematesDe`): por dónde remata en los
 *   partidos que entra (su `y`; 0 = banda derecha del que ataca). Opta no trae
 *   el toque a toque de los rivales, así que la banda sale de sus remates y
 *   sólo si tiene dos o más.
 *
 * El minuto de entrada es aproximado: 90 − minutos jugados (Opta no da el
 * minuto del cambio en este documento; el descuento lo adelanta un poco).
 *
 * DESTACADO: 90′ o más como suplente, G+A/90 entrando de 0,3 o más y, si
 * también ha sido titular 90′ o más, al menos 1,5 veces lo que hace de
 * titular (si nunca ha sido titular, basta lo primero).
 */

import { num } from "@/lib/opta";
import type { Fila } from "@/lib/opta-analisis";
import type { Remate } from "@/lib/opta-eventos";

export type Banda = "derecha" | "centro" | "izquierda";
export const NOMBRE_BANDA: Record<Banda, string> = { derecha: "Derecha", centro: "Por dentro", izquierda: "Izquierda" };

export type Revulsivo = {
  playerId: string;
  jugador: string;
  entradas: number;
  minSup: number;
  golesSup: number;
  asistSup: number;
  /** G+A por 90 como suplente (null por debajo de 45′). */
  ga90Sup: number | null;
  titularidades: number;
  minTit: number;
  /** G+A por 90 como titular (null por debajo de 90′). */
  ga90Tit: number | null;
  /** Minuto medio aproximado de su entrada. */
  minutoEntrada: number | null;
  /** Banda de sus remates tras entrar (null con menos de dos). */
  banda: Banda | null;
  rematesSup: number;
  destacado: boolean;
};

const bandaDe = (y: number): Banda => (y < 37 ? "derecha" : y > 63 ? "izquierda" : "centro");

export function revulsivos(filas: Fila[], remates: Remate[], teamId: string): Revulsivo[] {
  type Acum = Omit<Revulsivo, "ga90Sup" | "ga90Tit" | "minutoEntrada" | "banda" | "destacado" | "rematesSup"> & {
    gaTit: number;
    sumaEntrada: number;
    partidosSup: Set<string>;
  };
  const porJugador = new Map<string, Acum>();
  for (const f of filas) {
    if (String(f.teamId ?? "") !== teamId) continue;
    const id = String(f.playerId ?? "");
    const min = num(f.Min) ?? 0;
    if (!id || !(min > 0)) continue;
    const a: Acum = porJugador.get(id) ?? {
      playerId: id,
      jugador: "",
      entradas: 0,
      minSup: 0,
      golesSup: 0,
      asistSup: 0,
      titularidades: 0,
      minTit: 0,
      gaTit: 0,
      sumaEntrada: 0,
      partidosSup: new Set(),
    };
    if (f.jugador) a.jugador = String(f.jugador);
    const goles = num(f.Goal) ?? 0;
    const asist = num(f.Ast) ?? 0;
    if (num(f.GS) === 1) {
      a.titularidades += 1;
      a.minTit += min;
      a.gaTit += goles + asist;
    } else {
      a.entradas += 1;
      a.minSup += min;
      a.golesSup += goles;
      a.asistSup += asist;
      a.sumaEntrada += Math.min(89, Math.max(1, 90 - min));
      a.partidosSup.add(String(f.partido ?? ""));
    }
    porJugador.set(id, a);
  }

  const lista: Revulsivo[] = [];
  for (const a of porJugador.values()) {
    if (a.entradas === 0) continue;
    const suyos = remates.filter((r) => r.tiradorId === a.playerId && a.partidosSup.has(r.partido));
    const cuenta: Record<Banda, number> = { derecha: 0, centro: 0, izquierda: 0 };
    for (const r of suyos) cuenta[bandaDe(r.y)] += 1;
    const banda =
      suyos.length >= 2 ? (Object.entries(cuenta).sort((x, y) => y[1] - x[1])[0][0] as Banda) : null;
    const ga90Sup = a.minSup >= 45 ? ((a.golesSup + a.asistSup) / a.minSup) * 90 : null;
    const ga90Tit = a.minTit >= 90 ? (a.gaTit / a.minTit) * 90 : null;
    const destacado =
      a.minSup >= 90 && ga90Sup != null && ga90Sup >= 0.3 && (ga90Tit == null || ga90Sup >= ga90Tit * 1.5);
    lista.push({
      playerId: a.playerId,
      jugador: a.jugador || a.playerId,
      entradas: a.entradas,
      minSup: a.minSup,
      golesSup: a.golesSup,
      asistSup: a.asistSup,
      ga90Sup,
      titularidades: a.titularidades,
      minTit: a.minTit,
      ga90Tit,
      minutoEntrada: Math.round(a.sumaEntrada / a.entradas),
      banda,
      rematesSup: suyos.length,
      destacado,
    });
  }

  lista.sort(
    (x, y) =>
      Number(y.destacado) - Number(x.destacado) ||
      y.golesSup + y.asistSup - (x.golesSup + x.asistSup) ||
      y.minSup - x.minSup,
  );
  return lista;
}

/** La frase de arriba: el que más pesa entrando, o el banquillo que más se usa. */
export function lecturaRevulsivos(lista: Revulsivo[], equipo: string): string | null {
  const d = lista.find((j) => j.destacado);
  if (d) {
    const banda = d.banda ? ` y remata sobre todo ${d.banda === "centro" ? "por dentro" : `por la ${d.banda}`}` : "";
    return `${d.jugador} es el revulsivo de ${equipo}: entra hacia el ${d.minutoEntrada}′${banda}.`;
  }
  const mas = [...lista].sort((x, y) => y.entradas - x.entradas)[0];
  if (!mas) return null;
  return `Ningún suplente de ${equipo} rinde claramente más entrando; el que más sale es ${mas.jugador} (${mas.entradas} ${mas.entradas === 1 ? "vez" : "veces"}, hacia el ${mas.minutoEntrada}′).`;
}
