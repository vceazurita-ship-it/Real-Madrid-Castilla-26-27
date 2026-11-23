"use client";

/*
| ANÁLISIS EXTERNOS (23/11/2026). La sección del Laboratorio de ABP con lo que
| publican analistas de fuera (por ahora @HybridMarking): cada hilo con su
| análisis en castellano (qué hace ese equipo, la clave de cada acción,
| principios y cómo llevarlo al Castilla) y sus vídeos, que se ven desde X.
| Llega cada mañana (scripts/abp-externos.mjs) sin publicar nada: se lee del
| documento `abp-externos` al abrir la sección. Lo nuevo va marcado y, al
| verlo, se apunta como visto (el aviso de toda la app deja de salir).
*/

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, FlaskConical, Newspaper, Search } from "lucide-react";

import { Notice, Segmented } from "@/components/abp/ui";
import type { Borrador } from "@/components/abp-lab/Taller";
import { borradorVacio } from "@/components/abp-lab/Taller";
import {
  FUENTES_EXTERNAS,
  NOMBRE_TIPO,
  TIPOS_EXTERNOS,
  tipoTaller,
  type ClipAnalizado,
  type DocExternos,
  type ItemExterno,
  type PiezaExterna,
  type TipoExterno,
  type VideoExterno,
} from "@/lib/abp-lab/externos";

const hace = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 36) return `hace ${h} h`;
  return new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

const fecha = (iso: string) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "");

const ESTADO_LECTURA: Record<string, string> = {
  ok: "al día",
  "falta-sesion": "falta iniciar sesión en X (scripts\\x-sesion.cmd)",
  comprobacion: "X pide comprobación: se reintenta mañana",
  error: "con fallo",
  "sin-chrome": "no arranca el Chrome de X",
};

type Filtro = "todos" | TipoExterno;

