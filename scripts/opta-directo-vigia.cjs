/**
 * EL DIRECTO DE OPTA LO LANZA EL VIGÍA (21/11/2026).
 *
 * El directo (`.github/workflows/opta-directo.yml` → `scripts/opta-directo.mjs`)
 * colgaba de un `schedule` cada 30 min que GitHub casi no cumple en un repo
 * público: el 20/11 corrió a las 18:29 y no volvió hasta las 0:17, y el
 * Castilla jugó a las 21:15 sin directo. Ahora el vigía del ordenador del club
 * mira el calendario y, unos diez minutos antes de cada partido de la
 * jornada del grupo, lanza el workflow con `workflow_dispatch` (lo mismo que
 * el botón «Directo» de Ajustes, app/api/opta/directo/route.ts).
 *
 * De dónde salen las horas (las dos son de BeSoccer, hora de Madrid):
 *   - el Castilla: el documento `castilla:calendario` (sólo se lee);
 *   - los otros nueve: la quiniela tiene el calendario del grupo sin hora
 *     (lib/quiniela/calendario.ts), así que `traeResultados` lee la página de
 *     cada local en BeSoccer, como `quiniela-resultados.cjs`. Una vez cada
 *     seis horas y sólo si hay jornada cerca; se guarda en `.cache/`.
 *
 * Una sola vez por partido: lo lanzado se apunta en
 * `.cache/opta-directo-vigia/estado.json`. Un lanzamiento cubre también los
 * partidos que empiezan poco después (el script sigue todos los del día), y
 * la duración llega hasta el final del último que cubre (máx. 300 min).
 *
 * El token: GITHUB_TOKEN_DIRECTO en `.env.local` (fine-grained, Actions: Read
 * and write sobre este repo; el mismo que en Render). Si falta, se apunta una
 * vez al día en el registro del vigía y no se hace nada más.
 *
 * Prueba en seco (sin red, sin GitHub, sin base):
 *   node scripts/opta-directo-vigia.cjs --prueba
 */

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

const REPO = "vceazurita-ship-it/Real-Madrid-Castilla-26-27";
const FLUJO = "opta-directo.yml";

const CARPETA = path.join(RAIZ, ".cache", "opta-directo-vigia");
const FICHERO_ESTADO = path.join(CARPETA, "estado.json");
const FICHERO_HORARIOS = path.join(CARPETA, "horarios.json");

/** Cuánto antes del saque se lanza (Actions tarda 1-2 min en arrancar e instalar). */
const ANTES_MS = 10 * 60_000;
/** Hasta cuándo, ya empezado, todavía vale la pena lanzarlo (el vigía estaba apagado). */
const TARDE_MS = 100 * 60_000;
/** Lo que dura un partido con descanso y añadido, con margen. */
const PARTIDO_MS = 125 * 60_000;
/** Tope del workflow (duracion ≤ 300). */
const TOPE_MIN = 300;
const HORARIOS_CADA_MS = 6 * 3_600_000;
const REINTENTO_MS = 5 * 60_000;

/* ------------------------------------------------------------------ */
/*  HORAS DE MADRID                                                    */
/* ------------------------------------------------------------------ */

/** Cuánto va Madrid por delante de UTC en ese instante, en ms. */
function desfaseMadrid(t) {
  const local = new Date(t).toLocaleString("sv-SE", { timeZone: "Europe/Madrid" });

  return Date.parse(`${local.replace(" ", "T")}Z`) - t;
}

/** "2026-11-20T21:15" (hora de Madrid, como lo da BeSoccer) → instante. NaN si no se entiende. */
function madridAInstante(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(texto ?? ""));

  if (!m) return NaN;

  const comoUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));

  /* Dos pasos: el desfase del instante bueno puede no ser el de comoUtc (cambio de hora). */
  const primero = comoUtc - desfaseMadrid(comoUtc);

  return comoUtc - desfaseMadrid(primero);
}

const diaDeMadrid = (t) => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

const claveDe = (p) => `${String(p.cuando).slice(0, 16)}|${p.local}|${p.visitante}`;

