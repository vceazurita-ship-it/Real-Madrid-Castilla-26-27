"use client";

/*
|--------------------------------------------------------------------------
| EL DÍA DE LA SEMANA, A UN CLIC DESDE LA PORTADA (13/10/2026)
|--------------------------------------------------------------------------
|
| Al pinchar un día de la tira de la portada se abre esto, con dos pestañas:
|
|   - SESIÓN: las tareas de ese día en la hoja de registro, con lo que se
|     rellena después —tiempo, intensidad, evaluación y análisis post— para
|     ponerlo rápido. Se guarda reescribiendo el microciclo entero por el
|     mismo camino que el editor (`/api/registro`, `filasDelMicro`): editar
|     una fila suelta no existe en el script, y el micro se lee en vivo
|     justo antes, así que no se pisa nada. Para cambiar las tareas en sí,
|     «Editar la sesión completa» abre el editor con ese micro.
|   - SEGUIMIENTO: individual o grupal (varios jugadores, la misma fila en
|     cada uno), con la fecha del día puesta.
|
| Un día sin tareas abre en Seguimiento y ofrece crear el microciclo.
*/

import Link from "next/link";
import { CalendarDays, ClipboardList, ExternalLink, Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Dialog } from "@/components/abp/ui";
import { ValoracionTarea } from "@/components/registro/ValoracionTarea";
import { CamposCognitivos } from "@/components/registro/CamposCognitivos";
import { aplicaPropuesta, propuestaCognitiva } from "@/lib/registro/propuesta";
import type { RegistroTarea } from "@/lib/abp/registro";
import { SeguimientoRapido } from "@/components/seguimiento/SeguimientoRapido";
import { usePlayers } from "@/hooks/usePlayers";
import { loadRegistro } from "@/lib/abp/registro";
import { fechaIsoDeHoja, filasDelMicro, microDeFilas, revisaMicro, type MicroNuevo, type TareaNueva } from "@/lib/registro/hoja";

type Pestana = "sesion" | "seguimiento";

type Estado =
  | { fase: "cargando" }
  | { fase: "sin-sesion" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; micro: MicroNuevo; numero: number };

const CAMPO_NUM = "w-16 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center text-sm tabular-nums text-white outline-none focus:border-[#C8A96B]/50";

