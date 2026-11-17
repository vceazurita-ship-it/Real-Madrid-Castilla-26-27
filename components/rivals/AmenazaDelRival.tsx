"use client";

/**
 * LO SUYO QUE HAY QUE PARAR (17/11/2026, ronda 19, jueces de fútbol): la
 * amenaza principal del rival con la cifra que la sostiene, para Scout
 * colectivo («Cómo nos hacen daño», arriba) y el Plan de partido (punto 4 de
 * «Cómo le ganamos»).
 *
 * - Quién le hace el gol: el primero de su reparto del xG en Opta
 *   (`repartoXg`, el mismo bloque «Reparto del xG» del Scout colectivo), con su
 *   parte, su xG y sus minutos.
 * - Por dónde llegan sus centros: la banda que más centra en Wyscout y quién
 *   los carga (`/api/data-analisis?bandas=`, el mismo de «Por dónde ataca»).
 *
 * Cada punto con su orden y los enlaces a la ficha del jugador y a Área del
 * rival. Lo que no tiene dato no sale; sin nada, no se pinta.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useDocsOpta } from "@/hooks/useDocsOpta";
import { traeJson } from "@/lib/hojaCsv";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { nombreDePlantilla } from "@/lib/rivals/nombre-jugador";
import type { PorDondeAtaca } from "@/lib/rivals/por-donde-ataca";
import { repartoXg } from "@/lib/rivals/reparto-xg";
import { conRivalEnUrl } from "@/lib/rivals/rival-en-curso";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { nombrePropio } from "@/lib/rivals/dano";
import { conTildes } from "@/lib/rivals/tildes";

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

export type PuntoAmenaza = {
  clave: "xg" | "centros";
  /** La amenaza, con su cifra. */
  dato: string;
  /** Lo nuestro. */
  orden: string;
  /** El jugador, para su ficha en Scout individual. */
  jugador: string;
};

/** Los dos puntos de su amenaza; vacío mientras carga o si no hay dato. */
export function useAmenazaDelRival(equipo: string, nombres: string[] = []): PuntoAmenaza[] {
  const { docs } = useDocsOpta<[TablaOpta, TablaOpta]>(DOCS_OPTA.equipos, DOCS_OPTA.jugadoresPartidos);
  const [tEquipos, tJugPartidos] = docs;
  const [bandas, setBandas] = useState<{ equipo: string; datos: PorDondeAtaca | null }>({ equipo: "", datos: null });

  useEffect(() => {
    if (!equipo) return;

    let cancelado = false;

    traeJson<{ ok?: boolean } & Partial<PorDondeAtaca>>(`/api/data-analisis?bandas=${encodeURIComponent(equipo)}`)
      .then((r) => {
        if (!cancelado) setBandas({ equipo, datos: r?.ok && Array.isArray(r.bandas) && r.total ? (r as PorDondeAtaca) : null });
      })
      .catch(() => {
        if (!cancelado) setBandas({ equipo, datos: null });
      });

    return () => {
      cancelado = true;
    };
  }, [equipo]);

  /* Sin nombres de fuera (el Plan), los de su plantilla de la hoja: «Flakus», no «David Flakus Bosilj». */
  const [deLaHoja, setDeLaHoja] = useState<{ equipo: string; nombres: string[] }>({ equipo: "", nombres: [] });
  const sinNombres = nombres.length === 0;

  useEffect(() => {
    if (!equipo || !sinNombres) return;

    let cancelado = false;

    traeJson<Record<string, unknown>[]>("/api/rivals?action=rivalesPlantillas")
      .then((filas) => {
        if (cancelado || !Array.isArray(filas)) return;

        setDeLaHoja({
          equipo,
          nombres: filas
            .filter((f) => mismoClub(String(f.NOMBRE_EQUIPO ?? ""), equipo))
            .map((f) => conTildes(nombrePropio(String(f["NOMBRE DEPORTIVO"] ?? "").trim() || String(f.JUGADOR ?? "").trim())))
            .filter(Boolean),
        });
      })
      .catch(() => undefined);

    return () => {
      cancelado = true;
    };
  }, [equipo, sinNombres]);

  const firmaNombres = (sinNombres ? (deLaHoja.equipo === equipo ? deLaHoja.nombres : []) : nombres).join("|");

  return useMemo(() => {
    const puntos: PuntoAmenaza[] = [];
    const conNombre = (j: string) => nombreDePlantilla(j, firmaNombres ? firmaNombres.split("|") : []);

    if (tEquipos && tJugPartidos) {
      const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
      const id = casaEquipo(equipo, equipos);
      const reparto = id && id !== CASTILLA_OPTA ? repartoXg(aObjetos(tJugPartidos), id) : null;
      const primero = reparto?.jugadores[0];

      /* Sólo si de verdad concentra: con un 12 % no hay «su hombre» que marcar. */
      if (reparto && primero && primero.pct >= 18 && primero.minutos >= 270) {
        const nombre = conNombre(primero.jugador);

        puntos.push({
          clave: "xg",
          dato: `${nombre} suma el ${Math.round(primero.pct)} % de su xG (${coma(primero.xg)} en ${Math.round(primero.minutos)}′${primero.xg90 != null ? `, ${coma(primero.xg90)} por 90′` : ""}; Opta, ${reparto.sinPenaltis ? "sin penaltis" : "con penaltis"})`,
          orden: `marcar a ${nombre} en el área: vigilancia al hombre en el centro y en el segundo palo`,
          jugador: nombre,
        });
      }
    }

    const datos = bandas.equipo === equipo ? bandas.datos : null;
    const totalCentros = datos?.total.centros ?? 0;

    if (datos && totalCentros >= 20) {
      const porFuera = datos.bandas.filter((b) => b.banda !== "centro").sort((a, b) => b.acciones.centros - a.acciones.centros);
      const banda = porFuera[0];
      const parte = banda ? Math.round((100 * banda.acciones.centros) / totalCentros) : 0;
      const lider = banda?.lider.centros ?? null;

      if (banda && parte >= 50 && lider) {
        const nombre = conNombre(lider.jugador);

        puntos.push({
          clave: "centros",
          /* 17/11/2026 (ronda 20, fútbol): «207» aquí y «208» en Área; éste es la suma de sus jugadores, no el total del equipo, y se dice. */
          dato: `Centra sobre todo por la ${banda.banda}: ${parte} % de los ${totalCentros} centros de sus jugadores; ${nombre}, el ${Math.round((100 * lider.acciones) / totalCentros)} % (Wyscout, temporada, sumados jugador a jugador)`,
          orden: `cerrar el carril de ${nombre} antes del centro y defender el área con la línea ya hecha`,
          jugador: nombre,
        });
      }
    }

    return puntos;
  }, [tEquipos, tJugPartidos, bandas, equipo, firmaNombres]);
}

