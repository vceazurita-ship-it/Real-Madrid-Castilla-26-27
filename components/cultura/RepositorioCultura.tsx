"use client";

/**
 * La estantería de documentos de cultura, entera: subir el bruto, verlo y
 * sacarlo en PDF y en PowerPoint.
 *
 * Vive en un componente y no en una página porque se abre desde dos sitios: la
 * pantalla de Identidad y Cultura, que es la estantería en sí, y la de
 * Dinámicas y Valores, que es donde el cuerpo técnico trabaja el roadmap y
 * donde tiene a mano el fichero que acaba de redactar. Las dos leen y escriben
 * el mismo repositorio, así que lo que se sube en una aparece en la otra.
 *
 * **Los documentos publicados en el código no se pueden borrar desde aquí.**
 * Se pueden pisar subiendo uno con su mismo identificador —así se corrige una
 * errata sin desplegar— y al borrar el subido vuelve a salir el original.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  FileText,
  FileUp,
  Layers,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Field,
  Notice,
  Panel,
  SaveState,
  TextArea,
} from "@/components/abp/ui";
import { Escalado } from "@/components/cultura/Escalado";
import { ExportaCultura } from "@/components/cultura/ExportaCultura";
import { HojaCultura } from "@/components/cultura/HojaCultura";
import { useAdmin } from "@/hooks/useAdmin";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  CLAVE_CULTURA,
  REPOSITORIO_VACIO,
  TIPO_CULTURA,
  esSubido,
  idDocumento,
  repositorioCompleto,
  siguienteNumero,
  type RepositorioGuardado,
} from "@/lib/cultura/almacen";
import {
  documentoDesdeBruto,
  entradillaPorDefecto,
  leeBruto,
  type BrutoLeido,
  type FichaDocumento,
} from "@/lib/cultura/importa";
import { SLIDE_H, SLIDE_W, titulosDocumento } from "@/lib/cultura/modelo";
import { barlowCondensed } from "@/lib/rivals/portada-font";

/** Lo que hay sobre la mesa mientras se revisa un bruto recién subido. */
type Pendiente = {
  bruto: BrutoLeido;
  ficha: FichaDocumento;
};

