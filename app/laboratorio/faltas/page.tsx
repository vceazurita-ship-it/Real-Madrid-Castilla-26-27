"use client";

/**
 * Competición · Análisis de faltas.
 *
 * Qué mide, y por qué sólo eso: **dónde se comete cada falta** y **cuánta
 * gente defendía en ese momento entre la falta y la portería que se ataca**.
 * Con esas dos cosas se contesta a lo que se pregunta el lunes —dónde nos
 * pitan, dónde pitamos nosotros y con qué defensa enfrente— sin pedirle al que
 * mira el vídeo veinte campos por jugada, que es como se abandonan estos
 * recuentos.
 *
 * El número que manda es **cuántos defensores hay entre la falta y su propia
 * portería, portero incluido**. Una falta en el mismo sitio no vale lo mismo
 * con nueve por delante que con tres: lo primero es un balón parado contra un
 * bloque hecho y lo segundo es una transición que se ha cortado con falta. De
 * ahí el apartado de «faltas que cortaron algo», que es el que de verdad se
 * lleva a la charla.
 *
 * De dónde salen los datos: NO hay proveedor. Se etiquetan viendo el partido
 * falta a falta, con el mismo método que los robos y los saques de banda.
 * `scripts/abp-clips-preparar.mjs` prepara la carpeta y
 * `scripts/faltas-datos.mjs` convierte los CSV en `lib/faltas/datos.ts`.
 *
 * El campo y la tabla van atados: se pasa por encima de un punto y se enciende
 * su fila, y al revés. Con veintitantas faltas es la diferencia entre mirar el
 * dibujo y entenderlo.
 *
 * Está en obras porque el recuento es de un partido: con una jornada no hay
 * tendencia que leer, y la pantalla lo dice en vez de dibujar porcentajes que
 * suenan a verdad.
 */

import { useMemo, useState } from "react";
import { Crosshair, Shield, Swords, Zap } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Panel } from "@/components/abp/ui";
import { PARTIDOS, type LadoFalta } from "@/lib/faltas/datos";
import { CampoFaltas } from "@/components/faltas/CampoFaltas";
import { ComoActualizar } from "@/components/faltas/ComoActualizar";
import {
  Conclusiones,
  Explicativo,
  useTextosExplicativos,
} from "@/components/ui/textos-analisis";

const ZONAS = ["campo propio", "medio campo", "campo rival"];
const CARRILES = ["izquierda", "centro", "derecha"];
const DISTANCIAS = ["frontal", "media", "lejana"];

const TINTA_LADO: Record<LadoFalta, string> = {
  ofensivo: "#C8A96B",
  defensivo: "#F6AFB6",
};

const NOMBRE_LADO: Record<LadoFalta, string> = {
  ofensivo: "A favor",
  defensivo: "En contra",
};

/**
 * Por debajo de esto, la falta cortó una transición.
 *
 * Tres defensores contando al portero es un campo abierto: si ahí hubo falta,
 * no se estaba defendiendo un balón parado, se estaba frenando una carrera. El
 * corte está puesto a mano y se dice en pantalla, que es lo honesto con un
 * umbral que nadie ha calibrado con nada.
 */
const CORTE_TRANSICION = 3;

type Filtro = "todas" | LadoFalta;

/** 6.25 → "6,3". */
const decimal = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** La clave que más se repite, con cuántas veces. */
function laQueMas(valores: string[]) {
  const cuenta = new Map<string, number>();

  for (const v of valores) if (v) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);

  let mejor: { clave: string; veces: number } | null = null;

  for (const [clave, veces] of cuenta) {
    if (!mejor || veces > mejor.veces) mejor = { clave, veces };
  }

  return mejor;
}

/** "2026-09-21" → "21 sep". */
function fechaCorta(iso: string) {
  const fecha = new Date(`${iso}T12:00:00`);

  if (Number.isNaN(fecha.getTime())) return iso;

  return fecha
    .toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    .replace(".", "");
}

