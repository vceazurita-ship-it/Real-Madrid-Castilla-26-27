"use client";

/**
 * ABP EN DATOS (25/11/2026): pestaña del Laboratorio de ABP, sólo el
 * administrador. Estuvo unas horas en la app para todo el staff (/abp-datos,
 * menú Balón Parado y Análisis de datos); el analista la devolvió a su
 * laboratorio el mismo día. Las direcciones viejas llevan aquí (next.config.ts).
 *
 * Dos subpestañas, cada una con su fuente:
 * - Categoría · Opta: components/abp-lab/OptaBalonParado.tsx + OptaAbpEventos.tsx
 * - Ligas · Wyscout: components/abp-lab/AbpLigasWyscout.tsx
 * La subpestaña va en la dirección (?tab=ligas). Opta y Wyscout cuentan
 * distinto un córner, una falta o «acaba en tiro»: no se mezclan.
 */

import { useState, useSyncExternalStore } from "react";

import { Segmented } from "@/components/abp/ui";
import { OptaBalonParado } from "@/components/abp-lab/OptaBalonParado";
import { OptaAbpEventos } from "@/components/abp-lab/OptaAbpEventos";
import { AbpLigasWyscout } from "@/components/abp-lab/AbpLigasWyscout";
import { NavSecciones, type ItemNav } from "@/components/abp-lab/visual";

type Tab = "categoria" | "ligas";

/* La página es larga: una barra pegajosa lleva a cada bloque (y, en Opta, a cada sección). */
const NAV: Record<Tab, ItemNav[]> = {
  categoria: [
    { id: "abp-resumen", label: "Cabecera" },
    { id: "abp-opta", label: "Resumen", seccion: "Resumen" },
    { id: "abp-opta", label: "Córners", seccion: "Córners" },
    { id: "abp-opta", label: "Faltas", seccion: "Faltas" },
    { id: "abp-opta", label: "Banda", seccion: "Saques de banda" },
    { id: "abp-opta", label: "Penaltis", seccion: "Penaltis" },
    { id: "abp-saques", label: "Cada saque" },
    { id: "abp-saques-categoria", label: "La categoría en ese saque" },
  ],
  ligas: [
    { id: "lig-resumen", label: "Cabecera" },
    { id: "lig-vistazo", label: "De un vistazo" },
    { id: "lig-peligro", label: "Peligro" },
    { id: "lig-escudos", label: "Escudo a escudo" },
    { id: "lig-tendencia", label: "Partido a partido" },
    { id: "lig-premier", label: "Frente a la Premier" },
  ],
};

const TABS: { key: Tab; label: string; lema: string }[] = [
  { key: "categoria", label: "Categoría · Opta", lema: "El Castilla frente a su grupo y a toda la Primera RFEF, y cada saque acción a acción." },
  { key: "ligas", label: "Ligas · Wyscout", lema: "Todos los equipos de los dos grupos de Primera RFEF y de la Premier: cuánto se saca y cuánto acaba en remate, a favor y en contra." },
];

function ponEnDireccion(tab: Tab) {
  try {
    const u = new URL(window.location.href);
    if (tab === "categoria") u.searchParams.delete("tab");
    else u.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", u.toString());
  } catch {
    /* nada */
  }
}

/** `extra`: alto de la barra de pestañas del laboratorio, que va pegada encima de la de secciones. */
export function AbpDatosPanel({ extra = 0 }: { extra?: number }) {
  /* La subpestaña de la dirección (en el servidor no hay dirección: Opta); lo que se pulse manda después. */
  const deDireccion = useSyncExternalStore(
    () => () => {},
    () => (new URLSearchParams(window.location.search).get("tab") === "ligas" ? "ligas" : "categoria"),
    () => "categoria",
  ) as Tab;
  const [elegida, setTab] = useState<Tab | null>(null);
  const tab = elegida ?? deDireccion;

  const actual = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <Segmented
          ariaLabel="Fuente"
          options={TABS.map((t) => ({ key: t.key, label: t.label }))}
          value={tab}
          onChange={(k) => {
            setTab(k);
            ponEnDireccion(k);
          }}
        />
        <p className="text-[13px] text-white/60">{actual.lema}</p>
        <p className="text-[11.5px] text-white/40">
          Opta y Wyscout cuentan distinto un córner, una falta o una acción que acaba en tiro: las cifras de una pestaña no se comparan con las de la otra. Compara siempre dentro de la misma fuente.
        </p>
      </div>

      <NavSecciones key={tab} items={NAV[tab]} extra={extra} />

      <div className="mt-4 min-w-0">
        {tab === "categoria" && (
          <div className="grid min-w-0 grid-cols-1 gap-8 [&>*]:min-w-0">
            <OptaBalonParado />
            <OptaAbpEventos />
          </div>
        )}
        {tab === "ligas" && <AbpLigasWyscout />}
      </div>
    </>
  );
}
