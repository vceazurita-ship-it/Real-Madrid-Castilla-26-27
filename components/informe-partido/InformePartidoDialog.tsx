"use client";

/**
 * EL INFORME DEL PARTIDO: VERLO, BAJARLO Y MANDARLO (03/10/2026).
 *
 * Se abre desde Microciclos. Elige el microciclo (por defecto el que se esté
 * mirando) y si es la previa o el post (por defecto lo dice el calendario).
 * Enseña el resumen —dos diapositivas— y el informe extenso tal y como van a
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
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpen, Check, Download, ExternalLink, FileText, Loader2, Paperclip, Presentation, RefreshCw, Send, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog, Notice, Segmented, TextArea } from "@/components/abp/ui";
import { DIAPO_H, DIAPO_W, DIAPOSITIVAS, Escalada } from "@/components/informe-partido/Diapositivas";
import { AvisoAntesDeMandar } from "@/components/correo/AvisoAntesDeMandar";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import { cargaInforme, microsDisponibles, type MicroDisponible } from "@/lib/informe-partido/carga";
import { completoEnPdf } from "@/lib/informe-partido/pdf-completo";
import { ROTULO_DOCUMENTO, type TipoDocumentoRival } from "@/lib/rivals/documentos";
import { capitulosDe, informeHtml, informeTexto, resumenHtml, type Descarga, type ExtrasInforme } from "@/lib/informe-partido/html";
import type { InformePartido, Momento, PinceladaAbp } from "@/lib/informe-partido/modelo";
import { capturaLienzos, descarga, pintado, pdfDeLienzos } from "@/lib/export/lienzos";
import { creaPptx } from "@/lib/export/pptx";
import { barlowCondensed } from "@/lib/rivals/portada-font";

type AjustesCorreo = {
  destinatarios: string;
  /** Va bajo el mensaje de cada correo. */
  firma?: string;
  /** Si el resumen o el completo van a otras personas que los de arriba. */
  paraResumen?: string;
  paraCompleto?: string;
  /** Los interruptores de adjuntos, recordados de una vez para otra. */
  preferencias?: { resumenPdf?: boolean; resumenPpt?: boolean; completoPdf?: boolean; completoResumenPdf?: boolean; completoResumenPpt?: boolean };
};

