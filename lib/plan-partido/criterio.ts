/*
|--------------------------------------------------------------------------
| EL CRITERIO EXPERTO DEL BOCETO DEL PLAN (11/10/2026)
|--------------------------------------------------------------------------
|
| El dato dice QUÉ pasa (el rival presiona mucho, concede centros, llega en
| transición); esto dice QUÉ SE HACE con eso, como lo haría un cuerpo técnico
| de élite: principios de modelo de juego, intenciones tácticas por fase,
| emparejamientos entre sistemas y la gestión emocional de un equipo de alto
| rendimiento según el contexto de la semana.
|
| Es conocimiento escrito, no inferencia: cada regla lleva su principio y, si
| tiene autor reconocible, de quién viene (Cruyff, Guardiola, Sacchi, Bielsa,
| Klopp, Simeone, Lillo, Mourinho, Rangnick…). Se cita el principio, no se
| inventa una frase. Una regla sólo dispara cuando su contexto se da: con el
| dato que la enciende o con la situación (venimos de perder, jugamos fuera,
| el rival lleva tres victorias…). Lo que no se puede sostener, no se propone.
|
| Intenciones tácticas, para que cada sugerencia diga de qué fase es:
|   PROGRESAR · FINALIZAR · PROTEGER · RECUPERAR · TRANSICIÓN OF · TRANSICIÓN DEF · ABP · EMOCIONAL
*/

import type { JugadorEquipo, PerfilColectivo, ResumenEquipo } from "@/lib/data-analisis/equipo";
import type { RivalAbp } from "@/lib/abp/rivalAbp";
import type { AspectoKey } from "@/lib/abp/microciclo";
import { ASPECTO_BY_KEY } from "@/lib/abp/microciclo";
import type { CampoBoceto } from "./boceto";

export type Intencion =
  | "PROGRESAR"
  | "FINALIZAR"
  | "PROTEGER"
  | "RECUPERAR"
  | "TRANSICIÓN OF"
  | "TRANSICIÓN DEF"
  | "ABP"
  | "EMOCIONAL";

export type SugerenciaExperta = {
  campo: CampoBoceto;
  texto: string;
  /** El principio del que sale y, si lo tiene, de quién: va a los porqués, no al plan. */
  motivo: string;
  intencion: Intencion;
};

export type ContextoCriterio = {
  rival: string;
  perfil: PerfilColectivo | null;
  resumen: ResumenEquipo | null;
  plantilla: JugadorEquipo[];
  abp: RivalAbp | null;
  nosotros: { resumen: ResumenEquipo | null; perfil: PerfilColectivo | null };
  /** «Local», «Visitante»… tal como lo escribe la hoja; vacío si no se sabe. */
  donde: string;
};

/* ------------------------------------------------------------------ */
/*  Lectura de los datos en el lenguaje del criterio                   */
/* ------------------------------------------------------------------ */

const nivelDe = (perfil: PerfilColectivo | null, key: string) => {
  const x = perfil?.metricas.find((m) => m.metrica.key === key);
  if (!x) return null;
  return x.percentil ?? (x.de > 1 ? Math.round(100 * (1 - (x.puestoDeMas - 1) / (x.de - 1))) : 50);
};

const alto = (n: number | null) => n != null && n >= 65;
const bajo = (n: number | null) => n != null && n <= 35;

/** «4-2-3-1» → { defensas: 4, medios: 5, puntas: 1, lineas: [4,2,3,1] }. */
function leeSistema(sistema: string | undefined) {
  const lineas = (sistema ?? "").split("-").map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (lineas.length < 3) return null;
  const defensas = lineas[0];
  const puntas = lineas[lineas.length - 1];
  const medios = lineas.slice(1, -1).reduce((a, b) => a + b, 0);
  return { defensas, medios, puntas, lineas, texto: lineas.join("-") };
}

const racha = (resumen: ResumenEquipo | null) => resumen?.forma.map((f) => f.resultado) ?? [];

/* ------------------------------------------------------------------ */
/*  Las reglas                                                         */
/* ------------------------------------------------------------------ */

