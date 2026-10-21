/**
 * Los movimientos de una diapositiva de balón parado: carreras, balón y
 * bloqueos, con su fase.
 *
 * La pizarra decía QUIÉN va en cada puesto, pero no QUÉ hace: el córner se
 * explicaba en la sala señalando con el dedo. Un trazo es una flecha sobre el
 * lienzo de 1920×1080 —las mismas coordenadas que las fichas— con un punto de
 * control para curvarla y la fase en la que ocurre (1, 2 o 3: el bloqueo va
 * antes que la carrera que libera, y el balón sale cuando la carrera arranca).
 *
 * **Un trazo no guarda a qué ficha pertenece: lo dice dónde empieza.** Si
 * guardara el `id` de la ficha, cada copia de la jornada anterior, cada
 * versión restaurada y cada diapositiva duplicada —que renuevan los `id`— lo
 * dejarían huérfano. Al dibujar desde una cara, el arranque se pega a sus pies
 * (`x`,`y` de la ficha); al arrastrarla, los trazos que salen de ese punto van
 * con ella (`arrastraTrazos`), y al reproducir, la cara que está en el
 * arranque es la que corre (`recorridoDe`). Las carreras encadenadas —el que
 * bloquea en la fase 1 y sale al segundo palo en la 2— se leen igual: la
 * segunda empieza donde acaba la primera.
 *
 * Todo es puro: lo usan la pantalla, la exportación y el modo proyector.
 */

/** Qué dibuja el trazo. */
export type TipoTrazo = "carrera" | "balon" | "bloqueo";

export const TIPOS_TRAZO: { key: TipoTrazo; label: string; ayuda: string }[] = [
  { key: "carrera", label: "Carrera", ayuda: "Desmarque o movimiento de un jugador" },
  { key: "balon", label: "Balón", ayuda: "Trayectoria del envío: saque, pase o centro" },
  { key: "bloqueo", label: "Bloqueo", ayuda: "Carrera que acaba bloqueando a un rival" },
];

export type FaseTrazo = 1 | 2 | 3;

export const FASES: FaseTrazo[] = [1, 2, 3];

export type TrazoPizarra = {
  id: string;
  tipo: TipoTrazo;
  fase: FaseTrazo;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Punto de control de la curva; sin él, la flecha es recta. */
  cx?: number;
  cy?: number;
};

export type Punto = { x: number; y: number };

/** Lo mínimo de una ficha que hace falta aquí. */
export type FichaEnCampo = { id: string; x: number; y: number };

/** Por debajo de esto, al soltar, no se ha dibujado nada: ha sido un clic. */
export const TRAZO_MINIMO = 24;

/** A cuánto del pie de una cara se engancha el arranque al dibujar. */
const IMAN_FICHA = 56;

/** A cuánto de la punta de otro trazo se engancha (para encadenar). */
const IMAN_PUNTA = 30;

/** Dos puntos «son el mismo» por debajo de esto (redondeos al guardar). */
const MISMO_PUNTO = 3;

/* ------------------------------------------------------------------ */
/*  GEOMETRÍA                                                          */
/* ------------------------------------------------------------------ */

export function distancia(a: Punto, b: Punto) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** El control efectivo: el guardado o el punto medio (recta). */
export function controlDe(trazo: TrazoPizarra): Punto {
  return trazo.cx != null && trazo.cy != null
    ? { x: trazo.cx, y: trazo.cy }
    : { x: (trazo.x1 + trazo.x2) / 2, y: (trazo.y1 + trazo.y2) / 2 };
}

export function esCurvo(trazo: TrazoPizarra) {
  return trazo.cx != null && trazo.cy != null;
}

/** Un punto de la curva (bezier cuadrática), con `t` de 0 a 1. */
export function puntoEn(trazo: TrazoPizarra, t: number): Punto {
  const c = controlDe(trazo);
  const u = 1 - t;

  return {
    x: u * u * trazo.x1 + 2 * u * t * c.x + t * t * trazo.x2,
    y: u * u * trazo.y1 + 2 * u * t * c.y + t * t * trazo.y2,
  };
}

/** La dirección de la curva en `t`, normalizada. */
export function tangenteEn(trazo: TrazoPizarra, t: number): Punto {
  const c = controlDe(trazo);

  let dx = 2 * (1 - t) * (c.x - trazo.x1) + 2 * t * (trazo.x2 - c.x);
  let dy = 2 * (1 - t) * (c.y - trazo.y1) + 2 * t * (trazo.y2 - c.y);

  /* Un control encima de la punta deja la tangente a cero: se usa la cuerda. */
  if (Math.hypot(dx, dy) < 0.001) {
    dx = trazo.x2 - trazo.x1;
    dy = trazo.y2 - trazo.y1;
  }

  const largo = Math.hypot(dx, dy) || 1;

  return { x: dx / largo, y: dy / largo };
}

