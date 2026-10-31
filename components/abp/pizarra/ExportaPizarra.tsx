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
 * Como la página monta sólo la diapositiva activa, al exportar se levanta el
 * tablero entero fuera de la pantalla, a tamaño de plantilla y sin escalar, y
 * se fotografía diapositiva a diapositiva. La maquinaria —esperas, captura y
 * PDF— es la de `lib/export/lienzos.ts`, compartida con el dossier de
 * desplazamiento.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FileDown, MonitorPlay, Printer } from "lucide-react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { Button, Panel } from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import {
  COLORES,
  TABLERO_H,
  TABLERO_W,
  tituloVisible,
  type SlidePizarra,
} from "@/lib/abp/pizarra";
import { creaPptx } from "@/lib/export/pptx";
import {
  apodo,
  capturaLienzos,
  descarga,
  esperaFotos,
  pdfDeLienzos,
  pintado,
} from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";
import { fasesDe } from "@/lib/abp/trazos";
import { enMarcha, trabajoExportar } from "@/lib/abp/trabajo-exportar";

type Formato = "pptx" | "pdf";

/**
 * Dónde se está enseñando.
 *
 * `panel` es la caja de siempre, al final de la página, con la explicación de
 * qué sale en cada formato. `barra` son los dos botones a secas, arriba con el
 * resto de acciones: llevarse el PowerPoint es lo último que se hace antes de
 * la charla y estaba a un scroll de distancia, debajo del histórico.
 */
type Variante = "panel" | "barra";