export function Externos({ onAlTaller }: { onAlTaller: (b: Borrador) => void }) {
  const [doc, setDoc] = useState<DocExternos | null>(null);
  const [fallo, setFallo] = useState("");
  const [tipo, setTipo] = useState<Filtro>("todos");
  const [lado, setLado] = useState<"todos" | "ofensivo" | "defensivo">("todos");
  const [busca, setBusca] = useState("");
  const [soloNuevo, setSoloNuevo] = useState(false);
  /* Lo «nuevo» se fija al abrir: aunque se apunte como visto, en esta visita sigue marcado. */
  const [vistoAlAbrir, setVistoAlAbrir] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    let reloj: number | undefined;
    void fetch("/api/abp-lab/externos", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok: boolean; doc?: DocExternos; error?: string }>)
      .then((j) => {
        if (!vivo) return;
        if (!j.ok || !j.doc) return setFallo(j.error ?? "No se han podido leer.");
        const visto = j.doc.vistoHasta ? Date.parse(j.doc.vistoHasta) : 0;
        setVistoAlAbrir(visto);
        setDoc(j.doc);
        const hayNuevos = j.doc.items.some((i) => i.analisis && Date.parse(i.llegoEn) > visto);
        /* Visto: tras unos segundos con la sección abierta. */
        if (hayNuevos) reloj = window.setTimeout(() => void fetch("/api/abp-lab/externos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "visto" }) }), 4000);
      })
      .catch(() => vivo && setFallo("No se han podido leer."));
    return () => {
      vivo = false;
      window.clearTimeout(reloj);
    };
  }, []);

  const esNuevo = (i: ItemExterno) => vistoAlAbrir !== null && Date.parse(i.llegoEn) > vistoAlAbrir;

  const items = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (doc?.items ?? []).filter((i) => {
      if (!i.analisis) return false;
      if (soloNuevo && !(vistoAlAbrir !== null && Date.parse(i.llegoEn) > vistoAlAbrir)) return false;
      const clips = i.analisis.clips;
      if (tipo !== "todos" && !clips.some((c) => c.tipo === tipo)) return false;
      if (lado !== "todos" && !clips.some((c) => c.lado === lado)) return false;
      if (q) {
        const todo = [i.analisis.titulo, i.analisis.equipo, i.analisis.competicion, i.analisis.resumen, ...i.analisis.etiquetas, ...clips.map((c) => `${c.que} ${c.clave}`)].join(" ").toLowerCase();
        if (!todo.includes(q)) return false;
      }
      return true;
    });
  }, [doc, tipo, lado, busca, soloNuevo, vistoAlAbrir]);

  if (fallo) return <Notice tone="warn" title="No se han podido leer los análisis externos">{fallo} Si la sesión de administrador ha caducado, vuelve a entrar desde Ajustes.</Notice>;
  if (!doc) return <p className="py-10 text-center text-sm text-white/50">Cargando los análisis externos…</p>;

  const conAnalisis = doc.items.filter((i) => i.analisis);
  const nuevos = conAnalisis.filter(esNuevo).length;
  const tiposVistos = TIPOS_EXTERNOS.filter((t) => conAnalisis.some((i) => i.analisis!.clips.some((c) => c.tipo === t)));
  const totalClips = conAnalisis.reduce((s, i) => s + i.piezas.reduce((k, p) => k + p.videos.length, 0), 0);

  return (
    <div className="grid min-w-0 gap-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
              <Newspaper size={16} className="text-[#C8A96B]" aria-hidden /> Análisis externos
              {nuevos > 0 && <span className="rounded-full bg-[#C8A96B] px-2 py-0.5 text-[11px] font-bold text-[color:var(--rmcf-on-gold)]">{nuevos} {nuevos === 1 ? "nuevo" : "nuevos"}</span>}
            </p>
            <p className="mt-1 text-[12px] text-white/55">
              {conAnalisis.length} hilos analizados · {totalClips} vídeos. Llegan solos cada mañana, analizados en castellano; los vídeos se ven desde X.
            </p>
          </div>
        </div>
        <ul className="mt-3 grid gap-1.5">
          {FUENTES_EXTERNAS.map((f) => {
            const l = doc.lecturas.find((x) => x.cuenta === f.cuenta);
            return (
              <li key={f.cuenta} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
                <a href={`https://x.com/${f.cuenta}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#C8A96B] hover:underline">
                  @{f.cuenta} <ArrowUpRight size={12} aria-hidden />
                </a>
                <span className="text-white/55">{f.quien}</span>
                <span className={l?.estado === "ok" || !l ? "text-white/45" : "text-amber-200/85"}>
                  {l ? `Leído ${hace(l.leidoEn)} · ${ESTADO_LECTURA[l.estado] ?? l.estado}${l.detalle && l.estado === "ok" ? ` (${l.detalle})` : ""}` : "Aún sin leer: la primera lectura es mañana a las 7:45"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {conAnalisis.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="max-w-full overflow-x-auto">
            <Segmented ariaLabel="Tipo de acción" value={tipo} onChange={setTipo} options={[{ key: "todos" as Filtro, label: "Todas" }, ...tiposVistos.map((t) => ({ key: t as Filtro, label: NOMBRE_TIPO[t] }))]} />
          </div>
          <Segmented
            ariaLabel="Lado"
            value={lado}
            onChange={setLado}
            options={[
              { key: "todos", label: "A favor y en contra" },
              { key: "ofensivo", label: "A favor" },
              { key: "defensivo", label: "En contra" },
            ]}
          />
          {nuevos > 0 && (
            <button type="button" onClick={() => setSoloNuevo((v) => !v)} aria-pressed={soloNuevo} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${soloNuevo ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#C8A96B]" : "border-white/10 text-white/70 hover:bg-white/[0.06]"}`}>
              Sólo lo nuevo
            </button>
          )}
          <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Equipo, bloqueo, primer palo…" aria-label="Buscar en los análisis" className="w-full rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-3 text-[13px] text-white placeholder:text-white/35 focus:border-[#C8A96B]/60 focus:outline-none" />
          </label>
        </div>
      )}

      {!conAnalisis.length && <Notice title="Todavía no ha llegado nada">Cada mañana, al leer X, se miran las publicaciones nuevas de las cuentas de arriba. En cuanto haya un análisis, sale aquí y te avisa.</Notice>}
      {conAnalisis.length > 0 && !items.length && <p className="py-6 text-center text-[13px] text-white/50">Nada con esos filtros.</p>}

      <ol className="grid gap-4">
        {items.map((i) => (
          <TarjetaExterna key={i.id} item={i} nuevo={esNuevo(i)} onAlTaller={onAlTaller} filtroTipo={tipo} filtroLado={lado} />
        ))}
      </ol>
    </div>
  );
}

