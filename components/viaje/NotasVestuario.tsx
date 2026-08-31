"use client";

/*
|--------------------------------------------------------------------------
| LAS NOTAS DE VESTUARIO
|--------------------------------------------------------------------------
|
| La hoja que se deja en el vestuario del otro equipo. Son dos y sólo cambia
| lo que dicen: **agradecimiento** cuando vamos nosotros de viaje y
| **bienvenida** cuando el viaje lo han hecho ellos.
|
| Vive en el desplazamiento porque es parte de lo que se prepara la semana del
| partido —se imprime con el dossier y el horario y se mete en la misma
| carpeta—, aunque no dependa del rival: no lleva escudo, ni jornada, ni
| fecha, y quien la baje se lleva siempre la misma.
|
| Lo que dicen **se puede cambiar y se guarda** (`useRemoteDoc`, igual que el
| resto de la página): el tono de la casa lo pone quien firma. El botón de
| volver al original está ahí para que cambiarlo no dé miedo.
|
| El dibujo —los dos formatos y el de la vista previa— sale de
| `lib/general/notas-vestuario`.
*/

import { useEffect, useMemo, useState } from "react";
import { FileText, Handshake, Presentation, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button, Field, Panel, TextArea } from "@/components/abp/ui";
import {
  ARCHIVO,
  NOTAS_ORIGINALES,
  dibujaNota,
  exportNotaPdf,
  exportNotaPptx,
  type ClaveNota,
  type NotaVestuario,
} from "@/lib/general/notas-vestuario";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";

/** Lo único que se guarda: lo que alguien haya reescrito. */
type NotasGuardadas = Partial<
  Record<ClaveNota, { texto?: string; cierre?: string }>
>;

const VACIO: NotasGuardadas = {};

const PESTANAS: { clave: ClaveNota; titulo: string; pie: string }[] = [
  {
    clave: "visitante",
    titulo: "Jugamos fuera",
    pie: "Se deja en el vestuario local: les damos las gracias por recibirnos.",
  },
  {
    clave: "local",
    titulo: "Jugamos en casa",
    pie: "Se deja en el vestuario visitante: les damos la bienvenida.",
  },
];

