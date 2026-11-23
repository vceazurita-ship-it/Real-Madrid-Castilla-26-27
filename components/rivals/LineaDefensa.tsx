"use client";

/**
 * EL RIVAL CON LÍNEA DE 5 Y CON LÍNEA DE 4: QUÉ CAMBIA
 * (Scout colectivo, 21/11/2026, idea de X). Parte sus partidos de esta
 * temporada según el sistema que trae Wyscout en cada uno (3 centrales o 4
 * defensas) y compara, por partido, xG y remates en contra, PPDA, centros
 * que le hacen y puntos. Si ha cambiado de sistema, se marca el partido del
 * cambio, y la columna que se resalta por defecto es la de sus últimos 3.
 *
 * Datos: `/api/data-analisis` (Wyscout, con la copia del aparato, el mismo
 * pedido que «Datos del rival»). Cuentas en `lib/rivals/linea-defensa.ts`.
 * Nada se pide hasta que asoma; si sólo ha jugado de una manera, no se pinta.
 */

import { useEffect, useMemo, useState } from "react";

import { MEJOR, PEOR } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { competicionPrincipal } from "@/lib/data-analisis/equipo";
import type { FilaPartido } from "@/lib/data-analisis/leer";
import { temporadaDe } from "@/lib/data-analisis/metricas";
import { traeJson } from "@/lib/hojaCsv";
import { mismoClub } from "@/lib/rivals/mismoClub";
import {
  cambioDeLinea,
  LINEAS,
  lineaReciente,
  partidosConLinea,
  resumeLinea,
  ULTIMOS,
  type Linea,
  type ResumenLinea,
} from "@/lib/rivals/linea-defensa";

const dec = (v: number | null, n = 2) => (v == null ? "—" : v.toFixed(n).replace(".", ","));
const fecha = (f: string) => {
  const [, m, d] = f.split("-");
  return d && m ? `${d}/${m}` : f;
};

const NOMBRE: Record<Linea, string> = { "3": "Con 3 centrales", "4": "Con 4 defensas" };
const SUB: Record<Linea, string> = { "3": "línea de 5", "4": "línea de 4" };

/** Las filas de la tabla: cuál es mejor para él (bajo o alto). */
const FILAS: { k: keyof Omit<ResumenLinea, "partidos" | "sistemas">; nombre: string; corto: string; d: number; bajoEsBueno: boolean; nota: string }[] = [
  { k: "xgContra", nombre: "xG en contra", corto: "el xG en contra", d: 2, bajoEsBueno: true, nota: "lo que valen las ocasiones que concede" },
  { k: "remContra", nombre: "Remates en contra", corto: "los remates en contra", d: 1, bajoEsBueno: true, nota: "los que le hacen" },
  { k: "ppda", nombre: "PPDA", corto: "el PPDA", d: 1, bajoEsBueno: true, nota: "más bajo = presiona más arriba" },
  { k: "centrosContra", nombre: "Centros que le hacen", corto: "los centros que le hacen", d: 1, bajoEsBueno: true, nota: "los centros del rival en ese partido" },
  { k: "puntos", nombre: "Puntos por partido", corto: "los puntos", d: 2, bajoEsBueno: false, nota: "3 ganar, 1 empatar" },
];

export function LineaDefensa({ equipo }: { equipo: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && equipo && <Bloque equipo={equipo} />}</div>;
}

function useLiga() {
  const [filas, setFilas] = useState<FilaPartido[] | null>(null);
  useEffect(() => {
    let vivo = true;
    traeJson<{ ok?: boolean; partidos?: FilaPartido[] }>("/api/data-analisis")
      .then((r) => {
        if (!vivo) return;
        const partidos = r?.ok ? r.partidos ?? [] : [];
        const actual = [...new Set(partidos.map((p) => temporadaDe(p.fecha)))].filter(Boolean).sort().reverse()[0] ?? "";
        setFilas(partidos.filter((p) => temporadaDe(p.fecha) === actual));
      })
      .catch(() => {
        if (vivo) setFilas([]);
      });
    return () => {
      vivo = false;
    };
  }, []);
  return filas;
}

