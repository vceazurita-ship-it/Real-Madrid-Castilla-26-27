"use client";

/*
|--------------------------------------------------------------------------
| RECURSOS DEL RIVAL
|--------------------------------------------------------------------------
|
| Todo el material de un rival en una sola lista: los vídeos por un lado, los
| documentos por otro, cada uno con **su nombre** —que es lo que se busca a
| las nueve de la noche antes del partido, no una URL de HUDL de 120
| caracteres— y con la opción de subir el archivo en vez de pegar un enlace.
|
| Dos almacenes por debajo, uno solo en pantalla:
|
|   · Los recursos añadidos aquí van a `app_documents` (un documento JSON por
|     rival) y los archivos al bucket de storage. Se guardan solos.
|   · Las columnas históricas de la hoja (VIDEO, DOC, HUDL_*) siguen siendo
|     suyas y se editan como siempre; aquí se pintan en la misma lista con la
|     marca «hoja» para que nadie tenga que acordarse de mirar en dos sitios.
|
| Lo que no se hace: borrar una columna de la hoja desde aquí. Se puede vaciar
| su enlace, pero la fila sigue existiendo porque de ella dependen otras
| pantallas.
*/

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Check,
  ExternalLink,
  FileText,
  Film,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";

import {
  EXTENSIONES,
  MAX_BYTES,
  MEDIA_VACIO,
  RIVAL_MEDIA_KIND,
  enlaceAbrible,
  formatearTamano,
  nombreDesdeArchivo,
  normalizarMedia,
  nuevoId,
  rivalMediaFolder,
  rivalMediaKey,
  type MediaItem,
  type MediaKind,
  type RivalMediaDoc,
} from "@/lib/rivals/media";

/** Columna de la hoja que se pinta dentro de la lista. */
export interface RecursoFijo {
  campo: string;
  nombre: string;
  tipo: MediaKind;
  url: string;
}

const TITULOS: Record<MediaKind, { titulo: string; vacio: string }> = {
  video: {
    titulo: "Vídeos",
    vacio: "Todavía no hay vídeos de este rival.",
  },
  doc: {
    titulo: "Documentos",
    vacio: "Todavía no hay documentos de este rival.",
  },
};

/*
|--------------------------------------------------------------------------
| FILA DE RECURSO
|--------------------------------------------------------------------------
*/

