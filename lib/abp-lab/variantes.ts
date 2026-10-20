/**
 * IDEAS DE VARIANTE SEGÚN LA DEFENSA RIVAL (laboratorio de ABP, 21/10/2026).
 *
 * Para la rutina que se está diseñando —su tipo, su lado y contra qué
 * defensa se pensó—, qué variantes proponen los referentes. Cada idea es la
 * traducción a una consigna de un principio o una rutina que ya está en
 * `referentes.ts` con su fuente: no se inventa ninguna, y la fuente viaja
 * con ella para enseñarla en la pantalla.
 */

import { DEFENSA, FUENTES as F, REFERENTES, type Fuente, type TipoAbp } from "@/lib/abp-lab/referentes";
import type { Defensa, Lado } from "@/lib/abp-lab/modelo";

export type Idea = {
  id: string;
  /** Qué se propone, corto. */
  titulo: string;
  /** La variante tal como se apunta en la rutina. */
  texto: string;
  /** Quién lo hace o lo cuenta. */
  de: string;
  fuente: Fuente;
};

type Regla = Idea & { tipos: TipoAbp[]; lado: Lado; contra: Defensa[] };

const quien = (id: string) => REFERENTES.find((r) => r.id === id)?.nombre ?? "";

const defensa = (titulo: string) => DEFENSA.find((p) => p.titulo === titulo)?.fuente ?? F.plDefensa;

const TODAS: Defensa[] = ["zona", "mixta", "hombre", "cualquiera"];

