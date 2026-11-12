/*
|--------------------------------------------------------------------------
| LA REVISIÓN DEL HORARIO (12/11/2026, revisión de los expertos)
|--------------------------------------------------------------------------
|
| Lo que no cuadra en el horario de un desplazamiento, ya con su arreglo:
|
| - Los GRAVES (dos partidos, el partido fuera de su día, la vuelta a
|   Valdebebas antes del partido) van en rojo y arriba.
| - Los trayectos se cotejan con lo que DURA ese trayecto —la duración de la
|   salida (calculada, de la memoria o escrita a mano), el «Tiempo al campo»
|   del hotel o el «Tiempo de viaje» del estadio—. Sin dato con el que
|   comparar no se avisa: el umbral fijo de 30 minutos daba avisos falsos
|   (hotel → estadio en 15 minutos es lo normal).
| - Las erratas de las citas se buscan comparando cada palabra con las de la
|   paleta («LLEHAGDA» → «llegada») y se proponen corregidas.
|
| Nada de esto escribe: los arreglos son funciones que devuelven los días
| nuevos, y los aplica el analista con su botón.
*/

import {
  EVENTOS_PALETA,
  aHora,
  aMinutos,
  diaCorto,
  diasEntre,
  nuevoId,
  esLlegada,
  esSalida,
  leeDuracion,
  medioDeCita,
  type CitaHorario,
  type DiaViaje,
  type Desplazamiento,
} from "@/lib/viaje/modelo";

/** Una línea de un aviso, atada a su cita: «Ver» abre el día y la enfoca. */
export type LineaAviso = {
  texto: string;
  diaId: string;
  citaId: string;
  /** La cita escrita bien, si se puede proponer. */
  corregido?: string;
};

export type AvisoHorario = {
  clave: string;
  /** Rojo y arriba: el horario no se puede dar por bueno así. */
  grave: boolean;
  texto: string;
  /** Adónde lleva «Ver», cuando el aviso es de una sola cita. */
  diaId?: string;
  citaId?: string;
  lineas?: LineaAviso[];
  /** El arreglo de un clic: lo que dice el botón y los días como quedarían. */
  arreglo?: ArregloHorario;
  /** Otra salida, menor (va como enlace al lado del botón): «o convertirlo en víspera». */
  otroArreglo?: ArregloHorario;
};

export type ArregloHorario = { rotulo: string; hecho: string; dias: (viaje: Desplazamiento) => DiaViaje[] };

/* ------------------------------------------------------------------ */
/*  LA COMPETICIÓN                                                     */
/* ------------------------------------------------------------------ */

/** La liga del Castilla: lo que el calendario llama «Jornada 12» es un partido de esta competición. */
export const COMPETICION_LIGA = "Primera Federación";

/**
 * La competición que se enseña (12/11/2026): el calendario la daba como
 * «Jornada 12», que es la jornada —ya tiene su campo— y no la competición.
 * Para mostrar; lo guardado no cambia hasta que se escribe encima.
 */
export function comoCompeticion(texto: string | undefined) {
  const limpio = (texto ?? "").trim();

  return /^jornada\s*\d+$/i.test(limpio) ? COMPETICION_LIGA : limpio;
}

/* ------------------------------------------------------------------ */
/*  MAYÚSCULAS                                                         */
/* ------------------------------------------------------------------ */

const sinTildes = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Siglas y marcas que se escriben en mayúsculas aunque la cita se normalice. */
const SIGLAS = new Set(["ave", "avlo", "iryo", "ouigo", "renfe", "dni", "rmcf", "md", "ok", "gps", "bbva"]);

/** Los sitios de siempre: van con mayúscula inicial. */
const LUGARES = ["Valdebebas", "Atocha", "Barajas", "Chamartín", "Madrid", "Castilla"];

/** Los nombres propios del viaje (rival, estadio, ciudad, hotel, salida), para no ponerlos en minúscula. */
export function propiosDelViaje(viaje: Pick<Desplazamiento, "rival" | "origen" | "estadio" | "hotel">) {
  const fuentes = [viaje.rival, viaje.origen, viaje.estadio.nombre, viaje.estadio.ciudad, viaje.hotel.nombre, ...LUGARES];
  const propios = new Set<string>();

  for (const fuente of fuentes) {
    for (const palabra of (fuente ?? "").split(/[^\p{L}]+/u)) {
      /* «Hotel», «Estadio»: palabras del horario, no nombres («CENA HOTEL» → «Cena hotel»). */
      if (palabra.length >= 3 && !VOCABULARIO.has(sinTildes(palabra))) propios.add(sinTildes(palabra));
    }
  }

  return propios;
}

