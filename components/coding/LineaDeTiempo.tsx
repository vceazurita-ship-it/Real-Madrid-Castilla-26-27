"use client";

/**
 * La línea de tiempo del partido.
 *
 * Es el mapa del trabajo hecho: cada clip es una marca de color en el minuto
 * en el que ocurrió, así que de un vistazo se ve dónde se ha codificado mucho
 * y qué tramo del partido está en blanco. Sirve además de barra de progreso —se
 * pulsa y el vídeo salta ahí— y de aviso: mientras hay un INICIO marcado sin
 * cerrar, la zona en curso se pinta a rayas.
 *
 * **Una fila por categoría, como en SportsCode** (21/10/2026). Con una sola
 * banda, los clips del mismo minuto se tapaban unos a otros y una recuperación
 * debajo de un pase no se veía. Ahora cada categoría (o cada sujeto) tiene su
 * fila con el nombre delante, y «Una fila» vuelve a la vista de siempre.
 *
 * **Con lupa.** Noventa minutos en 900 píxeles son seis segundos por píxel: un
 * clip de cuatro segundos no se podía ni pulsar. La lupa enseña un tramo
 * alrededor del vídeo (×2 a ×16) y lo sigue mientras avanza; la regla de
 * arriba cambia de paso con ella.
 *
 * Se dibuja con `div` posicionados en porcentaje y no con un lienzo: son unos
 * cientos de marcas, el navegador las mueve solo al cambiar el tamaño de la
 * ventana y cada una puede llevar su propio `title` para el ratón.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import {
  SUJETO_VIDEO_COMPLETO,
  duracionClip,
  formateaDuracion,
  formateaMs,
  type CategoriaCoding,
  type ClipCoding,
} from "@/lib/coding/modelo";

type ModoFilas = "categorias" | "sujetos" | "una";

const MODOS: { valor: ModoFilas; texto: string }[] = [
  { valor: "categorias", texto: "Por categoría" },
  { valor: "sujetos", texto: "Por quién" },
  { valor: "una", texto: "Una fila" },
];

const LUPAS = [1, 2, 4, 8, 16];

/** El paso de la regla según lo que se ve: que salgan como mucho 12 marcas. */
const PASOS_MS = [10_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000];

function pasoDeRegla(tramoMs: number) {
  return PASOS_MS.find((paso) => tramoMs / paso <= 12) ?? 900_000;
}

