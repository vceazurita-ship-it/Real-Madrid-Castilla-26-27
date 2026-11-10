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
import { conTildes } from "@/lib/rivals/tildes";
import { bajaDe } from "@/lib/rivals/bajas";
import { nombrePuesto } from "@/lib/posiciones";
import type { InformeEquipo } from "@/lib/rivals/informe";
import {
  HUECO_VACIO,
  alturaEnCm,
  conApellidosClaros,
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
      fichaId: ficha?.id,
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
        fichaId: p.id,
      };
    });
  return conApellidosClaros([...deWyscout, ...sinWyscout]);
}

/** Los suyos: la plantilla de la hoja RIVALES, cada uno con su fila de Wyscout si se encuentra. */
export function suyosDe(filasHoja: Fila[], equipo: string, jugadores: FilaJugador[]): JugadorDuelo[] {
  const filasWy = jugadores.filter((j) => j.temporada === "actual" && mismoClub(j.equipo, equipo));
  return filasHoja
    .filter((f) => texto(f.NOMBRE_EQUIPO) === equipo)
    .map((f) => {
      const nombre = conTildes(comoNombre(texto(f["NOMBRE DEPORTIVO"]) || texto(f.JUGADOR)));
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
        puestoHoja: nombrePuesto(texto(f["POSICIÓN"])).toLowerCase() || undefined,
        altura: alturaEnCm(wy?.altura || f.ALTURA),
        pie: wy?.pie || texto(f["PIE DOMINANTE"]),
        minutos: wy?.minutos ?? 0,
        wyscout: wy,
        baja: bajaDe(f) ?? undefined,
      };
    });
}

/** Lesionado o sancionado: no entra solo en el once (sí si alguien lo pone a mano). */
const fuera = (j: JugadorDuelo) => j.baja === "lesionado" || j.baja === "sancionado";

