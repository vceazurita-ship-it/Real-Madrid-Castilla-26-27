/**
 * Descarga de BeSoccer todo lo que lleva dentro el informe del rival y lo
 * guarda en Supabase (`app_documents`, clave `rivals:informe`).
 *
 *   node scripts/rivals-informe.mjs                todo el grupo
 *   node scripts/rivals-informe.mjs teruel huesca  sólo esos (slug o ID)
 *   node scripts/rivals-informe.mjs --solo-subir   reconstruye de la caché
 *   node scripts/rivals-informe.mjs --refrescar    vuelve a bajar los equipos
 *   node scripts/rivals-informe.mjs --refrescar-todo  también los partidos
 *   node scripts/rivals-informe.mjs --sin-subir    baja y no toca Supabase
 *
 * Qué se baja de cada equipo:
 *
 *   - la clasificación del grupo, en sus tres pestañas (total, local,
 *     visitante) — una sola vez, que es la misma para los diecinueve;
 *   - sus partidos de la temporada, con marcador, competición y fecha;
 *   - la ficha de cada partido: alineación con demarcación y nota, banquillo
 *     con quién entró, estructura, entrenador de aquel día, goles con su
 *     minuto, su autor y quién asistió, tarjetas y cambios. **Todos los de
 *     competición**, y amistosos sólo para rellenar mientras la temporada
 *     está empezando (ver `MINIMO_ONCES`);
 *   - entrenador y estadio de la página del club, y la trayectoria del
 *     entrenador de su propia ficha.
 *
 * Cada ficha se guarda por su id en `.cache/rivals-informe/partidos` y, una
 * vez el partido lleva unos días cerrado, no se vuelve a pedir: un partido
 * terminado no cambia. Por eso `--refrescar` refresca el calendario, la
 * clasificación y los partidos recientes, pero no reescribe la alineación de
 * un partido de agosto; para eso está `--refrescar-todo`. Esto es lo que hace
 * que quepan todas las jornadas sin que la pasada de cada noche crezca: un
 * equipo entero se rehace en siete segundos si no ha jugado nada nuevo.
 *
 * Lo que BeSoccer **no** da y por eso no está: los eventos de partidos viejos
 * —de una temporada pasada ya no queda ni el módulo, así que tarjetas, cambios
 * y goleadores se bajan cuando el partido es reciente o no se bajan nunca—.
 *
 * El asistente de cada gol sí lo da, al contrario de lo que se creía: no está
 * en la lista de todos los eventos, que es de donde se leía, sino en la pestaña
 * de goles de la ficha (`#events-goals`).
 *
 * ¿Por qué Supabase y no la hoja? Lo mismo que `rivals-stats.mjs`: la hoja
 * RIVALES escribe por nombre de columna y no tiene cabeceras para nada de
 * esto, así que un guardado ahí se descartaría en silencio devolviendo
 * `success: true`.
 *
 * Notas de scraping (ver la nota "besoccer-plantillas-rivales"):
 * - BeSoccer devuelve 406 sin cabeceras de navegador, y el `fetch` de Node
 *   falla de forma intermitente donde `curl --compressed` funciona siempre.
 * - Devuelve además 502 de vez en cuando sin motivo: se reintenta.
 * - Se deja ~1,2 s entre peticiones. Son ~19 × (1 + 8) páginas: unos minutos.
 * - La descarga se cachea en `.cache/rivals-informe/`, así que se puede cortar
 *   y reanudar sin repetir nada.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const CACHE_DIR = ".cache/rivals-informe";

const DOC_KEY = "rivals:informe";
const DOC_KIND = "rivals";

const TEMPORADA = "2026/27";
const COMPETICION = "Primera Federación · Grupo 2";

/**
 * Desde cuándo cuenta un partido como «de esta temporada».
 *
 * La pestaña de partidos de BeSoccer da el histórico entero del club —del
 * Teruel bajan más de noventa, de dos temporadas—, y el informe habla de ésta:
 * los amistosos de julio y todo lo que venga después. El 1 de julio es donde
 * corta cualquier calendario de fútbol español.
 *
 * Al cambiar de temporada se toca aquí y en `TEMPORADA`.
 */
const TEMPORADA_DESDE = "2026-07-01";

/** La clasificación del grupo. El año es el de cierre de temporada. */
const CLASIFICACION_URL =
  "https://es.besoccer.com/competicion/clasificacion/primera_division_rfef/2027/grupo2";

/*
| Los diecinueve del grupo, con el slug que usa BeSoccer.
|
| Es la misma tabla que `rivals-stats.mjs`: se repite en vez de importarse
| porque los dos scripts se corren sueltos y con meses de diferencia, y un
| fichero compartido entre dos `.mjs` de `scripts/` sólo añade un sitio más
| donde mirar cuando cambie un slug. Si cambia, cambia en los dos.
*/
const TEAM_SLUGS = {
  "RIV-01": "teruel",
  "RIV-02": "juventud-torremolinos",
  "RIV-03": "aguilas-cf",
  "RIV-04": "sant-andreu",
  "RIV-05": "ad-alcorcon",
  "RIV-06": "at-madrid-b",
  "RIV-07": "ibiza-eivissa",
  "RIV-08": "antequera",
  "RIV-09": "algeciras-cf",
  "RIV-10": "cartagena",
  "RIV-11": "hercules",
  "RIV-12": "gimnastic-tarragona",
  "RIV-13": "real-murcia",
  "RIV-14": "rayo-majadahonda",
  "RIV-15": "real-jaen",
  "RIV-16": "real-zaragoza",
  "RIV-17": "huesca",
  "RIV-18": "ce-europa",
  "RIV-19": "villarreal-b",
};

/**
 * De cuántos partidos se pide la ficha completa.
 *
 * Las dos diapositivas de alineaciones enseñan cuatro, y el informe cuenta las
 * estructuras sobre lo que se haya bajado: con ocho hay margen para que dos o
 * tres no tengan alineación publicada —los amistosos casi nunca la tienen— y
 * el recuento de estructuras sigue diciendo algo. Subirlo mucho más es pedir
 * medio centenar de páginas por equipo para pintar cuatro.
 */
/*
| Cuántos partidos se le piden a cada equipo.
|
| **Los oficiales van todos.** Antes se cogían los ocho últimos jugados y se
| acabó viendo lo que eso hacía: en agosto un equipo tenía siete partidos y
| cuatro se quedaban sin ficha, porque eran amistosos y BeSoccer no publica
| sus alineaciones. Se gastaban dos peticiones por cada uno para no traer
| nada, y en cuanto la liga pasara de ocho jornadas las de verdad empezarían
| a caerse por abajo.
|
| Así que ahora entran todas las de competición, sin tope, y los amistosos
| sólo rellenan hasta este mínimo mientras la temporada está empezando: en
| pretemporada son lo único que hay, y ahí sí valen.
*/
const MINIMO_ONCES = 8;

/*
| Un partido terminado hace días ya no cambia: la alineación, las notas, los
| goles y las tarjetas se quedan como están. Volver a bajarlo cada noche era
| tirar veinte minutos y cientos de peticiones a BeSoccer para reescribir lo
| mismo. Se guarda cada ficha por su id y no se vuelve a pedir.
|
| Los de los últimos tres días sí se repiten: BeSoccer tarda en cerrar las
| notas y a veces publica los cambios y las tarjetas al día siguiente.
*/
const DIAS_QUE_YA_NO_CAMBIAN = 3;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const args = process.argv.slice(2);

