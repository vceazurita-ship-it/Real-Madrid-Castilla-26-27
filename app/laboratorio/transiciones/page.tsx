"use client";

/**
 * Laboratorio · Robos y transiciones.
 *
 * Qué mide: cada vez que el Castilla le quita el balón al rival de forma
 * ACTIVA (entrada, interceptación o balón ganado por presión), qué es lo
 * primero que hace con él —sale hacia delante o lo mueve en horizontal y hacia
 * atrás— y en qué acaba la jugada que nace de ahí.
 *
 * De dónde salen los datos: NO hay proveedor. Estos partidos no tienen datos de
 * eventos (Opta sólo trae PDF del rival, la caché de Wyscout son medias de liga
 * y no hay coding). La única fuente es el vídeo, mirado imagen a imagen: se
 * saca un fotograma por segundo, se apilan de dos en dos y alguien —aquí, un
 * agente— va diciendo de quién es el balón en cada momento. Por eso está en
 * obras y por eso la pantalla enseña SIEMPRE cuánto partido lleva revisado: si
 * un partido va por la mitad, los totales son de esa mitad, no del partido.
 *
 * Los datos los genera `scripts/transiciones-datos.mjs` a partir de los CSV de
 * `Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES`. Cuando cierra un bloque
 * nuevo se vuelve a lanzar el script y esta pantalla se actualiza sola.
 */

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUp,
  ArrowLeftRight,
  Clock,
  Crosshair,
  Eye,
  HardHat,
  Map as MapIcon,
  Target,
  Timer,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Panel } from "@/components/abp/ui";
import { PARTIDOS, type Accion, type Robo } from "@/lib/transiciones/datos";

/* ------------------------------------------------------------------ */
/*  Colores                                                            */
/* ------------------------------------------------------------------ */

/**
 * El par verde/naranja es el mismo que usa Data Análisis para «lo que sale
 * bien / lo que no», y se distingue con daltonismo. El acero y el burdeos son
 * para lo que no es ni una cosa ni la otra.
 */
const COLOR_ACCION: Record<Accion, string> = {
  ADELANTE: "#1B9E77",
  HORIZONTAL_ATRAS: "#D95F02",
  DESPEJE: "#66758A",
  PERDIDA: "#8A6262",
};

const NOMBRE_ACCION: Record<Accion, string> = {
  ADELANTE: "Adelante",
  HORIZONTAL_ATRAS: "Horizontal o atrás",
  DESPEJE: "Despeje",
  PERDIDA: "Pérdida inmediata",
};

const ORO = "#C8A96B";
const ACERO = "#66758A";

/** Los desenlaces, de lo mejor a lo peor, que es como se leen de un vistazo. */
const DESENLACES: { clave: string; nombre: string; color: string }[] = [
  { clave: "REMATE", nombre: "Remate", color: "#1B9E77" },
  { clave: "AREA", nombre: "Balón al área", color: "#4C9A7A" },
  { clave: "ULTIMO_TERCIO", nombre: "Último tercio", color: ORO },
  { clave: "FALTA_FAVOR", nombre: "Falta a favor", color: "#8FA0B8" },
  { clave: "POSESION", nombre: "Posesión larga", color: ACERO },
  { clave: "ATRAS_PORTERO", nombre: "Atrás al portero", color: "#5F6B7A" },
  { clave: "FUERA", nombre: "Sale por línea", color: "#7C6F9F" },
  { clave: "FALTA_CONTRA", nombre: "Falta nuestra", color: "#8A6262" },
  { clave: "PERDIDA", nombre: "La perdemos", color: "#D95F02" },
];

const ZONAS = ["campo propio", "medio campo", "campo rival"] as const;
const CARRILES = ["izquierda", "centro", "derecha"] as const;

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */

function reloj(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}'${String(s).padStart(2, "0")}"`;
}

function zonaDe(r: Robo) {
  if (r.zona.includes("rival")) return "campo rival";
  if (r.zona.includes("medio")) return "medio campo";
  return "campo propio";
}