export function NotasVestuario({
  condicion,
}: {
  /** Cómo se juega el partido elegido arriba, para abrir la nota que toca. */
  condicion?: "local" | "visitante";
}) {
  const { value, setValue } = useRemoteDoc<NotasGuardadas>({
    key: "notas-vestuario",
    kind: "general",
    fallback: VACIO,
  });

  const [abierta, setAbierta] = useState<ClaveNota | null>(null);

  /*
  | Manda el partido que se esté preparando: si se viaja, la que sale es la de
  | agradecimiento. Sólo hasta que alguien toque una pestaña, claro —a partir
  | de ahí manda la mano.
  */
  const clave: ClaveNota = abierta ?? condicion ?? "visitante";

  const nota: NotaVestuario = useMemo(() => {
    const original = NOTAS_ORIGINALES[clave];
    const guardada = value?.[clave];

    return {
      destinatario: original.destinatario,
      texto: guardada?.texto ?? original.texto,
      cierre: guardada?.cierre ?? original.cierre,
    };
  }, [clave, value]);

  const original = NOTAS_ORIGINALES[clave];

  const tocada =
    nota.texto !== original.texto || nota.cierre !== original.cierre;

  /*
  | Se guarda lo que dice la nota entera, no sólo el campo tocado: así lo
  | guardado se lee solo, sin tener que volver a cruzarlo con el original.
  */
  const escribe = (parche: { texto?: string; cierre?: string }) =>
    setValue((actual) => ({
      ...actual,
      [clave]: { texto: nota.texto, cierre: nota.cierre, ...parche },
    }));

  /* ------------------------------ VISTA ------------------------------ */

  const [vista, setVista] = useState("");

  useEffect(() => {
    let cancelado = false;

    const pinta = async () => {
      try {
        /* La misma hoja a escala: es el A4 con el lado corto en 420 px. */
        const canvas = await dibujaNota(nota, 420, 594);

        if (!cancelado) setVista(canvas.toDataURL("image/png"));
      } catch (error) {
        console.error("[NotasVestuario] vista previa", error);
      }
    };

    void pinta();

    return () => {
      cancelado = true;
    };
  }, [nota]);

  /* ---------------------------- DESCARGAS ---------------------------- */

  const [ocupado, setOcupado] = useState<"pdf" | "pptx" | null>(null);

  const descarga = async (formato: "pdf" | "pptx") => {
    setOcupado(formato);

    try {
      const nombre =
        formato === "pdf"
          ? await exportNotaPdf(clave, nota)
          : await exportNotaPptx(clave, nota);

      toast.success("Nota descargada", { description: nombre });
    } catch (error) {
      console.error("[NotasVestuario] descarga", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "No se ha podido generar el documento.",
      );
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Panel
      title="Nota para el vestuario del rival"
      subtitle="La hoja que se deja sobre un banco. No lleva rival ni fecha: se imprime y se deja"
      icon={Handshake}
    >
      {/* ===================== QUÉ NOTA ===================== */}

      <div className="flex flex-wrap gap-2">
        {PESTANAS.map((pestana) => (
          <Button
            key={pestana.clave}
            tone={clave === pestana.clave ? "primary" : "ghost"}
            onClick={() => setAbierta(pestana.clave)}
          >
            {pestana.titulo}
          </Button>
        ))}
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-white/45">
        {PESTANAS.find((pestana) => pestana.clave === clave)?.pie}
      </p>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        {/* ===================== EL TEXTO ===================== */}

        <div className="min-w-0">
          <TextArea
            label="Texto de la nota"
            value={nota.texto}
            onChange={(valor) => escribe({ texto: valor })}
            rows={8}
            placeholder={original.texto}
          />

          <p className="mt-1.5 text-[11px] leading-relaxed text-white/35">
            Escribe seguido: los renglones los parte la hoja según el formato.
            Una línea en blanco separa dos párrafos.
          </p>

          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
            <Field
              label="Cierre"
              value={nota.cierre}
              onChange={(valor) => escribe({ cierre: valor })}
              placeholder={original.cierre}
              hint="Va en grande y en verde, debajo del texto. Es lo que se lee de lejos."
            />

            <div className="flex items-end">
              <Button
                icon={RotateCcw}
                disabled={!tocada}
                onClick={() => {
                  setValue((actual) => ({ ...actual, [clave]: undefined }));

                  toast.success("Nota devuelta al texto original");
                }}
                title="Vuelve a lo que decía la nota de fábrica"
              >
                Volver al original
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              icon={FileText}
              tone="primary"
              disabled={ocupado !== null}
              onClick={() => descarga("pdf")}
            >
              {ocupado === "pdf" ? "Generando…" : "PDF · A4 para imprimir"}
            </Button>

            <Button
              icon={Presentation}
              disabled={ocupado !== null}
              onClick={() => descarga("pptx")}
            >
              {ocupado === "pptx" ? "Generando…" : "PPT · diapositiva"}
            </Button>
          </div>

          <p className="mt-2 text-[11px] text-white/30">
            Se descarga como <code>{ARCHIVO[clave]}</code>.
          </p>
        </div>

        {/* ==================== CÓMO QUEDA ==================== */}

        <div className="min-w-0 lg:w-[240px]">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
            Cómo va a quedar
          </span>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#11161C] p-2">
            {vista ? (
              /* Es un lienzo, no una maquetación aparte: lo que se ve aquí es
                 exactamente lo que sale impreso. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vista}
                alt="Vista previa de la nota"
                className="w-full rounded-lg"
              />
            ) : (
              <div className="aspect-[794/1123] w-full animate-pulse rounded-lg bg-white/5" />
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export default NotasVestuario;
