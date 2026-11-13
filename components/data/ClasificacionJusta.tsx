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

import { COMPARADO, MEJOR, ORO, PEOR } from "@/components/data/graficas";
import { cargaCalendario } from "@/hooks/useCalendario";
import { alrededorDe } from "@/lib/castilla/calendario";
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

function useProximoRival(): string {
  const [proximo, setProximo] = useState("");
  useEffect(() => {
    let vivo = true;
    void cargaCalendario().then((partidos) => {
      /* El mismo corte que la portada (13/11/2026): el de hoy deja de ser el
         próximo en cuanto tiene marcador o pasan 2 h 30 desde su hora. */
      const ahora = Date.now();
      const pendientes = partidos.filter((p) => !(p.golesLocal !== null && p.golesVisitante !== null && Date.parse(p.cuando) <= ahora));
      const sig = alrededorDe(pendientes, ahora).proximo;
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
    <section aria-label="Clasificación justa" className="mt-4 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-white">
            Clasificación justa
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">dato · Opta, modelo por xG</span>
          </p>
          <p className="mt-1 text-sm leading-6 text-white/75">
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

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ORO }} />Real Madrid Castilla</span>
        {rivalId && <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COMPARADO }} />Próximo rival</span>}
        <span><span style={{ color: MEJOR }}>▲</span> merece más de lo que tiene · <span style={{ color: PEOR }}>▼</span> tiene más de lo que merece</span>
      </p>

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
        <Tabla titulo="Real (puntos)" filas={filas} valor={(f) => String(f.puntos)} resalte={resalte} lado="real" />
        <Tabla titulo="Justa (xPts)" filas={justa} valor={(f) => coma(f.xPts)} resalte={resalte} lado="justa" />
      </div>

      <p className="mt-3 text-[11px] leading-5 text-white/45">
        Cada partido: goles de cada equipo como Poisson independiente con media su xG; xPts = 3 × P(ganar) + P(empatar). «Jornada N» = los N primeros partidos de cada equipo con xG.
        En la tabla real, la diferencia es puntos − xPts; en la justa, los puestos que sube o baja respecto a la real.
      </p>
    </section>
  );
}

function Tabla({
  titulo,
  filas,
  valor,
  resalte,
  lado,
}: {
  titulo: string;
  filas: FilaJusta[];
  valor: (f: FilaJusta) => string;
  resalte: (f: FilaJusta) => string | null;
  lado: "real" | "justa";
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-white/10">
      <p className="border-b border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">{titulo}</p>
      <ol>
        {filas.map((f) => {
          const color = resalte(f);
          const puesto = lado === "real" ? f.puestoReal : f.puestoJusto;
          let marca: ReactNode = null;
          if (lado === "real") {
            if (Math.abs(f.dif) >= UMBRAL)
              marca = (
                <span style={{ color: f.dif < 0 ? MEJOR : PEOR }} title={`${f.puntos} puntos y ${coma(f.xPts)} xPts`}>
                  {f.dif < 0 ? "▲" : "▼"}
                  {coma(Math.abs(f.dif))}
                </span>
              );
            else marca = <span className="text-white/35" title={`${f.puntos} puntos y ${coma(f.xPts)} xPts`}>=</span>;
          } else {
            const mueve = f.puestoReal - f.puestoJusto;
            marca = mueve ? (
              <span style={{ color: mueve > 0 ? MEJOR : PEOR }} title={`${f.puestoReal}º en la real`}>
                {mueve > 0 ? "▲" : "▼"}
                {Math.abs(mueve)}
              </span>
            ) : (
              <span className="text-white/35" title={`${f.puestoReal}º en la real`}>=</span>
            );
          }
          return (
            <li
              key={f.teamId}
              className="flex items-center gap-1.5 border-b border-white/5 px-2 py-1 text-xs last:border-b-0 sm:gap-2"
              style={color ? { background: `color-mix(in srgb, ${color} 16%, transparent)`, boxShadow: `inset 3px 0 0 ${color}` } : undefined}
            >
              <span className="w-5 shrink-0 text-right tabular-nums text-white/45">{puesto}</span>
              <span className={`min-w-0 flex-1 truncate ${color ? "font-semibold text-white" : "text-white/80"}`} title={`${f.equipo} · ${f.partidos} partidos · xG ${coma(f.xgf)}-${coma(f.xgc)}`}>
                {f.equipo}
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-white">{valor(f)}</span>
              <span className="w-9 shrink-0 text-right text-[10px] tabular-nums sm:w-10 sm:text-[11px]">{marca}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
