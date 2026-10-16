"use client";

/**
 * UN CUADERNO DE APUNTES DE ABP CON SU VÍDEO (16/10/2026).
 *
 * Arriba el vídeo (un MP4 subido o un enlace de YouTube) y debajo los apuntes
 * por fase y tipo, como los escribe el analista. Cada apunte con minuto salta
 * al vídeo (sumando dónde empieza el partido en él); uno con número de clip
 * se ata a su momento con «Marcar aquí» mientras se ve. Se puede pegar el
 * texto tal cual («26: DOS BLOQUES…», «MIN 19.45: …») y se reparte solo
 * (`leeApuntes`). El modelo y el lector, en `lib/abp/apuntes.ts`.
 */

import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, Copy, Crosshair, Flag, Link2, Loader2, Play, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/abp/ui";
import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import {
  FASES,
  TIPOS,
  agrupa,
  apuntesEnTexto,
  idYoutube,
  leeApuntes,
  mmss,
  nuevoId,
  refDe,
  rotuloRef,
  segundoEnVideo,
  type Apunte,
  type Cuaderno,
  type FaseAbp,
  type TipoAbp,
} from "@/lib/abp/apuntes";

/** El tope del almacén por fichero: un MP4 más grande no sube (ver /api/informe/subida). */
const TOPE_MP4 = 50 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/*  EL REPRODUCTOR: <video> o YouTube, con la misma cara               */
/* ------------------------------------------------------------------ */

type Mando = { ir: (s: number) => void; ahora: () => number };

type YtPlayer = { seekTo: (s: number, permitir: boolean) => void; playVideo: () => void; getCurrentTime: () => number; destroy: () => void };
type YtApi = { Player: new (el: HTMLElement, o: Record<string, unknown>) => YtPlayer };

/** Carga la API de YouTube una vez para toda la app. */
let apiYoutube: Promise<YtApi> | null = null;

function cargaYoutube(): Promise<YtApi> {
  const w = window as unknown as { YT?: YtApi & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };

  if (w.YT?.Player) return Promise.resolve(w.YT);

  apiYoutube ??= new Promise((resuelve) => {
    const previo = w.onYouTubeIframeAPIReady;

    w.onYouTubeIframeAPIReady = () => {
      previo?.();
      resuelve(w.YT!);
    };

    const s = document.createElement("script");

    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });

  return apiYoutube;
}

