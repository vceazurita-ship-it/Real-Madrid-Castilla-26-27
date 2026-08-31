"use client";

/*
|--------------------------------------------------------------------------
| CÓMO VA A SALIR EL ONCE — PASO PREVIO AL PDF
|--------------------------------------------------------------------------
|
| Se abre al pulsar «PDF» en el campograma de `/rivals`. Antes, el documento
| salía con el once colocado solo, por líneas, y con las dudas únicamente en
| la lista de la derecha. Un once no siempre cabe en cuatro filas —un rombo,
| un falso nueve, un lateral que sube— y hay dudas que el entrenador quiere
| ver sobre el campo, al lado del jugador al que pueden sustituir.
|
| Aquí se hacen las dos cosas antes de exportar:
|
|   · se arrastra a cada jugador a su sitio,
|   · se meten (o se sacan) las dudas que se quieren ver dibujadas,
|   · y se cambia o se quita a quien no toca, sin volver al campograma.
|
| Lo de cambiar y quitar está aquí a posta: el once se marca en el campograma
| —un clic por jugador—, pero el repaso de última hora se hace mirando el
| dibujo, y bajar a buscar la fila de un jugador en la lista para desmarcarlo
| rompía ese repaso.
|
| Lo que se ve es lo que sale: el campo se pinta con la paleta del PDF y con
| sus mismas medidas —un punto del documento es `k` píxeles aquí—, y el
| reparto automático lo hace `lib/rivals/once-campo.ts`, el mismo módulo que
| usa `once-pdf`. Todo se guarda solo en el documento del once, así que el
| jueves que viene el campo sigue como se dejó.
*/

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  ArrowLeftRight,
  FileDown,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import { reparteCampo, type OnceLinea } from "@/lib/rivals/once-campo";
import { paletaOnce } from "@/lib/rivals/once-pdf";
import type { OncePos } from "@/lib/rivals/once";
import type { Theme } from "@/lib/theme";

/**
 * Lo que hace falta saber aquí de cualquiera de la plantilla del rival.
 *
 * Vale tanto para el que ya está en el once como para el que puede entrar en
 * su lugar: la lista de recambios se pinta con las mismas caras que el campo.
 */
export type OnceCampoCandidato = {
  clave: string;
  dorsal: string;
  nombre: string;
  posCode: string;
  posicion: string;
  linea: OnceLinea | null;
  /** Color de su línea, el mismo que lleva en el campograma de la pantalla. */
  color: string;
  foto: string;
};

/** Un jugador marcado en el once. */
export type OnceCampoFicha = OnceCampoCandidato & {
  estado: "titular" | "duda";
  /** Si se pinta en el campo. Las dudas entran y salen desde aquí. */
  enCampo: boolean;
};

interface OnceCampoDialogProps {
  equipo: string;
  jugadores: OnceCampoFicha[];
  /**
   * La plantilla entera del rival, en el orden en que se lee un once. De aquí
   * salen los recambios; los que ya están marcados vienen igualmente, para
   * poder ascender a titular a una duda sin dar dos pasos.
   */
  plantilla: OnceCampoCandidato[];
  /** Sitios puestos a mano, en tanto por uno del campo. */
  campo: Record<string, OncePos>;
  tema?: Theme;
  exportando: boolean;
  onMover: (clave: string, pos: OncePos | null) => void;
  onAlCampo: (clave: string, meter: boolean) => void;
  /** Fuera del once del todo: ni campo, ni lista, ni ficha en el PDF. */
  onQuitar: (clave: string) => void;
  /**
   * Meter a alguien de la plantilla en el once, como titular.
   *
   * El once se marca en el campograma, pero se **empieza** aquí cuando no hay
   * nada marcado: sin esto, abrir el pop-up de un equipo sin once daba un campo
   * vacío y ninguna manera de llenarlo.
   */
  onAnadir: (clave: string) => void;
  /** Uno por otro; el que entra hereda el sitio y el estado del que sale. */
  onSustituir: (saliente: string, entrante: string) => void;
  /** Devuelve el campo al reparto automático por líneas. */
  onRecolocar: () => void;
  onExportar: () => void;
  onCerrar: () => void;
}

/*
| El campo del PDF, en puntos. Todo lo que se pinta aquí son estas mismas
| medidas multiplicadas por `k`, así que la vista previa no se parece al
| documento: es el documento a otra escala.
*/
const CAMPO_W = 344;
const CAMPO_H = 632;

/** Radio de la cara, igual que en `once-pdf`. */
const CARA = 16;

