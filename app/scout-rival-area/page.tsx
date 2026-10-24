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

import { AbpWyscoutRival } from "@/components/abp/AbpWyscoutRival";
import { AbpHeader, EmptyState, TeamPicker } from "@/components/abp/ui";
import { AnalisisRival } from "@/components/rivals/analisis/AnalisisRival";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { EsqueletoPantalla, EstadoError } from "@/components/ui/estados";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AvisoLento } from "@/components/rivals/AvisoLento";
import { useEscudos } from "@/hooks/useEscudos";
import { useLento } from "@/hooks/useLento";
import { useOrdenRivales } from "@/hooks/useOrdenRivales";
import { traeJson } from "@/lib/hojaCsv";

export default function AreaRivalPage() {
  const [plantilla, setPlantilla] = useState<unknown>([]);
  const [cargando, setCargando] = useState(true);
  /* Si la hoja falla se dice y se puede reintentar (11/10/2026): antes el
     fallo se tragaba como «[]» y parecía que no había rivales. Cambiar
     `intento` relanza la descarga saltándose la copia del aparato. */
  const [error, setError] = useState<unknown>(null);
  const [intento, setIntento] = useState(0);

  /*
  | El rival elegido a mano, sólo para esta visita. Antes se recordaba en
  | `localStorage` y el lunes la pantalla abría con el rival del partido ya
  | jugado; ahora abre con el del próximo (10/10/2026).
  */
  const [elegido, setElegido] = useState<string | null>(null);

  const escudoDe = useEscudos();

  /* El orden del calendario y el rival de la semana: la regla de `/rivals`. */
  const { ordena, proximoDe, jornadaDe, listo } = useOrdenRivales();

  useEffect(() => {
    let cancelado = false;

    traeJson("/api/rivals?action=rivalesPlantillas", { forzar: intento > 0 })
      .then((filas) => {
        if (cancelado) return;

        /* Si Google falla, la ruta contesta `{ success: false }`. */
        if (!Array.isArray(filas)) throw new Error("La hoja de plantillas no ha contestado");

        setPlantilla(filas);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [intento]);

  const reintenta = useCallback(() => {
    setCargando(true);
    setError(null);
    setIntento((n) => n + 1);
  }, []);

  const equipos = useMemo(() => {
    const filas = Array.isArray(plantilla) ? (plantilla as Record<string, unknown>[]) : [];

    /* Por calendario: el rival de la semana el primero. */
    return ordena(
      [...new Set(filas.map((fila) => String(fila.NOMBRE_EQUIPO ?? "").trim()).filter(Boolean))],
      (nombre) => nombre,
    );
  }, [plantilla, ordena]);

  /* Sin elegir a mano, nada hasta saber el calendario: antes caía en el primero
     por alfabeto (Alcorcón) y luego saltaba al rival de la semana (24/10/2026). */
  const equipo =
    elegido && equipos.includes(elegido) ? elegido : listo ? proximoDe(equipos) || (equipos[0] ?? "") : "";

  const lento = useLento(cargando);

  const elige = useCallback((nombre: string) => setElegido(nombre), []);

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
            <div className="mt-8 space-y-4">
              {lento && <AvisoLento onReintentar={reintenta} />}
              <EsqueletoPantalla titulo="los rivales" cifras={0} />
            </div>
          ) : error ? (
            <div className="mt-8">
              <EstadoError titulo="No se han podido cargar los rivales" error={error} onReintentar={reintenta} />
            </div>
          ) : equipos.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                title="No hay rivales cargados"
                description="Todavía no hay equipos para elegir."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <TeamPicker
                teams={equipos}
                value={equipo}
                onChange={elige}
                escudoDe={escudoDe}
                jornadaDe={jornadaDe}
                proximo={proximoDe(equipos)}
              />

              {/* Las cifras primero: lo que Wyscout dice de sus centros, con la mediana de la liga. Si no hay dato, no sale. */}
              {equipo && <AbpWyscoutRival ambito="area" equipo={equipo} plantilla={[]} />}

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
