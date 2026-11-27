"use client";

import { EnlacesAmenaza, useAmenazaDelRival } from "@/components/rivals/AmenazaDelRival";
import Link from "next/link";
import { useMemo, useState } from "react";

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

/* Por debajo de estos minutos la lectura de un jugador es muestra corta (30/10/2026).
   27/11/2026 (ronda 10, fútbol): 450′, el mismo corte del campograma y de Duelos (antes 500). */
const MUESTRA_CORTA = 450;

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
          <span className="rounded-full border border-white/20 px-1.5 py-px text-[12px] font-semibold normal-case tracking-normal text-white/65" title="Muestra corta: se lee como tendencia, no como rasgo">
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
  /* Con el menos tipográfico (27/11/2026, ronda 10, fútbol): «Goles − xG −0,8», no «-0,8». */
  const texto = valor.toLocaleString("es-ES", { maximumFractionDigits: unidad === "entero" ? 0 : 1 }).replace(/^-/, "−");

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


/** Una línea de «Dónde hacerles daño» (o «dónde nos lo hacen»): el jugador, su orden y lo que la sostiene. */
export type Dano = {
  nombre: string;
  puesto: string;
  rasgos: string[];
  accion?: string;
  cifra?: string;
  base?: string;
  minutos?: number;
  contraste?: string;
  /** La orden es defensiva: el duelo se pierde con su balón (17/11/2026). */
  enContra?: boolean;
  /** El duelo de /duelos del que sale la orden, por piezas. */
  duelo?: { titulo: string; conBalon: number | null; sinBalon: number | null; tarea: string; objetivo: string; base: string };
  /** Es el duelo que decide (lib/duelos.ts, `dueloQueDecide`): el mismo que abre el Plan y Duelos (20/11/2026, ronda 7). */
  decide?: boolean;
};

/*
| DOS RENGLONES Y «VER MÁS» (20/11/2026, ronda 7, marketing): las explicaciones
| largas de «Dónde nos hacen daño» se cortan a dos líneas; el resto, al tocar.
*/
function DosLineas({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className={`min-w-0 ${className}`}>
      <p className={abierto ? "" : "line-clamp-2"}>{children}</p>
      <button type="button" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} className="min-h-7 text-[12px] font-semibold text-white/65 underline-offset-2 hover:text-white hover:underline">
        {abierto ? "Ver menos" : "Ver más"}
      </button>
    </div>
  );
}

