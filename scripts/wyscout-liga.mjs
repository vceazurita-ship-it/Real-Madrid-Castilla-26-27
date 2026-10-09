#!/usr/bin/env node
/*
|--------------------------------------------------------------------------
| LOS DATOS DE LA LIGA, BAJADOS SOLOS
|--------------------------------------------------------------------------
|
| Cada semana había que entrar en Wyscout, abrir los veinte equipos del grupo
| uno a uno, poner el desplegable en ALL y pulsar «Exportar en Excel» veinte
| veces, y después repetir la faena en el buscador de jugadores. Media hora de
| ratón para que `public/data/wys` tenga lo que `lib/data-analisis/leer.ts`
| espera. Esto lo hace solo:
|
|     node scripts/wyscout-liga.mjs
|
| o, sin abrir una consola, doble clic en `scripts/actualizar-wys.cmd`, que
| además relee la carpeta y pregunta si se publica.
|
| SON DOS RECADOS, NO UNO
|
|   1. **Los equipos.** La ficha de cada uno del grupo, con MOSTRAR = ALL, a
|      `Team Stats <equipo>.xlsx`.
|   2. **Los jugadores.** Los de toda la categoría, que están en otra
|      aplicación —«Advanced Search»— y bajan por lotes de equipos porque
|      Wyscout corta cada exportación en 500 filas, a `Player Stats N.xlsx`.
|
| Se puede pedir sólo uno: `--sin-jugadores` o `--solo-jugadores`.
|
| CÓMO ENTRA EN WYSCOUT, QUE ES LA PARTE DELICADA
|
| **No toca tu Chrome ni tus cookies.** Abre un Chrome aparte con un perfil
| propio (`%LOCALAPPDATA%\rmcf-wyscout`) y, la primera vez, se para en la
| pantalla de Hudl y espera a que entres tú. La contraseña la escribes en tu
| navegador: ni la pide, ni la guarda, ni la ve este script. A partir de ahí la
| sesión vive en ese perfil y las semanas siguientes arranca ya dentro; el día
| que caduque, se vuelve a parar a esperar.
|
| POR QUÉ A GOLPE DE RATÓN Y NO POR LA API
|
| El botón de exportar dispara un `POST` a `searchapi.wyscout.com` con un
| `access_token` en la dirección. Llamar a eso directamente sería más rápido,
| pero obliga a sacar del navegador un token de sesión y a guardarlo en algún
| sitio. Aquí se hace lo mismo que haría una persona —abrir el equipo y pulsar
| el botón—, y así **ninguna credencial sale de Chrome**. Veinte equipos son
| unos cinco minutos, una vez por semana.
|
| LO QUE NO SE PUEDE, Y NO ES POR PEREZA
|
| Los **clips de vídeo** de la tabla no tienen enlace. No es que no se haya
| encontrado: es que no existe, y se ha comprobado por los tres caminos.
|
|   - **El ▶ no es un `<a>`.** Al pulsarlo hace un `POST` a
|     `rest.wyscout.com/v1/clips/clipsfromjson.json` con el clip **descrito en
|     el cuerpo** —`{matchId, start, end, label, teamId, playerId}`—. El clip
|     no es un recurso con dirección: se fabrica al vuelo con la sesión puesta.
|   - **La aplicación no tiene direcciones.** Navegar por ella nunca cambia la
|     URL, siempre `/app/`. Se probaron `?/team/<id>`, `#/team/<id>` y
|     `/app/team/<id>`: las tres aterrizan en la lista de países o en un 404.
|   - **Las aplicaciones sueltas tampoco.** Abrir a mano
|     `wyscout-apps.hudl.com/advanced-search/`, con la sesión iniciada en ese
|     mismo Chrome, contesta «Your session data is invalid»: sin el token que
|     les pasa la cáscara no arrancan.
|
| Lo que sí está al alcance es **el minutaje**: la misma tabla se lo pide a
| `searchapi.wyscout.com/api/v1/events/team/<id>/goals.json?match=<id>` y ahí
| viene cada acción con su segundo de inicio y de fin. Con eso la plataforma
| puede saltar al minuto en **nuestro** vídeo del partido, que para preparar
| una sesión vale más que abrir una ventana de Wyscout.
*/

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { strFromU8, unzipSync } from "fflate";
import { esperaTurno } from "./chrome-turno.mjs";

/* ------------------------------------------------------------------ */
/*  AJUSTES                                                            */
/* ------------------------------------------------------------------ */

const RAIZ = path.resolve(import.meta.dirname, "..");

const DESTINO = path.join(RAIZ, "public", "data", "wys");

/** Donde van el registro de cada pasada y el testigo de la sesión. */
const CACHE = path.join(RAIZ, ".cache", "wyscout");

/* El perfil vive fuera del repositorio: es una sesión, no código. */
const PERFIL = path.join(
  process.env.LOCALAPPDATA ?? os.homedir(),
  "rmcf-wyscout",
);

const DESCARGAS = path.join(PERFIL, "descargas");

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((ruta) => fs.existsSync(ruta));

const PUERTO = 9333;

/* El camino hasta el grupo, tal y como se pulsa a mano. */
const PAIS = "España";
const COMPETICION = "Primera Division RFEF";
const GRUPO = argumento("grupo") ?? "Group 2";

const espera = (ms) => new Promise((listo) => setTimeout(listo, ms));

function argumento(nombre) {
  return (
    process.argv.find((a) => a.startsWith(`--${nombre}=`))?.split("=")[1] ?? null
  );
}

const bandera = (nombre) => process.argv.includes(`--${nombre}`);

/* ------------------------------------------------------------------ */
/*  CHROME                                                             */
/* ------------------------------------------------------------------ */

/**
 * Con ventana, no oculto.
 *
 * A propósito: la primera vez hay que entrar a mano, y una sesión que caduca
 * en mitad de un proceso invisible son veinte minutos buscando por qué no se
 * baja nada.
 */
function abreChrome() {
  if (!CHROME) throw new Error("No encuentro Chrome en Program Files.");

  fs.mkdirSync(DESCARGAS, { recursive: true });

  guardaLaSesionAlCerrar();

  return spawn(
    CHROME,
    [
      `--remote-debugging-port=${PUERTO}`,
      `--user-data-dir=${PERFIL}`,
      "--no-first-run",
      "--no-default-browser-check",
      /*
      | «Continuar donde lo dejaste», y no es por comodidad.
      |
      | La cookie de Hudl es **de sesión**: no tiene fecha de caducidad, y
      | Chrome las tira al cerrarse salvo que esté puesto a restaurar. Por eso
      | había que volver a entrar en Wyscout cada vez que el proceso terminaba
      | —se echó la culpa a `chrome.kill()`, se cambió por `Browser.close`, y
      | seguía pasando: `exit_type` decía «Normal» y la sesión se perdía
      | igual—. Con esto las cookies de sesión se guardan en disco y la semana
      | siguiente arranca ya dentro, que es lo que hace posible programarlo.
      */
      "--restore-last-session",
      "--window-size=1600,1000",
      "https://wyscout.hudl.com/app/",
    ],
    { stdio: "ignore" },
  );
}

/**
 * Deja escrito en el perfil que al arrancar se restaura la sesión anterior.
 *
 * **Esto no funciona, y se deja a propósito.** `restore_on_startup` es una
 * preferencia *protegida*: Chrome no la guarda en `Default\Preferences` sino en
 * `Default\Secure Preferences`, firmada con un MAC en `protection.macs`. Lo que
 * se escriba en el fichero llano lo ignora y lo borra en el siguiente arranque
 * —comprobado el 24/09/2026: en `Preferences` no quedaba ni rastro y en
 * `Secure Preferences` estaba con su firma—. La firma no se puede calcular sin
 * la semilla del binario, y poner una política de Chrome en el registro
 * afectaría también al navegador del usuario.
 *
 * Por eso la sesión la guardamos nosotros, en `guardaLasCookies()`. Esta
 * función se queda porque no molesta y porque el día que Chrome deje de
 * proteger la preferencia volverá a valer.
 */
function guardaLaSesionAlCerrar() {
  const fichero = path.join(PERFIL, "Default", "Preferences");

  try {
    if (!fs.existsSync(fichero)) return;

    const ajustes = JSON.parse(fs.readFileSync(fichero, "utf8"));

    /* 1 = «continuar donde lo dejaste». */
    if (ajustes.session?.restore_on_startup === 1) return;

    ajustes.session = { ...ajustes.session, restore_on_startup: 1 };

    fs.writeFileSync(fichero, JSON.stringify(ajustes), "utf8");
  } catch {
    /* el interruptor de la línea de órdenes sigue puesto */
  }
}

/* ------------------------------------------------------------------ */
/*  LA SESIÓN, GUARDADA A MANO                                         */
/* ------------------------------------------------------------------ */

/**
 * Dónde se guarda el testigo de la sesión de Wyscout.
 *
 * **Es una credencial**: quien tenga este fichero entra en Wyscout como el
 * club, hasta que Hudl caduque la sesión por su cuenta. Vive en el mismo disco
 * y en el mismo perfil de Windows donde ya está la base de cookies de Chrome,
 * que no es más segura, así que no abre una puerta nueva; pero no se copia, no
 * se sube al repositorio (`.cache/` está ignorado) y no sale de ese ordenador.
 */
const FICHERO_SESION = path.join(CACHE, "sesion.json");

/** Las cookies que hacen falta para entrar: sólo las de Hudl y Wyscout. */
const DOMINIOS_SESION = /(^|\.)(hudl|wyscout)\.com$/i;

/**
 * Guarda las cookies de sesión antes de cerrar Chrome.
 *
 * Hace falta porque **la cookie de Hudl es de sesión** —no tiene fecha de
 * caducidad— y Chrome tira esas al cerrarse salvo que el perfil esté puesto a
 * «continuar donde lo dejaste», que es justo lo que no se puede dejar puesto
 * (ver `guardaLaSesionAlCerrar`). Sin esto hay que entrar a mano cada semana, y
 * una tarea programada no puede escribir una contraseña.
 */
async function guardaLasCookies(nav) {
  try {
    const { cookies } = await nav.manda("Network.getAllCookies");

    const nuestras = (cookies ?? []).filter((c) =>
      DOMINIOS_SESION.test(String(c.domain ?? "").replace(/^\./, "")),
    );

    if (!nuestras.length) return;

    fs.mkdirSync(CACHE, { recursive: true });

    fs.writeFileSync(
      FICHERO_SESION,
      JSON.stringify({ guardadoEn: new Date().toISOString(), cookies: nuestras }),
      "utf8",
    );

    /* Sólo para el dueño: es una credencial. En Windows no hace nada, pero si
       esto acaba corriendo en otro sitio, que no nazca abierto. */
    try {
      fs.chmodSync(FICHERO_SESION, 0o600);
    } catch {
      /* Windows */
    }
  } catch {
    /* Si no se dejan leer, lo peor que pasa es volver a entrar a mano. */
  }
}

/**
 * Repone las cookies guardadas nada más conectar.
 *
 * Se hace **antes** de mirar si estamos dentro, para que la comprobación vea ya
 * la sesión puesta. Si las cookies ya no valen —Hudl las caduca por su cuenta—
 * no pasa nada: la comprobación dirá que hay que entrar y el fichero se
 * reescribirá con las nuevas.
 */
async function reponeLasCookies(nav) {
  try {
    if (!fs.existsSync(FICHERO_SESION)) return false;

    const { cookies } = JSON.parse(fs.readFileSync(FICHERO_SESION, "utf8"));

    if (!Array.isArray(cookies) || !cookies.length) return false;

    /*
    | `Network.setCookies` quiere las cookies como las devuelve
    | `getAllCookies` menos los campos de sólo lectura: si se le cuela `size` o
    | `session`, contesta «Invalid parameters».
    */
    const limpias = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      ...(c.expires && c.expires > 0 ? { expires: c.expires } : {}),
    }));

    await nav.manda("Network.setCookies", { cookies: limpias });

    return true;
  } catch {
    return false;
  }
}

/** El hilo de mando con la pestaña. */
/** Una orden que Chrome no ha llegado a contestar: la pestaña está colgada. */
const atasco = (error) => /sin respuesta/i.test(String(error?.message ?? error ?? ""));

/**
 * Cambia la pestaña colgada por una limpia, sin cerrar Chrome.
 *
 * El 28/09/2026 la pestaña se quedó sin contestar pintando las tablas del
 * Águilas y el «Page.navigate» del reintento tumbó la descarga ENTERA: ni un
 * equipo, ni un jugador. Una pestaña colgada no contesta por su canal, pero el
 * navegador sí deja cerrarla y abrir otra por HTTP; la sesión sigue viva
 * porque las cookies son del navegador, no de la pestaña. `nav` se rellena
 * con la conexión nueva para que todo lo que lo tiene en la mano siga valiendo.
 */