function Reproductor({ cuaderno, mandoRef }: { cuaderno: Cuaderno; mandoRef: React.MutableRefObject<Mando | null> }) {
  const video = cuaderno.video;
  const elVideo = useRef<HTMLVideoElement | null>(null);
  const caja = useRef<HTMLDivElement | null>(null);
  const id = video?.tipo === "youtube" ? idYoutube(video.url) : null;

  useEffect(() => {
    if (video?.tipo !== "youtube" || !id || !caja.current) return;

    let jugador: YtPlayer | null = null;
    let vivo = true;
    const destino = document.createElement("div");

    caja.current.replaceChildren(destino);

    cargaYoutube().then((YT) => {
      if (!vivo) return;

      jugador = new YT.Player(destino, { videoId: id, width: "100%", height: "100%", playerVars: { rel: 0, modestbranding: 1 } });
      mandoRef.current = {
        ir: (s) => {
          jugador?.seekTo(s, true);
          jugador?.playVideo();
        },
        ahora: () => jugador?.getCurrentTime() ?? 0,
      };
    });

    return () => {
      vivo = false;
      mandoRef.current = null;
      jugador?.destroy();
    };
  }, [video?.tipo, id, mandoRef]);

  useEffect(() => {
    if (video?.tipo !== "mp4") return;

    mandoRef.current = {
      ir: (s) => {
        const v = elVideo.current;

        if (!v) return;

        v.currentTime = s;
        void v.play().catch(() => undefined);
      },
      ahora: () => elVideo.current?.currentTime ?? 0,
    };

    return () => {
      mandoRef.current = null;
    };
  }, [video?.tipo, video?.url, mandoRef]);

  if (!video) return null;

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
      {video.tipo === "mp4" ? (
        <video ref={elVideo} src={video.url} controls preload="metadata" className="h-full w-full" />
      ) : id ? (
        <div ref={caja} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      ) : (
        <p className="p-4 text-sm text-red-300">Ese enlace no parece de YouTube.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EL CUADERNO                                                        */
/* ------------------------------------------------------------------ */

export function CuadernoApuntes({
  titulo,
  subtitulo,
  deQuien,
  valor,
  onCambia,
  equipoCarpeta,
}: {
  titulo: string;
  subtitulo?: string;
  deQuien: "rival" | "propio";
  valor: Cuaderno;
  onCambia: (siguiente: (actual: Cuaderno) => Cuaderno) => void;
  /** Dónde se guarda el MP4 subido (la carpeta de documentos del rival, o la nuestra). */
  equipoCarpeta: string;
}) {
  const mandoRef = useRef<Mando | null>(null);
  const [pegando, setPegando] = useState(false);
  const [texto, setTexto] = useState("");
  const [enlace, setEnlace] = useState("");
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState<{ fase: FaseAbp; tipo: TipoAbp; ref: string; texto: string }>({ fase: "of", tipo: "corner", ref: "", texto: "" });

  const cambia = (f: (c: Cuaderno) => Cuaderno) => onCambia((c) => ({ ...f(c), actualizado: new Date().toISOString() }));
  const cambiaApunte = (id: string, parte: Partial<Apunte>) => cambia((c) => ({ ...c, apuntes: c.apuntes.map((a) => (a.id === id ? { ...a, ...parte } : a)) }));
  const quitaApunte = (id: string) => cambia((c) => ({ ...c, apuntes: c.apuntes.filter((a) => a.id !== id) }));

  const pega = (sustituir: boolean) => {
    const leidos = leeApuntes(texto);

    if (!leidos.length) {
      toast.error("No he encontrado apuntes en ese texto", { description: "Cada uno en su línea, debajo de OF/DEF y de CÓRNER, FALTA, SBO…" });

      return;
    }

    cambia((c) => ({ ...c, apuntes: sustituir ? leidos : [...c.apuntes, ...leidos] }));
    toast.success(`${leidos.length} ${leidos.length === 1 ? "apunte" : "apuntes"} ${sustituir ? "puestos" : "añadidos"}`);
    setTexto("");
    setPegando(false);
  };

  const añade = () => {
    if (!nuevo.texto.trim()) return;

    const { ref, texto: resto } = refDe(nuevo.ref.trim() ? `${nuevo.ref.trim()}${/^\d+$/.test(nuevo.ref.trim()) ? ":" : ""} ${nuevo.texto}` : nuevo.texto);

    cambia((c) => ({ ...c, apuntes: [...c.apuntes, { id: nuevoId(), fase: nuevo.fase, tipo: nuevo.tipo, ref, texto: resto }] }));
    setNuevo((n) => ({ ...n, ref: "", texto: "" }));
  };

  const subeMp4 = async (file: File) => {
    if (file.size > TOPE_MP4) {
      toast.error(`El vídeo pesa ${(file.size / 1048576).toFixed(0)} MB y el almacén admite 50`, { description: "Súbelo a YouTube (oculto) y pega el enlace, o recórtalo." });

      return;
    }

    try {
      setSubiendo(0);

      const a = await subeAdjunto(file, (f) => setSubiendo(f), { carpeta: "rival", equipo: equipoCarpeta });

      cambia((c) => ({ ...c, video: { tipo: "mp4", url: a.url, nombre: file.name, inicio: c.video?.inicio ?? 0 } }));
    } catch (error) {
      toast.error("No se ha podido subir el vídeo", { description: error instanceof Error ? error.message : "" });
    } finally {
      setSubiendo(null);
    }
  };

  const ponEnlace = () => {
    const url = enlace.trim();

    if (!idYoutube(url)) {
      toast.error("Ese enlace no es de YouTube");

      return;
    }

    cambia((c) => ({ ...c, video: { tipo: "youtube", url, inicio: c.video?.inicio ?? 0 } }));
    setEnlace("");
  };

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(apuntesEnTexto(valor.apuntes, deQuien));
      toast.success("Apuntes copiados como texto");
    } catch {
      toast.error("El navegador no deja copiar");
    }
  };

  const grupos = agrupa(valor.apuntes);
  const sinMarcar = valor.video ? valor.apuntes.filter((a) => segundoEnVideo(a, valor.video) === null && a.ref?.clase === "clip").length : 0;

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white">{titulo}</h3>
          {subtitulo ? <p className="text-xs text-white/45">{subtitulo}</p> : null}
        </div>
        <span className="text-[11px] text-white/40">
          {valor.apuntes.length} {valor.apuntes.length === 1 ? "apunte" : "apuntes"}
        </span>
        <Button icon={ClipboardPaste} onClick={() => setPegando((x) => !x)}>
          Pegar notas
        </Button>
        {valor.apuntes.length > 0 && (
          <Button icon={Copy} onClick={() => void copia()} title="Los apuntes como texto, para pegarlos donde quieras">
            Copiar
          </Button>
        )}
      </header>

      {pegando && (
        <div className="space-y-2 rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.05] p-3">
          <p className="text-[11px] text-white/55">
            Pega tus notas tal cual: OF / DEF, luego CÓRNER, FALTA, FALTA LAT, SBO… y cada apunte en su línea con «26:» (número de clip) o «MIN 19.45:» (minuto del partido).
          </p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={8}
            placeholder={"OF\n    CÓRNER\n        26: DOS BLOQUES DESDE ÁREA PEQUEÑA\nDEF\n    CÓRNER\n        MIN 19.45: ÁREA PEQUEÑA POR DELANTE"}
            className="w-full resize-y rounded-lg border border-white/15 bg-black/20 p-2 font-mono text-xs text-white"
          />
          <div className="flex flex-wrap gap-2">
            <Button tone="primary" icon={Plus} onClick={() => pega(false)} disabled={!texto.trim()}>
              Añadir
            </Button>
            {valor.apuntes.length > 0 && (
              <Button onClick={() => pega(true)} disabled={!texto.trim()}>
                Sustituir los que hay
              </Button>
            )}
            <Button icon={X} onClick={() => setPegando(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* ---------------- el vídeo ---------------- */}
      <div className="space-y-2">
        <Reproductor cuaderno={valor} mandoRef={mandoRef} />

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {valor.video ? (
            <>
              <span className="truncate text-white/50">{valor.video.tipo === "youtube" ? "YouTube" : valor.video.nombre ?? "MP4"}</span>
              <Button
                icon={Flag}
                onClick={() => {
                  const s = mandoRef.current?.ahora() ?? 0;

                  cambia((c) => (c.video ? { ...c, video: { ...c.video, inicio: s } } : c));
                  toast.success(`El partido empieza en el ${mmss(s)} del vídeo`, { description: "Los apuntes con minuto saltan ya a su sitio." });
                }}
                title="Pon el vídeo en el saque inicial y pulsa: los «MIN 19.45» saltan a su sitio"
              >
                El partido empieza aquí{valor.video.inicio ? ` (${mmss(valor.video.inicio)})` : ""}
              </Button>
              <Button icon={X} tone="danger" onClick={() => cambia((c) => ({ ...c, video: null }))}>
                Quitar vídeo
              </Button>
              {sinMarcar > 0 && <span className="text-[11px] text-[#C8A96B]">{sinMarcar} con número de clip sin marcar: «Marcar aquí» mientras lo ves</span>}
            </>
          ) : (
            <span className="text-white/45">Sin vídeo todavía:</span>
          )}

          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/12 px-3 py-1.5 text-xs text-white/70 hover:text-white ${subiendo !== null ? "pointer-events-none opacity-60" : ""}`}>
            {subiendo !== null ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {subiendo !== null ? `Subiendo ${Math.round(subiendo * 100)} %` : valor.video ? "Otro MP4" : "Subir MP4"}
            <input type="file" accept="video/mp4,.mp4" className="hidden" onChange={(e) => e.target.files?.[0] && void subeMp4(e.target.files[0])} />
          </label>

          <span className="flex items-center gap-1">
            <input
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ponEnlace()}
              placeholder="o pega un enlace de YouTube"
              aria-label="Enlace de YouTube"
              className="w-56 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1.5 text-xs text-white"
            />
            <Button icon={Link2} onClick={ponEnlace} disabled={!enlace.trim()}>
              Usar
            </Button>
          </span>
        </div>
      </div>

      {/* ---------------- los apuntes ---------------- */}
      {grupos.length === 0 ? (
        <p className="text-sm text-white/40">Sin apuntes. Pega tus notas o añade uno abajo.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {grupos.map((g) => (
            <div key={g.fase.id} className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96B]">{g.fase.deQuien[deQuien]}</p>
              {g.tipos.map((t) => (
                <div key={t.tipo.id} className="rounded-xl border border-white/10 bg-black/10">
                  <p className="border-b border-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">{t.tipo.titulo}</p>
                  <ul className="divide-y divide-white/5">
                    {t.apuntes.map((a) => {
                      const s = segundoEnVideo(a, valor.video);

                      return (
                        <li key={a.id} className="group flex items-start gap-2 px-3 py-2">
                          <button
                            type="button"
                            disabled={s === null}
                            onClick={() => s !== null && mandoRef.current?.ir(s)}
                            title={s === null ? (valor.video ? "Márcalo en el vídeo con «Marcar aquí»" : "Sin vídeo") : `Ver en el vídeo (${mmss(s)})`}
                            className={`mt-0.5 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${s !== null ? "bg-[#C8A96B] font-semibold text-black hover:bg-[#d8bc82]" : "bg-white/10 text-white/55"}`}
                          >
                            {s !== null && <Play size={10} />}
                            {rotuloRef(a.ref) || "—"}
                          </button>
                          <input
                            value={a.texto}
                            onChange={(e) => cambiaApunte(a.id, { texto: e.target.value })}
                            aria-label="Apunte"
                            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none focus:bg-white/[0.04]"
                          />
                          {valor.video && (
                            <button
                              type="button"
                              onClick={() => {
                                const ahora = mandoRef.current?.ahora();

                                if (typeof ahora === "number") cambiaApunte(a.id, { enVideo: ahora });
                              }}
                              title={typeof a.enVideo === "number" ? `Marcado en ${mmss(a.enVideo)}: pulsa para volver a marcarlo aquí` : "Marcar aquí: este apunte salta al momento en que está ahora el vídeo"}
                              className={`shrink-0 rounded-md p-1 ${typeof a.enVideo === "number" ? "text-[#C8A96B]" : "text-white/35 hover:text-white"}`}
                            >
                              <Crosshair size={13} />
                            </button>
                          )}
                          <button type="button" onClick={() => quitaApunte(a.id)} aria-label="Quitar apunte" className="shrink-0 rounded-md p-1 text-white/25 opacity-0 hover:text-red-300 group-hover:opacity-100">
                            <Trash2 size={13} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ---------------- uno nuevo ---------------- */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs">
        <select value={nuevo.fase} onChange={(e) => setNuevo((n) => ({ ...n, fase: e.target.value as FaseAbp }))} aria-label="Fase" className="rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1.5 text-white">
          {FASES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.deQuien[deQuien]}
            </option>
          ))}
        </select>
        <select value={nuevo.tipo} onChange={(e) => setNuevo((n) => ({ ...n, tipo: e.target.value as TipoAbp }))} aria-label="Tipo" className="rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1.5 text-white">
          {TIPOS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.titulo}
            </option>
          ))}
        </select>
        <input
          value={nuevo.ref}
          onChange={(e) => setNuevo((n) => ({ ...n, ref: e.target.value }))}
          placeholder="26 o MIN 19.45"
          aria-label="Clip o minuto"
          className="w-28 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1.5 text-white"
        />
        <input
          value={nuevo.texto}
          onChange={(e) => setNuevo((n) => ({ ...n, texto: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && añade()}
          placeholder="Qué pasa (Enter para añadir)"
          aria-label="Apunte nuevo"
          className="min-w-[200px] flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1.5 text-white"
        />
        <Button icon={Plus} onClick={añade} disabled={!nuevo.texto.trim()}>
          Añadir
        </Button>
      </div>
    </section>
  );
}
