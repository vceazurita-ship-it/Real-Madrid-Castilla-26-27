"use client";

/**
 * La leyenda de los saques de banda: qué es cada zona y cada resultado.
 *
 * Las conclusiones hablan de «zona 3», «posicional» o «medios» y un entrenador
 * que entra por primera vez no sabe si la zona se cuenta desde su portería o
 * desde la del rival. Va plegada y en un renglón por término; sirve igual a
 * las dos pantallas (ofensivo y defensivo) y cambia sólo lo que cambia de
 * sentido.
 */

import { ChevronDown, Info } from "lucide-react";

import type { Mode } from "./throwInModel";

export function LeyendaSaques({ mode, className = "" }: { mode: Mode; className?: string }) {
  const ofensivo = mode === "offensive";

  const zonas = ofensivo
    ? [
        ["Zona 1", "tercio propio: el saque sale cerca de nuestra portería."],
        ["Zona 2", "tercio central."],
        ["Zona 3", "último tercio: el saque sale junto al área rival."],
      ]
    : [
        ["Zona 1", "tercio del rival: saca cerca de su portería."],
        ["Zona 2", "tercio central."],
        ["Zona 3", "junto a nuestra área: aquí un error cuesta caro."],
      ];

  const resultados = ofensivo
    ? [
        ["Posicional", "mantenemos el balón y seguimos jugando."],
        ["Posicional Rival", "perdemos la posesión: el rival se queda con el balón."],
        ["Conquista último tercio", "llegamos al último tercio rival."],
        ["Receptor «Medios»", "el saque va a los centrocampistas (no a defensas ni delanteros)."],
      ]
    : [
        ["Posicional", "recuperamos el balón y seguimos jugando."],
        ["Posicional Rival", "el rival mantiene el balón."],
        ["Conquista último tercio", "el rival llega al último tercio (peligro concedido)."],
        ["Receptor «Medios»", "el rival saca a sus centrocampistas."],
      ];

  return (
    <div className={className}>
    {/* Las dos cifras que se confunden, dichas a la vista y no sólo al
        desplegar (30/10/2026, expertos). */}
    <p className="mb-2 px-1 text-[12px] leading-snug text-white/60">
      <b className="font-semibold text-white/80">Hacia delante o al área</b> mide hacia dónde va el envío;{" "}
      <b className="font-semibold text-white/80">llegan a último tercio</b> mide cómo acaba la jugada (último tercio, ocasión o gol){ofensivo ? "" : " del rival"}.
    </p>
    {/* Con aspecto de botón —icono, borde y flecha— como el de Filtros: antes
        parecía un rótulo y nadie lo abría (30/10/2026). */}
    <details className="group rounded-2xl border border-white/10 bg-white/[0.03]">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-white/80 transition hover:text-white marker:hidden [&::-webkit-details-marker]:hidden">
        <Info size={15} className="shrink-0 text-[#C8A96B]" aria-hidden />
        <span className="min-w-0 flex-1">Qué significan las zonas y los tipos de saque</span>
        <ChevronDown size={16} className="shrink-0 text-white/50 transition group-open:rotate-180" aria-hidden />
      </summary>

      <div className="grid gap-4 px-4 pb-3 text-[12px] leading-relaxed text-white/65 sm:grid-cols-2">
        <dl className="space-y-1.5">
          {zonas.map(([termino, texto]) => (
            <div key={termino}>
              <dt className="inline font-semibold text-white/85">{termino}: </dt>
              <dd className="inline">{texto}</dd>
            </div>
          ))}
        </dl>

        <dl className="space-y-1.5">
          {resultados.map(([termino, texto]) => (
            <div key={termino}>
              <dt className="inline font-semibold text-white/85">{termino}: </dt>
              <dd className="inline">{texto}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
    </div>
  );
}

export default LeyendaSaques;
