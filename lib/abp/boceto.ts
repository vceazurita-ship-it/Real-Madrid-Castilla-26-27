/**
 * EL BOCETO DEL MICROCICLO DE BALÓN PARADO.
 *
 * Propone —no cierra— la semana de ABP: qué día se trabaja, qué aspectos,
 * cuántos minutos y dónde cae cada cosa. Lo que sale entra en la pantalla como
 * un plan cualquiera, para que el cuerpo técnico lo mueva, lo recorte y lo
 * cierre.
 *
 * LOS DÍAS LOS PONE LA HOJA, NO EL CALENDARIO
 *
 * Un microciclo no es una semana natural: el del Sant Andreu va **de domingo a
 * miércoles** —se entrena el 20, el 21 y el 22 y se juega el 23—. Quién sabe
 * eso es la hoja de registro de tareas, donde el cuerpo técnico escribe el día,
 * el MD y la fecha de cada tarea. `lib/abp/ventana.ts` la lee y devuelve los
 * días; aquí sólo se reparte el trabajo entre ellos. **Si el microciclo no está
 * creado en la hoja, no hay boceto**: hay que crearlo primero.
 *
 * QUÉ DECIDE LOS ASPECTOS
 *
 * 1. **Nuestro rendimiento**: la urgencia de `lib/abp/transferencia.ts`, con lo
 *    que pasa en competición, lo mal que nos va cuando pasa y lo poco que se ha
 *    trabajado esta temporada.
 * 2. **El rival**: `lib/abp/rivalAbp.ts` (Wyscout por equipo, los goles de ABP
 *    calibrados con Opta y nuestras hojas si ya le jugamos). Lo que el rival
 *    **ataca** se defiende; lo que **concede** se ataca.
 *
 * DÓNDE CAE CADA COSA
 *
 * Lo específico del rival, pegado al partido, que es cuando se retiene; lo
 * nuestro, lo que no depende de quién venga, más lejos. El día antes no se
 * estrena nada: ensayo corto y suave de lo principal. Y el vídeo del rival,
 * antes del primer trabajo de campo que lo use. El vídeo y el ensayo **salen
 * del presupuesto de minutos**, no se suman encima.
 *
 * NO INVENTA NADA QUE NO SE PUEDA JUSTIFICAR: cada tarea sale con su motivo
 * escrito y con la cifra de la que viene, y los aspectos que ninguna hoja
 * registra se quedan fuera.
 */

import { objetivoDeLaSemana } from "@/lib/abp/informe-micro";
import {
  ASPECTO_BY_KEY,
  DIA_KEYS,
  claveAspecto,
  diasCompletos,
  nuevoTrabajo,
  type AbpLado,
  type AbpMedio,
  type AbpMomento,
  type AbpRol,
  type AspectoKey,
  type DiaKey,
  type MicroPlan,
  type PlanDia,
  type Trabajo,
} from "@/lib/abp/microciclo";
import type { FilaCruce } from "@/lib/abp/transferencia";
import type { RivalAbp } from "@/lib/abp/rivalAbp";
import type { DiaMicro, VentanaMicro } from "@/lib/abp/ventana";

/* ------------------------------------------------------------------ */
/*  CRITERIOS                                                          */
/* ------------------------------------------------------------------ */

/**
 * Cuánto pesa cada cosa al elegir los aspectos.
 *
 * Se declaran aquí, como los de `transferencia.ts`, porque son un criterio del
 * cuerpo técnico y se van a querer discutir. Lo nuestro pesa algo más a
 * propósito: el rival cambia cada semana; lo que no sabemos hacer sigue ahí la
 * siguiente.
 */
export const PESOS_BOCETO = {
  nuestro: 0.55,
  rival: 0.45,
};

/** Cuántos aspectos distintos toca un microciclo. Más de esto es una lista, no un plan. */
export const ASPECTOS_POR_SEMANA = { minimo: 2, maximo: 6 };

