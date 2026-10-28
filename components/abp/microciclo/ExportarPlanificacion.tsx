"use client";

/**
 * Exportar sólo la planificación de la semana de ABP (28/10/2026): la imagen
 * para el grupo y el texto para WhatsApp o para el correo, sin el informe.
 *
 * La lámina va fuera de la pantalla, con colores fijos (no sigue el modo
 * día/noche): así la imagen sale igual desde cualquier aparato.
 */

import { useMemo, useRef, useState } from "react";
import { ClipboardCopy, ImageDown, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog } from "@/components/abp/ui";
import { fmtMin } from "@/lib/abp/microciclo";
import { textoPlanificacion, tituloPlanificacion, type DiaPlanificado } from "@/lib/abp/planificacion-semana";
import { capturaNodo } from "@/lib/export/captura";
import { apodo, descargaDataUrl } from "@/lib/export/lienzos";

const TINTA = "#0B1E3A";
const ORO = "#B8963E";
const GRIS = "#5B6676";
const DEF = "#C0392B";
const OF = "#1E8E5A";

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

  const [haciendo, setHaciendo] = useState(false);

  const texto = useMemo(() => textoPlanificacion(dias, micro, rival, true), [dias, micro, rival]);

  const sinTareas = dias.every((d) => d.tareas.length === 0);

  const nombre = `ABP-planificacion-micro-${micro}${rival ? `-${apodo(rival)}` : ""}`;

  const imagen = async () => {
    if (!lamina.current) return;

    setHaciendo(true);

    try {
      const { dataUrl } = await capturaNodo(lamina.current, { pixelRatio: 2, backgroundColor: "#FFFFFF" });

      /* En el móvil, a la hoja de compartir (WhatsApp, galería…); si no, se descarga. */
      const blob = await (await fetch(dataUrl)).blob();

      const fichero = new File([blob], `${nombre}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [fichero] }) && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ files: [fichero], title: tituloPlanificacion(micro, rival) }).catch(() => undefined);
      } else {
        await descargaDataUrl(dataUrl, `${nombre}.png`);
      }
    } catch (error) {
      console.error("[abp-microciclo] imagen de la planificación", error);
      toast.error("No se ha podido hacer la imagen");
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
          <Button tone="primary" icon={ImageDown} onClick={imagen} disabled={sinTareas || haciendo}>
            {haciendo ? "Haciendo…" : "Imagen"}
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
        <div ref={lamina}>
          <Lamina dias={dias} micro={micro} rival={rival} />
        </div>
      </div>
    </Dialog>
  );
}
