"use client";

/*
|--------------------------------------------------------------------------
| COMPARATIVA DE LIGAS (23/11/2026)
|--------------------------------------------------------------------------
|
| Las cinco grandes, Segunda y los dos grupos de Primera RFEF, con la misma
| vara (los «Team Stats» de Wyscout, media por partido de la temporada en
| curso). Tres vistas:
|
|   - Perfil de las ligas: cada métrica, la media de cada liga; el color dice
|     dónde cae entre la más baja y la más alta (estilo, no nota).
|   - Una métrica a fondo: los equipos de cada liga como puntos, su media y
|     dónde estaría el Castilla en cada una.
|   - Equipos parecidos: los que juegan más parecido a un equipo, en las otras
|     ligas, por métricas de estilo (sin goles ni resultados).
|
| Datos: public/data/ligas-comparativa.json (scripts/ligas-comparativa.cjs);
| cuentas puras en lib/ligas/comparativa.ts.
*/

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Globe2, Layers3, ScanSearch, Sigma } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { EsqueletoPantalla, EstadoError } from "@/components/ui/estados";
import { AbpHeader, Notice, Segmented, Select } from "@/components/abp/ui";
import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { Lamina, TituloConclusion } from "@/components/ui/VistaVisual";
import { ORO, tinta } from "@/components/data/graficas";
import {
  CASTILLA,
  GRUPOS,
  METRICAS,
  NOMBRE_GRUPO,
  NUESTRA_LIGA,
  buscaEquipo,
  formatea,
  indiceDe,
  mediaLiga,
  parecidos,
  posicionEntreLigas,
  puestoEn,
  type ComparativaLigas as Datos,
  type GrupoMetrica,
  type Liga,
  type Metrica,
} from "@/lib/ligas/comparativa";

const VISTAS = ["perfil", "metrica", "parecidos"] as const;
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

/** El ancho de una caja, medido (para que los puntos no se estiren). */
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

const ordinal = (n: number) => `${n}.º`;

export function ComparativaLigas() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);
  const [vista, setVista] = usePestanaUrl<Vista>("vista", VISTAS, "perfil");
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

  const ligas = datos.ligas.filter((l) => l.equipos.length >= 8);
  const nuestra = ligas.find((l) => l.slug === NUESTRA_LIGA);
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
        lead="Cómo se juega en las cinco grandes, en Segunda y en los dos grupos de Primera RFEF, con la misma vara: los informes de equipo de Wyscout, media por partido de esta temporada."
      />

      <div className="mt-4">
        <Notice title="Se compara el estilo, no el nivel">
          Un 55 % de posesión no vale lo mismo en la Bundesliga que en Primera RFEF. Lo que sí es comparable es cómo se juega: volumen, ritmo, altura de la presión, juego directo o elaborado.{" "}
          {ligas.map((l) => `${l.corto}: ${l.equipos.length} equipos, hasta el ${fechaCorta(l.ultimo)}`).join(" · ")}.
        </Notice>
      </div>

      <div className="mt-5">
        <Pestanas
          etiqueta="Vistas de la comparativa"
          valor={vista}
          onCambia={setVista}
          opciones={[
            { clave: "perfil", label: "Perfil de las ligas", corto: "Perfil", icono: Layers3 },
            { clave: "metrica", label: "Una métrica a fondo", corto: "Métrica", icono: Sigma },
            { clave: "parecidos", label: "Equipos parecidos", corto: "Parecidos", icono: ScanSearch },
          ]}
        />
      </div>

      <div className="mt-5 min-w-0">
        {vista === "perfil" && <Perfil ligas={ligas} castilla={castilla?.v ?? null} onMetrica={abreMetrica} />}
        {vista === "metrica" && <AFondo ligas={ligas} id={metrica} onCambia={setMetrica} />}
        {vista === "parecidos" && <Parecidos ligas={ligas} />}
      </div>

      <p className="mt-8 flex items-center gap-1.5 text-[11px] text-white/40">
        <Globe2 size={12} aria-hidden /> Wyscout · Team Stats de cada equipo · temporada {nuestra?.temporada ?? ""} · cada equipo pesa igual en la media de su liga.
      </p>
    </Marco>
  );
}