/** Qué lleva cada correo. `asunto` a `null` = el de siempre; `capitulos` a `null` = todos. */
type OpcionesEnvio = {
  resumen: { activo: boolean; asunto: string | null; mensaje: string; diapos: boolean[]; pdf: boolean; ppt: boolean };
  completo: { activo: boolean; asunto: string | null; mensaje: string; capitulos: string[] | null; pdfCompleto: boolean; pdfResumen: boolean; pptResumen: boolean; sacarDocs: boolean };
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
| de 25 MB: con 16 MB de adjuntos el correo entero queda en ~24 MB. Lo que no
| cabe no se pierde: va como botón de descarga en el propio correo.
*/
const TOPE_ADJUNTOS = 16 * 1024 * 1024;

/* Si un documento del rival no dice cuánto pesa, se cuenta como si pesara esto. */
const PESO_DESCONOCIDO = 6 * 1024 * 1024;

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

const base64De = (blob: Blob) =>
  new Promise<string>((resuelve, falla) => {
    const lector = new FileReader();

    lector.onload = () => resuelve(String(lector.result).replace(/^data:[^;]+;base64,/, ""));
    lector.onerror = () => falla(lector.error);

    lector.readAsDataURL(blob);
  });

const mb = (bytes: number | null) => (bytes === null ? "" : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

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

  const [elegido, setElegido] = useState<{ temporada: string; micro: number } | null>(temporada && micro ? { temporada, micro } : null);

  /* `null` = lo que diga el calendario. */
  const [momentoPedido, setMomentoPedido] = useState<Momento | null>(null);

  const [informe, setInforme] = useState<InformePartido | null>(null);

  const [testigo, setTestigo] = useState(0);

  const [vista, setVista] = useState<"resumen" | "completo">("resumen");

  const [trabajando, setTrabajando] = useState<null | string>(null);

  const lienzos = useRef<HTMLDivElement | null>(null);

  const { value: ajustes, setValue: setAjustes } = useRemoteDoc<AjustesCorreo>({
    key: "partido:informe-correo",
    kind: "informe-partido",
    fallback: { destinatarios: "" },
  });

  /* Qué correos salen y qué lleva cada uno. Los dos por defecto: es para lo que existe el botón. */
  const [envio, setEnvio] = useState<OpcionesEnvio>(() => ({
    resumen: { activo: true, asunto: null, mensaje: "", diapos: [true, true], pdf: true, ppt: false },
    completo: { activo: true, asunto: null, mensaje: "", capitulos: null, pdfCompleto: true, pdfResumen: false, pptResumen: false, sacarDocs: true },
  }));

  /* Lo recordado, en cuanto llega de la nube (una vez). */
  const preferenciasPuestas = useRef(false);

  useEffect(() => {
    const pr = ajustes.preferencias;

    if (preferenciasPuestas.current || !pr) return;

    preferenciasPuestas.current = true;

    setEnvio((e) => ({
      resumen: { ...e.resumen, pdf: pr.resumenPdf ?? e.resumen.pdf, ppt: pr.resumenPpt ?? e.resumen.ppt },
      completo: {
        ...e.completo,
        pdfCompleto: pr.completoPdf ?? e.completo.pdfCompleto,
        pdfResumen: pr.completoResumenPdf ?? e.completo.pdfResumen,
        pptResumen: pr.completoResumenPpt ?? e.completo.pptResumen,
      },
    }));
  }, [ajustes.preferencias]);

  /* Los microciclos de la hoja. */
  useEffect(() => {
    let cancelado = false;

    microsDisponibles()
      .then((lista) => {
        if (cancelado) return;

        setMicros(lista);

        setElegido((actual) => actual ?? (lista[0] ? { temporada: lista[0].temporada, micro: lista[0].micro } : null));
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

  useEffect(() => {
    if (!elegido) return;

    let cancelado = false;

    cargaInforme({ ...elegido, momento: momentoPedido ?? undefined })
      .then((inf) => {
        if (!cancelado) setInforme(inf);
      })
      .catch((error) => {
        if (!cancelado) toast.error("No se ha podido armar el informe", { description: error instanceof Error ? error.message : "" });
      })
      .finally(() => {
        if (!cancelado) setLlegado(`${elegido.temporada}|${elegido.micro}|${momentoPedido ?? ""}|${testigo}`);
      });

    return () => {
      cancelado = true;
    };
  }, [elegido, momentoPedido, testigo]);

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

  const [, temporadaAbp, microAbp] = abpClave.match(/^(.*)\|(\d+)\|/) ?? [];

  /* Lo que se pinta: el informe con la pincelada de ABP dentro. */
  const informeVisto = useMemo<InformePartido | null>(() => {
    if (!informe) return null;

    if (!abpActual?.ok) return informe;

    return {
      ...informe,
      abp: { ...(informe.abp ?? { minutosSemana: 0, laminasRival: 0, documentosRival: [] }), pincelada: abpActual.pincelada },
      avisos: [...informe.avisos, ...abpActual.avisos.map((a) => `ABP: ${a}`)],
    };
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

    return !g || (inicioSemana !== "" && g.creado.slice(0, 10) < inicioSemana);
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
      capitulos: envio.completo.capitulos ?? undefined,
      mensaje: envio.completo.mensaje,
      firma: (ajustes.firma ?? "").trim() || undefined,
    });
  }, [informeVisto, abpCuerpo, listaVista, envio.completo.capitulos, envio.completo.mensaje, ajustes.firma]);

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

  const asuntoResumen = envio.resumen.asunto ?? `${cabeceraAsunto} · Resumen`;

  const asuntoCompleto = envio.completo.asunto ?? `${cabeceraAsunto} · Informe completo`;

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

  const cache = useRef<{ diapos?: { clave: string; imagenes: Promise<string[]> }; completo?: { clave: string; pdf: Promise<Blob> } }>({});

  const [preparado, setPreparado] = useState<{ diapos: string; completo: string }>({ diapos: "", completo: "" });

  const [preparando, setPreparando] = useState<string | null>(null);

  /** Las dos diapositivas en JPEG, dibujadas fuera de pantalla a su tamaño real. */
  const dameDiapos = () => {
    const clave = claveDiapos;

    if (cache.current.diapos?.clave === clave) return cache.current.diapos.imagenes;

    const imagenes = (async () => {
      await document.fonts?.ready;
      await pintado();
      await pintado();

      const raiz = lienzos.current;

      if (!raiz) throw new Error("No se han podido montar las diapositivas.");

      return capturaLienzos(raiz, "[data-diapositiva-partido]", { ancho: DIAPO_W, alto: DIAPO_H, fondo: "#08111F", nitidez: 1 });
    })();

    cache.current.diapos = { clave, imagenes };

    imagenes.then(
      () => setPreparado((x) => ({ ...x, diapos: clave })),
      () => {
        if (cache.current.diapos?.clave === clave) cache.current.diapos = undefined;
      },
    );

    return imagenes;
  };

  /** El completo en PDF: entero (con los capítulos elegidos), sin la lista de adjuntos ni el mensaje, que son del correo. */
  const damePdfCompleto = (alPaso?: (h: number, t: number) => void) => {
    const clave = claveCompleto;

    if (cache.current.completo?.clave === clave) return cache.current.completo.pdf;

    const pdf = completoEnPdf(sinCid(informeHtml(informeVisto!, { abpCuerpo, capitulos: capitulosElegidos ?? undefined })), alPaso, { titulo: tituloPdf });

    cache.current.completo = { clave, pdf };

    pdf.then(
      () => setPreparado((x) => ({ ...x, completo: clave })),
      () => {
        if (cache.current.completo?.clave === clave) cache.current.completo = undefined;
      },
    );

    return pdf;
  };

  /* En cuanto hay informe (y ABP), se prepara todo sin que nadie lo pida. */
  useEffect(() => {
    if (!claveDiapos || abpCargando || trabajando) return;

    if (preparado.diapos === claveDiapos && preparado.completo === claveCompleto) return;

    let vivo = true;

    const t = window.setTimeout(async () => {
      try {
        if (preparado.diapos !== claveDiapos) {
          setPreparando("Preparando las diapositivas…");

          await dameDiapos();
        }

        if (!vivo) return;

        setPreparando("Preparando el PDF del completo…");

        await damePdfCompleto((h, total) => vivo && setPreparando(`Preparando el PDF del completo · ${h} de ${total}…`));
      } catch {
        /* Al enviar se vuelve a intentar y, si falla, lo dice. */
      } finally {
        if (vivo) setPreparando(null);
      }
    }, 1500);

    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDiapos, claveCompleto, abpCargando, trabajando]);

  const listoTodo = Boolean(claveDiapos) && preparado.diapos === claveDiapos && preparado.completo === claveCompleto;

  /* ---------------- PDF y PPT del resumen ---------------- */

  /* Las diapositivas que van: la 1, la 2 o las dos. */
  const indicesDiapos = [0, 1].filter((i) => envio.resumen.diapos[i]);

  const rotuloDiapo = (i: number) => (i === 0 ? (esPost ? "El resultado" : "El partido") : esPost ? "Lo que nos deja" : "El plan");

  const pdfDe = async (imagenes: string[]) =>
    (await pdfDeLienzos(imagenes, { ancho: DIAPO_W, alto: DIAPO_H, orientacion: "landscape", margen: 0 })).output("blob") as Blob;

  const pptDe = (imagenes: string[], indices: number[]) =>
    creaPptx(
      imagenes.map((imagen, k) => ({ titulo: rotuloDiapo(indices[k] ?? k), imagen })),
      { titulo: `${esPost ? "Post" : "Previa"} · ${p?.rival ?? ""}`, aplicacion: "Informe del partido" },
    );

  const elegidas = async () => {
    const todas = await dameDiapos();

    const indices = indicesDiapos.length ? indicesDiapos : [0, 1];

    return { imagenes: indices.map((i) => todas[i]).filter(Boolean), indices };
  };

  const bajaPdf = async () => {
    try {
      setTrabajando("Preparando el PDF…");

      const { imagenes } = await elegidas();

      descarga(await pdfDe(imagenes), nombreDeArchivo(`${nombreLegible} - Resumen`, "pdf"));
    } catch (error) {
      toast.error("No se ha podido exportar", { description: error instanceof Error ? error.message : "" });
    } finally {
      setTrabajando(null);
    }
  };

  const bajaPptx = async () => {
    try {
      setTrabajando("Preparando el PowerPoint…");

      const { imagenes, indices } = await elegidas();

      descarga(pptDe(imagenes, indices), nombreDeArchivo(`${nombreLegible} - Resumen`, "pptx"));
    } catch (error) {
      toast.error("No se ha podido exportar", { description: error instanceof Error ? error.message : "" });
    } finally {
      setTrabajando(null);
    }
  };

  const bajaCompleto = async () => {
    try {
      setTrabajando("Preparando el PDF del completo…");

      descarga(await damePdfCompleto((h, t) => setTrabajando(`PDF del completo · hoja ${h} de ${t}…`)), nombreDeArchivo(`${nombreLegible} - Informe completo`, "pdf"));
    } catch (error) {
      toast.error("No se ha podido exportar el completo", { description: error instanceof Error ? error.message : "" });
    } finally {
      setTrabajando(null);
    }
  };

  /* ---------------- mandar ---------------- */

  const manda = async (cuerpo: Record<string, unknown>) => {
    const r = await fetch("/api/informe/correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (!r.ok || !j?.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
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

  const pinta = (que: "resumen" | "completo", texto: string) => {
    pasos.current[que] = texto;

    setTrabajando(
      [pasos.current.resumen && `Resumen: ${pasos.current.resumen}`, pasos.current.completo && `Completo: ${pasos.current.completo}`].filter(Boolean).join(" · "),
    );
  };

  /* Lo que el informe no sabe: se enseña al pulsar «Enviar», no en el correo. */
  const [avisando, setAvisando] = useState(false);

  const pulsaEnviar = () => {
    if (informeVisto?.avisos.length) setAvisando(true);
    else void envia();
  };

  const envia = async () => {
    if (!informeVisto) return;

    const { resumen: r, completo: c } = envio;

    if (!r.activo && !c.activo) {
      toast.error("Marca qué quieres mandar: el resumen, el completo o los dos.");

      return;
    }

    /* Antes de dibujar nada: que haya a quién y bien escrito. */
    for (const [activo, texto, nombre] of [
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

    pasos.current = {};

    const firma = (ajustes.firma ?? "").trim() || undefined;

    /*
    | El PDF y el PPT del rival, si hay que sacarlos: se piden YA (dentro del
    | clic, o el navegador bloquea la pestaña) y se esperan sólo justo antes de
    | mandar el completo. El resumen no los espera.
    */
    const docsNuevosP: Promise<Documento[]> =
      c.activo && c.sacarDocs && faltanDocs && !docsActual?.ok
        ? new Promise<DocsLlegados>((resuelve) => {
            esperaDocs.current = resuelve;

            abreDocs();

            window.setTimeout(() => resuelve({ ok: false, clave: "", error: "Plantillas rivales no ha contestado a tiempo." }), ESPERA_DOCS);
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

    try {
      if (r.activo) pinta("resumen", "diapositivas…");
      if (c.activo) pinta("completo", listoTodo ? "listo para subir" : "preparando…");

      const { imagenes, indices } = await elegidas();

      const cids = indices.map((i) => `diapositiva-${i + 1}`);

      const diapositivasCid = imagenes.map((img, k) => ({ cid: cids[k], tipo: "image/jpeg", base64: img.replace(/^data:[^;]+;base64,/, "") }));

      const nombreResumenPdf = nombreDeArchivo(`${nombreLegible} - Resumen`, "pdf");

      const nombreResumenPpt = nombreDeArchivo(`${nombreLegible} - Resumen`, "pptx");

      const pdfResumenP = pdfDe(imagenes);

      /* ------------- el resumen ------------- */

      const correoResumen = async () => {
        const pdfResumen = await pdfResumenP;

        const ppt = r.ppt ? pptDe(imagenes, indices) : null;

        const adjuntos = [
          ...(r.pdf ? [{ nombre: nombreResumenPdf, tipo: "application/pdf", base64: await base64De(pdfResumen) }] : []),
          ...(ppt ? [{ nombre: nombreResumenPpt, tipo: PPTX, base64: await base64De(ppt) }] : []),
        ];

        pinta("resumen", "mandando…");

        await manda({
          para: paraResumen,
          asunto: asuntoResumen,
          html: resumenHtml(informeVisto, cids, {
            conCompleto: c.activo,
            mensaje: r.mensaje,
            firma,
            descargas: [
              ...(r.pdf ? [{ nombre: nombreResumenPdf, tamano: pdfResumen.size, adjunto: true }] : []),
              ...(ppt ? [{ nombre: nombreResumenPpt, tamano: ppt.size, adjunto: true }] : []),
            ],
          }),
          texto: `${r.mensaje?.trim() ? `${r.mensaje.trim()}${firma ? `\n— ${firma}` : ""}\n\n` : ""}${informeTexto(informeVisto)}`,
          imagenes: diapositivasCid,
          adjuntos,
        });

        pinta("resumen", "mandado ✓");
      };

      /* ------------- el completo ------------- */

      const correoCompleto = async () => {
        const propios: { nombre: string; blob: Promise<Blob> | Blob; tipo: string }[] = [
          ...(c.pdfCompleto ? [{ nombre: nombreDeArchivo(`${nombreLegible} - Informe completo`, "pdf"), blob: damePdfCompleto((h, t) => pinta("completo", `PDF ${h}/${t}…`)), tipo: "application/pdf" }] : []),
          ...(c.pdfResumen ? [{ nombre: nombreResumenPdf, blob: pdfResumenP, tipo: "application/pdf" }] : []),
          ...(c.pptResumen ? [{ nombre: nombreResumenPpt, blob: pptDe(imagenes, indices), tipo: PPTX }] : []),
        ];

        /* Todo a la vez: cada archivo, en cuanto está, sube; no uno detrás de otro. */
        let subidos = 0;

        pinta("completo", propios.length ? `subiendo 0/${propios.length}…` : "preparando…");

        const subidosAhora = await Promise.all(
          propios.map(async (archivo) => {
            const blob = await archivo.blob;

            const a = await subeAdjunto(new File([blob], archivo.nombre, { type: archivo.tipo }));

            subidos += 1;

            pinta("completo", `subiendo ${subidos}/${propios.length}…`);

            return { nombre: archivo.nombre, url: a.url, tipo: archivo.tipo, tamano: blob.size as number | null };
          }),
        );

        if (c.sacarDocs && faltanDocs && !docsActual?.ok) pinta("completo", "esperando el PDF y el PPT del rival…");

        const docsNuevos = await docsNuevosP;

        const sustituidos = new Set(docsNuevos.map((x) => x.generado));

        const adjuntosRival = [...docsNuevos, ...marcados.filter((x) => !x.generado || !sustituidos.has(x.generado))];

        /*
        | Qué va adjunto y qué sólo como enlace. Por orden de importancia —el
        | completo, el resumen, la plantilla y el informe del rival, lo demás, y
        | el PPT del resumen al final—, se adjunta mientras quepa. Todo lleva
        | además su botón de descarga: si el cliente no enseña un adjunto, el
        | enlace sigue valiendo (30 días).
        */
        const candidatos = [
          ...subidosAhora.filter((d) => d.tipo === "application/pdf"),
          ...adjuntosRival.map((d) => ({ nombre: nombreEnCorreo(d), url: d.url, tipo: d.tipo, tamano: d.tamano })),
          ...subidosAhora.filter((d) => d.tipo !== "application/pdf"),
        ];

        let ocupado = 0;

        const reparto = candidatos.map((d) => {
          const bytes = d.tamano ?? PESO_DESCONOCIDO;

          const cabe = ocupado + bytes <= TOPE_ADJUNTOS;

          if (cabe) ocupado += bytes;

          return { ...d, adjunto: cabe };
        });

        const descargas: Descarga[] = reparto.map((d) => ({ nombre: d.nombre, url: d.url, tamano: d.tamano, adjunto: d.adjunto }));

        /* La versión más completa que Gmail no recorte. */
        const base: ExtrasInforme = {
          abpCuerpo,
          diapositivas: cids,
          adjuntos: descargas,
          capitulos: capitulosElegidos ?? undefined,
          mensaje: c.mensaje,
          firma,
        };

        let ligero: 0 | 1 | 2 = 0;

        let html = informeHtml(informeVisto, base);

        while (bytesDe(html) > TOPE_HTML && ligero < 2) {
          ligero = (ligero + 1) as 1 | 2;

          html = informeHtml(informeVisto, { ...base, ligero });
        }

        pinta("completo", "mandando…");

        await manda({
          para: paraCompleto,
          asunto: asuntoCompleto,
          html,
          texto: `${c.mensaje?.trim() ? `${c.mensaje.trim()}${firma ? `\n— ${firma}` : ""}\n\n` : ""}${informeTexto(informeVisto)}${abpActual?.ok ? `\n\n— BALÓN PARADO —\n${abpActual.texto}` : ""}\n\n— DOCUMENTOS —\n${descargas.map((d) => `${d.nombre}: ${d.url}`).join("\n")}`,
          /* Con ABP resumido, sus gráficos no se llaman desde el cuerpo: si
             viajaran, saldrían como adjuntos sueltos sin nombre. */
          imagenes: [...diapositivasCid, ...(abpActual?.ok && ligero < 2 ? abpActual.imagenes : [])],
          adjuntosUrl: reparto.filter((d) => d.adjunto).map((d) => ({ nombre: d.nombre, url: d.url, tipo: d.tipo })),
        });

        pinta("completo", "mandado ✓");

        return reparto.filter((d) => !d.adjunto).length;
      };

      /* Los dos a la vez: el resumen no espera a que se suba el completo. */
      const [resResumen, resCompleto] = await Promise.allSettled([r.activo ? correoResumen() : Promise.resolve(), c.activo ? correoCompleto() : Promise.resolve(0)]);

      const fallos = [
        resResumen.status === "rejected" ? `Resumen: ${resResumen.reason instanceof Error ? resResumen.reason.message : resResumen.reason}` : "",
        resCompleto.status === "rejected" ? `Completo: ${resCompleto.reason instanceof Error ? resCompleto.reason.message : resCompleto.reason}` : "",
      ].filter(Boolean);

      const salieron = [r.activo && resResumen.status === "fulfilled" && "el resumen", c.activo && resCompleto.status === "fulfilled" && "el informe completo"].filter(Boolean);

      if (salieron.length) {
        toast.success(salieron.length === 2 ? "Mandados los dos correos" : `Mandado ${salieron[0]}`, {
          description: `${salieron.join(" y ")}${fallos.length ? `. No ha salido: ${fallos.join(" · ")}` : ""}.`,
        });
      }

      if (fallos.length && !salieron.length) toast.error("No se ha podido mandar", { description: fallos.join(" · ") });
      else if (fallos.length) toast.error("Uno de los dos no ha salido", { description: fallos.join(" · ") });

      const enlazados = resCompleto.status === "fulfilled" ? Number(resCompleto.value) || 0 : 0;

      if (enlazados) {
        toast.message(`${enlazados} ${enlazados === 1 ? "documento va" : "documentos van"} como enlace de descarga`, {
          description: `No cabían adjuntos (${mb(TOPE_ADJUNTOS)} por correo). En el correo tienen su botón «Descargar».`,
        });
      }
    } catch (error) {
      toast.error("No se ha podido mandar", { description: error instanceof Error ? error.message : "" });
    } finally {
      setTrabajando(null);
    }
  };

  /* Lo que se ve mientras carga es lo pedido, no lo que había. */
  const momento = momentoPedido ?? informe?.momento ?? "previa";

  const [Uno, Dos] = DIAPOSITIVAS[informeVisto?.momento ?? "previa"];

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
    const { resumen: r, completo: c } = envio;

    const preferencias = { resumenPdf: r.pdf, resumenPpt: r.ppt, completoPdf: c.pdfCompleto, completoResumenPdf: c.pdfResumen, completoResumenPpt: c.pptResumen };

    if (JSON.stringify(preferencias) !== JSON.stringify(ajustes.preferencias ?? {})) setAjustes({ ...ajustes, preferencias });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envio.resumen.pdf, envio.resumen.ppt, envio.completo.pdfCompleto, envio.completo.pdfResumen, envio.completo.pptResumen]);

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

  const botonEnviar = trabajando
    ? trabajando
    : esperaAbp
      ? "Preparando ABP…"
      : envio.resumen.activo && envio.completo.activo
        ? "Enviar los dos"
        : envio.resumen.activo
          ? "Enviar el resumen"
          : envio.completo.activo
            ? "Enviar el completo"
            : "Enviar";

  return (
    <Dialog
      title="Informe del partido"
      subtitle="Resumen en dos diapositivas e informe completo: la semana, los dos en datos, el rival, el pronóstico, el plan y el balón parado"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-white/45">
            {preparando ? (
              <>
                <Loader2 size={12} className="animate-spin" /> {preparando}
              </>
            ) : listoTodo ? (
              <>
                <Check size={12} className="text-emerald-300" /> Diapositivas y PDF preparados: enviar es inmediato
              </>
            ) : informe && !cargando ? (
              "Las diapositivas y el PDF se preparan solos mientras lo revisas"
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button icon={FileText} disabled={!informe || Boolean(trabajando)} onClick={() => void bajaPdf()} title="Las diapositivas elegidas, en PDF">
              Resumen PDF
            </Button>
            <Button icon={Presentation} disabled={!informe || Boolean(trabajando)} onClick={() => void bajaPptx()} title="Las diapositivas elegidas, en PowerPoint">
              Resumen PPT
            </Button>
            <Button icon={BookOpen} disabled={!informe || Boolean(trabajando) || abpCargando} onClick={() => void bajaCompleto()} title="El informe extenso en PDF, con los capítulos elegidos">
              Completo PDF
            </Button>
            <Button
              tone="primary"
              icon={trabajando || esperaAbp ? Loader2 : Send}
              disabled={!informe || Boolean(trabajando) || cargando || esperaAbp || Boolean(subiendo)}
              onClick={pulsaEnviar}
              title={esperaAbp ? "Esperando al informe de balón parado del microciclo" : undefined}
            >
              {botonEnviar}
            </Button>
          </div>
        </div>
      }
    >
      <div className={`space-y-4 ${barlowCondensed.className}`} style={{ ["--fuente-informe" as string]: barlowCondensed.style.fontFamily, fontFamily: "inherit" }}>
        <div className="flex flex-wrap items-end gap-3 font-sans">
          <label className="min-w-[220px]">
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
              {(micros ?? []).map((m) => (
                <option key={`${m.temporada}|${m.micro}`} value={`${m.temporada}|${m.micro}`} className="bg-[#11161C]">
                  Micro {m.micro} · {m.rival || "sin rival"}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className={rotuloCaja}>Momento</span>
            <Segmented
              ariaLabel="Previa o post"
              value={momento}
              options={[
                { key: "previa", label: "Previa del partido" },
                { key: "post", label: "Post partido" },
              ]}
              onChange={(m) => {
                setMomentoPedido(m as Momento);
                setEnvio((x) => textosLimpios(x));
              }}
            />
            <span className="mt-1 block text-[10px] text-white/35">
              {momentoPedido
                ? "Elegido a mano: la previa se puede sacar aunque ya se haya jugado"
                : informe?.partido.jugado
                  ? "Ya se jugó: sale el post (la previa sigue disponible)"
                  : "Aún no se ha jugado: sale la previa"}
            </span>
          </div>

          <div>
            <span className={rotuloCaja}>Ver</span>
            <Segmented
              ariaLabel="Qué ver"
              value={vista}
              options={[
                { key: "resumen", label: "Resumen · 2 diapositivas" },
                { key: "completo", label: "Informe completo" },
              ]}
              onChange={(v) => setVista(v as "resumen" | "completo")}
            />
          </div>

          <Button icon={cargando ? Loader2 : RefreshCw} disabled={cargando} onClick={() => setTestigo((n) => n + 1)} title="Volver a leer todo">
            {cargando ? "Leyendo…" : "Releer"}
          </Button>
        </div>

        {/* ---------------- A QUIÉN ---------------- */}

        <div className="grid gap-3 font-sans md:grid-cols-[1fr_220px]">
          <TextArea
            label="A quién se le manda (los dos correos)"
            value={ajustes.destinatarios}
            onChange={(destinatarios) => setAjustes({ ...ajustes, destinatarios })}
            placeholder="correo@ejemplo.com, otro@ejemplo.com"
            rows={2}
          />
          <label>
            <span className={rotuloCaja}>Firma</span>
            <input className={campo} value={ajustes.firma ?? ""} onChange={(e) => setAjustes({ ...ajustes, firma: e.target.value })} placeholder="Cuerpo técnico" />
            <span className="mt-1 block text-[10px] text-white/30">Va bajo el mensaje, si escribes uno.</span>
          </label>
        </div>

        {/* ---------------- QUÉ SE MANDA ---------------- */}

        {informe && !cargando && (
          <div className="grid gap-3 font-sans lg:grid-cols-2">
            {/* EL RESUMEN */}
            <div className={`rounded-xl border px-4 py-3 text-[12px] ${envio.resumen.activo ? "border-[#C8A96B]/30 bg-[#C8A96B]/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="accent-[#C8A96B]" checked={envio.resumen.activo} onChange={(e) => cambia("resumen", { activo: e.target.checked })} />
                <span className="text-[13px] font-semibold text-white/90">Correo 1 · Resumen</span>
                <span className="text-white/35">las diapositivas dentro del correo, para leer en el móvil</span>
              </label>

              {envio.resumen.activo && (
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
                      {[0, 1].map((i) =>
                        casilla(envio.resumen.diapos[i], (v) => cambia("resumen", { diapos: envio.resumen.diapos.map((x, k) => (k === i ? v : x)) }), `${i + 1} · ${rotuloDiapo(i)}`),
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <span className={rotuloCaja}>Adjuntos</span>
                      {casilla(envio.resumen.pdf, (v) => cambia("resumen", { pdf: v }), "PDF de las diapositivas", "para imprimir o reenviar")}
                      {casilla(envio.resumen.ppt, (v) => cambia("resumen", { ppt: v }), "PowerPoint", "para proyectarlo en la charla")}
                    </div>
                  </div>
                  <label className="block">
                    <span className={rotuloCaja}>Sólo para el resumen (si va a otras personas)</span>
                    <input
                      className={campo}
                      value={ajustes.paraResumen ?? ""}
                      onChange={(e) => setAjustes({ ...ajustes, paraResumen: e.target.value })}
                      placeholder="vacío = los de arriba"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* EL COMPLETO */}
            <div className={`rounded-xl border px-4 py-3 text-[12px] ${envio.completo.activo ? "border-[#C8A96B]/30 bg-[#C8A96B]/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="accent-[#C8A96B]" checked={envio.completo.activo} onChange={(e) => cambia("completo", { activo: e.target.checked })} />
                <span className="text-[13px] font-semibold text-white/90">Correo 2 · Informe completo</span>
                <span className="text-white/35">el documento de consulta, con sus adjuntos</span>
              </label>

              {envio.completo.activo && (
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
                    <div className="mb-1.5 flex items-center justify-between gap-2">
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
                    <div className="flex items-center justify-between gap-2">
                      <span className={rotuloCaja}>Adjuntos</span>
                      <span className="text-[10px] text-white/30">hasta {mb(TOPE_ADJUNTOS)} adjunto; lo demás va como botón de descarga</span>
                    </div>
                    {casilla(envio.completo.pdfCompleto, (v) => cambia("completo", { pdfCompleto: v }), "El informe completo en PDF", "para leerlo sin conexión o imprimirlo")}
                    {casilla(envio.completo.pdfResumen, (v) => cambia("completo", { pdfResumen: v }), "El resumen en PDF", envio.resumen.activo && envio.resumen.pdf ? "ya va en el correo del resumen" : undefined)}
                    {casilla(envio.completo.pptResumen, (v) => cambia("completo", { pptResumen: v }), "El resumen en PowerPoint")}

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
                        <p key={d.url} className="flex items-center gap-2 text-white/50">
                          <ExternalLink size={12} className="shrink-0 text-white/35" /> <span className="truncate">{d.nombre}</span> <span className="shrink-0 text-white/30">va como enlace</span>
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
                      onChange={(e) => setAjustes({ ...ajustes, paraCompleto: e.target.value })}
                      placeholder="vacío = los de arriba"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* El estado del balón parado, que llega aparte. */}
        {informe && !cargando && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 font-sans text-[12px] text-white/65">
            <span className="mr-2 text-[10px] uppercase tracking-[0.16em] text-white/40">Balón parado</span>
            {abpCargando ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Preparando el informe de ABP del microciclo…
              </span>
            ) : abpActual?.ok ? (
              <span>
                Listo: va su resumen en las diapositivas y el informe entero en el completo
                {abpActual.imagenes.length ? ` (${abpActual.imagenes.length} gráficos y láminas)` : ""}.
              </span>
            ) : abpActual ? (
              <span className="text-amber-200/80">
                No ha llegado ({abpActual.error}). El informe sale con lo que hay del plan de ABP.{" "}
                <button className="underline underline-offset-2" onClick={() => setTestigo((n) => n + 1)}>
                  Reintentar
                </button>
              </span>
            ) : null}
          </div>
        )}

        {informeVisto && informeVisto.avisos.length > 0 && (
          <div className="font-sans">
            <Notice tone="warn" title="Lo que este informe no sabe · no va en el correo: se avisa al enviar">
              <ul className="ml-4 list-disc space-y-1">
                {informeVisto.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Notice>
          </div>
        )}

        <div ref={caja} className="min-w-0">
          {!informeVisto || cargando ? (
            <p className="flex items-center gap-2 py-10 font-sans text-sm text-white/45">
              <Loader2 size={14} className="animate-spin" /> Juntando el microciclo, Data, el rival y el plan…
            </p>
          ) : vista === "resumen" ? (
            anchoVista > 0 && (
              <div className="space-y-3">
                {envio.resumen.diapos[0] && (
                  <Escalada ancho={anchoVista}>
                    <Uno inf={informeVisto} />
                  </Escalada>
                )}
                {envio.resumen.diapos[1] && (
                  <Escalada ancho={anchoVista}>
                    <Dos inf={informeVisto} />
                  </Escalada>
                )}
              </div>
            )
          ) : (
            <iframe title="Informe completo" srcDoc={htmlVista} className="h-[70vh] w-full rounded-xl border border-white/10 bg-white" />
          )}
        </div>

        {informe && (
          <p className="font-sans text-[11px] text-white/35">
            <Download size={11} className="mr-1 inline" />
            La vista es tal y como llega cada correo: el resumen con las diapositivas marcadas y el completo con los capítulos elegidos y el mensaje.
          </p>
        )}
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
          className={barlowCondensed.className}
          style={{ position: "fixed", left: -30000, top: 0, width: DIAPO_W, pointerEvents: "none", ["--fuente-informe" as string]: barlowCondensed.style.fontFamily }}
        >
          <Uno inf={informeVisto} />
          <Dos inf={informeVisto} />
        </div>
      )}
    </Dialog>
  );
}
