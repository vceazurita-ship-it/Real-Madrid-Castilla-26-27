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
 * la semana → balón parado. Lo que el informe no sabe NO va: se avisa antes de mandar.
 */

import { cifra, conDato, ordinal, pct, revisaPalancas, contrastePronostico, type InformePartido, type JugadorRival } from "./modelo";

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

const NUMERO = "{{N}}";

function seccion(titulo: string, pie: string, cuerpo: string) {
  if (!cuerpo.trim()) return "";

  return `<tr><td style="padding:34px 32px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="58" valign="top" style="font:700 34px/1 Georgia,'Times New Roman',serif;color:#C8A96B">${NUMERO}</td><td valign="top"><p style="margin:0;font:700 20px/1.2 Arial,sans-serif;color:${NAVY}">${esc(titulo)}</p>${
    pie ? `<p style="margin:5px 0 0;font:400 13px/1.5 Arial,sans-serif;color:${SUAVE}">${esc(pie)}</p>` : ""
  }</td></tr></table><div style="height:2px;background:#E8DFC9;margin:14px 0 16px"></div>${cuerpo}</td></tr>`;
}

/** Numera los capítulos que han salido: 01, 02… */
function numera(html: string) {
  let n = 0;

  return html.split(NUMERO).reduce((acc, trozo, i) => (i === 0 ? trozo : `${acc}${String(++n).padStart(2, "0")}${trozo}`), "");
}

/** Una foto de jugador pequeña y redonda (la URL de BeSoccer es pública). */
const fotito = (url: string) =>
  url ? `<img src="${esc(url)}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border-radius:18px;object-fit:cover;background:#EEE">` : "";

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
        `<td style="padding:14px 16px;background:${CREMA};border:1px solid #E5E1D6;border-top:3px solid #C8A96B;border-radius:8px"><p style="margin:0;font:600 10px/1.3 Arial,sans-serif;color:${SUAVE};text-transform:uppercase;letter-spacing:.08em">${esc(d.rotulo)}</p><p style="margin:4px 0 0;font:700 20px/1.2 Arial,sans-serif;color:${NAVY}">${esc(d.valor)}</p>${
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

/** Un documento del correo: adjunto, o sólo enlazado porque no cabe. */
export type Descarga = {
  nombre: string;
  /** Sin URL (todavía no subido, en la vista previa) se nombra sin botón. */
  url?: string;
  tamano?: number | null;
  /** `true` si va adjunto; `false` si sólo va el enlace (no cabía). */
  adjunto: boolean;
};

/** Lo que el informe extenso lleva además de lo suyo. */
export type ExtrasInforme = {
  /** El informe de ABP del microciclo, ya en HTML (sus imágenes van por `cid:abp-…`). */
  abpCuerpo?: string;
  /** Los documentos del correo, para nombrarlos y dar su enlace de descarga. */
  adjuntos?: Descarga[];
  /** Los `cid` de las dos diapositivas, si van dentro del correo. */
  diapositivas?: string[];
  /**
   * Cuánto se aligera el cuerpo para que Gmail no lo recorte (pasa de ~102 KB
   * y esconde el resto tras «Ver todo el mensaje», imágenes incluidas):
   * 0 = entero; 1 = sin las tablas largas (tarea a tarea, resto de la
   * plantilla, scouting por bloques); 2 = además, ABP en resumen. Lo quitado
   * va en el PDF del completo, que viaja adjunto.
   */
  ligero?: 0 | 1 | 2;
  /** Los capítulos que van (sus `id`); sin esto, todos. */
  capitulos?: string[];
  /** Lo que escribe quien lo manda: va arriba, con su firma. */
  mensaje?: string;
  firma?: string;
  /** Sólo la lista de capítulos (para elegir), sin armar el HTML. */
  soloLista?: boolean;
};

/** El mensaje de quien manda el informe: una nota con su firma, en el tono del club. */
export function bloqueMensaje(texto: string, firma?: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:16px 20px;border-left:4px solid #C8A96B;background:#FBF6EA;border-radius:0 8px 8px 0"><p style="margin:0;font:400 15px/1.6 Arial,sans-serif;color:${NAVY}">${parrafo(texto.trim())}</p>${
    firma ? `<p style="margin:10px 0 0;font:700 12px/1.3 Arial,sans-serif;letter-spacing:.06em;color:${ORO}">— ${esc(firma)}</p>` : ""
  }</td></tr></table>`;
}

