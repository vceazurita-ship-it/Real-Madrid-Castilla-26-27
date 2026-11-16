/* Sólo para el servidor (lo llama el layout de /analisis-entrenamiento). */
import { listDocs, readDoc } from "@/lib/docStore";
import {
  accionesQueCuentan,
  claveSesion,
  cuentasDe,
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

      return {
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
