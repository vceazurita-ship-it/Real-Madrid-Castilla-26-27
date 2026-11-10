"use client";

/**
 * COMPARATIVA CON LA CATEGORÍA · FUENTE OPTA (09/11/2026).
 *
 * La misma pregunta que con Wyscout —cada jugador del Castilla frente a los de
 * su puesto en la categoría, sub-21, sub-23 o todos— pero con los datos de
 * Opta y con TODAS las temporadas de Primera RFEF que hay:
 *
 * - 2026-27 (la actual): `opta:jugadores`, los dos grupos.
 * - Las pasadas: `opta:temporadas` (índice) y `opta:hist:<clave>:jugadores`,
 *   con la misma forma `{ cols, filas }`. Cada una trae sólo un grupo: la
 *   2025-26 el del Castilla, la 2024-25 otro (sin el Castilla). Cuando la
 *   temporada no tiene al Castilla, se compara a los nuestros de ahora con la
 *   categoría de aquel año, y se dice.
 *
 * Cuatro pestañas: ranking de la plantilla, gráficos por fase (preguntas o dos
 * métricas libres), ficha y evolución por temporadas de un jugador que esté en
 * varias (por `playerId`), métrica a métrica.
 *
 * Reglas, las de la pantalla con Wyscout: percentil contra su puesto (familia
 * de `FAMILIA_PUESTO`), por 90′ salvo las tasas, 270′ como mínimo para entrar
 * en la comparación y un porcentaje de menos de 15 intentos no cuenta. El
 * índice es la media de los percentiles en las métricas del puesto
 * (`PERFIL_FAMILIA`) que tienen mejor y peor.
 *
 * Aquí no hay ni una cifra de Opta: se leen en vivo con `traeOpta`.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowDownUp, ArrowUpRight, History, Loader2, Minus, ScatterChart, UserRound, Users } from "lucide-react";

import { MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { Explicativo } from "@/components/ui/textos-analisis";
import { nombreVisible } from "@/lib/nombreJugador";
import { aereosDisputados, casaOpta } from "@/lib/opta-ficha";
import { CASTILLA_OPTA, DOCS_OPTA, PUESTO_OPTA, aObjetos, num, percentil, traeOpta, type Celda, type TablaOpta } from "@/lib/opta";
import { FAMILIAS, FAMILIA_PUESTO, METRICAS_OPTA, PERFIL_FAMILIA, cortoMetrica, type DefMetrica } from "@/lib/opta-nombres";
import type { Player } from "@/types/player";

/* ------------------------------------------------------------------ */
/*  MODELO                                                             */
/* ------------------------------------------------------------------ */

type Fila = Record<string, Celda>;
type Temporada = { clave: string; nombre: string; actual: boolean };
type Indice = { temporadas?: Temporada[] };
type Ref = "u21" | "u23" | "todos";
type Familia = (typeof FAMILIAS)[number];
type Pestana = "ranking" | "graficos" | "ficha" | "evolucion";

const REFS: { key: Ref; label: string; edad: number | null }[] = [
  { key: "u21", label: "Sub-21", edad: 21 },
  { key: "u23", label: "Sub-23", edad: 23 },
  { key: "todos", label: "Toda la categoría", edad: null },
];

/** Para entrar en la comparación, como en la ficha individual con Opta. */
const MINUTOS = 270;
/** Un porcentaje de menos intentos no se juzga. */
const INTENTOS_MIN = 15;
/** Por debajo, el ranking del puesto es tendencia. */
const GRUPO_CORTO = 10;
/** Entre −5 y +5 puntos de percentil de una temporada a otra se lee «igual». */
const ESTABLE = 5;

/** De qué columna sale el «cuántas veces» de cada porcentaje. */
const BASE_PCT: Record<string, string> = {
  "Pass%": "PsAtt",
  "OnTarget%": "ShtIncBl",
  "Ps%InA3rd": "TchsA3",
  "LongBall%": "PsAtt",
};

/** Los porcentajes sin columna de intentos: se deducen (los aéreos, de ganados y porcentaje). */
const INTENTOS_PCT: Record<string, (f: Fila) => number | null> = {
  "Aerial%": aereosDisputados,
  "Arl%DH": aereosDisputados,
  "Arl%AH": aereosDisputados,
};

/** Las columnas de `opta:jugadores` que el diccionario común no traduce. Son nombres, no datos. */
const EXTRA: Record<string, DefMetrica> = {
  TchsM3: { nombre: "Toques en el tercio medio", corto: "Toques medio", unidad: "entero", mejor: null },
  TchsD3: { nombre: "Toques en el propio tercio", corto: "Toques propio", unidad: "entero", mejor: null },
  CrossOpen: { nombre: "Centros en juego", corto: "Centros juego", unidad: "entero", mejor: null },
  ThrghBlCmp: { nombre: "Pases al hueco completados", corto: "Al hueco ok", unidad: "entero", mejor: true },
  "Arl%AH": { nombre: "Aéreos ganados en campo rival", corto: "% aéreos arriba", unidad: "porcentaje", tasa: true, mejor: true },
  "Arl%DH": { nombre: "Aéreos ganados en campo propio", corto: "% aéreos atrás", unidad: "porcentaje", tasa: true, mejor: true },
  IntA3: { nombre: "Intercepciones en el último tercio", corto: "Intercep. arriba", unidad: "entero", mejor: true },
  CrossBlkd: { nombre: "Centros bloqueados", corto: "Centros bloq.", unidad: "entero", mejor: true },
  KeyPsCrn: { nombre: "Pases clave de córner", corto: "P. clave córner", unidad: "entero", mejor: true },
  KeyPsFK: { nombre: "Pases clave de falta", corto: "P. clave falta", unidad: "entero", mejor: true },
  AstCrnr: { nombre: "Asistencias de córner", corto: "Asist. córner", unidad: "entero", mejor: true },
  AstFK: { nombre: "Asistencias de falta", corto: "Asist. falta", unidad: "entero", mejor: true },
  GoalDirFK: { nombre: "Goles de falta directa", corto: "Goles falta", unidad: "entero", mejor: true },
  ShotDirFK: { nombre: "Remates de falta directa", corto: "Remates falta", unidad: "entero", mejor: null },
  CrossFK: { nombre: "Centros de falta", corto: "Centros falta", unidad: "entero", mejor: null },
  CrossCmpFK: { nombre: "Centros de falta completados", corto: "Centros falta ok", unidad: "entero", mejor: true },
  SvOutBox: { nombre: "Paradas desde fuera del área", corto: "Paradas fuera", unidad: "entero", mejor: true },
  CrossPunch: { nombre: "Centros despejados de puños", corto: "Puños", unidad: "entero", mejor: null },
};

/** Lo que no es métrica: claves, partidos, minutos y edad. */
const NO_METRICA = new Set(["playerId", "jugador", "teamId", "equipo", "puesto", "GM", "Min", "Age"]);

/*
| Sólo del portero. En un jugador de campo Opta da GAg = 0 y GABA = su xG en
| contra en el campo, así que «Goles evitados» salía con 1,0 por 90′ en un
| central; las paradas y los centros atrapados son ceros. Fuera de su ficha,
| de su evolución y de los ejes de los jugadores de campo.
*/
const SOLO_PORTERO = new Set(["Saves", "SvInBox", "SvOutBox", "CrossClaim", "CrossPunch", "GABA", "GAg", "Save%", "xGOTConc", "CleanSheet", "SvPen"]);
const valeParaFamilia = (a: string, familia: Familia | "campo" | null) => familia === "Porteros" || !SOLO_PORTERO.has(a);

const defDe = (a: string): DefMetrica | null => METRICAS_OPTA[a] ?? EXTRA[a] ?? null;
const esTasa = (d: DefMetrica) => Boolean(d.tasa) || d.unidad === "porcentaje";
const nombreDe = (a: string) => defDe(a)?.nombre ?? a;
const cortoDe = (a: string) => (EXTRA[a] ? EXTRA[a].corto ?? EXTRA[a].nombre : cortoMetrica(a));