const flags = new Set(args.filter((arg) => arg.startsWith("--")));

/** Slugs o IDs sueltos en la línea de órdenes: se baja sólo eso. */
const filtro = new Set(args.filter((arg) => !arg.startsWith("--")));

const SOLO_SUBIR = flags.has("--solo-subir");
const REFRESCAR = flags.has("--refrescar") || flags.has("--refrescar-todo");

/* Tira también las fichas de partido ya guardadas. Casi nunca hace falta:
   sólo si cambia el parseo de las alineaciones o de los eventos. */
const REFRESCAR_TODO = flags.has("--refrescar-todo");

/** Baja y deja la caché, pero no toca Supabase. Para ajustar un parser. */
const SIN_SUBIR = flags.has("--sin-subir");

/* ------------------------------------------------------------------ */
/*  RED                                                                */
/* ------------------------------------------------------------------ */

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Una página de BeSoccer, con el código HTTP a la vista.
 *
 * El `-w` del final hace que curl escriba el estado detrás del cuerpo, y aquí
 * se separa. Sin eso, una respuesta rechazada llegaba como cadena vacía y el
 * script decía «vuelve a intentarlo» sin más: el 01/09/2026 la tarea nocturna
 * falló en nueve segundos y hubo que deducir por el reloj que BeSoccer estaba
 * cerrando la puerta al runner de GitHub, en vez de leerlo.
 */
function curlConEstado(url) {
  const MARCA = "\n@@ESTADO@@";

  const salida = execFileSync(
    "curl",
    [
      "-s",
      "--compressed",
      "--max-time",
      "45",
      "-H",
      `User-Agent: ${UA}`,
      "-H",
      "Accept: text/html,application/xhtml+xml",
      "-H",
      "Accept-Language: es-ES,es;q=0.9",
      "-w",
      `${MARCA}%{http_code}`,
      url,
    ],
    { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
  );

  const corte = salida.lastIndexOf(MARCA);

  if (corte === -1) return { cuerpo: salida, estado: 0 };

  return {
    cuerpo: salida.slice(0, corte),
    estado: Number(salida.slice(corte + MARCA.length).trim()) || 0,
  };
}

function curl(url) {
  return curlConEstado(url).cuerpo;
}

/**
 * Una página, con reintentos.
 *
 * BeSoccer contesta 502 de vez en cuando a peticiones que funcionan al
 * segundo intento —lo hace con las fichas de partido más que con nada—, y una
 * página perdida aquí es una alineación que falta en el informe. Se distingue
 * por el `<title>`, que es lo único que trae esa respuesta.
 */

/* El último código HTTP que contestó BeSoccer. Se guarda para poder explicar
   por qué una descarga se ha quedado sin nada: un 403 desde un servidor es
   bloqueo por IP y no un fallo pasajero que se arregle reintentando. */
let ultimoEstado = 0;

async function pagina(url, intentos = 3) {
  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      const { cuerpo: html, estado } = curlConEstado(url);

      ultimoEstado = estado;

      if (html && estado === 200 && !/<title>Besoccer-50[0-9]/.test(html)) {
        return html;
      }
    } catch (error) {
      if (intento === intentos) throw error;
    }

    if (intento < intentos) await espera(2500 * intento);
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  HTML A PELO                                                        */
/* ------------------------------------------------------------------ */

/*
| Nada de un parser de DOM: es lo mismo que hace `rivals-stats.mjs` y por el
| mismo motivo —una dependencia menos en un script que se corre a mano dos
| veces al año—. BeSoccer genera el HTML con plantillas y los atributos que se
| buscan aquí (`data-cy`, `class`) llevan años sin moverse.
*/

const ENTIDADES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ntilde: "ñ",
  Ntilde: "Ñ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  uuml: "ü",
  agrave: "à",
  egrave: "è",
  ccedil: "ç",
};

function limpia(valor) {
  return String(valor ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&([a-zA-Z]+);/g, (entero, nombre) => ENTIDADES[nombre] ?? entero)
    .replace(/\s+/g, " ")
    .trim();
}

const numero = (valor) => {
  const encontrado = String(valor ?? "").match(/-?\d+/);

  return encontrado ? Number(encontrado[0]) : 0;
};

/** Todos los trozos entre una apertura y su cierre, sin anidar. */
function trozos(html, apertura, cierre) {
  const partes = [];

  let desde = 0;

  for (;;) {
    const inicio = html.indexOf(apertura, desde);

    if (inicio === -1) break;

    const fin = html.indexOf(cierre, inicio + apertura.length);

    if (fin === -1) break;

    partes.push(html.slice(inicio + apertura.length, fin));
    desde = fin + cierre.length;
  }

  return partes;
}

/** El trozo que va de una marca a la siguiente (o al final). */
function seccion(html, marca, siguiente) {
  const inicio = html.indexOf(marca);

  if (inicio === -1) return "";

  const fin = siguiente ? html.indexOf(siguiente, inicio + marca.length) : -1;

  return html.slice(inicio, fin === -1 ? html.length : fin);
}

/* ------------------------------------------------------------------ */
/*  CLASIFICACIÓN                                                      */
/* ------------------------------------------------------------------ */

/**
 * Una de las tres tablas de la clasificación.
 *
 * Las tres van en el mismo HTML, en `#tab_total0`, `#tab_local0` y
 * `#tab_visitor0`, y son idénticas: puesto, escudo, nombre, Pts, PJ, PG, PE,
 * PP, GF, GC y diferencia. La diferencia no se guarda porque sale de restar.
 */
function leeTabla(html, id, siguienteId) {
  const bloque = seccion(html, `id="${id}"`, siguienteId ? `id="${siguienteId}"` : "");

  if (!bloque) return [];

  const filas = [];

  for (const fila of trozos(bloque, '<tr class="row-body', "</tr>")) {
    const celdas = trozos(fila, "<td", "</td>").map((celda) =>
      limpia(celda.slice(celda.indexOf(">") + 1))
    );

    /* Las tres primeras celdas son puesto, escudo y nombre; las ocho que
       siguen, los números. Con menos de once la fila no es de datos. */
    if (celdas.length < 11) continue;

    const escudo = (fila.match(/img_data\/equipos\/(\d+)\.png/) ??
      fila.match(/img_data\/escudos\/[a-z_]+\/(\d+)\.jpg/)) || [];

    const enlace = fila.match(/besoccer\.com\/equipo\/([a-z0-9-]+)/);

    const nombre = fila.match(/<span class="team-name">([^<]*)<\/span>/);

    filas.push({
      puesto: numero(celdas[0]),
      equipo: limpia(nombre?.[1] ?? celdas[2]),
      escudo: escudo[1]
        ? `https://cdn.resfu.com/img_data/equipos/${escudo[1]}.png`
        : "",
      slug: enlace?.[1] ?? "",
      puntos: numero(celdas[3]),
      jugados: numero(celdas[4]),
      ganados: numero(celdas[5]),
      empatados: numero(celdas[6]),
      perdidos: numero(celdas[7]),
      favor: numero(celdas[8]),
      contra: numero(celdas[9]),
    });
  }

  return filas;
}

