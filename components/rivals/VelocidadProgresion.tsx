"use client";

/**
 * VELOCIDAD DE PROGRESIÓN DEL RIVAL (Scout colectivo, 27/11/2026, idea de X).
 * Metros hacia portería por segundo en las posesiones que llegan a nuestro
 * último tercio, frente a la media de su liga y partido por origen (robo,
 * salida de portero, saque); al lado, el % de esas posesiones que acaban en
 * remate.
 *
 * Datos: los mismos `opta:directo:<partido>` que «El rival por tercios»
 * (misma caché de `useDocsOpta`). Cuentas en
 * `lib/rivals/velocidad-progresion.ts`. Sin dato no se pinta; nada se pide
 * hasta que asoma.
 */

import { useMemo } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import {
  comparaVelocidad,
  CORTE_POSESION_S,
  MAX_PARTIDOS,
  MIN_POSESIONES,
  perfilVelocidad,
  type FilaComparada,
  type PerfilVelocidad,
  type VelocidadProgresion as Datos,
} from "@/lib/rivals/velocidad-progresion";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { eventos?: TablaOpta; jugadores?: TablaOpta };

const dec = (v: number, n = 1) => v.toFixed(n).replace(".", ",");
const pct = (v: number) => `${Math.round(v * 100)} %`;

const ROTULO: Record<FilaComparada["origen"], string> = {
  total: "Todas",
  robo: "Tras robo",
  portero: "Salida de portero",
  saque: "Tras saque (banda, falta, centro)",
};

export function VelocidadProgresion({ equipo }: { equipo: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(1500);
  return (
    <div ref={caja} className={`min-w-0 ${abierto ? "" : "min-h-24"}`}>
      {abierto && equipo && <Indice equipo={equipo} />}
    </div>
  );
}

/** Su liga y los últimos partidos de cada equipo (como «El rival por tercios»). */
function Indice({ equipo }: { equipo: string }) {
  const { docs } = useDocsOpta<[TablaOpta, Archivo]>(DOCS_OPTA.equipos, "opta:directo:archivo");
  const [tEquipos, archivo] = docs;

  const plan = useMemo(() => {
    if (!tEquipos || !Array.isArray(archivo?.partidos)) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const rivalId = casaEquipo(equipo, equipos);
    if (!rivalId || rivalId === CASTILLA_OPTA) return null;
    const nombreRival = equipos.find((e) => e.teamId === rivalId)?.equipo || "";
    const partidos = archivo.partidos.filter((p) => p?.partido && (p.equipos ?? []).length >= 2);

    const liga = new Set([nombreRival]);
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      for (const p of partidos) {
        const [a, b] = p.equipos ?? [];
        if (liga.has(a) || liga.has(b)) {
          liga.add(a);
          liga.add(b);
        }
      }
    }
    const idDe = new Map(equipos.map((e) => [e.equipo, e.teamId]));
    const ids = new Set<string>();
    const miembros: string[] = [];
    const suyos = new Map<string, string[]>();
    for (const nombre of liga) {
      const teamId = idDe.get(nombre);
      if (!teamId) continue;
      miembros.push(teamId);
      const ultimos = partidos
        .filter((p) => (p.equipos ?? []).includes(nombre))
        .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")))
        .slice(0, MAX_PARTIDOS)
        .map((p) => String(p.partido));
      suyos.set(teamId, ultimos);
      ultimos.forEach((id) => ids.add(id));
    }
    if (miembros.length < 4 || !ids.size) return null;
    return { rivalId, nombreRival, miembros, suyos, ids: [...ids] };
  }, [tEquipos, archivo, equipo]);

  if (!plan) return null;
  return <Bloque {...plan} />;
}

