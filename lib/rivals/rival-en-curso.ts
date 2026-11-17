/*
|--------------------------------------------------------------------------
| EL RIVAL QUE SE ESTÁ MIRANDO, DE PANTALLA EN PANTALLA (16/11/2026)
|--------------------------------------------------------------------------
|
| Petición del analista (ronda 18): «que entre todas las pantallas del rival se
| salte con el mismo rival elegido». Las pantallas piden el rival de dos
| maneras (ver memoria enlaces-por-rival):
|
| - `?equipo=<NOMBRE>`: Plantillas, Scout individual, ABP del rival, Área del
|   rival y Duelos;
| - `?rival=<ID de la fila RIVALES>`: Plan de partido, Scout colectivo y la
|   Pizarra ABP.
|
| Los enlaces de aquí llevan LAS DOS llaves, y cada pantalla lee la suya. La
| pantalla que tiene un rival elegido lo deja apuntado (`fijaRivalEnCurso`) y
| la tira de pestañas de la sección (`NavSeccion`) lo pone en sus enlaces: se
| cambia de pantalla sin volver a elegir. Vive en `sessionStorage`: dura la
| visita y no se cuela en otra pestaña ni al día siguiente.
*/

export type RivalEnCurso = { equipo: string; id: string };

const CLAVE = "rmcf-rival-en-curso";

let actual: RivalEnCurso | null = null;
let leido = false;
const oyentes = new Set<() => void>();

function lee(): RivalEnCurso | null {
  if (leido) return actual;

  leido = true;

  try {
    const crudo = typeof window !== "undefined" ? window.sessionStorage.getItem(CLAVE) : null;
    const dato = crudo ? (JSON.parse(crudo) as Partial<RivalEnCurso>) : null;

    actual = dato && (dato.equipo || dato.id) ? { equipo: String(dato.equipo ?? ""), id: String(dato.id ?? "") } : null;
  } catch {
    actual = null;
  }

  return actual;
}

/** Apunta el rival que se está mirando. Sin cambios, no avisa a nadie. */
export function fijaRivalEnCurso(rival: RivalEnCurso) {
  const previo = lee();
  const equipo = rival.equipo.trim();
  const id = rival.id.trim();

  if (!equipo && !id) return;
  if (previo && previo.equipo === equipo && previo.id === id) return;

  actual = { equipo, id };

  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    /* Sin almacenamiento (ventana privada): dura lo que la página. */
  }

  oyentes.forEach((avisa) => avisa());
}

export function suscribeRivalEnCurso(avisa: () => void) {
  oyentes.add(avisa);

  return () => {
    oyentes.delete(avisa);
  };
}

export const rivalEnCursoActual = () => lee();
export const rivalEnCursoServidor = () => null;

const plano = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * ¿Es el mismo jugador del rival escrito de dos maneras? («Flakus» de BeSoccer
 * y «FLAKUS BOSILJ» de la hoja, «Jorge Mier» y «J. Mier»). Igual, o uno
 * contiene al otro palabra a palabra; con inicial, la inicial y el apellido.
 */
export function mismoNombreRival(a: string, b: string) {
  const x = plano(a);
  const y = plano(b);

  if (!x || !y) return false;
  if (x === y) return true;

  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];

  if (` ${largo} `.includes(` ${corto} `) && corto.length >= 4) return true;

  /* «j mier» frente a «jorge mier». */
  const partes = corto.split(" ");

  if (partes.length === 2 && partes[0].length === 1) {
    const otras = largo.split(" ");

    return otras[0]?.startsWith(partes[0]) === true && otras.slice(1).includes(partes[1]);
  }

  return false;
}

/** Las pantallas que entienden el rival en la dirección. */
const CON_RIVAL = new Set([
  "/rivals",
  "/scout-rival-collective",
  "/scout-rival-individual",
  "/scout-rival-abp",
  "/scout-rival-area",
  "/match-preparation",
  "/duelos",
  "/abp-pizarra",
]);

/** `ruta` con las dos llaves del rival (las que haya). Las rutas que no saben de rivales, tal cual. */
export function conRivalEnUrl(ruta: string, rival: Partial<RivalEnCurso> | null | undefined) {
  const [camino, consulta = ""] = ruta.split("?");

  if (!rival || !CON_RIVAL.has(camino)) return ruta;

  const q = new URLSearchParams(consulta);

  if (rival.equipo && !q.has("equipo")) q.set("equipo", rival.equipo);
  if (rival.id && !q.has("rival")) q.set("rival", rival.id);

  const texto = q.toString();

  return texto ? `${camino}?${texto}` : camino;
}
