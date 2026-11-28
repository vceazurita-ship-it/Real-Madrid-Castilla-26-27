"use client";
import { traeCsv } from "@/lib/hojaCsv";
import { ResponsiveConVistas } from "@/components/data/visual/ResponsiveConVistas";
import { EstadoError, Hueso } from "@/components/ui/estados";

import { chipInk } from "@/lib/theme";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Check,
  Eraser,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import Papa from "papaparse";
import { isHiddenPlayer } from "@/lib/hiddenPlayers";
import { coma } from "@/lib/formatoNumero";
import { posicionDe } from "@/lib/posiciones";
import { nombreVisible } from "@/lib/nombreJugador";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
} from "recharts";

import {
  AXES,
  CLAVE_DOC_EMOCIONAL,
  DOC_EMOCIONAL_VACIO,
  SCALE,
  SERIES_COLORS,
  aplicaEdiciones,
  average,
  labelFor,
  nombreLargo,
  normalizaDocEmocional,
  toneFor,
  type DocEmocional,
  type GroupKey,
  type MetricKey,
  type Player,
} from "./modelo";
import { CampoEmocional } from "./CampoEmocional";
import { EditorValoraciones, type CambioEmocional, type CandidatoEmocional, type Valores } from "./EditorValoraciones";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { usePlayers } from "@/hooks/usePlayers";
import { SaveState } from "@/components/abp/ui";
import { casaNombre, mejorCasado } from "@/lib/tactics/onceDeLaPizarra";

const valoresDe = (p: Player): Valores => ({ ea: p.ea, ie: p.ie, ia: p.ia, ee: p.ee });

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=970113485&single=true&output=csv";

const VIDEO_ID = "1pKrNKJwbiXjsKP4cJ8ROE-2E8-PlLyi8";
const VIDEO_URL = `https://drive.google.com/file/d/${VIDEO_ID}/view`;
const VIDEO_EMBED = `https://drive.google.com/file/d/${VIDEO_ID}/preview`;


/* Por debajo de esto la media es una tendencia, no un diagnóstico. */
const MUESTRA_MINIMA = 12;

/* 16/11/2026 (jueces): por debajo de 25 valoraciones, la media de una línea es tendencia. */
const VALORACIONES_FIRMES = 25;

/* Hoy, como «AAAA-MM-DD», leído fuera del render (regla de pureza del linter). */
const nadaQueOir = () => () => {};
/* 28/11/2026: el día LOCAL (con toISOString, de madrugada era aún ayer en UTC). */
const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};


const EMPTY_GROUPS: Record<GroupKey, string[]> = {
  keeper: [],
  leftSide: [],
  defense: [],
  rightSide: [],
  midfield: [],
  strikers: [],
};

/* Composición por defecto, sin once en la pizarra: sale de los jugadores de
   la base emocional por su demarcación en la hoja (con las correcciones de
   lib/posiciones.ts). Son las seis líneas de los radares y un jugador puede
   estar en varias: el lateral izquierdo, en portero y defensa, en defensa y
   en el perfil izquierdo. */
const PUESTOS_DE: Record<GroupKey, string[]> = {
  keeper: ["PORTERO", "1", "13", "LATERAL I.", "LATERAL D.", "CENTRAL"],
  defense: ["LATERAL I.", "LATERAL D.", "CENTRAL"],
  leftSide: ["LATERAL I.", "11"],
  rightSide: ["LATERAL D.", "7"],
  midfield: ["6", "8", "10"],
  strikers: ["9", "10", "7", "11"],
};

function gruposPorDefecto(rows: Player[]): Record<GroupKey, string[]> {
  const grupos: Record<GroupKey, string[]> = { ...EMPTY_GROUPS };

  for (const clave of Object.keys(PUESTOS_DE) as GroupKey[]) {
    grupos[clave] = rows
      .filter((r) => PUESTOS_DE[clave].includes(posicionDe(r.jugador, r.posicion).trim().toUpperCase()))
      .map((r) => r.jugador);
  }

  return grupos;
}

function num(v?: string) {
  return Number(String(v || "").replace(",", ".")) || 0;
}

/* Una nota de verdad: número, con coma o punto. */
const ES_NOTA = /^\s*\d+(?:[.,]\d+)?\s*$/;

function parseCSV(text: string): Player[] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  /*
  | Sólo filas con las cuatro notas (19/10/2026). La hoja lleva encima un
  | título, los rótulos de los cuadrantes y la cabecera «POSICION, JUGADOR,
  | E.A.…»; ésta tenía nombre en la segunda columna y entraba como un jugador
  | llamado «JUGADOR» con todo a cero: salía en los selectores y hundía la
  | media de la plantilla y de cada eje. Un jugador sin evaluar tampoco es un
  | cero.
  */
  return parsed.data
    .filter((r) => [r[2], r[3], r[4], r[5]].every((v) => ES_NOTA.test(v ?? "")))
    /* Las cuatro notas exactamente en 5 son el relleno de la hoja, no una
       evaluación: no entran en radares ni en medias. */
    .filter((r) => ![r[2], r[3], r[4], r[5]].every((v) => num(v) === 5))
    .map((r) => ({
      posicion: r[0]?.trim() || "",
      jugador: r[1]?.trim() || "",
      ea: num(r[2]),
      ie: num(r[3]),
      ia: num(r[4]),
      ee: num(r[5]),
    }))
    .filter((r) => r.jugador && !isHiddenPlayer(r.jugador));
}