/** El valor que se compara: por 90′ los recuentos, tal cual las tasas. */
function valorDe(a: string, f: Fila): number | null {
  const d = defDe(a);
  const crudo = num(f[a]);
  if (!d || crudo == null) return null;
  if (esTasa(d)) {
    const base = BASE_PCT[a];
    if (base && (num(f[base]) ?? 0) < INTENTOS_MIN) return null;
    const intentos = INTENTOS_PCT[a];
    if (intentos && (intentos(f) ?? 0) < INTENTOS_MIN) return null;
    return crudo;
  }
  const min = num(f.Min);
  return min && min > 0 ? (crudo / min) * 90 : null;
}

const coma = (v: number, d: number) => v.toFixed(d).replace(".", ",").replace(/^-/, "−");

function textoDe(a: string, v: number): string {
  const d = defDe(a);
  if (d?.unidad === "porcentaje") return `${coma(v * 100, 1)} %`;
  return coma(v, Math.abs(v) >= 10 ? 1 : 2);
}

const etiquetaDe = (a: string) => {
  const d = defDe(a);
  if (!d) return a;
  return `${d.nombre}${esTasa(d) ? "" : " /90"}${d.mejor === false ? " (menos es mejor)" : ""}`;
};

const esNuestro = (f: Fila) => f.teamId === CASTILLA_OPTA || f.equipo === "Real Madrid II";
const familiaDe = (f: Fila): Familia | null => (FAMILIA_PUESTO[String(f.puesto ?? "")] as Familia | undefined) ?? null;
const minutosDe = (f: Fila) => num(f.Min) ?? 0;
const edadDe = (f: Fila) => num(f.Age);
const idDe = (f: Fila) => String(f.playerId ?? "");

/** «2026-2027» → «2026-27». */
const temporadaCorta = (clave: string) => {
  const [a, b] = clave.split("-");
  return b && b.length === 4 ? `${a}-${b.slice(2)}` : clave;
};

const docDe = (t: Temporada) => (t.actual ? DOCS_OPTA.jugadores : `opta:hist:${t.clave}:jugadores`);

/** Grupos de la temporada que se saben y la tabla no dice. */
const GRUPO_CONOCIDO: Record<string, string> = { "2024-2025": "el grupo 1" };

function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const k = Math.floor(o.length / 2);
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
}

/** Las métricas del puesto que cuentan para el índice (las que tienen mejor y peor). */
function metricasIndice(familia: Familia, cols: Set<string>) {
  return (PERFIL_FAMILIA[familia] ?? []).filter((a) => cols.has(a) && defDe(a)?.mejor != null);
}

/** Todas las métricas de la tabla con nombre, las del puesto primero. */
function metricasTodas(familia: Familia | null, cols: string[]) {
  const perfil = familia ? PERFIL_FAMILIA[familia] ?? [] : [];
  const resto = cols.filter((c) => !NO_METRICA.has(c) && defDe(c) && !perfil.includes(c) && valeParaFamilia(c, familia));
  return { perfil: perfil.filter((a) => cols.includes(a)), resto };
}

type Linea = { a: string; valor: number; p: number | null; mediana: number | null };

type FilaComp = {
  f: Fila;
  familia: Familia;
  minutos: number;
  edad: number | null;
  indice: number | null;
  ranking: { posicion: number; de: number } | null;
  /** Mayor que la edad del grupo: entra como uno más. */
  fueraDeEdad: boolean;
  lineas: Linea[];
};

/** La muestra de comparación de una familia: los de fuera, con minutos y de la edad pedida. */
function muestraDe(filas: Fila[], familia: Familia, edad: number | null) {
  return filas.filter(
    (f) => !esNuestro(f) && familiaDe(f) === familia && minutosDe(f) >= MINUTOS && (edad == null || ((edadDe(f) ?? 99) <= edad)),
  );
}

/** El índice de una fila contra una muestra ya convertida en valores por métrica. */
function indiceContra(f: Fila, metricas: string[], valores: Map<string, number[]>) {
  const ps = metricas
    .map((a) => percentil(valorDe(a, f), valores.get(a) ?? [], defDe(a)?.mejor === false))
    .filter((p): p is number => p != null);
  return ps.length ? Math.round(ps.reduce((s, p) => s + p, 0) / ps.length) : null;
}

function comparaTemporada(filas: Fila[], nuestros: Fila[], edad: number | null): FilaComp[] {
  const cols = new Set(filas.length ? Object.keys(filas[0]) : []);
  const porFamilia = new Map<Familia, { metricas: string[]; todas: string[]; valores: Map<string, number[]>; indices: number[] }>();

  const preparada = (familia: Familia) => {
    const hecha = porFamilia.get(familia);
    if (hecha) return hecha;
    const muestra = muestraDe(filas, familia, edad);
    const metricas = metricasIndice(familia, cols);
    const todas = [...cols].filter((c) => !NO_METRICA.has(c) && defDe(c) && valeParaFamilia(c, familia));
    const valores = new Map<string, number[]>();
    for (const a of todas) valores.set(a, muestra.map((f) => valorDe(a, f)).filter((v): v is number => v != null));
    const indices = muestra.map((f) => indiceContra(f, metricas, valores)).filter((v): v is number => v != null);
    const lista = { metricas, todas, valores, indices };
    porFamilia.set(familia, lista);
    return lista;
  };

  const salida: FilaComp[] = [];
  for (const f of nuestros) {
    const familia = familiaDe(f);
    if (!familia) continue;
    const minutos = minutosDe(f);
    const edadF = edadDe(f);
    const { metricas, todas, valores, indices } = preparada(familia);
    const conMinutos = minutos >= MINUTOS;
    const indice = conMinutos ? indiceContra(f, metricas, valores) : null;
    const lineas: Linea[] = [];
    for (const a of todas) {
      const v = valorDe(a, f);
      if (v == null) continue;
      const muestra = valores.get(a) ?? [];
      lineas.push({ a, valor: v, p: muestra.length >= 5 ? percentil(v, muestra, defDe(a)?.mejor === false) : null, mediana: mediana(muestra) });
    }
    salida.push({
      f,
      familia,
      minutos,
      edad: edadF,
      indice,
      ranking: indice != null && indices.length ? { posicion: indices.filter((i) => i > indice).length + 1, de: indices.length + 1 } : null,
      fueraDeEdad: edad != null && (edadF ?? 0) > edad,
      lineas,
    });
  }
  return salida;
}

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

const colorIndice = (i: number | null) => (i === null ? tinta(0.2) : i >= 60 ? MEJOR : i < 45 ? PEOR : ORO);
const colorP = (p: number, mejor: boolean | null | undefined) => (mejor == null ? tinta(0.55) : p >= 66 ? MEJOR : p >= 40 ? ORO : PEOR);
const apellido = (nombre: string) => nombre.split(" ").slice(-1)[0];

function Chip({ activo, onClick, children, fuerte, desactivado }: { activo: boolean; onClick: () => void; children: React.ReactNode; fuerte?: boolean; desactivado?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      aria-pressed={activo}
      className={`rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
        activo
          ? fuerte
            ? "border-[#C8A96B] bg-[#C8A96B]/15 font-medium text-[#C8A96B]"
            : "border-white/40 bg-white/10 text-white"
          : "border-white/10 text-white/55 hover:border-white/25"
      }`}
    >
      {children}
    </button>
  );
}

