"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

import { Panel } from "@/components/abp/ui";
import { traeJson } from "@/lib/hojaCsv";
import { formatea, type Unidad } from "@/lib/data-analisis/metricas";
import type { GolesAbp } from "@/lib/data-analisis/goles-abp";
import type { RivalPlayerAerial } from "@/lib/abp/rival";
import { casaNombre } from "@/lib/data-analisis/once";

/*
|--------------------------------------------------------------------------
| SU BALÓN PARADO SEGÚN WYSCOUT (23/10/2026)
|--------------------------------------------------------------------------
|
| Cuando de un rival no hay acciones registradas a mano, la pantalla no se
| queda en un hueco: enseña lo que ya se sabe de él. Córners, córners con
| remate y cuota de remates a balón parado frente a los veinte equipos de la
| liga (`/api/data-analisis?abpRival=`), sus goles a balón parado y quién los
| saca y los remata según las etiquetas de Plantillas.
|
| Lo que no hay no se nombra: si Wyscout no trae al rival ni hay etiquetas, el
| bloque no sale.
*/

type Fila = {
  nombre: string;
  valor: number;
  mediana: number;
  unidad: Unidad;
  percentil: number;
  /** Si más es mejor; null cuando es un estilo y no hay «bueno». */
  mejorAlto?: boolean | null;
  /** «x de y» de un porcentaje, y los partidos que lo respaldan. */
  base?: { arriba: number; abajo: number } | null;
  partidos?: number;
};

type Aspecto = { clave: string; aspecto: string; filas: Fila[] };

type Lanzador = { nombre: string; tipo: "corner" | "falta"; total: number; partidos: number; pie?: string };

type Datos = {
  equipos: number;
  lanzadores?: Lanzador[];
  aspectos: Aspecto[];
  golesAbp: { aFavor: GolesAbp; enContra: GolesAbp } | null;
};

/** «Mejor que 8 de cada 10» / «Peor que 8 de cada 10»: percentil ya orientado. El extremo se dice como es: «el mejor/peor de los 20». */
function lectura(percentil: number, equipos: number) {
  if (percentil >= 97) return { texto: `el mejor de los ${equipos} en esta cifra`, bueno: true };
  if (percentil <= 3) return { texto: `el peor de los ${equipos} en esta cifra`, bueno: false };
  if (percentil >= 60) return { texto: `mejor que ${Math.round(percentil / 10)} de cada 10`, bueno: true };
  if (percentil <= 40) return { texto: `peor que ${Math.max(1, Math.round((100 - percentil) / 10))} de cada 10`, bueno: false };

  return { texto: "en la media de la liga", bueno: null };
}

/** La lectura de los centros: qué hacemos según cuánto centra y con qué acierto. */
function queHacemosConCentros(aspectos: Aspecto[]) {
  const filas = aspectos.flatMap((a) => a.filas);
  const volumen = filas.find((f) => f.nombre === "Centros laterales");
  const acierto = filas.find((f) => f.nombre === "Centros precisos %");

  if (!volumen || !acierto) return "";

  const muchos = volumen.valor > volumen.mediana;
  const bien = acierto.valor > acierto.mediana;

  if (muchos && bien) return "Centra mucho y con acierto: cerrar el carril exterior y proteger el segundo palo.";
  if (muchos) return "Centra mucho y acierta poco: dejarle centrar y ganar el área, sin perseguir el balón hasta la banda.";
  if (bien) return "Centra poco pero con acierto: cuando lo hace, tapar al rematador del segundo palo.";

  return "Centra poco y mal: cerrar el pase interior antes que el centro.";
}