/** Los minutos de una tarea se redondean a esto. */
const PASO_MINUTOS = 5;

const MINIMO_TAREA = 10;

/** La marca que deja el boceto en sus tareas, para poder rehacerlo sin duplicar. */
export const MARCA_BOCETO = "Boceto ·";

export function esDelBoceto(trabajo: Trabajo) {
  return (trabajo.notas || "").startsWith(MARCA_BOCETO);
}

/* ------------------------------------------------------------------ */
/*  QUÉ TRABAJAR                                                       */
/* ------------------------------------------------------------------ */

export type Candidato = {
  aspecto: AspectoKey;
  lado: AbpLado;
  /** 0..1, lo que manda en el reparto. */
  puntos: number;
  nuestro: number;
  delRival: number;
  /** Si lo pide el rival o lo pedimos nosotros: cambia dónde cae. */
  esDelRival: boolean;
  motivo: string;
  minutos: number;
};

const normaliza = (valor: number, tope: number) =>
  tope > 0 ? Math.max(0, Math.min(1, valor / tope)) : 0;

/**
 * Ordena el catálogo por lo que pide este microciclo contra este rival.
 *
 * La urgencia nuestra viene ya calculada por aspecto y lado; del rival se usa
 * lo que ataca para nuestro trabajo **defensivo** y lo que concede para el
 * **ofensivo**. Un aspecto que ninguna hoja puede reconocer no entra: no es un
 * cero, es que no hay dónde mirar.
 */
export function ordenaCandidatos(
  filas: FilaCruce[],
  rival: RivalAbp | null,
): Candidato[] {
  const urgencias = filas
    .map((fila) => fila.urgencia)
    .filter((valor): valor is number => valor != null);

  const topeUrgencia = Math.max(1, ...urgencias);

  const candidatos: Candidato[] = [];

  for (const fila of filas) {
    if (!fila.aspecto.reconocimiento) continue;

    const nuestro = normaliza(fila.urgencia ?? 0, topeUrgencia);

    const delRival =
      fila.lado === "defensivo"
        ? (rival?.ataca[fila.aspecto.key] ?? 0)
        : (rival?.concede[fila.aspecto.key] ?? 0);

    const puntos = PESOS_BOCETO.nuestro * nuestro + PESOS_BOCETO.rival * delRival;

    if (puntos <= 0) continue;

    candidatos.push({
      aspecto: fila.aspecto.key,
      lado: fila.lado,
      puntos,
      nuestro,
      delRival,
      /* Lo que pide el rival más que nosotros va pegado al partido. */
      esDelRival: PESOS_BOCETO.rival * delRival > PESOS_BOCETO.nuestro * nuestro,
      minutos: 0,
      motivo: motivoDe(fila, rival, delRival),
    });
  }

  return candidatos.sort((a, b) => b.puntos - a.puntos);
}

function motivoDe(fila: FilaCruce, rival: RivalAbp | null, delRival: number) {
  const trozos: string[] = [];

  if (fila.urgencia != null) {
    trozos.push(
      `urgencia ${Math.round(fila.urgencia)}/100 (${fila.stats.acciones} acciones, ${Math.round(
        fila.peligroAjustado,
      )} % de peligro contra ${Math.round(fila.referencia)} % de su familia)`,
    );
  }

  const dicho = rival?.motivos[claveAspecto(fila.aspecto.key, fila.lado)];

  if (dicho) trozos.push(dicho);
  else if (delRival > 0 && rival) {
    trozos.push(
      fila.lado === "defensivo"
        ? `${rival.equipo} lo usa por encima de la media`
        : `${rival.equipo} lo concede por encima de la media`,
    );
  }

  return trozos.join(" · ") || "propuesto por catálogo: no hay datos que lo ordenen";
}

