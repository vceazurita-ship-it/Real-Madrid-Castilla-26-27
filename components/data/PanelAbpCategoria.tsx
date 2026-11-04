"use client";

/**
 * ABP DE LA CATEGORÍA (04/11/2026) · cómo se marcan los goles a balón parado
 * en la Primera RFEF, acción a acción.
 *
 * El dato es `public/data/abp-acciones-todas.json` (lo arma
 * `scripts/abp-acciones.cjs` con los eventos de Wyscout): TODAS las acciones a
 * balón parado que acabaron en remate, con su saque, su caída, su remate, el
 * lanzador, el rematador y el xG. Aquí el tipo de cada gol es dato; en
 * «Goles a balón parado» (`golesAbp`) córner y falta siguen siendo estimación.
 *
 * Sólo lectura: se baja una vez por pestaña con `useAbpTodas` (el mismo que
 * usa el laboratorio de ABP).
 */

import { useEffect, useMemo, useState } from "react";
import { Clock, Crosshair, Flag, ListOrdered, Shield, Users } from "lucide-react";

import { Button, Notice, Panel, Segmented } from "@/components/abp/ui";
import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { Lectura } from "@/components/data/formas";
import { Explicativo } from "@/components/ui/textos-analisis";
import { useAbpTodas } from "@/hooks/useAbpAcciones";
import { cargaCalendario } from "@/hooks/useCalendario";
import { aMetros, zonaDe, type Accion, type PuntoWy, type TipoAccion } from "@/lib/abp-lab/acciones";
import type { Zona } from "@/lib/abp-lab/modelo";
import { mismoClub } from "@/lib/rivals/mismoClub";

type Grupo = "g2" | "g1" | "ambos";

const SLUG: Record<Exclude<Grupo, "ambos">, string> = { g2: "primera-rfef-g2", g1: "primera-rfef-g1" };

type Remate = Omit<Accion, "p"> & { partido: string; jornada: string; grupo: string };

type FiltroTipo = TipoAccion | "todos";

const TIPOS: TipoAccion[] = ["corner", "falta", "directa", "banda", "penalti"];

const TIPO_TEXTO: Record<TipoAccion, string> = {
  corner: "Córner",
  falta: "Falta lateral",
  directa: "Falta directa",
  banda: "Saque de banda",
  penalti: "Penalti",
};

const ZONAS: { zona: Zona; texto: string }[] = [
  { zona: "primer-palo", texto: "Primer palo" },
  { zona: "centro", texto: "Centro del área pequeña" },
  { zona: "segundo-palo", texto: "Segundo palo" },
  { zona: "portero", texto: "Encima del portero" },
  { zona: "frontal", texto: "Frontal" },
  { zona: "corto", texto: "En corto" },
];

const FRANJAS = ["0-15'", "16-30'", "31-45+'", "46-60'", "61-75'", "76-90+'"];

const NOSOTROS = "Real Madrid Castilla";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "0 %");

const dec = (v: number, n = 2) => v.toFixed(n).replace(".", ",");

