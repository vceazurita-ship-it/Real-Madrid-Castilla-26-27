/**
 * El mini campograma de un equipo con estructura (06/10/2026).
 *
 * Medio campo vertical, su portería abajo, cada jugador en su hueco con el
 * color del equipo. Sirve para la pantalla (se toca o se arrastra para cambiar
 * de sitio) y para la lámina exportada (grande, sin tocar). Todo en estilos en
 * línea con hex/rgba y las líneas en SVG: la lámina se captura con
 * `html-to-image`.
 *
 * REDISEÑO (07/10/2026): las líneas son las de un campo de verdad (área,
 * área pequeña, punto y semicírculo de penalti, portería y el medio círculo
 * central arriba), las fichas son más grandes y el nombre va en una etiqueta
 * que se lee sobre el césped. Y el césped entero es un sitio donde soltar
 * (`campoDestino`): quien se suelta en un punto vacío se queda en ese punto.
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import type { Hueco } from "@/lib/sesion-equipos/estructura";
import { tintaSobre } from "@/lib/sesion-equipos/modelo";

/** Lo que mide la palabra más larga de un nombre, en letras: el nombre se parte sólo entre palabras. */
/*
| El nombre en dos renglones como mucho (30/10/2026): «HUGO DE LLANOS» salía
| en tres, una palabra por línea. Se parte por donde los dos renglones quedan
| más parejos («HUGO / DE LLANOS») y la letra se calcula con el más largo.
*/
const enDosRenglones = (nombre: string): string[] => {
  const palabras = nombre.split(/ +/).filter(Boolean);

  if (palabras.length < 2) return [nombre];

  let mejor = [nombre];
  let peor = Infinity;

  for (let k = 1; k < palabras.length; k += 1) {
    const partes = [palabras.slice(0, k).join(" "), palabras.slice(k).join(" ")];
    const largo = Math.max(...partes.map((t) => t.length));

    if (largo < peor) {
      peor = largo;
      mejor = partes;
    }
  }

  return mejor;
};

const renglonMasLargo = (nombre: string) => Math.max(3, ...enDosRenglones(nombre).map((t) => t.length));

/** Proporción del medio campo que se dibuja: alto = ancho × esto. */
export const PROPORCION_CAMPO = 1.08;