export function ExportaPizarra({
  slides,
  players,
  temporada,
  rival,
  jornada,
  variante = "panel",
  trabajo,
}: {
  /** Montado por el trabajo de segundo plano del layout (31/10/2026): exporta solo y no enseña botones. */
  trabajo?: { id: string; formato: Formato; porFases: boolean };
  slides: SlidePizarra[];
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  jornada?: string;
  variante?: Variante;
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

  const [formato, setFormato] = useState<Formato | null>(trabajo?.formato ?? null);
  const [hechas, setHechas] = useState(0);

  /*
  | «Una hoja por fase»: la jugada contada en orden, como se haría con las
  | animaciones del PowerPoint, pero en hojas que valen también impresas. Cada
  | diapositiva con dos fases o más sale una vez por fase, con las flechas
  | acumuladas hasta ella; las de una sola fase salen como siempre.
  */
  const [porFases, setPorFases] = useState(trabajo?.porFases ?? false);

  const conFases = slides.some((slide) => fasesDe(slide.trazos) > 1);

  const hojas = useMemo(() => slides.flatMap((slide, orden) => {
    const n = fasesDe(slide.trazos);

    /* Dos córneres ofensivos no pueden llamarse igual en la hoja. */
    const visible = tituloVisible(slides, orden);

    if (!porFases || n < 2) {
      return [{ key: slide.id, slide, visible, titulo: visible, hasta: undefined as number | undefined }];
    }

    return Array.from({ length: n }, (_, indice) => ({
      key: `${slide.id}-${indice + 1}`,
      slide,
      visible,
      hasta: indice + 1,
      titulo: `${visible} · fase ${indice + 1} de ${n}`,
    }));
  }), [slides, porFases]);

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

      const imagenes = await capturaLienzos(raiz, "[data-abp-tablero]", {
        ancho: TABLERO_W,
        alto: TABLERO_H,
        fondo: COLORES.tinta,
        alPaso: setHechas,
      });

      if (imagenes.length === 0) throw new Error("No hay diapositivas");

      const titulos = hojas.map((hoja) => hoja.titulo);

      const nombre = `pizarra-abp-${apodo(rival, "pizarra")}${
        jornada ? `-${apodo(jornada)}` : ""
      }`;

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
        const cabecera = [rival || "RMCF Castilla", jornada, new Date().toLocaleDateString("es-ES")]
          .filter(Boolean)
          .join(" · ");

        const doc = await pdfDeLienzos(imagenes, {
          ancho: TABLERO_W,
          alto: TABLERO_H,
          orientacion: "landscape",
          pie: (indice, total) => ({
            izquierda: `${indice + 1}. ${titulos[indice] ?? ""}`.toUpperCase(),
            centro: cabecera,
            derecha: `${indice + 1} / ${total}`,
          }),
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

      if (trabajo) trabajoExportar.termina(trabajo.id);
    }
  }, [formato, jornada, rival, hojas, trabajo]);

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

  /* En la pizarra, lo que se está montando lo sabe el trabajo de segundo plano. */
  const encargado = useSyncExternalStore(trabajoExportar.suscribe, () => enMarcha(trabajoExportar.foto(), "pizarra"), () => undefined);
  const rotulo = useSyncExternalStore(trabajoExportar.suscribe, () => (encargado ? trabajoExportar.foto().rotulos[encargado.id] : undefined), () => undefined);

  useEffect(() => {
    if (trabajo && formato) trabajoExportar.rotula(trabajo.id, `${hechas}/${hojas.length}`);
  }, [trabajo, formato, hechas, hojas.length]);

  const pide = (f: Formato) =>
    trabajoExportar.encarga({ tipo: "pizarra", formato: f, porFases, datos: { slides, players, temporada, rival, jornada } });

  const ocupado = trabajo ? formato !== null : Boolean(encargado);

  const total = hojas.length;

  const botones = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        tone="primary"
        icon={MonitorPlay}
        onClick={() => pide("pptx")}
        disabled={ocupado || total === 0}
        title="Un .pptx con una diapositiva por acción, a 1920×1080"
      >
        {encargado?.formato === "pptx"
          ? `Montando… ${rotulo ?? ""}`
          : "Exportar a PowerPoint"}
      </Button>

      <Button
        icon={Printer}
        onClick={() => pide("pdf")}
        disabled={ocupado || total === 0}
        title="Un PDF A4 apaisado, una diapositiva por hoja"
      >
        {encargado?.formato === "pdf"
          ? `Montando… ${rotulo ?? ""}`
          : "Exportar a PDF"}
      </Button>

      {conFases && (
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-white/65">
          <input
            type="checkbox"
            checked={porFases}
            onChange={(event) => setPorFases(event.target.checked)}
            disabled={ocupado}
            className="h-4 w-4 accent-[#C8A96B]"
          />
          Una hoja por fase ({total} {total === 1 ? "hoja" : "hojas"})
        </label>
      )}
    </div>
  );

  /*
  | El tablero de repuesto es el mismo en las dos variantes, así que va en una
  | constante: sin él no hay nada que fotografiar.
  */
  const deck = trabajo && formato !== null && (
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
      {hojas.map((hoja) => (
        <div key={hoja.key} style={{ width: TABLERO_W }}>
          <TableroSlide
            slide={hoja.slide}
            titulo={hoja.visible}
            hastaFase={hoja.hasta}
            soloVer
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
  );

  if (trabajo) return deck || null;

  if (variante === "barra") {
    return (
      <>
        {botones}
        {deck}
      </>
    );
  }

  return (
    <Panel
      title="Llevárselo a la sala"
      subtitle={`Las ${total} ${total === 1 ? "diapositiva" : "diapositivas"} del tablero, tal y como están: el PowerPoint para proyectar y el PDF para imprimir`}
      icon={FileDown}
    >
      {/* Los botones son los de arriba, en la cabecera de la pizarra: un solo juego. */}
      <p className="text-xs leading-relaxed text-white/40">
        Con «Exportar a PowerPoint» y «Exportar a PDF», arriba, salen las diapositivas enteras
        y en el orden de la tira: el PowerPoint para proyectar en cualquier portátil sin la app y
        el PDF, una hoja por acción, para colgarlo en el vestuario.
      </p>
    </Panel>
  );
}
