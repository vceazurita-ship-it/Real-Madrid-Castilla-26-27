"use client";

import { useState } from "react";
import { Database, Globe2 } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Segmented } from "@/components/abp/ui";
import { OptaBalonParado } from "@/components/abp-lab/OptaBalonParado";
import { OptaAbpEventos } from "@/components/abp-lab/OptaAbpEventos";
import { AbpLigasWyscout } from "@/components/abp-lab/AbpLigasWyscout";

type Tab = "categoria" | "ligas";

const TABS: { key: Tab; label: string; fuente: string; lema: string }[] = [
  { key: "categoria", label: "Categoría · Opta", fuente: "Opta", lema: "El Castilla frente a su grupo y a toda la Primera RFEF, y cada saque acción a acción." },
  { key: "ligas", label: "Ligas · Wyscout", fuente: "Wyscout", lema: "Todos los equipos de los dos grupos de Primera RFEF y de la Premier: cuánto se saca y cuánto acaba en remate, a favor y en contra." },
];

/** La pestaña elegida va en la dirección (?tab=ligas), para poder enlazarla y volver a ella. */
function ponEnDireccion(tab: Tab) {
  try {
    const u = new URL(window.location.href);
    if (tab === "categoria") u.searchParams.delete("tab");
    else u.searchParams.set("tab", tab);
    window.history.replaceState(null, "", u.toString());
  } catch {
    /* nada */
  }
}

export function AbpDatos({ inicial }: { inicial: Tab }) {
  const [tab, setTab] = useState<Tab>(inicial);
  const actual = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="Balón Parado"
              title="ABP en datos"
              lead="El balón parado de la categoría con Opta y el de cada liga con Wyscout, equipo a equipo y con sus escudos."
              aside={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  {tab === "categoria" ? <Database size={12} /> : <Globe2 size={12} />}
                  Fuente: {actual.fuente}
                </span>
              }
            />

            <div className="mt-5 flex min-w-0 flex-col gap-2">
              <Segmented
                ariaLabel="Pestaña"
                options={TABS.map((t) => ({ key: t.key, label: t.label }))}
                value={tab}
                onChange={(k) => {
                  const t = k as Tab;
                  setTab(t);
                  ponEnDireccion(t);
                }}
              />
              <p className="text-[13px] text-white/60">{actual.lema}</p>
              <p className="text-[11.5px] text-white/40">
                Opta y Wyscout cuentan distinto un córner, una falta o una acción que acaba en tiro: las cifras de una pestaña no se comparan con las de la otra. Compara siempre dentro de la misma fuente.
              </p>
            </div>

            <div className="mt-6 min-w-0">
              {tab === "categoria" && (
                <div className="grid min-w-0 grid-cols-1 gap-8 [&>*]:min-w-0">
                  <OptaBalonParado />
                  <OptaAbpEventos />
                </div>
              )}
              {tab === "ligas" && <AbpLigasWyscout />}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
