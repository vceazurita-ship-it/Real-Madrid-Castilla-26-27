"use client";

/**
 * Pestaña «Taller»: las rutinas propias, de la idea al partido.
 *
 * Cada rutina lleva quién hace qué y dónde (el campo pequeño lo enseña al
 * momento), la señal, las variantes y contra qué defensa se pensó. Se puede
 * nacer de una rutina de un referente («Al taller»). Se guarda con
 * «Guardar», por la API del laboratorio; cerrar con algo escrito pregunta.
 */

import { useMemo, useState } from "react";
import { Copy, ExternalLink, FlaskConical, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog, EmptyState, Field, Segmented, Select, TextArea, sePuedeDescartar } from "@/components/abp/ui";
import { MiniCampo, type JugadorLab } from "@/components/abp-lab/comun";
import type { GuardaLab } from "@/hooks/useAbpLab";
import { REFERENTES } from "@/lib/abp-lab/referentes";
import {
  DEFENSAS,
  ESTADOS,
  PAPELES,
  TIPOS,
  ZONAS,
  etiqueta,
  type Defensa,
  type Estado,
  type Lado,
  type Papel,
  type Rol,
  type Rutina,
  type Zona,
} from "@/lib/abp-lab/modelo";
import type { TipoAbp } from "@/lib/abp-lab/referentes";

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
  ...REFERENTES.flatMap((r) => [{ value: r.id, label: `${r.nombre} (${r.club})` }, ...r.rutinas.map((x) => ({ value: x.id, label: `· ${x.nombre}` }))]),
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

