"use client";

/**
 * Figura de un jugador sobre el césped, para el modo jugador de la pizarra.
 *
 * Tres piezas, como en una retransmisión:
 *
 * - `SueloFigura`: lo que está pintado en la hierba —la sombra de contacto,
 *   la sombra larga de los focos y el aro del equipo—. Va en el grupo que se
 *   queda tumbado con el campo.
 * - `PlayerFigure`: el jugador de pie, con la cara de su foto en un medallón
 *   iluminado. Los pies en el origen (0, 0): el punto del campo es donde pisa.
 * - `PlacaJugador`: la placa del nombre bajo los pies, con el dorsal en el
 *   color del equipo y el apellido en Barlow Condensed.
 *
 * Todas las medidas del cuerpo salen de `alto` y `ancho` (ver
 * `lib/tactics/figuras.ts`). Los degradados viven una sola vez en
 * `FigurasDefs`, con un prefijo por tablero: en `/pizarra` hay dos campos en
 * la misma página y un `id` repetido cogería el recorte del otro.
 *
 * Nada usa `filter`: con veintidós figuras bajo la cámara 3D los desenfoques
 * de SVG bajan la fluidez, y la lámina se dibuja clonando este SVG en un
 * lienzo. Las luces y las sombras son degradados, que salen igual en las dos.
 */

import { Equipacion, FIGURA_PELO, FIGURA_PIEL } from "@/lib/tactics/figuras";

/*
|--------------------------------------------------------------------------
| LETRA
|--------------------------------------------------------------------------
| Barlow Condensed, la de la plantilla del club, servida desde /fuentes. La
| lámina la incrusta al clonar el SVG (`imagenDelCampo`), así que el nombre
| sale con la misma letra en pantalla y en el PNG, el PDF y el vídeo.
*/

export const FUENTE_FIGURA =
  "PizarraBarlow, 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

const FONT_FACE =
  "@font-face{font-family:PizarraBarlow;font-weight:700;font-display:swap;" +
  "src:url(/fuentes/BarlowCondensed-Bold.ttf) format('truetype')}";

/**
 * Avance de cada letra de Barlow Condensed Bold, en em.
 *
 * Medido sobre `public/fuentes/BarlowCondensed-Bold.ttf`. Hace falta para
 * dibujar la placa a la medida del nombre: el SVG no sabe cuánto ocupa un
 * texto hasta pintarlo, y la lámina no puede preguntárselo al navegador.
 */
const ANCHO_LETRA: Record<string, number> = {
  A: 0.48, B: 0.47, C: 0.46, D: 0.48, E: 0.44, F: 0.42, G: 0.47, H: 0.48,
  I: 0.23, J: 0.45, K: 0.49, L: 0.43, M: 0.55, N: 0.51, O: 0.47, P: 0.47,
  Q: 0.46, R: 0.47, S: 0.44, T: 0.47, U: 0.48, V: 0.49, W: 0.69, X: 0.48,
  Y: 0.47, Z: 0.41, Á: 0.48, É: 0.44, Í: 0.23, Ó: 0.47, Ú: 0.48, Ñ: 0.51,
  Ü: 0.48, Ç: 0.46, "0": 0.45, "1": 0.28, "2": 0.44, "3": 0.44, "4": 0.48,
  "5": 0.44, "6": 0.44, "7": 0.41, "8": 0.44, "9": 0.44, " ": 0.2, ".": 0.22,
  "-": 0.33, "'": 0.17, "·": 0.23, "…": 0.71,
};

/** Ancho de un texto en Barlow Condensed Bold, en unidades de campo. */
export function anchoTexto(texto: string, cuerpo: number): number {
  let suma = 0;

  for (const letra of texto) suma += ANCHO_LETRA[letra] ?? 0.47;

  return suma * cuerpo;
}

/*
|--------------------------------------------------------------------------
| DEGRADADOS
|--------------------------------------------------------------------------
*/

