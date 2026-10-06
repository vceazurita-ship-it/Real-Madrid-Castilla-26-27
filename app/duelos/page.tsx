"use client";

/**
 * Duelos (06/10/2026): nuestro once contra el once probable del rival.
 *
 * - **Nuestro once** se propone solo con los minutos de Wyscout (el mismo
 *   motor que el once de DATA, `proponeOnce`, en 4-2-3-1) y se cambia hueco a
 *   hueco.
 * - **El suyo** sale de Plantillas rivales: el once probable marcado allí; si
 *   nadie lo ha marcado, su último once de BeSoccer; y si tampoco hay, los de
 *   más minutos. También se cambia hueco a hueco.
 * - Lo que se cambia a mano se guarda por rival (`duelos:<rival>`), y el once
 *   marcado en Plantillas **no se toca** desde aquí.
 *
 * El modelo —qué duelos, con qué métricas y cómo se decide la ventaja— vive
 * en `lib/duelos.ts`.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, CircleDot, Loader2, RotateCcw, Swords } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { MEJOR, ORO, PEOR, tinta, useEscudos } from "@/components/data/graficas";
import { usePlayers } from "@/hooks/usePlayers";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { traeJson } from "@/lib/hojaCsv";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { slugClave } from "@/lib/rivals/media";
import { normalizarOnce, rivalOnceKey } from "@/lib/rivals/once";
import { findInforme, type InformeDoc } from "@/lib/rivals/informe";
import { PUESTOS } from "@/lib/data-analisis/individual";
import { HUECOS } from "@/lib/data-analisis/once";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { baseSuyaDe, nuestrosDe, onceNuestroDe, onceSuyoDe, suyosDe } from "@/lib/duelos-onces";
import {
  DUELOS_VACIO,
  HUECO_VACIO,
  UMBRAL_DUELO,
  ZONAS,
  mideDuelos,
  normalizaDuelos,
  rotuloColumna,
  referenciasPorPuesto,
  type DuelosDoc,
  type JugadorDuelo,
  type ResultadoDuelo,
  type Veredicto,
} from "@/lib/duelos";

type Fila = Record<string, unknown>;
type PartidoCal = { jornada?: number; cuando: string; local: string; visitante: string };

const texto = (v: unknown) => String(v ?? "").trim();

const COLOR: Record<Veredicto, string> = {
  ventaja: MEJOR,
  desventaja: PEOR,
  parejo: "#C8A96B",
  "sin-datos": "rgba(255,255,255,0.25)",
};

const ROTULO: Record<Veredicto, string> = {
  ventaja: "Ventaja",
  desventaja: "Desventaja",
  parejo: "Parejo",
  "sin-datos": "Sin datos",
};

const apellido = (nombre: string) => {
  const t = nombre.trim().split(/\s+/);
  return t.length > 1 ? t.slice(1).join(" ") : nombre;
};

async function leeDoc<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent(key)}`, { cache: "no-store" });
    const j = (await r.json()) as { data?: T | null };
    return j?.data ?? null;
  } catch {
    return null;
  }
}

function Foto({ src, nombre, size = 32, borde }: { src?: string; nombre: string; size?: number; borde?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- fotos propias y de BeSoccer, ya recortadas
    <img
      src={src}
      alt={nombre}
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-white/5 object-cover object-top"
      style={{ width: size, height: size, boxShadow: borde ? `0 0 0 2px ${borde}` : undefined }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-white/50"
      style={{ width: size, height: size, boxShadow: borde ? `0 0 0 2px ${borde}` : undefined }}
    >
      {nombre.slice(0, 1)}
    </span>
  );
}

export default function DuelosPage() {
  const { players } = usePlayers();
  const escudoDe = useEscudos();

  const [jugadores, setJugadores] = useState<FilaJugador[] | null>(null);
  const [plantillasLeidas, setPlantillas] = useState<Fila[] | null>(null);
  const plantillas = useMemo(() => plantillasLeidas ?? [], [plantillasLeidas]);
  const [informes, setInformes] = useState<InformeDoc | null>(null);
  const [proximo, setProximo] = useState<{ rival: string; cuando: string; jornada?: number } | null>(null);
  const [equipo, setEquipo] = useState("");
  const [onceMarcado, setOnceMarcado] = useState<string[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const control = new AbortController();
    fetch("/api/data-analisis", { signal: control.signal })
      .then((r) => r.json())
      .then((r: { ok: boolean; jugadores?: FilaJugador[]; error?: string }) => {
        setJugadores(r.jugadores ?? []);
        if (!r.ok) setError(r.error ?? "No se han podido leer los datos de Wyscout.");
      })
      .catch(() => {
        if (!control.signal.aborted) {
          setJugadores([]);
          setError("No se han podido leer los datos de Wyscout.");
        }
      });
    traeJson<Fila[]>("/api/rivals?action=rivalesPlantillas")
      .then((d) => setPlantillas(Array.isArray(d) ? d : []))
      .catch(() => setPlantillas([]));
    leeDoc<InformeDoc>("rivals:informe").then(setInformes);
    leeDoc<{ partidos?: PartidoCal[] }>("castilla:calendario").then((cal) => {
      const hoy = new Date().toISOString().slice(0, 10);
      const siguiente = (cal?.partidos ?? [])
        .filter((p) => p.cuando && p.cuando.slice(0, 10) >= hoy)
        .sort((a, b) => a.cuando.localeCompare(b.cuando))[0];
      if (siguiente) {
        const rival = /castilla/i.test(siguiente.local) ? siguiente.visitante : siguiente.local;
        setProximo({ rival, cuando: siguiente.cuando, jornada: siguiente.jornada });
      }
    });
    return () => control.abort();
  }, []);

  /* Los equipos de Plantillas rivales; por defecto, el del próximo partido. */
  const equipos = useMemo(
    () => [...new Set(plantillas.map((f) => texto(f.NOMBRE_EQUIPO)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [plantillas],
  );
  const equipoVisto = equipo || (proximo ? equipos.find((e) => mismoClub(e, proximo.rival)) ?? "" : "") || equipos[0] || "";

  /* El once marcado en Plantillas rivales (sólo se lee). */
  useEffect(() => {
    if (!equipoVisto) return;
    let vivo = true;
    leeDoc<unknown>(rivalOnceKey(equipoVisto)).then((d) => {
      if (vivo) setOnceMarcado(normalizarOnce(d).titulares);
    });
    return () => {
      vivo = false;
    };
  }, [equipoVisto]);

  /* Lo cambiado a mano, por rival. */
  const { value: guardado, setValue: setGuardado } = useRemoteDoc<DuelosDoc>({
    key: `duelos:${slugClave(equipoVisto || "sin-equipo")}`,
    kind: "duelos",
    fallback: DUELOS_VACIO,
    debounce: 400,
  });
  const aMano = useMemo(() => normalizaDuelos(guardado), [guardado]);

  const referencias = useMemo(() => referenciasPorPuesto(jugadores ?? []), [jugadores]);

  /* Los dos onces se arman en lib/duelos-onces.ts, el mismo código que usa el informe del partido. */
  const nuestros = useMemo(() => nuestrosDe(jugadores ?? [], players), [jugadores, players]);
  const suyos = useMemo(() => suyosDe(plantillas, equipoVisto, jugadores ?? []), [plantillas, equipoVisto, jugadores]);
  const baseSuya = useMemo(
    () => baseSuyaDe(suyos, onceMarcado, findInforme(informes, equipoVisto)),
    [suyos, onceMarcado, informes, equipoVisto],
  );
  const onceNuestro = useMemo(() => onceNuestroDe(nuestros, aMano.nuestro), [nuestros, aMano.nuestro]);
  const onceSuyo = useMemo(() => onceSuyoDe(suyos, baseSuya.lista, aMano.suyo), [suyos, baseSuya, aMano.suyo]);

  const duelos = useMemo(() => mideDuelos(onceNuestro, onceSuyo, referencias), [onceNuestro, onceSuyo, referencias]);

  /*
  | QUIÉN TIENE EL BALÓN (06/10/2026). Se puede mirar cada duelo con el balón
  | nuestro, con el suyo o con los dos: el campo, las cajas y las tarjetas se
  | pintan con la cifra de ese momento, y cada bloque dice arriba quién lo tiene.
  */
  const [modo, setModo] = useState<Modo>("ambos");

  const duelosVistos = useMemo(() => {
    const enModo = (d: ResultadoDuelo): ResultadoDuelo => {
      const parejas = d.parejas.map(enModo);
      if (modo === "ambos") return { ...d, parejas };
      const balance = modo === "nuestro" ? d.conBalon : d.sinBalon;
      const veredicto: Veredicto =
        !d.nuestros.length || !d.suyos.length || balance === null
          ? "sin-datos"
          : balance >= UMBRAL_DUELO
            ? "ventaja"
            : balance <= -UMBRAL_DUELO
              ? "desventaja"
              : "parejo";
      return { ...d, balance, veredicto, parejas };
    };
    return duelos.map(enModo);
  }, [duelos, modo]);

  const cambia = (lado: "nuestro" | "suyo", hueco: string, clave: string) =>
    setGuardado((actual) => {
      const n = normalizaDuelos(actual);
      const otro = Object.fromEntries(Object.entries(n[lado]).filter(([h, c]) => h !== hueco && (c !== clave || clave === HUECO_VACIO)));
      return { ...n, [lado]: clave ? { ...otro, [hueco]: clave } : otro };
    });
  const deshaz = (lado: "nuestro" | "suyo") => setGuardado((actual) => ({ ...normalizaDuelos(actual), [lado]: {} }));

  const conDato = duelos.filter((d) => d.veredicto !== "sin-datos");
  /*
  | Las dos cajas leen cada duelo por su lado (06/10/2026): «dónde les podemos
  | hacer daño» es nuestro con balón contra su sin balón; «dónde nos lo pueden
  | hacer», su con balón contra nuestro sin balón. Un duelo puede estar en las
  | dos: el lateral que les desborda y al que también le desbordan.
  */
  const atacar = duelos.filter((d) => (d.conBalon ?? 0) >= UMBRAL_DUELO).sort((a, b) => (b.conBalon ?? 0) - (a.conBalon ?? 0));
  const vigilar = duelos.filter((d) => (d.sinBalon ?? 0) <= -UMBRAL_DUELO).sort((a, b) => (a.sinBalon ?? 0) - (b.sinBalon ?? 0));

  const cargando = jugadores === null || plantillasLeidas === null;
  const escudo = equipoVisto ? escudoDe(equipoVisto) : null;

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />

          <section className="px-4 pb-12 pt-6 sm:px-8 sm:pt-10">
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">RMCF CASTILLA · COMPETICIÓN</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Swords className="h-7 w-7 text-[#C8A96B]" />
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Duelos</h1>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-white/55">
              Nuestro once contra el once probable del rival, duelo a duelo: dónde les podemos hacer daño y dónde nos lo pueden
              hacer. Cada jugador se mide contra los de su puesto en la categoría (Wyscout, esta temporada).
            </p>

            <div className="sticky top-[81px] z-20 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-b border-white/[0.06] bg-[#0B0F14]/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-8 sm:px-8 md:top-[97px]">
              <span className="text-[11px] uppercase tracking-wider text-white/35">Rival</span>
              {escudo && (
                // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
                <img src={escudo} alt="" className="h-6 w-6 object-contain" />
              )}
              <select
                value={equipoVisto}
                onChange={(e) => {
                  setEquipo(e.target.value);
                  setOnceMarcado(null);
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white"
              >
                {equipos.map((e) => (
                  <option key={e} value={e} className="bg-[#11161C]">
                    {e}
                    {proximo && mismoClub(e, proximo.rival) ? " · próximo partido" : ""}
                  </option>
                ))}
              </select>
              {proximo && mismoClub(equipoVisto, proximo.rival) && (
                <span className="text-xs text-white/45">
                  {proximo.jornada ? `J${proximo.jornada} · ` : ""}
                  {new Date(proximo.cuando).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                </span>
              )}
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-0.5" role="group" aria-label="Quién tiene el balón">
                {(
                  [
                    { key: "nuestro", label: "Balón: Castilla", color: "#C8A96B" },
                    { key: "suyo", label: `Balón: ${equipoVisto || "rival"}`, color: "#F29A8C" },
                    { key: "ambos", label: "Los dos", color: "#FFFFFF" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={modo === o.key}
                    onClick={() => setModo(o.key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${modo === o.key ? "bg-white/10" : "text-white/50 hover:text-white"}`}
                    style={modo === o.key ? { color: o.color } : undefined}
                  >
                    <CircleDot size={12} />
                    {o.label}
                  </button>
                ))}
              </div>
              <span className="ml-auto flex items-center gap-3 text-xs">
                <span style={{ color: MEJOR }} title="Duelos en los que, con el balón nuestro, les sacamos ventaja">
                  ● {atacar.length} para atacar
                </span>
                <span style={{ color: PEOR }} title="Duelos en los que, con el balón suyo, nos sacan ventaja">
                  ● {vigilar.length} para vigilar
                </span>
                <span className="text-white/40" title="Duelos medidos (con datos en los dos lados)">
                  de {conDato.length} medidos
                </span>
              </span>
            </div>

            {cargando ? (
              <p className="mt-10 flex items-center gap-2 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando Wyscout y las plantillas rivales…
              </p>
            ) : plantillas.length === 0 ? (
              <p className="mt-10 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                No se han podido leer las plantillas rivales (la hoja RIVALES no ha contestado). Prueba a recargar en un minuto.
              </p>
            ) : error && !jugadores?.length ? (
              <p className="mt-10 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
            ) : (
              <>
                <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">
                        El campo: nosotros atacamos hacia la derecha
                        <span className="ml-2 text-xs font-normal" style={{ color: modo === "nuestro" ? "#C8A96B" : modo === "suyo" ? "#F29A8C" : "rgba(255,255,255,0.45)" }}>
                          {modo === "nuestro" ? "· con el balón nuestro" : modo === "suyo" ? `· con el balón de ${equipoVisto}` : "· balance de los dos momentos"}
                        </span>
                      </p>
                      <p className="text-[11px] text-white/40">Pincha en un duelo para verlo abajo</p>
                    </div>
                    <Campo
                      once={onceNuestro}
                      suyo={onceSuyo}
                      duelos={duelosVistos}
                      elegido={elegido}
                      onElige={(c) => {
                        setElegido(c);
                        document.getElementById(`duelo-${c}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    />
                    <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-white/45">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: ORO }} /> Castilla
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-white/80" /> {equipoVisto}
                      </span>
                      {(["ventaja", "parejo", "desventaja"] as Veredicto[]).map((v) => (
                        <span key={v} className="inline-flex items-center gap-1.5">
                          <span className="h-0.5 w-4" style={{ background: COLOR[v] }} /> {ROTULO[v]}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    {modo !== "suyo" && <Claves titulo="Dónde les podemos hacer daño · con balón nuestro" lista={atacar} sentido="con" color={MEJOR} vacio="Con balón, ningún duelo claramente a favor." onElige={setElegido} />}
                    {modo !== "nuestro" && <Claves titulo="Dónde nos pueden hacer daño · con balón suyo" lista={vigilar} sentido="sin" color={PEOR} vacio="Sin balón, ningún duelo claramente en contra." onElige={setElegido} />}
                  </div>
                </div>

                <Alineaciones
                  nuestros={nuestros}
                  suyos={suyos}
                  onceNuestro={onceNuestro}
                  onceSuyo={onceSuyo}
                  fuenteSuya={baseSuya.fuente}
                  equipo={equipoVisto}
                  aMano={aMano}
                  cambia={cambia}
                  deshaz={deshaz}
                />

                {ZONAS.map((z) => (
                  <div key={z.key} className="mt-8">
                    <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-white/40">{z.label}</p>
                    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                      {duelosVistos
                        .filter((d) => d.def.zona === z.key)
                        .map((d) => (
                          <Tarjeta key={d.def.clave} d={d} activo={elegido === d.def.clave} onElige={() => setElegido(d.def.clave)} equipo={equipoVisto} modo={modo} />
                        ))}
                    </div>
                  </div>
                ))}

                <p className="mt-8 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/35">
                  Cada duelo se mira en los dos sentidos: con el balón nuestro (lo que hace con balón el nuestro contra lo que hace sin
                  balón el suyo: regate contra entrada, desmarque contra anticipación, pase que rompe líneas contra corte, centro
                  contra juego aéreo, remate contra bloqueo…) y con el balón suyo (al revés). Cada métrica va en percentil contra los
                  de su puesto en toda la categoría con al menos 90′ (P100 = el mejor): no se compara en bruto, sino quién es mejor en
                  lo suyo. Diferencia de 15 puntos o más = ventaja en ese enfrentamiento; el duelo es la media de todos (en los duelos por arriba pesa también la altura, 3 puntos por centímetro con un tope de
                  20). Los porcentajes sacados de muy pocas acciones no cuentan. Es una guía para preparar el partido, no un
                  pronóstico.
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  EL CAMPO                                                           */
/* ------------------------------------------------------------------ */

/**
 * Sitio de cada hueco en un campo de 100 × 64, con nosotros atacando hacia la
 * derecha (nuestra derecha queda abajo). El rival es el espejo: su derecha
 * queda arriba, enfrente de nuestro lateral izquierdo.
 */
const SITIO: Record<string, { x: number; y: number }> = {
  por: { x: 5, y: 32 },
  "lat-d": { x: 22, y: 55 },
  "cen-d": { x: 17, y: 41 },
  "cen-i": { x: 17, y: 23 },
  "lat-i": { x: 22, y: 9 },
  "piv-d": { x: 35, y: 40 },
  "piv-i": { x: 35, y: 24 },
  "ban-d": { x: 56, y: 55 },
  media: { x: 57, y: 32 },
  "ban-i": { x: 56, y: 9 },
  del: { x: 71, y: 32 },
};

const espejo = (p: { x: number; y: number }) => ({ x: 100 - p.x, y: 64 - p.y });

function Campo({
  once,
  suyo,
  duelos,
  elegido,
  onElige,
}: {
  once: Record<string, JugadorDuelo | undefined>;
  suyo: Record<string, JugadorDuelo | undefined>;
  duelos: ResultadoDuelo[];
  elegido: string | null;
  onElige: (clave: string) => void;
}) {
  const K = 8;
  const px = (p: { x: number; y: number }) => ({ x: p.x * K, y: p.y * K });
  const W = 100 * K;
  const H = 64 * K;
  const linea = "rgba(255,255,255,0.16)";

  /* El duelo medular (pivotes contra pivotes) se dibuja en el centro y no con cuatro rayas cruzadas. */
  const lineas = duelos.flatMap((d) =>
    d.def.nuestros.flatMap((hn) =>
      d.def.suyos
        .filter(() => d.def.tipo !== "medio-medio")
        .map((hs) => ({ d, a: px(SITIO[hn]), b: px(espejo(SITIO[hs])), clave: `${d.def.clave}-${hn}-${hs}` })),
    ),
  );

  const medular = duelos.find((d) => d.def.tipo === "medio-medio");

  const ficha = (j: JugadorDuelo | undefined, p: { x: number; y: number }, nuestro: boolean, key: string) => {
    const { x, y } = px(p);
    return (
      <g key={key}>
        <circle cx={x} cy={y} r={15} fill={nuestro ? ORO : "rgba(255,255,255,0.88)"} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
        <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0B0F14">
          {j ? (nuestro ? (PUESTOS.find((q) => q.key === j.puesto)?.corto ?? "") : j.dorsal || "") : "?"}
        </text>
        <text x={x} y={y + 29} textAnchor="middle" fontSize={11} fill={nuestro ? ORO : "rgba(255,255,255,0.85)"} fontWeight={600}>
          {j ? apellido(j.nombre) : "—"}
        </text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" style={{ maxHeight: "max(300px, calc(100vh - 330px))" }} role="img" aria-label="Duelos en el campo">
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#12301f" />
      {[...Array(10)].map((_, i) => (
        <rect key={i} x={(i * W) / 10} y={0} width={W / 10} height={H} fill={i % 2 ? "rgba(255,255,255,0.025)" : "transparent"} />
      ))}
      <rect x={8} y={8} width={W - 16} height={H - 16} fill="none" stroke={linea} strokeWidth={2} />
      <line x1={W / 2} x2={W / 2} y1={8} y2={H - 8} stroke={linea} strokeWidth={2} />
      <circle cx={W / 2} cy={H / 2} r={60} fill="none" stroke={linea} strokeWidth={2} />
      <rect x={8} y={H / 2 - 130} width={120} height={260} fill="none" stroke={linea} strokeWidth={2} />
      <rect x={W - 128} y={H / 2 - 130} width={120} height={260} fill="none" stroke={linea} strokeWidth={2} />

      {lineas.map(({ d, a, b, clave }) => {
        const es = elegido === d.def.clave;
        return (
          <g key={clave} className="cursor-pointer" onClick={() => onElige(d.def.clave)}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={18} />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={COLOR[d.veredicto]}
              strokeWidth={es ? 6 : 4}
              strokeLinecap="round"
              opacity={elegido && !es ? 0.35 : 0.95}
            >
              <title>{`${d.def.titulo}: ${ROTULO[d.veredicto]}${d.balance !== null ? ` (${d.balance > 0 ? "+" : ""}${d.balance})` : ""}`}</title>
            </line>
          </g>
        );
      })}

      {medular && (
        <g className="cursor-pointer" onClick={() => onElige(medular.def.clave)}>
          <rect
            x={W / 2 - 46}
            y={16 * K - 16}
            width={92}
            height={32}
            rx={16}
            fill="#0B0F14"
            stroke={COLOR[medular.veredicto]}
            strokeWidth={elegido === medular.def.clave ? 4 : 2.5}
          />
          <text x={W / 2} y={16 * K + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill={COLOR[medular.veredicto]}>
            Medular {medular.balance !== null ? `${medular.balance > 0 ? "+" : ""}${medular.balance}` : "?"}
          </text>
        </g>
      )}

      {HUECOS.map((h) => ficha(once[h.clave], SITIO[h.clave], true, `n-${h.clave}`))}
      {HUECOS.map((h) => ficha(suyo[h.clave], espejo(SITIO[h.clave]), false, `s-${h.clave}`))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  LAS CLAVES                                                         */
/* ------------------------------------------------------------------ */

function Claves({
  titulo,
  lista,
  sentido,
  color,
  vacio,
  onElige,
}: {
  titulo: string;
  lista: ResultadoDuelo[];
  sentido: "con" | "sin";
  color: string;
  vacio: string;
  onElige: (clave: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <p className="text-sm font-semibold" style={{ color }}>
        {titulo}
      </p>
      {lista.length === 0 ? (
        <p className="mt-2 text-sm text-white/45">{vacio}</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {lista.slice(0, 4).map((d) => {
            const bloque = d.bloques.find((b) => b.sentido === sentido);
            const valor = bloque?.balance ?? null;
            const marcadas = (bloque?.facetas ?? []).filter((f) => f.veredicto === (sentido === "con" ? "ventaja" : "desventaja"));
            return (
            <li key={d.def.clave}>
              <button
                type="button"
                onClick={() => {
                  onElige(d.def.clave);
                  document.getElementById(`duelo-${d.def.clave}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="w-full text-left"
              >
                <span className="flex items-baseline justify-between gap-2 text-sm text-white/85">
                  <span>{d.def.titulo}</span>
                  <b className="shrink-0 tabular-nums" style={{ color }}>
                    {valor !== null && valor > 0 ? "+" : ""}
                    {valor}
                  </b>
                </span>
                <span className="mt-0.5 block text-xs text-white/50">
                  {marcadas.length
                    ? marcadas.map((f) => `${f.titulo} (P${f.nuestro} contra P${f.suyo})`).join(" · ")
                    : "Ventaja repartida, sin un enfrentamiento que se despegue."}
                </span>
              </button>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LOS DOS ONCES, HUECO A HUECO                                       */
/* ------------------------------------------------------------------ */

function LadoOnce({
    lado,
    titulo,
    fuente,
    lista,
    once,
    aMano,
    cambia,
    deshaz,
  }: {
    lado: "nuestro" | "suyo";
    titulo: string;
    fuente: string;
    lista: JugadorDuelo[];
    once: Record<string, JugadorDuelo | undefined>;
    aMano: DuelosDoc;
    cambia: (lado: "nuestro" | "suyo", hueco: string, clave: string) => void;
    deshaz: (lado: "nuestro" | "suyo") => void;
  }) {
    const porPuesto = PUESTOS.map((p) => ({ p, gente: lista.filter((j) => j.puesto === p.key).sort((a, b) => b.minutos - a.minutos) }));
    const tocados = Object.keys(aMano[lado]).length;
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{titulo}</p>
          {tocados > 0 && (
            <button type="button" onClick={() => deshaz(lado)} className="inline-flex items-center gap-1 text-[11px] text-[#C8A96B] hover:underline">
              <RotateCcw size={11} /> Volver a la propuesta ({tocados} {tocados === 1 ? "cambio" : "cambios"})
            </button>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-white/40">{fuente}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {HUECOS.map((h) => {
            const j = once[h.clave];
            return (
              <label key={h.clave} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 text-white/45">{h.rotulo}</span>
                <select
                  value={aMano[lado][h.clave] === HUECO_VACIO ? HUECO_VACIO : j?.clave ?? ""}
                  onChange={(e) => cambia(lado, h.clave, e.target.value)}
                  className={`min-w-0 flex-1 rounded-lg border bg-white/[0.04] px-2 py-1.5 text-white ${
                    aMano[lado][h.clave] ? "border-[#C8A96B]/60" : "border-white/10"
                  }`}
                >
                  <option value="" className="bg-[#11161C]">
                    {aMano[lado][h.clave] ? "↺ Volver a la propuesta" : "Propuesta automática"}
                  </option>
                  <option value={HUECO_VACIO} className="bg-[#11161C]">
                    Nadie (hueco vacío)
                  </option>
                  {porPuesto.map(({ p, gente }) =>
                    gente.length ? (
                      <optgroup key={p.key} label={p.label} className="bg-[#11161C]">
                        {gente.map((g) => (
                          <option key={g.clave} value={g.clave} className="bg-[#11161C]">
                            {g.dorsal ? `${g.dorsal}. ` : ""}
                            {g.nombre} · {g.posicion || "—"} · {g.minutos ? `${g.minutos}′` : "sin Wyscout"}
                          </option>
                        ))}
                      </optgroup>
                    ) : null,
                  )}
                </select>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

function Alineaciones({
  nuestros,
  suyos,
  onceNuestro,
  onceSuyo,
  fuenteSuya,
  equipo,
  aMano,
  cambia,
  deshaz,
}: {
  nuestros: JugadorDuelo[];
  suyos: JugadorDuelo[];
  onceNuestro: Record<string, JugadorDuelo | undefined>;
  onceSuyo: Record<string, JugadorDuelo | undefined>;
  fuenteSuya: string;
  equipo: string;
  aMano: DuelosDoc;
  cambia: (lado: "nuestro" | "suyo", hueco: string, clave: string) => void;
  deshaz: (lado: "nuestro" | "suyo") => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
      >
        {abierto ? "Ocultar los dos onces" : "Cambiar los onces, hueco a hueco"}
      </button>
      {abierto && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <LadoOnce aMano={aMano} cambia={cambia} deshaz={deshaz} lado="nuestro" titulo="Nuestro once" fuente="Propuesto con los minutos de Wyscout en 4-2-3-1; los cambios se guardan para este rival." lista={nuestros} once={onceNuestro} />
          <LadoOnce aMano={aMano} cambia={cambia} deshaz={deshaz} lado="suyo" titulo={`Once de ${equipo}`} fuente={fuenteSuya} lista={suyos} once={onceSuyo} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  UN DUELO                                                           */
/* ------------------------------------------------------------------ */

/** Qué se mira: con el balón nuestro, con el suyo, o los dos. */
type Modo = "nuestro" | "suyo" | "ambos";

const nombresDe = (lista: JugadorDuelo[]) => lista.map((j) => apellido(j.nombre)).join(" y ") || "—";

const verbo = (lista: JugadorDuelo[], singular: string) => (lista.length > 1 ? `${singular}n` : singular);

/**
 * Los bloques de un duelo (06/10/2026): cada uno dice arriba, sin tener que
 * pensarlo, QUIÉN TIENE EL BALÓN y quién ataca y quién defiende, y cada
 * enfrentamiento dice quién lo gana.
 */
function bloquesDe(d: ResultadoDuelo, modo: Modo, equipo: string) {
  const visibles = d.bloques.filter(
    (b) => modo === "ambos" || b.sentido === "aire" || (modo === "nuestro" ? b.sentido === "con" : b.sentido === "sin"),
  );

  return (
    <div className="space-y-4">
      {visibles.map((b) => {
        const nuestroBalon = b.sentido === "con";
        const aire = b.sentido === "aire";
        const fondo = aire ? "rgba(255,255,255,0.08)" : nuestroBalon ? "rgba(200,169,107,0.16)" : "rgba(232,106,90,0.16)";
        const tono = aire ? "rgba(255,255,255,0.7)" : nuestroBalon ? "#C8A96B" : "#F29A8C";

        return (
          <div key={b.sentido} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: fondo, color: tono }}>
                <CircleDot size={11} />
                {aire ? "Balón dividido · por arriba" : nuestroBalon ? "Balón: Castilla" : `Balón: ${equipo}`}
              </span>
              {b.balance !== null && (
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: COLOR[b.veredicto] }}>
                  {ROTULO_CORTO[b.veredicto]} {b.balance > 0 ? "+" : ""}
                  {b.balance}
                </span>
              )}
            </div>
            {!aire && (
              <p className="mt-1.5 text-[11px] text-white/55">
                {nuestroBalon ? (
                  <>
                    <b className="text-[#C8A96B]">{nombresDe(d.nuestros)}</b> {verbo(d.nuestros, "ataca")} con el balón ·{" "}
                    <b className="text-white/85">{nombresDe(d.suyos)}</b> {verbo(d.suyos, "defiende")}
                  </>
                ) : (
                  <>
                    <b className="text-white/85">{nombresDe(d.suyos)}</b> {verbo(d.suyos, "ataca")} con el balón ·{" "}
                    <b className="text-[#C8A96B]">{nombresDe(d.nuestros)}</b> {verbo(d.nuestros, "defiende")}
                  </>
                )}
              </p>
            )}

            <div className="mt-2 flex justify-between text-[9.5px] font-semibold uppercase tracking-wider text-white/35">
              <span>Castilla · {aire ? "por arriba" : nuestroBalon ? "con balón" : "sin balón"}</span>
              <span>{equipo} · {aire ? "por arriba" : nuestroBalon ? "sin balón" : "con balón"}</span>
            </div>

            <div className="mt-1.5 space-y-2.5">
              {b.facetas.map((f) => {
                const gana =
                  f.veredicto === "ventaja"
                    ? { texto: `gana ${nombresDe(d.nuestros)}`, color: MEJOR }
                    : f.veredicto === "desventaja"
                      ? { texto: `gana ${nombresDe(d.suyos)}`, color: PEOR }
                      : f.veredicto === "parejo"
                        ? { texto: "igualado", color: "rgba(255,255,255,0.45)" }
                        : { texto: "sin datos", color: "rgba(255,255,255,0.3)" };

                return (
                  <div key={f.titulo} title={`${f.explica}\n${f.frase}`}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="w-10 tabular-nums" style={{ color: f.nuestro === null ? tinta(0.3) : ORO }}>
                        {f.nuestro === null ? "—" : `P${f.nuestro}`}
                      </span>
                      <span className="min-w-0 flex-1 text-center">
                        <span className="text-white/80">{f.titulo}</span>
                        <span className="ml-1.5 text-[10px] font-semibold" style={{ color: gana.color }}>
                          {gana.texto}
                        </span>
                      </span>
                      <span className="w-10 text-right tabular-nums text-white/70">{f.suyo === null ? "—" : `P${f.suyo}`}</span>
                    </div>
                    {f.sentido !== "aire" && (
                      <div className="flex justify-between gap-2 text-[9.5px] text-white/35">
                        <span className="truncate">{rotuloColumna(f.columnaNuestra)}</span>
                        <span className="truncate text-right">{rotuloColumna(f.columnaSuya)}</span>
                      </div>
                    )}
                    <div className="mt-1 flex h-1.5 gap-1">
                      <div className="flex flex-1 justify-end overflow-hidden rounded-l-full bg-white/[0.06]">
                        <div className="h-full" style={{ width: `${f.nuestro ?? 0}%`, background: f.veredicto === "ventaja" ? MEJOR : ORO }} />
                      </div>
                      <div className="flex-1 overflow-hidden rounded-r-full bg-white/[0.06]">
                        <div className="h-full" style={{ width: `${f.suyo ?? 0}%`, background: f.veredicto === "desventaja" ? PEOR : "rgba(255,255,255,0.6)" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ROTULO_CORTO: Record<Veredicto, string> = {
  ventaja: "A favor",
  desventaja: "En contra",
  parejo: "Parejo",
  "sin-datos": "Sin datos",
};

function Tarjeta({
  d,
  activo,
  onElige,
  equipo,
  modo,
}: {
  d: ResultadoDuelo;
  activo: boolean;
  onElige: () => void;
  equipo: string;
  modo: Modo;
}) {
  const [verParejas, setVerParejas] = useState(false);
  const [pareja, setPareja] = useState<number | null>(null);
  const color = COLOR[d.veredicto];

  const gente = (lista: JugadorDuelo[], nuestro: boolean) => (
    <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${nuestro ? "items-start" : "items-end text-right"}`}>
      {lista.length === 0 && <span className="text-xs text-white/35">Sin nadie en el hueco</span>}
      {lista.map((j) => (
        <div key={j.clave} className={`flex min-w-0 items-center gap-2 ${nuestro ? "" : "flex-row-reverse"}`}>
          <Foto src={j.foto} nombre={j.nombre} size={34} borde={nuestro ? ORO : "rgba(255,255,255,0.7)"} />
          <div className="min-w-0">
            <p className={`truncate text-sm font-medium ${nuestro ? "text-[#C8A96B]" : "text-white/90"}`}>{j.nombre}</p>
            <p className="truncate text-[10px] text-white/40">
              {j.posicion || "—"}
              {j.altura ? ` · ${j.altura} cm` : ""}
              {j.wyscout ? ` · ${j.minutos}′` : " · sin Wyscout"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  /* La cifra de una pareja en lo que se está mirando. */
  const cifra = (p: ResultadoDuelo) => (modo === "nuestro" ? p.conBalon : modo === "suyo" ? p.sinBalon : p.balance);

  return (
    <div
      id={`duelo-${d.def.clave}`}
      onClick={onElige}
      className={`scroll-mt-48 cursor-pointer rounded-2xl border bg-white/[0.03] p-4 transition ${activo ? "border-white/40" : "border-white/10"}`}
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{d.def.titulo}</p>
          <p className="text-[11px] text-white/40">{d.def.subtitulo}</p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `${color}22`, color }}>
          {ROTULO[d.veredicto]}
          {d.balance !== null ? ` ${d.balance > 0 ? "+" : ""}${d.balance}` : ""}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-3">
        {gente(d.nuestros, true)}
        <span className="pt-2 text-[10px] uppercase tracking-wider text-white/30">vs</span>
        {gente(d.suyos, false)}
      </div>

      <div className="mt-4">{bloquesDe(d, modo, equipo)}</div>

      {d.altura && (
        <p className="mt-3 text-[11px] text-white/45">
          Altura media: <span className="text-[#C8A96B]">{d.altura.nuestra} cm</span> frente a {d.altura.suya} cm de {equipo}.
        </p>
      )}

      {/* ---- uno contra uno ---- */}
      {d.parejas.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02]" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setVerParejas((v) => !v);
              setPareja(null);
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-semibold text-white/75"
          >
            <span>
              Uno contra uno <span className="font-normal text-white/40">({d.parejas.length} parejas)</span>
            </span>
            {verParejas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {verParejas && (
            <div className="space-y-1 border-t border-white/[0.06] p-2">
              {d.parejas.map((p, i) => {
                const v = cifra(p);
                const c = COLOR[p.veredicto];
                return (
                  <div key={i}>
                    <button
                      type="button"
                      onClick={() => setPareja((x) => (x === i ? null : i))}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition ${pareja === i ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <b className="text-[#C8A96B]">{nombresDe(p.nuestros)}</b> <span className="text-white/35">vs</span> <b className="text-white/85">{nombresDe(p.suyos)}</b>
                      </span>
                      {modo === "ambos" && (
                        <span className="shrink-0 text-[10px] tabular-nums text-white/45">
                          con balón {p.conBalon === null ? "—" : `${p.conBalon > 0 ? "+" : ""}${p.conBalon}`} · sin balón{" "}
                          {p.sinBalon === null ? "—" : `${p.sinBalon > 0 ? "+" : ""}${p.sinBalon}`}
                        </span>
                      )}
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${c}22`, color: c }}>
                        {ROTULO_CORTO[p.veredicto]}
                        {v !== null ? ` ${v > 0 ? "+" : ""}${v}` : ""}
                      </span>
                    </button>
                    {pareja === i && <div className="px-1 pb-2 pt-1">{bloquesDe(p, modo, equipo)}</div>}
                  </div>
                );
              })}
              <p className="px-2 pt-1 text-[10px] text-white/35">Cada pareja por separado: así se ve si la ventaja es de los dos o de uno solo.</p>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-white/70">{d.resumen}</p>
      {activo && (
        <ul className="mt-2 space-y-1 border-t border-white/[0.06] pt-2 text-[11px] leading-relaxed text-white/50">
          {d.facetas.map((f) => (
            <li key={f.sentido + f.titulo}>{f.frase}</li>
          ))}
        </ul>
      )}
      {d.cobertura.con < d.cobertura.de && d.veredicto !== "sin-datos" && (
        <p className="mt-2 text-[10px] text-white/35">
          Medido en {d.cobertura.con} de {d.cobertura.de} enfrentamientos: en el resto falta muestra de alguno.
        </p>
      )}
    </div>
  );
}