function Bloque({
  rivalId,
  nombreRival,
  miembros,
  suyos,
  ids,
}: {
  rivalId: string;
  nombreRival: string;
  miembros: string[];
  suyos: Map<string, string[]>;
  ids: string[];
}) {
  const { docs, cargando } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));

  const datos = useMemo<Datos | null>(() => {
    const porId = new Map<string, { eventos: ReturnType<typeof leeEventos>; jugadores: ReturnType<typeof leeJugadores> }>();
    docs.forEach((d, i) => {
      const eventos = d ? leeEventos(d.eventos) : [];
      if (eventos.length) porId.set(ids[i], { eventos, jugadores: leeJugadores(d?.jugadores) });
    });
    if (!porId.size) return null;
    const de = (teamId: string) => (suyos.get(teamId) ?? []).map((id) => porId.get(id)).filter((p): p is NonNullable<typeof p> => p != null);
    let rival: PerfilVelocidad | null = null;
    const otros: PerfilVelocidad[] = [];
    for (const teamId of miembros) {
      const r = perfilVelocidad(de(teamId), teamId);
      if (!r) continue;
      if (teamId === rivalId) rival = r;
      else otros.push(r);
    }
    return rival ? comparaVelocidad(rival, otros) : null;
  }, [docs, ids, miembros, suyos, rivalId]);

  const cabecera = (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
      Velocidad de progresión · metros hacia portería por segundo
      {datos && (
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, sus últimos {datos.partidos} partidos y {datos.equipos} equipos de su liga
        </span>
      )}
    </p>
  );

  if (!datos) {
    if (!cargando) return null;
    return (
      <section aria-label="Velocidad de progresión" className="portada-tarjeta mt-8 min-w-0 px-4 py-4 sm:px-5">
        {cabecera}
        <p className="mt-1 text-sm text-white/60">Leyendo el evento a evento de {ids.length} partidos de la liga…</p>
      </section>
    );
  }

  const [total, ...porOrigen] = datos.filas;
  const fiables = porOrigen.filter((f) => f.n >= MIN_POSESIONES && f.velocidad != null && f.ligaVelocidad != null);
  const masRapido = [...fiables].sort((a, b) => (b.velocidad! - b.ligaVelocidad!) - (a.velocidad! - a.ligaVelocidad!))[0];
  const masPeligro = [...porOrigen].filter((f) => f.n >= MIN_POSESIONES && f.remate != null).sort((a, b) => b.remate! - a.remate!)[0];

  const remRival = total.remate ?? 0;
  const remLiga = total.ligaRemate ?? 0;
  const eficaz = remRival - remLiga >= 0.04 ? "y remata más que la liga" : remRival - remLiga <= -0.04 ? "pero remata menos que la liga" : "y remata como la liga";
  const titular =
    datos.ritmo === "rapido"
      ? `Llega rápido al último tercio ${eficaz}`
      : datos.ritmo === "lento"
        ? `Llega despacio, con muchos pases, ${eficaz}`
        : `Llega al ritmo de la liga ${eficaz}`;
  const consejo =
    datos.ritmo === "rapido"
      ? `Hay que temporizar en cuanto perdamos el balón: ${masRapido ? `${ROTULO[masRapido.origen].toLowerCase()} es cuando más acelera` : "acelera desde el primer toque"}; si no se llega a cerrar, la falta táctica en campo contrario corta la carrera.`
      : datos.ritmo === "lento"
        ? "Da tiempo a replegar: más que la falta táctica, conviene cerrar dentro y esperar el error en la circulación."
        : masPeligro
          ? `Donde más remata es ${ROTULO[masPeligro.origen].toLowerCase()} (${pct(masPeligro.remate!)} de las que llegan acaban en remate).`
          : "";

  const escala = Math.max(1, ...datos.filas.flatMap((f) => [f.velocidad ?? 0, f.ligaVelocidad ?? 0])) * 1.1;

  return (
    <section
      id="x-idea-2126377741310386250-1"
      aria-label="Velocidad de progresión"
      className="portada-tarjeta portada-entra mt-8 min-w-0 scroll-mt-20 px-4 py-4 sm:px-5"
    >
      {cabecera}
      <h3 className="fuente-club mt-1.5 text-[22px] font-bold uppercase leading-[1.05] text-white sm:text-[28px]">{titular}</h3>
      <p className="mt-1 text-sm leading-6 text-white/70">
        {nombreRival || "El rival"}: en las posesiones que llegan a nuestro último tercio ({dec(total.porPartido)} por partido) gana{" "}
        {total.velocidad != null ? `${dec(total.velocidad, 2)} m/s` : "—"} hacia portería; la media de su liga es{" "}
        {total.ligaVelocidad != null ? `${dec(total.ligaVelocidad, 2)} m/s` : "—"}. De esas, el {pct(remRival)} acaban en remate (liga {pct(remLiga)}).
      </p>
      {consejo && <p className="mt-1 text-sm font-semibold leading-6 text-white/85">{consejo}</p>}

      <ul className="mt-3 grid min-w-0 gap-2">
        {datos.filas.map((f) => (
          <Fila key={f.origen} f={f} escala={escala} />
        ))}
      </ul>

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/60" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full" style={{ background: ORO }} />
          {nombreRival || "Rival"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5" style={{ background: COMPARADO }} />
          media de su liga
        </span>
      </p>

      <p className="mt-2 text-[11px] leading-5 text-white/55">
        Posesión: toques seguidos del rival en la misma parte, hasta que el contrario se queda el balón o pasan {CORTE_POSESION_S} s. Sólo las que empiezan fuera de nuestro
        último tercio y entran en él (un toque suyo en los últimos 35 m o un pase acertado que acaba ahí). Velocidad: metros ganados hacia portería desde el primer toque hasta la
        entrada, entre los segundos que pasan (al menos 1 s), sumados en todas las posesiones. Origen, por su primer toque: salida de portero (su portero o un saque de puerta),
        saque (de banda, de centro o una falta a su favor) y robo (el resto, balón ganado en juego). Remate: hay un remate suyo en esa posesión. Liga: la media de los demás
        equipos de su liga, sin él, con sus últimos {MAX_PARTIDOS} partidos. Con menos de {MIN_POSESIONES} posesiones, «pocas».
      </p>
    </section>
  );
}

