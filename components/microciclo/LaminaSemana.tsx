"use client";

/**
 * LA LÁMINA DEL MICROCICLO: la semana en una hoja para el cuerpo técnico
 * (21/10/2026).
 *
 * Es lo que se manda al grupo del staff o se pega en la pizarra del vestuario:
 * una imagen de 1600 × 1000 con el lenguaje de los documentos del club
 * (papel blanco, azul de tinta, verde, crema y el filo rosa; Barlow
 * Condensed). Colores escritos a mano y no del tema: el documento sale igual
 * se exporte de día o de noche.
 *
 * Sólo lleva lo que hay: un día sin minutos no dice «0′», un MD sin media no
 * enseña ninguna comparación y una tarea sin contenido no deja un guion.
 */

import { forwardRef } from "react";

import { FASES_ABP, type MicroNuevo } from "@/lib/registro/hoja";
import { cargaDelDia, esCompeticion } from "@/lib/registro/semana";
import { tareasQueSeEscriben } from "@/lib/registro/hoja";
import { etiquetaDia } from "@/lib/abp/ventana";

import { colorDeFase } from "./TableroSemana";

export const LAMINA = { ancho: 1600, alto: 1000 };

const C = {
  papel: "#FFFFFF",
  tinta: "#0F1E3D",
  verde: "#1B3A2E",
  crema: "#F7F4EC",
  rosa: "#F6AFB6",
  gris: "#5B6577",
  linea: "#E4DFD2",
};

const FUENTE = "'Barlow Condensed Lamina', 'Barlow Condensed', 'Arial Narrow', sans-serif";

export type PartidoLamina = { rival: string; jornada?: number | string; cuando?: string; lado?: string } | null;

