"use client";

/**
 * CLASIFICACIÓN JUSTA (Análisis de datos → Un equipo de un vistazo,
 * 13/11/2026): la tabla real del grupo del Castilla frente a la de puntos
 * esperados por xG, con lo que cada equipo tiene de más o de menos. Separa la
 * suerte del rendimiento, nosotros incluidos.
 *
 * Datos: `opta:partidos` por `useOptaLigero` (la misma descarga que la
 * portada). Las cuentas, en `lib/data-analisis/clasificacion-justa.ts`. El
 * próximo rival, del calendario de BeSoccer cruzado con Opta por `casaEquipo`.
 * Nada se pide hasta que asoma.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { COMPARADO, MEJOR, ORO, PEOR, tinta, useEscudos } from "@/components/data/graficas";
import { cargaCalendario } from "@/hooks/useCalendario";
import { proximoPartido } from "@/lib/castilla/calendario";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { clasificacionJusta, jornadasDe, type FilaJusta } from "@/lib/data-analisis/clasificacion-justa";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";

const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const conSigno = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${coma(Math.abs(v))}`;

/** Menos de 1,5 puntos de diferencia no se cuenta como suerte. */
const UMBRAL = 1.5;

export function ClasificacionJusta() {
  const caja = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const el = caja.current;
    if (!el || abierto) return;
    const io = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setAbierto(true);
    }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [abierto]);

  return <div ref={caja} className="min-w-0">{abierto && <Bloque />}</div>;
}

export function useProximoRival(): string {
  const [proximo, setProximo] = useState("");
  useEffect(() => {
    let vivo = true;
    void cargaCalendario().then((partidos) => {
      /* El mismo corte que la portada (13/11/2026; 21/11/2026, la misma función
         `proximoPartido` en todas las pantallas): hora de Madrid y 2 h 30 de gracia. */
      const sig = proximoPartido(partidos, Date.now());
      if (vivo) setProximo(sig?.rival ?? "");
    });
    return () => {
      vivo = false;
    };
  }, []);
  return proximo;
}

