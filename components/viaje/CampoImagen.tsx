"use client";

/**
 * El hueco de un plano del dossier.
 *
 * Los planos del desplazamiento salen todos del mismo sitio: una captura de
 * Google Maps. Y una captura de pantalla vive en el portapapeles, no en un
 * fichero, así que el camino corto —y el que de verdad ahorra tiempo— es
 * **pegar con Ctrl+V**. Por eso este campo acepta las tres formas de dar una
 * imagen y no sólo el clásico "elegir archivo": pegar, soltar encima y elegir.
 *
 * La imagen se sube a Supabase, no se guarda dentro del documento. Un
 * desplazamiento lleva cuatro planos y una captura de mapa pesa más de un
 * mega: metidos en el JSON, el autoguardado subiría seis megas cada vez que
 * alguien corrige una hora.
 *
 * El nombre del fichero lleva la hora delante porque el almacén **no
 * sobrescribe** (`upsert: false`): sin eso, cambiar el plano por otro llamado
 * igual —y "Captura de pantalla.png" se llaman todas— falla al segundo
 * intento.
 */

import { useCallback, useRef, useState } from "react";
import { Clipboard, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { uploadFile } from "@/lib/uploadFile";
import type { ImagenViaje } from "@/lib/viaje/modelo";

/** Un nombre que no choca con ninguno de los que ya hay en la carpeta. */
function nombreUnico(original: string, tipo: string) {
  const sello = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);

  const limpio = (original || "plano").replace(/\.[^.]+$/, "").slice(0, 40);

  const extension = tipo.includes("png")
    ? "png"
    : tipo.includes("webp")
      ? "webp"
      : "jpg";

  return `${sello}-${limpio}.${extension}`;
}

