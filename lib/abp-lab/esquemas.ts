/**
 * LAS RUTINAS DE LOS REFERENTES, DIBUJADAS (laboratorio de ABP, 21/10/2026).
 *
 * Cuando una rutina de `referentes.ts` se lleva al taller, llega ya colocada
 * en la pizarra: quién sale de dónde, adónde va y por dónde vuela el balón.
 * Es un esquema hecho a partir de los pasos que cuenta su fuente (los mismos
 * que se leen en la ficha), no una medición: se ajusta en el taller. Las
 * rutinas que no están aquí llegan con los pasos escritos y la pizarra vacía.
 *
 * Coordenadas en metros, córner desde la izquierda (ver `campo.ts`).
 */

import type { Fase, Papel, Punto, Rol, Zona } from "@/lib/abp-lab/modelo";

type Esquema = { roles: Rol[]; balon: Punto[] };

const r = (papel: Papel, zona: Zona, x: number, y: number, destino?: [number, number], fase: Fase = 2, nota?: string): Rol => ({
  jugador: "",
  papel,
  zona,
  x,
  y,
  ...(destino ? { hx: destino[0], hy: destino[1], fase } : {}),
  ...(nota ? { nota } : {}),
});

const CORNER: Punto = { x: 0.6, y: 0.6 };

/* Los de siempre: el lanzador junto al balón, la segunda jugada y la vigilancia de la contra. */
const lanzador = r("lanzador", "corto", 1.4, 1.6);

const segunda = (x = 34) => r("segunda", "frontal", x, 18.5);

const vigilancia = [r("vigilancia", "atras", 28, 33), r("vigilancia", "atras", 40, 33)];

