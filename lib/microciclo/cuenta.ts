/**
 * UNA SOLA CUENTA DEL MICROCICLO (07/11/2026).
 *
 * La misma semana salía con tres cifras: 15 tareas en /microcycles, 18 en el
 * editor (/laboratorio/microciclo) y 7 «sesiones» en /micro_calendar frente a
 * las 5 de /calendar_general. Cada pantalla contaba a su manera: una con las
 * filas sin MD, otra juntando el micro 2 con el 2B, otra con el partido como
 * si fuera una sesión. Aquí está la definición que comparten todas:
 *
 * - **Tarea**: una fila de la hoja con micro, MD y nombre de tarea.
 * - **Partido**: la fila de competición del día MD (la fase dice
 *   «Competición»). No es tarea de entreno.
 * - **Entreno**: un día con al menos una tarea que no es de competición.
 * - **Un micro con dos rivales son dos semanas**: el 13 y el «13B».
 *
 * Sin dependencias: se usa en el cliente y en el servidor.
 */

const sinTildes = (s: string | undefined | null) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * ¿Es la fila del partido? La fase (o el tipo/contenido) dice «Competición» y,
 * si la fila trae MD, es el día «MD»: un MD-2 puede llevar un «partido
 * reducido» apuntado como competición y eso es entreno.
 */
export function esFilaDePartido(fila: { md?: string; fase?: string; tipo?: string; contenidoPrincipal?: string }) {
  const md = String(fila.md ?? "").trim().toUpperCase().replace(/\s+/g, "");

  if (md && md !== "MD") return false;

  return /competicion/.test(sinTildes(`${fila.fase ?? ""} ${fila.tipo ?? ""} ${fila.contenidoPrincipal ?? ""}`));
}

/** La fila cuenta como tarea: tiene micro, MD y nombre. */
export function esTareaDeLaHoja(fila: { micro: number; md?: string; tarea?: string }) {
  return fila.micro > 0 && String(fila.md ?? "").trim() !== "" && String(fila.tarea ?? "").trim() !== "";
}

