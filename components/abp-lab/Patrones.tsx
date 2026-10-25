"use client";

/**
 * PATRONES QUE MÁS RINDEN (laboratorio de ABP, 25/10/2026).
 *
 * Todas las acciones a balón parado con remate de la temporada, agrupadas por
 * tipo + lado del saque + zona de caída (`lib/abp-lab/patrones.ts`), con un
 * ranking que exige una muestra mínima. Wyscout no da el pie ni la forma del
 * envío (cerrado, abierto, raso): no entran. Al pulsar un patrón salen sus
 * acciones, con el partido y el minuto para buscarlas en Wyscout, y su dibujo.
 */

import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";

import { Notice } from "@/components/abp/ui";
import type { JugadorLab } from "@/components/abp-lab/comun";
import { ClipAccion } from "@/components/abp-lab/ClipAccion";
import { MiniPizarra } from "@/components/abp-lab/PizarraRutina";
import { borradorVacio, type Borrador } from "@/components/abp-lab/Taller";
import { useAbpTodas } from "@/hooks/useAbpAcciones";
import { RESULTADO_ACCION, xgTexto, type Accion } from "@/lib/abp-lab/acciones";
import {
  TIPOS_PATRON,
  TIPO_PATRON_TEXTO,
  agrupa,
  dibujoDePatron,
  expande,
  golesPorAccion,
  nombrePatron,
  ordenadas,
  pctPuerta,
  ranking,
  xgPorAccion,
  type Orden,
  type Patron,
  type TipoPatron,
} from "@/lib/abp-lab/patrones";

const SIN_JUGADORES = new Map<string, JugadorLab>();

const ORDENES: { k: Orden; etiqueta: string }[] = [
  { k: "goles", etiqueta: "Goles / acción" },
  { k: "xg", etiqueta: "xG / acción" },
  { k: "puerta", etiqueta: "% a puerta" },
];

const MUESTRAS = [5, 8, 12, 20];

const TONO_RESULTADO: Record<Accion["r"], string> = {
  gol: "bg-emerald-400/15 text-emerald-300",
  puerta: "bg-sky-400/15 text-sky-300",
  palo: "bg-amber-400/15 text-amber-300",
  bloqueado: "bg-white/10 text-white/60",
  fuera: "bg-white/10 text-white/60",
};

const pct = (v: number) => `${Math.round(v * 100)} %`;

const dec = (v: number) => v.toFixed(2).replace(".", ",");

const CHIP = "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition";

const chipClase = (activo: boolean) =>
  `${CHIP} ${activo ? "border-[#C8A96B]/60 bg-[#C8A96B]/10 text-[#C8A96B]" : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"}`;

