"use client";

/**
 * Las diapositivas de un documento de cultura.
 *
 * Es el dibujo de `public/INDIVIDUAL.pptx` puesto al servicio de otro
 * contenido: papel blanco, Barlow Condensed, verde y navy de tinta, el filo
 * rosa que cierra la cabecera y el pie firmado. El mismo marco que llevan la
 * portada del jugador rival y el dossier de desplazamiento, para que los
 * documentos del club se reconozcan como de la misma casa.
 *
 * Qué cambia respecto al HTML del que sale este primer documento
 * (`public/01. RMCF - CASTILLA VALORES.html`), y por qué:
 *
 * - **La diapositiva mide 1920×1080 y no 1280×720.** La original se imprimía
 *   con `window.print()`, así que salía a la medida de la ventana; ésta es la
 *   diapositiva de PowerPoint exacta, y por eso el mismo dibujo vale para
 *   proyectar, para el `.pptx` y para el PDF.
 * - **«INADMISIBLE» es una chapa, no el principio del párrafo.** En una sala,
 *   lo que avisa tiene que verse antes de leer.
 * - **Lo que suma y lo que resta se distinguen por color, no por posición.**
 *   Verde y granate, siempre en el mismo sitio de la tarjeta.
 * - **Los antivalores suben al titular con sus votos.** El equipo votó 22 veces
 *   «egoísmo»: ese número es el argumento del documento, no una nota al pie.
 *
 * Todo el color va en estilos en línea. `html-to-image` serializa el estilo
 * calculado y los colores `oklch` de Tailwind no sobreviven al JPEG.
 */

import type { CSSProperties, ReactNode } from "react";

import {
  CLUB_CULTURA,
  COLORES_CULTURA as C,
  MARGEN_CULTURA as MARGEN,
  SLIDE_H,
  SLIDE_W,
  partesRicas,
  type BloqueConducta,
  type DiapositivaCultura,
  type DocumentoCultura,
  type Valor,
} from "@/lib/cultura/modelo";

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

/** Rótulo pequeño con mucho espaciado: la voz de la plantilla. */
function Rotulo({
  children,
  color = C.verde,
  tamano = 18,
  espaciado = "0.3em",
  estilo,
}: {
  children: ReactNode;
  color?: string;
  tamano?: number;
  espaciado?: string;
  estilo?: CSSProperties;
}) {
  return (
    <p
      style={{
        margin: 0,
        color,
        fontSize: tamano,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: espaciado,
        textTransform: "uppercase",
        ...estilo,
      }}
    >
      {children}
    </p>
  );
}

/**
 * Un texto con sus `**negritas**` puestas.
 *
 * Las frases marcadas van en verde y en el peso alto: son las que se quieren
 * repetir en la charla, y en una diapositiva leída de lejos el color hace más
 * que el grosor.
 */
function TextoRico({
  texto,
  color = C.tinta,
  fuerte = C.verde,
}: {
  texto: string;
  color?: string;
  fuerte?: string;
}) {
  return (
    <>
      {partesRicas(texto).map((parte, indice) => (
        <span
          key={indice}
          style={{
            color: parte.fuerte ? fuerte : color,
            fontWeight: parte.fuerte ? 700 : 500,
          }}
        >
          {parte.texto}
        </span>
      ))}
    </>
  );
}

