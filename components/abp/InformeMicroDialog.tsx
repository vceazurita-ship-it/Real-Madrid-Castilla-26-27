"use client";

/**
 * EL INFORME DE ABP DEL MICROCICLO: mirarlo y mandarlo.
 *
 * Lo arma `lib/abp/informe-micro.ts` con lo que la pantalla ya tiene cargado, y
 * aquí se hacen las dos cosas que se piden de él: **verlo sin mandar nada** —que
 * es lo normal— y mandarlo por correo desde la cuenta de Google del club.
 *
 * Dos cosas viven aquí dentro y no en la página:
 *
 * - **El seguimiento individual**, que la pantalla del microciclo no necesita
 *   para nada más. Se pide al abrir este diálogo, no al abrir la página: son
 *   138 KB que en frío tardan lo suyo, y cargarlos siempre penalizaría a quien
 *   sólo viene a planificar la semana.
 * - **A quién se le manda.** La lista se guarda en `app_documents` bajo
 *   `abp:informe-correo`, así que se escribe una vez y está para todos los
 *   microciclos y para cualquiera del cuerpo técnico.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BookOpen, Image as ImageIcon, Loader2, Mail, Maximize2, RefreshCw, Send } from "lucide-react";
import { MenuDescargar } from "@/components/informe-partido/MenuDescargar";
import { descargaEnMarcha, encargaDescarga } from "@/lib/trabajos/descargas";
import { toast } from "sonner";

import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import { bloqueVideoHtml } from "@/lib/video-informe/portada-video";
import { VIDEO_JUGADORES_KEY, eligeVideoJugadores, normalizaVideosJugadores, type VideoJugadores } from "@/lib/abp/video-jugadores";
import { puedeMontarVideo, type VideoMontado } from "@/lib/video-informe/monta";
import { trabajoVideo } from "@/lib/video-informe/trabajo-video";
import { trabajoEnvios, type ResultadoEnvio } from "@/lib/informes/trabajo-envios";
import { SEGUNDOS_ENTRADA_ABP, entradaDeAbp, type CortePartido } from "@/lib/video-informe/guion";
import { guionPostDeAbp, segundosDeCortesAbp, topePostAbp } from "@/lib/video-informe/guion-abp-post";
import { jugadasDelTablero, pideVideoPostAbp, type VideoPostAbp } from "@/components/abp/jugadas-del-video";
import { barlowCondensed } from "@/lib/rivals/portada-font";
import { enlaceConTarjeta, nombrePartidoPdf } from "@/lib/informe-partido/tarjeta-pdf";
import { buscadorDeEscudos, traeEscudos } from "@/lib/data-analisis/escudos";

import { AvisoAntesDeMandar } from "@/components/correo/AvisoAntesDeMandar";

import { Button, Dialog } from "@/components/abp/ui";
import { traeJson } from "@/lib/hojaCsv";
import { teamKey } from "@/lib/abp/model";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { normalizarOnce, rivalOnceKey } from "@/lib/rivals/once";
import { useAnalisisRivalInforme } from "@/hooks/useAnalisisRivalInforme";
import { temporadaCorta, usePizarraInforme } from "@/components/abp/PizarraInforme";
import { pizarraParaInforme } from "@/lib/abp/pizarra-para-informe";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { useAgendaEnvios } from "@/hooks/useAgendaEnvios";
import { Destinatarios } from "@/components/correo/Destinatarios";
import { corteDeRed } from "@/lib/export/captura";
import { completoEnHojas } from "@/lib/informe-partido/pdf-completo";
import { informeUnicoPdf, paginaDeEnlaces } from "@/lib/informe-partido/pdf-unico";
import { mensajeWhatsapp, telefonosDe, type CanalEnvio, type MensajeWhatsapp } from "@/lib/correo/whatsapp";
import { usePlayers } from "@/hooks/usePlayers";
import { alineaSeguimiento } from "@/lib/seguimiento";

import {
  accionesDelPartido,
  construyeInforme,
  fechaDelPartido,
  informeCuerpoHtml,
  informeHtml,
  informeTexto,
  modoSugerido,
  pinceladaAbp,
  type DatosInforme,
  type InformeMicro,
  type ModoInforme,
  type PinceladaAbp,
  type SeguimientoFila,
} from "@/lib/abp/informe-micro";

import {
  graficosDelInforme,
  type ComparativaAbp,
  type PropioAbp,
} from "@/lib/abp/informe-graficos";

import {
  leeAbpPropio,
  porJugadorAbp,
  type AccionAbp,
} from "@/lib/data-analisis/abp-propio";

/** El vídeo para los jugadores que se está montando (o ya montado), y para qué informe. */
type Montaje = { clave: string; promesa: Promise<VideoMontado | null> };
type EstadoMontaje = { clave: string; texto: string; listo: boolean; fallo?: string };

/** El escudo del rival para la portada (sin él, sale sólo su nombre). */
const escudoDe = (rival: string) => (rival ? traeEscudos().then((lista) => buscadorDeEscudos(lista)(rival)).catch(() => null) : Promise.resolve(null));

/**
 * Monta el vídeo que toque —en la previa, la entrada del informe + nuestro
 * vídeo entero; en el post, el vídeo post—. Uno detrás de otro: si el informe
 * cambia a mitad, el nuevo espera a que acabe el anterior (dos a la vez se
 * pisarían el descodificador). Nunca falla: `null` si no ha salido.
 */
function arrancaMontaje(ref: { current: Montaje | null }, clave: string, pide: (alPaso: (texto: string) => void) => Promise<VideoMontado>, estado: (e: EstadoMontaje) => void) {
  const anterior = ref.current?.promesa ?? Promise.resolve(null);
  const promesa = anterior
    .catch(() => null)
    /* En segundo plano y por huella de contenido (02/11/2026): sigue al cerrar el diálogo y reabrir no lo rehace. */
    .then(() => pide((texto) => estado({ clave, texto, listo: false })))
    .then((v) => {
      estado({ clave, texto: "", listo: true });

      return v;
    })
    .catch((error) => {
      console.warn("[abp] el vídeo para los jugadores no se ha montado", error);
      estado({ clave, texto: "", listo: false, fallo: error instanceof Error ? error.message : "No se ha podido montar." });

      return null;
    });

  ref.current = { clave, promesa };

  return promesa;
}

/** Lo que la pantalla del microciclo ya tiene y aquí no hay que volver a pedir. */
export type DatosDelMicro = Omit<
  DatosInforme,
  | "seguimientos"
  | "nombrePorId"
  | "generado"
  | "comparativa"
  | "propio"
  | "graficos"
  | "modo"
  | "accionesPartido"
  | "rivalAnalisis"
>;

/** Los destinatarios y, desde el 15/10/2026, si va por correo o por WhatsApp (y a qué teléfonos). */
type AjustesCorreo = { destinatarios: string; canal?: CanalEnvio; telefonos?: string };

const VACIO: AjustesCorreo = { destinatarios: "" };

/**
 * El mismo texto, pero con las direcciones de internet pulsables.
 *
 * Cuando Gmail se niega, el motivo trae **la dirección exacta** de la consola de
 * Google donde se arregla. Escribirla y que haya que copiarla a mano sería
 * dejar el aviso a medias, así que se parte el texto por la URL y el trozo de
 * en medio sale como enlace.
 */
function conEnlace(texto: string) {
  /* El paréntesis del `split` conserva lo que separa, así que la lista alterna
     texto y enlace y no hay que buscar posiciones. */
  return texto.split(/(https?:\/\/\S+)/g).map((trozo, indice) =>
    /^https?:\/\//.test(trozo) ? (
      <a
        key={indice}
        href={trozo}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-rose-200"
      >
        {trozo}
      </a>
    ) : (
      trozo
    ),
  );
}

/** Lo que se deja pasar a /api/abp/informe: Vercel corta las peticiones de más de ~4,5 MB. */
const TOPE_CORREO = 3_800_000;

/**
 * Una imagen del informe, aligerada para el correo (02/10/2026).
 *
 * Las láminas del rival salían en PNG de 2 MB cada una (la foto del campo de
 * fondo) y las gráficas, en PNG al doble de tamaño: con dos láminas el correo
 * ya pasaba del tope de Vercel y no salía. En el correo se ven a 760 px, así
 * que se mandan a 1000 px como mucho y en JPEG sobre blanco (el fondo del
 * correo): pesan la décima parte y no se nota.
 */
function aligera(dataUrl: string): Promise<string> {
  return new Promise((resuelve) => {
    const imagen = new Image();

    imagen.onload = () => {
      const escala = Math.min(1, 1000 / (imagen.naturalWidth || 1000));

      const lienzo = document.createElement("canvas");

      lienzo.width = Math.round(imagen.naturalWidth * escala);
      lienzo.height = Math.round(imagen.naturalHeight * escala);

      const ctx = lienzo.getContext("2d");

      if (!ctx) return resuelve(dataUrl);

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

      const ligera = lienzo.toDataURL("image/jpeg", 0.85);

      resuelve(ligera.length < dataUrl.length ? ligera : dataUrl);
    };

    imagen.onerror = () => resuelve(dataUrl);

    imagen.src = dataUrl;
  });
}

/**
 * Lo que devuelve el informe cuando se monta incrustado (03/10/2026).
 *
 * El informe del partido (Microciclos) abre esta pantalla en un marco oculto y
 * recibe esto por `postMessage`: el informe de balón parado entero, listo para
 * meterlo como una sección de su correo, y su pincelada para el resumen. Así
 * el balón parado se calcula en un solo sitio.
 */
export type ResultadoIncrustado =
  | {
      ok: true;
      clave: string;
      modo: ModoInforme;
      asunto: string;
      /** Sin marco: `informeCuerpoHtml` con las imágenes por `cid` y prefijo «abp-». */
      cuerpo: string;
      texto: string;
      /** Los `cid` ya llevan el prefijo «abp-». */
      imagenes: { cid: string; tipo: string; base64: string }[];
      pincelada: PinceladaAbp;
      avisos: string[];
      /**
       * Post (02/11/2026): el vídeo post de ABP, ya en guion, para que el
       * informe del partido lo monte (o se encuentre el que ya montó este
       * diálogo, por la huella) y lo enlace en su correo, su PDF y WhatsApp.
       */
      video?: VideoPostAbp | null;
    }
  | { ok: false; clave: string; error: string };

/** El tope de imágenes del informe incrustado: el correo del partido lleva más cosas. */
const TOPE_INCRUSTADO = 2_500_000;

/** Lo que se tarda como mucho en tenerlo: el seguimiento y el Apps Script van lentos en frío. */
const ESPERA_INCRUSTADO = 60_000;

