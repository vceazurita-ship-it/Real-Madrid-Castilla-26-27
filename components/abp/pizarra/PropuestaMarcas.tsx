"use client";

/**
 * «Quién marca a quién» del córner defensivo (27/10/2026).
 *
 * Lee su once, sus remates de ABP, la plantilla con alturas y Wyscout; lee
 * nuestro once (Valoraciones + lo cambiado en Duelos) y propone las marcas
 * (`lib/abp/marcas-corner.ts`). Al aplicar, cada marca lleva el dorsal de su
 * rival en la casilla de encima de la cabeza y en el panel, y los huecos de
 * marca vacíos se rellenan con nuestros mejores por alto. Se deshace con Ctrl+Z.
 */

import { useState } from "react";
import { Crosshair } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog } from "@/components/abp/ui";
import { poderAereo, proponMarcas, type Atacante, type Emparejamiento, type Marcador } from "@/lib/abp/marcas-corner";
import { puestosDeGrupo, type SlidePizarra } from "@/lib/abp/pizarra";
import { buildAerialThreats, loadRivalAbp } from "@/lib/abp/rival";
import { SCOUT_DOC_KEY, actionsOf } from "@/lib/abp/rivalScout";
import { casaNombre } from "@/lib/data-analisis/once";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { nuestrosDe } from "@/lib/duelos-onces";
import { traeJson } from "@/lib/hojaCsv";
import type { RatingsSeason } from "@/lib/ratings/types";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { suOnceTeorico } from "@/lib/tactics/oncesSemana";
import { huecosDelUltimoOnce } from "@/lib/tactics/ultimoOnce";
import type { Player } from "@/types/player";

const PORTERO = /portero|^po?r?$|^gk$/i;

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

const norma = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export type MarcasAplicadas = {
  /** puesto → dorsal del rival al que marca. */
  marcas: Record<string, string>;
  /** Huecos de marca vacíos que se llenan: puesto → jugador. */
  nuevos: { puesto: string; playerId: string }[];
};

type Propuesta = { pares: (Emparejamiento & { puesto: string })[]; fuente: string };

