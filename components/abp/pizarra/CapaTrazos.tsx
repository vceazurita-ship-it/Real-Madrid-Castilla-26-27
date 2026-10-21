"use client";

/**
 * Las flechas de la diapositiva: carreras, balón y bloqueos.
 *
 * Son dos capas porque tienen que estar a dos alturas distintas:
 *
 * - `CapaTrazos` va sobre el césped y POR DEBAJO de las caras, como las líneas
 *   que se pintan en una pizarra de verdad: la carrera sale de los pies del
 *   jugador, no le atraviesa la cara. Es lo que se exporta.
 * - `MandosTrazo` va por encima de todo y sólo existe mientras se edita: los
 *   tiradores para mover la punta, el arranque y la curva del trazo elegido.
 *   Lleva `data-export-hide`.
 *
 * Todo color va en atributos con valores fijos —nada de clases—: el tablero es
 * oscuro en los dos temas y la captura serializa el estilo calculado (ver la
 * nota del modo día en `globals.css`). Las cabezas de flecha son polígonos
 * calculados y no `<marker>`, para que salgan igual en el PNG y se puedan
 * recortar cuando la carrera va a medias.
 */

import { COLORES, TABLERO_H, TABLERO_W } from "@/lib/abp/pizarra";
import {
  avanceDe,
  barraDe,
  cabezaDe,
  caminoDe,
  controlDe,
  esCurvo,
  fasesDe,
  puntoEn,
  tangenteEn,
  type TipoTrazo,
  type TrazoPizarra,
} from "@/lib/abp/trazos";

/**
 * Cómo se pinta cada tipo. Los mismos tres colores en pantalla y en papel.
 *
 * Los colores van en `rgb()` y no en hexadecimal A POSTA: el modo día de
 * `globals.css` reescribe `[stroke="#FFFFFF"]` y `[stroke="#C8A96B"]` para las
 * gráficas sobre papel claro, y el balón salía gris pizarra en pantalla y en
 * el PNG. Con `rgb()` el selector no casa y el tablero —que es oscuro en los
 * dos temas— se queda como es.
 */
export const ESTILO_TRAZO: Record<
  TipoTrazo,
  { color: string; ancho: number; discontinuo?: string }
> = {
  carrera: { color: COLORES.oroClaro, ancho: 7 },
  balon: { color: "rgb(255,255,255)", ancho: 5, discontinuo: "16 12" },
  bloqueo: { color: COLORES.rosa, ancho: 7 },
};

/** La sombra que despega la flecha del césped claro. */
const SOMBRA = "rgba(8,21,36,.62)";

function UnTrazo({
  trazo,
  avance,
  elegido,
  conFase,
}: {
  trazo: TrazoPizarra;
  avance: number;
  elegido: boolean;
  conFase: boolean;
}) {
  if (avance <= 0) return null;

  const estilo = ESTILO_TRAZO[trazo.tipo];
  const d = caminoDe(trazo, avance);

  /* La cabeza va en la punta de lo dibujado: crece con la carrera. */
  const cabeza =
    trazo.tipo === "bloqueo" ? null : cabezaDe(trazo, avance, 26, 13);

  const barra = trazo.tipo === "bloqueo" ? barraDe(trazo, avance, 20) : null;

  /* El número de fase, al lado de la mitad de la flecha y hacia fuera. */
  const medio = puntoEn(trazo, 0.5);
  const dir = tangenteEn(trazo, 0.5);
  const fase = { x: medio.x - dir.y * 26, y: medio.y + dir.x * 26 };

  return (
    <g>
      {elegido && (
        <path
          d={d}
          fill="none"
          stroke="rgb(200,169,107)"
          strokeOpacity={0.45}
          strokeWidth={estilo.ancho + 16}
          strokeLinecap="round"
        />
      )}

      <path
        d={d}
        fill="none"
        stroke={SOMBRA}
        strokeWidth={estilo.ancho + 6}
        strokeLinecap="round"
        strokeDasharray={estilo.discontinuo}
      />

      <path
        d={d}
        fill="none"
        stroke={estilo.color}
        strokeWidth={estilo.ancho}
        strokeLinecap="round"
        strokeDasharray={estilo.discontinuo}
      />

      {cabeza && (
        <polygon
          points={cabeza}
          fill={estilo.color}
          stroke={SOMBRA}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )}

      {barra && (
        <>
          <line {...barra} stroke={SOMBRA} strokeWidth={estilo.ancho + 8} strokeLinecap="round" />
          <line {...barra} stroke={estilo.color} strokeWidth={estilo.ancho + 2} strokeLinecap="round" />
        </>
      )}

      {conFase && avance >= 1 && (
        <g>
          <circle
            cx={fase.x}
            cy={fase.y}
            r={17}
            fill={COLORES.noche}
            stroke={estilo.color}
            strokeWidth={3}
          />
          <text
            x={fase.x}
            y={fase.y + 7}
            textAnchor="middle"
            fontSize={20}
            fontWeight={700}
            fill="#FFFFFF"
            style={{ fontFamily: "var(--fuente-pizarra, inherit)" }}
          >
            {trazo.fase}
          </text>
        </g>
      )}
    </g>
  );
}