const REGLAS: Regla[] = [
  /* ------------------------------ ATACAR --------------------------- */
  {
    id: "bloqueo-marcador",
    titulo: "Bloquear al marcador del rematador",
    texto: "El bloqueador sale por detrás del marcador de nuestro rematador y le bloquea bajo y tarde, ya con el balón en el aire.",
    de: quien("jover"),
    fuente: F.tggBloqueos,
    tipos: ["corner", "falta"],
    lado: "ofensivo",
    contra: ["hombre", "mixta", "cualquiera"],
  },
  {
    id: "paquete-segundo",
    titulo: "Salir en paquete del segundo palo",
    texto: "Arrancamos amontonados en el segundo palo y nos abrimos hacia el centro al golpeo: que no sepan a quién le toca.",
    de: quien("jover"),
    fuente: F.plGabriel,
    tipos: ["corner"],
    lado: "ofensivo",
    contra: ["hombre", "mixta"],
  },
  {
    id: "senuelo-primer-palo",
    titulo: "Señuelo por delante del primer palo",
    texto: "Uno corre por delante del primer palo y se lleva a su defensor fuera de la zona; el bloqueo tardío deja libre al de detrás.",
    de: quien("jover"),
    fuente: F.tggBloqueos,
    tipos: ["corner"],
    lado: "ofensivo",
    contra: ["hombre", "mixta", "cualquiera"],
  },
  {
    id: "atascar-portero",
    titulo: "Atascar al portero",
    texto: "Dos se plantan delante del portero y bloquean a los defensores de su lado: el portero no puede salir y el remate a seis metros queda libre.",
    de: quien("jover"),
    fuente: F.plGabriel,
    tipos: ["corner"],
    lado: "ofensivo",
    contra: ["zona", "mixta", "cualquiera"],
  },
  {
    id: "lado-ciego-zonal",
    titulo: "Bloquear a los zonales por el lado ciego",
    texto: "Dos salen de detrás de su línea zonal y bloquean por el lado ciego a los dos zonales más cercanos al objetivo; el rematador llega en carrera.",
    de: quien("cueva"),
    fuente: F.tfaChelsea,
    tipos: ["corner"],
    lado: "ofensivo",
    contra: ["zona", "mixta"],
  },
  {
    id: "peinada",
    titulo: "Peinada en el primer palo",
    texto: "Centro abierto al primer palo: uno libre peina y el rematador, que dio un paso atrás para soltarse, ataca la peinada.",
    de: quien("cueva"),
    fuente: F.tfaChelsea,
    tipos: ["corner"],
    lado: "ofensivo",
    contra: ["zona", "mixta"],
  },
  {
    id: "corto-sobrecarga",
    titulo: "Córner en corto para vaciar el área",
    texto: "Dos junto al lanzador, uno pegado a la línea de fondo: si mandan a muchos, al libre de la frontal o centro a un área con menos gente.",
    de: quien("cueva"),
    fuente: F.fifaChelsea,
    tipos: ["corner"],
    lado: "ofensivo",
    contra: ["zona", "cualquiera"],
  },
  {
    id: "cerrado-curva",
    titulo: "Cerrado y con curva moderada",
    texto: "Centro cerrado con el interior y curva moderada, no un latigazo: es lo que más se escapaba en la ejecución.",
    de: quien("cueva"),
    fuente: F.tfaChelsea,
    tipos: ["corner"],
    lado: "ofensivo",
    contra: TODAS,
  },
  {
    id: "anillo-frontal",
    titulo: "Anillo en la frontal",
    texto: "Seis dentro y tres rodeando la frontal para la segunda jugada y para frenar la contra; el más alejado entra tarde.",
    de: quien("brentford"),
    fuente: F.tggBrentford,
    tipos: ["corner", "falta"],
    lado: "ofensivo",
    contra: TODAS,
  },
  {
    id: "cambiar-cada-partido",
    titulo: "Otra salida para el mismo final",
    texto: "Mismo objetivo con otra colocación de salida: el rival lo ha visto, y la rutina cambia de un partido a otro.",
    de: quien("jover"),
    fuente: F.arteta,
    tipos: ["corner", "falta", "banda"],
    lado: "ofensivo",
    contra: TODAS,
  },
  {
    id: "barrera-falsa",
    titulo: "Barrera falsa",
    texto: "Al pitido, dos cruzan por delante del área y cuatro forman una segunda barrera delante de la suya que tapa al portero; golpeo directo.",
    de: quien("vio"),
    fuente: F.vio,
    tipos: ["falta"],
    lado: "ofensivo",
    contra: TODAS,
  },
  {
    id: "brazo-arriba",
    titulo: "El brazo arriba marca el tiempo",
    texto: "El lanzador levanta el brazo para dar el tiempo de la carrera a los que rematan.",
    de: quien("georgson"),
    fuente: F.georgson,
    tipos: ["corner", "falta"],
    lado: "ofensivo",
    contra: TODAS,
  },
  {
    id: "banda-no-linea",
    titulo: "Nunca recto por la línea",
    texto: "Saque plano y preciso hacia dentro, nunca recto por la banda, con la acción siguiente ya pensada para salir de la presión.",
    de: quien("gronnemark"),
    fuente: F.gronnemark,
    tipos: ["banda"],
    lado: "ofensivo",
    contra: TODAS,
  },
  {
    id: "banda-larga",
    titulo: "Saque largo al área",
    texto: "Si tenemos quien la saque larga, plana y rápida, saque de banda al área como si fuera un córner.",
    de: quien("gronnemark"),
    fuente: F.gronnemark,
    tipos: ["banda"],
    lado: "ofensivo",
    contra: TODAS,
  },

  /* ------------------------------ DEFENDER ------------------------- */
  {
    id: "def-zona",
    titulo: "Más zona en el área pequeña",
    texto: "Llenar el área pequeña de zonales (seis y uno en la línea delante del portero): los que mejor defienden el córner lo hacen así.",
    de: "Premier League",
    fuente: defensa("Llenar el área pequeña"),
    tipos: ["corner"],
    lado: "defensivo",
    contra: TODAS,
  },
  {
    id: "def-primer-zonal",
    titulo: "Adelantar al primer zonal",
    texto: "El primer zonal un paso más arriba y uno más en la zona que amenazan: la peinada del primer palo deja de funcionar.",
    de: "Premier League",
    fuente: defensa("Adelantar al primer zonal"),
    tipos: ["corner"],
    lado: "defensivo",
    contra: TODAS,
  },
  {
    id: "def-linea-recta",
    titulo: "Salir en línea recta contra los bloqueos",
    texto: "Si nos bloquean, salimos en línea recta de cuatro o cinco, o dejamos un defensor libre para el bloqueador.",
    de: quien("coulston"),
    fuente: F.tggBloqueos,
    tipos: ["corner", "falta"],
    lado: "defensivo",
    contra: TODAS,
  },
  {
    id: "def-arco",
    titulo: "Arco que protege al portero",
    texto: "Cinco en arco alrededor del portero, cuatro duelos uno contra uno y un libre en la frontal.",
    de: "Premier League",
    fuente: defensa("Un arco que protege al portero"),
    tipos: ["corner"],
    lado: "defensivo",
    contra: TODAS,
  },
  {
    id: "def-barrera",
    titulo: "Barrera de cuatro o cinco",
    texto: "Barrera de cuatro o cinco entre 16 y 25 metros; más lejos, que no tape la visión del portero.",
    de: quien("georgson"),
    fuente: F.georgson,
    tipos: ["falta"],
    lado: "defensivo",
    contra: TODAS,
  },
];

/**
 * Las ideas para una rutina: primero las pensadas para su defensa rival,
 * luego las que valen contra cualquiera. Fuera las que ya están apuntadas.
 */
export function ideasPara({ tipo, lado, contra }: { tipo: TipoAbp; lado: Lado; contra: Defensa }, yaApuntadas: string[] = []): Idea[] {
  const apuntadas = new Set(yaApuntadas.map((v) => v.trim()));

  const encajan = REGLAS.filter((r) => r.tipos.includes(tipo) && r.lado === lado && (contra === "cualquiera" || r.contra.includes(contra)) && !apuntadas.has(r.texto));

  /* Las específicas de esa defensa delante. */
  const peso = (r: Regla) => (contra !== "cualquiera" && r.contra.length < TODAS.length ? 0 : 1);

  return [...encajan].sort((a, b) => peso(a) - peso(b)).map(({ id, titulo, texto, de, fuente }) => ({ id, titulo, texto, de, fuente }));
}
