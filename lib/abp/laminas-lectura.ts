/**
 * LO QUE DICEN LAS LÁMINAS DEL RIVAL, EN UNA FRASE (31/10/2026).
 *
 * El informe previo de ABP pegaba las láminas de «ABP del Rival» con un pie
 * que sólo decía «Córner ofensivo · Cartagena, J10.»: el cuerpo técnico tenía
 * que contar las cruces él mismo. Aquí se cuentan: cuántos córners o centros,
 * cuántos en corto (los que señala un rótulo «CORTA») y adónde cae el resto
 * —primer palo, centro de la portería o segundo palo; dentro o fuera del área
 * pequeña—, más los jugadores clave de la lámina con su altura.
 *
 * Las medidas son las del dibujo (`lib/rivals/analisis.ts`): 68 m de ancho,
 * 0 en la línea de fondo, la portería centrada. Sólo cuentas: quien llama
 * trae las láminas y las fichas.
 */

import { CAMPO_ANCHO, type Lamina, type Marca } from "@/lib/rivals/analisis";
import { conTildes } from "@/lib/rivals/tildes";

/** Los postes y el área pequeña, en metros desde la banda izquierda y desde la línea de fondo. */
const MEDIO = CAMPO_ANCHO / 2;
const POSTE = 3.66;
const AREA_PEQUENA_FONDO = 5.5;
const AREA_PEQUENA_MEDIA = 9.16;
const PENALTI = 11;

export type JugadorDeLamina = { nombre: string; altura: number | null; /** `playerKey()` del jugador, para cruzarlo con la plantilla. */ clave?: string };

export type LecturaLamina = {
  /** «corner-of», «centros-of»…: la sección de la lámina. */
  seccion: string;
  titulo: string;
  /** La frase con lo contado; vacía si la lámina no tiene cruces. */
  lectura: string;
  /** Cuántas acciones dibuja (una cruz por acción). */
  acciones: number;
  jugadores: JugadorDeLamina[];
  /** Centros (31/10/2026): media línea con lo que más se repite. */
  resumen?: string;
  /** Córner (31/10/2026): lo contado, para sumar las láminas de cerrados y abiertos en una frase. */
  reparto?: RepartoCorner;
};

export type RepartoCorner = { acciones: number; cortas: number; alArea: number; primer: number; centro: number; segundo: number; pequena: number; trayectoria: "cerrado" | "abierto" | "" };

type Cruz = Extract<Marca, { tipo: "cruz" }>;

const cerca = (a: { x: number; y: number }, b: { x: number; y: number }, m = 2) => Math.hypot(a.x - b.x, a.y - b.y) <= m;

