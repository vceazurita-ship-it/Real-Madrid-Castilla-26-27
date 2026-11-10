"use client";

/**
 * LAS ÁREAS QUE ANTES ERAN EL «ÁREA OPTA» (10/11/2026, fase 4).
 *
 * `/opta` tenía doce pestañas por proveedor. Ahora cada una es un área de
 * «Análisis de datos» (`app/data-analisis/page.tsx`), dentro del bloque que
 * responde a su pregunta, y `/opta?pestana=` lleva a su sitio nuevo
 * (`AREA_DE_PESTANA` en `lib/data-analisis/areas-opta.ts`, que usa
 * `app/opta/page.tsx`).
 *
 * Las piezas son las mismas de siempre (`app/opta/_piezas/*`) y las cuentas no
 * cambian. Lo nuevo es el sitio y la carga:
 *
 * - Los seis documentos básicos (`useOpta`) se piden sólo al abrir un área de
 *   éstas (o el post), una vez para toda la pestaña del navegador; los
 *   evento a evento, como antes, sólo la pieza que los pinta.
 * - Cada área lleva su sello de fuente (`SelloFuente`): la fuente no va en el
 *   título.
 * - En «Rival y categoría» abren con el próximo rival (calendario de
 *   BeSoccer); en «Nuestro equipo», fijas en el Castilla.
 * - No funciona sin la carpeta de Wyscout: si ésta no carga, estas áreas
 *   siguen.
 */

import { useMemo, useState } from "react";
import { Database } from "lucide-react";

import { Buscador } from "@/app/opta/_piezas/Buscador";
import { Colectivo } from "@/app/opta/_piezas/Colectivo";
import { Directo } from "@/app/opta/_piezas/Directo";
import { Estilos } from "@/app/opta/_piezas/Estilos";
import { equiposDe } from "@/app/opta/_piezas/eventos";
import { Evolucion } from "@/app/opta/_piezas/Evolucion";
import { Fases } from "@/app/opta/_piezas/Fases";
import { Jugadores } from "@/app/opta/_piezas/Jugadores";
import { Liga } from "@/app/opta/_piezas/Liga";
import { PartidosCategoria } from "@/app/opta/_piezas/Momentum";
import { Penaltis } from "@/app/opta/_piezas/Penaltis";
import { RematesEquipo } from "@/app/opta/_piezas/Remates";
import { Talento } from "@/app/opta/_piezas/Talento";
import { useOpta, type DatosOpta } from "@/app/opta/_piezas/useOpta";
import { useCalendarioCastilla } from "@/components/data/SelloJornada";
import { EsqueletoPantalla, EstadoVacio } from "@/components/ui/estados";
import { SelloFuente } from "@/components/ui/SelloFuente";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import type { AreaOpta } from "@/lib/data-analisis/areas-opta";

export { AREAS_OPTA, AREA_DE_PESTANA, esAreaOpta, type AreaOpta } from "@/lib/data-analisis/areas-opta";

/** Con quién se compara cada área, para el sello. */
type Poblacion = "grupo" | "categoria" | "evento" | "remates" | "penaltis" | "jugadores" | "partido" | "directo";
const POBLACION: Record<AreaOpta, Poblacion> = {
  colectivo: "grupo",
  fases: "evento",
  evolucion: "grupo",
  remates: "remates",
  plantilla: "jugadores",
  buscador: "jugadores",
  talento: "jugadores",
  tablaLiga: "grupo",
  estilos: "categoria",
  evolucionLiga: "grupo",
  rematesLiga: "remates",
  partidoCategoria: "partido",
  penaltis: "penaltis",
  directo: "directo",
};

function poblacionDe(area: AreaOpta, datos: DatosOpta): string {
  const grupo = datos.grupos.get(CASTILLA_OPTA);
  const delGrupo = grupo == null ? 0 : [...datos.grupos.values()].filter((g) => g === grupo).length;
  const todos = datos.equipos.length;
  switch (POBLACION[area]) {
    case "grupo":
      return delGrupo ? `su grupo (${delGrupo} equipos) o la categoría` : "la categoría";
    case "categoria":
      return todos ? `categoría (${todos} equipos)` : "la categoría";
    case "evento":
      return "evento a evento";
    case "remates":
      return "remate a remate";
    case "penaltis":
      return "penalti a penalti";
    case "jugadores":
      return "jugadores de su puesto, por 90′";
    case "partido":
      return "cifras del partido";
    case "directo":
      return "en directo";
  }
}

