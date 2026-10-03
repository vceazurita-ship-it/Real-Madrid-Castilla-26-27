/**
 * LA ESTRUCTURA DEL ANÁLISIS COLECTIVO DEL RIVAL: fases, bloques y campos.
 *
 * Vivía dentro de `app/scout-rival-collective/page.tsx`. Sale aquí (03/10/2026)
 * para que el informe del partido escriba cada campo con el mismo título que
 * la pantalla. Añadir un campo sigue siendo añadir una línea.
 */

export type FieldDef = {
  titulo: string;
  campo: string;
  ayuda?: string;
  ancho?: boolean;
  rows?: number;
  /**
   * El campo **no tiene columna** en la hoja RIVALES y se guarda en Supabase.
   *
   * La hoja escribe por nombre de columna y descarta en silencio lo que no
   * tenga cabecera: mandar ahí un campo nuevo es perderlo. Las columnas sólo
   * las puede añadir quien es dueño de la hoja, así que mientras tanto el
   * bloque se guarda aparte y en la pantalla no se nota.
   */
  remoto?: boolean;
};

export type BlockDef = {
  titulo: string;
  campos: FieldDef[];
};

export type SectionDef = {
  id: string;
  titulo: string;
  subtitulo: string;
  accent: string;
  bloques: BlockDef[];
};

/* Toda la estructura del informe vive aquí: añadir un campo es añadir una
   línea, y la maquetación (rejillas, cabeceras, ayudas de edición) se deriva
   automáticamente. */
