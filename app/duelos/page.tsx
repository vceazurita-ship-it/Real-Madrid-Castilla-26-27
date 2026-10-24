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

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, CircleDot, RotateCcw, Swords } from "lucide-react";

import { EsqueletoPantalla } from "@/components/ui/estados";
import { Explicativo } from "@/components/ui/textos-analisis";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { MEJOR, ORO, PEOR, tinta, useEscudos } from "@/components/data/graficas";
import { usePlayers } from "@/hooks/usePlayers";
import { useOrdenRivales } from "@/hooks/useOrdenRivales";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { cargaCalendario } from "@/hooks/useCalendario";
import { traeJson } from "@/lib/hojaCsv";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { claveDeHoy } from "@/lib/rivals/orden-calendario";
import { slugClave } from "@/lib/rivals/media";
import { normalizarOnce, rivalOnceKey } from "@/lib/rivals/once";
import { findInforme, type InformeDoc } from "@/lib/rivals/informe";
import { PUESTOS } from "@/lib/data-analisis/individual";
import { HUECOS } from "@/lib/data-analisis/once";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { baseSuyaDe, nuestrosDe, onceNuestroDe, onceSuyoDe, suyosDe } from "@/lib/duelos-onces";
import { fuenteUltimoOnce, huecosDelUltimoOnce } from "@/lib/tactics/ultimoOnce";
import { puestoEnPalabras } from "@/lib/posiciones";
import type { RatingsSeason } from "@/lib/ratings/types";
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
  /* Gris en hexadecimal: se le pega el alfa («${color}22») y un rgba() con
     sufijo no es color; además el blanco no se veía en modo día (19/10/2026). */
  "sin-datos": "#94A3B8",
};

/* Para TEXTO (19/10/2026): el oro claro de las líneas del campo, sobre la
   tarjeta clara del modo día, se quedaba en 2:1. El texto va con el oro del
   tema (`ORO`, que oscurece en modo día); las líneas y los fondos con alfa
   siguen con el hexadecimal. */
/* El campo es verde oscuro en los dos modos: sus fichas y nombres van con el oro claro fijo (en modo día el del tema oscurecía y no se leía). */
const ORO_CAMPO = "#C8A96B";

const textoDe = (color: string) => (color === "#C8A96B" ? ORO : color);


const ROTULO: Record<Veredicto, string> = {
  ventaja: "Ventaja",
  desventaja: "Desventaja",
  parejo: "Parejo",
  "sin-datos": "Sin datos",
};

/** Por debajo de estos minutos un percentil sale de muy pocos partidos. */
const MINUTOS_MUESTRA = 450;

const apellido = (nombre: string) => {
  const t = nombre.trim().split(/\s+/);
  return t.length > 1 ? t.slice(1).join(" ") : nombre;
};

/** Con la inicial del nombre cuando el apellido se repite en el once (J. Martínez, S. Martínez). */
const apellidoDe = (j: JugadorDuelo): string => j.corto ?? apellido(j.nombre);

/** «RCB» → «central derecho». Lo que no se sabe traducir se deja como viene; vacío, vacío. */
const ROL_NUMERO: Record<string, string> = {
  "1": "portero",
  "2": "lateral derecho",
  "3": "lateral izquierdo",
  "4": "central",
  "5": "central",
  "6": "mediocentro defensivo",
  "7": "extremo derecho",
  "8": "interior",
  "9": "delantero centro",
  "10": "mediapunta",
  "11": "extremo izquierdo",
};

