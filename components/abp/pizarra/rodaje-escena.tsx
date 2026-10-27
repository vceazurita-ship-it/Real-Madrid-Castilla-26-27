"use client";

/**
 * LA JUGADA COMO EN EL LABORATORIO, PARA EL VÍDEO DE UN JUGADOR (27/10/2026).
 *
 * «Que no sea el PDF llevado a vídeo, sino la acción pintada como en el
 * laboratorio y el jugador reseñado para que vea su responsabilidad». Cada
 * diapositiva de la pizarra pasa a rutina del laboratorio con el mismo puente
 * de «Abrir en el laboratorio» (`rutinaDeSlide`) y se pinta con su `Escena`:
 * cámara de televisión, balón por el aire, carreras y, en las ofensivas, la
 * defensa del rival tipo moviéndose. Él va con aro y «TÚ» y los demás,
 * apagados (`destacado`).
 *
 * Se pinta en un nodo suelto (no está en la página) con `createRoot` +
 * `flushSync`: el SVG está listo al volver, sin esperar a un fotograma de
 * pantalla, que en una pestaña escondida no llega nunca.
 */

import type { ComponentProps } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import type { JugadorLab } from "@/components/abp-lab/comun";
import { Escena, NOCHE, type Capas } from "@/components/abp-lab/Escena";
import {
  defensaRivalDe,
  type RutinaSimulable,
} from "@/components/abp-lab/useSimulacion";
import {
  AREA,
  encuadre,
  focoDe,
  posicionesEn,
  recorridoBalon,
} from "@/lib/abp-lab/campo";
import { creaCamara, type Camara } from "@/lib/abp-lab/camara";
import { leeFoto } from "@/lib/abp-lab/fotos";
import { aMetros, rutinaDeSlide } from "@/lib/abp-lab/puente-pizarra";
import {
  defensaEn,
  estadoBalon,
  type Defensor,
} from "@/lib/abp-lab/simulacion";
import {
  duelosAereos,
  evaluaRemate,
  planCon,
  type Remate,
} from "@/lib/abp-lab/ventaja";
import { PLANTILLA_BY_KEY, type SlidePizarra } from "@/lib/abp/pizarra";
import type { Player } from "@/types/player";

/**
 * La escena, algo más ancha que alta (1080×900): cuadrada, la cámara de
 * televisión dejaba media escena de cielo. Deja sitio arriba al título y
 * abajo a su cometido.
 */
export const ASPECTO_ESCENA = 1080 / 1060;

/**
 * Lo que manda en el plano: él (de dónde sale y adónde va), dónde cae el
 * balón y la portería, con aire alrededor. Con la jugada entera en un móvil
 * cada jugador medía dos dedos de alto y no se encontraba; así se le ve a él
 * y lo que le rodea, que es su responsabilidad. Sin él en la jugada, el área.
 */
function focoDelJugador(rutina: RutinaSimulable, indice: number, caida: { x: number; y: number }) {
  if (indice < 0) return focoDe(rutina).filter((p) => p.x > AREA.x0 - 4 && p.x < AREA.x1 + 4 && p.y < AREA.y + 6);

  const suyos = [posicionesEn(rutina.roles, 0)[indice], posicionesEn(rutina.roles, 1)[indice]];
  const aire = 5;

  return [
    ...suyos.flatMap((p) => [
      { x: p.x - aire, y: p.y },
      { x: p.x + aire, y: p.y + aire * 0.6 },
      /* Algo de campo por delante de él: sin esto, el plano se rellenaba de cielo. */
      { x: p.x, y: p.y + aire * 1.2 },
    ]),
    caida,
    { x: 30, y: 0 },
    { x: 38, y: 0 },
  ];
}

const CAPAS: Capas = {
  nombres: true,
  fotos: true,
  ventaja: false,
  duelos: true,
};

const corto = (p: Player) =>
  p.apodo?.trim() || p.nombre.trim().split(/\s+/).slice(0, 2).join(" ");

/** Todo lo de una acción que no cambia con el instante. */
export type EscenaJugador = {
  rutina: RutinaSimulable;
  destacado: number | null;
  cam: Camara;
  porId: Map<string, JugadorLab>;
  fotos: Map<string, string>;
  plan: Defensor[] | null;
  /** Los rivales dibujados en una defensiva: quietos, donde los puso el cuerpo técnico. */
  fijos: Defensor[] | null;
  remate: Remate | null;
  camino: ReturnType<typeof recorridoBalon>;
};