export function sugerenciasExpertas(c: ContextoCriterio): SugerenciaExperta[] {
  const s: SugerenciaExperta[] = [];
  const con = (campo: CampoBoceto, intencion: Intencion, texto: string, motivo: string) =>
    s.push({ campo, texto, motivo, intencion });

  const { rival, perfil, resumen, abp, nosotros } = c;
  const n = (key: string) => nivelDe(perfil, key);
  const esLocal = /local|casa/i.test(c.donde) && !/visit/i.test(c.donde);
  const esVisitante = /visit|fuera/i.test(c.donde);

  /* ================================================================ */
  /*  CON BALÓN: progresar y finalizar contra lo que hace el rival     */
  /* ================================================================ */

  const ppda = n("ppda");

  if (alto(ppda)) {
    con(
      "ATAQUE",
      "PROGRESAR",
      "Contra su presión alta: portero como +1 en la salida, atraer para romper con el tercer hombre y tener siempre la opción larga a la espalda de su última línea",
      "Principio de superioridad numérica en zona de inicio (Cruyff, Guardiola): si presionan con muchos, hay espacio detrás; se atrae con el balón y se castiga con la carrera. El tercer hombre es lo que la presión no puede leer.",
    );
    con(
      "DEFENSA",
      "TRANSICIÓN DEF",
      "Tras pérdida en nuestra salida, no replegar: contrapresión inmediata para que su recuperación alta no sea ocasión",
      "Un equipo que presiona alto vive de la pérdida del rival en zona de inicio; la contrapresión de 5-6 segundos (Guardiola) o el «mejor organizador de juego» de Klopp convierte nuestra pérdida en su pérdida.",
    );
  }

  if (bajo(ppda)) {
    con(
      "ATAQUE",
      "PROGRESAR",
      "Contra su bloque: circular con intención para que bascule, cambiar de orientación y entrar por el lado débil cuando el bloque llegue tarde",
      "«El balón mueve al rival» (Lillo): contra un equipo que no presiona, la pausa y el cambio de orientación desordenan más que la verticalidad; se entra cuando la línea se ha movido, no antes.",
    );
  }

  const posesionRival = n("posesion");
  const concedeRemates = n("tirosContra");

  if (bajo(posesionRival) && (concedeRemates == null || alto(concedeRemates))) {
    con(
      "ATAQUE",
      "FINALIZAR",
      "Contra bloque bajo: amplitud máxima con los dos extremos abiertos, 4-5 jugadores en el área en cada centro y dos en la frontal para la segunda jugada y el remate lejano",
      "Principio de amplitud y profundidad contra bloque bajo: el espacio está en los costados y en la frontal, no entre líneas. La ocupación del área decide los centros (Sacchi: el área se gana con número y con tiempo).",
    );
  }

  if (alto(n("centros"))) {
    con(
      "DEFENSA",
      "PROTEGER",
      "Defensa del centro lateral: el lateral tapa el centro, los centrales marcan con referencia balón-hombre y los interiores ocupan la zona de rechace",
      "Principio de defensa del área: quien defiende el centro y quien defiende el rechace son jugadores distintos; sin la segunda línea en la frontal, cada rechace es un remate limpio.",
    );
  }

  if (alto(n("pasesLargos")) || alto(n("duelosAereos"))) {
    con(
      "DEFENSA",
      "PROTEGER",
      "Primera y segunda jugada: ganar o anular el duelo aéreo y tener dos jugadores detrás del duelo para el rechace; línea defensiva sin exponerse al balón largo",
      "Contra juego directo lo que decide no es el primer duelo sino la segunda jugada (Simeone: bloque y segundas jugadas); la altura de la línea se ajusta a la amenaza en largo, no a la intención de presionar.",
    );
  }

  if (alto(n("contras"))) {
    con(
      "ATAQUE",
      "TRANSICIÓN DEF",
      "Equilibrio en fase ofensiva: 2+1 o 3+1 detrás del balón, contrapresión 5-6 segundos tras pérdida y falta táctica lejos del área si no se llega",
      "Contra un equipo de contraataque se defiende antes de perder el balón: la estructura de vigilancias (Bielsa) y la contrapresión inmediata (Guardiola, Rangnick: 8 segundos) son el plan; la falta táctica es el último recurso, nunca el primero.",
    );
  }

  if (alto(posesionRival)) {
    con(
      "DEFENSA",
      "RECUPERAR",
      "Bloque medio compacto: 10-12 metros entre líneas, saltar juntos en el pase hacia atrás o hacia el lateral (gatillos de presión), y vigilancias a la espalda de la línea",
      "Principio de equipo corto (Sacchi: 25-30 metros entre el primer defensor y el último); contra un equipo de posesión se roba con un gatillo común, no con un jugador que sale solo.",
    );
    con(
      "ATAQUE",
      "TRANSICIÓN OF",
      "Tras robo, primer pase hacia delante y carrera del extremo contrario: su posesión deja espacio a la espalda de los laterales",
      "Un equipo que ataca con muchos deja a pocos atrás: la transición ofensiva se decide en los tres primeros segundos y el primer pase es vertical o no es transición.",
    );
  }

  if (bajo(n("perdidasBajas")) || alto(n("recuperacionesAltas")) === false && bajo(n("pasesPrecisos"))) {
    con(
      "DEFENSA",
      "RECUPERAR",
      "Presión alta sobre su salida: orientar al lateral, cerrar la vuelta al central y robar en banda; el 9 tapa la línea de pase al pivote",
      "Principio de presión orientada (Bielsa, Rangnick): se dirige la salida hacia la banda, donde la línea de banda defiende con nosotros, y se roba cerca de su portería, que es donde más vale el balón.",
    );
  }

  /* ================================================================ */
  /*  LOS SISTEMAS: dónde hay superioridad y dónde hay que protegerse   */
  /* ================================================================ */

  const suyo = leeSistema(resumen?.sistemas[0]?.sistema);
  const nuestro = leeSistema(nosotros.resumen?.sistemas[0]?.sistema);

  if (suyo && nuestro) {
    if (suyo.defensas === 3 || suyo.defensas === 5) {
      con(
        "ESTRUCTURA_DEF",
        "PROGRESAR",
        `Contra su línea de ${suyo.defensas}: atacar el espacio exterior de los carrileros con 2v1 en banda (lateral + extremo) y fijar a los tres centrales con el 9 y un interior`,
        "Principio de superioridad en banda contra defensa de tres: el carrilero no puede defender al lateral y al extremo a la vez; si sube, su espalda es el espacio del partido.",
      );
    }

    if (suyo.defensas === 4 && suyo.medios === 4 && suyo.puntas === 2) {
      con(
        "ESTRUCTURA_DEF",
        "PROGRESAR",
        "Contra su 4-4-2: superioridad en el centro con tres en medio (3v2), interior entre líneas a la espalda de sus dos puntas y lateral que fija al extremo",
        "Emparejamiento estructural: un 4-3-3 o 4-2-3-1 contra 4-4-2 tiene un hombre libre en el medio; el partido se gana encontrándolo con pausa, no por fuera (Guardiola: el hombre libre).",
      );
    }

    if (nuestro.medios > suyo.medios) {
      con(
        "ATAQUE",
        "PROGRESAR",
        `Tenemos ${nuestro.medios} en el medio contra sus ${suyo.medios}: buscar al hombre libre en el centro antes de abrir el balón`,
        "Superioridad numérica en zona central: el balón debe pasar por el hombre libre para que la amplitud tenga sentido; si se abre antes, el rival defiende cómodo.",
      );
    } else if (nuestro.medios < suyo.medios) {
      con(
        "DEFENSA",
        "PROTEGER",
        `Ellos tienen ${suyo.medios} en el medio contra nuestros ${nuestro.medios}: un extremo cierra por dentro sin balón y los centrales no saltan a la mediapunta`,
        "Inferioridad en zona central: se compensa con el extremo que cierra hacia dentro y con paciencia en la línea de centrales; el salto del central a la mediapunta es lo que un 3 en medio busca provocar.",
      );
    }

    if (suyo.puntas === 1) {
      con(
        "DEFENSA",
        "PROTEGER",
        "Contra un solo punta: el central libre acompaña y el otro marca; en el balón largo, uno disputa y el otro cubre",
        "Principio de cobertura entre centrales con un punta: nunca los dos al mismo balón; el que no disputa gana la segunda jugada.",
      );
    }
  }

  /* ================================================================ */
  /*  EL GOLEADOR Y LOS JUGADORES CLAVE                                 */
  /* ================================================================ */

  const goleador = [...c.plantilla].sort((a, b) => b.goles - a.goles)[0];
  const golesRival = resumen?.gf ?? 0;

  if (goleador && goleador.goles >= 3 && golesRival > 0 && goleador.goles / golesRival >= 0.4) {
    con(
      "DEFENSA",
      "PROTEGER",
      `Vigilancia individual a ${goleador.fila.jugador}: marca cercana en el área, cortar su línea de pase preferida y obligar a otros a decidir (${goleador.goles} de los ${golesRival} goles del ${rival})`,
      "Principio de anulación del referente: cuando un jugador hace casi la mitad de los goles, quitarle el balón en zona de remate vale más que cualquier ajuste colectivo; el resto decide peor.",
    );
  }

  /* ================================================================ */
  /*  BALÓN PARADO                                                      */
  /* ================================================================ */

  const dominante = (lado: "ataca" | "concede") =>
    abp ? (Object.entries(abp[lado]) as [AspectoKey, number][]).sort((a, b) => b[1] - a[1])[0] : undefined;

  const ataca = dominante("ataca");
  if (ataca && ataca[1] >= 0.6) {
    con(
      "ABP_DEF",
      "ABP",
      `Su ${ASPECTO_BY_KEY.get(ataca[0])?.label.toLowerCase() ?? ataca[0]}: responsabilidades claras (zona mixta), bloquear las carreras desde atrás y primer palo siempre ocupado`,
      "Principio de la defensa de balón parado: el gol de ABP nace del bloqueo y de la carrera desde atrás, no del salto; la zona mixta reparte el espacio y la marca de los rematadores.",
    );
  }

  const concede = dominante("concede");
  if (concede && concede[1] >= 0.6) {
    con(
      "ABP_OF",
      "ABP",
      `Insistir en ${ASPECTO_BY_KEY.get(concede[0])?.label.toLowerCase() ?? concede[0]}: rutinas con bloqueo al marcador, segunda ola desde la frontal y variante en corto si defienden en zona pura`,
      "Principio ofensivo del balón parado: el bloqueo libera al rematador y la segunda ola castiga el rechace; contra zona pura, el corto mueve la zona antes del envío.",
    );
  }

  /* ================================================================ */
  /*  EL CONTEXTO EMOCIONAL: el nuestro y el suyo                       */
  /* ================================================================ */

  const nuestra = racha(nosotros.resumen);
  const suya = racha(resumen);

  if (nuestra[0] === "P") {
    con(
      "CLAVES_EMOCIONALES",
      "EMOCIONAL",
      "Venimos de perder: mensaje de respuesta, no de reproche; foco en las dos primeras acciones de cada uno y en el proceso, no en el marcador",
      "Gestión de la derrota en equipos de alto rendimiento: el día después se revisa, el resto de la semana se construye. Reencuadre (de «qué hicimos mal» a «qué vamos a hacer») y tareas concretas e inmediatas que devuelven la sensación de control.",
    );
  }

  if (nuestra[0] === "G") {
    con(
      "CLAVES_EMOCIONALES",
      "EMOCIONAL",
      "Venimos de ganar: humildad activa; los estándares de la semana pasada son el mínimo de ésta, y los primeros 10 minutos no se regalan",
      "La complacencia tras la victoria es el rival invisible: la activación baja sin que nadie lo decida. Se renombra el objetivo (repetir el nivel, no el resultado) y se exige en la primera jugada.",
    );
  }

  if (nuestra.slice(0, 3).filter((r) => r === "E").length >= 2) {
    con(
      "CLAVES_EMOCIONALES",
      "EMOCIONAL",
      "Cerrar los partidos: gestión de los últimos 15 minutos con balón, decisiones de riesgo bajo y cambios con rol claro (quien entra, a qué entra)",
      "Un equipo que empata mucho suele perder el control en el tramo final: la gestión del marcador se entrena (plan A yendo por delante, plan B por detrás) y se dice antes del partido, no durante.",
    );
  }

  const nuestroGolesXg = nosotros.perfil?.metricas.find((m) => m.metrica.key === "golesMenosXg")?.valor ?? null;
  if (nuestroGolesXg != null && nuestroGolesXg <= -0.3) {
    con(
      "CLAVES_EMOCIONALES",
      "EMOCIONAL",
      "Confianza en la finalización: las ocasiones se están creando; calma en el remate y persistencia, sin cambiar el plan porque no entre",
      "Cuando goles − xG es negativo el problema es de conversión, no de creación: cambiar el plan por ansiedad destruye lo que funciona (regresión a la media). El mensaje es de persistencia y de calma en la última acción.",
    );
  }

  if (esVisitante) {
    con(
      "CLAVES_EMOCIONALES",
      "EMOCIONAL",
      "Fuera de casa: los primeros 15 minutos sin regalar nada, control del riesgo en la salida y el partido se gana en la segunda parte",
      "Principio de control fuera de casa (Mourinho): el equipo visitante que no concede en el arranque desactiva al estadio; el riesgo se asume cuando el partido ya es nuestro.",
    );
  }

  if (esLocal) {
    con(
      "CLAVES_EMOCIONALES",
      "EMOCIONAL",
      "En casa: imponer el ritmo desde el primer minuto, presión alta en los primeros 10 minutos y que la grada empuje con nosotros",
      "El equipo local marca el tono del partido en el arranque: una presión alta temprana cambia la percepción del rival y de la grada; después se administra.",
    );
  }

  if (suya.slice(0, 3).every((r) => r === "G") && suya.length >= 3) {
    con(
      "CLAVES_PARTIDO",
      "EMOCIONAL",
      `El ${rival} llega con tres victorias: romper su ritmo (pausa con balón, variar la altura de la presión) y no entrar en su partido`,
      "Un rival en racha juega con confianza y automatismos: se le desactiva alterando el ritmo y el tipo de partido que espera, no compitiendo en su terreno.",
    );
  }

  if (suya[0] === "P") {
    con(
      "CLAVES_PARTIDO",
      "EMOCIONAL",
      `El ${rival} viene de perder: esperar sus 15 primeros minutos de intensidad, sostener sin faltas innecesarias y castigar su ansiedad con pausa y transición`,
      "El equipo herido arranca con energía y con prisa; el que sostiene ese tramo sin conceder se encuentra un rival que empieza a dudar. La pausa es el arma contra la ansiedad del otro.",
    );
  }

  /* Siempre: lo que un equipo de alto rendimiento lleva al partido. */
  con(
    "CLAVES_EMOCIONALES",
    "EMOCIONAL",
    "Activación óptima: ni partido «especial» ni partido «fácil»; rutina de activación y un mensaje por línea, simple y concreto",
    "Rendimiento y activación siguen una U invertida (Yerkes-Dodson): la sobreactivación precipita decisiones y la relajación llega tarde a los duelos. El mensaje simple se retiene; el complejo se pierde en el calentamiento.",
  );
  con(
    "CLAVES_EMOCIONALES",
    "EMOCIONAL",
    "Roles del banquillo: cada suplente sabe a qué entra (plan A o B) y el equipo tiene un plan para ir por delante y otro para ir por detrás a partir del 70'",
    "La cohesión de un equipo de alto rendimiento se mide en los que no empiezan: un rol claro antes del partido convierte el cambio en impacto, no en castigo. La gestión del marcador se decide en el vestuario, no en el banquillo.",
  );
  con(
    "CLAVES_EMOCIONALES",
    "EMOCIONAL",
    "Árbitro y rival: nadie discute; el capitán media y el equipo responde con la siguiente acción",
    "La gestión emocional del partido (Simeone, Klopp): la energía que se gasta en protestar es la que falta en la siguiente transición; la respuesta es siempre la jugada siguiente.",
  );

  /* ================================================================ */
  /*  CLAVES DEL PARTIDO: una por fase                                  */
  /* ================================================================ */

  if (alto(ppda)) {
    con("CLAVES_PARTIDO", "PROGRESAR", "Salir de su presión con limpieza: si pasamos la primera línea, el partido es nuestro", "Contra un equipo de presión alta, la clave del partido es la salida: superada la presión hay campo y hay ventaja numérica.");
  } else if (bajo(ppda)) {
    con("CLAVES_PARTIDO", "FINALIZAR", "Paciencia y ocupación del área: el partido se gana con llegadas repetidas, no con una jugada", "Contra un bloque que no presiona, la clave es el volumen de llegadas y la ocupación del área, no la verticalidad.");
  }

  if (alto(n("contras"))) {
    con("CLAVES_PARTIDO", "TRANSICIÓN DEF", "Ganar el balón perdido: cada pérdida nuestra es su mejor jugada", "Contra un equipo de transición, la clave es la pérdida: dónde se pierde y qué pasa en los cinco segundos siguientes.");
  }

  return s;
}