function Fila({ f, escala }: { f: FilaComparada; escala: number }) {
  const ancho = (v: number | null) => `${Math.max(0, Math.min(100, ((v ?? 0) / escala) * 100))}%`;
  const pocas = f.origen !== "total" && f.n < MIN_POSESIONES;
  const difRemate = f.remate != null && f.ligaRemate != null ? f.remate - f.ligaRemate : null;
  return (
    <li
      className={`portada-celda grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)_7.5rem] ${f.origen === "total" ? "border-[#C8A96B]/40" : ""}`}
      aria-label={`${ROTULO[f.origen]}: ${f.velocidad != null ? dec(f.velocidad, 2) : "—"} metros por segundo (liga ${f.ligaVelocidad != null ? dec(f.ligaVelocidad, 2) : "—"}); ${f.remate != null ? pct(f.remate) : "—"} acaban en remate`}
    >
      <div className="min-w-0">
        <p className={`text-[12px] font-bold uppercase tracking-[0.1em] ${f.origen === "total" ? "text-[#C8A96B]" : "text-white/80"}`}>{ROTULO[f.origen]}</p>
        <p className="text-[11px] tabular-nums text-white/55">
          {f.n} posesiones · {dec(f.porPartido)} por partido
          {f.ligaPorPartido != null ? ` (liga ${dec(f.ligaPorPartido)})` : ""}
          {pocas && <span className="ml-1 rounded-full border border-amber-400/40 px-1.5 text-amber-300">pocas</span>}
        </p>
      </div>

      <div className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
        <div className="relative h-4 rounded-full" style={{ background: tinta(0.08) }}>
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: ancho(f.velocidad), background: ORO, opacity: pocas ? 0.55 : 1 }} />
          {f.ligaVelocidad != null && (
            <span className="absolute -inset-y-1 w-0.5" style={{ left: ancho(f.ligaVelocidad), background: COMPARADO }} title={`media de la liga ${dec(f.ligaVelocidad, 2)} m/s`} />
          )}
        </div>
        <p className="mt-0.5 text-[11px] tabular-nums text-white/60">
          <b className="text-white">{f.velocidad != null ? `${dec(f.velocidad, 2)} m/s` : "—"}</b>
          {f.ligaVelocidad != null && ` · liga ${dec(f.ligaVelocidad, 2)} m/s`}
        </p>
      </div>

      <div className="text-right">
        <p className="fuente-club text-[24px] font-bold leading-none tabular-nums text-white">{f.remate != null ? pct(f.remate) : "—"}</p>
        <p className="text-[10px] leading-4 text-white/55">
          acaban en remate
          {f.ligaRemate != null && (
            <>
              <br />
              liga {pct(f.ligaRemate)}
              {difRemate != null && Math.abs(difRemate) >= 0.04 && (
                <span className={difRemate > 0 ? "text-amber-300" : "text-emerald-300"}> ({difRemate > 0 ? "+" : "−"}{Math.round(Math.abs(difRemate) * 100)})</span>
              )}
            </>
          )}
        </p>
      </div>
    </li>
  );
}
