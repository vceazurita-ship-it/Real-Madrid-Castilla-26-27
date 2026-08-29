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
 * **Y el partido que está en el ordenador se monta aquí, en el navegador.**
 * Ése el servidor no lo ve —el navegador no dice dónde está— y subirlo no es
 * una opción: son gigas, y con la app desplegada el cuerpo de una petición no
 * pasa de 4,5 MB. Como el navegador ya lo tiene abierto, hace el montaje él
 * mismo (`lib/coding/navegador.ts`): mismas tres salidas, mismas pizarras
 * quemadas, misma carátula, y sin pedirle nada al servidor. Es el único camino
 * que funciona igual en esta máquina y en Vercel.
 *
 * Llevar el vídeo a la carpeta de partidos sigue estando —es lo mejor cuando
 * la app corre en la misma máquina que el partido: ffmpeg no va a tiempo real—
 * pero ya no es el único camino ni hace falta para exportar.
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
  Upload,
  X,
  SquarePlay as Youtube,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/abp/ui";
import { NOMBRE_PRIVACIDAD } from "@/lib/coding/youtube-cliente";
import { descarga } from "@/lib/export/lienzos";
import {
  borraImagenes,
  pesaDemasiado,
  preparaImagenes,
} from "@/lib/coding/imagenes";
import { llevaVideoALaCarpeta, srcDeCarpeta } from "@/lib/coding/importa";
import {
  cortaEnElNavegador,
  CORTE_CANCELADO,
  puedeCortarAqui,
} from "@/lib/coding/navegador";
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

/**
 * El error del servidor cuando no llega en JSON.
 *
 * Un 413 no lo escribe la aplicación: lo pone el despliegue cuando el cuerpo
 * de la petición pasa de 4,5 MB, y el mensaje que devuelve no es JSON. Sin
 * esto, lo que veía el analista era «El servidor respondió 413», que no dice
 * ni qué pasa ni qué hacer.
 */