/**
 * La cita con mayúscula sólo al principio (12/11/2026): en la misma hoja se
 * mezclaban «SALIDA BUS ESTADIO», «Salida hacia el estadio» y «Salida bus
 * LAVANDERÍA». Sólo se tocan las palabras escritas ENTERAS en mayúsculas;
 * las siglas (IRYO, AVE) se quedan y los nombres propios del viaje van con
 * mayúscula inicial. Es para mostrar: lo guardado no cambia.
 */
export function comoFrase(texto: string, propios: Set<string> = new Set()) {
  const partes = texto.split(/(\s+)/);

  const hechas = partes.map((parte) => {
    const letras = parte.replace(/[^\p{L}]/gu, "");

    if (letras.length < 2 || letras !== letras.toUpperCase() || letras === letras.toLowerCase()) return parte;

    const clave = sinTildes(letras);

    if (SIGLAS.has(clave)) return parte;

    const baja = parte.toLowerCase();

    if (propios.has(clave) || LUGARES.some((lugar) => sinTildes(lugar) === clave)) {
      return baja.replace(/\p{L}/u, (letra) => letra.toUpperCase());
    }

    return baja;
  });

  const junto = hechas.join("");

  return junto.replace(/\p{L}/u, (letra) => letra.toUpperCase());
}

/* ------------------------------------------------------------------ */
/*  ERRATAS                                                            */
/* ------------------------------------------------------------------ */

/** Las palabras que se escriben en un horario: las de la paleta y las de siempre. */
const VOCABULARIO = new Set(
  [
    ...EVENTOS_PALETA.flatMap((evento) => evento.texto.split(/\s+/)),
    "salida", "llegada", "tren", "autobus", "avion", "vuelo", "estadio", "campo", "hotel", "comida", "cena",
    "desayuno", "merienda", "picnic", "charla", "calentamiento", "partido", "descanso", "habitaciones",
    "habitacion", "aproximada", "aproximado", "estacion", "aeropuerto", "residencia", "entrega", "recoger",
    "lavanderia", "vestuario", "vestuarios", "activacion", "paseo", "video", "reunion", "tecnica", "tactica",
    "recuperacion", "hacia", "entrenamiento", "prensa", "masaje", "embarque", "facturacion", "traslado",
    "regreso", "vuelta", "maletas", "equipaje", "material", "utileria", "estiramientos", "comedor", "salon",
    "llegadas", "salidas", "puerta", "andén", "anden", "terminal", "recogida", "cuerpo", "jugadores",
  ].map((palabra) => sinTildes(palabra)).filter((palabra) => palabra.length >= 4),
);

/** Distancia de edición con trasposiciones (Damerau, versión OSA): «llehagda» y «llegada» están a 2. */
function distancia(a: string, b: string) {
  const filas = a.length + 1;
  const columnas = b.length + 1;
  const d: number[][] = Array.from({ length: filas }, (_, i) => Array.from({ length: columnas }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));

  for (let i = 1; i < filas; i += 1) {
    for (let j = 1; j < columnas; j += 1) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;

      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + coste);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[a.length][b.length];
}

/** La palabra bien escrita, con las mayúsculas de la que corrige. */
function conSuForma(original: string, buena: string) {
  if (original === original.toUpperCase()) return buena.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) return buena[0].toUpperCase() + buena.slice(1);

  return buena;
}

/**
 * La cita sin erratas, o `null` si no se le ve ninguna. Sólo se proponen
 * palabras de cinco letras o más que se parezcan mucho a una del vocabulario
 * (a una letra, o a dos si es larga) y que no sean nombres propios del viaje.
 */
