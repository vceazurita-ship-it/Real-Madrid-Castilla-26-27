/**
 * EL JUGADOR RIVAL EN LOS DATOS DE WYSCOUT (21/10/2026).
 *
 * La ficha de BeSoccer dice cuánto juega (partidos, minutos, goles); no dice
 * **cómo** juega. Las descargas de Wyscout de toda la categoría que alimentan
 * DATA sí lo dicen, y con un criterio que ya está acordado allí: cada métrica
 * en **percentil contra los de su mismo puesto en la categoría**, esta
 * temporada y con al menos 90′ (`MINUTOS_MINIMOS`). Comparar a un central con
 * todos sólo descubre que es central.
 *
 * Se parte en dos mitades a propósito:
 * - `perfilesDeEquipo` corre **en el servidor** (`/api/data-analisis?perfiles=`):
 *   el dataset entero son megas y la ficha se abre a veces desde el móvil.
 *   Sale una lista corta, una entrada por jugador de ese club en Wyscout.
 * - `asignaPerfiles` corre en la pantalla: casa las fichas de la hoja RIVALES con
 *   su entrada por nombre (`casaNombre`, como Duelos), uno a uno.
 *
 * Lo que más le separa de sus iguales sale de `fuertesYFlojos` de DATA, que ya
 * descarta los porcentajes de pocas acciones. Y aquí sólo se enseña lo que
 * separa de verdad: por encima del 70 o por debajo del 30.
 */
import type { FilaJugador } from "@/lib/data-analisis/leer";
import {
  MINUTOS_MINIMOS,
  PUESTOS,
  fuertesYFlojos,
  puestoDe,
  type Puesto,
} from "@/lib/data-analisis/individual";
import type { Unidad } from "@/lib/data-analisis/metricas";
import { casaNombre } from "@/lib/data-analisis/once";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { normalizePlayerName } from "@/lib/playerImages";

/** Sólo cuenta como «destaca» por encima de esto, y como «flojea» por debajo del espejo. */
export const PERCENTIL_FUERTE = 70;
export const PERCENTIL_FLOJO = 30;

/** Con menos iguales que éstos, un percentil no es una referencia. */
const IGUALES_MINIMOS = 8;

/*
| Y para sacarle perfil a UNO, tres partidos enteros (21/10/2026).
|
| Los 90′ de DATA son el suelo para entrar en la comparación de los demás; para
| leer a un jugador concreto no bastan: con 114′ un central salía en el p1 de
| «pase progresivo» por no haber dado ninguno en dos ratos. Por debajo de esto
| se enseña cuánto lleva y no se le juzga.
*/
export const MINUTOS_PARA_LEER = 270;

/*
| Lo que no es una virtud aunque «más» sea «mejor» (21/10/2026): que le hagan
| faltas es la factura de otra cosa —conducir, aguantar de espaldas— y como
| «Destaca en» se leía como un rasgo del jugador. Ya lo pidió quitar el experto
| de análisis en la previa (ronda 11). Por abajo sí cuenta su espejo, las que
| comete.
*/
const NO_ES_FORTALEZA = new Set(["Faltas recibidas/90"]);

/*
| Un percentil sobre uno o dos casos no es un rasgo (21/10/2026).
|
| «Goles de cabeza 0,14 · p90» en un central de 623′ es UN gol: con eso sale
| por delante del 90 % de los centrales y en verde, con el mismo peso que algo
| que repite cada partido. Las métricas «por 90′» se vuelven a contar en casos
| (valor × minutos / 90) y con menos de éstos no entran ni por arriba ni por
| abajo. Lo pidió el experto de análisis.
|
| Y la misma cifra dos veces no es un fallo de lectura: Carmona lleva 13
| faltas hechas y 13 recibidas en 623′ (1,88 las dos). Se comprobó contra el
| .xlsx: son dos columnas distintas y 35 de 295 jugadores con 270′ repiten la
| pareja por pura coincidencia. Por eso el rasgo lleva sus casos: «13 en 623′»
| deja ver que son dos recuentos, no uno copiado.
*/
export const CASOS_MINIMOS = 3;

export type RasgoWyscout = {
  nombre: string;
  valor: number;
  unidad: Unidad;
  percentil: number;
  comoLeer: string;
  /** `false` cuando menos es mejor (faltas cometidas, pérdidas): el percentil ya va al revés. */
  mejorAlto: boolean;
  /** Cuántas veces en la temporada, si la métrica es «por 90′»; `null` en porcentajes. */
  casos: number | null;
};

