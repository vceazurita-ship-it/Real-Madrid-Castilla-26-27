"use client";

/**
 * Llevarse la pizarra: el `.pptx` para la sala y el PDF para imprimir.
 *
 * La pizarra sustituyó al PowerPoint que se montaba a mano, pero el partido
 * sigue necesitando las dos salidas de siempre: el fichero que se proyecta —y
 * que a veces hay que abrir en un portátil sin la app— y el papel que se
 * cuelga en el vestuario y se lleva al banquillo. Aquí salen las dos.
 *
 * **Se exportan TODAS las diapositivas del tablero, no la que se está viendo.**
 * Lo que se enseña en la sala es la charla entera; exportar de una en una era
 * justo el trabajo manual del que se venía huyendo.
 *
 * Cómo se capturan: las diapositivas que no están en pantalla no existen en el
 * DOM —la página monta sólo la activa—, así que al exportar se monta el
 * tablero entero **fuera de la pantalla**, a tamaño de plantilla y sin escalar
 * (1920×1080, escala 1), y se fotografía una por una con `html-to-image`. No
 * vale con esconderlo con `display:none` ni con `visibility`: un nodo sin caja
 * se captura en blanco. Se aparta con posición, que sí conserva el dibujo.
 *
 * Se captura **una sola vez** para los dos formatos, a 1,5× —2880×1620—: es lo
 * que hace falta para que el papel salga a unos 260 ppp en A4 apaisado, y a
 * PowerPoint le sobra (proyecta a 1920). Repetir la captura por formato
 * duplicaría la espera sin que se note en pantalla.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { FileDown, MonitorPlay, Printer } from "lucide-react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { Button, Panel } from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import {
  COLORES,
  TABLERO_H,
  TABLERO_W,
  type SlidePizarra,
} from "@/lib/abp/pizarra";
import { creaPptx } from "@/lib/abp/pptx";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

/** Cuántos píxeles reales por píxel de lienzo. Ver la cabecera del fichero. */
const NITIDEZ = 1.5;

/** Un píxel transparente: lo que se pone donde una foto no se ha podido leer. */
const PIXEL_VACIO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

type Formato = "pptx" | "pdf";

/* ------------------------------------------------------------------ */
/*  NOMBRE DEL FICHERO                                                 */
/* ------------------------------------------------------------------ */

/** "CD Teruel" → "cd-teruel": lo que aguanta cualquier carpeta compartida. */
function apodo(valor: string) {
  return (
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "pizarra"
  );
}

