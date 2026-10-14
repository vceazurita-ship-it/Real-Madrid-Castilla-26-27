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
import { puntosDeLineas, type Aprendido, type Punto } from "@/lib/sesion-equipos/demarcacion";

export type PerfilAprendido = Aprendido & {
  nombre: string;
  /** La última sesión en que se le colocó a mano («AAAA-MM-DD»). */
  ultima?: string;
};

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
  const acumulado = new Map<string, { nombre: string; sx: number; sy: number; peso: number; veces: number; ultima: string }>();
  const diaHoy = Date.parse(hoy);

  for (const sesion of almacen.sesiones ?? []) {
    const fecha = sesion.fecha ?? sesion.creadaEn?.slice(0, 10) ?? hoy;
    const dias = Number.isFinite(Date.parse(fecha)) ? Math.max(0, (diaHoy - Date.parse(fecha)) / 86_400_000) : 90;
    const pesoSesion = Math.pow(0.5, dias / 45);
    const porId = new Map<string, JugadorSesion>(sesion.jugadores.map((j) => [j.id, j]));

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
            const a = acumulado.get(clave) ?? { nombre: j.nombre, sx: 0, sy: 0, peso: 0, veces: 0, ultima: "" };

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

    salida[clave] = { nombre: a.nombre, x: round(a.sx / a.peso), y: round(a.sy / a.peso), veces: a.veces, ultima: a.ultima };
  }

  return salida;
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