function Detalle({ patron, onAlTaller }: { patron: Patron; onAlTaller: (b: Borrador) => void }) {
  const dibujo = useMemo(() => dibujoDePatron(patron), [patron]);

  const lista = useMemo(() => ordenadas(patron), [patron]);

  const [todas, setTodas] = useState(false);

  const visibles = todas ? lista : lista.slice(0, 12);

  const alTaller = () =>
    onAlTaller({
      ...borradorVacio(),
      nombre: nombrePatron(patron).slice(0, 80),
      tipo: dibujo.tipo,
      idea: `${nombrePatron(patron)}. ${patron.n} acciones con remate esta temporada: ${patron.goles} ${patron.goles === 1 ? "gol" : "goles"}, ${pct(pctPuerta(patron))} a puerta, xG por acción ${dec(xgPorAccion(patron))}.`,
      roles: dibujo.roles,
      balon: dibujo.balon,
    });

  return (
    <div className="min-w-0 space-y-3 rounded-2xl border border-[#C8A96B]/30 bg-white/[0.03] p-3.5">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <MiniPizarra rutina={{ nombre: dibujo.nombre, senal: "", tipo: dibujo.tipo, lado: "ofensivo", contra: "cualquiera", roles: dibujo.roles, balon: dibujo.balon }} porId={SIN_JUGADORES} />
        </div>

        <div className="min-w-0 space-y-2">
          <h3 className="break-words text-sm font-semibold text-white/90">{nombrePatron(patron)}</h3>
          <p className="text-[12px] text-white/55">El dibujo es la media de las {patron.n} acciones del patrón.</p>
          <button
            type="button"
            onClick={alTaller}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-[#C8A96B] transition hover:bg-white/[0.08]"
          >
            <FlaskConical size={14} className="shrink-0" />
            Al taller
          </button>
        </div>
      </div>

      <ul className="grid min-w-0 gap-3 md:grid-cols-2">
        {visibles.map((x, k) => (
          <li key={`${x.accion.id}-${x.accion.seg}-${k}`} className="min-w-0 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONO_RESULTADO[x.accion.r]}`}>{RESULTADO_ACCION[x.accion.r]}</span>
              {x.accion.xg !== undefined && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] tabular-nums text-white/60">xG {xgTexto(x.accion.xg)}</span>}
              {x.accion.eq && <span className="min-w-0 truncate text-[11px] text-white/55">{x.accion.eq}</span>}
            </div>
            <ClipAccion accion={x.accion} competicion={x.comp.nombre} jornada={x.jornada} videos={x.comp.videos} compacto />
          </li>
        ))}
      </ul>

      {lista.length > 12 && (
        <button type="button" onClick={() => setTodas((v) => !v)} className={chipClase(false)}>
          {todas ? "Ver menos" : `Ver las ${lista.length} acciones`}
        </button>
      )}
    </div>
  );
}

export function Patrones({ onAlTaller }: { onAlTaller: (b: Borrador) => void }) {
  const { datos, fallo } = useAbpTodas(true);

  const [slug, setSlug] = useState("todas");

  const [tipo, setTipo] = useState<TipoPatron | "todos">("todos");

  const [orden, setOrden] = useState<Orden>("goles");

  const [minimo, setMinimo] = useState(8);

  const [abierto, setAbierto] = useState<string | null>(null);

  const todas = useMemo(() => (datos ? expande(datos) : []), [datos]);

  const patrones = useMemo(() => {
    const base = slug === "todas" ? todas : todas.filter((x) => x.comp.slug === slug);

    return agrupa(base.filter((x) => tipo === "todos" || x.accion.t === tipo));
  }, [todas, slug, tipo]);

  const lista = useMemo(() => ranking(patrones, orden, minimo), [patrones, orden, minimo]);

  if (fallo) {
    return (
      <Notice tone="warn" title="No se han podido leer los patrones">
        Vuelve a cargar la página en un momento.
      </Notice>
    );
  }

  if (!datos) return <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" aria-busy="true" aria-label="Cargando" />;

  const elegido = lista.find((p) => p.clave === abierto) ?? null;

  const analizadas = patrones.reduce((s, p) => s + p.n, 0);

  return (
    <div className="min-w-0 space-y-4">
      <p className="text-[13px] text-white/55">
        Cada patrón es un tipo de balón parado, el lado desde el que se saca y la zona donde cae. Sólo cuentan las acciones que acabaron en remate, así que «por acción» significa por acción con remate. Wyscout no da el pie ni la forma
        del envío.
      </p>

      <div className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Competición">
        <button type="button" onClick={() => setSlug("todas")} className={chipClase(slug === "todas")}>
          Todas
        </button>
        {datos.competiciones.map((c) => (
          <button key={c.slug} type="button" onClick={() => setSlug(c.slug)} className={chipClase(slug === c.slug)}>
            {c.corto}
          </button>
        ))}
      </div>

      <div className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Tipo de balón parado">
        <button type="button" onClick={() => setTipo("todos")} className={chipClase(tipo === "todos")}>
          Todos
        </button>
        {TIPOS_PATRON.map((t) => (
          <button key={t} type="button" onClick={() => setTipo(t)} className={chipClase(tipo === t)}>
            {TIPO_PATRON_TEXTO[t]}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-0 items-center gap-2 text-[12px] text-white/55">
          <span className="shrink-0">Ordenar por</span>
          <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-white/85">
            {ORDENES.map((o) => (
              <option key={o.k} value={o.k}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 items-center gap-2 text-[12px] text-white/55">
          <span className="shrink-0">Muestra mínima</span>
          <select value={minimo} onChange={(e) => setMinimo(Number(e.target.value))} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-white/85">
            {MUESTRAS.map((m) => (
              <option key={m} value={m}>
                {m} acciones
              </option>
            ))}
          </select>
        </label>
        <p className="min-w-0 text-[12px] text-white/50">
          {lista.length} {lista.length === 1 ? "patrón" : "patrones"} de {analizadas} acciones
        </p>
      </div>

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13px] text-white/60">Ningún patrón llega a {minimo} acciones con estos filtros. Baja la muestra mínima o quita algún filtro.</p>
      ) : (
        <ol className="min-w-0 space-y-2">
          {lista.map((p, k) => {
            const activo = p.clave === abierto;

            return (
              <li key={p.clave} className="min-w-0 space-y-2">
                <button
                  type="button"
                  aria-expanded={activo}
                  onClick={() => setAbierto(activo ? null : p.clave)}
                  className={`flex w-full min-w-0 flex-col gap-2 rounded-2xl border p-3 text-left transition sm:flex-row sm:items-center sm:gap-4 ${
                    activo ? "border-[#C8A96B]/60 bg-[#C8A96B]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-[12px] font-black" style={{ background: "#C8A96B", color: "#0B0F14" }}>
                      {k + 1}
                    </span>
                    <span className="min-w-0 break-words text-[13px] font-semibold text-white/90">{nombrePatron(p)}</span>
                  </div>
                  <dl className="grid shrink-0 grid-cols-4 gap-x-3 text-center text-[11px] sm:w-72">
                    {[
                      ["n", String(p.n)],
                      ["Goles/acc.", dec(golesPorAccion(p))],
                      ["xG/acc.", dec(xgPorAccion(p))],
                      ["A puerta", pct(pctPuerta(p))],
                    ].map(([etiqueta, valor]) => (
                      <div key={etiqueta} className="min-w-0">
                        <dt className="truncate text-white/45">{etiqueta}</dt>
                        <dd className="text-[13px] font-semibold tabular-nums text-white/85">{valor}</dd>
                      </div>
                    ))}
                  </dl>
                </button>
                {activo && elegido && <Detalle patron={elegido} onAlTaller={onAlTaller} />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