/** Una diapositiva de la pizarra, lista para pintarla en cualquier instante con `playerId` de protagonista. */
export async function preparaEscena(opciones: {
  slide: SlidePizarra;
  titulo: string;
  partidoId: string;
  rival: string;
  jornada?: string;
  playerId: string;
  players: Map<string, Player>;
}): Promise<EscenaJugador> {
  const { slide, players } = opciones;

  const jugadores = new Map(
    slide.fichas.flatMap((f) => {
      const p = players.get(f.playerId);

      return p
        ? [[f.playerId, { nombre: corto(p), dorsal: p.dorsal }] as const]
        : [];
    }),
  );

  const puente = rutinaDeSlide({
    slide,
    partidoId: opciones.partidoId,
    rival: opciones.rival,
    jornada: opciones.jornada,
    titulo: opciones.titulo,
    jugadores,
    ahora: new Date(0).toISOString(),
  });

  const rutina: RutinaSimulable = {
    nombre: puente.nombre,
    senal: puente.senal,
    tipo: puente.tipo,
    lado: puente.lado,
    contra: puente.contra,
    roles: puente.roles,
    balon: puente.balon,
    envio: puente.envio,
  };

  const porId = new Map<string, JugadorLab>(
    rutina.roles.flatMap((r) => {
      const p = players.get(r.jugador);

      return p
        ? [
            [
              r.jugador,
              {
                id: p.id,
                nombre: corto(p),
                foto: p.foto,
                posicion: p.posicion,
                dorsal: p.dorsal,
              },
            ] as const,
          ]
        : [];
    }),
  );

  /* Las caras como `data:`: un SVG pintado como imagen no carga nada de fuera. */
  const urls = [
    ...new Set([...porId.values()].map((j) => j.foto).filter(Boolean)),
  ];
  const fotos = new Map<string, string>();

  await Promise.all(
    urls.map(async (u) => {
      const d = await leeFoto(u);

      if (d) fotos.set(u, d);
    }),
  );

  const camino = recorridoBalon(rutina);

  const rivalDef = defensaRivalDe("tipo", rutina, {
    aereo: new Map(),
    calibre: null,
    rival: null,
  });
  const plan = rivalDef ? planCon(rutina, rivalDef) : null;
  const remate = plan ? evaluaRemate(rutina, plan, null, () => null) : null;

  const fijos = rutina.lado === "defensivo" ? rivalesDefensa(slide, rutina) : null;

  const marco = encuadre(rutina, ASPECTO_ESCENA, 6);
  const indice = rutina.roles.findIndex((r) => r.jugador === opciones.playerId);

  return {
    rutina,
    destacado: indice >= 0 ? indice : null,
    cam: creaCamara("tv", marco, ASPECTO_ESCENA, focoDelJugador(rutina, indice, camino.at(-1) ?? { x: 34, y: 8 })),
    porId,
    fotos,
    plan,
    fijos,
    remate,
    camino,
  };
}

/** Cuánto se acerca la cámara a él (expertos: en el móvil «TÚ» medía 20 px). */
const ZOOM = 1.3;

/**
 * La cámara que le sigue: el mismo plano, recortado alrededor de él (y un
 * poco hacia donde cae el balón, para que se vea llegar). Se mueve con él,
 * como la realización que sigue al protagonista.
 */
function sigueAlJugador(cam: Camara, el: { x: number; y: number }, caida: { x: number; y: number }): Camara {
  const c = cam.caja;
  const w = c.w / ZOOM;
  const h = c.h / ZOOM;
  const a = cam.proy({ ...el, z: 1 });
  const b = cam.proy({ ...caida, z: 0 });
  const cx = a.x * 0.6 + b.x * 0.4;
  const cy = a.y * 0.6 + b.y * 0.4;
  const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  return { ...cam, caja: { x: entre(cx - w / 2, c.x, c.x + c.w - w), y: entre(cy - h * 0.5, c.y, c.y + c.h - h), w, h } };
}

/* Arranca y frena suave. */
const suave = (k: number) => k * k * (3 - 2 * k);

