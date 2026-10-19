/**
 * EL ANÁLISIS DE ENTRENAMIENTO VISTO DESDE UN JUGADOR (19/10/2026).
 *
 * La pantalla del día enseña objetivos; el cuerpo técnico pregunta por
 * personas: «¿mejora Aguado en saltar o proteger la espalda?». Aquí se
 * juntan los días guardados (`entreno:` + `entreno-analisis:`) y se sacan,
 * para un jugador, sus objetivos sesión a sesión con la anterior y el
 * sentido, sus clips y el mensaje «Tu sesión» para mandarle por WhatsApp.
 *
 * Dos cosas que hay que saber:
 *
 *   - **El jugador se reconoce por el nombre, no por el ID.** Los JUG-XX de
 *     la hoja se renumeran; el objetivo copia el nombre al crearse.
 *   - **El mismo objetivo en dos días es el mismo texto.** Cada día tiene sus
 *     propios ids; se emparejan por el texto normalizado (por eso la pantalla
 *     ofrece copiar los objetivos del último día en vez de reescribirlos).
 *
 * Funciones puras: sin React y sin red, para poder comprobarlas con los
 * documentos reales desde un script.
 */

import {
  cuentasDe,
  cumpleMeta,
  veredictoFinal,
  type AccionEntreno,
  type AnalisisEntreno,
  type Cuentas,
  type ObjetivoEntreno,
  type SesionEntreno,
  type Validacion,
  type Veredicto,
} from "./modelo";

export type DiaEntreno = { fecha: string; sesion: SesionEntreno; analisis: AnalisisEntreno | null };

/** «Fortéa » → «fortea»: para comparar nombres y textos sin tildes ni mayúsculas. */
export const normaliza = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();

export const claveObjetivo = (o: ObjetivoEntreno) => normaliza(o.objetivo);

export type JugadorDelHistorial = { clave: string; nombre: string; dias: number };

