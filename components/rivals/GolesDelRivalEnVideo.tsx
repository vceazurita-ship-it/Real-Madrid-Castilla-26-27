"use client";

/**
 * GOLES DEL RIVAL EN VÍDEO (16/11/2026, petición del analista: «los goles del
 * rival en vídeo… accesible desde la home o desde el scout rival»).
 *
 * Los goles que marca un equipo de la categoría y los que encaja (= cómo
 * hacerle daño), de seguido o uno a uno, con dos filtros: en jugada o a balón
 * parado (la situación del remate en Opta) y los últimos 3 o 5 partidos.
 *
 * El reproductor es `GolesDeSeguido` de /analisis-goles, sin tocar sus fuentes:
 * primero el corte de Opta (`opta:goles-video`), si no, el resumen de la RFEF
 * con el segundo de Gemini. Los goles salen de `opta:remates` con la pista de
 * equipo de `opta:jugadores-partidos` (como los Revulsivos de la ficha del
 * rival) y el equipo se casa por nombre con `casaEquipo`.
 *
 * Lo usan la portada (modal desde la tarjeta del próximo rival), Plantillas
 * rivales y Scout colectivo. Si el equipo no tiene goles en Opta, no sale.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { GolesDeSeguido } from "@/app/opta/_piezas/GolesDeSeguido";
import { Botonera } from "@/app/opta/_piezas/comun";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo, pistaDe, rematesDe, type Remate } from "@/lib/opta-eventos";
import { urlGolesDelEquipo, type LadoGoles } from "@/lib/rivals/goles-en-video";

export type { LadoGoles };
export type Tipo = "todos" | "jugada" | "abp";
/** Con `partido`, además «los dos»: todos los goles de ese partido. */
type LadoVisto = LadoGoles | "ambos";
type Ultimos = "todos" | "3" | "5";

/** Situaciones de Opta que son juego (el resto —córner, faltas, banda, penalti— es balón parado). */
const EN_JUGADA = new Set(["Open play", "Fastbreak/Counter"]);
const tipoDe = (r: Remate): Exclude<Tipo, "todos"> => (EN_JUGADA.has(r.situacion) ? "jugada" : "abp");

