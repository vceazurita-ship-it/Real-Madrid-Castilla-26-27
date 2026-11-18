/**
 * EL RIVAL SEGÚN EL MARCADOR (Scout colectivo, 16/11/2026): cómo juega
 * ganando, empatando y perdiendo, por cada 90 minutos jugados en ese estado,
 * y la línea de cada partido con el minuto en que cambió el marcador.
 *
 * Fuentes (Opta, las que hay para TODOS los equipos de la categoría):
 * - `opta:remates` (ya sin la fila repetida, `rematesDe`): los goles dan la
 *   línea del marcador; los remates y el xG, a favor y en contra, van al
 *   estado que dice su `MatchState` (visto desde el que remata: el «ganando»
 *   de su contrario es el «perdiendo» del rival).
 * - `opta:momento` (`momentoDe`, tramos de 5′): posesión, toques en el último
 *   tercio y balones ganados en el último tercio. Cada tramo se reparte entre
 *   los estados por los segundos que pasa en cada uno (si el gol cae a mitad
 *   del tramo, la mitad va a cada lado).
 *
 * Lo que Opta no trae partido a partido para cualquier equipo (el pase a pase
 * con destino, la altura de cada acción defensiva, los centros) no se
 * inventa: la altura defensiva se lee con los balones ganados en el último
 * tercio y el juego en campo contrario con la posesión y los toques en el
 * último tercio. Los centros no salen.
 *
 * El reloj va en el eje de `segundoEnEje`: el descuento de la primera parte
 * se cuenta en el 45′ y el partido acaba en el 90′ o en lo último que se ve
 * (último remate o tramo del descuento).
 *
 * Un partido cuyos goles en `opta:remates` no cuadran con el resultado de
 * `opta:partidos` (gol en propia puerta, que no es un remate) no entra en las
 * cuentas: su línea sale, avisando.
 */

import { momentoDe, rematesDe, segundoEnEje, type Pista, type Remate } from "@/lib/opta-eventos";
import { partidosDe, type Fila } from "@/lib/opta-analisis";
import type { TablaOpta } from "@/lib/opta";

export type Estado = "ganando" | "empatando" | "perdiendo";
export const ESTADOS: Estado[] = ["ganando", "empatando", "perdiendo"];
export const NOMBRE_ESTADO: Record<Estado, string> = { ganando: "Va ganando", empatando: "Va empatando", perdiendo: "Va perdiendo" };

export type ClaveMetrica = "remates" | "xg" | "xgc" | "posesion" | "tercio" | "robosArriba";

export const METRICAS: { clave: ClaveMetrica; rotulo: string; unidad: "/90" | "%"; decimales: number; nota: string }[] = [
  { clave: "remates", rotulo: "Remates", unidad: "/90", decimales: 1, nota: "Sus remates, con los bloqueados" },
  { clave: "xg", rotulo: "xG a favor", unidad: "/90", decimales: 2, nota: "El xG de sus remates" },
  { clave: "xgc", rotulo: "xG en contra", unidad: "/90", decimales: 2, nota: "El xG de los remates que le hacen" },
  { clave: "posesion", rotulo: "Posesión", unidad: "%", decimales: 0, nota: "Media de los tramos de 5′, pesada por el tiempo en ese estado" },
  { clave: "tercio", rotulo: "Toques en el último tercio", unidad: "/90", decimales: 1, nota: "Cuánto vive en campo contrario" },
  { clave: "robosArriba", rotulo: "Balones ganados arriba", unidad: "/90", decimales: 1, nota: "Ganados en el último tercio: la altura a la que defiende" },
];

type Suma = { seg: number; remates: number; xg: number; xgc: number; posSeg: number; posPeso: number; tercio: number; robosArriba: number };
const vacia = (): Suma => ({ seg: 0, remates: 0, xg: 0, xgc: 0, posSeg: 0, posPeso: 0, tercio: 0, robosArriba: 0 });

export type ValorEstado = { valor: number | null; desvio: number | null };
export type ColumnaEstado = { estado: Estado; minutos: number; valores: Record<ClaveMetrica, ValorEstado> };

export type Tramo = { desde: number; hasta: number; estado: Estado };
/** `segundo` es el del eje (descuento de la 1.ª parte en el 45′); `parte` y `reloj`, los de Opta, para el vídeo del gol (18/11/2026). */
export type Gol = { segundo: number; minuto: string; suyo: boolean; marcador: string; parte: number; reloj: number };
export type LineaPartido = {
  partido: string;
  fecha: string;
  rival: string;
  gf: number | null;
  gc: number | null;
  fin: number;
  tramos: Tramo[];
  goles: Gol[];
  /** No entra en las cuentas: sus goles no cuadran con el resultado. */
  cuadra: boolean;
  /** Minutos que estuvo ganando y remates que hizo entonces (para la lectura). */
  minGanando: number;
};

export type SegunMarcador = {
  partidos: number;
  descartados: number;
  media: Record<ClaveMetrica, number | null>;
  columnas: ColumnaEstado[];
  lineas: LineaPartido[];
};

