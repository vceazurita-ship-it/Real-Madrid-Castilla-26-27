/**
 * EL CAMBIO A MITAD DE TAREA (08/10/2026).
 *
 * Una tarea puede tener dos momentos: el inicio y «tras el cambio». Lo segundo
 * guarda sólo lo que se mueve —dónde está cada jugador (`sitio`) y cómo se
 * colocan los equipos (`orden`, `posiciones`, `pares`)—; los nombres, colores,
 * estructuras y comodines son los mismos en los dos momentos.
 *
 * La pantalla edita «tras el cambio» con las mismas herramientas que el
 * inicio: `vistaCambio` monta la tarea como si fuera ése su reparto y
 * `guardaVistaCambio` devuelve lo editado a su sitio sin tocar el inicio.
 * `cambiosDe` cuenta quién se mueve, para la pantalla y la diapositiva.
 */
import { colocaEnEstructura, lineasDe, parejasDe } from "@/lib/sesion-equipos/estructura";
import {
  COMODIN,
  FUERA,
  repartoDe,
  yNombres,
  type FaseCambio,
  type JugadorSesion,
  type PuestoDe,
  type Sitio,
  type TareaEquipos,
} from "@/lib/sesion-equipos/modelo";

export type Fase = "inicio" | "cambio";

/** Lo que guarda de la tarea el momento «tras el cambio», copiado del inicio. */
export function creaCambio(t: TareaEquipos): TareaEquipos {
  return {
    ...t,
    cambio: {
      sitio: { ...t.sitio },
      equipos: Object.fromEntries(t.equipos.map((e) => [e.id, { orden: e.orden, posiciones: e.posiciones, pares: e.pares, autoOrden: e.autoOrden }])),
    },
  };
}

/** Quita el cambio: la tarea vuelve a tener un solo momento. */
export function quitaCambio(t: TareaEquipos): TareaEquipos {
  const { cambio: _fuera, ...resto } = t;
  void _fuera;
  return resto;
}

/** La tarea tal y como queda tras el cambio (sin cambio, la misma). */
export function vistaCambio(t: TareaEquipos): TareaEquipos {
  if (!t.cambio) return t;
  const c = t.cambio;
  return {
    ...t,
    sitio: c.sitio,
    equipos: t.equipos.map((e) => {
      const f = c.equipos[e.id] ?? {};
      return { ...e, orden: f.orden, posiciones: f.posiciones, pares: f.pares, autoOrden: f.autoOrden };
    }),
  };
}

/** Lo editado sobre la vista «tras el cambio», devuelto a la tarea sin tocar el inicio. */
export function guardaVistaCambio(base: TareaEquipos, vista: TareaEquipos): TareaEquipos {
  const cambio: FaseCambio = {
    sitio: vista.sitio,
    equipos: Object.fromEntries(vista.equipos.map((e) => [e.id, { orden: e.orden, posiciones: e.posiciones, pares: e.pares }])),
  };

  return {
    ...vista,
    sitio: base.sitio,
    equipos: vista.equipos.map((e) => {
      const b = base.equipos.find((x) => x.id === e.id);
      /* Si el dibujo cambió de líneas, el orden del inicio ya no vale. */
      const mismoDibujo = b && lineasDe(b.estructura).join("-") === lineasDe(e.estructura).join("-");
      return { ...e, orden: mismoDibujo ? b?.orden : undefined, posiciones: mismoDibujo ? b?.posiciones : undefined, pares: b?.pares };
    }),
    cambio,
  };
}

export type CambioJugador = { jugador: JugadorSesion; texto: string };

/** Dónde está cada uno dentro de su equipo: el hueco del dibujo y con quién comparte puesto. */
function sitiosDe(t: TareaEquipos, jugadores: JugadorSesion[], puestoDe: PuestoDe, preferido?: (j: JugadorSesion) => { x: number; y: number }) {
  const reparto = repartoDe(t, jugadores);
  /* `con`: los demás del mismo puesto (desde el 07/11/2026 pueden ser varios). */
  const porJugador = new Map<string, { hueco: number | null; con: JugadorSesion[] }>();
  /* Quién ocupa cada hueco de cada equipo. */
  const ocupantes = new Map<string, (JugadorSesion | null)[]>();

  for (const e of t.equipos) {
    const suyos = reparto.porEquipo[e.id] ?? [];
    const parejas = parejasDe(suyos, e.pares);

    if (t.conEstructura) {
      const { huecos } = colocaEnEstructura(suyos, e.estructura, puestoDe, e.orden, e.posiciones, e.pares, preferido);
      ocupantes.set(e.id, huecos.map((h) => h.jugador));
      huecos.forEach((h, i) => {
        if (!h.jugador) return;
        const todos = [h.jugador, ...(h.companeros ?? [])];
        for (const j of todos) porJugador.set(j.id, { hueco: i, con: todos.filter((x) => x.id !== j.id) });
      });
    }

    for (const [titular, companeros] of parejas) {
      const tit = suyos.find((j) => j.id === titular);
      const todos = tit ? [tit, ...companeros] : companeros;
      for (const j of todos) if (!porJugador.has(j.id)) porJugador.set(j.id, { hueco: null, con: todos.filter((x) => x.id !== j.id) });
    }
  }

  return { porJugador, ocupantes };
}

/** Quién se mueve en el cambio y a dónde, en una frase por jugador. */
export function cambiosDe(t: TareaEquipos, jugadores: JugadorSesion[], puestoDe: PuestoDe, preferido?: (j: JugadorSesion) => { x: number; y: number }): CambioJugador[] {
  if (!t.cambio) return [];

  const despues = vistaCambio(t);
  const antes = sitiosDe(t, jugadores, puestoDe, preferido);
  const luego = sitiosDe(despues, jugadores, puestoDe, preferido);

  const nombreDe = (s: Sitio | undefined) =>
    !s ? "sin colocar" : s === COMODIN ? "comodín" : s === FUERA ? "fuera" : (t.equipos.find((e) => e.id === s)?.nombre ?? "otro equipo");

  const salida: CambioJugador[] = [];

  for (const j of jugadores) {
    const de = t.sitio[j.id];
    const a = despues.sitio[j.id];
    const ya = antes.porJugador.get(j.id);
    const ahora = luego.porJugador.get(j.id);
    const partes: string[] = [];

    /* El sitio al que llega dentro del dibujo, dicho por quién lo ocupaba al empezar. */
    const ocupante = a && ahora?.hueco != null ? antes.ocupantes.get(a)?.[ahora.hueco] : null;
    const donde = ocupante && ocupante.id !== j.id ? `al sitio de ${ocupante.nombre}` : "";

    if (de !== a) partes.push(`${nombreDe(de)} → ${nombreDe(a)}${donde ? ` (${donde})` : ""}`);
    else if (ya?.hueco != null && ahora?.hueco != null && ya.hueco !== ahora.hueco) partes.push(donde ? `cambia de sitio, ${donde}` : "cambia de sitio");

    const claveCon = (c?: JugadorSesion[]) => (c ?? []).map((x) => x.id).sort().join(",");
    const nombres = (c: JugadorSesion[]) => yNombres(c.map((x) => x.nombre));

    if (claveCon(ya?.con) !== claveCon(ahora?.con)) {
      if (ahora?.con.length) partes.push(`comparte puesto con ${nombres(ahora.con)}`);
      else if (ya?.con.length) partes.push(`deja de compartir con ${nombres(ya.con)}`);
    }

    if (partes.length) salida.push({ jugador: j, texto: partes.join(" · ") });
  }

  return salida;
}
