"use client";

/**
 * EL ALMACÉN DE SUPABASE FRENTE AL PLAN GRATIS (07/11/2026).
 *
 * Lo que ocupan los ficheros (1 GB gratis), las carpetas que más pesan y un
 * botón (sólo admin) para borrar los adjuntos de correo repetidos o caducados.
 * Por encima del 95 % las rutas de subida frenan lo grande (lib/almacen/ocupacion.ts)
 * y los scripts del ordenador del club no suben cortes (scripts/almacen.cjs).
 */

import { useEffect, useState } from "react";
import { Database, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAdmin } from "@/hooks/useAdmin";

type Ocupacion = { mb: number; tope: number; ficheros: number; carpetas?: { carpeta: string; mb: number; n: number }[]; medido: string };
type Respuesta = { ok: boolean; ocupacion?: Ocupacion; aviso?: number; freno?: number; frenoActivo?: boolean; liberados?: number; error?: string };

const mb = (n: number) => Math.round(n).toLocaleString("es-ES");

export function OcupacionAlmacen() {
  const { admin: esAdmin } = useAdmin();
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [trabajando, setTrabajando] = useState<"medir" | "barrer" | null>(null);

  useEffect(() => {
    let vivo = true;

    void fetch("/api/almacen")
      .then((r) => r.json() as Promise<Respuesta>)
      .then((r) => vivo && setDatos(r))
      .catch(() => vivo && setDatos({ ok: false, error: "No se ha podido leer." }));

    return () => {
      vivo = false;
    };
  }, []);

  const pide = async (que: "medir" | "barrer") => {
    setTrabajando(que);

    try {
      const r = (await (que === "medir"
        ? fetch("/api/almacen?medir=1")
        : fetch("/api/almacen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "barrer" }) })
      ).then((x) => x.json())) as Respuesta;

      if (!r.ok) throw new Error(r.error || "No ha salido");

      setDatos(r);
      if (que === "barrer") toast.success(r.liberados ? `Liberados ${mb(r.liberados)} MB` : "No había adjuntos repetidos ni caducados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No ha salido");
    } finally {
      setTrabajando(null);
    }
  };

  const o = datos?.ocupacion;
  const parte = o ? o.mb / o.tope : 0;
  const nivel = parte >= (datos?.freno ?? 0.95) ? "lleno" : parte >= (datos?.aviso ?? 0.8) ? "aviso" : "bien";
  const color = nivel === "lleno" ? "#E5484D" : nivel === "aviso" ? "#C8A96B" : "#3DD68C";
  const medido = o ? new Date(o.medido).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <Database size={15} className="text-[#C8A96B]" aria-hidden />
          Almacén de ficheros (Supabase gratis)
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void pide("medir")}
            disabled={trabajando !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-white/75 hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw size={13} className={trabajando === "medir" ? "animate-spin" : undefined} aria-hidden />
            Medir ahora
          </button>
          {esAdmin && (
            <button
              type="button"
              onClick={() => void pide("barrer")}
              disabled={trabajando !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-white/75 hover:bg-white/5 disabled:opacity-50"
            >
              <Trash2 size={13} aria-hidden />
              {trabajando === "barrer" ? "Liberando…" : "Borrar adjuntos repetidos"}
            </button>
          )}
        </div>
      </div>

      {o ? (
        <>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10" role="meter" aria-valuemin={0} aria-valuemax={o.tope} aria-valuenow={o.mb} aria-label="Ocupación del almacén">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, parte * 100)}%`, background: color }} />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-white/70">
            <strong style={{ color }}>{mb(o.mb)} MB</strong> de {mb(o.tope)} MB ({Math.round(parte * 100)} %) · {o.ficheros.toLocaleString("es-ES")} ficheros · medido el {medido}
          </p>
          {nivel !== "bien" && (
            <p className="mt-1 text-[12px] leading-relaxed" style={{ color }}>
              {nivel === "lleno"
                ? datos?.frenoActivo
                  ? "Lleno: los vídeos y ficheros de más de 25 MB no se suben y el ordenador del club no sube cortes nuevos hasta liberar espacio. Los PDF de los correos siguen pasando."
                  : "Por encima del plan gratis. Todo se sigue subiendo (freno apagado: los cortes de análisis se quedan); Supabase puede avisar o limitar el proyecto. Libera lo que sobre."
                : "Por encima del 80 %: conviene liberar espacio antes de que se frenen las subidas."}
            </p>
          )}
          {o.carpetas?.length ? (
            <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-[11px] text-white/50 sm:grid-cols-2">
              {o.carpetas.slice(0, 8).map((c) => (
                <li key={c.carpeta} className="flex justify-between gap-3">
                  <span className="truncate">{c.carpeta}</span>
                  <span className="shrink-0 tabular-nums">{mb(c.mb)} MB</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-[11px] leading-relaxed text-white/35">
            Las copias repetidas de los adjuntos se borran solas en cada subida. Para recomprimir los cortes ya subidos (la mitad de peso, sin que se note):{" "}
            <code className="text-white/50">node scripts/limpia-supabase.mjs --hacer --aligerar</code> en el ordenador del club.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[12px] text-white/45">{datos?.error ?? "Midiendo…"}</p>
      )}
    </div>
  );
}