export function DiaRapido({ fecha, titulo, rotulo, onClose }: { fecha: string; titulo: string; rotulo: string; onClose: () => void }) {
  const [pestana, setPestana] = useState<Pestana>("sesion");
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [cambiado, setCambiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  /* Las tareas de la hoja: de ellas sale la propuesta de la demanda cognitiva. */
  const [historico, setHistorico] = useState<RegistroTarea[]>([]);
  const { players } = usePlayers();

  const jugadores = useMemo(
    () =>
      players
        .filter((p) => p.esCastilla && p.activo !== false)
        .map((p) => ({ id: p.id, nombre: p.apodo || p.nombre, foto: p.foto, posicion: p.posicion }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [players],
  );

  /* Qué micro tiene tareas ese día (CSV, con copia) y, si hay, el micro entero en vivo. */
  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const registro = await loadRegistro();

        if (vivo) setHistorico(registro.tareas);

        const delDia = registro.tareas.filter((t) => fechaIsoDeHoja(t.fecha) === fecha);

        if (!delDia.length) {
          if (vivo) {
            setEstado({ fase: "sin-sesion" });
            setPestana("seguimiento");
          }

          return;
        }

        const { micro: numero, temporada, rival } = delDia[0];
        const r = await fetch("/api/registro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "filas", micro: numero, temporada }),
        });
        const datos = (await r.json()) as { ok?: boolean; error?: string; filas?: Record<string, unknown>[] };

        if (!r.ok || !datos.ok || !Array.isArray(datos.filas) || !datos.filas.length) throw new Error(datos.error ?? "La hoja no ha devuelto el microciclo.");

        if (vivo) setEstado({ fase: "lista", numero, micro: microDeFilas(datos.filas, { temporada, micro: numero, rival }) });
      } catch (error) {
        if (vivo) setEstado({ fase: "error", mensaje: error instanceof Error ? error.message : "No se ha podido leer la hoja." });
      }
    })();

    return () => {
      vivo = false;
    };
  }, [fecha]);

  const sesion = estado.fase === "lista" ? estado.micro.sesiones.find((s) => s.fecha === fecha) ?? null : null;

  /* La propuesta de cada tarea del día, según lo que la define (formato, tipo, contenidos, fase). */
  const rasgos = (sesion?.tareas ?? []).map((t) => [t.formato, t.tipoTarea, t.contenidoPrincipal, t.contenidoSecundario, t.fase].join("|")).join("~");
  const propuestas = useMemo(
    () => (sesion?.tareas ?? []).map((t) => (historico.length ? propuestaCognitiva(t, historico) : null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se rehace cuando cambian los rasgos, no con cada número
    [rasgos, historico],
  );

  const cambiaTarea = (indice: number, cambio: Partial<TareaNueva>) => {
    if (estado.fase !== "lista") return;

    setCambiado(true);
    /* Sobre el estado de ese momento: «Usar la propuesta en todas» cambia varias tareas seguidas. */
    setEstado((actual) =>
      actual.fase !== "lista"
        ? actual
        : {
            ...actual,
            micro: {
              ...actual.micro,
              sesiones: actual.micro.sesiones.map((s) => (s.fecha !== fecha ? s : { ...s, tareas: s.tareas.map((t, i) => (i === indice ? { ...t, ...cambio } : t)) })),
            },
          },
    );
  };

  const guarda = async () => {
    if (estado.fase !== "lista") return;

    const problemas = revisaMicro(estado.micro, { permitirRepetidas: true });

    if (problemas.length) return void toast.error("No se puede guardar", { description: problemas.join(" ") });

    setGuardando(true);

    const aviso = toast.loading("Guardando la sesión en la hoja…");

    try {
      const r = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporada: estado.micro.temporada, micro: estado.micro.micro, rival: estado.micro.rival, reemplazar: true, filas: filasDelMicro(estado.micro) }),
      });
      const datos = (await r.json()) as { ok?: boolean; error?: string; escritas?: number };

      if (!r.ok || !datos.ok) throw new Error(datos.error ?? `HTTP ${r.status}`);

      setCambiado(false);
      toast.success("Sesión guardada", { id: aviso, description: "La hoja tarda unos minutos en refrescar lo que leen las pantallas." });
    } catch (error) {
      toast.error("No se ha podido guardar", { id: aviso, description: error instanceof Error ? error.message : "Inténtalo otra vez" });
    } finally {
      setGuardando(false);
    }
  };

  const pie =
    pestana === "sesion" && estado.fase === "lista" ? (
      <>
        <Link href={`/laboratorio/microciclo?micro=${estado.numero}`} className="mr-auto inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-[#C8A96B]">
          <ExternalLink size={13} aria-hidden /> Editar la sesión completa
        </Link>
        <button
          type="button"
          onClick={guarda}
          disabled={!cambiado || guardando}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-[#0B0F14] transition disabled:opacity-50"
          style={{ background: "#C8A96B" }}
        >
          {guardando ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
          {cambiado ? "Guardar la sesión" : "Sin cambios"}
        </button>
      </>
    ) : undefined;

  return (
    <Dialog title={titulo} subtitle={`${rotulo}${estado.fase === "lista" ? ` · microciclo ${estado.numero}` : ""}`} onClose={onClose} footer={pie} sinGuardar={cambiado}>
      <div className="mb-4 flex gap-1 rounded-xl border border-white/10 p-1 text-sm" role="tablist">
        {(
          [
            ["sesion", "Sesión", ClipboardList],
            ["seguimiento", "Seguimiento", Users],
          ] as const
        ).map(([clave, texto, Icono]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            onClick={() => setPestana(clave)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 transition ${pestana === clave ? "bg-[#C8A96B]/20 font-semibold text-[#C8A96B]" : "text-white/55 hover:text-white"}`}
          >
            <Icono size={14} aria-hidden /> {texto}
          </button>
        ))}
      </div>

      {pestana === "seguimiento" ? (
        <SeguimientoRapido fecha={fecha} jugadores={jugadores} />
      ) : estado.fase === "cargando" ? (
        <p className="flex items-center gap-2 py-8 text-sm text-white/55">
          <Loader2 size={15} className="animate-spin" aria-hidden /> Leyendo la sesión de la hoja…
        </p>
      ) : estado.fase === "error" ? (
        <p className="py-6 text-sm text-rose-300">No se ha podido leer la sesión: {estado.mensaje}</p>
      ) : estado.fase === "sin-sesion" || !sesion || !sesion.tareas.length ? (
        <div className="py-6 text-sm text-white/60">
          <p className="flex items-center gap-2">
            <CalendarDays size={15} aria-hidden /> Ese día no tiene tareas en la hoja de registro.
          </p>
          <Link href="/laboratorio/microciclo" className="mt-3 inline-flex items-center gap-1.5 text-[#C8A96B] hover:underline">
            <ExternalLink size={13} aria-hidden /> Crear o editar el microciclo
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {propuestas.some(Boolean) && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => sesion.tareas.forEach((t, i) => propuestas[i] && !/-COMP$/i.test(t.tarea) && cambiaTarea(i, aplicaPropuesta(t, propuestas[i]!)))}
                className="rounded-full border border-[#C8A96B]/40 px-3 py-1 text-[11px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/15"
                title="Rellena con la propuesta los campos de demanda cognitiva que estén vacíos, en todas las tareas del día"
              >
                Usar la propuesta en todas
              </button>
            </div>
          )}
          {sesion.tareas.map((t, i) =>
            /-COMP$/i.test(t.tarea) ? null : (
              <div key={`${t.tarea}-${i}`} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-xs font-semibold text-[#C8A96B]">{t.tarea}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                    {t.tipoTarea || "Sin tipo"}
                    {t.contenidoPrincipal ? <span className="text-white/45"> · {t.contenidoPrincipal}</span> : null}
                  </span>
                  <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-white/40">
                    Tiempo
                    <input type="number" min={0} value={t.tiempo || ""} onChange={(e) => cambiaTarea(i, { tiempo: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className={CAMPO_NUM} />
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-white/40">
                    Int.
                    <input type="number" min={0} max={10} value={t.intensidad || ""} onChange={(e) => cambiaTarea(i, { intensidad: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className={CAMPO_NUM} />
                  </label>
                </div>
                <div className="mt-2.5">
                  <CamposCognitivos tarea={t} propuesta={propuestas[i] ?? null} onCambia={(cambio) => cambiaTarea(i, cambio)} />
                </div>
                <div className="mt-2.5">
                  <ValoracionTarea extra={t.extra} onCambia={(extra) => cambiaTarea(i, { extra })} />
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </Dialog>
  );
}
