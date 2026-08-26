/**
 * Desplazamientos que ya vienen rellenos.
 *
 * La jornada 1 contra el CD Teruel **no se escribe**: sale montada con lo que
 * decían los dos documentos originales, `public/AWAY_TERUEL.pptx` y
 * `public/HORARIO_CD_TERUEL.pdf`. Es el desplazamiento que el cuerpo técnico
 * ya había preparado a mano, así que abrir la página y encontrárselo entero
 * —planos incluidos— es a la vez la prueba de que el módulo hace su trabajo y
 * el ejemplo de hasta dónde se puede rellenar.
 *
 * **Todo lo que hay aquí está sacado de esos dos ficheros**, no inventado:
 *
 * - Los textos, de las tablas del pptx: "CAMPO PINILLA", "NATURAL", "103 X 65",
 *   "3 HORAS 30 MINUTOS", "Hotel Palacio la Marquesa", "7 MINUTOS" y el enlace
 *   de la reserva.
 * - Las cuatro imágenes, extraídas del propio pptx a `public/desplazamiento/`:
 *   el plano del estadio, la ruta desde Valdebebas, el hotel y la ruta del
 *   hotel al campo. La del hotel va **recortada a la fachada**: la captura
 *   original traía el buscador de Google, el botón "Ver fotos" y el precio por
 *   noche, que en una diapositiva del vestuario sólo estorban.
 * - Los kilómetros (365 y 1,9), leídos de esos mismos mapas, que los llevan
 *   escritos encima: el pptx sólo ponía los tiempos.
 * - El horario, del PDF renglón a renglón —incluida la llegada a la Ciudad
 *   Real Madrid a las 3:15 de la madrugada siguiente—. Ojo: **no lleva charla
 *   de partido ni salida hacia el estadio**, que sí traen las plantillas de
 *   `PLANTILLAS_HORARIO`. Se respeta lo que decía el papel.
 *
 * Lo que los originales **no** traían se queda vacío a propósito y se ve como
 * un guion en la diapositiva: la dirección y el teléfono del hotel no estaban
 * en ninguno de los dos documentos, y esta plataforma no se inventa una
 * dirección a la que va a viajar un autobús.
 *
 * La semilla sólo se usa cuando ese partido **todavía no tiene nada guardado**:
 * en cuanto alguien escribe, manda lo escrito.
 */

import {
  aMinutos,
  margenesDe,
  nuevoId,
  type CitaHorario,
  type Desplazamiento,
} from "./modelo";

/* ------------------------------------------------------------------ */
/*  UNA SEMILLA                                                        */
/* ------------------------------------------------------------------ */

type Semilla = {
  /** Si esta semilla es la de ese partido. */
  reconoce: (base: Desplazamiento) => boolean;
  /**
   * Rellena el documento.
   *
   * Recibe el desplazamiento que la página ya ha derivado del calendario y
   * **conserva su identidad** —qué partido es, su jornada, su fila de la hoja
   * RIVALES—: la semilla aporta el contenido, no el vínculo.
   */
  monta: (base: Desplazamiento) => Desplazamiento;
};

/** "10:30" → los minutos que guarda el modelo. `dia2` es la madrugada. */
function cita(
  hora: string,
  texto: string,
  tipo: CitaHorario["tipo"],
  extra: { nota?: string; dia2?: boolean } = {},
): CitaHorario {
  const minuto = (aMinutos(hora) ?? 0) + (extra.dia2 ? 1440 : 0);

  return {
    id: nuevoId("CI"),
    minuto,
    texto,
    tipo,
    ...(extra.nota ? { nota: extra.nota } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  JORNADA 1 · CD TERUEL                                              */
/* ------------------------------------------------------------------ */

const TERUEL: Semilla = {
  /*
  | Por fecha o por fila de la hoja, no por nombre: el calendario dice
  | "Teruel" y el pptx "CD TERUEL", y contra el mismo rival se juega ida y
  | vuelta. La del 31/08/2026 es la ida, que es la que está montada.
  */
  reconoce: (base) => base.fecha === "2026-08-31" || base.rivalId === "RIV-01",

  monta: (base) => {
    const citas = [
      cita("10:30", "Salida bus", "viaje", { nota: "Lavandería" }),
      cita("14:00", "Llegada hotel", "viaje"),
      cita("14:15", "Comida", "comida"),
      cita("14:45", "Descanso habitaciones", "descanso"),
      cita("17:45", "Merienda", "comida"),
      cita("19:45", "Llegada estadio", "viaje"),
      cita("20:45", "Calentamiento", "trabajo"),
      cita("21:15", "Partido CD Teruel", "partido"),
      cita("23:30", "Cena picnic", "comida", { nota: "ENTREGA" }),
      cita("03:15", "Llegada Ciudad Real Madrid", "viaje", { dia2: true }),
    ];

    return {
      ...base,
      rival: base.rival || "CD Teruel",
      fecha: "2026-08-31",
      hora: "21:15",
      condicion: "visitante",
      origen: "Valdebebas",
      conHotel: true,

      estadio: {
        nombre: "Campo Pinilla",
        ciudad: "Teruel",
        superficie: "Natural",
        dimensiones: "103 × 65",
        direccion: "Av. de Aragón · Teruel",
        distancia: "365 km",
        tiempo: "3 h 30",
        enlace: "",
        plano: {
          url: "/desplazamiento/teruel-estadio-plano.png",
          pie: "Campo Pinilla · acceso por Av. de Aragón",
        },
        ruta: {
          url: "/desplazamiento/teruel-estadio-ruta.png",
          pie: "Valdebebas · Teruel, 365 km",
        },
      },

      hotel: {
        nombre: "Hotel Palacio la Marquesa",
        /* Ni el pptx ni el PDF traían dirección ni teléfono del hotel. */
        direccion: "",
        telefono: "",
        enlace: "https://acesse.one/mr5dsia",
        distancia: "1,9 km",
        tiempo: "7 minutos",
        entrada: "Lunes 31 · 14:00",
        foto: {
          url: "/desplazamiento/teruel-hotel.png",
          pie: "Hotel Palacio la Marquesa · 4 estrellas, 4,4 sobre 5",
        },
        ruta: {
          url: "/desplazamiento/teruel-hotel-ruta.png",
          pie: "Hotel · Campo Pinilla, 7 minutos",
        },
      },

      horario: { citas, ...margenesDe(citas) },

      avisos: [],
    };
  },
};

const SEMILLAS: Semilla[] = [TERUEL];

/**
 * Rellena el desplazamiento si hay semilla para ese partido.
 *
 * Devuelve el mismo objeto cuando no la hay, así que quien llama puede usarlo
 * siempre sin preguntar.
 */
export function conSemilla(base: Desplazamiento): Desplazamiento {
  const semilla = SEMILLAS.find((item) => item.reconoce(base));

  return semilla ? semilla.monta(base) : base;
}

/** Si ese partido viene relleno de fábrica: la página lo dice en pantalla. */
export function tieneSemilla(base: Desplazamiento) {
  return SEMILLAS.some((item) => item.reconoce(base));
}