/**
 * Reparte unos minutos entre los aspectos elegidos.
 *
 * Proporcional a los puntos, redondeado a cinco minutos y con un suelo: una
 * tarea de tres minutos no es una tarea. El sobrante del redondeo se ajusta en
 * el primero, que es el que más margen tiene.
 */
export function repartePorAspecto(
  candidatos: Candidato[],
  minutos: number,
  cuantosMaximo = ASPECTOS_POR_SEMANA.maximo,
): Candidato[] {
  if (minutos < MINIMO_TAREA || candidatos.length === 0) return [];

  const cuantos = Math.max(1, Math.min(cuantosMaximo, Math.floor(minutos / MINIMO_TAREA)));

  const elegidos = candidatos.slice(0, cuantos).map((uno) => ({ ...uno }));

  const suma = elegidos.reduce((total, uno) => total + uno.puntos, 0) || 1;

  let repartido = 0;

  elegidos.forEach((uno, indice) => {
    const bruto = (uno.puntos / suma) * minutos;

    uno.minutos =
      indice === elegidos.length - 1
        ? Math.max(MINIMO_TAREA, minutos - repartido)
        : Math.max(MINIMO_TAREA, Math.round(bruto / PASO_MINUTOS) * PASO_MINUTOS);

    repartido += uno.minutos;
  });

  const sobra = repartido - minutos;

  if (sobra !== 0 && elegidos[0].minutos - sobra >= MINIMO_TAREA) {
    elegidos[0].minutos -= sobra;
  }

  return elegidos;
}

/* ------------------------------------------------------------------ */
/*  EL BOCETO                                                          */
/* ------------------------------------------------------------------ */

export type EntradaBoceto = {
  /** Los días del microciclo, de la hoja de registro. */
  ventana: VentanaMicro;
  filas: FilaCruce[];
  rival: RivalAbp | null;
  /** El plan que ya hubiera, para no borrar lo escrito a mano. */
  plan?: MicroPlan;
};

export type Boceto = {
  dias: Record<DiaKey, PlanDia>;
  /** El orden del microciclo, que no es el de la semana natural. */
  orden: DiaKey[];
  diasEntrenados: number;
  minutos: number;
  minutosVideo: number;
  minutosEnsayo: number;
  objetivo: { minimo: number; maximo: number };
  candidatos: Candidato[];
  avisos: string[];
};

const ROLES_POR_LADO: Record<AbpLado, AbpRol[]> = {
  ofensivo: ["sacadores", "fijadores", "rematadores"],
  defensivo: ["fijadores", "rematadores"],
};

type Sitio = {
  momento: AbpMomento;
  medio: AbpMedio;
  intensidad: number;
  exigCognitiva: number;
};

/**
 * Cómo se trabaja según lo cerca que esté el partido.
 *
 * MD-1 no estrena nada: ensayo corto y suave. MD-2 y MD-3 son el grueso, donde
 * se puede exigir. Más lejos, intensidad media: el cuerpo viene del partido
 * anterior.
 */
function sitioDe(md: number | null): Sitio {
  const cuando = md ?? 4;

  if (cuando <= 1) return { momento: "post", medio: "campo", intensidad: 4, exigCognitiva: 6 };

  if (cuando <= 3) return { momento: "intra", medio: "campo", intensidad: 7, exigCognitiva: 7 };

  return { momento: "intra", medio: "campo", intensidad: 6, exigCognitiva: 5 };
}