/** Las líneas del medio campo, en un lienzo de 100 × 108. */
function Lineas({ trazo, grosor }: { trazo: string; grosor: number }) {
  const g = { fill: "none", stroke: trazo, strokeWidth: grosor, vectorEffect: "non-scaling-stroke" as const };
  return (
    <svg
      viewBox="0 0 100 108"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden
    >
      {/* banda, fondo y la línea de medio campo arriba */}
      <rect x="4" y="3" width="92" height="101" {...g} strokeWidth={grosor} />
      {/* medio círculo central */}
      <path d="M 36 3 A 14 14 0 0 0 64 3" {...g} strokeWidth={grosor} />
      <circle cx="50" cy="3" r="0.9" fill={trazo} />
      {/* área grande y pequeña */}
      <rect x="22.5" y="72" width="55" height="32" {...g} strokeWidth={grosor} />
      <rect x="37.5" y="93.3" width="25" height="10.7" {...g} strokeWidth={grosor} />
      {/* punto y semicírculo de penalti */}
      <circle cx="50" cy="82.5" r="0.9" fill={trazo} />
      <path d="M 39.5 72 A 14.5 14.5 0 0 1 60.5 72" {...g} strokeWidth={grosor} />
      {/* portería */}
      <rect x="44.5" y="104" width="11" height="2.6" {...g} strokeWidth={grosor} />
      {/* córners */}
      <path d="M 4 101 A 3 3 0 0 1 7 104" {...g} strokeWidth={grosor} />
      <path d="M 93 104 A 3 3 0 0 1 96 101" {...g} strokeWidth={grosor} />
    </svg>
  );
}

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
  campoDestino,
  flecha = false,
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
  /** El destino del césped entero: soltar en un punto vacío deja al jugador ahí («campo:<equipo>»). */
  campoDestino?: string;
  /** Una flecha discreta con el sentido del ataque (hacia arriba: la portería propia va abajo). */
  flecha?: boolean;
  style?: CSSProperties;
}) {
  const alto = ancho * PROPORCION_CAMPO;
  /*
  | Lo que hay de una línea a la siguiente (21/10/2026). Con cuatro líneas y
  | nombres en dos renglones, la etiqueta de una línea tapaba la ficha de la
  | de delante (se veía en la diapositiva con cabecera, donde el campo es más
  | bajo). Ficha + nombre caben ahora en ese hueco.
  */
  const alturas = [...new Set(huecos.filter((h) => !h.aMano).map((h) => Math.round(h.y * 1000)))].sort((a, b) => a - b);
  const entreLineas = alturas.length > 1 ? Math.min(...alturas.slice(1).map((y, k) => y - alturas[k])) / 1000 : 1;
  /*
  | Con la ficha en su punto y el nombre colgando, la última línea se salía
  | por abajo en la lámina (21/10/2026). Sin tocar (la lámina), las alturas se
  | encogen lo justo para que el nombre de la línea de atrás quepa entero.
  |
  | Y al encogerlas, las líneas se juntan: la letra se calculaba con el hueco
  | de antes de encoger, y el nombre de una línea acababa encima de las fichas
  | de la siguiente («ÁNGEL CARVAJAL» sobre los tres de detrás). Se vuelve a
  | calcular con el hueco ya encogido, y otra vez la escala con esa letra.
  */
  const yMax = Math.max(0.01, ...huecos.filter((h) => h.jugador).map((h) => h.y));
  const medidas = (escala: number) => {
    const hueco = entreLineas * alto * escala;
    const ficha = Math.max(16, Math.min(50, ancho / 10, hueco * 0.38));
    /* En la lámina exportada (`claro`) los nombres van más grandes: se leen en la tele del vestuario. */
    const letra = Math.min(
      claro ? Math.max(10, Math.min(36, ancho / 16)) : Math.max(9, Math.min(28, ancho / 21)),
      /* Dos renglones (1,02 de alto cada uno, más el relleno) y una rendija antes de la ficha siguiente. */
      Math.max(8, (hueco - ficha - 14) / 2.4),
    );
    const sitioAbajo = alto - 6 - ficha / 2 - letra * 2.5 - 8;
    const escalaY = !onToca && yMax * alto > sitioAbajo ? sitioAbajo / (yMax * alto) : 1;
    return { ficha, letra, escalaY };
  };
  const primera = medidas(1);
  const { ficha, letra } = primera.escalaY < 1 ? medidas(primera.escalaY) : primera;
  const escalaY = primera.escalaY < 1 ? medidas(primera.escalaY).escalaY : 1;

  /*
  | Una sola letra para todos los nombres del campo (30/10/2026): cada uno se
  | ajustaba a su hueco y «JOAN MARTÍNEZ» salía más pequeño que sus vecinos.
  | Ahora manda el que menos sitio tiene, y todos se leen igual.
  */
  const anchoNombreDe = (h: Hueco) => {
    const enSuLinea = h.linea < 0 ? 3 : huecos.filter((x) => x.linea === h.linea && !x.aMano).length || 3;

    return Math.min(ancho / 2.6, (ancho / (enSuLinea + 1)) * 0.96);
  };
  const tamanoNombre = Math.max(
    8,
    Math.min(
      letra,
      ...huecos
        .filter((h) => h.jugador)
        .map((h) => {
          const largo = Math.max(renglonMasLargo(h.jugador!.nombre), h.pareja ? renglonMasLargo(h.pareja.nombre) : 0);

          return Math.min(letra * (h.pareja ? 0.88 : 1), anchoNombreDe(h) / (largo * 0.5 + 0.9));
        }),
    ),
  );

  const tinta = tintaSobre(color);
  /* Más pálidas en la lámina (21/10/2026): con 0,42 la línea del área y el semicírculo ensuciaban los nombres de encima. */
  const trazo = claro ? "rgba(20,83,45,0.26)" : "rgba(255,255,255,0.5)";
  const encimaCampo = Boolean(campoDestino && sobre === campoDestino);

  return (
    <div
      data-destino={campoDestino}
      data-campo-estructura={campoDestino ? "" : undefined}
      style={{
        position: "relative",
        width: ancho,
        height: alto,
        borderRadius: Math.max(10, ancho / 26),
        overflow: "hidden",
        background: claro
          ? "repeating-linear-gradient(180deg, #E9F5EC 0px, #E9F5EC 10%, #DDEFE2 10%, #DDEFE2 20%)"
          : "radial-gradient(120% 80% at 50% 100%, rgba(255,255,255,0.07), rgba(0,0,0,0) 60%), repeating-linear-gradient(180deg, #17663A 0px, #17663A 10%, #1B7543 10%, #1B7543 20%)",
        border: `2px solid ${encimaCampo ? "#C8A96B" : claro ? "rgba(20,83,45,0.25)" : "rgba(255,255,255,0.14)"}`,
        boxShadow: encimaCampo
          ? "0 0 0 4px rgba(200,169,107,0.35), inset 0 0 40px rgba(0,0,0,0.25)"
          : claro
            ? "none"
            : "inset 0 0 40px rgba(0,0,0,0.3), 0 10px 30px rgba(0,0,0,0.25)",
        flexShrink: 0,
        /* La letra estrecha de la lámina, también en la pantalla: caben nombres más grandes. */
        fontFamily: "var(--fuente-sesion, inherit)",
        transition: "box-shadow 120ms, border-color 120ms",
        ...style,
      }}
    >
      <Lineas trazo={trazo} grosor={Math.max(1.5, ancho / 220)} />

      {flecha && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: ancho * 0.015,
            top: "34%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            color: claro ? "rgba(20,83,45,0.55)" : "rgba(255,255,255,0.6)",
            fontSize: Math.max(8, ancho / 34),
            fontWeight: 700,
            letterSpacing: "0.12em",
            pointerEvents: "none",
          }}
        >
          <svg width={Math.max(10, ancho / 26)} height={Math.max(22, ancho / 9)} viewBox="0 0 10 30" aria-hidden>
            <path d="M5 29 V3 M1 8 L5 2 L9 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>ATAQUE</span>
        </div>
      )}

      {huecos.map((h, i) => {
        /* En la lámina (sin tocar), un hueco libre no se dibuja: ni círculo vacío ni guion en el campo que ven los jugadores (21/10/2026). */
        if (!h.jugador && !onToca) return null;

        const es = elegido === i;
        const destino = destinoDe?.(i);
        const debajo = Boolean(destino && sobre === destino);
        /*
        | Cada nombre cabe en su trozo de línea: con cuatro en fila, la cuarta
        | parte del campo. El mismo ancho en la lámina. Los huecos de una línea
        | están a 1/(n+1) del campo uno de otro: con 1,1 veces eso, dos nombres
        | largos vecinos se montaban (21/10/2026). Con 0,96 queda una rendija.
        */
        const anchoNombre = anchoNombreDe(h);
        const nombre = enDosRenglones(h.jugador?.nombre ?? "").join("\n");
        return (
          <div
            key={i}
            onClick={onToca ? () => onToca(i) : undefined}
            data-destino={destino}
            onPointerDown={onArrastra && h.jugador ? (e) => onArrastra(i, e) : undefined}
            style={{
              position: "absolute",
              left: `${h.x * 100}%`,
              top: `${h.y * escalaY * 100}%`,
              /* La FICHA en el punto, el nombre colgando (21/10/2026): centrando el bloque entero, un nombre en dos renglones subía su ficha y la línea no quedaba recta. */
              transform: `translate(-50%, ${-(ficha / 2 + (onToca ? 4 : 0))}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: anchoNombre,
              /* Un blanco generoso para el dedo, aunque la ficha sea pequeña. */
              padding: onToca ? 4 : 0,
              cursor: onArrastra && h.jugador ? "grab" : onToca ? "pointer" : "default",
              touchAction: onArrastra && h.jugador ? "pan-y" : undefined,
              userSelect: "none",
              zIndex: es || debajo ? 3 : h.aMano ? 2 : 1,
            }}
            title={
              h.jugador
                ? `${h.jugador.nombre}${h.pareja ? ` y ${h.pareja.nombre} (comparten puesto)` : ""}${onToca ? " · arrástralo a cualquier punto, o toca otro para cambiarlos" : ""}`
                : onToca
                  ? "Hueco libre: suelta aquí a un jugador"
                  : "Hueco libre"
            }
          >
            <span
              style={{
                width: ficha,
                height: ficha,
                borderRadius: 999,
                background: h.jugador
                  ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), ${color}`
                  : claro
                    ? "rgba(20,83,45,0.06)"
                    : "rgba(255,255,255,0.08)",
                border: h.jugador
                  ? `${Math.max(2, ficha / 16)}px solid ${es ? "#C8A96B" : claro ? "rgba(11,15,20,0.35)" : "#FFFFFF"}`
                  : `2px dashed ${claro ? "rgba(20,83,45,0.5)" : "rgba(255,255,255,0.6)"}`,
                boxShadow: es || debajo ? "0 0 0 4px #C8A96B" : h.jugador ? "0 3px 8px rgba(0,0,0,0.35)" : "none",
                transform: debajo ? "scale(1.22)" : undefined,
                transition: "transform 120ms, box-shadow 120ms",
                color: tinta,
                fontSize: ficha * 0.36,
                fontWeight: 700,
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {/* Comparte puesto: una segunda ficha asomando detrás, con un «2». */}
              {h.pareja && (
                <span
                  style={{
                    position: "absolute",
                    right: -ficha * 0.38,
                    top: -ficha * 0.18,
                    width: ficha * 0.62,
                    height: ficha * 0.62,
                    borderRadius: 999,
                    background: color,
                    border: `${Math.max(2, ficha / 18)}px solid ${claro ? "#FFFFFF" : "#0B0F14"}`,
                    color: tinta,
                    fontSize: ficha * 0.3,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  2
                </span>
              )}
            </span>
            <span
              style={{
                marginTop: Math.max(2, ficha / 12),
                maxWidth: "100%",
                /* Que la palabra más larga del nombre quepa entera en su línea. */
                fontSize: tamanoNombre,
                fontWeight: 700,
                lineHeight: 1.02,
                textTransform: "uppercase",
                textAlign: "center",
                /* El nombre entero, en dos líneas como mucho: «JORGE / CESTERO», «HUGO / DE LLANOS». */
                whiteSpace: "pre-line",
                overflowWrap: "normal",
                color: h.jugador ? (claro ? "#0B0F14" : "#FFFFFF") : claro ? "rgba(11,15,20,0.4)" : "rgba(255,255,255,0.55)",
                background: h.jugador ? (claro ? "rgba(255,255,255,0.92)" : "rgba(6,12,9,0.62)") : "transparent",
                boxShadow: h.jugador && claro ? "0 1px 3px rgba(11,26,51,0.12)" : "none",
                borderRadius: Math.max(4, tamanoNombre / 3),
                padding: h.jugador ? `${Math.max(1, tamanoNombre / 8)}px ${Math.max(3, tamanoNombre / 3)}px` : 0,
              }}
            >
              {h.jugador ? nombre : onToca ? "libre" : "—"}
              {h.jugador && h.pareja && (
                <span style={{ display: "block", marginTop: Math.max(1, tamanoNombre / 6), paddingTop: Math.max(1, tamanoNombre / 6), borderTop: `1px solid ${claro ? "rgba(11,15,20,0.18)" : "rgba(255,255,255,0.25)"}` }}>
                  {enDosRenglones(h.pareja.nombre).join("\n")}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
