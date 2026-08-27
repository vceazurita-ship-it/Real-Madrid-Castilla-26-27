"use client";

/**
 * El estadio que rodea al campo cuando la cámara se inclina.
 *
 * Con la perspectiva encendida, el campo dejaba de ser un rectángulo plano
 * pero seguía flotando sobre nada: una jugada vista desde el fondo se salía
 * hacia un vacío negro y perdía la referencia de dónde está la portería.
 * Aquí se levanta el estadio entero **en el mismo espacio 3D de la cámara**,
 * así que orbitar el campo lo orbita con él.
 *
 * Cómo, sin motor 3D: el plano del campo ya lleva `transform-style:
 * preserve-3d`, así que basta con colgar de él paneles y girarlos sobre el
 * borde que les toca. Cada uno se bisagra con `transform-origin` en su lado
 * pegado al césped, y al rotar se pone de pie. Es la misma técnica de la
 * cámara —CSS, no WebGL—, y por eso sobrevive a la captura de imagen con la
 * que se exporta la pizarra.
 *
 * **Lo que hay, de abajo arriba:** foso, primer anillo LED a pie de campo,
 * grada baja, **segundo anillo LED** en el voladizo, grada alta, videomarcador
 * detrás de cada portería y cubierta con la línea de focos. Sale de los vídeos
 * de la noche en que el Bernabéu estrenó el segundo anillo: la imagen que la
 * gente reconoce no es el césped, son las dos cintas de luz dando la vuelta.
 *
 * **Todo se mide en `cqw`**, no en porcentajes. Un `17%` de alto vale una cosa
 * en las bandas (porcentaje del ancho) y otra en los fondos (porcentaje del
 * alto), así que el estadio salía más alto por los lados que por detrás de la
 * portería. Con `cqw` —el contenedor declara `container-type: inline-size`—
 * una unidad es una unidad en los cuatro lados.
 *
 * **Se apaga.** Lo que se enseña es la jugada, y para una charla de pizarra el
 * estadio sobra; para la foto que se manda por el grupo, no.
 */

import { CSSProperties } from "react";

import { VALLA_TEXTO, disenoDe, type CampoId } from "@/lib/tactics/campos";

type Lado = "fondo" | "cerca" | "izquierda" | "derecha";

const LADOS: Lado[] = ["fondo", "cerca", "izquierda", "derecha"];

/**
 * Cuánta hierba hay fuera de las líneas de cal.
 *
 * No es adorno. Con la cámara a ras de suelo, el campo se acababa en la línea
 * de banda y debajo no había nada: un corte recto contra el negro del marco,
 * como si el césped estuviera recortado con tijera. La banda de fuera es lo
 * que hace que el campo tenga suelo.
 */
const BANDA = 8;

/** El alto del campo en las mismas unidades que el ancho (100 x 68). */
const ALTO_CAMPO = 68;

/**
 * Alturas de cada anillo del estadio, contadas desde el césped.
 *
 * El tope no es estético: la grada de la banda cercana crece hacia la cámara,
 * y pasada cierta altura se mete por delante del campo y tapa la jugada. 21
 * es lo que aguanta el modo Jugador (el más tumbado) sin comerse el área.
 */
const ANILLOS = {
  foso: [0, 1.4],
  led1: [1.4, 4.6],
  gradaBaja: [4.6, 11],
  led2: [11, 13.4],
  gradaAlta: [13.4, 21],
} as const;

/** A qué altura vuela la cubierta. */
const TECHO = 23;

/** Cuánto sobresale la cubierta por fuera del graderío y por dentro del foso. */
const TECHO_FUERA = 9;
const TECHO_DENTRO = 0.6;

/**
 * Cuánto se echa hacia atrás cada anillo, en grados.
 *
 * Un estadio no es una caja: las gradas se abren hacia fuera según suben. Y
 * como cada panel se bisagra en el suelo, el anillo de arriba arranca en la
 * vertical mientras el de abajo ya se ha ido hacia fuera — que es justo el
 * voladizo de un anfiteatro sobre el de abajo, y de paso no deja hueco negro
 * entre los dos.
 */
const VUELO = 6;

