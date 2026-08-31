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
  adornosDe,
  enElCampo,
  gruposDe,
  pideDorsal,
  puestoDe,
  puestosDe,
  siglaDe,
  type AdornoAbp,
  type FichaPizarra,
  type SlidePizarra,
} from "@/lib/abp/pizarra";

/** Medidas de una ficha en el lienzo, las del pptx: foto de 96×120. */
const FOTO_W = 96;
const FOTO_H = 120;
const CHAPA_H = 30;

/**
 * Quién tapa a quién.
 *
 * Manda la profundidad —cuanto más abajo está alguien, más cerca de la cámara,
 * y por tanto por delante—, que es lo que hace que el campo en perspectiva se
 * lea. Lo nuevo es el desempate **dentro de una misma fila**: gana el de la
 * izquierda.
 *
 * Sin ese desempate el orden lo decidía el DOM, y como se pintan de izquierda a
 * derecha, la cara de cada uno caía sobre la chapa del de su izquierda: en una
 * barrera o en una línea de marcas —donde se está hombro con hombro— la mitad
 * de los nombres desaparecían. Pintando al revés, lo único que se solapa es el
 * borde transparente de la foto de al lado.
 */
function profundidad(x: number, y: number) {
  return Math.round(y) * 2000 - Math.round(x);
}

/* ------------------------------------------------------------------ */
/*  UNA FICHA                                                          */
/* ------------------------------------------------------------------ */

/**
 * La casilla en blanco del dorsal del rival.
 *
 * Va encima de la cabeza, no en la chapa: la chapa dice quién es el nuestro y
 * esto dice a quién marca, y en la sala son dos lecturas distintas. Se imprime
 * vacía a propósito —el dorsal no se sabe hasta que el rival salta al campo— y
 * el papel crema con filo de oro es el mismo de la caja de consignas, así que
 * se ve que es un hueco para escribir y no un dato que falta.
 */
function CasillaDorsal() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center justify-center rounded-[5px]"
      style={{
        top: -34,
        width: 46,
        height: 34,
        backgroundColor: "rgba(247,244,236,.94)",
        boxShadow:
          "0 0 0 1.5px rgba(200,169,107,.9), 0 4px 10px rgba(0,0,0,.45)",
      }}
    >
      <span
        className="text-[9px] font-bold uppercase leading-none tracking-[0.18em]"
        style={{ color: "rgba(15,30,61,.42)" }}
      >
        Nº
      </span>
    </div>
  );
}

function Ficha({
  ficha,
  player,
  code,
  dorsal,
  seleccionada,
  onPointerDown,
  onQuitar,
}: {
  ficha: FichaPizarra;
  player: Player | undefined;
  code: string;
  /** La diapositiva pide escribir a mano el dorsal del rival al que marca. */
  dorsal: boolean;
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
        zIndex: profundidad(ficha.x, ficha.y),
      }}
      onPointerDown={onPointerDown}
    >
      {dorsal && <CasillaDorsal />}

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
          backgroundImage: `linear-gradient(180deg, ${COLORES.nocheAlto} 0%, ${COLORES.noche} 100%)`,
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
        backgroundColor: "rgba(15,32,54,.66)",
        boxShadow: "0 4px 10px rgba(0,0,0,.35)",
        zIndex: profundidad(x, y),
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
/*  ADORNOS DEL CAMPO                                                  */
/* ------------------------------------------------------------------ */

/**
 * El sitio desde el que se lanza.
 *
 * Una elipse en escorzo sobre el césped —el campo está en perspectiva, un
 * círculo se vería de canto— con el balón en el centro, y el nombre del carril
 * en una placa aparte. Es lo que le faltaba a «directas a portería», que era la
 * única diapositiva sin nada dibujado: nueve nombres en el panel y el campo
 * vacío.
 *
 * El aro se pinta por debajo de las fichas, así que si hay alguien colocado se
 * le ve de pie justo encima de su marca. **La placa del rótulo, no**: iba
 * pegada debajo del aro, que es exactamente donde se planta el segundo de la
 * columna, y las cuatro zonas salían con el nombre tapado por una cara. Ahora
 * va por encima de la cabeza del primero (`etiquetaY`) y con un z-index alto,
 * de forma que ninguna ficha pueda comérsela.
 *
 * El z-index de la placa se queda muy por debajo de lo que necesitarían el
 * panel y las consignas para taparla —ninguno de los dos llega a la banda
 * donde vive—, así que basta con que gane a las fichas.
 */
