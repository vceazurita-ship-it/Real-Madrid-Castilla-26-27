/**
 * PARECIDOS: NUESTROS PARTIDOS Y NUESTRAS SESIONES (16/10/2026).
 *
 * La idea de Football Hacking («Mapping Tactical Similarities Between
 * Football Teams», 16/10/2026) aplicada sólo a lo nuestro de la 2026/27 (lo
 * pidió el cuerpo técnico): qué PARTIDOS jugamos de forma parecida (13
 * métricas de estilo de Wyscout) y qué SESIONES de entrenamiento se parecen
 * (13 rasgos de sus tareas en la hoja de registro). Cada elemento se
 * estandariza (z), el parecido es la similitud del coseno, la red une a cada
 * uno con sus más parecidos y Louvain encuentra las familias. Cada familia se
 * describe por lo que más la separa de la media.
 *
 * Parecerse no es salir igual: dos partidos pueden jugarse igual y acabar con
 * resultados opuestos. Esto mide CÓMO, no CUÁNTO de bien.
 *
 * Todo determinista (orden fijo, semilla fija): los mismos datos dan la misma red.
 */

import type { RegistroTarea } from "@/lib/abp/registro";
import type { FilaPartido } from "@/lib/data-analisis/leer";
import { METRICAS, valorEnGrupo } from "@/lib/data-analisis/metricas";

export type Rasgo = { key: string; label: string; formato?: "pct" | "dec" | "ent" };

export type Elemento = { id: string; etiqueta: string; detalle?: string; fecha: string; valores: (number | null)[] };

export type ElementoRed = Elemento & { z: number[]; comunidad: number };

export type Familia = { id: number; ids: string[]; centroide: number[]; rasgos: { rasgo: Rasgo; z: number }[] };

export type RedParecidos = {
  rasgos: Rasgo[];
  elementos: ElementoRed[];
  sim: number[][];
  aristas: { a: number; b: number; peso: number }[];
  familias: Familia[];
  simFamilias: number[][];
};

const coseno = (a: number[], b: number[]) => {
  let p = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i += 1) {
    p += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  return na && nb ? p / Math.sqrt(na * nb) : 0;
};

/* ------------------------------------------------------------------ */
/*  LOUVAIN (movimientos locales + agregación, repetido)               */
/* ------------------------------------------------------------------ */

/** `resolucion` > 1 da familias más pequeñas (Reichardt-Bornholdt). */
function louvain(n: number, aristas: { a: number; b: number; peso: number }[], resolucion = 1): number[] {
  /*
  | Cada súper-nodo arrastra su grado (la suma del de sus nodos, con el peso
  | interno incluido) y el peso total es el de la red original: si al agrupar
  | se tirara el peso interno, los grupos parecerían más débiles de lo que son
  | y acabarían fundiéndose todos en una sola familia.
  */
  let nodosDe: number[][] = Array.from({ length: n }, (_, i) => [i]);
  let enlaces = aristas.map((x) => ({ ...x }));
  let grado = new Array<number>(n).fill(0);

  for (const { a, b, peso } of aristas) {
    grado[a] += peso;
    grado[b] += peso;
  }

  const m2 = grado.reduce((s, x) => s + x, 0);

  if (!m2) return new Array<number>(n).fill(0);

  for (let nivel = 0; nivel < 10; nivel += 1) {
    const N = nodosDe.length;
    const vecinos: Map<number, number>[] = Array.from({ length: N }, () => new Map());

    for (const { a, b, peso } of enlaces) {
      vecinos[a].set(b, (vecinos[a].get(b) ?? 0) + peso);
      vecinos[b].set(a, (vecinos[b].get(a) ?? 0) + peso);
    }

    const com = Array.from({ length: N }, (_, i) => i);
    const totCom = [...grado];
    let movido = true;
    let algo = false;

    for (let vuelta = 0; vuelta < 50 && movido; vuelta += 1) {
      movido = false;

      for (let i = 0; i < N; i += 1) {
        const actual = com[i];
        const pesoA = new Map<number, number>();

        for (const [j, w] of vecinos[i]) pesoA.set(com[j], (pesoA.get(com[j]) ?? 0) + w);

        totCom[actual] -= grado[i];

        let mejor = actual;
        let ganancia = (pesoA.get(actual) ?? 0) - (resolucion * totCom[actual] * grado[i]) / m2;

        for (const [c, w] of [...pesoA.entries()].sort((x, y) => x[0] - y[0])) {
          const g = w - (resolucion * totCom[c] * grado[i]) / m2;

          if (g > ganancia + 1e-12) {
            ganancia = g;
            mejor = c;
          }
        }

        totCom[mejor] += grado[i];

        if (mejor !== actual) {
          com[i] = mejor;
          movido = true;
          algo = true;
        }
      }
    }

    if (!algo) break;

    const ids = [...new Set(com)].sort((x, y) => x - y);
    const nuevo = new Map(ids.map((c, k) => [c, k]));

    nodosDe = ids.map((c) => com.flatMap((cc, i) => (cc === c ? nodosDe[i] : [])));
    grado = ids.map((c) => com.reduce((s, cc, i) => s + (cc === c ? grado[i] : 0), 0));

    const suma = new Map<string, number>();

    for (const { a, b, peso } of enlaces) {
      const x = nuevo.get(com[a])!;
      const y = nuevo.get(com[b])!;

      if (x === y) continue;

      const k = x < y ? `${x}|${y}` : `${y}|${x}`;

      suma.set(k, (suma.get(k) ?? 0) + peso);
    }

    enlaces = [...suma.entries()].map(([k, peso]) => {
      const [a, b] = k.split("|").map(Number);

      return { a, b, peso };
    });
  }

  const salida = new Array<number>(n).fill(0);

  nodosDe.forEach((nodos, k) => nodos.forEach((i) => (salida[i] = k)));

  return salida;
}

