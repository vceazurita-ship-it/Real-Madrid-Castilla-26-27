"use client";

/*
|--------------------------------------------------------------------------
| ANÁLISIS DE GOLES (13/10/2026)
|--------------------------------------------------------------------------
|
| Los goles de un equipo y los de toda la liga, por franjas de minutos a
| medida (cada 15 y los descuentos aparte, por defecto), como local y como
| visitante, con los remates de Wyscout al lado, y la tipología de los goles
| de nuestros partidos (la hoja del cuerpo técnico: ataque organizado,
| transición y ABP). Los datos y de dónde sale cada uno: `lib/goles/analisis.ts`.
*/

import { useMemo, useState, type ReactNode } from "react";
import { Clock, Crosshair, Goal, Home, LayoutDashboard, Lightbulb, ListOrdered, Shapes, Trophy } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { EsqueletoPantalla } from "@/components/ui/estados";
import { AbpHeader, Notice, Panel, SaveState, Segmented, Select, StatCard, StatRow } from "@/components/abp/ui";
import { MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { Lectura } from "@/components/data/formas";
import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { Explicativo, useTextosExplicativos } from "@/components/ui/textos-analisis";
import { GraficasTipologia, type GolConTipo } from "@/components/goles/GraficasTipologia";
import { avisoMuestra, loImportante, lecturaCondicion, lecturaFranjas, lecturaPrimero, lecturaTipologia, tramosClave } from "@/lib/goles/lecturas";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { useCalendario } from "@/hooks/useCalendario";
import { nombreEquipo } from "@/lib/equipos";
import { comoNuestro } from "@/lib/castilla/calendario";
import { mismoEquipo } from "@/lib/data-analisis/nombres";
import {
  CASTILLA,
  DOC_GOLES,
  DOC_TIPOLOGIA_MANUAL,
  FASES,
  GOLES_VACIO,
  NOMBRE_TIPO,
  fmt,
  franjaDe,
  franjas,
  franjasACortes,
  golesDe,
  ladoDe,
  marcadorTras,
  media,
  primerGol,
  rotuloMinuto,
  type Franja,
  type GolesDoc,
  type Lado,
  type RematesWyscout,
  type TipoGol,
  type TipologiaManual,
} from "@/lib/goles/analisis";

type Condicion = "todos" | Lado;

const TAMANOS = [5, 10, 15, 30, 45];

const VISTAS = ["resumen", "minutos", "casa", "tipo", "goles"] as const;
type Vista = (typeof VISTAS)[number];

/* Un motivo que habla de las fuentes (Hudl, timeline…) es método, no fútbol: sólo con los textos explicativos encendidos. */
const esMetodo = (t: string) => /hudl|timeline|besoccer|wyscout|táctica/i.test(t);

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)} %` : "—");

/* ------------------------------------------------------------------ */
/*  Piezas                                                             */
/* ------------------------------------------------------------------ */

/**
 * Dos gráficas en espejo, una encima de otra: arriba los goles a favor y
 * abajo los en contra, con el número encima de cada barra y la media de la
 * liga como raya. Entre las dos partes, una línea de descanso. Antes iban las
 * dos barras pegadas por franja y había que mirar la leyenda para saber cuál
 * era cuál.
 */
function GraficaFranjas({ filas }: { filas: { franja: Franja; gf: number; gc: number; ligaPP: number; ligaContraPP: number; partidos: number }[] }) {
  const max = Math.max(0.01, ...filas.flatMap((f) => [media(f.gf, f.partidos), media(f.gc, f.partidos), f.ligaPP, f.ligaContraPP]));
  const alto = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

  const fila = (aFavor: boolean) => (
    <div className={`flex h-24 gap-1 sm:gap-2 ${aFavor ? "items-end" : "items-start"}`}>
      {filas.map((f, i) => {
        const goles = aFavor ? f.gf : f.gc;
        const pp = media(goles, f.partidos);
        const liga = aFavor ? f.ligaPP : f.ligaContraPP;
        const color = aFavor ? ORO : PEOR;
        const descanso = i > 0 && f.franja.parte === 2 && filas[i - 1].franja.parte === 1;

        return (
          <div key={f.franja.clave} className={`relative flex h-full min-w-0 flex-1 justify-center ${aFavor ? "items-end" : "items-start"} ${descanso ? "border-l border-dashed border-white/20 pl-1 sm:pl-2" : ""}`}>
            <div
              className={`relative w-3/5 max-w-[34px] transition-[height] duration-500 ${aFavor ? "rounded-t" : "rounded-b"}`}
              style={{ height: alto(pp), backgroundColor: color, opacity: goles ? 1 : 0.25, minHeight: 2 }}
              title={`${f.franja.nombre} · ${aFavor ? "a favor" : "en contra"}: ${goles} (${fmt(pp)} por partido; liga ${fmt(liga)})`}
            >
              <span className={`absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold tabular-nums ${aFavor ? "-top-4" : "-bottom-4"}`} style={{ color: goles ? color : tinta(0.3) }}>
                {goles}
              </span>
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed"
              style={{ [aFavor ? "bottom" : "top"]: alto(liga), borderColor: tinta(0.5) }}
              title={`Liga: ${fmt(liga)} por equipo y partido`}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-w-0">
      <p className="mb-5 text-[10px] uppercase tracking-[0.16em]" style={{ color: ORO }}>
        Goles a favor
      </p>
      {fila(true)}
      <div className="my-1 flex gap-1 border-y border-white/10 py-1.5 sm:gap-2">
        {filas.map((f, i) => (
          <span
            key={f.franja.clave}
            className={`min-w-0 flex-1 truncate text-center text-[10px] tabular-nums ${f.franja.descuento ? "font-semibold text-[#C8A96B]" : "text-white/55"} ${i > 0 && f.franja.parte === 2 && filas[i - 1].franja.parte === 1 ? "border-l border-dashed border-white/20" : ""}`}
          >
            {f.franja.nombre}
          </span>
        ))}
      </div>
      {fila(false)}
      <p className="mt-5 text-[10px] uppercase tracking-[0.16em]" style={{ color: PEOR }}>
        Goles en contra
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/50">
        <span>La altura es por partido; el número, los goles.</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed" style={{ borderColor: tinta(0.5) }} /> Lo que marca (o encaja) un equipo medio de la liga
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 border-l border-dashed border-white/40" /> Descanso
        </span>
      </div>
    </div>
  );
}

type FilaTabla = ReactNode[] | { seccion: string };

function Tabla({ cabeza, filas, pie }: { cabeza: string[]; filas: FilaTabla[]; pie?: ReactNode[] }) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
            {cabeza.map((c, i) => (
              <th key={i} className={`px-3 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) =>
            Array.isArray(fila) ? (
              <tr key={i} className="border-b border-white/[0.06] last:border-0">
                {fila.map((celda, j) => (
                  <td key={j} className={`px-3 py-1.5 tabular-nums ${j === 0 ? "text-left text-white/75" : "text-right text-white/85"}`}>
                    {celda}
                  </td>
                ))}
              </tr>
            ) : (
              <tr key={i} className="bg-white/[0.05]">
                <td colSpan={cabeza.length} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                  {fila.seccion}
                </td>
              </tr>
            ),
          )}
        </tbody>
        {pie ? (
          <tfoot>
            <tr className="border-t border-white/15 font-semibold">
              {pie.map((celda, j) => (
                <td key={j} className={`px-3 py-2 tabular-nums ${j === 0 ? "text-left text-white/75" : "text-right text-white"}`}>
                  {celda}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/**
 * Un valor del equipo frente a la liga: verde y ▲ si es mejor, naranja y ▼
 * si es peor (más de un 10 %), y nada si está en la media. La flecha va por
 * si el color no se distingue (modo día, pantalla del vestuario).
 */
function Contra({ valor, liga, mejorAlto, dec = 1, sufijo = "", n }: { valor: number; liga: number; mejorAlto: boolean; dec?: number; sufijo?: string; n?: number }) {
  /* 29/10/2026: con menos de 5 partidos la flecha no juzga: gris y con los partidos a la vista. */
  const corta = n !== undefined && n < 5;
  /* Con valores que pueden ser negativos (goles menos xG) el 10 % no vale: se mira la diferencia. */
  const margen = liga > 0 ? liga * 0.1 : 0.1;
  const mejor = !corta && (mejorAlto ? valor > liga + margen : valor < liga - margen);
  const peor = !corta && (mejorAlto ? valor < liga - margen : valor > liga + margen);

  return (
    <span style={{ color: mejor ? MEJOR : peor ? PEOR : undefined }} title={`Liga: ${fmt(liga, dec)}${sufijo}`}>
      {mejor ? "▲ " : peor ? "▼ " : ""}
      {fmt(valor, dec)}
      {sufijo}
      {corta ? ` (${n} ${n === 1 ? "partido" : "partidos"})` : ""}
    </span>
  );
}

/** «1-15' y 16-30'»: las franjas empatadas en lo más alto. */
function franjasTop(filas: { franja: Franja; gf: number; gc: number }[], k: "gf" | "gc") {
  const max = Math.max(0, ...filas.map((f) => f[k]));

  if (!max) return null;

  const top = filas.filter((f) => f[k] === max).map((f) => f.franja.nombre);

  return { nombre: top.length > 2 ? `${top.length} franjas` : top.join(" y "), goles: max, empate: top.length > 1 };
}

/* ------------------------------------------------------------------ */
/*  Pantalla                                                           */
/* ------------------------------------------------------------------ */

export function PantallaGoles() {
  const { value: doc, status } = useRemoteDoc<GolesDoc>({ key: DOC_GOLES, kind: "goles", fallback: GOLES_VACIO });
  const manual = useRemoteDoc<TipologiaManual>({ key: DOC_TIPOLOGIA_MANUAL, kind: "goles", fallback: {} });

  const todos = useMemo(() => doc.partidos ?? [], [doc.partidos]);
  const jornadas = useMemo(() => [...new Set(todos.map((p) => p.jornada))].sort((a, b) => a - b), [todos]);
  const ultima = jornadas.at(-1) ?? 1;

  const equipos = useMemo(() => [...new Set(todos.flatMap((p) => [p.local, p.visitante]))].sort((a, b) => a.localeCompare(b, "es")), [todos]);
  const nuestroNombre = equipos.find((e) => mismoEquipo(e, CASTILLA)) ?? CASTILLA;

  const [equipoElegido, setEquipo] = useState<string | null>(null);
  const [condicion, setCondicion] = useState<Condicion>("todos");
  const [desde, setDesde] = useState<number | null>(null);
  const [hasta, setHasta] = useState<number | null>(null);
  const [tamano, setTamano] = useState(15);
  const [cortes, setCortes] = useState("");
  const [descuentos, setDescuentos] = useState(true);
  const [vista, setVista] = usePestanaUrl<Vista>("vista", VISTAS, "resumen");
  const explicativos = useTextosExplicativos();

  const equipo = equipoElegido ?? nuestroNombre;
  const esNuestro = mismoEquipo(equipo, CASTILLA);
  /* 19/10/2026: con «desde» por detrás de «hasta» (J9 a J4) la pantalla se
     quedaba entera a cero sin decir por qué. Se lee como el tramo entre las
     dos, en el orden que sea. */
  const jA = desde ?? jornadas[0] ?? 1;
  /* «Hasta» abre en la última jornada con partido DEL EQUIPO, no en la última de la
     liga: si a él le falta la J9, decir «jornadas 1 a 9» lo cuenta como jugada. */
  const ultimaDelEquipo = useMemo(
    () => todos.reduce((m, p) => (ladoDe(p, equipo) ? Math.max(m, p.jornada) : m), 0),
    [todos, equipo],
  );
  const jB = hasta ?? (ultimaDelEquipo || ultima);
  const jDesde = Math.min(jA, jB);
  const jHasta = Math.max(jA, jB);

  /* Los desplegables no ofrecen una jornada que el equipo elegido todavía no ha jugado
     (la liga puede traer algún partido adelantado de la siguiente). */
  const jornadasJugadas = useMemo(() => {
    const tope = ultimaDelEquipo || ultima;
    const hasta = Math.max(tope, jDesde, jHasta);

    return jornadas.filter((j) => j <= hasta);
  }, [jornadas, ultimaDelEquipo, ultima, jDesde, jHasta]);

  const lista = useMemo(() => franjasACortes(cortes, descuentos) ?? franjas(tamano, descuentos), [cortes, descuentos, tamano]);

  /* Los partidos del tramo de jornadas: la liga entera y los del equipo con la condición. */
  const liga = useMemo(() => todos.filter((p) => p.jornada >= jDesde && p.jornada <= jHasta), [todos, jDesde, jHasta]);
  const delEquipo = useMemo(
    () =>
      liga.filter((p) => {
        const lado = ladoDe(p, equipo);

        return lado && (condicion === "todos" || lado === condicion);
      }),
    [liga, equipo, condicion],
  );

  /* Hasta qué jornada llegan los datos DEL EQUIPO: si le falta alguna, se dice
     en el resumen para que nadie compare un partido de menos con la liga. */
  const jUltimaEquipo = useMemo(
    () => liga.reduce((m, p) => (ladoDe(p, equipo) ? Math.max(m, p.jornada) : m), 0),
    [liga, equipo],
  );

  const goles = useMemo(() => golesDe(delEquipo, equipo), [delEquipo, equipo]);
  /* Los totales salen del marcador de cada partido; las franjas, de los goles con minuto. */
  const gf = delEquipo.reduce((s, p) => s + (ladoDe(p, equipo) === "local" ? p.gl : p.gv), 0);
  const gc = delEquipo.reduce((s, p) => s + (ladoDe(p, equipo) === "local" ? p.gv : p.gl), 0);
  const sinMinuto = delEquipo.filter((p) => p.golesIncompletos);

  /* El calendario manda en cuántos partidos ha jugado el Castilla: si la lista no los tiene todos, se dice. */
  const { partidos: calendario } = useCalendario();
  const jugadosCalendario = useMemo(
    () => (esNuestro && condicion === "todos" ? calendario.map(comoNuestro).filter((u) => u.jugado && u.jornada >= jDesde && u.jornada <= jHasta).length : 0),
    [calendario, esNuestro, condicion, jDesde, jHasta],
  );

  /* Qué jornadas jugadas por el Castilla no están en la lista de goles. */
  const jornadasFaltan = useMemo(() => {
    if (!(esNuestro && condicion === "todos")) return [] as number[];

    const hay = new Set(delEquipo.map((p) => p.jornada));

    return calendario.map(comoNuestro).filter((u) => u.jugado && u.jornada >= jDesde && u.jornada <= jHasta && !hay.has(u.jornada)).map((u) => u.jornada);
  }, [calendario, esNuestro, condicion, jDesde, jHasta, delEquipo]);

  /* La liga, con la misma condición: goles por equipo y partido en cada franja. */
  const ligaPorFranja = useMemo(() => {
    const cuenta = new Map<string, number>();
    let equiposPartido = 0;

    for (const p of liga) {
      equiposPartido += condicion === "todos" ? 2 : 1;

      for (const g of p.goles) {
        if (condicion !== "todos" && g.lado !== condicion) continue;

        const f = franjaDe(lista, g.min, g.extra, g.parte);

        if (f) cuenta.set(f.clave, (cuenta.get(f.clave) ?? 0) + 1);
      }
    }

    return { cuenta, equiposPartido };
  }, [liga, lista, condicion]);

  /* En contra, la liga es el espejo: lo que marca el otro lado. */
  const ligaContraPorFranja = useMemo(() => {
    const cuenta = new Map<string, number>();

    for (const p of liga) {
      for (const g of p.goles) {
        if (condicion !== "todos" && g.lado === condicion) continue;

        const f = franjaDe(lista, g.min, g.extra, g.parte);

        if (f) cuenta.set(f.clave, (cuenta.get(f.clave) ?? 0) + 1);
      }
    }

    return cuenta;
  }, [liga, lista, condicion]);

  const filasFranja = useMemo(
    () =>
      lista.map((franja) => {
        const enFranja = goles.filter((g) => franjaDe(lista, g.min, g.extra, g.parte)?.clave === franja.clave);

        return {
          franja,
          gf: enFranja.filter((g) => g.aFavor).length,
          gc: enFranja.filter((g) => !g.aFavor).length,
          ligaPP: media(ligaPorFranja.cuenta.get(franja.clave) ?? 0, ligaPorFranja.equiposPartido),
          ligaContraPP: media(ligaContraPorFranja.get(franja.clave) ?? 0, ligaPorFranja.equiposPartido),
          partidos: delEquipo.length,
        };
      }),
    [lista, goles, ligaPorFranja, ligaContraPorFranja, delEquipo.length],
  );

  /* Del marcador, no de la lista de goles: un partido al que BeSoccer le quita el
     detalle de algún gol cuenta igual en los totales. */
  const golesDelLado = (p: { gl: number; gv: number }, lado: Lado) => (lado === "local" ? p.gl : p.gv);
  const ligaGolesPP = media(
    liga.reduce((s, p) => s + (condicion === "todos" ? p.gl + p.gv : golesDelLado(p, condicion)), 0),
    ligaPorFranja.equiposPartido,
  );
  const ligaContraPP = media(
    liga.reduce((s, p) => s + (condicion === "todos" ? p.gl + p.gv : golesDelLado(p, condicion === "local" ? "visitante" : "local")), 0),
    ligaPorFranja.equiposPartido,
  );

  const masGoleadora = franjasTop(filasFranja, "gf");
  const masEncajada = franjasTop(filasFranja, "gc");

  /* ---------------- local y visitante ---------------- */
  const condiciones = useMemo(() => {
    const deLado = (lado: Lado, soloEquipo: boolean) => {
      const ps = liga.filter((p) => !soloEquipo || ladoDe(p, equipo) === lado);
      const otro: Lado = lado === "local" ? "visitante" : "local";
      let favor = 0;
      let contra = 0;
      let puntos = 0;
      const wys: RematesWyscout[] = [];
      const wysContra: RematesWyscout[] = [];

      for (const p of ps) {
        const mio = lado === "local" ? p.gl : p.gv;
        const suyo = lado === "local" ? p.gv : p.gl;

        favor += mio;
        contra += suyo;
        puntos += mio > suyo ? 3 : mio === suyo ? 1 : 0;

        if (p.wys?.[lado] && p.wys?.[otro]) {
          wys.push(p.wys[lado]!);
          wysContra.push(p.wys[otro]!);
        }
      }

      const suma = (xs: RematesWyscout[], k: keyof RematesWyscout) => xs.reduce((s, x) => s + (x[k] ?? 0), 0);
      const n = ps.length;
      const nw = wys.length;

      return {
        n,
        nw,
        gf: media(favor, n),
        gc: media(contra, n),
        puntos: media(puntos, n),
        tiros: media(suma(wys, "tiros"), nw),
        aPuerta: media(suma(wys, "aPuerta"), nw),
        xg: media(suma(wys, "xg"), nw),
        tirosContra: media(suma(wysContra, "tiros"), nw),
        xgContra: media(suma(wysContra, "xg"), nw),
        conversion: media(suma(wys, "goles"), suma(wys, "tiros")) * 100,
        precision: media(suma(wys, "aPuerta"), suma(wys, "tiros")) * 100,
        golesMenosXg: media(suma(wys, "goles") - suma(wys, "xg"), nw),
        contraataques: media(suma(wys, "contra"), nw),
        abp: media(suma(wys, "abp"), nw),
      };
    };

    return {
      eqL: deLado("local", true),
      eqV: deLado("visitante", true),
      ligaL: deLado("local", false),
      ligaV: deLado("visitante", false),
    };
  }, [liga, equipo]);

  const filasFranjaLado = useMemo(
    () =>
      lista.map((franja) => {
        const cuenta = (lado: Lado, aFavor: boolean) =>
          golesDe(
            liga.filter((p) => ladoDe(p, equipo) === lado),
            equipo,
          ).filter((g) => g.aFavor === aFavor && franjaDe(lista, g.min, g.extra, g.parte)?.clave === franja.clave).length;

        const ligaLado = (lado: Lado) =>
          media(
            liga.reduce((s, p) => s + p.goles.filter((g) => g.lado === lado && franjaDe(lista, g.min, g.extra, g.parte)?.clave === franja.clave).length, 0),
            liga.length,
          );

        return [franja.nombre, `${cuenta("local", true)} - ${cuenta("local", false)}`, `${cuenta("visitante", true)} - ${cuenta("visitante", false)}`, fmt(ligaLado("local")), fmt(ligaLado("visitante"))];
      }),
    [lista, liga, equipo],
  );

  /* ---------------- tipología ---------------- */
  const tipoDe = (clave: string): TipoGol | null => {
    const m = manual.value[clave];

    if (m) return m as TipoGol;

    return doc.tipologia?.[clave]?.tipo ?? null;
  };

  const tipologia = useMemo(() => {
    const cuenta = { favor: new Map<string, number>(), contra: new Map<string, number>() };
    let sinFavor = 0;
    let sinContra = 0;

    for (const g of goles) {
      if (!(g.clave in (doc.tipologia ?? {})) && !manual.value[g.clave]) continue;

      const t = manual.value[g.clave] || doc.tipologia?.[g.clave]?.tipo;
      const lado = g.aFavor ? cuenta.favor : cuenta.contra;

      if (!t) {
        if (g.aFavor) sinFavor += 1;
        else sinContra += 1;
        continue;
      }

      lado.set(t, (lado.get(t) ?? 0) + 1);
    }

    const totalFavor = [...cuenta.favor.values()].reduce((s, n) => s + n, 0) + sinFavor;
    const totalContra = [...cuenta.contra.values()].reduce((s, n) => s + n, 0) + sinContra;

    return { cuenta, sinFavor, sinContra, totalFavor, totalContra };
  }, [goles, doc.tipologia, manual.value]);

  /* Lo que se sabe de todos: penalti y en propia puerta (BeSoccer). */
  const origenLiga = useMemo(() => {
    const deGoles = (gs: { tipo: string }[]) => ({ n: gs.length, penalti: gs.filter((g) => g.tipo === "penalti").length, propia: gs.filter((g) => g.tipo === "propia").length });

    return {
      favor: deGoles(goles.filter((g) => g.aFavor)),
      contra: deGoles(goles.filter((g) => !g.aFavor)),
      liga: deGoles(liga.flatMap((p) => p.goles)),
    };
  }, [goles, liga]);

  /* ---------------- remates por franja (Hudl) ---------------- */
  const rematesFranja = useMemo(() => {
    if (!esNuestro) return null;

    const ids = delEquipo.map((p) => p.id).filter((id) => doc.remates?.[id]);
    const rs = ids.flatMap((id) => doc.remates[id]);

    if (!ids.length) return null;

    const porFranja = lista.map((franja) => {
      const en = rs.filter((r) => franjaDe(lista, r.min, r.extra, r.parte)?.clave === franja.clave);

      return { franja, nuestros: en.filter((r) => r.nuestro), suyos: en.filter((r) => !r.nuestro) };
    });

    /* La lectura: el tramo en que más remata y en el que más le rematan (sin los descuentos, que duran menos). */
    const normales = porFranja.filter((f) => !f.franja.descuento);
    const masNuestro = [...normales].sort((a, b) => b.nuestros.length - a.nuestros.length)[0];
    const masSuyo = [...normales].sort((a, b) => b.suyos.length - a.suyos.length)[0];
    const nuestros = rs.filter((r) => r.nuestro);
    const suyos = rs.filter((r) => !r.nuestro);
    const lectura =
      masNuestro && masSuyo
        ? `Remata ${fmt(media(nuestros.length, ids.length), 1)} veces por partido y le rematan ${fmt(media(suyos.length, ids.length), 1)}. Donde más remata es en el ${masNuestro.franja.nombre} (${masNuestro.nuestros.length}); donde más le rematan, en el ${masSuyo.franja.nombre} (${masSuyo.suyos.length}). De cada 10 remates suyos van ${Math.round(media(nuestros.filter((r) => r.aPuerta).length, nuestros.length) * 10)} a puerta; de los del rival, ${Math.round(media(suyos.filter((r) => r.aPuerta).length, suyos.length) * 10)}.`
        : "";

    return {
      n: ids.length,
      filas: porFranja.map(({ franja, nuestros: a, suyos: b }) => [franja.nombre, a.length, a.filter((r) => r.aPuerta).length, a.filter((r) => r.gol).length, b.length, b.filter((r) => r.aPuerta).length, b.filter((r) => r.gol).length]),
      total: rs,
      lectura,
    };
  }, [esNuestro, delEquipo, doc.remates, lista]);

  /* ---------------- quién marca primero ---------------- */
  const primero = useMemo(() => {
    const vacio = () => ({ n: 0, G: 0, E: 0, P: 0 });
    const eq = { propio: vacio(), rival: vacio(), nadie: vacio() };
    const lg = { propio: vacio(), rival: vacio(), nadie: vacio() };

    /* Sin el detalle completo no se sabe quién abrió el marcador: esos partidos no entran aquí. */
    for (const p of delEquipo) {
      if (p.golesIncompletos) continue;

      const lado = ladoDe(p, equipo)!;
      const r = primerGol(p, lado);

      eq[r.primero].n += 1;
      eq[r.primero][r.resultado] += 1;
    }

    for (const p of liga) {
      if (p.golesIncompletos) continue;

      for (const lado of ["local", "visitante"] as Lado[]) {
        if (condicion !== "todos" && lado !== condicion) continue;

        const r = primerGol(p, lado);

        lg[r.primero].n += 1;
        lg[r.primero][r.resultado] += 1;
      }
    }

    return { eq, lg };
  }, [delEquipo, liga, equipo, condicion]);

  if (status === "loading" && !todos.length) {
    return (
      <Marco>
        <EsqueletoPantalla titulo="el análisis de goles" />
      </Marco>
    );
  }

  const escudo = (() => {
    const p = todos.find((x) => ladoDe(x, equipo));

    return p ? (ladoDe(p, equipo) === "local" ? p.escudoLocal : p.escudoVisitante) : undefined;
  })();

  const cL = condiciones.eqL;
  const cV = condiciones.eqV;
  const lL = condiciones.ligaL;
  const lV = condiciones.ligaV;

  /* Lo que dicen los números, en frases (`lib/goles/lecturas.ts`). */
  const corto = esNuestro ? "El Castilla" : equipo;
  const enCasa = esNuestro ? "Castilla en casa" : `${nombreEquipo(equipo)} en casa`;
  const fuera = esNuestro ? "Castilla fuera" : `${nombreEquipo(equipo)} fuera`;
  /* Si al equipo le falta un partido jugado, los totales no son comparables con la liga: sin la J6 el Castilla
     "marca menos que la media" cuando con ella marca más. Se quedan sólo las lecturas que no dependen del total. */
  const incompleto = jugadosCalendario > delEquipo.length;
  const deFranjas = lecturaFranjas(filasFranja).filter((f) => !incompleto || !/llegan en la|Marca sobre todo/.test(f));
  const deCondicion = lecturaCondicion(corto, cL, cV, lL, lV);
  const deTipologia = lecturaTipologia(tipologia.cuenta.favor, tipologia.cuenta.contra, tipologia.totalFavor, tipologia.totalContra);
  const dePrimero = incompleto ? [] : lecturaPrimero(primero.eq, primero.lg);
  const aviso = avisoMuestra(delEquipo.length);
  const tramos = tramosClave(filasFranja);
  const importante = loImportante({
    corto,
    partidos: delEquipo.length,
    gf,
    gc,
    ligaGF: ligaGolesPP,
    ligaGC: ligaContraPP,
    filas: filasFranja,
    cL,
    cV,
    lL,
    lV,
    primeroEq: primero.eq,
    primeroLg: primero.lg,
    favor: tipologia.cuenta.favor,
    contra: tipologia.cuenta.contra,
    totalContra: tipologia.totalContra,
    conTipologia: esNuestro,
    incompleto,
  });
  const conLigaContra = condicion !== "todos";

  /* Los goles con tipología (los de nuestros partidos), con la corrección a mano encima de la de Hudl. */
  const conTipo: GolConTipo[] = goles.filter((g) => g.clave in (doc.tipologia ?? {}) || manual.value[g.clave]).map((g) => ({ ...g, tipoFinal: tipoDe(g.clave) }));

  return (
    <Marco>
      <AbpHeader
        area="RMCF Castilla · Análisis"
        title="Análisis de goles"
        // eslint-disable-next-line @next/next/no-img-element
        crest={escudo ? <img src={escudo} alt="" className="h-9 w-9 shrink-0 object-contain" /> : undefined}
        lead={
          <Explicativo>
            Goles de {nombreEquipo(equipo)} y de toda la liga por franjas de minutos, como local y como visitante, con los remates de Wyscout y la tipología de los goles de nuestros
            partidos (Hudl). Jornadas {jDesde} a {jHasta}
            {jUltimaEquipo > 0 && jUltimaEquipo < jHasta ? ` (los datos de ${nombreEquipo(equipo)} llegan hasta la J${jUltimaEquipo})` : ""}
            {doc.actualizado ? ` · actualizado el ${new Date(doc.actualizado).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}` : ""}.
          </Explicativo>
        }
      />

      {/* ---------------- mandos ---------------- */}
      <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Equipo" value={equipo} options={equipos.map((e) => ({ value: e, label: nombreEquipo(e) }))} onChange={(v) => setEquipo(v)} />
        <Select label="Desde la jornada" value={String(jDesde)} options={jornadasJugadas.map((j) => ({ value: String(j), label: `Jornada ${j}` }))} onChange={(v) => setDesde(Number(v))} />
        <Select label="Hasta la jornada" value={String(jHasta)} options={jornadasJugadas.map((j) => ({ value: String(j), label: `Jornada ${j}` }))} onChange={(v) => setHasta(Number(v))} />
        <div className="min-w-0">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Condición</span>
          <Segmented<Condicion>
            ariaLabel="Condición"
            value={condicion}
            onChange={setCondicion}
            options={[
              { key: "todos", label: "Todos" },
              { key: "local", label: "Local" },
              { key: "visitante", label: "Visitante" },
            ]}
          />
        </div>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-end gap-3">
        <div className="min-w-0">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Franjas de</span>
          <Segmented<string>
            ariaLabel="Tamaño de las franjas"
            value={cortes.trim() ? "" : String(tamano)}
            onChange={(v) => {
              setCortes("");
              setTamano(Number(v));
            }}
            options={TAMANOS.map((t) => ({ key: String(t), label: `${t}'` }))}
          />
        </div>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">O a medida (cortes)</span>
          <input
            value={cortes}
            onChange={(e) => setCortes(e.target.value)}
            placeholder="20, 45, 70"
            className="w-40 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70">
          <input type="checkbox" checked={descuentos} onChange={(e) => setDescuentos(e.target.checked)} className="accent-[#C8A96B]" />
          Descuentos aparte
        </label>
      </div>

      {!todos.length ? (
        <div className="mt-6">
          <Notice tone="warn" title="Todavía no hay goles cargados">
            Los sube cada noche la jornada nocturna del ordenador del club (<code>scripts/goles-liga.mjs</code>).
          </Notice>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <Pestanas<Vista>
            etiqueta="Vistas del análisis de goles"
            valor={vista}
            onCambia={setVista}
            opciones={[
              { clave: "resumen", label: "Resumen", icono: LayoutDashboard },
              { clave: "minutos", label: "Minutos", icono: Clock },
              { clave: "casa", label: "Casa y fuera", icono: Home },
              { clave: "tipo", label: "Cómo llegan", icono: Shapes },
              { clave: "goles", label: "Gol a gol", icono: ListOrdered, cuenta: goles.length },
            ]}
          />

          {vista === "resumen" ? (
            <>
          {jugadosCalendario > delEquipo.length ? (
            <Notice
              tone="warn"
              title={`${jornadasFaltan.length ? `Falta ${jornadasFaltan.map((j) => `la J${j}`).join(" y ")}` : "Faltan partidos por cargar"}: ${delEquipo.length} de ${jugadosCalendario} partidos jugados`}
            >
              Los goles a favor y en contra no cuadran con la clasificación, así que no se comparan con la media de la liga ni se dice quién marca primero hasta que llegue{" "}
              {jornadasFaltan.length === 1 ? "ese partido" : "esos partidos"}.
            </Notice>
          ) : null}

          <StatRow>
            <StatCard label="Partidos" value={jugadosCalendario > delEquipo.length ? `${delEquipo.length} de ${jugadosCalendario}` : delEquipo.length} hint={jugadosCalendario > delEquipo.length ? (jornadasFaltan.length ? `falta la ${jornadasFaltan.map((j) => `J${j}`).join(", ")}` : "faltan partidos por cargar") : condicion === "todos" ? "local y visitante" : condicion} />
            <StatCard label="Goles a favor" value={gf} hint={`${fmt(media(gf, delEquipo.length))} por partido${incompleto ? "" : ` · liga ${fmt(ligaGolesPP)}`}`} accent={ORO} />
            <StatCard label="Goles en contra" value={gc} hint={`${fmt(media(gc, delEquipo.length))} por partido${incompleto ? "" : ` · liga ${fmt(ligaContraPP)}`}`} accent={PEOR} />
            <StatCard
              label="Su mejor tramo"
              value={tramos.fuerte ? tramos.fuerte.franja.nombre : "—"}
              hint={tramos.fuerte ? `${tramos.fuerte.gf} a favor${tramos.fuerte.gf <= 3 ? " · tendencia" : ""}${incompleto ? "" : ` · ${fmt(media(tramos.fuerte.gf, delEquipo.length))}/partido (liga ${fmt(tramos.fuerte.ligaPP)})`}` : masGoleadora ? `ninguno por encima de la liga` : "sin goles a favor"}
              accent={tramos.fuerte ? MEJOR : undefined}
            />
            <StatCard
              label="Su tramo más débil"
              value={tramos.flojo ? tramos.flojo.franja.nombre : "—"}
              hint={tramos.flojo ? `${tramos.flojo.gc} en contra${tramos.flojo.gc <= 3 ? " · tendencia" : ""}${incompleto ? "" : ` · ${fmt(media(tramos.flojo.gc, delEquipo.length))}/partido (liga ${fmt(tramos.flojo.ligaContraPP)})`}` : masEncajada ? "ninguno por encima de la liga" : "sin goles en contra"}
              accent={tramos.flojo ? PEOR : undefined}
            />
          </StatRow>

          {/* ---------------- lo importante ---------------- */}
          {importante.length > 0 ? (
          <Panel title="Lo importante"subtitle={`${nombreEquipo(equipo)} · ${jugadosCalendario > delEquipo.length ? `${delEquipo.length} de ${jugadosCalendario} partidos jugados` : `${delEquipo.length} ${delEquipo.length === 1 ? "partido" : "partidos"}`}${jUltimaEquipo > 0 ? `, hasta la J${jUltimaEquipo}` : ""}${condicion === "todos" ? "" : ` · sólo de ${condicion}`}.${incompleto ? "" : " Siempre comparado con la media de la liga."}${sinMinuto.length ? ` En ${sinMinuto.length === 1 ? "un partido" : `${sinMinuto.length} partidos`} falta el minuto de algún gol: cuenta en los totales y no en las franjas.` : ""}`} icon={Lightbulb}>
            <ul className="space-y-2.5">
              {importante.map((frase, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-white/80">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8A96B]" aria-hidden />
                  <span>
                    {frase.texto}
                    <span className="mt-0.5 block text-[12px] font-medium" style={{ color: "var(--rmcf-gold-ink)" }}>
                      {frase.accion}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {aviso ? <p className="mt-3 text-[11px] text-white/40">{aviso}</p> : null}
          </Panel>
          ) : null}

          {/* ---------------- marcar primero ---------------- */}
          {incompleto ? null : (
          <Panel
            title="¿Qué pasa cuando marca primero?"
            subtitle="Cómo acaban los partidos según quién abre el marcador, frente a la liga con la misma condición."
            icon={Trophy}
            analisis={dePrimero.length ? <div className="px-4 pb-4 sm:px-5"><Lectura>{dePrimero.join(" ")}</Lectura></div> : undefined}
          >
            <Tabla
              cabeza={["", "Partidos", "Ganados", "Empatados", "Perdidos", "Puntos / partido", "Liga: puntos / partido"]}
              filas={(["propio", "rival", "nadie"] as const).map((k) => {
                const e = primero.eq[k];
                const l = primero.lg[k];

                return [
                  k === "propio" ? "Marca primero" : k === "rival" ? "Recibe primero" : "Nadie marca (0-0)",
                  e.n,
                  e.G,
                  e.E,
                  e.P,
                  <Contra key={k} valor={media(e.G * 3 + e.E, e.n)} liga={media(l.G * 3 + l.E, l.n)} mejorAlto n={e.n} />,
                  fmt(media(l.G * 3 + l.E, l.n)),
                ];
              })}
            />
          </Panel>
          )}
            </>
          ) : null}

          {vista === "minutos" ? (
            <>
          {/* ---------------- franjas ---------------- */}
          <Panel
            title="¿En qué minutos marca y en cuáles le marcan?"
            subtitle="Arriba los goles a favor, abajo los en contra. La raya es lo que marca (o encaja) un equipo medio de la liga en ese tramo."
            icon={Clock}
            analisis={deFranjas.length ? <div className="px-4 pb-4 sm:px-5"><Lectura>{deFranjas.join(" ")}</Lectura></div> : undefined}
          >
            <GraficaFranjas filas={filasFranja} />

            <details className="mt-5">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45 hover:text-white/70">Ver la tabla</summary>
              <div className="mt-3">
                <Tabla
                  cabeza={conLigaContra ? ["Franja", "A favor", "En contra", "Balance", "A favor / partido", "Liga", "En contra / partido", "Liga"] : ["Franja", "A favor", "En contra", "Balance", "A favor / partido", "En contra / partido", "Media liga / partido"]}
                  filas={filasFranja.map((f) => [
                    f.franja.nombre,
                    f.gf,
                    f.gc,
                    f.gf - f.gc > 0 ? `+${f.gf - f.gc}` : f.gf - f.gc,
                    <Contra key="a" valor={media(f.gf, f.partidos)} liga={f.ligaPP} mejorAlto />,
                    ...(conLigaContra
                      ? [fmt(f.ligaPP), <Contra key="b" valor={media(f.gc, f.partidos)} liga={f.ligaContraPP} mejorAlto={false} />, fmt(f.ligaContraPP)]
                      : [<Contra key="b" valor={media(f.gc, f.partidos)} liga={f.ligaContraPP} mejorAlto={false} />, fmt(f.ligaPP)]),
                  ])}
                  pie={
                    conLigaContra
                      ? ["Total", gf, gc, gf - gc > 0 ? `+${gf - gc}` : gf - gc, fmt(media(gf, delEquipo.length)), fmt(ligaGolesPP), fmt(media(gc, delEquipo.length)), fmt(ligaContraPP)]
                      : ["Total", gf, gc, gf - gc > 0 ? `+${gf - gc}` : gf - gc, fmt(media(gf, delEquipo.length)), fmt(media(gc, delEquipo.length)), fmt(ligaGolesPP)]
                  }
                />
              </div>
            </details>
          </Panel>

          {/* ---------------- remates por franja ---------------- */}
          {rematesFranja ? (
            <Panel
              title="¿Cuándo remata y cuándo le rematan?"
              subtitle={explicativos ? `Del timeline de Hudl de ${rematesFranja.n} de nuestros partidos (Wyscout no da el minuto de los remates).` : `En ${rematesFranja.n} de nuestros partidos.`}
              icon={Crosshair}
              analisis={rematesFranja.lectura ? <div className="px-4 pb-4 sm:px-5"><Lectura>{rematesFranja.lectura}</Lectura></div> : undefined}
            >
              <Tabla
                cabeza={["Franja", "Remates nuestros", "A puerta", "Gol", "Remates del rival", "A puerta", "Gol"]}
                filas={rematesFranja.filas}
                pie={[
                  "Total",
                  rematesFranja.total.filter((r) => r.nuestro).length,
                  rematesFranja.total.filter((r) => r.nuestro && r.aPuerta).length,
                  rematesFranja.total.filter((r) => r.nuestro && r.gol).length,
                  rematesFranja.total.filter((r) => !r.nuestro).length,
                  rematesFranja.total.filter((r) => !r.nuestro && r.aPuerta).length,
                  rematesFranja.total.filter((r) => !r.nuestro && r.gol).length,
                ]}
              />
            </Panel>
          ) : null}
            </>
          ) : null}

          {vista === "casa" ? (
            <>
          {/* ---------------- local y visitante ---------------- */}
          <Panel
            title="¿Rinde igual en casa que fuera?"
            subtitle={`Por partido. ▲ mejor y ▼ peor que la liga en la misma condición.${explicativos ? ` Remates y xG de Wyscout: ${cL.nw + cV.nw} de ${cL.n + cV.n} partidos; el umbral es un 10 %.` : ""}`}
            icon={Home}
            analisis={deCondicion.length ? <div className="px-4 pb-4 sm:px-5"><Lectura>{deCondicion.join(" ")}</Lectura></div> : undefined}
          >
            <Tabla
              cabeza={["Por partido", enCasa, "Liga en casa", fuera, "Liga fuera"]}
              filas={[
                { seccion: "Resultado" },
                ["Partidos jugados", cL.n, "", cV.n, ""],
                ["Puntos", <Contra key="1" valor={cL.puntos} liga={lL.puntos} mejorAlto />, fmt(lL.puntos), <Contra key="2" valor={cV.puntos} liga={lV.puntos} mejorAlto />, fmt(lV.puntos)],
                ["Goles a favor", <Contra key="3" valor={cL.gf} liga={lL.gf} mejorAlto />, fmt(lL.gf), <Contra key="4" valor={cV.gf} liga={lV.gf} mejorAlto />, fmt(lV.gf)],
                ["Goles en contra", <Contra key="5" valor={cL.gc} liga={lL.gc} mejorAlto={false} />, fmt(lL.gc), <Contra key="6" valor={cV.gc} liga={lV.gc} mejorAlto={false} />, fmt(lV.gc)],
                { seccion: "Ataque: cuánto genera y cuánto acierta" },
                ["Remates", <Contra key="7" valor={cL.tiros} liga={lL.tiros} mejorAlto dec={1} />, fmt(lL.tiros, 1), <Contra key="8" valor={cV.tiros} liga={lV.tiros} mejorAlto dec={1} />, fmt(lV.tiros, 1)],
                ["Remates a puerta", <Contra key="9" valor={cL.aPuerta} liga={lL.aPuerta} mejorAlto dec={1} />, fmt(lL.aPuerta, 1), <Contra key="10" valor={cV.aPuerta} liga={lV.aPuerta} mejorAlto dec={1} />, fmt(lV.aPuerta, 1)],
                ["% de remates a puerta", <Contra key="17" valor={cL.precision} liga={lL.precision} mejorAlto dec={0} sufijo=" %" />, `${fmt(lL.precision, 0)} %`, <Contra key="18" valor={cV.precision} liga={lV.precision} mejorAlto dec={0} sufijo=" %" />, `${fmt(lV.precision, 0)} %`],
                ["% de remates que son gol", <Contra key="15" valor={cL.conversion} liga={lL.conversion} mejorAlto dec={0} sufijo=" %" />, `${fmt(lL.conversion, 0)} %`, <Contra key="16" valor={cV.conversion} liga={lV.conversion} mejorAlto dec={0} sufijo=" %" />, `${fmt(lV.conversion, 0)} %`],
                ["Goles esperados (xG)", <Contra key="11" valor={cL.xg} liga={lL.xg} mejorAlto />, fmt(lL.xg), <Contra key="12" valor={cV.xg} liga={lV.xg} mejorAlto />, fmt(lV.xg)],
                ["Goles por encima (+) o por debajo (−) del xG", <Contra key="13" valor={cL.golesMenosXg} liga={lL.golesMenosXg} mejorAlto />, fmt(lL.golesMenosXg), <Contra key="14" valor={cV.golesMenosXg} liga={lV.golesMenosXg} mejorAlto />, fmt(lV.golesMenosXg)],
                ["Balón parado que acaba en remate", <Contra key="21" valor={cL.abp} liga={lL.abp} mejorAlto dec={1} />, fmt(lL.abp, 1), <Contra key="22" valor={cV.abp} liga={lV.abp} mejorAlto dec={1} />, fmt(lV.abp, 1)],
                { seccion: "Defensa: lo que concede" },
                ["Remates en contra", <Contra key="23" valor={cL.tirosContra} liga={lL.tirosContra} mejorAlto={false} dec={1} />, fmt(lL.tirosContra, 1), <Contra key="24" valor={cV.tirosContra} liga={lV.tirosContra} mejorAlto={false} dec={1} />, fmt(lV.tirosContra, 1)],
                ["xG en contra", <Contra key="25" valor={cL.xgContra} liga={lL.xgContra} mejorAlto={false} />, fmt(lL.xgContra), <Contra key="26" valor={cV.xgContra} liga={lV.xgContra} mejorAlto={false} />, fmt(lV.xgContra)],
              ]}
            />

            <details className="mt-5">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45 hover:text-white/70">Goles por franja en casa y fuera</summary>
              <div className="mt-3">
                <Tabla cabeza={["Franja", "En casa (favor - contra)", "Fuera (favor - contra)", "Liga: goles del local / partido", "Liga: goles del visitante / partido"]} filas={filasFranjaLado} />
              </div>
            </details>
          </Panel>
            </>
          ) : null}

          {vista === "tipo" ? (
            <>
          {/* ---------------- tipología ---------------- */}
          <Panel
            title="¿Cómo llegan los goles?"
            subtitle={
              esNuestro
                ? explicativos
                  ? "De nuestros partidos, con el timeline de Hudl y las grabaciones tácticas. Es una propuesta: cada gol se corrige en Gol a gol."
                  : "Cada gol se puede cambiar en Gol a gol."
                : "Sólo los goles de sus partidos contra nosotros. Del resto de la liga se sabe si fue de penalti o en propia puerta."
            }
            icon={Shapes}
            analisis={esNuestro && deTipologia.length ? <div className="px-4 pb-4 sm:px-5"><Lectura>{deTipologia.join(" ")}</Lectura></div> : undefined}
            action={<SaveState status={manual.status} localOnly={manual.localOnly} savedAt={manual.lastSavedAt} sinGuardar={manual.sinGuardar} onGuardar={() => void manual.guardaYa()} />}
          >
            {conTipo.length ? (
              <GraficasTipologia goles={conTipo} colorFavor={ORO} colorContra={PEOR} />
            ) : (
              <p className="text-sm text-white/45">Ningún gol de este equipo tiene tipología en este tramo (sólo se clasifican los de los partidos contra nosotros).</p>
            )}

            <details className="mt-6">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45 hover:text-white/70">Ver la tabla y lo que se sabe del resto de la liga</summary>
            <div className="mt-3 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
              <div className="min-w-0 overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
                      <th className="px-3 py-2 text-left font-medium">Cómo llega el gol</th>
                      <th className="px-3 py-2 text-left font-medium" style={{ color: ORO }}>
                        A favor ({tipologia.totalFavor})
                      </th>
                      <th className="px-3 py-2 text-left font-medium" style={{ color: PEOR }}>
                        En contra ({tipologia.totalContra})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {FASES.map((fase) => {
                      const sumaFase = (m: Map<string, number>) => fase.tipos.reduce((s, t) => s + (m.get(t.clave) ?? 0), 0);
                      const ff = sumaFase(tipologia.cuenta.favor);
                      const fc = sumaFase(tipologia.cuenta.contra);
                      const maximo = Math.max(1, tipologia.totalFavor, tipologia.totalContra);

                      return [
                        <tr key={fase.fase} className="bg-white/[0.05] text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                          <td className="px-3 py-1.5">{fase.fase}</td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {ff} <span className="font-normal text-white/45">· {pct(ff, tipologia.totalFavor)}</span>
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {fc} <span className="font-normal text-white/45">· {pct(fc, tipologia.totalContra)}</span>
                          </td>
                        </tr>,
                        ...fase.tipos.map((t) => {
                          const a = tipologia.cuenta.favor.get(t.clave) ?? 0;
                          const b = tipologia.cuenta.contra.get(t.clave) ?? 0;
                          const celda = (n: number, color: string) => (
                            <td className="px-3 py-1.5">
                              <span className="flex items-center gap-2">
                                <span className="h-2 rounded-full" style={{ width: `${(n / maximo) * 100}%`, maxWidth: 120, minWidth: n ? 6 : 0, backgroundColor: color }} />
                                <span className="tabular-nums" style={{ color: n ? undefined : tinta(0.25) }}>
                                  {n || "·"}
                                </span>
                              </span>
                            </td>
                          );

                          return (
                            <tr key={t.clave} className="border-b border-white/[0.06]">
                              <td className={`px-3 py-1.5 pl-5 ${a || b ? "text-white/80" : "text-white/35"}`}>{t.nombre}</td>
                              {celda(a, ORO)}
                              {celda(b, PEOR)}
                            </tr>
                          );
                        }),
                      ];
                    })}
                    {tipologia.sinFavor + tipologia.sinContra > 0 ? (
                      <tr className="text-white/45">
                        <td className="px-3 py-1.5">Sin clasificar (elígelo abajo)</td>
                        <td className="px-3 py-1.5 tabular-nums">{tipologia.sinFavor}</td>
                        <td className="px-3 py-1.5 tabular-nums">{tipologia.sinContra}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="min-w-0 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Penaltis y goles en propia puerta: toda la liga</p>
                <Tabla
                  cabeza={["", "Penalti", "Propia puerta", "Resto"]}
                  filas={[
                    [`${equipo.split(" ").slice(-1)[0]} a favor`, pct(origenLiga.favor.penalti, origenLiga.favor.n), pct(origenLiga.favor.propia, origenLiga.favor.n), pct(origenLiga.favor.n - origenLiga.favor.penalti - origenLiga.favor.propia, origenLiga.favor.n)],
                    [`${equipo.split(" ").slice(-1)[0]} en contra`, pct(origenLiga.contra.penalti, origenLiga.contra.n), pct(origenLiga.contra.propia, origenLiga.contra.n), pct(origenLiga.contra.n - origenLiga.contra.penalti - origenLiga.contra.propia, origenLiga.contra.n)],
                    ["Liga", pct(origenLiga.liga.penalti, origenLiga.liga.n), pct(origenLiga.liga.propia, origenLiga.liga.n), pct(origenLiga.liga.n - origenLiga.liga.penalti - origenLiga.liga.propia, origenLiga.liga.n)],
                  ]}
                />
                {explicativos && doc.sinTimeline?.length ? (
                  <p className="text-[11px] leading-relaxed text-white/40">
                    Sin timeline de Hudl (no se pueden clasificar solos): {doc.sinTimeline.join(" · ")}. Se clasifican a mano en la lista.
                  </p>
                ) : null}
              </div>
            </div>
            </details>
          </Panel>
            </>
          ) : null}

          {vista === "goles" ? (
            <>
          {/* ---------------- lista ---------------- */}
          <Panel title="Gol a gol" subtitle={esNuestro ? "La tipología de cada gol se puede cambiar." : "Los de sus partidos contra nosotros llevan tipología."} icon={ListOrdered} bodyClassName="p-0">
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
                    <th className="px-3 py-2 text-left font-medium">J.</th>
                    <th className="px-3 py-2 text-left font-medium">Partido</th>
                    <th className="px-3 py-2 text-right font-medium">Min.</th>
                    <th className="px-3 py-2 text-center font-medium">Marcador</th>
                    <th className="px-3 py-2 text-left font-medium">Autor</th>
                    <th className="px-3 py-2 text-left font-medium">Tipología</th>
                  </tr>
                </thead>
                <tbody>
                  {goles.map((g) => {
                    const lado = ladoDe(g.partido, equipo)!;
                    const info = doc.tipologia?.[g.clave];
                    const t = tipoDe(g.clave);
                    const elegido = manual.value[g.clave];

                    return (
                      <tr key={g.clave} className="border-b border-white/[0.06] align-top last:border-0">
                        <td className="px-3 py-2 tabular-nums text-white/50">{g.partido.jornada}</td>
                        <td className="px-3 py-2 text-white/75">
                          <span className="block truncate">
                            {g.partido.local} {g.partido.gl}-{g.partido.gv} {g.partido.visitante}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-white/80">{rotuloMinuto(g)}</td>
                        <td className="px-3 py-2 text-center tabular-nums">
                          <span className="inline-flex items-center gap-1.5" style={{ color: g.aFavor ? ORO : PEOR }}>
                            <Goal size={12} aria-hidden /> {marcadorTras(g.partido, g.indice, lado)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-white/80">
                          {g.jugador || "—"}
                          {g.tipo ? <span className="ml-1.5 text-[11px] text-white/40">({g.tipo === "penalti" ? "penalti" : "en propia"})</span> : null}
                          {g.asistente ? <span className="block text-[11px] text-white/40">Asiste {g.asistente}</span> : null}
                        </td>
                        <td className="px-3 py-2">
                          {info ? (
                            <div className="min-w-0 max-w-[340px]">
                              <select
                                value={elegido ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value as TipoGol | "";

                                  manual.setValue((actual) => {
                                    const siguiente = { ...actual };

                                    if (v) siguiente[g.clave] = v;
                                    else delete siguiente[g.clave];

                                    return siguiente;
                                  });
                                }}
                                className={`w-full rounded-lg border bg-white/[0.04] px-2 py-1 text-xs text-white outline-none focus:border-[#C8A96B]/50 ${elegido ? "border-[#C8A96B]/50" : "border-white/10"}`}
                              >
                                <option value="" className="bg-[#11161C]">
                                  {info.tipo ? NOMBRE_TIPO[info.tipo] : "Sin clasificar"}
                                </option>
                                {FASES.map((f) => (
                                  <optgroup key={f.fase} label={f.fase} className="bg-[#11161C]">
                                    {f.tipos.map((x) => (
                                      <option key={x.clave} value={x.clave} className="bg-[#11161C]">
                                        {x.nombre}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              {explicativos || !esMetodo(info.motivo) ? (
                                <p className="mt-1 text-[11px] leading-snug text-white/40">
                                  {explicativos && elegido ? `Elegido a mano${t !== info.tipo && info.tipo ? ` (Hudl decía ${NOMBRE_TIPO[info.tipo]})` : ""}. ` : ""}
                                  {info.motivo}
                                </p>
                              ) : null}
                              <Explicativo>{info.texto ? <p className="mt-0.5 text-[11px] leading-snug text-white/35">Táctica: {info.texto}</p> : null}</Explicativo>
                            </div>
                          ) : (
                            <span className="text-[11px] text-white/30">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!goles.length ? <p className="px-4 py-6 text-center text-sm text-white/40">Sin goles en este tramo.</p> : null}
            </div>
          </Panel>
            </>
          ) : null}

        </div>
      )}
    </Marco>
  );
}

function Marco({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">{children}</div>
        </section>
      </div>
    </main>
  );
}
