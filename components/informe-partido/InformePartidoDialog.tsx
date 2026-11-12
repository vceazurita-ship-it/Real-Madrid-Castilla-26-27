"use client";

/**
 * EL INFORME DEL PARTIDO: VERLO, BAJARLO Y MANDARLO (03/10/2026).
 *
 * Se abre desde Microciclos. Elige el microciclo (por defecto el que se esté
 * mirando) y si es la previa o el post (por defecto lo dice el calendario).
 * Enseña el resumen —tres diapositivas— y el informe extenso tal y como van a
 * llegar, y manda **dos correos**: el resumen con las diapositivas dentro y en
 * PDF adjunto, y el extenso con el informe de ABP entero y los documentos del
 * rival adjuntos.
 *
 * Tres piezas vienen de fuera y llegan a su ritmo:
 *
 *   - El informe en sí: `lib/informe-partido/carga.ts`.
 *   - El informe de ABP del microciclo: lo arma la propia pantalla de
 *     Microciclo de Balón Parado, abierta en un iframe oculto en modo
 *     incrustado (sólo lectura), y lo devuelve por `postMessage`. Así sólo hay
 *     un sitio que sabe hacer ese informe.
 *   - Los adjuntos: los PDF y PPT del rival que estén en sus Recursos, más los
 *     que se suban aquí. Van directos a Supabase (`subeAdjunto`) y el servidor
 *     los adjunta al correo: por Vercel no caben.
 *   - El vídeo de balón parado de la jornada (25/10/2026): el del analista
 *     («ABP/VIDEO - JUGADORES», lo sube el vigía a `abp:video-jugadores`).
 *     Va en la previa y en el post, con póster en el correo, página con QR en
 *     el PDF y enlace en WhatsApp. Sólo el de ESTA jornada: si no lo hay, no
 *     se nombra.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BookOpen, Check, ChevronDown, Clapperboard, Download, ExternalLink, FileText, Image as ImageIcon, Loader2, Maximize2, Paperclip, Presentation, RefreshCw, Send, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog, Notice, Segmented } from "@/components/abp/ui";
import { DIAPO_H, DIAPO_W, DIAPOSITIVAS, Escalada, textoDeDiapo } from "@/components/informe-partido/Diapositivas";
import { VideosDeLaSemana, type PiezaDeVideo } from "@/components/informe-partido/VideosDeLaSemana";
import { VerEnGrande } from "@/components/informe-partido/VerEnGrande";
import { MenuDescargar } from "@/components/informe-partido/MenuDescargar";
import { AvisoAntesDeMandar } from "@/components/correo/AvisoAntesDeMandar";
import { Destinatarios } from "@/components/correo/Destinatarios";
import { useAgendaEnvios } from "@/hooks/useAgendaEnvios";
import { mensajeWhatsapp, telefonosDe, type CanalEnvio, type MensajeWhatsapp } from "@/lib/correo/whatsapp";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { TOPE_ADJUNTOS_CORREO, TOPE_PETICION_CORREO } from "@/lib/correo/limites";
import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import { SEGUNDOS_CONSIGNAS, SEGUNDOS_CONSIGNAS_MINIMOS, consignasDePartido, guionDePartido } from "@/lib/video-informe/guion";
import { consignasDePost, sinConsignasDeAbp } from "@/lib/video-informe/piezas";
import { buscadorDeEscudos, traeEscudos } from "@/lib/data-analisis/escudos";
import { puedeMontarVideo, type VideoMontado } from "@/lib/video-informe/monta";
import { huellaVideo, trabajoVideo } from "@/lib/video-informe/trabajo-video";
import { trabajoEnvios, type ResultadoEnvio } from "@/lib/informes/trabajo-envios";
import { bloqueVideoHtml } from "@/lib/video-informe/portada-video";
import { VIDEO_JUGADORES_KEY, eligeVideoJugadores, normalizaVideosJugadores, type VideoJugadores } from "@/lib/abp/video-jugadores";
import { cargaInforme, microsDisponibles, type MicroDisponible } from "@/lib/informe-partido/carga";
import { cargaCalendarioONulo } from "@/hooks/useCalendario";
import { completoEnHojas, type HojasCompleto } from "@/lib/informe-partido/pdf-completo";
import { informeUnicoPdf, paginaDeEnlaces, paginaDelVideo, type EnlaceInforme } from "@/lib/informe-partido/pdf-unico";
import { ROTULO_DOCUMENTO, type TipoDocumentoRival } from "@/lib/rivals/documentos";
import { capitulosDe, informeHtml, informeTexto, resumenHtml, type Descarga, type ExtrasInforme } from "@/lib/informe-partido/html";
import { asuntoInforme, queTocaEnElMicro, sintetiza, titularDelPlan, titularEstaSemana, whatsappInforme, type InformePartido, type Momento, type PinceladaAbp } from "@/lib/informe-partido/modelo";
import { corteDeRed, fuentesIncrustadas, fuentesListas } from "@/lib/export/captura";
import { capturaLienzos, esperaFotos, pintado, pdfDeLienzos } from "@/lib/export/lienzos";
import { descargaEnMarcha, encargaDescarga } from "@/lib/trabajos/descargas";
import { creaPptx } from "@/lib/export/pptx";
import { barlowCondensed } from "@/lib/rivals/portada-font";
import { pideVideoPostAbp, type VideoPostAbp } from "@/components/abp/jugadas-del-video";
import { usePlayers } from "@/hooks/usePlayers";

type AjustesCorreo = {
  destinatarios: string;
  /** Correo o WhatsApp (15/10/2026), y los teléfonos de WhatsApp separados por comas. */
  canal?: CanalEnvio;
  telefonos?: string;
  /** Va bajo el mensaje de cada correo. */
  firma?: string;
  /** Si el resumen o el completo van a otras personas que los de arriba. */
  paraResumen?: string;
  paraCompleto?: string;
  /** Los interruptores de adjuntos, recordados de una vez para otra. */
  preferencias?: { resumenPdf?: boolean; resumenPpt?: boolean; resumenVideo?: boolean; completoVideo?: boolean; completoPdf?: boolean; completoResumenPdf?: boolean; completoResumenPpt?: boolean };
};

/** Qué lleva cada correo. `asunto` a `null` = el de siempre; `capitulos` a `null` = todos. */
type OpcionesEnvio = {
  resumen: { activo: boolean; asunto: string | null; mensaje: string; diapos: boolean[]; pdf: boolean; ppt: boolean; video: boolean };
  completo: { activo: boolean; asunto: string | null; mensaje: string; capitulos: string[] | null; pdfCompleto: boolean; pdfResumen: boolean; pptResumen: boolean; sacarDocs: boolean; video: boolean };
};

/** Al cambiar de partido o de momento, el asunto y el mensaje dejan de valer. */
const textosLimpios = (e: OpcionesEnvio): OpcionesEnvio => ({
  resumen: { ...e.resumen, asunto: null, mensaje: "" },
  completo: { ...e.completo, asunto: null, mensaje: "", capitulos: null },
});

/** Lo que devuelve la pantalla de ABP incrustada. */
type AbpLlegado =
  | {
      ok: true;
      clave: string;
      cuerpo: string;
      texto: string;
      imagenes: { cid: string; tipo: string; base64: string }[];
      pincelada: PinceladaAbp;
      avisos: string[];
      /** Post (02/11/2026): el vídeo post de ABP en guion; se monta aquí (o se encuentra ya montado) y se enlaza. */
      video?: VideoPostAbp | null;
    }
  | { ok: false; clave: string; error: string };

/** Un documento para el correo extenso. */
type Documento = { nombre: string; url: string; tipo: string; tamano: number | null; adjuntable: boolean; origen: "rival" | "subido"; generado?: TipoDocumentoRival };

/** Lo que devuelve Plantillas rivales incrustada: el PDF de la plantilla y el PPT del rival, ya guardados. */
type DocsLlegados =
  | { ok: true; clave: string; docs: { tipo: TipoDocumentoRival; nombre: string; url: string; tamano: number }[]; avisos: string[] }
  | { ok: false; clave: string; error: string };

/* Lo que se espera a que Plantillas rivales saque los dos documentos. */
const ESPERA_DOCS = 180_000;

/*
| Lo que va ADJUNTO al completo (04/10/2026). Gmail manda hasta 35 MB por
| mensaje ya en base64 (un tercio más) y muchos buzones de club no reciben más
| de 25 MB. Lo que no cabe no se pierde: va como botón de descarga en el propio
| correo. Es el MISMO tope que aplica el servidor (`lib/correo/limites.ts`).
*/
const TOPE_ADJUNTOS = TOPE_ADJUNTOS_CORREO;

/*
| Si un documento del rival no dice cuánto pesa y tampoco se puede preguntar,
| se cuenta como si pesara esto. Antes era lo único que se hacía, y un PPT de
| 14 MB contado como 6 pasaba aquí y lo rechazaba el servidor (04/10/2026).
*/
const PESO_DESCONOCIDO = 6 * 1024 * 1024;

/** Lo que pesa un archivo ya subido, preguntándolo sin bajarlo (HEAD). `null` si no se sabe. */
const pesoDeUrl = async (url: string) => {
  try {
    /* Con tope (03/11/2026): si el almacén no contesta, el peso no se sabe y el correo sigue. */
    const r = await fetch(url, { method: "HEAD", cache: "no-store", signal: corteDeRed(10_000) });

    const largo = Number(r.headers.get("content-length"));

    return r.ok && Number.isFinite(largo) && largo > 0 ? largo : null;
  } catch {
    return null;
  }
};

/*
| Gmail recorta el cuerpo que pasa de ~102 KB («[Mensaje recortado] Ver todo el
| mensaje») y lo de debajo —gráficos de ABP incluidos— no se ve. Se elige la
| versión más completa que quede por debajo de esto.
*/
const TOPE_HTML = 96 * 1024;

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const bytesDe = (texto: string) => new TextEncoder().encode(texto).length;

/** Un nombre de archivo que se lea bien en la bandeja: sin barras ni comillas, y con su extensión. */
const nombreDeArchivo = (base: string, ext: string) => `${base.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim()}.${ext}`;

/* Lo que se espera al informe de ABP antes de darlo por perdido. */
const ESPERA_ABP = 120_000;

/* De dónde salen las descargas del informe (para «Ver» en el aviso al terminar). */
const VUELTA_INFORME = "/microcycles";

/**
 * Las tres diapositivas a su tamaño, para fotografiarlas. Las pinta el diálogo
 * fuera de pantalla (se preparan solas) y, para las descargas en segundo plano
 * (08/11/2026), la «mesa» del gestor de descargas con la foto del informe del
 * momento del clic: así la descarga sigue aunque se cierre el diálogo.
 */
function LaminasDiapositivas({ inf }: { inf: InformePartido }) {
  const [Uno, Dos, Tres] = DIAPOSITIVAS[inf.momento];

  return (
    <div className={barlowCondensed.className} style={{ width: DIAPO_W, ["--fuente-informe" as string]: barlowCondensed.style.fontFamily }}>
      <Uno inf={inf} />
      <Dos inf={inf} />
      <Tres inf={inf} />
    </div>
  );
}

/** Las diapositivas en JPEG, fotografiadas dentro de `raiz` (la del diálogo o la mesa de la descarga). */
async function capturaDiapositivas(dameRaiz: () => HTMLElement | null) {
  /* `fuentesListas` y no `document.fonts.ready` a pelo (03/11/2026): con
     una fuente de fuera sin contestar, aquello no se resolvía nunca y el
     envío se quedaba en «diapositivas…». */
  await fuentesListas();
  await pintado();
  await pintado();

  const raiz = dameRaiz();

  if (!raiz) throw new Error("No se han podido montar las diapositivas.");

  /* Los escudos y las caras, cargados (con tope), y las fuentes incrustadas
     UNA vez para las tres: sin ellas, cada diapositiva vuelve a leer todas
     las hojas de estilo de la página (03/11/2026, como la pizarra de ABP). */
  await esperaFotos(raiz);

  const fontEmbedCSS = await fuentesIncrustadas(raiz, {});

  return capturaLienzos(raiz, "[data-diapositiva-partido]", { ancho: DIAPO_W, alto: DIAPO_H, fondo: "#08111F", nitidez: 1, fontEmbedCSS });
}

/**
 * El día («YYYY-MM-DD») de un instante, con el reloj de aquí. `creado` va en
 * UTC: recortado a secas, un documento sacado entre las 00:00 y las 02:00 del
 * primer día de la semana contaba como de la semana anterior y se volvía a
 * pedir (19/10/2026).
 */
