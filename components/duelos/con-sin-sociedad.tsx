"use client";

/**
 * CON SU TRÍO Y SIN ÉL (23/11/2026, idea de X). Junto al once del rival, un
 * interruptor «Con / sin su sociedad»: goles, xG a favor y xG en contra por
 * 90′ del rival en los minutos en que coinciden sus tres jugadores más
 * conectados del último tercio, frente a los minutos en que falta alguno.
 *
 * Datos: `opta:directo:archivo` y `opta:directo:<partido>` de sus últimos
 * partidos, por `useDocsOpta` (los mismos documentos que «Segunda jugada»,
 * misma caché). El trío, de `lib/rivals/sociedades.ts`; los minutos y las
 * cuentas, de `lib/duelos-con-sin-sociedad.ts`. Sin dato no se pinta.
 */

import { useMemo, useState } from "react";

import { cortoDeOpta } from "@/components/duelos/segunda-jugada";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import { MAX_PARTIDOS, sociedades } from "@/lib/rivals/sociedades";
import { conSinSociedad, MIN_MINUTOS, por90, type Tramo } from "@/lib/duelos-con-sin-sociedad";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { eventos?: TablaOpta; jugadores?: TablaOpta };

const ORO = "#C8A96B";
const dec = (v: number | null, n = 2) => (v == null ? "—" : v.toFixed(n).replace(".", ","));
const firma = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${dec(Math.abs(v))}`;

export function ConSinSociedad({ equipo, suyos = [] }: { equipo: string; suyos?: string[] }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && equipo && <Indice equipo={equipo} suyos={suyos} />}</div>;
}

function Indice({ equipo, suyos }: { equipo: string; suyos: string[] }) {
  const { docs } = useDocsOpta<[TablaOpta, Archivo]>(DOCS_OPTA.equipos, "opta:directo:archivo");
  const [tEquipos, archivo] = docs;

  const rival = useMemo(() => {
    if (!tEquipos) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = casaEquipo(equipo, equipos);
    if (!id || id === CASTILLA_OPTA) return null;
    return { id, nombre: equipos.find((e) => e.teamId === id)?.equipo || equipo };
  }, [tEquipos, equipo]);

  const ids = useMemo(() => {
    if (!rival || !Array.isArray(archivo?.partidos)) return [];
    return archivo.partidos
      .filter((p) => p?.partido && (p.equipos ?? []).includes(rival.nombre))
      .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")))
      .slice(0, MAX_PARTIDOS)
      .map((p) => String(p.partido));
  }, [rival, archivo]);

  if (!rival || !ids.length) return null;
  return <Bloque teamId={rival.id} nombre={equipo} ids={ids} suyos={suyos} />;
}

function Bloque({ teamId, nombre, ids, suyos }: { teamId: string; nombre: string; ids: string[]; suyos: string[] }) {
  const { docs } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));
  const [ver, setVer] = useState<"con" | "sin">("con");

  const datos = useMemo(() => {
    const quien = new Map<string, string>();
    const partidos = docs
      .map((d, i) => {
        if (!d) return null;
        const jugadores = leeJugadores(d.jugadores);
        for (const j of jugadores) if (j.id && j.teamId === teamId) quien.set(j.id, j.nombre);
        return { partido: ids[i], eventos: leeEventos(d.eventos), jugadores };
      })
      .filter((p): p is NonNullable<typeof p> => p != null && p.eventos.length > 0);
    if (!partidos.length) return null;
    const s = sociedades(partidos, teamId);
    if (!s) return null;
    const r = conSinSociedad(partidos, teamId, s.grupo.slice(0, 3));
    return r ? { r, quien } : null;
  }, [docs, ids, teamId]);

  if (!datos) return null;
  const { r, quien } = datos;
  const nombreDe = (id: string) => cortoDeOpta(quien.get(id) || `Jugador ${id}`, suyos);
  const trio = r.trio.map(nombreDe);
  const trioTexto = `${trio.slice(0, -1).join(", ")} y ${trio[trio.length - 1]}`;

  const visto: Tramo = r[ver];
  const otro: Tramo = r[ver === "con" ? "sin" : "con"];
  const corta = visto.minutos < MIN_MINUTOS;
  const otraCorta = otro.minutos < MIN_MINUTOS;

  const filas = [
    { rotulo: "Goles a favor", v: por90(visto.goles, visto.minutos), o: por90(otro.goles, otro.minutos), base: `${visto.goles} en ${Math.round(visto.minutos)}′`, mejorSiSube: true },
    { rotulo: "xG a favor", v: por90(visto.xg, visto.minutos), o: por90(otro.xg, otro.minutos), base: `${dec(visto.xg, 1)} en ${Math.round(visto.minutos)}′`, mejorSiSube: true },
    { rotulo: "xG en contra", v: por90(visto.xgContra, visto.minutos), o: por90(otro.xgContra, otro.minutos), base: `${dec(visto.xgContra, 1)} en ${Math.round(visto.minutos)}′`, mejorSiSube: false },
  ];

  /* La lectura: siempre «con» frente a «sin», sea cual sea la pestaña. */
  const xgCon = por90(r.con.xg, r.con.minutos);
  const xgSin = por90(r.sin.xg, r.sin.minutos);
  const fiable = r.con.minutos >= MIN_MINUTOS && r.sin.minutos >= MIN_MINUTOS;
  const lectura =
    xgCon == null || xgSin == null
      ? r.sin.minutos <= 0
        ? `Los tres han coincidido todos los minutos de sus últimos ${r.partidos} partidos: no hay con qué comparar.`
        : `No han coincidido los tres en sus últimos ${r.partidos} partidos.`
      : `${fiable ? "" : "Muestra corta: pista, no hecho. "}Con los tres en el campo crea ${dec(xgCon)} xG por 90′; sin alguno, ${dec(xgSin)} (${firma(xgCon - xgSin)}). ${
          !fiable ? "" : xgCon - xgSin >= 0.3 ? "Pierde mucho sin ellos: cargar la marca sobre uno de los tres sirve." : xgCon - xgSin <= -0.3 ? "Sin alguno de ellos crea más: no depende de su sociedad." : "La diferencia es pequeña: su ataque no depende sólo de ellos."
        }`;

  return (
    <div id="x-idea-2124598849268322563-2" className="mt-6 min-w-0 scroll-mt-20 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Con su trío y sin él · {nombre}</p>
          <p className="mt-0.5 text-xs text-white/55">
            Su sociedad del último tercio: {trioTexto} · Opta, {r.partidos} {r.partidos === 1 ? "partido" : "partidos"} ({r.partidosJuntos} con los tres juntos)
          </p>
        </div>
        <div role="group" aria-label="Con o sin su sociedad" className="inline-flex shrink-0 rounded-full border border-white/15 p-0.5 text-xs font-semibold">
          {(["con", "sin"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={ver === k}
              onClick={() => setVer(k)}
              className={`rounded-full px-3 py-1 transition ${ver === k ? "bg-white/10" : "text-white/50 hover:text-white"}`}
              style={ver === k ? { color: ORO } : undefined}
            >
              {k === "con" ? "Con su sociedad" : "Sin su sociedad"}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-xs text-white/60">
        {ver === "con" ? "Minutos con los tres en el campo a la vez" : "Minutos en que falta alguno de los tres"}: {Math.round(visto.minutos)}′
        {corta && <span className="ml-2 rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/45">muestra corta</span>}
      </p>

      <ul className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
        {filas.map((f) => {
          const dif = f.v != null && f.o != null && !corta && !otraCorta ? f.v - f.o : null;
          const bueno = dif != null && (f.mejorSiSube ? dif > 0 : dif < 0);
          return (
            <li key={f.rotulo} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{f.rotulo} · por 90′</p>
              <p className={`mt-0.5 text-[26px] font-bold leading-none tabular-nums ${corta ? "text-white/35" : "text-white"}`} title={corta ? `Menos de ${MIN_MINUTOS}′: muestra corta` : undefined}>
                {dec(f.v)}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-white/55">
                {f.base}
                {dif != null && Math.abs(dif) >= 0.005 && (
                  <>
                    {" · "}
                    <span className={bueno ? "text-white/80" : "text-white/55"}>
                      {firma(dif)} frente a {ver === "con" ? "sin" : "con"} ellos (para {nombre}, {bueno ? "mejor" : "peor"})
                    </span>
                  </>
                )}
                {dif == null && f.o != null && <> · {ver === "con" ? "sin" : "con"} ellos: {dec(f.o)}{otraCorta ? " (muestra corta)" : ""}</>}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-sm leading-6 text-white/75">{lectura}</p>
      <p className="mt-1 text-[11px] leading-5 text-white/50">
        El trío: los tres que más pases se dan entre sí en el último tercio (como en Scout colectivo, «Sus sociedades»). Minutos de las alineaciones y los cambios de Opta: titular desde
        el 0 o desde que entra; hasta que sale o el final. Goles y xG, por el minuto del remate, del rival (a favor) y de su contrario (en contra), por 90′. Con menos de {MIN_MINUTOS}′ en un
        lado, la cifra va en gris: muestra corta.
      </p>
    </div>
  );
}
