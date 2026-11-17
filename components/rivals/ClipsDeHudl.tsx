"use client";

/*
|--------------------------------------------------------------------------
| LOS CLIPS DE HUDL DE CADA JUGADOR RIVAL, AL PORTÁTIL (17/11/2026)
|--------------------------------------------------------------------------
|
| Petición del analista: «desde Wyscout exporto cortes de un jugador y los
| llevo a Hudl; quiero poder bajármelos en local desde la app». El ordenador
| del club baja cada lista «RIVAL - JUGADOR» de Hudl a B2
| (scripts/hudl-clips-rival.mjs, documento `hudl:clips-rival`, reglas en
| lib/hudl-clips.ts). Aquí:
|
| - `ClipsHudlJugador`: «⬇ Descargar sus clips (N)» (un .zip con los clips
|   nombrados «RIVAL - JUGADOR - 01 - <título>.mp4») y cada clip suelto con
|   ▶ y ⬇. Si su lista está en Hudl y aún no está bajada (o le faltan
|   clips), «Pedir a Hudl» deja el encargo `hudl-clips` al vigía y avisa al
|   terminar.
| - `ClipsHudlDelRival`: todas las listas de un rival, jugador a jugador
|   (panel en Scout individual o modal desde la tira de accesos).
|
| Las descargas van por el gestor común (`encargaDescarga`): se sigue
| trabajando y el .zip baja solo al acabar (memoria descargas-segundo-plano).
*/

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Download, Play, X } from "lucide-react";

import { aviso } from "@/lib/avisos";
import { avisaHecho, pidePermisoAvisos } from "@/lib/aviso-hecho";
import { creaZip, type EntradaZip } from "@/lib/export/zip";
import {
  CLAVE_HUDL_CLIPS,
  listasDelEquipo,
  listasDelJugador,
  nombreDelClip,
  normalizaDocHudl,
  pesoLegible,
  type ClipHudl,
  type DocHudlClips,
  type ListaConId,
} from "@/lib/hudl-clips";
import { estadoEncargo, type Mantenimiento, type Vigia } from "@/lib/mantenimiento";
import { encargaDescarga } from "@/lib/trabajos/descargas";

/* ------------------------------------------------------------------ */
/*  El documento, una vez por pestaña                                  */
/* ------------------------------------------------------------------ */

type Almacen = { doc: DocHudlClips | null; pedido: PedidoHudl | null };

/** Un «Pedir a Hudl» en marcha: cuándo se pidió y, si el vigía cuenta, por dónde va. */
type PedidoHudl = { desde: number; cuenta?: [number, number]; enMarcha: boolean };

let almacen: Almacen = { doc: null, pedido: null };
let cargando: Promise<void> | null = null;
const oyentes = new Set<() => void>();

const cambia = (parcial: Partial<Almacen>) => {
  almacen = { ...almacen, ...parcial };
  for (const fn of oyentes) fn();
};

function carga(forzar = false) {
  if (cargando && !forzar) return cargando;

  cargando = fetch(`/api/docs?key=${encodeURIComponent(CLAVE_HUDL_CLIPS)}`, { cache: "no-store" })
    .then((r) => r.json() as Promise<{ data?: unknown }>)
    .then((j) => cambia({ doc: normalizaDocHudl(j?.data ?? null) }))
    .catch(() => {
      cargando = null;
    });

  return cargando;
}

const suscribe = (fn: () => void) => {
  oyentes.add(fn);
  void carga();

  return () => oyentes.delete(fn);
};

const SIN_NADA: Almacen = { doc: null, pedido: null };

function useAlmacenHudl() {
  return useSyncExternalStore(suscribe, () => almacen, () => SIN_NADA);
}

/* ------------------------------------------------------------------ */
/*  «Pedir a Hudl»: el encargo y su vigilancia                         */
/* ------------------------------------------------------------------ */

let vigilando = false;

