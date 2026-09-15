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

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/* ------------------------------------------------------------------ */
/*  AJUSTES                                                            */
/* ------------------------------------------------------------------ */

const RAIZ = path.resolve(import.meta.dirname, "..");

const DESTINO = path.join(RAIZ, "public", "data", "wys");

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

  return spawn(
    CHROME,
    [
      `--remote-debugging-port=${PUERTO}`,
      `--user-data-dir=${PERFIL}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1600,1000",
      "https://wyscout.hudl.com/app/",
    ],
    { stdio: "ignore" },
  );
}

/** El hilo de mando con la pestaña. */
async function conecta() {
  let pestana = null;

  for (let i = 0; i < 80 && !pestana; i++) {
    await espera(500);

    try {
      const lista = await fetch(`http://127.0.0.1:${PUERTO}/json`).then((r) =>
        r.json(),
      );

      pestana = lista.find((x) => x.type === "page" && /wyscout|hudl/i.test(x.url));
    } catch {
      /* todavía no ha levantado */
    }
  }

  if (!pestana) throw new Error("Chrome no ha abierto el puerto de mando.");

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
      setTimeout(() => rej(new Error(`sin respuesta: ${metodo}`)), 30000);
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
    js(`return (document.body.innerText || "").replace(/\\s+/g, " ");`);

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
          .test((document.body.innerText || "").replace(/\\s+/g, " "));
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

const estaDentro = (nav) =>
  nav.js(`
    const hayLogin =
      document.querySelector("input[type=password]") !== null ||
      /identity\\.hudl\\.com|\\/login/i.test(location.href);

    return !hayLogin && /wyscout\\.hudl\\.com\\/app/.test(location.href);
  `);

