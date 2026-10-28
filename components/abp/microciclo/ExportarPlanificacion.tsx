"use client";

/**
 * Exportar sólo la planificación de la semana de ABP (28/10/2026): la imagen
 * para el grupo y el texto para WhatsApp o para el correo, sin el informe.
 *
 * La lámina va fuera de la pantalla, con colores fijos (no sigue el modo
 * día/noche): así la imagen sale igual desde cualquier aparato.
 */

import { useMemo, useRef, useState } from "react";
import { ClipboardCopy, FileDown, ImageDown, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog } from "@/components/abp/ui";
import { fmtMin } from "@/lib/abp/microciclo";
import { textoPlanificacion, tituloPlanificacion, type DiaPlanificado } from "@/lib/abp/planificacion-semana";
import { capturaNodo } from "@/lib/export/captura";
import { apodo, descarga, descargaDataUrl, pdfDeHojas } from "@/lib/export/lienzos";

const TINTA = "#0B1E3A";
const ORO = "#B8963E";
const GRIS = "#5B6676";
const DEF = "#C0392B";
const OF = "#1E8E5A";

/**
 * El calendario de la semana (28/10/2026): una columna por día con su MD y
 * sus bloques de balón parado, del alto de sus minutos. Apaisado: la primera
 * imagen o la primera página del PDF.
 */
