"use client";

/**
 * EL DIRECTO: las cifras de Opta de los partidos del día mientras se juegan.
 *
 * Las escribe `scripts/opta-directo.mjs` (GitHub Actions, se lanza desde
 * Ajustes): un índice `opta:directo` con los partidos del día y un documento
 * `opta:directo:<partido>` por partido. Aquí sólo se leen, cada minuto, y se
 * aguanta que falte cualquier cosa: sin índice, sin partido, sin cifras.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Radio, RefreshCw } from "lucide-react";

import { MEJOR, ORO, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA, DOCS_OPTA, aObjetos, num, traeOpta, type TablaOpta } from "@/lib/opta";
import { NOMBRE_CASTILLA, valorPartido, type Fila } from "@/lib/opta-analisis";
import { defMetrica, nombreMetrica } from "@/lib/opta-nombres";

import { minutoDe, tramosDe } from "@/lib/opta-directo-plan";
import { useAdmin } from "@/hooks/useAdmin";
import { indiceVivo, useDirectoOpta } from "@/hooks/useDirectoOpta";

import { Elegir, fmt, Panel } from "./comun";
import { DirectoPlan } from "./DirectoPlan";
import type { DatosOpta } from "./useOpta";

type PartidoIndice = { partido: string; fecha?: string; estado?: string; conDatos?: boolean; equipos?: string[]; goles?: (number | null)[]; xg?: (number | null)[] };
type Indice = { dia?: string; actualizado?: string; hasta?: string; partidos?: PartidoIndice[] };
type DocDirecto = {
  partido?: string;
  fecha?: string;
  local?: string;
  visitante?: string;
  minuto?: number | string;
  estado?: string;
  actualizado?: string;
  equipos?: TablaOpta;
  /** Tramos de 5' por equipo (desde el 12/11/2026). */
  tramos?: TablaOpta;
  /** Las cifras de la lectura anterior con cifras distintas. */
  anterior?: TablaOpta | null;
};

const CADA_MS = 60_000;
/** Recién lanzado desde la portada: se mira más a menudo hasta la primera lectura. */
const ESPERANDO_MS = 15_000;
/** Cuánto se espera la primera lectura antes de decir que algo va mal. */
const PLAZO_ARRANQUE_MS = 6 * 60_000;
const NO_METRICA = new Set(["partido", "teamId", "equipo"]);
const CASTILLA_NOMBRE_OPTA = "Real Madrid II";

const hora = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
};

const ESTADO: Record<string, string> = {
  played: "Terminado",
  fixture: "Por empezar",
  playing: "En juego",
  live: "En juego",
  postponed: "Aplazado",
};
const estadoEnPalabras = (e?: string) => (e ? (ESTADO[e.toLowerCase()] ?? e) : "");

const nombre = (f: Fila) => (f.teamId === CASTILLA_OPTA ? NOMBRE_CASTILLA : String(f.equipo ?? ""));

