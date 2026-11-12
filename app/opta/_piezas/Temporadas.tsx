"use client";

/**
 * TEMPORADA A TEMPORADA en la ficha del jugador (10/11/2026).
 *
 * Si el `playerId` está en `opta:hist:<temporada>:jugadores`, una tarjeta por
 * temporada (la actual sale de `opta:jugadores`) con su equipo, minutos,
 * partidos y lo principal, y con quién se compara cada una: las tablas
 * pasadas no traen lo mismo (25/26 sólo el grupo del Castilla, 24/25 el
 * grupo 1). Si no aparece en una temporada, esa no se pinta; si no aparece
 * en ninguna pasada, no sale nada.
 *
 * 12/11/2026: las tablas pasadas de Opta no traen la temporada entera de
 * cada equipo (25/26: 2 o 3 partidos de casi todos, 3 del Castilla). Se mide
 * con `partidosPorEquipo` y una tarjeta de una temporada incompleta lo dice y
 * no da percentil. Con `wyscout` (la ficha de /individual), la temporada
 * pasada se completa con Wyscout, que sí la tiene entera
 * (`lib/data-analisis/temporada-anterior.ts`).
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { colorPercentil } from "@/components/data/graficas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { casaTemporadaAnterior, tarjetaWyscout, type MetricaTemporada, type TarjetaWyscout } from "@/lib/data-analisis/temporada-anterior";
import { traeJson } from "@/lib/hojaCsv";
import { aObjetos, CASTILLA_OPTA, num, PUESTO_OPTA, type TablaOpta } from "@/lib/opta";
import { COMPARADOS_MIN, partidosPorEquipo, tarjetaTemporada, type TarjetaTemporada } from "@/lib/opta-talento";

import { dec } from "./eventos";
import type { DatosOpta } from "./useOpta";

type Temporada = { clave: string; nombre?: string; actual?: boolean };

/** Si aún no hay índice, las que se sabe que existen. */
const CONOCIDAS: Temporada[] = [{ clave: "2025-2026" }, { clave: "2024-2025" }];

/** Con quién se compara cada temporada pasada (la tabla no lo dice). */
const POBLACION: Record<string, string> = { "2025-2026": "del grupo del Castilla", "2024-2025": "del grupo 1" };

/** «2025-2026» → «25/26». */
const corta = (clave: string) => {
  const [a, b] = clave.split("-");
  return a && b ? `${a.slice(2)}/${b.slice(2)}` : clave;
};

/** «2026-2027» → «2025-2026». */
const anteriorA = (clave: string) => {
  const [a, b] = clave.split("-").map(Number);
  return a && b ? `${a - 1}-${b - 1}` : "";
};

/** Las filas de Wyscout de /api/data-analisis (null mientras llegan; [] si no llegan). */
function useWyscout(activo: boolean) {
  const [jugadores, setJugadores] = useState<FilaJugador[] | null>(activo ? null : []);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    /* En frío la primera respuesta puede llegar sin jugadores: se reintenta una vez. */
    const pide = async () => {
      for (let intento = 0; intento < 2 && vivo; intento++) {
        try {
          const r = await traeJson<{ jugadores?: FilaJugador[] }>("/api/data-analisis", { forzar: intento > 0 });
          if (r?.jugadores?.length) return r.jugadores;
        } catch {
          /* se reintenta */
        }
      }
      return [];
    };
    void pide().then((lista) => vivo && setJugadores(lista));
    return () => {
      vivo = false;
    };
  }, [activo]);
  return jugadores;
}

type Tarjeta = (TarjetaTemporada & { tipo: "opta"; poblacion: string }) | { tipo: "wyscout"; clave: string; w: TarjetaWyscout };