function Bloque() {
  const { opta, cargando } = useOptaLigero();
  const proximo = useProximoRival();
  const [elegida, setElegida] = useState<number | null>(null);

  const base = useMemo(() => {
    if (!opta) return null;
    const g = opta.grupos.get(CASTILLA_OPTA);
    if (g == null) return null;
    const grupo = new Set([...opta.grupos.entries()].filter(([, n]) => n === g).map(([id]) => id));
    return { grupo, jornadas: jornadasDe(opta.partidos, grupo) };
  }, [opta]);

  const rivalId = useMemo(() => {
    if (!opta || !proximo) return null;
    const equipos = opta.equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = casaEquipo(proximo, equipos);
    return id && id !== CASTILLA_OPTA ? id : null;
  }, [opta, proximo]);

  const hasta = base ? Math.min(elegida ?? base.jornadas, base.jornadas) : 0;
  const filas = useMemo(() => (opta && base && hasta ? clasificacionJusta(opta.partidos, base.grupo, hasta) : []), [opta, base, hasta]);

  if (!opta) return cargando ? <p className="mt-6 text-sm text-white/50">Cargando Opta…</p> : null;
  if (!base || !filas.length) return null;

  const justa = [...filas].sort((a, b) => a.puestoJusto - b.puestoJusto);
  const nuestra = filas.find((f) => f.teamId === CASTILLA_OPTA);
  const masSuerte = [...filas].sort((a, b) => b.dif - a.dif)[0];
  const menosSuerte = [...filas].sort((a, b) => a.dif - b.dif)[0];

  const resalte = (f: FilaJusta) => (f.teamId === CASTILLA_OPTA ? ORO : f.teamId === rivalId ? COMPARADO : null);

  return (
    <section id="x-idea-2120812068043685956-m" aria-label="Clasificación justa" className="portada-tarjeta portada-entra mt-4 min-w-0 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
            Clasificación justa · puntos reales contra xPts
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">dato · Opta, modelo por xG</span>
          </p>
          {nuestra && (
            <h3 className="fuente-club mt-1.5 text-[24px] font-bold uppercase leading-[1.05] text-white sm:text-[30px]">
              {Math.abs(nuestra.dif) < UMBRAL
                ? `Castilla: ${nuestra.puntos} puntos, los que merece`
                : nuestra.dif > 0
                  ? `Castilla: ${nuestra.puntos} puntos, ${coma(nuestra.dif)} más de los que merece`
                  : `Castilla: ${nuestra.puntos} puntos, merecería ${coma(nuestra.xPts)}`}
            </h3>
          )}
          <p className="mt-1 text-sm leading-6 text-white/70">
            Los puntos que tiene cada equipo de nuestro grupo frente a los que le darían sus ocasiones y las del rival (xPts).
            {nuestra && (
              <>
                {" "}El Castilla tiene {nuestra.puntos} y merecería {coma(nuestra.xPts)}:{" "}
                {Math.abs(nuestra.dif) < UMBRAL
                  ? "la tabla dice lo que jugamos."
                  : nuestra.dif > 0
                    ? `${coma(nuestra.dif)} de más; la tabla nos trata mejor que el juego.`
                    : `${coma(-nuestra.dif)} de menos; jugamos mejor de lo que dice la tabla.`}
              </>
            )}
            {masSuerte.dif >= UMBRAL && ` Más por encima: ${masSuerte.equipo} (${conSigno(masSuerte.dif)}).`}
            {menosSuerte.dif <= -UMBRAL && ` Más por debajo: ${menosSuerte.equipo} (${conSigno(menosSuerte.dif)}).`}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs text-white/60">
          Hasta la jornada
          <select
            value={hasta}
            onChange={(e) => setElegida(Number(e.target.value))}
            className="rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-sm text-white"
          >
            {Array.from({ length: base.jornadas }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/*
        COMO EL ORIGINAL DE X (16/11/2026, petición del analista: «el mismo diseño
        adaptado a nuestra hoja de estilo»): las dos clasificaciones enfrentadas y
        unidas por una curva por equipo, del puesto real al que merece. Antes eran
        dos tablas sueltas y había que buscar a cada equipo en las dos.
      */}
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-5 rounded-full" style={{ background: PEOR }} />Va más arriba de lo que merece</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-5 rounded-full" style={{ background: MEJOR }} />Merece estar más arriba</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-5 rounded-full" style={{ background: tinta(0.3) }} />Parecido (±1 puesto)</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ORO }} />Real Madrid Castilla</span>
        {rivalId && <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COMPARADO }} />Próximo rival</span>}
      </p>

      <Cruce filas={filas} justa={justa} resalte={resalte} rivalId={rivalId} />

      <p className="mt-3 text-[11px] leading-5 text-white/45">
        Cada partido: goles de cada equipo como Poisson independiente con media su xG; xPts = 3 × P(ganar) + P(empatar). «Jornada N» = los N primeros partidos de cada equipo con xG.
        Cada curva une el puesto real de un equipo con el que merecería por sus ocasiones; en la columna real, ▲▼ es puntos − xPts cuando pasa de 1,5 (en el ordenador).
      </p>
    </section>
  );
}

const FILA = 26;

/** Color de la curva: hacia dónde se mueve del puesto real al justo. */
const colorCurva = (f: FilaJusta) => {
  const mueve = f.puestoReal - f.puestoJusto;
  if (Math.abs(mueve) <= 1) return tinta(0.28);
  return mueve > 0 ? MEJOR : PEOR;
};