/**
 * Hacia dónde mira cada lado, en coordenadas del campo (la Y crece hacia
 * abajo). Sirve para saber cuál de los cuatro tiene la cámara debajo.
 */
const NORMAL: Record<Lado, [number, number]> = {
  fondo: [0, -1],
  cerca: [0, 1],
  izquierda: [-1, 0],
  derecha: [1, 0],
};

/**
 * Cuánto se ve la marquesina de un lado, según hacia dónde mire la cámara.
 *
 * Una cubierta es un plano en el aire: la del lado desde el que se mira queda
 * **entre el objetivo y el campo** y lo cruza con una banda de luz por la
 * mitad. En un estadio de verdad no se ve porque la cámara está debajo de
 * ella, y esto es lo mismo: el lado que la cámara tiene encima se apaga. Se
 * desvanece en vez de encenderse de golpe para que al orbitar no dé un salto.
 */
function opacidadTecho(lado: Lado, yaw: number): number {
  const rad = (yaw * Math.PI) / 180;

  /* Dirección de la que viene la cámara, deshecho el giro del plano. */
  const camara: [number, number] = [Math.sin(rad), Math.cos(rad)];

  const [nx, ny] = NORMAL[lado];
  const cara = nx * camara[0] + ny * camara[1];

  // 1 de espaldas a la cámara (se ve entera), 0 encima de ella (desaparece).
  return Math.min(1, Math.max(0, (0.2 - cara) / 0.45));
}

/** Textura de asientos: filas finas que se aclaran hacia arriba. */
const ASIENTOS =
  "repeating-linear-gradient(0deg, rgba(255,255,255,.10) 0 1px, transparent 1px 7px), repeating-linear-gradient(90deg, rgba(0,0,0,.30) 0 1px, transparent 1px 10px)";

/**
 * Un panel del estadio, bisagrado sobre uno de los bordes del campo.
 *
 * `lado` dice de qué borde sale; `desde` y `hasta` a qué altura empieza y
 * acaba, en `cqw`. La bisagra siempre es el borde pegado al césped, aunque el
 * panel arranque a diez unidades del suelo: por eso el origen se calcula en
 * porcentaje del propio panel y puede quedar fuera de él.
 */
function Panel({
  lado,
  desde,
  hasta,
  fondo,
  textura,
  children,
  vuelo = VUELO,
  className,
}: {
  lado: Lado;
  desde: number;
  hasta: number;
  fondo: string;
  textura?: string;
  children?: React.ReactNode;
  vuelo?: number;
  className?: string;
}) {
  const grosor = hasta - desde;

  /* Dónde cae la bisagra dentro del panel, en porcentaje de su propio grosor.
     Con `desde` > 0 sale negativo, y eso es correcto: el eje de giro está por
     debajo del panel, en el suelo. */
  const origen = (hasta / grosor) * 100;

  const comun: CSSProperties = {
    position: "absolute",
    /* Todo en `backgroundImage`: mezclar la forma corta `background` con la
       larga en el mismo estilo hace que React avise en cada render. */
    backgroundImage: textura ? `${textura}, ${fondo}` : fondo,
    /* Cada panel mira hacia el campo y sólo se ve por esa cara. Es lo que
       pone la cámara dentro del estadio: la grada de la banda de acá está
       detrás del objetivo, así que desaparece en vez de tapar la jugada con
       su reverso y con el rótulo del LED escrito del revés. */
    backfaceVisibility: "hidden",
    overflow: "hidden",
  };

  /* Las bisagras están en el borde de la BANDA, no en la línea de cal: la
     valla de un estadio no se planta encima de la raya. */
  const porLado: Record<Lado, CSSProperties> = {
    fondo: {
      left: `${-BANDA}cqw`,
      width: `${100 + BANDA * 2}cqw`,
      height: `${grosor}cqw`,
      top: `${-hasta - BANDA}cqw`,
      transformOrigin: `50% ${origen}%`,
      transform: `rotateX(${-(90 - vuelo)}deg)`,
    },
    cerca: {
      left: `${-BANDA}cqw`,
      width: `${100 + BANDA * 2}cqw`,
      height: `${grosor}cqw`,
      top: `${ALTO_CAMPO + BANDA + desde}cqw`,
      transformOrigin: `50% ${(-desde * 100) / grosor}%`,
      transform: `rotateX(${90 - vuelo}deg)`,
    },
    izquierda: {
      top: `${-BANDA}cqw`,
      height: `${ALTO_CAMPO + BANDA * 2}cqw`,
      width: `${grosor}cqw`,
      left: `${-hasta - BANDA}cqw`,
      transformOrigin: `${origen}% 50%`,
      transform: `rotateY(${90 - vuelo}deg)`,
    },
    derecha: {
      top: `${-BANDA}cqw`,
      height: `${ALTO_CAMPO + BANDA * 2}cqw`,
      width: `${grosor}cqw`,
      left: `${100 + BANDA + desde}cqw`,
      transformOrigin: `${(-desde * 100) / grosor}% 50%`,
      transform: `rotateY(${-(90 - vuelo)}deg)`,
    },
  };

  return (
    <div className={className} style={{ ...comun, ...porLado[lado] }}>
      {children}
    </div>
  );
}