export function leeClasificacion(html) {
  return {
    total: leeTabla(html, "tab_total0", "tab_local0"),
    local: leeTabla(html, "tab_local0", "tab_visitor0"),
    visitante: leeTabla(html, "tab_visitor0", ""),
  };
}

/* ------------------------------------------------------------------ */
/*  PARTIDOS DEL EQUIPO                                                */
/* ------------------------------------------------------------------ */


export function leePartidos(html, slug) {
  const partidos = [];

  /* Sólo el panel de partidos del equipo: la portada de BeSoccer trae arriba
     los de otras ligas con la misma clase `match-link`. */
  const bloque = seccion(html, '<h2 class="panel-title">Partidos</h2>', "");

  for (const enlace of trozos(bloque, '<a id="match-', "</a>")) {
    const id = enlace.slice(0, enlace.indexOf('"'));

    if (!/^\d+$/.test(id)) continue;

    const fecha = enlace.match(/starttime="([^"]+)"/)?.[1] ?? "";

    const competicion = limpia(
      enlace.match(/<div class="middle-info ta-c">([^<]*)<\/div>/)?.[1] ?? ""
    );

    const equipos = trozos(enlace, '<div class="team-info', "</div>\n        </div>");

    /* El marcador va en `<span class='r1'>` y `<span class='r2'>`; sin ellos
       el partido no se ha jugado y no hay nada que leer. */
    const marca = enlace.match(/<span class='r1'>(\d+)<\/span>-<span class='r2'>(\d+)<\/span>/);

    /* Los dos escudos y los dos nombres, en orden de aparición: local y
       visitante. Se leen del enlace entero porque el recorte de `team-info` es
       frágil —el cierre depende del sangrado— y aquí basta con el orden. */
    const escudos = [...enlace.matchAll(/img_data\/escudos\/[a-z_]+\/(\d+)\.jpg/g)].map(
      (m) => `https://cdn.resfu.com/img_data/equipos/${m[1]}.png`
    );

    const nombres = [...enlace.matchAll(/<div class="name">([^<]*)<\/div>/g)].map((m) =>
      limpia(m[1])
    );

    /* El slug de cada equipo sale de la URL del partido:
       `/partido/<local>/<visitante>/<id>`. */
    const ruta = enlace.match(/besoccer\.com\/partido\/([a-z0-9-]+)\/([a-z0-9-]+)\//);

    const local = {
      nombre: nombres[0] ?? "",
      escudo: escudos[0] ?? "",
      slug: ruta?.[1] ?? "",
      goles: marca ? Number(marca[1]) : null,
    };

    const visitante = {
      nombre: nombres[1] ?? "",
      escudo: escudos[1] ?? "",
      slug: ruta?.[2] ?? "",
      goles: marca ? Number(marca[2]) : null,
    };

    if (!local.nombre || !visitante.nombre) continue;

    const enCasa = local.slug === slug || (!visitante.slug && !local.slug);

    const jugado = Boolean(marca);

    const propios = enCasa ? local.goles : visitante.goles;
    const ajenos = enCasa ? visitante.goles : local.goles;

    partidos.push({
      id,
      fecha,
      competicion,
      local,
      visitante,
      jugado,
      enCasa,
      resultado: !jugado
        ? ""
        : propios > ajenos
          ? "G"
          : propios === ajenos
            ? "E"
            : "P",
    });

  }

  /* Sólo esta temporada, y de la primera jornada a la última: es como se lee
     un calendario. Un partido sin fecha se queda fuera —no se puede colocar ni
     saber de qué año es—, y no los hay entre los jugados. */
  return partidos
    .filter((partido) => partido.fecha >= TEMPORADA_DESDE)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/* ------------------------------------------------------------------ */
/*  ENTRENADOR Y ESTADIO                                               */
/* ------------------------------------------------------------------ */

export function leeEntrenador(html) {
  const bloque = seccion(html, 'id="mod_coachStats"', 'id="mod_');

  if (!bloque) return null;

  const foto = bloque.match(/img_data\/people\/original\/(\d+)\.jpg/);

  const nombre = limpia(bloque.match(/data-cy="coach">[\s\S]*?<b>([^<]*)<\/b>/)?.[1] ?? "");

  if (!nombre) return null;

  /* Las cuatro columnas de la derecha van en el mismo orden siempre:
     partidos, ganados, empatados y perdidos. Se leen por su `main-line`. */
  const cifras = [...bloque.matchAll(/<div class="main-line[^"]*"><b>(\d+)<\/b><\/div>/g)].map(
    (m) => Number(m[1])
  );

  return {
    nombre,
    foto: foto?.[1]
      ? `https://cdn.resfu.com/img_data/people/original/${foto[1]}.jpg`
      : "",
    edad: limpia(bloque.match(/<p class="color-grey2 fs13">([^<]*a[ñn]os)<\/p>/)?.[1] ?? "")
      .replace(/\s*años?/i, ""),
    /* Su ficha, para la trayectoria: es donde está por dónde ha pasado. */
    ficha: bloque.match(/href="(https:\/\/es\.besoccer\.com\/entrenador\/[^"]+)"/)?.[1] ?? "",
    nacimiento: limpia(
      bloque.match(/<p class="color-grey2 fs13 mb5">(\d{2}\/\d{2}\/\d{4})<\/p>/)?.[1] ?? "",
    ),
    partidos: cifras[0] ?? 0,
    ganados: cifras[1] ?? 0,
    empatados: cifras[2] ?? 0,
    perdidos: cifras[3] ?? 0,
    trayectoria: [],
  };
}

export function leeEstadio(html) {
  const bloque = seccion(html, 'id="mod_stadium"', 'id="mod_');

  if (!bloque) return null;

  const nombre = limpia(bloque.match(/<div class="name"><b>([^<]*)<\/b><\/div>/)?.[1] ?? "");

  if (!nombre) return null;

  /* Las filas de la tabla son «etiqueta / valor» y no siempre están las tres:
     un campo sin año de construcción se salta esa fila entera. Se leen de una
     pasada y no recortando por el `</div>` de cierre, que va sangrado y
     cambia de un módulo a otro. */
  const datos = {};

  const filas = bloque.matchAll(
    /<div class="table-row">\s*<div>([^<]*)<\/div>\s*<div>([^<]*)<\/div>/g
  );

  for (const fila of filas) {
    datos[limpia(fila[1]).toLowerCase()] = limpia(fila[2]);
  }

  const foto = bloque.match(/img_data\/estadios\/[a-z_]+\/(\d+)\.jpg/);

  return {
    nombre,
    ciudad: limpia(bloque.match(/<div class="city mv5">([^<]*)<\/div>/)?.[1] ?? ""),
    direccion: limpia(
      bloque.match(/<div class="address color-grey2">([^<]*)<\/div>/)?.[1] ?? ""
    ),
    construccion: datos["fecha de construcción"] ?? "",
    capacidad: datos["capacidad"] ?? "",
    tamano: datos["tamaño"] ?? "",
    foto: foto?.[1]
      ? `https://cdn.resfu.com/img_data/estadios/original_new/${foto[1]}.jpg`
      : "",
  };
}

/* ------------------------------------------------------------------ */
/*  FICHA DE UN PARTIDO: ALINEACIONES Y GOLES                          */
/* ------------------------------------------------------------------ */