function Cruce({
  filas,
  justa,
  resalte,
  rivalId,
}: {
  filas: FilaJusta[];
  justa: FilaJusta[];
  resalte: (f: FilaJusta) => string | null;
  rivalId: string | null;
}) {
  const escudoDe = useEscudos();
  const n = filas.length;
  const alto = n * FILA;
  const y = (puesto: number) => (puesto - 0.5) * FILA;
  /* Los resaltados, encima de todo. */
  const ordenDibujo = [...filas].sort((a, b) => Number(Boolean(resalte(a))) - Number(Boolean(resalte(b))));

  const lista = (orden: FilaJusta[], lado: "real" | "justa") => (
    <ol className="min-w-0">
      {orden.map((f) => {
        const color = resalte(f);
        const puesto = lado === "real" ? f.puestoReal : f.puestoJusto;
        const escudo = escudoDe(f.equipo);
        const valor = lado === "real" ? String(f.puntos) : coma(f.xPts);
        let marca: ReactNode = null;
        if (lado === "real" && Math.abs(f.dif) >= UMBRAL)
          marca = (
            <span className="max-sm:hidden" style={{ color: f.dif < 0 ? MEJOR : PEOR }}>
              {f.dif < 0 ? "▲" : "▼"}
              {coma(Math.abs(f.dif))}
            </span>
          );
        return (
          <li
            key={f.teamId}
            className="flex items-center gap-1.5 px-1.5 text-xs"
            style={{
              height: FILA,
              ...(color ? { background: `color-mix(in srgb, ${color} 16%, transparent)`, boxShadow: `inset ${lado === "real" ? "3px" : "-3px"} 0 0 ${color}` } : {}),
            }}
            title={`${f.equipo} · ${f.puntos} puntos y ${coma(f.xPts)} xPts · ${f.puestoReal}.º en la real y ${f.puestoJusto}.º en la justa · xG ${coma(f.xgf)}-${coma(f.xgc)} en ${f.partidos} partidos`}
          >
            <span className="w-4 shrink-0 text-right tabular-nums text-white/45">{puesto}</span>
            {escudo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={escudo} alt="" width={14} height={14} className="h-3.5 w-3.5 shrink-0 object-contain max-sm:hidden" />
            ) : null}
            <span className={`min-w-0 flex-1 truncate ${color ? "font-semibold text-white" : "text-white/80"}`}>{f.equipo}</span>
            {marca && <span className="shrink-0 text-[10px] tabular-nums">{marca}</span>}
            <span className="shrink-0 tabular-nums font-semibold text-white">{valor}</span>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="mt-3 min-w-0">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(2.5rem,22%)_minmax(0,1fr)] items-end text-[11px] font-semibold uppercase tracking-wider text-white/60">
        <p className="px-1.5 pb-1">Real · puntos</p>
        <span />
        <p className="px-1.5 pb-1 text-right">Según sus ocasiones · xPts</p>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(2.5rem,22%)_minmax(0,1fr)] overflow-hidden rounded-xl border border-white/10">
        {lista(filas, "real")}
        <svg viewBox={`0 0 100 ${alto}`} preserveAspectRatio="none" className="block h-full w-full" style={{ height: alto }} role="img" aria-label="Del puesto real al que merece cada equipo por sus ocasiones">
          {ordenDibujo.map((f) => {
            const y1 = y(f.puestoReal);
            const y2 = y(f.puestoJusto);
            const destacado = resalte(f);
            return (
              <path
                key={f.teamId}
                d={`M0,${y1} C50,${y1} 50,${y2} 100,${y2}`}
                vectorEffect="non-scaling-stroke"
                style={{ fill: "none", stroke: colorCurva(f), strokeWidth: destacado ? 4 : 2, opacity: destacado ? 1 : 0.8, strokeLinecap: "round" }}
              >
                <title>{`${f.equipo}: ${f.puestoReal}.º en la real → ${f.puestoJusto}.º en la justa${f.teamId === rivalId ? " (próximo rival)" : ""}`}</title>
              </path>
            );
          })}
        </svg>
        {lista(justa, "justa")}
      </div>
    </div>
  );
}
