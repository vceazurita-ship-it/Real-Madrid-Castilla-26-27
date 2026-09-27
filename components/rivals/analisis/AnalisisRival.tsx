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
  ChevronLeft,
  ChevronRight,
  Copy,
  FileDown,
  FileText,
  FileUp,
  FolderInput,
  Loader2,
  Pencil,
  Plus,
  Presentation,
  SkipBack,
  SkipForward,
  Trash2,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PizarraLamina, type OpcionJugador } from "@/components/rivals/analisis/PizarraLamina";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { apodo, descarga, pdfDeLienzos } from "@/lib/export/lienzos";
import { creaPptx } from "@/lib/export/pptx";
import { estadoEncargo, type Mantenimiento } from "@/lib/mantenimiento";
import {
  ANALISIS_KIND,
  ANALISIS_VACIO,
  type Ambito,
  analisisKey,
  type ClipAnalisis,
  clipsKey,
  type Lamina,
  jornadaDeTexto,
  laminaNueva,
  laminaVacia,
  normalizaAnalisis,
  normalizaClips,
  nuevoIdAnalisis,
  ordenJornada,
  type RivalAnalisisDoc,
  type RivalClipsDoc,
  SECCION_POR_ID,
  type SeccionId,
  seccionesDe,
  type TrabajoJornada,
} from "@/lib/rivals/analisis";
import { fichaDesdePlantilla, resolutorDeFichas } from "@/lib/rivals/analisis-fichas";
import { laminaImagen } from "@/lib/rivals/analisis-svg";
import { importaPdfAnalisis, type LaminaImportada, type PdfLib } from "@/lib/rivals/importa-pdf";
import { playerKey } from "@/lib/rivals/once";

type Props = {
  ambito: Ambito;
  equipo: string;
  /** Las filas de la hoja de plantillas rivales (todas; se filtran aquí). */
  plantilla: unknown;
  escudo?: string;
};

const TRABAJO_VACIO: TrabajoJornada = { laminas: [], notas: {} };

/** La última carpeta que se pegó: la de la jornada siguiente se le parece. */
const ULTIMA_RUTA = "rmcf-analisis-rival:ruta";

function leeLocal(clave: string) {
  try {
    return window.localStorage.getItem(clave) ?? "";
  } catch {
    return "";
  }
}

function guardaLocal(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    /* modo privado: se pierde al cerrar */
  }
}

