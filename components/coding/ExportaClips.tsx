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
  Maximize2,
  Package,
  PenTool,
  SkipForward,
  Snowflake,
  Type,
  Upload,
  X,
  SquarePlay as Youtube,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/abp/ui";
import { NotaPlegable } from "@/components/coding/piezas";
import { NOMBRE_PRIVACIDAD } from "@/lib/coding/youtube-cliente";
import { descarga, descargaDataUrl } from "@/lib/export/lienzos";
import { VERTICAL } from "@/lib/coding/vertical";
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
  SUJETO_VIDEO_COMPLETO,
  duracionClip,
  formateaTotal,
  nombreDeClip,
  rutaDeClip,
  type CategoriaCoding,
  type ClipCoding,
  type DescriptorCoding,
  type FuenteVideo,
} from "@/lib/coding/modelo";
import {
  cargaEscudoRotulo,
  imagenDeRotulo,
  rotuloDeClip,
} from "@/lib/coding/rotulo";
import { posterDeVideo } from "@/lib/coding/poster";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

export type ModoCorteUI = "preciso" | "rapido";

/**
 * Los topes de peso que se ofrecen, en megas.
 *
 * Los 50 son los que pidió el cuerpo técnico —es lo que entra en un grupo de
 * WhatsApp sin que lo recomprima nadie— y salen de partida. Los 16 son para
 * un correo del club; los 200, para llevarse el unificado sin castigarlo.
 */
export const PESOS = [0, 16, 50, 100, 200];

/**
 * El tope de partida: **ninguno**.
 *
 * Venía puesto en 50 MB —lo que cabe en un grupo de WhatsApp— y eso hacía que
 * *todos* los cortes salieran apretados sin que nadie lo pidiera. La cuenta es
 * implacable: el tope se reparte entre lo que dura el vídeo, así que un corte
 * de cuarenta segundos aguantaba bien pero uno de tres minutos bajaba a unos
 * 2 Mb/s y un montaje de diez a menos de uno. Sobre hierba y con la cámara
 * abierta eso es exactamente donde se ve: el césped se emborrona y el número
 * de la espalda deja de leerse, que es para lo que se hace el corte.
 *
 * Ahora sale con la calidad del partido y quien vaya a mandarlo por WhatsApp
 * elige el tope en la barra, que sigue ahí con sus 16, 50, 100 y 200 MB.
 */
export const TOPE_MEGAS_POR_DEFECTO = 0;

/**
 * Las medidas de imagen que se ofrecen, de mayor a menor.
 *
 * `0` es **la del partido**: si se grabó en 4K, el corte sale en 4K. Antes
 * no era una opción sino una regla escondida —todo lo que pasara de 1920 se
 * bajaba a 1920 sin decir nada—, y eso se notaba justo donde no se puede
 * perder: el número de la espalda y el balón lejos. Las otras dos están para
 * cuando lo que importa es que el fichero viaje.
 */
export const MEDIDAS = [
  { px: 0, nombre: "La del partido" },
  { px: 1920, nombre: "1080p" },
  { px: 1280, nombre: "720p" },
  { px: VERTICAL, nombre: "Vertical 9:16" },
];

/*
| Cuántos rótulos se mandan ya pintados al servidor.
|
| Cada uno es un PNG de unos 20 KB: cien caben de sobra en los 4,5 MB de la
| petición. Por encima, el servidor los pinta él con su respaldo.
*/
const ROTULOS_PINTADOS_MAX = 120;

/** La medida de partida: la del partido, sin tocar nada. */
export const MEDIDA_POR_DEFECTO = 0;

/** Peso y medida de cada destino, para no tener que pensarlo en megas. */
const DESTINOS = [
  {
    nombre: "WhatsApp",
    megas: 16,
    medida: 1280,
    explica: "720p y como mucho 16 MB por fichero: lo que WhatsApp manda sin recomprimir",
  },
  {
    nombre: "Correo o grupo",
    megas: 50,
    medida: 1920,
    explica: "1080p y como mucho 50 MB por fichero",
  },
  {
    nombre: "Sala o YouTube",
    megas: 0,
    medida: 0,
    explica: "Con la imagen del partido y sin tope: para el proyector o para subirlo",
  },
  {
    nombre: "Móvil vertical",
    megas: 16,
    medida: VERTICAL,
    explica:
      "1080 × 1920 y como mucho 16 MB: el corte a todo el ancho con su propia imagen desenfocada detrás, para verlo en el teléfono",
  },
];

/**
 * Lo que va a pesar y el caudal que le toca, antes de pulsar.
 *
 * Con tope, el tope se reparte entre lo que dura: sale **un solo fichero** con
 * ese caudal, no varios. Sin tope no se puede saber —pesa lo que pida la
 * imagen— y no se inventa una cifra.
 */
export function pesoPrevisto(topeMegas: number, segundos: number) {
  if (topeMegas <= 0 || segundos <= 0) return null;

  const caudal = Math.max(0.4, (topeMegas * 8 * 0.94) / segundos - 0.16);

  return `Sale en un fichero de hasta ${topeMegas} MB · ${caudal.toLocaleString("es-ES", {
    maximumFractionDigits: 1,
  })} Mb/s para ${Math.floor(segundos / 60)}:${String(Math.round(segundos % 60)).padStart(2, "0")}`;
}

