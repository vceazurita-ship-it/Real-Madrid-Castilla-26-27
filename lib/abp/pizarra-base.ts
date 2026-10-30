/*
|--------------------------------------------------------------------------
| LOS MOVIMIENTOS YA PINTADOS (30/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «que en las slides ofensivas de córner estén ya
| pintados por defecto los movimientos según la base que he puesto, y
| faltas laterales ídem». La base son sus tres córners ofensivos de la J10
| (Cartagena): dónde coloca a cada uno, las carreras, los bloqueos, el balón
| y los rivales que dibujó. La falta lateral ofensiva no tenía dibujo y se
| pinta con sus consignas de esa misma jornada: amagos y bloqueo en la corta,
| el de la zona de remate se acerca a pie, se juega en corto y después
| penalti, segundo palo y rechace.
|
| Cómo entra:
|   · Un tablero nuevo nace con los tres córners y la falta ya pintados.
|   · En los tableros desde la J10 (JORNADA_DESDE_BASE), una diapositiva de
|     esas plantillas que todavía no tiene ningún trazo recibe su base al
|     abrirse. Las jornadas anteriores no se tocan: son el histórico.
|   · Nunca se pisa un dibujo: con un solo trazo hecho a mano, la base no entra.
|
| `sitios` es la colocación propia de la variante: cada puesto en su sitio de
| esa rutina. La usan «Colocar» y el replantado (`puestosDe`), así que el
| jugador cae justo donde arranca su flecha.
|
| Las coordenadas son las del lienzo de 1920×1080, como todo el tablero.
*/

import type { FaseTrazo, RivalPizarra, TipoTrazo, TrazoPizarra } from "./trazos";

type Sitio = { x: number; y: number };

type TrazoBase = { tipo: TipoTrazo; fase: FaseTrazo; x1: number; y1: number; x2: number; y2: number; cx?: number; cy?: number };

export type BaseSlide = {
  /** Por código de puesto («C», «R1»…): dónde va en esta variante. */
  sitios: Record<string, Sitio>;
  trazos: TrazoBase[];
  rivales?: Sitio[];
};

/** Desde qué jornada se pinta la base sola en los tableros ya creados. */
export const JORNADA_DESDE_BASE = 10;

/** A qué distancia de un jugador un trazo se considera suyo y se le pega a los pies. */
const IMAN = 30;

