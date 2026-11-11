/*
| LOS DATOS DE «QUIÉN MARCA A QUIÉN», FUERA DEL BOTÓN (06/11/2026)
|
| Antes vivían en components/abp/pizarra/PropuestaMarcas.tsx. Los usa también
| la exportación (segunda ronda de jueces): el córner defensivo salía con las
| casillas «Nº» vacías en el PDF general, el PowerPoint y el PDF de cada
| marcador, mientras el informe de ABP ya daba las marcas. Ahora, si el
| analista no las ha puesto, lo exportado lleva la misma propuesta. El
| tablero guardado no se toca.
*/

import { proponMarcas, type Atacante, type Marcador } from "@/lib/abp/marcas-corner";
import { puestosDeGrupo, type SlidePizarra, type TableroPizarra } from "@/lib/abp/pizarra";
import { buildAerialThreats, cargaAlturasBesoccer, loadRivalAbp } from "@/lib/abp/rival";
import { SCOUT_DOC_KEY, actionsOf } from "@/lib/abp/rivalScout";
import { casaNombre, sitioDe } from "@/lib/data-analisis/once";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { nuestrosDe } from "@/lib/duelos-onces";
import { traeJson } from "@/lib/hojaCsv";
import type { RatingsSeason } from "@/lib/ratings/types";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { suOnceTeorico } from "@/lib/tactics/oncesSemana";
import { huecosDelUltimoOnce } from "@/lib/tactics/ultimoOnce";
import { huecosDeLaPizarra } from "@/lib/tactics/huecosDeLaPizarra";
import { leeTableroDeOnces } from "@/lib/tactics/onceDeLaPizarra";
import type { Player } from "@/types/player";

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

const norma = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Duelos aéreos que hay detrás del %: por noventa × minutos. */
const duelosDe = (fila: FilaJugador | null | undefined) => {
  const por90 = numero(fila?.datos["Duelos aéreos en los 90"]);

  return por90 && fila ? (por90 * fila.minutos) / 90 : null;
};

/** Lo que no depende de la diapositiva: su once, nuestro plantel y de dónde sale. */
export type DatosMarcasRival = {
  equipo: string;
  plantel: Marcador[];
  atacantes: Atacante[];
  fuente: string;
};