/*
| Lo que hay que mover el dedo para que esto sea un arrastre y no un clic.
| Sin margen, el temblor de un ratón al pulsar escribía una posición a mano
| —y ahora, además, se comería el menú del jugador, que se abre al soltar sin
| haber movido.
*/
const UMBRAL_ARRASTRE = 4;

/* ---------------- COLOR ---------------- */

function aRgb(hex: string): [number, number, number] {
  const limpio = hex.replace("#", "");

  const entero = parseInt(
    limpio.length === 3
      ? limpio
          .split("")
          .map((c) => c + c)
          .join("")
      : limpio,
    16,
  );

  return [(entero >> 16) & 255, (entero >> 8) & 255, entero & 255];
}

/** El mismo aplastado de capas que hace el PDF: color sobre fondo, ya plano. */
function mezcla(color: string, fondo: string, alfa: number) {
  const a = aRgb(color);
  const b = aRgb(fondo);

  const canal = (i: number) => Math.round(a[i] * alfa + b[i] * (1 - alfa));

  return `rgb(${canal(0)}, ${canal(1)}, ${canal(2)})`;
}

/* ---------------- EL CAMPO ---------------- */

/**
 * El césped, calcado de `dibujaCampo`: franjas de siega, perímetro, medio
 * campo, círculo central y las dos áreas con su punto de penalti.
 */