function MarcaZona({
  x,
  y,
  label,
  etiquetaY,
}: {
  x: number;
  y: number;
  label: string;
  etiquetaY?: number;
}) {
  return (
    <>
    <div
      className="pointer-events-none absolute"
      style={{ left: x - 105, top: y - 38, width: 210, zIndex: profundidad(x, y) - 1 }}
    >
      <svg width={210} height={76} viewBox="0 0 210 76" fill="none">
        <defs>
          <radialGradient id={`zona-${label}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E4CE9B" stopOpacity="0.42" />
            <stop offset="70%" stopColor="#C8A96B" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#C8A96B" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* El halo del suelo. */}
        <ellipse cx="105" cy="38" rx="88" ry="29" fill={`url(#zona-${label})`} />

        {/* El aro, en escorzo y con un filo más vivo por delante. */}
        <ellipse
          cx="105"
          cy="38"
          rx="68"
          ry="22"
          stroke="rgba(228,206,155,.85)"
          strokeWidth="2.6"
          strokeDasharray="8 7"
        />

        <ellipse
          cx="105"
          cy="38"
          rx="68"
          ry="22"
          stroke="rgba(15,32,54,.35)"
          strokeWidth="4.5"
          strokeDasharray="8 7"
          transform="translate(0 3)"
          opacity="0.5"
        />
      </svg>
    </div>

    {/*
    | La placa del rótulo.
    |
    | No es un texto suelto sobre el césped: a tamaño de proyección, un rótulo
    | dorado sobre hierba clara se pierde por mucha sombra que lleve. Con la
    | placa de tinta y filo de oro —la misma que la del rival en la cabecera—
    | se lee desde el fondo de la sala y encima queda claro que el nombre es
    | del sitio, no del jugador que tiene debajo.
    */}
    <div
      className="pointer-events-none absolute flex items-center justify-center rounded-lg px-3"
      style={{
        left: x - 115,
        top: etiquetaY ?? y + 44,
        width: 230,
        height: 34,
        zIndex: 3_000_000,
        backgroundColor: "rgba(15,32,54,.9)",
        border: "1px solid rgba(200,169,107,.5)",
        boxShadow: "0 6px 16px rgba(0,0,0,.45)",
      }}
    >
      <p
        className="truncate text-center text-[15px] font-bold uppercase leading-none tracking-[0.16em]"
        style={{
          color: COLORES.oroClaro,
          textShadow: "0 1px 4px rgba(0,0,0,.7)",
        }}
      >
        {label}
      </p>
    </div>
    </>
  );
}

/**
 * La salida de las diapositivas defensivas.
 *
 * Una acción defendida bien no acaba en el despeje: acaba en la carrera de
 * enfrente. Y no la corre uno: **son tres pasillos a la vez**, que es la única
 * forma de que una contra llegue con gente. De ahí las tres flechas —izquierda,
 * centro y derecha— abriéndose campo abajo desde nuestra área, y no la única
 * flecha horizontal que había antes: cruzada de lado a lado decía «el balón va
 * allí», no «vamos todos».
 *
 * Van en la franja de abajo del lienzo, que en las cuatro diapositivas
 * defensivas está vacía: nunca se cruzan con las caras ni con la caja de
 * consignas. Cada flecha se dibuja recta hacia abajo en su propio sistema de
 * coordenadas y se gira entera con `rotate`, así que abrir o cerrar el abanico
 * es cambiar un ángulo y nada más.
 *
 * Todo va en SVG con degradados propios: la captura del `.pptx` serializa el
 * estilo calculado y ni `filter: blur` de CSS ni `backdrop-filter` sobreviven,
 * pero un `<linearGradient>` sí. Y el degradado se declara en
 * `userSpaceOnUse`: dentro del giro, el espacio de usuario gira con la flecha,
 * y así todas arrancan apagadas y llegan encendidas a la punta.
 */

/** Largo de la flecha, y cuánto de eso es la cabeza. */
const FLECHA_ALTO = 232;
const FLECHA_CABEZA = 62;

/** Los tres pasillos: dónde arranca cada uno y cuánto se abre. */
const PASILLOS = [
  { x: 250, giro: -15 },
  { x: 520, giro: 0 },
  { x: 790, giro: 15 },
];

const FLECHA = [
  `M -9 0`,
  `L 9 0`,
  `L 17 ${FLECHA_ALTO - FLECHA_CABEZA}`,
  `L 36 ${FLECHA_ALTO - FLECHA_CABEZA}`,
  `L 0 ${FLECHA_ALTO}`,
  `L -36 ${FLECHA_ALTO - FLECHA_CABEZA}`,
  `L -17 ${FLECHA_ALTO - FLECHA_CABEZA}`,
  "Z",
].join(" ");

function FlechaTransicion({ label, remate }: { label: string; remate: string }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: 96, top: 700, width: 1040, height: 380 }}
    >
      <svg width={1040} height={330} viewBox="0 0 1040 330" fill="none">
        <defs>
          <linearGradient
            id="abp-flecha-v"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={FLECHA_ALTO}
          >
            <stop offset="0%" stopColor="#C8A96B" stopOpacity="0.06" />
            <stop offset="34%" stopColor="#C8A96B" stopOpacity="0.4" />
            <stop offset="74%" stopColor="#E4CE9B" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFF3D6" stopOpacity="1" />
          </linearGradient>

          <linearGradient
            id="abp-flecha-v-filo"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={FLECHA_ALTO}
          >
            <stop offset="0%" stopColor="#E4CE9B" stopOpacity="0" />
            <stop offset="60%" stopColor="#E4CE9B" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* La raya de la que salen las tres: de dónde arranca la contra. */}
        <path
          d="M 150 46 L 890 46"
          stroke="rgba(200,169,107,.22)"
          strokeWidth="2"
          strokeDasharray="10 9"
          strokeLinecap="round"
        />

        {PASILLOS.map((pasillo) => (
          <g
            key={pasillo.x}
            transform={`translate(${pasillo.x} 52) rotate(${pasillo.giro})`}
          >
            {/*
            | La sombra va debajo y desplazada: sin ella la flecha se pega al
            | césped y pierde el relieve que tiene el resto de la diapositiva.
            */}
            <path d={FLECHA} fill="rgba(3,12,22,.5)" transform="translate(4 10)" />

            <path d={FLECHA} fill="url(#abp-flecha-v)" />

            {/* Un filo claro por el lomo: le da el brillo metálico del oro. */}
            <path
              d={`M 0 8 L 0 ${FLECHA_ALTO - FLECHA_CABEZA - 6}`}
              stroke="url(#abp-flecha-v-filo)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Las dos estelas: velocidad sin dibujar líneas de cómic. */}
            {[-1, 1].map((lado) => (
              <path
                key={lado}
                d={`M ${lado * 30} 26 C ${lado * 36} 90, ${lado * 40} 130, ${lado * 44} ${FLECHA_ALTO - 70}`}
                stroke="rgba(200,169,107,.28)"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            ))}
          </g>
        ))}
      </svg>

      {/* El texto va fuera del SVG: la tipografía de la casa es la del HTML. */}
      <p
        className="absolute text-[17px] font-bold uppercase leading-none tracking-[0.3em]"
        style={{
          left: 12,
          top: 6,
          color: "rgba(228,206,155,.82)",
          textShadow: "0 2px 10px rgba(0,0,0,.9)",
        }}
      >
        {label}
      </p>

      <p
        className="absolute text-center text-[34px] font-bold uppercase leading-none tracking-[0.06em] text-white"
        style={{
          left: 0,
          top: 316,
          width: 1040,
          textShadow: "0 3px 14px rgba(0,0,0,.9)",
        }}
      >
        {remate}
      </p>
    </div>
  );
}