export async function cargaDatosMarcas(rival: string, players: Player[]): Promise<DatosMarcasRival | null> {
  if (!rival) return null;

  const [once, plantillas, abp, scout, wyscout, temporada, tablero] = await Promise.all([
    suOnceTeorico(rival),
    traeJson<unknown>("/api/rivals?action=rivalesPlantillas").catch(() => []),
    loadRivalAbp().catch(() => ({ events: [] })),
    fetch(`/api/docs?key=${SCOUT_DOC_KEY}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    traeJson<{ jugadores?: FilaJugador[] }>("/api/data-analisis")
      .then((r) => r.jugadores ?? [])
      .catch(() => [] as FilaJugador[]),
    traeJson<{ season?: RatingsSeason }>("/api/ratings/load")
      .then((r) => r.season ?? null)
      .catch(() => null),
    leeTableroDeOnces().catch(() => null),
  ]);

  const equipo = once.equipo;

  /* ---------- Ellos: su once con todo lo que se sabe por arriba ---------- */

  const eventos = abp.events.filter((e) => mismoClub(e.equipo, equipo) || mismoClub(e.equipo, rival));
  /* Las estaturas de BeSoccer mandan sobre la hoja (11/11/2026). */
  if (typeof window !== "undefined") await cargaAlturasBesoccer();

  const plantilla = buildAerialThreats(plantillas, eventos, equipo);

  /* Su scouting de ABP también apunta quién remata. */
  const delScout = new Map<string, number>();

  for (const accion of actionsOf(scout?.data ?? null, equipo)) {
    if (accion.rematador) delScout.set(norma(accion.rematador), (delScout.get(norma(accion.rematador)) ?? 0) + 1);
  }

  const suyosWy = wyscout.filter((j) => j.temporada === "actual" && (mismoClub(j.equipo, equipo) || mismoClub(j.equipo, rival)));

  const atacantes: Atacante[] = once.tokens
    .filter((t) => t.nombre)
    .map((t) => {
      const nombre = t.nombre!;
      const hoja = casaNombre(nombre, plantilla, (p) => p.nombre);
      const wy = casaNombre(nombre, suyosWy, (j) => j.jugador);

      return {
        clave: t.id,
        nombre,
        dorsal: String(hoja?.dorsal || t.label || "").trim(),
        posicion: t.posicion ?? hoja?.posicion ?? "",
        altura: hoja?.altura ?? numero(wy?.altura),
        alturaHoja: hoja?.alturaHoja ?? null,
        aereoPct: numero(wy?.datos["Duelos aéreos ganados, %"]),
        aereos90: numero(wy?.datos["Duelos aéreos en los 90"]),
        duelos: duelosDe(wy),
        remates: (hoja?.remates ?? 0) + (delScout.get(norma(nombre)) ?? 0),
        remataAbp: hoja?.remataAbp ?? false,
      };
    });

  /* ---------- Nosotros: toda la plantilla, marcando los del once ---------- */

  /* El once de la pizarra táctica manda (02/11/2026); si no es de este rival, el último de Valoraciones con lo cambiado en Duelos. */
  const dePizarra = huecosDeLaPizarra(tablero, players, equipo);
  /* Lo cambiado a mano en Duelos manda también sobre la pizarra (sin repetir a nadie). */
  const conAMano = (base: Record<string, string>) => {
    const fijos = new Set(Object.values(once.nuestroAMano));

    return { ...Object.fromEntries(Object.entries(base).filter(([, id]) => !fijos.has(id))), ...once.nuestroAMano };
  };
  const { huecos } = dePizarra ? { huecos: conAMano(dePizarra.huecos) } : huecosDelUltimoOnce(temporada, players, once.nuestroAMano);
  const titulares = new Set(Object.values(huecos).filter(Boolean));

  const aereo = new Map(
    nuestrosDe(
      wyscout,
      players.map((p) => ({ id: p.id, nombre: p.nombre, apodo: p.apodo, foto: p.foto, posicion: p.posicion })),
    )
      .filter((j) => j.fichaId)
      .map((j) => [j.fichaId!, j]),
  );

  const plantel: Marcador[] = players
    .filter((p) => p.activo !== false && (p.esCastilla || titulares.has(p.id)))
    .map((p) => {
      const j = aereo.get(p.id);

      return {
        playerId: p.id,
        nombre: p.apodo || p.nombre,
        rol: j?.puesto ?? sitioDe(p.posicion ?? "", null).puesto,
        posicion: j?.posicion || p.posicion || "",
        altura: j?.altura ?? null,
        aereoPct: numero(j?.wyscout?.datos["Duelos aéreos ganados, %"]),
        aereos90: numero(j?.wyscout?.datos["Duelos aéreos en los 90"]),
        duelos: duelosDe(j?.wyscout),
        titular: titulares.has(p.id),
      };
    });

  if (!atacantes.length && !plantel.length) return null;

  return {
    equipo,
    plantel,
    atacantes,
    fuente: `${once.fuente}. Ellos: remates de ABP (hojas y scouting), altura y aéreos de Wyscout. Nosotros: puesto, altura y aéreos de Wyscout (el % pesa según los duelos que tiene detrás).`,
  };
}

/** Lo que depende de la diapositiva: quién está ya en cada marca y quién está en otro sitio. */
export function huecosDeMarca(slide: SlidePizarra) {
  const puestos = puestosDeGrupo(slide, "marcas");
  const claves = new Set(puestos.map((p) => p.key));
  const yaPuestos = new Map(slide.fichas.filter((f) => f.puesto && claves.has(f.puesto)).map((f) => [f.puesto!, f.playerId]));
  const enMarca = new Set(yaPuestos.values());
  const ocupados = new Set(slide.fichas.filter((f) => f.puesto && !enMarca.has(f.playerId)).map((f) => f.playerId));

  return { puestos, yaPuestos, ocupados };
}

/**
 * El tablero para exportar: las diapositivas con huecos de marca y sin ninguna
 * marca puesta llevan la propuesta (sólo el dorsal de su rival en la casilla:
 * quién está en cada marca no se cambia). Las que el analista ya tocó, tal cual.
 */
export function conMarcasPropuestas(tablero: TableroPizarra, datos: DatosMarcasRival | null): TableroPizarra {
  if (!datos) return tablero;

  let cambio = false;

  const slides = tablero.slides.map((slide) => {
    const { puestos, yaPuestos, ocupados } = huecosDeMarca(slide);

    if (!puestos.length || !yaPuestos.size) return slide;
    if (Object.values(slide.marcas ?? {}).some((d) => String(d ?? "").trim())) return slide;

    const filas = proponMarcas({ puestos: [...yaPuestos.keys()], yaPuestos, ocupados, plantel: datos.plantel, atacantes: datos.atacantes });
    const marcas = Object.fromEntries(filas.filter((f) => f.atacante?.dorsal).map((f) => [f.puesto, f.atacante!.dorsal]));

    if (!Object.keys(marcas).length) return slide;

    cambio = true;

    return { ...slide, marcas };
  });

  return cambio ? { ...tablero, slides } : tablero;
}