export function Directo({ datos }: { datos: DatosOpta }) {
  const { catalogo, partidos: filasTemporada } = datos;
  const [vuelta, setVuelta] = useState(0);
  const [indice, setIndice] = useState<Indice | null | undefined>(undefined);
  /* La hora de la última mirada (no Date.now() al pintar: regla de pureza). */
  const [ahora, setAhora] = useState(0);
  /* ?lanzado=<ms>: viene de «Empezar directo» en la portada. */
  const [lanzadoEn, setLanzadoEn] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = Number(new URLSearchParams(window.location.search).get("lanzado"));
    /* Sólo si es de hace menos de media hora: una recarga o un enlace guardado no da un aviso falso. */
    return Number.isFinite(v) && v > 0 && Date.now() - v < 30 * 60_000 ? v : null;
  });
  const { admin } = useAdmin();
  const lanzar = useDirectoOpta(Boolean(admin));
  const [elegido, setElegido] = useState("");
  const [leido, setLeido] = useState<{ clave: string; doc: DocDirecto | null } | null>(null);

  const vivo = indiceVivo(indice, ahora);
  /* Recién lanzado y aún sin una lectura posterior al lanzamiento. */
  const actualizadoMs = indice?.actualizado ? Date.parse(indice.actualizado) : NaN;
  const esperando =
    lanzadoEn != null && ahora > 0 && ahora - lanzadoEn < PLAZO_ARRANQUE_MS && !(Number.isFinite(actualizadoMs) && actualizadoMs >= lanzadoEn - 30_000);
  const tardando = lanzadoEn != null && ahora > 0 && ahora - lanzadoEn >= PLAZO_ARRANQUE_MS && !vivo;

  /* Cada minuto otra vuelta; cada 15 s mientras se espera la primera lectura. */
  useEffect(() => {
    const t = window.setInterval(() => setVuelta((n) => n + 1), esperando || lanzadoEn != null && ahora === 0 ? ESPERANDO_MS : CADA_MS);
    return () => window.clearInterval(t);
  }, [esperando, lanzadoEn, ahora]);

  useEffect(() => {
    let vivo = true;
    void traeOpta<Indice>("opta:directo").then((i) => {
      if (!vivo) return;
      setIndice(i);
      setAhora(Date.now());
    });
    return () => {
      vivo = false;
    };
  }, [vuelta]);

  const partidos = useMemo(() => (Array.isArray(indice?.partidos) ? indice!.partidos!.filter((p) => p?.partido) : []), [indice]);
  const delCastilla = partidos.find((p) => (p.equipos ?? []).some((e) => e === CASTILLA_NOMBRE_OPTA));
  const visto = (elegido && partidos.some((p) => p.partido === elegido) ? elegido : "") || delCastilla?.partido || partidos.find((p) => p.conDatos)?.partido || partidos[0]?.partido || "";

  useEffect(() => {
    if (!visto) return;
    let vivo = true;
    void traeOpta<DocDirecto>(DOCS_OPTA.directo(visto)).then((doc) => {
      if (vivo) setLeido({ clave: visto, doc });
    });
    return () => {
      vivo = false;
    };
  }, [visto, vuelta]);

  const doc = leido?.clave === visto ? leido.doc : null;
  const filas = useMemo(() => aObjetos(doc?.equipos ?? null), [doc]);
  /* El Castilla a la izquierda; si no juega, el local (o el primero). */
  const [a, b] = useMemo(() => {
    const ordenadas = [...filas].sort((x, y) => {
      if (x.teamId === CASTILLA_OPTA) return -1;
      if (y.teamId === CASTILLA_OPTA) return 1;
      if (doc?.local && x.equipo === doc.local) return -1;
      if (doc?.local && y.equipo === doc.local) return 1;
      return 0;
    });
    return [ordenadas[0] ?? null, ordenadas[1] ?? null];
  }, [filas, doc]);
  const metricas = doc?.equipos?.cols?.filter((c) => !NO_METRICA.has(c)) ?? [];
  const tramos = useMemo(() => (a ? tramosDe(doc?.tramos, String(a.teamId ?? "")) : []), [doc, a]);
  const minuto = num(doc?.minuto) ?? minutoDe(tramos);
  const antes = useMemo(() => aObjetos(doc?.anterior ?? null), [doc]);
  const marcador = useMemo(() => (a && b ? { nos: num(a.Goal) ?? 0, ellos: num(b.Goal) ?? 0 } : null), [a, b]);

  const explicacion = (
    <div className="space-y-2 text-sm text-white/65">
      <p>
        El directo se lanza con «Empezar directo» en la <Link href="/" className="font-semibold underline">portada</Link> (o aquí mismo, o en Ajustes): un proceso entra en Opta cada
        minuto y deja aquí las cifras de los partidos de Primera RFEF del día. Si juega el Castilla, se cruzan con el plan de partido.
      </p>
      <p className="text-xs text-white/50">Esta pestaña se pone al día sola cada minuto; no hace falta recargar.</p>
    </div>
  );

  if (indice === undefined) {
    return <p className="mt-6 text-sm text-white/55">Buscando partidos en directo…</p>;
  }

  const aviso = esperando ? (
    <div className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/[0.07] px-4 py-3" role="status">
      <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-white/90">Arrancando el directo…</p>
        <p className="text-xs text-white/60">GitHub tarda uno o dos minutos en entrar en Opta. Esta pantalla mira cada 15 segundos y las cifras salen solas: no hace falta tocar nada.</p>
      </div>
    </div>
  ) : tardando ? (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] px-4 py-3 text-sm" role="status">
      <p className="font-semibold text-white/90">El directo no ha dado señales en 6 minutos.</p>
      <p className="text-xs text-white/60">
        Mira la última pasada en <Link href="/ajustes" className="underline">Ajustes → Opta</Link>{lanzar.ultima?.enlace ? <> o <a href={lanzar.ultima.enlace} target="_blank" rel="noreferrer" className="underline">en GitHub</a></> : null}. Si falló, reinténtalo.
      </p>
      {admin && lanzar.preparado && (
        <button
          type="button"
          onClick={() => void lanzar.abre((en) => {
            setLanzadoEn(en);
            setVuelta((n) => n + 1);
          }, true)}
          disabled={lanzar.lanzando}
          className="mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-red-500 px-4 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
        >
          <Radio size={14} aria-hidden />
          {lanzar.lanzando ? "Lanzando…" : "Reintentar"}
        </button>
      )}
    </div>
  ) : null;

  const boton =
    admin && !vivo && !esperando && !lanzar.enMarcha && lanzar.preparado ? (
      <button
        type="button"
        onClick={() => void lanzar.abre((en) => {
          setLanzadoEn(en);
          setVuelta((n) => n + 1);
        })}
        disabled={lanzar.lanzando}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-red-500 px-5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
      >
        <Radio size={15} aria-hidden />
        {lanzar.lanzando ? "Lanzando…" : "Empezar directo"}
      </button>
    ) : null;

  return (
    <div className="mt-6 space-y-6">
      {aviso}
      <Panel
        titulo={
          <span className="inline-flex items-center gap-2">
            <Radio size={16} style={{ color: ORO }} />
            Directo
          </span>
        }
        subtitulo={
          indice?.actualizado
            ? `Última mirada a Opta a las ${hora(indice.actualizado)}${indice.hasta ? `; el proceso sigue hasta las ${hora(indice.hasta)}` : ""}.`
            : undefined
        }
        derecha={
          <>
            {partidos.length > 1 && (
              <Elegir
                etiqueta="Partido"
                valor={visto}
                alCambiar={setElegido}
                opciones={partidos.map((p) => ({
                  clave: p.partido,
                  nombre: (p.equipos?.length ? p.equipos.map((e) => (e === CASTILLA_NOMBRE_OPTA ? NOMBRE_CASTILLA : e)).join(" - ") : p.partido) + (p.conDatos ? "" : " (aún sin cifras)"),
                }))}
              />
            )}
            <button
              type="button"
              onClick={() => setVuelta((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 hover:text-white"
            >
              <RefreshCw size={12} />
              Mirar ahora
            </button>
          </>
        }
      >
        {/* La jornada de un vistazo (13/11/2026, tras los expertos): todos los partidos del día; se pulsa y se abre. */}
        {partidos.length > 1 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Partidos del día">
            {partidos.map((p) => {
              const eq = (p.equipos ?? []).map((e) => (e === CASTILLA_NOMBRE_OPTA ? NOMBRE_CASTILLA : e));
              const g = p.goles ?? [];
              const x = p.xg ?? [];
              const activo = p.partido === visto;
              return (
                <button
                  key={p.partido}
                  type="button"
                  role="listitem"
                  onClick={() => setElegido(p.partido)}
                  className={`shrink-0 rounded-xl border px-3 py-1.5 text-left text-xs ${activo ? "border-white/40 bg-white/[0.10] text-white" : "border-white/10 bg-white/[0.03] text-white/70 hover:text-white"}`}
                >
                  <span className="block font-semibold">
                    {eq.length === 2 ? `${eq[0]} ${g[0] ?? "–"}-${g[1] ?? "–"} ${eq[1]}` : p.partido}
                  </span>
                  <span className="block tabular-nums text-white/50">
                    {x.length === 2 && x[0] != null && x[1] != null ? `xG ${x[0].toFixed(2).replace(".", ",")}-${x[1].toFixed(2).replace(".", ",")}` : p.conDatos ? "" : "aún sin cifras"}
                    {/played|full/i.test(String(p.estado ?? "")) ? " · final" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {partidos.length === 0 || (!vivo && !esperando && !lanzar.corriendo && boton) ? (
          <>
            <p className="mb-2 text-sm font-semibold text-white/85">
              {partidos.length === 0 ? "Ahora mismo no hay ningún directo en marcha." : `No hay directo en marcha; abajo, el último${indice?.dia ? ` (${indice.dia})` : ""}.`}
            </p>
            {explicacion}
            {boton && <div className="mt-3">{boton}</div>}
          </>
        ) : null}
        {partidos.length === 0 ? null : !doc || !a || !b ? (
          <>
            <p className="mb-2 text-sm font-semibold text-white/85">
              {estadoEnPalabras(partidos.find((p) => p.partido === visto)?.estado) || "Partido del día"}: Opta todavía no ha publicado cifras de este partido.
            </p>
            <p className="text-xs text-white/50">
              Puede que Opta sólo las publique al acabar; en cuanto aparezcan, salen aquí solas.
            </p>
          </>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-lg font-semibold" style={a.teamId === CASTILLA_OPTA ? { color: ORO } : undefined}>
                  {nombre(a)}
                </p>
              </div>
              <div className="shrink-0 text-center">
                <p className="text-3xl font-semibold tabular-nums text-white">
                  {num(a.Goal) ?? 0} - {num(b.Goal) ?? 0}
                </p>
                <p className="text-[11px] text-white/55">
                  {[minuto != null ? `${num(doc.minuto) != null ? "" : "≈"}${minuto}′` : "", estadoEnPalabras(doc.estado), doc.actualizado ? `cifras de las ${hora(doc.actualizado)}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold" style={b.teamId === CASTILLA_OPTA ? { color: ORO } : undefined}>
                  {nombre(b)}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <DirectoPlan
                nos={a}
                ellos={b}
                antesNos={antes.find((f) => f.teamId === a.teamId) ?? null}
                antesEllos={antes.find((f) => f.teamId === b.teamId) ?? null}
                marcador={marcador}
                nombreNos={nombre(a)}
                nombreEllos={nombre(b)}
                esCastilla={a.teamId === CASTILLA_OPTA}
                minuto={minuto}
                tramos={tramos}
                partidos={filasTemporada}
                actualizado={doc.actualizado}
                ahora={ahora}
              />
            </div>

            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Todas las cifras</p>
            <div className="mx-auto max-w-3xl">
              {metricas
                .filter((k) => k !== "Goal")
                .map((k) => {
                  const def = defMetrica(k, catalogo);
                  const va = valorPartido(a, k, catalogo);
                  const vb = valorPartido(b, k, catalogo);
                  if (va == null && vb == null) return null;
                  const total = Math.abs(va ?? 0) + Math.abs(vb ?? 0);
                  const parteA = total > 0 ? (Math.abs(va ?? 0) / total) * 100 : 50;
                  /* Quién va mejor en esa cifra, si es de rendimiento. */
                  const ganaA = def.mejor === null || va == null || vb == null || va === vb ? null : def.mejor ? va > vb : va < vb;
                  return (
                    <div key={k} className="border-b border-white/[0.06] py-2 last:border-0">
                      <div className="flex items-baseline gap-2 text-[13px] tabular-nums">
                        <span className={`w-20 shrink-0 text-right ${ganaA === true ? "font-semibold text-white" : "text-white/70"}`}>{fmt(va, def.unidad)}</span>
                        <span className="min-w-0 flex-1 truncate text-center text-[12px] text-white/60">
                          {nombreMetrica(k, catalogo)}
                          {def.mejor === false && <span className="ml-1 text-[10px] text-white/40">(menos es mejor)</span>}
                        </span>
                        <span className={`w-20 shrink-0 ${ganaA === false ? "font-semibold text-white" : "text-white/70"}`}>{fmt(vb, def.unidad)}</span>
                      </div>
                      {total > 0 && (
                        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full" style={{ background: tinta(0.08) }}>
                          <span style={{ width: `${parteA}%`, background: a.teamId === CASTILLA_OPTA ? "#C8A96B" : ganaA === true ? MEJOR : tinta(0.4) }} />
                          <span style={{ width: `${100 - parteA}%`, background: b.teamId === CASTILLA_OPTA ? "#C8A96B" : ganaA === false ? MEJOR : tinta(0.25) }} />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </Panel>

      {partidos.length > 0 && <Panel titulo="Cómo funciona">{explicacion}</Panel>}
    </div>
  );
}