/** Su once de partida: el marcado, su último once o los de más minutos. */
export function baseSuyaDe(suyos: JugadorDuelo[], marcados: string[] | null, informe: InformeEquipo | null) {
  const porClave = new Map(suyos.map((j) => [j.clave, j]));
  /*
  | 08/11/2026 (jueces, ronda 14): el once marcado llevaba a Yago Cantero, con
  | la etiqueta «Lesionado» en su ficha, y la pizarra lo colocaba. Los de baja
  | salen de la base y se dice quién y por qué; su hueco lo rellena el motor.
  */
  const sinBajas = (lista: JugadorDuelo[]) => lista.filter((j) => !fuera(j));
  const nota = (lista: JugadorDuelo[]) => {
    const quitados = lista.filter(fuera);
    return quitados.length ? `, sin ${quitados.map((j) => `${j.nombre} (${j.baja})`).join(" ni ")}` : "";
  };
  const deLaMarca = (marcados ?? []).map((k) => porClave.get(k)).filter((j): j is JugadorDuelo => Boolean(j));
  if (deLaMarca.length >= 7) return { lista: sinBajas(deLaMarca), fuente: `Once probable marcado en Plantillas rivales${nota(deLaMarca)}` };
  const ultimo = informe?.onces?.find((o) => o.jugadores.length > 0);
  if (ultimo) {
    const lista = ultimo.jugadores.map((u) => casaNombre(u.nombre, suyos, (j) => j.nombre)).filter((j): j is JugadorDuelo => Boolean(j));
    if (lista.length >= 7) return { lista: sinBajas(lista), fuente: `Su último once en BeSoccer (${ultimo.estructura || "sin dibujo"})${nota(lista)}: nadie ha marcado el once probable` };
  }
  return { lista: sinBajas(suyos), fuente: "Los de más minutos: no hay once marcado ni alineaciones de BeSoccer" };
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

/**
 * Nuestro once. Sin `base`, el propuesto con los minutos de Wyscout. Con
 * `base` —hueco → id de ficha, el último once de Valoraciones que también usa
 * la pizarra (`huecosDelUltimoOnce`)— arranca de ése, y lo cambiado a mano
 * manda sobre él (23/10/2026: Duelos y la pizarra proponían dos onces
 * distintos para el mismo partido).
 */
export const onceNuestroDe = (
  nuestros: JugadorDuelo[],
  manual: Record<string, string>,
  base?: Record<string, string> | null,
  /** La plantilla: si el id de la base no casa (los JUG-XX se renumeran), se resuelve por nombre. */
  fichas: FichaPropia[] = [],
) => {
  if (!base || Object.keys(base).length === 0) {
    return armaOnce(
      nuestros.filter((j) => j.wyscout),
      nuestros,
      manual,
    );
  }

  const porFicha = new Map(nuestros.filter((j) => j.fichaId).map((j) => [j.fichaId as string, j.clave]));
  const aMano = new Set(Object.values(manual).filter((c) => c !== HUECO_VACIO));

  const deLaBase: Record<string, string> = {};

  for (const [hueco, fichaId] of Object.entries(base)) {
    const ficha = fichas.find((f) => f.id === fichaId);
    const clave =
      porFicha.get(fichaId) ??
      (ficha ? (casaNombre(ficha.nombre, nuestros, (j) => j.nombre) ?? casaNombre(ficha.apodo ?? "", nuestros, (j) => j.nombre))?.clave : undefined);

    if (clave && !(hueco in manual) && !aMano.has(clave)) deLaBase[hueco] = clave;
  }

  return armaOnce(
    nuestros.filter((j) => j.wyscout),
    nuestros,
    { ...deLaBase, ...manual },
  );
};

/** Su base va primero (le sobran minutos) y el resto de la plantilla completa los huecos que falten. */
/*
| A qué huecos puede ir cada puesto cuando el suyo está lleno, del más al menos
| natural. Los dos primeros son «su sitio»; más allá, el jugador está fuera de
| sitio y el duelo de ese hueco no se mide (10/11/2026, jueces).
*/
const AFINES: Record<string, string[]> = {
  POR: ["POR"],
  CEN: ["CEN", "LAT", "MED"],
  LAT: ["LAT", "BAN", "CEN"],
  MED: ["MED", "BAN", "CEN"],
  BAN: ["BAN", "DEL", "LAT", "MED"],
  DEL: ["DEL", "BAN"],
};

/** `true` si el jugador ocupa un hueco que no es de su puesto ni de uno vecino (un central en la banda). */
export function fueraDeSitio(j: JugadorDuelo | undefined, hueco: string) {
  const h = HUECOS.find((x) => x.clave === hueco);

  if (!j || !h) return false;

  return !(AFINES[j.puesto] ?? [j.puesto]).slice(0, 2).includes(h.puesto);
}

/*
| Coloca SÓLO a los de la base (10/11/2026, jueces). Antes la base subía un
| millón de minutos pero competía con todos en cada pasada: en la tercera
| («su puesto, aunque sea del otro lado») un extremo de fuera de la base ganaba
| la banda a un titular que no era extremo, y el once marcado en Plantillas
| (3-5-2 con Fran Gil y Pere Marco) salía con Ramírez y Shinno. Ahora los
| titulares van primero a su puesto, luego a uno afín y al final a lo que
| quede; sólo si faltan titulares (bajas) entra alguien de fuera.
*/
function colocaBase(base: JugadorDuelo[], reservados: Record<string, string>) {
  const puestos: Record<string, string> = { ...reservados };
  const usados = new Set(Object.values(reservados));
  const rellena = (vale: (hueco: (typeof HUECOS)[number], j: JugadorDuelo) => boolean) => {
    for (const hueco of HUECOS) {
      if (puestos[hueco.clave]) continue;
      const elegido = base.filter((j) => !usados.has(j.clave) && vale(hueco, j)).sort((a, b) => b.minutos - a.minutos)[0];
      if (elegido) {
        puestos[hueco.clave] = elegido.clave;
        usados.add(elegido.clave);
      }
    }
  };
  rellena((h, j) => j.puesto === h.puesto && j.lado === h.lado);
  rellena((h, j) => j.puesto === h.puesto && (h.lado === "C" || j.lado === "C" || j.lado === h.lado));
  rellena((h, j) => j.puesto === h.puesto);
  for (let k = 1; k < 4; k++) rellena((h, j) => (AFINES[j.puesto] ?? [])[k] === h.puesto);
  rellena(() => true);
  return puestos;
}

export function onceSuyoDe(suyos: JugadorDuelo[], base: JugadorDuelo[], manual: Record<string, string>) {
  const enBase = new Set(base.map((j) => j.clave));
  /* Los de baja, al fondo: sólo entran si no queda nadie más para su hueco o si se ponen a mano. */
  const ordenados = suyos.map((j) => (enBase.has(j.clave) ? { ...j, minutos: j.minutos + 1e6 } : fuera(j) ? { ...j, minutos: j.minutos - 1e6 } : j));
  const elegidos = Object.fromEntries(Object.entries(manual).filter(([, c]) => c !== HUECO_VACIO && suyos.some((j) => j.clave === c)));
  const vaciados = Object.fromEntries(Object.entries(manual).filter(([, c]) => c === HUECO_VACIO));
  /* Los vaciados a mano se reservan con su marca: no los rellena nadie. */
  const deLaBase = colocaBase(base.filter((j) => !Object.values(elegidos).includes(j.clave)), { ...elegidos, ...vaciados });
  const llenos = Object.fromEntries(Object.entries(deLaBase).filter(([, c]) => c !== HUECO_VACIO));
  const resultado = armaOnce(ordenados, ordenados, { ...llenos, ...vaciados });
  const porClave = new Map(suyos.map((j) => [j.clave, j]));
  return Object.fromEntries(Object.entries(resultado).map(([h, j]) => [h, j ? porClave.get(j.clave) : undefined])) as Record<
    string,
    JugadorDuelo | undefined
  >;
}

/**
 * Los duelos que tienen pareja de verdad (10/11/2026, jueces). Si en el hueco
 * del rival hay alguien fuera de sitio —el tercer central de un 3-5-2 en la
 * banda—, ese duelo no existe en el campo y no se mide: «nuestro lateral
 * contra su extremo» con un central enfrente sacaba conclusiones absurdas.
 */
export function separaSinPareja(duelos: ResultadoDuelo[], onceSuyo: Record<string, JugadorDuelo | undefined>) {
  const sinSitio = new Set(Object.entries(onceSuyo).filter(([h, j]) => fueraDeSitio(j, h)).map(([h]) => h));
  const conPareja = duelos.filter((d) => !d.def.suyos.some((h) => sinSitio.has(h)));
  const fueraDeSitioEn = [...sinSitio].map((h) => ({ hueco: h, jugador: onceSuyo[h]! }));
  return { conPareja, fueraDeSitioEn };
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
  /** Nuestro último once de Valoraciones (hueco → id de ficha), si se conoce. */
  baseNuestra?: Record<string, string> | null;
}): { duelos: ResultadoDuelo[]; fuenteSuya: string } {
  const nuestros = nuestrosDe(entrada.jugadores, entrada.fichas);
  const suyos = suyosDe(entrada.filasHoja, entrada.equipo, entrada.jugadores);
  const base = baseSuyaDe(suyos, entrada.marcados, entrada.informe);
  const referencias = referenciasPorPuesto(entrada.jugadores);
  const onceSuyo = onceSuyoDe(suyos, base.lista, entrada.aMano.suyo);
  return {
    duelos: separaSinPareja(mideDuelos(onceNuestroDe(nuestros, entrada.aMano.nuestro, entrada.baseNuestra, entrada.fichas), onceSuyo, referencias), onceSuyo).conPareja,
    fuenteSuya: base.fuente,
  };
}