const puestoLegible = (sigla: string) => {
  const primera = sigla.split(",")[0]?.trim() ?? "";

  /* El número de rol de la hoja («6») se traduce; si no se sabe, no se pinta (24/10/2026). */
  if (/^\d+$/.test(primera)) return ROL_NUMERO[primera] ?? "";

  return puestoEnPalabras(primera) || primera;
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
  /* `undefined` = todavía no ha contestado Valoraciones; `null` = no hay temporada. */
  const [temporada, setTemporada] = useState<RatingsSeason | null | undefined>(undefined);
  const [proximo, setProximo] = useState<{ rival: string; cuando: string; jornada?: number } | null>(null);
  /* Ya se sabe cuál es el próximo partido (o que no hay). */
  const [proximoListo, setProximoListo] = useState(false);

  /* El orden de los equipos en el selector: el del calendario. */
  const { ordena, jornadaDe } = useOrdenRivales();
  const [equipo, setEquipo] = useState("");
  const [onceMarcado, setOnceMarcado] = useState<string[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lento, setLento] = useState(false);

  useEffect(() => {
    let vivo = true;
    /* Por `traeJson`: los datos de Wyscout quedan en el aparato y la pantalla
       abre al momento con lo de la última vez. */
    traeJson<{ ok: boolean; jugadores?: FilaJugador[]; error?: string }>("/api/data-analisis")
      .then((r) => {
        if (!vivo) return;
        setJugadores(r.jugadores ?? []);
        if (!r.ok) setError(r.error ?? "No se han podido leer los datos.");
      })
      .catch(() => {
        if (vivo) {
          setJugadores([]);
          setError("No se han podido leer los datos.");
        }
      });
    traeJson<Fila[]>("/api/rivals?action=rivalesPlantillas")
      .then((d) => {
        if (vivo) setPlantillas(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        if (vivo) setPlantillas([]);
      });
    leeDoc<InformeDoc>("rivals:informe").then((doc) => {
      if (vivo) setInformes(doc);
    });
    /* Nuestro último once: el mismo que usa la pizarra (Valoraciones). */
    traeJson<{ success?: boolean; season?: RatingsSeason }>("/api/ratings/load")
      .then((r) => {
        if (vivo) setTemporada(r?.success ? r.season ?? null : null);
      })
      .catch(() => {
        if (vivo) setTemporada(null);
      });
    /* Valoraciones sale del Apps Script (30-70 s en frio): no se espera. A los 15 s
       se pinta con el once de Wyscout y, si la respuesta llega despues, se rehace sola. */
    const tope = window.setTimeout(() => {
      if (vivo) setTemporada((t) => (t === undefined ? null : t));
    }, 15_000);
    /* Si lo esencial (Wyscout, plantillas, calendario) no llega en 25 s, se dice y se deja reintentar. */
    const lentoT = window.setTimeout(() => {
      if (vivo) setLento(true);
    }, 25_000);
    void cargaCalendario().then((partidos: PartidoCal[]) => {
      if (!vivo) return;
      /* El día de aquí, no el de UTC: de 00:00 a 02:00 del día del partido
         `toISOString()` todavía decía «ayer» (19/10/2026). */
      const hoy = claveDeHoy();
      const siguiente = partidos
        .filter((p) => p.cuando && p.cuando.slice(0, 10) >= hoy)
        .sort((a, b) => a.cuando.localeCompare(b.cuando))[0];
      if (siguiente) {
        const rival = /castilla/i.test(siguiente.local) ? siguiente.visitante : siguiente.local;
        setProximo({ rival, cuando: siguiente.cuando, jornada: siguiente.jornada });
      }
      setProximoListo(true);
    });
    return () => {
      vivo = false;
      window.clearTimeout(tope);
      window.clearTimeout(lentoT);
    };
  }, []);

  /* Los equipos de Plantillas rivales; por defecto, el del próximo partido. */
  const equipos = useMemo(
    /* Por calendario, con el rival de la semana el primero (10/10/2026). */
    () => ordena([...new Set(plantillas.map((f) => texto(f.NOMBRE_EQUIPO)).filter(Boolean))], (e) => e),
    [plantillas, ordena],
  );
  /*
  | Sin elegir a mano, nada hasta saber el próximo partido (07/10/2026). Antes
  | caía un momento en `equipos[0]`: el documento de duelos de ESE equipo se
  | cargaba —y se podía escribir— hasta que llegaba el calendario y cambiaba.
  */
  const equipoVisto =
    equipo || (proximoListo ? (proximo ? equipos.find((e) => mismoClub(e, proximo.rival)) ?? "" : "") || equipos[0] || "" : "");

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
  /* El punto de partida de nuestro once: el último de Valoraciones, como en la pizarra. */
  const ultimoOnce = useMemo(() => (temporada ? huecosDelUltimoOnce(temporada, players) : null), [temporada, players]);
  /* (`players` llega aparte de Valoraciones: hasta que está, la propuesta es la de Wyscout y se rehace sola.) */
  const baseNuestra = useMemo(
    () => (ultimoOnce?.ultimo ? Object.fromEntries(Object.entries(ultimoOnce.huecos).filter(([, id]) => id)) : null),
    [ultimoOnce],
  );
  const fuenteNuestra = ultimoOnce?.ultimo
    ? fuenteUltimoOnce(ultimoOnce)
    : "Propuesto con los minutos de Wyscout en 4-2-3-1";
  const onceNuestro = useMemo(() => onceNuestroDe(nuestros, aMano.nuestro, baseNuestra, players), [nuestros, aMano.nuestro, baseNuestra, players]);
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
      /* Lo de la tarjeta tiene que decir lo mismo que su etiqueta: las frases, la cobertura y el resumen, del momento que se mira. */
      const sentido = modo === "nuestro" ? "con" : "sin";
      const facetas = d.facetas.filter((f) => f.sentido === sentido || f.sentido === "aire");
      const delMomento = facetas.filter((f) => f.sentido === sentido);
      const ganadas = delMomento.filter((f) => f.veredicto === "ventaja").map((f) => f.titulo.toLowerCase());
      const perdidas = delMomento.filter((f) => f.veredicto === "desventaja").map((f) => f.titulo.toLowerCase());
      const cabeza =
        veredicto === "ventaja"
          ? `Ventaja para ${nombresDe(d.nuestros)}`
          : veredicto === "desventaja"
            ? `Ventaja para ${nombresDe(d.suyos)}`
            : veredicto === "parejo"
              ? "Duelo parejo"
              : "Sin datos suficientes";
      const partes = [ganadas.length ? `a favor ${ganadas.join(", ")}` : "", perdidas.length ? `en contra ${perdidas.join(", ")}` : ""].filter(Boolean);
      const resumen =
        veredicto === "sin-datos"
          ? d.resumen
          : `${cabeza} ${modo === "nuestro" ? "con el balón nuestro" : "con el balón suyo"}: ${partes.length ? partes.join("; ") : "ningún enfrentamiento se despega"}.`;
      return {
        ...d,
        balance,
        veredicto,
        parejas,
        facetas,
        resumen,
        cobertura: { con: facetas.filter((f) => f.diferencia !== null).length, de: facetas.length },
      };
    };
    return duelos.map(enModo);
  }, [duelos, modo]);

  /* Sin equipo, la clave es la de «sin-equipo»: ahí no se escribe nada. */
  const cambia = (lado: "nuestro" | "suyo", hueco: string, clave: string) => {
    if (!equipoVisto) return;
    setGuardado((actual) => {
      const n = normalizaDuelos(actual);
      const otro = Object.fromEntries(Object.entries(n[lado]).filter(([h, c]) => h !== hueco && (c !== clave || clave === HUECO_VACIO)));
      return { ...n, [lado]: clave ? { ...otro, [hueco]: clave } : otro };
    });
  };
  const deshaz = (lado: "nuestro" | "suyo") => {
    if (!equipoVisto) return;
    setGuardado((actual) => ({ ...normalizaDuelos(actual), [lado]: {} }));
  };

  const conDato = duelosVistos.filter((d) => d.veredicto !== "sin-datos");
  /*
  | Las dos cajas leen cada duelo por su lado (06/10/2026): «dónde les podemos
  | hacer daño» es nuestro con balón contra su sin balón; «dónde nos lo pueden
  | hacer», su con balón contra nuestro sin balón. Un duelo puede estar en las
  | dos: el lateral que les desborda y al que también le desbordan.
  */
  const atacar = duelos.filter((d) => (d.conBalon ?? 0) >= UMBRAL_DUELO).sort((a, b) => (b.conBalon ?? 0) - (a.conBalon ?? 0));
  const vigilar = duelos.filter((d) => (d.sinBalon ?? 0) <= -UMBRAL_DUELO).sort((a, b) => (a.sinBalon ?? 0) - (b.sinBalon ?? 0));

  const cargando = jugadores === null || plantillasLeidas === null || (!equipoVisto && !proximoListo);
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
              hacer.
              <Explicativo> Cada jugador se mide contra los de su puesto en la categoría (Wyscout, esta temporada).</Explicativo>
            </p>
            <p className="mt-2 max-w-3xl text-xs text-white/45">
              Cada cifra es un percentil: P73 es mejor que el 73 % de los jugadores de su puesto con al menos 90′. Un +45 son
              45 puntos de percentil a favor nuestro; un −28, 28 a favor del rival. Con pocos minutos, la cifra es menos fiable.
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
                    {/* La jornada delante: así el orden del desplegable se entiende. */}
                    {jornadaDe(e)?.etiqueta ? `${jornadaDe(e)?.etiqueta} · ` : ""}
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
                    { key: "ambos", label: "Los dos", color: tinta(0.9) },
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
              <span className={`ml-auto flex-wrap items-center gap-x-3 gap-y-1 text-xs ${cargando ? "hidden" : "flex"}`}>
                <span className="text-white/60" title="Duelos con datos en los dos lados">
                  {conDato.length} duelos medidos
                </span>
                <span style={{ color: MEJOR }} title="Duelos en los que, con el balón nuestro, les sacamos ventaja">
                  ● {atacar.length} con ventaja nuestra con balón
                </span>
                <span style={{ color: PEOR }} title="Duelos en los que, con el balón suyo, nos sacan ventaja">
                  ● {vigilar.length} con ventaja suya con balón
                </span>
                {(() => {
                  const enLosDos = atacar.filter((a) => vigilar.some((v) => v.def.clave === a.def.clave)).length;

                  return enLosDos > 0 ? (
                    <span className="text-white/50">
                      {enLosDos === 1 ? "1 cuenta" : `${enLosDos} cuentan`} en los dos sentidos y sale en las dos cajas: por eso la suma pasa de {conDato.length}
                    </span>
                  ) : null;
                })()}
              </span>
              {!cargando && temporada === undefined && (
                <span className="basis-full text-[11px] text-white/45">
                  Nuestro once: propuesto con los minutos de Wyscout; pasa al último once en cuanto llegue Valoraciones.
                </span>
              )}
            </div>

            {cargando && lento ? (
              <div className="mt-10 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                Los datos tardan más de lo normal en llegar (la hoja de Google está despertando).{" "}
                <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">
                  Reintentar
                </button>
              </div>
            ) : cargando ? (
              <div className="mt-6">
                <EsqueletoPantalla titulo="los duelos" cifras={0} />
              </div>
            ) : plantillas.length === 0 ? (
              <p className="mt-10 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                No se han podido leer las plantillas rivales. Prueba a recargar en un minuto.
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
                        <span className="ml-2 text-xs font-normal" style={{ color: modo === "nuestro" ? ORO : modo === "suyo" ? PEOR : tinta(0.45) }}>
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
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: ORO_CAMPO }} /> Castilla
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.88)", boxShadow: `0 0 0 1px ${tinta(0.35)}` }} /> {equipoVisto}
                      </span>
                      {(["ventaja", "parejo", "desventaja"] as Veredicto[]).map((v) => (
                        <span key={v} className="inline-flex items-center gap-1.5">
                          <span className="h-0.5 w-4" style={{ background: COLOR[v] }} /> {ROTULO[v]}
                        </span>
                      ))}
                      {/* La clave de los «P73» de las tarjetas, siempre a la vista:
                          la explicación larga de abajo se puede apagar (19/10/2026). */}
                      <span className="basis-full sm:basis-auto sm:ml-auto">P73 = mejor que el 73 % de los de su puesto (P100, el mejor)</span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    {modo !== "suyo" && <Claves titulo="Dónde les podemos hacer daño · con balón nuestro" lista={atacar} contraria={vigilar} sentido="con" color={MEJOR} vacio="Con balón, ningún duelo claramente a favor." onElige={setElegido} />}
                    {modo !== "nuestro" && <Claves titulo="Dónde nos pueden hacer daño · con balón suyo" lista={vigilar} contraria={atacar} sentido="sin" color={PEOR} vacio="Sin balón, ningún duelo claramente en contra." onElige={setElegido} />}
                  </div>
                </div>

                <Alineaciones
                  nuestros={nuestros}
                  suyos={suyos}
                  onceNuestro={onceNuestro}
                  onceSuyo={onceSuyo}
                  fuenteNuestra={fuenteNuestra}
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
                          <Tarjeta key={`${d.def.clave}|${d.nuestros.map((j) => j.clave).join(",")}|${d.suyos.map((j) => j.clave).join(",")}`} d={d} activo={elegido === d.def.clave} onElige={() => setElegido(d.def.clave)} equipo={equipoVisto} modo={modo} />
                        ))}
                    </div>
                  </div>
                ))}

                <Explicativo>
                <p className="mt-8 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/35">
                  Cada duelo se mira en los dos sentidos: con el balón nuestro (lo que hace con balón el nuestro contra lo que hace sin
                  balón el suyo: regate contra entrada, desmarque contra anticipación, pase que rompe líneas contra corte, centro
                  contra juego aéreo, remate contra bloqueo…) y con el balón suyo (al revés). Cada métrica va en percentil contra los
                  de su puesto en toda la categoría con al menos 90′ (P100 = el mejor): no se compara en bruto, sino quién es mejor en
                  lo suyo. Diferencia de 15 puntos o más = ventaja en ese enfrentamiento; el duelo es la media de todos (en los duelos por arriba pesa también la altura, 3 puntos por centímetro con un tope de
                  20). Los porcentajes sacados de muy pocas acciones no cuentan. Es una guía para preparar el partido, no un
                  pronóstico.
                </p>
                </Explicativo>
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
        <circle cx={x} cy={y} r={15} fill={nuestro ? ORO_CAMPO : "rgba(255,255,255,0.88)"} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
        <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0B0F14">
          {j ? (nuestro ? (PUESTOS.find((q) => q.key === j.puesto)?.corto ?? "") : j.dorsal || "") : "?"}
        </text>
        <text x={x} y={y + 29} textAnchor="middle" fontSize={11} fill={nuestro ? ORO_CAMPO : "rgba(255,255,255,0.85)"} fontWeight={600}>
          {j ? apellidoDe(j) : "—"}
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