/** Identificadores de los degradados de un tablero. */
function ids(prefijo: string) {
  return {
    contacto: `${prefijo}-fig-contacto`,
    proyectada: `${prefijo}-fig-proyectada`,
    volumen: `${prefijo}-fig-volumen`,
    caida: `${prefijo}-fig-caida`,
    brillo: `${prefijo}-fig-brillo`,
    vineta: `${prefijo}-fig-vineta`,
    halo: (bando: Bando) => `${prefijo}-fig-halo-${bando}`,
    cara: (uid: string) => `${prefijo}-fig-cara-${uid}`,
  };
}

type Bando = "home" | "away" | "elegida";

/** El brillo del aro, por equipo. La elegida va en oro. */
const HALO: Record<Bando, string> = {
  home: "#F8FAFC",
  away: "#EF4444",
  elegida: "#E9C46A",
};

/**
 * Los degradados y la letra de las figuras. Una vez por tablero, dentro de
 * su `<defs>`.
 */
export function FigurasDefs({ prefijo }: { prefijo: string }) {
  const id = ids(prefijo);

  return (
    <>
      <style>{FONT_FACE}</style>

      {/* Sombra de contacto: negra bajo las botas y se pierde hacia fuera. */}
      <radialGradient id={id.contacto}>
        <stop offset="0" stopColor="#000" stopOpacity={0.7} />
        <stop offset="0.45" stopColor="#000" stopOpacity={0.42} />
        <stop offset="1" stopColor="#000" stopOpacity={0} />
      </radialGradient>

      {/* Sombra larga de los focos: más suave y sin canto. */}
      <radialGradient id={id.proyectada}>
        <stop offset="0" stopColor="#000" stopOpacity={0.32} />
        <stop offset="0.6" stopColor="#000" stopOpacity={0.14} />
        <stop offset="1" stopColor="#000" stopOpacity={0} />
      </radialGradient>

      {/* Volumen de la tela: luz desde la izquierda, sombra a la derecha. */}
      <linearGradient id={id.volumen} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity={0.3} />
        <stop offset="0.42" stopColor="#fff" stopOpacity={0} />
        <stop offset="0.7" stopColor="#000" stopOpacity={0.08} />
        <stop offset="1" stopColor="#000" stopOpacity={0.32} />
      </linearGradient>

      {/* Caída de la luz de arriba abajo: hombros claros, cintura en sombra. */}
      <linearGradient id={id.caida} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={0.16} />
        <stop offset="0.55" stopColor="#000" stopOpacity={0} />
        <stop offset="1" stopColor="#000" stopOpacity={0.22} />
      </linearGradient>

      {/* Luz de estudio sobre la cara: arriba a la izquierda. */}
      <radialGradient id={id.brillo} cx="0.32" cy="0.22" r="0.8">
        <stop offset="0" stopColor="#fff" stopOpacity={0.34} />
        <stop offset="0.45" stopColor="#fff" stopOpacity={0.06} />
        <stop offset="1" stopColor="#fff" stopOpacity={0} />
      </radialGradient>

      {/* Viñeta del medallón: cierra el borde para que la cara salte. */}
      <radialGradient id={id.vineta} cx="0.5" cy="0.42" r="0.62">
        <stop offset="0.72" stopColor="#000" stopOpacity={0} />
        <stop offset="1" stopColor="#000" stopOpacity={0.38} />
      </radialGradient>

      {(Object.keys(HALO) as Bando[]).map((bando) => (
        <radialGradient key={bando} id={id.halo(bando)}>
          <stop offset="0.35" stopColor={HALO[bando]} stopOpacity={0} />
          <stop offset="0.82" stopColor={HALO[bando]} stopOpacity={bando === "elegida" ? 0.34 : 0.2} />
          <stop offset="1" stopColor={HALO[bando]} stopOpacity={0} />
        </radialGradient>
      ))}
    </>
  );
}

/*
|--------------------------------------------------------------------------
| EN EL CÉSPED
|--------------------------------------------------------------------------
*/