function descarga(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = nombre;

  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  /* El navegador todavía está leyendo el blob cuando vuelve el click. */
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ------------------------------------------------------------------ */
/*  CAPTURA                                                            */
/* ------------------------------------------------------------------ */

/** Espera a que el navegador haya pintado lo que se acaba de montar. */
function pintado() {
  return new Promise<void>((listo) => {
    requestAnimationFrame(() => requestAnimationFrame(() => listo()));
  });
}

/**
 * Espera a que las fotos del tablero estén cargadas.
 *
 * Las caras de la plantilla vienen de Supabase y el campo de `/public`: si se
 * captura antes de tiempo salen huecos donde van los jugadores. Se espera a
 * cada `<img>` con un tope, porque una foto rota no puede dejar colgada la
 * exportación entera.
 */
async function esperaFotos(raiz: HTMLElement) {
  const fotos = Array.from(raiz.querySelectorAll("img"));

  await Promise.all(
    fotos.map(
      (foto) =>
        new Promise<void>((listo) => {
          if (foto.complete) return listo();

          const acaba = () => listo();

          foto.addEventListener("load", acaba, { once: true });
          foto.addEventListener("error", acaba, { once: true });

          setTimeout(acaba, 6_000);
        }),
    ),
  );
}

async function capturaTableros(
  raiz: HTMLElement,
  alPaso: (hechas: number) => void,
) {
  const nodos = Array.from(
    raiz.querySelectorAll<HTMLElement>("[data-abp-tablero]"),
  );

  const htmlToImage = await import("html-to-image");

  const opciones = {
    width: TABLERO_W,
    height: TABLERO_H,
    backgroundColor: COLORES.tinta,
    imagePlaceholder: PIXEL_VACIO,
    quality: 0.92,
    style: {
      margin: "0",
      transform: "none",
      transformOrigin: "top left",
    },
    filter: (nodo: HTMLElement) => {
      if (!(nodo instanceof HTMLElement)) return true;

      /* Los huecos de puesto vacío y las aspas son cromo de edición. */
      return !nodo.hasAttribute("data-export-hide");
    },
  };

  /*
  | Pasada de calentamiento sobre el tablero entero. `html-to-image` se
  | descarga él mismo las imágenes de otro dominio y las guarda en su caché
  | interna; sin esta primera pasada —a resolución ridícula, que es rápida— la
  | captura buena de cada diapositiva sale a veces sin las caras.
  */
  await htmlToImage
    .toJpeg(raiz, { ...opciones, width: undefined, height: undefined, pixelRatio: 0.04 })
    .catch(() => undefined);

  const imagenes: string[] = [];

  for (const nodo of nodos) {
    /* En serie y no en paralelo: siete lienzos de 2880×1620 a la vez tumban
       la pestaña en un portátil del cuerpo técnico. */
    const imagen = await htmlToImage.toJpeg(nodo, {
      ...opciones,
      pixelRatio: NITIDEZ,
    });

    imagenes.push(imagen);

    alPaso(imagenes.length);
  }

  return imagenes;
}

/* ------------------------------------------------------------------ */
/*  EL PDF DE IMPRENTA                                                 */
/* ------------------------------------------------------------------ */

/**
 * Una diapositiva por hoja, A4 apaisado.
 *
 * A4 apaisado es más cuadrado que un 16:9, así que la diapositiva la limita el
 * ancho y sobra alto: se centra y el pie de página se queda debajo, fuera de
 * la imagen, para que se lea igual con la hoja en blanco y negro.
 */
async function creaPdf(
  imagenes: string[],
  datos: { titulos: string[]; rival: string; jornada?: string; fecha: string },
) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const anchoHoja = doc.internal.pageSize.getWidth();
  const altoHoja = doc.internal.pageSize.getHeight();

  const margen = 26;
  const pie = 26;

  const ancho = anchoHoja - margen * 2;
  const escala = Math.min(ancho / TABLERO_W, (altoHoja - margen * 2 - pie) / TABLERO_H);

  const w = TABLERO_W * escala;
  const h = TABLERO_H * escala;

  const x = (anchoHoja - w) / 2;
  const y = (altoHoja - pie - h) / 2;

  const cabecera = [datos.rival, datos.jornada, datos.fecha]
    .filter(Boolean)
    .join(" · ");

  imagenes.forEach((imagen, indice) => {
    if (indice > 0) doc.addPage();

    doc.addImage(imagen, "JPEG", x, y, w, h, `slide${indice}`, "FAST");

    doc.setFontSize(8);
    doc.setTextColor(120);

    doc.text(
      `${indice + 1}. ${datos.titulos[indice] ?? ""}`.toUpperCase(),
      margen,
      altoHoja - 14,
    );

    doc.text(cabecera, anchoHoja / 2, altoHoja - 14, { align: "center" });

    doc.text(`${indice + 1} / ${imagenes.length}`, anchoHoja - margen, altoHoja - 14, {
      align: "right",
    });
  });

  return doc;
}

/* ------------------------------------------------------------------ */
/*  EL PANEL                                                           */
/* ------------------------------------------------------------------ */