function Bloque({ equipo }: { equipo: string }) {
  const filas = useLiga();

  const datos = useMemo(() => {
    if (!filas?.length) return null;
    const nombres = [...new Set(filas.map((f) => f.equipo))];
    const wys = nombres.find((e) => e === equipo) ?? nombres.find((e) => mismoClub(e, equipo));
    if (!wys) return null;
    const competicion = competicionPrincipal(filas.filter((f) => f.equipo === wys));
    const partidos = partidosConLinea(filas, wys, competicion);
    const por = Object.fromEntries(LINEAS.map((l) => [l, partidos.filter((p) => p.linea === l)])) as Record<Linea, typeof partidos>;
    if (!por["3"].length || !por["4"].length) return null;
    const reciente = lineaReciente(partidos);
    return {
      partidos,
      resumen: Object.fromEntries(LINEAS.map((l) => [l, resumeLinea(por[l])])) as Record<Linea, ResumenLinea>,
      reciente,
      cambio: cambioDeLinea(partidos, reciente),
    };
  }, [filas, equipo]);

  const [elegida, setElegida] = useState<Linea | null>(null);

  if (filas === null) {
    return (
      <section id="x-idea-2123838636231987322-1" aria-label="Línea de 5 o línea de 4" className="portada-tarjeta mt-8 min-w-0 px-4 py-4 sm:px-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">Línea de 5 o línea de 4 · qué cambia</p>
        <p className="mt-1 text-sm text-white/60">Leyendo sus partidos en Wyscout…</p>
      </section>
    );
  }
  if (!datos) return null;

  const { partidos, resumen, reciente, cambio } = datos;
  const activa: Linea = elegida ?? reciente ?? "4";
  const otra: Linea = activa === "3" ? "4" : "3";
  const pocos = Math.min(resumen["3"].partidos, resumen["4"].partidos) < 3;

  /* Las dos diferencias más claras (en % sobre la otra columna), para el titular. */
  const dif = FILAS.map((f) => {
    const a = resumen[activa][f.k];
    const b = resumen[otra][f.k];
    if (a == null || b == null || !b) return null;
    const rel = (a - b) / Math.abs(b);
    return { ...f, a, b, rel, peor: f.bajoEsBueno ? rel > 0 : rel < 0 };
  })
    .filter((x): x is NonNullable<typeof x> => x != null && Math.abs(x.rel) >= 0.1)
    .sort((x, y) => Math.abs(y.rel) - Math.abs(x.rel))
    .slice(0, 2);

  const titular = cambio
    ? `Desde su ${cambio.orden}.º partido juega con ${SUB[cambio.linea]}`
    : `Alterna: ${resumen["3"].partidos} con línea de 5 y ${resumen["4"].partidos} con línea de 4`;
  const frase =
    `En sus últimos ${Math.min(ULTIMOS, partidos.length)} partidos, ${NOMBRE[reciente ?? activa].toLowerCase()}: se prepara contra esa columna` +
    (dif.length
      ? `. Con ${SUB[activa]}, ${dif.map((d) => `${d.corto}, ${dec(d.a, d.d)} (con ${SUB[otra]}, ${dec(d.b, d.d)})`).join(" y ")}.`
      : `; con ${SUB[activa]} las cifras se parecen a las de ${SUB[otra]}.`);

  return (
    <section id="x-idea-2123838636231987322-1" aria-label="Línea de 5 o línea de 4" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Línea de 5 o línea de 4 · qué cambia
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Wyscout, {partidos.length} partidos de liga esta temporada
        </span>
        {pocos && (
          <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-amber-300">tendencia</span>
        )}
      </p>
      <h3 className="fuente-club mt-1.5 text-[24px] font-bold uppercase leading-[1.05] text-white sm:text-[30px]">{titular}</h3>
      <p className="mt-1 text-sm leading-6 text-white/70">{frase}</p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[20rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Por partido</th>
              {LINEAS.map((l) => (
                <th key={l} scope="col" className="px-1 py-1 text-right">
                  <button
                    type="button"
                    aria-pressed={activa === l}
                    onClick={() => setElegida(l)}
                    className={`w-full rounded-lg border px-2 py-1.5 text-right transition ${
                      activa === l ? "border-[#C8A96B]/60 bg-[#C8A96B]/10 text-white" : "border-white/10 text-white/60 hover:border-white/25"
                    }`}
                  >
                    <span className="block text-[12px] font-bold uppercase tracking-[0.08em]">{NOMBRE[l]}</span>
                    <span className="block text-[11px] font-medium normal-case text-white/55">
                      {SUB[l]} · {resumen[l].partidos} {resumen[l].partidos === 1 ? "partido" : "partidos"}
                      {reciente === l ? " · últimos 3" : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f) => {
              const a = resumen["3"][f.k];
              const b = resumen["4"][f.k];
              const mejor: Linea | null = a == null || b == null || a === b ? null : (a < b) === f.bajoEsBueno ? "3" : "4";
              return (
                <tr key={f.k}>
                  <th scope="row" className="border-t border-white/10 px-2 py-2 text-left font-semibold text-white/85">
                    {f.nombre}
                    <span className="block text-[11px] font-normal text-white/50">{f.nota}</span>
                  </th>
                  {LINEAS.map((l) => {
                    const v = resumen[l][f.k];
                    return (
                      <td key={l} className={`border-t border-white/10 px-3 py-2 text-right tabular-nums ${activa === l ? "bg-[#C8A96B]/[0.06]" : ""}`}>
                        <span className={`fuente-club text-[20px] font-bold ${activa === l ? "text-white" : "text-white/65"}`}>{dec(v, f.d)}</span>
                        {mejor && (
                          <span className="ml-1.5 text-[11px] font-semibold" style={{ color: mejor === l ? MEJOR : PEOR }}>
                            {mejor === l ? "▲" : "▼"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <th scope="row" className="border-t border-white/10 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Sistemas</th>
              {LINEAS.map((l) => (
                <td key={l} className="border-t border-white/10 px-3 py-2 text-right text-[12px] text-white/60">
                  {resumen[l].sistemas.map((s) => `${s.sistema} ×${s.n}`).join(" · ")}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Partido a partido, en orden: el color dice el sistema; el cambio va marcado. */}
      <ol aria-label="Sus partidos, en orden, con su sistema" className="mt-3 flex flex-wrap gap-1.5">
        {partidos.map((p) => {
          const esCambio = cambio != null && p.orden === cambio.orden && p.fecha === cambio.fecha;
          return (
            <li
              key={`${p.fecha}-${p.rival}`}
              title={`${p.orden}.º · ${fecha(p.fecha)} contra ${p.rival} · ${p.sistema} · ${p.marcador}`}
              className={`rounded-md border px-1.5 py-1 text-center text-[11px] leading-4 tabular-nums ${
                p.linea === activa ? "border-[#C8A96B]/50 bg-[#C8A96B]/10 text-white" : "border-white/10 text-white/55"
              } ${esCambio ? "ring-2 ring-[#C8A96B]" : ""}`}
            >
              <span className="block font-bold">{p.orden}.º</span>
              <span className="block">{p.sistema}</span>
              {esCambio && <span className="block text-[10px] font-bold uppercase text-[#C8A96B]">cambio</span>}
            </li>
          );
        })}
      </ol>
      {cambio && (
        <p className="mt-1.5 text-[12px] text-white/65">
          Cambio: su {cambio.orden}.º partido de liga, el {fecha(cambio.fecha)} contra {cambio.rival} ({cambio.sistema}, {cambio.marcador}).
        </p>
      )}

      <p className="mt-2 text-[11px] leading-5 text-white/55">
        El sistema de cada partido es el de más tiempo según Wyscout («Seleccionar esquema»): si empieza por 3 o por 5, con 3 centrales; si empieza por 4, con 4 defensas.
        Medias por partido de su liga esta temporada. Centros que le hacen: los centros del otro equipo en ese partido. ▲/▼: mejor o peor para él entre las dos columnas.
        Por defecto se resalta el sistema de sus últimos {ULTIMOS} partidos; pinchar una columna la resalta. Con menos de 3 partidos en una de las dos, «tendencia».
      </p>
    </section>
  );
}