export function RepositorioCultura() {
  /* Subir documentos y su explicación son cosa del administrador: el cuerpo
     técnico sólo ve el documento y las descargas. */
  const { admin } = useAdmin();

  const {
    value: guardado,
    setValue,
    status,
    localOnly,
    lastSavedAt,
  } = useRemoteDoc<RepositorioGuardado>({
    key: CLAVE_CULTURA,
    kind: TIPO_CULTURA,
    fallback: REPOSITORIO_VACIO,
  });

  const documentos = useMemo(() => repositorioCompleto(guardado), [guardado]);

  const [abierto, setAbierto] = useState<string | null>(null);

  /* 30/10/2026: en el móvil la vista previa enseña una diapositiva cada vez
     (con flechas y «n / 11») y, al tocarla, se abre a pantalla completa. */
  const [activa, setActiva] = useState(0);
  const [visor, setVisor] = useState<number | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const entrada = useRef<HTMLInputElement>(null);

  const documento =
    documentos.find((item) => item.id === abierto) ?? documentos[0] ?? null;

  const titulos = documento ? titulosDocumento(documento) : [];

  /* ------------------------------------------------------------ subir */

  const leeFichero = useCallback(
    async (fichero: File) => {
      try {
        const bruto = leeBruto(await fichero.text());

        const numero = siguienteNumero(documentos);

        setPendiente({
          bruto,
          ficha: {
            numero,
            titulo: bruto.titulo,
            subtitulo: bruto.subtitulo,
            resumen: `Documento de cultura con ${bruto.valores.length} valores, subido desde «${fichero.name}».`,
            temporada: bruto.temporada,
            entradilla: entradillaPorDefecto(bruto.valores.length),
            /* El nombre con el que circulará por el vestuario: el del bruto,
               que es el que el cuerpo técnico ya reconoce. */
            archivo: fichero.name.replace(/\.[^.]+$/, ""),
            origen: fichero.name,
          },
        });

        toast.success(
          `Leídos ${bruto.valores.length} valores` +
            (bruto.descartadas > 0
              ? ` · ${bruto.descartadas} diapositivas sin entender`
              : ""),
        );
      } catch (error) {
        console.error("[cultura] lectura del bruto", error);

        toast.error(
          error instanceof Error
            ? error.message
            : "No se ha podido leer el fichero.",
        );
      }
    },
    [documentos],
  );

  const alSoltar = useCallback(
    (evento: React.DragEvent) => {
      evento.preventDefault();

      const fichero = evento.dataTransfer.files?.[0];

      if (fichero) void leeFichero(fichero);
    },
    [leeFichero],
  );

  /* ----------------------------------------------------------- guardar */

  const publica = useCallback(() => {
    if (!pendiente) return;

    const { bruto, ficha } = pendiente;

    if (!ficha.titulo.trim()) {
      toast.error("El documento necesita un título.");
      return;
    }

    const id = idDocumento(ficha.numero, ficha.titulo);

    /*
    | Mismo número y título que uno que ya está: lo pisa. Es a propósito —así se
    | corrige una errata—, pero se hacía sin decir nada y un número repetido
    | por despiste se llevaba el documento anterior (19/10/2026).
    */
    const yaEsta = documentos.find((doc) => doc.id === id);

    if (
      yaEsta &&
      !window.confirm(
        `Ya hay un documento «${yaEsta.numero} · ${yaEsta.titulo}». ¿Sustituirlo por éste? Si sólo querías añadir otro, cambia el número.`,
      )
    ) {
      return;
    }

    const nuevo = documentoDesdeBruto(bruto, ficha, id);

    setValue((actual) => ({
      documentos: [
        ...(actual?.documentos ?? []).filter((doc) => doc.id !== id),
        nuevo,
      ],
    }));

    setAbierto(id);
    setPendiente(null);

    toast.success(
      `«${nuevo.titulo}» publicado · ${nuevo.diapositivas.length} diapositivas`,
    );
  }, [pendiente, setValue, documentos]);

  const borra = useCallback(
    (id: string, titulo: string) => {
      if (
        !window.confirm(
          `¿Quitar «${titulo}» del repositorio? El PDF y el PowerPoint que ya se hayan descargado no se tocan.`,
        )
      ) {
        return;
      }

      setValue((actual) => ({
        documentos: (actual?.documentos ?? []).filter((doc) => doc.id !== id),
      }));

      setAbierto(null);

      toast.success("Documento quitado del repositorio");
    },
    [setValue],
  );

  const cambiaFicha = (campo: keyof FichaDocumento, valor: string) =>
    setPendiente((actual) =>
      actual ? { ...actual, ficha: { ...actual.ficha, [campo]: valor } } : actual,
    );

  /* ------------------------------------------------------------ vista */

  /* La previa del bruto, para verlo antes de publicarlo. */
  const previa = useMemo(() => {
    if (!pendiente) return null;

    return documentoDesdeBruto(pendiente.bruto, pendiente.ficha, "previa");
  }, [pendiente]);

  const aLaVista = previa ?? documento;

  const totalHojas = aLaVista?.diapositivas.length ?? 0;

  /* Al cambiar de documento la diapositiva activa puede no existir: se acota
     al pintar, sin efecto que corrija el estado. */
  const hojaActiva = Math.min(activa, Math.max(0, totalHojas - 1));

  /*
  | 30/10/2026: la lista de documentos sólo sale si hay más de uno o para el
  | administrador. Con un documento repetía el título y la descripción que ya
  | dicen la cabecera de la pantalla y la ficha.
  */
  const conEstanteria = admin === true || documentos.length > 1;

  return (
    <div
      className="min-w-0"
      style={
        {
          /* Sólo las diapositivas van en Barlow Condensed: el cromo oscuro de
             la app conserva su tipografía. */
          "--fuente-cultura": barlowCondensed.style.fontFamily,
        } as React.CSSProperties
      }
    >
      <div
        className={`grid min-w-0 gap-4 ${
          conEstanteria ? "lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]" : ""
        }`}
      >
        {/* =================== LA ESTANTERÍA =================== */}

        {/* 29/10/2026: en el móvil el cuerpo técnico quiere el documento, no la
            subida; la columna se disuelve (contents) y el orden pone la lista,
            el documento y, al final, lo que sólo toca al administrador. */}
        {conEstanteria && (
        <div className="min-w-0 space-y-4 max-lg:contents">
          <div className="min-w-0 max-lg:order-1">
          {/* 30/10/2026: sin «N en el repositorio» y con el estado de guardado
              sólo para el administrador, que es el único que escribe aquí. */}
          <Panel
            title="Documentos"
            icon={BookOpen}
            action={
              admin === true ? (
                <SaveState
                  status={status}
                  localOnly={localOnly}
                  savedAt={lastSavedAt}
                />
              ) : undefined
            }
            bodyClassName="p-3 sm:p-3"
          >
            <ul className="space-y-2">
              {documentos.map((item) => {
                const activo = !previa && item.id === documento?.id;
                const subido = esSubido(item, guardado);

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        /* Con un bruto a medio revisar, abrir otro documento
                           lo tiraba con lo retocado en la ficha (19/10/2026). */
                        if (
                          pendiente &&
                          !window.confirm(
                            "Hay un documento subido sin publicar. ¿Descartarlo y abrir éste?",
                          )
                        ) {
                          return;
                        }

                        setPendiente(null);
                        setAbierto(item.id);
                      }}
                      className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                        activo
                          ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.08]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/25"
                      }`}
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="text-[11px] font-semibold tracking-[0.2em] text-[#C8A96B]">
                          {item.numero}
                        </span>

                        <span className="min-w-0 truncate text-sm font-semibold text-white">
                          {item.titulo}
                        </span>

                        {subido && (
                          <span className="ml-auto shrink-0 text-[9px] uppercase tracking-[0.14em] text-emerald-300/70">
                            Subido
                          </span>
                        )}
                      </span>

                      <span className="mt-1 block text-[11px] leading-snug text-white/45">
                        {item.subtitulo || item.resumen}
                      </span>

                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {item.etiquetas.map((etiqueta) => (
                          <span
                            key={etiqueta}
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/40"
                          >
                            {etiqueta}
                          </span>
                        ))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
          </div>

          {/* ==================== SUBIR EL BRUTO ==================== */}

          {admin === true && (
          <div className="min-w-0 max-lg:order-3">
          <Panel
            title="Subir el bruto"
            subtitle="El HTML de la presentación, tal y como se redactó"
            icon={FileUp}
          >
            <div
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={alSoltar}
              className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center transition hover:border-[#C8A96B]/40"
            >
              <Upload size={18} className="mx-auto text-white/30" />

              <p className="mt-2 text-xs leading-relaxed text-white/45">
                Suelta aquí el fichero <code className="text-white/70">.html</code>{" "}
                del documento, o búscalo.
              </p>

              <div className="mt-3 flex justify-center">
                <Button
                  tone="primary"
                  icon={FileUp}
                  onClick={() => entrada.current?.click()}
                >
                  Elegir el fichero
                </Button>
              </div>

              <input
                ref={entrada}
                type="file"
                accept=".html,.htm,text/html"
                className="hidden"
                onChange={(evento) => {
                  const fichero = evento.target.files?.[0];

                  if (fichero) void leeFichero(fichero);

                  /* Para que subir dos veces el mismo fichero vuelva a
                     disparar el `change`. */
                  evento.target.value = "";
                }}
              />
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-white/35">
              Se leen las diapositivas del bruto —el valor de cada portada y las
              conductas de cada tarjeta—, se quitan las marcas{" "}
              <code>[cite: …]</code> y el «INADMISIBLE:» de cabeza, y el
              documento se redibuja con la plantilla del club. El texto no se
              retoca.
            </p>
          </Panel>
          </div>
          )}

          {admin === true && !previa && (
            <div className="min-w-0 max-lg:order-3">
            <Notice title="Cómo crece la estantería">
              Lo que se sube aquí queda guardado para todo el cuerpo técnico.
              Los documentos publicados en el código no se pueden borrar, pero
              sí corregir: sube uno con el mismo número y título y pisará al
              anterior.
            </Notice>
            </div>
          )}
        </div>
        )}

        {/* ================== EL DOCUMENTO ================== */}

        {aLaVista && (
          <div className="min-w-0 space-y-4 max-lg:order-2">
            {previa ? (
              <Panel
                title="Revisar antes de publicar"
                subtitle={`${pendiente?.bruto.valores.length ?? 0} valores leídos del bruto · ${previa.diapositivas.length} diapositivas`}
                icon={FileText}
                action={
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setPendiente(null)}>Descartar</Button>

                    <Button tone="primary" icon={BookOpen} onClick={publica}>
                      Publicar en el repositorio
                    </Button>
                  </div>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Número"
                    value={pendiente?.ficha.numero ?? ""}
                    onChange={(valor) => cambiaFicha("numero", valor)}
                    hint="Ordena la estantería y encabeza el nombre del fichero."
                  />

                  <Field
                    label="Temporada"
                    value={pendiente?.ficha.temporada ?? ""}
                    onChange={(valor) => cambiaFicha("temporada", valor)}
                    placeholder="26 / 27"
                  />

                  <Field
                    label="Título"
                    value={pendiente?.ficha.titulo ?? ""}
                    onChange={(valor) => cambiaFicha("titulo", valor)}
                  />

                  <Field
                    label="Subtítulo"
                    value={pendiente?.ficha.subtitulo ?? ""}
                    onChange={(valor) => cambiaFicha("subtitulo", valor)}
                    placeholder="Lo que nos define y lo que no se admite"
                  />

                  <Field
                    label="Nombre del fichero"
                    value={pendiente?.ficha.archivo ?? ""}
                    onChange={(valor) => cambiaFicha("archivo", valor)}
                    hint="Sin extensión: así se llamarán el PDF y el PowerPoint."
                  />

                  <Field
                    label="Resumen"
                    value={pendiente?.ficha.resumen ?? ""}
                    onChange={(valor) => cambiaFicha("resumen", valor)}
                  />
                </div>

                <div className="mt-3">
                  <TextArea
                    label="Entradilla de la portada"
                    value={pendiente?.ficha.entradilla ?? ""}
                    onChange={(valor) => cambiaFicha("entradilla", valor)}
                    rows={3}
                  />

                  <p className="mt-1 text-[10px] text-white/30">
                    Lo que va entre dobles asteriscos se pinta en verde y en
                    negrita.
                  </p>
                </div>

                {(pendiente?.bruto.descartadas ?? 0) > 0 && (
                  <div className="mt-3">
                    <Notice tone="warn" title="Hay diapositivas sin entender">
                      {pendiente?.bruto.descartadas} diapositivas del bruto no
                      tienen ni portada de valor ni tarjetas de conductas, así
                      que se han dejado fuera. Revisa la vista previa antes de
                      publicar.
                    </Notice>
                  </div>
                )}
              </Panel>
            ) : (
              /* 30/10/2026: la ficha deja las cajas TEMPORADA / DIAPOSITIVAS /
                 ORIGEN, que parecían campos de formulario, y lo dice en una
                 línea. La ruta del fichero sólo la ve el administrador. */
              <Panel
                title={`${documento?.numero} · ${documento?.titulo}`}
                subtitle={[
                  documento?.temporada && `Temporada ${documento.temporada}`,
                  `${documento?.diapositivas.length ?? 0} diapositivas`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                icon={FileText}
                bodyClassName={admin === true ? undefined : "hidden"}
                action={
                  documento &&
                  esSubido(documento, guardado) && (
                    <Button
                      tone="danger"
                      icon={Trash2}
                      onClick={() => borra(documento.id, documento.titulo)}
                    >
                      Quitar
                    </Button>
                  )
                }
              >
                {admin === true && (
                  <p className="truncate text-xs text-white/45">
                    Origen: {documento?.origen ?? "Redactado aquí"}
                  </p>
                )}
              </Panel>
            )}

            {/* Del bruto sin publicar también se puede sacar el documento:
                a veces se quiere el PDF para leerlo antes de decidir. */}
            <ExportaCultura documento={aLaVista} />

            <Panel
              title="Vista previa"
              subtitle="El documento a tamaño real, escalado a la columna: es el mismo dibujo que se descarga"
              icon={Layers}
            >
              {/* En el móvil, una diapositiva cada vez con flechas. */}
              {totalHojas > 1 && (
                <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setActiva(Math.max(0, hojaActiva - 1))}
                    disabled={hojaActiva === 0}
                    aria-label="Diapositiva anterior"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 text-white/80 disabled:opacity-30"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <p className="text-sm tabular-nums text-white/70">
                    {hojaActiva + 1} / {totalHojas}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setActiva(Math.min(totalHojas - 1, hojaActiva + 1))
                    }
                    disabled={hojaActiva >= totalHojas - 1}
                    aria-label="Diapositiva siguiente"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 text-white/80 disabled:opacity-30"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}

              <div className="space-y-5">
                {aLaVista.diapositivas.map((hoja, indice) => (
                  <div
                    key={indice}
                    className={`min-w-0 ${indice === hojaActiva ? "" : "max-lg:hidden"}`}
                  >
                    <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/35">
                      {indice + 1} / {aLaVista.diapositivas.length} ·{" "}
                      {(previa ? titulosDocumento(previa) : titulos)[indice]}
                    </p>

                    <button
                      type="button"
                      onClick={() => setVisor(indice)}
                      aria-label={`Abrir la diapositiva ${indice + 1} a pantalla completa`}
                      className="group relative block w-full overflow-hidden rounded-xl border border-white/10 text-left"
                    >
                      <Escalado ancho={SLIDE_W} alto={SLIDE_H}>
                        <HojaCultura documento={aLaVista} hoja={hoja} />
                      </Escalado>

                      <span
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-white opacity-80 transition group-hover:opacity-100"
                        style={{ background: "rgba(0,0,0,0.55)" }}
                      >
                        <Maximize2 size={15} />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </Panel>

            {visor !== null && visor < totalHojas && (
              <VisorCultura
                indice={visor}
                total={totalHojas}
                onCambia={(n) => {
                  setVisor(n);
                  setActiva(n);
                }}
                onCierra={() => setVisor(null)}
              >
                <HojaCultura
                  documento={aLaVista}
                  hoja={aLaVista.diapositivas[visor]}
                />
              </VisorCultura>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| VISOR A PANTALLA COMPLETA (30/10/2026)
|--------------------------------------------------------------------------
|
| A 390 px una diapositiva de 1920×1080 no se lee. El visor reutiliza el
| mismo dibujo (`HojaCultura` dentro de `Escalado`) y, con el teléfono en
| vertical, lo gira para que ocupe el alto de la pantalla. Se pasa deslizando,
| con las flechas o con el teclado; Escape cierra. Lleva `modal-veil` para
| que los botones flotantes se escondan mientras está abierto.
*/
function VisorCultura({
  indice,
  total,
  onCambia,
  onCierra,
  children,
}: {
  indice: number;
  total: number;
  onCambia: (n: number) => void;
  onCierra: () => void;
  children: React.ReactNode;
}) {
  const inicio = useRef<{ x: number; y: number } | null>(null);

  const anterior = useCallback(
    () => indice > 0 && onCambia(indice - 1),
    [indice, onCambia],
  );
  const siguiente = useCallback(
    () => indice < total - 1 && onCambia(indice + 1),
    [indice, total, onCambia],
  );

  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCierra();
      else if (evento.key === "ArrowLeft" || evento.key === "ArrowUp") anterior();
      else if (evento.key === "ArrowRight" || evento.key === "ArrowDown") siguiente();
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [anterior, siguiente, onCierra]);

  const boton =
    "absolute z-10 flex h-11 w-11 items-center justify-center rounded-full text-white disabled:opacity-30";
  const fondoBoton = { background: "rgba(255,255,255,0.12)" };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Diapositiva ${indice + 1} de ${total}`}
      className="modal-veil siempre-oscuro fixed inset-0 z-[80] flex items-center justify-center overflow-hidden"
      style={{ background: "#000" }}
      onTouchStart={(evento) => {
        const toque = evento.touches[0];
        inicio.current = { x: toque.clientX, y: toque.clientY };
      }}
      onTouchEnd={(evento) => {
        const desde = inicio.current;
        const toque = evento.changedTouches[0];

        inicio.current = null;

        if (!desde) return;

        const dx = toque.clientX - desde.x;
        const dy = toque.clientY - desde.y;

        /* Girada en vertical, el «siguiente» del dibujo va hacia abajo: vale
           deslizar en el eje que más se haya movido. */
        const d = Math.abs(dx) > Math.abs(dy) ? dx : -dy;

        if (Math.abs(d) < 40) return;

        if (d < 0) siguiente();
        else anterior();
      }}
    >
      <div className="w-[min(100vw,calc(100dvh*16/9))] shrink-0 portrait:w-[min(100dvh,calc(100vw*16/9))] portrait:rotate-90">
        <Escalado ancho={SLIDE_W} alto={SLIDE_H}>
          {children}
        </Escalado>
      </div>

      <button
        type="button"
        onClick={onCierra}
        aria-label="Cerrar"
        className={`${boton} right-3 top-3`}
        style={fondoBoton}
      >
        <X size={20} />
      </button>

      <button
        type="button"
        onClick={anterior}
        disabled={indice === 0}
        aria-label="Diapositiva anterior"
        className={`${boton} bottom-3 left-3`}
        style={fondoBoton}
      >
        <ChevronLeft size={20} />
      </button>

      <p
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-sm tabular-nums"
        style={{ color: "rgba(255,255,255,0.8)" }}
      >
        {indice + 1} / {total}
      </p>

      <button
        type="button"
        onClick={siguiente}
        disabled={indice >= total - 1}
        aria-label="Diapositiva siguiente"
        className={`${boton} bottom-3 right-3`}
        style={fondoBoton}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
