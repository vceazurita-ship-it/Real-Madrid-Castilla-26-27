"use client";

/*
| PESTAÑA «OPTA» DE LA FICHA INDIVIDUAL (10/11/2026)
|
| Lo de Opta que la ficha no tenía, en un sitio. El percentil frente al puesto
| sigue en «Área de mejora» (OptaPuesto) y la curva de una métrica en
| «Tendencia» (OptaTendencia): aquí no se repiten, se enlazan.
|
| - Cabecera ligera: minutos, partidos, goles/xG, asistencias/xA (opta:jugadores).
| - Partido a partido, con titular o suplente (opta:jugadores-partidos,
|   ~1,6 MB) y su temporada por 90′ frente a la mediana de su familia.
| - Sus remates (opta:remates, ~3 MB), en el campo (opta:castilla-eventos,
|   ~3 MB) y temporada a temporada (opta:hist:*): cada uno se pide SÓLO al
|   abrir su bloque, y se queda en memoria para la pestaña del navegador.
|
| Si Opta no le tiene, no se pinta nada. Cuentas en `lib/opta-jugador.ts`.
*/

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";

import { Botonera, Cifra, Panel, fmt } from "@/app/opta/_piezas/comun";
import { useAcciones } from "@/app/opta/_piezas/eventos";
import { RematesJugador } from "@/app/opta/_piezas/Remates";
import { TemporadasJugador } from "@/app/opta/_piezas/Temporadas";
import type { DatosOpta } from "@/app/opta/_piezas/useOpta";
import { CampoOpta, SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { CASTILLA_OPTA, DOCS_OPTA, PUESTO_OPTA, aObjetos, num, type MetaOpta, type TablaOpta } from "@/lib/opta";
import { catalogoDe, familiaDe, fechaCorta, type Fila } from "@/lib/opta-analisis";
import { casaOpta } from "@/lib/opta-ficha";
import {
  ALTURAS_CAMPO,
  MINUTOS_REFERENCIA,
  MODOS_CAMPO,
  campoJugador,
  columnasDe,
  medianaFamilia,
  partidosJugador,
  suTemporada,
  valorEnPartido,
  type ModoCampo,
} from "@/lib/opta-jugador";
import { cortoMetrica, defMetrica, nombreMetrica } from "@/lib/opta-nombres";

const ORO = "var(--rmcf-gold-ink, #C8A96B)";

/** «2026-11-08 19:30:00» → «08/11/2026». */
const dia = (iso: string | undefined) => {
  const [a, m, d] = String(iso ?? "").slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "";
};
const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

/* ------------------------------------------------------------------ */
/*  UN BLOQUE QUE SE ABRE (y sólo entonces pide su documento)          */
/* ------------------------------------------------------------------ */

function Bloque({ titulo, detalle, abierto: inicial = false, children }: { titulo: string; detalle: string; abierto?: boolean; children: ReactNode }) {
  const [abierto, setAbierto] = useState(inicial);
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className="flex w-full min-w-0 items-start gap-2 px-4 py-3 text-left sm:px-5"
      >
        {abierto ? <ChevronDown size={16} className="mt-0.5 shrink-0 text-white/55" aria-hidden /> : <ChevronRight size={16} className="mt-0.5 shrink-0 text-white/55" aria-hidden />}
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">{titulo}</span>
          <span className="block text-[12px] text-white/55">{detalle}</span>
        </span>
      </button>
      {abierto && <div className="min-w-0 px-4 pb-4 sm:px-5">{children}</div>}
    </section>
  );
}

const Cargando = ({ que }: { que: string }) => <div className="h-40 animate-pulse rounded-xl bg-white/[0.05]" role="status" aria-label={`Cargando ${que}`} />;

/* ------------------------------------------------------------------ */
/*  PARTIDO A PARTIDO                                                  */
/* ------------------------------------------------------------------ */

