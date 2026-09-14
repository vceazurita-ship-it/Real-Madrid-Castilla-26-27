"use client";

import { useMemo, useState } from "react";
import { Award, Sliders, Sparkles, User } from "lucide-react";

import { Notice, Panel } from "@/components/abp/ui";
import { Lectura } from "@/components/data/formas";
import { BarrasEquipos, MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { formatea, temporadaDe } from "@/lib/data-analisis/metricas";
import {
  ASPECTOS,
  ASPECTOS_POR_DEFECTO,
  CUOTA_MINUTOS,
  MAXIMO_DESTACADOS,
  PERCENTIL_DESTACA,
  UMBRAL_EQUIPO,
  destacadosDeEquipo,
  destacadosDeJugadores,
  type DestacadoEquipo,
  type DestacadoJugador,
} from "@/lib/data-analisis/destacados";
import { PUESTOS, type Puesto } from "@/lib/data-analisis/individual";
import { mismoEquipo } from "@/lib/data-analisis/nombres";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";

/**
 * LOS MÁS DESTACADOS.
 *
 * Las otras áreas contestan «cómo vamos en esta métrica». Ésta contesta la
 * pregunta de antes, que es la que se hace de verdad el lunes: **a quién hay
 * que mirar, y por qué**. Veinte equipos y dos mil jugadores no se leen fila a
 * fila; se leen por lo que les separa del resto.
 *
 * Dos reglas mandan en todo lo que sale aquí:
 *
 * - **Por aspectos, no por métricas sueltas.** Un PPDA bajo puede ser el rival
 *   de turno; un PPDA bajo *y* muchas recuperaciones altas ya es una manera de
 *   jugar. Cada aspecto junta dos o tres métricas que dicen lo mismo.
 * - **En percentiles contra la categoría.** Así un aspecto que va en segundos y
 *   otro que va en porcentaje se pueden poner uno al lado del otro.
 *
 * Los cuatro aspectos de serie son los que más veces cambian un plan de
 * partido —cómo presiona, si domina el balón, si llega al área y si concede—,
 * pero se cambian aquí mismo: cada cuerpo técnico prioriza lo suyo.
 */

const NOSOTROS = "Real Madrid Castilla";

export function PanelDestacados({
  partidos,
  jugadores,
}: {
  partidos: FilaPartido[];
  jugadores: FilaJugador[];
}) {
  const [elegidos, setElegidos] = useState<string[]>(ASPECTOS_POR_DEFECTO);

  /* El equipo que se abre en detalle: se empieza por casa. */
  const [equipo, setEquipo] = useState<string>(NOSOTROS);

  const [deQuien, setDeQuien] = useState<string>("todos");
  const [puesto, setPuesto] = useState<"todos" | Puesto>("todos");

  const { temporada, liga, equipos } = useMemo(() => {
    const temporadas = [...new Set(partidos.map((p) => temporadaDe(p.fecha)))]
      .filter(Boolean)
      .sort();

    const actual = temporadas[temporadas.length - 1] ?? "";

    const suyos = partidos.filter((p) => temporadaDe(p.fecha) === actual);

    return {
      temporada: actual,
      liga: suyos,
      equipos: [...new Set(suyos.map((p) => p.equipo))].sort(),
    };
  }, [partidos]);

  const aspectos = useMemo(
    () => ASPECTOS.filter((a) => elegidos.includes(a.key)),
    [elegidos],
  );

  /* Cada equipo contra la categoría, sólo en los aspectos elegidos. */
  const porEquipo = useMemo(
    () =>
      equipos.map((e) => ({
        equipo: e,
        destacados: destacadosDeEquipo(e, liga, equipos, aspectos),
      })),
    [aspectos, equipos, liga],
  );

  /* Quién se sale más de la categoría, sea por arriba o por abajo. */
  const ranking = useMemo(
    () =>
      porEquipo
        .flatMap((x) => (x.destacados[0] ? [{ equipo: x.equipo, top: x.destacados[0] }] : []))
        .filter((x) => Math.abs(x.top.desviacion) >= UMBRAL_EQUIPO)
        .sort((a, b) => Math.abs(b.top.desviacion) - Math.abs(a.top.desviacion)),
    [porEquipo],
  );

  const detalle = useMemo(
    () => porEquipo.find((x) => x.equipo === equipo)?.destacados ?? [],
    [equipo, porEquipo],
  );

  /* Todos los jugadores de la categoría con minutos y con algo que destacar. */
  const destacadosJugadores = useMemo(
    () =>
      equipos
        .flatMap((e) =>
          destacadosDeJugadores(jugadores, e, jugadores).map((j) => ({
            ...j,
            suEquipo: e,
          })),
        )
        .sort(
          (a, b) => (b.fuertes[0]?.percentil ?? 0) - (a.fuertes[0]?.percentil ?? 0),
        ),
    [equipos, jugadores],
  );

  const jugadoresVisibles = useMemo(
    () =>
      destacadosJugadores
        .filter((j) => deQuien === "todos" || j.suEquipo === deQuien)
        .filter((j) => puesto === "todos" || j.puesto === puesto)
        .slice(0, 24),
    [deQuien, destacadosJugadores, puesto],
  );

  if (equipos.length < 5) {
    return (
      <div className="mt-5">
        <Notice tone="warn" title="Todavía no hay categoría con la que comparar">
          Para decir que alguien destaca hacen falta al menos cinco equipos con
          informe en <code>public/data/wys</code>. Ahora mismo hay{" "}
          {equipos.length}.
        </Notice>
      </div>
    );
  }

  const alternar = (key: string) =>
    setElegidos((antes) =>
      antes.includes(key) ? antes.filter((k) => k !== key) : [...antes, key],
    );

  return (
    <>
      <div className="mt-5">
        <Notice title="Lo que de verdad separa a un equipo del resto">
          <p>
            No es una métrica: es un <strong className="text-white/75">aspecto</strong>,
            dos o tres métricas que describen lo mismo. Todo se mide{" "}
            <strong className="text-white/75">en percentiles contra los {equipos.length} equipos</strong>{" "}
            de la categoría en {temporada || "esta temporada"}, así que{" "}
            <strong className="text-white/75">+{UMBRAL_EQUIPO} puntos</strong> es
            quedar por delante del 70 % y −{UMBRAL_EQUIPO} por detrás del 70 %.
            Por debajo de eso, con esta muestra, es vaivén.
          </p>

          <ul className="mt-2 space-y-1.5">
            <li>
              <strong className="text-white/70">Los cuatro de serie</strong> son
              los que más veces cambian un plan de partido. Cámbialos abajo: se
              recalcula todo, y el informe del rival sale de la misma cuenta.
            </li>

            <li>
              <strong className="text-white/70">El sentido ya está puesto.</strong>{" "}
              En PPDA, pérdidas o remates en contra, menos es más: una desviación
              positiva siempre se lee igual, sea la métrica que sea.
            </li>
          </ul>
        </Notice>
      </div>

      {/* Qué se prioriza. */}
      <div className="mt-5">
        <Panel
          title="Qué aspectos priorizas"
          subtitle={`${aspectos.length} elegidos · en la diapositiva del informe caben ${MAXIMO_DESTACADOS}`}
          icon={Sliders}
          action={
            <button
              type="button"
              onClick={() => setElegidos(ASPECTOS_POR_DEFECTO)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/60 transition hover:text-white"
            >
              Los cuatro de serie
            </button>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {ASPECTOS.map((a) => {
              const activo = elegidos.includes(a.key);

              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => alternar(a.key)}
                  aria-pressed={activo}
                  title={a.explica}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                    activo
                      ? "border-[#C8A96B]/40 bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
                  }`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>

          {aspectos.length === 0 && (
            <p className="mt-3 text-[12px] text-amber-300/80">
              Sin ningún aspecto elegido no hay nada que ordenar. Marca al menos
              uno.
            </p>
          )}
        </Panel>
      </div>

      {/* Los equipos. */}
      {aspectos.length > 0 && (
        <>
          <div className="mt-5">
            <Panel
              title="Los equipos más destacados"
              subtitle="Su aspecto más marcado, de mayor a menor. Pulsa uno para abrirlo."
              icon={Award}
              analisis={
                <Lectura>{lecturaDelRanking(ranking, equipos.length, aspectos.length)}</Lectura>
              }
            >
              {ranking.length === 0 ? (
                <p className="text-[12px] text-white/45">
                  Con estos aspectos nadie se sale más de {UMBRAL_EQUIPO} puntos
                  de la categoría: van todos muy parecidos. Prueba con otros.
                </p>
              ) : (
                <div className="space-y-1">
                  {ranking.map((fila, indice) => (
                    <FilaEquipoDestacado
                      key={fila.equipo}
                      indice={indice}
                      equipo={fila.equipo}
                      destacado={fila.top}
                      abierto={fila.equipo === equipo}
                      alPulsar={() => setEquipo(fila.equipo)}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* El equipo abierto, aspecto a aspecto. */}
          <div className="mt-5">
            <Panel
              title={equipo}
              subtitle="Aspecto a aspecto, con las métricas que lo componen"
              icon={Sparkles}
              action={
                <select
                  value={equipo}
                  onChange={(e) => setEquipo(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-[#C8A96B]/50"
                >
                  {equipos.map((e) => (
                    <option key={e} value={e} className="bg-[#11161C]">
                      {e}
                    </option>
                  ))}
                </select>
              }
              analisis={<Lectura>{lecturaDelEquipo(equipo, detalle)}</Lectura>}
            >
              {detalle.length === 0 ? (
                <p className="text-[12px] text-white/45">
                  No hay informes bastantes de {equipo} para estos aspectos.
                </p>
              ) : (
                <div className="space-y-4">
                  {detalle.map((d) => (
                    <BloqueAspecto key={d.aspecto.key} destacado={d} />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Cada aspecto, toda la categoría ordenada. */}
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {aspectos.map((a) => {
              const filas = porEquipo.map((x) => ({
                equipo: x.equipo,
                valor:
                  x.destacados.find((d) => d.aspecto.key === a.key)?.percentil ??
                  null,
              }));

              return (
                <Panel
                  key={a.key}
                  title={a.label}
                  subtitle={`${a.explica}. La cifra es el percentil medio del aspecto.`}
                  icon={Award}
                >
                  <BarrasEquipos
                    filas={filas}
                    unidad="entero"
                    mejorAlto
                    destacado={equipo}
                    alPulsar={setEquipo}
                  />
                </Panel>
              );
            })}
          </div>
        </>
      )}

      {/* Los jugadores. */}
      <div className="mt-5">
        <Panel
          title="Los jugadores más destacados"
          subtitle={`Con al menos el ${Math.round(CUOTA_MINUTOS * 100)} % de los minutos de su equipo y algo por encima del percentil ${PERCENTIL_DESTACA} entre los de su puesto`}
          icon={User}
          action={
            <select
              value={deQuien}
              onChange={(e) => setDeQuien(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-[#C8A96B]/50"
            >
              <option value="todos" className="bg-[#11161C]">
                Toda la categoría
              </option>

              {equipos.map((e) => (
                <option key={e} value={e} className="bg-[#11161C]">
                  {e}
                </option>
              ))}
            </select>
          }
          analisis={
            <Lectura>
              {lecturaDeJugadores(jugadoresVisibles, destacadosJugadores.length, deQuien)}
            </Lectura>
          }
        >
          <div className="mb-3 flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {[{ key: "todos" as const, corto: "Todos" }, ...PUESTOS].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPuesto(p.key)}
                aria-pressed={puesto === p.key}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  puesto === p.key
                    ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {p.corto}
              </button>
            ))}
          </div>

          {jugadoresVisibles.length === 0 ? (
            <p className="text-[12px] text-white/45">
              Nadie con esos filtros llega al {Math.round(CUOTA_MINUTOS * 100)} %
              de los minutos con algo destacado.
            </p>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {jugadoresVisibles.map((j) => (
                <FichaJugador
                  key={`${j.suEquipo}·${j.jugador.jugador}`}
                  destacado={j}
                  equipo={j.suEquipo}
                  nuestro={mismoEquipo(j.suEquipo, NOSOTROS)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

/**
 * Una fila del ranking, con la barra saliendo del centro.
 *
 * El centro es la mediana de la categoría, no el borde: lo que se mira es
 * cuánto se separa y hacia qué lado, no el valor absoluto.
 */
function FilaEquipoDestacado({
  indice,
  equipo,
  destacado,
  abierto,
  alPulsar,
}: {
  indice: number;
  equipo: string;
  destacado: DestacadoEquipo;
  abierto: boolean;
  alPulsar: () => void;
}) {
  const arriba = destacado.desviacion >= 0;

  const color = arriba ? MEJOR : PEOR;

  const nuestro = mismoEquipo(equipo, NOSOTROS);

  return (
    <button
      type="button"
      onClick={alPulsar}
      className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.04] ${
        abierto ? "bg-white/[0.05]" : ""
      }`}
    >
      <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-white/25">
        {indice + 1}
      </span>

      <span
        className={`w-36 shrink-0 truncate text-[12px] ${
          nuestro ? "font-semibold" : "text-white/60"
        }`}
        style={nuestro ? { color: ORO } : undefined}
      >
        {equipo}
      </span>

      <span className="hidden w-40 shrink-0 truncate text-[11px] text-white/45 sm:block">
        {destacado.aspecto.label}
      </span>

      {/* La pista, con el centro marcado. */}
      <span className="relative h-3 min-w-0 flex-1">
        <span
          className="absolute inset-x-0 top-1/2 block h-3 -translate-y-1/2 rounded-[3px]"
          style={{ background: tinta(0.06) }}
        />

        <span
          className="absolute inset-y-[-2px] w-px"
          style={{ left: "50%", background: tinta(0.3) }}
          aria-hidden
        />

        <span
          className="absolute top-1/2 block h-3 -translate-y-1/2 rounded-[3px]"
          style={{
            left: arriba ? "50%" : `${50 - Math.abs(destacado.desviacion)}%`,
            width: `${Math.max(1, Math.abs(destacado.desviacion))}%`,
            background: color,
          }}
        />
      </span>

      <span
        className="w-16 shrink-0 text-right text-[12px] font-semibold tabular-nums"
        style={{ color }}
      >
        {arriba ? "+" : "−"}
        {Math.abs(Math.round(destacado.desviacion))} pts
      </span>
    </button>
  );
}

/** Un aspecto del equipo abierto: el titular y sus métricas. */
function BloqueAspecto({ destacado }: { destacado: DestacadoEquipo }) {
  const arriba = destacado.desviacion >= 0;

  const relevante = Math.abs(destacado.desviacion) >= UMBRAL_EQUIPO;

  const color = !relevante ? tinta(0.4) : arriba ? MEJOR : PEOR;

  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-white/85">
          {destacado.aspecto.label}
        </p>

        <p className="text-[12px] font-semibold tabular-nums" style={{ color }}>
          {arriba ? "+" : "−"}
          {Math.abs(Math.round(destacado.desviacion))} pts
          <span className="ml-2 text-[11px] font-normal text-white/35">
            p{Math.round(destacado.percentil)}
          </span>
        </p>
      </div>

      <p className="mt-0.5 text-[11px] text-white/40">
        {relevante
          ? destacado.aspecto.explica
          : `${destacado.aspecto.explica} — pero va en la media de la categoría`}
      </p>

      <div className="mt-2 space-y-1">
        {destacado.filas.map((f) => (
          <div
            key={f.metrica.key}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="min-w-0 truncate text-[12px] text-white/60">
              {f.metrica.nombre}
            </span>

            <span className="shrink-0 text-[12px] tabular-nums">
              <span className="text-white/85">
                {formatea(f.valor, f.metrica.unidad)}
              </span>

              <span className="ml-2 text-[11px] text-white/30">
                liga {formatea(f.mediana, f.metrica.unidad)}
              </span>

              <span
                className="ml-2 text-[11px]"
                style={{ color: f.percentil >= 50 ? MEJOR : PEOR }}
              >
                p{f.percentil}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Un jugador destacado, con lo que le separa de los de su puesto. */
function FichaJugador({
  destacado,
  equipo,
  nuestro,
}: {
  destacado: DestacadoJugador;
  equipo: string;
  nuestro: boolean;
}) {
  return (
    <div
      className="min-w-0 rounded-xl border px-3 py-2.5"
      style={{
        borderColor: nuestro ? "rgb(200 169 107 / .35)" : "rgb(255 255 255 / .1)",
        background: nuestro ? "rgb(200 169 107 / .07)" : "rgb(255 255 255 / .02)",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p
          className="min-w-0 truncate text-[13px] font-medium"
          style={{ color: nuestro ? ORO : "rgb(var(--rmcf-ink-rgb) / .85)" }}
        >
          {destacado.jugador.jugador}
        </p>

        <p className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-white/35">
          {PUESTOS.find((p) => p.key === destacado.puesto)?.corto} ·{" "}
          {Math.round(destacado.cuotaMinutos * 100)} % min
        </p>
      </div>

      <p className="mt-0.5 truncate text-[11px] text-white/40">
        {equipo} · {destacado.jugador.minutos}′ en {destacado.jugador.partidos}{" "}
        {destacado.jugador.partidos === 1 ? "partido" : "partidos"}
      </p>

      <div className="mt-2 space-y-1">
        {destacado.fuertes.map((f) => (
          <div
            key={f.metrica.columna}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="min-w-0 truncate text-[12px] text-white/60">
              {f.metrica.nombre}
            </span>

            <span className="shrink-0 text-[12px] tabular-nums text-white/85">
              {formatea(f.valor, f.metrica.unidad)}

              <span className="ml-2 text-[11px]" style={{ color: MEJOR }}>
                p{f.percentil}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LAS LECTURAS                                                       */
/* ------------------------------------------------------------------ */

function lecturaDelRanking(
  ranking: { equipo: string; top: DestacadoEquipo }[],
  cuantos: number,
  aspectos: number,
) {
  if (ranking.length === 0) {
    return `Con estos ${aspectos} aspectos ningún equipo de los ${cuantos} se separa más de ${UMBRAL_EQUIPO} puntos de percentil de la categoría: en esto van todos parecidos y no sirve para preparar un partido.`;
  }

  const primero = ranking[0];

  const nuestro = ranking.findIndex((r) => mismoEquipo(r.equipo, NOSOTROS));

  const donde =
    nuestro < 0
      ? "El Castilla no se sale de la media en ninguno de los aspectos elegidos."
      : `El Castilla es el ${nuestro + 1}º que más se sale, por ${primeroTexto(ranking[nuestro])}.`;

  return `De los ${cuantos} equipos, ${ranking.length} se salen de la categoría en alguno de los ${aspectos} aspectos elegidos. El que más, ${primero.equipo}, por ${primeroTexto(primero)}. ${donde}`;
}

function primeroTexto(fila: { top: DestacadoEquipo }) {
  const d = fila.top;

  return `${d.desviacion >= 0 ? "arriba" : "abajo"} en ${d.aspecto.label.toLowerCase()} (${
    d.desviacion >= 0 ? "+" : "−"
  }${Math.abs(Math.round(d.desviacion))} puntos de percentil)`;
}

function lecturaDelEquipo(equipo: string, detalle: DestacadoEquipo[]) {
  const fuertes = detalle.filter((d) => d.desviacion >= UMBRAL_EQUIPO);
  const flojos = detalle.filter((d) => d.desviacion <= -UMBRAL_EQUIPO);

  if (fuertes.length === 0 && flojos.length === 0) {
    return `${equipo} no se sale de la categoría en ninguno de los aspectos elegidos: es un equipo del montón en todos ellos, y eso también es una forma de prepararlo.`;
  }

  const lista = (ds: DestacadoEquipo[]) =>
    ds.map((d) => d.aspecto.label.toLowerCase()).join(", ");

  const arriba = fuertes.length
    ? `Se sale por arriba en ${lista(fuertes)}.`
    : "No se sale por arriba en nada de lo elegido.";

  const abajo = flojos.length
    ? ` Se queda por debajo en ${lista(flojos)}, que es por donde hay que atacarle.`
    : "";

  return `${equipo}: ${arriba}${abajo}`;
}

function lecturaDeJugadores(
  visibles: (DestacadoJugador & { suEquipo: string })[],
  total: number,
  deQuien: string,
) {
  if (visibles.length === 0) {
    return "Con estos filtros no queda nadie: o no hay jugadores con bastantes minutos o ninguno destaca por encima del percentil 80 entre los de su puesto.";
  }

  const primero = visibles[0];

  const nuestros = visibles.filter((j) => mismoEquipo(j.suEquipo, NOSOTROS));

  const casa = nuestros.length
    ? ` De los nuestros aparecen ${nuestros.map((j) => j.jugador.jugador).join(", ")}.`
    : "";

  const alcance =
    deQuien === "todos"
      ? `${total} jugadores de la categoría tienen minutos bastantes y algo que destacar`
      : `${visibles.length} jugadores de ${deQuien} entran en la lista`;

  return `${alcance}. El que más destaca es ${primero.jugador.jugador} (${
    PUESTOS.find((p) => p.key === primero.puesto)?.label.toLowerCase()
  }, ${primero.suEquipo}): ${primero.fuertes
    .map((f) => `${f.metrica.nombre.toLowerCase()} en el percentil ${f.percentil}`)
    .join(", ")}.${casa}`;
}
