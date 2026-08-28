"use client";

/**
 * Figura de un jugador sobre el césped, para el modo jugador de la pizarra.
 *
 * Se dibuja de pie con los pies en el origen (0, 0) del grupo que la contiene,
 * así que la ficha se coloca igual que el círculo al que sustituye: el punto
 * del campo es donde el jugador pisa.
 *
 * Todas las medidas salen de `alto` y `ancho` (ver `lib/tactics/figuras.ts`),
 * que a su vez vienen de la altura y el peso del jugador. Nada está escrito en
 * unidades absolutas: cambiar `FIGURA_ALTO` reescala la figura entera.
 */

import { Equipacion, FIGURA_PELO, FIGURA_PIEL } from "@/lib/tactics/figuras";

interface Props {
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
}

export default function PlayerFigure({
  uid,
  alto,
  ancho,
  kit,
  label,
  foto,
}: Props) {
  const H = alto;
  const B = ancho;

  /* Alturas del cuerpo, todas negativas porque el SVG crece hacia abajo. */
  const yTobillo = -0.05 * H;
  const yRodilla = -0.24 * H;
  const yShort = -0.33 * H;
  const yCadera = -0.47 * H;
  const yCintura = -0.56 * H;
  const yHombro = -0.775 * H;

  const rCabeza = 0.115 * H;
  const yCabeza = -(H - rCabeza);

  /* Semianchuras. */
  const hombro = 0.165 * H * B;
  const cintura = 0.112 * H * B;
  const cadera = 0.128 * H * B;

  const separacion = 0.062 * H * B;

  const grosorPierna = 0.082 * H * B;
  const grosorMedia = 0.088 * H * B;
  const grosorBrazo = 0.055 * H * B;

  const contorno = 0.055 * H;

  const clipId = `figura-cara-${uid}`;

  return (
    <g>
      {/* PIERNAS — piel de la cadera al tobillo */}
      {[-separacion, separacion].map((cx) => (
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

      {/* MEDIAS — de debajo de la rodilla al tobillo */}
      {[-separacion, separacion].map((cx) => (
        <line
          key={`media-${cx}`}
          x1={cx}
          y1={yRodilla + 0.03 * H}
          x2={cx}
          y2={yTobillo}
          stroke={kit.medias}
          strokeWidth={grosorMedia}
          strokeLinecap="round"
        />
      ))}

      {/* BOTAS */}
      {[-separacion, separacion].map((cx) => (
        <ellipse
          key={`bota-${cx}`}
          cx={cx}
          cy={yTobillo * 0.35}
          rx={grosorMedia * 0.78}
          ry={grosorMedia * 0.42}
          fill={kit.bota}
        />
      ))}

      {/* PANTALÓN */}
      <path
        d={[
          `M ${-cadera} ${yCintura}`,
          `L ${cadera} ${yCintura}`,
          `L ${cadera * 0.92} ${yShort}`,
          `L ${separacion * 0.5} ${yShort}`,
          `L 0 ${yShort - 0.035 * H}`,
          `L ${-separacion * 0.5} ${yShort}`,
          `L ${-cadera * 0.92} ${yShort}`,
          "Z",
        ].join(" ")}
        fill={kit.pantalon}
        stroke={kit.contorno}
        strokeWidth={contorno * 0.6}
        strokeLinejoin="round"
      />

      {/* BRAZOS — piel, del hombro a la altura de la cadera */}
      {[-1, 1].map((lado) => (
        <line
          key={`brazo-${lado}`}
          x1={lado * (hombro - grosorBrazo * 0.25)}
          y1={yHombro + 0.02 * H}
          x2={lado * (hombro + 0.035 * H)}
          y2={yCadera - 0.01 * H}
          stroke={FIGURA_PIEL}
          strokeWidth={grosorBrazo}
          strokeLinecap="round"
        />
      ))}

      {/* CAMISETA */}
      <path
        d={[
          `M ${-hombro} ${yHombro}`,
          `Q 0 ${yHombro - 0.045 * H} ${hombro} ${yHombro}`,
          `L ${cintura} ${yCintura}`,
          `Q 0 ${yCintura + 0.03 * H} ${-cintura} ${yCintura}`,
          "Z",
        ].join(" ")}
        fill={kit.camiseta}
        stroke={kit.contorno}
        strokeWidth={contorno * 0.6}
        strokeLinejoin="round"
      />

      {/* MANGAS — el vivo del club marca el hombro */}
      {[-1, 1].map((lado) => (
        <line
          key={`manga-${lado}`}
          x1={lado * (hombro - grosorBrazo * 0.55)}
          y1={yHombro + 0.015 * H}
          x2={lado * (hombro + 0.008 * H)}
          y2={yHombro + 0.065 * H}
          stroke={kit.vivo}
          strokeWidth={grosorBrazo * 1.05}
          strokeLinecap="round"
        />
      ))}

      {/* DORSAL */}
      {label && (
        <text
          x={0}
          y={yHombro + 0.19 * H}
          textAnchor="middle"
          fontSize={0.155 * H}
          fontWeight={800}
          fill={kit.dorsal}
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
      )}

      {/* CUELLO */}
      <line
        x1={0}
        y1={yCabeza + rCabeza * 0.55}
        x2={0}
        y2={yHombro + 0.01 * H}
        stroke={FIGURA_PIEL}
        strokeWidth={0.07 * H * B}
        strokeLinecap="round"
      />

      {/* CABEZA */}
      {foto ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle cx={0} cy={yCabeza} r={rCabeza} />
            </clipPath>
          </defs>

          {/*
            La foto se recorta en redondo. `slice` la escala hasta cubrir el
            círculo entero: los retratos de la plantilla son 4:5 y los de la
            hoja de scouting cuadrados, y sin `slice` los primeros dejaban dos
            medias lunas de césped a los lados de la cara.
          */}
          <image
            href={foto}
            x={-rCabeza}
            y={yCabeza - rCabeza}
            width={rCabeza * 2}
            height={rCabeza * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
            crossOrigin="anonymous"
          />

          <circle
            cx={0}
            cy={yCabeza}
            r={rCabeza}
            fill="none"
            stroke={kit.vivo}
            strokeWidth={contorno * 0.75}
          />
        </>
      ) : (
        <>
          <circle
            cx={0}
            cy={yCabeza}
            r={rCabeza}
            fill={FIGURA_PIEL}
            stroke={kit.contorno}
            strokeWidth={contorno * 0.6}
          />

          {/*
            Sin foto, el pelo evita la cabeza en blanco. No van iniciales: en
            la cabeza, que mide una unidad escasa, se leían apretadas contra el
            pelo y repetían lo que ya dicen el dorsal y el nombre.
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
        </>
      )}
    </g>
  );
}
