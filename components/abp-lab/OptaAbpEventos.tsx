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
|
| 25/11/2026 («mucho más visual, con todos los escudos»): el equipo se elige
| también por su escudo; las cifras llevan su barra contra la categoría;
| «Dónde caen» y «Quién los saca» son barras en vez de tablas; y debajo, la
| categoría entera en ese mismo saque (con los mismos filtros de lado y
| rosca): la clasificación del % que acaba en remate y el cuadrante volumen
| frente a acierto, un escudo por equipo. Pinchar un escudo lo elige.
*/

import { useMemo, useState } from "react";
import { VideoOpta } from "@/components/opta/VideoOpta";
import { Crosshair } from "lucide-react";

import { CampoOpta, SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { Panel, Segmented } from "@/components/abp/ui";
import { COMPARADO, tinta, useEscudos } from "@/components/data/graficas";
import { CORAL, Cifra, Cuadrante, Escudo, LeyendaProtagonistas, ORO_MARCA, Ranking } from "@/components/abp-lab/visual";
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

/** Con menos saques, el % de un equipo no entra en la clasificación de la categoría. */
const SAQUES_MIN = 10;

const NOMBRE_CASTILLA = "Real Madrid Castilla";
const nombreDe = (id: string, n: string) => (id === CASTILLA_OPTA ? NOMBRE_CASTILLA : n);
const pct = (v: number | null | undefined) => (v == null ? "" : `${Math.round(v * 100)} %`);
const dec = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

const delTipo = (s: Saque, t: Tipo) => (t === "corner" ? s.abp === "corner" : t === "falta" ? esFaltaAlArea(s) : esBandaLarga(s));

/** Dónde cae, mirado desde el lado del saque: primer palo es el más cercano. */
export function zonaCaida(s: Saque): string {
  if (s.abp === "corner" && s.rosca === "Short") return "En corto";
  if (!enArea(s.finX, s.finY)) return "Fuera del área";
  const cerca = s.y < 50 ? s.finY : 100 - s.finY;
  const zona = cerca < 45.2 ? "Primer palo" : cerca <= 54.8 ? "Al centro" : "Segundo palo";
  return s.finX >= 94.2 ? `${zona} (área chica)` : zona;
}
export const ORDEN_ZONAS = ["Primer palo (área chica)", "Primer palo", "Al centro (área chica)", "Al centro", "Segundo palo (área chica)", "Segundo palo", "Fuera del área", "En corto"];

export function OptaAbpEventos() {
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta, TablaOpta, TablaOpta]>(
    DOCS_OPTA.abpEventos,
    DOCS_OPTA.remates,
    DOCS_OPTA.jugadores,
    DOCS_OPTA.castilla,
    DOCS_OPTA.equipos,
  );
  const [abpT, rematesT, jugadoresT, castillaT, equiposT] = docs;
  const escudoDe = useEscudos();

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

  /* La categoría entera en este saque, con los mismos filtros de lado y rosca (no el del lanzador). */
  const porEquipo = useMemo(() => {
    const deCategoria = deTipo.filter((s) => (banda === "todas" || ladoSaque(s) === banda) && (tipo !== "corner" || rosca === "todas" || s.rosca === rosca));
    const m = new Map<string, Saque[]>();
    for (const s of deCategoria) {
      const id = lado === "favor" ? s.teamId : s.rivalId;
      m.set(id, [...(m.get(id) ?? []), s]);
    }
    return equipos
      .map((e) => ({ ...e, r: resumenSaques(m.get(e.teamId) ?? []) }))
      .filter((e) => e.r.n > 0);
  }, [deTipo, banda, rosca, tipo, lado, equipos]);

  const elegir = (id: string) => {
    setTeamId(id);
    setLanzador("");
    setElegido(null);
  };

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
  const nombreProximo = idProximo ? equipos.find((e) => e.teamId === idProximo)?.equipo ?? "" : "";
  const tabla = lanzadores(delEquipo.filter((s) => (banda === "todas" || ladoSaque(s) === banda) && (tipo !== "corner" || rosca === "todas" || s.rosca === rosca)));
  const zonas = ORDEN_ZONAS.map((z) => {
    const suyos = filtrados.filter((s) => zonaCaida(s) === z);
    return { z, ...resumenSaques(suyos) };
  }).filter((z) => z.n > 0);
  const visto = elegido && filtrados.includes(elegido) ? elegido : null;
  const lateral = tipo === "falta" ? filtrados.filter(esFaltaLateral).length : 0;
  const acento = lado === "favor" ? ORO_MARCA : CORAL;
  const tipoTexto = TIPOS.find((t) => t.key === tipo)?.label.toLowerCase() ?? "";

  /* La categoría: el % que acaba en remate (con muestra) y el cuadrante volumen frente a acierto. */
  const conMuestra = porEquipo.filter((e) => e.r.n >= SAQUES_MIN && e.r.pctRemate != null && e.r.partidos > 0);
  const rankingRemate = conMuestra.map((e) => ({
    id: e.teamId,
    equipo: e.equipo,
    valor: e.r.pctRemate as number,
    texto: pct(e.r.pctRemate),
    escudo: escudoDe(e.equipo),
    nota: `${e.r.conRemate} de ${e.r.n} · xG ${dec(e.r.xG)}`,
  }));
  const puntosCategoria = conMuestra.map((e) => ({ id: e.teamId, equipo: e.equipo, x: e.r.n / e.r.partidos, y: (e.r.pctRemate as number) * 100, escudo: escudoDe(e.equipo) }));
  const sinMuestra = porEquipo.length - conMuestra.length;
  /* En contra, que acaben en remate es malo. */
  const remateMejorAlto = lado === "favor";

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

  const maxZona = Math.max(...zonas.map((z) => z.n), 1);
  const maxLanz = Math.max(...tabla.slice(0, 10).map((l) => l.n), 1);
  const xG10 = r.n ? (r.xG / r.n) * 10 : null;
  const xG10Cat = (categoria.xG / Math.max(1, categoria.n)) * 10;

  return (
    <div className="mt-4">
      <Panel
        title="Opta · cada saque, uno a uno"
        subtitle={`${lado === "favor" ? `Los saques de ${nombre}` : `Los saques que le hacen a ${nombre}`} esta temporada. «Acaba en remate» es en la misma jugada (como lo cuenta Opta); la segunda jugada va aparte.`}
        icon={Crosshair}
        action={<Segmented ariaLabel="Qué saque" options={TIPOS} value={tipo} onChange={(t) => { setTipo(t); setLanzador(""); }} />}
      >
        {/* ------------------------ EL EQUIPO ------------------------- */}
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-white/10 p-3" style={{ background: `linear-gradient(110deg, ${acento}24, transparent 65%)` }}>
          <Escudo src={escudoDe(nombre)} nombre={nombre} lado={44} />
          <div className="min-w-0 flex-1">
            <label className="block min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: lado === "favor" ? "var(--rmcf-gold-ink)" : CORAL }}>
                {lado === "favor" ? "A favor · sus saques" : "En contra · los que le sacan"}
              </span>
              <select
                value={teamId}
                onChange={(e) => elegir(e.target.value)}
                aria-label="Equipo"
                className="mt-0.5 w-full min-w-0 max-w-xs truncate rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[15px] font-semibold text-white"
              >
                {equipos.map((e) => (
                  <option key={e.teamId} value={e.teamId} className="bg-[#11161C]">
                    {e.equipo}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {teamId !== CASTILLA_OPTA && (
              <button type="button" onClick={() => elegir(CASTILLA_OPTA)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2 py-1 text-xs text-white/75 hover:text-white">
                <Escudo src={escudoDe(NOMBRE_CASTILLA)} nombre={NOMBRE_CASTILLA} lado={18} />
                Castilla
              </button>
            )}
            {idProximo && idProximo !== teamId && (
              <button
                type="button"
                onClick={() => elegir(idProximo)}
                className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/80 hover:text-white"
                style={{ background: `${COMPARADO}1F` }}
              >
                <Escudo src={escudoDe(nombreProximo)} nombre={nombreProximo} lado={18} />
                <span className="truncate">Próximo rival: {nombreProximo}</span>
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
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
            {/* ------------------------ LAS CIFRAS ------------------------ */}
            <div className="mb-4 grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-5">
              <Cifra rotulo="Saques" valor={String(r.n)} acento={acento} detalle={r.partidos ? `${dec(r.n / r.partidos, 1)} por partido${lateral ? ` · ${lateral} desde la banda` : ""}` : undefined} />
              <Cifra
                rotulo="Acaban en remate"
                valor={pct(r.pctRemate)}
                acento={acento}
                barra={r.pctRemate}
                referencia={categoria.pctRemate}
                color={acento}
                detalle={`${r.conRemate} de ${r.n} · categoría ${pct(categoria.pctRemate)}`}
              />
              <Cifra
                rotulo="xG de la jugada"
                valor={dec(r.xG)}
                acento={acento}
                barra={xG10 != null ? Math.min(1, xG10 / Math.max(xG10, xG10Cat * 2, 0.01)) : null}
                referencia={xG10 != null ? xG10Cat / Math.max(xG10, xG10Cat * 2, 0.01) : null}
                color={acento}
                detalle={r.n ? `${dec((r.xG / r.n) * 10)} cada 10 saques · categoría ${dec(xG10Cat)}` : undefined}
              />
              <Cifra rotulo="Con la segunda jugada" valor={`${r.rematesAccion} rem.`} acento={acento} detalle={`xG ${dec(r.xGAccion)} · ${r.golesAccion} ${r.golesAccion === 1 ? "gol" : "goles"}`} />
              <Cifra
                rotulo="Llegan a un compañero"
                valor={pct(r.pctCompleto)}
                acento={acento}
                barra={r.pctCompleto}
                referencia={categoria.pctCompleto}
                color={acento}
                detalle={`categoría ${pct(categoria.pctCompleto)}`}
              />
            </div>
            <p className="-mt-2 mb-4 flex items-center gap-1.5 text-[10.5px] text-white/45">
              <span aria-hidden className="inline-block h-3 w-[2px] rounded-full" style={{ background: tinta(0.6) }} />
              La raya de cada barra es la categoría.
            </p>

            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
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
                  <Punto color="rgba(255,255,255,0.75)">Llega a un compañero</Punto>
                  <Punto color={SOBRE_CESPED.rival}>No llega</Punto>
                </p>
                {visto && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-[12px] text-white/75">{textoSaque(visto)}</p>
                    <VideoOpta evento={visto} tipo="passes" descripcion={textoSaque(visto)} />
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-5">
                {/* ----------------------- DÓNDE CAEN ----------------------- */}
                {zonas.length > 0 && (
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold text-white">Dónde caen</h3>
                    <p className="mb-2 text-[11px] text-white/45">Desde el lado del saque. La barra, cuántos; a la derecha, qué parte acaba en remate y su xG.</p>
                    <div className="space-y-1.5">
                      {zonas.map((z) => (
                        <div key={z.z} className="min-w-0">
                          <div className="flex min-w-0 items-baseline gap-2 text-[12px]">
                            <span className="min-w-0 flex-1 truncate text-white/80">{z.z}</span>
                            <span className="shrink-0 tabular-nums text-white/55">
                              {z.n} · {pct(z.n / r.n)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex min-w-0 items-center gap-2">
                            <span className="relative h-2.5 min-w-0 flex-1 rounded-full" style={{ background: tinta(0.07) }}>
                              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(3, (z.n / maxZona) * 100)}%`, background: acento, opacity: 0.85 }} />
                              {z.conRemate > 0 && (
                                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, (z.conRemate / maxZona) * 100)}%`, background: SOBRE_CESPED.verde }} title={`${z.conRemate} acaban en remate`} />
                              )}
                            </span>
                            <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-white/60">
                              {pct(z.pctRemate)} rem. · xG {dec(z.xG)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 flex flex-wrap gap-x-3 text-[10.5px] text-white/45">
                      <Punto color={acento}>Saques</Punto>
                      <Punto color={SOBRE_CESPED.verde}>Acaban en remate</Punto>
                    </p>
                  </div>
                )}

                {/* --------------------- QUIÉN LOS SACA --------------------- */}
                {tabla.length > 0 && (
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold text-white">Quién los saca</h3>
                    <p className="mb-2 text-[11px] text-white/45">Pulsa uno para ver sólo los suyos. La barra partida, desde la derecha / desde la izquierda.</p>
                    <div className="space-y-1">
                      {tabla.slice(0, 10).map((l) => {
                        const suyo = lado === "contra" ? delEquipo.find((s) => s.lanzador === l.lanzador) : null;
                        const suEquipo = suyo ? nombreDe(suyo.teamId, suyo.equipo) : "";
                        const activo = lanzador === l.lanzador;
                        return (
                          <button
                            key={l.lanzador}
                            type="button"
                            onClick={() => setLanzador(activo ? "" : l.lanzador)}
                            aria-pressed={activo}
                            className={`block w-full min-w-0 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04] ${activo ? "bg-white/[0.06]" : ""}`}
                          >
                            <span className="flex min-w-0 items-center gap-2 text-[12px]">
                              {suEquipo && <Escudo src={escudoDe(suEquipo)} nombre={suEquipo} lado={16} />}
                              <span className="min-w-0 flex-1 truncate font-medium text-white/85">
                                {l.lanzador}
                                {suEquipo && <span className="ml-1 text-[10px] font-normal text-white/40">{suEquipo}</span>}
                              </span>
                              <span className="shrink-0 tabular-nums text-white">{l.n}</span>
                            </span>
                            <span className="mt-1 flex h-2 min-w-0 overflow-hidden rounded-full" style={{ background: tinta(0.07) }}>
                              <span className="flex h-full" style={{ width: `${Math.max(4, (l.n / maxLanz) * 100)}%` }}>
                                <span className="h-full" style={{ width: `${(l.derecha / Math.max(1, l.n)) * 100}%`, background: acento }} title={`${l.derecha} desde la derecha`} />
                                <span className="h-full" style={{ width: `${(l.izquierda / Math.max(1, l.n)) * 100}%`, background: acento, opacity: 0.45 }} title={`${l.izquierda} desde la izquierda`} />
                              </span>
                            </span>
                            <span className="mt-0.5 flex flex-wrap gap-x-2.5 text-[10.5px] tabular-nums text-white/55">
                              <span>Dcha/Izq {l.derecha}/{l.izquierda}</span>
                              <span>Llegan {pct(l.pctCompleto)}</span>
                              <span>Remate {pct(l.pctRemate)}</span>
                              <span>xG {dec(l.xG)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* -------------------- LA CATEGORÍA ENTERA -------------------- */}
        {conMuestra.length >= 3 && (
          <div className="mt-6 min-w-0 border-t border-white/10 pt-5">
            <h3 className="text-[14px] font-semibold text-white">
              La categoría en {tipoTexto}, {lado === "favor" ? "a favor" : "en contra"}
            </h3>
            <p className="mb-3 text-[11px] text-white/50">
              Los {conMuestra.length} equipos con al menos {SAQUES_MIN} saques{banda !== "todas" ? `, desde la ${banda}` : ""}
              {tipo === "corner" && rosca !== "todas" ? `, ${rosca === "Short" ? "en corto" : ROSCA[rosca]?.toLowerCase() ?? ""}` : ""}
              {lado === "contra" ? " (los que les sacan sus rivales)" : ""}. Pulsa un escudo para mirarlo arriba.
            </p>
            <div className="grid min-w-0 gap-5 xl:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-2 text-[12px] font-semibold text-white/80">Qué parte acaba en remate</p>
                <Ranking
                  filas={rankingRemate}
                  mejorAlto={remateMejorAlto}
                  nuestro={CASTILLA_OPTA}
                  rival={idProximo}
                  elegido={teamId}
                  alPulsar={elegir}
                  tope={14}
                  pie={sinMuestra > 0 ? <span>Sin los {sinMuestra} de menos de {SAQUES_MIN} saques</span> : undefined}
                />
              </div>
              <div className="min-w-0">
                <p className="mb-2 text-[12px] font-semibold text-white/80">Cuántos saca y cuántos acaban en remate</p>
                <Cuadrante
                  puntos={puntosCategoria}
                  etiquetaX="Saques por partido"
                  etiquetaY="% que acaba en remate"
                  textoX={(v) => dec(v, 1)}
                  textoY={(v) => `${Math.round(v)} %`}
                  xMejorAlto={null}
                  yMejorAlto={remateMejorAlto}
                  nuestro={CASTILLA_OPTA}
                  rival={idProximo}
                  elegido={teamId}
                  alPulsar={elegir}
                />
                <LeyendaProtagonistas nuestro={NOMBRE_CASTILLA} rival={nombreProximo || undefined} elegido={teamId !== CASTILLA_OPTA && teamId !== idProximo ? nombre : undefined} />
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Punto({ color, children }: { color: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {/* Con filo oscuro: el punto blanco del campo (llega a un compañero) también se ve en modo día. */}
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: "0 0 0 1px rgba(0,0,0,0.4)" }} />
      {children}
    </span>
  );
}