/** «12′», «12′30″» o «1:02:00», lo justo para leer la regla. */
function etiquetaRegla(ms: number) {
  const segundos = Math.round(ms / 1000);
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = segundos % 60;

  if (horas > 0) {
    return `${horas}:${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
  }

  return resto ? `${minutos}′${String(resto).padStart(2, "0")}″` : `${minutos}′`;
}

const ALTO_FILA = 18;
const ALTO_REGLA = 22;

export function LineaDeTiempo({
  duracionMs,
  tiempoMs,
  inicioPendienteMs,
  clips,
  categorias,
  escenas,
  seleccionado,
  resaltados = null,
  onSalta,
  onElegirClip,
  onElegirEscena,
  onMueveEscena,
}: {
  duracionMs: number;
  tiempoMs: number;
  inicioPendienteMs: number | null;
  clips: ClipCoding[];
  categorias: CategoriaCoding[];
  /** Las pizarras pintadas, como muescas doradas arriba. */
  escenas?: { id: string; tMs: number; nombre: string; dibujos: unknown[] }[];
  seleccionado: string | null;
  /**
   * Los clips que pasan el filtro de la lista. Los demás se ven apagados:
   * se sigue sabiendo dónde están, pero se lee lo que se está mirando.
   */
  resaltados?: Set<string> | null;
  onSalta: (ms: number) => void;
  onElegirClip: (id: string) => void;
  onElegirEscena?: (id: string) => void;
  /**
   * Llevar una pizarra a otro instante arrastrando su muesca.
   *
   * Sin esto, lo pintado se quedaba clavado donde se pintó: si la pausa se
   * había hecho medio segundo tarde —que es lo normal marcando en directo—
   * había que borrar el dibujo y volver a hacerlo. El dibujo va en
   * proporciones del lienzo, así que moverlo en el tiempo no le hace nada.
   */
  onMueveEscena?: (id: string, tMs: number) => void;
}) {
  const barraRef = useRef<HTMLDivElement>(null);

  const [encima, setEncima] = useState<number | null>(null);
  const [modo, setModo] = useState<ModoFilas>("categorias");
  const [lupa, setLupa] = useState(1);

  /* La pizarra que se está arrastrando, con el sitio donde va ahora mismo. */
  const [arrastrada, setArrastrada] = useState<{
    id: string;
    tMs: number;
    movida: boolean;
    /** Dónde se apoyó el dedo, para saber si de verdad se ha arrastrado. */
    desdeX: number;
  } | null>(null);

  /*
  | Lo que hay que mover el dedo para que cuente como arrastre.
  |
  | Un toque en un móvil nunca cae en el mismo píxel en el que empieza: sin
  | margen, abrir una pizarra la desplazaba un par de décimas cada vez.
  */
  const ARRASTRE_MINIMO_PX = 6;

  /*
  | El tramo que se ve. Con lupa, centrado en el vídeo y sin salirse del
  | partido: al principio y al final se queda pegado al borde en vez de
  | enseñar un hueco.
  */
  const ventana = useMemo(() => {
    if (duracionMs <= 0) return { desde: 0, tramo: 0 };

    const tramo = duracionMs / lupa;

    const desde = Math.min(
      Math.max(0, tiempoMs - tramo / 2),
      Math.max(0, duracionMs - tramo),
    );

    return { desde, tramo };
  }, [duracionMs, lupa, tiempoMs]);

  const porcentaje = useCallback(
    (ms: number) =>
      ventana.tramo > 0 ? ((ms - ventana.desde) / ventana.tramo) * 100 : 0,
    [ventana],
  );

  const largo = useCallback(
    (ms: number) => (ventana.tramo > 0 ? (ms / ventana.tramo) * 100 : 0),
    [ventana],
  );

  const msDeEvento = useCallback(
    (clientX: number) => {
      const barra = barraRef.current;

      if (!barra || ventana.tramo <= 0) return 0;

      const caja = barra.getBoundingClientRect();

      const proporcion = Math.min(
        1,
        Math.max(0, (clientX - caja.left) / caja.width),
      );

      return Math.round(ventana.desde + proporcion * ventana.tramo);
    },
    [ventana],
  );

  const colorDe = useCallback(
    (clip: ClipCoding) =>
      categorias.find((una) => una.id === clip.categoriaId)?.color ?? "#C8A96B",
    [categorias],
  );

  /* El corte «Vídeo completo» no es una acción: llenaría su fila entera. */
  const acciones = useMemo(
    () => clips.filter((clip) => clip.jugadorId !== SUJETO_VIDEO_COMPLETO.id),
    [clips],
  );

  const filas = useMemo(() => {
    if (modo === "una" || acciones.length === 0) {
      return [{ id: "todo", nombre: "", color: "", clips: acciones }];
    }

    if (modo === "categorias") {
      const conocidas = new Set(categorias.map((una) => una.id));

      const usadas = categorias
        .map((categoria) => ({
          id: categoria.id,
          nombre: categoria.nombre,
          color: categoria.color,
          clips: acciones.filter((clip) => clip.categoriaId === categoria.id),
        }))
        .filter((fila) => fila.clips.length > 0);

      const sueltos = acciones.filter(
        (clip) => !conocidas.has(clip.categoriaId),
      );

      return sueltos.length > 0
        ? [
            ...usadas,
            { id: "sin", nombre: "Sin categoría", color: "#CBD5E1", clips: sueltos },
          ]
        : usadas;
    }

    const porSujeto = new Map<
      string,
      { id: string; nombre: string; color: string; clips: ClipCoding[] }
    >();

    for (const clip of acciones) {
      const fila = porSujeto.get(clip.jugadorId) ?? {
        id: clip.jugadorId,
        nombre: clip.jugadorNombre,
        color: "",
        clips: [],
      };

      fila.clips.push(clip);
      porSujeto.set(clip.jugadorId, fila);
    }

    return [...porSujeto.values()].sort(
      (a, b) =>
        b.clips.length - a.clips.length || a.nombre.localeCompare(b.nombre, "es"),
    );
  }, [acciones, categorias, modo]);

  const conNombres = filas.length > 1 || Boolean(filas[0]?.nombre);

  const paso = pasoDeRegla(ventana.tramo || duracionMs || 1);

  const marcasRegla = useMemo(() => {
    if (ventana.tramo <= 0) return [];

    const primera = Math.ceil(ventana.desde / paso) * paso;
    const lista: number[] = [];

    for (let ms = primera; ms <= ventana.desde + ventana.tramo; ms += paso) {
      lista.push(ms);
    }

    return lista;
  }, [paso, ventana]);

  const dentro = (desde: number, hasta: number) =>
    hasta >= ventana.desde && desde <= ventana.desde + ventana.tramo;

  return (
    <div className="min-w-0">
      {/* -------------------------- MANDOS -------------------------- */}

      <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Filas de la línea de tiempo"
          className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5"
        >
          {MODOS.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={modo === opcion.valor}
              onClick={() => setModo(opcion.valor)}
              className={`rounded-md px-2 py-1 text-[11px] transition ${
                modo === opcion.valor
                  ? "bg-white/10 font-semibold text-white"
                  : "text-white/45 hover:text-white"
              }`}
            >
              {opcion.texto}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setLupa((actual) => LUPAS[Math.max(0, LUPAS.indexOf(actual) - 1)])
            }
            disabled={lupa === LUPAS[0]}
            aria-label="Ver más partido"
            title="Ver más partido"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/55 transition hover:text-white disabled:opacity-30"
          >
            <Minus size={13} />
          </button>

          <span
            className="w-12 text-center font-mono text-[11px] tabular-nums text-white/55"
            aria-live="polite"
          >
            {lupa === 1 ? "Todo" : `×${lupa}`}
          </span>

          <button
            type="button"
            onClick={() =>
              setLupa(
                (actual) =>
                  LUPAS[Math.min(LUPAS.length - 1, LUPAS.indexOf(actual) + 1)],
              )
            }
            disabled={lupa === LUPAS[LUPAS.length - 1] || duracionMs <= 0}
            aria-label="Acercar la línea de tiempo"
            title="Acercar: enseña un tramo alrededor del vídeo y lo sigue"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/55 transition hover:text-white disabled:opacity-30"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      <div className="flex min-w-0">
        {/* Los nombres de las filas, fuera de la banda que se pulsa. */}
        {conNombres && (
          <div
            className="w-24 shrink-0 pr-2 sm:w-28"
            style={{ paddingTop: ALTO_REGLA }}
          >
            {filas.map((fila) => (
              <div
                key={fila.id}
                className="flex items-center gap-1.5 overflow-hidden"
                style={{ height: ALTO_FILA }}
                title={`${fila.nombre} · ${fila.clips.length}`}
              >
                {fila.color && (
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: fila.color }}
                  />
                )}
                <span className="truncate text-[10px] text-white/55">
                  {fila.nombre}
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          ref={barraRef}
          role="slider"
          tabIndex={-1}
          aria-label="Línea de tiempo del partido"
          aria-valuemin={0}
          aria-valuemax={Math.round(duracionMs / 1000)}
          aria-valuenow={Math.round(tiempoMs / 1000)}
          aria-valuetext={formateaMs(tiempoMs)}
          onClick={(evento) => onSalta(msDeEvento(evento.clientX))}
          onMouseMove={(evento) => setEncima(msDeEvento(evento.clientX))}
          onMouseLeave={() => setEncima(null)}
          className="relative min-w-0 flex-1 cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
          style={{
            height: ALTO_REGLA + Math.max(1, filas.length) * ALTO_FILA + 6,
          }}
        >
          {/* La regla: el paso cambia con la lupa. */}
          {marcasRegla.map((marca) => (
            <div
              key={marca}
              aria-hidden
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-white/[0.07]"
              style={{ left: `${porcentaje(marca)}%` }}
            >
              <span className="absolute left-1 top-[5px] whitespace-nowrap font-mono text-[9px] tabular-nums text-white/35">
                {etiquetaRegla(marca)}
              </span>
            </div>
          ))}

          {/* Las filas, con una raya fina entre ellas. */}
          {filas.map((fila, indice) => (
            <div
              key={fila.id}
              className="absolute inset-x-0 border-t border-white/[0.05]"
              style={{ top: ALTO_REGLA + indice * ALTO_FILA, height: ALTO_FILA }}
            >
              {fila.clips.map((clip) => {
                if (!dentro(clip.inicioMs, clip.finMs)) return null;

                const activo = clip.id === seleccionado;
                const apagado = resaltados !== null && !resaltados.has(clip.id);

                return (
                  <button
                    key={clip.id}
                    type="button"
                    title={`${String(clip.numero).padStart(3, "0")} · ${clip.jugadorNombre}\n${
                      categorias.find((una) => una.id === clip.categoriaId)
                        ?.nombre ?? "Sin categoría"
                    }${clip.tags.length ? ` · ${clip.tags.join(", ")}` : ""}\n${formateaMs(clip.codingInicioMs)} → ${formateaMs(clip.codingFinMs)} (${formateaDuracion(duracionClip(clip))})`}
                    aria-label={`Corte ${clip.numero}, ${clip.jugadorNombre}, ${formateaMs(clip.codingInicioMs)}`}
                    onClick={(evento) => {
                      evento.stopPropagation();
                      onElegirClip(clip.id);
                    }}
                    className="absolute bottom-[3px] top-[3px] rounded-sm transition-[filter] hover:brightness-125"
                    style={{
                      left: `${porcentaje(clip.inicioMs)}%`,
                      width: `max(3px, ${largo(duracionClip(clip))}%)`,
                      backgroundColor: colorDe(clip),
                      opacity: activo ? 1 : apagado ? 0.15 : 0.7,
                      outline: activo ? "2px solid #C8A96B" : "none",
                      outlineOffset: 1,
                    }}
                  />
                );
              })}
            </div>
          ))}

          {acciones.length === 0 && (
            <span
              className="pointer-events-none absolute inset-x-0 text-center text-[11px] text-white/30"
              style={{ top: ALTO_REGLA + 2 }}
            >
              Los cortes que marques aparecen aquí, en su minuto
            </span>
          )}

          {/*
          | Las pizarras, en el borde de arriba.
          |
          | Van fuera de las filas de los clips porque no son lo mismo: un clip
          | es un trozo de partido y una pizarra es un instante dibujado encima.
          */}
          {(escenas ?? []).map((escena) => {
            const suelta = arrastrada?.id === escena.id ? arrastrada : null;

            const donde = suelta ? suelta.tMs : escena.tMs;

            if (!suelta && !dentro(donde, donde)) return null;

            return (
              <button
                key={escena.id}
                type="button"
                title={`Pizarra · ${escena.nombre.trim() || formateaMs(escena.tMs)} (${escena.dibujos.length} dibujos)${
                  onMueveEscena
                    ? "\nArrástrala para llevarla a otro instante"
                    : ""
                }`}
                onPointerDown={(evento) => {
                  if (!onMueveEscena || evento.button !== 0) return;

                  evento.stopPropagation();
                  evento.preventDefault();

                  evento.currentTarget.setPointerCapture(evento.pointerId);

                  setArrastrada({
                    id: escena.id,
                    tMs: escena.tMs,
                    movida: false,
                    desdeX: evento.clientX,
                  });
                }}
                onPointerMove={(evento) => {
                  if (arrastrada?.id !== escena.id) return;

                  evento.stopPropagation();

                  const lejos =
                    Math.abs(evento.clientX - arrastrada.desdeX) >=
                    ARRASTRE_MINIMO_PX;

                  /* Antes del umbral no se toca nada: ni la posición dibujada. */
                  if (!lejos && !arrastrada.movida) return;

                  setArrastrada({
                    ...arrastrada,
                    tMs: msDeEvento(evento.clientX),
                    movida: true,
                  });
                }}
                onPointerUp={(evento) => {
                  if (arrastrada?.id !== escena.id) return;

                  evento.stopPropagation();

                  /*
                  | Un clic es un arrastre de cero: si la muesca no se ha
                  | movido se abre la pizarra, que es lo de siempre; si se ha
                  | movido, se lleva ahí y no se abre nada.
                  */
                  if (arrastrada.movida && onMueveEscena) {
                    onMueveEscena(escena.id, arrastrada.tMs);
                  } else if (onElegirEscena) {
                    onElegirEscena(escena.id);
                  } else {
                    onSalta(escena.tMs);
                  }

                  setArrastrada(null);
                }}
                /*
                | Un toque que el sistema cancela —una llamada, el gesto de
                | volver atrás, el dedo saliéndose de la pantalla— no manda
                | `pointerup`. Sin esto, la muesca se quedaba dibujada en el
                | sitio abandonado hasta recargar la página.
                */
                onPointerCancel={(evento) => {
                  if (arrastrada?.id !== escena.id) return;

                  evento.stopPropagation();

                  setArrastrada(null);
                }}
                onClick={(evento) => {
                  evento.stopPropagation();

                  /* Con `onMueveEscena` manda el puntero, no el clic. */
                  if (onMueveEscena) return;

                  if (onElegirEscena) onElegirEscena(escena.id);
                  else onSalta(escena.tMs);
                }}
                className={`absolute top-0 z-10 -translate-x-1/2 rounded-b-sm bg-[#C8A96B] transition hover:h-3 ${
                  onMueveEscena ? "cursor-ew-resize" : ""
                } ${suelta?.movida ? "h-4 w-2 shadow-[0_0_8px_#C8A96B]" : "h-2 w-1.5"}`}
                style={{ left: `${porcentaje(donde)}%` }}
              />
            );
          })}

          {/* El tramo que se está marcando ahora mismo, a rayas. */}
          {inicioPendienteMs !== null && (
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 border-x border-[#C8A96B] bg-[repeating-linear-gradient(135deg,rgba(200,169,107,0.3)_0_6px,rgba(200,169,107,0.1)_6px_12px)]"
              style={{
                top: ALTO_REGLA - 4,
                left: `${porcentaje(inicioPendienteMs)}%`,
                width: `max(2px, ${largo(Math.max(0, tiempoMs - inicioPendienteMs))}%)`,
              }}
            />
          )}

          {/* Dónde va el vídeo. */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-[#C8A96B]"
            style={{ left: `${porcentaje(tiempoMs)}%` }}
          />

          {/* Dónde está el ratón. */}
          {encima !== null && (
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-white/30"
              style={{ left: `${porcentaje(encima)}%` }}
            />
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] tabular-nums text-white/35">
        <span>{formateaMs(tiempoMs)}</span>

        <span className="truncate text-white/30">
          {arrastrada?.movida
            ? `Pizarra → ${formateaMs(arrastrada.tMs)}`
            : encima !== null
              ? formateaMs(encima)
              : lupa > 1
                ? `${formateaMs(ventana.desde)} – ${formateaMs(ventana.desde + ventana.tramo)}`
                : `${acciones.length} ${acciones.length === 1 ? "corte" : "cortes"}`}
        </span>

        <span>{formateaMs(duracionMs)}</span>
      </div>
    </div>
  );
}