interface SueloProps {
  prefijo: string;
  alto: number;
  ancho: number;
  kit: Equipacion;
  bando: "home" | "away";
  /**
   * Alto del aro respecto a su ancho. Lo decide el tablero con la cámara:
   * en cenital, 0,45 (un aro visto en escorzo, a juego con la figura de
   * pie); con el campo inclinado, más redondo, porque la perspectiva ya lo
   * aplasta. Así el aro se ve igual desde cualquier cámara.
   */
  achatado: number;
  elegida?: boolean;
  /** La cámara sigue a este jugador. */
  anclada?: boolean;
  /** Se está arrastrando: la figura sube y la sombra se abre y se aclara. */
  elevada?: boolean;
}

/** Medio ancho de la figura en el suelo, el mismo que usa el área de agarre. */
export function medioFigura(alto: number, ancho: number) {
  return 0.24 * alto * ancho;
}

export function SueloFigura({
  prefijo,
  alto,
  ancho,
  kit,
  bando,
  achatado,
  elegida,
  anclada,
  elevada,
}: SueloProps) {
  const id = ids(prefijo);
  const medio = medioFigura(alto, ancho);
  const k = achatado;

  /* El aro, algo más ancho que la figura para que se vea por los dos lados. */
  const rx = medio * 1.32;
  const ry = rx * k;

  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Sombra larga de los focos, hacia atrás y a la derecha. */}
      <ellipse
        cx={alto * 0.16}
        cy={-alto * 0.1 * k}
        rx={alto * (elevada ? 0.24 : 0.3)}
        ry={medio * k}
        transform={`rotate(-24 ${alto * 0.16} ${-alto * 0.1 * k})`}
        fill={`url(#${id.proyectada})`}
        opacity={elevada ? 0.55 : 1}
      />

      {/* El brillo del equipo sobre la hierba. */}
      <ellipse
        cx={0}
        cy={0}
        rx={rx * 1.25}
        ry={ry * 1.25}
        fill={`url(#${id.halo(elegida ? "elegida" : bando)})`}
      />

      {/* El aro del equipo, con un filo oscuro para separarlo del césped. */}
      <ellipse
        cx={0}
        cy={0}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="rgba(0,0,0,.45)"
        strokeWidth={elegida ? 0.66 : 0.46}
      />
      <ellipse
        cx={0}
        cy={0}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={elegida ? "#E9C46A" : kit.aro}
        strokeWidth={elegida ? 0.38 : 0.24}
        strokeOpacity={elegida ? 1 : 0.92}
      />

      {/* El filo dorado del club por dentro del aro blanco. */}
      {bando === "home" && !elegida && (
        <ellipse
          cx={0}
          cy={0}
          rx={rx - 0.3}
          ry={Math.max(0.1, ry - 0.3 * k)}
          fill="none"
          stroke={kit.vivo}
          strokeWidth={0.12}
          strokeOpacity={0.85}
        />
      )}

      {/* Elegida: un segundo aro de oro, abierto, alrededor del primero. */}
      {elegida && (
        <ellipse
          cx={0}
          cy={0}
          rx={rx + 0.75}
          ry={ry + 0.75 * k}
          fill="none"
          stroke="#E9C46A"
          strokeOpacity={0.6}
          strokeWidth={0.16}
          strokeDasharray="2.2 1"
        />
      )}

      {/* La cámara lo sigue: anillo discontinuo, más fuera todavía. */}
      {anclada && (
        <ellipse
          cx={0}
          cy={0}
          rx={rx + 1.5}
          ry={ry + 1.5 * k}
          fill="none"
          stroke="#C8A96B"
          strokeWidth={0.3}
          strokeDasharray="1 0.8"
        />
      )}

      {/* Sombra de contacto, la que pega al jugador al suelo. */}
      <ellipse
        cx={0}
        cy={0}
        rx={medio * (elevada ? 1.4 : 1.15)}
        ry={medio * (elevada ? 1.4 : 1.15) * k}
        fill={`url(#${id.contacto})`}
        opacity={elevada ? 0.55 : 1}
      />
    </g>
  );
}

/*
|--------------------------------------------------------------------------
| EL JUGADOR
|--------------------------------------------------------------------------
*/

