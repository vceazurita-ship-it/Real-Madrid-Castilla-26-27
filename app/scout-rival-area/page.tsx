"use client";

/**
 * Área del rival: cómo atacan y cómo defienden los centros laterales.
 *
 * Es la hermana de «ABP del Rival» para el juego que acaba en el área sin
 * balón parado. La jornada se prepara igual: se recoge la carpeta con los
 * clips de centros, se dibujan las láminas —de qué perfil centran, con qué
 * trayectoria y dónde rematan— y sale a PDF y a PPT. La parte de cómo
 * defienden los centros ya tiene su sección aunque todavía no haya material.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { AbpHeader, EmptyState, TeamPicker } from "@/components/abp/ui";
import { AnalisisRival } from "@/components/rivals/analisis/AnalisisRival";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEscudos } from "@/hooks/useEscudos";
import { traeJson } from "@/lib/hojaCsv";

const ULTIMO_EQUIPO = "rmcf-area-rival:equipo";

export default function AreaRivalPage() {
  const [plantilla, setPlantilla] = useState<unknown>([]);
  const [cargando, setCargando] = useState(true);

  const [elegido, setElegido] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      return window.localStorage.getItem(ULTIMO_EQUIPO);
    } catch {
      return null;
    }
  });

  const escudoDe = useEscudos();

  useEffect(() => {
    let cancelado = false;

    traeJson("/api/rivals?action=rivalesPlantillas")
      .catch(() => [])
      .then((filas) => {
        if (cancelado) return;

        setPlantilla(filas);
        setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const equipos = useMemo(() => {
    const filas = Array.isArray(plantilla) ? (plantilla as Record<string, unknown>[]) : [];

    return [...new Set(filas.map((fila) => String(fila.NOMBRE_EQUIPO ?? "").trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "es"),
    );
  }, [plantilla]);

  const equipo = elegido && equipos.includes(elegido) ? elegido : (equipos[0] ?? "");

  const elige = useCallback((nombre: string) => {
    setElegido(nombre);

    try {
      window.localStorage.setItem(ULTIMO_EQUIPO, nombre);
    } catch {
      /* modo privado: la elección sólo dura la sesión */
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="mx-auto min-w-0 max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <AbpHeader
            area="RMCF Castilla · Rival"
            title={equipo ? `Área · ${equipo}` : "Área del Rival"}
            crest={equipo ? <EscudoEquipo nombre={equipo} escudo={escudoDe(equipo)} lado={40} /> : undefined}
            lead="Cómo atacan y cómo defienden los centros laterales: desde qué perfil centran, con qué trayectoria, dónde caen los remates y quién los pone."
          />

          {cargando ? (
            <p className="mt-10 text-sm text-white/45">Cargando rivales…</p>
          ) : equipos.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                title="No hay rivales cargados"
                description="La hoja de plantillas rivales no ha devuelto ningún equipo."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <TeamPicker teams={equipos} value={equipo} onChange={elige} escudoDe={escudoDe} />

              {equipo && (
                <AnalisisRival
                  ambito="area"
                  equipo={equipo}
                  plantilla={plantilla}
                  escudo={escudoDe(equipo) ?? undefined}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
