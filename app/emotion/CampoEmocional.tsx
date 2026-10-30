"use client";

/*
|--------------------------------------------------------------------------
| EL ONCE, CON SU ESTADO EMOCIONAL, EN EL CAMPO (29/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: el once de la pizarra táctica, «visualmente muchísimo
| más top». Cada titular va con su foto donde juega; el aro dice la media de
| las cuatro dimensiones (se llena de 0 a 10 y toma el color de la escala), la
| flecha cómo ha cambiado y el punto rojo late si ha bajado. Al pulsar a uno,
| el panel de al lado enseña su perfil y su evolución; debajo, el banquillo.
|
| La hoja emocional no guarda historia (una fila por jugador, sobrescrita).
| Para poder dar tendencia, cada vez que la hoja cambia se guarda una foto en
| este aparato (localStorage): la flecha compara con la anterior. Sin foto
| anterior, no hay flecha y no se dice nada.
|
| Quien no tiene registro sale en gris, sin cifra y sin texto de hueco.
*/

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, X } from "lucide-react";

import { usePlayers } from "@/hooks/usePlayers";
import { coma } from "@/lib/formatoNumero";
import { getPlayerPhotoSrc } from "@/lib/playerImages";
import { posicionDe } from "@/lib/posiciones";
import { chipInk } from "@/lib/theme";
import { nombreVisible } from "@/lib/nombreJugador";
import type { Player as Ficha } from "@/types/player";

import { AXES, SCALE, SERIES_COLORS, average, bandFor, nombreLargo, type GroupKey, type MetricKey, type Player } from "./modelo";
import { mejorCasado, onceDeLaPizarra, type OnceDeLaPizarra } from "@/lib/tactics/onceDeLaPizarra";

/* ------------------------------------------------------------------ */
/*  HISTORIA EN EL APARATO                                             */
/* ------------------------------------------------------------------ */

type Foto = { dia: string; v: Record<string, number[]> };

const CLAVE_HISTORIA = "emotion:historial:v1";
const MAX_FOTOS = 16;

const notas = (p: Player) => AXES.map((a) => p[a.key]);

function actualizaHistoria(rows: Player[]): Foto[] {
  let historia: Foto[] = [];

  try {
    const crudo = JSON.parse(window.localStorage.getItem(CLAVE_HISTORIA) ?? "[]");

    if (Array.isArray(crudo)) historia = crudo.filter((f) => f && typeof f.dia === "string" && f.v && typeof f.v === "object");
  } catch {
    historia = [];
  }

  if (rows.length === 0) return historia;

  const v = Object.fromEntries(rows.map((r) => [r.jugador, notas(r)]));
  const ultima = historia[historia.length - 1];

  if (ultima && JSON.stringify(ultima.v) === JSON.stringify(v)) return historia;

  const hoy = new Date();
  const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  /* Dos cambios el mismo día cuentan como uno: la flecha compara con el día anterior. */
  historia = ultima?.dia === dia ? [...historia.slice(0, -1), { dia, v }] : [...historia, { dia, v }];
  historia = historia.slice(-MAX_FOTOS);

  try {
    window.localStorage.setItem(CLAVE_HISTORIA, JSON.stringify(historia));
  } catch {
    /* Sin almacenamiento no hay tendencia; la pantalla sigue igual. */
  }

  return historia;
}

const media4 = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

const diaCorto = (dia: string) => {
  const [, m, d] = dia.split("-");

  return `${Number(d)}/${Number(m)}`;
};

/* ------------------------------------------------------------------ */
/*  EL ONCE COLOCADO                                                   */
/* ------------------------------------------------------------------ */

type Colocado = {
  clave: string;
  nombre: string;
  dorsal: string;
  foto: string;
  largo: number;
  ancho: number;
  dato?: Player;
  /** Media de la foto anterior en la que estaba, para la flecha. */
  previo?: number[];
  serie: { dia: string; media: number }[];
};

/* Por si no hay tablero de onces: el 4-2-3-1 de la pizarra, por puesto de la hoja. */
const HUECOS_POR_PUESTO: { puestos: string[]; largo: number; ancho: number; dorsal: string }[] = [
  { puestos: ["LATERAL I."], largo: 26, ancho: 12, dorsal: "3" },
  { puestos: ["CENTRAL"], largo: 20, ancho: 36, dorsal: "5" },
  { puestos: ["CENTRAL"], largo: 20, ancho: 64, dorsal: "4" },
  { puestos: ["LATERAL D."], largo: 26, ancho: 88, dorsal: "2" },
  { puestos: ["6", "8"], largo: 44, ancho: 38, dorsal: "8" },
  { puestos: ["6", "8"], largo: 44, ancho: 62, dorsal: "6" },
  { puestos: ["11"], largo: 68, ancho: 14, dorsal: "11" },
  { puestos: ["10", "8"], largo: 66, ancho: 50, dorsal: "10" },
  { puestos: ["7"], largo: 68, ancho: 86, dorsal: "7" },
  { puestos: ["9"], largo: 89, ancho: 50, dorsal: "9" },
];

const UMBRAL_FLECHA = 0.25;
const UMBRAL_ALERTA = 0.5;

/*
| Las seis líneas de los radares (30/10/2026), tal y como las pidió el
| analista: portero y defensa (los 5), defensa (los 4), perfil izquierdo
| (lateral y extremo), perfil derecho, medios (6, 8 y 10) y puntas (9, 10 y
| extremos). Un jugador puede estar en varias. El puesto sale de dónde está en
| la pizarra, no de su demarcación en la hoja: si el analista pone a un
| lateral de extremo, su radar es el del extremo.
*/
type LineaCampo = GroupKey;

function lineasDelOnce(titulares: Colocado[]): Record<LineaCampo, Colocado[]> {
  const orden = [...titulares].sort((a, b) => a.largo - b.largo);
  const portero = orden[0] && orden[0].largo < 15 ? orden[0] : null;
  const resto = portero ? orden.slice(1) : orden;
  const atras = resto.slice(0, 4).sort((a, b) => a.ancho - b.ancho);
  const otros = resto.slice(4);

  const puntas = otros.filter((c) => c.largo >= 80);
  const extIzq = otros.filter((c) => !puntas.includes(c) && c.ancho <= 30);
  const extDer = otros.filter((c) => !puntas.includes(c) && c.ancho >= 70);
  const medios = otros.filter((c) => !puntas.includes(c) && !extIzq.includes(c) && !extDer.includes(c));
  const diez = [...medios].sort((a, b) => b.largo - a.largo).find((c) => c.largo >= 55);

  return {
    keeper: portero ? [portero, ...atras] : atras,
    defense: atras,
    leftSide: [...atras.slice(0, 1), ...extIzq],
    rightSide: [...(atras.length === 4 ? atras.slice(3) : []), ...extDer],
    midfield: medios,
    strikers: [...puntas, ...(diez ? [diez] : []), ...extIzq, ...extDer],
  };
}

