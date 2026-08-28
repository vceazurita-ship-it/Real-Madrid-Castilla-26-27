/**
 * Documento 01 · VALORES Y ANTIVALORES.
 *
 * El contenido sale de `public/01. RMCF - CASTILLA VALORES.html`, que era la
 * presentación montada a mano tras el recuento de la plantilla: cinco valores
 * votados, sus antivalores enfrentados y las conductas observables de cada uno
 * dentro y fuera del campo.
 *
 * Qué se ha hecho con ese texto al traerlo:
 *
 * - **Se han quitado las marcas `[cite: 2]`** que el HTML arrastraba de la
 *   herramienta con la que se redactó. Iban impresas en las diapositivas.
 * - **Se han corregido las tildes que faltaban** en los titulares
 *   («Egoismo» → «Egoísmo»).
 * - **Se ha añadido una portada** que el original no tenía. Las diez
 *   diapositivas empezaban directamente en HUMILDAD, así que el fichero
 *   circulando suelto no decía de qué temporada era ni de dónde salían los
 *   números de votos. Es la misma decisión que se tomó con el dossier de
 *   desplazamiento.
 * - **El «INADMISIBLE:» deja de ir dentro del texto** y pasa a ser la chapa
 *   del bloque, que es donde se lee de lejos en una proyección.
 *
 * No se ha tocado ni una palabra del contenido: los valores son de la
 * plantilla, no del documento.
 */

import type { DocumentoCultura, Valor } from "@/lib/cultura/modelo";