/* El chip del duelo, en palabras, y su explicación en dos renglones. */
function ChipDuelo({ d, equipo, decide }: { d: NonNullable<Dano["duelo"]>; equipo: string; decide?: boolean }) {
  if (d.conBalon == null && d.sinBalon == null) return null;

  return (
    <>
      <p className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
        {decide && (
          <span className="rounded-full border border-[#F87171]/60 px-2 py-px text-[12px] font-bold text-red-300" title="El duelo con la cifra más despegada (lib/duelos.ts): el mismo que abre el Plan de partido y Duelos">
            el que decide, como en el Plan
          </span>
        )}
        <span className="rounded-full border border-white/15 px-2 py-px text-[12px] font-semibold tabular-nums text-white/80" title="El duelo de Duelos, en diferencia de percentil: + a favor del Castilla, − a favor del rival">
          {[
            d.conBalon != null ? `con nuestro balón: ${d.conBalon >= 10 ? "ventaja Castilla" : d.conBalon <= -10 ? `ventaja ${equipo}` : "parejo"} (${signoDuelo(d.conBalon)})` : "",
            d.sinBalon != null ? `con el suyo: ${d.sinBalon >= 10 ? "ventaja Castilla" : d.sinBalon <= -10 ? `ventaja ${equipo}` : "parejo"} (${signoDuelo(d.sinBalon)})` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </p>
      <DosLineas className="mt-0.5 text-[12px] text-white/55">
        Duelo «{d.titulo.toLowerCase()}»: los + y − son puntos de percentil de los nuestros del duelo frente a los suyos de {equipo}, cada uno contra su puesto en la categoría (Wyscout); + es ventaja nuestra.
      </DosLineas>
    </>
  );
}

/** El mismo jugador dicho de dos formas («Jorge Mier» y «J. Mier»): por el último apellido. */
const mismoApellido = (a: string, b: string) => {
  const ultimo = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().split(/\s+/).pop() ?? "";
  return Boolean(ultimo(a)) && ultimo(a) === ultimo(b);
};

const signoDuelo = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}`;

function TarjetaDano({ uno, color, equipo, abre }: { uno: Dano; color: string; equipo: string; abre: (() => void) | null }) {
  const accion = uno.accion ? uno.accion.charAt(0).toUpperCase() + uno.accion.slice(1) : "";
  const d = uno.duelo;

  return (
    <li className="min-w-0 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${color}44`, background: `${color}0f` }}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <p className="min-w-0">
          {abre ? (
            <button type="button" onClick={abre} title={`Abrir la ficha de ${uno.nombre}`} className="font-semibold text-white underline decoration-white/25 underline-offset-2 hover:decoration-[#C8A96B]">
              {uno.nombre}
            </button>
          ) : (
            <b className="font-semibold text-white">{uno.nombre}</b>
          )}
          {uno.puesto ? <span className="text-white/55"> · {uno.puesto}</span> : null}
        </p>
      </div>
      {/*
        18/11/2026 (ronda 23, fútbol): «+20 / −33» sin decir qué es. La cifra se
        explica en el propio rótulo: puntos de percentil, los nuestros del duelo
        menos los suyos, cada uno frente a los de su puesto en la categoría.
        17/11/2026 (ronda 20): en palabras, no «nuestro balón +20 · el suyo −33».
        20/11/2026 (ronda 7): el chip, bajo el nombre; la explicación, en dos
        renglones con «Ver más»; y el duelo que decide, rotulado.
      */}
      {d && <ChipDuelo d={d} equipo={equipo} decide={uno.decide} />}

      {/* La orden, en una línea y la primera (17/11/2026, jueces de marketing). */}
      {accion && <p className="mt-1 font-medium text-white">{accion}.</p>}
      {uno.rasgos.length > 0 && <p className="mt-0.5 text-[13px] text-white/65">{uno.rasgos.join(" y ").replace(/^./, (c) => c.toUpperCase())}.</p>}
      {uno.cifra ? <p className="mt-0.5 text-[13px] tabular-nums text-white/75">{uno.cifra}</p> : null}
      {/* La base, en el mismo formato en todas las tarjetas: «Base: 1180′ en Wyscout · 12 partidos». */}
      {uno.base ? (
        /* 27/11/2026 (ronda 10, análisis): la base sola («662′ en Wyscout · 8 partidos»); la muestra corta, en su chip. */
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] tabular-nums text-white/55">
          <span>Base: {uno.base}</span>
          {(uno.minutos ?? 0) > 0 && (uno.minutos ?? 0) < MUESTRA_CORTA && (
            <span className="rounded-full border border-white/20 px-1.5 py-px text-[12px] font-semibold text-white/65" title={`Menos de ${MUESTRA_CORTA}′ en Wyscout: se lee como tendencia`}>
              muestra corta
            </span>
          )}
        </p>
      ) : null}
      {uno.contraste ? <p className="mt-0.5 text-[13px]" style={{ color: "var(--rmcf-gold-ink, #C8A96B)" }}>{uno.contraste}</p> : null}

      {/* «Su duelo» a la vista en las dos cajas (17/11/2026, ronda 20, análisis). */}
      {d && (
        <Link href={`/duelos?equipo=${encodeURIComponent(equipo)}`} className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold underline-offset-2 hover:underline" style={{ color: "var(--rmcf-gold-ink, #C8A96B)" }}>
          Su duelo <ArrowUpRight size={12} aria-hidden />
        </Link>
      )}
      {d && (d.tarea || d.objetivo) && (
        <details className="mt-1 min-w-0">
          <summary className="cursor-pointer text-[13px] font-semibold text-white/65 hover:text-white">Ver el duelo</summary>
          <div className="mt-1 space-y-0.5 text-[13px] text-white/70">
            <p>«{d.titulo}», el mismo de Duelos y del Plan de partido.</p>
            {d.tarea && <p><b className="font-semibold text-white/85">Tarea:</b> {d.tarea}.</p>}
            {d.objetivo && <p><b className="font-semibold text-white/85">Objetivo:</b> {d.objetivo}.</p>}
            {d.base && <p className="text-[12px] text-white/55">{d.base}.</p>}
            <Link href={`/duelos?equipo=${encodeURIComponent(equipo)}`} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline" style={{ color: "var(--rmcf-gold-ink, #C8A96B)" }}>
              Abrir en Duelos <ArrowUpRight size={12} aria-hidden />
            </Link>
          </div>
        </details>
      )}
    </li>
  );
}

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
  nombreDe,
  fuenteDibujo = "BeSoccer",
}: {
  /** El nombre de su ficha de la plantilla para uno de otra fuente («Manín» de BeSoccer → «Manin»), 27/11/2026, ronda 10. */
  nombreDe?: (nombre: string) => string;
  /** De dónde sale el dibujo que más repite (17/11/2026: Wyscout en /rivals, el mismo del campograma). */
  fuenteDibujo?: string;
  /** Abre la ficha del jugador en la pantalla (16/11/2026): devuelve con qué abrirla, o `null` si no está en la plantilla. */
  abreJugador?: (nombre: string) => (() => void) | null;
  /** Dónde hacerles daño: jugadores con etiquetas de debilidad y rasgos flojos en Wyscout. */
  dano?: Dano[];
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
  /*
  | 17/11/2026 (ronda 20, fútbol): «Dónde nos hacen daño» sale primero de su
  | amenaza con balón (quién suma su xG, por dónde centra), la misma cuenta que
  | «Cómo nos hacen daño» del Scout colectivo y el Plan de partido.
  */
  const amenaza = useAmenazaDelRival(equipo);
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

        /*
        | 18/11/2026 (jueces de marketing): la conclusión ya va en la cabecera de
        | /rivals (la misma cuenta: «con dato» si lo hay; si no, esta frase). Aquí
        | no se repite: sólo la descripción, cuando la cabecera dijo la otra.
        */
        return titular && conDato ? (
          <div className="mb-3 min-w-0">
            <p className="text-sm font-medium text-white/80 sm:text-[15px]">{titular}</p>
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
            pie={`${dibujo.veces} de ${dibujo.de} ${dibujo.de === 1 ? "partido" : "partidos"} de liga (${fuenteDibujo})`}
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
                ? /* Una línea (17/11/2026, ronda 20, marketing): la salvedad de Opta, al pasar el ratón. */
                  <span title="BeSoccer, todos los jugados. «Sus goles en vídeo» cuenta con Opta, que puede dar algún gol a otro jugador (un rebote o un remate desviado).">
                    {goleadores.reduce((suma, g) => suma + g.goles, 0)} de sus {tabla.favor} goles en {tabla.jugados} {tabla.jugados === 1 ? "partido" : "partidos"} (BeSoccer)
                  </span>
                : undefined
            }
          >
            <ul className="min-w-0 space-y-0.5">
              {goleadores.map((g) => {
                const abre = abreJugador?.(g.nombre) ?? null;
                /* El de la ficha, como en el campograma y las tarjetas (27/11/2026, ronda 10, fútbol). */
                const visto = nombreDe?.(g.nombre) || g.nombre;

                return (
                <li key={g.nombre} className="flex min-w-0 items-center gap-1.5 text-sm">
                  <Goal size={12} className="shrink-0 text-white/40" aria-hidden />
                  {abre ? (
                    <button type="button" onClick={abre} title={`Abrir la ficha de ${visto}`} className="min-w-0 truncate text-left underline decoration-white/25 underline-offset-2 hover:decoration-[#C8A96B]">
                      {visto}
                    </button>
                  ) : (
                    <span className="min-w-0 truncate">{visto}</span>
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
            {/* Una sola fórmula de población, como la portada (18/11/2026, ronda 23): «grupo de 20 equipos». */}
            Lo que le hace distinto · frente a su {equipos > 0 ? `grupo de ${equipos} equipos` : "grupo"}
          </p>

          {/* Primero la frase, luego los dos grupos: una lista de «p15 · p80» no se leía (guion, 21/10). */}
          {/* Sin la frase que repetía el titular (16/11/2026, jueces de fútbol): se abre con «Fuerte en» y «Flojo en». */}
          {/*
            El puesto se lee solo (08/11/2026, análisis): no hay que fiarse de «Fuerte/Flojo».
            11/11/2026 (jueces, marketing): una sola leyenda, en vez de «peor que 18 de los 20» en cada fila,
            y con la base de las cifras («por partido» en cuántos partidos de Wyscout).
          */}
          {equipos > 0 && (
            /*
              18/11/2026 (ronda 23, fútbol y marketing): una línea a la vista y la
              metodología (medias, el PPDA de Opta frente al de Wyscout) en «Ver base».
            */
            /* 20/11/2026 (ronda 5, marketing): la leyenda larga, también dentro de «Ver base». */
            <div className="mb-2 text-[13px] text-white/60">
              <details className="min-w-0">
                <summary className="cursor-pointer text-[12px] font-semibold text-white/55 hover:text-white">Ver base: cómo se lee cada barra</summary>
                <p className="mt-0.5 text-[13px] text-white/60">
                  El punto es el rival y la raya, la mediana del grupo: a la derecha, mejor. «1.º de {equipos}», el mejor del grupo.
                </p>
                <p className="mt-0.5 text-[12px] text-white/55">
                  Wyscout, esta temporada, frente a los {equipos} equipos del grupo.
                  {partidosWyscout > 0 ? ` Medias por partido en sus ${partidosWyscout} ${partidosWyscout === 1 ? "partido" : "partidos"} de Wyscout.` : ""}
                  {(() => {
                    const ppda = aspectos.flatMap((x) => x.filas).find((f) => f.proveedor === "Opta" && /ppda/i.test(f.nombre));
                    return ppda
                      ? ` El PPDA es el de Opta: pases que deja dar al rival entre acciones defensivas, sumados en la temporada (menos es más presión); es el proveedor que manda en presión. Wyscout lo cuenta con otra definición${ppda.segunda ? ` y le da ${cifraAspecto(ppda.segunda.valor, ppda.unidad)}` : ""}.`
                      : "";
                  })()}
                </p>
              </details>
            </div>
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
                        {/* Su puesto en una barra (17/11/2026, jueces de marketing): lleno, el 1.º; vacío, el último. */}
                        {/*
                          18/11/2026 (jueces de análisis): barra de percentil con la marca del
                          rival frente a la mediana de los 20 (la raya del centro); el tramo
                          coloreado es lo que se separa de ella. A la derecha, mejor.
                        */}
                        {equipos > 0 && a.filas[0] && (() => {
                          const de = a.filas[0].de ?? equipos;
                          const puesto = puestoDeFila(a.filas[0], equipos);
                          const pos = de > 1 ? Math.max(3, Math.min(97, (100 * (de - puesto)) / (de - 1))) : 50;

                          return (
                            <span className="relative my-1 block h-2 w-full max-w-[18rem] rounded-full bg-white/10" aria-hidden title={`${puesto}.º de ${de} · la raya es la mediana`}>
                              <span
                                className="absolute inset-y-0 rounded-full opacity-60"
                                style={{ left: `${Math.min(50, pos)}%`, width: `${Math.abs(pos - 50)}%`, background: grupo.color }}
                              />
                              <span className="absolute -bottom-1 -top-1 left-1/2 w-px bg-white/60" />
                              <span
                                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80"
                                style={{ left: `${pos}%`, background: grupo.color }}
                              />
                            </span>
                          );
                        })()}
                        {/*
                          Todas las cifras del aspecto, cada una con SU puesto (11/11/2026, jueces de fútbol):
                          el puesto del aspecto es la media de dos o tres cifras y, junto a la primera sola,
                          decía «17.º» de un 7,1 que en Su balón parado sale el peor de los 20.
                        */}
                        {/*
                          27/11/2026 (jueces de análisis y fútbol, ronda 9): «Córners rematados
                          · 13.º de 20» salía bajo «Flojo en». Dentro de cada bloque sólo van
                          las cifras de su tercio (los 6 primeros en «Fuerte en», los 6 últimos
                          en «Flojo en»); si ninguna lo está, la primera, para no dejarlo vacío.
                        */}
                        {(() => {
                          const de = (f: (typeof a.filas)[number]) => f.de ?? equipos;
                          const punta = (f: (typeof a.filas)[number]) => Math.round(de(f) * 0.3);
                          const enSuTercio = (f: (typeof a.filas)[number]) =>
                            equipos <= 0 ||
                            (grupo.titulo === "Fuerte en" ? puestoDeFila(f, equipos) <= punta(f) : puestoDeFila(f, equipos) > de(f) - punta(f));
                          const filtradas = a.filas.filter(enSuTercio);
                          return filtradas.length > 0 ? filtradas : a.filas.slice(0, 1);
                        })().map((f) => (
                          <span key={f.nombre} className="text-[13px] leading-snug tabular-nums text-white/70">
                            {nombreDeFila(a.aspecto, f.nombre)}
                            {/ppda/i.test(f.nombre) && f.proveedor === "Opta" ? " de Opta" : ""}
                            {/* Dicho la vez que sale (27/11/2026, ronda 9, fútbol). */}
                            {/ppda/i.test(f.nombre) ? " (pases que deja dar antes de presionar; menos es más presión)" : ""}: <b className="font-semibold text-white/85">{cifraAspecto(f.valor, f.unidad)}</b>
                            {porPartido(f.nombre, f.unidad)}
                            {/* El sentido, si menos es mejor (17/11/2026, jueces de análisis: «pérdidas 120,5» no decía hacia dónde). */}
                            {!/ppda/i.test(f.nombre) && ((f.valor > f.mediana && f.percentil < 50) || (f.valor < f.mediana && f.percentil > 50)) ? " (menos es mejor)" : ""} · mediana {cifraAspecto(f.mediana, f.unidad)}
                            {equipos > 0 ? ` · ${puestoDeFila(f, equipos)}.º de ${f.de ?? equipos}` : ""}
                            {/* La base y el proveedor (16/11/2026, jueces de fútbol): «25 de 56 en 12 partidos», «Opta». */}
                            {f.base && f.unidad === "porcentaje" ? ` · ${Math.round(f.base.arriba)} de ${Math.round(f.base.abajo)}${f.partidos ? ` en ${f.partidos} partidos` : ""}` : partidosWyscout > 0 && porPartido(f.nombre, f.unidad) ? ` · ${partidosWyscout} partidos` : ""}
                            {/* 18/11/2026 (ronda 23, fútbol): en la fila basta «PPDA de Opta»; el porqué va en «Ver base». */}
                            {f.proveedor === "Opta" && !/ppda/i.test(f.nombre) ? " · Opta" : ""}
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
                          {/* 17/11/2026 (jueces de análisis): sin cifra suelta en el rótulo; dentro va con el formato de las tarjetas (base, mediana, puesto y sentido). */}
                          {`Ver ${lista.length === 1 ? "otro punto" : `otros ${lista.length} puntos`} ${grupo.titulo === "Fuerte en" ? (lista.length === 1 ? "fuerte" : "fuertes") : lista.length === 1 ? "flojo" : "flojos"}: ${lista.map((x) => x.aspecto.toLowerCase()).join(", ")}`}
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

      {(dano.length > 0 || amenaza.length > 0) && (
        /*
          17/11/2026 (ronda 19, jueces de fútbol y marketing): dos bloques según
          el signo del duelo de /duelos, cada jugador en una tarjeta que abre con
          su orden y el chip del duelo; la tarea, el objetivo y la base, plegados
          tras «Ver el duelo». Antes, un bloque de texto mezclaba las órdenes
          defensivas (tapar a Romero) con las de ataque.
        */
        <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
          {/*
            20/11/2026 (ronda 7, fútbol): el duelo que decide (Leiva contra Jorge
            Mier, −57, el del Plan y Duelos) se perdía: Jorge Mier ya tenía su
            tarjeta de amenaza y la del duelo se quitaba, y salía primero el de
            Romero (−37). Ahora el que decide va el primero —dentro de la tarjeta
            de amenaza de su jugador si la tiene— con «el que decide, como en el Plan».
          */}
          {(() => {
            const decideD = dano.find((d) => d.decide && d.enContra);
            const amenazaDecide = decideD ? amenaza.find((p) => mismoApellido(p.jugador, decideD.nombre)) : undefined;
            const amenazaOrden = amenazaDecide ? [amenazaDecide, ...amenaza.filter((p) => p !== amenazaDecide)] : amenaza;
            const defensa = dano
              .filter((d) => d.enContra && !amenaza.some((p) => mismoApellido(p.jugador, d.nombre)))
              .sort((a, b) => Number(Boolean(b.decide)) - Number(Boolean(a.decide)));

            return [
              { clave: "ataque", titulo: "Dónde hacerles daño", sub: "con nuestro balón", color: "#34D399", lista: dano.filter((d) => !d.enContra), amenazas: [] as typeof amenaza, decideD, amenazaDecide },
              { clave: "defensa", titulo: "Dónde nos hacen daño", sub: "con el suyo", color: "#F87171", lista: defensa, amenazas: amenazaOrden, decideD, amenazaDecide },
            ];
          })()
            .filter((b) => b.lista.length > 0 || (b.clave === "defensa" && amenaza.length > 0))
            .map((bloque) => (
              <div key={bloque.clave} className="min-w-0">
                <p className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: chipInk(bloque.color) }}>
                  {bloque.titulo}
                  <span className="text-[12px] font-medium normal-case tracking-normal text-white/55">{bloque.sub}</span>
                </p>
                <ul className="grid min-w-0 gap-2">
                  {bloque.amenazas.map((p) => {
                    const delDuelo = p === bloque.amenazaDecide ? bloque.decideD?.duelo : undefined;

                    return (
                      <li key={p.clave} className="min-w-0 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${bloque.color}44`, background: `${bloque.color}0f` }}>
                        <p className="font-medium text-white">{p.orden.charAt(0).toUpperCase() + p.orden.slice(1)}.</p>
                        {delDuelo && <ChipDuelo d={delDuelo} equipo={equipo} decide />}
                        {/* 20/11/2026 (ronda 7, marketing): el dato en dos renglones, el resto con «Ver más». */}
                        <DosLineas className="mt-0.5 text-[13px] tabular-nums text-white/70">{p.dato}.</DosLineas>
                        {/* La base en el mismo formato que «Dónde hacerles daño» (27/11/2026, ronda 10, análisis). */}
                        {p.base && <p className="mt-0.5 text-[12px] tabular-nums text-white/55">Base: {p.base}</p>}
                        <EnlacesAmenaza punto={p} equipo={equipo} />
                        {delDuelo && (
                          <Link href={`/duelos?equipo=${encodeURIComponent(equipo)}`} className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold underline-offset-2 hover:underline" style={{ color: "var(--rmcf-gold-ink, #C8A96B)" }}>
                            Su duelo <ArrowUpRight size={12} aria-hidden />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                  {bloque.lista.map((uno) => (
                    <TarjetaDano key={uno.nombre} uno={uno} color={bloque.color} equipo={equipo} abre={abreJugador?.(uno.nombre) ?? null} />
                  ))}
                </ul>
              </div>
            ))}
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
