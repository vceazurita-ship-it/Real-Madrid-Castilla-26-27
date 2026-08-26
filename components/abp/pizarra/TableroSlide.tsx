"use client";

/**
 * El tablero: una diapositiva de balón parado, a tamaño de plantilla.
 *
 * Se pinta SIEMPRE en el lienzo de 1920×1080 de `public/INDIVIDUAL.pptx` y se
 * escala entero para caber en la columna. Así las coordenadas que trae la
 * plantilla —sacadas del pptx de ABP— valen tal cual, y lo que se ve en
 * pantalla es exactamente lo que sale al exportar.
 *
 * Las fichas se arrastran con eventos de puntero y no con dnd-kit: el tablero
 * vive dentro de un `transform: scale`, y dnd-kit mide con
 * `getBoundingClientRect()`, que bajo una escala deja los destinos donde no
 * están (ver la nota de la cámara 3D de las pizarras). Con punteros la cuenta
 * es una división por la escala y funciona igual con dedo que con ratón.
 *
 * El acabado —cabecera en tinta con filo de oro, paneles de cristal oscuro y
 * la caja de consignas en papel— es el de la plataforma, no el del pptx de
 * origen: la diapositiva se proyecta en la sala y se imprime, y tenía que
 * aguantar las dos cosas. Todo el color va en estilos en línea con `rgba`
 * porque la captura (`html-to-image`) serializa el estilo calculado: ni
 * `backdrop-filter` ni los colores `oklch` de Tailwind sobreviven al PNG.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import type { Player } from "@/types/player";
import {
  CABECERA_H,
  CLUB,
  COLORES,
  NOTAS,
  PANEL,
  TABLERO_H,
  TABLERO_W,
  VISTAS,
  enElCampo,
  gruposDe,
  puestoDe,
  puestosDe,
  type FichaPizarra,
  type SlidePizarra,
} from "@/lib/abp/pizarra";

/** Medidas de una ficha en el lienzo, las del pptx: foto de 96×120. */
const FOTO_W = 96;
const FOTO_H = 120;
const CHAPA_H = 30;

/* ------------------------------------------------------------------ */
/*  UNA FICHA                                                          */
/* ------------------------------------------------------------------ */

function Ficha({
  ficha,
  player,
  code,
  seleccionada,
  onPointerDown,
  onQuitar,
}: {
  ficha: FichaPizarra;
  player: Player | undefined;
  code: string;
  seleccionada: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
  onQuitar: () => void;
}) {
  return (
    <div
      className="group absolute select-none"
      style={{
        left: ficha.x - FOTO_W / 2,
        top: ficha.y - FOTO_H,
        width: FOTO_W,
        touchAction: "none",
        cursor: "grab",
        zIndex: Math.round(ficha.y),
      }}
      onPointerDown={onPointerDown}
    >
      {/*
      | Sombra de suelo. Sin ella las caras flotan sobre el césped y el campo
      | en perspectiva pierde el poco relieve que tiene.
      */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%]"
        style={{
          top: FOTO_H - 14,
          width: 76,
          height: 18,
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 72%)",
        }}
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={player?.foto ?? "/players/placeholder.png"}
        alt={player?.apodo ?? ""}
        draggable={false}
        className="relative block h-[120px] w-[96px] object-contain object-bottom"
        style={{
          filter: seleccionada
            ? `drop-shadow(0 0 6px ${COLORES.oro}) drop-shadow(0 8px 12px rgba(0,0,0,.6))`
            : "drop-shadow(0 8px 12px rgba(0,0,0,.5))",
        }}
      />

      {/* Chapa: el código del puesto y, debajo, el nombre. */}
      <div
        className="relative mx-auto -mt-2 flex flex-col items-center rounded-md px-1.5 py-0.5 text-center"
        style={{
          backgroundImage: `linear-gradient(180deg, #0B2E4B 0%, ${COLORES.chapa} 100%)`,
          boxShadow: seleccionada
            ? `0 0 0 2px ${COLORES.oro}, 0 6px 14px rgba(0,0,0,.55)`
            : "0 0 0 1px rgba(200,169,107,.42), 0 6px 12px rgba(0,0,0,.5)",
          minWidth: 54,
          height: CHAPA_H,
        }}
      >
        <span className="text-[15px] font-bold leading-[15px] tracking-[0.04em] text-white">
          {code}
        </span>

        <span
          className="max-w-[86px] truncate text-[10px] font-semibold uppercase leading-[12px] tracking-wide"
          style={{ color: "rgba(228,206,155,.78)" }}
        >
          {player?.apodo ?? player?.nombre ?? "—"}
        </span>
      </div>

      <button
        type="button"
        data-export-hide
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onQuitar}
        aria-label="Quitar del tablero"
        className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white/70 transition hover:bg-rose-600 hover:text-white group-hover:flex"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HUECO DE UN PUESTO VACÍO                                           */