/** Quién tiene objetivos en algún día, con en cuántos días aparece. */
export function jugadoresDelHistorial(dias: DiaEntreno[]): JugadorDelHistorial[] {
  const porClave = new Map<string, JugadorDelHistorial & { fechas: Set<string> }>();

  for (const d of dias)
    for (const o of d.sesion.objetivos) {
      if (!o.objetivo.trim()) continue;

      for (const j of o.jugadores) {
        const clave = normaliza(j.nombre);

        if (!clave) continue;

        const actual = porClave.get(clave) ?? { clave, nombre: j.nombre, dias: 0, fechas: new Set<string>() };

        actual.fechas.add(d.fecha);
        actual.dias = actual.fechas.size;
        porClave.set(clave, actual);
      }
    }

  return [...porClave.values()].map(({ clave, nombre, dias: n }) => ({ clave, nombre, dias: n })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

const esDelObjetivo = (o: ObjetivoEntreno, clave: string) => o.jugadores.some((j) => normaliza(j.nombre) === clave);

/**
 * Las acciones de un jugador dentro de un objetivo.
 *
 * Con un solo jugador, todas son suyas. Con varios, la IA dice a quién vio
 * («Joan (peto verde, central)»): vale si su nombre está ahí. Las que no
 * nombran a nadie reconocible no se le apuntan a nadie.
 */
export function accionesDelJugador(o: ObjetivoEntreno, acciones: AccionEntreno[], clave: string) {
  const suyas = acciones.filter((a) => a.objetivoId === o.id);

  if (o.jugadores.length <= 1) return suyas;

  return suyas.filter((a) => {
    const quien = ` ${normaliza(a.jugador ?? "")} `;

    return clave.split(" ").every((trozo) => quien.includes(` ${trozo} `));
  });
}

/**
 * El clip que mejor enseña un veredicto: con clip, con ese veredicto final
 * (lo validado manda), primero los validados y después el de explicación más
 * larga (es el que más dice). `null` si no hay.
 */
export function mejorClip(acciones: AccionEntreno[], validaciones: Record<string, Validacion> | undefined, veredicto: Veredicto) {
  return (
    acciones
      .filter((a) => a.clip && veredictoFinal(a, validaciones) === veredicto)
      .sort((a, b) => Number(Boolean(validaciones?.[b.id])) - Number(Boolean(validaciones?.[a.id])) || b.explicacion.length - a.explicacion.length)[0] ?? null
  );
}

export type Sentido = "mejor" | "peor" | "igual";

export type SesionDelObjetivo = {
  fecha: string;
  objetivo: ObjetivoEntreno;
  /** `false`: había objetivo pero ese día no se analizó. */
  analizado: boolean;
  /** El objetivo cambió después del análisis: sus números son de otra versión. */
  cambiado: boolean;
  cuentas: Cuentas | null;
  clipBien: AccionEntreno | null;
  clipMejorable: AccionEntreno | null;
  /** Frente a la sesión analizada anterior del mismo objetivo. */
  anterior: { fecha: string; cuentas: Cuentas } | null;
  sentido: Sentido | null;
  cumple: boolean | null;
};

export type LineaDelJugador = {
  clave: string;
  /** El texto del objetivo en su última versión. */
  texto: string;
  meta?: number;
  sesiones: SesionDelObjetivo[];
};

/** Diferencia, en puntos de porcentaje, que se da por cambio: menos es ruido. */
const UMBRAL_SENTIDO = 5;

export function sentidoEntre(antes: Cuentas, ahora: Cuentas): Sentido | null {
  if (antes.pctBruto === null || ahora.pctBruto === null) return null;

  const diferencia = ahora.pctBruto - antes.pctBruto;

  return diferencia >= UMBRAL_SENTIDO ? "mejor" : diferencia <= -UMBRAL_SENTIDO ? "peor" : "igual";
}

/**
 * La evolución de un jugador: cada objetivo suyo con sus sesiones, de la más
 * antigua a la más reciente. Los objetivos van ordenados por su último día
 * (lo que se está trabajando ahora, arriba).
 */
export function evolucionDelJugador(dias: DiaEntreno[], clave: string): LineaDelJugador[] {
  const lineas = new Map<string, LineaDelJugador>();
  const ordenados = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));

  for (const d of ordenados) {
    const huellas = new Set(d.analisis?.objetivosAnalizados ?? []);

    for (const o of d.sesion.objetivos) {
      if (!o.objetivo.trim() || !esDelObjetivo(o, clave)) continue;

      const k = claveObjetivo(o);
      const linea = lineas.get(k) ?? { clave: k, texto: o.objetivo.trim(), sesiones: [] };
      const analizado = Boolean(d.analisis && d.analisis.objetivosAnalizados?.some((h) => h.startsWith(`${o.id}|`)));
      const acciones = analizado && d.analisis ? accionesDelJugador(o, d.analisis.acciones, clave) : [];
      const c = analizado ? cuentasDe(acciones, d.sesion.validaciones) : null;
      const previa = [...linea.sesiones].reverse().find((s) => s.cuentas && s.cuentas.total > 0) ?? null;

      linea.texto = o.objetivo.trim();
      linea.meta = o.meta ?? linea.meta;
      linea.sesiones.push({
        fecha: d.fecha,
        objetivo: o,
        analizado,
        cambiado: analizado && ![...huellas].some((h) => h.startsWith(`${o.id}|${o.objetivo.trim()}|`)),
        cuentas: c,
        clipBien: analizado ? mejorClip(acciones, d.sesion.validaciones, "correcta") : null,
        clipMejorable: analizado ? mejorClip(acciones, d.sesion.validaciones, "mejorable") : null,
        anterior: previa?.cuentas ? { fecha: previa.fecha, cuentas: previa.cuentas } : null,
        sentido: previa?.cuentas && c && c.total ? sentidoEntre(previa.cuentas, c) : null,
        cumple: c ? cumpleMeta(c, o.meta) : null,
      });
      lineas.set(k, linea);
    }
  }

  return [...lineas.values()].sort((a, b) => (b.sesiones.at(-1)?.fecha ?? "").localeCompare(a.sesiones.at(-1)?.fecha ?? "") || a.texto.localeCompare(b.texto, "es"));
}

