"use client";

import { useMemo, useState } from "react";
import { Scale, TrendingUp, User, Users } from "lucide-react";

import { Notice, Panel } from "@/components/abp/ui";
import { Lectura } from "@/components/data/formas";
import { MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { formatea } from "@/lib/data-analisis/metricas";
import {
  AMBITOS,
  GRUPOS_JUGADOR,
  MINUTOS_MINIMOS,
  MINUTOS_MINIMOS_ANTERIOR,
  PUESTOS,
  comparablesDe,
  esNuestro,
  evolucionDe,
  fuertesYFlojos,
  metricasDe,
  percentilEnPlantilla,
  puestoDe,
  universoDe,
  valorDe,
  type Ambito,
  type Comparacion,
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

  /* Se compara contra la categoría por defecto: es la pregunta que importa. */
  const [ambito, setAmbito] = useState<Ambito>("liga");

  /* En el desplegable van los nuestros de esta temporada; los mil ochocientos
     de la liga están detrás, como referencia, no para elegirlos. */
  const ordenados = useMemo(
    () =>
      jugadores
        .filter((j) => j.temporada === "actual" && esNuestro(j))
        .sort((a, b) => b.minutos - a.minutos),
    [jugadores],
  );

  const jugador = ordenados[Math.min(cual, Math.max(0, ordenados.length - 1))] ?? null;

  const puesto: Puesto = jugador ? puestoDe(jugador.posicion) : "MED";

  const comparacion = useMemo(
    () => comparablesDe(jugadores, puesto, ambito),
    [ambito, jugadores, puesto],
  );

  const evolucion = useMemo(
    () => (jugador
        ? evolucionDe(jugador, jugadores)
        : { antes: null, filas: [], fiable: false }),
    [jugador, jugadores],
  );

  /* Cuánta gente hay detrás de cada listón, para poder decirlo. */
  const tamanos = useMemo(
    () => ({
      plantilla: universoDe(jugadores, "plantilla").length,
      liga: universoDe(jugadores, "liga").length,
      ligaAnterior: universoDe(jugadores, "ligaAnterior").length,
    }),
    [jugadores],
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
            Wyscout</strong>: una fila por jugador con todo ya por noventa
            minutos, que es la única forma de comparar a quien lleva doscientos
            minutos con quien lleva veintitrés. Hay{" "}
            <strong className="text-white/75">
              {tamanos.liga} jugadores de la categoría de esta temporada
            </strong>{" "}
            y{" "}
            <strong className="text-white/75">
              {tamanos.ligaAnterior} de la temporada pasada
            </strong>
            , así que el percentil ya no es «de los mejores del Castilla»: es de
            la liga.
          </p>

          <ul className="mt-2 space-y-1.5">
            <li>
              <strong className="text-white/70">Elige contra quién.</strong>{" "}
              La plantilla sirve para repartir minutos; la categoría, para saber
              si un canterano está para jugar aquí.
            </li>

            <li>
              <strong className="text-white/70">Los minutos mandan.</strong>{" "}
              De esta temporada entran los que pasan de {MINUTOS_MINIMOS}{" "}
              minutos y de la pasada los que pasan de{" "}
              {MINUTOS_MINIMOS_ANTERIOR}: noventa minutos en septiembre son un
              partido, y noventa minutos en una temporada entera son un jugador
              que no jugó.
            </li>
          </ul>
        </Notice>
      </div>

      {/* A quién se mira y contra quién. */}
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

        <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
          {AMBITOS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAmbito(a.key)}
              aria-pressed={ambito === a.key}
              title={a.explica}
              className={`rounded-lg px-3 py-2 text-xs transition ${
                ambito === a.key
                  ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {a.corto}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-white/35">
          {PUESTOS.find((p) => p.key === puesto)?.label} ·{" "}
          {comparacion.contra === "puesto"
            ? `contra los ${comparacion.lista.length} de su puesto`
            : comparacion.contra === "campo"
              ? `sin bastantes de su puesto: contra los ${comparacion.lista.length} de campo`
              : "sin nadie con quien compararse: sólo sus cifras"}
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

          {comparacion.contra !== "solo" && analisis.fuertes.length > 0 && (
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

          <Lectura>{lecturaDelJugador(jugador, analisis, comparacion, puesto)}</Lectura>
        </Panel>
      </div>

      {/* El detalle métrica a métrica. */}
      <div className="mt-5">
        <Panel
          title="Métrica a métrica"
          subtitle={
            comparacion.contra === "solo"
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
                          conPercentil={comparacion.contra !== "solo"}
                        />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      </div>

      {/* ¿Ha mejorado respecto al año pasado? */}
      <PanelEvolucion jugador={jugador} evolucion={evolucion} />

      {/* La plantilla entera en una métrica. */}
      <TablaPlantilla jugadores={ordenados} puesto={puesto} />
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
  comparacion: Comparacion,
  puesto: Puesto,
) {
  if (comparacion.contra === "solo") {
    return `${jugador.jugador} es el único ${PUESTOS.find((p) => p.key === puesto)?.label.toLowerCase().replace(/e?s$/, "")} con minutos bastantes, así que no hay percentil que darle: lo que se enseña son sus cifras en crudo.`;
  }

  if (analisis.fuertes.length === 0) {
    return "No hay bastantes métricas con dato para juzgarle.";
  }

  const mejor = analisis.fuertes[0];
  const peor = analisis.flojos[0];

  const donde = AMBITOS.find((a) => a.key === comparacion.ambito)?.label ?? "";

  const referencia =
    comparacion.contra === "puesto"
      ? `los ${comparacion.lista.length} de su puesto de ${donde.toLowerCase()}`
      : `los de campo de ${donde.toLowerCase()}`;

  return `Contra ${referencia}, lo que más destaca de ${jugador.jugador} es ${mejor.metrica.nombre.toLowerCase()} (${formatea(mejor.valor, mejor.metrica.unidad)}, percentil ${mejor.percentil}); donde más le falta es ${peor.metrica.nombre.toLowerCase()} (${formatea(peor.valor, peor.metrica.unidad)}, percentil ${peor.percentil}). Con ${jugador.minutos} minutos jugados, esto es un indicio de por dónde va, no un retrato.`;
}

/* ------------------------------------------------------------------ */
/*  ¿HA MEJORADO?                                                      */
/* ------------------------------------------------------------------ */

/**
 * El mismo jugador, un año después.
 *
 * Es la pregunta que de verdad se le hace al trabajo individual: no «cuánto
 * hace» sino «¿hace más que antes, comparado con sus iguales?». Comparar el
 * número de este año con el del pasado no valdría —cambia el rol, cambian los
 * minutos, cambia el equipo—, así que se compara **el percentil de cada año
 * contra su propia categoría**. Del 40 al 70 es haber mejorado de verdad.
 */
function PanelEvolucion({
  jugador,
  evolucion,
}: {
  jugador: FilaJugador;
  evolucion: ReturnType<typeof evolucionDe>;
}) {
  const { antes, filas } = evolucion;

  if (!antes) {
    return (
      <div className="mt-5">
        <Panel
          title="Cómo ha evolucionado"
          subtitle="El mismo jugador, contra su categoría, un año después"
          icon={TrendingUp}
        >
          <p className="py-6 text-center text-[12px] leading-relaxed text-white/40">
            {jugador.jugador} no aparece en la descarga de la temporada pasada:
            o no jugó en esta categoría o llegó este verano. Sin el año anterior
            no hay evolución que medir.
          </p>
        </Panel>
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div className="mt-5">
        <Panel
          title="Cómo ha evolucionado"
          subtitle={`Jugó ${antes.partidos} partidos y ${antes.minutos}′ la temporada pasada en ${antes.equipo}`}
          icon={TrendingUp}
        >
          <p className="py-6 text-center text-[12px] leading-relaxed text-white/40">
            No hay bastantes métricas con dato en los dos años para compararlas.
          </p>
        </Panel>
      </div>
    );
  }

  const suben = filas.filter((f) => f.salto > 0).length;

  /* Lo que más sube y lo que más baja, con un mínimo para no contar el ruido. */
  const mejores = filas.filter((f) => f.salto >= 10).slice(0, 5);
  const peores = filas.filter((f) => f.salto <= -10).slice(-5).reverse();

  return (
    <div className="mt-5">
      <Panel
        title="Cómo ha evolucionado"
        subtitle={`Contra la categoría de cada año · la pasada, ${antes.partidos} partidos y ${antes.minutos}′ en ${antes.equipo}`}
        icon={TrendingUp}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            { titulo: "Donde más ha crecido", filas: mejores, color: MEJOR },
            { titulo: "Donde ha perdido terreno", filas: peores, color: PEOR },
          ].map((bloque) => (
            <div key={bloque.titulo} className="min-w-0">
              <p
                className="mb-2 text-[10px] uppercase tracking-[0.16em]"
                style={{ color: bloque.color }}
              >
                {bloque.titulo}
              </p>

              {bloque.filas.length === 0 ? (
                <p className="text-[12px] text-white/35">
                  Nada que se mueva más de diez puntos de percentil.
                </p>
              ) : (
                <div className="space-y-2">
                  {bloque.filas.map((f) => (
                    <FilaEvolucion key={f.metrica.columna} fila={f} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <Lectura>
          {`De ${filas.length} métricas comparables, ${jugador.jugador} sube en ${suben} y baja en ${filas.length - suben} respecto a su puesto en la categoría. ${
            mejores.length
              ? `Lo que más ha crecido es ${mejores[0].metrica.nombre.toLowerCase()}: del percentil ${mejores[0].percentilAntes} al ${mejores[0].percentilAhora}.`
              : "Ninguna se mueve lo bastante como para llamarlo un salto."
          }${
            peores.length
              ? ` Lo que más ha caído es ${peores[0].metrica.nombre.toLowerCase()}: del ${peores[0].percentilAntes} al ${peores[0].percentilAhora}.`
              : ""
          }`}
        </Lectura>

        {!evolucion.fiable && (
          <div className="mt-3">
            <Notice
              tone="warn"
              title={`El año pasado sólo jugó ${antes.minutos} minutos`}
            >
              Su percentil de entonces sale de una muestra de un partido, así
              que el salto de este año es más ruido que progreso. Se enseña para
              mirarlo, pero no cuenta en los avisos de la sección de
              entrenamiento.
            </Notice>
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          Se compara percentil contra percentil, cada año contra su propia
          categoría: así el cambio no depende de que el equipo juegue distinto
          ni de cuántos minutos lleve. Con {jugador.minutos}′ de esta temporada
          es un indicio temprano, no un veredicto.
        </p>
      </Panel>
    </div>
  );
}

/** Una métrica con su salto de percentil de un año a otro. */
function FilaEvolucion({ fila }: { fila: ReturnType<typeof evolucionDe>["filas"][number] }) {
  const color = fila.salto >= 0 ? MEJOR : PEOR;

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[12px] text-white/65">
          {fila.metrica.nombre}
        </span>

        <span className="shrink-0 text-[11px] tabular-nums" style={{ color }}>
          {fila.salto >= 0 ? "+" : ""}
          {fila.salto} puntos
        </span>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-white/30">
          p{fila.percentilAntes}
        </span>

        <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-white/[0.06]">
          {/* De dónde venía, apagado; a dónde ha llegado, en color. */}
          <span
            className="absolute left-0 top-0 block h-2.5 rounded-[3px]"
            style={{ width: `${fila.percentilAntes}%`, background: tinta(0.22) }}
          />

          <span
            className="absolute top-0 block h-2.5 rounded-[3px]"
            style={{
              left: `${Math.min(fila.percentilAntes, fila.percentilAhora)}%`,
              width: `${Math.abs(fila.salto)}%`,
              background: color,
            }}
          />
        </span>

        <span className="w-9 shrink-0 text-[10px] tabular-nums" style={{ color }}>
          p{fila.percentilAhora}
        </span>

        <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-white/45">
          {formatea(fila.antes, fila.metrica.unidad)} →{" "}
          {formatea(fila.ahora, fila.metrica.unidad)}
        </span>
      </div>
    </div>
  );
}
