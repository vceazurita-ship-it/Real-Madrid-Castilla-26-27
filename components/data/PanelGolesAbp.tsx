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
import { Database, Flag, History, Scale } from "lucide-react";

import { Button, Notice, Panel } from "@/components/abp/ui";
import { MEJOR, ORO, PEOR, tinta, useEscudos } from "@/components/data/graficas";
import { Lectura } from "@/components/data/formas";
import {
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

type Campo = "goles" | "penalti";

type Columna = { lado: Lado; campo: Campo; rotulo: string; estimado: boolean };

/*
| SÓLO LO QUE ESTÁ MEDIDO.
|
| Aquí hubo cinco columnas por lado —ABP, córner, falta, penalti y % de goles—
| y tres de ellas eran un reparto estimado de los goles sin penalti. Se
| retiraron el 16/09/2026 después de medirlas: ver el aviso de la pantalla.
| Quedan las dos que cuentan el marcador y Wyscout.
*/
const CAMPOS: { campo: Campo; rotulo: string; estimado: boolean }[] = [
  { campo: "goles", rotulo: "Goles", estimado: false },
  { campo: "penalti", rotulo: "De penalti", estimado: false },
];

const COLUMNAS: Columna[] = (["aFavor", "enContra"] as Lado[]).flatMap((lado) =>
  CAMPOS.map((c) => ({ lado, ...c })),
);

const claveDe = (c: { lado: Lado; campo: Campo }) => `${c.lado}.${c.campo}`;

/** El valor de una casilla, en total o por partido. `null` si no se puede saber. */
function valorDe(g: GolesAbp, campo: Campo, modo: Modo): number | null {
  const n = g[campo];

  if (modo === "total") return n;

  return g.partidos > 0 ? n / g.partidos : null;
}

const muestra = (valor: number | null, modo: Modo) =>
  formatea(valor, modo === "total" ? "entero" : "decimal");

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
    clave: "aFavor.goles",
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
        <Notice tone="warn" title="Aquí ya no se reparten los goles por tipo de jugada">
          <p>
            Los goles y los <strong className="text-white/75">penaltis</strong> son
            dato: los cuentan el marcador y Wyscout. Pero{" "}
            <strong className="text-white/75">
              de qué jugada nace cada gol no lo publica nadie para toda la liga
            </strong>
            : Wyscout no clasifica los goles y BeSoccer sólo distingue el penalti y
            la propia puerta.
          </p>

          <p className="mt-2">
            Esta pantalla llegó a repartir los goles sin penalti entre córner y
            falta, estimándolos a partir de los remates.{" "}
            <strong className="text-white/75">
              Se retiró el 16/09/2026 después de medirlo
            </strong>
            : ese reparto decía que el{" "}
            <strong className="text-white/75">33,3 %</strong> de los goles de la
            categoría eran de balón parado y el agregado de Opta, que sí los cuenta,
            dice el <strong className="text-white/75">22,7 %</strong> — diez puntos
            largos de más. Equipo a equipo era peor: con dos o tres jornadas, siete
            de los veinte salían con cero goles de córner y cero de falta, y el resto
            con un cero o un uno que era puro redondeo.
          </p>

          <p className="mt-2">
            Así que se queda lo medido y se va lo inventado. Para saber de qué nace
            cada gol nuestro está el{" "}
            <strong className="text-white/75">registro propio</strong>, donde el
            analista escribe la acción una a una, y para el rival, el vídeo.
            {onVerRegistro && " Ahí sí hay dato real, acción por acción."}
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
                    </tr>
                  </thead>

                  <tbody>
                    {ordenadas.map((fila, indice) => {
                      const esNuestro = fila.equipo === nosotros;

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

                          {COLUMNAS.map((c, i) => (
                            <td
                              key={claveDe(c)}
                              className={`py-1.5 text-right tabular-nums ${
                                i === CAMPOS.length ? "border-l pl-3" : "pl-2"
                              } ${
                                c.campo === "goles"
                                  ? "font-semibold text-white"
                                  : "text-white/65"
                              }`}
                              style={i === CAMPOS.length ? { borderColor: tinta(0.08) } : undefined}
                            >
                              {muestra(valorDe(fila[c.lado], c.campo, modo), modo)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Lectura>{lecturaDeLaLiga(filas, nosotros, temporada)}</Lectura>

              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                Las dos columnas son dato: el marcador y los penaltis que cuenta
                Wyscout. De qué jugada nace cada gol no se enseña porque no se sabe
                —ver el aviso de arriba—.
                {muestraLiga.fuera > 0 &&
                  ` Fuera de la tabla, ${muestraLiga.fuera} equipos con menos de ${muestraLiga.suelo} partidos en los informes: son rivales de rivales, con un partido o dos.`}
              </p>
            </Panel>
          </div>

          {opta && (
            <div className="mt-5">
              <Panel
                title="Lo único que sí cuenta los goles de balón parado"
                subtitle="El agregado de la categoría que baja Opta: no se puede abrir por equipo ni por temporada, pero es la referencia de cuánto pesa realmente la estrategia"
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
                    oro
                  />

                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Por equipo
                    </p>

                    <p className="mt-2 text-[12px] leading-relaxed text-white/55">
                      No hay. Opta sólo publica el agregado de la categoría, y ni
                      Wyscout ni BeSoccer dicen de qué jugada nace cada gol. Repartirlo
                      a ojo es lo que se hacía aquí hasta el 16/09/2026 y se ha
                      retirado: con dos o tres jornadas por equipo, el reparto era
                      redondeo.
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                  Los porcentajes son sobre todos los goles; «balón parado» aquí es sin
                  penaltis, que van aparte. El agregado no dice de qué temporada ni de
                  cuántos equipos es, así que sirve de referencia de la categoría, no
                  para comparar equipos.
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
                    colSpan={2}
                    style={{ color: MEJOR, borderColor: tinta(0.1) }}
                  >
                    A favor
                  </th>
                  <th
                    className="border-b pb-1 text-center font-medium"
                    colSpan={2}
                    style={{ color: PEOR, borderColor: tinta(0.1) }}
                  >
                    En contra
                  </th>
                </tr>

                <tr className="text-right text-[10px] uppercase tracking-[0.12em] text-white/40">
                  <th className="pb-2 pt-1.5 text-left font-medium">Temporada</th>
                  <th className="pb-2 pr-3 pt-1.5 font-medium">PJ</th>
                  {[0, 1].map((lado) =>
                    ["Goles", "De penalti"].map((r, i) => (
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
                        { valor: String(g.goles), fuerte: true },
                        { valor: String(g.penalti) },
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
            {actual} va con los partidos que lleva y las demás con todos, así que los
            totales de una y otra no se comparan. De qué jugada nace cada gol sólo se
            sabe de lo que registra el cuerpo técnico, no de estos informes.
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

  const favor = puesto(filas, nosotros, (f) => valorDe(f.aFavor, "goles", "partido"), true);
  const contra = puesto(filas, nosotros, (f) => valorDe(f.enContra, "goles", "partido"), false);

  const a = mia.aFavor;
  const c = mia.enContra;

  const partes = [
    `El Castilla lleva ${a.goles} ${goles(a.goles)} en ${a.partidos} partidos`,
    favor
      ? `, ${favor.puesto}º de ${favor.de} por partido con la mediana de la categoría en ${formatea(favor.mediana, "decimal")}`
      : "",
    `, y encaja ${c.goles}`,
    contra ? `, ${contra.puesto}º contando de menos a más` : "",
    ". De penalti marca ",
    `${a.penalti} y encaja ${c.penalti}: eso es lo único de balón parado que estos informes cuentan de verdad.`,
  ];

  return partes.join("");
}

function lecturaDeLaHistoria(
  historia: ({ temporada: string } & FilaGolesAbp)[],
) {
  if (historia.length === 0) return "No hay informes del Castilla.";

  const [actual, ...cerradas] = historia;

  const penaltisDe = (lista: GolesAbp[]) =>
    lista.reduce((t, g) => t + g.penalti, 0);

  if (cerradas.length === 0) {
    return `En ${actual.temporada}, ${actual.aFavor.goles} ${goles(actual.aFavor.goles)} a favor y ${actual.enContra.goles} en contra, con ${actual.aFavor.penalti} de penalti a favor.`;
  }

  return `En las ${cerradas.length} temporadas cerradas, el Castilla marcó ${penaltisDe(cerradas.map((t) => t.aFavor))} goles de penalti y encajó ${penaltisDe(cerradas.map((t) => t.enContra))}. En ${actual.temporada} va por ${actual.aFavor.penalti} y ${actual.enContra.penalti}, con ${actual.aFavor.partidos} partidos jugados.`;
}
