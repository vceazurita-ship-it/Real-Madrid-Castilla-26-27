/*
| QUÉ TAREA DE LA SEMANA TOCA QUÉ BALÓN PARADO (11/11/2026, expertos)
|
| El informe de ABP decía «las 2 tareas de la semana (miércoles y jueves) no
| tocan la falta directa» y el informe del partido, de la misma semana, ponía
| la falta en «Mié · tarea 2 (córner, faltas y transición)». Los dos tenían
| razón a medias: el plan de ABP no la tenía marcada y la hoja de registro sí
| nombraba «faltas», sin decir cuál. Con dos lecturas, dos respuestas.
|
| Aquí está la única: se lee el texto de cada tarea de la hoja de registro
| (fase, contenidos y tipo) y se dice qué familia de balón parado nombra. Una
| tarea que dice «faltas» sin más toca la falta, pero no dice cuál: es una
| cobertura «genérica», y así se cuenta («la tarea 2 del miércoles trabaja
| faltas; para la directa…»). Una que dice «falta directa» o «barrera» es
| «exacta».
|
| Sin dependencias a propósito: la usan el informe de ABP
| (`lib/abp/informe-micro.ts`) y el informe del partido
| (`lib/informe-partido/modelo.ts`), cada uno con su forma de tarea.
*/

export type FamiliaAbp = "corner" | "falta-lateral" | "falta-directa" | "penalti" | "banda";

export type LadoAbp = "ofensivo" | "defensivo";

/** Una tarea de la semana, con lo mínimo para leerla. */
export type TareaSemana = {
  /** «Miércoles», «Mié 11»…: como lo quiera decir quien llama. */
  dia: string;
  /** «X-T2», «T2», «Tarea 2»… */
  tarea: string;
  /** Lo que se cuenta entre paréntesis: el contenido secundario o, si no, el principal. */
  que: string;
  /** Todo el texto que describe la tarea (fase, contenidos, tipo). */
  texto: string;
  /** «MD-2», si la hoja lo dice (columna MD de la hoja de registro). Opcional. */
  md?: string;
};

export type TareaQueToca = TareaSemana & {
  /** «exacta»: nombra la acción; «generica»: nombra la familia («faltas», «ABP») sin decir cuál. */
  cobertura: "exacta" | "generica";
};

const sinTildes = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

/** «Miércoles», «Mié 11», «X» → 3 (domingo = 0); -1 si no se reconoce. */
export function diaDeLaSemana(dia: string) {
  const t = sinTildes(String(dia ?? "")).trim();

  if (/^x\b/.test(t)) return 3;

  return t.length >= 3 ? DIAS_SEMANA.findIndex((nombre) => t.startsWith(nombre.slice(0, 3))) : -1;
}

/**
 * EL MD DE UNA TAREA (11/11/2026, experto de fútbol): con partido el viernes,
 * la tarea del miércoles ES el MD-2. Primero lo que dice la hoja; si no, la
 * cuenta con el día del partido («viernes»). Vacío si no se puede saber.
 */
export function mdDeTarea(t: Pick<TareaSemana, "dia" | "md">, diaPartido?: string) {
  const hoja = /MD\s*-\s*(\d)/i.exec(t.md ?? "")?.[1];

  if (hoja) return `MD-${hoja}`;

  const partido = diaDeLaSemana(diaPartido ?? "");
  const tarea = diaDeLaSemana(t.dia);

  if (partido < 0 || tarea < 0) return "";

  const antes = (partido - tarea + 7) % 7;

  return antes > 0 ? `MD-${antes}` : "";
}

const EXACTA: Record<FamiliaAbp, RegExp> = {
  corner: /\bcorner(?:s|es)?\b|saque de esquina/,
  "falta-lateral": /falta(?:s)? lateral(?:es)?|\bfal(?:ta)?\.? lat\b|centro lateral a balon parado/,
  "falta-directa": /falta(?:s)? directa(?:s)?|\bbarrera\b|tiro libre|libre directo/,
  penalti: /\bpenalti(?:s)?\b|\bpenati|\bpenalty/,
  banda: /saque(?:s)? de banda|\bbanda\b.*\bsaque|\bsaques? lateral/,
};

/** «faltas» sin apellido: toca la falta, pero no dice cuál. */
const FALTA_SUELTA = /\bfaltas?\b(?! (?:lateral|directa))/;

