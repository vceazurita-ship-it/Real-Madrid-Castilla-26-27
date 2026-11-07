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
import { useState, type CSSProperties, type ReactNode } from "react";

import { demarcacion, demarcacionDePosicion } from "@/lib/sesion-equipos/demarcacion";
import {
  formateaDuracion,
  formateaTotal,
  tasaDeAcierto,
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

/**
 * Texto explicativo largo plegado a una línea con «Ver más» (24/10/2026,
 * crítica del analista): quien sólo quiere marcar cortes no tiene que leerlo.
 */
export function NotaPlegable({
  resumen,
  children,
  className = "",
}: {
  resumen: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <div className={className}>
      <p className="text-[11px] leading-relaxed">
        {resumen}{" "}
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          className="text-[#C8A96B] underline-offset-2 hover:underline"
        >
          {abierta ? "Ver menos" : "Ver más"}
        </button>
      </p>
      {abierta ? <div className="mt-1 text-[11px] leading-relaxed">{children}</div> : null}
    </div>
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
  const [busca, setBusca] = useState("");

  if (jugadores.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-xs text-white/35">
        No hay jugadores en la lista.
      </p>
    );
  }

  /*
  | Del undécimo en adelante, buscador. Las teclas que les tocan son signos
  | sueltos —ñ , . - +— que en la tarjeta se leían como etiquetas vacías; la
  | tecla sigue funcionando y se ve al pasar por encima, pero a esos se les
  | encuentra mejor escribiendo el nombre o el dorsal.
  */
  const conBuscador = jugadores.length > 10;
  const texto = busca.trim().toLowerCase();
  const visibles = texto
    ? jugadores.filter(
        (jugador) =>
          jugador.nombre.toLowerCase().includes(texto) ||
          String(jugador.dorsal ?? "") === texto,
      )
    : jugadores;

  return (
    <div className="space-y-2">
      {conBuscador && (
        <label className="block">
          <span className="sr-only">Buscar jugador por nombre o dorsal</span>
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nombre o dorsal"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-white placeholder:text-white/30 focus:border-[#C8A96B]/60 focus:outline-none"
          />
        </label>
      )}

      {visibles.length === 0 && (
        <p className="px-1 py-3 text-center text-xs text-white/35">
          Nadie con «{busca.trim()}».
        </p>
      )}

    <ul className="grid gap-1.5 sm:grid-cols-2">
      {visibles.map((jugador) => {
        const seleccionado = jugador.id === activo;
        const tecla = teclas[jugador.id] ?? "";
        const clips = cuentas[jugador.id] ?? 0;
        /* La tecla a la vista sólo en los diez primeros de la convocatoria. */
        const teclaVisible = tecla && jugadores.indexOf(jugador) < 10 ? tecla : "";
        /* El puesto con su nombre: «6» es el rol, y se leía como dorsal. */
        const puesto = jugador.posicion
          ? (demarcacion(demarcacionDePosicion(jugador.posicion))?.nombre.replace(/ \(\d+\)$/, "") ??
            jugador.posicion)
          : "";

        return (
          <li key={jugador.id}>
            <button
              type="button"
              onClick={() => onElegir(jugador.id)}
              title={tecla && !teclaVisible ? `Tecla: ${tecla}` : undefined}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                seleccionado
                  ? "border-[#C8A96B] bg-[#C8A96B]/[0.12]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              {/*
              | Sin tecla libre —una convocatoria larga agota las del teclado—
              | no se pinta una tecla con una raya dentro, que se lee como «la
              | tecla guion»: se deja el hueco en blanco para que se vea que a
              | éste se le elige con el ratón, el dedo o desde la barra.
              */}
              {teclaVisible ? (
                <Tecla activa={seleccionado}>{teclaVisible}</Tecla>
              ) : tecla ? null : (
                <span
                  title="Sin tecla libre: se elige con el ratón o desde la barra de marcar"
                  aria-label="Sin tecla"
                  className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-dashed text-[10px] ${
                    seleccionado ? "border-[#C8A96B]/60 text-[#C8A96B]" : "border-white/10 text-white/25"
                  }`}
                >
                  ·
                </span>
              )}

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
                  {jugador.dorsal ?? jugador.nombre.slice(0, 1)}
                </span>
              )}

              <span className="min-w-0 flex-1">
                {/* 30/10/2026: el nombre entero, en dos renglones si hace falta; cortado salía «MARC JUR…». Sin partir palabras: salía «JHAFET S». */}
                <span
                  className={`block text-[12px] font-semibold leading-tight tracking-tight [overflow-wrap:normal] [word-break:keep-all] [hyphens:auto] ${
                    seleccionado ? "text-white" : "text-white/75"
                  }`}
                >
                  {jugador.nombre}
                </span>

                {puesto && (
                  <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-white/30">
                    {puesto}
                  </span>
                )}
              </span>

              {clips > 0 && (
                <span
                  key={clips}
                  className={`cdg-pulso shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                    seleccionado ? "bg-[#C8A96B] text-[#0B0F14]" : "bg-white/[0.08] text-white/60"
                  }`}
                >
                  {clips}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
    </div>
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
/**
 * Un pad de etiquetar (02/11/2026): grande, del color de lo que marca, con
 * la tecla en la esquina y el contador que salta al sumar uno. Es lo que se
 * pulsa con el dedo en la tablet, así que se ve como un botón de mesa de
 * análisis y no como una chapa.
 */
function Pad({
  color,
  nombre,
  tecla,
  cuenta,
  activo,
  onClick,
}: {
  color: string;
  nombre: string;
  tecla: string;
  cuenta: number;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title={tecla ? `${nombre} · tecla ${tecla}` : nombre}
      className="cdg-pad relative flex min-h-[64px] min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-2.5 text-left"
      style={
        {
          "--pad": color,
          borderColor: activo ? color : `${color}55`,
          background: activo
            ? `linear-gradient(160deg, ${color}55, ${color}22)`
            : `linear-gradient(160deg, ${color}26, ${color}0D)`,
        } as CSSProperties
      }
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color }}
      />

      <span className="flex items-start justify-between gap-2 pl-1">
        <span
          className={`min-w-0 break-words text-[13px] font-semibold leading-tight ${
            activo ? "text-white" : "text-white/80"
          }`}
        >
          {nombre}
        </span>

        {tecla && <Tecla activa={activo}>{tecla}</Tecla>}
      </span>

      <span className="flex items-end justify-between pl-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">
          {cuenta === 1 ? "corte" : "cortes"}
        </span>

        <span
          key={cuenta}
          className="cdg-pulso inline-block origin-right font-mono text-xl font-bold leading-none tabular-nums"
          style={{ color }}
        >
          {cuenta}
        </span>
      </span>
    </button>
  );
}

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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
      {comportamientos.map((uno) => (
        <Pad
          key={uno.id}
          color={uno.color}
          nombre={uno.nombre}
          tecla={uno.tecla ? `⇧${uno.tecla}` : ""}
          cuenta={cuentas[uno.id] ?? 0}
          activo={uno.id === activo}
          onClick={() => onElegir(uno.id)}
        />
      ))}
    </div>
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
  /* 07/11/2026: las que aún no tienen cortes van en una fila compacta de
     chips (siguen siendo pulsables y con su tecla); las tarjetas grandes,
     sólo para las que ya cuentan algo o la elegida. */
  const grandes = categorias.filter((c) => (cuentas[c.id] ?? 0) > 0 || c.id === activa);
  const vacias = categorias.filter((c) => !grandes.includes(c));

  return (
    <div className="space-y-2">
      {grandes.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
          {grandes.map((categoria) => (
            <Pad
              key={categoria.id}
              color={categoria.color}
              nombre={categoria.nombre}
              tecla={categoria.tecla}
              cuenta={cuentas[categoria.id] ?? 0}
              activo={categoria.id === activa}
              onClick={() => onElegir(categoria.id)}
            />
          ))}
        </div>
      )}

      {vacias.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {vacias.map((categoria) => (
            <button
              key={categoria.id}
              type="button"
              onClick={() => onElegir(categoria.id)}
              title={categoria.tecla ? `${categoria.nombre} · tecla ${categoria.tecla}` : categoria.nombre}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-white/75 transition hover:border-white/25 hover:text-white"
            >
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoria.color }} />
              {categoria.nombre}
              {categoria.tecla && <span className="font-mono text-[10px] text-white/45">{categoria.tecla}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MARCADOR Y RESUMEN DE LA SESIÓN                                    */
/* ------------------------------------------------------------------ */

/**
 * La cabecera de la mesa (02/11/2026): el partido como un marcador —escudos,
 * resultado si lo hay— y, al lado, cuántos cortes lleva cada etiqueta en una
 * barra apilada. Lo que no se sabe no se pinta: sin resultado, «vs».
 */
export function MarcadorCoding({
  local,
  visitante,
  resultado,
  detalle,
  total,
  porEtiqueta,
  onElegir,
}: {
  local: { nombre: string; escudo?: string };
  visitante?: { nombre: string; escudo?: string } | null;
  resultado: string;
  detalle: string;
  total: number;
  porEtiqueta: { id: string; nombre: string; color: string; cuenta: number }[];
  onElegir?: (id: string) => void;
}) {
  const conCortes = porEtiqueta.filter((una) => una.cuenta > 0);
  const suma = conCortes.reduce((acc, una) => acc + una.cuenta, 0);

  const escudo = (equipo: { nombre: string; escudo?: string }) =>
    equipo.escudo ? (
      <Image
        src={equipo.escudo}
        alt=""
        width={36}
        height={36}
        unoptimized
        className="h-9 w-9 shrink-0 object-contain"
      />
    ) : (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white/70">
        {equipo.nombre.slice(0, 2).toUpperCase()}
      </span>
    );

  return (
    <div className="siempre-oscuro cdg-consola mt-5 grid min-w-0 gap-4 rounded-2xl border p-4 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {escudo(local)}
          <span className="truncate font-['Barlow_Condensed',sans-serif] text-lg font-semibold uppercase tracking-wide text-white">
            {local.nombre}
          </span>
        </div>

        {visitante && (
          <>
            <span className="shrink-0 rounded-lg border border-[#C8A96B]/40 bg-black/40 px-3 py-1 font-mono text-xl font-bold tabular-nums text-[#C8A96B]">
              {resultado || "vs"}
            </span>

            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-['Barlow_Condensed',sans-serif] text-lg font-semibold uppercase tracking-wide text-white">
                {visitante.nombre}
              </span>
              {escudo(visitante)}
            </div>
          </>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[10px] uppercase tracking-[0.18em] text-white/45">
            {detalle}
          </span>
          <span className="shrink-0 text-[11px] text-white/55">
            <b className="font-mono text-base tabular-nums text-white">{total}</b>{" "}
            {total === 1 ? "corte" : "cortes"}
          </span>
        </div>

        {suma > 0 ? (
          <>
            <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              {conCortes.map((una) => (
                <span
                  key={una.id}
                  title={`${una.nombre} · ${una.cuenta}`}
                  className="h-full transition-[width] duration-200"
                  style={{
                    width: `${(una.cuenta / suma) * 100}%`,
                    backgroundColor: una.color,
                  }}
                />
              ))}
            </div>

            <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1">
              {conCortes.map((una) => (
                <button
                  key={una.id}
                  type="button"
                  onClick={onElegir ? () => onElegir(una.id) : undefined}
                  className="flex min-w-0 items-center gap-1.5 text-[11px] text-white/65 transition hover:text-white"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: una.color }}
                  />
                  <span className="truncate">{una.nombre}</span>
                  <b className="font-mono tabular-nums text-white">{una.cuenta}</b>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-[11px] text-white/45">
            Cada corte que marques suma aquí, por etiqueta.
          </p>
        )}
      </div>
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
  { teclas: ["O"], que: "Marcar FINAL y crear el corte" },
  { teclas: ["Intro"], que: "Un toque: la acción que acaba de pasar" },
  { teclas: ["←", "→"], que: "Un fotograma atrás / adelante" },
  { teclas: ["⇧ ←", "⇧ →"], que: "Diez fotogramas" },
  { teclas: ["Alt ←", "Alt →"], que: "Cinco segundos" },
  { teclas: ["⇧ I", "⇧ O"], que: "Inicio / final del corte elegido aquí" },
  { teclas: ["↑", "↓"], que: "Corte anterior / siguiente de la lista" },
  { teclas: ["1", "9"], que: "Elegir jugador" },
  { teclas: ["Q", "P"], que: "Elegir categoría" },
  { teclas: ["⇧ Q", "⇧ V"], que: "Elegir comportamiento colectivo" },
  { teclas: ["⇧ 1", "⇧ 9"], que: "Descriptor al último corte" },
  { teclas: ["⌫"], que: "Deshacer lo último" },
  { teclas: ["⇧ ⌫"], que: "Rehacer" },
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

  /* La columna del acierto sólo si alguien ha valorado algo. */
  const conAcierto = filas.some(
    (fila) => fila.valorados.bien + fila.valorados.mal > 0,
  );

  return (
    <ul className="space-y-1">
      <li
        aria-hidden
        className="flex items-center gap-3 px-2.5 text-[9px] uppercase tracking-[0.14em] text-white/30"
      >
        <span className="flex-1" />
        <span className="shrink-0">Cortes</span>
        {conAcierto && <span className="w-16 shrink-0 text-right">Acierto</span>}
        <span className="w-14 shrink-0 text-right">Total</span>
        <span className="w-14 shrink-0 text-right">Media</span>
      </li>

      {filas.map((fila) => {
        const tasa = tasaDeAcierto(fila.valorados);

        return (
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

            {conAcierto && (
              <span
                title={tasa?.largo}
                className={`w-16 shrink-0 text-right text-[11px] tabular-nums ${
                  tasa?.suficiente ? "text-white/70" : "text-white/35"
                }`}
              >
                {tasa?.texto ?? ""}
              </span>
            )}

            <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-white/30">
              {formateaTotal(fila.totalMs)}
            </span>

            <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-white/30">
              {formateaDuracion(fila.mediaMs)}
            </span>
          </button>
        </li>
        );
      })}
    </ul>
  );
}
