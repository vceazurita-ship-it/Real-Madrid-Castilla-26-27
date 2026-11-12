"use client";

/**
 * El dossier de desplazamiento: las diapositivas del viaje.
 *
 * Es la versión viva de `public/AWAY_TERUEL.pptx`, que llevaba dos hojas —el
 * campo y el hotel— con una tabla de cabecera repetida y dos capturas de
 * Google Maps pegadas a mano. Aquí son como mucho tres y sin portada
 * (11/11/2026): la del campo, la del hotel si lo hay y la del viaje —los
 * trayectos del horario con su duración y la foto del destino— si los hay.
 *
 * Qué cambia respecto al original, y por qué:
 *
 * - **La cabecera del partido es una banda, no una tabla.** El pptx repetía
 *   una tabla de siete columnas con los rótulos en gris; a tamaño de
 *   proyección no se leía cuál era el dato y cuál el rótulo. Aquí el dato va
 *   grande y el rótulo pequeño encima, separados por filetes finos.
 * - **Los planos tienen pie.** Una captura de Google Maps sin rótulo no dice
 *   si es la ruta o el aparcamiento; ahora cada imagen lleva escrito lo que es.
 * - **Lo vacío no sale.** Un dato sin rellenar no deja ni rótulo ni hueco: el
 *   aviso de lo que falta va en la pantalla de edición, no en el documento.
 *
 * Todo el color va en estilos en línea: la captura (`html-to-image`)
 * serializa el estilo calculado y los colores `oklch` de Tailwind no
 * sobreviven al JPEG. El acabado es el de `public/INDIVIDUAL.pptx`.
 */

import type { CSSProperties, ReactNode } from "react";

import {
  CLUB_VIAJE,
  COLORES_VIAJE as C,
  DOSSIER_H,
  DOSSIER_W,
  MARGEN_DOSSIER as MARGEN,
  aHora,
  citasDelViaje,
  comoDuracion,
  diaCorto,
  diaLargo,
  emojiDeCita,
  fechaCorta,
  esSalida,
  type Desplazamiento,
  type ImagenViaje,
} from "@/lib/viaje/modelo";
import { resuelveLugar } from "@/lib/viaje/rutas";
import { comoCompeticion } from "@/lib/viaje/revision";

/**
 * Las fotos de BeSoccer (`cdn.resfu.com`) no mandan CORS y la captura del
 * documento no podría leerlas: pasan por el proxy de la casa, como las de
 * las fichas de los rivales.
 */
export function srcImagen(url: string) {
  return /^https:\/\/([a-z0-9-]+\.)*(resfu\.com|besoccer\.com)\//i.test(url) ? `/api/rivals/foto?url=${encodeURIComponent(url)}` : url;
}

/**
 * Lo que no tiene dato no se pinta (22/10/2026): ni guion, ni «Sin plano», ni
 * recuadro vacío. Antes el hueco se veía como «—» para que no se colara un
 * olvido, pero el documento que sale al cuerpo técnico no puede llevar
 * recuadros que dicen lo que falta; el aviso de lo que falta va en la pantalla
 * de edición.
 */
const valor = (texto: string | undefined) => (texto?.trim() ? texto : "");

const hay = (texto: string | undefined) => Boolean(texto?.trim());

/**
 * Una sola línea que cabe (19/10/2026): con un nombre largo —«Estadio
 * Municipal de Santo Domingo»— el título partía en dos y empujaba el plano
 * sobre el pie. La letra baja hasta que cabe en `ancho` (~`em` por letra
 * en Barlow Condensed mayúscula), como mucho al 55 %; y si ni así, «…».
 */