/** Lo que dura una carátula en pantalla. */
export const SEGUNDOS_CARATULA = 4;

/**
 * «Una carátula por jugador», en el desplegable de la carátula.
 *
 * Es un valor imposible como identificador de sujeto —lleva asteriscos— para
 * que no pueda chocar con el id de un jugador ni con el de un comportamiento.
 */
export const CARATULA_POR_JUGADOR = "*por-jugador*";

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
    ? `${(bytes / 1024 ** 3).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`
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
  /** Para el rótulo: qué descriptores se leen y cómo («Mal» → «A corregir»). */
  descriptores?: DescriptorCoding[];
  carpeta: string;
  modo: ModoCorteUI;
  /**
   * Lo que puede pesar cada fichero que salga, en megas. `0` es sin tope.
   *
   * Vale igual en los dos caminos —el navegador y ffmpeg— porque el tope no
   * se aplica recortando nada: se convierte en caudal y se le da al
   * codificador. Un corte pesa lo mismo se haya hecho donde se haya hecho.
   */
  topeMegas?: number;
  /**
   * El ancho máximo de la imagen. `0` —lo normal— es la del partido.
   *
   * Sólo lo mira el camino del navegador: el del servidor nunca ha encogido
   * nada, corta con la imagen que traía el fichero.
   */
  topeAncho?: number;
  /**
   * El fichero que se abrió del ordenador, mientras siga a mano.
   *
   * Vive en la pestaña y no en la sesión: un navegador no puede guardar el
   * permiso sobre un fichero del disco, así que al recargar se pierde y hay
   * que volver a abrirlo. Sin él no se puede llevar el vídeo a la carpeta.
   */
  ficheroLocal?: File | null;
  /**
   * Todos los vídeos de la sesión, para los cortes que vengan de otro.
   *
   * La exportación junta los cortes de todos los vídeos subidos, y cada uno
   * se lee del suyo: del fichero abierto si está en `ficheros`, o de la
   * carpeta o del enlace si el vídeo está ahí.
   */
  videos?: FuenteVideo[];
  /** Los ficheros abiertos del ordenador, por nombre de vídeo. */
  ficheros?: Record<string, File>;
  /** Los fotogramas por segundo de la sesión: el montaje del navegador graba a ellos. */
  fps?: number;
  /** El partido, para la pantalla del montaje. */
  titulo?: string;
  /**
   * Un rótulo al empezar cada corte: quién, qué y en qué minuto
   * (`lib/coding/rotulo.ts`). Vale para los tres caminos.
   */
  rotulos?: boolean;
  /** La letra del rótulo en el navegador (`FAMILIA_PORTADA`). */
  familiaRotulo?: string;
  /** Fundido a negro entre cortes del unificado, en ms. `0`, corte seco. */
  fundidoMs?: number;
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
    descriptores,
    carpeta,
    modo,
    topeMegas = 0,
    topeAncho = 0,
    ficheroLocal,
    videos,
    ficheros,
    fps,
    titulo,
    rotulos = false,
    familiaRotulo,
    fundidoMs = 0,
    onAdopta,
    alTerminarVideo,
  } = opciones;

  const [exportando, setExportando] = useState(false);

  /* El último MP4 que ha salido, para «Mandar». El ZIP no cuenta. */
  const [ultimo, setUltimo] = useState<VideoListo | null>(null);

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
  | El rótulo de cada corte, o nada. El corte «Vídeo completo» no lo lleva:
  | no es una jugada de nadie, es el partido.
  */
  const rotuloDe = useCallback(
    (clip: ClipCoding) =>
      rotulos && clip.jugadorId !== SUJETO_VIDEO_COMPLETO.id
        ? rotuloDeClip(clip, categorias, descriptores)
        : undefined,
    [categorias, descriptores, rotulos],
  );

  /*
  | La carátula también como póster: la imagen que va en el correo o en el
  | PDF con el enlace al vídeo. Es la misma que abre el montaje, así que el
  | enlace y el vídeo empiezan igual.
  */
  /*
  | Y TODO MP4 lleva el suyo. Sólo lo tenía el unificado con carátula; un
  | corte suelto o un unificado sin carátula salían sin imagen que poner junto
  | al enlace. Esos se quedan con un fotograma del propio vídeo, con el rótulo
  | ya entrado (`lib/coding/poster.ts`). El ZIP no: es un paquete de cortes,
  | no una pieza que se mande.
  */
  /*
  | Se saca ANTES de descargar el vídeo, no a la vez: leer el fotograma del
  | mismo fichero mientras el navegador lo está guardando dejaba la descarga
  | del MP4 a medias (se quedaba en «.crdownload» y nunca terminaba).
  */
  const preparaPoster = useCallback(
    async (peticion: PeticionExport, video?: Blob) => {
      if (peticion.formato === "zip") return null;

      if (peticion.formato === "unificado" && peticion.portada) return peticion.portada;

      return video ? await posterDeVideo(video) : null;
    },
    [],
  );

  const descargaPoster = useCallback(
    async (peticion: PeticionExport, imagen: string | null) => {
      if (!imagen) return;

      try {
        await descargaDataUrl(imagen, `${peticion.nombre}-poster.jpg`);
      } catch (error) {
        console.warn("[coding] el póster no se ha podido guardar", error);
      }
    },
    [],
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
    async (
      peticion: PeticionExport,
      fichero: Blob,
      /** El fichero de cada corte, cuando no todos salen del mismo vídeo. */
      ficheroDe?: (clip: ClipCoding) => Blob | undefined,
    ) => {
      setExportando(true);

      try {
        /* Sin la letra descargada, el lienzo pinta el rótulo con la de respaldo. */
        if (rotulos) await Promise.all([esperaFuentePortada(), cargaEscudoRotulo()]);

        const resultado = await cortaEnElNavegador({
          fichero,
          titulo: titulo ? `${titulo} · ${peticion.nombre}` : peticion.nombre,
          formato: peticion.formato,
          portada: peticion.portada ?? null,
          portadaSegundos: SEGUNDOS_CARATULA,
          fundidoMs,
          fps,
          topeMegas,
          topeAncho,
          familiaRotulo,
          clips: nombraClips(peticion).map(({ clip, nombre }) => ({
            nombre,
            inicioMs: clip.inicioMs,
            finMs: clip.finMs,
            paradas: peticion.paradas?.get(clip.id),
            fichero: ficheroDe?.(clip),
            rotulo: rotuloDe(clip),
          })),
        });

        const nombre = `${peticion.nombre}.${resultado.extension}`;

        const poster = await preparaPoster(peticion, resultado.blob);

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
          setUltimo({ nombre, segundos: resultado.segundos, bytes: resultado.blob.size });
        }

        await descargaPoster(peticion, poster);

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
    [
      alTerminarVideo,
      descargaPoster,
      preparaPoster,
      familiaRotulo,
      fps,
      fundidoMs,
      nombraClips,
      rotuloDe,
      rotulos,
      titulo,
      topeAncho,
      topeMegas,
    ],
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
    async (
      peticion: PeticionExport,
      fuenteServidor: FuenteServidor,
      /** El vídeo de cada corte, cuando no todos salen del mismo. */
      fuenteDe?: (clip: ClipCoding) => FuenteServidor | undefined,
    ) => {
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
          : `Cortando ${peticion.clips.length} ${peticion.clips.length === 1 ? "corte" : "cortes"}`;

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

        /*
        | El rótulo va ya pintado: el servidor lo pone encima tal cual, y así
        | es el mismo de los dos motores del navegador. Hace falta la letra y
        | el escudo antes de pintarlo.
        */
        const pintados = rotulos && peticion.clips.length <= ROTULOS_PINTADOS_MAX;

        if (pintados) await Promise.all([esperaFuentePortada(), cargaEscudoRotulo()]);

        const conImagen = (clip: ClipCoding) => {
          const rotulo = rotuloDe(clip);

          if (!rotulo || !pintados) return rotulo;

          return {
            ...rotulo,
            imagen: imagenDeRotulo(rotulo, familiaRotulo ?? "sans-serif")?.imagen,
          };
        };

        const cuerpo = JSON.stringify({
          fuente: fuenteServidor,
          modo,
          formato: peticion.formato,
          nombre: peticion.nombre,
          portada: imagenes.portada,
          portadaSegundos: SEGUNDOS_CARATULA,
          fundidoMs,
          topeMegas,
          medida: topeAncho,
          clips: nombraClips(peticion).map(({ clip, nombre }) => ({
            nombre,
            inicioMs: clip.inicioMs,
            finMs: clip.finMs,
            pizarras: imagenes.paradas.get(clip.id),
            fuente: fuenteDe?.(clip),
            rotulo: conImagen(clip),
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

        /*
        | Con plazo, y generoso.
        |
        | `fetch` no se rinde nunca por su cuenta: si el servidor se cae a
        | media codificación —o el ffmpeg de la máquina se queda colgado con un
        | partido pesado— el aviso se queda contando segundos hasta que alguien
        | recarga la página. Con esto sale un error que se puede leer.
        |
        | El plazo se calcula sobre lo que dura el vídeo porque `preciso` va a
        | ~1× tiempo real: cuatro veces eso más dos minutos de arranque es de
        | sobra para el peor caso, y sigue siendo un plazo.
        */
        const plazoMs = Math.max(
          5 * 60_000,
          120_000 + segundosDeVideo * 4 * 1000,
        );

        const corta = new AbortController();

        const seAcabo = setTimeout(() => corta.abort(), plazoMs);

        let respuesta: Response;

        try {
          respuesta = await fetch("/api/coding/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: cuerpo,
            signal: corta.signal,
          });
        } catch (error) {
          if (corta.signal.aborted) {
            throw new Error(
              `El servidor no ha contestado en ${Math.round(plazoMs / 60_000)} ` +
                `minutos. Prueba con menos cortes, o abre el partido desde el ` +
                `ordenador para montarlo aquí sin servidor.`,
            );
          }

          throw error;
        } finally {
          clearTimeout(seAcabo);
        }

        if (!respuesta.ok) {
          const error = await respuesta.json().catch(() => null);

          throw new Error(error?.error ?? explica(respuesta.status));
        }

        const blob = await respuesta.blob();

        const extension = peticion.formato === "zip" ? "zip" : "mp4";

        const poster = await preparaPoster(peticion, blob);

        descarga(blob, `${peticion.nombre}.${extension}`);

        /*
        | EL CONTADOR SE PARA AQUÍ, NO EN EL `finally`.
        |
        | Estaba sólo en el `finally`, o sea DESPUÉS de esperar a
        | `alTerminarVideo`, que es por donde entra la subida a YouTube. Con la
        | subida encendida, el intervalo saltaba un segundo después del
        | «Vídeo listo» y convertía ese mismo aviso —comparten `id`— otra vez
        | en «Montando el vídeo…», contando segundos durante toda la subida. Y
        | `setExportando(false)` esperaba lo mismo, así que los botones de
        | exportar se quedaban apagados mientras el diálogo del nombre esperaba
        | a que alguien escribiera.
        */
        if (tic) {
          clearInterval(tic);
          tic = undefined;
        }

        setExportando(false);

        toast.success("Vídeo listo", {
          id: aviso,
          description: `${peticion.nombre}.${extension} · ${megas(blob.size)} · ${reloj(
            Math.round((Date.now() - arranque) / 1000),
          )}`,
        });

        /* Ni la segunda pasada lo mete: que se sepa antes de mandarlo. */
        if (extension === "mp4" && topeMegas > 0 && blob.size > topeMegas * 1_000_000) {
          toast.warning(`Pesa ${megas(blob.size)}, más que el tope de ${topeMegas} MB`, {
            description: "Es demasiado largo para ese tope: pártelo en dos listas o elige un tope mayor.",
            duration: 10_000,
          });
        }

        if (peticion.formato !== "zip") {
          setUltimo({
            nombre: `${peticion.nombre}.${extension}`,
            /* Lo que dura de verdad: los cortes y, si la lleva, la carátula. */
            segundos:
              segundosDeVideo + (peticion.formato === "unificado" && peticion.portada ? SEGUNDOS_CARATULA : 0),
            bytes: blob.size,
          });
        }

        await descargaPoster(peticion, poster);

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
    [
      alTerminarVideo,
      descargaPoster,
      preparaPoster,
      familiaRotulo,
      fundidoMs,
      modo,
      nombraClips,
      rotuloDe,
      rotulos,
      topeAncho,
      topeMegas,
    ],
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

        /*
        | EL VÍDEO ADOPTADO CONSERVA SU NOMBRE DE SIEMPRE, Y ES IMPORTANTE.
        |
        | El servidor devuelve el nombre con el que ha guardado el fichero, y
        | ése NO es el que se abrió: le quita tildes, cambia lo que no sea
        | letra o número por guiones y, si ya había uno igual, le pega un «-2».
        | Así, «Castilla - Alcorcón 1ª parte.mov» volvía como otro nombre
        | distinto.
        |
        | Y la sesión identifica los vídeos POR EL NOMBRE. Con el nombre
        | cambiado, adoptar no cambiaba la fuente: metía un vídeo nuevo. La
        | sesión pasaba de uno a dos, el de delante era la copia vacía, los
        | clips —que se filtran por nombre— desaparecían de la lista y de la
        | línea de tiempo, y encima entraba un corte de «Vídeo completo» que
        | nadie había pedido. Una tarde de doscientos clips parecía perdida.
        |
        | Lo que cambia al llevarlo a la carpeta es DE DÓNDE se lee, no qué
        | vídeo es: la ruta es la del servidor y el nombre sigue siendo el suyo.
        */
        onAdopta?.(
          { tipo: "archivo", ruta, nombre: fichero.name },
          srcDeCarpeta(ruta),
        );

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
        toast.error("No hay cortes que exportar.");
        return;
      }

      /*
      | Cortes de varios vídeos: cada uno se lee del suyo.
      |
      | Es lo que pasa al subir los vídeos de un jugador ya recortados —cada
      | uno entra con su corte de inicio a fin— o las dos partes de un
      | partido. Con todos abiertos del ordenador se monta aquí; con todos en
      | la carpeta o en un enlace, en el servidor. Mezclados no se puede: un
      | vídeo del ordenador sólo lo lee esta pestaña.
      */
      const primero = videos?.[0]?.nombre ?? fuente?.nombre ?? "";

      const deClip = (clip: ClipCoding) => clip.video ?? primero;

      const nombres = [...new Set(peticion.clips.map(deClip))];

      /*
      | Y también con UN solo vídeo, si no es el de delante: exportar un clip
      | de otro vídeo desde la lista de todos cortaba el tramo del vídeo del
      | reproductor con los minutos del otro.
      */
      const delante = fuente?.nombre ?? primero;

      if (nombres.length > 1 || (nombres.length === 1 && nombres[0] !== delante)) {
        const videoDe = (nombre: string) =>
          videos?.find((uno) => uno.nombre === nombre) ?? null;

        const enServidor = (video: FuenteVideo | null): FuenteServidor | null =>
          video?.tipo === "url"
            ? { tipo: "url", url: video.url }
            : video?.tipo === "archivo"
              ? { tipo: "archivo", ruta: video.ruta }
              : null;

        if (nombres.every((nombre) => ficheros?.[nombre])) {
          if (!puedeCortarAqui()) {
            toast.error("Este navegador no sabe montar el vídeo", {
              description: "Ábrelo en Chrome o en Edge y se monta aquí mismo.",
            });

            return;
          }

          await montaAqui(
            peticion,
            ficheros![deClip(peticion.clips[0])],
            (clip) => ficheros?.[deClip(clip)],
          );

          return;
        }

        if (nombres.every((nombre) => enServidor(videoDe(nombre)))) {
          await lanza(
            peticion,
            enServidor(videoDe(deClip(peticion.clips[0])))!,
            (clip) => enServidor(videoDe(deClip(clip))) ?? undefined,
          );

          return;
        }

        const faltan = nombres.filter(
          (nombre) => !ficheros?.[nombre] && !enServidor(videoDe(nombre)),
        );

        /* Todos se pueden leer, pero unos aquí y otros en el servidor. */
        if (faltan.length === 0) {
          toast.error("No se pueden montar juntos vídeos del ordenador y de la carpeta", {
            description:
              "Un vídeo abierto del ordenador sólo lo lee esta pestaña, y uno de la " +
              "carpeta sólo el servidor. Abre también los de la carpeta con «Abrir " +
              "ficheros» (se pueden elegir todos a la vez) o aparta unos de la " +
              "exportación y móntalos por separado.",
            duration: 15000,
          });

          return;
        }

        toast.error(
          faltan.length === 1
            ? "Hay que volver a abrir un vídeo"
            : `Hay que volver a abrir ${faltan.length} vídeos`,
          {
            description:
              `${faltan.slice(0, 3).join(", ")}${faltan.length > 3 ? "…" : ""}. ` +
              "Están en tu ordenador y al recargar la página el navegador " +
              "pierde el permiso sobre ellos. Ábrelos otra vez en «El vídeo» " +
              "—se pueden elegir todos de golpe— o apártalos de la exportación.",
            duration: 15000,
          },
        );

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
    [
      exportando,
      ficheroLocal,
      ficheros,
      fuente,
      lanza,
      llevaYExporta,
      montaAqui,
      videos,
    ],
  );

  return { exporta, exportando, ultimo };
}

/**
 * El último vídeo que ha salido, para mandarlo.
 *
 * No se sube nada: el mensaje lleva qué es, cuánto dura y cuánto pesa, y el
 * fichero y su póster se adjuntan desde Descargas. El enlace llegará cuando
 * haya subida, que aún no está decidida.
 */
export type VideoListo = { nombre: string; segundos: number; bytes: number };

export function mensajeDeVideo(video: VideoListo, titulo?: string) {
  const pieza = video.nombre.replace(/\.mp4$/i, "");

  return [
    titulo ? `${titulo} · ${pieza}` : pieza,
    `Dura ${reloj(Math.round(video.segundos))} y pesa ${megas(video.bytes)}.`,
    "Va adjunto, con su póster.",
  ].join("\n");
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
  topeMegas,
  onTopeMegas,
  medida,
  onMedida,
  onZip,
  onUnificado,
  onIndividual,
  caratula,
  opcionesCaratula,
  cabePorJugador = false,
  onCaratula,
  onVerCaratula,
  vistaCaratula,
  onCerrarVista,
  pizarras,
  quema,
  onQuema,
  rotulos = false,
  onRotulos,
  fundido = false,
  onFundido,
  enNavegador,
  youtube,
  videos = [],
  onVideo,
  onTodosLosVideos,
  plantillaCaratula = [],
  pistaCaratula,
  objetivoIndividual = "",
  onObjetivoIndividual,
  ultimoVideo = null,
  tituloMensaje,
}: {
  clips: ClipCoding[];
  /** Qué se va a exportar: "todos", "Sergio Mestre", "Pase"… */
  etiqueta: string;
  exportando: boolean;
  modo: ModoCorteUI;
  onModo: (modo: ModoCorteUI) => void;
  /** Lo que puede pesar cada fichero, en megas. `0` es sin tope. */
  topeMegas: number;
  onTopeMegas: (megas: number) => void;
  /** El ancho máximo de la imagen. `0` es la medida del partido. */
  medida: number;
  onMedida: (px: number) => void;
  onZip: () => void;
  onUnificado: () => void;
  /** El unificado de un jugador en orden de corrección (`ordenIndividual`). */
  onIndividual?: () => void;
  /** Id del sujeto de la carátula; `""` es sin carátula. */
  caratula: string;
  opcionesCaratula: { id: string; nombre: string }[];
  /** Hay más de un sujeto: se puede pedir una carátula para cada uno. */
  cabePorJugador?: boolean;
  onCaratula: (id: string) => void;
  onVerCaratula: () => void;
  /** La carátula ya pintada, cuando se ha pedido verla. */
  vistaCaratula: string | null;
  onCerrarVista: () => void;
  /** Cuántas pizarras caen dentro de lo que se va a exportar. */
  pizarras: number;
  quema: boolean;
  onQuema: (quema: boolean) => void;
  /** El rótulo de los primeros segundos de cada corte. */
  rotulos?: boolean;
  onRotulos?: (rotulos: boolean) => void;
  /** Fundido a negro entre los cortes del vídeo unificado. */
  fundido?: boolean;
  onFundido?: (fundido: boolean) => void;
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
    /** Va a parar a preguntar el nombre del vídeo antes de subirlo. */
    preguntaAntes: boolean;
    onSube: (sube: boolean) => void;
  };
  /**
   * Los vídeos de la sesión y si entran en la exportación.
   *
   * Por defecto entran todos: se enseña para poder apartar alguno. Con un
   * solo vídeo no se enseña, que no hay nada que elegir.
   */
  videos?: { nombre: string; dentro: boolean; clips: number }[];
  onVideo?: (nombre: string, dentro: boolean) => void;
  onTodosLosVideos?: (dentro: boolean) => void;
  /** La plantilla entera, para poner la cara de quien sea aunque los cortes no digan de quién son. */
  plantillaCaratula?: { id: string; nombre: string }[];
  /** Por qué se ha puesto sola esa carátula, si se ha puesto sola. */
  pistaCaratula?: string;
  /** Lo que se le pide al jugador: va a la carátula del vídeo individual. */
  objetivoIndividual?: string;
  onObjetivoIndividual?: (texto: string) => void;
  /** El último MP4 que ha salido: se puede mandar con el mensaje ya escrito. */
  ultimoVideo?: VideoListo | null;
  /** El partido o el rival, para el mensaje. */
  tituloMensaje?: string;
}) {
  const total = clips.reduce((suma, clip) => suma + duracionClip(clip), 0);

  const porJugador = caratula === CARATULA_POR_JUGADOR;

  const nombreCaratula = porJugador
    ? "cada jugador"
    : ([...opcionesCaratula, ...plantillaCaratula].find((uno) => uno.id === caratula)
        ?.nombre ?? "");

  const videosDentro = videos.filter((video) => video.dentro).length;

  /* El individual tiene sentido con los cortes de un solo jugador. */
  const jugadores = new Set(
    clips
      .filter((clip) => clip.sujeto !== "colectivo" && clip.jugadorId !== SUJETO_VIDEO_COMPLETO.id)
      .map((clip) => clip.jugadorId),
  );
  const deUno = jugadores.size === 1 ? clips.find((clip) => jugadores.has(clip.jugadorId)) : null;

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

        {onIndividual && deUno && (
          <Button
            icon={Film}
            onClick={onIndividual}
            disabled={exportando}
            title={`El vídeo de ${deUno.jugadorNombre} para corregirle: abre y cierra con lo bien hecho y deja en medio lo que hay que corregir`}
          >
            Vídeo individual
          </Button>
        )}

        <Button
          icon={Package}
          onClick={onZip}
          disabled={exportando || clips.length === 0}
          title="Un fichero por corte, en carpetas por jugador"
        >
          Cortes sueltos (ZIP)
        </Button>

        <span className="text-[11px] text-white/35">
          {clips.length} {clips.length === 1 ? "corte" : "cortes"} ·{" "}
          {formateaTotal(total)} · {etiqueta}
        </span>
      </div>

      {/*
      | El objetivo del vídeo individual: sin él, el vídeo de corrección es
      | una lista de errores. Va a la carátula, debajo del nombre.
      */}
      {/*
      | Mandar lo recién montado. No se sube nada: abre WhatsApp o el correo
      | con qué es, cuánto dura y cuánto pesa, y el fichero y su póster se
      | adjuntan desde Descargas.
      */}
      {ultimoVideo && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[#C8A96B]/25 bg-[#C8A96B]/[0.06] px-3 py-2 text-[11px] text-white/60">
          <span className="min-w-0 truncate">
            Listo: <span className="text-white/85">{ultimoVideo.nombre}</span> ·{" "}
            {reloj(Math.round(ultimoVideo.segundos))} · {megas(ultimoVideo.bytes)}
          </span>
          <span className="text-white/35">Mandar:</span>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(mensajeDeVideo(ultimoVideo, tituloMensaje))}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-2.5 py-1 text-white/80 transition hover:border-[#C8A96B]/60 hover:text-white"
          >
            WhatsApp
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(
              tituloMensaje ? `${tituloMensaje} · ${ultimoVideo.nombre}` : ultimoVideo.nombre,
            )}&body=${encodeURIComponent(mensajeDeVideo(ultimoVideo, tituloMensaje))}`}
            className="rounded-full border border-white/15 px-2.5 py-1 text-white/80 transition hover:border-[#C8A96B]/60 hover:text-white"
          >
            Correo
          </a>
        </div>
      )}

      {onIndividual && deUno && onObjetivoIndividual && (
        <label className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-white/45">
          <span className="shrink-0">
            Objetivo de la semana de {deUno.jugadorNombre} (sale en la carátula del vídeo individual)
          </span>
          <input
            type="text"
            value={objetivoIndividual}
            maxLength={140}
            onChange={(evento) => onObjetivoIndividual(evento.target.value)}
            placeholder="Perfilarse antes de recibir y vigilar al pívot tras pérdida"
            className="min-w-0 flex-1 basis-60 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/85 placeholder:text-white/25 focus:border-[#C8A96B]/60 focus:outline-none"
          />
        </label>
      )}

      {/* ------------------------- LOS VÍDEOS -------------------------- */}

      {/*
      | Todo lo subido entra solo; aquí se aparta lo que no se quiera.
      |
      | Veintidós vídeos de un jugador son veintidós fichas: van en una fila que
      | se enrolla, y el número de al lado son sus cortes —el de inicio a fin
      | y los que se hayan marcado encima—.
      */}
      {videos.length > 1 && (
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
              <Film size={12} className="text-[#C8A96B]" />
              Vídeos
            </span>

            <span className="text-[11px] text-white/35">
              {videosDentro === videos.length
                ? `Entran los ${videos.length}`
                : `Entran ${videosDentro} de ${videos.length}`}{" "}
              · pulsa uno para apartarlo o volver a meterlo
            </span>

            {onTodosLosVideos && (
              <button
                type="button"
                onClick={() => onTodosLosVideos(videosDentro < videos.length)}
                className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/45 transition hover:text-white"
              >
                {videosDentro < videos.length ? "Meter todos" : "Apartar todos"}
              </button>
            )}
          </div>

          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {videos.map((video) => (
              <button
                key={video.nombre}
                type="button"
                onClick={() => onVideo?.(video.nombre, !video.dentro)}
                aria-pressed={video.dentro}
                title={
                  video.dentro
                    ? `${video.nombre} entra en la exportación. Pulsa para apartarlo.`
                    : `${video.nombre} no entra. Pulsa para meterlo.`
                }
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  video.dentro
                    ? "border-[#C8A96B]/60 bg-[#C8A96B]/10 text-[#C8A96B]"
                    : "border-white/10 text-white/35 line-through hover:text-white"
                }`}
              >
                <span className="max-w-[14rem] truncate">
                  {video.nombre.replace(/\.[^.]+$/, "")}
                </span>

                <span className="tabular-nums opacity-60">{video.clips}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ----------------------------- PARA DÓNDE --------------------- */}

      {/*
      | El destino decide el peso y la medida a la vez, y quien exporta piensa
      | en «esto va al grupo», no en megas. Pulsar uno pone los dos de abajo;
      | se pueden seguir tocando sueltos.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
          <Film size={12} className="text-[#C8A96B]" />
          Para
        </span>

        {DESTINOS.map((destino) => {
          const elegido =
            topeMegas === destino.megas && medida === destino.medida;

          return (
            <button
              key={destino.nombre}
              type="button"
              aria-pressed={elegido}
              onClick={() => {
                onTopeMegas(destino.megas);
                onMedida(destino.medida);
              }}
              title={destino.explica}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                elegido
                  ? "border-[#C8A96B] bg-[#C8A96B]/10 font-semibold text-[#C8A96B]"
                  : "border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {destino.nombre}
            </button>
          );
        })}
      </div>

      {/* Los ajustes, plegados: lo habitual es sacar los vídeos tal cual. */}
      <details className="rounded-xl border border-white/10 px-3 py-2">
        <summary className="cursor-pointer select-none text-xs font-medium text-white/70">
          Ajustes de la exportación: peso, medida, rótulos, fundido y carátula
        </summary>

        <div className="mt-3 space-y-3">
      {/* ------------------------- EL PESO DE CADA FICHERO ------------- */}

      {/*
      | Un corte acaba en un grupo de WhatsApp, en un correo o en un pen, y
      | ahí lo que decide no es el caudal del partido sino si el fichero cabe.
      | El tope se convierte en caudal y se le da al codificador, así que no
      | hay recorte ni segunda pasada: sale ya pesando lo que tiene que pesar.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
          <Package size={12} className="text-[#C8A96B]" />
          Peso máximo
        </span>

        {PESOS.map((peso) => (
          <button
            key={peso}
            type="button"
            onClick={() => onTopeMegas(peso)}
            aria-pressed={topeMegas === peso}
            title={
              peso === 0
                ? "Sin tope: cada corte pesa lo que pida la imagen"
                : `Cada fichero cabe en ${peso} MB`
            }
            className={`rounded-md border px-2 py-0.5 text-[11px] tabular-nums transition ${
              topeMegas === peso
                ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                : "border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {peso === 0 ? "Sin tope" : `${peso} MB`}
          </button>
        ))}

        <span className="text-[11px] text-white/30">
          {topeMegas > 0
            ? (pesoPrevisto(topeMegas, total / 1000) ?? "por fichero, apretando la imagen sólo si hace falta")
            : "el corte pesa lo que pida el partido"}
        </span>
      </div>

      {/* ------------------------- LA MEDIDA DE LA IMAGEN ------------- */}

      {/*
      | El corte sale con la medida del partido salvo que aquí se diga otra
      | cosa. Bajarla codifica antes y pesa menos; subirla no se puede, que
      | inventar píxeles no devuelve detalle.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
          <Maximize2 size={12} className="text-[#C8A96B]" />
          Medida
        </span>

        {MEDIDAS.map((una) => (
          <button
            key={una.px}
            type="button"
            onClick={() => onMedida(una.px)}
            aria-pressed={medida === una.px}
            title={
              una.px === 0
                ? "El corte sale con la imagen del partido, sin encogerla"
                : una.px === VERTICAL
                  ? "1080 × 1920 para el teléfono: el corte a todo el ancho y su imagen desenfocada detrás"
                  : `La imagen se baja a ${una.px} de ancho`
            }
            className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
              medida === una.px
                ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                : "border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {una.nombre}
          </button>
        ))}

        <span className="text-[11px] text-white/30">
          {medida === VERTICAL
            ? "1080 × 1920: el corte a todo el ancho y su imagen desenfocada detrás"
            : medida > 0
              ? "se encoge sólo si el partido es más grande"
              : "sin encoger: sale como se grabó"}
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
            aria-pressed={quema}
            title={
              quema
                ? "El vídeo se para en cada pizarra, se ve el dibujo y sigue limpio. Pulsa para sacarlo sin dibujos."
                : "El vídeo sale sin los dibujos. Pulsa para meterlos."
            }
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
              quema
                ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                : "border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {quema ? <Snowflake size={12} /> : <SkipForward size={12} />}
            {quema ? "Dentro del vídeo" : "Sin dibujos"}
          </button>

          <span className="text-[11px] text-white/35">
            {quema
              ? `${pizarras} ${pizarras === 1 ? "parada" : "paradas"}: el vídeo se detiene, se ve lo pintado y sigue`
              : `${pizarras} ${pizarras === 1 ? "pizarra se queda" : "pizarras se quedan"} fuera: el vídeo sale como se grabó`}
          </span>
        </div>
      )}

      {/* ------------------------- LOS RÓTULOS ------------------------ */}

      {onRotulos && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
            <Type size={12} className="text-[#C8A96B]" />
            Rótulos
          </span>

          <button
            type="button"
            onClick={() => onRotulos(!rotulos)}
            aria-pressed={rotulos}
            title={
              rotulos
                ? "Cada corte empieza con un rótulo de 3,5 s: quién, qué y en qué minuto. Pulsa para sacarlos limpios."
                : "Los cortes salen limpios. Pulsa para ponerles el rótulo."
            }
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
              rotulos
                ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                : "border-white/10 text-white/40 hover:text-white"
            }`}
          >
            <Type size={12} />
            {rotulos ? "Con rótulo" : "Sin rótulo"}
          </button>

          <span className="text-[11px] text-white/35">
            {rotulos
              ? "3,5 s al empezar cada corte: dorsal y nombre, categoría, descriptores y minuto"
              : "los cortes salen como se grabaron"}
          </span>
        </div>
      )}

      {/* ----------------------- ENTRE UN CORTE Y OTRO ---------------- */}

      {onFundido && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
            <Film size={12} className="text-[#C8A96B]" />
            Transición
          </span>

          {[
            { valor: true, texto: "Fundido" },
            { valor: false, texto: "Corte seco" },
          ].map((opcion) => (
            <button
              key={opcion.texto}
              type="button"
              onClick={() => onFundido(opcion.valor)}
              aria-pressed={fundido === opcion.valor}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                fundido === opcion.valor
                  ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                  : "border-white/10 text-white/40 hover:text-white"
              }`}
            >
              {opcion.texto}
            </button>
          ))}

          <span className="text-[11px] text-white/30">
            {fundido
              ? "en el vídeo unificado, un fundido a negro de 0,3 s separa cada corte"
              : "los cortes se pegan uno detrás de otro"}
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

          {/* Con un solo sujeto no se ofrece: sería la de siempre con otro nombre. */}
          {cabePorJugador && (
            <option value={CARATULA_POR_JUGADOR}>
              Una por jugador ({opcionesCaratula.length})
            </option>
          )}

          {opcionesCaratula.map((uno) => (
            <option key={uno.id} value={uno.id}>
              {uno.nombre}
            </option>
          ))}

          {/* Toda la plantilla: los cortes de «Vídeo completo» no dicen de
              quién son, y la cara hay que poder ponerla igual. */}
          {plantillaCaratula.length > 0 && (
            <optgroup label="Plantilla">
              {plantillaCaratula.map((uno) => (
                <option key={uno.id} value={uno.id}>
                  {uno.nombre}
                </option>
              ))}
            </optgroup>
          )}
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
          {porJugador
            ? `Cada bloque abre con la suya, ${SEGUNDOS_CARATULA} s · «Ver» enseña la del primero`
            : caratula
              ? `${pistaCaratula ? `${pistaCaratula} · ` : ""}Abre el vídeo unificado, ${SEGUNDOS_CARATULA} s, con la plantilla del club`
              : "El vídeo empieza directo en el primer corte"}
        </span>
      </div>
        </div>
      </details>

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
                }${youtube.preguntaAntes ? " · pregunta el nombre antes" : ""}`
              : "Sólo se descarga al ordenador"}
          </span>
        </div>
      )}

      {/* --------------------------- EL CORTE -------------------------- */}

      {enNavegador ? (
        <NotaPlegable
          className="rounded-lg border border-[#C8A96B]/25 bg-[#C8A96B]/[0.06] px-3 py-2 text-white/55"
          resumen={
            <>
              <span className="text-[#C8A96B]">Se monta aquí, en tu navegador.</span> El
              partido no se sube a ningún sitio.
            </>
          }
        >
          Sale del fichero que tienes abierto, en <span className="text-white/75">.mp4</span> con
          sonido, a la calidad y a los fotogramas del partido, y tarda bastante
          menos de lo que dura el vídeo —no hay que reproducirlo—. Se ve
          mientras se hace y se puede cancelar. Si el fichero no se deja leer
          así (un .mkv, un formato raro), se graba a tiempo real —tarda{" "}
          {formateaTotal(total)}— y entonces sale en .webm.
        </NotaPlegable>
      ) : (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/30">
          Corte
        </span>

        {(
          [
            ["preciso", "Preciso", "Empieza justo donde marcaste. Tarda más o menos lo que duran los cortes."],
            ["rapido", "Rápido", "Casi al momento, pero el corte puede empezar uno o dos segundos antes de lo marcado."],
          ] as const
        ).map(([valor, texto, ayuda]) => (
          <button
            key={valor}
            type="button"
            title={ayuda}
            aria-pressed={modo === valor}
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

        {/* La diferencia, a la vista: en una tablet no hay ratón que
            enseñe el `title` (19/10/2026). */}
        <span className="text-[11px] text-white/35">
          {modo === "rapido"
            ? "casi al momento; puede empezar un par de segundos antes"
            : "justo donde marcaste; tarda lo que duran los cortes"}
        </span>
      </div>
      )}
    </div>
  );
}