/** Lo que `Escena` necesita para pintar `e` en el instante `t` (0 = salida, 1 = final). */
export function propsEscena(
  e: EscenaJugador,
  t: number,
): ComponentProps<typeof Escena> {
  const { rutina, plan, camino } = e;
  const nuestros = posicionesEn(rutina.roles, t);
  const envio = rutina.envio ?? "tenso";

  let defensa: ComponentProps<typeof Escena>["defensa"] = null;
  let duelos: ReturnType<typeof duelosAereos> = [];

  if (plan) {
    const estado = defensaEn(
      plan,
      rutina.roles,
      t,
      camino.at(-1)!,
      (s) => estadoBalon(camino, s, envio, rutina.tipo).suelo,
    );

    defensa = { plan, estado };
    duelos = duelosAereos(rutina.roles, nuestros, plan, estado.pos, () => null);
  } else if (e.fijos) {
    /*
     * Los atacantes pegados a un marcador atacan la caída del balón y el
     * marcador les acompaña por el lado de la portería: es lo que tiene que
     * aprender. Quien ya tiene su carrera dibujada hace la suya.
     */
    const caida = camino.at(-1) ?? { x: 34, y: 8 };
    const k = suave(Math.min(1, Math.max(0, (t - 0.15) / 0.6)));

    const pos = e.fijos.map((d) => {
      if (d.sigue === undefined) return d.base;

      const meta = { x: d.base.x + (caida.x - d.base.x) * 0.55, y: d.base.y + (caida.y - d.base.y) * 0.55 };
      const aqui = { x: d.base.x + (meta.x - d.base.x) * k, y: d.base.y + (meta.y - d.base.y) * k };
      const rol = rutina.roles[d.sigue];

      if (rol && rol.hx === undefined) nuestros[d.sigue] = { x: aqui.x - 0.5, y: aqui.y - 1.1 };

      return aqui;
    });

    defensa = { plan: e.fijos, estado: { pos, bloqueado: e.fijos.map(() => false) } };
  }

  return {
    id: "vj",
    rutina,
    porId: e.porId,
    t,
    cam: e.destacado !== null ? sigueAlJugador(e.cam, nuestros[e.destacado], camino.at(-1) ?? { x: 34, y: 8 }) : e.cam,
    paleta: NOCHE,
    nuestros,
    defensa,
    capas: CAPAS,
    duelos,
    remate: e.remate,
    destacado: e.destacado,
    fotos: e.fotos,
    etiqueta: rutina.nombre,
  };
}

/**
 * Los rivales de una defensiva, quietos: los que dibujó el cuerpo técnico o,
 * si no dibujó ninguno, uno pegado a cada marcador (con el dorsal de «Quién
 * marca a quién» si está puesto). Sin rival delante, un marcador en el vídeo
 * no marca a nadie y no se entiende su trabajo.
 */
function rivalesDefensa(slide: SlidePizarra, rutina: RutinaSimulable): Defensor[] | null {
  const vista = slide.vista === "porteria" ? "porteria" : "ancho";

  if (slide.rivales?.length) {
    return slide.rivales.map<Defensor>((r) => ({
      papel: /^p$/i.test(r.dorsal ?? "") ? "portero" : "marcador",
      base: aMetros(vista, r),
      dorsal: r.dorsal || undefined,
    }));
  }

  const puestos = new Map((PLANTILLA_BY_KEY.get(slide.plantilla)?.puestos ?? []).map((q) => [q.key, q]));
  const desde = posicionesEn(rutina.roles, 0);

  const pegados = rutina.roles.flatMap<Defensor>((rol, i) => {
    const ficha = slide.fichas.find((f) => f.id === rol.ref);
    const puesto = ficha?.puesto ? puestos.get(ficha.puesto) : undefined;

    if (puesto?.grupo !== "marcas") return [];

    /* Un paso por delante de él, hacia fuera del área: el atacante. */
    return [{ papel: "marcador", base: { x: desde[i].x + 0.5, y: desde[i].y + 1.3 }, sigue: i, dorsal: slide.marcas?.[puesto.key] || undefined }];
  });

  return pegados.length ? pegados : null;
}

/** Un lienzo de React fuera de la página donde se pinta la escena instante a instante. */
export class RodajeEscena {
  private nodo = document.createElement("div");
  private raiz: Root = createRoot(this.nodo);

  /** La escena `e` en el instante `t`, ya pintada. */
  pinta(e: EscenaJugador, t: number): SVGSVGElement {
    flushSync(() => this.raiz.render(<Escena {...propsEscena(e, t)} />));

    const svg = this.nodo.querySelector("svg");

    if (!svg) throw new Error("No se ha podido pintar la jugada");

    return svg;
  }

  cierra() {
    this.raiz.unmount();
  }
}
