/**
 * LA SEMANA, REVISADA ANTES DE DARLA POR BUENA (21/10/2026).
 *
 * Tres piezas que usa `/abp-microciclo` encima del plan:
 *
 * 1. `conVentana` — los días que la hoja de registro (o el calendario) ya sabe
 *    —qué día se juega, cuál se descansa, qué MD es cada uno— pintados sobre
 *    el plan cuando nadie los ha marcado a mano. Todo día nace «entreno», así
 *    que una semana sin tocar enseñaba el domingo de partido como
 *    entrenamiento y contaba siete días de trabajo.
 *
 * 2. `revisaSemana` — lo que un entrenador de balón parado mira antes de
 *    cerrar el microciclo: los minutos contra el objetivo, tareas sin tiempo o
 *    sin carga, el MD-1 (se repasa, no se estrena ni se carga), el vídeo antes
 *    del campo, los dos lados y lo más urgente que no está en la semana. Cada
 *    punto dice qué pasa y, si toca, en qué día y en qué tarea.
 *
 * 3. `lecturaDelPartido` — cuando el partido ya se jugó, lo trabajado en la
 *    semana contra lo que pasó en ESE partido, aspecto por aspecto.
 *
 * Nada de esto escribe: son lecturas del plan y de las hojas.
 */

import {
  ASPECTO_BY_KEY,
  DIAS,
  cargaCondicional,
  claveAspecto,
  diasCompletos,
  ladosDe,
  type AbpLado,
  type AspectoKey,
  type DiaKey,
  type MicroPlan,
  type PlanDia,
  type TipoDia,
  type Trabajo,
} from "@/lib/abp/microciclo";
import { encajaEnAspecto, type CompeticionEvent } from "@/lib/abp/competicion";
import { MARCA_BOCETO } from "@/lib/abp/minutos";
import { enFrase, enPrimeraPlural } from "@/lib/abp/primera-plural";
import type { FilaCruce } from "@/lib/abp/transferencia";

/* ------------------------------------------------------------------ */
/*  LOS DÍAS QUE YA SE SABEN                                           */
/* ------------------------------------------------------------------ */

export type DiaSabido = {
  clave: DiaKey;
  tipo: TipoDia;
  /** «MD-3», «MD»… vacío si no se sabe. */
  rotulo: string;
};

/**
 * Pinta sobre el plan el tipo y el MD de cada día cuando nadie los ha tocado.
 *
 * «Sin tocar» es un MD vacío: el boceto y la mano lo escriben siempre, y un
 * día con su MD puesto se respeta tal cual, también su tipo. Si varios días
 * de la ventana comparten letra (un parón de nueve días), gana el último: el
 * plan guarda un día por letra y son los siete últimos los que se trabajan.
 */
export function conVentana(plan: MicroPlan, sabidos: DiaSabido[]): MicroPlan {
  if (!sabidos.length) return plan;

  const dias = { ...diasCompletos(plan) };

  let cambia = false;

  for (const sabido of sabidos) {
    const actual: PlanDia = dias[sabido.clave];

    if (!actual || actual.md.trim()) continue;

    const tipo = actual.tipo === "entreno" ? sabido.tipo : actual.tipo;
    const md = sabido.rotulo;

    if (tipo === actual.tipo && md === actual.md) continue;

    dias[sabido.clave] = { ...actual, tipo, md };
    cambia = true;
  }

  /*
  | Las letras que NO son de este microciclo (uno de miércoles a domingo no
  | tiene lunes ni martes) no son días de entrenamiento suyos: vacías y sin
  | tocar, cuentan como libres. Si no, seguían naciendo «entreno» y el
  | objetivo de minutos se calculaba con seis días en vez de con cuatro.
  */
  const suyas = new Set(sabidos.map((sabido) => sabido.clave));

  for (const clave of Object.keys(dias) as DiaKey[]) {
    const actual = dias[clave];

    if (suyas.has(clave) || actual.md.trim() || actual.trabajos.length || actual.tipo !== "entreno") continue;

    dias[clave] = { ...actual, tipo: "descanso" };
    cambia = true;
  }

  return cambia ? { ...plan, dias } : plan;
}