function FilaRecurso({
  nombre,
  url,
  tipo,
  etiqueta,
  detalle,
  editando,
  onRenombrar,
  onCambiarUrl,
  onBorrar,
}: {
  nombre: string;
  url: string;
  tipo: MediaKind;
  /** "hoja", "archivo", "enlace"… */
  etiqueta: string;
  detalle?: string;
  editando: boolean;
  onRenombrar?: (nombre: string) => void;
  onCambiarUrl?: (url: string) => void;
  onBorrar?: () => void;
}) {
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [borrador, setBorrador] = useState(nombre);

  const Icon = tipo === "video" ? Film : FileText;

  const abrible = enlaceAbrible(url);

  const confirmarNombre = () => {
    const limpio = borrador.trim();

    if (limpio && onRenombrar) onRenombrar(limpio);

    setEditandoNombre(false);
  };

  return (
    <div
      className={`flex min-w-0 flex-col gap-2 rounded-2xl border px-3 py-2.5 transition sm:flex-row sm:items-center sm:gap-3 ${
        abrible
          ? "border-[#C8A96B]/25 bg-[#C8A96B]/[0.05]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
          abrible
            ? "border-[#C8A96B]/30 bg-[#C8A96B]/10 text-[#C8A96B]"
            : "border-white/10 bg-white/[0.03] text-white/30"
        }`}
      >
        <Icon size={15} />
      </span>

      <div className="min-w-0 flex-1">
        {editandoNombre ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <input
              autoFocus
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarNombre();
                if (e.key === "Escape") {
                  setBorrador(nombre);
                  setEditandoNombre(false);
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-[#C8A96B]/50 bg-[#0B0F14] px-2 py-1 text-sm text-white outline-none"
            />

            <button
              type="button"
              onClick={confirmarNombre}
              aria-label="Confirmar nombre"
              className="rounded-lg border border-white/10 p-1 text-emerald-300 transition hover:border-emerald-400/50"
            >
              <Check size={13} />
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 truncate text-sm font-semibold text-white">
              {nombre || "Sin nombre"}
            </p>

            {editando && onRenombrar && (
              <button
                type="button"
                data-export-hide
                onClick={() => {
                  setBorrador(nombre);
                  setEditandoNombre(true);
                }}
                aria-label={`Renombrar ${nombre}`}
                className="shrink-0 rounded-md p-0.5 text-white/30 transition hover:text-[#C8A96B]"
              >
                <Pencil size={11} />
              </button>
            )}
          </div>
        )}

        {editando && onCambiarUrl ? (
          <input
            aria-label={`Enlace de ${nombre}`}
            value={url}
            placeholder="https://…"
            onChange={(e) => onCambiarUrl(e.target.value)}
            data-export-hide
            className="mt-1 w-full min-w-0 rounded-lg border border-white/10 bg-[#0B0F14]/70 px-2 py-1 text-[11px] text-white/70 outline-none transition placeholder:text-white/20 focus:border-[#C8A96B]"
          />
        ) : (
          <p className="mt-0.5 min-w-0 truncate text-[11px] text-white/35">
            {url || "Sin enlace"}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-white/30">
          {etiqueta}
        </span>

        {detalle && (
          <span className="text-[10px] text-white/25">{detalle}</span>
        )}

        {abrible && (
          <a
            href={abrible}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#E4C977] transition hover:border-[#C8A96B]"
          >
            Abrir
            <ExternalLink size={11} />
          </a>
        )}

        {editando && onBorrar && (
          <button
            type="button"
            data-export-hide
            onClick={onBorrar}
            aria-label={`Quitar ${nombre}`}
            className="rounded-xl border border-white/10 p-1.5 text-white/35 transition hover:border-red-400/50 hover:text-red-300"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| BLOQUE DE UN TIPO (VÍDEOS O DOCUMENTOS)
|--------------------------------------------------------------------------
*/

function BloqueRecursos({
  tipo,
  items,
  fijos,
  editando,
  subiendo,
  onAñadirEnlace,
  onSubir,
  onRenombrar,
  onCambiarUrl,
  onBorrar,
  onCampoFijo,
}: {
  tipo: MediaKind;
  items: MediaItem[];
  fijos: RecursoFijo[];
  editando: boolean;
  subiendo: boolean;
  onAñadirEnlace: (tipo: MediaKind, nombre: string, url: string) => void;
  onSubir: (tipo: MediaKind, archivo: File) => void;
  onRenombrar: (tipo: MediaKind, id: string, nombre: string) => void;
  onCambiarUrl: (tipo: MediaKind, id: string, url: string) => void;
  onBorrar: (tipo: MediaKind, id: string) => void;
  onCampoFijo?: (campo: string, valor: string) => void;
}) {
  const [añadiendo, setAñadiendo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [arrastrando, setArrastrando] = useState(false);

  const input = useRef<HTMLInputElement>(null);

  const { titulo, vacio } = TITULOS[tipo];

  const confirmar = () => {
    const limpio = url.trim();

    if (!limpio) {
      toast.error("Pega el enlace antes de añadirlo");
      return;
    }

    /* Sin nombre la lista no serviría de nada: se pone uno provisional. */
    const porDefecto =
      tipo === "video"
        ? `Vídeo ${items.length + 1}`
        : `Documento ${items.length + 1}`;

    onAñadirEnlace(tipo, nombre.trim() || porDefecto, limpio);

    setNombre("");
    setUrl("");
    setAñadiendo(false);
  };

  const recibirArchivos = (lista: FileList | null) => {
    const archivo = lista?.[0];

    if (archivo) onSubir(tipo, archivo);
  };

  const total = items.length + fijos.filter((f) => f.url.trim()).length;

  return (
    <div className="min-w-0">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
          {tipo === "video" ? <Film size={13} /> : <FileText size={13} />}
          {titulo}

          <span className="rounded-full bg-white/[0.06] px-1.5 text-[10px] text-white/40">
            {total}
          </span>
        </h3>

        {editando && (
          <div data-export-hide className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAñadiendo((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-[#C8A96B] hover:text-white"
            >
              <Link2 size={12} />
              Enlace
            </button>

            <button
              type="button"
              disabled={subiendo}
              onClick={() => input.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2.5 py-1 text-[11px] font-semibold text-[#E4C977] transition hover:border-[#C8A96B] disabled:opacity-50"
            >
              {subiendo ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              Subir archivo
            </button>

            <input
              ref={input}
              type="file"
              accept={EXTENSIONES[tipo]}
              className="hidden"
              onChange={(e) => {
                recibirArchivos(e.target.files);

                /* Sin esto, subir dos veces el mismo archivo no dispara
                   `change` la segunda vez. */
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>

      {añadiendo && editando && (
        <div
          data-export-hide
          className="mb-2.5 flex flex-col gap-2 rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.06] p-3 sm:flex-row"
        >
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (p. ej. «Presión tras pérdida»)"
            className="min-w-0 rounded-xl border border-white/15 bg-[#0B0F14] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#C8A96B] sm:w-56"
          />

          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmar()}
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0B0F14] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#C8A96B]"
          />

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={confirmar}
              className="flex items-center gap-1.5 rounded-xl bg-[#C8A96B] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[#d8ba7c]"
            >
              <Plus size={14} />
              Añadir
            </button>

            <button
              type="button"
              onClick={() => setAñadiendo(false)}
              aria-label="Cancelar"
              className="rounded-xl border border-white/10 p-2 text-white/50 transition hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => {
          if (!editando) return;

          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          if (!editando) return;

          e.preventDefault();
          setArrastrando(false);
          recibirArchivos(e.dataTransfer.files);
        }}
        className={`min-w-0 space-y-2 rounded-2xl transition ${
          arrastrando
            ? "outline-dashed outline-2 outline-offset-4 outline-[#C8A96B]/60"
            : ""
        }`}
      >
        {fijos.map((fijo) => (
          <FilaRecurso
            key={fijo.campo}
            nombre={fijo.nombre}
            url={fijo.url}
            tipo={fijo.tipo}
            etiqueta="hoja"
            editando={editando}
            onCambiarUrl={
              onCampoFijo ? (valor) => onCampoFijo(fijo.campo, valor) : undefined
            }
          />
        ))}

        {items.map((item) => (
          <FilaRecurso
            key={item.id}
            nombre={item.nombre}
            url={item.url}
            tipo={tipo}
            etiqueta={item.origen === "archivo" ? "archivo" : "enlace"}
            detalle={formatearTamano(item.tamano)}
            editando={editando}
            onRenombrar={(valor) => onRenombrar(tipo, item.id, valor)}
            onCambiarUrl={
              item.origen === "enlace"
                ? (valor) => onCambiarUrl(tipo, item.id, valor)
                : undefined
            }
            onBorrar={() => onBorrar(tipo, item.id)}
          />
        ))}

        {total === 0 && (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-white/30">
            {vacio}
            {editando && " Arrastra un archivo aquí o pega un enlace."}
          </p>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| PANEL COMPLETO
|--------------------------------------------------------------------------
*/

export function RecursosRival({
  idRival,
  editando,
  fijos = [],
  onCampoFijo,
}: {
  /** ID del rival en la hoja: da nombre al documento y a la carpeta. */
  idRival: string;
  editando: boolean;
  /** Columnas de la hoja que se pintan dentro de la lista. */
  fijos?: RecursoFijo[];
  onCampoFijo?: (campo: string, valor: string) => void;
}) {
  const { value, setValue, status, localOnly } = useRemoteDoc<RivalMediaDoc>({
    key: rivalMediaKey(idRival),
    kind: RIVAL_MEDIA_KIND,
    fallback: MEDIA_VACIO,
  });

  const doc = normalizarMedia(value);

  const [subiendo, setSubiendo] = useState<MediaKind | null>(null);

  const actualizar = useCallback(
    (tipo: MediaKind, cambio: (lista: MediaItem[]) => MediaItem[]) => {
      setValue((actual) => {
        const base = normalizarMedia(actual);

        return tipo === "video"
          ? { ...base, videos: cambio(base.videos) }
          : { ...base, docs: cambio(base.docs) };
      });
    },
    [setValue]
  );

  const añadirEnlace = useCallback(
    (tipo: MediaKind, nombre: string, url: string) => {
      actualizar(tipo, (lista) => [
        ...lista,
        {
          id: nuevoId(),
          nombre,
          url,
          origen: "enlace",
          creado: new Date().toISOString(),
        },
      ]);

      toast.success("Enlace añadido", { description: nombre });
    },
    [actualizar]
  );

  const subir = useCallback(
    async (tipo: MediaKind, archivo: File) => {
      if (archivo.size > MAX_BYTES[tipo]) {
        toast.error("El archivo es demasiado grande", {
          description: `Máximo ${formatearTamano(MAX_BYTES[tipo])}. Súbelo a HUDL o Drive y pega el enlace.`,
        });

        return;
      }

      setSubiendo(tipo);

      const idToast = toast.loading(`Subiendo ${archivo.name}…`);

      try {
        const formData = new FormData();

        formData.append("file", archivo);
        formData.append("folder", rivalMediaFolder(idRival));

        const respuesta = await fetch("/api/rivals/media", {
          method: "POST",
          body: formData,
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.success) {
          throw new Error(datos.error || `HTTP ${respuesta.status}`);
        }

        actualizar(tipo, (lista) => [
          ...lista,
          {
            id: nuevoId(),
            nombre: nombreDesdeArchivo(archivo.name),
            url: datos.url,
            origen: "archivo",
            path: datos.path,
            mime: datos.mime,
            tamano: datos.tamano,
            creado: new Date().toISOString(),
          },
        ]);

        toast.success("Archivo subido", {
          id: idToast,
          description: archivo.name,
        });
      } catch (error) {
        console.error("[recursos] subida", error);

        toast.error("No se ha podido subir el archivo", {
          id: idToast,
          description:
            error instanceof Error ? error.message : "Inténtalo de nuevo",
        });
      } finally {
        setSubiendo(null);
      }
    },
    [actualizar, idRival]
  );

  const borrar = useCallback(
    async (tipo: MediaKind, id: string) => {
      const lista = tipo === "video" ? doc.videos : doc.docs;
      const item = lista.find((elemento) => elemento.id === id);

      if (!item) return;

      if (!window.confirm(`¿Quitar «${item.nombre}»?`)) return;

      actualizar(tipo, (actual) =>
        actual.filter((elemento) => elemento.id !== id)
      );

      /* El archivo del bucket se va con él: si no, quedan huérfanos que nadie
         ve pero siguen ocupando. Un fallo aquí no revierte la lista. */
      if (item.origen === "archivo" && item.path) {
        try {
          await fetch(
            `/api/rivals/media?path=${encodeURIComponent(item.path)}`,
            { method: "DELETE" }
          );
        } catch (error) {
          console.error("[recursos] borrado del archivo", error);
        }
      }
    },
    [actualizar, doc.docs, doc.videos]
  );

  const renombrar = useCallback(
    (tipo: MediaKind, id: string, nombre: string) => {
      actualizar(tipo, (lista) =>
        lista.map((item) => (item.id === id ? { ...item, nombre } : item))
      );
    },
    [actualizar]
  );

  const cambiarUrl = useCallback(
    (tipo: MediaKind, id: string, url: string) => {
      actualizar(tipo, (lista) =>
        lista.map((item) => (item.id === id ? { ...item, url } : item))
      );
    },
    [actualizar]
  );

  const bloque = (tipo: MediaKind) => (
    <BloqueRecursos
      tipo={tipo}
      items={tipo === "video" ? doc.videos : doc.docs}
      fijos={fijos.filter((fijo) => fijo.tipo === tipo)}
      editando={editando}
      subiendo={subiendo === tipo}
      onAñadirEnlace={añadirEnlace}
      onSubir={subir}
      onRenombrar={renombrar}
      onCambiarUrl={cambiarUrl}
      onBorrar={borrar}
      onCampoFijo={onCampoFijo}
    />
  );

  return (
    <div className="min-w-0 space-y-6">
      {localOnly && (
        <p
          data-export-hide
          className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200"
        >
          Los recursos añadidos aquí sólo están en este navegador: el servidor
          de documentos no responde.
        </p>
      )}

      {status === "saving" && (
        <span data-export-hide className="sr-only">
          Guardando recursos
        </span>
      )}

      {bloque("video")}
      {bloque("doc")}
    </div>
  );
}

export default RecursosRival;