export const ESQUEMAS: Record<string, Esquema> = {
  "arsenal-forest": {
    roles: [
      lanzador,
      r("bloqueador", "primer-palo", 35, 11, [30.8, 3.4], 2, "Bloquea a su zonal"),
      r("bloqueador", "centro", 37, 12, [33.4, 3.8], 2, "Bloquea a su zonal"),
      r("bloqueador", "centro", 33, 12.5, [36, 3.8], 2, "Bloquea a su zonal"),
      r("bloqueador", "segundo-palo", 40, 10.5, [38.2, 3.6], 2, "Bloquea a su zonal"),
      r("rematador", "segundo-palo", 42, 8, [39, 5.2], 2, "Queda solo en el segundo palo"),
      segunda(30),
      segunda(38),
      ...vigilancia,
    ],
    balon: [CORNER, { x: 39, y: 5.2 }],
  },
  "arsenal-spurs": {
    roles: [
      lanzador,
      r("portero", "portero", 32.5, 7, [32.6, 2], 1, "Pared delante del portero"),
      r("portero", "portero", 35.5, 7, [35.2, 2.1], 1, "Pared delante del portero"),
      r("rematador", "centro", 39.5, 11, [35, 6], 2, "Pierde a su marcador: remate a seis metros"),
      r("senuelo", "primer-palo", 30, 9, [29.2, 3.2]),
      r("senuelo", "segundo-palo", 42, 9.5, [41, 4.4]),
      segunda(),
      ...vigilancia,
    ],
    balon: [CORNER, { x: 35, y: 6 }],
  },
  "arsenal-palace": {
    roles: [
      lanzador,
      r("senuelo", "primer-palo", 37, 9.5, [28.6, 2.8], 2, "Se lleva a su defensor por delante del primer palo"),
      r("bloqueador", "centro", 39.5, 4.6, [36.4, 6.2], 2, "Sale por detrás; bloqueo tardío y bajo"),
      r("portero", "portero", 33, 5, [34, 2], 1, "Bloquea al portero"),
      r("rematador", "centro", 40.5, 11, [35.4, 6], 2),
      segunda(),
      ...vigilancia,
    ],
    balon: [CORNER, { x: 35.4, y: 6 }],
  },
  "chelsea-paquete": {
    roles: [
      lanzador,
      r("senuelo", "primer-palo", 39.4, 10.4, [31, 4], 2, "Amaga y se lleva al primer defensor"),
      r("bloqueador", "centro", 40.6, 10.6, [34, 4.6], 2),
      r("bloqueador", "centro", 39, 11.8, [36.6, 4.8], 2),
      r("bloqueador", "segundo-palo", 41.2, 11.8, [39.6, 6.6], 2),
      r("rematador", "segundo-palo", 40, 12.2, [39.2, 5], 2),
      r("rematador", "centro", 40.2, 13.4, [37, 7.6], 3, "El último del paquete llega tarde"),
      segunda(),
      ...vigilancia,
    ],
    balon: [CORNER, { x: 39.2, y: 5 }],
  },
  "chelsea-peinada": {
    roles: [
      lanzador,
      r("bloqueador", "primer-palo", 31.8, 1.6, [31, 4.2], 2, "Sale de detrás de la línea zonal, por el lado ciego"),
      r("bloqueador", "centro", 34.4, 1.6, [33.6, 4.4], 2, "Sale de detrás de la línea zonal, por el lado ciego"),
      r("rematador", "primer-palo", 27.5, 9.5, [30.4, 3.8], 2, "Llega libre y peina"),
      r("rematador", "segundo-palo", 37.5, 8.5, [35.8, 5.2], 2, "Paso atrás para soltarse y ataca la peinada"),
      segunda(),
      ...vigilancia,
    ],
    balon: [CORNER, { x: 30.4, y: 3.8 }, { x: 35.8, y: 5.2 }],
  },
  "chelsea-pared": {
    roles: [
      { ...lanzador, hx: 8, hy: 8.5, fase: 2, nota: "Tras la pared, se mete en curva" },
      r("corto", "corto", 12, 12, [5, 4], 1, "Viene de la frontal a por la pared"),
      r("bloqueador", "primer-palo", 30, 1.8, [31, 4.2], 2, "Frena la salida desde detrás de la línea"),
      r("bloqueador", "centro", 33, 1.8, [34, 4.4], 2, "Frena la salida desde detrás de la línea"),
      r("rematador", "segundo-palo", 34, 9, [40, 5], 2),
      r("rematador", "segundo-palo", 36, 10, [41.6, 7], 2),
      r("rematador", "segundo-palo", 38, 9, [39, 3.6], 2),
      r("segunda", "frontal", 17, 17.5, undefined, 2, "Recibe el pase atrás"),
      ...vigilancia,
    ],
    balon: [CORNER, { x: 5, y: 4 }, { x: 7.5, y: 7.5 }, { x: 17, y: 17.5 }],
  },
  "georgson-pinnock": {
    roles: [
      lanzador,
      r("bloqueador", "centro", 37, 8, [37.4, 5.4]),
      r("rematador", "segundo-palo", 40.5, 10, [39.6, 5], 2, "El objetivo: el segundo palo"),
      r("senuelo", "primer-palo", 33, 9, [30.6, 3.6]),
      segunda(),
      ...vigilancia,
    ],
    balon: [CORNER, { x: 39.6, y: 5 }],
  },
  "vio-barrera-falsa": {
    roles: [
      r("lanzador", "frontal", 36.6, 24.4),
      r("senuelo", "frontal", 29, 16, [44, 16.5], 1, "Cruza por delante del área"),
      r("senuelo", "frontal", 45, 17, [30, 16.5], 1, "Cruza por delante del área"),
      r("portero", "frontal", 33, 19.5, [35.6, 12.8], 1, "Barrera falsa: tapa al portero"),
      r("portero", "frontal", 35, 20.5, [36.6, 12.8], 1, "Barrera falsa: tapa al portero"),
      r("portero", "frontal", 41, 20.5, [37.6, 12.8], 1, "Barrera falsa: tapa al portero"),
      r("portero", "frontal", 43, 19.5, [38.6, 12.8], 1, "Barrera falsa: tapa al portero"),
      ...vigilancia,
    ],
    balon: [{ x: 37.2, y: 23 }, { x: 32.6, y: 0.3 }],
  },
};