export function construyeBoceto(entrada: EntradaBoceto): Boceto {
  const { ventana, filas, rival } = entrada;

  const avisos = [...ventana.avisos];

  const entrenos = ventana.entrenos;

  const objetivo = objetivoDeLaSemana(0, entrenos.length, "marcados");

  const total = Math.round((objetivo.minimo + objetivo.maximo) / 2);

  /* ---------------------------------------------------------------- */
  /*  EL PRESUPUESTO                                                   */
  /* ---------------------------------------------------------------- */

  /*
  | El vídeo y el ensayo SALEN del presupuesto, no se suman encima.
  |
  | Sumándolos, un microciclo de tres entrenamientos se plantaba en 84′ con un
  | objetivo de 45-50′: el plan nacía pasado de vueltas y había que recortarlo a
  | mano, que es justo lo que el boceto tiene que ahorrar.
  |
  | Y si sólo cabe una de las dos cosas, cabe **el ensayo**: es lo último que
  | queda en la cabeza y lo que de verdad se ejecuta el día del partido.
  */
  const diaEnsayo = entrenos.find((dia) => (dia.md ?? 99) <= 1) ?? null;

  const minutosEnsayo =
    diaEnsayo && total >= 25
      ? Math.max(
          MINIMO_TAREA,
          Math.min(15, Math.round((total * 0.15) / PASO_MINUTOS) * PASO_MINUTOS),
        )
      : 0;

  const minutosVideo = rival && total - minutosEnsayo >= 20 ? 10 : 0;

  const deCampo = Math.max(0, total - minutosEnsayo - minutosVideo);

  const deTrabajo = entrenos.filter((dia) => dia !== diaEnsayo);

  const donde = deTrabajo.length > 0 ? deTrabajo : entrenos;

  const candidatos = repartePorAspecto(
    ordenaCandidatos(filas, rival),
    deCampo,
    Math.max(ASPECTOS_POR_SEMANA.minimo, Math.min(ASPECTOS_POR_SEMANA.maximo, donde.length + 1)),
  );

  if (entrenos.length === 0) {
    avisos.push("Este microciclo no tiene días de entrenamiento en la hoja.");
  }

  if (!rival && ventana.partido) {
    avisos.push(
      `Sin datos de balón parado del ${ventana.partido.rival}: el boceto sale sólo de nuestro rendimiento.`,
    );
  }

  if (candidatos.length === 0 && entrenos.length > 0) {
    avisos.push(
      "Las hojas de ABP no han devuelto acciones que ordenar: el boceto marca los días, pero las tareas hay que ponerlas a mano.",
    );
  }

  /* ---------------------------------------------------------------- */
  /*  LOS DÍAS                                                         */
  /* ---------------------------------------------------------------- */

  const plan = diasCompletos(entrada.plan);

  /* El boceto no pisa lo escrito a mano: sólo se quita lo suyo de la vez
     anterior. */
  for (const clave of DIA_KEYS) {
    plan[clave] = {
      ...plan[clave],
      trabajos: plan[clave].trabajos.filter((trabajo) => !esDelBoceto(trabajo)),
    };
  }

  for (const dia of ventana.dias) {
    plan[dia.clave] = {
      tipo: dia.tipo,
      md: dia.rotulo,
      trabajos: dia.tipo === "entreno" ? plan[dia.clave].trabajos : [],
    };
  }

  colocaTrabajo(plan, candidatos, donde, rival, minutosVideo);

  if (diaEnsayo && minutosEnsayo > 0 && candidatos.length > 0) {
    const principales = candidatos.slice(0, Math.min(2, candidatos.length));

    plan[diaEnsayo.clave].trabajos.push(
      tareaDe(
        { ...principales[0], minutos: minutosEnsayo },
        sitioDe(1),
        `${MARCA_BOCETO} ensayo del día antes: se repasa lo principal del microciclo${
          ventana.partido ? ` para el ${ventana.partido.rival}` : ""
        }, sin estrenar nada.`,
        principales.map((uno) => uno.aspecto),
        [...new Set(principales.map((uno) => uno.lado))],
      ),
    );
  }

  const minutos = DIA_KEYS.reduce(
    (suma, clave) =>
      suma + plan[clave].trabajos.reduce((parcial, uno) => parcial + (uno.minutos || 0), 0),
    0,
  );

  return {
    dias: plan,
    orden: ventana.dias.map((dia) => dia.clave),
    diasEntrenados: entrenos.length,
    minutos,
    minutosVideo,
    minutosEnsayo,
    objetivo: { minimo: objetivo.minimo, maximo: objetivo.maximo },
    candidatos,
    avisos,
  };
}