export const LaminaSemana = forwardRef<HTMLDivElement, { micro: MicroNuevo; partido: PartidoLamina }>(
  function LaminaSemana({ micro, partido }, ref) {
    const dias = micro.sesiones;
    const muchos = dias.length > 7;

    const totales = dias.reduce(
      (suma, sesion) => {
        const dia = cargaDelDia(sesion);
        const abp = tareasQueSeEscriben(sesion)
          .filter((tarea) => FASES_ABP.includes(tarea.fase))
          .reduce((n, tarea) => n + (tarea.tiempo || 0), 0);
        const entreno = !esPartidoMd(sesion.md) && dia.tareas > 0;

        return {
          minutos: suma.minutos + (esPartidoMd(sesion.md) ? 0 : dia.minutos),
          abp: suma.abp + abp,
          tareas: suma.tareas + (esPartidoMd(sesion.md) ? 0 : dia.tareas),
          sesiones: suma.sesiones + (entreno ? 1 : 0),
          libres: suma.libres + (sesion.libre ? 1 : 0),
        };
      },
      { minutos: 0, abp: 0, tareas: 0, sesiones: 0, libres: 0 },
    );

    /* La mayúscula sólo en la primera letra: con `capitalize` salía «31 De Octubre». */
    const fecha = partido?.cuando
      ? new Date(partido.cuando).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
      : "";
    const cuando = fecha.charAt(0).toUpperCase() + fecha.slice(1);

    const cifras = [
      totales.sesiones ? `${totales.sesiones} sesiones` : "",
      totales.tareas ? `${totales.tareas} tareas` : "",
      totales.minutos ? `${totales.minutos}′ de entreno` : "",
      totales.abp ? `${totales.abp}′ de balón parado` : "",
      totales.libres ? `${totales.libres} ${totales.libres === 1 ? "día libre" : "días libres"}` : "",
    ].filter(Boolean);

    return (
      <div
        ref={ref}
        style={{
          width: LAMINA.ancho,
          height: LAMINA.alto,
          background: C.papel,
          color: C.tinta,
          fontFamily: FUENTE,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          padding: "44px 52px 34px",
          borderTop: `10px solid ${C.rosa}`,
        }}
      >
        <style>{`@font-face{font-family:'Barlow Condensed Lamina';font-weight:500;src:url('/fuentes/BarlowCondensed-Medium.ttf') format('truetype');}
@font-face{font-family:'Barlow Condensed Lamina';font-weight:600;src:url('/fuentes/BarlowCondensed-SemiBold.ttf') format('truetype');}
@font-face{font-family:'Barlow Condensed Lamina';font-weight:700;src:url('/fuentes/BarlowCondensed-Bold.ttf') format('truetype');}`}</style>

        <header style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- la captura necesita la imagen tal cual */}
          <img src="/logo.png" alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: 5, color: C.verde, textTransform: "uppercase" }}>
              Real Madrid Castilla · Microciclo {micro.micro} · {micro.temporada}
            </p>
            <h1 style={{ margin: "2px 0 0", fontSize: 50, fontWeight: 700, lineHeight: 1.02, textTransform: "uppercase" }}>
              {partido?.rival || micro.rival}
            </h1>
          </div>

          {(partido?.jornada || cuando) && (
            <div style={{ textAlign: "right", fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>
              {partido?.jornada ? <p style={{ margin: 0 }}>Jornada {partido.jornada}{partido.lado ? ` · ${partido.lado === "fuera" ? "fuera" : "en casa"}` : ""}</p> : null}
              {cuando && <p style={{ margin: 0, color: C.gris, fontWeight: 500 }}>{cuando}</p>}
            </div>
          )}
        </header>

        <div
          style={{
            marginTop: 26,
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(1, dias.length)}, minmax(0, 1fr))`,
            gap: muchos ? 8 : 12,
          }}
        >
          {dias.map((sesion, s) => {
            const partidoDia = esPartidoMd(sesion.md);
            const tareas = tareasQueSeEscriben(sesion);
            const dia = cargaDelDia(sesion);

            return (
              <section
                key={`${sesion.fecha}-${s}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                  background: partidoDia ? C.tinta : sesion.libre ? "transparent" : C.crema,
                  color: partidoDia ? C.crema : C.tinta,
                  border: sesion.libre ? `2px dashed ${C.linea}` : "none",
                  borderRadius: 14,
                  padding: muchos ? "12px 10px" : "14px 14px",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontSize: muchos ? 20 : 23, fontWeight: 700, textTransform: "capitalize", whiteSpace: "nowrap" }}>
                    {etiquetaDia(sesion.fecha)}
                  </span>
                  {sesion.md && (
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 6,
                      background: partidoDia ? C.rosa : C.verde,
                      color: partidoDia ? C.tinta : C.crema,
                    }}
                  >
                    {sesion.md}
                  </span>
                  )}
                </div>

                {!partidoDia && dia.minutos > 0 && (
                  <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 600, color: C.gris }}>
                    {dia.minutos}′{dia.completa && dia.carga > 0 ? ` · carga ${dia.carga}` : ""}
                  </p>
                )}

                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
                  {sesion.libre ? (
                    <p style={{ margin: "18px 0 0", textAlign: "center", fontSize: 22, fontWeight: 600, color: C.gris }}>Libre</p>
                  ) : (
                    tareas.map((tarea, t) => {
                      const comp = esCompeticion(tarea);
                      const contenido = comp
                        ? tarea.contenidoSecundario
                        : [tarea.contenidoPrincipal, tarea.contenidoSecundario].filter(Boolean).join(" · ");
                      const datos = [tarea.tiempo > 0 && !comp ? `${tarea.tiempo}′` : "", tarea.intensidad > 0 && !comp ? `int. ${tarea.intensidad}` : "", comp ? "" : tarea.formato].filter(Boolean);

                      return (
                        <div
                          key={`${tarea.tarea}-${t}`}
                          style={{
                            background: partidoDia ? "rgba(247,244,236,0.08)" : C.papel,
                            borderRadius: 10,
                            padding: muchos ? "7px 8px" : "8px 10px",
                            borderLeft: `5px solid ${colorDeFase(tarea.fase)}`,
                          }}
                        >
                          <p style={{ margin: 0, fontSize: muchos ? 16 : 18, fontWeight: 700, lineHeight: 1.1 }}>
                            {tarea.tipoTarea || (comp ? "Competición" : tarea.tarea)}
                          </p>
                          {contenido && (
                            <p style={{ margin: "2px 0 0", fontSize: muchos ? 13.5 : 15, fontWeight: 500, lineHeight: 1.15, opacity: 0.8 }}>
                              {contenido}
                            </p>
                          )}
                          {(datos.length > 0 || tarea.fase) && !comp && (
                            <p style={{ margin: "3px 0 0", fontSize: muchos ? 12.5 : 14, fontWeight: 600, color: partidoDia ? C.crema : C.gris }}>
                              {[tarea.fase, ...datos].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <footer
          style={{
            marginTop: 18,
            paddingTop: 12,
            borderTop: `2px solid ${C.linea}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 20,
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          <span>{cifras.join("  ·  ")}</span>
          <span style={{ color: C.gris, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", fontSize: 14 }}>
            Metodología · Cuerpo técnico
          </span>
        </footer>
      </div>
    );
  },
);

function esPartidoMd(md: string) {
  return /^MD$/i.test(md.trim());
}