/** Tamaño de un archivo para leerlo: «3,2 MB», «640 KB». */
const peso = (bytes: number | null | undefined) =>
  !bytes ? "" : bytes >= 1048576 ? `${(bytes / 1048576).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * El texto que enseña la bandeja de entrada al lado del asunto.
 *
 * Sin él, Gmail y el iPhone enseñaban «REAL MADRID CASTILLA · RESUMEN…»,
 * que no dice nada. Va oculto y relleno de espacios de anchura cero para que
 * el cliente no complete la línea con el resto del cuerpo.
 */
export const preheader = (texto: string) =>
  `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;opacity:0">${esc(texto)}${"&#8203;&nbsp;".repeat(60)}</div>`;

/** Los documentos del correo como botones de descarga: valen aunque el cliente esconda los adjuntos. */
export function bloqueDescargas(lista: Descarga[], titulo = "Documentos") {
  if (!lista.length) return "";

  const filas = lista
    .map((d) => {
      const ext = (/\.(pdf|pptx)$/i.exec(d.nombre)?.[1] ?? "").toUpperCase();

      const marca = `<td width="46" valign="middle" style="padding:10px 0 10px 12px"><div style="width:38px;height:38px;border-radius:6px;background:${ext === "PPTX" ? "#C4512F" : ROJO};color:#FFFFFF;font:700 10px/38px Arial,sans-serif;text-align:center">${esc(ext || "DOC")}</div></td>`;

      const datos = `<td valign="middle" style="padding:10px 12px"><p style="margin:0;font:700 14px/1.3 Arial,sans-serif;color:${NAVY}">${esc(d.nombre)}</p><p style="margin:2px 0 0;font:400 12px/1.4 Arial,sans-serif;color:${SUAVE}">${[
        peso(d.tamano),
        d.adjunto ? "adjunto a este correo" : "no cabía adjunto: descárgalo con el botón",
      ]
        .filter(Boolean)
        .join(" · ")}</p></td>`;

      const boton = d.url
        ? `<td width="112" align="right" valign="middle" style="padding:10px 12px 10px 0"><a href="${esc(d.url)}" style="display:inline-block;padding:9px 14px;border-radius:6px;background:${NAVY};color:#FFFFFF;font:700 12px/1 Arial,sans-serif;text-decoration:none">Descargar</a></td>`
        : "";

      return `<tr><td style="padding:0 0 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREMA};border:1px solid #E5E1D6;border-radius:8px"><tr>${marca}${datos}${boton}</tr></table></td></tr>`;
    })
    .join("");

  return `<p style="margin:0 0 8px;font:700 11px/1.3 Arial,sans-serif;letter-spacing:.2em;color:${ORO};text-transform:uppercase">${esc(titulo)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>`;
}

type Capitulo = { id: string; titulo: string; html: string };

