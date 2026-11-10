"use client";

/**
 * DATOS DEL RIVAL (Scout colectivo, 10/11/2026). Fase 2 de «por pregunta,
 * no por proveedor»: para la previa ya no hay que ir a Data análisis y luego a
 * Opta. Juntos, para el rival de la jornada:
 *
 * 1. «Un equipo de un vistazo» de Wyscout (`PanelEquipo`, el mismo de Data
 *    análisis, con el equipo fijado).
 * 2. De Opta: la radiografía, su fila de «quién aprieta y cuándo» por franjas
 *    de 15′ (`momentumLiga`), su evolución jornada a jornada en seis métricas
 *    contra sus rivales y su grupo, y sus remates a favor y en contra.
 * 3. Enlaces a Duelos y a ABP del rival con el mismo equipo.
 *
 * EL CRUCE no se inventa: Opta por `casaEquipo` (lib/opta-eventos.ts) y
 * Wyscout por `mismoClub`, lo mismo que usa «Un equipo de un vistazo» para
 * el próximo rival. Si el rival no cruza con una fuente, o en Opta no es del
 * grupo del Castilla, ese bloque no se pinta.
 *
 * QUIÉN MANDA cuando la misma cifra sale en las dos: Opta para xG, remates,
 * PPDA, ABP, estilo y momentum; Wyscout para perfil, duelos y sistema. La
 * otra va en pequeño como «2.ª lectura», nunca como dos cifras iguales.
 *
 * PESO: nada se pide hasta que la sección asoma en pantalla; entonces Wyscout
 * (/api/data-analisis) y los documentos ligeros de Opta. El momento (≈1 MB) y
 * los remates (≈3 MB) sólo al abrir su pestaña.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Flame, Swords } from "lucide-react";

import { PanelEquipo } from "@/components/data/PanelEquipo";
import { Hueso } from "@/components/ui/estados";
import { Botonera, Panel } from "@/app/opta/_piezas/comun";
import { colorCalor } from "@/app/opta/_piezas/EstilosMomentum";
import { Radiografia } from "@/app/opta/_piezas/EstilosRadiografia";
import { Leyenda as LeyendaEvolucion, MiniEvolucion, nombreDeMetrica } from "@/app/opta/_piezas/Evolucion";
import { MapaRemates } from "@/app/opta/_piezas/Remates";
import { equiposDe, nombreDe, useMomento, useRemates } from "@/app/opta/_piezas/eventos";
import { useOpta, type DatosOpta } from "@/app/opta/_piezas/useOpta";
import { traeJson } from "@/lib/hojaCsv";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import { METRICA_POR_KEY, formatea, temporadaDe, valorEnGrupo } from "@/lib/data-analisis/metricas";
import { CASTILLA_OPTA, percentil } from "@/lib/opta";
import { valorEquipo } from "@/lib/opta-analisis";
import { FRANJAS, momentumLiga } from "@/lib/opta-estilos";
import { casaEquipo, enArea } from "@/lib/opta-eventos";
import { defDe, metricasPartido, partidosPorEquipo, serieEvolucion, type Modo } from "@/lib/opta-evolucion";
import { mismoClub } from "@/lib/rivals/mismoClub";

/**
 * Las métricas de Wyscout que aquí son «2.ª lectura» porque manda Opta:
 * xG, remates, PPDA, balón parado y posesión (estilo).
 */
export const SEGUNDA_LECTURA_WYSCOUT: ReadonlySet<string> = new Set([
  "xg",
  "golesMenosXg",
  "xgPorTiro",
  "tiros",
  "tirosPuerta",
  "tirosContra",
  "tirosContraPuerta",
  "xgContra",
  "xgContraPorTiro",
  "ppda",
  "posesion",
  "abp",
  "abpRemate",
  "corners",
  "cornersRemate",
  "faltasTiro",
  "faltasRemate",
  "penaltis",
  "cuotaRematesAbp",
]);

/** Las seis de la evolución: peligro a favor y en contra, volumen, presión, área y balón. */
const EVOLUCION = ["ExpG", "ExpGAg", "ShtIncBl", "PPDA", "TouchOpBox", "Poss%"];

/** Las cuatro cifras de cabecera: Opta manda y Wyscout es la segunda lectura. */
const CIFRAS: { a: string; wys: string; nombre: string; inverso?: boolean; estilo?: boolean }[] = [
  { a: "ExpG", wys: "xg", nombre: "xG a favor por partido" },
  { a: "ExpGAg", wys: "xgContra", nombre: "xG en contra por partido", inverso: true },
  { a: "ShtIncBl", wys: "tiros", nombre: "Remates por partido" },
  { a: "PPDA", wys: "ppda", nombre: "PPDA", estilo: true },
];

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

