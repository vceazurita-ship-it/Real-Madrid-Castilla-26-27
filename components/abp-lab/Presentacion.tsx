"use client";

/**
 * LA RUTINA EN MODO RETRANSMISIÓN (laboratorio de ABP, 24/10/2026).
 *
 * Pantalla completa para la charla: la jugada con cámara de televisión, en
 * bucle, con los rótulos de una retransmisión —el nombre y la señal arriba,
 * el momento abajo y el xG del remate cuando llega— y la defensa que se haya
 * elegido en el estudio. Se maneja con el teclado (o tocando los mandos):
 * espacio, flechas, 1-2-3 para la cámara, V para el espacio y Escape.
 *
 * Es una superficie oscura en los dos temas (como un proyector): lleva
 * `data-abp-tablero` para que la tabla del modo día no le dé la vuelta a los
 * blancos, y los colores van fijos.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { Maximize2, X } from "lucide-react";

import type { JugadorLab } from "@/components/abp-lab/comun";
import { Escena, NOCHE, type Capas } from "@/components/abp-lab/Escena";
import { LineaTiempo, useReloj } from "@/components/abp-lab/LineaTiempo";
import { useSimulacion, type ContextoSim, type QueDefensa, type RutinaSimulable } from "@/components/abp-lab/useSimulacion";
import { VUELO, encuadre, focoDe } from "@/lib/abp-lab/campo";
import { VISTAS, creaCamara, type Vista } from "@/lib/abp-lab/camara";
import { DEFENSAS, etiqueta } from "@/lib/abp-lab/modelo";
import { momentoDe } from "@/lib/abp-lab/simulacion";
import { PRESION_LABEL } from "@/lib/abp-lab/ventaja";
import { ZONAS_REMATE, comaXg } from "@/lib/abp-lab/xg";
import { usePantallaCompleta } from "@/hooks/usePantallaCompleta";

const ASPECTO = 16 / 9;

export function Presentacion({
  rutina,
  porId,
  ctx,
  que,
  fotos,
  onCerrar,
}: {
  rutina: RutinaSimulable;
  porId: Map<string, JugadorLab>;
  ctx: ContextoSim;
  que: QueDefensa;
  fotos: Map<string, string>;
  onCerrar: () => void;
}) {
  const id = useId().replace(/:/g, "");

  const [vista, setVista] = useState<Vista>("tv");

  const [capas, setCapas] = useState<Capas>({ nombres: true, fotos: true, ventaja: false, duelos: true });

  const reloj = useReloj(0);

  const { t, alterna, salta, empuja, setBucle } = reloj;

  const marco = useMemo(() => encuadre(rutina, ASPECTO, 7), [rutina]);

  const foco = useMemo(() => focoDe(rutina), [rutina]);

  const cam = useMemo(() => creaCamara(vista, marco, ASPECTO, foco), [vista, marco, foco]);

  const sim = useSimulacion(rutina, t, que, ctx, capas.ventaja);

  const { marco: raiz, disponible, alterna: grande } = usePantallaCompleta<HTMLDivElement>();

  /* Arranca sola, en bucle. */
  useEffect(() => {
    setBucle(true);
    alterna();
    // Sólo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const antes = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const tecla = (e: KeyboardEvent) => {
      /* Es un modal: el teclado es suyo y no llega al estudio de debajo. */
      e.stopPropagation();

      if (e.key === "Escape") {
        onCerrar();

        return;
      }

      const k = e.key.toLowerCase();

      if (e.key === " " || k === "k") {
        e.preventDefault();
        alterna();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();

        if (e.shiftKey) salta(1);
        else empuja(1 / 60);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();

        if (e.shiftKey) salta(-1);
        else empuja(-1 / 60);
      } else if (k === "1" || k === "2" || k === "3") setVista(VISTAS[Number(k) - 1].key);
      else if (k === "v") setCapas((c) => ({ ...c, ventaja: !c.ventaja }));
      else if (k === "d") setCapas((c) => ({ ...c, duelos: !c.duelos }));
      else if (k === "n") setCapas((c) => ({ ...c, nombres: !c.nombres }));
      else if (k === "f") grande();
    };

    window.addEventListener("keydown", tecla, true);

    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", tecla, true);
    };
  }, [alterna, salta, empuja, onCerrar, grande]);

  const remate = sim.remate;

  const verRemate = remate && !remate.directo && t >= VUELO[1] - 0.02;

  const rivalTexto =
    rutina.lado !== "ofensivo"
      ? ""
      : que === "proximo" && ctx.rival
        ? `Contra ${ctx.rival.equipo}`
        : que === "tipo"
          ? etiqueta(DEFENSAS, rutina.contra)
          : "";

  const quien = remate?.quien !== null && remate?.quien !== undefined ? porId.get(rutina.roles[remate.quien]?.jugador ?? "") : undefined;

  return (
    <div ref={raiz} data-abp-tablero="" role="dialog" aria-modal="true" aria-label={`Presentación de ${rutina.nombre || "la rutina"}`} className="fixed inset-0 z-[80] flex flex-col" style={{ background: "#03070B", color: "#FFFFFF" }}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full max-w-[min(100%,calc((100vh-9.5rem)*16/9))]">
            <Escena
              id={`pres${id}`}
              rutina={rutina}
              porId={porId}
              t={t}
              cam={cam}
              paleta={NOCHE}
              nuestros={sim.nuestros}
              defensa={sim.defensa}
              capas={capas}
              celdas={sim.celdas}
              libres={sim.libres}
              duelos={sim.duelos}
              remate={remate}
              fotos={fotos}
              etiqueta={`Jugada ${rutina.nombre}`}
            />
          </div>
        </div>

        {/* El rótulo de arriba: el sello del club y el nombre de la jugada */}
        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-6rem)] items-stretch overflow-hidden rounded-md shadow-2xl sm:left-6 sm:top-5">
          <span className="flex items-center px-2.5 text-[10px] font-black uppercase tracking-[0.2em] sm:px-3 sm:text-[11px]" style={{ background: "#C8A96B", color: "#0B0F14" }}>
            RMC · ABP
          </span>
          <span className="min-w-0 px-3 py-1.5 sm:px-4 sm:py-2" style={{ background: "rgba(11,15,20,0.88)" }}>
            <span className="block truncate text-[15px] font-bold uppercase leading-tight tracking-wide sm:text-xl" style={{ fontFamily: "var(--font-barlow, inherit)" }}>
              {rutina.nombre || "Rutina"}
            </span>
            <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.18em] sm:text-[11.5px]" style={{ color: "#C8A96B" }}>
              {[rutina.senal ? `Señal «${rutina.senal}»` : "", rivalTexto].filter(Boolean).join(" · ")}
            </span>
          </span>
        </div>

        <div className="absolute right-3 top-3 flex gap-1.5 sm:right-6 sm:top-5">
          {disponible && (
            <button type="button" onClick={() => grande()} aria-label="Pantalla completa (F)" className="rounded-full p-2 transition" style={{ background: "rgba(255,255,255,0.1)", color: "#FFFFFF" }}>
              <Maximize2 size={16} />
            </button>
          )}
          <button type="button" onClick={onCerrar} aria-label="Salir de la presentación (Escape)" className="rounded-full p-2 transition" style={{ background: "rgba(255,255,255,0.1)", color: "#FFFFFF" }}>
            <X size={16} />
          </button>
        </div>

        {/* El rótulo de abajo: qué pasa ahora y, en el remate, su xG */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-stretch gap-0 overflow-hidden rounded-md shadow-2xl sm:bottom-5 sm:left-6">
          <span className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] sm:text-sm" style={{ background: "rgba(11,15,20,0.9)", borderLeft: "3px solid #C8A96B" }}>
            {momentoDe(t)}
          </span>
          {verRemate && (
            <span className="lab-aparece flex items-center gap-2 px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.1em] sm:text-sm" style={{ background: "#C8A96B", color: "#0B0F14" }}>
              {remate.quien === null
                ? "Nadie llega al balón"
                : `xG ${comaXg(remate.xg)} · ${etiqueta(ZONAS_REMATE, remate.zona).toLowerCase()}${quien ? ` · ${quien.nombre}` : ""}`}
            </span>
          )}
          {verRemate && remate.quien !== null && (
            <span className="lab-aparece flex items-center px-3 py-1.5 text-[11.5px] font-semibold sm:text-[13px]" style={{ background: "rgba(11,15,20,0.9)", color: "rgba(255,255,255,0.85)" }}>
              {PRESION_LABEL[remate.presion]}
              {remate.difCm !== null ? ` · ${remate.difCm > 0 ? "+" : ""}${remate.difCm} cm` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Los mandos */}
      <div className="border-t px-3 pb-3 pt-2.5 sm:px-6" style={{ borderColor: "rgba(255,255,255,0.1)", background: "#070C11" }}>
        <LineaTiempo reloj={reloj} oscuro />
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
          {VISTAS.map((v, i) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVista(v.key)}
              aria-pressed={vista === v.key}
              className="rounded-full px-2.5 py-1 font-semibold transition"
              style={vista === v.key ? { background: "#C8A96B", color: "#0B0F14" } : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}
            >
              {i + 1} · {v.label}
            </button>
          ))}
          {rutina.lado === "ofensivo" && sim.defensa && (
            <button
              type="button"
              onClick={() => setCapas((c) => ({ ...c, ventaja: !c.ventaja }))}
              aria-pressed={capas.ventaja}
              className="rounded-full px-2.5 py-1 font-semibold transition"
              style={capas.ventaja ? { background: "#C8A96B", color: "#0B0F14" } : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}
            >
              V · Espacio
            </button>
          )}
          <span className="ml-auto hidden sm:inline">Espacio: reproducir · ← →: fotograma · Mayús + ← →: momento · Esc: salir</span>
        </div>
      </div>
    </div>
  );
}