/**
 * La última sesión analizada antes de `fecha` del mismo objetivo (mismo
 * texto y algún jugador en común), con sus cuentas: es la «sesión anterior»
 * de la pantalla del día.
 */
export function anteriorDelObjetivo(dias: DiaEntreno[], fecha: string, o: ObjetivoEntreno): { fecha: string; cuentas: Cuentas } | null {
  const k = claveObjetivo(o);
  const suyos = new Set(o.jugadores.map((j) => normaliza(j.nombre)));

  if (!k) return null;

  const previos = dias.filter((d) => d.fecha < fecha && d.analisis).sort((a, b) => b.fecha.localeCompare(a.fecha));

  for (const d of previos) {
    const igual = d.sesion.objetivos.find((x) => claveObjetivo(x) === k && x.jugadores.some((j) => suyos.has(normaliza(j.nombre))));

    if (!igual || !d.analisis?.objetivosAnalizados?.some((h) => h.startsWith(`${igual.id}|`))) continue;

    const c = cuentasDe(
      d.analisis.acciones.filter((a) => a.objetivoId === igual.id),
      d.sesion.validaciones,
    );

    if (c.total) return { fecha: d.fecha, cuentas: c };
  }

  return null;
}

/** El último día antes de `fecha` con objetivos escritos: de ahí se copian. */
export function ultimoDiaConObjetivos(dias: DiaEntreno[], fecha: string) {
  return dias.filter((d) => d.fecha < fecha && d.sesion.objetivos.some((o) => o.objetivo.trim())).sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;
}

/* ------------------------------------------------------------------ */
/*  «TU SESIÓN»: EL MENSAJE PARA EL JUGADOR                            */
/* ------------------------------------------------------------------ */

export const fechaLarga = (fecha: string) => new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

