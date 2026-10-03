/**
 * EL INFORME DEL PARTIDO, EXTENSO, COMO CORREO (03/10/2026).
 *
 * Tablas y estilos en línea —es lo único que sobrevive en Gmail y Outlook—,
 * con la paleta del informe de ABP (crema, marino y oro). El resumen de dos
 * diapositivas va en otro correo; este es el documento de consulta: todo lo
 * que hay detrás de cada frase del resumen.
 *
 * Orden: lo esencial → (post) el partido en datos → el rival y su momento →
 * el duelo en datos → su juego → su once y su plantilla → nuestro plan →
 * la semana → balón parado → lo que el informe no sabe.
 */

import { cifra, ordinal, type InformePartido, type JugadorRival } from "./modelo";

const NAVY = "#0F1E3D";
const ORO = "#A8874A";
const CREMA = "#F7F4EC";
const SUAVE = "#6B7280";
const ROJO = "#B4483A";
const VERDE = "#1F7A55";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Un texto libre con sus saltos de línea. */
const parrafo = (t: string) => esc(t).replace(/\r?\n+/g, "<br>");

function seccion(titulo: string, pie: string, cuerpo: string) {
  if (!cuerpo.trim()) return "";

  return `<tr><td style="padding:26px 28px 6px"><p style="margin:0;font:700 12px/1.3 Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${ORO}">${esc(titulo)}</p>${
    pie ? `<p style="margin:4px 0 12px;font:400 13px/1.5 Arial,sans-serif;color:${SUAVE}">${esc(pie)}</p>` : `<div style="height:10px"></div>`
  }${cuerpo}</td></tr>`;
}