/* ------------------------------------------------------------------ */

function Hueco({
  x,
  y,
  code,
  label,
  onClick,
}: {
  x: number;
  y: number;
  code: string;
  label: string;
  onClick: () => void;
}) {
  /*
  | Va marcado como cromo de edición: un puesto sin nadie es un botón para
  | asignar, no algo que enseñar en la sala. Al exportar —a PPT, a PDF o con el
  | botón de la plataforma— se cae, y la diapositiva sale con quien está.
  */
  return (
    <button
      type="button"
      data-export-hide
      onClick={onClick}
      title={`${code} · ${label} — pulsa para asignar`}
      className="absolute flex flex-col items-center justify-center rounded-md border border-dashed transition hover:border-solid"
      style={{
        left: x - 27,
        top: y - CHAPA_H,
        width: 54,
        height: CHAPA_H,
        borderColor: "rgba(200,169,107,.65)",
        backgroundColor: "rgba(4,18,32,.62)",
        boxShadow: "0 4px 10px rgba(0,0,0,.35)",
        zIndex: Math.round(y),
      }}
    >
      <span
        className="text-[14px] font-bold leading-none tracking-[0.04em]"
        style={{ color: "rgba(228,206,155,.9)" }}
      >
        {code}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  TABLERO                                                            */
/* ------------------------------------------------------------------ */

export function TableroSlide({
  slide,
  players,
  temporada,
  rival,
  seleccion,
  onMover,
  onQuitar,
  onPulsarPuesto,
  onSeleccionar,
}: {
  slide: SlidePizarra;
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  /** Ficha resaltada, la que se acaba de tocar en el panel. */
  seleccion?: string | null;
  onMover: (id: string, x: number, y: number) => void;
  onQuitar: (id: string) => void;
  onPulsarPuesto: (puestoKey: string) => void;
  onSeleccionar: (id: string | null) => void;
}) {
  const marcoRef = useRef<HTMLDivElement>(null);

  const [escala, setEscala] = useState(1);

  /* El lienzo es fijo; lo que cambia es cuánto se encoge para caber. */
  useEffect(() => {
    const marco = marcoRef.current;

    if (!marco) return;

    const medir = () => setEscala(marco.clientWidth / TABLERO_W);

    medir();

    const observer = new ResizeObserver(medir);

    observer.observe(marco);

    return () => observer.disconnect();
  }, []);

  /*
  | Arrastre. El puntero se sigue en `window` y no en la ficha: soltando fuera
  | del tablero —que pasa a menudo con las fichas del borde— el `pointerup` no
  | llegaría nunca y la ficha se quedaría pegada al ratón.
  */
  const arrastre = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const empieza = useCallback(
    (event: React.PointerEvent, ficha: FichaPizarra) => {
      const marco = marcoRef.current;

      if (!marco) return;

      const caja = marco.getBoundingClientRect();
      const k = caja.width / TABLERO_W;

      arrastre.current = {
        id: ficha.id,
        dx: (event.clientX - caja.left) / k - ficha.x,
        dy: (event.clientY - caja.top) / k - ficha.y,
      };

      onSeleccionar(ficha.id);

      event.preventDefault();
    },
    [onSeleccionar],
  );

  useEffect(() => {
    const mueve = (event: PointerEvent) => {
      const activo = arrastre.current;
      const marco = marcoRef.current;

      if (!activo || !marco) return;

      const caja = marco.getBoundingClientRect();
      const k = caja.width / TABLERO_W;

      /* Dentro del lienzo: una ficha fuera no se ve y no se puede recuperar. */
      const x = Math.max(
        40,
        Math.min(TABLERO_W - 40, (event.clientX - caja.left) / k - activo.dx),
      );

      const y = Math.max(
        CABECERA_H + FOTO_H,
        Math.min(TABLERO_H - 10, (event.clientY - caja.top) / k - activo.dy),
      );

      onMover(activo.id, Math.round(x), Math.round(y));
    };

    const suelta = () => {
      arrastre.current = null;
    };

    window.addEventListener("pointermove", mueve);
    window.addEventListener("pointerup", suelta);
    window.addEventListener("pointercancel", suelta);

    return () => {
      window.removeEventListener("pointermove", mueve);
      window.removeEventListener("pointerup", suelta);
      window.removeEventListener("pointercancel", suelta);
    };
  }, [onMover]);

  const puestos = puestosDe(slide);
  const grupos = gruposDe(slide);

  const enCampo = slide.fichas.filter(enElCampo);

  const ocupados = new Set(
    slide.fichas.map((ficha) => ficha.puesto).filter(Boolean) as string[],
  );

  const cubiertos = puestos.filter((puesto) => ocupados.has(puesto.key)).length;

  const codeDe = (ficha: FichaPizarra) =>
    puestoDe(slide, ficha.puesto)?.code ??
    (players.get(ficha.playerId)?.dorsal
      ? String(players.get(ficha.playerId)?.dorsal)
      : "·");

  return (
    <div ref={marcoRef} className="w-full" style={{ height: TABLERO_H * escala }}>
      <div
        data-abp-tablero
        className="relative overflow-hidden"
        style={{
          width: TABLERO_W,
          height: TABLERO_H,
          transform: `scale(${escala})`,
          transformOrigin: "top left",
          backgroundColor: COLORES.tinta,
        }}
      >
        {/* ------------------------- CAMPO ------------------------- */}

        {/* Una capa por foto, en su rectángulo del pptx. */}
        {VISTAS[slide.vista].capas.map((capa) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={capa.src}
            src={capa.src}
            alt=""
            draggable={false}
            className="absolute object-fill"
            style={{ left: capa.x, top: capa.y, width: capa.w, height: capa.h }}
          />
        ))}

        {/*
        | Dos velos sobre el césped. El vertical es el de siempre: sin él las
        | chapas claras no se leen. El viñeteado es lo que hace que la mirada
        | caiga en el área en lugar de en las esquinas, que es de lo que va la
        | diapositiva.
        */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(4,18,32,.46) 0%, rgba(4,18,32,.06) 36%, rgba(4,18,32,.34) 100%)",
          }}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(118% 84% at 42% 36%, rgba(0,0,0,0) 40%, rgba(3,12,22,.30) 76%, rgba(3,12,22,.60) 100%)",
          }}
        />

        {/* ----------------------- CABECERA ------------------------ */}

        <div
          className="absolute left-0 top-0 overflow-hidden"
          style={{
            width: TABLERO_W,
            height: CABECERA_H,
            backgroundImage:
              "linear-gradient(96deg, #000000 0%, #04121F 28%, #0A2138 54%, #05182A 76%, #000000 100%)",
            boxShadow: "0 16px 36px rgba(0,0,0,.45)",
          }}
        >
          {/*
          | El resto de oro. Hereda del degradado naranja de la plantilla de
          | ABP —la cabecera se aclaraba hacia la derecha—, pero en el oro de
          | la casa y a la mitad de fuerza: el bloque del rival tiene que
          | destacar sobre él, no pelearse.
          */}
          <div
            className="pointer-events-none absolute inset-y-0 right-0"
            style={{
              width: 720,
              backgroundImage:
                "linear-gradient(100deg, rgba(200,169,107,0) 0%, rgba(200,169,107,.10) 48%, rgba(200,169,107,.24) 100%)",
            }}
          />

          <div className="relative flex h-full items-center gap-6 pl-7 pr-8">
            <div
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{
                width: 92,
                height: 92,
                border: "1px solid rgba(200,169,107,.38)",
                backgroundColor: "rgba(255,255,255,.04)",
                boxShadow: "inset 0 0 26px rgba(200,169,107,.14)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt=""
                className="h-[64px] w-auto"
                draggable={false}
              />
            </div>

            <div
              className="h-[66px] w-px shrink-0"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, rgba(200,169,107,0) 0%, rgba(200,169,107,.6) 50%, rgba(200,169,107,0) 100%)",
              }}
            />

            <div className="min-w-0 flex-1">
              <p
                className="text-[13px] font-semibold uppercase leading-none tracking-[0.34em]"
                style={{ color: COLORES.oro }}
              >
                {CLUB}
              </p>

              <p
                className="mt-2.5 truncate text-[42px] font-bold uppercase leading-none tracking-[0.015em] text-white"
                style={{
                  fontFamily: "var(--fuente-pizarra, inherit)",
                  textShadow: "0 2px 12px rgba(0,0,0,.55)",
                }}
              >
                {slide.titulo}
              </p>
            </div>

            {/*
            | El rival y la temporada, en una placa de cristal. Antes iban en
            | tinta oscura sobre el naranja del degradado, que a tamaño de
            | proyección se comía las letras; sobre la tinta con filo de oro se
            | leen desde el fondo de la sala.
            */}
            <div
              className="max-w-[440px] shrink-0 rounded-xl px-5 py-2.5 text-right"
              style={{
                backgroundColor: "rgba(255,255,255,.05)",
                border: "1px solid rgba(200,169,107,.32)",
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase leading-none tracking-[0.3em]"
                style={{ color: "rgba(200,169,107,.85)" }}
              >
                Rival
              </p>

              <p className="mt-2 truncate text-[24px] font-bold uppercase leading-none tracking-[0.05em] text-white">
                {rival || "Balón parado"}
              </p>

              <p className="mt-2 text-[10px] font-semibold uppercase leading-none tracking-[0.26em] text-white/45">
                Temporada {temporada}
              </p>
            </div>
          </div>
        </div>

        {/* Filo bajo la cabecera: el oro de la casa y el rosa de INDIVIDUAL. */}
        <div
          className="absolute left-0"
          style={{
            top: CABECERA_H,
            width: TABLERO_W,
            height: 5,
            backgroundImage: `linear-gradient(90deg, ${COLORES.oro} 0%, ${COLORES.oroClaro} 26%, ${COLORES.rosa} 62%, rgba(200,169,107,.25) 100%)`,
          }}
        />

        {/* ------------------ HUECOS Y FICHAS ---------------------- */}

        {puestos
          .filter((puesto) => puesto.x != null && !ocupados.has(puesto.key))
          .map((puesto) => (
            <Hueco
              key={puesto.key}
              x={puesto.x as number}
              y={puesto.y as number}
              code={puesto.code}
              label={puesto.label}
              onClick={() => onPulsarPuesto(puesto.key)}
            />
          ))}

        {enCampo.map((ficha) => (
          <Ficha
            key={ficha.id}
            ficha={ficha}
            player={players.get(ficha.playerId)}
            code={codeDe(ficha)}
            seleccionada={seleccion === ficha.id}
            onPointerDown={(event) => empieza(event, ficha)}
            onQuitar={() => onQuitar(ficha.id)}
          />
        ))}

        {/* --------------------- PANEL DERECHO --------------------- */}

        {grupos.length > 0 && (
          <div
            className="absolute rounded-2xl px-5 pb-4 pt-3.5"
            style={{
              left: PANEL.x,
              top: PANEL.y,
              width: PANEL.w,
              maxHeight: PANEL.h,
              backgroundColor: "rgba(4,18,32,.9)",
              border: "1px solid rgba(200,169,107,.3)",
              boxShadow: "0 18px 44px rgba(0,0,0,.55)",
            }}
          >
            <div
              className="mb-3 flex items-baseline justify-between border-b pb-2"
              style={{ borderColor: "rgba(200,169,107,.25)" }}
            >
              <p
                className="text-[12px] font-semibold uppercase leading-none tracking-[0.3em]"
                style={{ color: COLORES.oro }}
              >
                Asignaciones
              </p>

              <p className="text-[12px] font-semibold tabular-nums leading-none text-white/40">
                {cubiertos}/{puestos.length}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              {grupos.map((grupo) => {
                const delGrupo = puestos.filter(
                  (puesto) => puesto.grupo === grupo.key,
                );

                return (
                  <div key={grupo.key} className="min-w-0">
                    <p
                      className="border-b pb-1 text-[13px] font-bold uppercase tracking-[0.16em]"
                      style={{
                        color: COLORES.oroClaro,
                        borderColor: "rgba(200,169,107,.22)",
                      }}
                    >
                      {grupo.label}
                    </p>

                    <div className="mt-1.5 space-y-1">
                      {delGrupo.map((puesto) => {
                        const ficha = slide.fichas.find(
                          (item) => item.puesto === puesto.key,
                        );

                        const player = ficha
                          ? players.get(ficha.playerId)
                          : undefined;

                        return (
                          <button
                            key={puesto.key}
                            type="button"
                            onClick={() => onPulsarPuesto(puesto.key)}
                            onPointerEnter={() =>
                              ficha && onSeleccionar(ficha.id)
                            }
                            onPointerLeave={() => onSeleccionar(null)}
                            className="flex w-full min-w-0 items-center gap-2 rounded px-1.5 py-0.5 text-left transition hover:bg-white/10"
                          >
                            <span
                              className="shrink-0 rounded px-1.5 text-[13px] font-bold tabular-nums"
                              style={{
                                backgroundColor: "rgba(200,169,107,.16)",
                                color: COLORES.oroClaro,
                                boxShadow: "inset 0 0 0 1px rgba(200,169,107,.3)",
                              }}
                            >
                              {puesto.code}
                            </span>

                            <span
                              className={`min-w-0 flex-1 truncate text-[15px] font-semibold uppercase tracking-[0.02em] ${
                                player ? "text-white" : "text-white/30"
                              }`}
                            >
                              {player?.apodo ?? player?.nombre ?? "—"}
                            </span>
                          </button>
                        );
                      })}

                      {delGrupo.length === 0 && (
                        <p className="px-1.5 text-[13px] text-white/30">
                          Sin puestos
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------- NOTAS ------------------------- */}

        {slide.notas.length > 0 && (
          <div
            className="absolute overflow-hidden rounded-2xl"
            style={{
              left: NOTAS.x,
              top: NOTAS.y,
              width: NOTAS.w,
              maxHeight: NOTAS.h,
              backgroundColor: COLORES.papel,
              borderLeft: `6px solid ${COLORES.oro}`,
              boxShadow:
                "0 0 0 1px rgba(200,169,107,.45), 0 18px 44px rgba(0,0,0,.45)",
            }}
          >
            <div className="px-6 pb-4 pt-3.5">
              <p
                className="mb-2.5 border-b pb-1.5 text-[12px] font-bold uppercase leading-none tracking-[0.3em]"
                style={{
                  color: COLORES.oro,
                  borderColor: "rgba(15,30,61,.12)",
                }}
              >
                Consignas
              </p>

              <ul className="space-y-1.5">
                {slide.notas.map((nota, indice) => (
                  <li
                    key={`${indice}-${nota}`}
                    className="flex items-start gap-2.5 text-[19px] font-semibold uppercase leading-tight"
                    style={{ color: COLORES.navy }}
                  >
                    <span
                      className="mt-[7px] shrink-0 rounded-[1px]"
                      style={{
                        width: 7,
                        height: 7,
                        backgroundColor: COLORES.oro,
                      }}
                    />

                    <span className="min-w-0">{nota}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
