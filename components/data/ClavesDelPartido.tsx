"use client";

/*
| LAS TRES CLAVES DEL PARTIDO (17/11/2026, ronda 21, expertos de análisis y de
| marketing). Lo primero del «Post del partido», antes de cualquier tabla: tres
| conclusiones en dibujo, cada una con el botón que lleva a donde se ve entera.
|
|   1. Ocasiones: goles esperados de los dos (la fila de Opta del cara a cara).
|   2. Dónde robamos y 3. dónde perdimos: los MISMOS robos y pérdidas que
|      /laboratorio/transiciones y /laboratorio/perdidas (vídeo etiquetado y,
|      si aún no lo está, Opta), con su media de los partidos anteriores.
|
| Si falta una, entra el duelo aéreo. Lo que no tiene dato no sale.
*/

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { COMPARADO, MEJOR, ORO, PEOR } from "@/components/data/graficas";
import { esPretemporada } from "@/components/faltas/FiltrosCruzados";
import { anterioresPorFecha } from "@/lib/abp/ultimo-partido";
import { mismoJugador } from "@/lib/fichajes";
import { CASTILLA_OPTA, num } from "@/lib/opta";
import { titularPartido } from "@/lib/partido-frases";
import { partidoEnlazado } from "@/lib/partido-enlazado";
import { enlaceConPartido, type PartidoPost } from "@/lib/post-partido";
import type { Robo } from "@/lib/transiciones/datos";
import { usePartidosLaboratorio, zonaDeRobo } from "@/lib/transiciones/partidos-laboratorio";
import type { DatosOpta } from "@/app/opta/_piezas/useOpta";
import { useRemates } from "@/app/opta/_piezas/eventos";

const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
/** 18/11/2026 (ronda 22): el MISMO porcentaje, con un decimal, en las tres claves y en «Acción a acción». */
export const pc = (n: number, de: number) => (de ? `${coma((n / de) * 100)} %` : "");
export const fichaJugador = (nombre: string) => `/individual?nombre=${encodeURIComponent(nombre)}`;

type ZonasCuenta = { propio: number; medio: number; rival: number; total: number };

export type CifrasLaboratorio = {
  total: number;
  zonas: ZonasCuenta;
  /** Los robos en campo rival (o las pérdidas en campo propio), los que cuenta el laboratorio. */
  clave: number;
  /** Su media en los partidos anteriores (sin pretemporada), y en cuántos. */
  media: number | null;
  anteriores: number;
  /** El que más roba (o pierde) del partido. */
  lider: { nombre: string; n: number } | null;
  /** Del vídeo etiquetado o de Opta. */
  deOpta: boolean;
};

function cuentaZonas(filas: Robo[]): ZonasCuenta {
  const z = { propio: 0, medio: 0, rival: 0, total: filas.length };
  for (const r of filas) {
    const zona = zonaDeRobo(r);
    if (zona === "campo rival") z.rival++;
    else if (zona === "medio campo") z.medio++;
    else z.propio++;
  }
  return z;
}

/** Robos y pérdidas del partido con la cuenta de los laboratorios. */
export function useLaboratorioDelPartido(visto: Pick<PartidoPost, "fecha" | "rival"> | null) {
  const { partidos: robos } = usePartidosLaboratorio("robos");
  const { partidos: perdidas } = usePartidosLaboratorio("perdidas");
  return useMemo(() => {
    const de = (lista: typeof robos, modo: "robos" | "perdidas"): CifrasLaboratorio | null => {
      if (!visto) return null;
      const filasDe = (p: (typeof lista)[number]): Robo[] => (modo === "robos" ? p.robos : (p.perdidas ?? []));
      const con = lista.filter((p) => filasDe(p).length > 0 && !esPretemporada(p.jornada));
      const elegido = partidoEnlazado(con, visto.fecha, visto.rival);
      if (!elegido) return null;
      const filas = filasDe(elegido);
      const zonas = cuentaZonas(filas);
      const claveDe = (z: ZonasCuenta) => (modo === "robos" ? z.rival : z.propio);
      const previos = anterioresPorFecha(con, elegido);
      const media = previos.length ? previos.reduce((s, p) => s + claveDe(cuentaZonas(filasDe(p))), 0) / previos.length : null;
      const porJugador = new Map<string, number>();
      for (const r of filas) if (r.jugador) porJugador.set(r.jugador, (porJugador.get(r.jugador) ?? 0) + 1);
      const [lider] = [...porJugador.entries()].sort((a, b) => b[1] - a[1]);
      return {
        total: filas.length,
        zonas,
        clave: claveDe(zonas),
        media,
        anteriores: previos.length,
        lider: lider ? { nombre: lider[0], n: lider[1] } : null,
        deOpta: "fuente" in (filas[0] ?? {}),
      };
    };
    return { robos: de(robos, "robos"), perdidas: de(perdidas, "perdidas") };
  }, [robos, perdidas, visto]);
}

