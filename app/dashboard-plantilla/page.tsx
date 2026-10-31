"use client";
import { traeCsv, traeJson } from "@/lib/hojaCsv";
import { coma } from "@/lib/formatoNumero";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { getPlayerImage } from "@/lib/playerImages";
import { nombrePuesto, posicionDe, puestoEnPalabras } from "@/lib/posiciones";
import { nombreVisible } from "@/lib/nombreJugador";
import { esDelCastilla, fichajesQueFaltan, licenciaDe } from "@/lib/fichajes";
import { useRatingsSeason } from "@/hooks/useRatings";
import { formatRating, ratingColor } from "@/lib/ratings/compute";
import { dorsalDe } from "@/lib/dorsales";
import { isHiddenPlayer } from "@/lib/hiddenPlayers";
import { ALMACEN_VACIO, type AlmacenEquipos } from "@/lib/sesion-equipos/modelo";
import { SESIONES_DESDE_TEXTO, resumenDeSesiones, type ResumenSesiones, type SesionesDeJugador } from "@/lib/sesion-equipos/estadistica";
import { PUESTOS, type Puesto } from "@/lib/data-analisis/individual";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import {
  AVISOS,
  avisosDe,
  construyeJugadores,
  partidosDeLiga,
  partidosWyscout,
  type Aviso,
  type FichaPlantilla,
  type JugadorDash,
  type PartidoLiga,
  type TipoAviso,
} from "@/lib/plantilla/dashboard";

import { AlertTriangle, ExternalLink, RotateCcw, Search, UserRound, X } from "lucide-react";

import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";

/*
|--------------------------------------------------------------------------
| DASHBOARD DE PLANTILLA · NUEVO ENFOQUE (31/10/2026)
|--------------------------------------------------------------------------
|
| Fuera lo que no se registra: estado de la hoja de controles (lesionado,
| selección, recuperación), su «% de óptimos», la tarta de estados y la
| curva de controles. Esa hoja dejó de escribirse el 24/08 y el analista no
| va a hacer ese seguimiento.
|
| Lo que queda es lo que se mueve cada semana: minutos y participación
| (Wyscout y Valoraciones), avisos para el cuerpo técnico, edad y contratos
| (Wyscout), rendimiento por puesto (Wyscout) y nota de partido
| (Valoraciones), y la asistencia a las sesiones registradas. El modelo vive
| en `lib/plantilla/dashboard.ts`.
*/

/* La hoja JUGADORES publicada: plantilla, licencia y ficha de competencias. */
const SCOUTING_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=205498392&single=true&output=csv";

/* Paleta validada de DATA (ver nota «data-analisis»): mejor / peor / destacado. */
const MEJOR = "var(--rmcf-dif-mejor)";
const PEOR = "var(--rmcf-dif-peor)";
const ORO = "var(--rmcf-gold-ink)";
const tinta = (alfa: number) => `rgb(var(--rmcf-ink-rgb) / ${alfa})`;
const oroAl = (por: number) => `color-mix(in srgb, var(--rmcf-gold-ink) ${por}%, transparent)`;

const METRICAS = [
  { key: "mentalidad", label: "Mentalidad" },
  { key: "habitos", label: "Hábitos" },
  { key: "interpretacion", label: "Interpretación" },
  { key: "fisica", label: "Física" },
  { key: "tecnica", label: "Técnica" },
] as const;

type MetricaKey = (typeof METRICAS)[number]["key"];

type ScoutingCSV = {
  ID_JUGADOR: string;
  NOMBRE: string;
  APODO: string;
  POSICION: string;
  DORSAL: string;
  FOTO_URL: string;
  MENTALIDAD: string;
  HABITOS: string;
  INTERPRETACION: string;
  CAPACIDAD_FISICA: string;
  TECNICA: string;
  FORTALEZAS: string;
  ASPECTOS_MEJORA: string;
  HUDL_PERFIL_URL: string;
  LICENCIA: string;
};

type Ficha = FichaPlantilla & {
  dorsal: string;
  foto: string;
  licencia: string;
  mentalidad: number;
  habitos: number;
  interpretacion: number;
  fisica: number;
  tecnica: number;
  media: number;
  /* Las cinco a 5 es el valor por defecto de la hoja, no una ficha: no cuenta. */
  valorado: boolean;
  fortalezas: string;
  aspectosMejora: string;
  hudl: string;
};

type Jugador = JugadorDash<Ficha>;

type RespuestaData = { ok?: boolean; jugadores?: FilaJugador[]; partidos?: FilaPartido[] };

type Vista = "plantilla" | "jornadas" | "jugador" | "rendimiento";

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const nombreDe = (j: Jugador) => nombreVisible(j.ficha.nombre || j.ficha.apodo);

const etiquetaPuesto = (p: Puesto) => PUESTOS.find((x) => x.key === p)?.label ?? p;

