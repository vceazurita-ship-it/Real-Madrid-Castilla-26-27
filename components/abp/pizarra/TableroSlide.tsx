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
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import type { Player } from "@/types/player";
import {
  CABECERA_H,
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={player?.foto ?? "/players/placeholder.png"}
        alt={player?.apodo ?? ""}
        draggable={false}
        className="block h-[120px] w-[96px] object-contain object-bottom"
        style={{
          filter: seleccionada
            ? `drop-shadow(0 0 0 2px ${COLORES.ambar}) drop-shadow(0 6px 10px rgba(0,0,0,.55))`
            : "drop-shadow(0 6px 10px rgba(0,0,0,.45))",
        }}
      />

      {/* Chapa: el código del puesto y, debajo, el nombre. */}
      <div
        className="mx-auto -mt-2 flex flex-col items-center rounded-md px-1.5 py-0.5 text-center"
        style={{
          backgroundColor: COLORES.chapa,
          boxShadow: `0 0 0 2px ${seleccionada ? COLORES.ambar : "rgba(0,0,0,.55)"}`,
          minWidth: 54,
          height: CHAPA_H,
        }}
      >
        <span className="text-[15px] font-bold leading-[15px] text-white">
          {code}
        </span>

        <span className="max-w-[86px] truncate text-[10px] font-semibold uppercase leading-[12px] tracking-wide text-white/70">
          {player?.apodo ?? player?.nombre ?? "—"}
        </span>
      </div>

      <button
        type="button"
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
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${code} · ${label} — pulsa para asignar`}
      className="absolute flex flex-col items-center justify-center rounded-md border-2 border-dashed transition hover:border-solid"
      style={{
        left: x - 27,
        top: y - CHAPA_H,
        width: 54,
        height: CHAPA_H,
        borderColor: "rgba(255,255,255,.45)",
        backgroundColor: "rgba(0,48,78,.45)",
        zIndex: Math.round(y),
      }}
    >
      <span className="text-[14px] font-bold leading-none text-white/80">
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
          backgroundColor: COLORES.papel,
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

        {/* Velo: sobre el césped a pelo, las chapas blancas no se leen. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,30,61,.42) 0%, rgba(15,30,61,.08) 38%, rgba(15,30,61,.34) 100%)",
          }}
        />

        {/* ----------------------- CABECERA ------------------------ */}

        <div
          className="absolute left-0 top-0 flex items-center gap-6 pl-6 pr-10"
          style={{
            width: TABLERO_W,
            height: CABECERA_H,
            background: `linear-gradient(90deg, #000000 0%, #05192B 46%, ${COLORES.ambar} 100%)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-[86px] w-auto" draggable={false} />

          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[46px] font-bold uppercase leading-none tracking-[0.02em] text-white"
              style={{ fontFamily: "var(--fuente-pizarra, inherit)" }}
            >
              {slide.titulo}
            </p>
          </div>

{/*
          | El rival y la temporada, sobre el extremo naranja del degradado. En
          | tinta oscura y no en blanco: sobre el ámbar el blanco se apaga y a
          | tamaño de chapa deja de leerse desde el fondo de la sala.
          */}
          <div className="max-w-[430px] shrink-0 text-right">
            <p className="truncate text-[22px] font-bold uppercase leading-tight tracking-[0.14em] text-[#1a1205]">
              {rival || "Balón parado"}
            </p>

            <p className="text-[13px] font-semibold uppercase tracking-[0.26em] text-[#1a1205]/65">
              Temporada {temporada}
            </p>
          </div>
        </div>

        {/* Filo rosa de la plantilla INDIVIDUAL, bajo la cabecera. */}
        <div
          className="absolute left-0"
          style={{
            top: CABECERA_H,
            width: TABLERO_W,
            height: 6,
            backgroundColor: COLORES.rosa,
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
            className="absolute rounded-2xl px-5 py-4"
            style={{
              left: PANEL.x,
              top: PANEL.y,
              width: PANEL.w,
              maxHeight: PANEL.h,
              backgroundColor: "rgba(0,48,78,.88)",
              boxShadow: "0 10px 30px rgba(0,0,0,.45)",
            }}
          >
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              {grupos.map((grupo) => {
                const delGrupo = puestos.filter(
                  (puesto) => puesto.grupo === grupo.key,
                );

                return (
                  <div key={grupo.key} className="min-w-0">
                    <p
                      className="rounded-md px-2 py-1 text-center text-[15px] font-bold uppercase tracking-[0.1em] text-white"
                      style={{ backgroundColor: "rgba(255,255,255,.14)" }}
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
                              className="shrink-0 rounded px-1.5 text-[13px] font-bold text-white"
                              style={{ backgroundColor: "rgba(255,255,255,.18)" }}
                            >
                              {puesto.code}
                            </span>

                            <span
                              className={`min-w-0 flex-1 truncate text-[15px] font-semibold uppercase ${
                                player ? "text-white" : "text-white/35"
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
            className="absolute rounded-2xl px-6 py-4"
            style={{
              left: NOTAS.x,
              top: NOTAS.y,
              width: NOTAS.w,
              maxHeight: NOTAS.h,
              backgroundColor: COLORES.papel,
              boxShadow: `0 0 0 3px ${COLORES.chapa}, 0 10px 30px rgba(0,0,0,.35)`,
            }}
          >
            <ul className="space-y-1.5">
              {slide.notas.map((nota, indice) => (
                <li
                  key={`${indice}-${nota}`}
                  className="text-[19px] font-semibold uppercase leading-tight"
                  style={{ color: COLORES.navy }}
                >
                  {nota}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
