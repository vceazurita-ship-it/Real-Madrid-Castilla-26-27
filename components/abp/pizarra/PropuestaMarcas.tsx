"use client";

/**
 * «Quién marca a quién» del córner defensivo (27/10/2026).
 *
 * Lee su once, sus remates de ABP, la plantilla con alturas y Wyscout; lee
 * nuestro once (Valoraciones + lo cambiado en Duelos) y propone las marcas
 * (`lib/abp/marcas-corner.ts`). En la ventana, cada marca se puede cambiar —a
 * quién ponemos y a quién marca— o dejar en blanco, con la altura y los
 * aéreos de cada uno a la vista. La altura de los nuestros que Wyscout no trae
 * se escribe aquí y se guarda (`abp:alturas-nuestros`).
 *
 * Al aplicar, cada marca lleva el dorsal de su rival en la casilla de encima
 * de la cabeza y en el panel. Se deshace con Ctrl+Z.
 */

import { useState } from "react";
import { Crosshair, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog } from "@/components/abp/ui";
import {
  motivoAtacante,
  motivoMarcador,
  ordenaAtacantes,
  ordenaMarcadores,
  proponMarcas,
  type Atacante,
  type Emparejamiento,
  type Marcador,
} from "@/lib/abp/marcas-corner";
import { puestosDeGrupo, type SlidePizarra } from "@/lib/abp/pizarra";
import { buildAerialThreats, loadRivalAbp } from "@/lib/abp/rival";
import { SCOUT_DOC_KEY, actionsOf } from "@/lib/abp/rivalScout";
import { casaNombre, sitioDe } from "@/lib/data-analisis/once";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { nuestrosDe } from "@/lib/duelos-onces";
import { traeJson } from "@/lib/hojaCsv";
import type { RatingsSeason } from "@/lib/ratings/types";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { suOnceTeorico } from "@/lib/tactics/oncesSemana";
import { huecosDelUltimoOnce } from "@/lib/tactics/ultimoOnce";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import type { Player } from "@/types/player";

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

const norma = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Duelos aéreos que hay detrás del %: por noventa × minutos. */
const duelosDe = (fila: FilaJugador | null | undefined) => {
  const por90 = numero(fila?.datos["Duelos aéreos en los 90"]);

  return por90 && fila ? (por90 * fila.minutos) / 90 : null;
};

export type FilaMarca = {
  puesto: string;
  /** `null`: el hueco se queda vacío. */
  playerId: string | null;
  /** "" : la casilla del dorsal, en blanco. */
  dorsal: string;
};

type Datos = {
  plantel: Marcador[];
  atacantes: Atacante[];
  /** Lo que ya había en la diapositiva. */
  yaPuestos: Map<string, string>;
  ocupados: Set<string>;
  fuente: string;
};

