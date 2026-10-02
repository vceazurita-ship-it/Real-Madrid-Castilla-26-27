"use client";

/**
 * La diapositiva de una tarea: sus equipos, con nombres y sin fotos.
 *
 * Se pinta SIEMPRE a 1920×1080 y se escala para caber: lo que se ve en la
 * pantalla, en el modo presentación y en la imagen exportada es lo mismo. Todo
 * el color va en estilos en línea con hex/rgba porque `html-to-image` serializa
 * el estilo calculado y los colores `oklch` de Tailwind no sobreviven al JPEG
 * (lo mismo que la pizarra de ABP).
 */

import type { CSSProperties } from "react";

import {
  ordenPorPuesto,
  repartoDe,
  tintaSobre,
  type JugadorSesion,
  type Puesto,
  type SesionEquipos,
  type TareaEquipos,
} from "@/lib/sesion-equipos/modelo";

export const LAMINA_W = 1920;
export const LAMINA_H = 1080;

const ORO = "#C8A96B";
const FONDO = "#0B0F14";

const fuente: CSSProperties = { fontFamily: "var(--fuente-sesion, inherit)" };

type Columna = {
  clave: string;
  titulo: string;
  color: string;
  jugadores: JugadorSesion[];
};

function Nombre({
  jugador,
  color,
  tamano,
  portero,
}: {
  jugador: JugadorSesion;
  color: string;
  tamano: number;
  portero?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: tamano * 0.32,
        minWidth: 0,
        lineHeight: 1.05,
      }}
    >
      <span
        style={{
          width: tamano * 0.22,
          height: tamano * 0.22,
          borderRadius: 999,
          background: color,
          boxShadow: "0 0 0 2px rgba(255,255,255,0.12)",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: tamano,
          fontWeight: 600,
          letterSpacing: "0.01em",
          color: "#F4F4F5",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textTransform: "uppercase",
        }}
      >
        {jugador.nombre}
      </span>
      {portero && (
        <span
          style={{
            fontSize: tamano * 0.42,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: FONDO,
            background: ORO,
            borderRadius: 8,
            padding: `${tamano * 0.04}px ${tamano * 0.14}px`,
            flexShrink: 0,
          }}
        >
          POR
        </span>
      )}
      {jugador.etiqueta && (
        <span
          style={{
            fontSize: tamano * 0.42,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: ORO,
            border: `2px solid rgba(200,169,107,0.55)`,
            borderRadius: 8,
            padding: `${tamano * 0.04}px ${tamano * 0.14}px`,
            flexShrink: 0,
          }}
        >
          {jugador.etiqueta}
        </span>
      )}
      {jugador.baja && (
        <span
          style={{
            fontSize: tamano * 0.4,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "#FCA5A5",
            border: "2px solid rgba(252,165,165,0.45)",
            borderRadius: 8,
            padding: `${tamano * 0.04}px ${tamano * 0.14}px`,
            flexShrink: 0,
            textTransform: "uppercase",
          }}
        >
          {jugador.baja.replace(/s$/i, "")}
        </span>
      )}
    </div>
  );
}