export function Taller({
  rutinas,
  jugadores,
  porId,
  guarda,
  ocupado,
  abierto,
  setAbierto,
}: {
  rutinas: Rutina[];
  jugadores: JugadorLab[];
  porId: Map<string, JugadorLab>;
  guarda: GuardaLab;
  ocupado: boolean;
  /** El borrador en el editor (lo abre también «Al taller» desde Referentes). */
  abierto: Borrador | null;
  setAbierto: (b: Borrador | null) => void;
}) {
  const [filtroTipo, setFiltroTipo] = useState<TipoAbp | "todos">("todos");

  const visibles = useMemo(() => rutinas.filter((r) => filtroTipo === "todos" || r.tipo === filtroTipo), [rutinas, filtroTipo]);

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
        <div className="flex flex-wrap items-center gap-2">
          {rutinas.length > 0 &&
            porEstado.map((e) => (
              <span key={e.key} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONO_ESTADO[e.key]}`}>
                {e.label} · {e.n}
              </span>
            ))}
          <Button tone="primary" icon={Plus} onClick={() => setAbierto(borradorVacio())}>
            Nueva rutina
          </Button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          title={rutinas.length ? "Ninguna rutina de este tipo" : "El taller está vacío"}
          description="Empieza una desde cero o lleva al taller una rutina de un referente: quién bloquea, quién remata, la señal y las variantes."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setAbierto({ ...r })}
              className="lab-aparece group min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left transition hover:-translate-y-0.5 hover:border-[#C8A96B]/50"
            >
              <div className="border-b border-white/10 bg-white/[0.02] px-3 pt-3">
                <MiniCampo roles={r.roles} porId={porId} alto={150} />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold text-white">{r.nombre}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TONO_ESTADO[r.estado]}`}>
                    {etiqueta(ESTADOS, r.estado)}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-white/50">
                  {etiqueta(TIPOS, r.tipo)} · {r.lado === "ofensivo" ? "a favor" : "en contra"} · {etiqueta(DEFENSAS, r.contra).toLowerCase()}
                  {r.senal ? ` · señal «${r.senal}»` : ""}
                </p>
                {r.inspiracion && <p className="mt-1 truncate text-[11px] text-[#C8A96B]">Inspirada en {nombreInspiracion(r.inspiracion)}</p>}
                {r.idea && <p className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-white/65">{r.idea}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {abierto && (
        <Editor
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
          onDuplicar={(b) => setAbierto({ ...b, id: undefined, nombre: `${b.nombre} (variante)`, estado: "idea" })}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EL EDITOR                                                          */
/* ------------------------------------------------------------------ */

function Editor({
  inicial,
  jugadores,
  porId,
  ocupado,
  onCerrar,
  onGuardar,
  onBorrar,
  onDuplicar,
}: {
  inicial: Borrador;
  jugadores: JugadorLab[];
  porId: Map<string, JugadorLab>;
  ocupado: boolean;
  onCerrar: () => void;
  onGuardar: (b: Borrador) => void;
  onBorrar?: () => void;
  onDuplicar: (b: Borrador) => void;
}) {
  const [b, setB] = useState<Borrador>(inicial);

  const sucio = JSON.stringify(b) !== JSON.stringify(inicial);

  const pon = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }));

  const papeles = PAPELES.filter((p) => p.lado === "ambos" || p.lado === b.lado);

  const ponRol = (i: number, cambio: Partial<Rol>) => setB((x) => ({ ...x, roles: x.roles.map((r, j) => (j === i ? { ...r, ...cambio } : r)) }));

  const opcionesJugador = [{ value: "", label: "Sin dueño" }, ...jugadores.map((j) => ({ value: j.id, label: `${j.dorsal ? `${j.dorsal} · ` : ""}${j.nombre}` }))];

  const cerrar = () => {
    if (sePuedeDescartar(sucio)) onCerrar();
  };

  return (
    <Dialog
      title={b.id ? b.nombre || "Rutina" : "Nueva rutina"}
      subtitle="Quién hace qué, dónde y con qué señal"
      onClose={onCerrar}
      sinGuardar={sucio}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {onBorrar && (
              <Button tone="danger" icon={Trash2} onClick={onBorrar} disabled={ocupado}>
                Borrar
              </Button>
            )}
            {b.id && (
              <Button icon={Copy} onClick={() => onDuplicar(b)}>
                Hacer una variante
              </Button>
            )}
            <a
              href="/abp-pizarra"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/70 transition hover:text-white"
            >
              <ExternalLink size={13} />
              Dibujarla en la pizarra
            </a>
          </div>
          <div className="flex gap-2">
            <Button icon={X} onClick={cerrar}>
              Cancelar
            </Button>
            <Button tone="primary" icon={Save} disabled={!b.nombre.trim() || ocupado} onClick={() => onGuardar(b)}>
              {ocupado ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0 space-y-4">
          <Field label="Nombre" value={b.nombre} onChange={(v) => pon("nombre", v)} placeholder="Paquete al segundo palo" autoFocus={!b.id} />

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
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Señal" value={b.senal} onChange={(v) => pon("senal", v)} placeholder="Mano a la cabeza" />
            <Select label="Inspirada en" value={b.inspiracion ?? ""} options={INSPIRACIONES} onChange={(v) => pon("inspiracion", v || undefined)} />
          </div>

          <TextArea label="La idea" value={b.idea} onChange={(v) => pon("idea", v)} rows={4} placeholder="Qué buscamos y en qué orden pasa" />

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">Variantes</span>
              <Button icon={Plus} onClick={() => pon("variantes", [...b.variantes, ""])} disabled={b.variantes.length >= 8}>
                Variante
              </Button>
            </div>
            <div className="space-y-2">
              {b.variantes.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-[11px] font-bold text-[#C8A96B]">{String.fromCharCode(65 + i)}</span>
                  <input
                    value={v}
                    onChange={(e) => pon("variantes", b.variantes.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="Si saltan al primer palo, al segundo"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#C8A96B]/50"
                  />
                  <button
                    type="button"
                    aria-label="Quitar variante"
                    onClick={() => pon("variantes", b.variantes.filter((_, j) => j !== i))}
                    className="rounded-lg p-1.5 text-white/40 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <MiniCampo roles={b.roles} porId={porId} alto={210} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">Quién hace qué</span>
            <Button
              icon={Plus}
              disabled={b.roles.length >= 14}
              onClick={() => pon("roles", [...b.roles, { jugador: "", papel: (b.lado === "ofensivo" ? "rematador" : "zonal") as Papel, zona: "centro" as Zona }])}
            >
              Papel
            </Button>
          </div>

          {b.roles.length === 0 && <p className="text-[12px] text-white/40">Añade lanzador, rematador, bloqueadores, señuelos y quién se queda para la segunda jugada.</p>}

          <div className="space-y-2">
            {b.roles.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                <div className="grid min-w-0 grid-cols-2 gap-2">
                  <div className="col-span-2 min-w-0">
                    <Select label="Jugador" value={r.jugador} options={r.jugador && !opcionesJugador.some((o) => o.value === r.jugador) ? [...opcionesJugador, { value: r.jugador, label: porId.get(r.jugador)?.nombre ?? r.jugador }] : opcionesJugador} onChange={(v) => ponRol(i, { jugador: v })} />
                  </div>
                  <Select label="Papel" value={r.papel} options={papeles.map((p) => ({ value: p.key, label: p.label }))} onChange={(v) => ponRol(i, { papel: v as Papel })} />
                  <Select label="Zona" value={r.zona} options={ZONAS.map((z) => ({ value: z.key, label: z.label }))} onChange={(v) => ponRol(i, { zona: v as Zona })} />
                </div>
                <button
                  type="button"
                  aria-label="Quitar papel"
                  onClick={() => pon("roles", b.roles.filter((_, j) => j !== i))}
                  className="self-start rounded-lg p-1.5 text-white/40 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {b.inspiracion && (
            <p className="flex items-center gap-1.5 text-[11.5px] text-[#C8A96B]">
              <FlaskConical size={12} />
              Inspirada en {nombreInspiracion(b.inspiracion)}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