/** Mira el encargo cada 20 s hasta que acaba; entonces avisa y relee los clips. Sigue aunque se cambie de pantalla. */
function vigila(desde: number) {
  if (vigilando) return;

  vigilando = true;

  const mira = async () => {
    try {
      const r = await fetch("/api/mantenimiento", { cache: "no-store" });
      const j = (await r.json()) as { ok?: boolean; estado?: Mantenimiento; vigia?: Vigia | null };
      const encargo = j?.estado?.["hudl-clips"];
      const estado = estadoEncargo("hudl-clips", encargo);
      const hecho = Date.parse(encargo?.hechoEn ?? "") || 0;

      if (estado === "libre" && hecho >= desde - 5_000) {
        vigilando = false;
        cambia({ pedido: null });
        await carga(true);
        avisaHecho({
          titulo: encargo?.ok === false ? "Clips de Hudl: no ha salido" : "Clips de Hudl: listos",
          texto: encargo?.resultado?.replace(/^RESUMEN:\s*/i, "").slice(0, 160),
          ok: encargo?.ok !== false,
          clave: `hudl-clips:${encargo?.hechoEn}`,
        });

        return;
      }

      cambia({ pedido: { desde, enMarcha: estado === "en-marcha", cuenta: j?.vigia?.progreso?.["hudl-clips"]?.cuenta } });
    } catch {
      /* sin red un momento: se vuelve a mirar */
    }

    /* Más de dos horas: el ordenador del club no lo ha cogido; se deja de mirar. */
    if (Date.now() - desde > 2 * 3600_000) {
      vigilando = false;
      cambia({ pedido: null });

      return;
    }

    window.setTimeout(() => void mira(), 20_000);
  };

  window.setTimeout(() => void mira(), 5_000);
}

async function pideAHudl() {
  pidePermisoAvisos();

  try {
    const r = await fetch("/api/mantenimiento", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tarea: "hudl-clips" }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };

    if (!r.ok || !j.ok) {
      aviso.error("No se ha podido pedir a Hudl", j.error ?? `El servidor dice ${r.status}`);

      return;
    }

    const desde = Date.now();

    cambia({ pedido: { desde, enMarcha: false } });
    aviso.info("Pedido a Hudl", "El ordenador del club baja lo nuevo en unos minutos; te avisamos al terminar.");
    vigila(desde);
  } catch {
    aviso.error("No se ha podido pedir a Hudl", "Sin conexión con el servidor.");
  }
}

/* ------------------------------------------------------------------ */
/*  Bajar al portátil                                                  */
/* ------------------------------------------------------------------ */

/* El enlace guardado lleva el dominio de la web publicada; se pide en el de esta pestaña. */
const urlLocal = (url: string) => {
  try {
    const u = new URL(url, window.location.href);

    return u.pathname.startsWith("/api/video/") ? `${u.pathname}${u.search}` : u.href;
  } catch {
    return url;
  }
};

async function bajaBytes(url: string, senal: AbortSignal) {
  const r = await fetch(urlLocal(url), { signal: senal });

  if (!r.ok) throw new Error(`un clip no baja (HTTP ${r.status})`);

  return new Uint8Array(await r.arrayBuffer());
}

/** Un .zip con los clips de una o varias listas, en segundo plano. */
function descargaZip(listas: ListaConId[], nombreZip: string, vuelta: string) {
  const piezas = listas.flatMap((l) => l.clips.map((c, i) => ({ nombre: nombreDelClip(l, c, i + 1), url: c.url })));

  if (!piezas.length) return;

  encargaDescarga({
    titulo: `Clips de Hudl · ${nombreZip}`,
    vuelta,
    tarea: async ({ avanza, senal }) => {
      const entradas: EntradaZip[] = [];

      for (const [i, p] of piezas.entries()) {
        avanza(`${i + 1}/${piezas.length} clips`, i / piezas.length);
        entradas.push({ nombre: p.nombre, datos: await bajaBytes(p.url, senal) });
      }

      avanza("Empaquetando", 1);

      return { blob: creaZip(entradas), nombre: `${nombreZip}.zip` };
    },
  });
}

