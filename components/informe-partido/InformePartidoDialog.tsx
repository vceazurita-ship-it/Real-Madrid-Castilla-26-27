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

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Download, ExternalLink, FileText, Loader2, Paperclip, Presentation, RefreshCw, Send, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog, Notice, Segmented, TextArea } from "@/components/abp/ui";
import { DIAPO_H, DIAPO_W, DIAPOSITIVAS, Escalada } from "@/components/informe-partido/Diapositivas";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import { cargaInforme, microsDisponibles, type MicroDisponible } from "@/lib/informe-partido/carga";
import { completoEnPdf } from "@/lib/informe-partido/pdf-completo";
import { ROTULO_DOCUMENTO, type TipoDocumentoRival } from "@/lib/rivals/documentos";
import { informeHtml, informeTexto, resumenHtml } from "@/lib/informe-partido/html";
import type { InformePartido, Momento, PinceladaAbp } from "@/lib/informe-partido/modelo";
import { apodo, capturaLienzos, descarga, pintado, pdfDeLienzos } from "@/lib/export/lienzos";
import { creaPptx } from "@/lib/export/pptx";
import { barlowCondensed } from "@/lib/rivals/portada-font";

type AjustesCorreo = { destinatarios: string };

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

/* El correo extenso lleva los adjuntos que se trae el servidor: Gmail admite
   ~35 MB por mensaje y la base64 suma un tercio. */