const enUnaLinea = (texto: string, base: number, ancho: number, em = 0.52): CSSProperties => {
  const letras = Math.max(1, texto.trim().length);

  return {
    fontSize: Math.max(Math.round(base * 0.55), Math.min(base, Math.floor(ancho / (letras * em)))),
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
};

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

/** Rótulo pequeño en verde con mucho espaciado: la voz de la plantilla. */
function Rotulo({
  children,
  color = C.verde,
  tamano = 15,
}: {
  children: ReactNode;
  color?: string;
  tamano?: number;
}) {
  return (
    <p
      style={{
        margin: 0,
        color,
        fontSize: tamano,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </p>
  );
}

/** Un dato de la banda: rótulo arriba, valor grande debajo. */
/*
| 12/11/2026 (expertos): ningún dato de la banda sale con «…». La letra la
| fija `BandaPartido`, que reparte el ancho según lo que mide cada dato; el
| «…» queda sólo de red, por si la estimación se queda corta.
*/
function Casilla({
  rotulo,
  dato,
  tamano,
  destacado = false,
  escudo,
}: {
  rotulo: string;
  dato: string;
  /** El cuerpo del dato, ya ajustado para que quepa entero. */
  tamano: number;
  destacado?: boolean;
  /** El escudo del rival delante del nombre (11/11/2026). */
  escudo?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <Rotulo tamano={13}>{rotulo}</Rotulo>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: escudo ? 4 : 0 }}>
      {escudo && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={srcImagen(escudo)} alt="" draggable={false} style={{ height: 42, width: 42, objectFit: "contain", flex: "0 0 auto" }} />
      )}
      <p
        style={{
          minWidth: 0,
          margin: escudo ? 0 : "10px 0 0",
          color: destacado ? C.rosaTexto : C.navy,
          fontSize: tamano,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "0.01em",
          textTransform: "uppercase",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {dato}
      </p>
      </div>
    </div>
  );
}

/*
| Lo que mide cada casilla, en píxeles de la diapositiva (12/11/2026). Barlow
| Condensed en negrita y mayúscula va a ~0,55 em por letra (algo más que en
| `enUnaLinea`, para no quedarse corto); el rótulo, a 13 px con 0,3 em de
| espaciado, ~10,5 px por letra.
*/
const EM_BANDA = 0.55;
const PAD_BANDA = 28;
const midaCasilla = (dato: string, base: number, rotulo: string, escudo: boolean) =>
  Math.max(rotulo.length * 10.5, dato.trim().length * base * EM_BANDA + (escudo ? 54 : 0));

/**
 * La cabecera del partido, repetida en las tres diapositivas.
 *
 * Es la tabla del pptx original —equipo, rival, jornada, fecha, hora y
 * campo— rehecha: fondo crema, filetes verticales entre casillas y el rival
 * en rosa hondo, que es el dato que se busca al abrir el fichero.
 */
/*
| `sinCampo` (12/11/2026, expertos): en la diapositiva del estadio el nombre
| ya va en grande debajo; repetido en la banda se leía dos veces seguidas.
|
| Mismo día (expertos): «GIMNÀSTIC DE TAR…» y «VIERNES 13 DE …» salían
| cortados. La fecha va corta («VIE 13/11/2026», la larga sigue en el pie) y
| el ancho se reparte por lo que mide cada dato: si no cabe todo, baja la
| letra de la banda entera, igual en todas las casillas, hasta que cabe.
*/
function BandaPartido({ viaje, sinCampo = false }: { viaje: Desplazamiento; sinCampo?: boolean }) {
  const casa = viaje.condicion === "local";

  const todas = [
    { rotulo: "Equipo", dato: "RMCF Castilla" },
    { rotulo: "Rival", dato: valor(viaje.rival), destacado: true, escudo: viaje.escudo?.trim() || undefined },
    { rotulo: "Jornada", dato: valor(viaje.jornada) },
    { rotulo: "Fecha", dato: valor(fechaCorta(viaje.fecha) || viaje.fecha) },
    { rotulo: "Hora", dato: valor(viaje.hora) },
    sinCampo
      ? { rotulo: "Se juega", dato: casa ? "En casa" : "Fuera" }
      : { rotulo: casa ? "En casa" : "Fuera", dato: valor(viaje.estadio.nombre) },
  ];

  const casillas = todas.filter((casilla) => hay(casilla.dato));

  /* El hueco de dentro de la banda: el ancho del contenido menos su relleno y el de cada casilla. */
  const rellenos = casillas.reduce((n, _c, i) => n + (i === 0 ? 0 : PAD_BANDA) + PAD_BANDA, 0);
  const hueco = DOSSIER_W - MARGEN * 2 - 64 - rellenos;
  const medidas = casillas.map((c) =>
    midaCasilla(c.dato, c.destacado ? 40 : 34, c.rotulo, Boolean("escudo" in c && c.escudo)),
  );
  const total = medidas.reduce((n, m) => n + m, 0) || 1;
  /* Si sobra sitio, la letra se queda en su cuerpo; si falta, baja toda la banda por igual (nunca por debajo del 55 %). */
  const escala = Math.max(0.55, Math.min(1, hueco / total));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        backgroundColor: C.crema,
        border: `1px solid ${C.rosa}`,
        borderRadius: 18,
        padding: "22px 32px",
      }}
    >
      {casillas.map((casilla, indice) => (
        <div
          key={casilla.rotulo}
          style={{
            minWidth: 0,
            /* Cada casilla crece en proporción a lo que mide su dato. */
            flex: `${medidas[indice]} 1 0px`,
            paddingLeft: indice === 0 ? 0 : PAD_BANDA,
            paddingRight: PAD_BANDA,
            borderRight:
              indice === casillas.length - 1
                ? "none"
                : `1px solid ${C.rosa}`,
          }}
        >
          <Casilla
            rotulo={casilla.rotulo}
            dato={casilla.dato}
            tamano={Math.floor((casilla.destacado ? 40 : 34) * escala)}
            destacado={casilla.destacado}
            escudo={"escudo" in casilla ? casilla.escudo : undefined}
          />
        </div>
      ))}
    </div>
  );
}

