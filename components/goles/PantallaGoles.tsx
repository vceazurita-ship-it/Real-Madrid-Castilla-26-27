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
import { Clock, Crosshair, Goal, Home, ListOrdered, Shapes, Trophy } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { EsqueletoPantalla } from "@/components/ui/estados";
import { AbpHeader, Notice, Panel, SaveState, Segmented, Select, StatCard, StatRow } from "@/components/abp/ui";
import { ORO, PEOR, tinta } from "@/components/data/graficas";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
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

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)} %` : "—");

/* ------------------------------------------------------------------ */
/*  Piezas                                                             */
/* ------------------------------------------------------------------ */

/** Dos barras por franja (a favor y en contra, por partido) y la media de la liga como raya. */
function GraficaFranjas({
  filas,
}: {
  filas: { franja: Franja; gf: number; gc: number; ligaPP: number; partidos: number }[];
}) {
  const max = Math.max(0.01, ...filas.flatMap((f) => [media(f.gf, f.partidos), media(f.gc, f.partidos), f.ligaPP]));

  return (
    <div className="min-w-0">
      <div className="flex h-48 items-end gap-1.5 sm:gap-3">
        {filas.map(({ franja, gf, gc, ligaPP, partidos }) => {
          const alto = (v: number) => `${Math.max(0, (v / max) * 100)}%`;

          return (
            <div key={franja.clave} className="relative flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 sm:gap-1">
              <div
                className="w-1/2 max-w-[22px] rounded-t transition-[height] duration-500"
                style={{ height: alto(media(gf, partidos)), backgroundColor: ORO }}
                title={`${franja.nombre} · a favor: ${gf} (${fmt(media(gf, partidos))} por partido)`}
              />
              <div
                className="w-1/2 max-w-[22px] rounded-t transition-[height] duration-500"
                style={{ height: alto(media(gc, partidos)), backgroundColor: PEOR }}
                title={`${franja.nombre} · en contra: ${gc} (${fmt(media(gc, partidos))} por partido)`}
              />
              <div
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed"
                style={{ bottom: alto(ligaPP), borderColor: tinta(0.55) }}
                title={`Media de la liga: ${fmt(ligaPP)} goles por equipo y partido`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5 sm:gap-3">
        {filas.map(({ franja }) => (
          <span key={franja.clave} className={`min-w-0 flex-1 truncate text-center text-[10px] tabular-nums ${franja.descuento ? "text-[#C8A96B]" : "text-white/45"}`}>
            {franja.nombre}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ORO }} /> A favor (por partido)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PEOR }} /> En contra (por partido)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed" style={{ borderColor: tinta(0.55) }} /> Media de la liga por equipo
        </span>
      </div>
    </div>
  );
}

function Tabla({ cabeza, filas, pie }: { cabeza: string[]; filas: ReactNode[][]; pie?: ReactNode[] }) {
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
          {filas.map((fila, i) => (
            <tr key={i} className="border-b border-white/[0.06] last:border-0">
              {fila.map((celda, j) => (
                <td key={j} className={`px-3 py-1.5 tabular-nums ${j === 0 ? "text-left text-white/75" : "text-right text-white/85"}`}>
                  {celda}
                </td>
              ))}
            </tr>
          ))}
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

/** Un valor del equipo frente a la liga: verde si es mejor, naranja si es peor. */
function Contra({ valor, liga, mejorAlto, dec = 2, sufijo = "" }: { valor: number; liga: number; mejorAlto: boolean; dec?: number; sufijo?: string }) {
  const mejor = mejorAlto ? valor > liga * 1.05 : valor < liga * 0.95;
  const peor = mejorAlto ? valor < liga * 0.95 : valor > liga * 1.05;

  return (
    <span style={{ color: mejor ? "#1B9E77" : peor ? PEOR : undefined }}>
      {fmt(valor, dec)}
      {sufijo}
    </span>
  );
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

  const equipo = equipoElegido ?? nuestroNombre;
  const esNuestro = mismoEquipo(equipo, CASTILLA);
  const jDesde = desde ?? jornadas[0] ?? 1;
  const jHasta = hasta ?? ultima;

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

  const goles = useMemo(() => golesDe(delEquipo, equipo), [delEquipo, equipo]);
  const gf = goles.filter((g) => g.aFavor).length;
  const gc = goles.length - gf;

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

  const ligaGolesPP = media(
    liga.reduce((s, p) => s + p.goles.filter((g) => condicion === "todos" || g.lado === condicion).length, 0),
    ligaPorFranja.equiposPartido,
  );
  const ligaContraPP = media(
    liga.reduce((s, p) => s + p.goles.filter((g) => condicion === "todos" || g.lado !== condicion).length, 0),
    ligaPorFranja.equiposPartido,
  );

  const masGoleadora = [...filasFranja].sort((a, b) => b.gf - a.gf)[0];
  const masEncajada = [...filasFranja].sort((a, b) => b.gc - a.gc)[0];

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

    return {
      n: ids.length,
      filas: lista.map((franja) => {
        const en = rs.filter((r) => franjaDe(lista, r.min, r.extra, r.parte)?.clave === franja.clave);
        const nuestros = en.filter((r) => r.nuestro);
        const suyos = en.filter((r) => !r.nuestro);

        return [franja.nombre, nuestros.length, nuestros.filter((r) => r.aPuerta).length, nuestros.filter((r) => r.gol).length, suyos.length, suyos.filter((r) => r.aPuerta).length, suyos.filter((r) => r.gol).length];
      }),
      total: rs,
    };
  }, [esNuestro, delEquipo, doc.remates, lista]);

  /* ---------------- quién marca primero ---------------- */
  const primero = useMemo(() => {
    const vacio = () => ({ n: 0, G: 0, E: 0, P: 0 });
    const eq = { propio: vacio(), rival: vacio(), nadie: vacio() };
    const lg = { propio: vacio(), rival: vacio(), nadie: vacio() };

    for (const p of delEquipo) {
      const lado = ladoDe(p, equipo)!;
      const r = primerGol(p, lado);

      eq[r.primero].n += 1;
      eq[r.primero][r.resultado] += 1;
    }

    for (const p of liga) {
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

  return (
    <Marco>
      <AbpHeader
        area="RMCF Castilla · Análisis"
        title="Análisis de goles"
        // eslint-disable-next-line @next/next/no-img-element
        crest={escudo ? <img src={escudo} alt="" className="h-9 w-9 shrink-0 object-contain" /> : undefined}
        lead={
          <>
            Goles de {equipo} y de toda la liga por franjas de minutos, como local y como visitante, con los remates de Wyscout y la tipología de los goles de nuestros
            partidos (Hudl). Jornadas {jDesde} a {jHasta}
            {doc.actualizado ? ` · actualizado el ${new Date(doc.actualizado).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}` : ""}.
          </>
        }
      />

      {/* ---------------- mandos ---------------- */}
      <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Equipo" value={equipo} options={equipos} onChange={(v) => setEquipo(v)} />
        <Select label="Desde la jornada" value={String(jDesde)} options={jornadas.map((j) => ({ value: String(j), label: `Jornada ${j}` }))} onChange={(v) => setDesde(Number(v))} />
        <Select label="Hasta la jornada" value={String(jHasta)} options={jornadas.map((j) => ({ value: String(j), label: `Jornada ${j}` }))} onChange={(v) => setHasta(Number(v))} />
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
          <StatRow>
            <StatCard label="Partidos" value={delEquipo.length} hint={condicion === "todos" ? "local y visitante" : condicion} />
            <StatCard label="Goles a favor" value={gf} hint={`${fmt(media(gf, delEquipo.length))} por partido · liga ${fmt(ligaGolesPP)}`} accent={ORO} />
            <StatCard label="Goles en contra" value={gc} hint={`${fmt(media(gc, delEquipo.length))} por partido · liga ${fmt(ligaContraPP)}`} accent={PEOR} />
            <StatCard label="Franja en que más marca" value={masGoleadora?.gf ? masGoleadora.franja.nombre : "—"} hint={masGoleadora?.gf ? `${masGoleadora.gf} goles` : undefined} />
            <StatCard label="Franja en que más encaja" value={masEncajada?.gc ? masEncajada.franja.nombre : "—"} hint={masEncajada?.gc ? `${masEncajada.gc} goles` : undefined} />
          </StatRow>

          {/* ---------------- franjas ---------------- */}
          <Panel title="Goles por franja de minutos" subtitle="Por partido, para comparar con la liga aunque se hayan jugado partidos distintos. La raya es la media de un equipo de la liga." icon={Clock}>
            <GraficaFranjas filas={filasFranja} />

            <div className="mt-5">
              <Tabla
                cabeza={["Franja", "A favor", "En contra", "Dif.", "A favor / partido", "Liga", "En contra / partido", "Liga"]}
                filas={filasFranja.map((f) => [
                  f.franja.nombre,
                  f.gf,
                  f.gc,
                  f.gf - f.gc > 0 ? `+${f.gf - f.gc}` : f.gf - f.gc,
                  <Contra key="a" valor={media(f.gf, f.partidos)} liga={f.ligaPP} mejorAlto />,
                  fmt(f.ligaPP),
                  <Contra key="b" valor={media(f.gc, f.partidos)} liga={f.ligaContraPP} mejorAlto={false} />,
                  fmt(f.ligaContraPP),
                ])}
                pie={["Total", gf, gc, gf - gc > 0 ? `+${gf - gc}` : gf - gc, fmt(media(gf, delEquipo.length)), fmt(ligaGolesPP), fmt(media(gc, delEquipo.length)), fmt(ligaContraPP)]}
              />
            </div>
          </Panel>

          {/* ---------------- local y visitante ---------------- */}
          <Panel
            title="Local y visitante"
            subtitle={`Por partido. Goles y puntos de BeSoccer; remates y xG de Wyscout (${cL.nw + cV.nw} de ${cL.n + cV.n} partidos del equipo descargados). Verde: mejor que la liga en esa condición.`}
            icon={Home}
          >
            <Tabla
              cabeza={["Por partido", `${equipo.split(" ").slice(-1)[0]} local`, "Liga local", `${equipo.split(" ").slice(-1)[0]} visitante`, "Liga visitante"]}
              filas={[
                ["Partidos", cL.n, lL.n, cV.n, lV.n],
                ["Puntos", <Contra key="1" valor={cL.puntos} liga={lL.puntos} mejorAlto />, fmt(lL.puntos), <Contra key="2" valor={cV.puntos} liga={lV.puntos} mejorAlto />, fmt(lV.puntos)],
                ["Goles a favor", <Contra key="3" valor={cL.gf} liga={lL.gf} mejorAlto />, fmt(lL.gf), <Contra key="4" valor={cV.gf} liga={lV.gf} mejorAlto />, fmt(lV.gf)],
                ["Goles en contra", <Contra key="5" valor={cL.gc} liga={lL.gc} mejorAlto={false} />, fmt(lL.gc), <Contra key="6" valor={cV.gc} liga={lV.gc} mejorAlto={false} />, fmt(lV.gc)],
                ["Remates", <Contra key="7" valor={cL.tiros} liga={lL.tiros} mejorAlto dec={1} />, fmt(lL.tiros, 1), <Contra key="8" valor={cV.tiros} liga={lV.tiros} mejorAlto dec={1} />, fmt(lV.tiros, 1)],
                ["Remates a puerta", <Contra key="9" valor={cL.aPuerta} liga={lL.aPuerta} mejorAlto dec={1} />, fmt(lL.aPuerta, 1), <Contra key="10" valor={cV.aPuerta} liga={lV.aPuerta} mejorAlto dec={1} />, fmt(lV.aPuerta, 1)],
                ["xG", <Contra key="11" valor={cL.xg} liga={lL.xg} mejorAlto />, fmt(lL.xg), <Contra key="12" valor={cV.xg} liga={lV.xg} mejorAlto />, fmt(lV.xg)],
                ["Goles − xG", <Contra key="13" valor={cL.golesMenosXg} liga={lL.golesMenosXg} mejorAlto />, fmt(lL.golesMenosXg), <Contra key="14" valor={cV.golesMenosXg} liga={lV.golesMenosXg} mejorAlto />, fmt(lV.golesMenosXg)],
                ["Conversión (gol / remate)", <Contra key="15" valor={cL.conversion} liga={lL.conversion} mejorAlto dec={1} sufijo=" %" />, `${fmt(lL.conversion, 1)} %`, <Contra key="16" valor={cV.conversion} liga={lV.conversion} mejorAlto dec={1} sufijo=" %" />, `${fmt(lV.conversion, 1)} %`],
                ["Precisión (a puerta / remate)", <Contra key="17" valor={cL.precision} liga={lL.precision} mejorAlto dec={1} sufijo=" %" />, `${fmt(lL.precision, 1)} %`, <Contra key="18" valor={cV.precision} liga={lV.precision} mejorAlto dec={1} sufijo=" %" />, `${fmt(lV.precision, 1)} %`],
                ["Contraataques con remate", <Contra key="19" valor={cL.contraataques} liga={lL.contraataques} mejorAlto dec={1} />, fmt(lL.contraataques, 1), <Contra key="20" valor={cV.contraataques} liga={lV.contraataques} mejorAlto dec={1} />, fmt(lV.contraataques, 1)],
                ["Balón parado con remate", <Contra key="21" valor={cL.abp} liga={lL.abp} mejorAlto dec={1} />, fmt(lL.abp, 1), <Contra key="22" valor={cV.abp} liga={lV.abp} mejorAlto dec={1} />, fmt(lV.abp, 1)],
                ["Remates en contra", <Contra key="23" valor={cL.tirosContra} liga={lL.tirosContra} mejorAlto={false} dec={1} />, fmt(lL.tirosContra, 1), <Contra key="24" valor={cV.tirosContra} liga={lV.tirosContra} mejorAlto={false} dec={1} />, fmt(lV.tirosContra, 1)],
                ["xG en contra", <Contra key="25" valor={cL.xgContra} liga={lL.xgContra} mejorAlto={false} />, fmt(lL.xgContra), <Contra key="26" valor={cV.xgContra} liga={lV.xgContra} mejorAlto={false} />, fmt(lV.xgContra)],
              ]}
            />

            <p className="mb-2 mt-5 text-[10px] uppercase tracking-[0.16em] text-white/40">Goles por franja · local y visitante</p>
            <Tabla cabeza={["Franja", "Local (favor - contra)", "Visitante (favor - contra)", "Liga: goles del local / partido", "Liga: goles del visitante / partido"]} filas={filasFranjaLado} />
          </Panel>

          {/* ---------------- tipología ---------------- */}
          <Panel
            title="Tipología de los goles"
            subtitle={
              esNuestro
                ? "De nuestros partidos, con el timeline de Hudl y las grabaciones tácticas. Es una propuesta: cada gol se corrige en la lista de abajo."
                : "De este equipo sólo se clasifican los goles de sus partidos contra nosotros (Hudl). Del resto de la liga sólo se sabe si fue de penalti o en propia puerta."
            }
            icon={Shapes}
            action={<SaveState status={manual.status} localOnly={manual.localOnly} savedAt={manual.lastSavedAt} sinGuardar={manual.sinGuardar} onGuardar={() => void manual.guardaYa()} />}
          >
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
              <div className="min-w-0 overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
                      <th className="px-3 py-2 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2 text-right font-medium">A favor</th>
                      <th className="px-3 py-2 text-right font-medium">%</th>
                      <th className="px-3 py-2 text-right font-medium">En contra</th>
                      <th className="px-3 py-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FASES.map((fase) => {
                      const sumaFase = (m: Map<string, number>) => fase.tipos.reduce((s, t) => s + (m.get(t.clave) ?? 0), 0);
                      const ff = sumaFase(tipologia.cuenta.favor);
                      const fc = sumaFase(tipologia.cuenta.contra);

                      return [
                        <tr key={fase.fase} className="bg-white/[0.05] text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                          <td className="px-3 py-1.5">{fase.fase}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{ff}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{pct(ff, tipologia.totalFavor)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fc}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{pct(fc, tipologia.totalContra)}</td>
                        </tr>,
                        ...fase.tipos.map((t) => {
                          const a = tipologia.cuenta.favor.get(t.clave) ?? 0;
                          const b = tipologia.cuenta.contra.get(t.clave) ?? 0;

                          return (
                            <tr key={t.clave} className="border-b border-white/[0.06]">
                              <td className="px-3 py-1.5 pl-5 text-white/75">{t.nombre}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: a ? ORO : tinta(0.3) }}>
                                {a}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-white/50">{a ? pct(a, tipologia.totalFavor) : ""}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: b ? PEOR : tinta(0.3) }}>
                                {b}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-white/50">{b ? pct(b, tipologia.totalContra) : ""}</td>
                            </tr>
                          );
                        }),
                      ];
                    })}
                    {tipologia.sinFavor + tipologia.sinContra > 0 ? (
                      <tr className="text-white/45">
                        <td className="px-3 py-1.5">Sin clasificar</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{tipologia.sinFavor}</td>
                        <td />
                        <td className="px-3 py-1.5 text-right tabular-nums">{tipologia.sinContra}</td>
                        <td />
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="min-w-0 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Lo que se sabe de toda la liga (BeSoccer)</p>
                <Tabla
                  cabeza={["", "Penalti", "Propia puerta", "Resto"]}
                  filas={[
                    [`${equipo.split(" ").slice(-1)[0]} a favor`, pct(origenLiga.favor.penalti, origenLiga.favor.n), pct(origenLiga.favor.propia, origenLiga.favor.n), pct(origenLiga.favor.n - origenLiga.favor.penalti - origenLiga.favor.propia, origenLiga.favor.n)],
                    [`${equipo.split(" ").slice(-1)[0]} en contra`, pct(origenLiga.contra.penalti, origenLiga.contra.n), pct(origenLiga.contra.propia, origenLiga.contra.n), pct(origenLiga.contra.n - origenLiga.contra.penalti - origenLiga.contra.propia, origenLiga.contra.n)],
                    ["Liga", pct(origenLiga.liga.penalti, origenLiga.liga.n), pct(origenLiga.liga.propia, origenLiga.liga.n), pct(origenLiga.liga.n - origenLiga.liga.penalti - origenLiga.liga.propia, origenLiga.liga.n)],
                  ]}
                />
                {doc.sinTimeline?.length ? (
                  <p className="text-[11px] leading-relaxed text-white/40">
                    Sin timeline de Hudl (no se pueden clasificar solos): {doc.sinTimeline.join(" · ")}. Se clasifican a mano en la lista.
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>

          {/* ---------------- remates por franja ---------------- */}
          {rematesFranja ? (
            <Panel title="Remates por franja" subtitle={`Del timeline de Hudl de ${rematesFranja.n} de nuestros partidos (Wyscout no da el minuto de los remates).`} icon={Crosshair}>
              <Tabla
                cabeza={["Franja", "Remates", "A puerta", "Goles", "Remates en contra", "A puerta", "Goles"]}
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

          {/* ---------------- marcar primero ---------------- */}
          <Panel title="Quién marca primero" subtitle="Cómo acaban los partidos según quién abre el marcador, frente a la liga con la misma condición." icon={Trophy}>
            <Tabla
              cabeza={["", "Partidos", "Ganados", "Empatados", "Perdidos", "Puntos / partido", "Liga: puntos / partido"]}
              filas={(["propio", "rival", "nadie"] as const).map((k) => {
                const e = primero.eq[k];
                const l = primero.lg[k];

                return [
                  k === "propio" ? "Marca primero" : k === "rival" ? "Recibe primero" : "Sin goles",
                  e.n,
                  e.G,
                  e.E,
                  e.P,
                  <Contra key={k} valor={media(e.G * 3 + e.E, e.n)} liga={media(l.G * 3 + l.E, l.n)} mejorAlto />,
                  fmt(media(l.G * 3 + l.E, l.n)),
                ];
              })}
            />
          </Panel>

          {/* ---------------- lista ---------------- */}
          <Panel title="Todos los goles" subtitle={esNuestro ? "La tipología de cada gol se puede cambiar: lo que elijas manda sobre la propuesta de Hudl." : "Los de sus partidos contra nosotros llevan tipología."} icon={ListOrdered} bodyClassName="p-0">
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
                                  {info.tipo ? `Propuesta: ${NOMBRE_TIPO[info.tipo]}` : "Sin clasificar"}
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
                              <p className="mt-1 text-[11px] leading-snug text-white/40">
                                {elegido ? `Elegido a mano${t !== info.tipo && info.tipo ? ` (Hudl decía ${NOMBRE_TIPO[info.tipo]})` : ""}. ` : ""}
                                {info.motivo}
                              </p>
                              {info.texto ? <p className="mt-0.5 text-[11px] leading-snug text-white/35">Táctica: {info.texto}</p> : null}
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
