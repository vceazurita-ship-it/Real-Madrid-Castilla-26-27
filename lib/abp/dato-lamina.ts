/**
 * LA LÍNEA DE DATO DE CADA LÁMINA DE LA PIZARRA (12/11/2026).
 *
 * Lo pidieron los jueces de los exportables (fútbol y análisis): las láminas
 * no decían de qué dato sale cada acción, y el PDF de cada jugador cerraba con
 * «Base: … de la pizarra de la jornada». Ahora cada lámina —PDF general,
 * PowerPoint y cada acción del PDF por jugador— lleva una línea corta con la
 * cifra del rival que la sostiene y su base:
 *
 *   «Gimnàstic saca 5,5 córners por partido (el que más de los 20) y remata
 *    el 27 % (10 de 37) · Wyscout, 11 partidos»
 *
 * Sale de la MISMA comparativa de Wyscout que el informe de ABP
 * (`/api/data-analisis?abpInforme=1`, la que lee `InformeMicroDialog`): no se
 * calcula nada nuevo ni se inventa una cifra. Lo que Wyscout no mide —el saque
 * de banda— no lleva línea, y sin comparativa o sin el rival en ella tampoco
 * (regla «informes sin huecos»: lo que no tiene dato no se nombra).
 */

import type { ComparativaAbp, FilaEquipoAbp } from "@/lib/abp/informe-graficos";
import type { SlidePizarra } from "@/lib/abp/pizarra";
import { mismoClub } from "@/lib/rivals/mismoClub";

const coma = (valor: number, decimales: number) => valor.toFixed(decimales).replace(".", ",");

/** El puesto en palabras, contado desde el que más: «el que más de los 20», «3.º que más de 20», «2.º que menos de 20». */
function puestoEnPalabras(valor: number, todos: number[], menosEsMejor = false) {
  const n = todos.length;

  if (n < 3) return "";

  const desdeArriba = todos.filter((otro) => otro > valor + 1e-9).length + 1;
  const desdeAbajo = todos.filter((otro) => otro < valor - 1e-9).length + 1;

  /* Empatado con otros, «el que más» no es verdad: el puesto a secas. */
  if (todos.filter((otro) => Math.abs(otro - valor) <= 1e-9).length > 1) return `${menosEsMejor ? desdeAbajo : desdeArriba}.º de ${n}, empatado`;

  if (desdeArriba === 1) return `el que más de los ${n}`;
  if (desdeArriba === n) return `el que menos de los ${n}`;

  /*
  | Lo que concede (12/11/2026, tercera ronda, fútbol): «8.º que menos de 20»
  | no se leía; el puesto se cuenta desde el que menos y se dice qué es lo
  | bueno para ellos.
  */
  if (menosEsMejor) return `${desdeAbajo}.º de ${n} (menos es mejor para ellos)`;

  return desdeArriba > n / 2 ? `${n - desdeArriba + 1}.º que menos de ${n}` : `${desdeArriba}.º que más de ${n}`;
}

/** Con menos de 25 acciones detrás, un porcentaje es una tendencia, no un dato firme (como en el informe del partido). */
const BASE_FIRME = 25;

/** Su fila en la comparativa, sólo si hay UNA: con dos candidatos, mejor callar que hablar de otro equipo. */
export function filaDelRival(comparativa: ComparativaAbp | null | undefined, rival: string): FilaEquipoAbp | null {
  if (!comparativa?.liga?.length || !rival.trim()) return null;

  const suyas = comparativa.liga.filter((fila) => mismoClub(fila.equipo, rival));

  return suyas.length === 1 ? suyas[0] : null;
}

type Lado = "favor" | "contra";

/** Qué mira cada plantilla: su volumen y su % de remate, del lado que toca. */
const QUE_MIRA: Record<string, { volumen: string; remate: string; lado: Lado; nombre: string; verbo: string; remata: string; penaltis?: Lado }> = {
  /* Defendemos su córner: lo que ellos sacan y rematan. */
  "corner-def": { volumen: "corners", remate: "cornersRemate", lado: "favor", nombre: "córners", verbo: "saca", remata: "remata el" },
  /* Atacamos nosotros: lo que ellos conceden y les rematan. */
  "corner-of": { volumen: "corners", remate: "cornersRemate", lado: "contra", nombre: "córners", verbo: "concede", remata: "le rematan el" },
  "falta-lat-def": { volumen: "faltasTiro", remate: "faltasRemate", lado: "favor", nombre: "faltas", verbo: "lanza", remata: "remata el" },
  "falta-dir-def": { volumen: "faltasTiro", remate: "faltasRemate", lado: "favor", nombre: "faltas", verbo: "lanza", remata: "remata el", penaltis: "favor" },
  "falta-lat-of": { volumen: "faltasTiro", remate: "faltasRemate", lado: "contra", nombre: "faltas", verbo: "concede", remata: "le rematan el" },
  directas: { volumen: "faltasTiro", remate: "faltasRemate", lado: "contra", nombre: "faltas", verbo: "concede", remata: "le rematan el", penaltis: "contra" },
};

