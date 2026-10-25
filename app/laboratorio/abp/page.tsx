"use client";

/**
 * LABORATORIO DE ABP (20/10/2026) · sólo administrador.
 *
 * El sitio donde se inventa el balón parado del Castilla:
 * - **Referentes**: lo que hacen Jover (Arsenal), Cueva (Chelsea), Brentford,
 *   Georgson, Vio, Grønnemark y Coulston, con la fuente de cada cosa y lo que
 *   se puede estudiar gratis.
 * - **Lo mejor de cada jornada**: las cinco mejores acciones a balón parado de
 *   cada jornada de Primera RFEF, LaLiga, Segunda, Premier y Champions (Wyscout),
 *   con el resumen oficial de YouTube de cada partido.
 * - **Taller**: nuestras rutinas, de la idea al partido.
 * - **Retos**: la competición de la plantilla, con podio, rachas e insignias.
 * - **Datos**: el balón parado de Primera RFEF y la Premier en Wyscout
 *   (`/laboratorio/abp/datos`, su propia pantalla).
 *
 * El candado está en `layout.tsx` (servidor) y en el menú (`soloAdmin`).
 */

import { useEffect, useState } from "react";
import { BarChart3, BookMarked, FlaskConical, Swords, Target, Trophy } from "lucide-react";
import Link from "next/link";

import { AbpHeader, Notice } from "@/components/abp/ui";
import { MejorJornada } from "@/components/abp-lab/MejorJornada";
import { Referentes } from "@/components/abp-lab/Referentes";
import { Retos } from "@/components/abp-lab/Retos";
import { Taller, borradorVacio, type Borrador } from "@/components/abp-lab/Taller";
import { useJugadoresLab } from "@/components/abp-lab/comun";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useAbpLab } from "@/hooks/useAbpLab";
import { rutinaDeEnlace } from "@/lib/abp-lab/enlace";
import { ESQUEMAS } from "@/lib/abp-lab/esquemas";
import type { Defensa } from "@/lib/abp-lab/modelo";

/** La defensa que cuenta la fuente («Southampton (cinco zonales, tres al hombre)» es mixta). */
function defensaDe(texto?: string): Defensa {
  const t = (texto ?? "").toLowerCase();

  const zona = /zona/.test(t);

  const hombre = /hombre/.test(t);

  return zona && hombre ? "mixta" : zona ? "zona" : hombre ? "hombre" : "cualquiera";
}

type Pestana = "referentes" | "jornada" | "taller" | "retos";

const PESTANAS: { key: Pestana; label: string; icon: typeof Trophy; lema: string }[] = [
  { key: "referentes", label: "Referentes", icon: BookMarked, lema: "Lo que hacen los mejores" },
  { key: "jornada", label: "Lo mejor de cada jornada", icon: Target, lema: "Wyscout, cada mañana" },
  { key: "taller", label: "Taller", icon: FlaskConical, lema: "Nuestras rutinas" },
  { key: "retos", label: "Retos", icon: Swords, lema: "La competición" },
];

export default function LaboratorioAbpPage() {
  const [pestana, setPestana] = useState<Pestana>("referentes");

  const [borrador, setBorrador] = useState<Borrador | null>(null);

  const { doc, estado, guarda } = useAbpLab();

  const { jugadores, porId } = useJugadoresLab();

  const ocupado = estado === "guardando";

  /* Un enlace compartido (`#rutina=…`) abre esa rutina en el taller, como borrador sin guardar. */
  useEffect(() => {
    if (!window.location.hash.includes("rutina=")) return;

    void rutinaDeEnlace(window.location.hash).then((r) => {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);

      if (!r) return;

      const { id: _id, creadaEn: _c, actualizadaEn: _a, ...borrador } = r;

      void _id;
      void _c;
      void _a;

      setBorrador({ ...borradorVacio(), ...borrador });
      setPestana("taller");
    });
  }, []);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Balón parado"
              title="Laboratorio de ABP"
              lead="Mira qué rutina encaja esta semana contra el próximo rival, ábrela en el taller y llévala al microciclo."
              aside={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  <FlaskConical size={12} />
                  Sólo tú
                </span>
              }
            />

            {/* ------------------------ PESTAÑAS ------------------------------ */}
            <nav className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" aria-label="Secciones del laboratorio">
              {PESTANAS.map((p) => {
                const activa = p.key === pestana;

                const Icono = p.icon;

                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-current={activa ? "page" : undefined}
                    onClick={() => setPestana(p.key)}
                    className={`group flex min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                      activa ? "border-[#C8A96B]/60 bg-[#C8A96B]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${activa ? "bg-[#C8A96B]/20 text-[#C8A96B]" : "bg-white/5 text-white/50"}`}>
                      <Icono size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-semibold ${activa ? "text-[#C8A96B]" : "text-white/85"}`}>{p.label}</span>
                      <span className="block truncate text-[11px] text-white/45">{p.lema}</span>
                    </span>
                  </button>
                );
              })}
              <Link
                href="/laboratorio/abp/datos"
                className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 transition hover:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50">
                  <BarChart3 size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white/85">Datos</span>
                  <span className="block truncate text-[11px] text-white/45">Primera RFEF y Premier</span>
                </span>
              </Link>
            </nav>

            {estado === "error" && (
              <div className="mt-5">
                <Notice tone="warn" title="No se ha podido leer el laboratorio">
                  Si la sesión de administrador ha caducado, vuelve a entrar desde Ajustes.
                </Notice>
              </div>
            )}

            <div className="mt-6">
              {pestana === "referentes" && (
                <Referentes
                  onAlTaller={(rutina, referente) => {
                    /* Llega dibujada si tenemos su esquema, y con la defensa contra la que la cuenta su fuente. */
                    const esquema = ESQUEMAS[rutina.id];

                    setBorrador({
                      ...borradorVacio(),
                      nombre: rutina.nombre,
                      tipo: rutina.tipo,
                      contra: defensaDe(rutina.contra),
                      inspiracion: rutina.id || referente,
                      idea: rutina.pasos.map((p, i) => `${i + 1}. ${p}`).join("\n"),
                      ...(esquema ? { roles: esquema.roles.map((r) => ({ ...r })), balon: esquema.balon.map((p) => ({ ...p })) } : {}),
                    });
                    setPestana("taller");
                  }}
                />
              )}

              {pestana === "jornada" && (
                <MejorJornada
                  onAlTaller={(b) => {
                    setBorrador(b);
                    setPestana("taller");
                  }}
                />
              )}

              {pestana === "taller" && (
                <Taller
                  rutinas={doc.rutinas}
                  jugadores={jugadores}
                  porId={porId}
                  guarda={guarda}
                  ocupado={ocupado}
                  cargando={estado === "cargando"}
                  abierto={borrador}
                  setAbierto={setBorrador}
                />
              )}

              {pestana === "retos" && <Retos doc={doc} jugadores={jugadores} porId={porId} guarda={guarda} ocupado={ocupado} cargando={estado === "cargando"} />}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
