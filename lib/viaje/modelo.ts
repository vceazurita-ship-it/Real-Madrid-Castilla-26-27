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

/** "+1 h 45" para un desfase; sirve para explicar una plantilla. */
export function comoDesfase(minutos: number) {
  const signo = minutos < 0 ? "−" : "+";
  const total = Math.abs(minutos);
  const h = Math.floor(total / 60);
  const m = total % 60;

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
  horario: {
    /** Primera y última media hora de la columna, en minutos. */
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
  const minuto = aMinutos(datos.hora) ?? 20 * 60;

  const plantilla =
    datos.condicion === "local"
      ? PLANTILLA_HORARIO_BY_KEY.get("local")!
      : PLANTILLA_HORARIO_BY_KEY.get("visitante-largo")!;

  const horario = horarioDePlantilla(plantilla, minuto);

  return {
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
    horario,
    avisos: [],
  };
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
 */
export function copiaViaje(
  origen: Desplazamiento,
  destino: Desplazamiento,
): Desplazamiento {
  const antes = aMinutos(origen.hora);
  const ahora = aMinutos(destino.hora);

  const salto = antes !== null && ahora !== null ? ahora - antes : 0;

  const citas = origen.horario.citas.map((cita) => ({
    ...cita,
    id: nuevoId("CI"),
    minuto: Math.max(0, cita.minuto + salto),
  }));

  return {
    ...destino,
    origen: origen.origen,
    avisos: [...origen.avisos],
    horario: { citas: ordenaCitas(citas), ...margenesDe(citas) },
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