function piezasInforme(inf: InformePartido, extras: ExtrasInforme = {}): { capitulos: Capitulo[]; html: string } {
  const p = inf.partido;

  const rival = p.rival || "el rival";

  const esPost = inf.momento === "post";

  const ligero = extras.ligero ?? 0;

  /* Lo que se quita para que Gmail no recorte el correo: dónde está. */
  const enElPdf = (que: string) =>
    `<p style="margin:10px 0 0;padding:10px 12px;border-left:3px solid #C8A96B;background:#FBF6EA;font:400 13px/1.5 Arial,sans-serif;color:${NAVY}">${esc(que)}: en el PDF del informe completo, adjunto a este correo.</p>`;

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
        inf.duelo.metricas.filter(conDato).flatMap((m, i, todas) => [
          ...(m.bloque && m.bloque !== todas[i - 1]?.bloque
            ? [[`<b style="color:${ORO};text-transform:uppercase;letter-spacing:.1em;font-size:11px">${esc(m.bloque)}</b>`, "", "", ""]]
            : []),
          [
          `${esc(m.nombre)}${m.comoLeer ? `<br><span style="color:${SUAVE};font-size:11px">${esc(m.comoLeer)}</span>` : ""}`,
          m.nosotros ? `<b>${cifra(m.nosotros.valor, m.unidad)}</b> <span style="color:${SUAVE}">${ordinal(m.nosotros.puesto)}</span>${barra(m.nosotros.percentil, ORO)}` : "—",
          m.rival ? `<b>${cifra(m.rival.valor, m.unidad)}</b> <span style="color:${SUAVE}">${ordinal(m.rival.puesto)}</span>${barra(m.rival.percentil, ROJO)}` : "—",
          cifra(m.mediana, m.unidad),
          ],
        ]),
      )
    : "";

  /* ---------------- el pronóstico y cómo lo inclinamos ---------------- */

  const pr = inf.pronostico;

  const pronostico = pr
    ? `<p style="margin:0 0 10px;font:700 16px/1.4 Arial,sans-serif;color:${NAVY}">${esc(pr.lectura)}</p>${tarjetas([
        { rotulo: "Victoria", valor: pct(pr.victoria), pie: `con el plan: ${pct(pr.conPlan.victoria)}` },
        { rotulo: "Empate", valor: pct(pr.empate), pie: `con el plan: ${pct(pr.conPlan.empate)}` },
        { rotulo: "Derrota", valor: pct(pr.derrota), pie: `con el plan: ${pct(pr.conPlan.derrota)}` },
        { rotulo: "Goles esperados", valor: `${cifra(pr.esperados.nosotros, "decimal")} – ${cifra(pr.esperados.rival, "decimal")}`, pie: `más probable: ${pr.marcador}` },
      ])}<div style="height:12px"></div>${tabla(
        ["Palanca", "La meta", "Por qué (dato)", "Cómo (plan)", "+ victoria"],
        pr.palancas.map((x) => [
          `<b>${esc(x.momento)}</b>`,
          esc(x.objetivo),
          esc(x.porque),
          esc(x.plan || "—"),
          `<b style="color:${ORO}">+${Math.max(0, x.victoria)} pts</b>`,
        ]),
      )}<p style="margin:8px 0 0;font:400 12px/1.5 Arial,sans-serif;color:${SUAVE}">Modelo de Poisson con ${esc(pr.base)}. No es una apuesta: dice de qué partido venimos a hablar y cuánto mueve cada parte del plan.</p>`
    : "";

  const veredicto =
    pr && esPost && inf.sintesis.veredicto
      ? `<p style="margin:0 0 10px;font:700 15px/1.5 Arial,sans-serif;color:${NAVY}">${esc(inf.sintesis.veredicto)}.</p>${tarjetas([
          { rotulo: "Victoria", valor: pct(pr.victoria) },
          { rotulo: "Empate", valor: pct(pr.empate) },
          { rotulo: "Derrota", valor: pct(pr.derrota) },
          { rotulo: "Resultado", valor: p.gf !== null && p.gc !== null ? `${p.gf}-${p.gc}` : "—", pie: `el más probable era ${pr.marcador}` },
        ])}<div style="height:12px"></div>${tabla(
          ["", "Lo previsto", "Lo que pasó", ""],
          contrastePronostico(inf).map((f) => [
            `<b>${esc(f.rotulo)}</b>`,
            esc(f.previsto),
            `<b>${esc(f.real)}</b>`,
            f.acierto === null ? "—" : f.acierto ? `<b style="color:${VERDE}">✓</b>` : `<b style="color:${ROJO}">✗</b>`,
          ]),
        )}<div style="height:12px"></div>${tabla(
          ["Palanca", "La meta", "Lo que pasó", ""],
          revisaPalancas(inf).map((x) => [
            `<b>${esc(x.momento)}</b>`,
            esc(x.meta),
            esc(x.real),
            x.cumplida === null ? "—" : x.cumplida ? `<b style="color:${VERDE}">Cumplida</b>` : `<b style="color:${ROJO}">No</b>`,
          ]),
        )}`
      : "";

  /* ---------------- su juego ---------------- */

  const resumenJuego = inf.colectivo?.resumen;

  const colectivo = inf.colectivo
    ? `${
        resumenJuego?.fases.length
          ? `${tabla(
              ["En una línea", ""],
              [
                ...resumenJuego.fases.map((f) => [`<b>${esc(f.titulo)}</b>`, esc(f.texto)]),
                ...resumenJuego.dano.map((t, i) => [i === 0 ? `<b style="color:${VERDE}">Dónde hacerles daño</b>` : "", esc(t)]),
              ],
            )}<div style="height:14px"></div>`
          : ""
      }${ligero >= 1 ? enElPdf("El scouting entero, fase a fase, y sus conclusiones") : inf.colectivo.bloques
        .map(
          (b) =>
            `<p style="margin:14px 0 6px;font:700 14px/1.3 Arial,sans-serif;color:${NAVY}">${esc(b.fase)} · ${esc(b.bloque)}</p>${tabla(
              ["Aspecto", "Lo que hace"],
              b.campos.map((c) => [`<b>${esc(c.titulo)}</b>`, parrafo(c.texto)]),
            )}`,
        )
        .join("")}${
        ligero < 1 && inf.colectivo.conclusiones.length
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
          `${fotito(j.foto)}<b style="display:block;text-align:center;margin-top:2px">${esc(j.dorsal)}</b>`,
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

  const plantilla = resto.length && ligero >= 1
    ? enElPdf(`Los otros ${resto.length} jugadores de su plantilla, con su ficha`)
    : resto.length
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
      }${ligero >= 1 ? enElPdf("La semana tarea a tarea") : `<p style="margin:14px 0 6px;font:700 13px/1.3 Arial,sans-serif;color:${NAVY}">Tarea a tarea</p>${tabla(
        ["Día", "Tarea", "Fase", "Contenido", "Min.", "Nota"],
        m.tareas.map((t) => [
          `${esc(t.dia)} <span style="color:${SUAVE}">${esc(t.md)}</span>`,
          `<b>${esc(t.tarea)}</b>${t.tipo ? `<br><span style="color:${SUAVE}">${esc(t.tipo)}${t.formato ? ` · ${esc(t.formato)}` : ""}</span>` : ""}`,
          esc(t.fase),
          `${esc(t.contenido)}${t.secundario ? `<br><span style="color:${SUAVE}">${esc(t.secundario)}</span>` : ""}`,
          t.minutos ? `${t.minutos}′` : "—",
          t.evaluacion ? `<b>${t.evaluacion}</b>${t.analisis ? `<br><span style="color:${SUAVE}">${esc(t.analisis)}</span>` : ""}` : "—",
        ]),
      )}`}`
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
      }${
        extras.abpCuerpo ? enElPdf("El informe de balón parado del microciclo, entero y con sus gráficos") : `<p style="margin:10px 0 0;font:400 13px/1.5 Arial,sans-serif;color:${SUAVE}">El detalle de balón parado va en su propio informe, desde Microciclo de Balón Parado.</p>`
      }`
    : "";

  const abpEntero = extras.abpCuerpo && ligero < 2
    ? `<tr><td style="padding:26px 0 6px"><p style="margin:0 28px;font:700 12px/1.3 Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${ORO}">Balón parado · el informe del microciclo</p><p style="margin:4px 28px 12px;font:400 13px/1.5 Arial,sans-serif;color:${SUAVE}">El mismo informe que sale de Microciclo de Balón Parado, entero.</p>${extras.abpCuerpo}</td></tr>`
    : "";

  const enlace = (x: { nombre: string; url: string }) => `<a href="${esc(x.url)}" style="color:${ORO};font-weight:700">${esc(x.nombre)}</a>`;

  /* Los documentos que ya van arriba (adjuntos o con su botón) no se repiten aquí. */
  const yaArriba = new Set((extras.adjuntos ?? []).map((d) => d.url).filter(Boolean));

  const otrosDocs = inf.recursos.documentos.filter((d) => !yaArriba.has(d.url));

  const material = [
    ...(otrosDocs.length
      ? [`<p style="margin:12px 0 6px;font:700 13px/1.4 Arial,sans-serif;color:${NAVY}">Documentos del rival</p><p style="margin:0;font:400 13px/1.8 Arial,sans-serif">${otrosDocs.map(enlace).join(" · ")}</p>`]
      : []),
    ...(inf.recursos.videos.length
      ? [`<p style="margin:12px 0 6px;font:700 13px/1.4 Arial,sans-serif;color:${NAVY}">Vídeos del rival</p><p style="margin:0;font:400 13px/1.8 Arial,sans-serif">${inf.recursos.videos.map(enlace).join(" · ")}</p>`]
      : []),
  ].join("");

  const adjuntosTexto = material;

  /* «Lo que el informe no sabe» ya no va en el correo ni en los adjuntos
     (04/10/2026): se avisa a quien lo manda antes de enviar. */

  const titulo = `${esPost ? "Post partido" : "Previa"} · ${p.lado === "fuera" ? `${rival} - RM Castilla` : `RM Castilla - ${rival}`}`;

  /* ---------------- la cabecera ---------------- */

  const escudoImg = (url: string) => (url ? `<img src="${esc(url)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:contain;margin:0 auto">` : "");

  const [escIzq, escDer] = p.lado === "fuera" ? [ctx?.escudo ?? "", ctx?.escudoNuestro ?? ""] : [ctx?.escudoNuestro ?? "", ctx?.escudo ?? ""];

  const [nomIzq, nomDer] = p.lado === "fuera" ? [rival, "RM Castilla"] : ["RM Castilla", rival];

  const centro =
    esPost && p.gf !== null && p.gc !== null
      ? `<p style="margin:0;font:700 46px/1 Georgia,serif;color:#C8A96B">${p.lado === "fuera" ? `${p.gc} – ${p.gf}` : `${p.gf} – ${p.gc}`}</p>`
      : `<p style="margin:0;font:700 26px/1 Georgia,serif;color:#C8A96B">vs</p>`;

  const cifrasCabecera = ([] as ({ rotulo: string; valor: string; pie?: string } | null)[]).concat([
    pr ? { rotulo: esPost ? "Victoria que daba el pronóstico" : "Victoria según el pronóstico", valor: pct(pr.victoria), pie: esPost ? undefined : `${pct(pr.conPlan.victoria)} con el plan` } : null,
    pr ? { rotulo: "Goles esperados", valor: `${cifra(pr.esperados.nosotros, "decimal")} – ${cifra(pr.esperados.rival, "decimal")}`, pie: `más probable ${pr.marcador}` } : null,
    ctx?.nuestroPuesto && ctx.puesto ? { rotulo: "Clasificación", valor: `${ordinal(ctx.nuestroPuesto)} · ${ordinal(ctx.puesto)}`, pie: `${ctx.nuestrosPuntos} y ${ctx.puntos} pts` } : null,
    inf.microciclo ? { rotulo: "La semana", valor: `${inf.microciclo.totales.minutos}′`, pie: `${inf.microciclo.totales.tareas} tareas${inf.microciclo.totales.abpMinutos ? ` · ${inf.microciclo.totales.abpMinutos}′ de ABP` : ""}` } : null,
  ]).filter((x): x is { rotulo: string; valor: string; pie?: string } => Boolean(x));

  const cabecera = `<tr><td style="padding:30px 32px 26px;background:${NAVY}">
