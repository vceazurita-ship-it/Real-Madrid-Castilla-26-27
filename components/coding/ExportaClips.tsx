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
 *
 * La excepción es el fichero abierto del ordenador. Ése el servidor no lo ve
 * —el navegador no dice dónde está—, así que antes de cortar hay que llevarlo
 * a la carpeta de partidos. Lo ofrece la propia exportación, con su barra de
 * progreso, y al terminar sigue con el corte que se había pedido: el analista
 * pulsa exportar una vez, no dos.
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
import { llevaVideoALaCarpeta, srcDeCarpeta } from "@/lib/coding/importa";
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

/** El vídeo tal y como lo entiende el servidor: una ruta de la carpeta o una URL. */
type FuenteServidor =
  | { tipo: "url"; url: string }
  | { tipo: "archivo"; ruta: string };

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
  /**
   * El fichero que se abrió del ordenador, mientras siga a mano.
   *
   * Vive en la pestaña y no en la sesión: un navegador no puede guardar el
   * permiso sobre un fichero del disco, así que al recargar se pierde y hay
   * que volver a abrirlo. Sin él no se puede llevar el vídeo a la carpeta.
   */
  ficheroLocal?: File | null;
  /** Adoptar el vídeo ya copiado: cambia la fuente de la sesión. */
  onAdopta?: (fuente: FuenteVideo, src: string) => void;
}) {
  const { fuente, categorias, carpeta, modo, ficheroLocal, onAdopta } = opciones;

  const [exportando, setExportando] = useState(false);

  /*
  | El corte de verdad, con el vídeo ya resuelto.
  |
  | Recibe la fuente **por parámetro** y no del estado a propósito: cuando se
  | acaba de copiar el partido a la carpeta, la sesión todavía no se ha
  | enterado —ese cambio llega en el siguiente render— y la exportación tiene
  | que salir ya con la ruta nueva, no con la que se quedó en el cierre.
  */
  const lanza = useCallback(
    async (peticion: PeticionExport, fuenteServidor: FuenteServidor) => {
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
            fuente: fuenteServidor,
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
    [carpeta, categorias, modo],
  );

  /*
  | Llevar el partido a la carpeta y seguir con lo que se había pedido.
  |
  | No se hace solo al pulsar exportar: son varios gigas de copia y varios
  | minutos, así que se pregunta. Lo dispara el botón del aviso.
  */
  const llevaYExporta = useCallback(
    async (peticion: PeticionExport, fichero: File) => {
      setExportando(true);

      const copiando = (fraccion: number) =>
        `Llevando «${fichero.name}» a la carpeta… ${Math.round(fraccion * 100)} %`;

      const aviso = toast.loading(copiando(0));

      try {
        const { ruta, nombre } = await llevaVideoALaCarpeta(
          fichero,
          (fraccion) => {
            toast.loading(copiando(fraccion), { id: aviso });
          },
        );

        toast.success("El vídeo ya está en la carpeta de partidos", {
          id: aviso,
          description: `${nombre} · el coding y las pizarras se quedan como están.`,
        });

        onAdopta?.({ tipo: "archivo", ruta, nombre }, srcDeCarpeta(ruta));

        setExportando(false);

        await lanza(peticion, { tipo: "archivo", ruta });
      } catch (error) {
        console.error("[coding] llevar el vídeo a la carpeta", error);

        toast.error(
          error instanceof Error
            ? error.message
            : "No se ha podido llevar el vídeo a la carpeta.",
          { id: aviso },
        );

        setExportando(false);
      }
    },
    [lanza, onAdopta],
  );

  const exporta = useCallback(
    async (peticion: PeticionExport) => {
      if (exportando) return;

      if (!fuente) {
        toast.error("Elige antes el vídeo del partido.");
        return;
      }

      if (peticion.clips.length === 0) {
        toast.error("No hay clips que exportar.");
        return;
      }

      /*
      | El fichero del ordenador ya no es un final de trayecto: se ofrece
      | copiarlo a la carpeta de partidos —que está en esta misma máquina— y la
      | exportación sigue sola en cuanto termine la copia.
      */
      if (fuente.tipo === "local") {
        if (!ficheroLocal) {
          toast.error("El servidor no puede leer este vídeo", {
            description:
              "Está abierto desde tu ordenador y al recargar la página se " +
              "pierde el permiso sobre él. Vuelve a abrirlo en «El vídeo» y " +
              "se podrá llevar a la carpeta de partidos.",
          });

          return;
        }

        toast.error("El servidor todavía no tiene este vídeo", {
          description:
            `Hay que llevar «${fuente.nombre}» (${megas(ficheroLocal.size)}) a la ` +
            "carpeta de partidos para poder cortarlo. No sale a internet: se " +
            "copia en esta misma máquina, y la exportación sigue al terminar.",
          duration: 20000,
          action: {
            label: "Llevarlo",
            onClick: () => void llevaYExporta(peticion, ficheroLocal),
          },
        });

        return;
      }

      await lanza(
        peticion,
        fuente.tipo === "url"
          ? { tipo: "url", url: fuente.url }
          : { tipo: "archivo", ruta: fuente.ruta },
      );
    },
    [exportando, ficheroLocal, fuente, lanza, llevaYExporta],
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
