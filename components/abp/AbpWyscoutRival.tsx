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
function consignaOfensiva(aspecto: Aspecto, equipos: number) {
  if (aspecto.clave !== "abpDef") return "";

  const peor = (fila: Fila | undefined) => (fila && fila.mejorAlto === false && fila.percentil <= 20 ? fila : null);
  const corners = peor(aspecto.filas.find((f) => f.nombre === "Córners"));
  const conRemate = peor(aspecto.filas.find((f) => f.nombre === "Córners con remate %"));
  const partes: string[] = [];

  if (corners) {
    partes.push(
      `Concede ${cifra1(corners.valor, corners.unidad)} córners por partido (mediana ${cifra1(corners.mediana, corners.unidad)}; ${lectura(corners.percentil, equipos, false).texto}): llegar a línea de fondo y forzar córner; preparar dos rutinas de córner ofensivo.`,
    );
  }

  if (conRemate) {
    partes.push(
      `Le rematan el ${cifra1(conRemate.valor, conRemate.unidad)} de los córners (mediana ${cifra1(conRemate.mediana, conRemate.unidad)}; ${lectura(conRemate.percentil, equipos, false).texto}): cargar el área con nuestros mejores rematadores en cada córner.`,
    );
  }

  return partes.join(" ");
}

/** La lectura de los centros: qué hacemos según cuánto centra y con qué acierto. */
/*
| 30/10/2026: «Qué hacemos» con los centros va en dos frases, cada una con su
| sentido y su cifra: cuando nos centran (sus centros) y cuando les centramos
| (los que recibe). Antes era una sola frase que juntaba defensa y ataque.
*/
function queHacemosConCentros(aspectos: Aspecto[]): { nosCentran: string; lesCentramos: string } {
  const filas = aspectos.flatMap((a) => a.filas);
  const volumen = filas.find((f) => f.nombre === "Centros laterales");
  const acierto = filas.find((f) => f.nombre === "Centros precisos %");
  const recibe = filas.find((f) => f.nombre === "Centros que recibe");

  if (!volumen || !acierto) return { nosCentran: "", lesCentramos: "" };

  const muchos = volumen.valor > volumen.mediana;
  /* 29/10/2026: «bien» o «mal» sólo si el acierto se separa de la mediana más de
     2 puntos; con 33,8 % frente a 33,9 % no es poco, es lo de la liga. */
  const dif = acierto.valor - acierto.mediana;
  const bien = dif > 2;
  const mal = dif < -2;

  /* La cifra que sostiene la consigna, con su mediana. */
  const cifra = ` (${cifra1(volumen.valor, volumen.unidad)} centros por partido frente a una mediana de ${cifra1(volumen.mediana, volumen.unidad)}; acierto ${cifra1(acierto.valor, acierto.unidad)} frente a ${cifra1(acierto.mediana, acierto.unidad)})`;

  let propio: string;

  if (muchos && bien) propio = `centra mucho y con acierto: cerrar el carril exterior y proteger el segundo palo${cifra}.`;
  else if (muchos && mal) propio = `centra mucho y acierta poco: dejarle centrar y ganar el área, sin perseguir el balón hasta la banda${cifra}.`;
  else if (muchos) propio = `centra mucho, con un acierto como el de la liga: cerrar el carril exterior y ganar el área${cifra}.`;
  else if (bien) propio = `centra poco pero con acierto: cuando lo hace, tapar al rematador del segundo palo${cifra}.`;
  else if (mal) propio = `centra poco y mal: cerrar el pase interior antes que el centro${cifra}.`;
  else propio = `centra poco, con un acierto como el de la liga: cerrar el pase interior antes que el centro${cifra}.`;

  /* Lo que recibe (menos es mejor): si es más que la mediana, se le ataca por fuera. */
  const lesCentramos =
    recibe && recibe.valor > recibe.mediana
      ? `atacarle por fuera, con extremo y lateral doblando y tres hombres en el área (recibe ${cifra1(recibe.valor, recibe.unidad)} centros por partido; mediana ${cifra1(recibe.mediana, recibe.unidad)}).`
      : "";

  return { nosCentran: propio.charAt(0).toUpperCase() + propio.slice(1), lesCentramos };
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
  const lanzanDeTipo = (tipo: Lanzador["tipo"]) =>
    lanzadoresWyscout.filter((uno) => uno.tipo === tipo);
  const textoLanzadores = (tipo: Lanzador["tipo"]) =>
    lanzanDeTipo(tipo)
      .map((uno) => `${nombreDeLanzador(uno.nombre)} (${uno.total} en ${uno.partidos} partidos)`)
      .join(", ");

  const sacan: { nombre: string }[] =
    sacanEtiquetados.length > 0
      ? sacanEtiquetados
      : [...new Set(lanzadoresWyscout.map((uno) => nombreDeLanzador(uno.nombre)))].map((nombre) => ({ nombre }));
  const lanzaDeWyscout = sacanEtiquetados.length === 0 && sacan.length > 0;

  /* La consigna sale de lo etiquetado: marcar al más alto de los rematadores y vigilar al que saca. */
  const alturaDe = (uno: RivalPlayerAerial) => Number(uno.altura) || 0;
  const conCm = (uno: RivalPlayerAerial) => `${uno.nombre}${alturaDe(uno) ? ` (${alturaDe(uno)} cm)` : ""}`;
  const porAltura = (lista: RivalPlayerAerial[]) => [...lista].sort((a, b) => alturaDe(b) - alturaDe(a));

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
  const masAlto = titulares ? titularesQueRematan[0] : porAltura(rematan)[0];
  const consigna = [
    masAlto ? `emparejar a nuestro central más alto con ${conCm(masAlto)} en el córner` : "",
    ...rematanFuera.slice(0, 2).map((uno) => `si entra ${conCm(uno)}: nuestro central más alto con él`),
    sacan.length > 0 ? `vigilar la trayectoria de ${sacan.map((uno) => uno.nombre).join(" y ")} en el saque` : "",
  ]
    .filter(Boolean)
    .join("; ");

  const hayGoles = !!goles && (goles.aFavor.abp > 0 || goles.enContra.abp > 0);

  if (aspectos.length === 0 && !hayGoles && rematan.length === 0 && sacan.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {aspectos.length > 0 && (
        <Panel
          title={ambito === "area" ? "Sus centros laterales, los que hace y los que recibe, según Wyscout" : "Su balón parado según Wyscout"}
          subtitle={`${equipo} frente a los ${datos?.equipos ?? 20} equipos de la liga${(datos?.equipos ?? 20) === 20 ? ", el Castilla incluido" : ""}. «Mejor» y «peor» ya tienen en cuenta el sentido de cada cifra; «de cada 10» compara siempre con esos equipos, y «x de y» es la cantidad real que hay detrás de cada porcentaje.`}
          icon={BarChart3}
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {aspectos.map((aspecto) => (
              <div key={aspecto.clave} className="min-w-0">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  {aspecto.aspecto}
                  {aspecto.filas[0]?.partidos != null && (
                    <span className="ml-2 font-normal normal-case tracking-normal italic text-white/45">
                      {aspecto.filas[0].partidos < 10
                        ? `tendencia, ${aspecto.filas[0].partidos} partidos`
                        : `en ${aspecto.filas[0].partidos} partidos`}
                    </span>
                  )}
                </h3>

                <ul className="mt-2 space-y-2">
                  {aspecto.filas.map(orientada).map((fila) => {
                    const lee = lectura(fila.percentil, datos?.equipos ?? 20, fila.mejorAlto);

                    return (
                      <li
                        key={fila.nombre}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <span className="min-w-0 text-sm text-white/80">
                          {rotuloDe(fila)}
                          {/* También las que no son ni mejores ni peores (30/10/2026): sin etiqueta parecía un olvido. */}
                          <span className="ml-2 text-[11px] font-normal text-white/40">
                            {fila.mejorAlto == null ? "ni mejor ni peor: dice cuánto pesa" : fila.mejorAlto ? "más es mejor" : "menos es mejor"}
                          </span>
                        </span>

                        <span className="text-sm font-semibold tabular-nums text-white">
                          {cifra1(fila.valor, fila.unidad)}
                          {/* La unidad también en balón parado: «5,4 por partido» (30/10/2026). */}
                          {fila.unidad !== "porcentaje" && (
                            <span className="ml-1 text-[11px] font-normal text-white/55">por partido</span>
                          )}
                          {ambito === "area" && fila.partidos != null && (
                            <span className="ml-2 text-[11px] font-normal text-white/55">
                              en {fila.partidos} {fila.partidos === 1 ? "partido" : "partidos"}
                              {fila.partidos < 6 ? " · tendencia, pocos partidos" : ""}
                            </span>
                          )}
                          {fila.unidad === "porcentaje" && fila.base && (
                            <span className="ml-2 text-[11px] font-normal text-white/55">
                              {Math.round(fila.base.arriba)} de {Math.round(fila.base.abajo)}
                            </span>
                          )}
                          <span className="ml-2 text-[11px] font-normal text-white/40">
                            mediana {cifra1(fila.mediana, fila.unidad)}
                          </span>
                        </span>

                        <span
                          className="w-full text-[11px]"
                          style={{
                            color:
                              lee.bueno === true
                                ? "var(--rmcf-rate-good, #15803D)"
                                : lee.bueno === false
                                  ? "var(--rmcf-rate-low, #DC2626)"
                                  : undefined,
                          }}
                        >
                          {lee.texto}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {consignaOfensiva(aspecto, datos?.equipos ?? 20) && (
                  <p className="mt-2 text-sm text-white/85">
                    <b className="text-white">Qué hacemos: </b>
                    {consignaOfensiva(aspecto, datos?.equipos ?? 20)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {ambito === "area" && (() => {
            const { nosCentran, lesCentramos } = queHacemosConCentros(aspectos);

            if (!nosCentran && !lesCentramos) return null;

            return (
              <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-sm text-white/85">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Qué hacemos</p>
                {nosCentran && (
                  <p>
                    <b className="text-white">Cuando nos centran: </b>
                    {nosCentran}
                  </p>
                )}
                {lesCentramos && (
                  <p>
                    <b className="text-white">Cuando les centramos: </b>
                    {lesCentramos}
                  </p>
                )}
              </div>
            );
          })()}
        </Panel>
      )}

      {onceListo && wyscoutListo && plantilla.length > 0 && (rematan.length > 0 || sacan.length > 0) && (
        <Panel
          title={sacan.length > 0 && rematan.length > 0 ? "Quién lo lanza y quién remata" : sacan.length > 0 ? "Quién lo lanza" : "Quién remata"}
          subtitle={`${lanzaDeWyscout ? "Lanzamientos de la temporada según Wyscout; rematan, según las etiquetas de la plantilla" : "Según las etiquetas de la plantilla"}${titulares ? ", cruzadas con el once probable marcado en Plantillas rivales" : ""}`}
          icon={BarChart3}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sacan.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Lanzan</p>
                {lanzaDeWyscout ? (
                  <div className="mt-1 space-y-0.5 text-sm text-white/85">
                    {textoLanzadores("corner") && <p>Córner: {textoLanzadores("corner")}</p>}
                    {textoLanzadores("falta") && <p>Falta: {textoLanzadores("falta")}</p>}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-white/85">{sacan.map((uno) => uno.nombre).join(", ")}</p>
                )}
              </div>
            )}

            {rematanVisibles.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Rematan</p>
                <p className="mt-1 text-sm text-white/85">
                  {titulares
                    ? [
                        titularesQueRematan.length ? `Titulares: ${titularesQueRematan.map(conCm).join(", ")}` : "",
                        rematanFuera.length ? `Fuera del once probable: ${rematanFuera.map(conCm).join(", ")}` : "",
                      ]
                        .filter(Boolean)
                        .join(". ")
                    : rematan.map(conCm).join(", ")}
                </p>
              </div>
            )}
          </div>

          {consigna && (
            <p className="mt-3 border-t border-white/10 pt-3 text-sm text-white/85">
              <b className="text-white">Qué hacemos: </b>
              {consigna}
            </p>
          )}
        </Panel>
      )}

      {hayGoles && goles && (
        <Panel
          title="Goles a balón parado esta temporada"
          subtitle="Penaltis y goles, del marcador; el reparto entre córner y falta es una ESTIMACIÓN calibrada con Opta, no un dato contado"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {([
              ["Los que marca · más es mejor", goles.aFavor],
              ["Los que encaja · menos es mejor", goles.enContra],
            ] as const).map(([titulo, g]) => (
              <div key={titulo} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{titulo}</p>

                <p className="mt-1 text-2xl font-black tabular-nums text-white">
                  {g.abp}
                  <span className="ml-2 text-sm font-normal text-white/45">
                    de {g.goles} goles en {g.partidos} partidos
                  </span>
                </p>

                {(g.goles < 10 || g.partidos < 10) && (
                  <p className="mt-0.5 text-[11px] italic text-white/50">Tendencia, pocos casos: no lo damos por hecho.</p>
                )}

                {g.hayOrigen && g.abp > 0 && (
                  <p className="mt-1 text-[12px] text-white/55">
                    {[
                      g.penalti > 0 ? `${g.penalti} de penalti` : "",
                      g.corner > 0 ? `${g.corner} de córner (estimado)` : "",
                      g.falta > 0 ? `${g.falta} de falta (estimado)` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

export default AbpWyscoutRival;
