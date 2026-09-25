"use client";

/**
 * CÓMO SE PONE AL DÍA ESTO, CON LA CARPETA QUE SEA.
 *
 * El análisis **no se puede lanzar desde el navegador**, y decirlo aquí evita
 * que alguien busque un botón que no existe: hay que sacar un fotograma por
 * segundo de veintitantos vídeos de medio giga con el ffmpeg del proyecto, y
 * después mirarlos uno a uno. Lo primero no pasa por una página web y lo
 * segundo tampoco.
 *
 * Lo que sí se puede es quitar de en medio la única parte que cambia cada
 * semana —**dónde están los clips**— y escupir las órdenes ya hechas con esa
 * ruta dentro, listas para pegar en la consola del ordenador del club. Antes
 * esa ruta estaba escrita dentro de un script y había que abrirlo para
 * cambiarla.
 *
 * Sirve igual para faltas y para saques de banda: es el mismo preparado de
 * clips y el mismo etiquetado, sólo cambia la carpeta y el manual.
 */

import { useMemo, useState } from "react";
import { Check, Copy, TerminalSquare } from "lucide-react";

import { Panel } from "@/components/abp/ui";

/** Windows escribe las rutas con barra invertida y la consola se atraganta. */
const conBarras = (ruta: string) => ruta.trim().replace(/\\/g, "/").replace(/\/+$/, "");

export function ComoActualizar({
  carpetaPorDefecto = "",
}: {
  carpetaPorDefecto?: string;
}) {
  const [carpeta, setCarpeta] = useState(carpetaPorDefecto);
  const [copiada, setCopiada] = useState<string | null>(null);

  const base = useMemo(() => conBarras(carpeta) || "C:/ruta/a/los/clips", [carpeta]);

  const ordenes = useMemo(
    () => [
      {
        clave: "of",
        titulo: "1 · Preparar los clips de faltas a favor",
        orden: `node scripts/abp-clips-preparar.mjs --carpeta "${base}/FALTA OF" --salida .cache/clips/falta-of`,
      },
      {
        clave: "def",
        titulo: "2 · Y los de faltas en contra",
        orden: `node scripts/abp-clips-preparar.mjs --carpeta "${base}/FALTA DEF" --salida .cache/clips/falta-def`,
      },
      {
        clave: "datos",
        titulo: "3 · Cuando estén etiquetados, rehacer los datos de la pantalla",
        orden: "node scripts/faltas-datos.mjs",
      },
    ],
    [base],
  );

  const copia = async (clave: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);

      setCopiada(clave);

      /* Sin reloj ni estado que limpiar: se queda marcado hasta la siguiente. */
    } catch {
      setCopiada(null);
    }
  };

  return (
    <Panel
      title="Poner al día el análisis"
      subtitle="Se lanza en el ordenador del club, no desde aquí: son veintitantos vídeos de medio giga"
      icon={TerminalSquare}
    >
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          Carpeta de los clips de esta jornada
        </span>

        <input
          value={carpeta}
          onChange={(e) => setCarpeta(e.target.value)}
          placeholder="C:\\Users\\...\\ABP vs SANT ANDREU"
          spellCheck={false}
          className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
        />

        <span className="mt-1 block text-[11ash] text-[11px] text-white/35">
          La de arriba, la que contiene <code>FALTA OF</code> y{" "}
          <code>FALTA DEF</code>. Pégala tal cual: las barras se arreglan solas.
        </span>
      </label>

      <div className="mt-4 space-y-3">
        {ordenes.map((una) => (
          <div key={una.clave}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/45">{una.titulo}</span>

              <button
                type="button"
                onClick={() => copia(una.clave, una.orden)}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/45 transition hover:border-white/30 hover:text-white"
              >
                {copiada === una.clave ? <Check size={11} /> : <Copy size={11} />}
                {copiada === una.clave ? "Copiada" : "Copiar"}
              </button>
            </div>

            <pre className="mt-1 overflow-x-auto rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-[#E4CE9B]">
              {una.orden}
            </pre>
          </div>
        ))}
      </div>

      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-white/40">
        El paso de en medio —mirar las imágenes y escribir un CSV por tanda— es
        el que cuesta: son unos veinte minutos de vídeo por partido y hay que
        mirarlo entero. Los CSV van a{" "}
        <code>Downloads/RMCF CASTILLA/ANALISIS FALTAS/&lt;partido&gt;/</code>, y
        el paso 3 los convierte en lo que enseña esta pantalla. Para una jornada
        nueva hay que añadirla a <code>PARTIDOS</code>, arriba de{" "}
        <code>scripts/faltas-datos.mjs</code>: son cuatro líneas con la jornada,
        el rival y esta misma carpeta.
      </p>

      <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-white/40">
        Los saques de banda se preparan igual, cambiando la carpeta por{" "}
        <code>SDB OF</code> y <code>SDB DEF</code>.
      </p>
    </Panel>
  );
}