/** Como sección de una pantalla: se pide a Opta al asomar (o a los 2,5 s). */
export function SeccionGolesDelRival({ equipo }: { equipo: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>();

  return (
    <div ref={caja} className="min-w-0">
      {abierto && <GolesDelRivalEnVideo key={equipo} equipo={equipo} enMarco />}
    </div>
  );
}

export function GolesDelRivalEnVideo({
  equipo,
  ladoInicial = "favor",
  tipoInicial = "todos",
  enMarco = false,
  partido: partidoPedido,
  fecha,
  alVacio,
}: {
  equipo: string;
  /** Id de Opta de un partido (18/11/2026, Análisis de datos → «El partido»): sólo sus goles, los de los dos equipos. */
  partido?: string;
  /** O el día (AAAA-MM-DD) de ese partido contra este equipo, si no se sabe su id de Opta: el suyo más cercano, a 4 días como mucho. */
  fecha?: string;
  ladoInicial?: LadoGoles;
  /** «abp»: abre con el filtro de balón parado puesto (desde ABP del rival, 16/11/2026). */
  tipoInicial?: Tipo;
  /** Con su caja y su título (en una pantalla); sin ellos, para un modal que ya los pone. */
  enMarco?: boolean;
  /** Cuando ya se sabe que no hay goles que enseñar (el modal se cierra). */
  alVacio?: () => void;
}) {
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.equipos, DOCS_OPTA.jugadoresPartidos, DOCS_OPTA.remates);
  const [tEquipos, tJugPartidos, tRemates] = docs;
  const dePartido = Boolean(partidoPedido || fecha);
  const [lado, setLado] = useState<LadoVisto>(dePartido ? "ambos" : ladoInicial);
  const [tipoPedido, setTipo] = useState<Tipo>(tipoInicial);
  const [ultimos, setUltimos] = useState<Ultimos>("todos");

  const base = useMemo(() => {
    /* Hasta que lleguen los tres: `rematesDe` guarda la primera cuenta y, sin la pista, atribuiría mal los remates. */
    if (!tEquipos || !tJugPartidos || !tRemates || cargando) return null;

    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = casaEquipo(equipo, equipos);

    if (!id || id === CASTILLA_OPTA) return { id: "", nombre: equipo, remates: [] as Remate[], partidos: [] as string[] };

    const todos = rematesDe(tRemates, pistaDe(aObjetos(tJugPartidos))).filter((r) => r.teamId === id || r.rivalId === id);
    /* Con el día y sin el id: el partido suyo más cercano a ese día (≤ 4 días, como lib/post-partido.ts). */
    let partido = partidoPedido ?? "";

    if (!partido && fecha) {
      const dia = Date.parse(`${fecha.slice(0, 10)}T12:00:00Z`);
      let mejor = Infinity;

      for (const r of todos) {
        const d = Math.abs(Date.parse(`${r.fecha.slice(0, 10)}T12:00:00Z`) - dia);

        if (d < mejor) {
          mejor = d;
          partido = r.partido;
        }
      }

      if (!(mejor <= 4 * 86_400_000)) partido = "ninguno"; /* ninguno de sus partidos cae cerca: no hay goles que enseñar */
    }

    const remates = partido ? todos.filter((r) => r.partido === partido) : todos;
    /* Sus partidos, del más reciente al más antiguo (por los remates de los dos lados: un 0-0 también cuenta). */
    const fechaDe = new Map<string, string>();

    for (const r of remates) if (!fechaDe.has(r.partido) || r.fecha > (fechaDe.get(r.partido) ?? "")) fechaDe.set(r.partido, r.fecha);

    const partidos = [...fechaDe.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([p]) => p);

    return { id, nombre: equipos.find((e) => e.teamId === id)?.equipo || equipo, remates, partidos };
  }, [tEquipos, tJugPartidos, tRemates, cargando, equipo, partidoPedido, fecha]);

  const golesDe = useMemo(() => {
    if (!base?.id) return { favor: [] as Remate[], contra: [] as Remate[], ambos: [] as Remate[] };

    const recientes = ultimos === "todos" ? null : new Set(base.partidos.slice(0, Number(ultimos)));
    const goles = base.remates.filter((r) => r.gol && (!recientes || recientes.has(r.partido)));

    return {
      favor: goles.filter((r) => r.teamId === base.id),
      contra: goles.filter((r) => r.rivalId === base.id),
      /* Los del partido, en el orden en que llegaron. */
      ambos: [...goles].sort((a, b) => a.minuto - b.minuto),
    };
  }, [base, ultimos]);

  const delLado = golesDe[lado];
  const enJugada = delLado.filter((r) => tipoDe(r) === "jugada").length;
  const aBalonParado = delLado.length - enJugada;
  /* Un filtro que se quedaría vacío (pedido «a balón parado» y no hay ninguno) no se aplica: se ven todos. */
  const tipo: Tipo = (tipoPedido === "abp" && aBalonParado === 0) || (tipoPedido === "jugada" && enJugada === 0) ? "todos" : tipoPedido;
  /* Memorizado: una lista nueva en cada pintado rehacía las tomas y volvía a cargar el corte que se estaba viendo. */
  const goles = useMemo(() => (tipo === "todos" ? delLado : delLado.filter((r) => tipoDe(r) === tipo)), [delLado, tipo]);

  const vacio = !!base && !base.remates.some((r) => r.gol);

  useEffect(() => {
    if (vacio) alVacio?.();
  }, [vacio, alVacio]);

  if (!base) {
    return enMarco ? null : <div className="h-40 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los goles de Opta" />;
  }

  if (vacio) return null;

  const nombre = base.nombre;
  const nPartidos = base.partidos.length;
  const textoUltimos = dePartido ? "en este partido" : ultimos === "todos" ? `en ${nPartidos} partidos` : `en sus últimos ${Math.min(Number(ultimos), nPartidos)} partidos`;
  const quien = lado === "ambos" ? "Goles" : lado === "favor" ? `Goles de ${nombre}` : dePartido ? `Goles contra ${nombre}` : `Goles que encaja ${nombre}`;
  const tituloTipo = tipo === "jugada" ? " en jugada" : tipo === "abp" ? " a balón parado" : "";

  const cuerpo = (
    <div className="min-w-0">
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
        <Botonera
          etiqueta="Los que marca o los que encaja"
          valor={lado}
          alCambiar={(v) => (setLado(v), setTipo("todos"))}
          opciones={
            dePartido
              ? [
                  { clave: "ambos" as const, nombre: `Los dos (${golesDe.ambos.length})` },
                  { clave: "favor" as const, nombre: `De ${nombre} (${golesDe.favor.length})` },
                  { clave: "contra" as const, nombre: `Contra ${nombre} (${golesDe.contra.length})` },
                ]
              : [
                  { clave: "favor" as const, nombre: `Sus goles (${golesDe.favor.length})` },
                  { clave: "contra" as const, nombre: `Los que encaja (${golesDe.contra.length})` },
                ]
          }
        />
        {enJugada > 0 && aBalonParado > 0 && (
          <Botonera
            etiqueta="En jugada o a balón parado"
            valor={tipo}
            alCambiar={setTipo}
            opciones={[
              { clave: "todos", nombre: "Todos" },
              { clave: "jugada", nombre: `En jugada (${enJugada})` },
              { clave: "abp", nombre: `A balón parado (${aBalonParado})` },
            ]}
          />
        )}
        {!dePartido && nPartidos > 3 && (
          <Botonera
            etiqueta="Qué partidos"
            valor={ultimos}
            alCambiar={setUltimos}
            opciones={[
              { clave: "todos", nombre: "Temporada" },
              { clave: "3", nombre: "Últimos 3" },
              ...(nPartidos > 5 ? [{ clave: "5" as const, nombre: "Últimos 5" }] : []),
            ]}
          />
        )}
      </div>

      {goles.length > 0 ? (
        <GolesDeSeguido key={`${base.id}-${lado}-${tipo}-${ultimos}`} goles={goles} titulo={`${quien}${tituloTipo} ${textoUltimos}`} conLista />
      ) : (
        <p className="text-[13px] text-white/60">
          {lado === "ambos" ? "No hubo goles" : lado === "favor" ? `${nombre} no ha marcado` : `A ${nombre} no le han marcado`}
          {tituloTipo} {textoUltimos}.
        </p>
      )}

      {/* En el pop-up, la ida a Análisis de goles va en su cabecera (components/rivals/BotonGolesEnVideo.tsx). */}
      {enMarco && (
        <p className="mt-3 text-[12px] text-white/55">
          <Link href={urlGolesDelEquipo(nombre, lado === "contra" ? "contra" : "favor")} className="font-semibold text-[#C8A96B] underline-offset-2 hover:underline">
            Cómo son sus goles, en el campo ›
          </Link>
        </p>
      )}
    </div>
  );

  if (!enMarco) return cuerpo;

  return (
    <section aria-label="Goles en vídeo" data-export-hide className="my-6 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
      <p className="mb-1 flex flex-wrap items-baseline gap-x-2 text-base font-bold text-white">
        Sus goles en vídeo
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">vídeo · Opta y RFEF, esta temporada</span>
      </p>
      <p className="mb-3 text-[12.5px] text-white/60">
        Lo que marca y lo que le marcan, gol a gol: los que encaja dicen por dónde hacerle daño.
      </p>
      {cuerpo}
    </section>
  );
}
