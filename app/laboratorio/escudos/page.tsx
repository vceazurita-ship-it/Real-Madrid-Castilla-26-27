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
import { Download, Images, RefreshCw, ShieldCheck } from "lucide-react";

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

/** Dos letras para el relleno de un escudo que aún no llega o que no llega. */
function inicialesDe(equipo: string) {
  const palabras = equipo
    .replace(/\b(CD|CF|UD|SD|AD|RC|FC|UE|CP|SC)\b/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

  const letras =
    palabras.length > 1
      ? palabras[0][0] + palabras[1][0]
      : (palabras[0] ?? equipo).slice(0, 2);

  return letras.toUpperCase();
}

export default function EscudosPage() {
  const [escudos, setEscudos] = useState<EscudoLiga[]>([]);
  const [estado, setEstado] = useState<Estado>("cargando");

  /* Qué le ha pasado a cada imagen: sin entrada = aún llegando. */
  const [imagenes, setImagenes] = useState<Record<string, "listo" | "fallo">>(
    {},
  );

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

  /* Con «Pidiendo…» a la vista: antes el botón no daba ninguna señal y la
     lista vieja se quedaba igual hasta que llegase la nueva (19/10/2026). */
  const pideLista = useCallback(() => {
    setEstado("cargando");
    setAviso(null);
    setImagenes({});
    setTestigo((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const respuesta = await fetch("/api/data-analisis?escudos=1");

        /* Un 500 con cuerpo de error se leía como «lista vacía» y mandaba a
           bajar un documento que a lo mejor ya estaba bajado. */
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

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

  const marca = useCallback((url: string, como: "listo" | "fallo") => {
    setImagenes((previo) =>
      previo[url] === como ? previo : { ...previo, [url]: como },
    );
  }, []);

  const faltan = escudos.filter((e) => imagenes[e.url] === "fallo");
  const conImagen = escudos.filter((e) => imagenes[e.url] === "listo").length;
  const pendientes = escudos.length - conImagen - faltan.length;

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
              area="RMCF Castilla · Laboratorio"
              title="Escudos de la liga"
              /* Desde el 13/10/2026 la lista trae los dos grupos de la
                 categoría (`escudos:categoria`), no sólo el nuestro: el
                 rótulo lo dice para que nadie busque «los veinte». */
              lead="Los escudos de la categoría en un .pptx, por orden alfabético: cada uno es un objeto suelto con su PNG transparente, que se copia y se pega donde haga falta."
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
                  ? `Descargar .pptx${escudos.length ? ` · ${escudos.length - faltan.length} escudos` : ""}`
                  : `Preparando ${haciendo} de ${escudos.length}…`}
              </button>

              <button
                type="button"
                onClick={pideLista}
                disabled={haciendo !== null || estado === "cargando"}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/70 transition hover:border-white/20 disabled:opacity-40"
              >
                <RefreshCw size={16} className={estado === "cargando" ? "animate-spin" : undefined} />
                Actualizar escudos
              </button>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/50">
                <Images size={12} />
                {hojas === 1 ? "Una diapositiva" : `${hojas} diapositivas`}
              </span>

              {estado === "listo" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/50">
                  <ShieldCheck size={12} />
                  {pendientes > 0
                    ? `${conImagen} de ${escudos.length} escudos cargados · ${pendientes} por llegar`
                    : `${conImagen} de ${escudos.length} escudos cargados`}
                </span>
              ) : null}
            </div>

            {estado === "listo" && faltan.length ? (
              <p
                style={{ color: "#F6AFB6" }}
                className="mt-3 rounded-xl border border-[#F6AFB6]/30 px-3 py-2 text-sm"
              >
                {faltan.length === 1 ? "Falta 1: " : `Faltan ${faltan.length}: `}
                {faltan.map((f) => f.equipo).join(", ")}. El .pptx saldrá sin{" "}
                {faltan.length === 1 ? "él" : "ellos"}; pulsa «Actualizar
                escudos» para reintentarlo.
              </p>
            ) : null}

            {aviso ? (
              <p className="mt-3 rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.07] px-3 py-2 text-sm text-[#E4CE9B]">
                {aviso}
              </p>
            ) : null}

            {/* ---------------- lo que va a salir ---------------- */}

            <div className="mt-5">
              <Panel
                title="Vista previa del documento"
                subtitle="Así salen sobre azul noche. Revisa que ninguno traiga recuadro y descarga el .pptx."
                icon={ShieldCheck}
              >
                {estado === "cargando" ? (
                  <div role="status" aria-label="Pidiendo los escudos">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                      {Array.from({ length: 20 }, (_, i) => (
                        <div
                          key={i}
                          style={{ background: "#04121F" }}
                          className="h-[118px] animate-pulse rounded-xl border border-white/10"
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-white/50">
                      Pidiendo los escudos…
                    </p>
                  </div>
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
                  <div className="space-y-5">
                    {Array.from({ length: hojas }, (_, h) => {
                      const tanda = escudos.slice(h * 20, h * 20 + 20);

                      return (
                        <div key={h}>
                          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                            Diapositiva {h + 1} · {tanda.length}
                          </h3>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                            {tanda.map((uno) => (
                              <figure
                                key={uno.url}
                                /* Fondo fijo: es el azul noche del documento y
                                   el CSS del modo día no pisa un estilo en línea.
                                   Sin `next/image`: imágenes de otro origen por
                                   el proxy de la casa. */
                                style={{
                                  background: "#04121F",
                                  borderColor:
                                    imagenes[uno.url] === "fallo"
                                      ? "#F6AFB6"
                                      : undefined,
                                }}
                                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 p-3"
                              >
                                <div className="relative h-16 w-16">
                                  {/* Iniciales detrás: mientras llega la imagen,
                                      o para siempre si no llega, la casilla
                                      nunca se queda vacía. */}
                                  {imagenes[uno.url] !== "listo" ? (
                                    <span
                                      aria-hidden
                                      style={{
                                        background: "rgba(228,206,155,0.3)",
                                        color: "#E4CE9B",
                                      }}
                                      className="absolute inset-0 flex items-center justify-center rounded-full text-lg font-bold"
                                    >
                                      {inicialesDe(uno.equipo)}
                                    </span>
                                  ) : null}
                                  {imagenes[uno.url] !== "fallo" ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={urlDeEscudo(uno.url)}
                                      alt={uno.equipo}
                                      className="relative h-16 w-16 object-contain"
                                      loading="eager"
                                      onLoad={() => marca(uno.url, "listo")}
                                      onError={() => marca(uno.url, "fallo")}
                                    />
                                  ) : null}
                                </div>
                                <figcaption
                                  style={{ color: "#E4CE9B" }}
                                  className="text-center text-[11px] font-semibold uppercase tracking-[0.1em]"
                                >
                                  {uno.equipo}
                                </figcaption>
                                {imagenes[uno.url] === "fallo" ? (
                                  <span
                                    style={{ color: "#F6AFB6" }}
                                    className="text-center text-[11px]"
                                  >
                                    No llega el escudo
                                  </span>
                                ) : null}
                              </figure>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </Panel>
            </div>

            {/* ---------------- lectura ---------------- */}

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/45">
              Son los escudos de BeSoccer, los mismos del informe del rival: se
              ponen al día solos cada jornada.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
