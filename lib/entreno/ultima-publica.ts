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
  type AnalisisEntreno,
} from "@/lib/entreno/modelo";

/**
 * LA ÚLTIMA SESIÓN ANALIZADA, PARA LA PUERTA (16/11/2026).
 *
 * Los jueces pedían encima del acceso la última sesión de verdad (fecha,
 * cifra y base). La puerta es pública, así que sólo sale lo agregado del
 * día —cuántos objetivos, cuántas acciones revisadas y el acierto—, sin
 * jugadores, sin textos de objetivo y sin clips. Cuenta sólo lo revisado,
 * como la pantalla de dentro (`cuentasDe`).
 */
export type UltimaSesionPublica = {
  fecha: string;
  objetivos: number;
  total: number;
  correctas: number;
  /** null por debajo de `MINIMO_PORCENTAJE`: tendencia. */
  pct: number | null;
  /**
   * El acierto por tarea (16/11/2026, segunda vuelta de los jueces: «vista
   * previa real, cumplimiento por tarea»). Sólo el código y el nombre de la
   * tarea del registro, con lo agregado de sus objetivos: sin jugadores ni el
   * texto de los objetivos. En el orden de la sesión.
   */
  tareas: { codigo: string; nombre: string; correctas: number; total: number; pct: number | null }[];
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function ultimaSesionPublica(): Promise<UltimaSesionPublica | null> {
  try {
    const analisis = await listDocs<AnalisisEntreno>("entreno-analisis:", 60);
    const fechas = analisis
      .map((doc) => ({ fecha: doc.key.slice(doc.key.indexOf(":") + 1), data: doc.data }))
      .filter((doc) => FECHA.test(doc.fecha))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 6);

    for (const { fecha, data } of fechas) {
      const limpio = normalizaAnalisis(data);
      if (!limpio) continue;

      const sesion = normalizaSesion((await readDoc(claveSesion(fecha))).data);
      const vigentes = validacionesVigentes(sesion, limpio);
      const c = cuentasDe(accionesQueCuentan(sesion, limpio), vigentes);

      if (!c.total) continue;

      const acciones = accionesQueCuentan(sesion, limpio);
      const tareas: UltimaSesionPublica["tareas"] = [];

      for (const o of sesion.objetivos) {
        const codigo = (o.tarea ?? "").trim();

        if (!codigo || !objetivoMedido(o, limpio)) continue;

        const suyas = cuentasDe(
          acciones.filter((a) => a.objetivoId === o.id),
          vigentes,
        );

        if (!suyas.total) continue;

        const ya = tareas.find((t) => t.codigo === codigo);

        if (ya) {
          ya.correctas += suyas.correctas;
          ya.total += suyas.total;
        } else {
          tareas.push({ codigo, nombre: (o.tareaTexto ?? "").trim(), correctas: suyas.correctas, total: suyas.total, pct: null });
        }
      }

      for (const t of tareas) t.pct = t.total >= MINIMO_PORCENTAJE ? Math.round((100 * t.correctas) / t.total) : null;

      return {
        tareas,
        fecha,
        objetivos: sesion.objetivos.filter((o) => objetivoMedido(o, limpio)).length,
        total: c.total,
        correctas: c.correctas,
        pct: c.pct,
      };
    }
  } catch (error) {
    console.error("[entreno/ultima-publica]", error);
  }

  return null;
}