const PREFIJO_CID = "abp-";

/**
 * Las imágenes del informe, aligeradas y recortadas a un tope.
 *
 * Lo mismo que hace el envío: primero se aligera todo y, si no cabe, salen
 * antes las páginas de los PDF del rival (su enlace se queda en el informe) y
 * después, de la más pesada a la más ligera, lo que haga falta.
 */
async function imagenesQueCaben(informe: InformeMicro, tope: number) {
  const avisos: string[] = [];

  const peso = (lista: InformeMicro["graficos"]) => lista.reduce((suma, grafico) => suma + grafico.imagen.length, 0);

  let graficos: InformeMicro["graficos"] = [];

  for (const grafico of informe.graficos) graficos.push({ ...grafico, imagen: await aligera(grafico.imagen) });

  if (peso(graficos) >= tope) {
    const sinPdf = graficos.filter((grafico) => !grafico.cid.startsWith("rival-doc-"));

    if (sinPdf.length < graficos.length) {
      avisos.push("Las páginas de los PDF del rival no caben: van como enlace a cada PDF.");

      graficos = sinPdf;
    }
  }

  /* Después, la pizarra: se abre en la app, y nueve diapositivas echarían a los gráficos. */
  if (peso(graficos) >= tope) {
    const sinPizarra = graficos.filter((grafico) => grafico.area !== "pizarra");

    if (sinPizarra.length < graficos.length) {
      avisos.push("La pizarra del partido no cabe: se ve en la pizarra de ABP de la app.");

      graficos = sinPizarra;
    }
  }

  const fuera: string[] = [];

  while (peso(graficos) >= tope && graficos.length) {
    const mayor = graficos.reduce((uno, otro) => (otro.imagen.length > uno.imagen.length ? otro : uno));

    fuera.push(mayor.titulo);

    graficos = graficos.filter((grafico) => grafico !== mayor);
  }

  if (fuera.length) avisos.push(`No caben en el correo y se quedan fuera: ${fuera.join(", ")}.`);

  return { informe: { ...informe, graficos }, avisos };
}

