"use client";

/**
 * La línea de tiempo de la jugada: reproducir, pausa, velocidad, bucle y los
 * momentos marcados (salida, golpeo, remate, final) para saltar a ellos. El
 * reloj lo lleva `useReloj`, que respeta «reducir movimiento» del sistema.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward } from "lucide-react";

import { MARCAS, SEGUNDOS, VELOCIDADES } from "@/lib/abp-lab/simulacion";

const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

const quieto = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/** El reloj de la jugada: `t` de 0 a 1, con su velocidad y su bucle. */
export function useReloj(inicial = 0) {
  const [t, setTRaw] = useState(inicial);

  const [reproduciendo, setReproduciendo] = useState(false);

  const [velocidad, setVelocidad] = useState<number>(1);

  const [bucle, setBucle] = useState(false);

  const tRef = useRef(inicial);

  const setT = useCallback((v: number) => {
    tRef.current = v;
    setTRaw(v);
  }, []);

  useEffect(() => {
    if (!reproduciendo) return;

    let marco = 0;

    let antes = performance.now();

    const paso = (ms: number) => {
      const dt = ms - antes;

      antes = ms;

      let u = tRef.current + (dt / (SEGUNDOS * 1000)) * velocidad;

      if (u >= 1) {
        if (bucle) u = 0;
        else {
          setT(1);
          setReproduciendo(false);

          return;
        }
      }

      setT(u);
      marco = requestAnimationFrame(paso);
    };

    marco = requestAnimationFrame(paso);

    return () => cancelAnimationFrame(marco);
  }, [reproduciendo, velocidad, bucle, setT]);

  const alterna = useCallback(() => {
    if (reproduciendo) {
      setReproduciendo(false);

      return;
    }

    /* Con «reducir movimiento», salta del principio al final sin animar. */
    if (quieto()) {
      setT(tRef.current >= 1 ? 0 : 1);

      return;
    }

    if (tRef.current >= 1) setT(0);

    setReproduciendo(true);
  }, [reproduciendo, setT]);

  const para = useCallback(() => setReproduciendo(false), []);

  const salta = useCallback(
    (sentido: 1 | -1) => {
      setReproduciendo(false);

      const ahora = tRef.current;

      const destino = sentido > 0 ? MARCAS.find((m) => m.t > ahora + 0.005) : [...MARCAS].reverse().find((m) => m.t < ahora - 0.005);

      setT(destino?.t ?? (sentido > 0 ? 1 : 0));
    },
    [setT],
  );

  const empuja = useCallback(
    (d: number) => {
      setReproduciendo(false);
      setT(Math.min(1, Math.max(0, tRef.current + d)));
    },
    [setT],
  );

  const cambiaVelocidad = useCallback((sentido: 1 | -1) => {
    setVelocidad((v) => {
      const i = VELOCIDADES.indexOf(v as (typeof VELOCIDADES)[number]);

      return VELOCIDADES[Math.min(VELOCIDADES.length - 1, Math.max(0, (i < 0 ? 2 : i) + sentido))];
    });
  }, []);

  return { t, setT, tRef, reproduciendo, alterna, para, salta, empuja, velocidad, setVelocidad, cambiaVelocidad, bucle, setBucle };
}

export type Reloj = ReturnType<typeof useReloj>;

export function LineaTiempo({ reloj, oscuro = false }: { reloj: Reloj; oscuro?: boolean }) {
  const { t, setT, reproduciendo, alterna, para, salta, velocidad, setVelocidad, bucle, setBucle } = reloj;

  /* En la presentación (siempre oscura) los colores van fijos; en el estudio, por clases del tema. */
  const tenue = oscuro ? { color: "rgba(255,255,255,0.6)" } : undefined;

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={alterna}
          aria-label={reproduciendo ? "Pausa (espacio)" : "Reproducir la jugada (espacio)"}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C8A96B] text-black shadow-[0_6px_18px_-6px_rgba(200,169,107,0.8)] transition hover:brightness-110"
        >
          {reproduciendo ? <Pause size={17} /> : t >= 1 ? <RotateCcw size={17} /> : <Play size={17} className="translate-x-px" />}
        </button>

        <div className="relative min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(t * 1000)}
            onChange={(e) => {
              para();
              setT(Number(e.target.value) / 1000);
            }}
            aria-label="Instante de la jugada"
            aria-valuetext={`${coma(t * SEGUNDOS)} segundos`}
            className="block w-full accent-[#C8A96B]"
          />
          {/* Las marcas de los momentos, sobre la barra */}
          <div className="pointer-events-none absolute inset-x-[7px] -bottom-1.5 h-1.5" aria-hidden>
            {MARCAS.map((m) => (
              <span key={m.label} className="absolute top-0 h-1.5 w-0.5 -translate-x-1/2 rounded bg-[#C8A96B]" style={{ left: `${m.t * 100}%` }} />
            ))}
          </div>
        </div>

        <span className={`w-[4.6rem] shrink-0 text-right text-[11.5px] tabular-nums ${oscuro ? "" : "text-white/55"}`} style={tenue}>
          {coma(t * SEGUNDOS)} / {coma(SEGUNDOS)} s
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => salta(-1)} aria-label="Momento anterior (Mayúsculas + flecha izquierda)" className={`rounded-lg p-1.5 transition ${oscuro ? "" : "text-white/55 hover:text-white"}`} style={tenue}>
          <SkipBack size={14} />
        </button>
        {MARCAS.map((m) => {
          const aqui = Math.abs(t - m.t) < 0.006;

          return (
            <button
              key={m.label}
              type="button"
              onClick={() => {
                para();
                setT(m.t);
              }}
              aria-pressed={aqui}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${aqui ? "bg-[#C8A96B] text-black" : oscuro ? "" : "bg-white/[0.05] text-white/60 hover:text-white"}`}
              style={aqui ? undefined : oscuro ? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" } : undefined}
            >
              {m.label}
            </button>
          );
        })}
        <button type="button" onClick={() => salta(1)} aria-label="Momento siguiente (Mayúsculas + flecha derecha)" className={`rounded-lg p-1.5 transition ${oscuro ? "" : "text-white/55 hover:text-white"}`} style={tenue}>
          <SkipForward size={14} />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <div role="radiogroup" aria-label="Velocidad" className={`inline-flex rounded-lg p-0.5 ${oscuro ? "" : "border border-white/10"}`} style={oscuro ? { border: "1px solid rgba(255,255,255,0.15)" } : undefined}>
            {[0.25, 0.5, 1, 2].map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={velocidad === v}
                onClick={() => setVelocidad(v)}
                className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums transition ${velocidad === v ? "bg-[#C8A96B] text-black" : oscuro ? "" : "text-white/55 hover:text-white"}`}
                style={velocidad === v ? undefined : tenue}
              >
                {String(v).replace(".", ",")}×
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setBucle(!bucle)}
            aria-pressed={bucle}
            aria-label="Repetir en bucle (L)"
            title="Repetir en bucle (L)"
            className={`rounded-lg p-1.5 transition ${bucle ? "bg-[#C8A96B] text-black" : oscuro ? "" : "text-white/55 hover:text-white"}`}
            style={bucle ? undefined : tenue}
          >
            <Repeat size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