export const BASES: Record<string, BaseSlide[]> = {
  /* Los tres córners ofensivos de la J10, tal y como los dejó el analista. */
  "corner-of": [
    {
      /* Primero: directa a punto de penalti; bloque como atractor sobre el
         primer palo, bloqueo a la corta y bloqueo a la zona. */
      sitios: {
        C: { x: 831, y: 845 },
        BZ: { x: 831, y: 300 },
        RC: { x: 638, y: 431 },
        RL: { x: 1021, y: 639 },
        R1: { x: 1385, y: 462 },
        D1: { x: 154, y: 258 },
        R3: { x: 638, y: 340 },
        R2: { x: 566, y: 375 },
        Z1: { x: 566, y: 462 },
        BC: { x: 748, y: 313 },
      },
      trazos: [
        { tipo: "carrera", fase: 1, x1: 568, y1: 451, x2: 728, y2: 620, cx: 603, cy: 586 },
        { tipo: "bloqueo", fase: 1, x1: 741, y1: 357, x2: 987, y2: 261, cx: 882, cy: 344 },
        { tipo: "carrera", fase: 1, x1: 828, y1: 279, x2: 940, y2: 308, cx: 850, cy: 287 },
        { tipo: "carrera", fase: 1, x1: 1382, y1: 441, x2: 929, y2: 377 },
        { tipo: "balon", fase: 1, x1: 227, y1: 232, x2: 929, y2: 375 },
      ],
      rivales: [
        { x: 795, y: 286 },
        { x: 916, y: 287 },
      ],
    },
    {
      /* Segundo: en corto con tres; centro al segundo palo en movimiento. */
      sitios: {
        Z1: { x: 239, y: 467 },
        R1: { x: 1076, y: 433 },
        C: { x: 864, y: 793 },
        D1: { x: 195, y: 241 },
        R2: { x: 1138, y: 400 },
        RL: { x: 1233, y: 420 },
        BZ: { x: 793, y: 317 },
        RC: { x: 444, y: 536 },
        BC: { x: 1022, y: 241 },
        R3: { x: 1179, y: 375 },
      },
      trazos: [
        { tipo: "carrera", fase: 1, x1: 952, y1: 235, x2: 673, y2: 365, cx: 460, cy: 135 },
        { tipo: "carrera", fase: 1, x1: 444, y1: 536, x2: 733, y2: 399, cx: 751, cy: 583 },
        { tipo: "carrera", fase: 2, x1: 1233, y1: 420, x2: 956, y2: 573, cx: 1147, cy: 597 },
        { tipo: "balon", fase: 1, x1: 265, y1: 240, x2: 410, y2: 500 },
      ],
    },
    {
      /* Tercero: a la corta en línea de fondo y tensa al punto de penalti. */
      sitios: {
        Z1: { x: 1442, y: 411 },
        R1: { x: 1169, y: 389 },
        C: { x: 936, y: 927 },
        D1: { x: 154, y: 258 },
        RC: { x: 815, y: 289 },
        R3: { x: 1220, y: 278 },
        BC: { x: 1345, y: 411 },
        R2: { x: 1233, y: 411 },
        RL: { x: 653, y: 753 },
        BZ: { x: 1028, y: 258 },
      },
      trazos: [
        { tipo: "balon", fase: 1, x1: 224, y1: 227, x2: 699, y2: 236 },
        { tipo: "balon", fase: 1, x1: 703, y1: 271, x2: 822, y2: 394 },
        { tipo: "carrera", fase: 1, x1: 679, y1: 613, x2: 801, y2: 418 },
        { tipo: "carrera", fase: 1, x1: 1390, y1: 459, x2: 872, y2: 409, cx: 1044, cy: 604 },
      ],
    },
  ],

  /*
  | Falta lateral ofensiva, desde la izquierda (plano de portería: la
  | portería arriba, el palo corto a la izquierda en x≈703 y el largo en
  | x≈836; el punto de penalti en 770,374). Los lanzadores (D1 y Z1) están
  | sobre el balón.
  |   Fase 1 · amagos: BR bloquea en la corta y R1 sale de la zona de remate a
  |            acercarse a pie, a la frontal del balón.
  |   Fase 2 · en corto: el balón va a R1 y arrancan las carreras —C al
  |            primer palo, R2 al penalti, R3 al segundo palo y R4 cierra el
  |            largo—.
  |   Fase 3 · el centro: de R1 al punto de penalti; RE sube a la frontal al
  |            rechace. E se queda equilibrando.
  */
  "falta-lat-of": [
    {
      sitios: {
        R1: { x: 821, y: 465 },
        R2: { x: 900, y: 466 },
        R3: { x: 976, y: 466 },
        R4: { x: 1052, y: 466 },
        BR: { x: 742, y: 421 },
        E: { x: 925, y: 935 },
        Z1: { x: 326, y: 804 },
        D1: { x: 250, y: 760 },
        C: { x: 148, y: 550 },
        RE: { x: 711, y: 677 },
      },
      trazos: [
        /* Fase 1: BR bloquea en la corta; R1 sale por abajo, lejos de las caras, a acercarse a pie. */
        { tipo: "bloqueo", fase: 1, x1: 742, y1: 421, x2: 600, y2: 488, cx: 650, cy: 420 },
        { tipo: "carrera", fase: 1, x1: 821, y1: 465, x2: 470, y2: 640, cx: 600, cy: 560 },
        /* Fase 2: en corto a R1 y arrancan al área pequeña, donde no hay caras que tapen la flecha. */
        { tipo: "balon", fase: 2, x1: 250, y1: 760, x2: 470, y2: 640 },
        { tipo: "carrera", fase: 2, x1: 148, y1: 550, x2: 650, y2: 282, cx: 300, cy: 330 },
        { tipo: "carrera", fase: 2, x1: 900, y1: 466, x2: 760, y2: 300, cx: 880, cy: 330 },
        { tipo: "carrera", fase: 2, x1: 976, y1: 466, x2: 870, y2: 280, cx: 990, cy: 330 },
        { tipo: "carrera", fase: 2, x1: 1052, y1: 466, x2: 990, y2: 300, cx: 1090, cy: 360 },
        /* Fase 3: el centro al punto de penalti y RE sube a la frontal al rechace. */
        { tipo: "balon", fase: 3, x1: 470, y1: 640, x2: 770, y2: 330, cx: 540, cy: 400 },
        { tipo: "carrera", fase: 3, x1: 711, y1: 677, x2: 610, y2: 560, cx: 640, cy: 650 },
      ],
    },
  ],
};


/** La base de una plantilla en su variante (la última se repite si hay más diapositivas que variantes). */
export function baseDe(plantilla: string, variante: number): BaseSlide | null {
  const lista = BASES[plantilla];
  if (!lista?.length) return null;
  return lista[Math.min(variante, lista.length - 1)];
}

/** Los sitios de la base con la clave completa del puesto («corner-of:C»). */
export function sitiosDeBase(plantilla: string, base: BaseSlide): Record<string, Sitio> {
  return Object.fromEntries(Object.entries(base.sitios).map(([code, s]) => [`${plantilla}:${code}`, { ...s }]));
}

/**
 * Los trazos de la base, con ids nuevos y pegados a los pies del jugador del
 * que salen: un trazo que arranca a menos de `IMAN` de un sitio empieza
 * exactamente en él, para que al mover la ficha la flecha vaya con ella.
 */
/* Ids fijos por diapositiva (`semilla` = su id): la base se calcula al abrir y,
   hasta que se guarde, cada lectura tiene que dar los mismos trazos. */
export function trazosDeBase(base: BaseSlide, semilla: string): TrazoPizarra[] {
  const sitios = Object.values(base.sitios);

  return base.trazos.map((t, i) => {
    let mejor: Sitio | null = null;
    let menor = IMAN;

    for (const s of sitios) {
      const d = Math.hypot(s.x - t.x1, s.y - t.y1);
      if (d < menor) {
        menor = d;
        mejor = s;
      }
    }

    return { id: `TR-${semilla}-${i}`, ...t, ...(mejor ? { x1: mejor.x, y1: mejor.y } : {}) };
  });
}

export function rivalesDeBase(base: BaseSlide, semilla: string): RivalPizarra[] | undefined {
  return base.rivales?.map((r, i) => ({ id: `RV-${semilla}-${i}`, x: r.x, y: r.y }));
}
