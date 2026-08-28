"use client";

/**
 * Las piezas del panel de coding.
 *
 * Todas comparten una idea: **la tecla se ve**. El analista no tiene que
 * recordar que Mestre es el 3; lo lee en la misma tarjeta que va a pulsar, y
 * la tarjeta se enciende cuando esa tecla está activa. Es lo que permite
 * codificar noventa minutos sin tocar el ratón sin haberse aprendido nada
 * antes.
 *
 * El color viene del sistema de la app —el oro `#C8A96B` para lo activo, los
 * blancos translúcidos para el resto—, así que el módulo parece parte de la
 * plataforma y no una herramienta pegada.
 */

import Image from "next/image";
import type { ReactNode } from "react";

import {
  formateaDuracion,
  formateaTotal,
  type CategoriaCoding,
  type ComportamientoColectivo,
  type JugadorCoding,
  type ResumenCoding,
} from "@/lib/coding/modelo";

/* ------------------------------------------------------------------ */
/*  TECLA                                                              */
/* ------------------------------------------------------------------ */

/** La tecla, dibujada como una tecla. */
export function Tecla({
  children,
  activa = false,
  tono = "normal",
}: {
  children: ReactNode;
  activa?: boolean;
  tono?: "normal" | "oro";
}) {
  const estilo = activa
    ? "border-[#C8A96B] bg-[#C8A96B] text-black"
    : tono === "oro"
      ? "border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B]"
      : "border-white/15 bg-white/[0.06] text-white/60";

  return (
    <kbd
      className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border px-1.5 font-mono text-[11px] font-semibold uppercase leading-none ${estilo}`}
    >
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ */
/*  JUGADORES                                                          */
/* ------------------------------------------------------------------ */

export function PanelJugadores({
  jugadores,
  teclas,
  activo,
  cuentas,
  onElegir,
}: {
  jugadores: JugadorCoding[];
  teclas: Record<string, string>;
  activo: string | null;
  /** Clips por jugador, para ver de un vistazo quién lleva trabajo hecho. */
  cuentas: Record<string, number>;
  onElegir: (id: string) => void;
}) {
  if (jugadores.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-xs text-white/35">
        No hay jugadores en la lista.
      </p>
    );
  }

  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {jugadores.map((jugador) => {
        const seleccionado = jugador.id === activo;
        const tecla = teclas[jugador.id] ?? "";
        const clips = cuentas[jugador.id] ?? 0;

        return (
          <li key={jugador.id}>
            <button
              type="button"
              onClick={() => onElegir(jugador.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                seleccionado
                  ? "border-[#C8A96B] bg-[#C8A96B]/[0.12]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <Tecla activa={seleccionado}>{tecla || "—"}</Tecla>

              {jugador.foto ? (
                <Image
                  src={jugador.foto}
                  alt=""
                  width={28}
                  height={28}
                  unoptimized
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-semibold text-white/40">
                  {jugador.dorsal ?? "—"}
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[13px] font-semibold ${
                    seleccionado ? "text-white" : "text-white/75"
                  }`}
                >
                  {jugador.nombre}
                </span>

                {jugador.posicion && (
                  <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-white/30">
                    {jugador.posicion}
                  </span>
                )}
              </span>

              {clips > 0 && (
                <span className="shrink-0 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] tabular-nums text-white/50">
                  {clips}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  COMPORTAMIENTOS COLECTIVOS                                         */
/* ------------------------------------------------------------------ */

/**
 * Lo que hace el equipo, no un jugador.
 *
 * Se enseña con la tecla en mayúscula —`⇧Q`— porque así es como se pulsa, y
 * porque de un vistazo se distingue de las de los jugadores: minúscula es
 * alguien, mayúscula es el equipo. Elegir uno **suelta al jugador** que hubiera
 * elegido, y al revés: un clip tiene un sujeto, no dos.
 */
export function PanelColectivos({
  comportamientos,
  activo,
  cuentas,
  onElegir,
}: {
  comportamientos: ComportamientoColectivo[];
  activo: string | null;
  cuentas: Record<string, number>;
  onElegir: (id: string) => void;
}) {
  if (comportamientos.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-xs text-white/35">
        No hay comportamientos configurados.
      </p>
    );
  }

  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {comportamientos.map((uno) => {
        const seleccionado = uno.id === activo;
        const clips = cuentas[uno.id] ?? 0;

        return (
          <li key={uno.id}>
            <button
              type="button"
              onClick={() => onElegir(uno.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                seleccionado
                  ? "border-[#C8A96B] bg-[#C8A96B]/[0.12]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <Tecla activa={seleccionado}>
                {uno.tecla ? `⇧${uno.tecla}` : "—"}
              </Tecla>

              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: uno.color }}
              />

              <span
                className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${
                  seleccionado ? "text-white" : "text-white/75"
                }`}
              >
                {uno.nombre}
              </span>

              {clips > 0 && (
                <span className="shrink-0 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] tabular-nums text-white/50">
                  {clips}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  CATEGORÍAS                                                         */
/* ------------------------------------------------------------------ */

export function PanelCategorias({
  categorias,
  activa,
  cuentas,
  onElegir,
}: {
  categorias: CategoriaCoding[];
  activa: string;
  cuentas: Record<string, number>;
  onElegir: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categorias.map((categoria) => {
        const seleccionada = categoria.id === activa;
        const clips = cuentas[categoria.id] ?? 0;

        return (
          <button
            key={categoria.id}
            type="button"
            onClick={() => onElegir(categoria.id)}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition ${
              seleccionada
                ? "border-[#C8A96B] bg-[#C8A96B]/[0.12]"
                : "border-white/10 bg-white/[0.02] hover:border-white/25"
            }`}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: categoria.color }}
            />

            <span
              className={`text-[12px] font-medium ${
                seleccionada ? "text-white" : "text-white/70"
              }`}
            >
              {categoria.nombre}
            </span>

            {clips > 0 && (
              <span className="text-[10px] tabular-nums text-white/35">
                {clips}
              </span>
            )}

            <Tecla activa={seleccionada}>{categoria.tecla || "—"}</Tecla>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AYUDA                                                              */
/* ------------------------------------------------------------------ */

const ATAJOS: { teclas: string[]; que: string }[] = [
  { teclas: ["Space"], que: "Reproducir / pausar" },
  { teclas: ["K"], que: "Pausar" },
  { teclas: ["J", "L"], que: "Bajar / subir velocidad" },
  { teclas: ["I"], que: "Marcar INICIO" },
  { teclas: ["O"], que: "Marcar FINAL y crear el clip" },
  { teclas: ["←", "→"], que: "Un fotograma atrás / adelante" },
  { teclas: ["⇧ ←", "⇧ →"], que: "Diez fotogramas" },
  { teclas: ["⌥ ←", "⌥ →"], que: "Cinco segundos" },
  { teclas: ["1", "9"], que: "Elegir jugador" },
  { teclas: ["Q", "P"], que: "Elegir categoría" },
  { teclas: ["⇧ Q", "⇧ V"], que: "Elegir comportamiento colectivo" },
  { teclas: ["⌫"], que: "Deshacer el último clip" },
  { teclas: ["Esc"], que: "Cancelar la marca en curso" },
  { teclas: ["?"], que: "Mostrar u ocultar esta ayuda" },
];

export function AyudaTeclado() {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {ATAJOS.map((atajo) => (
        <li
          key={atajo.que}
          className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-2.5 py-1.5"
        >
          <span className="text-[11px] text-white/50">{atajo.que}</span>

          <span className="flex shrink-0 gap-1">
            {atajo.teclas.map((tecla) => (
              <Tecla key={tecla} tono="oro">
                {tecla}
              </Tecla>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  ESTADÍSTICAS                                                       */
/* ------------------------------------------------------------------ */

export function TablaResumen({
  filas,
  vacio,
  onElegir,
  activa,
}: {
  filas: ResumenCoding[];
  vacio: string;
  onElegir?: (clave: string) => void;
  activa?: string | null;
}) {
  if (filas.length === 0) {
    return <p className="py-4 text-center text-xs text-white/30">{vacio}</p>;
  }

  return (
    <ul className="space-y-1">
      {filas.map((fila) => (
        <li key={fila.clave}>
          <button
            type="button"
            onClick={() => onElegir?.(fila.clave)}
            disabled={!onElegir}
            className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition ${
              activa === fila.clave
                ? "bg-[#C8A96B]/[0.12]"
                : onElegir
                  ? "hover:bg-white/[0.04]"
                  : ""
            }`}
          >
            <span className="min-w-0 flex-1 truncate text-[12px] text-white/70">
              {fila.etiqueta}
            </span>

            <span className="shrink-0 text-[11px] tabular-nums text-white/40">
              {fila.clips}
            </span>

            <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-white/30">
              {formateaTotal(fila.totalMs)}
            </span>

            <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-white/30">
              {formateaDuracion(fila.mediaMs)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