<p style="margin:0;font:700 11px/1.3 Arial,sans-serif;letter-spacing:.28em;color:#C8A96B">REAL MADRID CASTILLA</p>
<p style="margin:10px 0 0"><span style="display:inline-block;padding:5px 12px;border-radius:999px;background:#C8A96B;color:${NAVY};font:700 11px/1 Arial,sans-serif;letter-spacing:.2em">${esPost ? "POST PARTIDO" : "PREVIA DEL PARTIDO"}</span>${p.jornada ? ` <span style="font:700 11px/1 Arial,sans-serif;letter-spacing:.2em;color:#C9CFDA">&nbsp;JORNADA ${p.jornada}${inf.microciclo ? ` · MICROCICLO ${inf.microciclo.micro}` : ""}</span>` : ""}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr>
<td width="38%" align="center" valign="middle">${escudoImg(escIzq)}<p style="margin:8px 0 0;font:700 18px/1.2 Arial,sans-serif;color:#FFFFFF">${esc(nomIzq)}</p></td>
<td width="24%" align="center" valign="middle">${centro}</td>
<td width="38%" align="center" valign="middle">${escudoImg(escDer)}<p style="margin:8px 0 0;font:700 18px/1.2 Arial,sans-serif;color:#FFFFFF">${esc(nomDer)}</p></td>
</tr></table>
<p style="margin:20px 0 0;text-align:center;font:400 13px/1.4 Arial,sans-serif;color:#C9CFDA">${esc(p.fechaTexto)}</p>
<p style="margin:6px 0 0;text-align:center;font:700 17px/1.35 Arial,sans-serif;color:#F2E6C9">${esc(inf.sintesis.titular)}</p>
</td></tr>${
    cifrasCabecera.length ? `<tr><td style="padding:18px 32px 0">${tarjetas(cifrasCabecera)}</td></tr>` : ""
  }${
    pr?.idea && !esPost
      ? `<tr><td style="padding:16px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:14px 18px;border-left:4px solid #C8A96B;background:#FBF6EA"><p style="margin:0;font:700 11px/1.3 Arial,sans-serif;letter-spacing:.2em;color:${ORO}">LA IDEA</p><p style="margin:4px 0 0;font:700 16px/1.4 Arial,sans-serif;color:${NAVY}">${esc(pr.idea)}</p></td></tr></table></td></tr>`
      : ""
  }`;

  /* Las dos diapositivas del resumen, arriba: lo primero que se ve. */
  const diapositivas = extras.diapositivas?.length
    ? `<tr><td style="padding:22px 32px 0"><p style="margin:0 0 8px;font:700 11px/1.3 Arial,sans-serif;letter-spacing:.2em;color:${ORO}">EL RESUMEN EN DOS DIAPOSITIVAS</p>${extras.diapositivas
        .map((cid, i) => `<img src="cid:${esc(cid)}" alt="Diapositiva ${i + 1}" width="696" style="display:block;width:100%;max-width:696px;height:auto;border-radius:8px;margin:0 0 10px">`)
        .join("")}</td></tr>`
    : "";

  /* Los documentos, arriba y con botón: lo segundo que se busca. */
  const descargas = extras.adjuntos?.length
    ? `<tr><td style="padding:22px 32px 0">${bloqueDescargas(extras.adjuntos, extras.adjuntos.some((d) => d.adjunto) ? "Adjuntos y descargas" : "Documentos")}</td></tr>`
    : "";

  /* Los capítulos, cada uno con su clave: se pueden elegir al mandar. */
  const capitulos: Capitulo[] = (
    esPost
      ? /* El post cuenta el partido y lo cruza con lo que se preparó. El scouting
           entero del rival ya fue en la previa: aquí sólo lo que lo contrasta. */
        [
          { id: "esencial", titulo: "Lo esencial", html: seccion("Lo esencial", "Lo mismo que el resumen de dos diapositivas, en texto.", esencial) },
          { id: "cronica", titulo: "El partido", html: seccion("El partido", "Goles, cambios y tarjetas (BeSoccer).", cronica) },
          { id: "datos", titulo: "El partido en datos", html: seccion("El partido en datos", "Wyscout: lo nuestro, lo suyo y nuestra media de la temporada.", partidoDatos) },
          { id: "pronostico", titulo: "El pronóstico, frente al resultado", html: seccion("El pronóstico, frente al resultado", "Lo que daban los números de los dos antes del partido.", veredicto) },
          {
            id: "once",
            titulo: "Su once",
            html: seccion(`Su once${cr?.estructura ? ` · ${cr.estructura}` : ""}`, cr?.acierto ? "El que sacaron, frente al que habíamos previsto en Plantillas." : "El que sacaron (BeSoccer).", onceReal),
          },
          { id: "plan", titulo: "El plan, a revisión", html: seccion("El plan, a revisión", "Lo que nos propusimos en Preparación de Partido; la columna de la derecha es para cerrarlo en la reunión.", revision) },
          { id: "semana", titulo: "La semana que lo preparó", html: seccion("La semana que lo preparó", "El microciclo de la hoja de registro de tareas.", semana) },
          { id: "contexto", titulo: "Dónde quedamos", html: seccion("Dónde quedamos", "Clasificación y racha (BeSoccer).", contexto) },
          {
            id: "duelo",
            titulo: "Los dos en la temporada",
            html: seccion("Los dos en la temporada", `Wyscout, temporada ${inf.duelo?.temporada ?? ""}: media por partido y puesto entre los ${inf.duelo?.equipos ?? ""} del grupo. La barra es el percentil.`, duelo),
          },
          { id: "abp", titulo: "Balón parado", html: abpEntero || seccion("Balón parado", "", abp) },
          { id: "material", titulo: "Material del partido", html: seccion("Material del partido", "", adjuntosTexto) },
        ]
      : [
          { id: "esencial", titulo: "Lo esencial", html: seccion("Lo esencial", "Lo mismo que el resumen de dos diapositivas, en texto.", esencial) },
          { id: "contexto", titulo: `${rival}: su momento`, html: seccion(`${rival}: su momento`, "Clasificación, racha y quién marca (BeSoccer).", contexto) },
          { id: "pronostico", titulo: "El pronóstico y cómo lo inclinamos", html: seccion("El pronóstico y cómo lo inclinamos", "Lo que vienen siendo los dos, y lo que mueve cada parte del plan.", pronostico) },
          {
            id: "duelo",
            titulo: "El duelo en datos",
            html: seccion(
              "El duelo en datos",
              `Wyscout, temporada ${inf.duelo?.temporada ?? ""}: la media por partido de cada equipo y su puesto entre los ${inf.duelo?.equipos ?? ""} del grupo (1.º = el mejor). La barra es el percentil.`,
              duelo,
            ),
          },
          { id: "colectivo", titulo: `Cómo juega ${rival}`, html: seccion(`Cómo juega ${rival}`, "El análisis colectivo del cuerpo técnico (Scouting colectivo).", colectivo) },
          {
            id: "once",
            titulo: inf.once.fuente === "marcado" ? "Su once probable" : "Su último once",
            html: seccion(inf.once.fuente === "marcado" ? "Su once probable" : "Su último once", "Ficha, números de la temporada (BeSoccer) y lo que dice cada ficha.", once),
          },
          { id: "plantilla", titulo: "El resto de su plantilla", html: seccion("El resto de su plantilla", "Por minutos jugados.", plantilla) },
          { id: "plan", titulo: "Nuestro plan de partido", html: seccion("Nuestro plan de partido", "Preparación de Partido.", plan) },
          { id: "semana", titulo: "La semana", html: seccion("La semana", "El microciclo de la hoja de registro de tareas.", semana) },
          { id: "abp", titulo: "Balón parado", html: abpEntero || seccion("Balón parado", "", abp) },
          { id: "material", titulo: "Material del rival", html: seccion("Material del rival", "La plantilla, el informe del rival y sus vídeos, para abrirlos aparte.", adjuntosTexto) },
        ]
  ).filter((c) => c.html.trim());

  if (extras.soloLista) return { capitulos, html: "" };

  const elegidos = extras.capitulos ? capitulos.filter((c) => extras.capitulos!.includes(c.id)) : capitulos;

  /* El índice: qué trae este informe, numerado como sus capítulos (ABP entero no lleva número). */
  let n = 0;

  const indice =
    elegidos.length > 3
      ? `<tr><td style="padding:22px 32px 0"><p style="margin:0 0 8px;font:700 11px/1.3 Arial,sans-serif;letter-spacing:.2em;color:${ORO}">EN ESTE INFORME</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ECE8DE">${elegidos
          .map((c) => {
            const numerado = c.html.includes(NUMERO);

            if (numerado) n += 1;

            return `<tr><td width="34" style="padding:6px 0;border-bottom:1px solid #ECE8DE;font:700 12px/1.3 Georgia,serif;color:#C8A96B">${numerado ? String(n).padStart(2, "0") : "·"}</td><td style="padding:6px 0;border-bottom:1px solid #ECE8DE;font:400 13px/1.3 Arial,sans-serif;color:${NAVY}">${esc(c.titulo)}</td></tr>`;
          })
          .join("")}</table></td></tr>`
      : "";

  /* Lo que escribe quien lo manda, arriba y con su nombre. */
  const mensaje = extras.mensaje?.trim()
    ? `<tr><td style="padding:22px 32px 0">${bloqueMensaje(extras.mensaje, extras.firma)}</td></tr>`
    : "";

  const html = numera(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(titulo)}</title></head><body style="margin:0;padding:0;background:#EEEAE0">${preheader(extras.mensaje?.trim() ? extras.mensaje.trim().slice(0, 140) : `${inf.sintesis.titular}${pr?.idea && !esPost ? ` · ${pr.idea}` : ""}`)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEEAE0"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="760" cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;background:#FFFFFF;border-radius:12px;overflow:hidden">
${cabecera}
${mensaje}
${diapositivas}
${descargas}
${indice}
${elegidos.map((c) => c.html).join("\n")}
<tr><td style="padding:18px 28px 26px;font:400 11px/1.5 Arial,sans-serif;color:${SUAVE}">Real Madrid Castilla · cuerpo técnico. Generado desde la plataforma el ${esc(new Date(inf.generado).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }))}.</td></tr>
</table></td></tr></table></body></html>`);

  return { capitulos, html };
}