/* ------------------------------------------------------------------ */
/*  Las cuestiones del criterio sobre lo que ya está escrito           */
/* ------------------------------------------------------------------ */

/**
 * Lo que el criterio cuestiona de una línea del plan anterior, aparte del
 * dato: el estado emocional de la semana y la simplicidad del mensaje.
 */
export function cuestionExperta(campo: CampoBoceto, linea: string, c: ContextoCriterio, numeroDeLineas: number): string | null {
  const nuestra = racha(c.nosotros.resumen);

  if (campo === "CLAVES_EMOCIONALES") {
    if (nuestra[0] === "P") return `venimos de perder (${c.nosotros.resumen?.forma[0]?.marcador ?? ""} contra ${c.nosotros.resumen?.forma[0]?.rival ?? "el último rival"}): el mensaje emocional de esta semana es de respuesta y de proceso, no el de la semana pasada`;
    if (nuestra[0] === "G") return `venimos de ganar (${c.nosotros.resumen?.forma[0]?.marcador ?? ""} contra ${c.nosotros.resumen?.forma[0]?.rival ?? "el último rival"}): la clave emocional pasa a ser sostener el nivel sin complacencia`;
    if (nuestra[0] === "E") return "venimos de empatar: la clave emocional de la semana es cerrar el partido, no la de la semana pasada";
  }

  if (campo === "CLAVES_PARTIDO" && numeroDeLineas > 4) {
    return "hay más de cuatro claves: un mensaje de partido se retiene con tres (una con balón, una sin balón, una de transición o balón parado)";
  }

  return null;
}