export function LaminaEquipos({
  sesion,
  tarea,
  indice,
  total,
  puestoDe,
}: {
  sesion: SesionEquipos;
  tarea: TareaEquipos;
  indice: number;
  total: number;
  /** El puesto de cada uno: los porteros van los primeros y con su marca. */
  puestoDe?: (j: JugadorSesion) => Puesto | undefined;
}) {
  const r = repartoDe(tarea, sesion.jugadores);

  const porPuesto = puestoDe ?? ((j: JugadorSesion) => j.puesto);

  const columnas: Columna[] = tarea.equipos.map((e) => ({
    clave: e.id,
    titulo: e.nombre,
    color: e.color,
    jugadores: ordenPorPuesto(r.porEquipo[e.id] ?? [], porPuesto),
  }));

  if (tarea.comodines > 0 || r.comodines.length > 0) {
    columnas.push({
      clave: "comodines",
      titulo: r.comodines.length === 1 ? "COMODÍN" : "COMODINES",
      color: tarea.colorComodin,
      jugadores: ordenPorPuesto(r.comodines, porPuesto),
    });
  }

  const enJuego = columnas.reduce((s, c) => s + c.jugadores.length, 0);

  /* Cuanto más larga la columna más larga, más pequeña la letra. */
  const filas = Math.max(4, ...columnas.map((c) => c.jugadores.length));

  const ALTO_LISTA = 560;

  const anchoColumna = (LAMINA_W - 120 - (columnas.length - 1) * 28) / Math.max(1, columnas.length);

  const tamano = Math.max(
    26,
    Math.min(
      60,
      (ALTO_LISTA / filas) * 0.62,
      /* Que quepa entero el nombre más largo, con su etiqueta: en Barlow
         Condensed una mayúscula mide ~0,34 em (algo de margen). */
      (anchoColumna - 60) /
        Math.max(
          8,
          ...columnas.flatMap((c) =>
            c.jugadores.map((j) => j.nombre.length * 0.37 + 0.6 + (j.etiqueta ? 2.4 : 0) + (j.baja ? 5 : 0) + (porPuesto(j) === "POR" ? 2.4 : 0)),
          ),
        ),
    ),
  );

  /* El rótulo de cada columna, lo más grande que quepa junto a la cuenta. */
  const tamanoTitulo = (texto: string) => Math.min(54, (anchoColumna - 140) / Math.max(4, texto.length * 0.52));

  const fuera = [...r.fuera, ...r.sinSitio];

  return (
    <div
      data-lamina-equipos
      style={{
        ...fuente,
        width: LAMINA_W,
        height: LAMINA_H,
        position: "relative",
        overflow: "hidden",
        background: `radial-gradient(1200px 700px at 85% -10%, rgba(200,169,107,0.10), rgba(0,0,0,0) 60%), linear-gradient(180deg, #0F151D 0%, ${FONDO} 100%)`,
        color: "#FFFFFF",
        padding: "56px 60px 48px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ---------------- CABECERA ---------------- */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.22em",
              color: ORO,
              textTransform: "uppercase",
            }}
          >
            Real Madrid Castilla · Equipos de la sesión
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 104,
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: "0.005em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 1350,
            }}
          >
            {tarea.nombre || `Tarea ${indice + 1}`}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: FONDO,
              background: ORO,
              borderRadius: 999,
              padding: "6px 22px",
            }}
          >
            TAREA {indice + 1} / {total}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.62)",
              textTransform: "uppercase",
              maxWidth: 480,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sesion.titulo}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 26,
          height: 3,
          background: `linear-gradient(90deg, ${ORO} 0%, rgba(200,169,107,0.15) 70%, rgba(200,169,107,0) 100%)`,
        }}
      />

      {/* ---------------- EQUIPOS ---------------- */}
      <div
        style={{
          marginTop: 34,
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, columnas.length)}, minmax(0, 1fr))`,
          gap: 28,
          minHeight: 0,
        }}
      >
        {columnas.map((c) => {
          const tinta = tintaSobre(c.color);

          return (
            <div
              key={c.clave}
              style={{
                borderRadius: 28,
                overflow: "hidden",
                background: "rgba(255,255,255,0.035)",
                border: "2px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  background: c.color,
                  color: tinta,
                  padding: "18px 26px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <span
                  style={{
                    fontSize: tamanoTitulo(c.titulo),
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.titulo}
                </span>
                <span
                  style={{
                    fontSize: 40,
                    fontWeight: 700,
                    minWidth: 62,
                    height: 62,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: tinta === "#FFFFFF" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.45)",
                    flexShrink: 0,
                  }}
                >
                  {c.jugadores.length}
                </span>
              </div>

              <div
                style={{
                  padding: "26px 26px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: tamano * 0.36,
                  minWidth: 0,
                }}
              >
                {c.jugadores.map((j) => (
                  <Nombre key={j.id} jugador={j} color={c.color} tamano={tamano} portero={porPuesto(j) === "POR"} />
                ))}
                {c.jugadores.length === 0 && (
                  <span style={{ fontSize: 30, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------------- PIE ---------------- */}
      <div
        style={{
          marginTop: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 30,
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
        }}
      >
        <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {fuera.length ? (
            <>
              <span style={{ color: ORO, fontWeight: 700, letterSpacing: "0.14em" }}>No participan · </span>
              {fuera.map((j) => (j.baja ? `${j.nombre} (${j.baja.toLowerCase().replace(/s$/, "")})` : j.nombre)).join(" · ")}
            </>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.35)" }}>Participan todos</span>
          )}
        </span>
        <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.75)" }}>
          {enJuego} en la tarea
        </span>
      </div>
    </div>
  );
}

/** La diapositiva escalada para caber en `ancho` píxeles de pantalla. */
export function LaminaEscalada({
  ancho,
  ...props
}: Parameters<typeof LaminaEquipos>[0] & { ancho: number }) {
  const escala = ancho / LAMINA_W;

  return (
    <div style={{ width: ancho, height: LAMINA_H * escala, position: "relative", overflow: "hidden" }}>
      <div style={{ transform: `scale(${escala})`, transformOrigin: "top left", position: "absolute", inset: 0 }}>
        <LaminaEquipos {...props} />
      </div>
    </div>
  );
}
