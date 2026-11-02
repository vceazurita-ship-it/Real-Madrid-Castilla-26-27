/*
|--------------------------------------------------------------------------
| LO QUE APRENDE LA HERRAMIENTA DE CÓMO COLOCA EL CUERPO TÉCNICO (14/10/2026)
|--------------------------------------------------------------------------
|
| Cada vez que alguien coloca a un jugador a mano en el dibujo de un equipo
| (lo arrastra a un hueco, lo cambia por otro o lo suelta en un punto del
| césped), ese sitio queda guardado en la sesión. Aquí se leen TODAS las
| sesiones guardadas y, por jugador (cruzado por nombre: el id cambia de una
| sesión a otra), se saca el sitio medio donde lo pone el cuerpo técnico,
| con más peso lo reciente (media vida de 45 días).
|
| Sólo cuenta lo hecho a mano: lo que coloca la herramienta sola (al formar
| el equipo o al cambiar de dibujo, `autoOrden`) no se aprende, para que no
| aprenda de sí misma.
|
| Se usa en dos sitios:
|   - en la pantalla, para proponer el hueco de cada uno (`puntoPreferido`);
|   - en `scripts/jugadores-sesion-aprendizaje.mjs`, que lo deja escrito en
|     `jugadores-sesion:aprendizaje` para consultarlo (y para que Claude lo
|     use cuando le pidan colocar a los jugadores directamente).
*/

import { claveNombre, type AlmacenEquipos, type EquipoTarea, type JugadorSesion } from "@/lib/sesion-equipos/modelo";
import { conPortero, lineasDe } from "@/lib/sesion-equipos/estructura";
import { demarcacion, demarcacionCercana, puntosDeLineas, type Aprendido, type Demarcacion, type Punto } from "@/lib/sesion-equipos/demarcacion";

export type PerfilAprendido = Aprendido & {
  nombre: string;
  /** La última sesión en que se le colocó a mano («AAAA-MM-DD»). */
  ultima?: string;
  /**
   * La demarcación aprendida (02/11/2026): la que más se le ha puesto a mano
   * en las sesiones (lo reciente pesa más) o, si nunca se le puso, la más
   * cercana a donde se le coloca en el dibujo (dos veces o más).
   */
  demarcacion?: Demarcacion;
  /** Cuántas sesiones se le ha puesto la demarcación a mano. */
  aMano?: number;
};

/**
 * Una demarcación puesta a mano en una sesión vale por tantas colocaciones en
 * el dibujo: el cuerpo técnico ha dicho dónde juega, no lo ha soltado de paso.
 */
const PESO_DEMARCACION_A_MANO = 3;

const puntoValido = (p: Punto | null | undefined): p is Punto =>
  Boolean(p) && Number.isFinite(p!.x) && Number.isFinite(p!.y) && p!.x >= 0 && p!.x <= 1 && p!.y >= 0 && p!.y <= 1;

/** Los sitios a mano de un equipo: jugador → punto. */
export function sitiosAMano(e: Pick<EquipoTarea, "estructura" | "orden" | "posiciones" | "autoOrden">): { id: string; punto: Punto }[] {
  if (!e.estructura || !e.orden?.length || e.autoOrden) return [];

  const lleva = conPortero(e.estructura);
  const orden = lleva ? e.orden.slice(1) : e.orden;
  const posiciones = lleva ? e.posiciones?.slice(1) : e.posiciones;
  const lineas = lineasDe(e.estructura).slice(lleva ? 1 : 0);
  const defecto = puntosDeLineas(lineas);
  const salida: { id: string; punto: Punto }[] = [];

  orden.forEach((id, i) => {
    if (!id) return;

    const fijo = posiciones?.[i];
    const punto = puntoValido(fijo) ? fijo : defecto[i];

    if (punto) salida.push({ id, punto });
  });

  return salida;
}

/**
 * Por nombre de jugador (`claveNombre`): dónde lo coloca el cuerpo técnico.
 * `hoy` en «AAAA-MM-DD» para el peso por antigüedad.
 */
