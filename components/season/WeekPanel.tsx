"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  FileText,
  ImageIcon,
  Loader2,
  Maximize2,
  Scan,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { CambioSemana } from "@/lib/season/fusion";
import { SeasonArea, WeekData } from "@/lib/season/types";
import { AREA_CONFIG } from "@/lib/season/config";
import { deleteSeasonFile, uploadSeasonFile } from "@/lib/season/api";
import {
  humanFileName,
  weekRangeLabel,
} from "@/lib/season/utils";
import ConfirmDialog from "./ConfirmDialog";
import ImageGrid from "./ImageGrid";
import Lightbox from "./Lightbox";
import PdfCard from "./PdfCard";
import UploadZone from "./UploadZone";

type Tab = "images" | "pdfs" | "upload";

interface Props {
  area: SeasonArea;
  week: WeekData | null;
  isCurrentWeek: boolean;
  /** Semana anterior más reciente con archivos, para no dejar el hueco vacío. */
  ultimaConArchivos?: WeekData | null;
  onSelectWeek?: (weekId: number) => void;
  /** Sólo lo que cambia: el servidor lo aplica sobre lo último guardado. */
  onUpdateWeek: (cambio: CambioSemana) => Promise<void>;
}

export default function WeekPanel({
  area,
  week,
  isCurrentWeek,
  ultimaConArchivos,
  onSelectWeek,
  onUpdateWeek,
}: Props) {
  /* Se abre en la pestaña que tiene contenido; si la semana está vacía, en
     «Imágenes», con lo último subido a la vista y «Subir» a un botón de
     distancia: el cuerpo técnico entra a consultar antes que a subir. */
  const [tabElegida, setTab] = useState<Tab>(
    (week?.images?.length ?? 0) > 0
      ? "images"
      : (week?.pdfs?.length ?? 0) > 0
        ? "pdfs"
        : "images"
  );
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState<"images" | "pdfs" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "images" | "pdfs";
    url: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const images = useMemo(() => week?.images ?? [], [week]);
  const pdfs = useMemo(() => week?.pdfs ?? [], [week]);

  /* 29/10/2026: una semana sin nada no enseña pestañas vacías ni rótulos de
     hueco: sólo «Subir» y, si lo hay, lo último subido. Con material, se
     ocultan las pestañas sin archivos. */
  const vacia = images.length + pdfs.length === 0;

  const visibles: Tab[] = vacia
    ? ["upload"]
    : [
        ...(images.length > 0 ? (["images"] as Tab[]) : []),
        ...(pdfs.length > 0 ? (["pdfs"] as Tab[]) : []),
        "upload",
      ];

  const tab: Tab = visibles.includes(tabElegida) ? tabElegida : visibles[0];

  const hayUltimo =
    vacia &&
    !!ultimaConArchivos &&
    !!onSelectWeek &&
    (ultimaConArchivos.images.length + (ultimaConArchivos.pdfs ?? []).length) > 0;

  // Al cambiar de semana volvemos a la pestaña con contenido más relevante.
  // Se ajusta durante el render para no encadenar un repintado extra.
  const [lastWeekId, setLastWeekId] = useState(week?.id ?? null);

  if (week && week.id !== lastWeekId) {
    setLastWeekId(week.id);
    setLightboxIndex(null);

    setTab(
      (week.images?.length ?? 0) > 0
        ? "images"
        : (week.pdfs?.length ?? 0) > 0
          ? "pdfs"
          : "images"
    );
  }

  if (!week) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#11161D] p-8">
        <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
          <CalendarDays size={44} className="mb-5 text-[#C8A96B]" />

          <h2 className="text-2xl font-semibold">Selecciona una semana</h2>

          <p className="mt-3 max-w-md leading-7 text-white/50">
            Elige cualquier semana del listado para ver sus imágenes, sus
            documentos y subir archivos nuevos.
          </p>
        </div>
      </div>
    );
  }

  const folder = (kind: "images" | "pdf") =>
    `${AREA_CONFIG[area].storagePrefix}/semana-${week.id
      .toString()
      .padStart(2, "0")}/${kind}`;

  const handleUpload = async (
    kind: "images" | "pdfs",
    files: File[]
  ) => {
    setUploading(kind);

    const label = kind === "images" ? "imagen" : "PDF";

    const toastId = toast.loading(
      `Subiendo ${files.length} ${label}${files.length > 1 ? "s" : ""}...`
    );

    try {
      const results = await Promise.allSettled(
        files.map((file) =>
          uploadSeasonFile(
            area,
            file,
            folder(kind === "images" ? "images" : "pdf")
          )
        )
      );

      const uploaded = results
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value);

      const failed = results.length - uploaded.length;

      if (uploaded.length > 0) {
        try {
          await onUpdateWeek({ weekId: week.id, anade: { [kind]: uploaded } });
        } catch {
          // El error de guardado ya se notifica al revertir el estado.
          toast.dismiss(toastId);
          return;
        }

        setTab(kind);
      }

      if (failed === 0) {
        toast.success(
          `${uploaded.length} ${label}${uploaded.length > 1 ? "s" : ""} en ${week.week}`,
          { id: toastId }
        );
      } else if (uploaded.length === 0) {
        toast.error("No se pudo subir ningún archivo.", { id: toastId });
      } else {
        toast.warning(
          `${uploaded.length} subidos · ${failed} con error.`,
          { id: toastId }
        );
      }
    } catch (error) {
      console.error(error);
      toast.error("Error subiendo los archivos.", { id: toastId });
    } finally {
      setUploading(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setDeleting(true);

    try {
      await deleteSeasonFile(area, pendingDelete.url);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar el archivo.");
      setDeleting(false);
      return;
    }

    try {
      await onUpdateWeek({
        weekId: week.id,
        quita: { [pendingDelete.kind]: [pendingDelete.url] },
      });

      toast.success("Archivo eliminado.");
      setPendingDelete(null);
    } catch {
      // El error de guardado ya se notifica al revertir el estado.
    } finally {
      setDeleting(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] =
    [
      {
        id: "images",
        label: "Imágenes",
        icon: <ImageIcon size={16} />,
        count: images.length,
      },
      {
        id: "pdfs",
        label: "PDFs",
        icon: <FileText size={16} />,
        count: pdfs.length,
      },
      { id: "upload", label: "Subir", icon: <UploadCloud size={16} /> },
    ];

  const pestanas = tabs.filter((item) => visibles.includes(item.id));

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#11161D]">
      {/* CABECERA */}

      <div className="border-b border-white/10 px-6 pt-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              {week.month}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold sm:text-3xl">
                {week.week}
              </h2>

              {isCurrentWeek && (
                <span className="rounded-full bg-[#C8A96B] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0B0F14]">
                  Semana actual
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-white/50">
              {weekRangeLabel(week)}
            </p>
          </div>

          {images.length + pdfs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/50">
              {images.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5">
                  <ImageIcon size={15} className="text-[#C8A96B]" />
                  <span className="tabular-nums">{images.length}</span>{" "}
                  {images.length === 1 ? "imagen" : "imágenes"}
                </span>
              )}

              {pdfs.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5">
                  <FileText size={15} className="text-[#C8A96B]" />
                  <span className="tabular-nums">{pdfs.length}</span>{" "}
                  {pdfs.length === 1 ? "PDF" : "PDFs"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* PESTAÑAS */}

        <div className="-mb-px mt-6 flex gap-1 overflow-x-auto">
          {pestanas.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition sm:px-4 ${
                tab === item.id
                  ? "border-[#C8A96B] text-white"
                  : "border-transparent text-white/45 hover:text-white/80"
              }`}
            >
              {/* Sin icono en el móvil: con él, «Subir» se salía de la caja. */}
              <span className="hidden sm:inline-flex">{item.icon}</span>
              {item.label}

              {item.count !== undefined && item.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    tab === item.id
                      ? "bg-[#C8A96B]/20 text-[#C8A96B]"
                      : "bg-white/5 text-white/40"
                  }`}
                >
                  {item.count}
                </span>
              )}

              {uploading === item.id && (
                <Loader2 size={13} className="animate-spin text-[#C8A96B]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENIDO */}

      <div className="p-6 sm:p-8">
        {hayUltimo && ultimaConArchivos && onSelectWeek && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-3 text-xs uppercase tracking-wider text-white/45">
              Lo último subido · {ultimaConArchivos.week}
              {(ultimaConArchivos.start || ultimaConArchivos.end) && ` · ${weekRangeLabel(ultimaConArchivos)}`}
              {" · "}
              {[
                ultimaConArchivos.images.length > 0 &&
                  `${ultimaConArchivos.images.length} ${ultimaConArchivos.images.length === 1 ? "imagen" : "imágenes"}`,
                (ultimaConArchivos.pdfs ?? []).length > 0 &&
                  `${(ultimaConArchivos.pdfs ?? []).length} ${(ultimaConArchivos.pdfs ?? []).length === 1 ? "PDF" : "PDFs"}`,
              ]
                .filter(Boolean)
                .join(" y ")}
            </p>

            {(ultimaConArchivos.pdfs ?? []).length > 0 && (
              <ul className="space-y-1.5">
                {(ultimaConArchivos.pdfs ?? []).slice(-3).map((url) => (
                  <li key={url} className="min-w-0">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-2 text-sm text-[#C8A96B] underline-offset-4 hover:underline"
                    >
                      <FileText size={14} className="shrink-0" />
                      <span className="truncate">{humanFileName(url, "Documento")}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => onSelectWeek(ultimaConArchivos.id)}
              className="mt-3 text-sm text-[#C8A96B] underline-offset-4 hover:underline"
            >
              Abrir la {ultimaConArchivos.week.toLowerCase()} entera
            </button>
          </div>
        )}

        {tab === "images" &&
          (images.length === 0 ? (
            <EmptyState
              icon={<ImageIcon size={34} />}
              title="Sin imágenes en esta semana"
              action="Subir imágenes"
              compacto={hayUltimo}
              onAction={() => setTab("upload")}
            />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm text-white/50">
                  {images.length} {images.length > 1 ? "imágenes" : "imagen"}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setFit((value) =>
                      value === "contain" ? "cover" : "contain"
                    )
                  }
                  title={
                    fit === "contain"
                      ? "Rellenar la miniatura (recorta)"
                      : "Mostrar la imagen completa"
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                >
                  {fit === "contain" ? (
                    <Maximize2 size={14} />
                  ) : (
                    <Scan size={14} />
                  )}
                  {fit === "contain" ? "Rellenar" : "Ajustar"}
                </button>
              </div>

              <ImageGrid
                items={images.map((url, i) => ({
                  url,
                  caption: humanFileName(url, `Imagen ${i + 1}`),
                }))}
                fit={fit}
                onOpen={setLightboxIndex}
                onDelete={(index) =>
                  setPendingDelete({ kind: "images", url: images[index] })
                }
              />
            </>
          ))}

        {tab === "pdfs" &&
          (pdfs.length === 0 ? (
            <EmptyState
              icon={<FileText size={34} />}
              title="Sin documentos en esta semana"
              action="Subir PDFs"
              compacto={hayUltimo}
              onAction={() => setTab("upload")}
            />
          ) : (
            <div className="space-y-4">
              {pdfs.map((url, index) => (
                <PdfCard
                  key={`${url}-${index}`}
                  url={url}
                  defaultOpen={index === 0}
                  onDelete={() => setPendingDelete({ kind: "pdfs", url })}
                />
              ))}
            </div>
          ))}

        {tab === "upload" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <UploadZone
              type="images"
              maxFiles={20}
              busy={uploading === "images"}
              onUpload={(files) => handleUpload("images", files)}
            />

            <UploadZone
              type="pdf"
              maxFiles={10}
              busy={uploading === "pdfs"}
              onUpload={(files) => handleUpload("pdfs", files)}
            />
          </div>
        )}
      </div>

      <Lightbox
        items={images.map((url, i) => ({
          url,
          caption: humanFileName(url, `Imagen ${i + 1}`),
          subtitle: `${week.week} · ${weekRangeLabel(week)}`,
        }))}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete?.kind === "pdfs"
            ? "¿Eliminar este PDF?"
            : "¿Eliminar esta imagen?"
        }
        description={
          pendingDelete
            ? `"${humanFileName(pendingDelete.url, pendingDelete.kind === "images" ? "Esta imagen" : "Este documento")}" se borrará de ${week.week}. Esta acción no se puede deshacer.`
            : undefined
        }
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  action,
  onAction,
  alternativa,
  compacto,
}: {
  icon: React.ReactNode;
  title: string;
  action: string;
  onAction: () => void;
  alternativa?: { texto: string; onClick: () => void };
  compacto?: boolean;
}) {
  if (compacto)
    return (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white"
      >
        <UploadCloud size={16} />
        {action}
      </button>
    ); /* 29/10/2026: la acción principal de subida es la de la cabecera; ésta, secundaria. */

  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      <div className="text-white/20">{icon}</div>

      <p className="mt-4 text-white/50">{title}</p>

      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2.5 text-sm font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
      >
        <UploadCloud size={16} />
        {action}
      </button>

      {alternativa && (
        <button
          type="button"
          onClick={alternativa.onClick}
          className="mt-3 text-sm text-[#C8A96B] underline-offset-4 hover:underline"
        >
          {alternativa.texto}
        </button>
      )}
    </div>
  );
}
