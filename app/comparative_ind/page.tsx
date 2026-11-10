"use client";

/**
 * Comparativa con la categoría (antes «Comparativo U-21», un Power BI).
 *
 * Cada jugador del Castilla frente a los de su puesto en la categoría —los
 * sub-21, los sub-23 o todos—, con lo que recopilamos de él:
 * - la descarga de jugadores de Wyscout de TODA la categoría (edad, puesto,
 *   minutos y 86 métricas por noventa);
 * - nuestras valoraciones de partido (nota, titularidades, goles, asistencias);
 * - los seguimientos individuales.
 *
 * Tres pestañas con los mismos filtros arriba: el ranking de la plantilla, los
 * gráficos por fase del juego (una batería de preguntas como la de DATA, o dos
 * métricas a elección) y la ficha de cada uno. Pinchar en un jugador —en la
 * tabla o en un gráfico— abre su ficha.
 *
 * El modelo vive en `lib/comparativa-u21.ts` y reutiliza el de DATA
 * (`lib/data-analisis/individual.ts`), con sus reglas: percentil siempre, nada
 * de porcentajes de una acción y el portero sólo contra porteros.
 */

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowDownUp,
  ArrowUpRight,
  BarChart3,
  Loader2,
  Minus,
  ScatterChart,
  Search,
  Swords,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { COMPARADO, MEJOR, ORO, PEOR, tinta, useEscudos } from "@/components/data/graficas";
import { usePlayers } from "@/hooks/usePlayers";
import { useOrdenRivales } from "@/hooks/useOrdenRivales";
import { ChapaJornada } from "@/components/rivals/ChapaJornada";
import type { JornadaDeEquipo } from "@/lib/rivals/orden-calendario";
import { useRatingsSeason } from "@/hooks/useRatings";
import { traeJson } from "@/lib/hojaCsv";
import { nombreVisible } from "@/lib/nombreJugador";
import { alineaSeguimiento } from "@/lib/seguimiento";
import { summarizeAll } from "@/lib/ratings/compute";
import { casaNombre } from "@/lib/data-analisis/once";
import {
  aplicaA,
  esNuestro,
  gruposDe,
  MINUTOS_MINIMOS,
  METRICAS_JUGADOR,
  METRICA_JUGADOR_POR_COLUMNA,
  metricasDe,
  percentilEnPlantilla,
  PUESTOS,
  puestoDe,
  valorDe,
  volumenDelPorcentaje,
  type Puesto,
} from "@/lib/data-analisis/individual";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import {
  FASES,
  PREGUNTAS,
  REFERENCIAS,
  comparativa,
  indiceDe,
  mediana,
  CORTE_SUB21_TEXTO,
  mejoresDe,
  nubeDe,
  percentilesDe,
  puntosDe,
  referenciaDe,
  type FilaComparativa,
  type PuntoJugador,
  type Referencia,
} from "@/lib/comparativa-u21";
import { Explicativo } from "@/components/ui/textos-analisis";
import { MapaDosEjes, type PuntoMapa } from "@/components/data/visual/MapaDosEjes";
import { RadiografiaPercentiles, type CunaPercentil } from "@/components/data/visual/RadiografiaPercentiles";
import { MarcoGrafico, useTipoGrafico } from "@/components/data/visual/MarcoGrafico";
import { ComparativaOpta } from "./ComparativaOpta";

type Respuesta = { ok: boolean; jugadores?: FilaJugador[]; error?: string };
type RegistroSeguimiento = { ID_JUGADOR: string; NOMBRE?: string; FECHA?: string };
type Pestana = "ranking" | "graficos" | "ficha" | "cara";
type Orden = "nombre" | "edad" | "minutos" | "nota" | "indice" | "ranking" | "evolucion" | "seguimientos";

const colorIndice = (i: number | null) => (i === null ? tinta(0.2) : i >= 60 ? MEJOR : i < 45 ? PEOR : ORO);

const ordinal = (n: number) => `${n}º`;

/** Por debajo de 10 en el grupo del puesto, el ranking es tendencia (30/10/2026). */
const GRUPO_CORTO = 10;

/** «2º de 34 · empatado», «4º de 8 · tendencia». */
const textoRanking = (r: { posicion: number; de: number; empatados: number }) =>
  /* Los empates como tramo (06/11/2026): «2º-3º de 34», no «2º · empatado». */
  `${r.empatados > 0 ? `${r.posicion}º-${r.posicion + r.empatados}º` : ordinal(r.posicion)} de ${r.de}${r.de < GRUPO_CORTO ? " · tendencia" : ""}`;

/** Por debajo, el índice se marca con asterisco: muestra corta. */
const MUESTRA_CORTA = 300;

/** Entre −3 y +3 puntos de índice frente a 25/26 se lee «estable» (07/11/2026). */
const ESTABLE = 3;

const apellido = (nombre: string) => nombre.split(" ").slice(-1)[0];

const formatea = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, ""));

function Barra({ valor, color }: { valor: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, valor))}%`, background: color }} />
    </div>
  );
}

function Foto({ src, nombre, size = 36 }: { src?: string; nombre: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- recortes propios, ya optimizados
    <img src={src} alt={nombre} width={size} height={size} className="shrink-0 rounded-full bg-white/5 object-cover object-top" style={{ width: size, height: size }} />
  ) : (
    /* 30/10/2026: iniciales en círculo dorado, como el resto de la app. */
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[11px] font-semibold text-[#C8A96B]"
      style={{ width: size, height: size }}
    >
      {nombre
        .replace(/\./g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("")}
    </span>
  );
}

function Chip({ activo, onClick, children, fuerte }: { activo: boolean; onClick: () => void; children: React.ReactNode; fuerte?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        activo
          ? fuerte
            ? "border-[#C8A96B] bg-[#C8A96B]/15 font-medium text-[#C8A96B]"
            : "border-white/40 bg-white/10 text-white"
          : "border-white/10 text-white/55 hover:border-white/25"
      }`}
    >
      {children}
    </button>
  );
}

