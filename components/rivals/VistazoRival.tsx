"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ArrowUpRight, Goal, LayoutGrid, Trophy, UserX } from "lucide-react";

import { chipInk } from "@/lib/theme";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import type { TablasOpta } from "@/lib/cifras-equipo";
import { aspectosConCifraPrincipal } from "@/lib/rivals/cifra-principal";
import type { AspectoDestacado } from "@/lib/rivals/destacados-rival";
import type { JornadaDeEquipo } from "@/lib/rivals/orden-calendario";
import { balanceDe, fraseDelVistazo, MUESTRA_TENDENCIA, type ResultadoForma, type Vistazo } from "@/lib/rivals/vistazo";

/*
|--------------------------------------------------------------------------
| CÓMO LLEGA EL RIVAL (21/10/2026)
|--------------------------------------------------------------------------
|
| Una franja encima de la plantilla con lo que se pregunta antes que nada:
| dónde está en la tabla, cómo le va en el campo del partido, sus últimos
| resultados, el dibujo que saca y quién le hace los goles. Todo es BeSoccer
| (`rivals:informe`) y la pantalla ya lo tiene cargado.
|
| Lo que falta no se pinta: ni casilla vacía ni «sin dato». Si no hay nada, la
| franja no sale.
*/

/* Por debajo de estos minutos la lectura de un jugador es muestra corta (30/10/2026). */
const MUESTRA_CORTA = 500;

/* Los colores del resultado, los mismos verde/rojo del resto de la ficha. */
const COLOR_RESULTADO: Record<ResultadoForma["resultado"], string> = {
  G: "#34D399",
  E: "#C8A96B",
  P: "#F87171",
};

const PALABRA: Record<ResultadoForma["resultado"], string> = {
  G: "Ganó",
  E: "Empató",
  P: "Perdió",
};

