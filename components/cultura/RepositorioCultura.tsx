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

import { useCallback, useMemo, useRef, useState } from "react";
import {
  BookOpen,
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
  }, [pendiente, setValue]);

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
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* =================== LA ESTANTERÍA =================== */}

        <div className="min-w-0 space-y-4">
          <Panel
            title="Documentos"
            subtitle={`${documentos.length} en el repositorio`}
            icon={BookOpen}
            action={
              <SaveState
                status={status}
                localOnly={localOnly}
                savedAt={lastSavedAt}
              />
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

          {/* ==================== SUBIR EL BRUTO ==================== */}

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

          {!previa && (
            <Notice title="Cómo crece la estantería">
              Lo que se sube aquí queda guardado para todo el cuerpo técnico.
              Los documentos publicados en el código no se pueden borrar, pero
              sí corregir: sube uno con el mismo número y título y pisará al
              anterior.
            </Notice>
          )}
        </div>

        {/* ================== EL DOCUMENTO ================== */}

        {aLaVista && (
          <div className="min-w-0 space-y-4">
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
              <Panel
                title={`${documento?.numero} · ${documento?.titulo}`}
                subtitle={documento?.resumen}
                icon={FileText}
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
                <div className="grid gap-3 sm:grid-cols-3">
                  <Dato
                    rotulo="Temporada"
                    valor={documento?.temporada || "—"}
                  />

                  <Dato
                    rotulo="Diapositivas"
                    valor={String(documento?.diapositivas.length ?? 0)}
                  />

                  <Dato
                    rotulo="Origen"
                    valor={documento?.origen ?? "Redactado aquí"}
                  />
                </div>
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
              <div className="space-y-5">
                {aLaVista.diapositivas.map((hoja, indice) => (
                  <div key={indice} className="min-w-0">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/35">
                      {indice + 1} / {aLaVista.diapositivas.length} ·{" "}
                      {(previa ? titulosDocumento(previa) : titulos)[indice]}
                    </p>

                    <div className="overflow-hidden rounded-xl border border-white/10">
                      <Escalado ancho={SLIDE_W} alto={SLIDE_H}>
                        <HojaCultura documento={aLaVista} hoja={hoja} />
                      </Escalado>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

/** Un dato de la ficha del documento: rótulo pequeño, valor legible. */
function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
        {rotulo}
      </p>

      <p className="mt-1 truncate text-sm font-medium text-white/80">{valor}</p>
    </div>
  );
}
