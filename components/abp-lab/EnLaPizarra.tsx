"use client";

/**
 * «En la pizarra»: las jugadas que usamos de verdad, en el laboratorio
 * (25/10/2026).
 *
 * Las rutinas que se traen de la pizarra de ABP (`/abp-pizarra`, botón «Abrir
 * en el laboratorio») viven aquí con su origen —jornada, rival, diapositiva—
 * y con lo que dice la pizarra de ellas hoy: si siguen igual, si alguien las
 * ha cambiado allí, si se sustituyeron desde aquí o si ya no están. Se abren
 * en el mismo estudio que el resto (escena, simulación, xG, variantes,
 * comparador, exportar) y vuelven a la pizarra con «Enviar a la pizarra».
 *
 * La conversión es `lib/abp-lab/puente-pizarra.ts`; el paso de mano entre
 * pestañas, `lib/abp-lab/puente-envio.ts`. Aquí no se escribe la pizarra.
 */

import { useMemo, useState } from "react";
import { ArrowDownToLine, CheckCircle2, LayoutTemplate, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/abp/ui";
import type { GuardaLab } from "@/hooks/useAbpLab";
import type { SlidePizarra, TableroPizarra } from "@/lib/abp/pizarra";
import type { Rutina } from "@/lib/abp-lab/modelo";
import { dejaRecado } from "@/lib/abp-lab/puente-envio";
import { estadoEnPizarra, fusionaDesdePizarra, huellaSlide, rutinaDeSlide, sinJugador, slideDeRutina, type EntradaPizarra, type EstadoEnPizarra, type RutinaPuente } from "@/lib/abp-lab/puente-pizarra";

const fecha = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

/** «J07 · Teruel · 18/10». */
export function rotuloOrigen(o: NonNullable<Rutina["origen"]>) {
  return [o.jornada ? `J${o.jornada.padStart(2, "0")}` : "", o.rival, o.fecha ? fecha(o.fecha) : ""].filter(Boolean).join(" · ");
}

/** La rutina que sale de una diapositiva: la ya traída (por el sello de la diapositiva o por su origen) o ninguna. */
export function yaTraida(rutinas: Rutina[], partidoId: string, slide: SlidePizarra) {
  const porSello = slide.laboratorio?.rutinaId ? rutinas.find((r) => r.id === slide.laboratorio?.rutinaId) : undefined;

  return porSello ?? rutinas.find((r) => !r.padre && r.origen?.partidoId === partidoId && r.origen.slideId === slide.id);
}

/**
 * Trae una diapositiva al laboratorio y devuelve la rutina que hay que abrir.
 *
 * Si ya estaba, no se duplica: si la diapositiva no ha cambiado se abre la
 * que hay; si ha cambiado, se pregunta y se traen los cambios conservando lo
 * que sólo tiene el laboratorio (`fusionaDesdePizarra`).
 */
export async function traeDeLaPizarra(rutinas: Rutina[], guarda: GuardaLab, entrada: EntradaPizarra): Promise<Rutina | null> {
  const nueva = rutinaDeSlide(entrada);

  const existente = yaTraida(rutinas, entrada.partidoId, entrada.slide);

  if (existente) {
    if (existente.pizarra?.huella === nueva.pizarra?.huella) {
      toast.info("Ya estaba en el laboratorio", { description: existente.nombre });

      return existente;
    }

    if (!window.confirm(`«${existente.nombre}» ya está en el laboratorio y la diapositiva ha cambiado en la pizarra.\n\n¿Traer los cambios? Se quedan su nombre, su estado, sus variantes y lo que hayas escrito de cada papel.\n\n(Cancelar abre la que ya tienes.)`)) return existente;

    const doc = await guarda({ accion: "rutina-guarda", rutina: fusionaDesdePizarra(existente, nueva) });

    toast.success("Traídos los cambios de la pizarra");

    return doc.rutinas.find((r) => r.id === existente.id) ?? null;
  }

  const doc = await guarda({ accion: "rutina-guarda", rutina: nueva });

  toast.success("En el laboratorio", { description: `${nueva.nombre}: ya puedes simularla, compararla y hacerle variantes.` });

  return doc.rutinas.find((r) => !r.padre && r.origen?.partidoId === entrada.partidoId && r.origen.slideId === entrada.slide.id) ?? null;
}

/** Deja la rutina como recado para la pizarra y la abre en otra pestaña. */
export function enviaALaPizarra(r: RutinaPuente) {
  const ahora = new Date().toISOString();

  const token = dejaRecado({
    tipo: "envio",
    creado: ahora,
    ...(r.id ? { rutinaId: r.id } : {}),
    nombre: r.nombre.trim() || "Rutina del laboratorio",
    slide: slideDeRutina(r, { ahora }),
    ...(r.origen ? { destino: { partidoId: r.origen.partidoId, slideId: r.origen.slideId } } : {}),
    ...(r.pizarra?.huella ? { huellaOrigen: r.pizarra.huella } : {}),
    ...(r.padre ? { variante: true } : {}),
    sinJugador: sinJugador(r),
  });

  if (!token) {
    toast.error("Este navegador no deja pasar la jugada a la pizarra", { description: "Suele ser el modo privado: ábrelo en una ventana normal." });

    return;
  }

  window.open(`/abp-pizarra?desdeLab=${token}`, "_blank", "noopener");
}

/* ------------------------------------------------------------------ */
/*  EL ESTADO EN LA PIZARRA                                            */
/* ------------------------------------------------------------------ */

const TONO: Record<EstadoEnPizarra["estado"], string> = {
  igual: "bg-emerald-400/15 text-emerald-300",
  enviada: "bg-sky-400/15 text-sky-300",
  cambiada: "bg-amber-400/15 text-amber-300",
  fuera: "bg-white/10 text-white/55",
  variante: "bg-[#C8A96B]/15 text-[#C8A96B]",
  desconocido: "bg-white/10 text-white/55",
};

export function textoEstado(e: EstadoEnPizarra) {
  switch (e.estado) {
    case "igual":
      return "En la pizarra";
    case "enviada":
      return `Enviada desde aquí el ${fecha(e.enviada)}`;
    case "cambiada":
      return "Cambiada en la pizarra";
    case "fuera":
      return "Ya no está en la pizarra";
    case "variante":
      return "Variante · aún no en la pizarra";
    default:
      return "Leyendo la pizarra…";
  }
}

export function ChipPizarra({ estado }: { estado: EstadoEnPizarra }) {
  return <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TONO[estado.estado]}`}>{textoEstado(estado)}</span>;
}

/* ------------------------------------------------------------------ */
/*  LA CABECERA DE LA SECCIÓN: QUÉ ES Y TRAER MÁS                      */
/* ------------------------------------------------------------------ */

export function CabeceraEnLaPizarra({
  rutinas,
  tableros,
  error,
  ocupado,
  onTrae,
  onRecarga,
}: {
  rutinas: Rutina[];
  tableros: Record<string, TableroPizarra> | null;
  error: boolean;
  ocupado: boolean;
  onTrae: (partidoId: string, tablero: TableroPizarra, slide: SlidePizarra) => void;
  onRecarga: () => void;
}) {
  /* Las jornadas con algo montado, la más reciente primero. */
  const jornadas = useMemo(
    () =>
      Object.entries(tableros ?? {})
        .filter(([, t]) => t.slides.some((s) => s.fichas.length))
        .map(([id, t]) => ({ id, t, cuando: (t.versiones ?? []).reduce((m, v) => (v.creada > m ? v.creada : m), t.actualizado ?? "") }))
        .sort((a, b) => b.cuando.localeCompare(a.cuando)),
    [tableros],
  );

  const [elegida, setElegida] = useState("");

  const jornada = jornadas.find((j) => j.id === elegida) ?? jornadas[0];

  const enUso = rutinas.filter((r) => r.origen && !r.padre).length;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" aria-label="Traer jugadas de la pizarra">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">
            <LayoutTemplate size={12} />
            Nuestras jugadas en uso · {enUso}
          </p>
          <p className="mt-1 max-w-3xl text-[13px] leading-snug text-white/70">
            Las acciones de la pizarra de ABP, con todo el laboratorio: escena 3D, simulación contra su defensa, xG, variantes y comparador. Haz variantes y alternativas aquí y devuélvelas con <strong className="font-semibold text-white/85">Enviar a la pizarra</strong>, como diapositiva nueva o sustituyendo la que está.
          </p>
        </div>
        <Button icon={RefreshCw} onClick={onRecarga} title="Volver a leer la pizarra">
          <span className="hidden sm:inline">Releer la pizarra</span>
        </Button>
      </div>

      {error ? (
        <p className="mt-3 text-[12.5px] text-amber-300/90">No se ha podido leer la pizarra: lo de aquí sigue, pero no se sabe si ha cambiado allí.</p>
      ) : !tableros ? (
        <p className="mt-3 text-[12.5px] text-white/45">Leyendo la pizarra…</p>
      ) : jornadas.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-white/45">La pizarra todavía no tiene ninguna diapositiva con jugadores.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block max-w-md">
            <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/45">Traer de la pizarra</span>
            <select
              value={jornada?.id ?? ""}
              onChange={(e) => setElegida(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/85 outline-none focus:border-[#C8A96B]/50"
            >
              {jornadas.map((j) => (
                <option key={j.id} value={j.id} className="bg-[#11161C]">
                  {[j.t.jornada ? `J${j.t.jornada.padStart(2, "0")}` : "", j.t.rival || "Sin rival"].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </label>

          {jornada && (
            <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {jornada.t.slides.map((s, i) => {
                const traida = yaTraida(rutinas, jornada.id, s);

                const igual = traida?.pizarra?.huella === huellaSlide(s);

                const vacia = !s.fichas.length;

                return (
                  <li key={s.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-white/85">
                        {i + 1}. {s.titulo}
                      </span>
                      <span className="block truncate text-[11px] text-white/45">
                        {vacia ? "Sin jugadores" : traida ? (igual ? "Ya en el laboratorio" : "En el laboratorio · ha cambiado aquí") : `${s.fichas.length} jugadores`}
                      </span>
                    </span>
                    {traida && igual ? (
                      <CheckCircle2 size={15} className="shrink-0 text-emerald-300" aria-label="Ya en el laboratorio" />
                    ) : (
                      <Button icon={ArrowDownToLine} disabled={vacia || ocupado} onClick={() => onTrae(jornada.id, jornada.t, s)} aria-label={`Traer ${s.titulo}`}>
                        {traida ? "Actualizar" : "Traer"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export { estadoEnPizarra };