function Cesped({ paleta }: { paleta: ReturnType<typeof paletaOnce> }) {
  const margen = 13;
  const izq = margen;
  const der = CAMPO_W - margen;
  const arriba = margen;
  const abajo = CAMPO_H - margen;
  const cx = CAMPO_W / 2;

  const areaW = (der - izq) * 0.6;
  const areaH = (abajo - arriba) * 0.15;
  const chicaW = (der - izq) * 0.28;
  const chicaH = (abajo - arriba) * 0.055;

  const franjas = 8;
  const altoFranja = CAMPO_H / franjas;

  return (
    <svg
      viewBox={`0 0 ${CAMPO_W} ${CAMPO_H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <rect
        x={0.5}
        y={0.5}
        width={CAMPO_W - 1}
        height={CAMPO_H - 1}
        rx={8}
        fill={paleta.cesped}
        stroke={paleta.borde}
        strokeWidth={0.8}
      />

      {Array.from({ length: franjas })
        .map((_, i) => i)
        .filter((i) => i % 2 === 0)
        .map((i) => (
          <rect
            key={i}
            x={1}
            y={1 + i * altoFranja}
            width={CAMPO_W - 2}
            height={altoFranja}
            fill={paleta.siega}
          />
        ))}

      <g stroke={paleta.lineaCampo} strokeWidth={0.8} fill="none">
        <rect x={izq} y={arriba} width={der - izq} height={abajo - arriba} />
        <line x1={izq} y1={CAMPO_H / 2} x2={der} y2={CAMPO_H / 2} />
        <circle cx={cx} cy={CAMPO_H / 2} r={(der - izq) * 0.155} />

        <rect x={cx - areaW / 2} y={arriba} width={areaW} height={areaH} />
        <rect x={cx - chicaW / 2} y={arriba} width={chicaW} height={chicaH} />
        <rect
          x={cx - areaW / 2}
          y={abajo - areaH}
          width={areaW}
          height={areaH}
        />
        <rect
          x={cx - chicaW / 2}
          y={abajo - chicaH}
          width={chicaW}
          height={chicaH}
        />
      </g>

      <g fill={paleta.lineaCampo}>
        <circle cx={cx} cy={CAMPO_H / 2} r={1.4} />
        <circle cx={cx} cy={arriba + areaH * 0.68} r={1.2} />
        <circle cx={cx} cy={abajo - areaH * 0.68} r={1.2} />
      </g>
    </svg>
  );
}

/* ---------------- LA CARA DE UN JUGADOR ---------------- */

function Cara({
  jugador,
  paleta,
  k,
  hueco,
  arrastrando,
}: {
  jugador: OnceCampoFicha;
  paleta: ReturnType<typeof paletaOnce>;
  /** Píxeles por punto del PDF. */
  k: number;
  /** Lo que puede ocupar el nombre sin pisar al vecino, en puntos. */
  hueco: number;
  arrastrando: boolean;
}) {
  const color = jugador.estado === "titular" ? paleta.verde : paleta.ambar;
  const lado = CARA * 2 * k;

  return (
    <div
      className="relative select-none"
      style={{ width: lado, height: lado }}
    >
      <div
        className="h-full w-full overflow-hidden rounded-full"
        style={{
          background: mezcla(jugador.color, paleta.cesped, 0.32),
          border: `${Math.max(1.4 * k, 1)}px ${
            jugador.estado === "duda" ? "dashed" : "solid"
          } ${color}`,
          boxShadow: arrastrando ? `0 ${6 * k}px ${14 * k}px rgba(0,0,0,0.45)` : undefined,
        }}
      >
        {jugador.foto ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={jugador.foto}
            alt={jugador.nombre}
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserRound
            size={Math.round(lado * 0.55)}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ color: paleta.tintaTenue }}
          />
        )}
      </div>

      {/* DORSAL — chapa dorada abajo a la derecha, como en el PDF: dentro del
          círculo taparía la cara. */}
      <span
        className="absolute flex items-center justify-center rounded-full font-bold"
        style={{
          right: -3 * k,
          bottom: -2 * k,
          height: 11 * k,
          minWidth: 14 * k,
          padding: `0 ${4 * k}px`,
          fontSize: 7 * k,
          lineHeight: 1,
          background: paleta.oro,
          border: `${Math.max(0.8 * k, 0.5)}px solid ${paleta.cesped}`,
          color: paleta.fondo,
        }}
      >
        {jugador.dorsal || "—"}
      </span>

      {/* NOMBRE Y POSICIÓN — debajo de la cara, con el ancho que le deja su
          hueco en la línea: es el mismo recorte que hace el documento. */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center"
        style={{ top: `calc(100% + ${3 * k}px)`, width: hueco * k }}
      >
        <p
          className="truncate font-bold"
          style={{ fontSize: 7 * k, lineHeight: 1.15, color: paleta.tinta }}
        >
          {jugador.nombre}
        </p>
        <p
          className="truncate"
          style={{
            fontSize: 5.5 * k,
            lineHeight: 1.2,
            color: mezcla(jugador.color, paleta.cesped, 0.85),
          }}
        >
          {jugador.posCode || jugador.posicion}
        </p>
      </div>
    </div>
  );
}

/* ---------------- CAMBIAR O QUITAR ---------------- */

const normaliza = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** La cara de alguien de la plantilla, en pequeño y sin dorsal. */
function Retrato({
  jugador,
  tamano = 32,
  borde = "rgba(255,255,255,0.15)",
}: {
  jugador: OnceCampoCandidato;
  tamano?: number;
  borde?: string;
}) {
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-full border bg-black/40"
      style={{ width: tamano, height: tamano, borderColor: borde }}
    >
      {jugador.foto ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={jugador.foto}
          alt={jugador.nombre}
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <UserRound
          size={Math.round(tamano * 0.5)}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/25"
        />
      )}
    </span>
  );
}

/**
 * Qué hacer con el jugador que se acaba de pulsar.
 *
 * Dos salidas en una sola pantalla: quitarlo del once, o cambiarlo por
 * cualquiera de la plantilla. La lista trae a todos —también a los que ya
 * están marcados, avisando de cómo—, porque el cambio más habitual el viernes
 * es «éste no, el que tenía de duda».
 *
 * **Sin `jugador` es el menú de añadir**: la misma lista y el mismo buscador,
 * sin nadie a quien quitar ni sustituir. Hace falta porque el once se empieza a
 * montar aquí, no sólo en el campograma: hasta ahora, un equipo sin nadie
 * marcado abría este pop-up con el campo vacío y sin manera de meter a nadie.
 */
function MenuJugador({
  jugador,
  plantilla,
  enElOnce,
  onQuitar,
  onSustituir,
  onCerrar,
}: {
  jugador: OnceCampoFicha | null;
  plantilla: OnceCampoCandidato[];
  /** clave → cómo está marcado ahora mismo, para avisar en la lista. */
  enElOnce: Map<string, "titular" | "duda">;
  onQuitar: () => void;
  onSustituir: (entrante: string) => void;
  onCerrar: () => void;
}) {
  const [busca, setBusca] = useState("");

  const candidatos = useMemo(() => {
    const query = normaliza(busca.trim());

    return plantilla
      .filter((item) => item.clave !== jugador?.clave)
      .filter((item) => {
        if (!query) return true;

        return (
          normaliza(item.nombre).includes(query) ||
          normaliza(item.posicion).includes(query) ||
          normaliza(item.posCode).includes(query) ||
          item.dorsal.includes(query)
        );
      });
  }, [plantilla, jugador?.clave, busca]);

  return (
    <div
      className="modal-veil fixed inset-0 z-[70] flex items-center justify-center p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={
        jugador ? `Cambiar o quitar a ${jugador.nombre}` : "Añadir al once"
      }
      onClick={(evento) => {
        evento.stopPropagation();
        onCerrar();
      }}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11161D] shadow-2xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        {/* QUIÉN */}

        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          {jugador ? (
            <>
              <Retrato
                jugador={jugador}
                tamano={40}
                borde={jugador.estado === "titular" ? "#34D399" : "#FBBF24"}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{jugador.nombre}</p>
                <p className="truncate text-[11px] text-white/40">
                  {jugador.dorsal ? `${jugador.dorsal} · ` : ""}
                  {jugador.posCode || jugador.posicion || "Sin posición"} ·{" "}
                  <span
                    style={{
                      color:
                        jugador.estado === "titular" ? "#34D399" : "#FBBF24",
                    }}
                  >
                    {jugador.estado === "titular" ? "Titular" : "Duda"}
                  </span>
                </p>
              </div>
            </>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Añadir al once</p>
              <p className="truncate text-[11px] text-white/40">
                Entra como titular; después se coloca en el campo
              </p>
            </div>
          )}

          <button
            type="button"
            data-export-hide
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-full border border-white/10 p-2 text-white/40 transition hover:border-white/30 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        {/* QUITAR */}

        {jugador && (
          <div className="border-b border-white/10 p-3">
            <button
              type="button"
              data-export-hide
              onClick={onQuitar}
              className="flex w-full items-center gap-2 rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-xs font-semibold text-[#F87171] transition hover:bg-[#F87171]/20"
            >
              <Trash2 size={14} />
              Quitar del once
              <span className="ml-auto text-[10px] font-normal text-[#F87171]/60">
                sale también del PDF
              </span>
            </button>
          </div>
        )}

        {/* CAMBIAR POR / AÑADIR */}

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-3 pt-3">
            {jugador ? (
              <ArrowLeftRight size={13} className="text-white/35" />
            ) : (
              <Plus size={13} className="text-white/35" />
            )}
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              {jugador ? "CAMBIAR POR" : "ELIGE DE LA PLANTILLA"}
            </p>
          </div>

          <div className="relative m-3 mb-2">
            <Search
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
            />
            <input
              autoFocus
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Nombre, dorsal o posición"
              className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-8 pr-3 text-xs outline-none transition placeholder:text-white/25 focus:border-white/30"
            />
          </div>

          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
            {candidatos.length === 0 && (
              <li className="px-1 py-3 text-xs text-white/35">
                Nadie más en la plantilla con ese nombre.
              </li>
            )}

            {candidatos.map((item) => {
              const marcado = enElOnce.get(item.clave);

              return (
                <li key={item.clave}>
                  <button
                    type="button"
                    data-export-hide
                    onClick={() => onSustituir(item.clave)}
                    className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-black/20 p-1.5 text-left transition hover:border-white/25 hover:bg-black/40"
                  >
                    <Retrato jugador={item} />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">
                        {item.nombre}
                      </span>
                      <span className="block truncate text-[10px] text-white/35">
                        {item.dorsal ? `${item.dorsal} · ` : ""}
                        {item.posCode || item.posicion || "Sin posición"}
                      </span>
                    </span>

                    {/* Ya marcado: se puede elegir igual —dejará el hueco que
                        tenía—, pero hay que decirlo antes de pulsar. */}
                    {marcado && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          color: marcado === "titular" ? "#34D399" : "#FBBF24",
                          background:
                            marcado === "titular"
                              ? "rgba(52,211,153,0.12)"
                              : "rgba(251,191,36,0.12)",
                        }}
                      >
                        {marcado === "titular" ? "Titular" : "Duda"}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------------- EL POP-UP ---------------- */

export default function OnceCampoDialog({
  equipo,
  jugadores,
  plantilla,
  campo,
  tema,
  exportando,
  onMover,
  onAlCampo,
  onQuitar,
  onAnadir,
  onSustituir,
  onRecolocar,
  onExportar,
  onCerrar,
}: OnceCampoDialogProps) {
  const paleta = useMemo(() => paletaOnce(tema), [tema]);

  const campoRef = useRef<HTMLDivElement | null>(null);

  /* El ancho real del campo en pantalla: de ahí sale `k`, y con `k` sale todo
     lo demás. Cambia al redimensionar la ventana, así que se vigila. */
  const [ancho, setAncho] = useState(0);

  useEffect(() => {
    const nodo = campoRef.current;

    if (!nodo) return;

    const observador = new ResizeObserver(([entrada]) => {
      setAncho(entrada.contentRect.width);
    });

    observador.observe(nodo);

    return () => observador.disconnect();
  }, []);

  const k = ancho > 0 ? ancho / CAMPO_W : 0;

  useBodyScrollLock(true);

  /*
  | El jugador cuyo menú está abierto. Se llega pulsándolo —en el campo, en la
  | lista de dudas o en el aviso de los que no tienen sitio—, y desde ahí se le
  | quita del once o se le cambia por otro.
  */
  const [menu, setMenu] = useState<string | null>(null);

  /* El mismo menú, pero para meter a alguien nuevo: sin nadie a quien quitar. */
  const [anadiendo, setAnadiendo] = useState(false);

  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;

      /* El escape cierra primero el menú: si se llevara por delante el pop-up
         entero, deshacer un clic costaría volver a colocar el once. */
      if (menu) setMenu(null);
      else if (anadiendo) setAnadiendo(false);
      else onCerrar();
    };

    window.addEventListener("keydown", alPulsar);

    return () => window.removeEventListener("keydown", alPulsar);
  }, [anadiendo, menu, onCerrar]);

  /*
  | Quién se pinta y dónde. El reparto es el del PDF: quien tenga sitio puesto
  | a mano se queda donde se le dejó, y el resto se coloca con su línea.
  */
  const enElCampo = useMemo(
    () =>
      jugadores.filter(
        (jugador) =>
          jugador.linea !== null &&
          (jugador.estado === "titular" || jugador.enCampo),
      ),
    [jugadores],
  );

  const sitios = useMemo(() => reparteCampo(enElCampo, campo), [enElCampo, campo]);

  const dudas = useMemo(
    () => jugadores.filter((jugador) => jugador.estado === "duda"),
    [jugadores],
  );

  /* Cómo está marcado cada uno, para avisarlo en la lista de recambios. */
  const enElOnce = useMemo(
    () =>
      new Map(
        jugadores.map(
          (jugador) => [jugador.clave, jugador.estado] as const,
        ),
      ),
    [jugadores],
  );

  /* El del menú se busca en la lista viva: al quitarlo desaparece de ella y
     el menú se cierra solo, sin tener que acordarse de cerrarlo. */
  const enMenu = useMemo(
    () => jugadores.find((jugador) => jugador.clave === menu) ?? null,
    [jugadores, menu],
  );

  /* Un titular sin posición reconocible no tiene sitio en el campo, ni aquí
     ni en el PDF: se avisa para que no parezca que se ha perdido. */
  const sinSitio = useMemo(
    () => jugadores.filter((jugador) => jugador.linea === null),
    [jugadores],
  );

  /*
  |------------------------------------------------------------------------
  | ARRASTRE
  |------------------------------------------------------------------------
  | Uno solo para los dos casos: mover a alguien por el campo y traerlo desde
  | la lista de dudas. Mientras dura, el que se mueve se pinta como un
  | fantasma pegado al dedo (`position: fixed`), así que da igual de dónde
  | haya salido; lo que decide qué pasa al soltar es dónde se suelta.
  */
  type Arrastre = {
    clave: string;
    /** Dónde está la cara ahora mismo, en píxeles de pantalla. */
    cx: number;
    cy: number;
    /** Del dedo al centro de la cara: sin esto la cara pega un salto. */
    dx: number;
    dy: number;
    desdeElCampo: boolean;
    /** Dónde se pulsó, para medir si esto llega a ser un arrastre. */
    px: number;
    py: number;
    /** Para no confundir un clic con un arrastre de un píxel. */
    movido: boolean;
  };

  const [arrastre, setArrastre] = useState<Arrastre | null>(null);

  /* El arrastre se lleva también en una `ref`: los manejadores viven en
     `window` y tienen que leer el valor de ahora mismo, no el del render en
     el que se engancharon. */
  const arrastreRef = useRef<Arrastre | null>(null);

  const ponArrastre = useCallback((valor: Arrastre | null) => {
    arrastreRef.current = valor;
    setArrastre(valor);
  }, []);

  const empezar = useCallback(
    (
      evento: ReactPointerEvent,
      jugador: OnceCampoFicha,
      desdeElCampo: boolean,
    ) => {
      /* Sólo el botón principal: con el derecho se abre el menú del sistema y
         el arrastre se quedaría enganchado. */
      if (evento.button !== 0) return;

      const caja = (evento.currentTarget as HTMLElement).getBoundingClientRect();

      ponArrastre({
        clave: jugador.clave,
        cx: caja.left + caja.width / 2,
        cy: caja.top + caja.height / 2,
        dx: caja.left + caja.width / 2 - evento.clientX,
        dy: caja.top + caja.height / 2 - evento.clientY,
        desdeElCampo,
        px: evento.clientX,
        py: evento.clientY,
        movido: false,
      });
    },
    [ponArrastre],
  );

  const arrastrando = arrastre !== null;

  useEffect(() => {
    if (!arrastrando) return;

    const alMover = (evento: PointerEvent) => {
      const actual = arrastreRef.current;

      if (!actual) return;

      evento.preventDefault();

      const lejos =
        Math.abs(evento.clientX - actual.px) > UMBRAL_ARRASTRE ||
        Math.abs(evento.clientY - actual.py) > UMBRAL_ARRASTRE;

      ponArrastre({
        ...actual,
        cx: evento.clientX + actual.dx,
        cy: evento.clientY + actual.dy,
        movido: actual.movido || lejos,
      });
    };

    const alSoltar = () => {
      const actual = arrastreRef.current;

      ponArrastre(null);

      if (!actual) return;

      const caja = campoRef.current?.getBoundingClientRect();

      const dentro =
        caja &&
        actual.cx >= caja.left &&
        actual.cx <= caja.right &&
        actual.cy >= caja.top &&
        actual.cy <= caja.bottom;

      if (dentro && caja) {
        /* Pulsar sin arrastrar no coloca nada: abre el menú del jugador, que
           es desde donde se le cambia o se le quita. */
        if (actual.desdeElCampo && !actual.movido) {
          setMenu(actual.clave);

          return;
        }

        const pos = {
          x: (actual.cx - caja.left) / caja.width,
          y: (actual.cy - caja.top) / caja.height,
        };

        /* Traído desde la lista: primero entra, y ya con sitio propio. */
        if (!actual.desdeElCampo) onAlCampo(actual.clave, true);

        if (actual.movido || !actual.desdeElCampo) onMover(actual.clave, pos);

        return;
      }

      /* Soltado fuera del campo: una duda se sale —es la forma natural de
         quitarla— y un titular se queda donde estaba, porque el once no se
         deshace arrastrando. */
      if (!actual.desdeElCampo || !actual.movido) return;

      const jugador = jugadores.find((item) => item.clave === actual.clave);

      if (jugador?.estado === "duda") onAlCampo(actual.clave, false);
    };

    window.addEventListener("pointermove", alMover, { passive: false });
    window.addEventListener("pointerup", alSoltar);
    window.addEventListener("pointercancel", alSoltar);

    return () => {
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("pointerup", alSoltar);
      window.removeEventListener("pointercancel", alSoltar);
    };
  }, [arrastrando, jugadores, onAlCampo, onMover, ponArrastre]);

  const enArrastre = arrastre
    ? jugadores.find((jugador) => jugador.clave === arrastre.clave)
    : undefined;

  const dudasDentro = dudas.filter((jugador) => jugador.enCampo).length;

  return (
    <div
      className="modal-veil fixed inset-0 z-50 flex items-center justify-center p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cómo va a salir el once en el PDF"
      onClick={onCerrar}
    >
      <div
        data-export-panel
        className="flex max-h-[96vh] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11161D] shadow-2xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        {/* CABECERA */}

        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
              CÓMO VA A SALIR EL ONCE
              {equipo && (
                <span className="ml-2 normal-case tracking-normal text-white/30">
                  · {equipo}
                </span>
              )}
            </h2>

            <p className="mt-1 text-xs text-white/40">
              Arrastra a los jugadores por el campo y decide qué dudas se
              pintan además de los titulares. Pulsa a cualquiera para
              cambiarlo por otro o quitarlo. El PDF sale así.
            </p>
          </div>

          <button
            type="button"
            data-export-hide
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-full border border-white/10 p-2 text-white/40 transition hover:border-white/30 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* CUERPO */}

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row">
          {/* ---------------- CAMPO ---------------- */}

          <div className="flex justify-center lg:flex-1">
            <div
              ref={campoRef}
              /* El alto va en firme y el ancho sale de la proporción del campo
                 del PDF. Con `h-full` el campo se quedaba sin alto —nadie se
                 lo daba— y no se pintaba ni una cara. */
              className="relative w-full max-w-[340px] lg:h-[min(68vh,720px)] lg:w-auto lg:max-w-none"
              style={{ aspectRatio: `${CAMPO_W} / ${CAMPO_H}` }}
            >
              <Cesped paleta={paleta} />

              {k > 0 &&
                enElCampo.map((jugador) => {
                  const sitio = sitios.get(jugador.clave);

                  if (!sitio) return null;

                  const moviendose = arrastre?.clave === jugador.clave;

                  return (
                    <div
                      key={jugador.clave}
                      onPointerDown={(evento) => empezar(evento, jugador, true)}
                      title={`${jugador.nombre} — púlsalo para cambiarlo o quitarlo, arrástralo para colocarlo${
                        jugador.estado === "duda"
                          ? "; sácalo del campo para dejarlo sólo en la lista"
                          : ""
                      }`}
                      className="absolute cursor-grab touch-none active:cursor-grabbing"
                      style={{
                        left: `${sitio.x * 100}%`,
                        top: `${sitio.y * 100}%`,
                        transform: "translate(-50%, -50%)",
                        /* El que se está moviendo va pegado al dedo, aparte;
                           aquí sólo queda su hueco. Un clic no vacía nada: el
                           fantasma no sale hasta que hay arrastre de verdad. */
                        opacity: moviendose && arrastre?.movido ? 0.25 : 1,
                        zIndex: jugador.estado === "titular" ? 2 : 1,
                      }}
                    >
                      <Cara
                        jugador={jugador}
                        paleta={paleta}
                        k={k}
                        hueco={Math.min(sitio.ancho * CAMPO_W - 4, 78)}
                        arrastrando={false}
                      />
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ---------------- DUDAS Y AVISOS ---------------- */}

          <div className="w-full shrink-0 space-y-3 lg:w-[286px] lg:overflow-y-auto">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                EN EL CAMPO
              </p>

              <p className="mt-1 text-sm text-white/70">
                {enElCampo.filter((j) => j.estado === "titular").length}{" "}
                titulares
                {dudasDentro > 0 && ` + ${dudasDentro} dudas`}
              </p>

              {/*
                El once se marca en el campograma, pero se puede montar entero
                desde aquí: con un rival al que todavía no se ha mirado, éste es
                el primer sitio al que se llega.
              */}
              <button
                type="button"
                data-export-hide
                onClick={() => setAnadiendo(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#34D399]/35 bg-[#34D399]/10 px-3 py-2 text-xs font-semibold text-[#34D399] transition hover:bg-[#34D399]/20"
              >
                <Plus size={14} />
                Añadir al once
              </button>

              {jugadores.length === 0 && (
                <p className="mt-2 text-[11px] text-white/40">
                  Este equipo no tiene once marcado todavía. Añade a los
                  titulares y colócalos en el campo.
                </p>
              )}
            </div>

            {/* Las dudas: se meten con el + o arrastrándolas al campo. */}

            <div className="rounded-xl border border-[#FBBF24]/25 bg-[#FBBF24]/[0.06] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#FBBF24]">
                DUDAS · {dudas.length}
              </p>

              {dudas.length === 0 ? (
                <p className="mt-2 text-xs text-white/35">
                  No hay ninguna duda marcada en este once.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-[11px] text-white/40">
                    Mete en el campo las que quieras ver dibujadas. Las demás
                    salen sólo en la lista del PDF, con su ficha.
                  </p>

                  <ul className="mt-2 space-y-1">
                    {dudas.map((jugador) => (
                      <li
                        key={jugador.clave}
                        className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 p-1.5"
                      >
                        <span
                          onPointerDown={(evento) =>
                            !jugador.enCampo && empezar(evento, jugador, false)
                          }
                          title={
                            jugador.enCampo
                              ? "Ya está en el campo"
                              : "Arrástralo al campo o pulsa +"
                          }
                          className={`relative h-8 w-8 shrink-0 overflow-hidden rounded-full border bg-black/40 ${
                            jugador.enCampo
                              ? ""
                              : "cursor-grab touch-none active:cursor-grabbing"
                          }`}
                          style={{
                            borderColor: jugador.enCampo
                              ? "#FBBF24"
                              : "rgba(255,255,255,0.15)",
                            borderStyle: "dashed",
                            opacity:
                              arrastre?.clave === jugador.clave ? 0.25 : 1,
                          }}
                        >
                          {jugador.foto ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={jugador.foto}
                              alt={jugador.nombre}
                              draggable={false}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserRound
                              size={16}
                              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/25"
                            />
                          )}
                        </span>

                        <button
                          type="button"
                          data-export-hide
                          onClick={() => setMenu(jugador.clave)}
                          title="Cambiar por otro o quitar del once"
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-xs font-semibold">
                            {jugador.nombre}
                          </span>
                          <span className="block truncate text-[10px] text-white/35">
                            {jugador.dorsal ? `${jugador.dorsal} · ` : ""}
                            {jugador.posCode || jugador.posicion || "Sin posición"}
                          </span>
                        </button>

                        {jugador.linea === null ? (
                          <span
                            title="Sin posición reconocible: no puede colocarse en el campo"
                            className="shrink-0 px-1 text-[10px] text-white/25"
                          >
                            —
                          </span>
                        ) : (
                          <button
                            type="button"
                            data-export-hide
                            /* Entra sin sitio propio a propósito: así toda su
                               línea se reparte de nuevo a partes iguales y no
                               queda apretujada contra el vecino. Para ponerlo
                               en un sitio concreto está el arrastre. */
                            onClick={() =>
                              onAlCampo(jugador.clave, !jugador.enCampo)
                            }
                            title={
                              jugador.enCampo
                                ? "Quitar del campo"
                                : "Pintar en el campo"
                            }
                            className={`shrink-0 rounded-full border p-1 transition ${
                              jugador.enCampo
                                ? "border-[#FBBF24]/50 bg-[#FBBF24]/15 text-[#FBBF24] hover:bg-[#FBBF24]/25"
                                : "border-white/15 text-white/40 hover:border-white/40 hover:text-white"
                            }`}
                          >
                            {jugador.enCampo ? (
                              <Minus size={13} />
                            ) : (
                              <Plus size={13} />
                            )}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Sin sitio en el campo no hay cara que pulsar, así que se les
                da una fila aquí: si no, no habría manera de cambiarlos ni de
                quitarlos sin volver al campograma. */}

            {sinSitio.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[11px] text-white/40">
                  {sinSitio.length === 1
                    ? `${sinSitio[0].nombre} no tiene posición reconocible`
                    : `${sinSitio.length} jugadores no tienen posición reconocible`}
                  : saldrán en la lista del PDF y con su ficha, pero no en el
                  campo.
                </p>

                <ul className="mt-2 space-y-1">
                  {sinSitio.map((jugador) => (
                    <li key={jugador.clave}>
                      <button
                        type="button"
                        data-export-hide
                        onClick={() => setMenu(jugador.clave)}
                        title="Cambiar por otro o quitar del once"
                        className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-black/20 p-1.5 text-left transition hover:border-white/25"
                      >
                        <Retrato jugador={jugador} tamano={28} />

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">
                            {jugador.nombre}
                          </span>
                          <span className="block truncate text-[10px] text-white/35">
                            {jugador.dorsal ? `${jugador.dorsal} · ` : ""}
                            {jugador.posicion || "Sin posición"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* PIE */}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-3 sm:p-4">
          <button
            type="button"
            data-export-hide
            onClick={onRecolocar}
            title="Volver a colocar a todos por líneas"
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition hover:border-white/30 hover:text-white"
          >
            <RotateCcw size={13} />
            Colocarlos solos
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-export-hide
              onClick={onCerrar}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition hover:border-white/30 hover:text-white"
            >
              Cerrar
            </button>

            <button
              type="button"
              data-export-hide
              onClick={onExportar}
              /* Sin nadie en el once no hay documento que sacar: el botón lo
                 dice en vez de no hacer nada al pulsarlo. */
              disabled={exportando || jugadores.length === 0}
              title={
                jugadores.length === 0
                  ? "Añade primero a los titulares"
                  : "Descargar el PDF del once probable"
              }
              className="flex items-center gap-2 rounded-lg border border-[#C8A96B]/40 bg-[#C8A96B]/15 px-4 py-2 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/25 disabled:opacity-50"
            >
              {exportando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileDown size={14} />
              )}
              Descargar PDF
            </button>
          </div>
        </div>
      </div>

      {/* El que se está moviendo, pegado al dedo y por encima de todo. */}

      {arrastre?.movido && enArrastre && k > 0 && (
        <div
          className="pointer-events-none fixed z-[60]"
          style={{
            left: arrastre.cx,
            top: arrastre.cy,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Cara
            jugador={enArrastre}
            paleta={paleta}
            k={k}
            hueco={78}
            arrastrando
          />
        </div>
      )}

      {/* CAMBIAR O QUITAR AL QUE SE HA PULSADO */}

      {enMenu && (
        <MenuJugador
          jugador={enMenu}
          plantilla={plantilla}
          enElOnce={enElOnce}
          onQuitar={() => {
            onQuitar(enMenu.clave);
            setMenu(null);
          }}
          onSustituir={(entrante) => {
            onSustituir(enMenu.clave, entrante);
            setMenu(null);
          }}
          onCerrar={() => setMenu(null)}
        />
      )}

      {/* AÑADIR A ALGUIEN AL ONCE */}

      {anadiendo && (
        <MenuJugador
          jugador={null}
          plantilla={plantilla}
          enElOnce={enElOnce}
          onQuitar={() => setAnadiendo(false)}
          onSustituir={(entrante) => {
            onAnadir(entrante);

            /* Se queda abierto: montar un once son once clics seguidos y
               cerrar el buscador después de cada uno es once veces abrirlo. */
          }}
          onCerrar={() => setAnadiendo(false)}
        />
      )}
    </div>
  );
}