/*
| TODO-SELLO: cuando llegue `components/ui/SelloFuente.tsx` (y `lib/fuentes.ts`),
| cambiar este <span> por el sello común. Va pequeño, por bloque, nunca en el
| título.
*/
function Sello({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
      {children}
    </span>
  );
}

type Pestana = "vistazo" | "estilo" | "evolucion" | "remates";

type RespuestaWyscout = { ok?: boolean; partidos?: FilaPartido[]; jugadores?: FilaJugador[] };

/** Lo de Wyscout que usa Data análisis, pedido una vez y con la copia del aparato. */
function useWyscout() {
  const [datos, setDatos] = useState<{ liga: FilaPartido[]; jugadores: FilaJugador[] } | null>(null);
  useEffect(() => {
    let vivo = true;
    traeJson<RespuestaWyscout>("/api/data-analisis")
      .then((r) => {
        if (!vivo) return;
        const partidos = r?.ok ? r.partidos ?? [] : [];
        /* La temporada en curso, todas sus competiciones: lo mismo que abre Data análisis. */
        const actual = [...new Set(partidos.map((p) => temporadaDe(p.fecha)))].filter(Boolean).sort().reverse()[0] ?? "";
        setDatos({ liga: partidos.filter((p) => temporadaDe(p.fecha) === actual), jugadores: r?.jugadores ?? [] });
      })
      .catch(() => {
        if (vivo) setDatos({ liga: [], jugadores: [] });
      });
    return () => {
      vivo = false;
    };
  }, []);
  return { wys: datos, cargando: datos === null };
}