const boton =
  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40";

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
      ? {
          ...base,
          id: nuevoIdAnalisis(),
          titulo: `${base.titulo} (COPIA)`,
          marcas: base.marcas.map((m) => ({ ...m, id: nuevoIdAnalisis() })),
        }
      : laminaNueva(seccion);

    cambiaTrabajo((actual) => ({ ...actual, laminas: [...actual.laminas, nueva] }));
    setLaminaElegida(nueva.id);
  };

  /* Quitar no pregunta: avisa y deja deshacer, que es más rápido y más seguro
     que un «¿seguro?» que se acepta sin leer. */
  const quitaLamina = (id: string) => {
    const indice = trabajo.laminas.findIndex((l) => l.id === id);
    const quitada = trabajo.laminas[indice];

    if (!quitada) return;

    cambiaTrabajo((actual) => ({ ...actual, laminas: actual.laminas.filter((l) => l.id !== id) }));
    setLaminaElegida(null);

    toast(`Lámina «${quitada.titulo || "sin título"}» quitada`, {
      action: {
        label: "Deshacer",
        onClick: () => {
          cambiaTrabajo((actual) => {
            const lista = [...actual.laminas];

            lista.splice(Math.min(indice, lista.length), 0, quitada);

            return { ...actual, laminas: lista };
          });
          setLaminaElegida(quitada.id);
        },
      },
    });
  };

  /** Cambia de sitio una lámina entre las de su misma sección. */
  const mueveLamina = (id: string, paso: -1 | 1) => {
    cambiaTrabajo((actual) => {
      const lista = [...actual.laminas];
      const i = lista.findIndex((l) => l.id === id);

      if (i < 0) return actual;

      const hermanas = lista
        .map((l, k) => ({ l, k }))
        .filter(({ l }) => l.seccion === lista[i].seccion);

      const posicion = hermanas.findIndex(({ k }) => k === i);
      const otra = hermanas[posicion + paso];

      if (!otra) return actual;

      [lista[i], lista[otra.k]] = [lista[otra.k], lista[i]];

      return { ...actual, laminas: lista };
    });
  };

  const cambiaSeccionLamina = (id: string, destino: SeccionId) => {
    cambiaTrabajo((actual) => ({
      ...actual,
      laminas: actual.laminas.map((l) => (l.id === id ? { ...l, seccion: destino } : l)),
    }));
    setSeccion(destino);
    setLaminaElegida(id);
    toast.success(`Lámina pasada a «${SECCION_POR_ID.get(destino)?.titulo ?? destino}».`);
  };

  /* -------------------------- renombrar -------------------------- */

  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");

  /*
  | Cerrar la caja dispara también su «blur»: sin esta marca, Esc cerraba sin
  | guardar y acto seguido el blur guardaba lo escrito igualmente.
  */
  const renombreCerrado = useRef(true);

  const empiezaRenombrar = (una: Lamina) => {
    renombreCerrado.current = false;
    setLaminaElegida(una.id);
    setRenombrando(una.id);
    setNombreNuevo(una.titulo);
  };

  const acabaRenombrar = (guardar: boolean) => {
    if (renombreCerrado.current) return;

    renombreCerrado.current = true;

    const id = renombrando;

    setRenombrando(null);

    if (!guardar || !id) return;

    const limpio = nombreNuevo.trim().toUpperCase();

    if (!limpio) return;

    const actual = trabajo.laminas.find((l) => l.id === id);

    if (actual && actual.titulo !== limpio) cambiaLamina({ ...actual, titulo: limpio });
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

  /* En el orden en que se ven en la lista: así «siguiente» es el de al lado. */
  const clipsEnOrden = useMemo(() => porPartido.flatMap(([, lista]) => lista), [porPartido]);

  const [clipElegido, setClipElegido] = useState<string | null>(null);
  const [seguidos, setSeguidos] = useState(false);

  const indiceClip = clipsEnOrden.findIndex((c) => c.id === clipElegido);
  const clip = indiceClip >= 0 ? clipsEnOrden[indiceClip] : null;

  const saltaClip = (paso: -1 | 1) => {
    const siguiente = clipsEnOrden[indiceClip + paso];

    if (siguiente) setClipElegido(siguiente.id);
  };

  const numeroEnPartido = (uno: ClipAnalisis) =>
    (porPartido.find(([partido]) => partido === (uno.partido || "Sin partido"))?.[1].indexOf(uno) ?? 0) + 1;

  const docs = material.docs.filter((d) => d.ambito === ambito);

  /* -------------------------- carpeta -------------------------- */

  const [ruta, setRuta] = useState(() => (typeof window === "undefined" ? "" : leeLocal(ULTIMA_RUTA)));
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
  const carpetaOcupada = estadoCarpeta === "pedido" || estadoCarpeta === "en-marcha";

  /* Mientras el ordenador del club trabaja, se mira cada cinco segundos y se
     recargan los vídeos para que vayan apareciendo según se suben. */
  useEffect(() => {
    if (!carpetaOcupada) return;

    const temporizador = window.setInterval(() => {
      leeEncargo();
      cargaClips();
    }, 5_000);

    return () => window.clearInterval(temporizador);
  }, [cargaClips, carpetaOcupada, leeEncargo]);

  const pideCarpeta = async () => {
    const limpia = ruta.trim().replace(/^"+|"+$/g, "");

    if (!limpia) {
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
          ruta: limpia,
          equipo,
          jornada: jornadaCarpeta.trim().toUpperCase(),
        }),
      });

      const json = (await respuesta.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!respuesta.ok || !json?.ok) {
        toast.error(json?.error ?? "No se ha podido dejar el encargo.");
        return;
      }

      guardaLocal(ULTIMA_RUTA, limpia);
      toast.success("Encargado: el ordenador del club lo recoge en unos segundos.");
      leeEncargo();
    } finally {
      setPidiendo(false);
    }
  };

  /* -------------------------- importar un PDF -------------------------- */

  /*
  | Para las jornadas que no se preparan aquí: el informe hecho en PowerPoint y
  | pasado a PDF se lee (`lib/rivals/importa-pdf.ts`) y sus diapositivas se
  | convierten en láminas. Antes de añadir nada se enseña lo que se ha
  | encontrado en cada una, para elegir.
  */
  type Propuesta = LaminaImportada & { elegida: boolean; repetida: boolean };

  const [importacion, setImportacion] = useState<{
    origen: string;
    destino: string;
    laminas: Propuesta[];
    saltadas: number[];
  } | null>(null);
  const [leyendoPdf, setLeyendoPdf] = useState(false);
  const entradaPdf = useRef<HTMLInputElement | null>(null);

  const leePdf = async (obtener: () => Promise<ArrayBuffer>, origen: string) => {
    if (leyendoPdf) return;

    setLeyendoPdf(true);

    try {
      const pdfjs = await import("pdfjs-dist");

      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const resultado = await importaPdfAnalisis(pdfjs as unknown as PdfLib, await obtener(), delEquipo);

      if (!resultado.laminas.length) {
        toast.error(
          "No he encontrado ninguna lámina en ese PDF. Tiene que ser un informe con el campo de la plantilla del club y un título que diga córner, falta o centros.",
        );
        return;
      }

      const destino = jornada || jornadaDeTexto(origen) || "";

      const existe = (propuesta: LaminaImportada) =>
        (analisis.jornadas[destino]?.laminas ?? []).some(
          (l) => l.seccion === propuesta.lamina.seccion && l.titulo === propuesta.lamina.titulo,
        );

      setImportacion({
        origen,
        destino,
        saltadas: resultado.saltadas,
        laminas: resultado.laminas.map((propuesta) => ({
          ...propuesta,
          repetida: existe(propuesta),
          elegida: !existe(propuesta),
        })),
      });
    } catch (error) {
      console.error("[analisis] importar PDF", error);
      toast.error("No se ha podido leer el PDF. ¿Está bien el archivo?");
    } finally {
      setLeyendoPdf(false);
    }
  };

  const aplicaImportacion = () => {
    if (!importacion) return;

    const destino = importacion.destino.trim().toUpperCase().replace(/^(\d+)$/, "J$1");

    if (!/^J\d{1,2}$/.test(destino)) {
      toast.error("Di a qué jornada van, como «J6».");
      return;
    }

    const elegidas = importacion.laminas.filter((p) => p.elegida).map((p) => p.lamina);

    if (!elegidas.length) {
      toast.error("No hay ninguna lámina marcada.");
      return;
    }

    setValue((actual) => {
      const limpio = normalizaAnalisis(actual);
      const previo = limpio.jornadas[destino] ?? TRABAJO_VACIO;

      return {
        ...limpio,
        jornadas: { ...limpio.jornadas, [destino]: { ...previo, laminas: [...previo.laminas, ...elegidas] } },
      };
    });

    const aqui = elegidas.filter((l) => SECCION_POR_ID.get(l.seccion)?.ambito === ambito);
    const fuera = elegidas.length - aqui.length;

    setJornadaElegida(destino);

    if (aqui[0]) {
      setSeccion(aqui[0].seccion);
      setLaminaElegida(aqui[0].id);
    }

    setImportacion(null);

    toast.success(
      `${elegidas.length} lámina${elegidas.length === 1 ? "" : "s"} añadida${elegidas.length === 1 ? "" : "s"} a la ${destino}${
        fuera ? ` (${fuera} en ${ambito === "abp" ? "Área del Rival" : "ABP del Rival"})` : ""
      }. Revísalas en la pizarra.`,
    );
  };

  /* -------------------------- exportar -------------------------- */

  const [exportando, setExportando] = useState<"pdf" | "ppt" | null>(null);
  const [alcance, setAlcance] = useState<"lamina" | "jornada">("jornada");

  /* Sólo las que tienen algo: una diapositiva con el campo vacío sobra. */
  const laminasJornada = useMemo(
    () =>
      secciones.flatMap((s) => trabajo.laminas.filter((l) => l.seccion === s.id && !laminaVacia(l))),
    [secciones, trabajo.laminas],
  );

  const aExportar = alcance === "lamina" ? (lamina ? [lamina] : []) : laminasJornada;

  const exporta = async (formato: "pdf" | "ppt") => {
    if (!aExportar.length || exportando) return;

    setExportando(formato);

    try {
      const diapositivas: { titulo: string; imagen: string }[] = [];


      /* En serie: varias láminas de 1920 a la vez tumban la pestaña. */
      for (const una of aExportar) {
        diapositivas.push({
          titulo: una.titulo,
          imagen: await laminaImagen(una, { ficha, escudo, equipo, jornada }, { formato: "image/jpeg" }),
        });
      }


      const imagenes = diapositivas.map((una) => una.imagen);

      const base =
        alcance === "lamina" && lamina
          ? `${jornada} ${equipo} ${lamina.titulo}`
          : `${jornada} ${equipo} ${ambito === "abp" ? "ABP" : "area"}`;

      const nombre = apodo(base, "analisis");

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
          diapositivas,
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

  const posicion = lamina ? laminas.findIndex((l) => l.id === lamina.id) : -1;

  const estadoGuardado =
    doc.status === "saving"
      ? "Guardando…"
      : doc.status === "error"
        ? "No se ha podido guardar"
        : doc.status === "offline"
          ? "Sin conexión: se guarda al volver"
          : doc.lastSavedAt
            ? "Guardado"
            : "";

  return (
    <section className="space-y-4 rounded-2xl border border-[#C8A96B]/20 bg-white/[0.03] p-4 md:p-5">
      <input
        ref={entradaPdf}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];

          e.target.value = "";

          if (archivo) void leePdf(() => archivo.arrayBuffer(), archivo.name.replace(/\.pdf$/i, ""));
        }}
      />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#C8A96B]">Análisis visual</p>
          <h2 className="text-lg font-semibold text-white">
            {ambito === "abp" ? "Balón parado" : "Área y centros laterales"} · {equipo}
          </h2>
          <p className="text-xs text-white/45">
            Láminas que se dibujan aquí, los clips de la carpeta de la jornada y lo que se concluye.
            {estadoGuardado && (
              <span className={doc.status === "error" ? " text-red-300" : " text-white/60"}> · {estadoGuardado}</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 p-0.5 text-[11px]" role="group" aria-label="Qué se exporta">
            {(["lamina", "jornada"] as const).map((uno) => (
              <button
                key={uno}
                type="button"
                onClick={() => setAlcance(uno)}
                className={`rounded-md px-2.5 py-1 transition ${
                  alcance === uno ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                {uno === "lamina" ? "Esta lámina" : `Toda la ${jornada || "jornada"} (${laminasJornada.length})`}
              </button>
            ))}
          </div>



          <button
            type="button"
            onClick={() => void exporta("pdf")}
            disabled={!aExportar.length || Boolean(exportando)}
            className={`${boton} border border-white/15 text-white/80 hover:bg-white/10`}
          >
            {exportando === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} PDF
          </button>
          <button
            type="button"
            onClick={() => void exporta("ppt")}
            disabled={!aExportar.length || Boolean(exportando)}
            className={`${boton} border border-white/15 text-white/80 hover:bg-white/10`}
          >
            {exportando === "ppt" ? <Loader2 size={14} className="animate-spin" /> : <Presentation size={14} />} PPT
          </button>
        </div>
      </header>

      {/* ------------------------ jornadas ------------------------ */}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-white/35">Jornada</span>

        {jornadas.map((una) => (
          <button
            key={una}
            type="button"
            onClick={() => {
              setJornadaElegida(una);
              setLaminaElegida(null);
              setClipElegido(null);
            }}
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
            aria-label="Jornada nueva"
            className="w-16 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1.5 text-xs text-white"
          />
          <button type="button" onClick={creaJornada} className={`${boton} bg-white/[0.06] text-white/70 hover:bg-white/10`}>
            <Plus size={13} /> Jornada
          </button>
        </div>
      </div>

      {/* ------------------------ carpeta ------------------------ */}

      <details className="group rounded-xl border border-white/10 bg-white/[0.03] p-3" open={!jornadas.length || carpetaOcupada}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-white/80">
          <FolderInput size={15} className="text-[#C8A96B]" /> Recoger la carpeta de la jornada
          <ChevronRight size={14} className="text-white/35 transition group-open:rotate-90" />
          {carpetaOcupada ? (
            <span className="ml-2 flex items-center gap-1 text-xs text-[#C8A96B]">
              <Loader2 size={12} className="animate-spin" />
              {estadoCarpeta === "pedido"
                ? "esperando al ordenador del club…"
                : `subiendo vídeos… (${material.clips.length} ya en la ${jornada || "jornada"})`}
            </span>
          ) : encargo?.resultado ? (
            <span className={`ml-2 truncate text-xs ${encargo.ok ? "text-emerald-300/80" : "text-red-300"}`}>
              {encargo.resultado}
            </span>
          ) : null}
        </summary>

        <div className="mt-3 space-y-2">
          <p className="text-xs text-white/45">
            Pega la ruta de la carpeta tal y como se ve en el ordenador del club (en el Explorador: clic derecho sobre
            la carpeta → «Copiar como ruta de acceso»). Se recorre entera: los vídeos van a su sección por el nombre de
            la carpeta —«CORNER OFF», «CORNER DEF», «FALTA OFF», «FALTA DEF», o «CENTRO»; con «DEF» son los que
            defiende—, el partido sale de «VS …» y los PDF se guardan como documentos. Los vídeos se comprimen antes de
            subirlos y lo ya subido no se repite.
          </p>

          <div className="flex flex-wrap gap-2">
            <input
              value={ruta}
              onChange={(e) => setRuta(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void pideCarpeta()}
              placeholder="C:\Users\Usuario\Downloads\VICTOR J6 …"
              aria-label="Ruta de la carpeta"
              className="min-w-[260px] flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-sm text-white"
            />
            <input
              value={jornadaCarpeta}
              onChange={(e) => setJornadaCarpeta(e.target.value)}
              placeholder="Jornada (si la carpeta no la dice)"
              aria-label="Jornada de la carpeta"
              className="w-56 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => void pideCarpeta()}
              disabled={pidiendo || carpetaOcupada}
              className="flex items-center gap-1.5 rounded-lg bg-[#C8A96B] px-3 py-1.5 text-sm font-medium text-black disabled:opacity-40"
            >
              {pidiendo ? <Loader2 size={14} className="animate-spin" /> : <FolderInput size={14} />} Recoger
            </button>
          </div>

          {material.rutas.length > 0 && (
            <p className="text-[11px] text-white/35">
              Ya recogido en la {jornada}: {material.rutas.join(" · ")}
              {material.importadoEn ? ` (última subida ${new Date(material.importadoEn).toLocaleString("es-ES")})` : ""}
            </p>
          )}
        </div>
      </details>

      {!jornada ? (
        <p className="text-sm text-white/45">
          Todavía no hay nada de este rival. Recoge la carpeta de la jornada o crea una jornada para empezar a dibujar.
        </p>
      ) : (
        <>
          {/* ------------------------ secciones ------------------------ */}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                  <span className="mt-0.5 flex gap-2 text-[11px] text-white/45">
                    <span className={n.laminas ? "text-[#C8A96B]" : ""}>
                      {n.laminas} lámina{n.laminas === 1 ? "" : "s"}
                    </span>
                    ·
                    <span className={n.clips ? "text-[#C8A96B]" : ""}>
                      {n.clips} vídeo{n.clips === 1 ? "" : "s"}
                    </span>
                    {trabajo.notas?.[s.id]?.trim() ? <span>· con conclusión</span> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* ------------------------ láminas ------------------------ */}

            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">

                {laminas.map((una, i) =>
                  renombrando === una.id ? (
                    <input
                      key={una.id}
                      value={nombreNuevo}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setNombreNuevo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") acabaRenombrar(true);
                        if (e.key === "Escape") acabaRenombrar(false);
                      }}
                      onBlur={() => acabaRenombrar(true)}
                      aria-label="Nombre de la lámina"
                      className="w-72 rounded-lg border border-[#C8A96B]/60 bg-white/[0.06] px-3 py-1.5 text-xs uppercase text-white outline-none"
                    />
                  ) : (
                    <button
                      key={una.id}
                      type="button"
                      onClick={() => {
                        setLaminaElegida(una.id);
                      }}
                      onDoubleClick={() => empiezaRenombrar(una)}
                      className={`group/lamina flex max-w-[300px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
                        una.id === lamina?.id
                          ? "bg-[#C8A96B] text-black"
                          : "bg-white/[0.06] text-white/70 hover:bg-white/10"
                      }`}
                      title={`${una.titulo} · doble clic para renombrar`}
                    >
                      <span className="truncate">
                        {i + 1}. {una.titulo || "Sin título"}
                      </span>
                      {una.id === lamina?.id && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Renombrar la lámina"
                          onClick={(e) => {
                            e.stopPropagation();
                            empiezaRenombrar(una);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && empiezaRenombrar(una)}
                          className="rounded p-0.5 text-black/60 hover:bg-black/10"
                        >
                          <Pencil size={12} />
                        </span>
                      )}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  onClick={() => anadeLamina()}
                  className={`${boton} bg-[#C8A96B]/15 text-[#C8A96B] hover:bg-[#C8A96B]/25`}
                >
                  <Plus size={13} /> Nueva lámina
                </button>

                <button
                  type="button"
                  onClick={() => entradaPdf.current?.click()}
                  disabled={leyendoPdf}
                  title="Convierte en láminas un informe hecho fuera (PowerPoint pasado a PDF)"
                  className={`${boton} bg-white/[0.06] text-white/75 hover:bg-white/10`}
                >
                  {leyendoPdf ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />} Importar PDF
                </button>
              </div>

              {importacion && (
                <div className="space-y-3 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/[0.06] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      «{importacion.origen}»: {importacion.laminas.length} lámina
                      {importacion.laminas.length === 1 ? "" : "s"} encontrada{importacion.laminas.length === 1 ? "" : "s"}
                      {importacion.saltadas.length > 0 && (
                        <span className="font-normal text-white/50">
                          {" "}
                          · se saltan las páginas {importacion.saltadas.join(", ")} (sin campo: portada, cierre…)
                        </span>
                      )}
                    </p>

                    <label className="flex items-center gap-1.5 text-xs text-white/60">
                      A la jornada
                      <input
                        value={importacion.destino}
                        onChange={(e) => setImportacion({ ...importacion, destino: e.target.value })}
                        placeholder="J6"
                        aria-label="Jornada a la que van"
                        className="w-16 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-xs text-white"
                      />
                    </label>
                  </div>

                  <ul className="space-y-1.5">
                    {importacion.laminas.map((propuesta, i) => {
                      const destino = SECCION_POR_ID.get(propuesta.lamina.seccion);
                      const otraArea = destino && destino.ambito !== ambito;

                      return (
                        <li key={propuesta.lamina.id}>
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={propuesta.elegida}
                              onChange={(e) =>
                                setImportacion({
                                  ...importacion,
                                  laminas: importacion.laminas.map((p, k) => (k === i ? { ...p, elegida: e.target.checked } : p)),
                                })
                              }
                            />
                            <span className="min-w-0 text-xs">
                              <span className="block font-medium text-white">
                                Pág. {propuesta.pagina} · {propuesta.lamina.titulo}
                              </span>
                              <span className="block text-white/55">
                                → {destino?.titulo}
                                {otraArea ? ` (en ${destino?.ambito === "abp" ? "ABP del Rival" : "Área del Rival"})` : ""} ·{" "}
                                {propuesta.cuenta.cruces} cruces · {propuesta.cuenta.balones} balones · {propuesta.cuenta.rotulos} rótulos ·{" "}
                                {propuesta.cuenta.jugadores} jugadores
                              </span>
                              {propuesta.sinCasar.length > 0 && (
                                <span className="block text-[#C8A96B]">
                                  Sin encontrar en la plantilla: {propuesta.sinCasar.join(", ")} (salen sin foto; se pueden cambiar en la lámina)
                                </span>
                              )}
                              {propuesta.repetida && (
                                <span className="block text-[#C8A96B]">
                                  Ya hay una lámina con este título en la {importacion.destino}: desmarcada para no duplicarla.
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setImportacion(null)}
                      className={`${boton} bg-white/[0.06] text-white/75 hover:bg-white/10`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={aplicaImportacion}
                      disabled={!importacion.laminas.some((p) => p.elegida)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#C8A96B] px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
                    >
                      <FileUp size={13} /> Añadir {importacion.laminas.filter((p) => p.elegida).length} a la{" "}
                      {importacion.destino || "jornada"}
                    </button>
                  </div>
                </div>
              )}

              {lamina && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => empiezaRenombrar(lamina)}
                    className={`${boton} bg-white/[0.06] text-white/75 hover:bg-white/10`}
                  >
                    <Pencil size={13} /> Renombrar
                  </button>
                  <button
                    type="button"
                    onClick={() => anadeLamina(lamina)}
                    className={`${boton} bg-white/[0.06] text-white/75 hover:bg-white/10`}
                  >
                    <Copy size={13} /> Duplicar
                  </button>
                  <button
                    type="button"
                    disabled={posicion <= 0}
                    onClick={() => mueveLamina(lamina.id, -1)}
                    className={`${boton} bg-white/[0.06] text-white/75 hover:bg-white/10`}
                    title="Antes"
                  >
                    <ChevronLeft size={13} /> Antes
                  </button>
                  <button
                    type="button"
                    disabled={posicion < 0 || posicion >= laminas.length - 1}
                    onClick={() => mueveLamina(lamina.id, 1)}
                    className={`${boton} bg-white/[0.06] text-white/75 hover:bg-white/10`}
                    title="Después"
                  >
                    Después <ChevronRight size={13} />
                  </button>

                  <label className="flex items-center gap-1.5 text-xs text-white/50">
                    Pasar a
                    <select
                      value={lamina.seccion}
                      onChange={(e) => cambiaSeccionLamina(lamina.id, e.target.value as SeccionId)}
                      className="rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-xs text-white"
                    >
                      {secciones.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.titulo}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => quitaLamina(lamina.id)}
                    className={`${boton} ml-auto bg-red-500/10 text-red-300 hover:bg-red-500/20`}
                  >
                    <Trash2 size={13} /> Quitar
                  </button>
                </div>
              )}

              {lamina ? (
                <PizarraLamina
                  lamina={lamina}
                  onChange={cambiaLamina}
                  ficha={ficha}
                  plantilla={opciones}
                  escudo={escudo}
                  equipo={equipo}
                  jornada={jornada}
                />
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#C8A96B]/30 bg-[#081524]/60 text-center">
                  <p className="text-sm text-white/55">
                    No hay láminas de «{SECCION_POR_ID.get(seccion)?.titulo}» en la {jornada}.
                  </p>
                  <button
                    type="button"
                    onClick={() => anadeLamina()}
                    className="flex items-center gap-1.5 rounded-lg bg-[#C8A96B] px-4 py-2 text-sm font-medium text-black"
                  >
                    <Plus size={15} /> Crear la primera lámina
                  </button>
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
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-2 text-sm normal-case tracking-normal text-white"
                />
              </label>
            </div>

            {/* ------------------------ vídeos ------------------------ */}

            <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-white/70">
                    <Video size={14} className="text-[#C8A96B]" /> Vídeos de la sección
                    {clipsEnOrden.length > 0 && <span className="text-white/35">({clipsEnOrden.length})</span>}
                  </p>

                  {clipsEnOrden.length > 1 && (
                    <label className="flex items-center gap-1 text-[11px] text-white/50" title="Al acabar un clip empieza el siguiente">
                      <input type="checkbox" checked={seguidos} onChange={(e) => setSeguidos(e.target.checked)} />
                      Seguidos
                    </label>
                  )}
                </div>

                {clip ? (
                  <div className="mb-3">
                    <video
                      key={clip.id}
                      src={clip.url}
                      controls
                      autoPlay
                      playsInline
                      onEnded={() => seguidos && saltaClip(1)}
                      className="aspect-video w-full rounded-lg bg-black"
                    />
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => saltaClip(-1)}
                        disabled={indiceClip <= 0}
                        className={`${boton} bg-white/[0.06] text-white/75 hover:bg-white/10`}
                        aria-label="Clip anterior"
                      >
                        <SkipBack size={13} />
                      </button>
                      <p className="min-w-0 truncate text-center text-[11px] text-white/55">
                        {clip.partido} · clip {numeroEnPartido(clip)} · {indiceClip + 1}/{clipsEnOrden.length}
                      </p>
                      <button
                        type="button"
                        onClick={() => saltaClip(1)}
                        disabled={indiceClip >= clipsEnOrden.length - 1}
                        className={`${boton} bg-white/[0.06] text-white/75 hover:bg-white/10`}
                        aria-label="Clip siguiente"
                      >
                        <SkipForward size={13} />
                      </button>
                    </div>
                  </div>
                ) : clipsEnOrden.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setClipElegido(clipsEnOrden[0].id)}
                    className="mb-3 flex aspect-video w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.06] text-xs text-white/60 hover:text-white"
                  >
                    <Video size={16} /> Ver el primero
                  </button>
                ) : null}

                {porPartido.length === 0 ? (
                  <p className="text-xs text-white/40">
                    Sin vídeos en esta sección. Llegan al recoger la carpeta de la jornada.
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
                                uno.id === clip?.id ? "bg-[#C8A96B] text-black" : "bg-white/10 text-white/75 hover:bg-white/15"
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
                      <li key={d.id} className="flex items-center gap-1">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-xs text-white/75 hover:bg-white/10"
                        >
                          {d.nombre}
                        </a>
                        {/\.pdf($|\?)/i.test(d.url) && (
                          <button
                            type="button"
                            disabled={leyendoPdf}
                            onClick={() =>
                              void leePdf(async () => {
                                const respuesta = await fetch(d.url);

                                if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

                                return respuesta.arrayBuffer();
                              }, d.nombre)
                            }
                            title="Convertir sus diapositivas en láminas"
                            className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-[#C8A96B] hover:bg-[#C8A96B]/10 disabled:opacity-40"
                          >
                            Pasar a láminas
                          </button>
                        )}
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
