"use client";

/**
 * El dossier de desplazamiento: las diapositivas del viaje.
 *
 * Es la versión viva de `public/AWAY_TERUEL.pptx`, que llevaba dos hojas —el
 * campo y el hotel— con una tabla de cabecera repetida y dos capturas de
 * Google Maps pegadas a mano. Aquí son tres: una portada que el original no
 * tenía, la del campo y la del hotel.
 *
 * Qué cambia respecto al original, y por qué:
 *
 * - **La cabecera del partido es una banda, no una tabla.** El pptx repetía
 *   una tabla de siete columnas con los rótulos en gris; a tamaño de
 *   proyección no se leía cuál era el dato y cuál el rótulo. Aquí el dato va
 *   grande y el rótulo pequeño encima, separados por filetes finos.
 * - **Los planos tienen pie.** Una captura de Google Maps sin rótulo no dice
 *   si es la ruta o el aparcamiento; ahora cada imagen lleva escrito lo que es.
 * - **Los huecos se ven.** Un dato sin rellenar sale como un guion sobre fondo
 *   crema en lugar de dejar la casilla en blanco, que es como se colaban los
 *   olvidos en el documento montado a mano.
 *
 * Todo el color va en estilos en línea: la captura (`html-to-image`)
 * serializa el estilo calculado y los colores `oklch` de Tailwind no
 * sobreviven al JPEG. El acabado es el de `public/INDIVIDUAL.pptx`.
 */

import type { ReactNode } from "react";

import {
  CLUB_VIAJE,
  COLORES_VIAJE as C,
  DOSSIER_H,
  DOSSIER_W,
  MARGEN_DOSSIER as MARGEN,
  diaLargo,
  type Desplazamiento,
  type ImagenViaje,
} from "@/lib/viaje/modelo";

/** Lo que se pinta donde falta un dato: el hueco se ve, no se disimula. */
const HUECO = "—";

const valor = (texto: string | undefined) => (texto?.trim() ? texto : HUECO);

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
function Casilla({
  rotulo,
  dato,
  ancho,
  destacado = false,
}: {
  rotulo: string;
  dato: string;
  ancho?: number;
  destacado?: boolean;
}) {
  return (
    <div style={{ minWidth: 0, width: ancho, flex: ancho ? "0 0 auto" : 1 }}>
      <Rotulo tamano={13}>{rotulo}</Rotulo>

      <p
        style={{
          margin: "10px 0 0",
          color: destacado ? C.rosaHondo : C.navy,
          fontSize: destacado ? 40 : 34,
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
  );
}

/**
 * La cabecera del partido, repetida en las tres diapositivas.
 *
 * Es la tabla del pptx original —equipo, rival, jornada, fecha, hora y
 * campo— rehecha: fondo crema, filetes verticales entre casillas y el rival
 * en rosa hondo, que es el dato que se busca al abrir el fichero.
 */
function BandaPartido({ viaje }: { viaje: Desplazamiento }) {
  const casa = viaje.condicion === "local";

  const casillas = [
    { rotulo: "Equipo", dato: "RMCF Castilla" },
    { rotulo: "Rival", dato: valor(viaje.rival), destacado: true },
    { rotulo: "Jornada", dato: valor(viaje.jornada) },
    { rotulo: "Fecha", dato: valor(diaLargo(viaje.fecha) || viaje.fecha) },
    { rotulo: "Hora", dato: valor(viaje.hora) },
    { rotulo: casa ? "En casa" : "Fuera", dato: valor(viaje.estadio.nombre) },
  ];

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
            flex: casilla.destacado ? 1.4 : 1,
            paddingLeft: indice === 0 ? 0 : 28,
            paddingRight: 28,
            borderRight:
              indice === casillas.length - 1
                ? "none"
                : `1px solid ${C.rosa}`,
          }}
        >
          <Casilla
            rotulo={casilla.rotulo}
            dato={casilla.dato}
            destacado={casilla.destacado}
          />
        </div>
      ))}
    </div>
  );
}

