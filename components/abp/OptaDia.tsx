"use client";

/*
| OPTA EN EL BALÓN PARADO Y EL SAQUE DE BANDA DEL DÍA A DÍA (10/11/2026)
|
| La pestaña «Categoría · Opta» de ABP ofensivo y defensivo y de saque de
| banda ofensivo y defensivo. Lo de arriba de esas pantallas es lo que apunta
| el analista; esto lo complementa con dos bloques:
|
| 1. El Castilla en la categoría: las cifras de equipo de Opta
|    (`opta:equipos`, ligero) con su puesto y su percentil en el grupo y en
|    Primera RFEF. Se pide al abrir la pestaña.
| 2. Cada saque de la temporada (`opta:abp-eventos`, ≈6,6 MB, y
|    `opta:remates`): plegado, y sólo se pide al desplegarlo. Mapa de dónde
|    caen, de los remates, lanzadores y rematadores; en banda, por altura.
|
| Las cuentas son las del laboratorio de ABP (lib/opta-abp.ts,
| lib/opta-eventos.ts) más lo de lib/opta-abp-dia.ts. Un porcentaje de menos
| de 20 saques no lleva puesto: se da como «3 de 15».
*/

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Database, FlaskConical, Map as MapaIcono } from "lucide-react";

import { CampoOpta, SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { ORDEN_ZONAS, zonaCaida } from "@/components/abp-lab/OptaAbpEventos";
import { Panel, Segmented } from "@/components/abp/ui";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { textoAbp } from "@/lib/opta-abp";
import {
  ALTURAS_BANDA,
  alturaBanda,
  contextoDia,
  deEquipo,
  hastaTexto,
  puestoSaques,
  rematadores,
  SITUACIONES_DE,
  type AreaDia,
  type LadoDia,
  type LineaDia,
  type PosicionDia,
} from "@/lib/opta-abp-dia";
import { esFaltaAlArea, lanzadores, pistaDe, rematesDe, resumenSaques, saquesDe, type Remate, type ResumenSaques, type Saque } from "@/lib/opta-eventos";

/** Con menos saques, un porcentaje se da en crudo («3 de 15») y sin puesto. */
const MUESTRA_PCT = 20;

const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const pct = (v: number | null | undefined) => (v == null ? "" : `${coma(v * 100)} %`);
const fechaCorta = (f: string) => (f.length >= 10 ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : "");

const MEJOR = "var(--rmcf-dif-mejor)";
const PEOR = "var(--rmcf-dif-peor)";
const MEDIO = "var(--rmcf-rate-mid)";
const NEUTRO = "rgb(var(--rmcf-ink-rgb) / 0.45)";
const colorDe = (p: number | null, juzgable: boolean) => (!juzgable || p == null ? NEUTRO : p >= 60 ? MEJOR : p > 40 ? MEDIO : PEOR);

const UNIDAD = { pp: "por partido", total: "en la temporada", pct: "" } as const;

/* ------------------------------------------------------------------ */
/*  Piezas                                                             */
/* ------------------------------------------------------------------ */

function Cargando({ texto, alto = "h-40" }: { texto: string; alto?: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <p className="text-[13px] text-white/60">{texto}</p>
      <div className={`${alto} animate-pulse rounded-2xl bg-white/[0.06]`} />
    </div>
  );
}

function Fuente({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11px] text-white/45">{children}</p>;
}

function AlLaboratorio() {
  return (
    <Link
      href="/laboratorio/abp?seccion=opta"
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/75 hover:text-white"
    >
      <FlaskConical size={13} aria-hidden /> Detalle en el Laboratorio de ABP
    </Link>
  );
}

function Pista({ pos, juzgable, rotulo }: { pos: PosicionDia; juzgable: boolean; rotulo: string }) {
  const color = colorDe(pos.p, juzgable);
  return (
    <div className="flex min-w-0 items-center gap-2 text-[11px]">
      <span className="w-[4.5rem] shrink-0 text-white/45">{rotulo}</span>
      <span className="relative block h-2 min-w-0 flex-1 rounded-full bg-white/10">
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-white/30" aria-hidden />
        {pos.p != null && <span className="absolute inset-y-0 rounded-full" style={{ left: `${Math.min(50, pos.p)}%`, width: `${Math.abs(pos.p - 50)}%`, background: color }} />}
      </span>
      <span className="w-12 shrink-0 text-right font-semibold tabular-nums" style={{ color }}>{`${pos.puesto}º/${pos.de}`}</span>
      <span className="w-9 shrink-0 text-right tabular-nums text-white/45">{pos.p == null ? "" : `P${pos.p}`}</span>
    </div>
  );
}

function Cifra({ rotulo, valor, detalle, tono }: { rotulo: string; valor: string; detalle?: ReactNode; tono?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{rotulo}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-white" style={tono ? { color: tono } : undefined}>
        {valor}
      </p>
      {detalle && <p className="mt-0.5 text-[11px] leading-snug text-white/55">{detalle}</p>}
    </div>
  );
}

function Punto({ color, children }: { color: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: "0 0 0 1px rgba(0,0,0,0.4)" }} />
      {children}
    </span>
  );
}

