"use client";

/**
 * La pestaña «Actualizaciones» de Ajustes (09/11/2026): todo lo que se pone al
 * día solo, agrupado por cuándo se hace, con la fecha del último dato de
 * verdad y si va al día. Los que se pueden pedir a mano llevan su botón (el
 * mismo encargo de siempre). Catálogo en `lib/actualizaciones.ts`.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleDashed, Loader2, RefreshCw } from "lucide-react";

import { ACTUALIZACIONES, GRUPOS, frescura, type EstadoFrescura, type FechaActualizacion } from "@/lib/actualizaciones";
import { estadoEncargo, type Mantenimiento, type Tarea } from "@/lib/mantenimiento";

const SE_PIDE_AQUI: Tarea[] = ["quiniela", "rivales", "wyscout"];

function hace(iso: string, ahora: number) {
  const min = Math.max(0, Math.round((ahora - Date.parse(iso)) / 60_000));

  if (min < 2) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;

  const h = Math.round(min / 60);

  if (h < 36) return `hace ${h} h`;

  const d = Math.round(h / 24);

  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

const MARCA: Record<EstadoFrescura, { texto: string; clase: string; Icono: typeof CheckCircle2 }> = {
  "al-dia": { texto: "Al día", clase: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", Icono: CheckCircle2 },
  atrasada: { texto: "Atrasada", clase: "border-amber-400/40 bg-amber-400/10 text-amber-300", Icono: AlertTriangle },
  "sin-dato": { texto: "Sin fecha", clase: "border-white/15 bg-white/[0.04] text-white/50", Icono: CircleDashed },
};

export function Actualizaciones({
  estado,
  ahora,
  pide,
}: {
  /** Los encargos de siempre (para «en marcha» y el botón). */
  estado: Mantenimiento;
  ahora: number;
  pide: (tarea: Tarea) => void;
}) {
  const [fechas, setFechas] = useState<Record<string, string | null> | null>(null);
  const [error, setError] = useState(false);
  const [testigo, setTestigo] = useState(0);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/actualizaciones", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { fechas: FechaActualizacion[] }) => {
        if (cancelado) return;

        setFechas(Object.fromEntries(d.fechas.map((f) => [f.clave, f.fecha])));
        setError(false);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });

    /* Cada minuto, mientras la pestaña está abierta: lo que termina se ve solo. */
    const reloj = setTimeout(() => setTestigo((n) => n + 1), 60_000);

    return () => {
      cancelado = true;
      clearTimeout(reloj);
    };
  }, [testigo]);

  const cuenta = fechas
    ? ACTUALIZACIONES.reduce(
        (c, a) => {
          c[frescura(a, fechas[a.clave] ?? null, ahora)] += 1;

          return c;
        },
        { "al-dia": 0, atrasada: 0, "sin-dato": 0 } as Record<EstadoFrescura, number>,
      )
    : null;

  return (
    <div className="mt-6 min-w-0 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-[13px] leading-relaxed text-white/60">
          Lo que se pone al día solo, cuándo se hace y de cuándo es el último dato. «Atrasada» quiere decir que lleva más del doble de lo normal sin
          moverse: mira en su pantalla o pídela.
        </p>

        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          {cuenta && (
            <>
              <span className={`rounded-full border px-2.5 py-1 ${MARCA["al-dia"].clase}`}>{cuenta["al-dia"]} al día</span>
              {cuenta.atrasada > 0 && <span className={`rounded-full border px-2.5 py-1 ${MARCA.atrasada.clase}`}>{cuenta.atrasada} atrasadas</span>}
            </>
          )}
          <button
            type="button"
            onClick={() => setTestigo((n) => n + 1)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-white/10 px-3 text-white/70 transition hover:border-white/25 hover:text-white"
          >
            <RefreshCw size={13} /> Mirar otra vez
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[13px] text-amber-200">
          No se han podido leer las fechas. Vuelve a intentarlo en un momento.
        </p>
      )}

      {GRUPOS.map(({ grupo, titulo, texto }) => {
        const lista = ACTUALIZACIONES.filter((a) => a.grupo === grupo);

        if (!lista.length) return null;

        return (
          <section key={grupo} className="min-w-0">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B]">{titulo}</h2>
            <p className="mt-1 text-[12px] text-white/45">{texto}</p>

            <ul className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
              {lista.map((a) => {
                const fecha = fechas ? (fechas[a.clave] ?? null) : undefined;
                const marca = fecha === undefined ? null : MARCA[frescura(a, fecha, ahora)];
                const encargo = a.encargo ? estadoEncargo(a.encargo, estado[a.encargo], ahora) : "libre";
                const enMarcha = encargo === "pedido" || encargo === "en-marcha";
                const sePide = a.encargo && SE_PIDE_AQUI.includes(a.encargo);

                return (
                  <li key={a.clave} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-white">{a.nombre}</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-white/55">{a.alimenta}</p>
                      </div>

                      {marca ? (
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${marca.clase}`}>
                          <marca.Icono size={12} /> {marca.texto}
                        </span>
                      ) : (
                        <span className="h-6 w-16 shrink-0 animate-pulse rounded-full bg-white/10" aria-hidden />
                      )}
                    </div>

                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px] sm:gap-x-4">
                      <dt className="text-white/40">Último dato</dt>
                      <dd className="min-w-0 text-white/80">
                        {fecha === undefined ? "…" : fecha ? `${hace(fecha, ahora)} · ${fechaCorta(fecha)}` : "No hay fecha guardada"}
                      </dd>
                      <dt className="text-white/40">Cuándo</dt>
                      <dd className="min-w-0 text-white/80">{a.cuando}</dd>
                      <dt className="text-white/40">De dónde</dt>
                      <dd className="min-w-0 text-white/80">{a.fuente}</dd>
                    </dl>

                    <div className="mt-auto flex flex-wrap items-center gap-2">
                      {enMarcha && (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#C8A96B]">
                          <Loader2 size={13} className="animate-spin" /> {encargo === "pedido" ? "Pedida, esperando al ordenador del club" : "Actualizándose ahora"}
                        </span>
                      )}

                      {sePide && !enMarcha && (
                        <button
                          type="button"
                          onClick={() => pide(a.encargo!)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 text-[12px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                        >
                          <RefreshCw size={13} /> Actualizar ahora
                        </button>
                      )}

                      {a.enlace && (
                        <Link
                          href={a.enlace}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-xl px-2 text-[12px] text-white/60 transition hover:text-white"
                        >
                          Ver dónde se usa <ArrowUpRight size={13} />
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