export function InformeMicroDialog({
  datos,
  onClose,
  incrustado,
}: {
  datos: DatosDelMicro;
  onClose: () => void;
  /**
   * Sin ventana: espera a tenerlo todo, arma el informe como para el correo y
   * se lo da a `alListo` una sola vez. Lo usa `/abp-microciclo?incrustado=…`.
   */
  incrustado?: { modo: ModoInforme; alListo: (resultado: ResultadoIncrustado) => void };
}) {
  const { value: ajustes, setValue: setAjustes } = useRemoteDoc<AjustesCorreo>({
    key: "abp:informe-correo",
    kind: "abp",
    fallback: VACIO,
  });

  const { players } = usePlayers();

  const [seguimientos, setSeguimientos] = useState<SeguimientoFila[] | null>(
    null,
  );

  /*
  | Con quién nos comparamos: la categoría de este año y nosotros mismos en las
  | temporadas anteriores, recortadas a los mismos partidos jugados. La cuenta
  | la hace el servidor (`/api/data-analisis?abpInforme=1`): el dataset de
  | Wyscout son más de dos megas y esto son cuatro kilobytes.
  */
  const [comparativa, setComparativa] = useState<ComparativaAbp | null>(null);

  const [faltaComparativa, setFaltaComparativa] = useState(false);

  /*
  | Nuestras cuatro hojas de ABP.
  |
  | Es la única fuente donde los **goles de balón parado son un dato**: el
  | analista escribe el resultado de cada acción. De la liga nadie publica de
  | qué jugada nace cada gol, así que lo que se compara con la categoría son
  | córners, faltas y remates, no goles.
  */
  const [acciones, setAcciones] = useState<AccionAbp[] | null>(null);

  /*
  | LA PRETEMPORADA, FUERA POR DEFECTO.
  |
  | Medido el 17/09/2026: de las 500 acciones registradas, **335 son de
  | amistosos de julio** —siete partidos de pretemporada frente a tres de
  | liga—. Mezclándolas, el informe decía «4 goles a balón parado a favor y
  | 16 % de peligro»; **los cuatro goles son de pretemporada**, y en liga el
  | peligro es del 21 %, mejor de lo que parecía.
  |
  | Así que el informe de la semana habla de competición, que es de lo que se
  | decide. La pretemporada se puede meter con el interruptor, a propósito y
  | sabiendo lo que se hace.
  */
  const [conPretemporada, setConPretemporada] = useState(false);

  const deCompeticion = useMemo(
    () =>
      acciones === null
        ? null
        : conPretemporada
          ? acciones
          : acciones.filter((una) => una.jornada.competicion !== "amistoso"),
    [acciones, conPretemporada],
  );

  const cuantasDePretemporada = useMemo(
    () =>
      (acciones ?? []).filter((una) => una.jornada.competicion === "amistoso")
        .length,
    [acciones],
  );

  const [enviando, setEnviando] = useState(false);

  /*
  | NUESTRO VÍDEO DE LA JORNADA (17/10/2026, lo pidió el usuario): ya no se
  | monta un vídeo con los clips de ABP; va el vídeo completo que el analista
  | deja en «ABP\VIDEO - JUGADORES» (lo sube el vigía, lib/abp/video-jugadores.ts).
  | Si no hay vídeo de esta jornada, el informe no dice nada de vídeo.
  */
  const [conVideo, setConVideo] = useState(true);
  const [pasoVideo, setPasoVideo] = useState("");
  /*
  | Sin calendario, la jornada de la hoja (04/11/2026): «LIGA 10» → 10. Si el
  | calendario no llegaba, el informe post no leía los cortes del partido y
  | el vídeo salía sin el balón parado del J10.
  */
  const jornadaHoja = /^\s*LIGA\s+0*(\d+)\s*$/i.exec(datos.partido?.jornada ?? "")?.[1];
  const jornadaPartido = datos.partidoCalendario?.jornada ?? (jornadaHoja ? Number(jornadaHoja) : null);
  const rivalVideo = datos.partidoCalendario?.rival || datos.rival || "";
  const [videoJugadores, setVideoJugadores] = useState<VideoJugadores | null>(null);
  /* Leído (haya o no): el vídeo post no empieza hasta saber si lleva el nuestro detrás (02/11/2026). */
  const [videoJugadoresLeido, setVideoJugadoresLeido] = useState(false);

  useEffect(() => {
    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(VIDEO_JUGADORES_KEY)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: unknown }>)
      .then((d) => {
        if (!cancelado) setVideoJugadores(eligeVideoJugadores(normalizaVideosJugadores(d?.data), jornadaPartido, rivalVideo));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setVideoJugadoresLeido(true);
      });

    return () => {
      cancelado = true;
    };
  }, [jornadaPartido, rivalVideo]);

  /*
  | Las plantillas rivales (20/10/2026): la estatura y la etiqueta «Rematador
  | de ABP» de sus jugadores, para «A quién marcamos». Sólo se lee; si falla,
  | el bloque no sale.
  */
  const [plantillaRival, setPlantillaRival] = useState<unknown>(null);

  useEffect(() => {
    let cancelado = false;

    traeJson<unknown>("/api/rivals?action=rivalesPlantillas")
      .then((data) => {
        if (!cancelado) setPlantillaRival(data);
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, []);

  /*
  | Su once probable marcado (22/10/2026), para que «A quién marcamos» ponga
  | primero a los que salen y «si entra» a los demás. El documento va por el
  | nombre del equipo tal como lo escribe la hoja de plantillas. Sólo se lee.
  */
  const equipoHoja = useMemo(() => {
    if (!Array.isArray(plantillaRival) || !rivalVideo) return "";

    /*
    | Con `mismoClub`, no con la clave exacta (31/10/2026): el calendario dice
    | «FC Cartagena» y la hoja «Cartagena», y el once marcado no llegaba nunca.
    */
    const filas = (plantillaRival as Record<string, unknown>[]).filter((una) => una && typeof una === "object");
    const fila =
      filas.find((una) => teamKey(String(una.NOMBRE_EQUIPO ?? "")) === teamKey(rivalVideo)) ??
      filas.find((una) => mismoClub(String(una.NOMBRE_EQUIPO ?? ""), rivalVideo));

    return fila ? String(fila.NOMBRE_EQUIPO ?? "") : "";
  }, [plantillaRival, rivalVideo]);

  const [onceRival, setOnceRival] = useState<{ titulares: string[]; dudas: string[] } | null>(null);

  useEffect(() => {
    if (!equipoHoja) return;

    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(rivalOnceKey(equipoHoja))}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { data?: unknown }) => {
        if (cancelado || !j?.data) return;

        const once = normalizarOnce(j.data);

        setOnceRival({ titulares: once.titulares, dudas: once.dudas });
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [equipoHoja]);

  /*
  | Los cortes del partido (22/10/2026): cada acción de peligro del post se
  | enlaza con su corte por el minuto. Los deja el ordenador del club en
  | `informe-clips:jNN`. Sólo se lee; sin cortes, las acciones salen sin enlace.
  */
  const [clipsPartido, setClipsPartido] = useState<{ minuto: string; url: string; de: string; tipo: string }[] | null>(null);
  /* Los mismos cortes enteros (02/11/2026), para el vídeo post: tipo, minuto, duración y si hubo peligro. */
  const [cortesAbp, setCortesAbp] = useState<CortePartido[]>([]);
  const [cortesLeidos, setCortesLeidos] = useState(false);

  useEffect(() => {
    if (!jornadaPartido) return;

    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(`informe-clips:j${String(jornadaPartido).padStart(2, "0")}`)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { data?: { cortes?: CortePartido[]; abp?: CortePartido[] } | null }) => {
        if (cancelado) return;

        const esAbp = (c: CortePartido) => typeof c.url === "string" && /^(corner|abp|banda)/.test(String(c.tipo ?? ""));
        /* TODO el balón parado (03/11/2026): si el ordenador del club lo ha cortado entero desde nuestras hojas, manda sobre la selección de siempre. */
        const enteros = (j?.data?.abp ?? []).filter((c) => c && c.url && c.minuto);
        const cortes = [...(j?.data?.cortes ?? []).filter((c) => c && c.url && c.minuto && (!enteros.length || !esAbp(c))), ...enteros];

        setClipsPartido(cortes.map((c) => ({ minuto: String(c.minuto), url: String(c.url), de: String(c.de ?? ""), tipo: String(c.tipo ?? ""), rotulo: String((c as { rotulo?: string }).rotulo ?? "") })));
        setCortesAbp(cortes.filter(esAbp));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCortesLeidos(true);
      });

    return () => {
      cancelado = true;
    };
  }, [jornadaPartido]);

  /*
  | Por qué el fallo del envío NO se queda en un aviso flotante.
  |
  | Los dos motivos por los que Gmail puede negarse —falta el permiso, falta
  | activar la API— se arreglan **fuera de aquí**, en la consola de Google, y el
  | aviso trae la dirección exacta a la que ir. Un `toast` se va solo a los
  | segundos y no deja pulsar un enlace: el mensaje se queda en el pie del
  | diálogo hasta el siguiente intento.
  */
  const [fallo, setFallo] = useState("");

  useEffect(() => {
    let cancelado = false;

    traeJson<unknown>("/api/rivals?action=seguimiento")
      .then((data) => {
        if (cancelado) return;

        setSeguimientos(Array.isArray(data) ? (data as SeguimientoFila[]) : []);
      })
      .catch((error) => {
        console.error("[abp] seguimiento para el informe", error);

        if (!cancelado) setSeguimientos([]);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    leeAbpPropio()
      .then((datos) => {
        if (!cancelado) setAcciones(datos.acciones);
      })
      .catch((error) => {
        console.error("[abp] hojas propias para el informe", error);

        if (!cancelado) setAcciones([]);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/data-analisis?abpInforme=1")
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        if (cancelado) return;

        const abp = datos?.abp as ComparativaAbp | undefined;

        setComparativa(abp?.liga?.length ? abp : null);
        setFaltaComparativa(!abp?.liga?.length);
      })
      .catch((error) => {
        console.error("[abp] comparativa para el informe", error);

        if (!cancelado) setFaltaComparativa(true);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  /*
  | El nombre manda sobre el ID, como en todas las pantallas que leen esta
  | hoja: los `JUG-XX` se han renumerado y un registro viejo apunta hoy a otra
  | persona. Ver `lib/seguimiento.ts`.
  */
  const filasSeguimiento = useMemo(() => {
    if (!seguimientos) return [];

    return alineaSeguimiento(
      seguimientos.map((fila) => ({
        ...fila,
        ID_JUGADOR: String(fila.ID_JUGADOR ?? ""),
      })),
      players,
    );
  }, [seguimientos, players]);

  const nombrePorId = useMemo(
    () => new Map(players.map((jugador) => [jugador.id, jugador.nombre])),
    [players],
  );

  /**
   * Nuestro balón parado, resumido para el informe.
   *
   * Se agrupa aquí y no en la librería porque es una lectura de nuestras hojas
   * y sólo la necesita este diálogo. El orden de las jornadas es el de
   * `porJornadaAbp`: la pretemporada, que es de julio, va delante.
   */
  const propio = useMemo<PropioAbp | null>(() => {
    if (!deCompeticion) return null;

    const ofensivas = deCompeticion.filter((una) => una.bloque.endsWith("Of"));
    const defensivas = deCompeticion.filter((una) => una.bloque.endsWith("Def"));

    const resume = (lista: AccionAbp[]) => ({
      acciones: lista.length,
      remates: lista.filter((una) => una.remate).length,
      goles: lista.filter((una) => una.gol).length,
      peligros: lista.filter((una) => una.peligro).length,
      xg: Number(lista.reduce((suma, una) => suma + una.xg, 0).toFixed(2)),
    });

    const todo = resume(deCompeticion);

    /* Por familia de acción: córner, falta, banda… */
    const porFamilia = new Map<string, AccionAbp[]>();

    deCompeticion.forEach((una) => {
      const clave = `${una.familia}${una.bloque.endsWith("Def") ? " (en contra)" : ""}`;

      porFamilia.set(clave, [...(porFamilia.get(clave) ?? []), una]);
    });

    const porAspecto = [...porFamilia.entries()]
      .map(([etiqueta, lista]) => ({
        etiqueta,
        acciones: lista.length,
        peligro: lista.length
          ? (lista.filter((una) => una.peligro).length / lista.length) * 100
          : 0,
        goles: lista.filter((una) => una.gol).length,
      }))
      .sort((a, b) => b.acciones - a.acciones);

    /*
    | Lo mismo, con la familia y el lado SEPARADOS.
    |
    | `porAspecto` los pega en una cadena («corner (en contra)»), que sirve para
    | una lista pero no para poner el córner a favor junto al córner en contra,
    | que es lo que pide el informe del partido. El lado sale del bloque de la
    | hoja: las que acaban en «Def» son las que nos hacen.
    */
    const porLado = new Map<string, AccionAbp[]>();

    deCompeticion.forEach((una) => {
      const lado = una.bloque.endsWith("Def") ? "defensivo" : "ofensivo";

      const clave = `${una.familia}|${lado}`;

      porLado.set(clave, [...(porLado.get(clave) ?? []), una]);
    });

    const porFamiliaYLado = [...porLado.entries()].map(([clave, lista]) => {
      const [familia, lado] = clave.split("|");

      return {
        familia,
        lado: lado as "ofensivo" | "defensivo",
        acciones: lista.length,
        remates: lista.filter((una) => una.remate).length,
        goles: lista.filter((una) => una.gol).length,
        peligros: lista.filter((una) => una.peligro).length,
        xg: Number(lista.reduce((suma, una) => suma + una.xg, 0).toFixed(2)),
      };
    });

    /* Por jornada, en orden de calendario y con la pretemporada delante. */
    const porClave = new Map<string, AccionAbp[]>();

    deCompeticion.forEach((una) => {
      porClave.set(una.jornada.clave, [
        ...(porClave.get(una.jornada.clave) ?? []),
        una,
      ]);
    });

    const porJornada = [...porClave.values()]
      .sort((a, b) => {
        const bloque = (lista: AccionAbp[]) =>
          lista[0].jornada.competicion === "amistoso" ? 0 : 1;

        if (bloque(a) !== bloque(b)) return bloque(a) - bloque(b);

        return (a[0].jornada.numero ?? 0) - (b[0].jornada.numero ?? 0);
      })
      .map((lista) => ({
        etiqueta: lista[0].jornada.corto,
        acciones: lista.length,
        peligro: lista.length
          ? (lista.filter((una) => una.peligro).length / lista.length) * 100
          : 0,
        goles: lista.filter((una) => una.gol).length,
        nota: `${lista[0].jornada.etiqueta} · ${lista[0].rival ?? ""}`,
      }));

    return {
      partidos: porClave.size,
      conPretemporada,
      fueraDePretemporada: conPretemporada ? 0 : cuantasDePretemporada,
      ...todo,
      cuotaRemate: todo.acciones ? (todo.remates / todo.acciones) * 100 : 0,
      cuotaPeligro: todo.acciones ? (todo.peligros / todo.acciones) * 100 : 0,
      ofensivo: resume(ofensivas),
      defensivo: resume(defensivas),
      porAspecto,
      porFamiliaYLado,
      porJornada,
      /* Los nombres sólo valen en lo nuestro: en las hojas defensivas el que
         remata es del rival. */
      rematadores: porJugadorAbp(ofensivas, (una) => una.rematador).map(
        (uno) => ({ jugador: uno.jugador, total: uno.total, peligro: uno.peligro }),
      ),
      sacadores: porJugadorAbp(ofensivas, (una) => una.sacador).map((uno) => ({
        jugador: uno.jugador,
        total: uno.total,
        peligro: uno.peligro,
      })),
    };
  }, [conPretemporada, cuantasDePretemporada, deCompeticion]);

  /*
  | LAS ACCIONES DEL PARTIDO DE LA SEMANA, para el post.
  |
  | De todas las acciones, no de las filtradas por la pretemporada: el partido
  | del micro es oficial y `accionesDelPartido` ya deja fuera los amistosos.
  | Se busca por la jornada del calendario, que es lo que separa la ida de la
  | vuelta contra el mismo rival.
  */
  const accionesPartido = useMemo(
    () =>
      accionesDelPartido(acciones ?? [], {
        rival: datos.partidoCalendario?.rival || datos.rival,
        jornada: datos.partidoCalendario?.jornada ?? null,
        jornadaHoja: datos.partido?.jornada ?? null,
      }),
    [acciones, datos.partidoCalendario, datos.rival, datos.partido],
  );

  /* Las del partido del que viene la semana: el arco de la previa (20/10/2026). */
  const accionesAnterior = useMemo(
    () => (datos.partidoAnterior?.rival ? accionesDelPartido(acciones ?? [], { rival: datos.partidoAnterior.rival }) : []),
    [acciones, datos.partidoAnterior],
  );

  /*
  | PREVIA O POST.
  |
  | Lo propone `modoSugerido` —post si el partido ya se jugó o ya tiene
  | acciones en nuestras hojas— y se puede cambiar a mano. Mientras nadie lo
  | toque, sigue a la propuesta: si las hojas llegan tarde y traen el partido,
  | el informe pasa solo a post.
  */
  const [modoElegido, setModoElegido] = useState<ModoInforme | null>(() => incrustado?.modo ?? null);

  /* Sin partido jugado ni acciones en las hojas no hay post (06/11/2026, expertos): salía vacío. */
  const sinPost = !datos.partidoCalendario?.jugado && accionesPartido.length === 0 && acciones !== null;

  const modo = useMemo<ModoInforme>(
    () =>
      (sinPost && modoElegido === "post" ? "previa" : modoElegido) ??
      modoSugerido({
        fecha: fechaDelPartido(datos),
        jugado: datos.partidoCalendario?.jugado,
        hayAcciones: accionesPartido.length > 0,
      }),
    [modoElegido, datos, accionesPartido, sinPost],
  );

  /*
  | El informe se arma DOS VECES, y no es un descuido.
  |
  | Los gráficos necesitan cosas que sólo salen de armarlo —el objetivo de
  | minutos prorrateado, el reparto de la semana, las tareas valoradas y el
  | seguimiento ya agrupado—, así que primero se monta sin dibujos, con eso se
  | pintan, y se vuelve a montar con ellos dentro. Montarlo es contar y
  | ordenar listas: lo que cuesta es dibujar, y eso se hace una sola vez.
  */
  /* La pizarra de ABP de ese partido, en la previa y en el post (25/10/2026). */
  const pizarraInforme = usePizarraInforme(
    datos.partidoCalendario?.rival || datos.rival || "",
    datos.partidoCalendario?.jornada ?? null,
    players,
  );

  /*
  | La pizarra guardada y nuestro once, para «Para hoy» (31/10/2026): marcas,
  | sacador y rematadores salen de ahí. Va en `base`, no en los gráficos, para
  | que siga mandando aunque la foto de la pizarra no quepa en el correo.
  */
  const pizarraPartido = useMemo(
    () =>
      pizarraParaInforme({
        tablero: pizarraInforme.tablero,
        players,
        onceIds: pizarraInforme.onceIds,
        alturas: pizarraInforme.alturas,
        aereos: comparativa?.aereosNuestros ?? null,
      }),
    [pizarraInforme.tablero, pizarraInforme.onceIds, pizarraInforme.alturas, players, comparativa],
  );

  const base = useMemo<DatosInforme>(
    () => ({
      ...datos,
      seguimientos: filasSeguimiento,
      nombrePorId,
      comparativa,
      propio,
      modo,
      accionesPartido,
      accionesAnterior,
      plantillaRival,
      onceRival,
      clipsPartido,
      /* El cruce, con las mismas acciones que el resto del informe (19/10/2026). */
      conPretemporada,
      pizarraPartido,
    }),
    [datos, filasSeguimiento, nombrePorId, comparativa, propio, modo, accionesPartido, accionesAnterior, plantillaRival, onceRival, clipsPartido, conPretemporada, pizarraPartido],
  );

  const borrador = useMemo(() => construyeInforme(base), [base]);

  /* Los gráficos se dibujan en un lienzo y salen en PNG: un correo no ejecuta
     nada, así que lo único que sobrevive es una imagen. */
  const graficos = useMemo(
    () =>
      graficosDelInforme({
        comparativa,
        propio,
        tiempo: borrador.tiempo,
        tareasValoradas: borrador.tareasValoradas,
        seguimiento: borrador.seguimientoResumen,
        mediaValoracion: borrador.valoracion.media,
        /* En la previa, el rival encendido en los gráficos de la categoría (31/10/2026). */
        rival: modo === "previa" ? rivalVideo : undefined,
      }),
    [comparativa, propio, borrador, modo, rivalVideo],
  );

  /* Lo preparado del rival de la semana en «ABP del Rival»: sus láminas
     van como un gráfico más y sus conclusiones, en su propia sección. */
  const rivalInforme = useAnalisisRivalInforme(datos.rival);

  /*
  | La segunda vuelta, ya con los dibujos y con lo del rival: sus conclusiones
  | entran en las claves de la previa, así que no basta con pegarlas al final.
  | En el post las láminas y las páginas de los PDF del rival no van —ese
  | análisis ya se mandó en la previa, y es lo que más pesa—; sus conclusiones
  | sí, para leerlas con el partido jugado.
  */
  const informe = useMemo(
    () =>
      construyeInforme({
        ...base,
        rivalAnalisis: rivalInforme.cargando ? undefined : rivalInforme.rivalAnalisis,
        graficos:
          modo === "post"
            ? [...graficos, ...pizarraInforme.graficos]
            : [...graficos, ...rivalInforme.graficos, ...pizarraInforme.graficos],
      }),
    [base, graficos, rivalInforme, modo, pizarraInforme.graficos],
  );

  const cargandoSeguimiento = seguimientos === null;

  const cargandoComparativa = comparativa === null && !faltaComparativa;

  const cargandoPropio = acciones === null;

  /*
  | EL VÍDEO PARA LOS JUGADORES (18/10/2026, lo pidió el usuario): delante de
  | nuestro vídeo entero, una entrada con lo principal del informe (portada,
  | cifras, lo que hay que mirar y el rival). Se monta mientras se revisa
  | —tarda más o menos lo que dura el vídeo— y al enviar se usa el que haya o
  | se espera al que va por la mitad. Si no sale, va nuestro vídeo tal cual.
  */
  const informeListo = !cargandoSeguimiento && !cargandoComparativa && !cargandoPropio && !rivalInforme.cargando && !pizarraInforme.cargando;

  /*
  | EL VÍDEO POST DE ABP (02/11/2026, lo pidió el analista): en el post se
  | monta SIEMPRE, sin casilla —lo que preparamos con las jugadas de la
  | pizarra, el partido a balón parado con sus cortes y el balance—, y si hay
  | vídeo nuestro de la jornada va detrás, como en la previa. Espera a saber
  | si lo hay y a tener los cortes, para no montarlo dos veces.
  */
  const esPost = informe.modo === "post";
  const cortesListos = !jornadaPartido || cortesLeidos;
  const rivalPizarra = pizarraInforme.tablero?.rival || rivalVideo;
  const jugadas = useMemo(
    () => (esPost ? jugadasDelTablero(pizarraInforme.tablero, players, { rival: rivalPizarra, temporada: temporadaCorta() }) : []),
    [esPost, pizarraInforme.tablero, players, rivalPizarra],
  );

  /** El vídeo post, en guion (sin montar): lo usan el montaje de aquí y el informe del partido. */
  const videoPost = async (inf: InformeMicro): Promise<VideoPostAbp> => {
    const escudoRival = await escudoDe(rivalVideo);

    const guion = guionPostDeAbp(inf, pinceladaAbp(inf), { escudoRival, rival: rivalVideo, cortesPartido: cortesAbp, jugadas: jugadas.map(({ clave, titulo, segundos }) => ({ clave, titulo, segundos })) });

    return {
      rotulo: `Vídeo post de ABP${rivalVideo ? ` · ${rivalVideo}` : ""}`,
      guion,
      /* El tope nunca deja fuera un corte del balón parado del partido. */
      opciones: { cola: videoJugadores ? { url: videoJugadores.url } : null, tope: topePostAbp(videoJugadores?.segundos ?? null, segundosDeCortesAbp(guion)) },
      jugadas,
    };
  };

  const claveMontaje = !informeListo || !puedeMontarVideo()
    ? ""
    : esPost
      ? videoJugadoresLeido && cortesListos
        ? ["post", videoJugadores?.url ?? "", informe.titulo, informe.partido, ...informe.resumen.map((c) => c.valor), JSON.stringify(informe.partidoAbp?.favor ?? null), JSON.stringify(informe.partidoAbp?.contra ?? null), informe.cierre?.consigna ?? "", ...jugadas.map((j) => j.clave), ...cortesAbp.map((c) => c.url)].join("|")
        : ""
      : conVideo && videoJugadores
        ? [videoJugadores.url, informe.modo, informe.titulo, ...informe.resumen.map((c) => c.valor)].join("|")
        : "";
  const montaje = useRef<Montaje | null>(null);
  const informeVivo = useRef(informe);
  const videoPostVivo = useRef(videoPost);
  const [estadoMontaje, setEstadoMontaje] = useState<EstadoMontaje>({ clave: "", texto: "", listo: false });

  useEffect(() => {
    informeVivo.current = informe;
    videoPostVivo.current = videoPost;
  });

  /*
  | El vídeo post en la vista previa (04/11/2026). La vista previa sólo
  | enseñaba nuestro vídeo de la jornada, y el J10 no lo tiene: el analista no
  | veía vídeo ninguno en el informe aunque el post se montaba y salía en el
  | correo. Ahora, montado, se enseña aquí con un enlace que lo abre.
  */
  const [vistaVideoPost, setVistaVideoPost] = useState<{ clave: string; url: string; segundos: number } | null>(null);

  useEffect(() => {
    if (!esPost || !claveMontaje || !estadoMontaje.listo || estadoMontaje.clave !== claveMontaje) return;

    const enCurso = montaje.current?.clave === claveMontaje ? montaje.current.promesa : null;

    if (!enCurso) return;

    let cancelado = false;
    let url = "";

    void enCurso.then((montado) => {
      if (cancelado || !montado) return;

      url = URL.createObjectURL(montado.blob);
      setVistaVideoPost({ clave: claveMontaje, url, segundos: montado.segundos });
    });

    return () => {
      cancelado = true;

      if (url) URL.revokeObjectURL(url);
    };
  }, [esPost, claveMontaje, estadoMontaje.listo, estadoMontaje.clave]);

  /*
  | En la vista previa, el vídeo tal cual irá (sin el póster, que en el correo
  | va por cid). En el post, el vídeo post montado; mientras se monta, la
  | línea que lo dice. En la previa, nuestro vídeo de la jornada.
  */
  const bloqueVideoVista = esPost
    ? vistaVideoPost && vistaVideoPost.clave === claveMontaje
      ? bloqueVideoHtml({ url: vistaVideoPost.url, cid: "", segundos: vistaVideoPost.segundos, claro: true, relleno: "18px 24px 0", sinCopia: true, rotulo: "Ver el vídeo post de balón parado" })
      : `<tr><td style="padding:18px 24px 0"><p style="margin:8px 4px 0;font:400 13px/1.5 Arial,sans-serif;color:#5B6472">▶ Vídeo post de balón parado: ${!puedeMontarVideo() ? "este navegador no lo puede montar; ábrelo en Chrome o Edge del ordenador para que el correo lo lleve" : estadoMontaje.fallo && estadoMontaje.clave === claveMontaje ? "el montaje no ha salido en este navegador" : "se está montando; aquí sale en cuanto esté y en el correo va enlazado"}.</p></td></tr>`
    : conVideo && videoJugadores
      ? bloqueVideoHtml({ url: videoJugadores.url, cid: "", segundos: videoJugadores.segundos, claro: true, relleno: "18px 24px 0", sinCopia: true, rotulo: "Ver nuestro vídeo de balón parado" })
      : undefined;

  const html = useMemo(() => informeHtml(informe, { video: bloqueVideoVista }), [informe, bloqueVideoVista]);

  /** Lo que se monta para esta clave: el vídeo post o, en la previa, la entrada + nuestro vídeo. */
  const pideMontaje = (inf: InformeMicro) => (alPaso: (texto: string) => void) =>
    inf.modo === "post"
      ? videoPostVivo.current(inf).then((v) => pideVideoPostAbp(v, players, alPaso))
      : escudoDe(rivalVideo).then((escudoRival) =>
          trabajoVideo.pide(rivalVideo ? `Vídeo de ABP · ${rivalVideo}` : "Vídeo de ABP para jugadores", entradaDeAbp(inf, pinceladaAbp(inf), { escudoRival }), {
            cola: { url: videoJugadores!.url },
            tope: SEGUNDOS_ENTRADA_ABP,
            fuente: barlowCondensed.style.fontFamily,
            alPaso,
          }),
        );
  const pideMontajeVivo = useRef(pideMontaje);

  useEffect(() => {
    pideMontajeVivo.current = pideMontaje;
  });

  useEffect(() => {
    if (!claveMontaje || incrustado || montaje.current?.clave === claveMontaje) return;

    /* Unos segundos quieto antes de empezar: cambiar de previa a post no lanza dos montajes. */
    const reloj = window.setTimeout(() => arrancaMontaje(montaje, claveMontaje, pideMontajeVivo.current(informeVivo.current), setEstadoMontaje), 3000);

    return () => window.clearTimeout(reloj);
  }, [claveMontaje, incrustado]);

  /* Lo que el informe no sabe: se enseña al pulsar «Enviar», no en el correo. */
  const [avisando, setAvisando] = useState(false);

  /*
  | 11/11/2026 (expertos): en el móvil «A quién se le manda» ocupaba la primera
  | pantalla y el informe empezaba debajo. Plegado en una línea pegada a
  | «Enviar»; en escritorio sigue a la vista. Lo del analista, un indicador
  | con su contador arriba, que se abre al tocarlo.
  */
  const [verDestinatarios, setVerDestinatarios] = useState(false);
  const [verAnalista, setVerAnalista] = useState(false);

  /* Por WhatsApp (15/10/2026): se prepara igual y, en vez del correo, sale el mensaje con los enlaces. */
  const canal: CanalEnvio = ajustes.canal ?? "correo";
  const telefonosWa = telefonosDe(ajustes.telefonos ?? "");
  const { apunta } = useAgendaEnvios();

  /*
  | Qué envío es (02/11/2026): el mismo informe por el mismo canal no se lanza
  | dos veces a la vez. Si se cierra y se vuelve a abrir con el envío en
  | marcha, el botón sigue diciendo que se está enviando.
  */
  const claveEnvioAbp = `abp|${informe.titulo}|${informe.modo}|${canal}`;
  const enviandoFuera = useSyncExternalStore(trabajoEnvios.suscribe, () => trabajoEnvios.enMarcha(claveEnvioAbp), () => false);
  const ocupado = enviando || enviandoFuera;

  const envia = async () => {
    if (ocupado) return;

    const para = ajustes.destinatarios.trim();

    if (canal === "correo" && !para) {
      toast.error("Escribe al menos una dirección de correo.");
      return;
    }

    if (canal === "whatsapp" && telefonosWa.malos.length) {
      toast.error("Hay teléfonos mal escritos", { description: telefonosWa.malos.join(", ") });
      return;
    }

    /*
    | EN SEGUNDO PLANO (02/11/2026): el envío entero —esperar el vídeo, armar
    | y subir el PDF, mandar el correo— pasa a `lib/informes/trabajo-envios.ts`.
    | Se puede cerrar el diálogo o cambiar de pantalla; el panel de los
    | informes dice por dónde va y, al acabar, sale el aviso. Dos iguales a la
    | vez, no.
    */
    const claveEnvio = claveEnvioAbp;

    if (trabajoEnvios.enMarcha(claveEnvio)) {
      toast.message("Este informe ya se está enviando", { description: "Abajo a la izquierda ves por dónde va." });
      return;
    }

    const prepara =async (avance: (texto: string) => void) => {
      /*
      | El correo pasa por una función de Vercel, que no admite peticiones de
      | más de ~4,5 MB. Las páginas de los PDF del rival son lo que más pesa:
      | si con ellas no cabe, salen del correo (el enlace al PDF se queda) y se
      | dice.
      */
      const peso = (lista: typeof informe.graficos) => lista.reduce((s, g) => s + g.imagen.length, 0);

      /* Primero se aligera todo; sólo si aun así no cabe, salen las páginas de los PDF. */
      const ligeros = [];

      for (const grafico of informe.graficos) ligeros.push({ ...grafico, imagen: await aligera(grafico.imagen) });

      const sinPdf = ligeros.filter((g) => !g.cid.startsWith("rival-doc-"));

      const caben = peso(ligeros) < TOPE_CORREO;

      let paraEnviar = { ...informe, graficos: caben ? ligeros : sinPdf };

      /* Lo siguiente que sale es la pizarra: se puede abrir en la app, el resto del informe no. */
      if (peso(paraEnviar.graficos) >= TOPE_CORREO) {
        const sinPizarra = paraEnviar.graficos.filter((g) => g.area !== "pizarra");

        if (sinPizarra.length < paraEnviar.graficos.length && peso(sinPizarra) < TOPE_CORREO) {
          paraEnviar = construyeInforme({ ...base, rivalAnalisis: informe.rivalAnalisis, graficos: sinPizarra });

          toast.message("La pizarra del partido no cabe en el correo", {
            description: "Se ve en la pizarra de ABP de la app; el resto del informe va entero.",
          });
        }
      }

      if (peso(paraEnviar.graficos) >= TOPE_CORREO) {
        throw new Error("El informe pesa demasiado para mandarlo por correo, incluso sin las páginas de los PDF.");
      }

      if (!caben) {
        toast.message("Las páginas de los PDF del rival no caben en el correo", {
          description: "Van como enlace a cada PDF; las láminas sí van dentro.",
        });
      }

      const adjuntosUrl: { nombre: string; url: string; tipo: string }[] = [];
      /*
      | Nuestro vídeo de la jornada, ya en el almacén: va ENLAZADO (póster y
      | botón en el correo, y la última página del PDF). Completo pasa de lo que
      | cabe en un correo, así que no se adjunta.
      */
      let infoVideo: { url: string; segundos: number; poster: string | null; rotulo: string } | null = null;

      /*
      | El montado: en el post, el vídeo post (siempre, 02/11/2026); en la
      | previa, la entrada del informe + nuestro vídeo. El que haya, o se
      | espera al que va por la mitad.
      */
      if (claveMontaje && (esPost || (conVideo && videoJugadores))) {
        const enCurso = montaje.current?.clave === claveMontaje ? montaje.current.promesa : arrancaMontaje(montaje, claveMontaje, pideMontaje(informe), setEstadoMontaje);

        avance("terminando el montaje…");

        /* Con tope (03/11/2026): si el montaje se para, el correo sale sin el vídeo en vez de quedarse esperando. */
        const montado = await Promise.race([enCurso.catch(() => null), new Promise<null>((listo) => setTimeout(() => listo(null), 8 * 60_000))]);

        if (montado) {
          try {
            const nombre = `${paraEnviar.titulo} - Balón parado${esPost ? " post" : ""} en vídeo.mp4`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ");
            const subido = await subeAdjunto(new File([montado.blob], nombre, { type: "video/mp4" }), (f) => avance(`subiendo ${Math.round(f * 100)} %`));

            infoVideo = { url: subido.url, segundos: montado.segundos, poster: montado.poster ?? null, rotulo: esPost ? "Ver el vídeo post de balón parado" : "Ver nuestro vídeo de balón parado" };
          } catch (error) {
            console.warn("[abp] el vídeo montado no ha subido", error);
            toast.message(videoJugadores ? "Va nuestro vídeo sin la entrada del informe" : "El correo va sin el vídeo post", { description: error instanceof Error ? error.message : "No ha subido." });
          }
        } else {
          toast.message(videoJugadores ? "Va nuestro vídeo sin la entrada del informe" : "El correo va sin el vídeo post", { description: "No se ha podido montar en este navegador." });
        }
      }

      if ((esPost || conVideo) && videoJugadores && !infoVideo) {
        avance("preparando el enlace…");

        const poster = videoJugadores.poster
          ? /* Con tope (03/11/2026): sin póster, el correo sale igual. */
            await fetch(videoJugadores.poster, { signal: corteDeRed(20_000) })
              .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
              .then(
                (b) =>
                  new Promise<string>((resolve, reject) => {
                    const lector = new FileReader();

                    lector.onload = () => resolve(String(lector.result));
                    lector.onerror = () => reject(lector.error);
                    lector.readAsDataURL(b);
                  }),
              )
              .catch(() => null)
          : null;

        infoVideo = { url: videoJugadores.url, segundos: videoJugadores.segundos, poster, rotulo: "Ver nuestro vídeo de balón parado" };
        avance("");
      }

      /*
      | UN PDF Y UN VÍDEO (16/10/2026): el informe entero en PDF va adjunto
      | delante del vídeo. Desde el 18/10/2026 la página «Vídeo y documentos»
      | (el vídeo enlazado y los PDF del rival) es la PRIMERA: lo primero que
      | se ve al abrirlo, también desde WhatsApp. Si no sale, se sigue sin él.
      */
      let pdf: File | null = null;
      let enlacePdf: { nombre: string; url: string } | null = null;

      try {
        avance("armando el PDF…");

        const hojas = await completoEnHojas(informeHtml(paraEnviar), (h, t) => avance(`PDF ${h}/${t}…`), { titulo: paraEnviar.titulo });
        const portada = await paginaDeEnlaces({
          titulo: paraEnviar.titulo,
          video: infoVideo,
          ...(esPost && infoVideo && infoVideo.rotulo !== "Ver nuestro vídeo de balón parado" ? { rotuloVideo: `Balón parado · post${jornadaPartido ? ` · J${jornadaPartido}` : ""}` } : {}),
          enlaces: (paraEnviar.rivalAnalisis?.documentos ?? []).map((d) => ({ nombre: d.nombre, url: d.url, detalle: "Informe del rival en PDF" })),
        }).catch(() => null);
        const conPortada = Boolean(infoVideo || paraEnviar.rivalAnalisis?.documentos?.length);
        const blob = await informeUnicoPdf({ titulo: paraEnviar.titulo, diapos: [], hojas, inicio: conPortada ? portada : null });
        /* «J8 · RM Castilla - Antequera CF · ABP» (18/10/2026): la jornada y el partido, en el archivo y en el enlace. */
        const pc = datos.partidoCalendario;
        const partido = { jornada: pc?.jornada ?? null, local: pc ? (pc.lado === "casa" ? "RM Castilla" : pc.rival) : "", visitante: pc ? (pc.lado === "casa" ? pc.rival : "RM Castilla") : "" };
        const titulo = nombrePartidoPdf({ ...partido, sufijo: "ABP", respaldo: paraEnviar.titulo });
        const nombrePdf = `${titulo}.pdf`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ");

        pdf = new File([blob], nombrePdf, { type: "application/pdf" });

        const subido = await subeAdjunto(pdf, (f) => avance(`subiendo el PDF ${Math.round(f * 100)} %`));

        /* El correo adjunta el PDF desde el almacén; WhatsApp lleva el enlace con la tarjeta (escudos e icono de PDF). */
        avance("tarjeta del enlace…");
        enlacePdf = { nombre: nombrePdf, url: await enlaceConTarjeta(subido, { ...partido, titulo, detalle: `Balón parado · ${paraEnviar.modoRotulo}`, fuente: barlowCondensed.style.fontFamily }) };
        adjuntosUrl.unshift({ nombre: nombrePdf, url: subido.url, tipo: "application/pdf" });
      } catch (error) {
        console.warn("[abp] el PDF del informe no ha salido", error);
        toast.message("El correo va sin el PDF del informe", { description: error instanceof Error ? error.message : "No se ha podido armar." });
      } finally {
        avance("");
      }

      return { paraEnviar, adjuntosUrl, infoVideo, pdf, enlacePdf };
    };

    /* Lo ya montado, armado y subido se guarda: «Reintentar» sólo vuelve a mandar (02/11/2026). */
    let preparado: ReturnType<typeof prepara> | null = null;

    const corre = async (pasoTrabajo: (texto: string) => void): Promise<ResultadoEnvio> => {
      const avance = (texto: string) => {
        setPasoVideo(texto);
        if (texto) pasoTrabajo(texto);
      };

      setEnviando(true);
      setFallo("");

    try {
      const listo = (preparado ??= prepara(avance).catch((error: unknown) => {
        preparado = null;
        throw error;
      }));
      const { paraEnviar, adjuntosUrl, infoVideo, pdf, enlacePdf } = await listo;

      pasoTrabajo(canal === "whatsapp" ? "escribiendo el mensaje…" : "mandando el correo…");

      /*
      | Por WhatsApp (18/10/2026): nada de informe en texto —quedaba pobre—.
      | Mensaje corto con el PDF y el vídeo, y el PDF se puede compartir como
      | archivo (el panel lo ofrece si el aparato deja).
      |
      | Abrir wa.me necesita el clic de la persona (02/11/2026): el mensaje,
      | con sus enlaces ya subidos, queda en el panel de los informes y el
      | aviso lleva «Abrir WhatsApp».
      */
      if (canal === "whatsapp") {
        const mensajes: MensajeWhatsapp[] = [
          {
            titulo: "Informe de balón parado",
            /* Formato corto (20/10/2026, equipo de expertos): titular, la idea
               y la clave de la semana, y los enlaces. Igual que el del partido. */
            texto: mensajeWhatsapp({
              /* Previa (31/10/2026): titular corto y, debajo, defensa, marcas y ataque. */
              asunto: (paraEnviar.modo === "previa" && pinceladaAbp(paraEnviar).whatsappAsunto) || paraEnviar.asunto,
              lineas: (() => {
                const p = pinceladaAbp(paraEnviar);

                /* El asunto ya es la idea (20/10/2026, tercera ronda): debajo, el porqué y
                   lo que dice el rival, sin repetir el titular. */
                return paraEnviar.modo === "previa" && p.whatsapp?.length ? p.whatsapp : p.claves.slice(0, 2);
              })(),
              video: (infoVideo as { url: string } | null)?.url ?? null,
              enlaces: adjuntosUrl.map((a) => (enlacePdf && a.nombre === enlacePdf.nombre ? { ...a, url: enlacePdf.url } : a)),
              documentosPrimero: true,
            }),
          },
        ];
        apunta("whatsapp", telefonosWa.buenos);

        return {
          titulo: "Informe de balón parado listo para WhatsApp",
          texto: "El mensaje va escrito con el PDF y el vídeo enlazados.",
          whatsapp: { mensajes, telefonos: telefonosWa.buenos, archivo: pdf },
        };
      }

      const respuesta = await fetch("/api/abp/informe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          para,
          adjuntosUrl,
          asunto: paraEnviar.asunto,
          /* En el correo las imágenes no van dentro del HTML: se llaman por su
             `cid` y viajan como partes aparte, que es lo único que Gmail pinta. */
          html: informeHtml(paraEnviar, {
            imagenes: "cid",
            video: infoVideo ? bloqueVideoHtml({ url: infoVideo.url, cid: infoVideo.poster ? "video-poster" : "", segundos: infoVideo.segundos, claro: true, relleno: "18px 24px 0", sinCopia: true, rotulo: infoVideo.rotulo }) : undefined,
          }),
          texto: informeTexto(paraEnviar),
          imagenes: [
            ...paraEnviar.graficos.map((grafico) => ({
              cid: grafico.cid,
              /* PNG o JPEG (las páginas de los PDF): cada una con su tipo. */
              tipo: grafico.imagen.match(/^data:([^;]+);base64,/)?.[1] ?? "image/png",
              base64: grafico.imagen.replace(/^data:[^;]+;base64,/, ""),
            })),
            /* El póster del vídeo, que el bloque llama por `cid:video-poster`. */
            ...(infoVideo?.poster ? [{ cid: "video-poster", tipo: "image/jpeg", base64: infoVideo.poster.replace(/^data:[^;]+;base64,/, "") }] : []),
          ],
        }),
      });

      /*
      | El envío pide sesión del cuerpo técnico o de administrador: sin ella el
      | servidor contesta 401, y el motivo tiene que decirse claro, no como un
      | «no se ha podido enviar» que no dice qué hacer.
      */
      if (respuesta.status === 401) {
        throw new Error("Entra con tu cuenta del cuerpo técnico (la de la quiniela) para poder mandar el informe.");
      }

      const datosRespuesta = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        cuenta?: string;
        para?: string[];
      } | null;

      if (!respuesta.ok || !datosRespuesta?.ok) {
        throw new Error(datosRespuesta?.error ?? "No se ha podido enviar.");
      }

      const cuantos = datosRespuesta.para?.length ?? 0;

      /* A quién se ha mandado, a la agenda: la próxima vez se propone. */
      apunta("correo", datosRespuesta.para ?? para.split(/[\s,;]+/).filter(Boolean));

      return {
        titulo: `Informe de balón parado enviado a ${cuantos} destinatario${cuantos === 1 ? "" : "s"}`,
        texto: datosRespuesta.cuenta ? `${paraEnviar.asunto} · desde ${datosRespuesta.cuenta}` : paraEnviar.asunto,
      };
    } catch (error) {
      const dice =
        error instanceof Error ? error.message : "No se ha podido enviar.";

      /* El largo, con la dirección a la que hay que ir, se queda escrito
         debajo del botón si el diálogo sigue abierto; el aviso y el panel
         de los informes lo dicen estés donde estés (02/11/2026). */
      setFallo(dice);

      throw error instanceof Error ? error : new Error(dice);
    } finally {
      setEnviando(false);
      setPasoVideo("");
    }
    };

    trabajoEnvios.lanza({
      clave: claveEnvio,
      rotulo: `Informe de balón parado · ${informe.titulo} · ${informe.modoRotulo}`,
      href: "/abp-microciclo",
      ejecuta: corre,
    });
  };

  /*
  | INCRUSTADO: cuando ya está todo, se arma una vez y se entrega. Si en un
  | minuto no ha llegado todo, se entrega el fallo: quien espera tiene que
  | saber que no va a venir.
  */
  const clave = `${datos.temporada}|${datos.micro}`;

  const entregado = useRef(false);

  /* En el post, también saber si hay vídeo nuestro y los cortes: el vídeo post va en el resultado (02/11/2026). */
  const listo = !cargandoSeguimiento && !cargandoComparativa && !cargandoPropio && !rivalInforme.cargando && !pizarraInforme.cargando && (!esPost || (videoJugadoresLeido && cortesListos));


  const alListo = incrustado?.alListo;

  /* Qué falta, para decirlo si se acaba el tiempo (03/11/2026): «no ha terminado» a secas no deja saber qué pieza se queda colgada. */
  const faltan = useRef<string[]>([]);

  useEffect(() => {
    faltan.current = [
      cargandoSeguimiento && "seguimiento",
      cargandoComparativa && "comparativa",
      cargandoPropio && "datos propios",
      rivalInforme.cargando && "análisis del rival",
      pizarraInforme.cargando && "pizarra",
      esPost && !videoJugadoresLeido && "vídeo de jugadores",
      esPost && !cortesListos && "cortes",
    ].filter((x): x is string => Boolean(x));
  });

  useEffect(() => {
    if (!alListo) return;

    const reloj = window.setTimeout(() => {
      if (entregado.current) return;

      entregado.current = true;

      alListo({ ok: false, clave, error: `El informe de balón parado no ha terminado de cargar en un minuto${faltan.current.length ? ` (falta: ${faltan.current.join(", ")})` : ""}.` });
    }, ESPERA_INCRUSTADO);

    return () => window.clearTimeout(reloj);
  }, [alListo, clave]);

  useEffect(() => {
    if (!alListo || !listo || entregado.current) return;

    let cancelado = false;

    imagenesQueCaben(informe, TOPE_INCRUSTADO)
      /* El vídeo post, en guion, del informe ENTERO (no del aligerado): el mismo que monta este diálogo, así la huella coincide. */
      .then(async (r) => ({ ...r, video: informe.modo === "post" && puedeMontarVideo() ? await videoPostVivo.current(informe).catch(() => null) : null }))
      .then(({ informe: paraEnviar, avisos, video }) => {
        if (cancelado || entregado.current) return;

        entregado.current = true;

        alListo({
          video,
          ok: true,
          clave,
          modo: paraEnviar.modo,
          asunto: paraEnviar.asunto,
          cuerpo: informeCuerpoHtml(paraEnviar, { imagenes: "cid", prefijoCid: PREFIJO_CID }),
          texto: informeTexto(paraEnviar),
          imagenes: paraEnviar.graficos.map((grafico) => ({
            cid: `${PREFIJO_CID}${grafico.cid}`,
            tipo: grafico.imagen.match(/^data:([^;]+);base64,/)?.[1] ?? "image/png",
            base64: grafico.imagen.replace(/^data:[^;]+;base64,/, ""),
          })),
          pincelada: pinceladaAbp(paraEnviar),
          avisos: [...paraEnviar.avisos, ...avisos],
        });
      })
      .catch((error) => {
        if (cancelado || entregado.current) return;

        entregado.current = true;

        alListo({ ok: false, clave, error: error instanceof Error ? error.message : "No se ha podido armar el informe de balón parado." });
      });

    return () => {
      cancelado = true;
    };
  }, [alListo, listo, informe, clave]);

  /* Incrustado no se enseña nada, pero la pizarra tiene que montarse para
     fotografiarla (03/11/2026): con `null` el lienzo no existía, la pizarra
     se quedaba «cargando» y el informe del partido esperaba un minuto para
     acabar saliendo sin balón parado. */
  /*
  | DESCARGAR SIN MANDAR (07/11/2026, ronda 14 de jueces): el informe sólo
  | salía por correo o WhatsApp. Ahora, desde el menú «Descargar»: el PDF (el
  | mismo del correo, sin la página del vídeo) y las láminas sueltas; y «Ver
  | en grande» abre el correo en una pestaña, donde el móvil deja ampliarlo.
  */
  const nombreDescarga = (() => {
    const pc = datos.partidoCalendario;

    const partido = { jornada: pc?.jornada ?? null, local: pc ? (pc.lado === "casa" ? "RM Castilla" : pc.rival) : "", visitante: pc ? (pc.lado === "casa" ? pc.rival : "RM Castilla") : "" };

    return nombrePartidoPdf({ ...partido, sufijo: `ABP ${esPost ? "post" : "previa"}`, respaldo: informe.titulo }).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  })();

  /*
  | En segundo plano (08/11/2026, como las de la pizarra de ABP): el clic deja
  | el encargo con el HTML del informe de ese momento y vuelve; la píldora
  | enseña el progreso, avisa al terminar y sigue aunque se cierre el diálogo.
  | Todo es dato (el completo monta su propia caja): sin mesa.
  */
  const bajaPdfAbp = () => {
    const titulo = `Informe de ABP en PDF · ${nombreDescarga}`;

    if (descargaEnMarcha(titulo)) return;

    const cuerpo = informeHtml(informe);
    const tituloDoc = informe.titulo;
    const nombre = `${nombreDescarga}.pdf`;

    encargaDescarga({
      titulo,
      vuelta: "/abp-microciclo",
      tarea: async ({ avanza }) => {
        avanza("Preparando el PDF…");

        const hojas = await completoEnHojas(cuerpo, (h, t) => avanza(`PDF · hoja ${h} de ${t}…`, t ? (h / t) * 0.9 : undefined), { titulo: tituloDoc });

        avanza("Montando el PDF…", 0.95);

        return { blob: await informeUnicoPdf({ titulo: tituloDoc, diapos: [], hojas }), nombre };
      },
    });
  };

  /* Las láminas y gráficos del informe, una imagen cada uno (sin las páginas de los PDF del rival, que ya son PDF). */
  const laminasAbp = informe.graficos.filter((g) => !g.cid.startsWith("rival-doc-"));

  const bajaLaminasAbp = () => {
    const titulo = `Láminas de ABP · ${nombreDescarga}`;

    if (descargaEnMarcha(titulo)) return;

    const laminas = laminasAbp.map((g, i) => ({
      imagen: g.imagen,
      nombre: `${nombreDescarga} - ${String(i + 1).padStart(2, "0")} ${g.titulo}`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() + `.${/^data:image\/jpe?g/.test(g.imagen) ? "jpg" : "png"}`,
    }));

    encargaDescarga({
      titulo,
      vuelta: "/abp-microciclo",
      tarea: async ({ avanza }) => {
        const salida: { blob: Blob; nombre: string }[] = [];

        for (const [i, l] of laminas.entries()) {
          avanza(`Lámina ${i + 1} de ${laminas.length}…`, i / laminas.length);
          salida.push({ blob: await (await fetch(l.imagen)).blob(), nombre: l.nombre });
        }

        return salida;
      },
    });
  };

  /* El correo tal cual, en una pestaña: en el móvil se amplía con los dedos (en el marco, encogido a 390 px, no se leía). */
  const verEnGrandeAbp = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));

    const ventana = window.open(url, "_blank");

    if (!ventana) toast.message("El navegador no ha dejado abrir la pestaña", { description: "Permite las ventanas emergentes de esta web y vuelve a probar." });

    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (incrustado) return <>{pizarraInforme.deck}</>;

  return (
    <Dialog
      /* Jornada, rival y semana como el informe del partido (11/11/2026, análisis): «Balón parado · Previa · J12 · Gimnàstic Tarragona · fuera». */
      title={informe.cabecera?.titulo || `${informe.titulo} · ${informe.modoRotulo}`}
      subtitle={informe.cabecera?.subtitulo || [informe.subtitulo, informe.rango].filter(Boolean).join(" · ")}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {fallo ? (
            <p className="min-w-0 basis-full text-[11px] leading-relaxed text-rose-300">
              {conEnlace(fallo)}
            </p>
          ) : null}

          <div className="min-w-0 space-y-1">
            {esPost ? (
              /* Post (02/11/2026): el vídeo sale siempre; aquí sólo se dice qué lleva y por dónde va. */
              <p className="text-[11px] text-white/70">
                Vídeo post de balón parado: lo que preparamos{jugadas.length ? ` (${jugadas.length === 1 ? "una jugada" : `${jugadas.length} jugadas`} de la pizarra)` : ""}, el partido
                {cortesAbp.length ? ` con ${cortesAbp.length} cortes` : ""} y el balance
                {videoJugadores ? ` · después, «${videoJugadores.nombre.replace(/\.[a-z0-9]+$/i, "")}» entero` : ""}.
              </p>
            ) : videoJugadores ? (
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/70" title={videoJugadores.nombre}>
                <input type="checkbox" className="accent-[#C8A96B]" checked={conVideo} disabled={ocupado} onChange={(e) => setConVideo(e.target.checked)} />
                Incluir nuestro vídeo de la jornada · «{videoJugadores.nombre.replace(/\.[a-z0-9]+$/i, "")}» ({Math.floor(videoJugadores.segundos / 60)}:{String(videoJugadores.segundos % 60).padStart(2, "0")}), con la entrada del informe delante
              </label>
            ) : null /* Cómo se le pone el vídeo: en el plegable del analista, al final (06/11/2026). */}
            {(esPost || (conVideo && videoJugadores)) && claveMontaje && estadoMontaje.clave === claveMontaje ? (
              <p className={`text-[11px] ${estadoMontaje.fallo ? "text-amber-300/80" : "text-white/45"}`}>
                {estadoMontaje.listo
                  ? esPost
                    ? "Vídeo post montado: va enlazado en el correo, el PDF y WhatsApp."
                    : "Vídeo montado: la entrada del informe y después el nuestro entero."
                  : estadoMontaje.fallo
                    ? `El montaje no ha salido (${estadoMontaje.fallo})${videoJugadores ? ": irá nuestro vídeo tal cual" : ""}.`
                    : `Montando el vídeo mientras revisas (sigue aunque cierres) · ${estadoMontaje.texto}`}
              </p>
            ) : null}
            {ocupado ? (
              /* 02/11/2026: el envío ya no depende de esta ventana. */
              <p className="text-[11px] text-[#C8A96B]">Puedes cerrar y seguir con otra cosa: se sigue enviando y te avisa al terminar.</p>
            ) : null}
          </div>

          {/*
          | EL ENVÍO, TODO EN LA BARRA FIJA DE ABAJO (11/11/2026, expertos): el
          | canal, el teléfono o los correos y «Enviar» van juntos aquí, y la
          | vista previa queda arriba, lo primero. Plegado en una línea («Por
          | WhatsApp · 1 teléfono · cambiar»); al tocarla se abre la lista.
          */}
          {verDestinatarios ? (
            <div className="max-h-[40vh] min-w-0 basis-full overflow-y-auto [&_span.rounded-md]:lowercase">
              <Destinatarios
                label="A quién se le manda"
                canal={canal}
                onCanal={(c) => setAjustes((a) => ({ ...a, canal: c }))}
                correos={ajustes.destinatarios}
                onCorreos={(destinatarios) => setAjustes((a) => ({ ...a, destinatarios }))}
                telefonos={ajustes.telefonos ?? ""}
                onTelefonos={(telefonos) => setAjustes((a) => ({ ...a, telefonos }))}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setVerDestinatarios((v) => !v)}
            aria-expanded={verDestinatarios}
            className="min-h-9 min-w-0 basis-full truncate text-left text-[12px] text-white/70 underline-offset-2 hover:underline sm:basis-auto sm:flex-1"
          >
            {(() => {
              if (canal === "whatsapp") {
                const n = telefonosDe(ajustes.telefonos ?? "").buenos.length;

                return `Por WhatsApp · ${n ? `${n} ${n === 1 ? "teléfono" : "teléfonos"}` : "eliges el chat al enviar"} · ${verDestinatarios ? "ocultar" : "cambiar"}`;
              }

              const n = ajustes.destinatarios.split(/[,;\s]+/).filter((x) => x.includes("@")).length;

              return `Por correo · ${n ? `${n} ${n === 1 ? "destinatario" : "destinatarios"}` : "elige a quién"} · ${verDestinatarios ? "ocultar" : "cambiar"}`;
            })()}
          </button>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {/* En el móvil sobra «Cerrar» (la X de arriba cierra): así caben «Descargar» y «Enviar» en una fila (07/11/2026). */}
            <span className="hidden sm:contents">
              <Button onClick={onClose}>Cerrar</Button>
            </span>

            <MenuDescargar
              disabled={cargandoSeguimiento || cargandoComparativa || cargandoPropio || rivalInforme.cargando || pizarraInforme.cargando}
              opciones={[
                { id: "pdf", rotulo: "Informe en PDF", detalle: "El mismo que va en el correo, para guardarlo o pasarlo", icon: BookOpen, onSelect: () => void bajaPdfAbp() },
                ...(laminasAbp.length
                  ? [{ id: "laminas", rotulo: `Láminas y gráficos (${laminasAbp.length})`, detalle: "Una imagen cada uno, para WhatsApp o una charla", icon: ImageIcon, onSelect: () => void bajaLaminasAbp() }]
                  : []),
                { id: "grande", rotulo: "Ver en grande", detalle: "El correo en una pestaña: en el móvil se amplía con los dedos", icon: Maximize2, onSelect: verEnGrandeAbp },
              ]}
            />

            <Button
              tone="primary"
              icon={ocupado ? Loader2 : Send}
              onClick={() => (informe?.avisos.length ? setAvisando(true) : void envia())}
              disabled={
                ocupado ||
                cargandoSeguimiento ||
                cargandoComparativa ||
                cargandoPropio ||
                /* Sin esto el correo salía sin las láminas del rival si se pulsaba pronto. */
                rivalInforme.cargando ||
                pizarraInforme.cargando
              }
            >
              {ocupado ? (pasoVideo ? `Enviando · ${pasoVideo}` : "Enviando…") : canal === "whatsapp" ? "Preparar WhatsApp" : "Enviar por correo"}
            </Button>
          </div>
        </div>
      }
    >
      {/*
      | 06/11/2026: la vista previa empezaba tras mucho scroll. Arriba queda una
      | fila compacta (previa/post y a quién) y el asunto a la vista; el filtro
      | de pretemporada y la entradilla, plegados con su resumen de una línea;
      | lo del analista, en un único plegable al final. El `pb-24` en móvil deja
      | que el final del informe asome por encima de los botones flotantes.
      */}
      {/*
      | 11/11/2026 (expertos): la vista previa, lo primero. Arriba sólo una
      | línea (previa o post); el envío va en la barra fija de abajo y lo del
      | analista, al final junto a «Así llega».
      */}
      <div className="space-y-3 pb-24 sm:pb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {/*
          | PREVIA O POST. Dos informes distintos de la misma semana: la previa
          | cuenta qué se va a hacer y por qué; el post, qué pasó en el partido y
          | si lo entrenado apareció. El asunto lleva la idea de cada uno (`asuntoAbp`).
          */}
          <div className="contents">
            {/*
            | 10/11/2026 (jueces): sin partido jugado, la pestaña «Post» no se
            | enseña apagada (el gris no llegaba al contraste mínimo en modo
            | día y el texto fijo se metía entre el selector y el título): sólo
            | sale cuando hay post que sacar.
            */}
            {sinPost ? (
              <p className="w-fit rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1.5 text-[12px] font-semibold text-[color:var(--rmcf-gold-ink)]">
                Previa del partido
              </p>
            ) : (
              <div className="flex w-fit items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                {(
                  [
                    { valor: "previa", rotulo: "Previa del partido" },
                    { valor: "post", rotulo: "Post partido" },
                  ] as { valor: ModoInforme; rotulo: string }[]
                ).map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    onClick={() => setModoElegido(opcion.valor)}
                    aria-pressed={modo === opcion.valor}
                    className={`rounded-lg px-3 py-1.5 text-[12px] transition ${
                      modo === opcion.valor
                        ? "bg-[#C8A96B]/15 text-[color:var(--rmcf-gold-ink)]"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {opcion.rotulo}
                  </button>
                ))}
              </div>
            )}

            <p className="min-w-0 flex-1 text-[12px] leading-snug text-white/55">
              {modo === "post"
                ? accionesPartido.length > 0
                  ? `Qué pasó: las ${accionesPartido.length} acciones de la ${accionesPartido[0].jornada.etiqueta.toLowerCase()} en nuestras hojas, cruzadas con lo trabajado.`
                  : cargandoPropio
                    ? "Buscando el partido en nuestras hojas de ABP…"
                    : "Qué pasó. El partido todavía no tiene acciones en nuestras hojas de ABP."
                : "Qué vamos a hacer y por qué: la semana, las urgencias, el rival y las claves."}
            </p>
          </div>

          {/* A quién se manda: en la barra fija de abajo, junto a «Enviar» (11/11/2026). */}
        </div>

        {/*
        | QUÉ PARTIDOS ENTRAN EN EL DATO PROPIO.
        |
        | Por defecto, sólo competición. La pretemporada son siete partidos de
        | julio contra tres de liga, y mezclándola el informe presumía de
        | cuatro goles a balón parado que no se habían hecho en competición.
        | Plegado: el resumen dice el efecto sin abrirlo.
        */}
        {pizarraInforme.deck}

        {/*
          La vista previa es el correo de verdad, no una maqueta: se pinta el
          mismo HTML que se manda, en un marco aislado para que sus estilos no
          se mezclen con los de la app. 10/11/2026 (jueces): el documento va
          antes que los plegables (pretemporada, asunto, lo del analista), y
          «Ver en grande» sale fuera del marco: tapaba la fecha de la cabecera.
        */}
        <div className="overflow-hidden rounded-xl border border-white/10">
          <iframe
            title="Vista previa del informe"
            srcDoc={html}
            className="h-[75vh] w-full bg-white sm:h-[58vh]"
            /* El correo mide 860 px y el marco menos: se encoge para que se lea entero, sin barra lateral ni titulares cortados (20/10/2026). */
            onLoad={(e) => {
              const marco = e.currentTarget;

              const ajusta = () => {
                const raiz = marco.contentDocument?.documentElement;

                if (!raiz) return;

                raiz.style.zoom = "";

                const zoom = raiz.scrollWidth > raiz.clientWidth + 1 ? raiz.clientWidth / raiz.scrollWidth : 1;
                /* El alto sin encoger: se mide antes de poner el zoom y se multiplica. */
                const alto = raiz.scrollHeight;

                if (zoom < 1) raiz.style.zoom = String(zoom);

                /*
                | En el móvil (11/11/2026, expertos), el marco crece hasta el alto
                | del correo: era una ventana con su scroll dentro de otro scroll.
                | Así el informe se lee con el scroll de la página.
                */
                if (window.matchMedia("(max-width: 639px)").matches) {
                  marco.style.height = `${Math.ceil(alto * zoom) + 8}px`;
                } else {
                  marco.style.height = "";
                }
              };

              ajusta();

              /*
              | Otra vez cuando acaban de pintarse la letra y los gráficos
              | (11/11/2026, fútbol): medido sólo al cargar, el alto se quedaba
              | corto y volvía la caja con su propio scroll en el móvil.
              */
              [400, 1500, 4000].forEach((ms) => window.setTimeout(ajusta, ms));
              marco.contentDocument?.fonts?.ready.then(ajusta).catch(() => undefined);
            }}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={verEnGrandeAbp}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#C8A96B]/50 px-3 py-1.5 text-[12px] font-semibold text-[color:var(--rmcf-gold-ink)] hover:bg-[#C8A96B]/10"
            title="Abrir el correo en una pestaña, para leerlo a pantalla completa"
          >
            <Maximize2 size={13} /> Ver en grande
          </button>
        </div>

        {cuantasDePretemporada > 0 && (
          <details className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <summary className="cursor-pointer text-[11px] text-white/50 hover:text-white">
              {(() => {
                const n = propio?.partidos;
                const cuantos = n ? ` (${n === 1 ? "un partido" : `${n} partidos`})` : "";

                return conPretemporada
                  ? `Con pretemporada${cuantos}: las cifras de abajo cuentan también los amistosos de verano`
                  : `Sólo competición${cuantos}: las cifras de abajo no cuentan la pretemporada`;
              })()}
            </summary>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                {[
                  { valor: false, rotulo: "Sólo competición" },
                  { valor: true, rotulo: "Con pretemporada" },
                ].map((opcion) => (
                  <button
                    key={opcion.rotulo}
                    type="button"
                    onClick={() => setConPretemporada(opcion.valor)}
                    aria-pressed={conPretemporada === opcion.valor}
                    className={`rounded-lg px-3 py-1.5 text-[11px] transition ${
                      conPretemporada === opcion.valor
                        ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {opcion.rotulo}
                  </button>
                ))}
              </div>

              <span className="text-[11px] text-white/35">
                {conPretemporada
                  ? `Dentro van también las ${cuantasDePretemporada} acciones de los amistosos de verano.`
                  : `Fuera quedan ${cuantasDePretemporada} acciones de pretemporada: el informe habla de competición.`}
              </span>
            </div>
          </details>
        )}

        {cargandoSeguimiento || cargandoComparativa || cargandoPropio || rivalInforme.cargando || pizarraInforme.cargando ? (
          <p className="flex items-center gap-2 text-xs text-white/45">
            <RefreshCw size={13} className="animate-spin" />
            {cargandoSeguimiento
              ? "Cargando el seguimiento individual…"
              : cargandoPropio
                ? "Cargando nuestras hojas de balón parado…"
                : rivalInforme.cargando
                  ? "Preparando el análisis del rival…"
                  : pizarraInforme.cargando && !cargandoComparativa
                    ? "Fotografiando la pizarra del partido…"
                    : "Cargando la comparación con la categoría…"}
          </p>
        ) : (
          /*
          | Cómo llega a la bandeja (21/10/2026): el asunto y la línea gris que
          | Gmail enseña debajo, antes del correo entero. Es lo primero que lee
          | quien lo recibe. Plegado desde el 06/11/2026, pero el asunto va en
          | el resumen: se ve siempre.
          */
          <details className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <summary className="cursor-pointer text-[12px] text-white/55">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Así llega · asunto</span>{" "}
              <span className="font-semibold text-white">{informe.asunto}</span>
            </summary>
            {informe.preencabezado ? (
              <p className="mt-1 text-[12px] text-white/55">{informe.preencabezado}</p>
            ) : (
              <p className="mt-1 text-[11px] text-white/35">Sin entradilla: Gmail enseña debajo el principio del correo.</p>
            )}
          </details>
        )}

        {/*
        | LO DEL ANALISTA, UN INDICADOR, AL FINAL (11/11/2026, expertos): una
        | pastilla con su contador junto a «Así llega», debajo del documento,
        | para que no compita con la vista previa. Antes de mandar se vuelve a
        | enseñar entera (`AvisoAntesDeMandar`). Sigue siendo el único sitio con
        | lo del analista: los avisos, cómo poner nuestro vídeo y de dónde sale el correo.
        */}
        {(() => {
          const conAvisos =
            !(cargandoSeguimiento || cargandoComparativa || cargandoPropio || rivalInforme.cargando) && informe.avisos.length > 0;

          return (
            <div>
              <button
                type="button"
                onClick={() => setVerAnalista((v) => !v)}
                aria-expanded={verAnalista}
                className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  conAvisos ? "border-amber-400/40 bg-amber-400/[0.08] text-amber-200" : "border-white/10 bg-white/[0.03] text-white/55"
                }`}
              >
                {conAvisos ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400/80 px-1 text-[10px] font-bold text-black">
                    {informe.avisos.length}
                  </span>
                ) : null}
                Para el analista · no va en el correo
              </button>
              {verAnalista ? (
                <ul className="mt-2 ml-4 list-disc space-y-1 text-[12px] text-white/70">
                  {conAvisos ? informe.avisos.map((aviso) => <li key={aviso}>{aviso}</li>) : null}
                  {!esPost && !videoJugadores ? (
                    <li>
                      Para que lleve nuestro vídeo, déjalo en ABP\VIDEO - JUGADORES con la jornada en el nombre ({jornadaPartido ? `«J${jornadaPartido}»` : "«J8»"}): el ordenador del club lo sube solo en un par de minutos.
                    </li>
                  ) : null}
                  <li>Los destinatarios se guardan solos y valen para todos los microciclos; se cambian en la barra de abajo, junto a «Enviar».</li>
                  {canal === "correo" ? <li>Sale de la cuenta de Google del club, la misma que sube los vídeos al canal.</li> : null}
                </ul>
              ) : null}
            </div>
          );
        })()}


      </div>
      {avisando && informe && (
        <AvisoAntesDeMandar
          avisos={informe.avisos}
          onRevisar={() => setAvisando(false)}
          onMandar={() => {
            setAvisando(false);
            void envia();
          }}
        />
      )}
    </Dialog>
  );
}

export { Mail as IconoInforme };
