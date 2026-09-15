#!/usr/bin/env node
/*
|--------------------------------------------------------------------------
| LOS INFORMES DE LA LIGA, BAJADOS SOLOS
|--------------------------------------------------------------------------
|
| Cada semana había que entrar en Wyscout, abrir los veinte equipos del grupo
| uno a uno, poner el desplegable en ALL y pulsar «Exportar en Excel» veinte
| veces. Media hora de ratón para que `public/data/wys` tenga lo que
| `lib/data-analisis/leer.ts` espera. Esto lo hace solo:
|
|     node scripts/wyscout-liga.mjs
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
| Los **clips de vídeo** de la tabla no tienen enlace: el icono de ▶ no es un
| `<a>`, abre un reproductor dentro de la propia aplicación, y la aplicación no
| tiene direcciones —navegar por ella nunca cambia la URL, siempre es
| `/app/`—. Se probaron `?/team/<id>`, `#/team/<id>` y `/app/team/<id>`: las
| tres aterrizan en la lista de países o en un 404. Se puede compartir un clip
| suelto a mano desde el reproductor, pero no hay forma de recoger los enlaces
| de cientos de celdas ni de enlazar a un equipo desde fuera.
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

  const antes = new Set(fs.readdirSync(DESCARGAS));

  if (!(await nav.clic("Exportar en Excel", { luego: 2000 }))) {
    return { equipo, estado: "no encuentro el botón de exportar" };
  }

  /* El fichero tarda: lo genera el servidor y baja como blob. */
  let fichero = null;

  for (let i = 0; i < 40 && !fichero; i++) {
    await espera(1000);

    fichero = fs
      .readdirSync(DESCARGAS)
      .find((f) => !antes.has(f) && f.endsWith(".xlsx"));
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

    const equipos = await vaAlGrupo(nav);

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

    for (const equipo of lista) {
      process.stdout.write(`  ${equipo.padEnd(26)}`);

      /*
      | Dos intentos por equipo, y entre uno y otro se rehace el camino.
      |
      | Lo que falla no suele ser el script sino la aplicación: una pestaña que
      | se atasca pintando quinientas celdas de vídeo, un clic que se pierde, un
      | export que no arranca. Reintentando una vez se recuperan casi todos, y
      | lo que no, sale en el resumen con su motivo.
      */
      let resultado = null;

      for (let intento = 0; intento < 2 && !resultado?.fichero; intento++) {
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
      if (!(await volverAlGrupo(nav))) await vaAlGrupo(nav);
    }

    const bien = resultados.filter((r) => r.estado === "ok").length;

    console.log(`\n  ${bien} de ${lista.length} bajados a public/data/wys\n`);

    if (bien < lista.length) {
      console.log("  Los que fallan casi siempre son un cambio de diseño de");
      console.log("  Wyscout: abre la ventana, mira dónde está el botón y");
      console.log("  ajusta el texto que busca este script.\n");
    }
  } finally {
    if (!bandera("ver")) {
      nav.cierra();

      chrome.kill();
    }
  }
}

principal().catch((error) => {
  console.error("\n  Se ha roto:", error.message, "\n");

  process.exit(1);
});
