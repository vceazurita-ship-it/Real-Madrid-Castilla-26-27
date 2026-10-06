/**
 * El mini campograma de un equipo con estructura (06/10/2026).
 *
 * Medio campo vertical, su portería abajo, cada jugador en su hueco con el
 * color del equipo. Sirve para la pantalla (pequeño, se toca para cambiar de
 * sitio) y para la lámina exportada (grande, sin tocar). Todo en estilos en
 * línea con hex/rgba: la lámina se captura con `html-to-image`.
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import type { Hueco } from "@/lib/sesion-equipos/estructura";
import { tintaSobre } from "@/lib/sesion-equipos/modelo";

/** Lo que mide la palabra más larga de un nombre, en letras: el nombre se parte sólo entre palabras. */
const palabraMasLarga = (nombre: string) => Math.max(3, ...nombre.split(/ +/).map((t) => t.length));

export function CampoEstructura({
  huecos,
  color,
  ancho,
  claro = false,
  elegido = null,
  onToca,
  destinoDe,
  sobre = null,
  onArrastra,
  style,
}: {
  huecos: Hueco[];
  color: string;
  /** Ancho en píxeles; el alto sale de la proporción del medio campo. */
  ancho: number;
  /** Césped claro, para la lámina en fondo blanco. */
  claro?: boolean;
  /** El hueco tocado, a la espera del segundo para cambiarlos. */
  elegido?: number | null;
  onToca?: (indice: number) => void;
  /** El destino de cada hueco para soltar ahí a alguien que se arrastra («hueco:<equipo>:<n>»). */
  destinoDe?: (indice: number) => string;
  /** El destino que hay debajo del arrastre ahora mismo. */
  sobre?: string | null;
  /** Empieza a arrastrar al jugador de un hueco. */
  onArrastra?: (indice: number, e: ReactPointerEvent) => void;
  style?: CSSProperties;
}) {
  const alto = ancho * 1.08;
  const ficha = Math.max(16, Math.min(46, ancho / 9));
  const letra = Math.max(10, Math.min(32, ancho / 11));
  const tinta = tintaSobre(color);
  const linea = claro ? "rgba(20,83,45,0.35)" : "rgba(255,255,255,0.22)";

  return (
    <div
      style={{
        position: "relative",
        width: ancho,
        height: alto,
        borderRadius: Math.max(8, ancho / 28),
        overflow: "hidden",
        background: claro
          ? "repeating-linear-gradient(180deg, #E7F3EA 0px, #E7F3EA 12.5%, #DCEEE1 12.5%, #DCEEE1 25%)"
          : "repeating-linear-gradient(180deg, #14532D 0px, #14532D 12.5%, #166534 12.5%, #166534 25%)",
        border: `2px solid ${claro ? "rgba(20,83,45,0.25)" : "rgba(255,255,255,0.12)"}`,
        flexShrink: 0,
        /* La letra estrecha de la lámina, también en la pantalla: caben nombres más grandes. */
        fontFamily: "var(--fuente-sesion, inherit)",
        ...style,
      }}
    >
      {/* Las líneas: medio campo con su área y su portería abajo. */}
      <div style={{ position: "absolute", left: "4%", right: "4%", top: "3%", bottom: "3%", border: `2px solid ${linea}`, borderRadius: 4 }} />
      <div style={{ position: "absolute", left: "50%", top: "3%", width: "28%", height: "14%", transform: "translate(-50%,-50%)", border: `2px solid ${linea}`, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: "22%", right: "22%", bottom: "3%", height: "17%", border: `2px solid ${linea}`, borderBottom: "none" }} />
      <div style={{ position: "absolute", left: "37%", right: "37%", bottom: "3%", height: "6%", border: `2px solid ${linea}`, borderBottom: "none" }} />

      {huecos.map((h, i) => {
        const es = elegido === i;
        const destino = destinoDe?.(i);
        const debajo = Boolean(destino && sobre === destino);
        /* Cada nombre cabe en su trozo de línea: con cuatro en fila, la cuarta parte del campo. */
        const enSuLinea = huecos.filter((x) => x.linea === h.linea).length;
        const anchoNombre = Math.min(ancho / 3.2, (ancho / (enSuLinea + 1)) * 0.98);
        return (
          <div
            key={i}
            onClick={onToca ? () => onToca(i) : undefined}
            data-destino={destino}
            onPointerDown={onArrastra && h.jugador ? (e) => onArrastra(i, e) : undefined}
            style={{
              position: "absolute",
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              transform: "translate(-50%,-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: anchoNombre,
              cursor: onArrastra && h.jugador ? "grab" : onToca ? "pointer" : "default",
              touchAction: onArrastra && h.jugador ? "pan-y" : undefined,
              userSelect: "none",
            }}
            title={h.jugador ? `${h.jugador.nombre}${onToca ? " · toca otro para cambiarlos de sitio" : ""}` : onToca ? "Hueco libre: toca a un jugador para traerlo" : "Hueco libre"}
          >
            <span
              style={{
                width: ficha,
                height: ficha,
                borderRadius: 999,
                background: h.jugador ? color : "transparent",
                border: h.jugador ? `2px solid ${es ? "#C8A96B" : "rgba(0,0,0,0.35)"}` : `2px dashed ${claro ? "rgba(20,83,45,0.45)" : "rgba(255,255,255,0.45)"}`,
                boxShadow: es || debajo ? "0 0 0 3px #C8A96B" : "0 2px 6px rgba(0,0,0,0.25)",
                transform: debajo ? "scale(1.25)" : undefined,
                transition: "transform 120ms",
                color: tinta,
                fontSize: ficha * 0.42,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {h.linea === 0 && h.jugador && huecos.filter((x) => x.linea === 0).length === 1 ? "POR" : ""}
            </span>
            <span
              style={{
                marginTop: 2,
                maxWidth: "100%",
                /* Que la palabra más larga del nombre quepa entera en su línea (≈0,6 em por mayúscula). */
                fontSize: Math.max(7, Math.min(letra, anchoNombre / (palabraMasLarga(h.jugador?.nombre ?? "—") * 0.5 + 0.4))),
                fontWeight: 700,
                lineHeight: 1,
                textTransform: "uppercase",
                textAlign: "center",
                /* El nombre entero, en dos líneas si hace falta: «JORGE / CESTERO». */
                whiteSpace: "normal",
                overflowWrap: "normal",
                color: claro ? "#0B0F14" : "#FFFFFF",
                textShadow: claro ? "none" : "0 1px 2px rgba(0,0,0,0.6)",
                background: claro ? "rgba(255,255,255,0.85)" : "transparent",
                borderRadius: 4,
                padding: claro ? "0 4px" : 0,
              }}
            >
              {h.jugador ? h.jugador.nombre : "—"}
            </span>

          </div>
        );
      })}
    </div>
  );
}
