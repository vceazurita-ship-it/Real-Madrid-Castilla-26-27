"use client";

/**
 * La diapositiva de una tarea: sus equipos, con nombres y sin fotos.
 *
 * Se pinta SIEMPRE a 1920×1080 y se escala para caber: lo que se ve en la
 * pantalla, en el modo presentación y en la imagen exportada es lo mismo. Todo
 * el color va en estilos en línea con hex/rgba porque `html-to-image` serializa
 * el estilo calculado y los colores `oklch` de Tailwind no sobreviven al JPEG
 * (lo mismo que la pizarra de ABP).
 *
 * FONDO BLANCO (06/10/2026): la lámina va siempre en blanco, con los colores de
 * cada equipo y los nombres lo más grandes que quepan, enteros (si no caben en
 * una línea, en dos; nunca cortados). Sin escudo ni marcas: se quitaron a
 * petición. Si la tarea va «con estructura», cada equipo sale en su mini
 * campograma.
 */

import type { CSSProperties } from "react";

import { CampoEstructura } from "@/components/sesion-equipos/CampoEstructura";
import { colocaEnEstructura, parejasDe } from "@/lib/sesion-equipos/estructura";
import { cambiosDe, vistaCambio, type Fase } from "@/lib/sesion-equipos/cambio";
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

const ORO = "#A8874A";
const TINTA = "#0B1A33";
const SUAVE = "#5B6475";
const FONDO = "#FFFFFF";

const fuente: CSSProperties = { fontFamily: "var(--fuente-sesion, inherit)" };

type Columna = {
  clave: string;
  titulo: string;
  color: string;
  jugadores: JugadorSesion[];
  estructura?: string;
  orden?: string[];
  posiciones?: ({ x: number; y: number } | null)[];
  pares?: Record<string, string>;
  /** Titular → compañero, ya resuelto: el compañero va en la fila de su titular. */
  parejas?: Map<string, JugadorSesion>;
  /** Los del equipo, compañeros incluidos (en la lista el compañero no tiene fila propia). */
  cuenta?: number;
};

/** Un borde que se vea aunque el color del equipo sea casi blanco (el de los comodines). */
const bordeDe = (color: string) => (tintaSobre(color) === "#FFFFFF" ? "transparent" : "rgba(11,26,51,0.18)");

function Nombre({
  jugador,
  color,
  tamano,
  portero,
  pareja,
}: {
  jugador: JugadorSesion;
  color: string;
  tamano: number;
  portero?: boolean;
  /** Comparte puesto con él (08/10/2026): los dos en la misma fila. */
  pareja?: JugadorSesion;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: tamano * 0.3,
        minWidth: 0,
        lineHeight: 1.05,
        background: "#F6F7F9",
        border: "1px solid #E6E8EE",
        borderLeft: `${Math.max(8, tamano * 0.2)}px solid ${color}`,
        borderRadius: 12,
        padding: `${tamano * 0.16}px ${tamano * 0.3}px`,
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: tamano,
          fontWeight: 700,
          letterSpacing: "0.01em",
          lineHeight: 1,
          color: TINTA,
          /* Entero siempre: si no cabe en una línea, en dos. */
          whiteSpace: "normal",
          overflowWrap: "normal",
          textTransform: "uppercase",
        }}
      >
        {jugador.nombre}
        {pareja && (
          <>
            <span style={{ color: ORO, margin: `0 ${tamano * 0.18}px` }}>/</span>
            {pareja.nombre}
          </>
        )}
      </span>
      {portero && (
        <span style={{ fontSize: tamano * 0.42, fontWeight: 700, letterSpacing: "0.08em", color: "#FFFFFF", background: ORO, borderRadius: 8, padding: `${tamano * 0.04}px ${tamano * 0.14}px`, flexShrink: 0 }}>
          POR
        </span>
      )}
      {jugador.etiqueta && (
        <span style={{ fontSize: tamano * 0.42, fontWeight: 700, letterSpacing: "0.08em", color: ORO, border: `2px solid ${ORO}`, borderRadius: 8, padding: `${tamano * 0.04}px ${tamano * 0.14}px`, flexShrink: 0 }}>
          {jugador.etiqueta}
        </span>
      )}
      {jugador.baja && (
        <span style={{ fontSize: tamano * 0.4, fontWeight: 700, letterSpacing: "0.06em", color: "#B91C1C", border: "2px solid rgba(185,28,28,0.35)", borderRadius: 8, padding: `${tamano * 0.04}px ${tamano * 0.14}px`, flexShrink: 0, textTransform: "uppercase" }}>
          {jugador.baja.replace(/s$/i, "")}
        </span>
      )}
    </div>
  );
}

