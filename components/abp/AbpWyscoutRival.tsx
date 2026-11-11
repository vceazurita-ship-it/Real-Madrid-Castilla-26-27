"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

import { Panel } from "@/components/abp/ui";
import { traeJson } from "@/lib/hojaCsv";
import { formatea, type Unidad } from "@/lib/data-analisis/metricas";
import type { GolesAbp } from "@/lib/data-analisis/goles-abp";
import type { RivalPlayerAerial } from "@/lib/abp/rival";
import type { RivalScoutAction } from "@/lib/abp/rivalScout";
import { estructuraDefensiva } from "@/lib/abp/defensa-rival";
import { casaNombre } from "@/lib/data-analisis/once";
import { normalizePlayerName } from "@/lib/playerImages";
import { normalizarOnce, playerKey, rivalOnceKey } from "@/lib/rivals/once";
import { filaPropia, findInforme } from "@/lib/rivals/informe";
import { aJornada, type FilaRival } from "@/lib/abp/jornada";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { cargaDatosMarcas } from "@/lib/abp/marcas-datos";
import { motivoAtacante, ordenaAtacantes, ordenaMarcadores, type Atacante } from "@/lib/abp/marcas-corner";
import { usePlayers } from "@/hooks/usePlayers";
import { useRivalInforme } from "@/hooks/useRivalInforme";
import Link from "next/link";

/*
|--------------------------------------------------------------------------
| SU BALÓN PARADO SEGÚN WYSCOUT (23/10/2026)
|--------------------------------------------------------------------------
|
| Cuando de un rival no hay acciones registradas a mano, la pantalla no se
| queda en un hueco: enseña lo que ya se sabe de él. Córners, córners con
| remate y cuota de remates a balón parado frente a los veinte equipos de la
| liga (`/api/data-analisis?abpRival=`), sus goles a balón parado y quién los
| saca y los remata según las etiquetas de Plantillas.
|
| Lo que no hay no se nombra: si Wyscout no trae al rival ni hay etiquetas, el
| bloque no sale.
*/

type Fila = {
  nombre: string;
  valor: number;
  mediana: number;
  unidad: Unidad;
  percentil: number;
  /** Si más es mejor; null cuando es un estilo y no hay «bueno». */
  mejorAlto?: boolean | null;
  /** «x de y» de un porcentaje, y los partidos que lo respaldan. */
  base?: { arriba: number; abajo: number } | null;
  partidos?: number;
  /** El menor y el mayor de la liga, para la barra (11/11/2026). */
  minimo?: number | null;
  maximo?: number | null;
};

/*
| TENDENCIA, SIN FLECHA (11/11/2026, análisis): «córners con remate 27,0 %,
| 10 de 37» salía con ▼ como si fuera una carencia. Un porcentaje con menos de
| 15 casos arriba (o menos de 25 abajo) se lee como tendencia: sin flecha, sin
| color y fuera de «Qué hacemos».
*/
const POCOS_CASOS = 15;

const esTendencia = (fila: Fila) =>
  fila.unidad === "porcentaje" && !!fila.base && (fila.base.arriba < POCOS_CASOS || fila.base.abajo < 25);

/** «1 de cada 10» redondeado hacia arriba: el objetivo de una tarea sale de la cifra. */
const deCadaDiez = (porcentaje: number) => Math.min(10, Math.max(1, Math.ceil(porcentaje / 10)));

/*
| «CÓMO SE CUENTA», UNA VEZ Y PLEGADO (11/11/2026, análisis y marketing): el
| párrafo metodológico salía a 8 px en la cabecera de ABP del Rival y de Área
| del Rival, repetido. Ahora la cabecera es una línea y el método va aquí, a
| 12 px, con el mismo texto para las dos pantallas.
*/
export function ComoSeCuenta({ ambito }: { ambito: "abp" | "area" }) {
  return (
    <details className="mb-3 text-[12px] leading-relaxed text-white/60">
      <summary className="cursor-pointer select-none font-semibold text-[#C8A96B]">Cómo se cuenta</summary>
      <ul className="mt-1.5 list-disc space-y-1 pl-4">
        <li>La descarga de Wyscout puede ir una jornada por detrás del calendario: por eso sus partidos pueden ser uno menos que los de BeSoccer.</li>
        <li>▲ mejor y ▼ peor ya tienen en cuenta si a ese equipo le conviene más o menos. El puesto va del mejor (1.º) al peor.</li>
        <li>Un porcentaje con menos de {POCOS_CASOS} casos detrás es una tendencia: va sin flecha y no se lee como fortaleza ni como carencia.</li>
        <li>En la barra, la raya es la mediana de la liga y el rombo verde, el mejor de la liga (en una cifra de estilo, el que más).</li>
        {ambito === "area" && <li>«x de y» es la base real: en «sus centros», los que hace; en «los que recibe», los que le hacen.</li>}
        <li>«Qué hacemos» y «Qué entrenamos» son criterio de juego a partir de la cifra: la cifra los sostiene, no los dicta.</li>
      </ul>
    </details>
  );
}