/** Una chapa maciza: color entero y texto en papel, como las del pie. */
function Chapa({
  children,
  fondo,
  tinta = C.papel,
  tamano = 19,
}: {
  children: ReactNode;
  fondo: string;
  tinta?: string;
  tamano?: number;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: fondo,
        color: tinta,
        borderRadius: 999,
        padding: "9px 22px 11px",
        fontSize: tamano,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/**
 * El bloque geométrico de la derecha en las portadas de valor.
 *
 * Son las dos franjas inclinadas del HTML original —la única seña de identidad
 * propia que tenía—, repintadas con los colores de la plantilla: la azul pasa
 * a ser el navy del club y la dorada, el rosa de la casa.
 */
function Franjas({ ancho, numero }: { ancho: number; numero?: number }) {
  return (
    <div
      style={{
        position: "relative",
        width: ancho,
        flex: "0 0 auto",
        alignSelf: "stretch",
        backgroundColor: C.crema,
        overflow: "hidden",
        borderRadius: 20,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-25%",
          right: 168,
          width: 150,
          height: "150%",
          background: `linear-gradient(180deg, ${C.navy} 0%, #1D3A6B 100%)`,
          transform: "rotate(20deg)",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: "-25%",
          right: 44,
          width: 108,
          height: "150%",
          background: `linear-gradient(180deg, ${C.rosa} 0%, ${C.rosaHondo} 100%)`,
          transform: "rotate(20deg)",
          boxShadow: "-10px 0 30px rgba(11,20,32,.18)",
        }}
      />

      {numero !== undefined && (
        <p
          style={{
            /* Arriba a la izquierda: las franjas van inclinadas hacia la
               derecha, así que ése es el único rincón que dejan libre. */
            position: "absolute",
            left: 30,
            top: 10,
            margin: 0,
            color: "rgba(15,30,61,.13)",
            fontSize: 190,
            fontWeight: 700,
            lineHeight: 0.8,
            letterSpacing: "-0.02em",
          }}
        >
          {String(numero).padStart(2, "0")}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EL MARCO                                                           */
/* ------------------------------------------------------------------ */

/**
 * Papel, cabecera con escudo, filo rosa y pie firmado.
 *
 * La cabecera lleva siempre el documento —no la diapositiva—, porque estas
 * hojas circulan sueltas por el grupo del vestuario y una diapositiva sin
 * contexto no dice de qué documento se escapó.
 */
function Marco({
  documento,
  rotulo,
  children,
}: {
  documento: DocumentoCultura;
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div
      data-cultura-slide
      style={{
        position: "relative",
        width: SLIDE_W,
        height: SLIDE_H,
        backgroundColor: C.papel,
        overflow: "hidden",
        fontFamily: "var(--fuente-cultura, inherit)",
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
          <Rotulo tamano={26} espaciado="0.22em">
            {CLUB_CULTURA}
          </Rotulo>

          <Rotulo
            tamano={18}
            color="rgba(15,30,61,.5)"
            estilo={{ marginTop: 12, fontWeight: 600 }}
          >
            Identidad y cultura · Documento {documento.numero}
          </Rotulo>
        </div>

        <div
          style={{
            flex: "0 0 auto",
            backgroundColor: C.navy,
            borderRadius: 999,
            padding: "14px 30px",
          }}
        >
          <Rotulo tamano={24} color={C.papel} espaciado="0.14em">
            {rotulo}
          </Rotulo>
        </div>
      </div>

      {/* Filo rosa: cierra la cabecera, como en la plantilla. */}
      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: 188,
          width: SLIDE_W - MARGEN * 2,
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
          width: SLIDE_W - MARGEN * 2,
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
          width: SLIDE_W - MARGEN * 2,
          height: 3,
          backgroundColor: C.rosa,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: 1028,
          width: SLIDE_W - MARGEN * 2,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Rotulo tamano={18} espaciado="0.34em" estilo={{ fontWeight: 600 }}>
          RMCF Castilla · {documento.titulo}
        </Rotulo>

        <Rotulo
          tamano={18}
          color="rgba(15,30,61,.45)"
          espaciado="0.22em"
          estilo={{ fontWeight: 600 }}
        >
          Temporada {documento.temporada}
        </Rotulo>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LAS DIAPOSITIVAS                                                   */
/* ------------------------------------------------------------------ */

/** La portada del documento: de qué va y qué se va a leer. */
function Portada({
  documento,
  hoja,
}: {
  documento: DocumentoCultura;
  hoja: Extract<DiapositivaCultura, { tipo: "portada" }>;
}) {
  return (
    <Marco documento={documento} rotulo="Portada">
      <div style={{ display: "flex", gap: 52, height: "100%" }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            /* Centrado: el índice de la derecha ocupa la altura entera y un
               titular pegado arriba dejaba un agujero en medio de la hoja. */
            justifyContent: "center",
          }}
        >
          <Rotulo tamano={20}>{hoja.subtitulo}</Rotulo>

          <p
            style={{
              margin: "26px 0 0",
              color: C.navy,
              fontSize: 116,
              fontWeight: 700,
              lineHeight: 0.9,
              textTransform: "uppercase",
            }}
          >
            {hoja.titulo}
          </p>

          <p
            style={{
              margin: "20px 0 0",
              color: C.rosaHondo,
              fontSize: 38,
              fontWeight: 700,
              lineHeight: 1.1,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {documento.subtitulo}
          </p>

          <div
            style={{
              marginTop: 46,
              backgroundColor: C.crema,
              borderLeft: `7px solid ${C.rosa}`,
              borderRadius: "0 18px 18px 0",
              padding: "30px 36px 32px",
            }}
          >
            <p style={{ margin: 0, fontSize: 30, lineHeight: 1.5 }}>
              <TextoRico texto={hoja.entradilla} />
            </p>
          </div>
        </div>

        {/* El índice: los cinco valores y lo que votó cada uno. */}
        <div
          style={{
            width: 600,
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Rotulo tamano={18} color={C.rosaHondo}>
            Lo que se vota, lo que se ve
          </Rotulo>

          <div
            style={{
              marginTop: 22,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {hoja.indice.map((entrada) => (
              <div
                key={entrada.numero}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  backgroundColor: C.crema,
                  borderRadius: 16,
                  padding: "0 26px",
                }}
              >
                <span
                  style={{
                    color: C.rosaHondo,
                    fontSize: 54,
                    fontWeight: 700,
                    lineHeight: 1,
                    width: 64,
                    flex: "0 0 auto",
                  }}
                >
                  {String(entrada.numero).padStart(2, "0")}
                </span>

                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      color: C.navy,
                      fontSize: 34,
                      fontWeight: 700,
                      lineHeight: 1.05,
                      textTransform: "uppercase",
                    }}
                  >
                    {entrada.titulo}
                  </span>

                  <span
                    style={{
                      display: "block",
                      marginTop: 6,
                      color: C.verde,
                      fontSize: 17,
                      fontWeight: 600,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {entrada.votos}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Marco>
  );
}

/** La portada de un valor: el nombre grande y qué significa aquí. */
function PortadaValor({
  documento,
  valor,
}: {
  documento: DocumentoCultura;
  valor: Valor;
}) {
  return (
    <Marco documento={documento} rotulo={`Valor ${valor.numero}`}>
      <div style={{ display: "flex", gap: 52, height: "100%" }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            /* Centrado contra el bloque de franjas, que ocupa la altura
               entera: el titular pegado arriba dejaba la hoja coja. */
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Rotulo tamano={20} color={C.rosaHondo}>
              Valor n.º {valor.numero}
            </Rotulo>

            <span
              style={{
                width: 42,
                height: 3,
                backgroundColor: C.rosa,
                display: "block",
              }}
            />

            <Rotulo tamano={18} espaciado="0.2em">
              {valor.votos}
            </Rotulo>
          </div>

          <p
            style={{
              margin: "28px 0 0",
              color: C.navy,
              fontSize: valor.titulo.length > 14 ? 104 : 132,
              fontWeight: 700,
              lineHeight: 0.9,
              textTransform: "uppercase",
            }}
          >
            {valor.titulo}
          </p>

          <p
            style={{
              margin: "24px 0 0",
              color: C.granate,
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1.2,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Frente a · {valor.antivalores}
          </p>

          <div
            style={{
              marginTop: 54,
              backgroundColor: C.crema,
              borderLeft: `7px solid ${C.rosa}`,
              borderRadius: "0 18px 18px 0",
              padding: "32px 40px 34px",
            }}
          >
            <p style={{ margin: 0, fontSize: 31, lineHeight: 1.5 }}>
              <TextoRico texto={valor.explicacion} />
            </p>
          </div>
        </div>

        <Franjas ancho={430} numero={valor.numero} />
      </div>
    </Marco>
  );
}

/** Una tarjeta de conductas: un ámbito, lo que suma y lo que es inadmisible. */
function TarjetaConductas({ bloque }: { bloque: BloqueConducta }) {
  const filo = bloque.ambito === "campo" ? C.navy : C.verde;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.papel,
        border: "1px solid #E6E2D6",
        borderTop: `9px solid ${filo}`,
        borderRadius: "8px 8px 18px 18px",
        padding: "28px 32px 32px",
      }}
    >
      <p
        style={{
          margin: 0,
          color: C.navy,
          fontSize: 34,
          fontWeight: 700,
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        {bloque.titulo}
      </p>

      <Rotulo tamano={17} estilo={{ marginTop: 12, fontWeight: 600 }}>
        {bloque.matiz}
      </Rotulo>

      {/* ------------------------- LO QUE SUMA ------------------------ */}

      <div
        style={{
          marginTop: 28,
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Chapa fondo={C.verde}>+ Lo que suma</Chapa>

          <span
            style={{
              minWidth: 0,
              color: C.verde,
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {bloque.suma.rotulo}
          </span>
        </div>

        <div
          style={{
            marginTop: 14,
            flex: 1,
            backgroundColor: C.crema,
            borderLeft: `6px solid ${C.verde}`,
            borderRadius: "0 12px 12px 0",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: C.tinta,
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.45,
            }}
          >
            {bloque.suma.texto}
          </p>
        </div>
      </div>

      {/* ------------------------ LO QUE RESTA ------------------------ */}

      <div
        style={{
          marginTop: 24,
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Chapa fondo={C.granate}>− Inadmisible</Chapa>

          <span
            style={{
              minWidth: 0,
              color: C.granate,
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {bloque.resta.rotulo}
          </span>
        </div>

        <div
          style={{
            marginTop: 14,
            flex: 1,
            backgroundColor: C.granatePapel,
            borderLeft: `6px solid ${C.granate}`,
            borderRadius: "0 12px 12px 0",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: C.granate,
              fontSize: 26,
              fontWeight: 600,
              lineHeight: 1.45,
            }}
          >
            {bloque.resta.texto}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Las conductas de un valor: dentro y fuera del campo, una al lado de otra. */
function Conductas({
  documento,
  valor,
}: {
  documento: DocumentoCultura;
  valor: Valor;
}) {
  return (
    <Marco
      documento={documento}
      rotulo={`Valor ${valor.numero} · Conductas`}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: C.navy,
              fontSize: 46,
              fontWeight: 700,
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            {valor.titulo}
          </span>

          <span
            style={{
              color: C.rosaHondo,
              fontSize: 30,
              fontWeight: 600,
              lineHeight: 1,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}
          >
            frente a
          </span>

          <span
            style={{
              color: C.granate,
              fontSize: 46,
              fontWeight: 700,
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            {valor.antivalores}
          </span>
        </div>

        <Rotulo
          tamano={17}
          color="rgba(15,30,61,.5)"
          estilo={{ marginTop: 14, fontWeight: 600 }}
        >
          Cultura y conductas observables
        </Rotulo>

        <div style={{ marginTop: 26, flex: 1, display: "flex", gap: 36 }}>
          {valor.bloques.map((bloque) => (
            <TarjetaConductas key={bloque.ambito} bloque={bloque} />
          ))}
        </div>
      </div>
    </Marco>
  );
}

/* ------------------------------------------------------------------ */
/*  EL DOCUMENTO                                                       */
/* ------------------------------------------------------------------ */

export function HojaCultura({
  documento,
  hoja,
}: {
  documento: DocumentoCultura;
  hoja: DiapositivaCultura;
}) {
  if (hoja.tipo === "portada") {
    return <Portada documento={documento} hoja={hoja} />;
  }

  if (hoja.tipo === "valor") {
    return <PortadaValor documento={documento} valor={hoja.valor} />;
  }

  return <Conductas documento={documento} valor={hoja.valor} />;
}

/** El documento entero, una diapositiva detrás de otra. */
export function DocumentoLienzos({
  documento,
}: {
  documento: DocumentoCultura;
}) {
  return (
    <>
      {documento.diapositivas.map((hoja, indice) => (
        <HojaCultura key={indice} documento={documento} hoja={hoja} />
      ))}
    </>
  );
}
