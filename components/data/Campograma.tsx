"use client";

import { useId, useState } from "react";

import { formatea } from "@/lib/data-analisis/metricas";
import { MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import type { ValorFicha } from "@/lib/data-analisis/campograma";

/**
 * Un campo con las cifras puestas donde ocurren.
 *
 * El dibujo es el mismo en los dos lados de la pareja —el partido y la media—
 * para que la comparación sea **la misma ficha en el mismo sitio**: el ojo va
 * de una a otra sin buscar. Por eso las posiciones las manda el catálogo y no
 * el valor: una ficha nunca se mueve de sitio.
 *
 * El color de cada ficha sólo aparece en el lado del partido, y sólo dice una
 * cosa: si esa cifra quedó por encima o por debajo de nuestra media, con el
 * sentido de la métrica ya puesto. El lado de la media va en dorado plano,
 * porque es la referencia y no se juzga a sí misma.
 */
export function Campograma({
  fichas,
  lado,
  titulo,
  subtitulo,
}: {
  fichas: ValorFicha[];
  /** `partido` pinta el valor del partido y colorea; `media`, la referencia. */
  lado: "partido" | "media";
  titulo: string;
  subtitulo: string;
}) {
  const id = useId();

  const [encima, setEncima] = useState<string | null>(null);

  /* Medidas de un campo real, en la proporción de siempre. */
  const W = 680;
  const H = 440;
  const M = 14;

  const px = (x: number) => M + (x / 100) * (W - M * 2);
  const py = (y: number) => M + (y / 100) * (H - M * 2);

  const cesped = "rgb(var(--rmcf-ink-rgb) / .05)";
  const linea = "rgb(var(--rmcf-ink-rgb) / .16)";

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
          {titulo}
        </p>

        <p className="truncate text-[11px] text-white/35">{subtitulo}</p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${titulo}: ${fichas.map((f) => `${f.ficha.rotulo} ${formatea(lado === "partido" ? f.partido : f.media, f.unidad)}`).join(", ")}`}
      >
        {/* ----------------------- EL CAMPO ----------------------- */}
        <rect
          x={M}
          y={M}
          width={W - M * 2}
          height={H - M * 2}
          rx={8}
          fill={cesped}
          stroke={linea}
          strokeWidth={1.5}
        />

        {/* Medio campo y círculo central. */}
        <line x1={W / 2} y1={M} x2={W / 2} y2={H - M} stroke={linea} strokeWidth={1.5} />

        <circle
          cx={W / 2}
          cy={H / 2}
          r={(H - M * 2) * 0.13}
          fill="none"
          stroke={linea}
          strokeWidth={1.5}
        />

        {/* Las dos áreas y las dos áreas pequeñas. */}
        {[0, 1].map((lado2) => {
          const ancho = (W - M * 2) * 0.16;
          const alto = (H - M * 2) * 0.52;
          const anchoP = (W - M * 2) * 0.06;
          const altoP = (H - M * 2) * 0.24;

          const x = lado2 === 0 ? M : W - M - ancho;
          const xp = lado2 === 0 ? M : W - M - anchoP;

          return (
            <g key={lado2}>
              <rect
                x={x}
                y={(H - alto) / 2}
                width={ancho}
                height={alto}
                fill="none"
                stroke={linea}
                strokeWidth={1.5}
              />

              <rect
                x={xp}
                y={(H - altoP) / 2}
                width={anchoP}
                height={altoP}
                fill="none"
                stroke={linea}
                strokeWidth={1.5}
              />
            </g>
          );
        })}

        {/* Los tercios, muy tenues: son la referencia de dónde pasa todo. */}
        {[1 / 3, 2 / 3].map((t) => (
          <line
            key={t}
            x1={M + (W - M * 2) * t}
            y1={M}
            x2={M + (W - M * 2) * t}
            y2={H - M}
            stroke={linea}
            strokeWidth={1}
            strokeDasharray="4 6"
            opacity={0.6}
          />
        ))}

        {/* La dirección del ataque, una vez y discreta. */}
        <g opacity={0.5}>
          <line
            x1={W / 2 - 26}
            y1={H - M + 0.5}
            x2={W / 2 + 26}
            y2={H - M + 0.5}
            stroke={ORO}
            strokeWidth={1.5}
          />
          <path
            d={`M ${W / 2 + 26} ${H - M + 0.5} l -6 -3 l 0 6 z`}
            fill={ORO}
          />
        </g>

        {/* ---------------------- LAS FICHAS ---------------------- */}
        {fichas.map((f) => {
          const valor = lado === "partido" ? f.partido : f.media;

          if (valor === null) return null;

          const clave = `${id}-${f.ficha.rotulo}`;

          const color =
            lado === "media" || f.diferencia === null || f.mejorAlto === null
              ? ORO
              : f.diferencia >= 0
                ? MEJOR
                : PEOR;

          const resaltada = encima === clave;

          const x = px(f.ficha.x);
          const y = py(f.ficha.y);

          const texto = formatea(valor, f.unidad);

          /* La chapa se ensancha con la cifra: un «12,4 %» no cabe en lo que
             cabe un «7». */
          const ancho = Math.max(52, texto.length * 9 + 22);

          return (
            <g
              key={clave}
              onMouseEnter={() => setEncima(clave)}
              onMouseLeave={() => setEncima(null)}
              style={{ cursor: "default" }}
            >
              {/* El 2 px de aire contra el césped, para que la chapa se
                  despegue del fondo aunque caiga encima de una línea. */}
              <rect
                x={x - ancho / 2 - 2}
                y={y - 17}
                width={ancho + 4}
                height={34}
                rx={10}
                fill="var(--rmcf-surface, #11161C)"
              />

              <rect
                x={x - ancho / 2}
                y={y - 15}
                width={ancho}
                height={30}
                rx={8}
                fill={lado === "partido" ? `${color}22` : "rgb(var(--rmcf-ink-rgb) / .06)"}
                stroke={color}
                strokeWidth={resaltada ? 2 : 1.2}
                opacity={resaltada ? 1 : 0.92}
              />

              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize={14}
                fontWeight={600}
                fill={color}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {texto}
              </text>

              {/* El rótulo, debajo y pequeño: la cifra manda. */}
              <text
                x={x}
                y={y + 27}
                textAnchor="middle"
                fontSize={10}
                fill={tinta(resaltada ? 0.75 : 0.45)}
              >
                {f.ficha.rotulo}
              </text>

              {/*
                En el lado del partido, cuánto cambia respecto a la referencia.

                El número va **tal cual** —13 remates en contra sobre 8,33 son
                un +56 %— y el color dice si eso es bueno o malo. Antes iba con
                el sentido de la métrica puesto y ese mismo caso salía «−56 %»
                justo al lado de las dos cifras que lo desmentían.
              */}
              {lado === "partido" && f.cambio !== null && (
                <text
                  x={x}
                  y={y - 21}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill={color}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {f.cambio >= 0 ? "+" : ""}
                  {f.cambio.toFixed(0)} %
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Lo que explica la ficha sobre la que está el ratón. */}
      <p className="mt-2 min-h-[32px] text-[11.5px] leading-relaxed text-white/45">
        {encima
          ? fichas.find((f) => `${id}-${f.ficha.rotulo}` === encima)?.ficha.nota
          : "Pasa el ratón por una cifra para ver cómo se lee."}
      </p>
    </div>
  );
}
