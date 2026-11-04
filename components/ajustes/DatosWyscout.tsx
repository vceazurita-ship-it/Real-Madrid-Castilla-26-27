"use client";

/**
 * DÓNDE SE QUEDÓ WYSCOUT (04/11/2026).
 *
 * Debajo del botón «Traer y publicar»: hasta qué jornada están completos los
 * datos, el último partido del Castilla que tienen, qué partidos de jornadas
 * ya jugadas faltan (aplazados incluidos) y cómo fue la última pasada, con lo
 * que quedó por bajar si se cortó. Lo escribe el ordenador del club al acabar
 * cada pasada (`Encargo.datosWyscout`, lib/data-analisis/wyscout-al-dia.ts).
 */
import { AlertTriangle, Check, Clock } from "lucide-react";

import type { EstadoDatosWyscout } from "@/lib/data-analisis/wyscout-al-dia";

const fechaCorta = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-");

  return `${d}/${m}`;
};

/** «04/11 10:12», con la hora de Madrid. */
function cuando(iso: string) {
  const t = Date.parse(iso);

  if (!Number.isFinite(t)) return "";

  return new Date(t).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function haceCuanto(iso: string, ahora: number) {
  const t = Date.parse(iso);

  if (!ahora || !Number.isFinite(t)) return "";

  const minutos = Math.round((ahora - t) / 60_000);

  if (minutos < 1) return "ahora mismo";

  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.round(minutos / 60);

  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.round(horas / 24);

  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function queSeBajo(p: NonNullable<EstadoDatosWyscout["pasada"]>) {
  if (p.modo === "completa") return `pasada completa${p.motivo && p.motivo !== "pasada completa" ? ` (${p.motivo})` : ""}`;

  const e = p.equipos.deUnTotal;

  const l = p.lotes.deUnTotal;

  if (!e && !l) return "sólo lo nuevo: no se había jugado nada que faltara";

  const partes = [
    e ? `${p.equipos.bajados} de ${plural(e, "equipo", "equipos")}` : "",
    l ? `${p.lotes.bajados} de ${plural(l, "lote", "lotes")} de jugadores` : "",
  ].filter(Boolean);

  return `sólo lo nuevo: ${partes.join(" y ")}`;
}

export function DatosWyscout({ datos, ahora }: { datos: EstadoDatosWyscout; ahora: number }) {
  const p = datos.pasada;

  const minutos = p?.terminadaEn ? Math.max(1, Math.round((Date.parse(p.terminadaEn) - Date.parse(p.empezadaEn)) / 60_000)) : null;

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[11px] leading-relaxed">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Dónde se quedó</p>

      <ul className="space-y-1.5">
        {datos.ultimaCompleta && (
          <li className="flex items-start gap-1.5 text-white/55">
            <Check size={12} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
            <span>
              Última jornada completa: <span className="text-white/80">J{datos.ultimaCompleta.jornada}</span> ({fechaCorta(datos.ultimaCompleta.fecha)}),
              {datos.equipos ? ` los ${datos.equipos} equipos con su partido.` : " todos los equipos con su partido."}
            </span>
          </li>
        )}

        {datos.ultimoCastilla && (
          <li className="flex items-start gap-1.5 text-white/55">
            <Check size={12} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
            <span>
              Último partido del Castilla en los datos: <span className="text-white/80">J{datos.ultimoCastilla.jornada}</span> contra{" "}
              {datos.ultimoCastilla.rival} ({fechaCorta(datos.ultimoCastilla.fecha)}).
            </span>
          </li>
        )}

        {datos.faltan.length > 0 ? (
          <li className="flex items-start gap-1.5 text-white/55">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
            <span>
              Falta:{" "}
              {datos.faltan.map((f, i) => (
                <span key={`${f.jornada}-${f.que}`}>
                  {i > 0 ? " · " : ""}
                  <span className="text-amber-200">J{f.jornada}</span> ({fechaCorta(f.fecha)}) {f.que}
                  {f.abierta ? ", la jornada sigue abierta" : ""}
                </span>
              ))}
              . Cada pasada vuelve a mirarlo hasta que Wyscout lo carga.
            </span>
          </li>
        ) : (
          <li className="flex items-start gap-1.5 text-white/55">
            <Check size={12} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
            <span>No falta ningún partido de las jornadas ya jugadas.</span>
          </li>
        )}

        {p && (
          <li className="flex items-start gap-1.5 text-white/45">
            <Clock size={12} className="mt-0.5 shrink-0 text-white/35" aria-hidden />
            <span>
              Última pasada: <span className="text-white/70">{cuando(p.empezadaEn)}</span>
              {ahora ? ` (${haceCuanto(p.empezadaEn, ahora)})` : ""} · {queSeBajo(p)}
              {minutos ? ` · ${plural(minutos, "minuto", "minutos")}` : ""}.
            </span>
          </li>
        )}

        {p && !p.ok && (p.quedoEn || p.pendientes.length > 0) && (
          <li className="flex items-start gap-1.5 text-amber-200/90">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
            <span>
              {p.quedoEn ? `Se quedó en «${p.quedoEn}». ` : ""}
              {p.pendientes.length > 0 ? `Quedó por bajar: ${p.pendientes.join(" · ")}. ` : ""}
              La próxima pasada empieza por ahí.
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
