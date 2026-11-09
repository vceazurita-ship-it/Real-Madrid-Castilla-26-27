"use client";

/**
 * ÁREA OPTA (09/11/2026).
 *
 * Lo que da de sí la descarga de Opta (TruMedia ProVision) de Primera RFEF,
 * en cinco pestañas:
 *
 * - **Castilla**: el colectivo por fases, con puesto y percentil en el grupo,
 *   y su evolución partido a partido contra la media del grupo.
 * - **La liga**: todos los equipos en una tabla ordenable con las métricas que
 *   se quieran, y la dispersión de dos métricas.
 * - **Jugadores**: la plantilla por 90 minutos; cada uno, con su ficha de
 *   percentiles contra su puesto y su partido a partido.
 * - **Buscador**: jugadores de toda la categoría por puesto, edad y métrica.
 * - **Directo**: las cifras del partido que se está jugando, si el proceso
 *   del directo está en marcha.
 *
 * Los datos no están en el repositorio (es público): viven en Supabase y se
 * leen por /api/docs (`lib/opta.ts`). Las cuentas, en `lib/opta-analisis.ts`;
 * los nombres en castellano, en `lib/opta-nombres.ts`.
 */

import { useState, useSyncExternalStore } from "react";
import { Activity, Database } from "lucide-react";

import { EsqueletoPantalla, EstadoVacio } from "@/components/ui/estados";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import { Buscador } from "./_piezas/Buscador";
import { Colectivo } from "./_piezas/Colectivo";
import { Directo } from "./_piezas/Directo";
import { Jugadores } from "./_piezas/Jugadores";
import { Liga } from "./_piezas/Liga";
import { useOpta } from "./_piezas/useOpta";

const PESTANAS = [
  { clave: "castilla", nombre: "Castilla" },
  { clave: "liga", nombre: "La liga" },
  { clave: "jugadores", nombre: "Jugadores" },
  { clave: "buscador", nombre: "Buscador" },
  { clave: "directo", nombre: "Directo" },
] as const;
type Pestana = (typeof PESTANAS)[number]["clave"];

const esPestana = (v: string | null): v is Pestana => PESTANAS.some((p) => p.clave === v);

/* `?pestana=` de la URL, sin Suspense y con la instantánea de servidor vacía (como en Duelos). */
const leePestana = () => new URLSearchParams(window.location.search).get("pestana") ?? "";
const sinPestana = () => "";
function alLlegar(avisa: () => void) {
  const t = setTimeout(avisa, 0);
  return () => clearTimeout(t);
}

const MINIMO_INICIAL = 270;

export default function OptaPage() {
  const { datos, cargando, recarga } = useOpta();
  const enlazada = useSyncExternalStore(alLlegar, leePestana, sinPestana);
  const [elegida, setElegida] = useState<Pestana | null>(null);
  const pestana: Pestana = elegida ?? (esPestana(enlazada) ? enlazada : "castilla");
  const [minimo, setMinimo] = useState(MINIMO_INICIAL);

  const cambia = (p: Pestana) => {
    setElegida(p);
    const url = new URL(window.location.href);
    url.searchParams.set("pestana", p);
    window.history.replaceState(null, "", url.toString());
  };

  const meta = datos?.meta ?? null;
  const sinDatos = !cargando && (!datos || datos.equipos.length === 0);
  const ultimo = meta?.temporada?.ultimoPartido ? new Date(meta.temporada.ultimoPartido.replace(" ", "T")) : null;

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />

          <section className="px-4 pb-12 pt-6 sm:px-8 sm:pt-10">
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">RMCF CASTILLA · ANÁLISIS</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Activity className="h-7 w-7 text-[#C8A96B]" />
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Área Opta</h1>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-white/55">
              El Castilla, la liga y los jugadores de Primera RFEF según Opta: cada cifra con su puesto y su percentil contra el grupo o
              contra toda la categoría.
            </p>
            {meta && (
              <p className="mt-2 text-xs text-white/45">
                {[
                  meta.temporada?.nombre?.replace(" (Spain)", ""),
                  ultimo && !Number.isNaN(ultimo.getTime())
                    ? `hasta el partido del ${ultimo.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}

            <div
              role="tablist"
              aria-label="Área Opta"
              className="sticky top-[81px] z-20 mt-6 inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-white/10 bg-[#0B0F14]/95 p-1 backdrop-blur md:top-[97px]"
            >
              {PESTANAS.map((p) => (
                <button
                  key={p.clave}
                  type="button"
                  role="tab"
                  aria-selected={pestana === p.clave}
                  onClick={() => cambia(p.clave)}
                  className={`min-h-[40px] rounded-xl px-4 text-sm font-semibold transition ${
                    pestana === p.clave ? "bg-[#C8A96B] text-black" : "text-white/65 hover:text-white"
                  }`}
                >
                  {p.nombre}
                </button>
              ))}
            </div>

            {cargando ? (
              <div className="mt-6">
                <EsqueletoPantalla titulo="los datos de Opta" />
              </div>
            ) : sinDatos && pestana !== "directo" ? (
              <EstadoVacio
                className="mt-6"
                icon={Database}
                titulo="Todavía no hay datos de Opta"
                texto="Se descargan desde Ajustes (encargo «Opta») y solos cada lunes. En cuanto estén, aparecen aquí."
                accion={
                  <button type="button" onClick={recarga} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white/85">
                    Volver a mirar
                  </button>
                }
              />
            ) : datos ? (
              <>
                {pestana === "castilla" && <Colectivo datos={datos} />}
                {pestana === "liga" && <Liga datos={datos} />}
                {pestana === "jugadores" && <Jugadores datos={datos} minimo={minimo} setMinimo={setMinimo} />}
                {pestana === "buscador" && <Buscador datos={datos} minimo={minimo} setMinimo={setMinimo} />}
                {pestana === "directo" && <Directo datos={datos} />}
              </>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