/* ------------------------------------------------------------------ */
/*  QUÉ TOCA AHORA (pura)                                              */
/* ------------------------------------------------------------------ */

/**
 * Decide si hay que lanzar el directo ahora.
 *
 * @param partidos  [{ cuando: "AAAA-MM-DDTHH:MM" (Madrid), local, visitante }]
 * @param ahora     instante (ms)
 * @param lanzados  { [clave]: … } lo ya lanzado o cubierto
 * @returns null si no toca; si toca, { duracion (min), cubre: [claves], partidos: [...] }
 */
function queToca(partidos, ahora, lanzados = {}) {
  const pendientes = partidos
    .map((p) => ({ ...p, clave: claveDe(p), inicio: madridAInstante(p.cuando) }))
    .filter((p) => Number.isFinite(p.inicio) && !lanzados[p.clave])
    .sort((a, b) => a.inicio - b.inicio);

  /* Lo que ya está en su ventana: desde diez minutos antes hasta bien empezado. */
  const ya = pendientes.filter((p) => ahora >= p.inicio - ANTES_MS && ahora < p.inicio + TARDE_MS);

  if (!ya.length) return null;

  /* Y los que empiezan después pero acaban dentro del tope: el mismo
     lanzamiento los sigue (opta-directo.mjs mira todos los del día). */
  const cabe = ahora + TOPE_MIN * 60_000 - PARTIDO_MS;

  const cubre = pendientes.filter((p) => p.inicio <= cabe && p.inicio + TARDE_MS > ahora);

  const hasta = Math.max(...cubre.map((p) => p.inicio + PARTIDO_MS));

  const duracion = Math.min(TOPE_MIN, Math.max(15, Math.ceil((hasta - ahora) / 60_000)));

  return { duracion, cubre: cubre.map((p) => p.clave), partidos: cubre };
}

/* ------------------------------------------------------------------ */
/*  ESTADO Y TOKEN                                                     */
/* ------------------------------------------------------------------ */

function leeJson(fichero, porDefecto) {
  try {
    return JSON.parse(fs.readFileSync(fichero, "utf8"));
  } catch {
    return porDefecto;
  }
}

function guardaJson(fichero, datos) {
  fs.mkdirSync(CARPETA, { recursive: true });
  fs.writeFileSync(fichero, JSON.stringify(datos, null, 2));
}

