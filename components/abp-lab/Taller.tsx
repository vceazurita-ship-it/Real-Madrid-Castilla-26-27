"use client";

/**
 * Pestaña «Taller»: las rutinas propias, de la idea al partido.
 *
 * Cada rutina se abre en un estudio a pantalla completa con la pizarra viva
 * (`PizarraRutina`: se coloca, se dibujan carreras y balón, se reproduce y se
 * saca en PNG) y cinco pestañas:
 * - **Ficha**: tipo, lado, contra qué defensa, señal, inspiración y la idea.
 * - **Papeles**: quién hace qué, sincronizado con la pizarra.
 * - **Variantes**: las nuestras y las que proponen los referentes para esa
 *   defensa (`lib/abp-lab/variantes.ts`), cada una con su fuente.
 * - **Rival**: el encaje con el rival en Wyscout (`EncajeRival`).
 * - **Progreso**: de la charla al partido oficial, y qué dio cada vez que se
 *   usó compitiendo.
 *
 * Se guarda con «Guardar», por la API del laboratorio; salir con cambios
 * pregunta. Nace también de una rutina de un referente («Al taller»), que
 * llega ya dibujada si está en `lib/abp-lab/esquemas.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FlaskConical,
  GitBranch,
  Goal,
  Redo2,
  Undo2,
  Lightbulb,
  ListChecks,
  Plus,
  Save,
  Search,
  Shield,
  Swords,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button, EmptyState, Field, Segmented, Select, TextArea, sePuedeDescartar } from "@/components/abp/ui";
import type { JugadorLab } from "@/components/abp-lab/comun";
import { EncajeRival } from "@/components/abp-lab/EncajeRival";
import { CODIGO_PAPEL, MiniPizarra, PizarraRutina } from "@/components/abp-lab/PizarraRutina";
import { SelectorJugador, repartoPorAltura } from "@/components/abp-lab/SelectorJugador";
import { defensaRivalDe, type ContextoSim } from "@/components/abp-lab/useSimulacion";
import type { GuardaLab } from "@/hooks/useAbpLab";
import { useAbpLigas } from "@/hooks/useAbpLigas";
import { useContextoLab } from "@/hooks/useContextoLab";
import { encajeSistemas, evaluaRemate, planCon } from "@/lib/abp-lab/ventaja";
import { comaXg } from "@/lib/abp-lab/xg";
import { FASES, anclaDe } from "@/lib/abp-lab/campo";
import {
  DEFENSAS,
  DESENLACES,
  ESTADOS,
  PAPELES,
  PROGRESION,
  TIPOS,
  ZONAS,
  etiqueta,
  type Defensa,
  type Desenlace,
  type Estado,
  type Fase,
  type Lado,
  type Papel,
  type Rol,
  type Rutina,
  type Zona,
} from "@/lib/abp-lab/modelo";
import { REFERENTES, type TipoAbp } from "@/lib/abp-lab/referentes";
import { ideasPara } from "@/lib/abp-lab/variantes";

export type Borrador = Omit<Rutina, "id" | "creadaEn" | "actualizadaEn"> & { id?: string };

export const borradorVacio = (): Borrador => ({
  nombre: "",
  tipo: "corner",
  lado: "ofensivo",
  contra: "cualquiera",
  senal: "",
  idea: "",
  roles: [],
  variantes: [],
  estado: "idea",
});

/* Las inspiraciones posibles: cada referente y cada una de sus rutinas. */
const INSPIRACIONES = [
  { value: "", label: "Propia" },
  ...REFERENTES.flatMap((r) => [{ value: r.id, label: `${r.nombre} (${r.club})` }, ...r.rutinas.map((x) => ({ value: x.id, label: `${r.nombre} · ${x.nombre}` }))]),
];

const nombreInspiracion = (id?: string) => {
  if (!id) return "";

  for (const r of REFERENTES) {
    if (r.id === id) return r.nombre;

    const x = r.rutinas.find((y) => y.id === id);

    if (x) return `${r.nombre} · ${x.nombre}`;
  }

  return "";
};

const TONO_ESTADO: Record<Estado, string> = {
  idea: "bg-white/10 text-white/60",
  probada: "bg-sky-400/15 text-sky-300",
  partido: "bg-emerald-400/15 text-emerald-300",
};

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** Lo que dio una rutina compitiendo: «4 usos · 2 con remate · 1 gol». */
export function balanceUsos(r: Pick<Rutina, "usos">) {
  const usos = r.usos ?? [];

  if (!usos.length) return null;

  const goles = usos.filter((u) => u.desenlace === "gol").length;

  const remates = usos.filter((u) => u.desenlace !== "nada").length;

  return { usos: usos.length, remates, goles };
}

const normaliza = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/* ------------------------------------------------------------------ */
/*  LA LISTA                                                           */
/* ------------------------------------------------------------------ */

