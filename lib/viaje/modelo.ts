/**
 * El desplazamiento de partido: el dossier del viaje y el horario del día.
 *
 * Sustituye a los dos documentos que el cuerpo técnico montaba a mano para
 * cada jornada y que están guardados en `public/` como referencia:
 *
 * - `AWAY_TERUEL.pptx` — dos diapositivas 16:9 con la cabecera del partido, el
 *   campo (superficie, dimensiones, plano y ruta desde Valdebebas) y el hotel
 *   (nombre, enlace y distancia al estadio).
 * - `HORARIO_CD_TERUEL.pdf` — una hoja A4 con el día entero en una columna de
 *   medias horas, de las 8:00 a la madrugada, y cada cita puesta a su hora.
 *
 * Lo que aquí se decide y no se deduce del código:
 *
 * **El horario se calcula desde la hora del partido, no se escribe.** Es la
 * única cifra que manda: la salida del autobús, la comida, la llegada al
 * estadio y el calentamiento son siempre el mismo desfase respecto al saque
 * inicial, y el cuerpo técnico los recalculaba a mano cada semana. Por eso una
 * plantilla de horario es una lista de **minutos relativos** y no de horas.
 *
 * **Los minutos pueden pasar de 1440.** Volver de Teruel es llegar a las 3:15
 * de la madrugada siguiente, y ese renglón pertenece al horario del sábado,
 * no al del domingo: se guarda como 1635 y se pinta como "03:15" con su marca
 * de día siguiente.
 *
 * **Un desplazamiento son varios días.** Lo normal es salir la víspera, dormir
 * en el hotel y jugar al día siguiente; a veces se va y se vuelve en el día, y
 * a veces —un torneo, una eliminatoria— son tres o cuatro. Por eso el
 * documento guarda una **lista de días** (`dias`) y cada uno lleva su fecha,
 * su rótulo y sus citas, con sus minutos contados desde **su propia**
 * medianoche. Sale una hoja A4 por día. El día del partido es el que coincide
 * con `fecha`: es el único anclado a la hora del saque inicial, y por eso las
 * plantillas relativas sólo tienen sentido en él.
 *
 * El acabado es el de `public/INDIVIDUAL.pptx` —papel, Barlow Condensed, verde
 * 1B3A2E, azul 0F1E3D y el filo rosa—, el mismo que ya usan la portada del
 * jugador rival (`lib/rivals/portada.ts`) y la pizarra de balón parado.
 */

/* ------------------------------------------------------------------ */
/*  LIENZOS                                                            */
/* ------------------------------------------------------------------ */

/** La diapositiva del dossier: 16:9, el lienzo de la plantilla. */
export const DOSSIER_W = 1920;
export const DOSSIER_H = 1080;

/**
 * La hoja del horario: A4 vertical a 150 puntos por pulgada.
 *
 * No es un capricho: el horario se imprime y se cuelga, así que se dibuja
 * directamente en proporción A4 (1240×1754) y el PDF lo lleva a sangre. A 150
 * ppp el texto se compone con medidas cómodas y, capturado a 1,5×, la hoja
 * sale a 225 ppp reales, de sobra para una impresora de oficina.
 */
export const HOJA_W = 1240;
export const HOJA_H = 1754;

/** Márgenes de la plantilla: donde empieza y acaba el filo rosa. */
export const MARGEN_DOSSIER = 97;
export const MARGEN_HOJA = 84;

export const COLORES_VIAJE = {
  papel: "#FFFFFF",
  crema: "#F7F4EC",
  verde: "#1B3A2E",
  navy: "#0F1E3D",
  rosa: "#F6AFB6",
  rosaHondo: "#D89AA6",
  tinta: "#0B1420",
  /** Gris de los renglones sin cita: la columna de horas del PDF original. */
  humo: "#E4E0D6",
};

export const CLUB_VIAJE = "REAL MADRID CF · CASTILLA";

/* ------------------------------------------------------------------ */
/*  HORAS                                                              */
/* ------------------------------------------------------------------ */

/** "21:15" → 1275. Devuelve `null` si no se entiende. */
export function aMinutos(hora: string): number | null {
  const trozos = hora.trim().match(/^(\d{1,2})[:.h]?(\d{2})?$/);

  if (!trozos) return null;

  const h = Number(trozos[1]);
  const m = Number(trozos[2] ?? 0);

  if (h > 47 || m > 59) return null;

  return h * 60 + m;
}