export function corrigeCita(texto: string, propios: Set<string> = new Set()): string | null {
  let cambiado = false;

  const partes = texto.split(/(\s+)/).map((parte) => {
    const letras = parte.replace(/[^\p{L}]/gu, "");
    const clave = sinTildes(letras);

    if (clave.length < 5 || VOCABULARIO.has(clave) || propios.has(clave) || SIGLAS.has(clave)) return parte;

    const tope = clave.length >= 7 ? 2 : 1;
    let mejor: { palabra: string; d: number } | null = null;

    for (const palabra of VOCABULARIO) {
      if (Math.abs(palabra.length - clave.length) > tope) continue;

      const d = distancia(clave, palabra);

      if (d <= tope && (!mejor || d < mejor.d)) mejor = { palabra, d };
    }

    if (!mejor) return parte;

    /* La palabra con tilde, como está en la paleta, si la tiene. */
    const conTilde =
      EVENTOS_PALETA.flatMap((evento) => evento.texto.split(/\s+/)).find((p) => sinTildes(p) === mejor.palabra)?.toLowerCase() ??
      mejor.palabra;

    cambiado = true;

    return parte.replace(letras, conSuForma(letras, conTilde));
  });

  return cambiado ? partes.join("") : null;
}

/**
 * El nombre del rival como lo escribe el calendario (12/11/2026, expertos):
 * «Partido Gimnastic Tarragona» frente a «Gimnàstic de Tarragona» de
 * BeSoccer. Cada palabra de la cita que sea la del nombre oficial sin su
 * tilde, o a una letra de ella (siete letras o más), se propone escrita como
 * allí. Devuelve `null` si no hay nada que cambiar.
 */
export function corrigeRival(texto: string, nombres: string[]): string | null {
  const oficiales = new Map<string, string>();

  for (const nombre of nombres) {
    for (const palabra of (nombre ?? "").split(/[^\p{L}]+/u)) {
      if (palabra.length >= 4 && !VOCABULARIO.has(sinTildes(palabra))) oficiales.set(sinTildes(palabra), palabra);
    }
  }

  if (oficiales.size === 0) return null;

  let cambiado = false;

  const partes = texto.split(/(\s+)/).map((parte) => {
    const letras = parte.replace(/[^\p{L}]/gu, "");
    const clave = sinTildes(letras);

    if (clave.length < 4 || VOCABULARIO.has(clave) || SIGLAS.has(clave)) return parte;

    let buena = oficiales.get(clave);

    if (!buena && clave.length >= 7) {
      for (const [oficial, escrita] of oficiales) {
        if (Math.abs(oficial.length - clave.length) <= 1 && distancia(clave, oficial) === 1) {
          buena = escrita;
          break;
        }
      }
    }

    /* Igual salvo mayúsculas: no es errata, es la forma de escribir la cita. */
    if (!buena || buena.toLowerCase() === letras.toLowerCase()) return parte;

    cambiado = true;

    /* En mayúsculas se queda en mayúsculas («GIMNÀSTIC»); si no, como el nombre oficial. */
    return parte.replace(letras, letras === letras.toUpperCase() ? buena.toUpperCase() : buena);
  });

  return cambiado ? partes.join("") : null;
}

/* ------------------------------------------------------------------ */
/*  EL DÍA DE PARTIDO COPIADO                                          */
/* ------------------------------------------------------------------ */

/**
 * Las citas que sólo tiene el día de partido (12/11/2026, expertos): al
 * duplicar el día del partido para montar la víspera se quedaban la charla,
 * la salida al estadio, la llegada al campo, el calentamiento y el partido.
 */
const SECUENCIA_PARTIDO: { clave: string; es: (cita: CitaHorario) => boolean }[] = [
  { clave: "charla", es: (c) => c.clase === "charla" || /^\s*charla\b/i.test(c.texto) },
  { clave: "salida-estadio", es: (c) => c.clase === "salida-estadio" || /salida.*\b(estadio|campo)\b/i.test(c.texto) },
  { clave: "llegada-campo", es: (c) => c.clase === "llegada-campo" || /llegada.*\b(estadio|campo)\b/i.test(c.texto) },
  { clave: "calentamiento", es: (c) => c.clase === "calentamiento" || /calentamiento/i.test(c.texto) },
  { clave: "partido", es: (c) => c.tipo === "partido" || /^\s*partido\b/i.test(c.texto) },
];

const deLaSecuencia = (cita: CitaHorario) => SECUENCIA_PARTIDO.find((paso) => paso.es(cita))?.clave ?? null;

