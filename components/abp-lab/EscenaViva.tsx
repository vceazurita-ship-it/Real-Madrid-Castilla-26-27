"use client";

/**
 * LA ESCENA QUE SE MUEVE (laboratorio de ABP, 24/10/2026).
 *
 * Es la única pieza que escucha al reloj (`useT`): en cada fotograma se
 * vuelve a dibujar ella y nada más —ni la barra de herramientas, ni las
 * lecturas, ni el estudio—. Además lleva la transición de cámara: al cambiar
 * de plano o de encuadre, el campo vuela de uno a otro en 0,65 s
 * (`mezclaCamaras`), salvo con «reducir movimiento» o mientras se exporta.
 */

import { memo, useEffect, useState, type Ref } from "react";

import type { JugadorLab } from "@/components/abp-lab/comun";
import { Escena, type Capas, type ManejadoresEscena, type Paleta } from "@/components/abp-lab/Escena";
import { useT, type Reloj } from "@/components/abp-lab/LineaTiempo";
import { useSimulacionEn, type RutinaSimulable, type SimulacionFija } from "@/components/abp-lab/useSimulacion";
import { mezclaCamaras, type Camara } from "@/lib/abp-lab/camara";

const DURACION = 650;

const quieto = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/* Arranca y frena suave, como una grúa de televisión. */
const suave = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

type Viaje = { desde: Camara; hasta: Camara; k: number };

/** La cámara que se ve: la pedida o, durante 0,65 s tras un cambio, la mezcla de la anterior con ella. */
export function useCamaraSuave(destino: Camara, sinTransicion = false): Camara {
  const [previa, setPrevia] = useState(destino);

  const [viaje, setViaje] = useState<Viaje | null>(null);

  const enPantalla = viaje ? mezclaCamaras(viaje.desde, viaje.hasta, suave(viaje.k)) : previa;

  if (previa !== destino) {
    setPrevia(destino);
    setViaje(sinTransicion || quieto() ? null : { desde: enPantalla, hasta: destino, k: 0 });
  }

  const hasta = viaje?.hasta;

  useEffect(() => {
    if (!hasta) return;

    let marco = 0;

    const inicio = performance.now();

    const paso = (ms: number) => {
      const k = Math.min(1, (ms - inicio) / DURACION);

      if (k >= 1) {
        setViaje(null);

        return;
      }

      setViaje((v) => (v && v.hasta === hasta ? { ...v, k } : v));
      marco = requestAnimationFrame(paso);
    };

    marco = requestAnimationFrame(paso);

    return () => cancelAnimationFrame(marco);
  }, [hasta]);

  return sinTransicion ? destino : enPantalla;
}

export const EscenaViva = memo(function EscenaViva({
  id,
  reloj,
  rutina,
  porId,
  cam,
  paleta,
  fija,
  capas,
  seleccionado = null,
  editaBalon = false,
  fotos,
  svgRef,
  manejadores,
  cursor,
  etiqueta,
  className,
  sinTransicion = false,
}: {
  id: string;
  reloj: Pick<Reloj, "suscribe" | "ahora">;
  rutina: RutinaSimulable;
  porId: Map<string, JugadorLab>;
  cam: Camara;
  paleta: Paleta;
  fija: SimulacionFija;
  capas: Capas;
  seleccionado?: number | null;
  editaBalon?: boolean;
  fotos?: Map<string, string>;
  svgRef?: Ref<SVGSVGElement>;
  manejadores?: ManejadoresEscena;
  cursor?: string;
  etiqueta: string;
  className?: string;
  sinTransicion?: boolean;
}) {
  const t = useT(reloj);

  const en = useSimulacionEn(rutina, fija, t, capas.ventaja);

  const camara = useCamaraSuave(cam, sinTransicion);

  return (
    <Escena
      id={id}
      svgRef={svgRef}
      rutina={rutina}
      porId={porId}
      t={t}
      cam={camara}
      paleta={paleta}
      nuestros={en.nuestros}
      defensa={en.defensa}
      capas={capas}
      celdas={en.celdas}
      libres={en.libres}
      duelos={en.duelos}
      llegada={capas.llegada ? fija.llegada : undefined}
      remate={fija.remate}
      seleccionado={seleccionado}
      editaBalon={editaBalon}
      fotos={fotos}
      cursor={cursor}
      etiqueta={etiqueta}
      className={className}
      manejadores={manejadores}
    />
  );
});