/** «ABP», «balón parado», «acciones a balón parado»: toca el balón parado sin decir cuál. */
const ABP_SUELTO = /\babp\b|balon parado|estrategia/;

/** Qué familias nombra el texto de una tarea, sin el lado. */
export function familiasDeTexto(texto: string): { exactas: FamiliaAbp[]; falta: boolean; abp: boolean } {
  const t = sinTildes(texto);

  const exactas = (Object.keys(EXACTA) as FamiliaAbp[]).filter((familia) => EXACTA[familia].test(t));

  return { exactas, falta: FALTA_SUELTA.test(t), abp: ABP_SUELTO.test(t) };
}

/** El lado que dice el texto, o `null` si no lo dice o dice los dos. */
export function ladoDeTexto(texto: string): LadoAbp | null {
  const t = sinTildes(texto);

  const of = /ofensiv|\bof\b|a favor/.test(t);
  const def = /defensiv|\bdef\b|en contra/.test(t);

  if (of === def) return null;

  return of ? "ofensivo" : "defensivo";
}

/** «Falta directa a portería» → «falta-directa»; acepta la familia ya hecha. */
export function familiaDeAspecto(aspecto: string): FamiliaAbp | null {
  const t = sinTildes(aspecto);

  if ((["corner", "falta-lateral", "falta-directa", "penalti", "banda"] as string[]).includes(t)) return t as FamiliaAbp;
  if (/corner/.test(t)) return "corner";
  if (/falta/.test(t) && /lateral/.test(t)) return "falta-lateral";
  if (/falta/.test(t)) return "falta-directa";
  if (/penalti/.test(t)) return "penalti";
  if (/banda/.test(t)) return "banda";

  return null;
}

/**
 * Las tareas de la semana que tocan una acción de balón parado, por este
 * orden: primero las que la nombran («falta directa», «barrera»), después las
 * que nombran la familia sin decir cuál («faltas»; para la falta) y, sólo si
 * no hay ninguna de las dos, las de «ABP» sin más. Una tarea del otro lado
 * («faltas ofensivas» para la defensiva) no cuenta.
 */
export function tareasQueTocan(familia: FamiliaAbp, lado: LadoAbp | null, tareas: TareaSemana[]): TareaQueToca[] {
  const deEsteLado = tareas.filter((t) => {
    const suyo = ladoDeTexto(t.texto);

    return !lado || !suyo || suyo === lado;
  });

  const exactas: TareaQueToca[] = [];
  const genericas: TareaQueToca[] = [];
  const abp: TareaQueToca[] = [];

  deEsteLado.forEach((t) => {
    const f = familiasDeTexto(t.texto);

    if (f.exactas.includes(familia)) exactas.push({ ...t, cobertura: "exacta" });
    else if (f.falta && (familia === "falta-directa" || familia === "falta-lateral")) genericas.push({ ...t, cobertura: "generica" });
    else if (f.abp && !f.exactas.length && !f.falta) abp.push({ ...t, cobertura: "generica" });
  });

  return exactas.length || genericas.length ? [...exactas, ...genericas] : abp;
}

/** «corner» → «córner» y la primera en minúscula, para ir entre paréntesis. */
export function queLegible(que: string) {
  const limpio = que
    .trim()
    .replace(/\bcorners\b/gi, "córners")
    .replace(/\bcorner\b/gi, "córner")
    .replace(/\bpenaltis\b/gi, "penaltis")
    .replace(/\s+/g, " ");

  return limpio ? `${limpio.charAt(0).toLowerCase()}${limpio.slice(1)}` : "";
}

/** «X-T2» → «tarea 2»; lo que no tenga número, tal cual. */
export function numeroDeTarea(tarea: string) {
  const n = /T\s*(\d+)\s*$/i.exec(String(tarea ?? ""))?.[1] ?? /(?:^|\s)(\d+)\s*$/.exec(String(tarea ?? ""))?.[1];

  return n ? `tarea ${n}` : String(tarea ?? "").trim();
}

/** «la tarea 2 del miércoles (córner, faltas y transición)». */
export function tareaEnFrase(t: TareaSemana) {
  const que = queLegible(t.que);
  const n = numeroDeTarea(t.tarea);

  return `${/^tarea \d+$/.test(n) ? `la ${n} del` : "el"} ${t.dia.toLowerCase()}${que ? ` (${que})` : ""}`;
}
