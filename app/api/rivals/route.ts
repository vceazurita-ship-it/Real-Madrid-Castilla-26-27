import { after, NextRequest, NextResponse } from "next/server";

import { listDocs, readDoc, writeDoc } from "@/lib/docStore";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

/*
|--------------------------------------------------------------------------
| UNA LECTURA POR TANDA, NO UNA POR PANTALLA
|--------------------------------------------------------------------------
|
| Medido el 03/09/2026 contra el script de la hoja: `rivalesPlantillas` son
| 290 KB y **la primera lectura después de un rato parada tarda entre 30 y
| 70 segundos** —Apps Script tiene que abrir el libro entero—; las de detrás,
| tres o seis. Ésa es, con diferencia, la espera más larga de la app: la
| pantalla de rivales, la pizarra táctica, el coding y el ABP del rival
| piden todas lo mismo.
|
| Así que la respuesta se guarda en dos tramos:
|
|   - **Fresca** el primer minuto: se sirve tal cual.
|   - **Rancia** hasta diez: se sirve igual de rápido y **se pide la nueva
|     por detrás**, para que la siguiente visita ya la tenga. Nadie se come
|     el arranque en frío salvo el primero del día.
|
| Pasado ese plazo se espera a Google, como antes. Las peticiones que llegan
| mientras hay una en vuelo se enganchan a ésa en vez de abrir otra, y un
| fallo no se guarda nunca.
|
| **Quien necesite la verdad de la hoja pide `?fresco=1`** y se salta todo
| esto. Lo usa la relectura que comprueba un guardado (`lib/save-guard`):
| ahí una copia de hace dos minutos diría que no se ha guardado algo que sí
| está escrito, que es el peor error posible.
*/
const VIDA_FRESCA = 60_000;
const VIDA_RANCIA = 10 * 60_000;

/*
| `sucia`: la copia de Supabase es de antes de la última escritura. Sólo la
| acepta quien lo pide (`?rancia=1`) y se compromete a pedir después la hoja
| al día; ver `buscaFuera`.
*/
type Guardado = { data: unknown; hecha: number; sucia?: boolean; suciaDesde?: number };

/*
| Una copia recién ensuciada (se acaba de escribir en la hoja) NO se sirve a
| los lectores normales durante estos minutos (06/10/2026): quien guarda y
| recarga tiene que ver lo suyo, y una pantalla que lee y luego autoguarda
| (el informe colectivo) reescribiría lo de antes. Pasado ese rato, el refresco
| por detrás ya ha tenido tiempo y la sucia se sirve al momento.
*/
const SUCIA_RECIENTE = 3 * 60_000;

const cache = new Map<string, Guardado>();
const enVuelo = new Map<string, Promise<unknown>>();

/*
| Cuántas veces se ha tirado la copia. Una lectura sólo guarda lo que trae si
| nadie ha escrito desde que salió: una lectura lanzada antes de un guardado
| —y a la hoja se le piden 30-70 s— volvía después con la fila de antes y
| repoblaba la caché que el guardado acababa de tirar.
*/
let generacion = 0;

/*
|--------------------------------------------------------------------------
| Y UNA COPIA QUE SOBREVIVE AL SERVIDOR
|--------------------------------------------------------------------------
|
| Lo de arriba vive en la memoria del proceso, y en el despliegue eso dura lo
| que dure la función: **el primero que entra por la mañana —o después de un
| rato sin nadie— se come los treinta a setenta segundos del arranque en frío
| de Apps Script**, y con él todas las pantallas que piden la plantilla de
| rivales. Es la espera que hace que la app no parezca funcional.
|
| Así que lo que llega bueno se guarda además en Supabase, en la misma tabla
| de documentos que usa el resto de la app. Un servidor recién levantado
| encuentra ahí la última copia buena —una lectura de décimas—, contesta con
| ella y pide la nueva por detrás. Nadie vuelve a esperar a Google salvo que
| no haya copia de ninguna clase.
|
| Se guardan **sólo las lecturas gordas y compartidas**: son las que cuestan y
| las que piden todas las pantallas. Una consulta con parámetros —la
| alineación de un partido— no entra: son muchas, pequeñas y cada una la mira
| una persona.
|
| **Y se sirve aunque sea de ayer** (16/09/2026). Hasta hoy la copia valía
| doce horas y pasadas ésas se esperaba a Google: se prefería que el primero
| del día pagase la espera a enseñar datos de anteayer sin avisar. Medido otra
| vez ese día, con el script frío: `seguimiento` **41 s**. Eso no es «tarda»,
| es que la pantalla no se abre —y la copia que teníamos a mano era de unas
| horas antes, con todo lo que le importa a quien entra—.
|
| Así que dentro del tope de abajo se contesta con lo guardado y se pide lo
| nuevo por detrás, siempre. Lo que no se hace es servir una copia de la
| semana pasada: pasado el tope se espera a la hoja, como antes.
*/
const VIDA_GUARDADA = 3 * 24 * 60 * 60_000;

