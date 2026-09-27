"use client";

/**
 * El análisis visual del rival, jornada a jornada.
 *
 * Lo comparten «ABP del Rival» (córners y faltas) y «Área del Rival» (centros
 * laterales): cambia el ámbito y, con él, las secciones. Por cada jornada hay
 * láminas que se dibujan aquí mismo, los vídeos y los PDF que trae la carpeta,
 * y lo que se concluye, que es lo que recoge el informe del microciclo.
 *
 * La carpeta no se lee desde el navegador: se pega la ruta y la recoge el
 * ordenador del club (`scripts/rival-carpeta.cjs` por el vigía), que es donde
 * está y donde hay ffmpeg para comprimir los vídeos antes de subirlos.
 */

import {
  Copy,
  FileDown,
  FileText,
  FolderInput,
  Loader2,
  Plus,
  Presentation,
  Trash2,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PizarraLamina, type OpcionJugador } from "@/components/rivals/analisis/PizarraLamina";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { apodo, descarga, pdfDeLienzos } from "@/lib/export/lienzos";
import { creaPptx } from "@/lib/export/pptx";
import {
  ANALISIS_KIND,
  ANALISIS_VACIO,
  type Ambito,
  analisisKey,
  type ClipAnalisis,
  clipsKey,
  type Lamina,
  laminaNueva,
  normalizaAnalisis,
  normalizaClips,
  nuevoIdAnalisis,
  ordenJornada,
  type RivalAnalisisDoc,
  type RivalClipsDoc,
  type SeccionId,
  seccionesDe,
  type TrabajoJornada,
} from "@/lib/rivals/analisis";
import { laminaImagen } from "@/lib/rivals/analisis-svg";
import { fichaDesdePlantilla, resolutorDeFichas } from "@/lib/rivals/analisis-fichas";
import { estadoEncargo, type Mantenimiento } from "@/lib/mantenimiento";
import { playerKey } from "@/lib/rivals/once";

type Props = {
  ambito: Ambito;
  equipo: string;
  /** Las filas de la hoja de plantillas rivales (todas; se filtran aquí). */
  plantilla: unknown;
  escudo?: string;
};

const TRABAJO_VACIO: TrabajoJornada = { laminas: [], notas: {} };

