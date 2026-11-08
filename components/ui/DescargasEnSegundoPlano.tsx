"use client";

/**
 * El anfitrión de TODAS las descargas en segundo plano (08/11/2026). Va en el
 * layout raíz: atiende los encargos de `lib/trabajos/descargas.ts` aunque se
 * cambie de pantalla, enseña el progreso en una píldora y avisa al terminar.
 * Mismo patrón que los PDF y exportaciones de ABP (`TrabajoPdfs`,
 * `TrabajoExportar`).
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { CheckCircle2, Download, Loader2, X, XCircle } from "lucide-react";

import { avisaHecho, pidePermisoAvisos } from "@/lib/aviso-hecho";
import { fuentesListas, respira } from "@/lib/export/captura";
import { descarga, esperaFotos } from "@/lib/export/lienzos";
import { descargas, type ResultadoDescarga, type TrabajoDescarga } from "@/lib/trabajos/descargas";

const VACIO = { trabajos: [] as TrabajoDescarga[], destino: null as string | null };

/** Los que ya han arrancado: el doble montaje de React en desarrollo no los repite. */
const arrancados = new Set<string>();

const tactil = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: coarse)").matches);

function bajaTodo(resultados: ResultadoDescarga[]) {
  resultados.forEach((r, i) => {
    /* Varios ficheros seguidos: el navegador corta las descargas en ráfaga. */
    setTimeout(() => descarga(r.blob, r.nombre), i * 400);
  });
}

/** Un encargo: su mesa fuera de la pantalla y su tarea. */
function Encargo({ trabajo }: { trabajo: TrabajoDescarga }) {
  const raiz = useRef<HTMLDivElement>(null);
  const { id } = trabajo;

  useEffect(() => {
    if (arrancados.has(id)) return;

    arrancados.add(id);

    const t = descargas.foto().trabajos.find((x) => x.id === id);

    if (!t) return;

    const corre = async () => {
      descargas.cambia(id, { estado: "en-marcha", texto: "Preparando…" });

      try {
        if (t.mesa && raiz.current) {
          /* Que la mesa pinte, lea sus fuentes y sus fotos antes de fotografiarla. */
          await respira(2);
          await fuentesListas();
          await esperaFotos(raiz.current);
          await respira(1);
        }

        const salida = await t.tarea({
          raiz: raiz.current,
          senal: t.control.signal,
          avanza: (texto, fraccion) => descargas.cambia(id, { texto, fraccion }),
          sueltaPantalla: () => descargas.cambia(id, { reteniendo: false }),
        });

        if (t.control.signal.aborted) return;

        const resultados = !salida ? [] : Array.isArray(salida) ? salida : [salida];

        descargas.cambia(id, { estado: "listo", texto: "Listo", fraccion: 1, resultados, reteniendo: false });

        const enTactil = tactil();

        if (resultados.length && !t.sinDescarga && !enTactil) bajaTodo(resultados);

        avisaHecho({
          ok: true,
          titulo: `${t.titulo}: listo`,
          texto: resultados.length
            ? enTactil && !t.sinDescarga
              ? "Toca «Descargar» para guardarlo."
              : `${resultados.length === 1 ? resultados[0].nombre : `${resultados.length} ficheros`} descargado${resultados.length === 1 ? "" : "s"}.`
            : undefined,
          accion: resultados.length && enTactil && !t.sinDescarga ? { label: "Descargar", onClick: () => bajaTodo(resultados) } : undefined,
          href: t.vuelta,
        });

        /* En el ordenador ya se ha bajado: la píldora se retira sola. */
        if (!enTactil || t.sinDescarga || !resultados.length) setTimeout(() => descargas.quita(id), 6_000);
      } catch (error) {
        if (t.control.signal.aborted) return;

        const mensaje = error instanceof Error ? error.message : String(error);

        console.error("[descargas]", t.titulo, error);
        descargas.cambia(id, { estado: "error", texto: "No ha salido", error: mensaje, reteniendo: false });
        avisaHecho({ ok: false, titulo: `${t.titulo}: no ha salido`, texto: mensaje, href: t.vuelta });
      }
    };

    void corre();
  }, [id]);

  if (!trabajo.mesa || trabajo.estado === "listo" || trabajo.estado === "error") return null;

  return (
    <div
      ref={raiz}
      aria-hidden
      data-descarga-mesa={id}
      /* Fuera de la pantalla pero pintado (no display:none: hay que fotografiarlo). */
      style={{ position: "fixed", left: -30000, top: 0, width: trabajo.ancho ?? 1440, pointerEvents: "none", zIndex: -1 }}
    >
      {trabajo.mesa}
    </div>
  );
}

