"use client";

/**
 * AVISO DIARIO DEL ADMINISTRADOR: PLATAFORMAS Y PENDIENTES.
 *
 * 14/11/2026: nació como recordatorio de la base de datos (Supabase cortado,
 * plan B en un Postgres gratis de Render que caduca el 14/12/2026).
 * 15/11/2026: enseña además cómo van las tres plataformas con límite gratis
 * (Render, la base de datos y Backblaze B2) y lo que queda por cerrar a mano
 * (hoy, el alta en la API de BeSoccer). Los datos los deja cada día el
 * ordenador del club en el documento `salud:plataformas`
 * (scripts/salud-datos.mjs, lanzado por el vigía), junto con la copia de la
 * base. Sale SÓLO al administrador, la primera vez que entra cada día; se
 * cierra hasta mañana (recordado en este aparato).
 */

import { useEffect, useState } from "react";
import { Database, X } from "lucide-react";

import { useAdmin } from "@/hooks/useAdmin";

const CLAVE = "rmcf:aviso-base-datos";
const CADUCA = "2026-12-14";

type Estado = {
  comprobadoEn?: string;
  base?: { bytes: number; caduca?: string; dias?: number };
  b2?: { bytes: number; ficheros: number; tope: number };
  render?: { publicacionesMes: number; minutosEstimados: number; tope: number };
  supabase?: string;
  copia?: { dia: string; bytes: number };
  avisos?: string[];
  pendientes?: { id: string; titulo: string; texto: string }[];
};