/* ------------------------------------------------------------------ */
/*  LA RED                                                             */
/* ------------------------------------------------------------------ */

export function redDeParecidos(elementos: Elemento[], rasgos: Rasgo[], vecinos = 3, resolucion = 1): RedParecidos | null {
  if (elementos.length < 4) return null;

  /* z por rasgo; un hueco cuenta como la media (z = 0). */
  const columnas = rasgos.map((_, k) => elementos.map((e) => e.valores[k]).filter((v): v is number => v !== null && Number.isFinite(v)));
  const medias = columnas.map((c) => (c.length ? c.reduce((s, x) => s + x, 0) / c.length : 0));
  const dts = columnas.map((c, k) => (c.length > 1 ? Math.sqrt(c.reduce((s, x) => s + (x - medias[k]) ** 2, 0) / (c.length - 1)) : 0));
  const red: ElementoRed[] = elementos.map((e) => ({ ...e, z: e.valores.map((v, k) => (v === null || !Number.isFinite(v) || !dts[k] ? 0 : (v - medias[k]) / dts[k])), comunidad: 0 }));
  const n = red.length;
  const sim = red.map((a) => red.map((b) => coseno(a.z, b.z)));
  const claves = new Map<string, number>();

  for (let i = 0; i < n; i += 1) {
    sim[i]
      .map((s, j) => ({ s, j }))
      .filter((x) => x.j !== i && x.s > 0)
      .sort((x, y) => y.s - x.s || x.j - y.j)
      .slice(0, vecinos)
      .forEach(({ s, j }) => claves.set(i < j ? `${i}|${j}` : `${j}|${i}`, s));
  }

  const aristas = [...claves.entries()].map(([k, peso]) => {
    const [a, b] = k.split("|").map(Number);

    return { a, b, peso };
  });

  const coms = louvain(n, aristas, resolucion);
  const grupos = [...new Set(coms)].map((c) => coms.flatMap((cc, i) => (cc === c ? [i] : [])));

  grupos.sort((x, y) => y.length - x.length || red[x[0]].fecha.localeCompare(red[y[0]].fecha));

  const familias: Familia[] = grupos.map((g, id) => {
    g.forEach((i) => (red[i].comunidad = id));

    const centroide = rasgos.map((_, k) => g.reduce((s, i) => s + red[i].z[k], 0) / g.length);

    return {
      id,
      ids: g.map((i) => red[i].id),
      centroide,
      rasgos: rasgos
        .map((rasgo, k) => ({ rasgo, z: centroide[k] }))
        .sort((x, y) => Math.abs(y.z) - Math.abs(x.z))
        .slice(0, 3),
    };
  });

  return { rasgos, elementos: red, sim, aristas, familias, simFamilias: familias.map((a) => familias.map((b) => coseno(a.centroide, b.centroide))) };
}

/* ------------------------------------------------------------------ */
/*  NUESTROS PARTIDOS (WYSCOUT) Y NUESTRAS SESIONES (REGISTRO)         */
/* ------------------------------------------------------------------ */

export const TEMPORADA_DESDE = "2026-07-01";

const CLAVES_PARTIDO = ["posesion", "pasesPorPosesion", "intensidadPase", "longitudPase", "cuotaLaterales", "pasesLargos", "cuotaProgresivos", "cuotaUltimoTercio", "pasesProfundidad", "centros", "contras", "ppda", "recuperacionesAltas"];