function PartidoAPartido({ datos, yo }: { datos: DatosOpta; yo: Fila }) {
  const { docs, cargando } = useDocsOpta<[TablaOpta]>(DOCS_OPTA.jugadoresPartidos);
  const id = String(yo.playerId ?? "");
  const [tJugadoresPartidos] = docs;
  const filasGs = useMemo(() => (tJugadoresPartidos ? aObjetos(tJugadoresPartidos) : null), [tJugadoresPartidos]);
  const partidos = useMemo(() => partidosJugador(datos.castillaPartidos, id, filasGs), [datos.castillaPartidos, id, filasGs]);
  const familia = familiaDe(yo);
  const cols = columnasDe(familia);
  const minutos = num(yo.Min) ?? 0;
  const comparable = minutos >= MINUTOS_REFERENCIA;
  /* ~1.000 filas × 8 columnas: barato, sin memo (el compilador de React no puede conservarlo con una fila mutable). */
  const referencias = cols.map((a) => medianaFamilia(datos.jugadores, yo, a));

  if (cargando) return <Cargando que="el partido a partido" />;
  if (!partidos.length) return null;

  const conGs = partidos.filter((p) => p.titular != null);
  const titular = conGs.filter((p) => p.titular).length;
  const n = referencias.find(Boolean)?.n ?? 0;
  const unidad = (a: string) => defMetrica(a, datos.catalogo).unidad;

  return (
    <div className="min-w-0">
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        {conGs.length === partidos.length && (
          <Cifra rotulo="Titular" valor={`${titular} de ${partidos.length}`} detalle={partidos.length - titular ? `${partidos.length - titular} desde el banquillo` : "en todos los que jugó"} />
        )}
        <Cifra rotulo="Minutos por partido" valor={coma(partidos.reduce((s, p) => s + p.min, 0) / partidos.length, 0)} detalle={`${minutos}′ en ${partidos.length} partidos`} />
        {conGs.length === partidos.length && titular > 0 && (
          <Cifra rotulo="Minutos de titular" valor={coma(conGs.filter((p) => p.titular).reduce((s, p) => s + p.min, 0) / titular, 0)} detalle="de media cuando sale de inicio" />
        )}
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[560px] text-left text-[12px] tabular-nums">
          <thead>
            <tr className="border-b border-white/10 text-[11px] text-white/55">
              <th className="py-1.5 pr-3 font-semibold">Partido</th>
              <th className="py-1.5 pr-3 font-semibold" title="Titular o suplente">T/S</th>
              <th className="py-1.5 pr-3 text-right font-semibold">Min</th>
              {cols.map((a) => (
                <th key={a} className="py-1.5 pr-3 text-right font-semibold" title={nombreMetrica(a, datos.catalogo)}>
                  {cortoMetrica(a, datos.catalogo)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {partidos.map((p) => (
              <tr key={p.partido} className="border-b border-white/[0.06]">
                <td className="max-w-[11rem] truncate py-1.5 pr-3 text-white/80">
                  <span className="text-white/50">{fechaCorta(p.fecha)}</span> · {p.rival}
                </td>
                <td className="py-1.5 pr-3 text-white/70">{p.titular == null ? "" : p.titular ? "T" : "S"}</td>
                <td className="py-1.5 pr-3 text-right text-white/75">{p.min}</td>
                {cols.map((a) => (
                  <td key={a} className="py-1.5 pr-3 text-right text-white/80">
                    {fmt(valorEnPartido(p, a), unidad(a))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {comparable && (
            <tfoot>
              <tr className="border-t border-white/20 font-semibold">
                <td colSpan={3} className="py-1.5 pr-3 text-white/85">
                  Su temporada <span className="font-normal text-white/50">por 90′</span>
                </td>
                {cols.map((a) => (
                  <td key={a} className="py-1.5 pr-3 text-right" style={{ color: ORO }}>
                    {fmt(suTemporada(yo, a), unidad(a))}
                  </td>
                ))}
              </tr>
              {n > 0 && (
                <tr>
                  <td colSpan={3} className="py-1.5 pr-3 text-white/60">
                    Mediana de los {familia.toLowerCase()} <span className="text-white/45">por 90′</span>
                  </td>
                  {referencias.map((r, i) => (
                    <td key={cols[i]} className="py-1.5 pr-3 text-right text-white/60">
                      {r ? fmt(r.mediana, unidad(cols[i])) : ""}
                    </td>
                  ))}
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-white/45">
        Cada fila, lo que hizo en ese partido (los porcentajes, en ese partido).
        {comparable
          ? ` Abajo, su temporada por 90′ y la mediana por 90′ de los ${n} ${familia.toLowerCase()} de toda la categoría con ${MINUTOS_REFERENCIA}′ o más (los porcentajes, tal cual).`
          : ` Con ${minutos}′ aún no se compara por 90′: hacen falta ${MINUTOS_REFERENCIA}′.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EN EL CAMPO                                                        */
/* ------------------------------------------------------------------ */

function EnElCampo({ datos, yo }: { datos: DatosOpta; yo: Fila }) {
  const { acciones, cargando } = useAcciones(datos);
  const id = String(yo.playerId ?? "");
  const [elegido, setElegido] = useState<ModoCampo>("progresivos");
  const porModo = useMemo(() => MODOS_CAMPO.map((m) => ({ ...m, c: campoJugador(acciones, id, m.clave) })), [acciones, id]);
  const minutos = num(yo.Min) ?? 0;

  if (cargando) return <Cargando que="sus acciones en el campo" />;
  const disponibles = porModo.filter((m) => m.c.acciones.length > 0);
  if (!disponibles.length) return null;
  const visto = disponibles.find((m) => m.clave === elegido) ?? disponibles[0];
  const { c } = visto;
  const total = c.acciones.length;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Botonera etiqueta="Qué acciones" valor={visto.clave} alCambiar={setElegido} opciones={disponibles.map((m) => ({ clave: m.clave, nombre: m.nombre }))} />
      </div>
      <p className="mb-3 text-[12px] text-white/55">{visto.que}</p>
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <Cifra
          rotulo="En la temporada"
          valor={String(total)}
          detalle={
            minutos >= MINUTOS_REFERENCIA
              ? `${coma((total / minutos) * 90, 2)} por 90′`
              : `en ${c.partidos} partidos`
          }
        />
        {ALTURAS_CAMPO.map((h) => (
          <Cifra key={h.clave} rotulo={h.nombre} valor={String(c.porAltura[h.clave])} detalle={`${Math.round((c.porAltura[h.clave] / total) * 100)} % de las suyas`} />
        ))}
      </div>
      {visto.clave === "progresivos" && c.pases > 0 && (
        <p className="mb-2 text-[12px] text-white/60">
          {coma((total / c.pases) * 100)} de cada 100 pases suyos son progresivos ({c.pases} pases en el evento a evento, saques de banda incluidos).
        </p>
      )}
      <CampoOpta ariaLabel={`${visto.nombre} de ${String(yo.jugador ?? "")}`} maxAlto={420}>
        {(p) => (
          <>
            {[33.3, 66.7].map((x) => {
              const [x1, y1] = p(x, 0);
              const [x2, y2] = p(x, 100);
              return <line key={x} x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: "rgba(242,201,76,0.35)", strokeWidth: 2, strokeDasharray: "10 10" }} />;
            })}
            {visto.clave === "progresivos" && (
              <defs>
                <marker id="punta-ficha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: SOBRE_CESPED.nuestro }} />
                </marker>
              </defs>
            )}
            {c.acciones.map((a, i) => {
              const titulo = `${fechaCorta(a.fecha)} · ${a.rival} · ${a.minuto}′${a.receptor && visto.clave === "progresivos" ? ` → ${a.receptor}` : ""}`;
              if (visto.clave === "progresivos" && a.finX != null && a.finY != null) {
                const [x1, y1] = p(a.x, a.y);
                const [x2, y2] = p(a.finX, a.finY);
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    markerEnd="url(#punta-ficha)"
                    style={{ stroke: a.ocasion ? "#FFFFFF" : SOBRE_CESPED.nuestro, strokeOpacity: 0.7, strokeWidth: a.ocasion ? 4 : 3 }}
                  >
                    <title>{`${titulo}${a.ocasion ? " · acaba en ocasión" : ""}`}</title>
                  </line>
                );
              }
              const [cx, cy] = p(a.x, a.y);
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={11}
                  style={{ fill: visto.clave === "defensivas" ? SOBRE_CESPED.verde : SOBRE_CESPED.rival, fillOpacity: 0.75, stroke: "rgba(0,0,0,0.4)", strokeWidth: 1.5 }}
                >
                  <title>{titulo}</title>
                </circle>
              );
            })}
          </>
        )}
      </CampoOpta>
      <p className="mt-1.5 text-[11px] text-white/45">Atacando siempre hacia la derecha. Las rayas parten el campo en tres tercios iguales: primer tercio, tercio medio y último tercio.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TEMPORADA A TEMPORADA                                              */
/* ------------------------------------------------------------------ */

function Temporadas({ datos, yo }: { datos: DatosOpta; yo: Fila }) {
  /* Las mismas claves que pide TemporadasJugador: se comparten en memoria. */
  const indice = useDocsOpta<[{ temporadas?: { clave: string; actual?: boolean }[] }]>("opta:temporadas");
  const pasadas = useMemo(() => {
    const xs = (indice.docs[0]?.temporadas ?? []).filter((t) => !t.actual).map((t) => t.clave);
    return xs.length ? xs : ["2025-2026", "2024-2025"];
  }, [indice.docs]);
  const hist = useDocsOpta<TablaOpta[]>(...pasadas.map((t) => `opta:hist:${t}:jugadores`));
  const id = String(yo.playerId ?? "");
  const sale = hist.docs.some((t) => aObjetos(t as TablaOpta | null).some((f) => f.playerId === id));

  if (indice.cargando || hist.cargando) return <Cargando que="sus temporadas pasadas" />;
  if (!sale) return <p className="text-[12px] text-white/55">Opta no le tiene en las temporadas pasadas que hay descargadas (25/26 sólo trae el grupo del Castilla; 24/25, el grupo 1).</p>;
  return <TemporadasJugador datos={datos} playerId={id} minimo={MINUTOS_REFERENCIA} />;
}

/* ------------------------------------------------------------------ */
/*  LA PESTAÑA                                                         */
/* ------------------------------------------------------------------ */

export function OptaFicha({ nombre, apodo, alIr }: { nombre: string; apodo?: string; alIr?: (pestana: "mejora" | "tendencia") => void }) {
  const { docs, cargando } = useDocsOpta<[MetaOpta, TablaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.meta, DOCS_OPTA.jugadores, DOCS_OPTA.castilla, DOCS_OPTA.castillaPartidos);
  const [meta, tJugadores, tCastilla, tCastillaPartidos] = docs;

  const datos = useMemo<DatosOpta>(
    () => ({
      meta,
      catalogo: catalogoDe(meta),
      equipos: [],
      partidos: [],
      jugadores: aObjetos(tJugadores),
      castilla: aObjetos(tCastilla),
      castillaPartidos: aObjetos(tCastillaPartidos),
      grupos: new Map(),
    }),
    [meta, tJugadores, tCastilla, tCastillaPartidos],
  );
  const yo = useMemo(() => casaOpta(nombre, apodo, datos.jugadores.filter((f) => f.teamId === CASTILLA_OPTA)), [nombre, apodo, datos.jugadores]);

  if (cargando) return <Cargando que="los datos de Opta" />;
  if (!yo || !(num(yo.Min) ?? 0)) return null;

  const minutos = num(yo.Min) ?? 0;
  const esPortero = familiaDe(yo) === "Porteros";
  const hasta = dia(meta?.temporada?.ultimoPartido);
  const fuente = `Fuente: Opta${hasta ? ` · hasta el partido del ${hasta}` : ""}`;
  const remates = num(yo.ShtIncBl) ?? 0;
  const cifras = esPortero
    ? [
        { rotulo: "Paradas", valor: num(yo.Saves), detalle: "" },
        { rotulo: "Goles encajados", valor: num(yo.GAg), detalle: num(yo.ExpGAg) != null ? `xG en contra ${coma(num(yo.ExpGAg) ?? 0)}` : "" },
      ]
    : [
        { rotulo: "Goles", valor: num(yo.Goal), detalle: num(yo.ExpG) != null ? `xG ${coma(num(yo.ExpG) ?? 0, 2)}` : "" },
        { rotulo: "Asistencias", valor: num(yo.Ast), detalle: num(yo.xA) != null ? `xA ${coma(num(yo.xA) ?? 0, 2)}` : "" },
      ];

  return (
    <div className="min-w-0 space-y-4">
      <Panel
        titulo={
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span>Opta · {String(yo.jugador ?? "")}</span>
            <span className="text-sm font-normal text-white/55">{[PUESTO_OPTA[String(yo.puesto ?? "")] ?? "", "Primera RFEF"].filter(Boolean).join(" · ")}</span>
          </span>
        }
        subtitulo={`${fuente}. Liga, esta temporada.`}
        derecha={
          <Link
            href="/opta?pestana=jugadores"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:text-white"
          >
            Más en el área Opta <ArrowUpRight size={12} aria-hidden />
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cifra rotulo="Minutos" valor={String(minutos)} detalle={num(yo.GM) ? `${num(yo.GM)} partidos` : ""} />
          {cifras
            .filter((c) => c.valor != null)
            .map((c) => (
              <Cifra key={c.rotulo} rotulo={c.rotulo} valor={String(c.valor)} detalle={c.detalle || undefined} />
            ))}
          {!esPortero && remates > 0 && <Cifra rotulo="Remates" valor={String(remates)} detalle={num(yo.SOG) != null ? `${num(yo.SOG)} a puerta` : undefined} />}
        </div>
        {alIr && (
          <p className="mt-3 text-[12px] text-white/55">
            Su percentil frente a los de su puesto está en{" "}
            <button type="button" onClick={() => alIr("mejora")} className="font-semibold underline underline-offset-2" style={{ color: ORO }}>
              Área de mejora
            </button>
            ; la curva de cada métrica partido a partido, en{" "}
            <button type="button" onClick={() => alIr("tendencia")} className="font-semibold underline underline-offset-2" style={{ color: ORO }}>
              Tendencia
            </button>
            .
          </p>
        )}
      </Panel>

      <Bloque titulo="Partido a partido" detalle="Titular o suplente, sus minutos y lo principal de su puesto en cada partido; abajo, su temporada frente a la mediana de su puesto." abierto>
        <PartidoAPartido datos={datos} yo={yo} />
      </Bloque>

      {!esPortero && remates > 0 && (
        <Bloque titulo="Sus remates" detalle={`Los ${remates} remates, uno a uno, con su xG. ${fuente}, evento a evento.`}>
          <RematesJugador datos={datos} jugador={yo} />
        </Bloque>
      )}

      {!esPortero && (
        <Bloque titulo="En el campo" detalle={`Dónde hace sus pases progresivos, dónde corta y dónde pierde el balón. ${fuente}, evento a evento.`}>
          <EnElCampo datos={datos} yo={yo} />
        </Bloque>
      )}

      <Bloque titulo="Temporada a temporada" detalle="Si Opta le tiene en temporadas pasadas: equipo, minutos y lo principal, con su percentil en cada una.">
        <Temporadas datos={datos} yo={yo} />
      </Bloque>
    </div>
  );
}