/*
| 300 s, no los 60 por defecto (06/10/2026). El arranque en frío del Apps
| Script pasa a veces del minuto: con 60 s la función se cortaba —medido:
| `seguimiento` 500 a los 60,3 s, `jugadores` 500 a los 31 s— y, peor, el
| refresco por detrás (`after`) también moría a medias, así que la copia de
| Supabase nunca se renovaba. Otras rutas ya van a 300 s en este plan.
*/
export const maxDuration = 300;

const PREFIJO_GUARDADO = "cache:apps-script:";

const TIPO_GUARDADO = "cache-apps-script";

/** Las lecturas que merece la pena guardar fuera. */
const SE_GUARDAN = new Set([
  "rivalesPlantillas",
  "rivales",
  "jugadores",
  "seguimiento",
  "microciclo",
  "condicional",
  "alineaciones",
  /* 06/10/2026: sin copia de fuera, cada servidor nuevo esperaba a Google (15 s y error, medido). Su pantalla relee con `fresco=1` tras guardar. */
  "getIdentidadPosicional",
]);

function seGuarda(consulta: string) {
  const accion = new URLSearchParams(consulta).get("action") ?? "";

  /* Sólo la consulta pelada: `action=X` y nada más. Con parámetros es la
     lectura de una cosa concreta y no la comparte nadie. */
  return SE_GUARDAN.has(accion) && consulta === `action=${accion}`;
}

function claveGuardada(consulta: string) {
  return `${PREFIJO_GUARDADO}${new URLSearchParams(consulta).get("action")}`;
}

/** Deja la copia en Supabase. Nunca tumba la petición que la provocó. */
function guardaFuera(consulta: string, data: unknown) {
  if (!seGuarda(consulta)) return;

  void writeDoc(claveGuardada(consulta), TIPO_GUARDADO, {
    data,
    hecha: Date.now(),
  }).catch(() => undefined);
}

/** La copia de Supabase, si la hay y todavía vale. */
async function buscaFuera(
  consulta: string,
  { aceptaSucia = false, aceptaVieja = false } = {},
): Promise<Guardado | null> {
  if (!seGuarda(consulta)) return null;

  try {
    const { data } = await readDoc<Guardado>(claveGuardada(consulta));

    if (!data || data.data == null || typeof data.hecha !== "number") return null;

    if (data.sucia && !aceptaSucia) return null;

    if (!aceptaVieja && Date.now() - data.hecha > VIDA_GUARDADA) return null;

    return data;
  } catch {
    /* Sin Supabase se sigue como siempre: a la hoja. */
    return null;
  }
}

/**
 * Tira también las copias de fuera.
 *
 * Después de escribir en la hoja, una copia de hace un rato diría que no se ha
 * guardado algo que sí está. No se pueden borrar filas desde aquí, así que se
 * vacían: una copia sin datos no la usa nadie.
 */
function olvidaFuera() {
  after(async () => {
    try {
      const guardados = await listDocs(PREFIJO_GUARDADO);

      /*
      | Se marcan como sucias en vez de vaciarlas (01/10/2026). Vaciarlas
      | hacía que, tras cualquier guardado —y el autoguardado del plan de
      | partido guarda cada pocos segundos—, el siguiente en entrar esperase
      | los 30-70 s de Google. Para quien no la pide, una sucia es como si no
      | hubiera copia, igual que antes.
      */
      await Promise.all(
        guardados
          .filter((uno) => {
            const g = uno.data as Guardado | null;

            /* También las ya sucias: cada escritura renueva su hora, si no, tras tres minutos editando se volvía a servir lo de antes. */
            return g && g.data != null;
          })
          .map((uno) =>
            writeDoc(uno.key, TIPO_GUARDADO, {
              ...(uno.data as Guardado),
              sucia: true,
              suciaDesde: Date.now(),
            }),
          ),
      );
    } catch {
      /* Lo peor que pasa es servir la copia un rato más. */
    }
  });
}