export function DescargasEnSegundoPlano() {
  const { trabajos, destino } = useSyncExternalStore(descargas.suscribe, descargas.foto, () => VACIO);
  const router = useRouter();
  const hay = trabajos.length > 0;

  /* Pide permiso de notificación la primera vez que se encarga algo. */
  useEffect(() => {
    if (hay) pidePermisoAvisos();
  }, [hay]);

  useEffect(() => {
    descargas.ponNavegador((href) => router.push(href));

    return () => descargas.ponNavegador(null);
  }, [router]);

  /*
  | Con `pantalla: true` los enlaces esperan a que la tarea suelte la pantalla:
  | se apunta adónde se quería ir y se va en cuanto se pueda.
  */
  useEffect(() => {
    const alPulsar = (e: MouseEvent) => {
      if (!descargas.retiene() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;

      const enlace = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;

      if (!enlace || enlace.target === "_blank" || enlace.hasAttribute("download")) return;

      const url = new URL(enlace.href, window.location.href);

      if (url.origin !== window.location.origin) return;

      e.preventDefault();
      e.stopPropagation();
      descargas.esperaParaIr(url.pathname + url.search + url.hash);
    };

    document.addEventListener("click", alPulsar, true);

    return () => document.removeEventListener("click", alPulsar, true);
  }, []);

  if (!hay) return null;

  return (
    <>
      {trabajos.map((t) => (
        <Encargo key={t.id} trabajo={t} />
      ))}

      <div
        data-export-hide
        className="pointer-events-none fixed bottom-4 left-4 z-[70] flex max-w-[min(92vw,360px)] flex-col gap-2 print:hidden"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {trabajos.map((t) => {
          const activo = t.estado === "esperando" || t.estado === "en-marcha";

          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-2 text-xs shadow-lg"
              style={{ backgroundColor: "#0F1E3D", color: "#FFFFFF", boxShadow: "0 0 0 1px rgba(216,180,90,.5), 0 8px 24px rgba(0,0,0,.35)" }}
              title={activo ? "Se está preparando: puedes seguir usando la app, te aviso al terminar" : undefined}
            >
              {activo ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ color: "#D8B45A" }} />
              ) : t.estado === "listo" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#4ADE80" }} />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#F87171" }} />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.titulo}</span>
                <span className="block truncate opacity-75">
                  {t.estado === "error" ? t.error : t.reteniendo && activo && destino ? "Termino las fotos y te llevo…" : t.texto}
                  {activo && t.fraccion != null ? ` · ${Math.round(t.fraccion * 100)} %` : ""}
                </span>
              </span>

              {t.estado === "listo" && t.resultados.length > 0 && !t.sinDescarga && (
                <button
                  type="button"
                  onClick={() => {
                    bajaTodo(t.resultados);
                    setTimeout(() => descargas.quita(t.id), 1_500);
                  }}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 font-semibold"
                  style={{ backgroundColor: "#D8B45A", color: "#0F1E3D" }}
                >
                  <Download className="h-3.5 w-3.5" /> Descargar
                </button>
              )}

              <button
                type="button"
                onClick={() => descargas.quita(t.id)}
                aria-label={activo ? `Cancelar ${t.titulo}` : `Quitar ${t.titulo}`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