/** Una fila de ficha: rótulo a la izquierda, dato a la derecha. */
function Renglon({ rotulo, dato }: { rotulo: string; dato: string }) {
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
            src={imagen.url}
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
            {valor(viaje.competicion) === HUECO
              ? "Desplazamiento de partido"
              : viaje.competicion}
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
          {valor(viaje.rival)} · {valor(diaLargo(viaje.fecha) || viaje.fecha)}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LAS DIAPOSITIVAS                                                   */
/* ------------------------------------------------------------------ */

function Portada({ viaje }: { viaje: Desplazamiento }) {
  const fuera = viaje.condicion === "visitante";

  return (
    <Marco titulo="Portada" viaje={viaje}>
      <div style={{ display: "flex", gap: 44, height: "100%" }}>
        <div
          style={{
            width: 920,
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Rotulo tamano={19}>
            {fuera ? "Desplazamiento" : "Partido en casa"}
          </Rotulo>

          <p
            style={{
              margin: "22px 0 0",
              color: C.navy,
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 0.92,
              letterSpacing: "0.005em",
              textTransform: "uppercase",
            }}
          >
            {valor(viaje.rival)}
          </p>

          <p
            style={{
              margin: "18px 0 0",
              color: C.rosaHondo,
              fontSize: 40,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {valor(viaje.estadio.nombre)}
            {viaje.estadio.ciudad.trim() ? ` · ${viaje.estadio.ciudad}` : ""}
          </p>

          <div style={{ marginTop: 34 }}>
            <Renglon rotulo="Jornada" dato={valor(viaje.jornada)} />
            <Renglon
              rotulo="Fecha"
              dato={valor(diaLargo(viaje.fecha) || viaje.fecha)}
            />
            <Renglon rotulo="Hora" dato={valor(viaje.hora)} />
            <Renglon
              rotulo="Sale de"
              dato={fuera ? valor(viaje.origen) : "No hay viaje"}
            />
          </div>

          <div style={{ marginTop: "auto", display: "flex", gap: 20 }}>
            <Cifra rotulo="Distancia" dato={valor(viaje.estadio.distancia)} />
            <Cifra rotulo="Tiempo de viaje" dato={valor(viaje.estadio.tiempo)} />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Plano
            imagen={viaje.estadio.ruta}
            alto={725}
            respaldo="Ruta hasta el estadio"
          />
        </div>
      </div>
    </Marco>
  );
}

function SlideEstadio({ viaje }: { viaje: Desplazamiento }) {
  return (
    <Marco titulo="El estadio" viaje={viaje}>
      <BandaPartido viaje={viaje} />

      <div style={{ display: "flex", gap: 44, marginTop: 34 }}>
        <div style={{ width: 800, flex: "0 0 auto" }}>
          <p
            style={{
              margin: 0,
              color: C.navy,
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            {valor(viaje.estadio.nombre)}
          </p>

          <div style={{ marginTop: 22 }}>
            <Renglon rotulo="Superficie" dato={valor(viaje.estadio.superficie)} />
            <Renglon rotulo="Dimensiones" dato={valor(viaje.estadio.dimensiones)} />
            <Renglon rotulo="Ciudad" dato={valor(viaje.estadio.ciudad)} />
            <Renglon rotulo="Dirección" dato={valor(viaje.estadio.direccion)} />
          </div>

          <div style={{ marginTop: 26 }}>
            <Plano
              imagen={viaje.estadio.plano}
              alto={250}
              respaldo="Plano del estadio"
            />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 20 }}>
            <Cifra rotulo="Distancia" dato={valor(viaje.estadio.distancia)} />
            <Cifra rotulo="Tiempo" dato={valor(viaje.estadio.tiempo)} />
          </div>

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
          <p
            style={{
              margin: 0,
              color: C.navy,
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            {valor(viaje.hotel.nombre)}
          </p>

          <div style={{ marginTop: 22 }}>
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
/*  EL DOSSIER                                                         */
/* ------------------------------------------------------------------ */

/** Qué diapositivas lleva el dossier, en orden. Lo usa la exportación. */
export function titulosDossier(viaje: Desplazamiento) {
  const titulos = ["Portada", "El estadio"];

  if (viaje.conHotel) titulos.push("El hotel");

  return titulos;
}

export function DossierViaje({ viaje }: { viaje: Desplazamiento }) {
  return (
    <>
      <Portada viaje={viaje} />
      <SlideEstadio viaje={viaje} />
      {viaje.conHotel && <SlideHotel viaje={viaje} />}
    </>
  );
}