/**
 * Pide a la hoja, guarda lo que llegue y deja de estar en vuelo.
 *
 * La clave es **la consulta entera** —`action=getAlineacion&id=12`—, no sólo
 * la acción: hay lecturas que llevan parámetros y cada una guarda su copia.
 */
function pide(consulta: string, { propia = false } = {}) {
  /*
  | Una petición «propia» no se engancha a la que ya iba.
  |
  | La comprobación de un guardado pide fresco, y si en ese momento había una
  | lectura en vuelo —lanzada ANTES de escribir, porque a la hoja se le piden
  | 30-70 segundos— se le devolvía aquélla: la fila de antes de guardar. El
  | save-guard decía «no se ha guardado» de algo que sí estaba escrito, y
  | encima esa respuesta vieja repoblaba la caché que se acababa de tirar.
  */
  const yaVa = propia ? null : enVuelo.get(consulta);

  if (yaVa) return yaVa;

  const nacida = generacion;

  const peticion = (async () => {
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?${consulta}`, {
        cache: "no-store",
      });

      /* Google contesta a veces con una página de error y un 5xx. Se corta
         aquí para no guardar eso como si fuera la hoja. */
      if (!response.ok) {
        throw new Error(`Apps Script respondió ${response.status}`);
      }

      const data = await response.json();

      /* Si se ha escrito en la hoja mientras volaba, esto puede ser la fila de
         antes: se entrega a quien la pidió, pero no se guarda como copia. */
      if (nacida === generacion) {
        cache.set(consulta, { data, hecha: Date.now() });

        guardaFuera(consulta, data);
      }

      return data;
    } finally {
      /*
      | Sólo la que se apuntó se desapunta, y sólo si sigue siendo la suya:
      | tras un guardado el mapa se vacía y la que haya ahora es otra, más
      | nueva, que no hay que quitar.
      */
      if (!propia && nacida === generacion) enVuelo.delete(consulta);
    }
  })();

  /* La «propia» no se apunta: nadie debe engancharse a ella, y tampoco tiene
     que desaparecer del mapa la que ya iba. */
  if (!propia) enVuelo.set(consulta, peticion);

  return peticion;
}

/**
 * Pide la hoja **después** de haber contestado, sin hacer esperar a nadie.
 *
 * Va con `after` y no con un `void pide(...)` suelto por dónde vive esto: en
 * el despliegue cada petición es una función que se congela en cuanto sale la
 * respuesta, así que una promesa lanzada al aire se quedaba a medias y la
 * copia no se renovaba nunca —el siguiente volvía a encontrarla vieja—.
 * `after` mantiene viva la invocación hasta que termina. Un fallo del refresco
 * no puede tumbar una petición que ya está contestada.
 */
function renueva(consulta: string) {
  after(() => pide(consulta).catch(() => undefined));
}

async function lee(consulta: string, fresco: boolean, rancia = false) {
  if (fresco) {
    /*
    | Quien pide fresco quiere la verdad de la hoja, así que aquí no hay red:
    | si Google falla, falla. Es lo que comprueba un guardado, y contestar con
    | una copia diría que no se ha escrito algo que sí está.
    */
    const anterior = cache.get(consulta);

    cache.delete(consulta);

    try {
      return await pide(consulta, { propia: true });
    } catch (error) {
      /* Se devuelve la copia al sitio: no vale tirarla por un fallo de red. */
      if (anterior) cache.set(consulta, anterior);

      throw error;
    }
  }

  const guardado = cache.get(consulta);

  if (guardado) {
    const edad = Date.now() - guardado.hecha;

    if (edad < VIDA_FRESCA) return guardado.data;

    if (edad < VIDA_RANCIA) {
      /* Se contesta con lo que hay y se renueva por detrás. Un fallo del
         refresco no puede tumbar esta petición, que ya está contestada. */
      renueva(consulta);

      return guardado.data;
    }
  }

  /*
  | Sin copia en memoria, antes de esperar a Google se mira la de Supabase:
  | es la que salva al primero que entra después de un rato —y a cualquier
  | servidor recién levantado— de los treinta a setenta segundos del arranque
  | en frío. Se contesta con ella y se pide la nueva por detrás.
  */
  /*
  | LA COPIA «SUCIA» TAMBIÉN SE SIRVE (06/10/2026).
  |
  | Cualquier guardado en la hoja —y el autoguardado del plan de partido
  | guarda cada pocos segundos— marcaba sucias TODAS las copias, y para el
  | resto una sucia era «no hay copia»: a esperar los 30-70 s de Google, que a
  | veces acababan en error. Medido en la web: plantillas rivales 38-57 s y
  | 500, la portada 60 s y 500. Ahora la sucia se contesta al momento y se
  | renueva por detrás, como una copia rancia más; las pantallas que necesitan
  | la verdad justo después de guardar ya piden `fresco=1`, que no pasa por
  | aquí.
  */
  const deFuera = await buscaFuera(consulta, { aceptaSucia: true });

  if (deFuera) {
    /*
    | Una sucia no entra en la memoria —los demás tendrían una vieja sin saber
    | que lo es—; se contesta con ella y se pide la buena por detrás, que al
    | llegar deja la copia limpia. Quien pidió `rancia=1` ya hace su propio
    | `fresco=1` después: no hace falta pedirla dos veces.
    */
    if (deFuera.sucia) {
      const reciente = !rancia && Date.now() - (deFuera.suciaDesde ?? 0) < SUCIA_RECIENTE;

      if (reciente) {
        try {
          return await pide(consulta);
        } catch {
          return deFuera.data;
        }
      }

      if (!rancia) renueva(consulta);

      return deFuera.data;
    }

    cache.set(consulta, deFuera);

    renueva(consulta);

    return deFuera.data;
  }

  /*
  | Ahora sí hay que esperar a Google. Y si Google falla teniendo nosotros
  | algo guardado —aunque sea de hace media hora—, se sirve eso.
  |
  | El Apps Script se cae a ratos y devuelve una página de error en vez de
  | JSON. Antes eso dejaba la pantalla en «no se pudieron cargar los datos»
  | teniendo una copia perfectamente utilizable a mano; una lista de hace un
  | rato es infinitamente mejor que un calendario vacío.
  */
  try {
    return await pide(consulta);
  } catch (error) {
    if (guardado) return guardado.data;

    /* Ni en memoria: la de Supabase, aunque pase de los tres días. */
    const deEmergencia = await buscaFuera(consulta, { aceptaSucia: true, aceptaVieja: true });

    if (deEmergencia) return deEmergencia.data;

    throw error;
  }
}

/** Lo que se acaba de escribir tiene que verse ya: el POST tira la copia. */
function olvida() {
  generacion += 1;

  cache.clear();

  /* Nadie debe engancharse a una lectura que salió antes de escribir. */
  enVuelo.clear();

  olvidaFuera();
}

/*
|--------------------------------------------------------------------------
| LAS ESCRITURAS QUE NO PASAN POR AQUÍ
|--------------------------------------------------------------------------
|
| El `POST` de arriba tira la copia porque la escritura pasa por esta ruta.
| Pero media app escribe **directamente contra el Apps Script** desde el
| navegador: `lib/hojaRivales.ts` (informe colectivo, plan de partido,
| alineaciones guardadas) y los guardados por `GET` de la identidad
| posicional, los principios y los valores. Ésas no se enteran, y con una
| copia de hasta diez minutos alguien podía guardar una alineación y no verla
| en la lista.
|
| Así que quien escriba por su cuenta avisa por aquí, y esta caché se vacía
| igual que con un `POST`. Es una llamada suelta y sin cuerpo: no vale nada
| dejarla caer si falla —lo peor que pasa es servir la copia un rato más—.
*/

/*
|--------------------------------------------------------------------------
| LA FICHA DEL JUGADOR RIVAL SE GUARDA YA; LA HOJA, POR DETRÁS (07/10/2026)
|--------------------------------------------------------------------------
|
| Cada pausa al escribir en una ficha mandaba la ficha entera al Apps Script
| y la pantalla esperaba su respuesta (de unos segundos a más de un minuto en
| frío), y luego la comprobaba releyendo la hoja (14-18 s medidos). Se
| guardaba poco y tarde, y cerrar o cambiar de jugador a mitad dejaba cosas
| en el aire.
|
| Ahora el guardado entra en una COLA en Supabase —un documento por jugador,
| el último manda— y se contesta al momento. Por detrás (`after`) la cola se
| escribe en la hoja, en orden, y lo que falle se queda para el siguiente
| intento, que lo dispara cualquier lectura o guardado. Mientras tanto, toda
| lectura de la plantilla aplica encima lo que hay en la cola: la ficha se ve
| al día aunque la hoja todavía no lo tenga.
*/
const PREFIJO_COLA = "cola:rival-jugador:";

const TIPO_COLA = "cola-rival-jugador";

type EnCola = { player: Record<string, unknown> | null; at: number; intentos?: number; error?: string };

const claveCola = (id: string) => `${PREFIJO_COLA}${id}`;

/* Lo pendiente, con unos segundos de memoria: cada lectura de la plantilla lo mira. */
let pendientesEnMemoria: { at: number; lista: EnCola[] } | null = null;

async function pendientes(): Promise<EnCola[]> {
  if (pendientesEnMemoria && Date.now() - pendientesEnMemoria.at < 5_000) return pendientesEnMemoria.lista;

  try {
    const filas = await listDocs(PREFIJO_COLA);
    const lista = filas
      .map((f) => f.data as EnCola | null)
      .filter((d): d is EnCola => Boolean(d?.player))
      .sort((a, b) => a.at - b.at);

    pendientesEnMemoria = { at: Date.now(), lista };

    return lista;
  } catch {
    return pendientesEnMemoria?.lista ?? [];
  }
}

/** La plantilla con lo de la cola encima (por ID_JUGADOR). */
async function conLaCola(data: unknown) {
  if (!Array.isArray(data)) return data;

  const cola = await pendientes();

  if (!cola.length) return data;

  const porId = new Map(cola.map((c) => [String(c.player?.ID_JUGADOR ?? ""), c.player as Record<string, unknown>]));

  return data.map((fila) => {
    const encima = porId.get(String((fila as Record<string, unknown>)?.ID_JUGADOR ?? ""));

    return encima ? { ...(fila as Record<string, unknown>), ...encima } : fila;
  });
}

/** Mete a un jugador en la cola y pone su fila al día en la copia de memoria. */
async function encola(player: Record<string, unknown>) {
  const id = String(player.ID_JUGADOR ?? "");

  await writeDoc(claveCola(id), TIPO_COLA, { player, at: Date.now(), intentos: 0 } satisfies EnCola);

  pendientesEnMemoria = null;
}

let procesando = false;

/** Escribe en la hoja lo que haya en la cola, de uno en uno. */
async function procesaCola() {
  if (procesando) return;

  procesando = true;

  try {
    pendientesEnMemoria = null;

    for (const item of await pendientes()) {
      const id = String(item.player?.ID_JUGADOR ?? "");

      if (!id) continue;

      let ok = false;
      let error = "";

      try {
        const respuesta = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "guardarRivalJugador", player: item.player }),
        });

        const texto = await respuesta.text();

        try {
          const r = JSON.parse(texto) as { success?: boolean; error?: string };

          ok = Boolean(r.success);
          error = r.error ?? "";
        } catch {
          error = texto.slice(0, 160);
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      /* Sólo se saca de la cola si nadie ha vuelto a guardar ese jugador mientras tanto. */
      const actual = (await readDoc<EnCola>(claveCola(id)).catch(() => ({ data: null }))).data;

      if (!actual?.player || actual.at !== item.at) continue;

      if (ok) {
        await writeDoc(claveCola(id), TIPO_COLA, { player: null, at: Date.now() } satisfies EnCola);

        /* Lo que estuviera leyéndose de la hoja salió antes de esta escritura: que no quede como copia. */
        generacion += 1;
        enVuelo.clear();

        const ponAlDia = (filas: unknown[]) =>
          filas.map((fila) =>
            String((fila as Record<string, unknown>)?.ID_JUGADOR ?? "") === id ? { ...(fila as Record<string, unknown>), ...item.player } : fila,
          );

        /* La fila de la copia de memoria, ya con lo escrito. */
        const copia = cache.get("action=rivalesPlantillas");

        if (copia && Array.isArray(copia.data)) copia.data = ponAlDia(copia.data);

        /*
        | Y la de Supabase, que es la que leen los demás servidores: sin esto,
        | al vaciarse la cola volvían a enseñar la fila de antes de guardar.
        */
        try {
          const clave = claveGuardada("action=rivalesPlantillas");
          const { data: fuera } = await readDoc<Guardado>(clave);

          if (fuera && Array.isArray(fuera.data)) await writeDoc(clave, TIPO_GUARDADO, { ...fuera, data: ponAlDia(fuera.data) });
        } catch {
          /* Lo peor: esa copia enseña la fila vieja hasta su próximo refresco. */
        }
      } else {
        await writeDoc(claveCola(id), TIPO_COLA, { ...actual, intentos: (actual.intentos ?? 0) + 1, error: error.slice(0, 200) } satisfies EnCola);
      }
    }
  } finally {
    procesando = false;
    pendientesEnMemoria = null;
  }
}

export async function DELETE() {
  olvida();

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    /* El estado de la cola de fichas: lo que falta por llegar a la hoja y si algo está fallando. */
    if (searchParams.get("action") === "estadoColaRivales") {
      pendientesEnMemoria = null;

      const lista = await pendientes();

      if (lista.length) after(procesaCola);

      return NextResponse.json(
        lista.map((c) => ({
          id: String(c.player?.ID_JUGADOR ?? ""),
          nombre: String(c.player?.["NOMBRE DEPORTIVO"] || c.player?.JUGADOR || ""),
          desde: c.at,
          intentos: c.intentos ?? 0,
          error: c.error ?? "",
        })),
      );
    }

    /*
    | Se reenvía lo que venga —`getAlineacion` necesita su `id`—, quitando
    | `fresco` y `jugador`, que son órdenes para esta ruta y no significan
    | nada en la hoja. Sin parámetros se lee la plantilla de rivales, que es lo
    | que pedía esta ruta cuando sólo servía para eso.
    */
    const parametros = new URLSearchParams(searchParams);

    parametros.delete("fresco");
    parametros.delete("jugador");
    parametros.delete("rancia");

    if (!parametros.has("action")) parametros.set("action", "rivalesPlantillas");

    /*
    | `?rancia=1`: vale la copia de Supabase aunque sea de antes del último
    | guardado. Lo pide el plan de partido, que abre con ella y se pone al día
    | él solo con un `fresco=1` por detrás.
    */
    let data = await lee(
      parametros.toString(),
      searchParams.get("fresco") === "1",
      searchParams.get("rancia") === "1",
    );

    /* La plantilla, con las fichas guardadas que todavía no han llegado a la hoja; y la cola, empujada. */
    if (parametros.toString() === "action=rivalesPlantillas") {
      data = await conLaCola(data);

      if ((await pendientes()).length) after(procesaCola);
    }

    /*
    | `?jugador=<ID_JUGADOR>` devuelve **una fila**, no las mil.
    |
    | Lo pide la comprobación de un guardado (`lib/save-guard`), que necesita
    | releer al jugador que se acaba de escribir y para eso se estaba
    | descargando la plantilla entera: 290 KB por cada pausa al teclear, y
    | encima sin caché porque una copia no vale para comprobar una escritura.
    | La lectura contra Google es la misma —el script no sabe devolver una
    | fila—, pero al navegador le llega un objeto de dos líneas.
    |
    | El filtro va aquí y no en la clave de la caché a propósito: si cada
    | jugador guardara su copia, treinta y dos fichas serían treinta y dos
    | lecturas de la hoja en vez de una.
    */
    const jugador = searchParams.get("jugador");

    if (jugador) {
      const filas = Array.isArray(data) ? data : [];

      const fila = filas.find(
        (una) =>
          String((una as Record<string, unknown>)?.ID_JUGADOR ?? "") === jugador,
      );

      return NextResponse.json(fila ?? null);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error GET /api/rivals:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error cargando datos de rivales",
        /* El motivo, para poder diagnosticarlo sin los registros de Vercel (06/10/2026). */
        motivo: error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    /* La ficha de un jugador que ya existe: a la cola y contestado ya; la hoja, por detrás. */
    if (body?.action === "guardarRivalJugador" && body?.player?.ID_JUGADOR) {
      await encola(body.player as Record<string, unknown>);

      after(procesaCola);

      return NextResponse.json({ success: true, encolado: true });
    }

    olvida();

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    /*
    | Y otra vez al volver. El POST tarda lo suyo, y lo que se leyó mientras
    | tanto —y se guardó como copia, aquí o en Supabase— puede ser la fila de
    | antes de escribir. El `olvida()` de antes sólo sirve para quien lea
    | durante la escritura; éste es el que deja la copia de verdad limpia.
    */
    olvida();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        success: false,
        error: text,
      };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error POST /api/rivals:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error comunicando con Google Apps Script",
      },
      { status: 500 }
    );
  }
}