/** «8 nov»: hasta qué partido llega la descarga. */
function hastaDe(datos: DatosOpta): string | undefined {
  const t = datos.meta?.temporada?.ultimoPartido;
  if (!t) return undefined;
  const d = new Date(t.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
}

/** El próximo rival del Castilla, con su id de Opta (si está en la descarga). */
function useProximoRivalOpta(datos: DatosOpta | null): string | undefined {
  const calendario = useCalendarioCastilla();
  return useMemo(() => {
    if (!calendario || !datos?.equipos.length) return undefined;
    const proximo = calendario.partidos
      .filter((x) => x.cuando.slice(0, 10) >= calendario.hoy)
      .sort((a, b) => a.cuando.localeCompare(b.cuando))[0];
    if (!proximo) return undefined;
    const rival = /castilla/i.test(proximo.local) ? proximo.visitante : proximo.local;
    const id = casaEquipo(rival, equiposDe(datos));
    return id && id !== CASTILLA_OPTA ? id : undefined;
  }, [calendario, datos]);
}

const MINIMO_INICIAL = 270;

export function PanelAreaOpta({ area }: { area: AreaOpta }) {
  const { datos, cargando, recarga } = useOpta();
  const rival = useProximoRivalOpta(datos);
  /* El mínimo de minutos es el mismo en la plantilla y en el buscador (como en las pestañas de antes). */
  const [minimo, setMinimo] = useState(MINIMO_INICIAL);

  if (cargando) {
    return (
      <div className="mt-5">
        <EsqueletoPantalla titulo="los datos del área" />
      </div>
    );
  }

  const sinDatos = !datos || datos.equipos.length === 0;
  if (sinDatos && area !== "directo") {
    return (
      <EstadoVacio
        className="mt-5"
        icon={Database}
        titulo="Todavía no ha llegado la descarga de la categoría"
        texto="Se descarga desde Ajustes (encargo «Opta») y sola cada lunes. En cuanto esté, aparece aquí."
        accion={
          <button type="button" onClick={recarga} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white/85">
            Volver a mirar
          </button>
        }
      />
    );
  }
  if (!datos) return null;

  return (
    <>
      <div className="mt-3">
        <SelloFuente fuente="opta" poblacion={poblacionDe(area, datos)} hasta={area === "directo" ? undefined : hastaDe(datos)} />
      </div>

      {area === "colectivo" && <Colectivo datos={datos} />}
      {area === "fases" && <Fases datos={datos} />}
      {area === "evolucion" && <Evolucion datos={datos} fijo={CASTILLA_OPTA} />}
      {area === "remates" && (
        <div className="mt-6">
          <RematesEquipo datos={datos} teamId={CASTILLA_OPTA} titulo="Nuestros remates" />
        </div>
      )}
      {area === "plantilla" && <Jugadores datos={datos} minimo={minimo} setMinimo={setMinimo} />}
      {area === "buscador" && <Buscador datos={datos} minimo={minimo} setMinimo={setMinimo} />}
      {area === "talento" && <Talento datos={datos} />}
      {area === "tablaLiga" && <Liga datos={datos} />}
      {area === "estilos" && <Estilos datos={datos} inicial={rival} />}
      {area === "evolucionLiga" && <Evolucion datos={datos} inicial={rival} />}
      {area === "rematesLiga" && (
        <div className="mt-6">
          <RematesEquipo datos={datos} inicial={rival} />
        </div>
      )}
      {area === "partidoCategoria" && <PartidosCategoria datos={datos} inicial={rival} />}
      {area === "penaltis" && <Penaltis datos={datos} />}
      {area === "directo" && <Directo datos={datos} />}
    </>
  );
}