function Adorno({ adorno }: { adorno: AdornoAbp }) {
  if (adorno.tipo === "zona") {
    return (
      <MarcaZona
        x={adorno.x}
        y={adorno.y}
        label={adorno.label}
        etiquetaY={adorno.etiquetaY}
      />
    );
  }

  return <FlechaTransicion label={adorno.label} remate={adorno.remate} />;
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

  const adornos = adornosDe(slide);

  const codeDe = (ficha: FichaPizarra) => {
    const puesto = puestoDe(slide, ficha.puesto);

    if (puesto) return siglaDe(puesto);

    return players.get(ficha.playerId)?.dorsal
      ? String(players.get(ficha.playerId)?.dorsal)
      : "·";
  };

  /* La casilla del dorsal del rival la pide la plantilla, por grupos. */
  const dorsalDe = (ficha: FichaPizarra) => {
    const puesto = puestoDe(slide, ficha.puesto);

    return puesto ? pideDorsal(slide, puesto) : false;
  };

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
        {VISTAS[slide.vista].capas.map((capa) => {
          /* El difuminado del borde derecho, si la capa lo pide. */
          const mascara = capa.fundido
            ? `linear-gradient(90deg, #000 0, #000 ${capa.w - capa.fundido}px, transparent ${capa.w}px)`
            : undefined;

          return (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={capa.src}
              src={capa.src}
              alt=""
              draggable={false}
              className="absolute object-fill"
              style={{
                left: capa.x,
                top: capa.y,
                width: capa.w,
                height: capa.h,
                maskImage: mascara,
                WebkitMaskImage: mascara,
              }}
            />
          );
        })}

        {/* El velo de la vista: apaga la banda que no es campo. */}
        {VISTAS[slide.vista].velo && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: VISTAS[slide.vista].velo }}
          />
        )}

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
              "linear-gradient(180deg, rgba(15,32,54,.46) 0%, rgba(15,32,54,.06) 36%, rgba(15,32,54,.34) 100%)",
          }}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(118% 84% at 42% 36%, rgba(15,32,54,0) 40%, rgba(15,32,54,.32) 76%, rgba(15,32,54,.62) 100%)",
          }}
        />

        {/* ----------------------- CABECERA ------------------------ */}

        <div
          className="absolute left-0 top-0 overflow-hidden"
          style={{
            width: TABLERO_W,
            height: CABECERA_H,
            /* El mismo azul noche de punta a punta, con un peldaño más claro
               en el centro para que no sea una banda plana. Antes arrancaba y
               terminaba en negro puro y la cabecera parecía de otro material
               que el panel de asignaciones. */
            backgroundImage: `linear-gradient(96deg, ${COLORES.noche} 0%, ${COLORES.nocheAlto} 52%, ${COLORES.noche} 100%)`,
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

        {/* --------------- LO QUE DIBUJA LA PLANTILLA --------------- */}

        {adornos.map((adorno, indice) => (
          <Adorno key={`${adorno.tipo}-${indice}`} adorno={adorno} />
        ))}

        {/* ------------------ HUECOS Y FICHAS ---------------------- */}

        {puestos
          .filter((puesto) => puesto.x != null && !ocupados.has(puesto.key))
          .map((puesto) => (
            <Hueco
              key={puesto.key}
              x={puesto.x as number}
              y={puesto.y as number}
              code={siglaDe(puesto)}
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
            dorsal={dorsalDe(ficha)}
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
              backgroundColor: "rgba(15,32,54,.92)",
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
                              {siglaDe(puesto)}
                            </span>

                            <span
                              className={`min-w-0 flex-1 truncate text-[15px] font-semibold uppercase tracking-[0.02em] ${
                                player ? "text-white" : "text-white/30"
                              }`}
                            >
                              {player?.apodo ?? player?.nombre ?? "—"}
                            </span>

                            {/*
                            | La misma casilla que la ficha del campo, aquí en
                            | fila: el panel se lee de un vistazo antes de
                            | salir y es donde el cuerpo técnico apunta los
                            | dorsales del rival con la hoja ya impresa.
                            */}
                            {pideDorsal(slide, puesto) && (
                              <span
                                className="shrink-0 rounded-[4px]"
                                style={{
                                  width: 40,
                                  height: 21,
                                  backgroundColor: "rgba(247,244,236,.92)",
                                  boxShadow:
                                    "inset 0 0 0 1.5px rgba(200,169,107,.85)",
                                }}
                              />
                            )}
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