function tabla(cabecera: string[], filas: string[][]) {
  if (!filas.length) return "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font:400 13px/1.45 Arial,sans-serif;color:${NAVY}"><tr>${cabecera
    .map((c) => `<th align="left" style="padding:7px 8px;border-bottom:2px solid ${NAVY};font:700 11px/1.3 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${SUAVE}">${esc(c)}</th>`)
    .join("")}</tr>${filas
    .map(
      (f, i) =>
        `<tr style="background:${i % 2 ? "#FFFFFF" : "#FBFAF6"}">${f.map((c) => `<td valign="top" style="padding:7px 8px;border-bottom:1px solid #ECE8DE">${c}</td>`).join("")}</tr>`,
    )
    .join("")}</table>`;
}

function lista(items: string[], color = NAVY) {
  if (!items.length) return "";

  return `<ul style="margin:0;padding-left:18px;font:400 14px/1.6 Arial,sans-serif;color:${color}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function tarjetas(items: { rotulo: string; valor: string; pie?: string }[]) {
  const celdas = items
    .map(
      (d) =>
        `<td style="padding:12px 14px;background:${CREMA};border:1px solid #E5E1D6;border-radius:8px"><p style="margin:0;font:600 10px/1.3 Arial,sans-serif;color:${SUAVE};text-transform:uppercase;letter-spacing:.08em">${esc(d.rotulo)}</p><p style="margin:4px 0 0;font:700 20px/1.2 Arial,sans-serif;color:${NAVY}">${esc(d.valor)}</p>${
          d.pie ? `<p style="margin:2px 0 0;font:400 11px/1.4 Arial,sans-serif;color:${SUAVE}">${esc(d.pie)}</p>` : ""
        }</td>`,
    )
    .join('<td style="width:8px"></td>');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${celdas}</tr></table>`;
}

/** Una barra en línea de 0 a 100: es lo único que pinta igual en todos los correos. */
const barra = (pct: number | null, color: string) =>
  pct === null
    ? ""
    : `<div style="height:6px;background:#ECE8DE;border-radius:3px;margin-top:4px"><div style="height:6px;width:${Math.max(3, Math.round(pct))}%;background:${color};border-radius:3px"></div></div>`;

const fichaJugador = (j: JugadorRival) =>
  [
    j.posicion && esc(j.posicion),
    j.pie && `pie ${esc(j.pie.toLowerCase())}`,
    j.altura && esc(j.altura),
    j.edad && `${esc(j.edad)} años`,
  ]
    .filter(Boolean)
    .join(" · ");

const cifrasJugador = (j: JugadorRival) =>
  [
    j.partidos !== null ? `${j.partidos} PJ` : "",
    j.minutos ? `${j.minutos}′` : "",
    j.goles ? `${j.goles} G` : "",
    j.asistencias ? `${j.asistencias} A` : "",
  ]
    .filter(Boolean)
    .join(" · ");

export function informeHtml(inf: InformePartido) {
  const p = inf.partido;

  const rival = p.rival || "el rival";

  const esPost = inf.momento === "post";

  /* ---------------- lo esencial ---------------- */

  const etiqueta = (t: string, color = SUAVE) =>
    `<p style="margin:12px 0 4px;font:700 12px/1.3 Arial,sans-serif;color:${color};text-transform:uppercase;letter-spacing:.08em">${esc(t)}</p>`;

  const esencialPost = `<p style="margin:0 0 6px;font:700 20px/1.3 Arial,sans-serif;color:${NAVY}">${esc(inf.sintesis.titular)}</p>${
    inf.sintesis.relato.length ? `${etiqueta("Cómo fue")}${lista(inf.sintesis.relato)}` : ""
  }${inf.sintesis.claves.length ? `${etiqueta("Lo que nos deja")}${lista(inf.sintesis.claves)}` : ""}${
    inf.sintesis.frenados.length
      ? `${etiqueta("¿Frenamos a los que había que vigilar?", ROJO)}<ul style="margin:0;padding-left:18px;font:400 14px/1.6 Arial,sans-serif;color:${NAVY}">${inf.sintesis.frenados
          .map((f) => `<li><b style="color:${f.bien ? VERDE : ROJO}">${f.bien ? "Sí" : "No"}</b> · ${esc(f.jugador.nombre)}: ${esc(f.texto)}</li>`)
          .join("")}</ul>`
      : ""
  }`;

  const esencial = esPost ? esencialPost : `<p style="margin:0 0 12px;font:700 20px/1.3 Arial,sans-serif;color:${NAVY}">${esc(inf.sintesis.titular)}</p>${
    inf.sintesis.claves.length
      ? `<p style="margin:0 0 4px;font:700 12px/1.3 Arial,sans-serif;color:${SUAVE};text-transform:uppercase;letter-spacing:.08em">${esPost ? "Lo que nos deja" : "Claves del partido"}</p>${lista(inf.sintesis.claves)}`
      : ""
  }${
    inf.sintesis.ventajas.length
      ? `<p style="margin:12px 0 4px;font:700 12px/1.3 Arial,sans-serif;color:${VERDE};text-transform:uppercase;letter-spacing:.08em">Donde somos mejores</p>${lista(inf.sintesis.ventajas)}`
      : ""
  }${
    inf.sintesis.amenazas.length
      ? `<p style="margin:12px 0 4px;font:700 12px/1.3 Arial,sans-serif;color:${ROJO};text-transform:uppercase;letter-spacing:.08em">Donde son fuertes ellos</p>${lista(inf.sintesis.amenazas)}`
      : ""
  }${
    inf.sintesis.vigilar.length
      ? `<p style="margin:12px 0 4px;font:700 12px/1.3 Arial,sans-serif;color:${ROJO};text-transform:uppercase;letter-spacing:.08em">A vigilar</p>${lista(
          inf.sintesis.vigilar.map((j) => `${j.dorsal ? `${j.dorsal} · ` : ""}${j.nombre}${j.posicion ? ` (${j.posicion.toLowerCase()})` : ""}${j.goles ? ` · ${j.goles} ${j.goles === 1 ? "gol" : "goles"}` : ""}`),
        )}`
      : ""
  }`;

  /* ---------------- post: el partido en datos ---------------- */

  const partidoDatos =
    esPost && inf.duelo?.partido
      ? `${lista(inf.sintesis.partido)}<div style="height:10px"></div>${tabla(
          ["Métrica", "Nosotros", rival, "Nuestra media"],
          inf.duelo.partido.metricas.map((m) => [esc(m.nombre), `<b>${cifra(m.nuestro, m.unidad)}</b>`, cifra(m.suyo, m.unidad), cifra(m.media, m.unidad)]),
        )}`
      : esPost
        ? `<p style="margin:0;font:400 14px/1.5 Arial,sans-serif;color:${SUAVE}">Wyscout todavía no tiene este partido: se baja los martes o desde Ajustes. El resto del informe ya vale.</p>`
        : "";

  /* ---------------- post: la crónica ---------------- */

  const cr = inf.cronica;

  const cronica = cr
    ? `${tabla(
        ["Min.", "Gol de", "Marca", "Asistencia"],
        cr.goles.map((g) => [
          `<b>${esc(g.minuto)}′</b>`,
          `<b style="color:${g.nuestro ? ORO : ROJO}">${g.nuestro ? "RM Castilla" : esc(rival)}</b>`,
          `${esc(g.jugador)}${g.tipo === "penalti" ? " (penalti)" : g.tipo === "propia" ? " (en propia)" : ""}`,
          esc(g.asistente || "—"),
        ]),
      )}${
        cr.cambios.length
          ? `${etiqueta(`Sus cambios`)}${lista(cr.cambios.map((c) => `${c.minuto}′ · entra ${c.entra} por ${c.sale}`))}`
          : ""
      }${cr.tarjetas.length ? `${etiqueta("Sus tarjetas")}${lista(cr.tarjetas.map((t) => `${t.minuto}′ · ${t.jugador} (${t.tipo})`))}` : ""}`
    : "";

  /* ---------------- post: su once, previsto y real ---------------- */

  const onceReal =
    cr && cr.onceReal.length
      ? `${
          cr.acierto
            ? `<p style="margin:0 0 10px;font:700 16px/1.4 Arial,sans-serif;color:${NAVY}">Acertamos ${cr.acierto.acertados} de ${cr.acierto.total}.${
                cr.acierto.noSalieron.length ? ` <span style="font-weight:400;color:${SUAVE}">No salieron: ${esc(cr.acierto.noSalieron.join(", "))}.</span>` : ""
              }</p>`
            : ""
        }${tabla(
          ["", "Jugador", "Ficha", cr.acierto ? "¿Lo esperábamos?" : ""],
          cr.onceReal.map((j) => [
            `<b>${esc(j.dorsal)}</b>`,
            `<b>${esc(j.nombre)}</b>`,
            fichaJugador(j) || "—",
            cr.acierto
              ? cr.acierto.sorpresas.includes(j.nombre)
                ? `<b style="color:${ROJO}">Sorpresa</b>`
                : `<span style="color:${VERDE}">Sí</span>`
              : "",
          ]),
        )}`
      : "";

  /* ---------------- post: el plan, a revisión ---------------- */

  const plRev = inf.plan;

  const revision = plRev
    ? tabla(
        ["Lo que nos propusimos", "¿Se cumplió?"],
        [
          ...plRev.claves.map((c) => ["Clave", c]),
          ["Con balón", plRev.ataque],
          ["Sin balón", plRev.defensa],
          ["ABP ofensivo", plRev.abpOf],
          ["ABP defensivo", plRev.abpDef],
        ]
          .filter(([, t]) => t)
          .map(([m, t]) => [
            `<span style="color:${SUAVE};font-size:11px;text-transform:uppercase;letter-spacing:.06em">${esc(m)}</span><br>${parrafo(t)}`,
            `<div style="min-width:150px;height:34px;border:1px dashed #D6D0C2;border-radius:6px"></div>`,
          ]),
      )
    : "";

  /* ---------------- el rival y su momento ---------------- */

  const ctx = inf.contexto;

  const contexto = ctx
    ? tarjetas(
        [
          ctx.puesto ? { rotulo: "Clasificación", valor: `${ordinal(ctx.puesto)} · ${ctx.puntos} pts`, pie: ctx.nuestroPuesto ? `Nosotros ${ordinal(ctx.nuestroPuesto)} · ${ctx.nuestrosPuntos} pts` : undefined } : null,
          ctx.nuestraRacha.length ? { rotulo: "Nuestra racha", valor: ctx.nuestraRacha.join(" "), pie: "del más reciente al más antiguo" } : null,
          ctx.racha.length ? { rotulo: `Racha del ${rival}`, valor: ctx.racha.join(" "), pie: "del más reciente al más antiguo" } : null,
          ctx.goleadores.length ? { rotulo: "Goleadores", valor: ctx.goleadores.map((g) => `${g.nombre.split(" ").slice(-1)[0]} ${g.goles}`).join(" · ") } : null,
          ctx.entrenador || ctx.estructuras.length ? { rotulo: "Entrenador y dibujo", valor: ctx.entrenador || "—", pie: ctx.estructuras.join(" / ") || inf.duelo?.esquema.rival || undefined } : null,
        ].filter((x): x is { rotulo: string; valor: string; pie?: string } => Boolean(x)),
      )
    : "";

  /* ---------------- el duelo en datos ---------------- */

  const duelo = inf.duelo?.metricas.length
    ? tabla(
        ["Métrica", "Nosotros", rival, "Mediana liga"],
        inf.duelo.metricas.map((m) => [
          esc(m.nombre),
          m.nosotros ? `<b>${cifra(m.nosotros.valor, m.unidad)}</b> <span style="color:${SUAVE}">${ordinal(m.nosotros.puesto)}</span>${barra(m.nosotros.percentil, ORO)}` : "—",
          m.rival ? `<b>${cifra(m.rival.valor, m.unidad)}</b> <span style="color:${SUAVE}">${ordinal(m.rival.puesto)}</span>${barra(m.rival.percentil, ROJO)}` : "—",
          cifra(m.mediana, m.unidad),
        ]),
      )
    : "";

  /* ---------------- su juego ---------------- */

  const colectivo = inf.colectivo
    ? `${inf.colectivo.bloques
        .map(
          (b) =>
            `<p style="margin:14px 0 6px;font:700 14px/1.3 Arial,sans-serif;color:${NAVY}">${esc(b.fase)} · ${esc(b.bloque)}</p>${tabla(
              ["Aspecto", "Lo que hace"],
              b.campos.map((c) => [`<b>${esc(c.titulo)}</b>`, parrafo(c.texto)]),
            )}`,
        )
        .join("")}${
        inf.colectivo.conclusiones.length
          ? `<p style="margin:16px 0 6px;font:700 14px/1.3 Arial,sans-serif;color:${NAVY}">Conclusiones del scouting</p>${tabla(
              ["", ""],
              inf.colectivo.conclusiones.map((c) => [`<b>${esc(c.titulo)}</b>`, parrafo(c.texto)]),
            )}`
          : ""
      }`
    : "";

  /* ---------------- su once y su plantilla ---------------- */

  const once = inf.once.jugadores.length
    ? `<p style="margin:0 0 8px;font:400 13px/1.5 Arial,sans-serif;color:${SUAVE}">${esc(inf.once.detalle)}.</p>${tabla(
        ["", "Jugador", "Ficha", "Temporada", "Rasgos y lectura"],
        inf.once.jugadores.map((j) => [
          `<b>${esc(j.dorsal)}</b>`,
          `<b>${esc(j.nombre)}</b>`,
          fichaJugador(j),
          cifrasJugador(j),
          [
            j.rasgos.length ? `<span style="color:${ORO}">${esc(j.rasgos.join(" · "))}</span>` : "",
            j.fortalezas ? `<span style="color:${VERDE}">+ ${parrafo(j.fortalezas)}</span>` : "",
            j.debilidades ? `<span style="color:${ROJO}">− ${parrafo(j.debilidades)}</span>` : "",
          ]
            .filter(Boolean)
            .join("<br>"),
        ]),
      )}`
    : "";

  const enOnce = new Set(inf.once.jugadores.map((j) => j.clave));

  const resto = inf.plantilla.filter((j) => !enOnce.has(j.clave));

  const plantilla = resto.length
    ? tabla(
        ["", "Jugador", "Ficha", "Temporada", "Rasgos"],
        resto
          .sort((a, b) => (b.minutos ?? 0) - (a.minutos ?? 0))
          .map((j) => [esc(j.dorsal), esc(j.nombre), fichaJugador(j), cifrasJugador(j), esc(j.rasgos.join(" · "))]),
      )
    : "";

  /* ---------------- nuestro plan ---------------- */

  const pl = inf.plan;

  const plan = pl
    ? `${pl.claves.length ? `<p style="margin:0 0 4px;font:700 13px/1.3 Arial,sans-serif;color:${NAVY}">Claves</p>${lista(pl.claves)}` : ""}${tabla(
        ["Momento", "El plan"],
        [
          ["Con balón", pl.ataque],
          ["Sin balón", pl.defensa],
          ["ABP ofensivo", pl.abpOf],
          ["ABP defensivo", pl.abpDef],
          ["Estructura ofensiva", pl.estructuraOf],
          ["Estructura defensiva", pl.estructuraDef],
          ...pl.duelos.map((d) => [`Duelos · ${d.titulo.toLowerCase()}`, d.texto]),
          ["Claves emocionales", pl.emocionales],
          ["Cómo llega el rival", pl.estado],
          ["Sus fortalezas", pl.fortalezas],
          ["Sus debilidades", pl.debilidades],
        ]
          .filter(([, t]) => t)
          .map(([m, t]) => [`<b>${esc(m)}</b>`, parrafo(t)]),
      )}`
    : "";

  /* ---------------- la semana ---------------- */

  const m = inf.microciclo;

  const semana = m
    ? `${tarjetas([
        { rotulo: "Tareas", valor: String(m.totales.tareas) },
        { rotulo: "Minutos de trabajo", valor: `${m.totales.minutos}′` },
        { rotulo: "Balón parado", valor: m.totales.abpMinutos ? `${m.totales.abpMinutos}′` : "—", pie: m.totales.abpMinutos ? undefined : "sin minutos en la hoja" },
        { rotulo: "Valoración media", valor: m.totales.valoracionMedia !== null ? m.totales.valoracionMedia.toLocaleString("es-ES") : "—", pie: `${m.totales.valoradas} de ${m.totales.tareas} valoradas` },
      ])}<div style="height:12px"></div>${tabla(
        ["Día", "MD", "Tareas", "Minutos", "Carga", "Contenidos"],
        m.dias.map((d) => [`<b>${esc(d.etiqueta)}</b>`, esc(d.md), String(d.tareas), `${d.minutos}′`, String(d.carga), esc(d.contenidos.join(" · "))]),
      )}${
        m.contenidos.length
          ? `<p style="margin:14px 0 4px;font:700 13px/1.3 Arial,sans-serif;color:${NAVY}">Qué se ha trabajado</p>${lista(m.contenidos.map((c) => `${c.nombre}: ${c.minutos}′`))}`
          : ""
      }<p style="margin:14px 0 6px;font:700 13px/1.3 Arial,sans-serif;color:${NAVY}">Tarea a tarea</p>${tabla(
        ["Día", "Tarea", "Fase", "Contenido", "Min.", "Nota"],
        m.tareas.map((t) => [
          `${esc(t.dia)} <span style="color:${SUAVE}">${esc(t.md)}</span>`,
          `<b>${esc(t.tarea)}</b>${t.tipo ? `<br><span style="color:${SUAVE}">${esc(t.tipo)}${t.formato ? ` · ${esc(t.formato)}` : ""}</span>` : ""}`,
          esc(t.fase),
          `${esc(t.contenido)}${t.secundario ? `<br><span style="color:${SUAVE}">${esc(t.secundario)}</span>` : ""}`,
          t.minutos ? `${t.minutos}′` : "—",
          t.evaluacion ? `<b>${t.evaluacion}</b>${t.analisis ? `<br><span style="color:${SUAVE}">${esc(t.analisis)}</span>` : ""}` : "—",
        ]),
      )}`
    : "";

  /* ---------------- balón parado ---------------- */

  const abp = inf.abp
    ? `${tarjetas([
        { rotulo: "ABP trabajado esta semana", valor: inf.abp.minutosSemana ? `${inf.abp.minutosSemana}′` : "—", pie: inf.abp.minutosSemana ? undefined : "las tareas de ABP no tienen minutos en la hoja" },
        { rotulo: "Láminas del rival preparadas", valor: String(inf.abp.laminasRival), pie: "en ABP y Área del Rival" },
      ])}${
        inf.abp.documentosRival.length
          ? `<p style="margin:12px 0 0;font:400 13px/1.6 Arial,sans-serif;color:${NAVY}">Informes del rival: ${inf.abp.documentosRival
              .map((d) => `<a href="${esc(d.url)}" style="color:${ORO};font-weight:700">${esc(d.nombre)} (PDF)</a>`)
              .join(" · ")}</p>`
          : ""
      }<p style="margin:10px 0 0;font:400 13px/1.5 Arial,sans-serif;color:${SUAVE}">El detalle de balón parado va en su propio informe, desde Microciclo de Balón Parado.</p>`
    : "";

  const avisos = inf.avisos.length ? lista(inf.avisos, SUAVE) : "";

  const titulo = `${esPost ? "Post partido" : "Previa"} · ${p.lado === "fuera" ? `${rival} - RM Castilla` : `RM Castilla - ${rival}`}`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(titulo)}</title></head><body style="margin:0;padding:0;background:#EEEAE0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEEAE0"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="760" cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;background:#FFFFFF;border-radius:12px;overflow:hidden">
<tr><td style="padding:26px 28px;background:${NAVY}"><p style="margin:0;font:700 11px/1.3 Arial,sans-serif;letter-spacing:.24em;color:#C8A96B">REAL MADRID CASTILLA · ${esPost ? "POST PARTIDO" : "PREVIA DEL PARTIDO"}</p><p style="margin:8px 0 0;font:700 26px/1.2 Arial,sans-serif;color:#FFFFFF">${esc(titulo)}</p><p style="margin:6px 0 0;font:400 13px/1.4 Arial,sans-serif;color:#C9CFDA">${esc([p.jornada ? `Jornada ${p.jornada}` : "", p.fechaTexto, inf.microciclo ? `Microciclo ${inf.microciclo.micro}` : ""].filter(Boolean).join(" · "))}</p></td></tr>
${
  esPost
    ? /* El post cuenta el partido y lo cruza con lo que se preparó. El scouting
         entero del rival ya fue en la previa: aquí sólo lo que lo contrasta. */
      [
        seccion("Lo esencial", "Lo mismo que el resumen de dos diapositivas, en texto.", esencial),
        seccion("El partido", "Goles, cambios y tarjetas (BeSoccer).", cronica),
        seccion("El partido en datos", "Wyscout: lo nuestro, lo suyo y nuestra media de la temporada.", partidoDatos),
        seccion(`Su once${cr?.estructura ? ` · ${cr.estructura}` : ""}`, cr?.acierto ? "El que sacaron, frente al que habíamos previsto en Plantillas." : "El que sacaron (BeSoccer).", onceReal),
        seccion("El plan, a revisión", "Lo que nos propusimos en Preparación de Partido; la columna de la derecha es para cerrarlo en la reunión.", revision),
        seccion("La semana que lo preparó", "El microciclo de la hoja de registro de tareas.", semana),
        seccion("Dónde quedamos", "Clasificación y racha (BeSoccer).", contexto),
        seccion("Los dos en la temporada", `Wyscout, temporada ${inf.duelo?.temporada ?? ""}: media por partido y puesto entre los ${inf.duelo?.equipos ?? ""} del grupo. La barra es el percentil.`, duelo),
        seccion("Balón parado", "", abp),
        seccion("Lo que este informe no sabe", "", avisos),
      ].join("\n")
    : [
        seccion("Lo esencial", "Lo mismo que el resumen de dos diapositivas, en texto.", esencial),
        seccion(`${rival}: su momento`, "Clasificación, racha y quién marca (BeSoccer).", contexto),
        seccion("El duelo en datos", `Wyscout, temporada ${inf.duelo?.temporada ?? ""}: la media por partido de cada equipo y su puesto entre los ${inf.duelo?.equipos ?? ""} del grupo (1.º = el mejor). La barra es el percentil.`, duelo),
        seccion(`Cómo juega ${rival}`, "El análisis colectivo del cuerpo técnico (Scouting colectivo).", colectivo),
        seccion(inf.once.fuente === "marcado" ? "Su once probable" : "Su último once", "Ficha, números de la temporada (BeSoccer) y lo que dice cada ficha.", once),
        seccion("El resto de su plantilla", "Por minutos jugados.", plantilla),
        seccion("Nuestro plan de partido", "Preparación de Partido.", plan),
        seccion("La semana", "El microciclo de la hoja de registro de tareas.", semana),
        seccion("Balón parado", "", abp),
        seccion("Lo que este informe no sabe", "", avisos),
      ].join("\n")
}
<tr><td style="padding:18px 28px 26px;font:400 11px/1.5 Arial,sans-serif;color:${SUAVE}">Generado desde la plataforma del Castilla el ${esc(new Date(inf.generado).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }))}.</td></tr>
</table></td></tr></table></body></html>`;
}

