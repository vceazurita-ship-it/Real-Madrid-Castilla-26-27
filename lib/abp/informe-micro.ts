/**
 * EL INFORME DE BALÓN PARADO DE UN MICROCICLO.
 *
 * Reúne en una hoja lo que hasta ahora había que ir a buscar a cuatro sitios:
 * qué se trabajó de ABP esa semana, cómo se valoró, a qué jugadores se les hizo
 * seguimiento de balón parado y qué dice el dato del equipo. Se manda por
 * correo desde la cuenta del club (`lib/correo/gmail.ts`) y **se puede mirar en
 * pantalla sin mandarlo**, que es lo que se hace casi siempre.
 *
 * Tres decisiones que explican cómo está hecho:
 *
 * 1. **Aquí no se baja nada.** Todo llega ya cargado desde la pantalla del
 *    microciclo, que es donde ya están el plan, la hoja de registro, las hojas
 *    de competición y el seguimiento. Volver a pedirlos en el servidor sería
 *    pagar otra vez una espera que en frío pasa de medio minuto.
 * 2. **Primero un modelo, después el papel.** `construyeInforme` decide qué se
 *    cuenta; `informeHtml` e `informeTexto` sólo lo escriben. Así la vista
 *    previa de la pantalla y el correo no pueden decir cosas distintas.
 * 3. **Lo estimado se dice.** El seguimiento individual no tiene casilla de
 *    ABP: se reconoce por lo que está escrito en los objetivos y el feedback
 *    (`textoEsAbp`). El informe lo avisa donde se lee, no en una nota al pie.
 *
 * El correo se escribe con tablas y estilos en línea a posta: Gmail y Outlook
 * tiran las hojas de estilo, y un informe que llega sin formato no lo lee
 * nadie.
 */

import {
  ASPECTOS,
  DIAS,
  LADO_LABEL,
  MEDIO_LABEL,
  MOMENTO_LABEL,
  ROL_LABEL,
  cargaCognitiva,
  cargaCondicional,
  cargaEsReal,
  fmtMin,
  normalizaTrabajo,
  type AbpLado,
  type DiaKey,
  type TotalesPlan,
  type Trabajo,
} from "./microciclo";

import { hayEvaluacion, textoEsAbp, type RegistroTarea } from "./registro";

import type { FilaCruce } from "./transferencia";

import type { ComparativaAbp, GraficoInforme } from "./informe-graficos";

/* ------------------------------------------------------------------ */
/*  LO QUE RECIBE                                                      */
/* ------------------------------------------------------------------ */

/** Una fila del seguimiento individual, como la manda la hoja. */
export type SeguimientoFila = {
  ID_JUGADOR?: string;
  NOMBRE?: string;
  FECHA?: string;
  OBJETIVO_OFENSIVO?: string;
  OBJETIVO_DEFENSIVO?: string;
  OBJETIVO_MENTAL?: string;
  FEEDBACK?: string;
  QUIEN?: string;
  MODALIDAD?: string;
  MOMENTO?: string;
  ESTRATEGIA?: string;
};

export type DatosInforme = {
  temporada: string;
  micro: number;
  rival: string;
  /** El partido con el que se mide la semana, si se ha podido cruzar. */
  partido: { jornada: string; rival: string } | null;
  /** Los trabajos planificados, día a día. */
  entradas: { dia: DiaKey; trabajo: Trabajo }[];
  totales: TotalesPlan;
  /** Las tareas de ABP de ese microciclo en la hoja de registro. */
  tareas: RegistroTarea[];
  /** El seguimiento individual entero: aquí se filtra por fecha y por ABP. */
  seguimientos: SeguimientoFila[];
  /** Para poner nombre a un `ID_JUGADOR`. */
  nombrePorId?: Map<string, string>;
  /** El cruce de la temporada, aspecto por aspecto. */
  filas: FilaCruce[];
  /** Las cinco urgencias de arriba, ya ordenadas. */
  prioridades: FilaCruce[];
  /**
   * Con quién nos comparamos: la categoría de este año y nosotros mismos en las
   * temporadas anteriores, a estas alturas. Sale de
   * `/api/data-analisis?abpInforme=1`; sin ella el informe se monta igual, sólo
   * que sin la parte de comparación.
   */
  comparativa?: ComparativaAbp | null;
  /** Los gráficos ya dibujados (`lib/abp/informe-graficos.ts`). */
  graficos?: GraficoInforme[];
  /** Para poder fijar la fecha en las pruebas. */
  generado?: Date;
};

