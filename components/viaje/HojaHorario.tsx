"use client";

/**
 * El horario del día de partido: una hoja A4 para imprimir y colgar.
 *
 * Es la versión viva de `public/HORARIO_CD_TERUEL.pdf`, que era una columna de
 * medias horas de las 8:00 a la madrugada con cada cita escrita al lado, en
 * gris y a cuerpo 10. Se conserva lo que funcionaba —la columna de horas, que
 * es lo que deja ver de un vistazo cuánto falta— y se arregla lo que no:
 *
 * - **La hora de la cita se lee, la del renglón se intuye.** En el original
 *   las dos iban del mismo tamaño y en el mismo gris, así que había que leer
 *   dos veces para saber a qué hora era la comida. Aquí el renglón es una
 *   línea fina con su hora en claro y la cita una etiqueta con la suya en
 *   negro.
 * - **Cada cita dice de qué va.** Viaje, comida, descanso, trabajo y partido
 *   llevan color, y el partido va en rosa, que es la única línea que se busca
 *   con la vista.
 * - **La madrugada se marca.** "03:15 Llegada" en la fila de las 0:00 no decía
 *   que era del día siguiente; ahora lo lleva escrito.
 * - **Las citas que se pisan bajan lo justo** en vez de solaparse, con una
 *   guía hasta su renglón para no perder la referencia.
 *
 * Se dibuja en 1240×1754 —A4 vertical a 150 ppp— y el PDF la lleva a sangre.
 * Todo el color va en estilos en línea: la captura serializa el estilo
 * calculado y los `oklch` de Tailwind no sobreviven.
 */

import {
  CLUB_VIAJE,
  COLORES_VIAJE as C,
  HOJA_H,
  HOJA_W,
  MARGEN_HOJA as MARGEN,
  TIPO_CITA,
  aHora,
  diaCorto,
  diaLargo,
  diaSiguienteCorto,
  ejeHorario,
  esDiaSiguiente,
  type Desplazamiento,
} from "@/lib/viaje/modelo";

/** Dónde arranca y acaba la columna de horas dentro de la hoja. */
const COLUMNA_Y = 470;
const COLUMNA_ALTO = 1120;

/** Ancho de la banda de horas de la izquierda. */
const HORAS_W = 132;

/** Alto de una etiqueta de cita. Manda en el reparto anti-solape. */
const CITA_ALTO = 62;