function pct(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

/* ------------------------------------------------------------------ */
/*  Piezas sueltas                                                     */
/* ------------------------------------------------------------------ */

function Cifra({
  valor,
  rotulo,
  pie,
  color = ORO,
  icono: Icono,
}: {
  valor: string;
  rotulo: string;
  pie?: string;
  color?: string;
  icono?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {Icono && <Icono size={13} />}
        {rotulo}
      </div>

      <p className="mt-2 text-3xl font-semibold tabular-nums" style={{ color }}>
        {valor}
      </p>

      {pie && <p className="mt-1 text-xs text-white/40">{pie}</p>}
    </div>
  );
}

type PistaProps = {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string | number; value?: string | number; color?: string }[];
};

function Pista({ active, payload, label }: PistaProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#141A22] p-3 shadow-2xl">
      {label !== undefined && (
        <p className="mb-1.5 text-sm font-semibold text-white">{label}</p>
      )}

      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color ?? "#CBD5E1" }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pantalla                                                           */
/* ------------------------------------------------------------------ */

export default function TransicionesPage() {
  const [quien, setQuien] = useState<string>("todos");
  const [porcentajes, setPorcentajes] = useState(false);
  const [conDudosos, setConDudosos] = useState(true);

  const partidos = useMemo(
    () => PARTIDOS.filter((p) => p.robos.length > 0 || p.bloquesCerrados > 0),
    [],
  );

  const elegidos = useMemo(
    () => (quien === "todos" ? partidos : partidos.filter((p) => p.id === quien)),
    [partidos, quien],
  );

  /** Los robos que se están contando ahora mismo, ya filtrados. */
  const robos = useMemo(() => {
    const todos = elegidos.flatMap((p) =>
      p.robos.map((r) => ({ ...r, partido: p.id, jornada: p.jornada, rival: p.rival })),
    );
    return conDudosos ? todos : todos.filter((r) => r.confianza !== "baja");
  }, [elegidos, conDudosos]);

  const cobertura = useMemo(() => {
    const cerrados = elegidos.reduce((a, p) => a + p.bloquesCerrados, 0);
    const totales = elegidos.reduce((a, p) => a + p.bloquesTotales, 0);
    const minutosVideo = Math.round(
      elegidos.reduce((a, p) => a + p.segundosVideo, 0) / 60,
    );
    return {
      cerrados,
      totales,
      minutosVideo,
      minutosVistos: cerrados * 5,
      completo: cerrados === totales && totales > 0,
    };
  }, [elegidos]);

  /* --- reparto de la salida --- */
  const porAccion = useMemo(() => {
    const cuenta = (a: Accion) => robos.filter((r) => r.accion === a).length;
    return (Object.keys(COLOR_ACCION) as Accion[])
      .map((a) => ({
        clave: a,
        nombre: NOMBRE_ACCION[a],
        valor: cuenta(a),
        color: COLOR_ACCION[a],
      }))
      .filter((d) => d.valor > 0);
  }, [robos]);

  /** Los que sí llegan a pase o conducción: la comparación que importa. */
  const jugados = useMemo(
    () => robos.filter((r) => r.accion === "ADELANTE" || r.accion === "HORIZONTAL_ATRAS"),
    [robos],
  );
  const adelante = jugados.filter((r) => r.accion === "ADELANTE").length;

  /* --- por zona --- */
  const porZona = useMemo(
    () =>
      ZONAS.map((z) => {
        const dentro = robos.filter((r) => zonaDe(r) === z);
        const ade = dentro.filter((r) => r.accion === "ADELANTE").length;
        const hor = dentro.filter((r) => r.accion === "HORIZONTAL_ATRAS").length;
        const otro = dentro.length - ade - hor;
        const base = dentro.length || 1;
        return {
          zona: z[0].toUpperCase() + z.slice(1),
          total: dentro.length,
          Adelante: porcentajes ? Math.round((ade / base) * 100) : ade,
          "Horizontal o atrás": porcentajes ? Math.round((hor / base) * 100) : hor,
          Otro: porcentajes ? Math.round((otro / base) * 100) : otro,
        };
      }),
    [robos, porcentajes],
  );

  /* --- por carril --- */
  const porCarril = useMemo(
    () =>
      CARRILES.map((c) => {
        const dentro = robos.filter((r) => r.carril === c);
        return {
          carril: c[0].toUpperCase() + c.slice(1),
          Robos: dentro.length,
          Adelante: dentro.filter((r) => r.accion === "ADELANTE").length,
        };
      }),
    [robos],
  );

  /* --- desenlaces --- */
  const conDesenlace = robos.filter((r) => r.desenlace);
  const porDesenlace = useMemo(
    () =>
      DESENLACES.map((d) => ({
        nombre: d.nombre,
        color: d.color,
        valor: conDesenlace.filter((r) => r.desenlace === d.clave).length,
      })).filter((d) => d.valor > 0),
    [conDesenlace],
  );

  /* --- cuándo robamos --- */
  const porTramo = useMemo(() => {
    const tramos = [0, 15, 30, 45, 60, 75, 90];
    return tramos.map((ini) => {
      const dentro = robos.filter((r) => {
        const min = Math.floor(r.seg / 60);
        return min >= ini && min < ini + 15;
      });
      return {
        tramo: `${ini}'-${ini + 15}'`,
        Robos: dentro.length,
        Adelante: dentro.filter((r) => r.accion === "ADELANTE").length,
      };
    });
  }, [robos]);

  const duraciones = conDesenlace
    .map((r) => r.duracion)
    .filter((d): d is number => typeof d === "number");
  const duracionMedia = duraciones.length
    ? (duraciones.reduce((a, b) => a + b, 0) / duraciones.length).toFixed(1)
    : "—";

  const llegadas = conDesenlace.filter(
    (r) => r.desenlace === "REMATE" || r.desenlace === "AREA",
  ).length;

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · En obras"
              title="Robos y transiciones"
              aside={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  <HardHat size={12} />
                  En obras
                </span>
              }
            />

            {/* ---------------- mandos ---------------- */}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setQuien("todos")}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  quien === "todos"
                    ? "border-[#C8A96B]/40 bg-[#C8A96B]/15 text-[#C8A96B]"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                }`}
              >
                Todos los partidos
              </button>

              {partidos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setQuien(p.id)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    quien === p.id
                      ? "border-[#C8A96B]/40 bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                  }`}
                >
                  {p.jornada} · {p.local ? "" : "en "}
                  {p.rival}
                </button>
              ))}

              <span className="mx-1 h-6 w-px bg-white/10" />

              <button
                type="button"
                onClick={() => setPorcentajes((v) => !v)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20"
              >
                {porcentajes ? "Ver totales" : "Ver porcentajes"}
              </button>

              <button
                type="button"
                onClick={() => setConDudosos((v) => !v)}
                title="Los robos marcados con confianza baja son los que el etiquetado no puede defender fotograma a fotograma"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20"
              >
                <Eye size={14} />
                {conDudosos ? "Quitar los dudosos" : "Incluir los dudosos"}
              </button>

              {/*
                Cuánto partido lleva revisado. No es adorno: mientras falten
                bloques, los totales son de esos minutos y no del partido, y
                quien mire la pantalla tiene que poder verlo sin preguntar.
              */}
              <span
                className={`ml-auto rounded-xl border px-3 py-2 text-xs ${
                  cobertura.completo
                    ? "border-white/10 bg-white/[0.03] text-white/45"
                    : "border-amber-400/25 bg-amber-400/[0.07] text-amber-200/80"
                }`}
              >
                {cobertura.completo
                  ? `Revisado entero · ${cobertura.minutosVideo} min`
                  : `Revisado ${cobertura.minutosVistos} de ${cobertura.minutosVideo} min`}
              </span>
            </div>

            {/* ---------------- cifras ---------------- */}

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Cifra
                valor={String(robos.length)}
                rotulo="Robos"
                pie={`en ${cobertura.minutosVistos} min revisados`}
                icono={Crosshair}
              />

              <Cifra
                valor={`${pct(adelante, jugados.length)}%`}
                rotulo="Salen hacia delante"
                pie={`${adelante} de ${jugados.length} con pase o conducción`}
                color={COLOR_ACCION.ADELANTE}
                icono={ArrowUp}
              />

              <Cifra
                valor={`${pct(jugados.length - adelante, jugados.length)}%`}
                rotulo="Horizontal o atrás"
                pie={`${jugados.length - adelante} de ${jugados.length}`}
                color={COLOR_ACCION.HORIZONTAL_ATRAS}
                icono={ArrowLeftRight}
              />

              <Cifra
                valor={`${duracionMedia} s`}
                rotulo="Dura la transición"
                pie={
                  conDesenlace.length
                    ? `${llegadas} de ${conDesenlace.length} llegan al área o al remate`
                    : "sin datos de desenlace todavía"
                }
                icono={Timer}
              />
            </div>

            {/* ---------------- qué hacemos con el balón ---------------- */}

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Panel
                title="Qué hacemos con el balón robado"
                subtitle="Lo primero que pasa después del robo"
                icon={Target}
              >
                {robos.length === 0 ? (
                  <p className="text-sm text-white/45">Todavía no hay robos etiquetados.</p>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={porAccion}
                          dataKey="valor"
                          nameKey="nombre"
                          innerRadius={62}
                          outerRadius={100}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {porAccion.map((d) => (
                            <Cell key={d.clave} fill={d.color} />
                          ))}

                          <LabelList
                            dataKey="valor"
                            position="outside"
                            fill="#CBD5E1"
                            fontSize={12}
                            formatter={(v: unknown) => {
                              const n = Number(v);
                              if (!Number.isFinite(n)) return "";
                              return porcentajes ? `${pct(n, robos.length)}%` : String(n);
                            }}
                          />
                        </Pie>

                        <Tooltip content={<Pista />} />

                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          formatter={(v) => (
                            <span className="text-xs text-white/60">{v}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>

              <Panel
                title="Dónde robamos y cómo salimos"
                subtitle={
                  porcentajes
                    ? "Reparto dentro de cada zona"
                    : "Robos por zona del campo"
                }
                icon={MapIcon}
                analisis={
                  robos.length > 3 ? (
                    <p className="mx-4 mb-4 border-l-2 border-[#C8A96B]/40 pl-3 text-[12px] leading-relaxed text-white/60 sm:mx-5">
                      Lo que hay que mirar aquí es el contraste entre la barra de campo
                      rival y la de campo propio: cuanto más arriba se roba, más se sale
                      hacia delante.
                    </p>
                  ) : undefined
                }
              >
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porZona}>
                      <CartesianGrid stroke="#1E232A" vertical={false} />

                      <XAxis
                        dataKey="zona"
                        tick={{ fill: "#94A3B8", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{ fill: "#94A3B8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        unit={porcentajes ? "%" : ""}
                      />

                      <Tooltip content={<Pista />} cursor={{ fill: "#ffffff08" }} />

                      <Legend
                        iconType="circle"
                        formatter={(v) => (
                          <span className="text-xs text-white/60">{v}</span>
                        )}
                      />

                      <Bar
                        dataKey="Adelante"
                        stackId="z"
                        fill={COLOR_ACCION.ADELANTE}
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="Horizontal o atrás"
                        stackId="z"
                        fill={COLOR_ACCION.HORIZONTAL_ATRAS}
                      />
                      <Bar dataKey="Otro" stackId="z" fill={ACERO} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            {/* ---------------- desenlace y momento ---------------- */}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel
                title="En qué acaba la transición"
                subtitle={
                  conDesenlace.length
                    ? `${conDesenlace.length} jugadas seguidas hasta el final`
                    : "todavía sin seguimiento completo"
                }
                icon={Crosshair}
              >
                {porDesenlace.length === 0 ? (
                  <p className="text-sm text-white/45">
                    Los bloques con seguimiento del desenlace aún no han llegado.
                  </p>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={porDesenlace} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid stroke="#1E232A" horizontal={false} />

                        <XAxis
                          type="number"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />

                        <YAxis
                          type="category"
                          dataKey="nombre"
                          width={120}
                          tick={{ fill: "#94A3B8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip content={<Pista />} cursor={{ fill: "#ffffff08" }} />

                        <Bar dataKey="valor" name="Jugadas" radius={[0, 8, 8, 0]}>
                          {porDesenlace.map((d) => (
                            <Cell key={d.nombre} fill={d.color} />
                          ))}

                          <LabelList
                            dataKey="valor"
                            position="right"
                            fill="#CBD5E1"
                            fontSize={12}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>

              <Panel
                title="Cuándo robamos"
                subtitle="Por tramos de quince minutos de vídeo"
                icon={Clock}
              >
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porTramo}>
                      <CartesianGrid stroke="#1E232A" vertical={false} />

                      <XAxis
                        dataKey="tramo"
                        tick={{ fill: "#94A3B8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{ fill: "#94A3B8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />

                      <Tooltip content={<Pista />} cursor={{ fill: "#ffffff08" }} />

                      <Legend
                        iconType="circle"
                        formatter={(v) => (
                          <span className="text-xs text-white/60">{v}</span>
                        )}
                      />

                      <Bar dataKey="Robos" fill={ACERO} radius={[8, 8, 0, 0]} />
                      <Bar
                        dataKey="Adelante"
                        fill={COLOR_ACCION.ADELANTE}
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            {/* ---------------- carriles ---------------- */}

            {porCarril.some((c) => c.Robos > 0) && (
              <div className="mt-4">
                <Panel
                  title="Por qué carril"
                  subtitle="Sólo los bloques con el etiquetado ampliado"
                  icon={MapIcon}
                >
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={porCarril}>
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis
                          dataKey="carril"
                          tick={{ fill: "#94A3B8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />

                        <Tooltip content={<Pista />} cursor={{ fill: "#ffffff08" }} />

                        <Legend
                          iconType="circle"
                          formatter={(v) => (
                            <span className="text-xs text-white/60">{v}</span>
                          )}
                        />

                        <Bar dataKey="Robos" fill={ACERO} radius={[8, 8, 0, 0]} />
                        <Bar
                          dataKey="Adelante"
                          fill={COLOR_ACCION.ADELANTE}
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>
            )}

            {/* ---------------- listado ---------------- */}

            <div className="mt-4">
              <Panel
                title="Robo a robo"
                subtitle="El minuto es del vídeo, para ir directo a la jugada"
                icon={Crosshair}
                bodyClassName="p-0"
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
                        <th className="px-4 py-3">Min</th>
                        {quien === "todos" && <th className="px-4 py-3">Partido</th>}
                        <th className="px-4 py-3">Zona</th>
                        <th className="px-4 py-3">Carril</th>
                        <th className="px-4 py-3">Salida</th>
                        <th className="px-4 py-3">Acaba en</th>
                        <th className="px-4 py-3">Fiabilidad</th>
                      </tr>
                    </thead>

                    <tbody>
                      {robos.map((r) => (
                        <tr
                          key={`${r.partido}-${r.seg}`}
                          className="border-b border-white/5 align-top hover:bg-white/[0.02]"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-white/80">
                            {reloj(r.seg)}
                          </td>

                          {quien === "todos" && (
                            <td className="whitespace-nowrap px-4 py-3 text-white/50">
                              {r.jornada}
                            </td>
                          )}

                          <td className="whitespace-nowrap px-4 py-3 text-white/60">
                            {zonaDe(r)}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-white/40">
                            {r.carril || "—"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-semibold"
                              style={{
                                background: `${COLOR_ACCION[r.accion]}22`,
                                color: COLOR_ACCION[r.accion],
                              }}
                            >
                              {NOMBRE_ACCION[r.accion]}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-white/60">
                            {DESENLACES.find((d) => d.clave === r.desenlace)?.nombre ?? "—"}
                            {r.duracion ? (
                              <span className="ml-1 text-white/30">· {r.duracion}s</span>
                            ) : null}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-xs">
                            <span
                              className={
                                r.confianza === "alta"
                                  ? "text-emerald-300/80"
                                  : r.confianza === "media"
                                  ? "text-white/45"
                                  : "text-amber-300/70"
                              }
                            >
                              {r.confianza}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {robos.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                            Todavía no hay robos etiquetados con este filtro.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            {/* ---------------- goles ---------------- */}

            {elegidos.some((p) => p.goles.length > 0) && (
              <div className="mt-4">
                <Panel title="Goles del partido" subtitle="Para situar los robos" icon={Target}>
                  <ul className="space-y-1.5 text-sm text-white/60">
                    {elegidos.flatMap((p) =>
                      p.goles.map((g) => (
                        <li key={`${p.id}-${g.seg}`}>
                          <span className="font-semibold tabular-nums text-white/80">
                            {reloj(g.seg)}
                          </span>{" "}
                          · {g.texto}
                        </li>
                      )),
                    )}
                  </ul>
                </Panel>
              </div>
            )}

            <p className="mt-6 text-xs leading-relaxed text-white/30">
              Cuenta como robo la recuperación activa: entrada, interceptación o balón ganado
              por presión directa, con el balón en juego. No cuentan los rechaces sin disputa,
              los despejes del rival, las paradas del portero, lo que nace de balón parado ni
              los cambios de posesión por falta pitada. El criterio completo está en
              ANALISIS TRANSICIONES/MANUAL_ETIQUETADO.md.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
