"use client";

/**
 * DOS RUTINAS LADO A LADO (laboratorio de ABP, 24/10/2026).
 *
 * Las dos con el mismo reloj, la misma cámara y la misma defensa, para ver
 * a la vez cómo se mueve cada una; debajo, lo que dice la simulación de cada
 * una (xG, dónde se remata, la marca, el duelo aéreo y el encaje con cada
 * sistema), con la mejor en oro. Lo que una no tiene no se rotula.
 *
 * En el móvil van una encima de otra. Espacio reproduce, Escape cierra.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { ExternalLink, Flame, Scale, X } from "lucide-react";

import type { JugadorLab } from "@/components/abp-lab/comun";
import { usePaleta, type Capas } from "@/components/abp-lab/Escena";
import { EscenaViva } from "@/components/abp-lab/EscenaViva";
import { LineaTiempo, useReloj, type Reloj } from "@/components/abp-lab/LineaTiempo";
import { defensaRivalDe, estructuraPara, useSimulacionFija, type ContextoSim, type QueDefensa } from "@/components/abp-lab/useSimulacion";
import { encuadre, focoDe } from "@/lib/abp-lab/campo";
import { VISTAS, creaCamara, type Vista } from "@/lib/abp-lab/camara";
import { DEFENSAS, ENVIOS, TIPOS, etiqueta, type Rol, type Rutina } from "@/lib/abp-lab/modelo";
import { PRESION_LABEL, encajeSistemas, evaluaRemate, planCon, type Remate } from "@/lib/abp-lab/ventaja";
import { ZONAS_REMATE, comaXg } from "@/lib/abp-lab/xg";

const ASPECTO = 1.62;

function Columna({
  r,
  porId,
  ctx,
  que,
  vista,
  capas,
  reloj,
  lado,
}: {
  r: Rutina;
  porId: Map<string, JugadorLab>;
  ctx: ContextoSim;
  que: QueDefensa;
  vista: Vista;
  capas: Capas;
  reloj: Reloj;
  lado: "A" | "B";
}) {
  const id = useId().replace(/:/g, "");

  const paleta = usePaleta();

  const fija = useSimulacionFija(r, r.lado === "ofensivo" ? que : "ninguna", ctx);

  const cam = useMemo(() => creaCamara(vista, encuadre(r, ASPECTO, 6), ASPECTO, focoDe(r)), [vista, r]);

  return (
    <div className="min-w-0">
      <p className="mb-1.5 flex min-w-0 items-baseline gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-black" style={{ background: "#C8A96B", color: "#0B0F14" }}>
          {lado}
        </span>
        <span className="min-w-0 truncate text-[14px] font-semibold text-white">{r.nombre}</span>
        <span className="shrink-0 text-[11px] text-white/45">
          {etiqueta(TIPOS, r.tipo)} · {etiqueta(ENVIOS, r.envio ?? "tenso").toLowerCase()}
        </span>
      </p>
      <div className="overflow-hidden rounded-2xl border border-white/10" style={{ background: paleta.cielo }}>
        <EscenaViva id={`cmp${id}`} reloj={reloj} rutina={r} porId={porId} cam={cam} paleta={paleta} fija={fija} capas={capas} etiqueta={`Rutina ${lado}: ${r.nombre}`} />
      </div>
    </div>
  );
}

type Medida = { remate: Remate | null; encaje: ReturnType<typeof encajeSistemas> };

export function Comparador({
  a,
  b,
  porId,
  ctx,
  onCerrar,
  onAbre,
}: {
  a: Rutina;
  b: Rutina;
  porId: Map<string, JugadorLab>;
  ctx: ContextoSim;
  onCerrar: () => void;
  onAbre: (r: Rutina) => void;
}) {
  const reloj = useReloj(0);

  const { alterna, salta, empuja, setBucle } = reloj;

  const [vista, setVista] = useState<Vista>("tv");

  const [capas, setCapas] = useState<Capas>({ nombres: true, fotos: false, ventaja: false, duelos: true, llegada: false });

  const hayProximo = Boolean(ctx.rival && [a, b].some((r) => r.lado === "ofensivo" && estructuraPara(ctx.rival, r.tipo)));

  const [que, setQue] = useState<QueDefensa>(hayProximo ? "proximo" : "tipo");

  /* Arranca sola, en bucle: es para mirar. */
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
      const t = e.target as HTMLElement | null;

      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;

      if (e.key === "Escape") onCerrar();
      else if (e.key === " ") {
        e.preventDefault();
        alterna();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();

        const sentido = e.key === "ArrowRight" ? 1 : -1;

        if (e.shiftKey) salta(sentido);
        else empuja(sentido / 90);
      }
    };

    window.addEventListener("keydown", tecla);

    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", tecla);
    };
  }, [alterna, salta, empuja, onCerrar]);

  /* Lo que se mide de cada una, contra la defensa elegida y contra los tres sistemas. */
  const medidas = useMemo(() => {
    const alturaDe = (rol: Rol) => ctx.aereo.get(rol.jugador)?.altura ?? null;

    return [a, b].map((r): Medida => {
      const def = defensaRivalDe(que, r, ctx);

      const sirve = r.lado === "ofensivo" && r.roles.length > 0;

      return {
        remate: sirve && def ? evaluaRemate(r, planCon(r, def), ctx.calibre, alturaDe) : null,
        encaje: sirve && (r.tipo === "corner" || r.tipo === "falta") ? encajeSistemas(r, ctx.calibre, alturaDe) : [],
      };
    });
  }, [a, b, que, ctx]);

  const textoDefensa = que === "proximo" && ctx.rival ? `contra ${ctx.rival.equipo}` : que === "tipo" ? "contra su rival tipo" : "";

  const quienDe = (r: Rutina, m: Medida) => {
    const i = m.remate?.quien;

    if (i === null || i === undefined) return "";

    return porId.get(r.roles[i]?.jugador ?? "")?.nombre ?? "";
  };

  /* Las filas: sólo las que alguna de las dos puede contestar. */
  const filas: { k: string; label: string; v: [string, string]; mejor?: 0 | 1 | null }[] = [];

  const xg = medidas.map((m) => (m.remate && m.remate.quien !== null ? m.remate.xg : null));

  if (xg.some((v) => v !== null)) {
    filas.push({
      k: "xg",
      label: `xG estimado ${textoDefensa}`.trim(),
      v: [xg[0] !== null ? comaXg(xg[0]) : "", xg[1] !== null ? comaXg(xg[1]) : ""],
      mejor: xg[0] !== null && xg[1] !== null && Math.abs(xg[0] - xg[1]) > 0.004 ? (xg[0] > xg[1] ? 0 : 1) : xg[0] !== null && xg[1] === null ? 0 : xg[1] !== null && xg[0] === null ? 1 : null,
    });
  }

  const remates = medidas.map((m) => m.remate);

  if (remates.some((x) => x && x.quien !== null && !x.directo)) {
    filas.push({
      k: "zona",
      label: "Dónde se remata",
      v: [0, 1].map((i) => {
        const x = remates[i];

        if (!x || x.quien === null || x.directo) return "";

        const nombre = quienDe(i ? b : a, medidas[i]);

        return `${etiqueta(ZONAS_REMATE, x.zona)}${nombre ? ` · ${nombre}` : ""}`;
      }) as [string, string],
    });
    filas.push({
      k: "presion",
      label: "La marca en el remate",
      v: [0, 1].map((i) => {
        const x = remates[i];

        return x && x.quien !== null && !x.directo ? PRESION_LABEL[x.presion] : "";
      }) as [string, string],
    });
  }

  if (remates.some((x) => x?.difCm !== null && x?.difCm !== undefined)) {
    filas.push({
      k: "duelo",
      label: "Duelo aéreo",
      v: [0, 1].map((i) => {
        const d = remates[i]?.difCm;

        return d === null || d === undefined ? "" : d >= 0 ? `Le saca ${d} cm` : `Le sacan ${-d} cm`;
      }) as [string, string],
    });
  }

  for (const sistema of ["zona", "mixta", "hombre"] as const) {
    const v = medidas.map((m) => m.encaje.find((e) => e.defensa === sistema)?.xg ?? null);

    if (v.every((x) => x === null)) continue;

    filas.push({
      k: `enc-${sistema}`,
      label: `Contra ${etiqueta(DEFENSAS, sistema).toLowerCase()}`,
      v: [v[0] !== null ? comaXg(v[0]) : "", v[1] !== null ? comaXg(v[1]) : ""],
      mejor: v[0] !== null && v[1] !== null && Math.abs(v[0] - v[1]) > 0.004 ? (v[0] > v[1] ? 0 : 1) : null,
    });
  }

  filas.push({ k: "papeles", label: "Papeles", v: [String(a.roles.length), String(b.roles.length)] });

  const boton = (activo: boolean) => `rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition ${activo ? "bg-[#C8A96B] text-black" : "text-white/60 hover:text-white"}`;

  const ofensiva = a.lado === "ofensivo" || b.lado === "ofensivo";

  return (
    <div role="dialog" aria-modal="true" aria-label={`Comparar ${a.nombre} y ${b.nombre}`} className="fixed inset-0 z-[60] flex flex-col bg-[#0B0F14] text-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:px-6">
        <button type="button" onClick={onCerrar} aria-label="Cerrar la comparación" className="rounded-xl p-2 text-white/60 transition hover:bg-white/[0.06] hover:text-white">
          <X size={18} />
        </button>
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold text-white">
          <Scale size={16} className="shrink-0 text-[#C8A96B]" />
          <span className="truncate">Comparar dos rutinas</span>
        </p>
        <div role="radiogroup" aria-label="Cámara" className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {VISTAS.map((v) => (
            <button key={v.key} type="button" role="radio" aria-checked={vista === v.key} onClick={() => setVista(v.key)} className={boton(vista === v.key)}>
              {v.corto}
            </button>
          ))}
        </div>
        {ofensiva && (
          <div role="radiogroup" aria-label="Defensa" className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {[
              { k: "tipo" as const, label: "Rival tipo" },
              ...(ctx.rival ? [{ k: "proximo" as const, label: ctx.rival.equipo }] : []),
              { k: "ninguna" as const, label: "Sin rival" },
            ].map((o) => (
              <button key={o.k} type="button" role="radio" aria-checked={que === o.k} onClick={() => setQue(o.k)} className={`max-w-[9rem] truncate ${boton(que === o.k)}`}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        {ofensiva && (
          <button type="button" onClick={() => setCapas((c) => ({ ...c, llegada: !c.llegada }))} aria-pressed={Boolean(capas.llegada)} title="Mapa de calor de llegada" className={`inline-flex items-center gap-1 rounded-xl border border-white/10 ${boton(Boolean(capas.llegada))}`}>
            <Flame size={13} />
            Llegada
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1500px] space-y-4 px-3 py-4 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Columna r={a} porId={porId} ctx={ctx} que={que} vista={vista} capas={capas} reloj={reloj} lado="A" />
            <Columna r={b} porId={porId} ctx={ctx} que={que} vista={vista} capas={capas} reloj={reloj} lado="B" />
          </div>

          <LineaTiempo reloj={reloj} />

          <section className="overflow-hidden rounded-2xl border border-white/10" aria-label="Lo que mide cada una">
            <table className="w-full table-fixed text-[12.5px]">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.16em] text-white/45">
                  <th className="w-[38%] px-3 py-2 font-semibold sm:w-1/3" />
                  {[a, b].map((r, i) => (
                    <th key={r.id} className="px-3 py-2 font-semibold">
                      <button type="button" onClick={() => onAbre(r)} className="inline-flex max-w-full items-center gap-1 truncate text-white/70 underline-offset-2 hover:text-white hover:underline" title={`Abrir ${r.nombre}`}>
                        <span className="truncate">{i ? "B" : "A"} · {r.nombre}</span>
                        <ExternalLink size={11} className="shrink-0" />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.k} className="border-b border-white/5 last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-medium text-white/55">
                      {f.label}
                    </th>
                    {f.v.map((v, i) => (
                      <td key={i} className={`break-words px-3 py-2 tabular-nums ${f.mejor === i ? "font-bold text-[#C8A96B]" : "text-white/80"}`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
