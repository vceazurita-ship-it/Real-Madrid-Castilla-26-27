"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

import { Panel } from "@/components/abp/ui";
import { traeJson } from "@/lib/hojaCsv";
import { formatea, type Unidad } from "@/lib/data-analisis/metricas";
import type { GolesAbp } from "@/lib/data-analisis/goles-abp";
import type { RivalPlayerAerial } from "@/lib/abp/rival";
import { casaNombre } from "@/lib/data-analisis/once";
import { normalizarOnce, playerKey, rivalOnceKey } from "@/lib/rivals/once";
import { cargaDatosMarcas } from "@/lib/abp/marcas-datos";
import { motivoAtacante, ordenaAtacantes, ordenaMarcadores, type Atacante } from "@/lib/abp/marcas-corner";
import { usePlayers } from "@/hooks/usePlayers";
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
};

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
function consignaOfensiva(aspecto: Aspecto | undefined, equipos: number): { dato: string; decision: string }[] {
  if (!aspecto || aspecto.clave !== "abpDef") return [];

  const peor = (fila: Fila | undefined) => (fila && fila.mejorAlto === false && fila.percentil <= 20 ? fila : null);
  const corners = peor(aspecto.filas.find((f) => f.nombre === "Córners"));
  const conRemate = peor(aspecto.filas.find((f) => f.nombre === "Córners con remate %"));
  const partes: { dato: string; decision: string }[] = [];

  if (corners) {
    partes.push({
      dato: `concede ${cifra1(corners.valor, corners.unidad)} córners por partido (mediana ${cifra1(corners.mediana, corners.unidad)}; ${lectura(corners.percentil, equipos, false).texto})`,
      decision: "llegar a línea de fondo y forzar córner; preparar dos rutinas de córner ofensivo.",
    });
  }

  if (conRemate) {
    partes.push({
      dato: `le rematan el ${cifra1(conRemate.valor, conRemate.unidad)} de los córners${conRemate.base ? ` (${Math.round(conRemate.base.arriba)} de ${Math.round(conRemate.base.abajo)})` : ""}; mediana ${cifra1(conRemate.mediana, conRemate.unidad)}, ${lectura(conRemate.percentil, equipos, false).texto}`,
      decision: "cargar el área con nuestros mejores rematadores en cada córner.",
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
const partePorFlecha = (frase: string) => {
  const [dato, ...resto] = frase.split(" → ");

  return { dato: dato.replace(/[:.]\s*$/, ""), decision: resto.join(" → ") };
};

function queHacemosConCentros(
  aspectos: Aspecto[],
  equipo: string,
): { titular: string; nosCentran: string; lesCentramos: string } {
  const filas = aspectos.flatMap((a) => a.filas);
  const volumen = filas.find((f) => f.nombre === "Centros laterales");
  const acierto = filas.find((f) => f.nombre === "Centros precisos %");
  const recibe = filas.find((f) => f.nombre === "Centros que recibe");

  /*
  | Lo que recibe (menos es mejor): si es más que la mediana, se le ataca por
  | fuera. 07/11/2026 (fútbol): también cuando reciben pocos, que es la otra
  | mitad del «Qué hacemos»; y con el sujeto claro (son ellos los que reciben).
  */
  /* 09/11/2026 (jueces): con un valor cerca de la mediana (menos de un 15 % de
     diferencia) no es un rasgo del equipo sino una tendencia; no se da como orden. */
  const cercaDeLaMediana = !!recibe && Math.abs(recibe.valor - recibe.mediana) <= recibe.mediana * 0.15;
  const lesCentramos = !recibe
    ? ""
    : recibe.valor > recibe.mediana
      ? `${equipo} recibe ${cifra1(recibe.valor, recibe.unidad)} centros por partido (mediana ${cifra1(recibe.mediana, recibe.unidad)}) → atacarles por fuera, con extremo y lateral doblando y tres hombres en el área.`
      : cercaDeLaMediana
        ? `${equipo} recibe ${cifra1(recibe.valor, recibe.unidad)} centros por partido (mediana ${cifra1(recibe.mediana, recibe.unidad)}), cerca de lo normal en la liga → como tendencia, probar primero por dentro y centrar con el área cargada.`
        : `${equipo} recibe ${cifra1(recibe.valor, recibe.unidad)} centros por partido (mediana ${cifra1(recibe.mediana, recibe.unidad)}), no deja centrar → el centro no es la primera vía; llegar por dentro y centrar sólo con el área cargada.`;

  if (!volumen || !acierto) return { titular: "", nosCentran: "", lesCentramos };

  const muchos = volumen.valor > volumen.mediana;
  /* 29/10/2026: «bien» o «mal» sólo si el acierto se separa de la mediana más de
     2 puntos; con 33,8 % frente a 33,9 % no es poco, es lo de la liga. */
  const dif = acierto.valor - acierto.mediana;
  const bien = dif > 2;
  const mal = dif < -2;

  const cuanto = `${cifra1(volumen.valor, volumen.unidad)} por partido (mediana ${cifra1(volumen.mediana, volumen.unidad)})`;
  /* Con la base: «58 de 201» (07/11/2026, fútbol). */
  const baseAcierto = acierto.base ? `, ${Math.round(acierto.base.arriba)} de ${Math.round(acierto.base.abajo)} precisos` : "";
  const comoAcierta = `${bien ? "con más acierto que la liga" : mal ? "con menos acierto que la liga" : "con un acierto como el de la liga"} (${cifra1(acierto.valor, acierto.unidad)} frente a ${cifra1(acierto.mediana, acierto.unidad)}${baseAcierto})`;

  const accion =
    muchos && bien
      ? "cerrar el carril exterior y proteger el segundo palo"
      : muchos && mal
        ? "dejarles centrar desde fuera del área, nunca sin presión al que centra, y ganar el área"
        : muchos
          ? "cerrar el carril exterior y ganar el área"
          : bien
            ? "cuando centren, tapar al rematador del segundo palo"
            : "cerrar el pase interior antes que el centro";

  return {
    /* Sólo el dato (11/11/2026, análisis): la acción va debajo, una vez, y no se repite arriba. */
    titular: `${equipo} centra ${muchos ? "mucho" : "poco"}: ${cifra1(volumen.valor, volumen.unidad)} por partido (mediana ${cifra1(volumen.mediana, volumen.unidad)})`,
    nosCentran: `${equipo} centra ${cuanto} ${comoAcierta} → ${accion}.`,
    lesCentramos,
  };
}

export function AbpWyscoutRival({
  equipo,
  plantilla,
  ambito = "abp",
}: {
  equipo: string;
  plantilla: RivalPlayerAerial[];
  /** "area": sus centros laterales en vez de su balón parado (Área del rival). */
  ambito?: "abp" | "area";
}) {
  const [estado, setEstado] = useState<{ equipo: string; datos: Datos | null }>({
    equipo: "",
    datos: null,
  });

  useEffect(() => {
    if (!equipo) return;

    let cancelado = false;

    traeJson<{ ok?: boolean } & Partial<Datos>>(
      `/api/data-analisis?abpRival=${encodeURIComponent(equipo)}${ambito === "area" ? "&ambito=area" : ""}&v=4`,
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
    if (!equipo) return;

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
  }, [equipo]);

  const titulares = titularesDe.equipo === equipo ? titularesDe.claves : null;

  /*
  | Quién marca a quién, con nombre (11/11/2026, fútbol y marketing): «nuestro
  | jugador más alto con…» no decía quién. Es la misma propuesta que
  | /abp-pizarra («Quién marca a quién»): su once por remates, altura y
  | aéreos contra nuestro once de la pizarra táctica por su valor por arriba.
  | Sólo cuenta; no escribe nada en la pizarra.
  */
  const { players } = usePlayers();
  const [marcasDe, setMarcasDe] = useState<{ equipo: string; filas: { nuestro: string; suyo: Atacante }[]; fuente: string } | null>(null);

  useEffect(() => {
    if (ambito !== "abp" || !equipo || players.length === 0) return;

    let vivo = true;

    cargaDatosMarcas(equipo, players)
      .then((d) => {
        if (!vivo || !d) return;

        const nuestros = ordenaMarcadores(d.plantel.filter((m) => m.titular));
        const suyos = ordenaAtacantes(d.atacantes).filter((a) => a.remates > 0 || a.remataAbp || (a.altura ?? 0) >= 183);
        const filas = suyos.slice(0, 3).flatMap((suyo, i) => (nuestros[i] ? [{ nuestro: nuestros[i].nombre, suyo }] : []));

        setMarcasDe({ equipo, filas, fuente: d.fuente });
      })
      .catch((error) => console.error("[abp-rival] marcas", error));

    return () => {
      vivo = false;
    };
  }, [equipo, ambito, players]);

  const marcas = marcasDe?.equipo === equipo && marcasDe.filas.length > 0 ? marcasDe : null;

  /*
  | «Quién remata» sólo cuando ha llegado todo (30/10/2026): Wyscout, el once
  | probable y las etiquetas de la plantilla. Con una carga a medias la
  | consigna emparejaba al central con un suplente y, al completarse, con otro.
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

  /* Sin etiquetas de «sacador», los lanza quien más saca según Wyscout, con el
     nombre cruzado con la plantilla (Wyscout escribe «O. Castro»). */
  const lanzadoresWyscout = datos?.lanzadores ?? [];
  const nombreDeLanzador = (nombre: string) =>
    casaNombre(nombre, plantilla, (uno) => uno.nombre)?.nombre ?? nombre;

  const sacan: { nombre: string }[] =
    sacanEtiquetados.length > 0
      ? sacanEtiquetados
      : [...new Set(lanzadoresWyscout.map((uno) => nombreDeLanzador(uno.nombre)))].map((nombre) => ({ nombre }));
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
  const rematanVisibles = titulares ? [...titularesQueRematan, ...rematanFuera] : rematan;
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
      ? `en el córner, ${marcas.filas.map((f) => `${f.nuestro} con ${f.suyo.nombre}${motivoAtacante(f.suyo) ? ` (${motivoAtacante(f.suyo)})` : ""}`).join("; ")}`
      : principales.length
        ? `en el córner, ${principales.map((uno, i) => `${ORDINAL[i]} con ${conCm(uno)}`).join(" y ")}`
        : "",
    ...rematanFuera.slice(0, 2).map((uno) => `si entra ${conCm(uno)}, lo coge quien marcaba al que sale`),
    sacan.length > 0 ? `vigilar la trayectoria de ${sacan.map((uno) => uno.nombre).join(" y ")} en el saque` : "",
  ]
    .filter(Boolean)
    .join("; ");

  const hayGoles = !!goles && (goles.aFavor.abp > 0 || goles.enContra.abp > 0);

  if (aspectos.length === 0 && !hayGoles && rematan.length === 0 && sacan.length === 0) {
    return null;
  }

  const nEquipos = datos?.equipos ?? 20;
  const partidosWy = aspectos[0]?.filas[0]?.partidos ?? null;
  const ofensiva = ambito === "abp" ? consignaOfensiva(aspectos.find((a) => a.clave === "abpDef"), nEquipos) : [];
  const conTendencia = hayGoles && !!goles && [goles.aFavor, goles.enContra].some((g) => g.abp > 0 && (g.abp < 10 || g.partidos < 10));

  return (
    <div className="space-y-5">
      {aspectos.length > 0 && (
        <Panel
          title={ambito === "area" ? "Sus centros laterales, los que hace y los que recibe, según Wyscout" : "Su balón parado según Wyscout"}
          subtitle={`${equipo}${partidosWy != null ? ` en ${partidosWy} partidos de Wyscout (la descarga puede ir una jornada por detrás del calendario)` : ""} frente a los ${nEquipos} equipos de la liga${nEquipos === 20 ? ", el Castilla incluido" : ""}. ▲ mejor y ▼ peor ya tienen en cuenta si conviene más o menos; sin flecha, es una cifra de estilo.${ambito === "area" ? " «x de y» es la base real: en «sus centros», los que hace; en «los que recibe», los que le hacen." : ""}`}
          icon={BarChart3}
        >
          {/* Lo que hacemos, en el primer pliegue (11/11/2026, marketing): encima de la tabla y de los goles. */}
          {ofensiva.length > 0 && (
            <div className="mb-4 space-y-2 border-b border-white/10 pb-3 text-sm text-white/85">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Nuestro balón parado · qué hacemos</p>
              {ofensiva.map((o) => (
                <div key={o.dato}>
                  <p>
                    <b className="text-white">El dato (Wyscout): </b>
                    {equipo} {o.dato}.
                  </p>
                  <p>
                    <b className="text-white">La decisión </b>
                    <span className="text-[12px] text-white/55">(criterio de juego, no lo dicta la cifra)</span>
                    <b className="text-white">: </b>
                    {o.decision}
                  </p>
                </div>
              ))}
            </div>
          )}

          {ambito === "area" && (() => {
            const { titular, nosCentran, lesCentramos } = queHacemosConCentros(aspectos, equipo);

            if (!nosCentran && !lesCentramos) return null;

            /*
            | Arriba del todo (30/10/2026): la acción antes que la tabla.
            | 11/11/2026 (análisis): rótulos propios, «Su ataque» y «Nuestro
            | ataque», y en cada uno el dato y la decisión por separado.
            */
            const bloques = [
              { rotulo: "Su ataque · cuando ellos centran", frase: nosCentran },
              { rotulo: "Nuestro ataque · cuando les centramos", frase: lesCentramos },
            ].filter((b) => b.frase);

            return (
              <div className="mb-4 space-y-2 border-b border-white/10 pb-3 text-sm text-white/85">
                {titular && <p className="text-base font-semibold text-white md:text-lg">{titular}</p>}
                <p className="text-[12px] text-white/55">Centro lateral: pase al área desde la banda; preciso, si llega a un compañero.</p>
                {bloques.map((b) => {
                  const { dato, decision } = partePorFlecha(b.frase);

                  return (
                    <div key={b.rotulo}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{b.rotulo}</p>
                      <p>{dato}.</p>
                      {decision && (
                        <p>
                          <b className="text-white">Qué hacemos </b>
                          <span className="text-[12px] text-white/55">(criterio de juego, no lo dicta la cifra)</span>
                          <b className="text-white">: </b>
                          {decision}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
                    /* Con menos de 25 casos detrás de un porcentaje, tendencia (11/11/2026, análisis). */
                    const pocaBase = fila.unidad === "porcentaje" && !!fila.base && fila.base.abajo < 25;

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
                          <span className="ml-2 text-xs font-normal text-white/45">
                            mediana {cifra1(fila.mediana, fila.unidad)}
                          </span>
                        </span>

                        <span
                          className="w-full text-xs"
                          style={{
                            color:
                              lee.bueno === true
                                ? "var(--rmcf-rate-good, #15803D)"
                                : lee.bueno === false
                                  ? "var(--rmcf-rate-low, #DC2626)"
                                  : undefined,
                          }}
                        >
                          {lee.bueno === true ? "▲ " : lee.bueno === false ? "▼ " : ""}
                          {lee.texto}
                          {fila.mejorAlto == null ? " · cifra de estilo" : ""}
                          {pocaBase ? " · tendencia, pocos casos" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

        </Panel>
      )}

      {onceListo && wyscoutListo && plantilla.length > 0 && (rematan.length > 0 || sacan.length > 0) && (
        <Panel
          title={sacan.length > 0 && rematan.length > 0 ? "Quién lo lanza y quién remata" : sacan.length > 0 ? "Quién lo lanza" : "Quién remata"}
          subtitle={`${lanzaDeWyscout ? "Lanzamientos de la temporada según Wyscout (aproximados: por 90 × minutos)" : "Lanzan, según las etiquetas de la plantilla"}. Rematan: etiquetas de Plantillas rivales y remates contados en nuestras hojas de ABP${titulares ? ", cruzados con el once probable de Plantillas rivales" : ""}.`}
          icon={BarChart3}
        >
          {/* Qué hacemos primero (11/11/2026, marketing): la consigna antes que las listas. */}
          {consigna && (
            <p className="mb-3 border-b border-white/10 pb-3 text-sm text-white/85">
              <b className="text-white">Qué hacemos: </b>
              {consigna}.
              {marcas && (
                <span className="mt-1 block text-[12px] text-white/55">
                  Propuesta de marcas con nuestro once de la pizarra táctica, la misma de «Quién marca a quién» en la{" "}
                  <Link href="/abp-pizarra" className="underline decoration-dotted underline-offset-2 hover:text-white">
                    pizarra de balón parado
                  </Link>
                  : su más peligroso por arriba, para nuestro mejor.
                </span>
              )}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sacan.length > 0 && (
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Lanzan</p>
                {lanzaDeWyscout ? (
                  <>
                    {/* Tabla corta (11/11/2026, marketing): lanzador, acciones y partidos. */}
                    <table className="mt-1 w-full text-sm text-white/85">
                      <thead>
                        <tr className="text-left text-[11px] text-white/50">
                          <th className="py-0.5 pr-2 font-semibold">Jugador</th>
                          <th className="py-0.5 pr-2 font-semibold">Saca</th>
                          <th className="py-0.5 pr-2 text-right font-semibold">Acciones</th>
                          <th className="py-0.5 text-right font-semibold">Partidos suyos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lanzadoresWyscout.map((uno) => (
                          <tr key={`${uno.tipo}-${uno.nombre}`} className="border-t border-white/[0.06]">
                            <td className="py-1 pr-2">{nombreDeLanzador(uno.nombre)}</td>
                            <td className="py-1 pr-2 text-white/60">{uno.tipo === "corner" ? "córner" : "falta"}</td>
                            <td className="py-1 pr-2 text-right tabular-nums">{uno.total}</td>
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
                <table className="mt-1 w-full text-sm text-white/85">
                  <thead>
                    <tr className="text-left text-[11px] text-white/50">
                      <th className="py-0.5 pr-2 font-semibold">Jugador</th>
                      <th className="py-0.5 pr-2 text-right font-semibold">Altura</th>
                      <th className="py-0.5 text-right font-semibold">Remates ABP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rematanVisibles.map((uno) => (
                      <tr key={uno.nombre} className="border-t border-white/[0.06]">
                        <td className="py-1 pr-2">
                          {uno.nombre}
                          {titulares && esTitular(uno) === false && <span className="ml-1 text-[11px] text-white/50">fuera del once</span>}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">{alturaDe(uno) ? `${alturaDe(uno)} cm` : ""}</td>
                        <td className="py-1 text-right tabular-nums">{uno.remates > 0 ? uno.remates : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rematanVisibles.every((uno) => !(uno.remates > 0)) && (
                  <p className="mt-1 text-[11px] text-white/50">Ordenados por altura y etiqueta: no hay remates suyos contados en nuestras hojas.</p>
                )}
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
              ["Los que marca", goles.aFavor],
              ["Los que encaja", goles.enContra],
            ] as const).map(([titulo, g]) => (
              <div key={titulo} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{titulo}</p>

                <p className="mt-1 text-2xl font-black tabular-nums text-white">
                  {g.abp}
                  <span className="ml-2 text-sm font-normal text-white/45">
                    de {g.goles} goles en {g.partidos} partidos
                  </span>
                </p>

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