type Clave = {
  id: string;
  rotulo: string;
  titular: string;
  detalle?: string;
  tono: "bien" | "mal" | "neutro";
  dibujo: ReactNode;
  ir: { texto: string; area?: string; href?: string };
  jugador?: { nombre: string; texto: string };
  /** Una línea más bajo el detalle (p. ej. de qué ocasión salió el gol). */
  extra?: ReactNode;
};

/*
| 20/11/2026 (ronda 4, análisis): «ganamos 1-0 con menos xG» no decía de qué
| ocasión salió el gol. Con los remates de Opta del partido: la calidad de
| cada gol nuestro (baja por debajo de 0,1 de xG; clara desde 0,3).
*/
function CalidadDeNuestrosGoles({ datos, partido }: { datos: DatosOpta; partido: string }) {
  const { remates } = useRemates(datos);
  const goles = remates.filter((r) => r.partido === partido && r.gol && r.teamId === CASTILLA_OPTA);
  if (!goles.length) return null;
  const calidad = (x: number) => (x < 0.1 ? "de baja calidad" : x < 0.3 ? "de calidad media" : "clara");
  const xg = (x: number) => x.toFixed(2).replace(".", ",");
  const texto =
    goles.length === 1
      ? `El gol salió de una ocasión ${calidad(goles[0].xG)} (xG ${xg(goles[0].xG)}).`
      : `Los ${goles.length} goles salieron de ocasiones de ${goles.map((g) => `${xg(g.xG)}`).join(", ")} de xG${goles.every((g) => g.xG < 0.1) ? ": todas de baja calidad" : ""}.`;
  return <p className="mt-1.5 text-[12.5px] leading-snug text-white/70">{texto}</p>;
}

const COLOR_TONO = { bien: MEJOR, mal: PEOR, neutro: ORO } as const;