function cambioDe(c: { dato?: Player; previo?: number[] }) {
  if (!c.dato || !c.previo) return null;

  const ahora = notas(c.dato);
  const delta = media4(ahora) - media4(c.previo);
  const ejeQueCae = AXES.find((_, i) => ahora[i] - (c.previo?.[i] ?? ahora[i]) <= -1);

  return { delta, baja: delta <= -UMBRAL_ALERTA || Boolean(ejeQueCae), ejeQueCae };
}

/* ------------------------------------------------------------------ */
/*  COMPONENTE                                                         */
/* ------------------------------------------------------------------ */

export function CampoEmocional({
  rows,
  loading,
  teamAverage,
  grupos,
  onGruposDelOnce,
}: {
  rows: Player[];
  loading: boolean;
  teamAverage: Record<MetricKey, number> | null;
  /** Lo que hay elegido en cada radar de línea (la página lo deja cambiar). */
  grupos: Record<GroupKey, string[]>;
  /** Avisa de las líneas del once de la pizarra para que los radares salgan con ellos elegidos. */
  onGruposDelOnce: (grupos: Record<GroupKey, string[]>, estimados: Player[]) => void;
}) {
  const { players: plantilla } = usePlayers();

  const [once, setOnce] = useState<OnceDeLaPizarra | null | undefined>(undefined);
  const [historia, setHistoria] = useState<Foto[]>([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const [vista, setVista] = useState<"radares" | "fichas">("radares");

  /* El once se lee cada vez que se abre la pantalla: lo cambiado en la pizarra sale al recargar. */
  useEffect(() => {
    let cancelado = false;

    onceDeLaPizarra()
      .then((o) => {
        if (!cancelado) setOnce(o);
      })
      .catch(() => {
        if (!cancelado) setOnce(null);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    let cancelado = false;

    void Promise.resolve().then(() => {
      if (!cancelado) setHistoria(actualizaHistoria(rows));
    });

    return () => {
      cancelado = true;
    };
  }, [rows, loading]);

  const deLaPlantilla = useMemo(
    () => (nombre: string) => mejorCasado<Ficha>([nombre], plantilla, (p) => [p.nombre, p.apodo]),
    [plantilla],
  );

  const conHistoria = useMemo(
    () => (nombre: string) => {
      const fotos = historia.filter((f) => Array.isArray(f.v[nombre]));
      const serie = fotos.map((f) => ({ dia: f.dia, media: media4(f.v[nombre]) }));

      return { serie, previo: fotos.length >= 2 ? fotos[fotos.length - 2].v[nombre] : undefined };
    },
    [historia],
  );

  const { titulares, banquillo } = useMemo(() => {
    const usados = new Set<Player>();
    let colocados: Colocado[] = [];

    if (once) {
      colocados = once.fichas.map((f) => {
        const p = f.nombre ? deLaPlantilla(f.nombre) : undefined;
        const evaluado = f.nombre ? mejorCasado<Player>([f.nombre, p?.nombre ?? "", p?.apodo ?? ""].filter(Boolean), rows, (r) => [r.jugador], usados) : undefined;

        if (evaluado) usados.add(evaluado);

        /* Sin valoración en la hoja: la media de la plantilla, hasta que se evalúe. */
        const dato: Player | undefined =
          evaluado ?? (f.nombre && teamAverage ? { posicion: "", jugador: f.nombre, ...teamAverage, estimado: true } : undefined);

        const h = evaluado ? conHistoria(evaluado.jugador) : { serie: [], previo: undefined };

        return {
          clave: f.id,
          /* El nombre de la plantilla, como en /individual (30/10/2026). */
          nombre: nombreVisible(p?.nombre || f.nombre || (dato?.jugador ?? "")),
          dorsal: f.dorsal,
          foto: getPlayerPhotoSrc(p?.nombre ?? f.nombre, { id: p?.id, fallbackUrl: f.foto || p?.foto }),
          largo: f.largo,
          ancho: f.ancho,
          dato,
          ...h,
        };
      });
    } else if (once === null) {
      /* Sin tablero de onces: los mejor evaluados de cada puesto, en el mismo dibujo. */
      const ordenados = [...rows].sort((a, b) => average(b) - average(a));

      colocados = HUECOS_POR_PUESTO.flatMap((hueco, i) => {
        const dato = ordenados.find((r) => !usados.has(r) && hueco.puestos.includes(posicionDe(r.jugador, r.posicion).trim().toUpperCase()));

        if (!dato) return [];

        usados.add(dato);

        const p = deLaPlantilla(dato.jugador);

        return [
          {
            clave: `puesto-${i}`,
            nombre: nombreVisible(p?.nombre || dato.jugador),
            dorsal: p?.dorsal ? String(p.dorsal) : hueco.dorsal,
            foto: getPlayerPhotoSrc(p?.nombre ?? dato.jugador, { id: p?.id, fallbackUrl: p?.foto }),
            largo: hueco.largo,
            ancho: hueco.ancho,
            dato,
            ...conHistoria(dato.jugador),
          },
        ];
      });
    }

    const suplentes: Colocado[] = rows
      .filter((r) => !usados.has(r))
      .sort((a, b) => average(b) - average(a))
      .map((r) => {
        const p = deLaPlantilla(r.jugador);

        return {
          clave: `banco-${r.jugador}`,
          nombre: nombreVisible(p?.nombre || r.jugador),
          dorsal: p?.dorsal ? String(p.dorsal) : "",
          foto: getPlayerPhotoSrc(p?.nombre ?? r.jugador, { id: p?.id, fallbackUrl: p?.foto }),
          largo: 0,
          ancho: 0,
          dato: r,
          ...conHistoria(r.jugador),
        };
      });

    return { titulares: colocados, banquillo: suplentes };
  }, [once, rows, deLaPlantilla, conHistoria, teamAverage]);

  const todos = useMemo(() => [...titulares, ...banquillo], [titulares, banquillo]);
  const seleccionado = todos.find((c) => c.clave === elegido && c.dato) ?? null;

  /* Las líneas del once de la pizarra, con el nombre de la hoja emocional. */
  const lineas = useMemo(() => lineasDelOnce(titulares), [titulares]);

  const gruposDelOnce = useMemo(() => {
    if (!once) return null;

    const nombres = (cs: Colocado[]) => cs.flatMap((c) => (c.dato ? [c.dato.jugador] : []));
    const g: Record<GroupKey, string[]> = {
      keeper: nombres(lineas.keeper),
      leftSide: nombres(lineas.leftSide),
      defense: nombres(lineas.defense),
      rightSide: nombres(lineas.rightSide),
      midfield: nombres(lineas.midfield),
      strikers: nombres(lineas.strikers),
    };

    if (!Object.values(g).some((v) => v.length > 0)) return null;

    const estimados = titulares.flatMap((c) => (c.dato?.estimado ? [c.dato] : []));

    return { g, estimados };
  }, [once, lineas, titulares]);

  /* Se avisa sólo cuando cambia de verdad: así no pisa lo que se elija a mano. */
  const firmaOnce = gruposDelOnce ? JSON.stringify(gruposDelOnce) : "";

  useEffect(() => {
    if (!firmaOnce) return;
    const { g, estimados } = JSON.parse(firmaOnce) as { g: Record<GroupKey, string[]>; estimados: Player[] };
    onGruposDelOnce(g, estimados);
  }, [firmaOnce, onGruposDelOnce]);

  const porNombre = useMemo(() => new Map(todos.flatMap((c) => (c.dato ? [[c.dato.jugador, c] as const] : []))), [todos]);

  const cargando = loading || once === undefined;

  return (
    <section className="mb-8" aria-label="El once con su estado emocional">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[.25em] text-white/40">
            {once ? "Once de la pizarra táctica" : "Once por puesto"}
          </p>

          <p className="mt-1 text-sm text-white/60">
            {once
              ? once.escena || "Tablero «Once 4-2-3-1»"
              : once === null
                ? "Los mejor evaluados de cada puesto, en 4-2-3-1"
                : "Leyendo la pizarra"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Qué se ve en el campo" className="inline-flex rounded-full border border-white/10 p-0.5">
          {(
            [
              ["radares", "Radares por línea"],
              ["fichas", "Fichas del once"],
            ] as const
          ).map(([clave, texto]) => (
            <button
              key={clave}
              role="tab"
              aria-selected={vista === clave}
              onClick={() => setVista(clave)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${vista === clave ? "bg-[#36DAFF] text-[#031018]" : "text-white/55 hover:text-white"}`}
            >
              {texto}
            </button>
          ))}
        </div>

        {vista === "radares" && (
          <a
            href="#perfiles-por-linea"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-medium text-white/65 transition hover:border-white/25 hover:text-white"
          >
            Cambiar jugadores
          </a>
        )}

        <Link
          href="/pizarra-tactica"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-medium text-white/65 transition hover:border-white/25 hover:text-white"
        >
          {once ? "Cambiar el once en la pizarra" : "Poner el once en la pizarra"}
          <ArrowUpRight size={13} />
        </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {vista === "radares" ? (
            <RadaresEnCampo
              grupos={grupos}
              lineas={lineas}
              titulares={titulares}
              porNombre={porNombre}
              teamAverage={teamAverage}
              cargando={cargando}
              elegido={elegido}
              onElegir={setElegido}
            />
          ) : (
            <Campo titulares={titulares} cargando={cargando} elegido={elegido} onElegir={setElegido} />
          )}

          <Leyenda radares={vista === "radares"} />

          {banquillo.length > 0 && (
            <Banquillo suplentes={banquillo} elegido={elegido} onElegir={setElegido} />
          )}
        </div>

        <PanelLateral
          seleccionado={seleccionado}
          titulares={titulares}
          teamAverage={teamAverage}
          onCerrar={() => setElegido(null)}
          onElegir={setElegido}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  EL CAMPO                                                           */
/* ------------------------------------------------------------------ */

/*
| Campo de aire tecnológico (30/10/2026): noche azul con rejilla, líneas de
| neón, barrido de escáner y esquinas de visor. Es el mismo de día y de noche
| (`siempre-oscuro`): es un lienzo, no un fondo de la app.
*/
const LINEA = { stroke: "rgba(98,232,255,.62)", fill: "none", strokeWidth: 0.3 } as const;
const BRILLO = { filter: "drop-shadow(0 0 2px rgba(54,218,255,.85)) drop-shadow(0 0 6px rgba(54,218,255,.35))" };

/** Las líneas de un campo de 105 × 68, tumbado (atacando a la derecha). */
function LineasTumbado({ desde = "sm:block" }: { desde?: string }) {
  return (
    <svg viewBox="0 0 105 68" preserveAspectRatio="none" className={`absolute inset-0 hidden h-full w-full ${desde}`} style={BRILLO} aria-hidden>
      <rect x="1.5" y="1.5" width="102" height="65" style={LINEA} />
      <line x1="52.5" y1="1.5" x2="52.5" y2="66.5" style={LINEA} />
      <circle cx="52.5" cy="34" r="9.15" style={LINEA} />
      <circle cx="52.5" cy="34" r="0.6" style={{ ...LINEA, fill: "rgba(98,232,255,.9)" }} />
      <rect x="1.5" y="13.85" width="16.5" height="40.3" style={LINEA} />
      <rect x="1.5" y="24.85" width="5.5" height="18.3" style={LINEA} />
      <rect x="87" y="13.85" width="16.5" height="40.3" style={LINEA} />
      <rect x="98" y="24.85" width="5.5" height="18.3" style={LINEA} />
      <path d="M18 26.7 A9.15 9.15 0 0 1 18 41.3" style={LINEA} />
      <path d="M87 26.7 A9.15 9.15 0 0 0 87 41.3" style={LINEA} />
    </svg>
  );
}

/** El mismo campo de pie (atacando hacia arriba), para el móvil. */
function LineasDePie({ hasta = "sm:hidden" }: { hasta?: string }) {
  return (
    <svg viewBox="0 0 68 105" preserveAspectRatio="none" className={`absolute inset-0 h-full w-full ${hasta}`} style={BRILLO} aria-hidden>
      <rect x="1.5" y="1.5" width="65" height="102" style={LINEA} />
      <line x1="1.5" y1="52.5" x2="66.5" y2="52.5" style={LINEA} />
      <circle cx="34" cy="52.5" r="9.15" style={LINEA} />
      <rect x="13.85" y="1.5" width="40.3" height="16.5" style={LINEA} />
      <rect x="24.85" y="1.5" width="18.3" height="5.5" style={LINEA} />
      <rect x="13.85" y="87" width="40.3" height="16.5" style={LINEA} />
      <rect x="24.85" y="98" width="18.3" height="5.5" style={LINEA} />
      <path d="M26.7 18 A9.15 9.15 0 0 0 41.3 18" style={LINEA} />
      <path d="M26.7 87 A9.15 9.15 0 0 1 41.3 87" style={LINEA} />
    </svg>
  );
}

const ESQUINA = "pointer-events-none absolute h-5 w-5 border-[#E4C977]/80";

/** El lienzo: con `libre` el alto lo da el contenido (los radares), sin proporción fija. */
function CampoTecnologico({ children, libre = false }: { children: React.ReactNode; libre?: boolean }) {
  return (
    <div
      className={`siempre-oscuro relative w-full overflow-hidden rounded-[28px] ${libre ? "" : "aspect-[68/100] sm:aspect-[105/66]"}`}
      style={{
        background: [
          "radial-gradient(70% 55% at 50% 50%, rgba(54,218,255,.13), transparent 70%)",
          "radial-gradient(40% 40% at 100% 0%, rgba(182,107,255,.14), transparent 70%)",
          "linear-gradient(rgba(98,232,255,.055) 1px, transparent 1px) 0 0 / 100% 22px",
          "linear-gradient(90deg, rgba(98,232,255,.055) 1px, transparent 1px) 0 0 / 22px 100%",
          "linear-gradient(160deg, #020B15 0%, #05182A 50%, #030E1A 100%)",
        ].join(", "),
        boxShadow: "inset 0 0 0 1px rgba(98,232,255,.18), inset 0 0 90px rgba(0,0,0,.6), 0 24px 60px rgba(0,0,0,.35)",
      }}
    >
      <LineasTumbado desde={libre ? "xl:block" : "sm:block"} />
      <LineasDePie hasta={libre ? "xl:hidden" : "sm:hidden"} />

      {/* Barrido de escáner */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-28 motion-reduce:hidden"
        style={{ background: "linear-gradient(180deg, transparent, rgba(54,218,255,.08) 70%, rgba(98,232,255,.2) 98%, transparent)", animation: "scan 7s linear infinite" }}
      />

      <span aria-hidden className={`${ESQUINA} left-3 top-3 border-l-2 border-t-2`} />
      <span aria-hidden className={`${ESQUINA} right-3 top-3 border-r-2 border-t-2`} />
      <span aria-hidden className={`${ESQUINA} bottom-3 left-3 border-b-2 border-l-2`} />
      <span aria-hidden className={`${ESQUINA} bottom-3 right-3 border-b-2 border-r-2`} />

      {children}
    </div>
  );
}

function Girando() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: "rgba(98,232,255,.9)" }} />
    </div>
  );
}

/** Dónde va cada ficha: tumbado en el portátil, de pie en el móvil. */
const sitioDe = (c: Colocado) =>
  ({
    "--hx": `${c.largo}%`,
    "--hy": `${c.ancho}%`,
    "--vx": `${c.ancho}%`,
    "--vy": `${100 - c.largo}%`,
  }) as React.CSSProperties;

const COLOCA = "absolute left-[var(--vx)] top-[var(--vy)] -translate-x-1/2 -translate-y-1/2 sm:left-[var(--hx)] sm:top-[var(--hy)]";

function Campo({
  titulares,
  cargando,
  elegido,
  onElegir,
}: {
  titulares: Colocado[];
  cargando: boolean;
  elegido: string | null;
  onElegir: (clave: string | null) => void;
}) {
  return (
    <CampoTecnologico>
      {cargando && titulares.length === 0 && <Girando />}

      {titulares.map((c) => (
        <div key={c.clave} className={`${COLOCA} transition-all duration-500`} style={sitioDe(c)}>
          <FichaJugador c={c} elegido={elegido === c.clave} onElegir={onElegir} />
        </div>
      ))}
    </CampoTecnologico>
  );
}

/* ------------------------------------------------------------------ */
/*  LOS RADARES, CADA UNO EN SU ZONA DEL CAMPO (30/10/2026)            */
/* ------------------------------------------------------------------ */

/*
| Cada línea en su sitio. En pantalla ancha, tumbado: portero y defensa,
| defensa, medios y puntas de atrás adelante, con el perfil izquierdo arriba y
| el derecho abajo. En pantallas estrechas, de pie (puntas arriba). Los
| jugadores son los del once de la pizarra; se cambian más abajo,
| en «Perfiles por línea». Quien aún no tiene valoración entra con la
| media de la plantilla, en trazo discontinuo, hasta que se valore.
*/
const ZONAS: { clave: LineaCampo; titulo: string; sitio: string; tumbada?: boolean }[] = [
  { clave: "strikers", titulo: "Puntas", sitio: "col-span-2 row-start-1 xl:col-span-1 xl:col-start-4 xl:row-start-2" },
  { clave: "leftSide", titulo: "Perfil izquierdo", sitio: "col-start-1 row-start-2 xl:col-span-2 xl:col-start-2 xl:row-start-1", tumbada: true },
  { clave: "rightSide", titulo: "Perfil derecho", sitio: "col-start-2 row-start-2 xl:col-span-2 xl:col-start-2 xl:row-start-3", tumbada: true },
  { clave: "midfield", titulo: "Medios", sitio: "col-span-2 row-start-3 xl:col-span-1 xl:col-start-3 xl:row-start-2" },
  { clave: "defense", titulo: "Defensa", sitio: "col-start-1 row-start-4 xl:col-start-2 xl:row-start-2" },
  { clave: "keeper", titulo: "Portero y defensa", sitio: "col-start-2 row-start-4 xl:col-start-1 xl:row-start-2" },
];

const COLOCA_XL = "absolute left-[var(--vx)] top-[var(--vy)] -translate-x-1/2 -translate-y-1/2 xl:left-[var(--hx)] xl:top-[var(--hy)]";

type Evaluado = Colocado & { dato: Player };
const evaluado = (c: Colocado): c is Evaluado => Boolean(c.dato);

function RadaresEnCampo({
  grupos,
  lineas,
  titulares,
  porNombre,
  teamAverage,
  cargando,
  elegido,
  onElegir,
}: {
  grupos: Record<GroupKey, string[]>;
  lineas: Record<LineaCampo, Colocado[]>;
  titulares: Colocado[];
  porNombre: Map<string, Colocado>;
  teamAverage: Record<MetricKey, number> | null;
  cargando: boolean;
  elegido: string | null;
  onElegir: (clave: string | null) => void;
}) {
  const zonas = ZONAS.map((z) => {
    const elegidos = grupos[z.clave];
    const delOnce = lineas[z.clave].filter((c) => !c.dato || elegidos.includes(c.dato.jugador));
    const anadidos = elegidos.flatMap((n) => {
      const c = porNombre.get(n);
      return c && !delOnce.includes(c) ? [c] : [];
    });

    return { ...z, jugadores: [...delOnce, ...anadidos] };
  }).filter((z) => z.jugadores.length > 0);

  return (
    <CampoTecnologico libre>
      {/* Dónde está cada titular: un punto de luz bajo los radares. */}
      {titulares.map((c) => {
        const tono = c.dato ? bandFor(average(c.dato)).tone : "rgba(255,255,255,.35)";
        return (
          <span
            key={c.clave}
            aria-hidden
            className={`${COLOCA_XL} h-2 w-2 rounded-full`}
            style={{ ...sitioDe(c), background: tono, boxShadow: `0 0 12px ${tono}` }}
          />
        );
      })}

      {cargando && zonas.length === 0 ? (
        <div className="relative h-[420px]">
          <Girando />
        </div>
      ) : (
        <div className="relative grid grid-cols-2 gap-2.5 p-3 sm:gap-4 sm:p-5 xl:grid-cols-4">
          {zonas.map((z) => (
            <div key={z.clave} className={z.sitio}>
              <RadarLinea titulo={z.titulo} jugadores={z.jugadores} teamAverage={teamAverage} tumbada={z.tumbada} elegido={elegido} onElegir={onElegir} />
            </div>
          ))}
        </div>
      )}
    </CampoTecnologico>
  );
}

/* Cuatro ejes en rombo: arriba, derecha, abajo, izquierda. */
const R = 40;
const punto = (i: number, v: number) => {
  const ang = (-90 + i * 90) * (Math.PI / 180);
  const r = (Math.max(0, Math.min(10, v)) / 10) * R;
  return [Math.cos(ang) * r, Math.sin(ang) * r] as const;
};
const poligono = (valores: number[]) => valores.map((v, i) => punto(i, v).join(",")).join(" ");

const NEUTRO = "#62E8FF";

function RadarLinea({
  titulo,
  jugadores,
  teamAverage,
  tumbada = false,
  elegido,
  onElegir,
}: {
  titulo: string;
  jugadores: Colocado[];
  teamAverage: Record<MetricKey, number> | null;
  tumbada?: boolean;
  elegido: string | null;
  onElegir: (clave: string | null) => void;
}) {
  const evaluados = jugadores.filter(evaluado);
  const mediaEje = evaluados.length > 0 ? AXES.map((a) => evaluados.reduce((s, c) => s + c.dato[a.key], 0) / evaluados.length) : null;
  const media = mediaEje ? media4(mediaEje) : null;
  const banda = media !== null ? bandFor(media) : null;
  const tono = banda?.tone ?? NEUTRO;
  const resaltado = evaluados.find((c) => c.clave === elegido);

  return (
    <div
      className={`flex h-full flex-col gap-2 rounded-2xl p-3 backdrop-blur-md ${tumbada ? "xl:flex-row xl:items-center xl:gap-4" : ""}`}
      style={{
        background: "linear-gradient(160deg, rgba(4,18,32,.86), rgba(3,10,20,.78))",
        border: `1px solid ${tono}${banda ? "55" : "33"}`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 0 28px ${tono}22`,
      }}
    >
      <div className={`min-w-0 ${tumbada ? "xl:w-[200px] xl:shrink-0" : ""}`}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[.22em]" style={{ color: "#9FE9FF" }}>
            {titulo}
          </p>
          {media !== null && (
            <p className="shrink-0 text-lg font-bold tabular-nums leading-none" style={{ color: tono, textShadow: `0 0 12px ${tono}99` }}>
              {coma(media)}
            </p>
          )}
        </div>

        {banda && (
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.18em]" style={{ color: `${tono}CC` }}>
            {banda.label}
          </p>
        )}

        {tumbada && (
          <div className="mt-2 hidden xl:block">
            <Nombres jugadores={jugadores} evaluados={evaluados} elegido={elegido} onElegir={onElegir} />
          </div>
        )}
      </div>

      <svg viewBox="-64 -54 128 108" className={`mx-auto w-full ${tumbada ? "max-w-[210px] xl:max-w-[190px]" : "max-w-[230px]"}`} role="img" aria-label={`Radar de ${titulo}`}>
        {[2.5, 5, 7.5, 10].map((v) => (
          <polygon
            key={v}
            points={poligono([v, v, v, v])}
            fill={v === 10 ? "rgba(54,218,255,.04)" : "none"}
            stroke="rgba(98,232,255,.22)"
            strokeWidth={v === 10 ? 0.6 : 0.4}
            strokeDasharray={v === 10 ? undefined : "1.5 1.5"}
          />
        ))}
        {AXES.map((a, i) => {
          const [x, y] = punto(i, 10);
          return <line key={a.key} x1={0} y1={0} x2={x} y2={y} stroke="rgba(98,232,255,.2)" strokeWidth={0.4} />;
        })}

        {teamAverage && (
          <polygon points={poligono(AXES.map((a) => teamAverage[a.key]))} fill="none" stroke="rgba(228,201,119,.85)" strokeWidth={0.7} strokeDasharray="2 1.6" />
        )}

        {mediaEje && evaluados.length > 1 && <polygon points={poligono(mediaEje)} fill={`${tono}26`} stroke="none" />}

        {evaluados.map((c, i) => {
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          return (
            <polygon
              key={c.clave}
              points={poligono(AXES.map((a) => c.dato[a.key]))}
              fill={evaluados.length === 1 ? `${color}33` : "none"}
              stroke={color}
              strokeWidth={resaltado === c ? 1.6 : 0.9}
              strokeDasharray={c.dato.estimado ? "2.5 1.8" : undefined}
              strokeLinejoin="round"
              opacity={resaltado && resaltado !== c ? 0.25 : 1}
              style={{ filter: `drop-shadow(0 0 2.5px ${color})`, transition: "opacity .3s" }}
            />
          );
        })}

        {mediaEje?.map((v, i) => {
          const [x, y] = punto(i, v);
          return <circle key={AXES[i].key} cx={x} cy={y} r={1.5} fill={tono} style={{ filter: `drop-shadow(0 0 2px ${tono})` }} />;
        })}

        {AXES.map((a, i) => {
          const [x, y] = punto(i, 10);
          const dx = i === 1 ? 3 : i === 3 ? -3 : 0;
          const dy = i === 0 ? -3.5 : i === 2 ? 7.5 : 2;
          return (
            <text
              key={a.key}
              x={x + dx}
              y={y + dy}
              textAnchor={i === 1 ? "start" : i === 3 ? "end" : "middle"}
              fontSize={6.4}
              fontWeight={600}
              fill="rgba(226,246,255,.78)"
            >
              {a.corto}
              {mediaEje && (
                <tspan fill={tono} dx={2}>
                  {coma(mediaEje[i])}
                </tspan>
              )}
            </text>
          );
        })}
      </svg>

      <div className={tumbada ? "xl:hidden" : ""}>
        <Nombres jugadores={jugadores} evaluados={evaluados} elegido={elegido} onElegir={onElegir} />
      </div>
    </div>
  );
}

function Nombres({
  jugadores,
  evaluados,
  elegido,
  onElegir,
}: {
  jugadores: Colocado[];
  evaluados: Evaluado[];
  elegido: string | null;
  onElegir: (clave: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {jugadores.map((c) => {
        const i = evaluados.indexOf(c as Evaluado);

        if (!c.dato || i < 0) {
          return (
            <span
              key={c.clave}
              className="inline-flex max-w-full items-center rounded-full px-2 py-[3px] text-[10px] font-semibold"
              style={{ border: "1px dashed rgba(255,255,255,.22)", color: "rgba(234,248,255,.45)" }}
            >
              <span className="truncate">{c.nombre}</span>
            </span>
          );
        }

        const color = SERIES_COLORS[i % SERIES_COLORS.length];
        const activo = elegido === c.clave;
        const media = average(c.dato);
        return (
          <button
            key={c.clave}
            type="button"
            onClick={() => onElegir(activo ? null : c.clave)}
            aria-pressed={activo}
            title={c.dato.estimado ? "Sin valoración todavía: lleva la media de la plantilla" : undefined}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-semibold transition hover:brightness-125"
            style={{
              background: activo ? `${color}33` : "rgba(255,255,255,.05)",
              border: `1px ${c.dato.estimado ? "dashed" : "solid"} ${activo ? color : `${color}55`}`,
              color: "#EAF8FF",
            }}
          >
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            <span className="truncate">{c.nombre}</span>
            <span className="tabular-nums" style={{ color: c.dato.estimado ? "rgba(234,248,255,.5)" : bandFor(media).tone }}>
              {c.dato.estimado ? "media" : coma(media)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FichaJugador({
  c,
  elegido,
  onElegir,
  pequena = false,
}: {
  c: Colocado;
  elegido: boolean;
  onElegir: (clave: string | null) => void;
  pequena?: boolean;
}) {
  const media = c.dato ? average(c.dato) : null;
  const tono = media !== null ? bandFor(media).tone : null;
  const cambio = cambioDe(c);
  const lleno = media !== null ? Math.max(0, Math.min(100, media * 10)) : 0;

  const tam = pequena ? "h-11 w-11 sm:h-12 sm:w-12" : "h-11 w-11 sm:h-14 sm:w-14 xl:h-[68px] xl:w-[68px]";

  return (
    <button
      type="button"
      disabled={!c.dato}
      onClick={() => onElegir(elegido ? null : c.clave)}
      aria-pressed={elegido}
      aria-label={media !== null ? `${c.nombre}: ${coma(media)} de media` : c.nombre}
      className={`group flex flex-col items-center gap-1 outline-none transition ${c.dato ? "cursor-pointer" : "cursor-default"} ${elegido ? "scale-110" : c.dato ? "hover:scale-105" : ""}`}
    >
      <span className="relative block">
        {cambio?.baja && (
          <span className="absolute -inset-1.5 animate-ping rounded-full" style={{ background: "rgba(255,77,94,.35)" }} aria-hidden />
        )}

        {/* El aro: se llena con la media (0-10) y toma el color de la escala. */}
        <span
          className={`relative block rounded-full p-[3px] ${tam}`}
          style={{
            background: tono ? `conic-gradient(${tono} ${lleno}%, rgba(255,255,255,.16) 0)` : "rgba(255,255,255,.22)",
            boxShadow: elegido
              ? `0 0 0 2px #E4C977, 0 0 26px ${tono ?? "#E4C977"}`
              : tono
                ? `0 0 18px ${tono}80, 0 6px 16px rgba(0,0,0,.45)`
                : "0 6px 16px rgba(0,0,0,.35)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.foto}
            alt=""
            loading="lazy"
            className="h-full w-full rounded-full object-cover object-top"
            style={{ background: "#0B1622", filter: c.dato ? undefined : "grayscale(1) opacity(.7)" }}
          />
        </span>

        {media !== null && tono && (
          <span
            className="absolute -bottom-1 -right-2 min-w-[26px] rounded-full px-1.5 py-[1px] text-center text-[11px] font-bold tabular-nums leading-[17px] sm:text-xs"
            style={{ background: tono, color: "#04101C", boxShadow: "0 2px 8px rgba(0,0,0,.45)" }}
          >
            {coma(media)}
          </span>
        )}

        {cambio && Math.abs(cambio.delta) >= UMBRAL_FLECHA && (
          <span
            className="absolute -right-2 -top-1 grid h-5 w-5 place-items-center rounded-full"
            style={{ background: cambio.delta > 0 ? "#3BEA9A" : "#FF4D5E", color: "#04101C", boxShadow: "0 2px 6px rgba(0,0,0,.4)" }}
            title={`${cambio.delta > 0 ? "+" : ""}${coma(cambio.delta)} desde la última vez`}
          >
            {cambio.delta > 0 ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}
          </span>
        )}

        {c.dorsal && (
          <span
            className="absolute -left-2 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold"
            style={{ background: "#F5F7FA", color: "#04101C", boxShadow: "0 2px 6px rgba(0,0,0,.35)" }}
          >
            {c.dorsal}
          </span>
        )}
      </span>

      <span
        className="max-w-[76px] truncate rounded-full px-2 py-[2px] text-[10px] font-semibold sm:max-w-[96px] sm:text-[11px]"
        style={{ background: "rgba(3,8,17,.72)", color: "#F5F7FA" }}
      >
        {c.nombre}
      </span>
    </button>
  );
}

function Leyenda({ radares = false }: { radares?: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-white/55">
      {radares && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: "#E4C977" }} />
          media de la plantilla
        </span>
      )}

      {radares && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-6 rounded-full border border-dashed border-white/40" />
          trazo discontinuo: aún sin valorar, lleva la media de la plantilla
        </span>
      )}

      {SCALE.map((band) => (
        <span key={band.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: band.tone }} />
          <span className="font-medium uppercase tracking-[.1em]">{band.label}</span>
          <span className="text-white/35">{band.min > 0 ? `≥ ${coma(band.min)}` : `< ${coma(SCALE[SCALE.length - 2].min)}`}</span>
        </span>
      ))}

      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full" style={{ background: "#3BEA9A", color: "#04101C" }}>
          <ArrowUp size={10} strokeWidth={3} />
        </span>
        <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full" style={{ background: "#FF4D5E", color: "#04101C" }}>
          <ArrowDown size={10} strokeWidth={3} />
        </span>
        cambio desde la evaluación anterior
      </span>

      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: "#FF4D5E" }} />
        alerta: baja medio punto o un eje cae un punto
      </span>
    </div>
  );
}

function Banquillo({
  suplentes,
  elegido,
  onElegir,
}: {
  suplentes: Colocado[];
  elegido: string | null;
  onElegir: (clave: string | null) => void;
}) {
  return (
    <div className="mt-4 rounded-[22px] border border-white/10 bg-[#08131F]/70 px-3 pb-3 pt-2.5 [:root[data-theme=light]_&]:border-slate-300 [:root[data-theme=light]_&]:bg-white/80">
      <p className="mb-2 text-[10px] uppercase tracking-[.25em] text-white/40">Banquillo · evaluados fuera del once</p>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-3 sm:justify-start">
        {suplentes.map((c) => (
          <FichaJugador key={c.clave} c={c} pequena elegido={elegido === c.clave} onElegir={onElegir} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PANEL LATERAL                                                      */
/* ------------------------------------------------------------------ */

const TARJETA =
  "rounded-[28px] border border-white/10 bg-[#08131F]/85 p-5 [:root[data-theme=light]_&]:border-slate-300 [:root[data-theme=light]_&]:bg-white";

function PanelLateral({
  seleccionado,
  titulares,
  teamAverage,
  onCerrar,
  onElegir,
}: {
  seleccionado: Colocado | null;
  titulares: Colocado[];
  teamAverage: Record<MetricKey, number> | null;
  onCerrar: () => void;
  onElegir: (clave: string | null) => void;
}) {
  if (seleccionado?.dato) return <PerfilJugador c={seleccionado} dato={seleccionado.dato} teamAverage={teamAverage} onCerrar={onCerrar} />;

  return <LecturaDelOnce titulares={titulares} onElegir={onElegir} />;
}

function LecturaDelOnce({ titulares, onElegir }: { titulares: Colocado[]; onElegir: (clave: string | null) => void }) {
  const evaluados = titulares.filter((c): c is Colocado & { dato: Player } => Boolean(c.dato));

  if (evaluados.length === 0) {
    return (
      <aside className={TARJETA}>
        <p className="text-[10px] uppercase tracking-[.25em] text-white/40">Lectura del once</p>
        <p className="mt-3 text-sm leading-relaxed text-white/60">Pulsa un jugador del campo o del banquillo para ver su perfil emocional.</p>
      </aside>
    );
  }

  const media = evaluados.reduce((a, c) => a + average(c.dato), 0) / evaluados.length;
  const porEje = AXES.map((axis) => ({ axis, valor: evaluados.reduce((a, c) => a + c.dato[axis.key], 0) / evaluados.length })).sort((a, b) => a.valor - b.valor);
  const flojo = porEje[0];
  const alertas = evaluados.filter((c) => cambioDe(c)?.baja);
  const bajos = [...evaluados].sort((a, b) => Math.min(...notas(a.dato)) - Math.min(...notas(b.dato))).filter((c) => Math.min(...notas(c.dato)) < 6.5).slice(0, 3);
  const tono = bandFor(media).tone;

  return (
    <aside className={TARJETA}>
      <p className="text-[10px] uppercase tracking-[.25em] text-white/40">Lectura del once</p>

      <div className="mt-3 flex items-end gap-3">
        <span className="text-5xl font-semibold tabular-nums leading-none" style={{ color: chipInk(tono) }}>
          {coma(media)}
        </span>
        <span className="pb-1 text-xs text-white/55">
          media de {evaluados.length} {evaluados.length === 1 ? "titular evaluado" : "titulares evaluados"} · {bandFor(media).label}
        </span>
      </div>

      <div className="mt-5 space-y-2.5">
        {AXES.map((axis) => {
          const valor = porEje.find((e) => e.axis.key === axis.key)?.valor ?? 0;

          return <BarraEje key={axis.key} titulo={axis.corto} valor={valor} />;
        })}
      </div>

      <p className="mt-5 text-sm leading-relaxed text-white/70">
        <span className="font-semibold text-white">A trabajar: {nombreLargo(flojo.axis).toLowerCase()}</span> ({coma(flojo.valor)}), que se entrena en{" "}
        {flojo.axis.moment.toLowerCase()}.
      </p>

      {alertas.length > 0 && (
        <div className="mt-4 rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,77,94,.1)", boxShadow: "inset 0 0 0 1px rgba(255,77,94,.35)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em]" style={{ color: chipInk("#FF4D5E") }}>
            Han bajado
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {alertas.map((c) => (
              <button key={c.clave} type="button" onClick={() => onElegir(c.clave)} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/80 hover:text-white">
                {c.nombre} {coma(cambioDe(c)?.delta ?? 0)}
              </button>
            ))}
          </div>
        </div>
      )}

      {bajos.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[.2em] text-white/40">Ejes más bajos del once</p>
          <div className="mt-2 space-y-1.5">
            {bajos.map((c) => {
              const v = notas(c.dato);
              const i = v.indexOf(Math.min(...v));

              return (
                <button
                  key={c.clave}
                  type="button"
                  onClick={() => onElegir(c.clave)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-left text-xs text-white/75 transition hover:border-white/25 hover:text-white"
                >
                  <span className="truncate">{c.nombre}</span>
                  <span className="shrink-0 tabular-nums" style={{ color: chipInk(bandFor(v[i]).tone) }}>
                    {AXES[i].corto} {coma(v[i])}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

function BarraEje({ titulo, valor, referencia, anterior }: { titulo: string; valor: number; referencia?: number; anterior?: number }) {
  const tono = bandFor(valor).tone;
  const delta = anterior !== undefined ? valor - anterior : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-white/65">{titulo}</span>
        <span className="tabular-nums">
          {Math.abs(delta) >= 0.5 && (
            <span className="mr-1.5 text-[11px]" style={{ color: chipInk(delta > 0 ? "#3BEA9A" : "#FF4D5E") }}>
              {delta > 0 ? "+" : ""}
              {coma(delta)}
            </span>
          )}
          <span className="font-semibold" style={{ color: chipInk(tono) }}>
            {coma(valor)}
          </span>
        </span>
      </div>

      <div className="relative mt-1 h-2 w-full rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, valor * 10)}%`, background: tono }} />

        {referencia !== undefined && (
          <span
            className="absolute -top-1 h-4 w-[2px] rounded-full"
            style={{ left: `calc(${Math.min(100, referencia * 10)}% - 1px)`, background: "rgb(var(--rmcf-ink-rgb) / .75)" }}
            title={`Media de la plantilla: ${coma(referencia)}`}
          />
        )}
      </div>
    </div>
  );
}

function PerfilJugador({
  c,
  dato,
  teamAverage,
  onCerrar,
}: {
  c: Colocado;
  dato: Player;
  teamAverage: Record<MetricKey, number> | null;
  onCerrar: () => void;
}) {
  const media = average(dato);
  const tono = bandFor(media).tone;
  const cambio = cambioDe(c);
  const v = notas(dato);
  const flojo = AXES[v.indexOf(Math.min(...v))];
  const fuerte = AXES[v.indexOf(Math.max(...v))];

  return (
    <aside className={TARJETA}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="block h-16 w-16 shrink-0 rounded-full p-[3px]" style={{ background: `conic-gradient(${tono} ${media * 10}%, rgba(127,127,127,.25) 0)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.foto} alt="" className="h-full w-full rounded-full object-cover object-top" style={{ background: "#0B1622" }} />
          </span>

          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-white">{c.nombre}</p>
            <p className="truncate text-xs text-white/50">
              {c.dorsal ? `${c.dorsal} · ` : ""}
              {dato.jugador !== c.nombre ? `${dato.jugador} · ` : ""}
              {dato.estimado ? "Media de la plantilla hasta que se valore" : bandFor(media).label}
            </p>
          </div>
        </div>

        <button type="button" onClick={onCerrar} aria-label="Cerrar el perfil" className="rounded-full border border-white/10 p-1.5 text-white/55 transition hover:text-white">
          <X size={14} />
        </button>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <span className="text-5xl font-semibold tabular-nums leading-none" style={{ color: chipInk(tono) }}>
          {coma(media)}
        </span>

        {cambio && Math.abs(cambio.delta) >= 0.05 && (
          <span className="inline-flex items-center gap-1 pb-1 text-sm font-semibold" style={{ color: chipInk(cambio.delta > 0 ? "#3BEA9A" : "#FF4D5E") }}>
            {cambio.delta > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {cambio.delta > 0 ? "+" : ""}
            {coma(cambio.delta)}
          </span>
        )}
      </div>

      <div className="mt-5 space-y-2.5">
        {AXES.map((axis, i) => (
          <BarraEje key={axis.key} titulo={nombreLargo(axis)} valor={v[i]} referencia={teamAverage?.[axis.key]} anterior={c.previo?.[i]} />
        ))}
      </div>

      {teamAverage && <p className="mt-2 text-[10px] text-white/40">La raya es la media de la plantilla.</p>}

      {c.serie.length >= 2 && <Evolucion serie={c.serie} />}

      <p className="mt-5 text-sm leading-relaxed text-white/70">
        {fuerte.key !== flojo.key ? (
          <>
            Su fuerte es <span className="font-semibold text-white">{nombreLargo(fuerte).toLowerCase()}</span> ({coma(dato[fuerte.key])}); a trabajar,{" "}
            <span className="font-semibold text-white">{nombreLargo(flojo).toLowerCase()}</span> ({coma(dato[flojo.key])}), que se entrena en {flojo.moment.toLowerCase()}.
          </>
        ) : (
          <>Perfil parejo: {coma(media)} en las cuatro dimensiones.</>
        )}
        {cambio?.ejeQueCae ? ` Ojo: ${nombreLargo(cambio.ejeQueCae).toLowerCase()} ha caído un punto o más.` : ""}
      </p>
    </aside>
  );
}

function Evolucion({ serie }: { serie: { dia: string; media: number }[] }) {
  const W = 300;
  const H = 70;
  const P = 8;
  const x = (i: number) => P + (i / Math.max(1, serie.length - 1)) * (W - P * 2);
  const y = (m: number) => P + (1 - Math.max(0, Math.min(10, m)) / 10) * (H - P * 2);
  const ultimo = serie[serie.length - 1];

  return (
    <div className="mt-5">
      <p className="text-[10px] uppercase tracking-[.2em] text-white/40">Evolución de la media</p>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-[70px] w-full" role="img" aria-label={serie.map((s) => `${diaCorto(s.dia)}: ${coma(s.media)}`).join(", ")}>
        <polyline
          points={serie.map((s, i) => `${x(i)},${y(s.media)}`).join(" ")}
          style={{ fill: "none", stroke: chipInk(bandFor(ultimo.media).tone), strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }}
        />
        {serie.map((s, i) => (
          <circle key={`${s.dia}-${i}`} cx={x(i)} cy={y(s.media)} r={3.5} style={{ fill: bandFor(s.media).tone }} />
        ))}
      </svg>

      <div className="flex justify-between text-[10px] tabular-nums text-white/40">
        <span>{diaCorto(serie[0].dia)}</span>
        <span>{diaCorto(ultimo.dia)}</span>
      </div>
    </div>
  );
}