export default function ComparativaCategoria() {
  const { players } = usePlayers();
  const { season } = useRatingsSeason();
  const escudoDe = useEscudos();
  /* Los equipos por calendario y con su jornada: los de nuestro grupo
     delante, en el orden en que tocan; los del otro grupo detrás, por nombre. */
  const { ordena, jornadaDe } = useOrdenRivales();

  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [seguimientos, setSeguimientos] = useState<RegistroSeguimiento[]>([]);
  const [ref, setRef] = useState<Referencia>("u21");
  const [filtroPuesto, setFiltroPuesto] = useState<Puesto | "todos">("todos");
  const [pestana, setPestana] = useState<Pestana>("ranking");
  const [elegido, setElegido] = useState<string | null>(null);
  const [orden, setOrden] = useState<{ por: Orden; desc: boolean }>({ por: "indice", desc: true });
  /* 09/11/2026: la misma comparativa con Opta y con sus temporadas pasadas. */
  const [fuente, setFuente] = useState<"wyscout" | "opta">("wyscout");

  /* Subirlo relanza la lectura: el botón «Reintentar» del aviso de error. */
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    /* Con la copia del aparato (traeJson) los datos de la última vez salen al
       instante y se renuevan por detrás; y si ni siquiera hay copia, a los 25 s
       se deja de esperar y se ofrece «Reintentar» en vez de un «Cargando…»
       sin fin (el Apps Script en frío tarda 30-70 s). */
    const espera = new Promise<never>((_, falla) => {
      const reloj = setTimeout(() => falla(new Error("tarda")), 25_000);
      control.signal.addEventListener("abort", () => clearTimeout(reloj));
    });
    Promise.race([traeJson<Respuesta>("/api/data-analisis", { forzar: intento > 0 }), espera])
      .then((r) => {
        if (!control.signal.aborted) setDatos(r);
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setDatos({
          ok: false,
          error:
            e instanceof Error && e.message === "tarda"
              ? "Los datos de la categoría tardan más de lo normal en llegar."
              : "No se han podido leer los datos.",
        });
      });
    traeJson<unknown>("/api/rivals?action=seguimiento")
      .then((d) => setSeguimientos(Array.isArray(d) ? (d as RegistroSeguimiento[]) : []))
      .catch(() => setSeguimientos([]));
    return () => control.abort();
  }, [intento]);

  const reintenta = () => {
    setDatos(null);
    setIntento((n) => n + 1);
  };

  const jugadores = useMemo(() => datos?.jugadores ?? [], [datos]);
  const filas = useMemo(() => (jugadores.length ? comparativa(jugadores, ref) : []), [jugadores, ref]);

  /*
  | De la fila de Wyscout a la ficha de la plantilla (foto, ID para
  | valoraciones y seguimientos). Contra la plantilla ENTERA —Alexis juega con
  | nosotros sin licencia nuestra— y por cuatro caminos, porque la hoja no
  | siempre escribe el nombre completo: nombre, apodo, inicial y apellido
  | («S. Martínez») y nombre de pila cuando no hay otro igual («Roberto»).
  */
  const fichaDe = useMemo(() => {
    const limpio = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    return (fila: FilaJugador) =>
      casaNombre(fila.jugador, players, (p) => p.nombre) ??
      casaNombre(fila.jugador, players, (p) => p.apodo ?? "") ??
      (() => {
        const inicial = limpio(fila.jugador).match(/^(\p{L})\.\s*(.+)$/u);
        if (inicial) {
          const suyos = players.filter((p) => {
            const n = limpio(p.nombre);
            return n.startsWith(inicial[1]) && n.endsWith(inicial[2]);
          });
          if (suyos.length === 1) return suyos[0];
        }
        const pila = limpio(fila.jugador).split(/\s+/)[0];
        const suyos = players.filter((p) => limpio(p.nombre) === pila || limpio(p.apodo ?? "") === pila);
        return suyos.length === 1 ? suyos[0] : null;
      })();
  }, [players]);

  const resumenes = useMemo(() => summarizeAll(season), [season]);

  const cuentaSeguimientos = useMemo(() => {
    const m = new Map<string, { n: number; ultima: string }>();
    for (const s of alineaSeguimiento(seguimientos, players)) {
      const previo = m.get(s.ID_JUGADOR) ?? { n: 0, ultima: "" };
      const fecha = String(s.FECHA ?? "").slice(0, 10);
      m.set(s.ID_JUGADOR, { n: previo.n + 1, ultima: fecha > previo.ultima ? fecha : previo.ultima });
    }
    return m;
  }, [seguimientos, players]);

  /* Desde cuándo cuenta la columna de seguimientos: el registro más antiguo. */
  const desdeSeguimientos = useMemo(() => {
    const fechas = alineaSeguimiento(seguimientos, players)
      .map((s) => String(s.FECHA ?? "").slice(0, 10))
      .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
      .sort();
    return fechas[0] ? fechas[0].split("-").reverse().join("/") : "";
  }, [seguimientos, players]);

  /* Todo lo nuestro de cada fila, resuelto una vez: la tabla ordena por ello. */
  const conFicha = useMemo(
    () =>
      filas.map((f) => {
        const ficha = fichaDe(f.jugador);
        const nota = ficha ? resumenes.get(ficha.id) : undefined;
        const seg = ficha ? cuentaSeguimientos.get(ficha.id) : undefined;
        return { f, ficha, nota, seg };
      }),
    [filas, fichaDe, resumenes, cuentaSeguimientos],
  );

  const visibles = useMemo(() => {
    const valor = (x: (typeof conFicha)[number]): number | string => {
      switch (orden.por) {
        case "nombre": return x.ficha?.nombre ?? x.f.jugador.jugador;
        case "edad": return x.f.jugador.edad;
        case "minutos": return x.f.jugador.minutos;
        case "nota": return x.nota?.played ? x.nota.avg : -1;
        case "indice": return x.f.indice ?? -1;
        case "ranking": return x.f.ranking ? -x.f.ranking.posicion / x.f.ranking.de : -99;
        case "evolucion": return x.f.evolucion?.salto ?? -99;
        case "seguimientos": return x.seg?.n ?? 0;
      }
    };
    return conFicha
      .filter((x) => filtroPuesto === "todos" || x.f.puesto === filtroPuesto)
      .sort((a, b) => {
        const va = valor(a);
        const vb = valor(b);
        const c = typeof va === "string" ? va.localeCompare(String(vb), "es") : va - (vb as number);
        return orden.desc ? -c : c;
      });
  }, [conFicha, filtroPuesto, orden]);

  /* La tabla sólo lleva a quien tiene índice; los de pocos minutos van en una
     línea al pie, sin filas con guiones. */
  const comparables = useMemo(() => visibles.filter((x) => x.f.indice !== null), [visibles]);
  /* Menos de 300′: el índice vale, pero con muestra corta (asterisco y atenuado). */
  const cortos = comparables.some((x) => x.f.jugador.minutos < MUESTRA_CORTA);
  const pocosMinutos = useMemo(
    () => visibles.filter((x) => x.f.indice === null).map((x) => x.ficha?.nombre || x.f.jugador.jugador),
    [visibles],
  );

  const sinFicha = useMemo(
    () => comparables.filter((x) => !x.ficha).map((x) => nombreVisible(x.f.jugador.jugador)),
    [comparables],
  );

  /* Lectura de dos o tres frases que se calcula sola con lo que hay en la tabla. */
  const lectura = useMemo(() => {
    const frases: { titulo: string; texto: string; tono: "bien" | "mal" | "ojo" | "tendencia"; abre?: string[] }[] = [];
    /* La lectura sólo nombra a quien está en nuestra plantilla. */
    const propios = comparables.filter((x) => x.ficha);
    const nombre = (x: (typeof comparables)[number]) => x.ficha?.nombre || x.f.jugador.jugador;

    const primeros = propios.filter((x) => x.f.ranking?.posicion === 1 && x.f.ranking.de > 1);
    if (primeros.length)
      frases.push({
        titulo: "Los mejores de su puesto",
        /* 08/11/2026: cada uno con contra cuántos se compara. */
        texto: `${primeros.map((x) => `${nombre(x)} (1º de ${x.f.ranking?.de}${(x.f.ranking?.de ?? 0) < GRUPO_CORTO ? " · tendencia" : ""})`).join(", ")}: primeros de su puesto en la referencia elegida.`,
        tono: "bien",
        abre: primeros.map((x) => x.f.jugador.jugador),
      });

    const baja = propios
      .filter((x) => x.f.evolucion?.fiable && x.f.evolucion.salto < -ESTABLE)
      .sort((a, b) => (a.f.evolucion?.salto ?? 0) - (b.f.evolucion?.salto ?? 0))[0];
    if (baja?.f.evolucion)
      /* 10/11/2026: con la base de las dos temporadas, las métricas que más
         caen y el qué entrenamos, como la tarjeta de los desajustes. */
      frases.push({
        titulo: `Baja respecto a 25/26: ${nombre(baja)}`,
        texto: `${baja.f.evolucion.salto} puntos de índice frente a la temporada pasada (${baja.f.evolucion.minutosAhora.toLocaleString("es-ES")}′ este año, ${baja.f.evolucion.minutosAntes.toLocaleString("es-ES")}′ el pasado${baja.f.evolucion.minutosAhora < 450 ? "; este año, menos de 450′: tendencia" : ""}).${
          baja.f.evolucion.peores.length
            ? ` Lo que más cae: ${baja.f.evolucion.peores.map((m) => `${m.nombre.toLowerCase()} (percentil ${m.percentilAntes} → ${m.percentilAhora})`).join(" y ")}. Qué entrenamos: una tarea con ${baja.f.evolucion.peores[0].nombre.toLowerCase()} y el objetivo de volver al percentil ${baja.f.evolucion.peores[0].percentilAntes} del año pasado.`
            : " Revisar con él qué ha cambiado: puesto, minutos o rol."
        }`,
        tono: "mal",
        abre: [baja.f.jugador.jugador],
      });

    /* 30/10/2026: todos los desajustes (antes sólo el primero) y qué hacer con cada uno. */
    const desajustes = propios.filter(
      /* Con menos de ${MUESTRA_CORTA}′ en Wyscout no se saca lectura: sería tendencia. */
      (x) => x.f.jugador.minutos >= MUESTRA_CORTA && x.nota && x.nota.played >= 3 && ((x.nota.avg >= 7 && (x.f.indice ?? 0) < 50) || (x.nota.avg < 6 && (x.f.indice ?? 0) >= 60)),
    );
    /* 07/11/2026 (jueces): el «qué hacemos» sale de la métrica del índice que
       más se separa de la nota, no una frase común para todos. */
    for (const d of desajustes.slice(0, 3)) {
      if (!d.nota) continue;
      const notaAlta = d.nota.avg >= 7;
      const porPercentil = [...d.f.percentiles].sort((a, b) => a.percentil - b.percentil);
      const peor = porPercentil[0];
      const mejor = porPercentil[porPercentil.length - 1];
      const puesto = PUESTOS.find((p) => p.key === d.f.puesto)?.label.toLowerCase() ?? "su puesto";
      /* 08/11/2026: «p98» era jerga; se escribe entero. */
      const p = (x: { percentil: number }) => `percentil ${Math.round(x.percentil)}: supera al ${Math.round(x.percentil)} % de los ${puesto} comparados`;
      const corto = (d.f.ranking?.de ?? 0) < GRUPO_CORTO;
      const base = `${d.nota.avg.toFixed(1).replace(".", ",")} de nota (${d.nota.played} partidos) y ${d.f.indice} de índice${d.f.ranking ? ` (${textoRanking(d.f.ranking)})` : ""}`;
      const texto = notaAlta
        ? `${base}. Le baja el índice ${peor ? `${peor.metrica.nombre.toLowerCase()} (${p(peor)})` : "su perfil en Wyscout"}. Qué hacemos: ver con él 3 acciones de ${peor ? peor.metrica.nombre.toLowerCase() : "esa fase"} y decidir si es carencia (meta para la semana) o el rol que le damos (se apunta en su seguimiento).`
        : `${base}. Su índice se sostiene en ${mejor ? `${mejor.metrica.nombre.toLowerCase()} (${p(mejor)})` : "sus números de Wyscout"}. Qué hacemos: contrastar en vídeo si eso es lo que le pedimos en su puesto; si no, fijar con él una acción sobre ${peor && peor !== mejor ? `${peor.metrica.nombre.toLowerCase()} (percentil ${Math.round(peor.percentil)}), su punto más bajo; objetivo: acercarlo al percentil 50, la mediana del puesto` : "lo que le pedimos"}.`;
      /* 08/11/2026 (jueces): con un grupo corto (8 porteros) no es alerta, es tendencia en gris. */
      frases.push({
        /* 10/11/2026: el titular dice quién y qué pasa, con las dos cifras. */
        titulo: corto
          ? `${nombre(d)} · índice ${(d.f.indice ?? 0) < 50 ? "bajo" : "alto"} frente a ${d.f.ranking?.de} ${puesto} (tendencia)`
          : `${nombre(d)}: ${d.nota.avg.toFixed(1).replace(".", ",")} de nota y ${d.f.indice} de índice no cuadran`,
        tono: corto ? "tendencia" : "ojo",
        texto,
        abre: [d.f.jugador.jugador],
      });
    }

    return frases;
  }, [comparables]);

  /*
  | El jugador abierto obedece a los filtros de arriba (06/10/2026): antes, con
  | uno ya elegido, cambiar el puesto no hacía nada en la ficha. Si el elegido
  | no es del puesto filtrado, se abre el primero que sí lo es.
  */
  const activo = visibles.find((x) => x.f.jugador.jugador === elegido) ?? visibles[0] ?? null;

  /* Los equipos de la categoría, para compararse con los suyos. */
  const [equiposSel, setEquiposSel] = useState<string[]>([]);
  const equipos = useMemo(
    () =>
      ordena(
        [...new Set(jugadores.filter((j) => j.temporada === "actual" && !esNuestro(j)).map((j) => j.equipo))].filter(Boolean),
        (e) => e,
      ),
    [jugadores, ordena],
  );

  const abreFicha = (nombre: string) => {
    const suyo = conFicha.find((x) => x.f.jugador.jugador === nombre);
    if (suyo && filtroPuesto !== "todos" && suyo.f.puesto !== filtroPuesto) setFiltroPuesto(suyo.f.puesto);
    setElegido(nombre);
    setPestana("ficha");
  };

  const refLabel = REFERENCIAS.find((r) => r.key === ref)?.label ?? "";
  const cargando = datos === null;

  const kpis = useMemo(() => {
    const conIndice = filas.filter((f) => f.indice !== null);
    return {
      comparados: conIndice.length,
      top3: filas.filter((f) => f.ranking && f.ranking.posicion <= 3).length,
      media: conIndice.length ? Math.round(conIndice.reduce((s, f) => s + (f.indice ?? 0), 0) / conIndice.length) : null,
      mejoran: filas.filter((f) => f.evolucion?.fiable && f.evolucion.salto > ESTABLE).length,
      /* Contra cuántos jugadores de su puesto se compara cada uno. */
      grupoMin: Math.min(...filas.map((f) => f.ranking?.de ?? Infinity)),
      grupoMax: Math.max(...filas.map((f) => f.ranking?.de ?? 0)),
    };
  }, [filas]);

  const PESTANAS: { key: Pestana; label: string; icono: React.ReactNode }[] = [
    { key: "ranking", label: "Ranking de la plantilla", icono: <Users size={15} /> },
    { key: "graficos", label: "Gráficos por fase", icono: <ScatterChart size={15} /> },
    { key: "ficha", label: "Ficha del jugador", icono: <UserRound size={15} /> },
    { key: "cara", label: "Contra otros equipos", icono: <Swords size={15} /> },
  ];

  /* Wyscout (esta temporada y la pasada, los dos grupos) u Opta (todas las temporadas de Primera RFEF que hay). */
  const selectorFuente = (
    <>
      <span className="mr-1 text-[11px] uppercase tracking-wider text-white/35">Fuente</span>
      <Chip activo={fuente === "wyscout"} onClick={() => setFuente("wyscout")} fuerte>
        Wyscout
      </Chip>
      <Chip activo={fuente === "opta"} onClick={() => setFuente("opta")} fuerte>
        Opta
      </Chip>
    </>
  );

  return (
    <main className="min-h-screen bg-[#0B0F14] pb-24 text-white">
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />

          <section className="px-4 pb-12 pt-6 sm:px-8 sm:pt-10">
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">RMCF CASTILLA · INDIVIDUAL</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <BarChart3 className="h-7 w-7 text-[#C8A96B]" />
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Comparativa con la categoría</h1>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-white/55">
              Cada jugador del Castilla frente a los de su puesto en la categoría —los sub-21 ({CORTE_SUB21_TEXTO}), los sub-23 o todos—: dónde
              queda, en qué destaca por fase del juego y cómo ha cambiado desde el año pasado, junto a nuestras valoraciones
              y seguimientos.
            </p>

            {fuente === "opta" ? (
              <ComparativaOpta players={players} selectorFuente={selectorFuente} />
            ) : (
            <>
            {/* ---------------- filtros y pestañas, siempre a la vista ---------------- */}
            <div className="sticky top-[81px] z-20 -mx-4 mt-6 border-b border-white/[0.06] bg-[#0B0F14]/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-8 sm:px-8 md:top-[97px]">
              <div className="mb-2 flex flex-wrap items-center gap-2">{selectorFuente}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] uppercase tracking-wider text-white/35">Contra</span>
                {REFERENCIAS.map((r) => (
                  <Chip key={r.key} activo={ref === r.key} onClick={() => setRef(r.key)} fuerte>
                    {r.label}
                  </Chip>
                ))}
                <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
                <span className="mr-1 text-[11px] uppercase tracking-wider text-white/35">Puesto</span>
                {[{ key: "todos" as const, label: "Todos" }, ...PUESTOS.map((p) => ({ key: p.key, label: p.label }))].map((p) => (
                  <Chip key={p.key} activo={filtroPuesto === p.key} onClick={() => setFiltroPuesto(p.key)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
              <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist">
                {PESTANAS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    role="tab"
                    aria-selected={pestana === p.key}
                    onClick={() => setPestana(p.key)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition ${
                      pestana === p.key ? "bg-white/10 font-medium text-white" : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                    }`}
                  >
                    {p.icono}
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {cargando ? (
              <div role="status" className="mt-8">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
                  ))}
                </div>
                <p className="mt-4 flex items-center gap-2 text-sm text-white/50">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando los datos de la categoría. Si tarda más de 25 s,
                  podrás reintentar.
                </p>
              </div>
            ) : !datos?.ok ? (
              /* Un fallo de lectura se puede reintentar sin recargar la página (19/10/2026). */
              <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <span>{datos?.error ?? "No se han podido leer los datos."}</span>
                <button
                  type="button"
                  onClick={reintenta}
                  className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/15"
                >
                  Reintentar
                </button>
              </div>
            ) : filas.length === 0 ? (
              /* Sin datos no es un error: falta la descarga. Se dice de dónde sale. */
              <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/70">
                <p className="font-medium text-white/85">Todavía no hay jugadores del Castilla con minutos esta temporada en Wyscout.</p>
                <p className="mt-1 text-xs text-white/50">
                  La comparativa sale de la descarga de jugadores de toda la categoría. Se actualiza con el botón de Wyscout en
                  Ajustes (o con la descarga semanal del ordenador del club) y aparece aquí en cuanto se publica.
                </p>
              </div>
            ) : (
              <>
                {pestana === "ranking" && (
                  <>
                    {/* 30/10/2026: la base de todas las tarjetas en una línea, no repetida en cada una. */}
                    <p className="mt-6 text-xs text-white/55">
                      Contra {refLabel.toLowerCase()}
                      {Number.isFinite(kpis.grupoMin) && kpis.grupoMax > 0
                        ? `, ${kpis.grupoMin === kpis.grupoMax ? kpis.grupoMax : `${kpis.grupoMin} a ${kpis.grupoMax}`} jugadores por puesto`
                        : ""}
                      {" · "}índice = media de sus percentiles en las métricas de su puesto; más es mejor (50 = la media del grupo)
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {[
                        { t: "Jugadores comparados", v: kpis.comparados, h: "con índice esta temporada" },
                        { t: "Top 3 de su puesto", v: kpis.top3, h: "en el ranking de su puesto" },
                        ...(kpis.media !== null ? [{ t: "Índice medio", v: kpis.media, h: `de los nuestros comparados · ${kpis.media >= 50 ? "+" : "−"}${Math.abs(Math.round(kpis.media - 50))} sobre 50, la media de su puesto en la categoría`.replace("+-", "−") }] : []),
                        { t: "Mejoran respecto a 25/26", v: kpis.mejoran, h: `más de ${ESTABLE} pts de índice, con 450′ o más el año pasado (cada uno, contra su categoría de ese año)` },
                      ].map((k) => (
                        <div key={k.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs text-white/50">{k.t}</p>
                          <p className="mt-1 text-2xl font-semibold">{k.v}</p>
                          <p className="mt-1 text-[11px] text-white/35">{k.h}</p>
                        </div>
                      ))}
                    </div>

                    {lectura.length > 0 && (
                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        {lectura.map((l) => (
                          <div key={l.titulo} className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${l.tono === "tendencia" ? "opacity-80" : ""}`} style={{ borderTop: `3px solid ${l.tono === "bien" ? "#1B9E77" : l.tono === "mal" ? "#D95F02" : l.tono === "tendencia" ? tinta(0.3) : "#C8A96B"}` }}>
                            <p className={`text-sm font-semibold ${l.tono === "tendencia" ? "text-white/70" : "text-white"}`}>{l.titulo}</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-white/75">{l.texto}</p>
                            {l.abre && l.abre.length > 0 && (
                              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                {l.abre.map((j) => (
                                  <button key={j} type="button" onClick={() => abreFicha(j)} className="font-semibold text-[#C8A96B] underline-offset-2 hover:underline">
                                    Ficha de {nombreVisible(conFicha.find((x) => x.f.jugador.jugador === j)?.ficha?.nombre || j)} →
                                  </button>
                                ))}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="mt-5 text-xs text-white/40">Pincha en una columna para ordenar y en un jugador para abrir su ficha. El índice va de 0 a 100 (50 es la media del grupo de comparación); los minutos son los de Wyscout en la liga, así que pueden diferir de los minutos con nota de Valoraciones; el ranking compara con los jugadores de su puesto.</p>
                    <div className="mt-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] pr-14">
                      <table className="w-full text-sm sm:min-w-[860px]">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                            {(
                              [
                                ["nombre", "Jugador", "sticky left-0 z-[1] bg-[#0F141B] px-4"],
                                ["edad", "Edad", "hidden sm:table-cell px-2"],
                                [null, "Puesto", "hidden sm:table-cell px-2"],
                                ["minutos", "Min. liga", "hidden sm:table-cell px-2 text-right", "Minutos en la liga según Wyscout"],
                                ["nota", "Nota", "hidden sm:table-cell px-2 text-right", "Nota media de partido en Valoraciones · nº de partidos con nota"],
                                /* 07/11/2026: rótulo corto (en el móvil ocupaba cuatro líneas); «más es mejor» va en la línea de arriba y en el globo. */
                                ["indice", `Índice ${ref === "todos" ? "categoría" : ref === "u21" ? "sub-21" : "sub-23"}`, "px-3 sm:w-44", "De 0 a 100; 50 = la media de su puesto en el grupo elegido. Más es mejor."],
                                ["ranking", "Ranking", "px-2", "Puesto entre los de su posición del grupo. «2º-3º de 34» = empatado en índice con otro."],
                                ["evolucion", "Evolución (pts)", "hidden sm:table-cell px-2", `Puntos de índice frente a 25/26; entre −${ESTABLE} y +${ESTABLE}, estable. «Nuevo»: sin minutos en la categoría el año pasado.`],
                                ["seguimientos", "Nº seguim.", "hidden sm:table-cell px-2 text-right", `Registros de Calendario Seguimiento de cada jugador${desdeSeguimientos ? `, desde el ${desdeSeguimientos}` : ""}.`],
                              ] as [Orden | null, string, string, string?][]
                            ).map(([clave, texto, clase, ayuda]) => (
                              <th key={texto} className={`py-3 font-medium ${clase}`} title={ayuda}>
                                {clave ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOrden((o) => ({ por: clave, desc: o.por === clave ? !o.desc : clave !== "nombre" }))
                                    }
                                    className={`inline-flex items-center gap-1 uppercase hover:text-white/80 ${orden.por === clave ? "text-[#C8A96B]" : ""}`}
                                  >
                                    {texto}
                                    <ArrowDownUp size={10} className={orden.por === clave ? "" : "opacity-40"} />
                                  </button>
                                ) : (
                                  texto
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {comparables.map(({ f, ficha, nota, seg }) => (
                            <tr
                              key={f.jugador.jugador}
                              onClick={() => abreFicha(f.jugador.jugador)}
                              /* También con teclado: Tab hasta la fila y Enter (19/10/2026). */
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  abreFicha(f.jugador.jugador);
                                }
                              }}
                              aria-label={`Abrir la ficha de ${ficha?.nombre ?? f.jugador.jugador}`}
                              className={`cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none ${f.jugador.minutos < MUESTRA_CORTA ? "italic" : ""}`}
                            >
                              <td className="sticky left-0 z-[1] bg-[#0F141B] px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <Foto src={ficha?.foto} nombre={f.jugador.jugador} size={30} />
                                  <div className="min-w-0">
                                    <span className="font-medium text-white/90">{nombreVisible(ficha?.nombre ?? f.jugador.jugador)}{f.jugador.minutos < MUESTRA_CORTA && <span className="text-[#C8A96B]" title={`Menos de ${MUESTRA_CORTA}′: muestra corta`}>*</span>}</span>
                                    {/* 30/10/2026: en el móvil, lo que en escritorio va en columnas. */}
                                    <span className="block text-[10px] text-white/55 sm:hidden">
                                      {[
                                        PUESTOS.find((p) => p.key === f.puesto)?.corto,
                                        `${f.jugador.minutos}′`,
                                        nota && nota.played ? `nota ${nota.avg.toFixed(1).replace(".", ",")}` : null,
                                        f.evolucion ? (Math.abs(f.evolucion.salto) <= ESTABLE ? "estable vs 25/26" : `${f.evolucion.salto > 0 ? "+" : ""}${f.evolucion.salto} pts vs 25/26`) : "nuevo",
                                        seg?.n ? `${seg.n} seguim.` : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden sm:table-cell px-2 text-white/70">{f.jugador.edad}</td>
                              <td className="hidden sm:table-cell px-2 text-white/60">{PUESTOS.find((p) => p.key === f.puesto)?.corto}</td>
                              <td className="hidden sm:table-cell px-2 text-right tabular-nums text-white/70">{f.jugador.minutos}′</td>
                              <td className="hidden sm:table-cell px-2 text-right tabular-nums text-white/70" title={nota && nota.played ? `Nota media de ${nota.played} partidos con nota (Valoraciones)` : undefined}>{nota && nota.played ? <>{nota.avg.toFixed(1).replace(".", ",")}<span className="ml-1 text-[11px] text-white/45">· {nota.played} p.{nota.played < 3 ? " · tendencia" : ""}</span></> : ""}</td>
                              <td className="px-3">
                                <div className="flex items-center gap-2">
                                  {/* Muestra corta: en gris, que no se lea como fortaleza o carencia (07/11/2026). */}
                                  <span className="w-7 text-right text-xs font-semibold tabular-nums" style={{ color: f.jugador.minutos < MUESTRA_CORTA ? tinta(0.55) : colorIndice(f.indice) }}>
                                    {f.indice}
                                  </span>
                                  <Barra valor={f.indice ?? 0} color={f.jugador.minutos < MUESTRA_CORTA ? tinta(0.3) : colorIndice(f.indice)} />
                                </div>
                                {f.jugador.minutos < MUESTRA_CORTA && <span className="block text-[10px] not-italic text-white/45">tendencia · {f.jugador.minutos}′</span>}
                              </td>
                              <td
                                className="px-2 text-xs text-white/70"
                                title={f.ranking?.fueraDeEdad ? "Pasa de la edad del grupo: se le coloca entre ellos contando como uno más" : undefined}
                              >
                                {f.ranking ? textoRanking(f.ranking) : ""}
                                {f.ranking?.fueraDeEdad && <span className="block text-[10px] text-white/45">mayor de {ref === "u21" ? 21 : 23}, contado como uno más</span>}
                              </td>
                              <td className="hidden sm:table-cell px-2 text-xs">
                                {f.evolucion ? (
                                  <span
                                    className={`inline-flex items-center gap-0.5 ${f.evolucion.fiable ? "" : "opacity-45"}`}
                                    style={{ color: f.evolucion.salto > ESTABLE ? MEJOR : f.evolucion.salto < -ESTABLE ? PEOR : tinta(0.6) }}
                                    title={f.evolucion.fiable ? `${f.evolucion.salto > 0 ? "+" : ""}${f.evolucion.salto} puntos de índice frente a su categoría del año pasado` : "El año pasado jugó menos de 450′: poca muestra"}
                                  >
                                    {f.evolucion.salto > ESTABLE ? <ArrowUpRight size={13} /> : f.evolucion.salto < -ESTABLE ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                                    {Math.abs(f.evolucion.salto) <= ESTABLE ? (
                                      <>estable<span className="ml-1 text-[10px] opacity-70">({f.evolucion.salto > 0 ? "+" : ""}{f.evolucion.salto})</span></>
                                    ) : (
                                      <>{f.evolucion.salto > 0 ? "+" : ""}{f.evolucion.salto} pts</>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-white/45" title="Sin minutos en la categoría en 25/26">nuevo</span>
                                )}
                              </td>
                              <td className="hidden sm:table-cell px-2 text-right tabular-nums text-white/60">{seg?.n ? seg.n : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {cortos && (
                      <p className="mt-3 text-xs text-white/50">
                        <span className="text-[#C8A96B]">*</span> Menos de {MUESTRA_CORTA}′: muestra corta, el índice va en gris porque puede moverse mucho (tendencia). El índice compara con su puesto en la categoría; la nota, sólo nuestras valoraciones.
                      </p>
                    )}

                    {/* 07/11/2026: qué cuentan Evolución y Nº de seguimientos, junto a la tabla. */}
                    <p className="mt-3 text-xs text-white/50">
                      <b className="font-medium text-white/65">Evolución</b>: puntos de índice frente a su categoría en 25/26; entre −{ESTABLE} y +{ESTABLE} se lee estable; «nuevo», sin minutos en la categoría el año pasado.{" "}
                      <b className="font-medium text-white/65">Nº de seguimientos</b>: registros de Calendario Seguimiento de cada jugador{desdeSeguimientos ? `, desde el ${desdeSeguimientos}` : ""}.{" "}
                      <b className="font-medium text-white/65">Ranking</b>: «2º-3º de 34» es un empate en índice con otro jugador del puesto.
                    </p>

                    {pocosMinutos.length > 0 && (
                      <p className="mt-3 text-xs text-white/55">
                        Con menos de {MINUTOS_MINIMOS}′ en la liga no tienen índice y por eso no están en la tabla: {pocosMinutos.join(", ")}.
                      </p>
                    )}

                    {/* 30/10/2026: quien sale con el Castilla en Wyscout y no está en nuestra hoja de jugadores. */}
                    {sinFicha.length > 0 && (
                      <p className="mt-3 text-xs text-white/55">
                        Sin ficha en nuestra plantilla (Wyscout lo da con el Castilla, pero no está en la hoja de
                        jugadores; por eso no sale en Plantilla ni tiene nota): {sinFicha.join(", ")}.
                      </p>
                    )}

                    {ref !== "todos" && comparables.some((x) => x.f.ranking?.fueraDeEdad) && (
                      <p className="mt-3 text-xs text-white/55">
                        «Mayor de {ref === "u21" ? 21 : 23}»: pasa de la edad del grupo y se le coloca entre ellos contando como uno
                        más; por eso su «de N» lleva uno más que el de un compañero del mismo puesto que sí entra.
                      </p>
                    )}

                    <details className="mt-3 text-xs text-white/55">
                      <summary className="cursor-pointer text-white/70">Qué mide el índice de cada puesto</summary>
                      <ul className="mt-2 space-y-1.5">
                        {PUESTOS.map((p) => (
                          <li key={p.key}>
                            <span className="font-medium text-white/75">{p.label}:</span>{" "}
                            {metricasDe(p.key)
                              .filter((m) => m.mejorAlto !== null)
                              .map((m) => m.nombre)
                              .join(", ")}
                            .
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2">
                        Es la media de sus percentiles en esas métricas de Wyscout, contra los de su puesto del grupo
                        elegido. Con menos de {GRUPO_CORTO} en el grupo, el puesto es tendencia.
                      </p>
                    </details>
                  </>
                )}

                {pestana === "graficos" && (
                  <Graficos
                    jugadores={jugadores}
                    refe={ref}
                    refLabel={refLabel}
                    puesto={filtroPuesto}
                    elegido={activo?.f.jugador.jugador ?? null}
                    nombreDe={(j) => nombreVisible(fichaDe(j)?.nombre ?? j.jugador)}
                    onElige={abreFicha}
                    equipos={equipos}
                    equiposSel={equiposSel}
                    setEquiposSel={setEquiposSel}
                    escudoDe={escudoDe}
                    jornadaDe={jornadaDe}
                  />
                )}

                {pestana === "cara" && activo && (
                  <CaraACara
                    fila={activo.f}
                    ficha={activo.ficha}
                    jugadores={jugadores}
                    opciones={visibles}
                    onElige={setElegido}
                    equipos={equipos}
                    equiposSel={equiposSel}
                    setEquiposSel={setEquiposSel}
                    escudoDe={escudoDe}
                    jornadaDe={jornadaDe}
                  />
                )}

                {(pestana === "ficha" || pestana === "cara") && !activo && (
                  <p className="mt-8 text-sm text-white/50">Ningún jugador nuestro con minutos en ese puesto.</p>
                )}

                {pestana === "ficha" && activo && (
                  <>
                    <label className="mt-6 flex max-w-sm flex-col gap-1 text-[11px] uppercase tracking-wider text-white/40">
                      Jugador
                      <select
                        value={activo.f.jugador.jugador}
                        onChange={(e) => setElegido(e.target.value)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm normal-case tracking-normal text-white"
                      >
                        {[...visibles]
                          .sort((a, b) => (a.ficha?.nombre ?? a.f.jugador.jugador).localeCompare(b.ficha?.nombre ?? b.f.jugador.jugador, "es"))
                          .map((x) => (
                            <option key={x.f.jugador.jugador} value={x.f.jugador.jugador} className="bg-[#11161C]">
                              {x.ficha?.nombre ?? x.f.jugador.jugador} · {PUESTOS.find((p) => p.key === x.f.puesto)?.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Detalle
                      fila={activo.f}
                      jugadores={jugadores}
                      refe={ref}
                      refLabel={refLabel}
                      ficha={activo.ficha}
                      nota={activo.nota}
                      seg={activo.seg}
                      escudoDe={escudoDe}
                    />
                  </>
                )}

                <Explicativo>
                <p className="mt-8 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/35">
                  Índice = media de sus percentiles en las métricas de su puesto frente a {refLabel.toLowerCase()} con al
                  menos 90′ esta temporada (Wyscout, datos por 90′). Es un resumen para ordenar, no una nota: la ficha dice
                  en qué destaca cada uno. Los porcentajes sacados de muy pocas acciones no cuentan. La evolución compara su
                  percentil de este año con el del año pasado, cada uno contra su categoría; si el año pasado jugó menos de
                  450′ sale atenuada.
                </p>
                </Explicativo>
              </>
            )}
            </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  LOS GRÁFICOS POR FASE                                              */
/* ------------------------------------------------------------------ */

const etiquetaDe = (columna: string) => {
  const m = METRICA_JUGADOR_POR_COLUMNA.get(columna);
  if (!m) return columna;
  return `${m.nombre}${m.unidad === "porcentaje" ? "" : " /90"}${m.mejorAlto === false ? " (menos es mejor)" : ""}`;
};

/**
 * Los equipos de la categoría para compararse con los suyos.
 *
 * Son más de cincuenta (Wyscout trae los dos grupos), así que se busca por
 * nombre y los elegidos quedan arriba como chapas que se quitan de un toque.
 */
function SelectorEquipos({
  equipos,
  sel,
  setSel,
  escudoDe,
  jornadaDe,
  compacto,
}: {
  equipos: string[];
  sel: string[];
  setSel: (s: string[]) => void;
  escudoDe: (equipo: string) => string | null;
  /** La jornada en que se juega contra él, si es de nuestro grupo. */
  jornadaDe?: (equipo: string) => JornadaDeEquipo | null | undefined;
  compacto?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const limpio = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const lista = equipos.filter((e) => !sel.includes(e) && limpio(e).includes(limpio(busca)));
  const alterna = (e: string) => setSel(sel.includes(e) ? sel.filter((x) => x !== e) : [...sel, e]);
  const escudo = (e: string) => {
    const src = escudoDe(e);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
      <img src={src} alt="" className="h-4 w-4 shrink-0 object-contain" />
    ) : (
      <span className="h-4 w-4 shrink-0" />
    );
  };

  return (
    <div>
      {sel.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {sel.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => alterna(e)}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
              style={{ borderColor: COMPARADO, color: COMPARADO }}
              title="Quitar"
            >
              {escudo(e)}
              {e}
              <ChapaJornada jornada={jornadaDe?.(e)} />
              <X size={12} />
            </button>
          ))}
          <button type="button" onClick={() => setSel([])} className="px-1 text-[11px] text-white/40 hover:text-white/70">
            Quitar todos
          </button>
        </div>
      )}
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
        <Search size={13} className="text-white/35" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Busca un equipo…"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
        />
      </label>
      <div className={`mt-2 flex flex-wrap gap-1.5 overflow-y-auto ${compacto ? "max-h-28" : "max-h-44"}`}>
        {lista.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => alterna(e)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/65 transition hover:border-white/30 hover:text-white"
          >
            {escudo(e)}
            {e}
            <ChapaJornada jornada={jornadaDe?.(e)} />
          </button>
        ))}
        {lista.length === 0 && <span className="text-xs text-white/35">Ningún equipo con ese nombre.</span>}
      </div>
    </div>
  );
}

function Graficos({
  jugadores,
  refe,
  refLabel,
  puesto,
  elegido,
  nombreDe,
  onElige,
  equipos,
  equiposSel,
  setEquiposSel,
  escudoDe,
  jornadaDe,
}: {
  jugadores: FilaJugador[];
  refe: Referencia;
  refLabel: string;
  puesto: Puesto | "todos";
  elegido: string | null;
  nombreDe: (j: FilaJugador) => string;
  onElige: (nombre: string) => void;
  equipos: string[];
  equiposSel: string[];
  setEquiposSel: (s: string[]) => void;
  escudoDe: (equipo: string) => string | null;
  jornadaDe: (equipo: string) => JornadaDeEquipo | null;
}) {
  const [pregunta, setPregunta] = useState(0);
  const [ejes, setEjes] = useState<{ x: string; y: string } | null>(null);
  const [soloElegidos, setSoloElegidos] = useState(false);

  /*
  | Con porteros elegidos arriba (05/10/2026), sólo lo que le compete a un
  | portero: sus preguntas y, para elegir los ejes, sus métricas. Las de
  | jugador de campo —regates, centros, presión— no dicen nada de él.
  */
  const esPorteroArriba = puesto === "POR";
  const primeraDePortero = PREGUNTAS.findIndex((q) => q.fase === "por");
  const preguntaVista = esPorteroArriba && PREGUNTAS[pregunta].fase !== "por" ? primeraDePortero : pregunta;

  const p = PREGUNTAS[preguntaVista];
  const [faseVista, setFaseVista] = useState(p.fase);
  const fase = esPorteroArriba ? "por" : faseVista;
  /* En la fase de porteros, todo es de porteros: los puntos y las métricas que se ofrecen para los ejes. */
  const esPortero = fase === "por";
  const metricasEjes = METRICAS_JUGADOR.filter((m) => !esPortero || aplicaA(m, "POR"));
  const valeEje = (c?: string) => Boolean(c) && metricasEjes.some((m) => m.columna === c);
  const x = valeEje(ejes?.x) ? ejes!.x : p.x;
  const y = valeEje(ejes?.y) ? ejes!.y : p.y;

  /* Las de porteros, sólo con porteros; el resto, con el puesto de arriba. */
  const puestoGrafico: Puesto | "todos" = esPortero ? "POR" : puesto;
  const todos = useMemo(
    () => puntosDe(jugadores, refe, puestoGrafico, x, y, equiposSel),
    [jugadores, refe, puestoGrafico, x, y, equiposSel],
  );
  /* «Sólo los equipos elegidos»: los nuestros y los suyos; las medianas siguen siendo las de la categoría. */
  const puntos = soloElegidos && equiposSel.length ? todos.filter((q) => q.nuestro || q.comparado) : todos;

  /*
  | Las medianas, sólo con la referencia (19/10/2026). Los de los equipos
  | elegidos entran «de todas las edades», y metiéndolos en la cuenta elegir un
  | equipo movía las líneas: «la mediana de la categoría» cambiaba según a quién
  | se mirase. Ahora un comparado sólo cuenta si también es de la referencia.
  */
  const edadRef = REFERENCIAS.find((r) => r.key === refe)?.edad ?? 21;
  const deLaReferencia = todos.filter(
    (q) => !q.nuestro && (!q.comparado || (q.jugador.edad > 0 && q.jugador.edad <= edadRef)),
  );
  const mx = mediana(deLaReferencia.map((q) => q.x));
  const my = mediana(deLaReferencia.map((q) => q.y));
  const mejorX = !ejes && p.mejorX !== undefined ? p.mejorX : METRICA_JUGADOR_POR_COLUMNA.get(x)?.mejorAlto;
  const mejorY = METRICA_JUGADOR_POR_COLUMNA.get(y)?.mejorAlto;
  const porEncima = (v: number, m: number, mejor: boolean | null | undefined) => (mejor === false ? v < m : v > m);
  const destacan = puntos.filter((q) => q.nuestro && porEncima(q.x, mx, mejorX) && porEncima(q.y, my, mejorY));
  const destacanSuyos = puntos.filter((q) => q.comparado && porEncima(q.x, mx, mejorX) && porEncima(q.y, my, mejorY));

  const puestoTexto = puestoGrafico === "todos" ? "jugadores de campo" : PUESTOS.find((q) => q.key === puestoGrafico)?.label.toLowerCase();
  const fasesVisibles = FASES.filter((f) => (esPorteroArriba ? f.key === "por" : true));

  return (
    <div className="mt-5 space-y-3">
      {/* ---- la pregunta: fase y luego pregunta, en dos filas cortas ---- */}
      <div className="flex flex-wrap items-center gap-1.5">
        {fasesVisibles.map((f) => (
          <Chip
            key={f.key}
            activo={fase === f.key}
            onClick={() => {
              setFaseVista(f.key);
              const primera = PREGUNTAS.findIndex((q) => q.fase === f.key);
              if (primera >= 0) {
                setPregunta(primera);
                setEjes(null);
              }
            }}
          >
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PREGUNTAS.map((q, i) =>
          q.fase === fase ? (
            <button
              key={q.pregunta}
              type="button"
              onClick={() => {
                setPregunta(i);
                setEjes(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-left text-sm transition ${
                !ejes && preguntaVista === i ? "bg-[#C8A96B]/15 text-[#C8A96B]" : "bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
              }`}
            >
              {q.pregunta}
            </button>
          ) : null,
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-base font-semibold">{ejes ? `${etiquetaDe(x)} frente a ${etiquetaDe(y)}` : p.pregunta}</p>
            <p className="text-[11px] text-white/40">
              {puntos.length} {puestoTexto} · líneas = mediana de la categoría
            </p>
          </div>
          <p className="mt-0.5 text-xs text-white/45">{ejes ? "Las dos métricas elegidas." : p.lectura}</p>

          {puntos.length < 3 ? (
            <p className="mt-6 text-sm text-white/45">No hay bastantes jugadores con esas dos métricas para dibujarlas.</p>
          ) : (
            <VistasDispersion puntos={puntos} x={x} y={y} mx={mx} my={my} elegido={elegido} nombreDe={nombreDe} onElige={onElige} />
          )}

          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-white/45">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ORO }} /> Castilla (pincha para abrir su ficha)
            </span>
            {equiposSel.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COMPARADO }} /> Equipos elegidos (todas las edades)
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: tinta(0.3) }} /> {refLabel}
            </span>
          </div>
        </div>

        <aside className="space-y-3">
          {(destacan.length > 0 || destacanSuyos.length > 0) && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
              <p className="text-[11px] uppercase tracking-wider text-white/40">Por encima de la mediana en las dos</p>
              {destacan.length > 0 && <p className="mt-1.5 text-[#C8A96B]">{destacan.map((q) => nombreDe(q.jugador)).join(", ")}</p>}
              {destacanSuyos.length > 0 && (
                <p className="mt-1.5" style={{ color: COMPARADO }}>
                  {destacanSuyos.map((q) => `${q.jugador.jugador} (${q.jugador.equipo})`).join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40">Compararse con equipos</p>
            <div className="mt-2">
              <SelectorEquipos equipos={equipos} sel={equiposSel} setSel={setEquiposSel} escudoDe={escudoDe} jornadaDe={jornadaDe} compacto />
            </div>
            {equiposSel.length > 0 && (
              <label className="mt-2 flex items-center gap-2 text-xs text-white/60">
                <input type="checkbox" checked={soloElegidos} onChange={(e) => setSoloElegidos(e.target.checked)} />
                Ver sólo los nuestros y los de esos equipos
              </label>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40">O elige tú las dos métricas</p>
            {(["x", "y"] as const).map((eje) => (
              <label key={eje} className="mt-2 block text-[11px] text-white/45">
                {eje === "x" ? "Eje horizontal" : "Eje vertical"}
                <select
                  value={eje === "x" ? x : y}
                  onChange={(e) => setEjes({ x: eje === "x" ? e.target.value : x, y: eje === "y" ? e.target.value : y })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white"
                >
                  {[
                    ["con", "Con balón"],
                    ["sin", "Sin balón"],
                    ["abp", "Balón parado"],
                    ["general", "General"],
                  ].map(([f, rotulo]) => (
                    <optgroup key={f} label={rotulo} className="bg-[#11161C]">
                      {metricasEjes.filter((m) => m.fase === f).map((m) => (
                        <option key={m.columna} value={m.columna} className="bg-[#11161C]">
                          {m.nombre}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            ))}
            {ejes && (
              <button type="button" onClick={() => setEjes(null)} className="mt-2 text-[11px] text-[#C8A96B] hover:underline">
                Volver a la pregunta
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/*
| La dispersión con «ver como» (06/11/2026): la de siempre (valores), el mapa
| de élite (cada eje en percentil dentro de los que se ven, diagonales y zona
| de los mejores en las dos cosas) o el ranking por la suma.
*/
function VistasDispersion(props: Parameters<typeof Dispersion>[0]) {
  const [tipo, setTipo] = useTipoGrafico("comparativa-dispersion", "dispersion", ["dispersion", "mapa", "ranking"] as const);
  const { puntos, x, y, nombreDe } = props;
  const mapa = useMemo<PuntoMapa[]>(() => {
    const rango = (vals: number[]) => {
      const o = [...vals].sort((a, b) => a - b);
      return vals.map((v) => (vals.length < 2 ? 50 : (100 * o.indexOf(v)) / (vals.length - 1)));
    };
    const rx = rango(puntos.map((p) => p.x));
    const ry = rango(puntos.map((p) => p.y));
    return puntos.map((p, i) => ({
      id: `${p.jugador.jugador}|${p.jugador.equipo}`,
      nombre: nombreDe(p.jugador),
      x: rx[i],
      y: ry[i],
      propio: p.nuestro,
      color: p.nuestro ? ORO : p.comparado ? COMPARADO : undefined,
      detalle: `${p.jugador.equipo} · ${p.jugador.edad} años · ${x} ${p.x.toFixed(2).replace(".", ",")} · ${y} ${p.y.toFixed(2).replace(".", ",")}`,
    }));
  }, [puntos, x, y, nombreDe]);
  return (
    <MarcoGrafico
      tipos={[{ clave: "dispersion", nombre: "Dispersión (valores)" }, { clave: "mapa", nombre: "Mapa de élite (percentiles)" }, { clave: "ranking", nombre: "Ranking" }]}
      tipo={tipo}
      onTipo={(t) => setTipo(t as "dispersion" | "mapa" | "ranking")}
    >
      {tipo === "dispersion" && <Dispersion {...props} />}
      {tipo === "mapa" && <MapaDosEjes puntos={mapa} ejeX={x} ejeY={y} rotulos={{ ambos: "Mejores en las dos", soloX: `Sólo ${x.toLowerCase()}`, soloY: `Sólo ${y.toLowerCase()}`, nada: "Sin destacar todavía" }} />}
      {tipo === "ranking" && (
        <ol className="space-y-1 text-[13px]">
          {[...mapa].sort((a, b) => b.x + b.y - (a.x + a.y)).slice(0, 20).map((p, i) => (
            <li key={p.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${p.propio ? "bg-[#C8A96B]/15 font-semibold" : ""}`}>
              <span className="w-7 tabular-nums text-white/50">{i + 1}º</span>
              <span className="min-w-0 flex-1 truncate text-white/85">{p.nombre} <span className="text-white/45">· {p.detalle}</span></span>
              <span className="shrink-0 tabular-nums text-white/70">{Math.round(p.x)} · {Math.round(p.y)}</span>
            </li>
          ))}
        </ol>
      )}
    </MarcoGrafico>
  );
}

function Dispersion({
  puntos,
  x,
  y,
  mx,
  my,
  elegido,
  nombreDe,
  onElige,
}: {
  puntos: PuntoJugador[];
  x: string;
  y: string;
  mx: number;
  my: number;
  elegido: string | null;
  nombreDe: (j: FilaJugador) => string;
  onElige: (nombre: string) => void;
}) {
  const W = 640;
  const H = 360;
  const M = { l: 48, r: 16, t: 14, b: 40 };
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  /* Con margen, pero sin inventarse negativos: si nada baja de cero, el eje empieza en cero. */
  const rango = (v: number[]) => {
    const min = Math.min(...v);
    const max = Math.max(...v);
    const pad = (max - min || 1) * 0.06;
    return [min >= 0 ? Math.max(0, min - pad) : min - pad, max + pad] as const;
  };


  const [x0, x1] = rango(xs);
  const [y0, y1] = rango(ys);
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
  const ticks = (a: number, b: number) => [0, 0.25, 0.5, 0.75, 1].map((t) => a + (b - a) * t);

  /*
  | Los nombres de los nuestros sin pisarse: se prueba a la derecha arriba,
  | derecha abajo, izquierda arriba e izquierda abajo, y si no cabe en ningún
  | sitio se queda sin rótulo (el punto sigue diciendo quién es al pasar por
  | encima). El elegido va primero, para que el suyo salga siempre.
  */
  const rotulos = (() => {
    const puestos: { x: number; y: number; w: number; h: number }[] = [];
    const salida = new Map<string, { x: number; y: number; ancla: "start" | "end" }>();
    const nuestros = puntos
      .filter((p) => p.nuestro || p.comparado)
      .sort((a, b) => Number(b.jugador.jugador === elegido) - Number(a.jugador.jugador === elegido));
    const choca = (r: { x: number; y: number; w: number; h: number }) =>
      puestos.some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y) ||
      nuestros.some((p) => {
        const cx = sx(p.x);
        const cy = sy(p.y);
        return cx > r.x - 3 && cx < r.x + r.w + 3 && cy > r.y - 3 && cy < r.y + r.h + 3;
      });
    for (const p of nuestros) {
      const texto = p.nuestro ? apellido(nombreDe(p.jugador)) : apellido(p.jugador.jugador);
      const w = texto.length * 5.8;
      const h = 11;
      const cx = sx(p.x);
      const cy = sy(p.y);
      const pruebas: { x: number; y: number; ancla: "start" | "end" }[] = [
        { x: cx + 7, y: cy - 6, ancla: "start" },
        { x: cx + 7, y: cy + 13, ancla: "start" },
        { x: cx - 7, y: cy - 6, ancla: "end" },
        { x: cx - 7, y: cy + 13, ancla: "end" },
      ];
      for (const t of pruebas) {
        const caja = { x: t.ancla === "start" ? t.x : t.x - w, y: t.y - 9, w, h };
        if (caja.x < 0 || caja.x + w > W || !choca(caja)) {
          if (caja.x >= 0 && caja.x + w <= W) {
            puestos.push(caja);
            salida.set(`${p.jugador.jugador}|${p.jugador.equipo}`, t);
            break;
          }
        }
      }
    }
    return salida;
  })();

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-2 w-full"
      style={{ maxHeight: "max(260px, calc(100vh - 470px))" }}
      role="img"
      aria-label={`${etiquetaDe(x)} frente a ${etiquetaDe(y)}`}
    >
      {ticks(x0, x1).map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke={tinta(0.06)} />
          <text x={sx(t)} y={H - M.b + 14} fontSize={10} textAnchor="middle" fill={tinta(0.45)}>
            {formatea(t)}
          </text>
        </g>
      ))}
      {ticks(y0, y1).map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={tinta(0.06)} />
          <text x={M.l - 6} y={sy(t) + 3} fontSize={10} textAnchor="end" fill={tinta(0.45)}>
            {formatea(t)}
          </text>
        </g>
      ))}
      <line x1={sx(mx)} x2={sx(mx)} y1={M.t} y2={H - M.b} stroke={tinta(0.3)} strokeDasharray="4 4" />
      <line x1={M.l} x2={W - M.r} y1={sy(my)} y2={sy(my)} stroke={tinta(0.3)} strokeDasharray="4 4" />
      <text x={(M.l + W - M.r) / 2} y={H - 6} fontSize={11} textAnchor="middle" fill={tinta(0.6)}>
        {etiquetaDe(x)}
      </text>
      <text x={12} y={(M.t + H - M.b) / 2} fontSize={11} textAnchor="middle" fill={tinta(0.6)} transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>
        {etiquetaDe(y)}
      </text>

      {puntos
        .filter((p) => !p.nuestro && !p.comparado)
        .map((p) => (
          <circle key={`${p.jugador.jugador}-${p.jugador.equipo}`} cx={sx(p.x)} cy={sy(p.y)} r={3.4} fill={tinta(0.28)}>
            <title>{`${p.jugador.jugador} (${p.jugador.equipo}), ${p.jugador.edad} años · ${formatea(p.x)} · ${formatea(p.y)}`}</title>
          </circle>
        ))}
      {puntos
        .filter((p) => p.comparado)
        .map((p) => {
          const r = rotulos.get(`${p.jugador.jugador}|${p.jugador.equipo}`);
          return (
            <g key={`c-${p.jugador.jugador}-${p.jugador.equipo}`}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={4.4} fill={COMPARADO}>
                <title>{`${p.jugador.jugador} (${p.jugador.equipo}), ${p.jugador.edad} años · ${formatea(p.x)} · ${formatea(p.y)}`}</title>
              </circle>
              {r && (
                <text x={r.x} y={r.y} textAnchor={r.ancla} fontSize={9.5} fill={COMPARADO}>
                  {apellido(p.jugador.jugador)}
                </text>
              )}
            </g>
          );
        })}
      {puntos
        .filter((p) => p.nuestro)
        .map((p) => {
          const es = p.jugador.jugador === elegido;
          return (
            <g key={p.jugador.jugador} className="cursor-pointer" onClick={() => onElige(p.jugador.jugador)}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={es ? 6.5 : 5} fill={ORO} stroke={es ? "white" : "rgba(0,0,0,.35)"} strokeWidth={es ? 1.5 : 0.8}>
                <title>{`${nombreDe(p.jugador)}, ${p.jugador.edad} años · ${formatea(p.x)} · ${formatea(p.y)}`}</title>
              </circle>
              {rotulos.has(`${p.jugador.jugador}|${p.jugador.equipo}`) && (
                <text
                  x={rotulos.get(`${p.jugador.jugador}|${p.jugador.equipo}`)!.x}
                  y={rotulos.get(`${p.jugador.jugador}|${p.jugador.equipo}`)!.y}
                  textAnchor={rotulos.get(`${p.jugador.jugador}|${p.jugador.equipo}`)!.ancla}
                  fontSize={10}
                  fill={ORO}
                  fontWeight={es ? 700 : 500}
                >
                  {apellido(nombreDe(p.jugador))}
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  LA FICHA                                                           */
/* ------------------------------------------------------------------ */

function Detalle({
  fila,
  jugadores,
  refe,
  refLabel,
  ficha,
  nota,
  seg,
  escudoDe,
}: {
  fila: FilaComparativa;
  jugadores: FilaJugador[];
  refe: Referencia;
  refLabel: string;
  ficha: { id: string; nombre: string; foto?: string } | null | undefined;
  nota?: ReturnType<ReturnType<typeof summarizeAll>["get"]>;
  seg?: { n: number; ultima: string };
  escudoDe: (equipo: string) => string | null;
}) {
  const j = fila.jugador;
  const orden = [...fila.percentiles].sort((a, b) => b.percentil - a.percentil);
  const cuantas = Math.min(5, Math.floor(orden.length / 2));
  const fuertes = orden.slice(0, cuantas);
  const flojos = cuantas ? orden.slice(-cuantas).reverse() : [];
  /* Todo el ranking del puesto; se enseñan los ocho primeros y «Ver todos» despliega el resto, con los nuestros marcados. */
  const ranking = useMemo(() => mejoresDe(jugadores, fila.puesto, refe, Infinity), [jugadores, fila.puesto, refe]);
  const [verTodos, setVerTodos] = useState(false);
  const mejores = verTodos ? ranking : ranking.slice(0, 8);
  const nuestrosFuera = ranking.slice(8).filter((m) => esNuestro(m.jugador)).length;
  const nube = useMemo(() => nubeDe(jugadores, fila.puesto), [jugadores, fila.puesto]);
  const puestoLabel = PUESTOS.find((p) => p.key === fila.puesto)?.label.toLowerCase() ?? "";

  /* La radiografía de percentiles (06/11/2026): seis con balón y seis sin balón, repartidas entre grupos. */
  const cunas: CunaPercentil[] = (["con", "sin"] as const).flatMap((lado) => {
    const suyas = fila.percentiles.filter((p) => p.metrica.fase === lado && p.valor !== 0 && !/penalti/i.test(p.metrica.nombre));
    const vistos = new Set<string>();
    const primero = suyas.filter((p) => (vistos.has(p.metrica.grupo) ? false : (vistos.add(p.metrica.grupo), true)));
    const resto = suyas.filter((p) => !primero.includes(p));
    return [...primero, ...resto].slice(0, 6).map((p) => ({
      nombre: `${p.metrica.nombre.replace(/ %$/, "")}${p.metrica.mejorAlto === false ? " ↓" : ""}`,
      valor: p.metrica.unidad === "porcentaje" ? `${p.valor.toFixed(1).replace(".", ",")} %` : p.valor.toFixed(Math.abs(p.valor) >= 10 ? 1 : 2).replace(".", ","),
      percentil: p.percentil,
      lado,
    }));
  });

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[320px_1fr_1fr]">
      {cunas.length >= 6 && (
        <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white sm:block xl:col-span-3">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#C8A96B]">Radiografía de percentiles <span className="text-[11px] font-semibold normal-case tracking-normal text-white/55">· frente a su referencia ({REFERENCIAS.find((r) => r.key === refe)?.label.toLowerCase()})</span></p>
          <p className="text-[12px] text-white/55">La cuña llega hasta su percentil; a la derecha con balón, a la izquierda sin balón. Alto siempre es mejor (en las marcadas con ↓ ya está dado la vuelta).</p>
          <div className="mx-auto max-w-[900px]"><RadiografiaPercentiles cunas={cunas} /></div>
        </div>
      )}
      {/* ---- quién es ---- */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3">
          <Foto src={ficha?.foto} nombre={j.jugador} size={64} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{ficha?.nombre ?? j.jugador}</p>
            <p className="text-xs text-white/50">
              {j.edad} años · {PUESTOS.find((p) => p.key === fila.puesto)?.label} · {j.posicion}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-4xl font-semibold" style={{ color: colorIndice(fila.indice) }}>
            {fila.indice ?? "—"}
          </span>
          <span className="text-xs text-white/45">
            índice frente a {refLabel.toLowerCase()}
            {fila.ranking ? ` · ${textoRanking(fila.ranking)}` : ""}
          </span>
        </div>
        {/* Lo que no tiene dato no se nombra: la fila sin valor no sale (07/11/2026). */}
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {[
            ["Minutos", `${j.minutos}′ en ${j.partidos} partidos`],
            ["Altura · peso", j.altura ? (j.peso ? `${j.altura} cm · ${j.peso} kg` : `${j.altura} cm`) : j.peso ? `${j.peso} kg` : ""],
            ["Pie", j.pie || ""],
            ["Contrato", j.contrato || ""],
            ["Nota media", nota && nota.played ? `${nota.avg.toFixed(1).replace(".", ",")} (${nota.played} partidos)` : ""],
            ["Titularidades", nota ? String(nota.starts) : ""],
            ["Goles · asist.", nota ? `${nota.goals} · ${nota.assists}` : ""],
            ["Seguimientos", seg ? `${seg.n}${seg.ultima ? ` · último ${seg.ultima.split("-").reverse().join("/")}` : ""}` : "0"],
            [
              "Evolución",
              fila.evolucion ? `${fila.evolucion.salto > 0 ? "+" : ""}${fila.evolucion.salto} pts${fila.evolucion.fiable ? "" : " (poca muestra)"}` : "",
            ],
          ].filter(([, v]) => v).map(([t, v]) => (
            <div key={t} className="contents">
              <dt className="text-white/40">{t}</dt>
              <dd className="text-right text-white/80">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ---- fuertes y a mejorar ---- */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold">Frente a {refLabel.toLowerCase().replace(" de la categoría", "")} ({puestoLabel})</p>
        <p className="mt-1 text-[11px] text-white/40">Percentil en cada métrica de su puesto: 100 = el mejor del grupo.</p>
        {fila.percentiles.length === 0 ? (
          <p className="mt-4 text-sm text-white/45">No hay bastantes jugadores de su puesto en la referencia para compararle.</p>
        ) : (
          [
            { t: "Donde destaca", lista: fuertes, color: MEJOR },
            { t: "Donde está por debajo", lista: flojos, color: PEOR },
          ].map((g) => (
            <div key={g.t} className="mt-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-white/40">{g.t}</p>
              <div className="space-y-2.5">
                {g.lista.map((p) => (
                  <div key={p.metrica.columna} title={p.metrica.comoLeer}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate text-white/80">{p.metrica.nombre}</span>
                      <span className="shrink-0 tabular-nums text-white/45">
                        {Number(p.valor.toFixed(2))} · <b style={{ color: g.color }}>P{p.percentil}</b>
                      </span>
                    </div>
                    <div className="mt-1">
                      <Barra valor={p.percentil} color={g.color} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ---- los mejores de su edad y la nube ---- */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold">Los mejores {refe === "todos" ? "" : refe === "u21" ? "sub-21 " : "sub-23 "}del puesto en la categoría</p>
        <ol className={`mt-3 space-y-1.5 ${verTodos ? "max-h-[440px] overflow-y-auto pr-1" : ""}`}>
          {mejores.map((m, i) => {
            const suyo = m.jugador === j;
            const nuestro = esNuestro(m.jugador);
            const escudo = escudoDe(m.jugador.equipo);
            return (
              <li
                key={`${m.jugador.jugador}-${m.jugador.equipo}`}
                title={m.jugador.equipo}
                className={`flex items-center gap-2 rounded-lg border-l-2 px-2 py-1 text-xs ${
                  suyo ? "border-[#C8A96B] bg-[#C8A96B]/20" : nuestro ? "border-[#C8A96B]/70 bg-[#C8A96B]/[0.08]" : "border-transparent"
                }`}
              >
                <span className={`w-6 tabular-nums ${nuestro ? "font-semibold text-[#C8A96B]" : "text-white/35"}`}>{i + 1}</span>
                {escudo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
                  <img src={escudo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                ) : (
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/10 text-[8px] text-white/60">{m.jugador.equipo.slice(0, 1)}</span>
                )}
                <span className={`min-w-0 flex-1 truncate ${nuestro ? "font-semibold text-[#C8A96B]" : "text-white/80"}`}>
                  {m.jugador.jugador}
                  {verTodos && !nuestro ? <span className="ml-1.5 text-[10px] font-normal text-white/35">{m.jugador.equipo}</span> : null}
                </span>
                {nuestro ? <span className="rounded bg-[#C8A96B]/20 px-1 text-[9px] font-semibold tracking-wider text-[#C8A96B]">RMC</span> : null}
                <span className="text-white/40">{m.jugador.edad}</span>
                <span className="w-7 text-right font-semibold tabular-nums" style={{ color: colorIndice(m.indice) }}>
                  {m.indice}
                </span>
              </li>
            );
          })}
        </ol>
        {ranking.length > 8 ? (
          <button
            type="button"
            onClick={() => setVerTodos((v) => !v)}
            className="mt-2 w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B]"
          >
            {verTodos
              ? "Ver sólo los 8 primeros"
              : `Ver todos (${ranking.length})${nuestrosFuera ? ` · ${nuestrosFuera} ${nuestrosFuera === 1 ? "nuestro" : "nuestros"} más abajo` : ""}`}
          </button>
        ) : null}

        <p className="mt-5 text-sm font-semibold">Proyección: edad y nivel</p>
        <p className="mt-1 text-[11px] text-white/40">
          Todos los {puestoLabel} de la categoría con minutos. Arriba a la izquierda, jóvenes que ya rinden.
        </p>
        <Nube puntos={nube} activo={j} />
      </div>
    </div>
  );
}

function Nube({
  puntos,
  activo,
}: {
  puntos: { jugador: FilaJugador; edad: number; indice: number; nuestro: boolean }[];
  activo: FilaJugador;
}) {
  const W = 320;
  const H = 200;
  const edades = puntos.map((p) => p.edad);
  const xMin = Math.min(17, ...edades);
  const xMax = Math.max(34, ...edades);
  const x = (e: number) => 28 + ((e - xMin) / (xMax - xMin)) * (W - 40);
  const y = (i: number) => H - 22 - (i / 100) * (H - 34);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Edad frente a índice de nivel">
      <rect x={x(xMin)} y={y(100)} width={x(21.5) - x(xMin)} height={y(0) - y(100)} fill={ORO} opacity={0.07} />
      <text x={x(xMin) + 3} y={y(100) + 10} fontSize={8} fill={ORO} opacity={0.8}>
        sub-21
      </text>
      <line x1={x(xMin)} x2={W - 8} y1={y(50)} y2={y(50)} stroke={tinta(0.15)} strokeDasharray="3 3" />
      {[18, 21, 24, 27, 30, 33].filter((e) => e >= xMin && e <= xMax).map((e) => (
        <text key={e} x={x(e)} y={H - 6} fontSize={8} textAnchor="middle" fill={tinta(0.4)}>
          {e}
        </text>
      ))}
      {[0, 50, 100].map((v) => (
        <text key={v} x={20} y={y(v) + 3} fontSize={8} textAnchor="end" fill={tinta(0.4)}>
          {v}
        </text>
      ))}
      {puntos
        .filter((p) => !p.nuestro)
        .map((p) => (
          <circle key={`${p.jugador.jugador}-${p.jugador.equipo}`} cx={x(p.edad)} cy={y(p.indice)} r={2.6} fill={tinta(0.28)}>
            <title>{`${p.jugador.jugador} (${p.jugador.equipo}), ${p.edad} años · ${p.indice}`}</title>
          </circle>
        ))}
      {puntos
        .filter((p) => p.nuestro)
        .map((p) => {
          const es = p.jugador === activo;
          return (
            <g key={p.jugador.jugador}>
              <circle cx={x(p.edad)} cy={y(p.indice)} r={es ? 5.5 : 3.6} fill={ORO} stroke={es ? "white" : "none"} strokeWidth={1.2}>
                <title>{`${p.jugador.jugador}, ${p.edad} años · ${p.indice}`}</title>
              </circle>
              {es && (
                <text x={x(p.edad) + 7} y={y(p.indice) + 3} fontSize={9} fill={ORO} fontWeight={600}>
                  {p.jugador.jugador.split(" ").slice(-1)[0]}
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  CONTRA OTROS EQUIPOS                                               */
/* ------------------------------------------------------------------ */

/**
 * Uno de los nuestros contra los de su puesto de los equipos que se elijan,
 * métrica a métrica (06/10/2026).
 *
 * Todos se leen en percentil contra **toda la categoría del puesto** —no
 * contra los sub-21—: aquí la pregunta es «¿es mejor o peor que el lateral
 * del Ibiza?», y para eso los dos tienen que estar medidos con la misma vara.
 * En cada fila se marca el mejor y, arriba, en cuántas le gana el nuestro a
 * cada uno.
 */
function CaraACara({
  fila,
  ficha,
  jugadores,
  opciones,
  onElige,
  equipos,
  equiposSel,
  setEquiposSel,
  escudoDe,
  jornadaDe,
}: {
  fila: FilaComparativa;
  ficha: { id: string; nombre: string; foto?: string } | null | undefined;
  jugadores: FilaJugador[];
  opciones: { f: FilaComparativa; ficha: { nombre: string } | null | undefined }[];
  onElige: (nombre: string) => void;
  equipos: string[];
  equiposSel: string[];
  setEquiposSel: (s: string[]) => void;
  escudoDe: (equipo: string) => string | null;
  jornadaDe: (equipo: string) => JornadaDeEquipo | null;
}) {
  const [todas, setTodas] = useState(false);
  const puesto = fila.puesto;
  const nuestro = fila.jugador;

  const categoria = useMemo(() => referenciaDe(jugadores, puesto, "todos"), [jugadores, puesto]);

  const rivales = useMemo(
    () =>
      jugadores
        .filter(
          (j) =>
            j.temporada === "actual" &&
            j.minutos >= MINUTOS_MINIMOS &&
            equiposSel.includes(j.equipo) &&
            puestoDe(j.posicion) === puesto,
        )
        .sort((a, b) => b.minutos - a.minutos)
        .slice(0, 12),
    [jugadores, equiposSel, puesto],
  );

  /* Las métricas del puesto, por grupos; «las clave» son las tres primeras de cada grupo. */
  const metricas = useMemo(() => {
    const delPuesto = metricasDe(puesto).filter((m) => m.mejorAlto !== null);
    return gruposDe(puesto).flatMap((g) => {
      const suyas = delPuesto.filter((m) => m.grupo === g);
      return (todas ? suyas : suyas.slice(0, 3)).map((m) => ({ ...m, grupoRotulo: g }));
    });
  }, [puesto, todas]);

  const columnas = [nuestro, ...rivales];

  const celda = (j: FilaJugador, columna: string) => {
    const valor = valorDe(j, columna);
    if (valor === null) return null;
    const fiable = volumenDelPorcentaje(j, columna).fiable;
    const m = METRICA_JUGADOR_POR_COLUMNA.get(columna);
    const percentil = fiable
      ? percentilEnPlantilla(
          valor,
          categoria
            .filter((c) => volumenDelPorcentaje(c, columna).fiable)
            .map((c) => valorDe(c, columna))
            .filter((v): v is number => v !== null),
          m?.mejorAlto ?? true,
        )
      : null;
    return { valor, percentil };
  };

  const tabla = metricas.map((m) => ({ m, celdas: columnas.map((j) => celda(j, m.columna)) }));

  /* En cuántas le gana el nuestro a cada uno (sólo donde los dos tienen percentil). */
  const marcador = rivales.map((_, i) => {
    let gana = 0;
    let de = 0;
    for (const t of tabla) {
      const a = t.celdas[0]?.percentil;
      const b = t.celdas[i + 1]?.percentil;
      if (a == null || b == null) continue;
      de++;
      if (a > b) gana++;
    }
    return { gana, de };
  });

  const indices = columnas.map((j) => indiceDe(percentilesDe(j, categoria, puesto)));
  const puestoLabel = PUESTOS.find((p) => p.key === puesto)?.label.toLowerCase() ?? "";

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-white/40">
          Nuestro jugador
          <select
            value={nuestro.jugador}
            onChange={(e) => onElige(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm normal-case tracking-normal text-white"
          >
            {[...opciones]
              .sort((a, b) => (a.ficha?.nombre ?? a.f.jugador.jugador).localeCompare(b.ficha?.nombre ?? b.f.jugador.jugador, "es"))
              .map((x) => (
                <option key={x.f.jugador.jugador} value={x.f.jugador.jugador} className="bg-[#11161C]">
                  {x.ficha?.nombre ?? x.f.jugador.jugador} · {PUESTOS.find((p) => p.key === x.f.puesto)?.label}
                </option>
              ))}
          </select>
        </label>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-wider text-white/40">Contra los {puestoLabel} de</p>
          <div className="mt-2">
            <SelectorEquipos equipos={equipos} sel={equiposSel} setSel={setEquiposSel} escudoDe={escudoDe} jornadaDe={jornadaDe} />
          </div>
        </div>
        <Explicativo>
        <p className="text-[11px] leading-relaxed text-white/35">
          Percentil de cada uno contra todos los {puestoLabel} de la categoría con al menos 90′ (P100 = el mejor). Entran los
          de su puesto de esos equipos con 90′ o más, de más a menos minutos. Los porcentajes de muy pocas acciones se enseñan sin
          percentil.
        </p>
        </Explicativo>
      </aside>

      <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {equiposSel.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/45">
            Elige uno o varios equipos a la izquierda para poner a {ficha?.nombre ?? nuestro.jugador} frente a sus {puestoLabel}.
          </p>
        ) : rivales.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/45">
            Esos equipos no tienen {puestoLabel} con 90′ o más esta temporada.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {ficha?.nombre ?? nuestro.jugador} frente a {rivales.length} {puestoLabel}
              </p>
              <div className="flex gap-1.5">
                <Chip activo={!todas} onClick={() => setTodas(false)}>
                  Las clave
                </Chip>
                <Chip activo={todas} onClick={() => setTodas(true)}>
                  Todas las de su puesto
                </Chip>
              </div>
            </div>
            {/* La columna fija va en bg-[#0F141B], que la tabla del modo día
                traduce; el #0f1419 de antes no estaba y en modo día salía un
                bloque negro con el texto oscuro encima (19/10/2026). */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="align-bottom">
                    <th className="sticky left-0 z-10 min-w-[170px] bg-[#0F141B] py-2 pr-3 text-left font-normal text-white/40">Métrica</th>
                    {columnas.map((j, i) => {
                      const escudo = escudoDe(j.equipo);
                      return (
                        <th key={`${j.jugador}-${j.equipo}`} className="min-w-[92px] px-1.5 py-2 text-center font-normal">
                          <div className="flex flex-col items-center gap-1">
                            {i === 0 ? (
                              <Foto src={ficha?.foto} nombre={j.jugador} size={28} />
                            ) : escudo ? (
                              // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
                              <img src={escudo} alt="" className="h-6 w-6 object-contain" />
                            ) : (
                              <span className="h-6 w-6" />
                            )}
                            <span className={`leading-tight ${i === 0 ? "font-semibold text-[#C8A96B]" : "text-white/80"}`}>
                              {i === 0 ? ficha?.nombre ?? j.jugador : j.jugador}
                            </span>
                            <span className="text-[10px] text-white/35">
                              {j.edad} años · {j.minutos}′
                            </span>
                            {i > 0 && marcador[i - 1].de > 0 && (
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[10px]"
                                style={{
                                  background: `${marcador[i - 1].gana * 2 >= marcador[i - 1].de ? MEJOR : PEOR}22`,
                                  color: marcador[i - 1].gana * 2 >= marcador[i - 1].de ? MEJOR : PEOR,
                                }}
                                title={`El nuestro es mejor en ${marcador[i - 1].gana} de ${marcador[i - 1].de} métricas`}
                              >
                                le gana {marcador[i - 1].gana}/{marcador[i - 1].de}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-white/[0.08]">
                    <td className="sticky left-0 z-10 bg-[#0F141B] py-2 pr-3 font-medium text-white/80">Índice del puesto</td>
                    {indices.map((v, i) => (
                      <td key={i} className="px-1.5 text-center text-sm font-semibold tabular-nums" style={{ color: colorIndice(v) }}>
                        {v ?? "—"}
                      </td>
                    ))}
                  </tr>
                  {tabla.map(({ m, celdas }, k) => {
                    const mejor = Math.max(...celdas.map((c) => c?.percentil ?? -1));
                    const nuevoGrupo = k === 0 || tabla[k - 1].m.grupoRotulo !== m.grupoRotulo;
                    return (
                      <Fragment key={m.columna}>
                        {nuevoGrupo && (
                          <tr>
                            <td colSpan={columnas.length + 1} className="pb-1 pt-3 text-[10px] uppercase tracking-wider text-white/35">
                              {m.grupoRotulo}
                            </td>
                          </tr>
                        )}
                        <tr className="border-t border-white/[0.05]" title={m.comoLeer}>
                          <td className="sticky left-0 z-10 bg-[#0F141B] py-1.5 pr-3 text-white/70">{m.nombre}</td>
                          {celdas.map((c, i) => (
                            <td key={i} className={`px-1.5 py-1.5 text-center ${i === 0 ? "bg-[#C8A96B]/[0.06]" : ""}`}>
                              {c ? (
                                <div className="flex flex-col items-center leading-tight">
                                  <span
                                    className="tabular-nums"
                                    style={{
                                      color: c.percentil === null ? tinta(0.45) : c.percentil === mejor ? MEJOR : tinta(0.85),
                                      fontWeight: c.percentil !== null && c.percentil === mejor ? 700 : 400,
                                    }}
                                  >
                                    {formatea(c.valor)}
                                  </span>
                                  <span className="text-[10px] text-white/35">{c.percentil === null ? "poca muestra" : `P${c.percentil}`}</span>
                                </div>
                              ) : (
                                <span className="text-white/25">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-white/35">En verde, el mejor de cada fila. «Le gana» cuenta las métricas con percentil de los dos.</p>
          </>
        )}
      </div>
    </div>
  );
}
