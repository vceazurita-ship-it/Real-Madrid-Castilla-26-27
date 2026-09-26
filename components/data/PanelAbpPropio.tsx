"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Flag, Loader2, Target, Timer, Users } from "lucide-react";

import { Notice, Panel } from "@/components/abp/ui";
import { Composicion, Lectura } from "@/components/data/formas";
import { Evolucion, MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import {
  BLOQUES,
  leeAbpPropio,
  peligroPor,
  porJornadaAbp,
  porJugadorAbp,
  repartoPor,
  resumeAbp,
  type AccionAbp,
  type BloqueAbp,
} from "@/lib/data-analisis/abp-propio";

/**
 * NUESTRO BALÓN PARADO, REGISTRADO A MANO.
 *
 * Es la única parte de Data Análisis que **no viene de fuera**. Wyscout dice
 * cuántos córners se sacan y Opta cuántos goles salen de estrategia en la
 * categoría, pero ninguno de los dos sabe qué rutina se ensayó, quién la sacó,
 * cuántos fueron al área ni quién ganó el rechace. Eso lo escribe el cuerpo
 * técnico acción por acción en las cuatro hojas de ABP, y es lo que se explota
 * aquí.
 *
 * Y por eso la sección empieza avisando de dos cosas que cambian cómo se lee
 * todo lo de abajo: **sólo hay partidos nuestros** —no hay liga con la que
 * compararse— y **la mayoría son de pretemporada**, contra equipos de otra
 * categoría. El conmutador de arriba separa los dos mundos y por defecto
 * enseña la liga, que es lo que cuenta.
 */
export function PanelAbpPropio() {
  const [acciones, setAcciones] = useState<AccionAbp[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bloque, setBloque] = useState<BloqueAbp>("piezasOf");

  /* Liga por defecto: la pretemporada es contra equipos de otra categoría. */
  const [ambito, setAmbito] = useState<"liga" | "amistoso" | "todo">("liga");

  /*
  | UNA JORNADA SUELTA.
  |
  | El balón parado se corrige jornada a jornada —«en el último partido nos
  | remataron dos córners al primer palo»— y aquí sólo se podía mirar la
  | temporada entera o la pretemporada entera. Cada acción ya sabe de qué
  | jornada es (`a.jornada`), así que es filtrar.
  |
  | Guarda el texto crudo de la celda, que es lo único que no se repite: la
  | etiqueta bonita de dos competiciones distintas podría coincidir.
  */
  const [jornada, setJornada] = useState("");

  useEffect(() => {
    let vivo = true;

    void (async () => {
      const datos = await leeAbpPropio();

      if (!vivo) return;

      setAcciones(datos.acciones);
      setError(datos.error);
    })();

    return () => {
      vivo = false;
    };
  }, []);

  const meta = BLOQUES.find((b) => b.key === bloque)!;

  /*
  | La jornada elegida, sólo si sigue existiendo con este ámbito y este bloque.
  |
  | Al cambiar de ámbito el desplegable ya vuelve a «todas» por su cuenta, pero
  | el filtro seguía usando la jornada vieja: el panel salía vacío diciendo que
  | las enseñaba todas. Y si el ámbito nuevo tiene una sola jornada, el
  | desplegable ni se pinta y no había forma de quitarlo.
  */
  const jornadaViva = useMemo(() => {
    if (!jornada) return "";

    const existe = (acciones ?? []).some(
      (a) =>
        a.bloque === bloque &&
        (ambito === "todo" || a.jornada.competicion === ambito) &&
        a.jornada.bruto === jornada,
    );

    return existe ? jornada : "";
  }, [acciones, ambito, bloque, jornada]);

  const suyas = useMemo(() => {
    if (!acciones) return [];

    return acciones.filter(
      (a) =>
        a.bloque === bloque &&
        (ambito === "todo" || a.jornada.competicion === ambito) &&
        /*
        | Si la jornada elegida ya no existe con este ámbito o este bloque, no
        | filtra: el desplegable ya vuelve a «todas» por su cuenta, pero esto
        | seguía filtrando por una jornada que no está y el panel salía vacío
        | diciendo que las enseñaba todas. Y con un solo valor el desplegable
        | ni se pinta, así que no había forma de quitarlo.
        */
        (!jornadaViva || a.jornada.bruto === jornadaViva),
    );
  }, [acciones, ambito, bloque, jornadaViva]);

  const resumen = useMemo(() => resumeAbp(suyas), [suyas]);

  /*
  | Las jornadas que hay con el ámbito puesto, de la más reciente a la más
  | antigua. Se miran TODAS las acciones del bloque, no las ya filtradas por
  | jornada, que si no la lista se quedaría con una sola opción en cuanto se
  | eligiera una y no habría forma de volver a otra.
  */
  const jornadas = useMemo(() => {
    const vistas = new Map<string, { bruto: string; etiqueta: string; orden: number }>();

    for (const a of acciones ?? []) {
      if (a.bloque !== bloque) continue;
      if (ambito !== "todo" && a.jornada.competicion !== ambito) continue;

      if (!vistas.has(a.jornada.bruto)) {
        vistas.set(a.jornada.bruto, {
          bruto: a.jornada.bruto,
          etiqueta: a.jornada.etiqueta,
          orden: a.jornada.numero ?? 0,
        });
      }
    }

    return [...vistas.values()].sort((x, y) => y.orden - x.orden);
  }, [acciones, ambito, bloque]);

  const hayLiga = useMemo(
    () => (acciones ?? []).some((a) => a.jornada.competicion === "liga"),
    [acciones],
  );

  if (!acciones) {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 py-16 text-sm text-white/40">
        <Loader2 size={16} className="animate-spin" />
        Abriendo las hojas de balón parado…
      </div>
    );
  }

  const esBanda = bloque.startsWith("banda");

  /* Las dimensiones que tiene cada tipo de hoja: no son las mismas. */
  const dimensiones = esBanda
    ? [
        { rotulo: "Zona de saque", campo: (a: AccionAbp) => a.zonaSaque },
        { rotulo: "Tipo de envío", campo: (a: AccionAbp) => a.envio },
        { rotulo: "Dónde cae", campo: (a: AccionAbp) => a.zonaCaida },
        { rotulo: "Receptor", campo: (a: AccionAbp) => a.receptor },
      ]
    : [
        { rotulo: "Tipo de acción", campo: (a: AccionAbp) => a.tipo },
        { rotulo: "Tipo de envío", campo: (a: AccionAbp) => a.envio },
        { rotulo: "Dónde cae", campo: (a: AccionAbp) => a.zonaCaida },
        { rotulo: "Zona de remate", campo: (a: AccionAbp) => a.zonaRemate },
      ];

  const segundoBalon = repartoPor(suyas, (a) => a.segundoBalon);

  const serie = porJornadaAbp(suyas, "peligro");

  const rematadores = porJugadorAbp(suyas, (a) => a.rematador).slice(0, 8);
  const sacadores = porJugadorAbp(suyas, (a) => a.sacador).slice(0, 8);

  return (
    <>
      {/*
        EL AVISO QUE NO SE PUEDE QUITAR

        Un porcentaje de esta sección al lado de uno de Opta se leería como si
        los dos midieran lo mismo, y no es así: éste sale de una libreta.
      */}
      <div className="mt-5">
        <Notice title="Análisis interno del cuerpo técnico">
          <p>
            Estos números <strong className="text-white/75">no salen de
            Wyscout ni de Opta</strong>: son las acciones de balón parado
            analizadas manualmente por nosotros, partido a partido.
          </p>

          <ul className="mt-2 space-y-1.5">
            <li>
              <strong className="text-white/70">Sólo hay partidos nuestros.</strong>
            </li>

            <li>
              <strong className="text-white/70">Liga y pretemporada no se mezclan.</strong>{" "}
              La mayoría de lo registrado son amistosos de julio contra equipos
              de otra categoría. El conmutador de abajo los separa.
            </li>
          </ul>
        </Notice>
      </div>

      {error && (
        <div className="mt-3">
          <Notice tone="warn" title="Falta alguna hoja">
            {error}
          </Notice>
        </div>
      )}

      {/* Qué se mira: bloque y ámbito. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
          {BLOQUES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBloque(b.key)}
              aria-pressed={bloque === b.key}
              title={b.pregunta}
              className={`rounded-lg px-3 py-2 text-xs transition ${
                bloque === b.key
                  ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {b.corto}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
          {[
            { key: "liga" as const, label: "Liga" },
            { key: "amistoso" as const, label: "Pretemporada" },
            { key: "todo" as const, label: "Todo" },
          ].map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAmbito(a.key)}
              aria-pressed={ambito === a.key}
              disabled={a.key === "liga" && !hayLiga}
              className={`rounded-lg px-3 py-2 text-xs transition ${
                ambito === a.key
                  ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {jornadas.length > 1 && (
          <select
            value={jornadas.some((j) => j.bruto === jornada) ? jornada : ""}
            onChange={(e) => setJornada(e.target.value)}
            title="Mira una sola jornada"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none transition focus:border-[#C8A96B]/50"
          >
            <option value="" className="bg-[#11161C]">
              Todas las jornadas ({jornadas.length})
            </option>

            {jornadas.map((j) => (
              <option key={j.bruto} value={j.bruto} className="bg-[#11161C]">
                {j.etiqueta}
              </option>
            ))}
          </select>
        )}

        <span className="text-[11px] text-white/35">{meta.pregunta}</span>
      </div>

      {suyas.length === 0 ? (
        <div className="mt-5">
          <Notice tone="warn" title="Nada registrado con estos filtros">
            No hay acciones de {meta.label.toLowerCase()} en{" "}
            {ambito === "liga"
              ? "partidos de liga"
              : ambito === "amistoso"
                ? "pretemporada"
                : "ningún partido"}
            . Se registran desde las pantallas de balón parado.
          </Notice>
        </div>
      ) : (
        <>
          {/* Lo primero: cuánto hay y cuánto rinde. */}
          <div className="mt-5">
            <Panel
              title={meta.label}
              subtitle={`${resumen.acciones} acciones registradas en ${resumen.partidos} ${resumen.partidos === 1 ? "partido" : "partidos"}`}
              icon={Flag}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    rotulo: "Por partido",
                    dato: resumen.porPartido.toFixed(1),
                    pie: "acciones registradas",
                    color: undefined as string | undefined,
                  },
                  /*
                    Las hojas de banda no tienen columna de remate —un saque de
                    banda no se remata—, así que en su lugar va lo que sí mide:
                    si el balón se queda con quien saca.
                  */
                  esBanda
                    ? {
                        rotulo: meta.nuestro
                          ? "Conservamos el balón"
                          : "Lo conservan ellos",
                        dato: `${resumen.cuotaRetencion.toFixed(0)} %`,
                        pie: `${resumen.retenidos} de ${resumen.acciones} saques`,
                        color:
                          resumen.cuotaRetencion >= 50 === meta.nuestro
                            ? MEJOR
                            : PEOR,
                      }
                    : {
                        rotulo: "Acaban en remate",
                        dato: `${resumen.cuotaRemate.toFixed(0)} %`,
                        pie: `${resumen.remates} de ${resumen.acciones}`,
                        color: undefined,
                      },
                  {
                    rotulo: meta.nuestro ? "Peligro generado" : "Peligro concedido",
                    dato: `${resumen.cuotaPeligro.toFixed(0)} %`,
                    pie: `${resumen.peligros} ${resumen.peligros === 1 ? "acabó" : "acabaron"} en gol u ocasión`,
                    color: meta.nuestro ? MEJOR : PEOR,
                  },
                  {
                    rotulo: meta.nuestro ? "Goles a favor" : "Goles en contra",
                    dato: String(resumen.goles),
                    pie:
                      resumen.accionesPorGol === null
                        ? "ninguno todavía"
                        : `una cada ${resumen.accionesPorGol.toFixed(0)} acciones`,
                    color: resumen.goles === 0 ? undefined : meta.nuestro ? MEJOR : PEOR,
                  },
                ].map((c) => (
                  <div
                    key={c.rotulo}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                  >
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                      {c.rotulo}
                    </p>

                    <p
                      className="mt-1 text-2xl font-semibold tabular-nums"
                      style={{ color: c.color ?? "inherit" }}
                    >
                      {c.dato}
                    </p>

                    <p className="mt-0.5 text-[11px] text-white/35">{c.pie}</p>
                  </div>
                ))}
              </div>

              {!esBanda && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                      xG acumulado
                    </p>

                    <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                      {resumen.xg.toFixed(2)}
                    </p>

                    <p className="mt-0.5 text-[11px] text-white/35">
                      {resumen.xgPorAccion.toFixed(3)} por acción
                    </p>
                  </div>

                  {/*
                    Ojo al sentido: marcar por encima del xG es bueno y encajar
                    por encima del xG es malo. El mismo número, el color al
                    revés.
                  */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Goles contra xG
                    </p>

                    <p
                      className="mt-1 text-xl font-semibold tabular-nums"
                      style={{
                        color:
                          (resumen.goles - resumen.xg >= 0) === meta.nuestro
                            ? MEJOR
                            : PEOR,
                      }}
                    >
                      {resumen.goles - resumen.xg >= 0 ? "+" : ""}
                      {(resumen.goles - resumen.xg).toFixed(2)}
                    </p>

                    <p className="mt-0.5 text-[11px] text-white/35">
                      {meta.nuestro
                        ? resumen.goles - resumen.xg >= 0
                          ? "se marca por encima de lo que valían"
                          : "se marca por debajo de lo que valían"
                        : resumen.goles - resumen.xg >= 0
                          ? "se encaja por encima de lo que valían"
                          : "se encaja por debajo de lo que valían"}
                    </p>
                  </div>
                </div>
              )}

              <Lectura>{lecturaDelBloque(resumen, meta.nuestro, esBanda)}</Lectura>
            </Panel>
          </div>

          {/* Qué variante hace daño de verdad. */}
          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
            {dimensiones.map((dim) => {
              const filas = peligroPor(suyas, dim.campo, 2);

              if (filas.length === 0) return null;

              const tope = Math.max(...filas.map((f) => f.cuota), 1);

              return (
                <Panel
                  key={dim.rotulo}
                  title={dim.rotulo}
                  subtitle={
                    meta.nuestro
                      ? "Qué parte de cada variante acaba en gol u ocasión"
                      : "Qué parte de cada variante nos acaba costando gol u ocasión"
                  }
                  icon={Target}
                >
                  <div className="space-y-2">
                    {filas.map((fila) => (
                      <div key={fila.etiqueta} className="flex items-center gap-2">
                        <span className="w-36 shrink-0 truncate text-[11.5px] text-white/60">
                          {fila.etiqueta}
                        </span>

                        <span className="h-3 min-w-0 flex-1">
                          <span
                            className="block h-3 rounded-[3px]"
                            style={{
                              width: `${(fila.cuota / tope) * 100}%`,
                              background:
                                fila.cuota === 0
                                  ? tinta(0.18)
                                  : meta.nuestro
                                    ? ORO
                                    : PEOR,
                            }}
                          />
                        </span>

                        <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-white/55">
                          {fila.cuota.toFixed(0)} %{" "}
                          <span className="text-white/30">de {fila.total}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <Lectura>{lecturaDeDimension(filas, dim.rotulo, meta.nuestro)}</Lectura>
                </Panel>
              );
            })}
          </div>

          {/* El rechace y la evolución. */}
          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
            {segundoBalon.length > 0 && (
              <Panel
                title="El segundo balón"
                subtitle="Lo que pasa después del primer contacto, que es media jugada"
                icon={ClipboardList}
              >
                <Composicion
                  trozos={segundoBalon}
                  rotulo={meta.label}
                  lectura={lecturaDelRechace(segundoBalon, meta.nuestro)}
                />

                <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                  «Ganado» y «perdido» están escritos desde nuestro lado en las
                  cuatro hojas: ganar el rechace en una acción en contra es
                  bueno para nosotros.
                </p>
              </Panel>
            )}

            <Panel
              title="Partido a partido"
              subtitle={
                meta.nuestro
                  ? "Qué parte de las acciones acaba en gol u ocasión"
                  : "Qué parte nos acaba costando gol u ocasión"
              }
              icon={Timer}
            >
              <Evolucion
                serie={serie}
                unidad="porcentaje"
                media={
                  serie.length
                    ? serie.reduce((s, p) => s + (p.valor ?? 0), 0) / serie.length
                    : null
                }
              />

              <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                Con pocas acciones por partido, un solo córner mueve la línea
                diez puntos: mira la forma, no el salto.
              </p>
            </Panel>
          </div>

          {/* Los nombres, que es lo que ningún informe comprado tiene. */}
          {(rematadores.length > 0 || sacadores.length > 0) && (
            <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
              {sacadores.length > 0 && (
                <Panel
                  title="Quién saca"
                  subtitle="Y qué sale de lo que saca"
                  icon={Users}
                >
                  <ListaJugadores filas={sacadores} nuestro={meta.nuestro} />
                </Panel>
              )}

              {rematadores.length > 0 && (
                <Panel
                  title="Quién remata"
                  subtitle="Acciones rematadas y peligro generado"
                  icon={Users}
                >
                  <ListaJugadores filas={rematadores} nuestro={meta.nuestro} />
                </Panel>
              )}
            </div>
          )}

          {/* Las rutinas ensayadas: lo más propio de todo esto. */}
          <RutinasEnsayadas acciones={suyas} nuestro={meta.nuestro} />
        </>
      )}
    </>
  );
}