/** «CD TERUEL» → «Teruel», «UE SANT ANDREU» → «Sant Andreu»: lo que cabe en una columna. */
function rivalCorto(nombre: string) {
  const limpio = String(nombre || "")
    .replace(/\b(CD|UD|AD|SD|UE|CF|FC|RCD|CE|SAD|C\.D\.|U\.D\.)\b\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const palabras = limpio.split(" ").filter(Boolean);
  const corto = palabras.length > 1 && palabras[0].length <= 4 ? `${palabras[0]} ${palabras[1]}` : (palabras[0] ?? "");

  return corto.charAt(0).toUpperCase() + corto.slice(1).toLowerCase();
}

const fechaCorta = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

const mesAnio = (iso: string) => {
  const [anio, mes] = iso.split("-").map(Number);
  if (!anio || !mes) return iso;
  return new Date(Date.UTC(anio, mes - 1, 1)).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
};

export default function DashboardPlantilla() {
  const [scoutingRows, setScoutingRows] = useState<ScoutingCSV[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  /* Una sola lectura del reloj (no se lee en el render). */
  const [ahora] = useState(() => Date.now());
  const hoy = useMemo(() => new Date(ahora).toISOString().slice(0, 10), [ahora]);

  /* 31/10/2026: abre con «¿Cómo está la plantilla?» (minutos, avisos, edad). */
  const [vista, setVista] = usePestanaUrl<Vista>("vista", ["plantilla", "jornadas", "jugador", "rendimiento"], "plantilla");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [puesto, setPuesto] = useState<Puesto | "">("");
  const [grupo, setGrupo] = useState<"" | "castilla">("");

  const { season: ratingsSeason } = useRatingsSeason();

  /* Wyscout: minutos, edad, contrato y percentiles. Si no llega, los minutos
     salen de Valoraciones y la pantalla lo dice. */
  const [wyscout, setWyscout] = useState<RespuestaData | null>(null);
  const [wyEstado, setWyEstado] = useState<"cargando" | "listo" | "falla">("cargando");

  useEffect(() => {
    let vivo = true;

    traeJson<RespuestaData>("/api/data-analisis")
      .then((r) => {
        if (!vivo) return;
        setWyscout(r?.jugadores ? r : null);
        setWyEstado(r?.jugadores?.length ? "listo" : "falla");
      })
      .catch(() => {
        if (vivo) setWyEstado("falla");
      });

    return () => {
      vivo = false;
    };
  }, []);

  /* Sesiones registradas en /jugadores-sesion (sólo lectura). */
  const [almacenSesiones, setAlmacenSesiones] = useState<AlmacenEquipos>(ALMACEN_VACIO);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/docs?key=jugadores-sesion", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: AlmacenEquipos | null }>)
      .then((d) => {
        if (!cancelled && d?.data && Array.isArray(d.data.sesiones)) setAlmacenSesiones(d.data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  /* `loading` arranca en true y sólo se reinicia desde «Reintentar». */
  useEffect(() => {
    let cancelled = false;

    traeCsv(SCOUTING_CSV)
      .then((csv) => {
        if (cancelled) return;
        const filas = Papa.parse<ScoutingCSV>(csv, { header: true, skipEmptyLines: true }).data;
        setScoutingRows(filas.filter((row) => !isHiddenPlayer(row.NOMBRE, row.APODO)));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error cargando datos de plantilla:", error);
        setLoadError("No se han podido cargar los datos de la plantilla.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /*
  |--------------------------------------------------------------------------
  | FICHAS (hoja JUGADORES + fichajes del puente)
  |--------------------------------------------------------------------------
  */

  const fichas = useMemo<Ficha[]>(() => {
    const vistos = new Set<string>();

    const deLaHoja: Ficha[] = scoutingRows
      .filter((s) => {
        if (!s.ID_JUGADOR || vistos.has(s.ID_JUGADOR)) return false;
        vistos.add(s.ID_JUGADOR);
        return true;
      })
      .map((s) => {
        const mentalidad = toNumber(s.MENTALIDAD);
        const habitos = toNumber(s.HABITOS);
        const interpretacion = toNumber(s.INTERPRETACION);
        const fisica = toNumber(s.CAPACIDAD_FISICA);
        const tecnica = toNumber(s.TECNICA);
        const valores = [mentalidad, habitos, interpretacion, fisica, tecnica].filter((v) => v > 0);
        const nombre = s.NOMBRE || s.APODO || "";
        const licencia = licenciaDe(nombre, s.LICENCIA || "");

        return {
          id: s.ID_JUGADOR,
          nombre,
          apodo: s.APODO || "",
          posicionHoja: posicionDe(nombre, s.POSICION || ""),
          delCastilla: esDelCastilla(nombre, licencia),
          dorsal: s.DORSAL || String(dorsalDe(nombre) ?? ""),
          foto: getPlayerImage(nombre, "cerca", s.ID_JUGADOR) || s.FOTO_URL || "",
          licencia,
          mentalidad,
          habitos,
          interpretacion,
          fisica,
          tecnica,
          media: valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0,
          valorado: valores.length > 0 && !(valores.length === 5 && valores.every((v) => v === 5)),
          fortalezas: s.FORTALEZAS ?? "",
          aspectosMejora: s.ASPECTOS_MEJORA ?? "",
          hudl: s.HUDL_PERFIL_URL ?? "",
        };
      });

    /* Los fichajes que la hoja aún no trae también son de la plantilla. */
    const fichajes: Ficha[] = fichajesQueFaltan(deLaHoja.map((p) => p.nombre))
      .filter((f) => !isHiddenPlayer(f.nombre, f.apodo))
      .map((f) => ({
        id: f.id,
        nombre: f.nombre,
        apodo: f.apodo ?? "",
        posicionHoja: f.posicion,
        delCastilla: esDelCastilla(f.nombre, f.licencia),
        dorsal: f.dorsal ? String(f.dorsal) : String(dorsalDe(f.nombre) ?? ""),
        foto: f.foto || "",
        licencia: f.licencia,
        mentalidad: 0,
        habitos: 0,
        interpretacion: 0,
        fisica: 0,
        tecnica: 0,
        media: 0,
        valorado: false,
        fortalezas: "",
        aspectosMejora: "",
        hudl: "",
      }));

    return [...deLaHoja, ...fichajes];
  }, [scoutingRows]);

  /*
  |--------------------------------------------------------------------------
  | JUGADORES CON SUS CIFRAS
  |--------------------------------------------------------------------------
  */

  const partidos = useMemo(() => partidosDeLiga(ratingsSeason, hoy), [ratingsSeason, hoy]);

  const partidosEquipo = useMemo(
    () => Math.max(partidos.length, wyscout?.partidos ? partidosWyscout(wyscout.partidos, hoy) : 0),
    [partidos, wyscout, hoy],
  );

  /* Los del Castilla y, de fuera, sólo quien ha jugado con nosotros. */
  const todos = useMemo<Jugador[]>(
    () =>
      construyeJugadores(fichas, wyscout?.jugadores ?? [], partidos, partidosEquipo)
        .filter((j) => j.ficha.delCastilla || j.minutos > 0 || j.apariciones.some((a) => a.jugo))
        .sort((a, b) => b.minutos - a.minutos || a.ficha.nombre.localeCompare(b.ficha.nombre, "es")),
    [fichas, wyscout, partidos, partidosEquipo],
  );

  const filtrados = useMemo(() => {
    const q = normalize(busca);

    return todos.filter((j) => {
      if (grupo === "castilla" && !j.ficha.delCastilla) return false;
      if (puesto && j.puesto !== puesto) return false;
      if (q && !normalize(j.ficha.nombre).includes(q) && !normalize(j.ficha.apodo).includes(q) && !String(j.ficha.dorsal).includes(q)) return false;
      return true;
    });
  }, [todos, grupo, puesto, busca]);

  const avisos = useMemo(() => avisosDe(filtrados, partidosEquipo), [filtrados, partidosEquipo]);

  const sesionesReg = useMemo(
    () => resumenDeSesiones(almacenSesiones, fichas.map((p) => ({ id: p.id, nombre: p.nombre, apodo: p.apodo }))),
    [almacenSesiones, fichas],
  );

  const seleccionado = useMemo(
    () => filtrados.find((j) => j.ficha.id === selectedId) ?? filtrados[0] ?? null,
    [filtrados, selectedId],
  );

  const abreFicha = (id: string) => {
    setSelectedId(id);
    setVista("jugador");
  };

  /*
  |--------------------------------------------------------------------------
  | CIFRAS DE ARRIBA
  |--------------------------------------------------------------------------
  */

  const posibles = partidosEquipo * 90;
  const delCastilla = filtrados.filter((j) => j.ficha.delCastilla).length;
  const conMinutos = filtrados.filter((j) => j.minutos > 0 || j.apariciones.some((a) => a.jugo)).length;
  const conEdad = filtrados.filter((j) => j.edad !== null && j.fuenteMinutos === "wyscout");
  const minutosConEdad = conEdad.reduce((a, j) => a + j.minutos, 0);
  const minutosSub21 = conEdad.filter((j) => (j.edad ?? 99) <= 20).reduce((a, j) => a + j.minutos, 0);
  const ultimo = partidos[partidos.length - 1];

  const kpis: { title: string; value: string | number; base: string }[] = [
    {
      title: "Jugadores",
      value: filtrados.length,
      base: `${delCastilla} con licencia del Castilla${filtrados.length > delCastilla ? ` y ${filtrados.length - delCastilla} de fuera con minutos` : ""}`,
    },
    {
      title: "Partidos de liga",
      value: partidosEquipo,
      base: `${posibles}′ posibles por jugador`,
    },
    {
      title: "Han jugado",
      value: conMinutos,
      base: `de ${filtrados.length}, al menos un minuto`,
    },
    ...(minutosConEdad > 0
      ? [
          {
            title: "Minutos sub-21",
            value: `${Math.round((minutosSub21 / minutosConEdad) * 100)} %`,
            base: `de los minutos jugados, con 20 años o menos (Wyscout)`,
          },
        ]
      : []),
    {
      title: "Avisos",
      value: avisos.length,
      base: "para hablar esta semana",
    },
  ];

  const hayFiltros = Boolean(busca || puesto || grupo);
  const cuantosFiltros = [puesto, grupo].filter(Boolean).length;

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1 max-sm:pb-20">
        <Topbar />

        <div className="w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {/* CABECERA */}

          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">RMCF CASTILLA · PLANTILLA</p>

            <div className="mt-4 flex min-w-0 items-center gap-4">
              <h1 className="min-w-0 truncate text-2xl font-semibold md:text-4xl">Dashboard de plantilla</h1>
              <div className="hidden h-px min-w-0 flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent md:block" />
            </div>

            {/* De dónde sale cada cosa y hasta cuándo, en una línea. */}
            <p className="mt-2 text-[13px] leading-snug text-white/60">
              {ultimo
                ? `Valoraciones: ${partidos.length} ${partidos.length === 1 ? "partido" : "partidos"}, el último ante ${rivalCorto(ultimo.match.opponent)} (${fechaCorta(ultimo.match.date)})`
                : "Valoraciones: cargando partidos"}
              {" · "}
              {wyEstado === "listo"
                ? `Wyscout: ${wyscout?.partidos ? partidosWyscout(wyscout.partidos, hoy) : 0} partidos del Castilla en la descarga`
                : wyEstado === "cargando"
                  ? "Wyscout: cargando"
                  : "Wyscout no ha respondido: los minutos salen de Valoraciones"}
            </p>
          </div>

          {/* ERROR */}

          {loadError && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertTriangle size={18} className="shrink-0" />
              <span className="min-w-0 flex-1">{loadError}</span>
              <button
                onClick={() => {
                  setLoading(true);
                  setLoadError(null);
                  setReloadKey((key) => key + 1);
                }}
                className="flex items-center gap-2 rounded-xl border border-red-400/40 px-4 py-2 transition hover:bg-red-500/20"
              >
                <RotateCcw size={14} />
                Reintentar
              </button>
            </div>
          )}

          {/* FILTROS */}

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="relative min-w-0 xl:col-span-2">
                <span className="mb-2 block text-[10px] uppercase tracking-wider text-white/40">Buscar</span>
                <Search size={18} className="absolute left-4 top-[2.6rem] text-white/40" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nombre o dorsal..."
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-[#11161D] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#C8A96B]"
                />
              </div>

              <button
                type="button"
                onClick={() => setFiltrosAbiertos((v) => !v)}
                aria-expanded={filtrosAbiertos}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#11161D] px-4 py-3 text-sm text-white/80 sm:hidden"
              >
                <span>Filtros{cuantosFiltros ? ` (${cuantosFiltros})` : ""}</span>
                <span aria-hidden>{filtrosAbiertos ? "−" : "+"}</span>
              </button>

              <div className={`${filtrosAbiertos ? "grid gap-3" : "hidden"} min-w-0 sm:contents`}>
                <FilterSelect
                  label="Puesto"
                  placeholder="Todos los puestos"
                  value={puesto}
                  onChange={(v) => setPuesto(v as Puesto | "")}
                  options={PUESTOS.map((p) => ({ value: p.key, label: p.label }))}
                />
                <FilterSelect
                  label="Grupo"
                  placeholder="Todos los que juegan con el Castilla"
                  value={grupo}
                  onChange={(v) => setGrupo(v as "" | "castilla")}
                  options={[{ value: "castilla", label: "Sólo licencia del Castilla" }]}
                />
              </div>
            </div>

            {hayFiltros && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                {busca && <Chip label="Búsqueda" value={busca} onClear={() => setBusca("")} />}
                {puesto && <Chip label="Puesto" value={etiquetaPuesto(puesto)} onClear={() => setPuesto("")} />}
                {grupo && <Chip label="Grupo" value="Licencia del Castilla" onClear={() => setGrupo("")} />}
                <button
                  onClick={() => {
                    setBusca("");
                    setPuesto("");
                    setGrupo("");
                  }}
                  className="ml-auto flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2 text-sm text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                >
                  <RotateCcw size={14} />
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <DashboardSkeleton />
          ) : fichas.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">
              La hoja de la plantilla no ha devuelto jugadores.
            </div>
          ) : (
            <>
              {/* CIFRAS */}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
                {kpis.map((kpi) => (
                  <div key={kpi.title} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] p-3 sm:p-4">
                    <div className="text-xs text-white/50 sm:text-sm">{kpi.title}</div>
                    <div className="mt-1 text-2xl font-bold tracking-tight text-white sm:mt-2 sm:text-3xl">{kpi.value}</div>
                    <div className="mt-1 text-[11px] leading-snug text-white/45 sm:text-xs">{kpi.base}</div>
                  </div>
                ))}
              </div>

              <div className="sticky top-0 z-20 -mx-4 bg-[#0B0F14] px-4 py-2 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
                <Pestanas
                  pegada={false}
                  etiqueta="Vistas del dashboard de plantilla"
                  valor={vista}
                  onCambia={setVista}
                  opciones={[
                    { clave: "plantilla", label: "¿Cómo está la plantilla?", corto: "Plantilla" },
                    { clave: "jornadas", label: "¿Quién juega cada jornada?", corto: "Jornadas" },
                    { clave: "jugador", label: "¿Cómo está cada uno?", corto: "Jugador" },
                    { clave: "rendimiento", label: "¿Quién rinde más?", corto: "Rendimiento" },
                  ]}
                />
              </div>

              {filtrados.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">
                  Ningún jugador coincide con los filtros seleccionados.
                </div>
              ) : (
                <>
                  {vista === "plantilla" && (
                    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                      <div className="min-w-0 space-y-6">
                        <BloqueMinutos jugadores={filtrados} posibles={posibles} onAbre={abreFicha} />
                      </div>
                      <div className="min-w-0 space-y-6">
                        <BloqueAvisos avisos={avisos} onAbre={abreFicha} partidosEquipo={partidosEquipo} />
                        <BloqueEdad jugadores={filtrados} />
                        <BloqueContratos jugadores={filtrados} />
                        <BloqueSesiones resumen={sesionesReg} jugadores={filtrados} />
                      </div>
                    </div>
                  )}

                  {vista === "jornadas" && <BloqueJornadas jugadores={filtrados} partidos={partidos} onAbre={abreFicha} />}

                  {vista === "jugador" && seleccionado && (
                    <FichaJugador
                      jugador={seleccionado}
                      lista={filtrados}
                      partidos={partidos}
                      posibles={posibles}
                      sesiones={sesionesReg}
                      onSelect={setSelectedId}
                    />
                  )}

                  {vista === "rendimiento" && (
                    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
                      <BloqueNotas jugadores={filtrados} onAbre={abreFicha} />
                      <BloqueIndice jugadores={filtrados} onAbre={abreFicha} wyEstado={wyEstado} />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| PIEZAS COMUNES
|--------------------------------------------------------------------------
*/

/** Un bloque: la pregunta que responde y de dónde sale lo que enseña. */
function Bloque({
  pregunta,
  base,
  children,
}: {
  pregunta: string;
  base: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:p-5">
      <h2 className="text-base font-semibold tracking-wide text-neutral-100 md:text-lg">{pregunta}</h2>
      <p className="mt-1 text-xs leading-snug text-white/55">{base}</p>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  );
}

/** Barra horizontal 0-100 con su color. */
function Barra({ pct, color, alto = "h-2" }: { pct: number; color: string; alto?: string }) {
  return (
    <div className={`${alto} w-full overflow-hidden rounded-full`} style={{ background: tinta(0.1) }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full min-w-0 rounded-xl border bg-[#11161D] px-3 py-3 text-sm outline-none transition focus:border-[#C8A96B] ${
          value ? "border-[#C8A96B]/50 text-[#C8A96B]" : "border-white/10 text-white/80"
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Chip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 py-1 pl-3 pr-1 text-xs text-[#C8A96B]">
      <span className="text-white/40">{label}:</span>
      <span className="max-w-[160px] truncate font-medium">{value}</span>
      <button onClick={onClear} aria-label={`Quitar filtro ${label}`} className="rounded-full p-1 transition hover:bg-[#C8A96B]/20">
        <X size={12} />
      </button>
    </span>
  );
}

/** La foto de la ficha; si no hay o no carga, las iniciales. */
function FotoOIniciales({ foto, nombre }: { foto: string; nombre: string }) {
  const [falla, setFalla] = useState(false);

  if (foto && !falla) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={foto} alt={nombre} className="h-full w-full object-cover" onError={() => setFalla(true)} />
    );
  }

  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0])
    .join("")
    .toUpperCase();

  return (
    <div role="img" aria-label={nombre} className="flex h-full items-center justify-center bg-[#C8A96B]/15 text-xl font-bold text-[#C8A96B]">
      {iniciales || <UserRound size={32} />}
    </div>
  );
}

/** Lo de fuera de la licencia del Castilla, marcado al lado del nombre. */
function DeFuera({ jugador }: { jugador: Jugador }) {
  if (jugador.ficha.delCastilla) return null;

  return (
    <span className="ml-1.5 shrink-0 rounded-full border border-white/15 px-1.5 py-px text-[10px] text-white/55" title={`Licencia ${jugador.ficha.licencia}`}>
      {jugador.ficha.licencia}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| ¿QUIÉN JUEGA Y CUÁNTO?
|--------------------------------------------------------------------------
*/

function BloqueMinutos({ jugadores, posibles, onAbre }: { jugadores: Jugador[]; posibles: number; onAbre: (id: string) => void }) {
  const deValoraciones = jugadores.some((j) => j.fuenteMinutos === "valoraciones" && j.minutos > 0);

  return (
    <Bloque
      pregunta="¿Quién juega y cuánto, puesto a puesto?"
      base={
        <>
          Minutos de Wyscout sobre los {posibles}′ posibles. Titular y suplente, de Valoraciones (titular: marcado o 90′ jugados).
          {deValoraciones ? " Con asterisco, minutos de Valoraciones: no tiene fila en Wyscout." : ""} En naranja, menos del 25 %.
        </>
      }
    >
      <div className="space-y-5">
        {PUESTOS.map((p) => {
          const suyos = jugadores.filter((j) => j.puesto === p.key);
          if (!suyos.length) return null;

          const fijos = suyos.filter((j) => (j.pct ?? 0) >= 50).length;

          return (
            <div key={p.key} className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-white/5 pb-1.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">{p.label}</h3>
                <span className="text-[11px] text-white/50">
                  {suyos.length} {suyos.length === 1 ? "jugador" : "jugadores"} · {fijos} con la mitad de los minutos o más
                </span>
              </div>

              <ul className="mt-2 space-y-1">
                {suyos.map((j) => {
                  const pct = j.pct ?? 0;

                  return (
                    <li key={j.ficha.id}>
                      <button
                        type="button"
                        onClick={() => onAbre(j.ficha.id)}
                        className="grid w-full min-w-0 grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-white/[0.04] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]"
                      >
                        <span className="flex min-w-0 items-center text-sm text-white/85">
                          <span className="truncate">{nombreDe(j)}</span>
                          <DeFuera jugador={j} />
                        </span>

                        <Barra pct={pct} color={pct < 25 ? PEOR : ORO} />

                        <span className="text-right tabular-nums">
                          <span className="block text-sm font-semibold text-white">
                            {j.minutos}′{j.fuenteMinutos === "valoraciones" && j.minutos > 0 ? "*" : ""}
                            <span className="ml-1.5 text-xs font-normal text-white/50">{pct} %</span>
                          </span>
                          {j.titular + j.suplente > 0 && (
                            <span className="block text-[11px] text-white/50">
                              {j.titular} tit. · {j.suplente} sup.
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Bloque>
  );
}

/*
|--------------------------------------------------------------------------
| AVISOS
|--------------------------------------------------------------------------
*/

const ORDEN_AVISOS: TipoAviso[] = ["sinJugar", "pocos", "amarillas", "carga", "nota"];

function BloqueAvisos({
  avisos,
  onAbre,
  partidosEquipo,
}: {
  avisos: Aviso<Ficha>[];
  onAbre: (id: string) => void;
  partidosEquipo: number;
}) {
  return (
    <Bloque
      pregunta="¿De quién hay que hablar esta semana?"
      base={`Sólo licencia del Castilla. Minutos y amarillas de Wyscout; partidos y notas, de Valoraciones (${partidosEquipo} partidos). Los porteros no entran en los avisos de minutos.`}
    >
      {avisos.length === 0 ? (
        <p className="text-sm text-white/60">Con estas reglas no sale ningún aviso esta semana.</p>
      ) : (
        <div className="space-y-4">
          {ORDEN_AVISOS.map((tipo) => {
            const suyos = avisos.filter((a) => a.tipo === tipo);
            if (!suyos.length) return null;
            const def = AVISOS[tipo];

            return (
              <div key={tipo} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-sm font-semibold text-white">
                  {def.titulo} <span className="font-normal text-white/50">· {suyos.length}</span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/50">
                  {def.regla}. Qué hacer: {def.accion}.
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {suyos.map((a) => (
                    <li key={a.jugador.ficha.id}>
                      <button
                        type="button"
                        onClick={() => onAbre(a.jugador.ficha.id)}
                        className="min-h-[36px] rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-left text-xs transition hover:border-[#C8A96B]"
                      >
                        <span className="font-medium text-white/90">{nombreDe(a.jugador)}</span>
                        <span className="ml-1.5 tabular-nums text-white/55">{a.cifra}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Bloque>
  );
}

/*
|--------------------------------------------------------------------------
| EDAD Y CONTRATOS
|--------------------------------------------------------------------------
*/

function BloqueEdad({ jugadores }: { jugadores: Jugador[] }) {
  const conEdad = jugadores.filter((j) => j.edad !== null);
  if (!conEdad.length) return null;

  const total = conEdad.reduce((a, j) => a + j.minutos, 0);
  const edadMedia = total > 0 ? conEdad.reduce((a, j) => a + (j.edad ?? 0) * j.minutos, 0) / total : null;

  const tramos = [
    { label: "18 o menos", test: (e: number) => e <= 18 },
    { label: "19", test: (e: number) => e === 19 },
    { label: "20", test: (e: number) => e === 20 },
    { label: "21", test: (e: number) => e === 21 },
    { label: "22", test: (e: number) => e === 22 },
    { label: "23 o más", test: (e: number) => e >= 23 },
  ]
    .map((t) => {
      const suyos = conEdad.filter((j) => t.test(j.edad ?? 0));
      const minutos = suyos.reduce((a, j) => a + j.minutos, 0);
      return { ...t, suyos, minutos, pct: total > 0 ? Math.round((minutos / total) * 100) : 0 };
    })
    .filter((t) => t.suyos.length);

  return (
    <Bloque
      pregunta="¿Qué edad tiene quien juega?"
      base={`Edad de Wyscout de los ${conEdad.length} con fila${conEdad.length < jugadores.length ? ` (de ${jugadores.length})` : ""}. La barra es su parte de los minutos jugados.`}
    >
      {edadMedia !== null && (
        <p className="mb-3 text-sm text-white/75">
          Edad media en el campo, pesada por minutos: <span className="font-semibold text-white">{coma(edadMedia)} años</span>
        </p>
      )}
      <ul className="space-y-2">
        {tramos.map((t) => (
          <li key={t.label} className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span className="text-white/70">{t.label}</span>
            <Barra pct={t.pct} color={ORO} />
            <span className="text-right tabular-nums text-white/60" title={t.suyos.map(nombreDe).join(", ")}>
              {t.pct} % · {t.suyos.length}
            </span>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

function BloqueContratos({ jugadores }: { jugadores: Jugador[] }) {
  const conFecha = jugadores.filter((j) => /^\d{4}-\d{2}-\d{2}$/.test(j.contrato));
  if (!conFecha.length) return null;

  const porFecha = new Map<string, Jugador[]>();
  for (const j of conFecha) porFecha.set(j.contrato, [...(porFecha.get(j.contrato) ?? []), j]);
  const fechas = [...porFecha.keys()].sort();

  return (
    <Bloque
      pregunta="¿Cuándo acaban los contratos?"
      base={`Fecha de fin de contrato que publica Wyscout, de ${conFecha.length} de ${jugadores.length} jugadores.`}
    >
      <ul className="space-y-2">
        {fechas.map((f, i) => (
          <li key={f} className="min-w-0 text-sm">
            <span className="font-semibold" style={{ color: i === 0 ? ORO : undefined }}>
              Hasta {mesAnio(f)}
            </span>
            <span className="text-white/50"> · {porFecha.get(f)!.length}</span>
            <p className="text-[13px] leading-snug text-white/70">{porFecha.get(f)!.map(nombreDe).join(", ")}</p>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

/*
|--------------------------------------------------------------------------
| SESIONES REGISTRADAS
|--------------------------------------------------------------------------
*/

function BloqueSesiones({ resumen, jugadores }: { resumen: ResumenSesiones; jugadores: Jugador[] }) {
  const filas = jugadores
    .map((j) => ({ j, d: resumen.porJugador.get(j.ficha.id) }))
    .filter((f): f is { j: Jugador; d: SesionesDeJugador } => Boolean(f.d))
    .sort((a, b) => b.d.sesiones - a.d.sesiones || a.j.ficha.nombre.localeCompare(b.j.ficha.nombre, "es"));

  if (!resumen.totalSesiones || !filas.length) return null;

  const media = filas.reduce((acc, f) => acc + f.d.sesiones, 0) / filas.length;

  return (
    <Bloque
      pregunta="¿Quién entrena con el grupo?"
      base={`Sesiones registradas en Jugadores sesión ${SESIONES_DESDE_TEXTO}: ${resumen.totalSesiones} ${resumen.totalSesiones === 1 ? "sesión" : "sesiones"}, media de ${coma(media)} por jugador.`}
    >
      <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {filas.map(({ j, d }) => (
          <li key={j.ficha.id} className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-white/75">{nombreDe(j)}</span>
            <span className="shrink-0 tabular-nums text-white/55">
              {d.sesiones} de {resumen.totalSesiones}
            </span>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

/*
|--------------------------------------------------------------------------
| ¿QUIÉN JUEGA CADA JORNADA?
|--------------------------------------------------------------------------
*/

function Celda({ a }: { a: JugadorDash["apariciones"][number] }) {
  if (!a.jugo) {
    return <span className="block h-8 w-9 rounded-md border border-dashed" style={{ borderColor: tinta(0.14) }} aria-label="No jugó" />;
  }

  const texto = a.minutos !== null ? String(a.minutos) : "•";

  return (
    <span
      className="flex h-8 w-9 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
      style={
        a.titular
          ? { background: oroAl(85), color: "var(--rmcf-on-gold)" }
          : { background: oroAl(28), color: tinta(0.9) }
      }
      aria-label={`${a.titular ? "Titular" : "Suplente"}${a.minutos !== null ? `, ${a.minutos} minutos` : ", minutos sin anotar"}`}
    >
      {texto}
    </span>
  );
}

function BloqueJornadas({ jugadores, partidos, onAbre }: { jugadores: Jugador[]; partidos: PartidoLiga[]; onAbre: (id: string) => void }) {
  if (!partidos.length) {
    return (
      <Bloque pregunta="¿Quién juega cada jornada?" base="Valoraciones de partido.">
        <p className="text-sm text-white/60">Valoraciones todavía no ha devuelto partidos jugados.</p>
      </Bloque>
    );
  }

  const usados = partidos.map((_, i) => jugadores.filter((j) => j.apariciones[i]?.jugo).length);

  return (
    <Bloque
      pregunta="¿Quién juega cada jornada?"
      base="Valoraciones de partido: en oro fuerte, titular (marcado o 90′); en oro suave, desde el banquillo; con un punto, jugó sin minutos anotados; en blanco, no jugó. La cifra son sus minutos."
    >
      <div className="-mx-1 overflow-x-auto pb-2">
        <table className="min-w-full border-separate" style={{ borderSpacing: "4px 3px" }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[8.5rem] bg-[#0B0F14] text-left text-[11px] font-medium text-white/50">Jugador</th>
              {partidos.map((p) => (
                <th key={p.match.id} className="text-center text-[10px] font-medium leading-tight text-white/55" title={`${p.match.opponent} · ${fechaCorta(p.match.date)}${p.match.result ? ` · ${p.match.result}` : ""}`}>
                  <span className="block font-semibold text-white/80">J{p.jornada}</span>
                  <span className="block max-w-[3rem] truncate">{rivalCorto(p.match.opponent)}</span>
                </th>
              ))}
              <th className="pl-2 text-right text-[10px] font-medium text-white/50">Tit · Sup</th>
            </tr>
          </thead>
          <tbody>
            {PUESTOS.map((pu) => {
              const suyos = jugadores.filter((j) => j.puesto === pu.key);
              if (!suyos.length) return null;

              return [
                <tr key={`${pu.key}-cab`}>
                  <td colSpan={partidos.length + 2} className="sticky left-0 bg-[#0B0F14] pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">
                    {pu.label}
                  </td>
                </tr>,
                ...suyos.map((j) => (
                  <tr key={j.ficha.id}>
                    <td className="sticky left-0 z-10 bg-[#0B0F14] pr-2">
                      <button type="button" onClick={() => onAbre(j.ficha.id)} className="flex max-w-[9rem] items-center truncate text-left text-[13px] text-white/85 hover:text-[#C8A96B]">
                        <span className="truncate">{nombreDe(j)}</span>
                      </button>
                    </td>
                    {j.apariciones.map((a, i) => (
                      <td key={partidos[i].match.id}>
                        <Celda a={a} />
                      </td>
                    ))}
                    <td className="pl-2 text-right text-[12px] tabular-nums text-white/65">
                      {j.titular} · {j.suplente}
                    </td>
                  </tr>
                )),
              ];
            })}
            <tr>
              <td className="sticky left-0 z-10 bg-[#0B0F14] pt-3 text-[11px] text-white/55">Jugadores usados</td>
              {usados.map((n, i) => (
                <td key={partidos[i].match.id} className="pt-3 text-center text-[12px] font-semibold tabular-nums text-white/75">
                  {n}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </Bloque>
  );
}

/*
|--------------------------------------------------------------------------
| ¿CÓMO ESTÁ CADA UNO?
|--------------------------------------------------------------------------
*/

function Cifra({ titulo, valor, base }: { titulo: string; valor: string; base: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[11px] text-white/50">{titulo}</div>
      <div className="mt-0.5 text-xl font-bold text-white">{valor}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-white/45">{base}</div>
    </div>
  );
}

function MetricBar({ label, value, reference }: { label: string; value: number; reference: number }) {
  const diff = Number((value - reference).toFixed(1));

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate text-white/55">{label}</span>
        <span className="shrink-0 font-semibold text-white">
          {coma(value)}
          <span
            className="ml-2 font-normal"
            style={{ color: Math.abs(diff) < 1 ? tinta(0.5) : diff > 0 ? MEJOR : PEOR }}
            title="Frente a la media de los jugadores con ficha"
          >
            {diff > 0 ? "+" : ""}
            {coma(diff)}
          </span>
        </span>
      </div>
      <div className="mt-1.5">
        <Barra pct={(value / 10) * 100} color={ORO} />
      </div>
    </div>
  );
}

function Percentiles({ titulo, filas }: { titulo: string; filas: Jugador["fuertes"] }) {
  if (!filas.length) return null;

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">{titulo}</p>
      <ul className="mt-2 space-y-2">
        {filas.map((f) => (
          <li key={f.metrica.columna} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-white/75" title={f.metrica.columna}>
                {f.metrica.nombre}
              </span>
              <span className="shrink-0 tabular-nums text-white/60">percentil {f.percentil}</span>
            </div>
            <div className="mt-1">
              <Barra pct={f.percentil} color={f.percentil >= 60 ? MEJOR : f.percentil < 40 ? PEOR : ORO} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FichaJugador({
  jugador: j,
  lista,
  partidos,
  posibles,
  sesiones,
  onSelect,
}: {
  jugador: Jugador;
  lista: Jugador[];
  partidos: PartidoLiga[];
  posibles: number;
  sesiones: ResumenSesiones;
  onSelect: (id: string) => void;
}) {
  const index = lista.findIndex((x) => x.ficha.id === j.ficha.id);
  const conFicha = lista.filter((x) => x.ficha.valorado);
  const mediaDe = (k: MetricaKey) => (conFicha.length ? conFicha.reduce((a, x) => a + x.ficha[k], 0) / conFicha.length : 0);
  const sesionesSuyas = sesiones.porJugador.get(j.ficha.id);
  const sigla = j.wy?.posicion.split(",")[0]?.trim() ?? "";
  const dondeJuega = sigla ? puestoEnPalabras(sigla) : "";

  const datos = [
    nombrePuesto(j.ficha.posicionHoja),
    dondeJuega ? `juega de ${dondeJuega} (Wyscout)` : "",
    j.ficha.licencia,
    j.edad !== null ? `${j.edad} años` : "",
    /^\d{4}-\d{2}-\d{2}$/.test(j.contrato) ? `contrato hasta ${mesAnio(j.contrato)}` : "",
  ].filter(Boolean);

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F14]">
              <FotoOIniciales foto={j.ficha.foto} nombre={j.ficha.nombre} />
            </div>
            <div className="min-w-0 flex-1">
              {j.ficha.dorsal && <span className="text-sm font-bold text-[#C8A96B]">#{j.ficha.dorsal}</span>}
              <h2 className="truncate text-lg font-semibold">{nombreDe(j)}</h2>
              <p className="break-words text-xs leading-snug text-white/55">{datos.join(" · ")}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => index > 0 && onSelect(lista[index - 1].ficha.id)}
              disabled={index <= 0}
              className="min-h-[44px] rounded-lg border border-white/40 px-3 text-sm font-medium text-white/85 transition hover:border-[#C8A96B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              ← Anterior
            </button>
            <select
              value={j.ficha.id}
              onChange={(e) => onSelect(e.target.value)}
              aria-label="Elegir jugador"
              className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-white/10 bg-[#11161D] px-2 text-sm text-white/85 outline-none focus:border-[#C8A96B]"
            >
              {lista.map((x) => (
                <option key={x.ficha.id} value={x.ficha.id}>
                  {nombreDe(x)}
                </option>
              ))}
            </select>
            <button
              onClick={() => index < lista.length - 1 && onSelect(lista[index + 1].ficha.id)}
              disabled={index >= lista.length - 1}
              className="min-h-[44px] rounded-lg border border-white/40 px-3 text-sm font-medium text-white/85 transition hover:border-[#C8A96B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Siguiente →
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Cifra
              titulo="Minutos"
              valor={`${j.minutos}′`}
              base={`${j.pct ?? 0} % de ${posibles}′ · ${j.fuenteMinutos === "wyscout" ? "Wyscout" : "Valoraciones"}`}
            />
            <Cifra
              titulo="Partidos"
              valor={String(j.partidos)}
              base={j.titular + j.suplente > 0 ? `${j.titular} de titular y ${j.suplente} de suplente (Valoraciones)` : `de ${partidos.length} de liga`}
            />
            <Cifra
              titulo="Goles y asistencias"
              valor={`${j.goles} · ${j.asistencias}`}
              base={j.wy ? "Wyscout, temporada" : "Valoraciones"}
            />
            {j.notas ? (
              <Cifra
                titulo="Nota de partido"
                valor={formatRating(j.notas.avg)}
                base={`${j.notas.played} ${j.notas.played === 1 ? "partido valorado" : "partidos valorados"} · forma ${formatRating(j.notas.form)} (5 últimos)`}
              />
            ) : (
              <Cifra titulo="Amarillas" valor={String(j.amarillas ?? 0)} base={j.amarillas !== null ? "Wyscout, temporada" : "Valoraciones"} />
            )}
          </div>

          {sesionesSuyas && (
            <p className="mt-4 border-t border-white/5 pt-3 text-sm text-white/70">
              Sesiones registradas {SESIONES_DESDE_TEXTO}: estuvo en {sesionesSuyas.sesiones} de {sesiones.totalSesiones}
              {sesionesSuyas.tareasTotales > 0 ? `; hizo ${sesionesSuyas.tareasHechas} de ${sesionesSuyas.tareasTotales} tareas` : ""}
              {sesionesSuyas.comodin > 0 ? `, ${sesionesSuyas.comodin} como comodín` : ""}.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/5 pt-3 text-xs">
            <Link href={`/individual?player=${encodeURIComponent(j.ficha.id)}`} className="text-[#C8A96B] transition hover:text-[#e0c68d]">
              Ficha completa en Plantilla
            </Link>
            {j.wy && (
              <Link href={`/data-analisis?area=individual&jugador=${encodeURIComponent(j.wy.jugador)}`} className="text-[#C8A96B] transition hover:text-[#e0c68d]">
                Sus datos en Data análisis
              </Link>
            )}
            {j.ficha.hudl && (
              <a href={j.ficha.hudl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#C8A96B] transition hover:text-[#e0c68d]">
                Hudl
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </section>
      </div>

      <div className="min-w-0 space-y-6">
        {partidos.length > 0 && (
          <Bloque
            pregunta="¿Cuánto ha jugado cada jornada?"
            base="Minutos de Valoraciones por partido; en oro fuerte, de titular. Con un punto, jugó sin minutos anotados."
          >
            <div className="flex min-w-0 items-end gap-1.5 overflow-x-auto pb-1">
              {j.apariciones.map((a, i) => {
                const p = partidos[i];
                const alto = a.jugo ? (a.minutos !== null ? Math.max(8, (a.minutos / 90) * 100) : 30) : 0;

                return (
                  <div key={p.match.id} className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-1" title={`${p.match.opponent} · ${fechaCorta(p.match.date)}`}>
                    <span className="text-[11px] tabular-nums text-white/70">{a.jugo ? (a.minutos !== null ? a.minutos : "•") : ""}</span>
                    <div className="flex h-24 w-full items-end rounded-md" style={{ background: tinta(0.05) }}>
                      <div className="w-full rounded-md" style={{ height: `${alto}%`, background: a.titular ? oroAl(85) : oroAl(35) }} />
                    </div>
                    <span className="text-[10px] font-semibold text-white/70">J{p.jornada}</span>
                    <span className="max-w-[3rem] truncate text-[10px] text-white/45">{rivalCorto(p.match.opponent)}</span>
                  </div>
                );
              })}
            </div>
          </Bloque>
        )}

        {(j.fuertes.length > 0 || j.flojos.length > 0) && (
          <Bloque
            pregunta="¿Qué hace mejor y peor que los de su puesto?"
            base={`Wyscout, temporada: percentil contra los ${j.contraPuesto} jugadores de ${etiquetaPuesto(j.puesto).toLowerCase()} de la liga con 90′ o más. 50 es la media; más es mejor.${j.indice !== null ? ` Su media en todas las métricas de su puesto: ${j.indice}.` : ""}`}
          >
            <div className="grid min-w-0 gap-5 sm:grid-cols-2">
              <Percentiles titulo="Lo que más destaca" filas={j.fuertes} />
              <Percentiles titulo="Lo que más le falta" filas={j.flojos} />
            </div>
          </Bloque>
        )}

        {j.ficha.valorado && (
          <Bloque
            pregunta="¿Cómo le ve el cuerpo técnico?"
            base={`Ficha de competencias de la hoja JUGADORES, de 0 a 10. La diferencia es frente a la media de los ${conFicha.length} con ficha en la lista; en gris, si es menor de 1 punto.`}
          >
            <div className="space-y-3">
              {METRICAS.map(({ key, label }) => (
                <MetricBar key={key} label={label} value={j.ficha[key]} reference={mediaDe(key)} />
              ))}
            </div>

            {(j.ficha.fortalezas || j.ficha.aspectosMejora) && (
              <div className="mt-5 space-y-4 border-t border-white/5 pt-4 text-sm">
                {j.ficha.fortalezas && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-300">Fortalezas</p>
                    <p className="mt-1 whitespace-pre-line text-white/75">{j.ficha.fortalezas}</p>
                  </div>
                )}
                {j.ficha.aspectosMejora && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#C8A96B]">Aspectos de mejora</p>
                    <p className="mt-1 whitespace-pre-line text-white/75">{j.ficha.aspectosMejora}</p>
                  </div>
                )}
              </div>
            )}
          </Bloque>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ¿QUIÉN RINDE MÁS?
|--------------------------------------------------------------------------
*/

const MINIMO_NOTAS = 3;

function BloqueNotas({ jugadores, onAbre }: { jugadores: Jugador[]; onAbre: (id: string) => void }) {
  const lista = jugadores
    .filter((j) => (j.notas?.played ?? 0) >= MINIMO_NOTAS)
    .sort((a, b) => (b.notas?.avg ?? 0) - (a.notas?.avg ?? 0));
  const fuera = jugadores.filter((j) => j.notas && j.notas.played < MINIMO_NOTAS).length;

  return (
    <Bloque
      pregunta="¿Quién tiene mejor nota de partido?"
      base={`Nota media del cuerpo técnico en Valoraciones, de 0 a 10, con ${MINIMO_NOTAS} partidos valorados o más${fuera ? ` (${fuera} con menos quedan fuera)` : ""}. Entre paréntesis, la de los cinco últimos.`}
    >
      {lista.length === 0 ? (
        <p className="text-sm text-white/60">Todavía nadie tiene {MINIMO_NOTAS} partidos valorados.</p>
      ) : (
        <ul className="space-y-1">
          {lista.map((j, i) => (
            <li key={j.ficha.id}>
              <button
                type="button"
                onClick={() => onAbre(j.ficha.id)}
                className="grid w-full min-w-0 grid-cols-[1.5rem_minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition hover:bg-white/[0.04] sm:grid-cols-[1.5rem_minmax(0,10rem)_minmax(0,1fr)_auto]"
              >
                <span className="text-right text-xs tabular-nums text-white/45">{i + 1}</span>
                <span className="min-w-0 truncate text-sm text-white/85">{nombreDe(j)}</span>
                <Barra pct={((j.notas?.avg ?? 0) / 10) * 100} color={ratingColor(j.notas?.avg ?? 0)} />
                <span className="text-right text-sm tabular-nums">
                  <span className="font-semibold text-white">{formatRating(j.notas?.avg ?? 0)}</span>
                  <span className="ml-1 text-xs text-white/50">
                    ({formatRating(j.notas?.form ?? 0)}) · {j.notas?.played}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  );
}

function BloqueIndice({ jugadores, onAbre, wyEstado }: { jugadores: Jugador[]; onAbre: (id: string) => void; wyEstado: "cargando" | "listo" | "falla" }) {
  const lista = jugadores.filter((j) => j.indice !== null).sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0));

  return (
    <Bloque
      pregunta="¿Quién rinde más para su puesto según Wyscout?"
      base="Media de sus percentiles en las métricas de su puesto contra los de ese puesto en la liga (Wyscout, temporada, 90′ o más). 50 es la media de la liga; en verde desde 60, en naranja por debajo de 45."
    >
      {lista.length === 0 ? (
        <p className="text-sm text-white/60">
          {wyEstado === "cargando" ? "Cargando Wyscout." : "Wyscout no ha devuelto jugadores del Castilla con 90′ o más."}
        </p>
      ) : (
        <ul className="space-y-1">
          {lista.map((j, i) => {
            const v = j.indice ?? 0;

            return (
              <li key={j.ficha.id}>
                <button
                  type="button"
                  onClick={() => onAbre(j.ficha.id)}
                  className="grid w-full min-w-0 grid-cols-[1.5rem_minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition hover:bg-white/[0.04] sm:grid-cols-[1.5rem_minmax(0,10rem)_minmax(0,1fr)_auto]"
                >
                  <span className="text-right text-xs tabular-nums text-white/45">{i + 1}</span>
                  <span className="min-w-0 truncate text-sm text-white/85">{nombreDe(j)}</span>
                  <Barra pct={v} color={v >= 60 ? MEJOR : v < 45 ? PEOR : ORO} />
                  <span className="text-right text-sm tabular-nums">
                    <span className="font-semibold text-white">{v}</span>
                    <span className="ml-1 text-xs text-white/50">{PUESTOS.find((p) => p.key === j.puesto)?.corto}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Bloque>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-[360px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
        ))}
      </div>
    </div>
  );
}