/** «CORNER OFENSIVO: TRAYECTORIA CERRADA» → «Córner ofensivo: trayectoria cerrada». */
export function tituloDeLamina(titulo: string) {
  const limpio = titulo.replace(/\s+/g, " ").trim();

  if (!limpio) return "";

  const frase = limpio === limpio.toUpperCase() ? limpio.toLowerCase() : limpio;

  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}`.replace(/\bcorner/gi, (m) => (m[0] === "C" ? "Córner" : "córner")).replace(/\babp\b/gi, "ABP");
}

/**
 * «J10 INFORME PENALTIS CARTAGENA copia» → «Informe penaltis Cartagena (J10)»:
 * el nombre del fichero, como se lee en un informe.
 */
export function nombreDocumento(nombre: string, equipo = "") {
  const jornada = nombre.match(/\bJ\d{1,2}\b/i)?.[0]?.toUpperCase() ?? "";

  const resto = nombre
    .replace(/\.pdf$/i, "")
    .replace(/[\s_-]*\(?\bcopia\b\)?(\s*\(\d+\))?/gi, "")
    .replace(/\bJ\d{1,2}\b/gi, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  /* El nombre del equipo conserva su mayúscula: «Informe penaltis Cartagena». */
  const propios = new Set(
    equipo
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => p.length > 3),
  );

  const frase = tituloDeLamina(resto)
    .split(" ")
    .map((palabra) => (propios.has(palabra.toLowerCase()) ? `${palabra.charAt(0).toUpperCase()}${palabra.slice(1)}` : palabra))
    .join(" ");

  return `${frase}${jornada ? ` (${jornada})` : ""}`;
}

/** La misma lámina repetida (mismo título y mismas marcas) sale una vez. */
export function sinRepetidas<T extends Lamina>(laminas: T[]): T[] {
  const vistas = new Set<string>();

  return laminas.filter((lamina) => {
    const huella = [
      lamina.seccion,
      lamina.titulo.trim().toUpperCase(),
      ...lamina.marcas.map((m) => `${m.tipo}:${Math.round(m.x)},${Math.round(m.y)}`).sort(),
    ].join("|");

    if (vistas.has(huella)) return false;

    vistas.add(huella);

    return true;
  });
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function lista(trozos: string[]) {
  const buenos = trozos.filter(Boolean);

  return buenos.length <= 1 ? (buenos[0] ?? "") : `${buenos.slice(0, -1).join(", ")} y ${buenos[buenos.length - 1]}`;
}

/** Primer palo, centro o segundo palo, visto desde el lado por el que llega el balón. */
function palo(cruz: Cruz, desdeIzquierda: boolean): "primer" | "centro" | "segundo" {
  const x = desdeIzquierda ? cruz.x : CAMPO_ANCHO - cruz.x;

  if (x < MEDIO - POSTE / 2 - 0.3) return "primer";
  if (x > MEDIO + POSTE / 2 + 0.3) return "segundo";

  return "centro";
}

function reparto(cruces: Cruz[], desdeIzquierda: boolean) {
  const cuenta = { primer: 0, centro: 0, segundo: 0 };

  for (const cruz of cruces) cuenta[palo(cruz, desdeIzquierda)] += 1;

  const trozos = [
    cuenta.primer ? `${cuenta.primer} al primer palo` : "",
    cuenta.centro ? `${cuenta.centro} al centro de la portería` : "",
    cuenta.segundo ? `${cuenta.segundo} al segundo palo` : "",
  ];

  /* La zona que manda, si manda de verdad (la mitad o más). */
  const [zona, n] = (Object.entries(cuenta) as [keyof typeof cuenta, number][]).sort((a, b) => b[1] - a[1])[0];

  const domina = cruces.length >= 4 && n * 2 >= cruces.length ? (zona === "centro" ? "el centro de la portería" : `el ${zona} palo`) : "";

  return { texto: lista(trozos), domina };
}

function profundidad(cruces: Cruz[]) {
  const pequena = cruces.filter((c) => c.y <= AREA_PEQUENA_FONDO + 0.5 && Math.abs(c.x - MEDIO) <= AREA_PEQUENA_MEDIA + 0.5).length;
  const penalti = cruces.filter((c) => c.y > AREA_PEQUENA_FONDO + 0.5 && c.y <= PENALTI + 1.5).length;
  const lejos = cruces.length - pequena - penalti;

  return lista([
    pequena ? `${pequena} dentro del área pequeña` : "",
    penalti ? `${penalti} a la altura del penalti` : "",
    lejos ? `${lejos} más lejos` : "",
  ]);
}

/**
 * La frase de una lámina de córner: «17 córners: 3 en corto; de los 14 al
 * área, 5 al primer palo, 6 al centro y 3 al segundo; 11 dentro del área
 * pequeña».
 */
function lecturaCorner(lamina: Lamina) {
  const cruces = lamina.marcas.filter((m): m is Cruz => m.tipo === "cruz");

  if (!cruces.length) return "";

  const balon = lamina.marcas.find((m) => m.tipo === "balon");

  const desdeIzquierda = (balon?.x ?? 0) < MEDIO;

  /* Las cortas: las que señala un rótulo «CORTA» (o «EN CORTO»). */
  const puntosCortos = lamina.marcas.flatMap((m) => (m.tipo === "etiqueta" && /cort/i.test(m.texto) ? m.a : []));

  const cortas = cruces.filter((c) => puntosCortos.some((p) => cerca(c, p, 2.5)));

  const alArea = cruces.filter((c) => !cortas.includes(c));

  const { texto, domina } = reparto(alArea, desdeIzquierda);

  const prof = profundidad(alArea);

  const partes = [
    plural(cruces.length, "córner", "córners"),
    cortas.length ? `${cortas.length} en corto` : "",
  ].filter(Boolean);

  const destino = alArea.length ? `${cortas.length ? `de los ${alArea.length} al área, ` : ""}${texto}${prof ? `; ${prof}` : ""}` : "";

  return `${partes.join(", ")}${destino ? `: ${destino}` : ""}.${domina ? ` Atacan sobre todo ${domina}.` : ""}`;
}

/** Lo mismo que `lecturaCorner`, en números, para sumar láminas. */
function cuentaCorner(lamina: Lamina): RepartoCorner | undefined {
  const cruces = lamina.marcas.filter((m): m is Cruz => m.tipo === "cruz");

  if (!cruces.length) return undefined;

  const balon = lamina.marcas.find((m) => m.tipo === "balon");

  const desdeIzquierda = (balon?.x ?? 0) < MEDIO;

  const puntosCortos = lamina.marcas.flatMap((m) => (m.tipo === "etiqueta" && /cort/i.test(m.texto) ? m.a : []));

  const cortas = cruces.filter((c) => puntosCortos.some((p) => cerca(c, p, 2.5)));

  const alArea = cruces.filter((c) => !cortas.includes(c));

  const cuenta = { primer: 0, centro: 0, segundo: 0 };

  for (const cruz of alArea) cuenta[palo(cruz, desdeIzquierda)] += 1;

  return {
    acciones: cruces.length,
    cortas: cortas.length,
    alArea: alArea.length,
    ...cuenta,
    pequena: alArea.filter((c) => c.y <= AREA_PEQUENA_FONDO + 0.5 && Math.abs(c.x - MEDIO) <= AREA_PEQUENA_MEDIA + 0.5).length,
    trayectoria: /cerrad/i.test(lamina.titulo) ? "cerrado" : /abiert/i.test(lamina.titulo) ? "abierto" : "",
  };
}

/**
 * Todas las láminas de córner en una frase (31/10/2026, equipo de expertos):
 * «Sus 31 córners: 5 en corto; de los 26 al área, 11 al primer palo, 5 al
 * centro y 10 al segundo, y 17 caen en el área pequeña. Cerrados cargan el
 * segundo palo (6 de 13); abiertos, el primero (7 de 13)». Vacía si no hay.
 */
export function resumenCorners(lecturas: LecturaLamina[]) {
  const repartos = lecturas.map((una) => una.reparto).filter((una): una is RepartoCorner => Boolean(una));

  if (!repartos.length) return "";

  const suma = (k: "acciones" | "cortas" | "alArea" | "primer" | "centro" | "segundo" | "pequena") => repartos.reduce((t, una) => t + una[k], 0);

  const alArea = suma("alArea");

  const total = `Sus ${plural(suma("acciones"), "córner dibujado", "córners dibujados")}${suma("cortas") ? `: ${suma("cortas")} en corto` : ""}; de los ${alArea} al área, ${lista([
    suma("primer") ? `${suma("primer")} al primer palo` : "",
    suma("centro") ? `${suma("centro")} al centro de la portería` : "",
    suma("segundo") ? `${suma("segundo")} al segundo palo` : "",
  ])}, y ${suma("pequena")} caen dentro del área pequeña`;

  /* Por trayectoria, la zona que más cargan (cerrado: el balón se cierra hacia la portería; abierto: se va hacia fuera). */
  const porTrayectoria = repartos
    .filter((una) => una.trayectoria && una.alArea >= 4)
    .map((una) => {
      const [zona, n] = (
        [
          ["el primer palo", una.primer],
          ["el centro de la portería", una.centro],
          ["el segundo palo", una.segundo],
        ] as [string, number][]
      ).sort((a, b) => b[1] - a[1])[0];

      return `${una.trayectoria === "cerrado" ? "los cerrados (hacia la portería)" : "los abiertos (hacia fuera)"} cargan ${zona} (${n} de ${una.alArea})`;
    });

  return `${total}.${porTrayectoria.length ? ` ${porTrayectoria.map((uno, i) => (i ? uno : `${uno.charAt(0).toUpperCase()}${uno.slice(1)}`)).join("; ")}.` : ""}`;
}

/**
 * Una lámina de centros en media línea (31/10/2026, guionista): el lado y lo
 * que más se repite, con su base. «desde la derecha, a la altura del penalti
 * (6 de 7)». El desglose entero va en el pie de la lámina.
 */
function resumenCentros(lamina: Lamina) {
  const cruces = lamina.marcas.filter((m): m is Cruz => m.tipo === "cruz");

  if (cruces.length < 3) return "";

  const balones = lamina.marcas.filter((m) => m.tipo === "balon");

  const desdeIzquierda = balones.length ? balones.filter((b) => b.x < MEDIO).length >= balones.length / 2 : /izq/i.test(lamina.titulo);

  const cuenta = { primer: 0, centro: 0, segundo: 0 };

  for (const cruz of cruces) cuenta[palo(cruz, desdeIzquierda)] += 1;

  const pequena = cruces.filter((c) => c.y <= AREA_PEQUENA_FONDO + 0.5 && Math.abs(c.x - MEDIO) <= AREA_PEQUENA_MEDIA + 0.5).length;
  const penalti = cruces.filter((c) => c.y > AREA_PEQUENA_FONDO + 0.5 && c.y <= PENALTI + 1.5).length;

  const opciones: [string, number][] = [
    ["al primer palo", cuenta.primer],
    ["al segundo palo", cuenta.segundo],
    ["al primer palo y al centro", cuenta.primer + cuenta.centro],
    ["dentro del área pequeña", pequena],
    ["a la altura del penalti", penalti],
  ];

  const [donde, n] = opciones.filter(([, v]) => v * 2 > cruces.length).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0] ?? ["", 0];

  return donde ? `desde la ${desdeIzquierda ? "izquierda" : "derecha"}, ${donde} (${n} de ${cruces.length})` : "";
}

/** La frase de una lámina de centros: desde dónde salen y adónde caen. */
function lecturaCentros(lamina: Lamina) {
  const cruces = lamina.marcas.filter((m): m is Cruz => m.tipo === "cruz");

  if (!cruces.length) return "";

  const balones = lamina.marcas.filter((m) => m.tipo === "balon");

  const desdeIzquierda = balones.length ? balones.filter((b) => b.x < MEDIO).length >= balones.length / 2 : /izq/i.test(lamina.titulo);

  const desdeFondo = balones.filter((b) => b.y <= 8).length;

  const { texto, domina } = reparto(cruces, desdeIzquierda);

  const prof = profundidad(cruces);

  return `${plural(cruces.length, "centro", "centros")} desde la ${desdeIzquierda ? "izquierda" : "derecha"}${
    balones.length === cruces.length && desdeFondo ? ` (${desdeFondo === balones.length ? "todos" : `${desdeFondo} de ${balones.length}`} desde cerca de la línea de fondo)` : ""
  }: ${texto}${prof ? `; ${prof}` : ""}.${domina ? ` Buscan sobre todo ${domina}.` : ""}`;
}

/** «184cm», «1,84», «184» → 184. */
export function alturaEnCm(valor: unknown): number | null {
  const n = Number(String(valor ?? "").replace(/[^\d,.]/g, "").replace(",", "."));

  if (!Number.isFinite(n) || n <= 0) return null;

  const cm = n < 3 ? Math.round(n * 100) : Math.round(n);

  return cm >= 150 && cm <= 215 ? cm : null;
}

/** «IMANOL BAZ» → «Imanol Baz». */
export function nombreBonito(nombre: string) {
  const limpio = nombre.replace(/\s+/g, " ").trim();

  /* Con las tildes de la casa («Rubén»), como en Plantillas rivales. */
  return conTildes(limpio === limpio.toUpperCase() ? limpio.toLowerCase().replace(/(^|[\s\-'.])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : limpio);
}

export function leeLamina(lamina: Lamina, ficha?: (clave: string, nombre: string) => { altura?: string; nombre?: string } | null): LecturaLamina {
  const cruces = lamina.marcas.filter((m) => m.tipo === "cruz").length;

  const lectura = /^corner/.test(lamina.seccion) ? lecturaCorner(lamina) : /^centros/.test(lamina.seccion) ? lecturaCentros(lamina) : "";

  return {
    seccion: lamina.seccion,
    titulo: tituloDeLamina(lamina.titulo),
    lectura,
    acciones: cruces,
    reparto: /^corner/.test(lamina.seccion) ? cuentaCorner(lamina) : undefined,
    resumen: /^centros/.test(lamina.seccion) ? resumenCentros(lamina) : undefined,
    jugadores: lamina.jugadores.map((j) => ({
      clave: j.clave || undefined,
      /* El nombre de la plantilla («L. Lohr»), el mismo que en «A quién marcamos»; si no casa, el de la lámina. */
      nombre: nombreBonito(ficha?.(j.clave, j.nombre)?.nombre || j.nombre),
      altura: alturaEnCm(ficha?.(j.clave, j.nombre)?.altura),
    })),
  };
}

/**
 * Las notas de una diapositiva de la pizarra, en una línea para el pie de su
 * imagen (31/10/2026): «Orden:» y los rótulos sueltos se juntan con lo que
 * sigue, y cada consigna acaba en punto.
 */
export function notasDeDiapositiva(notas: unknown, nombres: string[] = [], yaDichas?: Set<string>): string {
  /*
  | Como se escribe en un informe (31/10/2026, equipo de expertos): los
  | nombres de la plantilla con mayúscula («mario» → «Mario»), las palabras en
  | mayúsculas sostenidas en minúscula («ATENCIÓN a su…») y, si se pasa
  | `yaDichas`, sin repetir la consigna que ya dijo otra diapositiva.
  */
  const propios = new Map<string, string>();

  for (const nombre of nombres) {
    for (const palabra of nombre.split(/\s+/)) {
      if (palabra.length >= 3) propios.set(sinTilde(palabra), palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase());
    }
  }

  const pule = (texto: string) =>
    texto
      /*
      | «INTENCIÓN Si hay…» → «Intención: si hay…»: sólo cuando el rótulo va en
      | mayúsculas sostenidas, que es como se escribe el rótulo en la pizarra.
      | «Orden de lanzamiento…» o «Intención de buscar…» no se tocan.
      */
      .replace(/^(INTENCI[OÓ]N|ORDEN|OBJETIVO|CLAVE)\s+(?=\p{Lu})/u, (_, rotulo: string) => `${rotulo.charAt(0)}${rotulo.slice(1).toLowerCase()}: `)
      /* «4.ª» en una pizarra de córners es el 4.º córner. */
      .replace(/(\d)\.ª/g, "$1.º")
      .replace(/\p{L}+/gu, (palabra) => {
        if (palabra.length >= 4 && palabra === palabra.toUpperCase()) return palabra.toLowerCase();

        return propios.get(sinTilde(palabra)) ?? ERRATAS_PIZARRA[palabra.toLowerCase()] ?? palabra;
      })
      .replace(/(\d\.[ºª]) Y (\d)/g, "$1 y $2")
      /* Sin espacio antes de un signo; «Intención Si hay…» → «Intención: si hay…». */
      .replace(/\s+([.,;:])/g, "$1")
      /* Tras los dos puntos, minúscula, salvo un nombre de la plantilla. */
      .replace(/: (\p{Lu})(\p{Ll}*)/gu, (todo, inicial: string, resto: string) => (propios.has(sinTilde(inicial + resto)) ? todo : `: ${inicial.toLowerCase()}${resto}`))
      .replace(/ la Atención\b/g, " la atención")
      .replace(/^./, (c) => c.toUpperCase());

  const lineas = (Array.isArray(notas) ? notas : [])
    .map((una) => pule(String(una ?? "").replace(/\s+/g, " ").trim()))
    .filter(Boolean);

  /* «Orden:» y los rótulos sueltos se juntan con lo que sigue. */
  const juntas: string[] = [];

  for (const linea of lineas) {
    const previa = juntas[juntas.length - 1];

    if (previa && /:$/.test(previa)) juntas[juntas.length - 1] = `${previa} ${linea}`;
    else juntas.push(linea);
  }

  const frases = juntas.filter((una) => {
    if (!yaDichas) return true;

    const clave = una.toLowerCase();

    if (yaDichas.has(clave)) return false;

    yaDichas.add(clave);

    return true;
  });

  /* «Marcas: a. Marcas: b. Marcas: c» → «Marcas: a; b; c» (la misma etiqueta seguida, una vez). */
  const fundidas: string[] = [];

  for (const frase of frases) {
    const etiqueta = frase.match(/^([^:]{2,30}):\s/)?.[1];
    const previa = fundidas[fundidas.length - 1];
    const etiquetaPrevia = previa?.match(/^([^:]{2,30}):\s/)?.[1];

    if (etiqueta && previa && etiqueta === etiquetaPrevia) fundidas[fundidas.length - 1] = `${previa.replace(/[.;]\s*$/, "")}; ${frase.slice(etiqueta.length + 1).trim()}`;
    else fundidas.push(frase);
  }

  /* «Orden: 1.º y 3.º: con 3…» → «Orden: 1.º y 3.º, con 3…»: unos dos puntos por frase. */
  const unaVez = (frase: string) => {
    let vistos = 0;

    return frase.replace(/: /g, () => (vistos++ === 0 ? ": " : ", "));
  };

  return fundidas.map((una) => unaVez(/[.!?:]$/.test(una) ? una : `${una}.`)).join(" ");
}

const sinTilde = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Las erratas que se repiten en las notas de la pizarra. */
const ERRATAS_PIZARRA: Record<string, string> = {
  lanzadador: "lanzador",
  penultimo: "penúltimo",
  ultimo: "último",
};