/**
 * La alineación de un equipo dentro de la ficha del partido.
 *
 * Las dos van en `<ul class="lineup local">` y `<ul class="lineup visitor">`,
 * con la estructura en `data-tacticName` y un `<li class="posN">` por jugador.
 * El `posN` es lo que coloca la ficha en el campo: 1 es el portero.
 */
export function leeAlineacion(html, visitante) {
  const marca = visitante ? 'class="lineup visitor"' : 'class="lineup local"';

  const inicio = html.indexOf(marca);

  if (inicio === -1) return null;

  const abre = html.lastIndexOf("<ul", inicio);
  const cierra = html.indexOf("</ul>", inicio);

  if (abre === -1 || cierra === -1) return null;

  const bloque = html.slice(abre, cierra);

  const estructura = bloque.match(/data-tacticName="([^"]*)"/)?.[1] ?? "";

  const jugadores = [];

  for (const li of trozos(bloque, '<li class="pos', "</li>")) {
    const puesto = numero(li);

    const foto = li.match(/img_data\/players\/medium\/(\d+)\.jpg/);

    const dorsal = li.match(/<div class="name num-lineups">\s*<span class="bold">(\d+)<\/span>/);

    const nombre = li.match(/<div class="name name-lineups">([^<]*)<\/div>/);

    if (!nombre) continue;

    jugadores.push({
      puesto,
      dorsal: dorsal?.[1] ?? "",
      nombre: limpia(nombre[1]),
      foto: foto?.[1]
        ? `https://cdn.resfu.com/img_data/players/medium/${foto[1]}.jpg`
        : "",
      /* La demarcación va en el `jobtitle` del JSON-LD que BeSoccer mete en
         cada ficha. Con ella se calcula la estructura con la que **acaba** el
         partido, que es lo que cambia cuando entra un delantero por un medio y
         lo que el `data-tacticName` no dice: ése es siempre el de salida. */
      demarcacion: demarcacionDe(li.match(/"jobtitle":\s*"([^"]*)"/)?.[1] ?? ""),
      /* La nota de BeSoccer, que es de lo poco que ordena a los jugadores de
         un vistazo cuando no se ha visto el partido. */
      nota: li.match(/<div class="match-points"[^>]*>([\d.]+)<\/div>/)?.[1] ?? "",
    });
  }

  if (jugadores.length === 0) return null;

  return {
    /* "4-2-3-1" se enseña como "1-4-2-3-1": el uno es el portero y es como lo
       escribe el cuerpo técnico en la pizarra. */
    estructura: estructura ? `1-${estructura}` : "",
    jugadores: jugadores.sort((a, b) => a.puesto - b.puesto).slice(0, 11),
  };
}

/**
 * Portero, defensa, medio o delantero.
 *
 * BeSoccer mezcla el español y el inglés en el mismo campo —"Defensa" y
 * "midfielder" salen en la misma alineación—, así que se miran las dos formas.
 * Lo que no se reconozca se queda vacío y no cuenta para la estructura.
 */
function demarcacionDe(valor) {
  const texto = String(valor ?? "").toLowerCase();

  if (/portero|goalkeeper|keeper/.test(texto)) return "PT";
  if (/defen|back/.test(texto)) return "DF";
  if (/medio|midfiel|centrocamp/.test(texto)) return "MC";
  if (/delantero|forward|striker|attack/.test(texto)) return "DL";

  return "";
}

