"use client";

/*
|--------------------------------------------------------------------------
| COMPARATIVA DE LIGAS (23/11/2026; rehecha el mismo día)
|--------------------------------------------------------------------------
|
| Las cinco grandes, Segunda y los dos grupos de Primera RFEF, con la misma
| vara (los «Team Stats» de Wyscout, media por partido de la temporada en
| curso). Tras la primera versión el analista pidió «visualizaciones y
| comparaciones» de verdad y «el Castilla en todos los sitios». Cinco vistas,
| y en todas el Castilla en oro:
|
|   - El Castilla en cada liga: con qué liga encaja su estilo (y su gemelo
|     allí), el percentil que tendría en cada una por grupo y la radiografía
|     métrica × liga.
|   - Mapa de estilos: todos los equipos en dos ejes (estilo global por
|     componentes principales o dos métricas), el equipo medio de cada liga y
|     el Castilla con sus vecinos.
|   - Perfil de las ligas: métrica a métrica (las ligas en una regla con el
|     Castilla) y liga a liga (la huella de cada una contra la media), o tabla.
|   - Una métrica a fondo: cada liga con su caja central, sus equipos y el
|     Castilla; y el ranking de todos los equipos con el puesto del Castilla.
|   - Equipos parecidos: los más parecidos a un equipo y su huella de estilo
|     lado a lado (con el Castilla de referencia si el elegido es otro).
|
| Datos: public/data/ligas-comparativa.json (scripts/ligas-comparativa.cjs);
| cuentas puras en lib/ligas/comparativa.ts. Colores de components/data/graficas.
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Crosshair, Globe2, Layers3, Map as MapaIcono, ScanSearch, Sigma } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { EsqueletoPantalla, EstadoError } from "@/components/ui/estados";
import { AbpHeader, Notice, Segmented, Select } from "@/components/abp/ui";
import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { Lamina, TituloConclusion } from "@/components/ui/VistaVisual";
import { COMPARADO, MEJOR, ORO, PEOR, colorPercentil, tinta } from "@/components/data/graficas";
import {
  CASTILLA,
  GRUPOS,
  METRICAS,
  METRICAS_ESTILO,
  NOMBRE_GRUPO,
  NUESTRA_LIGA,
  buscaEquipo,
  cuantil,
  desviacion,
  encajeEnLigas,
  equipoMedio,
  escalaEstilo,
  formatea,
  indiceDe,
  mapaDeEstilos,
  media,
  mediaLiga,
  parecidoZ,
  parecidos,
  percentilEn,
  posicionEntreLigas,
  puestoEn,
  todosLosEquipos,
  vectorZ,
  type ComparativaLigas as Datos,
  type EquipoLiga,
  type GrupoMetrica,
  type Liga,
  type Metrica,
} from "@/lib/ligas/comparativa";

const VISTAS = ["castilla", "mapa", "perfil", "metrica", "parecidos"] as const;
type Vista = (typeof VISTAS)[number];

let enVuelo: Promise<Datos> | null = null;
const trae = () => {
  enVuelo ??= fetch("/data/ligas-comparativa.json", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Datos>) : Promise.reject(new Error(String(r.status)))))
    .catch((e) => {
      enVuelo = null;
      throw e;
    });
  return enVuelo;
};

const fechaCorta = (iso: string) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "");
const ordinal = (n: number) => `${n}.º`;
const nombreMet = (id: string) => METRICAS[indiceDe(id)]?.nombre ?? id;
const esNuestra = (l: Liga) => l.slug === NUESTRA_LIGA;
/** Al calcular el puesto del Castilla en su propia liga, se le quita de ella. */
const sinCastilla = (l: Liga) => (esNuestra(l) ? CASTILLA : undefined);
const fondo = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

function Marco({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />
        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">{children}</div>
        </section>
      </div>
    </main>
  );
}

/** El ancho de una caja, medido (para que los SVG no se estiren). */
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

/** Marcas «bonitas» de un eje. */
function marcas(min: number, max: number, n = 5) {
  const rango = max - min || 1;
  const paso0 = rango / n;
  const mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((p) => p >= paso0) ?? paso0;
  const out: number[] = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(Math.round(v / paso) * paso);
  return out;
}

const decDe = (paso: number) => (paso >= 1 ? 0 : paso >= 0.1 ? 1 : 2);

/** Un percentil escrito y pintado (el color nunca va solo). */
function ChipPercentil({ p, estilo = false }: { p: number | null; estilo?: boolean }) {
  if (p === null) return <span className="text-white/35">—</span>;
  const color = estilo ? tinta(0.6) : colorPercentil(p);
  return (
    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: fondo(color, 22), color: estilo ? undefined : color }}>
      P{p}
    </span>
  );
}

