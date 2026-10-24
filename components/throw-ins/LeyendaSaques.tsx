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
    <details className={`group rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 ${className}`}>
      <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.18em] text-[#C8A96B] marker:hidden">
        Qué significan las zonas y los tipos de saque
        <span className="ml-2 text-white/40 group-open:hidden">· desplegar</span>
      </summary>

      <div className="mt-3 grid gap-4 text-[12px] leading-relaxed text-white/65 sm:grid-cols-2">
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
  );
}

export default LeyendaSaques;