export function PropuestaMarcas({
  slide,
  rival,
  players,
  onAplicar,
}: {
  slide: SlidePizarra;
  rival: string;
  players: Player[];
  onAplicar: (cambio: MarcasAplicadas) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);

  const calcula = async () => {
    if (!rival) return;

    setCargando(true);

    try {
      const [once, plantillas, abp, scout, wyscout, temporada] = await Promise.all([
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
      ]);

      const equipo = once.equipo;

      /* ---------- Ellos: su once con todo lo que se sabe por arriba ---------- */

      const eventos = abp.events.filter((e) => mismoClub(e.equipo, equipo) || mismoClub(e.equipo, rival));
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
            aereoPct: numero(wy?.datos["Duelos aéreos ganados, %"]),
            aereos90: numero(wy?.datos["Duelos aéreos en los 90"]),
            remates: (hoja?.remates ?? 0) + (delScout.get(norma(nombre)) ?? 0),
            remataAbp: hoja?.remataAbp ?? false,
          };
        });

      /* ---------- Nosotros: los de las marcas y, si faltan, nuestro once ---------- */

      const huecosMarca = puestosDeGrupo(slide, "marcas");
      const enMarca = new Map(slide.fichas.filter((f) => f.puesto && huecosMarca.some((p) => p.key === f.puesto)).map((f) => [f.playerId, f.puesto!]));
      const enOtroSitio = new Set(slide.fichas.filter((f) => f.puesto && !enMarca.has(f.playerId)).map((f) => f.playerId));

      const porId = new Map(players.map((p) => [p.id, p]));
      const { huecos } = huecosDelUltimoOnce(temporada, players, once.nuestroAMano);
      const delOnce = Object.values(huecos).filter((id) => id && porId.has(id) && !PORTERO.test(porId.get(id)!.posicion ?? ""));

      const aereo = new Map(
        nuestrosDe(
          wyscout,
          players.map((p) => ({ id: p.id, nombre: p.nombre, apodo: p.apodo, foto: p.foto, posicion: p.posicion })),
        )
          .filter((j) => j.fichaId)
          .map((j) => [j.fichaId!, j]),
      );

      const marcador = (playerId: string, puesto: string | null): Marcador => {
        const j = aereo.get(playerId);
        const p = porId.get(playerId);

        return {
          playerId,
          nombre: p?.apodo || p?.nombre || playerId,
          altura: j?.altura ?? null,
          aereoPct: numero(j?.wyscout?.datos["Duelos aéreos ganados, %"]),
          aereos90: numero(j?.wyscout?.datos["Duelos aéreos en los 90"]),
          puesto,
        };
      };

      const fijos = [...enMarca].map(([id, puesto]) => marcador(id, puesto));
      const libres = huecosMarca.filter((p) => ![...enMarca.values()].includes(p.key));
      const candidatos = delOnce.filter((id) => !enMarca.has(id) && !enOtroSitio.has(id)).map((id) => marcador(id, null));

      /* Los que faltan, nuestros mejores por alto del once. */
      const extra = [...candidatos].sort((a, b) => poderAereo(b) - poderAereo(a)).slice(0, libres.length);

      const pares = proponMarcas(atacantes, [...fijos, ...extra]);

      /* Puesto de cada marcador: el suyo, o los huecos libres por orden (M1 primero, para el mejor). */
      let i = 0;

      const conPuesto = pares.map((par) => ({ ...par, puesto: par.marcador.puesto ?? libres[i++]?.key ?? "" })).filter((par) => par.puesto);

      if (!conPuesto.length) {
        toast.info(`De ${equipo} no hay once ni plantilla para proponer marcas.`);

        return;
      }

      setPropuesta({ pares: conPuesto, fuente: `${once.fuente}. Remates: hojas de ABP y su scouting; alturas y duelos aéreos: plantilla y Wyscout.` });
    } catch (error) {
      console.error("[abp-pizarra] propuesta de marcas", error);
      toast.error("No se ha podido preparar la propuesta de marcas");
    } finally {
      setCargando(false);
    }
  };

  const aplica = () => {
    if (!propuesta) return;

    onAplicar({
      marcas: Object.fromEntries(propuesta.pares.filter((p) => p.atacante.dorsal).map((p) => [p.puesto, p.atacante.dorsal])),
      nuevos: propuesta.pares.filter((p) => !p.marcador.puesto).map((p) => ({ puesto: p.puesto, playerId: p.marcador.playerId })),
    });

    setPropuesta(null);
    toast.success("Marcas puestas: el dorsal va en la casilla de cada uno. Ctrl+Z lo deshace.");
  };

  const sigla = (puesto: string) => puestosDeGrupo(slide, "marcas").find((p) => p.key === puesto)?.sigla ?? "";

  return (
    <>
      <Button
        icon={Crosshair}
        onClick={() => void calcula()}
        disabled={cargando || !rival}
        title="Propone quién marca a quién: su once por remates de ABP, altura y duelos aéreos, contra nuestro once por alto"
      >
        {cargando ? "Cruzando onces…" : "Quién marca a quién"}
      </Button>

      {propuesta && (
        <Dialog
          title="Quién marca a quién"
          subtitle={`Su más peligroso por arriba, para nuestro mejor por alto. ${propuesta.fuente}`}
          onClose={() => setPropuesta(null)}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button onClick={() => setPropuesta(null)}>Cerrar</Button>
              <Button icon={Crosshair} onClick={aplica}>
                Poner en la pizarra
              </Button>
            </div>
          }
        >
          <ol className="space-y-2">
            {propuesta.pares.map((par) => (
              <li
                key={par.puesto}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="w-9 shrink-0 font-semibold text-[#D8B45A]">{sigla(par.puesto)}</span>
                <span className="min-w-0 font-medium text-white">
                  {par.marcador.nombre}
                  {!par.marcador.puesto && <span className="ml-1 text-[11px] text-white/40">(del once)</span>}
                </span>
                <span className="text-white/35">→</span>
                <span className="min-w-0 text-white">
                  {par.atacante.dorsal && <strong className="mr-1 text-[#F7B0B8]">{par.atacante.dorsal}</strong>}
                  {par.atacante.nombre}
                </span>
                {par.motivo && <span className="w-full pl-12 text-[11px] text-white/45">{par.motivo}</span>}
              </li>
            ))}
          </ol>
        </Dialog>
      )}
    </>
  );
}