function Calendario({ dias, micro, rival }: { dias: DiaPlanificado[]; micro: number; rival: string }) {
  const total = dias.reduce((suma, d) => suma + d.minutos, 0);

  const max = Math.max(30, ...dias.map((d) => d.minutos));

  return (
    <div style={{ width: 1400, background: "#FFFFFF", color: TINTA, fontFamily: "var(--font-barlow, 'Barlow Condensed'), Arial, sans-serif", padding: 32 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: `3px solid ${ORO}`, paddingBottom: 10, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 13, letterSpacing: 2, color: ORO, fontWeight: 700 }}>REAL MADRID CASTILLA · CALENDARIO DE LA SEMANA</div>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>{tituloPlanificacion(micro, rival).toUpperCase()}</div>
        </div>
        {total > 0 && <div style={{ fontSize: 18, color: GRIS, fontWeight: 700 }}>{fmtMin(total)} de balón parado</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))`, gap: 10 }}>
        {dias.map((d) => {
          const partido = d.tipo === "partido";
          const descanso = d.tipo === "descanso";

          return (
            <div key={d.clave} style={{ border: "1px solid #E3E7ED", borderRadius: 12, overflow: "hidden", background: partido ? "#0B1E3A" : descanso ? "#F4F6F9" : "#FFFFFF", minHeight: 420 }}>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #E3E7ED", background: partido ? "#0B1E3A" : "#F8F5EC", color: partido ? "#FFFFFF" : TINTA }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{d.dia}</div>
                <div style={{ fontSize: 13, color: partido ? ORO : GRIS, fontWeight: 700 }}>
                  {[d.md, partido ? "PARTIDO" : descanso ? "DESCANSO" : d.tareas.length ? fmtMin(d.minutos) : ""].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {d.tareas.map((t, i) => {
                  const ofe = /ofensivo/i.test(t.lado);
                  const def = /defensivo/i.test(t.lado);
                  const color = ofe && def ? ORO : def ? DEF : OF;

                  return (
                    <div
                      key={i}
                      style={{
                        borderLeft: `5px solid ${color}`,
                        background: partido ? "rgba(255,255,255,.08)" : `${color}14`,
                        borderRadius: 8,
                        padding: "6px 8px",
                        minHeight: Math.max(48, (t.minutos / max) * 300),
                      }}
                    >
                      {/* El día de partido la columna es oscura: el texto, claro. */}
                      <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.15, color: partido ? "#FFFFFF" : TINTA }}>{t.que}</div>
                      <div style={{ fontSize: 12, color, fontWeight: 700 }}>{t.lado}</div>
                      <div style={{ fontSize: 12, color: partido ? "#C9D3E0" : GRIS }}>
                        {t.donde} · {fmtMin(t.minutos)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 13, color: GRIS }}>
        <span>
          <b style={{ color: OF }}>■</b> Ofensivo
        </span>
        <span>
          <b style={{ color: DEF }}>■</b> Defensivo
        </span>
        <span>
          <b style={{ color: ORO }}>■</b> Los dos
        </span>
        <span>El alto de cada bloque va por sus minutos.</span>
      </div>
    </div>
  );
}

function Lamina({ dias, micro, rival }: { dias: DiaPlanificado[]; micro: number; rival: string }) {
  const total = dias.reduce((suma, d) => suma + d.minutos, 0);

  const visibles = dias.filter((d) => d.tareas.length || d.tipo !== "entreno");

  return (
    <div style={{ width: 720, background: "#FFFFFF", color: TINTA, fontFamily: "var(--font-barlow, 'Barlow Condensed'), Arial, sans-serif", padding: 32 }}>
      <div style={{ borderBottom: `3px solid ${ORO}`, paddingBottom: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: ORO, fontWeight: 700 }}>REAL MADRID CASTILLA · PLANIFICACIÓN DE LA SEMANA</div>
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>{tituloPlanificacion(micro, rival).toUpperCase()}</div>
        {total > 0 && <div style={{ fontSize: 15, color: GRIS, marginTop: 4 }}>{fmtMin(total)} de balón parado</div>}
      </div>

      {visibles.map((d) => (
        <div key={d.clave} style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: "1px solid #E3E7ED" }}>
          <div style={{ width: 150, flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{d.dia}</div>
            <div style={{ fontSize: 13, color: GRIS }}>
              {[d.md, d.tipo === "partido" ? "Partido" : d.tipo === "descanso" ? "Descanso" : d.tareas.length ? fmtMin(d.minutos) : ""].filter(Boolean).join(" · ")}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {d.tareas.map((t, i) => (
              <div key={i} style={{ marginBottom: i === d.tareas.length - 1 ? 0 : 8 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  {t.que}{" "}
                  <span style={{ color: /defensivo/i.test(t.lado) && !/ofensivo/i.test(t.lado) ? DEF : OF, fontWeight: 600 }}>· {t.lado.toLowerCase()}</span>
                </div>
                <div style={{ fontSize: 14, color: GRIS }}>
                  {t.donde} · {fmtMin(t.minutos)}
                </div>
                {t.objetivo && <div style={{ fontSize: 14, marginTop: 2 }}>Objetivo: {t.objetivo}</div>}
                {t.notas && <div style={{ fontSize: 14, color: GRIS, marginTop: 2 }}>{t.notas}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExportarPlanificacion({ dias, micro, rival, onCerrar }: { dias: DiaPlanificado[]; micro: number; rival: string; onCerrar: () => void }) {
  const lamina = useRef<HTMLDivElement>(null);

  const calendario = useRef<HTMLDivElement>(null);

  const [haciendo, setHaciendo] = useState(false);

  const texto = useMemo(() => textoPlanificacion(dias, micro, rival, true), [dias, micro, rival]);

  const sinTareas = dias.every((d) => d.tareas.length === 0);

  const nombre = `ABP-planificacion-micro-${micro}${rival ? `-${apodo(rival)}` : ""}`;

  /* Las dos láminas: el calendario (apaisado) y el detalle (vertical). */
  const capturas = async () => {
    if (!lamina.current || !calendario.current) throw new Error("Sin láminas");

    const cal = await capturaNodo(calendario.current, { pixelRatio: 2, backgroundColor: "#FFFFFF" });

    const det = await capturaNodo(lamina.current, { pixelRatio: 2, backgroundColor: "#FFFFFF" });

    return [cal, det] as const;
  };

  /* En el móvil, a la hoja de compartir (WhatsApp, galería…); si no, se descarga. */
  const entrega = async (ficheros: File[], descargar: () => Promise<void>) => {
    if (navigator.canShare?.({ files: ficheros }) && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ files: ficheros, title: tituloPlanificacion(micro, rival) }).catch(() => undefined);
    } else {
      await descargar();
    }
  };

  /* Dos imágenes: el calendario y el detalle. */
  const imagenes = async () => {
    setHaciendo(true);

    try {
      const [cal, det] = await capturas();

      const pares: [string, string][] = [
        [cal.dataUrl, `${nombre}-1-calendario.png`],
        [det.dataUrl, `${nombre}-2-detalle.png`],
      ];

      const ficheros = await Promise.all(pares.map(async ([url, n]) => new File([await (await fetch(url)).blob()], n, { type: "image/png" })));

      await entrega(ficheros, async () => {
        for (const [url, n] of pares) await descargaDataUrl(url, n);
      });
    } catch (error) {
      console.error("[abp-microciclo] imágenes de la planificación", error);
      toast.error("No se han podido hacer las imágenes");
    } finally {
      setHaciendo(false);
    }
  };

  /* Un PDF de dos páginas: el calendario apaisado y el detalle en vertical. */
  const pdf = async () => {
    setHaciendo(true);

    try {
      const [cal, det] = await capturas();

      const documento = await pdfDeHojas([
        { imagen: cal.dataUrl, ancho: cal.ancho, alto: cal.alto, orientacion: "landscape", margen: 18 },
        { imagen: det.dataUrl, ancho: det.ancho, alto: det.alto, orientacion: "portrait", margen: 18 },
      ]);

      const blob = documento.output("blob");

      await entrega([new File([blob], `${nombre}.pdf`, { type: "application/pdf" })], async () => descarga(blob, `${nombre}.pdf`));
    } catch (error) {
      console.error("[abp-microciclo] PDF de la planificación", error);
      toast.error("No se ha podido hacer el PDF");
    } finally {
      setHaciendo(false);
    }
  };

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Planificación copiada");
    } catch {
      toast.error("El navegador no deja copiar");
    }
  };

  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");

  const correo = () => {
    const asunto = `${tituloPlanificacion(micro, rival)} · planificación`;

    window.location.href = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(textoPlanificacion(dias, micro, rival, false))}`;
  };

  return (
    <Dialog
      title="Exportar la planificación"
      subtitle={`Sólo lo planificado · Micro ${micro}${rival ? ` · ${rival}` : ""}`}
      onClose={onCerrar}
      footer={
        <>
          <Button icon={ClipboardCopy} onClick={copia} disabled={sinTareas}>
            Copiar texto
          </Button>
          <Button icon={Mail} onClick={correo} disabled={sinTareas}>
            Correo
          </Button>
          <Button icon={MessageCircle} onClick={whatsapp} disabled={sinTareas}>
            WhatsApp
          </Button>
          <Button icon={ImageDown} onClick={imagenes} disabled={sinTareas || haciendo}>
            {haciendo ? "Haciendo…" : "2 imágenes"}
          </Button>
          <Button tone="primary" icon={FileDown} onClick={pdf} disabled={sinTareas || haciendo}>
            {haciendo ? "Haciendo…" : "PDF (2 páginas)"}
          </Button>
        </>
      }
    >
      {sinTareas ? (
        <p className="text-sm text-white/70">Esta semana aún no tiene tareas de balón parado.</p>
      ) : (
        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.03] p-3 font-sans text-[13px] leading-relaxed text-white/85">{texto.replace(/\*/g, "")}</pre>
      )}

      {/* La lámina de la imagen, fuera de la vista. */}
      <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
        <div ref={calendario}>
          <Calendario dias={dias} micro={micro} rival={rival} />
        </div>
        <div ref={lamina}>
          <Lamina dias={dias} micro={micro} rival={rival} />
        </div>
      </div>
    </Dialog>
  );
}