/** Una fila de ficha: rótulo a la izquierda, dato a la derecha. */
function Renglon({ rotulo, dato }: { rotulo: string; dato: string }) {
  if (!hay(dato)) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 20,
        padding: "13px 0",
        borderBottom: `1px solid rgba(15,30,61,.10)`,
      }}
    >
      <div style={{ width: 220, flex: "0 0 auto" }}>
        <Rotulo tamano={14}>{rotulo}</Rotulo>
      </div>

      <p
        style={{
          margin: 0,
          minWidth: 0,
          flex: 1,
          color: C.navy,
          fontSize: 27,
          fontWeight: 600,
          lineHeight: 1.15,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {dato}
      </p>
    </div>
  );
}

/** Un número que se lee de lejos: la distancia y el tiempo del viaje. */
function Cifra({ dato, rotulo }: { dato: string; rotulo: string }) {
  if (!hay(dato)) return null;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: C.navy,
        borderRadius: 16,
        padding: "18px 24px",
      }}
    >
      <Rotulo tamano={13} color={C.rosa}>
        {rotulo}
      </Rotulo>

      <p
        style={{
          margin: "12px 0 0",
          color: "#FFFFFF",
          fontSize: 46,
          fontWeight: 700,
          lineHeight: 1,
          textTransform: "uppercase",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {dato}
      </p>
    </div>
  );
}

/**
 * Un plano con su pie.
 *
 * El hueco se dibuja igual de grande cuando no hay imagen: así el documento
 * enseña que le falta el plano en lugar de salir descuadrado.
 */