const explica = (estado: number) =>
  estado === 413
    ? "La petición pesa demasiado para el servidor: las imágenes de la " +
      "carátula y las pizarras no han podido subirse por separado. Prueba " +
      "otra vez, o exporta sin quemar las pizarras."
    : `El servidor respondió ${estado}`;

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
  /** Carátula del vídeo unificado, tal y como la pinta el navegador. */
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
  /** Los fotogramas por segundo de la sesión: el montaje del navegador graba a ellos. */
  fps?: number;
  /** El partido, para la pantalla del montaje. */
  titulo?: string;
  /** Adoptar el vídeo ya copiado: cambia la fuente de la sesión. */
  onAdopta?: (fuente: FuenteVideo, src: string) => void;
  /**
   * Qué hacer con el vídeo recién montado, además de descargarlo.
   *
   * Es por donde entra la subida a YouTube. Se llama con el fichero ya en el
   * ordenador del analista y **sólo con vídeos**: el ZIP de cortes sueltos no
   * es una cosa que se suba a ningún canal. Que falle no puede tumbar la
   * exportación —el vídeo ya está descargado—, así que quien lo implemente se
   * come sus propios errores.
   */
  alTerminarVideo?: (blob: Blob, nombre: string) => Promise<void> | void;
}) {
  const {
    fuente,
    categorias,
    carpeta,
    modo,
    ficheroLocal,
    fps,
    titulo,
    onAdopta,
    alTerminarVideo,
  } = opciones;

  const [exportando, setExportando] = useState(false);

  /*
  | Cómo se llama cada corte. Vive aparte porque lo usan los dos caminos —el
  | servidor y el navegador— y un nombre distinto en cada uno sería un ZIP con
  | otras carpetas según dónde se haya cortado.
  */
  const nombraClips = useCallback(
    (peticion: PeticionExport) =>
      peticion.clips.map((clip) => ({
        clip,
        nombre:
          peticion.formato === "zip"
            ? rutaDeClip(clip, categorias, carpeta)
                .replace(/\.mp4$/, "")
                .replace(`${carpeta}/`, "")
            : nombreDeClip(clip, categorias),
      })),
    [carpeta, categorias],
  );

  /*
  | ------------------------------------------- EL MONTAJE EN EL NAVEGADOR
  |
  | El partido abierto del ordenador se corta **aquí**, sin servidor.
  |
  | Es el único camino que funciona igual en esta máquina y con la app
  | desplegada: el fichero no sale del disco, así que no hay techo de subida
  | que valga ni función que se acabe a los 300 s. Lo hace todo
  | `lib/coding/navegador.ts`, que además pone su propia pantalla con la
  | cuenta y el botón de cancelar —va a tiempo real, y eso hay que verlo—.
  */
  const montaAqui = useCallback(
    async (peticion: PeticionExport, fichero: File) => {
      setExportando(true);

      try {
        const resultado = await cortaEnElNavegador({
          fichero,
          titulo: titulo ? `${titulo} · ${peticion.nombre}` : peticion.nombre,
          formato: peticion.formato,
          portada: peticion.portada ?? null,
          portadaSegundos: 4,
          fps,
          clips: nombraClips(peticion).map(({ clip, nombre }) => ({
            nombre,
            inicioMs: clip.inicioMs,
            finMs: clip.finMs,
            paradas: peticion.paradas?.get(clip.id),
          })),
        });

        const nombre = `${peticion.nombre}.${resultado.extension}`;

        descarga(resultado.blob, nombre);

        toast.success("Vídeo listo", {
          description: `${nombre} · ${megas(resultado.blob.size)} · ${reloj(
            resultado.segundos,
          )}${
            resultado.vecesReal && resultado.vecesReal >= 1.5
              ? ` · ×${resultado.vecesReal} más rápido que el vídeo`
              : ""
          }${resultado.conSonido ? "" : " · sin sonido: el partido viene mudo"}`,
        });

        if (peticion.formato !== "zip") {
          await alTerminarVideo?.(resultado.blob, nombre);
        }
      } catch (error) {
        if (error instanceof Error && error.message === CORTE_CANCELADO) {
          toast("Montaje cancelado", {
            description: "El coding y las pizarras se quedan como estaban.",
          });

          return;
        }

        console.error("[coding] montaje en el navegador", error);

        toast.error(
          error instanceof Error ? error.message : "No se ha podido montar el vídeo.",
        );
      } finally {
        setExportando(false);
      }
    },
    [alTerminarVideo, fps, nombraClips, titulo],
  );

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

      const texto = (transcurrido: number) =>
        `${faena}… ${reloj(transcurrido)}${previsto > 20 ? ` de ~${reloj(previsto)}` : ""}`;

      const aviso = toast.loading("Preparando la exportación…");

      /* Lo subido al bucket, para dejarlo limpio pase lo que pase. */
      let rutas: string[] = [];

      /* El reloj del corte arranca cuando arranca el corte, no antes. */
      let arranque = Date.now();
      let tic: ReturnType<typeof setInterval> | undefined;

      try {
        /*
        | La carátula y las pizarras **no van dentro de la petición**.
        |
        | Son fotogramas a la resolución del partido, y metidos en el JSON se
        | pasan de los 4,5 MB que aguanta el cuerpo de una petición en el
        | despliegue: eso era el 413 que salía al exportar, antes incluso de
        | que el servidor mirara nada. Suben sueltas y aquí sólo viaja el
        | enlace. Ver `lib/coding/imagenes.ts`.
        */
        const imagenes = await preparaImagenes({
          portada: peticion.portada,
          paradas: peticion.paradas,
          onProgreso: (hechas, total) => {
            toast.loading(`Subiendo las imágenes… ${hechas} de ${total}`, {
              id: aviso,
            });
          },
        });

        rutas = imagenes.rutas;

        const cuerpo = JSON.stringify({
          fuente: fuenteServidor,
          modo,
          formato: peticion.formato,
          nombre: peticion.nombre,
          portada: imagenes.portada,
          portadaSegundos: 4,
          clips: nombraClips(peticion).map(({ clip, nombre }) => ({
            nombre,
            inicioMs: clip.inicioMs,
            finMs: clip.finMs,
            pizarras: imagenes.paradas.get(clip.id),
          })),
        });

        /* Si alguna imagen no ha podido subir, que se sepa aquí y por qué. */
        const grande = pesaDemasiado(cuerpo);

        if (grande) throw new Error(grande);

        arranque = Date.now();

        toast.loading(texto(0), { id: aviso });

        tic = setInterval(() => {
          toast.loading(texto(Math.round((Date.now() - arranque) / 1000)), {
            id: aviso,
          });
        }, 1000);

        const respuesta = await fetch("/api/coding/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: cuerpo,
        });

        if (!respuesta.ok) {
          const error = await respuesta.json().catch(() => null);

          throw new Error(error?.error ?? explica(respuesta.status));
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

        if (peticion.formato !== "zip") {
          await alTerminarVideo?.(blob, `${peticion.nombre}.${extension}`);
        }
      } catch (error) {
        console.error("[coding] exportación", error);

        toast.error(
          error instanceof Error ? error.message : "No se ha podido exportar.",
          { id: aviso },
        );
      } finally {
        if (tic) clearInterval(tic);
        setExportando(false);

        /* Las imágenes eran de usar y tirar: no se quedan en el bucket. */
        void borraImagenes(rutas);
      }
    },
    [alTerminarVideo, modo, nombraClips],
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

      if (peticion.clips.length === 0) {
        toast.error("No hay clips que exportar.");
        return;
      }

      /*
      | El fichero del ordenador se monta aquí mismo, y manda sobre la sesión.
      |
      | Es lo que hay que hacer con la app desplegada —el servidor no lo ve, y
      | subir un partido de varios gigas no existe— y lo que hace que el coding
      | entero funcione desde cualquier sitio con el partido en el portátil.
      |
      | Se mira **el fichero de la pestaña antes que la fuente guardada**: el
      | documento de la sesión llega después de pintar y su clave cambia cuando
      | acaba de cargar el calendario, así que quien abre el vídeo nada más
      | entrar puede tenerlo reproduciéndose sin que la sesión se haya
      | enterado. Con el fichero delante hay vídeo que montar, diga lo que diga
      | el documento.
      */
      if (ficheroLocal && (!fuente || fuente.tipo === "local")) {
        if (puedeCortarAqui()) {
          await montaAqui(peticion, ficheroLocal);

          return;
        }

        /* Sin grabadora en el navegador queda el camino de siempre. */
        toast.error("Este navegador no sabe montar el vídeo", {
          description:
            "Ábrelo en Chrome o en Edge y se monta aquí mismo. Si la app corre " +
            `en esta máquina, la otra vía es llevar «${ficheroLocal.name}» ` +
            `(${megas(ficheroLocal.size)}) a la carpeta de partidos: no sale a ` +
            "internet, se copia aquí al lado y la exportación sigue al terminar.",
          duration: 20000,
          action: {
            label: "Llevarlo",
            onClick: () => void llevaYExporta(peticion, ficheroLocal),
          },
        });

        return;
      }

      if (!fuente) {
        toast.error("Elige antes el vídeo del partido.");
        return;
      }

      /* Quedó guardado que era un fichero del ordenador, pero ya no está. */
      if (fuente.tipo === "local") {
        toast.error("Hay que volver a abrir el vídeo", {
          description:
            "Está en tu ordenador y al recargar la página el navegador pierde " +
            "el permiso sobre él. Ábrelo otra vez en «El vídeo» —el coding y " +
            "las pizarras siguen donde estaban— y ya se puede montar.",
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
    [exportando, ficheroLocal, fuente, lanza, llevaYExporta, montaAqui],
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
  enNavegador,
  youtube,
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
  /** La carátula ya pintada, cuando se ha pedido verla. */
  vistaCaratula: string | null;
  onCerrarVista: () => void;
  /** Cuántas pizarras caen dentro de lo que se va a exportar. */
  pizarras: number;
  quema: boolean;
  onQuema: (quema: boolean) => void;
  /**
   * El vídeo está abierto del ordenador: el montaje se hace aquí.
   *
   * Cambia lo que se puede elegir, no sólo el texto: `preciso`/`rápido` son
   * dos formas de llamar a ffmpeg y en el navegador no significan nada —se
   * graba lo que se reproduce, siempre a tiempo real—.
   */
  enNavegador: boolean;
  /**
   * La cuenta de YouTube, si es que hay una conectada.
   *
   * Se enseña aquí y no sólo en su panel porque es una decisión del momento de
   * exportar: el vídeo del rival para la charla se sube, y el corte que se
   * está probando no.
   */
  youtube?: {
    conectado: boolean;
    subeSiempre: boolean;
    privacidad: keyof typeof NOMBRE_PRIVACIDAD;
    listaNombre: string;
    onSube: (sube: boolean) => void;
  };
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

      {/* --------------------------- YOUTUBE --------------------------- */}

      {/*
      | Sólo cuando hay cuenta conectada.
      |
      | Sin cuenta esto sería una fila muerta en la barra que más se usa de la
      | pantalla: quien quiera conectarla la tiene en su panel, ahí al lado.
      */}
      {youtube?.conectado && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
            <Youtube size={12} className="text-[#C8A96B]" />
            YouTube
          </span>

          <button
            type="button"
            onClick={() => youtube.onSube(!youtube.subeSiempre)}
            title="El vídeo se descarga igual: esto es además de la descarga"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
              youtube.subeSiempre
                ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                : "border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {youtube.subeSiempre ? <Upload size={12} /> : <X size={12} />}
            {youtube.subeSiempre ? "Se sube al terminar" : "No se sube"}
          </button>

          <span className="text-[11px] text-white/35">
            {youtube.subeSiempre
              ? `En ${NOMBRE_PRIVACIDAD[youtube.privacidad]}${
                  youtube.listaNombre ? ` · lista «${youtube.listaNombre}»` : " · sin lista"
                }`
              : "Sólo se descarga al ordenador"}
          </span>
        </div>
      )}

      {/* --------------------------- EL CORTE -------------------------- */}

      {enNavegador ? (
        <p className="rounded-lg border border-[#C8A96B]/25 bg-[#C8A96B]/[0.06] px-3 py-2 text-[11px] leading-relaxed text-white/55">
          <span className="text-[#C8A96B]">Se monta aquí, en tu navegador.</span>{" "}
          El partido no se sube a ningún sitio: sale del fichero que tienes
          abierto. Sale en <span className="text-white/75">.mp4</span> con
          sonido, a la calidad y a los fotogramas del partido, y tarda bastante
          menos de lo que dura el vídeo —no hay que reproducirlo—. Se ve
          mientras se hace y se puede cancelar. Si el fichero no se deja leer
          así (un .mkv, un códec raro), se graba a tiempo real: {formateaTotal(total)}
          , y entonces sale en .webm.
        </p>
      ) : (
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
      )}
    </div>
  );
}
