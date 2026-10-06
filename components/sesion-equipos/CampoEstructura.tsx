/**
 * El mini campograma de un equipo con estructura (06/10/2026).
 *
 * Medio campo vertical, su portería abajo, cada jugador en su hueco con el
 * color del equipo. Sirve para la pantalla (pequeño, se toca para cambiar de
 * sitio) y para la lámina exportada (grande, sin tocar). Todo en estilos en
 * línea con hex/rgba: la lámina se captura con `html-to-image`.
 */
import type { CSSProperties } from "react";

import { MarcasCamiseta } from "@/components/sesion-equipos/Marcas";
import type { Hueco } from "@/lib/sesion-equipos/estructura";
import { tintaSobre } from "@/lib/sesion-equipos/modelo";

const apellido = (nombre: string) => {
  const t = nombre.trim().split(/\s+/);
  return t.length > 1 ? t.slice(1).join(" ") : nombre;
};

export function CampoEstructura({
  huecos,
  color,
  ancho,
  claro = false,
  elegido = null,
  onToca,
  marcas = false,
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
  /** El escudo y las tres barras junto a cada nombre (la lámina exportada). */
  marcas?: boolean;
  style?: CSSProperties;
}) {
  const alto = ancho * 1.08;
  const ficha = Math.max(16, Math.min(46, ancho / 9));
  const letra = Math.max(9, Math.min(26, ancho / 15));
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
        /* Cada nombre cabe en su trozo de línea: con cuatro en fila, la cuarta parte del campo. */
        const enSuLinea = huecos.filter((x) => x.linea === h.linea).length;
        const anchoNombre = Math.min(ancho / 3.2, (ancho / (enSuLinea + 1)) * 0.94);
        return (
          <div
            key={i}
            onClick={onToca ? () => onToca(i) : undefined}
            style={{
              position: "absolute",
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              transform: "translate(-50%,-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: anchoNombre,
              cursor: onToca ? "pointer" : "default",
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
                boxShadow: es ? "0 0 0 3px #C8A96B" : "0 2px 6px rgba(0,0,0,0.25)",
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
                fontSize: Math.min(letra, anchoNombre / 5.2),
                fontWeight: 700,
                lineHeight: 1.05,
                textTransform: "uppercase",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: claro ? "#0B0F14" : "#FFFFFF",
                textShadow: claro ? "none" : "0 1px 2px rgba(0,0,0,0.6)",
                background: claro ? "rgba(255,255,255,0.85)" : "transparent",
                borderRadius: 4,
                padding: claro ? "0 4px" : 0,
              }}
            >
              {h.jugador ? apellido(h.jugador.nombre) : "—"}
            </span>
            {marcas && h.jugador && (
              <span style={{ marginTop: 3, background: "rgba(255,255,255,0.92)", borderRadius: 6, padding: "2px 5px", display: "inline-flex" }}>
                <MarcasCamiseta alto={letra * 0.85} color="#0B1A33" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