/** El informe extenso, en HTML de correo. */
export function informeHtml(inf: InformePartido, extras: ExtrasInforme = {}) {
  return piezasInforme(inf, extras).html;
}

/** Los capítulos que trae este informe (los que tienen algo), para elegirlos al mandar. */
export function capitulosDe(inf: InformePartido, extras: ExtrasInforme = {}) {
  return piezasInforme(inf, { ...extras, soloLista: true }).capitulos.map(({ id, titulo }) => ({ id, titulo }));
}

/** El correo del resumen: las dos diapositivas y una línea. */
/**
 * El correo del resumen: las dos diapositivas, lo esencial en texto y el PDF.
 *
 * En el móvil una diapositiva de 16:9 se lee mal a 360 px de ancho, así que
 * debajo va lo esencial escrito (la idea o el titular y las claves), que es
 * lo que se lee de verdad en el vestuario o en el autobús.
 */
export function resumenHtml(inf: InformePartido, cids: string[], opciones: { conCompleto?: boolean; descargas?: Descarga[]; mensaje?: string; firma?: string } = {}) {
  const p = inf.partido;

  const rival = p.rival || "el rival";

  const esPost = inf.momento === "post";

  const titulo = `${esPost ? "Post partido" : "Previa"} · ${p.lado === "fuera" ? `${rival} - RM Castilla` : `RM Castilla - ${rival}`}`;

  const marcador = esPost && p.gf !== null && p.gc !== null ? (p.lado === "fuera" ? `${p.gc} – ${p.gf}` : `${p.gf} – ${p.gc}`) : "";

  const subtitulo = [p.jornada ? `Jornada ${p.jornada}` : "", p.fechaTexto, marcador ? `Resultado ${marcador}` : ""].filter(Boolean).join(" · ");

  const titular = inf.sintesis.titular.replace(/[.\s]+$/, "");

  const idea = !esPost ? inf.pronostico?.idea ?? "" : "";

  const claves = inf.sintesis.claves.slice(0, 5);

  const textoClaves = claves.length
    ? `<tr><td style="padding:14px 4px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F1E3D;border-radius:10px"><tr><td style="padding:18px 20px">${
        idea
          ? `<p style="margin:0;font:700 11px/1.3 Arial,sans-serif;letter-spacing:.2em;color:#C8A96B">LA IDEA</p><p style="margin:4px 0 14px;font:700 17px/1.4 Arial,sans-serif;color:#F7F4EC">${esc(idea)}</p>`
          : ""
      }<p style="margin:0;font:700 11px/1.3 Arial,sans-serif;letter-spacing:.2em;color:#C8A96B">${esPost ? "LO QUE NOS DEJA" : "CLAVES DEL PARTIDO"}</p><ol style="margin:6px 0 0;padding-left:20px;font:400 15px/1.55 Arial,sans-serif;color:#E6E9EF">${claves
        .map((c) => `<li style="margin:0 0 4px">${esc(c)}</li>`)
        .join("")}</ol></td></tr></table></td></tr>`
    : "";

  const descargas = opciones.descargas?.length
    ? `<tr><td style="padding:14px 4px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:10px"><tr><td style="padding:16px 16px 8px">${bloqueDescargas(opciones.descargas, "Adjunto")}</td></tr></table></td></tr>`
    : "";

  const mensaje = opciones.mensaje?.trim() ? `<tr><td style="padding:4px 4px 14px">${bloqueMensaje(opciones.mensaje, opciones.firma)}</td></tr>` : "";

  const pie = opciones.conCompleto
    ? "El informe completo, con todo el detalle y sus documentos, llega en otro correo."
    : "Las dos diapositivas van también en PDF adjunto.";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(titulo)}</title></head><body style="margin:0;padding:0;background:#08111F">${preheader(opciones.mensaje?.trim() ? opciones.mensaje.trim().slice(0, 140) : `${titular}${idea ? ` · ${idea}` : ""}`)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08111F"><tr><td align="center" style="padding:20px 8px"><table role="presentation" width="960" cellpadding="0" cellspacing="0" style="width:100%;max-width:960px">
<tr><td style="padding:4px 4px 14px"><p style="margin:0;font:700 11px/1.3 Arial,sans-serif;letter-spacing:.24em;color:#C8A96B">REAL MADRID CASTILLA · ${esPost ? "POST PARTIDO" : "PREVIA"} · RESUMEN</p><p style="margin:6px 0 0;font:700 24px/1.25 Arial,sans-serif;color:#F7F4EC">${esc(titulo)}</p>${
    subtitulo ? `<p style="margin:4px 0 0;font:400 13px/1.4 Arial,sans-serif;color:#9AA3B2">${esc(subtitulo)}</p>` : ""
  }<p style="margin:10px 0 0;font:700 16px/1.4 Arial,sans-serif;color:#F2E6C9">${esc(titular)}.</p></td></tr>
${mensaje}
${cids.map((cid, i) => `<tr><td style="padding:6px 0"><img src="cid:${esc(cid)}" alt="Diapositiva ${i + 1}" width="960" style="display:block;width:100%;max-width:960px;height:auto;border-radius:10px"></td></tr>`).join("")}
${textoClaves}
${descargas}
<tr><td style="padding:16px 4px 4px;font:400 12px/1.5 Arial,sans-serif;color:#7D8798">${esc(pie)}</td></tr>
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

  if (inf.pronostico) {
    const pr = inf.pronostico;

    l.push("", "EL PRONÓSTICO", pr.lectura, ...pr.palancas.map((x) => `- ${x.momento}: ${x.objetivo} (+${Math.max(0, x.victoria)} pts de victoria)`));
  }
  if (inf.sintesis.veredicto) l.push("", inf.sintesis.veredicto);
  if (inf.sintesis.relato.length) l.push("", "CÓMO FUE", ...inf.sintesis.relato.map((v) => `- ${v}`));
  if (inf.sintesis.frenados.length) l.push("", "¿LOS FRENAMOS?", ...inf.sintesis.frenados.map((f) => `- ${f.bien ? "Sí" : "No"} · ${f.jugador.nombre}: ${f.texto}`));
  if (inf.sintesis.ventajas.length) l.push("", "DONDE SOMOS MEJORES", ...inf.sintesis.ventajas.map((v) => `- ${v}`));
  if (inf.momento !== "post" && inf.sintesis.amenazas.length) l.push("", "DONDE SON FUERTES ELLOS", ...inf.sintesis.amenazas.map((v) => `- ${v}`));
  if (inf.momento !== "post" && inf.sintesis.vigilar.length) l.push("", "A VIGILAR", ...inf.sintesis.vigilar.map((j) => `- ${j.dorsal} ${j.nombre} (${j.posicion})`));
  if (inf.sintesis.partido.length) l.push("", "EL PARTIDO EN DATOS", ...inf.sintesis.partido.map((v) => `- ${v}`));
  if (inf.microciclo) l.push("", `LA SEMANA: ${inf.microciclo.totales.tareas} tareas · ${inf.microciclo.totales.minutos}′${inf.microciclo.totales.abpMinutos ? ` · ${inf.microciclo.totales.abpMinutos}′ de ABP` : ""}`);

  return l.join("\n");
}