/* ------------------------------------------------------------------ */
/*  FECHAS                                                             */
/* ------------------------------------------------------------------ */

/**
 * La fecha de una fila del registro, que viene como la escribió la hoja.
 *
 * Se aceptan «12/09/2026» y «2026-09-12». Lo que no se entienda no se usa: una
 * fecha inventada movería el rango de la semana y con él los seguimientos que
 * entran en el informe.
 */
export function leeFecha(valor: string | undefined): Date | null {
  const texto = String(valor ?? "").trim();

  if (!texto) return null;

  const conBarras = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (conBarras) {
    const fecha = new Date(
      Number(conBarras[3]),
      Number(conBarras[2]) - 1,
      Number(conBarras[1]),
    );

    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    const fecha = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  return null;
}

function diaMes(fecha: Date) {
  return fecha.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  EL MODELO                                                          */
/* ------------------------------------------------------------------ */

export type LineaTrabajo = {
  dia: string;
  aspectos: string;
  lados: string;
  momento: string;
  medio: string;
  roles: string;
  minutos: string;
  carga: number;
  cargaCog: number;
  /** La carga viene medida de la hoja, no estimada. */
  medida: boolean;
  notas: string;
};

export type LineaValoracion = {
  tarea: string;
  dia: string;
  fecha: string;
  evaluacion: number;
  analisis: string;
  observaciones: string;
};

export type LineaSeguimiento = {
  jugador: string;
  fecha: string;
  quien: string;
  modalidad: string;
  momento: string;
  estrategia: string;
  objetivo: string;
  feedback: string;
};

export type LineaEquipo = {
  aspecto: string;
  lado: AbpLado;
  acciones: number;
  remates: number;
  goles: number;
  peligro: string;
  minutosTemporada: string;
  urgencia: number | null;
  transferencia: number | null;
};

export type InformeMicro = {
  asunto: string;
  titulo: string;
  subtitulo: string;
  generado: string;
  rango: string;
  partido: string;
  resumen: { rotulo: string; valor: string; pie: string }[];
  trabajos: LineaTrabajo[];
  valoracion: {
    lineas: LineaValoracion[];
    valoradas: number;
    total: number;
    media: number | null;
  };
  seguimiento: {
    lineas: LineaSeguimiento[];
    jugadores: number;
  };
  equipo: LineaEquipo[];
  prioridades: LineaEquipo[];
  /** Cómo estamos contra la categoría y contra nosotros mismos. */
  comparativa: ComparativaInforme | null;
  /** Los gráficos, en el orden en que van en el correo. */
  graficos: GraficoInforme[];
  /** Lo que el informe no sabe, dicho donde se lee. */
  avisos: string[];
};

export type ComparativaInforme = {
  temporada: string;
  jugados: number;
  equipos: number;
  /** Puesto por goles de ABP marcados por partido. */
  puesto: number | null;
  /** Puesto por goles de ABP encajados, del que menos encaja al que más. */
  puestoContra: number | null;
  favorPorPartido: number | null;
  contraPorPartido: number | null;
  medianaFavor: number;
  medianaContra: number;
  temporadas: {
    temporada: string;
    favor: number;
    contra: number;
    esActual: boolean;
  }[];
};

const ASPECTO_LABEL = new Map(ASPECTOS.map((uno) => [uno.key, uno.label]));

const DIA_LABEL = new Map(DIAS.map((uno) => [uno.key, uno.label]));

function listaAspectos(trabajo: Trabajo) {
  return trabajo.aspectos
    .map((clave) => ASPECTO_LABEL.get(clave) ?? clave)
    .join(", ");
}

function filaEquipo(fila: FilaCruce): LineaEquipo {
  return {
    aspecto: fila.aspecto.label,
    lado: fila.lado,
    acciones: fila.stats.acciones,
    remates: fila.stats.remates,
    goles: fila.stats.goles,
    peligro: fila.stats.acciones ? `${fila.stats.peligroPct.toFixed(1)} %` : "—",
    minutosTemporada: fmtMin(fila.minutosTemporada),
    urgencia: fila.urgencia,
    transferencia: fila.transferencia?.delta ?? null,
  };
}

/**
 * Reúne el informe.
 *
 * Nada de lo que hay aquí pide datos: lo que no llegue, no sale, y se dice en
 * `avisos` para que quien lo lea sepa que falta y no que no ha pasado.
 */
export function construyeInforme(datos: DatosInforme): InformeMicro {
  const generado = datos.generado ?? new Date();

  const avisos: string[] = [];

  /* ---------------- la semana, día a día ---------------- */

  const trabajos: LineaTrabajo[] = datos.entradas.map(({ dia, trabajo }) => {
    const limpio = normalizaTrabajo(trabajo);

    return {
      dia: DIA_LABEL.get(dia) ?? dia,
      aspectos: listaAspectos(limpio),
      lados: limpio.lados.map((lado) => LADO_LABEL[lado]).join(" + "),
      momento: MOMENTO_LABEL[limpio.momento],
      medio: MEDIO_LABEL[limpio.medio],
      roles: limpio.roles.map((rol) => ROL_LABEL[rol]).join(", ") || "—",
      minutos: fmtMin(limpio.minutos),
      carga: Math.round(cargaCondicional(limpio)),
      cargaCog: Math.round(cargaCognitiva(limpio)),
      medida: cargaEsReal(limpio),
      notas: String(limpio.notas ?? "").trim(),
    };
  });

  if (trabajos.length === 0) {
    avisos.push(
      "Este microciclo no tiene ningún trabajo de balón parado planificado.",
    );
  }

  /* ---------------- el rango de fechas ---------------- */

  const fechas = datos.tareas
    .map((tarea) => leeFecha(tarea.fecha))
    .filter((fecha): fecha is Date => fecha !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const desde = fechas[0] ?? null;
  const hasta = fechas[fechas.length - 1] ?? null;

  const rango =
    desde && hasta
      ? desde.getTime() === hasta.getTime()
        ? diaMes(desde)
        : `${diaMes(desde)} — ${diaMes(hasta)}`
      : "";

  if (!rango) {
    avisos.push(
      "La hoja de registro no trae fechas de este microciclo, así que el seguimiento de abajo es el de toda la temporada, no el de esta semana.",
    );
  }

  /* ---------------- la valoración registrada ---------------- */

  const valoradas = datos.tareas.filter(hayEvaluacion);

  const conNota = valoradas.filter((tarea) => tarea.evaluacion > 0);

  const media = conNota.length
    ? conNota.reduce((suma, tarea) => suma + tarea.evaluacion, 0) /
      conNota.length
    : null;

  const lineasValoracion: LineaValoracion[] = valoradas.map((tarea) => ({
    tarea: tarea.tarea,
    dia: DIA_LABEL.get(tarea.dia as DiaKey) ?? tarea.dia ?? "",
    fecha: tarea.fecha,
    evaluacion: tarea.evaluacion,
    analisis: tarea.analisisPost,
    observaciones: tarea.observaciones,
  }));

  if (datos.tareas.length > 0 && valoradas.length === 0) {
    avisos.push(
      "Ninguna tarea de ABP de este microciclo está valorada en la hoja de registro.",
    );
  }

  /* ---------------- quién ha llevado seguimiento de ABP ---------------- */

  /*
  | El seguimiento no tiene casilla de «esto es ABP»: se reconoce por lo que
  | está escrito en los objetivos y en el feedback. Es una estimación, y por
  | eso se dice en el propio título de la sección.
  */
  const dentroDelRango = (fecha: Date | null) => {
    if (!desde || !hasta) return true;
    if (!fecha) return false;

    /* El día de cierre entero, no hasta las 00:00. */
    return (
      fecha.getTime() >= desde.getTime() &&
      fecha.getTime() <= hasta.getTime() + 86_399_000
    );
  };

  const deAbp = datos.seguimientos.filter((fila) => {
    if (
      !textoEsAbp(
        fila.OBJETIVO_OFENSIVO,
        fila.OBJETIVO_DEFENSIVO,
        fila.OBJETIVO_MENTAL,
        fila.FEEDBACK,
      )
    ) {
      return false;
    }

    return dentroDelRango(leeFecha(fila.FECHA));
  });

  const lineasSeguimiento: LineaSeguimiento[] = deAbp
    .map((fila) => ({
      jugador:
        datos.nombrePorId?.get(String(fila.ID_JUGADOR ?? "")) ??
        String(fila.NOMBRE ?? fila.ID_JUGADOR ?? "—"),
      fecha: fila.FECHA ?? "",
      quien: fila.QUIEN ?? "",
      modalidad: fila.MODALIDAD ?? "",
      momento: fila.MOMENTO ?? "",
      estrategia: fila.ESTRATEGIA ?? "",
      objetivo: [fila.OBJETIVO_OFENSIVO, fila.OBJETIVO_DEFENSIVO]
        .map((uno) => String(uno ?? "").trim())
        .filter(Boolean)
        .join(" · "),
      feedback: String(fila.FEEDBACK ?? "").trim(),
    }))
    .sort((a, b) => a.jugador.localeCompare(b.jugador, "es"));

  const jugadores = new Set(lineasSeguimiento.map((linea) => linea.jugador)).size;

  if (lineasSeguimiento.length === 0) {
    avisos.push(
      "No hay ningún seguimiento individual que hable de balón parado en estas fechas.",
    );
  }

  /* ---------------- el dato del equipo ---------------- */

  const conMuestra = datos.filas
    .filter((fila) => fila.stats.acciones > 0 || fila.minutosTemporada > 0)
    .sort((a, b) => b.stats.acciones - a.stats.acciones);

  const equipo = conMuestra.map(filaEquipo);

  if (equipo.length === 0) {
    avisos.push(
      "Todavía no hay acciones de balón parado registradas en las hojas de competición.",
    );
  }

  /* ---------------- la cabecera ---------------- */

  const totales = datos.totales;

  const resumen = [
    {
      rotulo: "Minutos de ABP",
      valor: fmtMin(totales.minutos),
      pie: `${totales.trabajos} trabajo${totales.trabajos === 1 ? "" : "s"} en ${totales.diasConAbp} día${totales.diasConAbp === 1 ? "" : "s"}`,
    },
    {
      rotulo: "Ofensivo / defensivo",
      valor: `${fmtMin(totales.porLado.ofensivo)} · ${fmtMin(totales.porLado.defensivo)}`,
      pie: "Reparto por lado",
    },
    {
      rotulo: "Campo / vídeo",
      valor: `${fmtMin(totales.minutosCampo)} · ${fmtMin(totales.minutosVideo)}`,
      pie: "Dónde se trabajó",
    },
    {
      rotulo: "Carga",
      valor: String(Math.round(totales.carga)),
      pie: `Cognitiva ${Math.round(totales.cargaCog)}`,
    },
    {
      rotulo: "Tareas valoradas",
      valor: `${valoradas.length} de ${datos.tareas.length}`,
      pie: media === null ? "Sin nota media" : `Media ${media.toFixed(1)}`,
    },
    {
      rotulo: "Seguimiento de ABP",
      valor: String(lineasSeguimiento.length),
      pie: `${jugadores} jugador${jugadores === 1 ? "" : "es"}`,
    },
  ];

  /* ---------------- contra la liga y contra nosotros mismos ---------------- */

  const mediana = (valores: number[]) => {
    if (valores.length === 0) return 0;

    const orden = [...valores].sort((a, b) => a - b);
    const medio = Math.floor(orden.length / 2);

    return orden.length % 2
      ? orden[medio]
      : (orden[medio - 1] + orden[medio]) / 2;
  };

  const comparativa: ComparativaInforme | null = datos.comparativa?.liga.length
    ? (() => {
        const { liga, nosotros, historico } = datos.comparativa!;

        const porFavor = [...liga].sort(
          (a, b) => b.favorPorPartido - a.favorPorPartido,
        );

        /* Encajar menos es mejor: este orden va al revés. */
        const porContra = [...liga].sort(
          (a, b) => a.contraPorPartido - b.contraPorPartido,
        );

        return {
          temporada: datos.comparativa!.temporada,
          jugados: datos.comparativa!.jugados,
          equipos: liga.length,
          puesto: nosotros ? porFavor.indexOf(nosotros) + 1 : null,
          puestoContra: nosotros ? porContra.indexOf(nosotros) + 1 : null,
          favorPorPartido: nosotros?.favorPorPartido ?? null,
          contraPorPartido: nosotros?.contraPorPartido ?? null,
          medianaFavor: mediana(liga.map((una) => una.favorPorPartido)),
          medianaContra: mediana(liga.map((una) => una.contraPorPartido)),
          temporadas: historico.map((una) => ({
            temporada: una.temporada,
            favor: una.favor,
            contra: una.contra,
            esActual: una.esActual,
          })),
        };
      })()
    : null;

  if (!comparativa) {
    avisos.push(
      "No se ha podido comparar con la categoría: falta el dato de Wyscout de esta temporada.",
    );
  }

  const titulo = `Balón parado · Microciclo ${datos.micro}`;

  const subtitulo = [datos.rival && `Contra ${datos.rival}`, datos.temporada]
    .filter(Boolean)
    .join(" · ");

  return {
    asunto: `[RMCF Castilla] ABP · Microciclo ${datos.micro}${datos.rival ? ` · ${datos.rival}` : ""}`,
    titulo,
    subtitulo,
    generado: generado.toLocaleString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    rango,
    partido: datos.partido
      ? `Se mide contra ${datos.partido.jornada} · ${datos.partido.rival}`
      : "",
    resumen,
    trabajos,
    valoracion: {
      lineas: lineasValoracion,
      valoradas: valoradas.length,
      total: datos.tareas.length,
      media,
    },
    seguimiento: { lineas: lineasSeguimiento, jugadores },
    equipo,
    prioridades: datos.prioridades.map(filaEquipo),
    comparativa,
    graficos: datos.graficos ?? [],
    avisos,
  };
}

/* ------------------------------------------------------------------ */
/*  EL PAPEL                                                           */
/* ------------------------------------------------------------------ */

const ORO = "#C8A96B";
const NAVY = "#0F1E3D";
const CREMA = "#F7F4EC";
const TINTA = "#1F2937";
const SUAVE = "#6B7280";

function esc(valor: unknown) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tabla(cabeceras: string[], filas: string[][]) {
  if (filas.length === 0) return "";

  const th = cabeceras
    .map(
      (una) =>
        `<th align="left" style="padding:8px 10px;border-bottom:2px solid ${ORO};font:600 11px/1.3 Arial,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:${NAVY}">${esc(una)}</th>`,
    )
    .join("");

  const tr = filas
    .map(
      (fila, indice) =>
        `<tr style="background:${indice % 2 ? "#FFFFFF" : CREMA}">${fila
          .map(
            (celda) =>
              `<td style="padding:8px 10px;border-bottom:1px solid #E5E1D6;font:400 13px/1.45 Arial,sans-serif;color:${TINTA};vertical-align:top">${celda}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function seccion(titulo: string, pie: string, cuerpo: string) {
  if (!cuerpo) return "";

  return `<tr><td style="padding:22px 24px 4px"><h2 style="margin:0;font:700 15px/1.3 Arial,sans-serif;color:${NAVY};text-transform:uppercase;letter-spacing:.08em">${esc(titulo)}</h2>${
    pie
      ? `<p style="margin:4px 0 12px;font:400 12px/1.5 Arial,sans-serif;color:${SUAVE}">${esc(pie)}</p>`
      : `<div style="height:12px"></div>`
  }${cuerpo}</td></tr>`;
}

/** Dos decimales con coma, que es como se leen aquí. */
function fmtDec(valor: number) {
  return valor.toFixed(2).replace(".", ",");
}

function numeroConSigno(valor: number | null, sufijo = "") {
  if (valor === null || !Number.isFinite(valor)) return "—";

  const signo = valor > 0 ? "+" : "";

  return `${signo}${valor.toFixed(1)}${sufijo}`;
}

/**
 * Cómo se enseña una imagen según dónde se vea.
 *
 * En la vista previa de la app vale el `data:` de siempre. En el correo **no**:
 * Gmail quita esas imágenes, así que allí van como partes aparte y el HTML las
 * llama por su `cid` (ver `lib/correo/gmail.ts`).
 */
export type ModoImagenes = "data" | "cid";

function bloqueGraficos(informe: InformeMicro, modo: ModoImagenes) {
  if (informe.graficos.length === 0) return "";

  return informe.graficos
    .map(
      (grafico) =>
        `<p style="margin:0 0 4px;font:600 11px/1.3 Arial,sans-serif;color:${SUAVE};text-transform:uppercase;letter-spacing:.08em">${esc(grafico.titulo)}</p><img src="${
          modo === "cid" ? `cid:${esc(grafico.cid)}` : grafico.imagen
        }" alt="${esc(grafico.titulo)}" width="${grafico.ancho}" style="display:block;width:100%;max-width:${grafico.ancho}px;height:auto;border:1px solid #E5E1D6;border-radius:8px;margin:0 0 18px">`,
    )
    .join("");
}

/** El informe como correo: tablas y estilos en línea, que es lo que sobrevive. */
export function informeHtml(
  informe: InformeMicro,
  opciones: { imagenes?: ModoImagenes } = {},
) {
  const modoImagenes = opciones.imagenes ?? "data";
  const resumen = informe.resumen
    .map(
      (dato) =>
        `<td style="padding:10px 12px;background:${CREMA};border:1px solid #E5E1D6;border-radius:8px;width:33%"><p style="margin:0;font:600 10px/1.3 Arial,sans-serif;color:${SUAVE};text-transform:uppercase;letter-spacing:.08em">${esc(dato.rotulo)}</p><p style="margin:4px 0 0;font:700 19px/1.2 Arial,sans-serif;color:${NAVY}">${esc(dato.valor)}</p><p style="margin:2px 0 0;font:400 11px/1.4 Arial,sans-serif;color:${SUAVE}">${esc(dato.pie)}</p></td>`,
    )
    .reduce<string[][]>((filas, celda, indice) => {
      if (indice % 3 === 0) filas.push([]);

      filas[filas.length - 1].push(celda);

      return filas;
    }, [])
    .map(
      (fila) =>
        `<tr>${fila.join(
          '<td style="width:10px"></td>',
        )}</tr><tr><td colspan="5" style="height:10px"></td></tr>`,
    )
    .join("");

  const semana = tabla(
    ["Día", "Aspecto", "Lado", "Momento", "Medio", "Roles", "Min.", "Carga"],
    informe.trabajos.map((linea) => [
      esc(linea.dia),
      `${esc(linea.aspectos)}${linea.notas ? `<br><span style="color:${SUAVE};font-size:12px">${esc(linea.notas)}</span>` : ""}`,
      esc(linea.lados),
      esc(linea.momento),
      esc(linea.medio),
      esc(linea.roles),
      esc(linea.minutos),
      `${linea.carga}${linea.medida ? "" : " <span style=\"color:#9CA3AF\">est.</span>"}`,
    ]),
  );

  const valoracion = tabla(
    ["Tarea", "Día", "Fecha", "Nota", "Análisis posterior"],
    informe.valoracion.lineas.map((linea) => [
      esc(linea.tarea),
      esc(linea.dia),
      esc(linea.fecha),
      linea.evaluacion > 0 ? `<b>${linea.evaluacion}</b>` : "—",
      esc(linea.analisis || linea.observaciones || "—"),
    ]),
  );

  const seguimiento = tabla(
    ["Jugador", "Fecha", "Quién", "Modalidad", "Objetivo", "Feedback"],
    informe.seguimiento.lineas.map((linea) => [
      `<b>${esc(linea.jugador)}</b>`,
      esc(linea.fecha),
      esc(linea.quien),
      esc([linea.modalidad, linea.estrategia].filter(Boolean).join(" · ")),
      esc(linea.objetivo || "—"),
      esc(linea.feedback || "—"),
    ]),
  );

  const prioridades = tabla(
    ["Aspecto", "Lado", "Urgencia", "Acciones", "Peligro", "Trabajado"],
    informe.prioridades.map((linea) => [
      esc(linea.aspecto),
      esc(LADO_LABEL[linea.lado]),
      linea.urgencia === null
        ? "—"
        : `<b>${Math.round(linea.urgencia * 100)}</b>`,
      String(linea.acciones),
      esc(linea.peligro),
      esc(linea.minutosTemporada),
    ]),
  );

  const equipo = tabla(
    [
      "Aspecto",
      "Lado",
      "Acciones",
      "Remates",
      "Goles",
      "Peligro",
      "Trabajado",
      "Transferencia",
    ],
    informe.equipo.map((linea) => [
      esc(linea.aspecto),
      esc(LADO_LABEL[linea.lado]),
      String(linea.acciones),
      String(linea.remates),
      String(linea.goles),
      esc(linea.peligro),
      esc(linea.minutosTemporada),
      numeroConSigno(linea.transferencia, " pts"),
    ]),
  );

  const avisos = informe.avisos.length
    ? `<tr><td style="padding:6px 24px 18px"><table role="presentation" width="100%" style="width:100%;border-collapse:collapse"><tr><td style="padding:10px 12px;background:#FEF7E7;border-left:3px solid ${ORO};font:400 12px/1.6 Arial,sans-serif;color:#7A5B1E">${informe.avisos
        .map((aviso) => esc(aviso))
        .join("<br>")}</td></tr></table></td></tr>`
    : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(informe.titulo)}</title></head><body style="margin:0;padding:0;background:#EEEAE0">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background:#EEEAE0;padding:18px 0"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="860" style="width:860px;max-width:96%;background:#FFFFFF;border-radius:12px;overflow:hidden">

<tr><td style="padding:22px 24px;background:${NAVY}">
  <p style="margin:0;font:600 10px/1.3 Arial,sans-serif;color:${ORO};text-transform:uppercase;letter-spacing:.28em">RMCF Castilla · Balón parado</p>
  <h1 style="margin:8px 0 0;font:700 26px/1.2 Arial,sans-serif;color:#FFFFFF">${esc(informe.titulo)}</h1>
  <p style="margin:6px 0 0;font:400 13px/1.5 Arial,sans-serif;color:#9FB0C6">${esc(
    [informe.subtitulo, informe.rango].filter(Boolean).join(" · "),
  )}</p>
  ${informe.partido ? `<p style="margin:4px 0 0;font:400 12px/1.5 Arial,sans-serif;color:#9FB0C6">${esc(informe.partido)}</p>` : ""}
</td></tr>

<tr><td style="padding:18px 24px 0"><table role="presentation" width="100%" style="width:100%;border-collapse:separate;border-spacing:0">${resumen}</table></td></tr>

${avisos}

${seccion("La semana", "Lo planificado de balón parado, día a día. «est.» es carga estimada; el resto viene medida de la hoja de registro.", semana)}

${seccion(
  "La valoración registrada",
  informe.valoracion.media === null
    ? `${informe.valoracion.valoradas} de ${informe.valoracion.total} tareas con algo escrito.`
    : `${informe.valoracion.valoradas} de ${informe.valoracion.total} tareas valoradas · media ${informe.valoracion.media.toFixed(1)}.`,
  valoracion,
)}

${seccion(
  "Seguimiento individual de balón parado",
  "Reconocido por lo que está escrito en los objetivos y el feedback: la hoja de seguimiento no tiene casilla de ABP, así que esta lista es una lectura, no un dato cerrado.",
  seguimiento,
)}

${seccion(
  "Por dónde empezar",
  "Las cinco urgencias de arriba: mezclan lo que pasa en el partido, lo peligroso que está siendo y lo poco que se ha trabajado.",
  prioridades,
)}

${seccion(
  "El balón parado del equipo, aspecto por aspecto",
  "Toda la temporada registrada en las hojas de ABP. «Transferencia» compara los partidos con trabajo previo y los que no; en blanco cuando todavía no hay muestra.",
  equipo,
)}

${seccion(
  "Cómo estamos contra la categoría",
  informe.comparativa
    ? `${informe.comparativa.equipos} equipos · ${informe.comparativa.jugados} jornada${informe.comparativa.jugados === 1 ? "" : "s"} · los goles de córner y falta son estimación calibrada; los penaltis, dato.`
    : "",
  informe.comparativa
    ? `${tabla(
        ["", "Nosotros", "Mediana de la liga", "Puesto"],
        [
          [
            "<b>Marca de ABP</b> (por partido)",
            informe.comparativa.favorPorPartido === null
              ? "—"
              : fmtDec(informe.comparativa.favorPorPartido),
            fmtDec(informe.comparativa.medianaFavor),
            informe.comparativa.puesto === null
              ? "—"
              : `<b>${informe.comparativa.puesto}.º</b> de ${informe.comparativa.equipos}`,
          ],
          [
            "<b>Encaja de ABP</b> (por partido)",
            informe.comparativa.contraPorPartido === null
              ? "—"
              : fmtDec(informe.comparativa.contraPorPartido),
            fmtDec(informe.comparativa.medianaContra),
            informe.comparativa.puestoContra === null
              ? "—"
              : `<b>${informe.comparativa.puestoContra}.º</b> de ${informe.comparativa.equipos}`,
          ],
        ],
      )}${bloqueGraficos(informe, modoImagenes)}`
    : bloqueGraficos(informe, modoImagenes),
)}

<tr><td style="padding:18px 24px 24px;border-top:1px solid #E5E1D6">
  <p style="margin:0;font:400 11px/1.6 Arial,sans-serif;color:${SUAVE}">Generado automáticamente por la plataforma del Real Madrid Castilla · ${esc(informe.generado)}</p>
</td></tr>

</table></td></tr></table></body></html>`;
}

/** El mismo informe en texto, para quien lea el correo sin formato. */
export function informeTexto(informe: InformeMicro) {
  const lineas: string[] = [];

  lineas.push(informe.titulo.toUpperCase());
  lineas.push([informe.subtitulo, informe.rango].filter(Boolean).join(" · "));

  if (informe.partido) lineas.push(informe.partido);

  lineas.push("");

  informe.resumen.forEach((dato) => {
    lineas.push(`- ${dato.rotulo}: ${dato.valor} (${dato.pie})`);
  });

  if (informe.avisos.length) {
    lineas.push("", "AVISOS");
    informe.avisos.forEach((aviso) => lineas.push(`- ${aviso}`));
  }

  lineas.push("", "LA SEMANA");

  informe.trabajos.forEach((linea) => {
    lineas.push(
      `- ${linea.dia} · ${linea.aspectos} (${linea.lados}) · ${linea.minutos} · ${linea.momento} · ${linea.medio}`,
    );
  });

  lineas.push(
    "",
    `LA VALORACIÓN REGISTRADA (${informe.valoracion.valoradas} de ${informe.valoracion.total})`,
  );

  informe.valoracion.lineas.forEach((linea) => {
    lineas.push(
      `- ${linea.tarea}${linea.evaluacion > 0 ? ` · nota ${linea.evaluacion}` : ""}${
        linea.analisis ? ` · ${linea.analisis}` : ""
      }`,
    );
  });

  lineas.push(
    "",
    `SEGUIMIENTO INDIVIDUAL DE ABP (${informe.seguimiento.lineas.length} registros · ${informe.seguimiento.jugadores} jugadores)`,
  );

  informe.seguimiento.lineas.forEach((linea) => {
    lineas.push(
      `- ${linea.jugador} · ${linea.fecha} · ${linea.objetivo || "sin objetivo escrito"}`,
    );
  });

  lineas.push("", "POR DÓNDE EMPEZAR");

  informe.prioridades.forEach((linea) => {
    lineas.push(
      `- ${linea.aspecto} (${LADO_LABEL[linea.lado]}) · urgencia ${
        linea.urgencia === null ? "—" : Math.round(linea.urgencia * 100)
      } · ${linea.acciones} acciones · peligro ${linea.peligro}`,
    );
  });

  if (informe.comparativa) {
    const c = informe.comparativa;

    lineas.push("", `CONTRA LA CATEGORÍA (${c.equipos} equipos · ${c.jugados} jornadas)`);

    lineas.push(
      `- Marca de ABP: ${c.favorPorPartido === null ? "—" : fmtDec(c.favorPorPartido)} por partido (mediana ${fmtDec(c.medianaFavor)})${
        c.puesto === null ? "" : ` · ${c.puesto}.º de ${c.equipos}`
      }`,
    );

    lineas.push(
      `- Encaja de ABP: ${c.contraPorPartido === null ? "—" : fmtDec(c.contraPorPartido)} por partido (mediana ${fmtDec(c.medianaContra)})${
        c.puestoContra === null ? "" : ` · ${c.puestoContra}.º de ${c.equipos}`
      }`,
    );

    if (c.temporadas.length > 1) {
      lineas.push("", `NUESTRAS TEMPORADAS, EN SUS ${c.jugados} PRIMEROS PARTIDOS`);

      c.temporadas.forEach((una) => {
        lineas.push(
          `- ${una.temporada}${una.esActual ? " (ésta)" : ""}: ${una.favor} a favor · ${una.contra} en contra`,
        );
      });
    }
  }

  lineas.push("", "EL BALÓN PARADO DEL EQUIPO");

  informe.equipo.forEach((linea) => {
    lineas.push(
      `- ${linea.aspecto} (${LADO_LABEL[linea.lado]}) · ${linea.acciones} acciones · ${linea.remates} remates · ${linea.goles} goles · peligro ${linea.peligro} · trabajado ${linea.minutosTemporada}`,
    );
  });

  lineas.push(
    "",
    `Generado automáticamente por la plataforma del Real Madrid Castilla · ${informe.generado}`,
  );

  return lineas.join("\n");
}
