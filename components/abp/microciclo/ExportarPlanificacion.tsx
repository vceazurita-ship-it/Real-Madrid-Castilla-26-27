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
const GRIS = "#4A5568";
const DEF = "#C0392B";
const OF = "#1E8E5A";
const FUENTE = "var(--font-barlow, 'Barlow Condensed'), Arial, sans-serif";

/** Un color por lado, igual en las dos láminas: los dos lados van en oro. */
function colorLado(lado: string) {
  const ofe = /ofensivo/i.test(lado);
  const def = /defensivo/i.test(lado);

  return ofe && def ? ORO : def ? DEF : OF;
}

/** «Cartagena: 2 h 10′ de balón parado en 4 días · partido el sábado 31/10». */
function titular(dias: DiaPlanificado[], rival: string) {
  const total = dias.reduce((suma, d) => suma + d.minutos, 0);
  const conTrabajo = dias.filter((d) => d.tareas.length).length;
  const partido = dias.find((d) => d.tipo === "partido");

  return {
    titulo: `${rival ? `${rival}: ` : ""}${fmtMin(total)} de balón parado en ${conTrabajo} ${conTrabajo === 1 ? "día" : "días"}`,
    partido: partido ? `Partido el ${partido.dia.toLowerCase()}` : "",
  };
}

/** El pie de las dos láminas: viaja con la captura de WhatsApp. */
function Pie() {
  const hoy = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, paddingTop: 10, borderTop: "1px solid #E3E7ED", fontSize: 14, color: GRIS }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={26} height={26} style={{ objectFit: "contain" }} />
      <span>Real Madrid Castilla · Cuerpo técnico · Uso interno · {hoy}</span>
    </div>
  );
}

/**
 * El calendario de la semana (28/10/2026, revisado con los expertos de fútbol
 * y de comunicación): 1080 de ancho para que se lea en el móvil, sólo los días
 * con trabajo y el del partido, titular con el dato y el objetivo de cada
 * tarea dentro de su bloque (en el campo nadie pasa de página).
 */