/** GITHUB_TOKEN_DIRECTO del entorno o de `.env.local`. Nunca se escribe en ningún sitio. */
function token() {
  if (process.env.GITHUB_TOKEN_DIRECTO) return process.env.GITHUB_TOKEN_DIRECTO.trim();

  try {
    for (const linea of fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").split(/\r?\n/)) {
      const m = linea.match(/^GITHUB_TOKEN_DIRECTO=(.*)$/);

      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sin .env.local */
  }

  return "";
}

/* ------------------------------------------------------------------ */
/*  SIN TOKEN: EL DIRECTO EN ESTE ORDENADOR (24/11/2026)               */
/* ------------------------------------------------------------------ */
/*
| El Castilla - Real Murcia del 20/11 se quedó sin directo: no había
| GITHUB_TOKEN_DIRECTO en .env.local (el vigía sólo lo apuntaba) y la pasada
| programada de GitHub no corrió. Ahora, sin token, el directo corre aquí
| mismo con el Chrome de Opta del club (opta-directo.mjs --chrome), como hijo
| suelto que sigue aunque el vigía se reinicie. Si el Chrome de Opta está
| cerrado, se abre con su perfil (rmcf-opta, puerto 9335).
*/

const { spawn } = require("node:child_process");

const PUERTO_OPTA = 9335;
const SITIO_OPTA = "https://realmadrid.opta.trumediasports.com";

async function chromeDeOpta() {
  const vivo = async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO_OPTA}/json/list`);
      return (await r.json()).some((t) => t.type === "page" && t.url.includes("trumedia"));
    } catch {
      return false;
    }
  };
  if (await vivo()) return true;
  const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((r) => fs.existsSync(r));
  if (!chrome) return false;
  const perfil = path.join(process.env.LOCALAPPDATA ?? "", "rmcf-opta");
  spawn(chrome, [`--remote-debugging-port=${PUERTO_OPTA}`, `--user-data-dir=${perfil}`, "--no-first-run", "--no-default-browser-check", "--window-size=1500,950", `${SITIO_OPTA}/soccer/league-tables`], { stdio: "ignore", detached: true }).unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((ok) => setTimeout(ok, 1000));
    if (await vivo()) return true;
  }
  return false;
}

/** Lanza opta-directo.mjs --chrome aquí; devuelve el fichero de registro o null. */
async function lanzaAqui(entorno, nombre) {
  if (!(await chromeDeOpta())) return null;
  fs.mkdirSync(CARPETA, { recursive: true });
  const registro = path.join(CARPETA, `${nombre}.log`);
  const salida = fs.openSync(registro, "a");
  const hijo = spawn(process.execPath, ["--env-file=.env.local", path.join(RAIZ, "scripts", "opta-directo.mjs"), "--chrome"], {
    cwd: RAIZ,
    env: { ...process.env, ...entorno },
    stdio: ["ignore", salida, salida],
    detached: true,
    windowsHide: true,
  });
  hijo.unref();
  return registro;
}

const diaDe = (t) => new Date(t).toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 10);

/* ------------------------------------------------------------------ */
/*  CALENDARIO                                                         */
/* ------------------------------------------------------------------ */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

/** Una página de BeSoccer con curl (asíncrono: el vigía no se queda parado). */
function traePagina(url) {
  const MARCA = "\n@@ESTADO@@";

  return new Promise((resolve) => {
    setTimeout(() => {
      execFile(
        "curl",
        ["-s", "--compressed", "--max-time", "45", "-H", `User-Agent: ${UA}`, "-H", "Accept: text/html,application/xhtml+xml", "-H", "Accept-Language: es-ES,es;q=0.9", "-w", `${MARCA}%{http_code}`, url],
        { maxBuffer: 64 * 1024 * 1024, encoding: "utf8", windowsHide: true },
        (error, salida) => {
          if (error && !salida) return resolve({ cuerpo: "", estado: 0 });

          const corte = salida.lastIndexOf(MARCA);

          resolve(corte === -1 ? { cuerpo: salida, estado: 0 } : { cuerpo: salida.slice(0, corte), estado: Number(salida.slice(corte + MARCA.length).trim()) || 0 });
        },
      );
    }, 1200);
  });
}

/** Los otros nueve partidos de las jornadas cercanas, con su hora de BeSoccer (cacheado seis horas). */
async function horariosDelGrupo(ahora, apunta) {
  const guardado = leeJson(FICHERO_HORARIOS, null);

  if (guardado && ahora - (guardado.leidoEn ?? 0) < HORARIOS_CADA_MS) return guardado.partidos ?? [];

  const { CALENDARIO } = require(path.join(RAIZ, "lib/quiniela/calendario.ts"));
  const { traeResultados } = require(path.join(RAIZ, "lib/quiniela/besoccer.ts"));

  const hoy = Date.parse(`${diaDeMadrid(ahora)}T12:00:00Z`);

  /* La fecha de la quiniela es la nominal (domingo); el partido puede caer de
     viernes a lunes, o entre semana: ±5 días. */
  const jornadas = [...new Set(CALENDARIO.filter((p) => Math.abs(Date.parse(`${p.fecha}T12:00:00Z`) - hoy) <= 5 * 86_400_000).map((p) => p.jornada))];

  const partidos = [];

  for (const jornada of jornadas) {
    try {
      const lectura = await traeResultados(jornada, traePagina);

      for (const p of lectura.partidos) if (p.cuando) partidos.push({ cuando: p.cuando, local: p.local, visitante: p.visitante });

      if (lectura.bloqueado) apunta(`Directo de Opta: BeSoccer no deja leer la jornada ${jornada}; sólo el Castilla.`);
    } catch (error) {
      apunta(`Directo de Opta: no se han podido leer las horas de la jornada ${jornada} (${error.message}).`);
    }
  }

  /* Si no ha salido nada, se reintenta en una hora y no en seis. */
  guardaJson(FICHERO_HORARIOS, { leidoEn: partidos.length || !jornadas.length ? ahora : ahora - HORARIOS_CADA_MS + 3_600_000, jornadas, partidos });

  return partidos;
}

async function partidosDelCastilla(supabase) {
  const { data, error } = await supabase.from("app_documents").select("data").eq("key", "castilla:calendario").maybeSingle();

  if (error) throw new Error(error.message);

  return (data?.data?.partidos ?? [])
    .filter((p) => p && p.cuando && p.golesLocal == null)
    .map((p) => ({ cuando: p.cuando, local: p.local, visitante: p.visitante }));
}

/* ------------------------------------------------------------------ */
/*  LANZAR                                                             */
/* ------------------------------------------------------------------ */

async function lanza(tok, duracion) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${FLUJO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tok}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs: { duracion: String(duracion), intervalo: "60", partido: "" } }),
  });

  return r.status;
}

/* En globalThis: el vigía recarga este módulo cada minuto y una variable suelta se perdería. */
const FALLO = "__optaDirectoUltimoFallo";

/**
 * Lo que llama el vigía en cada ronda (él ya lo limita a una vez por minuto).
 * Nunca lanza una excepción hacia fuera: apunta y sigue.
 */
async function miraDirectoOpta({ supabase, apunta, ahora = Date.now() }) {
  try {
    const hora = Number(new Date(ahora).toLocaleString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }));

    /* Partidos de Primera RFEF: de 10:00 a 22:30 como mucho. */
    if (hora < 8 || hora >= 23) return;

    if (ahora - (globalThis[FALLO] ?? 0) < REINTENTO_MS) return;

    const estado = leeJson(FICHERO_ESTADO, { lanzados: {} });
    estado.lanzados ??= {};

    const tok = token();

    /*
    | EL REPASO DE LA MAÑANA (24/11/2026): una vez al día, a partir de las 8,
    | los partidos de AYER se vuelven a leer aquí (un par de minutos). Si alguno
    | se quedó sin directo, así entra igual. Sólo escribe los partidos, no el
    | índice del día.
    */
    if (hora >= 8 && estado.repasoDe !== diaDe(ahora)) {
      estado.repasoDe = diaDe(ahora);
      guardaJson(FICHERO_ESTADO, estado);
      const ayer = diaDe(ahora - 86_400_000);
      const registro = await lanzaAqui({ DIA: ayer, SIN_INDICE: "1", DURACION_MIN: "10", INTERVALO_S: "60" }, `repaso-${ayer}`);
      apunta(registro ? `Directo de Opta: repaso de los partidos del ${ayer} en marcha (por si alguno se quedó sin guardar).` : "Directo de Opta: el repaso de ayer no arranca (el Chrome de Opta no abre).");
    }

    const delCastilla = await partidosDelCastilla(supabase);
    const delGrupo = await horariosDelGrupo(ahora, apunta);

    const toca = queToca([...delCastilla, ...delGrupo], ahora, estado.lanzados);

    if (!toca) return;

    /* Sin token: aquí mismo, con el Chrome de Opta (antes sólo se avisaba y el partido se quedaba sin directo). */
    const codigo = tok ? await lanza(tok, toca.duracion) : (await lanzaAqui({ DURACION_MIN: String(toca.duracion), INTERVALO_S: "60" }, `directo-${diaDe(ahora)}`)) ? 201 : 0;

    if (codigo < 200 || codigo >= 300) {
      globalThis[FALLO] = ahora;
      apunta(tok ? `Directo de Opta: GitHub no lo ha lanzado (${codigo}); se reintenta en 5 min. Revisa el token y su permiso de Actions.` : "Directo de Opta: sin token de GitHub y el Chrome de Opta no abre; se reintenta en 5 min.");

      return;
    }

    const cuando = new Date(ahora).toISOString();

    for (const clave of toca.cubre) estado.lanzados[clave] = { lanzadoEn: cuando, duracion: toca.duracion };

    /* Lo de hace más de un mes, fuera. */
    for (const [clave, v] of Object.entries(estado.lanzados)) {
      if (ahora - Date.parse(v.lanzadoEn ?? 0) > 31 * 86_400_000) delete estado.lanzados[clave];
    }

    guardaJson(FICHERO_ESTADO, estado);

    apunta(`Directo de Opta lanzado solo${tok ? "" : " en este ordenador"} (${toca.duracion} min): ${toca.partidos.map((p) => `${p.local} - ${p.visitante} ${String(p.cuando).slice(11, 16)}`).join(" · ")}.`);
  } catch (error) {
    globalThis[FALLO] = ahora;
    apunta(`Directo de Opta: no se ha podido mirar (${String(error?.message ?? error).slice(0, 160)}).`);
  }
}

module.exports = { miraDirectoOpta, queToca, madridAInstante, claveDe };

/* ------------------------------------------------------------------ */
/*  PRUEBA EN SECO                                                     */
/* ------------------------------------------------------------------ */

if (require.main === module && process.argv.includes("--prueba")) {
  const assert = require("node:assert");

  /* Horas de Madrid: invierno (UTC+1) y verano (UTC+2). */
  assert.strictEqual(new Date(madridAInstante("2026-11-20T21:15")).toISOString(), "2026-11-20T20:15:00.000Z");
  assert.strictEqual(new Date(madridAInstante("2026-09-20T12:00")).toISOString(), "2026-09-20T10:00:00.000Z");
  assert.ok(Number.isNaN(madridAInstante("")));

  const t = (s) => madridAInstante(s);
  const partidos = [
    { cuando: "2026-11-22T12:00", local: "A", visitante: "B" },
    { cuando: "2026-11-22T16:00", local: "C", visitante: "D" },
    { cuando: "2026-11-22T18:00", local: "E", visitante: "F" },
    { cuando: "2026-11-22T18:30", local: "G", visitante: "H" },
    { cuando: "2026-11-22T21:15", local: "Real Madrid Castilla", visitante: "I" },
  ];

  /* 11:45: aún no. */
  assert.strictEqual(queToca(partidos, t("2026-11-22T11:45"), {}), null);

  /* 11:50: el de las 12:00 y nada más (el de las 16:00 cae fuera de 300 min con su final). */
  let r = queToca(partidos, t("2026-11-22T11:50"), {});
  assert.deepStrictEqual(r.cubre, ["2026-11-22T12:00|A|B"]);
  assert.strictEqual(r.duracion, 135);

  /* Ya lanzado: no se repite. */
  const lanzados = Object.fromEntries(r.cubre.map((c) => [c, { lanzadoEn: "x" }]));
  assert.strictEqual(queToca(partidos, t("2026-11-22T11:55"), lanzados), null);

  /* 15:50: el de las 16:00 y, por caber, los de las 18:00 y 18:30 (hasta las 20:35 = 285 min). */
  r = queToca(partidos, t("2026-11-22T15:50"), lanzados);
  assert.deepStrictEqual(r.cubre, ["2026-11-22T16:00|C|D", "2026-11-22T18:00|E|F", "2026-11-22T18:30|G|H"]);
  assert.strictEqual(r.duracion, 285);
  for (const c of r.cubre) lanzados[c] = { lanzadoEn: "x" };

  /* 18:20: nada (cubiertos). 21:05: el Castilla. */
  assert.strictEqual(queToca(partidos, t("2026-11-22T18:20"), lanzados), null);
  r = queToca(partidos, t("2026-11-22T21:05"), lanzados);
  assert.deepStrictEqual(r.cubre, ["2026-11-22T21:15|Real Madrid Castilla|I"]);
  assert.strictEqual(r.duracion, 135);

  /* El vigía estaba apagado y vuelve a las 22:00: aún se lanza (45 min jugados), con lo que queda. */
  r = queToca(partidos, t("2026-11-22T22:00"), lanzados);
  assert.strictEqual(r.duracion, 80);

  /* A las 23:00 ya no. */
  assert.strictEqual(queToca(partidos, t("2026-11-22T23:00"), lanzados), null);

  /* Partido sin hora: se ignora. */
  assert.strictEqual(queToca([{ cuando: "", local: "X", visitante: "Y" }], t("2026-11-22T12:00"), {}), null);

  console.log("Prueba en seco: bien.");
}