function Foto({ src, nombre, size = 30 }: { src?: string; nombre: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- recortes propios, ya optimizados
    <img src={src} alt={nombre} width={size} height={size} className="shrink-0 rounded-full bg-white/5 object-cover object-top" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[11px] font-semibold text-[#C8A96B]"
      style={{ width: size, height: size }}
    >
      {nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("")}
    </span>
  );
}

function Barra({ valor, color }: { valor: number; color: string }) {
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, Math.min(100, valor))}%`, background: color }} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  LA PANTALLA                                                        */
/* ------------------------------------------------------------------ */

export function ComparativaOpta({ players, selectorFuente }: { players: Player[]; selectorFuente: React.ReactNode }) {
  const [temporadas, setTemporadas] = useState<Temporada[] | null>(null);
  const [docs, setDocs] = useState<Record<string, TablaOpta | null>>({});
  const [intento, setIntento] = useState(0);
  const [claveSel, setClaveSel] = useState<string | null>(null);
  const [ref, setRef] = useState<Ref>("u21");
  const [familiaSel, setFamiliaSel] = useState<Familia | "todos">("todos");
  const [pestana, setPestana] = useState<Pestana>("ranking");
  const [elegido, setElegido] = useState<string | null>(null);
  const [orden, setOrden] = useState<{ por: "nombre" | "edad" | "minutos" | "indice"; desc: boolean }>({ por: "indice", desc: true });

  /* El índice de temporadas y todas sus tablas de jugadores, de una vez: la
     evolución necesita todas y son tres documentos pequeños. */
  useEffect(() => {
    let vivo = true;
    void traeOpta<Indice>("opta:temporadas").then(async (indice) => {
      const lista: Temporada[] = indice?.temporadas?.length
        ? indice.temporadas
        : [{ clave: "actual", nombre: "Temporada actual", actual: true }];
      const tablas = await Promise.all(lista.map((t) => traeOpta(docDe(t))));
      if (!vivo) return;
      setTemporadas(lista);
      setDocs(Object.fromEntries(lista.map((t, i) => [t.clave, tablas[i]?.filas?.length ? tablas[i] : null])));
    });
    return () => {
      vivo = false;
    };
  }, [intento]);

  const reintenta = () => {
    setTemporadas(null);
    setDocs({});
    setIntento((n) => n + 1);
  };

  /* Sólo las temporadas que han llegado, de la más reciente a la más antigua. */
  const disponibles = useMemo(
    () => (temporadas ?? []).filter((t) => docs[t.clave]).sort((a, b) => (a.actual ? -1 : b.actual ? 1 : b.clave.localeCompare(a.clave))),
    [temporadas, docs],
  );
  const actual = disponibles.find((t) => t.actual) ?? null;
  const temporada = disponibles.find((t) => t.clave === claveSel) ?? actual ?? disponibles[0] ?? null;

  const filasDe = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const t of disponibles) m.set(t.clave, aObjetos(docs[t.clave]));
    return m;
  }, [disponibles, docs]);

  const filas = useMemo(() => (temporada ? filasDe.get(temporada.clave) ?? [] : []), [temporada, filasDe]);
  const filasActual = useMemo(() => (actual ? filasDe.get(actual.clave) ?? [] : []), [actual, filasDe]);

  /* ¿Trae la edad? Si no, el filtro sub-21/sub-23 no se puede aplicar. */
  const hayEdad = useMemo(() => filas.some((f) => edadDe(f) != null), [filas]);
  const refVista: Ref = hayEdad ? ref : "todos";
  const edadRef = REFS.find((r) => r.key === refVista)?.edad ?? null;

  /* Los nuestros: los del Castilla en esa temporada; si la temporada no lo
     tiene (otro grupo), los de ahora contra la categoría de entonces. */
  const nuestrosTemporada = useMemo(() => filas.filter(esNuestro), [filas]);
  const sinCastilla = nuestrosTemporada.length === 0;
  const nuestros = useMemo(() => (sinCastilla ? filasActual.filter(esNuestro) : nuestrosTemporada), [sinCastilla, filasActual, nuestrosTemporada]);

  const comparadas = useMemo(() => comparaTemporada(filas, nuestros, edadRef), [filas, nuestros, edadRef]);

  /* De la fila de Opta a la ficha de la plantilla (foto y nombre). */
  const fichaDe = useMemo(() => {
    const m = new Map<string, Player>();
    /* Uno por jugador de Opta: con el mismo jugador en dos temporadas, el cruce
       por apellido veía dos candidatos y no casaba («Cestero», «Ávaro Leiva»). */
    const porId = new Map<string, Fila>();
    for (const f of [...filasActual.filter(esNuestro), ...nuestrosTemporada]) if (!porId.has(idDe(f))) porId.set(idDe(f), f);
    const todosNuestros = [...porId.values()];
    for (const p of players) {
      const f = casaOpta(p.nombre, p.apodo, todosNuestros);
      if (f && !m.has(idDe(f))) m.set(idDe(f), p);
    }
    return (f: Fila) => m.get(idDe(f)) ?? null;
  }, [players, filasActual, nuestrosTemporada]);

  const nombreFila = (f: Fila) => nombreVisible(fichaDe(f)?.nombre ?? String(f.jugador ?? ""));

  const visibles = useMemo(() => {
    const valor = (x: FilaComp): number | string => {
      switch (orden.por) {
        case "nombre": return String(x.f.jugador ?? "");
        case "edad": return x.edad ?? 0;
        case "minutos": return x.minutos;
        case "indice": return x.indice ?? -1;
      }
    };
    return comparadas
      .filter((x) => familiaSel === "todos" || x.familia === familiaSel)
      .sort((a, b) => {
        const va = valor(a);
        const vb = valor(b);
        const c = typeof va === "string" ? va.localeCompare(String(vb), "es") : va - (vb as number);
        return orden.desc ? -c : c;
      });
  }, [comparadas, familiaSel, orden]);

  const conIndice = visibles.filter((x) => x.indice != null);
  const pocosMinutos = visibles.filter((x) => x.indice == null && x.minutos > 0).map((x) => nombreFila(x.f));
  const activo = visibles.find((x) => idDe(x.f) === elegido) ?? conIndice[0] ?? visibles[0] ?? null;

  const abreFicha = (id: string) => {
    const suyo = comparadas.find((x) => idDe(x.f) === id);
    if (suyo && familiaSel !== "todos" && suyo.familia !== familiaSel) setFamiliaSel(suyo.familia);
    setElegido(id);
    setPestana("ficha");
  };

  /* Cómo es cada temporada: cuántos equipos y si está el Castilla. */
  const descripcion = (t: Temporada) => {
    const fs = filasDe.get(t.clave) ?? [];
    const equipos = new Set(fs.map((f) => String(f.equipo ?? ""))).size;
    const conCastilla = fs.some(esNuestro);
    /* Cuántos partidos trae de cada equipo (la mediana del jugador con más partidos de cada uno):
       si una temporada pasada está a medio bajar, se ve aquí y no en percentiles raros. */
    const maxPorEquipo = new Map<string, number>();
    for (const f of fs) {
      const e = String(f.equipo ?? "");
      maxPorEquipo.set(e, Math.max(maxPorEquipo.get(e) ?? 0, num(f.GM) ?? 0));
    }
    const partidos = Math.round(mediana([...maxPorEquipo.values()]) ?? 0);
    const cuantos = partidos > 0 ? ` · ${partidos} ${partidos === 1 ? "partido" : "partidos"} por equipo en los datos` : "";
    if (t.actual) return `${temporadaCorta(t.clave)}: los dos grupos de Primera RFEF (${equipos} equipos${cuantos}).`;
    if (conCastilla) return `${temporadaCorta(t.clave)}: sólo el grupo del Castilla (${equipos} equipos${cuantos}).`;
    return `${temporadaCorta(t.clave)}: sólo ${GRUPO_CONOCIDO[t.clave] ?? "un grupo"}, sin el Castilla (${equipos} equipos${cuantos}).`;
  };

  const refLabel = REFS.find((r) => r.key === refVista)?.label ?? "";
  const PESTANAS: { key: Pestana; label: string; icono: React.ReactNode }[] = [
    { key: "ranking", label: "Ranking de la plantilla", icono: <Users size={15} /> },
    { key: "graficos", label: "Gráficos por fase", icono: <ScatterChart size={15} /> },
    { key: "ficha", label: "Ficha del jugador", icono: <UserRound size={15} /> },
    { key: "evolucion", label: "Evolución por temporadas", icono: <History size={15} /> },
  ];

  const cargando = temporadas === null;

  return (
    <>
      <div className="sticky top-[81px] z-20 -mx-4 mt-6 border-b border-white/[0.06] bg-[#0B0F14]/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-8 sm:px-8 md:top-[97px]">
        <div className="flex flex-wrap items-center gap-2">
          {selectorFuente}
          {disponibles.length > 0 && (
            <>
              <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
              <span className="mr-1 text-[11px] uppercase tracking-wider text-white/35">Temporada</span>
              {disponibles.map((t) => (
                <Chip key={t.clave} activo={temporada?.clave === t.clave} onClick={() => setClaveSel(t.clave)} fuerte>
                  {temporadaCorta(t.clave)}
                </Chip>
              ))}
            </>
          )}
        </div>
        {!cargando && filas.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] uppercase tracking-wider text-white/35">Contra</span>
            {REFS.map((r) => (
              <Chip key={r.key} activo={refVista === r.key} onClick={() => setRef(r.key)} desactivado={!hayEdad && r.edad != null} fuerte>
                {r.label}
              </Chip>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
            <span className="mr-1 text-[11px] uppercase tracking-wider text-white/35">Puesto</span>
            {(["todos", ...FAMILIAS] as const).map((p) => (
              <Chip key={p} activo={familiaSel === p} onClick={() => setFamiliaSel(p)}>
                {p === "todos" ? "Todos" : p}
              </Chip>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist">
          {PESTANAS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={pestana === p.key}
              onClick={() => setPestana(p.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition ${
                pestana === p.key ? "bg-white/10 font-medium text-white" : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
              }`}
            >
              {p.icono}
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div role="status" className="mt-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando las temporadas de Opta.
          </p>
        </div>
      ) : disponibles.length === 0 ? (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
          <span>Los datos de Opta no han llegado. Se publican con el encargo «opta» de Ajustes y cada lunes.</span>
          <button type="button" onClick={reintenta} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.06]">
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* Qué trae cada temporada: una línea, para no comparar grupos distintos sin saberlo. */}
          <div className="mt-5 space-y-1 text-xs text-white/55">
            {temporada && <p className="text-white/70">{descripcion(temporada)}</p>}
            {sinCastilla && actual && temporada && !temporada.actual && (
              <p>
                El Castilla no juega en ese grupo: se compara a los nuestros de {temporadaCorta(actual.clave)} con la categoría de{" "}
                {temporadaCorta(temporada.clave)}.
              </p>
            )}
            {!hayEdad && <p>Esta temporada no trae la edad de los jugadores: el filtro sub-21 / sub-23 no se puede aplicar y se compara con toda la categoría.</p>}
          </div>

          {pestana === "ranking" && (
            <Ranking
              filas={conIndice}
              orden={orden}
              setOrden={setOrden}
              refLabel={refLabel}
              refVista={refVista}
              fichaDe={fichaDe}
              nombreFila={nombreFila}
              onAbre={abreFicha}
              pocosMinutos={pocosMinutos}
            />
          )}

          {pestana === "graficos" && (
            <Graficos
              filas={filas}
              nuestros={visibles}
              familia={familiaSel}
              edad={edadRef}
              refLabel={refLabel}
              elegido={activo ? idDe(activo.f) : null}
              nombreFila={nombreFila}
              onElige={abreFicha}
            />
          )}

          {pestana === "ficha" &&
            (activo ? (
              <Ficha activo={activo} opciones={visibles} onElige={setElegido} fichaDe={fichaDe} nombreFila={nombreFila} refLabel={refLabel} temporada={temporada} />
            ) : (
              <p className="mt-8 text-sm text-white/50">Ningún jugador nuestro de ese puesto en esta temporada.</p>
            ))}

          {pestana === "evolucion" && actual && (
            <Evolucion temporadas={disponibles} filasDe={filasDe} actual={actual} fichaDe={fichaDe} nombreFila={nombreFila} descripcion={descripcion} familiaSel={familiaSel} />
          )}

          <Explicativo>
            <p className="mt-8 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/35">
              Fuente: Opta. Índice = media de sus percentiles en las métricas de su puesto frente a{" "}
              {refLabel.toLowerCase()} de su puesto con al menos {MINUTOS}′ en la temporada elegida (por 90′ salvo los porcentajes).
              Un porcentaje de menos de {INTENTOS_MIN} intentos no cuenta. Es un resumen para ordenar, no una nota: la ficha dice en
              qué destaca cada uno.
            </p>
          </Explicativo>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  RANKING                                                            */
