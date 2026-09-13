import type { FilaPartido } from "./leer";
import { METRICA_POR_KEY, valorEnGrupo, valorEnPartido } from "./metricas";

/**
 * EL PARTIDO, PINTADO EN UN CAMPO.
 *
 * Una tabla de cincuenta y siete métricas es exacta y no se lee. Un cuerpo
 * técnico no piensa en columnas: piensa en **momentos** —con balón, sin balón,
 * las dos transiciones, el balón parado— y en **zonas del campo**. Así que
 * aquí cada cifra se coloca donde ocurre: las recuperaciones altas cerca del
 * área contraria, las pérdidas en campo propio cerca de la nuestra, los
 * remates dentro del área.
 *
 * Y siempre en pareja: **el partido a la izquierda y lo que llevamos de
 * temporada a la derecha**. Un 62 % de posesión no dice nada solo; al lado de
 * nuestro 64 % de media sí dice algo.
 *
 * El campo se dibuja siempre **atacando hacia la derecha**, también en los
 * momentos defensivos: cambiar la orientación según el momento obliga a
 * reorientarse en cada pestaña y es justo lo que se quería evitar.
 */

export type MomentoJuego = "con" | "sin" | "trOf" | "trDef" | "abp";

export const MOMENTOS_CAMPO: {
  key: MomentoJuego;
  label: string;
  corto: string;
  pregunta: string;
}[] = [
  {
    key: "con",
    label: "Con balón",
    corto: "Con balón",
    pregunta: "¿Dónde tuvimos el balón y en qué lo convertimos?",
  },
  {
    key: "sin",
    label: "Sin balón",
    corto: "Sin balón",
    pregunta: "¿Dónde defendimos y cuánto concedimos?",
  },
  {
    key: "trOf",
    label: "Transición ofensiva",
    corto: "Tr. ofensiva",
    pregunta: "¿Qué pasó en los segundos siguientes a robar?",
  },
  {
    key: "trDef",
    label: "Transición defensiva",
    corto: "Tr. defensiva",
    pregunta: "¿Qué pasó en los segundos siguientes a perderlo?",
  },
  {
    key: "abp",
    label: "Balón parado",
    corto: "Balón parado",
    pregunta: "¿Qué dio la estrategia, a favor y en contra?",
  },
];

/**
 * Una cifra colocada en el campo.
 *
 * `x` e `y` van en tanto por ciento del campo, con el ataque hacia la derecha:
 * `x: 10` es nuestra área, `x: 90` la del rival, `y: 50` el centro.
 */
export type FichaCampo = {
  metrica: string;
  /** Un nombre corto: en el campo no cabe «Recuperaciones altas %». */
  rotulo: string;
  x: number;
  y: number;
  /** Cuando el valor es el del rival: «remates en contra» son los suyos. */
  contra?: boolean;
  /** Lo que hay que saber de esa cifra, al pasar por encima. */
  nota: string;
};