const VALORES: Valor[] = [
  {
    numero: 1,
    titulo: "Humildad",
    votos: "Votado por 9 jugadores",
    antivalores: "Egoísmo (22) y Arrogancia (3)",
    explicacion:
      "Tener humildad **no es sentirse menos que nadie** ni agachar la cabeza. " +
      "En el Real Madrid, la humildad es saber que la camiseta que llevas tiene " +
      "historia gracias al trabajo de muchos antes que tú. Es **escuchar para " +
      "aprender**, aceptar cuando te corrigen y recordar que **el escudo está por " +
      "delante de cualquier nombre**. Demuestra cada día por qué mereces quedarte.",
    bloques: [
      {
        ambito: "campo",
        titulo: "En el campo",
        matiz: "Entrenamiento y partido",
        suma: {
          rotulo: "Humildad",
          texto:
            "Aceptar las correcciones a la primera sin gestos ni excusas. " +
            "Celebrar con la misma energía la cobertura del lateral que el gol.",
        },
        resta: {
          rotulo: "Egoísmo y arrogancia",
          texto:
            "Poner malas caras tras un cambio, reprochar en público o buscar el " +
            "lucimiento individual por encima del equipo.",
        },
      },
      {
        ambito: "fuera",
        titulo: "Fuera del campo",
        matiz: "Vestuario y residencia",
        suma: {
          rotulo: "Humildad",
          texto:
            "Tratar con máximo respeto a todo el personal de Valdebebas (fisios, " +
            "utilleros, limpieza). Pies en la tierra.",
        },
        resta: {
          rotulo: "Egoísmo y arrogancia",
          texto:
            "Divismo, sobreexposición de ego en redes sociales o prensa, y " +
            "sentirse superior por vestir esta camiseta.",
        },
      },
    ],
  },
  {
    numero: 2,
    titulo: "Compromiso",
    votos: "Votado por 8 jugadores",
    antivalores: "Conformismo (10) e Irresponsabilidad (6)",
    explicacion:
      "El compromiso es **tu palabra dada**. Es dar el 100 % incluso los días que " +
      "estás cansado, cuando te toca ser suplente o cuando las cosas no salen. " +
      "Compromiso es **hacer lo que toca, cuando toca, aunque nadie te esté " +
      "mirando**. Aquí no venimos a probar suerte, venimos a cumplir cada día.",
    bloques: [
      {
        ambito: "campo",
        titulo: "En el campo",
        matiz: "Entrenamiento y partido",
        suma: {
          rotulo: "Compromiso",
          texto:
            "Repliegue defensivo a máxima intensidad en el minuto 88. Mantener la " +
            "presión alta hasta el silbato final.",
        },
        resta: {
          rotulo: "Conformismo e irresponsabilidad",
          texto:
            "Borrarse del esfuerzo, no bajar a defender tras pérdida o conformarse " +
            "cuando el resultado es favorable.",
        },
      },
      {
        ambito: "fuera",
        titulo: "Fuera del campo",
        matiz: "Prevención, banquillo y rotaciones",
        suma: {
          rotulo: "Compromiso",
          texto:
            "Llegar 15 minutos antes a la zona de prevención y gimnasio. Apoyar " +
            "con fuerza desde el banquillo, sin caras largas.",
        },
        resta: {
          rotulo: "Conformismo e irresponsabilidad",
          texto:
            "Impuntualidad, excusas por cansancio y desentenderse de la dinámica " +
            "colectiva si te toca rotar.",
        },
      },
    ],
  },
  {
    numero: 3,
    titulo: "Profesionalidad",
    votos: "Votado por 6 jugadores",
    antivalores: "Desprecio (6) y Mediocridad (3)",
    explicacion:
      "Ser profesional es **un estilo de vida las 24 horas**, no solo las dos horas " +
      "que pisas el césped. Tu cuerpo es tu herramienta de trabajo. Implica " +
      "**rigor, entrenamiento invisible, nutrición impecable y puntualidad " +
      "militar**. Representas al mejor club del mundo dentro y fuera de la " +
      "residencia.",
    bloques: [
      {
        ambito: "campo",
        titulo: "En el campo",
        matiz: "Carga, vídeo y balón parado",
        suma: {
          rotulo: "Profesionalidad",
          texto:
            "Entrenar cada tarea al máximo de la métrica GPS. Máxima atención " +
            "operativa en las sesiones de vídeo y de ABP.",
        },
        resta: {
          rotulo: "Desprecio y mediocridad",
          texto:
            "Reservarse en los entrenamientos, especular con la carga física o " +
            "mostrar apatía en la preparación táctica.",
        },
      },
      {
        ambito: "fuera",
        titulo: "Fuera del campo",
        matiz: "Descanso, nutrición e instalaciones",
        suma: {
          rotulo: "Profesionalidad",
          texto:
            "Rigor absoluto en el descanso nocturno, la hidratación y la " +
            "nutrición. Dejar vestuarios e instalaciones impecables.",
        },
        resta: {
          rotulo: "Desprecio y mediocridad",
          texto:
            "Malos hábitos fuera de Valdebebas, desorden en las áreas comunes y " +
            "descuido del material del club.",
        },
      },
    ],
  },
  {
    numero: 4,
    titulo: "Compañerismo",
    votos: "Votado por 5 jugadores (+3 Amistad)",
    antivalores: "Deslealtad (5)",
    explicacion:
      "Es la **red de seguridad del vestuario**. Ningún jugador triunfa solo. " +
      "Compañerismo es no dejar a nadie atrás: si un compañero falla, tú le " +
      "resuelves la papeleta; si se cae, tú le levantas. La fuerza de este equipo " +
      "se mide en **lo unidos que estemos en los momentos duros**.",
    bloques: [
      {
        ambito: "campo",
        titulo: "En el campo",
        matiz: "Entrenamiento y partido",
        suma: {
          rotulo: "Compañerismo",
          texto:
            "Chocar la mano y dar ánimo inmediato al compañero tras una pérdida. " +
            "Hacer piña defensiva ante el rival.",
        },
        resta: {
          rotulo: "Deslealtad",
          texto:
            "Reprochar fallos en público al compañero, hacer gestos despectivos en " +
            "el césped o la insolidaridad en el juego.",
        },
      },
      {
        ambito: "fuera",
        titulo: "Fuera del campo",
        matiz: "Vestuario y cantera",
        suma: {
          rotulo: "Compañerismo",
          texto:
            "Acoger e integrar activamente a los más jóvenes de la cantera. Hablar " +
            "las cosas siempre a la cara dentro del vestuario.",
        },
        resta: {
          rotulo: "Deslealtad",
          texto:
            "Rajadas a las espaldas, crear clanes o grupos cerrados y filtrar " +
            "comentarios internos fuera.",
        },
      },
    ],
  },
  {
    numero: 5,
    titulo: "Exigencia y valentía",
    votos: "Votado por 4 jugadores (+3 Valentía / Pasión)",
    antivalores: "Conformismo y Apatía",
    explicacion:
      "Ganar en el Real Madrid no es una opción, **es una costumbre que se entrena " +
      "cada mañana**. Competir con valentía es no regalar un metro, pedir el balón " +
      "bajo presión y no tener miedo a equivocarte. Exigirte a ti mismo te hace " +
      "mejor; **exigir al compañero eleva el nivel de todo el Castilla**.",
    bloques: [
      {
        ambito: "campo",
        titulo: "En el campo",
        matiz: "Duelos y momentos de tensión",
        suma: {
          rotulo: "Exigencia y valentía",
          texto:
            "Disputar cada balón dividido como una final. Pedir el balón en los " +
            "momentos de tensión y mantener el ritmo aunque vayamos ganando.",
        },
        resta: {
          rotulo: "Conformismo y apatía",
          texto:
            "Esconderse en los partidos difíciles, jugar con miedo al fallo o dar " +
            "un partido por perdido antes de tiempo.",
        },
      },
      {
        ambito: "fuera",
        titulo: "Fuera del campo",
        matiz: "Aprendizaje y objetivo común",
        suma: {
          rotulo: "Aprendizaje y objetivo común",
          texto:
            "Pedir vídeo al cuerpo técnico para pulir errores. Trabajar hacia la " +
            "meta colectiva por encima de contratos o intereses personales.",
        },
        resta: {
          rotulo: "Conformismo y apatía",
          texto:
            "Victimismo, culpar a los árbitros o al entrenador, y poner las metas " +
            "individuales por delante del grupo.",
        },
      },
    ],
  },
];