/** Largo aproximado de la curva (24 tramos bastan a este tamaño). */
export function largoDe(trazo: TrazoPizarra) {
  let total = 0;
  let previo = puntoEn(trazo, 0);

  for (let i = 1; i <= 24; i += 1) {
    const actual = puntoEn(trazo, i / 24);

    total += distancia(previo, actual);
    previo = actual;
  }

  return total;
}

/**
 * El `d` del trazo, recortado a `hasta` (0-1) para dibujarlo a medias.
 *
 * Se recorta por De Casteljau —el primer tramo de una bezier partida es otra
 * bezier— en lugar de con `stroke-dashoffset`: el discontinuo del balón usa ya
 * el `dasharray`, y mezclar los dos se come la línea.
 */
export function caminoDe(trazo: TrazoPizarra, hasta = 1) {
  const c = controlDe(trazo);
  const t = Math.max(0, Math.min(1, hasta));

  const q = { x: trazo.x1 + (c.x - trazo.x1) * t, y: trazo.y1 + (c.y - trazo.y1) * t };
  const fin = puntoEn(trazo, t);

  return `M ${r(trazo.x1)} ${r(trazo.y1)} Q ${r(q.x)} ${r(q.y)} ${r(fin.x)} ${r(fin.y)}`;
}

function r(valor: number) {
  return Math.round(valor * 10) / 10;
}

/**
 * La cabeza de la flecha en el punto `t`: un triángulo calculado, no un
 * `<marker>`. Los marcadores no siempre sobreviven a la captura del PNG y,
 * además, no se pueden recortar con la carrera a medias.
 */
export function cabezaDe(trazo: TrazoPizarra, t: number, largo: number, ancho: number) {
  const punta = puntoEn(trazo, t);
  const dir = tangenteEn(trazo, t);
  const base = { x: punta.x - dir.x * largo, y: punta.y - dir.y * largo };
  const normal = { x: -dir.y, y: dir.x };

  return [
    punta,
    { x: base.x + normal.x * ancho, y: base.y + normal.y * ancho },
    { x: base.x - normal.x * ancho, y: base.y - normal.y * ancho },
  ]
    .map((p) => `${r(p.x)},${r(p.y)}`)
    .join(" ");
}

/** La «T» del final del bloqueo: una barra perpendicular a la punta. */
export function barraDe(trazo: TrazoPizarra, t: number, ancho: number) {
  const punta = puntoEn(trazo, t);
  const dir = tangenteEn(trazo, t);
  const normal = { x: -dir.y, y: dir.x };

  return {
    x1: r(punta.x + normal.x * ancho),
    y1: r(punta.y + normal.y * ancho),
    x2: r(punta.x - normal.x * ancho),
    y2: r(punta.y - normal.y * ancho),
  };
}

/* ------------------------------------------------------------------ */
/*  DIBUJAR                                                            */
/* ------------------------------------------------------------------ */

/**
 * Dónde arranca un trazo que se empieza a dibujar en `p`.
 *
 * Se engancha a los pies de la cara más cercana —así la carrera es suya y se
 * mueve con ella— o a la punta de otro trazo, para encadenar fases. Si no hay
 * nada cerca, arranca donde se ha pulsado: un balón desde el banderín, por
 * ejemplo.
 */
export function arranqueDe(
  p: Punto,
  fichas: FichaEnCampo[],
  trazos: TrazoPizarra[],
): Punto & { enganche: "ficha" | "punta" | null } {
  let mejor: (Punto & { enganche: "ficha" | "punta" }) | null = null;
  let menor = Infinity;

  for (const trazo of trazos) {
    const punta = { x: trazo.x2, y: trazo.y2 };
    const d = distancia(p, punta);

    if (d < IMAN_PUNTA && d < menor) {
      menor = d;
      mejor = { ...punta, enganche: "punta" };
    }
  }

  /* Una cara gana a una punta salvo que la punta esté claramente más cerca:
     dibujar desde un jugador es lo que se hace casi siempre. */
  for (const ficha of fichas) {
    const d = distancia(p, ficha);

    if (d < IMAN_FICHA && d < menor + 12) {
      menor = d;
      mejor = { x: ficha.x, y: ficha.y, enganche: "ficha" };
    }
  }

  return mejor ?? { x: Math.round(p.x), y: Math.round(p.y), enganche: null };
}

export function nuevoTrazo(
  tipo: TipoTrazo,
  fase: FaseTrazo,
  desde: Punto,
  hasta: Punto,
): TrazoPizarra {
  return {
    id: `TR-${Math.random().toString(36).slice(2, 10)}`,
    tipo,
    fase,
    x1: Math.round(desde.x),
    y1: Math.round(desde.y),
    x2: Math.round(hasta.x),
    y2: Math.round(hasta.y),
  };
}

/**
 * Mueve los trazos que salen de un punto (los de una cara que se arrastra).
 *
 * Arrastra el arranque y, si la flecha estaba curvada, también el control a
 * medias, para que la curva no se retuerza. La punta se queda: es adónde va,
 * y eso no cambia porque la cara empiece un metro más allá.
 *
 * Devuelve **la misma lista** si no hay ningún trazo en ese punto.
 */
