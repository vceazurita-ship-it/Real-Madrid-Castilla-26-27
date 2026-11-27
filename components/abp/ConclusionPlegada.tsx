"use client";

/*
| LA CONCLUSIÓN DEL BALÓN PARADO EN «VISUAL» (17/11/2026, jueces de la ronda 19).
|
| «Las conclusiones son un bloque de texto denso antes que un gráfico.» En
| Visual, ABP ofensivo y defensivo y saque de banda ofensivo y defensivo abren
| con esto: primero el gráfico (cómo acaban, en una barra), después el titular
| de una línea con el dato y, si la hay, la orden («Qué entrenamos»). El resto
| de frases va plegado tras un botón. «Detalle» sigue con el bloque entero.
| Lo que no tiene dato no sale.
*/

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";

export function ConclusionPlegada({
  titular,
  base,
  items,
  grafico,
  marca,
  enlace,
  className = "",
  aLaVista = 2,
}: {
  titular?: string;
  /** 27/11/2026 (jueces, ronda 10): la base del titular, en su propia línea debajo («Base: 59 acciones frente a 40 del resto»). */
  base?: string;
  items: (string | null | undefined | false)[];
  /** El gráfico que va delante del texto. */
  grafico?: ReactNode;
  /** «Tendencia: 7 acciones», junto al titular, cuando la base es corta. */
  marca?: string;
  enlace?: { href: string; rotulo: string };
  className?: string;
  /** 20/11/2026 (ronda 7): cuántas lecturas van a la vista antes de «N lecturas más» (por defecto, dos, como hasta ahora). */
  aLaVista?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const frases = items.filter((x): x is string => Boolean(x && x.trim()));
  const orden = frases.find((f) => f.startsWith("Qué entrenamos"));
  const resto = frases.filter((f) => f !== orden);

  if (!titular && !frases.length) return null;

  return (
    <section aria-label="Conclusión" className={`min-w-0 rounded-2xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.05] px-4 py-3 sm:px-5 ${className}`}>
      {grafico ? <div className="mb-3 min-w-0">{grafico}</div> : null}
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--rmcf-gold-ink)" }}>
        <Lightbulb size={12} aria-hidden />
        Conclusión
        {marca ? (
          <span className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/70" style={{ background: "rgb(var(--rmcf-ink-rgb) / .07)" }}>
            {marca}
          </span>
        ) : null}
      </p>
      {titular ? <p className="mt-1 text-base font-semibold leading-snug text-white/90 md:text-lg">{titular}</p> : null}
      {titular && base ? <p className="mt-0.5 text-[12px] leading-snug text-white/65">{base}</p> : null}
      {orden ? (
        /* 27/11/2026 (jueces, ronda 11): «Qué entrenamos» puede venir en tres líneas (tarea · qué se cuenta · objetivo), separadas por saltos. */
        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-snug text-white/80">
          <b className="font-semibold text-white/90">Qué entrenamos:</b> {orden.replace(/^Qué entrenamos[^:]*:\s*/, "")}
          {enlace ? (
            <>
              {" "}
              <Link href={enlace.href} className="font-semibold underline underline-offset-2" style={{ color: "var(--rmcf-gold-ink)" }}>
                {enlace.rotulo}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {/* 17/11/2026 (jueces, ronda 20): las dos primeras lecturas, a la vista; el resto, plegado. */}
      {resto.length && aLaVista > 0 ? (
        <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[13px] leading-snug text-white/80 md:grid-cols-2">
          {resto.slice(0, aLaVista).map((frase) => (
            <li key={frase} className="flex min-w-0 gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#C8A96B]" aria-hidden />
              <span className="min-w-0">{frase}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {resto.length > aLaVista ? (
        <>
          <button
            type="button"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
            className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[12px] font-semibold text-white/75 hover:bg-white/[0.05]"
          >
            {abierto ? "Menos" : `${resto.length - aLaVista === 1 ? "Una lectura más" : `${resto.length - aLaVista} lecturas más`}`}
            <ChevronDown size={13} className={`transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {abierto ? (
            <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[13px] leading-snug text-white/80 md:grid-cols-2">
              {resto.slice(aLaVista).map((frase) => (
                <li key={frase} className="flex min-w-0 gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#C8A96B]" aria-hidden />
                  <span className="min-w-0">{frase}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {!orden && enlace ? (
        <Link href={enlace.href} className="mt-2 inline-block text-[13px] font-semibold underline underline-offset-2" style={{ color: "var(--rmcf-gold-ink)" }}>
          {enlace.rotulo}
        </Link>
      ) : null}
    </section>
  );
}
