"use client";

/*
| LAS VISTAS EN EL CANAL DE YOUTUBE (06/11/2026)
|
| Los jugadores ven los clips en YouTube. /api/youtube/visionados recorre
| todas las listas del canal (una por rival) y trae las vistas de cada vídeo;
| aquí se atan a su rival (por el nombre de la lista), a su jornada (por el
| calendario) y a su jugador y puesto (por el título, contra la plantilla del
| rival). «Tras el último partido» es lo que han subido desde la foto anterior
| (se hace una al día, la primera vez que se pide y en la pasada nocturna).
| YouTube no dice quién ve un vídeo: sólo cuántas veces.
|
| 07/11/2026: la lectura sube a `useDatosYoutube` para que el resumen de la
| pantalla junte YouTube y la app; sin ninguna foto el bloque no se pinta
| (el aviso de cuándo llega lo da el panel, una sola vez). Cada cifra lleva su
| base (clips, fecha de la foto) y una referencia (mediana de vistas por clip).
*/

import { useEffect, useMemo, useState } from "react";
import { PlayCircle } from "lucide-react";

import { useRivalSquads } from "@/hooks/useRivalSquads";
import { useOrdenRivales } from "@/hooks/useOrdenRivales";
import { buscaLista, jugadorDelTitulo } from "@/lib/rivals/youtube-listas";

type Clip = { id: string; titulo: string; lista: string; publicado: string; vistas: number; meGusta: number };
type Respuesta = { ok: boolean; aviso?: string; actualizado?: string; clips?: Clip[]; historia?: Record<string, Record<string, number>> };
type Fila = { nombre: string; vistas: number; nuevas: number; clips: number };

const mediana = (xs: number[]) => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
};