const hoy = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 10);
const mb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1).replace(".", ",")} GB` : `${Math.round(b / 1e6)} MB`);

function Barra({ nombre, uso, detalle }: { nombre: string; uso: number; detalle: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(uso * 100)));
  const color = pct >= 85 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e";
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-white">{nombre}</span>
        <span className="tabular-nums text-white/70">{pct} %</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="mt-1 text-xs text-white/60">{detalle}</p>
    </li>
  );
}

export function AvisoBaseDatos() {
  const { admin } = useAdmin();
  /* Lo de este aparato y la cuenta de días, al montar (no en cada pintado: regla de pureza). */
  const [vistoHoy, setVistoHoy] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(CLAVE) === hoy();
    } catch {
      return false;
    }
  });
  const [quedan] = useState(() => Math.ceil((Date.parse(`${CADUCA}T00:00:00+01:00`) - Date.now()) / 86_400_000));
  const [estado, setEstado] = useState<Estado | null>(null);
  const abierto = admin === true && !vistoHoy;

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    fetch("/api/docs?key=salud%3Aplataformas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (vivo && j?.data) setEstado(j.data as Estado);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [abierto]);

  const cierra = () => {
    try {
      localStorage.setItem(CLAVE, hoy());
    } catch {
      /* nada */
    }
    setVistoHoy(true);
  };

  if (!abierto) return null;

  const dias = estado?.base?.dias ?? quedan;
  const pendientes = estado?.pendientes ?? [];

  return (
    <div className="modal-veil fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="aviso-bd-titulo">
      <div className="siempre-oscuro max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-500/50 bg-[#141414] p-5 text-white shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          {/* text-white propio (18/11/2026): heredado, en modo día salía casi negro sobre el fondo oscuro. */}
          <p id="aviso-bd-titulo" className="flex items-center gap-2 text-base font-semibold text-white">
            <Database size={18} className="text-amber-400" aria-hidden />
            Plataformas y pendientes
          </p>
          <button type="button" onClick={cierra} aria-label="Cerrar" className="rounded-lg p-1 text-white/60 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 text-sm text-white/80">
          {(estado?.avisos?.length ?? 0) > 0 && (
            <ul className="space-y-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200">
              {estado!.avisos!.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}

          <div>
            <p className="font-semibold text-amber-300">
              La base de datos gratis de Render caduca el 14/12/2026{dias != null ? ` (quedan ${dias} días)` : ""}.
            </p>
            <p className="mt-1 text-white/70">
              Supabase {estado?.supabase === "vuelto" ? "ha vuelto" : "sigue cortado"}. La salida: una base en Neon (gratis y sin caducidad); se copia todo con
              la copia de cada noche y no se pierde nada.
            </p>
          </div>

          {estado ? (
            <ul className="space-y-3">
              {estado.render && (
                <Barra
                  nombre="Render · minutos de compilación"
                  uso={estado.render.minutosEstimados / estado.render.tope}
                  detalle={`Unos ${estado.render.minutosEstimados} de 500 este mes. Se publica por lotes (7:00 y 15:00) y se para solo antes del tope.`}
                />
              )}
              {estado.base && <Barra nombre="Base de datos" uso={estado.base.bytes / 1e9} detalle={`${mb(estado.base.bytes)} de 1 GB.`} />}
              {estado.b2 && (
                <Barra nombre="Vídeos, fotos y copias (Backblaze)" uso={estado.b2.bytes / estado.b2.tope} detalle={`${mb(estado.b2.bytes)} de 10 GB · ${estado.b2.ficheros} ficheros.`} />
              )}
              {estado.copia && <li className="text-xs text-white/60">Última copia de la base: {estado.copia.dia} ({mb(estado.copia.bytes)}), en el ordenador del club y en Backblaze.</li>}
            </ul>
          ) : (
            <p className="text-xs text-white/50">Todavía no ha llegado la comprobación de hoy del ordenador del club.</p>
          )}

          {pendientes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Pendiente de cerrar</p>
              <ul className="mt-1.5 space-y-2">
                {pendientes.map((p) => (
                  <li key={p.id} className="rounded-xl border border-white/10 p-3">
                    <p className="font-semibold text-white">{p.titulo}</p>
                    <p className="mt-0.5 text-xs text-white/70">{p.texto}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-white/50">Sólo lo ves tú (administrador), una vez al día. Si algo pasa del 70 % llega además un correo.</p>
        </div>

        <button type="button" onClick={cierra} className="mt-4 min-h-[44px] w-full rounded-xl bg-amber-500 px-4 text-sm font-bold text-black hover:brightness-110">
          Entendido, hoy no más
        </button>
      </div>
    </div>
  );
}

/**
 * Lo mismo que el aviso, como panel fijo de Ajustes → Poner al día (18/11/2026):
 * dónde está de verdad cada límite gratis hoy (Render, la base y Backblaze),
 * sin esperar al aviso del día. Mismo documento `salud:plataformas`.
 */
export function PanelPlataformas() {
  const [estado, setEstado] = useState<Estado | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    fetch("/api/docs?key=salud%3Aplataformas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => vivo && setEstado((j?.data as Estado) ?? null))
      .catch(() => vivo && setEstado(null));
    return () => {
      vivo = false;
    };
  }, []);

  if (estado === undefined) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" aria-labelledby="panel-plataformas">
      <h3 id="panel-plataformas" className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Database size={16} className="text-[#C8A96B]" aria-hidden /> Límites gratis de hoy
      </h3>
      <p className="mt-0.5 text-[12px] text-white/55">
        Donde vive todo ahora: la web en Render, los datos en su base y los vídeos y copias en Backblaze.
        {estado?.comprobadoEn ? ` Comprobado ${new Date(estado.comprobadoEn).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.` : ""}
      </p>
      {estado ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {estado.render && (
            <Barra nombre="Render · compilación" uso={estado.render.minutosEstimados / estado.render.tope} detalle={`Unos ${estado.render.minutosEstimados} de ${estado.render.tope} min este mes.`} />
          )}
          {estado.base && <Barra nombre="Base de datos" uso={estado.base.bytes / 1e9} detalle={`${mb(estado.base.bytes)} de 1 GB${estado.base.dias != null ? ` · caduca en ${estado.base.dias} días` : ""}.`} />}
          {estado.b2 && <Barra nombre="Vídeos y copias (Backblaze)" uso={estado.b2.bytes / estado.b2.tope} detalle={`${mb(estado.b2.bytes)} de 10 GB · ${estado.b2.ficheros} ficheros.`} />}
        </ul>
      ) : (
        <p className="mt-3 text-[12px] text-white/55">Todavía no ha llegado la comprobación de hoy del ordenador del club.</p>
      )}
      {(estado?.pendientes?.length ?? 0) > 0 && (
        <p className="mt-3 text-[12px] text-white/65">
          <b className="text-white/85">Pendiente de cerrar:</b> {estado!.pendientes!.map((p) => p.titulo).join(" · ")}
        </p>
      )}
    </section>
  );
}
