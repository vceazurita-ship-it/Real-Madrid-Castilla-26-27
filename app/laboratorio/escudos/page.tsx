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
import { Download, RefreshCw, ShieldCheck } from "lucide-react";

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

/*
| ¿TRAE FONDO? (30/10/2026, expertos). En vez de pedir «revisa que ninguno
| traiga recuadro», se mira: si las cuatro esquinas del PNG son opacas, el
| escudo trae fondo y se marca con un borde ámbar. Va por el proxy de la casa
| (mismo origen), así que el lienzo se deja leer.
*/
function traeFondo(img: HTMLImageElement) {
  try {
    const lado = 32;
    const lienzo = document.createElement("canvas");

    lienzo.width = lado;
    lienzo.height = lado;

    const ctx = lienzo.getContext("2d", { willReadFrequently: true });

    if (!ctx) return false;

    ctx.drawImage(img, 0, 0, lado, lado);

    const esquinas = [
      [0, 0],
      [lado - 1, 0],
      [0, lado - 1],
      [lado - 1, lado - 1],
    ];

    return esquinas.every(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] > 240);
  } catch {
    return false;
  }
}

/** «2026-10-30T…» → «30/10». */
function diaMes(iso: string | null) {
  const d = iso ? new Date(iso) : null;

  return d && !Number.isNaN(d.getTime())
    ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
    : "";
}

export default function EscudosPage() {
  const [escudos, setEscudos] = useState<EscudoLiga[]>([]);
  const [estado, setEstado] = useState<Estado>("cargando");

  /* Qué le ha pasado a cada imagen: sin entrada = aún llegando. */
  const [imagenes, setImagenes] = useState<Record<string, "listo" | "fallo">>(
    {},
  );

  /** Los que traen fondo (las cuatro esquinas opacas). */
  const [conFondo, setConFondo] = useState<Record<string, true>>({});
  /** Cuándo se bajaron los escudos de BeSoccer por última vez. */
  const [alDia, setAlDia] = useState<string | null>(null);

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

        setAlDia(typeof datos?.alDia === "string" ? datos.alDia : null);
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

  const miraFondo = useCallback((url: string, img: HTMLImageElement) => {
    if (traeFondo(img)) setConFondo((previo) => (previo[url] ? previo : { ...previo, [url]: true }));
  }, []);

  const marca = useCallback((url: string, como: "listo" | "fallo") => {
    setImagenes((previo) =>
      previo[url] === como ? previo : { ...previo, [url]: como },
    );
  }, []);

  const faltan = escudos.filter((e) => imagenes[e.url] === "fallo");
  const conImagen = escudos.filter((e) => imagenes[e.url] === "listo").length;
  const pendientes = escudos.length - conImagen - faltan.length;
  const fondos = escudos.filter((e) => conFondo[e.url]);

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

            {/* La nota del pie, arriba y con su fecha (30/10/2026, expertos). */}
            <p className="mt-2 text-[12px] text-white/55">
              Escudos de BeSoccer{diaMes(alDia) ? ` · al día el ${diaMes(alDia)}` : ""}
            </p>

            {/* ---------------- mandos ---------------- */}

            {/* Una acción principal y la otra como enlace; sin las cajas de
                «2 diapositivas» y «40 de 40 cargados», que ya decían el
                botón y los rótulos (30/10/2026, expertos). */}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <button
                type="button"
                onClick={descargaPpt}
                disabled={estado !== "listo" || haciendo !== null || pendientes > 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/15 px-4 py-2.5 text-sm font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/25 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                <Download size={16} />
                {haciendo !== null
                  ? `Preparando ${haciendo} de ${escudos.length}…`
                  : estado === "cargando" || (estado === "listo" && pendientes > 0)
                    ? `Preparando escudos…${escudos.length ? ` ${conImagen}/${escudos.length}` : ""}`
                    : `Descargar .pptx${escudos.length ? ` · ${escudos.length - faltan.length} escudos` : ""}`}
              </button>

              <button
                type="button"
                onClick={pideLista}
                disabled={haciendo !== null || estado === "cargando"}
                className="inline-flex items-center justify-center gap-1.5 self-center text-[13px] text-white/60 underline-offset-2 transition hover:text-white hover:underline disabled:opacity-40 sm:self-auto"
              >
                <RefreshCw size={14} className={estado === "cargando" ? "animate-spin" : undefined} />
                Actualizar escudos
              </button>
            </div>

            {/* Una sola caja ámbar con lo que falta o trae fondo. */}
            {estado === "listo" && (faltan.length > 0 || fondos.length > 0) ? (
              <p className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/[0.08] px-3 py-2 text-sm text-amber-200">
                {faltan.length
                  ? `Falta el escudo de ${faltan.map((f) => f.equipo).join(", ")}: el .pptx saldrá sin ${faltan.length === 1 ? "él" : "ellos"}. `
                  : ""}
                {fondos.length ? `Trae fondo, no es transparente: ${fondos.map((f) => f.equipo).join(", ")} (borde ámbar).` : ""}
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
                subtitle="Así salen sobre el azul noche del documento."
                icon={ShieldCheck}
              >
                {estado === "cargando" ? (
                  <div role="status" aria-label="Pidiendo los escudos">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                      {Array.from({ length: 40 }, (_, i) => (
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
                                    imagenes[uno.url] === "fallo" || conFondo[uno.url]
                                      ? "#F5B94A"
                                      : undefined,
                                }}
                                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 p-3"
                              >
                                <div className="relative h-16 w-16">
                                  {/* Mientras llega, un esqueleto sin letras sobre el mismo azul (30/10/2026). */}
                                  {imagenes[uno.url] !== "listo" ? (
                                    <span
                                      aria-hidden
                                      style={{ background: "rgba(228,206,155,0.14)" }}
                                      className={`absolute inset-0 rounded-full ${imagenes[uno.url] === "fallo" ? "" : "animate-pulse"}`}
                                    />
                                  ) : null}
                                  {imagenes[uno.url] !== "fallo" ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={urlDeEscudo(uno.url)}
                                      alt={uno.equipo}
                                      className="relative h-16 w-16 object-contain"
                                      loading="eager"
                                      onLoad={(evento) => {
                                        marca(uno.url, "listo");
                                        miraFondo(uno.url, evento.currentTarget);
                                      }}
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
                                {imagenes[uno.url] === "fallo" || conFondo[uno.url] ? (
                                  <span style={{ color: "#F5B94A" }} className="text-center text-[11px]">
                                    {imagenes[uno.url] === "fallo" ? "No llega el escudo" : "Trae fondo"}
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

          </div>
        </section>
      </div>
    </main>
  );
}