export function HojaHorario({ viaje }: { viaje: Desplazamiento }) {
  const { desde, hasta, citas } = viaje.horario;

  const { citas: colocadas, marcas } = ejeHorario(citas, {
    desde,
    hasta,
    alto: COLUMNA_ALTO,
    separacion: CITA_ALTO + 10,
    separacionMarcas: 26,
  });

  const avisos = viaje.avisos.filter((aviso) => aviso.trim());

  return (
    <div
      data-viaje-hoja
      style={{
        position: "relative",
        width: HOJA_W,
        height: HOJA_H,
        backgroundColor: C.papel,
        overflow: "hidden",
        fontFamily: "var(--fuente-viaje, inherit)",
        /* Aire entre lienzos en la vista previa. La captura pone el margen a
           cero, así que no llega al documento. */
        marginBottom: 26,
      }}
    >
      {/* Esquina rosa: el sello de la plantilla. */}
      <div
        style={{
          position: "absolute",
          left: -18,
          top: -18,
          width: 36,
          height: 36,
          backgroundColor: C.rosaHondo,
          transform: "rotate(45deg)",
        }}
      />

      {/* ------------------------- CABECERA ------------------------- */}

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: 62,
          right: MARGEN,
          height: 84,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          draggable={false}
          style={{ height: 76, width: "auto", display: "block" }}
        />

        <p
          style={{
            margin: 0,
            flex: 1,
            minWidth: 0,
            color: C.verde,
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          {CLUB_VIAJE}
        </p>

        <div
          style={{
            backgroundColor: C.navy,
            borderRadius: 999,
            padding: "11px 24px",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#FFFFFF",
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Horario de partido
          </p>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: 172,
          width: HOJA_W - MARGEN * 2,
          height: 4,
          backgroundColor: C.rosa,
        }}
      />

      {/* -------------------------- TÍTULO -------------------------- */}

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: 206,
          width: HOJA_W - MARGEN * 2,
        }}
      >
        <p
          style={{
            margin: 0,
            color: C.navy,
            fontSize: 74,
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: "0.005em",
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Horario {viaje.rival || "de partido"}
        </p>

        <p
          style={{
            margin: "14px 0 0",
            color: C.rosaHondo,
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {diaLargo(viaje.fecha) || viaje.fecha}
        </p>

        {/* Los tres datos que se comprueban al coger la hoja. */}
        <div style={{ display: "flex", gap: 14, marginTop: 22 }}>
          {[
            { rotulo: "Jornada", dato: viaje.jornada || "—" },
            { rotulo: "Hora", dato: viaje.hora || "—" },
            {
              rotulo: viaje.condicion === "local" ? "En casa" : "Fuera",
              dato: viaje.estadio.nombre || "—",
            },
          ].map((dato) => (
            <div
              key={dato.rotulo}
              style={{
                flex: 1,
                minWidth: 0,
                backgroundColor: C.crema,
                border: `1px solid ${C.rosa}`,
                borderRadius: 12,
                padding: "12px 18px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: C.verde,
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                }}
              >
                {dato.rotulo}
              </p>

              <p
                style={{
                  margin: "9px 0 0",
                  color: C.navy,
                  fontSize: 26,
                  fontWeight: 700,
                  lineHeight: 1,
                  textTransform: "uppercase",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {dato.dato}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------- COLUMNA -------------------------- */}

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: COLUMNA_Y,
          width: HOJA_W - MARGEN * 2,
          height: COLUMNA_ALTO,
        }}
      >
        {/* Las horas: raya fina de lado a lado con su rótulo al margen. */}
        {marcas.map((marca) => {
          const enPunto = marca.enPunto;

          return (
            <div
              key={marca.minuto}
              style={{
                position: "absolute",
                left: 0,
                top: marca.y,
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <p
                style={{
                  margin: 0,
                  width: HORAS_W - 14,
                  textAlign: "right",
                  color: enPunto ? C.navy : "rgba(15,30,61,.34)",
                  fontSize: enPunto ? 20 : 17,
                  fontWeight: enPunto ? 700 : 600,
                  lineHeight: 1,
                  letterSpacing: "0.04em",
                }}
              >
                {aHora(marca.minuto)}
              </p>

              <div
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: enPunto ? "rgba(15,30,61,.20)" : C.humo,
                }}
              />
            </div>
          );
        })}

        {/* Las citas, cada una a su hora. */}
        {colocadas.map((cita) => {
          const tono = TIPO_CITA[cita.tipo] ?? TIPO_CITA.otro;

          const partido = cita.tipo === "partido";

          return (
            <div key={cita.id}>
              {/* Filete hasta la columna de horas: ata la etiqueta a su eje. */}
              <div
                style={{
                  position: "absolute",
                  left: HORAS_W,
                  top: cita.y,
                  width: 26,
                  height: 2,
                  backgroundColor: tono.color,
                }}
              />

              <div
                style={{
                  position: "absolute",
                  left: HORAS_W + 26,
                  top: cita.y - CITA_ALTO / 2,
                  right: 0,
                  height: CITA_ALTO,
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  backgroundColor: partido ? C.rosa : C.crema,
                  borderLeft: `7px solid ${tono.color}`,
                  borderTop: partido ? `1px solid ${C.rosaHondo}` : "none",
                  borderRight: partido ? `1px solid ${C.rosaHondo}` : "none",
                  borderBottom: partido ? `1px solid ${C.rosaHondo}` : "none",
                  borderRadius: 10,
                  padding: "0 20px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    width: 96,
                    flex: "0 0 auto",
                    color: C.navy,
                    fontSize: 30,
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: "0.02em",
                  }}
                >
                  {aHora(cita.minuto)}
                </p>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      color: C.navy,
                      fontSize: partido ? 30 : 26,
                      fontWeight: 700,
                      lineHeight: 1.05,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cita.texto}
                  </p>

                  {cita.nota?.trim() && (
                    <p
                      style={{
                        margin: "5px 0 0",
                        color: "rgba(15,30,61,.55)",
                        fontSize: 17,
                        fontWeight: 600,
                        lineHeight: 1,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cita.nota}
                    </p>
                  )}
                </div>

                {esDiaSiguiente(cita.minuto) && (
                  <p
                    style={{
                      margin: 0,
                      flex: "0 0 auto",
                      color: "#FFFFFF",
                      backgroundColor: tono.color,
                      borderRadius: 999,
                      padding: "6px 14px",
                      fontSize: 14,
                      fontWeight: 700,
                      lineHeight: 1,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                    }}
                  >
                    {diaSiguienteCorto(viaje.fecha)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* -------------------------- AVISOS -------------------------- */}

      {avisos.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: MARGEN,
            top: COLUMNA_Y + COLUMNA_ALTO + 34,
            width: HOJA_W - MARGEN * 2,
            backgroundColor: C.crema,
            borderLeft: `6px solid ${C.rosaHondo}`,
            borderRadius: 12,
            padding: "16px 22px",
          }}
        >
          <p
            style={{
              margin: 0,
              color: C.verde,
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
            }}
          >
            No olvidar
          </p>

          <p
            style={{
              margin: "12px 0 0",
              color: C.navy,
              fontSize: 22,
              fontWeight: 600,
              lineHeight: 1.35,
            }}
          >
            {avisos.join("  ·  ")}
          </p>
        </div>
      )}

      {/* --------------------------- PIE ---------------------------- */}

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: HOJA_H - 92,
          width: HOJA_W - MARGEN * 2,
          height: 3,
          backgroundColor: C.rosa,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: MARGEN,
          top: HOJA_H - 72,
          width: HOJA_W - MARGEN * 2,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <p
          style={{
            margin: 0,
            color: C.verde,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          RMCF Castilla · Horario de partido
        </p>

        <p
          style={{
            margin: 0,
            color: "rgba(15,30,61,.45)",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          {diaCorto(viaje.fecha)}
        </p>
      </div>
    </div>
  );
}
