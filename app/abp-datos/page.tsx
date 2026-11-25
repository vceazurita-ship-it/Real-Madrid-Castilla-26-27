/**
 * ABP EN DATOS (25/11/2026). Petición del analista: las pestañas «Opta» y
 * «Datos» del Laboratorio de ABP (sólo administrador) salen a la app, en el
 * menú Balón Parado, para todo el staff. Dos pestañas, cada una con su fuente:
 * - Categoría · Opta: el Castilla frente a su grupo y a toda la Primera RFEF
 *   (components/abp-lab/OptaBalonParado.tsx) y los saques acción a acción
 *   (components/abp-lab/OptaAbpEventos.tsx). Lo mismo sale en Análisis de
 *   datos → Balón parado → «ABP · Opta (categoría)»: mismos componentes.
 * - Ligas · Wyscout: Primera RFEF y Premier (components/abp-lab/AbpLigasWyscout.tsx).
 * Opta y Wyscout cuentan distinto un córner, una falta o «acaba en tiro»: no
 * se mezclan y cada pestaña dice de dónde sale.
 */
import { AbpDatos } from "./AbpDatos";

export default async function AbpDatosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;

  return <AbpDatos inicial={tab === "ligas" ? "ligas" : "categoria"} />;
}
