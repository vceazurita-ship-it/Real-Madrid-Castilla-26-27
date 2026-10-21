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
import {
  cargaDelDia,
  cuentasDeLaSemana,
  esCompeticion,
  frenteAReferencia,
  plural,
  sinGazapos,
  tareaSinContenido,
  tareasDeLaLamina,
  type ReferenciaMd,
} from "@/lib/registro/semana";
import { tareasQueSeEscriben } from "@/lib/registro/hoja";
import { etiquetaDia } from "@/lib/abp/ventana";

import { colorDeFase } from "./TableroSemana";

/** Ancho fijo; el alto sale del contenido (antes, 1000 fijos dejaban media hoja vacía). */
export const LAMINA = { ancho: 1600, altoMinimo: 640 };

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

export const LaminaSemana = forwardRef<
  HTMLDivElement,
  { micro: MicroNuevo; partido: PartidoLamina; referencia?: Record<string, ReferenciaMd> }
>(
  function LaminaSemana({ micro, partido, referencia = {} }, ref) {
    const dias = micro.sesiones;
    const muchos = dias.length > 7;

    const cuentas = cuentasDeLaSemana(micro);
    const abp = dias.reduce(
      (n, sesion) =>
        n +
        tareasQueSeEscriben(sesion)
          .filter((tarea) => FASES_ABP.includes(tarea.fase))
          .reduce((m, tarea) => m + (tarea.tiempo || 0), 0),
      0,
    );

    /* El titular del pie: el día que más pesa, si la carga de la semana está escrita. */
    const masCargado = dias
      .map((sesion) => ({ sesion, dia: cargaDelDia(sesion) }))
      .filter(({ sesion, dia }) => !esPartidoMd(sesion.md) && dia.completa && dia.carga > 0)
      .sort((a, b) => b.dia.carga - a.dia.carga)[0];

    /* La mayúscula sólo en la primera letra: con `capitalize` salía «31 De Octubre». */
    const fecha = partido?.cuando
      ? new Date(partido.cuando).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
      : "";
    const cuando = fecha.charAt(0).toUpperCase() + fecha.slice(1);

    const cifras = [
      cuentas.sesiones ? plural(cuentas.sesiones, "sesión", "sesiones") : "",
      cuentas.tareas ? plural(cuentas.tareas, "tarea", "tareas") : "",
      cuentas.porDefinir ? `${cuentas.porDefinir} por definir` : "",
      cuentas.entreno ? `${cuentas.entreno}′ de entreno` : "",
      abp ? `${abp}′ de balón parado` : "",
      cuentas.libres ? plural(cuentas.libres, "día libre", "días libres") : "",
    ].filter(Boolean);

    const titular = masCargado
      ? `Día más exigente: ${etiquetaDia(masCargado.sesion.fecha)} (${masCargado.sesion.md}, carga ${masCargado.dia.carga})`
      : "";

    return (
      <div
        ref={ref}
        style={{
          width: LAMINA.ancho,
          minHeight: LAMINA.altoMinimo,
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
            {micro.objetivo?.trim() && (
              <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 600, lineHeight: 1.2, color: C.verde }}>
                Objetivo · {micro.objetivo.trim()}
              </p>
            )}
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
            display: "grid",
            alignItems: "start",
            gridTemplateColumns: `repeat(${Math.max(1, dias.length)}, minmax(0, 1fr))`,
            gap: muchos ? 8 : 12,
          }}
        >
          {dias.map((sesion, s) => {
            const partidoDia = esPartidoMd(sesion.md);
            const tareas = tareasDeLaLamina(sesion);
            const dia = cargaDelDia(sesion);
            const ref = referencia[sesion.md.trim().toUpperCase()];
            const frente = dia.completa ? frenteAReferencia(dia.carga, ref) : null;
            /* Las que están escritas sin contenido: el día por definir las nombra. */
            const vacias = tareasQueSeEscriben(sesion).filter(tareaSinContenido);

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
                  <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600, color: C.gris }}>
                    {dia.minutos}′{dia.completa && dia.carga > 0 ? ` · carga ${dia.carga}` : ""}
                    {frente ? (
                      <span style={{ color: frente.tono === "alta" ? "#A23B3B" : frente.tono === "baja" ? "#2E6B4F" : C.gris }}>
                        {` · ${frente.diferencia > 0 ? "+" : ""}${frente.diferencia} % s/ media`}
                        {ref ? <span style={{ color: C.gris, fontWeight: 400 }}>{` (${ref.sesiones} ses., ${ref.minutos}′)`}</span> : null}
                      </span>
                    ) : null}
                  </p>
                )}

                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
                  {sesion.libre ? (
                    <p style={{ margin: "18px 0 0", textAlign: "center", fontSize: 22, fontWeight: 600, color: C.gris }}>Libre</p>
                  ) : tareas.length === 0 ? (
                    /* Un día de entreno cuyas tareas aún no tienen contenido: una columna vacía parecía un fallo. */
                    <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 20, fontWeight: 600, color: C.gris }}>
                      Por definir
                      {vacias.length > 0 && (
                        <span style={{ display: "block", marginTop: 4, fontSize: 17, fontWeight: 500 }}>
                          {sinGazapos(vacias.map((tarea) => tarea.tipoTarea || tarea.tarea).join(", "))}
                        </span>
                      )}
                    </p>
                  ) : (
                    tareas.map((tarea, t) => {
                      const comp = esCompeticion(tarea);
                      const contenido = comp
                        ? tarea.contenidoSecundario
                        : sinGazapos([tarea.contenidoPrincipal, tarea.contenidoSecundario].filter(Boolean).join(" · "));
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
                          <p style={{ margin: 0, fontSize: muchos ? 19 : 22, fontWeight: 700, lineHeight: 1.1 }}>
                            {sinGazapos(tarea.tipoTarea || (comp ? "Competición" : tarea.tarea))}
                          </p>
                          {contenido && (
                            <p style={{ margin: "2px 0 0", fontSize: muchos ? 16 : 18, fontWeight: 500, lineHeight: 1.15, opacity: 0.8 }}>
                              {contenido}
                            </p>
                          )}
                          {(datos.length > 0 || tarea.fase) && !comp && (
                            <p style={{ margin: "3px 0 0", fontSize: muchos ? 15 : 17, fontWeight: 600, color: partidoDia ? C.crema : C.gris }}>
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
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {titular && <span style={{ fontSize: 20, fontWeight: 700 }}>{titular}</span>}
            <span>{cifras.join("  ·  ")}</span>
          </span>
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