/** Un bloque pesado, plegado: no se pide nada hasta que se abre. */
function Plegado({ titulo, detalle, children }: { titulo: string; detalle: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="flex w-full min-w-0 items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] sm:px-5"
      >
        <MapaIcono size={16} className="shrink-0 text-[#C8A96B]" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">{titulo}</span>
          <span className="block text-[11px] text-white/50">{detalle}</span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-white/50 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {abierto && <div className="border-t border-white/10 p-4 sm:p-5">{children}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  1. El Castilla en la categoría (opta:equipos)                      */
/* ------------------------------------------------------------------ */

function ContextoOpta({ area, lado }: { area: AreaDia; lado: LadoDia }) {
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta]>(DOCS_OPTA.equipos, DOCS_OPTA.partidos);
  const [equiposT, partidosT] = docs;
  const ctx = useMemo(() => contextoDia(equiposT, partidosT, area, lado), [equiposT, partidosT, area, lado]);
  const [abierta, setAbierta] = useState("");

  if (cargando) return <Cargando texto="Leyendo los datos de Opta de la categoría…" />;
  if (!ctx || !ctx.lineas.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
        Los datos de Opta llegan con la descarga de los lunes (o el botón «Opta» de Ajustes).
      </p>
    );
  }

  const juzgable = (l: LineaDia) => l.m.mejorAlto !== null && !l.pocos;
  const pos = (l: LineaDia) => l.grupo ?? l.categoria;
  const orden = ctx.lineas.filter((l) => juzgable(l) && pos(l).p != null).sort((a, b) => (pos(b).p ?? 0) - (pos(a).p ?? 0));
  const mejor = orden[0];
  const peor = orden.at(-1);
  const pobl = ctx.nGrupo ? "grupo" : "categoría";
  const quien = lado === "favor" ? "El Castilla" : "Lo que le hacen al Castilla";
  const hasta = hastaTexto(ctx.hasta);

  return (
    <Panel
      title={area === "abp" ? (lado === "favor" ? "Opta · nuestro balón parado en la categoría" : "Opta · el balón parado que nos hacen, en la categoría") : lado === "favor" ? "Opta · nuestros saques de banda en la categoría" : "Opta · los saques de banda del rival, en la categoría"}
      subtitle={`${quien} en ${ctx.partidos} partidos frente a ${ctx.nGrupo ? `los ${ctx.nGrupo} equipos de su grupo y ` : ""}los ${ctx.nTotal} de Primera RFEF. El puesto va del mejor al peor${lado === "contra" ? " (aquí, menos es mejor)" : ""}; en las de volumen, del que más al que menos.`}
      icon={Database}
      action={<AlLaboratorio />}
    >
      {mejor && peor && mejor !== peor && (
        <div className="mb-4 space-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[13px] leading-relaxed text-white/85">
          <p>
            <b style={{ color: MEJOR }}>Lo mejor:</b> {mejor.m.nombre.toLowerCase()}, {textoAbp(mejor.m, mejor.valor)}
            {mejor.m.modo === "pp" ? " por partido" : ""} ({pos(mejor).puesto}º de {pos(mejor).de} en su {pobl}).
          </p>
          <p>
            <b style={{ color: PEOR }}>Lo peor:</b> {peor.m.nombre.toLowerCase()}, {textoAbp(peor.m, peor.valor)}
            {peor.m.modo === "pp" ? " por partido" : ""} ({pos(peor).puesto}º de {pos(peor).de} en su {pobl}).
          </p>
        </div>
      )}

      <ul className="divide-y divide-white/[0.06]">
        {ctx.lineas.map((l) => {
          const abiertaEsta = abierta === l.m.clave;
          const estilo = l.m.mejorAlto === null;
          return (
            <li key={l.m.clave} className="min-w-0 py-2.5">
              <div className="flex min-w-0 items-baseline gap-2">
                <button
                  type="button"
                  onClick={() => setAbierta(abiertaEsta ? "" : l.m.clave)}
                  aria-expanded={abiertaEsta}
                  title="Pulsa para ver qué mide"
                  className="min-w-0 flex-1 truncate text-left text-[13px] text-white/85 underline decoration-dotted underline-offset-4 hover:text-white"
                >
                  {l.m.nombre}
                  {l.m.mejorAlto === false && <span className="ml-1.5 text-[10px] text-white/40">(menos es mejor)</span>}
                  {estilo && <span className="ml-1.5 text-[10px] text-white/40">(volumen)</span>}
                </button>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white">
                  {textoAbp(l.m, l.valor)}
                  <span className="ml-1 text-[10px] font-normal text-white/45">
                    {l.m.modo === "pct" && l.casos != null ? `de ${Math.round(l.casos)}` : UNIDAD[l.m.modo]}
                  </span>
                </span>
              </div>
              {l.pocos ? (
                <p className="mt-1 text-[11px] text-white/45">Muy pocos intentos para ponerlo en la tabla.</p>
              ) : (
                <div className="mt-1.5 space-y-1">
                  {l.grupo && <Pista pos={l.grupo} juzgable={juzgable(l)} rotulo="Su grupo" />}
                  <Pista pos={l.categoria} juzgable={juzgable(l)} rotulo="Categoría" />
                </div>
              )}
              {abiertaEsta && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
                  {l.m.comoLeer}
                  {l.grupo?.mediana != null ? ` Mediana del grupo: ${textoAbp(l.m, l.grupo.mediana)}.` : ""}
                  {l.categoria.mediana != null ? ` Mediana de la categoría: ${textoAbp(l.m, l.categoria.mediana)}.` : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <Fuente>
        Fuente: Opta{hasta ? ` · ${hasta}` : ""}.{area === "abp" ? " Goles en la temporada; el resto, por partido o en porcentaje." : ""}
      </Fuente>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Cada saque (opta:abp-eventos + opta:remates)                    */
/* ------------------------------------------------------------------ */

type DatosSaques = { saques: Saque[]; remates: Remate[]; equipos: string[]; cargando: boolean };

function useSaquesOpta(): DatosSaques {
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.abpEventos, DOCS_OPTA.remates, DOCS_OPTA.jugadores, DOCS_OPTA.castilla);
  const [abpT, rematesT, jugadoresT, castillaT] = docs;
  return useMemo(() => {
    const pista = pistaDe(aObjetos(jugadoresT), aObjetos(castillaT));
    const remates = rematesDe(rematesT, pista);
    const saques = saquesDe(abpT, remates, pista);
    const equipos = [...new Set(saques.map((s) => s.teamId).filter(Boolean))];
    return { saques, remates, equipos, cargando };
  }, [abpT, rematesT, jugadoresT, castillaT, cargando]);
}

/** Partidos del Castilla y el último, de todos sus saques (de los dos lados). */
function partidosCastilla(ss: Saque[]) {
  const suyos = ss.filter((s) => s.teamId === CASTILLA_OPTA || s.rivalId === CASTILLA_OPTA);
  return { n: new Set(suyos.map((s) => s.partido)).size, hasta: suyos.reduce((m, s) => (s.fecha > m ? s.fecha : m), "") };
}

/** «27,9 %» con su detalle, o «3 de 15» si hay pocos. */
function cifraPct(
  r: ResumenSaques,
  aciertos: number,
  valor: number | null,
  cat: number | null,
  puesto: PosicionDia | null,
): { valor: string; detalle: string; tono?: string } {
  if (r.n < MUESTRA_PCT) return { valor: `${aciertos} de ${r.n}`, detalle: "pocos saques para un porcentaje" };
  const partes = [`${aciertos} de ${r.n}`, cat != null ? `categoría ${pct(cat)}` : "", puesto ? `${puesto.puesto}º de ${puesto.de}` : ""].filter(Boolean);
  return { valor: pct(valor), detalle: partes.join(" · "), tono: puesto ? colorDe(puesto.p, true) : undefined };
}

function TablaLanzadores({ ss, lado, max = 8 }: { ss: Saque[]; lado: LadoDia; max?: number }) {
  const tabla = lanzadores(ss);
  if (!tabla.length) return null;
  const equipoDe = (n: string) => ss.find((s) => s.lanzador === n)?.equipo ?? "";
  return (
    <div className="min-w-0 overflow-x-auto">
      <h3 className="mb-1 text-[13px] font-semibold text-white">{lado === "favor" ? "Quién los saca" : "Quién nos los saca"}</h3>
      <table className="w-full min-w-[340px] text-left text-[12px] tabular-nums">
        <thead>
          <tr className="border-b border-white/10 text-[11px] text-white/50">
            <th className="py-1.5 pr-2 font-semibold">Lanzador</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Saques</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Llegan</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Remate</th>
            <th className="py-1.5 text-right font-semibold">xG</th>
          </tr>
        </thead>
        <tbody>
          {tabla.slice(0, max).map((l) => (
            <tr key={l.lanzador} className="border-b border-white/[0.06]">
              <td className="max-w-[170px] truncate py-1.5 pr-2 text-white/85">
                {l.lanzador}
                {lado === "contra" && <span className="ml-1 text-[10px] text-white/40">{equipoDe(l.lanzador)}</span>}
              </td>
              <td className="py-1.5 pr-2 text-right text-white/75">{l.n}</td>
              <td className="py-1.5 pr-2 text-right text-white/75">{l.completos}</td>
              <td className="py-1.5 pr-2 text-right text-white/75">{l.conRemate}</td>
              <td className="py-1.5 text-right text-white/75">{coma(l.xG, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- ABP: córners y faltas al área ---------------- */

type TipoAbp = "corner" | "falta";

function SaquesAbp({ lado }: { lado: LadoDia }) {
  const { saques, remates, equipos, cargando } = useSaquesOpta();
  const [tipo, setTipo] = useState<TipoAbp>("corner");

  if (cargando) return <Cargando texto="Leyendo cada córner y falta de la categoría…" alto="h-64" />;
  if (!saques.length) return null;

  const delTipo = saques.filter((s) => (tipo === "corner" ? s.abp === "corner" : esFaltaAlArea(s)));
  const nuestros = deEquipo(delTipo, CASTILLA_OPTA, lado);
  const r = resumenSaques(nuestros);
  const cat = resumenSaques(delTipo);
  const jugados = partidosCastilla(saques);
  const favor = lado === "favor";
  const puestoRemate = r.n >= MUESTRA_PCT ? puestoSaques(delTipo, equipos, lado, (x) => x.pctRemate, favor) : null;
  const remate = cifraPct(r, r.conRemate, r.pctRemate, cat.pctRemate, puestoRemate);
  const llegan = cifraPct(r, r.completos, r.pctCompleto, cat.pctCompleto, null);

  const zonas = ORDEN_ZONAS.map((z) => ({ z, ...resumenSaques(nuestros.filter((s) => zonaCaida(s) === z)) })).filter((z) => z.n > 0);
  const sit = SITUACIONES_DE[tipo];
  const susRemates = remates.filter((x) => sit.includes(x.situacion) && (favor ? x.teamId === CASTILLA_OPTA : x.rivalId === CASTILLA_OPTA));
  const tiradores = rematadores(susRemates);
  const nombreTipo = tipo === "corner" ? "córners" : "faltas al área";
  const hasta = hastaTexto(jugados.hasta);

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          ariaLabel="Qué saque"
          options={[
            { key: "corner", label: "Córners" },
            { key: "falta", label: "Faltas al área" },
          ]}
          value={tipo}
          onChange={setTipo}
        />
        <AlLaboratorio />
      </div>

      {r.n === 0 ? (
        <p className="text-sm text-white/60">{favor ? `El Castilla no ha sacado ${nombreTipo} esta temporada.` : `No le han sacado ${nombreTipo} al Castilla esta temporada.`}</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Cifra rotulo={favor ? "Saques" : "Nos sacan"} valor={String(r.n)} detalle={jugados.n ? `${coma(r.n / jugados.n, 2)} por partido en ${jugados.n} partidos` : undefined} />
            <Cifra rotulo={`Acaban en remate${favor ? "" : " suyo"}`} valor={remate.valor} detalle={remate.detalle} tono={remate.tono} />
            <Cifra rotulo="xG de la jugada" valor={coma(r.xG, 2)} detalle={`${r.goles} ${r.goles === 1 ? "gol" : "goles"} en la misma jugada`} />
            <Cifra rotulo={favor ? "Llegan a un compañero" : "Llegan a uno de los suyos"} valor={llegan.valor} detalle={llegan.detalle} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="mb-1 text-[13px] font-semibold text-white">Dónde caen</h3>
              <CampoOpta vertical mitad ariaLabel={`Dónde caen los ${nombreTipo} ${favor ? "del Castilla" : "que le sacan al Castilla"}`} maxAlto={420}>
                {(p) =>
                  nuestros.map((s, i) => {
                    const [x1, y1] = p(s.x, s.y);
                    const [x2, y2] = p(s.finX, s.finY);
                    const gol = s.remates.some((x) => x.gol);
                    const conRemate = s.remates.length > 0;
                    const color = gol ? SOBRE_CESPED.gol : conRemate ? SOBRE_CESPED.verde : s.completo ? "rgba(255,255,255,0.75)" : SOBRE_CESPED.rival;
                    return (
                      <g key={i}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: color, strokeOpacity: 0.16, strokeWidth: 2 }} />
                        <circle cx={x2} cy={y2} r={conRemate ? 10 : 7} style={{ fill: color, fillOpacity: conRemate ? 0.95 : 0.55, stroke: "rgba(0,0,0,0.4)", strokeWidth: 1.5 }}>
                          <title>{`${fechaCorta(s.fecha)} ${s.minuto}′ · ${s.lanzador}${s.receptor ? ` a ${s.receptor}` : ""} · ${favor ? `contra ${s.rival}` : s.equipo}`}</title>
                        </circle>
                      </g>
                    );
                  })
                }
              </CampoOpta>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/55">
                <Punto color={SOBRE_CESPED.gol}>Gol en la jugada</Punto>
                <Punto color={SOBRE_CESPED.verde}>Acaba en remate</Punto>
                <Punto color="rgba(255,255,255,0.75)">Llega a un compañero</Punto>
                <Punto color={SOBRE_CESPED.rival}>No llega</Punto>
              </p>
              <p className="mt-1 text-[11px] text-white/45">Visto desde quien saca{favor ? "" : " (el rival ataca hacia arriba: es nuestra área)"}.</p>
            </div>

            <div className="min-w-0 space-y-4">
              {zonas.length > 0 && (
                <div className="min-w-0 overflow-x-auto">
                  <h3 className="mb-1 text-[13px] font-semibold text-white">Por zona de caída</h3>
                  <table className="w-full min-w-[320px] text-left text-[12px] tabular-nums">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] text-white/50">
                        <th className="py-1.5 pr-2 font-semibold">Zona (desde el lado del saque)</th>
                        <th className="py-1.5 pr-2 text-right font-semibold">Saques</th>
                        <th className="py-1.5 pr-2 text-right font-semibold">Con remate</th>
                        <th className="py-1.5 text-right font-semibold">xG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zonas.map((z) => (
                        <tr key={z.z} className="border-b border-white/[0.06]">
                          <td className="py-1.5 pr-2 text-white/80">{z.z}</td>
                          <td className="py-1.5 pr-2 text-right text-white/75">{z.n}</td>
                          <td className="py-1.5 pr-2 text-right text-white/75">{z.conRemate}</td>
                          <td className="py-1.5 text-right text-white/75">{coma(z.xG, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <TablaLanzadores ss={nuestros} lado={lado} />
            </div>
          </div>
        </>
      )}

      {susRemates.length > 0 && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="mb-1 text-[13px] font-semibold text-white">
              {favor ? "Nuestros remates" : "Sus remates"} de {tipo === "corner" ? "córner" : "falta"}: {susRemates.length}
            </h3>
            <CampoOpta vertical mitad ariaLabel={`Remates de ${tipo === "corner" ? "córner" : "falta"} ${favor ? "del Castilla" : "contra el Castilla"}`} maxAlto={420}>
              {(p) =>
                susRemates.map((x, i) => {
                  const [cx, cy] = p(x.x, x.y);
                  const color = x.gol ? SOBRE_CESPED.gol : x.aPuerta ? SOBRE_CESPED.puerta : SOBRE_CESPED.fuera;
                  return (
                    <circle key={i} cx={cx} cy={cy} r={6 + Math.sqrt(x.xG) * 22} style={{ fill: color, fillOpacity: 0.8, stroke: "rgba(0,0,0,0.45)", strokeWidth: 1.5 }}>
                      <title>{`${fechaCorta(x.fecha)} ${x.minuto}′ · ${x.tirador} · xG ${coma(x.xG, 2)}${x.gol ? " · GOL" : ""}`}</title>
                    </circle>
                  );
                })
              }
            </CampoOpta>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/55">
              <Punto color={SOBRE_CESPED.gol}>Gol</Punto>
              <Punto color={SOBRE_CESPED.puerta}>A puerta</Punto>
              <Punto color={SOBRE_CESPED.fuera}>Fuera o bloqueado</Punto>
              <span>El tamaño es el xG.</span>
            </p>
            <p className="mt-1 text-[11px] text-white/45">
              Todos los remates que Opta marca como {tipo === "corner" ? "córner" : "falta (directa o en jugada)"}, también los de la segunda jugada.
            </p>
          </div>
          <div className="min-w-0 overflow-x-auto">
            <h3 className="mb-1 text-[13px] font-semibold text-white">{favor ? "Quién remata" : "Quién nos remata"}</h3>
            <table className="w-full min-w-[320px] text-left text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-white/50">
                  <th className="py-1.5 pr-2 font-semibold">Rematador</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Remates</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">De cabeza</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">A puerta</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Goles</th>
                  <th className="py-1.5 text-right font-semibold">xG</th>
                </tr>
              </thead>
              <tbody>
                {tiradores.slice(0, 8).map((t) => (
                  <tr key={`${t.tirador}|${t.equipo}`} className="border-b border-white/[0.06]">
                    <td className="max-w-[170px] truncate py-1.5 pr-2 text-white/85">
                      {t.tirador}
                      {!favor && <span className="ml-1 text-[10px] text-white/40">{t.equipo}</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{t.remates}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{t.cabeza}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{t.aPuerta}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{t.goles}</td>
                    <td className="py-1.5 text-right text-white/75">{coma(t.xG, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Fuente>
        Fuente: Opta{hasta ? ` · ${hasta}` : ""}. «Acaba en remate» es en la misma jugada (la secuencia de Opta, como su «córners que acaban en remate»).
        {tipo === "falta" ? " Faltas al área: sacadas en campo rival y que caen en el área." : ""}
      </Fuente>
    </div>
  );
}

/* ---------------- Saque de banda ---------------- */

function SaquesBanda({ lado }: { lado: LadoDia }) {
  const { saques, equipos, cargando } = useSaquesOpta();

  if (cargando) return <Cargando texto="Leyendo cada saque de banda de la categoría…" alto="h-64" />;
  if (!saques.length) return null;

  const banda = saques.filter((s) => s.abp === "banda");
  const nuestros = deEquipo(banda, CASTILLA_OPTA, lado);
  if (!nuestros.length) return null;
  const favor = lado === "favor";
  const r = resumenSaques(nuestros);
  const cat = resumenSaques(banda);
  const jugados = partidosCastilla(saques);
  const llegan = cifraPct(r, r.completos, r.pctCompleto, cat.pctCompleto, puestoSaques(banda, equipos, lado, (x) => x.pctCompleto, favor));
  const remate = cifraPct(r, r.conRemate, r.pctRemate, cat.pctRemate, puestoSaques(banda, equipos, lado, (x) => x.pctRemate, favor));
  const hasta = hastaTexto(jugados.hasta);

  const alturas = ALTURAS_BANDA.map((a) => {
    const suyos = nuestros.filter((s) => alturaBanda(s) === a.key);
    const deCat = banda.filter((s) => alturaBanda(s) === a.key);
    return { ...a, r: resumenSaques(suyos), cat: resumenSaques(deCat) };
  }).filter((a) => a.r.n > 0);

  /* Frente a la categoría en esa altura: verde si es mejor, naranja si peor. */
  const tonoFrente = (v: number | null, ref: number | null, n: number) => {
    if (v == null || ref == null || n < MUESTRA_PCT) return undefined;
    const mejor = favor ? v > ref : v < ref;
    return Math.abs(v - ref) < 0.01 ? undefined : mejor ? MEJOR : PEOR;
  };

  return (
    <div className="min-w-0">
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Cifra rotulo={favor ? "Saques de banda" : "Saques del rival"} valor={String(r.n)} detalle={jugados.n ? `${coma(r.n / jugados.n)} por partido en ${jugados.n} partidos` : undefined} />
        <Cifra rotulo={favor ? "Llegan a un compañero" : "Llegan a uno de los suyos"} valor={llegan.valor} detalle={llegan.detalle} tono={llegan.tono} />
        <Cifra rotulo={favor ? "Acaban en remate" : "Acaban en remate suyo"} valor={remate.valor} detalle={remate.detalle} tono={remate.tono} />
        <Cifra rotulo="xG de la jugada" valor={coma(r.xG, 2)} detalle={`${r.goles} ${r.goles === 1 ? "gol" : "goles"} en la misma jugada`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h3 className="mb-1 text-[13px] font-semibold text-white">Desde dónde se sacan</h3>
          <CampoOpta ariaLabel={`Saques de banda ${favor ? "del Castilla" : "del rival contra el Castilla"}`}>
            {(p) =>
              nuestros.map((s, i) => {
                const [x1, y1] = p(s.x, Math.min(101, Math.max(-1, s.y)));
                const [x2, y2] = p(s.finX, s.finY);
                const conRemate = s.remates.length > 0;
                const color = conRemate ? SOBRE_CESPED.verde : s.completo ? "rgba(255,255,255,0.75)" : SOBRE_CESPED.rival;
                return (
                  <g key={i}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: color, strokeOpacity: conRemate ? 0.6 : 0.14, strokeWidth: 2 }} />
                    <circle cx={x1} cy={y1} r={conRemate ? 10 : 6} style={{ fill: color, fillOpacity: conRemate ? 0.95 : 0.6, stroke: "rgba(0,0,0,0.4)", strokeWidth: 1.5 }}>
                      <title>{`${fechaCorta(s.fecha)} ${s.minuto}′ · ${s.lanzador}${s.receptor ? ` a ${s.receptor}` : ""} · ${favor ? `contra ${s.rival}` : s.equipo}`}</title>
                    </circle>
                  </g>
                );
              })
            }
          </CampoOpta>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/55">
            <Punto color={SOBRE_CESPED.verde}>Acaba en remate</Punto>
            <Punto color="rgba(255,255,255,0.75)">Llega a un compañero</Punto>
            <Punto color={SOBRE_CESPED.rival}>No llega</Punto>
          </p>
          <p className="mt-1 text-[11px] text-white/45">
            {favor ? "Atacamos hacia la derecha." : "El rival ataca hacia la derecha: nuestra portería es la de la derecha."} El punto es el saque; la línea, adónde va.
          </p>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="min-w-0 overflow-x-auto">
            <h3 className="mb-1 text-[13px] font-semibold text-white">Por altura del campo, frente a la categoría</h3>
            <table className="w-full min-w-[340px] text-left text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-white/50">
                  <th className="py-1.5 pr-2 font-semibold">Altura</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Saques</th>
                  <th className="py-1.5 pr-2 text-right font-semibold" title="Llegan a un compañero · la categoría en esa altura">Llegan (cat.)</th>
                  <th className="py-1.5 text-right font-semibold" title="Acaban en remate en la misma jugada · la categoría en esa altura">Remate (cat.)</th>
                </tr>
              </thead>
              <tbody>
                {alturas.map((a) => (
                  <tr key={a.key} className="border-b border-white/[0.06]" title={a.detalle}>
                    <td className="py-1.5 pr-2 text-white/80">{a.nombre}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{a.r.n}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">
                      <span style={{ color: tonoFrente(a.r.pctCompleto, a.cat.pctCompleto, a.r.n) }}>{a.r.n >= MUESTRA_PCT ? pct(a.r.pctCompleto) : `${a.r.completos} de ${a.r.n}`}</span>
                      <span className="ml-1 text-[10px] text-white/40">({pct(a.cat.pctCompleto)})</span>
                    </td>
                    <td className="py-1.5 text-right text-white/75" title={`${a.r.conRemate} de ${a.r.n}`}>
                      {/* Los remates son pocos: el porcentaje va sin color. */}
                      {a.r.n >= MUESTRA_PCT ? pct(a.r.pctRemate) : `${a.r.conRemate} de ${a.r.n}`}
                      <span className="ml-1 text-[10px] text-white/40">({pct(a.cat.pctRemate)})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-white/45">Entre paréntesis, la categoría entera en esa altura (vista desde quien saca). Los remates son pocos: se comparan, pero no se colorean.</p>
          </div>
          <TablaLanzadores ss={nuestros} lado={lado} max={6} />
        </div>
      </div>

      <Fuente>
        Fuente: Opta{hasta ? ` · ${hasta}` : ""}. «Acaba en remate» es en la misma jugada (la secuencia de Opta): también cuenta el remate que llega tras varios pases.
      </Fuente>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lo que montan las pantallas                                        */
/* ------------------------------------------------------------------ */

/** La pestaña «Categoría · Opta» de ABP ofensivo (favor) y defensivo (contra). */
export function OptaAbpDia({ lado }: { lado: LadoDia }) {
  return (
    <div className="space-y-5">
      <ContextoOpta area="abp" lado={lado} />
      <Plegado
        titulo={lado === "favor" ? "Cada córner y falta de la temporada" : "Cada córner y falta que nos han sacado"}
        detalle="Dónde caen, remates, lanzadores y rematadores, evento a evento. Se carga al abrirlo (≈6 MB)."
      >
        <SaquesAbp lado={lado} />
      </Plegado>
    </div>
  );
}

/** La pestaña «Categoría · Opta» de saque de banda ofensivo (favor) y defensivo (contra). */
export function OptaBandaDia({ lado }: { lado: LadoDia }) {
  return (
    <div className="space-y-5">
      <ContextoOpta area="banda" lado={lado} />
      <Plegado
        titulo={lado === "favor" ? "Cada saque de banda de la temporada" : "Cada saque de banda del rival"}
        detalle="Por altura del campo, si llega y si acaba en remate, frente a la categoría. Se carga al abrirlo (≈6 MB)."
      >
        <SaquesBanda lado={lado} />
      </Plegado>
    </div>
  );
}