export function arrastraTrazos(
  trazos: TrazoPizarra[] | undefined,
  desde: Punto,
  hasta: Punto,
): TrazoPizarra[] | undefined {
  if (!trazos?.length) return trazos;

  const dx = hasta.x - desde.x;
  const dy = hasta.y - desde.y;

  if (dx === 0 && dy === 0) return trazos;

  let tocado = false;

  const lista = trazos.map((trazo) => {
    if (distancia({ x: trazo.x1, y: trazo.y1 }, desde) > MISMO_PUNTO) return trazo;

    tocado = true;

    return {
      ...trazo,
      x1: trazo.x1 + dx,
      y1: trazo.y1 + dy,
      ...(esCurvo(trazo)
        ? { cx: Math.round((trazo.cx as number) + dx / 2), cy: Math.round((trazo.cy as number) + dy / 2) }
        : {}),
    };
  });

  return tocado ? lista : trazos;
}

/* ------------------------------------------------------------------ */
/*  REPRODUCIR                                                         */
/* ------------------------------------------------------------------ */

/** Cuántas fases usa la diapositiva (0 si no tiene trazos). */
export function fasesDe(trazos: TrazoPizarra[] | undefined) {
  return (trazos ?? []).reduce((maximo, trazo) => Math.max(maximo, trazo.fase), 0);
}

/** Cuánto lleva dibujado un trazo en el instante `t` (en fases: 0 a N). */
export function avanceDe(trazo: TrazoPizarra, t: number | null) {
  if (t == null) return 1;

  return Math.max(0, Math.min(1, t - (trazo.fase - 1)));
}

/** Suaviza el arranque y la llegada: una carrera no va a velocidad fija. */
export function suave(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * Las carreras de una cara, en orden: la que sale de sus pies y las que se
 * encadenan desde la punta de la anterior, en fases crecientes.
 */
export function recorridoDe(ficha: FichaEnCampo, trazos: TrazoPizarra[] | undefined) {
  const corren = (trazos ?? []).filter((trazo) => trazo.tipo !== "balon");
  const usados = new Set<string>();
  const recorrido: TrazoPizarra[] = [];

  let punto: Punto = ficha;
  let fase = 0;

  for (;;) {
    const siguiente = corren
      .filter(
        (trazo) =>
          !usados.has(trazo.id) &&
          trazo.fase > fase &&
          distancia({ x: trazo.x1, y: trazo.y1 }, punto) <= MISMO_PUNTO,
      )
      .sort((a, b) => a.fase - b.fase)[0];

    if (!siguiente) break;

    usados.add(siguiente.id);
    recorrido.push(siguiente);
    punto = { x: siguiente.x2, y: siguiente.y2 };
    fase = siguiente.fase;
  }

  return recorrido;
}

/** Dónde está una cara en el instante `t` (null = quieta en su sitio). */
export function posicionEn(
  ficha: FichaEnCampo,
  trazos: TrazoPizarra[] | undefined,
  t: number | null,
): Punto {
  if (t == null) return ficha;

  let punto: Punto = ficha;

  for (const trazo of recorridoDe(ficha, trazos)) {
    const avance = avanceDe(trazo, t);

    if (avance <= 0) break;

    punto = puntoEn(trazo, suave(avance));

    if (avance < 1) break;
  }

  return punto;
}

/**
 * Dónde está el balón en el instante `t`, o `null` si no hay balón dibujado.
 *
 * Antes de su primer envío espera en el arranque —en el banderín, en la mano
 * del que saca de banda— y después del último se queda en la punta.
 */
export function balonEn(trazos: TrazoPizarra[] | undefined, t: number | null): Punto | null {
  const envios = (trazos ?? [])
    .filter((trazo) => trazo.tipo === "balon")
    .sort((a, b) => a.fase - b.fase);

  if (envios.length === 0 || t == null) return null;

  let punto: Punto = { x: envios[0].x1, y: envios[0].y1 };

  for (const envio of envios) {
    const avance = avanceDe(envio, t);

    if (avance <= 0) break;

    punto = puntoEn(envio, avance);

    if (avance < 1) break;
  }

  return punto;
}

/** Copia profunda, para versiones y copias de jornada. */
export function clonaTrazos(trazos: TrazoPizarra[] | undefined) {
  return trazos?.map((trazo) => ({ ...trazo }));
}

/** Lo que cuenta para la huella de versiones: sin `id`. */
export function huellaTrazos(trazos: TrazoPizarra[] | undefined) {
  return (trazos ?? [])
    .map((trazo) => [
      trazo.tipo,
      trazo.fase,
      Math.round(trazo.x1),
      Math.round(trazo.y1),
      Math.round(trazo.x2),
      Math.round(trazo.y2),
      trazo.cx == null ? null : Math.round(trazo.cx),
      trazo.cy == null ? null : Math.round(trazo.cy),
    ])
    .sort((a, b) => String(a).localeCompare(String(b)));
}