const TOPE_ADJUNTOS = 22 * 1024 * 1024;

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

  /* Qué correos salen. Los dos por defecto: es para lo que existe el botón. */
  const [que, setQue] = useState({ resumen: true, completo: true });

  const [trabajando, setTrabajando] = useState<null | string>(null);

  const lienzos = useRef<HTMLDivElement | null>(null);

  const { value: ajustes, setValue: setAjustes } = useRemoteDoc<AjustesCorreo>({
    key: "partido:informe-correo",
    kind: "informe-partido",
    fallback: { destinatarios: "" },
  });

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

  const pesoAdjuntos = marcados.reduce((s, d) => s + (d.tamano ?? 0), 0);

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

  /* La lista de adjuntos, como texto: cambia sólo si cambia lo marcado. */
  const nombresAdjuntos = marcados.map((d) => d.nombre).join("\n");

  const extras = useMemo(
    () => ({
      abpCuerpo: abpActual?.ok ? abpActual.cuerpo : undefined,
      adjuntos: nombresAdjuntos ? nombresAdjuntos.split("\n") : [],
    }),
    [abpActual, nombresAdjuntos],
  );

  const html = useMemo(() => (informeVisto ? informeHtml(informeVisto, extras) : ""), [informeVisto, extras]);

  /* En la vista previa las imágenes de ABP van dentro (en el correo, por cid). */
  const htmlVista = useMemo(() => {
    if (!abpActual?.ok) return html;

    const porCid = new Map(abpActual.imagenes.map((i) => [i.cid, `data:${i.tipo};base64,${i.base64}`]));

    return html.replace(/cid:([^"'\s)]+)/g, (todo, cid: string) => porCid.get(cid) ?? todo);
  }, [html, abpActual]);

  const [anchoVista, setAnchoVista] = useState(0);

  const caja = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nodo = caja.current;

    if (!nodo) return;

    const observa = new ResizeObserver(([e]) => setAnchoVista(Math.floor(e.contentRect.width)));

    observa.observe(nodo);

    return () => observa.disconnect();
  }, [informe, vista]);

  const nombreArchivo = informe
    ? `${informe.momento === "post" ? "post" : "previa"}-${apodo(informe.partido.rival, "rival")}${informe.partido.jornada ? `-j${informe.partido.jornada}` : ""}`
    : "informe";

  /** Las dos diapositivas en JPEG, dibujadas fuera de pantalla a su tamaño real. */
  const capturaDiapositivas = async () => {
    setTrabajando("Dibujando las diapositivas…");

    await document.fonts?.ready;
    await pintado();
    await pintado();

    const raiz = lienzos.current;

    if (!raiz) throw new Error("No se han podido montar las diapositivas.");

    return capturaLienzos(raiz, "[data-diapositiva-partido]", { ancho: DIAPO_W, alto: DIAPO_H, fondo: "#08111F", nitidez: 1 });
  };

  const pdfDe = async (imagenes: string[]) =>
    (await pdfDeLienzos(imagenes, { ancho: DIAPO_W, alto: DIAPO_H, orientacion: "landscape", margen: 0 })).output("blob") as Blob;

  const bajaPdf = async () => {
    try {
      const imagenes = await capturaDiapositivas();

      descarga(await pdfDe(imagenes), `${nombreArchivo}.pdf`);
    } catch (error) {
      toast.error("No se ha podido exportar", { description: error instanceof Error ? error.message : "" });
    } finally {
      setTrabajando(null);
    }
  };

  const bajaPptx = async () => {
    try {
      const imagenes = await capturaDiapositivas();

      descarga(pptDe(imagenes), `${nombreArchivo}.pptx`);
    } catch (error) {
      toast.error("No se ha podido exportar", { description: error instanceof Error ? error.message : "" });
    } finally {
      setTrabajando(null);
    }
  };

  const bajaCompleto = async () => {
    try {
      setTrabajando("Montando el PDF del completo…");

      descarga(await completoEnPdf(htmlVista, (h, t) => setTrabajando(`Montando el completo en PDF · hoja ${h} de ${t}…`)), `${nombreArchivo}-completo.pdf`);
    } catch (error) {
      toast.error("No se ha podido exportar el completo", { description: error instanceof Error ? error.message : "" });
    } finally {
      setTrabajando(null);
    }
  };

  const pptDe = (imagenes: string[]) =>
    creaPptx(
      imagenes.map((imagen, i) => ({ titulo: i === 0 ? (informe?.momento === "post" ? "El resultado" : "El partido") : informe?.momento === "post" ? "Lo que nos deja" : "El plan", imagen })),
      { titulo: `${informe?.momento === "post" ? "Post" : "Previa"} · ${informe?.partido.rival ?? ""}`, aplicacion: "Informe del partido" },
    );

  const manda = async (cuerpo: Record<string, unknown>) => {
    const r = await fetch("/api/informe/correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (!r.ok || !j?.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
  };

  const envia = async () => {
    if (!informeVisto) return;

    /* Antes de dibujar nada: dibujar y comprimir lleva unos segundos y no
       tiene sentido gastarlos para que el servidor diga que falta el correo. */
    const direcciones = ajustes.destinatarios.split(/[\s,;]+/).filter(Boolean);

    const malas = direcciones.filter((d) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d));

    if (!direcciones.length) {
      toast.error("Escribe al menos una dirección de correo.");

      return;
    }

    if (malas.length) {
      toast.error("Hay direcciones mal escritas", { description: malas.join(", ") });

      return;
    }

    if (!que.resumen && !que.completo) {
      toast.error("Marca qué quieres mandar: el resumen, el completo o los dos.");

      return;
    }

    if (que.completo && pesoAdjuntos > TOPE_ADJUNTOS) {
      toast.error("Los adjuntos pesan demasiado para un correo", { description: `${mb(pesoAdjuntos)} de ${mb(TOPE_ADJUNTOS)}: quita alguno.` });

      return;
    }

    const para = direcciones.join(", ");

    const p = informeVisto.partido;

    const etiqueta = informeVisto.momento === "post" ? "POST" : "PREVIA";

    /* En el post el marcador va en el asunto: es lo primero que se busca. */
    const conGoles = informeVisto.momento === "post" && p.gf !== null && p.gc !== null;

    const [gLocal, gVisit] = p.lado === "fuera" ? [p.gc, p.gf] : [p.gf, p.gc];

    const cruce =
      p.lado === "fuera" ? `${p.rival}${conGoles ? ` ${gLocal}-${gVisit}` : " -"} RM Castilla` : `RM Castilla${conGoles ? ` ${gLocal}-${gVisit}` : " -"} ${p.rival}`;

    const partido = `${cruce}${p.jornada ? ` · J${p.jornada}` : ""}`;

    try {
      /* Si faltan el PDF y el PPT del rival, se sacan antes de mandar nada:
         así un fallo no deja el resumen enviado y el completo a medias. */
      let docsNuevos: Documento[] = [];

      if (que.completo && faltanDocs && !docsActual?.ok) {
        setTrabajando("Sacando el PDF y el PPT del rival en otra pestaña (≈40 s)…");

        const llegado = await new Promise<DocsLlegados>((resuelve) => {
          esperaDocs.current = resuelve;

          abreDocs();

          window.setTimeout(() => resuelve({ ok: false, clave: "", error: "Plantillas rivales no ha contestado a tiempo." }), ESPERA_DOCS);
        });

        if (llegado.ok) {
          docsNuevos = llegado.docs.map((x) => ({
            nombre: `${ROTULO_DOCUMENTO[x.tipo]} · recién sacado`,
            url: x.url,
            tipo: x.tipo === "plantilla-pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            tamano: x.tamano,
            adjuntable: true,
            origen: "rival" as const,
            generado: x.tipo,
          }));
        } else {
          toast.message("El PDF y el PPT del rival no han salido", { description: `${llegado.error} El completo sale sin ellos.` });
        }
      }

      const sustituidos = new Set(docsNuevos.map((x) => x.generado));

      const adjuntosRival = [...docsNuevos, ...marcados.filter((x) => !x.generado || !sustituidos.has(x.generado))];

      const imagenes = await capturaDiapositivas();

      const cids = imagenes.map((_, i) => `diapositiva-${i + 1}`);

      const pdfResumen = await pdfDe(imagenes);

      if (que.resumen) {
        setTrabajando("Mandando el resumen…");

        await manda({
          para,
          asunto: `[${etiqueta} · RESUMEN] ${partido}`,
          html: resumenHtml(informeVisto, cids),
          texto: informeTexto(informeVisto),
          imagenes: imagenes.map((img, i) => ({ cid: cids[i], tipo: "image/jpeg", base64: img.replace(/^data:[^;]+;base64,/, "") })),
          adjuntos: [{ nombre: `${nombreArchivo}.pdf`, tipo: "application/pdf", base64: await base64De(pdfResumen) }],
        });
      }

      if (que.completo) {
        /*
        | El completo lleva adjuntos el resumen (PDF y PPT), él mismo en PDF y
        | los documentos del rival. Los nuestros se suben antes a Supabase: por
        | la función de Vercel no caben.
        */
        setTrabajando("Montando el completo en PDF…");

        const propios: { nombre: string; blob: Blob; tipo: string }[] = [
          { nombre: `${nombreArchivo}-resumen.pdf`, blob: pdfResumen, tipo: "application/pdf" },
          { nombre: `${nombreArchivo}-resumen.pptx`, blob: pptDe(imagenes), tipo: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
          { nombre: `${nombreArchivo}-completo.pdf`, blob: await completoEnPdf(htmlVista, (h, t) => setTrabajando(`Montando el completo en PDF · hoja ${h} de ${t}…`)), tipo: "application/pdf" },
        ];

        const subidosAhora = [];

        for (const [i, archivo] of propios.entries()) {
          setTrabajando(`Subiendo adjuntos ${i + 1}/${propios.length}…`);

          subidosAhora.push(await subeAdjunto(new File([archivo.blob], archivo.nombre, { type: archivo.tipo })));
        }

        setTrabajando("Mandando el informe completo…");

        await manda({
          para,
          asunto: `[${etiqueta} · COMPLETO] ${partido}`,
          html: informeHtml(informeVisto, { ...extras, diapositivas: cids, adjuntos: [...subidosAhora, ...adjuntosRival].map((a) => a.nombre) }),
          texto: `${informeTexto(informeVisto)}${abpActual?.ok ? `\n\n— BALÓN PARADO —\n${abpActual.texto}` : ""}`,
          imagenes: [
            ...imagenes.map((img, i) => ({ cid: cids[i], tipo: "image/jpeg", base64: img.replace(/^data:[^;]+;base64,/, "") })),
            ...(abpActual?.ok ? abpActual.imagenes : []),
          ],
          adjuntosUrl: [...subidosAhora, ...adjuntosRival].map((d) => ({ nombre: d.nombre, url: d.url, tipo: d.tipo })),
        });
      }

      toast.success(que.resumen && que.completo ? "Mandados los dos correos" : "Mandado", {
        description: `${[que.resumen && "El resumen (con PDF)", que.completo && "el informe completo con sus adjuntos"].filter(Boolean).join(" y ")} a ${direcciones.length} ${direcciones.length === 1 ? "persona" : "personas"}.`,
      });
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
  const esperaAbp = que.completo && abpCargando;

  return (
    <Dialog
      title="Informe del partido"
      subtitle="Resumen en dos diapositivas e informe completo: la semana, los dos en datos, el rival, el pronóstico, el plan y el balón parado"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-white/60">
            <span className="text-white/35">Mandar:</span>
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={que.resumen} onChange={(e) => setQue((q) => ({ ...q, resumen: e.target.checked }))} className="accent-[#C8A96B]" />
              Resumen (2 diapositivas + PDF)
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={que.completo} onChange={(e) => setQue((q) => ({ ...q, completo: e.target.checked }))} className="accent-[#C8A96B]" />
              Informe completo{marcados.length ? ` + ${marcados.length} adjunto${marcados.length === 1 ? "" : "s"}` : ""}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={FileText} disabled={!informe || Boolean(trabajando)} onClick={() => void bajaPdf()} title="Las dos diapositivas en PDF">
              Resumen PDF
            </Button>
            <Button icon={Presentation} disabled={!informe || Boolean(trabajando)} onClick={() => void bajaPptx()} title="Las dos diapositivas en PowerPoint">
              Resumen PPT
            </Button>
            <Button icon={BookOpen} disabled={!informe || Boolean(trabajando) || abpCargando} onClick={() => void bajaCompleto()} title="El informe extenso en PDF (con el de balón parado)">
              Completo PDF
            </Button>
            <Button
              tone="primary"
              icon={trabajando || esperaAbp ? Loader2 : Send}
              disabled={!informe || Boolean(trabajando) || cargando || esperaAbp || Boolean(subiendo)}
              onClick={() => void envia()}
              title={esperaAbp ? "Esperando al informe de balón parado del microciclo" : undefined}
            >
              {trabajando ?? (esperaAbp ? "Preparando ABP…" : que.resumen && que.completo ? "Enviar los dos" : "Enviar")}
            </Button>
          </div>
        </div>
      }
    >
      <div className={`space-y-4 ${barlowCondensed.className}`} style={{ ["--fuente-informe" as string]: barlowCondensed.style.fontFamily, fontFamily: "inherit" }}>
        <div className="flex flex-wrap items-end gap-3 font-sans">
          <label className="min-w-[220px]">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Microciclo</span>
            <select
              value={elegido ? `${elegido.temporada}|${elegido.micro}` : ""}
              onChange={(e) => {
                const [t, m] = e.target.value.split("|");

                setElegido({ temporada: t, micro: Number(m) });
                setMomentoPedido(null);
                setSubidos([]);
                setQuitados(new Set());
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
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Momento</span>
            <Segmented
              ariaLabel="Previa o post"
              value={momento}
              options={[
                { key: "previa", label: "Previa del partido" },
                { key: "post", label: "Post partido" },
              ]}
              onChange={(m) => setMomentoPedido(m as Momento)}
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
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Ver</span>
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

        <div className="font-sans">
          <TextArea
            label="A quién se le manda"
            value={ajustes.destinatarios}
            onChange={(destinatarios) => setAjustes({ destinatarios })}
            placeholder="correo@ejemplo.com, otro@ejemplo.com"
            rows={2}
          />
        </div>

        {/* El estado de las piezas que llegan aparte. */}
        {informe && !cargando && (
          <div className="grid gap-3 font-sans md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] text-white/65">
              <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/40">Balón parado</p>
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

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] text-white/65">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Adjuntos del completo · además del resumen (PDF y PPT) y el completo en PDF</p>
                <span className="text-[10px] text-white/35">{marcados.length ? `${mb(pesoAdjuntos)} de ${mb(TOPE_ADJUNTOS)}` : ""}</span>
              </div>
              {faltanDocs && !docsActual && !docsCargando ? (
                <p className="mb-1 text-white/60">
                  El PDF de la plantilla y el PPT del rival {generados.length ? "son de antes de esta semana" : "no se han sacado"}: se sacarán solos al enviar el completo, en otra pestaña que se cierra sola (≈40 s).
                </p>
              ) : null}
              {docsCargando ? (
                <p className="mb-1 inline-flex items-center gap-2 text-white/60">
                  <Loader2 size={12} className="animate-spin" /> Sacando el PDF de la plantilla y el PPT del rival en otra pestaña (se cierra sola)…
                </p>
              ) : docsActual && !docsActual.ok ? (
                <p className="mb-1 text-amber-200/80">
                  No se han podido sacar solos ({docsActual.error}).{" "}
                  <button className="underline underline-offset-2" onClick={abreDocs}>
                    Reintentar
                  </button>
                </p>
              ) : null}
              {documentos.length ? (
                <ul className="space-y-1">
                  {documentos.map((d) => (
                    <li key={d.url} className="flex items-center gap-2">
                      {d.adjuntable ? (
                        <input
                          type="checkbox"
                          className="accent-[#C8A96B]"
                          checked={!quitados.has(d.url)}
                          onChange={(e) =>
                            setQuitados((s) => {
                              const n = new Set(s);

                              if (e.target.checked) n.delete(d.url);
                              else n.add(d.url);

                              return n;
                            })
                          }
                        />
                      ) : (
                        <ExternalLink size={12} className="text-white/35" />
                      )}
                      <span className="truncate">{d.nombre}</span>
                      <span className="shrink-0 text-white/35">
                        {d.adjuntable ? mb(d.tamano) : "va como enlace"}
                        {d.origen === "subido" ? " · subido ahora" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/45">El rival no tiene documentos en sus Recursos.</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
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
          </div>
        )}

        {informeVisto && informeVisto.avisos.length > 0 && (
          <div className="font-sans">
            <Notice tone="warn" title="Lo que este informe no sabe">
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
                <Escalada ancho={anchoVista}>
                  <Uno inf={informeVisto} />
                </Escalada>
                <Escalada ancho={anchoVista}>
                  <Dos inf={informeVisto} />
                </Escalada>
              </div>
            )
          ) : (
            <iframe title="Informe completo" srcDoc={htmlVista} className="h-[70vh] w-full rounded-xl border border-white/10 bg-white" />
          )}
        </div>

        {informe && (
          <p className="font-sans text-[11px] text-white/35">
            <Download size={11} className="mr-1 inline" />
            PDF y PPT bajan las dos diapositivas; el informe completo va en el segundo correo.
          </p>
        )}
      </div>

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

      {/* Las diapositivas a su tamaño, fuera de pantalla, para capturarlas. */}
      {informeVisto && trabajando && (
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