function Barras({ titulo, filas }: { titulo: string; filas: Fila[] }) {
  if (!filas.length) return null;
  const max = Math.max(...filas.map((f) => f.vistas), 1);
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">{titulo}</h3>
      <ul className="space-y-2">
        {filas.slice(0, 14).map((f) => (
          <li key={f.nombre} className="text-[13px]">
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-white/85">{f.nombre} <span className="text-white/45">· {f.clips} {f.clips === 1 ? "clip" : "clips"}</span></span>
              <span className="shrink-0 tabular-nums text-white/75">{f.vistas} vistas{f.nuevas > 0 ? <span className="text-[#1B9E77]"> · +{f.nuevas}</span> : null}</span>
            </div>
            <span className="block h-2 rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#C8A96B]" style={{ width: `${(100 * f.vistas) / max}%` }} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Lee el canal una vez; lo usan el resumen de arriba y el bloque. */
export function useDatosYoutube() {
  const [resp, setResp] = useState<Respuesta | null>(null);
  const { squads } = useRivalSquads();
  const { jornadaDe } = useOrdenRivales();

  useEffect(() => {
    let vivo = true;
    fetch("/api/youtube/visionados", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: Respuesta) => vivo && setResp(j))
      .catch(() => vivo && setResp({ ok: false, aviso: "No se ha podido leer el canal." }));
    return () => {
      vivo = false;
    };
  }, []);

  const datos = useMemo(() => {
    const clips = resp?.clips ?? [];
    if (!clips.length) return null;

    /* La foto anterior a la de hoy: lo de después es «tras el último partido». */
    const dias = Object.keys(resp?.historia ?? {}).sort();
    const anterior = dias.length >= 2 ? resp!.historia![dias[dias.length - 2]] : null;

    /* Lista → rival, y la plantilla de cada rival para sacar jugador y puesto. */
    const listas = [...new Set(clips.map((c) => c.lista))].map((nombre) => ({ id: nombre, nombre, cuenta: 0 }));
    const rivalDeLista = new Map<string, string>();
    const plantillaDe = new Map<string, { nombre: string; puesto?: string }[]>();
    for (const s of squads) {
      const l = buscaLista(listas, s.equipo);
      if (l && !rivalDeLista.has(l.nombre)) rivalDeLista.set(l.nombre, s.equipo);
      plantillaDe.set(s.equipo, s.players.map((p) => ({ nombre: p.nombre, puesto: p.posicion })));
    }

    const filas = clips.map((c) => {
      const equipo = rivalDeLista.get(c.lista) ?? c.lista;
      const jugador = jugadorDelTitulo(c.titulo, plantillaDe.get(equipo) ?? []);
      return {
        ...c,
        equipo,
        jornada: jornadaDe(equipo)?.etiqueta ?? "",
        jugador: jugador?.nombre ?? "",
        puesto: jugador?.puesto ?? "",
        nuevas: anterior ? Math.max(0, c.vistas - (anterior[c.id] ?? 0)) : 0,
      };
    });

    /* Lo que no tiene clave (puesto o jugador sin cruzar) no se nombra. */
    const agrupa = (clave: (f: (typeof filas)[number]) => string) => {
      const m = new Map<string, Fila>();
      for (const f of filas) {
        const k = clave(f);
        if (!k) continue;
        const e = m.get(k) ?? { nombre: k, vistas: 0, nuevas: 0, clips: 0 };
        e.vistas += f.vistas;
        e.nuevas += f.nuevas;
        e.clips += 1;
        m.set(k, e);
      }
      return [...m.values()].sort((a, b) => b.vistas - a.vistas);
    };

    const ordenadas = [...filas].sort((a, b) => b.vistas - a.vistas);
    return {
      filas: ordenadas,
      anterior: anterior ? dias[dias.length - 2] : null,
      total: filas.reduce((s, f) => s + f.vistas, 0),
      nuevas: filas.reduce((s, f) => s + f.nuevas, 0),
      sinVer: filas.filter((f) => f.vistas === 0).length,
      mediana: mediana(filas.map((f) => f.vistas)),
      top: ordenadas[0],
      porRival: agrupa((f) => (f.jornada ? `${f.jornada} · ${f.equipo}` : f.equipo)),
      porPuesto: agrupa((f) => f.puesto),
      porJugador: agrupa((f) => (f.jugador ? `${f.jugador} (${f.equipo})` : "")),
    };
  }, [resp, squads, jornadaDe]);

  return { resp, datos };
}

export type DatosYoutube = ReturnType<typeof useDatosYoutube>;

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });

export function BloqueYoutube({ resp, datos }: DatosYoutube) {
  if (!resp) return <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" aria-label="Leyendo el canal de YouTube" />;
  /* Sin ninguna foto el bloque no sale: el panel dice cuándo llega. */
  if (!datos) return null;

  const kpis = [
    { t: "Vistas en YouTube", v: String(datos.total), base: `${datos.filas.length} clips` },
    ...(datos.anterior ? [{ t: `Desde el ${fecha(datos.anterior)}`, v: `+${datos.nuevas}`, base: "foto anterior" }] : []),
    { t: "Vistas por clip", v: String(datos.mediana), base: "mediana" },
    { t: "Clips sin ver", v: String(datos.sinVer), base: `de ${datos.filas.length}` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold"><PlayCircle size={18} className="text-[#C8A96B]" /> En el canal de YouTube</h2>
        <p className="text-[12px] text-white/55">
          Vistas acumuladas desde la jornada 1{resp.actualizado ? ` · foto del ${new Date(resp.actualizado).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
          {datos.anterior ? ` · «+» = vistas desde el ${fecha(datos.anterior)}` : ""}. YouTube dice cuántas veces, nunca quién.
        </p>
      </div>
      {resp.aviso && <p className="text-[12px] text-[#FBBF24]">{resp.aviso}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[12px] text-white/60">{k.t}</p>
            <p className="text-3xl font-black tabular-nums">{k.v}</p>
            <p className="text-[11px] text-white/45">{k.base}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Barras titulo="Por rival y jornada" filas={datos.porRival} />
        <Barras titulo="Por puesto del jugador" filas={datos.porPuesto} />
        <Barras titulo="Por jugador" filas={datos.porJugador} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">Los clips más vistos</h3>
        <p className="mb-3 text-[12px] text-white/50">Mediana del canal: {datos.mediana} vistas por clip.</p>
        <ol className="space-y-1.5 text-[13px]">
          {datos.filas.slice(0, 25).map((f, i) => (
            <li key={f.id} className="flex flex-wrap items-baseline gap-x-2 border-b border-white/[0.06] pb-1.5">
              <span className="w-7 tabular-nums text-white/50">{i + 1}º</span>
              <a href={`https://www.youtube.com/watch?v=${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-white/85 hover:text-[#C8A96B]">
                {f.jugador || f.titulo} <span className="text-white/50">· {[f.puesto, f.jornada, f.equipo].filter(Boolean).join(" · ")}</span>
              </a>
              <span className="tabular-nums text-white/80">{f.vistas} vistas{f.nuevas ? <span className="text-[#1B9E77]"> · +{f.nuevas}</span> : null}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