/**
 * Un trozo de cubierta, tumbado a la altura del techo.
 *
 * No se bisagra: se queda paralelo al césped y se sube con `translateZ`. Los
 * cuatro se solapan en las esquinas, que es lo que hace la esquina de una
 * cubierta de verdad.
 */
function Techo({
  lado,
  color,
  opacidad,
}: {
  lado: Lado;
  color: string;
  opacidad: number;
}) {
  const largo = `${100 + (BANDA + TECHO_FUERA) * 2}cqw`;
  const ancho = `${TECHO_FUERA + BANDA - TECHO_DENTRO}cqw`;
  const fuera = `${-(BANDA + TECHO_FUERA)}cqw`;

  /* Cerchas: van perpendiculares al borde que cubren. */
  const cerchas =
    lado === "fondo" || lado === "cerca"
      ? "repeating-linear-gradient(90deg, rgba(255,255,255,.055) 0 1px, transparent 1px 14px)"
      : "repeating-linear-gradient(0deg, rgba(255,255,255,.055) 0 1px, transparent 1px 14px)";

  const porLado: Record<Lado, CSSProperties> = {
    fondo: { left: fuera, width: largo, top: fuera, height: ancho },
    cerca: {
      left: fuera,
      width: largo,
      top: `${ALTO_CAMPO + TECHO_DENTRO}cqw`,
      height: ancho,
    },
    izquierda: { top: fuera, height: largo, left: fuera, width: ancho },
    derecha: {
      top: fuera,
      height: largo,
      left: `${100 + TECHO_DENTRO}cqw`,
      width: ancho,
    },
  };

  /* El degradado va del borde exterior (oscuro) al interior, y el último tramo
     es la línea de focos que cuelga del filo y alumbra el campo. */
  const haciaDentro: Record<Lado, string> = {
    fondo: "180deg",
    cerca: "0deg",
    izquierda: "90deg",
    derecha: "270deg",
  };

  return (
    <div
      style={{
        position: "absolute",
        ...porLado[lado],
        backgroundImage: `${cerchas}, linear-gradient(${haciaDentro[lado]}, rgba(0,0,0,.55) 0%, ${color} 55%, rgba(255,255,255,.10) 96%, rgba(255,255,255,.34) 100%)`,
        transform: `translateZ(${TECHO}cqw)`,
        boxShadow: "0 0 40px rgba(0,0,0,.6)",
        opacity: opacidad,
      }}
    />
  );
}

