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
 *
 * PUESTOS COMPARTIDOS SIN CORTES (07/11/2026): en un puesto caben varios (dos,
 * tres, cuatro…). Sus nombres van uno debajo de otro en la etiqueta de la
 * ficha, cada uno en un renglón si le cabe, con su propia letra: la que cabe
 * hasta la ficha de detrás. Antes la etiqueta de dos crecía hacia abajo hasta
 * taparse con la línea siguiente o salirse del campo. Además ninguna etiqueta
 * se sale por las bandas (se arrima hacia dentro) ni por abajo (si no cabe
 * bajo la ficha, va encima).
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import type { Hueco } from "@/lib/sesion-equipos/estructura";
import { tintaSobre, type JugadorSesion } from "@/lib/sesion-equipos/modelo";

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

/** Los del hueco: el titular y, detrás, los que comparten su puesto. */
const nombresDe = (h: Hueco): JugadorSesion[] => (h.jugador ? [h.jugador, ...(h.companeros ?? [])] : []);

export function CampoEstructura({
  huecos,
  color,
  ancho,
  claro = false,
  grande = false,
  elegido = null,
  onToca,
  destinoDe,
  destinoParDe,
  sobre = null,
  onArrastra,
  onArrastraCompanero,
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
  /**
   * Nombres lo más grandes posible (07/11/2026, la lámina limpia): tope de
   * letra más alto y la medida de la mayúscula más ajustada a la Barlow
   * Condensed (0,42 em en vez de 0,5).
   */
  grande?: boolean;
  /** El hueco tocado, a la espera del segundo para cambiarlos. */
  elegido?: number | null;
  onToca?: (indice: number) => void;
  /** El destino de cada hueco para soltar ahí a alguien que se arrastra («hueco:<equipo>:<n>»). */
  destinoDe?: (indice: number) => string;
  /** El «+» de un puesto abierto a compartirse (07/11/2026): soltar ahí lo comparte («par:<equipo>:<titular>»). */
  destinoParDe?: (indice: number) => string;
  /** El destino que hay debajo del arrastre ahora mismo. */
  sobre?: string | null;
  /** Empieza a arrastrar al jugador de un hueco. */
  onArrastra?: (indice: number, e: ReactPointerEvent) => void;
  /** Empieza a arrastrar a uno de los que comparten puesto (su nombre en la etiqueta). */
  onArrastraCompanero?: (jugador: JugadorSesion, e: ReactPointerEvent) => void;
  /** El destino del césped entero: soltar en un punto vacío deja al jugador ahí («campo:<equipo>»). */
  campoDestino?: string;
  /** Una flecha discreta con el sentido del ataque (hacia arriba: la portería propia va abajo). */
  flecha?: boolean;
  style?: CSSProperties;
}) {
  const alto = ancho * PROPORCION_CAMPO;
  /* Lo que mide una mayúscula de la Barlow Condensed en negrita, en em, con algo de margen; y el relleno de la etiqueta. */
  const EM = grande ? 0.42 : 0.5;
  const anchoTexto = (texto: string, f: number) => f * (Math.max(3, texto.length) * EM + 0.9);

  /*
  | Cada nombre cabe en su trozo de línea: con cuatro en fila, la cuarta
  | parte del campo. El mismo ancho en la lámina. Los huecos de una línea
  | están a 1/(n+1) del campo uno de otro: con 1,1 veces eso, dos nombres
  | largos vecinos se montaban (21/10/2026). Con 0,96 queda una rendija.
  */
  const anchoNombreDe = (h: Hueco) => {
    const enSuLinea = h.linea < 0 ? 3 : huecos.filter((x) => x.linea === h.linea && !x.aMano).length || 3;

    return Math.min(ancho / 2.6, (ancho / (enSuLinea + 1)) * 0.96);
  };

  /*
  | Los renglones de un nombre. Solo en su puesto, como siempre: en dos si
  | tiene dos palabras. Compartiendo, en uno si le cabe (la etiqueta de tres
  | no puede tener seis renglones).
  */
  const renglonesDe = (nombre: string, f: number, w: number, compartido: boolean) =>
    compartido && anchoTexto(nombre, f) <= w ? [nombre] : enDosRenglones(nombre);

  const relleno = (f: number) => Math.max(1, f / 8);
  const raya = (f: number) => 2 * Math.max(1, f / 6) + 1;

  /*
  | EN EL MÓVIL, UN SOLO RÓTULO POR PUESTO COMPARTIDO (07/11/2026). A 390 px
  | los tres nombres de un puesto compartido se montaban sobre los de al lado
  | («DIEGO AGUADO / LAMINI FATI» encima de OSCAR NAASEI). En la pantalla
  | estrecha la etiqueta lleva al titular y «+1»; los demás, en la lista de
  | debajo del campo. La lámina (sin tocar) sigue con todos.
  */
  const compacto = Boolean(onToca) && ancho < 380;
  const enEtiqueta = (h: Hueco): JugadorSesion[] => (compacto && h.jugador && h.companeros?.length ? [h.jugador] : nombresDe(h));
  const conMas = (h: Hueco) => (compacto && h.jugador && h.companeros?.length ? h.companeros.length : 0);

  /** Lo que mide de alto la etiqueta de un hueco con esa letra (sin el aire sobre ella). */
  const altoEtiqueta = (h: Hueco, f: number) => {
    const quienes = enEtiqueta(h);
    const compartido = quienes.length > 1;
    const w = anchoNombreDe(h);
    const filas = quienes.reduce((s, j) => s + renglonesDe(j.nombre, f, w, compartido).length, 0) + (conMas(h) ? 1 : 0);

    return filas * 1.02 * f + 2 * relleno(f) + (quienes.length - 1) * raya(f);
  };

  /** Que cada renglón de la etiqueta quepa a lo ancho. */
  const cabeAncho = (h: Hueco, f: number) => {
    const quienes = enEtiqueta(h);
    const w = anchoNombreDe(h);

    return quienes.every((j) => renglonesDe(j.nombre, f, w, quienes.length > 1).every((r) => anchoTexto(r, f) <= w));
  };

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
  |
  | Con puestos compartidos (07/11/2026) la etiqueta de atrás puede ser más
  | alta que dos renglones: se cuenta la de cada hueco, y la escala no baja
  | de 0,72 (lo que falte lo pone la letra de ese puesto, más pequeña).
  */
  const conJugador = huecos.filter((h) => h.jugador);
  const medidas = (escala: number) => {
    const hueco = entreLineas * alto * escala;
    const ficha = Math.max(16, Math.min(grande ? 56 : 50, ancho / 10, hueco * 0.38));
    /* En la lámina exportada (`claro`) los nombres van más grandes: se leen en la tele del vestuario. */
    const letra = Math.min(
      grande ? Math.max(12, Math.min(48, ancho / 13)) : claro ? Math.max(10, Math.min(36, ancho / 16)) : Math.max(9, Math.min(28, ancho / 21)),
      /* Dos renglones (1,02 de alto cada uno, más el relleno) y una rendija antes de la ficha siguiente. */
      Math.max(8, (hueco - ficha - 14) / 2.4),
    );
    let escalaY = 1;
    if (!onToca) {
      for (const h of conJugador) {
        const sitio = alto - 6 - ficha / 2 - Math.max(2, ficha / 12) - altoEtiqueta(h, letra) - 4;
        if (h.y * alto > sitio) escalaY = Math.min(escalaY, sitio / (h.y * alto));
      }
      escalaY = Math.max(0.72, escalaY);
    }
    return { ficha, letra, escalaY };
  };
  const primera = medidas(1);
  const { ficha, letra } = primera.escalaY < 1 ? medidas(primera.escalaY) : primera;
  const escalaY = primera.escalaY < 1 ? medidas(primera.escalaY).escalaY : 1;
  const aire = Math.max(2, ficha / 12);
  const pad = onToca ? 4 : 0;

  /*
  | Una sola letra para todos los nombres del campo (30/10/2026): cada uno se
  | ajustaba a su hueco y «JOAN MARTÍNEZ» salía más pequeño que sus vecinos.
  | Ahora manda el que menos sitio tiene, y todos se leen igual. Los puestos
  | compartidos no cuentan (07/11/2026): llevan la suya, para no encoger a
  | todo el equipo por uno.
  */
  const solos = conJugador.filter((h) => !h.companeros?.length);
  const tamanoNombre = Math.max(
    8,
    Math.min(letra, ...solos.map((h) => anchoNombreDe(h) / (Math.max(3, ...enDosRenglones(h.jugador!.nombre).map((t) => t.length)) * EM + 0.9))),
  );

  /** El centro de la ficha, en píxeles del campo. */
  const centro = (h: Hueco) => ({ cx: h.x * ancho, cy: h.y * escalaY * alto });

  /*
  | Cuánto sitio tiene la etiqueta bajo la ficha (07/11/2026): hasta la ficha
  | más cercana de detrás que caiga debajo de ella, o hasta el fondo del campo.
  */
  const sitioAbajo = (h: Hueco) => {
    const { cx, cy } = centro(h);
    const w = anchoNombreDe(h);
    let hasta = alto - 6;
    let fondo = true;
    for (const o of conJugador) {
      if (o === h) continue;
      const c = centro(o);
      if (c.cy <= cy + 1 || Math.abs(c.cx - cx) >= (w + Math.max(ficha, anchoNombreDe(o) * 0.6)) / 2) continue;
      if (c.cy - ficha / 2 - 4 < hasta) {
        hasta = c.cy - ficha / 2 - 4;
        fondo = false;
      }
    }
    return { sitio: hasta - (cy + ficha / 2 + aire), fondo };
  };

  /*
  | Cada hueco: su letra y si la etiqueta va debajo (lo normal) o encima, si
  | abajo no cabe ni con letra pequeña (un jugador soltado junto a la línea de
  | fondo en la pantalla).
  */
  const disposicion = huecos.map((h) => {
    if (!h.jugador) return { tamano: tamanoNombre, encima: false };

    const compartido = (h.companeros?.length ?? 0) > 0;
    const { sitio: abajo, fondo } = sitioAbajo(h);
    const arriba = centro(h).cy - ficha / 2 - aire - 4;
    const minimo = Math.min(tamanoNombre, 10);
    /* Sólo contra la línea de fondo: entre dos líneas, encima pisaría los nombres de la de delante. */
    const encima = fondo && altoEtiqueta(h, minimo) > abajo && arriba > abajo;
    const sitio = encima ? arriba : abajo;

    if (!compartido && altoEtiqueta(h, tamanoNombre) <= sitio) return { tamano: tamanoNombre, encima };

    let f = tamanoNombre;
    while (f > 8 && (!cabeAncho(h, f) || altoEtiqueta(h, f) > sitio)) f -= 0.5;
    return { tamano: Math.max(8, f), encima };
  });

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
        const quienes = nombresDe(h);
        const compartido = quienes.length > 1;
        const { tamano, encima } = disposicion[i];
        const anchoNombre = anchoNombreDe(h);
        const { cx, cy } = centro(h);
        /* Arrimada hacia dentro en las bandas (07/11/2026): la etiqueta de un lateral se cortaba en el borde. */
        const izquierda = Math.min(Math.max(2, cx - anchoNombre / 2), Math.max(2, ancho - 2 - anchoNombre));
        const desvio = cx - (izquierda + anchoNombre / 2);
        const destinoPar = h.abierto && onToca ? destinoParDe?.(i) : undefined;
        const sobrePar = Boolean(destinoPar && sobre === destinoPar);
        const borde = claro ? "rgba(11,15,20,0.18)" : "rgba(255,255,255,0.25)";

        return (
          <div
            key={i}
            onClick={onToca ? () => onToca(i) : undefined}
            data-destino={destino}
            onPointerDown={onArrastra && h.jugador ? (e) => onArrastra(i, e) : undefined}
            style={{
              position: "absolute",
              left: izquierda - pad,
              /* La FICHA en el punto, el nombre colgando (21/10/2026); o encima, si abajo no cabe. */
              ...(encima ? { bottom: alto - (cy + ficha / 2 + pad) } : { top: cy - ficha / 2 - pad }),
              display: "flex",
              flexDirection: encima ? "column-reverse" : "column",
              alignItems: "center",
              width: anchoNombre + pad * 2,
              boxSizing: "border-box",
              /* Un blanco generoso para el dedo, aunque la ficha sea pequeña. */
              padding: pad,
              cursor: onArrastra && h.jugador ? "grab" : onToca ? "pointer" : "default",
              touchAction: onArrastra && h.jugador ? "pan-y" : undefined,
              userSelect: "none",
              zIndex: es || debajo || sobrePar ? 3 : h.aMano ? 2 : 1,
            }}
            title={
              h.jugador
                ? `${quienes.map((j) => j.nombre).join(", ")}${compartido ? ` (comparten puesto)` : ""}${onToca ? " · arrástralo a cualquier punto, o toca otro para cambiarlos" : ""}`
                : onToca
                  ? "Hueco libre: suelta aquí a un jugador"
                  : "Hueco libre"
            }
          >
            <span
              style={{
                width: ficha,
                height: ficha,
                flexShrink: 0,
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
                transform: `translateX(${desvio}px)${debajo ? " scale(1.22)" : ""}`,
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
              {/* Comparten puesto: una segunda ficha asomando detrás, con cuántos son. */}
              {compartido && (
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
                  {quienes.length}
                </span>
              )}
              {/* Puesto abierto a compartirse (07/11/2026): un «+» donde soltar al que lo comparte. */}
              {destinoPar && (
                <span
                  data-destino={destinoPar}
                  title="Puesto abierto para compartir: suelta aquí a quien lo comparte"
                  style={{
                    position: "absolute",
                    left: -ficha * 0.5,
                    top: -ficha * 0.2,
                    width: ficha * 0.66,
                    height: ficha * 0.66,
                    borderRadius: 999,
                    background: sobrePar ? "#C8A96B" : "rgba(11,15,20,0.55)",
                    border: `2px dashed ${sobrePar ? "#FFFFFF" : "#C8A96B"}`,
                    color: sobrePar ? "#0B0F14" : "#E9D5A8",
                    fontSize: ficha * 0.42,
                    fontWeight: 800,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: sobrePar ? "scale(1.25)" : undefined,
                    transition: "transform 120ms",
                  }}
                >
                  +
                </span>
              )}
            </span>
            <span
              style={{
                [encima ? "marginBottom" : "marginTop"]: aire,
                maxWidth: "100%",
                /* Que la palabra más larga del nombre quepa entera en su línea. */
                fontSize: tamano,
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
                borderRadius: Math.max(4, tamano / 3),
                padding: h.jugador ? `${relleno(tamano)}px ${Math.max(3, tamano / 3)}px` : 0,
              }}
            >
              {h.jugador
                ? [
                  ...enEtiqueta(h).map((j, k) => (
                    <span
                      key={j.id}
                      data-nombre-campo=""
                      onPointerDown={
                        k > 0 && onArrastraCompanero
                          ? (e) => {
                              e.stopPropagation();
                              onArrastraCompanero(j, e);
                            }
                          : undefined
                      }
                      style={{
                        display: "block",
                        cursor: k > 0 && onArrastraCompanero ? "grab" : undefined,
                        ...(k > 0 ? { marginTop: Math.max(1, tamano / 6), paddingTop: Math.max(1, tamano / 6), borderTop: `1px solid ${borde}` } : {}),
                      }}
                    >
                      {renglonesDe(j.nombre, tamano, anchoNombre, enEtiqueta(h).length > 1).join("\n")}
                    </span>
                  )),
                  conMas(h) ? (
                    <span key="mas" style={{ display: "block", opacity: 0.8 }}>
                      +{conMas(h)}
                    </span>
                  ) : null,
                ]
                : onToca
                  ? "libre"
                  : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
