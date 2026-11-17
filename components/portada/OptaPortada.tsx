"use client";

/**
 * OPTA EN LA PORTADA (10/11/2026): una tarjeta para el día a día.
 *
 * - **Frente a frente**: el próximo rival (calendario de BeSoccer, cruzado
 *   con Opta por `casaEquipo`, como en 11 metros) y el Castilla en cuatro
 *   cifras por partido con su puesto en el grupo: xG a favor, xG en contra,
 *   PPDA y xG a balón parado. Si el rival no casa con Opta o no es del
 *   grupo, sale sólo el Castilla.
 * - **Lo que dicen las cifras** (17/11/2026): las dos conclusiones que más
 *   pesan del rival (tercio de arriba o de abajo de su grupo), con su cifra,
 *   la nuestra y un toque a la pantalla donde se prepara.
 *
 * 10/11/2026 (expertos): la base en el título («11 partidos»), «puesto en el
 * grupo» como cabecera de la columna, «xG» y «PPDA» explicados la primera vez
 * y el balón parado marcado como tendencia (pocos remates por partido).
 * 17/11/2026: fuera «El último partido» (lo cuenta ya «El último partido en
 * 3D» con las mismas cifras).
 *
 * Sólo documentos ligeros al abrir la portada (`opta:meta`, `opta:equipos`,
 * `opta:partidos`, ≈0,5 MB, compartidos con «Análisis de datos»). Mientras
 * carga, la tarjeta ya tiene su alto: no empuja la portada.
 */

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, Database } from "lucide-react";

import { COMPARADO, ORO, colorPercentil, tinta } from "@/components/data/graficas";
import { useProximoRival } from "@/hooks/useAbpLigas";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { trackModuleVisit } from "@/lib/module-usage";
import { ponEquipoElegido } from "@/lib/data-analisis/eleccion-compartida";
import { CASTILLA_OPTA } from "@/lib/opta";
import { nombreEquipo, partidosDe, valorEquipo, type Fila } from "@/lib/opta-analisis";
import { urlGolesDelEquipo } from "@/lib/rivals/goles-en-video";
import { contextoGrupo, equipoOptaDe, hastaElPartido, type FilaLab, type MetricaLab } from "@/lib/opta-laboratorio";
import { SelloFuente } from "@/components/ui/SelloFuente";
import { CabeceraBloque } from "@/components/portada/CabeceraBloque";

/** Lo que se lee bajo el nombre de cada fila: la sigla explicada y el sentido. */
const AYUDA: Record<string, string> = {
  ExpG: "goles esperados · más es mejor",
  ExpGAg: "goles esperados que concede · menos es mejor",
  PPDA: "pases que deja dar antes de presionar · menos es más presión",
  xGSetPly: "córner y falta, sin penaltis",
};

/**
 * La base del balón parado (11/11/2026, análisis y fútbol): cuántas ocasiones
 * a balón parado y cuántos córners lleva cada uno en la temporada, de la misma
 * fila de Opta del equipo. Sin las dos columnas, no sale nada.
 */
function baseAbp(fila: Fila | undefined, partidos: number): { remates: number | null; texto: string } {
  if (!fila) return { remates: null, texto: "" };
  const ocasiones = valorEquipo(fila, "ChncSetPl", "total");
  const corners = valorEquipo(fila, "Corners", "total");
  /* 16/11/2026 (marketing): cada cifra con su base: son totales de la temporada, no por partido.
     17/11/2026 (ronda 21, análisis): con los partidos al lado, que es lo que dice por qué es tendencia. */
  const partes = [
    ocasiones != null ? `${Math.round(ocasiones)} remates a balón parado` : "",
    corners != null ? `${Math.round(corners)} córners` : "",
  ].filter(Boolean);
  if (!partes.length) return { remates: null, texto: "" };
  return {
    remates: ocasiones == null ? null : Math.round(ocasiones),
    texto: `${partes.join(" y ")} en ${partidos} ${partidos === 1 ? "partido" : "partidos"}`,
  };
}

/** «grupo de 20 equipos»: la única forma de decir la población en todo el bloque (17/11/2026, ronda 21). */
const grupoDe = (n: number) => `grupo de ${n} equipos`;