/** La misma demarcación, pero como la escribe el banquillo: "PT", "DF"… */
function demarcacionBanquillo(valor) {
  const texto = String(valor ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (texto.startsWith("PT") || texto.startsWith("POR")) return "PT";
  if (texto.startsWith("DF") || texto.startsWith("DEF")) return "DF";
  if (texto.startsWith("MED") || texto.startsWith("MC")) return "MC";
  if (texto.startsWith("DEL") || texto.startsWith("DL")) return "DL";

  return "";
}

/**
 * Los suplentes de la convocatoria, y cuáles entraron.
 *
 * Van en `#mod_lineupBench`, en `<a class="col-bench local|visitor">`. El que
 * entró lleva dentro el icono «Entra» con su minuto, así que la convocatoria y
 * los cambios se leen de la misma tirada.
 */
export function leeSuplentes(html, visitante) {
  const bloque = seccion(html, 'id="mod_lineupBench"', 'id="mod_sticky"') || html;

  const lado = visitante ? "visitor" : "local";

  const suplentes = [];

  for (const trozo of trozos(bloque, '<a href="https://es.besoccer.com/jugador/', "</a>")) {
    if (!trozo.includes(`class="col-bench ${lado}`)) continue;

    const nombre = limpia(trozo.match(/<p class="name">([^<]*)<\/p>/)?.[1] ?? "");

    if (!nombre) continue;

    const foto = trozo.match(/img_data\/players\/medium\/(\d+)\.jpg/);

    const rol = trozo.match(
      /<span class="number bold mr3">(\d+)<\/span>\s*([A-Za-zÁÉÍÓÚÑ]*)/,
    );

    const entra = /alt="Entra"/.test(trozo)
      ? limpia(trozo.match(/<p class="min">([^<]*)<\/p>/)?.[1] ?? "").replace(/['’]/g, "")
      : "";

    suplentes.push({
      dorsal: rol?.[1] ?? "",
      nombre,
      foto: foto?.[1]
        ? `https://cdn.resfu.com/img_data/players/medium/${foto[1]}.jpg`
        : "",
      demarcacion: demarcacionBanquillo(rol?.[2] ?? ""),
      nota: trozo.match(/<div class="match-points"[^>]*>([\d.]+)<\/div>/)?.[1] ?? "",
      entra,
    });
  }

  return suplentes;
}

/**
 * Una fila de la lista de eventos: minuto, de qué lado y quién.
 *
 * Las listas —goles, tarjetas y sustituciones— comparten forma:
 * `<div class="table-played-match">` con el jugador en un `col-side`, el
 * minuto en medio y una flecha que dice de qué equipo es. La flecha es lo
 * fiable: el lado izquierdo puede venir vacío y maquetado igual.
 */
function filasDeEventos(html, id) {
  const desdeAqui = html.indexOf(`id="${id}"`);

  if (desdeAqui === -1) return [];

  /*
  | El bloque acaba donde empiece **la pestaña siguiente, sea cual sea**.
  |
  | Se cortaba por una marca concreta ("los goles acaban donde empiezan las
  | tarjetas") y eso se rompe de dos maneras: un partido sin tarjetas no trae
  | `events-cards` y se leía media página de más, y un partido con VAR mete un
  | `events-var` en medio que nadie esperaba —los goles anulados que revisó el
  | árbitro se colaban como goles, y un 2-2 salía con cinco goleadores—.
  |
  | Enumerar las pestañas es perder: BeSoccer añade las que quiera. Lo que no
  | cambia es que todas se llaman `events-…`, así que se corta por la primera
  | que aparezca por detrás.
  */
  const siguiente = html.indexOf('id="events-', desdeAqui + 1);

  const stats = html.indexOf('id="mod_stats"', desdeAqui + 1);

  const cierres = [siguiente, stats].filter((donde) => donde > desdeAqui);

  const bloque = html.slice(
    desdeAqui,
    cierres.length > 0 ? Math.min(...cierres) : html.length,
  );

  if (!bloque) return [];

  const filas = [];

  const MARCA = '<div class="table-played-match"';

  let desde = bloque.indexOf(MARCA);

  while (desde !== -1) {
    const siguiente = bloque.indexOf(MARCA, desde + MARCA.length);

    const fila = bloque.slice(desde, siguiente === -1 ? bloque.length : siguiente);

    /*
    | El minuto y la flecha van en la columna del medio. El jugador va **a un
    | lado o al otro**: a la izquierda si el evento es del local y a la derecha
    | si es del visitante, así que los nombres se buscan en la fila entera y no
    | sólo antes de la columna del medio —hacerlo así dejaba fuera todos los
    | cambios del equipo visitante—.
    */
    const medio = fila.indexOf('<div class="col-mid-rows"');

    const cola = medio === -1 ? "" : fila.slice(medio, medio + 900);

    filas.push({
      cabeza: fila,
      minuto: limpia(cola.match(/<div class="min[^"]*">\s*([^<]*?)\s*<\/div>/)?.[1] ?? "")
        .replace(/['’]/g, ""),
      /* La flecha es lo fiable: la columna de la izquierda viene maquetada
         igual esté vacía o no. */
      visitante: /<span class="arrow right">/.test(cola),
    });

    desde = siguiente;
  }

  return filas;
}

/** Las tarjetas del partido, de un equipo. */
export function leeTarjetas(html, visitante) {
  const tarjetas = [];

  for (const fila of filasDeEventos(html, "events-cards")) {
    if (fila.visitante !== visitante) continue;

    const alt = fila.cabeza.match(/<img alt="(Tarjeta[^"]*|Doble[^"]*)"/)?.[1] ?? "";

    if (!alt) continue;

    const jugador = limpia(
      fila.cabeza.match(/data-cy="event"[^>]*>([^<]*)<\/a>/)?.[1] ?? "",
    );

    if (!jugador) continue;

    tarjetas.push({
      minuto: fila.minuto,
      jugador,
      /* "Tarjeta amarilla", "Segunda amarilla" y "Tarjeta roja": lo que hace
         falta saber es si acabó el partido, así que las dos últimas son roja. */
      tipo: /amarilla/i.test(alt) && !/doble|segunda/i.test(alt) ? "amarilla" : "roja",
      motivo: limpia(
        fila.cabeza.match(/<p class="align-middle name color-grey2">\s*([^<]*)<\/p>/)?.[1] ?? "",
      ),
    });
  }

  return tarjetas;
}

/**
 * Las sustituciones, con quién sale y quién entra.
 *
 * Quién es quién se saca del `<ul>` del desplegable, donde BeSoccer marca con
 * `event-19` al que **entra** y con `event-18` al que sale —lo mismo que el
 * `field_ico_accion19.png` que lleva el suplente que saltó al campo, cuyo
 * `alt` es «Entra»—. Los dos enlaces visibles van en ese mismo orden: primero
 * el que entra y en gris el que sale.
 */
export function leeCambios(html, visitante) {
  const cambios = [];

  for (const fila of filasDeEventos(html, "events-changes")) {
    if (fila.visitante !== visitante) continue;

    const enlaces = [
      ...fila.cabeza.matchAll(/popup_btn"[^>]*data-cy="event"[^>]*>\s*([^<]*?)\s*<\/a>/g),
    ].map((coincidencia) => limpia(coincidencia[1]));

    const listado = [
      ...fila.cabeza.matchAll(
        /<a class="main-text[^"]*"[^>]*>\s*([^<]*?)\s*<\/a>\s*<\/div>\s*<div class="right-content">\s*<div class="img-ico event-(\d+)">/g,
      ),
    ];

    const entra = listado.find((uno) => uno[2] === "19")?.[1] ?? enlaces[0] ?? "";

    const sale = listado.find((uno) => uno[2] === "18")?.[1] ?? enlaces[1] ?? "";

    if (!sale && !entra) continue;

    cambios.push({ minuto: fila.minuto, sale: limpia(sale), entra: limpia(entra) });
  }

  return cambios;
}

/**
 * La trayectoria del entrenador: por dónde ha pasado y con qué números.
 *
 * Se pide su ficha (`/entrenador/<slug>`), que trae la tabla «Equipos
 * entrenados» con las tres pestañas montadas en el mismo `<tr>`: duración,
 * encuentros y rendimiento. Se lee de una pasada y se queda con lo que se
 * enseña en el informe.
 */
export function leeTrayectoria(html) {
  const bloque = seccion(html, "Equipos entrenados", "Debuts por equipo");

  if (!bloque) return [];

  const etapas = [];

  for (const fila of trozos(bloque, '<tr class="row-body">', "</tr>")) {
    const equipo = limpia(
      fila.match(/<a href="https:\/\/es\.besoccer\.com\/equipo\/[^"]*"\s*>([^<]*)<\/a>/)?.[1] ?? "",
    );

    if (!equipo) continue;

    const celdas = [...fila.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((una) =>
      limpia(una[1].replace(/<[^>]*>/g, " ")),
    );

    const escudo = fila.match(/img_data\/escudos\/medium\/(\d+)\.jpg/);

    /* El orden de las columnas es fijo: escudo, equipo, PEnt, desde, hasta,
       PG, PE, PP y la táctica preferida. */
    etapas.push({
      equipo,
      escudo: escudo?.[1]
        ? `https://cdn.resfu.com/img_data/escudos/medium/${escudo[1]}.jpg`
        : "",
      partidos: numero(celdas[2] ?? ""),
      desde: celdas[3] ?? "",
      hasta: celdas[4] ?? "",
      ganados: numero(celdas[5] ?? ""),
      empatados: numero(celdas[6] ?? ""),
      perdidos: numero(celdas[7] ?? ""),
      tactica: celdas[8] ?? "",
    });
  }

  return etapas;
}

/** El entrenador que firmó aquella alineación. */
export function leeEntrenadorPartido(html, visitante) {
  const entrenadores = [
    ...html.matchAll(/data-cy="coach[LR]Field"><b>([^<]*)<\/b>/g),
  ].map((m) => limpia(m[1]));

  return entrenadores[visitante ? 1 : 0] ?? "";
}

/**
 * Los goles del partido, con minuto, autor y quién lo asistió.
 *
 * Se leen de la **pestaña de goles** (`#events-goals`), no de la lista de
 * todos los eventos. Antes se sacaban de `#orderMin`, que es la lista
 * completa, y eso costaba dos cosas:
 *
 * - Los **goles anulados** llevan el mismo icono de la familia «Gol»
 *   (`accion14.png`, alt «Gol anulado»), así que se colaban: un 0-0 salía con
 *   un goleador y un 2-0 con tres goles. En la pestaña de goles no están.
 * - Los goles del equipo visitante van maquetados con un desplegable dentro,
 *   y el troceo por marcas de cierre exactas los partía por la mitad: había
 *   partidos enteros —CE Europa 0-3 Real Jaén— sin un solo goleador leído.
 *
 * De propina, la pestaña de goles trae **el asistente** en el desplegable: el
 * que marca va con el icono `event-1` y quien se la puso con `event-22`, y en
 * los enlaces visibles el segundo va en gris. Eso sí lo publica BeSoccer en
 * Primera Federación, al revés de lo que se creía cuando esto se escribió.
 */
export function leeGoles(html, visitante) {
  const goles = [];

  for (const fila of filasDeEventos(html, "events-goals")) {
    const alt =
      fila.cabeza.match(/<img alt="(Gol[^"]*)"/)?.[1] ??
      fila.cabeza.match(/events\/[a-z0-9_]+\.png" alt="(Gol[^"]*)"/)?.[1] ??
      "";

    if (!alt) continue;

    /* Por si algún día los anulados entran en esta pestaña. */
    if (/anulad/i.test(alt)) continue;

    /*
    | Los dos nombres visibles de la fila: el que marca y, en gris, el que
    | asiste. El enlace del retrato no lleva "name" en la clase, así que no
    | entra aquí.
    */
    const nombres = [
      ...fila.cabeza.matchAll(
        /<a class="align-middle name ([^"]*)"[^>]*data-cy="event"[^>]*>\s*([^<]*?)\s*<\/a>/g,
      ),
    ].map((uno) => ({ gris: /color-grey2/.test(uno[1]), nombre: limpia(uno[2]) }));

    const jugador = nombres.find((uno) => !uno.gris)?.nombre ?? "";

    if (!jugador) continue;

    const asistente = nombres.find((uno) => uno.gris)?.nombre ?? "";

    /*
    | El lado se lee tal cual, **también en los goles en propia puerta**.
    |
    | En la lista de todos los eventos BeSoccer pinta el gol en propia del lado
    | del que se la mete, y por eso el lector antiguo lo invertía. En la pestaña
    | de goles no: la flecha señala al equipo que **suma** el tanto. Comprobado
    | con el Águilas 2-2 Alcorcón, donde invirtiéndolo salía un 1-3.
    |
    | El nombre que se guarda sigue siendo el del que la metió, que es lo que
    | se escribe en la hoja de resultados; el tipo dice que fue en propia y la
    | diapositiva lo rotula «(PP)».
    */
    const enPropia = /propia/i.test(alt);

    goles.push({
      minuto: fila.minuto,
      jugador,
      asistente,
      propio: fila.visitante === visitante,
      tipo: enPropia ? "propia" : /penalti/i.test(alt) ? "penalti" : "",
    });
  }

  /* De más tarde a más temprano no: la hoja los lee por minuto. */
  return goles.sort((a, b) => minutoDeEvento(a.minuto) - minutoDeEvento(b.minuto));
}

/**
 * Comprueba que los goleadores leídos cuadran con el marcador, y avisa.
 *
 * La diapositiva de resultados escribe los goleadores debajo de cada equipo, y
 * una lista que no cuadra con el resultado se ve a la primera en una charla:
 * un 2-2 con tres nombres. Se cuenta aquí, en la descarga, para que salte en la
 * consola de quien la corre y no en el proyector.
 *
 * Lo único que se corrige solo es **el lado de un gol en propia puerta**, que
 * es lo único que se lee por convenio y no por un dato: si invirtiéndolos el
 * marcador cuadra, se invierten. Lo demás se avisa y se deja como está: una
 * ficha a la que le falta un gol es un dato que no publica BeSoccer, no algo
 * que se pueda adivinar aquí.
 */
function cuadraConElMarcador(goles, partido) {
  const propios = (partido.enCasa ? partido.local.goles : partido.visitante.goles) ?? 0;
  const ajenos = (partido.enCasa ? partido.visitante.goles : partido.local.goles) ?? 0;

  const cuenta = (lista) => [
    lista.filter((gol) => gol.propio).length,
    lista.filter((gol) => !gol.propio).length,
  ];

  const [a, b] = cuenta(goles);

  if (a === propios && b === ajenos) return goles;

  const enPropia = goles.filter((gol) => gol.tipo === "propia");

  /* La flecha de la pestaña de goles señala a quien suma el tanto, también en
     los goles en propia. Si algún día cambiaran de criterio, esto lo salva. */
  if (enPropia.length > 0) {
    const alReves = goles.map((gol) =>
      gol.tipo === "propia" ? { ...gol, propio: !gol.propio } : gol,
    );

    const [c, d] = cuenta(alReves);

    if (c === propios && d === ajenos) {
      console.warn(
        `    ojo: ${partido.id} cuadra invirtiendo ${enPropia.length} gol(es) en propia puerta`,
      );

      return alReves;
    }
  }

  /* Sin ningún gol leído es que BeSoccer ya no publica la ficha: eso pasa con
     los partidos viejos y no es un fallo de lectura. */
  if (goles.length === 0 && propios + ajenos > 0) {
    console.warn(`    ${partido.id}: sin goleadores publicados (${propios}-${ajenos})`);

    return goles;
  }

  console.warn(
    `    ojo: ${partido.id} marcador ${propios}-${ajenos} pero se han leído ${a}-${b} goleadores`,
  );

  return goles;
}

/** "90+2" es el minuto 92 a efectos de ordenar. */
function minutoDeEvento(valor) {
  const partes = String(valor ?? "").split("+");

  return (Number(partes[0]) || 0) + (Number(partes[1]) || 0);
}

/* ------------------------------------------------------------------ */
/*  CACHÉ                                                              */
/* ------------------------------------------------------------------ */

function rutaCache(nombre) {
  return path.join(CACHE_DIR, `${nombre}.json`);
}

function leeCache(nombre) {
  if (REFRESCAR) return null;

  try {
    return JSON.parse(fs.readFileSync(rutaCache(nombre), "utf8"));
  } catch {
    return null;
  }
}

function guardaCache(nombre, valor) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(rutaCache(nombre), JSON.stringify(valor), "utf8");
}

/* ---------------------------------------------- la ficha de un partido */

const CACHE_PARTIDOS = path.join(CACHE_DIR, "partidos");

function rutaFicha(id) {
  return path.join(CACHE_PARTIDOS, String(id) + ".json");
}

/**
 * ¿Se puede dar por buena la ficha guardada de este partido?
 *
 * Sólo si el partido ya no puede cambiar —terminado y con unos días encima— y
 * no se ha pedido `--refrescar-todo`. Un `--refrescar` normal **no** la tira:
 * lo que se quiere refrescar cada noche es el calendario y la clasificación,
 * no reescribir la alineación de un partido de agosto.
 */
function fichaEnCache(partido) {
  if (REFRESCAR_TODO) return null;

  let guardada;

  try {
    guardada = JSON.parse(fs.readFileSync(rutaFicha(partido.id), "utf8"));
  } catch {
    return null;
  }

  /*
  | Lo que importa no es cuántos días tiene el partido, sino **cuántos tenía
  | cuando se bajó la ficha**. Una bajada el mismo día del partido trae las
  | notas a medias y muchas veces sin tarjetas ni cambios; darla por buena tres
  | días después congelaría esa versión incompleta para siempre.
  */
  const reposo =
    (new Date(guardada.bajadaEn).getTime() - new Date(partido.fecha).getTime()) /
    86400000;

  return reposo >= DIAS_QUE_YA_NO_CAMBIAN ? guardada : null;
}

function guardaFicha(id, valor) {
  fs.mkdirSync(CACHE_PARTIDOS, { recursive: true });
  fs.writeFileSync(rutaFicha(id), JSON.stringify(valor), "utf8");
}

/**
 * ¿Es un amistoso?
 *
 * BeSoccer los llama «Partidos Amistosos» y de ellos casi nunca publica la
 * alineación, así que valen menos que un partido de competición y no deben
 * ocupar su sitio.
 */
function esAmistoso(partido) {
  return /amistoso/i.test(String(partido.competicion ?? ""));
}

/** Suma al contador de goleadores los goles propios de un partido. */
function apunta(goleadores, goles) {
  for (const gol of goles) {
    if (!gol.propio || gol.tipo === "propia") continue;

    goleadores.set(gol.jugador, (goleadores.get(gol.jugador) ?? 0) + 1);
  }
}

/* ------------------------------------------------------------------ */
/*  UN EQUIPO                                                          */
/* ------------------------------------------------------------------ */

async function bajaEquipo(id, slug, clasificacion) {
  const cacheado = leeCache(slug);

  if (cacheado && SOLO_SUBIR) return cacheado;

  if (cacheado && !REFRESCAR) {
    console.log(`  ${slug}: en caché`);

    return cacheado;
  }

  if (SOLO_SUBIR) {
    console.log(`  ${slug}: sin caché, se salta`);

    return null;
  }

  console.log(`  ${slug}: club…`);

  const club = await pagina(`https://es.besoccer.com/equipo/${slug}`);

  await espera(1200);

  console.log(`  ${slug}: partidos…`);

  const calendario = await pagina(`https://es.besoccer.com/equipo/partidos/${slug}`);

  if (!calendario) {
    console.warn(`  ${slug}: sin calendario, se salta`);

    return null;
  }

  const partidos = leePartidos(calendario, slug);

  const escudoFila = [
    ...clasificacion.total,
    ...clasificacion.local,
    ...clasificacion.visitante,
  ].find((fila) => fila.slug === slug);

  /*
  | Qué partidos se piden, del más reciente al más antiguo: son los que se
  | enseñan y de los que se cuentan las estructuras.
  |
  | Todos los de competición, y amistosos sólo para llegar al mínimo mientras
  | no hay otra cosa. Ver `MINIMO_ONCES`.
  */
  const jugados = partidos.filter((partido) => partido.jugado);

  const oficiales = jugados.filter((partido) => !esAmistoso(partido));

  const amistosos = jugados.filter(esAmistoso);

  const recientes = [
    ...oficiales,
    ...amistosos.slice(-Math.max(0, MINIMO_ONCES - oficiales.length)),
  ]
    .sort((uno, otro) => String(uno.fecha).localeCompare(String(otro.fecha)))
    .reverse();

  const onces = [];

  const goleadores = new Map();

  for (const partido of recientes) {
    const visitante = !partido.enCasa;

    /* Lo que ya se bajó en su día no se vuelve a pedir. */
    const guardada = fichaEnCache(partido);

    if (guardada) {
      if (guardada.once) onces.push(guardada.once);

      partido.goles = guardada.goles ?? [];

      apunta(goleadores, partido.goles);

      continue;
    }

    await espera(1200);

    console.log(`  ${slug}: ficha ${partido.id}…`);

    const url = `https://es.besoccer.com/partido/${partido.local.slug}/${partido.visitante.slug}/${partido.id}`;

    const ficha = await pagina(`${url}/alineaciones`);

    let once = null;

    if (ficha) {
      const alineacion = leeAlineacion(ficha, visitante);

      if (alineacion?.jugadores.length) {
        once = {
          partidoId: partido.id,
          estructura: alineacion.estructura,
          entrenador: leeEntrenadorPartido(ficha, visitante),
          jugadores: alineacion.jugadores,
          /* La convocatoria entera: el informe enseña titulares y suplentes en
             una columna entre los dos campogramas del partido. */
          suplentes: leeSuplentes(ficha, visitante),
          cambios: [],
          tarjetas: [],
        };

        onces.push(once);
      }
    }

    await espera(1200);

    const eventos = await pagina(url);

    if (eventos) {
      const goles = cuadraConElMarcador(leeGoles(eventos, visitante), partido);

      partido.goles = goles;

      apunta(goleadores, goles);

      /*
      | Tarjetas y cambios sólo los publica BeSoccer mientras el partido es
      | reciente —de una temporada pasada ya no queda ni el módulo de eventos—,
      | así que se guardan en cuanto se bajan y no se vuelven a pedir. Lo que
      | no haya se queda vacío y el informe lo dice en la hoja.
      */
      if (once) {
        once.cambios = leeCambios(eventos, visitante);
        once.tarjetas = leeTarjetas(eventos, visitante);
      }
    }

    /* Se guarda incluso lo que ha salido vacío: un amistoso sin alineación
       tampoco la va a tener mañana, y así deja de pedirse. */
    guardaFicha(partido.id, {
      bajadaEn: new Date().toISOString(),
      fecha: partido.fecha,
      once,
      goles: partido.goles ?? [],
    });
  }

  /* -------------------------------------------------- el entrenador */

  const entrenador = club ? leeEntrenador(club) : null;

  /*
  | Su trayectoria, de su propia ficha. Es una petición más por equipo y vale
  | la pena: la hoja del míster enseñaba otra vez el balance del equipo —que ya
  | está dos hojas antes— en vez de decir de dónde viene.
  */
  if (entrenador?.ficha) {
    await espera(1200);

    console.log(`  ${slug}: entrenador…`);

    const suya = await pagina(entrenador.ficha);

    if (suya) entrenador.trayectoria = leeTrayectoria(suya);
  }

  /* Las estructuras, de la más repetida a la menos. */
  const cuenta = new Map();

  for (const once of onces) {
    if (!once.estructura) continue;

    cuenta.set(once.estructura, (cuenta.get(once.estructura) ?? 0) + 1);
  }

  const informe = {
    id,
    nombre: "",
    nombreLargo: limpia(
      escudoFila?.equipo ||
        club?.match(/<title>([^<|,]*)/)?.[1] ||
        slug.replace(/-/g, " ")
    ),
    slug,
    escudo: escudoFila?.escudo ?? "",
    entrenador,
    estadio: club ? leeEstadio(club) : null,
    clasificacion,
    partidos,
    goleadores: [...goleadores.entries()]
      .map(([nombre, goles]) => ({ nombre, foto: "", goles }))
      .sort((a, b) => b.goles - a.goles)
      .slice(0, 6),
    estructuras: [...cuenta.entries()]
      .map(([estructura, veces]) => ({ estructura, veces }))
      .sort((a, b) => b.veces - a.veces),
    onces,
  };

  guardaCache(slug, informe);

  return informe;
}

/* ------------------------------------------------------------------ */
/*  NOMBRES DE LA HOJA                                                 */
/* ------------------------------------------------------------------ */

/**
 * Cómo llama la hoja RIVALES a cada equipo.
 *
 * El informe lo abre la pantalla de plantillas, que trabaja con el nombre de
 * la hoja ("Teruel"), no con el de BeSoccer ("CD Teruel"). Se lee de la propia
 * hoja para no mantener una tercera lista de nombres a mano.
 */
/**
 * Lee una lista de la hoja, con reintentos.
 *
 * Apps Script devuelve de vez en cuando **una página de Google** en vez del
 * JSON —una interstitial con `ppConfig` dentro— y un `.json()` a pelo se
 * rompe con «Unexpected token '<'». Eso es lo que tumbaba la actualización
 * nocturna las noches del 2, el 5 y el 6 de septiembre de 2026: no había nada
 * mal en los datos, era el servidor de Google contestando otra cosa.
 *
 * Es un tropiezo pasajero, así que se reintenta. Lo que no se hace es
 * adivinar: si después de cuatro intentos sigue sin haber JSON, se sale con
 * un mensaje que dice lo que pasó de verdad.
 */
async function traeDeLaHoja(url, quePide = "la hoja") {
  let ultimo = "";

  for (let intento = 1; intento <= 4; intento += 1) {
    if (intento > 1) {
      await new Promise((sigue) => setTimeout(sigue, intento * 4000));
    }

    try {
      /*
      | Con plazo. La hoja tarda entre treinta y setenta segundos en
      | despertarse, pero un `fetch` sin `signal` no falla nunca: si Google
      | se queda a medias, esto espera hasta mañana y la pasada de la noche
      | se pierde entera sin decir una palabra. Dos minutos por intento son
      | de sobra para el arranque en frío y cortan el cuelgue.
      */
      const respuesta = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(120_000),
      });

      const texto = await respuesta.text();

      /* Una página de error empieza por '<'. Los datos, por '[' o '{'. */
      const limpio = texto.trim();

      if (!limpio.startsWith("[") && !limpio.startsWith("{")) {
        ultimo = `${quePide}: Google ha contestado una página, no datos (HTTP ${respuesta.status})`;

        continue;
      }

      return JSON.parse(limpio);
    } catch (error) {
      ultimo = `${quePide}: ${String(error?.message ?? error).slice(0, 140)}`;
    }
  }

  throw new Error(`No se ha podido leer ${ultimo}`);
}

async function nombresDeLaHoja(env) {
  try {
    const filas = await traeDeLaHoja(
      `${env.APPS_SCRIPT_URL}?action=rivalesPlantillas`,
      "los nombres de la hoja",
    );

    if (!Array.isArray(filas)) return {};

    const nombres = {};

    for (const fila of filas) {
      const id = String(fila?.ID_EQUIPO ?? "").trim();
      const nombre = String(fila?.NOMBRE_EQUIPO ?? "").trim();

      if (id && nombre && !nombres[id]) nombres[id] = nombre;
    }

    return nombres;
  } catch (error) {
    console.warn("No se han podido leer los nombres de la hoja:", error.message);

    return {};
  }
}

/* ------------------------------------------------------------------ */
/*  SUPABASE                                                           */
/* ------------------------------------------------------------------ */

/**
 * Las claves de Supabase.
 *
 * En un portátil salen de `.env.local`; en la tarea nocturna, que corre en un
 * runner de GitHub, no hay tal fichero y vienen del entorno. Se admiten las
 * dos formas para que el mismo script valga en los dos sitios sin tocar nada,
 * y se avisa claro cuando no hay ninguna: sin claves el script subía `null` y
 * el fallo aparecía media hora después, al terminar la descarga.
 */
function readEnv() {
  const env = {};

  if (fs.existsSync(".env.local")) {
    /* El fichero viene con saltos de Windows y en JS el `.` de una expresión
       regular no cruza un retorno de carro: sin quitarlos, ninguna línea
       encaja. */
    const raw = fs.readFileSync(".env.local", "utf8").split("\r").join("");

    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

      if (match) env[match[1]] = match[2].trim();
    }
  }

  /* Lo que venga por el entorno manda: es lo que pone la tarea nocturna. */
  for (const clave of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[clave]) env[clave] = process.env[clave];
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: " +
        "ponlas en .env.local o en el entorno antes de subir nada.",
    );
  }

  return env;
}