export type PerfilWyscout = {
  /** Cómo le llama Wyscout, por si no coincide con la hoja. */
  jugador: string;
  /** La sigla de Wyscout («LCB»). */
  posicion: string;
  /** La misma, en palabras de caseta («central izquierdo»); vacía si no hay equivalencia. */
  posicionTexto: string;
  puesto: Puesto;
  puestoLabel: string;
  partidos: number;
  minutos: number;
  /** Contra cuántos de su puesto se le compara. */
  iguales: number;
  /** Con menos de 270′ no se le saca perfil: las cifras serían extrapolaciones. */
  muestraCorta: boolean;
  fuertes: RasgoWyscout[];
  flojos: RasgoWyscout[];
};

export type PerfilesDeEquipo = {
  /** La jornada más alta que lleva alguien de la categoría en la descarga. */
  partidosDeLaCategoria: number;
  perfiles: PerfilWyscout[];
};

type Candidato = {
  metrica: { nombre: string; unidad: Unidad; comoLeer: string; columna: string; mejorAlto: boolean | null };
  valor: number;
  percentil: number;
};

/** Los casos de la temporada de una métrica «por 90′». */
const casosDe = (c: Candidato, minutos: number) =>
  c.metrica.columna.endsWith("/90") ? Math.round((c.valor * minutos) / 90) : null;

const rasgo = (c: Candidato, minutos: number): RasgoWyscout => ({
  nombre: c.metrica.nombre,
  valor: c.valor,
  unidad: c.metrica.unidad,
  percentil: c.percentil,
  comoLeer: c.metrica.comoLeer,
  mejorAlto: c.metrica.mejorAlto !== false,
  casos: casosDe(c, minutos),
});

/** Con un caso o dos, el percentil no dice nada de él. */
const conCasos = (minutos: number) => (c: Candidato) => {
  const casos = casosDe(c, minutos);

  return casos === null || casos >= CASOS_MINIMOS;
};

/**
 * En el servidor: los de un club, cada uno contra los de su puesto en la categoría.
 *
 * `traducePuesto` pasa la sigla de Wyscout a palabras. Se recibe de fuera para
 * que este archivo, que también usa la pantalla, no arrastre al navegador el
 * módulo del informe donde vive la tabla.
 */
export function perfilesDeEquipo(
  jugadores: FilaJugador[],
  equipo: string,
  traducePuesto: (sigla: string) => string = () => "",
): PerfilesDeEquipo {
  const actuales = jugadores.filter((j) => j.temporada === "actual");

  const suyos = actuales.filter((j) => j.minutos > 0 && mismoClub(j.equipo, equipo));

  const igualesDe = new Map<Puesto, FilaJugador[]>();

  for (const j of actuales) {
    if (j.minutos < MINUTOS_MINIMOS) continue;
    const p = puestoDe(j.posicion);
    igualesDe.set(p, [...(igualesDe.get(p) ?? []), j]);
  }

  const perfiles = suyos.map((fila): PerfilWyscout => {
    const puesto = puestoDe(fila.posicion);
    const iguales = igualesDe.get(puesto) ?? [];

    const sigla = fila.posicion.split(",")[0].trim();

    const base = {
      jugador: fila.jugador,
      posicion: sigla,
      posicionTexto: traducePuesto(sigla),
      puesto,
      puestoLabel: PUESTOS.find((p) => p.key === puesto)?.label ?? puesto,
      partidos: fila.partidos,
      minutos: Math.round(fila.minutos),
      iguales: iguales.length,
    };

    if (fila.minutos < MINUTOS_PARA_LEER || iguales.length < IGUALES_MINIMOS) {
      return { ...base, muestraCorta: true, fuertes: [], flojos: [] };
    }

    /*
    | De todas las métricas, no sólo de las cuatro de cada punta: quitar las de
    | un caso dejaba la columna vacía cuando las cuatro de arriba eran rarezas.
    */
    const { todas } = fuertesYFlojos(fila, iguales, puesto);
    const validas = todas.filter(conCasos(fila.minutos));
    const minutos = Math.round(fila.minutos);

    return {
      ...base,
      muestraCorta: false,
      fuertes: [...validas]
        .sort((a, b) => b.percentil - a.percentil)
        .filter((f) => f.percentil >= PERCENTIL_FUERTE && !NO_ES_FORTALEZA.has(f.metrica.columna))
        .slice(0, 3)
        .map((f) => rasgo(f, minutos)),
      flojos: [...validas]
        .sort((a, b) => a.percentil - b.percentil)
        .filter((f) => f.percentil <= PERCENTIL_FLOJO)
        .slice(0, 3)
        .map((f) => rasgo(f, minutos)),
    };
  });

  return {
    partidosDeLaCategoria: Math.max(0, ...actuales.map((j) => j.partidos)),
    perfiles,
  };
}