/**
 * Las filas que se leen como tendencia: el xG a balón parado sale de uno o dos
 * remates por partido, y unas décimas lo mueven varios puestos. Se marca en el
 * propio gráfico (puntos huecos y el rótulo), no sólo en el texto.
 */
const ES_TENDENCIA = new Set(["xGSetPly"]);

/** Las cuatro de la tarjeta, todas por partido. */
const CLAVE: MetricaLab[] = [
  { a: "ExpG", nombre: "xG a favor", comoLeer: "Goles esperados de sus remates, por partido." },
  { a: "ExpGAg", nombre: "xG en contra", comoLeer: "Goles esperados de los remates que le hacen, por partido." },
  { a: "PPDA", nombre: "PPDA", comoLeer: "Pases que deja dar al rival por cada acción defensiva: cuanto más bajo, más presiona." },
  { a: "xGSetPly", nombre: "xG a balón parado", comoLeer: "Goles esperados de sus remates a balón parado (sin penaltis), por partido." },
];

const coma = (v: number, d: number) => v.toFixed(d).replace(".", ",");
const valorTexto = (x: FilaLab) => (x.pos.valor == null ? "" : coma(x.pos.valor, x.a === "PPDA" ? 1 : 2));

export function OptaPortada() {
  const { opta, cargando } = useOptaLigero();
  const proximo = useProximoRival();

  const nuestro = useMemo(() => (opta ? contextoGrupo(opta.equipos, opta.grupos, CASTILLA_OPTA, CLAVE, opta.catalogo) : []), [opta]);
  const idRival = useMemo(() => (opta && proximo ? equipoOptaDe(proximo, opta.equipos) : null), [opta, proximo]);
  const suyo = useMemo(
    () =>
      opta && idRival && idRival !== CASTILLA_OPTA && opta.grupos.get(idRival) === opta.grupos.get(CASTILLA_OPTA)
        ? contextoGrupo(opta.equipos, opta.grupos, idRival, CLAVE, opta.catalogo)
        : [],
    [opta, idRival],
  );
  const rival = useMemo(() => {
    const f = opta?.equipos.find((e) => e.teamId === idRival);
    return f && suyo.length ? nombreEquipo(f) : "";
  }, [opta, idRival, suyo]);
  const filaNuestra = opta?.equipos.find((e) => e.teamId === CASTILLA_OPTA);
  const filaSuya = rival ? opta?.equipos.find((e) => e.teamId === idRival) : undefined;
  /* Los partidos de cada uno, para la base del balón parado. */
  const jugadosSuyos = useMemo(() => (opta && idRival ? partidosDe(opta.partidos, idRival).length : 0), [opta, idRival]);

  if (cargando) {
    /* El alto de la tarjeta de verdad (cabecera y cuerpo): que la portada no salte al llegar. */
    return (
      <div role="status" aria-label="Cargando las cifras de Opta" className="portada-tarjeta p-4 sm:p-6">
        <div className="h-9 w-56 animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="portada-celda mt-5 h-[300px] animate-pulse" />
      </div>
    );
  }
  if (!opta || !nuestro.length) return null;

  const hasta = hastaElPartido(opta.meta, opta.partidos);
  const deCuantos = nuestro[0]?.pos.deCuantos ?? 0;
  const jugados = partidosDe(opta.partidos, CASTILLA_OPTA).length;
  const conclusiones = rival ? lecturas(nuestro, suyo, rival, baseAbp(filaSuya, jugadosSuyos).texto) : [];
  const poblacion = grupoDe(deCuantos);

  /*
   * 17/11/2026 (ronda 21, marketing): cada fila abre «Un equipo de un vistazo»
   * de Análisis de datos con el rival ya elegido. La pantalla no lee la URL
   * para esto: se deja el nombre en la elección compartida de sus lecturas
   * (`ponEquipoElegido`) al pulsar, y `?equipo=` queda en el enlace para quien
   * lo copie.
   */
  const equipoFila = rival || "Real Madrid Castilla";
  const hrefFila = `/data-analisis?area=equipo&equipo=${encodeURIComponent(equipoFila)}`;
  const abreFila = () => {
    ponEquipoElegido(equipoFila);
    trackModuleVisit("/data-analisis");
  };

  /*
   * 17/11/2026 (ronda 20, los tres jueces): el bloque es el ÚNICO sitio de
   * las cifras del rival en la portada (la tarjeta oscura del héroe ya no las
   * repite). Abre con la conclusión como titular, sigue con el gráfico
   * «Frente a frente» (puesto en el grupo de cada uno, a la derecha mejor,
   * con la mediana) y debajo, a lo ancho, las dos lecturas con su toque.
   */
  const [principal, ...resto] = conclusiones;

  return (
    <section className="portada-tarjeta min-w-0 p-4 sm:p-6" aria-label="Opta de un vistazo">
      {/* 16/11/2026 (marketing): la fuente y su base, una sola vez, en la cabecera del bloque. */}
      <CabeceraBloque
        icono={Database}
        titulo={rival ? `${rival} frente a nosotros` : "El Castilla en el grupo"}
        sub={`Opta · media por partido en ${jugados} ${jugados === 1 ? "partido" : "partidos"} · puesto en el ${poblacion}`}
        accion={
          <p className="flex flex-wrap items-center gap-2 text-[12px] text-white/60">
            <SelloFuente fuente="opta" poblacion={poblacion} hasta={hasta ? `hasta el ${hasta}` : undefined} />
          </p>
        }
      />

      {principal ? (
        <div className="mt-5 flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 basis-[280px]" style={{ boxShadow: `inset 3px 0 0 ${principal.color}`, paddingLeft: 14 }}>
            <p className="fuente-club text-[22px] font-bold uppercase leading-tight text-white sm:text-[26px]">{principal.titular}</p>
            <p className="mt-1 text-[13.5px] leading-snug text-white/70">{principal.base}</p>
          </div>
          <Link
            href={principal.href}
            onClick={() => trackModuleVisit(principal.href.split("?")[0])}
            className="portada-celda portada-viva group inline-flex min-h-10 shrink-0 items-center gap-1 px-4 text-[13.5px] font-semibold"
            style={{ color: "var(--rmcf-gold-ink)", borderRadius: 999 }}
          >
            {principal.accion}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      ) : null}

      {/* ---------- frente a frente: el gráfico ---------- */}
      <div className="portada-celda mt-4 min-w-0 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-white/70">
          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: ORO }}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: ORO }} />
            Castilla
          </span>
          {rival ? (
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: COMPARADO }}>
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: COMPARADO }} />
              {rival}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-px bg-white/40" />
            mediana del {poblacion}
          </span>
          <span className="ml-auto font-semibold text-white/60">a la derecha, mejor →</span>
        </div>

        <ul className="mt-3 divide-y divide-white/[0.06]">
          {nuestro.map((x) => {
            const r = suyo.find((s) => s.a === x.a);
            const tendencia = ES_TENDENCIA.has(x.a);
            const bN = tendencia ? baseAbp(filaNuestra, jugados) : null;
            const bS = tendencia && rival ? baseAbp(filaSuya, jugadosSuyos) : null;
            return (
              <li key={x.a}>
                <Link
                  href={hrefFila}
                  onClick={abreFila}
                  title={`${x.comoLeer} Abre ${equipoFila} en Análisis de datos.`}
                  className="group -mx-2 grid min-w-0 gap-x-4 gap-y-2 rounded-xl px-2 py-3 transition-colors hover:bg-white/[0.03] sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)_auto_16px] sm:items-center"
                >
                  <span className="block min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[14px] font-semibold leading-tight text-white/90">{x.nombre}</span>
                      {tendencia ? (
                        <span
                          className="rounded-full border px-1.5 py-px text-[11px] font-semibold uppercase tracking-[0.08em]"
                          style={{ borderColor: "rgba(217,119,6,.45)", color: "var(--rmcf-gold-ink)" }}
                        >
                          Tendencia
                        </span>
                      ) : null}
                    </span>
                    {AYUDA[x.a] ? <span className="mt-0.5 block text-[12px] leading-snug text-white/60">{AYUDA[x.a]}</span> : null}
                  </span>

                  <Pista nuestro={x} suyo={rival ? r : undefined} hueca={tendencia} />

                  <span className="flex items-baseline justify-between gap-4 tabular-nums sm:justify-end">
                    <Valor x={x} color={ORO} />
                    {rival && r ? <Valor x={r} color={COMPARADO} /> : null}
                  </span>

                  <ChevronRight className="hidden h-4 w-4 text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70 sm:block" aria-hidden />

                  {/* 17/11/2026 (ronda 21, análisis): la base de la tendencia, en la misma fila del gráfico. */}
                  {bN?.texto || bS?.texto ? (
                    <span className="block text-[12px] leading-snug text-white/65 sm:col-span-4">
                      <span className="font-semibold" style={{ color: "var(--rmcf-gold-ink)" }}>Pocos remates, léase como tendencia:</span>{" "}
                      {bN?.texto ? `Castilla, ${bN.texto}` : ""}
                      {bN?.texto && bS?.texto ? " · " : ""}
                      {bS?.texto ? `${rival}, ${bS.texto}` : ""}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <Link
          href="/data-analisis?area=estilos"
          onClick={() => trackModuleVisit("/data-analisis")}
          className="group mt-2 inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-white/70 transition-colors duration-300 hover:text-[#D8B45A]"
          title="Los estilos de la categoría: dominio, peligro y solidez de cada equipo"
        >
          Los estilos de la categoría
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Las lecturas, a lo ancho y con su toque (sin hueco debajo en escritorio). */}
      {resto.length ? (
        <div className={`mt-3 grid min-w-0 gap-3 ${resto.length > 1 ? "md:grid-cols-2" : ""}`}>
          {resto.map((c) => (
            <Link
              key={c.a}
              href={c.href}
              onClick={() => trackModuleVisit(c.href.split("?")[0])}
              className="portada-celda portada-viva group flex min-w-0 items-start gap-3 p-3.5"
              style={{ boxShadow: `inset 3px 0 0 ${c.color}` }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug text-white">{c.titular}</span>
                <span className="mt-1 block text-[13px] leading-snug text-white/70">{c.base}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-0.5 self-center text-[13px] font-semibold" style={{ color: "var(--rmcf-gold-ink)" }}>
                {c.accion}
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * La pista del puesto (17/11/2026, ronda 20): del peor (izquierda) al mejor
 * (derecha) del grupo, con el tercio de abajo en naranja tenue, el de arriba
 * en verde tenue, la mediana en el centro y un punto por equipo.
 */
function Pista({ nuestro, suyo, hueca = false }: { nuestro: FilaLab; suyo?: FilaLab; hueca?: boolean }) {
  const lugar = (x: FilaLab) => {
    const { puesto, deCuantos } = x.pos;
    if (!puesto || deCuantos < 2) return null;
    return ((deCuantos - puesto) / (deCuantos - 1)) * 100;
  };
  const a = lugar(nuestro);
  const b = suyo ? lugar(suyo) : null;
  const estilo = nuestro.mejor === null;

  return (
    <div className="relative h-7 min-w-0" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-white/[0.07]">
        {!estilo ? (
          <>
            <span className="absolute inset-y-0 left-0 w-1/3" style={{ background: "rgba(249,115,22,.16)" }} />
            <span className="absolute inset-y-0 right-0 w-1/3" style={{ background: "rgba(16,185,129,.16)" }} />
          </>
        ) : null}
      </div>
      <span className="absolute left-1/2 top-0 h-full w-px bg-white/40" />
      {/* Tendencia (17/11/2026, ronda 21): el punto hueco dice en el propio gráfico que es poca muestra. */}
      {b != null ? (
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--portada-sup-2)]"
          style={hueca ? { left: `${b}%`, border: `3px solid ${COMPARADO}`, background: "var(--portada-sup-2)" } : { left: `${b}%`, background: COMPARADO }}
        />
      ) : null}
      {a != null ? (
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--portada-sup-2)]"
          style={hueca ? { left: `${a}%`, border: `3px solid ${ORO}`, background: "var(--portada-sup-2)" } : { left: `${a}%`, background: ORO }}
        />
      ) : null}
    </div>
  );
}

/** La cifra de cada uno con su puesto, en su color (oro el Castilla, azul el rival). */
function Valor({ x, color }: { x: FilaLab; color: string }) {
  const puesto = x.pos.puesto;
  return (
    <span className="min-w-[64px] text-right">
      <span className="fuente-club block text-[22px] font-bold leading-none" style={{ color }}>
        {valorTexto(x)}
      </span>
      {puesto ? (
        <span
          className="mt-0.5 block text-[12px] font-semibold"
          style={{ color: x.mejor === null ? tinta(0.55) : colorPercentil(x.pos.percentil) }}
          title={`Puesto ${puesto} de ${x.pos.deCuantos} del grupo, del mejor al peor`}
        >
          {puesto}º de {x.pos.deCuantos}
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  La lectura: una conclusión por fila (17/11/2026)                   */
/* ------------------------------------------------------------------ */

type Lectura = { a: string; titular: string; base: string; accion: string; href: string; color: string; peso: number };

/** Qué quiere decir cada métrica del rival cuando es de las mejores o de las peores del grupo. */
const FRASES: Record<string, { fuerte: string; flojo: string; accion: string; href: (rival: string) => string }> = {
  xGSetPly: {
    fuerte: "Ojo a su balón parado",
    flojo: "Su balón parado apenas genera",
    accion: "ABP rival",
    href: (r) => `/scout-rival-abp?equipo=${encodeURIComponent(r)}`,
  },
  PPDA: {
    fuerte: "Presiona de los que más",
    flojo: "Presiona poco: deja salir jugando",
    accion: "Plantilla",
    href: (r) => `/rivals?equipo=${encodeURIComponent(r)}`,
  },
  ExpG: {
    fuerte: "Genera mucho peligro",
    flojo: "Genera poco peligro",
    accion: "Sus goles",
    href: (r) => urlGolesDelEquipo(r),
  },
  ExpGAg: {
    fuerte: "Concede poco: cuesta hacerle ocasiones",
    flojo: "Concede mucho: por ahí se le hace daño",
    accion: "Cómo le marcan",
    href: (r) => urlGolesDelEquipo(r, "contra"),
  },
};

/**
 * Las dos conclusiones que más pesan para preparar al rival: las métricas en
 * las que está en el tercio de arriba o en el de abajo de su grupo, primero
 * las más extremas, con la nuestra al lado. Si ninguna se sale de la media,
 * no se dice nada (la tabla ya lo cuenta).
 */
function lecturas(nuestro: FilaLab[], suyo: FilaLab[], rival: string, baseTendencia: string): Lectura[] {
  const salen: Lectura[] = [];

  for (const r of suyo) {
    const frase = FRASES[r.a];
    const { puesto, deCuantos, valor } = r.pos;

    if (!frase || !puesto || !deCuantos || valor == null) continue;

    const fuerte = puesto <= Math.ceil(deCuantos / 3);
    const flojo = puesto > Math.floor((2 * deCuantos) / 3);

    if (!fuerte && !flojo) continue;

    const n = nuestro.find((x) => x.a === r.a);
    const decimales = r.a === "PPDA" ? 1 : 2;
    const unidad = r.a === "PPDA" ? "pases por acción defensiva" : "xG por partido";
    const nuestra = n?.pos.puesto && n.pos.valor != null ? ` · el nuestro, ${coma(n.pos.valor, decimales)} (${n.pos.puesto}.º)` : "";

    salen.push({
      a: r.a,
      /* 17/11/2026 (ronda 21, análisis): la población con la misma fórmula que el subtítulo y la leyenda. */
      titular: `${fuerte ? frase.fuerte : frase.flojo}: ${puesto}.º del ${grupoDe(deCuantos)}`,
      base: `${rival}, ${coma(valor, decimales)} ${unidad}${nuestra}${ES_TENDENCIA.has(r.a) && baseTendencia ? ` · tendencia: ${baseTendencia}` : ""}`,
      accion: frase.accion,
      href: frase.href(rival),
      /* Lo que es una amenaza del rival, en naranja; por donde se le puede hacer daño, en verde. */
      color: fuerte ? "#F97316" : "#10B981",
      peso: Math.min(puesto, deCuantos + 1 - puesto) + (r.a === "xGSetPly" ? -0.5 : 0),
    });
  }

  return salen.sort((x, y) => x.peso - y.peso).slice(0, 3);
}

