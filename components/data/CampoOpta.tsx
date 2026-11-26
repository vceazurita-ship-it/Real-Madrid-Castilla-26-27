"use client";

/**
 * EL PARTIDO EN EL CAMPO, CON LAS CIFRAS DE OPTA (26/11/2026).
 *
 * El analista: «el cara a cara de Opta podría estar justificado a la izquierda
 * y a la derecha el visualizador de partido en el campo, como lo hacemos con
 * los datos de Wyscout». Es el mismo dibujo que «Partido en el campo» de
 * Wyscout (components/data/Campograma.tsx): cada cifra donde pasa, el campo
 * atacando hacia la derecha, en verde lo que mejora nuestra media y en naranja
 * lo que la empeora. La media es la del Castilla en Opta SIN este partido (la
 * misma que usa el cara a cara de al lado). Con balón y sin balón.
 *
 * Opta cuenta distinto que Wyscout: estas cifras se comparan sólo con lo de
 * Opta.
 */

import { useMemo, useState } from "react";

import { Campograma } from "@/components/data/Campograma";
import { Botonera } from "@/app/opta/_piezas/comun";
import type { DatosOpta } from "@/app/opta/_piezas/useOpta";
import type { FichaCampo, ValorFicha } from "@/lib/data-analisis/campograma";
import { CASTILLA_OPTA } from "@/lib/opta";

type Unidad = ValorFicha["unidad"];
type Def = FichaCampo & { unidad: Unidad; mejorAlto: boolean | null; pct?: boolean };

/* Dónde va cada cifra (x hacia la portería rival, y de arriba abajo), como en el de Wyscout. */
const FICHAS: Record<"con" | "sin", Def[]> = {
  con: [
    { metrica: "Poss%", rotulo: "Posesión", x: 50, y: 50, unidad: "porcentaje", pct: true, mejorAlto: null, nota: "Cuánto fue nuestro el balón. Sola no dice nada: hay que ver en qué se convirtió." },
    { metrica: "PsAtt", rotulo: "Pases", x: 28, y: 24, unidad: "entero", mejorAlto: null, nota: "Pases intentados: cuánto se tocó, no lo bien que se tocó." },
    { metrica: "Pass%", rotulo: "Acierto de pase", x: 28, y: 78, unidad: "porcentaje", pct: true, mejorAlto: true, nota: "Pases buenos sobre intentados." },
    { metrica: "Ps%InA3rd", rotulo: "Acierto en el último tercio", x: 70, y: 18, unidad: "porcentaje", pct: true, mejorAlto: true, nota: "Pases buenos en el tercio de ataque: donde cuesta más." },
    { metrica: "Chance", rotulo: "Ocasiones creadas", x: 74, y: 84, unidad: "entero", mejorAlto: true, nota: "Pases que acaban en remate." },
    { metrica: "TouchOpBox", rotulo: "Toques en el área", x: 90, y: 36, unidad: "entero", mejorAlto: true, nota: "Balones tocados dentro del área rival: cuánta gente llega." },
    { metrica: "ExpG", rotulo: "xG", x: 92, y: 64, unidad: "decimal", mejorAlto: true, nota: "Goles esperados por la calidad de los remates." },
  ],
  sin: [
    { metrica: "PPDA", rotulo: "PPDA", x: 64, y: 50, unidad: "decimal", mejorAlto: false, nota: "Pases que deja dar el rival por cada acción defensiva nuestra: más bajo, más presión." },
    { metrica: "PosWonA3rd", rotulo: "Recuperaciones altas", x: 84, y: 24, unidad: "entero", mejorAlto: true, nota: "Balones ganados en el tercio de ataque." },
    { metrica: "Recovery", rotulo: "Recuperaciones", x: 46, y: 78, unidad: "entero", mejorAlto: true, nota: "Balones sueltos que acabamos teniendo." },
    { metrica: "Duel%", rotulo: "Duelos ganados", x: 44, y: 22, unidad: "porcentaje", pct: true, mejorAlto: true, nota: "Duelos ganados sobre jugados." },
    { metrica: "Aerial%", rotulo: "Aéreos ganados", x: 26, y: 50, unidad: "porcentaje", pct: true, mejorAlto: true, nota: "Duelos por arriba ganados sobre jugados." },
    { metrica: "ShotsAg", rotulo: "Remates en contra", x: 10, y: 30, unidad: "entero", mejorAlto: false, contra: true, nota: "Remates que nos hicieron." },
    { metrica: "ExpGAg", rotulo: "xG en contra", x: 9, y: 70, unidad: "decimal", mejorAlto: false, contra: true, nota: "La calidad de lo que nos remataron." },
  ],
};

const fechaCorta = (iso: string) => (iso ? iso.slice(5, 10).split("-").reverse().join("/") : "");

export function CampoOpta({ datos, partido, rival, marcador, fecha }: { datos: DatosOpta; partido: string; rival: string; marcador?: string; fecha?: string }) {
  const [momento, setMomento] = useState<"con" | "sin">("con");

  const fichas = useMemo<ValorFicha[]>(() => {
    const nuestras = datos.partidos.filter((f) => f.teamId === CASTILLA_OPTA);
    const fila = nuestras.find((f) => String(f.partido ?? "") === partido);
    const resto = nuestras.filter((f) => String(f.partido ?? "") !== partido);
    const valor = (f: (typeof nuestras)[number] | undefined, d: Def) => {
      const v = f?.[d.metrica];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      return d.pct && v <= 1 ? v * 100 : v;
    };
    return FICHAS[momento].map((d) => {
      const p = valor(fila, d);
      const vs = resto.map((f) => valor(f, d)).filter((v): v is number => v != null);
      const media = vs.length >= 3 ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
      const cambio = p != null && media ? ((p - media) / Math.abs(media)) * 100 : null;
      const diferencia = cambio == null || d.mejorAlto == null ? null : d.mejorAlto ? cambio : -cambio;
      const { unidad, mejorAlto, pct: _pct, ...ficha } = d;
      void _pct;
      return { ficha, nombre: d.rotulo, unidad, mejorAlto, partido: p, media, cambio, diferencia };
    });
  }, [datos.partidos, momento, partido]);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Botonera
          etiqueta="Momento del juego"
          valor={momento}
          alCambiar={(v) => setMomento(v as "con" | "sin")}
          opciones={[
            { clave: "con", nombre: "Con balón" },
            { clave: "sin", nombre: "Sin balón" },
          ]}
        />
        <span className="text-[11px] text-white/45">Color: frente a nuestra media en Opta · ataca hacia la derecha</span>
      </div>
      <Campograma fichas={fichas} lado="partido" titulo={`vs ${rival}${marcador ? ` · ${marcador}` : ""}`} subtitulo={fecha ? `${fechaCorta(fecha)} · Opta` : "Opta"} />
    </div>
  );
}