export function TemporadasJugador({
  datos,
  playerId,
  minimo,
  wyscout,
  sinPasado,
}: {
  datos: DatosOpta;
  playerId: string;
  minimo: number;
  /** Nombre de la plantilla: con él, la temporada pasada se completa con Wyscout. */
  wyscout?: { nombre: string; apodo?: string };
  /** Lo que se enseña si no hay ninguna temporada pasada (si no, nada). */
  sinPasado?: ReactNode;
}) {
  const indice = useDocsOpta<[{ temporadas?: Temporada[] }]>("opta:temporadas");
  const lista = useMemo(() => indice.docs[0]?.temporadas ?? [], [indice.docs]);
  const pasadas = useMemo(() => {
    const xs = lista.filter((t) => !t.actual);
    return xs.length ? xs : CONOCIDAS;
  }, [lista]);
  const actual = lista.find((t) => t.actual);
  const hist = useDocsOpta<TablaOpta[]>(...pasadas.map((t) => `opta:hist:${t.clave}:jugadores`));
  const filasWyscout = useWyscout(Boolean(wyscout));

  /* La temporada cerrada de Wyscout es la anterior a la de ahora. */
  const claveAnterior = actual ? anteriorA(actual.clave) : ([...pasadas].map((t) => t.clave).sort().at(-1) ?? "");

  const tarjetas = useMemo(() => {
    const salida: Tarjeta[] = [];
    pasadas.forEach((t, i) => {
      const filas = aObjetos(hist.docs[i] as TablaOpta | null);
      const tj = filas.length ? tarjetaTemporada(t.clave, filas, playerId, minimo, partidosPorEquipo(filas)) : null;
      if (tj) salida.push({ ...tj, tipo: "opta", poblacion: POBLACION[t.clave] ?? "de esa temporada" });
    });

    /* Wyscout, sólo donde Opta no tiene la temporada entera (o no le tiene). */
    const optaAnterior = salida.find((t) => t.clave === claveAnterior);
    const hace = !optaAnterior || (optaAnterior.tipo === "opta" && optaAnterior.incompleta);
    if (wyscout && filasWyscout?.length && claveAnterior && hace) {
      /* Su edad de ahora en Opta, para no tomar a un tocayo si Wyscout no le tiene este año. */
      const edad = num(datos.jugadores.find((f) => String(f.playerId ?? "") === playerId)?.Age);
      const fila = casaTemporadaAnterior(wyscout.nombre, wyscout.apodo, filasWyscout, edad);
      if (fila) salida.push({ tipo: "wyscout", clave: claveAnterior, w: tarjetaWyscout(fila, filasWyscout) });
    }

    const hoy = tarjetaTemporada(actual?.clave ?? "actual", datos.jugadores, playerId, minimo);
    if (hoy) salida.push({ ...hoy, tipo: "opta", poblacion: "de toda la categoría" });
    /* Por temporada; dentro de la misma, Opta y luego Wyscout. */
    const orden = (t: Tarjeta) => (t.clave === "actual" ? "9999" : t.clave) + (t.tipo === "wyscout" ? "w" : "");
    return salida.sort((a, b) => orden(a).localeCompare(orden(b)));
  }, [pasadas, hist.docs, actual, datos.jugadores, playerId, minimo, wyscout, filasWyscout, claveAnterior]);

  const conWyscout = tarjetas.some((t) => t.tipo === "wyscout");

  if (indice.cargando || hist.cargando) return null;
  /* Sólo tiene sentido si sale en alguna temporada pasada (de Opta o de Wyscout). */
  if (tarjetas.length < 2) {
    if (wyscout && filasWyscout === null) return <p className="text-[12px] text-white/55">Buscando su temporada pasada en Wyscout…</p>;
    return sinPasado ? <>{sinPasado}</> : null;
  }

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <h3 className="text-sm font-semibold text-white">Temporada a temporada</h3>
      <p className="mt-0.5 text-xs text-white/55">
        Totales de cada temporada; debajo, por 90 y su percentil frente a los de su puesto con {minimo}′ o más de esa misma tabla
        {conWyscout ? ". La tarjeta de Wyscout es la temporada entera, con su percentil frente a los de su puesto de toda la categoría con 450′ o más." : "."}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tarjetas.map((t) =>
          t.tipo === "wyscout" ? (
            <TarjetaDeWyscout key={`${t.clave}-w`} clave={t.clave} w={t.w} />
          ) : (
            <TarjetaDeOpta key={t.clave} t={t} minimo={minimo} completaEnWyscout={conWyscout && t.clave === claveAnterior} />
          ),
        )}
      </div>
    </div>
  );
}

