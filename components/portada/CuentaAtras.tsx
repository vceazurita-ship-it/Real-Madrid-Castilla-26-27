"use client";

import { useEffect, useState } from "react";

/**
 * CUENTA ATRÁS AL PRÓXIMO PARTIDO (02/11/2026).
 *
 * La chapa «en 5 días» decía poco el día de partido: a las diez de la mañana
 * de un partido a las seis lo que se quiere saber son las horas. Aquí se
 * cuenta en días, horas y minutos contra la hora de Madrid que da BeSoccer
 * («2026-11-08T12:00»). Si BeSoccer no tiene hora (las 00:00 de un partido
 * por fijar) se cuentan sólo los días, que es lo que se sabe.
 *
 * El reloj se mira en un efecto y se repasa cada 20 s: nunca en el render
 * (el linter de React lo para, ver [[react-hooks-purity-lint]]).
 */

const ZONA = "Europe/Madrid";

/** El instante de un «2026-11-08T12:00» leído como hora de Madrid. */
export function instanteEnMadrid(cuando: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(cuando || "");

  if (!m) return null;

  const [, a, mes, d, h = "00", min = "00"] = m;
  const comoUtc = Date.UTC(Number(a), Number(mes) - 1, Number(d), Number(h), Number(min));

  /* Lo que marca el reloj de Madrid en ese instante UTC: la diferencia es el huso. */
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(comoUtc));

  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const enMadrid = Date.UTC(valor("year"), valor("month") - 1, valor("day"), valor("hour"), valor("minute"));

  return comoUtc - (enMadrid - comoUtc);
}

const dos = (n: number) => String(n).padStart(2, "0");

export function CuentaAtras({ cuando }: { cuando: string }) {
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    const pon = () => setAhora(Date.now());
    const primero = setTimeout(pon, 0);
    const reloj = setInterval(pon, 20_000);

    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
    };
  }, []);

  const inicio = instanteEnMadrid(cuando);
  const sinHora = /T00:00/.test(cuando) || !/T\d{2}:\d{2}/.test(cuando);

  if (!ahora || inicio === null) {
    return <span aria-hidden className="block h-[60px] w-[220px] max-w-full animate-pulse rounded-2xl bg-white/[0.04]" />;
  }

  const resta = inicio - ahora;

  /* Ya empezado: hasta dos horas después se dice que se está jugando. */
  if (resta <= 0) {
    if (resta > -2 * 3_600_000 && !sinHora) {
      return (
        <p className="fuente-club inline-flex items-center gap-2.5 rounded-2xl border border-[#D8B45A]/50 bg-[#D8B45A]/10 px-4 py-2 text-[22px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--rmcf-gold-ink)" }}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--rmcf-gold-ink)" }} />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "var(--rmcf-gold-ink)" }} />
          </span>
          En juego
        </p>
      );
    }

    return null;
  }

  const minutosTotales = Math.floor(resta / 60_000);
  const dias = Math.floor(minutosTotales / 1440);
  const horas = Math.floor((minutosTotales % 1440) / 60);
  const minutos = minutosTotales % 60;

  const casillas: { valor: string; rotulo: string }[] = sinHora
    ? [{ valor: String(Math.max(1, Math.ceil(resta / 86_400_000))), rotulo: Math.ceil(resta / 86_400_000) === 1 ? "día" : "días" }]
    : [
        ...(dias > 0 ? [{ valor: String(dias), rotulo: dias === 1 ? "día" : "días" }] : []),
        { valor: dos(horas), rotulo: "horas" },
        { valor: dos(minutos), rotulo: "min" },
      ];

  const dicho = casillas.map((c) => `${Number(c.valor)} ${c.rotulo}`).join(", ");

  return (
    <div className="flex items-stretch gap-1.5 sm:gap-2" role="timer" aria-label={`Faltan ${dicho} para el partido`}>
      {casillas.map((casilla, i) => (
        <div key={casilla.rotulo} className="flex items-stretch gap-1.5 sm:gap-2">
          {i > 0 && (
            <span aria-hidden className="fuente-club self-center text-[22px] font-bold text-white/30 sm:text-[26px]">
              :
            </span>
          )}
          <span className="flex min-w-[54px] flex-col items-center justify-center rounded-2xl border border-[#D8B45A]/35 bg-[#D8B45A]/[0.08] px-2.5 py-1.5 sm:min-w-[64px]">
            <span className="fuente-club text-[30px] font-bold leading-none tabular-nums sm:text-[36px]" style={{ color: "var(--rmcf-gold-ink)" }}>
              {casilla.valor}
            </span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
              {casilla.rotulo}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