async function esperaLogin(nav) {
  /* La primera comprobación, con la página todavía cargando, dice que no
     estamos dentro aunque lo estemos: se le da un momento a que pinte algo. */
  await nav.esperaA("Albania|Mikelats|Contraseña|Password|Log In", 20);

  if (await estaDentro(nav)) {
    console.log("  Sesión ya iniciada en este perfil.\n");

    return true;
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
    const t = (document.body.innerText || "").replace(/\\s+/g, " ");

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
  | `--parar` deja la ventana abierta en la tabla, sin exportar nada.
  |
  | Es la herramienta de mantenimiento: el día que Wyscout cambie un botón,
  | esto deja la pantalla exactamente donde hay que mirar.
  */
  if (bandera("parar")) return { equipo, estado: "parado en la tabla" };

  /* Por la hora y no por el nombre: un fichero a medias de una pasada
     anterior se queda en la carpeta y ya no parece nuevo nunca. */
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

  const opcion = (rotulo, texto) => {
    const dentro = rotulo ? filtro(rotulo) : document;

    if (!dentro) return null;

    const lista = [...dentro.querySelectorAll(".Select-option")];

    const q = norma(texto);

    return lista.find((x) => norma(x.textContent) === q) ||
      lista.filter((x) => norma(x.textContent).includes(q))
        .sort((a, b) => a.textContent.length - b.textContent.length)[0] || null;
  };

  const cuenta = () => (document.querySelector(".count--2cwld") || {}).innerText || "?";
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
  const eligeEn = async (rotulo, texto, busca = texto) => {
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

    if (texto && escribible) {
      /*
      | Un «seleccionar todo» antes de escribir.
      |
      | En el de equipos el campo no siempre se vacía al elegir uno, y lo que
      | se escribía encima quedaba pegado a lo anterior —«AlcorcónAlgeciras»—
      | y no encontraba nada. Con el texto seleccionado, lo que se escribe lo
      | sustituye.
      */
      for (const type of ["rawKeyDown", "keyUp"]) {
        await nav.manda("Input.dispatchKeyEvent", {
          type,
          windowsVirtualKeyCode: 65,
          key: "a",
          code: "KeyA",
          modifiers: 2,
        });
      }

      await espera(200);

      await nav.manda("Input.insertText", { text: texto });

      await espera(1800);
    }

    return js(`
      const e = opcion(${JSON.stringify(rotulo)}, ${JSON.stringify(busca)});

      if (!e) return null;

      const puesto = e.textContent.trim();

      pulsa(e);

      return puesto;
    `);
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

  return { js, clicReal, eligeEn };
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

    if (!all) throw new Error("No encuentro el layout ALL en MOSTRAR.");

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
async function bajaLote(nav, buscador, equipos, numero) {
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
        elegido = await buscador.eligeEn("Equipo actual", equipo);
      } catch {
        /* se reintenta */
      }

      if (!elegido) await espera(1500);
    }

    if (elegido) puestos.push(elegido);
    else faltan.push(equipo);

    await espera(1500);
  }

  if (puestos.length === 0) {
    return { numero, estado: "ningún equipo del lote está en el buscador" };
  }

  const jugadores = await buscador.js(`return cuenta();`);

  if (bandera("parar")) {
    return {
      numero,
      estado: `parado con ${puestos.length} equipos y ${jugadores} jugadores`,
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

  const destino = path.join(DESTINO, `Player Stats ${numero}.xlsx`);

  fs.copyFileSync(origen, destino);
  fs.unlinkSync(origen);

  return {
    numero,
    estado: "ok",
    fichero: path.basename(destino),
    kb,
    jugadores,
    equipos: puestos,
    faltan,
    recortado,
  };
}

/** Todos los jugadores de la categoría, por lotes de equipos. */
async function bajaJugadores(nav, equipos) {
  console.log(`\n  JUGADORES · ${COMPETICION} · ${TEMPORADA}\n`);

  const buscador = await abreBuscador(nav);

  const puesto = await preparaBuscador(buscador);

  const enUnaLinea = (t) => (t || "").replace(/\s+/g, " ").trim();

  console.log(
    `  ${enUnaLinea(puesto.competicion)} · ${enUnaLinea(puesto.periodo)} · MOSTRAR ${enUnaLinea(puesto.mostrar)}`,
  );

  console.log(`  ${puesto.resultados} jugadores en la categoría\n`);

  /*
  | Los ficheros de la semana pasada, fuera.
  |
  | El lector se queda con la descarga que más minutos trae, así que un dato
  | viejo no gana nunca... salvo que esta semana falle justo ese lote, y
  | entonces la pantalla enseñaría una jornada atrasada sin avisar. Se borran
  | los `Player Stats N` y se vuelven a escribir enteros.
  */
  for (const viejo of fs.readdirSync(DESTINO)) {
    if (/^Player Stats \d+\.xlsx$/i.test(viejo)) {
      fs.unlinkSync(path.join(DESTINO, viejo));
    }
  }

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
        resultado = await bajaLote(nav, buscador, lote, i + 1);
      } catch (error) {
        resultado = { numero: i + 1, estado: error.message };
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

  return resultados;
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

  const chrome = abreChrome();

  const nav = await conecta();

  try {
    if (!(await esperaLogin(nav))) {
      console.log("  No se ha iniciado sesión. Nada que hacer.\n");

      return;
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

    for (const equipo of bandera("solo-jugadores") ? [] : lista) {
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
        if (intento > 0) {
          await nav.manda("Page.navigate", { url: "https://wyscout.hudl.com/app/" });

          await espera(4000);

          await vaAlGrupo(nav);
        }

        try {
          resultado = await bajaEquipo(nav, equipo);
        } catch (error) {
          resultado = { equipo, estado: error.message };
        }
      }

      resultados.push(resultado);

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

      if (!(await volverAlGrupo(nav))) await vaAlGrupo(nav);
    }

    if (!bandera("solo-jugadores")) {
      const bien = resultados.filter((r) => r.estado === "ok").length;

      console.log(`\n  ${bien} de ${lista.length} bajados a public/data/wys\n`);

      if (bien < lista.length) {
        console.log("  Los que fallan casi siempre son un cambio de diseño de");
        console.log("  Wyscout: abre la ventana, mira dónde está el botón y");
        console.log("  ajusta el texto que busca este script.\n");
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
    if (!bandera("sin-jugadores")) {
      try {
        await bajaJugadores(nav, lista);
      } catch (error) {
        console.log(`\n  ✗ jugadores: ${error.message}\n`);
      }
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