/**
 * Coloca las tareas de campo en sus días.
 *
 * Los días van de lejos a cerca del partido, así que los candidatos se ordenan
 * al revés de como se leen: **lo nuestro primero** —con el partido lejos, que
 * es cuando se puede enseñar algo nuevo— y **lo del rival al final**, pegado al
 * partido, que es lo que hay que tener fresco. Si hay más tareas que días, los
 * últimos días doblan.
 */
function colocaTrabajo(
  plan: Record<DiaKey, PlanDia>,
  candidatos: Candidato[],
  donde: DiaMicro[],
  rival: RivalAbp | null,
  minutosVideo: number,
) {
  if (candidatos.length === 0 || donde.length === 0) return;

  const orden = [...donde].sort((a, b) => (b.md ?? 0) - (a.md ?? 0));

  const enOrden = [...candidatos].sort((a, b) => {
    if (a.esDelRival !== b.esDelRival) return a.esDelRival ? 1 : -1;

    return a.puntos - b.puntos;
  });

  const porDia = new Map<DiaKey, Candidato[]>();

  enOrden.forEach((candidato, indice) => {
    const dia = orden[Math.min(indice, orden.length - 1)];

    porDia.set(dia.clave, [...(porDia.get(dia.clave) ?? []), candidato]);
  });

  let primeroConRival: DiaKey | null = null;

  for (const dia of orden) {
    for (const candidato of porDia.get(dia.clave) ?? []) {
      if (candidato.minutos <= 0) continue;

      if (!primeroConRival && candidato.esDelRival) primeroConRival = dia.clave;

      plan[dia.clave].trabajos.push(
        tareaDe(candidato, sitioDe(dia.md), `${MARCA_BOCETO} ${candidato.motivo}`),
      );
    }
  }

  /*
  | Diez minutos de sala antes del primer trabajo de campo específico.
  |
  | Es lo que hace que ese trabajo se entienda: cómo saca, quién remata, cómo
  | se colocan. Sólo se pone si hay algo que enseñar.
  */
  if (rival && minutosVideo > 0) {
    const dia = primeroConRival ?? orden[Math.max(0, orden.length - 1)]?.clave;

    if (dia) {
      const delRival = candidatos.filter((uno) => uno.esDelRival).slice(0, 3);

      const paraVer = delRival.length > 0 ? delRival : candidatos.slice(0, 2);

      plan[dia].trabajos.unshift(
        tareaDe(
          { ...paraVer[0], minutos: minutosVideo },
          { momento: "pre", medio: "video", intensidad: 1, exigCognitiva: 7 },
          `${MARCA_BOCETO} vídeo del ${rival.equipo}: ${rival.resumen}`,
          paraVer.map((uno) => uno.aspecto),
          [...new Set(paraVer.map((uno) => uno.lado))],
        ),
      );
    }
  }
}

function tareaDe(
  candidato: Candidato,
  sitio: Sitio,
  notas: string,
  aspectos?: AspectoKey[],
  lados?: AbpLado[],
): Trabajo {
  const suyos = (aspectos?.length ? aspectos : [candidato.aspecto]).filter((clave) =>
    ASPECTO_BY_KEY.has(clave),
  );

  const susLados = lados?.length ? lados : [candidato.lado];

  return nuevoTrabajo({
    aspectos: suyos,
    lados: susLados,
    momento: sitio.momento,
    medio: sitio.medio,
    roles:
      sitio.medio === "video"
        ? []
        : ([...new Set(susLados.flatMap((lado) => ROLES_POR_LADO[lado]))] as AbpRol[]),
    minutos: candidato.minutos,
    intensidad: sitio.intensidad,
    exigCognitiva: sitio.exigCognitiva,
    notas,
  });
}