/** 1635 → "03:15". El día siguiente se dice aparte, no con un "27:15". */
export function aHora(minutos: number) {
  const total = ((Math.round(minutos) % 1440) + 1440) % 1440;

  const h = Math.floor(total / 60);
  const m = total % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Si ese minuto ya cae en la madrugada del día siguiente. */
export function esDiaSiguiente(minutos: number) {
  return minutos >= 1440;
}

/**
 * "+1 h 45" para un desfase; sirve para explicar una plantilla.
 *
 * En un viaje de varios días el desfase pasa de la jornada —la salida de la
 * víspera está a veinte horas del saque inicial— y "−20 h 45" no se lee: se
 * dice en días, que es como se habla de un desplazamiento.
 */
export function comoDesfase(minutos: number) {
  const signo = minutos < 0 ? "−" : "+";
  const total = Math.abs(minutos);

  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;

  if (d) return h ? `${signo}${d} d ${h} h` : `${signo}${d} d`;

  if (!h) return `${signo}${m} min`;

  return m ? `${signo}${h} h ${m}` : `${signo}${h} h`;
}

/* ------------------------------------------------------------------ */
/*  EL DOCUMENTO                                                       */
/* ------------------------------------------------------------------ */

/**
 * De qué va cada cita del día.
 *
 * El tipo no es decorativo: pinta el renglón de un color y es lo que permite
 * leer la hoja de un vistazo desde el fondo del autobús. El partido tiene el
 * suyo porque es la única línea que se busca con la vista.
 */
export type TipoCita =
  | "viaje"
  | "comida"
  | "descanso"
  | "trabajo"
  | "partido"
  | "otro";

export const TIPO_CITA: Record<
  TipoCita,
  { label: string; color: string; tinta: string }
> = {
  viaje: { label: "Viaje", color: "#0F1E3D", tinta: "#FFFFFF" },
  comida: { label: "Comida", color: "#1B3A2E", tinta: "#FFFFFF" },
  descanso: { label: "Descanso", color: "#8C8578", tinta: "#FFFFFF" },
  trabajo: { label: "Trabajo", color: "#5A6B8C", tinta: "#FFFFFF" },
  partido: { label: "Partido", color: "#D89AA6", tinta: "#0F1E3D" },
  otro: { label: "Otro", color: "#B9B2A4", tinta: "#FFFFFF" },
};

export type CitaHorario = {
  id: string;
  /** Minutos desde medianoche del día del partido. Puede pasar de 1440. */
  minuto: number;
  texto: string;
  tipo: TipoCita;
  /** Segunda línea en pequeño: "Lavandería", "Picnic · ENTREGA". */
  nota?: string;
};

/**
 * Un día del desplazamiento: una hoja del horario.
 *
 * Los minutos de sus citas se cuentan desde **su** medianoche, no desde la del
 * partido, y pueden pasar de 1440 igual que antes: la vuelta que llega a las
 * 3:15 pertenece a la hoja del día que se jugó, no a la del día siguiente.
 * Por eso el día es la unidad y no una fecha suelta por cita.
 */
export type DiaViaje = {
  id: string;
  /** ISO `yyyy-mm-dd`. Es lo que ata el día al calendario del viaje. */
  fecha: string;
  /** Rótulo propio: "Víspera · viaje de ida". Vacío, se deduce de la fecha. */
  titulo: string;
  citas: CitaHorario[];
  /** Primera y última media hora de la columna, en minutos. */
  desde: number;
  hasta: number;
};

/** Una foto o un plano del dossier. Vive en Supabase; aquí sólo su dirección. */
export type ImagenViaje = {
  url: string;
  /** Lo que se lee bajo la imagen: "Ruta Valdebebas · Pinilla". */
  pie?: string;
};

export type DatosEstadio = {
  nombre: string;
  ciudad: string;
  superficie: string;
  dimensiones: string;
  direccion: string;
  /** Cómo se llega: "365 km" y "3 h 40". Dos campos porque se leen aparte. */
  distancia: string;
  tiempo: string;
  enlace: string;
  plano?: ImagenViaje;
  ruta?: ImagenViaje;
};

export type DatosHotel = {
  nombre: string;
  direccion: string;
  telefono: string;
  enlace: string;
  distancia: string;
  tiempo: string;
  /** Cuándo se entra: "Lunes 31 · 14:00". */
  entrada: string;
  foto?: ImagenViaje;
  ruta?: ImagenViaje;
};

export type Desplazamiento = {
  /** `matchId` del calendario, o `riv-<ID>` de la hoja RIVALES. */
  partidoId: string;
  rival: string;
  jornada: string;
  /** `ID` de la fila de la hoja RIVALES: la llave del resto de la semana. */
  rivalId?: string;
  /** ISO `yyyy-mm-dd`. */
  fecha: string;
  hora: string;
  condicion: "local" | "visitante";
  competicion: string;
  /** El autobús sale de aquí: se puede cambiar (Valdebebas, la ciudad…). */
  origen: string;
  estadio: DatosEstadio;
  hotel: DatosHotel;
  /** Sin hotel el dossier se queda en dos diapositivas. */
  conHotel: boolean;
  /** Los días del viaje, en el orden en que se leen. Uno por hoja A4. */
  dias: DiaViaje[];
  /**
   * El horario de un solo día, como se guardaba antes de que el viaje pudiera
   * durar más de uno. Se lee al abrir un documento viejo y se convierte en el
   * primer día; `normalizaViaje` lo quita en cuanto alguien toca algo.
   */
  horario?: {
    desde: number;
    hasta: number;
    citas: CitaHorario[];
  };
  /** Avisos que van al pie de la hoja: "Traje de paseo", "DNI". */
  avisos: string[];
  actualizado?: string;
};

export type ViajeStore = {
  /** Un dossier por partido. */
  viajes: Record<string, Desplazamiento>;
};

export const EMPTY_VIAJE_STORE: ViajeStore = { viajes: {} };

/* `crypto.randomUUID` no está en todos los navegadores de la caseta. */
export function nuevoId(prefijo: string) {
  return `${prefijo}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/*  PLANTILLAS DE HORARIO                                              */
/* ------------------------------------------------------------------ */

export type PasoPlantilla = {
  /** Minutos respecto al saque inicial. Negativo, antes del partido. */
  desfase: number;
  texto: string;
  tipo: TipoCita;
  nota?: string;
};

export type PlantillaHorario = {
  key: string;
  label: string;
  /** Para qué sirve, en la lista: "365 km, se sale por la mañana". */
  pista: string;
  condicion: "local" | "visitante";
  pasos: PasoPlantilla[];
};

/**
 * Las plantillas.
 *
 * La primera es la de Teruel tal cual salía en `HORARIO_CD_TERUEL.pdf`, con
 * los desfases sacados de sus horas y el partido a las 21:15: salida a las
 * 10:30 son diez horas y cuarenta y cinco minutos antes, la llegada al estadio
 * hora y media, el calentamiento media. Las otras son la misma jornada
 * comprimida —viaje corto, y partido en casa—, que es como se repite el resto
 * del año.
 */
export const PLANTILLAS_HORARIO: PlantillaHorario[] = [
  {
    key: "visitante-largo",
    label: "Visitante · viaje largo",
    pista: "Más de 250 km: se sale por la mañana, se come y se descansa en hotel",
    condicion: "visitante",
    pasos: [
      { desfase: -645, texto: "Salida bus", tipo: "viaje", nota: "Lavandería" },
      { desfase: -435, texto: "Llegada hotel", tipo: "viaje" },
      { desfase: -420, texto: "Comida", tipo: "comida" },
      { desfase: -390, texto: "Descanso habitaciones", tipo: "descanso" },
      { desfase: -210, texto: "Merienda", tipo: "comida" },
      { desfase: -165, texto: "Charla de partido", tipo: "trabajo" },
      { desfase: -120, texto: "Salida hacia el estadio", tipo: "viaje" },
      { desfase: -90, texto: "Llegada estadio", tipo: "viaje" },
      { desfase: -30, texto: "Calentamiento", tipo: "trabajo" },
      { desfase: 0, texto: "Partido", tipo: "partido" },
      { desfase: 135, texto: "Cena picnic", tipo: "comida", nota: "ENTREGA" },
      { desfase: 360, texto: "Llegada Valdebebas", tipo: "viaje" },
    ],
  },
  {
    key: "visitante-corto",
    label: "Visitante · viaje corto",
    pista: "Menos de 150 km: se come en la ciudad deportiva y se sale después",
    condicion: "visitante",
    pasos: [
      { desfase: -330, texto: "Comida en Valdebebas", tipo: "comida" },
      { desfase: -270, texto: "Salida bus", tipo: "viaje" },
      { desfase: -180, texto: "Llegada y merienda", tipo: "comida" },
      { desfase: -135, texto: "Charla de partido", tipo: "trabajo" },
      { desfase: -90, texto: "Llegada estadio", tipo: "viaje" },
      { desfase: -30, texto: "Calentamiento", tipo: "trabajo" },
      { desfase: 0, texto: "Partido", tipo: "partido" },
      { desfase: 120, texto: "Cena picnic", tipo: "comida", nota: "ENTREGA" },
      { desfase: 210, texto: "Llegada Valdebebas", tipo: "viaje" },
    ],
  },
  {
    key: "local",
    label: "Partido en casa",
    pista: "Sin viaje: comida, charla y estadio",
    condicion: "local",
    pasos: [
      { desfase: -300, texto: "Comida", tipo: "comida" },
      { desfase: -240, texto: "Descanso", tipo: "descanso" },
      { desfase: -165, texto: "Merienda", tipo: "comida" },
      { desfase: -135, texto: "Charla de partido", tipo: "trabajo" },
      { desfase: -90, texto: "Llegada vestuario", tipo: "viaje" },
      { desfase: -30, texto: "Calentamiento", tipo: "trabajo" },
      { desfase: 0, texto: "Partido", tipo: "partido" },
      { desfase: 120, texto: "Cena", tipo: "comida" },
    ],
  },
];

export const PLANTILLA_HORARIO_BY_KEY = new Map(
  PLANTILLAS_HORARIO.map((plantilla) => [plantilla.key, plantilla]),
);

/**
 * Un paso a hora fija, para los días que no son el del partido.
 *
 * La víspera no se mueve cuando la federación cambia la hora del saque
 * inicial: el autobús sale a las cuatro y se cena a las nueve tanto si al día
 * siguiente se juega a las doce como si se juega a las nueve de la noche. Por
 * eso esos días se escriben con la hora puesta y no con un desfase, que es
 * justo al revés que el día del partido.
 */
export type PasoDia = {
  hora: string;
  texto: string;
  tipo: TipoCita;
  nota?: string;
  /** La cita cae ya en la madrugada del día de después. */
  dia2?: boolean;
};

export type PlantillaDia = {
  key: string;
  label: string;
  pista: string;
  horas: PasoDia[];
};

/** Plantillas para rellenar **un** día suelto que no es el del partido. */
export const PLANTILLAS_DIA: PlantillaDia[] = [
  {
    key: "vispera-viaje",
    label: "Víspera · viaje y hotel",
    pista: "Se sale por la tarde, se cena en el hotel y se duerme allí",
    horas: [
      { hora: "16:00", texto: "Salida bus", tipo: "viaje", nota: "Lavandería" },
      { hora: "19:30", texto: "Llegada hotel", tipo: "viaje" },
      { hora: "20:00", texto: "Activación", tipo: "trabajo" },
      { hora: "21:00", texto: "Cena", tipo: "comida" },
      { hora: "22:30", texto: "Charla de partido", tipo: "trabajo" },
      { hora: "23:15", texto: "Descanso habitaciones", tipo: "descanso" },
    ],
  },
  {
    key: "vispera-casa",
    label: "Víspera · en Valdebebas",
    pista: "No se viaja: entrenamiento de activación y a casa",
    horas: [
      { hora: "10:30", texto: "Activación", tipo: "trabajo" },
      { hora: "12:00", texto: "Charla de partido", tipo: "trabajo" },
      { hora: "13:30", texto: "Comida", tipo: "comida" },
      { hora: "15:00", texto: "Salida a casa", tipo: "descanso" },
    ],
  },
  {
    key: "regreso",
    label: "Regreso a Valdebebas",
    pista: "Se duerme fuera y se vuelve al día siguiente",
    horas: [
      { hora: "09:30", texto: "Desayuno", tipo: "comida" },
      { hora: "10:30", texto: "Recuperación", tipo: "trabajo" },
      { hora: "11:30", texto: "Salida bus", tipo: "viaje" },
      { hora: "15:00", texto: "Llegada Valdebebas", tipo: "viaje" },
    ],
  },
  {
    key: "libre",
    label: "Día en blanco",
    pista: "Sin citas: se escribe a mano",
    horas: [],
  },
];

/* ------------------------------------------------------------------ */
/*  PLANTILLAS DE VIAJE (VARIOS DÍAS)                                  */
/* ------------------------------------------------------------------ */

/**
 * Un día dentro de una plantilla de viaje.
 *
 * Puede llevar las dos cosas a la vez y es lo normal en el día del partido: la
 * mañana va por reloj —el desayuno es a las nueve y media pase lo que pase— y
 * la tarde por desfase respecto al saque inicial, que es lo que de verdad se
 * mueve cuando cambian la hora.
 */
export type DiaPlantilla = {
  /** Días respecto al del partido: −1 es la víspera, +1 el de después. */
  desplazamiento: number;
  titulo: string;
  /** Pasos anclados al saque inicial. Sólo tienen sentido el día del partido. */
  pasos?: PasoPlantilla[];
  /** Pasos a hora fija. */
  horas?: PasoDia[];
};

export type PlantillaViaje = {
  key: string;
  label: string;
  pista: string;
  condicion: "local" | "visitante";
  dias: DiaPlantilla[];
};

/**
 * Los viajes tipo, de una tacada.
 *
 * Rehacen el calendario entero del desplazamiento —cuántos días y qué pasa en
 * cada uno—, que es el trabajo que se repetía a mano cada semana. Lo de
 * después es afinar horas, y para eso están las herramientas del editor.
 */
export const PLANTILLAS_VIAJE: PlantillaViaje[] = [
  {
    key: "un-dia",
    label: "Ida y vuelta en el día",
    pista: "Un solo día: se sale por la mañana y se vuelve tras el partido",
    condicion: "visitante",
    dias: [
      {
        desplazamiento: 0,
        titulo: "Día de partido",
        pasos: PLANTILLAS_HORARIO[0].pasos,
      },
    ],
  },
  {
    key: "dos-dias",
    label: "Dos días · se duerme la víspera",
    pista: "Lo habitual fuera de casa: se viaja la tarde antes y se vuelve tras el partido",
    condicion: "visitante",
    dias: [
      {
        desplazamiento: -1,
        titulo: "Víspera · viaje de ida",
        horas: PLANTILLAS_DIA[0].horas,
      },
      {
        desplazamiento: 0,
        titulo: "Día de partido",
        horas: [
          { hora: "09:30", texto: "Desayuno", tipo: "comida" },
          { hora: "11:00", texto: "Paseo y activación", tipo: "trabajo" },
        ],
        pasos: [
          { desfase: -300, texto: "Comida", tipo: "comida" },
          { desfase: -240, texto: "Descanso habitaciones", tipo: "descanso" },
          { desfase: -165, texto: "Merienda", tipo: "comida" },
          { desfase: -135, texto: "Charla de partido", tipo: "trabajo" },
          { desfase: -105, texto: "Salida hacia el estadio", tipo: "viaje" },
          { desfase: -90, texto: "Llegada estadio", tipo: "viaje" },
          { desfase: -30, texto: "Calentamiento", tipo: "trabajo" },
          { desfase: 0, texto: "Partido", tipo: "partido" },
          { desfase: 135, texto: "Cena picnic", tipo: "comida", nota: "ENTREGA" },
          { desfase: 360, texto: "Llegada Valdebebas", tipo: "viaje" },
        ],
      },
    ],
  },
  {
    key: "tres-dias",
    label: "Tres días · se duerme también la vuelta",
    pista: "Viajes muy largos: se sale la víspera y se regresa al día siguiente",
    condicion: "visitante",
    dias: [
      {
        desplazamiento: -1,
        titulo: "Víspera · viaje de ida",
        horas: PLANTILLAS_DIA[0].horas,
      },
      {
        desplazamiento: 0,
        titulo: "Día de partido",
        horas: [
          { hora: "09:30", texto: "Desayuno", tipo: "comida" },
          { hora: "11:00", texto: "Paseo y activación", tipo: "trabajo" },
        ],
        pasos: [
          { desfase: -300, texto: "Comida", tipo: "comida" },
          { desfase: -240, texto: "Descanso habitaciones", tipo: "descanso" },
          { desfase: -165, texto: "Merienda", tipo: "comida" },
          { desfase: -135, texto: "Charla de partido", tipo: "trabajo" },
          { desfase: -105, texto: "Salida hacia el estadio", tipo: "viaje" },
          { desfase: -90, texto: "Llegada estadio", tipo: "viaje" },
          { desfase: -30, texto: "Calentamiento", tipo: "trabajo" },
          { desfase: 0, texto: "Partido", tipo: "partido" },
          { desfase: 120, texto: "Cena", tipo: "comida" },
          { desfase: 210, texto: "Vuelta al hotel", tipo: "viaje" },
        ],
      },
      {
        desplazamiento: 1,
        titulo: "Regreso",
        horas: PLANTILLAS_DIA[2].horas,
      },
    ],
  },
  {
    key: "casa",
    label: "Partido en casa",
    pista: "Sin viaje: un solo día, comida, charla y estadio",
    condicion: "local",
    dias: [
      {
        desplazamiento: 0,
        titulo: "Día de partido",
        pasos: PLANTILLAS_HORARIO[2].pasos,
      },
    ],
  },
];

/**
 * Monta el día entero desde la hora del partido.
 *
 * Redondea la columna a la media hora de arriba y de abajo para que la primera
 * y la última cita no queden pegadas al borde de la hoja.
 */
export function horarioDePlantilla(
  plantilla: PlantillaHorario,
  minutoPartido: number,
) {
  const citas: CitaHorario[] = plantilla.pasos.map((paso) => ({
    id: nuevoId("CI"),
    minuto: minutoPartido + paso.desfase,
    texto: paso.texto,
    tipo: paso.tipo,
    ...(paso.nota ? { nota: paso.nota } : {}),
  }));

  return { citas, ...margenesDe(citas) };
}

/** Dónde empieza y acaba la columna de horas para que quepan todas las citas. */
export function margenesDe(citas: CitaHorario[]) {
  if (citas.length === 0) return { desde: 8 * 60, hasta: 24 * 60 };

  const minutos = citas.map((cita) => cita.minuto);

  const desde = Math.floor((Math.min(...minutos) - 30) / 30) * 30;
  const hasta = Math.ceil((Math.max(...minutos) + 30) / 30) * 30;

  return { desde: Math.max(0, desde), hasta };
}

/** Las medias horas de la columna, de `desde` a `hasta`. */
export function renglones(desde: number, hasta: number) {
  const filas: number[] = [];

  for (let minuto = desde; minuto <= hasta; minuto += 30) filas.push(minuto);

  return filas;
}

/** Ordenadas por hora: es como se leen y como se pintan. */
export function ordenaCitas(citas: CitaHorario[]) {
  return [...citas].sort((a, b) => a.minuto - b.minuto);
}

/* ------------------------------------------------------------------ */
/*  LOS DÍAS                                                           */
/* ------------------------------------------------------------------ */

/** "10:30" → la cita del modelo. `dia2` la manda a la madrugada siguiente. */
export function citaDeHora(paso: PasoDia): CitaHorario {
  return {
    id: nuevoId("CI"),
    minuto: (aMinutos(paso.hora) ?? 0) + (paso.dia2 ? 1440 : 0),
    texto: paso.texto,
    tipo: paso.tipo,
    ...(paso.nota ? { nota: paso.nota } : {}),
  };
}

/**
 * Deja el día con esas citas: ordenadas y con la columna recalculada.
 *
 * Es el único sitio donde se tocan `desde` y `hasta`, que son datos derivados:
 * quien cambia una hora no tiene por qué acordarse de mover la columna.
 */
export function conCitas(dia: DiaViaje, citas: CitaHorario[]): DiaViaje {
  return { ...dia, citas: ordenaCitas(citas), ...margenesDe(citas) };
}

/** Copias con identidad nueva, opcionalmente movidas de hora. */
export function clonaCitas(citas: CitaHorario[], salto = 0): CitaHorario[] {
  return citas.map((cita) => ({
    ...cita,
    id: nuevoId("CI"),
    minuto: Math.max(0, cita.minuto + salto),
  }));
}

export function diaVacio(fecha: string, titulo = ""): DiaViaje {
  return conCitas(
    { id: nuevoId("DIA"), fecha, titulo, citas: [], desde: 0, hasta: 0 },
    [],
  );
}

export function diaDePlantilla(plantilla: PlantillaDia, fecha: string): DiaViaje {
  return conCitas(
    diaVacio(fecha, plantilla.label),
    plantilla.horas.map(citaDeHora),
  );
}

/**
 * Replica un día.
 *
 * Cae **al día siguiente** y con las mismas horas, que es lo que significa
 * replicar en un viaje: la concentración de tres días repite desayuno,
 * entrenamiento y comida. Las citas llevan identidad nueva para que editar la
 * copia no toque el original.
 */
export function duplicaDia(dia: DiaViaje): DiaViaje {
  return conCitas(
    {
      ...dia,
      id: nuevoId("DIA"),
      fecha: sumaDias(dia.fecha, 1),
      citas: [],
    },
    clonaCitas(dia.citas),
  );
}

/** Por fecha, que es como se viaja. */
export function ordenaDias(dias: DiaViaje[]) {
  return [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Saca el elemento de `desde` y lo mete en `hasta`. */
export function mueveEnLista<T>(lista: T[], desde: number, hasta: number): T[] {
  if (desde === hasta || desde < 0 || desde >= lista.length) return lista;

  const copia = [...lista];

  const [pieza] = copia.splice(desde, 1);

  copia.splice(Math.max(0, Math.min(copia.length, hasta)), 0, pieza);

  return copia;
}

/**
 * Pone fechas seguidas, respetando el orden de la lista.
 *
 * Después de mover un día de sitio las fechas quedan desordenadas —cada día se
 * lleva la suya—, y encadenarlas es lo que devuelve el viaje a días
 * consecutivos sin reescribir tres calendarios a mano.
 */
export function encadenaFechas(dias: DiaViaje[], desde?: string): DiaViaje[] {
  const arranque = desde ?? dias[0]?.fecha;

  if (!arranque) return dias;

  return dias.map((dia, indice) => ({
    ...dia,
    fecha: sumaDias(arranque, indice),
  }));
}

/** Cuál de los días es el del partido, o −1 si ninguno cae en esa fecha. */
export function indiceDiaPartido(viaje: Desplazamiento) {
  return viaje.dias.findIndex((dia) => dia.fecha === viaje.fecha);
}

/** Cómo se llama el día en pantalla y en la hoja, si no lleva rótulo propio. */
export function rotuloDia(dia: DiaViaje, viaje: Desplazamiento, indice: number) {
  if (dia.titulo.trim()) return dia.titulo.trim();

  const salto = diasEntre(dia.fecha, viaje.fecha);

  if (salto === 0) return "Día de partido";
  if (salto === 1) return "Víspera";
  if (salto === 2) return "Dos días antes";
  if (salto === -1) return "Día siguiente";
  if (salto < -1) return `${-salto} días después`;
  if (salto > 2) return `${salto} días antes`;

  return `Día ${indice + 1}`;
}

/**
 * Los minutos que faltan para el saque inicial, contando los días de por medio.
 *
 * Es la cifra con la que piensa el cuerpo técnico —"la charla, hora y media
 * antes"— y en un viaje de dos días sigue valiendo: la salida del autobús de
 * la víspera es "−1 d 5 h", no una hora suelta sin referencia.
 */
export function desfaseCita(
  cita: CitaHorario,
  dia: DiaViaje,
  viaje: Desplazamiento,
) {
  const minutoPartido = aMinutos(viaje.hora);

  if (minutoPartido === null) return null;

  return cita.minuto - diasEntre(dia.fecha, viaje.fecha) * 1440 - minutoPartido;
}

/**
 * Encaja las citas de reloj delante de las que cuelgan del saque inicial.
 *
 * El día del partido mezcla las dos cosas: el desayuno es a las nueve y media
 * pase lo que pase, y la comida es cinco horas antes del partido. Con un
 * partido de tarde eso encaja solo, pero con uno de mediodía la comida cae a
 * las ocho y la hoja acaba diciendo «08:00 comida · 09:30 desayuno», que no es
 * un horario, es una errata. Cuando pasa, la mañana entera se adelanta lo justo
 * para quedar una hora por delante de la primera cita del reloj del partido,
 * conservando la separación entre sus citas; lo que se iría antes de las seis
 * de la mañana se cae, porque a esa hora ya no se desayuna, se madruga.
 */
function encajaLaManana(
  fijas: CitaHorario[],
  relativas: CitaHorario[],
): CitaHorario[] {
  if (fijas.length === 0 || relativas.length === 0) return fijas;

  const primeraRelativa = Math.min(...relativas.map((cita) => cita.minuto));
  const ultimaFija = Math.max(...fijas.map((cita) => cita.minuto));

  const holgura = primeraRelativa - 60 - ultimaFija;

  if (holgura >= 0) return fijas;

  return fijas
    .map((cita) => ({ ...cita, minuto: cita.minuto + holgura }))
    .filter((cita) => cita.minuto >= 6 * 60);
}

/** Monta el viaje entero desde una plantilla de varios días. */
export function diasDePlantillaViaje(
  plantilla: PlantillaViaje,
  viaje: Desplazamiento,
): DiaViaje[] {
  const minutoPartido = aMinutos(viaje.hora) ?? 20 * 60;

  return plantilla.dias.map((molde) => {
    const relativas = (molde.pasos ?? []).map((paso) => ({
      id: nuevoId("CI"),
      minuto: minutoPartido + paso.desfase,
      texto: paso.texto,
      tipo: paso.tipo,
      ...(paso.nota ? { nota: paso.nota } : {}),
    }));

    const fijas = (molde.horas ?? []).map(citaDeHora);

    return conCitas(
      diaVacio(sumaDias(viaje.fecha, molde.desplazamiento), molde.titulo),
      [...encajaLaManana(fijas, relativas), ...relativas],
    );
  });
}

/**
 * Pone al día un documento guardado.
 *
 * Los desplazamientos que se montaron cuando un viaje era un solo día llevan
 * `horario` y no `dias`. Se convierten al abrirlos —el horario de entonces es
 * el día del partido— y se quedan convertidos en cuanto alguien escribe algo.
 * Aprovecha para rehacer `desde` y `hasta`, que son datos derivados, y para
 * darle identidad a cualquier día que llegue sin ella.
 */
export function normalizaViaje(viaje: Desplazamiento): Desplazamiento {
  const { horario, ...resto } = viaje;

  const crudos: DiaViaje[] =
    Array.isArray(viaje.dias) && viaje.dias.length
      ? viaje.dias
      : [
          {
            id: nuevoId("DIA"),
            fecha: viaje.fecha,
            titulo: "",
            citas: horario?.citas ?? [],
            desde: 0,
            hasta: 0,
          },
        ];

  const dias = crudos.map((dia) =>
    conCitas(
      {
        id: dia.id || nuevoId("DIA"),
        fecha: dia.fecha || viaje.fecha,
        titulo: dia.titulo ?? "",
        citas: [],
        desde: 0,
        hasta: 0,
      },
      Array.isArray(dia.citas) ? dia.citas : [],
    ),
  );

  return { ...resto, dias };
}

/** Todas las citas del viaje, con el día al que pertenecen. */
export function citasDelViaje(viaje: Desplazamiento) {
  return viaje.dias.flatMap((dia) =>
    dia.citas.map((cita) => ({ dia, cita })),
  );
}

export type CitaColocada = CitaHorario & {
  /** Píxeles desde el arranque de la columna. */
  y: number;
};

export type MarcaHora = {
  minuto: number;
  y: number;
  enPunto: boolean;
};

export type EjeHorario = {
  citas: CitaColocada[];
  marcas: MarcaHora[];
};

/**
 * Reparte el día por la columna de la hoja.
 *
 * Una escala de tiempo uniforme no vale para un día de partido, y es lo que
 * hacía el PDF original: entre la salida del autobús y la llegada al hotel no
 * pasa nada durante tres horas y media —media hoja desperdiciada— y luego la
 * comida, el descanso y la merienda se amontonan en cuarenta y cinco minutos
 * que no dan para tres etiquetas. Colocar cada cita a su píxel exacto obliga a
 * empujar hacia abajo en cascada, y el partido acaba dibujado dos horas más
 * tarde de lo que dice su propia etiqueta: justo el error que la hoja no se
 * puede permitir.
 *
 * Así que **el eje es proporcional pero elástico**: cada hueco entre dos citas
 * ocupa lo que le toca por duración salvo que no quepan las etiquetas, y
 * entonces se le da el mínimo y lo que sobra se reparte entre los huecos
 * anchos —los ratos en los que no pasa nada, que son los que pueden ceder—. El
 * orden y las horas escritas siempre son los buenos, y cada cita cae en su
 * sitio sin desplazamientos que expliquen nada.
 *
 * Las marcas de la columna se interpolan sobre ese mismo eje y se clarean:
 * primero las horas en punto y luego las medias, siempre que quepan sin
 * pisarse. Una franja apretada enseña sus horas; un rato muerto, sólo alguna.
 */
export function ejeHorario(
  citas: CitaHorario[],
  opciones: {
    desde: number;
    hasta: number;
    alto: number;
    /** Lo que ocupa una etiqueta con su aire: el hueco mínimo entre citas. */
    separacion: number;
    /** Distancia mínima entre dos marcas de hora para que se lean. */
    separacionMarcas: number;
  },
): EjeHorario {
  const orden = ordenaCitas(citas);

  const { desde, hasta, alto, separacion, separacionMarcas } = opciones;

  /* Los nudos del eje: el arranque, cada cita y el cierre. */
  const nudos = [desde, ...orden.map((cita) => cita.minuto), hasta];

  /*
  | Cada tramo pide su mínimo. Entre dos citas es la etiqueta entera; en los
  | dos extremos basta la mitad, que es lo que asoma de la primera y la última
  | por encima y por debajo de su propia línea.
  */
  const tramos = nudos.slice(0, -1).map((inicio, indice) => ({
    duracion: Math.max(0, nudos[indice + 1] - inicio),
    minimo:
      indice === 0 || indice === nudos.length - 2
        ? separacion / 2
        : separacion,
  }));

  const medidas = repartePorDuracion(tramos, alto);

  /* Dónde cae cada nudo, acumulando los tramos. */
  const posiciones: number[] = [0];

  medidas.forEach((medida, indice) => {
    posiciones.push(posiciones[indice] + medida);
  });

  /** Interpola dentro del tramo al que pertenece el minuto. */
  const y = (minuto: number) => {
    if (minuto <= nudos[0]) return posiciones[0];

    for (let i = 0; i < tramos.length; i += 1) {
      if (minuto > nudos[i + 1]) continue;

      const duracion = tramos[i].duracion;

      const avance = duracion > 0 ? (minuto - nudos[i]) / duracion : 0;

      return posiciones[i] + avance * medidas[i];
    }

    return posiciones[posiciones.length - 1];
  };

  const colocadas = orden.map((cita, indice) => ({
    ...cita,
    y: posiciones[indice + 1],
  }));

  /* Las marcas: primero las horas en punto, después las medias que quepan. */
  const marcas: MarcaHora[] = [];

  const cabe = (posicion: number) =>
    marcas.every((marca) => Math.abs(marca.y - posicion) >= separacionMarcas);

  const todas = renglones(desde, hasta);

  todas
    .filter((minuto) => minuto % 60 === 0)
    .forEach((minuto) => {
      const posicion = y(minuto);

      if (cabe(posicion)) marcas.push({ minuto, y: posicion, enPunto: true });
    });

  todas
    .filter((minuto) => minuto % 60 !== 0)
    .forEach((minuto) => {
      const posicion = y(minuto);

      if (cabe(posicion)) marcas.push({ minuto, y: posicion, enPunto: false });
    });

  return { citas: colocadas, marcas: marcas.sort((a, b) => a.y - b.y) };
}

/**
 * Reparte un alto entre tramos, por duración y respetando mínimos.
 *
 * Los tramos que no llegan a su mínimo se fijan en él y salen del reparto; lo
 * que queda se vuelve a repartir entre los demás, que por eso mismo se
 * ensanchan. Se repite hasta que ninguno se queda corto. Si ni siquiera caben
 * todos los mínimos —un día con veinte citas en una hoja— se encoge todo por
 * igual: apretado, pero en orden y sin que nada se salga de la hoja.
 */
function repartePorDuracion(
  tramos: { duracion: number; minimo: number }[],
  alto: number,
): number[] {
  const medidas = new Array<number>(tramos.length).fill(0);

  const minimoTotal = tramos.reduce((suma, tramo) => suma + tramo.minimo, 0);

  if (minimoTotal >= alto) {
    const factor = alto / (minimoTotal || 1);

    return tramos.map((tramo) => tramo.minimo * factor);
  }

  let sueltos = tramos.map((_, indice) => indice);
  let restante = alto;

  /* Como mucho una vuelta por tramo: cada una fija al menos uno. */
  for (let vuelta = 0; vuelta <= tramos.length; vuelta += 1) {
    const duracionTotal = sueltos.reduce(
      (suma, indice) => suma + tramos[indice].duracion,
      0,
    );

    const porMinuto = duracionTotal > 0 ? restante / duracionTotal : 0;

    const cortos = sueltos.filter(
      (indice) => porMinuto * tramos[indice].duracion < tramos[indice].minimo,
    );

    if (cortos.length === 0) {
      sueltos.forEach((indice) => {
        medidas[indice] = porMinuto * tramos[indice].duracion;
      });

      return medidas;
    }

    cortos.forEach((indice) => {
      medidas[indice] = tramos[indice].minimo;
      restante -= tramos[indice].minimo;
    });

    sueltos = sueltos.filter((indice) => !cortos.includes(indice));

    /* Sólo quedaban cortos: lo que sobra se va al último tramo. */
    if (sueltos.length === 0) {
      if (restante > 0 && medidas.length) medidas[medidas.length - 1] += restante;

      return medidas;
    }
  }

  return medidas;
}

/* ------------------------------------------------------------------ */
/*  CONSTRUCCIÓN                                                       */
/* ------------------------------------------------------------------ */

/**
 * El desplazamiento que se ve al abrir un partido que todavía no se ha tocado.
 *
 * No se guarda: se deriva del calendario cada vez, y sólo pasa a existir de
 * verdad en cuanto alguien escribe algo. Por eso puede permitirse traer ya el
 * viaje montado —dos días fuera de casa, uno en casa— en lugar de dejar la
 * pantalla en blanco: lo que se ve es una propuesta, no trabajo que haya que
 * deshacer.
 */
export function viajeVacio(
  partidoId: string,
  datos: {
    rival: string;
    jornada?: string;
    rivalId?: string;
    fecha: string;
    hora: string;
    condicion: "local" | "visitante";
    competicion?: string;
  },
): Desplazamiento {
  const base: Desplazamiento = {
    partidoId,
    rival: datos.rival,
    jornada: datos.jornada ?? "",
    ...(datos.rivalId ? { rivalId: datos.rivalId } : {}),
    fecha: datos.fecha,
    hora: datos.hora,
    condicion: datos.condicion,
    competicion: datos.competicion ?? "",
    origen: "Valdebebas",
    conHotel: datos.condicion === "visitante",
    estadio: {
      nombre: "",
      ciudad: "",
      superficie: "Natural",
      dimensiones: "",
      direccion: "",
      distancia: "",
      tiempo: "",
      enlace: "",
    },
    hotel: {
      nombre: "",
      direccion: "",
      telefono: "",
      enlace: "",
      distancia: "",
      tiempo: "",
      entrada: "",
    },
    dias: [],
    avisos: [],
  };

  /*
  | Fuera de casa el viaje **abre ya con dos días**: la víspera y el partido.
  | Es lo que pasa de verdad casi todas las jornadas —se sale por la tarde, se
  | duerme en el hotel y se juega al día siguiente—, y abrir con un solo día
  | obligaba a acordarse de añadir el otro cada semana. En casa se abre con
  | uno, que es lo que hay. Si un viaje se hace en la jornada, la plantilla
  | «Ida y vuelta en el día» lo deja en uno de un clic.
  */
  const plantilla = PLANTILLAS_VIAJE.find((item) =>
    datos.condicion === "local" ? item.key === "casa" : item.key === "dos-dias",
  );

  return { ...base, dias: plantilla ? diasDePlantillaViaje(plantilla, base) : [] };
}

/**
 * Trae del desplazamiento anterior lo que se repite semana a semana.
 *
 * **No se copia el destino**: otro rival es otro estadio y otro hotel, y
 * arrastrarlos sería la forma más rápida de mandar al equipo a la ciudad
 * equivocada. Lo que sí se repite es la rutina —de dónde sale el autobús, qué
 * hay que recordar y, sobre todo, el reparto del día—, así que el horario se
 * trae **reanclado a la nueva hora del partido**: si el anterior era a las
 * 21:15 y éste a las 18:00, el día entero se adelanta tres horas y cuarto y
 * los desfases se conservan, que es lo que de verdad se estaba copiando.
 *
 * Con el viaje repartido en varios días se copian **todos**, cada uno a su
 * sitio del nuevo calendario: si el anterior salía la víspera, éste también.
 * Y sólo se reancla el día del partido: la víspera va por reloj —el autobús
 * sale a las cuatro y se cena a las nueve— y adelantarla tres horas porque el
 * saque inicial se ha movido sacaría al equipo del hotel de madrugada.
 */
export function copiaViaje(
  origen: Desplazamiento,
  destino: Desplazamiento,
): Desplazamiento {
  const antes = aMinutos(origen.hora);
  const ahora = aMinutos(destino.hora);

  const salto = antes !== null && ahora !== null ? ahora - antes : 0;

  const saltoDias = diasEntre(origen.fecha, destino.fecha);

  const dias = origen.dias.map((dia) =>
    conCitas(
      {
        ...dia,
        id: nuevoId("DIA"),
        fecha: sumaDias(dia.fecha, saltoDias),
        citas: [],
      },
      clonaCitas(dia.citas, dia.fecha === origen.fecha ? salto : 0),
    ),
  );

  return {
    ...destino,
    origen: origen.origen,
    avisos: [...origen.avisos],
    dias: dias.length ? dias : destino.dias,
  };
}

/* ------------------------------------------------------------------ */
/*  FECHAS                                                             */
/* ------------------------------------------------------------------ */

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Lee una fecha sin zona horaria.
 *
 * `new Date("2026-08-31")` es medianoche **UTC**, que en España es el día 31 a
 * las dos de la madrugada… o el 30 a las diez de la noche según el mes. La
 * hoja escribe días, no instantes: se construye la fecha a mano.
 */
export function leeFecha(iso: string) {
  const trozos = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!trozos) return null;

  const fecha = new Date(
    Number(trozos[1]),
    Number(trozos[2]) - 1,
    Number(trozos[3]),
  );

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Escribe una fecha como la guarda el documento: `yyyy-mm-dd`. */
export function comoIso(fecha: Date) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * La fecha de `n` días después. Admite negativos: `-1` es la víspera.
 *
 * Va por `setDate`, que es lo único que respeta los cambios de hora: sumarle
 * 86 400 000 milisegundos al último domingo de octubre devuelve el mismo día.
 */
export function sumaDias(iso: string, n: number) {
  const fecha = leeFecha(iso);

  if (!fecha) return iso;

  fecha.setDate(fecha.getDate() + n);

  return comoIso(fecha);
}

/** Cuántos días hay de `iso` a `hasta`. La víspera del partido devuelve 1. */
export function diasEntre(iso: string, hasta: string) {
  const a = leeFecha(iso);
  const b = leeFecha(hasta);

  if (!a || !b) return 0;

  /* Al mediodía: así ningún cambio de hora deja la resta en 23 h y se pierde
     un día por el redondeo. */
  a.setHours(12, 0, 0, 0);
  b.setHours(12, 0, 0, 0);

  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** "LUNES 31", el rótulo del día que llevaba el horario original. */
export function diaCorto(iso: string) {
  const fecha = leeFecha(iso);

  if (!fecha) return "";

  return `${DIAS[fecha.getDay()]} ${fecha.getDate()}`.toUpperCase();
}

/** "Lunes 31 de agosto de 2026". */
export function diaLargo(iso: string) {
  const fecha = leeFecha(iso);

  if (!fecha) return "";

  const dia = DIAS[fecha.getDay()];

  return `${dia[0].toUpperCase()}${dia.slice(1)} ${fecha.getDate()} de ${
    MESES[fecha.getMonth()]
  } de ${fecha.getFullYear()}`;
}

/** El día de después, para las citas de madrugada. */
export function diaSiguienteCorto(iso: string) {
  const fecha = leeFecha(iso);

  if (!fecha) return "";

  fecha.setDate(fecha.getDate() + 1);

  return `${DIAS[fecha.getDay()]} ${fecha.getDate()}`.toUpperCase();
}
