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

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mail, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import { bloqueVideoHtml } from "@/lib/video-informe/portada-video";
import { VIDEO_JUGADORES_KEY, eligeVideoJugadores, normalizaVideosJugadores, type VideoJugadores } from "@/lib/abp/video-jugadores";
import { montaVideoInforme, puedeMontarVideo, type VideoMontado } from "@/lib/video-informe/monta";
import { SEGUNDOS_ENTRADA_ABP, entradaDeAbp } from "@/lib/video-informe/guion";
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
import { usePizarraInforme } from "@/components/abp/PizarraInforme";
import { pizarraParaInforme } from "@/lib/abp/pizarra-para-informe";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { useAgendaEnvios } from "@/hooks/useAgendaEnvios";
import { Destinatarios } from "@/components/correo/Destinatarios";
import { PanelWhatsapp } from "@/components/correo/PanelWhatsapp";
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

/**
 * Monta la entrada del informe + nuestro vídeo entero. Uno detrás de otro: si
 * el informe cambia a mitad, el nuevo espera a que acabe el anterior (dos a la
 * vez se pisarían el descodificador). Nunca falla: `null` si no ha salido.
 */
function arrancaMontaje(ref: { current: Montaje | null }, clave: string, informe: InformeMicro, url: string, rival: string, estado: (e: EstadoMontaje) => void) {
  const anterior = ref.current?.promesa ?? Promise.resolve(null);
  const promesa = anterior
    .catch(() => null)
    /* El escudo del rival para la portada de la entrada (sin él, sale la jornada en su sitio). */
    .then(() => (rival ? traeEscudos().then((lista) => buscadorDeEscudos(lista)(rival)) : null))
    .then((escudoRival) => montaVideoInforme(entradaDeAbp(informe, pinceladaAbp(informe), { escudoRival }), { cola: { url }, tope: SEGUNDOS_ENTRADA_ABP, fuente: barlowCondensed.style.fontFamily, alPaso: (texto) => estado({ clave, texto, listo: false }) }))
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
  const jornadaPartido = datos.partidoCalendario?.jornada ?? null;
  const rivalVideo = datos.partidoCalendario?.rival || datos.rival || "";
  const [videoJugadores, setVideoJugadores] = useState<VideoJugadores | null>(null);

  useEffect(() => {
    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(VIDEO_JUGADORES_KEY)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: unknown }>)
      .then((d) => {
        if (!cancelado) setVideoJugadores(eligeVideoJugadores(normalizaVideosJugadores(d?.data), jornadaPartido, rivalVideo));
      })
      .catch(() => {});

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

  useEffect(() => {
    if (!jornadaPartido) return;

    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(`informe-clips:j${String(jornadaPartido).padStart(2, "0")}`)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { data?: { cortes?: { minuto?: string; url?: string; de?: string; tipo?: string }[] } | null }) => {
        if (cancelado) return;

        setClipsPartido(
          (j?.data?.cortes ?? [])
            .filter((c) => c && c.url && c.minuto)
            .map((c) => ({ minuto: String(c.minuto), url: String(c.url), de: String(c.de ?? ""), tipo: String(c.tipo ?? "") })),
        );
      })
      .catch(() => {});

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

  const modo = useMemo<ModoInforme>(
    () =>
      modoElegido ??
      modoSugerido({
        fecha: fechaDelPartido(datos),
        jugado: datos.partidoCalendario?.jugado,
        hayAcciones: accionesPartido.length > 0,
      }),
    [modoElegido, datos, accionesPartido],
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

  /* En la vista previa, el enlace a nuestro vídeo tal cual irá (sin el póster, que en el correo va por cid). */
  const html = useMemo(
    () =>
      informeHtml(informe, {
        video: conVideo && videoJugadores ? bloqueVideoHtml({ url: videoJugadores.url, cid: "", segundos: videoJugadores.segundos, claro: true, relleno: "18px 24px 0", sinCopia: true, rotulo: "Ver nuestro vídeo de balón parado" }) : undefined,
      }),
    [informe, conVideo, videoJugadores],
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
  const claveMontaje =
    conVideo && videoJugadores && informeListo && puedeMontarVideo() ? [videoJugadores.url, informe.modo, informe.titulo, ...informe.resumen.map((c) => c.valor)].join("|") : "";
  const montaje = useRef<Montaje | null>(null);
  const informeVivo = useRef(informe);
  const [estadoMontaje, setEstadoMontaje] = useState<EstadoMontaje>({ clave: "", texto: "", listo: false });

  useEffect(() => {
    informeVivo.current = informe;
  }, [informe]);

  useEffect(() => {
    if (!claveMontaje || !videoJugadores || montaje.current?.clave === claveMontaje) return;

    /* Unos segundos quieto antes de empezar: cambiar de previa a post no lanza dos montajes. */
    const reloj = window.setTimeout(() => arrancaMontaje(montaje, claveMontaje, informeVivo.current, videoJugadores.url, rivalVideo, setEstadoMontaje), 3000);

    return () => window.clearTimeout(reloj);
  }, [claveMontaje, videoJugadores, rivalVideo]);

  /* Lo que el informe no sabe: se enseña al pulsar «Enviar», no en el correo. */
  const [avisando, setAvisando] = useState(false);

  /* Por WhatsApp (15/10/2026): se prepara igual y, en vez del correo, sale el mensaje con los enlaces. */
  const canal: CanalEnvio = ajustes.canal ?? "correo";
  const telefonosWa = telefonosDe(ajustes.telefonos ?? "");
  const [mensajesWa, setMensajesWa] = useState<MensajeWhatsapp[]>([]);
  const [pdfWa, setPdfWa] = useState<File | null>(null);
  const { apunta } = useAgendaEnvios();

  const envia = async () => {
    if (enviando) return;

    const para = ajustes.destinatarios.trim();

    if (canal === "correo" && !para) {
      toast.error("Escribe al menos una dirección de correo.");
      return;
    }

    if (canal === "whatsapp" && telefonosWa.malos.length) {
      toast.error("Hay teléfonos mal escritos", { description: telefonosWa.malos.join(", ") });
      return;
    }

    setMensajesWa([]);

    setEnviando(true);
    setFallo("");

    try {
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
      let infoVideo: { url: string; segundos: number; poster: string | null } | null = null;

      /* El montado (entrada del informe + nuestro vídeo): el que haya, o se espera al que va por la mitad. */
      if (conVideo && videoJugadores && claveMontaje) {
        const enCurso = montaje.current?.clave === claveMontaje ? montaje.current.promesa : arrancaMontaje(montaje, claveMontaje, informe, videoJugadores.url, rivalVideo, setEstadoMontaje);

        setPasoVideo("terminando el montaje…");

        const montado = await enCurso;

        if (montado) {
          try {
            const nombre = `${paraEnviar.titulo} - Balón parado en vídeo.mp4`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ");
            const subido = await subeAdjunto(new File([montado.blob], nombre, { type: "video/mp4" }), (f) => setPasoVideo(`subiendo ${Math.round(f * 100)} %`));

            infoVideo = { url: subido.url, segundos: montado.segundos, poster: montado.poster ?? null };
          } catch (error) {
            console.warn("[abp] el vídeo montado no ha subido", error);
            toast.message("Va nuestro vídeo sin la entrada del informe", { description: error instanceof Error ? error.message : "No ha subido." });
          }
        } else {
          toast.message("Va nuestro vídeo sin la entrada del informe", { description: "No se ha podido montar en este navegador." });
        }
      }

      if (conVideo && videoJugadores && !infoVideo) {
        setPasoVideo("preparando el enlace…");

        const poster = videoJugadores.poster
          ? await fetch(videoJugadores.poster)
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

        infoVideo = { url: videoJugadores.url, segundos: videoJugadores.segundos, poster };
        setPasoVideo("");
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
        setPasoVideo("armando el PDF…");

        const hojas = await completoEnHojas(informeHtml(paraEnviar), (h, t) => setPasoVideo(`PDF ${h}/${t}…`), { titulo: paraEnviar.titulo });
        const portada = await paginaDeEnlaces({
          titulo: paraEnviar.titulo,
          video: infoVideo,
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

        const subido = await subeAdjunto(pdf, (f) => setPasoVideo(`subiendo el PDF ${Math.round(f * 100)} %`));

        /* El correo adjunta el PDF desde el almacén; WhatsApp lleva el enlace con la tarjeta (escudos e icono de PDF). */
        setPasoVideo("tarjeta del enlace…");
        enlacePdf = { nombre: nombrePdf, url: await enlaceConTarjeta(subido, { ...partido, titulo, detalle: `Balón parado · ${paraEnviar.modoRotulo}`, fuente: barlowCondensed.style.fontFamily }) };
        adjuntosUrl.unshift({ nombre: nombrePdf, url: subido.url, tipo: "application/pdf" });
      } catch (error) {
        console.warn("[abp] el PDF del informe no ha salido", error);
        toast.message("El correo va sin el PDF del informe", { description: error instanceof Error ? error.message : "No se ha podido armar." });
      } finally {
        setPasoVideo("");
      }

      /*
      | Por WhatsApp (18/10/2026): nada de informe en texto —quedaba pobre—.
      | Mensaje corto con el PDF y el vídeo, y el PDF se puede compartir como
      | archivo (el panel lo ofrece si el aparato deja).
      */
      if (canal === "whatsapp") {
        setPdfWa(pdf);
        setMensajesWa([
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
        ]);
        apunta("whatsapp", telefonosWa.buenos);
        toast.success("Listo para WhatsApp", { description: "Debajo de los destinatarios: el PDF para compartir y un botón por persona con los enlaces." });

        return;
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
            video: infoVideo ? bloqueVideoHtml({ url: infoVideo.url, cid: infoVideo.poster ? "video-poster" : "", segundos: infoVideo.segundos, claro: true, relleno: "18px 24px 0", sinCopia: true, rotulo: "Ver nuestro vídeo de balón parado" }) : undefined,
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

      toast.success(
        `Informe enviado a ${cuantos} dirección${cuantos === 1 ? "" : "es"}`,
        {
          description: datosRespuesta.cuenta
            ? `Desde ${datosRespuesta.cuenta}`
            : undefined,
        },
      );
    } catch (error) {
      const dice =
        error instanceof Error ? error.message : "No se ha podido enviar.";

      setFallo(dice);

      /* El aviso corto avisa; el largo, con la dirección a la que hay que ir,
         se queda escrito debajo del botón. */
      toast.error("No se ha podido enviar el informe", {
        description: "Debajo del botón está el motivo.",
      });
    } finally {
      setEnviando(false);
    }
  };

  /*
  | INCRUSTADO: cuando ya está todo, se arma una vez y se entrega. Si en un
  | minuto no ha llegado todo, se entrega el fallo: quien espera tiene que
  | saber que no va a venir.
  */
  const clave = `${datos.temporada}|${datos.micro}`;

  const entregado = useRef(false);

  const listo = !cargandoSeguimiento && !cargandoComparativa && !cargandoPropio && !rivalInforme.cargando && !pizarraInforme.cargando;


  const alListo = incrustado?.alListo;

  useEffect(() => {
    if (!alListo) return;

    const reloj = window.setTimeout(() => {
      if (entregado.current) return;

      entregado.current = true;

      alListo({ ok: false, clave, error: "El informe de balón parado no ha terminado de cargar en un minuto." });
    }, ESPERA_INCRUSTADO);

    return () => window.clearTimeout(reloj);
  }, [alListo, clave]);

  useEffect(() => {
    if (!alListo || !listo || entregado.current) return;

    let cancelado = false;

    imagenesQueCaben(informe, TOPE_INCRUSTADO)
      .then(({ informe: paraEnviar, avisos }) => {
        if (cancelado || entregado.current) return;

        entregado.current = true;

        alListo({
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

  if (incrustado) return null;

  return (
    <Dialog
      title={`${informe.titulo} · ${informe.modoRotulo}`}
      subtitle={[informe.subtitulo, informe.rango].filter(Boolean).join(" · ")}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {fallo ? (
            <p className="min-w-0 basis-full text-[11px] leading-relaxed text-rose-300">
              {conEnlace(fallo)}
            </p>
          ) : null}

          <div className="min-w-0 space-y-1">
            {videoJugadores ? (
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/70" title={videoJugadores.nombre}>
                <input type="checkbox" className="accent-[#C8A96B]" checked={conVideo} disabled={enviando} onChange={(e) => setConVideo(e.target.checked)} />
                Incluir nuestro vídeo de la jornada · «{videoJugadores.nombre.replace(/\.[a-z0-9]+$/i, "")}» ({Math.floor(videoJugadores.segundos / 60)}:{String(videoJugadores.segundos % 60).padStart(2, "0")}), con la entrada del informe delante
              </label>
            ) : (
              <p className="text-[11px] text-white/40">
                Para que lleve nuestro vídeo, déjalo en ABP\VIDEO - JUGADORES con la jornada en el nombre ({jornadaPartido ? `«J${jornadaPartido}»` : "«J8»"}): el ordenador del club lo sube solo en un par de minutos.
              </p>
            )}
            {conVideo && videoJugadores && claveMontaje && estadoMontaje.clave === claveMontaje ? (
              <p className={`text-[11px] ${estadoMontaje.fallo ? "text-amber-300/80" : "text-white/45"}`}>
                {estadoMontaje.listo
                  ? "Vídeo montado: la entrada del informe y después el nuestro entero."
                  : estadoMontaje.fallo
                    ? `El montaje no ha salido (${estadoMontaje.fallo}): irá nuestro vídeo tal cual.`
                    : `Montando el vídeo mientras revisas · ${estadoMontaje.texto}`}
              </p>
            ) : null}
            {canal === "correo" ? (
              <p className="text-[11px] text-white/35">
                Sale de la cuenta de Google del club, la misma que sube los vídeos
                al canal.
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose}>Cerrar</Button>

            <Button
              tone="primary"
              icon={enviando ? Loader2 : Send}
              onClick={() => (informe?.avisos.length ? setAvisando(true) : void envia())}
              disabled={
                enviando ||
                cargandoSeguimiento ||
                cargandoComparativa ||
                cargandoPropio ||
                /* Sin esto el correo salía sin las láminas del rival si se pulsaba pronto. */
                rivalInforme.cargando ||
                pizarraInforme.cargando
              }
            >
              {enviando ? (pasoVideo ? `Vídeo: ${pasoVideo}` : "Enviando…") : canal === "whatsapp" ? "Preparar WhatsApp" : "Enviar por correo"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/*
        | PREVIA O POST. Dos informes distintos de la misma semana: la previa
        | cuenta qué se va a hacer y por qué; el post, qué pasó en el partido y
        | si lo entrenado apareció. El asunto lleva la idea de cada uno (`asuntoAbp`).
        */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
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
                className={`rounded-lg px-3 py-1.5 text-[11px] transition ${
                  modo === opcion.valor
                    ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {opcion.rotulo}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-white/35">
            {modo === "post"
              ? accionesPartido.length > 0
                ? `Qué pasó: las ${accionesPartido.length} acciones de la ${accionesPartido[0].jornada.etiqueta.toLowerCase()} en nuestras hojas, cruzadas con lo trabajado.`
                : cargandoPropio
                  ? "Buscando el partido en nuestras hojas de ABP…"
                  : "Qué pasó. El partido todavía no tiene acciones en nuestras hojas de ABP."
              : "Qué vamos a hacer y por qué: la semana, las urgencias, el rival y las claves."}
          </span>
        </div>

        <Destinatarios
          label="A quién se le manda"
          canal={canal}
          onCanal={(c) => setAjustes((a) => ({ ...a, canal: c }))}
          correos={ajustes.destinatarios}
          onCorreos={(destinatarios) => setAjustes((a) => ({ ...a, destinatarios }))}
          telefonos={ajustes.telefonos ?? ""}
          onTelefonos={(telefonos) => setAjustes((a) => ({ ...a, telefonos }))}
        />

        <PanelWhatsapp mensajes={mensajesWa} telefonos={telefonosWa.buenos} archivo={pdfWa} onCierra={() => setMensajesWa([])} />

        <p className="text-[11px] leading-relaxed text-white/35">
          Se guardan solos y valen para todos los microciclos; los de otras veces se proponen debajo.
        </p>

        {/*
        | QUÉ PARTIDOS ENTRAN EN EL DATO PROPIO.
        |
        | Por defecto, sólo competición. La pretemporada son siete partidos de
        | julio contra tres de liga, y mezclándola el informe presumía de
        | cuatro goles a balón parado que no se habían hecho en competición.
        */}
        {cuantasDePretemporada > 0 && (
          <div className="flex flex-wrap items-center gap-2">
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
        )}

        {pizarraInforme.deck}

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
          | quien lo recibe y no se veía en ningún sitio.
          */
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Así llega</p>
            <p className="mt-1 text-[13px] font-semibold text-white">{informe.asunto}</p>
            {informe.preencabezado && <p className="mt-0.5 text-[12px] text-white/55">{informe.preencabezado}</p>}
          </div>
        )}

        {/*
          La vista previa es el correo de verdad, no una maqueta: se pinta el
          mismo HTML que se manda, en un marco aislado para que sus estilos no
          se mezclen con los de la app.
        */}
        <div className="overflow-hidden rounded-xl border border-white/10">
          <iframe
            title="Vista previa del informe"
            srcDoc={html}
            className="h-[58vh] w-full bg-white"
            /* El correo mide 860 px y el marco menos: se encoge para que se lea entero, sin barra lateral ni titulares cortados (20/10/2026). */
            onLoad={(e) => {
              const raiz = e.currentTarget.contentDocument?.documentElement;

              if (!raiz) return;

              raiz.style.zoom = "";

              if (raiz.scrollWidth > raiz.clientWidth + 1) raiz.style.zoom = String(raiz.clientWidth / raiz.scrollWidth);
            }}
          />
        </div>

        {/*
        | Lo que el informe no sabe va debajo y plegado (21/10/2026): delante
        | de la vista previa tapaba lo esencial. Antes de mandar se vuelve a
        | enseñar entero (`AvisoAntesDeMandar`).
        */}
        {!(cargandoSeguimiento || cargandoComparativa || cargandoPropio || rivalInforme.cargando) &&
          informe.avisos.length > 0 && (
            <details className="rounded-xl border border-amber-400/25 bg-amber-400/[0.05] px-3 py-2 text-[12px] text-white/70">
              <summary className="cursor-pointer font-semibold text-amber-200">
                Lo que este informe no sabe ({informe.avisos.length})
              </summary>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                {informe.avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            </details>
          )}
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
