"use client";

/**
 * QUÉ PAREJAS DEL ONCE SE POTENCIAN Y CUÁLES SE PISAN.
 *
 * Una tarjeta por pareja, con su veredicto y **las dos cifras que lo
 * sostienen**: sin eso sería un oráculo, y un oráculo no se discute en una
 * reunión de cuerpo técnico. El cálculo vive en `lib/data-analisis/sinergias.ts`;
 * aquí sólo se pinta.
 *
 * Lo primero que se lee es el aviso de qué es esto: **compara perfiles**, no
 * mide lo que pasa cuando juegan juntos. Para lo segundo hacen falta partidos
 * valorados, y la tarjeta los cuenta.
 */

import { ArrowLeftRight, Check, CircleSlash, Minus, X } from "lucide-react";

import { EmptyState, Notice } from "@/components/abp/ui";
import { MEJOR, ORO, PEOR } from "@/components/data/graficas";
import {
  MINIMO_JUNTOS,
  type EstadoRelacion,
  type Pareja,
} from "@/lib/data-analisis/sinergias";

const CHAPA: Record<
  Pareja["etiqueta"],
  { color: string; fondo: string; borde: string }
> = {
  "Se potencian": {
    color: MEJOR,
    fondo: "rgb(27 158 119 / 0.10)",
    borde: "rgb(27 158 119 / 0.45)",
  },
  "Sin roce": {
    color: ORO,
    fondo: "rgb(200 169 107 / 0.08)",
    borde: "rgb(200 169 107 / 0.30)",
  },
  "Se estorban": {
    color: PEOR,
    fondo: "rgb(217 95 2 / 0.10)",
    borde: "rgb(217 95 2 / 0.45)",
  },
};

const ICONO: Record<EstadoRelacion, typeof Check> = {
  potencia: Check,
  media: Minus,
  hueco: CircleSlash,
  pisan: X,
};

const COLOR: Record<EstadoRelacion, string> = {
  potencia: MEJOR,
  media: "rgb(255 255 255 / 0.35)",
  hueco: PEOR,
  pisan: PEOR,
};

export function PanelSinergias({
  parejas,
  ambito,
}: {
  parejas: Pareja[];
  /** Contra quién se han medido los percentiles, para poder decirlo. */
  ambito: string;
}) {
  if (parejas.length === 0) {
    return (
      <EmptyState
        title="No hay parejas que juzgar con este once"
        description="Hacen falta las cifras de Wyscout de los dos jugadores de cada pareja. Cambia a alguien del once o revisa quién tiene datos."
      />
    );
  }

  const potencian = parejas.filter((una) => una.etiqueta === "Se potencian").length;

  const estorban = parejas.filter((una) => una.etiqueta === "Se estorban").length;

  return (
    <div className="min-w-0">
      <Notice tone="info" title="Qué es esto, y qué no">
        <ul className="space-y-1">
          <li>
            Compara <strong className="text-white/75">perfiles</strong>: si lo que
            hace uno le hace falta al otro (se potencian) o es lo mismo que ya
            hace el otro (se pisan, y esa función se queda sin cubrir). Cada
            veredicto lleva debajo las dos cifras de las que sale, medidas contra{" "}
            {ambito.toLowerCase()}.
          </li>
          <li>
            <strong className="text-white/75">No mide lo que pasa cuando juegan
            juntos.</strong>{" "}
            Para eso harían falta alineaciones de muchos partidos: el log de Opta
            no las trae y Wyscout da la temporada entera en una fila. Lo único
            que sabe quién jugó cada partido son nuestras valoraciones, y cada
            tarjeta dice cuántas lleva esa pareja.
          </li>
          <li>
            {potencian} parejas se potencian y {estorban} se estorban de las{" "}
            {parejas.length} que comparten banda, línea o jugada. El resto del
            once no se cruza, así que no se inventa una tarjeta.
          </li>
        </ul>
      </Notice>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {parejas.map((pareja) => (
          <Tarjeta key={pareja.clave} pareja={pareja} />
        ))}
      </div>
    </div>
  );
}

function Tarjeta({ pareja }: { pareja: Pareja }) {
  const chapa = CHAPA[pareja.etiqueta];

  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-white">
            {pareja.a.nombre}
            <ArrowLeftRight size={12} className="shrink-0 text-white/30" aria-hidden />
            {pareja.b.nombre}
          </h3>

          <p className="mt-0.5 text-[11px] text-white/35">
            {pareja.a.sitio.wyscout || pareja.a.puesto} ·{" "}
            {pareja.b.sitio.wyscout || pareja.b.puesto}
          </p>
        </div>

        <span
          className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium"
          style={{
            color: chapa.color,
            background: chapa.fondo,
            borderColor: chapa.borde,
          }}
        >
          {pareja.etiqueta}
        </span>
      </header>

      <ul className="mt-3 space-y-2.5">
        {pareja.veredictos.map((veredicto) => {
          const Icono = ICONO[veredicto.estado];

          return (
            <li key={veredicto.relacion.clave} className="flex gap-2">
              <Icono
                size={13}
                className="mt-0.5 shrink-0"
                style={{ color: COLOR[veredicto.estado] }}
                aria-hidden
              />

              <div className="min-w-0">
                <p
                  className="text-[12px] font-medium text-white/80"
                  title={veredicto.relacion.explica}
                >
                  {veredicto.relacion.nombre}
                </p>

                <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
                  {veredicto.texto}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {pareja.medida && <Medida medida={pareja.medida} />}
    </article>
  );
}

/**
 * Lo medido: partidos juntos y nota.
 *
 * Mientras no haya partidos suficientes **se dice cuántos faltan** en vez de
 * enseñar una media de dos: una cifra pequeña con aspecto de dato es peor que
 * no tener el dato.
 */
function Medida({ medida }: { medida: NonNullable<Pareja["medida"]> }) {
  const nota = (valor: number | null) =>
    valor === null ? "—" : valor.toFixed(1).replace(".", ",");

  return (
    <footer className="mt-3 border-t border-white/[0.07] pt-2.5 text-[11px] text-white/40">
      {medida.fiable ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Juntos <strong className="text-white/70">{medida.juntos}</strong>{" "}
            partidos valorados: nota media{" "}
            <strong className="text-white/70">{nota(medida.notaJuntos)}</strong>
          </span>

          <span>
            Por separado ({medida.sueltos}):{" "}
            <strong className="text-white/70">{nota(medida.notaSueltos)}</strong>
          </span>

          {medida.golesJuntos && (
            <span>
              {medida.golesJuntos.favor.toFixed(1).replace(".", ",")} goles a favor
              y {medida.golesJuntos.contra.toFixed(1).replace(".", ",")} en contra
              por partido
            </span>
          )}
        </span>
      ) : (
        <span>
          Han jugado juntos {medida.juntos}{" "}
          {medida.juntos === 1 ? "partido valorado" : "partidos valorados"}. Con{" "}
          {MINIMO_JUNTOS} empezará a poder compararse su rendimiento juntos y por
          separado; hasta entonces, arriba sólo hay perfiles.
        </span>
      )}
    </footer>
  );
}