export function DatosDelRival({ equipo, rivalId }: { equipo: string; rivalId?: string }) {
  const caja = useRef<HTMLElement>(null);
  const [abierto, setAbierto] = useState(false);

  /* Nada se pide hasta que la sección asoma (con margen, para que llegue a tiempo). */
  useEffect(() => {
    const el = caja.current;
    if (!el || abierto) return;
    const io = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setAbierto(true);
    }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [abierto]);

  const q = `equipo=${encodeURIComponent(equipo)}${rivalId ? `&rival=${encodeURIComponent(rivalId)}` : ""}`;

  return (
    <section ref={caja} id="datos-rival" aria-label="Datos del rival" className="mt-12 min-w-0 scroll-mt-20" data-export-hide>
      <div className="flex flex-col gap-3 rounded-2xl border-l-4 border-[#C8A96B] bg-white/[0.03] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">Datos del rival</h2>
          <p className="text-sm text-white/50">Cómo juega {equipo}, con las cifras de la categoría.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/duelos?${q}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
          >
            <Swords size={14} /> Duelos
          </Link>
          <Link
            href={`/scout-rival-abp?${q}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
          >
            <Flame size={14} /> ABP del rival
          </Link>
        </div>
      </div>

      {abierto ? (
        <Contenido key={equipo} equipo={equipo} />
      ) : (
        <div className="mt-4 space-y-3" role="status" aria-label="Cargando los datos del rival">
          <Hueso className="h-24 w-full" />
          <Hueso className="h-72 w-full" />
        </div>
      )}
    </section>
  );
}

function Contenido({ equipo }: { equipo: string }) {
  const { wys, cargando: cargaWys } = useWyscout();
  const { datos: opta, cargando: cargaOpta } = useOpta();
  const [pestana, setPestana] = useState<Pestana>("vistazo");

  /* Wyscout: el equipo de la descarga que es el mismo club (como «Un equipo de un vistazo»). */
  const equipoWys = useMemo(() => {
    if (!wys) return "";
    const nombres = [...new Set(wys.liga.map((f) => f.equipo))];
    return nombres.find((e) => e === equipo) ?? nombres.find((e) => mismoClub(e, equipo)) ?? "";
  }, [wys, equipo]);

  /* Opta: por `casaEquipo` y sólo si es de nuestro grupo. */
  const idOpta = useMemo(() => {
    if (!opta || !opta.equipos.length) return "";
    const id = casaEquipo(equipo, equiposDe(opta));
    if (!id || id === CASTILLA_OPTA) return "";
    return opta.grupos.get(id) === opta.grupos.get(CASTILLA_OPTA) ? id : "";
  }, [opta, equipo]);

  const hayWys = cargaWys || !!equipoWys;
  const hayOpta = cargaOpta || !!idOpta;

  const pestanas = ([
    { clave: "vistazo", nombre: "De un vistazo", hay: hayWys },
    { clave: "estilo", nombre: "Estilo y momentos", hay: hayOpta },
    { clave: "evolucion", nombre: "Jornada a jornada", hay: hayOpta },
    { clave: "remates", nombre: "Remates", hay: hayOpta },
  ] as { clave: Pestana; nombre: string; hay: boolean }[]).filter((p) => p.hay);
  const vista = pestanas.some((p) => p.clave === pestana) ? pestana : pestanas[0]?.clave;

  /* Lo que la cabecera de cada bloque dice de su fuente. */
  const selloOpta = useMemo(() => {
    if (!opta || !idOpta) return "";
    const g = opta.grupos.get(idOpta);
    const enGrupo = opta.equipos.filter((f) => opta.grupos.get(String(f.teamId ?? "")) === g).length;
    const jugados = opta.partidos.filter((f) => f.teamId === idOpta).length;
    return `Opta · grupo de ${enGrupo}${jugados ? ` · J${jugados}` : ""}`;
  }, [opta, idOpta]);
  const selloWys = useMemo(() => {
    if (!wys || !equipoWys) return "";
    const suyas = wys.liga.filter((f) => f.equipo === equipoWys);
    const comp = suyas[0]?.competicion ?? "";
    const equipos = new Set(wys.liga.filter((f) => f.competicion === comp).map((f) => f.equipo)).size;
    return `Wyscout · grupo de ${equipos} · J${suyas.length}`;
  }, [wys, equipoWys]);

  if (!cargaWys && !cargaOpta && !equipoWys && !idOpta) return null;

  return (
    <div className="mt-4 min-w-0 space-y-4">
      {cargaOpta ? (
        <Hueso className="h-24 w-full" />
      ) : (
        opta && idOpta && <CifrasClave opta={opta} teamId={idOpta} wys={wys?.liga.filter((f) => f.equipo === equipoWys) ?? []} sello={selloOpta} />
      )}

      {pestanas.length > 1 && (
        <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
          <Botonera etiqueta="Qué mirar del rival" valor={vista ?? "vistazo"} alCambiar={setPestana} opciones={pestanas.map(({ clave, nombre }) => ({ clave, nombre }))} />
        </div>
      )}

      {vista === "vistazo" &&
        (cargaWys || !wys ? (
          <Hueso className="h-96 w-full" />
        ) : (
          <div className="min-w-0">
            <div className="flex justify-end">
              <Sello>{selloWys}</Sello>
            </div>
            <PanelEquipo liga={wys.liga} jugadores={wys.jugadores} fijo={equipoWys} segundaLectura={idOpta ? SEGUNDA_LECTURA_WYSCOUT : undefined} />
          </div>
        ))}

      {vista !== "vistazo" && (cargaOpta || !opta) && <Hueso className="h-96 w-full" />}
      {vista === "estilo" && opta && idOpta && (
        <div className="min-w-0 space-y-4">
          <Momentos opta={opta} teamId={idOpta} sello={selloOpta} />
          <div className="min-w-0">
            <div className="mb-2 flex justify-end">
              <Sello>{selloOpta}</Sello>
            </div>
            <Radiografia datos={opta} teamId={idOpta} />
          </div>
        </div>
      )}
      {vista === "evolucion" && opta && idOpta && <EvolucionRival opta={opta} teamId={idOpta} sello={selloOpta} />}
      {vista === "remates" && opta && idOpta && <RematesRival opta={opta} teamId={idOpta} sello={selloOpta} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LAS CUATRO CIFRAS (Opta manda, Wyscout segunda lectura)            */
/* ------------------------------------------------------------------ */

function CifrasClave({ opta, teamId, wys, sello }: { opta: DatosOpta; teamId: string; wys: FilaPartido[]; sello: string }) {
  const { equipos, grupos, catalogo } = opta;
  const fila = equipos.find((f) => f.teamId === teamId);
  const delGrupo = useMemo(() => equipos.filter((f) => grupos.get(String(f.teamId ?? "")) === grupos.get(teamId)), [equipos, grupos, teamId]);
  if (!fila) return null;

  const cifras = CIFRAS.map((c) => {
    const v = valorEquipo(fila, c.a, "partido", catalogo);
    if (v == null) return null;
    const muestra = delGrupo.map((f) => valorEquipo(f, c.a, "partido", catalogo));
    /* PPDA es estilo: se dice el puesto de los que más aprietan (menos PPDA), no un «mejor». */
    const puesto = muestra.filter((x): x is number => x != null && (c.estilo ? x < v : x > v)).length + 1;
    const p = c.estilo ? null : percentil(v, muestra, c.inverso);
    const met = METRICA_POR_KEY.get(c.wys);
    const otra = met && wys.length ? valorEnGrupo(met, wys, "promedio") : null;
    return { ...c, v, p, puesto, de: muestra.filter((x) => x != null).length, otra: otra != null ? formatea(otra, met!.unidad) : "" };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  if (!cifras.length) return null;

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Las cifras que más se preguntan</p>
        <Sello>{sello}</Sello>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cifras.map((c) => (
          <div key={c.a} className="min-w-0">
            <p className="truncate text-[11px] text-white/55" title={defDe(c.a, catalogo).que}>{c.nombre}</p>
            <p className="text-2xl font-semibold tabular-nums text-white">{coma(c.v, c.a === "PPDA" ? 1 : c.a === "ShtIncBl" ? 1 : 2)}</p>
            <p className="text-[11px] text-white/50">
              {c.estilo ? `${c.puesto}.º que más aprieta de ${c.de}` : c.p != null ? `P${c.p} en su grupo` : ""}
            </p>
            {c.otra && <p className="mt-0.5 text-[10px] text-white/35">2.ª lectura · Wyscout {c.otra}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  QUIÉN APRIETA Y CUÁNDO (su fila de momentumLiga)                   */
/* ------------------------------------------------------------------ */

function Momentos({ opta, teamId, sello }: { opta: DatosOpta; teamId: string; sello: string }) {
  /* Sólo el momento (≈1 MB): las franjas no necesitan los remates. */
  const { momento, cargando } = useMomento();
  const filas = useMemo(() => momentumLiga(momento, []), [momento]);
  const g = opta.grupos.get(teamId);
  const grupo = useMemo(() => filas.filter((f) => opta.grupos.get(f.teamId) === g), [filas, opta.grupos, g]);
  const suya = grupo.find((f) => f.teamId === teamId);

  if (cargando) return <Hueso className="h-40 w-full" />;
  if (!suya || suya.dominio == null) return null;

  const nombre = nombreDe(teamId, suya.equipo);
  const pDominio = percentil(suya.dominio, grupo.map((f) => f.dominio));
  const fuerte = suya.fuerte != null ? FRANJAS[suya.fuerte].nombre : "";
  const flojo = suya.flojo != null && suya.flojo !== suya.fuerte ? FRANJAS[suya.flojo].nombre : "";

  return (
    <Panel
      titulo="Quién aprieta y cuándo"
      subtitulo={`Parte de los minutos en que ${nombre} es el que aprieta (más xG y más toques en el área que el rival en ese rato), por franjas de 15′. El color, contra su grupo.`}
      derecha={<Sello>{sello}</Sello>}
    >
      <p className="mb-3 text-[15px] font-semibold text-white">
        {fuerte && `Aprieta más entre el ${fuerte}′`}
        {fuerte && flojo && `, menos en el ${flojo}′`}
        {fuerte && "."} Domina el {Math.round(suya.dominio * 100)} % de los minutos{pDominio != null ? ` (P${pDominio} del grupo)` : ""}.
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {FRANJAS.map((fr, i) => {
          const v = suya.franjas[i];
          const p = v == null ? null : percentil(v, grupo.map((f) => f.franjas[i] ?? null));
          return (
            <div
              key={fr.clave}
              className={`min-w-0 rounded-xl border px-2 py-2 text-center ${i === suya.fuerte ? "border-[#C8A96B]/60" : "border-white/10"}`}
              style={{ background: colorCalor(p) }}
              title={p != null ? `P${p} del grupo en esa franja` : undefined}
            >
              <p className="text-[11px] text-white/60">{fr.nombre}′</p>
              <p className="text-lg font-semibold tabular-nums text-white">{v != null ? `${Math.round(v * 100)} %` : ""}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/45">
        El descuento de la primera parte cae en el 46-60′: con el reloj de Opta no se puede separar. {suya.partidos} partidos.
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  JORNADA A JORNADA                                                  */
/* ------------------------------------------------------------------ */

function EvolucionRival({ opta, teamId, sello }: { opta: DatosOpta; teamId: string; sello: string }) {
  const { partidos, grupos, catalogo } = opta;
  const [modo, setModo] = useState<Modo>("partido");
  const porEquipo = useMemo(() => partidosPorEquipo(partidos), [partidos]);
  const disponibles = useMemo(() => new Set(metricasPartido(partidos, catalogo)), [partidos, catalogo]);
  const metricas = EVOLUCION.filter((a) => disponibles.has(a));
  const g = grupos.get(teamId);
  const muestra = useMemo(() => new Set([...porEquipo.keys()].filter((id) => grupos.get(id) === g)), [porEquipo, grupos, g]);
  const suyos = porEquipo.get(teamId) ?? [];
  const nombre = nombreDe(teamId, String(opta.equipos.find((f) => f.teamId === teamId)?.equipo ?? ""));
  if (!suyos.length || !metricas.length) return null;

  return (
    <Panel
      titulo="Jornada a jornada"
      subtitulo={`Seis cifras partido a partido: ${nombre}, sus rivales en esos mismos partidos y la media de su grupo en esa jornada (su partido n.º 1, 2, 3…).`}
      derecha={
        <>
          <Sello>{sello}</Sello>
          <Botonera
            etiqueta="Cómo se cuenta"
            valor={modo}
            alCambiar={setModo}
            opciones={[
              { clave: "partido", nombre: "Por partido" },
              { clave: "acumulado", nombre: "Acumulado" },
            ]}
          />
        </>
      }
    >
      <LeyendaEvolucion nombre={nombre} liga="su grupo" modo={modo} />
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metricas.map((a) => (
          <MiniEvolucion
            key={a}
            nombre={nombreDeMetrica(a, opta)}
            def={defDe(a, catalogo)}
            serie={serieEvolucion(porEquipo, teamId, a, muestra, modo, catalogo)}
            equipo={nombre}
          />
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  REMATES A FAVOR Y EN CONTRA                                        */
/* ------------------------------------------------------------------ */

const deDentro = (rs: { x: number; y: number }[]) => (rs.length ? rs.filter((r) => enArea(r.x, r.y)).length / rs.length : null);

function RematesRival({ opta, teamId, sello }: { opta: DatosOpta; teamId: string; sello: string }) {
  /* Los remates (≈3 MB), sólo aquí. */
  const { remates, cargando, hay } = useRemates(opta);
  const g = opta.grupos.get(teamId);
  const suyos = useMemo(() => remates.filter((r) => r.teamId === teamId), [remates, teamId]);
  const contra = useMemo(() => remates.filter((r) => r.rivalId === teamId), [remates, teamId]);
  const delGrupo = useMemo(() => remates.filter((r) => opta.grupos.get(r.teamId) === g), [remates, opta.grupos, g]);
  const nombre = nombreDe(teamId, String(opta.equipos.find((f) => f.teamId === teamId)?.equipo ?? ""));

  if (cargando) return <Hueso className="h-96 w-full" />;
  if (!hay || (!suyos.length && !contra.length)) return null;

  const pct = (v: number | null) => (v == null ? "" : `${Math.round(v * 100)} %`);
  const fav = deDentro(suyos);
  const enc = deDentro(contra);
  const media = deDentro(delGrupo);
  const frase = [
    fav != null ? `El ${pct(fav)} de sus remates sale de dentro del área` : "",
    enc != null ? `le rematan desde dentro el ${pct(enc)}` : "",
  ]
    .filter(Boolean)
    .join("; ");

  return (
    <Panel
      titulo="Dónde rematan y desde dónde les rematan"
      subtitulo={`Cada remate de la temporada en su sitio; el tamaño, su xG. Pincha un punto para ver el remate.`}
      derecha={<Sello>{sello}</Sello>}
    >
      {frase && (
        <p className="mb-3 text-[15px] font-semibold text-white">
          {frase}.{media != null && <span className="font-normal text-white/55"> En su grupo, de dentro sale el {pct(media)}.</span>}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {suyos.length > 0 && (
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-semibold text-white">A favor · dónde remata {nombre}</h3>
            <MapaRemates remates={suyos} ariaLabel={`Mapa de remates de ${nombre}`} maxAlto={380} />
          </div>
        )}
        {contra.length > 0 && (
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-semibold text-white">En contra · desde dónde le rematan</h3>
            <MapaRemates remates={contra} enContra ariaLabel={`Mapa de remates contra ${nombre}`} maxAlto={380} />
          </div>
        )}
      </div>
    </Panel>
  );
}