async function upload(doc, env) {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabase.from("app_documents").upsert(
    {
      key: DOC_KEY,
      kind: DOC_KIND,
      data: doc,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);

  /* Relectura: un `success` sin comprobar no prueba que se haya escrito
     (nota "guardados-verificados-save-guard"). */
  const { data, error: readError } = await supabase
    .from("app_documents")
    .select("data")
    .eq("key", DOC_KEY)
    .single();

  if (readError) throw new Error(readError.message);

  const guardados = Object.keys(data?.data?.porId ?? {}).length;

  if (guardados !== Object.keys(doc.porId).length) {
    throw new Error(
      `Se subieron ${Object.keys(doc.porId).length} equipos y la relectura ` +
        `devuelve ${guardados}.`
    );
  }

  console.log(`Subido: ${guardados} equipos en ${DOC_KEY}.`);
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  /* Con `--sin-subir` no hace falta ni el entorno: se baja a la caché. */
  const env = SIN_SUBIR ? {} : readEnv();

  console.log("Clasificación del grupo…");

  const cacheClasificacion = leeCache("_clasificacion");

  let clasificacion = cacheClasificacion;

  if (!clasificacion || REFRESCAR) {
    const html = SOLO_SUBIR ? null : await pagina(CLASIFICACION_URL);

    if (html) {
      clasificacion = leeClasificacion(html);
      guardaCache("_clasificacion", clasificacion);
    }
  }

  if (!clasificacion) {
    throw new Error(
      `Sin clasificación no hay informe. BeSoccer ha contestado ${ultimoEstado || "nada"} ` +
        `a ${CLASIFICACION_URL}. Un 403 o un 429 desde un servidor suele ser ` +
        `bloqueo por IP: esta descarga sólo funciona desde una conexión normal.`,
    );
  }

  console.log(`  ${clasificacion.total.length} equipos en la tabla.`);

  const nombres = SIN_SUBIR ? {} : await nombresDeLaHoja(env);

  const porId = {};

  /* Lo ya subido, para poder bajar un equipo suelto sin borrar el resto. */
  const previo =
    !SIN_SUBIR && (SOLO_SUBIR || filtro.size > 0) ? await lee(env) : null;

  if (previo?.porId) Object.assign(porId, previo.porId);

  for (const [id, slug] of Object.entries(TEAM_SLUGS)) {
    if (filtro.size > 0 && !filtro.has(slug) && !filtro.has(id)) continue;

    const informe = await bajaEquipo(id, slug, clasificacion);

    if (!informe) continue;

    informe.nombre = nombres[id] || informe.nombreLargo;

    /* La clasificación es la misma para todos y se guardó en la caché de cada
       equipo: se refresca con la recién bajada para que un equipo cacheado en
       octubre no arrastre la tabla de octubre. */
    informe.clasificacion = clasificacion;

    porId[id] = informe;
  }

  const doc = {
    actualizado: new Date().toISOString(),
    fuente: "besoccer",
    temporada: TEMPORADA,
    competicion: COMPETICION,
    porId,
  };

  if (SIN_SUBIR) {
    console.log("\n--sin-subir: queda en la caché, Supabase no se toca.");

    return;
  }

  await upload(doc, env);
}

/** Lo que ya hay subido, para no perderlo al bajar un equipo suelto. */
async function lee(env) {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data } = await supabase
    .from("app_documents")
    .select("data")
    .eq("key", DOC_KEY)
    .maybeSingle();

  return data?.data ?? null;
}

/*
| La descarga sólo arranca cuando el fichero se corre a mano.
|
| Es lo que deja que `scripts/rivals-informe-harness.mjs` importe los parsers
| y les pase HTML guardado para comprobar que siguen leyendo lo que tienen que
| leer. Sin este guardián, importarlos lanzaría las ciento y pico peticiones.
*/
if (path.basename(process.argv[1] ?? "") === "rivals-informe.mjs") {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
