/**
 * LOS DOS ONCES DE LOS DUELOS, SIN PANTALLA (06/10/2026).
 *
 * Lo que antes vivía dentro de `app/duelos/page.tsx`, sacado aquí para que el
 * informe del partido (lib/informe-partido/carga.ts) arme EXACTAMENTE los
 * mismos onces y los mismos duelos que se ven en Competición → Duelos:
 * - nuestro once, propuesto con los minutos de Wyscout en 4-2-3-1;
 * - el suyo, del once marcado en Plantillas rivales, o su último once de
 *   BeSoccer, o los de más minutos;
 * - y lo cambiado a mano en Duelos (`duelos:<rival>`), que manda sobre todo.
 */
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { esNuestro } from "@/lib/data-analisis/individual";
import { HUECOS, casaNombre, proponeOnce, sitioDe } from "@/lib/data-analisis/once";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { playerKey } from "@/lib/rivals/once";
import type { InformeEquipo } from "@/lib/rivals/informe";
import {
  HUECO_VACIO,
  alturaEnCm,
  mideDuelos,
  referenciasPorPuesto,
  type DuelosDoc,
  type JugadorDuelo,
  type ResultadoDuelo,
} from "@/lib/duelos";

type Fila = Record<string, unknown>;

/** Lo que hace falta de una ficha de nuestra plantilla. */
export type FichaPropia = { id: string; nombre: string; apodo?: string; foto?: string; posicion: string };

const texto = (v: unknown) => String(v ?? "").trim();

/** La hoja escribe muchos nombres en mayúsculas («CARLOS LAZO»): en pantalla, como los nuestros. */
export const comoNombre = (t: string) =>
  t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s\-'.])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : t;

/** Los nuestros: los de Wyscout de esta temporada y, sin datos, los de la plantilla que no tienen fila. */
export function nuestrosDe(jugadores: FilaJugador[], fichas: FichaPropia[]): JugadorDuelo[] {
  const filas = jugadores.filter((j) => esNuestro(j) && j.temporada === "actual" && j.minutos > 0);
  /* Wyscout repite a alguno (dos filas con nombres distintos): manda la de más minutos. */
  const porNombre = new Map<string, FilaJugador>();
  for (const f of filas) {
    const previo = porNombre.get(f.jugador);
    if (!previo || f.minutos > previo.minutos) porNombre.set(f.jugador, f);
  }
  const conFicha = new Set<string>();
  const deWyscout: JugadorDuelo[] = [...porNombre.values()].map((f) => {
    const ficha = casaNombre(f.jugador, fichas, (p) => p.nombre) ?? casaNombre(f.jugador, fichas, (p) => p.apodo ?? "");
    if (ficha) conFicha.add(ficha.id);
    const sitio = sitioDe(ficha?.posicion ?? "", f.posicion);
    return {
      clave: f.jugador,
      nombre: ficha?.nombre ?? f.jugador,
      foto: ficha?.foto,
      puesto: sitio.puesto,
      lado: sitio.lado,
      posicion: f.posicion.split(",")[0],
      altura: alturaEnCm(f.altura),
      pie: f.pie,
      minutos: f.minutos,
      wyscout: f,
    };
  });
  /* Y los de la plantilla sin fila de Wyscout (un fichaje, uno sin minutos): se pueden poner, sin datos. */
  const sinWyscout: JugadorDuelo[] = fichas
    .filter((p) => !conFicha.has(p.id))
    .map((p) => {
      const sitio = sitioDe(p.posicion, null);
      return {
        clave: `plantilla:${p.id}`,
        nombre: p.nombre,
        foto: p.foto,
        puesto: sitio.puesto,
        lado: sitio.lado,
        posicion: p.posicion,
        altura: null,
        pie: "",
        minutos: 0,
        wyscout: null,
      };
    });
  return [...deWyscout, ...sinWyscout];
}

/** Los suyos: la plantilla de la hoja RIVALES, cada uno con su fila de Wyscout si se encuentra. */
export function suyosDe(filasHoja: Fila[], equipo: string, jugadores: FilaJugador[]): JugadorDuelo[] {
  const filasWy = jugadores.filter((j) => j.temporada === "actual" && mismoClub(j.equipo, equipo));
  return filasHoja
    .filter((f) => texto(f.NOMBRE_EQUIPO) === equipo)
    .map((f) => {
      const nombre = comoNombre(texto(f["NOMBRE DEPORTIVO"]) || texto(f.JUGADOR));
      const wy =
        casaNombre(nombre, filasWy, (r) => r.jugador) ??
        (texto(f.JUGADOR) && texto(f.JUGADOR) !== nombre ? casaNombre(comoNombre(texto(f.JUGADOR)), filasWy, (r) => r.jugador) : null);
      const sitio = sitioDe(texto(f["POSICIÓN"]), wy?.posicion ?? null);
      return {
        clave: playerKey(f as never),
        nombre,
        foto: texto(f.FOTO) || undefined,
        dorsal: texto(f.DORSAL),
        puesto: sitio.puesto,
        lado: sitio.lado,
        posicion: wy?.posicion.split(",")[0] || texto(f["POSICIÓN"]),
        altura: alturaEnCm(wy?.altura || f.ALTURA),
        pie: wy?.pie || texto(f["PIE DOMINANTE"]),
        minutos: wy?.minutos ?? 0,
        wyscout: wy,
      };
    });
}