export function AbpWyscoutRival({
  equipo,
  plantilla,
  ambito = "abp",
}: {
  equipo: string;
  plantilla: RivalPlayerAerial[];
  /** "area": sus centros laterales en vez de su balón parado (Área del rival). */
  ambito?: "abp" | "area";
}) {
  const [estado, setEstado] = useState<{ equipo: string; datos: Datos | null }>({
    equipo: "",
    datos: null,
  });

  useEffect(() => {
    if (!equipo) return;

    let cancelado = false;

    traeJson<{ ok?: boolean } & Partial<Datos>>(
      `/api/data-analisis?abpRival=${encodeURIComponent(equipo)}${ambito === "area" ? "&ambito=area" : ""}&v=2`,
    )
      .then((r) => {
        if (cancelado) return;

        setEstado({
          equipo,
          datos: r?.ok && Array.isArray(r.aspectos) ? (r as Datos) : null,
        });
      })
      .catch((error) => {
        console.error("[abp-rival] Wyscout", error);

        if (!cancelado) setEstado({ equipo, datos: null });
      });

    return () => {
      cancelado = true;
    };
  }, [equipo, ambito]);

  const datos = estado.equipo === equipo ? estado.datos : null;

  const aspectos = datos?.aspectos ?? [];

  const goles = datos?.golesAbp ?? null;

  const rematan = plantilla.filter((uno) => uno.remataAbp);
  const sacanEtiquetados = plantilla.filter((uno) => uno.sacaAbp);

  /* Sin etiquetas de «sacador», los lanza quien más saca según Wyscout, con el
     nombre cruzado con la plantilla (Wyscout escribe «O. Castro»). */
  const lanzadoresWyscout = datos?.lanzadores ?? [];
  const nombreDeLanzador = (nombre: string) =>
    casaNombre(nombre, plantilla, (uno) => uno.nombre)?.nombre ?? nombre;
  const lanzanDeTipo = (tipo: Lanzador["tipo"]) =>
    lanzadoresWyscout.filter((uno) => uno.tipo === tipo);
  const textoLanzadores = (tipo: Lanzador["tipo"]) =>
    lanzanDeTipo(tipo)
      .map((uno) => `${nombreDeLanzador(uno.nombre)} (${uno.total} en ${uno.partidos} partidos)`)
      .join(", ");

  const sacan: { nombre: string }[] =
    sacanEtiquetados.length > 0
      ? sacanEtiquetados
      : [...new Set(lanzadoresWyscout.map((uno) => nombreDeLanzador(uno.nombre)))].map((nombre) => ({ nombre }));
  const lanzaDeWyscout = sacanEtiquetados.length === 0 && sacan.length > 0;

  /* La consigna sale de lo etiquetado: marcar al más alto de los rematadores y vigilar al que saca. */
  const alturaDe = (uno: RivalPlayerAerial) => Number(uno.altura) || 0;
  const masAlto = [...rematan].sort((a, b) => alturaDe(b) - alturaDe(a))[0];
  const consigna = [
    masAlto ? `emparejar a nuestro central más alto con ${masAlto.nombre}${alturaDe(masAlto) ? ` (${alturaDe(masAlto)} cm)` : ""} en el córner` : "",
    sacan.length > 0 ? `vigilar la trayectoria de ${sacan.map((uno) => uno.nombre).join(" y ")} en el saque` : "",
  ]
    .filter(Boolean)
    .join("; ");

  const hayGoles = !!goles && (goles.aFavor.abp > 0 || goles.enContra.abp > 0);

  if (aspectos.length === 0 && !hayGoles && rematan.length === 0 && sacan.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {aspectos.length > 0 && (
        <Panel
          title={ambito === "area" ? "Sus centros laterales según Wyscout" : "Su balón parado según Wyscout"}
          subtitle={`${equipo} frente a los ${datos?.equipos ?? 20} equipos de la liga${(datos?.equipos ?? 20) === 20 ? ", el Castilla incluido" : ""}. «Mejor» y «peor» ya tienen en cuenta el sentido de cada cifra.`}
          icon={BarChart3}
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {aspectos.map((aspecto) => (
              <div key={aspecto.clave} className="min-w-0">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  {aspecto.aspecto}
                  {aspecto.filas[0]?.partidos != null && (
                    <span className="ml-2 font-normal normal-case tracking-normal italic text-white/45">
                      {aspecto.filas[0].partidos < 10
                        ? `tendencia, ${aspecto.filas[0].partidos} partidos`
                        : `en ${aspecto.filas[0].partidos} partidos`}
                    </span>
                  )}
                </h3>

                <ul className="mt-2 space-y-2">
                  {aspecto.filas.map((fila) => {
                    const lee = lectura(fila.percentil, datos?.equipos ?? 20);

                    return (
                      <li
                        key={fila.nombre}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <span className="min-w-0 text-sm text-white/80">
                          {fila.nombre}
                          {fila.mejorAlto != null && (
                            <span className="ml-2 text-[11px] font-normal text-white/40">
                              {fila.mejorAlto ? "más es mejor" : "menos es mejor"}
                            </span>
                          )}
                        </span>

                        <span className="text-sm font-semibold tabular-nums text-white">
                          {formatea(fila.valor, fila.unidad)}
                          {ambito === "area" && fila.unidad !== "porcentaje" && (
                            <span className="ml-1 text-[11px] font-normal text-white/55">por partido</span>
                          )}
                          {ambito === "area" && fila.partidos != null && (
                            <span className="ml-2 text-[11px] font-normal text-white/55">
                              en {fila.partidos} {fila.partidos === 1 ? "partido" : "partidos"}
                              {fila.partidos < 6 ? " · tendencia, pocos partidos" : ""}
                            </span>
                          )}
                          {fila.unidad === "porcentaje" && fila.base && (
                            <span className="ml-2 text-[11px] font-normal text-white/55">
                              {Math.round(fila.base.arriba)} de {Math.round(fila.base.abajo)}
                            </span>
                          )}
                          <span className="ml-2 text-[11px] font-normal text-white/40">
                            mediana {formatea(fila.mediana, fila.unidad)}
                          </span>
                        </span>

                        <span
                          className="w-full text-[11px]"
                          style={{
                            color:
                              lee.bueno === true
                                ? "var(--rmcf-rate-good, #15803D)"
                                : lee.bueno === false
                                  ? "var(--rmcf-rate-low, #DC2626)"
                                  : undefined,
                          }}
                        >
                          {lee.texto}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {ambito === "area" && queHacemosConCentros(aspectos) && (
            <p className="mt-4 border-t border-white/10 pt-3 text-sm text-white/85">
              <b className="text-white">Qué hacemos: </b>
              {queHacemosConCentros(aspectos)}
            </p>
          )}
        </Panel>
      )}

      {hayGoles && goles && (
        <Panel
          title="Goles a balón parado esta temporada"
          subtitle="Penaltis y goles, del marcador; córner y falta, estimados"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {([
              ["Los que marca", goles.aFavor],
              ["Los que encaja", goles.enContra],
            ] as const).map(([titulo, g]) => (
              <div key={titulo} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{titulo}</p>

                <p className="mt-1 text-2xl font-black tabular-nums text-white">
                  {g.abp}
                  <span className="ml-2 text-sm font-normal text-white/45">
                    de {g.goles} goles en {g.partidos} partidos
                  </span>
                </p>

                {(g.goles < 10 || g.partidos < 10) && (
                  <p className="mt-0.5 text-[11px] italic text-white/50">Tendencia, pocos casos: no lo damos por hecho.</p>
                )}

                {g.hayOrigen && g.abp > 0 && (
                  <p className="mt-1 text-[12px] text-white/55">
                    {[
                      g.penalti > 0 ? `${g.penalti} de penalti` : "",
                      g.corner > 0 ? `${g.corner} de córner` : "",
                      g.falta > 0 ? `${g.falta} de falta` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {(rematan.length > 0 || sacan.length > 0) && (
        <Panel
          title={sacan.length > 0 && rematan.length > 0 ? "Quién lo lanza y quién remata" : sacan.length > 0 ? "Quién lo lanza" : "Quién remata"}
          subtitle={lanzaDeWyscout ? "Lanzamientos de la temporada según Wyscout; rematan, según las etiquetas de la plantilla" : "Según las etiquetas de la plantilla"}
          icon={BarChart3}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sacan.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Lanzan</p>
                {lanzaDeWyscout ? (
                  <div className="mt-1 space-y-0.5 text-sm text-white/85">
                    {textoLanzadores("corner") && <p>Córner: {textoLanzadores("corner")}</p>}
                    {textoLanzadores("falta") && <p>Falta: {textoLanzadores("falta")}</p>}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-white/85">{sacan.map((uno) => uno.nombre).join(", ")}</p>
                )}
              </div>
            )}

            {rematan.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Rematan</p>
                <p className="mt-1 text-sm text-white/85">
                  {rematan
                    .map((uno) => (uno.altura ? `${uno.nombre} (${uno.altura} cm)` : uno.nombre))
                    .join(", ")}
                </p>
              </div>
            )}
          </div>

          {consigna && (
            <p className="mt-3 border-t border-white/10 pt-3 text-sm text-white/85">
              <b className="text-white">Qué hacemos: </b>
              {consigna}
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}

export default AbpWyscoutRival;