/** «Continuidad con balón en campo contrario. (con balón)» → «Continuidad con balón en campo contrario (con balón)». */
const textoLimpio = (t: string) => t.trim().replace(/\.\s*\(/g, " (").replace(/[.\s]+$/, "");

export type TuSesion = {
  /** El mensaje entero, listo para WhatsApp. */
  texto: string;
  /** Cuántas acciones suyas siguen sin validar: se avisa antes de mandarlo. */
  sinValidar: number;
  clipBien: AccionEntreno | null;
  clipMejorable: AccionEntreno | null;
};

/**
 * El mensaje de un jugador para un día (19/10/2026, Paquete D).
 *
 * Dos frases —qué se ha medido con su cuenta y qué toca después—, su cuenta
 * por objetivo frente a la meta y como mucho dos enlaces: su mejor clip
 * correcto y su clip mejorable más claro. Lo que no hay no se nombra: sin
 * clip mejorable no sale esa línea, sin meta no se habla de meta.
 *
 * `null` si ese día no tiene nada analizado de él.
 */
export function tuSesion(dia: DiaEntreno, clave: string, nombre: string): TuSesion | null {
  if (!dia.analisis) return null;

  const validaciones = dia.sesion.validaciones;
  const analisis = dia.analisis;
  const suyos = dia.sesion.objetivos
    .filter((o) => o.objetivo.trim() && esDelObjetivo(o, clave))
    .filter((o) => analisis.objetivosAnalizados?.some((h) => h.startsWith(`${o.id}|`)))
    .map((o) => {
      const acciones = accionesDelJugador(o, analisis.acciones, clave);

      return { o, acciones, c: cuentasDe(acciones, validaciones) };
    })
    .filter((x) => x.c.total > 0);

  if (!suyos.length) return null;

  const todas = suyos.flatMap((x) => x.acciones);
  const total = cuentasDe(todas, validaciones);

  /* Lo que toca: el objetivo con más margen (peor porcentaje con alguna mejorable). */
  const foco = [...suyos].filter((x) => x.c.mejorables > 0).sort((a, b) => (a.c.pctBruto ?? 0) - (b.c.pctBruto ?? 0))[0] ?? null;
  const clipMejorable = foco ? mejorClip(foco.acciones, validaciones, "mejorable") : null;
  /* Lo bien hecho: del objetivo que mejor ha salido. */
  const mejor = [...suyos].sort((a, b) => (b.c.pctBruto ?? 0) - (a.c.pctBruto ?? 0));
  const clipBien = mejor.map((x) => mejorClip(x.acciones, validaciones, "correcta")).find(Boolean) ?? null;

  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;
  const frenteAMeta = (o: ObjetivoEntreno, c: Cuentas) => {
    const cumple = cumpleMeta(c, o.meta);

    return o.meta && cumple !== null ? `meta ${o.meta} %: ${cumple ? "cumplida" : "por debajo"}` : "";
  };
  const objetivos = suyos.length === 1 ? `«${textoLimpio(suyos[0].o.objetivo)}»` : `${suyos.length} objetivos tuyos`;
  const pctTotal = total.pct !== null ? `${total.pct} %` : "";
  const metaUnica = suyos.length === 1 ? frenteAMeta(suyos[0].o, suyos[0].c) : "";
  const parentesis = [pctTotal, metaUnica].filter(Boolean).join(" · ");
  const cifra = `${total.correctas} de ${total.total} acciones correctas${parentesis ? ` (${parentesis})` : ""}`;
  /* «En esta sesión», no «hoy» (20/10/2026): la vista por jugador prepara también el de los días pasados, y la fecha ya va arriba. */
  const frase1 = `${primerNombre}, en esta sesión hemos medido ${objetivos}: ${cifra}.`;

  /* La explicación de la IA sólo vale si ella también la vio mejorable: si el
     analista le dio la vuelta, explica lo contrario. Entonces, el criterio del objetivo. */
  const explicacion = clipMejorable && clipMejorable.veredicto === "mejorable" ? clipMejorable.explicacion : "";
  const consejo = foco ? (explicacion || foco.o.mejorable || "").trim().replace(/\.$/, "") : "";
  const donde = suyos.length > 1 && foco ? `, en «${textoLimpio(foco.o.objetivo)}»` : "";
  const frase2 = foco
    ? consejo
      ? `Para la próxima${donde}: ${consejo.charAt(0).toLowerCase()}${consejo.slice(1)}.`
      : /* Sin clip cortado no se le manda a mirarlo (20/10/2026). */
        clipMejorable
        ? `Para la próxima${donde}: mira el clip de lo que hay que mejorar.`
        : `Para la próxima, hay margen de mejora${donde ? ` en «${textoLimpio(foco.o.objetivo)}»` : ""}.`
    : "Todo lo que hemos visto ha salido bien: sigue así.";

  const lineas = suyos.map(({ o, c }) => {
    const pct = c.pct !== null ? ` · ${c.pct} %` : "";
    const meta = frenteAMeta(o, c);

    return `• ${textoLimpio(o.objetivo)}: ${c.correctas} de ${c.total}${pct}${meta ? ` · ${meta}` : ""}`;
  });

  const enlaces = [clipBien ? `▶ Lo que hiciste bien: ${clipBien.clip}` : "", clipMejorable ? `▶ Lo que hay que mejorar: ${clipMejorable.clip}` : ""].filter(Boolean);

  const texto = [`*Tu sesión · ${fechaLarga(dia.fecha)}*`, `${frase1} ${frase2}`, "", ...(suyos.length > 1 ? [...lineas, ""] : []), ...enlaces].join("\n").replace(/\n+$/, "");

  return { texto, sinValidar: todas.filter((a) => !validaciones?.[a.id]).length, clipBien, clipMejorable };
}