export function ExportaPizarra({
  slides,
  players,
  temporada,
  rival,
  jornada,
}: {
  slides: SlidePizarra[];
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  jornada?: string;
}) {
  const deckRef = useRef<HTMLDivElement>(null);

  /*
  | Un cerrojo, no un estado. Mientras se captura, la página puede tocar el
  | tablero por su cuenta —el autoguardado congela una versión sola a los 45 s
  | sin actividad— y eso renueva el array de diapositivas, que es de lo que
  | depende el efecto: sin cerrojo la exportación se lanzaría dos veces y el
  | navegador bajaría dos ficheros.
  */
  const corriendo = useRef(false);

  const [formato, setFormato] = useState<Formato | null>(null);
  const [hechas, setHechas] = useState(0);

  /*
  | El trabajo va en un efecto y no en el `onClick` porque hace falta que React
  | haya montado el tablero de repuesto —el de fuera de pantalla— antes de
  | fotografiarlo. Pulsar sólo enciende la bandera; capturar es lo que pasa
  | después de pintar.
  */
  const exporta = useCallback(async () => {
    const raiz = deckRef.current;

    if (!raiz || !formato || corriendo.current) return;

    corriendo.current = true;

    const aviso = toast.loading(
      formato === "pptx"
        ? "Montando el PowerPoint…"
        : "Montando el PDF para imprimir…",
    );

    try {
      await pintado();
      await esperaFuentePortada();
      await esperaFotos(raiz);

      const imagenes = await capturaTableros(raiz, setHechas);

      if (imagenes.length === 0) throw new Error("No hay diapositivas");

      const titulos = slides.map((slide) => slide.titulo);

      const nombre = `pizarra-abp-${apodo(rival)}${jornada ? `-${apodo(jornada)}` : ""}`;

      if (formato === "pptx") {
        const blob = creaPptx(
          imagenes.map((imagen, indice) => ({
            titulo: titulos[indice] ?? `Diapositiva ${indice + 1}`,
            imagen,
          })),
          {
            titulo: `Balón parado · ${rival || "RMCF Castilla"}`,
            autor: "RMCF Castilla",
          },
        );

        descarga(blob, `${nombre}.pptx`);

        toast.success(
          `PowerPoint listo · ${imagenes.length} ${imagenes.length === 1 ? "diapositiva" : "diapositivas"}`,
          { id: aviso },
        );
      } else {
        const doc = await creaPdf(imagenes, {
          titulos,
          rival: rival || "RMCF Castilla",
          jornada,
          fecha: new Date().toLocaleDateString("es-ES"),
        });

        doc.save(`${nombre}.pdf`);

        toast.success(
          `PDF listo · ${imagenes.length} ${imagenes.length === 1 ? "hoja" : "hojas"} A4 apaisadas`,
          { id: aviso },
        );
      }
    } catch (error) {
      console.error("[abp-pizarra] exportación", error);

      toast.error("No se ha podido exportar la pizarra", { id: aviso });
    } finally {
      corriendo.current = false;

      setFormato(null);
      setHechas(0);
    }
  }, [formato, jornada, rival, slides]);

  useEffect(() => {
    if (!formato) return;

    let vivo = true;

    /* Un respiro para que el tablero de repuesto entre en el DOM. */
    const id = window.setTimeout(() => {
      if (vivo) void exporta();
    }, 60);

    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [exporta, formato]);

  const ocupado = formato !== null;

  const total = slides.length;

  return (
    <Panel
      title="Llevárselo a la sala"
      subtitle={`Las ${total} ${total === 1 ? "diapositiva" : "diapositivas"} del tablero, tal y como están: el PowerPoint para proyectar y el PDF para imprimir`}
      icon={FileDown}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon={MonitorPlay}
          onClick={() => setFormato("pptx")}
          disabled={ocupado || total === 0}
          title="Un .pptx con una diapositiva por acción, a 1920×1080"
        >
          {formato === "pptx"
            ? `Montando… ${hechas}/${total}`
            : "Exportar a PowerPoint"}
        </Button>

        <Button
          icon={Printer}
          onClick={() => setFormato("pdf")}
          disabled={ocupado || total === 0}
          title="Un PDF A4 apaisado, una diapositiva por hoja"
        >
          {formato === "pdf" ? `Montando… ${hechas}/${total}` : "PDF para imprimir"}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/40">
        Salen las diapositivas enteras —campo, chapas, panel de puestos y
        consignas—, no sólo la que estás viendo. El PowerPoint lleva cada acción
        como una imagen a tamaño de proyección: se abre en cualquier portátil
        sin la app. El PDF va a una hoja por acción, con el rival y el número de
        diapositiva al pie, para colgarlo en el vestuario.
      </p>

      {/*
      | El tablero de repuesto: las siete diapositivas montadas a la vez, a
      | tamaño de plantilla y apartadas de la pantalla. Sólo existe mientras
      | dura la exportación. Va marcado para que el botón de exportar de la
      | plataforma no lo recoja si alguien lo pulsa a la vez.
      */}
      {ocupado && (
        <div
          ref={deckRef}
          aria-hidden
          data-export-hide
          className="pointer-events-none"
          style={{
            position: "fixed",
            top: 0,
            left: -(TABLERO_W + 200),
            width: TABLERO_W,
            zIndex: -1,
          }}
        >
          {slides.map((slide) => (
            <div key={slide.id} style={{ width: TABLERO_W }}>
              <TableroSlide
                slide={slide}
                players={players}
                temporada={temporada}
                rival={rival}
                seleccion={null}
                onMover={() => undefined}
                onQuitar={() => undefined}
                onPulsarPuesto={() => undefined}
                onSeleccionar={() => undefined}
              />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
