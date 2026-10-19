/*
|--------------------------------------------------------------------------
| LO QUE TOCA SEGÚN EL ÚLTIMO POST (21/10/2026)
|--------------------------------------------------------------------------
|
| El informe post dice «qué toca en el microciclo» (`sintesis.microciclo`),
| pero no se convertía en objetivo medible (crítica del experto en fútbol).
| Aquí se lee el post del último partido jugado —el mismo informe que arma
| el diálogo de Microciclos, sólo leyendo— y se proponen sus líneas como
| objetivos con su origen («Post J8 · Transición»). Pesa (lee el calendario,
| Wyscout y las hojas), así que sólo se pide al pulsar.
*/

export type QueTocaDelPost = {
  /** «Post J8», para el origen del objetivo. */
  origen: string;
  rival: string;
  lineas: { tema: string; texto: string }[];
};

/** Hasta cuántos microciclos atrás se busca el último partido jugado. */
const MICROS_ATRAS = 4;

export async function queTocaDelUltimoPost(): Promise<QueTocaDelPost | null> {
  const { cargaInforme, microsDisponibles } = await import("@/lib/informe-partido/carga");
  const micros = await microsDisponibles();

  for (const m of micros.slice(0, MICROS_ATRAS)) {
    const informe = await cargaInforme({ ...m, momento: "post" }).catch(() => null);

    /* El micro de la semana que viene aún no tiene partido jugado: se mira el anterior. */
    if (!informe?.partido.jugado) continue;

    const lineas = (informe.sintesis.microciclo ?? []).map((texto) => ({ tema: texto.split(" · ")[0].trim(), texto: texto.trim() })).filter((x) => x.texto);

    if (!lineas.length) return null;

    return { origen: `Post${informe.partido.jornada ? ` J${informe.partido.jornada}` : ""}`, rival: informe.partido.rival, lineas };
  }

  return null;
}