export function CampoImagen({
  etiqueta,
  ayuda,
  carpeta,
  imagen,
  onCambio,
  pista,
  compacto = false,
}: {
  /**
   * Sin imagen, un botón compacto «Añadir foto» en vez de la tarjeta
   * (12/11/2026, expertos): tres recuadros de alturas distintas, dos de
   * ellos vacíos, no se leían. Se sigue pudiendo pegar o soltar encima.
   */
  compacto?: boolean;
  etiqueta: string;
  ayuda: string;
  /** Qué tiene que ser la imagen («una foto de la fachada, no el mapa»): se lee bajo el título. */
  pista?: string;
  /** Dónde se guarda en Supabase: "desplazamientos/<partido>". */
  carpeta: string;
  imagen?: ImagenViaje;
  onCambio: (imagen: ImagenViaje | undefined) => void;
}) {
  const entradaRef = useRef<HTMLInputElement>(null);

  const [subiendo, setSubiendo] = useState(false);
  const [encima, setEncima] = useState(false);

  const sube = useCallback(
    async (fichero: File) => {
      if (!fichero.type.startsWith("image/")) {
        toast.error("Eso no es una imagen");
        return;
      }

      setSubiendo(true);

      try {
        const renombrado = new File(
          [fichero],
          nombreUnico(fichero.name, fichero.type),
          { type: fichero.type },
        );

        const respuesta = await uploadFile(renombrado, carpeta);

        if (!respuesta?.url) throw new Error("Sin dirección");

        onCambio({ url: respuesta.url, ...(imagen?.pie ? { pie: imagen.pie } : {}) });

        toast.success("Plano subido");
      } catch (error) {
        console.error("[desplazamiento] subida", error);

        toast.error("No se ha podido subir la imagen");
      } finally {
        setSubiendo(false);
      }
    },
    [carpeta, imagen, onCambio],
  );

  /**
   * Pega lo que haya en el portapapeles.
   *
   * Dos caminos porque los navegadores no se ponen de acuerdo: el botón lee el
   * portapapeles a propósito (`navigator.clipboard.read`, que pide permiso), y
   * el `onPaste` recoge el Ctrl+V de toda la vida, que funciona siempre pero
   * sólo si el foco está dentro del campo.
   */
  const pegaDelPortapapeles = useCallback(async () => {
    try {
      const trozos = await navigator.clipboard.read();

      for (const trozo of trozos) {
        const tipo = trozo.types.find((t) => t.startsWith("image/"));

        if (!tipo) continue;

        const blob = await trozo.getType(tipo);

        await sube(new File([blob], "portapapeles.png", { type: tipo }));

        return;
      }

      toast.error("No hay ninguna imagen en el portapapeles");
    } catch {
      toast.error(
        "El navegador no deja leer el portapapeles: pulsa aquí y haz Ctrl+V",
      );
    }
  }, [sube]);

  const entrada = (
    <input
      ref={entradaRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(evento) => {
        const fichero = evento.target.files?.[0];

        if (fichero) void sube(fichero);

        evento.target.value = "";
      }}
    />
  );

  if (compacto && !imagen?.url) {
    return (
      <div
        tabIndex={0}
        title="También puedes pegar con Ctrl+V o soltar la imagen encima"
        onPaste={(evento) => {
          const fichero = Array.from(evento.clipboardData?.files ?? [])[0];

          if (fichero) {
            evento.preventDefault();
            void sube(fichero);
          }
        }}
        onDragOver={(evento) => {
          evento.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(evento) => {
          evento.preventDefault();
          setEncima(false);

          const fichero = evento.dataTransfer.files[0];

          if (fichero) void sube(fichero);
        }}
        className={`inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-dashed px-2 py-1.5 outline-none transition ${
          encima ? "border-[#C8A96B] bg-[#C8A96B]/10" : "border-white/15 focus:border-[#C8A96B]/50"
        }`}
      >
        {entrada}
        <button
          type="button"
          disabled={subiendo}
          onClick={() => entradaRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-[12px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10 disabled:opacity-40"
        >
          {subiendo ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
          {subiendo ? "Subiendo…" : `Añadir ${etiqueta.toLowerCase()}`}
        </button>
        <button
          type="button"
          disabled={subiendo}
          onClick={() => void pegaDelPortapapeles()}
          aria-label={`Pegar ${etiqueta.toLowerCase()} del portapapeles`}
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] text-white/55 transition hover:text-white disabled:opacity-40"
        >
          <Clipboard size={12} /> Pegar
        </button>
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      onPaste={(evento) => {
        const fichero = Array.from(evento.clipboardData?.files ?? [])[0];

        if (fichero) {
          evento.preventDefault();
          void sube(fichero);
        }
      }}
      onDragOver={(evento) => {
        evento.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(evento) => {
        evento.preventDefault();
        setEncima(false);

        const fichero = evento.dataTransfer.files[0];

        if (fichero) void sube(fichero);
      }}
      className={`flex h-full flex-col rounded-2xl border p-3 outline-none transition ${
        encima
          ? "border-[#C8A96B] bg-[#C8A96B]/10"
          : "border-white/10 bg-white/[0.03] focus:border-[#C8A96B]/50"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
          {etiqueta}
        </p>

      </div>

      {pista && <p className="mt-0.5 text-[11px] leading-snug text-white/40">{pista}</p>}

      {/* El fondo oscuro, sólo con imagen (19/10/2026). 10/11/2026: vacío ya
          no reserva una caja de 144 px: la fila de botones basta para añadirla
          (y se sigue pudiendo pegar con Ctrl+V o soltar el archivo encima). */}
      {imagen?.url && (
        <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/25">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagen.url}
            alt=""
            className="block h-36 w-full object-cover"
          />
        </div>
      )}

      {entrada}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
        <button
          type="button"
          disabled={subiendo}
          onClick={() => entradaRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-white/65 transition hover:border-white/30 hover:text-white disabled:opacity-40"
        >
          {subiendo ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <ImagePlus size={12} />
          )}
          {subiendo ? "Subiendo…" : imagen?.url ? "Cambiar" : "Añadir imagen"}
        </button>

        <button
          type="button"
          disabled={subiendo}
          onClick={() => void pegaDelPortapapeles()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-white/65 transition hover:border-white/30 hover:text-white disabled:opacity-40"
        >
          <Clipboard size={12} /> Pegar
        </button>

        {/*
        | Quitar, a la vista y con su nombre (12/11/2026, expertos): antes era
        | una «× quitar» gris en la esquina. Se puede deshacer desde el aviso.
        */}
        {imagen?.url && (
          <button
            type="button"
            disabled={subiendo}
            onClick={() => {
              const antes = imagen;

              onCambio(undefined);

              toast.success(`Quitada: ${etiqueta.toLowerCase()}`, {
                action: { label: "Deshacer", onClick: () => onCambio(antes) },
              });
            }}
            title={`Quitar ${etiqueta.toLowerCase()}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 px-2.5 py-1 text-[11px] text-rose-300 transition hover:border-rose-400/70 disabled:opacity-40"
          >
            <Trash2 size={12} /> Quitar la imagen
          </button>
        )}
      </div>

      {imagen?.url && (
      <input
        value={imagen?.pie ?? ""}
        onChange={(evento) =>
          onCambio(
            imagen?.url
              ? { url: imagen.url, pie: evento.target.value }
              : undefined,
          )
        }
        disabled={!imagen?.url}
        placeholder={ayuda}
        className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50 disabled:opacity-40"
      />
      )}
    </div>
  );
}