interface Props {
  /** Prefijo de los degradados del tablero (ver `FigurasDefs`). */
  prefijo: string;
  /** Identificador de la ficha: da nombre al recorte de la foto. */
  uid: string;
  /** Alto total en unidades de campo, del césped a la coronilla. */
  alto: number;
  /** Multiplicador de anchura del cuerpo (1 = complexión media). */
  ancho: number;
  kit: Equipacion;
  /** Dorsal pintado en la camiseta. */
  label?: string;
  /** Foto ya lista para el SVG (ver `fotoFigura`). */
  foto?: string;
  /** Se está arrastrando: el jugador se levanta del césped. */
  elevada?: boolean;
}

export default function PlayerFigure({
  prefijo,
  uid,
  alto,
  ancho,
  kit,
  label,
  foto,
  elevada,
}: Props) {
  const id = ids(prefijo);
  const H = alto;
  const B = ancho;

  /* Alturas del cuerpo, todas negativas porque el SVG crece hacia abajo. */
  const yTobillo = -0.045 * H;
  const yRodilla = -0.24 * H;
  const yShort = -0.33 * H;
  const yCadera = -0.45 * H;
  const yCintura = -0.52 * H;
  const yHombro = -0.7 * H;

  /*
  | La cabeza es el medallón de la foto y va grande a propósito, como en los
  | videojuegos: es lo que dice quién es cada uno desde el fondo de la sala.
  */
  const rCabeza = 0.135 * H;
  const yCabeza = -(H - rCabeza);

  /* Semianchuras. */
  const hombro = 0.17 * H * B;
  const cintura = 0.118 * H * B;
  const cadera = 0.13 * H * B;

  const separacion = 0.064 * H * B;

  const grosorPierna = 0.085 * H * B;
  const grosorMedia = 0.09 * H * B;
  const grosorBrazo = 0.058 * H * B;

  /* Filo de la silueta: lo que la separa del césped en cualquier diseño. */
  const filo = 0.05 * H;

  const clipId = id.cara(uid);

  const camiseta = [
    `M ${-hombro} ${yHombro}`,
    `Q 0 ${yHombro - 0.04 * H} ${hombro} ${yHombro}`,
    `L ${cintura} ${yCintura}`,
    `Q 0 ${yCintura + 0.025 * H} ${-cintura} ${yCintura}`,
    "Z",
  ].join(" ");

  const pantalon = [
    `M ${-cadera} ${yCintura - 0.01 * H}`,
    `L ${cadera} ${yCintura - 0.01 * H}`,
    `L ${cadera * 0.95} ${yShort}`,
    `L ${separacion * 0.45} ${yShort}`,
    `L 0 ${yShort - 0.035 * H}`,
    `L ${-separacion * 0.45} ${yShort}`,
    `L ${-cadera * 0.95} ${yShort}`,
    "Z",
  ].join(" ");

  const piernas = [-separacion, separacion];
  const lados = [-1, 1];

  /* Brazo: del hombro a la mano, un poco abierto. */
  const brazo = (lado: number) => ({
    x1: lado * (hombro - grosorBrazo * 0.3),
    y1: yHombro + 0.03 * H,
    x2: lado * (hombro + 0.03 * H),
    y2: yCadera + 0.005 * H,
  });

  /* Manga: tapa el primer tercio del brazo. */
  const manga = (lado: number) => ({
    x1: lado * (hombro - grosorBrazo * 0.55),
    y1: yHombro + 0.015 * H,
    x2: lado * (hombro + 0.012 * H),
    y2: yHombro + 0.095 * H,
  });

  return (
    <g transform={elevada ? `translate(0 ${(-0.09 * H).toFixed(3)})` : undefined}>
      {/*
        EL FILO. La silueta entera, oscura y un poco más gruesa, por debajo
        del dibujo: el contorno de pegatina de los videojuegos, que despega
        al jugador del verde, de la pizarra azul y del césped de noche.
      */}
      <g stroke={kit.contorno} strokeLinecap="round" strokeLinejoin="round" fill={kit.contorno}>
        {piernas.map((cx) => (
          <line key={`fp-${cx}`} x1={cx} y1={yCadera} x2={cx} y2={yTobillo} strokeWidth={grosorMedia + filo} />
        ))}
        {piernas.map((cx) => (
          <ellipse key={`fb-${cx}`} cx={cx + 0.012 * H} cy={yTobillo * 0.3} rx={grosorMedia * 0.8 + filo * 0.5} ry={grosorMedia * 0.44 + filo * 0.5} stroke="none" />
        ))}
        {lados.map((lado) => (
          <line key={`fa-${lado}`} {...brazo(lado)} strokeWidth={grosorBrazo + filo} />
        ))}
        <path d={pantalon} strokeWidth={filo} />
        <path d={camiseta} strokeWidth={filo} />
        <circle cx={0} cy={yCabeza} r={rCabeza + filo * 0.5} stroke="none" />
      </g>

      {/* PIERNAS — piel de la cadera al tobillo */}
      {piernas.map((cx) => (
        <line
          key={`pierna-${cx}`}
          x1={cx}
          y1={yCadera + grosorPierna * 0.3}
          x2={cx}
          y2={yTobillo}
          stroke={FIGURA_PIEL}
          strokeWidth={grosorPierna}
          strokeLinecap="round"
        />
      ))}

      {/* MEDIAS — de debajo de la rodilla al tobillo, con la franja del club arriba */}
      {piernas.map((cx) => (
        <g key={`media-${cx}`}>
          <line
            x1={cx}
            y1={yRodilla + 0.02 * H}
            x2={cx}
            y2={yTobillo}
            stroke={kit.medias}
            strokeWidth={grosorMedia}
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={yRodilla + 0.035 * H}
            x2={cx}
            y2={yRodilla + 0.06 * H}
            stroke={kit.vivo}
            strokeWidth={grosorMedia}
          />
        </g>
      ))}

      {/* BOTAS, con un punto de brillo en la puntera */}
      {piernas.map((cx) => (
        <g key={`bota-${cx}`}>
          <ellipse
            cx={cx + 0.012 * H}
            cy={yTobillo * 0.3}
            rx={grosorMedia * 0.8}
            ry={grosorMedia * 0.44}
            fill={kit.bota}
          />
          <ellipse
            cx={cx - grosorMedia * 0.15}
            cy={yTobillo * 0.3 - grosorMedia * 0.14}
            rx={grosorMedia * 0.3}
            ry={grosorMedia * 0.12}
            fill="#fff"
            opacity={0.35}
          />
        </g>
      ))}

      {/* PANTALÓN, con la franja lateral */}
      <path d={pantalon} fill={kit.pantalon} />
      {lados.map((lado) => (
        <line
          key={`franja-${lado}`}
          x1={lado * cadera * 0.97}
          y1={yCintura}
          x2={lado * cadera * 0.93}
          y2={yShort + 0.005 * H}
          stroke={kit.vivo}
          strokeWidth={0.028 * H}
        />
      ))}
      <path d={pantalon} fill={`url(#${id.volumen})`} />

      {/* BRAZOS — piel, del hombro a la mano */}
      {lados.map((lado) => {
        const b = brazo(lado);

        return (
          <g key={`brazo-${lado}`}>
            <line {...b} stroke={FIGURA_PIEL} strokeWidth={grosorBrazo} strokeLinecap="round" />
            <circle cx={b.x2} cy={b.y2} r={grosorBrazo * 0.62} fill={FIGURA_PIEL} />
          </g>
        );
      })}

      {/* MANGAS — de la camiseta, con el puño del club */}
      {lados.map((lado) => {
        const m = manga(lado);

        return (
          <g key={`manga-${lado}`}>
            <line {...m} stroke={kit.camiseta} strokeWidth={grosorBrazo * 1.55} strokeLinecap="round" />
            <line
              x1={m.x2 - lado * 0.004 * H}
              y1={m.y2 - 0.012 * H}
              x2={m.x2 + lado * 0.003 * H}
              y2={m.y2 + 0.008 * H}
              stroke={kit.vivo}
              strokeWidth={grosorBrazo * 1.5}
            />
          </g>
        );
      })}

      {/* CAMISETA, con su luz y su sombra */}
      <path d={camiseta} fill={kit.camiseta} />
      <path d={camiseta} fill={`url(#${id.volumen})`} />
      <path d={camiseta} fill={`url(#${id.caida})`} />

      {/* CUELLO DE PICO, en el vivo del club */}
      <path
        d={`M ${-0.055 * H} ${yHombro - 0.012 * H} L 0 ${yHombro + 0.045 * H} L ${0.055 * H} ${yHombro - 0.012 * H}`}
        fill="none"
        stroke={kit.vivo}
        strokeWidth={0.024 * H}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* DORSAL */}
      {label && (
        <text
          x={0}
          y={yHombro + 0.165 * H}
          textAnchor="middle"
          fontFamily={FUENTE_FIGURA}
          fontSize={(label.length > 2 ? 0.115 : 0.15) * H}
          fontWeight={700}
          fill={kit.dorsal}
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
      )}

      {/* CABEZA */}
      {foto ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle cx={0} cy={yCabeza} r={rCabeza} />
            </clipPath>
          </defs>

          {/* Fondo del medallón: si la foto tarda, no se ve césped a través. */}
          <circle cx={0} cy={yCabeza} r={rCabeza} fill="#E8EBF0" />

          {/*
            La foto se recorta en redondo. `slice` la escala hasta cubrir el
            círculo entero: los retratos de la plantilla son 4:5 y los de la
            hoja de scouting cuadrados, y sin `slice` los primeros dejaban dos
            medias lunas de césped a los lados de la cara. Va 1,38 veces más
            ancha que el medallón: los retratos traen pelo, hombros y fondo
            blanco alrededor, y a su tamaño la cara se quedaba en un punto.
          */}
          <image
            href={foto}
            x={-rCabeza * 1.38}
            y={yCabeza - rCabeza * 1.22}
            width={rCabeza * 2.76}
            height={rCabeza * 2.76}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
            crossOrigin="anonymous"
          />

          {/* La luz de estudio y la viñeta: la cara sale iluminada. */}
          <circle cx={0} cy={yCabeza} r={rCabeza} fill={`url(#${id.brillo})`} />
          <circle cx={0} cy={yCabeza} r={rCabeza} fill={`url(#${id.vineta})`} />

          {/* Bisel del medallón, en el color del equipo */}
          <circle
            cx={0}
            cy={yCabeza}
            r={rCabeza - 0.01 * H}
            fill="none"
            stroke={kit.vivo}
            strokeWidth={0.02 * H}
          />
          <circle
            cx={0}
            cy={yCabeza}
            r={rCabeza - 0.02 * H}
            fill="none"
            stroke="#000"
            strokeOpacity={0.25}
            strokeWidth={0.008 * H}
          />
        </>
      ) : (
        <>
          <circle cx={0} cy={yCabeza} r={rCabeza} fill={FIGURA_PIEL} />
          <circle cx={0} cy={yCabeza} r={rCabeza} fill={`url(#${id.brillo})`} />

          {/*
            Sin foto, el pelo evita la cabeza en blanco. No van iniciales: en
            la cabeza se leían apretadas contra el pelo y repetían lo que ya
            dicen el dorsal y la placa.
          */}
          <path
            d={[
              `M ${-rCabeza * 0.98} ${yCabeza - rCabeza * 0.1}`,
              `Q 0 ${yCabeza - rCabeza * 1.5} ${rCabeza * 0.98} ${yCabeza - rCabeza * 0.1}`,
              `Q 0 ${yCabeza - rCabeza * 0.62} ${-rCabeza * 0.98} ${yCabeza - rCabeza * 0.1}`,
              "Z",
            ].join(" ")}
            fill={FIGURA_PELO}
          />

          <circle
            cx={0}
            cy={yCabeza}
            r={rCabeza - 0.01 * H}
            fill="none"
            stroke={kit.vivo}
            strokeWidth={0.02 * H}
          />
        </>
      )}
    </g>
  );
}