function descargaUno(lista: ListaConId, clip: ClipHudl, n: number, vuelta: string) {
  encargaDescarga({
    titulo: `Clip de Hudl · ${lista.titulo} ${String(n).padStart(2, "0")}`,
    vuelta,
    tarea: async ({ senal }) => ({ blob: new Blob([await bajaBytes(clip.url, senal)], { type: "video/mp4" }), nombre: nombreDelClip(lista, clip, n) }),
  });
}

const aqui = () => (typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`);

const pesoDe = (listas: ListaConId[]) => listas.reduce((s, l) => s + l.clips.reduce((t, c) => t + (c.bytes || 0), 0), 0);

/* ------------------------------------------------------------------ */
/*  Piezas                                                             */
/* ------------------------------------------------------------------ */

const BOTON =
  "inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#C8A96B]/50 bg-[#C8A96B]/12 px-3 py-1.5 text-[13px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:opacity-50";
const BOTON_SUAVE =
  "inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[13px] font-medium text-white/75 transition hover:border-[#C8A96B] hover:text-white disabled:opacity-50";

/** «Bajando de Hudl… 3/12» o «Pedir a Hudl». */
function BotonPedir({ faltan }: { faltan: number }) {
  const { pedido } = useAlmacenHudl();

  if (pedido) {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 text-[12px] text-white/60" role="status">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#C8A96B]" aria-hidden />
        {pedido.enMarcha ? `Bajando de Hudl${pedido.cuenta ? ` · ${pedido.cuenta[0]}/${pedido.cuenta[1]}` : "…"}` : "Pedido a Hudl: en cola"}
      </span>
    );
  }

  return (
    <button type="button" className={BOTON_SUAVE} onClick={() => void pideAHudl()} title="El ordenador del club baja de Hudl los clips que falten y avisa al terminar">
      Pedir a Hudl{faltan > 0 ? ` (${faltan})` : ""}
    </button>
  );
}

/** La lista de clips de una lista de Hudl, con ▶ y ⬇ en cada uno. */
function ClipsDeLista({ lista }: { lista: ListaConId }) {
  const [viendo, setViendo] = useState<string | null>(null);

  return (
    <ol className="mt-2 min-w-0 space-y-1.5">
      {lista.clips.map((clip, i) => (
        <li key={clip.id} className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-6 shrink-0 text-right text-[12px] font-semibold tabular-nums text-white/45">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-snug text-white/85 [overflow-wrap:anywhere]">{clip.titulo || "Clip"}</p>
              {(clip.descripcion || clip.segundos) && (
                <p className="text-[12px] leading-snug text-white/50">
                  {[clip.descripcion, clip.segundos ? `${clip.segundos} s` : ""].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setViendo((v) => (v === clip.id ? null : clip.id))}
              aria-label={viendo === clip.id ? "Cerrar el vídeo" : `Ver el clip ${i + 1}`}
              aria-pressed={viendo === clip.id}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 text-white/70 transition hover:border-[#C8A96B] hover:text-white"
            >
              {viendo === clip.id ? <X className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => descargaUno(lista, clip, i + 1, aqui())}
              aria-label={`Descargar el clip ${i + 1}`}
              title={`Descargar · ${pesoLegible(clip.bytes)}`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 text-white/70 transition hover:border-[#C8A96B] hover:text-white"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
          {viendo === clip.id && (
            <video src={urlLocal(clip.url)} controls autoPlay playsInline className="mt-2 aspect-video w-full rounded-lg bg-black" />
          )}
        </li>
      ))}
    </ol>
  );
}

type JugadorParaHudl = {
  /** Sus nombres: el deportivo y el de la hoja («Yoldi», «ANDER YOLDI»). */
  nombres: (string | null | undefined)[];
  dorsal?: string | number | null;
};

/**
 * El botón del jugador: «⬇ Descargar sus clips (N)», ▶/⬇ de cada uno y, si
 * falta algo, «Pedir a Hudl». Sin lista en Hudl no pinta nada.
 */
export function ClipsHudlJugador({
  equipo,
  jugador,
  plantilla,
  compacto = false,
  className = "",
}: {
  equipo: string;
  jugador: JugadorParaHudl;
  /** La plantilla del rival, para que el dorsal decida si el nombre casa a dos. */
  plantilla?: JugadorParaHudl[];
  /** En la cabecera de un grupo: sólo el botón, la lista se despliega debajo. */
  compacto?: boolean;
  className?: string;
}) {
  const { doc } = useAlmacenHudl();
  const [abierto, setAbierto] = useState(false);

  const listas = useMemo(() => {
    const limpia = (j: JugadorParaHudl) => ({ nombres: j.nombres.filter((n): n is string => Boolean(n && String(n).trim())).map(String), dorsal: j.dorsal });

    return listasDelJugador(listasDelEquipo(doc, equipo), limpia(jugador), plantilla?.map(limpia));
  }, [doc, equipo, jugador, plantilla]);

  if (!listas.length) return null;

  const clips = listas.reduce((s, l) => s + l.clips.length, 0);
  const enHudl = listas.reduce((s, l) => s + l.enHudl, 0);
  const faltan = Math.max(0, enHudl - clips);
  const nombre = listas[0].titulo;

  return (
    <div className={`min-w-0 ${compacto ? "" : "w-full"} ${className}`} data-export-hide>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {clips > 0 && (
          <button
            type="button"
            className={BOTON}
            onClick={() => descargaZip(listas, listas.length === 1 ? nombre : `${listas[0].rival} - ${listas.map((l) => l.nombre ?? l.dorsal).join(", ")}`, aqui())}
            title={`Un .zip con sus ${clips} clips de Hudl · ${pesoLegible(pesoDe(listas))}`}
          >
            <Download className="h-4 w-4" aria-hidden />
            Descargar sus clips ({clips})
          </button>
        )}
        {clips > 0 && (
          <button type="button" className={BOTON_SUAVE} onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
            {abierto ? "Ocultar clips" : "▶ Ver uno a uno"}
          </button>
        )}
        {faltan > 0 && <BotonPedir faltan={faltan} />}
        {!compacto && <span className="text-[12px] text-white/45">De Hudl · «{nombre}»{listas.length > 1 ? ` y ${listas.length - 1} más` : ""}</span>}
      </div>
      {abierto && listas.map((l) => (listas.length > 1 ? (
        <div key={l.id} className="mt-2">
          <p className="text-[12px] font-semibold text-white/60">{l.titulo}</p>
          <ClipsDeLista lista={l} />
        </div>
      ) : (
        <ClipsDeLista key={l.id} lista={l} />
      )))}
    </div>
  );
}

/** Cuántos clips de Hudl hay de un rival (para el rótulo del acceso). */
export function useClipsHudlDelEquipo(equipo: string) {
  const { doc } = useAlmacenHudl();

  return useMemo(() => {
    const listas = listasDelEquipo(doc, equipo);

    return { listas, clips: listas.reduce((s, l) => s + l.clips.length, 0), enHudl: listas.reduce((s, l) => s + l.enHudl, 0) };
  }, [doc, equipo]);
}

/** Todas las listas del rival, jugador a jugador, con «Descargar todos». */
export function ClipsHudlDelRival({ equipo, className = "" }: { equipo: string; className?: string }) {
  const { listas, clips, enHudl } = useClipsHudlDelEquipo(equipo);
  const [abierta, setAbierta] = useState<string | null>(null);

  if (!listas.length) return null;

  return (
    <section className={`min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 ${className}`} aria-label={`Clips de Hudl de ${equipo}`} data-export-hide>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#C8A96B]">Clips de Hudl</p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {listas.length} {listas.length === 1 ? "jugador" : "jugadores"} · {clips} {clips === 1 ? "clip" : "clips"} para bajar
          </h2>
          <p className="mt-0.5 text-[12px] text-white/50">Los cortes de Wyscout que están en Hudl, a 720p, listos para el portátil.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {clips > 0 && (
            <button type="button" className={BOTON} onClick={() => descargaZip(listas, `${listas[0].rival} - clips de Hudl`, aqui())} title={`Un .zip con todos · ${pesoLegible(pesoDe(listas))}`}>
              <Download className="h-4 w-4" aria-hidden />
              Descargar todos ({clips})
            </button>
          )}
          {enHudl > clips && <BotonPedir faltan={enHudl - clips} />}
        </div>
      </div>

      <ul className="mt-4 min-w-0 divide-y divide-white/[0.06]">
        {listas.map((l) => {
          const faltan = Math.max(0, l.enHudl - l.clips.length);

          return (
            <li key={l.id} className="min-w-0 py-2.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {l.dorsal && <span className="rounded-md bg-[#C8A96B]/15 px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-[#C8A96B]">{l.dorsal}</span>}
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-white [overflow-wrap:anywhere]">{l.nombre ?? `Dorsal ${l.dorsal}`}</span>
                <span className="text-[12px] tabular-nums text-white/50">
                  {l.clips.length}
                  {faltan ? ` de ${l.enHudl}` : ""} {l.enHudl === 1 ? "clip" : "clips"}
                </span>
                {l.clips.length > 0 && (
                  <>
                    <button type="button" className={BOTON_SUAVE} onClick={() => setAbierta((a) => (a === l.id ? null : l.id))} aria-expanded={abierta === l.id}>
                      {abierta === l.id ? "Ocultar" : "▶ Ver"}
                    </button>
                    <button type="button" className={BOTON} onClick={() => descargaZip([l], l.titulo, aqui())} title={`Un .zip con sus clips · ${pesoLegible(pesoDe([l]))}`}>
                      <Download className="h-4 w-4" aria-hidden />
                      <span className="sr-only sm:not-sr-only">Descargar</span>
                    </button>
                  </>
                )}
              </div>
              {abierta === l.id && <ClipsDeLista lista={l} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** El acceso de la tira del rival: «⬇ Clips de Hudl (N)», que abre todo en un modal. */
export function AccesoClipsHudl({ equipo, className }: { equipo: string; className: string }) {
  const { listas, clips } = useClipsHudlDelEquipo(equipo);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;

    const cierra = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);

    window.addEventListener("keydown", cierra);

    return () => window.removeEventListener("keydown", cierra);
  }, [abierto]);

  if (!listas.length) return null;

  return (
    <>
      <button type="button" className={className} onClick={() => setAbierto(true)} title={`Los clips de Hudl de ${listas.length} ${listas.length === 1 ? "jugador" : "jugadores"} de ${equipo}, para bajar al portátil`}>
        ⬇ Clips de Hudl{clips ? ` (${clips})` : ""}
      </button>
      {abierto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            /* El fondo lo pone `.modal-veil`, no `bg-black/NN` (modo día). */
            className="modal-veil fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto p-3 backdrop-blur-sm sm:p-6"
            data-export-hide
            role="dialog"
            aria-modal="true"
            aria-label={`Clips de Hudl de ${equipo}`}
            onClick={() => setAbierto(false)}
          >
            <div className="relative my-auto w-full max-w-2xl min-w-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="absolute right-3 top-3 z-10 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <ClipsHudlDelRival equipo={equipo} className="bg-[#11161D] shadow-[0_24px_80px_rgba(0,0,0,.6)] pr-14" />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
