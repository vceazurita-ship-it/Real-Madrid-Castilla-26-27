"use client";

/*
|--------------------------------------------------------------------------
| POR JUGADOR (19/10/2026)
|--------------------------------------------------------------------------
|
| La tabla que contesta «¿quién?» en robos, pérdidas y faltas: cuántas hace
| cada jugador del Castilla, dónde (un campo de 3 × 3 en miniatura, con el
| Castilla atacando hacia la derecha) y lo que sale después, en las columnas
| que le pase cada pantalla.
|
| No filtra nada por su cuenta: recibe las filas ya filtradas por la pantalla
| (partido, lado, lo pinchado) MENOS el propio jugador, para que al elegir
| uno se sigan viendo los demás con el elegido marcado. Pinchar un nombre
| llama a `onJugador`, que en las pantallas es el filtro cruzado «jugador».
|
| Se ordena por cualquier columna de cifras pulsando su cabecera; por defecto,
| por el total y de más a menos.
*/

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { TITULO_FILTRO } from "@/components/faltas/FiltrosCruzados";

const ZONAS = ["nuestro campo", "medio campo", "campo rival"] as const;
/* De arriba abajo, con el Castilla atacando hacia la derecha: la izquierda arriba. */
const CARRILES = ["izquierda", "centro", "derecha"] as const;

export type ColumnaJugador<F> =
  | {
      tipo?: "cuenta";
      clave: string;
      rotulo: string;
      /** Qué cuenta, en una frase: va en el `title` de la cabecera. */
      explica?: string;
      /** Las filas del jugador que entran en la cifra. */
      cumple: (fila: F) => boolean;
      /**
       * Sobre cuántas se saca el porcentaje (si no se da, sobre todas las
       * suyas). `null` = sin porcentaje.
       */
      sobre?: ((fila: F) => boolean) | null;
      /** Color de la cifra cuando no es cero (un `var()` o un hex medio). */
      color?: string;
    }
  | {
      tipo: "zonas";
      clave: string;
      rotulo: string;
      explica?: string;
      /** Qué filas se dibujan en el campo; todas si no se da. */
      cumple?: (fila: F) => boolean;
    };

type Sitio = { zona: string; carril: string };

type Linea<F> = {
  jugador: string;
  filas: F[];
  partidos: number;
  cifras: Record<string, number>;
};

/** El campo en miniatura: tres tercios por tres carriles, más oscuro donde hay más. */
function MiniCampo({ cuentas, maximo, titulo }: { cuentas: number[][]; maximo: number; titulo: string }) {
  return (
    <span
      role="img"
      aria-label={titulo}
      title={titulo}
      className="inline-grid shrink-0 grid-cols-3 gap-px rounded-[3px] p-px"
      style={{ background: "rgb(var(--rmcf-ink-rgb, 255 255 255) / 0.18)" }}
    >
      {CARRILES.map((_, c) =>
        ZONAS.map((__, z) => {
          const n = cuentas[c][z];

          return (
            <span
              key={`${c}-${z}`}
              className="block h-[9px] w-[13px]"
              style={{
                background: n
                  ? `rgba(200, 169, 107, ${0.25 + 0.75 * (n / Math.max(1, maximo))})`
                  : "rgb(var(--rmcf-ink-rgb, 255 255 255) / 0.05)",
              }}
            />
          );
        }),
      )}
    </span>
  );
}

const pct = (n: number, de: number) => (de ? Math.round((n / de) * 100) : 0);

