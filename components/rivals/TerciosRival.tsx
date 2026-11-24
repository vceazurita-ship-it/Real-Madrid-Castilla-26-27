"use client";

/**
 * EL RIVAL POR TERCIOS (Scout colectivo, 23/11/2026, idea de X). Una franja
 * partida en tres, de su portería a la nuestra: ZONA BAJA (protección),
 * ZONA MEDIA (control) y ZONA ALTA (amenaza). En cada bloque, su percentil
 * contra los equipos de su liga y la diferencia con la mediana; el fondo se
 * oscurece de 0 a 100. A la izquierda, termómetro de la altura defensiva; a
 * la derecha, el de la media de las tres zonas. Al pasar el ratón (o tocar)
 * un bloque se ven sus métricas.
 *
 * Datos: los mismos `opta:directo:<partido>` que «Primera parte contra
 * segunda» (misma caché de `useDocsOpta`). Cuentas en
 * `lib/rivals/tercios-rival.ts`. Sin dato no se pinta; nada se pide hasta que
 * asoma.
 */

import { useMemo } from "react";

import { ORO, tinta } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos } from "@/lib/opta-directo-mapas";
import { MAX_PARTIDOS, perfilTercios, tercios, type NotaZona, type PerfilTercios, type Tercios } from "@/lib/rivals/tercios-rival";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { eventos?: TablaOpta };

const dec = (v: number, n = 1) => v.toFixed(n).replace(".", ",");
const conSigno = (v: number) => `${v > 0.05 ? "+" : v < -0.05 ? "−" : "±"}${dec(Math.abs(v))}`;

/** Un solo tono (el oro de la casa) que se oscurece de 0 a 100. */
const fondo = (p: number) => `color-mix(in srgb, ${ORO} ${Math.round(6 + (Math.max(0, Math.min(100, p)) / 100) * 54)}%, transparent)`;

/** Dónde se abre el recuadro, para que no se salga por los lados en el móvil. */
const ANCLA: Record<NotaZona["zona"], string> = { baja: "left-0", media: "left-1/2 -translate-x-1/2", alta: "right-0" };

const ROTULO: Record<NotaZona["zona"], { titulo: string; que: string }> = {
  baja: { titulo: "Zona baja", que: "protección" },
  media: { titulo: "Zona media", que: "control" },
  alta: { titulo: "Zona alta", que: "amenaza" },
};

export function TerciosRival({ equipo }: { equipo: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(1500);
  return (
    <div ref={caja} id="x-idea-2124158021605466121-1" className={`min-w-0 scroll-mt-20 ${abierto ? "" : "min-h-24"}`}>
      {abierto && equipo && <Indice equipo={equipo} />}
    </div>
  );
}

/** Su liga y los últimos partidos de cada equipo (como «Primera parte contra segunda»). */
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

  const datos = useMemo<Tercios | null>(() => {
    const porId = new Map<string, { eventos: ReturnType<typeof leeEventos> }>();
    docs.forEach((d, i) => {
      const eventos = d ? leeEventos(d.eventos) : [];
      if (eventos.length) porId.set(ids[i], { eventos });
    });
    if (!porId.size) return null;
    const de = (teamId: string) => (suyos.get(teamId) ?? []).map((id) => porId.get(id)).filter((p): p is NonNullable<typeof p> => p != null);
    let rival: PerfilTercios | null = null;
    const otros: PerfilTercios[] = [];
    for (const teamId of miembros) {
      const r = perfilTercios(de(teamId), teamId);
      if (!r) continue;
      if (teamId === rivalId) rival = r;
      else otros.push(r);
    }
    return rival ? tercios(rival, otros) : null;
  }, [docs, ids, miembros, suyos, rivalId]);

  const cabecera = (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
      El rival por tercios · protección, control y amenaza
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
      <section aria-label="El rival por tercios" className="portada-tarjeta mb-6 min-w-0 px-4 py-4 sm:px-5">
        {cabecera}
        <p className="mt-1 text-sm text-white/60">Leyendo el evento a evento de {ids.length} partidos de la liga…</p>
      </section>
    );
  }

  const fuerte = [...datos.zonas].sort((a, b) => b.nota - a.nota)[0];
  const debil = [...datos.zonas].sort((a, b) => a.nota - b.nota)[0];
  const titular =
    fuerte.nota - debil.nota < 10
      ? "Parejo en los tres tercios"
      : `Fuerte en la ${ROTULO[fuerte.zona].titulo.toLowerCase()}, flojo en la ${ROTULO[debil.zona].titulo.toLowerCase()}`;

  return (
    <section aria-label="El rival por tercios" className="portada-tarjeta portada-entra mb-6 min-w-0 px-4 py-4 sm:px-5">
      {cabecera}
      <h3 className="fuente-club mt-1.5 text-[22px] font-bold uppercase leading-[1.05] text-white sm:text-[28px]">{titular}</h3>
      <p className="mt-1 text-sm leading-6 text-white/70">
        {nombreRival || "El rival"}: donde más le cuesta es la {ROTULO[debil.zona].titulo.toLowerCase()} ({ROTULO[debil.zona].que}, percentil {Math.round(debil.nota)}); ahí merece la pena morderle.
        Donde mejor está, la {ROTULO[fuerte.zona].titulo.toLowerCase()} (percentil {Math.round(fuerte.nota)}).
      </p>

      <div className="mt-3 flex min-w-0 items-stretch gap-2 sm:gap-3">
        <Termometro rotulo="Altura defensiva" valor={datos.altura.pct} mediana={50} pie={`${dec(datos.altura.metros)} m · liga ${dec(datos.altura.medianaMetros)} m`} />

        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
            <span>← su portería</span>
            <span>nuestra portería →</span>
          </div>
          <ul className="mt-1 grid min-w-0 grid-cols-3 gap-1 sm:gap-1.5">
            {datos.zonas.map((z) => (
              <BloqueZona key={z.zona} z={z} />
            ))}
          </ul>
          <div className="mt-2" aria-hidden>
            <span className="block h-2 rounded-full" style={{ background: `linear-gradient(to right, ${fondo(0)}, ${fondo(100)})` }} />
            <span className="mt-0.5 flex justify-between text-[10px] tabular-nums text-white/55">
              <span>0</span>
              <span>percentil contra su liga</span>
              <span>100</span>
            </span>
          </div>
        </div>

        <Termometro rotulo="Media de las tres" valor={datos.media.nota} mediana={datos.media.mediana} pie={`liga ${Math.round(datos.media.mediana)}`} />
      </div>

      <p className="mt-2 text-[11px] leading-5 text-white/55">
        De su portería a la nuestra: su tercio, el medio y el nuestro. Cada bloque es la media de los percentiles de sus tres métricas (pasa el ratón o toca para verlas) contra los
        demás equipos de su liga, sin él; debajo, cuánto se separa de la mediana de la liga en esa nota. En «toques del contrario» y «remates que concede», cuanto menos, más alto el
        percentil. Altura defensiva: la x media de sus entradas, intercepciones y recuperaciones (Opta, campo de 105 m), en percentil; la raya es la mediana de la liga.
      </p>
    </section>
  );
}