export function aprendePosiciones(almacen: AlmacenEquipos, hoy = new Date().toISOString().slice(0, 10)): Record<string, PerfilAprendido> {
  type Acumulado = { nombre: string; sx: number; sy: number; peso: number; veces: number; ultima: string; dem: Partial<Record<Demarcacion, number>>; aMano: number };
  const acumulado = new Map<string, Acumulado>();
  const diaHoy = Date.parse(hoy);

  for (const sesion of almacen.sesiones ?? []) {
    const fecha = sesion.fecha ?? sesion.creadaEn?.slice(0, 10) ?? hoy;
    const dias = Number.isFinite(Date.parse(fecha)) ? Math.max(0, (diaHoy - Date.parse(fecha)) / 86_400_000) : 90;
    const pesoSesion = Math.pow(0.5, dias / 45);
    const porId = new Map<string, JugadorSesion>(sesion.jugadores.map((j) => [j.id, j]));

    /*
    | La demarcación puesta a mano en la sesión (02/11/2026) también se
    | aprende: así lo que se le corrige a uno que sube del RMC o del Juvenil A
    | un día vale para el siguiente, aunque esa sesión no lleve dibujo.
    */
    for (const j of sesion.jugadores) {
      const d = demarcacion(j.demarcacion);

      if (!d || d.clave === "por") continue;

      const clave = claveNombre(j.nombre);
      const a = acumulado.get(clave) ?? { nombre: j.nombre, sx: 0, sy: 0, peso: 0, veces: 0, ultima: "", dem: {}, aMano: 0 };
      const peso = pesoSesion * PESO_DEMARCACION_A_MANO;

      a.sx += d.punto.x * peso;
      a.sy += d.punto.y * peso;
      a.peso += peso;
      a.veces += 1;
      a.aMano += 1;
      a.dem[d.clave] = (a.dem[d.clave] ?? 0) + pesoSesion;
      if (fecha > a.ultima) a.ultima = fecha;
      acumulado.set(clave, a);
    }

    for (const tarea of sesion.tareas ?? []) {
      if (!tarea.conEstructura) continue;

      const fases = [
        tarea.equipos,
        ...(tarea.cambio ? [tarea.equipos.map((e) => ({ ...e, ...(tarea.cambio!.equipos[e.id] ?? {}) }))] : []),
      ];

      for (const equipos of fases) {
        for (const e of equipos) {
          for (const { id, punto } of sitiosAMano(e)) {
            const j = porId.get(id);

            if (!j) continue;

            const clave = claveNombre(j.nombre);
            const a = acumulado.get(clave) ?? { nombre: j.nombre, sx: 0, sy: 0, peso: 0, veces: 0, ultima: "", dem: {}, aMano: 0 };

            a.sx += punto.x * pesoSesion;
            a.sy += punto.y * pesoSesion;
            a.peso += pesoSesion;
            a.veces += 1;
            if (fecha > a.ultima) a.ultima = fecha;
            acumulado.set(clave, a);
          }
        }
      }
    }
  }

  const salida: Record<string, PerfilAprendido> = {};

  for (const [clave, a] of acumulado) {
    if (a.peso <= 0) continue;

    const punto = { x: round(a.sx / a.peso), y: round(a.sy / a.peso) };
    const masPuesta = (Object.entries(a.dem) as [Demarcacion, number][]).sort((x, y) => y[1] - x[1])[0]?.[0];
    const dem = masPuesta ?? (a.veces >= 2 ? demarcacionCercana(punto) : undefined);

    salida[clave] = {
      nombre: a.nombre,
      ...punto,
      veces: a.veces,
      ultima: a.ultima,
      ...(dem ? { demarcacion: dem } : {}),
      ...(a.aMano ? { aMano: a.aMano } : {}),
    };
  }

  return salida;
}

/* ------------------------------------------------------------------ */
/*  EL PUESTO DE CADA UNO, CON SU ORIGEN (02/11/2026)                  */
/* ------------------------------------------------------------------ */

/**
 * De dónde sale la demarcación de un jugador:
 * - `mano`: puesta en esta sesión (Plantilla del día);
 * - `fijo`: corregida en su ficha y guardada para siempre (`AlmacenEquipos.puestosFijos`);
 * - `aprendido`: donde lo coloca el cuerpo técnico, sesión tras sesión;
 * - `ficha`: la columna POSICION de la plantilla del Castilla.
 */
export type OrigenDemarcacion = "mano" | "fijo" | "aprendido" | "ficha";

/**
 * ¿Es de los que suben (RMC, Juvenil A…)? Lleva etiqueta en la lista del
 * delegado («(RMC)», «(JA)») o no casa con nadie de la plantilla del Castilla.
 * Para ellos la ficha no es fiable —o no existe— y manda lo aprendido.
 */
export const subeDeOtroEquipo = (j: JugadorSesion, conFicha: boolean) => Boolean(j.etiqueta?.trim()) || !conFicha;

/**
 * La demarcación que vale para colocarlo, por este orden:
 *   1. la puesta a mano en la sesión;
 *   2. la fijada a mano en su ficha (para siempre);
 *   3. para los que suben del RMC o del Juvenil A, lo aprendido y después su ficha;
 *      para los del Castilla, su ficha y después lo aprendido.
 */
export function resuelveDemarcacion(
  j: JugadorSesion,
  {
    fijo,
    ficha,
    aprendido,
    enPlantilla,
  }: { fijo?: Demarcacion; ficha?: Demarcacion; aprendido?: PerfilAprendido; /** Casa con alguien de la plantilla (aunque su ficha no diga demarcación). */ enPlantilla?: boolean },
): { demarcacion?: Demarcacion; origen?: OrigenDemarcacion } {
  if (j.demarcacion) return { demarcacion: j.demarcacion, origen: "mano" };
  if (fijo) return { demarcacion: fijo, origen: "fijo" };

  const deAprendido = aprendido?.demarcacion;

  if (subeDeOtroEquipo(j, enPlantilla ?? Boolean(ficha))) {
    if (deAprendido) return { demarcacion: deAprendido, origen: "aprendido" };
    if (ficha) return { demarcacion: ficha, origen: "ficha" };

    return {};
  }

  if (ficha) return { demarcacion: ficha, origen: "ficha" };
  if (deAprendido) return { demarcacion: deAprendido, origen: "aprendido" };

  return {};
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** «Lateral izquierdo», «central derecho», «mediapunta»…: el sitio aprendido dicho en palabras. */
export function sitioEnPalabras(p: Punto) {
  const banda = p.x < 0.33 ? "izquierda" : p.x > 0.67 ? "derecha" : "centro";
  const altura = p.y > 0.66 ? "defensa" : p.y > 0.45 ? "medio" : "ataque";

  if (altura === "defensa") return banda === "centro" ? "central" : `lateral ${banda === "izquierda" ? "izquierdo" : "derecho"}`;
  if (altura === "medio") return banda === "centro" ? "medio centro" : `interior o carrilero ${banda === "izquierda" ? "izquierdo" : "derecho"}`;

  return banda === "centro" ? "delantero o mediapunta" : `extremo ${banda === "izquierda" ? "izquierdo" : "derecho"}`;
}