export function AnalisisRival({ ambito, equipo, plantilla, escudo }: Props) {
  const secciones = seccionesDe(ambito);

  /* -------------------------- documentos -------------------------- */

  const doc = useRemoteDoc<RivalAnalisisDoc>({
    key: analisisKey(equipo),
    kind: ANALISIS_KIND,
    fallback: ANALISIS_VACIO,
  });

  const analisis = useMemo(() => normalizaAnalisis(doc.value), [doc.value]);

  const { setValue } = doc;

  const [clips, setClips] = useState<RivalClipsDoc>({ jornadas: {} });

  /* Recargar es subir el testigo: el fetch vive dentro del efecto, que es la
     forma que admite el linter (ver `useRemoteDoc`). */
  const [testigoClips, setTestigoClips] = useState(0);

  const cargaClips = useCallback(() => setTestigoClips((n) => n + 1), []);

  useEffect(() => {
    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(clipsKey(equipo))}`, { cache: "no-store" })
      .then((respuesta) => respuesta.json())
      .then((json: { data?: unknown } | null) => {
        if (!cancelado) setClips(normalizaClips(json?.data));
      })
      .catch(() => {
        /* sin red: se queda lo que hubiera */
      });

    return () => {
      cancelado = true;
    };
  }, [equipo, testigoClips]);

  /* -------------------------- jornadas -------------------------- */

  const jornadas = useMemo(
    () =>
      [...new Set([...Object.keys(analisis.jornadas), ...Object.keys(clips.jornadas)])].sort(
        ordenJornada,
      ),
    [analisis.jornadas, clips.jornadas],
  );

  const [jornadaElegida, setJornadaElegida] = useState<string | null>(null);

  const jornada =
    jornadaElegida && (jornadas.includes(jornadaElegida) || analisis.jornadas[jornadaElegida])
      ? jornadaElegida
      : (jornadas[jornadas.length - 1] ?? jornadaElegida ?? "");

  const trabajo = analisis.jornadas[jornada] ?? TRABAJO_VACIO;
  const material = clips.jornadas[jornada] ?? { clips: [], docs: [], rutas: [] };

  const cambiaTrabajo = useCallback(
    (cambia: (actual: TrabajoJornada) => TrabajoJornada) => {
      if (!jornada) return;

      setValue((actual) => {
        const limpio = normalizaAnalisis(actual);

        return {
          ...limpio,
          jornadas: {
            ...limpio.jornadas,
            [jornada]: cambia(limpio.jornadas[jornada] ?? TRABAJO_VACIO),
          },
        };
      });
    },
    [jornada, setValue],
  );

  /* -------------------------- sección -------------------------- */

  const [seccion, setSeccion] = useState<SeccionId>(secciones[0].id);

  const laminas = trabajo.laminas.filter((l) => l.seccion === seccion);

  const [laminaElegida, setLaminaElegida] = useState<string | null>(null);

  const lamina = laminas.find((l) => l.id === laminaElegida) ?? laminas[0] ?? null;

  const cambiaLamina = useCallback(
    (nueva: Lamina) =>
      cambiaTrabajo((actual) => ({
        ...actual,
        laminas: actual.laminas.map((l) => (l.id === nueva.id ? nueva : l)),
      })),
    [cambiaTrabajo],
  );

  const anadeLamina = (base?: Lamina) => {
    const nueva: Lamina = base
      ? { ...base, id: nuevoIdAnalisis(), titulo: `${base.titulo} (COPIA)`, marcas: base.marcas.map((m) => ({ ...m, id: nuevoIdAnalisis() })) }
      : laminaNueva(seccion);

    cambiaTrabajo((actual) => ({ ...actual, laminas: [...actual.laminas, nueva] }));
    setLaminaElegida(nueva.id);
  };

  const quitaLamina = (id: string) => {
    if (!window.confirm("¿Quitar esta lámina? No se puede deshacer.")) return;

    cambiaTrabajo((actual) => ({ ...actual, laminas: actual.laminas.filter((l) => l.id !== id) }));
    setLaminaElegida(null);
  };

  /* -------------------------- fichas -------------------------- */

  const delEquipo = useMemo(() => {
    const filas = Array.isArray(plantilla) ? (plantilla as Record<string, unknown>[]) : [];

    return filas.filter((fila) => String(fila.NOMBRE_EQUIPO ?? "") === equipo);
  }, [plantilla, equipo]);

  const ficha = useMemo(() => resolutorDeFichas(plantilla, equipo), [plantilla, equipo]);

  const opciones: OpcionJugador[] = useMemo(
    () =>
      delEquipo
        .map((fila) => {
          const f = fichaDesdePlantilla(fila);

          return {
            clave: playerKey(fila),
            nombre: f.nombre,
            detalle: [String(fila["POSICIÓN"] ?? "").toLowerCase(), f.altura, f.pie.toLowerCase()]
              .filter(Boolean)
              .join(" · "),
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [delEquipo],
  );

  /* -------------------------- vídeos -------------------------- */

  const clipsSeccion = material.clips.filter((c) => c.seccion === seccion);

  const porPartido = useMemo(() => {
    const grupos = new Map<string, ClipAnalisis[]>();

    for (const clip of clipsSeccion) {
      const clave = clip.partido || "Sin partido";

      grupos.set(clave, [...(grupos.get(clave) ?? []), clip]);
    }

    return [...grupos.entries()];
  }, [clipsSeccion]);

  const [clipElegido, setClipElegido] = useState<string | null>(null);

  const clip = clipsSeccion.find((c) => c.id === clipElegido) ?? null;

  const docs = material.docs.filter((d) => d.ambito === ambito);

  /* -------------------------- carpeta -------------------------- */

  const [ruta, setRuta] = useState("");
  const [jornadaCarpeta, setJornadaCarpeta] = useState("");
  const [encargo, setEncargo] = useState<Mantenimiento["carpeta"] | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [testigoEncargo, setTestigoEncargo] = useState(0);

  const leeEncargo = useCallback(() => setTestigoEncargo((n) => n + 1), []);

  /* Cómo iba en la lectura anterior: al pasar de «trabajando» a terminado se
     recargan los vídeos una última vez. */
  const trabajaba = useRef(false);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/mantenimiento", { cache: "no-store" })
      .then((respuesta) => respuesta.json())
      .then((json: { estado?: Mantenimiento } | null) => {
        if (cancelado) return;

        const suyo = json?.estado?.carpeta ?? null;
        const estado = suyo ? estadoEncargo("carpeta", suyo) : "libre";
        const trabaja = estado === "pedido" || estado === "en-marcha";

        if (trabajaba.current && !trabaja) setTestigoClips((n) => n + 1);

        trabajaba.current = trabaja;
        setEncargo(suyo);
      })
      .catch(() => {
        /* sin red: se vuelve a mirar en la próxima vuelta */
      });

    return () => {
      cancelado = true;
    };
  }, [testigoEncargo]);

  const estadoCarpeta = encargo ? estadoEncargo("carpeta", encargo) : "libre";

  /* Mientras el ordenador del club trabaja, se mira cada cinco segundos y se
     recargan los vídeos para que vayan apareciendo según se suben. */
  useEffect(() => {
    if (estadoCarpeta !== "pedido" && estadoCarpeta !== "en-marcha") return;

    const temporizador = window.setInterval(() => {
      leeEncargo();
      cargaClips();
    }, 5_000);

    return () => window.clearInterval(temporizador);
  }, [cargaClips, estadoCarpeta, leeEncargo]);

  const pideCarpeta = async () => {
    if (!ruta.trim()) {
      toast.error("Pega la ruta de la carpeta de la jornada.");
      return;
    }

    setPidiendo(true);

    try {
      const respuesta = await fetch("/api/mantenimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tarea: "carpeta",
          ruta: ruta.trim(),
          equipo,
          jornada: jornadaCarpeta.trim().toUpperCase(),
        }),
      });

      const json = (await respuesta.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!respuesta.ok || !json?.ok) {
        toast.error(json?.error ?? "No se ha podido dejar el encargo.");
        return;
      }

      toast.success("Encargado: el ordenador del club lo recoge en unos segundos.");
      leeEncargo();
    } finally {
      setPidiendo(false);
    }
  };

  /* -------------------------- exportar -------------------------- */

  const [exportando, setExportando] = useState<"pdf" | "ppt" | null>(null);

  const laminasAmbito = useMemo(
    () =>
      secciones.flatMap((s) => trabajo.laminas.filter((l) => l.seccion === s.id)),
    [secciones, trabajo.laminas],
  );

  const exporta = async (formato: "pdf" | "ppt") => {
    if (!laminasAmbito.length || exportando) return;

    setExportando(formato);

    try {
      const imagenes: string[] = [];

      /* En serie: varias láminas de 1920 a la vez tumban la pestaña. */
      for (const una of laminasAmbito) {
        imagenes.push(await laminaImagen(una, { ficha, escudo }, { formato: "image/jpeg" }));
      }

      const nombre = apodo(`${jornada} ${equipo} ${ambito === "abp" ? "ABP" : "area"}`, "analisis");

      if (formato === "pdf") {
        const pdf = await pdfDeLienzos(imagenes, {
          ancho: 1920,
          alto: 1080,
          orientacion: "landscape",
          margen: 0,
        });

        descarga(pdf.output("blob"), `${nombre}.pdf`);
      } else {
        const blob = creaPptx(
          laminasAmbito.map((una, i) => ({ titulo: una.titulo, imagen: imagenes[i] })),
          {
            titulo: `${ambito === "abp" ? "Balón parado" : "Área"} · ${equipo} · ${jornada}`,
            aplicacion: "RMCF Castilla · Análisis del rival",
          },
        );

        descarga(blob, `${nombre}.pptx`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido exportar.");
    } finally {
      setExportando(null);
    }
  };

  /* -------------------------- nueva jornada -------------------------- */

  const [nuevaJornada, setNuevaJornada] = useState("");

  const creaJornada = () => {
    const limpia = nuevaJornada.trim().toUpperCase().replace(/^(\d+)$/, "J$1");

    if (!/^J\d{1,2}$/.test(limpia)) {
      toast.error("Escribe la jornada como «J6».");
      return;
    }

    setValue((actual) => {
      const limpio = normalizaAnalisis(actual);

      return limpio.jornadas[limpia]
        ? limpio
        : { ...limpio, jornadas: { ...limpio.jornadas, [limpia]: TRABAJO_VACIO } };
    });

    setJornadaElegida(limpia);
    setNuevaJornada("");
  };

  /* -------------------------- pintar -------------------------- */

  const cuentaSeccion = (id: SeccionId) => ({
    laminas: trabajo.laminas.filter((l) => l.seccion === id).length,
    clips: material.clips.filter((c) => c.seccion === id).length,
  });

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-b from-[#0E1F5B]/40 to-transparent p-4 md:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8A96B]">Análisis visual</p>
          <h2 className="text-lg font-semibold text-white">
            {ambito === "abp" ? "Balón parado" : "Área y centros laterales"} · {equipo}
          </h2>
          <p className="text-xs text-white/45">
            Láminas que se dibujan aquí, los clips de la carpeta de la jornada y lo que se concluye.
            {doc.status === "saving" ? " Guardando…" : doc.status === "error" ? " No se ha podido guardar." : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void exporta("pdf")}
            disabled={!laminasAmbito.length || Boolean(exportando)}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            {exportando === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} PDF
          </button>
          <button
            type="button"
            onClick={() => void exporta("ppt")}
            disabled={!laminasAmbito.length || Boolean(exportando)}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            {exportando === "ppt" ? <Loader2 size={14} className="animate-spin" /> : <Presentation size={14} />} PPT
          </button>
        </div>
      </header>

      {/* ------------------------ jornadas ------------------------ */}

      <div className="flex flex-wrap items-center gap-2">
        {jornadas.map((una) => (
          <button
            key={una}
            type="button"
            onClick={() => setJornadaElegida(una)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              una === jornada ? "bg-[#C8A96B] text-black" : "bg-white/[0.06] text-white/70 hover:bg-white/10"
            }`}
          >
            {una}
          </button>
        ))}

        <div className="flex items-center gap-1">
          <input
            value={nuevaJornada}
            onChange={(e) => setNuevaJornada(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && creaJornada()}
            placeholder="J6"
            className="w-16 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white"
          />
          <button
            type="button"
            onClick={creaJornada}
            className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1.5 text-xs text-white/70 hover:bg-white/10"
          >
            <Plus size={13} /> Jornada
          </button>
        </div>
      </div>

      {/* ------------------------ carpeta ------------------------ */}

      <details className="rounded-xl border border-white/10 bg-white/[0.03] p-3" open={!jornadas.length}>
        <summary className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
          <FolderInput size={15} className="text-[#C8A96B]" /> Recoger la carpeta de la jornada
          {estadoCarpeta === "pedido" || estadoCarpeta === "en-marcha" ? (
            <span className="ml-2 flex items-center gap-1 text-xs text-[#C8A96B]">
              <Loader2 size={12} className="animate-spin" />
              {estadoCarpeta === "pedido" ? "esperando al ordenador del club…" : "subiendo vídeos…"}
            </span>
          ) : encargo?.resultado ? (
            <span className={`ml-2 truncate text-xs ${encargo.ok ? "text-emerald-300/80" : "text-red-300/80"}`}>
              {encargo.resultado}
            </span>
          ) : null}
        </summary>

        <div className="mt-3 space-y-2">
          <p className="text-xs text-white/45">
            Pega la ruta de la carpeta tal y como se ve en el ordenador del club (por ejemplo{" "}
            <code className="text-white/70">C:\Users\Usuario\Downloads\VICTOR J5 AD ALCORCON</code>). Se recorre entera: los
            vídeos van a su sección por el nombre de la carpeta —«CORNER OFF», «CORNER DEF», «FALTA OFF», «FALTA DEF», o
            «CENTRO»; con «DEF» son los que defiende—, el partido sale de «VS …» y los PDF se guardan como documentos. Los
            vídeos se comprimen antes de subirlos y lo ya subido no se repite.
          </p>

          <div className="flex flex-wrap gap-2">
            <input
              value={ruta}
              onChange={(e) => setRuta(e.target.value)}
              placeholder="C:\Users\Usuario\Downloads\VICTOR J6 …"
              className="min-w-[260px] flex-1 rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-sm text-white"
            />
            <input
              value={jornadaCarpeta}
              onChange={(e) => setJornadaCarpeta(e.target.value)}
              placeholder="Jornada (si no la dice)"
              className="w-44 rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => void pideCarpeta()}
              disabled={pidiendo || estadoCarpeta === "pedido" || estadoCarpeta === "en-marcha"}
              className="flex items-center gap-1.5 rounded-lg bg-[#C8A96B] px-3 py-1.5 text-sm font-medium text-black disabled:opacity-40"
            >
              {pidiendo ? <Loader2 size={14} className="animate-spin" /> : <FolderInput size={14} />} Recoger
            </button>
          </div>
        </div>
      </details>

      {!jornada ? (
        <p className="text-sm text-white/45">
          Todavía no hay nada de este rival. Recoge la carpeta de la jornada o crea una jornada para empezar a dibujar.
        </p>
      ) : (
        <>
          {/* ------------------------ secciones ------------------------ */}

          <div className="flex flex-wrap gap-2">
            {secciones.map((s) => {
              const n = cuentaSeccion(s.id);

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSeccion(s.id);
                    setLaminaElegida(null);
                    setClipElegido(null);
                  }}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    s.id === seccion
                      ? "border-[#C8A96B]/60 bg-[#C8A96B]/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <span className="block text-sm font-medium text-white">{s.titulo}</span>
                  <span className="block text-[11px] text-white/45">
                    {s.lado === "ataca" ? "Cómo atacan" : "Cómo defienden"} · {n.laminas} lámina{n.laminas === 1 ? "" : "s"} · {n.clips} vídeo{n.clips === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* ------------------------ láminas ------------------------ */}

            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {laminas.map((una, i) => (
                  <button
                    key={una.id}
                    type="button"
                    onClick={() => setLaminaElegida(una.id)}
                    className={`max-w-[260px] truncate rounded-lg px-3 py-1.5 text-xs transition ${
                      una.id === lamina?.id ? "bg-white text-[#0E1F5B]" : "bg-white/[0.06] text-white/70 hover:bg-white/10"
                    }`}
                    title={una.titulo}
                  >
                    {i + 1}. {una.titulo || "Sin título"}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => anadeLamina()}
                  className="flex items-center gap-1 rounded-lg bg-[#C8A96B]/15 px-3 py-1.5 text-xs text-[#C8A96B] hover:bg-[#C8A96B]/25"
                >
                  <Plus size={13} /> Nueva lámina
                </button>

                {lamina && (
                  <>
                    <button
                      type="button"
                      onClick={() => anadeLamina(lamina)}
                      className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/10"
                    >
                      <Copy size={13} /> Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => quitaLamina(lamina.id)}
                      className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 size={13} /> Quitar
                    </button>
                  </>
                )}
              </div>

              {lamina ? (
                <PizarraLamina
                  lamina={lamina}
                  onChange={cambiaLamina}
                  ficha={ficha}
                  plantilla={opciones}
                  escudo={escudo}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/15 text-sm text-white/40">
                  No hay láminas en esta sección. «Nueva lámina» abre un campo en blanco para dibujar.
                </div>
              )}

              <label className="block text-[11px] uppercase tracking-wider text-white/40">
                Conclusión de la sección (va al informe)
                <textarea
                  value={trabajo.notas?.[seccion] ?? ""}
                  rows={2}
                  onChange={(e) =>
                    cambiaTrabajo((actual) => ({
                      ...actual,
                      notas: { ...actual.notas, [seccion]: e.target.value },
                    }))
                  }
                  placeholder="Lo que hay que saber de esta sección en dos líneas."
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-sm normal-case tracking-normal text-white"
                />
              </label>
            </div>

            {/* ------------------------ vídeos ------------------------ */}

            <aside className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/70">
                  <Video size={14} className="text-[#C8A96B]" /> Vídeos de la sección
                </p>

                {clip ? (
                  <div className="mb-3">
                    <video
                      key={clip.id}
                      src={clip.url}
                      controls
                      autoPlay
                      playsInline
                      className="aspect-video w-full rounded-lg bg-black"
                    />
                    <p className="mt-1 text-[11px] text-white/50">
                      {clip.partido} · {clip.nombre}
                    </p>
                  </div>
                ) : null}

                {porPartido.length === 0 ? (
                  <p className="text-xs text-white/40">
                    Sin vídeos. Llegan al recoger la carpeta de la jornada.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {porPartido.map(([partido, lista]) => (
                      <div key={partido}>
                        <p className="mb-1 text-[11px] uppercase tracking-wider text-white/40">{partido}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {lista.map((uno, i) => (
                            <button
                              key={uno.id}
                              type="button"
                              onClick={() => setClipElegido(uno.id)}
                              title={uno.nombre}
                              className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition ${
                                uno.id === clip?.id ? "bg-[#C8A96B] text-black" : "bg-white/[0.08] text-white/75 hover:bg-white/15"
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {docs.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/70">
                    <FileText size={14} className="text-[#C8A96B]" /> Informes de la carpeta
                  </p>
                  <ul className="space-y-1">
                    {docs.map((d) => (
                      <li key={d.id}>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate rounded-lg px-2 py-1 text-xs text-white/75 hover:bg-white/10"
                        >
                          {d.nombre}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
