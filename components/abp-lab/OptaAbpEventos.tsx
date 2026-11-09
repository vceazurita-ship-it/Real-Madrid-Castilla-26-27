"use client";

/*
| LABORATORIO DE ABP · OPTA, CADA SAQUE (09/11/2026)
|
| El balón parado evento a evento de toda Primera RFEF (`opta:abp-eventos`):
| dónde cae cada córner (por lado y por rosca), cada falta colgada al área y
| cada saque de banda largo; quién los saca; y cuántos acaban en remate y con
| cuánto xG, atando el saque con el remate de su misma jugada en
| `opta:remates` (mismo partido y secuencia, como cuenta Opta sus
| «córners que acaban en remate»). La segunda jugada (rechace, segundo
| centro) se cuenta aparte.
|
| Para cualquier equipo: a favor (sus saques) y en contra (los de sus rivales
| en sus partidos). Abre con el Castilla; el próximo rival, a un clic.
| Las cuentas, en `lib/opta-eventos.ts`.
*/

import { useMemo, useState } from "react";
import { Crosshair } from "lucide-react";

import { CampoOpta, SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { Panel, Segmented } from "@/components/abp/ui";
import { useProximoRival } from "@/hooks/useAbpLigas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import {
  casaEquipo,
  enArea,
  esBandaLarga,
  esFaltaAlArea,
  esFaltaLateral,
  lanzadores,
  ladoSaque,
  pistaDe,
  rematesDe,
  resumenSaques,
  ROSCA,
  saquesDe,
  type Saque,
} from "@/lib/opta-eventos";

type Tipo = "corner" | "falta" | "banda";
type Lado = "favor" | "contra";
type Banda = "todas" | "derecha" | "izquierda";
type Rosca = "todas" | "Inswinger" | "Outswinger" | "Short";

const TIPOS: { key: Tipo; label: string }[] = [
  { key: "corner", label: "Córners" },
  { key: "falta", label: "Faltas al área" },
  { key: "banda", label: "Banda largo" },
];

const NOMBRE_CASTILLA = "Real Madrid Castilla";
const nombreDe = (id: string, n: string) => (id === CASTILLA_OPTA ? NOMBRE_CASTILLA : n);
const pct = (v: number | null | undefined) => (v == null ? "" : `${Math.round(v * 100)} %`);
const dec = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

const delTipo = (s: Saque, t: Tipo) => (t === "corner" ? s.abp === "corner" : t === "falta" ? esFaltaAlArea(s) : esBandaLarga(s));

/** Dónde cae, mirado desde el lado del saque: primer palo es el más cercano. */
function zonaCaida(s: Saque): string {
  if (s.abp === "corner" && s.rosca === "Short") return "En corto";
  if (!enArea(s.finX, s.finY)) return "Fuera del área";
  const cerca = s.y < 50 ? s.finY : 100 - s.finY;
  const zona = cerca < 45.2 ? "Primer palo" : cerca <= 54.8 ? "Al centro" : "Segundo palo";
  return s.finX >= 94.2 ? `${zona} (área chica)` : zona;
}
const ORDEN_ZONAS = ["Primer palo (área chica)", "Primer palo", "Al centro (área chica)", "Al centro", "Segundo palo (área chica)", "Segundo palo", "Fuera del área", "En corto"];

function Cifra({ rotulo, valor, detalle }: { rotulo: string; valor: string; detalle?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{rotulo}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">{valor}</p>
      {detalle && <p className="mt-0.5 text-[11px] text-white/50">{detalle}</p>}
    </div>
  );
}