/**
 * La línea de una plantilla, o "" si no hay con qué. `rival` es el nombre tal
 * y como se lee en la pieza («Gimnàstic de Tarragona»).
 */
export function datoDeLamina(plantilla: string, comparativa: ComparativaAbp | null | undefined, rival: string): string {
  const mira = QUE_MIRA[plantilla];
  const fila = mira ? filaDelRival(comparativa, rival) : null;

  if (!mira || !fila || !comparativa) return "";

  const valor = (key: string, lado: Lado) => {
    const uno = fila.valores?.[key]?.[lado];

    return typeof uno === "number" && Number.isFinite(uno) ? uno : null;
  };
  const columna = (key: string, lado: Lado) =>
    comparativa.liga.map((otra) => otra.valores?.[key]?.[lado]).filter((uno): uno is number => typeof uno === "number" && Number.isFinite(uno));

  const volumen = valor(mira.volumen, mira.lado);
  const pct = valor(mira.remate, mira.lado);
  const partidos = fila.partidos > 0 ? fila.partidos : 0;
  const partes: string[] = [];

  if (volumen != null) {
    const puesto = puestoEnPalabras(volumen, columna(mira.volumen, mira.lado), mira.lado === "contra");

    partes.push(`${mira.verbo} ${coma(volumen, 1)} ${mira.nombre} por partido${puesto ? ` (${puesto})` : ""}`);
  }

  if (pct != null) {
    const total = volumen != null && partidos ? Math.round(volumen * partidos) : 0;
    const base = total > 0 ? ` (${Math.round((total * pct) / 100)} de ${total}${total < BASE_FIRME ? ", tendencia" : ""})` : "";

    partes.push(`${mira.remata} ${coma(pct, 0)} %${base}`);
  }

  if (mira.penaltis) {
    const penaltis = valor("penaltis", mira.penaltis);

    if (penaltis != null && partidos) {
      const cuantos = Math.round(penaltis * partidos);

      if (cuantos > 0) partes.push(`${cuantos} ${cuantos === 1 ? "penalti" : "penaltis"} ${mira.penaltis === "favor" ? "a favor" : "en contra"}`);
    }
  }

  if (!partes.length) return "";

  const frase = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}` : partes[0];

  return `${rival} ${frase}${partidos ? ` · Wyscout, ${partidos} ${partidos === 1 ? "partido" : "partidos"}` : " · Wyscout"}`;
}

/** La línea de cada diapositiva, por su id (las que no tienen, fuera). */
export function datosDeLaminas(slides: SlidePizarra[], comparativa: ComparativaAbp | null | undefined, rival: string): Record<string, string> {
  return Object.fromEntries(
    slides.flatMap((slide) => {
      const dato = datoDeLamina(slide.plantilla, comparativa, rival);

      return dato ? [[slide.id, dato]] : [];
    }),
  );
}

/*
| La comparativa, una vez por pestaña: pesa poco y la piden la pizarra, el
| menú «Exportar» y los PDF de cada jugador. Si falla, se puede pedir otra vez.
*/
let enCamino: Promise<ComparativaAbp | null> | null = null;

export function cargaComparativaAbp(): Promise<ComparativaAbp | null> {
  if (!enCamino) {
    enCamino = fetch("/api/data-analisis?abpInforme=1")
      .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
      .then((datos) => {
        const abp = (datos as { abp?: ComparativaAbp } | null)?.abp;

        return abp?.liga?.length ? abp : null;
      })
      .catch(() => null)
      .then((abp) => {
        if (!abp) enCamino = null;

        return abp;
      });
  }

  return enCamino;
}

/** Lo mismo con tope de espera: la exportación no se para por una línea de dato. */
export function comparativaATiempo(ms = 8_000): Promise<ComparativaAbp | null> {
  return Promise.race([cargaComparativaAbp(), new Promise<null>((listo) => setTimeout(() => listo(null), ms))]);
}