export function PropuestaMarcas({
  slide,
  rival,
  players,
  onAplicar,
}: {
  slide: SlidePizarra;
  rival: string;
  players: Player[];
  onAplicar: (filas: FilaMarca[]) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [filas, setFilas] = useState<Emparejamiento[] | null>(null);

  /* Las alturas de los nuestros que Wyscout no trae, escritas aquí (cm por id). */
  const { value: alturas, setValue: setAlturas } = useRemoteDoc<Record<string, number>>({
    key: "abp:alturas-nuestros",
    kind: "abp",
    fallback: {},
  });

  const puestos = puestosDeGrupo(slide, "marcas");

  /* La altura escrita a mano manda sobre la de Wyscout. */
  const conAltura = (m: Marcador): Marcador => (alturas[m.playerId] ? { ...m, altura: alturas[m.playerId] } : m);

  const propone = (d: Datos) =>
    setFilas(
      proponMarcas({
        puestos: puestos.map((p) => p.key),
        yaPuestos: d.yaPuestos,
        ocupados: d.ocupados,
        plantel: d.plantel.map(conAltura),
        atacantes: d.atacantes,
      }),
    );

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
            duelos: duelosDe(wy),
            remates: (hoja?.remates ?? 0) + (delScout.get(norma(nombre)) ?? 0),
            remataAbp: hoja?.remataAbp ?? false,
          };
        });

      /* ---------- Nosotros: toda la plantilla, marcando los del once ---------- */

      const { huecos } = huecosDelUltimoOnce(temporada, players, once.nuestroAMano);
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

      const claves = new Set(puestos.map((p) => p.key));
      const yaPuestos = new Map(slide.fichas.filter((f) => f.puesto && claves.has(f.puesto)).map((f) => [f.puesto!, f.playerId]));
      const enMarca = new Set(yaPuestos.values());
      const ocupados = new Set(slide.fichas.filter((f) => f.puesto && !enMarca.has(f.playerId)).map((f) => f.playerId));

      if (!atacantes.length && !plantel.length) {
        toast.info(`De ${equipo} no hay once ni plantilla para proponer marcas.`);

        return;
      }

      const nuevos: Datos = {
        plantel,
        atacantes,
        yaPuestos,
        ocupados,
        fuente: `${once.fuente}. Ellos: remates de ABP (hojas y scouting), altura y aéreos de Wyscout. Nosotros: puesto, altura y aéreos de Wyscout (el % pesa según los duelos que tiene detrás).`,
      };

      setDatos(nuevos);
      propone(nuevos);
    } catch (error) {
      console.error("[abp-pizarra] propuesta de marcas", error);
      toast.error("No se ha podido preparar la propuesta de marcas");
    } finally {
      setCargando(false);
    }
  };

  const cierra = () => {
    setFilas(null);
    setDatos(null);
  };

  const aplica = () => {
    if (!filas) return;

    onAplicar(filas.map((fila) => ({ puesto: fila.puesto, playerId: fila.marcador?.playerId ?? null, dorsal: fila.atacante?.dorsal ?? "" })));
    cierra();
    toast.success("Marcas puestas: el dorsal va en la casilla de cada uno. Ctrl+Z lo deshace.");
  };

  const cambiaFila = (puesto: string, cambio: Partial<Emparejamiento>) =>
    setFilas((antes) => antes?.map((fila) => (fila.puesto === puesto ? { ...fila, ...cambio } : fila)) ?? null);

  const guardaAltura = (playerId: string, texto: string) => {
    const cm = Math.round(Number(texto.replace(",", ".")) * (Number(texto.replace(",", ".")) < 3 ? 100 : 1));

    setAlturas((antes) => {
      const resto = { ...antes };

      if (cm >= 150 && cm <= 215) resto[playerId] = cm;
      else delete resto[playerId];

      return resto;
    });

    /* Que la fila enseñe ya la altura nueva. */
    setFilas(
      (antes) =>
        antes?.map((fila) =>
          fila.marcador?.playerId === playerId ? { ...fila, marcador: { ...fila.marcador, altura: cm >= 150 && cm <= 215 ? cm : null } } : fila,
        ) ?? null,
    );
  };

  const sigla = (puesto: string) => puestos.find((p) => p.key === puesto)?.sigla ?? "";

  const plantel = datos ? ordenaMarcadores(datos.plantel.map(conAltura)) : [];
  const atacantes = datos ? ordenaAtacantes(datos.atacantes) : [];
  const selector =
    "min-w-0 max-w-full rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1.5 text-sm text-white outline-none focus:border-[#C8A96B]/60";

  return (
    <>
      <Button
        icon={Crosshair}
        onClick={() => void calcula()}
        disabled={cargando || !rival}
        title="Propone quién marca a quién: su once por remates de ABP, altura y aéreos, contra los nuestros por puesto, altura y aéreos"
      >
        {cargando ? "Cruzando onces…" : "Quién marca a quién"}
      </Button>

      {filas && datos && (
        <Dialog
          title="Quién marca a quién"
          subtitle={`Su más peligroso por arriba, para nuestro mejor defendiendo el área. Cambia lo que quieras o deja una marca en blanco. ${datos.fuente}`}
          onClose={cierra}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button icon={RefreshCw} onClick={() => propone(datos)} title="Vuelve a proponer con las alturas escritas">
                Volver a proponer
              </Button>
              <Button onClick={cierra}>Cerrar</Button>
              <Button icon={Crosshair} onClick={aplica}>
                Poner en la pizarra
              </Button>
            </div>
          }
        >
          <ol className="space-y-2">
            {filas.map((fila) => (
              <li key={fila.puesto} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-9 shrink-0 font-semibold text-[#D8B45A]">{sigla(fila.puesto)}</span>

                  <select
                    aria-label={`Quién va en ${sigla(fila.puesto)}`}
                    value={fila.marcador?.playerId ?? ""}
                    onChange={(e) => cambiaFila(fila.puesto, { marcador: plantel.find((m) => m.playerId === e.target.value) ?? null })}
                    className={`${selector} flex-1`}
                  >
                    <option value="" className="bg-[#11161C]">— En blanco —</option>
                    {plantel.map((m) => (
                      <option key={m.playerId} value={m.playerId} className="bg-[#11161C]">
                        {m.nombre}
                        {m.titular ? " · once" : ""}
                      </option>
                    ))}
                  </select>

                  <span className="text-white/35">→</span>

                  <select
                    aria-label={`A quién marca ${sigla(fila.puesto)}`}
                    value={fila.atacante?.clave ?? ""}
                    onChange={(e) => cambiaFila(fila.puesto, { atacante: atacantes.find((a) => a.clave === e.target.value) ?? null })}
                    className={`${selector} flex-1`}
                  >
                    <option value="" className="bg-[#11161C]">— En blanco —</option>
                    {atacantes.map((a) => (
                      <option key={a.clave} value={a.clave} className="bg-[#11161C]">
                        {a.dorsal ? `${a.dorsal} · ` : ""}
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-1.5 grid gap-1 pl-11 text-[11px] text-white/50 sm:grid-cols-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {fila.marcador && (
                      <>
                        {motivoMarcador(fila.marcador)}
                        {!fila.marcador.altura && (
                          <input
                            key={fila.marcador.playerId}
                            inputMode="decimal"
                            placeholder="Altura (1,85)"
                            aria-label={`Altura de ${fila.marcador.nombre}`}
                            onBlur={(e) => e.target.value.trim() && guardaAltura(fila.marcador!.playerId, e.target.value.trim())}
                            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                            className="w-24 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[11px] text-white placeholder:text-white/30"
                          />
                        )}
                      </>
                    )}
                  </span>
                  <span>{fila.atacante ? motivoAtacante(fila.atacante) : ""}</span>
                </div>
              </li>
            ))}
          </ol>
        </Dialog>
      )}
    </>
  );
}