export function OptaAbpEventos() {
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta, TablaOpta, TablaOpta]>(
    DOCS_OPTA.abpEventos,
    DOCS_OPTA.remates,
    DOCS_OPTA.jugadores,
    DOCS_OPTA.castilla,
    DOCS_OPTA.equipos,
  );
  const [abpT, rematesT, jugadoresT, castillaT, equiposT] = docs;

  const saques = useMemo(() => {
    const pista = pistaDe(aObjetos(jugadoresT), aObjetos(castillaT));
    return saquesDe(abpT, rematesDe(rematesT, pista), pista);
  }, [abpT, rematesT, jugadoresT, castillaT]);

  const equipos = useMemo(() => {
    const lista = aObjetos(equiposT).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: nombreDe(String(f.teamId ?? ""), String(f.equipo ?? "")) }));
    return lista.filter((e) => e.teamId).sort((a, b) => (a.teamId === CASTILLA_OPTA ? -1 : b.teamId === CASTILLA_OPTA ? 1 : a.equipo.localeCompare(b.equipo, "es")));
  }, [equiposT]);

  const proximo = useProximoRival();
  const idProximo = useMemo(() => (proximo ? casaEquipo(proximo, equipos) : null), [proximo, equipos]);

  const [teamId, setTeamId] = useState(CASTILLA_OPTA);
  const [lado, setLado] = useState<Lado>("favor");
  const [tipo, setTipo] = useState<Tipo>("corner");
  const [banda, setBanda] = useState<Banda>("todas");
  const [rosca, setRosca] = useState<Rosca>("todas");
  const [lanzador, setLanzador] = useState("");
  const [elegido, setElegido] = useState<Saque | null>(null);

  const deTipo = useMemo(() => saques.filter((s) => delTipo(s, tipo)), [saques, tipo]);
  const delEquipo = useMemo(() => deTipo.filter((s) => (lado === "favor" ? s.teamId === teamId : s.rivalId === teamId)), [deTipo, teamId, lado]);
  const filtrados = useMemo(
    () =>
      delEquipo.filter(
        (s) =>
          (banda === "todas" || ladoSaque(s) === banda) &&
          (tipo !== "corner" || rosca === "todas" || s.rosca === rosca) &&
          (!lanzador || s.lanzador === lanzador),
      ),
    [delEquipo, banda, rosca, tipo, lanzador],
  );

  if (cargando) {
    return (
      <div className="mt-4 space-y-3" role="status" aria-live="polite">
        <p className="text-[13px] text-white/60">Leyendo cada saque de balón parado de la categoría…</p>
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.06]" />
      </div>
    );
  }
  if (!saques.length) return null;

  const r = resumenSaques(filtrados);
  const categoria = resumenSaques(deTipo);
  const nombre = nombreDe(teamId, equipos.find((e) => e.teamId === teamId)?.equipo ?? "");
  const tabla = lanzadores(delEquipo.filter((s) => (banda === "todas" || ladoSaque(s) === banda) && (tipo !== "corner" || rosca === "todas" || s.rosca === rosca)));
  const zonas = ORDEN_ZONAS.map((z) => {
    const suyos = filtrados.filter((s) => zonaCaida(s) === z);
    return { z, ...resumenSaques(suyos) };
  }).filter((z) => z.n > 0);
  const visto = elegido && filtrados.includes(elegido) ? elegido : null;
  const lateral = tipo === "falta" ? filtrados.filter(esFaltaLateral).length : 0;

  const textoSaque = (s: Saque) =>
    [
      `${s.minuto}′`,
      s.lanzador,
      s.abp === "corner" && ROSCA[s.rosca] ? ROSCA[s.rosca].toLowerCase() : "",
      `desde la ${ladoSaque(s)}`,
      s.receptor ? `a ${s.receptor}` : s.completo ? "" : "no llega a nadie",
      s.remates.length ? `${s.remates.length} remate${s.remates.length > 1 ? "s" : ""}, xG ${dec(s.remates.reduce((a, x) => a + x.xG, 0))}${s.remates.some((x) => x.gol) ? ", GOL" : ""}` : "",
      `${s.fecha.slice(8, 10)}/${s.fecha.slice(5, 7)} ${nombreDe(s.teamId, s.equipo)} contra ${nombreDe(s.rivalId, s.rival)}`,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="mt-4">
      <Panel
        title="Opta · cada saque, uno a uno"
        subtitle={`${lado === "favor" ? `Los saques de ${nombre}` : `Los saques que le hacen a ${nombre}`} esta temporada. «Acaba en remate» es en la misma jugada (como lo cuenta Opta); la segunda jugada va aparte.`}
        icon={Crosshair}
        action={<Segmented ariaLabel="Qué saque" options={TIPOS} value={tipo} onChange={(t) => { setTipo(t); setLanzador(""); }} />}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex min-w-0 items-center gap-2 text-xs text-white/55">
            <span className="shrink-0">Equipo</span>
            <select
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                setLanzador("");
              }}
              className="min-w-0 max-w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white"
            >
              {equipos.map((e) => (
                <option key={e.teamId} value={e.teamId} className="bg-[#11161C]">
                  {e.equipo}
                </option>
              ))}
            </select>
          </label>
          {idProximo && idProximo !== teamId && (
            <button
              type="button"
              onClick={() => {
                setTeamId(idProximo);
                setLanzador("");
              }}
              className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/75 hover:text-white"
            >
              Próximo rival: {equipos.find((e) => e.teamId === idProximo)?.equipo}
            </button>
          )}
          <Segmented
            ariaLabel="A favor o en contra"
            options={[
              { key: "favor", label: "A favor" },
              { key: "contra", label: "En contra" },
            ]}
            value={lado}
            onChange={(l: Lado) => {
              setLado(l);
              setLanzador("");
            }}
          />
          <Segmented
            ariaLabel="Desde qué lado"
            options={[
              { key: "todas", label: "Los dos lados" },
              { key: "derecha", label: "Desde la derecha" },
              { key: "izquierda", label: "Desde la izquierda" },
            ]}
            value={banda}
            onChange={setBanda}
          />
          {tipo === "corner" && (
            <Segmented
              ariaLabel="Rosca"
              options={[
                { key: "todas", label: "Todos" },
                { key: "Inswinger", label: "Cerrados" },
                { key: "Outswinger", label: "Abiertos" },
                { key: "Short", label: "En corto" },
              ]}
              value={rosca}
              onChange={setRosca}
            />
          )}
          {lanzador && (
            <button type="button" onClick={() => setLanzador("")} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/75 hover:text-white">
              {lanzador} ✕
            </button>
          )}
        </div>

        {filtrados.length === 0 ? (
          <p className="text-sm text-white/60">Con estos filtros no queda ningún saque.</p>
        ) : (
          <>
            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Cifra rotulo="Saques" valor={String(r.n)} detalle={r.partidos ? `${dec(r.n / r.partidos, 1)} por partido${lateral ? ` · ${lateral} desde la banda` : ""}` : undefined} />
              <Cifra rotulo="Acaban en remate" valor={pct(r.pctRemate)} detalle={`${r.conRemate} de ${r.n} · categoría ${pct(categoria.pctRemate)}`} />
              <Cifra rotulo="xG de la jugada" valor={dec(r.xG)} detalle={r.n ? `${dec((r.xG / r.n) * 10)} cada 10 saques · categoría ${dec((categoria.xG / Math.max(1, categoria.n)) * 10)}` : undefined} />
              <Cifra rotulo="Con la segunda jugada" valor={`${r.rematesAccion} rem.`} detalle={`xG ${dec(r.xGAccion)} · ${r.golesAccion} ${r.golesAccion === 1 ? "gol" : "goles"}`} />
              <Cifra rotulo="Llegan a un compañero" valor={pct(r.pctCompleto)} detalle={`categoría ${pct(categoria.pctCompleto)}`} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <CampoOpta vertical mitad ariaLabel={`Dónde caen los saques ${lado === "favor" ? "de" : "contra"} ${nombre}`} maxAlto={460}>
                  {(p) =>
                    filtrados.map((s, i) => {
                      const [x1, y1] = p(s.x, s.y);
                      const [x2, y2] = p(s.finX, s.finY);
                      const gol = s.remates.some((x) => x.gol);
                      const remate = s.remates.length > 0;
                      const color = gol ? SOBRE_CESPED.gol : remate ? SOBRE_CESPED.verde : s.completo ? "rgba(255,255,255,0.75)" : SOBRE_CESPED.rival;
                      const marcado = visto === s;
                      return (
                        <g key={i} onClick={() => setElegido(marcado ? null : s)} style={{ cursor: "pointer" }}>
                          <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: color, strokeOpacity: marcado ? 0.9 : filtrados.length > 120 ? 0.08 : 0.18, strokeWidth: marcado ? 4 : 2 }} />
                          <circle cx={x2} cy={y2} r={marcado ? 13 : remate ? 10 : 7} style={{ fill: color, fillOpacity: remate || marcado ? 0.95 : 0.55, stroke: marcado ? "#FFFFFF" : "rgba(0,0,0,0.4)", strokeWidth: marcado ? 4 : 1.5 }}>
                            <title>{textoSaque(s)}</title>
                          </circle>
                        </g>
                      );
                    })
                  }
                </CampoOpta>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/55">
                  <Punto color={SOBRE_CESPED.gol}>Gol en la jugada</Punto>
                  <Punto color={SOBRE_CESPED.verde}>Acaba en remate</Punto>
                  <Punto color="rgb(var(--rmcf-ink-rgb) / 0.45)">Llega a un compañero</Punto>
                  <Punto color={SOBRE_CESPED.rival}>No llega</Punto>
                </p>
                {visto && <p className="mt-1 text-[12px] text-white/75">{textoSaque(visto)}</p>}
              </div>

              <div className="min-w-0 space-y-4">
                {zonas.length > 0 && (
                  <div className="overflow-x-auto">
                    <h3 className="mb-1 text-[13px] font-semibold text-white">Dónde caen</h3>
                    <table className="w-full min-w-[340px] text-left text-[12px] tabular-nums">
                      <thead>
                        <tr className="border-b border-white/10 text-[11px] text-white/50">
                          <th className="py-1.5 pr-2 font-semibold">Zona (desde el lado del saque)</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">Saques</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">%</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">Remate</th>
                          <th className="py-1.5 text-right font-semibold">xG</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zonas.map((z) => (
                          <tr key={z.z} className="border-b border-white/[0.06]">
                            <td className="py-1.5 pr-2 text-white/80">{z.z}</td>
                            <td className="py-1.5 pr-2 text-right text-white/75">{z.n}</td>
                            <td className="py-1.5 pr-2 text-right text-white/75">{pct(z.n / r.n)}</td>
                            <td className="py-1.5 pr-2 text-right text-white/75">{pct(z.pctRemate)}</td>
                            <td className="py-1.5 text-right text-white/75">{dec(z.xG)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {tabla.length > 0 && (
                  <div className="overflow-x-auto">
                    <h3 className="mb-1 text-[13px] font-semibold text-white">Quién los saca</h3>
                    <table className="w-full min-w-[380px] text-left text-[12px] tabular-nums">
                      <thead>
                        <tr className="border-b border-white/10 text-[11px] text-white/50">
                          <th className="py-1.5 pr-2 font-semibold">Lanzador</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">Saques</th>
                          <th className="py-1.5 pr-2 text-right font-semibold" title="Desde la derecha / desde la izquierda">Dcha/Izq</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">Llegan</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">Remate</th>
                          <th className="py-1.5 text-right font-semibold">xG</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabla.slice(0, 10).map((l) => (
                          <tr
                            key={l.lanzador}
                            onClick={() => setLanzador(lanzador === l.lanzador ? "" : l.lanzador)}
                            className={`cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04] ${lanzador === l.lanzador ? "bg-white/[0.06]" : ""}`}
                          >
                            <td className="max-w-[160px] truncate py-1.5 pr-2 text-white/85">
                              {l.lanzador}
                              {lado === "contra" && <span className="ml-1 text-[10px] text-white/40">{nombreDe(delEquipo.find((s) => s.lanzador === l.lanzador)?.teamId ?? "", delEquipo.find((s) => s.lanzador === l.lanzador)?.equipo ?? "")}</span>}
                            </td>
                            <td className="py-1.5 pr-2 text-right text-white/75">{l.n}</td>
                            <td className="py-1.5 pr-2 text-right text-white/75">{`${l.derecha}/${l.izquierda}`}</td>
                            <td className="py-1.5 pr-2 text-right text-white/75">{pct(l.pctCompleto)}</td>
                            <td className="py-1.5 pr-2 text-right text-white/75">{pct(l.pctRemate)}</td>
                            <td className="py-1.5 text-right text-white/75">{dec(l.xG)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function Punto({ color, children }: { color: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}
