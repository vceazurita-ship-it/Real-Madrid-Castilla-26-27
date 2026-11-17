/* Sólo para el servidor (lo llama el layout de /analisis-entrenamiento). */
import { listDocs, readDoc } from "@/lib/docStore";
import {
  accionesQueCuentan,
  claveSesion,
  cuentasDe,
  MINIMO_PORCENTAJE,
  normalizaAnalisis,
  normalizaSesion,
  objetivoMedido,
  validacionesVigentes,
  type AccionEntreno,
  type AnalisisEntreno,
  type SesionEntreno,
  type Validacion,
} from "@/lib/entreno/modelo";

/**
 * LA ÚLTIMA SESIÓN ANALIZADA, PARA LA PUERTA (16/11/2026).
 *
 * Los jueces pedían encima del acceso la última sesión de verdad (fecha,
 * cifra y base). La puerta es pública, así que sólo sale lo agregado del
 * día —cuántos objetivos, cuántas acciones y el acierto—, sin jugadores, sin
 * textos de objetivo y sin clips. Cuenta lo revisado, como la pantalla de
 * dentro (`cuentasDe`).
 *
 * 17/11/2026 (jueces, tercera vuelta): sin ninguna acción revisada la puerta
 * se quedaba en el ejemplo inventado. Entonces se cuenta la propuesta del
 * análisis (lo descartado no) y se dice «provisional, sin revisar», igual que
 * dentro. Y además de la última, las dos anteriores con su cifra.
 */
export type ResumenSesionPublica = {
  fecha: string;
  total: number;
  correctas: number;
  /** null por debajo de `MINIMO_PORCENTAJE`: tendencia. */
  pct: number | null;
  /** Cuenta de la propuesta automática: nada revisado todavía. */
  provisional: boolean;
};

export type UltimaSesionPublica = ResumenSesionPublica & {
  objetivos: number;
  /**
   * El acierto por tarea (16/11/2026): sólo el código y el nombre de la tarea
   * del registro, con lo agregado de sus objetivos y la meta más alta que se
   * le puso; sin jugadores ni el texto de los objetivos.
   */
  tareas: { codigo: string; nombre: string; correctas: number; total: number; pct: number | null; meta?: number }[];
  /** Las sesiones analizadas anteriores (hasta dos), de la más reciente a la más antigua. */
  anteriores: ResumenSesionPublica[];
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const pctDe = (correctas: number, total: number) => (total >= MINIMO_PORCENTAJE ? Math.round((100 * correctas) / total) : null);

/** Lo revisado; sin nada revisado, la propuesta (sin lo descartado). */
function cuenta(acciones: AccionEntreno[], vigentes: Record<string, Validacion> | undefined) {
  const c = cuentasDe(acciones, vigentes);

  if (c.total) return { total: c.total, correctas: c.correctas, provisional: false };

  const propuestas = acciones.filter((a) => vigentes?.[a.id] !== "descartada");

  return { total: propuestas.length, correctas: propuestas.filter((a) => a.veredicto === "correcta").length, provisional: true };
}

function resumenDe(fecha: string, sesion: SesionEntreno, analisis: AnalisisEntreno) {
  const vigentes = validacionesVigentes(sesion, analisis);
  const acciones = accionesQueCuentan(sesion, analisis);
  const c = cuenta(acciones, vigentes);

  return { vigentes, acciones, resumen: { fecha, total: c.total, correctas: c.correctas, pct: pctDe(c.correctas, c.total), provisional: c.provisional } };
}

export async function ultimaSesionPublica(): Promise<UltimaSesionPublica | null> {
  try {
    const analisis = await listDocs<AnalisisEntreno>("entreno-analisis:", 60);
    const fechas = analisis
      .map((doc) => ({ fecha: doc.key.slice(doc.key.indexOf(":") + 1), data: doc.data }))
      .filter((doc) => FECHA.test(doc.fecha))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 8);

    let ultima: UltimaSesionPublica | null = null;

    for (const { fecha, data } of fechas) {
      const limpio = normalizaAnalisis(data);
      if (!limpio) continue;

      const sesion = normalizaSesion((await readDoc(claveSesion(fecha))).data);
      const { vigentes, acciones, resumen } = resumenDe(fecha, sesion, limpio);

      if (!resumen.total) continue;

      if (ultima) {
        ultima.anteriores.push(resumen);

        if (ultima.anteriores.length >= 2) break;

        continue;
      }

      const tareas: UltimaSesionPublica["tareas"] = [];

      for (const o of sesion.objetivos) {
        const codigo = (o.tarea ?? "").trim();

        if (!codigo || !objetivoMedido(o, limpio)) continue;

        const suyas = cuenta(
          acciones.filter((a) => a.objetivoId === o.id),
          vigentes,
        );

        if (!suyas.total) continue;

        const ya = tareas.find((t) => t.codigo === codigo);

        if (ya) {
          ya.correctas += suyas.correctas;
          ya.total += suyas.total;
          if (o.meta && (!ya.meta || o.meta > ya.meta)) ya.meta = o.meta;
        } else {
          tareas.push({ codigo, nombre: (o.tareaTexto ?? "").trim(), correctas: suyas.correctas, total: suyas.total, pct: null, ...(o.meta ? { meta: o.meta } : {}) });
        }
      }

      for (const t of tareas) t.pct = pctDe(t.correctas, t.total);

      ultima = {
        ...resumen,
        tareas,
        objetivos: sesion.objetivos.filter((o) => objetivoMedido(o, limpio)).length,
        anteriores: [],
      };
    }

    return ultima;
  } catch (error) {
    console.error("[entreno/ultima-publica]", error);
  }

  return null;
}