/** Dos barras en la misma escala: el Castilla en oro y el rival en azul. */
function DosBarras({ a, b, rotA, rotB, texto }: { a: number; b: number; rotA: string; rotB: string; texto: (v: number) => string }) {
  const tope = Math.max(a, b, 0.01);
  const fila = (rot: string, v: number, color: string) => (
    <div className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 text-[12px]">
      <span className="truncate text-white/65">{rot}</span>
      <span className="relative h-3 rounded-full bg-white/[0.06]">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(v / tope) * 100}%`, background: color }} />
      </span>
      <span className="text-right font-semibold tabular-nums text-white/85">{texto(v)}</span>
    </div>
  );
  return (
    <div className="space-y-1.5" role="img" aria-label={`${rotA} ${texto(a)}, ${rotB} ${texto(b)}`}>
      {fila(rotA, a, ORO)}
      {fila(rotB, b, COMPARADO)}
    </div>
  );
}

/** El reparto por zonas en una barra: nuestro campo, medio campo y campo rival, con la que importa destacada. */
function BarraZonas({ z, destaca }: { z: ZonasCuenta; destaca: "propio" | "rival" }) {
  const partes: { k: "propio" | "medio" | "rival"; rot: string; n: number }[] = [
    { k: "propio", rot: "Nuestro campo", n: z.propio },
    { k: "medio", rot: "Medio campo", n: z.medio },
    { k: "rival", rot: "Campo rival", n: z.rival },
  ];
  return (
    <div role="img" aria-label={partes.map((p) => `${p.rot}: ${p.n} de ${z.total}`).join("; ")}>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
        {partes.map((p) =>
          p.n ? (
            <span
              key={p.k}
              style={{ width: `${(p.n / z.total) * 100}%`, background: p.k === destaca ? ORO : "rgb(var(--rmcf-ink-rgb) / .28)" }}
              className="border-r border-[var(--rmcf-surface,#11161C)] last:border-r-0"
            />
          ) : null,
        )}
      </div>
      <p className="mt-1 grid grid-cols-3 text-[11px] text-white/55">
        {partes.map((p) => (
          <span key={p.k} className={p.k === "medio" ? "text-center" : p.k === "rival" ? "text-right" : ""}>
            <span className={p.k === destaca ? "font-semibold text-[#C8A96B]" : ""}>{p.n}</span> {p.rot.toLowerCase()}
          </span>
        ))}
      </p>
    </div>
  );
}

function filaOpta(datos: DatosOpta | null, partido: string, nuestra: boolean) {
  const f = datos?.partidos.find((x) => String(x.partido ?? "") === partido && (x.teamId === CASTILLA_OPTA) === nuestra);
  return (k: string) => {
    const v = f?.[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
}

export function ClavesDelPartido({
  datos,
  visto,
  rival,
  lab,
  onIr,
  jornada = null,
}: {
  datos: DatosOpta | null;
  visto: PartidoPost;
  rival: string;
  lab: { robos: CifrasLaboratorio | null; perdidas: CifrasLaboratorio | null };
  onIr?: (area: string) => void;
  /** 20/11/2026 (ronda 7): la jornada del partido, para decir si el etiquetado cubre todos los anteriores. */
  jornada?: number | null;
}) {
  const claves: Clave[] = [];
  /*
  | 20/11/2026 (ronda 7, análisis): «media 5,7» no decía de cuántos partidos;
  | ahora la base va pegada al número y, si el vídeo etiquetado no cubre todas
  | las jornadas anteriores, se dice cuántas y se marca como tendencia.
  */
  const baseMedia = (c: CifrasLaboratorio, que: string) => {
    if (c.media == null) return undefined;
    const jugados = jornada && jornada > 1 ? jornada - 1 : null;
    const incompleto = jugados != null && c.anteriores < jugados;
    const base =
      c.anteriores === 1
        ? "el partido anterior"
        : incompleto
          ? `${c.anteriores} de los ${jugados} partidos anteriores, los etiquetados`
          : `${c.anteriores} partidos anteriores`;
    const tendencia = incompleto || c.anteriores < 15;
    return `${que}: ${c.clave} · media ${coma(c.media)} (${base}${tendencia ? ", tendencia" : ""}).`;
  };
  /* 18/11/2026 (ronda 22, guionista): «7 de 40, en 90′»: la cifra del jugador con sus minutos (Opta, ese partido). */
  const enMinutos = (nombre: string) => {
    const f = datos?.castillaPartidos.find((x) => String(x.partido ?? "") === visto.clave && mismoJugador(String(x.jugador ?? ""), nombre));
    const m = f ? num(f.Min) : null;
    return m != null && m > 0 ? `, en ${Math.round(m)}′` : "";
  };
  const nos = filaOpta(datos, visto.clave, true);
  const ellos = filaOpta(datos, visto.clave, false);

  /* 1 · Ocasiones. */
  const x1 = nos("ExpG");
  const x2 = ellos("ExpG");
  if (visto.opta && x1 != null && x2 != null && visto.gf != null && visto.gc != null) {
    /* 18/11/2026 (ronda 23, guionista): el mismo titular que la portada (lib/partido-frases). */
    const titular = titularPartido(visto.gf, visto.gc, x1, x2);
    const r1 = nos("ShtIncBl");
    const r2 = ellos("ShtIncBl");
    const p1 = nos("SOG");
    const p2 = ellos("SOG");
    claves.push({
      id: "ocasiones",
      rotulo: "Ocasiones",
      titular,
      /* Ronda 23: el titular ya dice resultado y goles esperados; el detalle, los remates que los sostienen. */
      detalle:
        r1 != null && r2 != null
          ? `Remates ${r1} – ${r2}${p1 != null && p2 != null ? `, a puerta ${p1} – ${p2}` : ""} (Castilla – ${rival}).`
          : undefined,
      tono: visto.gf > visto.gc ? "bien" : visto.gf < visto.gc ? "mal" : "neutro",
      dibujo: <DosBarras a={x1} b={x2} rotA="Castilla" rotB={rival} texto={(v) => coma(v)} />,
      extra: datos && visto.gf > 0 ? <CalidadDeNuestrosGoles datos={datos} partido={visto.clave} /> : undefined,
      ir: { texto: "Ver nuestros remates", area: "remates" },
    });
  }

  /* 2 · Dónde robamos (la cuenta de /laboratorio/transiciones). */
  const r = lab.robos;
  if (r && r.total > 0) {
    const mejor = r.media != null && r.clave > r.media;
    claves.push({
      id: "robos",
      rotulo: r.deOpta ? "Robos · desde Opta" : "Robos · del vídeo",
      titular: `${r.clave} de ${r.total} robos en campo rival (${pc(r.clave, r.total)})`,
      detalle: baseMedia(r, "Robos en campo rival"),
      tono: r.media == null ? "neutro" : mejor ? "bien" : r.clave < r.media ? "mal" : "neutro",
      dibujo: <BarraZonas z={r.zonas} destaca="rival" />,
      ir: { texto: "Robos y transiciones", href: enlaceConPartido("/laboratorio/transiciones", visto) },
      /* 18/11/2026 (ronda 23, guionista): «Diego Aguado: 7 de los 40 robos del equipo, en 90′» (no se confunde con los 7 en campo rival). */
      jugador: r.lider ? { nombre: r.lider.nombre, texto: `${r.lider.n} de los ${r.total} robos del equipo${enMinutos(r.lider.nombre)}` } : undefined,
    });
  }

  /* 3 · Dónde perdimos (la cuenta de /laboratorio/perdidas). */
  const p = lab.perdidas;
  if (p && p.total > 0) {
    const peor = p.media != null && p.clave > p.media;
    claves.push({
      id: "perdidas",
      rotulo: p.deOpta ? "Pérdidas · desde Opta" : "Pérdidas · del vídeo",
      titular: `${p.clave} de ${p.total} pérdidas en campo propio (${pc(p.clave, p.total)})`,
      detalle: baseMedia(p, "Pérdidas en campo propio"),
      tono: p.media == null ? "neutro" : peor ? "mal" : p.clave < p.media ? "bien" : "neutro",
      dibujo: <BarraZonas z={p.zonas} destaca="propio" />,
      ir: { texto: "Pérdidas y transiciones", href: enlaceConPartido("/laboratorio/perdidas", visto) },
      jugador: p.lider ? { nombre: p.lider.nombre, texto: `${p.lider.n} de las ${p.total} pérdidas del equipo${enMinutos(p.lider.nombre)}` } : undefined,
    });
  }

  /* De reserva: el duelo aéreo. */
  const a1 = nos("Aerial%");
  if (claves.length < 3 && a1 != null) {
    const v = a1 <= 1 ? a1 * 100 : a1;
    claves.push({
      id: "aereo",
      rotulo: "Duelo aéreo",
      titular: `Ganamos el ${coma(v)} % de los duelos aéreos`,
      tono: v >= 55 ? "bien" : v <= 45 ? "mal" : "neutro",
      dibujo: <DosBarras a={v} b={100 - v} rotA="Castilla" rotB={rival} texto={(x) => `${coma(x)} %`} />,
      ir: { texto: "Contra el grupo, por fases", area: "colectivo" },
    });
  }

  if (!claves.length) return null;

  return (
    <div className="mt-4" aria-label="Las tres claves del partido">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Las tres claves del partido</p>
      <ol className="grid gap-3 md:grid-cols-3">
        {claves.slice(0, 3).map((c) => (
          <li
            key={c.id}
            className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            style={{ borderTopWidth: 3, borderTopColor: COLOR_TONO[c.tono] }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{c.rotulo}</p>
            <p className="mt-1 text-[15px] font-semibold leading-snug text-white">{c.titular}</p>
            <div className="mt-2.5">{c.dibujo}</div>
            {c.detalle && <p className="mt-2 text-[12.5px] leading-snug text-white/65">{c.detalle}</p>}
            {c.extra}
            {c.jugador && (
              <p className="mt-1.5 text-[12.5px] leading-snug text-white/70">
                {/* 20/11/2026 (ronda 4, marketing): que se vea que el nombre abre su ficha completa. */}
                <Link href={fichaJugador(c.jugador.nombre)} title={`Ficha completa de ${c.jugador.nombre} en Individual`} className="font-semibold text-[#C8A96B] underline decoration-[#C8A96B]/50 underline-offset-2 hover:decoration-[#C8A96B]">
                  {c.jugador.nombre}
                </Link>
                : {c.jugador.texto} ·{" "}
                <Link href={fichaJugador(c.jugador.nombre)} className="underline underline-offset-2 hover:text-white">
                  su ficha
                </Link>{" "}
                ·{" "}
                <Link href={`${fichaJugador(c.jugador.nombre)}&pestana=seguimiento`} className="underline underline-offset-2 hover:text-white">
                  su seguimiento
                </Link>
              </p>
            )}
            <div className="mt-auto pt-3">
              {c.ir.href ? (
                <Link href={c.ir.href} className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-medium text-[#C8A96B] hover:underline">
                  {c.ir.texto} <ArrowRight size={14} />
                </Link>
              ) : onIr && c.ir.area ? (
                <button type="button" onClick={() => onIr(c.ir.area!)} className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-medium text-[#C8A96B] hover:underline">
                  {c.ir.texto} <ArrowRight size={14} />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