export function LaminaEquipos({
  sesion,
  tarea: tareaBase,
  fase = "inicio",
  cabecera = true,
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
  /** Con cambio a mitad de tarea: qué momento se dibuja (08/10/2026). */
  fase?: Fase;
  /**
   * Con cabecera (título, tarea y sesión) y pie, o sólo los equipos (08/10/2026).
   * Al exportar, por defecto va sin: la imagen es para enseñar los equipos.
   */
  cabecera?: boolean;
}) {
  const porPuestoCambio = puestoDe ?? ((j: JugadorSesion) => j.puesto);
  /* El inicio lleva al pie quién cambia; «tras el cambio», el reparto de después. */
  const cambios = tareaBase.cambio ? cambiosDe(tareaBase, sesion.jugadores, porPuestoCambio) : [];
  const tarea = fase === "cambio" ? vistaCambio(tareaBase) : tareaBase;

  const r = repartoDe(tarea, sesion.jugadores);

  const porPuesto = puestoDe ?? ((j: JugadorSesion) => j.puesto);

  const columnas: Columna[] = tarea.equipos.map((e) => {
    const suyos = r.porEquipo[e.id] ?? [];
    const parejas = parejasDe(suyos, e.pares);
    const companeros = new Set([...parejas.values()].map((j) => j.id));
    const estructura = tarea.conEstructura ? e.estructura : undefined;
    return {
      clave: e.id,
      titulo: e.nombre,
      color: e.color,
      /* Con dibujo, el campograma ya pone a cada compañero con su titular. */
      jugadores: estructura ? ordenPorPuesto(suyos, porPuesto) : ordenPorPuesto(suyos.filter((j) => !companeros.has(j.id)), porPuesto),
      estructura,
      orden: e.orden,
      posiciones: e.posiciones,
      pares: e.pares,
      parejas,
      cuenta: suyos.length,
    };
  });

  if (tarea.comodines > 0 || r.comodines.length > 0) {
    columnas.push({
      clave: "comodines",
      titulo: r.comodines.length === 1 ? "COMODÍN" : "COMODINES",
      color: tarea.colorComodin,
      jugadores: ordenPorPuesto(r.comodines, porPuesto),
    });
  }

  const enJuego = columnas.reduce((s, c) => s + (c.cuenta ?? c.jugadores.length), 0);

  /* Cuanto más larga la columna más larga, más pequeña la letra. */
  const filasTotal = Math.max(4, ...columnas.filter((c) => !c.estructura).map((c) => c.jugadores.length));

  /* El alto que de verdad queda para la lista (08/10/2026): con 640 la fila once se cortaba. Cada fila mide ~1,62 × la letra (letra + relleno + hueco). */
  const ALTO_LISTA = (cabecera ? 575 : 770) - (cambios.length ? 55 : 0);

  const anchoEquipo = (LAMINA_W - 120 - (columnas.length - 1) * 28) / Math.max(1, columnas.length);

  /* Un equipo largo en una columna ancha (uno o dos equipos) va en dos columnas de nombres: si no, no cabe. */
  const dosColumnas = filasTotal > 13 && anchoEquipo > 700;
  const filas = dosColumnas ? Math.ceil(filasTotal / 2) : filasTotal;
  const anchoColumna = dosColumnas ? (anchoEquipo - 20) / 2 : anchoEquipo;

  const tamano = Math.max(
    20,
    Math.min(
      68,
      ALTO_LISTA / (filas * 1.62),
      /* Que quepa entero el nombre más largo, con su etiqueta:
         en Barlow Condensed una mayúscula mide ~0,34 em (algo de margen). */
      (anchoColumna - 70) /
        Math.max(
          8,
          ...columnas
            .filter((c) => !c.estructura)
            .flatMap((c) =>
            c.jugadores.map((j) => (j.nombre.length + (c.parejas?.get(j.id) ? c.parejas.get(j.id)!.nombre.length + 3 : 0)) * 0.37 + 0.8 + (j.etiqueta ? 2.4 : 0) + (j.baja ? 5 : 0) + (porPuesto(j) === "POR" ? 2.4 : 0)),
          ),
        ),
    ),
  );

  /* El rótulo de cada columna, lo más grande que quepa junto a la cuenta. */
  const tamanoTitulo = (texto: string) => Math.min(50, (anchoEquipo - 150) / Math.max(4, texto.length * 0.52));

  const fuera = [...r.fuera, ...r.sinSitio];

  /* El campograma, lo más grande que quepa en la columna y en el alto que queda. */
  const anchoCampo = Math.min(anchoEquipo - 40, (LAMINA_H - (cabecera ? 520 : 335) - (cambios.length ? 60 : 0)) / 1.08);

  return (
    <div
      data-lamina-equipos
      style={{
        ...fuente,
        width: LAMINA_W,
        height: LAMINA_H,
        position: "relative",
        overflow: "hidden",
        background: FONDO,
        color: TINTA,
        padding: cabecera ? "48px 60px 40px" : "40px 60px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {cabecera && (
      <>
      {/* Una franja fina con el oro del club arriba del todo. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 10, background: `linear-gradient(90deg, ${TINTA} 0%, ${TINTA} 62%, ${ORO} 62%, ${ORO} 100%)` }} />

      {/* ---------------- CABECERA ---------------- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.22em", color: ORO, textTransform: "uppercase" }}>
              Real Madrid Castilla · Equipos de la sesión
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 96,
                fontWeight: 700,
                lineHeight: 0.95,
                letterSpacing: "0.005em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 1220,
                color: TINTA,
              }}
            >
              {tarea.nombre || `Tarea ${indice + 1}`}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
          <div style={{ display: "inline-block", fontSize: 28, fontWeight: 700, letterSpacing: "0.14em", color: "#FFFFFF", background: TINTA, borderRadius: 999, padding: "6px 22px" }}>
            TAREA {indice + 1} / {total}
          </div>
          {tareaBase.cambio && (
            <div style={{ display: "inline-block", fontSize: 24, fontWeight: 700, letterSpacing: "0.14em", color: fase === "cambio" ? "#FFFFFF" : ORO, background: fase === "cambio" ? ORO : "transparent", border: `2px solid ${ORO}`, borderRadius: 999, padding: "4px 18px", textTransform: "uppercase" }}>
              {fase === "cambio" ? "Tras el cambio" : "Inicio · hay cambio a mitad"}
            </div>
          )}
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "0.06em", color: SUAVE, textTransform: "uppercase", maxWidth: 480, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sesion.titulo}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 22, height: 3, background: `linear-gradient(90deg, ${ORO} 0%, rgba(168,135,74,0.2) 70%, rgba(168,135,74,0) 100%)` }} />
      </>
      )}

      {/* ---------------- EQUIPOS ---------------- */}
      <div
        style={{
          marginTop: cabecera ? 28 : 0,
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, columnas.length)}, minmax(0, 1fr))`,
          gap: 28,
          minHeight: 0,
        }}
      >
        {columnas.map((c) => {
          const tinta = tintaSobre(c.color);
          const colocados = c.estructura ? colocaEnEstructura(c.jugadores, c.estructura, porPuesto, c.orden, c.posiciones, c.pares) : null;

          return (
            <div
              key={c.clave}
              style={{
                borderRadius: 26,
                overflow: "hidden",
                background: "#FFFFFF",
                border: "2px solid #E6E8EE",
                boxShadow: "0 10px 30px rgba(11,26,51,0.08)",
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  background: c.color,
                  color: tinta,
                  padding: "16px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  borderBottom: `2px solid ${bordeDe(c.color)}`,
                }}
              >
                <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {/* Sin cabecera, el título de la tarea va en la franja de cada equipo (08/10/2026). */}
                  {!cabecera && (
                    <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tareaBase.nombre || `Tarea ${indice + 1}`}
                      {fase === "cambio" ? " · tras el cambio" : ""}
                    </span>
                  )}
                  <span style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 14 }}>
                    <span style={{ fontSize: tamanoTitulo(c.titulo), fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.titulo}
                    </span>
                    {c.estructura && <span style={{ fontSize: 28, fontWeight: 700, opacity: 0.8, whiteSpace: "nowrap" }}>{c.estructura}</span>}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    minWidth: 58,
                    height: 58,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: tinta === "#FFFFFF" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.55)",
                    flexShrink: 0,
                  }}
                >
                  {c.cuenta ?? c.jugadores.length}
                </span>
              </div>

              {colocados ? (
                <div style={{ padding: "18px 18px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <CampoEstructura huecos={colocados.huecos} color={c.color} ancho={anchoCampo} claro />
                  {colocados.porteros.length > 0 && (
                    <div style={{ fontSize: 24, fontWeight: 700, color: TINTA, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <span style={{ color: SUAVE }}>{colocados.porteros.length === 1 ? "Portero" : "Porteros"} · </span>
                      {colocados.porteros.map((j) => j.nombre).join(" · ")}
                    </div>
                  )}
                  {colocados.sobran.length > 0 && (
                    <div style={{ fontSize: 22, fontWeight: 600, color: SUAVE, textAlign: "center", textTransform: "uppercase" }}>
                      Fuera del dibujo: {colocados.sobran.map((j) => j.nombre).join(" · ")}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "22px 22px 18px", display: "grid", gridTemplateColumns: dosColumnas ? "1fr 1fr" : "1fr", gridAutoFlow: dosColumnas ? "column" : "row", gridTemplateRows: dosColumnas ? `repeat(${filas}, auto)` : undefined, columnGap: 20, rowGap: tamano * 0.26, alignContent: "start", minWidth: 0 }}>
                  {c.jugadores.map((j) => (
                    <Nombre key={j.id} jugador={j} color={c.color} tamano={tamano} portero={porPuesto(j) === "POR"} pareja={c.parejas?.get(j.id)} />
                  ))}
                  {c.jugadores.length === 0 && <span style={{ fontSize: 30, color: "#B6BCC8", fontWeight: 600 }}>—</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------------- CAMBIO A MITAD DE TAREA ---------------- */}
      {cambios.length > 0 && (
        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            fontSize: 24,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: TINTA,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <span style={{ color: ORO, letterSpacing: "0.14em", flexShrink: 0 }}>{fase === "cambio" ? "Han cambiado ·" : "Cambio a mitad ·"}</span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {cambios.map((c) => `${c.jugador.nombre}: ${c.texto}`).join("  ·  ")}
          </span>
        </div>
      )}

      {/* ---------------- PIE ---------------- */}
      {cabecera && (
      <div
        style={{
          marginTop: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 30,
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: SUAVE,
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
            <span style={{ color: "#9AA1AE" }}>Participan todos</span>
          )}
        </span>
        <span style={{ flexShrink: 0, color: TINTA }}>{enJuego} en la tarea</span>
      </div>
      )}
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