export function partidosComoElementos(partidos: FilaPartido[], equipo = "Real Madrid Castilla"): { elementos: Elemento[]; rasgos: Rasgo[] } {
  const metricas = CLAVES_PARTIDO.map((k) => METRICAS.find((m) => m.key === k)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const nuestros = partidos.filter((f) => f.equipo === equipo && f.fecha >= TEMPORADA_DESDE).sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    rasgos: metricas.map((m) => ({ key: m.key, label: m.nombre })),
    elementos: nuestros.map((f) => ({
      id: `${f.fecha}|${f.rival}`,
      etiqueta: f.rival,
      detalle: `${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)} · ${f.golesFavor}-${f.golesContra}`,
      fecha: f.fecha,
      valores: metricas.map((m) => {
        const v = valorEnGrupo(m, [f], "promedio");

        return v === null || !Number.isFinite(v) ? null : v;
      }),
    })).map((e, i) => ({ ...e, id: e.id || String(i) })),
  };
}

/**
 * Los equipos de la liga entre sí (lo pidió el usuario el 16/10/2026, como el
 * experimento original): cada equipo de la competición del Castilla en la
 * 2026/27, resumido por la MEDIANA de sus partidos en las 13 de estilo.
 */
export function equiposComoElementos(partidos: FilaPartido[], equipo = "Real Madrid Castilla", minPartidos = 3): { elementos: Elemento[]; rasgos: Rasgo[] } {
  const metricas = CLAVES_PARTIDO.map((k) => METRICAS.find((m) => m.key === k)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const delAno = partidos.filter((f) => f.fecha >= TEMPORADA_DESDE);
  const nuestros = delAno.filter((f) => f.equipo === equipo);
  const comp = [...nuestros.reduce((m, f) => m.set(f.competicion, (m.get(f.competicion) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const deLaComp = delAno.filter((f) => f.competicion === comp);
  const nombres = [...new Set(deLaComp.map((f) => f.equipo))].sort((a, b) => a.localeCompare(b, "es"));
  const med = (v: number[]) => {
    const o = [...v].sort((a, b) => a - b);
    const m = Math.floor(o.length / 2);

    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  };

  return {
    rasgos: metricas.map((m) => ({ key: m.key, label: m.nombre })),
    elementos: nombres
      .map((nombre) => {
        const suyos = deLaComp.filter((f) => f.equipo === nombre);

        return {
          id: nombre,
          etiqueta: nombre,
          detalle: `${suyos.length} partidos · ${suyos.reduce((s, f) => s + (f.golesFavor ?? 0), 0)}-${suyos.reduce((s, f) => s + (f.golesContra ?? 0), 0)} en goles`,
          fecha: nombre === equipo ? "9999" : nombre,
          partidos: suyos.length,
          valores: metricas.map((m) => {
            const v = suyos.map((f) => valorEnGrupo(m, [f], "promedio")).filter((x): x is number => x !== null && Number.isFinite(x));

            return v.length ? med(v) : null;
          }),
        };
      })
      .filter((e) => e.partidos >= minPartidos)
      .map(({ partidos: _p, ...e }) => e),
  };
}

export const RASGOS_SESION: Rasgo[] = [
  { key: "minutos", label: "Minutos de tarea", formato: "ent" },
  { key: "intensidad", label: "Intensidad media", formato: "dec" },
  { key: "carga", label: "Carga ponderada", formato: "ent" },
  { key: "cargaCog", label: "Carga cognitiva", formato: "ent" },
  { key: "densidad", label: "Densidad", formato: "dec" },
  { key: "nJug", label: "Jugadores por tarea", formato: "dec" },
  { key: "normativa", label: "Normativa", formato: "dec" },
  { key: "incertidumbre", label: "Incertidumbre", formato: "dec" },
  { key: "familiaridad", label: "Familiaridad", formato: "dec" },
  { key: "juego", label: "% en juego real", formato: "pct" },
  { key: "posesion", label: "% en posesión y rondos", formato: "pct" },
  { key: "abp", label: "% en balón parado", formato: "pct" },
  { key: "defensa", label: "% en fase defensiva", formato: "pct" },
];

const JUEGO = /partido|competici|ataque - defensa|oleada/i;

/** Más de la mitad del tiempo en «Competición» (fase o tipo): es el partido, no un entrenamiento. */
const esDiaDePartido = (ts: RegistroTarea[]) => {
  const min = ts.reduce((s, t) => s + (t.tiempo || 0), 0);
  const comp = ts.filter((t) => /competici/i.test(t.fase) || /competici/i.test(t.tipoTarea)).reduce((s, t) => s + (t.tiempo || 0), 0);

  return min > 0 && comp / min > 0.5;
};
const POSESION = /rondo|posesi|posici|progresi|rueda/i;

/** «16/10/2026» → «2026-10-16». */
const iso = (f: string) => {
  const m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : f;
};

export function sesionesComoElementos(tareas: RegistroTarea[], temporada = "2026 - 2027"): { elementos: Elemento[]; rasgos: Rasgo[] } {
  const delAno = tareas.filter((t) => t.temporada.replace(/\s/g, "") === temporada.replace(/\s/g, "") && t.fecha);
  const porDia = new Map<string, RegistroTarea[]>();

  for (const t of delAno) porDia.set(iso(t.fecha), [...(porDia.get(iso(t.fecha)) ?? []), t]);

  const elementos: Elemento[] = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, ts]) => {
      const min = ts.reduce((s, t) => s + (t.tiempo || 0), 0);
      const pond = (k: keyof RegistroTarea) => {
        const con = ts.filter((t) => Number(t[k]) > 0 && t.tiempo > 0);
        const w = con.reduce((s, t) => s + t.tiempo, 0);

        return w ? con.reduce((s, t) => s + Number(t[k]) * t.tiempo, 0) / w : null;
      };
      const cuota = (f: (t: RegistroTarea) => boolean) => (min ? (100 * ts.filter(f).reduce((s, t) => s + (t.tiempo || 0), 0)) / min : null);
      const primera = ts[0];

      return {
        id: fecha,
        etiqueta: `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`,
        detalle: [primera.md, primera.micro ? `micro ${primera.micro}` : "", primera.rival ? `vs ${primera.rival}` : ""].filter(Boolean).join(" · "),
        fecha,
        valores: [
          min || null,
          pond("intensidad"),
          ts.reduce((s, t) => s + (t.carga || 0), 0) || null,
          ts.reduce((s, t) => s + (t.cargaCog || 0), 0) || null,
          pond("densidad"),
          pond("nJug"),
          pond("normativa"),
          pond("incertidumbre"),
          pond("familiaridad"),
          cuota((t) => JUEGO.test(t.tipoTarea)),
          cuota((t) => POSESION.test(t.tipoTarea)),
          cuota((t) => /^ABP/i.test(t.fase)),
          cuota((t) => /defensiv/i.test(t.fase) && !/^ABP/i.test(t.fase)),
        ],
      };
    })
    .filter((e) => (e.valores[0] ?? 0) > 0)
    /* El día de partido no es una sesión: en el registro el partido va como tarea de «Competición». */
    .filter((e) => !esDiaDePartido(porDia.get(e.fecha) ?? []));

  return { elementos, rasgos: RASGOS_SESION };
}

/* ------------------------------------------------------------------ */
/*  LA COLOCACIÓN EN EL PLANO (fuerzas, semilla fija)                  */
/* ------------------------------------------------------------------ */

export function colocaRed(red: RedParecidos, vueltas = 400): { x: number; y: number }[] {
  const n = red.elementos.length;
  let semilla = 7;
  const azar = () => {
    semilla = (semilla * 16807) % 2147483647;

    return semilla / 2147483647;
  };
  const nc = Math.max(1, red.familias.length);
  const pos = red.elementos.map((e) => {
    const ang = (2 * Math.PI * e.comunidad) / nc;

    return { x: 0.5 + 0.3 * Math.cos(ang) + (azar() - 0.5) * 0.15, y: 0.5 + 0.3 * Math.sin(ang) + (azar() - 0.5) * 0.15 };
  });
  const k = Math.sqrt(1 / n) * 0.6;

  for (let it = 0; it < vueltas; it += 1) {
    const t = 0.08 * (1 - it / vueltas) + 0.002;
    const d = pos.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const dist = Math.max(0.01, Math.hypot(dx, dy));
        const f = (k * k) / dist;

        d[i].x += (dx / dist) * f;
        d[i].y += (dy / dist) * f;
        d[j].x -= (dx / dist) * f;
        d[j].y -= (dy / dist) * f;
      }
    }

    for (const { a, b, peso } of red.aristas) {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const dist = Math.max(0.01, Math.hypot(dx, dy));
      const f = ((dist * dist) / k) * (0.5 + peso);

      d[a].x -= (dx / dist) * f;
      d[a].y -= (dy / dist) * f;
      d[b].x += (dx / dist) * f;
      d[b].y += (dy / dist) * f;
    }

    for (let i = 0; i < n; i += 1) {
      const len = Math.max(1e-9, Math.hypot(d[i].x, d[i].y));

      pos[i].x += (d[i].x / len) * Math.min(len, t);
      pos[i].y += (d[i].y / len) * Math.min(len, t);
    }
  }

  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

  /* Más margen a la derecha: los rótulos van a la derecha de cada punto. */
  return pos.map((p) => ({ x: 0.05 + (0.76 * (p.x - x0)) / Math.max(1e-9, x1 - x0), y: 0.06 + (0.88 * (p.y - y0)) / Math.max(1e-9, y1 - y0) }));
}