const conSigno = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${dec(Math.abs(v), 1)}`;

const franjaDe = (a: Remate) => (a.parte <= 1 ? (a.min <= 15 ? 0 : a.min <= 30 ? 1 : 2) : a.min <= 60 ? 3 : a.min <= 75 ? 4 : 5);

/** Los toques antes del remate (sin contar el del rematador si `pasos` lo trae). */
function toquesPrevios(a: Remate) {
  const pasos = a.pasos ?? [];

  const ultimo = pasos[pasos.length - 1];

  const esElRemate = ultimo && (ultimo[2] === a.rm || (a.remate && ultimo[0] === a.remate[0] && ultimo[1] === a.remate[1]));

  return esElRemate ? pasos.length - 1 : pasos.length;
}

/** Cómo llega el balón al rematador. Penalti y falta directa se rematan desde el saque. */
function jugadaDe(a: Remate): "primer" | "prolonga" | "segunda" | null {
  if (a.t === "penalti" || a.t === "directa") return null;

  const n = toquesPrevios(a);

  return n === 0 ? "primer" : n === 1 ? "prolonga" : "segunda";
}

const JUGADA_TEXTO = { primer: "Al primer toque", prolonga: "Tras una prolongación", segunda: "Segunda jugada (2 toques o más)" };

function zonaDeCaida(a: Remate): Zona | null {
  if (a.t === "penalti" || a.t === "directa" || !a.caida) return null;

  return zonaDe(aMetros(a.caida), a.saque ? aMetros(a.saque) : undefined);
}

const fechaCorta = (f: string) => (f.length >= 10 ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : f);

const jCorta = (j: string) => j.replace(/^Jornada\s*/i, "J");

/* ------------------------------------------------------------------ */
/*  EL CAMPO: media parte, la portería arriba                          */
/* ------------------------------------------------------------------ */

const AN = 68;
const AL = 52.5;

/** De Wyscout (0-100, atacando hacia x = 100) a metros con la portería arriba. */
const enCampo = ([x, y]: PuntoWy) => ({ x: (y / 100) * AN, y: Math.min(AL - 0.5, ((100 - x) / 100) * 105) });

function MediaCampo({ puntos, flechas }: { puntos: { id: string; p: PuntoWy; color: string; tenue?: boolean; titulo: string }[]; flechas: { id: string; de: PuntoWy; a: PuntoWy }[] }) {
  const linea = tinta(0.28);

  const arco = Math.sqrt(9.15 ** 2 - (16.5 - 11) ** 2);

  return (
    <svg viewBox={`-2 -3 ${AN + 4} ${AL + 5}`} className="block h-auto w-full" role="img" aria-label="Media parte del campo con la portería arriba">
      <rect x={0} y={0} width={AN} height={AL} fill={tinta(0.03)} stroke={linea} strokeWidth={0.25} />
      <rect x={30.34} y={-1.6} width={7.32} height={1.6} fill="none" stroke={linea} strokeWidth={0.25} />
      <rect x={13.84} y={0} width={40.32} height={16.5} fill="none" stroke={linea} strokeWidth={0.25} />
      <rect x={24.84} y={0} width={18.32} height={5.5} fill="none" stroke={linea} strokeWidth={0.25} />
      <circle cx={34} cy={11} r={0.3} fill={linea} />
      <path d={`M ${34 - arco} 16.5 A 9.15 9.15 0 0 0 ${34 + arco} 16.5`} fill="none" stroke={linea} strokeWidth={0.25} />
      <path d={`M ${34 - 9.15} ${AL} A 9.15 9.15 0 0 1 ${34 + 9.15} ${AL}`} fill="none" stroke={linea} strokeWidth={0.25} />

      {flechas.map((f) => {
        const a = enCampo(f.de);
        const b = enCampo(f.a);

        return <line key={f.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ORO} strokeOpacity={0.22} strokeWidth={0.2} />;
      })}

      {puntos.map((p) => {
        const c = enCampo(p.p);

        return (
          <circle key={p.id} cx={c.x} cy={c.y} r={p.tenue ? 0.55 : 0.9} fill={p.color} fillOpacity={p.tenue ? 0.35 : 0.9} stroke={p.tenue ? "none" : tinta(0.7)} strokeWidth={0.12}>
            <title>{p.titulo}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

function Cifra({ valor, rotulo, nota }: { valor: string; rotulo: string; nota?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-lg font-semibold tabular-nums text-white">{valor}</p>
      <p className="text-[11px] leading-snug text-white/50">{rotulo}</p>
      {nota && <p className="mt-0.5 text-[10px] leading-snug text-white/35">{nota}</p>}
    </div>
  );
}

function Barra({ etiqueta, valor, max, detalle }: { etiqueta: string; valor: number; max: number; detalle?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-2 text-[12px]">
      <span className="truncate text-white/70">{etiqueta}</span>
      <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <span className="block h-full rounded-full" style={{ width: `${max ? (valor / max) * 100 : 0}%`, background: ORO }} />
      </span>
      <span className="tabular-nums text-white/80">
        {valor}
        {detalle && <span className="ml-1 text-white/40">{detalle}</span>}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EL PANEL                                                           */
/* ------------------------------------------------------------------ */

export function PanelAbpCategoria() {
  const { datos, fallo } = useAbpTodas(true);

  const [grupo, setGrupo] = useState<Grupo>("g2");
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [equipo, setEquipo] = useState("");
  const [lado, setLado] = useState<"favor" | "contra">("favor");
  const [mapa, setMapa] = useState<"caida" | "remate">("caida");
  const [conRemates, setConRemates] = useState(false);
  const [orden, setOrden] = useState<"gf" | "gc" | "dif">("gf");
  const [todosGoles, setTodosGoles] = useState(false);
  const [proximoBs, setProximoBs] = useState("");

  /* El próximo rival, del calendario de BeSoccer (mismo criterio que «Un equipo de un vistazo»). */
  useEffect(() => {
    let vivo = true;

    void cargaCalendario().then((partidos) => {
      const ahora = new Date();
      const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
      const sig = partidos.filter((p) => p.cuando && p.cuando.slice(0, 10) >= hoy).sort((a, b) => a.cuando.localeCompare(b.cuando))[0];

      if (vivo && sig) setProximoBs(/castilla/i.test(sig.local) ? sig.visitante : sig.local);
    });

    return () => {
      vivo = false;
    };
  }, []);

  /* Las acciones del grupo elegido, ya con partido y jornada. */
  const delGrupo = useMemo<Remate[]>(() => {
    if (!datos) return [];

    const slugs = grupo === "ambos" ? Object.values(SLUG) : [SLUG[grupo]];

    return datos.competiciones
      .filter((c) => slugs.includes(c.slug))
      .flatMap((c) =>
        c.acciones.flatMap((a) => {
          const m = c.partidos[a.id];

          return m ? [{ ...a, fecha: m.f, partido: m.p, jornada: m.j, grupo: c.corto }] : [];
        }),
      );
  }, [datos, grupo]);

  const equipos = useMemo(() => [...new Set(delGrupo.flatMap((a) => [a.eq ?? "", a.rival ?? ""]))].filter(Boolean).sort((a, b) => a.localeCompare(b, "es")), [delGrupo]);

  const proximo = useMemo(() => (proximoBs ? (equipos.find((e) => mismoClub(e, proximoBs)) ?? "") : ""), [equipos, proximoBs]);

  const elEquipo = equipos.includes(equipo) ? equipo : "";

  /* Lo que se mira: el equipo elegido (a favor o en contra) y el tipo. */
  const vistos = useMemo(
    () =>
      delGrupo.filter(
        (a) => (!elEquipo || (lado === "favor" ? a.eq === elEquipo : a.rival === elEquipo)) && (tipo === "todos" || a.t === tipo),
      ),
    [delGrupo, elEquipo, lado, tipo],
  );

  const goles = useMemo(() => vistos.filter((a) => a.r === "gol").sort((a, b) => b.fecha.localeCompare(a.fecha) || b.min - a.min), [vistos]);

  /* Por tipo, sin el filtro de tipo (es la tabla que lo explica). */
  const porTipo = useMemo(() => {
    const base = delGrupo.filter((a) => !elEquipo || (lado === "favor" ? a.eq === elEquipo : a.rival === elEquipo));

    return TIPOS.map((t) => {
      const suyos = base.filter((a) => a.t === t);
      const g = suyos.filter((a) => a.r === "gol").length;
      const xg = suyos.reduce((s, a) => s + (a.xg ?? 0), 0);

      return { t, n: suyos.length, goles: g, xg };
    }).filter((f) => f.n > 0);
  }, [delGrupo, elEquipo, lado]);

  /* Todos los partidos del grupo (también los que no tuvieron un remate a balón parado). */
  const titulos = useMemo(() => {
    if (!datos) return [] as string[];

    const slugs = grupo === "ambos" ? Object.values(SLUG) : [SLUG[grupo]];

    return datos.competiciones.filter((c) => slugs.includes(c.slug)).flatMap((c) => Object.values(c.partidos).map((m) => m.p));
  }, [datos, grupo]);

  const partidos = titulos.length;

  /* Los partidos del equipo elegido (o los del grupo), para el «por partido». */
  const partidosVistos = useMemo(
    () => (elEquipo ? titulos.filter((t) => t.startsWith(`${elEquipo} - `) || t.includes(` - ${elEquipo} `)).length : partidos),
    [titulos, elEquipo, partidos],
  );

  const hasta = useMemo(() => {
    const ns = delGrupo.map((a) => Number(a.jornada.replace(/\D/g, ""))).filter((n) => n > 0);

    return ns.length ? Math.max(...ns) : 0;
  }, [delGrupo]);

  /* Por equipo, siempre del grupo entero y con el filtro de tipo. */
  const ranking = useMemo(() => {
    const m = new Map<string, { gf: number; gc: number; rf: number; xgf: number }>();

    for (const e of equipos) m.set(e, { gf: 0, gc: 0, rf: 0, xgf: 0 });

    for (const a of delGrupo) {
      if (tipo !== "todos" && a.t !== tipo) continue;

      const f = a.eq ? m.get(a.eq) : undefined;
      const c = a.rival ? m.get(a.rival) : undefined;

      if (f) {
        f.rf++;
        f.xgf += a.xg ?? 0;

        if (a.r === "gol") f.gf++;
      }

      if (c && a.r === "gol") c.gc++;
    }

    const valor = (x: { gf: number; gc: number }) => (orden === "gf" ? x.gf : orden === "gc" ? -x.gc : x.gf - x.gc);

    return [...m.entries()].map(([e, x]) => ({ equipo: e, ...x })).sort((a, b) => valor(b) - valor(a) || b.gf - a.gf || a.equipo.localeCompare(b.equipo, "es"));
  }, [delGrupo, equipos, tipo, orden]);

  const zonas = useMemo(() => {
    const cuenta = new Map<Zona, number>();

    for (const a of goles) {
      const z = zonaDeCaida(a);

      if (z) cuenta.set(z, (cuenta.get(z) ?? 0) + 1);
    }

    return ZONAS.map((z) => ({ ...z, n: cuenta.get(z.zona) ?? 0 })).filter((z) => z.n > 0);
  }, [goles]);

  const jugadas = useMemo(() => {
    const base = vistos.filter((a) => jugadaDe(a));

    return (["primer", "prolonga", "segunda"] as const)
      .map((j) => {
        const suyos = base.filter((a) => jugadaDe(a) === j);

        return { j, n: suyos.length, goles: suyos.filter((a) => a.r === "gol").length };
      })
      .filter((x) => x.n > 0);
  }, [vistos]);

  const cabeza = useMemo(() => {
    const base = goles.filter((a) => a.t !== "penalti");

    return { cabeza: base.filter((a) => a.cabeza).length, pie: base.filter((a) => !a.cabeza).length };
  }, [goles]);

  const franjas = useMemo(() => {
    const v = FRANJAS.map(() => 0);

    for (const a of goles) v[franjaDe(a)]++;

    return v;
  }, [goles]);

  const top = (lista: { nombre: string; eq: string }[]) => {
    const m = new Map<string, { nombre: string; eq: string; n: number }>();

    for (const x of lista) {
      const k = `${x.nombre}|${x.eq}`;
      const f = m.get(k) ?? { ...x, n: 0 };

      f.n++;
      m.set(k, f);
    }

    return [...m.values()].filter((x) => x.n > 1).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es")).slice(0, 8);
  };

  const lanzadores = useMemo(
    () => top(goles.flatMap((a) => (a.t === "penalti" ? [] : a.lz ? [{ nombre: a.lz, eq: a.eq ?? "" }] : a.t === "directa" && a.rm ? [{ nombre: a.rm, eq: a.eq ?? "" }] : []))),
    [goles],
  );

  const rematadores = useMemo(() => top(goles.flatMap((a) => (a.rm && a.t !== "penalti" ? [{ nombre: a.rm, eq: a.eq ?? "" }] : []))), [goles]);

  if (fallo) {
    return (
      <Notice tone="warn" title="No han llegado las acciones de Wyscout">
        Vuelve a abrir la pestaña en un momento.
      </Notice>
    );
  }

  if (!datos) return <p className="px-1 py-6 text-sm text-white/50">Cargando las acciones de la categoría…</p>;

  const nGoles = goles.length;
  const xgTotal = vistos.reduce((s, a) => s + (a.xg ?? 0), 0);
  const xgGoles = goles.reduce((s, a) => s + (a.xg ?? 0), 0);

  const tipoMasGol = [...porTipo].sort((a, b) => b.goles - a.goles)[0];
  const mejorConversion = [...porTipo].filter((f) => f.t !== "penalti" && f.n >= 15).sort((a, b) => b.goles / b.n - a.goles / a.n)[0];

  const totalGolesTipo = porTipo.reduce((s, f) => s + f.goles, 0);

  const enMapa = (conRemates ? vistos : goles).filter((a) => a.t !== "penalti" && (mapa === "caida" ? a.caida && a.t !== "directa" : a.remate));

  const zonaTop = [...zonas].sort((a, b) => b.n - a.n)[0];
  const golesZona = zonas.reduce((s, z) => s + z.n, 0);

  const franjaTop = franjas.indexOf(Math.max(...franjas));

  const quien = elEquipo ? `${elEquipo} ${lado === "favor" ? "a favor" : "en contra"}` : grupo === "ambos" ? "Los dos grupos" : `El ${grupo === "g2" ? "grupo 2" : "grupo 1"}`;

  const golesVisibles = todosGoles ? goles : goles.slice(0, 20);

  const nuestro = ranking.find((r) => r.equipo === NOSOTROS);
  const posNuestra = nuestro ? ranking.indexOf(nuestro) + 1 : 0;

  return (
    <div className="space-y-4">
      {/* Los filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          ariaLabel="Grupo"
          value={grupo}
          onChange={(g) => {
            setGrupo(g);
            setTodosGoles(false);
          }}
          options={[
            { key: "g2", label: "Grupo 2" },
            { key: "g1", label: "Grupo 1" },
            { key: "ambos", label: "Los dos" },
          ]}
        />

        <select
          aria-label="Tipo de balón parado"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as FiltroTipo)}
          className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/80"
        >
          <option value="todos">Todos los tipos</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {TIPO_TEXTO[t]}
            </option>
          ))}
        </select>

        <select
          aria-label="Equipo"
          value={elEquipo}
          onChange={(e) => setEquipo(e.target.value)}
          className="min-w-0 max-w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/80"
        >
          <option value="">Todos los equipos</option>
          {equipos.map((e) => (
            <option key={e} value={e}>
              {e}
              {e === proximo ? " · próximo rival" : ""}
            </option>
          ))}
        </select>

        {elEquipo && (
          <Segmented
            ariaLabel="A favor o en contra"
            value={lado}
            onChange={setLado}
            options={[
              { key: "favor", label: "A favor" },
              { key: "contra", label: "En contra" },
            ]}
          />
        )}

        <div className="flex flex-wrap gap-1.5">
          {equipos.includes(NOSOTROS) && elEquipo !== NOSOTROS && (
            <button type="button" onClick={() => setEquipo(NOSOTROS)} className="rounded-full border border-[#C8A96B]/40 px-2.5 py-1 text-[11px] text-[#C8A96B]">
              Castilla
            </button>
          )}
          {proximo && elEquipo !== proximo && (
            <button type="button" onClick={() => setEquipo(proximo)} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/70">
              Próximo rival: {proximo}
            </button>
          )}
          {elEquipo && (
            <button type="button" onClick={() => setEquipo("")} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/50">
              Quitar equipo
            </button>
          )}
        </div>
      </div>

      <Explicativo>
        <p className="text-[12px] leading-relaxed text-white/50">
          Cada gol sale de su evento en Wyscout: aquí el tipo de jugada es dato, no estimación. Entran todos los balones parados que acabaron en remate, {partidos} partidos
          {hasta ? ` hasta la jornada ${hasta}` : ""}.
        </p>
      </Explicativo>

      {/* Las cifras */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra valor={String(nGoles)} rotulo="Goles a balón parado" nota={partidosVistos ? `${dec(nGoles / partidosVistos)} por partido` : undefined} />
        <Cifra valor={String(vistos.length)} rotulo="Remates a balón parado" />
        <Cifra valor={pct(nGoles, vistos.length)} rotulo="De remate a gol" />
        <Cifra valor={`${nGoles} / ${dec(xgTotal, 1)}`} rotulo="Goles / xG" nota={`${conSigno(nGoles - xgTotal)} sobre lo esperado`} />
      </div>

      {/* Por tipo */}
      <Panel
        title="Goles por tipo"
        subtitle="Remates, goles y lo que vale cada remate"
        icon={Flag}
        bodyClassName="p-0"
        analisis={
          tipoMasGol && totalGolesTipo > 0 ? (
            <div className="px-4 pb-4 sm:px-5">
              <Lectura>
                {quien}: el {TIPO_TEXTO[tipoMasGol.t].toLowerCase()} da {tipoMasGol.goles} de {totalGolesTipo} goles ({pct(tipoMasGol.goles, totalGolesTipo)}).
                {mejorConversion && ` Sin contar el penalti, el que más convierte es ${TIPO_TEXTO[mejorConversion.t].toLowerCase()}: ${pct(mejorConversion.goles, mejorConversion.n)} de sus remates acaban en gol.`}
              </Lectura>
            </div>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-[12px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-wider text-white/40">
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-2 py-2 text-right font-medium">Remates</th>
                <th className="px-2 py-2 text-right font-medium">Goles</th>
                <th className="px-2 py-2 text-right font-medium">Conversión</th>
                <th className="px-2 py-2 text-right font-medium">xG medio</th>
                <th className="px-4 py-2 text-right font-medium">Gol − xG</th>
              </tr>
            </thead>
            <tbody>
              {porTipo.map((f) => (
                <tr
                  key={f.t}
                  onClick={() => setTipo(tipo === f.t ? "todos" : f.t)}
                  className={`cursor-pointer border-b border-white/[0.05] hover:bg-white/[0.04] ${tipo === f.t ? "bg-[#C8A96B]/10" : ""}`}
                >
                  <td className="px-4 py-2 text-white/80">{TIPO_TEXTO[f.t]}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-white/60">{f.n}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-white">{f.goles}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-white/70">{pct(f.goles, f.n)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-white/60">{dec(f.xg / f.n)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-white/70">{conSigno(f.goles - f.xg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* El campo */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel
          title={mapa === "caida" ? "Dónde cae el balón" : "Desde dónde se remata"}
          subtitle={conRemates ? "Goles y remates, sin penaltis" : "Los goles, sin penaltis"}
          icon={Crosshair}
          action={
            <Segmented
              ariaLabel="Qué punto se pinta"
              value={mapa}
              onChange={setMapa}
              options={[
                { key: "caida", label: "Caída" },
                { key: "remate", label: "Remate" },
              ]}
            />
          }
        >
          <MediaCampo
            puntos={enMapa.map((a, i) => ({
              id: `${a.id}-${a.seg}-${i}`,
              p: (mapa === "caida" ? a.caida : a.remate) as PuntoWy,
              color: a.r !== "gol" ? tinta(0.6) : a.cabeza ? ORO : COMPARADO,
              tenue: a.r !== "gol",
              titulo: `${a.r === "gol" ? "Gol" : "Remate"} · ${TIPO_TEXTO[a.t]} · ${a.rm ?? ""}${a.eq ? ` (${a.eq})` : ""} · ${a.min}'${a.xg != null ? ` · xG ${dec(a.xg)}` : ""}`,
            }))}
            flechas={
              mapa === "caida"
                ? enMapa.filter((a) => a.r === "gol" && a.saque && a.caida).map((a, i) => ({ id: `${a.id}-${a.seg}-${i}`, de: a.saque as PuntoWy, a: a.caida as PuntoWy }))
                : []
            }
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/55">
            <span className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ORO }} /> Gol de cabeza
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COMPARADO }} /> Gol con el pie
              </span>
              {conRemates && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: tinta(0.35) }} /> Remate sin gol
                </span>
              )}
            </span>
            <Button onClick={() => setConRemates((v) => !v)}>
              {conRemates ? "Sólo los goles" : "Ver también los remates"}
            </Button>
          </div>
        </Panel>

        <Panel
          title="Cómo llega el gol"
          subtitle="Zona de caída, cabeza o pie, y a qué toque"
          icon={Shield}
          analisis={
            zonaTop && golesZona > 0 ? (
              <div className="px-4 pb-4 sm:px-5">
                <Lectura>
                  {zonaTop.texto}: {zonaTop.n} de {golesZona} goles con caída ({pct(zonaTop.n, golesZona)}).
                  {cabeza.cabeza + cabeza.pie > 0 && ` ${pct(cabeza.cabeza, cabeza.cabeza + cabeza.pie)} de los goles sin penalti son de cabeza.`}
                </Lectura>
              </div>
            ) : undefined
          }
        >
          <div className="space-y-4">
            {zonas.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Dónde cae en los goles</p>
                {zonas.map((z) => (
                  <Barra key={z.zona} etiqueta={z.texto} valor={z.n} max={Math.max(...zonas.map((x) => x.n))} detalle={pct(z.n, golesZona)} />
                ))}
              </div>
            )}

            {cabeza.cabeza + cabeza.pie > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Con qué se remata el gol</p>
                <Barra etiqueta="De cabeza" valor={cabeza.cabeza} max={Math.max(cabeza.cabeza, cabeza.pie)} detalle={pct(cabeza.cabeza, cabeza.cabeza + cabeza.pie)} />
                <Barra etiqueta="Con el pie" valor={cabeza.pie} max={Math.max(cabeza.cabeza, cabeza.pie)} detalle={pct(cabeza.pie, cabeza.cabeza + cabeza.pie)} />
              </div>
            )}

            {jugadas.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-white/40">A qué toque llega el remate (goles · conversión)</p>
                {jugadas.map((x) => (
                  <Barra key={x.j} etiqueta={JUGADA_TEXTO[x.j]} valor={x.goles} max={Math.max(...jugadas.map((y) => y.goles), 1)} detalle={`de ${x.n} · ${pct(x.goles, x.n)}`} />
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Por equipo */}
      <Panel
        title="Por equipo"
        subtitle={tipo === "todos" ? "Goles a balón parado a favor y en contra" : `Sólo ${TIPO_TEXTO[tipo].toLowerCase()}`}
        icon={Users}
        bodyClassName="p-0"
        action={
          <Segmented
            ariaLabel="Ordenar por"
            value={orden}
            onChange={setOrden}
            options={[
              { key: "gf", label: "A favor" },
              { key: "gc", label: "En contra" },
              { key: "dif", label: "Diferencia" },
            ]}
          />
        }
        analisis={
          nuestro ? (
            <div className="px-4 pb-4 sm:px-5">
              <Lectura>
                Real Madrid Castilla: {nuestro.gf} a favor y {nuestro.gc} en contra, {posNuestra}.º de {ranking.length} por {orden === "gf" ? "goles a favor" : orden === "gc" ? "menos goles encajados" : "diferencia"}.
              </Lectura>
            </div>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[21rem] text-[12px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-wider text-white/40">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Equipo</th>
                <th className="px-2 py-2 text-right font-medium">A favor</th>
                <th className="px-2 py-2 text-right font-medium">En contra</th>
                <th className="px-2 py-2 text-right font-medium">Dif.</th>
                <th className="px-4 py-2 text-right font-medium">Remates</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => {
                const marca = r.equipo === NOSOTROS ? "nosotros" : r.equipo === proximo ? "proximo" : "";

                return (
                  <tr
                    key={r.equipo}
                    onClick={() => setEquipo(elEquipo === r.equipo ? "" : r.equipo)}
                    className={`cursor-pointer border-b border-white/[0.05] hover:bg-white/[0.04] ${elEquipo === r.equipo ? "bg-white/[0.06]" : marca === "nosotros" ? "bg-[#C8A96B]/10" : ""}`}
                  >
                    <td className="px-4 py-2 tabular-nums text-white/40">{i + 1}</td>
                    <td className="max-w-[10rem] truncate px-2 py-2 text-white/85">
                      <span className={marca === "nosotros" ? "font-semibold text-[#C8A96B]" : ""} style={marca === "proximo" ? { color: COMPARADO, fontWeight: 600 } : undefined}>
                        {r.equipo}
                      </span>
                      {marca === "proximo" && <span className="ml-1.5 text-[10px] text-white/40">próximo rival</span>}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-white">{r.gf}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-white/70">{r.gc}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-white/60">{r.gf - r.gc > 0 ? `+${r.gf - r.gc}` : r.gf - r.gc}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-white/50">{r.rf}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Minuto y nombres */}
      <div className="grid gap-4 lg:grid-cols-3">
        {nGoles > 0 && (
          <Panel
            title="En qué minuto"
            subtitle="Goles por franja de 15'"
            icon={Clock}
            analisis={
              <div className="px-4 pb-4 sm:px-5">
                <Lectura>
                  La franja con más goles es la de {FRANJAS[franjaTop]}: {franjas[franjaTop]} de {nGoles}.
                </Lectura>
              </div>
            }
          >
            <div className="space-y-1.5">
              {FRANJAS.map((f, i) => (
                <Barra key={f} etiqueta={f} valor={franjas[i]} max={Math.max(...franjas)} />
              ))}
            </div>
          </Panel>
        )}

        {lanzadores.length > 0 && (
          <Panel title="Lanzadores" subtitle="Goles que nacen de su saque (sin penaltis)" icon={Flag}>
            <div className="space-y-1.5">
              {lanzadores.map((x) => (
                <Barra key={`${x.nombre}|${x.eq}`} etiqueta={`${x.nombre} · ${x.eq}`} valor={x.n} max={lanzadores[0].n} />
              ))}
            </div>
          </Panel>
        )}

        {rematadores.length > 0 && (
          <Panel title="Rematadores" subtitle="Goles a balón parado (sin penaltis)" icon={Crosshair}>
            <div className="space-y-1.5">
              {rematadores.map((x) => (
                <Barra key={`${x.nombre}|${x.eq}`} etiqueta={`${x.nombre} · ${x.eq}`} valor={x.n} max={rematadores[0].n} />
              ))}
            </div>
          </Panel>
        )}
      </div>

      {/* La lista */}
      {nGoles > 0 && (
        <Panel title="Los goles, uno a uno" subtitle={`${nGoles} goles · ${dec(xgGoles, 1)} xG · del más reciente al más antiguo`} icon={ListOrdered} bodyClassName="p-0">
          <ul className="divide-y divide-white/[0.05]">
            {golesVisibles.map((a, i) => (
              <li key={`${a.id}-${a.seg}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-[12px] sm:px-5">
                <span className="w-20 shrink-0 tabular-nums text-white/40">
                  {fechaCorta(a.fecha)} · {jCorta(a.jornada)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-white/85">{a.eq}</span>
                  <span className="text-white/40"> · {a.partido}</span>
                  <span className="block text-white/55">
                    {a.min}&apos; · {TIPO_TEXTO[a.t]}
                    {a.rm && ` · ${a.rm}`}
                    {a.t !== "penalti" && (a.cabeza ? " de cabeza" : " con el pie")}
                    {a.lz && ` · saca ${a.lz}`}
                  </span>
                </span>
                {a.xg != null && <span className="shrink-0 tabular-nums text-white/50">xG {dec(a.xg)}</span>}
              </li>
            ))}
          </ul>

          {goles.length > 20 && (
            <div className="border-t border-white/[0.05] px-4 py-2.5 sm:px-5">
              <Button onClick={() => setTodosGoles((v) => !v)}>
                {todosGoles ? "Ver sólo los 20 últimos" : `Ver los ${goles.length}`}
              </Button>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