/* Comparación tolerante a acentos para el buscador de jugadores. */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function EmotionPage() {
  const videoRef = useRef<HTMLDivElement | null>(null);

  /* Lo que trae la hoja emocional (CSV publicado: sólo se lee). */
  const [rowsHoja, setRowsHoja] = useState<Player[]>([]);

  /*
  | Lo editado en «Editar valoraciones» (31/10/2026): una capa en Supabase
  | (`emotion:valoraciones`) que manda sobre la hoja jugador a jugador. Todo
  | lo de la pantalla —radares, campo, medias— sale ya con ella aplicada.
  */
  const {
    value: docCrudo,
    setValue: setDocEmocional,
    status: estadoDoc,
    localOnly,
    lastSavedAt,
    sinGuardar,
    guardaYa,
  } = useRemoteDoc<DocEmocional>({
    key: CLAVE_DOC_EMOCIONAL,
    kind: "emotion",
    fallback: DOC_EMOCIONAL_VACIO,
    debounce: 400,
  });

  const docEmocional = useMemo(() => normalizaDocEmocional(docCrudo), [docCrudo]);
  const rows = useMemo(() => aplicaEdiciones(rowsHoja, docEmocional), [rowsHoja, docEmocional]);

  /* 10/11/2026: la fecha de la última valoración editada, para que cada nota lleve su base temporal. */
  const fechaValoracion = useMemo(
    () =>
      Object.values(docEmocional.jugadores)
        .map((e) => e.editado)
        .filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f))
        .sort()
        .at(-1) ?? null,
    [docEmocional],
  );

  /* 16/11/2026 (jueces): la fecha va en el titular y, pasados 14 días, se
     avisa «a revisar». «Hoy» se lee fuera del render. */
  const hoy = useSyncExternalStore(nadaQueOir, hoyIso, () => "");
  const diasDesdeValoracion = useMemo(() => {
    if (!fechaValoracion || !hoy) return null;
    const d = (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${fechaValoracion.slice(0, 10)}T12:00:00Z`)) / 86_400_000;
    return Number.isFinite(d) ? Math.max(0, Math.round(d)) : null;
  }, [fechaValoracion, hoy]);
  const fechaCorta = fechaValoracion ? `${fechaValoracion.slice(8, 10)}/${fechaValoracion.slice(5, 7)}` : "";
  /* 27/11/2026 (jueces, ronda 9): pasados 14 días la valoración caduca: banner
     arriba con el día límite (MD-2 del próximo partido) y las cifras atenuadas. */
  const caducada = diasDesdeValoracion !== null && diasDesdeValoracion >= 14;
  const [proximo, setProximo] = useState<{ rival: string; fecha: string } | null>(null);

  useEffect(() => {
    let cancelado = false;

    import("@/lib/tactics/oncesSemana")
      .then(({ semanaActual }) => semanaActual())
      .then((s) => {
        if (!cancelado && s) setProximo({ rival: s.rival, fecha: s.fecha });
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, []);

  /* El MD-2 del próximo partido, «27/11»; si ya ha pasado, el día del partido. */
  const limiteValorar = useMemo(() => {
    if (!proximo || !/^\d{4}-\d{2}-\d{2}$/.test(proximo.fecha)) return null;
    const d = new Date(`${proximo.fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 2);
    const md2 = d.toISOString().slice(0, 10);
    const corto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

    /* 28/11/2026 (fútbol, estilo): pasado el MD-2, el aviso dice que está
       vencida y desde cuándo, no la fecha como si estuviera por venir. */
    if (hoy && hoy > md2) {
      return {
        vencida: true,
        texto: `Vencida desde el ${corto(md2)} (MD-2 ante ${proximo.rival}): valorar ${hoy >= proximo.fecha ? "hoy, el día del partido" : `hoy, antes del partido del ${corto(proximo.fecha)}`}.`,
      };
    }
    return { vencida: false, texto: `Valorar de nuevo antes del MD-2 del partido ante ${proximo.rival}: el ${corto(md2)}.` };
  }, [proximo, hoy]);

  const [editando, setEditando] = useState(false);
  /* 17/11/2026 (ronda 20): «Valorar» de un jugador abre el editor con él ya elegido. */
  const [editarA, setEditarA] = useState<string | null>(null);
  const valorarA = useCallback((nombre: string) => {
    setEditarA(nombre);
    setEditando(true);
  }, []);
  const { players: plantilla } = usePlayers();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [verVideo, setVerVideo] = useState(false);
  const [showTeamAverage, setShowTeamAverage] = useState(true);

  const [groups, setGroups] = useState<Record<GroupKey, string[]>>(EMPTY_GROUPS);

  /* Las líneas del once de la pizarra (30/10/2026): mandan sobre las de la
     demarcación, y «Restablecer líneas» vuelve a ellas. */
  const [gruposOnce, setGruposOnce] = useState<Record<GroupKey, string[]> | null>(null);

  /* Titulares de la pizarra sin valoración: entran con la media de la plantilla. */
  const [estimados, setEstimados] = useState<Player[]>([]);

  /* Las líneas sólo se reponen si el once cambia de verdad: valorar aquí a
     un titular que llevaba la media no debe deshacer lo elegido a mano. */
  const firmaLineas = useRef("");

  const recibeOnce = useCallback((g: Record<GroupKey, string[]>, sinValorar: Player[]) => {
    const firma = JSON.stringify(g);

    if (firma !== firmaLineas.current) {
      firmaLineas.current = firma;
      setGruposOnce(g);
      setGroups(g);
    }

    setEstimados(sinValorar);
  }, []);

  /* Cambiar la clave relanza la descarga: así el botón de reintento
     no necesita duplicar la lógica de carga. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    traeCsv(CSV_URL, { forzar: reloadKey > 0 })
      .then((t) => {
        if (cancelled) return;

        const parsed = parseCSV(t);
        setRowsHoja(parsed);
        setGroups((prev) => (Object.values(prev).some((v) => v.length > 0) ? prev : gruposPorDefecto(parsed)));

        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoading(true);
    setError(false);
    setReloadKey((k) => k + 1);
  };

  /* Los que se pueden elegir en cada radar: los valorados y los titulares que aún no. */
  const elegibles = useMemo(() => [...rows, ...estimados.filter((e) => !rows.some((r) => r.jugador === e.jugador))], [rows, estimados]);

  const names = useMemo(() => elegibles.map((r) => r.jugador), [elegibles]);

  const playersByName = useMemo(() => {
    const map = new Map<string, Player>();
    elegibles.forEach((r) => map.set(r.jugador, r));
    return map;
  }, [elegibles]);

  const getPlayer = useCallback(
    (name: string) => playersByName.get(name),
    [playersByName]
  );

  /* Media de la plantilla por eje: línea de referencia en cada radar. */
  const teamAverage = useMemo(() => {
    if (rows.length === 0) return null;

    return AXES.reduce(
      (acc, axis) => {
        acc[axis.key] =
          rows.reduce((sum, r) => sum + r[axis.key], 0) / rows.length;
        return acc;
      },
      {} as Record<MetricKey, number>
    );
  }, [rows]);

  const teamScore = useMemo(
    () =>
      rows.length === 0
        ? 0
        : rows.reduce((acc, r) => acc + average(r), 0) / rows.length,
    [rows]
  );

  /* Ejes más fuerte y más débil del grupo: lectura rápida para el cuerpo técnico. */
  const axisRanking = useMemo(() => {
    if (!teamAverage) return null;

    const sorted = [...AXES].sort(
      (a, b) => teamAverage[b.key] - teamAverage[a.key]
    );

    return { top: sorted[0], bottom: sorted[sorted.length - 1] };
  }, [teamAverage]);

  /*
  | 10/11/2026: la frase de arriba. Media de cada línea con los valorados de
  | verdad (quien lleva la media de la plantilla no cuenta) y el titular más
  | bajo de las seis líneas.
  */
  /* 27/11/2026 (ronda 11): cuántos titulares de la pizarra tienen valoración propia (la base del campo). */
  const titularesValorados = useMemo(() => {
    const nombres = new Set(Object.values(groups).flat());
    return [...nombres].filter((n) => {
      const p = getPlayer(n);
      return Boolean(p && !p.estimado);
    }).length;
  }, [groups, getPlayer]);

  const conclusion = useMemo(() => {
    const TITULO: Record<GroupKey, string> = {
      keeper: "portero y defensa",
      defense: "defensa",
      leftSide: "perfil izquierdo",
      rightSide: "perfil derecho",
      midfield: "medios",
      strikers: "puntas",
    };
    const reales = (k: GroupKey) =>
      (groups[k] ?? []).map((n) => getPlayer(n)).filter((p): p is Player => Boolean(p && !p.estimado));
    /* 17/11/2026 (ronda 19): sin ordenar líneas (todas son tendencia, de 2
       a 5 jugadores): los titulares más bajos con nombre y el eje a trabajar
       del once valorado. */
    const todos = [
      ...new Map(
        (Object.keys(TITULO) as GroupKey[]).flatMap((k) => reales(k)).map((p) => [p.jugador, p] as const),
      ).values(),
    ];

    if (todos.length < 2) return null;

    const nombreDe = (p: Player) => nombreVisible(mejorCasado([p.jugador], plantilla, (j) => [j.nombre, j.apodo])?.nombre || p.jugador);
    const peores = [...todos].sort((x, y) => average(x) - average(y)).slice(0, 3);
    const lista = peores.map((p) => `${nombreDe(p)} ${coma(average(p))}`);
    const ejes = AXES.map((axis) => ({ axis, v: todos.reduce((acc, p) => acc + p[axis.key], 0) / todos.length })).sort((x, y) => x.v - y.v);
    const flojo = ejes[0];
    /* 27/11/2026 (fútbol, ronda 9): las dos medias con su nombre; «6,6 de
       media» parecía contradecir el 7,1 del once. */
    const mediaOnce = todos.reduce((acc, p) => acc + average(p), 0) / todos.length;

    return `Más bajos del once: ${lista.length > 1 ? `${lista.slice(0, -1).join(", ")} y ${lista.at(-1)}` : lista[0]} · a trabajar: ${flojo.axis.corto.toLowerCase()} (${coma(flojo.v)} de media en ${flojo.axis.corto.toLowerCase()}; la media del once, ${coma(mediaOnce)}, con los ${todos.length} titulares valorados).`;
  }, [groups, getPlayer, plantilla]);

  const setGroup = useCallback((key: GroupKey, value: string[]) => {
    setGroups((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetGroups = useCallback(() => {
    setGroups(gruposOnce ?? gruposPorDefecto(rows));
  }, [rows, gruposOnce]);

  /* Las líneas sin ningún jugador evaluado no se dibujan. Se decide con la
     composición por defecto, no con lo que el usuario vaya quitando: una
     línea vaciada a mano sigue ahí para volver a rellenarla. */
  const lineasConJugadores = useMemo(() => {
    const por = gruposPorDefecto(rows);
    return new Set(
      (Object.keys(por) as GroupKey[]).filter((k) => por[k].length > 0 || (gruposOnce?.[k].length ?? 0) > 0)
    );
  }, [rows, gruposOnce]);

  /*
  | Quién sale en el editor: los valorados (hoja o editados aquí), los
  | titulares de la pizarra que aún no tienen valoración y el resto de la
  | plantilla del Castilla que no está en la base emocional.
  */
  const candidatos = useMemo<CandidatoEmocional[]>(() => {
    const enElOnce = new Set([...Object.values(gruposOnce ?? EMPTY_GROUPS).flat(), ...estimados.map((e) => e.jugador)]);
    const deLaHoja = new Map(rowsHoja.map((r) => [r.jugador, r]));

    const lista: CandidatoEmocional[] = rows.map((r) => {
      const h = deLaHoja.get(r.jugador);

      return {
        nombre: r.jugador,
        posicion: r.posicion,
        valores: valoresDe(r),
        origen: r.editado ? "aqui" : "hoja",
        enHoja: h ? valoresDe(h) : null,
        titular: enElOnce.has(r.jugador),
      };
    });

    const yaEsta = (nombre: string) => lista.some((c) => casaNombre(c.nombre, nombre) >= 2);

    for (const e of estimados) {
      if (lista.some((c) => c.nombre === e.jugador)) continue;

      const ficha = mejorCasado([e.jugador], plantilla, (p) => [p.nombre, p.apodo]);

      lista.push({ nombre: e.jugador, posicion: ficha?.posicion ?? "", valores: null, origen: "sinValorar", enHoja: null, titular: true });
    }

    for (const p of plantilla) {
      if (!p.esCastilla || !p.nombre?.trim() || isHiddenPlayer(p.nombre)) continue;
      if (yaEsta(p.nombre) || (p.apodo && yaEsta(p.apodo))) continue;

      lista.push({ nombre: p.nombre.trim(), posicion: p.posicion ?? "", valores: null, origen: "sinValorar", enHoja: null, titular: false });
    }

    return lista;
  }, [rows, rowsHoja, estimados, gruposOnce, plantilla]);

  /* Guardar del editor: lo cambiado entra en la capa, «A la hoja» lo saca. La cola de useRemoteDoc lo manda. */
  const guardaEdiciones = useCallback(
    (cambios: CambioEmocional[], quitar: string[]) => {
      const ahora = new Date().toISOString();

      setDocEmocional((actual) => {
        const jugadores = { ...normalizaDocEmocional(actual).jugadores };

        for (const nombre of quitar) delete jugadores[nombre];
        for (const c of cambios) jugadores[c.nombre] = { ...c.valores, posicion: c.posicion, editado: ahora };

        return { v: 1, jugadores };
      });

      setEditando(false);
    },
    [setDocEmocional],
  );

  const openVideo = () => {
    if (window.innerWidth < 1024) {
      window.open(VIDEO_URL, "_blank");
      return;
    }

    setVerVideo(true);
    videoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const centrales = (
    [
      { clave: "keeper", titulo: "Portero y defensa" },
      { clave: "defense", titulo: "Defensa" },
      { clave: "midfield", titulo: "Medios (6, 8 y 10)" },
      { clave: "strikers", titulo: "Puntas (9, 10 y extremos)" },
    ] as { clave: GroupKey; titulo: string }[]
  ).filter((c) => lineasConJugadores.has(c.clave));

  /* 07/11/2026: «Joan», «Sergio» o «Aguado» de la hoja salen con el nombre
     de la plantilla, como en el campo. */
  const nombreDe = (n: string) => {
    const ficha = mejorCasado([n], plantilla, (p) => [p.nombre, p.apodo]);

    return nombreVisible(ficha?.nombre || n);
  };

  const panelProps = (key: GroupKey) => ({
    nombreDe,
    players: names,
    selected: groups[key],
    onChange: (value: string[]) => setGroup(key, value),
    getPlayer,
    teamAverage: showTeamAverage ? teamAverage : null,
    loading,
  });

  return (
    <main className="min-h-screen bg-[#030811] text-white max-sm:pb-20">
      <div className="flex flex-col md:flex-row">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Topbar />

          <section className="px-4 pb-10 pt-6 sm:px-8 sm:pb-14 sm:pt-10">
            {/* ---------------------------------------------- Cabecera */}
            <header className="mb-6">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF Castilla · Individual
              </p>

              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Rendimiento emocional
                  </h1>

                  {/* 07/11/2026: dos frases; el resto, plegado en «Cómo leerlo». */}
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
                    El estado emocional del once de la pizarra táctica, línea a
                    línea, de 0 a 10. Pulsa un jugador para ver su perfil.
                  </p>

                  <details className="mt-1.5 max-w-2xl text-xs text-white/55" data-export-hide>
                    <summary className="cursor-pointer select-none font-medium text-[#C8A96B]">Cómo leerlo</summary>
                    <p className="mt-1.5 leading-relaxed">
                      Cada línea tiene su radar en su zona del campo, con los
                      jugadores que hay en la pizarra. En «Fichas del once», el
                      aro es la media de las cuatro dimensiones y la flecha,
                      cómo ha cambiado desde la evaluación anterior. Más abajo
                      se cambia quién entra en cada radar.
                    </p>
                  </details>

                  {/* 10/11/2026: la conclusión antes de los radares: línea más alta,
                      más baja y el titular más bajo, con la media real (sin
                      los que llevan la media de la plantilla). */}
                  {/* 16/11/2026 (jueces): la fecha de la valoración en el
                      titular, con aviso «a revisar» pasados 14 días, y la base
                      (una valoración por jugador: menos de 25, tendencia). */}
                  {/* 27/11/2026 (ronda 9, los tres jueces): con la valoración
                      caducada, un banner arriba con el día límite y «Valorar
                      ahora» como acción principal. */}
                  {caducada && (
                    <div className={`mt-3 flex max-w-2xl flex-col gap-2 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${limiteValorar?.vencida ? "border-red-500/60 bg-red-500/10" : "border-amber-500/50 bg-amber-500/10"}`}>
                      <p className={`min-w-0 text-sm leading-snug ${limiteValorar?.vencida ? "text-red-200 [:root[data-theme=light]_&]:text-red-900" : "text-amber-200 [:root[data-theme=light]_&]:text-amber-900"}`}>
                        {/* 27/11/2026 (marketing, ronda 10): una línea, con el día límite. */}
                        <span className="font-semibold">A revisar: valoración del {fechaCorta}, hace {diasDesdeValoracion} días.</span>{" "}
                        {limiteValorar ? limiteValorar.texto : "Valorar de nuevo antes del próximo partido."}
                        {/* 27/11/2026 (los dos jueces, ronda 11): el único sitio con la fecha; los gráficos, en gris hasta renovar. */}
                        <span className="block text-xs opacity-80">Hasta renovarla, los gráficos van en gris y sus cifras se leen como referencia.</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditando(true)}
                        disabled={loading || estadoDoc === "loading"}
                        data-export-hide
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#C8A96B] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#d8bc82] disabled:opacity-50"
                      >
                        <Pencil size={13} />
                        Valorar ahora →
                      </button>
                    </div>
                  )}
                  {fechaCorta && !caducada && (
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em] text-white/60">
                      Estado del once según la valoración del {fechaCorta}
                    </p>
                  )}
                  {conclusion && (
                    <p className={`mt-1.5 max-w-2xl text-base font-medium leading-snug ${caducada ? "text-white/70" : "text-white"}`}>
                      {conclusion}
                    </p>
                  )}
                  {/* 27/11/2026 (los dos jueces, ronda 11): las dos bases de la
                      pantalla y por qué difieren, dichas una vez. */}
                  {rows.length > 0 && (
                    <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-white/60">
                      Dos bases: el campo y su lectura cuentan al once de la pizarra
                      {titularesValorados > 0 ? ` (${titularesValorados} titulares valorados)` : ""}; el resumen de la plantilla y la raya de
                      referencia, a los {rows.length} evaluados (once y banquillo).
                      {rows.length < VALORACIONES_FIRMES ? " Una valoración por jugador: cada línea suma de 2 a 5, así que sus medias son tendencia." : ""}
                    </p>
                  )}

                  {/* Una línea discreta: qué parte de lo que se ve no sale de la hoja. */}
                  {(sinGuardar || estadoDoc === "error" || localOnly) && (
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/60" data-export-hide>
                      {/* 20/11/2026 (ronda 4, juez de análisis): fuera el chip
                          «Ver las valoraciones →»: abría lo mismo que «Editar
                          valoraciones» y que el aviso «a revisar». */}
                      {/* 16/11/2026 (jueces): «Guardado HH:MM» no se enseña en
                          la lectura; sólo si algo está pendiente o falla. */}
                      {(sinGuardar || localOnly || (estadoDoc !== "saved" && estadoDoc !== "loading")) && (
                        <SaveState status={estadoDoc} localOnly={localOnly} savedAt={lastSavedAt} sinGuardar={sinGuardar} onGuardar={() => void guardaYa()} />
                      )}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2" data-export-hide>
                  <button
                    type="button"
                    onClick={() => setEditando(true)}
                    disabled={loading || estadoDoc === "loading"}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                      caducada
                        ? "border-[#C8A96B]/60 text-[color:var(--rmcf-gold-ink,#C8A96B)] hover:bg-[#C8A96B]/10"
                        : "border-[#C8A96B] bg-[#C8A96B] text-black hover:bg-[#d8bc82]"
                    }`}
                  >
                    <Pencil size={13} />
                    Editar valoraciones
                  </button>

                  {/* 07/11/2026: lo secundario, en «Más»: dos botones menos en la cabecera.
                      20/11/2026 (ronda 4, marketing): también «Ver explicación»;
                      queda una acción principal, «Editar valoraciones». */}
                  <details className="relative">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-white/65 transition hover:border-white/25 hover:text-white [&::-webkit-details-marker]:hidden">
                      Más
                    </summary>
                    {/* 10/11/2026: fondo y letra del tema de día (antes, fondo
                        oscuro fijo con letra oscura del modo día: contraste 1,05). */}
                    <div className="absolute left-0 z-30 mt-2 flex w-56 flex-col sm:left-auto sm:right-0 gap-1 rounded-2xl border border-white/10 bg-[#0B1622] p-2 shadow-xl [:root[data-theme=light]_&]:border-slate-300 [:root[data-theme=light]_&]:bg-white">
                      <button
                        type="button"
                        onClick={openVideo}
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-white transition hover:bg-white/[0.06] [:root[data-theme=light]_&]:text-slate-900 [:root[data-theme=light]_&]:hover:bg-slate-100"
                      >
                        <Play size={13} />
                        Ver explicación
                      </button>

                      <button
                        onClick={() => setShowTeamAverage((v) => !v)}
                        aria-pressed={showTeamAverage}
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-white transition hover:bg-white/[0.06] [:root[data-theme=light]_&]:text-slate-900 [:root[data-theme=light]_&]:hover:bg-slate-100"
                      >
                        <span aria-hidden className="h-px w-5 border-t border-dashed border-current" />
                        {showTeamAverage ? "Quitar la media del equipo" : "Ver la media del equipo"}
                      </button>

                      <button
                        onClick={resetGroups}
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-white transition hover:bg-white/[0.06] [:root[data-theme=light]_&]:text-slate-900 [:root[data-theme=light]_&]:hover:bg-slate-100"
                      >
                        <RefreshCw size={13} />
                        Restablecer líneas
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            </header>

            {/* ------------------------------- El once de la pizarra (29/10/2026) */}
            {!error && (
              <CampoEmocional
                fechaValoracion={fechaValoracion}
                diasValoracion={diasDesdeValoracion}
                rows={rows}
                loading={loading}
                teamAverage={teamAverage}
                grupos={groups}
                onGruposDelOnce={recibeOnce}
                onValorar={valorarA}
              />
            )}

            {/* ---------------------------------------------- Resumen */}
            {/* 27/11/2026 (análisis, ronda 10): la cohorte de estas cuatro cifras
                (la plantilla evaluada, no el once) y, si la valoración tiene 14
                días o más, el sello «caducada» a la vista. */}
            {!loading && rows.length > 0 && (
              <p className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-white/60">
                Plantilla · los {rows.length} evaluados (once y banquillo)
                {/* 27/11/2026 (ronda 11): caducada, la fecha sólo en el aviso de arriba. */}
                {fechaCorta && !caducada ? ` · valoración del ${fechaCorta}` : ""}
              </p>
            )}
            <div className={`mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4 ${caducada ? "opacity-60" : ""}`} title={caducada ? `Valoración del ${fechaCorta}: hace ${diasDesdeValoracion} días` : undefined}>
              <SummaryTile
                label="Jugadores analizados"
                value={loading ? null : String(rows.length)}
                caption={
                  rows.length > 0 && rows.length < MUESTRA_MINIMA
                    ? `Sólo ${rows.length} jugadores medidos: es una tendencia, no un diagnóstico`
                    : `los ${rows.length} con valoración emocional (once y banquillo); la lectura del once cuenta sólo a los titulares`
                }
                icon={Users}
              />

              <SummaryTile
                label="Media de plantilla"
                value={loading ? null : coma(teamScore)}
                caption={
                  loading
                    ? "Cargando datos"
                    : `${labelFor(teamScore)} · de los ${rows.length} de la plantilla evaluados${rows.length < VALORACIONES_FIRMES ? " · una valoración cada uno, tendencia" : ""}`
                }
                tone={loading ? undefined : toneFor(teamScore)}
              />

              <SummaryTile
                label="Dimensión más fuerte"
                value={axisRanking ? nombreLargo(axisRanking.top) : null}
                caption={
                  axisRanking
                    ? `${axisRanking.top.corto} · ${axisRanking.top.label} · media de los ${rows.length} evaluados`
                    : "Cargando datos"
                }
                tone="#3BEA9A"
              />

              <SummaryTile
                label="Dimensión a desarrollar"
                value={axisRanking ? nombreLargo(axisRanking.bottom) : null}
                caption={
                  axisRanking
                    ? `${axisRanking.bottom.corto} · ${axisRanking.bottom.label} · media de los ${rows.length} evaluados`
                    : "Cargando datos"
                }
                tone="#FFB84D"
              />
            </div>

            {error && (
              <EstadoError
                className="mb-5"
                titulo="No se han podido cargar los datos emocionales"
                onReintentar={retry}
                reintentando={loading}
              />
            )}

            {/* ---------------------------------------------- Escala */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[.25em] text-white/40">
                Perfiles por línea · quién entra en cada radar
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-white/70">
                  {/* 17/11/2026 (ronda 20): la población de cada bloque, dicha. */}
                  0 a 10 · cada radar, los jugadores de su línea{rows.length > 0 ? ` · raya: media de los ${rows.length} evaluados` : ""}
                </span>
                {SCALE.map((band) => (
                  <span
                    key={band.label}
                    className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[.1em] text-white/60"
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full"
                      style={{ background: band.tone }}
                    />
                    {band.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ---------------------------------------------- Radares */}
            <div
              id="perfiles-por-linea"
              className={`scroll-mt-24 rounded-[34px] border border-white/10 bg-[#08131F]/60 p-4 sm:p-5 lg:p-6 [:root[data-theme=light]_&]:border-slate-300 [:root[data-theme=light]_&]:bg-white/80 ${caducada ? "grayscale-[.85]" : ""}`}
            >
              {/* Sin imagen de campo detrás (26/10/2026): ensuciaba los radares y los chips. */}
              {/* 08/11/2026 (jueces): las seis líneas se solapan a propósito (petición
                  del analista); se dice aquí para que no parezca un error. */}
              <p className="mb-3 text-xs leading-relaxed text-white/55">
                Seis lecturas del mismo once: un jugador puede contar en dos líneas (un lateral está en su perfil y en la
                defensa), así que cada media se lee por separado y no se suman entre sí. Con uno o dos evaluados, la media es tendencia.
              </p>
              {/* 17/11/2026 (ronda 20, jueces): los seis en una rejilla de dos
                  columnas; «Perfil izquierdo» a todo el ancho dejaba un radar
                  pequeño con mucho blanco a los lados. */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {lineasConJugadores.has("leftSide") && (
                  <RadarPanel title="Perfil izquierdo" {...panelProps("leftSide")} />
                )}

                {lineasConJugadores.has("rightSide") && (
                  <RadarPanel title="Perfil derecho" {...panelProps("rightSide")} />
                )}

                {centrales.map((c) => (
                  <RadarPanel key={c.clave} title={c.titulo} {...panelProps(c.clave)} />
                ))}
              </div>
            </div>

            {/* ------------------------------------- Leyenda de los ejes */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {AXES.map((axis) => {
                const value = teamAverage ? teamAverage[axis.key] : null;

                return (
                  <div
                    key={axis.code}
                    className="rounded-2xl border border-white/10 bg-[#08131F]/85 [:root[data-theme=light]_&]:border-slate-300 [:root[data-theme=light]_&]:bg-white px-4 py-4 transition hover:border-[#E1C77B]/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] uppercase tracking-[.15em] text-[#E1C77B]">
                        {axis.label}
                      </div>

                      <span className="rounded-md border border-[#E1C77B]/30 px-1.5 py-0.5 text-[11px] font-bold text-[#E1C77B]">
                        {axis.corto}
                      </span>
                    </div>

                    <div className="mt-2 text-sm font-medium leading-snug text-white">
                      {axis.detail}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-white/55">
                      <span>{axis.moment}</span>

                      {value !== null && (
                        <span className="tabular-nums text-white/70">
                          {coma(value)}
                        </span>
                      )}
                    </div>

                    {value !== null && (
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, value * 10)}%`,
                            background: toneFor(value),
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Lectura: sale de las mismas medias que se muestran arriba. */}
            {axisRanking && teamAverage && (
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                <span className="font-semibold text-white">
                  Dimensión a trabajar: {nombreLargo(axisRanking.bottom).toLowerCase()}
                </span>
                , {coma(teamAverage[axisRanking.bottom.key])} de media frente a{" "}
                {coma(teamAverage[axisRanking.top.key])} en{" "}
                {nombreLargo(axisRanking.top).toLowerCase()}. Media sobre {rows.length} jugadores
                {rows.length < MUESTRA_MINIMA
                  ? ": con tan pocos registros es una tendencia"
                  : ""}
                .
              </p>
            )}

            {/* ------------------------------------- Vídeo explicativo */}
            <div ref={videoRef} className="mt-14 sm:mt-20" data-export-hide>
              <div className="mb-5">
                <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                  Explicación visual
                </p>

                <p className="mt-2 text-sm text-white/45">
                  Cómo se leen las cuatro dimensiones y qué se entrena en cada
                  una.
                </p>
              </div>

              <div className="hidden overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:rounded-[32px] sm:p-4 lg:block">
                {verVideo ? (
                  <iframe
                    title="Vídeo explicativo del análisis emocional"
                    src={VIDEO_EMBED}
                    className="h-[640px] w-full rounded-[18px] border-0 bg-black sm:rounded-[24px]"
                    allow="autoplay"
                    allowFullScreen
                  />
                ) : (
                  <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                    {AXES.map((axis) => (
                      <div
                        key={axis.code}
                        className="rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <p className="text-lg font-bold text-[#E4C977]">
                          {axis.corto}
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          {axis.label}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-white/60">
                          {axis.detail}. Se entrena en: {axis.moment.toLowerCase()}.
                        </p>
                      </div>
                    ))}

                    <div className="flex items-center justify-center sm:col-span-2 xl:col-span-4">
                      <button
                        onClick={() => setVerVideo(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-black shadow-xl"
                      >
                        <Play size={15} />
                        Ver el vídeo explicativo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 text-center lg:hidden">
                <p className="mb-4 text-sm text-white/80">
                  Ver explicación completa del análisis emocional
                </p>

                <button
                  onClick={() => window.open(VIDEO_URL, "_blank")}
                  className="inline-flex items-center gap-2 rounded-full bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-black shadow-xl"
                >
                  <Play size={15} />
                  Abrir vídeo
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {editando && (
        <EditorValoraciones
          candidatos={candidatos}
          media={teamAverage}
          onGuardar={guardaEdiciones}
          jugadorInicial={editarA}
          onCerrar={() => {
            setEditando(false);
            setEditarA(null);
          }}
        />
      )}
    </main>
  );
}

function SummaryTile({
  label,
  value,
  caption,
  tone,
  icon: Icon,
}: {
  label: string;
  /** Mientras carga, null: un hueso, nunca un guion. */
  value: string | null;
  caption: string;
  tone?: string;
  icon?: React.ElementType;
}) {
  return (
    <div
      className="min-w-0 rounded-2xl border border-white/10 bg-[#08131F]/70 px-3 py-3 sm:px-4 sm:py-4"
      style={tone ? { borderColor: `${tone}45` } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[.16em] text-white/55 sm:tracking-[.2em]">
          {label}
        </p>

        {Icon && <Icon size={15} className="shrink-0 text-white/30" />}
      </div>

      {value === null ? (
        <Hueso className="mt-2 h-7 w-20" />
      ) : (
        <p
          className="mt-2 break-words text-lg font-semibold leading-tight tabular-nums sm:text-2xl"
          style={tone ? { color: chipInk(tone) } : undefined}
        >
          {value}
        </p>
      )}

      {/* 27/11/2026 (marketing, ronda 10): más contraste en el pie de cada cifra. */}
      <p className="mt-1 text-xs text-white/70">{caption}</p>
    </div>
  );
}

type TooltipEntry = {
  name?: string;
  value?: number;
  color?: string;
};

function RadarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const axis = AXES.find((a) => a.corto === label);

  return (
    <div className="rounded-xl border border-white/15 bg-[#050E18]/95 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,.45)] backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#E4C977]">
        {axis ? axis.label : label}
      </p>

      {axis && <p className="mt-0.5 text-[11px] text-white/55">{axis.detail}</p>}

      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center justify-between gap-4 text-[11px]"
          >
            <span className="flex items-center gap-1.5 text-white/75">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: entry.color }}
              />
              {entry.name}
            </span>

            <span className="tabular-nums text-white">
              {coma(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TEAM_SERIES = "Media equipo";

/* A partir de esta cantidad de jugadores el buscador ahorra scroll. */
const SEARCH_THRESHOLD = 10;

function RadarPanel({
  title,
  players,
  selected,
  onChange,
  getPlayer,
  teamAverage,
  loading,
  horizontal = false,
  nombreDe = (n: string) => n,
}: {
  title: string;
  players: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  getPlayer: (name: string) => Player | undefined;
  teamAverage: Record<MetricKey, number> | null;
  loading: boolean;
  horizontal?: boolean;
  /** El nombre con el que se pinta (el de la plantilla), no el de la hoja. */
  nombreDe?: (n: string) => string;
}) {
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);

  const series = useMemo(
    () =>
      selected
        .map((name, index) => ({
          name,
          color: SERIES_COLORS[index % SERIES_COLORS.length],
          values: getPlayer(name),
        }))
        .filter(
          (s): s is { name: string; color: string; values: Player } =>
            Boolean(s.values)
        ),
    [selected, getPlayer]
  );

  const chartData = useMemo(
    () =>
      AXES.map((axis) => {
        const row: Record<string, string | number> = { key: axis.corto };

        series.forEach((s) => {
          row[s.name] = s.values[axis.key];
        });

        if (teamAverage) {
          row[TEAM_SERIES] = Number(teamAverage[axis.key].toFixed(2));
        }

        return row;
      }),
    [series, teamAverage]
  );

  /* Media del grupo por eje: alimenta las barras bajo el radar. */
  const groupAverages = useMemo(() => {
    if (series.length === 0) return null;

    return AXES.map((axis) => ({
      axis,
      value:
        series.reduce((acc, s) => acc + s.values[axis.key], 0) / series.length,
    }));
  }, [series]);

  const synergyScore =
    series.length === 0
      ? 0
      : series.reduce((acc, s) => acc + average(s.values), 0) / series.length;

  const radarTone = toneFor(synergyScore);
  const synergyLabel = labelFor(synergyScore);

  /* Seleccionados primero: evita perderlos de vista en listas largas. */
  const visiblePlayers = useMemo(() => {
    const q = normalize(query.trim());

    const filtered = q
      ? players.filter((name) => normalize(name).includes(q))
      : players;

    return [...filtered].sort((a, b) => {
      const diff = Number(selected.includes(b)) - Number(selected.includes(a));
      return diff !== 0 ? diff : a.localeCompare(b, "es");
    });
  }, [players, query, selected]);

  const toggle = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name]
    );
  };

  return (
    <div
      /* 29/10/2026: con jugadores, el fondo base va por tema (en modo día el
         panel se leía como un bloque gris oscuro); el degradado del nivel sólo
         tiñe por encima. */
      className={`rounded-[24px] border p-3 sm:p-4 ${series.length ? "bg-[#08131F]/40 [:root[data-theme=light]_&]:bg-white" : "emo-panel-vacio"}`}
      style={
        series.length
          ? {
              borderColor: `${radarTone}55`,
              backgroundImage: `radial-gradient(circle at center, ${radarTone}15 0%, transparent 75%)`,
              boxShadow: `0 0 30px ${radarTone}20`,
            }
          : undefined
      }
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="min-w-0 text-[12px] font-semibold uppercase tracking-[.15em] text-[#E4C977]">
          {title}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Es la media de los elegidos, no una medida de cómo encajan:
              «Sinergia» prometía algo que no se calcula (19/10/2026). Sin
              jugadores no se enseña un 0,0 que parece una nota. */}
          {series.length > 0 && (
            <span
              className="text-[11px] text-white/60"
              title="Media de las cuatro dimensiones de los jugadores elegidos, de 0 a 10"
            >
              Media{" "}
              <span className="tabular-nums font-semibold text-white">
                {coma(synergyScore)}
              </span>
              <span className="text-white/35"> / 10</span>
            </span>
          )}

          {/* Con menos de tres jugadores el nivel es una tendencia, no un perfil de línea.
              29/10/2026: el chip gris llevaba tinta clara fija y en modo día salía
              como una píldora vacía; ahora la tinta va por tema y el número de
              jugadores va dentro del propio chip. */}
          {series.length > 0 &&
            (series.length < 3 ? (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: "rgba(148,163,184,.22)", border: "1px solid rgba(148,163,184,.55)", color: "var(--rmcf-ink)" }}
              >
                {series.length} {series.length === 1 ? "jugador" : "jugadores"} · tendencia
              </span>
            ) : (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: radarTone, color: "#031018" }}
              >
                {synergyLabel} · {series.length} jugadores
              </span>
            ))}

          {/* 16/11/2026 (jueces): cada jugador aporta UNA valoración; por
              debajo de 25 la media de una línea es tendencia y se dice con
              su base. */}
          {series.length >= 3 && series.length < VALORACIONES_FIRMES && (
            <span
              className="rounded-full border border-dashed border-white/25 px-2 py-0.5 text-[11px] font-semibold text-white/60"
              title={`Media de ${series.length} valoraciones (una por jugador): con menos de ${VALORACIONES_FIRMES} es tendencia`}
            >
              tendencia · {series.length} valoraciones
            </span>
          )}
        </div>
      </div>

      {/* Jugadores activos del panel */}
      <div className="mb-3 flex min-h-[24px] flex-wrap items-center gap-1.5">
        {series.length === 0 ? (
          <span className="text-[11px] text-white/35">
            Sin jugadores seleccionados
          </span>
        ) : (
          series.map((s) => (
            <button
              key={s.name}
              onClick={() => toggle(s.name)}
              title={`Quitar ${nombreDe(s.name)}`}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold sm:py-1 transition hover:brightness-125"
              style={{
                background: `${s.color}25`,
                color: chipInk(s.color),
                border: `1px solid ${s.color}40`,
              }}
            >
              {nombreDe(s.name)}
              <X size={9} aria-hidden />
            </button>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        {/* Selector: chips accesibles, mejor en táctil que un multi-select */}
        <div
          className={`flex shrink-0 flex-col gap-2 ${
            horizontal ? "lg:w-[230px]" : "lg:w-[160px]"
          }`}
          data-export-hide
        >
          <button
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="inline-flex items-center justify-between gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-medium sm:px-3 sm:py-1.5 sm:text-[11px] text-white/80 transition hover:border-white/30 hover:text-white"
          >
            {abierto ? "Cerrar lista" : "Elegir jugadores"}
            <span className="tabular-nums text-white/45">
              {selected.length}/{players.length}
            </span>
          </button>

          {abierto && (
          <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-[.16em] text-white/55">
              Jugadores
            </span>

            <button
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="inline-flex items-center gap-1 px-1 py-1.5 text-[11px] sm:py-0 text-white/55 transition hover:text-white disabled:opacity-30 disabled:hover:text-white/40"
            >
              <Eraser size={10} />
              Limpiar
            </button>
          </div>

          {players.length > SEARCH_THRESHOLD && (
            <div className="relative">
              <Search
                size={11}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
              />

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                aria-label={`Buscar jugador en ${title}`}
                className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2 pl-7 pr-2 text-base sm:py-1.5 sm:text-[11px] text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
              />
            </div>
          )}

          <div
            role="group"
            aria-label={`Jugadores en ${title}`}
            className="flex max-h-[230px] sm:max-h-[150px] flex-wrap content-start gap-1.5 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-[inset_0_0_14px_rgba(255,255,255,.03)] backdrop-blur-xl lg:max-h-[210px]"
          >
            {loading && players.length === 0 && (
              <div className="w-full space-y-1.5 p-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-5 w-full animate-pulse rounded-full bg-white/10"
                  />
                ))}
              </div>
            )}

            {!loading && visiblePlayers.length === 0 && (
              <span className="p-1 text-[11px] text-white/50">
                Sin resultados
              </span>
            )}

            {visiblePlayers.map((name) => {
              const active = selected.includes(name);

              return (
                <button
                  key={name}
                  onClick={() => toggle(name)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] leading-none sm:px-2 sm:py-1 transition ${
                    active
                      ? "border-white/30 bg-white/15 text-white"
                      : "border-white/10 bg-transparent text-white/55 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {active && <Check size={9} aria-hidden />}
                  {nombreDe(name)}
                </button>
              );
            })}
          </div>
          </>
          )}
        </div>

        <div className="w-full min-w-0 flex-1">
          {/* 29/10/2026: lienzo más bajo y radio mayor; antes el radar era un
              rombo pequeño en mucho vacío. */}
          {/* 27/11/2026 (marketing, ronda 11): tarjetas más bajas, sin vacío entre radares. */}
          <div className="h-[240px] w-full min-w-[240px] sm:h-[260px]">
            {series.length === 0 && loading ? (
              <Hueso className="h-full w-full rounded-2xl" />
            ) : series.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 text-center text-[11px] text-white/40">
                Selecciona jugadores para dibujar el perfil
              </div>
            ) : (
              <ResponsiveConVistas
                width="100%" minWidth={200}
                height="100%"
                initialDimension={{ width: horizontal ? 520 : 300, height: 320 }}
              >
                <RadarChart
                  data={chartData}
                  outerRadius="86%"
                  /* 29/10/2026: las etiquetas de los lados se escriben hacia dentro
                     (encima del vértice), así que no necesitan margen lateral y
                     «Controlar» ya no se corta en las columnas estrechas. */
                  margin={{ top: 22, right: 10, bottom: 22, left: 10 }}
                >
                  <PolarGrid stroke={`${radarTone}40`} />

                  <PolarAngleAxis
                    dataKey="key"
                    tick={(props: {
                      x?: number | string;
                      y?: number | string;
                      textAnchor?: "start" | "middle" | "end" | "inherit";
                      payload?: { value?: string };
                    }) => {
                      const code = String(props.payload?.value ?? "");
                      /* Los ejes laterales se anclan hacia dentro y suben
                         sobre la línea: nunca salen del lienzo. */
                      const lado =
                        props.textAnchor === "start"
                          ? "end"
                          : props.textAnchor === "end"
                            ? "start"
                            : null;
                      return (
                        <text
                          x={props.x}
                          y={lado ? Number(props.y) - 8 : props.y}
                          textAnchor={lado ?? props.textAnchor}
                          fontSize={13}
                          paintOrder="stroke"
                          stroke="var(--rmcf-surface, transparent)"
                          strokeWidth={3}
                          fontWeight={700}
                          style={{ fill: "var(--rmcf-ink)" }}
                        >
                          {code}
                        </text>
                      );
                    }}
                  />

                  <PolarRadiusAxis
                    domain={[0, 10]}
                    tick={false}
                    axisLine={false}
                  />

                  <Tooltip
                    cursor={false}
                    content={({ active, payload, label }) => (
                      <RadarTooltip
                        active={active}
                        payload={payload as unknown as TooltipEntry[]}
                        label={String(label ?? "")}
                      />
                    )}
                  />

                  {teamAverage && (
                    <Radar
                      name={TEAM_SERIES}
                      dataKey={TEAM_SERIES}
                      stroke="#8FA3B8"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      fill="#8FA3B8"
                      fillOpacity={0.05}
                      isAnimationActive={false}
                    />
                  )}

                  {series.map((s) => (
                    <Radar
                      key={s.name}
                      name={nombreDe(s.name)}
                      dataKey={s.name}
                      stroke={s.color}
                      fill={s.color}
                      fillOpacity={0.12}
                      strokeWidth={2.6}
                      isAnimationActive={false}
                    />
                  ))}
                </RadarChart>
              </ResponsiveConVistas>
            )}
          </div>

          {teamAverage && series.length > 0 && (
            <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-white/55">
              <svg width="18" height="4" aria-hidden>
                <line x1="0" y1="2" x2="18" y2="2" stroke="#8FA3B8" strokeWidth="1.5" strokeDasharray="4 3" />
              </svg>
              trazo discontinuo: media de la plantilla
            </div>
          )}

          {/* Lectura numérica: el radar da la forma, esto da el dato.
              16/11/2026 (jueces): rotulada «Media de la línea»; antes, bajo
              «Media de la plantilla», parecían las cifras de toda la plantilla. */}
          {groupAverages && (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-white/60">
              Media de la línea · {series.length} {series.length === 1 ? "jugador" : "jugadores"}
            </p>
          )}
          {/* 20/11/2026 (ronda 5, marketing): las cuatro casillas repetían
              el radar. Ahora una fila compacta con lo que el radar no dice:
              la nota de la línea y su diferencia con la media de la
              plantilla; el nombre largo de cada eje, al pasar. */}
          {groupAverages && (
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {groupAverages.map(({ axis, value }) => {
                const ref = teamAverage ? teamAverage[axis.key] : null;
                const dif = ref !== null ? value - ref : null;

                return (
                  <div
                    key={axis.code}
                    className="flex items-baseline justify-between gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[12px]"
                    title={`${axis.label} · ${axis.detail}${ref !== null ? ` · media de la plantilla ${coma(ref)}` : ""}`}
                  >
                    <span className="font-bold text-white/80">{axis.corto}</span>
                    <span className="tabular-nums">
                      <span className="font-bold" style={{ color: chipInk(toneFor(value)) }}>{coma(value)}</span>
                      {dif !== null && Math.abs(dif) >= 0.05 && (
                        <span className="ml-1 text-[11px] text-white/55">
                          {dif > 0 ? "+" : ""}
                          {coma(dif)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {groupAverages && teamAverage && (
            <p className="mt-1 text-[11px] text-white/50">Al lado, la diferencia con la media de la plantilla.</p>
          )}
        </div>
      </div>
    </div>
  );
}
