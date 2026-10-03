"use client";

/**
 * EL INFORME DEL PARTIDO: VERLO, BAJARLO Y MANDARLO (03/10/2026).
 *
 * Se abre desde Microciclos. Elige el microciclo (por defecto el que se esté
 * mirando) y si es la previa o el post (por defecto lo dice el calendario).
 * Enseña el resumen —dos diapositivas— y el informe extenso tal y como van a
 * llegar, y con un botón manda **los dos correos**: el resumen con las
 * diapositivas dentro y en PDF adjunto, y el extenso.
 *
 * Lo que arma el informe está en `lib/informe-partido/`; aquí sólo se carga,
 * se pinta y se envía.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2, Presentation, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog, Notice, Segmented, TextArea } from "@/components/abp/ui";
import { DIAPO_H, DIAPO_W, DIAPOSITIVAS, Escalada } from "@/components/informe-partido/Diapositivas";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { cargaInforme, microsDisponibles, type MicroDisponible } from "@/lib/informe-partido/carga";
import { informeHtml, informeTexto, resumenHtml } from "@/lib/informe-partido/html";
import type { InformePartido, Momento } from "@/lib/informe-partido/modelo";
import { apodo, capturaLienzos, descarga, pintado, pdfDeLienzos } from "@/lib/export/lienzos";
import { creaPptx } from "@/lib/export/pptx";
import { barlowCondensed } from "@/lib/rivals/portada-font";

type AjustesCorreo = { destinatarios: string };

const base64De = (blob: Blob) =>
  new Promise<string>((resuelve, falla) => {
    const lector = new FileReader();

    lector.onload = () => resuelve(String(lector.result).replace(/^data:[^;]+;base64,/, ""));
    lector.onerror = () => falla(lector.error);

    lector.readAsDataURL(blob);
  });

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

  const [elegido, setElegido] = useState<{ temporada: string; micro: number } | null>(
    temporada && micro ? { temporada, micro } : null,
  );

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

  const html = useMemo(() => (informe ? informeHtml(informe) : ""), [informe]);

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

      descarga(
        creaPptx(
          imagenes.map((imagen, i) => ({ titulo: i === 0 ? "El partido" : "El plan", imagen })),
          { titulo: `${informe?.momento === "post" ? "Post" : "Previa"} · ${informe?.partido.rival ?? ""}`, aplicacion: "Informe del partido" },
        ),
        `${nombreArchivo}.pptx`,
      );
    } catch (error) {
      toast.error("No se ha podido exportar", { description: error instanceof Error ? error.message : "" });
    } finally {
      setTrabajando(null);
    }
  };

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
    if (!informe) return;

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

    const para = direcciones.join(", ");

    const p = informe.partido;

    const etiqueta = informe.momento === "post" ? "POST" : "PREVIA";

    /* En el post el marcador va en el asunto: es lo primero que se busca. */
    const conGoles = informe.momento === "post" && p.gf !== null && p.gc !== null;

    const [gLocal, gVisit] = p.lado === "fuera" ? [p.gc, p.gf] : [p.gf, p.gc];

    const cruce =
      p.lado === "fuera"
        ? `${p.rival}${conGoles ? ` ${gLocal}-${gVisit}` : " -"} RM Castilla`
        : `RM Castilla${conGoles ? ` ${gLocal}-${gVisit}` : " -"} ${p.rival}`;

    const partido = `${cruce}${p.jornada ? ` · J${p.jornada}` : ""}`;

    try {
      if (que.resumen) {
        const imagenes = await capturaDiapositivas();

        setTrabajando("Mandando el resumen…");

        const cids = imagenes.map((_, i) => `diapositiva-${i + 1}`);

        await manda({
          para,
          asunto: `[${etiqueta} · RESUMEN] ${partido}`,
          html: resumenHtml(informe, cids),
          texto: informeTexto(informe),
          imagenes: imagenes.map((img, i) => ({ cid: cids[i], tipo: "image/jpeg", base64: img.replace(/^data:[^;]+;base64,/, "") })),
          adjuntos: [{ nombre: `${nombreArchivo}.pdf`, tipo: "application/pdf", base64: await base64De(await pdfDe(imagenes)) }],
        });

      }

      if (que.completo) {
        setTrabajando("Mandando el informe completo…");

        await manda({
          para,
          asunto: `[${etiqueta} · COMPLETO] ${partido}`,
          html,
          texto: informeTexto(informe),
        });
      }

      toast.success(que.resumen && que.completo ? "Mandados los dos correos" : "Mandado", {
        description: `${[que.resumen && "El resumen (con PDF)", que.completo && "el informe completo"].filter(Boolean).join(" y ")} a ${direcciones.length} ${direcciones.length === 1 ? "persona" : "personas"}.`,
      });
    } catch (error) {
      toast.error("No se ha podido mandar", { description: error instanceof Error ? error.message : "" });
    } finally {
      setTrabajando(null);
    }
  };

  /* Lo que se ve mientras carga es lo pedido, no lo que había. */
  const momento = momentoPedido ?? informe?.momento ?? "previa";

  const [Uno, Dos] = DIAPOSITIVAS[informe?.momento ?? "previa"];

  return (
    <Dialog
      title="Informe del partido"
      subtitle="Resumen en dos diapositivas e informe completo: microciclo, nosotros, el rival y el plan"
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
              Informe completo
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={FileText} disabled={!informe || Boolean(trabajando)} onClick={() => void bajaPdf()}>
              PDF
            </Button>
            <Button icon={Presentation} disabled={!informe || Boolean(trabajando)} onClick={() => void bajaPptx()}>
              PPT
            </Button>
            <Button tone="primary" icon={trabajando ? Loader2 : Send} disabled={!informe || Boolean(trabajando) || cargando} onClick={() => void envia()}>
              {trabajando ?? (que.resumen && que.completo ? "Enviar los dos" : "Enviar")}
            </Button>
          </div>
        </div>
      }
    >
      <div
        className={`space-y-4 ${barlowCondensed.className}`}
        style={{ ["--fuente-informe" as string]: barlowCondensed.style.fontFamily, fontFamily: "inherit" }}
      >
        <div className="flex flex-wrap items-end gap-3 font-sans">
          <label className="min-w-[220px]">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Microciclo</span>
            <select
              value={elegido ? `${elegido.temporada}|${elegido.micro}` : ""}
              onChange={(e) => {
                const [t, m] = e.target.value.split("|");

                setElegido({ temporada: t, micro: Number(m) });
                setMomentoPedido(null);
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
                ? "Elegido a mano"
                : informe?.partido.jugado
                  ? "Lo dice el calendario: ya se jugó"
                  : "Lo dice el calendario: aún no se ha jugado"}
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

        {informe && informe.avisos.length > 0 && (
          <div className="font-sans">
            <Notice tone="warn" title="Lo que este informe no sabe">
              <ul className="ml-4 list-disc space-y-1">
                {informe.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Notice>
          </div>
        )}

        <div ref={caja} className="min-w-0">
          {!informe || cargando ? (
            <p className="flex items-center gap-2 py-10 text-sm text-white/45 font-sans">
              <Loader2 size={14} className="animate-spin" /> Juntando el microciclo, Data, el rival y el plan…
            </p>
          ) : vista === "resumen" ? (
            anchoVista > 0 && (
              <div className="space-y-3">
                <Escalada ancho={anchoVista}>
                  <Uno inf={informe} />
                </Escalada>
                <Escalada ancho={anchoVista}>
                  <Dos inf={informe} />
                </Escalada>
              </div>
            )
          ) : (
            <iframe title="Informe completo" srcDoc={html} className="h-[70vh] w-full rounded-xl border border-white/10 bg-white" />
          )}
        </div>

        {informe && (
          <p className="text-[11px] text-white/35 font-sans">
            <Download size={11} className="mr-1 inline" />
            PDF y PPT bajan las dos diapositivas; el informe completo va en el segundo correo.
          </p>
        )}
      </div>

      {/* Las diapositivas a su tamaño, fuera de pantalla, para capturarlas. */}
      {informe && trabajando && (
        <div
          ref={lienzos}
          aria-hidden
          className={barlowCondensed.className}
          style={{ position: "fixed", left: -30000, top: 0, width: DIAPO_W, pointerEvents: "none", ["--fuente-informe" as string]: barlowCondensed.style.fontFamily }}
        >
          <Uno inf={informe} />
          <Dos inf={informe} />
        </div>
      )}
    </Dialog>
  );
}