export default function EntornoEstadio({
  campo,
  titulo,
  escena,
  yaw = 0,
}: {
  campo?: CampoId;
  /** Lo que canta el videomarcador: el nombre de la pizarra. */
  titulo?: string;
  /** Y debajo, la escena que se está viendo. */
  escena?: string;
  /** Giro de la cámara, para saber qué marquesina tiene el objetivo debajo. */
  yaw?: number;
}) {
  const { entorno } = disenoDe(campo);

  const gradaBajaFondo = `linear-gradient(180deg, ${entorno.gradaAlta} 0%, ${entorno.grada} 100%)`;

  /* La grada alta recibe la luz del techo, así que va al revés: clara arriba y
     en sombra abajo, donde le tapa el voladizo. */
  const gradaAltaFondo = `linear-gradient(180deg, rgba(255,255,255,.07) 0%, ${entorno.gradaAlta} 38%, ${entorno.grada} 100%)`;

  const ledFondo = `linear-gradient(180deg, rgba(255,255,255,.16) 0%, ${entorno.led} 22%, ${entorno.led} 78%, rgba(0,0,0,.45) 100%)`;

  const fosoFondo = `linear-gradient(180deg, ${entorno.foso} 0%, rgba(0,0,0,.7) 100%)`;

  /** El público sentado: un moteado fino que además destella. */
  const publico = entorno.publico
    ? `radial-gradient(circle at 50% 50%, ${entorno.publico} 0 32%, transparent 34%)`
    : undefined;

  /**
   * El rótulo del anillo LED.
   *
   * En los fondos se lee tal cual. En las bandas el panel está de canto —su
   * lado largo es el alto de la caja—, así que el texto se mete en una caja
   * tumbada y se gira un cuarto de vuelta para correr a lo largo del anillo.
   */
  const rotulo = (lado: Lado, alto: number) => {
    const deLado = lado === "izquierda" || lado === "derecha";

    const estiloTexto: CSSProperties = {
      color: entorno.vallaTexto,
      fontSize: `${alto * 0.5}cqw`,
      letterSpacing: `${alto * 0.16}cqw`,
      textShadow: entorno.ledBrillo
        ? `0 0 ${alto * 0.4}cqw ${entorno.ledBrillo}`
        : undefined,
    };

    if (!deLado) {
      return (
        <span
          className="absolute inset-0 flex items-center justify-center whitespace-nowrap font-bold uppercase leading-none"
          style={estiloTexto}
        >
          {VALLA_TEXTO}
        </span>
      );
    }

    return (
      <span
        className="absolute left-1/2 top-1/2 flex items-center justify-center whitespace-nowrap font-bold uppercase leading-none"
        style={{
          ...estiloTexto,
          width: `${ALTO_CAMPO + BANDA * 2}cqw`,
          height: `${alto}cqw`,
          transform: `translate(-50%, -50%) rotate(${
            lado === "izquierda" ? -90 : 90
          }deg)`,
        }}
      >
        {VALLA_TEXTO}
      </span>
    );
  };

  /** Un anillo LED completo: los cuatro lados, con rótulo y barrido de luz. */
  const anilloLed = (rango: readonly [number, number], clave: string) => {
    const [desde, hasta] = rango;
    const alto = hasta - desde;

    return LADOS.map((lado) => (
      <Panel
        key={`${clave}-${lado}`}
        lado={lado}
        desde={desde}
        hasta={hasta}
        fondo={ledFondo}
      >
        {rotulo(lado, alto)}

        {/* El barrido: la cinta de luz que recorre el anillo sin parar. */}
        {entorno.ledBrillo ? (
          <span
            className="pizarra-led-barrido"
            style={{
              backgroundImage: `linear-gradient(100deg, transparent 0%, ${entorno.ledBrillo} 50%, transparent 100%)`,
            }}
          />
        ) : null}
      </Panel>
    ));
  };

  /** Un anillo de grada: asientos, público y el destello de los móviles. */
  const anilloGrada = (
    rango: readonly [number, number],
    fondo: string,
    clave: string,
    tamPublico: number
  ) =>
    LADOS.map((lado) => (
      <Panel
        key={`${clave}-${lado}`}
        lado={lado}
        desde={rango[0]}
        hasta={rango[1]}
        fondo={fondo}
        textura={ASIENTOS}
      >
        {publico ? (
          <>
            <span
              className="absolute inset-0"
              style={{
                backgroundImage: publico,
                backgroundSize: `${tamPublico}cqw ${tamPublico * 0.8}cqw`,
              }}
            />

            {/* Los flashes de la grada. Sin ellos el público es una textura;
                con ellos, ochenta mil personas. */}
            <span
              className="pizarra-grada-destellos absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 50%, rgba(255,255,255,.85) 0 18%, transparent 22%)",
                backgroundSize: `${tamPublico * 7}cqw ${tamPublico * 5}cqw`,
              }}
            />
          </>
        ) : null}
      </Panel>
    ));

  /**
   * El videomarcador de detrás de cada portería.
   *
   * En los vídeos es lo que levanta al estadio: la pantalla cantando la
   * alineación. Aquí canta lo que toca —de qué pizarra y de qué escena va lo
   * que se está viendo—, así que la captura ya sale rotulada.
   */
  const pantalla = (lado: "izquierda" | "derecha") => (
    <span
      className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center gap-[0.5cqw] overflow-hidden rounded-[0.8cqw] border border-white/25 bg-black/80 text-center"
      style={{
        width: `${ALTO_CAMPO * 0.5}cqw`,
        height: `${(ANILLOS.gradaAlta[1] - ANILLOS.gradaAlta[0]) * 0.6}cqw`,
        transform: `translate(-50%, -50%) rotate(${
          lado === "izquierda" ? -90 : 90
        }deg)`,
        boxShadow: `0 0 3cqw ${entorno.ledBrillo || "rgba(255,255,255,.3)"}`,
      }}
    >
      <span
        className="max-w-full truncate px-[2cqw] font-bold uppercase leading-none"
        style={{
          fontSize: "2cqw",
          letterSpacing: "0.35cqw",
          color: entorno.vallaTexto,
        }}
      >
        {titulo}
      </span>

      {escena ? (
        <span
          className="max-w-full truncate px-[2cqw] uppercase leading-none"
          style={{
            fontSize: "1.3cqw",
            letterSpacing: "0.28cqw",
            color: "rgba(255,255,255,.55)",
          }}
        >
          {escena}
        </span>
      ) : null}
    </span>
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ transformStyle: "preserve-3d", containerType: "inline-size" }}
    >
      {/*
        Orden de dibujo: de arriba hacia abajo y de fuera hacia dentro. Lo alto
        va primero para que el anillo LED recorte contra los asientos, como en
        un estadio de verdad.
      */}

      {entorno.techo
        ? LADOS.map((lado) => {
            const opacidad = opacidadTecho(lado, yaw);
            if (opacidad <= 0.01) return null;

            return (
              <Techo
                key={`techo-${lado}`}
                lado={lado}
                color={entorno.techo}
                opacidad={opacidad}
              />
            );
          })
        : null}

      {anilloGrada(ANILLOS.gradaAlta, gradaAltaFondo, "alta", 0.85)}

      {/* Videomarcadores: colgados de la grada alta de los dos fondos. */}
      {titulo && entorno.techo ? (
        <>
          <Panel
            lado="izquierda"
            desde={ANILLOS.gradaAlta[0]}
            hasta={ANILLOS.gradaAlta[1]}
            fondo="none"
          >
            {pantalla("izquierda")}
          </Panel>

          <Panel
            lado="derecha"
            desde={ANILLOS.gradaAlta[0]}
            hasta={ANILLOS.gradaAlta[1]}
            fondo="none"
          >
            {pantalla("derecha")}
          </Panel>
        </>
      ) : null}

      {anilloLed(ANILLOS.led2, "led2")}

      {anilloGrada(ANILLOS.gradaBaja, gradaBajaFondo, "baja", 1.1)}

      {anilloLed(ANILLOS.led1, "led1")}

      {LADOS.map((lado) => (
        <Panel
          key={`foso-${lado}`}
          lado={lado}
          desde={ANILLOS.foso[0]}
          hasta={ANILLOS.foso[1]}
          fondo={fosoFondo}
          vuelo={0}
        />
      ))}

      {/*
        La banda de hierba de fuera de las líneas, tumbada sobre el plano. Va
        la última en el marcado pero por debajo de todo con `translateZ`: el
        campo se pinta encima y lo único que asoma es el borde.
      */}
      <div
        className="absolute"
        style={{
          inset: `${-BANDA}cqw`,
          backgroundColor: entorno.banda,
          backgroundImage: `radial-gradient(120% 120% at 50% 35%, ${entorno.halo} 0%, transparent 70%)`,
          boxShadow: "inset 0 0 90px rgba(0,0,0,.55)",
          transform: "translateZ(-0.6px)",
        }}
      />
    </div>
  );
}