/*
|--------------------------------------------------------------------------
| LA PLACA
|--------------------------------------------------------------------------
*/

interface PlacaProps {
  kit: Equipacion;
  /** Dorsal: va en el bloque de color del equipo. */
  dorsal?: string;
  /** Apellido, tal y como sale en la charla. Vacío = sólo el dorsal. */
  nombre?: string;
  /** Altura del borde de arriba, en unidades de campo bajo los pies. */
  y: number;
  elegida?: boolean;
}

/** Cuerpo del apellido y del dorsal en la placa, en unidades de campo. */
const CUERPO_NOMBRE = 1.18;
const CUERPO_DORSAL = 1.3;
const ALTO_PLACA = 1.8;
const AIRE = 0.42;
const RADIO = 0.34;

/**
 * La placa del nombre, como el rótulo de una retransmisión: el dorsal sobre
 * el color del equipo y el apellido en blanco sobre azul noche. Se dibuja a
 * la medida del nombre con la tabla de anchos de Barlow; el texto se ajusta
 * a esa medida (`textLength`) por si la letra aún no ha llegado y sale la
 * del sistema, que es más ancha y se saldría de la placa.
 */
export function PlacaJugador({ kit, dorsal, nombre, y, elegida }: PlacaProps) {
  const texto = (nombre ?? "").trim().toLocaleUpperCase("es-ES");
  const numero = (dorsal ?? "").trim();

  if (!texto && !numero) return null;

  const anchoNombre = texto ? anchoTexto(texto, CUERPO_NOMBRE) : 0;
  const anchoDorsal = numero
    ? Math.max(ALTO_PLACA, anchoTexto(numero, CUERPO_DORSAL) + AIRE * 1.6)
    : 0;
  const cajaNombre = texto ? anchoNombre + AIRE * 2 : 0;
  const total = anchoDorsal + cajaNombre;

  const x0 = -total / 2;
  const h = ALTO_PLACA;
  const r = RADIO;

  /* Bloque del dorsal: redondeado sólo por la izquierda si sigue el nombre. */
  const bloque = cajaNombre
    ? [
        `M ${x0 + r} ${y}`,
        `H ${x0 + anchoDorsal}`,
        `V ${y + h}`,
        `H ${x0 + r}`,
        `Q ${x0} ${y + h} ${x0} ${y + h - r}`,
        `V ${y + r}`,
        `Q ${x0} ${y} ${x0 + r} ${y}`,
        "Z",
      ].join(" ")
    : undefined;

  /* Línea base: las mayúsculas de Barlow miden 0,7 em, centradas en la placa. */
  const base = (cuerpo: number) => y + h / 2 + cuerpo * 0.35;

  return (
    <g style={{ pointerEvents: "none" }} fontFamily={FUENTE_FIGURA} fontWeight={700}>
      {/* Sombra de la placa: la levanta del césped. */}
      <rect x={x0 + 0.08} y={y + 0.16} width={total} height={h} rx={r} fill="#000" opacity={0.35} />

      <rect
        x={x0}
        y={y}
        width={total}
        height={h}
        rx={r}
        fill="#0B1220"
        fillOpacity={0.94}
        stroke={elegida ? "#E9C46A" : "rgba(255,255,255,.16)"}
        strokeWidth={elegida ? 0.22 : 0.1}
      />

      {numero &&
        (bloque ? (
          <path d={bloque} fill={kit.placa} />
        ) : (
          <rect x={x0} y={y} width={total} height={h} rx={r} fill={kit.placa} />
        ))}

      {numero && (
        <text
          x={x0 + anchoDorsal / 2}
          y={base(CUERPO_DORSAL)}
          textAnchor="middle"
          fontSize={CUERPO_DORSAL}
          fill={kit.placaTexto}
        >
          {numero}
        </text>
      )}

      {texto && (
        <>
          <text
            x={x0 + anchoDorsal + AIRE + anchoNombre / 2}
            y={base(CUERPO_NOMBRE)}
            textAnchor="middle"
            fontSize={CUERPO_NOMBRE}
            textLength={anchoNombre}
            lengthAdjust="spacingAndGlyphs"
            fill="#F8FAFC"
          >
            {texto}
          </text>

          {/* Filo de abajo, en el color del club: oro nuestro, rojo el rival. */}
          <rect
            x={x0 + anchoDorsal + AIRE * 0.6}
            y={y + h - 0.2}
            width={Math.max(0, cajaNombre - AIRE * 1.2)}
            height={0.1}
            fill={kit.vivo}
          />
        </>
      )}
    </g>
  );
}
