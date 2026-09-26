"use client";

/**
 * En obras · Análisis de faltas.
 *
 * Qué mide, y por qué sólo eso: **dónde se comete cada falta** y **cuánta
 * gente hay protegiendo la portería en ese momento**. Con esas dos cosas se
 * contesta a lo que se pregunta el lunes —dónde nos pitan, dónde pitamos
 * nosotros y con qué defensa enfrente— sin pedirle al que mira el vídeo veinte
 * campos por jugada, que es como se abandonan estos recuentos.
 *
 * El número que manda es **cuántos defensores hay entre la falta y su propia
 * portería, portero incluido**. Una falta en el mismo sitio no vale lo mismo
 * con nueve por delante que con tres: lo primero es un balón parado contra un
 * bloque hecho y lo segundo es una transición que se ha cortado con falta.
 *
 * De dónde salen los datos: NO hay proveedor. Se etiquetan mirando los clips
 * del coding imagen a imagen, con el mismo método que los robos y los saques
 * de banda. `scripts/abp-clips-preparar.mjs` prepara la carpeta y
 * `scripts/faltas-datos.mjs` convierte los CSV en `lib/faltas/datos.ts`.
 *
 * Está en obras porque el recuento es de un partido: con una jornada no hay
 * tendencia que leer, y la pantalla lo dice en vez de dibujar porcentajes que
 * suenan a verdad.
 */

import { useMemo, useState } from "react";
import { Crosshair, HardHat, Shield, Swords } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Panel } from "@/components/abp/ui";
import { PARTIDOS, type Falta, type LadoFalta } from "@/lib/faltas/datos";
import { ComoActualizar } from "@/components/faltas/ComoActualizar";

const ZONAS = ["campo propio", "medio campo", "campo rival"];
const CARRILES = ["izquierda", "centro", "derecha"];
const DISTANCIAS = ["frontal", "media", "lejana"];

const TINTA_LADO: Record<LadoFalta, string> = {
  ofensivo: "#C8A96B",
  defensivo: "#F6AFB6",
};

type Filtro = "todas" | LadoFalta;