async function recupera(nav) {
  console.log("\n    (la pestaña no contesta: se abre otra limpia y se sigue)");

  try {
    nav.cierra();
  } catch {
    /* ya estaba rota */
  }

  try {
    const todas = await fetch(`http://127.0.0.1:${PUERTO}/json`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json());

    for (const vieja of todas) {
      if (vieja.type === "page" && /wyscout|hudl/i.test(vieja.url)) {
        await fetch(`http://127.0.0.1:${PUERTO}/json/close/${vieja.id}`, { signal: AbortSignal.timeout(15_000) });
      }
    }
  } catch {
    /* si no deja cerrar, se abre la nueva igualmente */
  }

  await fetch(`http://127.0.0.1:${PUERTO}/json/new?https://wyscout.hudl.com/app/`, { method: "PUT", signal: AbortSignal.timeout(15_000) });

  Object.assign(nav, await conecta());

  await espera(4000);
}

async function conecta() {
  let pestana = null;

  for (let i = 0; i < 80 && !pestana; i++) {
    await espera(500);

    try {
      const lista = await fetch(`http://127.0.0.1:${PUERTO}/json`, { signal: AbortSignal.timeout(15_000) }).then((r) =>
        r.json(),
      );

      pestana = lista.find((x) => x.type === "page" && /wyscout|hudl/i.test(x.url));
    } catch {
      /* todavía no ha levantado */
    }
  }

  if (!pestana) throw new Error("Chrome no ha abierto el puerto de mando.");

  /*
  | Una sola pestaña, que si no se pierde el hilo.
  |
  | Al restaurar la sesión anterior Chrome reabre lo que hubiera, y con tres
  | pestañas de Wyscout abiertas cada orden podía irse a una distinta: se
  | pulsaba un filtro en una y se leía el resultado en otra. Se queda la que se
  | va a manejar y se cierran las demás.
  */
  try {
    const todas = await fetch(`http://127.0.0.1:${PUERTO}/json`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json());

    for (const otra of todas) {
      if (otra.type !== "page" || otra.id === pestana.id) continue;

      if (!/wyscout|hudl/i.test(otra.url)) continue;

      await fetch(`http://127.0.0.1:${PUERTO}/json/close/${otra.id}`, { signal: AbortSignal.timeout(15_000) });
    }
  } catch {
    /* si no se dejan cerrar, se sigue con la que hay */
  }

  const ws = new WebSocket(pestana.webSocketDebuggerUrl);

  await new Promise((listo) => (ws.onopen = listo));

  let n = 0;
  const pendientes = new Map();
  const descargas = [];

  ws.onmessage = (e) => {
    const dato = JSON.parse(e.data);

    if (dato.id && pendientes.has(dato.id)) {
      pendientes.get(dato.id)(dato);
      pendientes.delete(dato.id);
    }

    if (dato.method === "Browser.downloadProgress" && dato.params.state === "completed") {
      descargas.push(dato.params.guid);
    }
  };

  const manda = (metodo, parametros = {}) =>
    new Promise((res, rej) => {
      const id = ++n;

      pendientes.set(id, (d) =>
        d.error ? rej(new Error(`${metodo}: ${d.error.message}`)) : res(d.result),
      );

      ws.send(JSON.stringify({ id, method: metodo, params: parametros }));

      /* Corto a propósito: si la pestaña se atasca, mejor reintentar que
         quedarse dos minutos mirando. */
      const plazo = setTimeout(() => rej(new Error(`sin respuesta: ${metodo}`)), 30000);

      /* Que el plazo no retenga al proceso 30 s después de acabar. */
      plazo.unref?.();
    });

  const js = async (codigo) => {
    const r = await manda("Runtime.evaluate", {
      expression: `(async () => { ${codigo} })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? "js");
    }

    return r.result.value;
  };

  await manda("Page.enable");
  await manda("Runtime.enable");

  await manda("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: DESCARGAS,
    eventsEnabled: true,
  });

  /**
   * Un clic de ratón de verdad sobre el elemento que lleve ese texto.
   *
   * De verdad y no `element.click()` porque media aplicación escucha eventos
   * de ratón sobre contenedores, no sobre el nodo del texto: el `click()`
   * sintético se lo traga el div de al lado y no pasa nada.
   */
  const donde = (texto, indice = 0) =>
    js(`
      const busca = ${JSON.stringify(texto)}.normalize("NFC").toLowerCase();

      const limpio = (t) => (t || "").replace(/\\s+/g, " ").trim().normalize("NFC").toLowerCase();

      /*
      | Por contenido y no por igualdad exacta.
      |
      | Las celdas de Wyscout vienen con cincuenta espacios alrededor y a veces
      | con un icono dentro, así que el texto exacto falla la mitad de las
      | veces. Se buscan todos los que **contienen** la palabra y se elige el
      | más pequeño: el nodo del rótulo, no la tarjeta entera ni el panel.
      */
      const pulsable = (e) => {
        const r = e.getBoundingClientRect();

        /* Ni invisible ni de un píxel: tiene que ser algo que se pueda pulsar. */
        return r.width >= 18 && r.height >= 8 && r.top >= 0 && r.top < innerHeight;
      };

      const todos = [...document.querySelectorAll("div,span,a,button,td,li,p,h1,h2,h3")]
        .filter((e) => e.childElementCount === 0)
        .filter((e) => e.getClientRects().length > 0)
        .filter(pulsable);

      /* Primero el rótulo exacto; si no lo hay, el más ajustado que lo contenga. */
      const exactos = todos.filter((e) => limpio(e.textContent) === busca);

      const contienen = todos
        .filter((e) => limpio(e.textContent).includes(busca))
        .sort((a, b) => limpio(a.textContent).length - limpio(b.textContent).length);

      const candidatos = exactos.length ? exactos : contienen;

      const e = candidatos[${indice}];

      if (!e) return null;

      const r = e.getBoundingClientRect();

      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    `);

  /**
   * Un clic de ratón de verdad, con sus pausas.
   *
   * De verdad y no `element.click()` porque media aplicación escucha eventos
   * de ratón sobre contenedores, no sobre el nodo del texto. Y con pausas
   * entre mover, pulsar y soltar porque sin ellas la aplicación **se pierde
   * uno de cada tres clics**: necesita el `mouseover` antes de recibir el
   * `mousedown`.
   */
  const clic = async (texto, { indice = 0, luego = 3500 } = {}) => {
    const sitio = await donde(texto, indice);

    if (!sitio) return false;

    await manda("Input.dispatchMouseEvent", {
      type: "mouseMoved", x: sitio.x, y: sitio.y, button: "none",
    });

    await espera(220);

    await manda("Input.dispatchMouseEvent", {
      type: "mousePressed", x: sitio.x, y: sitio.y, button: "left", clickCount: 1, buttons: 1,
    });

    await espera(90);

    await manda("Input.dispatchMouseEvent", {
      type: "mouseReleased", x: sitio.x, y: sitio.y, button: "left", clickCount: 1, buttons: 0,
    });

    await espera(luego);

    return true;
  };

  /** Esperar a que una cuenta de la página cumpla algo, no a que aparezca un texto. */
  const esperaValor = async (codigo, cumple, segundos = 30) => {
    for (let i = 0; i < segundos * 2; i++) {
      const valor = await js(codigo);

      if (cumple(valor)) return true;

      await espera(500);
    }

    return false;
  };

  /** Pulsar hasta que pase algo: la aplicación se come clics sin avisar. */
  const clicHasta = async (texto, patron, { intentos = 3, segundos = 20 } = {}) => {
    for (let i = 0; i < intentos; i++) {
      if (!(await clic(texto, { luego: 900 }))) return false;

      if (await esperaA(patron, segundos)) return true;
    }

    return false;
  };

  const texto = () =>
    js(`return ((document.body || {}).innerText || "").replace(/\\s+/g, " ");`);

  /**
   * Esperar a que aparezca algo, en vez de esperar un rato.
   *
   * Es la diferencia entre un script que va y uno que va «casi siempre». La
   * aplicación tarda lo que tarda —a veces dos segundos, a veces diez— y con
   * esperas fijas el fallo no es un error: es que el clic siguiente cae sobre
   * la pantalla anterior y no pasa nada.
   */
  const esperaA = async (patron, segundos = 25) => {
    for (let i = 0; i < segundos * 2; i++) {
      const hay = await js(`
        return new RegExp(${JSON.stringify(patron)}, "i")
          .test(((document.body || {}).innerText || "").replace(/\\s+/g, " "));
      `);

      if (hay) return true;

      await espera(500);
    }

    return false;
  };

  const foto = async (nombre) => {
    const r = await manda("Page.captureScreenshot", { format: "png" });

    fs.writeFileSync(nombre, Buffer.from(r.data, "base64"));
  };

  return {
    manda, js, clic, clicHasta, donde, texto, esperaA, esperaValor, foto, descargas,
    cierra: () => ws.close(),
  };
}

/* ------------------------------------------------------------------ */
/*  LA SESIÓN                                                          */
/* ------------------------------------------------------------------ */

/*
| Dentro de verdad = en la aplicación Y con las cookies de Wyscout puestas.
|
| Mirar sólo la dirección engañaba (04/10/2026): a mitad del inicio de sesión
| la página vuelve un instante a wyscout.hudl.com/app con el «state» de Hudl,
| se daba por entrado, se guardaba la sesión sin `WyscoutJWT` ni
| `authToken` y la pasada siguiente decía «la sesión ha caducado».
*/
async function estaDentro(nav) {
  const enLaApp = await nav.js(`
    const hayLogin =
      document.querySelector("input[type=password]") !== null ||
      /identity\\.hudl\\.com|\\/login/i.test(location.href);

    return !hayLogin && /wyscout\\.hudl\\.com\\/app/.test(location.href);
  `);

  if (!enLaApp) return false;

  /*
  | Y la aplicación pintada (05/10/2026): con una sesión de Hudl ya caducada,
  | Wyscout abre un instante /app/ —con las cookies puestas— antes de mandar a
  | la página de entrar, y se daba por dentro. Hace falta ver su barra de
  | arriba o la lista de países.
  */
  const pintada = await nav.js(`
    if (document.querySelector("span.ae-home-1")) return true;

    return /Albania|PAÍSES|Advanced Search/.test((document.body || {}).innerText || "");
  `);

  if (!pintada) return false;

  try {
    const { cookies } = await nav.manda("Network.getAllCookies");

    return (cookies ?? []).some((c) => /^(WyscoutJWT|authToken)$/.test(c.name) && /hudl\.com|wyscout\.com/.test(c.domain ?? ""));
  } catch {
    return enLaApp;
  }
}

/* ------------------------------------------------------------------ */
/*  ENTRAR SOLO (05/10/2026)                                           */
/* ------------------------------------------------------------------ */

/*
| La sesión de Hudl caduca en pocas horas: reponer las cookies vale el mismo
| día, no de un día para otro, y el botón de Ajustes se encontraba la página
| de «Iniciar sesión». Si hay cuenta guardada (scripts\guardar-clave-wys.cmd,
| cifrada con DPAPI para este usuario de Windows), se escribe aquí el correo y
| la contraseña. La contraseña se descifra en el momento, no se escribe en
| ningún registro y no sale de este proceso.
*/
const FICHERO_CREDENCIAL = path.join(CACHE, "credencial.json");

function leeCredencial() {
  if (!fs.existsSync(FICHERO_CREDENCIAL)) return null;

  try {
    const datos = JSON.parse(fs.readFileSync(FICHERO_CREDENCIAL, "utf8").replace(/^\uFEFF/, ""));

    const clave = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "$s = ConvertTo-SecureString ([Console]::In.ReadToEnd().Trim()); [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))",
      ],
      { input: datos.clave, encoding: "utf8", windowsHide: true, timeout: 30_000 },
    ).replace(/\r?\n$/, "");

    return datos.correo && clave ? { correo: String(datos.correo), clave } : null;
  } catch {
    return null;
  }
}

/** Escribe en el campo que encaje, como si se tecleara. */
async function escribeEn(nav, selector, texto) {
  const hay = await nav.js(`
    const i = document.querySelector(${JSON.stringify(selector)});
    if (!i) return false;
    const poner = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    poner.call(i, "");
    i.dispatchEvent(new Event("input", { bubbles: true }));
    i.focus();
    return true;
  `);

  if (!hay) return false;

  await nav.manda("Input.insertText", { text: texto });

  await espera(300);

  await nav.js(`
    const i = document.querySelector(${JSON.stringify(selector)});
    const f = i && i.form;
    const b = (f && f.querySelector('button[type=submit]')) || document.querySelector('button[type=submit]');
    if (b) b.click(); else if (f) f.requestSubmit ? f.requestSubmit() : f.submit();
    return true;
  `);

  return true;
}

/** En la página de Hudl: correo, continuar, contraseña, continuar. */
async function entraSolo(nav, cuenta) {
  console.log("  La sesión de Hudl ha caducado: se entra con la cuenta guardada…");

  await escribeEn(nav, "input[type=email], input[name=username], input#username", cuenta.correo);

  /* La contraseña sale en una segunda pantalla. */
  const hayClave = await nav.esperaValor(`return document.querySelector("input[type=password]") ? 1 : 0;`, (v) => v === 1, 25);

  if (!hayClave) return false;

  await escribeEn(nav, "input[type=password]", cuenta.clave);

  return true;
}

async function esperaLogin(nav) {
  /* La primera comprobación, con la página todavía cargando, dice que no
     estamos dentro aunque lo estemos: se le da un momento a que pinte algo. */
  await nav.esperaA("Albania|Mikelats|Contraseña|Password|Log In", 20);

  /*
  | Con la sesión repuesta, Wyscout no entra a la primera (05/10/2026): pasa
  | unos segundos por la página de Hudl, renueva la sesión y vuelve solo. Se
  | miraba UNA vez, justo en medio, y en desatendido se daba por caducada una
  | sesión buena —el botón de Ajustes falló así tres veces seguidas el
  | 05/10—. Ahora se mira cada 3 s durante un minuto; sólo si en todo ese rato
  | no entra, es que de verdad hay que escribir la contraseña.
  */
  const cuenta = leeCredencial();

  let intentada = false;

  for (let i = 0; i < 30; i++) {
    if (await estaDentro(nav)) {
      console.log(intentada ? "  Dentro con la cuenta guardada.\n" : "  Sesión ya iniciada en este perfil.\n");

      return true;
    }

    const pideEntrar = await nav
      .js(`return /identity\\.hudl\\.com|\\/login/i.test(location.href) && !!document.querySelector("input[type=email], input[name=username], input#username, input[type=password]");`)
      .catch(() => false);

    if (pideEntrar && cuenta && !intentada) {
      intentada = true;

      await entraSolo(nav, cuenta).catch(() => false);

      await espera(5000);

      continue;
    }

    /* Sin cuenta guardada y en la página de entrar: no hay nada que esperar. */
    if (pideEntrar && !cuenta && i >= 3) break;

    await espera(3000);
  }

  if (!cuenta) {
    console.log("  (No hay cuenta guardada: con scripts\\guardar-clave-wys.cmd entraría solo.)");
  } else if (intentada) {
    console.log("  La cuenta guardada no ha entrado: ¿ha cambiado la contraseña? Vuelve a guardarla con scripts\\guardar-clave-wys.cmd.");
  }

  /*
  | Desatendido: no se espera a nadie.
  |
  | Cuando esto lo lanza el Programador de tareas un martes por la mañana no
  | hay quien escriba la contraseña, y quedarse diez minutos con una ventana
  | abierta esperando sólo sirve para que la tarea muera por tiempo y no deje
  | ni rastro de por qué. Se sale en seco con un motivo que se lee de un
  | vistazo en el registro, y ya lo reintenta la pasada siguiente.
  */
  if (bandera("desatendido")) {
    /* Un solo remedio, el que toca (09/10/2026): decía «guarda la clave» y
       dos líneas después «abre actualizar-wys.cmd». */
    console.log(
      "\n  LA SESIÓN DE WYSCOUT HA CADUCADO.\n" +
        (cuenta
          ? "  La cuenta guardada no entra: vuelve a guardarla (doble clic en\n" +
            "  scripts\\guardar-clave-wys.cmd) y la tarea vuelve sola.\n"
          : "  No hay cuenta guardada: guárdala una vez con doble clic en\n" +
            "  scripts\\guardar-clave-wys.cmd y a partir de ahí entra sola.\n"),
    );

    return false;
  }

  console.log(
    "\n  ┌──────────────────────────────────────────────────────────┐\n" +
      "  │  ENTRA EN WYSCOUT EN LA VENTANA QUE SE HA ABIERTO        │\n" +
      "  │  La contraseña la escribes tú: esto no la ve.            │\n" +
      "  │  Cuando estés dentro, no cierres la ventana.             │\n" +
      "  └──────────────────────────────────────────────────────────┘\n",
  );

  for (let i = 0; i < 120; i++) {
    await espera(5000);

    if (await estaDentro(nav)) {
      console.log("\n  Dentro. La sesión queda guardada para la semana que viene.\n");

      return true;
    }

    if (i % 6 === 5) console.log("  …esperando");
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  NAVEGAR HASTA EL GRUPO                                             */
/* ------------------------------------------------------------------ */

/**
 * De la portada al grupo, pulsando lo mismo que se pulsa a mano.
 *
 * No hay atajo: la aplicación **no tiene direcciones**. Navegar por ella nunca
 * cambia la URL —siempre `/app/`— así que no se puede saltar a un equipo ni
 * volver con el botón de atrás del navegador. Todo es a golpe de clic.
 */
async function vaAlGrupo(nav, intentos = 3) {
  /*
  | Con reintento, porque el camino se pierde solo.
  |
  | La aplicación se come clics cuando está ocupada —y tras una tabla de
  | quinientas celdas lo está— así que a veces se pulsa «España» y no pasa
  | nada. Recargar y volver a intentarlo cuesta diez segundos; rendirse cuesta
  | la mitad de la liga.
  */
  for (let i = 1; i < intentos; i++) {
    try {
      return await vaAlGrupoUnaVez(nav);
    } catch {
      await espera(3000);
    }
  }

  return vaAlGrupoUnaVez(nav);
}

async function vaAlGrupoUnaVez(nav) {
  await nav.manda("Page.navigate", { url: "https://wyscout.hudl.com/app/" });

  /*
  | `/app/` no siempre abre la lista de países: **abre la última aplicación
  | que se usó**. Si se quedó en el buscador de jugadores hay que volver a
  | «Platform» por el lanzador, o los tres clics siguientes caen en el vacío.
  */
  if (!(await nav.esperaA("Albania", 15))) {
    await abreAplicacion(nav, "Platform");
  }

  if (!(await nav.esperaA("Albania"))) {
    throw new Error("No carga la lista de países.");
  }

  if (!(await nav.clicHasta(PAIS, COMPETICION))) {
    throw new Error(`No se abre ${PAIS} o no aparece ${COMPETICION}.`);
  }

  if (!(await nav.clicHasta(COMPETICION, "EQUIPOS|" + GRUPO))) {
    throw new Error(`No se abre ${COMPETICION}.`);
  }

  /* El grupo sólo aparece en las competiciones que lo tienen. */
  if (await nav.esperaA(GRUPO, 8)) {
    await nav.clic(GRUPO, { luego: 2500 });
  }

  if (!(await nav.esperaA("EQUIPOS"))) {
    throw new Error("No aparece la rejilla de equipos del grupo.");
  }

  const equipos = await nav.js(`
    /* Las fichas de equipo son «item-text title» dentro de la rejilla. */
    const fichas = [...document.querySelectorAll("div[class*='item-text'][class*='title']")]
      .filter((e) => e.getClientRects().length > 0)
      .filter((e) => !/ - /.test(e.textContent || ""))
      .map((e) => (e.textContent || "").trim())
      .filter((t) => t.length > 1 && t.length < 40)
      /* La flecha de volver vive en la misma rejilla y no es un equipo. */
      .filter((t) => !/^(Regresar|Volver|Back)$/i.test(t));

    return [...new Set(fichas)];
  `);

  return equipos;
}

/**
 * De la ficha de un equipo a la rejilla del grupo, por la flecha de atrás.
 *
 * La flecha vive arriba a la izquierda y no lleva texto —es un icono—, así que
 * se busca por su sitio: el primer elemento pequeño y pulsable del rincón. Se
 * pulsa hasta dos veces porque desde estadísticas hay que subir dos escalones.
 */
async function volverAlGrupo(nav) {
  for (let i = 0; i < 3; i++) {
    if (await nav.esperaA("EQUIPOS", 3)) return true;

    const sitio = await nav.js(`
      const e = [...document.querySelectorAll("div,span,a,button,i")]
        .filter((x) => {
          const r = x.getBoundingClientRect();

          return r.top > 40 && r.top < 90 && r.left < 70 && r.width > 6 && r.width < 40;
        })[0];

      if (!e) return null;

      const r = e.getBoundingClientRect();

      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    `);

    if (!sitio) return false;

    await nav.manda("Input.dispatchMouseEvent", {
      type: "mouseMoved", x: sitio.x, y: sitio.y, button: "none",
    });

    await espera(200);

    await nav.manda("Input.dispatchMouseEvent", {
      type: "mousePressed", x: sitio.x, y: sitio.y, button: "left", clickCount: 1, buttons: 1,
    });

    await espera(90);

    await nav.manda("Input.dispatchMouseEvent", {
      type: "mouseReleased", x: sitio.x, y: sitio.y, button: "left", clickCount: 1, buttons: 0,
    });

    await espera(3000);
  }

  return nav.esperaA("EQUIPOS", 5);
}

/* ------------------------------------------------------------------ */
/*  UN EQUIPO                                                          */
/* ------------------------------------------------------------------ */

/**
 * Abrir el equipo, ir a estadísticas, asegurar ALL y exportar.
 *
 * `ALL` es un layout de la cuenta, así que una vez elegido se queda puesto
 * para los siguientes equipos; aun así se comprueba en cada uno, que es lo que
 * cuesta cero y evita bajarse veinte ficheros con la mitad de las columnas.
 */
/** Las columnas del primer informe con ALL: 109. Por debajo de esto, algo falla. */
const MIN_COLUMNAS = 80;

/** Cuántas columnas trae un .xlsx, leyendo su rango; `null` si no se sabe. */
function columnasDe(fichero) {
  try {
    const zip = unzipSync(new Uint8Array(fs.readFileSync(fichero)));
    const hoja = zip["xl/worksheets/sheet1.xml"];

    if (!hoja) return null;

    const rango = strFromU8(hoja).match(/<dimension ref="[A-Z]+\d+:([A-Z]+)\d+"/)?.[1];

    if (!rango) return null;

    return [...rango].reduce((total, letra) => total * 26 + (letra.charCodeAt(0) - 64), 0);
  } catch {
    return null;
  }
}

/**
 * Cuántas filas trae un Excel de jugadores de cada equipo (09/10/2026).
 *
 * La ficha del filtro no basta para saber que un equipo ha entrado: el
 * Águilas salía puesto en «Equipo actual» y el fichero no traía ni un
 * jugador suyo, semana tras semana, con un «✓» en el registro. Lo que manda
 * es lo que trae el fichero: la columna «Equipo». Devuelve el mapa
 * equipo-normalizado → filas, o null si no se puede leer.
 */
function equiposDe(fichero) {
  try {
    const zip = unzipSync(new Uint8Array(fs.readFileSync(fichero)));
    const hoja = zip["xl/worksheets/sheet1.xml"];

    if (!hoja) return null;

    const desescapa = (t) =>
      t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

    const compartidas = zip["xl/sharedStrings.xml"]
      ? [...strFromU8(zip["xl/sharedStrings.xml"]).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
          desescapa([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
        )
      : [];

    const filas = [...strFromU8(hoja).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((fila) => {
      const celdas = {};

      for (const c of fila[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const crudo = (c[3] || "").match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? (c[3] || "").match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];

        celdas[c[1]] = /t="s"/.test(c[2]) ? compartidas[Number(crudo)] : desescapa(crudo ?? "");
      }

      return celdas;
    });

    const cabecera = filas[0] ?? {};
    const columna = Object.keys(cabecera).find((k) => /^equipo$/i.test((cabecera[k] ?? "").trim()));

    if (!columna) return null;

    const cuenta = new Map();

    for (const fila of filas.slice(1)) {
      const equipo = normalizaEquipo(fila[columna]);

      if (equipo) cuenta.set(equipo, (cuenta.get(equipo) ?? 0) + 1);
    }

    return cuenta;
  } catch {
    return null;
  }
}

const normalizaEquipo = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

/**
 * «Todas las columnas», cuando la cuenta no tiene el layout ALL (05/10/2026).
 *
 * La cuenta con la que entra el ordenador del club (la del juvenil) no tiene
 * ALL, pero la tabla tiene su propio selector: el icono de tabla junto a
 * «MOSTRAR» abre «Elegir las columnas para mostrar», con una casilla «Todas
 * las columnas». Se marca y se aplica en cada equipo —«Guardar como
 * predeterminado» no se queda guardado— y se espera a que la tabla vuelva
 * a estar llena. El fichero exportado se sigue contando (MIN_COLUMNAS).
 */
async function todasLasColumnas(nav) {
  const icono = await nav.js(`
    const b = document.querySelector('[class*="ColumnsSettings__custom-btn"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  `);

  if (!icono) return false;

  await nav.manda("Input.dispatchMouseEvent", { type: "mouseMoved", x: icono.x, y: icono.y, button: "none" });
  await espera(200);

  for (const type of ["mousePressed", "mouseReleased"]) {
    await nav.manda("Input.dispatchMouseEvent", { type, x: icono.x, y: icono.y, button: "left", clickCount: 1 });
  }

  if (!(await nav.esperaA("Elegir las columnas", 10))) return false;

  /* La casilla, sólo si no está ya marcada (pulsarla otra vez la quitaría). */
  await nav.js(`
    const rotulo = [...document.querySelectorAll("label, span, div")]
      .filter((x) => x.childElementCount < 4 && (x.textContent || "").trim() === "Todas las columnas")
      .pop();
    const casilla = rotulo && (rotulo.querySelector("input") || rotulo.parentElement.querySelector("input"));
    if (casilla && !casilla.checked) (rotulo.tagName === "LABEL" ? rotulo : casilla).click();
    return true;
  `);

  await espera(600);

  /* «Aplicar»: con el ratón no reacciona; con el clic del DOM, sí. */
  await nav.js(`
    const b = [...document.querySelectorAll("button, a, div, span")]
      .filter((x) => (x.textContent || "").trim().toUpperCase() === "APLICAR" && x.getClientRects().length)
      .pop();
    if (b) b.click();
    return Boolean(b);
  `);

  const cerrado = await nav.esperaValor(
    `return (document.body.innerText || "").includes("Elegir las columnas") ? 0 : 1;`,
    (v) => v === 1,
    15,
  );

  if (!cerrado) return false;

  /* La tabla se recarga entera: hasta que vuelva a tener filas de partido. */
  const llena = await nav.esperaValor(`return document.querySelectorAll("table tr").length;`, (filas) => filas >= 6, 60);

  const columnas = await nav.js(`return document.querySelectorAll("th").length;`);

  return Boolean(llena) && columnas >= 30;
}

async function bajaEquipo(nav, equipo) {
  if (!(await nav.clicHasta(equipo, "Estadísticas|Vista general"))) {
    return { equipo, estado: "no se abre la ficha del equipo" };
  }

  if (!(await nav.clicHasta("Estadísticas", "Exportar en Excel", { segundos: 30 }))) {
    return { equipo, estado: "no carga la tabla de estadísticas" };
  }

  /*
  | Y esperar a que la tabla esté **llena**, no a que aparezca el botón.
  |
  | Ésta es la que costó: el botón de exportar sale enseguida, pero si se pulsa
  | mientras la tabla todavía tiene sólo la fila de PROMEDIO, Wyscout exporta
  | eso — un fichero de 19 KB en vez de 60, con media liga fuera— y encima le
  | pone de nombre «Team Stats undefined». Salía «✓» y el dato estaba mutilado,
  | que es la peor forma de fallar. Se espera a que haya filas de partido.
  */
  const llena = await nav.esperaValor(
    `return document.querySelectorAll("table tr").length;`,
    (filas) => filas >= 6,
    40,
  );

  if (!llena) return { equipo, estado: "la tabla se queda sin filas de partido" };

  /* ¿Está ya en ALL? El rótulo del desplegable lo dice. */
  const enAll = await nav.js(`
    const t = ((document.body || {}).innerText || "").replace(/\\s+/g, " ");

    return /MOSTRAR: ?ALL/i.test(t);
  `);

  if (!enAll) {
    /* El desplegable se abre pulsando su rótulo actual, sea el que sea. */
    await nav.js(`
      const e = [...document.querySelectorAll("*")]
        .filter((x) => x.childElementCount === 0 && /^MOSTRAR:?$/i.test((x.textContent || "").trim()))
        .filter((x) => x.getClientRects().length > 0)[0];

      if (e) {
        const r = e.getBoundingClientRect();

        window.__mostrar = { x: Math.round(r.right + 90), y: Math.round(r.top + r.height / 2) };
      }

      return !!e;
    `);

    const sitio = await nav.js(`return window.__mostrar ?? null;`);

    if (sitio) {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await nav.manda("Input.dispatchMouseEvent", {
          type, x: sitio.x, y: sitio.y, button: "left", clickCount: 1,
        });
      }

      await espera(1500);

      await nav.clic("ALL", { luego: 5000 });
    }
  }

  /*
  | Y se COMPRUEBA que ha quedado en ALL antes de exportar nada.
  |
  | El 28/09/2026 la sesión era de otra cuenta de Wyscout (la del juvenil), sin
  | el layout ALL: el clic no encontraba nada, se exportaba «General» —26
  | columnas en vez de 109— y ese fichero machacaba el bueno de cada equipo.
  | Sin ALL no se exporta: el fichero de antes se queda como está.
  */
  const quedoEnAll = await nav.js(`
    const t = ((document.body || {}).innerText || "").replace(/\\s+/g, " ");

    return /MOSTRAR: ?ALL/i.test(t);
  `);

  /* Sin ALL (la cuenta del juvenil): todas las columnas desde su selector. */
  const conTodas = quedoEnAll || (await todasLasColumnas(nav).catch(() => false));

  if (!conTodas && !bandera("parar")) {
    return {
      equipo,
      estado:
        "esta cuenta de Wyscout no tiene el layout ALL (se deja el fichero de antes; entra con la cuenta buena o crea el layout ALL)",
    };
  }

  /*
  | `--parar` deja la ventana abierta en la tabla, sin exportar nada.
  |
  | Es la herramienta de mantenimiento: el día que Wyscout cambie un botón,
  | esto deja la pantalla exactamente donde hay que mirar.
  */
  if (bandera("parar")) return { equipo, estado: "parado en la tabla" };

  /* Por la hora y no por el nombre: un fichero a medias de una pasada
     anterior se queda en la carpeta y ya no parece nuevo nunca. Y la
     carpeta, vacía antes (09/10/2026): el Excel de un equipo que tardó más
     de la cuenta llegaba durante el siguiente y se guardaba con su nombre. */
  for (const viejo of fs.readdirSync(DESCARGAS).filter((f) => /\.xlsx$/i.test(f))) {
    try {
      fs.unlinkSync(path.join(DESCARGAS, viejo));
    } catch {
      /* si Chrome aún lo tiene abierto, la hora lo descarta */
    }
  }

  const desde = Date.now();

  if (!(await nav.clic("Exportar en Excel", { luego: 2000 }))) {
    return { equipo, estado: "no encuentro el botón de exportar" };
  }

  /* El fichero tarda: lo genera el servidor y baja como blob. */
  let fichero = null;

  for (let i = 0; i < 40 && !fichero; i++) {
    await espera(1000);

    fichero = fs
      .readdirSync(DESCARGAS)
      .filter((f) => f.endsWith(".xlsx"))
      .find((f) => fs.statSync(path.join(DESCARGAS, f)).mtimeMs >= desde);
  }

  if (!fichero) return { equipo, estado: "no ha bajado el fichero" };

  const origen = path.join(DESCARGAS, fichero);

  const kb = Math.round(fs.statSync(origen).size / 1024);

  /*
  | Las columnas, antes de sustituir nada.
  |
  | Un informe con ALL trae más de cien; con la tabla a medio cargar o con
  | otro layout, una veintena. El tamaño sólo avisaba y el fichero corto se
  | copiaba igual encima del bueno. Ahora no: si no llega, se tira el nuevo y
  | se queda el de antes.
  */
  const columnas = columnasDe(origen);

  if (columnas === null || columnas < MIN_COLUMNAS) {
    fs.unlinkSync(origen);

    return {
      equipo,
      estado:
        columnas === null
          ? "el Excel bajado no se puede leer: se deja el fichero de antes"
          : `el Excel sólo trae ${columnas} columnas (con ALL son más de ${MIN_COLUMNAS}): se deja el fichero de antes`,
    };
  }

  /*
  | El nombre lo ponemos nosotros, no Wyscout.
  |
  | Porque a veces lo manda como «Team Stats undefined.xlsx» —cuando el nombre
  | del equipo aún no ha llegado a su cabecera— y dos equipos seguidos se
  | pisaban el mismo fichero. Con el nombre puesto aquí, el lector encuentra lo
  | que espera y nadie se queda sin informe por una carrera de carga.
  */
  const destino = path.join(DESTINO, `Team Stats ${equipo}.xlsx`);

  fs.copyFileSync(origen, destino);
  fs.unlinkSync(origen);

  /*
  | Y un aviso si el fichero es sospechosamente pequeño.
  |
  | Un informe con ALL y unas cuantas jornadas anda por los 60 KB; 20 KB es la
  | señal de que se exportó la tabla a medio cargar. No se borra —puede ser un
  | equipo con dos partidos— pero se dice, que es lo que distingue un «✓» de
  | verdad de uno que te deja el dato mutilado sin enterarte.
  */
  return {
    equipo,
    estado: "ok",
    fichero: path.basename(destino),
    kb,
    sospechoso: kb < 25,
  };
}

/**
 * Cambia de aplicación por el menú del lanzador.
 *
 * Wyscout no es una aplicación sino varias metidas en la misma pestaña, y se
 * salta entre ellas por un botón **sin texto ni identificador**: el grande que
 * hay justo detrás del de la casita, arriba en el centro. Se localiza por ahí,
 * que es lo único estable que tiene, y se pulsa con ratón de verdad porque la
 * barra de arriba no está hecha de DOM corriente.
 */
async function abreAplicacion(nav, nombre) {
  /* La barra de arriba se pinta después que la aplicación: hay que esperarla. */
  await nav.esperaValor(
    `return document.querySelector("span.ae-home-1") ? 1 : 0;`,
    (hay) => hay === 1,
    40,
  );

  const sitio = await nav.js(`
    const casa = document.querySelector("span.ae-home-1");

    const lanzador = casa?.closest(".gears-button")?.nextElementSibling;

    if (!lanzador) return null;

    const r = lanzador.getBoundingClientRect();

    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  `);

  if (!sitio) throw new Error("No encuentro el lanzador de aplicaciones.");

  await nav.manda("Input.dispatchMouseEvent", {
    type: "mouseMoved", x: sitio.x, y: sitio.y, button: "none",
  });

  await espera(220);

  await nav.manda("Input.dispatchMouseEvent", {
    type: "mousePressed", x: sitio.x, y: sitio.y, button: "left", clickCount: 1, buttons: 1,
  });

  await espera(90);

  await nav.manda("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: sitio.x, y: sitio.y, button: "left", clickCount: 1, buttons: 0,
  });

  await espera(1500);

  if (!(await nav.clic(nombre, { luego: 6000 }))) {
    throw new Error(`No sale «${nombre}» en el menú de aplicaciones.`);
  }

  return true;
}

/* ------------------------------------------------------------------ */
/*  EL BUSCADOR DE JUGADORES (ES OTRA APLICACIÓN)                      */
/* ------------------------------------------------------------------ */

/*
| Los jugadores no salen de la ficha del equipo: están en «Advanced Search»,
| que **es otra aplicación** —vive en un `<iframe>` de `wyscout-apps.hudl.com`
| colgado de la misma pestaña— y se abre por el lanzador del centro de la barra
| de arriba. Dentro se eligen competición, temporada y MOSTRAR = ALL, y se
| exporta a Excel igual que en los equipos.
|
| TRES COSAS QUE OBLIGAN A HACERLO ASÍ
|
| 1. **Wyscout corta la exportación en 500 filas.** Sale un aviso —«sólo se
|    exportarán los primeros 500 registros»— y el resto se pierde sin más. Por
|    eso no se piden los veinte equipos de una vez: se piden por lotes, con el
|    filtro «Equipo actual», y cada lote baja su fichero. `leer.ts` los junta
|    solo, que ya sabe fundir varias descargas del mismo jugador.
|
| 2. **Los desplegables sólo se abren con ratón de verdad.** Los eventos
|    fabricados a mano no los mueven: el de competiciones se queda cerrado
|    aunque le llegue el `mousedown`. Así que abrir es un clic de CDP sobre su
|    sitio en pantalla, sumándole lo que baja el marco respecto a la ventana.
|
| 3. **Elegir la opción, al revés: a mano y sin coordenadas.** Las listas se
|    pintan recortadas —la opción existe en el DOM pero cae fuera del trozo
|    visible— y el clic por coordenadas aterriza en el vacío. Sobre la opción
|    sí valen los eventos fabricados, y así la posición deja de importar.
*/

/** De hoy a «2026/2027»: la temporada arranca en julio. */
function temporadaDeHoy(hoy = new Date()) {
  const arranque =
    hoy.getMonth() >= 6 ? hoy.getFullYear() : hoy.getFullYear() - 1;

  return `${arranque}/${arranque + 1}`;
}

const TEMPORADA = argumento("temporada") ?? temporadaDeHoy();

/** Cuántos equipos por descarga. Siete deja mucho aire bajo las 500 filas. */
const LOTE = Number(argumento("lote") ?? 7);

/* Lo que se inyecta en cada evaluación dentro del marco. */
const HERRAMIENTAS = `
  const norma = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

  const pulsa = (e) => {
    if (!e) return false;

    for (const tipo of ["mouseover", "mousedown", "mouseup", "click"]) {
      e.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window, button: 0 }));
    }

    return true;
  };

  const filtro = (rotulo) =>
    [...document.querySelectorAll(".chosen-filter--2Jv8u")]
      .find((x) => norma(x.textContent).startsWith(norma(rotulo))) || null;

  /*
  | Por dónde se abre un desplegable: por la flecha.
  |
  | En el de equipos el centro del mando no está vacío —lo ocupan las fichas
  | de los que ya están puestos— y el clic caía sobre la «×» de uno de ellos:
  | el segundo equipo del lote nunca llegaba a entrar. La flecha de la derecha
  | siempre está y nunca es otra cosa.
  */
  const mandoDe = (rotulo) => {
    const f = filtro(rotulo);

    if (!f) return null;

    return f.querySelector(".Select-arrow-zone") || f.querySelector(".Select-control");
  };

  /* Las candidatas en orden: primero las exactas, luego las que contienen el
     texto, de la más corta a la más larga. «cual» elige la n-ésima: con dos
     equipos del mismo nombre, el rescate prueba la siguiente (09/10/2026). */
  const opciones = (rotulo, texto) => {
    const dentro = rotulo ? filtro(rotulo) : document;

    if (!dentro) return [];

    const lista = [...dentro.querySelectorAll(".Select-option")];

    const q = norma(texto);

    const exactas = lista.filter((x) => norma(x.textContent) === q);

    const parecidas = lista
      .filter((x) => !exactas.includes(x) && norma(x.textContent).includes(q))
      .sort((a, b) => a.textContent.length - b.textContent.length);

    return [...exactas, ...parecidas];
  };

  const opcion = (rotulo, texto, cual = 0) => opciones(rotulo, texto)[cual] || null;

  const cuenta = () => (document.querySelector(".count--2cwld") || {}).innerText || "?";

  /* Lo que está puesto en un filtro: las fichas de react-select. */
  const puestosEn = (rotulo) => {
    const f = filtro(rotulo);

    return f ? [...f.querySelectorAll(".Select-value-label")].map((x) => x.textContent.trim()) : [];
  };
`;

/**
 * Abre «Advanced Search» y devuelve un mando atado a su marco.
 */
async function abreBuscador(nav) {
  const marcoDelBuscador = async () => {
    const { frameTree } = await nav.manda("Page.getFrameTree");

    return (frameTree.childFrames ?? []).find((c) =>
      /advanced-search/.test(c.frame.url),
    );
  };

  /*
  | Y que esté **a la vista**, no sólo que exista.
  |
  | Al cambiar de aplicación Wyscout no se lleva el marco de la anterior: lo
  | deja escondido. Así que encontrarlo no quiere decir que estemos dentro, y
  | el proceso se ponía a pulsar filtros de un marco de cero por cero píxeles.
  */
  const marcoVisible = async () => {
    const aLaVista = await nav.js(`
      const f = [...document.querySelectorAll("iframe")].find((i) => /advanced-search/.test(i.src || ""));

      if (!f) return false;

      const r = f.getBoundingClientRect();

      return r.width > 200 && r.height > 200;
    `);

    return aLaVista ? marcoDelBuscador() : null;
  };

  if (!(await marcoVisible())) {
    await abreAplicacion(nav, "Advanced Search");
  }

  let marco = null;

  for (let i = 0; i < 40 && !marco; i++) {
    marco = await marcoVisible();

    if (!marco) await espera(1000);
  }

  if (!marco) throw new Error("El buscador no ha llegado a abrirse.");

  /* Un mundo aislado: comparte el DOM del marco y no pisa nada de la página. */
  const { executionContextId } = await nav.manda("Page.createIsolatedWorld", {
    frameId: marco.frame.id,
    worldName: "rmcf-buscador",
  });

  const js = async (codigo) => {
    const r = await nav.manda("Runtime.evaluate", {
      expression: `(async () => { ${HERRAMIENTAS} ${codigo} })()`,
      returnByValue: true,
      awaitPromise: true,
      contextId: executionContextId,
    });

    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? "js");
    }

    return r.result.value;
  };

  /**
   * Un clic de ratón de verdad sobre un elemento del marco.
   *
   * `expresion` es un trozo de JavaScript que devuelve el elemento —o `null`—
   * y aquí se traduce a coordenadas de la ventana: lo que mide el marco desde
   * arriba hay que sumárselo, porque las órdenes de ratón son del navegador
   * entero y no saben de marcos.
   */
  const clicReal = async (expresion) => {
    const sitio = await js(`
      const e = ${expresion};

      if (!e) return null;

      /*
      | El sitio no es «el centro del rectángulo»: es un punto que de verdad
      | dé con el elemento.
      |
      | La columna de filtros es una lista con su propio desplazamiento, y
      | conforme se le meten fichas de equipo los mandos se salen por abajo:
      | el rectángulo sigue diciendo dónde estaría, pero ahí ya no hay nada
      | —\`elementFromPoint\` devuelve el contenedor— y el clic se perdía. De
      | los siete equipos de un lote entraban cinco y el resto, al vacío.
      |
      | Se prueban el centro y las esquinas, y si ninguno da, se acerca la
      | lista y se vuelve a mirar.
      */
      const punto = () => {
        const r = e.getBoundingClientRect();

        if (r.width < 2 || r.height < 2) return null;

        for (const y of [r.top + r.height / 2, r.top + 3, r.bottom - 3]) {
          for (const x of [r.left + r.width / 2, r.right - 3, r.left + 3]) {
            const cx = Math.round(x);
            const cy = Math.round(y);

            if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;

            const encima = document.elementFromPoint(cx, cy);

            if (encima && (encima === e || e.contains(encima))) return { x: cx, y: cy };
          }
        }

        return null;
      };

      const primero = punto();

      if (primero) return primero;

      e.scrollIntoView({ block: "center" });

      await new Promise((listo) => setTimeout(listo, 600));

      return punto();
    `);

    if (!sitio) return false;

    const fuera = await nav.js(`
      const f = [...document.querySelectorAll("iframe")].find((i) => /advanced-search/.test(i.src || ""));

      if (!f) return { x: 0, y: 0 };

      const r = f.getBoundingClientRect();

      return { x: Math.round(r.left), y: Math.round(r.top) };
    `);

    const x = sitio.x + fuera.x;
    const y = sitio.y + fuera.y;

    await nav.manda("Input.dispatchMouseEvent", {
      type: "mouseMoved", x, y, button: "none",
    });

    await espera(220);

    await nav.manda("Input.dispatchMouseEvent", {
      type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1,
    });

    await espera(90);

    await nav.manda("Input.dispatchMouseEvent", {
      type: "mouseReleased", x, y, button: "left", clickCount: 1, buttons: 0,
    });

    return true;
  };

  /**
   * Abrir un desplegable, y sólo si estaba cerrado.
   *
   * En el de equipos, elegir uno **deja la lista abierta**: si se vuelve a
   * pulsar la flecha para meter el siguiente, lo que se hace es cerrarla, y
   * entonces no hay opciones que elegir. Del segundo equipo de cada lote en
   * adelante no entraba ninguno.
   */
  const abreDesplegable = async (rotulo) => {
    const abierto = () =>
      js(`
        const f = filtro(${JSON.stringify(rotulo)});

        return !!(f && f.querySelector(".Select-menu-outer"));
      `);

    for (let i = 0; i < 3; i++) {
      if (await abierto()) return true;

      if (!(await clicReal(`mandoDe(${JSON.stringify(rotulo)})`))) return false;

      await espera(1400);
    }

    return abierto();
  };

  /** Abrir un desplegable, escribir dentro si tiene buscador y elegir. */
  const eligeEn = async (rotulo, texto, busca = texto, cual = 0) => {
    if (!(await abreDesplegable(rotulo))) {
      throw new Error(`No encuentro el desplegable «${rotulo}».`);
    }

    /*
    | Escribir sólo donde hay dónde.
    |
    | El de temporada no tiene buscador, y meterle texto por CDP no llega a
    | ningún sitio: se abre la lista entera y se elige por el nombre. El de
    | competiciones y el de equipos sí lo tienen, y ahí hace falta, porque la
    | lista sin filtrar trae media Europa.
    */
    const escribible = await js(`
      const f = filtro(${JSON.stringify(rotulo)});

      const i = f ? f.querySelector("input") : null;

      /*
      | Sin mirar si se ve: **el buscador mide cero por cero**.
      |
      | react-select le da al campo el ancho de lo que lleva escrito, y vacío
      | eso son cero píxeles. Descartarlo por invisible dejaba sin escribir
      | todos los equipos menos el primero de cada lote.
      */
      if (!i) return false;

      i.focus();

      return true;
    `);

    /*
    | Vacía el buscador: seleccionar todo y borrar, PERO SÓLO SI TIENE TEXTO.
    |
    | Con el campo vacío, la tecla de borrar de react-select se lleva la
    | última ficha puesta: probado el 28/09/2026, siete equipos «elegidos» y
    | en el filtro sólo quedaba el último.
    */
    const vacia = async () => {
      const escrito = await js(`
        const f = filtro(${JSON.stringify(rotulo)});

        const i = f ? f.querySelector("input") : null;

        return i ? (i.value || "").length : 0;
      `);

      if (!escrito) return;

      /* Sólo «seleccionar todo»: lo que se escriba después lo sustituye. Nada
         de la tecla de borrar, que en este desplegable se lleva fichas. */
      for (const [key, code, vk, mod] of [["a", "KeyA", 65, 2]]) {
        for (const type of ["rawKeyDown", "keyUp"]) {
          await nav.manda("Input.dispatchKeyEvent", {
            type,
            windowsVirtualKeyCode: vk,
            key,
            code,
            modifiers: mod,
          });
        }
      }

      await espera(300);
    };

    /* ¿Ha salido ya la opción? Se mira, no se da por hecho. */
    const hayOpcion = () =>
      js(`return !!opcion(${JSON.stringify(rotulo)}, ${JSON.stringify(busca)}, ${cual});`);

    /*
    | ESPERAR A LA OPCIÓN, NO UN TIEMPO FIJO (28/09/2026).
    |
    | Cada lote perdía dos equipos distintos en cada pasada. No se borraban:
    | no llegaban a entrar. Se escribía el nombre, se esperaban 1,8 segundos
    | fijos y se buscaba la opción; si la búsqueda de Wyscout —que va al
    | servidor— no había contestado aún, no estaba y el equipo se daba por
    | perdido. Y el segundo intento escribía EL MISMO texto: el campo no
    | cambiaba, react-select no volvía a buscar y fallaba igual. Ahora se
    | espera a que la opción aparezca (hasta 8 s) y, si no aparece, se vacía el
    | campo y se vuelve a escribir, que es lo que obliga a buscar de nuevo.
    */
    if (texto && escribible) {
      for (let vuelta = 0; vuelta < 2; vuelta++) {
        await vacia();

        /* En la segunda vuelta se escribe en dos veces: el campo cambia y
           react-select vuelve a buscar, sin haber borrado nada. */
        if (vuelta > 0 && texto.length > 1) {
          await nav.manda("Input.insertText", { text: texto.slice(0, -1) });

          await espera(600);

          await nav.manda("Input.insertText", { text: texto.slice(-1) });
        } else {
          await nav.manda("Input.insertText", { text: texto });
        }

        let esta = false;

        for (let i = 0; i < 16 && !esta; i++) {
          await espera(500);

          esta = await hayOpcion();
        }

        if (esta) break;
      }
    } else if (!texto) {
      await espera(1800);
    }

    const eleccion = await js(`
      const todas = opciones(${JSON.stringify(rotulo)}, ${JSON.stringify(busca)});

      const e = todas[${cual}];

      const vistas = todas.map((x) => x.textContent.trim());

      if (!e) return { puesto: null, vistas };

      const puesto = e.textContent.trim();

      pulsa(e);

      return { puesto, vistas };
    `);

    const elegido = eleccion?.puesto ?? null;

    /* Con varias candidatas se apunta cuáles había y cuál se cogió: es lo
       que explica un equipo que «entra» y no trae jugadores. */
    if (texto && (eleccion?.vistas?.length ?? 0) > 1) {
      console.log(`\n    («${busca}» en «${rotulo}»: ${eleccion.vistas.join(" · ")} → ${elegido ?? "ninguna"})`);
    }

    if (!elegido && texto) {
      /* La prueba de lo que había, para el registro: sin esto, «SIN Huesca»
         no dice si la opción no salió o salió con otro nombre. */
      const vistas = await js(`
        const f = filtro(${JSON.stringify(rotulo)});

        return f ? [...f.querySelectorAll(".Select-option, .Select-noresults")].slice(0, 6).map((x) => x.textContent.trim()) : [];
      `);

      console.log(`\n    (no sale «${busca}» en «${rotulo}»; se ve: ${vistas.join(" · ") || "nada"})`);
    }

    return elegido;
  };

  /*
  | Y esperar a que el buscador esté pintado, no a que exista el marco.
  |
  | El `<iframe>` aparece en cuanto se pulsa la aplicación, pero dentro no hay
  | todavía ni un filtro: el primer clic caía en el vacío y el proceso se
  | rendía diciendo que no encontraba el desplegable de competiciones.
  */
  let pintado = false;

  for (let i = 0; i < 60 && !pintado; i++) {
    pintado = await js(`
      const m = mandoDe("Competiciones");

      return !!m && m.getBoundingClientRect().width > 2 && !!filtro("Periodo");
    `);

    if (!pintado) await espera(1000);
  }

  if (!pintado) throw new Error("El buscador se ha abierto pero no pinta los filtros.");

  return { js, clicReal, eligeEn, puestosEn: (rotulo) => js(`return puestosEn(${JSON.stringify(rotulo)});`) };
}