/** Una lista de jugadores con su volumen y su peligro. */
function ListaJugadores({
  filas,
  nuestro,
}: {
  filas: { jugador: string; total: number; peligro: number; xg: number }[];
  nuestro: boolean;
}) {
  const tope = Math.max(...filas.map((f) => f.total), 1);

  return (
    <div className="space-y-1.5">
      {filas.map((fila) => (
        <div key={fila.jugador} className="flex items-center gap-2">
          <span className="w-32 shrink-0 truncate text-[12px] text-white/65">
            {fila.jugador}
          </span>

          <span className="h-3 min-w-0 flex-1">
            <span
              className="block h-3 rounded-[3px]"
              style={{
                width: `${(fila.total / tope) * 100}%`,
                background: nuestro ? ORO : tinta(0.28),
              }}
            />
          </span>

          <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-white/55">
            {fila.total}{" "}
            <span className="text-white/30">
              · {fila.peligro} con peligro
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Las rutinas.
 *
 * Sólo las hojas ofensivas las guardan, y es el dato más propio de toda la
 * pantalla: no existe en ningún informe comprado. Contesta a la única pregunta
 * que importa de un ensayo —¿ésta sale?— y por eso se ordena por peligro y no
 * por volumen.
 */
function RutinasEnsayadas({
  acciones,
  nuestro,
}: {
  acciones: AccionAbp[];
  nuestro: boolean;
}) {
  const filas = peligroPor(acciones, (a) => a.rutina, 2);

  if (filas.length === 0) return null;

  return (
    <div className="mt-5">
      <Panel
        title="Las rutinas ensayadas"
        subtitle="Lo que no está en ningún informe comprado: qué jugada se buscó y qué salió de ella"
        icon={Flag}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                <th className="pb-2 pr-3 font-medium">Rutina</th>
                <th className="pb-2 pr-3 text-right font-medium">Veces</th>
                <th className="pb-2 pr-3 text-right font-medium">Con peligro</th>
                <th className="pb-2 pr-3 text-right font-medium">%</th>
                <th className="pb-2 text-right font-medium">xG</th>
              </tr>
            </thead>

            <tbody>
              {filas.map((fila) => (
                <tr key={fila.etiqueta} className="border-t border-white/[0.06]">
                  <td className="py-2 pr-3 text-white/80">{fila.etiqueta}</td>

                  <td className="py-2 pr-3 text-right tabular-nums text-white/60">
                    {fila.total}
                  </td>

                  <td className="py-2 pr-3 text-right tabular-nums text-white/60">
                    {fila.peligro}
                  </td>

                  <td
                    className="py-2 pr-3 text-right tabular-nums"
                    style={{ color: fila.cuota > 0 ? (nuestro ? MEJOR : PEOR) : tinta(0.35) }}
                  >
                    {fila.cuota.toFixed(0)} %
                  </td>

                  <td className="py-2 text-right tabular-nums text-white/60">
                    {fila.xg.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          Sólo salen las rutinas repetidas al menos dos veces: una jugada usada
          una vez y salida bien es un 100 % que no significa nada.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LAS FRASES                                                         */
/* ------------------------------------------------------------------ */

function lecturaDelBloque(
  resumen: ReturnType<typeof resumeAbp>,
  nuestro: boolean,
  esBanda: boolean,
) {
  if (resumen.acciones === 0) return "Sin acciones registradas.";

  const sujeto = nuestro ? "Se generan" : "Se conceden";

  const base = `${sujeto} ${resumen.porPartido.toFixed(1)} acciones por partido y ${resumen.cuotaPeligro.toFixed(0)} de cada 100 acaban en gol u ocasión${nuestro ? "" : " del rival"}.`;

  /*
  | El saque de banda no se remata: lo que se juzga es si el balón se queda con
  | quien saca. Y el sentido se da la vuelta según de quién sea el saque —que
  | el rival conserve poco es una buena noticia para nosotros—.
  */
  if (esBanda) {
    const cuota = resumen.cuotaRetencion;

    if (nuestro) {
      return `${base} El balón sigue siendo nuestro en ${cuota.toFixed(0)} de cada 100 saques${
        cuota < 50
          ? ": por debajo de la mitad, el saque de banda es una pérdida con otro nombre."
          : ", que es lo mínimo que se le pide a un saque propio."
      }`;
    }

    return `${base} El rival conserva el balón en ${cuota.toFixed(0)} de cada 100 saques suyos${
      cuota < 50
        ? ": se les quita más de la mitad, y ahí está la ganancia de defender bien la banda."
        : ", así que salen con el balón la mayoría de las veces."
    }`;
  }

  if (resumen.goles === 0) {
    return `${base} Todavía no ha entrado ninguna, con ${resumen.xg.toFixed(2)} de xG acumulado${
      resumen.xg >= 1
        ? nuestro
          ? ": las ocasiones están y falta rematarlas."
          : ": se está salvando más de lo que decían las ocasiones."
        : ", y con ese xG tampoco se esperaba ninguna. Lo que hay que mover es el volumen y la calidad del envío, no la definición."
    }`;
  }

  const brecha = resumen.goles - resumen.xg;

  const cola = nuestro
    ? brecha >= 0
      ? "por encima de lo que valían las ocasiones, y eso suele volver a la media."
      : "por debajo de lo que valían, así que hay margen sin cambiar nada del ensayo."
    : brecha >= 0
      ? "más de lo que valían las ocasiones concedidas: mala suerte o mala resolución, pero no un problema de estructura."
      : "menos de lo que valían las ocasiones concedidas, que es lo que hace el portero y la segunda ayuda.";

  return `${base} ${resumen.goles} ${resumen.goles === 1 ? "gol" : "goles"} con ${resumen.xg.toFixed(2)} de xG: ${cola}`;
}

function lecturaDeDimension(
  filas: { etiqueta: string; total: number; cuota: number }[],
  rotulo: string,
  nuestro: boolean,
) {
  if (filas.length === 0) return "Sin datos suficientes.";

  const mejor = filas[0];
  const peor = filas[filas.length - 1];

  const masUsada = [...filas].sort((a, b) => b.total - a.total)[0];

  const frase = nuestro
    ? `${rotulo.toLowerCase()}: lo que más daño hace es «${mejor.etiqueta}» (${mejor.cuota.toFixed(0)} % de ${mejor.total}).`
    : `${rotulo.toLowerCase()}: por donde más nos hacen daño es «${mejor.etiqueta}» (${mejor.cuota.toFixed(0)} % de ${mejor.total}).`;

  if (masUsada.etiqueta === mejor.etiqueta) {
    return `En ${frase} Y además es la más repetida, así que la elección está acertada.`;
  }

  return `En ${frase} Pero la más repetida es «${masUsada.etiqueta}» (${masUsada.total} veces, ${masUsada.cuota.toFixed(0)} %)${
    peor.cuota === 0 ? `, y «${peor.etiqueta}» no ha producido nada todavía.` : "."
  }`;
}

function lecturaDelRechace(
  trozos: { etiqueta: string; valor: number }[],
  nuestro: boolean,
) {
  const total = trozos.reduce((s, t) => s + t.valor, 0);

  if (total === 0) return "Sin rechaces registrados.";

  const ganado = trozos.find((t) => /ganado/i.test(t.etiqueta))?.valor ?? 0;
  const perdido = trozos.find((t) => /perdido/i.test(t.etiqueta))?.valor ?? 0;

  const disputados = ganado + perdido;

  if (disputados === 0) {
    return "En lo registrado no ha habido rechace disputado: el balón se resolvió en el primer contacto.";
  }

  const cuota = (ganado / disputados) * 100;

  return `De los ${disputados} rechaces que se disputaron se ganaron ${ganado} (${cuota.toFixed(0)} %). ${
    nuestro
      ? cuota >= 50
        ? "Ganar el rechace es una segunda jugada más, y ahí se está sacando ventaja."
        : "Perder más de la mitad de los rechaces convierte cada córner en una transición del rival."
      : cuota >= 50
        ? "Ganar el rechace en una acción en contra es cortar la jugada antes de la segunda ola."
        : "Perder el rechace defendiendo alarga la jugada del rival dentro del área."
  }`;
}
