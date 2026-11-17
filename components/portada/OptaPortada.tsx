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
  xGSetPly: "córner y falta, sin penaltis · tendencia: pocos remates por partido",
};

/**
 * La base del balón parado (11/11/2026, análisis y fútbol): cuántas ocasiones
 * a balón parado y cuántos córners lleva cada uno en la temporada, de la misma
 * fila de Opta del equipo. Sin las dos columnas, no sale nada.
 */
function baseAbp(fila: Fila | undefined): string {
  if (!fila) return "";
  const ocasiones = valorEquipo(fila, "ChncSetPl", "total");
  const corners = valorEquipo(fila, "Corners", "total");
  /* 16/11/2026 (marketing): cada cifra con su base: son totales de la temporada, no por partido. */
  const partes = [
    ocasiones != null ? `${Math.round(ocasiones)} ocasiones a balón parado` : "",
    corners != null ? `${Math.round(corners)} córners a favor` : "",
  ].filter(Boolean);
  return partes.length ? `${partes.join(" y ")} en la temporada` : "";
}

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
  const conclusiones = rival ? lecturas(nuestro, suyo, rival) : [];

  return (
    <section className="portada-tarjeta min-w-0 p-4 sm:p-6" aria-label="Opta de un vistazo">
      {/* 16/11/2026 (marketing): la fuente y su base, una sola vez, en la cabecera del bloque. */}
      <CabeceraBloque
        icono={Database}
        titulo={
          <>
            Opta de un vistazo
            {jugados > 0 ? <span className="text-white/55"> · {jugados} {jugados === 1 ? "partido" : "partidos"}</span> : null}
          </>
        }
        accion={
          <p className="flex flex-wrap items-center gap-2 text-[12px] text-white/60">
            <SelloFuente fuente="opta" poblacion={`grupo (${deCuantos} equipos)`} hasta={hasta ? `hasta el ${hasta}` : undefined} />
          </p>
        }
      />

      {/*
        17/11/2026 (los tres jueces): fuera «El último partido» (repetía las
        cifras del 3D) y, en su sitio, la lectura: una conclusión por fila con
        su cifra, su puesto y adónde ir a prepararlo, con el rival ya elegido.
      */}
      <div className={`mt-5 grid min-w-0 gap-3 ${conclusiones.length ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" : ""}`}>
        {conclusiones.length ? (
          <div className="flex min-w-0 flex-col gap-2">
            <p className="portada-rotulo">Lo que dicen las cifras</p>
            {conclusiones.map((c) => (
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

        {/* ---------- frente a frente ---------- */}
        <Link
          href="/data-analisis?area=estilos"
          onClick={() => trackModuleVisit("/data-analisis")}
          className="portada-celda portada-viva group min-w-0 p-4 sm:p-5"
          title="Los estilos de la categoría: dominio, peligro y solidez de cada equipo"
        >
          <p className="portada-rotulo">{rival ? `Frente a frente · media por partido en ${jugados}` : `El Castilla · media por partido en ${jugados}`}</p>
          <table className="mt-3 w-full table-fixed text-left tabular-nums">
            <thead>
              <tr className="text-[12px] text-white/60">
                <th className="w-[38%] pb-1.5 pr-2 align-bottom text-[12px] font-medium leading-tight text-white/60">debajo, puesto en el grupo</th>
                <th className="pb-1.5 pr-2 text-right align-bottom font-semibold">
                  <span className="block truncate" style={{ color: ORO }}>Castilla</span>
                </th>
                {rival ? (
                  <th className="pb-1.5 text-right align-bottom font-semibold">
                    {/* 11/11/2026: el nombre entero, en dos renglones si hace falta (en el móvil se cortaba en «Gimnàstic Tarrag…»). */}
                    <span className="block break-words leading-tight" style={{ color: COMPARADO }} title={rival}>
                      {rival}
                    </span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {nuestro.map((x) => {
                const r = suyo.find((s) => s.a === x.a);
                return (
                  <tr key={x.a} className="border-t border-white/[0.06]" title={x.comoLeer}>
                    <td className="py-2.5 pr-2 align-top text-[13.5px] font-medium leading-tight text-white/85">
                      {x.nombre}
                      {AYUDA[x.a] ? (
                        <span className="mt-0.5 block text-[12px] font-normal leading-snug text-white/60">{AYUDA[x.a]}</span>
                      ) : x.mejor === false ? (
                        <span className="block text-[12px] font-normal text-white/60">menos es mejor</span>
                      ) : null}
                    </td>
                    <Celda x={x} base={x.a === "xGSetPly" ? baseAbp(filaNuestra) : ""} />
                    {rival ? r ? <Celda x={r} base={r.a === "xGSetPly" ? baseAbp(filaSuya) : ""} /> : <td /> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-white/70 transition-colors duration-300 group-hover:text-[#D8B45A]">
            Los estilos de la categoría
            <ChevronRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
          </p>
        </Link>
      </div>
    </section>
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
function lecturas(nuestro: FilaLab[], suyo: FilaLab[], rival: string): Lectura[] {
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
      titular: `${fuerte ? frase.fuerte : frase.flojo}: ${puesto}.º de ${deCuantos}`,
      base: `${rival}, ${coma(valor, decimales)} ${unidad}${nuestra}`,
      accion: frase.accion,
      href: frase.href(rival),
      /* Lo que es una amenaza del rival, en naranja; por donde se le puede hacer daño, en verde. */
      color: fuerte ? "#F97316" : "#10B981",
      peso: Math.min(puesto, deCuantos + 1 - puesto) + (r.a === "xGSetPly" ? -0.5 : 0),
    });
  }

  return salen.sort((x, y) => x.peso - y.peso).slice(0, 2);
}

function Celda({ x, base = "" }: { x: FilaLab; base?: string }) {
  const color = x.mejor === null ? tinta(0.55) : colorPercentil(x.pos.percentil);
  return (
    <td className="py-2.5 pr-2 text-right align-top last:pr-0">
      <span className="fuente-club block text-[24px] font-bold leading-none tabular-nums text-white">{valorTexto(x)}</span>
      {x.pos.puesto ? (
        /* «5º de 20», como el sello «grupo (20 equipos)»: un solo término (11/11/2026). */
        <span className="mt-1 block text-[12px] font-semibold" style={{ color }} title={`Puesto ${x.pos.puesto} de ${x.pos.deCuantos} del grupo, del mejor al peor`}>
          {x.pos.puesto}º de {x.pos.deCuantos}
        </span>
      ) : null}
      {base ? <span className="mt-0.5 block text-[12px] leading-tight text-white/60">{base}</span> : null}
    </td>
  );
}