/** Su once de partida: el marcado, su último once o los de más minutos. */
export function baseSuyaDe(suyos: JugadorDuelo[], marcados: string[] | null, informe: InformeEquipo | null) {
  const porClave = new Map(suyos.map((j) => [j.clave, j]));
  const deLaMarca = (marcados ?? []).map((k) => porClave.get(k)).filter((j): j is JugadorDuelo => Boolean(j));
  if (deLaMarca.length >= 7) return { lista: deLaMarca, fuente: "Once probable marcado en Plantillas rivales" };
  const ultimo = informe?.onces?.find((o) => o.jugadores.length > 0);
  if (ultimo) {
    const lista = ultimo.jugadores.map((u) => casaNombre(u.nombre, suyos, (j) => j.nombre)).filter((j): j is JugadorDuelo => Boolean(j));
    if (lista.length >= 7) return { lista, fuente: `Su último once en BeSoccer (${ultimo.estructura || "sin dibujo"}): nadie ha marcado el once probable` };
  }
  return { lista: suyos, fuente: "Los de más minutos: no hay once marcado ni alineaciones de BeSoccer" };
}

const candidato = (j: JugadorDuelo) => ({
  id: j.clave,
  sitio: { puesto: j.puesto, lado: j.lado, segun: "wyscout" as const, wyscout: "", hoja: "" },
  minutos: j.minutos,
});

/*
| Lo puesto a mano se le pasa a `proponeOnce`, que lo reserva y rellena
| alrededor: así el mismo jugador no puede quedar en dos huecos. Un hueco
| vaciado a mano (`HUECO_VACIO`) se queda vacío.
*/
export function armaOnce(candidatos: JugadorDuelo[], todos: JugadorDuelo[], manual: Record<string, string>) {
  const elegidos = Object.fromEntries(Object.entries(manual).filter(([, c]) => c !== HUECO_VACIO));
  const conElegidos = [...candidatos, ...todos.filter((j) => Object.values(elegidos).includes(j.clave) && !candidatos.includes(j))];
  const huecos = proponeOnce(conElegidos.map(candidato), elegidos);
  const porClave = new Map(todos.map((j) => [j.clave, j]));
  return Object.fromEntries(
    HUECOS.map((h) => [h.clave, manual[h.clave] === HUECO_VACIO ? undefined : porClave.get(huecos[h.clave])]),
  ) as Record<string, JugadorDuelo | undefined>;
}

export const onceNuestroDe = (nuestros: JugadorDuelo[], manual: Record<string, string>) =>
  armaOnce(
    nuestros.filter((j) => j.wyscout),
    nuestros,
    manual,
  );

/** Su base va primero (le sobran minutos) y el resto de la plantilla completa los huecos que falten. */
export function onceSuyoDe(suyos: JugadorDuelo[], base: JugadorDuelo[], manual: Record<string, string>) {
  const enBase = new Set(base.map((j) => j.clave));
  const ordenados = suyos.map((j) => (enBase.has(j.clave) ? { ...j, minutos: j.minutos + 1e6 } : j));
  const resultado = armaOnce(ordenados, ordenados, manual);
  const porClave = new Map(suyos.map((j) => [j.clave, j]));
  return Object.fromEntries(Object.entries(resultado).map(([h, j]) => [h, j ? porClave.get(j.clave) : undefined])) as Record<
    string,
    JugadorDuelo | undefined
  >;
}

/** Todo de una vez, para quien no tiene pantalla (el informe). */
export function duelosDelPartido(entrada: {
  jugadores: FilaJugador[];
  fichas: FichaPropia[];
  filasHoja: Fila[];
  equipo: string;
  marcados: string[] | null;
  informe: InformeEquipo | null;
  aMano: DuelosDoc;
}): { duelos: ResultadoDuelo[]; fuenteSuya: string } {
  const nuestros = nuestrosDe(entrada.jugadores, entrada.fichas);
  const suyos = suyosDe(entrada.filasHoja, entrada.equipo, entrada.jugadores);
  const base = baseSuyaDe(suyos, entrada.marcados, entrada.informe);
  const referencias = referenciasPorPuesto(entrada.jugadores);
  return {
    duelos: mideDuelos(onceNuestroDe(nuestros, entrada.aMano.nuestro), onceSuyoDe(suyos, base.lista, entrada.aMano.suyo), referencias),
    fuenteSuya: base.fuente,
  };
}