function Leyenda({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/55">{children}</div>;
}

function Punto({ color, rombo = false, aro = false }: { color: string; rombo?: boolean; aro?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 shrink-0 ${rombo ? "rotate-45" : "rounded-full"}`}
      style={aro ? { border: `2px solid ${color}` } : { background: color }}
    />
  );
}

export function ComparativaLigas() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);
  const [vista, setVista] = usePestanaUrl<Vista>("vista", VISTAS, "castilla");
  const [metrica, setMetrica] = useState("posesion");

  useEffect(() => {
    let vivo = true;
    trae()
      .then((d) => {
        if (vivo) {
          setDatos(d);
          setFallo(false);
        }
      })
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, [intento]);

  const ligas = useMemo(() => (datos?.ligas ?? []).filter((l) => l.equipos.length >= 8), [datos]);

  if (fallo)
    return (
      <Marco>
        <EstadoError titulo="No se ha podido cargar la comparativa" onReintentar={() => setIntento((n) => n + 1)} />
      </Marco>
    );
  if (!datos)
    return (
      <Marco>
        <EsqueletoPantalla titulo="la comparativa de ligas" />
      </Marco>
    );

  const nuestra = ligas.find(esNuestra);
  const castilla = nuestra?.equipos.find((e) => e.nombre === CASTILLA) ?? null;

  const abreMetrica = (id: string) => {
    setMetrica(id);
    setVista("metrica");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Marco>
      <AbpHeader
        area="DATA"
        title="Comparativa de ligas"
        lead="Cómo se juega en las cinco grandes, en Segunda y en los dos grupos de Primera RFEF, con la misma vara (los informes de equipo de Wyscout, media por partido de esta temporada), y dónde cae el Castilla en cada una."
      />

      <div className="mt-4">
        <Notice title="Se compara el estilo, no el nivel">
          Un 55 % de posesión no vale lo mismo en la Bundesliga que en Primera RFEF. Lo comparable es cómo se juega: volumen, ritmo, altura de la presión, juego directo o elaborado. El percentil del Castilla en otra liga dice dónde caerían sus números allí, no que fuera a sacarlos.{" "}
          {ligas.map((l) => `${l.corto}: ${l.equipos.length} equipos, hasta el ${fechaCorta(l.ultimo)}`).join(" · ")}.
        </Notice>
      </div>

      <div className="mt-5">
        <Pestanas
          etiqueta="Vistas de la comparativa"
          valor={vista}
          onCambia={setVista}
          opciones={[
            { clave: "castilla", label: "El Castilla en cada liga", corto: "Castilla", icono: Crosshair },
            { clave: "mapa", label: "Mapa de estilos", corto: "Mapa", icono: MapaIcono },
            { clave: "perfil", label: "Perfil de las ligas", corto: "Perfil", icono: Layers3 },
            { clave: "metrica", label: "Una métrica a fondo", corto: "Métrica", icono: Sigma },
            { clave: "parecidos", label: "Equipos parecidos", corto: "Parecidos", icono: ScanSearch },
          ]}
        />
      </div>

      <div className="mt-5 min-w-0">
        {!castilla && <Notice tone="warn" title="El Castilla no está en los datos de su grupo">Sale todo lo demás, pero sin su marca en oro.</Notice>}
        {vista === "castilla" && castilla && <VistaCastilla ligas={ligas} castilla={castilla} onMetrica={abreMetrica} />}
        {vista === "mapa" && <VistaMapa ligas={ligas} />}
        {vista === "perfil" && <Perfil ligas={ligas} castilla={castilla} onMetrica={abreMetrica} />}
        {vista === "metrica" && <AFondo ligas={ligas} id={metrica} onCambia={setMetrica} castilla={castilla} />}
        {vista === "parecidos" && <Parecidos ligas={ligas} />}
      </div>

      <p className="mt-8 flex items-center gap-1.5 text-[11px] text-white/40">
        <Globe2 size={12} aria-hidden /> Wyscout · Team Stats de cada equipo · temporada {nuestra?.temporada ?? ""} · cada equipo pesa igual en la media de su liga.
      </p>
    </Marco>
  );
}

/* ------------------------------------------------------------------ */
/*  EL CASTILLA EN CADA LIGA                                           */
/* ------------------------------------------------------------------ */

function VistaCastilla({ ligas, castilla, onMetrica }: { ligas: Liga[]; castilla: EquipoLiga; onMetrica: (id: string) => void }) {
  const encaje = useMemo(() => encajeEnLigas(ligas, NUESTRA_LIGA, CASTILLA), [ligas]);

  /* Percentil del Castilla en cada liga y métrica. */
  const matriz = useMemo(
    () =>
      METRICAS.map((met, i) => ({
        met,
        i,
        p: ligas.map((l) => (typeof castilla.v[i] === "number" ? percentilEn(l, i, castilla.v[i] as number, met.mejor, sinCastilla(l)) : null)),
      })),
    [ligas, castilla],
  );

  /* Nivel de sus números en cada liga: la media de los percentiles de las métricas con «mejor». */
  const nivel = ligas.map((l, k) => {
    const deGrupo = (g?: GrupoMetrica) => media(matriz.filter((f) => f.met.mejor && (!g || f.met.grupo === g)).map((f) => f.p[k]));
    return { liga: l, total: deGrupo(), grupos: GRUPOS.map((g) => ({ g, p: deGrupo(g) })) };
  });
  const porNivel = [...nivel].filter((n) => n.total !== null).sort((a, b) => (b.total as number) - (a.total as number));

  const mejorEncaje = encaje[0];
  const propio = encaje.find((e) => esNuestra(e.liga));

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Lamina>
          <TituloConclusion
            pregunta="¿Con qué liga encaja su forma de jugar?"
            fuente="Parecido del estilo del Castilla (18 métricas de estilo, sin goles ni resultados) con el equipo medio de cada liga. A la derecha, el equipo de esa liga que más se le parece."
          >
            {mejorEncaje
              ? esNuestra(mejorEncaje.liga)
                ? `Juega como su grupo: ${mejorEncaje.parecido} % de parecido con el equipo medio del Grupo 2`
                : `Juega más como el equipo medio de ${mejorEncaje.liga.corto} (${mejorEncaje.parecido} %) que como el de su grupo${propio ? ` (${propio.parecido} %)` : ""}`
              : "Encaje de estilo"}
          </TituloConclusion>
          <ul className="grid gap-2">
            {encaje.map((e, n) => (
              <li key={e.liga.slug} className="grid min-w-0 grid-cols-[minmax(90px,auto)_minmax(0,1fr)] items-center gap-x-3">
                <span className={`truncate text-[12px] ${esNuestra(e.liga) ? "font-semibold text-[color:var(--rmcf-gold-ink)]" : "text-white/80"}`}>{e.liga.corto}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span className="block h-full rounded-full" style={{ width: `${e.parecido}%`, background: n === 0 ? ORO : esNuestra(e.liga) ? fondo("var(--rmcf-gold-ink)", 55) : tinta(0.4) }} />
                    </span>
                    <span className="w-10 text-right text-[13px] font-semibold tabular-nums">{e.parecido} %</span>
                  </span>
                  {e.gemelo && (
                    <span className="mt-0.5 block truncate text-[11px] text-white/50">
                      Su gemelo allí: <span className="text-white/75">{e.gemelo.nombre}</span> · {e.gemelo.parecido} %
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Lamina>

        <Lamina>
          <TituloConclusion
            pregunta="Si jugase en cada liga, ¿dónde caerían sus números?"
            fuente="Media de su percentil en las métricas que tienen «mejor» (goles, xG, tiros, PPDA, goles y xG en contra…), contra los equipos de cada liga. P50 = en la media de esa liga."
          >
            {porNivel[0] && porNivel.at(-1)
              ? `Sus números serían de P${Math.round(porNivel[0].total as number)} en ${porNivel[0].liga.corto} y de P${Math.round(porNivel.at(-1)!.total as number)} en ${porNivel.at(-1)!.liga.corto}`
              : "Nivel de sus números en cada liga"}
          </TituloConclusion>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[520px] border-separate border-spacing-y-1 text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.1em] text-white/45">
                  <th scope="col" className="py-1 text-left font-semibold">Liga</th>
                  <th scope="col" className="py-1 text-left font-semibold">Total</th>
                  {GRUPOS.map((g) => (
                    <th key={g} scope="col" className="px-1 py-1 text-center font-semibold" title={NOMBRE_GRUPO[g]}>
                      {NOMBRE_GRUPO[g].split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porNivel.map((n) => (
                  <tr key={n.liga.slug}>
                    <th scope="row" className={`py-1 pr-2 text-left font-normal ${esNuestra(n.liga) ? "font-semibold text-[color:var(--rmcf-gold-ink)]" : "text-white/80"}`}>
                      {n.liga.corto}
                    </th>
                    <td className="py-1 pr-2">
                      <span className="flex items-center gap-2">
                        <span className="relative h-2.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                          <span className="absolute inset-y-0 left-1/2 w-px bg-white/30" aria-hidden />
                          <span className="block h-full rounded-full" style={{ width: `${n.total}%`, background: colorPercentil(Math.round(n.total as number)) }} />
                        </span>
                        <ChipPercentil p={Math.round(n.total as number)} />
                      </span>
                    </td>
                    {n.grupos.map(({ g, p }) => (
                      <td key={g} className="px-1 py-1 text-center">
                        <ChipPercentil p={p === null ? null : Math.round(p)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Lamina>
      </div>

      <Lamina>
        <TituloConclusion
          pregunta="Radiografía: su percentil en cada métrica y en cada liga"
          fuente="Cada celda, el percentil del Castilla con su cifra de esta temporada entre los equipos de esa liga (en su grupo, sin contarle a él). En color, las métricas con «mejor»: verde P60 o más, oro en la media, naranja P40 o menos. En gris, las de estilo: «P80» = hace más que el 80 % de esa liga. Pulsa una métrica para verla a fondo."
        >
          Dónde caería cada número del Castilla en cada liga
        </TituloConclusion>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[820px] border-separate border-spacing-[3px] text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.1em] text-white/50">
                <th scope="col" className="sticky left-0 z-10 bg-[#0B0F14] py-1 pr-3 text-left font-semibold">Métrica</th>
                <th scope="col" className="px-1 py-1 text-right font-semibold text-[color:var(--rmcf-gold-ink)]">Castilla</th>
                {ligas.map((l) => (
                  <th key={l.slug} scope="col" className={`px-1 py-1 text-center font-semibold ${esNuestra(l) ? "text-[color:var(--rmcf-gold-ink)]" : ""}`}>
                    {l.corto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRUPOS.map((g) => (
                <FilasGrupo key={g} titulo={NOMBRE_GRUPO[g]} columnas={ligas.length + 2}>
                  {matriz
                    .filter((f) => f.met.grupo === g)
                    .map(({ met, i, p }) => (
                      <tr key={met.id}>
                        <th scope="row" className="sticky left-0 z-10 bg-[#0B0F14] py-0.5 pr-3 text-left font-normal">
                          <button type="button" onClick={() => onMetrica(met.id)} title={met.que} className="dedo-44 text-left text-white/85 hover:text-[color:var(--rmcf-gold-ink)] hover:underline">
                            {met.nombre}
                            {!met.mejor && <span className="ml-1 text-[10px] text-white/35">estilo</span>}
                          </button>
                        </th>
                        <td className="px-1 text-right font-semibold tabular-nums text-[color:var(--rmcf-gold-ink)]">{formatea(castilla.v[i], met.dec, met.unidad)}</td>
                        {ligas.map((l, k) => {
                          const v = p[k];
                          const color = v === null ? null : met.mejor ? colorPercentil(v) : tinta(0.5);
                          return (
                            <td
                              key={l.slug}
                              className={`rounded-md px-1 py-1.5 text-center text-[11px] font-semibold tabular-nums ${esNuestra(l) ? "ring-1 ring-[color:var(--rmcf-gold-ink)]/60" : ""}`}
                              style={color ? { background: fondo(color, met.mejor ? 28 : Math.round(6 + (v as number) * 0.3)) } : undefined}
                              title={v === null ? undefined : `${l.nombre}: ${met.mejor ? `mejor que el ${v} %` : `más que el ${v} %`} de sus equipos (media de la liga ${formatea(mediaLiga(l, i), met.dec, met.unidad)})`}
                            >
                              {v === null ? "—" : `P${v}`}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </FilasGrupo>
              ))}
            </tbody>
          </table>
        </div>
        <Leyenda>
          <span className="inline-flex items-center gap-1.5"><Punto color={MEJOR} /> P60 o más</span>
          <span className="inline-flex items-center gap-1.5"><Punto color={ORO} /> en la media</span>
          <span className="inline-flex items-center gap-1.5"><Punto color={PEOR} /> P40 o menos</span>
          <span className="inline-flex items-center gap-1.5"><Punto color={tinta(0.5)} /> estilo: cuanto más intenso, más hace</span>
        </Leyenda>
      </Lamina>
    </div>
  );
}

function FilasGrupo({ titulo, columnas, children }: { titulo: string; columnas: number; children: ReactNode }) {
  return (
    <>
      <tr>
        <th scope="colgroup" colSpan={columnas} className="pt-3 pb-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {titulo}
        </th>
      </tr>
      {children}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  MAPA DE ESTILOS                                                    */
/* ------------------------------------------------------------------ */

const PRESETS = [
  { k: "pca", label: "Estilo global" },
  { k: "presion", label: "Balón × presión", x: "posesion", y: "ppda" },
  { k: "directo", label: "Elaborado × directo", x: "pasesPosesion", y: "largoPct" },
  { k: "ocasiones", label: "Ocasiones a favor × en contra", x: "xg", y: "xgContra" },
  { k: "area", label: "Llegada × remate", x: "entradasArea", y: "xgTiro" },
  { k: "libre", label: "A elegir" },
] as const;
type Preset = (typeof PRESETS)[number]["k"];

type PuntoMapa = { liga: Liga; equipo: EquipoLiga; x: number; y: number };

function VistaMapa({ ligas }: { ligas: Liga[] }) {
  const [preset, setPreset] = useState<Preset>("pca");
  const [libreX, setLibreX] = useState("posesion");
  const [libreY, setLibreY] = useState("recAltas");
  const [resalta, setResalta] = useState("");
  const pca = useMemo(() => mapaDeEstilos(ligas), [ligas]);

  const ejes = useMemo(() => {
    if (preset === "pca") return null;
    const p = PRESETS.find((x) => x.k === preset);
    const xId = preset === "libre" ? libreX : p && "x" in p ? p.x : "posesion";
    const yId = preset === "libre" ? libreY : p && "y" in p ? p.y : "ppda";
    return { x: METRICAS[indiceDe(xId)], y: METRICAS[indiceDe(yId)], xi: indiceDe(xId), yi: indiceDe(yId) };
  }, [preset, libreX, libreY]);

  const puntos: PuntoMapa[] = useMemo(() => {
    if (!ejes) return pca?.puntos ?? [];
    return todosLosEquipos(ligas)
      .filter((t) => typeof t.equipo.v[ejes.xi] === "number" && typeof t.equipo.v[ejes.yi] === "number")
      .map((t) => ({ ...t, x: t.equipo.v[ejes.xi] as number, y: t.equipo.v[ejes.yi] as number }));
  }, [ejes, pca, ligas]);

  /* Arriba y a la derecha, «mejor» en las métricas con «mejor = bajo» (PPDA, xG en contra…). */
  const invX = ejes?.x.mejor === "bajo";
  const invY = ejes?.y.mejor === "bajo";

  const explicaEje = (lista: { id: string; peso: number }[]) => {
    const mas = lista.filter((e) => e.peso > 0).map((e) => nombreMet(e.id).toLowerCase());
    const menos = lista.filter((e) => e.peso < 0).map((e) => nombreMet(e.id).toLowerCase());
    return { mas: mas.join(", "), menos: menos.join(", ") };
  };

  const etiquetaX = ejes
    ? `${ejes.x.nombre}${ejes.x.unidad === "%" ? " (%)" : ""}${invX ? " · a la derecha, menos" : ""}`
    : (() => {
        const e = explicaEje(pca?.ejeX.explica ?? []);
        return `→ más ${e.mas}${e.menos ? ` · ← más ${e.menos}` : ""}`;
      })();
  const etiquetaY = ejes
    ? `${ejes.y.nombre}${ejes.y.unidad === "%" ? " (%)" : ""}${invY ? " · arriba, menos" : ""}`
    : (() => {
        const e = explicaEje(pca?.ejeY.explica ?? []);
        return `↑ más ${e.mas}${e.menos ? ` · ↓ más ${e.menos}` : ""}`;
      })();

  /* Equipo medio de cada liga y el Castilla con sus vecinos (en desviaciones de cada eje). */
  const centros = ligas.map((l) => {
    const suyos = puntos.filter((p) => p.liga.slug === l.slug);
    return { liga: l, x: media(suyos.map((p) => p.x)), y: media(suyos.map((p) => p.y)) };
  });
  const sdX = desviacion(puntos.map((p) => p.x)) || 1;
  const sdY = desviacion(puntos.map((p) => p.y)) || 1;
  const yo = puntos.find((p) => esNuestra(p.liga) && p.equipo.nombre === CASTILLA) ?? null;
  const dist = (a: { x: number | null; y: number | null }) => (yo && a.x !== null && a.y !== null ? Math.hypot((a.x - yo.x) / sdX, (a.y - yo.y) / sdY) : Infinity);
  const vecinos = yo ? puntos.filter((p) => p !== yo).sort((a, b) => dist(a) - dist(b)).slice(0, 6) : [];
  const centroCercano = [...centros].sort((a, b) => dist(a) - dist(b))[0];

  const conclusion = !yo
    ? "Todos los equipos de todas las ligas"
    : centroCercano && !esNuestra(centroCercano.liga)
      ? `En este mapa el Castilla cae más cerca del equipo medio de ${centroCercano.liga.corto} que del de su grupo; su vecino más próximo: ${vecinos[0]?.equipo.nombre} (${vecinos[0]?.liga.corto})`
      : `En este mapa el Castilla cae junto al equipo medio de su grupo; su vecino más próximo: ${vecinos[0]?.equipo.nombre ?? "—"} (${vecinos[0]?.liga.corto ?? ""})`;

  const opcionesMet = GRUPOS.flatMap((g) => METRICAS.filter((x) => x.grupo === g).map((x) => ({ value: x.id, label: `${NOMBRE_GRUPO[g]} · ${x.nombre}` })));

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <div className="max-w-full overflow-x-auto">
          <Segmented ariaLabel="Qué mapa" value={preset} onChange={setPreset} options={PRESETS.map((p) => ({ key: p.k, label: p.label }))} />
        </div>
        <div className="w-56">
          <Select label="Resaltar liga" value={resalta} onChange={setResalta} options={[{ value: "", label: "Ninguna" }, ...ligas.map((l) => ({ value: l.slug, label: l.nombre }))]} />
        </div>
      </div>
      {preset === "libre" && (
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Select label="Eje horizontal" value={libreX} onChange={setLibreX} options={opcionesMet} />
          <Select label="Eje vertical" value={libreY} onChange={setLibreY} options={opcionesMet} />
        </div>
      )}

      <Lamina>
        <TituloConclusion
          pregunta={ejes ? `${ejes.x.nombre} y ${ejes.y.nombre.toLowerCase()} de todos los equipos` : "¿Dónde cae cada equipo en el estilo de juego?"}
          fuente={
            ejes
              ? `Cada punto, un equipo (media por partido). Rombos: el equipo medio de cada liga. Rayas discontinuas: la media de todos.${invX || invY ? " En las métricas en las que menos es mejor, el eje va al revés: hacia la derecha o hacia arriba, mejor." : ""}`
              : `Las 18 métricas de estilo resumidas en dos ejes (componentes principales sobre todos los equipos): el horizontal recoge el ${Math.round((pca?.ejeX.varianza ?? 0) * 100)} % de las diferencias de estilo y el vertical el ${Math.round((pca?.ejeY.varianza ?? 0) * 100)} %. Rombos: el equipo medio de cada liga.`
          }
        >
          {conclusion}
        </TituloConclusion>

        <Dispersion puntos={puntos} centros={centros} resalta={resalta} invX={invX} invY={invY} etiquetaX={etiquetaX} etiquetaY={etiquetaY} vecinos={vecinos.slice(0, 3)} formato={ejes ? [ejes.x, ejes.y] : null} />

        <Leyenda>
          <span className="inline-flex items-center gap-1.5"><Punto color={ORO} /> Real Madrid Castilla</span>
          <span className="inline-flex items-center gap-1.5"><Punto color={tinta(0.35)} /> un equipo</span>
          {resalta && <span className="inline-flex items-center gap-1.5"><Punto color={COMPARADO} /> {ligas.find((l) => l.slug === resalta)?.corto}</span>}
          <span className="inline-flex items-center gap-1.5"><Punto color={tinta(0.85)} rombo /> equipo medio de cada liga</span>
        </Leyenda>
      </Lamina>

      {yo && (
        <Lamina>
          <TituloConclusion pregunta="Sus vecinos en este mapa" fuente="Los equipos más cerca del Castilla en estos dos ejes, de cualquier liga.">
            {vecinos.length ? `${vecinos.filter((v) => !esNuestra(v.liga)).length} de sus 6 vecinos más cercanos son de otras ligas` : "Vecinos"}
          </TituloConclusion>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {vecinos.map((v, n) => (
              <li key={`${v.liga.slug}-${v.equipo.nombre}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className="text-[12px] tabular-nums text-white/45">{n + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{v.equipo.nombre}</span>
                  <span className="block text-[11px] text-white/55">
                    {v.liga.corto}
                    {ejes ? ` · ${formatea(v.x, ejes.x.dec, ejes.x.unidad)} · ${formatea(v.y, ejes.y.dec, ejes.y.unidad)}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Lamina>
      )}
    </div>
  );
}

function Dispersion({
  puntos,
  centros,
  resalta,
  invX,
  invY,
  etiquetaX,
  etiquetaY,
  vecinos,
  formato,
}: {
  puntos: PuntoMapa[];
  centros: { liga: Liga; x: number | null; y: number | null }[];
  resalta: string;
  invX: boolean;
  invY: boolean;
  etiquetaX: string;
  etiquetaY: string;
  vecinos: PuntoMapa[];
  formato: [Metrica, Metrica] | null;
}) {
  const [caja, ancho] = useAncho<HTMLDivElement>();
  const W = Math.max(300, ancho);
  const H = Math.round(Math.min(560, Math.max(340, W * 0.6)));
  const m = { l: 48, r: 18, t: 14, b: 40 };

  if (!puntos.length) return <div ref={caja} className="py-10 text-center text-[13px] text-white/50">Sin datos para estos ejes.</div>;

  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const pad = (a: number, b: number) => [a - (b - a) * 0.06, b + (b - a) * 0.06] as const;
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs));
  const [y0, y1] = pad(Math.min(...ys), Math.max(...ys));
  const sx = (v: number) => {
    const t = (v - x0) / (x1 - x0 || 1);
    return m.l + (invX ? 1 - t : t) * (W - m.l - m.r);
  };
  const sy = (v: number) => {
    const t = (v - y0) / (y1 - y0 || 1);
    return m.t + (invY ? t : 1 - t) * (H - m.t - m.b);
  };
  const mx = media(xs) ?? 0;
  const my = media(ys) ?? 0;
  const tx = marcas(x0, x1);
  const ty = marcas(y0, y1, 4);
  const dx = formato ? formato[0].dec : decDe(tx[1] - tx[0]);
  const dy = formato ? formato[1].dec : decDe(ty[1] - ty[0]);
  const fmt = (v: number, d: number) => v.toLocaleString("es-ES", { maximumFractionDigits: Math.min(d, 2) });
  const esYo = (p: PuntoMapa) => esNuestra(p.liga) && p.equipo.nombre === CASTILLA;
  const yo = puntos.find(esYo);
  const titulo = (p: PuntoMapa) => `${p.equipo.nombre} · ${p.liga.corto}${formato ? `: ${formatea(p.x, formato[0].dec, formato[0].unidad)} · ${formatea(p.y, formato[1].dec, formato[1].unidad)}` : ""} (${p.equipo.pj} partidos)`;

  return (
    <div ref={caja} className="min-w-0">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mapa: ${etiquetaX}; ${etiquetaY}`} className="block overflow-visible">
        {tx.map((v) => (
          <g key={`x${v}`}>
            <line x1={sx(v)} x2={sx(v)} y1={m.t} y2={H - m.b} stroke={tinta(0.06)} />
            <text x={sx(v)} y={H - m.b + 14} textAnchor="middle" fontSize={10} fill={tinta(0.5)}>
              {formato ? fmt(v, dx) : ""}
            </text>
          </g>
        ))}
        {ty.map((v) => (
          <g key={`y${v}`}>
            <line x1={m.l} x2={W - m.r} y1={sy(v)} y2={sy(v)} stroke={tinta(0.06)} />
            <text x={m.l - 6} y={sy(v) + 3} textAnchor="end" fontSize={10} fill={tinta(0.5)}>
              {formato ? fmt(v, dy) : ""}
            </text>
          </g>
        ))}
        <line x1={sx(mx)} x2={sx(mx)} y1={m.t} y2={H - m.b} stroke={tinta(0.3)} strokeDasharray="4 4" />
        <line x1={m.l} x2={W - m.r} y1={sy(my)} y2={sy(my)} stroke={tinta(0.3)} strokeDasharray="4 4" />

        {puntos
          .filter((p) => !esYo(p) && p.liga.slug !== resalta)
          .map((p) => (
            <circle key={`${p.liga.slug}-${p.equipo.nombre}`} cx={sx(p.x)} cy={sy(p.y)} r={3.6} fill={tinta(resalta ? 0.16 : 0.32)}>
              <title>{titulo(p)}</title>
            </circle>
          ))}
        {puntos
          .filter((p) => !esYo(p) && p.liga.slug === resalta)
          .map((p) => (
            <circle key={`r-${p.equipo.nombre}`} cx={sx(p.x)} cy={sy(p.y)} r={4.6} fill={COMPARADO} fillOpacity={0.85}>
              <title>{titulo(p)}</title>
            </circle>
          ))}

        {centros.map((c) =>
          c.x === null || c.y === null ? null : (
            <g key={`c-${c.liga.slug}`}>
              <rect
                x={sx(c.x) - 5}
                y={sy(c.y) - 5}
                width={10}
                height={10}
                transform={`rotate(45 ${sx(c.x)} ${sy(c.y)})`}
                fill={c.liga.slug === resalta ? COMPARADO : esNuestra(c.liga) ? ORO : tinta(0.85)}
                stroke="var(--rmcf-page, #0B0F14)"
                strokeWidth={1.5}
              >
                <title>{`Equipo medio de ${c.liga.nombre}`}</title>
              </rect>
              <text x={sx(c.x) + 9} y={sy(c.y) + 4} fontSize={11} fontWeight={600} fill={esNuestra(c.liga) ? ORO : tinta(0.85)} paintOrder="stroke" stroke="var(--rmcf-page, #0B0F14)" strokeWidth={3}>
                {c.liga.corto}
              </text>
            </g>
          ),
        )}

        {vecinos.map((v) => (
          <text key={`v-${v.liga.slug}-${v.equipo.nombre}`} x={sx(v.x)} y={sy(v.y) - 7} textAnchor="middle" fontSize={10} fill={tinta(0.7)} paintOrder="stroke" stroke="var(--rmcf-page, #0B0F14)" strokeWidth={3}>
            {v.equipo.nombre}
          </text>
        ))}

        {yo && (
          <g>
            <circle cx={sx(yo.x)} cy={sy(yo.y)} r={13} fill={ORO} fillOpacity={0.16} />
            <circle cx={sx(yo.x)} cy={sy(yo.y)} r={7} fill={ORO} stroke={tinta(0.95)} strokeWidth={1.5}>
              <title>{titulo(yo)}</title>
            </circle>
            <text x={sx(yo.x)} y={sy(yo.y) + 22} textAnchor="middle" fontSize={12} fontWeight={700} fill={ORO} paintOrder="stroke" stroke="var(--rmcf-page, #0B0F14)" strokeWidth={3}>
              Castilla
            </text>
          </g>
        )}

        <text x={W - m.r} y={H - 6} textAnchor="end" fontSize={11} fill={tinta(0.7)}>
          {etiquetaX}
        </text>
        <text x={12} y={m.t} fontSize={11} fill={tinta(0.7)} transform={`rotate(-90 12 ${m.t})`} textAnchor="end">
          {etiquetaY}
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PERFIL DE LAS LIGAS                                                */
/* ------------------------------------------------------------------ */

function Perfil({ ligas, castilla, onMetrica }: { ligas: Liga[]; castilla: EquipoLiga | null; onMetrica: (id: string) => void }) {
  const [grupo, setGrupo] = useState<GrupoMetrica>("balon");
  const [forma, setForma] = useState<"grafico" | "tabla">("grafico");
  const filas = METRICAS.map((met, i) => ({ met, i })).filter(({ met }) => met.grupo === grupo);
  const escala = useMemo(() => escalaEstilo(ligas, METRICAS.map((x) => x.id)), [ligas]);

  /* La conclusión: la métrica del grupo en la que más se separa el Castilla de la media de las ligas. */
  const titulo = useMemo(() => {
    if (!castilla) return `${NOMBRE_GRUPO[grupo]}: la media de cada liga`;
    let mejor: { met: Metrica; z: number } | null = null;
    for (const { met, i } of filas) {
      const k = escala.idx.indexOf(i);
      const v = castilla.v[i];
      const mu = media(ligas.map((l) => mediaLiga(l, i)));
      if (k < 0 || typeof v !== "number" || mu === null) continue;
      const z = (v - mu) / escala.sd[k];
      if (!mejor || Math.abs(z) > Math.abs(mejor.z)) mejor = { met, z };
    }
    if (!mejor) return `${NOMBRE_GRUPO[grupo]}: la media de cada liga`;
    const fuera = ligas.filter((l) => {
      const mu = mediaLiga(l, indiceDe(mejor!.met.id));
      const v = castilla.v[indiceDe(mejor!.met.id)] as number;
      return mu !== null && (mejor!.z > 0 ? v > mu : v < mu);
    }).length;
    return `${NOMBRE_GRUPO[grupo]}: donde más se sale el Castilla es en ${mejor.met.nombre.toLowerCase()}, ${mejor.z > 0 ? "por encima" : "por debajo"} de la media de ${fuera} de las ${ligas.length} ligas`;
  }, [ligas, filas, grupo, castilla, escala]);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <Segmented ariaLabel="Grupo de métricas" value={grupo} onChange={setGrupo} options={GRUPOS.map((g) => ({ key: g, label: NOMBRE_GRUPO[g] }))} />
        </div>
        <Segmented
          ariaLabel="Gráfico o tabla"
          value={forma}
          onChange={setForma}
          options={[
            { key: "grafico", label: "Gráfico" },
            { key: "tabla", label: "Tabla" },
          ]}
        />
      </div>

      <Lamina>
        <TituloConclusion
          pregunta="Métrica a métrica: cada liga en una regla, con el Castilla"
          fuente="Cada punto gris es la media de una liga; el aro, la de nuestro grupo; el rombo de oro, el Castilla. A los lados, la liga que menos y la que más. Pulsa una métrica para verla a fondo."
        >
          {titulo}
        </TituloConclusion>
        {forma === "grafico" ? <Reglas ligas={ligas} filas={filas} castilla={castilla} onMetrica={onMetrica} /> : <TablaPerfil ligas={ligas} filas={filas} castilla={castilla} onMetrica={onMetrica} />}
        <Leyenda>
          <span className="inline-flex items-center gap-1.5"><Punto color={ORO} rombo /> Real Madrid Castilla</span>
          <span className="inline-flex items-center gap-1.5"><Punto color={tinta(0.85)} aro /> media de nuestro grupo</span>
          <span className="inline-flex items-center gap-1.5"><Punto color={tinta(0.45)} /> media de otra liga</span>
        </Leyenda>
      </Lamina>

      <Lamina>
        <TituloConclusion
          pregunta="Liga a liga: la huella de cada una"
          fuente="Cada barra, cuánto se separa la media de esa liga de la media de todas, en desviaciones (de todos los equipos). La raya de oro, el Castilla en esa misma escala."
        >
          {`${NOMBRE_GRUPO[grupo]}: en qué destaca cada liga y dónde queda el Castilla`}
        </TituloConclusion>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ligas.map((l) => (
            <HuellaLigaMini key={l.slug} liga={l} ligas={ligas} filas={filas} escala={escala} castilla={castilla} />
          ))}
        </div>
      </Lamina>
    </div>
  );
}

type FilaMet = { met: Metrica; i: number };

function Reglas({ ligas, filas, castilla, onMetrica }: { ligas: Liga[]; filas: FilaMet[]; castilla: EquipoLiga | null; onMetrica: (id: string) => void }) {
  const [caja, ancho] = useAncho<HTMLDivElement>();
  const W = Math.max(200, ancho);
  const alto = 40;
  return (
    <div className="grid min-w-0 grid-cols-[minmax(110px,auto)_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
      {filas.map(({ met, i }, n) => {
        const medias = ligas.map((l) => ({ liga: l, v: mediaLiga(l, i) })).filter((x): x is { liga: Liga; v: number } => x.v !== null);
        const vc = typeof castilla?.v[i] === "number" ? (castilla.v[i] as number) : null;
        const todos = [...medias.map((x) => x.v), ...(vc === null ? [] : [vc])];
        if (!todos.length) return null;
        const lo = Math.min(...todos);
        const hi = Math.max(...todos);
        const pad = (hi - lo) * 0.08 || 1;
        const x = (v: number) => 10 + ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (W - 20);
        const ordenadas = [...medias].sort((a, b) => a.v - b.v);
        const g2 = medias.find((x) => esNuestra(x.liga));
        return (
          <FilaRegla key={met.id}>
            <button type="button" onClick={() => onMetrica(met.id)} title={met.que} className="dedo-44 truncate text-left text-[12px] text-white/85 hover:text-[color:var(--rmcf-gold-ink)] hover:underline">
              {met.nombre}
            </button>
            <div ref={n === 0 ? caja : undefined} className="min-w-0">
              <svg width="100%" height={alto} viewBox={`0 0 ${W} ${alto}`} role="img" aria-label={`${met.nombre}: media de cada liga y el Castilla`} className="block overflow-visible">
                <line x1={x(ordenadas[0].v)} x2={x(ordenadas.at(-1)!.v)} y1={16} y2={16} stroke={tinta(0.22)} strokeWidth={4} strokeLinecap="round" />
                {medias.map((mm) => (
                  <circle key={mm.liga.slug} cx={x(mm.v)} cy={16} r={esNuestra(mm.liga) ? 6 : 4.5} fill={esNuestra(mm.liga) ? "none" : tinta(0.5)} stroke={esNuestra(mm.liga) ? tinta(0.9) : "none"} strokeWidth={2}>
                    <title>{`${mm.liga.nombre}: ${formatea(mm.v, met.dec, met.unidad)}`}</title>
                  </circle>
                ))}
                {vc !== null && (
                  <rect x={x(vc) - 5.5} y={10.5} width={11} height={11} transform={`rotate(45 ${x(vc)} 16)`} fill={ORO} stroke={tinta(0.95)} strokeWidth={1}>
                    <title>{`Castilla: ${formatea(vc, met.dec, met.unidad)}`}</title>
                  </rect>
                )}
                <text x={x(ordenadas[0].v)} y={36} fontSize={10} fill={tinta(0.5)} textAnchor="start">
                  {ordenadas[0].liga.corto}
                </text>
                {ordenadas.length > 1 && (
                  <text x={x(ordenadas.at(-1)!.v)} y={36} fontSize={10} fill={tinta(0.5)} textAnchor="end">
                    {ordenadas.at(-1)!.liga.corto}
                  </text>
                )}
              </svg>
            </div>
            <span className="text-right text-[12px] tabular-nums">
              <span className="font-semibold text-[color:var(--rmcf-gold-ink)]">{formatea(vc, met.dec, met.unidad)}</span>
              {g2 && <span className="block text-[10px] text-white/45">grupo {formatea(g2.v, met.dec, met.unidad)}</span>}
            </span>
          </FilaRegla>
        );
      })}
    </div>
  );
}

function FilaRegla({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function TablaPerfil({ ligas, filas, castilla, onMetrica }: { ligas: Liga[]; filas: FilaMet[]; castilla: EquipoLiga | null; onMetrica: (id: string) => void }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[760px] border-separate border-spacing-y-1 text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.12em] text-white/50">
            <th scope="col" className="sticky left-0 z-10 bg-[#0B0F14] py-1 pr-3 text-left font-semibold">Métrica</th>
            {castilla && <th scope="col" className="px-1 py-1 text-center font-semibold text-[color:var(--rmcf-gold-ink)]">Castilla</th>}
            {ligas.map((l) => (
              <th key={l.slug} scope="col" className={`px-1 py-1 text-center font-semibold ${esNuestra(l) ? "text-[color:var(--rmcf-gold-ink)]" : ""}`}>
                {l.corto}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ met, i }) => {
            const pos = posicionEntreLigas(ligas, i);
            return (
              <tr key={met.id}>
                <th scope="row" className="sticky left-0 z-10 bg-[#0B0F14] py-1 pr-3 text-left font-normal">
                  <button type="button" onClick={() => onMetrica(met.id)} title={met.que} className="dedo-44 text-left text-white/85 hover:text-[color:var(--rmcf-gold-ink)] hover:underline">
                    {met.nombre}
                  </button>
                </th>
                {castilla && <td className="px-1 py-1.5 text-center font-semibold tabular-nums text-[color:var(--rmcf-gold-ink)]">{formatea(castilla.v[i], met.dec)}</td>}
                {ligas.map((l, k) => (
                  <td
                    key={l.slug}
                    className={`rounded-md px-1 py-1.5 text-center tabular-nums text-white/90 ${esNuestra(l) ? "ring-1 ring-[color:var(--rmcf-gold-ink)]/60" : ""}`}
                    style={{ background: pos[k] === null ? "transparent" : `rgb(200 169 107 / ${(0.06 + (pos[k] as number) * 0.5).toFixed(2)})` }}
                  >
                    {formatea(mediaLiga(l, i), met.dec)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HuellaLigaMini({ liga, ligas, filas, escala, castilla }: { liga: Liga; ligas: Liga[]; filas: FilaMet[]; escala: ReturnType<typeof escalaEstilo>; castilla: EquipoLiga | null }) {
  const TOPE = 1.5;
  const medio = equipoMedio(liga, sinCastilla(liga));
  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${esNuestra(liga) ? "border-[color:var(--rmcf-gold-ink)]/50 bg-[color:var(--rmcf-gold-ink)]/[0.05]" : "border-white/10 bg-white/[0.02]"}`}>
      <p className={`mb-2 text-[12px] font-semibold ${esNuestra(liga) ? "text-[color:var(--rmcf-gold-ink)]" : "text-white/85"}`}>{liga.nombre}</p>
      <ul className="grid gap-1">
        {filas.map(({ met, i }) => {
          const k = escala.idx.indexOf(i);
          const mu = media(ligas.map((l) => mediaLiga(l, i)));
          if (k < 0 || mu === null || medio[i] === null) return null;
          const z = Math.max(-TOPE, Math.min(TOPE, ((medio[i] as number) - mu) / escala.sd[k]));
          const zc = typeof castilla?.v[i] === "number" ? Math.max(-TOPE, Math.min(TOPE, ((castilla.v[i] as number) - mu) / escala.sd[k])) : null;
          const pc = (v: number) => 50 + (v / TOPE) * 50;
          const buena = met.mejor === null ? null : met.mejor === "alto" ? z > 0 : z < 0;
          return (
            <li key={met.id} className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)] items-center gap-2" title={`${met.nombre}: ${formatea(medio[i], met.dec, met.unidad)} (todas: ${formatea(mu, met.dec, met.unidad)}${zc !== null ? ` · Castilla ${formatea(castilla!.v[i], met.dec, met.unidad)}` : ""})`}>
              <span className="truncate text-[10px] text-white/55">{met.nombre}</span>
              <span className="relative h-3">
                <span className="absolute inset-y-0 left-1/2 w-px bg-white/25" aria-hidden />
                <span
                  className="absolute top-0.5 h-2 rounded-sm"
                  style={{ left: `${Math.min(50, pc(z))}%`, width: `${Math.abs(pc(z) - 50)}%`, background: buena === null ? tinta(0.45) : buena ? MEJOR : PEOR }}
                />
                {zc !== null && <span className="absolute -top-0.5 h-4 w-[3px] -translate-x-1/2 rounded-full" style={{ left: `${pc(zc)}%`, background: ORO }} />}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  UNA MÉTRICA A FONDO                                                */
/* ------------------------------------------------------------------ */

function AFondo({ ligas, id, onCambia, castilla }: { ligas: Liga[]; id: string; onCambia: (id: string) => void; castilla: EquipoLiga | null }) {
  const i = Math.max(0, indiceDe(id));
  const met = METRICAS[i];
  const [caja, ancho] = useAncho<HTMLDivElement>();
  const valorC = typeof castilla?.v[i] === "number" ? (castilla.v[i] as number) : null;
  const sentido = met.mejor === "bajo" ? 1 : -1;

  const filas = ligas
    .map((l) => ({ liga: l, media: mediaLiga(l, i) }))
    .filter((x): x is { liga: Liga; media: number } => x.media !== null)
    .sort((a, b) => sentido * (a.media - b.media));

  const todos = ligas.flatMap((l) => l.equipos.map((e) => e.v[i])).filter((x): x is number => typeof x === "number");
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const W = Math.max(180, ancho);
  const x = (v: number) => (max === min ? W / 2 : 8 + ((v - min) / (max - min)) * (W - 16));

  const primera = filas[0];
  const ultima = filas.at(-1);
  const verbo = met.mejor === "bajo" ? ["mejor (menos)", "peor"] : met.mejor === "alto" ? ["mejor", "peor"] : ["de más", "de menos"];
  const g2 = filas.findIndex((f) => esNuestra(f.liga));
  const conclusion =
    primera && ultima
      ? `${primera.liga.corto} es la ${verbo[0]} en ${met.nombre.toLowerCase()} (${formatea(primera.media, met.dec, met.unidad)}) y ${ultima.liga.corto} la ${verbo[1]} (${formatea(ultima.media, met.dec, met.unidad)})${g2 >= 0 ? `; nuestro grupo, ${ordinal(g2 + 1)} de ${filas.length}` : ""}${valorC !== null ? `; el Castilla, ${formatea(valorC, met.dec, met.unidad)}` : ""}`
      : met.nombre;

  /* Ranking de todos los equipos de todas las ligas, con el Castilla. */
  const ranking = todosLosEquipos(ligas)
    .filter((t) => typeof t.equipo.v[i] === "number")
    .sort((a, b) => sentido * ((a.equipo.v[i] as number) - (b.equipo.v[i] as number)));
  const posC = ranking.findIndex((t) => esNuestra(t.liga) && t.equipo.nombre === CASTILLA);
  const TOP = 12;
  const visibles = ranking.map((t, n) => ({ t, n })).filter(({ n }) => n < TOP || n === posC || n === ranking.length - 1);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="max-w-sm">
        <Select label="Métrica" value={met.id} onChange={onCambia} options={GRUPOS.flatMap((g) => METRICAS.filter((x) => x.grupo === g).map((x) => ({ value: x.id, label: `${NOMBRE_GRUPO[g]} · ${x.nombre}` })))} />
      </div>

      <Lamina>
        <TituloConclusion
          pregunta={`${met.nombre}: ${met.que.toLowerCase()}`}
          fuente="Cada punto, un equipo; la banda, la mitad central de la liga (del cuartil 1 al 3); la raya blanca, su media; la raya de oro discontinua, el Castilla en todas las ligas. A la derecha, el puesto y el percentil que tendría el Castilla en cada una."
        >
          {conclusion}
        </TituloConclusion>

        <div className="grid min-w-0 grid-cols-[minmax(84px,auto)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/40">Liga</span>
          <span className="flex justify-between text-[10px] tabular-nums text-white/40">
            <span>{formatea(min, met.dec, met.unidad)}</span>
            <span>{formatea(max, met.dec, met.unidad)}</span>
          </span>
          <span className="text-right text-[10px] uppercase tracking-[0.12em] text-[color:var(--rmcf-gold-ink)]">Castilla allí</span>
          {filas.map(({ liga, media: mu }, n) => {
            const nuestra = esNuestra(liga);
            const q1 = cuantil(liga.equipos.map((e) => e.v[i]), 0.25);
            const q3 = cuantil(liga.equipos.map((e) => e.v[i]), 0.75);
            const alto = 34;
            const puesto = valorC !== null ? puestoEn(liga, i, valorC, met.mejor, sinCastilla(liga)) : null;
            const pct = valorC !== null ? percentilEn(liga, i, valorC, met.mejor, sinCastilla(liga)) : null;
            return (
              <FilaRegla key={liga.slug}>
                <span className={`truncate text-[12px] ${nuestra ? "font-semibold text-[color:var(--rmcf-gold-ink)]" : "text-white/75"}`}>
                  {liga.corto}
                  <span className="block text-[10px] font-normal tabular-nums text-white/45">media {formatea(mu, met.dec, met.unidad)}</span>
                </span>
                <div ref={n === 0 ? caja : undefined} className="min-w-0">
                  <svg width="100%" height={alto} viewBox={`0 0 ${W} ${alto}`} role="img" aria-label={`${liga.nombre}: media ${formatea(mu, met.dec, met.unidad)}`} className="block overflow-visible">
                    {q1 !== null && q3 !== null && <rect x={x(q1)} y={6} width={Math.max(2, x(q3) - x(q1))} height={alto - 12} rx={4} fill={tinta(0.08)} />}
                    <line x1={0} x2={W} y1={alto / 2} y2={alto / 2} stroke={tinta(0.1)} />
                    {[...liga.equipos]
                      .filter((e) => typeof e.v[i] === "number")
                      .sort((a, b) => (a.v[i] as number) - (b.v[i] as number))
                      .map((e, k) => {
                        const yo = e.nombre === CASTILLA;
                        return (
                          <circle key={e.nombre} cx={x(e.v[i] as number)} cy={yo ? alto / 2 : alto / 2 + ((k % 3) - 1) * 6} r={yo ? 6.5 : 3.6} fill={yo ? ORO : tinta(0.4)} stroke={yo ? tinta(0.95) : "none"} strokeWidth={1.5}>
                            <title>{`${e.nombre}: ${formatea(e.v[i], met.dec, met.unidad)} (${e.pj} partidos)`}</title>
                          </circle>
                        );
                      })}
                    <line x1={x(mu)} x2={x(mu)} y1={3} y2={alto - 3} stroke={tinta(0.9)} strokeWidth={2} />
                    {valorC !== null && !nuestra && <line x1={x(valorC)} x2={x(valorC)} y1={0} y2={alto} stroke={ORO} strokeWidth={2} strokeDasharray="4 3" />}
                  </svg>
                </div>
                <span className="flex items-center justify-end gap-2 text-right text-[12px] tabular-nums">
                  {puesto && (
                    <span className="text-white/85">
                      {ordinal(puesto.puesto)} <span className="text-[10px] text-white/45">de {puesto.de}</span>
                    </span>
                  )}
                  <ChipPercentil p={pct} estilo={!met.mejor} />
                </span>
              </FilaRegla>
            );
          })}
        </div>
        <Leyenda>
          <span className="inline-flex items-center gap-1.5"><Punto color={ORO} /> Real Madrid Castilla</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-[2px] bg-white/90" /> media de la liga</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-5 rounded bg-white/10" /> mitad central</span>
          {!met.mejor && <span>Métrica de estilo: el puesto es «el que más»</span>}
        </Leyenda>
      </Lamina>

      <Lamina>
        <TituloConclusion
          pregunta={`Ranking de todos los equipos: ${met.nombre.toLowerCase()}`}
          fuente={`Los ${ranking.length} equipos de todas las ligas, ${met.mejor === "bajo" ? "de menos a más (menos es mejor)" : "de más a menos"}. Se ven los ${TOP} primeros, el Castilla y el último.`}
        >
          {posC >= 0 ? `El Castilla es ${ordinal(posC + 1)} de ${ranking.length} equipos de ${ligas.length} ligas` : "Ranking de todos los equipos"}
        </TituloConclusion>
        <ol className="grid gap-1">
          {visibles.map(({ t, n }, k) => {
            const yo = n === posC;
            const v = t.equipo.v[i] as number;
            const salto = k > 0 && n - visibles[k - 1].n > 1;
            return (
              <li key={`${t.liga.slug}-${t.equipo.nombre}`} className="min-w-0">
                {salto && <span className="block py-0.5 pl-8 text-[11px] text-white/30">⋯</span>}
                <span className={`grid min-w-0 grid-cols-[2rem_minmax(0,14rem)_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-1 ${yo ? "bg-[color:var(--rmcf-gold-ink)]/[0.12] ring-1 ring-[color:var(--rmcf-gold-ink)]/50" : ""}`}>
                  <span className="text-right text-[12px] tabular-nums text-white/45">{n + 1}</span>
                  <span className="min-w-0 truncate text-[12px]">
                    <span className={yo ? "font-semibold text-[color:var(--rmcf-gold-ink)]" : "text-white/85"}>{t.equipo.nombre}</span>
                    <span className="text-white/45"> · {t.liga.corto}</span>
                  </span>
                  <span className="h-2 min-w-0 overflow-hidden rounded-full bg-white/[0.05]">
                    <span className="block h-full rounded-full" style={{ width: `${max === min ? 100 : 8 + ((v - min) / (max - min)) * 92}%`, background: yo ? ORO : tinta(0.35) }} />
                  </span>
                  <span className="text-right text-[12px] tabular-nums text-white/85">{formatea(v, met.dec, met.unidad)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </Lamina>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EQUIPOS PARECIDOS                                                  */
/* ------------------------------------------------------------------ */

function Parecidos({ ligas }: { ligas: Liga[] }) {
  const [liga, setLiga] = useState(NUESTRA_LIGA);
  const [equipo, setEquipo] = useState(CASTILLA);
  const [elegido, setElegido] = useState(0);
  const laLiga = ligas.find((l) => l.slug === liga) ?? ligas[0];
  const elEquipo = laLiga?.equipos.some((e) => e.nombre === equipo) ? equipo : (laLiga?.equipos[0]?.nombre ?? "");
  const lista = useMemo(() => (laLiga ? parecidos(ligas, laLiga.slug, elEquipo, 12) : []), [ligas, laLiga, elEquipo]);
  const fuera = lista.filter((p) => p.liga.slug !== laLiga?.slug);
  const escala = useMemo(() => escalaEstilo(ligas), [ligas]);
  const castilla = buscaEquipo(ligas, NUESTRA_LIGA, CASTILLA);
  const esCastilla = laLiga?.slug === NUESTRA_LIGA && elEquipo === CASTILLA;
  const zC = castilla ? vectorZ(castilla.equipo.v, escala) : null;
  const base = laLiga ? laLiga.equipos.find((e) => e.nombre === elEquipo) : null;
  const comparado = lista[Math.min(elegido, lista.length - 1)] ?? null;
  const parecidoConCastilla = !esCastilla && base && zC ? parecidoZ(vectorZ(base.v, escala), zC) : null;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <Select
          label="Liga"
          value={laLiga?.slug ?? ""}
          onChange={(v) => {
            setLiga(v);
            setEquipo(ligas.find((l) => l.slug === v)?.equipos[0]?.nombre ?? "");
            setElegido(0);
          }}
          options={ligas.map((l) => ({ value: l.slug, label: l.nombre }))}
        />
        <Select
          label="Equipo"
          value={elEquipo}
          onChange={(v) => {
            setEquipo(v);
            setElegido(0);
          }}
          options={(laLiga?.equipos ?? []).map((e) => ({ value: e.nombre, label: e.nombre }))}
        />
      </div>
      {!esCastilla && (
        <p className="text-[12px] text-white/60">
          {parecidoConCastilla !== null && (
            <>
              {elEquipo} se parece un <span className="font-semibold text-[color:var(--rmcf-gold-ink)]">{parecidoConCastilla} %</span> al Castilla.{" "}
            </>
          )}
          <button
            type="button"
            className="text-[color:var(--rmcf-gold-ink)] underline-offset-2 hover:underline"
            onClick={() => {
              setLiga(NUESTRA_LIGA);
              setEquipo(CASTILLA);
              setElegido(0);
            }}
          >
            Volver al Castilla
          </button>
        </p>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Lamina>
          <TituloConclusion
            pregunta={`¿Quién juega como ${elEquipo}?`}
            fuente="Por estilo: posesión, elaboración, ritmo, juego largo, profundidad, centros, presión (PPDA y recuperaciones altas), duelos, faltas, contras, llegada al área y tiros a favor y en contra. Sin goles ni resultados. Pulsa uno para ver las dos huellas lado a lado."
          >
            {fuera[0] ? `El más parecido fuera de su liga: ${fuera[0].equipo.nombre} (${fuera[0].liga.corto}), ${fuera[0].parecido} %` : "Equipos parecidos"}
          </TituloConclusion>

          <ol className="grid gap-1.5">
            {lista.map((p, n) => {
              const activo = comparado === p;
              const conC = !esCastilla && zC ? parecidoZ(vectorZ(p.equipo.v, escala), zC) : null;
              const esC = esNuestra(p.liga) && p.equipo.nombre === CASTILLA;
              return (
                <li key={`${p.liga.slug}-${p.equipo.nombre}`}>
                  <button
                    type="button"
                    onClick={() => setElegido(n)}
                    aria-pressed={activo}
                    className={`grid w-full min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-x-3 rounded-xl border px-3 py-2 text-left transition ${activo ? "border-[#4F8FE8]/70 bg-[#4F8FE8]/[0.08]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
                  >
                    <span className="pt-0.5 text-[12px] tabular-nums text-white/45">{n + 1}</span>
                    <span className="min-w-0">
                      <span className={`block truncate text-[13px] font-semibold ${esC ? "text-[color:var(--rmcf-gold-ink)]" : "text-white"}`}>
                        {p.equipo.nombre} <span className="text-[11px] font-normal text-white/55">· {p.liga.corto}</span>
                      </span>
                      <span className="block text-[11px] text-white/55">
                        Igual en {p.igual.map((x) => nombreMet(x).toLowerCase()).join(", ")}; les separa {p.distinto.map((x) => nombreMet(x).toLowerCase()).join(" y ")}.
                        {conC !== null && !esC && <span className="text-[color:var(--rmcf-gold-ink)]"> Con el Castilla: {conC} %.</span>}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-[14px] font-bold tabular-nums text-[color:var(--rmcf-gold-ink)]">{p.parecido} %</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10" aria-hidden>
                        <span className="block h-full rounded-full" style={{ width: `${p.parecido}%`, background: ORO }} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Lamina>

        {base && comparado && (
          <Lamina>
            <TituloConclusion
              pregunta={`Huella de estilo: ${elEquipo} y ${comparado.equipo.nombre}`}
              fuente="Cada métrica de estilo en desviaciones respecto a todos los equipos de todas las ligas (0 = la media). La línea une a los dos: cuanto más corta, más se parecen en eso."
            >
              {`${comparado.parecido} % de parecido; donde más se separan: ${comparado.distinto.map((x) => nombreMet(x).toLowerCase()).join(" y ")}`}
            </TituloConclusion>
            <Huella base={base} baseNombre={elEquipo} baseEsCastilla={esCastilla} otro={comparado.equipo} otroNombre={`${comparado.equipo.nombre} (${comparado.liga.corto})`} escala={escala} castilla={esCastilla ? null : (castilla?.equipo ?? null)} />
          </Lamina>
        )}
      </div>
    </div>
  );
}

function Huella({
  base,
  baseNombre,
  baseEsCastilla,
  otro,
  otroNombre,
  escala,
  castilla,
}: {
  base: EquipoLiga;
  baseNombre: string;
  baseEsCastilla: boolean;
  otro: EquipoLiga;
  otroNombre: string;
  escala: ReturnType<typeof escalaEstilo>;
  castilla: EquipoLiga | null;
}) {
  const [caja, ancho] = useAncho<HTMLDivElement>();
  const W = Math.max(160, ancho);
  const TOPE = 2.5;
  const x = (z: number) => W / 2 + (Math.max(-TOPE, Math.min(TOPE, z)) / TOPE) * (W / 2 - 8);
  const zb = vectorZ(base.v, escala);
  const zo = vectorZ(otro.v, escala);
  const zc = castilla ? vectorZ(castilla.v, escala) : null;
  const colorBase = baseEsCastilla ? ORO : tinta(0.9);

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 grid-cols-[minmax(96px,auto)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5">
        <span />
        <span className="flex justify-between text-[10px] text-white/40">
          <span>menos que la media</span>
          <span>más</span>
        </span>
        <span />
        {METRICAS_ESTILO.map((id, k) => {
          const met = METRICAS[indiceDe(id)];
          const a = zb[k];
          const b = zo[k];
          const c = zc?.[k] ?? null;
          return (
            <FilaRegla key={id}>
              <span className="truncate text-[11px] text-white/70" title={met.que}>
                {met.nombre}
              </span>
              <div ref={k === 0 ? caja : undefined} className="min-w-0">
                <svg width="100%" height={20} viewBox={`0 0 ${W} 20`} className="block overflow-visible" aria-label={`${met.nombre}: ${baseNombre} ${formatea(base.v[indiceDe(id)], met.dec, met.unidad)}, ${otroNombre} ${formatea(otro.v[indiceDe(id)], met.dec, met.unidad)}`} role="img">
                  <line x1={W / 2} x2={W / 2} y1={0} y2={20} stroke={tinta(0.25)} />
                  <line x1={8} x2={W - 8} y1={10} y2={10} stroke={tinta(0.07)} />
                  {a !== null && b !== null && <line x1={x(a)} x2={x(b)} y1={10} y2={10} stroke={tinta(0.35)} strokeWidth={3} strokeLinecap="round" />}
                  {c !== null && <rect x={x(c) - 4} y={6} width={8} height={8} transform={`rotate(45 ${x(c)} 10)`} fill="none" stroke={ORO} strokeWidth={1.5}><title>{`Castilla: ${formatea(castilla!.v[indiceDe(id)], met.dec, met.unidad)}`}</title></rect>}
                  {b !== null && (
                    <circle cx={x(b)} cy={10} r={5} fill={COMPARADO}>
                      <title>{`${otroNombre}: ${formatea(otro.v[indiceDe(id)], met.dec, met.unidad)}`}</title>
                    </circle>
                  )}
                  {a !== null && (
                    <circle cx={x(a)} cy={10} r={5.5} fill={colorBase} stroke={tinta(0.95)} strokeWidth={1}>
                      <title>{`${baseNombre}: ${formatea(base.v[indiceDe(id)], met.dec, met.unidad)}`}</title>
                    </circle>
                  )}
                </svg>
              </div>
              <span className="text-right text-[10px] tabular-nums text-white/60">
                <span style={{ color: baseEsCastilla ? ORO : undefined }}>{formatea(base.v[indiceDe(id)], met.dec)}</span>
                <span className="text-white/30"> · </span>
                <span style={{ color: COMPARADO }}>{formatea(otro.v[indiceDe(id)], met.dec)}</span>
              </span>
            </FilaRegla>
          );
        })}
      </div>
      <Leyenda>
        <span className="inline-flex items-center gap-1.5"><Punto color={colorBase} /> {baseNombre}</span>
        <span className="inline-flex items-center gap-1.5"><Punto color={COMPARADO} /> {otroNombre}</span>
        {castilla && <span className="inline-flex items-center gap-1.5"><Punto color={ORO} rombo aro /> Castilla de referencia</span>}
      </Leyenda>
    </div>
  );
}