/* ------------------------------------------------------------------ */

const textoRanking = (r: { posicion: number; de: number }) => `${r.posicion}º de ${r.de}${r.de < GRUPO_CORTO ? " · tendencia" : ""}`;

function Ranking({
  filas,
  orden,
  setOrden,
  refLabel,
  refVista,
  fichaDe,
  nombreFila,
  onAbre,
  pocosMinutos,
}: {
  filas: FilaComp[];
  orden: { por: "nombre" | "edad" | "minutos" | "indice"; desc: boolean };
  setOrden: (o: { por: "nombre" | "edad" | "minutos" | "indice"; desc: boolean }) => void;
  refLabel: string;
  refVista: Ref;
  fichaDe: (f: Fila) => Player | null;
  nombreFila: (f: Fila) => string;
  onAbre: (id: string) => void;
  pocosMinutos: string[];
}) {
  const media = filas.length ? Math.round(filas.reduce((s, x) => s + (x.indice ?? 0), 0) / filas.length) : null;
  const top3 = filas.filter((x) => x.ranking && x.ranking.posicion <= 3).length;
  const fuertes = filas.filter((x) => (x.indice ?? 0) >= 60).length;

  /* Lo que se lee de la tabla: el mejor del puesto y el punto más bajo de cada uno, sin frases vacías. */
  const primeros = filas.filter((x) => x.ranking?.posicion === 1 && x.ranking.de > 1);

  const cabecera: ["nombre" | "edad" | "minutos" | "indice" | null, string, string][] = [
    ["nombre", "Jugador", "px-4"],
    ["edad", "Edad", "hidden sm:table-cell px-2"],
    [null, "Puesto", "hidden sm:table-cell px-2"],
    ["minutos", "Min.", "hidden sm:table-cell px-2 text-right"],
    ["indice", `Índice ${refVista === "todos" ? "categoría" : refVista === "u21" ? "sub-21" : "sub-23"}`, "px-3 sm:w-44"],
    [null, "Ranking", "px-2"],
    [null, "Mejor métrica", "hidden md:table-cell px-2"],
  ];

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { t: "Jugadores comparados", v: filas.length, h: `con ${MINUTOS}′ o más` },
          { t: "Top 3 de su puesto", v: top3, h: `contra ${refLabel.toLowerCase()}` },
          ...(media !== null ? [{ t: "Índice medio", v: media, h: "50 = la media de su puesto en la categoría" }] : []),
          { t: "Índice de 60 o más", v: fuertes, h: "por encima de dos tercios de su puesto" },
        ].map((k) => (
          <div key={k.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-white/50">{k.t}</p>
            <p className="mt-1 text-2xl font-semibold">{k.v}</p>
            <p className="mt-1 text-[11px] text-white/35">{k.h}</p>
          </div>
        ))}
      </div>

      {primeros.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4" style={{ borderTop: `3px solid ${MEJOR}` }}>
          <p className="text-sm font-semibold text-white">Los mejores de su puesto</p>
          <p className="mt-1 text-[13px] text-white/75">
            {primeros.map((x) => `${nombreFila(x.f)} (1º de ${x.ranking?.de}${(x.ranking?.de ?? 0) < GRUPO_CORTO ? " · tendencia" : ""})`).join(", ")}: primeros de su
            puesto contra {refLabel.toLowerCase()}.
          </p>
        </div>
      )}

      {filas.length === 0 ? (
        <p className="mt-6 text-sm text-white/55">Ningún jugador nuestro de ese puesto llega a {MINUTOS}′ en esta temporada.</p>
      ) : (
        <>
          <p className="mt-5 text-xs text-white/40">Pincha en una columna para ordenar y en un jugador para abrir su ficha. Minutos de Opta en la liga.</p>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
            <table className="w-full text-sm sm:min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                  {cabecera.map(([clave, texto, clase]) => (
                    <th key={texto} className={`py-3 font-medium ${clase}`}>
                      {clave ? (
                        <button
                          type="button"
                          onClick={() => setOrden({ por: clave, desc: orden.por === clave ? !orden.desc : clave !== "nombre" })}
                          className={`inline-flex items-center gap-1 uppercase hover:text-white/80 ${orden.por === clave ? "text-[#C8A96B]" : ""}`}
                        >
                          {texto}
                          <ArrowDownUp size={10} className={orden.por === clave ? "" : "opacity-40"} />
                        </button>
                      ) : (
                        texto
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((x) => {
                  const mejor = x.lineas
                    .filter((l) => l.p != null && defDe(l.a)?.mejor != null && PERFIL_FAMILIA[x.familia]?.includes(l.a))
                    .sort((a, b) => (b.p ?? 0) - (a.p ?? 0))[0];
                  return (
                    <tr
                      key={idDe(x.f)}
                      onClick={() => onAbre(idDe(x.f))}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onAbre(idDe(x.f));
                        }
                      }}
                      aria-label={`Abrir la ficha de ${nombreFila(x.f)}`}
                      className="cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Foto src={fichaDe(x.f)?.foto} nombre={nombreFila(x.f)} />
                          <div className="min-w-0">
                            <span className="font-medium text-white/90">{nombreFila(x.f)}</span>
                            <span className="block text-[10px] text-white/55 sm:hidden">
                              {[x.familia, `${x.minutos}′`, x.edad != null ? `${x.edad} años` : null].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-2 text-white/70 sm:table-cell">{x.edad ?? ""}</td>
                      <td className="hidden px-2 text-white/60 sm:table-cell">{PUESTO_OPTA[String(x.f.puesto ?? "")] ?? x.familia}</td>
                      <td className="hidden px-2 text-right tabular-nums text-white/70 sm:table-cell">{x.minutos}′</td>
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 text-right text-xs font-semibold tabular-nums" style={{ color: colorIndice(x.indice) }}>
                            {x.indice}
                          </span>
                          <Barra valor={x.indice ?? 0} color={colorIndice(x.indice)} />
                        </div>
                      </td>
                      <td className="px-2 text-xs text-white/70">
                        {x.ranking ? textoRanking(x.ranking) : ""}
                        {x.fueraDeEdad && <span className="block text-[10px] text-white/45">mayor de {refVista === "u21" ? 21 : 23}, contado como uno más</span>}
                      </td>
                      <td className="hidden px-2 text-xs text-white/65 md:table-cell">
                        {mejor ? (
                          <>
                            {cortoDe(mejor.a)} <b style={{ color: colorP(mejor.p ?? 0, true) }}>· percentil {mejor.p}</b>
                          </>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pocosMinutos.length > 0 && (
        <p className="mt-3 text-xs text-white/55">
          Con menos de {MINUTOS}′ no tienen índice y por eso no están en la tabla: {pocosMinutos.join(", ")}.
        </p>
      )}
      <details className="mt-3 text-xs text-white/55">
        <summary className="cursor-pointer text-white/70">Qué mide el índice de cada puesto</summary>
        <ul className="mt-2 space-y-1.5">
          {FAMILIAS.map((p) => (
            <li key={p}>
              <span className="font-medium text-white/75">{p}:</span>{" "}
              {(PERFIL_FAMILIA[p] ?? []).filter((a) => defDe(a)?.mejor != null).map(nombreDe).join(", ")}.
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  GRÁFICOS POR FASE                                                  */
/* ------------------------------------------------------------------ */

type Pregunta = { fase: string; pregunta: string; x: string; y: string; lectura: string };

const FASES_OPTA = [
  { key: "ataque", label: "Gol" },
  { key: "creacion", label: "Creación" },
  { key: "construccion", label: "Con balón" },
  { key: "defensa", label: "Sin balón" },
  { key: "porteria", label: "Portería" },
] as const;

const PREGUNTAS_OPTA: Pregunta[] = [
  { fase: "ataque", pregunta: "¿Convierte lo que genera?", x: "ExpG", y: "Goal", lectura: "Más a la derecha, más ocasiones de gol; más arriba, más goles." },
  { fase: "ataque", pregunta: "¿Remata mucho y a puerta?", x: "ShtIncBl", y: "OnTarget%", lectura: "Volumen de remate frente a la parte que va entre los tres palos." },
  { fase: "ataque", pregunta: "¿Pisa el área y lo convierte en ocasión?", x: "TouchOpBox", y: "ExpG", lectura: "Toques en el área rival frente a lo que valen sus remates." },
  { fase: "creacion", pregunta: "¿Crea ocasiones de calidad?", x: "Chance", y: "xA", lectura: "Cuántas ocasiones da frente a lo que valen." },
  { fase: "creacion", pregunta: "¿Desequilibra en el área?", x: "1v1InBox", y: "Sc1v1InBox", lectura: "Regates intentados en el área frente a los que salen." },
  { fase: "creacion", pregunta: "¿Centra mucho y bien?", x: "Crosses", y: "CrossCmp", lectura: "Centros frente a centros que llegan a un compañero." },
  { fase: "construccion", pregunta: "¿Participa y la da bien?", x: "PsAtt", y: "Pass%", lectura: "Volumen de pase frente a acierto." },
  { fase: "construccion", pregunta: "¿Aparece arriba y acierta?", x: "TchsA3", y: "Ps%InA3rd", lectura: "Toques en el último tercio frente al acierto en el pase allí." },
  { fase: "construccion", pregunta: "¿Cuánto pierde para lo que toca?", x: "Touches", y: "PossLost", lectura: "Más abajo, menos pérdidas para el mismo volumen." },
  { fase: "defensa", pregunta: "¿Roba mucho y dónde?", x: "Recovery", y: "PosWonA3rd", lectura: "Recuperaciones totales frente a las del último tercio." },
  { fase: "defensa", pregunta: "¿Gana los duelos?", x: "Duel%", y: "Aerial%", lectura: "Duelos ganados frente a duelos aéreos ganados." },
  { fase: "defensa", pregunta: "¿Corta y despeja?", x: "Int", y: "Clrnce", lectura: "Intercepciones frente a despejes." },
  { fase: "porteria", pregunta: "¿Para lo que le llega?", x: "Saves", y: "GABA", lectura: "Paradas frente a goles evitados (positivo: salva más de lo esperado)." },
  { fase: "porteria", pregunta: "¿Domina el área?", x: "CrossClaim", y: "SvInBox", lectura: "Centros atrapados frente a paradas dentro del área." },
];

function Graficos({
  filas,
  nuestros,
  familia,
  edad,
  refLabel,
  elegido,
  nombreFila,
  onElige,
}: {
  filas: Fila[];
  nuestros: FilaComp[];
  familia: Familia | "todos";
  edad: number | null;
  refLabel: string;
  elegido: string | null;
  nombreFila: (f: Fila) => string;
  onElige: (id: string) => void;
}) {
  const [pregunta, setPregunta] = useState(0);
  const [faseVista, setFaseVista] = useState<string>(PREGUNTAS_OPTA[0].fase);
  const [ejes, setEjes] = useState<{ x: string; y: string } | null>(null);

  const esPorteroArriba = familia === "Porteros";
  const fase = esPorteroArriba ? "porteria" : faseVista;
  const primeraDe = (f: string) => PREGUNTAS_OPTA.findIndex((q) => q.fase === f);
  const vista = PREGUNTAS_OPTA[pregunta]?.fase === fase ? pregunta : primeraDe(fase);
  const p = PREGUNTAS_OPTA[vista];

  /* Las de portería, sólo con porteros; el resto, con el puesto de arriba (todos = jugadores de campo). */
  const familiaGrafico: Familia | "campo" = fase === "porteria" ? "Porteros" : familia === "todos" ? "campo" : familia;

  const cols = useMemo(() => (filas.length ? Object.keys(filas[0]) : []), [filas]);
  const metricasEje = useMemo(
    () => cols.filter((c) => !NO_METRICA.has(c) && defDe(c) && valeParaFamilia(c, familiaGrafico)),
    [cols, familiaGrafico],
  );
  const x = ejes && metricasEje.includes(ejes.x) ? ejes.x : p.x;
  const y = ejes && metricasEje.includes(ejes.y) ? ejes.y : p.y;
  const puntos = useMemo(() => {
    const cuenta = (f: Fila) => {
      const fam = familiaDe(f);
      return familiaGrafico === "campo" ? fam != null && fam !== "Porteros" : fam === familiaGrafico;
    };
    const ref = filas
      .filter((f) => !esNuestro(f) && cuenta(f) && minutosDe(f) >= MINUTOS && (edad == null || (edadDe(f) ?? 99) <= edad))
      .map((f) => ({ f, x: valorDe(x, f), y: valorDe(y, f), nuestro: false }));
    const propios = nuestros
      .filter((n) => cuenta(n.f) && n.minutos >= MINUTOS)
      .map((n) => ({ f: n.f, x: valorDe(x, n.f), y: valorDe(y, n.f), nuestro: true }));
    return [...ref, ...propios].filter((q): q is { f: Fila; x: number; y: number; nuestro: boolean } => q.x != null && q.y != null);
  }, [filas, nuestros, familiaGrafico, edad, x, y]);

  const deRef = puntos.filter((q) => !q.nuestro);
  const mx = mediana(deRef.map((q) => q.x)) ?? 0;
  const my = mediana(deRef.map((q) => q.y)) ?? 0;
  const porEncima = (v: number, m: number, a: string) => (defDe(a)?.mejor === false ? v < m : v > m);
  const destacan = puntos.filter((q) => q.nuestro && porEncima(q.x, mx, x) && porEncima(q.y, my, y));
  const puestoTexto = familiaGrafico === "campo" ? "jugadores de campo" : familiaGrafico.toLowerCase();

  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FASES_OPTA.filter((f) => (esPorteroArriba ? f.key === "porteria" : true)).map((f) => (
          <Chip
            key={f.key}
            activo={fase === f.key}
            onClick={() => {
              setFaseVista(f.key);
              setPregunta(primeraDe(f.key));
              setEjes(null);
            }}
          >
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PREGUNTAS_OPTA.map((q, i) =>
          q.fase === fase ? (
            <button
              key={q.pregunta}
              type="button"
              onClick={() => {
                setPregunta(i);
                setEjes(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-left text-sm transition ${
                !ejes && vista === i ? "bg-[#C8A96B]/15 text-[#C8A96B]" : "bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
              }`}
            >
              {q.pregunta}
            </button>
          ) : null,
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-base font-semibold">{ejes ? `${etiquetaDe(x)} frente a ${etiquetaDe(y)}` : p.pregunta}</p>
            <p className="text-[11px] text-white/40">
              {puntos.length} {puestoTexto} · líneas = mediana de {refLabel.toLowerCase()}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-white/45">{ejes ? "Las dos métricas elegidas." : p.lectura}</p>
          {puntos.length < 3 ? (
            <p className="mt-6 text-sm text-white/45">No hay bastantes jugadores con esas dos métricas para dibujarlas.</p>
          ) : (
            <Dispersion puntos={puntos} x={x} y={y} mx={mx} my={my} elegido={elegido} nombreFila={nombreFila} onElige={onElige} />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-white/45">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ORO }} /> Castilla (pincha para abrir su ficha)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: tinta(0.3) }} /> {refLabel}
            </span>
          </div>
        </div>

        <aside className="space-y-3">
          {destacan.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
              <p className="text-[11px] uppercase tracking-wider text-white/40">Por encima de la mediana en las dos</p>
              <p className="mt-1.5 text-[#C8A96B]">{destacan.map((q) => nombreFila(q.f)).join(", ")}</p>
            </div>
          )}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40">O elige tú las dos métricas</p>
            {(["x", "y"] as const).map((eje) => (
              <label key={eje} className="mt-2 block text-[11px] text-white/45">
                {eje === "x" ? "Eje horizontal" : "Eje vertical"}
                <select
                  value={eje === "x" ? x : y}
                  onChange={(e) => setEjes({ x: eje === "x" ? e.target.value : x, y: eje === "y" ? e.target.value : y })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white"
                >
                  {[...metricasEje]
                    .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), "es"))
                    .map((m) => (
                      <option key={m} value={m} className="bg-[#11161C]">
                        {nombreDe(m)}
                      </option>
                    ))}
                </select>
              </label>
            ))}
            {ejes && (
              <button type="button" onClick={() => setEjes(null)} className="mt-2 text-[11px] text-[#C8A96B] hover:underline">
                Volver a la pregunta
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Dispersion({
  puntos,
  x,
  y,
  mx,
  my,
  elegido,
  nombreFila,
  onElige,
}: {
  puntos: { f: Fila; x: number; y: number; nuestro: boolean }[];
  x: string;
  y: string;
  mx: number;
  my: number;
  elegido: string | null;
  nombreFila: (f: Fila) => string;
  onElige: (id: string) => void;
}) {
  const W = 640;
  const H = 360;
  const M = { l: 52, r: 16, t: 14, b: 40 };
  const rango = (v: number[]) => {
    const min = Math.min(...v);
    const max = Math.max(...v);
    const pad = (max - min || 1) * 0.06;
    return [min >= 0 ? Math.max(0, min - pad) : min - pad, max + pad] as const;
  };
  const [x0, x1] = rango(puntos.map((p) => p.x));
  const [y0, y1] = rango(puntos.map((p) => p.y));
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
  const ticks = (a: number, b: number) => [0, 0.25, 0.5, 0.75, 1].map((t) => a + (b - a) * t);

  /* Rótulos de los nuestros sin pisarse: el elegido primero; si no cabe, sin rótulo (el globo dice quién es). */
  const nuestros = puntos.filter((p) => p.nuestro).sort((a, b) => Number(idDe(b.f) === elegido) - Number(idDe(a.f) === elegido));
  const cajas: { x: number; y: number; w: number; h: number }[] = [];
  const rotulos = new Map<string, { x: number; y: number; ancla: "start" | "end" }>();
  for (const p of nuestros) {
    const texto = apellido(nombreFila(p.f));
    const w = texto.length * 5.8;
    const cx = sx(p.x);
    const cy = sy(p.y);
    for (const t of [
      { x: cx + 7, y: cy - 6, ancla: "start" as const },
      { x: cx + 7, y: cy + 13, ancla: "start" as const },
      { x: cx - 7, y: cy - 6, ancla: "end" as const },
      { x: cx - 7, y: cy + 13, ancla: "end" as const },
    ]) {
      const caja = { x: t.ancla === "start" ? t.x : t.x - w, y: t.y - 9, w, h: 11 };
      const fuera = caja.x < 0 || caja.x + w > W;
      const choca = cajas.some((o) => caja.x < o.x + o.w && caja.x + caja.w > o.x && caja.y < o.y + o.h && caja.y + caja.h > o.y);
      if (!fuera && !choca) {
        cajas.push(caja);
        rotulos.set(idDe(p.f), t);
        break;
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" style={{ maxHeight: "max(260px, calc(100vh - 470px))" }} role="img" aria-label={`${etiquetaDe(x)} frente a ${etiquetaDe(y)}`}>
      {ticks(x0, x1).map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke={tinta(0.06)} />
          <text x={sx(t)} y={H - M.b + 14} fontSize={10} textAnchor="middle" style={{ fill: tinta(0.45) }}>
            {textoDe(x, t)}
          </text>
        </g>
      ))}
      {ticks(y0, y1).map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={tinta(0.06)} />
          <text x={M.l - 6} y={sy(t) + 3} fontSize={10} textAnchor="end" style={{ fill: tinta(0.45) }}>
            {textoDe(y, t)}
          </text>
        </g>
      ))}
      <line x1={sx(mx)} x2={sx(mx)} y1={M.t} y2={H - M.b} stroke={tinta(0.3)} strokeDasharray="4 4" />
      <line x1={M.l} x2={W - M.r} y1={sy(my)} y2={sy(my)} stroke={tinta(0.3)} strokeDasharray="4 4" />
      <text x={(M.l + W - M.r) / 2} y={H - 6} fontSize={11} textAnchor="middle" style={{ fill: tinta(0.6) }}>
        {etiquetaDe(x)}
      </text>
      <text x={12} y={(M.t + H - M.b) / 2} fontSize={11} textAnchor="middle" style={{ fill: tinta(0.6) }} transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>
        {etiquetaDe(y)}
      </text>
      {puntos
        .filter((p) => !p.nuestro)
        .map((p) => (
          <circle key={idDe(p.f)} cx={sx(p.x)} cy={sy(p.y)} r={3.4} style={{ fill: tinta(0.28) }}>
            <title>{`${String(p.f.jugador ?? "")} (${String(p.f.equipo ?? "")})${edadDe(p.f) != null ? `, ${edadDe(p.f)} años` : ""} · ${textoDe(x, p.x)} · ${textoDe(y, p.y)}`}</title>
          </circle>
        ))}
      {nuestros.map((p) => {
        const es = idDe(p.f) === elegido;
        const r = rotulos.get(idDe(p.f));
        return (
          <g key={`n-${idDe(p.f)}`} className="cursor-pointer" onClick={() => onElige(idDe(p.f))}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={es ? 6.5 : 5} style={{ fill: ORO, stroke: es ? tinta(0.9) : tinta(0.35) }} strokeWidth={es ? 1.5 : 0.8}>
              <title>{`${nombreFila(p.f)} · ${textoDe(x, p.x)} · ${textoDe(y, p.y)}`}</title>
            </circle>
            {r && (
              <text x={r.x} y={r.y} textAnchor={r.ancla} fontSize={10} fontWeight={es ? 700 : 500} style={{ fill: ORO }}>
                {apellido(nombreFila(p.f))}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  FICHA                                                              */
/* ------------------------------------------------------------------ */

function LineaMetrica({ l }: { l: Linea }) {
  const d = defDe(l.a);
  return (
    <li className="text-[12px]" title={l.mediana != null ? `Mediana del puesto: ${textoDe(l.a, l.mediana)}` : undefined}>
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-white/80">
          {nombreDe(l.a)}
          {d?.mejor === false && <span className="ml-1 text-[10px] text-white/40">(menos es mejor)</span>}
          {d?.mejor == null && <span className="ml-1 text-[10px] text-white/40">(estilo)</span>}
        </span>
        <span className="shrink-0 tabular-nums text-white/60">
          {textoDe(l.a, l.valor)}
          {d && !esTasa(d) ? " /90" : ""}
          {l.p != null && (
            <>
              {" · "}
              <b style={{ color: colorP(l.p, d?.mejor) }}>p{l.p}</b>
            </>
          )}
        </span>
      </div>
      {l.p != null && <Barra valor={l.p} color={colorP(l.p, d?.mejor)} />}
    </li>
  );
}

function Ficha({
  activo,
  opciones,
  onElige,
  fichaDe,
  nombreFila,
  refLabel,
  temporada,
}: {
  activo: FilaComp;
  opciones: FilaComp[];
  onElige: (id: string) => void;
  fichaDe: (f: Fila) => Player | null;
  nombreFila: (f: Fila) => string;
  refLabel: string;
  temporada: Temporada | null;
}) {
  const [todas, setTodas] = useState(false);
  const perfil = PERFIL_FAMILIA[activo.familia] ?? [];
  const delPuesto = perfil.map((a) => activo.lineas.find((l) => l.a === a)).filter((l): l is Linea => Boolean(l));
  const resto = activo.lineas.filter((l) => !perfil.includes(l.a));
  const juzgadas = delPuesto.filter((l) => l.p != null && defDe(l.a)?.mejor != null).sort((a, b) => (b.p ?? 0) - (a.p ?? 0));
  const fuertes = juzgadas.filter((l) => (l.p ?? 0) >= 60).slice(0, 3);
  const mejora = [...juzgadas].reverse().filter((l) => (l.p ?? 0) < 40).slice(0, 3);

  return (
    <>
      <label className="mt-6 flex max-w-sm flex-col gap-1 text-[11px] uppercase tracking-wider text-white/40">
        Jugador
        <select
          value={idDe(activo.f)}
          onChange={(e) => onElige(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm normal-case tracking-normal text-white"
        >
          {[...opciones]
            .sort((a, b) => nombreFila(a.f).localeCompare(nombreFila(b.f), "es"))
            .map((x) => (
              <option key={idDe(x.f)} value={idDe(x.f)} className="bg-[#11161C]">
                {nombreFila(x.f)} · {x.familia}
              </option>
            ))}
        </select>
      </label>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Foto src={fichaDe(activo.f)?.foto} nombre={nombreFila(activo.f)} size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{nombreFila(activo.f)}</p>
            <p className="text-xs text-white/55">
              {[
                PUESTO_OPTA[String(activo.f.puesto ?? "")] ?? activo.familia,
                String(activo.f.equipo ?? ""),
                temporada ? temporadaCorta(temporada.clave) : null,
                `${activo.minutos}′`,
                activo.edad != null ? `${activo.edad} años` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {activo.indice != null && (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-white/40">Índice</p>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: colorIndice(activo.indice) }}>
                {activo.indice}
              </p>
              {activo.ranking && <p className="text-[11px] text-white/50">{textoRanking(activo.ranking)}</p>}
            </div>
          )}
        </div>
        <p className="mt-3 text-[12px] text-white/55">
          Percentil contra {refLabel.toLowerCase()} de los {activo.familia.toLowerCase()} con {MINUTOS}′ o más; por 90′ salvo los porcentajes.{" "}
          <b className="text-white/75">p80</b> = mejor que el 80 % de ellos.
          {activo.minutos < MINUTOS ? ` Lleva ${activo.minutos}′: los percentiles son tendencia.` : ""}
        </p>

        {(fuertes.length > 0 || mejora.length > 0) && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {fuertes.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: MEJOR }}>Puntos fuertes</p>
                <ul className="space-y-1 text-[13px] text-white/80">
                  {fuertes.map((l) => (
                    <li key={l.a} className="flex items-center gap-1.5">
                      <ArrowUpRight size={14} style={{ color: MEJOR }} /> {nombreDe(l.a)} · percentil {l.p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {mejora.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: PEOR }}>A mejorar</p>
                <ul className="space-y-1 text-[13px] text-white/80">
                  {mejora.map((l) => (
                    <li key={l.a} className="flex items-center gap-1.5">
                      <ArrowDownRight size={14} style={{ color: PEOR }} /> {nombreDe(l.a)} · percentil {l.p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {delPuesto.length > 0 && (
          <>
            <p className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Lo que se le pide a su puesto</p>
            <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2">
              {delPuesto.map((l) => (
                <LineaMetrica key={l.a} l={l} />
              ))}
            </ul>
          </>
        )}
        {resto.length > 0 && (
          <>
            <button type="button" onClick={() => setTodas(!todas)} className="mt-4 text-[12px] font-semibold text-[#C8A96B] underline underline-offset-2">
              {todas ? "Sólo las de su puesto" : `Ver las otras ${resto.length} métricas`}
            </button>
            {todas && (
              <ul className="mt-2 grid gap-x-6 gap-y-2 md:grid-cols-2">
                {resto.map((l) => (
                  <LineaMetrica key={l.a} l={l} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  EVOLUCIÓN POR TEMPORADAS                                           */
/* ------------------------------------------------------------------ */

type Paso = {
  t: Temporada;
  f: Fila;
  familia: Familia | null;
  minutos: number;
  /** a → { valor, percentil contra su puesto en esa temporada (toda la categoría) }. */
  m: Map<string, { valor: number; p: number | null }>;
};

function Evolucion({
  temporadas,
  filasDe,
  actual,
  fichaDe,
  nombreFila,
  descripcion,
  familiaSel,
}: {
  temporadas: Temporada[];
  filasDe: Map<string, Fila[]>;
  actual: Temporada;
  fichaDe: (f: Fila) => Player | null;
  nombreFila: (f: Fila) => string;
  descripcion: (t: Temporada) => string;
  familiaSel: Familia | "todos";
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);

  /* De la más antigua a la actual: así se lee la evolución. */
  const orden = useMemo(() => [...temporadas].sort((a, b) => (a.actual ? 1 : b.actual ? -1 : a.clave.localeCompare(b.clave))), [temporadas]);

  /* Los nuestros de ahora que están en más de una temporada (por el id de Opta, que no cambia). */
  const candidatos = useMemo(() => {
    const nuestros = (filasDe.get(actual.clave) ?? []).filter(esNuestro);
    return nuestros
      .map((f) => ({ f, en: orden.filter((t) => (filasDe.get(t.clave) ?? []).some((o) => idDe(o) === idDe(f))) }))
      .filter((x) => x.en.length > 1 && (familiaSel === "todos" || familiaDe(x.f) === familiaSel))
      .sort((a, b) => minutosDe(b.f) - minutosDe(a.f));
  }, [filasDe, actual, orden, familiaSel]);

  const sel = candidatos.find((c) => idDe(c.f) === elegido) ?? candidatos[0] ?? null;

  const pasos = useMemo<Paso[]>(() => {
    if (!sel) return [];
    return sel.en.map((t) => {
      const fs = filasDe.get(t.clave) ?? [];
      const f = fs.find((o) => idDe(o) === idDe(sel.f))!;
      const familia = familiaDe(f);
      const muestra = familia ? fs.filter((o) => idDe(o) !== idDe(f) && familiaDe(o) === familia && minutosDe(o) >= MINUTOS) : [];
      const m = new Map<string, { valor: number; p: number | null }>();
      for (const a of Object.keys(f)) {
        if (NO_METRICA.has(a) || !defDe(a) || !valeParaFamilia(a, familia)) continue;
        const v = valorDe(a, f);
        if (v == null) continue;
        const valores = muestra.map((o) => valorDe(a, o)).filter((x): x is number => x != null);
        m.set(a, { valor: v, p: valores.length >= 5 ? percentil(v, valores, defDe(a)?.mejor === false) : null });
      }
      return { t, f, familia, minutos: minutosDe(f), m };
    });
  }, [sel, filasDe]);

  if (!candidatos.length) {
    return (
      <p className="mt-6 text-sm text-white/55">
        Ningún jugador del Castilla de {temporadaCorta(actual.clave)}
        {familiaSel !== "todos" ? ` en ${familiaSel.toLowerCase()}` : ""} aparece en otra temporada de Opta.
      </p>
    );
  }

  const ultimo = pasos[pasos.length - 1];
  const familia = ultimo?.familia ?? null;
  const cols = ultimo ? Object.keys(ultimo.f) : [];
  const { perfil, resto } = metricasTodas(familia, cols);
  const conDato = (a: string) => pasos.some((p) => p.m.has(a));
  const lista = (todas ? [...perfil, ...resto] : perfil).filter(conDato);

  /* Lo que más se ha movido entre la primera y la última temporada con minutos. */
  const conMinutos = pasos.filter((p) => p.minutos >= MINUTOS);
  const primero = conMinutos[0];
  const final = conMinutos[conMinutos.length - 1];
  const cambios =
    primero && final && primero !== final
      ? [...perfil, ...resto]
          .filter((a) => defDe(a)?.mejor != null)
          .map((a) => ({ a, de: primero.m.get(a)?.p, a2: final.m.get(a)?.p }))
          .filter((c): c is { a: string; de: number; a2: number } => c.de != null && c.a2 != null)
          .map((c) => ({ ...c, salto: c.a2 - c.de }))
      : [];
  const suben = [...cambios].sort((a, b) => b.salto - a.salto).filter((c) => c.salto > ESTABLE).slice(0, 3);
  const bajan = [...cambios].sort((a, b) => a.salto - b.salto).filter((c) => c.salto < -ESTABLE).slice(0, 3);

  return (
    <div className="mt-5 space-y-4">
      <label className="flex max-w-sm flex-col gap-1 text-[11px] uppercase tracking-wider text-white/40">
        Jugador del Castilla
        <select
          value={sel ? idDe(sel.f) : ""}
          onChange={(e) => setElegido(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm normal-case tracking-normal text-white"
        >
          {candidatos.map((c) => (
            <option key={idDe(c.f)} value={idDe(c.f)} className="bg-[#11161C]">
              {nombreFila(c.f)} · {c.en.map((t) => temporadaCorta(t.clave)).join(", ")}
            </option>
          ))}
        </select>
      </label>

      {sel && (
        <div className="flex items-center gap-3">
          <Foto src={fichaDe(sel.f)?.foto} nombre={nombreFila(sel.f)} size={44} />
          <div>
            <p className="text-lg font-semibold">{nombreFila(sel.f)}</p>
            <p className="text-xs text-white/55">
              {pasos.map((p) => `${temporadaCorta(p.t.clave)}: ${String(p.f.equipo ?? "")}, ${p.minutos}′${p.familia ? `, ${p.familia.toLowerCase()}` : ""}`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {(suben.length > 0 || bajan.length > 0) && primero && final && (
        <div className="grid gap-3 md:grid-cols-2">
          {suben.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" style={{ borderTop: `3px solid ${MEJOR}` }}>
              <p className="text-sm font-semibold text-white">
                Sube de {temporadaCorta(primero.t.clave)} a {temporadaCorta(final.t.clave)}
              </p>
              <ul className="mt-1.5 space-y-1 text-[13px] text-white/75">
                {suben.map((c) => (
                  <li key={c.a}>
                    {nombreDe(c.a)}: percentil {c.de} → {c.a2} (+{c.salto})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {bajan.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" style={{ borderTop: `3px solid ${PEOR}` }}>
              <p className="text-sm font-semibold text-white">
                Baja de {temporadaCorta(primero.t.clave)} a {temporadaCorta(final.t.clave)}
              </p>
              <ul className="mt-1.5 space-y-1 text-[13px] text-white/75">
                {bajan.map((c) => (
                  <li key={c.a}>
                    {nombreDe(c.a)}: percentil {c.de} → {c.a2} ({c.salto})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm sm:min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
              <th className="px-4 py-3 font-medium">Métrica</th>
              {pasos.map((p) => (
                <th key={p.t.clave} className="px-3 py-3 text-right font-medium">
                  {temporadaCorta(p.t.clave)}
                  <span className="block text-[10px] normal-case tracking-normal text-white/40">
                    {p.minutos}′{p.minutos < MINUTOS ? " · tendencia" : ""}
                  </span>
                </th>
              ))}
              {pasos.length > 1 && <th className="px-3 py-3 text-right font-medium">Cambio</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => {
              const d = defDe(a);
              const ext = pasos.filter((p) => p.minutos >= MINUTOS && p.m.get(a)?.p != null);
              const salto = ext.length > 1 ? (ext[ext.length - 1].m.get(a)!.p as number) - (ext[0].m.get(a)!.p as number) : null;
              return (
                <tr key={a} className="border-t border-white/[0.06]">
                  <td className="px-4 py-2 text-white/80">
                    {nombreDe(a)}
                    <span className="ml-1 text-[10px] text-white/40">
                      {d && !esTasa(d) ? "/90" : ""}
                      {d?.mejor === false ? " · menos es mejor" : d?.mejor == null ? " · estilo" : ""}
                    </span>
                  </td>
                  {pasos.map((p) => {
                    const c = p.m.get(a);
                    const corto = p.minutos < MINUTOS;
                    return (
                      <td key={p.t.clave} className={`px-3 py-2 text-right tabular-nums ${corto ? "italic opacity-60" : ""}`}>
                        {c ? (
                          <>
                            <span className="text-white/80">{textoDe(a, c.valor)}</span>
                            {c.p != null && (
                              <b className="ml-1.5 text-[11px]" style={{ color: corto ? tinta(0.5) : colorP(c.p, d?.mejor) }}>
                                p{c.p}
                              </b>
                            )}
                          </>
                        ) : (
                          ""
                        )}
                      </td>
                    );
                  })}
                  {pasos.length > 1 && (
                    <td className="px-3 py-2 text-right text-xs">
                      {salto != null && (
                        <span
                          className="inline-flex items-center gap-0.5"
                          style={{ color: d?.mejor == null ? tinta(0.6) : salto > ESTABLE ? MEJOR : salto < -ESTABLE ? PEOR : tinta(0.6) }}
                        >
                          {salto > ESTABLE ? <ArrowUpRight size={13} /> : salto < -ESTABLE ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                          {Math.abs(salto) <= ESTABLE ? "igual" : `${salto > 0 ? "+" : ""}${salto}`}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {resto.some(conDato) && (
        <button type="button" onClick={() => setTodas(!todas)} className="text-[12px] font-semibold text-[#C8A96B] underline underline-offset-2">
          {todas ? "Sólo las métricas de su puesto" : `Ver también las otras ${resto.filter(conDato).length} métricas`}
        </button>
      )}

      <div className="space-y-1 text-xs text-white/55">
        <p>
          Cada temporada, su valor (por 90′ salvo los porcentajes) y su percentil contra los de su puesto de esa temporada con {MINUTOS}′ o
          más, de todas las edades. «Cambio» son puntos de percentil entre la primera y la última temporada con minutos; entre −{ESTABLE} y +
          {ESTABLE}, igual. Con menos de {MINUTOS}′ la temporada va atenuada: tendencia.
        </p>
        <p>La categoría no es la misma cada año:</p>
        <ul className="list-disc pl-5">
          {pasos.map((p) => (
            <li key={p.t.clave}>{descripcion(p.t)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