function Casilla({
  titulo,
  children,
  pie,
  ancha = false,
  tendencia = false,
}: {
  titulo: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
  /** Muestra corta: chip «tendencia» junto al título, no dentro de la frase (16/11/2026, jueces de análisis). */
  tendencia?: boolean;
  /** En el móvil ocupa las dos columnas (la lista de goleadores). */
  ancha?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 ${ancha ? "col-span-2 md:col-span-1" : ""}`}>
      <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
        {titulo}
        {tendencia && (
          <span className="rounded-full border border-white/20 px-1.5 py-px text-[10px] font-semibold normal-case tracking-normal text-white/65" title="Muestra corta: se lee como tendencia, no como rasgo">
            tendencia
          </span>
        )}
      </p>

      <div className="mt-1 min-w-0">{children}</div>

      {/* Dos renglones antes que «El último: 2-0 en casa co…» en el móvil. A 13 px desde el 11/11/2026 (jueces, marketing): a 12 se perdía. */}
      {pie && <p className="mt-1 text-[13px] leading-snug text-white/60">{pie}</p>}
    </div>
  );
}

/** La cifra de un aspecto de Wyscout con su unidad: «47,3 %», «11,2». */
function cifraAspecto(valor: number, unidad: string) {
  if (!Number.isFinite(valor)) return "";
  const texto = valor.toLocaleString("es-ES", { maximumFractionDigits: unidad === "entero" ? 0 : 1 });

  return unidad === "porcentaje" ? `${texto} %` : unidad === "minutos" ? `${texto}′` : texto;
}

/*
| 11/11/2026 (jueces, fútbol): «Pérdidas: 123,5» y «Córners: 7,1» no decían de
| qué. Las cifras que son un recuento van «por partido»; las que ya son un
| cociente (PPDA, xG por remate, pases por ocasión, distancia de pase, goles
| menos xG) o un tanto por ciento, no.
*/
const NO_ES_RECUENTO = /ppda|por remate|por ocasi[oó]n|distancia|−|-\s*xg/i;

function porPartido(nombre: string, unidad: string) {
  return unidad !== "porcentaje" && unidad !== "minutos" && !NO_ES_RECUENTO.test(nombre) ? " por partido" : "";
}

/*
| Cómo se llama cada cifra en «balón parado en contra» (11/11/2026, jueces):
| son las de sus rivales, así que «Córners» es lo que concede y «Córners con
| remate %» lo que le rematan. Con su nombre de Wyscout se leía como suyo.
*/
function nombreDeFila(aspecto: string, nombre: string) {
  if (!/en contra/i.test(aspecto)) return nombre;
  if (/^córners con remate/i.test(nombre)) return "Córners rematados";
  if (/^córners$/i.test(nombre)) return "Córners concedidos";

  return `${nombre} (de sus rivales)`;
}

/*
| El puesto de UNA cifra entre los N equipos, con el sentido ya puesto en el
| percentil (1.º, el mejor). El aspecto entero es la media de sus cifras, y
| enseñar el puesto de la media junto a la primera cifra hacía decir «17.º» a
| un 7,1 que, solo, es el peor de los 20 (11/11/2026, jueces de fútbol).
*/
function puestoDeFila(f: { percentil: number; puesto?: number; de?: number }, equipos: number) {
  /* 16/11/2026: el puesto llega hecho del servidor (`puestoEnLiga`, lib/rivals/puesto-liga.ts), el mismo del Scout colectivo y de Área. */
  if (typeof f.puesto === "number" && f.puesto > 0) return f.puesto;

  return Math.min(equipos, Math.max(1, equipos - Math.round((f.percentil / 100) * equipos) + 1));
}

/*
| Lo más fuerte y lo más flojo del rival, con su cifra y su puesto (16/11/2026):
| sacado aquí para que el Plan de partido diga exactamente lo mismo que esta
| franja («fuerte en presión alta (PPDA 8,8, 2.º de 20)»).
*/
/**
 * En cada grupo (fuerte, flojo), primero el aspecto con la cifra más extrema
 * (16/11/2026, jueces de fútbol): el titular hablaba del balón parado en contra
 * y la tarjeta salía la segunda, plegada.
 */
export function ordenaAspectos<A extends { desviacion: number; filas: { percentil: number; puesto?: number; de?: number }[] }>(lista: A[], equipos: number): A[] {
  /* Cuánto le falta a su mejor cifra para la punta: 0 es el 1.º (fuerte) o el último (flojo). */
  const extremoDe = (a: A) =>
    Math.min(...a.filas.map((f) => (a.desviacion >= 0 ? puestoDeFila(f, equipos) - 1 : (f.de ?? equipos) - puestoDeFila(f, equipos))));

  return [...lista].sort((x, y) => {
    if (x.desviacion >= 0 !== y.desviacion >= 0) return x.desviacion >= 0 ? -1 : 1;
    return extremoDe(x) - extremoDe(y);
  });
}

/**
 * Lo más fuerte y lo más flojo del rival (lo lee también el Plan de partido).
 * Con `opta` (las tablas de `useOptaLigero().tablas`), el PPDA es el de Opta,
 * el mismo que enseña esta franja; sin él, el de Wyscout, rotulado.
 */
export function fuerteYFlojoDelRival(equipo: string, aspectosEntrada: AspectoDestacado[], equipos: number, opta?: TablasOpta | null) {
  const aspectos = ordenaAspectos(aspectosConCifraPrincipal(aspectosEntrada, equipo, opta ?? null, equipos), equipos);
  const extremo = (lista: AspectoDestacado[], mejor: boolean) =>
    lista
      .flatMap((a) => a.filas.map((f) => ({ a, f, puesto: puestoDeFila(f, equipos) })))
      .sort((x, y) => (mejor ? x.puesto - y.puesto : y.puesto - x.puesto))[0];
  const fuerte = equipos > 0 ? extremo(aspectos.filter((a) => a.desviacion >= 0), true) : undefined;
  const flojo = equipos > 0 ? extremo(aspectos.filter((a) => a.desviacion < 0), false) : undefined;
  const dato = (x: NonNullable<typeof fuerte>) =>
    `${x.a.aspecto.toLowerCase()} (${nombreDeFila(x.a.aspecto, x.f.nombre).replace(/ %$/, "")} ${cifraAspecto(x.f.valor, x.f.unidad)}, ${x.puesto}.º de ${x.f.de ?? equipos})`;
  /*
  | Una frase con verbo y UNA cifra (16/11/2026, jueces de marketing): las
  | demás van en las tarjetas. La cifra es la de lo flojo, que es por
  | donde se le ataca; sin flojo, la de lo fuerte.
  */
  const cifra = (x: NonNullable<typeof fuerte>) =>
    `${nombreDeFila(x.a.aspecto, x.f.nombre).replace(/ %$/, "")} ${cifraAspecto(x.f.valor, x.f.unidad)}, ${x.puesto}.º de ${x.f.de ?? equipos}`;
  const conDato =
    fuerte && flojo
      ? `${equipo} destaca en ${fuerte.a.aspecto.toLowerCase()}, pero flojea en ${flojo.a.aspecto.toLowerCase()} (${cifra(flojo)})`
      : fuerte
        ? `${equipo} destaca en ${fuerte.a.aspecto.toLowerCase()} (${cifra(fuerte)})`
        : flojo
          ? `${equipo} flojea en ${flojo.a.aspecto.toLowerCase()} (${cifra(flojo)})`
          : "";
  /* Su presión, con la misma cifra y el mismo puesto que esta franja (la fila de PPDA, si la hay). */
  const filaPpda = aspectos.flatMap((a) => a.filas).find((f) => /ppda/i.test(f.nombre));
  const ppda =
    filaPpda && equipos > 0
      ? { valor: cifraAspecto(filaPpda.valor, filaPpda.unidad), puesto: puestoDeFila(filaPpda, equipos), de: filaPpda.de ?? equipos, proveedor: filaPpda.proveedor, partidos: filaPpda.partidos ?? null }
      : null;
  return { conDato, fuerte: fuerte ? dato(fuerte) : "", flojo: flojo ? dato(flojo) : "", ppda };
}

/* Tres bloques a la vista; el resto, plegado (16/11/2026, jueces de marketing). */
const BLOQUES_A_LA_VISTA = 3;


export type AvisosRival = {
  fuera: { nombre: string; estado: string }[];
  apercibidos: { nombre: string; amarillas: number }[];
  rojas: { nombre: string; rojas: number }[];
};

export function VistazoRival({
  equipo,
  vistazo,
  jornada,
  aspectos: aspectosWyscout = [],
  equipos = 0,
  partidosWyscout = 0,
  avisos = null,
  dano = [],
  enlaces,
  abreJugador,
}: {
  /** Abre la ficha del jugador en la pantalla (16/11/2026): devuelve con qué abrirla, o `null` si no está en la plantilla. */
  abreJugador?: (nombre: string) => (() => void) | null;
  /** Dónde hacerles daño: jugadores con etiquetas de debilidad y rasgos flojos en Wyscout. */
  dano?: { nombre: string; puesto: string; rasgos: string[]; accion?: string; cifra?: string; base?: string; minutos?: number; contraste?: string }[];
  /** Bajas de la hoja, apercibidos y rojas de BeSoccer; `null` si no hay nada. */
  avisos?: AvisosRival | null;
  equipo: string;
  vistazo: Vistazo | null;
  jornada: JornadaDeEquipo | null;
  /** Lo que le hace distinto en Wyscout, contra la categoría. */
  aspectos?: AspectoDestacado[];
  /** De cuántos equipos es la categoría con la que se compara. */
  equipos?: number;
  /** Cuántos partidos suyos tiene Wyscout (la base de lo «por partido»); 0 si no se sabe. */
  partidosWyscout?: number;
  /** A otras pantallas de este mismo rival. */
  enlaces: { href: string; label: string }[];
}) {
  /*
  | UNA CIFRA POR MÉTRICA, LA QUE MANDA (16/11/2026, jueces de fútbol): el PPDA
  | es el de Opta (cociente de las sumas de la temporada) cuando Opta lo tiene,
  | con la cuenta común de `lib/rivals/cifra-principal.ts`; Wyscout queda como
  | 2.ª lectura en el detalle. Y en cada grupo, primero el aspecto más extremo.
  */
  const { tablas } = useOptaLigero();
  const aspectos = useMemo(
    () => ordenaAspectos(aspectosConCifraPrincipal(aspectosWyscout, equipo, tablas, equipos), equipos),
    [aspectosWyscout, equipo, tablas, equipos],
  );

  if (!vistazo && aspectos.length === 0) return null;

  const { tabla = null, enEseCampo = null, forma = [], dibujo = null, goleadores = [] } = vistazo ?? {};

  return (
    <section
      aria-label={`Cómo llega ${equipo}`}
      className="mt-6 min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4"
    >
      <header className="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
          Cómo llega {equipo}
        </h2>

        {jornada && !jornada.jugado && (
          /* «fuera» a secas no decía de quién: es dónde jugamos nosotros. */
          <p className="shrink-0 text-xs text-white/50">
            {jornada.titulo.replace(/ · (fuera|en casa)$/, " · jugamos $1")}
          </p>
        )}
      </header>

      {/* Primero la lectura, luego las cifras que la sostienen. Con lo flojo de Wyscout al final (10/11/2026, jueces): el titular dice dónde atacarle. */}
      {(() => {
        /* Sin repetir lo flojo (16/11/2026, jueces): ya lo dice la frase de arriba. */
        const titular = fraseDelVistazo(vistazo);

        /*
        | 16/11/2026 (jueces, marketing): un titular con la idea y el dato antes
        | que la descripción: «Real Murcia, fuerte en presión alta (PPDA 8,8,
        | 2.º de 20) y flojo en balón parado en contra (córners rematados
        | 44,6 %, 20.º de 20)». Sale de la cifra más extrema de cada lado.
        */
        const { conDato } = fuerteYFlojoDelRival(equipo, aspectos, equipos);

        return titular || conDato ? (
          <div className="mb-3 min-w-0">
            {conDato && <p className="text-base font-semibold text-white sm:text-lg">{conDato}.</p>}
            {titular && <p className="mt-0.5 text-sm font-medium text-white/80 sm:text-[15px]">{titular}</p>}
          </div>
        ) : null;
      })()}

      {vistazo && (
      <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {tabla && (
          <Casilla
            titulo="Clasificación"
            /* Con la referencia del grupo (30/10/2026, análisis). */
            pie={`${balanceDe(tabla)} · ${tabla.favor}-${tabla.contra} en goles${
              tabla.medianaFavor != null && tabla.medianaContra != null
                ? ` (mediana por equipo: ${tabla.medianaFavor}-${tabla.medianaContra}; en contra, menos es mejor)`
                : ""
            }`}
          >
            <p className="flex items-baseline gap-1.5">
              <Trophy size={13} className="shrink-0 self-center text-[#C8A96B]" aria-hidden />
              <span className="text-lg font-semibold tabular-nums">{tabla.puesto}.º</span>
              <span className="text-[13px] text-white/55">
                de {tabla.equipos} · {tabla.puntos} pts
              </span>
            </p>
          </Casilla>
        )}

        {enEseCampo && (
          <Casilla
            titulo={enEseCampo.donde === "fuera" ? "Lejos de casa" : "En su campo"}
            tendencia={enEseCampo.fila.jugados < Math.max(MUESTRA_TENDENCIA, 8)}
            pie={`${enEseCampo.fila.favor}-${enEseCampo.fila.contra} en goles · ${enEseCampo.fila.jugados} ${enEseCampo.fila.jugados === 1 ? "partido" : "partidos"}${
              /* 16/11/2026 (jueces de análisis): con menos de 8 partidos, tendencia. */
              ""
            }`}
          >
            {/* El balance en una sola línea y los puntos debajo: en el móvil «2V 0E 2D» se partía (07/11/2026). */}
            <p className="whitespace-nowrap text-lg font-semibold tabular-nums">{balanceDe(enEseCampo.fila)}</p>
            <p className="text-[13px] text-white/55">
              {enEseCampo.fila.puntos} de {enEseCampo.fila.jugados * 3} pts posibles
            </p>
          </Casilla>
        )}

        {forma.length > 0 && (
          <Casilla
            titulo={`Últimos ${forma.length} · el más reciente, a la derecha`}
            tendencia
            pie={`El último: ${forma[0].marcador} ${forma[0].enCasa ? "en casa" : "fuera"} con ${forma[0].rival}`}
          >
            {/* Del más antiguo al más reciente, de izquierda a derecha: así
                se lee la racha, como en cualquier tabla de forma. */}
            <ol className="flex items-center gap-1">
              {[...forma].reverse().map((r, i) => (
                <li
                  key={`${r.fecha}-${i}`}
                  title={`${r.fecha} · ${PALABRA[r.resultado]} ${r.marcador} ${r.enCasa ? "en casa" : "fuera"} contra ${r.rival}`}
                  aria-label={`${PALABRA[r.resultado]} ${r.marcador} contra ${r.rival}`}
                  className="flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-bold"
                  style={{
                    background: `${COLOR_RESULTADO[r.resultado]}26`,
                    color: chipInk(COLOR_RESULTADO[r.resultado]),
                  }}
                >
                  {r.resultado === "G" ? "V" : r.resultado === "E" ? "E" : "D"}
                </li>
              ))}
            </ol>
          </Casilla>
        )}

        {dibujo && (
          <Casilla
            titulo="Dibujo que más repite"
            /* Con menos de 15 alineaciones es tendencia, no costumbre (07/11/2026, análisis). */
            /* Sólo liga y con la fuente (16/11/2026, jueces): la misma cuenta que el campograma y el Scout colectivo. */
            tendencia={dibujo.de < 15}
            pie={`${dibujo.veces} de ${dibujo.de} ${dibujo.de === 1 ? "partido" : "partidos"} de liga (BeSoccer)`}
          >
            <p className="flex items-center gap-1.5">
              <LayoutGrid size={13} className="shrink-0 text-[#C8A96B]" aria-hidden />
              {/* Sin el «1-» del portero, como el selector del campograma (29/10/2026). */}
              <span className="text-lg font-semibold tabular-nums">{dibujo.estructura.replace(/^1-(?=\d-\d)/, "")}</span>
            </p>
          </Casilla>
        )}

        {goleadores.length > 0 && (
          <Casilla
            titulo="Le hacen los goles"
            tendencia={!!tabla && tabla.favor < 15}
            ancha
            /* La base: de cuántos goles y en cuántos partidos (07/11/2026, análisis). */
            pie={
              tabla && tabla.favor > 0
                ? `${goleadores.reduce((suma, g) => suma + g.goles, 0)} de sus ${tabla.favor} goles (${Math.round((100 * goleadores.reduce((suma, g) => suma + g.goles, 0)) / tabla.favor)} %) en ${tabla.jugados} ${tabla.jugados === 1 ? "partido" : "partidos"} · BeSoccer, todos los jugados (las pantallas de Wyscout pueden ir una jornada por detrás)`
                : undefined
            }
          >
            <ul className="min-w-0 space-y-0.5">
              {goleadores.map((g) => {
                const abre = abreJugador?.(g.nombre) ?? null;

                return (
                <li key={g.nombre} className="flex min-w-0 items-center gap-1.5 text-sm">
                  <Goal size={12} className="shrink-0 text-white/40" aria-hidden />
                  {abre ? (
                    <button type="button" onClick={abre} title={`Abrir la ficha de ${g.nombre}`} className="min-w-0 truncate text-left underline decoration-white/25 underline-offset-2 hover:decoration-[#C8A96B]">
                      {g.nombre}
                    </button>
                  ) : (
                    <span className="min-w-0 truncate">{g.nombre}</span>
                  )}
                  <span className="ml-auto shrink-0 font-semibold tabular-nums">{g.goles}</span>
                </li>
                );
              })}
            </ul>
          </Casilla>
        )}
      </div>

      )}

      {/*
        Bajas y apercibidos en una tira a lo ancho: en una casilla más de la
        rejilla los nombres se cortaban («F. C…»). Lo pidió el experto de fútbol.
      */}
      {avisos && (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Bajas y apercibidos</p>
          {avisos.fuera.map((uno) => (
            <span key={`f-${uno.nombre}`} className="flex items-center gap-1.5">
              <UserX size={12} className="shrink-0 text-[#F87171]" aria-hidden />
              {uno.nombre}
              <span className="text-[13px] text-white/55">{uno.estado}</span>
            </span>
          ))}
          {/* Con tres o más a una amarilla, una sola línea: repetir «a una amarilla del ciclo» cuatro veces era ruido (09/11/2026). */}
          {avisos.apercibidos.length >= 3 ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="h-3 w-2 shrink-0 rounded-[2px] bg-[#FACC15]" aria-hidden />
              {avisos.apercibidos.length} jugadores a una amarilla del ciclo
              <span className="text-[13px] text-white/60">
                {avisos.apercibidos.map((uno) => `${uno.nombre} (${uno.amarillas})`).join(", ")}
              </span>
            </span>
          ) : (
            avisos.apercibidos.map((uno) => (
              <span key={`a-${uno.nombre}`} className="flex items-center gap-1.5">
                <span className="h-3 w-2 shrink-0 rounded-[2px] bg-[#FACC15]" aria-hidden />
                {uno.nombre}
                <span className="text-[13px] text-white/55">a una amarilla del ciclo ({uno.amarillas})</span>
              </span>
            ))
          )}
          {avisos.rojas.map((uno) => (
            <span key={`r-${uno.nombre}`} className="flex items-center gap-1.5">
              <span className="h-3 w-2 shrink-0 rounded-[2px] bg-[#EF4444]" aria-hidden />
              {uno.nombre}
              <span className="text-[13px] text-white/55">
                {uno.rojas === 1 ? "una roja esta temporada" : `${uno.rojas} rojas esta temporada`}
              </span>
            </span>
          ))}
        </div>
      )}

      {aspectos.length > 0 && (
        <div className="mt-3 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
            Lo que le hace distinto · Wyscout, contra {equipos > 0 ? `los ${equipos} de` : ""} la categoría
          </p>

          {/* Primero la frase, luego los dos grupos: una lista de «p15 · p80» no se leía (guion, 21/10). */}
          {/* Sin la frase que repetía el titular (16/11/2026, jueces de fútbol): se abre con «Fuerte en» y «Flojo en». */}
          {/*
            El puesto se lee solo (08/11/2026, análisis): no hay que fiarse de «Fuerte/Flojo».
            11/11/2026 (jueces, marketing): una sola leyenda, en vez de «peor que 18 de los 20» en cada fila,
            y con la base de las cifras («por partido» en cuántos partidos de Wyscout).
          */}
          {equipos > 0 && (
            <p className="mb-2 text-[13px] text-white/60">
              Junto a cada cifra, su puesto entre los {equipos}: el 1.º es el mejor de la categoría; el {equipos}.º, el peor.
              {partidosWyscout > 0 ? ` Medias por partido en sus ${partidosWyscout} ${partidosWyscout === 1 ? "partido" : "partidos"} de Wyscout.` : ""}
              {(() => {
                /* Una sola cifra de presión y su porqué, en una línea (16/11/2026, jueces). */
                const ppda = aspectos.flatMap((x) => x.filas).find((f) => f.proveedor === "Opta" && /ppda/i.test(f.nombre));
                return ppda
                  ? ` El PPDA es el de Opta (la temporada: pases que deja dar entre acciones defensivas, sumados), el proveedor que manda en presión; Wyscout lo cuenta con otra definición${ppda.segunda ? ` y le da ${cifraAspecto(ppda.segunda.valor, ppda.unidad)}` : ""}.`
                  : "";
              })()}
            </p>
          )}

          {/*
            16/11/2026 (jueces): sólo entra lo que está entre los 6 primeros
            («Fuerte en») o los 6 últimos («Flojo en») de los 20 —el servidor
            ya manda sólo esas cifras—, y se ven tres bloques; el resto, plegado.
          */}
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {[
              { titulo: "Fuerte en", color: "#34D399", lista: aspectos.filter((a) => a.desviacion >= 0) },
              { titulo: "Flojo en", color: "#F87171", lista: aspectos.filter((a) => a.desviacion < 0) },
            ]
              .filter((grupo) => grupo.lista.length > 0)
              .map((grupo, i, grupos) => {
                /* Los tres primeros bloques entre los dos grupos, en el orden en que se leen. */
                const antes = grupos.slice(0, i).reduce((suma, g) => suma + g.lista.length, 0);
                /* Al menos uno de cada grupo a la vista: un «Flojo en» entero plegado no se ve. */
                const caben = Math.max(1, BLOQUES_A_LA_VISTA - antes);

                return { ...grupo, vista: grupo.lista.slice(0, caben), plegada: grupo.lista.slice(caben) };
              })
              .map((grupo) => (
                <div key={grupo.titulo} className="min-w-0">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: chipInk(grupo.color) }}>
                    {grupo.titulo}
                  </p>
                  {[grupo.vista, grupo.plegada].map((lista, plegada) => {
                    if (lista.length === 0) return null;

                    const filas = (
                  <ul className="grid min-w-0 gap-1.5">
                    {lista.map((a) => (
                      <li
                        key={a.aspecto}
                        title={`${a.explica}. ${a.filas.map((f) => `${f.nombre}: p${f.percentil}`).join(" · ")}`}
                        className="flex min-w-0 flex-col gap-0.5 rounded-2xl border px-3 py-1.5 text-sm"
                        style={{ borderColor: `${grupo.color}55`, background: `${grupo.color}14` }}
                      >
                        <span className="min-w-0 break-words font-medium">{a.aspecto}</span>
                        {/*
                          Todas las cifras del aspecto, cada una con SU puesto (11/11/2026, jueces de fútbol):
                          el puesto del aspecto es la media de dos o tres cifras y, junto a la primera sola,
                          decía «17.º» de un 7,1 que en Su balón parado sale el peor de los 20.
                        */}
                        {a.filas.map((f) => (
                          <span key={f.nombre} className="text-[13px] leading-snug tabular-nums text-white/70">
                            {nombreDeFila(a.aspecto, f.nombre)}: <b className="font-semibold text-white/85">{cifraAspecto(f.valor, f.unidad)}</b>
                            {porPartido(f.nombre, f.unidad)} · mediana {cifraAspecto(f.mediana, f.unidad)}
                            {equipos > 0 ? ` · ${puestoDeFila(f, equipos)}.º de ${f.de ?? equipos}` : ""}
                            {/* La base y el proveedor (16/11/2026, jueces de fútbol): «25 de 56 en 12 partidos», «Opta». */}
                            {f.base && f.unidad === "porcentaje" ? ` · ${Math.round(f.base.arriba)} de ${Math.round(f.base.abajo)}${f.partidos ? ` en ${f.partidos} partidos` : ""}` : ""}
                            {f.proveedor === "Opta" ? " · Opta" : ""}
                            {/ppda/i.test(f.nombre) ? " (pases que deja dar antes de presionar: menos es más presión)" : ""}
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                    );

                    return plegada ? (
                      <details key="plegada" className="mt-1.5 min-w-0">
                        <summary className="cursor-pointer text-[13px] text-white/60 hover:text-white">
                          {/* Que diga qué hay dentro (16/11/2026, jueces de fútbol). */}
                          {/* Con su cifra y su puesto (16/11/2026, ronda 18): «cuidado del balón» a secas no decía nada. */}
                          {`${grupo.titulo === "Fuerte en" ? (lista.length === 1 ? "Otro punto fuerte" : "Otros puntos fuertes") : lista.length === 1 ? "Otro punto flojo" : "Otros puntos flojos"}: ${lista
                            .map((x) => {
                              const f = x.filas[0];
                              return f
                                ? `${x.aspecto.toLowerCase()} (${nombreDeFila(x.aspecto, f.nombre).toLowerCase()} ${cifraAspecto(f.valor, f.unidad)}${equipos > 0 ? `, ${puestoDeFila(f, equipos)}.º de ${f.de ?? equipos}` : ""})`
                                : x.aspecto.toLowerCase();
                            })
                            .join(", ")}`}
                        </summary>
                        <div className="mt-1.5">{filas}</div>
                      </details>
                    ) : (
                      <div key="vista">{filas}</div>
                    );
                  })}
                </div>
              ))}
          </div>
        </div>
      )}

      {dano.length > 0 && (
        <div className="mt-3 min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Dónde hacerles daño</p>

          {/*
            30/10/2026: la base va en su propia línea debajo de la frase («485′ ·
            6 partidos · muestra corta: menos de 500′»). Pegada al final se leía
            «primer pase485′». Los minutos son los de la plantilla (BeSoccer).
          */}
          <ul className="min-w-0 space-y-2 text-sm text-white/80">
            {dano.map((uno) => (
              <li key={uno.nombre} className="min-w-0">
                <p>
                  {(() => {
                    const abre = abreJugador?.(uno.nombre) ?? null;

                    return abre ? (
                      <button type="button" onClick={abre} title={`Abrir la ficha de ${uno.nombre}`} className="font-semibold text-white underline decoration-white/25 underline-offset-2 hover:decoration-[#C8A96B]">
                        {uno.nombre}
                      </button>
                    ) : (
                      <b className="font-semibold text-white">{uno.nombre}</b>
                    );
                  })()}
                  {uno.puesto ? <span className="text-white/55"> ({uno.puesto})</span> : null}: {uno.rasgos.join(" y ")}.
                </p>
                {/* La consigna nuestra, en su renglón y con su nombre (11/11/2026, jueces de marketing): «→ presionar» se perdía al final de la frase. */}
                {uno.accion ? (
                  <p className="mt-0.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: chipInk("#C8A96B") }}>
                      Qué hacemos
                    </span>{" "}
                    <span className="text-white/85">{uno.accion.charAt(0).toUpperCase() + uno.accion.slice(1)}.</span>
                  </p>
                ) : null}
                {uno.cifra ? <p className="mt-0.5 text-[13px] tabular-nums text-white/75">{uno.cifra}</p> : null}
                {uno.base ? (
                  <p className="mt-0.5 text-[13px] tabular-nums text-white/55">
                    {uno.base}
                    {(uno.minutos ?? 0) > 0 && (uno.minutos ?? 0) < MUESTRA_CORTA ? ` · muestra corta: menos de ${MUESTRA_CORTA}′` : ""}
                  </p>
                ) : null}
                {uno.contraste ? <p className="mt-0.5 text-[13px] text-[#C8A96B]">{uno.contraste}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {enlaces.length > 0 && (
        /* Un solo bloque de accesos, cada uno con su verbo (16/11/2026, jueces de marketing). */
        <nav aria-label="Más de este rival" className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          <p className="mr-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Más de {equipo}</p>
          {enlaces.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[13px] text-white/75 transition hover:border-[#C8A96B] hover:text-white"
            >
              {e.label}
              <ArrowUpRight size={12} aria-hidden />
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}

export default VistazoRival;