function TarjetaExterna({ item, nuevo, onAlTaller, filtroTipo, filtroLado }: { item: ItemExterno; nuevo: boolean; onAlTaller: (b: Borrador) => void; filtroTipo: Filtro; filtroLado: string }) {
  const a = item.analisis!;
  const [todos, setTodos] = useState(false);

  /* Un recuadro por vídeo, con lo que dice el análisis de su pieza. */
  const clips = item.piezas.flatMap((p, n) =>
    p.videos.map((v, k) => ({ pieza: p, n, k, video: v, clip: a.clips.filter((c) => c.pieza === n)[k] ?? a.clips.find((c) => c.pieza === n) ?? null })),
  );
  const filtrados = clips.filter(({ clip }) => (filtroTipo === "todos" || clip?.tipo === filtroTipo) && (filtroLado === "todos" || clip?.lado === filtroLado));
  const visibles = todos ? filtrados : filtrados.slice(0, 6);
  /* Las acciones descritas sin vídeo (en fotos o en el texto). */
  const sinVideo = a.clips.filter((c) => !item.piezas[c.pieza]?.videos.length);

  return (
    <li id={`externo-${item.id}`} className={`min-w-0 rounded-2xl border p-4 ${nuevo ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-white">
            {nuevo && <span className="mr-2 rounded-full bg-[#C8A96B] px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[color:var(--rmcf-on-gold)]">Nuevo</span>}
            {a.titulo}
          </p>
          <p className="mt-0.5 text-[12px] text-white/55">
            {[a.equipo, a.competicion, fecha(item.fecha), `@${item.cuenta}`, `${clips.length} vídeos`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[12px] text-white/75 hover:bg-white/[0.06]">
          El hilo en X <ArrowUpRight size={12} aria-hidden />
        </a>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-white/85">{a.resumen}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {a.principios.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Principios</p>
            <ul className="grid gap-1 text-[12.5px] text-white/80">
              {a.principios.map((p) => (
                <li key={p} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/50" />{p}</li>
              ))}
            </ul>
          </div>
        )}
        {a.paraNosotros.length > 0 && (
          <div className="rounded-xl border border-[#C8A96B]/35 bg-[#C8A96B]/[0.06] p-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C8A96B]">Para el Castilla</p>
            <ul className="grid gap-1 text-[12.5px] text-white/85">
              {a.paraNosotros.map((p) => (
                <li key={p} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#C8A96B]" />{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {a.etiquetas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.etiquetas.map((e) => (
            <span key={e} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/60">{e}</span>
          ))}
        </div>
      )}

      {visibles.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map(({ pieza, n, k, video, clip }) => (
            <Clip key={`${pieza.id}-${k}`} pieza={pieza} numero={n} video={video} clip={clip} equipo={a.equipo} onAlTaller={onAlTaller} />
          ))}
        </ul>
      )}
      {filtrados.length > 6 && (
        <button type="button" onClick={() => setTodos((v) => !v)} className="mt-3 text-[12px] font-semibold text-[#C8A96B] hover:underline">
          {todos ? "Ver menos" : `Ver los ${filtrados.length} vídeos`}
        </button>
      )}

      {sinVideo.length > 0 && filtroTipo === "todos" && (
        <ul className="mt-3 grid gap-1.5 text-[12px] text-white/70">
          {sinVideo.map((c, z) => (
            <li key={z} className="flex min-w-0 flex-wrap gap-x-2">
              <ChipTipo clip={c} />
              <span>{c.que}</span>
              {c.clave && <span className="text-white/50">· {c.clave}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ChipTipo({ clip }: { clip: ClipAnalizado }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-semibold text-white/75">
      {NOMBRE_TIPO[clip.tipo]} · {clip.lado === "defensivo" ? "en contra" : "a favor"}
      {clip.resultado === "gol" && <span className="text-[#C8A96B]">· gol</span>}
      {clip.resultado === "remate" && <span className="text-white/55">· remate</span>}
    </span>
  );
}

function Clip({ pieza, numero, video, clip, equipo, onAlTaller }: { pieza: PiezaExterna; numero: number; video: VideoExterno; clip: ClipAnalizado | null; equipo: string; onAlTaller: (b: Borrador) => void }) {
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/30">
      {/* Desde X: sin copiar nada. preload none para no bajar todo el hilo al abrirlo. */}
      <video src={video.ligero} poster={video.poster} controls playsInline preload="none" className="aspect-video w-full bg-black object-contain" aria-label={clip?.que ?? `Vídeo ${numero + 1}`} />
      <div className="grid min-w-0 gap-1.5 p-3">
        {clip ? (
          <>
            <ChipTipo clip={clip} />
            <p className="text-[12.5px] text-white/85">{clip.que}</p>
            {clip.clave && (
              <p className="text-[12px] text-white/60">
                <span className="text-[#C8A96B]">La clave: </span>
                {clip.clave}
              </p>
            )}
          </>
        ) : (
          <p className="line-clamp-3 text-[12px] text-white/65">{pieza.texto}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
          {clip && (
            <button
              type="button"
              onClick={() =>
                onAlTaller({
                  ...borradorVacio(),
                  nombre: `${equipo ? `${equipo}: ` : ""}${clip.que}`.slice(0, 90),
                  tipo: tipoTaller(clip.tipo),
                  lado: clip.lado,
                  idea: [clip.que, clip.clave ? `Clave: ${clip.clave}` : "", `Visto en @${pieza.url.split("/")[3] ?? ""}: ${pieza.url}`].filter(Boolean).join("\n"),
                })
              }
              className="inline-flex items-center gap-1 font-semibold text-[#C8A96B] hover:underline"
            >
              <FlaskConical size={12} aria-hidden /> Al taller
            </button>
          )}
          {video.bueno && (
            <a href={video.bueno} target="_blank" rel="noreferrer" className="text-white/55 hover:text-white hover:underline">
              En grande
            </a>
          )}
          <a href={pieza.url} target="_blank" rel="noreferrer" className="text-white/55 hover:text-white hover:underline">
            En X
          </a>
        </div>
      </div>
    </li>
  );
}