export function PorJugador<F>({
  filas,
  jugadorDe,
  sitioDe,
  partidoDe,
  total,
  columnas,
  marcados,
  onJugador,
}: {
  /** Las filas de la pantalla, ya filtradas, sin el filtro de jugador. */
  filas: F[];
  /** El jugador de la fila; vacío si no se sabe (partidos mirados a ojo). */
  jugadorDe: (fila: F) => string;
  /** Tercio y carril en el campo de verdad («nuestro campo», «medio campo», «campo rival»). */
  sitioDe: (fila: F) => Sitio;
  /** De qué partido es la fila: con más de uno se cuenta en cuántos sale cada jugador. */
  partidoDe?: (fila: F) => string;
  total: { rotulo: string; explica?: string };
  columnas: ColumnaJugador<F>[];
  /** Los jugadores elegidos en el filtro de la pantalla. */
  marcados: string[];
  onJugador: (jugador: string) => void;
}) {
  const [orden, setOrden] = useState<{ clave: string; desc: boolean }>({ clave: "total", desc: true });

  const cuentas = columnas.filter((c) => c.tipo !== "zonas") as Extract<ColumnaJugador<F>, { cumple: (f: F) => boolean }>[];

  const lineas: Linea<F>[] = (() => {
    const porJugador = new Map<string, F[]>();

    for (const fila of filas) {
      const quien = jugadorDe(fila);

      if (!quien) continue;

      porJugador.set(quien, [...(porJugador.get(quien) ?? []), fila]);
    }

    return [...porJugador.entries()].map(([jugador, suyas]) => ({
      jugador,
      filas: suyas,
      partidos: partidoDe ? new Set(suyas.map(partidoDe)).size : 1,
      cifras: {
        total: suyas.length,
        partidos: partidoDe ? new Set(suyas.map(partidoDe)).size : 1,
        ...Object.fromEntries(cuentas.map((c) => [c.clave, suyas.filter(c.cumple).length])),
      },
    }));
  })();

  const ordenadas = [...lineas].sort((a, b) => {
    const d = (a.cifras[orden.clave] ?? 0) - (b.cifras[orden.clave] ?? 0);

    if (d !== 0) return orden.desc ? -d : d;

    return b.cifras.total - a.cifras.total || a.jugador.localeCompare(b.jugador, "es");
  });

  const variosPartidos = partidoDe ? new Set(filas.map(partidoDe)).size > 1 : false;

  const cabecera = (clave: string, rotulo: string, explica?: string) => {
    const activa = orden.clave === clave;

    return (
      <th key={clave} className="px-2 py-2.5 text-right font-medium" aria-sort={activa ? (orden.desc ? "descending" : "ascending") : "none"}>
        <button
          type="button"
          onClick={() => setOrden((antes) => ({ clave, desc: antes.clave === clave ? !antes.desc : true }))}
          title={explica ? `${explica}. Pulsa para ordenar` : "Pulsa para ordenar"}
          className={`inline-flex cursor-pointer items-center gap-1 uppercase tracking-[0.12em] transition hover:text-white/80 ${activa ? "text-[#C8A96B]" : ""}`}
        >
          {rotulo}
          {activa ? orden.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} /> : null}
        </button>
      </th>
    );
  };

  if (lineas.length === 0) return null;

  /* El máximo de una casilla entre todos: así los campos se comparan entre jugadores. */
  const campoDe = (suyas: F[]) => {
    const m = CARRILES.map(() => ZONAS.map(() => 0));

    for (const fila of suyas) {
      const { zona, carril } = sitioDe(fila);
      const z = ZONAS.indexOf(zona as (typeof ZONAS)[number]);
      const c = CARRILES.indexOf(carril as (typeof CARRILES)[number]);

      if (z >= 0 && c >= 0) m[c][z] += 1;
    }

    return m;
  };

  const zonasCols = columnas.filter((c) => c.tipo === "zonas");
  const campos = new Map(
    ordenadas.map((l) => [
      l.jugador,
      Object.fromEntries(
        zonasCols.map((c) => [c.clave, campoDe(c.cumple ? l.filas.filter(c.cumple) : l.filas)]),
      ) as Record<string, number[][]>,
    ]),
  );
  const maximo = Math.max(
    1,
    ...[...campos.values()].flatMap((porCol) => Object.values(porCol).flatMap((m) => m.flat())),
  );

  /** «medio campo · derecha (3)»: la casilla donde más hace. */
  const dondeMas = (m: number[][]) => {
    let mejor = { n: 0, z: -1, c: -1 };

    m.forEach((fila, c) =>
      fila.forEach((n, z) => {
        if (n > mejor.n) mejor = { n, z, c };
      }),
    );

    if (mejor.n === 0) return "";

    const carril = CARRILES[mejor.c];

    return `${ZONAS[mejor.z]} · ${carril === "centro" ? "centro" : carril}`;
  };

  const tituloCampo = (jugador: string, rotulo: string, m: number[][]) => {
    const partes = CARRILES.flatMap((carril, c) =>
      ZONAS.map((zona, z) => (m[c][z] ? `${zona}, ${carril}: ${m[c][z]}` : "")).filter(Boolean),
    );

    return `${jugador} · ${rotulo}: ${partes.length ? partes.join("; ") : "ninguna"}. El Castilla ataca hacia la derecha.`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-[10px] text-white/40">
            <th className="sticky left-0 z-10 bg-[#141A22] px-4 py-2.5 text-left font-medium uppercase tracking-[0.12em]">
              Jugador
            </th>
            {cabecera("total", total.rotulo, total.explica)}
            {columnas.map((c) =>
              c.tipo === "zonas" ? (
                <th key={c.clave} className="px-2 py-2.5 text-left font-medium uppercase tracking-[0.12em]" title={c.explica}>
                  {c.rotulo}
                </th>
              ) : (
                cabecera(c.clave, c.rotulo, c.explica)
              ),
            )}
            {variosPartidos && cabecera("partidos", "Partidos", "En cuántos de los partidos que entran sale con alguna (no es cuántos jugó)")}
          </tr>
        </thead>

        <tbody>
          {ordenadas.map((l) => {
            const marcado = marcados.includes(l.jugador);
            const atenuado = marcados.length > 0 && !marcado;

            return (
              <tr
                key={l.jugador}
                className={`border-b border-white/5 align-middle transition ${marcado ? "bg-[#C8A96B]/10" : ""}`}
                style={atenuado ? { opacity: 0.55 } : undefined}
              >
                <td className="sticky left-0 z-10 bg-[#141A22] px-4 py-2">
                  <button
                    type="button"
                    onClick={() => onJugador(l.jugador)}
                    aria-pressed={marcado}
                    title={TITULO_FILTRO}
                    className={`max-w-[9.5rem] cursor-pointer truncate text-left font-semibold transition hover:underline sm:max-w-none ${
                      marcado ? "text-[#C8A96B]" : "text-white/85"
                    }`}
                  >
                    {l.jugador}
                  </button>
                </td>

                <td className="px-2 py-2 text-right">
                  {/* Sin media por partido: no se sabe cuántos minutos jugó cada uno. */}
                  <span className="text-base font-semibold tabular-nums text-white">{l.cifras.total}</span>
                </td>

                {columnas.map((c) => {
                  if (c.tipo === "zonas") {
                    const m = campos.get(l.jugador)?.[c.clave] ?? campoDe([]);
                    const donde = dondeMas(m);

                    return (
                      <td key={c.clave} className="px-2 py-2">
                        <span className="flex items-center gap-2">
                          <MiniCampo cuentas={m} maximo={maximo} titulo={tituloCampo(l.jugador, c.rotulo, m)} />
                          <span className="hidden whitespace-nowrap text-[11px] text-white/45 sm:inline">{donde || "—"}</span>
                        </span>
                      </td>
                    );
                  }

                  const n = l.cifras[c.clave] ?? 0;
                  const de = c.sobre === null ? 0 : c.sobre ? l.filas.filter(c.sobre).length : l.filas.length;

                  return (
                    <td key={c.clave} className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      <span className="font-semibold" style={n && c.color ? { color: c.color } : undefined}>
                        {n ? n : <span className="text-white/30">0</span>}
                      </span>
                      {c.sobre !== null && de > 0 && n > 0 ? (
                        <span className="ml-1 text-[11px] text-white/40">{pct(n, de)} %</span>
                      ) : null}
                    </td>
                  );
                })}

                {variosPartidos && (
                  <td className="px-2 py-2 text-right tabular-nums text-white/60">{l.partidos}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** El aviso cuando lo que se mira no tiene jugador, o no tiene nada. */
export function SinJugador({ children }: { children: ReactNode }) {
  return <p className="p-4 text-sm leading-relaxed text-white/50 sm:p-5">{children}</p>;
}

export default PorJugador;