export function Taller({
  rutinas,
  jugadores,
  porId,
  guarda,
  ocupado,
  cargando,
  abierto,
  setAbierto,
}: {
  rutinas: Rutina[];
  jugadores: JugadorLab[];
  porId: Map<string, JugadorLab>;
  guarda: GuardaLab;
  ocupado: boolean;
  cargando: boolean;
  /** El borrador en el estudio (lo abre también «Al taller» desde Referentes). */
  abierto: Borrador | null;
  setAbierto: (b: Borrador | null) => void;
}) {
  const [filtroTipo, setFiltroTipo] = useState<TipoAbp | "todos">("todos");

  const [filtroEstado, setFiltroEstado] = useState<Estado | null>(null);

  const [busca, setBusca] = useState("");

  const [orden, setOrden] = useState<"recientes" | "nombre" | "xg">("recientes");

  /* Lo que la pizarra sabe de fuera (alturas, xG de nuestros partidos, próximo rival): se lee una vez. */
  const { aereo, calibre, rival } = useContextoLab();

  const ctx = useMemo<ContextoSim>(() => ({ aereo, calibre, rival }), [aereo, calibre, rival]);

  /* El xG estimado de cada rutina contra su mejor sistema, para la biblioteca. */
  const xgDe = useMemo(() => {
    const alturaDe = (rol: Rol) => aereo.get(rol.jugador)?.altura ?? null;

    return new Map(
      rutinas.map((r) => {
        if (r.lado !== "ofensivo" || !r.roles.length || (r.tipo !== "corner" && r.tipo !== "falta")) return [r.id, null] as const;

        const encaje = encajeSistemas(r, calibre, alturaDe);

        const contra = r.contra === "cualquiera" ? encaje[0] : encaje.find((e) => e.defensa === r.contra);

        return [r.id, contra && contra.remate?.quien !== null ? contra.xg : null] as const;
      }),
    );
  }, [rutinas, aereo, calibre]);

  const porIdRutina = useMemo(() => new Map(rutinas.map((r) => [r.id, r])), [rutinas]);

  /*
   * El encaje automático con el próximo rival: cada rutina a favor de córner o
   * falta, contra su defensa (la de su scouting, con sus jugadores más altos).
   * Sólo sale si hay rival y algo suyo con que medir.
   */
  const contraProximo = useMemo(() => {
    if (!rival) return [];

    const alturaDe = (rol: Rol) => aereo.get(rol.jugador)?.altura ?? null;

    return rutinas
      .flatMap((r) => {
        const def = defensaRivalDe("proximo", r, ctx);

        if (!def || !r.roles.length || (r.tipo !== "corner" && r.tipo !== "falta")) return [];

        const remate = evaluaRemate(r, planCon(r, def), calibre, alturaDe);

        return remate && remate.quien !== null && remate.xg > 0 ? [{ r, xg: remate.xg }] : [];
      })
      .sort((a, b) => b.xg - a.xg)
      .slice(0, 3);
  }, [rival, rutinas, aereo, calibre, ctx]);

  const estructuraCorner = rival?.corner ?? null;

  const visibles = useMemo(() => {
    const q = normaliza(busca.trim());

    const lista = rutinas.filter(
      (r) =>
        (filtroTipo === "todos" || r.tipo === filtroTipo) &&
        (!filtroEstado || r.estado === filtroEstado) &&
        (!q || normaliza(`${r.nombre} ${r.idea} ${r.senal} ${r.variantes.join(" ")}`).includes(q)),
    );

    if (orden === "nombre") return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    if (orden === "xg") return [...lista].sort((a, b) => (xgDe.get(b.id) ?? -1) - (xgDe.get(a.id) ?? -1));

    return [...lista].sort((a, b) => (b.actualizadaEn ?? "").localeCompare(a.actualizadaEn ?? ""));
  }, [rutinas, filtroTipo, filtroEstado, busca, orden, xgDe]);

  /* Una copia para empezar otra: sin id (es nueva), sin progreso ni usos; la variante recuerda de quién sale. */
  const copiaDe = (r: Borrador, comoVariante: boolean): Borrador => ({
    ...r,
    id: undefined,
    nombre: comoVariante ? `${r.nombre} · variante` : `${r.nombre} (copia)`,
    estado: "idea",
    progreso: [],
    usos: [],
    roles: r.roles.map((x) => ({ ...x })),
    ...(r.balon ? { balon: r.balon.map((p) => ({ ...p })) } : {}),
    ...(comoVariante && r.id ? { padre: r.padre ?? r.id } : {}),
  });

  const porEstado = useMemo(() => ESTADOS.map((e) => ({ ...e, n: rutinas.filter((r) => r.estado === e.key).length })), [rutinas]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel="Tipo de balón parado"
          value={filtroTipo}
          onChange={setFiltroTipo}
          options={[{ key: "todos" as const, label: "Todas" }, ...TIPOS.map((t) => ({ key: t.key, label: t.label }))]}
        />
        <Button tone="primary" icon={Plus} onClick={() => setAbierto(borradorVacio())}>
          Nueva rutina
        </Button>
      </div>

      {rutinas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <span className="sr-only">Buscar rutina</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nombre, señal o idea"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50"
            />
          </label>
          <div role="radiogroup" aria-label="Orden de la biblioteca" className="inline-flex gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {(
              [
                { k: "recientes", label: "Recientes" },
                { k: "nombre", label: "A-Z" },
                { k: "xg", label: "xG" },
              ] as const
            ).map((o) => (
              <button
                key={o.k}
                type="button"
                role="radio"
                aria-checked={orden === o.k}
                onClick={() => setOrden(o.k)}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${orden === o.k ? "bg-white/[0.12] text-white" : "text-white/50 hover:text-white"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {porEstado.map((e) => {
            const activo = filtroEstado === e.key;

            return (
              <button
                key={e.key}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltroEstado(activo ? null : e.key)}
                className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${TONO_ESTADO[e.key]} ${activo ? "ring-2 ring-[#C8A96B]" : "opacity-80 hover:opacity-100"}`}
              >
                {e.label} · {e.n}
              </button>
            );
          })}
        </div>
      )}

      {!cargando && rival && contraProximo.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.06]" aria-label={`Las mejores contra ${rival.equipo}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">Encaje con el próximo rival</p>
            <p className="text-[11.5px] text-white/55">
              {rival.equipo}
              {estructuraCorner
                ? ` · córner ${estructuraCorner.tipo === "zonal" ? `en zona${estructuraCorner.enZona ? ` con ${estructuraCorner.enZona}` : ""}` : estructuraCorner.tipo === "hombre" ? "al hombre" : "en mixta"} (scouting)`
                : ""}
            </p>
          </div>
          <ol className="grid gap-2 p-3 sm:grid-cols-3">
            {contraProximo.map(({ r, xg }, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setAbierto({ ...r })}
                  className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-[#C8A96B]/50"
                >
                  <span className="text-lg font-black tabular-nums text-[#C8A96B]">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-white/90">{r.nombre}</span>
                    <span className="block text-[11px] text-white/50">xG estimado {comaXg(xg)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {cargando ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Cargando las rutinas">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <EmptyState
          title={rutinas.length ? "Ninguna rutina con ese filtro" : "El taller está vacío"}
          description={
            rutinas.length
              ? "Quita el filtro o busca otra palabra."
              : "Empieza una desde cero o lleva al taller una rutina de un referente: llega dibujada y lista para reproducir."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((r) => {
            const hechos = (r.progreso ?? []).length;

            const balance = balanceUsos(r);

            const ultimo = PROGRESION.filter((p) => (r.progreso ?? []).includes(p.key)).at(-1);

            const xg = xgDe.get(r.id);

            const padre = r.padre ? porIdRutina.get(r.padre) : undefined;

            const hijas = rutinas.filter((x) => x.padre === r.id).length;

            return (
              <div key={r.id} className="lab-aparece group relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-0.5 hover:border-[#C8A96B]/50">
                <button type="button" onClick={() => setAbierto({ ...r })} className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]" aria-label={`Abrir ${r.nombre}`}>
                  <div className="relative">
                    <MiniPizarra rutina={r} porId={porId} />
                    {xg !== null && xg !== undefined && (
                      <span className="absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[10.5px] font-black tabular-nums" style={{ background: "#C8A96B", color: "#0B0F14" }}>
                        xG {comaXg(xg)}
                      </span>
                    )}
                  </div>
                </button>
                {/* Duplicar y hacer variante, sin abrirla */}
                <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setAbierto(copiaDe(r, false))}
                    title="Duplicar"
                    aria-label={`Duplicar ${r.nombre}`}
                    className="rounded-lg p-1.5 shadow"
                    style={{ background: "rgba(11,15,20,0.82)", color: "#FFFFFF" }}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbierto(copiaDe(r, true))}
                    title="Crear una variante"
                    aria-label={`Crear una variante de ${r.nombre}`}
                    className="rounded-lg p-1.5 shadow"
                    style={{ background: "rgba(11,15,20,0.82)", color: "#C8A96B" }}
                  >
                    <GitBranch size={13} />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-white">{r.nombre}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TONO_ESTADO[r.estado]}`}>{etiqueta(ESTADOS, r.estado)}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-white/50">
                    {etiqueta(TIPOS, r.tipo)} · {r.lado === "ofensivo" ? "a favor" : "en contra"} · {etiqueta(DEFENSAS, r.contra).toLowerCase()}
                    {r.senal ? ` · señal «${r.senal}»` : ""}
                  </p>
                  {r.inspiracion && <p className="mt-1 truncate text-[11px] text-[#C8A96B]">Inspirada en {nombreInspiracion(r.inspiracion)}</p>}
                  {(padre || hijas > 0) && (
                    <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-white/50">
                      <GitBranch size={11} className="shrink-0 text-[#C8A96B]" />
                      {padre ? `Variante de ${padre.nombre}` : `${hijas} ${hijas === 1 ? "variante" : "variantes"}`}
                    </p>
                  )}

                  {/* El camino de la pizarra al partido */}
                  <div className="mt-3 flex items-center gap-1" role="img" aria-label={`Progresión: ${hechos} de ${PROGRESION.length}`}>
                    {PROGRESION.map((p) => (
                      <span key={p.key} title={p.label} className={`h-1.5 flex-1 rounded-full ${(r.progreso ?? []).includes(p.key) ? "bg-[#C8A96B]" : "bg-white/10"}`} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/45">
                    {ultimo ? ultimo.label : "Sin entrenar todavía"}
                    {balance ? ` · ${balance.usos} ${balance.usos === 1 ? "uso" : "usos"} · ${balance.remates} con remate${balance.goles ? ` · ${balance.goles} ${balance.goles === 1 ? "gol" : "goles"}` : ""}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {abierto && (
        <Estudio
          key={`${abierto.id ?? "nueva"}-${abierto.nombre}`}
          inicial={abierto}
          jugadores={jugadores}
          porId={porId}
          ocupado={ocupado}
          onCerrar={() => setAbierto(null)}
          onGuardar={async (b) => {
            try {
              await guarda({ accion: "rutina-guarda", rutina: b });
              toast.success("Rutina guardada");
              setAbierto(null);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "No se ha podido guardar");
            }
          }}
          onBorrar={
            abierto.id
              ? async () => {
                  if (!window.confirm("¿Borrar esta rutina del taller?")) return;

                  try {
                    await guarda({ accion: "rutina-borra", id: abierto.id });
                    toast.success("Rutina borrada");
                    setAbierto(null);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "No se ha podido borrar");
                  }
                }
              : undefined
          }
          onDuplicar={(b) => setAbierto(copiaDe(b, true))}
          ctx={ctx}
          familia={rutinas.filter((r) => abierto.id && r.id !== abierto.id && ((abierto.padre && (r.id === abierto.padre || r.padre === abierto.padre)) || r.padre === abierto.id))}
          onAbre={(r) => setAbierto({ ...r })}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EL ESTUDIO                                                         */
/* ------------------------------------------------------------------ */

type Pestana = "ficha" | "papeles" | "variantes" | "rival" | "progreso";

const PESTANAS: { key: Pestana; label: string }[] = [
  { key: "ficha", label: "Ficha" },
  { key: "papeles", label: "Papeles" },
  { key: "variantes", label: "Variantes" },
  { key: "rival", label: "Rival" },
  { key: "progreso", label: "Progreso" },
];

type Pon = <K extends keyof Borrador>(k: K, v: Borrador[K]) => void;

function Estudio({
  inicial,
  jugadores,
  porId,
  ocupado,
  onCerrar,
  onGuardar,
  onBorrar,
  onDuplicar,
  ctx,
  familia,
  onAbre,
}: {
  inicial: Borrador;
  jugadores: JugadorLab[];
  porId: Map<string, JugadorLab>;
  ocupado: boolean;
  onCerrar: () => void;
  onGuardar: (b: Borrador) => void;
  onBorrar?: () => void;
  onDuplicar: (b: Borrador) => void;
  ctx: ContextoSim;
  /** Las otras rutinas de su familia (la madre y sus variantes). */
  familia: Rutina[];
  onAbre: (r: Rutina) => void;
}) {
  /*
   * El borrador con deshacer y rehacer. La historia vive en refs y se apunta
   * FUERA del actualizador de estado (en modo estricto React lo llama dos
   * veces); los cambios que llegan seguidos —un arrastre son decenas— se
   * juntan en un solo paso si no hay 0,7 s de pausa entre ellos.
   */
  const [b, setBEstado] = useState<Borrador>(inicial);

  const actual = useRef<Borrador>(inicial);

  const pasado = useRef<Borrador[]>([]);

  const futuro = useRef<Borrador[]>([]);

  const ultimoCambio = useRef(0);

  const [pasos, setPasos] = useState({ atras: 0, adelante: 0 });

  const setB = useCallback((f: Borrador | ((x: Borrador) => Borrador)) => {
    const antes = actual.current;

    const nuevo = typeof f === "function" ? f(antes) : f;

    if (nuevo === antes) return;

    const ahora = performance.now();

    if (ahora - ultimoCambio.current > 700) {
      pasado.current.push(antes);

      if (pasado.current.length > 80) pasado.current.shift();
    }

    ultimoCambio.current = ahora;
    futuro.current = [];
    actual.current = nuevo;
    setBEstado(nuevo);
    setPasos({ atras: pasado.current.length, adelante: 0 });
  }, []);

  const deshaz = useCallback((sentido: 1 | -1) => {
    const de = sentido < 0 ? pasado.current : futuro.current;

    const a = sentido < 0 ? futuro.current : pasado.current;

    const otro = de.pop();

    if (!otro) return;

    a.push(actual.current);
    actual.current = otro;
    ultimoCambio.current = 0;
    setBEstado(otro);
    setPasos({ atras: pasado.current.length, adelante: futuro.current.length });
  }, []);

  /* Una rutina que llega dibujada (de un referente) abre en la pizarra con sus papeles; una vacía, en la ficha. */
  const [pestana, setPestana] = useState<Pestana>(inicial.roles.length && !inicial.id ? "papeles" : "ficha");

  const [elegido, setElegido] = useState<number | null>(null);

  const sucio = JSON.stringify(b) !== JSON.stringify(inicial);

  /* El aviso de «sin guardar» lo lee el manejador de Escape, que vive fuera del render. */
  const hayCambios = useRef(sucio);

  useEffect(() => {
    hayCambios.current = sucio;
  });

  const cierra = () => {
    if (sePuedeDescartar(sucio)) onCerrar();
  };

  /* Escape cierra (preguntando si hay cambios), salvo escribiendo; y la página de debajo no se mueve. */
  useEffect(() => {
    const antes = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const tecla = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;

      const escribe = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;

      /* Deshacer y rehacer de la rutina; escribiendo, el del propio campo. */
      if ((e.ctrlKey || e.metaKey) && !escribe && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        deshaz(e.key.toLowerCase() === "y" || e.shiftKey ? 1 : -1);

        return;
      }

      if (e.key !== "Escape" || escribe || e.defaultPrevented) return;

      if (sePuedeDescartar(hayCambios.current)) onCerrar();
    };

    window.addEventListener("keydown", tecla);

    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", tecla);
    };
  }, [onCerrar, deshaz]);

  const pon: Pon = (k, v) => setB((x) => ({ ...x, [k]: v }));

  return (
    <div role="dialog" aria-modal="true" aria-label={b.nombre || "Nueva rutina"} className="fixed inset-0 z-[60] flex flex-col bg-[#0B0F14] text-white">
      {/* ------------------------------ CABECERA ---------------------------- */}
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:px-6">
        <button type="button" onClick={cierra} aria-label="Cerrar el estudio" className="rounded-xl p-2 text-white/60 transition hover:bg-white/[0.06] hover:text-white">
          <X size={18} />
        </button>
        <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.28em] text-[#C8A96B]">
            Taller · {etiqueta(TIPOS, b.tipo)} {b.lado === "ofensivo" ? "a favor" : "en contra"}
          </p>
          <input
            value={b.nombre}
            onChange={(e) => pon("nombre", e.target.value)}
            placeholder="Ponle nombre a la rutina"
            aria-label="Nombre de la rutina"
            autoFocus={!b.id && !b.nombre}
            maxLength={80}
            className="w-full min-w-0 bg-transparent text-lg font-semibold text-white outline-none placeholder:text-white/30 sm:text-xl"
          />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/10">
            <button type="button" onClick={() => deshaz(-1)} disabled={!pasos.atras} title="Deshacer (Ctrl + Z)" aria-label="Deshacer" className="rounded-l-xl p-2 text-white/60 transition hover:text-white disabled:opacity-30">
              <Undo2 size={15} />
            </button>
            <button type="button" onClick={() => deshaz(1)} disabled={!pasos.adelante} title="Rehacer (Ctrl + Mayús + Z)" aria-label="Rehacer" className="rounded-r-xl p-2 text-white/60 transition hover:text-white disabled:opacity-30">
              <Redo2 size={15} />
            </button>
          </div>
          {onBorrar && (
            <Button tone="danger" icon={Trash2} onClick={onBorrar} disabled={ocupado} aria-label="Borrar la rutina">
              <span className="hidden sm:inline">Borrar</span>
            </Button>
          )}
          {b.id && (
            <Button icon={Copy} onClick={() => onDuplicar(b)} title="Copia esta rutina como punto de partida de otra" aria-label="Hacer una variante">
              <span className="hidden sm:inline">Hacer una variante</span>
            </Button>
          )}
          <Button tone="primary" icon={Save} disabled={!b.nombre.trim() || ocupado || (!sucio && Boolean(b.id))} onClick={() => onGuardar(b)}>
            {ocupado ? "Guardando…" : sucio || !b.id ? "Guardar" : "Guardada"}
          </Button>
        </div>
      </header>

      {/* ------------------------------ CUERPO ------------------------------ */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1500px] gap-5 px-3 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)]">
          <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">
            <PizarraRutina
              rutina={b}
              porId={porId}
              seleccionado={elegido}
              onSelecciona={setElegido}
              ctx={ctx}
              onCambia={(c) =>
                setB((x) => ({
                  ...x,
                  ...(c.roles ? { roles: c.roles } : {}),
                  ...(c.balon ? { balon: c.balon } : {}),
                  ...(c.envio ? { envio: c.envio } : {}),
                }))
              }
            />
            {b.roles.length === 0 && (
              <p className="mt-3 rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-[12.5px] text-white/55">
                La pizarra está vacía: añade papeles en la pestaña <strong className="text-white/80">Papeles</strong> y colócalos arrastrando.
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <Segmented ariaLabel="Partes de la rutina" value={pestana} onChange={setPestana} options={PESTANAS} />

            {pestana === "ficha" && (
              <>
                <Ficha b={b} pon={pon} />
                {familia.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                      <GitBranch size={12} className="text-[#C8A96B]" />
                      Su familia
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {familia.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            if (sePuedeDescartar(sucio)) onAbre(r);
                          }}
                          className="max-w-full truncate rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] font-medium text-white/75 transition hover:border-[#C8A96B]/50 hover:text-white"
                        >
                          {r.id === b.padre ? `Madre · ${r.nombre}` : r.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {pestana === "papeles" && <Papeles b={b} setB={setB} jugadores={jugadores} porId={porId} elegido={elegido} setElegido={setElegido} ctx={ctx} />}

            {pestana === "variantes" && <Variantes b={b} pon={pon} />}

            {pestana === "rival" && (
              <div className="space-y-3">
                <EncajeRival tipo={b.tipo} lado={b.lado} />
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <Select label="La pizarra la enseña contra" value={b.contra} options={DEFENSAS.map((d) => ({ value: d.key, label: d.label }))} onChange={(v) => pon("contra", v as Defensa)} />
                  <p className="mt-2 text-[12px] leading-snug text-white/50">
                    Las fichas granates de la pizarra son esa defensa: en zona, las líneas del área pequeña; al hombre, un marcador que persigue a cada atacante y al que un bloqueo frena. Wyscout no dice cómo defiende cada rival: el del próximo partido sale de su scouting de ABP.
                  </p>
                </div>
              </div>
            )}

            {pestana === "progreso" && <Progreso b={b} setB={setB} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FICHA                                                              */
/* ------------------------------------------------------------------ */

function Ficha({ b, pon }: { b: Borrador; pon: Pon }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Tipo" value={b.tipo} options={TIPOS.map((t) => ({ value: t.key, label: t.label }))} onChange={(v) => pon("tipo", v as TipoAbp)} />
        <Select
          label="Lado"
          value={b.lado}
          options={[
            { value: "ofensivo", label: "A favor (atacamos)" },
            { value: "defensivo", label: "En contra (defendemos)" },
          ]}
          onChange={(v) => pon("lado", v as Lado)}
        />
        <Select label="Pensada contra" value={b.contra} options={DEFENSAS.map((d) => ({ value: d.key, label: d.label }))} onChange={(v) => pon("contra", v as Defensa)} />
        <Select label="Estado" value={b.estado} options={ESTADOS.map((e) => ({ value: e.key, label: e.label }))} onChange={(v) => pon("estado", v as Estado)} />
        <Field label="Señal" value={b.senal} onChange={(v) => pon("senal", v)} placeholder="Mano a la cabeza" />
        <Select label="Inspirada en" value={b.inspiracion ?? ""} options={INSPIRACIONES} onChange={(v) => pon("inspiracion", v || undefined)} />
      </div>

      <TextArea label="La idea" value={b.idea} onChange={(v) => pon("idea", v)} rows={5} placeholder="Qué buscamos y en qué orden pasa" />

      {b.inspiracion && (
        <p className="flex items-center gap-1.5 text-[12px] text-[#C8A96B]">
          <FlaskConical size={13} />
          Inspirada en {nombreInspiracion(b.inspiracion)}
        </p>
      )}

      <a
        href="/abp-pizarra"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/55 underline-offset-2 transition hover:text-white hover:underline"
      >
        <ExternalLink size={12} />
        Abrir la pizarra de ABP para la diapositiva del partido
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PAPELES                                                            */
/* ------------------------------------------------------------------ */

function Papeles({
  b,
  setB,
  jugadores,
  porId,
  elegido,
  setElegido,
  ctx,
}: {
  b: Borrador;
  setB: (f: (x: Borrador) => Borrador) => void;
  jugadores: JugadorLab[];
  porId: Map<string, JugadorLab>;
  elegido: number | null;
  setElegido: (i: number | null) => void;
  ctx: ContextoSim;
}) {
  const filas = useRef<(HTMLDivElement | null)[]>([]);

  /* El reparto por altura sólo se ofrece si Wyscout da la altura de alguien y hay papeles de remate sin dueño. */
  const reparto = useMemo(() => repartoPorAltura(b.roles, jugadores, ctx.aereo), [b.roles, jugadores, ctx.aereo]);

  /* Lo que se toca en la pizarra se ve en la lista. */
  useEffect(() => {
    if (elegido !== null) filas.current[elegido]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [elegido]);

  const papeles = PAPELES.filter((p) => p.lado === "ambos" || p.lado === b.lado);

  const ponRol = (i: number, cambio: Partial<Rol>) => setB((x) => ({ ...x, roles: x.roles.map((r, j) => (j === i ? { ...r, ...cambio } : r)) }));

  const anade = (papel: Papel) => {
    const zona: Zona = papel === "lanzador" || papel === "corto" ? "corto" : papel === "segunda" ? "frontal" : papel === "vigilancia" ? "atras" : papel === "portero" ? "portero" : "centro";

    setB((x) => ({ ...x, roles: [...x.roles, { jugador: "", papel, zona }] }));

    setElegido(b.roles.length);
  };

  const rapidos: Papel[] = b.lado === "ofensivo" ? ["lanzador", "rematador", "bloqueador", "senuelo", "portero", "segunda", "vigilancia"] : ["zonal", "marcador", "corto", "segunda", "vigilancia"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Añadir un papel">
        {rapidos.map((p) => (
          <button
            key={p}
            type="button"
            disabled={b.roles.length >= 14}
            onClick={() => anade(p)}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] font-medium text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white disabled:opacity-40"
          >
            <Plus size={11} />
            {etiqueta(PAPELES, p)}
          </button>
        ))}
      </div>

      {b.roles.length === 0 && <p className="text-[12.5px] text-white/45">Añade lanzador, rematador, bloqueadores, señuelos y quién se queda para la segunda jugada.</p>}

      {reparto.cambios > 0 && (
        <button
          type="button"
          onClick={() => setB((x) => ({ ...x, roles: repartoPorAltura(x.roles, jugadores, ctx.aereo).roles }))}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1.5 text-[12px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
          title="Los más altos (Wyscout) a rematar, bloquear y atacar al portero; no toca lo que ya tiene dueño"
        >
          <ArrowUpRight size={13} />
          Repartir por altura · {reparto.cambios} {reparto.cambios === 1 ? "papel" : "papeles"}
        </button>
      )}

      <div className="space-y-2">
        {b.roles.map((r, i) => {
          const activo = elegido === i;

          const repetido = Boolean(r.jugador) && b.roles.some((o, j) => j !== i && o.jugador === r.jugador);

          return (
            <div
              key={i}
              ref={(el) => {
                filas.current[i] = el;
              }}
              onFocusCapture={() => setElegido(i)}
              className={`rounded-xl border p-2.5 transition ${activo ? "border-[#C8A96B]/60 bg-[#C8A96B]/[0.07]" : "border-white/10 bg-white/[0.02]"}`}
            >
              <div className="grid grid-cols-[auto_1fr_auto] gap-2.5">
                <span
                  aria-hidden
                  className={`mt-6 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-black ${
                    ["senuelo", "segunda", "vigilancia"].includes(r.papel) ? "border-2 border-[#C8A96B] text-[#C8A96B]" : "bg-[#C8A96B] text-black"
                  }`}
                >
                  {porId.get(r.jugador)?.dorsal ?? CODIGO_PAPEL[r.papel]}
                </span>
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <SelectorJugador
                      valor={r.jugador}
                      jugadores={jugadores}
                      porId={porId}
                      aereo={ctx.aereo}
                      ocupados={new Set(b.roles.filter((_, j) => j !== i).map((o) => o.jugador).filter(Boolean))}
                      papel={r.papel}
                      onElige={(v) => ponRol(i, { jugador: v })}
                    />
                  </div>
                  <Select label="Papel" value={r.papel} options={papeles.some((p) => p.key === r.papel) ? papeles.map((p) => ({ value: p.key, label: p.label })) : PAPELES.map((p) => ({ value: p.key, label: p.label }))} onChange={(v) => ponRol(i, { papel: v as Papel })} />
                  <Select
                    label="Zona"
                    value={r.zona}
                    options={ZONAS.map((z) => ({ value: z.key, label: z.label }))}
                    onChange={(v) => {
                      /* Cambiar la zona lo lleva allí (la salida colocada a mano se sustituye, a propósito). */
                      const a = anclaDe(v as Zona);

                      ponRol(i, { zona: v as Zona, x: a.x, y: a.y });
                    }}
                  />
                  {r.hx !== undefined && (
                    <Select label="Su carrera arranca" value={String(r.fase ?? 2)} options={FASES.map((f) => ({ value: String(f.key), label: f.label }))} onChange={(v) => ponRol(i, { fase: Number(v) as Fase })} />
                  )}
                  <div className={r.hx !== undefined ? "min-w-0 sm:col-span-2" : "col-span-2 min-w-0 sm:col-span-3"}>
                    <Field label="Nota" value={r.nota ?? ""} onChange={(v) => ponRol(i, { nota: v || undefined })} placeholder="Detalle para el jugador (opcional)" />
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Quitar el papel de ${porId.get(r.jugador)?.nombre ?? etiqueta(PAPELES, r.papel)}`}
                  onClick={() => {
                    setB((x) => ({ ...x, roles: x.roles.filter((_, j) => j !== i) }));
                    setElegido(null);
                  }}
                  className="self-start rounded-lg p-1.5 text-white/40 transition hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
              {repetido && <p className="mt-1.5 text-[11px] text-amber-300">Este jugador ya tiene otro papel en la rutina.</p>}
            </div>
          );
        })}
      </div>

      {b.roles.length > 0 && (
        <p className="flex items-center gap-1.5 text-[11.5px] text-white/40">
          <Users size={12} />
          {b.roles.length} {b.roles.length === 1 ? "papel" : "papeles"} · {b.roles.filter((r) => r.jugador).length} con dueño
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  VARIANTES                                                          */
/* ------------------------------------------------------------------ */

function Variantes({ b, pon }: { b: Borrador; pon: Pon }) {
  const ideas = useMemo(() => ideasPara(b, b.variantes), [b]);

  const llena = b.variantes.length >= 8;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">Nuestras variantes</span>
          <Button icon={Plus} onClick={() => pon("variantes", [...b.variantes, ""])} disabled={llena}>
            Variante
          </Button>
        </div>
        {b.variantes.length === 0 && <p className="text-[12.5px] text-white/45">Qué cambia si el rival responde distinto: «si saltan al primer palo, al segundo».</p>}
        <div className="space-y-2">
          {b.variantes.map((v, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 w-5 shrink-0 text-center text-[12px] font-black text-[#C8A96B]">{String.fromCharCode(65 + i)}</span>
              <textarea
                value={v}
                rows={2}
                onChange={(e) => pon("variantes", b.variantes.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="Si saltan al primer palo, al segundo"
                aria-label={`Variante ${String.fromCharCode(65 + i)}`}
                className="min-w-0 flex-1 resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#C8A96B]/50"
              />
              <button
                type="button"
                aria-label={`Quitar la variante ${String.fromCharCode(65 + i)}`}
                onClick={() => pon("variantes", b.variantes.filter((_, j) => j !== i))}
                className="mt-1 rounded-lg p-1.5 text-white/40 transition hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {ideas.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            <Lightbulb size={12} className="text-[#C8A96B]" />
            Ideas de los referentes · {etiqueta(DEFENSAS, b.contra).toLowerCase()}
          </p>
          <ul className="mt-3 space-y-2.5">
            {ideas.slice(0, 6).map((idea) => (
              <li key={idea.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white/90">{idea.titulo}</p>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-white/60">{idea.texto}</p>
                    <a href={idea.fuente.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 text-[10.5px] text-white/40 hover:text-[#C8A96B]">
                      <ArrowUpRight size={11} className="shrink-0" />
                      <span className="truncate">
                        {idea.de ? `${idea.de} · ` : ""}
                        {idea.fuente.medio}
                      </span>
                    </a>
                  </div>
                  <Button icon={Plus} disabled={llena} onClick={() => pon("variantes", [...b.variantes, idea.texto])}>
                    Añadir
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PROGRESO                                                           */
/* ------------------------------------------------------------------ */

function Progreso({ b, setB }: { b: Borrador; setB: (f: (x: Borrador) => Borrador) => void }) {
  const { datos } = useAbpLigas();

  const hechos = new Set(b.progreso ?? []);

  const [uso, setUso] = useState<{ fecha: string; rival: string; desenlace: Desenlace }>(() => ({ fecha: hoy(), rival: "", desenlace: "remate" }));

  /* Los rivales de nuestra liga, para no teclearlos. */
  const rivales = useMemo(() => {
    const liga = datos?.ligas.find((l) => l.equipos.some((e) => /castilla/i.test(e)));

    return liga ? liga.equipos.filter((e) => !/castilla/i.test(e)) : [];
  }, [datos]);

  const conmuta = (key: string) =>
    setB((x) => {
      const s = new Set(x.progreso ?? []);

      if (s.has(key)) s.delete(key);
      else s.add(key);

      return { ...x, progreso: PROGRESION.map((p) => p.key).filter((k) => s.has(k)) };
    });

  /* Lo que la progresión dice del estado, como propuesta: el estado lo decide el cuerpo técnico. */
  const propuesta: Estado | null = hechos.has("oficial") ? "partido" : hechos.has("activa") || hechos.has("partidillo") ? "probada" : null;

  const balance = balanceUsos(b);

  return (
    <div className="space-y-5">
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          <ListChecks size={12} className="text-[#C8A96B]" />
          De la pizarra al partido · {hechos.size} de {PROGRESION.length}
        </p>
        <ol className="mt-3 space-y-1.5">
          {PROGRESION.map((p, i) => {
            const hecho = hechos.has(p.key);

            return (
              <li key={p.key}>
                <button
                  type="button"
                  aria-pressed={hecho}
                  onClick={() => conmuta(p.key)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${hecho ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.08]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${hecho ? "bg-[#C8A96B] text-black" : "bg-white/10 text-white/50"}`}>
                    {hecho ? <Check size={13} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-white/90">{p.label}</span>
                    <span className="block text-[11.5px] text-white/45">{p.detalle}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {propuesta && propuesta !== b.estado && (
          <button
            type="button"
            onClick={() => setB((x) => ({ ...x, estado: propuesta }))}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#C8A96B]/15 px-3 py-1.5 text-[12px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/25"
          >
            <CheckCircle2 size={13} />
            Pasarla a «{etiqueta(ESTADOS, propuesta)}»
          </button>
        )}
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          <Goal size={12} className="text-[#C8A96B]" />
          Compitiendo
        </p>
        {balance && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { v: balance.usos, t: balance.usos === 1 ? "vez usada" : "veces usada" },
              { v: balance.remates, t: "con remate" },
              { v: balance.goles, t: balance.goles === 1 ? "gol" : "goles" },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                <p className="text-2xl font-black tabular-nums text-white">{c.v}</p>
                <p className="text-[11px] text-white/45">{c.t}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[auto_1fr]">
          <Field label="Día" type="date" value={uso.fecha} onChange={(v) => setUso((x) => ({ ...x, fecha: v }))} />
          <Field label="Rival" value={uso.rival} onChange={(v) => setUso((x) => ({ ...x, rival: v }))} suggestions={rivales} placeholder="Contra quién" />
          <div className="flex flex-wrap items-end justify-between gap-2 sm:col-span-2">
            <Segmented ariaLabel="Qué dio" value={uso.desenlace} onChange={(v) => setUso((x) => ({ ...x, desenlace: v }))} options={DESENLACES} />
            <Button
              icon={Plus}
              disabled={!/^\d{4}-\d{2}-\d{2}$/.test(uso.fecha) || !uso.rival.trim()}
              onClick={() => {
                setB((x) => ({ ...x, usos: [{ ...uso, rival: uso.rival.trim() }, ...(x.usos ?? [])].sort((p, q) => q.fecha.localeCompare(p.fecha)) }));
                setUso((x) => ({ ...x, rival: "" }));
              }}
            >
              Apuntar
            </Button>
          </div>
        </div>

        {(b.usos ?? []).length > 0 && (
          <ul className="mt-3 divide-y divide-white/5 rounded-2xl border border-white/10">
            {(b.usos ?? []).map((u, i) => (
              <li key={`${u.fecha}-${i}`} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                <span className="w-12 shrink-0 tabular-nums text-white/45">{fechaCorta(u.fecha)}</span>
                <span className="min-w-0 flex-1 truncate text-white/80">{u.rival}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    u.desenlace === "gol" ? "bg-emerald-400/15 text-emerald-300" : u.desenlace === "remate" ? "bg-sky-400/15 text-sky-300" : "bg-white/10 text-white/55"
                  }`}
                >
                  {etiqueta(DESENLACES, u.desenlace)}
                </span>
                <button
                  type="button"
                  aria-label={`Quitar el uso del ${fechaCorta(u.fecha)}`}
                  onClick={() => setB((x) => ({ ...x, usos: (x.usos ?? []).filter((_, j) => j !== i) }))}
                  className="rounded-lg p-1 text-white/35 transition hover:text-white"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-white/40">
        {b.lado === "ofensivo" ? <Swords size={12} className="mt-0.5 shrink-0" /> : <Shield size={12} className="mt-0.5 shrink-0" />}
        «Con remate» cuenta también los goles. Brentford mide el córner por lo que genera, no por cuántos se sacan.
      </p>
    </div>
  );
}
