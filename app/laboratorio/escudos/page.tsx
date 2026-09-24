"use client";

/**
 * En obras · Escudos de la liga.
 *
 * Para qué sirve: bajarse los veinte escudos del grupo en un .pptx del que se
 * pueden sacar de uno en uno. Cada escudo es un objeto suelto de PowerPoint con
 * su PNG transparente dentro, así que se pincha, se copia y se pega en una
 * portada, en una convocatoria o en una pizarra sin recortar nada a mano.
 *
 * De dónde salen: de los escudos de BeSoccer que ya se bajan para el informe
 * del rival, así que se ponen al día solos con la jornada. Llegan en PNG de
 * 640×640 con canal alfa —el fondo ya viene quitado de origen— y aquí sólo se
 * les recorta el aire de los márgenes. El trabajo de verdad está en
 * `lib/laboratorio/escudos-liga.ts`.
 *
 * Está en obras porque la lista depende de que el documento del informe esté
 * bajado: si una jornada no se ha traído, puede faltar algún equipo. La
 * pantalla dice siempre cuántos ha encontrado.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, HardHat, Images, RefreshCw, ShieldCheck } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Panel } from "@/components/abp/ui";
import { descarga } from "@/lib/export/lienzos";
import {
  creaPptEscudos,
  nombreDelFichero,
  preparaEscudo,
  sinRepetidos,
  urlDeEscudo,
  type EscudoLiga,
  type EscudoListo,
} from "@/lib/laboratorio/escudos-liga";

type Estado = "cargando" | "listo" | "vacio" | "error";

export default function EscudosPage() {
  const [escudos, setEscudos] = useState<EscudoLiga[]>([]);
  const [estado, setEstado] = useState<Estado>("cargando");

  /** Cuántos escudos llevamos preparados mientras se arma el documento. */
  const [haciendo, setHaciendo] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /*
  | El testigo es lo que dispara la recarga.
  |
  | El linter marca un efecto que llame a una función que haga `setState`,
  | aunque sea después de un `await`: traza la función, no el momento. Así que
  | el fetch vive DENTRO del efecto y el botón sólo sube el contador. Es la
  | forma de `hooks/useRemoteDoc.ts`.
  */
  const [testigo, setTestigo] = useState(0);

  const pideLista = useCallback(() => setTestigo((n) => n + 1), []);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const respuesta = await fetch("/api/data-analisis?escudos=1");
        const datos = await respuesta.json();

        const lista = sinRepetidos(
          (Array.isArray(datos?.escudos) ? datos.escudos : []).map(
            (uno: { equipo?: string; escudo?: string }) => ({
              equipo: uno.equipo ?? "",
              url: uno.escudo ?? "",
            }),
          ),
        );

        if (cancelado) return;

        setEscudos(lista);
        setEstado(lista.length ? "listo" : "vacio");
      } catch (error) {
        console.error("[escudos] lista", error);

        if (!cancelado) setEstado("error");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [testigo]);

  const hojas = useMemo(() => Math.max(1, Math.ceil(escudos.length / 20)), [
    escudos.length,
  ]);

  /**
   * Arma el documento.
   *
   * Los escudos se preparan **de uno en uno y en el navegador**: hay que leer
   * los píxeles de cada uno en un lienzo para recortarlo, y veinte lienzos de
   * 640×640 a la vez es pedirle al móvil que se caiga. De paso el contador va
   * diciendo por dónde va, que con veinte imágenes se nota la espera.
   */
  const descargaPpt = useCallback(async () => {
    if (!escudos.length) return;

    setHaciendo(0);
    setAviso(null);

    const listos: EscudoListo[] = [];
    const fallidos: string[] = [];

    for (const uno of escudos) {
      try {
        listos.push(await preparaEscudo(uno));
      } catch (error) {
        console.error("[escudos] preparar", uno.equipo, error);
        fallidos.push(uno.equipo);
      }

      setHaciendo(listos.length + fallidos.length);
    }

    if (!listos.length) {
      setHaciendo(null);
      setAviso("No se ha podido preparar ningún escudo.");

      return;
    }

    descarga(creaPptEscudos(listos), nombreDelFichero());

    setHaciendo(null);
    setAviso(
      fallidos.length
        ? `Documento con ${listos.length} escudos. Se han quedado fuera: ${fallidos.join(", ")}.`
        : `Documento con ${listos.length} escudos, listo.`,
    );
  }, [escudos]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · En obras"
              title="Escudos de la liga"
              lead="Los escudos del grupo en un .pptx, cada uno como un objeto suelto con su PNG transparente: se copia y se pega donde haga falta."
              aside={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  <HardHat size={12} />
                  En obras
                </span>
              }
            />

            {/* ---------------- mandos ---------------- */}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={descargaPpt}
                disabled={estado !== "listo" || haciendo !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/15 px-4 py-2.5 text-sm font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={16} />
                {haciendo === null
                  ? `Descargar .pptx${escudos.length ? ` · ${escudos.length} escudos` : ""}`
                  : `Preparando ${haciendo} de ${escudos.length}…`}
              </button>

              <button
                type="button"
                onClick={pideLista}
                disabled={haciendo !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/70 transition hover:border-white/20 disabled:opacity-40"
              >
                <RefreshCw size={16} />
                Volver a pedir la lista
              </button>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/50">
                <Images size={12} />
                {hojas === 1 ? "Una diapositiva" : `${hojas} diapositivas`}
              </span>
            </div>

            {aviso ? (
              <p className="mt-3 rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.07] px-3 py-2 text-sm text-[#E4CE9B]">
                {aviso}
              </p>
            ) : null}

            {/* ---------------- lo que va a salir ---------------- */}

            <div className="mt-5">
              <Panel
                title="Lo que va a llevar el documento"
                subtitle="Sobre el azul noche de la plantilla, que es como se ve de un golpe si a algún escudo le quedara recuadro"
                icon={ShieldCheck}
              >
                {estado === "cargando" ? (
                  <p className="text-sm text-white/50">Pidiendo los escudos…</p>
                ) : null}

                {estado === "error" ? (
                  <p className="text-sm text-[#F6AFB6]">
                    No se ha podido leer la lista de escudos. Es el documento del
                    informe del rival: si no se ha bajado esta jornada, no hay de
                    dónde sacarlos.
                  </p>
                ) : null}

                {estado === "vacio" ? (
                  <p className="text-sm text-[#F6AFB6]">
                    La lista ha llegado vacía. Hay que bajar el documento del
                    informe del rival desde Ajustes · Poner al día.
                  </p>
                ) : null}

                {estado === "listo" ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {escudos.map((uno) => (
                      <figure
                        key={uno.url}
                        className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#04121F] p-3"
                      >
                        {/*
                          Sin `next/image`: son imágenes de otro origen que van
                          por el proxio de la casa, y aquí sólo hacen de vista
                          previa del documento.
                        */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={urlDeEscudo(uno.url)}
                          alt={uno.equipo}
                          className="h-16 w-16 object-contain"
                          loading="lazy"
                        />
                        <figcaption className="text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-[#E4CE9B]">
                          {uno.equipo}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : null}
              </Panel>
            </div>

            {/* ---------------- lectura ---------------- */}

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/45">
              Los escudos son los de BeSoccer, los mismos que ya usan el informe
              del rival y los gráficos de Data análisis, así que se ponen al día
              con la jornada sin tocar nada. Llegan en PNG de 640×640 con canal
              alfa: el fondo viene quitado de origen y aquí sólo se les recorta
              el aire de los márgenes, sin reescalarlos, para que el escudo que
              se pega conserve sus píxeles. Si alguno llegara con recuadro
              opaco, se le quita el fondo por los bordes antes de meterlo.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
