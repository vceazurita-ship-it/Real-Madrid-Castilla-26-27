/**
 * EL RIVAL CON LÍNEA DE 5 Y CON LÍNEA DE 4: QUÉ CAMBIA
 * (Scout colectivo, 21/11/2026, idea de X).
 *
 * Con los «Team Stats» de Wyscout de esta temporada (una fila por equipo y
 * partido), se parten los partidos del rival según el sistema que trae
 * Wyscout en cada uno (columna «Seleccionar esquema», p. ej.
 * «3-5-2 (70.4%) 4-4-2 (29.6%)»): el de más tiempo manda. Empieza por 3 o
 * por 5 → con 3 centrales (línea de 5); empieza por 4 → con 4 defensas.
 *
 * Por partido: xG en contra y remates en contra (columnas del propio equipo;
 * el xG en contra lo cruza `conXgEnContra`), PPDA, centros que le hacen (los
 * «Centros» del otro equipo en esa misma fila de partido) y puntos.
 *
 * El sistema «que va a usar» es el de más partidos de sus últimos 3. Si en
 * la temporada ha jugado de las dos maneras, el cambio es el primer partido
 * de su racha actual con ese sistema.
 *
 * Funciones puras: ni una cifra de Wyscout aquí (el repositorio es público).
 */

import type { FilaPartido } from "@/lib/data-analisis/leer";

export type Linea = "3" | "4";
export const LINEAS: Linea[] = ["3", "4"];

/** Partidos recientes que deciden el sistema por defecto. */
export const ULTIMOS = 3;

/** El sistema de más tiempo del partido («3-5-2»), o "" si no lo trae. */
export function sistemaPrincipal(esquema: string): string {
  const trozos = [...(esquema || "").matchAll(/(\d(?:-\d)+)\s*\(([\d.,]+)\s*%?\)/g)].map((m) => ({
    sistema: m[1],
    tiempo: Number(m[2].replace(",", ".")) || 0,
  }));
  return trozos.sort((a, b) => b.tiempo - a.tiempo)[0]?.sistema || /\d(?:-\d)+/.exec(esquema || "")?.[0] || "";
}

export function lineaDe(sistema: string): Linea | null {
  const d = sistema.charAt(0);
  if (d === "3" || d === "5") return "3";
  if (d === "4") return "4";
  return null;
}

export type PartidoLinea = {
  fecha: string;
  rival: string;
  /** Su n.º de partido de liga en la temporada (1 = el primero). */
  orden: number;
  sistema: string;
  linea: Linea;
  xgContra: number | null;
  remContra: number | null;
  ppda: number | null;
  centrosContra: number | null;
  puntos: number;
  marcador: string;
};

const num = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Los partidos de `equipo` (nombre tal y como viene en Wyscout) en `filas`,
 * de la competición dada, del más antiguo al más reciente.
 */
export function partidosConLinea(filas: FilaPartido[], equipo: string, competicion: string): PartidoLinea[] {
  const porEncuentro = new Map<string, FilaPartido[]>();
  for (const f of filas) {
    const k = `${f.fecha}|${f.partido}`;
    const l = porEncuentro.get(k);
    if (l) l.push(f);
    else porEncuentro.set(k, [f]);
  }
  const suyos = filas
    .filter((f) => f.equipo === equipo && (!competicion || f.competicion === competicion))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fuera: PartidoLinea[] = [];
  suyos.forEach((f, i) => {
    const sistema = sistemaPrincipal(f.esquema);
    const linea = lineaDe(sistema);
    if (!linea) return;
    const otro = (porEncuentro.get(`${f.fecha}|${f.partido}`) ?? []).find((o) => o.equipo !== f.equipo);
    const puntos = f.golesFavor > f.golesContra ? 3 : f.golesFavor === f.golesContra ? 1 : 0;
    fuera.push({
      fecha: f.fecha,
      rival: f.rival,
      orden: i + 1,
      sistema,
      linea,
      xgContra: num(f.datos["xG en contra"]),
      remContra: num(f.datos["Tiros en contra"]),
      ppda: num(f.datos["PPDA"]),
      centrosContra: otro ? num(otro.datos["Centros"]) : null,
      puntos,
      marcador: `${f.golesFavor}-${f.golesContra}`,
    });
  });
  return fuera;
}

export type ResumenLinea = {
  partidos: number;
  xgContra: number | null;
  remContra: number | null;
  ppda: number | null;
  centrosContra: number | null;
  puntos: number | null;
  sistemas: { sistema: string; n: number }[];
};

const mediaDe = (v: (number | null)[]) => {
  const ok = v.filter((x): x is number => x != null);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
};

export function resumeLinea(partidos: PartidoLinea[]): ResumenLinea {
  const cuenta = new Map<string, number>();
  for (const p of partidos) cuenta.set(p.sistema, (cuenta.get(p.sistema) ?? 0) + 1);
  return {
    partidos: partidos.length,
    xgContra: mediaDe(partidos.map((p) => p.xgContra)),
    remContra: mediaDe(partidos.map((p) => p.remContra)),
    ppda: mediaDe(partidos.map((p) => p.ppda)),
    centrosContra: mediaDe(partidos.map((p) => p.centrosContra)),
    puntos: mediaDe(partidos.map((p) => p.puntos)),
    sistemas: [...cuenta.entries()].map(([sistema, n]) => ({ sistema, n })).sort((a, b) => b.n - a.n),
  };
}

/** El sistema de más partidos en sus últimos 3 (empate: el del último). */
export function lineaReciente(partidos: PartidoLinea[]): Linea | null {
  const ult = partidos.slice(-ULTIMOS);
  if (!ult.length) return null;
  const tres = ult.filter((p) => p.linea === "3").length;
  const cuatro = ult.length - tres;
  if (tres === cuatro) return ult[ult.length - 1].linea;
  return tres > cuatro ? "3" : "4";
}

/**
 * El cambio: si ha jugado de las dos maneras, el primer partido de su racha
 * actual con el sistema reciente. null si nunca ha cambiado.
 */
export function cambioDeLinea(partidos: PartidoLinea[], reciente: Linea | null): PartidoLinea | null {
  if (!reciente || !partidos.some((p) => p.linea !== reciente)) return null;
  let i = partidos.length - 1;
  while (i >= 0 && partidos[i].linea !== reciente) i--;
  if (i < 0) return null;
  while (i > 0 && partidos[i - 1].linea === reciente) i--;
  return i > 0 ? partidos[i] : null;
}