type FilaHoja = { JUGADOR?: unknown; "NOMBRE DEPORTIVO"?: unknown };

const texto = (v: unknown) => String(v ?? "").trim();

/** La hoja escribe muchos nombres en mayúsculas («CARLOS LAZO»): como los de Wyscout. */
const comoNombre = (t: string) =>
  t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s\-'.])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : t;

const nombresDe = (jugador: FilaHoja) =>
  [comoNombre(texto(jugador["NOMBRE DEPORTIVO"])), comoNombre(texto(jugador.JUGADOR))].filter(
    (nombre, i, todos) => nombre && todos.indexOf(nombre) === i,
  );

/*
| ¿Pueden ser la misma persona? `casaNombre` casa por apellido cuando hay un
| solo candidato con él, y eso en una plantilla no basta: el Antequera tiene a
| Samu, Iván y Fer Pérez y Wyscout sólo a Iván, así que los tres salían con los
| datos de Iván. Si los dos traen nombre de pila, la inicial tiene que ser la
| misma («J. Lazo» sí es Javier Lazo; «Carlos Abad» no es Javier Rentero).
*/
function mismaInicial(uno: string, otro: string) {
  const a = normalizePlayerName(uno).split(" ");
  const b = normalizePlayerName(otro).split(" ");

  if (a.length < 2 || b.length < 2) return true;

  return a[0].charAt(0) === b[0].charAt(0);
}

/**
 * En la pantalla: a cada ficha de la plantilla, su entrada de Wyscout.
 *
 * Se resuelve **la plantilla entera a la vez** y uno a uno, porque una entrada
 * de Wyscout es una persona: primero los nombres idénticos, luego por
 * apellido con la misma inicial, y si dos fichas siguen reclamando la misma
 * entrada no se le da a ninguna. Mejor una ficha sin datos que una con los de
 * su compañero.
 */
export function asignaPerfiles<T extends FilaHoja>(
  fichas: T[],
  perfiles: PerfilWyscout[],
  clave: (ficha: T) => string,
): Map<string, PerfilWyscout> {
  const asignados = new Map<string, PerfilWyscout>();

  if (!perfiles.length) return asignados;

  const usados = new Set<string>();

  /* 1. Idénticos, con el nombre deportivo o con el completo. */
  for (const ficha of fichas) {
    const nombres = nombresDe(ficha).map(normalizePlayerName);
    const exacto = perfiles.find((p) => !usados.has(p.jugador) && nombres.includes(normalizePlayerName(p.jugador)));

    if (exacto) {
      asignados.set(clave(ficha), exacto);
      usados.add(exacto.jugador);
    }
  }

  /* 2. Por apellido, entre los que quedan, y sólo si nadie más lo reclama. */
  const libres = perfiles.filter((p) => !usados.has(p.jugador));
  const reclamos = new Map<string, { ficha: T; perfil: PerfilWyscout }[]>();

  for (const ficha of fichas) {
    if (asignados.has(clave(ficha))) continue;

    let perfil: PerfilWyscout | null = null;

    for (const nombre of nombresDe(ficha)) {
      const candidato = casaNombre(nombre, libres, (p) => p.jugador);

      if (candidato && mismaInicial(nombre, candidato.jugador)) {
        perfil = candidato;
        break;
      }
    }

    if (perfil) reclamos.set(perfil.jugador, [...(reclamos.get(perfil.jugador) ?? []), { ficha, perfil }]);
  }

  for (const lista of reclamos.values()) {
    if (lista.length === 1) asignados.set(clave(lista[0].ficha), lista[0].perfil);
  }

  return asignados;
}
