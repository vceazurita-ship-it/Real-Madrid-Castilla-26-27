/**
 * Lee del canal de la RFEF los resúmenes de Primera Federación de la
 * temporada (03/11/2026). Sólo servidor; lo cachea la ruta.
 *
 * Sin API ni cuota, como `scripts/abp-videos-youtube.mjs`: la página de los
 * subidos del canal (la lista `UU…`) trae los 100 primeros dentro del HTML y el
 * resto se pide de 100 en 100 a `youtubei/v1/browse` con el token de
 * continuación que viene en cada tanda. Se para al llegar a un resumen de la
 * temporada anterior: más atrás ya no hay nada de ésta.
 *
 * DOS COSAS QUE YA HAN CAMBIADO EN YOUTUBE (vistas el 03/11/2026):
 * - el `ytInitialData` unas veces va en `var ytInitialData = {…};` y otras en
 *   `<script id="yt-initial-data" type="application/json">`, según a quién se
 *   lo sirva: se buscan los dos;
 * - las filas ya no son `playlistVideoRenderer` sino `lockupViewModel`
 *   (`contentId`, `metadata.lockupMetadataViewModel.title.content`) y la
 *   continuación es `continuationItemViewModel`. Se leen las dos formas. Hay
 *   más de un token por página: el bueno es el primero.
 */

import { leeTituloResumen, temporadaDeTitulo, temporadaEn, type ResumenRfef } from "@/lib/rivals/resumenes-rfef";

/** «Real Federación Española Fútbol». */
export const CANAL_RFEF = "UCQBxzdEPXjy05MtpfbdtMxQ";

/** La lista de subidos del canal: el mismo id con `UU` en vez de `UC`. */
const SUBIDOS = `UU${CANAL_RFEF.slice(2)}`;

/*
| Una temporada entera del canal son unas 2.000 subidas (fútbol sala, femenino,
| Copa…): veinticinco tandas sobran. Es el freno si un día no aparece ningún
| resumen viejo con el que pararse.
*/
const MAX_TANDAS = 30;

/** Resúmenes de la temporada anterior que hay que ver para dar la lectura por acabada. */
const VIEJOS_PARA_PARAR = 5;

const CABECERAS = {
  "Accept-Language": "es-ES,es;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
  Cookie: "CONSENT=YES+1; SOCS=CAI",
};

type Fila = { id: string; titulo: string; segundos: number };

function datosIniciales(html: string): unknown {
  const etiqueta = /<script[^>]*id="yt-initial-data"[^>]*>([\s\S]*?)<\/script>/.exec(html);

  if (etiqueta) return JSON.parse(etiqueta[1]);

  const variable = /var ytInitialData = (\{[\s\S]*?\});<\/script>/.exec(html);

  if (variable) return JSON.parse(variable[1]);

  throw new Error("YouTube no trae los datos de la lista.");
}

const aSegundos = (texto: string) => texto.split(":").reduce((s, p) => s * 60 + Number(p), 0);

type Nodo = Record<string, unknown>;

/** Las filas y el primer token de continuación de una respuesta. */
function recorre(raiz: unknown) {
  const filas: Fila[] = [];

  let token: string | null = null;

  const anda = (o: unknown) => {
    if (!o || typeof o !== "object") return;

    const n = o as Nodo;

    if (n.lockupViewModel) {
      const v = n.lockupViewModel as Nodo;
      const meta = (v.metadata as Nodo | undefined)?.lockupMetadataViewModel as Nodo | undefined;
      const titulo = String(((meta?.title as Nodo | undefined)?.content as string | undefined) ?? "");
      const duracion = /"text":"(\d+(?::\d+)+)"/.exec(JSON.stringify(v.contentImage ?? {}))?.[1];

      if (typeof v.contentId === "string" && titulo) {
        filas.push({ id: v.contentId, titulo, segundos: duracion ? aSegundos(duracion) : 0 });
      }

      return;
    }

    if (n.playlistVideoRenderer) {
      const v = n.playlistVideoRenderer as Nodo;
      const t = v.title as { runs?: { text: string }[]; simpleText?: string } | undefined;
      const titulo = (t?.runs ?? []).map((r) => r.text).join("") || t?.simpleText || "";

      if (typeof v.videoId === "string" && titulo) {
        filas.push({ id: v.videoId, titulo, segundos: Number(v.lengthSeconds ?? 0) || 0 });
      }

      return;
    }

    if (n.continuationItemViewModel || n.continuationItemRenderer) {
      token ??= /"token":"([^"]+)"/.exec(JSON.stringify(o))?.[1] ?? null;

      return;
    }

    for (const k in n) anda(n[k]);
  };

  anda(raiz);

  return { filas, token };
}

/**
 * Los resúmenes de Primera Federación de la temporada en curso, en el orden
 * del canal (del más nuevo al más viejo). Lanza si YouTube no contesta: la
 * ruta no guarda un error en la caché.
 */
export async function leeResumenesRfef(hoy = new Date()): Promise<ResumenRfef[]> {
  const temporada = temporadaEn(hoy);

  const pagina = await fetch(`https://www.youtube.com/playlist?list=${SUBIDOS}&hl=es&gl=ES`, {
    headers: CABECERAS,
    cache: "no-store",
  });

  if (!pagina.ok) throw new Error(`YouTube contesta ${pagina.status}.`);

  const html = await pagina.text();

  const version = /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/.exec(html)?.[1] ?? "2.20261030.02.00";

  let { filas, token } = recorre(datosIniciales(html));

  if (!filas.length) throw new Error("La lista de subidos del canal llega vacía.");

  const salida: ResumenRfef[] = [];

  const vistos = new Set<string>();

  /*
  | Cuántos resúmenes de temporadas pasadas se han visto. No se para con el
  | primero: los títulos se escriben a mano («Temporada 226/27» salió en la
  | J10) y una sola errata no puede dejar fuera media temporada.
  */
  let viejos = 0;

  for (let tanda = 0; ; tanda += 1) {
    for (const fila of filas) {
      if (vistos.has(fila.id)) continue;

      vistos.add(fila.id);

      const leido = leeTituloResumen(fila.titulo);

      if (!leido) {
        /* Un playoff de la anterior (sin jornada) también dice que ya se ha pasado. */
        const empieza = /#PrimeraFederaci[oó]n\b/i.test(fila.titulo) ? temporadaDeTitulo(fila.titulo) : null;

        if (empieza !== null && empieza < temporada) viejos += 1;

        continue;
      }

      if (leido.temporada < temporada) viejos += 1;
      else if (leido.temporada === temporada) salida.push({ id: fila.id, segundos: fila.segundos, ...leido });
    }

    if (viejos >= VIEJOS_PARA_PARAR || !token || tanda >= MAX_TANDAS) break;

    const respuesta = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
      method: "POST",
      headers: { ...CABECERAS, "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName: "WEB", clientVersion: version, hl: "es", gl: "ES" } },
        continuation: token,
      }),
      cache: "no-store",
    });

    /*
    | Una tanda que falla tira la lectura entera: con lo leído hasta ahí
    | faltarían los partidos más viejos durante horas, y la caché prefiere
    | seguir sirviendo la última lectura buena.
    */
    if (!respuesta.ok) throw new Error(`YouTube contesta ${respuesta.status} en la tanda ${tanda + 1}.`);

    ({ filas, token } = recorre(await respuesta.json()));

    if (!filas.length) break;
  }

  return salida;
}