/** Los minutos de quien menos ha jugado, contando sólo a los cruzados con Wyscout: sin fila no hay percentil. */
function baseDe(d: ResultadoDuelo) {
  const lado = (l: JugadorDuelo[]) => {
    const con = l.filter((j) => j.wyscout);

    return { min: con.length ? Math.min(...con.map((j) => j.minutos || 0)) : 0, solo: con.length < l.length && con.length === 1 ? apellidoDe(con[0]) : "" };
  };
  const n = lado(d.nuestros);
  const s = lado(d.suyos);
  const partes = [
    n.min > 0 ? `${n.min}′${n.solo ? ` (sólo ${n.solo})` : ""} los nuestros` : "",
    s.min > 0 ? `${s.min}′${s.solo ? ` (sólo ${s.solo})` : ""} los suyos` : "",
  ].filter(Boolean);

  return {
    poca: (n.min > 0 && n.min < MINUTOS_MUESTRA) || (s.min > 0 && s.min < MINUTOS_MUESTRA) || n.min === 0 || s.min === 0,
    texto: partes.length ? `Base: ${partes.join(" · ")}` : "",
  };
}

function Claves({
  titulo,
  lista,
  sentido,
  color,
  vacio,
  onElige,
  contraria = [],
}: {
  titulo: string;
  lista: ResultadoDuelo[];
  sentido: "con" | "sin";
  color: string;
  vacio: string;
  onElige: (clave: string) => void;
  /** La otra caja: un duelo que sale en las dos se dice como uno solo, no como una contradicción. */
  contraria?: ResultadoDuelo[];
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
          {[...lista].sort((a, b) => Number(baseDe(a).poca) - Number(baseDe(b).poca)).slice(0, 4).map((d) => {
            const bloque = d.bloques.find((b) => b.sentido === sentido);
            const valor = bloque?.balance ?? null;
            const marcadas = (bloque?.facetas ?? []).filter((f) => f.veredicto === (sentido === "con" ? "ventaja" : "desventaja"));
            const tambien = contraria.some((o) => o.def.clave === d.def.clave);
            /* Los minutos de quien menos ha jugado en cada lado: de ahí sale el percentil. */
            const base = baseDe(d);
            const pocaMuestra = base.poca;
            return (
            <li key={d.def.clave}>
              <button
                type="button"
                onClick={() => {
                  onElige(d.def.clave);
                  document.getElementById(`duelo-${d.def.clave}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className={`w-full text-left ${pocaMuestra ? "opacity-70" : ""}`}
              >
                <span className="flex items-baseline justify-between gap-2 text-sm text-white/85">
                  <span>
                    {d.def.titulo}
                    <span className="ml-1.5 text-[11px] font-normal text-white/40">{sentido === "con" ? "con balón nuestro" : "con balón suyo"}</span>
                  </span>
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
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-white/45">
                  {tambien && (
                    <span
                      className="rounded-full border border-white/15 px-2 py-0.5 font-semibold text-white/60"
                      title={`Con el balón nuestro ${d.conBalon !== null && d.conBalon > 0 ? "+" : ""}${d.conBalon}; con el suyo ${d.sinBalon !== null && d.sinBalon > 0 ? "+" : ""}${d.sinBalon}`}
                    >
                      cuenta en los dos sentidos
                    </span>
                  )}
                  {pocaMuestra && (
                    <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: "rgba(200,169,107,0.18)", color: ORO }}>
                      poca muestra: léelo como pista, no como hecho
                    </span>
                  )}
                  <span className="text-white/35">{base.texto}</span>
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
        <Explicativo>
          <p className="mt-0.5 text-[11px] text-white/40">{fuente}</p>
        </Explicativo>
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
                    {aMano[lado][h.clave] ? "↺ Volver a la propuesta" : "Propuesta"}
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
                            {[g.nombre, puestoLegible(g.posicion), g.minutos ? `${g.minutos}′` : ""].filter(Boolean).join(" · ")}
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
  fuenteNuestra,
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
  fuenteNuestra: string;
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
          <LadoOnce aMano={aMano} cambia={cambia} deshaz={deshaz} lado="nuestro" titulo="Nuestro once" fuente={`${fuenteNuestra}. Los cambios se guardan para este rival y la pizarra táctica los coge.`} lista={nuestros} once={onceNuestro} />
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

const nombresDe = (lista: JugadorDuelo[]) => lista.map(apellidoDe).join(" y ") || "nadie";

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
        const fondo = aire ? tinta(0.08) : nuestroBalon ? "rgba(200,169,107,0.16)" : "rgba(232,106,90,0.16)";
        const tono = aire ? tinta(0.7) : nuestroBalon ? ORO : PEOR;

        return (
          <div key={b.sentido} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: fondo, color: tono }}>
                <CircleDot size={11} />
                {aire ? "Balón dividido · por arriba" : nuestroBalon ? "Balón: Castilla" : `Balón: ${equipo}`}
              </span>
              {b.balance !== null && (
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: textoDe(COLOR[b.veredicto]) }}>
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

            <div className="mt-2 flex justify-between gap-2 text-[9.5px] font-semibold uppercase tracking-wider text-white/35">
              <span className="min-w-0">Castilla · {aire ? "por arriba" : nuestroBalon ? "con balón" : "sin balón"}</span>
              <span className="min-w-0 text-right">{equipo} · {aire ? "por arriba" : nuestroBalon ? "sin balón" : "con balón"}</span>
            </div>

            <FacetasRecortadas
              items={b.facetas.filter((f) => f.nuestro !== null && f.suyo !== null).map((f) => ({
                diff: Math.abs((f.nuestro ?? 0) - (f.suyo ?? 0)),
                key: f.titulo,
                nodo: (() => {
                const gana =
                  f.veredicto === "ventaja"
                    ? { texto: `gana ${nombresDe(d.nuestros)}`, color: MEJOR }
                    : f.veredicto === "desventaja"
                      ? { texto: `gana ${nombresDe(d.suyos)}`, color: PEOR }
                      : f.veredicto === "parejo"
                        ? { texto: "igualado", color: tinta(0.45) }
                        : { texto: "sin datos", color: tinta(0.3) };

                return (
                  <div title={`${f.explica}\n${f.frase}`}>
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
                        <span className="min-w-0 flex-1 truncate">{rotuloColumna(f.columnaNuestra)}</span>
                        <span className="min-w-0 flex-1 truncate text-right">{rotuloColumna(f.columnaSuya)}</span>
                      </div>
                    )}
                    <div className="mt-1 flex h-1.5 gap-1">
                      <div className="flex flex-1 justify-end overflow-hidden rounded-l-full bg-white/[0.06]">
                        <div className="h-full" style={{ width: `${f.nuestro ?? 0}%`, background: f.veredicto === "ventaja" ? MEJOR : ORO }} />
                      </div>
                      <div className="flex-1 overflow-hidden rounded-r-full bg-white/[0.06]">
                        <div className="h-full" style={{ width: `${f.suyo ?? 0}%`, background: f.veredicto === "desventaja" ? PEOR : tinta(0.55) }} />
                      </div>
                    </div>
                  </div>
                );
                })(),
              }))}
            />
          </div>
        );
      })}
    </div>
  );
}

/* Las dos métricas con más diferencia a la vista; el resto, desplegable (24/10/2026). */
function FacetasRecortadas({ items }: { items: { diff: number; key: string; nodo: ReactNode }[] }) {
  const [todas, setTodas] = useState(false);
  const orden = [...items].sort((a, b) => b.diff - a.diff);
  const vistas = todas ? items : orden.slice(0, 2);
  const resto = items.length - 2;

  return (
    <div className="mt-1.5 space-y-2.5">
      {vistas.map((i) => (
        <div key={i.key}>{i.nodo}</div>
      ))}
      {resto > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTodas((v) => !v);
          }}
          className="text-[11px] font-semibold text-[#C8A96B] hover:underline"
        >
          {todas ? "Ver sólo las dos de más diferencia" : `Ver las ${resto} restantes`}
        </button>
      )}
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

  const noEsMediapunta = (j: JugadorDuelo) => {
    const puesto = puestoLegible(j.posicion);

    return Boolean(puesto) && !/mediapunta|^AMF$|^AM$|^10$/i.test(puesto);
  };

  const enHuecoMedia = [
    ...(d.def.nuestros.includes("media") ? d.nuestros.filter(noEsMediapunta).map((j) => ({ j, de: "nuestro" as const })) : []),
    ...(d.def.suyos.includes("media") ? d.suyos.filter(noEsMediapunta).map((j) => ({ j, de: "suyo" as const })) : []),
  ];

  const gente = (lista: JugadorDuelo[], nuestro: boolean) => (
    <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${nuestro ? "items-start" : "items-start sm:items-end sm:text-right"}`}>
      {lista.length === 0 && <span className="text-xs text-white/35">Sin nadie en el hueco</span>}
      {lista.map((j) => (
        <div key={j.clave} className={`flex min-w-0 max-w-full items-center gap-2 ${nuestro ? "" : "sm:flex-row-reverse"}`}>
          <Foto src={j.foto} nombre={j.nombre} size={34} borde={nuestro ? ORO : tinta(0.5)} />
          <div className="min-w-0">
            <p className={`truncate text-sm font-medium ${nuestro ? "text-[#C8A96B]" : "text-white/90"}`}>{j.nombre}</p>
            <p className="truncate text-[10px] text-white/40">
              {[
                puestoLegible(j.posicion),
                j.altura ? `${j.altura} cm` : "",
                /* Con poca muestra el percentil engaña: se avisa. */
                j.wyscout ? (j.minutos < 270 ? `${j.minutos}′, pocos minutos` : `${j.minutos}′`) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
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
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{d.def.titulo}</p>
          <p className="text-[11px] text-white/40">{d.def.subtitulo}</p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `${color}22`, color: textoDe(color) }}>
          {ROTULO[d.veredicto]}
          {d.balance !== null ? ` ${d.balance > 0 ? "+" : ""}${d.balance}` : ""}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        {gente(d.nuestros, true)}
        <span className="text-[10px] uppercase tracking-wider text-white/30 sm:pt-2">vs</span>
        {gente(d.suyos, false)}
      </div>

      {/* Si el rival no juega con mediapunta, el hueco lo ocupa otro puesto: se dice cuál. */}
      {enHuecoMedia.map(({ j, de }) => (
        <p key={j.clave} className="mt-2 text-[11px] text-white/50">
          {de === "nuestro" ? "En nuestro once" : `En el once de ${equipo}`} no hay mediapunta: {apellidoDe(j)} ocupa ese hueco y juega de {puestoLegible(j.posicion)}.
        </p>
      ))}

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
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${c}22`, color: textoDe(c) }}>
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