/** El correo del resumen: las dos diapositivas y una línea. */
export function resumenHtml(inf: InformePartido, cids: string[]) {
  const p = inf.partido;

  const rival = p.rival || "el rival";

  const titulo = `${inf.momento === "post" ? "Post partido" : "Previa"} · ${p.lado === "fuera" ? `${rival} - RM Castilla` : `RM Castilla - ${rival}`}`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title></head><body style="margin:0;padding:0;background:#08111F"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08111F"><tr><td align="center" style="padding:20px 8px"><table role="presentation" width="960" cellpadding="0" cellspacing="0" style="width:100%;max-width:960px">
<tr><td style="padding:4px 4px 14px"><p style="margin:0;font:700 11px/1.3 Arial,sans-serif;letter-spacing:.24em;color:#C8A96B">REAL MADRID CASTILLA · RESUMEN</p><p style="margin:6px 0 0;font:700 22px/1.25 Arial,sans-serif;color:#F7F4EC">${esc(titulo)}</p><p style="margin:4px 0 0;font:400 13px/1.4 Arial,sans-serif;color:#9AA3B2">${esc(inf.sintesis.titular)}. El informe completo llega en otro correo; las dos diapositivas van también en PDF adjunto.</p></td></tr>
${cids.map((cid, i) => `<tr><td style="padding:6px 0"><img src="cid:${esc(cid)}" alt="Diapositiva ${i + 1}" width="960" style="display:block;width:100%;max-width:960px;height:auto;border-radius:10px"></td></tr>`).join("")}
</table></td></tr></table></body></html>`;
}

export function informeTexto(inf: InformePartido) {
  const p = inf.partido;

  const l: string[] = [
    `REAL MADRID CASTILLA · ${inf.momento === "post" ? "POST PARTIDO" : "PREVIA"} · ${p.rival}`,
    [p.jornada ? `Jornada ${p.jornada}` : "", p.fechaTexto].filter(Boolean).join(" · "),
    "",
    inf.sintesis.titular,
    "",
    inf.momento === "post" ? "LO QUE NOS DEJA" : "CLAVES DEL PARTIDO",
    ...inf.sintesis.claves.map((c, i) => `${i + 1}. ${c}`),
  ];

  if (inf.sintesis.relato.length) l.push("", "CÓMO FUE", ...inf.sintesis.relato.map((v) => `- ${v}`));
  if (inf.sintesis.frenados.length) l.push("", "¿LOS FRENAMOS?", ...inf.sintesis.frenados.map((f) => `- ${f.bien ? "Sí" : "No"} · ${f.jugador.nombre}: ${f.texto}`));
  if (inf.sintesis.ventajas.length) l.push("", "DONDE SOMOS MEJORES", ...inf.sintesis.ventajas.map((v) => `- ${v}`));
  if (inf.momento !== "post" && inf.sintesis.amenazas.length) l.push("", "DONDE SON FUERTES ELLOS", ...inf.sintesis.amenazas.map((v) => `- ${v}`));
  if (inf.momento !== "post" && inf.sintesis.vigilar.length) l.push("", "A VIGILAR", ...inf.sintesis.vigilar.map((j) => `- ${j.dorsal} ${j.nombre} (${j.posicion})`));
  if (inf.sintesis.partido.length) l.push("", "EL PARTIDO EN DATOS", ...inf.sintesis.partido.map((v) => `- ${v}`));
  if (inf.microciclo) l.push("", `LA SEMANA: ${inf.microciclo.totales.tareas} tareas · ${inf.microciclo.totales.minutos}′${inf.microciclo.totales.abpMinutos ? ` · ${inf.microciclo.totales.abpMinutos}′ de ABP` : ""}`);
  if (inf.avisos.length) l.push("", "LO QUE EL INFORME NO SABE", ...inf.avisos.map((a) => `- ${a}`));

  return l.join("\n");
}
