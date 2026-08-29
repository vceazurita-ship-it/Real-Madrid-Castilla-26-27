"use client";

/**
 * Convertir el coding en vídeo.
 *
 * Aquí no se guardan marcas de tiempo: se llama a ffmpeg en el servidor y
 * salen ficheros. Tres salidas, que son las tres formas en las que el cuerpo
 * técnico usa un partido codificado:
 *
 * - **Un ZIP** con los cortes ordenados en carpetas por jugador, para dejarlos
 *   en la unidad compartida.
 * - **Un vídeo unificado** con todos los cortes pegados y la carátula del
 *   jugador delante: es el que se manda al jugador o se pone en la charla.
 * - **Un corte suelto**, desde la lista de clips.
 *
 * El vídeo del partido no se sube ni se copia: el servidor lee de la carpeta
 * de partidos, o de la URL, sólo los segundos de cada clip.
 */

import { useCallback, useState } from "react";
import {
  Eye,
  Film,
  Image as Icono,
  Package,
  PenTool,
  SkipForward,
  Snowflake,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/abp/ui";
import { descarga } from "@/lib/export/lienzos";
import {
  duracionClip,
  formateaTotal,
  nombreDeClip,
  rutaDeClip,
  type CategoriaCoding,
  type ClipCoding,
  type FuenteVideo,
} from "@/lib/coding/modelo";

export type ModoCorteUI = "preciso" | "rapido";

/** Segundos en `m:ss`, para el reloj del aviso. */
const reloj = (segundos: number) =>
  `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;

const megas = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : `${Math.round(bytes / 1024 ** 2)} MB`;

/**
 * Una pizarra quemada dentro del clip.
 *
 * `imagen` es el fotograma ya compuesto —vídeo con el dibujo encima, a la
 * resolución del vídeo— porque pintarlo sólo lo sabe hacer el navegador.
 */
export type ParadaDeClip = {
  imagen: string;
  /** Desde el principio del clip. */
  enMs: number;
  duracionMs: number;
};

/** Lo que la pantalla necesita saber para pedir una exportación. */
export type PeticionExport = {
  clips: ClipCoding[];
  formato: "clip" | "zip" | "unificado";
  nombre: string;
  /** Carátula en `data:` URL para el vídeo unificado. */
  portada?: string | null;
  /** Las pizarras de cada clip, por id de clip. */
  paradas?: Map<string, ParadaDeClip[]>;
};

export function useExportador(opciones: {
  fuente: FuenteVideo | null;
  categorias: CategoriaCoding[];
  carpeta: string;
  modo: ModoCorteUI;
}) {
  const { fuente, categorias, carpeta, modo } = opciones;

  const [exportando, setExportando] = useState(false);

  const exporta = useCallback(
    async (peticion: PeticionExport) => {
      if (exportando) return;

      if (!fuente) {
        toast.error("Elige antes el vídeo del partido.");
        return;
      }

      if (fuente.tipo === "local") {
        toast.error(
          "El vídeo está abierto desde tu ordenador y el servidor no puede leerlo. " +
            "Déjalo en la carpeta de partidos o usa un enlace para poder cortar.",
        );
        return;
      }

      if (peticion.clips.length === 0) {
        toast.error("No hay clips que exportar.");
        return;
      }

      setExportando(true);

      /*
      | El aviso lleva reloj, y no es un adorno.
      |
      | Cortar en `preciso` vuelve a codificar, y eso va a ~1 segundo por cada
      | segundo de vídeo: quince cortes de quince segundos son cuatro minutos
      | de pantalla quieta. Con un aviso fijo no hay forma de distinguir «está
      | trabajando» de «se ha colgado», que es exactamente lo que pasaba.
      */
      const segundosDeVideo = Math.round(
        peticion.clips.reduce((suma, clip) => suma + duracionClip(clip), 0) / 1000,
      );

      const faena =
        peticion.formato === "unificado"
          ? `Montando el vídeo de ${peticion.clips.length} cortes`
          : `Cortando ${peticion.clips.length} ${peticion.clips.length === 1 ? "clip" : "clips"}`;

      /* Con pizarras siempre se recodifica, aunque el modo diga `rapido`. */
      const conPizarras = (peticion.paradas?.size ?? 0) > 0;

      const previsto = modo === "rapido" && !conPizarras ? 0 : segundosDeVideo;

      const arranque = Date.now();

      const texto = (transcurrido: number) =>
        `${faena}… ${reloj(transcurrido)}${previsto > 20 ? ` de ~${reloj(previsto)}` : ""}`;

      const aviso = toast.loading(texto(0));

      const tic = setInterval(() => {
        toast.loading(texto(Math.round((Date.now() - arranque) / 1000)), {
          id: aviso,
        });
      }, 1000);

      try {
        const respuesta = await fetch("/api/coding/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fuente:
              fuente.tipo === "url"
                ? { tipo: "url", url: fuente.url }
                : { tipo: "archivo", ruta: fuente.ruta },
            modo,
            formato: peticion.formato,
            nombre: peticion.nombre,
            portada: peticion.portada ?? undefined,
            portadaSegundos: 4,
            clips: peticion.clips.map((clip) => ({
              nombre:
                peticion.formato === "zip"
                  ? rutaDeClip(clip, categorias, carpeta)
                      .replace(/\.mp4$/, "")
                      .replace(`${carpeta}/`, "")
                  : nombreDeClip(clip, categorias),
              inicioMs: clip.inicioMs,
              finMs: clip.finMs,
              pizarras: peticion.paradas?.get(clip.id),
            })),
          }),
        });

        if (!respuesta.ok) {
          const error = await respuesta.json().catch(() => null);

          throw new Error(error?.error ?? `El servidor respondió ${respuesta.status}`);
        }

        const blob = await respuesta.blob();

        const extension = peticion.formato === "zip" ? "zip" : "mp4";

        descarga(blob, `${peticion.nombre}.${extension}`);

        toast.success("Vídeo listo", {
          id: aviso,
          description: `${peticion.nombre}.${extension} · ${megas(blob.size)} · ${reloj(
            Math.round((Date.now() - arranque) / 1000),
          )}`,
        });
      } catch (error) {
        console.error("[coding] exportación", error);

        toast.error(
          error instanceof Error ? error.message : "No se ha podido exportar.",
          { id: aviso },
        );
      } finally {
        clearInterval(tic);
        setExportando(false);
      }
    },
    [carpeta, categorias, exportando, fuente, modo],
  );

  return { exporta, exportando };
}

/* ------------------------------------------------------------------ */
/*  LOS BOTONES                                                        */
/* ------------------------------------------------------------------ */

export function BarraExportacion({
  clips,
  etiqueta,
  exportando,
  modo,
  onModo,
  onZip,
  onUnificado,
  caratula,
  opcionesCaratula,
  onCaratula,
  onVerCaratula,
  vistaCaratula,
  onCerrarVista,
  pizarras,
  quema,
  onQuema,
}: {
  clips: ClipCoding[];
  /** Qué se va a exportar: "todos", "Sergio Mestre", "Pase"… */
  etiqueta: string;
  exportando: boolean;
  modo: ModoCorteUI;
  onModo: (modo: ModoCorteUI) => void;
  onZip: () => void;
  onUnificado: () => void;
  /** Id del sujeto de la carátula; `""` es sin carátula. */
  caratula: string;
  opcionesCaratula: { id: string; nombre: string }[];
  onCaratula: (id: string) => void;
  onVerCaratula: () => void;
  /** El PNG ya pintado, cuando se ha pedido verlo. */
  vistaCaratula: string | null;
  onCerrarVista: () => void;
  /** Cuántas pizarras caen dentro de lo que se va a exportar. */
  pizarras: number;
  quema: boolean;
  onQuema: (quema: boolean) => void;
}) {
  const total = clips.reduce((suma, clip) => suma + duracionClip(clip), 0);

  const nombreCaratula =
    opcionesCaratula.find((uno) => uno.id === caratula)?.nombre ?? "";

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon={Film}
          onClick={onUnificado}
          disabled={exportando || clips.length === 0}
          title={
            nombreCaratula
              ? `Todos los cortes pegados en un vídeo, con la carátula de ${nombreCaratula} delante`
              : "Todos los cortes pegados en un vídeo, sin carátula"
          }
        >
          Vídeo unificado
        </Button>

        <Button
          icon={Package}
          onClick={onZip}
          disabled={exportando || clips.length === 0}
          title="Un fichero por corte, en carpetas por jugador"
        >
          Clips sueltos (ZIP)
        </Button>

        <span className="text-[11px] text-white/35">
          {clips.length} {clips.length === 1 ? "clip" : "clips"} ·{" "}
          {formateaTotal(total)} · {etiqueta}
        </span>
      </div>

      {/* ------------------------- LAS PIZARRAS ----------------------- */}

      {pizarras > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
            <PenTool size={12} className="text-[#C8A96B]" />
            Pizarras
          </span>

          <button
            type="button"
            onClick={() => onQuema(!quema)}
            title="El vídeo se para en cada pizarra, se ve el dibujo y sigue limpio"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
              quema
                ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                : "border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {quema ? <Snowflake size={12} /> : <SkipForward size={12} />}
            {quema ? "Dentro del vídeo" : "Fuera"}
          </button>

          <span className="text-[11px] text-white/35">
            {quema
              ? `${pizarras} ${pizarras === 1 ? "parada" : "paradas"}: el vídeo se detiene, se ve lo pintado y sigue`
              : `${pizarras} sin quemar: el vídeo sale como se grabó`}
          </span>
        </div>
      )}

      {/* ------------------------- LA CARÁTULA ------------------------ */}

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
          <Icono size={12} className="text-[#C8A96B]" />
          Carátula
        </span>

        <select
          value={caratula}
          onChange={(evento) => onCaratula(evento.target.value)}
          aria-label="De quién es la carátula"
          className="min-w-0 max-w-[15rem] rounded-full border border-white/10 bg-[#0B0F14] px-2.5 py-1 text-[11px] text-white outline-none transition focus:border-[#C8A96B]/50"
        >
          <option value="">Sin carátula</option>

          {opcionesCaratula.map((uno) => (
            <option key={uno.id} value={uno.id}>
              {uno.nombre}
            </option>
          ))}
        </select>

        <Button
          icon={Eye}
          onClick={onVerCaratula}
          disabled={!caratula}
          title="Pintarla y verla antes de montar el vídeo"
        >
          Ver
        </Button>

        <span className="text-[11px] text-white/35">
          {caratula
            ? "Abre el vídeo unificado, 4 s, con la plantilla del club"
            : "El vídeo empieza directo en el primer corte"}
        </span>
      </div>

      {vistaCaratula && (
        <div className="min-w-0 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vistaCaratula}
            alt={`Carátula de ${nombreCaratula}`}
            className="w-full rounded-lg"
          />

          <div className="flex justify-end">
            <Button icon={X} onClick={onCerrarVista}>
              Cerrar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/30">
          Corte
        </span>

        {(
          [
            ["preciso", "Preciso", "Vuelve a codificar: empieza en el fotograma exacto."],
            ["rapido", "Rápido", "Copia sin recodificar: instantáneo, pero corta en el fotograma clave más cercano."],
          ] as const
        ).map(([valor, texto, ayuda]) => (
          <button
            key={valor}
            type="button"
            title={ayuda}
            onClick={() => onModo(valor)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              modo === valor
                ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                : "border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}