function Plano({
  imagen,
  alto,
  respaldo,
}: {
  imagen?: ImagenViaje;
  alto: number;
  respaldo: string;
}) {
  /* Sin imagen no se dibuja el recuadro: el documento no dice lo que falta. */
  if (!imagen?.url) return null;

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          height: alto,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: C.crema,
          border: `1px solid ${imagen?.url ? "rgba(15,30,61,.12)" : C.rosa}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imagen?.url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={srcImagen(imagen.url)}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <p
            style={{
              margin: 0,
              color: "rgba(15,30,61,.35)",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Sin {respaldo}
          </p>
        )}
      </div>

      <p
        style={{
          margin: "12px 0 0",
          color: C.verde,
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        {imagen?.pie?.trim() || respaldo}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EL MARCO                                                           */
/* ------------------------------------------------------------------ */

/**
 * Papel, cabecera con escudo, filo rosa y pie firmado.
 *
 * Es el marco de `INDIVIDUAL.pptx`: el mismo que lleva la portada del jugador
 * rival, para que los documentos de la semana se reconozcan como de la misma
 * casa aunque los monte gente distinta.
 */
function Marco({
  titulo,
  viaje,
  children,
}: {
  titulo: string;
  viaje: Desplazamiento;
  children: ReactNode;
}) {
  return (
    <div
      data-viaje-slide
      style={{
        position: "relative",
        width: DOSSIER_W,
        height: DOSSIER_H,
        backgroundColor: C.papel,
        overflow: "hidden",
        fontFamily: "var(--fuente-viaje, inherit)",
        /* Aire entre lienzos en la vista previa. La captura pone el margen a
           cero, así que no llega al documento. */
        marginBottom: 26,
      }}
    >
      {/* Esquina rosa: el sello de la plantilla, girado sobre el vértice. */}
      <div
        style={{
          position: "absolute",
          left: -21,
          top: -21,
          width: 42,
          height: 42,
          backgroundColor: C.rosaHondo,
          transform: "rotate(45deg)",
        }}
      />

      {/* ------------------------- CABECERA ------------------------- */}

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: 46,
          right: MARGEN,
          height: 118,
          display: "flex",
          alignItems: "center",
          gap: 26,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          draggable={false}
          style={{ height: 104, width: "auto", display: "block" }}
        />

        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              color: C.verde,
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            {CLUB_VIAJE}
          </p>

          <p
            style={{
              margin: "12px 0 0",
              color: "rgba(15,30,61,.5)",
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
            }}
          >
            {/* «Jornada 12» no es una competición: se lee la liga (12/11/2026). */}
            {hay(comoCompeticion(viaje.competicion))
              ? comoCompeticion(viaje.competicion)
              : "Desplazamiento de partido"}
          </p>
        </div>

        <div
          style={{
            flex: "0 0 auto",
            backgroundColor: C.navy,
            borderRadius: 999,
            padding: "14px 30px",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#FFFFFF",
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {titulo}
          </p>
        </div>
      </div>

      {/* Filo rosa: cierra la cabecera, como en la plantilla. */}
      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: 188,
          width: DOSSIER_W - MARGEN * 2,
          height: 5,
          backgroundColor: C.rosa,
        }}
      />

      {/* ------------------------ CONTENIDO ------------------------- */}

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: 222,
          width: DOSSIER_W - MARGEN * 2,
          height: 770,
        }}
      >
        {children}
      </div>

      {/* --------------------------- PIE ---------------------------- */}

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: 1006,
          width: DOSSIER_W - MARGEN * 2,
          height: 3,
          backgroundColor: C.rosa,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: 1028,
          width: DOSSIER_W - MARGEN * 2,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <p
          style={{
            margin: 0,
            color: C.verde,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
          }}
        >
          RMCF Castilla · Desplazamiento
        </p>

        <p
          style={{
            margin: 0,
            color: "rgba(15,30,61,.45)",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          {[valor(viaje.rival), valor(diaLargo(viaje.fecha) || viaje.fecha)].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LAS DIAPOSITIVAS                                                   */
/* ------------------------------------------------------------------ */

/**
 * Lo que tarda el autobús hasta el destino, si el analista no lo escribió: la
 * duración del primer trayecto de ida del horario (11/11/2026).
 */
function tiempoDeIda(viaje: Desplazamiento) {
  for (const { cita } of citasDelViaje(viaje)) {
    if (cita.duracion && esSalida(cita) && cita.desde && cita.desde !== "hotel" && cita.desde !== "estadio") {
      return comoDuracion(cita.duracion);
    }
  }

  return "";
}

function SlideEstadio({ viaje }: { viaje: Desplazamiento }) {
  const tiempo = valor(viaje.estadio.tiempo) || (viaje.condicion === "visitante" ? tiempoDeIda(viaje) : "");

  return (
    <Marco titulo="El estadio" viaje={viaje}>
      <BandaPartido viaje={viaje} sinCampo={hay(viaje.estadio.nombre)} />

      <div style={{ display: "flex", gap: 44, marginTop: 34 }}>
        <div style={{ width: 800, flex: "0 0 auto" }}>
          {hay(viaje.estadio.nombre) && (
          <p
            style={{
              margin: 0,
              color: C.navy,
              fontWeight: 700,
              lineHeight: 1,
              textTransform: "uppercase",
              ...enUnaLinea(valor(viaje.estadio.nombre), 52, 800),
            }}
          >
            {valor(viaje.estadio.nombre)}
          </p>
          )}

          <div style={{ marginTop: hay(viaje.estadio.nombre) ? 22 : 0 }}>
            <Renglon rotulo="Superficie" dato={valor(viaje.estadio.superficie)} />
            {/* Con su fuente (12/11/2026): «102 × 67 · BeSoccer», para saber de dónde sale la medida. */}
            <Renglon
              rotulo="Dimensiones"
              dato={hay(viaje.estadio.dimensiones) ? [valor(viaje.estadio.dimensiones), valor(viaje.estadio.dimensionesFuente)].filter(Boolean).join(" · ") : ""}
            />
            <Renglon rotulo="Capacidad" dato={valor(viaje.estadio.capacidad)} />
            <Renglon rotulo="Ciudad" dato={valor(viaje.estadio.ciudad)} />
            <Renglon rotulo="Dirección" dato={valor(viaje.estadio.direccion)} />
          </div>

          <div style={{ marginTop: 26 }}>
            <Plano
              imagen={viaje.estadio.plano?.url ? viaje.estadio.plano : viaje.estadio.foto}
              alto={250}
              respaldo={viaje.estadio.plano?.url ? "Plano del estadio" : valor(viaje.estadio.nombre) || "El estadio"}
            />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 20 }}>
            <Cifra rotulo="Distancia" dato={valor(viaje.estadio.distancia)} />
            <Cifra rotulo="Tiempo" dato={tiempo} />
          </div>

          {hay(viaje.origen) && hay(viaje.estadio.nombre) && (hay(viaje.estadio.distancia) || hay(tiempo) || Boolean(viaje.estadio.ruta?.url)) && (
            <p
              style={{
                margin: "18px 0 0",
                color: C.verde,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              {valor(viaje.origen)} → {valor(viaje.estadio.nombre)}
            </p>
          )}

          <div style={{ marginTop: 20 }}>
            <Plano
              imagen={viaje.estadio.ruta}
              alto={408}
              respaldo="Ruta del autobús"
            />
          </div>
        </div>
      </div>
    </Marco>
  );
}

function SlideHotel({ viaje }: { viaje: Desplazamiento }) {
  return (
    <Marco titulo="El hotel" viaje={viaje}>
      <BandaPartido viaje={viaje} />

      <div style={{ display: "flex", gap: 44, marginTop: 34 }}>
        <div style={{ width: 800, flex: "0 0 auto" }}>
          {hay(viaje.hotel.nombre) && (
          <p
            style={{
              margin: 0,
              color: C.navy,
              fontWeight: 700,
              lineHeight: 1,
              textTransform: "uppercase",
              ...enUnaLinea(valor(viaje.hotel.nombre), 52, 800),
            }}
          >
            {valor(viaje.hotel.nombre)}
          </p>
          )}

          <div style={{ marginTop: hay(viaje.hotel.nombre) ? 22 : 0 }}>
            <Renglon rotulo="Dirección" dato={valor(viaje.hotel.direccion)} />
            <Renglon rotulo="Teléfono" dato={valor(viaje.hotel.telefono)} />
            <Renglon rotulo="Entrada" dato={valor(viaje.hotel.entrada)} />
            <Renglon rotulo="Reserva" dato={valor(viaje.hotel.enlace)} />
          </div>

          <div style={{ marginTop: 26 }}>
            <Plano imagen={viaje.hotel.foto} alto={250} respaldo="Foto del hotel" />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 20 }}>
            <Cifra rotulo="Distancia" dato={valor(viaje.hotel.distancia)} />
            <Cifra rotulo="Tiempo" dato={valor(viaje.hotel.tiempo)} />
          </div>

          {hay(viaje.hotel.nombre) && hay(viaje.estadio.nombre) && (
            <p
              style={{
                margin: "18px 0 0",
                color: C.verde,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              {valor(viaje.hotel.nombre)} → {valor(viaje.estadio.nombre)}
            </p>
          )}

          <div style={{ marginTop: 20 }}>
            <Plano
              imagen={viaje.hotel.ruta}
              alto={408}
              respaldo="Ruta hotel · estadio"
            />
          </div>
        </div>
      </div>
    </Marco>
  );
}

/* ------------------------------------------------------------------ */
/*  EL VIAJE: LOS TRAYECTOS (11/11/2026)                               */
/* ------------------------------------------------------------------ */

type Tramo = {
  id: string;
  emoji: string;
  cuando: string;
  llegada: string;
  desde: string;
  hasta: string;
  duracion: string;
  foto?: ImagenViaje;
  claveHasta: string;
};

/** Cada salida del horario con su destino: de dónde, adónde, cuándo y cuánto. */
export function tramosDelViaje(viaje: Desplazamiento, lugares?: Record<string, ImagenViaje>): Tramo[] {
  const varios = viaje.dias.length > 1;

  return citasDelViaje(viaje)
    .filter(({ cita }) => esSalida(cita) && (cita.hasta || cita.desde))
    .map(({ dia, cita }) => {
      const desde = resuelveLugar(cita.desde, viaje, lugares);
      const hasta = resuelveLugar(cita.hasta, viaje, lugares);
      const dia1 = varios && dia.fecha ? `${diaCorto(dia.fecha)} · ` : "";

      return {
        id: cita.id,
        emoji: emojiDeCita(cita),
        cuando: `${dia1}${aHora(cita.minuto)}`,
        llegada: cita.duracion ? aHora(cita.minuto + cita.duracion) : "",
        desde: desde?.nombre ?? "",
        hasta: hasta?.nombre ?? "",
        duracion: comoDuracion(cita.duracion),
        ...(hasta?.foto?.url ? { foto: hasta.foto } : {}),
        claveHasta: cita.hasta ?? "",
      };
    })
    .slice(0, 6);
}

function SlideViaje({ viaje, tramos }: { viaje: Desplazamiento; tramos: Tramo[] }) {
  /* Una foto por destino distinto, como mucho dos: el hotel y el estadio. */
  const fotos = tramos
    .filter((tramo, i, todos) => tramo.foto?.url && todos.findIndex((otro) => otro.claveHasta === tramo.claveHasta) === i)
    .slice(0, 2);

  const alto = fotos.length > 1 ? 340 : 700;

  return (
    <Marco titulo="El viaje" viaje={viaje}>
      <BandaPartido viaje={viaje} />

      <div style={{ display: "flex", gap: 44, marginTop: 34 }}>
        <div style={{ width: fotos.length ? 900 : DOSSIER_W - MARGEN * 2, flex: "0 0 auto" }}>
          {tramos.map((tramo) => (
            <div
              key={tramo.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "16px 0",
                borderBottom: "1px solid rgba(15,30,61,.10)",
              }}
            >
              {tramo.emoji && (
                <span style={{ fontSize: 44, lineHeight: 1, width: 56, flex: "0 0 auto", textAlign: "center" }}>{tramo.emoji}</span>
              )}

              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    color: C.navy,
                    fontSize: 30,
                    fontWeight: 700,
                    lineHeight: 1.05,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {[tramo.desde, tramo.hasta].filter(Boolean).join(" → ")}
                </p>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: C.verde,
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  {[tramo.cuando, tramo.llegada ? `llegada ${tramo.llegada}` : ""].filter(Boolean).join(" · ")}
                </p>
              </div>

              {tramo.duracion && (
                <div style={{ flex: "0 0 auto", backgroundColor: C.navy, borderRadius: 14, padding: "12px 20px" }}>
                  <p style={{ margin: 0, color: "#FFFFFF", fontSize: 30, fontWeight: 700, lineHeight: 1, textTransform: "uppercase" }}>{tramo.duracion}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {fotos.length > 0 && (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
            {fotos.map((tramo) => (
              <Plano key={tramo.id} imagen={tramo.foto} alto={alto} respaldo={tramo.hasta} />
            ))}
          </div>
        )}
      </div>
    </Marco>
  );
}

/* ------------------------------------------------------------------ */
/*  EL DOSSIER                                                         */
/* ------------------------------------------------------------------ */

/** Qué diapositivas lleva el dossier, en orden. Lo usa la exportación. */
/** El hotel sólo se dibuja y se cuenta cuando hay algo que decir de él. */
export function llevaHotel(viaje: Desplazamiento) {
  if (!viaje.conHotel) return false;

  const h = viaje.hotel;

  return (
    [h.nombre, h.direccion, h.telefono, h.enlace, h.distancia, h.tiempo, h.entrada].some((t) => (t ?? "").trim()) ||
    Boolean(h.foto?.url) ||
    Boolean(h.ruta?.url)
  );
}

/*
| 11/11/2026 (petición del analista): como mucho tres diapositivas y SIN
| portada —el estadio, el hotel si lo hay y el viaje si hay trayectos—. La
| portada repetía la cabecera que ya lleva cada diapositiva.
*/
export function titulosDossier(viaje: Desplazamiento) {
  const titulos = ["El estadio"];

  if (llevaHotel(viaje)) titulos.push("El hotel");

  if (tramosDelViaje(viaje).length) titulos.push("El viaje");

  return titulos;
}

export function DossierViaje({ viaje, lugares }: { viaje: Desplazamiento; lugares?: Record<string, ImagenViaje> }) {
  const tramos = tramosDelViaje(viaje, lugares);

  return (
    <>
      <SlideEstadio viaje={viaje} />
      {llevaHotel(viaje) && <SlideHotel viaje={viaje} />}
      {tramos.length > 0 && <SlideViaje viaje={viaje} tramos={tramos} />}
    </>
  );
}