/** Por debajo de 90′ en un estado, no se marca nada (es un partido, no un patrón). */
export const MINUTOS_MINIMOS = 90;
/** Lo que se aparta más de un 25 % de su media, en rojo. */
export const UMBRAL = 0.25;

const ejeDe = (r: Pick<Remate, "parte" | "segundo">) => segundoEnEje(r.parte, r.segundo);

const estadoDe = (gf: number, gc: number): Estado => (gf > gc ? "ganando" : gf < gc ? "perdiendo" : "empatando");

/** El estado del rival en un remate: el MatchState es del que remata. */
function estadoRemate(r: Remate, suyo: boolean): Estado | null {
  const m = r.marcador;
  if (m === "Tied") return "empatando";
  if (m === "Ahead") return suyo ? "ganando" : "perdiendo";
  if (m === "Behind") return suyo ? "perdiendo" : "ganando";
  return null;
}

/** El minuto como se dice: 45+2′ en el descuento de la primera parte, 90+3′ en el de la segunda. */
function minutoTexto(r: Remate): string {
  const m = Math.floor(r.segundo / 60) + 1;
  if (r.parte === 1 && m > 45) return `45+${m - 45}′`;
  if (r.parte === 2 && m > 90) return `90+${m - 90}′`;
  return `${m}′`;
}

const estadoEn = (tramos: Tramo[], t: number): Estado => (tramos.find((x) => t >= x.desde && t < x.hasta) ?? tramos[tramos.length - 1]).estado;

/** Cómo juega el rival según el marcador, en todos sus partidos con Opta. */
export function segunMarcador(partidos: Fila[], remates: TablaOpta | null, momento: TablaOpta | null, rivalId: string, pista: Pista): SegunMarcador | null {
  const todos = rematesDe(remates, pista);
  if (!todos.length) return null;
  const mom = momentoDe(momento);
  const porPartido = new Map<string, Remate[]>();
  for (const r of todos) {
    if (r.teamId !== rivalId && r.rivalId !== rivalId) continue;
    porPartido.set(r.partido, [...(porPartido.get(r.partido) ?? []), r]);
  }

  const sumas: Record<Estado, Suma> = { ganando: vacia(), empatando: vacia(), perdiendo: vacia() };
  const lineas: LineaPartido[] = [];
  let descartados = 0;

  for (const p of partidosDe(partidos, rivalId)) {
    const id = String(p.fila.partido ?? "");
    const rs = (porPartido.get(id) ?? []).slice().sort((a, b) => a.parte - b.parte || a.segundo - b.segundo);
    const golesR = rs.filter((r) => r.gol);
    const aFavor = golesR.filter((r) => r.teamId === rivalId).length;
    const enContra = golesR.length - aFavor;
    const cuadra = p.gf != null && p.gc != null && aFavor === p.gf && enContra === p.gc;
    /* Sin remates ni tramos, el partido no se descargó evento a evento. */
    const mp = mom.get(id);
    if (!rs.length && !mp) continue;

    const suyoMom = mp?.equipos.find((e) => e.teamId === rivalId);
    const ultimoTramo = suyoMom ? Math.max(...suyoMom.tramos.keys()) : 0;
    const fin = Math.max(5400, ...rs.map((r) => ejeDe(r) + 1), ultimoTramo >= 18 ? ultimoTramo * 300 + 150 : 0);

    const tramos: Tramo[] = [];
    const goles: Gol[] = [];
    let gf = 0;
    let gc = 0;
    let desde = 0;
    for (const g of golesR) {
      const t = ejeDe(g);
      if (t > desde) tramos.push({ desde, hasta: t, estado: estadoDe(gf, gc) });
      desde = Math.max(desde, t);
      const suyo = g.teamId === rivalId;
      if (suyo) gf++;
      else gc++;
      goles.push({ segundo: t, minuto: minutoTexto(g), suyo, marcador: `${gf}-${gc}`, parte: g.parte, reloj: g.segundo });
    }
    tramos.push({ desde, hasta: fin, estado: estadoDe(gf, gc) });

    const minGanando = tramos.filter((x) => x.estado === "ganando").reduce((s, x) => s + (x.hasta - x.desde) / 60, 0);
    lineas.push({ partido: id, fecha: p.fecha, rival: p.rival, gf: p.gf, gc: p.gc, fin, tramos, goles, cuadra, minGanando });
    if (!cuadra) {
      descartados++;
      continue;
    }

    for (const x of tramos) sumas[x.estado].seg += x.hasta - x.desde;
    for (const r of rs) {
      const suyo = r.teamId === rivalId;
      const e = estadoRemate(r, suyo) ?? estadoEn(tramos, ejeDe(r));
      if (suyo) {
        sumas[e].remates++;
        sumas[e].xg += r.xG;
      } else sumas[e].xgc += r.xG;
    }

    /* Los tramos de 5′, repartidos por el tiempo que pasan en cada estado. */
    for (const t of suyoMom?.tramos.values() ?? []) {
      const a = t.tramo * 300;
      const b = Math.min(a + 300, fin);
      const partes = tramos.map((x) => ({ estado: x.estado, s: Math.max(0, Math.min(b, x.hasta) - Math.max(a, x.desde)) })).filter((x) => x.s > 0);
      const total = partes.reduce((s, x) => s + x.s, 0);
      const reparto = total > 0 ? partes.map((x) => ({ estado: x.estado, f: x.s / total, s: x.s })) : [{ estado: tramos[tramos.length - 1].estado, f: 1, s: 0 }];
      for (const { estado, f, s } of reparto) {
        const su = sumas[estado];
        su.tercio += t.toquesUltimoTercio * f;
        su.robosArriba += t.recuperacionesArriba * f;
        if (t.posesion != null && s > 0) {
          su.posSeg += s;
          /* Opta la da de 0 a 1 (alguna descarga, de 0 a 100). */
          su.posPeso += (t.posesion > 1 ? t.posesion : t.posesion * 100) * s;
        }
      }
    }
  }

  const contados = lineas.filter((l) => l.cuadra).length;
  if (!contados) return null;

  const valoresDe = (s: Suma): Record<ClaveMetrica, number | null> => {
    const p90 = (v: number) => (s.seg > 0 ? (v / s.seg) * 5400 : null);
    return {
      remates: p90(s.remates),
      xg: p90(s.xg),
      xgc: p90(s.xgc),
      posesion: s.posSeg > 0 ? s.posPeso / s.posSeg : null,
      tercio: p90(s.tercio),
      robosArriba: p90(s.robosArriba),
    };
  };

  const total = ESTADOS.reduce((acc, e) => {
    const s = sumas[e];
    return {
      seg: acc.seg + s.seg,
      remates: acc.remates + s.remates,
      xg: acc.xg + s.xg,
      xgc: acc.xgc + s.xgc,
      posSeg: acc.posSeg + s.posSeg,
      posPeso: acc.posPeso + s.posPeso,
      tercio: acc.tercio + s.tercio,
      robosArriba: acc.robosArriba + s.robosArriba,
    };
  }, vacia());
  const media = valoresDe(total);

  const columnas: ColumnaEstado[] = ESTADOS.map((estado) => {
    const s = sumas[estado];
    const minutos = s.seg / 60;
    const v = valoresDe(s);
    const valores = Object.fromEntries(
      METRICAS.map(({ clave }) => {
        const valor = v[clave];
        const m = media[clave];
        const desvio = valor != null && m != null && m > 0 && minutos >= MINUTOS_MINIMOS ? valor / m - 1 : null;
        return [clave, { valor, desvio }];
      }),
    ) as Record<ClaveMetrica, ValorEstado>;
    return { estado, minutos, valores };
  });

  lineas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { partidos: contados, descartados, media, columnas, lineas };
}