export function CapaTrazos({
  trazos,
  tiempo,
  elegido,
  editable,
  onElegir,
}: {
  trazos: TrazoPizarra[];
  /** Instante de la reproducción, en fases; `null` = todo dibujado. */
  tiempo: number | null;
  elegido: string | null;
  /** Si se puede pinchar un trazo para elegirlo. */
  editable: boolean;
  onElegir: (id: string) => void;
}) {
  if (trazos.length === 0) return null;

  /* El número sólo dice algo cuando hay más de una fase. */
  const conFase = fasesDe(trazos) > 1;

  /* El balón por encima de las carreras: es lo que se sigue con la vista. */
  const orden = [...trazos].sort(
    (a, b) => Number(a.tipo === "balon") - Number(b.tipo === "balon") || a.fase - b.fase,
  );

  return (
    <svg
      className="absolute left-0 top-0"
      width={TABLERO_W}
      height={TABLERO_H}
      viewBox={`0 0 ${TABLERO_W} ${TABLERO_H}`}
      style={{ zIndex: 5, pointerEvents: "none", overflow: "visible" }}
      aria-hidden
    >
      {orden.map((trazo) => (
        <UnTrazo
          key={trazo.id}
          trazo={trazo}
          avance={avanceDe(trazo, tiempo)}
          elegido={elegido === trazo.id}
          conFase={conFase}
        />
      ))}

      {/* Zonas de pinchado: anchas e invisibles, sólo al editar. */}
      {editable &&
        orden.map((trazo) => (
          <path
            key={`hit-${trazo.id}`}
            data-trazo
            d={caminoDe(trazo)}
            fill="none"
            stroke="transparent"
            strokeWidth={34}
            strokeLinecap="round"
            style={{ pointerEvents: "stroke", cursor: "pointer" }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onElegir(trazo.id);
            }}
          />
        ))}
    </svg>
  );
}

/** Qué parte del trazo se está arrastrando. */
export type TiradorTrazo = "inicio" | "fin" | "control";

/**
 * Los tiradores del trazo elegido.
 *
 * Tres círculos: el arranque, la punta y el de la curva (en hueco, para que se
 * lea que no es un extremo). Doble clic en el de la curva la endereza.
 */
export function MandosTrazo({
  trazo,
  onTirar,
  onEnderezar,
}: {
  trazo: TrazoPizarra;
  onTirar: (cual: TiradorTrazo, event: React.PointerEvent) => void;
  onEnderezar: () => void;
}) {
  const control = controlDe(trazo);
  const color = ESTILO_TRAZO[trazo.tipo].color;

  const tirador = (cual: TiradorTrazo, x: number, y: number, hueco = false) => (
    <circle
      key={cual}
      data-trazo
      cx={x}
      cy={y}
      r={hueco ? 13 : 15}
      fill={hueco ? "rgba(15,32,54,.75)" : color}
      stroke={hueco ? color : COLORES.noche}
      strokeWidth={4}
      strokeDasharray={hueco ? "5 4" : undefined}
      style={{ pointerEvents: "all", cursor: cual === "control" ? "grab" : "move", touchAction: "none" }}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onTirar(cual, event);
      }}
      onDoubleClick={cual === "control" ? onEnderezar : undefined}
    >
      <title>
        {cual === "control"
          ? esCurvo(trazo)
            ? "Arrastra para curvar · doble clic para enderezar"
            : "Arrastra para curvar la flecha"
          : cual === "fin"
            ? "Arrastra la punta"
            : "Arrastra el arranque"}
      </title>
    </circle>
  );

  return (
    <svg
      data-export-hide
      className="absolute left-0 top-0"
      width={TABLERO_W}
      height={TABLERO_H}
      viewBox={`0 0 ${TABLERO_W} ${TABLERO_H}`}
      style={{ zIndex: 2_950_000, pointerEvents: "none", overflow: "visible" }}
    >
      {/* La guía del control: de la cuerda a su tirador. */}
      <line
        x1={(trazo.x1 + trazo.x2) / 2}
        y1={(trazo.y1 + trazo.y2) / 2}
        x2={control.x}
        y2={control.y}
        stroke={color}
        strokeOpacity={0.6}
        strokeWidth={2}
        strokeDasharray="4 6"
      />
      {tirador("inicio", trazo.x1, trazo.y1)}
      {tirador("fin", trazo.x2, trazo.y2)}
      {tirador("control", control.x, control.y, true)}
    </svg>
  );
}

/** El balón durante la reproducción, por encima de todas las caras. */
export function BalonEnJuego({ x, y }: { x: number; y: number }) {
  return (
    <svg
      className="absolute"
      width={44}
      height={44}
      viewBox="0 0 44 44"
      style={{ left: x - 22, top: y - 22, zIndex: 2_900_000, pointerEvents: "none" }}
      aria-hidden
    >
      <circle cx={22} cy={25} r={15} fill="rgba(0,0,0,.35)" />
      <circle cx={22} cy={21} r={15} fill="#FFFFFF" stroke={COLORES.noche} strokeWidth={3} />
      <polygon
        points="22,13 29,18 26.5,26 17.5,26 15,18"
        fill={COLORES.noche}
      />
    </svg>
  );
}