export default function FaltasPage() {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [partidoId, setPartidoId] = useState<string>(PARTIDOS[0]?.id ?? "");

  const partido = useMemo(
    () => PARTIDOS.find((p) => p.id === partidoId) ?? PARTIDOS[0] ?? null,
    [partidoId],
  );

  const faltas = useMemo(() => {
    const todas = partido?.faltas ?? [];

    return filtro === "todas" ? todas : todas.filter((f) => f.lado === filtro);
  }, [partido, filtro]);

  /** El tablero de 3×3: tercio del campo por carril. */
  const rejilla = useMemo(() => {
    const cuenta = new Map<string, Falta[]>();

    for (const f of faltas) {
      if (!f.zona || !f.carril) continue;

      const clave = `${f.zona}|${f.carril}`;

      cuenta.set(clave, [...(cuenta.get(clave) ?? []), f]);
    }

    return cuenta;
  }, [faltas]);

  const sinSitio = faltas.filter((f) => !f.zona || !f.carril).length;

  const porDistancia = useMemo(
    () =>
      DISTANCIAS.map((d) => ({
        clave: d,
        cuantas: faltas.filter((f) => f.distancia === d).length,
      })),
    [faltas],
  );

  /** La media de defensores entre la falta y su portería. */
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

  const tope = Math.max(1, ...[...rejilla.values()].map((v) => v.length));

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · En obras"
              title="Análisis de faltas"
              lead="Dónde se comete cada falta y cuánta gente hay entre ella y la portería. Sale de mirar los clips del coding, uno a uno."
              aside={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  <HardHat size={12} />
                  En obras
                </span>
              }
            />

            {PARTIDOS.length === 0 || (partido?.faltas.length ?? 0) === 0 ? (
              <div className="mt-5">
                <Panel title="Todavía no hay ninguna falta etiquetada" icon={Crosshair}>
                  <p className="text-sm text-white/50">
                    Prepara una carpeta de clips y etiquétala: abajo están las
                    órdenes, con la carpeta que quieras.
                  </p>
                </Panel>
              </div>
            ) : null}

            {/* ---------------- mandos ---------------- */}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {PARTIDOS.length > 1 && (
                <select
                  value={partidoId}
                  onChange={(e) => setPartidoId(e.target.value)}
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
                    onClick={() => setFiltro(uno.key)}
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
              <ul className="mt-3 space-y-1 text-[12px] text-white/40">
                {partido.notas.map((nota) => (
                  <li key={nota}>· {nota}</li>
                ))}
              </ul>
            ) : null}

            {/* ---------------- el campo ---------------- */}

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Panel
                title="Dónde se cometen"
                subtitle="El campo va de izquierda a derecha en el sentido en que ataca quien saca la falta"
                icon={Crosshair}
              >
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A1A12]">
                  <div className="grid grid-cols-3">
                    {ZONAS.map((zona) =>
                      CARRILES.map((carril) => {
                        const suyas = rejilla.get(`${zona}|${carril}`) ?? [];

                        /* El fondo dice cuántas hay sin tener que leer. */
                        const peso = suyas.length / tope;

                        return (
                          <div
                            key={`${zona}|${carril}`}
                            className="relative flex aspect-[4/3] flex-col items-center justify-center border border-white/5"
                            style={{
                              background: `rgba(200,169,107,${(peso * 0.42).toFixed(3)})`,
                            }}
                            title={`${zona} · ${carril}`}
                          >
                            <span className="text-2xl font-semibold text-white">
                              {suyas.length || ""}
                            </span>

                            {/* Y en la casilla, el tercio: el carril ya lo
                                dice la columna. */}
                            <span className="mt-1 text-center text-[9px] uppercase tracking-[0.12em] text-white/35">
                              {zona}
                            </span>
                          </div>
                        );
                      }),
                    )}
                  </div>

                  {/*
                    Las columnas son CARRILES, no zonas.
                    La rejilla se recorre `zona -> carril`, así que cada fila es
                    un tercio del campo y cada columna un carril. Este pie
                    rotulaba las columnas con las zonas: la primera columna,
                    que son las tres zonas por la izquierda, ponía «campo
                    propio». Quien lo leyera situaba mal todas las faltas.
                  */}
                  <div className="grid grid-cols-3 border-t border-white/10 text-center text-[10px] uppercase tracking-[0.14em] text-white/35">
                    {CARRILES.map((carril) => (
                      <span key={carril} className="py-2">
                        {carril}
                      </span>
                    ))}
                  </div>
                </div>

                {sinSitio > 0 && (
                  <p className="mt-3 text-[11px] text-white/35">
                    {sinSitio} {sinSitio === 1 ? "falta no se pudo situar" : "faltas no se pudieron situar"} en el campo y no están en el tablero.
                  </p>
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Cuánta gente protege la portería" icon={Shield}>
                  {defensores ? (
                    <>
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-semibold text-[#C8A96B]">
                          {defensores.media.toFixed(1)}
                        </span>

                        <span className="pb-1 text-sm text-white/45">
                          defensores de media, portero incluido
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
                <Panel title="Una por una" subtitle="En el orden en que las cortó el coding">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">Clip</th>
                          <th className="pb-2 pr-3 font-medium">Dónde</th>
                          <th className="pb-2 pr-3 font-medium">Distancia</th>
                          <th className="pb-2 pr-3 font-medium">Entre</th>
                          <th className="pb-2 font-medium">Qué pasó</th>
                        </tr>
                      </thead>

                      <tbody className="align-top">
                        {faltas.map((f) => (
                          <tr key={f.clip} className="border-t border-white/[0.06]">
                            <td className="py-2 pr-3">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                                style={{
                                  color: TINTA_LADO[f.lado],
                                  background: `${TINTA_LADO[f.lado]}1A`,
                                }}
                              >
                                {f.clip}
                              </span>
                            </td>

                            <td className="py-2 pr-3 text-white/70">
                              {f.zona || "—"}
                              {f.carril ? ` · ${f.carril}` : ""}
                            </td>

                            <td className="py-2 pr-3 text-white/60">{f.distancia || "—"}</td>

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

            <div className="mt-4">
              <ComoActualizar carpetaPorDefecto={partido?.clips ?? ""} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