export const SECTIONS: SectionDef[] = [
  {
    id: "ofensivo",
    titulo: "Fase ofensiva",
    subtitulo: "Cómo construye y ataca el rival",
    accent: "#E2483D",
    bloques: [
      {
        titulo: "Reinicios ofensivos",
        campos: [
          {
            titulo: "Situaciones en rombo",
            campo: "OF_REINICIO_ROMBO",
            ayuda: "Situaciones en rombo",
          },
          {
            titulo: "Referencia partido ida",
            campo: "OF_REINICIO_REFERENCIA_PARTIDO",
            ayuda: "Referencia partido ida",
          },
          {
            titulo: "Referencias determinantes",
            campo: "OF_REINICIO_REFERENCIAS",
            ayuda: "Referencias determinantes",
          },
          {
            titulo: "Equipo presionante",
            campo: "OF_REINICIO_EQUIPO_PRESIONANTE",
            ayuda: "Equipo presionante",
          },
          {
            titulo: "Contextualización",
            campo: "OF_REINICIO_CONTEXTO",
            ayuda: "Contextualización",
          },
          {
            titulo: "Cerrado",
            campo: "OF_REINICIO_CERRADO",
            ayuda: "Cerrado",
          },
        ],
      },
      {
        titulo: "Inicios · Progresión",
        campos: [
          {
            titulo: "Estructura",
            campo: "OF_INICIO_ESTRUCTURA",
            ayuda: "Estructura",
          },
          {
            titulo: "Central con mayor y menor capacidad",
            campo: "OF_INICIO_CENTRAL_CAPACIDAD",
            ayuda: "Central con mayor y menor capacidad",
          },
          {
            titulo: "Capacidad para jugar al espacio",
            campo: "OF_INICIO_JUGAR_ESPACIO",
            ayuda: "Capacidad para jugar al espacio",
          },
          {
            titulo: "Jugador débil por dentro",
            campo: "OF_INICIO_JUGADOR_DEBIL_DENTRO",
            ayuda: "Jugador débil por dentro",
          },
          {
            titulo: "Capacidad para asociarse por dentro",
            campo: "OF_INICIO_ASOCIACIONES",
            ayuda: "Capacidad para asociarse por dentro",
            ancho: true,
          },
        ],
      },
      {
        titulo: "Campo contrario",
        campos: [
          {
            titulo: "Estructura general",
            campo: "OF_CAMPO_ESTRUCTURA",
            ayuda: "Estructura general",
          },
          {
            titulo: "Carril exterior",
            campo: "OF_CAMPO_CARRIL_EXTERIOR",
            ayuda: "Carril exterior",
          },
          {
            titulo: "Jugadores por dentro",
            campo: "OF_CAMPO_JUGADORES_DENTRO",
            ayuda: "Jugadores por dentro",
            ancho: true,
          },
        ],
      },
      {
        titulo: "Finalización · Área rival",
        campos: [
          {
            titulo: "Jugadores que atacan el área",
            campo: "OF_AREA_JUGADORES",
            ayuda: "Jugadores que atacan el área",
          },
          {
            titulo: "Tipos de centros",
            campo: "OF_AREA_CENTROS",
            ayuda: "Tipos de centros",
          },
        ],
      },
      {
        titulo: "Transición defensiva",
        campos: [
          {
            titulo: "Estructura compensadora",
            campo: "TRANSICION_DEF_ESTRUCTURA",
            ayuda: "Estructura compensadora",
          },
          {
            titulo: "Dificultades espalda",
            campo: "TRANSICION_DEF_DIFICULTADES_ESPALDA",
            ayuda: "Dificultades espalda",
          },
          {
            titulo: "Primera intención tras pérdida",
            campo: "TRANSICION_DEF_PRIMERA_INTENCION",
            ayuda: "Primera intención tras pérdida",
            ancho: true,
          },
        ],
      },
    ],
  },
  {
    id: "defensivo",
    titulo: "Fase defensiva",
    subtitulo: "Cómo presiona y defiende el rival",
    accent: "#3B7DE8",
    bloques: [
      {
        titulo: "Reinicios defensivos",
        campos: [
          {
            titulo: "Emparejamientos",
            campo: "DEF_REINICIO_EMPAREJAN",
            ayuda: "Emparejamientos",
          },
          {
            titulo: "Orientaciones",
            campo: "DEF_REINICIO_ORIENTAN",
            ayuda: "Orientaciones",
          },
          {
            titulo: "Activos en presión",
            campo: "DEF_REINICIO_ACTIVOS_PRESION",
            ayuda: "Activos en presión",
          },
          {
            titulo: "Jugadores débiles",
            campo: "DEF_REINICIO_JUGADORES_DEBILES",
            ayuda: "Jugadores débiles",
          },
        ],
      },
      {
        titulo: "Bloque alto",
        campos: [
          {
            titulo: "Estructura",
            campo: "DEF_BLOQUE_ALTO_ESTRUCTURA",
            ayuda: "Estructura",
          },
          {
            titulo: "Trayectoria de acoso",
            campo: "DEF_BLOQUE_ALTO_TRAYECTORIA_ACOSO",
            ayuda: "Trayectoria de acoso",
          },
          {
            titulo: "Saltos pares / impares",
            campo: "DEF_BLOQUE_ALTO_SALTOS_PARES_IMPARES",
            ayuda: "Saltos pares/impares",
          },
          {
            titulo: "Distancias",
            campo: "DEF_BLOQUE_ALTO_DISTANCIAS",
            ayuda: "Distancias",
          },
          {
            titulo: "Defensa espalda",
            campo: "DEF_BLOQUE_ALTO_ESPALDA",
            ayuda: "Defensa espalda",
            ancho: true,
          },
        ],
      },
      {
        titulo: "Bloque medio",
        campos: [
          {
            titulo: "Estructura",
            campo: "DEF_BLOQUE_MEDIO_ESTRUCTURA",
            ayuda: "Estructura",
          },
          {
            titulo: "Fusionan línea",
            campo: "DEF_BLOQUE_MEDIO_FUSIONAN_LINEA",
            ayuda: "Fusionan línea",
          },
          {
            titulo: "Quién defiende cortes",
            campo: "DEF_BLOQUE_MEDIO_CORTES",
            ayuda: "Quién defiende cortes",
          },
          {
            titulo: "Distancias",
            campo: "DEF_BLOQUE_MEDIO_DISTANCIAS",
            ayuda: "Distancias",
          },
          {
            titulo: "Centrales saltadores",
            campo: "DEF_BLOQUE_MEDIO_CENTRALES_SALTADORES",
            ayuda: "Centrales saltadores",
          },
          {
            titulo: "Defensa espalda",
            campo: "DEF_BLOQUE_MEDIO_ESPALDA",
            ayuda: "Defensa espalda",
          },
        ],
      },
      {
        titulo: "Defensa de área",
        campos: [
          {
            titulo: "Se hunde la línea",
            campo: "DEF_AREA_HUNDE_LINEA",
            ayuda: "Se hunde la línea",
          },
          {
            titulo: "Defensa punto penalti",
            campo: "DEF_AREA_PUNTO_PENALTI",
            ayuda: "Defensa punto penalti",
          },
          {
            titulo: "Jugador débil",
            campo: "DEF_AREA_JUGADOR_DEBIL",
            ayuda: "Jugador débil",
            ancho: true,
          },
        ],
      },
      /*
      | La transición ofensiva del rival: lo que hace **cuando roba**.
      |
      | Faltaba. El informe cerraba la fase ofensiva con la transición
      | defensiva —lo que hace al perderla— y la defensiva se quedaba en la
      | defensa del área, así que del momento en el que más daño hace un
      | equipo de esta categoría no había dónde escribir. Va aquí, al final de
      | la fase defensiva, porque es lo que pasa justo después de ella.
      |
      | Los cinco campos son `remoto`: la hoja RIVALES no tiene estas columnas
      | y hasta que alguien las añada se guardan en Supabase.
      */
      {
        titulo: "Transición ofensiva",
        campos: [
          {
            titulo: "Zonas donde roba",
            campo: "TRANSICION_OF_ZONAS_ROBO",
            ayuda: "Zonas donde roba",
            remoto: true,
          },
          {
            titulo: "Primera intención tras robo",
            campo: "TRANSICION_OF_PRIMERA_INTENCION",
            ayuda: "Primera intención tras robo",
            remoto: true,
          },
          {
            titulo: "Jugadores de referencia",
            campo: "TRANSICION_OF_JUGADORES_REFERENCIA",
            ayuda: "Jugadores de referencia",
            remoto: true,
          },
          {
            titulo: "Espacios que ataca",
            campo: "TRANSICION_OF_ESPACIOS",
            ayuda: "Espacios que ataca",
            remoto: true,
          },
          {
            titulo: "Velocidad y acompañamientos",
            campo: "TRANSICION_OF_ACOMPANAMIENTOS",
            ayuda: "Velocidad y acompañamientos",
            ancho: true,
            remoto: true,
          },
        ],
      },
    ],
  },
];

/* Bloque final: texto largo, una columna por tarjeta. */
export const CONCLUSIONES: FieldDef[] = [
  { titulo: "Jugadores clave", campo: "JUGADORES_CLAVE", rows: 8 },
  { titulo: "Fortalezas individuales", campo: "FORTALEZAS_INDIVIDUALES", rows: 8 },
  { titulo: "Debilidades individuales", campo: "DEBILIDADES_INDIVIDUALES", rows: 8 },
  { titulo: "Estado del equipo", campo: "ESTADO_EQUIPO", rows: 8 },
  { titulo: "Claves del partido", campo: "CLAVES_PARTIDO", rows: 8 },
  { titulo: "Plan de partido", campo: "PLAN_PARTIDO", rows: 8 },
  { titulo: "Claves emocionales", campo: "CLAVES_EMOCIONALES", rows: 8 },
  { titulo: "Observaciones", campo: "OBSERVACIONES", rows: 10, ancho: true },
];