/** Si el día lleva el partido y al menos tres pasos más de la secuencia, sus citas de partido; si no, ninguna. */
function citasDePartidoCopiadas(dia: DiaViaje): CitaHorario[] {
  const pasos = new Set(dia.citas.map(deLaSecuencia).filter((clave): clave is string => clave !== null));

  if (!pasos.has("partido") || pasos.size < 4) return [];

  return dia.citas.filter((cita) => deLaSecuencia(cita) !== null);
}

/* ------------------------------------------------------------------ */
/*  TRAYECTOS                                                          */
/* ------------------------------------------------------------------ */

/** «15 min», «1 h 20», «3h40», «25'» → minutos. */
export function leeTiempo(texto: string | undefined): number | null {
  const limpio = (texto ?? "")
    .toLowerCase()
    .replace(/aprox\.?|aproximadamente|unos|unas|~|'/g, "")
    .replace(/horas?/g, "h")
    .replace(/minutos?|mins?/g, "min")
    .trim();

  if (!limpio) return null;

  const solo = limpio.match(/^(\d{1,2})\s*h$/);

  if (solo) return Number(solo[1]) * 60;

  const minutos = leeDuracion(limpio);

  return minutos && minutos > 0 ? minutos : null;
}

const FUENTE_DURACION: Record<NonNullable<CitaHorario["duracionFuente"]>, string> = {
  osrm: "la ruta calculada",
  memoria: "la memoria de trayectos",
  manual: "la duración escrita en la salida",
};

/** Lo que dura de verdad el trayecto de esta salida, y de dónde sale ese dato. */
function duracionEsperada(salida: CitaHorario, llegada: CitaHorario, viaje: Desplazamiento): { minutos: number; fuente: string } | null {
  if (salida.duracion && salida.duracion > 0) {
    return { minutos: salida.duracion, fuente: FUENTE_DURACION[salida.duracionFuente ?? "osrm"] ?? "la duración de la salida" };
  }

  const alCampo =
    salida.hasta === "estadio" ||
    salida.clase === "salida-estadio" ||
    llegada.clase === "llegada-campo" ||
    /(estadio|campo)/i.test(llegada.texto);

  const desdeHotel = salida.desde === "hotel" || salida.clase === "salida-estadio" || (!salida.desde && viaje.conHotel);

  if (alCampo && desdeHotel && viaje.conHotel) {
    const minutos = leeTiempo(viaje.hotel.tiempo);

    if (minutos) return { minutos, fuente: "«Tiempo al campo» del hotel" };
  }

  if (alCampo && !viaje.conHotel) {
    const minutos = leeTiempo(viaje.estadio.tiempo);

    if (minutos) return { minutos, fuente: "«Tiempo de viaje» del estadio" };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  LOS AVISOS                                                         */
/* ------------------------------------------------------------------ */

const esPartido = (cita: Pick<CitaHorario, "tipo" | "texto">) => cita.tipo === "partido" || /^\s*partido\b/i.test(cita.texto);

/**
 * `nombres`: cómo llama al rival el calendario de BeSoccer, para corregir
 * su nombre en las citas. El de la ficha (`viaje.rival`) entra siempre.
 */
export function avisosHorario(viaje: Desplazamiento, nombres: string[] = []): AvisoHorario[] {
  const avisos: AvisoHorario[] = [];
  const propios = propiosDelViaje(viaje);
  const frase = (texto: string) => comoFrase(texto, propios);
  const dia = (fecha: string) => diaCorto(fecha).toLowerCase();

  const partidos = viaje.dias.flatMap((d) => d.citas.filter(esPartido).map((cita) => ({ dia: d, cita })));

  /*
  | 0. Un día que no es el del partido con la secuencia del partido
  | (12/11/2026, expertos): un solo aviso con todas sus citas y dos salidas,
  | quitarlas o dejar el día como víspera. Sustituye al de «dos partidos»
  | cuando el partido de más es el de ese día.
  */
  const copiados = viaje.fecha
    ? viaje.dias
        .filter((d) => d.fecha && d.fecha !== viaje.fecha)
        .map((d) => ({ dia: d, citas: citasDePartidoCopiadas(d) }))
        .filter((c) => c.citas.length > 0)
    : [];

  for (const { dia: copiado, citas } of copiados) {
    const nombreDia = dia(copiado.fecha);
    const ids = new Set(citas.map((c) => c.id));
    const esVispera = diasEntre(copiado.fecha, viaje.fecha) === 1;
    const n = citas.length;

    avisos.push({
      clave: `dia-copiado-${copiado.id}`,
      grave: true,
      texto: `El ${nombreDia} es un día de partido copiado: lleva ${n} citas del día del partido.`,
      lineas: [...citas]
        .sort((a, b) => a.minuto - b.minuto)
        .map((c) => ({ texto: `${aHora(c.minuto)} · ${frase(c.texto)}`, diaId: copiado.id, citaId: c.id })),
      arreglo: {
        rotulo: `Quitar estas ${n} citas`,
        hecho: `Quitadas ${n} citas del ${nombreDia}`,
        dias: (actual) => actual.dias.map((d) => (d.id === copiado.id ? { ...d, citas: d.citas.filter((c) => !ids.has(c.id)) } : d)),
      },
      ...(esVispera
        ? {
            otroArreglo: {
              rotulo: "convertirlo en víspera",
              hecho: `El ${nombreDia} queda como víspera`,
              /* La víspera se queda la charla y lleva cena; sale lo que es del partido. */
              dias: (actual: Desplazamiento) =>
                actual.dias.map((d) => {
                  if (d.id !== copiado.id) return d;

                  const quedan = d.citas.filter((c) => !ids.has(c.id) || deLaSecuencia(c) === "charla");
                  const conCena: CitaHorario[] = quedan.some((c) => c.clase === "cena" || /^\s*cena\b/i.test(c.texto))
                    ? quedan
                    : [...quedan, { id: nuevoId("CI"), minuto: 21 * 60, texto: "Cena", tipo: "comida", emoji: "🍽️", clase: "cena" }];

                  return {
                    ...d,
                    titulo: /v[íi]spera/i.test(d.titulo) ? d.titulo : "Víspera",
                    citas: [...conCena].sort((a, b) => a.minuto - b.minuto),
                  };
                }),
            },
          }
        : {}),
    });
  }

  const fechasCopiadas = new Set(copiados.map((c) => c.dia.fecha));
  const sobranTodosCopiados =
    Boolean(viaje.fecha) &&
    partidos.some((p) => p.dia.fecha === viaje.fecha) &&
    partidos.filter((p) => p.dia.fecha !== viaje.fecha).every((p) => fechasCopiadas.has(p.dia.fecha));

  /* 1. Dos partidos: se queda el del día del partido; el otro se quita con un botón. */
  if (partidos.length > 1 && !sobranTodosCopiados) {
    const sobran = viaje.fecha ? partidos.filter((p) => p.dia.fecha !== viaje.fecha) : [];
    const diasQueSobran = [...new Set(sobran.map((p) => p.dia.fecha))];
    const diasSobran = diasQueSobran.map(dia).join(" y ");

    avisos.push({
      clave: "dos-partidos",
      grave: true,
      texto: `Hay ${partidos.length} partidos en el horario (${[...new Set(partidos.map((p) => dia(p.dia.fecha)))].join(" y ")})${
        viaje.fecha ? `: el partido es el ${dia(viaje.fecha)}` : ""
      }.`,
      lineas: partidos.map((p) => ({ texto: `${dia(p.dia.fecha)} ${aHora(p.cita.minuto)} · ${frase(p.cita.texto)}`, diaId: p.dia.id, citaId: p.cita.id })),
      ...(sobran.length > 0 && sobran.length < partidos.length
        ? {
            arreglo: {
              rotulo: `Quitar el del ${diasSobran}`,
              hecho: `Quitado el partido del ${diasSobran}`,
              dias: (actual: Desplazamiento) =>
                actual.dias.map((d) => (d.fecha === actual.fecha ? d : { ...d, citas: d.citas.filter((c) => !esPartido(c)) })),
            },
          }
        : {}),
    });
  }

  /* 2. El partido en otro día. */
  if (viaje.fecha && partidos.length > 0 && !partidos.some((p) => p.dia.fecha === viaje.fecha)) {
    avisos.push({
      clave: "partido-fuera-de-dia",
      grave: true,
      texto: `El partido no está en su día (${dia(viaje.fecha)}).`,
      diaId: partidos[0].dia.id,
      citaId: partidos[0].cita.id,
    });
  }

  /* 3. La vuelta a Valdebebas antes del partido. */
  const diaPartido = viaje.dias.find((d) => d.fecha === viaje.fecha);
  const minutoPartido = viaje.hora ? aMinutos(viaje.hora) : null;

  /* En casa, llegar a Valdebebas antes del partido es lo normal. */
  if (viaje.condicion !== "local" && diaPartido && minutoPartido != null) {
    const vueltaAntes = diaPartido.citas.find((c) => /llegada.*valdebebas/i.test(c.texto) && c.minuto < minutoPartido);

    if (vueltaAntes) {
      avisos.push({
        clave: "vuelta-antes",
        grave: true,
        texto: `«${frase(vueltaAntes.texto)}» está a las ${aHora(vueltaAntes.minuto)} del ${dia(diaPartido.fecha)}, antes del partido de las ${viaje.hora}.`,
        diaId: diaPartido.id,
        citaId: vueltaAntes.id,
      });
    }
  }

  /* 4. Trayectos que no dan tiempo, cotejados con lo que dura cada uno. */
  const cortos: LineaAviso[] = [];

  for (const d of viaje.dias) {
    const orden = [...d.citas].sort((a, b) => a.minuto - b.minuto);

    orden.forEach((cita, i) => {
      if (!esLlegada(cita) || i === 0) return;

      const salida = [...orden.slice(0, i)].reverse().find((c) => esSalida(c) || /^salida\b/i.test(c.texto.trim()));

      if (!salida) return;

      const hay = cita.minuto - salida.minuto;
      const esperada = duracionEsperada(salida, cita, viaje);
      const medio = medioDeCita(salida);

      if (esperada) {
        const margen = Math.max(10, Math.round(esperada.minutos * 0.25));

        if (hay < esperada.minutos - margen) {
          cortos.push({
            texto: `${dia(d.fecha)}: «${frase(salida.texto)}» ${aHora(salida.minuto)} y «${frase(cita.texto)}» ${aHora(cita.minuto)} son ${hay} min; según ${esperada.fuente}, el trayecto dura ${esperada.minutos} min.`,
            diaId: d.id,
            citaId: cita.id,
          });
        }

        return;
      }

      /* Sin dato con el que comparar sólo se avisa de lo imposible: un tren o un avión de menos de 20 minutos. */
      if ((medio === "tren" || medio === "avion") && hay < 20) {
        cortos.push({
          texto: `${dia(d.fecha)}: «${frase(salida.texto)}» ${aHora(salida.minuto)} y «${frase(cita.texto)}» ${aHora(cita.minuto)}: ¿un ${medio === "tren" ? "tren" : "vuelo"} de ${hay} min?`,
          diaId: d.id,
          citaId: cita.id,
        });
      }
    });
  }

  if (cortos.length === 1) {
    avisos.push({ clave: "trayecto", grave: false, texto: cortos[0].texto, diaId: cortos[0].diaId, citaId: cortos[0].citaId });
  } else if (cortos.length > 1) {
    avisos.push({ clave: "trayectos", grave: false, texto: `${cortos.length} trayectos no dan tiempo:`, lineas: cortos });
  }

  /* 5. Erratas en las citas, con la propuesta. */
  const erratas: LineaAviso[] = [];

  const nombresRival = [viaje.rival, ...nombres].filter((n) => n && n.trim());

  for (const d of viaje.dias) {
    for (const cita of d.citas) {
      const sinErratas = corrigeCita(cita.texto, propios);
      const bien = corrigeRival(sinErratas ?? cita.texto, nombresRival) ?? sinErratas;

      if (bien) erratas.push({ texto: `«${cita.texto}» → «${frase(bien)}»`, diaId: d.id, citaId: cita.id, corregido: frase(bien) });
    }
  }

  if (erratas.length > 0) {
    avisos.push({
      clave: "erratas",
      grave: false,
      texto: erratas.length === 1 ? "Una cita parece mal escrita:" : `${erratas.length} citas parecen mal escritas:`,
      lineas: erratas,
    });
  }

  return avisos;
}
