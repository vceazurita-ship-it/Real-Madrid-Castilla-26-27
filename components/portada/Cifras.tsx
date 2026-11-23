"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { CifraRueda } from "@/components/ui/CifraRueda";
import { AnilloVivo, Sparkline, Variacion } from "@/components/ui/GraficosVivos";
import { chipInk } from "@/lib/theme";
import { trackModuleVisit } from "@/lib/module-usage";

/**
 * LAS CIFRAS DEL EQUIPO, EN UNA SOLA FILA.
 *
 * Antes eran dos secciones de tres tarjetas cada una —seguimiento y modelo de
 * juego— que ocupaban media pantalla para enseñar seis números. Aquí van las
 * seis en un mismo panel, de un vistazo, y las áreas de trabajo quedan a la
 * altura de la vista sin tener que bajar.
 *
 * Cada celda sigue diciendo **a dónde lleva**: el rótulo nombra el dato y el
 * pie, la pantalla. Un número que es un enlace sin decirlo es una trampa.
 */

export type Cifra = {
  href: string;
  label: string;
  /** `null` cuando la hoja no ha contestado: se pinta «—», nunca un cero falso. */
  value: number | null;
  caption: string;
  destino: string;
  loading: boolean;
  icon: React.ElementType;
  /** Con color, la celda identifica algo (la fase del juego); sin él va en dorado. */
  color?: string;
  suffix?: string;
  /** Anillo de progreso (0-100) al lado de la cifra (22/11/2026). */
  progreso?: number;
  /** Curva de la cifra en el tiempo y su variación (22/11/2026). */
  serie?: { valores: number[]; descripcion: string; textoVariacion?: string };
};

function Numero({ value, loading }: { value: number | null; loading: boolean }) {
  if (loading) {
    return (
      <span
        aria-hidden
        className="inline-block h-[0.8em] w-[2.2ch] animate-pulse rounded-md bg-white/10 align-baseline"
      />
    );
  }

  /* Un cero diría «no hay seguimientos» cuando lo que pasa es que la hoja
     no ha llegado: la raya se lee como lo que es, un dato que falta. */
  if (value === null) {
    return (
      <span className="text-white/45" title="Sin datos: la hoja no ha contestado">
        —
      </span>
    );
  }

  return <CifraRueda valor={value} className="tabular-nums" />;
}

export function Cifras({ cifras }: { cifras: Cifra[] }) {
  return (
    /*
    | Tantas columnas como casillas (30/10/2026): con `xl:grid-cols-6` y dos
    | casillas quedaban dos tercios de panel en blanco a la derecha. `auto-fit`
    | pliega las pistas vacías y las que hay se reparten el ancho.
    */
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}
    >
      {cifras.map((cifra) => {
        const Icon = cifra.icon;

        const accent = chipInk(cifra.color ?? "#D8B45A");

        return (
          <Link
            key={cifra.href + cifra.label}
            href={cifra.href}
            onClick={() => trackModuleVisit(cifra.href)}
            style={{ ["--accent" as string]: accent }}
            className="portada-celda portada-viva foco-luz foco-capa group relative flex flex-col justify-between gap-4 p-4 sm:p-5"
          >

            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                {cifra.label}
              </p>

              <Icon className="h-4 w-4 shrink-0 text-white/30 transition-colors group-hover:text-[color:var(--accent)]" />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="fuente-club text-[48px] font-bold leading-[0.9] text-white">
                  <Numero value={cifra.value} loading={cifra.loading} />

                  {cifra.suffix && (
                    <span className="ml-1 text-[22px] font-bold text-white/55">
                      {cifra.suffix}
                    </span>
                  )}
                </p>

                {cifra.progreso != null && !cifra.loading && (
                  <AnilloVivo pct={cifra.progreso} lado={60} grosor={5} descripcion={`${Math.round(cifra.progreso)} %`}>
                    <span className="text-[11px] font-bold tabular-nums text-white/80">{Math.round(cifra.progreso)} %</span>
                  </AnilloVivo>
                )}
              </div>

              {cifra.serie && cifra.serie.valores.length > 1 && !cifra.loading && (
                <div className="mt-3">
                  <Sparkline valores={cifra.serie.valores} descripcion={cifra.serie.descripcion} alto={40} />
                  <Variacion
                    actual={cifra.serie.valores[cifra.serie.valores.length - 1]}
                    anterior={cifra.serie.valores[cifra.serie.valores.length - 2]}
                    texto={cifra.serie.textoVariacion}
                  />
                </div>
              )}

              <p className="mt-2 text-[13px] leading-snug text-white/70">{cifra.caption}</p>

              <p className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--accent)] transition-colors duration-300">
                {cifra.destino}
                <ChevronRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default Cifras;