/** «MD-3» → 3, «MD» → 0, lo demás → null. */
export function numeroMd(rotulo: string): number | null {
  const limpio = (rotulo || "").toUpperCase().replace(/\s+/g, "");

  if (limpio === "MD") return 0;

  const menos = limpio.match(/^MD-(\d+)$/);

  return menos ? Number(menos[1]) : null;
}

/* ------------------------------------------------------------------ */
/*  REVISIÓN                                                           */
/* ------------------------------------------------------------------ */

export type TonoRevision = "bien" | "aviso" | "alerta";

export type PuntoRevision = {
  id: string;
  tono: TonoRevision;
  titulo: string;
  detalle: string;
  /** Para abrir la tarea de la que habla, si habla de una. */
  dia?: DiaKey;
  trabajo?: Trabajo;
  /** Para proponer una tarea de lo que falta. */
  falta?: { aspecto: AspectoKey; lado: AbpLado };
};

const nombreDia = (clave: DiaKey) => DIAS.find((dia) => dia.key === clave)?.label.toLowerCase() ?? clave;

/** «viernes y sábado», «lunes, martes y jueves». */
function enLista(partes: string[]) {
  const unicas = [...new Set(partes)];

  if (unicas.length <= 1) return unicas[0] ?? "";

  return `${unicas.slice(0, -1).join(", ")} y ${unicas[unicas.length - 1]}`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const nombreAspecto = (clave: AspectoKey) => ASPECTO_BY_KEY.get(clave)?.label ?? clave;

export function revisaSemana({
  plan,
  orden,
  objetivo,
  urgentes,
}: {
  /** El plan ya pasado por `conVentana`. */
  plan: MicroPlan;
  /** Los días del microciclo, en su orden. */
  orden: DiaKey[];
  objetivo: { minimo: number; maximo: number };
  /** Lo más urgente de la competición (las cinco de la pantalla). */
  urgentes: FilaCruce[];
}): PuntoRevision[] {
  const puntos: PuntoRevision[] = [];

  /*
  | Cada tarjeta abre SU tarea (30/10/2026, expertos): dos de tres llevaban
  | «Abrir "Córner directo + 6"». De cada lista se elige la primera tarea que
  | no haya señalado ya otra tarjeta; si todas lo están, la primera.
  */
  const usados = new Set<string>();
  const elegidas = new Map<unknown, { trabajo: Trabajo }>();
  const libre = <E extends { trabajo: Trabajo }>(lista: E[]): E => {
    const ya = elegidas.get(lista) as E | undefined;

    if (ya) return ya;

    const una = lista.find((x) => !usados.has(x.trabajo.id)) ?? lista[0];

    usados.add(una.trabajo.id);
    elegidas.set(lista, una);

    return una;
  };

  const dias = diasCompletos(plan);

  const enOrden = orden.length ? orden : (Object.keys(dias) as DiaKey[]);

  const entradas = enOrden.flatMap((clave) =>
    (dias[clave]?.trabajos ?? []).map((trabajo) => ({ dia: clave, trabajo })),
  );

  const minutos = entradas.reduce((total, { trabajo }) => total + (trabajo.minutos || 0), 0);

  /* ---------------------------- MINUTOS ---------------------------- */

  if (!entradas.length) {
    puntos.push({
      id: "vacia",
      tono: "alerta",
      titulo: "La semana está vacía",
      detalle: `El objetivo es ${objetivo.minimo}-${objetivo.maximo}′ de balón parado. «Proponer boceto» la monta entera con el rival y lo que más urge.`,
    });
  } else if (minutos < objetivo.minimo) {
    const faltan = objetivo.minimo - minutos;

    puntos.push({
      id: "minutos",
      tono: faltan <= 5 ? "aviso" : "alerta",
      titulo: `Faltan ${faltan}′ para el objetivo`,
      /* Con tareas pero sin minutos, «0′ de 60-67′» repetía la tarjeta. */
      detalle: minutos
        ? `${minutos}′ de ${objetivo.minimo}-${objetivo.maximo}′.`
        : `Ninguna tarea tiene minutos todavía: ponle tiempo o pide el boceto.`,
    });
  } else if (minutos > objetivo.maximo) {
    /* 29/10/2026: la tarjeta decía cuánto sobra pero no de dónde quitarlo. Se
       señala el día con más minutos y lo que se repite, y se puede abrir. */
    const porDia = new Map<DiaKey, number>();

    for (const { dia, trabajo } of entradas) porDia.set(dia, (porDia.get(dia) ?? 0) + (trabajo.minutos || 0));

    const [diaMayor, minutosMayor] = [...porDia.entries()].sort((x, y) => y[1] - x[1])[0];
    const delMayor = entradas.filter(({ dia }) => dia === diaMayor);
    const masLarga = [...delMayor].sort((x, y) => (y.trabajo.minutos || 0) - (x.trabajo.minutos || 0))[0];

    const repetidas = new Map<string, { dias: Set<DiaKey>; minutos: number }>();

    for (const { dia, trabajo } of entradas) {
      const clave = [...trabajo.aspectos].sort().join("+");
      const previa = repetidas.get(clave) ?? { dias: new Set<DiaKey>(), minutos: 0 };

      previa.dias.add(dia);
      previa.minutos += trabajo.minutos || 0;
      repetidas.set(clave, previa);
    }

    const repetida = [...repetidas.entries()].filter(([, v]) => v.dias.size >= 3).sort((x, y) => y[1].minutos - x[1].minutos)[0];

    if (masLarga) usados.add(masLarga.trabajo.id);

    /* 30/10/2026 (expertos): cuánto sobra ya lo dice la barra de la tarjeta
       del partido; aquí, sólo qué quitar. */
    puntos.push({
      id: "minutos",
      tono: "aviso",
      titulo: `Para bajar a ${objetivo.maximo}′: aligerar el ${nombreDia(diaMayor)}`,
      detalle: `Sobran ${minutos - objetivo.maximo}′. El ${nombreDia(diaMayor)} lleva ${minutosMayor}′ en ${plural(delMayor.length, "tarea", "tareas")}${
        repetida
          ? `; ${repetida[0].split("+").map((a) => nombreAspecto(a as AspectoKey)).join(" y ").toLowerCase()} sale ${repetida[1].dias.size} días (${repetida[1].minutos}′): dejar uno`
          : ""
      }.`,
      dia: diaMayor,
      trabajo: masLarga?.trabajo,
    });
  } else {
    puntos.push({
      id: "minutos",
      tono: "bien",
      titulo: "Minutos dentro del objetivo",
      detalle: `${minutos}′ de ${objetivo.minimo}-${objetivo.maximo}′.`,
    });
  }

  /* -------------------------- SIN TIEMPO -------------------------- */

  const sinTiempo = entradas.filter(({ trabajo }) => !(trabajo.minutos > 0));

  if (sinTiempo.length) {
    puntos.push({
      id: "sin-tiempo",
      tono: "alerta",
      titulo: `${plural(sinTiempo.length, "tarea", "tareas")} sin tiempo`,
      detalle: `${enLista(sinTiempo.map(({ dia }) => nombreDia(dia)))}: sin minutos no suman a la semana ni a la carga.`,
      dia: libre(sinTiempo).dia,
      trabajo: libre(sinTiempo).trabajo,
    });
  }

  /* -------------------------- SIN CARGA -------------------------- */

  const sinCarga = entradas.filter(
    ({ trabajo }) => trabajo.minutos > 0 && !(trabajo.intensidad > 0) && trabajo.cargaRegistrada == null,
  );

  if (sinCarga.length) {
    puntos.push({
      id: "sin-carga",
      tono: "aviso",
      titulo: `${plural(sinCarga.length, "tarea", "tareas")} sin intensidad`,
      detalle: (() => {
        const dias = [...new Set(sinCarga.map(({ dia }) => nombreDia(dia)))];

        return `Sin ella no se lee la carga ${dias.length === 1 ? "del" : "de"} ${enLista(dias)}.`;
      })(),
      dia: libre(sinCarga).dia,
      trabajo: libre(sinCarga).trabajo,
    });
  }

  /* ------------------- TRABAJO EN DÍAS SIN SESIÓN ------------------ */

  /* El vídeo previo (PRE) el día del partido es normal: no es un error de planificación. */
  const fueraDeSesion = entradas.filter(
    ({ dia, trabajo }) =>
      dias[dia]?.tipo !== "entreno" &&
      !(dias[dia]?.tipo === "partido" && trabajo.medio === "video" && trabajo.momento === "pre"),
  );

  if (fueraDeSesion.length) {
    puntos.push({
      id: "fuera",
      tono: "alerta",
      titulo: "Hay tareas en un día sin entrenamiento",
      detalle: `${enLista(
        fueraDeSesion.map(({ dia }) => `${nombreDia(dia)} (${dias[dia]?.tipo === "partido" ? "partido" : "descanso"})`),
      )}: muévelas a un día de sesión.`,
      dia: libre(fueraDeSesion).dia,
      trabajo: libre(fueraDeSesion).trabajo,
    });
  }

  /* ------------------------------ MD-1 ----------------------------- */

  const md1 = enOrden.find((clave) => numeroMd(dias[clave]?.md ?? "") === 1);

  if (md1) {
    const delMd1 = dias[md1].trabajos;

    const cargada = delMd1.find((trabajo) => trabajo.intensidad >= 7);

    if (cargada) {
      puntos.push({
        id: "md1-carga",
        tono: "aviso",
        titulo: `MD-1 con intensidad ${cargada.intensidad}`,
        detalle: "El día antes del partido se repasa a baja intensidad: mejor 3-5.",
        dia: md1,
        trabajo: (usados.add(cargada.id), cargada),
      });
    }

    /*
    | Lo que se ve por primera vez el día antes no se aprende.
    |
    | Se mira el ASPECTO, no aspecto y lado: una tarea de repaso con cinco
    | aspectos y los dos lados daba diez «estrenos» de combinaciones que nadie
    | trabaja por separado (probado con el micro 17). Defender un córner que se
    | atacó el miércoles no es contenido nuevo para el MD-1.
    */
    const antes = new Set(
      enOrden
        .slice(0, enOrden.indexOf(md1))
        .flatMap((clave) => dias[clave]?.trabajos ?? [])
        .flatMap((trabajo) => trabajo.aspectos),
    );

    const estrenos = [
      ...new Map(
        delMd1.flatMap((trabajo) =>
          trabajo.aspectos
            .filter((aspecto) => !antes.has(aspecto))
            .map((aspecto) => [aspecto, { trabajo, texto: enFrase(nombreAspecto(aspecto)) }] as const),
        ),
      ).values(),
    ];

    if (estrenos.length && antes.size > 0) {
      const nombres = estrenos.map((uno) => uno.texto);

      const dichos = nombres.length > 3 ? [...nombres.slice(0, 3), `${nombres.length - 3} más`] : nombres;

      puntos.push({
        id: "md1-estreno",
        tono: "aviso",
        titulo: "El MD-1 estrena contenido",
        detalle: `${enLista(dichos).replace(/^./, (letra) => letra.toUpperCase())} ${nombres.length === 1 ? "sale" : "salen"} por primera vez el día antes: el MD-1 repasa lo de la semana.`,
        dia: md1,
        trabajo: libre(estrenos).trabajo,
      });
    }

    if (!cargada && !(estrenos.length && antes.size > 0) && delMd1.length) {
      puntos.push({
        id: "md1",
        tono: "bien",
        titulo: "MD-1 de repaso",
        detalle: "Sin carga alta ni contenido nuevo el día antes.",
      });
    }
  }

  /* ----------------------- PICO DE CARGA ----------------------- */

  const cargaDe = (clave: DiaKey) =>
    (dias[clave]?.trabajos ?? []).reduce((total, trabajo) => total + cargaCondicional(trabajo), 0);

  const conCarga = enOrden.filter((clave) => cargaDe(clave) > 0);

  if (conCarga.length >= 2) {
    const pico = [...conCarga].sort((a, b) => cargaDe(b) - cargaDe(a))[0];
    const md = numeroMd(dias[pico]?.md ?? "");

    if (md != null && md <= 1) {
      puntos.push({
        id: "pico",
        tono: "aviso",
        titulo: `El pico de carga cae en el ${dias[pico].md}`,
        detalle: `${nombreDia(pico)} suma ${Math.round(cargaDe(pico))} de carga, la más alta de la semana: el pico va a mitad de microciclo.`,
        dia: pico,
      });
    }
  }

  /* ------------------------ VÍDEO ANTES DEL CAMPO ------------------------ */

  const primeraVez = new Map<string, { indice: number; medio: Trabajo["medio"] }>();

  entradas.forEach(({ trabajo }, indice) => {
    for (const lado of ladosDe(trabajo)) {
      for (const aspecto of trabajo.aspectos) {
        const clave = claveAspecto(aspecto, lado);

        if (!primeraVez.has(clave)) primeraVez.set(clave, { indice, medio: trabajo.medio });
      }
    }
  });

  const tarde = entradas.filter(({ trabajo }, indice) =>
    trabajo.medio === "video" &&
    ladosDe(trabajo).some((lado) =>
      trabajo.aspectos.some((aspecto) => {
        const primera = primeraVez.get(claveAspecto(aspecto, lado));

        return primera != null && primera.indice < indice && primera.medio === "campo";
      }),
    ),
  );

  if (tarde.length) {
    puntos.push({
      id: "video",
      tono: "aviso",
      titulo: (() => {
        const dePartido = tarde.every(({ dia }) => dias[dia]?.tipo === "partido");
        const cuando = enLista([...new Set(tarde.map(({ dia }) => nombreDia(dia)))]);

        /* En el día del partido no se entrena: el consejo habla de salir al campo. */
        return dePartido
          ? `Día del partido (${cuando}): el vídeo está después del campo`
          : `${cuando.replace(/^./, (letra) => letra.toUpperCase())}: el vídeo está después del campo`;
      })(),
      detalle: tarde.every(({ dia }) => dias[dia]?.tipo === "partido")
        ? "Muévelo antes: primero se ve, luego se sale al campo."
        : "Muévelo antes: primero se ve, luego se entrena.",
      dia: libre(tarde).dia,
      trabajo: libre(tarde).trabajo,
    });
  }

  /* ----------------------------- LADOS ----------------------------- */

  if (minutos > 0) {
    const porLado = { ofensivo: 0, defensivo: 0 };

    for (const { trabajo } of entradas) {
      const lados = ladosDe(trabajo);

      for (const lado of lados) porLado[lado] += (trabajo.minutos || 0) / lados.length;
    }

    const falta = (["ofensivo", "defensivo"] as const).find((lado) => porLado[lado] === 0);

    if (falta) {
      puntos.push({
        id: "lados",
        tono: "aviso",
        titulo: `Nada ${falta === "ofensivo" ? "atacando" : "defendiendo"}`,
        detalle: `Toda la semana es ${falta === "ofensivo" ? "defensiva" : "ofensiva"}.`,
      });
    }
  }

  /* ---------------------- LO URGENTE QUE NO ESTÁ ---------------------- */

  const enSemana = new Set(
    entradas.flatMap(({ trabajo }) =>
      ladosDe(trabajo).flatMap((lado) => trabajo.aspectos.map((aspecto) => claveAspecto(aspecto, lado))),
    ),
  );

  const olvidadas = urgentes
    .filter((fila) => (fila.urgencia ?? 0) >= 50 && !enSemana.has(claveAspecto(fila.aspecto.key, fila.lado)))
    .slice(0, 2);

  for (const fila of olvidadas) {
    puntos.push({
      id: `urgente-${fila.aspecto.key}-${fila.lado}`,
      tono: "aviso",
      titulo: `${fila.aspecto.label} ${fila.lado === "ofensivo" ? "a favor" : "en contra"}: no entran en la semana`,
      detalle: `${
        /* Una o dos acciones no hacen urgente nada: se dice el hecho y no se apremia. */
        fila.stats.acciones < 3
          ? `Sólo ${fila.stats.acciones === 1 ? "hay 1 en competición" : `hay ${fila.stats.acciones} en competición`}${fila.peligroAjustado >= 50 ? ", y acabó en peligro" : ""}: es poca muestra.`
          : fila.peligroAjustado < 15
            ? `Se repite mucho en competición (${fila.stats.acciones} acciones) pero casi nunca acaba en peligro (${Math.round(fila.peligroAjustado)} %): un repaso corto basta.`
            : `Es de lo más urgente: ${fila.stats.acciones} acciones en competición y ${Math.round(fila.peligroAjustado)} % de peligro.`
      }${(() => {
        /* Si el mismo aspecto sí se trabaja del otro lado, se dice: si no, parece un olvido sin motivo. */
        const otro = fila.lado === "ofensivo" ? "defensivo" : "ofensivo";

        return enSemana.has(claveAspecto(fila.aspecto.key, otro))
          ? ` Esta semana se trabaja ${otro === "ofensivo" ? "atacando" : "defendiendo"}, pero ${fila.lado === "ofensivo" ? "atacando" : "defendiendo"} no entra.`
          : "";
      })()}`,
      /* Con tan poca muestra no se ofrece añadirla a la semana: sería la acción principal de un dato que ni se fía. */
      ...(fila.stats.acciones < 3 ? {} : { falta: { aspecto: fila.aspecto.key, lado: fila.lado } }),
    });
  }

  /* «Faltan 60′» y «2 tareas sin tiempo» dicen lo mismo: una sola tarjeta que abre la tarea. */
  const iFaltan = puntos.findIndex((punto) => punto.id === "minutos" && punto.titulo.startsWith("Faltan"));
  const iSinTiempo = puntos.findIndex((punto) => punto.id === "sin-tiempo");

  if (iFaltan >= 0 && iSinTiempo >= 0) {
    const sin = puntos[iSinTiempo];

    puntos[iFaltan] = {
      ...sin,
      id: "minutos",
      titulo: `${puntos[iFaltan].titulo} · ${sin.titulo}`,
    };
    puntos.splice(iSinTiempo, 1);
  }

  const orden2: Record<TonoRevision, number> = { alerta: 0, aviso: 1, bien: 2 };

  return puntos.sort((a, b) => orden2[a.tono] - orden2[b.tono]);
}

/* ------------------------------------------------------------------ */
/*  DESPUÉS DEL PARTIDO                                                */
/* ------------------------------------------------------------------ */

export type LecturaAspecto = {
  aspecto: AspectoKey;
  lado: AbpLado;
  label: string;
  /** Minutos de la semana en ese aspecto y lado (repartidos). */
  minutos: number;
  acciones: number;
  /** Acciones con gol u ocasión clara de quien atacaba. */
  peligro: number;
  goles: number;
  /** Para nosotros: atacando, peligro es bueno; defendiendo, malo. */
  veredicto: "bien" | "mal" | "neutro";
};

export type LecturaPartido = {
  /** Lo trabajado que salió en el partido. */
  trabajado: LecturaAspecto[];
  /** Lo trabajado que no salió ni una vez: «penaltis atacando». */
  noSalio: string[];
  /** Lo que no estaba en la semana y acabó en gol u ocasión clara. */
  sinTrabajar: LecturaAspecto[];
  acciones: number;
  /**
   * Los goles a balón parado del partido, a favor y en contra, con su tipo y
   * su minuto (21/10/2026): lo primero que se pregunta el lunes.
   */
  goles: { lado: AbpLado; label: string; minuto: number | null }[];
};

/**
 * Lo trabajado en la semana contra lo que pasó en el partido.
 *
 * `events` tienen que ser ya los de ESE partido: el que llama sabe cuál es.
 */
export function lecturaDelPartido(
  events: CompeticionEvent[],
  minutosPorAspecto: Map<string, number>,
): LecturaPartido {
  const lecturas: LecturaAspecto[] = [];

  for (const aspecto of ASPECTO_BY_KEY.values()) {
    if (!aspecto.reconocimiento) continue;

    for (const lado of ["ofensivo", "defensivo"] as const) {
      const suyas = events.filter((event) => event.lado === lado && encajaEnAspecto(event, aspecto));

      const minutos = minutosPorAspecto.get(claveAspecto(aspecto.key, lado)) ?? 0;

      if (!suyas.length && minutos <= 0) continue;

      const peligro = suyas.filter((event) => event.peligro).length;
      const goles = suyas.filter((event) => event.gol).length;

      const veredicto: LecturaAspecto["veredicto"] = !suyas.length
        ? "neutro"
        : lado === "ofensivo"
          ? peligro > 0
            ? "bien"
            : "neutro"
          : peligro > 0
            ? "mal"
            : "bien";

      lecturas.push({
        aspecto: aspecto.key,
        lado,
        label: aspecto.label,
        minutos,
        acciones: suyas.length,
        peligro,
        goles,
        veredicto,
      });
    }
  }

  /* Lo trabajado que salió en el partido va en la lista; lo que no salió se
     dice en una frase: catorce renglones de «no salió» tapaban lo que sí. */
  const salio = (uno: LecturaAspecto) => uno.acciones > 0;

  const peso = (uno: LecturaAspecto) => (uno.veredicto === "neutro" ? 0 : 1);

  return {
    trabajado: lecturas
      .filter((uno) => uno.minutos > 0 && salio(uno))
      .sort((a, b) => peso(b) - peso(a) || b.goles - a.goles || b.peligro - a.peligro || b.minutos - a.minutos),
    noSalio: lecturas
      .filter((uno) => uno.minutos > 0 && !salio(uno))
      .sort((a, b) => b.minutos - a.minutos)
      .map((uno) => `${enFrase(uno.label)} ${uno.lado === "ofensivo" ? "atacando" : "defendiendo"}`),
    sinTrabajar: lecturas
      .filter((uno) => uno.minutos <= 0 && uno.peligro > 0)
      .sort((a, b) => b.goles - a.goles || b.peligro - a.peligro),
    acciones: events.length,
    goles: events
      .filter((event) => event.gol)
      .map((event) => {
        const aspecto = [...ASPECTO_BY_KEY.values()].find(
          (uno) => uno.reconocimiento && encajaEnAspecto(event, uno),
        );

        return {
          lado: event.lado,
          label: aspecto?.label ?? "Balón parado",
          minuto: event.contexto.minuto.minuto,
        };
      })
      .sort((a, b) => (a.minuto ?? 999) - (b.minuto ?? 999)),
  };
}

/* ------------------------------------------------------------------ */
/*  EL PORQUÉ DE UNA TAREA DEL BOCETO                                  */
/* ------------------------------------------------------------------ */

/**
 * Separa de las notas el porqué que escribió el boceto y lo demás.
 *
 * Desde el 21/10/2026 el boceto lo escribe en lenguaje de campo y se enseña
 * siempre. Los bocetos de antes lo escribían con la cocina («urgencia
 * 33/100… de su familia»): eso es método y sólo sale con los textos
 * explicativos encendidos.
 */
export function porqueDe(notas: string | undefined, explicativos: boolean) {
  const lineas = (notas ?? "").split("\n");

  const esPorque = (linea: string) => linea.trim().startsWith(MARCA_BOCETO);

  const porque = lineas
    .filter(esPorque)
    .map((linea) => linea.trim().slice(MARCA_BOCETO.length).trim())
    .filter((linea) => explicativos || !/urgencia \d+\/100|de su familia/.test(linea))
    .join(" ")
    /* Las notas guardadas antes del 21/10/2026 llevan «· ≈1 gol(es) de
       falta», que es una estimación y no se dice en voz alta: fuera. */
    .replace(/\s*·\s*≈[^·]*/g, "")
    .replace(/(\d+) gol\(es\)/g, (_, n: string) => (n === "1" ? "un gol" : `${n} goles`))
    /* Lo guardado antes del 21/10/2026 por la tarde: «Nuestro:», «Nosotros en
       la liga: concede…» y «Algeciras: Algeciras saca…» (lo de ahora ya lo
       escribe así `motivoDe`). */
    .replace(/\bNuestro: /g, "A favor: ")
    .replace(/Nosotros en la liga: ([^.]*)/g, (_, resto: string) => `En la liga ${enPrimeraPlural(resto, "Real Madrid Castilla")}`)
    .replace(/([A-ZÁÉÍÓÚÑ][^.:]{1,40}): \1 /g, "$1 ")
    /* Un porcentaje sin su base no se escribe: el boceto de ahora la pone
       («remata el 19 % (4 de 21 faltas)»); lo guardado antes, no. */
    .replace(/ y (deja )?remata(r)? el \d+(,\d+)? %(?! \()/g, "")
    /* «vídeo del Algeciras…», «ensayo del día antes…»: con mayúscula. */
    .replace(/^./, (letra) => letra.toUpperCase());

  return {
    porque,
    resto: lineas
      .filter((linea) => !esPorque(linea))
      .join("\n")
      .trim(),
  };
}