export function Calendario({ dias, micro, rival }: { dias: DiaPlanificado[]; micro: number; rival: string }) {
  const visibles = dias.filter((d) => d.tareas.length || d.tipo === "partido");

  const max = Math.max(30, ...dias.map((d) => d.minutos));

  const { titulo, partido } = titular(dias, rival);

  return (
    <div style={{ width: 1080, background: "#FFFFFF", color: TINTA, fontFamily: FUENTE, padding: 32 }}>
      <div style={{ borderBottom: `3px solid ${ORO}`, paddingBottom: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 16, letterSpacing: 2, color: ORO, fontWeight: 700 }}>ABP · MICROCICLO {micro} · CALENDARIO</div>
        <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05, marginTop: 4 }}>{titulo}</div>
        {partido && <div style={{ fontSize: 20, color: GRIS, fontWeight: 700, marginTop: 4 }}>{partido}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${visibles.length}, minmax(0, 1fr))`, gap: 10, alignItems: "start" }}>
        {visibles.map((d) => {
          const esPartido = d.tipo === "partido";

          return (
            <div key={d.clave} style={{ border: "1px solid #E3E7ED", borderRadius: 12, overflow: "hidden", background: esPartido ? TINTA : "#FFFFFF" }}>
              <div style={{ padding: "8px 10px", background: esPartido ? TINTA : "#F8F5EC", color: esPartido ? "#FFFFFF" : TINTA }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{d.dia}</div>
                <div style={{ fontSize: 16, color: esPartido ? ORO : GRIS, fontWeight: 700 }}>
                  {[d.md, esPartido ? "PARTIDO" : fmtMin(d.minutos)].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {d.tareas.map((t, i) => {
                  const color = colorLado(t.lado);

                  return (
                    <div
                      key={i}
                      style={{
                        borderLeft: `6px solid ${color}`,
                        background: esPartido ? "rgba(255,255,255,.08)" : `${color}14`,
                        borderRadius: 8,
                        padding: "8px 10px",
                        minHeight: Math.max(64, (t.minutos / max) * 260),
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15, color: esPartido ? "#FFFFFF" : TINTA }}>{t.queCorto}</div>
                      <div style={{ fontSize: 16, color, fontWeight: 700 }}>
                        {t.lado} · {fmtMin(t.minutos)}
                      </div>
                      <div style={{ fontSize: 16, color: esPartido ? "#C9D3E0" : GRIS }}>{t.donde}</div>
                      {t.objetivo && <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: esPartido ? "#FFFFFF" : TINTA }}>✔ {t.objetivo}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 18, marginTop: 14, fontSize: 16, color: GRIS }}>
        <span>
          <b style={{ color: OF }}>■</b> Ofensivo
        </span>
        <span>
          <b style={{ color: DEF }}>■</b> Defensivo
        </span>
        <span>
          <b style={{ color: ORO }}>■</b> Los dos
        </span>
      </div>

      <Pie />
    </div>
  );
}

/** El detalle, para llevar al campo: objetivo en negro, quién la trabaja y su casilla de revisión. */
/* `casillas`: sólo en el PDF, que se imprime; en la imagen de WhatsApp no se pueden rellenar y doblaban el alto. */
export function Lamina({ dias, micro, rival, casillas = false }: { dias: DiaPlanificado[]; micro: number; rival: string; casillas?: boolean }) {
  const visibles = dias.filter((d) => d.tareas.length || d.tipo === "partido");

  const { titulo, partido } = titular(dias, rival);

  return (
    <div style={{ width: 1080, background: "#FFFFFF", color: TINTA, fontFamily: FUENTE, padding: 32 }}>
      <div style={{ borderBottom: `3px solid ${ORO}`, paddingBottom: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 16, letterSpacing: 2, color: ORO, fontWeight: 700 }}>ABP · MICROCICLO {micro} · DETALLE</div>
        <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.05, marginTop: 4 }}>{titulo}</div>
        {partido && <div style={{ fontSize: 20, color: GRIS, fontWeight: 700, marginTop: 4 }}>{partido}</div>}
      </div>

      {visibles.map((d) => (
        <div key={d.clave} style={{ display: "flex", gap: 20, padding: "14px 0", borderBottom: "1px solid #E3E7ED" }}>
          <div style={{ width: 190, flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{d.dia}</div>
            <div style={{ fontSize: 17, color: GRIS }}>{[d.md, d.tipo === "partido" ? "Partido" : fmtMin(d.minutos)].filter(Boolean).join(" · ")}</div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {d.tareas.map((t, i) => (
              <div key={i} style={{ marginBottom: i === d.tareas.length - 1 ? 0 : 14 }}>
                <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.2 }}>
                  {t.que} <span style={{ color: colorLado(t.lado), fontWeight: 700 }}>· {t.lado.toLowerCase()}</span>
                </div>
                <div style={{ fontSize: 18, color: GRIS }}>
                  {[t.donde, fmtMin(t.minutos), t.quien].filter(Boolean).join(" · ")}
                </div>
                {t.objetivo && <div style={{ fontSize: 19, fontWeight: 700, marginTop: 3 }}>✔ {t.objetivo}</div>}
                {t.notas && <div style={{ fontSize: 16, color: GRIS, marginTop: 2 }}>{t.notas}</div>}
                {casillas && <div style={{ fontSize: 16, color: GRIS, marginTop: 6 }}>☐ Conseguido &nbsp;&nbsp; ☐ A repetir &nbsp;&nbsp; Nota: ______________________________</div>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <Pie />
    </div>
  );
}

export function ExportarPlanificacion({ dias, micro, rival, onCerrar }: { dias: DiaPlanificado[]; micro: number; rival: string; onCerrar: () => void }) {
  const lamina = useRef<HTMLDivElement>(null);

  const laminaPdf = useRef<HTMLDivElement>(null);

  const calendario = useRef<HTMLDivElement>(null);

  const [haciendo, setHaciendo] = useState(false);

  const texto = useMemo(() => textoPlanificacion(dias, micro, rival, true), [dias, micro, rival]);

  const sinTareas = dias.every((d) => d.tareas.length === 0);

  const nombre = `ABP-planificacion-micro-${micro}${rival ? `-${apodo(rival)}` : ""}`;

  /* Las dos láminas: el calendario (apaisado) y el detalle (vertical). */
  const capturas = async (imprimible = false) => {
    const detalle = imprimible ? laminaPdf.current : lamina.current;

    if (!detalle || !calendario.current) throw new Error("Sin láminas");

    const cal = await capturaNodo(calendario.current, { pixelRatio: 2, backgroundColor: "#FFFFFF" });

    const det = await capturaNodo(detalle, { pixelRatio: 2, backgroundColor: "#FFFFFF" });

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
      const [cal, det] = await capturas(true);

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
    const asunto = `ABP Micro ${micro}${rival ? ` vs ${rival}` : ""}: ${fmtMin(dias.reduce((suma, d) => suma + d.minutos, 0))} de balón parado`;

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
        <div ref={laminaPdf}>
          <Lamina dias={dias} micro={micro} rival={rival} casillas />
        </div>
      </div>
    </Dialog>
  );
}