export const marcado = (v: ValorEstado) => v.desvio != null && Math.abs(v.desvio) > UMBRAL;

/**
 * La frase: ganando, ¿se repliega o sigue apretando? Se mira la posesión,
 * los toques en el último tercio y los balones ganados arriba frente a su
 * media. Sólo si ha estado ganando al menos 90′.
 */
export function lecturaMarcador(s: SegunMarcador, nombre: string): string | null {
  const g = s.columnas.find((c) => c.estado === "ganando");
  if (!g || g.minutos < MINUTOS_MINIMOS) return null;
  const d = (k: ClaveMetrica) => g.valores[k].desvio;
  const senales = [d("posesion"), d("tercio"), d("robosArriba")].filter((x): x is number => x != null);
  if (!senales.length) return null;
  const abajo = senales.filter((x) => x <= -0.15).length;
  const arriba = senales.filter((x) => x >= 0.05).length;
  const xgc = d("xgc");
  const concede = xgc != null && xgc > UMBRAL ? " y le llegan más" : xgc != null && xgc < -UMBRAL ? " y le llegan menos" : "";
  if (abajo >= 2) return `Cuando ${nombre} se adelanta, se repliega: menos balón y menos campo contrario que en su media${concede}.`;
  if (arriba >= 2 || (arriba >= 1 && abajo === 0)) return `Cuando ${nombre} se adelanta, sigue apretando: mantiene el balón y la altura de su media${concede}.`;
  return null;
}

/** Para el texto de la columna: «312′ en 9 partidos». */
export const minutosTexto = (m: number) => `${Math.round(m)}′`;

/** El número de la celda. */
export function valorTexto(v: number | null, unidad: "/90" | "%", decimales: number): string {
  if (v == null) return "";
  const t = v.toFixed(decimales).replace(".", ",");
  return unidad === "%" ? `${t} %` : t;
}

/** El resultado como se lee: «2-1». */
export const resultado = (l: LineaPartido) => (l.gf != null && l.gc != null ? `${l.gf}-${l.gc}` : "");