/*
| LA BARRA CONTRA LA LIGA (11/11/2026, análisis y marketing): las tarjetas
| sólo daban la cifra y la mediana. La barra pone al rival (oro) entre el cero y
| el máximo de la liga, con la mediana (raya) y el mejor de la liga (rombo).
| Si la API no trae los extremos, no sale.
*/
function BarraLiga({ fila }: { fila: Fila }) {
  const { minimo, maximo } = fila;

  if (minimo == null || maximo == null || !Number.isFinite(maximo) || maximo <= 0) return null;

  const tope = Math.max(maximo, fila.valor) * 1.06;
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / tope) * 100))}%`;
  const elite = fila.mejorAlto === false ? minimo : maximo;
  const rotuloElite = fila.mejorAlto == null ? "el que más" : "el mejor";

  return (
    <span
      className="mt-1 block w-full"
      role="img"
      aria-label={`${cifra1(fila.valor, fila.unidad)} frente a la mediana ${cifra1(fila.mediana, fila.unidad)} y ${rotuloElite} de la liga ${cifra1(elite, fila.unidad)}`}
    >
      <span className="relative block h-2 w-full rounded-full bg-white/10">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: pos(fila.valor), background: "var(--rmcf-gold-ink, #C8A96B)" }} />
        <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-white/50" style={{ left: pos(fila.mediana) }} />
        <span
          className="absolute -top-[3px] h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[2px]"
          style={{ left: pos(elite), background: "var(--rmcf-rate-good, #15803D)" }}
        />
      </span>
      <span className="mt-1 flex justify-between gap-2 text-[11px] text-white/50">
        <span>| mediana {cifra1(fila.mediana, fila.unidad)}</span>
        <span>◆ {rotuloElite} de la liga: {cifra1(elite, fila.unidad)}</span>
      </span>
    </span>
  );
}

type Aspecto = { clave: string; aspecto: string; filas: Fila[] };

type Lanzador = { nombre: string; tipo: "corner" | "falta"; total: number; partidos: number; pie?: string };

type Datos = {
  equipos: number;
  lanzadores?: Lanzador[];
  aspectos: Aspecto[];
  golesAbp: { aFavor: GolesAbp; enContra: GolesAbp } | null;
};

/** Cifras por partido a un decimal (16,1 y no 16,08); porcentajes, enteros y minutos, como siempre. */
function cifra1(valor: number | null, unidad: Unidad) {
  if (valor === null || !Number.isFinite(valor) || unidad === "porcentaje" || unidad === "entero" || unidad === "minutos") {
    return formatea(valor, unidad);
  }

  return valor.toFixed(1).replace(".", ",");
}

/** «Mejor que 8 de cada 10» / «Peor que 8 de cada 10»: percentil ya orientado. El extremo se dice como es: «el mejor/peor de los 20». */
function lectura(percentil: number, equipos: number, mejorAlto?: boolean | null) {
  const base = lecturaSinPuesto(percentil, equipos, mejorAlto);

  /*
  | Con el puesto absoluto (07/11/2026, análisis): «peor que 9 de cada 10» no
  | decía si era el 18.º o el 20.º. El 1.º es el mejor (o, en una métrica de
  | estilo, el que más).
  */
  if (!equipos || equipos < 2) return base;

  const puesto = 1 + Math.round(((100 - percentil) / 100) * (equipos - 1));
  const extremo = /^el (mejor|peor|que más|que menos) de los/.test(base.texto);

  return extremo ? base : { ...base, texto: `${base.texto} (${puesto}.º de ${equipos}${mejorAlto === null ? ", de más a menos" : ""})` };
}

function lecturaSinPuesto(percentil: number, equipos: number, mejorAlto?: boolean | null) {
  /* Métrica de estilo: se compara, no se juzga (que te centren más no es una virtud). */
  if (mejorAlto === null) {
    if (percentil >= 97) return { texto: `el que más de los ${equipos}`, bueno: null };
    if (percentil <= 3) return { texto: `el que menos de los ${equipos}`, bueno: null };
    if (percentil >= 60) return { texto: `más que ${Math.round(percentil / 10)} de cada 10`, bueno: null };
    if (percentil <= 40) return { texto: `menos que ${Math.max(1, Math.round((100 - percentil) / 10))} de cada 10`, bueno: null };

    return { texto: "en la media de la liga", bueno: null };
  }

  if (percentil >= 97) return { texto: `el mejor de los ${equipos} en esta cifra`, bueno: true };
  if (percentil <= 3) return { texto: `el peor de los ${equipos} en esta cifra`, bueno: false };
  /* Tope en 9 (29/10/2026): con P95 salía «mejor que 10 de cada 10». */
  if (percentil >= 60) return { texto: `mejor que ${Math.min(9, Math.round(percentil / 10))} de cada 10`, bueno: true };
  if (percentil <= 40) return { texto: `peor que ${Math.min(9, Math.max(1, Math.round((100 - percentil) / 10)))} de cada 10`, bueno: false };

  return { texto: "en la media de la liga", bueno: null };
}

/*
| LO QUE RECIBE SE LEE AL REVÉS (29/10/2026)
|
| «Centros que recibe» llega de Wyscout como métrica de estilo (sin «bueno»):
| con 18,2 frente a 13,6 de mediana decía «más que 9 de cada 10», como si
| fuera una virtud. Que te centren más es peor: se le pone «menos es mejor» y
| el percentil se gira para que diga «peor que 9 de cada 10».
*/
const RECIBE_MENOS_ES_MEJOR = new Set(["Centros que recibe"]);

function orientada(fila: Fila): Fila {
  if (!RECIBE_MENOS_ES_MEJOR.has(fila.nombre) || fila.mejorAlto != null) return fila;

  return { ...fila, mejorAlto: false, percentil: 100 - fila.percentil };
}

/* «Córners con remate %» → «Córners con remate»: la cifra ya lleva el «%» (29/10/2026). */
const rotuloDe = (fila: Fila) => (fila.unidad === "porcentaje" ? fila.nombre.replace(/\s*%\s*$/, "") : fila.nombre);

/*
| Si concede como los peores de la liga, eso también es nuestro balón parado
| (29/10/2026): la consigna ofensiva va debajo de «Balón parado en contra».
| Sólo en el peor tramo (peor que 8 de cada 10).
*/
/*
| 11/11/2026 (análisis): el dato y la decisión van separados. «Llegar a línea
| de fondo» o «preparar dos rutinas» no salen de la cifra: son criterio de
| juego a partir de ella, y se rotulan así.
*/
/*
| 11/11/2026 (análisis, segunda vuelta): la métrica y la decisión en la MISMA
| frase («como concede 7,1 córners…, llegar a línea de fondo») y, debajo, la
| tarea con un objetivo que sale de la cifra. Las filas en tendencia no entran.
*/
function consignaOfensiva(aspecto: Aspecto | undefined, equipos: number): { frase: string; tarea: string }[] {
  if (!aspecto || aspecto.clave !== "abpDef") return [];

  const peor = (fila: Fila | undefined) => (fila && fila.mejorAlto === false && fila.percentil <= 20 && !esTendencia(fila) ? fila : null);
  const corners = peor(aspecto.filas.find((f) => f.nombre === "Córners"));
  const conRemate = peor(aspecto.filas.find((f) => f.nombre === "Córners con remate %"));
  const partes: { frase: string; tarea: string }[] = [];

  if (corners) {
    partes.push({
      frase: `como concede ${cifra1(corners.valor, corners.unidad)} córners por partido (mediana ${cifra1(corners.mediana, corners.unidad)}; ${lectura(corners.percentil, equipos, false).texto}), llegar a línea de fondo y forzar córner`,
      tarea: `dos rutinas de córner ofensivo; objetivo en el partido: ${Math.ceil(corners.valor)} córners a favor, por encima de los ${cifra1(corners.valor, corners.unidad)} que concede de media`,
    });
  }

  if (conRemate) {
    partes.push({
      frase: `como le rematan el ${cifra1(conRemate.valor, conRemate.unidad)} de los córners${conRemate.base ? ` (${Math.round(conRemate.base.arriba)} de ${Math.round(conRemate.base.abajo)})` : ""}, con la mediana en ${cifra1(conRemate.mediana, conRemate.unidad)}, cargar el área con nuestros mejores rematadores en cada córner`,
      tarea: `córner con cinco en el área y bloqueo al que defiende el primer palo; objetivo: rematar ${deCadaDiez(conRemate.valor)} de cada 10 córners`,
    });
  }

  return partes;
}

/** La lectura de los centros: qué hacemos según cuánto centra y con qué acierto. */
/*
| 30/10/2026: «Qué hacemos» con los centros va en dos frases, cada una con su
| sentido y su cifra: cuando nos centran (sus centros) y cuando les centramos
| (los que recibe). Antes era una sola frase que juntaba defensa y ataque.
*/
/*
| 30/10/2026: primero el dato y luego la acción, con el sujeto concordado
| («Cuando nos centran: centran 17,8 por partido (mediana 14,4) con un
| acierto como el de la liga (33,8 % frente a 33,9 %) → cerrar el carril y
| ganar el área»), y un titular con verbo y cifra para la cabecera.
*/
/*
| 11/11/2026 (análisis): cada frase en dos trozos, el dato y la decisión. La
| decisión («tres hombres en el área», «extremo y lateral doblando») no sale de
| la cifra: es criterio de juego y se pinta rotulada aparte.
*/
/*
| 11/11/2026 (segunda vuelta de los expertos): la cifra iba tres veces
| («centra 12,1 por partido (mediana 14,6)» en el titular, en el bloque y en la
| tarjeta). Ahora el titular es la lectura sin números, el bloque lleva la
| cifra UNA vez en la misma frase que la decisión («como centra poco…,
| cerrar el pase interior») y la tarjeta, la barra contra la liga. Cada bloque
| acaba en «Qué entrenamos», con un objetivo medible.
*/
type BloqueCentros = { rotulo: string; frase: string; tarea: string };

function queHacemosConCentros(
  aspectos: Aspecto[],
  equipo: string,
  equipos: number,
): { titular: string; bloques: BloqueCentros[]; poco: boolean | null } {
  const filas = aspectos.flatMap((a) => a.filas);
  const volumen = filas.find((f) => f.nombre === "Centros laterales");
  const acierto = filas.find((f) => f.nombre === "Centros precisos %");
  const recibeCruda = filas.find((f) => f.nombre === "Centros que recibe");
  const recibe = recibeCruda ? orientada(recibeCruda) : undefined;

  /*
  | Lo que recibe (menos es mejor): si es más que la mediana, se le ataca por
  | fuera. 09/11/2026 (jueces): con un valor cerca de la mediana (menos de un
  | 15 % de diferencia) no es un rasgo del equipo sino una tendencia.
  */
  const cercaDeLaMediana = !!recibe && Math.abs(recibe.valor - recibe.mediana) <= recibe.mediana * 0.15;
  const muchoRecibe = !!recibe && recibe.valor > recibe.mediana && !cercaDeLaMediana;
  const cuantoRecibe = recibe ? `${cifra1(recibe.valor, recibe.unidad)} centros por partido (mediana ${cifra1(recibe.mediana, recibe.unidad)})` : "";

  const lesCentramos: BloqueCentros | null = !recibe
    ? null
    : muchoRecibe
      ? {
          rotulo: "Nuestro ataque · cuando les centramos",
          frase: `como le hacen ${cuantoRecibe}, ${lectura(recibe.percentil, equipos, false).texto}, atacarle por fuera, con extremo y lateral doblando y tres hombres en el área`,
          tarea: `centro lateral tras el doblaje del lateral, con tres en el área; objetivo en el partido: ${Math.round(recibe.valor)} centros nuestros, los que le hacen de media`,
        }
      : cercaDeLaMediana
        ? {
            rotulo: "Nuestro ataque · cuando les centramos",
            frase: `como le hacen ${cuantoRecibe}, cerca de lo normal en la liga, probar primero por dentro y centrar con el área cargada (tendencia, no rasgo)`,
            tarea: `finalización tras centro con tres en el área; objetivo: ${Math.round(recibe.mediana)} centros, la mediana de la liga`,
          }
        : {
            rotulo: "Nuestro ataque · cuando les centramos",
            frase: `como sólo le hacen ${cuantoRecibe}, el centro no es la primera vía: llegar por dentro y centrar sólo con el área cargada`,
            tarea: `juego interior hasta el área, con pase entre líneas y apoyo-desmarque; objetivo: más llegadas por dentro que centros, que le hacen ${Math.round(recibe.valor)} de media`,
          };

  if (!volumen || !acierto) {
    return { titular: "", bloques: lesCentramos ? [lesCentramos] : [], poco: null };
  }

  const muchos = volumen.valor > volumen.mediana;
  /* 29/10/2026: «bien» o «mal» sólo si el acierto se separa de la mediana más de
     2 puntos; con 33,8 % frente a 33,9 % no es poco, es lo de la liga. */
  const dif = acierto.valor - acierto.mediana;
  const bien = dif > 2 && !esTendencia(acierto);
  const mal = dif < -2 && !esTendencia(acierto);

  const cuanto = `${cifra1(volumen.valor, volumen.unidad)} por partido (mediana ${cifra1(volumen.mediana, volumen.unidad)})`;
  /* Con la base: «58 de 201» (07/11/2026, fútbol). */
  const baseAcierto = acierto.base ? `, ${Math.round(acierto.base.arriba)} de ${Math.round(acierto.base.abajo)} precisos` : "";
  const comoAcierta = `${bien ? "con más acierto que la liga" : mal ? "con menos acierto que la liga" : "con un acierto como el de la liga"} (${cifra1(acierto.valor, acierto.unidad)} frente a ${cifra1(acierto.mediana, acierto.unidad)}${baseAcierto})`;

  /* Atada al dato (11/11/2026, fútbol): el porqué va en la frase, no se da la orden suelta. */
  const [porque, accion, tarea] =
    muchos && bien
      ? ["el centro es su vía de gol", "cerrar el carril exterior y proteger el segundo palo", `defensa del centro lateral con el segundo palo ocupado; objetivo: que acierte por debajo de la mediana de la liga (${cifra1(acierto.mediana, acierto.unidad)})`]
      : muchos && mal
        ? ["centra mucho pero encuentra poco", "dejarle centrar desde fuera del área, nunca sin presión al que centra, y ganar el área", `defensa del área ante centro desde tres cuartos, con presión al que centra; objetivo: que no pase del ${cifra1(acierto.valor, acierto.unidad)} de centros precisos`]
        : muchos
          ? ["el centro es una de sus vías", "cerrar el carril exterior y ganar el área", `basculación al carril exterior y defensa del área; objetivo: dejarle en la mediana de la liga (${cifra1(volumen.mediana, volumen.unidad)} centros) o menos`]
          : bien
            ? ["centra poco pero bien", "cuando centre, tapar al rematador del segundo palo", "defensa del centro con marca al rematador del segundo palo; objetivo: ningún remate suyo en el segundo palo"]
            : ["su peligro no llega por fuera", "cerrar el pase interior antes que el centro", `bloque medio con los pasillos interiores cerrados; objetivo: que siga por debajo de ${cifra1(volumen.valor, volumen.unidad)} centros por partido sin abrirle el pase por dentro`];

  const nosCentran: BloqueCentros = {
    rotulo: "Su ataque · cuando ellos centran",
    frase: `como centra ${cuanto} ${comoAcierta}, ${porque}: ${accion}`,
    tarea,
  };

  /* El titular, la lectura sin cifras: las cifras van una vez, abajo. */
  const deAcierto = bien ? " y con acierto" : mal ? " y con poco acierto" : "";
  const deRecibe = !recibe
    ? ""
    : muchoRecibe
      ? recibe.percentil <= 3
        ? "; le centran más que a nadie en la liga"
        : "; le centran más que a la mayoría"
      : cercaDeLaMediana
        ? "; le centran como a la media de la liga"
        : "; le centran poco";

  return {
    titular: `${equipo} centra ${muchos ? "mucho" : "poco"}${deAcierto}${deRecibe}`,
    bloques: [nosCentran, ...(lesCentramos ? [lesCentramos] : [])],
    poco: !muchos,
  };
}

export function AbpWyscoutRival({
  equipo,
  plantilla,
  ambito = "abp",
  acciones = [],
}: {
  equipo: string;
  plantilla: RivalPlayerAerial[];
  /** "area": sus centros laterales en vez de su balón parado (Área del rival). */
  ambito?: "abp" | "area";
  /** Sus acciones de las hojas de ABP: de ahí sale cómo defiende el córner, si está escrito. */
  acciones?: RivalScoutAction[];
}) {
  const [estado, setEstado] = useState<{ equipo: string; datos: Datos | null }>({
    equipo: "",
    datos: null,
  });

  useEffect(() => {
    if (!equipo) return;

    let cancelado = false;

    /* v=5 (11/11/2026): la respuesta trae el mínimo y el máximo de la liga para la barra. */
    traeJson<{ ok?: boolean } & Partial<Datos>>(
      `/api/data-analisis?abpRival=${encodeURIComponent(equipo)}${ambito === "area" ? "&ambito=area" : ""}&v=5`,
    )
      .then((r) => {
        if (cancelado) return;

        setEstado({
          equipo,
          datos: r?.ok && Array.isArray(r.aspectos) ? (r as Datos) : null,
        });
      })
      .catch((error) => {
        console.error("[abp-rival] Wyscout", error);

        if (!cancelado) setEstado({ equipo, datos: null });
      });

    return () => {
      cancelado = true;
    };
  }, [equipo, ambito]);

  /*
  | Su once probable (29/10/2026), el mismo documento que /rivals y /duelos:
  | «Rematan» y la consigna se cruzan con los titulares. Si el único
  | rematador etiquetado no es titular, la consigna no puede emparejar a
  | nuestro central con alguien que empieza en el banquillo.
  */
  const [titularesDe, setTitularesDe] = useState<{ equipo: string; claves: Set<string> | null }>({ equipo: "", claves: null });

  useEffect(() => {
    if (!equipo || ambito !== "abp") return;

    let vivo = true;

    fetch(`/api/docs?key=${encodeURIComponent(rivalOnceKey(equipo))}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: unknown }>)
      .then((j) => {
        const titulares = normalizarOnce(j?.data ?? null).titulares;

        if (vivo) setTitularesDe({ equipo, claves: titulares.length >= 7 ? new Set(titulares) : null });
      })
      .catch(() => {
        if (vivo) setTitularesDe({ equipo, claves: null });
      });

    return () => {
      vivo = false;
    };
  }, [equipo, ambito]);

  const titulares = titularesDe.equipo === equipo ? titularesDe.claves : null;

  /*
  | Quién marca a quién, con nombre (11/11/2026, fútbol y marketing): la
  | misma propuesta que /abp-pizarra («Quién marca a quién»): su once por
  | remates, altura y aéreos contra nuestro once de la pizarra táctica por su
  | valor por arriba. Sólo cuenta; no escribe nada en la pizarra.
  */
  const { players } = usePlayers();
  const [marcasDe, setMarcasDe] = useState<{ equipo: string; filas: { nuestro: string; suyo: Atacante }[]; fuente: string } | null>(null);

  useEffect(() => {
    if (ambito !== "abp" || !equipo || players.length === 0) return;

    let vivo = true;

    cargaDatosMarcas(equipo, players)
      .then((d) => {
        if (!vivo) return;

        if (!d) {
          setMarcasDe({ equipo, filas: [], fuente: "" });
          return;
        }

        const nuestros = ordenaMarcadores(d.plantel.filter((m) => m.titular));
        const suyos = ordenaAtacantes(d.atacantes).filter((a) => a.remates > 0 || a.remataAbp || (a.altura ?? 0) >= 183);
        const filas = suyos.slice(0, 3).flatMap((suyo, i) => (nuestros[i] ? [{ nuestro: nuestros[i].nombre, suyo }] : []));

        setMarcasDe({ equipo, filas, fuente: d.fuente });
      })
      .catch((error) => {
        console.error("[abp-rival] marcas", error);

        if (vivo) setMarcasDe({ equipo, filas: [], fuente: "" });
      });

    return () => {
      vivo = false;
    };
  }, [equipo, ambito, players]);

  const marcasListas = marcasDe?.equipo === equipo;
  const marcas = marcasDe && marcasDe.equipo === equipo && marcasDe.filas.length > 0 ? marcasDe : null;

  /*
  | EL PLAZO (11/11/2026, fútbol): en el móvil «Quién lo lanza y quién remata»
  | no llegaba a salir porque esperaba al once probable, a la plantilla y a las
  | marcas sin tope. Mientras esperan se pinta un esqueleto; pasados 8 s sale
  | con lo que haya y se completa cuando llegue el resto.
  */
  const [plazoDe, setPlazoDe] = useState("");

  useEffect(() => {
    if (!equipo || ambito !== "abp") return;

    const t = setTimeout(() => setPlazoDe(equipo), 8000);

    return () => clearTimeout(t);
  }, [equipo, ambito]);

  const plazoCumplido = plazoDe === equipo;

  /*
  | LA BASE DE BESOCCER (11/11/2026, fútbol): «15 goles en 10 partidos» aquí y
  | «16 en 11» en Plantillas rivales sin decir por qué. Wyscout puede ir una
  | jornada por detrás; si BeSoccer lleva otra cuenta, se dice al lado.
  */
  const { doc: informeDoc } = useRivalInforme({ alEntrar: ambito === "abp" });
  const filaBeSoccer = (() => {
    const informe = ambito === "abp" ? findInforme(informeDoc, equipo) : null;
    const total = informe?.clasificacion?.total ?? [];

    return informe && total.length ? filaPropia(total, informe) : null;
  })();

  /*
  | LO QUE ESCRIBE EL ANALISTA (11/11/2026, fútbol): si Scout Colectivo dice
  | «cargan el área de centros» y Wyscout «centra poco», se ponen juntos en una
  | línea, como el contraste de ABP del Plan de partido. Sólo en Área.
  */
  const [colectivoDe, setColectivoDe] = useState<{ equipo: string; id: string; lineas: { rotulo: string; texto: string }[] } | null>(null);

  useEffect(() => {
    if (!equipo || ambito !== "area") return;

    let vivo = true;

    traeJson<unknown>("/api/rivals?action=rivales")
      .then((filas) => {
        if (!vivo || !Array.isArray(filas)) return;

        const primeraLinea = (valor: string) =>
          String(valor ?? "")
            .split(/\r?\n/)
            .map((l) => l.replace(/^[\s\-–•*·]+/, "").trim())
            .find((l) => !/^[\s\-—–.]*$/.test(l)) ?? "";

        const jornadas = (filas as FilaRival[])
          .filter((f) => f && typeof f === "object")
          .map(aJornada)
          .filter((j) => mismoClub(j.equipo, equipo))
          .sort((a, b) => Number(b.jornada || 0) - Number(a.jornada || 0));

        for (const j of jornadas) {
          const lineas = [
            { campo: "OF_AREA_CENTROS", rotulo: "Sus centros" },
            { campo: "OF_CAMPO_CARRIL_EXTERIOR", rotulo: "Por fuera" },
          ]
            .map((c) => ({ rotulo: c.rotulo, texto: primeraLinea(j.fila[c.campo]) }))
            .filter((c) => c.texto);

          if (lineas.length) {
            setColectivoDe({ equipo, id: j.id, lineas });
            return;
          }
        }

        setColectivoDe({ equipo, id: "", lineas: [] });
      })
      .catch((error) => console.error("[area-rival] scout colectivo", error));

    return () => {
      vivo = false;
    };
  }, [equipo, ambito]);

  const colectivo = colectivoDe?.equipo === equipo && colectivoDe.lineas.length > 0 ? colectivoDe : null;

  /*
  | «Quién remata» sólo cuando ha llegado todo (30/10/2026): Wyscout, el once
  | probable y las etiquetas de la plantilla. Con una carga a medias la
  | consigna emparejaba al central con un suplente y, al completarse, con otro.
  | Desde el 11/11/2026, con el plazo de arriba.
  */
  const onceListo = titularesDe.equipo === equipo;
  const wyscoutListo = estado.equipo === equipo;
  const esTitular = (uno: RivalPlayerAerial) =>
    titulares ? titulares.has(playerKey({ FOTO: uno.foto, NOMBRE_EQUIPO: equipo, JUGADOR: uno.nombre })) : null;

  const datos = estado.equipo === equipo ? estado.datos : null;

  const aspectos = datos?.aspectos ?? [];

  const goles = datos?.golesAbp ?? null;

  const rematan = plantilla.filter((uno) => uno.remataAbp);
  const sacanEtiquetados = plantilla.filter((uno) => uno.sacaAbp);

  /*
  | UN SOLO NOMBRE POR JUGADOR (11/11/2026, fútbol): Wyscout escribe «Eugeni
  | Valderrama» o «O. Castro», las marcas salían en mayúsculas («FRAN GIL») y
  | Plantillas dice otra cosa. Todo se cruza con la plantilla y sale con el
  | nombre de Plantillas rivales; si la plantilla tiene un solo nombre de pila
  | que casa sin duda con uno de los trozos, vale ese.
  */
  const nombreVisible = (nombre: string) => {
    const casado = casaNombre(nombre, plantilla, (uno) => uno.nombre);

    if (casado) return casado.nombre;

    const trozos = normalizePlayerName(nombre).split(" ").filter((t) => t.length > 2);
    const porPila = plantilla.filter((uno) => {
      const suyo = normalizePlayerName(uno.nombre);

      return !suyo.includes(" ") && trozos.includes(suyo);
    });

    if (porPila.length === 1) return porPila[0].nombre;

    /* «FRAN GIL» → «Fran Gil»: sin plantilla con la que cruzar, al menos sin gritar. */
    return nombre === nombre.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{2}/.test(nombre)
      ? nombre.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toUpperCase())
      : nombre;
  };

  /* Sin etiquetas de «sacador», los lanza quien más saca según Wyscout. */
  const lanzadoresWyscout = datos?.lanzadores ?? [];

  /*
  | UNA FILA POR LANZADOR (11/11/2026, marketing): antes «Eugeni Valderrama ·
  | córner» y «Eugeni Valderrama · falta» en dos filas. Ahora columnas
  | córner y falta, con el «≈» de la estimación.
  */
  const porLanzador = (() => {
    const mapa = new Map<string, { nombre: string; corner: number; falta: number; partidos: number }>();

    for (const uno of lanzadoresWyscout) {
      const nombre = nombreVisible(uno.nombre);
      const fila = mapa.get(nombre) ?? { nombre, corner: 0, falta: 0, partidos: 0 };

      fila[uno.tipo] += uno.total;
      fila.partidos = Math.max(fila.partidos, uno.partidos);
      mapa.set(nombre, fila);
    }

    return [...mapa.values()].sort((a, b) => b.corner + b.falta - (a.corner + a.falta));
  })();

  const sacan: { nombre: string }[] =
    sacanEtiquetados.length > 0 ? sacanEtiquetados : porLanzador.map((uno) => ({ nombre: uno.nombre }));
  const lanzaDeWyscout = sacanEtiquetados.length === 0 && sacan.length > 0;

  /* La consigna sale de lo etiquetado: marcar al más alto de los rematadores y vigilar al que saca. */
  const alturaDe = (uno: RivalPlayerAerial) => Number(uno.altura) || 0;
  /*
  | 07/11/2026 (análisis): la base de cada rematador, no sólo la altura:
  | «Miki Bosch (190 cm, 4 remates)». Y se ordena primero por remates
  | contados y, a igualdad, por altura.
  */
  const conCm = (uno: RivalPlayerAerial) => {
    const partes = [alturaDe(uno) ? `${alturaDe(uno)} cm` : "", uno.remates > 0 ? `${uno.remates} ${uno.remates === 1 ? "remate" : "remates"}` : ""].filter(Boolean);

    return `${uno.nombre}${partes.length ? ` (${partes.join(", ")})` : ""}`;
  };
  const porAltura = (lista: RivalPlayerAerial[]) => [...lista].sort((a, b) => (b.remates || 0) - (a.remates || 0) || alturaDe(b) - alturaDe(a));

  /*
  | Con once probable: primero los titulares que rematan (etiquetados, con
  | remates en los datos o de 186 cm o más, sin el portero); los etiquetados
  | que no son titulares van aparte, «si entra…». Sin once, como antes.
  */
  const esPortero = (uno: RivalPlayerAerial) => /portero|^po?r?$|^gk$/i.test(uno.posicion.trim());
  const titularesQueRematan = titulares
    ? porAltura(plantilla.filter((uno) => esTitular(uno) && !esPortero(uno) && (uno.remataAbp || uno.remates > 0 || alturaDe(uno) >= 186)))
    : [];
  const rematanFuera = titulares ? porAltura(rematan.filter((uno) => !esTitular(uno))) : [];
  const rematanVisibles = titulares ? [...titularesQueRematan, ...rematanFuera] : porAltura(rematan);
  const conRemates = rematanVisibles.some((uno) => uno.remates > 0);
  /*
  | 07/11/2026 (fútbol): «nuestro central más alto» salía para dos rematadores
  | distintos. Ahora se empareja por orden: nuestro más alto con su primer
  | rematador, el segundo más alto con el segundo; quien entre desde el
  | banquillo lo coge el que marcaba al que sale.
  */
  const principales = (titulares ? titularesQueRematan : porAltura(rematan)).slice(0, 2);
  const ORDINAL = ["nuestro jugador más alto", "nuestro segundo más alto"];
  const consigna = [
    marcas
      ? `en el córner, ${marcas.filas.map((f) => `${f.nuestro} con ${nombreVisible(f.suyo.nombre)}${motivoAtacante(f.suyo) ? ` (${motivoAtacante(f.suyo)})` : ""}`).join("; ")}`
      : principales.length
        ? `en el córner, ${principales.map((uno, i) => `${ORDINAL[i]} con ${conCm(uno)}`).join(" y ")}`
        : "",
    ...rematanFuera.slice(0, 2).map((uno) => `si entra ${conCm(uno)}, lo coge quien marcaba al que sale`),
    sacan.length > 0 ? `vigilar la trayectoria de ${sacan.map((uno) => uno.nombre).join(" y ")} en el saque` : "",
  ]
    .filter(Boolean)
    .join("; ");

  /*
  | CÓMO DEFIENDE EL CÓRNER (11/11/2026, marketing): zonal, mixto o al hombre,
  | sólo si nuestras hojas de ABP lo dicen. Si no está escrito, no sale.
  */
  const defensaCorner = ambito === "abp" ? estructuraDefensiva(acciones, "corner") : null;

  const hayGoles = !!goles && (goles.aFavor.abp > 0 || goles.enContra.abp > 0);

  if (aspectos.length === 0 && !hayGoles && rematan.length === 0 && sacan.length === 0) {
    /* Mientras llega Wyscout, un esqueleto: un hueco mudo parecía un fallo (11/11/2026). */
    if (!wyscoutListo) {
      return (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="Cargando el balón parado del rival">
          <div className="h-5 w-64 animate-pulse rounded bg-white/10" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-28 animate-pulse rounded-2xl bg-white/[0.06]" />
            <div className="h-28 animate-pulse rounded-2xl bg-white/[0.06]" />
          </div>
        </div>
      );
    }

    return null;
  }

  const nEquipos = datos?.equipos ?? 20;
  const partidosWy = aspectos[0]?.filas[0]?.partidos ?? null;
  const ofensiva = ambito === "abp" ? consignaOfensiva(aspectos.find((a) => a.clave === "abpDef"), nEquipos) : [];
  const conTendencia = hayGoles && !!goles && [goles.aFavor, goles.enContra].some((g) => g.abp > 0 && (g.abp < 10 || g.partidos < 10));
  const hayEstilo = aspectos.some((a) => a.filas.map(orientada).some((f) => f.mejorAlto == null));

  const esperaQuien =
    ambito === "abp" && !plazoCumplido && (!wyscoutListo || !onceListo || plantilla.length === 0 || (players.length > 0 && !marcasListas));
  const salenQuien = ambito === "abp" && !esperaQuien && wyscoutListo && (rematan.length > 0 || sacan.length > 0);

  const centros = ambito === "area" ? queHacemosConCentros(aspectos, equipo, nEquipos) : null;

  /*
  | El contraste con el analista: si su texto habla de muchos centros (cargar,
  | constante, principal…) o de pocos, se dice si Wyscout lo respalda.
  */
  const volumenCentros = aspectos.flatMap((a) => a.filas).find((f) => f.nombre === "Centros laterales");
  const contraste = (() => {
    if (!colectivo || !volumenCentros || centros?.poco == null) return null;

    const texto = colectivo.lineas.map((l) => l.texto).join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const diceMucho = /carg|much|constant|principal|abus|insist|frecuen|continu|siempre|busca/.test(texto);
    const dicePoco = /\bpoco|apenas|rara vez|no centra|evita/.test(texto);
    const puesto = lectura(volumenCentros.percentil, nEquipos, null).texto;

    const veredicto =
      diceMucho && !dicePoco
        ? centros.poco
          ? `no lo respalda: Wyscout le cuenta pocos centros (${puesto}); se lee como lectura de vídeo, de dónde llegan más que de cuántos`
          : `lo respalda: Wyscout le cuenta muchos centros (${puesto})`
        : dicePoco && !diceMucho
          ? centros.poco
            ? `lo respalda: Wyscout le cuenta pocos centros (${puesto})`
            : `no lo respalda: Wyscout le cuenta muchos centros (${puesto}); conviene revisarlo en vídeo`
          : `Wyscout le cuenta ${centros.poco ? "pocos" : "muchos"} centros (${puesto})`;

    return { veredicto };
  })();

  return (
    <div className="space-y-5">
      {aspectos.length > 0 && (
        <Panel
          title={ambito === "area" ? "Sus centros laterales, los que hace y los que recibe, según Wyscout" : "Su balón parado según Wyscout"}
          /* Una línea (11/11/2026): el método, plegado en «Cómo se cuenta». */
          subtitle={`${equipo}${partidosWy != null ? `: ${partidosWy} partidos de Wyscout` : ""} frente a los ${nEquipos} equipos de la liga${nEquipos === 20 ? ", el Castilla incluido" : ""}.`}
          icon={BarChart3}
        >
          {/* Lo que hacemos, en el primer pliegue (11/11/2026, marketing): encima de la tabla y de los goles. */}
          {ofensiva.length > 0 && (
            <div className="mb-4 space-y-2 border-b border-white/10 pb-3 text-sm text-white/85">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Nuestro balón parado · qué hacemos</p>
              {ofensiva.map((o) => (
                <div key={o.frase} className="space-y-0.5">
                  <p>
                    <b className="text-white">Qué hacemos: </b>
                    {o.frase.charAt(0).toUpperCase() + o.frase.slice(1)}.
                  </p>
                  <p>
                    <b className="text-white">Qué entrenamos: </b>
                    {o.tarea}.
                  </p>
                </div>
              ))}
              <p className="text-[12px] text-white/55">
                La cifra es de Wyscout; la decisión y la tarea son criterio de juego a partir de ella.{" "}
                <Link href="/abp-pizarra" className="font-semibold text-[#C8A96B] hover:underline">
                  Preparar las rutinas en la pizarra de balón parado →
                </Link>
              </p>
            </div>
          )}

          {centros && centros.bloques.length > 0 && (
            /*
            | Arriba del todo (30/10/2026): la acción antes que las cifras.
            | 11/11/2026: cada bloque con la cifra una vez, la decisión en la
            | misma frase y «Qué entrenamos» con objetivo.
            */
            <div className="mb-4 space-y-3 border-b border-white/10 pb-3 text-sm text-white/85">
              {centros.titular && <p className="text-base font-semibold text-white md:text-lg">{centros.titular}</p>}
              <p className="text-[12px] text-white/55">Centro lateral: pase al área desde la banda; preciso, si llega a un compañero.</p>
              {centros.bloques.map((b) => (
                <div key={b.rotulo} className="space-y-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{b.rotulo}</p>
                  <p>
                    <b className="text-white">Qué hacemos: </b>
                    {b.frase.charAt(0).toUpperCase() + b.frase.slice(1)}.
                  </p>
                  <p>
                    <b className="text-white">Qué entrenamos: </b>
                    {b.tarea}.
                  </p>
                  {b.rotulo.startsWith("Su ataque") && colectivo && contraste && (
                    <p className="mt-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-[13px] text-white/70">
                      <b className="text-white/85">Contraste con Scout Colectivo</b>
                      {" · "}
                      {colectivo.lineas.map((l) => `${l.rotulo}: «${l.texto}»`).join("; ")}
                      {" — "}
                      {contraste.veredicto}.{" "}
                      <Link
                        href={colectivo.id ? `/scout-rival-collective?rival=${encodeURIComponent(colectivo.id)}` : "/scout-rival-collective"}
                        className="text-[#C8A96B] hover:underline"
                      >
                        Ver el análisis →
                      </Link>
                    </p>
                  )}
                </div>
              ))}
              <p className="text-[12px] text-white/55">La cifra es de Wyscout; la decisión y la tarea son criterio de juego a partir de ella.</p>
            </div>
          )}

          {defensaCorner && (
            <p className="mb-4 border-b border-white/10 pb-3 text-sm text-white/85">
              <b className="text-white">Cómo defiende el córner: </b>
              {defensaCorner.tipo === "zonal" ? "en zona" : defensaCorner.tipo === "hombre" ? "al hombre" : "mixto"}
              {defensaCorner.enZona ? `, con ${defensaCorner.enZona} en zona` : ""}
              <span className="text-[12px] text-white/55">
                {" "}
                (nuestras hojas de ABP, {defensaCorner.acciones} {defensaCorner.acciones === 1 ? "acción" : "acciones"})
              </span>
              .
            </p>
          )}

          <ComoSeCuenta ambito={ambito} />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {aspectos.map((aspecto) => (
              <div key={aspecto.clave} className="min-w-0">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  {aspecto.aspecto}
                  {aspecto.filas[0]?.partidos != null && aspecto.filas[0].partidos < 10 && (
                    <span className="ml-2 font-normal normal-case tracking-normal italic text-white/45">
                      tendencia, {aspecto.filas[0].partidos} partidos
                    </span>
                  )}
                </h3>

                <ul className="mt-2 space-y-2">
                  {aspecto.filas.map(orientada).map((fila) => {
                    const lee = lectura(fila.percentil, nEquipos, fila.mejorAlto);
                    const tendencia = esTendencia(fila);
                    /* En tendencia, sin flecha ni color (11/11/2026, análisis). */
                    const bueno = tendencia ? null : lee.bueno;

                    return (
                      <li
                        key={fila.nombre}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <span className="min-w-0 text-sm text-white/80">{rotuloDe(fila)}</span>

                        <span className="text-sm font-semibold tabular-nums text-white">
                          {cifra1(fila.valor, fila.unidad)}
                          {/* La unidad también en balón parado: «5,4 por partido» (30/10/2026). */}
                          {fila.unidad !== "porcentaje" && (
                            <span className="ml-1 text-xs font-normal text-white/55">por partido</span>
                          )}
                          {/* La base (partidos) va una vez, en el subtítulo (30/10/2026); aquí sólo si esta fila tiene otra. */}
                          {fila.partidos != null && fila.partidos !== aspecto.filas[0]?.partidos && (
                            <span className="ml-2 text-xs font-normal text-white/55">
                              en {fila.partidos} {fila.partidos === 1 ? "partido" : "partidos"}
                            </span>
                          )}
                          {fila.unidad === "porcentaje" && fila.base && (
                            <span className="ml-2 text-xs font-normal text-white/55">
                              {Math.round(fila.base.arriba)} de {Math.round(fila.base.abajo)}
                            </span>
                          )}
                          {(fila.minimo == null || fila.maximo == null) && (
                            <span className="ml-2 text-xs font-normal text-white/45">
                              mediana {cifra1(fila.mediana, fila.unidad)}
                            </span>
                          )}
                        </span>

                        <BarraLiga fila={fila} />

                        <span
                          className="w-full text-[12px]"
                          style={{
                            color:
                              bueno === true
                                ? "var(--rmcf-rate-good, #15803D)"
                                : bueno === false
                                  ? "var(--rmcf-rate-low, #DC2626)"
                                  : undefined,
                          }}
                        >
                          {bueno === true ? "▲ " : bueno === false ? "▼ " : ""}
                          {lee.texto}
                          {tendencia && fila.base ? ` · tendencia: sólo ${Math.round(fila.base.arriba)} casos` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* «Cifra de estilo», explicada una vez (11/11/2026, marketing) y no en cada fila. */}
          {hayEstilo && (
            <p className="mt-3 text-[12px] text-white/55">Sin flecha: cifra de estilo, ni buena ni mala por sí misma; el puesto va de más a menos.</p>
          )}
        </Panel>
      )}

      {esperaQuien && (
        <div
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          role="status"
          aria-busy="true"
          aria-label="Cargando quién lo lanza y quién remata"
        >
          <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-16 animate-pulse rounded bg-white/[0.06]" />
        </div>
      )}

      {salenQuien && (
        <Panel
          title={sacan.length > 0 && rematan.length > 0 ? "Quién lo lanza y quién remata" : sacan.length > 0 ? "Quién lo lanza" : "Quién remata"}
          subtitle={`${lanzaDeWyscout ? "Lanzan: Wyscout, estimado (≈) con lanzamientos por 90 × minutos" : "Lanzan: etiquetas de la plantilla"}. Rematan: etiquetas de Plantillas rivales${conRemates ? " y remates contados en nuestras hojas de ABP" : ""}${titulares ? ", cruzados con su once probable" : ""}.`}
          icon={BarChart3}
        >
          {/* Qué hacemos primero (11/11/2026, marketing): la consigna antes que las listas. */}
          {consigna && (
            <p className="mb-3 border-b border-white/10 pb-3 text-sm text-white/85">
              <b className="text-white">Qué hacemos: </b>
              {consigna}.
              <span className="mt-1 block text-[12px] text-white/55">
                {marcas ? "Propuesta de marcas con nuestro once de la pizarra táctica, la misma de «Quién marca a quién»: su más peligroso por arriba, para nuestro mejor. " : ""}
                <Link href="/abp-pizarra" className="font-semibold text-[#C8A96B] hover:underline">
                  Llevarlo a la pizarra de balón parado →
                </Link>
              </span>
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sacan.length > 0 && (
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Lanzan</p>
                {lanzaDeWyscout ? (
                  <>
                    {/* Una fila por lanzador (11/11/2026, marketing), con el «≈» de la estimación. */}
                    <table className="mt-1 w-full text-sm text-white/85">
                      <thead>
                        <tr className="text-left text-[11px] text-white/50">
                          <th className="py-0.5 pr-2 font-semibold">Jugador</th>
                          <th className="py-0.5 pr-2 text-right font-semibold">Córners ≈</th>
                          <th className="py-0.5 pr-2 text-right font-semibold">Faltas ≈</th>
                          <th className="py-0.5 text-right font-semibold">Partidos suyos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {porLanzador.map((uno) => (
                          <tr key={uno.nombre} className="border-t border-white/[0.06]">
                            <td className="py-1 pr-2">{uno.nombre}</td>
                            <td className="py-1 pr-2 text-right tabular-nums">{uno.corner > 0 ? `≈${uno.corner}` : ""}</td>
                            <td className="py-1 pr-2 text-right tabular-nums">{uno.falta > 0 ? `≈${uno.falta}` : ""}</td>
                            <td className="py-1 text-right tabular-nums">{uno.partidos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-1 text-[11px] text-white/50">«Partidos suyos» son los que ha jugado cada uno; por eso no coinciden entre lanzadores.</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-white/85">{sacan.map((uno) => uno.nombre).join(", ")}</p>
                )}
              </div>
            )}

            {rematanVisibles.length > 0 && (
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Rematan</p>
                {/* Sin remates contados, la columna no sale (11/11/2026, fútbol): lo que no tiene dato no se nombra. */}
                <table className="mt-1 w-full text-sm text-white/85">
                  <thead>
                    <tr className="text-left text-[11px] text-white/50">
                      <th className="py-0.5 pr-2 font-semibold">Jugador</th>
                      <th className={`py-0.5 text-right font-semibold ${conRemates ? "pr-2" : ""}`}>Altura</th>
                      {conRemates && <th className="py-0.5 text-right font-semibold">Remates ABP</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rematanVisibles.map((uno) => (
                      <tr key={uno.nombre} className="border-t border-white/[0.06]">
                        <td className="py-1 pr-2">
                          {uno.nombre}
                          {titulares && esTitular(uno) === false && <span className="ml-1 text-[11px] text-white/50">fuera del once</span>}
                        </td>
                        <td className={`py-1 text-right tabular-nums ${conRemates ? "pr-2" : ""}`}>{alturaDe(uno) ? `${alturaDe(uno)} cm` : ""}</td>
                        {conRemates && <td className="py-1 text-right tabular-nums">{uno.remates > 0 ? uno.remates : ""}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>
      )}

      {hayGoles && goles && (
        <Panel
          title="Goles a balón parado esta temporada"
          subtitle="Los goles y los penaltis son dato del marcador; el reparto entre córner y falta es una estimación calibrada con Opta"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {([
              ["Los que marca", goles.aFavor, filaBeSoccer?.favor],
              ["Los que encaja", goles.enContra, filaBeSoccer?.contra],
            ] as const).map(([titulo, g, deBeSoccer]) => (
              <div key={titulo} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{titulo}</p>

                <p className="mt-1 text-2xl font-black tabular-nums text-white">
                  {g.abp}
                  <span className="ml-2 text-sm font-normal text-white/45">
                    de {g.goles} goles en {g.partidos} partidos de Wyscout
                  </span>
                </p>

                {/* La otra base, dicha (11/11/2026, fútbol): «en BeSoccer van 16 en 11». */}
                {filaBeSoccer && deBeSoccer != null && (filaBeSoccer.jugados !== g.partidos || deBeSoccer !== g.goles) && (
                  <p className="mt-0.5 text-[12px] text-white/55">
                    En BeSoccer van {deBeSoccer} en {filaBeSoccer.jugados} {filaBeSoccer.jugados === 1 ? "partido" : "partidos"}, la cuenta de Plantillas rivales.
                  </p>
                )}

                {/* 11/11/2026 (análisis): penalti (dato) y córner o falta (estimado), en líneas separadas. */}
                {g.hayOrigen && g.abp > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[12px] text-white/60">
                    {g.penalti > 0 && <li>De penalti: {g.penalti} · dato</li>}
                    {g.corner > 0 && <li>De córner: {g.corner} · estimado</li>}
                    {g.falta > 0 && <li>De falta: {g.falta} · estimado</li>}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {/* Una sola vez, debajo de los dos (11/11/2026, análisis y marketing). */}
          {conTendencia && (
            <p className="mt-2 text-[12px] italic text-white/55">
              Con menos de 10 goles a balón parado, es una tendencia: no se lee como fortaleza ni como carencia.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}

export default AbpWyscoutRival;