/** «dd/mm/aaaa» → «aaaa-mm-dd», para ordenar; lo que ya viene en ISO se deja. */
export function fechaIsoDeHoja(f: string) {
  const m = String(f ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  return /^\d{4}-\d{2}-\d{2}/.test(String(f ?? "")) ? String(f).slice(0, 10) : "";
}

/**
 * Con partido entre semana, la hoja apunta dos semanas con el mismo número de
 * micro: el 13 lleva al Sant Andreu (miércoles) y al Alcorcón (domingo), y
 * cada tarea dice de cuál es. El primer rival (por fecha) se queda con el 13 y
 * el siguiente pasa a ser el «13B» —internamente 13,1—. Una tarea sin rival
 * escrito es de la semana del primero.
 */
export function separaSemanas<T extends { micro: number; rival: string; fecha: string }>(filas: T[]): T[] {
  const porMicro = new Map<number, T[]>();

  for (const f of filas) porMicro.set(f.micro, [...(porMicro.get(f.micro) ?? []), f]);

  const salida: T[] = [];

  for (const [micro, suyas] of porMicro) {
    const rivales = [...new Set(suyas.map((f) => f.rival.trim()).filter(Boolean))].sort((a, b) => {
      const primera = (r: string) =>
        suyas
          .filter((f) => f.rival.trim() === r)
          .map((f) => fechaIsoDeHoja(f.fecha))
          .filter(Boolean)
          .sort()[0] ?? "";

      return primera(a).localeCompare(primera(b));
    });

    for (const f of suyas) {
      const i = Math.max(0, rivales.indexOf(f.rival.trim()));

      salida.push({ ...f, rival: f.rival.trim() || rivales[0] || "", micro: micro + i / 10 });
    }
  }

  return salida;
}

/** 13 → «13»; 13,1 → «13B»; 13,2 → «13C». */
export function etiquetaMicro(micro: number | string) {
  const n = Number(micro);

  if (!Number.isFinite(n)) return String(micro);

  const entero = Math.floor(n + 1e-9);
  const extra = Math.round((n - entero) * 10);

  return extra > 0 ? `${entero}${String.fromCharCode(65 + extra)}` : String(entero);
}

export type FilaCuenta = {
  micro: number;
  rival: string;
  md: string;
  fecha: string;
  tarea: string;
  fase: string;
  tipo?: string;
  contenidoPrincipal?: string;
  tiempo?: number;
  evaluacion?: number;
};

export type CuentaMicro = {
  /** 13 o 13,1 (el «13B»). */
  micro: number;
  etiqueta: string;
  rival: string;
  /** Todas las filas que cuentan, con el partido. */
  tareas: number;
  /** Sin el partido. */
  tareasEntreno: number;
  /** Días con alguna tarea de entreno. */
  entrenos: number;
  partidos: number;
  /** Minutos de las tareas de entreno. */
  minutosEntreno: number;
  /** Valoración media de las tareas valoradas, y cuántas son. */
  valoracion: number;
  valoradas: number;
};

/** Las cuentas por micro, con la misma definición que /microcycles. */
export function cuentaMicros(filas: FilaCuenta[]): CuentaMicro[] {
  const validas = separaSemanas(filas.filter(esTareaDeLaHoja));
  const porMicro = new Map<number, FilaCuenta[]>();

  for (const f of validas) porMicro.set(f.micro, [...(porMicro.get(f.micro) ?? []), f]);

  return [...porMicro.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([micro, suyas]) => {
      const entreno = suyas.filter((f) => !esFilaDePartido(f));
      const notas = suyas.map((f) => Number(f.evaluacion) || 0).filter((n) => n > 0);
      const dia = (f: FilaCuenta) => fechaIsoDeHoja(f.fecha) || f.md;

      return {
        micro,
        etiqueta: etiquetaMicro(micro),
        rival: suyas.find((f) => f.rival)?.rival ?? "",
        tareas: suyas.length,
        tareasEntreno: entreno.length,
        entrenos: new Set(entreno.map(dia)).size,
        partidos: new Set(suyas.filter(esFilaDePartido).map(dia)).size,
        minutosEntreno: entreno.reduce((s, f) => s + (Number(f.tiempo) || 0), 0),
        valoracion: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : 0,
        valoradas: notas.length,
      };
    });
}

/**
 * Los días de un tramo, contados igual en los dos calendarios: entrenos (días
 * con alguna tarea que no es de competición) y partidos (días con la fila de
 * competición). Un día de partido con activación cuenta en los dos.
 */
export function cuentaDias(porDia: Map<string, { md?: string; fase?: string; tipo?: string; contenidoPrincipal?: string }[]>, dentro: (dia: string) => boolean) {
  let entrenos = 0;
  let partidos = 0;

  porDia.forEach((filas, dia) => {
    if (!dentro(dia)) return;
    if (filas.some((f) => !esFilaDePartido(f))) entrenos += 1;
    if (filas.some((f) => esFilaDePartido(f))) partidos += 1;
  });

  return { entrenos, partidos };
}

/** «5 entrenos + 2 partidos», «1 entreno», «2 partidos». */
export function textoEntrenosYPartidos(entrenos: number, partidos: number) {
  const e = entrenos ? `${entrenos} ${entrenos === 1 ? "entreno" : "entrenos"}` : "";
  const p = partidos ? `${partidos} ${partidos === 1 ? "partido" : "partidos"}` : "";

  return [e, p].filter(Boolean).join(" + ");
}

/** «6,7»: coma decimal, una cifra. */
export const comaDecimal = (n: number, decimales = 1) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/**
 * El MD de un día de entreno que la hoja dejó sin MD (09/11/2026): se saca del
 * próximo partido del calendario, como cuenta el microciclo («MD-2» = dos días
 * antes). Los dos calendarios usan esta misma regla, así que ningún día de
 * entreno queda «fuera de micro» si hay partido a la vista (hasta 6 días).
 * Fechas «AAAA-MM-DD»; devuelve «» si no hay partido cercano.
 */
export function mdDeLaFecha(dia: string, fechasDePartido: Iterable<string>) {
  const aDias = (f: string) => {
    const [a, m, d] = f.split("-").map(Number);

    return Math.round(Date.UTC(a, (m || 1) - 1, d || 1) / 86_400_000);
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return "";

  const hoy = aDias(dia);

  let mejor = 0;

  for (const f of fechasDePartido) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;

    const falta = aDias(f) - hoy;

    if (falta >= 1 && falta <= 6 && (mejor === 0 || falta < mejor)) mejor = falta;
  }

  return mejor ? `MD-${mejor}` : "";
}
