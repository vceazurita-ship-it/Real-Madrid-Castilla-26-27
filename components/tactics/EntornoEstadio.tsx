"use client";

/**
 * Lo que hay alrededor del campo cuando la cámara se inclina.
 *
 * Con la perspectiva encendida, el campo dejaba de ser un rectángulo plano
 * pero seguía flotando sobre nada: una jugada vista desde el fondo se salía
 * hacia un vacío negro y perdía la referencia de dónde está la portería.
 * Aquí se levantan las vallas de publicidad y el graderío **en el mismo
 * espacio 3D de la cámara**, así que orbitar el campo los orbita con él.
 *
 * Cómo, sin motor 3D: el plano del campo ya lleva `transform-style:
 * preserve-3d`, así que basta con colgar de él cuatro paneles y girarlos 90°
 * sobre el borde que les toca. Cada uno se bisagra con `transform-origin` en
 * su lado pegado al césped, y al rotar se pone de pie. Es la misma técnica de
 * la cámara —CSS, no WebGL—, y por eso sobrevive a la captura de imagen con
 * la que se exporta la pizarra.
 *
 * **Se apaga.** Lo que se enseña es la jugada, y para una charla de pizarra el
 * estadio sobra; para la foto que se manda por el grupo, no.
 */

import { CSSProperties } from "react";

import { VALLA_TEXTO, disenoDe, type CampoId } from "@/lib/tactics/campos";

/** Alto de la valla y del graderío, como fracción del ancho del campo. */
const VALLA = 3.4;
const GRADA = 17;

/**
 * Cuánta hierba hay fuera de las líneas de cal.
 *
 * No es adorno. Con la cámara a ras de suelo, el campo se acababa en la línea
 * de banda y debajo no había nada: un corte recto contra el negro del marco,
 * como si el césped estuviera recortado con tijera. La banda de fuera es lo
 * que hace que el campo tenga suelo.
 */
const BANDA = 9;

/** Textura de asientos: filas finas que se aclaran hacia arriba. */
const ASIENTOS =
  "repeating-linear-gradient(0deg, rgba(255,255,255,.10) 0 1px, transparent 1px 7px), repeating-linear-gradient(90deg, rgba(0,0,0,.30) 0 1px, transparent 1px 10px)";

/**
 * Un panel de pie, bisagrado sobre uno de los bordes del campo.
 *
 * `lado` dice de qué borde sale. La bisagra siempre es el borde pegado al
 * césped, para que el panel crezca hacia arriba y no se hunda bajo él.
 */
function Panel({
  lado,
  alto,
  fondo,
  textura,
  children,
  z = 0,
}: {
  lado: "fondo" | "cerca" | "izquierda" | "derecha";
  /** Alto del panel, en porcentaje del lado que le corresponde. */
  alto: number;
  fondo: string;
  textura?: string;
  children?: React.ReactNode;
  /** A qué altura arranca, para apilar graderío sobre valla. */
  z?: number;
}) {
  const comun: CSSProperties = {
    position: "absolute",
    /* Todo en `backgroundImage`: mezclar la forma corta `background` con la
       larga en el mismo estilo hace que React avise en cada render. */
    backgroundImage: textura ? `${textura}, ${fondo}` : fondo,
    backfaceVisibility: "hidden",
    overflow: "hidden",
  };

  /* Las bisagras están en el borde de la BANDA, no en la línea de cal: la
     valla de un estadio no se planta encima de la raya. */
  const porLado: Record<string, CSSProperties> = {
    fondo: {
      left: `${-BANDA}%`,
      width: `${100 + BANDA * 2}%`,
      height: `${alto}%`,
      top: `${-alto - BANDA}%`,
      transformOrigin: "50% 100%",
      transform: `rotateX(-90deg) translateZ(${z}px)`,
    },
    cerca: {
      left: `${-BANDA}%`,
      width: `${100 + BANDA * 2}%`,
      height: `${alto}%`,
      top: `${100 + BANDA}%`,
      transformOrigin: "50% 0%",
      transform: `rotateX(90deg) translateZ(${z}px)`,
    },
    izquierda: {
      top: `${-BANDA}%`,
      height: `${100 + BANDA * 2}%`,
      width: `${alto}%`,
      left: `${-alto - BANDA}%`,
      transformOrigin: "100% 50%",
      transform: `rotateY(90deg) translateZ(${z}px)`,
    },
    derecha: {
      top: `${-BANDA}%`,
      height: `${100 + BANDA * 2}%`,
      width: `${alto}%`,
      left: `${100 + BANDA}%`,
      transformOrigin: "0% 50%",
      transform: `rotateY(-90deg) translateZ(${z}px)`,
    },
  };

  return <div style={{ ...comun, ...porLado[lado] }}>{children}</div>;
}

export default function EntornoEstadio({ campo }: { campo?: CampoId }) {
  const { entorno } = disenoDe(campo);

  const gradaFondo = `linear-gradient(180deg, ${entorno.gradaAlta} 0%, ${entorno.grada} 100%)`;

  const vallaFondo = `linear-gradient(180deg, ${entorno.valla} 0%, rgba(0,0,0,.55) 100%)`;

  /* El rótulo sólo se lee de verdad en el fondo y en la banda de enfrente. */
  const rotulo = (
    <span
      className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-[2.6cqw] font-bold uppercase leading-none tracking-[0.42em]"
      style={{ color: entorno.vallaTexto }}
    >
      {VALLA_TEXTO}
    </span>
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ transformStyle: "preserve-3d", containerType: "inline-size" }}
    >
      {/*
        El graderío va primero y más alto, detrás de la valla: así la valla
        recorta contra los asientos como en un estadio de verdad.
      */}
      <Panel lado="fondo" alto={GRADA} fondo={gradaFondo} textura={ASIENTOS} />
      <Panel lado="cerca" alto={GRADA} fondo={gradaFondo} textura={ASIENTOS} />
      <Panel lado="izquierda" alto={GRADA} fondo={gradaFondo} textura={ASIENTOS} />
      <Panel lado="derecha" alto={GRADA} fondo={gradaFondo} textura={ASIENTOS} />

      <Panel lado="fondo" alto={VALLA} fondo={vallaFondo}>
        {rotulo}
      </Panel>

      <Panel lado="cerca" alto={VALLA} fondo={vallaFondo}>
        {rotulo}
      </Panel>

      <Panel lado="izquierda" alto={VALLA} fondo={vallaFondo} />
      <Panel lado="derecha" alto={VALLA} fondo={vallaFondo} />

      {/*
        La banda de hierba de fuera de las líneas, tumbada sobre el plano. Va
        la última en el marcado pero por debajo de todo con `translateZ`: el
        campo se pinta encima y lo único que asoma es el borde.
      */}
      <div
        className="absolute"
        style={{
          inset: `${-BANDA}%`,
          backgroundColor: entorno.banda,
          backgroundImage: `radial-gradient(120% 120% at 50% 35%, ${entorno.halo} 0%, transparent 70%)`,
          boxShadow: "inset 0 0 90px rgba(0,0,0,.55)",
          transform: "translateZ(-0.6px)",
        }}
      />
    </div>
  );
}
