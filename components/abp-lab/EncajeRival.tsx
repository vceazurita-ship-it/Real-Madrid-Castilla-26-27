"use client";

/**
 * ¿ENCAJA ESTA RUTINA CONTRA ESTE RIVAL? (taller del laboratorio, 21/10/2026)
 *
 * Cruza la rutina —su tipo y su lado— con lo que Wyscout mide del rival en
 * nuestra liga (`public/data/abp-ligas.json`):
 * - una rutina a favor se mira contra lo que el rival CONCEDE en ese tipo
 *   (de cada 100 córners suyos en contra, cuántos acaban en remate);
 * - una en contra, contra lo que el rival GENERA.
 *
 * El rival por defecto es el del próximo partido. Wyscout no dice si un
 * equipo defiende en zona o al hombre, así que eso no se afirma: se
 * compara su número con el resto de la liga, con la base debajo. Si el
 * tipo no tiene medida (penalti, saque de centro) o la liga no está, no se
 * pinta nada.
 */

import { useMemo, useState } from "react";
import { Crosshair } from "lucide-react";

import { Select } from "@/components/abp/ui";
import { useAbpLigas, useProximoRival } from "@/hooks/useAbpLigas";
import { METRICA, baseDe, equipoQueCasa, partidosDe, posicionEn, tablaDe } from "@/lib/abp-ligas/modelo";
import type { Lado } from "@/lib/abp-lab/modelo";
import type { TipoAbp } from "@/lib/abp-lab/referentes";
import { mismoClub } from "@/lib/rivals/mismoClub";

/** Qué se mira del rival y qué de nosotros, según el tipo y el lado. */
const MIRA: Partial<Record<TipoAbp, Record<Lado, { suya: string; nuestra: string; volumen?: string; que: string }>>> = {
  corner: {
    ofensivo: { suya: "corPctC", nuestra: "corPctF", volumen: "corC", que: "córners" },
    defensivo: { suya: "corPctF", nuestra: "corPctC", volumen: "corF", que: "córners" },
  },
  falta: {
    ofensivo: { suya: "falPctC", nuestra: "falPctF", que: "faltas" },
    defensivo: { suya: "falPctF", nuestra: "falPctC", que: "faltas" },
  },
  banda: {
    ofensivo: { suya: "abpPctC", nuestra: "abpPctF", que: "jugadas a balón parado" },
    defensivo: { suya: "abpPctF", nuestra: "abpPctC", que: "jugadas a balón parado" },
  },
};

/** Un número con un decimal y coma, como se escribe aquí. */
const coma = (v: number, decimales = 1) => v.toFixed(decimales).replace(".", ",");

/** Por debajo de esta base, el número es una pista, no una regla (lo mismo que en los informes). */
const BASE_CORTA = 15;

export function EncajeRival({ tipo, lado }: { tipo: TipoAbp; lado: Lado }) {
  const { datos } = useAbpLigas();

  const proximo = useProximoRival();

  const [elegido, setElegido] = useState("");

  /* Nuestra liga: la que tiene al Castilla. */
  const liga = useMemo(() => datos?.ligas.find((l) => equipoQueCasa(l, "Castilla")) ?? null, [datos]);

  const tabla = useMemo(() => (liga ? tablaDe(liga) : []), [liga]);

  const nosotros = liga ? equipoQueCasa(liga, "Castilla") : "";

  const rivales = useMemo(() => (liga ? liga.equipos.filter((e) => e !== nosotros) : []), [liga, nosotros]);

  const delProximo = proximo ? (rivales.find((e) => mismoClub(e, proximo)) ?? "") : "";

  const rival = elegido && rivales.includes(elegido) ? elegido : delProximo || rivales[0] || "";

  const mira = MIRA[tipo]?.[lado];

  if (!liga || !mira || !rival) return null;

  const m = METRICA[mira.suya];

  const suya = posicionEn(tabla, rival, m);

  const nuestra = posicionEn(tabla, nosotros, METRICA[mira.nuestra]);

  const volumen = mira.volumen ? posicionEn(tabla, rival, METRICA[mira.volumen]) : null;

  const base = baseDe(
    partidosDe(liga).filter((p) => p.equipo === rival),
    m,
  );

  if (suya.valor === null || suya.percentil === null) return null;

  const p = suya.percentil;

  /*
   * El percentil ya va orientado a «qué bien está» el rival en eso: en lo que
   * concede, alto = concede poco (malo para nuestra rutina a favor); en lo que
   * genera, alto = genera mucho (peligro para la que defendemos).
   */
  const tono = p >= 67 ? "duro" : p <= 33 ? "bueno" : "medio";

  const frase =
    lado === "ofensivo"
      ? { duro: "Lo defienden bien: aquí hará falta la sorpresa.", bueno: "Aquí sufren: buen terreno para esta rutina.", medio: "En la media de la liga." }[tono]
      : { duro: "Es su fuerte: esta rutina defensiva es prioridad.", bueno: "Les cuesta generar así: no es donde más aprietan.", medio: "En la media de la liga." }[tono];

  const color = tono === "bueno" ? "#34D399" : tono === "duro" ? "#F87171" : "#C8A96B";

  const dice = `${coma(suya.valor)} de cada 100 ${mira.que} ${lado === "ofensivo" ? "en contra" : "a favor"} acaban en remate`;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" aria-label="Encaje con el rival">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            <Crosshair size={12} className="text-[#C8A96B]" />
            Encaje con el rival
          </p>
          <p className="mt-1 text-[11.5px] text-white/45">
            {liga.nombre} · Wyscout{rival === delProximo ? " · el próximo rival" : ""}
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select label="Rival" value={rival} options={rivales} onChange={setElegido} />
        </div>
      </div>

      <p className="mt-4 text-lg font-semibold leading-snug text-white">{frase}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-white/65">
        {rival}: {dice} ({suya.puesto}.º de {suya.de} {lado === "ofensivo" ? "que menos concede" : "que más genera"}; la mediana, {coma(suya.mediana ?? suya.valor)}).
      </p>

      {/* La regla: de «les cuesta» a «es su fuerte», con el rival encima */}
      <div className="mt-4" aria-hidden>
        <div className="relative h-2 rounded-full" style={{ background: "linear-gradient(90deg, rgba(52,211,153,.55), rgba(200,169,107,.45), rgba(248,113,113,.55))" }}>
          <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${p}%`, background: color }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[10.5px] text-white/40">
          <span>{lado === "ofensivo" ? "Conceden mucho" : "Generan poco"}</span>
          <span>{lado === "ofensivo" ? "Conceden poco" : "Generan mucho"}</span>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-[12px] leading-snug text-white/55">
        {volumen?.valor != null && volumen.mediana != null && (
          <li>
            {lado === "ofensivo" ? "Conceden" : "Sacan"} {coma(volumen.valor)} {mira.que} por partido (la mediana, {coma(volumen.mediana)}).
          </li>
        )}
        {nuestra.valor != null && nuestra.puesto != null && (
          <li>
            Nosotros: {coma(nuestra.valor)} de cada 100 {lado === "ofensivo" ? "a favor" : "en contra"} ({nuestra.puesto}.º de {nuestra.de}).
          </li>
        )}
        <li>
          Base: {base} {mira.que} del {rival} esta temporada{base < BASE_CORTA ? "; con tan pocos, es una pista, no una regla" : ""}.
        </li>
      </ul>
    </section>
  );
}