/** Los enlaces de un punto: su ficha en Scout individual y, en los centros, Área del rival. */
export function EnlacesAmenaza({ punto, equipo, rivalId = "" }: { punto: PuntoAmenaza; equipo: string; rivalId?: string }) {
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold">
      <Link
        href={`/scout-rival-individual?${new URLSearchParams({ equipo, jugador: punto.jugador }).toString()}`}
        className="hover:underline"
        style={{ color: "var(--rmcf-gold-ink, #C8A96B)" }}
      >
        Su ficha y sus cortes ›
      </Link>
      {punto.clave === "centros" && (
        <Link href={conRivalEnUrl("/scout-rival-area", { equipo, id: rivalId })} className="hover:underline" style={{ color: "var(--rmcf-gold-ink, #C8A96B)" }}>
          Sus centros, en Área del rival ›
        </Link>
      )}
    </span>
  );
}

/** Como sección (Scout colectivo): «Cómo nos hacen daño · lo que dicen los datos». */
export function AmenazaDelRival({ equipo, rivalId = "", nombres = [] }: { equipo: string; rivalId?: string; nombres?: string[] }) {
  const puntos = useAmenazaDelRival(equipo, nombres);

  if (!puntos.length) return null;

  return (
    <section aria-label="Cómo nos hacen daño, en datos" className="mb-6 rounded-2xl border border-rose-400/25 bg-rose-400/[0.05] px-5 py-4">
      <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-rose-300">
        Cómo nos hacen daño
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">dato · Opta y Wyscout, temporada</span>
      </p>
      <ul className="mt-2 grid gap-3 md:grid-cols-2">
        {puntos.map((p) => (
          <li key={p.clave} className="min-w-0">
            <p className="text-sm leading-6 text-white/85">{p.dato}.</p>
            <p className="mt-0.5 text-sm leading-6 text-white/85">
              <b className="font-semibold text-rose-300">Qué hacemos:</b> {p.orden.charAt(0).toUpperCase() + p.orden.slice(1)}.
            </p>
            <EnlacesAmenaza punto={p} equipo={equipo} rivalId={rivalId} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default AmenazaDelRival;