/**
 * Deja el buscador con competición, temporada, MOSTRAR = ALL y el filtro de
 * equipo puestos. Se hace entero en cada pasada: la aplicación no guarda nada
 * de esto de una sesión a otra.
 */
async function preparaBuscador(buscador) {
  const puesto = await buscador.js(`
    return {
      competicion: (filtro("Competiciones") || {}).innerText || "",
      periodo: (filtro("Periodo") || {}).innerText || "",
      mostrar: (document.querySelector(".selectPair---XRga .Select-value") || {}).innerText || "",
      equipo: !!filtro("Equipo actual"),
    };
  `);

  if (!puesto.competicion.includes(COMPETICION)) {
    if (!(await buscador.eligeEn("Competiciones", COMPETICION))) {
      throw new Error(`No sale «${COMPETICION}» en las competiciones.`);
    }

    await espera(3500);
  }

  if (!puesto.periodo.includes(TEMPORADA)) {
    if (!(await buscador.eligeEn("Periodo", "", TEMPORADA))) {
      throw new Error(`No sale la temporada ${TEMPORADA}.`);
    }

    await espera(3500);
  }

  /*
  | MOSTRAR = ALL no es una opción más del desplegable: es un layout guardado
  | de la cuenta y vive en la columna de «Personalizado», que se pinta aparte
  | y no responde a la búsqueda. Sin esto bajan doce columnas en vez de 115.
  */
  if (!/ALL/i.test(puesto.mostrar)) {
    await buscador.clicReal(`document.querySelector(".selectPair---XRga .Select-control")`);

    await espera(1500);

    const all = await buscador.js(`
      const e = [...document.querySelectorAll(".level-option--2Zwuo")]
        .find((x) => norma(x.textContent) === "all");

      return pulsa(e);
    `);

    /*
    | Sin ALL (la cuenta del juvenil, 05/10/2026): el buscador tiene el mismo
    | selector de columnas que la tabla de equipos —el botón junto a
    | «Mostrar»— con «Todas las columnas». Se marca y se aplica.
    */
    if (!all) {
      await buscador.js(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return true;`);

      await espera(600);

      const abierto = await buscador.js(`
        const b = document.querySelector('[class*="custom-btn"]');
        if (!b) return false;
        ["mousedown", "mouseup", "click"].forEach((t) => b.dispatchEvent(new MouseEvent(t, { bubbles: true })));
        return true;
      `);

      await espera(2000);

      const aplicado =
        abierto &&
        (await buscador.js(`
          if (!(document.body.innerText || "").includes("Elegir las columnas")) return false;
          const rotulo = [...document.querySelectorAll("label, span, div")]
            .filter((x) => x.childElementCount < 4 && (x.textContent || "").trim() === "Todas las columnas")
            .pop();
          const casilla = rotulo && (rotulo.querySelector("input") || rotulo.parentElement.querySelector("input"));
          if (casilla && !casilla.checked) (rotulo.tagName === "LABEL" ? rotulo : casilla).click();
          const boton = [...document.querySelectorAll("button, a, div, span")]
            .filter((x) => (x.textContent || "").trim().toUpperCase() === "APLICAR" && x.getClientRects().length)
            .pop();
          if (!boton) return false;
          boton.click();
          return true;
        `));

      await espera(2500);

      const cerrado = await buscador.js(`return !(document.body.innerText || "").includes("Elegir las columnas");`);

      if (!aplicado || !cerrado) throw new Error("No encuentro el layout ALL ni se pueden marcar todas las columnas en MOSTRAR.");
    }

    await espera(6000);
  }

  if (!puesto.equipo) {
    /* Éste sí es un botón normal y atiende a un `click` de los de mentira. */
    await buscador.js(`
      const b = document.querySelector("button.set-filters--DwwaD");

      if (b) b.click();

      return !!b;
    `);

    await espera(2000);

    const marcado = await buscador.js(`
      const s = [...document.querySelectorAll(".checkbox--EAGK- span")]
        .find((x) => norma(x.textContent) === norma("Equipo actual"));

      const i = s && s.closest("label") ? s.closest("label").querySelector("input") : null;

      if (!i) return false;

      if (!i.checked) i.click();

      const c = document.querySelector("button.confirm--2nggi");

      if (c) c.click();

      return true;
    `);

    if (!marcado) throw new Error("No encuentro el filtro «Equipo actual».");

    await espera(4000);
  }

  return buscador.js(`
    return {
      competicion: ((filtro("Competiciones") || {}).innerText || "").trim(),
      periodo: ((filtro("Periodo") || {}).innerText || "").trim(),
      mostrar: (document.querySelector(".selectPair---XRga .Select-value") || {}).innerText || "",
      resultados: cuenta(),
    };
  `);
}

/** Un lote de equipos: se ponen en el filtro, se exporta y se guarda. */
async function bajaLote(nav, buscador, equipos, numero, { cual = 0 } = {}) {
  /* Fuera los del lote anterior. */
  await buscador.clicReal(`
    (() => {
      const f = filtro("Equipo actual");

      if (!f) return null;

      return f.querySelector(".Select-clear-zone") || f.querySelector(".Select-clear");
    })()
  `);

  await espera(2500);

  const puestos = [];

  /* Los que no han llegado a entrar: salen en el resumen, no se callan. */
  const faltan = [];

  /* Con qué nombre salió cada uno en la lista: es el que lleva su ficha. */
  const elegidoDe = new Map();

  for (const equipo of equipos) {
    /*
    | Se escribe el nombre entero y manda la coincidencia exacta.
    |
    | Wyscout tiene «Alcorcón» y «Alcorcón II» —el filial, que no es de esta
    | liga—, así que sólo si no hay coincidencia exacta se coge la más corta de
    | las que contienen el nombre.
    */
    /*
    | Y con un segundo intento, porque un equipo que no entra son sus
    | veinticinco jugadores fuera de la pantalla, sin que nadie se entere.
    */
    let elegido = null;

    for (let i = 0; i < 2 && !elegido; i++) {
      try {
        elegido = await buscador.eligeEn("Equipo actual", equipo, equipo, cual);
      } catch {
        /* se reintenta */
      }

      if (!elegido) await espera(1500);
    }

    if (elegido) {
      puestos.push(elegido);
      elegidoDe.set(equipo, elegido);
    } else {
      faltan.push(equipo);
    }

    await espera(1500);
  }

  /*
  | Y se comprueba en el propio filtro, que es lo que manda en la exportación.
  |
  | Que un clic diga que ha elegido no garantiza que la ficha siga ahí: se
  | leen las fichas puestas y lo que falte se vuelve a pedir una vez.
  */
  const normaliza = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

  /*
  | OJO: sólo se vuelven a pedir los que NUNCA se eligieron. Volver a pulsar
  | uno que ya está puesto lo QUITA (react-select alterna): la primera versión
  | de esta comprobación leía mal las fichas, creía que faltaban todos, los
  | volvía a pulsar y el lote bajó con un equipo de siete.
  */
  const nuncaElegidos = () => equipos.filter((equipo) => !elegidoDe.get(equipo));

  const puestasAhora = async () => (await buscador.puestosEn("Equipo actual")).map(normaliza);

  const noEstan = async () => {
    const puestas = await puestasAhora();

    /* Si no se sabe leer las fichas, no se inventa nada: manda lo elegido. */
    if (puestas.length === 0) return nuncaElegidos();

    return equipos.filter((equipo) => {
      const suyo = elegidoDe.get(equipo);

      return !suyo || !puestas.some((p) => p === normaliza(suyo) || p.includes(normaliza(suyo)));
    });
  };

  for (const equipo of nuncaElegidos()) {
    let otra = null;

    try {
      otra = await buscador.eligeEn("Equipo actual", equipo, equipo, cual);
    } catch {
      /* se queda en «faltan» */
    }

    if (otra) {
      if (!puestos.includes(otra)) puestos.push(otra);

      elegidoDe.set(equipo, otra);

      await espera(1500);
    }
  }

  faltan.splice(0, faltan.length, ...(await noEstan()));

  if (puestos.length === 0) {
    return { numero, estado: "ningún equipo del lote está en el buscador" };
  }

  const jugadores = await buscador.js(`return cuenta();`);

  if (bandera("parar")) {
    const fichas = await buscador.js(`
      const f = filtro("Equipo actual");

      if (!f) return "sin filtro";

      const clases = [...new Set([...f.querySelectorAll("*")].map((x) => String(x.className || "")).filter(Boolean))].slice(0, 25);

      return JSON.stringify({ texto: f.innerText.replace(/\\s+/g, " ").slice(0, 400), clases });
    `);

    return {
      numero,
      estado: `parado con ${puestos.length} equipos y ${jugadores} jugadores · fichas: ${fichas}`,
    };
  }

  /*
  | Aquí el fichero **no se reconoce por el nombre** sino por la hora.
  |
  | Todos los lotes bajan como «Search results.xlsx», y si de una pasada
  | anterior quedó uno con ese nombre, el nuevo llega como «Search results
  | (1).xlsx» —o no llega, si el anterior sigue ahí—. Mirar cuál es nuevo por
  | el nombre dejaba el lote esperando un minuto a un fichero que ya estaba en
  | la carpeta. Se apunta la hora y se coge el .xlsx recién escrito.
  */
  /*
  | Y la carpeta de descargas, vacía (09/10/2026). Un Excel del lote anterior
  | que tardó más de la cuenta llegaba ahora, era «nuevo» por la hora y se
  | guardaba con el número de este lote. La carpeta es sólo de este perfil.
  */
  for (const viejo of fs.readdirSync(DESCARGAS).filter((f) => /\.xlsx$/i.test(f))) {
    try {
      fs.unlinkSync(path.join(DESCARGAS, viejo));
    } catch {
      /* si Chrome aún lo tiene abierto, la hora lo descarta */
    }
  }

  const desde = Date.now();

  /*
  | El botón de exportar **cambia de etiqueta** según lo que haya en la tabla.
  |
  | Con menos de quinientas filas es un `<a>` que se baja el fichero de una;
  | por encima es un `<button>` que primero saca el aviso del recorte. Buscar
  | sólo el `<button>` dejaba el lote sin exportar justo cuando todo iba bien.
  */
  const pulsado = await buscador.js(`
    const b = document.querySelector(".export--O6aG-") ||
      [...document.querySelectorAll("a,button")]
        .find((e) => norma(e.textContent).includes(norma("Exportar en Excel")));

    if (b) b.click();

    return !!b;
  `);

  if (!pulsado) return { numero, estado: "no encuentro el botón de exportar" };

  await espera(3000);

  /*
  | Si se han colado más de 500 filas Wyscout avisa y **recorta** sin más. Se
  | acepta —mejor eso que nada— pero se devuelve el aviso, que es lo que dice
  | que hay que bajar el tamaño del lote.
  */
  const recortado = await buscador.js(`
    const p = document.querySelector(".popup--385sw");

    if (!p || !/500/.test(p.innerText || "")) return false;

    return pulsa(p.querySelector(".download--3Glx1"));
  `);

  let fichero = null;

  for (let i = 0; i < 60 && !fichero; i++) {
    await espera(1000);

    fichero = fs
      .readdirSync(DESCARGAS)
      .filter((f) => f.endsWith(".xlsx"))
      .find((f) => fs.statSync(path.join(DESCARGAS, f)).mtimeMs >= desde);
  }

  if (!fichero) return { numero, estado: "no ha bajado el fichero" };

  const origen = path.join(DESCARGAS, fichero);

  const kb = Math.round(fs.statSync(origen).size / 1024);

  /*
  | Las columnas, como en los equipos (05/10/2026): con todas son 115. Si la
  | selección de columnas falla en silencio salen las doce de «General», y
  | ese fichero no puede sustituir al bueno de la semana pasada.
  */
  const columnas = columnasDe(origen);

  if (columnas === null || columnas < MIN_COLUMNAS) {
    fs.unlinkSync(origen);

    throw new Error(
      columnas === null
        ? "el Excel de jugadores no se puede leer: se deja el de antes"
        : `el Excel de jugadores sólo trae ${columnas} columnas (con todas son 115): se deja el de antes`,
    );
  }

  /*
  | LO QUE MANDA ES EL FICHERO, NO EL FILTRO (09/10/2026).
  |
  | El Águilas salía con su ficha en «Equipo actual» y ni un jugador suyo en
  | el Excel, semana tras semana, con «✓» en el registro. Se cuentan las filas
  | de cada equipo: el que no trae ninguna se da por perdido, y si no trae
  | ninguno, el fichero no sustituye a nada.
  */
  const porEquipo = equiposDe(origen);

  const sinFilas = porEquipo ? equipos.filter((equipo) => !porEquipo.get(normalizaEquipo(equipo))) : [];

  if (porEquipo && sinFilas.length === equipos.length) {
    fs.unlinkSync(origen);

    return { numero, estado: `el Excel no trae jugadores de ${equipos.join(", ")}`, faltan: [...equipos] };
  }

  /* Leído el fichero, él decide quién falta (también al revés: una ficha mal
     leída no da por perdido a un equipo que sí trae sus jugadores). */
  if (porEquipo) faltan.splice(0, faltan.length, ...sinFilas);

  const filas = porEquipo ? [...porEquipo.values()].reduce((a, b) => a + b, 0) : jugadores;

  /* Si faltan equipos, el lote no sustituye al de la semana pasada: va
     aparte como «(parcial)» y el lector coge de él sólo lo más nuevo. */
  const destino = path.join(
    DESTINO,
    faltan.length > 0 ? `Player Stats ${numero} (parcial).xlsx` : `Player Stats ${numero}.xlsx`,
  );

  fs.copyFileSync(origen, destino);
  fs.unlinkSync(origen);

  return {
    numero,
    estado: "ok",
    fichero: path.basename(destino),
    kb,
    jugadores: filas,
    equipos: puestos,
    faltan,
    recortado,
  };
}

/** Todos los jugadores de la categoría, por lotes de equipos. */
async function bajaJugadores(nav, equipos, { suelto = false } = {}) {
  /*
  | Con `--equipo=` o `--desde=` la lista no es el grupo entero (09/10/2026):
  | su lote se llamaba «Player Stats 1» y PISABA el bueno de siete equipos, y
  | la limpieza del final borraba los demás. Suelto, numera desde el 101 y no
  | limpia nada; la próxima pasada entera ya lo quita.
  */
  const base = suelto ? 100 : 0;

  console.log(`\n  JUGADORES · ${COMPETICION} · ${TEMPORADA}\n`);

  let buscador = await abreBuscador(nav);

  const puesto = await preparaBuscador(buscador);

  const enUnaLinea = (t) => (t || "").replace(/\s+/g, " ").trim();

  console.log(
    `  ${enUnaLinea(puesto.competicion)} · ${enUnaLinea(puesto.periodo)} · MOSTRAR ${enUnaLinea(puesto.mostrar)}`,
  );

  console.log(`  ${puesto.resultados} jugadores en la categoría\n`);

  /*
  | Ya NO se borran al empezar (28/09/2026): con la pestaña colgada fallaron
  | los tres lotes y la carpeta se quedó sin ningún fichero de jugadores. Cada
  | lote que baja bien sustituye a su «Player Stats N»; los que fallan dejan
  | el de la semana pasada, que el lector sólo usa si no hay nada más nuevo de
  | ese jugador. Al final, si todo ha ido bien, se quitan los números que ya
  | no existen (de cuando había más lotes).
  */

  const lotes = [];

  for (let i = 0; i < equipos.length; i += LOTE) {
    lotes.push(equipos.slice(i, i + LOTE));
  }

  const resultados = [];

  for (const [i, lote] of lotes.entries()) {
    process.stdout.write(
      `  lote ${i + 1}/${lotes.length}  ${lote.join(", ").slice(0, 44).padEnd(46)}`,
    );

    let resultado = null;

    for (let intento = 0; intento < 2 && !resultado?.fichero; intento++) {
      try {
        resultado = await bajaLote(nav, buscador, lote, base + i + 1);
      } catch (error) {
        resultado = { numero: base + i + 1, estado: error.message };

        /*
        | Si la pestaña se ha colgado, se cambia por otra y se vuelve a abrir
        | el buscador con sus filtros: sin esto, el segundo intento y los lotes
        | siguientes se estrellaban contra la misma pestaña muerta.
        */
        if (atasco(error)) {
          try {
            await recupera(nav);
            await vaAlGrupo(nav).catch(() => {});
            buscador = await abreBuscador(nav);
            await preparaBuscador(buscador);
          } catch (otro) {
            resultado = { numero: base + i + 1, estado: `${error.message} (y no se ha podido reabrir: ${otro.message})` };
          }
        }
      }

      if (bandera("parar")) break;
    }

    resultados.push(resultado);

    const perdidos = resultado.faltan?.length ? ` · SIN ${resultado.faltan.join(", ")}` : "";

    console.log(
      resultado.estado !== "ok"
        ? `✗ ${resultado.estado}`
        : `${resultado.recortado || perdidos ? "⚠" : "✓"} ${resultado.fichero} · ${resultado.jugadores} jugadores · ${resultado.kb} KB` +
            (resultado.recortado ? " · RECORTADO a 500: baja --lote=" : "") +
            perdidos,
    );

    if (bandera("parar")) break;
  }

  /*
  | EL RESCATE (09/10/2026): cada equipo que se ha quedado fuera de su lote
  | baja solo, en un lote suyo, probando las otras opciones del desplegable
  | con su nombre (la primera es la que ya falló). Va con número detrás de
  | los lotes normales; si sale, el lote del que faltaba ya está completo.
  */
  const rescatados = [];

  /* Sólo los que faltan de un lote que sí bajó: un lote entero fallido ya se
     ha intentado dos veces, y suele ser la pestaña colgada. */
  const ausentes = [...new Set(resultados.flatMap((r) => (r?.estado === "ok" ? r.faltan ?? [] : [])))];

  if (!bandera("parar") && ausentes.length) {
    console.log(`\n  rescate de ${ausentes.length}: ${ausentes.join(", ")}`);

    for (const equipo of ausentes) {
      const numero = base + lotes.length + rescatados.length + 1;

      process.stdout.write(`  solo      ${equipo.slice(0, 44).padEnd(46)}`);

      let resultado = null;

      for (let cual = 0; cual < 3 && !resultado?.fichero; cual++) {
        try {
          const prueba = await bajaLote(nav, buscador, [equipo], numero, { cual });

          if (prueba.estado === "ok" && !prueba.faltan?.length) resultado = prueba;
          else resultado = resultado ?? prueba;
        } catch (error) {
          resultado = { numero, estado: error.message };

          if (atasco(error)) break;
        }
      }

      if (resultado?.fichero && !resultado.faltan?.length) {
        rescatados.push(equipo);

        console.log(`✓ ${resultado.fichero} · ${resultado.jugadores} jugadores`);
      } else {
        console.log(`✗ ${resultado?.estado === "ok" ? "sigue sin jugadores" : resultado?.estado ?? "no ha bajado"}`);
      }
    }
  }

  /* Un lote «(parcial)» cuyos ausentes se han rescatado ya está entero: pasa
     a ser el «Player Stats N» de siempre y sustituye al de la semana pasada. */
  for (const r of resultados) {
    if (r?.estado !== "ok" || !r.faltan?.length || !r.faltan.every((e) => rescatados.includes(e))) continue;

    const entero = `Player Stats ${r.numero}.xlsx`;

    fs.renameSync(path.join(DESTINO, r.fichero), path.join(DESTINO, entero));

    r.fichero = entero;
    r.faltan = [];
  }

  const sinBajar = ausentes.filter((e) => !rescatados.includes(e));

  /* Con todo bien, fuera los «Player Stats N» de números que ya no se usan
     (de una semana con más lotes o más rescates) y los «(parcial)» que han
     quedado viejos: esos sí son viejos seguro. */
  if (!suelto && !bandera("parar") && resultados.every((r) => r?.estado === "ok") && !sinBajar.length) {
    for (const viejo of fs.readdirSync(DESTINO)) {
      const numero = Number(viejo.match(/^Player Stats (\d+)\.xlsx$/i)?.[1] ?? 0);

      if (numero > lotes.length + rescatados.length || /^Player Stats \d+ \(parcial\)\.xlsx$/i.test(viejo)) {
        fs.unlinkSync(path.join(DESTINO, viejo));
      }
    }
  }

  return { resultados, sinBajar };
}

/* ------------------------------------------------------------------ */
/*  EL PROGRAMA                                                        */
/* ------------------------------------------------------------------ */

async function principal() {
  console.log("\n  RMCF · informes de Wyscout de toda la liga\n");
  console.log(`  perfil   ${PERFIL}`);
  console.log(`  destino  ${DESTINO}`);
  console.log(`  grupo    ${GRUPO}\n`);

  fs.mkdirSync(DESTINO, { recursive: true });

  /* El Chrome lo comparte con Hudl (el análisis del partido): por turnos.
     Si a la hora y media sigue ocupado, NO se entra (09/10/2026): antes se
     seguía igual, `conecta()` cerraba las pestañas del otro y los dos
     escribían a la vez. Sale con el 7, el de Chrome ocupado o colgado. */
  if (!(await esperaTurno("Wyscout (descarga de la liga)"))) {
    console.log("\n  CHROME OCUPADO: el análisis del partido lleva hora y media con él; se deja para luego.\n");

    process.exitCode = 7;

    return;
  }

  let chrome = abreChrome();

  const nav = await conecta();

  /*
  | La sesión de la semana pasada, puesta a mano antes de mirar nada.
  |
  | Va aquí y no después de comprobar el login porque la comprobación tiene que
  | ver ya las cookies puestas: si no, diría que hay que entrar cuando no hace
  | falta. Si las cookies han caducado por su cuenta, no estorban.
  */
  /*
  | `--cambiar-cuenta` (04/10/2026): para entrar con otra cuenta de Wyscout.
  |
  | La sesión guardada se vuelve a meter en cada arranque, así que abrir la
  | ventana y cerrar la sesión a mano no bastaba: la siguiente pasada volvía a
  | entrar con la de antes (la del juvenil, sin el layout ALL). Aquí se borran
  | las cookies de este perfil —es sólo de Wyscout— y la copia guardada se
  | aparta, y se espera a que alguien entre con la buena.
  */
  if (bandera("cambiar-cuenta")) {
    try {
      if (fs.existsSync(FICHERO_SESION)) {
        fs.renameSync(FICHERO_SESION, FICHERO_SESION.replace(/\.json$/, `-anterior-${new Date().toISOString().slice(0, 10)}.json`));
      }
    } catch {
      /* si no se puede apartar, se pisa al acabar */
    }

    await nav.manda("Network.clearBrowserCookies").catch(() => {});

    console.log("  Sesión anterior borrada: entra con la cuenta del Castilla.\n");

    try {
      await nav.manda("Page.navigate", { url: "https://wyscout.hudl.com/app/" });

      await espera(4000);
    } catch {
      /* esperaLogin lo ve igual */
    }
  } else if (await reponeLasCookies(nav)) {
    console.log("  sesión repuesta de la última vez\n");

    /* Con las cookies puestas hay que recargar: la página se abrió sin ellas. */
    try {
      await nav.manda("Page.navigate", { url: "https://wyscout.hudl.com/app/" });

      await espera(4000);
    } catch {
      /* si no recarga, `esperaLogin` lo verá y pedirá entrar */
    }
  }

  /* Sólo se guarda la sesión si se ha entrado: una pasada que no entra la
     machacaba con cookies a medias (04/10/2026). */
  let dentro = false;

  try {
    if (!(await esperaLogin(nav))) {
      console.log("  No se ha iniciado sesión. Nada que hacer.\n");

      /* Un código propio: quien lo lanza sin mirar necesita distinguir «hay
         que volver a entrar en Wyscout» de «se ha roto algo». */
      process.exitCode = 2;

      return;
    }

    dentro = true;

    /*
    | Al cambiar de cuenta, la sesión nueva se guarda en cuanto se entra, no al
    | final: si la descarga se rompe después, la cuenta buena ya queda puesta.
    | Con `--solo-entrar` se para aquí: lo demás lo hace el botón de Ajustes.
    */
    if (bandera("cambiar-cuenta")) {
      /* Que termine de cargar (la lista de países) antes de guardar nada. */
      await nav.esperaA("Albania|PAÍSES|Platform", 40).catch(() => {});

      await espera(3000);

      const quien = await nav
        .js(`
          const t = (document.body || {}).innerText || "";
          const m = t.match(/\\n\\s*([^\\n]{2,40})\\n\\s*Real Madrid CF\\n\\s*([^\\n]{2,40})\\n/);
          return m ? m[1].trim() + " · " + m[2].trim() : "";
        `)
        .catch(() => "");

      console.log(`  CUENTA: ${quien || "(no se lee el nombre)"}\n`);

      await guardaLasCookies(nav);

      console.log("  Sesión nueva guardada.\n");

      if (bandera("solo-entrar")) return;
    }

    /*
    | Con `--solo-jugadores` la lista sale de la carpeta, no de la aplicación.
    |
    | Los nombres que hacen falta son los mismos que ya están escritos en los
    | «Team Stats <equipo>.xlsx» de la semana pasada, y recorrer país,
    | competición y grupo para volver a leerlos son tres minutos de clics y
    | tres sitios más donde fallar.
    */
    const deLaCarpeta = fs
      .readdirSync(DESTINO)
      .map((f) => /^Team Stats (.+)\.xlsx$/i.exec(f)?.[1])
      /* «Teruel (1)» es una descarga repetida, no un equipo más. */
      .filter((e) => e && !/ \(\d+\)$/.test(e));

    const equipos =
      bandera("solo-jugadores") && deLaCarpeta.length >= 10
        ? [...new Set(deLaCarpeta)].sort()
        : await vaAlGrupo(nav);

    console.log(`  ${equipos.length} equipos en ${GRUPO}:`);
    console.log(`  ${equipos.join(" · ")}\n`);

    /*
    | `--equipo=` admite varios separados por coma, y `--desde=` retoma donde
    | se quedó: si la sesión se cae por la mitad no hay que volver a bajar los
    | doce que ya estaban.
    */
    const pedidos = argumento("equipo");

    const desde = argumento("desde");

    let lista = equipos;

    if (pedidos) {
      const busca = pedidos.split(",").map((p) => p.trim().toLowerCase());

      lista = equipos.filter((e) =>
        busca.some((b) => e.toLowerCase().includes(b)),
      );
    } else if (desde) {
      const arranque = equipos.findIndex((e) =>
        e.toLowerCase().includes(desde.toLowerCase()),
      );

      if (arranque >= 0) lista = equipos.slice(arranque);
    }

    const resultados = [];

    /*
    | Chrome colgado (05/10/2026). A las 6:07 la pestaña dejó de contestar en
    | los 20 equipos y la pasada siguió UNA HORA para bajar cero: cada equipo
    | gastaba sus dos intentos esperando a una pestaña muerta. Ahora, con dos
    | equipos seguidos sin respuesta, se reinicia Chrome entero una vez (con la
    | misma sesión); si vuelve a pasar, se corta con el código 7 y un motivo
    | que se entiende en Ajustes.
    */
    let colgadosSeguidos = 0;
    let reiniciado = false;
    let colgado = false;

    for (const equipo of bandera("solo-jugadores") ? [] : lista) {
      if (colgado) break;

      if (colgadosSeguidos >= 2) {
        if (reiniciado) {
          console.log("\n  CHROME NO RESPONDE: se corta la descarga (el ordenador del club, bloqueado o sin red).\n");

          colgado = true;

          break;
        }

        reiniciado = true;
        colgadosSeguidos = 0;

        console.log("\n    (Chrome no contesta: se reinicia una vez, con la misma sesión)");

        try {
          nav.cierra();
        } catch {
          /* ya estaba roto */
        }

        try {
          chrome.kill();
        } catch {
          /* ya no estaba */
        }

        await espera(4000);

        chrome = abreChrome();

        Object.assign(nav, await conecta());

        if (await reponeLasCookies(nav)) {
          await nav.manda("Page.navigate", { url: "https://wyscout.hudl.com/app/" }).catch(() => {});

          await espera(4000);
        }

        if (!(await esperaLogin(nav))) {
          process.exitCode = 2;

          return;
        }

        await vaAlGrupo(nav).catch(() => {});
      }

      process.stdout.write(`  ${equipo.padEnd(26)}`);

      /*
      | Dos intentos por equipo, y entre uno y otro se rehace el camino.
      |
      | Lo que falla no suele ser el script sino la aplicación: una pestaña que
      | se atasca pintando quinientas celdas de vídeo, un clic que se pierde, un
      | export que no arranca. Reintentando una vez se recuperan casi todos, y
      | lo que no, sale en el resumen con su motivo.
      */
      let resultado = bandera("parar") ? await bajaEquipo(nav, equipo) : null;

      for (let intento = 0; intento < 2 && !resultado?.fichero && !bandera("parar"); intento++) {
        /*
        | TODO dentro del try, también el camino de vuelta del reintento: fuera,
        | una pestaña colgada tumbaba la descarga entera en vez de este equipo.
        */
        try {
          if (intento > 0) {
            await nav.manda("Page.navigate", { url: "https://wyscout.hudl.com/app/" });

            await espera(4000);

            await vaAlGrupo(nav);
          }

          resultado = await bajaEquipo(nav, equipo);
        } catch (error) {
          resultado = { equipo, estado: error.message };

          if (atasco(error)) await recupera(nav).catch(() => {});
        }
      }

      resultados.push(resultado);

      colgadosSeguidos = resultado && resultado.estado !== "ok" && atasco(resultado.estado) ? colgadosSeguidos + 1 : 0;

      console.log(
        resultado.estado !== "ok"
          ? `✗ ${resultado.estado}`
          : resultado.sospechoso
            ? `⚠ ${resultado.fichero} · sólo ${resultado.kb} KB, míralo`
            : `✓ ${resultado.fichero} · ${resultado.kb} KB`,
      );

      /*
      | Y de vuelta a la rejilla para el siguiente.
      |
      | Con la flecha de la propia aplicación, no recargando `/app/`: la
      | recarga vuelve a la lista de países y hay que rehacer los tres clics,
      | que es donde se perdía el proceso. Si aun así no aparece la rejilla, se
      | rehace el camino entero, que siempre funciona aunque tarde.
      */
      /* Con `--parar` la gracia es quedarse donde está, para poder mirarlo. */
      if (bandera("parar")) break;

      /* Si el camino de vuelta se cuelga, pestaña nueva y a por el siguiente:
         el reintento del próximo equipo rehace el camino desde cero. */
      try {
        if (!(await volverAlGrupo(nav))) await vaAlGrupo(nav);
      } catch (error) {
        if (atasco(error)) await recupera(nav).catch(() => {});

        try {
          await vaAlGrupo(nav);
        } catch {
          /* lo intenta otra vez el siguiente equipo */
        }
      }
    }

    if (!bandera("solo-jugadores")) {
      const bien = resultados.filter((r) => r.estado === "ok").length;

      console.log(`\n  ${bien} de ${lista.length} bajados a public/data/wys\n`);

      /* El consejo del diseño sólo cuando no es un cuelgue: el 05/10 a las
         6:07 culpaba a Wyscout de una pestaña colgada. */
      if (bien < lista.length && !colgado && !resultados.some((r) => atasco(r?.estado))) {
        console.log("  Los que fallan casi siempre son un cambio de diseño de");
        console.log("  Wyscout: abre la ventana, mira dónde está el botón y");
        console.log("  ajusta el texto que busca este script.\n");
      }

      /*
      | Ninguno bajado NO es «bajado y publicado» (04/10/2026).
      |
      | Ese día la sesión era otra vez la del juvenil, sin el layout ALL: 0 de
      | 20, y el .cmd seguía, releía la carpeta de siempre, publicaba y Ajustes
      | decía «publicado». Ahora sale con su código y dice con qué cuenta está,
      | que es lo único que hay que cambiar.
      */
      /* Chrome colgado incluso tras reiniciarlo: su código, sin publicar nada. */
      if (colgado && bien === 0) {
        process.exitCode = 7;

        return;
      }

      if (bien === 0 && lista.length && !bandera("parar")) {
        const porLaCuenta = resultados.filter((r) => /layout ALL/i.test(r?.estado ?? "")).length;

        const quien = await nav
          .js(`
            const t = (document.body || {}).innerText || "";
            const m = t.match(/\\n\\s*([^\\n]{2,40})\\n\\s*Real Madrid CF\\n\\s*([^\\n]{2,40})\\n/);
            return m ? m[1].trim() + " · " + m[2].trim() : "";
          `)
          .catch(() => "");

        if (porLaCuenta >= Math.ceil(lista.length / 2)) {
          console.log(`  CUENTA: ${quien || "otra cuenta"} (sin el layout ALL)`);

          process.exitCode = 6;
        } else {
          process.exitCode = 1;
        }

        return;
      }
    }

    /*
    | Y la segunda mitad del recado: los jugadores de la categoría.
    |
    | Va después a propósito. La ficha de cada equipo y el buscador son dos
    | aplicaciones distintas dentro de la misma pestaña, y saltar de una a
    | otra cuesta clics: primero se recorren los veinte equipos y al final se
    | entra en el buscador una sola vez.
    */
    /*
    | Lo que no ha bajado, para el final (09/10/2026). Antes la pasada salía
    | con 0 —«publicado»— con 1 de 20 equipos o con los tres lotes de
    | jugadores fallidos, y la semana quedaba hecha. Ahora sale con el 8: se
    | publica lo que haya, pero la semana NO se da por hecha y Ajustes dice
    | qué falta.
    */
    const incompleto = [];

    if (!bandera("solo-jugadores")) {
      /* Por la lista, no por los resultados: tras un cuelgue los que quedaban
         ni siquiera tienen resultado. */
      const malos = lista.filter((e) => !resultados.some((r) => r?.equipo === e && r.estado === "ok"));

      if (malos.length) incompleto.push(`equipos sin bajar: ${malos.join(", ")}`);
    }

    if (!bandera("sin-jugadores")) {
      let jugadores = null;

      try {
        jugadores = await bajaJugadores(nav, lista, { suelto: lista.length !== equipos.length });
      } catch (error) {
        /* Colgada a mitad: pestaña nueva y otra vuelta, que son cientos de
           jugadores. */
        if (atasco(error)) {
          await recupera(nav).catch(() => {});

          try {
            jugadores = await bajaJugadores(nav, lista, { suelto: lista.length !== equipos.length });
          } catch (otro) {
            console.log(`\n  ✗ jugadores: ${otro.message}\n`);
          }
        } else {
          console.log(`\n  ✗ jugadores: ${error.message}\n`);
        }
      }

      if (!jugadores) {
        incompleto.push("los jugadores no han bajado");
      } else {
        const lotesMal = jugadores.resultados.filter((r) => r?.estado !== "ok").length;

        if (lotesMal) incompleto.push(`${lotesMal} lote(s) de jugadores sin bajar`);

        if (jugadores.sinBajar.length) incompleto.push(`sin jugadores de ${jugadores.sinBajar.join(", ")}`);
      }
    }

    if (incompleto.length && !bandera("parar") && !bandera("ver")) {
      console.log(`\n  INCOMPLETO: ${incompleto.join(" · ")}\n`);

      process.exitCode = 8;
    }
  } finally {
    if (!bandera("ver") && !bandera("parar")) {
      /*
      | Cerrar Chrome por las buenas, no a golpes.
      |
      | Con `chrome.kill()` el navegador se va sin escribir las cookies al
      | disco, y la sesión de Wyscout se perdía entre una semana y la
      | siguiente: aparecía la pantalla de entrada como si nunca se hubiera
      | entrado. `Browser.close` le deja guardar antes de irse.
      */
      /*
      | Las cookies, a un fichero nuestro, ANTES de cerrar.
      |
      | Chrome no las va a guardar: la cookie de Hudl es de sesión y la
      | preferencia que las salvaría está protegida y no se deja escribir (ver
      | `guardaLaSesionAlCerrar`). Si no se copian aquí, la semana que viene
      | hay que volver a entrar a mano y la tarea programada no puede.
      */
      if (dentro) await guardaLasCookies(nav);

      try {
        await nav.manda("Browser.close");

        await espera(2500);
      } catch {
        /* si ya se ha ido, mejor */
      }

      nav.cierra();

      chrome.kill();
    }
  }
}

principal().catch((error) => {
  console.error("\n  Se ha roto:", error.message, "\n");

  process.exit(1);
});