/* ------------------------------------------------------------------ */
/*  PERFIL DE LAS LIGAS                                                */
/* ------------------------------------------------------------------ */

function Perfil({ ligas, castilla, onMetrica }: { ligas: Liga[]; castilla: (number | null)[] | null; onMetrica: (id: string) => void }) {
  const [grupo, setGrupo] = useState<GrupoMetrica>("balon");
  const filas = METRICAS.map((met, i) => ({ met, i })).filter(({ met }) => met.grupo === grupo);

  /* La conclusión: la métrica del grupo en la que más se separa nuestra liga de la media de las otras. */
  const titulo = useMemo(() => {
    const g2 = ligas.findIndex((l) => l.slug === NUESTRA_LIGA);
    if (g2 < 0) return "Cada métrica, la media de cada liga";
    let mejor: { met: Metrica; pos: number } | null = null;
    for (const { met, i } of filas) {
      const pos = posicionEntreLigas(ligas, i)[g2];
      if (pos === null) continue;
      if (!mejor || Math.abs(pos - 0.5) > Math.abs(mejor.pos - 0.5)) mejor = { met, pos };
    }
    if (!mejor) return "Cada métrica, la media de cada liga";
    return `${NOMBRE_GRUPO[grupo]}: donde más se distingue nuestro grupo es en ${mejor.met.nombre.toLowerCase()} (${mejor.pos >= 0.5 ? "de las que más" : "de las que menos"})`;
  }, [ligas, filas, grupo]);

  return (
    <Lamina>
      <TituloConclusion pregunta="¿En qué se parece y en qué no cada liga?" fuente="Media por partido de los equipos de cada liga. Color: de la liga que menos (claro) a la que más (intenso). Pulsa una métrica para verla a fondo.">
        {titulo}
      </TituloConclusion>

      <div className="mb-3 overflow-x-auto">
        <Segmented ariaLabel="Grupo de métricas" value={grupo} onChange={setGrupo} options={GRUPOS.map((g) => ({ key: g, label: NOMBRE_GRUPO[g] }))} />
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[760px] border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-white/50">
              <th scope="col" className="sticky left-0 z-10 bg-[#0B0F14] py-1 pr-3 text-left font-semibold">Métrica</th>
              {ligas.map((l) => (
                <th key={l.slug} scope="col" className={`px-1 py-1 text-center font-semibold ${l.slug === NUESTRA_LIGA ? "text-[color:var(--rmcf-gold-ink)]" : ""}`}>
                  {l.corto}
                </th>
              ))}
              {castilla && (
                <th scope="col" className="px-1 py-1 text-center font-semibold text-[color:var(--rmcf-gold-ink)]">
                  Castilla
                </th>
              )}
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
                  {ligas.map((l, k) => {
                    const p = pos[k];
                    return (
                      <td
                        key={l.slug}
                        className={`rounded-md px-1 py-1.5 text-center tabular-nums text-white/90 ${l.slug === NUESTRA_LIGA ? "ring-1 ring-[color:var(--rmcf-gold-ink)]/60" : ""}`}
                        style={{ background: p === null ? "transparent" : `rgb(200 169 107 / ${(0.06 + p * 0.5).toFixed(2)})` }}
                      >
                        {formatea(mediaLiga(l, i), met.dec)}
                      </td>
                    );
                  })}
                  {castilla && <td className="px-1 py-1.5 text-center font-semibold tabular-nums text-[color:var(--rmcf-gold-ink)]">{formatea(castilla[i], met.dec)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Lamina>
  );
}

/* ------------------------------------------------------------------ */
/*  UNA MÉTRICA A FONDO                                                */
/* ------------------------------------------------------------------ */

function AFondo({ ligas, id, onCambia }: { ligas: Liga[]; id: string; onCambia: (id: string) => void }) {
  const i = Math.max(0, indiceDe(id));
  const met = METRICAS[i];
  const [caja, ancho] = useAncho<HTMLDivElement>();
  const castilla = buscaEquipo(ligas, NUESTRA_LIGA, CASTILLA);
  const valorC = castilla?.equipo.v[i] ?? null;

  const filas = ligas
    .map((l) => ({ liga: l, media: mediaLiga(l, i) }))
    .filter((x) => x.media !== null)
    .sort((a, b) => (b.media as number) - (a.media as number));

  const todos = ligas.flatMap((l) => l.equipos.map((e) => e.v[i])).filter((x): x is number => typeof x === "number");
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const izq = 0;
  const ancho2 = Math.max(160, ancho);
  const x = (v: number) => (max === min ? ancho2 / 2 : izq + 8 + ((v - min) / (max - min)) * (ancho2 - 16));

  const primera = filas[0];
  const ultima = filas.at(-1);
  const g2 = filas.findIndex((f) => f.liga.slug === NUESTRA_LIGA);
  const conclusion =
    primera && ultima
      ? `${primera.liga.corto} es la de más ${met.nombre.toLowerCase()} (${formatea(primera.media, met.dec, met.unidad)}) y ${ultima.liga.corto} la de menos (${formatea(ultima.media, met.dec, met.unidad)})${g2 >= 0 ? `; nuestro grupo, ${ordinal(g2 + 1)} de ${filas.length}` : ""}`
      : met.nombre;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="max-w-sm">
        <Select
          label="Métrica"
          value={met.id}
          onChange={onCambia}
          options={GRUPOS.flatMap((g) => METRICAS.filter((x) => x.grupo === g).map((x) => ({ value: x.id, label: `${NOMBRE_GRUPO[g]} · ${x.nombre}` })))}
        />
      </div>

      <Lamina>
        <TituloConclusion pregunta={`${met.nombre}: ${met.que.toLowerCase()}`} fuente="Cada punto es un equipo; la raya, la media de su liga; en oro, el Castilla y dónde caería en cada liga.">
          {conclusion}
        </TituloConclusion>

        <div className="grid min-w-0 grid-cols-[minmax(84px,auto)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
          {filas.map(({ liga, media }) => {
            const nuestra = liga.slug === NUESTRA_LIGA;
            return (
              <FilaPuntos key={liga.slug} liga={liga} i={i} media={media as number} nuestra={nuestra} x={x} ancho={ancho2} valorC={valorC} met={met} medir={nuestra ? caja : undefined} />
            );
          })}
        </div>
        {/* Para medir el ancho de la pista aunque nuestra liga no salga. */}
        {g2 < 0 && <div ref={caja} className="h-0" />}
      </Lamina>

      {castilla && valorC !== null && (
        <Lamina>
          <TituloConclusion pregunta="Si el Castilla jugase en cada liga" fuente="Puesto que tendría con su cifra de esta temporada entre los equipos de esa liga.">
            {met.mejor ? `El Castilla, con ${formatea(valorC, met.dec, met.unidad)}, ${met.mejor === "alto" ? "cuanto más, mejor" : "cuanto menos, mejor"}` : `El Castilla, con ${formatea(valorC, met.dec, met.unidad)} (métrica de estilo: ni más ni menos es mejor)`}
          </TituloConclusion>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {filas.map(({ liga }) => {
              const { puesto, de } = puestoEn(liga, i, valorC, met.mejor, liga.slug === NUESTRA_LIGA ? CASTILLA : undefined);
              return (
                <li key={liga.slug} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">{liga.corto}</p>
                  <p className="text-[15px] font-semibold text-white">
                    {ordinal(puesto)} <span className="text-[12px] font-normal text-white/55">de {de}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </Lamina>
      )}
    </div>
  );
}

function FilaPuntos({
  liga,
  i,
  media,
  nuestra,
  x,
  ancho,
  valorC,
  met,
  medir,
}: {
  liga: Liga;
  i: number;
  media: number;
  nuestra: boolean;
  x: (v: number) => number;
  ancho: number;
  valorC: number | null;
  met: Metrica;
  medir?: RefObject<HTMLDivElement | null>;
}) {
  const alto = 30;
  const descripcion = `${liga.nombre}: media ${formatea(media, met.dec, met.unidad)}`;
  return (
    <>
      <span className={`truncate text-[12px] ${nuestra ? "font-semibold text-[color:var(--rmcf-gold-ink)]" : "text-white/75"}`}>{liga.corto}</span>
      <div ref={medir} className="min-w-0">
        <svg width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={descripcion} className="block overflow-visible">
          <line x1={0} x2={ancho} y1={alto / 2} y2={alto / 2} stroke={tinta(0.12)} />
          {liga.equipos.map((e) =>
            typeof e.v[i] === "number" ? (
              <circle key={e.nombre} cx={x(e.v[i] as number)} cy={alto / 2} r={e.nombre === CASTILLA ? 6 : 4} fill={e.nombre === CASTILLA ? ORO : tinta(0.35)} stroke={e.nombre === CASTILLA ? tinta(0.9) : "none"}>
                <title>{`${e.nombre}: ${formatea(e.v[i], met.dec, met.unidad)} (${e.pj} partidos)`}</title>
              </circle>
            ) : null,
          )}
          <line x1={x(media)} x2={x(media)} y1={4} y2={alto - 4} stroke={tinta(0.85)} strokeWidth={2} />
          {valorC !== null && !nuestra && <line x1={x(valorC)} x2={x(valorC)} y1={2} y2={alto - 2} stroke={ORO} strokeWidth={1.5} strokeDasharray="3 3" />}
        </svg>
      </div>
      <span className="text-right text-[12px] tabular-nums text-white/80">{formatea(media, met.dec, met.unidad)}</span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  EQUIPOS PARECIDOS                                                  */
/* ------------------------------------------------------------------ */

function Parecidos({ ligas }: { ligas: Liga[] }) {
  const [liga, setLiga] = useState(NUESTRA_LIGA);
  const [equipo, setEquipo] = useState(CASTILLA);
  const laLiga = ligas.find((l) => l.slug === liga) ?? ligas[0];
  const elEquipo = laLiga?.equipos.some((e) => e.nombre === equipo) ? equipo : (laLiga?.equipos[0]?.nombre ?? "");
  const lista = useMemo(() => (laLiga ? parecidos(ligas, laLiga.slug, elEquipo, 12) : []), [ligas, laLiga, elEquipo]);
  const nombreDe = (id: string) => METRICAS[indiceDe(id)]?.nombre.toLowerCase() ?? id;
  const fuera = lista.filter((p) => p.liga.slug !== laLiga?.slug);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <Select
          label="Liga"
          value={laLiga?.slug ?? ""}
          onChange={(v) => {
            setLiga(v);
            setEquipo(ligas.find((l) => l.slug === v)?.equipos[0]?.nombre ?? "");
          }}
          options={ligas.map((l) => ({ value: l.slug, label: l.nombre }))}
        />
        <Select label="Equipo" value={elEquipo} onChange={setEquipo} options={(laLiga?.equipos ?? []).map((e) => ({ value: e.nombre, label: e.nombre }))} />
      </div>

      <Lamina>
        <TituloConclusion
          pregunta={`¿Quién juega como ${elEquipo}?`}
          fuente="Por estilo: posesión, elaboración, ritmo, juego largo, profundidad, centros, presión (PPDA y recuperaciones altas), duelos, faltas, contras, llegada al área y tiros a favor y en contra. Sin goles ni resultados. Cada métrica se compara en desviaciones respecto a todos los equipos de todas las ligas."
        >
          {fuera[0] ? `El más parecido fuera de su liga: ${fuera[0].equipo.nombre} (${fuera[0].liga.corto}), ${fuera[0].parecido} % de parecido` : "Equipos parecidos"}
        </TituloConclusion>

        <ol className="grid gap-2">
          {lista.map((p, n) => (
            <li key={`${p.liga.slug}-${p.equipo.nombre}`} className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-x-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <span className="pt-0.5 text-[12px] tabular-nums text-white/45">{n + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-white">
                  {p.equipo.nombre} <span className="text-[12px] font-normal text-white/55">· {p.liga.corto}</span>
                </span>
                <span className="block text-[12px] text-white/60">
                  Igual en {p.igual.map(nombreDe).join(", ")}; lo que más los separa: {p.distinto.map(nombreDe).join(" y ")}.
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-[14px] font-bold tabular-nums text-[color:var(--rmcf-gold-ink)]">{p.parecido} %</span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${p.parecido}%`, background: ORO }} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Lamina>
    </div>
  );
}
