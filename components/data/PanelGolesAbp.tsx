"use client";

/**
 * GOLES A BALÓN PARADO · toda la liga y nuestras temporadas.
 *
 * Contesta a la pregunta que el resto de la fase de balón parado no contesta:
 * no cuánta estrategia se juega ni cuánta acaba en remate, sino **cuántos
 * goles da y cuántos cuesta**, y de qué tipo.
 *
 * El cálculo vive en `lib/data-analisis/goles-abp.ts`. Lo que importa aquí es
 * que la pantalla **no mezcle dato y estimación sin decirlo**: el penalti es
 * dato y va en blanco; córner y falta son estimación y llevan «≈» en la
 * cabecera. Y hay un contraste con Opta, que sí cuenta los goles de ABP de la
 * categoría, para que se vea cuánto se parece la estimación a lo real.
 */

import { useMemo, useState } from "react";
import { Database, Flag, History, Scale, Swords } from "lucide-react";

import { Button, Notice, Panel } from "@/components/abp/ui";
import { Dispersion, MEJOR, ORO, PEOR, tinta, useEscudos } from "@/components/data/graficas";
import { Composicion, Lectura, type Trozo } from "@/components/data/formas";
import {
  CONVERSION_ABP,
  equiposConMuestra,
  golesAbpDeEquipo,
  type FilaGolesAbp,
  type GolesAbp,
} from "@/lib/data-analisis/goles-abp";
import { formatea, mediana, temporadaDe } from "@/lib/data-analisis/metricas";
import { filasDe, valorOpta } from "@/lib/data-analisis/opta";
import type { FilaPartido, HistoricoOpta } from "@/lib/data-analisis/leer";

type Modo = "total" | "partido";

type Lado = "aFavor" | "enContra";

type Campo = "abp" | "corner" | "falta" | "penalti" | "cuota";

type Columna = { lado: Lado; campo: Campo; rotulo: string; estimado: boolean };

/* El mismo juego de columnas a cada lado: el balón parado es a favor contra en contra. */
const CAMPOS: { campo: Campo; rotulo: string; estimado: boolean }[] = [
  { campo: "abp", rotulo: "ABP", estimado: true },
  { campo: "corner", rotulo: "Córner", estimado: true },
  { campo: "falta", rotulo: "Falta", estimado: true },
  { campo: "penalti", rotulo: "Penalti", estimado: false },
  { campo: "cuota", rotulo: "% goles", estimado: true },
];

const COLUMNAS: Columna[] = (["aFavor", "enContra"] as Lado[]).flatMap((lado) =>
  CAMPOS.map((c) => ({ lado, ...c })),
);

const claveDe = (c: { lado: Lado; campo: Campo }) => `${c.lado}.${c.campo}`;

const porcentaje = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : null);

/** El valor de una casilla, en total o por partido. `null` si no se puede saber. */
function valorDe(g: GolesAbp, campo: Campo, modo: Modo): number | null {
  if (campo === "cuota") return g.hayOrigen ? porcentaje(g.abp, g.goles) : null;

  if (campo !== "penalti" && !g.hayOrigen) return null;

  const n = g[campo];

  if (modo === "total") return n;

  return g.partidos > 0 ? n / g.partidos : null;
}

/** El balance, siempre por partido cuando se pide así: los dos lados no tienen por qué tener los mismos. */
function balanceDe(fila: FilaGolesAbp, modo: Modo): number | null {
  const a = valorDe(fila.aFavor, "abp", modo);
  const b = valorDe(fila.enContra, "abp", modo);

  return a === null || b === null ? null : a - b;
}

const muestra = (valor: number | null, campo: Campo, modo: Modo) =>
  campo === "cuota"
    ? valor === null
      ? "—"
      : `${Math.round(valor)}%`
    : formatea(valor, modo === "total" ? "entero" : "decimal");

const goles = (n: number) => (n === 1 ? "gol" : "goles");