export const FICHAS: Record<MomentoJuego, FichaCampo[]> = {
  /* ---------------------------- CON BALÓN -------------------------- */
  con: [
    {
      metrica: "posesion",
      rotulo: "Posesión",
      x: 50,
      y: 50,
      nota: "Cuánto tiempo fue nuestro el balón. Sola no dice nada: hay que ver en qué se convirtió.",
    },
    {
      metrica: "pasesProgresivos",
      rotulo: "Pases progresivos",
      x: 33,
      y: 22,
      nota: "Los pases que avanzan de verdad hacia la portería contraria.",
    },
    {
      metrica: "cuotaUltimoTercio",
      rotulo: "Juego en el último tercio",
      x: 72,
      y: 18,
      nota: "Qué parte del juego se hizo en el tercio de ataque. Con posesión alta y esto bajo, la posesión se queda en el medio.",
    },
    {
      metrica: "centros",
      rotulo: "Centros",
      x: 76,
      y: 86,
      nota: "La vía del centro lateral. Es una decisión, no una virtud.",
    },
    {
      metrica: "entradasArea",
      rotulo: "Entradas al área",
      x: 80,
      y: 50,
      nota: "Llegar dentro conduciendo, no sólo rematar desde fuera.",
    },
    {
      metrica: "toquesArea",
      rotulo: "Toques en el área",
      x: 91,
      y: 35,
      nota: "Sin gente dentro no hay toques: es la medida indirecta de cuánta gente ocupa el área.",
    },
    {
      metrica: "xg",
      rotulo: "xG a favor",
      x: 91,
      y: 65,
      nota: "Lo que valían las ocasiones creadas, al margen de si entraron.",
    },
  ],

  /* ---------------------------- SIN BALÓN -------------------------- */
  sin: [
    {
      metrica: "ppda",
      rotulo: "PPDA",
      x: 62,
      y: 50,
      nota: "Pases que se le dejan dar al rival antes de una acción defensiva. Bajo es presionar mucho.",
    },
    {
      metrica: "recuperacionesAltas",
      rotulo: "Recuperaciones altas",
      x: 78,
      y: 22,
      nota: "Qué parte de los robos se hace en campo contrario. Es la medida de presionar arriba.",
    },
    {
      metrica: "duelosDefensivos",
      rotulo: "Duelos def. ganados",
      x: 38,
      y: 22,
      nota: "La primera línea de todo lo demás: lo que se gana defendiendo el uno contra uno.",
    },
    {
      metrica: "duelosAereos",
      rotulo: "Aéreos ganados",
      x: 18,
      y: 78,
      nota: "El duelo que decide centros y córners.",
    },
    {
      metrica: "interceptaciones",
      rotulo: "Interceptaciones",
      x: 42,
      y: 78,
      nota: "Cortar por lectura, sin entrar. Va con la posición, no con el físico.",
    },
    {
      metrica: "despejes",
      rotulo: "Despejes",
      x: 13,
      y: 50,
      nota: "Alejar sin control. Muchos no son buena defensa: son mucho tiempo dentro del área propia.",
    },
    {
      metrica: "tirosContra",
      rotulo: "Remates en contra",
      x: 9,
      y: 35,
      nota: "Lo que de verdad se concede, al final de todo lo demás.",
    },
  ],

  /* ----------------------- TRANSICIÓN OFENSIVA --------------------- */
  trOf: [
    {
      metrica: "recuperacionesAltas",
      rotulo: "Robos en campo rival",
      x: 66,
      y: 20,
      nota: "Donde empieza la transición buena: robar lejos de la propia portería.",
    },
    {
      metrica: "contras",
      rotulo: "Contraataques",
      x: 55,
      y: 50,
      nota: "Cuántas veces se salió corriendo al robar.",
    },
    {
      metrica: "contrasRemate",
      rotulo: "Contras con remate",
      x: 80,
      y: 62,
      nota: "Correr mucho sin rematar es correr para nada.",
    },
    {
      metrica: "minutosPorOcasion",
      rotulo: "Minutos por ocasión",
      x: 33,
      y: 62,
      nota: "Cuánto tiempo con balón hace falta para fabricar una ocasión. Menos es más vertical.",
    },
    {
      metrica: "pasesPorOcasion",
      rotulo: "Pases por ocasión",
      x: 33,
      y: 38,
      nota: "Cuántos pases cuesta llegar una vez.",
    },
    {
      metrica: "ataquesPos",
      rotulo: "Ataques posicionales",
      x: 55,
      y: 80,
      nota: "La otra vía: recomponer y empezar de nuevo. Los equipos completos tienen las dos.",
    },
  ],

  /* ---------------------- TRANSICIÓN DEFENSIVA --------------------- */
  trDef: [
    {
      metrica: "perdidas",
      rotulo: "Pérdidas",
      x: 50,
      y: 50,
      nota: "Todas las veces que se entregó el balón.",
    },
    {
      metrica: "perdidasBajas",
      rotulo: "Pérdidas en campo propio",
      x: 22,
      y: 28,
      nota: "Las caras: cada una es una transición del rival cerca de nuestra área.",
    },
    {
      metrica: "faltas",
      rotulo: "Faltas cometidas",
      x: 38,
      y: 76,
      nota: "Cortar la contra con falta frena al rival pero le regala la jugada ensayada.",
    },
    {
      metrica: "recuperacionesAltas",
      rotulo: "Presión tras pérdida",
      x: 70,
      y: 28,
      nota: "Robos en campo contrario: es lo que convierte una pérdida arriba en un intercambio que sale a cuenta.",
    },
    {
      metrica: "tirosContra",
      rotulo: "Remates en contra",
      x: 10,
      y: 52,
      nota: "La factura de la transición defensiva, cuando el repliegue no llega.",
    },
  ],

  /* -------------------------- BALÓN PARADO ------------------------- */
  abp: [
    {
      metrica: "corners",
      rotulo: "Córners a favor",
      x: 88,
      y: 12,
      nota: "El volumen de la estrategia ofensiva. Sin él no hay nada que rentabilizar.",
    },
    {
      metrica: "cornersRemate",
      rotulo: "Córners con remate",
      x: 88,
      y: 88,
      nota: "Lo que de verdad se entrena: que el córner acabe en cabeza.",
    },
    {
      metrica: "abp",
      rotulo: "Jugadas de ABP",
      x: 68,
      y: 50,
      nota: "Todas las jugadas paradas, no sólo los córners.",
    },
    {
      metrica: "abpRemate",
      rotulo: "ABP con remate",
      x: 82,
      y: 34,
      nota: "Qué parte de la estrategia termina en disparo.",
    },
    {
      metrica: "corners",
      rotulo: "Córners en contra",
      x: 12,
      y: 12,
      contra: true,
      nota: "Los que concede el equipo. Salen de la fila del rival en el mismo informe.",
    },
    {
      metrica: "cornersRemate",
      rotulo: "Córners en contra rematados",
      x: 12,
      y: 88,
      contra: true,
      nota: "De los córners que se conceden, cuántos acaban en remate suyo.",
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  EL CÁLCULO                                                         */
/* ------------------------------------------------------------------ */

export type ValorFicha = {
  ficha: FichaCampo;
  nombre: string;
  unidad: "entero" | "decimal" | "porcentaje" | "minutos";
  mejorAlto: boolean | null;
  /** Lo del partido elegido. */
  partido: number | null;
  /** Lo que llevamos de temporada. */
  media: number | null;
  /** Diferencia en tanto por ciento, con el sentido de la métrica puesto. */
  diferencia: number | null;
};

/**
 * Las cifras de un momento, para un partido y para la media.
 *
 * `nuestros` son nuestras filas de la temporada y `contrarios` las de quien nos
 * jugó, que hacen falta para las fichas marcadas «en contra» —los córners que
 * concedemos no son una columna: son los que sacó el rival—.
 */
export function fichasDe(
  momento: MomentoJuego,
  delPartido: FilaPartido | null,
  contraDelPartido: FilaPartido | null,
  nuestros: FilaPartido[],
  contrarios: FilaPartido[],
): ValorFicha[] {
  return FICHAS[momento]
    .map((ficha) => {
      const met = METRICA_POR_KEY.get(ficha.metrica);

      if (!met) return null;

      const fila = ficha.contra ? contraDelPartido : delPartido;
      const grupo = ficha.contra ? contrarios : nuestros;

      const partido = fila ? valorEnPartido(met, fila) : null;
      const media = valorEnGrupo(met, grupo);

      /*
      | El sentido, una sola vez y al final.
      |
      | Dos cosas lo giran y hay que aplicarlas juntas, no una detrás de otra:
      | que la métrica sea de las de «menos es mejor» —PPDA, pérdidas— y que la
      | ficha mire al rival, donde más suyo es peor para nosotros. Calcularlo
      | por separado las cancelaba entre sí en los córners concedidos.
      */
      const mejorAlto =
        met.mejorAlto === null
          ? null
          : ficha.contra
            ? !met.mejorAlto
            : met.mejorAlto;

      const bruta =
        partido === null || media === null || media === 0
          ? null
          : ((partido - media) / Math.abs(media)) * 100;

      return {
        ficha,
        nombre: met.nombre,
        unidad: met.unidad,
        mejorAlto,
        partido,
        media,
        diferencia:
          bruta === null ? null : mejorAlto === false ? -bruta : bruta,
      };
    })
    .filter((v): v is ValorFicha => v !== null);
}

/** Los partidos del Castilla, del más reciente al más viejo. */
export const partidosDe = (nuestros: FilaPartido[]) =>
  [...nuestros].sort((a, b) => b.fecha.localeCompare(a.fecha));

/**
 * La frase que resume un momento en un partido.
 *
 * Sale de las mismas fichas del dibujo: lo que más se separó de nuestra media
 * por arriba y por abajo, con el sentido de cada métrica ya puesto.
 */
export function lecturaDeMomento(fichas: ValorFicha[], rival: string) {
  const utiles = fichas.filter(
    (f): f is ValorFicha & { diferencia: number } =>
      f.diferencia !== null && f.mejorAlto !== null,
  );

  if (utiles.length === 0) {
    return "No hay bastantes cifras de este partido para compararlo con la media.";
  }

  const orden = [...utiles].sort((a, b) => b.diferencia - a.diferencia);

  const mejor = orden[0];
  const peor = orden[orden.length - 1];

  const porEncima = utiles.filter((f) => f.diferencia > 0).length;

  return `Contra ${rival}, de ${utiles.length} cifras con un sentido claro se quedaron ${porEncima} por encima de nuestra media. Lo más destacado fue ${mejor.ficha.rotulo.toLowerCase()} (${mejor.diferencia >= 0 ? "+" : ""}${mejor.diferencia.toFixed(0)} %); lo que más se cayó, ${peor.ficha.rotulo.toLowerCase()} (${peor.diferencia >= 0 ? "+" : ""}${peor.diferencia.toFixed(0)} %).`;
}