function TarjetaDeOpta({ t, minimo, completaEnWyscout }: { t: TarjetaTemporada & { poblacion: string }; minimo: number; completaEnWyscout: boolean }) {
  const equipoCorto = t.teamId === CASTILLA_OPTA ? "Castilla" : t.equipo;
  const pie = t.incompleta
    ? `Opta sólo tiene ${t.partidosEquipo} ${t.partidosEquipo === 1 ? "partido" : "partidos"} del ${equipoCorto} de la ${corta(t.clave)}: lo de esta tarjeta es sólo de ${t.partidosEquipo === 1 ? "ese partido" : "esos partidos"} y no lleva percentil.${completaEnWyscout ? " La temporada entera, en la tarjeta de Wyscout." : ""}`
    : !t.familia
      ? ""
      : t.min < minimo
        ? `Con ${t.min}′ no llega al mínimo de ${minimo}′: sin percentil.`
        : t.comparados < COMPARADOS_MIN
          ? `En esa tabla sólo hay ${t.comparados} ${t.familia.toLowerCase()} ${t.poblacion} con ${minimo}′ o más${t.partidosEquipo != null ? " y la temporada entera en Opta" : ""}: muy pocos para dar percentil.`
          : `Frente a ${t.comparados} ${t.familia.toLowerCase()} ${t.poblacion}${t.partidosEquipo != null ? " con la temporada entera en Opta" : ""}.`;
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-base font-semibold text-white">
          {t.clave === "actual" ? "Esta temporada" : corta(t.clave)}
          <span className="ml-1.5 text-[11px] font-normal text-white/50">Opta{t.incompleta ? " · incompleta" : ""}</span>
        </p>
        <p className="truncate text-xs text-white/60">{t.equipo}</p>
      </div>
      <p className="mt-0.5 text-xs tabular-nums text-white/55">
        {[`${t.min}′`, t.partidos ? `${t.partidos} partidos` : "", PUESTO_OPTA[t.puesto] ?? ""].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {t.valores
          .filter((v) => v.total != null)
          .map((v) => (
            <div key={v.a} className="min-w-0">
              <p className="truncate text-[11px] text-white/50">{v.nombre}</p>
              <p className="text-sm font-semibold tabular-nums text-white">
                {v.total}
                {v.p90 != null && <span className="ml-1 text-[10px] font-normal text-white/45">{dec(v.p90)}/90</span>}
                {v.p != null && (
                  <span className="ml-1 text-[10px] font-semibold" style={{ color: colorPercentil(v.p) }}>
                    P{v.p}
                  </span>
                )}
              </p>
            </div>
          ))}
      </div>
      {pie && <p className="mt-2 text-[11px] text-white/45">{pie}</p>}
    </div>
  );
}

const cifra = (m: MetricaTemporada) => (m.unidad === "porcentaje" ? `${Math.round(m.valor)} %` : dec(m.valor));

function TarjetaDeWyscout({ clave, w }: { clave: string; w: TarjetaWyscout }) {
  const totales = [
    { rotulo: "Goles", valor: w.goles, detalle: w.xg != null ? `xG ${dec(w.xg)}` : "" },
    { rotulo: "Asistencias", valor: w.asistencias, detalle: w.xa != null ? `xA ${dec(w.xa)}` : "" },
  ].filter((x) => x.valor != null && w.puesto !== "POR");
  const pocas = w.metricas.some((m) => m.pocasAcciones && m.p == null);
  const grupo = w.puestoNombre.toLowerCase();
  const pie = w.sinMinimo
    ? `Con ${w.minutos}′ no llega a los ${w.minimo}′ de una temporada cerrada: sin percentil.`
    : w.contra === "solo"
      ? `Muy pocos ${grupo} en la categoría con ${w.minimo}′ o más para dar percentil.`
      : w.contra === "campo"
        ? `Frente a ${w.comparados} jugadores de campo de toda la categoría con ${w.minimo}′ o más (no hay bastantes ${grupo}).`
        : `Frente a ${w.comparados} ${grupo} de toda la categoría con ${w.minimo}′ o más.`;
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-base font-semibold text-white">
          {corta(clave)}
          <span className="ml-1.5 text-[11px] font-normal text-white/50">Wyscout · temporada completa</span>
        </p>
        <p className="truncate text-xs text-white/60">{w.equipo}</p>
      </div>
      <p className="mt-0.5 text-xs tabular-nums text-white/55">
        {[`${w.minutos}′`, w.partidos ? `${w.partidos} partidos` : "", w.puestoNombre].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {totales.map((x) => (
          <div key={x.rotulo} className="min-w-0">
            <p className="truncate text-[11px] text-white/50">{x.rotulo}</p>
            <p className="text-sm font-semibold tabular-nums text-white">
              {x.valor}
              {x.detalle && <span className="ml-1 text-[10px] font-normal text-white/45">{x.detalle}</span>}
            </p>
          </div>
        ))}
        {w.metricas.map((m) => (
          <div key={m.columna} className="min-w-0">
            <p className="truncate text-[11px] text-white/50" title={m.nombre}>
              {m.nombre}
            </p>
            <p className="text-sm font-semibold tabular-nums text-white">
              {cifra(m)}
              {m.unidad !== "porcentaje" && <span className="ml-0.5 text-[10px] font-normal text-white/45">/90</span>}
              {m.p != null && (
                <span className="ml-1 text-[10px] font-semibold" style={{ color: colorPercentil(m.p) }}>
                  P{m.p}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/45">
        {pie}
        {pocas && !w.sinMinimo && w.contra !== "solo" ? " Un porcentaje de muy pocas acciones va sin percentil." : ""}
      </p>
    </div>
  );
}