export function PanelGolesAbp({
  partidos,
  temporada,
  historico,
  nosotros,
  onVerRegistro,
}: {
  /** Todas las filas del dataset, de todas las temporadas. */
  partidos: FilaPartido[];
  temporada: string;
  historico: HistoricoOpta[];
  nosotros: string;
  /** Lleva a «Nuestro balón parado», que es donde está el dato real del Castilla. */
  onVerRegistro?: () => void;
}) {
  const [modo, setModo] = useState<Modo>("total");
  const [orden, setOrden] = useState<{ clave: string; desc: boolean }>({
    clave: "aFavor.abp",
    desc: true,
  });

  const escudoDe = useEscudos();

  /* ------------------------------ LA LIGA ------------------------------ */

  const deLaTemporada = useMemo(
    () => partidos.filter((p) => temporadaDe(p.fecha) === temporada),
    [partidos, temporada],
  );

  const muestraLiga = useMemo(() => equiposConMuestra(deLaTemporada), [deLaTemporada]);

  const filas = useMemo(
    () => muestraLiga.equipos.map((e) => golesAbpDeEquipo(e, deLaTemporada)),
    [deLaTemporada, muestraLiga],
  );

  /* Sólo el Castilla con muestra: las temporadas viejas no tienen liga. */
  const hayLiga = filas.length >= 3;

  const ordenadas = useMemo(() => {
    const valor = (f: FilaGolesAbp) => {
      if (orden.clave === "balance") return balanceDe(f, modo);

      const [lado, campo] = orden.clave.split(".") as [Lado, Campo];

      return valorDe(f[lado], campo, modo);
    };

    return [...filas].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);

      /* Lo que no se sabe va siempre abajo, se ordene como se ordene. */
      if (va === null && vb === null) return a.equipo.localeCompare(b.equipo, "es");
      if (va === null) return 1;
      if (vb === null) return -1;

      return orden.desc ? vb - va : va - vb;
    });
  }, [filas, modo, orden]);

  const pulsa = (clave: string) =>
    setOrden((o) => (o.clave === clave ? { clave, desc: !o.desc } : { clave, desc: true }));

  const nuestra = filas.find((f) => f.equipo === nosotros) ?? null;

  /* La categoría sumada: para la composición y para el contraste con Opta. */
  const total = useMemo(() => {
    const suma = (lado: Lado, campo: "goles" | "penalti" | "corner" | "falta" | "abp") =>
      filas
        .filter((f) => f[lado].hayOrigen)
        .reduce((t, f) => t + f[lado][campo], 0);

    return {
      goles: suma("aFavor", "goles"),
      penalti: suma("aFavor", "penalti"),
      corner: suma("aFavor", "corner"),
      falta: suma("aFavor", "falta"),
      abp: suma("aFavor", "abp"),
    };
  }, [filas]);

  const puntos = useMemo(
    () =>
      filas
        .map((f) => {
          const x = valorDe(f.aFavor, "abp", "partido");
          const y = valorDe(f.enContra, "abp", "partido");

          return x === null || y === null ? null : { equipo: f.equipo, x, y };
        })
        .filter((p): p is { equipo: string; x: number; y: number } => p !== null),
    [filas],
  );

  /* --------------------------- NUESTRA HISTORIA ------------------------ */

  const historia = useMemo(() => {
    const temporadas = [
      ...new Set(partidos.filter((p) => p.equipo === nosotros).map((p) => temporadaDe(p.fecha))),
    ]
      .filter(Boolean)
      .sort()
      .reverse();

    return temporadas.map((t) => ({
      temporada: t,
      ...golesAbpDeEquipo(
        nosotros,
        partidos.filter((p) => temporadaDe(p.fecha) === t),
      ),
    }));
  }, [nosotros, partidos]);

  const actual = historia[0]?.temporada ?? "";

  /* ------------------------------ OPTA -------------------------------- */

  const opta = useMemo(() => {
    const liga = filasDe(historico, "liga");

    const goal = valorOpta(liga, "TOTAL", "Goal");
    const abp = valorOpta(liga, "TOTAL", "GoalSetPly");

    if (!goal || abp === null) return null;

    return {
      goles: goal,
      abp,
      corner: valorOpta(liga, "TOTAL", "GoalCrnrs") ?? 0,
      directa: valorOpta(liga, "TOTAL", "GoalDirFK") ?? 0,
      penalti: valorOpta(liga, "TOTAL", "PenGoal") ?? 0,
    };
  }, [historico]);

  /* ------------------------------ PINTADO ------------------------------ */

  return (
    <>
      <div className="mt-5">
        <Notice title="Qué es dato y qué es estimación">
          <p>
            Los goles y los <strong className="text-white/75">penaltis</strong> son
            dato: los cuentan el marcador y Wyscout. De qué jugada nace cada gol no
            lo publica nadie para toda la liga —Wyscout no clasifica los goles y
            BeSoccer sólo distingue el penalti y la propia puerta—, así que{" "}
            <strong className="text-white/75">córner y falta son una estimación</strong>{" "}
            (≈): los goles sin penalti de cada equipo se reparten según de dónde
            nacen sus remates, corregido por lo que convierte cada vía en la
            categoría según Opta —un remate de córner entra la mitad que uno de
            jugada (×{CONVERSION_ABP.corner.toFixed(2).replace(".", ",")}) y el de
            falta, algo más (×{CONVERSION_ABP.falta.toFixed(2).replace(".", ",")})—.
            Sirve para ordenar la liga y ver tendencias; el gol concreto, en el vídeo.
          </p>

          <p className="mt-2">
            «Falta» incluye el resto de jugadas paradas que no son córner ni penalti
            —saques de banda largos, sobre todo—, igual que las cuenta Opta.
            {onVerRegistro && (
              <>
                {" "}
                Del Castilla de este año hay dato real, acción por acción, en el
                registro propio.
              </>
            )}
          </p>

          {onVerRegistro && (
            <div className="mt-3">
              <Button icon={Flag} onClick={onVerRegistro}>
                Ver nuestro balón parado (registro propio)
              </Button>
            </div>
          )}
        </Notice>
      </div>

      {/* ============================ LA LIGA ============================ */}

      {!hayLiga ? (
        <div className="mt-5">
          <Notice tone="warn" title={`Sin la liga entera en ${temporada}`}>
            De {temporada} sólo hay informes del Castilla y la fila de su rival en
            cada partido: no hay con quién hacer una tabla de la categoría. La liga
            entera está en las temporadas con los informes de los veinte equipos.
            Abajo, el Castilla temporada a temporada.
          </Notice>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <Panel
              title="La categoría, a balón parado"
              subtitle={`Los goles que hace y recibe cada equipo en ${temporada}. Pulsa una cabecera para ordenar.`}
              icon={Scale}
              action={
                <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                  {(
                    [
                      { valor: "total", rotulo: "Totales" },
                      { valor: "partido", rotulo: "Por partido" },
                    ] as const
                  ).map((opcion) => (
                    <button
                      key={opcion.valor}
                      type="button"
                      onClick={() => setModo(opcion.valor)}
                      aria-pressed={modo === opcion.valor}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                        modo === opcion.valor
                          ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                          : "text-white/50 hover:text-white"
                      }`}
                    >
                      {opcion.rotulo}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.16em]">
                      <th className="pb-1 pr-2 text-left font-medium text-white/40" colSpan={3} />
                      <th
                        className="border-b pb-1 text-center font-medium"
                        colSpan={CAMPOS.length}
                        style={{ color: MEJOR, borderColor: tinta(0.1) }}
                      >
                        A favor
                      </th>
                      <th className="w-3" />
                      <th
                        className="border-b pb-1 text-center font-medium"
                        colSpan={CAMPOS.length}
                        style={{ color: PEOR, borderColor: tinta(0.1) }}
                      >
                        En contra
                      </th>
                      <th />
                    </tr>

                    <tr className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                      <th className="w-6 pb-2 pt-1.5 text-right font-medium">#</th>
                      <th className="pb-2 pl-2 pt-1.5 text-left font-medium">Equipo</th>
                      <th className="pb-2 pr-3 pt-1.5 text-right font-medium">PJ</th>

                      {COLUMNAS.map((c, i) => (
                        <CabeceraOrdenable
                          key={claveDe(c)}
                          rotulo={c.rotulo}
                          estimado={c.estimado}
                          activa={orden.clave === claveDe(c)}
                          desc={orden.desc}
                          onPulsa={() => pulsa(claveDe(c))}
                          separa={i === CAMPOS.length}
                        />
                      ))}

                      <CabeceraOrdenable
                        rotulo="Balance"
                        estimado
                        activa={orden.clave === "balance"}
                        desc={orden.desc}
                        onPulsa={() => pulsa("balance")}
                        separa
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {ordenadas.map((fila, indice) => {
                      const esNuestro = fila.equipo === nosotros;
                      const balance = balanceDe(fila, modo);

                      return (
                        <tr
                          key={fila.equipo}
                          className={`border-t border-white/[0.06] ${
                            esNuestro ? "bg-[#C8A96B]/[0.07]" : ""
                          }`}
                        >
                          <td className="py-1.5 text-right text-[10px] tabular-nums text-white/25">
                            {indice + 1}
                          </td>

                          <td className="py-1.5 pl-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              {escudoDe(fila.equipo) ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={escudoDe(fila.equipo)!}
                                  alt=""
                                  width={16}
                                  height={16}
                                  className="h-4 w-4 shrink-0 object-contain"
                                />
                              ) : (
                                <span className="h-4 w-4 shrink-0" aria-hidden />
                              )}

                              <span
                                className={`truncate ${esNuestro ? "font-semibold" : "text-white/70"}`}
                                style={esNuestro ? { color: ORO } : undefined}
                              >
                                {fila.equipo}
                              </span>
                            </span>
                          </td>

                          <td className="py-1.5 pr-3 text-right tabular-nums text-white/45">
                            {fila.aFavor.partidos}
                          </td>

                          {COLUMNAS.map((c, i) => {
                            const valor = valorDe(fila[c.lado], c.campo, modo);

                            return (
                              <td
                                key={claveDe(c)}
                                className={`py-1.5 text-right tabular-nums ${
                                  i === CAMPOS.length ? "border-l pl-3" : "pl-2"
                                } ${
                                  c.campo === "abp"
                                    ? "font-semibold text-white"
                                    : c.campo === "cuota"
                                      ? "text-white/40"
                                      : "text-white/65"
                                }`}
                                style={i === CAMPOS.length ? { borderColor: tinta(0.08) } : undefined}
                              >
                                {muestra(valor, c.campo, modo)}
                              </td>
                            );
                          })}

                          <td
                            className="border-l py-1.5 pl-3 text-right font-semibold tabular-nums"
                            style={{
                              borderColor: tinta(0.08),
                              color:
                                balance === null || Math.abs(balance) < 1e-9
                                  ? tinta(0.5)
                                  : balance > 0
                                    ? MEJOR
                                    : PEOR,
                            }}
                          >
                            {balance === null
                              ? "—"
                              : `${balance > 0 ? "+" : ""}${formatea(
                                  balance,
                                  modo === "total" ? "entero" : "decimal",
                                )}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Lectura>{lecturaDeLaLiga(filas, nosotros, temporada)}</Lectura>

              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                ≈ estimación · sin ≈, dato. «ABP» suma córner, falta y penalti; «%
                goles» es qué parte de todos sus goles llega así. El puesto de la
                lectura va siempre por partido, que no todos llevan los mismos.
                {muestraLiga.fuera > 0 &&
                  ` Fuera de la tabla, ${muestraLiga.fuera} equipos con menos de ${muestraLiga.suelo} partidos en los informes: son rivales de rivales, con un partido o dos.`}
              </p>
            </Panel>
          </div>

          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
            <Panel
              title="Lo que da y lo que cuesta"
              subtitle="Goles a balón parado por partido, a favor y en contra. Abajo a la derecha, los que ganan la estrategia."
              icon={Swords}
            >
              <Dispersion
                puntos={puntos}
                etiquetaX="Goles ABP a favor por partido"
                etiquetaY="Goles ABP en contra por partido"
                unidadX="decimal"
                unidadY="decimal"
                destacado={nosotros}
              />

              <Lectura>{lecturaDeLaNube(puntos, nosotros)}</Lectura>
            </Panel>

            <Panel
              title="De qué tipo son"
              subtitle="Córner, falta o penalti: no se entrenan igual ni se defienden igual"
              icon={Flag}
            >
              <div className="space-y-5">
                {(["aFavor", "enContra"] as Lado[]).map((lado) => {
                  const mia = nuestra?.[lado];

                  const trozos: Trozo[] = [
                    { etiqueta: "Córner ≈", valor: mia?.corner ?? 0 },
                    { etiqueta: "Falta ≈", valor: mia?.falta ?? 0 },
                    { etiqueta: "Penalti", valor: mia?.penalti ?? 0 },
                  ];

                  /* La categoría, por el lado de quien marca: son los mismos goles. */
                  const liga: Trozo[] = [
                    { etiqueta: "Córner ≈", valor: total.corner },
                    { etiqueta: "Falta ≈", valor: total.falta },
                    { etiqueta: "Penalti", valor: total.penalti },
                  ];

                  return (
                    <Composicion
                      key={lado}
                      titulo={lado === "aFavor" ? "Los que marcamos" : "Los que nos marcan"}
                      trozos={trozos}
                      trozosLiga={liga}
                      rotulo={nosotros}
                      rotuloLiga="La categoría entera"
                      lectura={lecturaDelTipo(mia ?? null, lado, total)}
                    />
                  );
                })}
              </div>
            </Panel>
          </div>

          {opta && (
            <div className="mt-5">
              <Panel
                title="Contra lo que mide Opta"
                subtitle="Opta sí cuenta los goles de balón parado, pero sólo de la categoría sumada: sirve para ver cuánto se parece la estimación a lo real"
                icon={Database}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <CifraContraste
                    rotulo="Opta · dato real"
                    pie="El agregado de la categoría que hay en la carpeta"
                    goles={opta.goles}
                    abp={opta.abp}
                    corner={opta.corner}
                    penalti={opta.penalti}
                    detalle={`${opta.corner} de córner, ${opta.directa} de falta directa y ${Math.max(
                      0,
                      opta.abp - opta.corner - opta.directa,
                    )} de otras jugadas paradas`}
                  />

                  <CifraContraste
                    rotulo={`Esta pantalla · ${temporada}`}
                    pie={`Los ${filas.length} equipos de la tabla, sumados`}
                    goles={total.goles}
                    abp={total.corner + total.falta}
                    corner={total.corner}
                    penalti={total.penalti}
                    detalle={`${total.corner} de córner y ${total.falta} de falta y otras`}
                    oro
                  />
                </div>

                <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                  Los porcentajes son sobre todos los goles; «balón parado» aquí es sin
                  penaltis, que van aparte. El agregado de Opta no dice de qué temporada
                  ni de cuántos equipos es, así que no se compara equipo a equipo: dice
                  si el reparto de la categoría se parece al real. Si un día se separan
                  mucho, hay que volver a medir los factores de `goles-abp.ts`.
                </p>
              </Panel>
            </div>
          )}
        </>
      )}

      {/* ======================= NUESTRAS TEMPORADAS ======================= */}

      <div className="mt-5">
        <Panel
          title="El Castilla, temporada a temporada"
          subtitle="Los goles a balón parado de cada curso del que hay informes, a favor y en contra"
          icon={History}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.16em]">
                  <th colSpan={2} />
                  <th
                    className="border-b pb-1 text-center font-medium"
                    colSpan={6}
                    style={{ color: MEJOR, borderColor: tinta(0.1) }}
                  >
                    A favor
                  </th>
                  <th
                    className="border-b pb-1 text-center font-medium"
                    colSpan={6}
                    style={{ color: PEOR, borderColor: tinta(0.1) }}
                  >
                    En contra
                  </th>
                </tr>

                <tr className="text-right text-[10px] uppercase tracking-[0.12em] text-white/40">
                  <th className="pb-2 pt-1.5 text-left font-medium">Temporada</th>
                  <th className="pb-2 pr-3 pt-1.5 font-medium">PJ</th>
                  {[0, 1].map((lado) =>
                    ["Goles", "ABP ≈", "Córner ≈", "Falta ≈", "Penalti", "% ≈"].map((r, i) => (
                      <th
                        key={`${lado}-${r}`}
                        className={`pb-2 pt-1.5 font-medium ${i === 0 && lado === 1 ? "border-l pl-3" : "pl-2"}`}
                        style={i === 0 && lado === 1 ? { borderColor: tinta(0.08) } : undefined}
                      >
                        {r}
                      </th>
                    )),
                  )}
                </tr>
              </thead>

              <tbody>
                {historia.map((t) => (
                  <tr
                    key={t.temporada}
                    className={`border-t border-white/[0.06] ${
                      t.temporada === actual ? "bg-[#C8A96B]/[0.07]" : ""
                    }`}
                  >
                    <td
                      className="py-1.5 font-semibold"
                      style={{ color: t.temporada === actual ? ORO : undefined }}
                    >
                      {t.temporada}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-white/45">
                      {t.aFavor.partidos}
                    </td>

                    {(["aFavor", "enContra"] as Lado[]).map((lado) => {
                      const g = t[lado];

                      const celdas: { valor: string; fuerte?: boolean; tenue?: boolean }[] = [
                        { valor: String(g.goles), tenue: true },
                        { valor: g.hayOrigen ? String(g.abp) : "—", fuerte: true },
                        { valor: g.hayOrigen ? String(g.corner) : "—" },
                        { valor: g.hayOrigen ? String(g.falta) : "—" },
                        { valor: String(g.penalti) },
                        {
                          valor: muestra(valorDe(g, "cuota", "total"), "cuota", "total"),
                          tenue: true,
                        },
                      ];

                      return celdas.map((celda, i) => (
                        <td
                          key={`${lado}-${i}`}
                          className={`py-1.5 text-right tabular-nums ${
                            i === 0 && lado === "enContra" ? "border-l pl-3" : "pl-2"
                          } ${
                            celda.fuerte
                              ? "font-semibold text-white"
                              : celda.tenue
                                ? "text-white/40"
                                : "text-white/65"
                          }`}
                          style={
                            i === 0 && lado === "enContra" ? { borderColor: tinta(0.08) } : undefined
                          }
                        >
                          {celda.valor}
                        </td>
                      ));
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Lectura>{lecturaDeLaHistoria(historia)}</Lectura>

          <p className="mt-2 text-[11px] leading-relaxed text-white/40">
            {actual} va con los partidos que lleva y las demás con todos: los totales
            no se comparan, los porcentajes sí. El reparto de cada curso se hace con
            los remates de ese curso.
          </p>
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

function CabeceraOrdenable({
  rotulo,
  estimado,
  activa,
  desc,
  onPulsa,
  separa,
}: {
  rotulo: string;
  estimado: boolean;
  activa: boolean;
  desc: boolean;
  onPulsa: () => void;
  separa?: boolean;
}) {
  return (
    <th
      className={`pb-2 pt-1.5 text-right font-medium ${separa ? "border-l pl-3" : "pl-2"}`}
      style={separa ? { borderColor: tinta(0.08) } : undefined}
      aria-sort={activa ? (desc ? "descending" : "ascending") : undefined}
    >
      <button
        type="button"
        onClick={onPulsa}
        title={estimado ? "Estimación: pulsa para ordenar" : "Dato: pulsa para ordenar"}
        className={`whitespace-nowrap uppercase tracking-[0.12em] transition hover:text-white ${
          activa ? "text-[#C8A96B]" : ""
        }`}
      >
        {rotulo}
        {estimado && rotulo !== "% goles" && rotulo !== "Balance" ? " ≈" : ""}
        {activa ? (desc ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
}

function CifraContraste({
  rotulo,
  pie,
  goles: total,
  abp,
  corner,
  penalti,
  detalle,
  oro = false,
}: {
  rotulo: string;
  pie: string;
  goles: number;
  abp: number;
  corner: number;
  penalti: number;
  detalle: string;
  oro?: boolean;
}) {
  const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1).replace(".", ",")} %` : "—");

  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
      style={oro ? { borderColor: "rgb(var(--rmcf-gold-rgb, 200 169 107) / .35)" } : undefined}
    >
      <p
        className="text-[10px] uppercase tracking-[0.16em]"
        style={{ color: oro ? ORO : tinta(0.4) }}
      >
        {rotulo} · {total} goles
      </p>

      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {[
          { que: "Balón parado", valor: pct(abp) },
          { que: "Córner", valor: pct(corner) },
          { que: "Penalti", valor: pct(penalti) },
        ].map((c) => (
          <div key={c.que}>
            <p className="text-lg font-semibold tabular-nums text-white">{c.valor}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">{c.que}</p>
          </div>
        ))}
      </div>

      <p className="mt-1.5 text-[11px] text-white/45">
        {abp} a balón parado: {detalle}; {penalti} de penalti.
      </p>

      <p className="mt-1 text-[11px] text-white/35">{pie}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LO QUE DICE CADA GRÁFICO                                           */
/* ------------------------------------------------------------------ */

/** El puesto de un equipo en una lista, de mejor a peor según el sentido. */
function puesto(
  filas: FilaGolesAbp[],
  equipo: string,
  valor: (f: FilaGolesAbp) => number | null,
  masEsMejor: boolean,
) {
  const con = filas
    .map((f) => ({ equipo: f.equipo, v: valor(f) }))
    .filter((f): f is { equipo: string; v: number } => f.v !== null)
    .sort((a, b) => (masEsMejor ? b.v - a.v : a.v - b.v));

  const mio = con.find((f) => f.equipo === equipo);

  if (!mio) return null;

  /* Los empatados comparten puesto: con goles enteros hay muchos. */
  return {
    puesto: con.findIndex((f) => f.v === mio.v) + 1,
    de: con.length,
    mediana: mediana(con.map((f) => f.v)),
  };
}

function lecturaDeLaLiga(filas: FilaGolesAbp[], nosotros: string, temporada: string) {
  const mia = filas.find((f) => f.equipo === nosotros);

  if (!mia) {
    return `El Castilla no tiene informes en ${temporada}: la tabla es la de la categoría.`;
  }

  const favor = puesto(filas, nosotros, (f) => valorDe(f.aFavor, "abp", "partido"), true);
  const contra = puesto(filas, nosotros, (f) => valorDe(f.enContra, "abp", "partido"), false);

  const a = mia.aFavor;
  const c = mia.enContra;

  const cuotaLiga = mediana(
    filas
      .map((f) => valorDe(f.aFavor, "cuota", "total"))
      .filter((v): v is number => v !== null),
  );

  const cuota = valorDe(a, "cuota", "total");

  /* «Lleva 0 goles (0 de penalti)» no lo dice nadie en una caseta. */
  const marca =
    a.abp === 0
      ? `El Castilla no ha marcado ningún gol a balón parado en ${a.partidos} partidos`
      : `El Castilla lleva ${a.abp} ${goles(a.abp)} a balón parado en ${a.partidos} partidos (${a.penalti} de penalti)`;

  const encaja =
    c.abp === 0
      ? " No le han marcado ninguno"
      : ` Encaja ${c.abp} (${c.penalti} de penalti)`;

  const partes = [
    marca,
    favor
      ? `: ${favor.puesto}º de ${favor.de} por partido, con la mediana de la categoría en ${formatea(favor.mediana, "decimal")}.`
      : ".",
    encaja,
    contra ? `: ${contra.puesto}º de ${contra.de} contando de menos a más.` : ".",
  ];

  if (cuota !== null && cuotaLiga !== null) {
    partes.push(
      ` El ${Math.round(cuota)} % de sus goles llega a balón parado; en el equipo mediano de la categoría, el ${Math.round(cuotaLiga)} %.`,
    );
  }

  return partes.join("");
}

function lecturaDeLaNube(
  puntos: { equipo: string; x: number; y: number }[],
  nosotros: string,
) {
  const mio = puntos.find((p) => p.equipo === nosotros);

  if (!mio || puntos.length < 3) return "Cada punto es un equipo: a la derecha marca más, arriba encaja más.";

  const mx = mediana(puntos.map((p) => p.x)) ?? 0;
  const my = mediana(puntos.map((p) => p.y)) ?? 0;

  const marca = mio.x >= mx ? "marca más que la mediana" : "marca menos que la mediana";
  const encaja = mio.y <= my ? "encaja menos" : "encaja más";

  const cuadrante =
    mio.x >= mx && mio.y <= my
      ? "Es el cuadrante bueno: la estrategia suma."
      : mio.x < mx && mio.y > my
        ? "Es el cuadrante malo: la estrategia resta por los dos lados."
        : mio.x >= mx
          ? "Lo que se gana arriba se devuelve atrás."
          : "Se defiende bien, pero no se le saca partido en ataque.";

  return `El Castilla ${marca} a balón parado (${formatea(mio.x, "decimal")} por partido frente a ${formatea(mx, "decimal")}) y ${encaja} (${formatea(mio.y, "decimal")} frente a ${formatea(my, "decimal")}). ${cuadrante}`;
}

function lecturaDelTipo(
  mia: GolesAbp | null,
  lado: Lado,
  total: { corner: number; falta: number; penalti: number; abp: number },
) {
  const ligaCorner = total.abp > 0 ? Math.round((total.corner / total.abp) * 100) : null;

  if (!mia || !mia.hayOrigen) return "Sin remates clasificados no hay reparto.";

  if (mia.abp === 0) {
    return lado === "aFavor"
      ? "El Castilla no ha marcado ningún gol a balón parado en esta temporada."
      : "Al Castilla no le han marcado ningún gol a balón parado en esta temporada.";
  }

  const sujeto = lado === "aFavor" ? "De los que marca el Castilla" : "De los que le marcan";

  const corner = Math.round((mia.corner / mia.abp) * 100);

  return `${sujeto}, ${mia.corner} de córner, ${mia.falta} de falta y ${mia.penalti} de penalti: el córner es el ${corner} %${
    ligaCorner === null ? "" : `, y en la categoría el ${ligaCorner} %`
  }.`;
}

function lecturaDeLaHistoria(
  historia: ({ temporada: string } & FilaGolesAbp)[],
) {
  if (historia.length === 0) return "No hay informes del Castilla.";

  const [actual, ...cerradas] = historia;

  const cuotaDe = (lista: GolesAbp[]) => {
    const conOrigen = lista.filter((g) => g.hayOrigen);

    const goles = conOrigen.reduce((t, g) => t + g.goles, 0);
    const abp = conOrigen.reduce((t, g) => t + g.abp, 0);

    return goles > 0 ? Math.round((abp / goles) * 100) : null;
  };

  const antesFavor = cuotaDe(cerradas.map((t) => t.aFavor));
  const antesContra = cuotaDe(cerradas.map((t) => t.enContra));

  const ahoraFavor = cuotaDe([actual.aFavor]);
  const ahoraContra = cuotaDe([actual.enContra]);

  if (cerradas.length === 0 || antesFavor === null || antesContra === null) {
    return `En ${actual.temporada}, ${actual.aFavor.abp} ${goles(actual.aFavor.abp)} a balón parado a favor y ${actual.enContra.abp} en contra.`;
  }

  return `En las ${cerradas.length} temporadas cerradas, el ${antesFavor} % de los goles del Castilla llegó a balón parado y el ${antesContra} % de los que encajó, también. En ${actual.temporada} va en el ${ahoraFavor ?? "—"} % y el ${ahoraContra ?? "—"} %, con ${actual.aFavor.partidos} partidos: con tan pocos, un gol mueve diez puntos.`;
}
