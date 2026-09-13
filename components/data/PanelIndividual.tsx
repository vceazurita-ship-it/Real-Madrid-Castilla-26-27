"use client";

import { useMemo, useState } from "react";
import { Scale, User, Users } from "lucide-react";

import { Notice, Panel } from "@/components/abp/ui";
import { Lectura } from "@/components/data/formas";
import { MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { formatea } from "@/lib/data-analisis/metricas";
import {
  GRUPOS_JUGADOR,
  MINUTOS_MINIMOS,
  PUESTOS,
  comparablesDe,
  fuertesYFlojos,
  metricasDe,
  percentilEnPlantilla,
  puestoDe,
  valorDe,
  type MetricaJugador,
  type Puesto,
} from "@/lib/data-analisis/individual";
import type { FilaJugador } from "@/lib/data-analisis/leer";

/**
 * EL JUGADOR.
 *
 * Sale del «Search results» de Wyscout, que es otra descarga: una fila por
 * jugador con todo ya por noventa minutos. Dos avisos mandan en cómo se lee, y
 * los dos están en pantalla porque sin ellos los números engañan:
 *
 * - El percentil es **dentro de la plantilla**, no contra la categoría: en el
 *   fichero sólo estamos nosotros.
 * - Con dos partidos, un «por noventa» de quien lleva veintitrés minutos es una
 *   extrapolación de tres acciones.
 */
export function PanelIndividual({ jugadores }: { jugadores: FilaJugador[] }) {
  const [cual, setCual] = useState(0);
  const [grupo, setGrupo] = useState<string>("todos");

  const ordenados = useMemo(
    () => [...jugadores].sort((a, b) => b.minutos - a.minutos),
    [jugadores],
  );

  const jugador = ordenados[Math.min(cual, Math.max(0, ordenados.length - 1))] ?? null;

  const puesto: Puesto = jugador ? puestoDe(jugador.posicion) : "MED";

  const comparacion = useMemo(
    () => comparablesDe(jugadores, puesto),
    [jugadores, puesto],
  );

  const analisis = useMemo(
    () =>
      jugador
        ? fuertesYFlojos(jugador, comparacion.lista, puesto)
        : { fuertes: [], flojos: [], todas: [] },
    [comparacion.lista, jugador, puesto],
  );

  if (jugadores.length === 0) {
    return (
      <div className="mt-5">
        <Notice tone="warn" title="Sin datos individuales">
          En <code>public/data/wys</code> no hay ninguna descarga de búsqueda de
          jugadores. Es el <code>Search results.xlsx</code> que baja Wyscout con
          una fila por jugador.
        </Notice>
      </div>
    );
  }

  if (!jugador) return null;

  const corto = jugador.minutos < MINUTOS_MINIMOS;

  const suyas = metricasDe(puesto).filter(
    (m) => grupo === "todos" || m.grupo === grupo,
  );

  const gruposConMetricas = GRUPOS_JUGADOR.filter((g) =>
    metricasDe(puesto).some((m) => m.grupo === g),
  );

  return (
    <>
      <div className="mt-5">
        <Notice title="Los jugadores, por noventa minutos">
          <p>
            Sale del <strong className="text-white/75">«Search results» de
            Wyscout</strong>: una fila por jugador, con todo ya por noventa
            minutos. Dos cosas cambian cómo se lee todo lo de abajo:
          </p>

          <ul className="mt-2 space-y-1.5">
            <li>
              <strong className="text-white/70">El percentil es dentro de la
              plantilla.</strong>{" "}
              En el fichero sólo estamos nosotros, así que «percentil 80»
              significa «de los mejores del Castilla en su puesto», no de la
              categoría.
            </li>

            <li>
              <strong className="text-white/70">La muestra es de dos
              partidos.</strong>{" "}
              Por debajo de {MINUTOS_MINIMOS} minutos jugados, un «por noventa»
              es una extrapolación: esos jugadores se marcan y se quedan fuera
              del percentil de los demás.
            </li>
          </ul>
        </Notice>
      </div>

      {/* A quién se mira. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            Jugador
          </span>

          <select
            value={cual}
            onChange={(e) => setCual(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
          >
            {ordenados.map((j, i) => (
              <option key={j.jugador} value={i} className="bg-[#11161C]">
                {j.jugador} · {j.posicion} · {j.minutos}′
              </option>
            ))}
          </select>
        </label>

        <span className="text-[11px] text-white/35">
          {PUESTOS.find((p) => p.key === puesto)?.label} ·{" "}
          {comparacion.ambito === "puesto"
            ? `se compara con los ${comparacion.lista.length} de su puesto`
            : comparacion.ambito === "plantilla"
              ? `sin bastantes compañeros de puesto: se compara con los ${comparacion.lista.length} de campo`
              : "sin nadie con quien compararse: sólo se enseñan sus cifras"}
        </span>
      </div>

      {/* La ficha. */}
      <div className="mt-5">
        <Panel
          title={jugador.jugador}
          /* Wyscout escribe «unknown» cuando no sabe el pie, y eso en una
             ficha se lee como si fuera un dato. Mejor no poner nada. */
          subtitle={[
            jugador.posicion,
            `${jugador.edad} años`,
            jugador.altura ? `${jugador.altura} cm` : "",
            /^(derecho|izquierdo|ambidiestro)$/i.test(jugador.pie)
              ? jugador.pie
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          icon={User}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { rotulo: "Minutos", dato: `${jugador.minutos}′`, pie: `${jugador.partidos} ${jugador.partidos === 1 ? "partido" : "partidos"}` },
              {
                rotulo: "Goles",
                dato: String(valorDe(jugador, "Goles") ?? 0),
                pie: `${formatea(valorDe(jugador, "xG"), "decimal")} de xG`,
              },
              {
                rotulo: "Asistencias",
                dato: String(valorDe(jugador, "Asistencias") ?? 0),
                pie: `${formatea(valorDe(jugador, "xA"), "decimal")} de xA`,
              },
              {
                rotulo: "Duelos ganados",
                dato: formatea(valorDe(jugador, "Duelos ganados, %"), "porcentaje"),
                pie: `${formatea(valorDe(jugador, "Duelos/90"), "decimal")} duelos por 90′`,
              },
            ].map((c) => (
              <div
                key={c.rotulo}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                  {c.rotulo}
                </p>

                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {c.dato}
                </p>

                <p className="mt-0.5 text-[11px] text-white/35">{c.pie}</p>
              </div>
            ))}
          </div>

          {corto && (
            <div className="mt-3">
              <Notice tone="warn" title={`Sólo ${jugador.minutos} minutos jugados`}>
                Todo lo que va «por noventa minutos» está extrapolado desde una
                muestra muy corta. Sirve para hacerse una idea, no para decidir.
              </Notice>
            </div>
          )}

          {comparacion.ambito !== "solo" && analisis.fuertes.length > 0 && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {[
                { titulo: "Donde más destaca", filas: analisis.fuertes, color: MEJOR },
                { titulo: "Donde más le falta", filas: analisis.flojos, color: PEOR },
              ].map((bloque) => (
                <div key={bloque.titulo} className="min-w-0">
                  <p
                    className="mb-2 text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: bloque.color }}
                  >
                    {bloque.titulo}
                  </p>

                  <div className="space-y-1.5">
                    {bloque.filas.map((f) => (
                      <div
                        key={f.metrica.columna}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="min-w-0 truncate text-[12px] text-white/65">
                          {f.metrica.nombre}
                        </span>

                        <span className="shrink-0 text-[12px] tabular-nums">
                          <span className="text-white/80">
                            {formatea(f.valor, f.metrica.unidad)}
                          </span>

                          <span
                            className="ml-2 text-[11px]"
                            style={{ color: bloque.color }}
                          >
                            p{f.percentil}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Lectura>{lecturaDelJugador(jugador, analisis, comparacion.ambito, puesto)}</Lectura>
        </Panel>
      </div>

      {/* El detalle métrica a métrica. */}
      <div className="mt-5">
        <Panel
          title="Métrica a métrica"
          subtitle={
            comparacion.ambito === "solo"
              ? "Sus cifras, sin percentil: no hay con quién compararle"
              : "A la derecha, mejor. La barra es el percentil dentro de la plantilla."
          }
          icon={Scale}
          action={
            <select
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-[#C8A96B]/50"
            >
              <option value="todos" className="bg-[#11161C]">
                Todos los grupos
              </option>

              {gruposConMetricas.map((g) => (
                <option key={g} value={g} className="bg-[#11161C]">
                  {g}
                </option>
              ))}
            </select>
          }
        >
          <div className="space-y-4">
            {gruposConMetricas
              .filter((g) => suyas.some((m) => m.grupo === g))
              .map((g) => (
                <div key={g} className="min-w-0">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                    {g}
                  </p>

                  <div className="space-y-2">
                    {suyas
                      .filter((m) => m.grupo === g)
                      .map((m) => (
                        <FilaMetrica
                          key={m.columna}
                          metrica={m}
                          jugador={jugador}
                          companeros={comparacion.lista}
                          conPercentil={comparacion.ambito !== "solo"}
                        />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      </div>

      {/* La plantilla entera en una métrica. */}
      <TablaPlantilla jugadores={jugadores} puesto={puesto} />
    </>
  );
}

/** Una métrica del jugador, con su percentil dentro de la plantilla. */
function FilaMetrica({
  metrica,
  jugador,
  companeros,
  conPercentil,
}: {
  metrica: MetricaJugador;
  jugador: FilaJugador;
  companeros: FilaJugador[];
  conPercentil: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  const valor = valorDe(jugador, metrica.columna);

  const valores = companeros
    .map((c) => valorDe(c, metrica.columna))
    .filter((v): v is number => v !== null);

  const percentil =
    conPercentil && valor !== null
      ? percentilEnPlantilla(valor, valores, metrica.mejorAlto)
      : null;

  const mediana = valores.length
    ? [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)]
    : null;

  const color =
    percentil === null || metrica.mejorAlto === null
      ? tinta(0.3)
      : percentil >= 60
        ? MEJOR
        : percentil <= 35
          ? PEOR
          : ORO;

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex w-full items-baseline justify-between gap-3 text-left"
      >
        <span className="min-w-0 truncate text-[12.5px] text-white/70">
          {metrica.nombre}
        </span>

        <span className="shrink-0 text-[12.5px] tabular-nums">
          <span className="font-semibold text-white">
            {valor === null ? "—" : formatea(valor, metrica.unidad)}
          </span>

          {mediana !== null && (
            <span className="ml-2 text-[11px] text-white/30">
              plantilla {formatea(mediana, metrica.unidad)}
            </span>
          )}
        </span>
      </button>

      {percentil !== null && (
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-white/[0.06]">
            <span
              className="block h-2.5 rounded-[3px]"
              style={{ width: `${percentil}%`, background: color }}
            />
          </span>

          <span
            className="w-10 shrink-0 text-right text-[11px] tabular-nums"
            style={{ color }}
          >
            p{percentil}
          </span>
        </div>
      )}

      {abierto && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
          {metrica.comoLeer}
        </p>
      )}
    </div>
  );
}

/** La plantilla ordenada por una métrica: quién manda en cada cosa. */
function TablaPlantilla({
  jugadores,
  puesto,
}: {
  jugadores: FilaJugador[];
  puesto: Puesto;
}) {
  const [columna, setColumna] = useState("Acciones de ataque exitosas/90");

  const disponibles = useMemo(() => metricasDe(puesto), [puesto]);

  /* La métrica sale del memo y no de fuera: el compilador de React no puede
     garantizar que una lista calculada en render no cambie después. */
  const { metrica, filas } = useMemo(() => {
    const lista = metricasDe(puesto);

    const elegida = lista.find((m) => m.columna === columna) ?? lista[0];

    if (!elegida) return { metrica: null, filas: [] };

    return {
      metrica: elegida,
      filas: jugadores
        .map((j) => ({
          jugador: j,
          valor: valorDe(j, elegida.columna),
          corto: j.minutos < MINUTOS_MINIMOS,
        }))
        .filter((f): f is { jugador: FilaJugador; valor: number; corto: boolean } =>
          f.valor !== null,
        )
        .sort((a, b) =>
          elegida.mejorAlto === false ? a.valor - b.valor : b.valor - a.valor,
        ),
    };
  }, [columna, jugadores, puesto]);

  if (!metrica || filas.length === 0) return null;

  const tope = Math.max(...filas.map((f) => Math.abs(f.valor)), 0.0001);

  return (
    <div className="mt-5">
      <Panel
        title="La plantilla, ordenada"
        subtitle="Cualquier métrica, todos los jugadores de mejor a peor"
        icon={Users}
        action={
          <select
            value={metrica.columna}
            onChange={(e) => setColumna(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-[#C8A96B]/50"
          >
            {GRUPOS_JUGADOR.filter((g) => disponibles.some((m) => m.grupo === g)).map(
              (g) => (
                <optgroup key={g} label={g}>
                  {disponibles
                    .filter((m) => m.grupo === g)
                    .map((m) => (
                      <option key={m.columna} value={m.columna} className="bg-[#11161C]">
                        {m.nombre}
                      </option>
                    ))}
                </optgroup>
              ),
            )}
          </select>
        }
      >
        <div className="space-y-1.5">
          {filas.map((f, i) => (
            <div key={f.jugador.jugador} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-white/30">
                {i + 1}
              </span>

              <span
                className={`w-36 shrink-0 truncate text-[12px] ${
                  f.corto ? "text-white/35" : "text-white/70"
                }`}
                title={f.corto ? `Sólo ${f.jugador.minutos} minutos jugados` : undefined}
              >
                {f.jugador.jugador}
                {f.corto && <span className="ml-1 text-white/25">*</span>}
              </span>

              <span className="h-3 min-w-0 flex-1">
                <span
                  className="block h-3 rounded-[3px]"
                  style={{
                    width: `${(Math.abs(f.valor) / tope) * 100}%`,
                    background: f.corto ? tinta(0.16) : ORO,
                  }}
                />
              </span>

              <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-white/55">
                {formatea(f.valor, metrica.unidad)}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          <strong className="text-white/60">{metrica.nombre}:</strong>{" "}
          {metrica.comoLeer}
          {metrica.mejorAlto === false && (
            <span className="text-white/35"> Aquí el primero es el que menos tiene.</span>
          )}{" "}
          Con asterisco y en gris, los que no llegan a {MINUTOS_MINIMOS} minutos.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LA FRASE                                                           */
/* ------------------------------------------------------------------ */

function lecturaDelJugador(
  jugador: FilaJugador,
  analisis: ReturnType<typeof fuertesYFlojos>,
  ambito: "puesto" | "plantilla" | "solo",
  puesto: Puesto,
) {
  if (ambito === "solo") {
    return `${jugador.jugador} es el único ${PUESTOS.find((p) => p.key === puesto)?.label.toLowerCase().replace(/e?s$/, "")} con minutos bastantes, así que no hay percentil que darle: lo que se enseña son sus cifras en crudo.`;
  }

  if (analisis.fuertes.length === 0) {
    return "No hay bastantes métricas con dato para juzgarle.";
  }

  const mejor = analisis.fuertes[0];
  const peor = analisis.flojos[0];

  const referencia =
    ambito === "puesto" ? "los de su puesto" : "la plantilla de campo";

  return `Contra ${referencia}, lo que más destaca de ${jugador.jugador} es ${mejor.metrica.nombre.toLowerCase()} (${formatea(mejor.valor, mejor.metrica.unidad)}, percentil ${mejor.percentil}); donde más le falta es ${peor.metrica.nombre.toLowerCase()} (${formatea(peor.valor, peor.metrica.unidad)}, percentil ${peor.percentil}). Con ${jugador.minutos} minutos jugados, esto es un indicio de por dónde va, no un retrato.`;
}