export default function FaltasPage() {
  const explicativos = useTextosExplicativos();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [partidoId, setPartidoId] = useState<string>(PARTIDOS[0]?.id ?? "");

  /** La falta que está encendida, compartida entre el campo y la tabla. */
  const [resaltada, setResaltada] = useState<string | null>(null);

  const partido = useMemo(
    () => PARTIDOS.find((p) => p.id === partidoId) ?? PARTIDOS[0] ?? null,
    [partidoId],
  );

  const faltas = useMemo(() => {
    const todas = partido?.faltas ?? [];

    return filtro === "todas" ? todas : todas.filter((f) => f.lado === filtro);
  }, [partido, filtro]);

  const sinSitio = faltas.filter((f) => !f.zona || !f.carril).length;

  /** Cuántas hay de cada lado, para los mandos y el encabezado. */
  const porLado = useMemo(() => {
    const todas = partido?.faltas ?? [];

    return {
      ofensivo: todas.filter((f) => f.lado === "ofensivo").length,
      defensivo: todas.filter((f) => f.lado === "defensivo").length,
    };
  }, [partido]);

  const porDistancia = useMemo(
    () =>
      DISTANCIAS.map((d) => ({
        clave: d,
        cuantas: faltas.filter((f) => f.distancia === d).length,
      })),
    [faltas],
  );

  /** La media de defensores entre la falta y la portería que se ataca. */
  const defensores = useMemo(() => {
    const con = faltas.filter((f) => f.entre !== null).map((f) => f.entre as number);

    if (con.length === 0) return null;

    const suma = con.reduce((a, b) => a + b, 0);

    return {
      media: suma / con.length,
      minimo: Math.min(...con),
      maximo: Math.max(...con),
      contadas: con.length,
      sinContar: faltas.length - con.length,
    };
  }, [faltas]);

  /*
  | Las que se pitaron con el campo abierto: ésas cortaron algo.
  |
  | Sólo lejos del área que se ataca. Una falta lateral junto al área, o un
  | penalti, deja casi siempre a uno o dos defensores «por detrás» del balón
  | —se cuentan en profundidad, contra la línea de fondo— y no es una
  | transición cortada: es un balón parado. Metidas aquí, la lista se llenaba
  | de centros laterales.
  */
  const cortes = useMemo(
    () =>
      faltas
        .filter((f) => f.zona !== "campo rival")
        .filter((f) => f.entre !== null && (f.entre as number) <= CORTE_TRANSICION)
        .sort((a, b) => (a.entre as number) - (b.entre as number)),
    [faltas],
  );

  /*
  | Lo que dice lo que se está viendo (partido y filtro), en pocas frases.
  | La zona va hacia la portería que ataca quien saca: «campo rival» es
  | siempre el último tercio del que la saca.
  */
  const conclusiones = useMemo(() => {
    const total = faltas.length;

    if (total === 0) return [];

    const frases: string[] = [];

    frases.push(
      filtro === "todas"
        ? `${porLado.ofensivo} a favor y ${porLado.defensivo} en contra.`
        : `${total} ${total === 1 ? "falta" : "faltas"} ${filtro === "ofensivo" ? "a favor" : "en contra"}.`,
    );

    const zona = laQueMas(faltas.map((f) => f.zona));
    const carril = laQueMas(faltas.map((f) => f.carril));

    /* La zona, dicha desde el lado del Castilla cuando se puede. */
    const nombreZona = (z: string) => {
      if (z === "medio campo") return z;
      const propio = z === "campo propio";
      if (filtro === "ofensivo") return propio ? "nuestro campo" : "campo rival";
      if (filtro === "defensivo") return propio ? "campo rival" : "nuestro campo";
      return propio ? "campo de quien saca" : "último tercio";
    };

    if (zona && carril) {
      frases.push(
        `Se concentran en ${nombreZona(zona.clave)} (${zona.veces}) y ${carril.clave === "centro" ? "por el centro" : `por la ${carril.clave}`} (${carril.veces}).`,
      );
    }

    const ultimoTercio = faltas.filter((f) => f.zona === "campo rival").length;
    const frontales = faltas.filter((f) => f.distancia === "frontal").length;

    if (ultimoTercio || frontales) {
      const donde =
        filtro === "ofensivo"
          ? "en campo rival"
          : filtro === "defensivo"
            ? "cerca de nuestra área"
            : "en último tercio";

      frases.push(
        `${ultimoTercio} ${donde}; ${frontales} ${frontales === 1 ? "frontal" : "frontales"}.`,
      );
    }

    if (defensores) {
      frases.push(
        `${decimal(defensores.media)} defensores por delante de media (de ${defensores.minimo} a ${defensores.maximo}).`,
      );
    }

    frases.push(
      cortes.length
        ? `${cortes.length} ${cortes.length === 1 ? "cortó" : "cortaron"} una transición con el campo abierto.`
        : "Ninguna cortó una transición: siempre con bloque hecho.",
    );

    return frases;
  }, [faltas, filtro, porLado, defensores, cortes]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Competición"
              title="Análisis de faltas"
              lead={
                explicativos
                  ? "Dónde se comete cada falta y cuánta gente defendía entre ella y la portería. Sale de ver el partido falta a falta."
                  : undefined
              }
            />

            {PARTIDOS.length === 0 || (partido?.faltas.length ?? 0) === 0 ? (
              <div className="mt-5">
                <Panel title="Todavía no hay ninguna falta etiquetada" icon={Crosshair}>
                  <Explicativo>
                    <p className="text-sm text-white/50">
                      Prepara una carpeta de clips y etiquétala: abajo están las
                      órdenes, con la carpeta que quieras.
                    </p>
                  </Explicativo>
                </Panel>
              </div>
            ) : null}

            {/* ---------------- el partido ---------------- */}

            {partido && (
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  {partido.jornada}
                </span>

                <span className="text-sm font-semibold text-white">
                  {partido.local
                    ? `RM Castilla · ${partido.rival}`
                    : `${partido.rival} · RM Castilla`}
                </span>

                <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[12px] tabular-nums text-white/80">
                  {partido.resultado}
                </span>

                <span className="text-[11px] uppercase tracking-[0.12em] text-white/35">
                  {partido.local ? "en casa" : "fuera"} · {fechaCorta(partido.fecha)}
                </span>

                <span className="ml-auto flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className="rounded-full px-2.5 py-1"
                    style={{
                      color: TINTA_LADO.ofensivo,
                      background: `${TINTA_LADO.ofensivo}1A`,
                    }}
                  >
                    {porLado.ofensivo} a favor
                  </span>

                  <span
                    className="rounded-full px-2.5 py-1"
                    style={{
                      color: TINTA_LADO.defensivo,
                      background: `${TINTA_LADO.defensivo}1A`,
                    }}
                  >
                    {porLado.defensivo} en contra
                  </span>
                </span>
              </div>
            )}

            {/* ---------------- mandos ---------------- */}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {PARTIDOS.length > 1 && (
                <select
                  value={partidoId}
                  onChange={(e) => {
                    setPartidoId(e.target.value);
                    setResaltada(null);
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                >
                  {PARTIDOS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#11161C]">
                      {p.jornada} · {p.rival}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                {(
                  [
                    { key: "todas" as const, label: "Todas" },
                    { key: "ofensivo" as const, label: "A favor" },
                    { key: "defensivo" as const, label: "En contra" },
                  ] satisfies { key: Filtro; label: string }[]
                ).map((uno) => (
                  <button
                    key={uno.key}
                    type="button"
                    onClick={() => {
                      setFiltro(uno.key);
                      setResaltada(null);
                    }}
                    aria-pressed={filtro === uno.key}
                    className={`rounded-lg px-3 py-2 text-xs transition ${
                      filtro === uno.key
                        ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {uno.label}
                  </button>
                ))}
              </div>

              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/50">
                {faltas.length} {faltas.length === 1 ? "falta" : "faltas"}
              </span>
            </div>

            {partido?.notas.length ? (
              <Explicativo>
                <ul className="mt-3 space-y-1 text-[12px] text-white/40">
                  {partido.notas.map((nota) => (
                    <li key={nota}>· {nota}</li>
                  ))}
                </ul>
              </Explicativo>
            ) : null}

            <Conclusiones items={conclusiones} className="mt-4" />

            {/* ---------------- el campo ---------------- */}

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
              <Panel
                title="Dónde se cometen"
                subtitle={
                  explicativos
                    ? "Cada punto es una falta, en su tercio y su carril. El campo va en el sentido en que ataca quien la saca"
                    : undefined
                }
                icon={Crosshair}
              >
                <CampoFaltas
                  faltas={faltas}
                  zonas={ZONAS}
                  carriles={CARRILES}
                  tinta={TINTA_LADO}
                  resaltada={resaltada}
                  onResaltar={setResaltada}
                />

                {sinSitio > 0 && (
                  <p className="mt-3 text-[11px] text-white/35">
                    {sinSitio}{" "}
                    {sinSitio === 1
                      ? "falta no se pudo situar"
                      : "faltas no se pudieron situar"}{" "}
                    en el campo y no salen dibujadas.
                  </p>
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Cuánta gente defendía" icon={Shield}>
                  {defensores ? (
                    <>
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-semibold text-[#C8A96B]">
                          {decimal(defensores.media)}
                        </span>

                        <span className="pb-1 text-sm text-white/45">
                          de media entre la falta y la portería, portero incluido
                        </span>
                      </div>

                      <p className="mt-2 text-[12px] text-white/40">
                        Entre {defensores.minimo} y {defensores.maximo}, contados en{" "}
                        {defensores.contadas} de {faltas.length}
                        {defensores.sinContar > 0
                          ? `. En ${defensores.sinContar} no se veía el campo entero.`
                          : "."}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-white/45">
                      Todavía no se ha podido contar en ninguna.
                    </p>
                  )}
                </Panel>

                <Panel
                  title="Faltas que cortaron algo"
                  subtitle={
                    explicativos
                      ? `Con ${CORTE_TRANSICION} defensores o menos por delante, fuera del último tercio: campo abierto`
                      : undefined
                  }
                  icon={Zap}
                >
                  {cortes.length === 0 ? (
                    <p className="text-sm text-white/45">
                      Ninguna con el campo abierto: todas se pitaron con el bloque
                      hecho.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {cortes.map((f) => (
                        <li
                          key={f.clip}
                          onMouseEnter={() => setResaltada(f.clip)}
                          onMouseLeave={() => setResaltada(null)}
                          className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 transition ${
                            resaltada === f.clip
                              ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.07]"
                              : "border-white/[0.06]"
                          }`}
                        >
                          <span
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#0B0F14]"
                            style={{ background: TINTA_LADO[f.lado] }}
                          >
                            {f.entre}
                          </span>

                          <span className="min-w-0 text-[12px] leading-relaxed text-white/55">
                            <span className="text-white/80">
                              {NOMBRE_LADO[f.lado]}
                            </span>
                            {" · "}
                            {f.zona}
                            {f.carril ? ` · ${f.carril}` : ""}
                            {f.distancia ? ` · ${f.distancia}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="A qué distancia" icon={Swords}>
                  <div className="space-y-2">
                    {porDistancia.map((d) => (
                      <div key={d.clave} className="flex items-center gap-3">
                        <span className="w-16 text-[11px] uppercase tracking-[0.12em] text-white/40">
                          {d.clave}
                        </span>

                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-[#C8A96B]"
                            style={{
                              width: `${faltas.length ? (d.cuantas / faltas.length) * 100 : 0}%`,
                            }}
                          />
                        </div>

                        <span className="w-6 text-right text-sm text-white">
                          {d.cuantas}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>

            {/* ---------------- una por una ---------------- */}

            {faltas.length > 0 && (
              <div className="mt-4">
                <Panel
                  title="Una por una"
                  subtitle={
                    explicativos
                      ? "En el orden en que se dieron. Pasa por encima de una fila y se enciende su punto en el campo"
                      : undefined
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">#</th>
                          <th className="pb-2 pr-3 font-medium">Lado</th>
                          <th className="pb-2 pr-3 font-medium">Dónde</th>
                          <th className="pb-2 pr-3 font-medium">Distancia</th>
                          <th className="pb-2 pr-3 font-medium">Defendían</th>
                          <th className="pb-2 font-medium">Qué pasó</th>
                        </tr>
                      </thead>

                      <tbody className="align-top">
                        {faltas.map((f, indice) => (
                          <tr
                            key={f.clip}
                            onMouseEnter={() => setResaltada(f.clip)}
                            onMouseLeave={() => setResaltada(null)}
                            className={`border-t border-white/[0.06] transition ${
                              resaltada === f.clip ? "bg-[#C8A96B]/[0.07]" : ""
                            }`}
                          >
                            <td className="py-2 pr-3 font-mono text-[12px] tabular-nums text-white/35">
                              {String(indice + 1).padStart(2, "0")}
                            </td>

                            <td className="py-2 pr-3">
                              <span
                                className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                                style={{
                                  color: TINTA_LADO[f.lado],
                                  background: `${TINTA_LADO[f.lado]}1A`,
                                }}
                              >
                                {NOMBRE_LADO[f.lado]}
                              </span>
                            </td>

                            <td className="py-2 pr-3 text-white/70">
                              {f.zona || "—"}
                              {f.carril ? ` · ${f.carril}` : ""}
                            </td>

                            <td className="py-2 pr-3 text-white/60">
                              {f.distancia || "—"}
                            </td>

                            <td className="py-2 pr-3 font-semibold text-white">
                              {f.entre ?? "?"}
                            </td>

                            <td className="py-2 text-white/45">{f.nota}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            )}

            {/* ---------------- cómo se actualiza ---------------- */}

            <Explicativo>
              <div className="mt-4">
                <ComoActualizar carpetaPorDefecto={partido?.clips ?? ""} />
              </div>
            </Explicativo>
          </div>
        </section>
      </div>
    </main>
  );
}