function BloqueZona({ z }: { z: NotaZona }) {
  const r = ROTULO[z.zona];
  const fmt = (v: number, f: "porPartido" | "porcentaje") => (f === "porcentaje" ? `${Math.round(v * 100)} %` : dec(v));
  const detalle = z.metricas.map((m) => `${m.m.nombre}: ${fmt(m.valor, m.m.formato)} (liga ${fmt(m.mediana, m.m.formato)}, percentil ${Math.round(m.pct)})`).join("\n");
  return (
    <li
      tabIndex={0}
      title={detalle}
      className="group relative min-w-0 rounded-lg border border-white/10 px-1.5 py-2.5 text-center outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B] sm:px-3"
      style={{ background: fondo(z.nota) }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 sm:text-[11px]">{r.titulo}</p>
      <p className="text-[10px] text-white/65 sm:text-[11px]">({r.que})</p>
      <p className="fuente-club mt-1 text-[32px] font-bold leading-none tabular-nums text-white sm:text-[44px]">{Math.round(z.nota)}</p>
      <p className="mt-1 text-[12px] font-semibold tabular-nums text-white/85">{conSigno(z.difMediana)}</p>
      <p className="text-[10px] text-white/55">sobre la mediana</p>
      <div
        role="tooltip"
        className={`pointer-events-none invisible absolute ${ANCLA[z.zona]} top-full z-20 mt-1 w-[min(18rem,80vw)] rounded-lg border border-white/15 bg-[var(--rmcf-surface,#0b0f17)] px-3 py-2 text-left opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C8A96B]">
          {r.titulo} · {r.que}
        </p>
        <ul className="mt-1 space-y-1">
          {z.metricas.map((m) => (
            <li key={m.m.clave} className="text-[12px] leading-4 text-white/80">
              {m.m.nombre}: <b className="tabular-nums text-white">{fmt(m.valor, m.m.formato)}</b>
              <span className="tabular-nums text-white/55"> · liga {fmt(m.mediana, m.m.formato)} · p{Math.round(m.pct)}</span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function Termometro({ rotulo, valor, mediana, pie }: { rotulo: string; valor: number; mediana: number; pie: string }) {
  const v = Math.max(0, Math.min(100, valor));
  const m = Math.max(0, Math.min(100, mediana));
  return (
    <figure className="m-0 flex w-14 shrink-0 flex-col items-center sm:w-20" aria-label={`${rotulo}: percentil ${Math.round(v)} (mediana de la liga ${Math.round(m)})`}>
      <figcaption className="text-center text-[10px] font-semibold uppercase leading-3 tracking-[0.08em] text-white/60">{rotulo}</figcaption>
      <span className="relative mt-1 block w-4 flex-1 rounded-full" style={{ minHeight: 96, background: tinta(0.1) }} aria-hidden>
        <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: `${v}%`, background: ORO }} />
        <span className="absolute -left-1.5 -right-1.5 h-0.5" style={{ bottom: `${m}%`, background: tinta(0.8) }} title="mediana de la liga" />
      </span>
      <span className="fuente-club mt-1 text-[20px] font-bold leading-none tabular-nums text-white">{Math.round(v)}</span>
      <span className="mt-0.5 text-center text-[10px] leading-3 text-white/55">{pie}</span>
    </figure>
  );
}