function diaDeAqui(iso: string) {
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const mb = (bytes: number | null) => (bytes === null ? "" : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/* Pantalla estrecha (< 640 px), para colocar «A quién se le manda» debajo de la vista previa en el móvil. */
const MOVIL = "(max-width: 639px)";
const suscribeMovil = (avisa: () => void) => {
  const mq = window.matchMedia(MOVIL);
  mq.addEventListener("change", avisa);
  return () => mq.removeEventListener("change", avisa);
};
const esMovilAhora = () => window.matchMedia(MOVIL).matches;
const esMovilServidor = () => false;

/** Lo que va hecho de un «… · 2 de 26…» o un «… 40 %», para pintarlo en una barra; null si el texto no lo dice. */
function fraccionDe(texto: string | null): number | null {
  if (!texto) return null;

  const partes = texto.match(/(\d+) de (\d+)/);

  if (partes && Number(partes[2]) > 0) return Math.min(1, Number(partes[1]) / Number(partes[2]));

  const tanto = texto.match(/(\d+(?:[.,]\d+)?)\s?%/);

  return tanto ? Math.min(1, Number(tanto[1].replace(",", ".")) / 100) : null;
}

/**
 * UN PLEGABLE CERRADO (06/11/2026, jueces: «el diálogo era un formulario
 * enorme y el documento quedaba abajo»). Cabecera con su título y un resumen de
 * una línea; el contenido sigue montado aunque esté cerrado (sólo se esconde),
 * así no se pierde lo que lleva dentro (los vídeos que se montan, el selector
 * de archivos). `control` va a la izquierda, fuera del botón: una casilla
 * dentro del botón abría y cerraba a la vez.
 */
function Plegable({ titulo, resumen, control, destacado = false, aviso = false, children }: { titulo: ReactNode; resumen?: string; control?: ReactNode; destacado?: boolean; aviso?: boolean; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <section className={`min-w-0 rounded-xl border font-sans text-[12px] ${destacado ? "border-[#C8A96B]/30 bg-[#C8A96B]/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {control ? <span className="flex shrink-0 pt-[3px]">{control}</span> : null}
        <button type="button" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className={`block text-[13px] font-semibold ${aviso ? "text-amber-300" : "text-white/90"}`}>{titulo}</span>
            {resumen ? (
              <span className="block truncate text-[11px] text-white/45" title={resumen}>
                {resumen}
              </span>
            ) : null}
          </span>
          <ChevronDown size={15} className={`mt-0.5 shrink-0 text-white/40 transition-transform ${abierto ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div hidden={!abierto} className="border-t border-white/10 px-3 py-3">
        {children}
      </div>
    </section>
  );
}

export function InformePartidoDialog({
  temporada,
  micro,
  onClose,
}: {
  /** El microciclo que se está mirando; sin él, el más reciente. */
  temporada?: string;
  micro?: number;
  onClose: () => void;
}) {
  const [micros, setMicros] = useState<MicroDisponible[] | null>(null);

  /* Las semanas sin competición, para decir por qué la lista salta del 13 al 11 (11/11/2026, marketing). */
  const [sinCompeticion, setSinCompeticion] = useState<MicroDisponible[]>([]);

  const [elegido, setElegido] = useState<{ temporada: string; micro: number } | null>(temporada && micro ? { temporada, micro } : null);

  /* `null` = lo que diga el calendario. */
  const [momentoPedido, setMomentoPedido] = useState<Momento | null>(null);

  const [informe, setInforme] = useState<InformePartido | null>(null);

  const [testigo, setTestigo] = useState(0);

  const [vista, setVista] = useState<"resumen" | "completo">("resumen");

  /*
  | En el móvil, «A quién se le manda» va debajo de la vista previa
  | (11/11/2026, fútbol): arriba ocupaba la primera pantalla y el informe
  | empezaba debajo. Un solo `Destinatarios` montado, en un sitio u otro.
  */
  const esMovil = useSyncExternalStore(suscribeMovil, esMovilAhora, esMovilServidor);

  const [trabajando, setTrabajando] = useState<null | string>(null);

  const lienzos = useRef<HTMLDivElement | null>(null);

  const { value: ajustes, setValue: setAjustes, status: estadoAjustes } = useRemoteDoc<AjustesCorreo>({
    key: "partido:informe-correo",
    kind: "informe-partido",
    fallback: { destinatarios: "" },
  });

  /* Qué correos salen y qué lleva cada uno. Los dos por defecto: es para lo que existe el botón. */
  const [envio, setEnvio] = useState<OpcionesEnvio>(() => ({
    resumen: { activo: true, asunto: null, mensaje: "", diapos: [true, true, true], pdf: true, ppt: false, video: true },
    completo: { activo: true, asunto: null, mensaje: "", capitulos: null, pdfCompleto: true, pdfResumen: false, pptResumen: false, sacarDocs: true, video: true },
  }));

  /* Lo recordado, en cuanto llega de la nube (una vez). */
  const preferenciasPuestas = useRef(false);

  useEffect(() => {
    const pr = ajustes.preferencias;

    if (preferenciasPuestas.current || !pr) return;

    preferenciasPuestas.current = true;

    setEnvio((e) => ({
      resumen: { ...e.resumen, pdf: pr.resumenPdf ?? e.resumen.pdf, ppt: pr.resumenPpt ?? e.resumen.ppt, video: pr.resumenVideo ?? e.resumen.video },
      completo: {
        ...e.completo,
        pdfCompleto: pr.completoPdf ?? e.completo.pdfCompleto,
        video: pr.completoVideo ?? e.completo.video,
        pdfResumen: pr.completoResumenPdf ?? e.completo.pdfResumen,
        pptResumen: pr.completoResumenPpt ?? e.completo.pptResumen,
      },
    }));
  }, [ajustes.preferencias]);

  /* Los microciclos de la hoja. */
  useEffect(() => {
    let cancelado = false;

    /* Sin elección, el micro del PRÓXIMO partido del calendario (06/11/2026): el
       más reciente de la hoja podía ser ya el de la jornada siguiente. */
    Promise.all([microsDisponibles(), cargaCalendarioONulo().catch(() => null)])
      .then(([lista, calendario]) => {
        if (cancelado) return;

        /* Las semanas sin partido («No competición») no tienen informe de partido. */
        setMicros(lista.filter((m) => !/no\s+competici/i.test(m.rival)));
        setSinCompeticion(lista.filter((m) => /no\s+competici/i.test(m.rival)));

        const hoy = new Date().toISOString().slice(0, 10);
        const sig = [...(calendario ?? [])].sort((a, b) => a.cuando.localeCompare(b.cuando)).find((p) => p.cuando && p.cuando.slice(0, 10) >= hoy);
        const norma = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const rival = sig ? norma(/castilla/i.test(sig.local) ? sig.visitante : sig.local) : "";
        const llave = rival.split(/\s+/).filter((w) => w.length > 3)[0] ?? rival;
        const delProximo = llave ? lista.find((m) => norma(m.rival).includes(llave)) : undefined;
        const defecto = delProximo ?? lista[0];

        setElegido((actual) => actual ?? (defecto ? { temporada: defecto.temporada, micro: defecto.micro } : null));
      })
      .catch(() => {
        if (!cancelado) setMicros([]);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  /* El informe de ese micro. Se está cargando mientras lo último que llegó
     (o falló) no sea lo último que se pidió. */
  const pedido = elegido ? `${elegido.temporada}|${elegido.micro}|${momentoPedido ?? ""}|${testigo}` : "";

  const [llegado, setLlegado] = useState("");

  const cargando = Boolean(pedido) && llegado !== pedido;

  /* De qué micro es el informe que hay en pantalla. Si falla la carga de OTRO
     micro, el de antes no puede quedarse: salía bajo el micro nuevo y se
     podía mandar (19/10/2026). Si falla un «Volver a cargar» del mismo, se
     queda el que había, que sigue siendo bueno. */
  const informeDe = useRef("");

  useEffect(() => {
    if (!elegido) return;

    let cancelado = false;

    const micro = `${elegido.temporada}|${elegido.micro}`;

    cargaInforme({ ...elegido, momento: momentoPedido ?? undefined })
      .then((inf) => {
        if (cancelado) return;

        informeDe.current = micro;
        setInforme(inf);
      })
      .catch((error) => {
        if (cancelado) return;

        if (informeDe.current !== micro) setInforme(null);

        toast.error("No se ha podido armar el informe", { description: error instanceof Error ? error.message : "" });
      })
      .finally(() => {
        if (!cancelado) setLlegado(`${elegido.temporada}|${elegido.micro}|${momentoPedido ?? ""}|${testigo}`);
      });

    return () => {
      cancelado = true;
    };
  }, [elegido, momentoPedido, testigo]);

  /* ---------------- el vídeo de balón parado de la jornada ---------------- */

  /*
  | El del analista para los jugadores (25/10/2026): se elige por la jornada
  | del partido del informe (`eligeVideoJugadores`; sin número en el nombre,
  | por el rival). Nunca el de otra jornada. Sólo se lee.
  */
  const jornadaVideoAbp = informe?.partido.jornada ?? null;
  const rivalVideoAbp = informe?.partido.rival ?? "";
  const [videoAbpLeido, setVideoAbpLeido] = useState<{ clave: string; video: VideoJugadores | null } | null>(null);
  const claveVideoAbp = informe ? `${jornadaVideoAbp ?? ""}|${rivalVideoAbp}` : "";

  useEffect(() => {
    if (!claveVideoAbp) return;

    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(VIDEO_JUGADORES_KEY)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: unknown }>)
      .then((d) => {
        if (!cancelado) setVideoAbpLeido({ clave: claveVideoAbp, video: eligeVideoJugadores(normalizaVideosJugadores(d?.data), jornadaVideoAbp, rivalVideoAbp) });
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [claveVideoAbp, jornadaVideoAbp, rivalVideoAbp]);

  const videoAbp = videoAbpLeido?.clave === claveVideoAbp ? videoAbpLeido.video : null;

  /** «Vídeo de balón parado · J9»: cómo se nombra en el correo, el PDF y WhatsApp. */
  const nombreVideoAbp = `Vídeo de balón parado${jornadaVideoAbp ? ` · J${jornadaVideoAbp}` : ""}`;

  const rotuloVideoAbp = `Ver el vídeo de balón parado${jornadaVideoAbp ? ` · J${jornadaVideoAbp}` : ""}`;

  /* ---------------- el informe de ABP, de su pantalla ---------------- */

  /* Qué informe de ABP toca: el del micro y el momento del informe cargado. */
  const abpClave = informe && elegido && !cargando ? `${elegido.temporada}|${elegido.micro}|${informe.momento}` : "";

  const [abp, setAbp] = useState<AbpLlegado | null>(null);

  useEffect(() => {
    const oye = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;

      const d = e.data as { tipo?: string; clave?: string; modo?: string } & Record<string, unknown>;

      if (d?.tipo !== "abp-informe") return;

      setAbp({ ...(d as unknown as AbpLlegado), clave: `${d.clave}|${d.modo ?? ""}` });
    };

    window.addEventListener("message", oye);

    return () => window.removeEventListener("message", oye);
  }, []);

  /* Si no contesta, se da por perdido: el informe sale sin él y lo dice. */
  useEffect(() => {
    if (!abpClave) return;

    const t = window.setTimeout(() => {
      setAbp((actual) => (actual?.clave === abpClave ? actual : { ok: false, clave: abpClave, error: "La pantalla de ABP no ha contestado a tiempo." }));
    }, ESPERA_ABP);

    return () => window.clearTimeout(t);
  }, [abpClave, testigo]);

  const abpActual = abp && abp.clave === abpClave ? abp : null;

  const abpCargando = Boolean(abpClave) && !abpActual;

  /*
  | EL VÍDEO POST DE ABP (02/11/2026, lo pidió el analista): en el post, el
  | informe de ABP entrega su vídeo en guion y aquí se monta (o, si el de ABP
  | ya lo montó en esta pestaña, se encuentra hecho: misma huella). Va en el
  | sitio del vídeo de balón parado —póster en el correo, página del PDF y
  | enlace de WhatsApp— y lleva detrás nuestro vídeo de la jornada, si lo hay.
  | Si no sale, va nuestro vídeo tal cual, como antes.
  */
  const { players } = usePlayers();
  const videoAbpPost = abpActual?.ok && informe?.momento === "post" ? (abpActual.video ?? null) : null;
  const puedeVideoAbpPost = Boolean(videoAbpPost) && players.length > 0 && puedeMontarVideo();
  const montajeAbpPost = useRef<{ clave: string; promesa: Promise<VideoMontado | null>; escucha?: (texto: string) => void } | null>(null);

  const dameVideoAbpPost = (escucha?: (texto: string) => void): Promise<VideoMontado | null> => {
    if (!videoAbpPost || !puedeVideoAbpPost) return Promise.resolve(null);

    if (montajeAbpPost.current?.clave === abpClave) {
      if (escucha) montajeAbpPost.current.escucha = escucha;

      return montajeAbpPost.current.promesa;
    }

    const entrada: NonNullable<typeof montajeAbpPost.current> = { clave: abpClave, promesa: Promise.resolve(null), escucha };

    entrada.promesa = pideVideoPostAbp(videoAbpPost, players, (t) => entrada.escucha?.(t)).catch((error: unknown) => {
      console.warn("[informe] el vídeo post de balón parado no ha salido", error);

      /* Se olvida: al enviar se intenta otra vez. */
      if (montajeAbpPost.current === entrada) montajeAbpPost.current = null;

      return null;
    });
    montajeAbpPost.current = entrada;

    return entrada.promesa;
  };

  const [, temporadaAbp, microAbp] = abpClave.match(/^(.*)\|(\d+)\|/) ?? [];

  /* Lo que se pinta: el informe con la pincelada de ABP dentro. */
  const informeVisto = useMemo<InformePartido | null>(() => {
    if (!informe) return null;

    if (!abpActual?.ok) return informe;

    const conAbp = {
      ...informe,
      abp: { ...(informe.abp ?? { minutosSemana: 0, laminasRival: 0, documentosRival: [] }), pincelada: abpActual.pincelada },
      avisos: [...informe.avisos, ...abpActual.avisos.map((a) => `ABP: ${a}`)],
    };

    /*
    | La previa se rehace con la pincelada (11/11/2026, análisis y fútbol): la
    | línea de balón parado del plan es la prioridad nº 1 del informe de ABP
    | («Defendemos la falta directa»), pero la síntesis se calculaba antes de
    | que llegara y salía «Marcamos a Gil y Rijn», otra historia.
    */
    if (informe.momento !== "post") return { ...conAbp, sintesis: sintetiza(conAbp) };

    /* «Qué toca» se rehace con el balón parado que nos dio peligro (22/10/2026): llega con la pincelada. */

    const microciclo = queTocaEnElMicro(conAbp, informe.sintesis.cumplimiento);

    return { ...conAbp, sintesis: { ...informe.sintesis, microciclo, titularPlan: titularDelPlan(informe.sintesis.cumplimiento, microciclo), titularDuelos: titularEstaSemana(microciclo) || informe.sintesis.titularDuelos } };
  }, [informe, abpActual]);

  /* ---------------- el PDF y el PPT del rival, de su pantalla ---------------- */

  /*
  | Tienen que ir siempre en el completo. Si nadie los ha sacado en Plantillas
  | rivales —o son de antes de esta semana—, se piden: la pantalla se abre
  | oculta, los saca como si se pulsaran sus botones, los guarda y contesta.
  |
  | Se piden AL ENVIAR (o con «Volver a sacar»), no al abrir, y en una
  | PESTAÑA APARTE (sin `opener`, o sea en su propio proceso): montar el PPT
  | ocupa el hilo de la página medio minuto largo y, en un iframe, congelaba
  | el diálogo varios minutos en un portátil. La pestaña contesta por un
  | `BroadcastChannel` y se cierra sola.
  */
  const [pideDocs, setPideDocs] = useState(0);

  const generados = informe?.recursos.generados ?? [];

  const inicioSemana = informe?.microciclo?.dias[0]?.fecha ?? "";

  const viejo = (tipo: TipoDocumentoRival) => {
    const g = generados.find((x) => x.tipo === tipo);

    return !g || (inicioSemana !== "" && diaDeAqui(g.creado) < inicioSemana);
  };

  const equipoDocs = informe?.recursos.equipoPlantilla ?? "";

  const faltanDocs = Boolean(informe) && !cargando && Boolean(equipoDocs) && (viejo("plantilla-pdf") || viejo("informe-pptx"));

  const docsClave = pideDocs > 0 && equipoDocs ? `${equipoDocs}|${pideDocs}|${testigo}` : "";

  /* Quien espera a los documentos dentro del envío. */
  const esperaDocs = useRef<((r: DocsLlegados) => void) | null>(null);

  const [docsRival, setDocsRival] = useState<DocsLlegados | null>(null);

  const docsClaveRef = useRef("");

  useEffect(() => {
    docsClaveRef.current = docsClave;
  }, [docsClave]);

  useEffect(() => {
    const oye = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;

      const d = e.data as { tipo?: string } & Record<string, unknown>;

      if (d?.tipo !== "rival-documentos") return;

      recibe(d);
    };

    const recibe = (d: Record<string, unknown>) => {
      const llegado = { ...(d as unknown as DocsLlegados), clave: docsClaveRef.current };

      setDocsRival(llegado);

      esperaDocs.current?.(llegado);

      esperaDocs.current = null;
    };

    window.addEventListener("message", oye);

    let canal: BroadcastChannel | null = null;

    try {
      canal = new BroadcastChannel("rival-documentos");

      canal.onmessage = (e) => {
        const d = e.data as { tipo?: string } & Record<string, unknown>;

        if (d?.tipo === "rival-documentos") recibe(d);
      };
    } catch {
      /* Sin canal sólo queda el aviso de tiempo agotado. */
    }

    return () => {
      window.removeEventListener("message", oye);
      canal?.close();
    };
  }, []);

  /** Abre Plantillas rivales en su pestaña para sacar los dos documentos. Tiene que ir dentro del clic. */
  const abreDocs = () => {
    if (!equipoDocs) return;

    window.open(`/rivals?incrustado=documentos&equipo=${encodeURIComponent(equipoDocs)}`, "_blank", "noopener");

    setPideDocs((n) => n + 1);
  };

  useEffect(() => {
    if (!docsClave) return;

    const t = window.setTimeout(() => {
      setDocsRival((actual) => (actual?.clave === docsClave ? actual : { ok: false, clave: docsClave, error: "Plantillas rivales no ha contestado a tiempo." }));
    }, ESPERA_DOCS);

    return () => window.clearTimeout(t);
  }, [docsClave]);

  const docsActual = docsRival && docsRival.clave === docsClave ? docsRival : null;

  const docsCargando = Boolean(docsClave) && !docsActual;

  /* ---------------- los adjuntos ---------------- */

  const [subidos, setSubidos] = useState<Documento[]>([]);

  const [quitados, setQuitados] = useState<Set<string>>(new Set());

  const [subiendo, setSubiendo] = useState<{ nombre: string; fraccion: number } | null>(null);

  const elegirArchivo = useRef<HTMLInputElement | null>(null);

  const documentos = useMemo<Documento[]>(() => {
    const nuevos = docsActual?.ok
      ? docsActual.docs.map((x) => ({
          nombre: `${ROTULO_DOCUMENTO[x.tipo]} · recién sacado`,
          url: x.url,
          tipo: x.tipo === "plantilla-pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          tamano: x.tamano,
          adjuntable: true,
          origen: "rival" as const,
          generado: x.tipo,
        }))
      : [];

    const sustituidos = new Set(nuevos.map((x) => x.generado));

    return [
      ...nuevos,
      ...(informe?.recursos.documentos ?? []).filter((x) => !x.generado || !sustituidos.has(x.generado)).map((x) => ({ ...x, origen: "rival" as const })),
      ...subidos,
    ];
  }, [informe, subidos, docsActual]);

  const marcados = documentos.filter((d) => d.adjuntable && !quitados.has(d.url));

  const sube = async (archivos: FileList | null) => {
    for (const file of Array.from(archivos ?? [])) {
      try {
        setSubiendo({ nombre: file.name, fraccion: 0 });

        const a = await subeAdjunto(file, (fraccion) => setSubiendo({ nombre: file.name, fraccion }));

        setSubidos((lista) => [...lista, { nombre: a.nombre, url: a.url, tipo: a.tipo, tamano: a.tamano, adjuntable: true, origen: "subido" }]);
      } catch (error) {
        toast.error(`No se ha podido subir ${file.name}`, { description: error instanceof Error ? error.message : "" });
      }
    }

    setSubiendo(null);
  };

  /* ---------------- el HTML del extenso ---------------- */

  /* Las imágenes de ABP van por cid en el correo; en la vista y en el PDF, dentro. */
  const sinCid = (texto: string) => {
    if (!abpActual?.ok) return texto;

    const porCid = new Map(abpActual.imagenes.map((i) => [i.cid, `data:${i.tipo};base64,${i.base64}`]));

    return texto.replace(/cid:([^"'\s)]+)/g, (todo, cid: string) => porCid.get(cid) ?? todo);
  };

  const abpCuerpo = abpActual?.ok ? abpActual.cuerpo : undefined;

  /* La vista previa: tal y como llega, con los documentos que se van a mandar. */
  /* La lista de adjuntos, como texto: cambia sólo si cambia lo marcado. */
  const listaVista = marcados.map((d) => `${d.nombre}\t${d.tamano ?? ""}`).join("\n");

  const htmlCrudo = useMemo(() => {
    if (!informeVisto) return "";

    const adjuntos: Descarga[] = listaVista
      ? listaVista.split("\n").map((linea) => {
          const [nombre, tamano] = linea.split("\t");

          return { nombre, tamano: tamano ? Number(tamano) : null, adjunto: true };
        })
      : [];

    return informeHtml(informeVisto, {
      abpCuerpo,
      adjuntos,
      video: videoAbp ? bloqueVideoHtml({ url: videoAbp.url, cid: "", segundos: videoAbp.segundos, claro: true, relleno: "18px 32px 0", sinCopia: true, rotulo: rotuloVideoAbp }) : undefined,
      capitulos: envio.completo.capitulos ?? undefined,
      mensaje: envio.completo.mensaje,
      firma: (ajustes.firma ?? "").trim() || undefined,
    });
  }, [informeVisto, abpCuerpo, listaVista, envio.completo.capitulos, envio.completo.mensaje, ajustes.firma, videoAbp, rotuloVideoAbp]);

  const htmlVista = sinCid(htmlCrudo);


  const [anchoVista, setAnchoVista] = useState(0);

  const caja = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nodo = caja.current;

    if (!nodo) return;

    const observa = new ResizeObserver(([e]) => setAnchoVista(Math.floor(e.contentRect.width)));

    observa.observe(nodo);

    return () => observa.disconnect();
  }, [informe, vista]);

  /* El nombre que ven en el correo: «Previa J7 CD Teruel - Resumen.pdf». */
  const nombreLegible = informe
    ? `${informe.momento === "post" ? "Post" : "Previa"}${informe.partido.jornada ? ` J${informe.partido.jornada}` : ""} ${informe.partido.rival || "rival"}`
    : "Informe";

  /** Cómo se llama en el correo un documento del rival: con su equipo y su extensión. */
  const nombreEnCorreo = (d: Documento) => {
    const ext = d.tipo === PPTX ? "pptx" : "pdf";

    if (d.generado) return nombreDeArchivo(`${informe?.partido.rival || "Rival"} - ${ROTULO_DOCUMENTO[d.generado].replace(/\s*\((PDF|PPT)\)\s*$/, "")}`, ext);

    return /\.(pdf|pptx)$/i.test(d.nombre) ? d.nombre : nombreDeArchivo(d.nombre, ext);
  };

  /* ---------------- el partido, para asuntos y nombres ---------------- */

  const p = informeVisto?.partido;

  const esPost = informeVisto?.momento === "post";

  const conGoles = Boolean(esPost && p && p.gf !== null && p.gc !== null);

  const cruce = p
    ? p.lado === "fuera"
      ? `${p.rival}${conGoles ? ` ${p.gc}-${p.gf}` : " –"} RM Castilla`
      : `RM Castilla${conGoles ? ` ${p.gf}-${p.gc}` : " –"} ${p.rival}`
    : "";

  /* «Previa · RM Castilla – CD Teruel (J7)»: lo que se lee en la bandeja. */
  const cabeceraAsunto = p ? `${esPost ? "Post" : "Previa"} · ${cruce}${p.jornada ? ` (J${p.jornada})` : ""}` : "";

  /*
  | El asunto con dato (20/10/2026): «J9 Algeciras CF (fuera, dom 16:30): 50 %
  | de victoria, 64 % con el plan» o «J8 · Remontamos 3-2 al Antequera CF:
  | dominio claro (xG 3,46 a 0,75)…». La etiqueta de siempre («Previa · … ·
  | Resumen») queda sólo de respaldo, si no hay informe.
  */
  const asuntoResumen = envio.resumen.asunto ?? (informeVisto ? asuntoInforme(informeVisto, "resumen") : `${cabeceraAsunto} · Resumen`);

  const asuntoCompleto = envio.completo.asunto ?? (informeVisto ? asuntoInforme(informeVisto, "completo") : `${cabeceraAsunto} · Informe completo`);

  /* El título que va en el pie y en las propiedades del PDF. */
  const tituloPdf = p ? `${esPost ? "Post" : "Previa"}${p.jornada ? ` J${p.jornada}` : ""} · ${cruce}` : "";

  /* ---------------- lo que se prepara solo, en segundo plano ---------------- */

  /*
  | Medido el 04/10/2026: mandar los dos correos tardaba 5 min y medio, y 4 de
  | ellos eran el PDF del completo. Ahora el PDF sale de una sola captura
  | (lib/informe-partido/pdf-completo.ts) y, además, las diapositivas y el PDF
  | se preparan **mientras se revisa el informe**: al pulsar «Enviar» ya están.
  | Cada pieza va con su clave; si cambia lo que la forma, se vuelve a hacer.
  */
  const claveDiapos = informeVisto && !cargando ? `${informeVisto.generado}|${informeVisto.momento}|${abpActual?.ok ? abpActual.clave : "-"}` : "";

  const capitulosElegidos = envio.completo.capitulos;

  const claveCompleto = claveDiapos ? `${claveDiapos}|${abpCargando ? "abp…" : "abp"}|${capitulosElegidos?.join(",") ?? "todos"}` : "";

  const cache = useRef<{
    diapos?: { clave: string; imagenes: Promise<string[]> };
    completo?: { clave: string; hojas: Promise<HojasCompleto> };
    /* El vídeo resumen, montado mientras se revisa (16/10/2026); `escucha` es quien enseña su avance ahora. */
    video?: { clave: string; montado: Promise<VideoMontado>; escucha?: (texto: string) => void };
  }>({});

  const [preparado, setPreparado] = useState<{ diapos: string; completo: string }>({ diapos: "", completo: "" });

  const [preparando, setPreparando] = useState<string | null>(null);

  /** Las diapositivas en JPEG, dibujadas fuera de pantalla a su tamaño real. */
  const dameDiapos = () => {
    const clave = claveDiapos;

    if (cache.current.diapos?.clave === clave) return cache.current.diapos.imagenes;

    const imagenes = capturaDiapositivas(() => lienzos.current);

    cache.current.diapos = { clave, imagenes };

    /* Sólo si sigue siendo la pieza vigente: una vieja que acaba tarde no
       puede pisar el «preparado» de la nueva (04/10/2026). */
    imagenes.then(
      () => {
        if (cache.current.diapos?.clave === clave) setPreparado((x) => ({ ...x, diapos: clave }));
      },
      () => {
        if (cache.current.diapos?.clave === clave) cache.current.diapos = undefined;
      },
    );

    return imagenes;
  };

  /**
   * Las hojas A4 del completo (con los capítulos elegidos), sin la lista de
   * adjuntos ni el mensaje, que son del correo. Se guardan una vez: de ellas
   * salen el PDF suelto («Completo PDF») y el PDF único del correo.
   */
  const dameHojasCompleto = (alPaso?: (h: number, t: number) => void) => {
    const clave = claveCompleto;

    if (cache.current.completo?.clave === clave) return cache.current.completo.hojas;

    const hojas = completoEnHojas(sinCid(informeHtml(informeVisto!, { abpCuerpo, capitulos: capitulosElegidos ?? undefined })), alPaso, { titulo: tituloPdf });

    cache.current.completo = { clave, hojas };

    /* Cambiando de capítulos deprisa, el de antes podía acabar después del
       nuevo y dejar «preparado» con su clave: no salía nunca «enviar es
       inmediato». Sólo cuenta si sigue siendo el de la caché (04/10/2026). */
    hojas.then(
      () => {
        if (cache.current.completo?.clave === clave) setPreparado((x) => ({ ...x, completo: clave }));
      },
      () => {
        if (cache.current.completo?.clave === clave) cache.current.completo = undefined;
      },
    );

    return hojas;
  };


  /*
  | El vídeo resumen, montado UNA vez por informe (16/10/2026). Antes se
  | montaba al pulsar «Enviar» y el envío esperaba minutos; ahora empieza solo
  | en cuanto están las diapositivas y el PDF, y al enviar se usa el que haya
  | (o se espera al que ya va por la mitad, sin empezar otro).
  */
  const claveVideo = claveDiapos ? `${claveDiapos}|video` : "";
  const quiereVideo = (envio.resumen.activo && envio.resumen.video) || (envio.completo.activo && envio.completo.video);

  const dameVideo = (escucha?: (texto: string) => void) => {
    if (cache.current.video?.clave === claveVideo) {
      if (escucha) cache.current.video.escucha = escucha;

      return cache.current.video.montado;
    }

    const clave = claveVideo;
    const entrada: NonNullable<typeof cache.current.video> = { clave, montado: Promise.resolve(null as unknown as VideoMontado), escucha };

    entrada.montado = (async () => {
      const escudos = await traeEscudos().catch(() => []);
      const escudo = buscadorDeEscudos(escudos)(informeVisto!.partido.rival);

      /* En segundo plano y por huella de contenido (02/11/2026): sigue al cerrar el diálogo y reabrir no lo rehace. */
      return trabajoVideo.pide(`Vídeo del informe · ${tituloPdf}`, guionDePartido(informeVisto!,{ escudoRival: escudo ? (escudo.startsWith("/") ? escudo : `/api/rivals/foto?url=${encodeURIComponent(escudo)}`) : null }), {
        alPaso: (t) => entrada.escucha?.(t),
        fuente: barlowCondensed.style.fontFamily,
      });
    })();

    cache.current.video = entrada;

    /* Si falla, se olvida: al enviar se intenta otra vez y, si vuelve a fallar, se dice. */
    entrada.montado.catch(() => {
      if (cache.current.video === entrada) cache.current.video = undefined;
    });

    return entrada.montado;
  };

  /* En cuanto hay informe (y ABP), se prepara todo sin que nadie lo pida. */
  useEffect(() => {
    if (!claveDiapos || abpCargando || trabajando) return;

    const videoHecho = !quiereVideo || !puedeMontarVideo() || Boolean(informeVisto?.videoListo?.url) || cache.current.video?.clave === claveVideo;
    const videoAbpHecho = !puedeVideoAbpPost || montajeAbpPost.current?.clave === abpClave;

    if (preparado.diapos === claveDiapos && preparado.completo === claveCompleto && videoHecho && videoAbpHecho) return;

    let vivo = true;

    const t = window.setTimeout(async () => {
      try {
        if (preparado.diapos !== claveDiapos) {
          setPreparando("Preparando las diapositivas…");

          await dameDiapos();
        }

        if (!vivo) return;

        setPreparando("Preparando el PDF del completo…");

        /* Sólo las hojas (03/11/2026): antes se armaba también el PDF, que se
           tiraba; el PDF suelto y el del correo salen de estas hojas al pedirlos. */
        await dameHojasCompleto((h, total) => vivo && setPreparando(`Preparando el PDF del completo · ${h} de ${total}…`));

        /* Y el vídeo, si va en algún correo y no lo ha montado ya el ordenador del club. */
        if (vivo && quiereVideo && puedeMontarVideo() && !informeVisto?.videoListo?.url) {
          setPreparando("Preparando el vídeo…");

          await dameVideo((t) => vivo && setPreparando(`Preparando el vídeo · ${t}`));
        }

        /* Y el vídeo post de balón parado, detrás del del partido (02/11/2026): la cola los monta de uno en uno. */
        if (vivo && puedeVideoAbpPost) {
          setPreparando("Preparando el vídeo post de balón parado…");

          await dameVideoAbpPost((t) => vivo && setPreparando(`Preparando el vídeo post de balón parado · ${t}`));
        }
      } catch {
        /* Al enviar se vuelve a intentar y, si falla, lo dice. */
      } finally {
        if (vivo) setPreparando(null);
      }
    }, 1500);

    return () => {
      vivo = false;
      window.clearTimeout(t);
      /* Si se corta a mitad (se pulsa Enviar), el rótulo no se puede quedar puesto: lo que siga lo dice el envío. */
      setPreparando(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDiapos, claveCompleto, abpCargando, trabajando, quiereVideo, puedeVideoAbpPost]);

  const listoTodo = Boolean(claveDiapos) && preparado.diapos === claveDiapos && preparado.completo === claveCompleto;

  /* ---------------- PDF y PPT del resumen ---------------- */

  /*
  | Las diapositivas que van. Una preferencia guardada de antes de la tercera
  | (06/10/2026) sólo trae dos casillas: la que falta cuenta como marcada.
  */
  const TODAS_DIAPOS = [0, 1, 2];
  const diapoMarcada = (i: number) => envio.resumen.diapos[i] ?? true;
  const indicesDiapos = TODAS_DIAPOS.filter(diapoMarcada);

  const rotuloDiapo = (i: number) =>
    i === 0 ? (esPost ? "El resultado" : "El rival") : i === 1 ? (esPost ? "Lo que buscábamos" : "Dónde está el partido") : esPost ? "Esta semana" : "Cómo lo ganamos";

  const pdfDe = async (imagenes: string[]) =>
    (await pdfDeLienzos(imagenes, { ancho: DIAPO_W, alto: DIAPO_H, orientacion: "landscape", margen: 0 })).output("blob") as Blob;

  const pptDe = (imagenes: string[], indices: number[]) =>
    creaPptx(
      imagenes.map((imagen, k) => ({ titulo: rotuloDiapo(indices[k] ?? k), imagen })),
      { titulo: `${esPost ? "Post" : "Previa"} · ${p?.rival ?? ""}`, aplicacion: "Informe del partido" },
    );

  const elegidas = async () => {
    const todas = await dameDiapos();

    const indices = indicesDiapos.length ? indicesDiapos : TODAS_DIAPOS;

    return { imagenes: indices.map((i) => todas[i]).filter(Boolean), indices };
  };

  /*
  | LAS DESCARGAS, EN SEGUNDO PLANO (08/11/2026, como las de ABP): el clic deja
  | el encargo en `lib/trabajos/descargas.ts` y vuelve; la píldora enseña el
  | progreso y avisa al terminar, y se puede cerrar el diálogo o cambiar de
  | pantalla. Si las diapositivas ya están preparadas se usan; si no, se pintan
  | en la «mesa» del gestor con la foto del informe del momento del clic (no
  | dependen de que el diálogo siga abierto).
  */
  const encargaResumen = (formato: "pdf" | "pptx" | "img") => {
    if (!informeVisto) return;

    const titulo = `${formato === "pdf" ? "Resumen en PDF" : formato === "pptx" ? "Resumen en PowerPoint" : "Resumen en imágenes"} · ${nombreLegible}`;

    if (descargaEnMarcha(titulo)) return;

    const inf = informeVisto;
    const indices = indicesDiapos.length ? indicesDiapos : TODAS_DIAPOS;
    const base = nombreLegible;
    const rotulos = indices.map(rotuloDiapo);
    /* Sólo las ya terminadas: las que van por la mitad se fotografían en el diálogo, que puede cerrarse. */
    const hechas = preparado.diapos === claveDiapos ? cache.current.diapos?.imagenes : undefined;

    encargaDescarga({
      titulo,
      vuelta: VUELTA_INFORME,
      mesa: hechas ? undefined : <LaminasDiapositivas inf={inf} />,
      ancho: DIAPO_W,
      tarea: async ({ raiz, avanza }) => {
        avanza("Dibujando las diapositivas…");

        const todas = await (hechas ?? capturaDiapositivas(() => raiz));
        const imagenes = indices.map((i) => todas[i]).filter(Boolean);

        if (formato === "pdf") {
          avanza("Montando el PDF…", 0.8);

          return { blob: await pdfDe(imagenes), nombre: nombreDeArchivo(`${base} - Resumen`, "pdf") };
        }

        if (formato === "pptx") {
          avanza("Montando el PowerPoint…", 0.8);

          return { blob: pptDe(imagenes, indices), nombre: nombreDeArchivo(`${base} - Resumen`, "pptx") };
        }

        /* Las diapositivas como imágenes sueltas (07/11/2026, ronda 14): para pasarlas por WhatsApp o pegarlas en una presentación. */
        return Promise.all(
          imagenes.map(async (imagen, k) => ({
            blob: await (await fetch(imagen)).blob(),
            nombre: nombreDeArchivo(`${base} - ${(indices[k] ?? k) + 1} ${rotulos[k] ?? rotuloDiapo(k)}`, /^data:image\/png/.test(imagen) ? "png" : "jpg"),
          })),
        );
      },
    });
  };

  const bajaPdf = () => encargaResumen("pdf");

  const bajaPptx = () => encargaResumen("pptx");

  const bajaImagenes = () => encargaResumen("img");

  /* El completo: sólo datos (`completoEnHojas` monta su propia caja), sin mesa. */
  const bajaCompleto = () => {
    if (!informeVisto) return;

    const titulo = `Informe completo en PDF · ${nombreLegible}`;

    if (descargaEnMarcha(titulo)) return;

    const nombre = nombreDeArchivo(`${nombreLegible} - Informe completo`, "pdf");
    /* Las hojas de estos capítulos, con el informe del momento del clic: las ya hechas (o en marcha) o unas nuevas. */
    const hojas = dameHojasCompleto;
    const tituloDoc = tituloPdf;

    encargaDescarga({
      titulo,
      vuelta: VUELTA_INFORME,
      tarea: async ({ avanza }) => {
        avanza("Preparando el PDF del completo…");

        const listas = await hojas((h, t) => avanza(`PDF del completo · hoja ${h} de ${t}…`, t ? (h / t) * 0.9 : undefined));

        avanza("Montando el PDF…", 0.95);

        return { blob: await informeUnicoPdf({ titulo: tituloDoc, diapos: [], hojas: listas }), nombre };
      },
    });
  };

  /*
  | El vídeo para los jugadores (21/10/2026, crítica del productor de vídeo):
  | la pieza corta «Consignas» (gancho, a vigilar, sus acciones, las claves y
  | la consigna; en el post, los goles y el balance), 75 s como mucho, con el
  | mismo motor. Se baja al aparato: no sube nada ni se manda a nadie, y quien
  | lo quiera lo comparte desde el móvil. En VERTICAL por defecto (1080×1920,
  | 21/10/2026: se ve en el móvil, por WhatsApp); el 16:9, con el botón de al lado.
  */
  /*
  | El guion de la pieza de los jugadores (22/10/2026): en el post, «lo que nos
  | deja» (goles con su corte, lo que nos hicieron y la consigna); si no hay
  | cortes, la de consignas de siempre. En la previa, si ese viernes también
  | sale el vídeo de balón parado, sus consignas van sólo en ése.
  */
  const guionJugadores = async (conAbp = false) => {
    const escudos = await traeEscudos().catch(() => []);
    const escudo = buscadorDeEscudos(escudos)(informeVisto!.partido.rival);
    const extras = { escudoRival: escudo ? (escudo.startsWith("/") ? escudo : `/api/rivals/foto?url=${encodeURIComponent(escudo)}`) : null };
    const deConsignas = consignasDePartido(informeVisto!, extras);

    if (informeVisto!.momento === "post") return consignasDePost(informeVisto!, extras) ?? deConsignas;

    return conAbp ? sinConsignasDeAbp(deConsignas) : deConsignas;
  };

  const hayPiezaDePost = useMemo(() => (informeVisto?.momento === "post" ? consignasDePost(informeVisto) !== null : false), [informeVisto]);

  /* En segundo plano (08/11/2026): el montaje ya iba por `trabajoVideo`; ahora también la descarga, con su píldora y su aviso. */
  const bajaVideoJugadores = (vertical = true) => {
    if (!informeVisto) return;

    const titulo = `Vídeo para jugadores${vertical ? "" : " · 16:9"} · ${nombreLegible}`;

    if (descargaEnMarcha(titulo)) return;

    const rotulo = `Vídeo para jugadores · ${tituloPdf}`;
    const guion = guionJugadores;
    const nombre = nombreDeArchivo(`${nombreLegible} - Consignas para jugadores${vertical ? "" : " (16x9)"}`, "mp4");

    encargaDescarga({
      titulo,
      vuelta: VUELTA_INFORME,
      tarea: async ({ avanza, senal }) => {
        avanza("Vídeo para jugadores…");

        const g = await guion();
        const opciones = {
          tope: SEGUNDOS_CONSIGNAS,
          minimo: vertical ? SEGUNDOS_CONSIGNAS_MINIMOS : undefined,
          vertical,
          fuente: barlowCondensed.style.fontFamily,
        };

        /* La ✕ de la píldora también para el montaje, no sólo la descarga. */
        senal.addEventListener("abort", () => trabajoVideo.cancela(huellaVideo(g, opciones)), { once: true });

        const v = await trabajoVideo.pide(rotulo, g, { ...opciones, alPaso: (t) => avanza(`Vídeo para jugadores · ${t}`) });

        return { blob: v.blob, nombre };
      },
    });
  };

  /*
  | El catálogo de la semana (22/10/2026, crítica del productor): el del
  | cuerpo técnico es el mismo que va en el correo (se reutiliza si ya está
  | montado) y el de los jugadores, la pieza corta de consignas.
  */
  const piezasDeVideo: PiezaDeVideo[] =
    informeVisto && puedeMontarVideo()
      ? [
          {
            id: "cuerpo-tecnico",
            nombre: esPost ? "El partido, para el cuerpo técnico" : "La previa, para el cuerpo técnico",
            publico: "Cuerpo técnico",
            formato: "horizontal",
            duracion: "de 1 a 2:30 min",
            archivo: nombreDeArchivo(`${nombreLegible} - Vídeo del informe`, "mp4"),
            monta: (alPaso) => dameVideo(alPaso),
          },
          {
            id: "jugadores",
            nombre: esPost ? (hayPiezaDePost ? "Lo que nos deja, para los jugadores" : "Consignas, para los jugadores") : "Consignas, para los jugadores",
            publico: "Jugadores",
            formato: "vertical, para el móvil",
            duracion: `de ${SEGUNDOS_CONSIGNAS_MINIMOS} a ${SEGUNDOS_CONSIGNAS} s`,
            archivo: nombreDeArchivo(`${nombreLegible} - ${esPost && hayPiezaDePost ? "Lo que nos deja" : "Consignas"} para jugadores`, "mp4"),
            monta: async (alPaso, contexto) => {
              return trabajoVideo.pide(`Vídeo para jugadores · ${tituloPdf}`, await guionJugadores(Boolean(contexto?.conAbp)), {
                tope: SEGUNDOS_CONSIGNAS,
                minimo: SEGUNDOS_CONSIGNAS_MINIMOS,
                vertical: true,
                fuente: barlowCondensed.style.fontFamily,
                alPaso,
              });
            },
          },
          /* El vídeo post de balón parado (02/11/2026): el mismo que va enlazado en el correo. */
          ...(puedeVideoAbpPost
            ? [
                {
                  id: "abp-post",
                  nombre: "Balón parado, lo preparado y el partido",
                  publico: "Cuerpo técnico",
                  formato: "horizontal",
                  duracion: videoAbp ? "de 1 a 4 min, con nuestro vídeo detrás" : "de 1 a 2:30 min",
                  archivo: nombreDeArchivo(`${nombreLegible} - Balón parado post en vídeo`, "mp4"),
                  monta: async (alPaso: (texto: string) => void) => {
                    const v = await dameVideoAbpPost(alPaso);

                    if (!v) throw new Error("El vídeo post de balón parado no ha salido.");

                    return v;
                  },
                } satisfies PiezaDeVideo,
              ]
            : []),
        ]
      : [];

  /* ---------------- mandar ---------------- */

  /**
   * Manda un correo y devuelve lo que el servidor dejó como enlace.
   *
   * La petición pasa por Vercel, que corta hacia los 4,5 MB (04/10/2026): se
   * mide antes y, si no cabe, se dice qué pasa en vez de un «HTTP 413».
   */
  /* Por WhatsApp (15/10/2026): todo se prepara y se sube igual, pero en vez de mandar el correo se escribe el mensaje con los enlaces. */
  const canal: CanalEnvio = ajustes.canal ?? "correo";
  const telefonosWa = telefonosDe(ajustes.telefonos ?? "");
  const { apunta } = useAgendaEnvios();

  /*
  | Qué envío es (02/11/2026): el mismo informe por el mismo canal no se lanza
  | dos veces a la vez, y al reabrir el diálogo con el envío en marcha el botón
  | lo dice.
  */
  const claveEnvio = `partido|${tituloPdf}|${informeVisto?.momento ?? ""}|${canal}`;
  const enviandoFuera = useSyncExternalStore(trabajoEnvios.suscribe, () => trabajoEnvios.enMarcha(claveEnvio), () => false);

  /** `asunto` y `lineas`: el formato corto de cuatro líneas (20/10/2026); el asunto, si viene, pisa al del correo. */
  type ParaWhatsapp = { titulo: string; asunto?: string; lineas?: string[]; mensaje?: string; firma?: string; resumen?: string; video?: string | null; enlaces: { nombre: string; url: string }[] };

  /*
  | Por WhatsApp, los mensajes de este envío se juntan aquí y, al acabar, van
  | al panel de los informes (02/11/2026): abrir wa.me necesita el clic.
  */
  const manda = async (cuerpo: Record<string, unknown>, wa?: ParaWhatsapp, mensajesWa?: MensajeWhatsapp[]) => {
    if (canal === "whatsapp") {
      if (wa && mensajesWa) {
        const i = mensajesWa.findIndex((m) => m.titulo === wa.titulo);

        if (i >= 0) mensajesWa.splice(i, 1);
        mensajesWa.push({ titulo: wa.titulo, texto: mensajeWhatsapp({ asunto: String(cuerpo.asunto ?? ""), ...wa }) });
      }

      return { enlazados: [] as string[] };
    }

    const json = JSON.stringify(cuerpo);

    const peso = bytesDe(json);

    if (peso > TOPE_PETICION_CORREO) {
      throw new Error(`El correo pesa ${mb(peso)} y por el servidor no pasa más de ${mb(TOPE_PETICION_CORREO)}: quita capítulos o gráficos.`);
    }

    const r = await fetch("/api/informe/correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    });

    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; enlazados?: string[] } | null;

    if (!r.ok || !j?.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);

    return { enlazados: Array.isArray(j.enlazados) ? j.enlazados : [] };
  };

  /** Las direcciones de un texto, o las malas. */
  const direccionesDe = (texto: string) => {
    const todas = texto.split(/[\s,;]+/).filter(Boolean);

    return { buenas: todas.filter((d) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d)), malas: todas.filter((d) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d)) };
  };

  const paraResumen = (ajustes.paraResumen ?? "").trim() || ajustes.destinatarios;

  const paraCompleto = (ajustes.paraCompleto ?? "").trim() || ajustes.destinatarios;

  /* Lo que va por pasos, para el botón: «Resumen: mandado · Completo: subiendo 2/4». */
  const pasos = useRef<{ resumen?: string; completo?: string }>({});

  /*
  | El envío en curso (04/10/2026). Si una subida fallaba, `Promise.all` se
  | rendía pero el PDF y las otras subidas seguían y, ya terminado el envío,
  | volvían a escribir en el botón («Completo: PDF 12/20…»): la pantalla se
  | quedaba con todo deshabilitado. Lo que llega de un envío ya acabado no pinta.
  */
  const envioEnCurso = useRef(0);

  /** Devuelve el texto junto, para el panel de los informes (02/11/2026). */
  const pinta = (vuelta: number, que: "resumen" | "completo", texto: string) => {
    if (vuelta !== envioEnCurso.current) return null;

    pasos.current[que] = texto;

    const junto = [pasos.current.resumen && `Resumen: ${pasos.current.resumen}`, pasos.current.completo && `Completo: ${pasos.current.completo}`].filter(Boolean).join(" · ");

    setTrabajando(junto);

    return junto;
  };

  /*
  | Las diapositivas se dibujan con el diálogo a la vista (02/11/2026): si se
  | cierra justo en ese momento, saldrían en blanco. Casi siempre ya están
  | preparadas y no se espera nada; si no, cerrar espera esos segundos.
  */
  const [dibujandoDiapos, setDibujandoDiapos] = useState(false);

  const cierra = () => {
    if (dibujandoDiapos) {
      toast.message("Un momento: terminando de dibujar las diapositivas", { description: "En unos segundos puedes cerrar; el envío sigue solo." });

      return;
    }

    onClose();
  };

  /* Lo que el informe no sabe: se enseña al pulsar «Enviar», no en el correo. */
  const [avisando, setAvisando] = useState(false);

  const pulsaEnviar = () => {
    if (informeVisto?.avisos.length) setAvisando(true);
    else void envia();
  };

  const envia = async () => {
    if (!informeVisto) return;

    if (trabajoEnvios.enMarcha(claveEnvio)) {
      toast.message("Este informe ya se está enviando", { description: "Abajo a la izquierda ves por dónde va." });

      return;
    }

    const { resumen: r, completo: c } = envio;

    if (!r.activo && !c.activo) {
      toast.error("Marca qué quieres mandar: el resumen, el completo o los dos.");

      return;
    }

    if (canal === "whatsapp" && telefonosWa.malos.length) {
      toast.error("Hay teléfonos mal escritos", { description: telefonosWa.malos.join(", ") });

      return;
    }

    /* Antes de dibujar nada: que haya a quién y bien escrito. Por WhatsApp no hace falta: sin teléfonos se elige el chat. */
    for (const [activo, texto, nombre] of canal === "whatsapp" ? [] : [
      [r.activo, paraResumen, "el resumen"],
      [c.activo, paraCompleto, "el completo"],
    ] as const) {
      if (!activo) continue;

      const { buenas, malas } = direccionesDe(texto);

      if (!buenas.length) {
        toast.error(`Escribe a quién va ${nombre}.`);

        return;
      }

      if (malas.length) {
        toast.error(`Hay direcciones mal escritas para ${nombre}`, { description: malas.join(", ") });

        return;
      }
    }

    if (r.activo && !indicesDiapos.length) {
      toast.error("Marca al menos una diapositiva para el resumen.");

      return;
    }

    /* Al servidor van ya limpias, separadas por comas: lo que aquí se da por
       bueno es lo que se manda (04/10/2026). */
    const aResumen = direccionesDe(paraResumen).buenas.join(", ");

    const aCompleto = direccionesDe(paraCompleto).buenas.join(", ");

    const firma = (ajustes.firma ?? "").trim() || undefined;

    /*
    | El PDF y el PPT del rival, si hay que sacarlos: se piden YA (dentro del
    | clic, o el navegador bloquea la pestaña) y se esperan sólo justo antes de
    | mandar el completo. El resumen no los espera.
    |
    | Si ya se están sacando («Volver a sacar» pulsado hace un momento), se
    | espera a ESA pestaña en vez de abrir otra (04/10/2026): dos pestañas
    | sacando lo mismo a la vez se pisaban los documentos guardados.
    */
    const yaSacandose = docsCargando;

    const docsNuevosP: Promise<Documento[]> =
      c.activo && c.sacarDocs && faltanDocs && !docsActual?.ok
        ? new Promise<DocsLlegados>((resuelve) => {
            /*
            | Con su propia escucha (02/11/2026): el envío sigue aunque se
            | cierre el diálogo, y la escucha del diálogo se va con él.
            */
            let reloj = 0;
            let bc: BroadcastChannel | null = null;

            const acaba = (llegado: DocsLlegados) => {
              window.removeEventListener("message", oye);
              bc?.close();
              window.clearTimeout(reloj);
              resuelve(llegado);
            };

            const oye = (e: MessageEvent) => {
              const d = e.data as { tipo?: string } | null;

              if (e.origin === window.location.origin && d?.tipo === "rival-documentos") acaba({ ...(d as unknown as DocsLlegados), clave: "" });
            };

            window.addEventListener("message", oye);

            try {
              bc = new BroadcastChannel("rival-documentos");
              bc.onmessage = (e) => {
                const d = e.data as { tipo?: string } | null;

                if (d?.tipo === "rival-documentos") acaba({ ...(d as unknown as DocsLlegados), clave: "" });
              };
            } catch {
              /* Sin canal queda la escucha del diálogo y el tiempo agotado. */
            }

            esperaDocs.current = acaba;

            if (!yaSacandose) abreDocs();

            reloj = window.setTimeout(() => acaba({ ok: false, clave: "", error: "Plantillas rivales no ha contestado a tiempo." }), ESPERA_DOCS);
          }).then((llegado) => {
            if (!llegado.ok) {
              toast.message("El PDF y el PPT del rival no han salido", { description: `${llegado.error} El completo sale sin ellos.` });

              return [];
            }

            return llegado.docs.map((x) => ({
              nombre: `${ROTULO_DOCUMENTO[x.tipo]} · recién sacado`,
              url: x.url,
              tipo: x.tipo === "plantilla-pdf" ? "application/pdf" : PPTX,
              tamano: x.tamano,
              adjuntable: true,
              origen: "rival" as const,
              generado: x.tipo,
            }));
          })
        : Promise.resolve([]);

    /*
    | Las diapositivas, ya: se dibujan con el diálogo a la vista. Casi siempre
    | están preparadas de antes; si no, cerrar espera a que acaben (02/11/2026).
    */
    let elegidasP = elegidas();

    if (preparado.diapos !== claveDiapos) {
      setDibujandoDiapos(true);
      void elegidasP.catch(() => undefined).finally(() => setDibujandoDiapos(false));
    }

    /*
    | EN SEGUNDO PLANO (02/11/2026): el envío entero pasa a
    | `lib/informes/trabajo-envios.ts`. Se puede cerrar el diálogo o cambiar de
    | pantalla; el panel de los informes dice por dónde va y, al acabar, sale
    | el aviso. Lo de abajo vive fuera de `corre` para que «Reintentar» no
    | rehaga lo ya subido ni vuelva a mandar el correo que ya salió.
    */
    const hechos = { resumen: false, completo: false };
    const subidas = new Map<string, Promise<{ nombre: string; url: string; tipo: string; tamano: number | null }>>();
    let videoP: Promise<{ nombre: string; url: string; tipo: string; tamano: number | null } | null> | null = null;
    let abpPostP: Promise<{ url: string; segundos: number; poster: string | null } | null> | null = null;
    let pdfResumenP: Promise<Blob> | null = null;
    let pptResumen: Blob | null = null;
    /* El vídeo ya subido: su enlace, lo que dura y su póster (para el correo y el PDF). */
    let infoVideo: { url: string; segundos: number; poster: string | null } | null = null;

    const corre = async (pasoTrabajo: (texto: string) => void): Promise<ResultadoEnvio> => {
    pasos.current = {};

    /* Este envío: lo que pinte uno anterior que siga coleando no cuenta. */
    envioEnCurso.current += 1;

    const vuelta = envioEnCurso.current;

    const paso = (que: "resumen" | "completo", texto: string) => {
      const junto = pinta(vuelta, que, texto);

      if (junto) pasoTrabajo(junto);
    };

    const mensajesWa: MensajeWhatsapp[] = [];

    try {
      if (r.activo && !hechos.resumen) paso("resumen", "diapositivas…");
      if (c.activo && !hechos.completo) paso("completo", listoTodo ? "listo para subir" : "preparando…");

      const { imagenes, indices } = await elegidasP.catch(() => (elegidasP = elegidas()));

      const cids = indices.map((i) => `diapositiva-${i + 1}`);

      const diapositivasCid = imagenes.map((img, k) => ({ cid: cids[k], tipo: "image/jpeg", base64: img.replace(/^data:[^;]+;base64,/, "") }));

      const nombreResumenPdf = nombreDeArchivo(`${nombreLegible} - Resumen`, "pdf");

      const nombreResumenPpt = nombreDeArchivo(`${nombreLegible} - Resumen`, "pptx");


      /* Se hacen sólo si alguno de los dos correos los lleva (`pdfResumenP`, fuera de `corre`). */
      /*
      | Con vídeo, el PDF del resumen lleva al final la diapositiva del vídeo
      | (póster, QR y enlace): espera a que el vídeo esté subido.
      */
      /* El PowerPoint del resumen ya no va adjunto (16/10/2026): sube y se enlaza desde el PDF y el correo. */
      const pptEnlace = () => subeUnaVez(nombreResumenPpt, PPTX, pptDelResumen);

      const pdfResumen = () =>
        (pdfResumenP ??= (async () => {
          const v = ((r.activo && r.video) || (c.activo && c.video)) && puedeMontarVideo() ? await videoResumen("resumen") : null;
          const enlaces: EnlaceInforme[] = r.ppt ? [{ nombre: (await pptEnlace()).nombre, url: (await pptEnlace()).url, detalle: "PowerPoint del resumen, para proyectarlo" }] : [];
          const video = v && infoVideo ? (infoVideo as { url: string; segundos: number; poster: string | null }) : null;

          if (!video && !enlaces.length && !infoAbp) return pdfDe(imagenes);

          const tituloEnlaces = `${informeVisto.momento === "post" ? "Post partido" : "Previa"} · ${informeVisto.partido.rival}`;

          /* El vídeo abre el PDF (22/10/2026): póster grande y QR en la primera página; al final, sólo los documentos. */
          const inicio = video ? await paginaDelVideo({ titulo: tituloEnlaces, video }).catch(() => null) : null;
          /* La página final lleva el vídeo de balón parado de la jornada con su póster y su QR (25/10/2026). */
          const final =
            enlaces.length || !inicio || infoAbp
              ? await paginaDeEnlaces({ titulo: tituloEnlaces, video: infoAbp ?? (inicio ? null : video), enlaces, rotuloVideo: infoAbp ? rotuloPdfAbp : undefined }).catch(() => null)
              : null;

          return informeUnicoPdf({ titulo: tituloPdf, diapos: imagenes, final, inicio });
        })().catch((error: unknown) => {
          /* Si falla, «Reintentar» lo vuelve a armar. */
          pdfResumenP = null;
          throw error;
        }));

      const pptDelResumen = () => (pptResumen ??= pptDe(imagenes, indices));

      const nombreInformePdf = nombreDeArchivo(`${nombreLegible} - Informe`, "pdf");

      /*
      | Cada archivo propio se sube UNA vez aunque vaya en los dos correos
      | (el PDF del resumen puede ir en ambos): las subidas se comparten.
      */
      const subeUnaVez = (nombre: string, tipo: string, blob: () => Promise<Blob> | Blob) => {
        const ya = subidas.get(nombre);

        if (ya) return ya;

        const promesa = (async () => {
          const datos = await blob();

          const a = await subeAdjunto(new File([datos], nombre, { type: tipo }));

          return { nombre, url: a.url, tipo, tamano: datos.size as number | null };
        })().catch((error: unknown) => {
          /* La que falla no se guarda: «Reintentar» la vuelve a subir (02/11/2026). */
          if (subidas.get(nombre) === promesa) subidas.delete(nombre);
          throw error;
        });

        subidas.set(nombre, promesa);

        return promesa;
      };

      /** Las imágenes que el HTML llama de verdad: lo que no se nombra saldría como adjunto suelto sin nombre. */
      const usadas = <X extends { cid: string }>(html: string, lista: X[]) => lista.filter((i) => html.includes(`cid:${i.cid}"`));

      /* ------------- el resumen ------------- */

      /*
      | El PDF y el PPT del resumen ya no viajan dentro de la petición
      | (04/10/2026): con las dos diapositivas en el cuerpo, en el PDF y en el
      | PPT, la petición pasaba de los ~4,5 MB que admite Vercel y el resumen no
      | salía. Suben a Supabase como los del completo y el servidor los adjunta.
      | Dentro sólo va el HTML con sus dos diapositivas (~1-2 MB).
      */
      /*
      | El vídeo resumen (12/10/2026): lo mismo que el PDF en menos de un
      | minuto, montado aquí en el navegador (lib/video-informe). Si algo falla
      | —la IA, el códec, el corte del rival— el correo sale igual, sin él, y
      | se dice en un aviso: el vídeo es un añadido, no una condición.
      */
      const nombreVideo = nombreDeArchivo(`${nombreLegible} - Resumen en vídeo`, "mp4");

      const aDataUrl = async (url: string) => {
        try {
          /* Con tope (03/11/2026): sin póster, el correo sale igual. */
          const respuesta = await fetch(url, { signal: corteDeRed(20_000) });

          if (!respuesta.ok) return null;

          const blob = await respuesta.blob();

          return await new Promise<string>((ok, mal) => {
            const lector = new FileReader();
            lector.onload = () => ok(String(lector.result));
            lector.onerror = mal;
            lector.readAsDataURL(blob);
          });
        } catch {
          return null;
        }
      };

      /* El bloque del vídeo para un correo (con el póster por cid si lo hay). */
      const bloqueVideo = (relleno?: string) => (infoVideo ? bloqueVideoHtml({ url: infoVideo.url, cid: infoVideo.poster ? "video-poster" : "", segundos: infoVideo.segundos, relleno, sinCopia: true }) : "");

      /*
      | El vídeo de balón parado de la jornada (25/10/2026): su póster por cid
      | en el correo y en la página del PDF. Se prepara una vez.
      */
      /*
      | Post (02/11/2026): el vídeo post de balón parado, montado mientras se
      | revisaba (o se espera al que va por la mitad) y subido una vez. Si no
      | sale, nuestro vídeo de la jornada tal cual, como hasta ahora.
      */
      const pasoAbp = (texto: string) => paso(c.activo ? "completo" : "resumen", `vídeo de balón parado: ${texto}`);

      const abpPost: { url: string; segundos: number; poster: string | null } | null = puedeVideoAbpPost
        ? await (abpPostP ??= (async () => {
            try {
              const v = await dameVideoAbpPost(pasoAbp);

              if (!v) return null;

              const subido = await subeAdjunto(new File([v.blob], nombreDeArchivo(`${nombreLegible} - Balón parado post en vídeo`, "mp4"), { type: "video/mp4" }), (f) => pasoAbp(`subiendo ${Math.round(f * 100)} %`));

              return { url: subido.url, segundos: v.segundos, poster: v.poster ?? null };
            } catch (error) {
              console.warn("[informe] el vídeo post de balón parado no ha subido", error);

              return null;
            }
          })())
        : null;

      if (puedeVideoAbpPost && !abpPost) toast.message("El vídeo post de balón parado no ha salido", { description: videoAbp ? "Va nuestro vídeo de la jornada tal cual." : "El informe va sin él." });

      const infoAbp: { url: string; segundos: number; poster: string | null } | null =
        abpPost ?? (videoAbp ? { url: videoAbp.url, segundos: videoAbp.segundos, poster: videoAbp.poster ? await aDataUrl(videoAbp.poster) : null } : null);

      const sufijoJornada = jornadaVideoAbp ? ` · J${jornadaVideoAbp}` : "";
      const rotuloPdfAbp = abpPost ? `Balón parado · post${sufijoJornada}` : `Balón parado${sufijoJornada}`;
      const rotuloBotonAbp = abpPost ? `Ver el vídeo post de balón parado${sufijoJornada}` : rotuloVideoAbp;

      const bloqueVideoAbp = (relleno?: string, claro?: boolean) =>
        infoAbp ? bloqueVideoHtml({ url: infoAbp.url, cid: infoAbp.poster ? "video-abp-poster" : "", segundos: infoAbp.segundos, relleno, claro, sinCopia: true, rotulo: rotuloBotonAbp }) : "";

      /** El vídeo de ABP como un enlace más (WhatsApp, texto plano). */
      const enlaceAbp = infoAbp ? [{ nombre: abpPost ? `Vídeo post de balón parado${sufijoJornada}` : nombreVideoAbp, url: infoAbp.url }] : [];

      const posterCid = () => [
        ...(infoVideo?.poster ? [{ cid: "video-poster", tipo: "image/jpeg", base64: infoVideo.poster.replace(/^data:[^;]+;base64,/, "") }] : []),
        ...(infoAbp?.poster ? [{ cid: "video-abp-poster", tipo: "image/jpeg", base64: infoAbp.poster.replace(/^data:[^;]+;base64,/, "") }] : []),
      ];

      /* Se monta UNA vez aunque vaya en los dos correos: la promesa (`videoP`, fuera de `corre`) se comparte. */
      const videoResumen = (correo: "resumen" | "completo") =>
        (videoP ??= (async () => {
          try {
            /* Si el ordenador del club ya montó el vídeo de esta jornada (con los cortes de Hudl), va ése tal cual: está en el bucket. */
            if (informeVisto.videoListo?.url) {
              paso(correo, "vídeo: ya montado ✓");

              infoVideo = { url: informeVisto.videoListo.url, segundos: informeVisto.videoListo.segundos, poster: informeVisto.videoListo.poster ? await aDataUrl(informeVisto.videoListo.poster) : null };

              /* Enlazado el de Full HD; adjunta, su copia ligera (los montajes de antes del 15/10 sólo tienen uno). */
              return { nombre: nombreVideo, url: informeVisto.videoListo.ligero || informeVisto.videoListo.url, tipo: "video/mp4", tamano: null as number | null };
            }

            /* El montado mientras se revisaba, o el que va por la mitad: no se empieza otro. */
            const v = await dameVideo((t) => paso(correo, `vídeo: ${t}`));


            /* El de Full HD va enlazado (póster, botón y QR); el adjunto es la copia ligera en 720p. */
            const hd = await subeAdjunto(new File([v.blob], nombreVideo, { type: "video/mp4" }), (f) => paso(correo, `vídeo: subiendo HD ${Math.round(f * 100)} %`));
            const subido = v.ligero ? await subeUnaVez(nombreVideo, "video/mp4", () => v.ligero!) : { nombre: nombreVideo, url: hd.url, tipo: "video/mp4", tamano: v.blob.size as number | null };

            infoVideo = { url: hd.url, segundos: v.segundos, poster: v.poster ?? null };

            return subido;
          } catch (error) {
            console.warn("[informe] el vídeo resumen no ha salido", error);
            toast.message("El correo va sin el vídeo resumen", { description: error instanceof Error ? error.message : "No se ha podido montar." });

            return null;
          }
        })());

      const correoResumen = async () => {
        /* Un PDF y un vídeo (16/10/2026): el PowerPoint, como enlace. */
        const archivos = (
          await Promise.all([
            ...(r.pdf ? [subeUnaVez(nombreResumenPdf, "application/pdf", pdfResumen)] : []),
            ...(r.video && puedeMontarVideo() ? [videoResumen("resumen")] : []),
          ])
        ).filter((a): a is NonNullable<typeof a> => a !== null);
        const pptSubido = r.ppt ? await pptEnlace() : null;

        paso("resumen", "mandando…");

        const html = resumenHtml(informeVisto, cids, {
          video: bloqueVideo() + bloqueVideoAbp(),
          conCompleto: c.activo,
          mensaje: r.mensaje,
          firma,
          /* El vídeo ya va enlazado en HD con su póster (22/10/2026): su copia ligera es un enlace de descarga, no un adjunto pesado. */
          descargas: [...archivos.map((a) => ({ nombre: a.tipo === "video/mp4" ? "Copia ligera del vídeo, para verla sin conexión" : a.nombre, url: a.url, tamano: a.tamano, adjunto: a.tipo !== "video/mp4" })), ...(pptSubido ? [{ nombre: pptSubido.nombre, url: pptSubido.url, tamano: pptSubido.tamano, adjunto: false }] : [])],
        });

        await manda({
          para: aResumen,
          asunto: asuntoResumen,
          html,
          texto: `${r.mensaje?.trim() ? `${r.mensaje.trim()}${firma ? `\n— ${firma}` : ""}\n\n` : ""}${informeTexto(informeVisto)}${enlaceAbp.map((e) => `\n\n${e.nombre}: ${e.url}`).join("")}`,
          imagenes: usadas(html, [...diapositivasCid, ...posterCid()]),
          adjuntosUrl: archivos.filter((a) => a.tipo !== "video/mp4").map((a) => ({ nombre: a.nombre, url: a.url, tipo: a.tipo })),
        }, {
          /* WhatsApp en cuatro líneas (20/10/2026): titular en negrita, qué hacemos, el vídeo y el PDF.
             Antes iba el informe entero en texto, que en el móvil no se lee. */
          titulo: "Resumen",
          asunto: whatsappInforme(informeVisto).titular,
          lineas: whatsappInforme(informeVisto).lineas,
          mensaje: r.mensaje,
          firma,
          video: (infoVideo as { url: string } | null)?.url ?? null,
          enlaces: [...enlaceAbp, ...archivos, ...(pptSubido ? [pptSubido] : [])],
        }, mensajesWa);

        paso("resumen", "mandado ✓");
      };

      /* ------------- el completo ------------- */

      const correoCompleto = async () => {
        /*
        | UN PDF Y UN VÍDEO (16/10/2026). Antes iban sueltos el PDF del completo,
        | el del resumen, el PowerPoint, la plantilla y el informe del rival y
        | el vídeo. Ahora: el vídeo (enlazado en HD, adjunta la copia ligera),
        | el PowerPoint y los documentos del rival suben y se ENLAZAN; y un PDF
        | junta las diapositivas, el completo y la página «Vídeo y documentos».
        */
        const videoCompleto = c.video && puedeMontarVideo() ? await videoResumen("completo") : null;
        const pptSubido = c.pptResumen ? await pptEnlace() : null;

        if (c.sacarDocs && faltanDocs && !docsActual?.ok) paso("completo", "esperando el PDF y el PPT del rival…");

        const docsNuevos = await docsNuevosP;

        const sustituidos = new Set(docsNuevos.map((x) => x.generado));

        const adjuntosRival = [...docsNuevos, ...marcados.filter((x) => !x.generado || !sustituidos.has(x.generado))];

        /* Lo que pesa cada documento del rival, preguntado al almacén sin bajarlo: va en la fila del enlace. */
        const conPeso = await Promise.all(adjuntosRival.map(async (d) => ({ ...d, tamano: d.tamano ?? (await pesoDeUrl(d.url)) })));

        const soloEnlace = [
          ...(pptSubido ? [{ nombre: pptSubido.nombre, url: pptSubido.url, tipo: pptSubido.tipo, tamano: pptSubido.tamano, detalle: "PowerPoint del resumen, para proyectarlo" }] : []),
          ...conPeso.map((d) => ({ nombre: nombreEnCorreo(d), url: d.url, tipo: d.tipo, tamano: d.tamano, detalle: d.tipo === PPTX ? "PowerPoint del rival" : "PDF del rival" })),
        ];

        paso("completo", "armando el PDF…");

        const video = videoCompleto && infoVideo ? (infoVideo as { url: string; segundos: number; poster: string | null }) : null;

        /* Sin diapositivas, sin completo, sin vídeo y sin documentos que
           enlazar, el PDF saldría vacío (o sin páginas, y el correo fallaba):
           entonces no se arma ni se adjunta (19/10/2026). */
        const hayPdf = c.pdfResumen || c.pdfCompleto || Boolean(video) || Boolean(infoAbp) || soloEnlace.length > 0;

        const pdfUnico = !hayPdf ? null : await subeUnaVez(nombreInformePdf, "application/pdf", async () =>
          informeUnicoPdf({
            titulo: tituloPdf,
            diapos: c.pdfResumen ? imagenes : [],
            hojas: c.pdfCompleto ? await dameHojasCompleto((h, t) => paso("completo", `PDF ${h}/${t}…`)) : null,
            inicio: video ? await paginaDelVideo({ titulo: `${informeVisto.momento === "post" ? "Post partido" : "Previa"} · ${informeVisto.partido.rival}`, video }).catch(() => null) : null,
            final:
              soloEnlace.length || !video || infoAbp
                ? await paginaDeEnlaces({
                    titulo: `${informeVisto.momento === "post" ? "Post partido" : "Previa"} · ${informeVisto.partido.rival}`,
                    video: infoAbp,
                    rotuloVideo: infoAbp ? rotuloPdfAbp : undefined,
                    enlaces: soloEnlace.map((d) => ({ nombre: d.nombre, url: d.url, detalle: `${d.detalle}${d.tamano ? ` · ${mb(d.tamano)}` : ""}` })),
                  }).catch(() => null)
                : null,
          }),
        );

        /* Adjuntos: el PDF y el vídeo, mientras quepan; lo demás, enlace. */
        /* El vídeo va enlazado en HD con su póster (22/10/2026): la copia ligera, como enlace de descarga, no como adjunto. */
        const candidatos = [...(pdfUnico ? [pdfUnico] : [])];

        let ocupado = 0;

        const reparto = candidatos.map((d) => {
          const bytes = d.tamano ?? PESO_DESCONOCIDO;

          const cabe = ocupado + bytes <= TOPE_ADJUNTOS;

          if (cabe) ocupado += bytes;

          return { ...d, adjunto: cabe };
        })
          .concat(videoCompleto ? [{ ...videoCompleto, nombre: "Copia ligera del vídeo, para verla sin conexión", adjunto: false }] : [])
          .concat(soloEnlace.map((d) => ({ nombre: d.nombre, url: d.url, tipo: d.tipo, tamano: d.tamano, adjunto: false })));

        const descargas: Descarga[] = reparto.map((d) => ({ nombre: d.nombre, url: d.url, tamano: d.tamano, adjunto: d.adjunto }));

        /* La versión más completa que Gmail no recorte. */
        const base: ExtrasInforme = {
          abpCuerpo,
          diapositivas: cids,
          adjuntos: descargas,
          capitulos: capitulosElegidos ?? undefined,
          video: bloqueVideo("22px 32px 0") + bloqueVideoAbp("14px 32px 0", true),
          mensaje: c.mensaje,
          firma,
        };

        /*
        | Aligerar el cuerpo quita tablas y el ABP entero diciendo «está en el
        | PDF del informe completo, adjunto». Sólo es verdad si ese PDF va de
        | verdad adjunto (04/10/2026): sin él, lo quitado no estaba en ningún
        | sitio. Sin PDF adjunto va entero, aunque Gmail lo recorte (el resto
        | se ve con «Ver todo el mensaje»).
        */
        const pdfAdjunto = c.pdfCompleto && reparto.some((d) => d.nombre === nombreInformePdf && d.adjunto);

        const imagenesAbp = abpActual?.ok ? abpActual.imagenes : [];

        const arma = (ligero: 0 | 1 | 2) => {
          const html = informeHtml(informeVisto, { ...base, ligero });

          /* Sólo las imágenes que el cuerpo llama: con el capítulo de ABP
             quitado, o ABP resumido, sus gráficos no viajan. */
          return { html, imagenes: usadas(html, [...diapositivasCid, ...imagenesAbp, ...posterCid()]) };
        };

        const pesa = (x: { html: string; imagenes: { base64: string }[] }) => bytesDe(x.html) + x.imagenes.reduce((s, i) => s + i.base64.length, 0);

        let ligero: 0 | 1 | 2 = 0;

        let pieza = arma(0);

        /* Con margen para el texto y lo demás de la petición. */
        const cabePeticion = (x: typeof pieza) => pesa(x) < TOPE_PETICION_CORREO - 256 * 1024;

        while (pdfAdjunto && ligero < 2 && (bytesDe(pieza.html) > TOPE_HTML || !cabePeticion(pieza))) {
          ligero = (ligero + 1) as 1 | 2;

          pieza = arma(ligero);
        }

        paso("completo", "mandando…");

        const { enlazados } = await manda({
          para: aCompleto,
          asunto: asuntoCompleto,
          html: pieza.html,
          texto: `${c.mensaje?.trim() ? `${c.mensaje.trim()}${firma ? `\n— ${firma}` : ""}\n\n` : ""}${informeTexto(informeVisto)}${abpActual?.ok ? `\n\n— BALÓN PARADO —\n${abpActual.texto}` : ""}\n\n— DOCUMENTOS —\n${[...enlaceAbp, ...descargas].map((d) => `${d.nombre}: ${d.url}`).join("\n")}`,
          imagenes: pieza.imagenes,
          adjuntosUrl: reparto.filter((d) => d.adjunto).map((d) => ({ nombre: d.nombre, url: d.url, tipo: d.tipo })),
        }, { titulo: "Informe completo", mensaje: c.mensaje, firma, video: (infoVideo as { url: string } | null)?.url ?? null, enlaces: [...enlaceAbp, ...descargas.flatMap((d) => (d.url ? [{ nombre: d.nombre, url: d.url }] : []))] }, mensajesWa);

        paso("completo", "mandado ✓");

        /* Los que no cabían aquí más los que el servidor dejó como enlace. */
        /* Sólo los que debían ir adjuntos y no cupieron (los enlaces lo son a propósito), más los que el servidor dejó como enlace. */
        return reparto.filter((d) => !d.adjunto && !soloEnlace.some((x) => x.url === d.url)).length + enlazados.length;
      };

      /* Los dos a la vez: el resumen no espera a que se suba el completo. */
      /* Al reintentar, el que ya salió no se vuelve a mandar (02/11/2026). */
      const vaResumen = r.activo && !hechos.resumen;
      const vaCompleto = c.activo && !hechos.completo;

      const [resResumen, resCompleto] = await Promise.allSettled([vaResumen ? correoResumen() : Promise.resolve(), vaCompleto ? correoCompleto() : Promise.resolve(0)]);

      if (vaResumen && resResumen.status === "fulfilled") hechos.resumen = true;
      if (vaCompleto && resCompleto.status === "fulfilled") hechos.completo = true;

      const fallos = [
        resResumen.status === "rejected" ? `Resumen: ${resResumen.reason instanceof Error ? resResumen.reason.message : resResumen.reason}` : "",
        resCompleto.status === "rejected" ? `Completo: ${resCompleto.reason instanceof Error ? resCompleto.reason.message : resCompleto.reason}` : "",
      ].filter(Boolean);

      const salieron = [vaResumen && resResumen.status === "fulfilled" && "el resumen", vaCompleto && resCompleto.status === "fulfilled" && "el informe completo"].filter(Boolean);

      /* Nada ha salido: el aviso de error, con «Reintentar». */
      if (!salieron.length) throw new Error(fallos.join(" · ") || "No se ha podido mandar.");

      /* A quién se ha mandado, a la agenda: la próxima vez se propone. */
      const destinatarios = [...new Set([...(vaResumen && resResumen.status === "fulfilled" ? direccionesDe(paraResumen).buenas : []), ...(vaCompleto && resCompleto.status === "fulfilled" ? direccionesDe(paraCompleto).buenas : [])].map((d) => d.toLowerCase()))];

      if (canal === "whatsapp") apunta("whatsapp", telefonosWa.buenos);
      else apunta("correo", destinatarios);

      const queInforme = `${informeVisto.momento === "post" ? "Post partido" : "Previa"} · ${informeVisto.partido.rival}`;

      if (canal === "whatsapp") {
        return {
          titulo: `Informe del partido listo para WhatsApp`,
          texto: `${queInforme}: el mensaje va escrito con los enlaces.`,
          whatsapp: { mensajes: mensajesWa, telefonos: telefonosWa.buenos },
          fallo: fallos.length ? fallos.join(" · ") : undefined,
        };
      }

      const enlazados = resCompleto.status === "fulfilled" ? Number(resCompleto.value) || 0 : 0;
      const cuantos = destinatarios.length;

      return {
        titulo: `${salieron.length === 2 ? "Resumen e informe completo enviados" : `Informe del partido enviado${salieron[0] === "el resumen" ? " (resumen)" : ""}`} a ${cuantos} destinatario${cuantos === 1 ? "" : "s"}`,
        texto: `${queInforme}.${enlazados ? ` ${enlazados} ${enlazados === 1 ? "documento va" : "documentos van"} como enlace de descarga: no cabían adjuntos (${mb(TOPE_ADJUNTOS)} por correo).` : ""}`,
        fallo: fallos.length ? fallos.join(" · ") : undefined,
      };
    } finally {
      /* Lo que aún esté corriendo de este envío (un PDF a medias, una subida
         tras un fallo) ya no escribe en el botón. */
      envioEnCurso.current += 1;

      setTrabajando(null);
    }
    };

    trabajoEnvios.lanza({ clave: claveEnvio, rotulo: `Informe del partido · ${tituloPdf}`, href: "/microcycles", ejecuta: corre });
  };

  /* Lo que se ve mientras carga es lo pedido, no lo que había. */
  const momento = momentoPedido ?? informe?.momento ?? "previa";

  const [Uno, Dos, Tres] = DIAPOSITIVAS[informeVisto?.momento ?? "previa"];

  /* Mandar el completo sin esperar a ABP dejaría fuera su informe: se espera,
     salvo que sólo se mande el resumen (que ya lleva su pincelada si llegó). */
  const esperaAbp = envio.completo.activo && abpCargando;

  const capitulos = useMemo(() => (informeVisto ? capitulosDe(informeVisto, { abpCuerpo }) : []), [informeVisto, abpCuerpo]);

  const marcadoCapitulo = (id: string) => !capitulosElegidos || capitulosElegidos.includes(id);

  const cambiaCapitulo = (id: string, si: boolean) =>
    setEnvio((e) => {
      const actuales = e.completo.capitulos ?? capitulos.map((x) => x.id);

      const nuevos = si ? [...new Set([...actuales, id])] : actuales.filter((x) => x !== id);

      /* En el orden del informe; si están todos, «todos» (sigue valiendo si aparece uno nuevo). */
      const ordenados = capitulos.map((x) => x.id).filter((x) => nuevos.includes(x));

      return { ...e, completo: { ...e.completo, capitulos: ordenados.length === capitulos.length ? null : ordenados } };
    });

  const cambia = <K extends "resumen" | "completo">(que: K, cambio: Partial<OpcionesEnvio[K]>) => setEnvio((e) => ({ ...e, [que]: { ...e[que], ...cambio } }));

  /* Los interruptores se recuerdan de una vez para otra (no el texto, que es de cada partido). */
  useEffect(() => {
    /*
    | Mientras carga, no (07/10/2026). Al abrir, este efecto corre con los
    | interruptores por defecto y el documento todavía vacío: escribía esos
    | valores encima de los recordados antes de que llegaran. Y se escribe
    | sobre lo último que haya (actualizador), no sobre el `ajustes` del render.
    */
    if (estadoAjustes === "loading") return;

    const { resumen: r, completo: c } = envio;

    const preferencias = { resumenPdf: r.pdf, resumenPpt: r.ppt, resumenVideo: r.video, completoPdf: c.pdfCompleto, completoVideo: c.video, completoResumenPdf: c.pdfResumen, completoResumenPpt: c.pptResumen };

    setAjustes((a) => (JSON.stringify(preferencias) !== JSON.stringify(a.preferencias ?? {}) ? { ...a, preferencias } : a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envio.resumen.pdf, envio.resumen.ppt, envio.resumen.video, envio.completo.pdfCompleto, envio.completo.video, envio.completo.pdfResumen, envio.completo.pptResumen]);

  const casilla = (checked: boolean, onChange: (v: boolean) => void, texto: ReactNode, pie?: string, disabled = false) => (
    <label className={`flex items-start gap-2 ${disabled ? "opacity-40" : "cursor-pointer"}`}>
      <input type="checkbox" className="mt-0.5 shrink-0 accent-[#C8A96B]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="text-white/80">{texto}</span>
        {pie ? <span className="block text-[11px] text-white/35">{pie}</span> : null}
      </span>
    </label>
  );

  const campo = "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#C8A96B]/50";

  const rotuloCaja = "mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40";

  /*
  | Mientras se dibujan las diapositivas y las hojas del completo («8 de 19»),
  | Descargar y Enviar esperan, con su porcentaje (10/11/2026, análisis): así no
  | sale un documento a medias. El vídeo, que tarda minutos, no bloquea.
  */
  /*
  | UN solo progreso (11/11/2026, análisis y fútbol): en el móvil salían a la vez
  | «Preparando las diapositivas…» a la izquierda y «Preparando el PDF · 0 %» en
  | el botón. Ahora la cuenta es una (las diapositivas, el primer 20 %; las hojas
  | del completo, el resto) y sólo la lleva el botón. Descargar no espera: el
  | encargo usa lo ya dibujado o lo dibuja aparte (`encargaDescarga`).
  */
  const fraccionDoc = !preparando
    ? null
    : /^Preparando las diapositivas/.test(preparando)
      ? 0.1
      : /^Preparando el PDF del completo/.test(preparando)
        ? 0.2 + 0.8 * (fraccionDe(preparando) ?? 0)
        : null;
  const preparandoDoc = fraccionDoc !== null;

  const bloqueDestinatarios = (
    <Destinatarios
      label="A quién se le manda (los dos)"
      canal={canal}
      onCanal={(c) => setAjustes((a) => ({ ...a, canal: c }))}
      correos={ajustes.destinatarios}
      onCorreos={(destinatarios) => setAjustes((a) => ({ ...a, destinatarios }))}
      telefonos={ajustes.telefonos ?? ""}
      onTelefonos={(telefonos) => setAjustes((a) => ({ ...a, telefonos }))}
    />
  );

  const botonEnviar = trabajando
    ? trabajando
    : preparandoDoc
      ? `Preparando el envío · ${Math.round(fraccionDoc * 100)} %`
    : enviandoFuera
      ? "Enviando…"
      : esperaAbp
      ? "Preparando ABP…"
      : canal === "whatsapp"
        ? "Preparar WhatsApp"
        : envio.resumen.activo && envio.completo.activo
        ? "Enviar los dos"
        : envio.resumen.activo
          ? "Enviar el resumen"
          : envio.completo.activo
            ? "Enviar el completo"
            : "Enviar";

  const fraccionPreparando = fraccionDe(preparando);

  /* Las mismas piezas que monta «piezasDeVideo», contadas sin tocarlas (el linter no deja leerlas en el render: llevan refs dentro). */
  const cuantasPiezas = informeVisto && puedeMontarVideo() ? 2 + (puedeVideoAbpPost ? 1 : 0) : 0;

  /* Los resúmenes de una línea de cada plegable: lo que se manda sin abrirlo. */
  const diaposMarcadas = TODAS_DIAPOS.filter((i) => diapoMarcada(i)).length;

  const resumenCorreo1 = envio.resumen.activo
    ? [`«${asuntoResumen}»`, `${diaposMarcadas} de ${TODAS_DIAPOS.length} diapositivas`, envio.resumen.pdf && "PDF adjunto", envio.resumen.ppt && "PowerPoint enlazado", envio.resumen.video && "vídeo"].filter(Boolean).join(" · ")
    : "No se manda: márcalo para mandarlo";

  const adjuntosElegidos = documentos.filter((d) => d.adjuntable && !quitados.has(d.url)).length;
  const enlazados = documentos.filter((d) => !d.adjuntable).length;

  const resumenCorreo2 = envio.completo.activo
    ? [
        `«${asuntoCompleto}»`,
        `${capitulos.filter((x) => marcadoCapitulo(x.id)).length} de ${capitulos.length} capítulos`,
        envio.completo.pdfCompleto && "PDF adjunto",
        envio.completo.video && "vídeo",
        adjuntosElegidos > 0 && (adjuntosElegidos === 1 ? "1 documento" : `${adjuntosElegidos} documentos`),
        enlazados > 0 && (enlazados === 1 ? "1 enlace" : `${enlazados} enlaces`),
      ]
        .filter(Boolean)
        .join(" · ")
    : "No se manda: márcalo para mandarlo";

  return (
    <Dialog
      title="Informe del partido"
      subtitle="Resumen en tres diapositivas e informe completo, para el cuerpo técnico"
      onClose={cierra}
      sinBotonFlotante
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-white/45">
            {dibujandoDiapos ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Dibujando las diapositivas: en unos segundos puedes cerrar
              </>
            ) : enviandoFuera ? (
              /* 02/11/2026: el envío ya no depende de esta ventana. */
              <span className="text-[#C8A96B]">Puedes cerrar y seguir con otra cosa: se sigue enviando y te avisa al terminar.</span>
            ) : preparando && !preparandoDoc ? (
              /* Una barra fina mientras corre (06/11/2026); al terminar, desaparece. */
              <span className="flex min-w-0 items-center gap-2" role="status" aria-live="polite">
                {fraccionPreparando !== null ? (
                  <span className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <span className="block h-full rounded-full bg-[#C8A96B] transition-[width] duration-300" style={{ width: `${Math.max(4, Math.round(fraccionPreparando * 100))}%` }} />
                  </span>
                ) : (
                  <Loader2 size={12} className="shrink-0 animate-spin" />
                )}
                <span className="min-w-0 truncate">{preparando}</span>
              </span>
            ) : listoTodo ? (
              <>
                <Check size={12} className="text-emerald-300" /> Diapositivas y PDF preparados: enviar es inmediato
              </>
            ) : informe && !cargando && !preparandoDoc ? (
              "Las diapositivas y el PDF se preparan solos mientras lo revisas"
            ) : null}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Un solo «Descargar» (07/11/2026, ronda 14): seis botones sueltos ocupaban tres filas en el móvil. */}
            <MenuDescargar
              disabled={!informe || Boolean(trabajando) || cargando}
              opciones={[
                { id: "pdf", rotulo: "Resumen en PDF", detalle: "Las diapositivas elegidas, una por página", icon: FileText, onSelect: () => void bajaPdf() },
                { id: "img", rotulo: "Resumen en imágenes", detalle: "Una imagen por diapositiva, para WhatsApp", icon: ImageIcon, onSelect: () => void bajaImagenes() },
                { id: "ppt", rotulo: "Resumen en PowerPoint", detalle: "Las mismas diapositivas, para proyectar", icon: Presentation, onSelect: () => void bajaPptx() },
                {
                  id: "completo",
                  rotulo: "Informe completo en PDF",
                  detalle: abpCargando ? "Esperando al balón parado para meterlo" : "Con los capítulos elegidos",
                  icon: BookOpen,
                  disabled: abpCargando,
                  onSelect: () => void bajaCompleto(),
                },
                ...(puedeMontarVideo()
                  ? [
                      { id: "video", rotulo: "Vídeo para jugadores · vertical", detalle: "45-75 s para el móvil; se descarga, no se envía", icon: Clapperboard, onSelect: () => void bajaVideoJugadores() },
                      { id: "video169", rotulo: "Vídeo para jugadores · 16:9", detalle: "La misma pieza en horizontal, para proyectarla", icon: Clapperboard, onSelect: () => void bajaVideoJugadores(false) },
                    ]
                  : []),
              ]}
            />
            <Button
              tone="primary"
              icon={trabajando || esperaAbp || enviandoFuera || preparandoDoc ? Loader2 : Send}
              disabled={!informe || Boolean(trabajando) || enviandoFuera || cargando || esperaAbp || Boolean(subiendo) || preparandoDoc}
              onClick={pulsaEnviar}
              title={esperaAbp ? "Esperando al informe de balón parado del microciclo" : undefined}
            >
              {botonEnviar}
            </Button>
          </div>
        </div>
      }
    >
      {/* `data-informe-partido`: en el móvil esconde el botón de herramientas, que tapaba «Enviar» (globals.css, 11/11/2026). */}
      <div data-informe-partido className={`space-y-4 ${barlowCondensed.className}`} style={{ ["--fuente-informe" as string]: barlowCondensed.style.fontFamily, fontFamily: "inherit" }}>
        {/*
          ORDEN (06/11/2026, jueces): arriba, en una fila, el microciclo, el
          momento y a quién; justo debajo, el documento. Todo lo demás (los dos
          correos, la firma, los vídeos y los avisos) va plegado y cerrado, con
          lo que lleva dicho en una línea.
        */}
        <div className="flex flex-wrap items-start gap-3 font-sans">
          <label className="w-full min-w-0 sm:w-auto sm:min-w-[220px]">
            <span className={rotuloCaja}>Microciclo</span>
            <select
              value={elegido ? `${elegido.temporada}|${elegido.micro}` : ""}
              onChange={(e) => {
                const [t, m] = e.target.value.split("|");

                setElegido({ temporada: t, micro: Number(m) });
                setMomentoPedido(null);
                setSubidos([]);
                setQuitados(new Set());
                setEnvio((x) => textosLimpios(x));
              }}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-[#C8A96B]/50"
            >
              {/*
              | Sólo las semanas con informe (11/11/2026, marketing): «Micro 12 ·
              | semana sin partido, sin informe» salía como una opción más. El
              | salto de número ya dice que esa semana no hubo partido.
              */}
              {(micros ?? []).map((m) => (
                <option key={`${m.temporada}|${m.micro}`} value={`${m.temporada}|${m.micro}`} className="bg-[#11161C]">
                  Micro {m.micro} · {m.rival || "sin rival"}
                </option>
              ))}
            </select>
            {(() => {
              /* Sin hueco en la lista que no se explique: «Micro 12: semana sin competición». */
              const deEsta = sinCompeticion.filter((m) => !elegido || m.temporada === elegido.temporada).map((m) => m.micro).sort((a, b) => b - a);

              return deEsta.length ? (
                <span className="mt-1 block text-[11px] text-white/45">
                  {deEsta.length === 1 ? `Micro ${deEsta[0]}: semana sin competición, sin informe` : `Micros ${deEsta.slice(0, -1).join(", ")} y ${deEsta[deEsta.length - 1]}: semanas sin competición, sin informe`}
                </span>
              ) : null;
            })()}
          </label>

          <div className="min-w-0 max-w-full">
            <span className={rotuloCaja}>Momento</span>
            <Segmented
              ariaLabel="Previa o post"
              value={momento}
              options={[
                { key: "previa", label: "Previa del partido" },
                { key: "post", label: informe && !informe.partido.jugado ? "Post (tras el partido)" : "Post partido" },
              ]}
              onChange={(m) => {
                /* Sin partido jugado no hay post (06/11/2026): salían láminas vacías y «0′ de balón parado». */
                if (m === "post" && informe && !informe.partido.jugado) return;
                setMomentoPedido(m as Momento);
                setEnvio((x) => textosLimpios(x));
              }}
            />
            <span className="mt-1 block max-w-[300px] text-[11px] text-white/45">
              {informe && !informe.partido.jugado
                ? "Aún no se ha jugado: el post se podrá sacar en cuanto haya resultado"
                : momentoPedido === "previa"
                ? "Elegido a mano: la previa se puede sacar aunque ya se haya jugado"
                : momentoPedido === "post"
                  ? "Post del partido jugado"
                : informe?.partido.jugado
                  ? "Ya se jugó: sale el post (la previa sigue disponible)"
                  : "Aún no se ha jugado: sale la previa"}
            </span>
          </div>

          {/* Los correos en minúscula al pintarlos (como en el de ABP): el valor no cambia. */}
          {!esMovil ? <div className="min-w-0 flex-1 basis-[280px] [&_span.rounded-md]:lowercase">{bloqueDestinatarios}</div> : null}
        </div>

        {/* ---------------- LA VISTA PREVIA ---------------- */}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-sans">
          <Segmented
            ariaLabel="Qué ver"
            value={vista}
            options={[
              { key: "resumen", label: "Resumen · 3 diapositivas" },
              { key: "completo", label: "Informe completo" },
            ]}
            onChange={(v) => setVista(v as "resumen" | "completo")}
          />

          <Button icon={cargando ? Loader2 : RefreshCw} disabled={cargando}
            onClick={() => {
              /* Un ABP que falló se vuelve a pedir; uno que llegó, se queda. */
              setAbp((actual) => (actual?.ok ? actual : null));
              setTestigo((n) => n + 1);
            }}
            title="Volver a leer todo">
            {cargando ? "Leyendo…" : "Releer"}
          </Button>

          {/* El estado del balón parado, que llega aparte: discreto, y acaba o dice por qué no. */}
          {informe && !cargando ? (
            <span className="min-w-0 text-[11px] text-white/50" role="status" aria-live="polite">
              {abpCargando ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <Loader2 size={11} className="shrink-0 animate-spin" /> Preparando el informe de ABP del microciclo…
                  {/*
                  | NO ESPERAR (12/11/2026, fútbol y análisis): el envío se quedaba
                  | hasta dos minutos en «Preparando ABP…». Con esto, sale ya con lo
                  | que hay del plan de ABP; «Reintentar» lo vuelve a pedir.
                  */}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => setAbp({ ok: false, clave: abpClave, error: "se ha seguido sin esperarlo" })}
                    title="Mandar o descargar ya, sin el informe de balón parado de la semana"
                  >
                    Seguir sin él
                  </button>
                </span>
              ) : abpActual?.ok ? (
                <span className="inline-flex items-center gap-1.5" title="Va su resumen en las diapositivas y el informe entero en el completo">
                  <Check size={11} className="shrink-0 text-emerald-300" /> Balón parado listo
                  {abpActual.imagenes.length ? ` (${abpActual.imagenes.length} gráficos y láminas)` : ""}
                </span>
              ) : abpActual ? (
                <span className="text-amber-200/80">
                  Balón parado: no ha llegado ({abpActual.error}). Sale con lo que hay del plan de ABP.{" "}
                  {/* Se olvida el fallo antes de recargar: con la misma clave,
                      seguía valiendo y la pantalla de ABP no se volvía a montar,
                      así que «Reintentar» no hacía nada (19/10/2026). */}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => {
                      setAbp(null);
                      setTestigo((n) => n + 1);
                    }}
                  >
                    Reintentar
                  </button>
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        <div ref={caja} className="min-w-0">
          {!informeVisto || cargando ? (
            <p className="flex items-center gap-2 py-10 font-sans text-sm text-white/45">
              <Loader2 size={14} className="animate-spin" /> Juntando el microciclo, Data, el rival y el plan…
            </p>
          ) : vista === "resumen" ? (
            anchoVista > 0 && (
              <div className="space-y-3">
                {/* Cada lámina con «Ver en grande» (07/11/2026, ronda 14): en el móvil no se leía a 390 px. */}
                {[Uno, Dos, Tres].map((Diapo, i) =>
                  diapoMarcada(i) ? (
                    <div key={i} className="space-y-2">
                    <VerEnGrande
                      ancho={DIAPO_W}
                      alto={DIAPO_H}
                      titulo={`${i + 1}/3 · ${rotuloDiapo(i)}`}
                      className={barlowCondensed.className}
                      style={{ ["--fuente-informe" as string]: barlowCondensed.style.fontFamily }}
                      preview={
                        <Escalada ancho={anchoVista}>
                          <Diapo inf={informeVisto} />
                        </Escalada>
                      }
                    >
                      <Diapo inf={informeVisto} />
                    </VerEnGrande>
                    {/* En el móvil, lo que dice la lámina en texto (11/11/2026, fútbol y marketing): la miniatura no se lee a 390 px. */}
                    {esMovil ? (
                      <ul className="space-y-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-sans text-[13px] leading-snug text-white/80">
                        {textoDeDiapo(informeVisto, i).map((linea, k) => (
                          <li key={`${k}${linea}`} className={k === 0 ? "font-semibold text-white" : ""}>
                            {linea}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    </div>
                  ) : null,
                )}
              </div>
            )
          ) : (
            <div className="relative">
              {/* «Ver en grande» (07/11/2026, ronda 14): el correo en una pestaña, donde el móvil deja ampliarlo. Colores fijos: va sobre la cabecera azul del correo. */}
              <button
                type="button"
                onClick={() => {
                  const url = URL.createObjectURL(new Blob([htmlVista], { type: "text/html;charset=utf-8" }));

                  if (!window.open(url, "_blank")) toast.message("El navegador no ha dejado abrir la pestaña", { description: "Permite las ventanas emergentes de esta web y vuelve a probar." });

                  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
                }}
                className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-lg"
                style={{ background: "rgba(8,17,31,0.78)", color: "#F4EBDD", border: "1px solid rgba(200,169,107,0.55)" }}
                title="Abrir el informe completo en una pestaña"
              >
                <Maximize2 size={12} /> Ver en grande
              </button>
              <iframe title="Informe completo" srcDoc={htmlVista} className="h-[70vh] w-full rounded-xl border border-white/10 bg-white" />
            </div>
          )}
        </div>

        {informe && (
          <p className="font-sans text-[11px] text-white/35">
            <Download size={11} className="mr-1 inline" />
            La vista es tal y como llega cada correo: el resumen con las diapositivas marcadas y el completo con los capítulos elegidos y el mensaje.
          </p>
        )}

        {esMovil ? <div className="min-w-0 [&_span.rounded-md]:lowercase">{bloqueDestinatarios}</div> : null}

        {/* ---------------- QUÉ SE MANDA (plegado) ---------------- */}

        {informe && !cargando && (
          <div className="space-y-2">
            {/* EL RESUMEN */}
            <Plegable
              titulo="Correo 1 · Resumen"
              resumen={resumenCorreo1}
              destacado={envio.resumen.activo}
              control={<input type="checkbox" aria-label="Mandar el correo 1, el resumen" className="accent-[#C8A96B]" checked={envio.resumen.activo} onChange={(e) => cambia("resumen", { activo: e.target.checked })} />}
            >
              <p className="text-white/35">Las diapositivas dentro del correo, para leer en el móvil.</p>

              {envio.resumen.activo ? (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className={rotuloCaja}>Asunto</span>
                    <input className={campo} value={asuntoResumen} onChange={(e) => cambia("resumen", { asunto: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className={rotuloCaja}>Mensaje (opcional)</span>
                    <textarea
                      className={`${campo} min-h-[64px] resize-y`}
                      value={envio.resumen.mensaje}
                      onChange={(e) => cambia("resumen", { mensaje: e.target.value })}
                      placeholder="Unas líneas para quien lo recibe: lo que queremos que se quede de este partido."
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <span className={rotuloCaja}>Diapositivas</span>
                      {TODAS_DIAPOS.map((i) =>
                        casilla(diapoMarcada(i), (v) => cambia("resumen", { diapos: TODAS_DIAPOS.map((k) => (k === i ? v : diapoMarcada(k))) }), `${i + 1} · ${rotuloDiapo(i)}`),
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <span className={rotuloCaja}>Adjuntos</span>
                      {casilla(envio.resumen.pdf, (v) => cambia("resumen", { pdf: v }), "PDF de las diapositivas", "adjunto; acaba en «Vídeo y documentos» con los enlaces")}
                      {casilla(envio.resumen.ppt, (v) => cambia("resumen", { ppt: v }), "PowerPoint", "como enlace, para proyectarlo en la charla")}
                      {casilla(envio.resumen.video, (v) => cambia("resumen", { video: v }), "Vídeo del informe (de 1 a 2:30 min)", puedeMontarVideo() ? "lo mismo que el PDF, con cortes del partido, repeticiones, datos y música" : "este navegador no puede montarlo", !puedeMontarVideo())}
                    </div>
                  </div>
                  <label className="block">
                    <span className={rotuloCaja}>Sólo para el resumen (si va a otras personas)</span>
                    <input
                      className={campo}
                      value={ajustes.paraResumen ?? ""}
                      onChange={(e) => setAjustes((a) => ({ ...a, paraResumen: e.target.value }))}
                      placeholder="vacío = los de arriba"
                    />
                  </label>
                </div>
              ) : null}

              {/*
                Lo que recibirá cada persona, antes de mandarlo (23/10/2026,
                marketing): antes el diálogo explicaba el mecanismo en tres
                líneas y no enseñaba el mensaje. Los enlaces se ponen al enviar.
              */}
              {/* Los mensajes ya con enlaces salen en el panel de los informes al terminar el envío (02/11/2026). */}
              {canal === "whatsapp" && informeVisto ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Así le llega a cada uno</span>
                  <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-white/80">
                    {mensajeWhatsapp({
                      asunto: whatsappInforme(informeVisto).titular,
                      lineas: whatsappInforme(informeVisto).lineas,
                      mensaje: envio.resumen.mensaje,
                      firma: (ajustes.firma ?? "").trim() || undefined,
                      video: null,
                      enlaces: [{ nombre: "Informe (PDF)", url: "enlace al enviar" }],
                    })}
                  </pre>
                </div>
              ) : null}
            </Plegable>

            {/* EL COMPLETO */}
            <Plegable
              titulo="Correo 2 · Informe completo"
              resumen={resumenCorreo2}
              destacado={envio.completo.activo}
              control={<input type="checkbox" aria-label="Mandar el correo 2, el informe completo" className="accent-[#C8A96B]" checked={envio.completo.activo} onChange={(e) => cambia("completo", { activo: e.target.checked })} />}
            >
              <p className="text-white/35">El documento de consulta, con sus adjuntos.</p>

              {envio.completo.activo ? (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className={rotuloCaja}>Asunto</span>
                    <input className={campo} value={asuntoCompleto} onChange={(e) => cambia("completo", { asunto: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className={rotuloCaja}>Mensaje (opcional)</span>
                    <textarea
                      className={`${campo} min-h-[64px] resize-y`}
                      value={envio.completo.mensaje}
                      onChange={(e) => cambia("completo", { mensaje: e.target.value })}
                      placeholder="Qué mirar primero, qué hay que cerrar en la reunión…"
                    />
                  </label>

                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span className={rotuloCaja}>Capítulos ({capitulos.filter((x) => marcadoCapitulo(x.id)).length} de {capitulos.length})</span>
                      <span className="flex gap-2 text-[10px] text-white/40">
                        <button type="button" className="underline-offset-2 hover:underline" onClick={() => cambia("completo", { capitulos: null })}>
                          todos
                        </button>
                        <button type="button" className="underline-offset-2 hover:underline" onClick={() => cambia("completo", { capitulos: capitulos.filter((x) => x.id === "esencial").map((x) => x.id) })}>
                          sólo lo esencial
                        </button>
                      </span>
                    </div>
                    <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      {capitulos.map((x) => (
                        <div key={x.id}>{casilla(marcadoCapitulo(x.id), (v) => cambiaCapitulo(x.id, v), x.titulo)}</div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-2">
                      <span className={rotuloCaja}>Adjuntos</span>
                      <span className="text-[10px] text-white/30">hasta {mb(TOPE_ADJUNTOS)} adjunto; lo demás va como botón de descarga</span>
                    </div>
                    {casilla(envio.completo.pdfCompleto, (v) => cambia("completo", { pdfCompleto: v }), "El informe completo, en el PDF", "un solo PDF adjunto: resumen, completo y la página de enlaces")}
                    {casilla(envio.completo.video, (v) => cambia("completo", { video: v }), "Vídeo del informe (de 1 a 2:30 min)", puedeMontarVideo() ? "el mismo que va en el resumen" : "este navegador no puede montarlo", !puedeMontarVideo())}
                    {casilla(envio.completo.pdfResumen, (v) => cambia("completo", { pdfResumen: v }), "Las diapositivas del resumen, al principio del PDF")}
                    {casilla(envio.completo.pptResumen, (v) => cambia("completo", { pptResumen: v }), "El resumen en PowerPoint", "como enlace desde el PDF")}

                    {faltanDocs && !docsActual && !docsCargando
                      ? casilla(
                          envio.completo.sacarDocs,
                          (v) => cambia("completo", { sacarDocs: v }),
                          "Sacar el PDF de la plantilla y el PPT del rival al enviar",
                          `${generados.length ? "Los que hay son de antes de esta semana" : "No se han sacado todavía"}: se hacen en otra pestaña (≈40 s) mientras sale el resumen.`,
                        )
                      : null}

                    {docsCargando ? (
                      <p className="inline-flex items-center gap-2 text-white/60">
                        <Loader2 size={12} className="animate-spin" /> Sacando el PDF de la plantilla y el PPT del rival en otra pestaña…
                      </p>
                    ) : docsActual && !docsActual.ok ? (
                      <p className="text-amber-200/80">
                        No se han podido sacar solos ({docsActual.error}).{" "}
                        <button className="underline underline-offset-2" onClick={abreDocs}>
                          Reintentar
                        </button>
                      </p>
                    ) : null}

                    {documentos.map((d) =>
                      d.adjuntable ? (
                        <div key={d.url}>
                          {casilla(
                            !quitados.has(d.url),
                            (v) =>
                              setQuitados((s) => {
                                const n = new Set(s);

                                if (v) n.delete(d.url);
                                else n.add(d.url);

                                return n;
                              }),
                            d.nombre,
                            `${mb(d.tamano)}${d.origen === "subido" ? " · subido ahora" : " · del rival"}`,
                          )}
                        </div>
                      ) : (
                        <p key={d.url} className="flex min-w-0 items-center gap-2 text-white/50">
                          <ExternalLink size={12} className="shrink-0 text-white/35" /> <span className="min-w-0 truncate">{d.nombre}</span> <span className="shrink-0 text-white/30">va como enlace</span>
                        </p>
                      ),
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        ref={elegirArchivo}
                        type="file"
                        accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void sube(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <Button icon={subiendo ? Loader2 : Upload} disabled={Boolean(subiendo)} onClick={() => elegirArchivo.current?.click()}>
                        {subiendo ? `Subiendo ${Math.round(subiendo.fraccion * 100)} %` : "Añadir PDF o PPT"}
                      </Button>
                      <Button icon={docsCargando ? Loader2 : Paperclip} disabled={docsCargando || !equipoDocs} onClick={abreDocs} title="Abre Plantillas rivales en otra pestaña, saca el PDF de la plantilla y el PPT del rival con lo último y se cierra sola">
                        Volver a sacar PDF y PPT del rival
                      </Button>
                    </div>
                  </div>

                  <label className="block">
                    <span className={rotuloCaja}>Sólo para el completo (si va a otras personas)</span>
                    <input
                      className={campo}
                      value={ajustes.paraCompleto ?? ""}
                      onChange={(e) => setAjustes((a) => ({ ...a, paraCompleto: e.target.value }))}
                      placeholder="vacío = los de arriba"
                    />
                  </label>
                </div>
              ) : null}
            </Plegable>
          </div>
        )}

        {/*
        | ANTES DE ENVIAR (11/11/2026, marketing): la firma, los vídeos y los avisos
        | eran tres plegables sueltos al final; ahora un bloque con su rótulo, lo
        | último que se repasa antes de pulsar «Enviar».
        */}
        <section className="space-y-2" aria-label="Antes de enviar">
          <span className={rotuloCaja}>Antes de enviar</span>
          {/* LA FIRMA */}
          <Plegable titulo="Firma" resumen={(ajustes.firma ?? "").trim() ? `«${(ajustes.firma ?? "").trim()}» · va bajo el mensaje, si escribes uno` : "Sin firma · va bajo el mensaje, si escribes uno"}>
            <label className="block max-w-sm">
              <span className={rotuloCaja}>Firma</span>
              <input className={campo} value={ajustes.firma ?? ""} onChange={(e) => setAjustes((a) => ({ ...a, firma: e.target.value }))} placeholder="Cuerpo técnico" />
              <span className="mt-1 block text-[10px] text-white/30">Va bajo el mensaje, si escribes uno.</span>
            </label>
          </Plegable>

          {/* Si no hay ni piezas ni vídeo de balón parado, VideosDeLaSemana no pinta nada: tampoco su plegable. */}
          {informeVisto && !cargando && (cuantasPiezas > 0 || videoAbp) ? (
            <Plegable
              titulo="Vídeos de la semana"
              resumen={[
                cuantasPiezas ? (cuantasPiezas === 1 ? "1 pieza para montar" : `${cuantasPiezas} piezas para montar`) : "",
                videoAbp ? "con el vídeo de balón parado de la jornada" : "",
                "se descargan, no se envían",
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              <VideosDeLaSemana abp={videoAbp} piezas={piezasDeVideo} momento={informeVisto.momento} ocupado={Boolean(trabajando) || Boolean(preparando)} />
            </Plegable>
          ) : null}

          {informeVisto && informeVisto.avisos.length > 0 && (
            /* Plegado y al final (20/10/2026 y 06/11/2026): no se mezcla con lo que se lee. */
            <Plegable
              aviso
              titulo={informeVisto.avisos.length === 1 ? "1 aviso para el analista" : `${informeVisto.avisos.length} avisos para el analista`}
              resumen="No van en el correo; se recuerdan al enviar"
            >
              <Notice tone="warn" title="Lo que este informe no sabe">
                <ul className="ml-4 list-disc space-y-1">
                  {informeVisto.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </Notice>
            </Plegable>
          )}
        </section>
      </div>

      {avisando && informeVisto && (
        <AvisoAntesDeMandar
          avisos={informeVisto.avisos}
          onRevisar={() => setAvisando(false)}
          onMandar={() => {
            setAvisando(false);
            void envia();
          }}
        />
      )}

      {/* La pantalla de ABP, oculta y en sólo lectura, hasta que devuelve su informe. */}
      {abpCargando && temporadaAbp && microAbp && (
        <iframe
          key={`${abpClave}|${testigo}`}
          title="Informe de balón parado"
          aria-hidden
          tabIndex={-1}
          src={`/abp-microciclo?incrustado=${encodeURIComponent(`${temporadaAbp}|${microAbp}`)}&modo=${informe?.momento ?? "previa"}`}
          style={{ position: "fixed", left: -30000, top: 0, width: 1280, height: 900, border: 0, visibility: "hidden" }}
        />
      )}

      {/* Las diapositivas a su tamaño, fuera de pantalla, para capturarlas (siempre montadas: se preparan solas). */}
      {informeVisto && !cargando && (
        <div
          ref={lienzos}
          aria-hidden
          style={{ position: "fixed", left: -30000, top: 0, width: DIAPO_W, pointerEvents: "none" }}
        >
          <LaminasDiapositivas inf={informeVisto} />
        </div>
      )}
    </Dialog>
  );
}