export const DOCUMENTO_VALORES: DocumentoCultura = {
  id: "01-valores",
  numero: "01",
  titulo: "Valores y antivalores",
  subtitulo: "Lo que nos define y lo que no se admite",
  resumen:
    "Los cinco valores que votó la plantilla, cada uno enfrentado a los " +
    "antivalores que lo destruyen, con las conductas observables dentro y fuera " +
    "del campo.",
  etiquetas: ["Cultura", "Valores", "Conductas observables", "Vestuario"],
  temporada: "26 / 27",
  archivo: "01. RMCF - CASTILLA VALORES",
  origen: "public/01. RMCF - CASTILLA VALORES.html",
  diapositivas: [
    {
      tipo: "portada",
      titulo: "Valores y antivalores",
      subtitulo: "Temporada 26 / 27 · Real Madrid Castilla",
      entradilla:
        "Estos cinco valores **no los ha escrito el cuerpo técnico: los ha votado " +
        "la plantilla**. Cada uno viene con su antivalor enfrentado —lo que lo " +
        "destruye— y con las conductas por las que se reconoce, dentro y fuera del " +
        "campo. Lo que se mide no es lo que decimos, es **lo que se ve cada día**.",
      indice: VALORES.map((valor) => ({
        numero: valor.numero,
        titulo: valor.titulo,
        votos: valor.votos,
      })),
    },
    /* Cada valor, su portada y sus conductas seguidas: es como se presenta en
       la reunión, un valor por vez. */
    ...VALORES.flatMap((valor) => [
      { tipo: "valor" as const, valor },
      { tipo: "conductas" as const, valor },
    ]),
  ],
};
