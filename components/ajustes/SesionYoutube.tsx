"use client";

/**
 * LA SESIÓN DE YOUTUBE DEL ORDENADOR DEL CLUB (04/11/2026).
 *
 * Los subtítulos automáticos de los resúmenes oficiales sólo se dejan leer con
 * una cuenta dentro. De ellos sale el segundo exacto de cada acción a balón
 * parado («Ver el vídeo» salta ahí). La sesión vive en un perfil de Chrome
 * aparte (`.cache/chrome-youtube`) y la abre el analista una vez con el acceso
 * directo «YouTube · iniciar sesión» (`scripts\youtube-sesion.cmd`). Este
 * aviso lo escribe `scripts/abp-videos-youtube.mjs` en `mantenimiento:youtube`.
 */
import { AlertTriangle, Check } from "lucide-react";

import type { SesionYoutube as Sesion } from "@/lib/mantenimiento";

function cuando(iso?: string) {
  const t = Date.parse(iso ?? "");

  if (!Number.isFinite(t)) return "";

  return new Date(t).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const AVISO: Record<Exclude<Sesion["estado"], "ok">, string> = {
  caducada: "La sesión de YouTube ha caducado: abre «YouTube · iniciar sesión» y entra otra vez.",
  "sin-perfil": "Falta la sesión de YouTube: abre «YouTube · iniciar sesión» y entra una vez con tu cuenta.",
  comprobacion: "YouTube pide comprobar que no es un robot: abre «YouTube · iniciar sesión», haz la comprobación y cierra la ventana.",
  ocupado: "La ventana «YouTube · iniciar sesión» estaba abierta y no se ha podido leer nada: ciérrala cuando acabes.",
};

export function SesionYoutube({ sesion }: { sesion: Sesion }) {
  if (sesion.estado === "ok") {
    return (
      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-white/45">
        <Check size={12} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
        <span>
          Sesión de YouTube dentro ({cuando(sesion.comprobadoEn)}): los vídeos de ABP saltan al segundo de cada acción
          {typeof sesion.leidos === "number" && sesion.leidos > 0 ? ` · ${sesion.leidos} resúmenes leídos en la última pasada` : ""}.
        </span>
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/[0.06] p-3 text-[11px] leading-relaxed">
      <p className="flex items-start gap-1.5 text-amber-200">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
        <span>{AVISO[sesion.estado]}</span>
      </p>

      <p className="mt-1.5 text-white/45">
        En el ordenador del club, doble clic en <code className="text-white/70">scripts\youtube-sesion.cmd</code> (el acceso directo
        «YouTube · iniciar sesión» del escritorio). Se abre un Chrome aparte en YouTube: entra con tu cuenta y ciérralo. Mientras
        tanto «Ver el vídeo» abre el resumen entero.
        {sesion.bienEn ? ` Última vez dentro: ${cuando(sesion.bienEn)}.` : ""}
        {` Comprobado: ${cuando(sesion.comprobadoEn)}.`}
      </p>
    </div>
  );
}
