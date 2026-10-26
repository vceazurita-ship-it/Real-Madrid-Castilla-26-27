"use client";

/**
 * LA REVISIÓN DE LA SEMANA Y LO QUE DEJÓ EL PARTIDO (21/10/2026).
 *
 * Dos paneles que van encima de la rejilla de la semana:
 *
 * - **Revisión**: lo que miraría un entrenador de balón parado antes de cerrar
 *   el microciclo (`revisaSemana` en `lib/abp/semana-revision.ts`). Cada punto
 *   que habla de una tarea la abre de un toque, y lo urgente que no está en la
 *   semana se añade desde aquí.
 * - **Lo que dejó el partido**: sólo cuando ya se jugó. Lo trabajado contra lo
 *   que pasó en ese partido, aspecto por aspecto, y lo que no se trabajó y
 *   acabó en gol u ocasión.
 */

import { useState } from "react";
import { CheckCircle2, CircleAlert, Plus, TriangleAlert } from "lucide-react";

import { Panel } from "@/components/abp/ui";
import { LADO_COLOR, LADO_LABEL, fmtMin, type DiaKey, type Trabajo } from "@/lib/abp/microciclo";
import { chipInk } from "@/lib/theme";
import { enFrase } from "@/lib/abp/primera-plural";
import type { LecturaAspecto, LecturaPartido, PuntoRevision, TonoRevision } from "@/lib/abp/semana-revision";

const ICONO: Record<TonoRevision, { Icono: typeof CheckCircle2; clase: string; etiqueta: string }> = {
  alerta: { Icono: TriangleAlert, clase: "text-rose-300", etiqueta: "Hay que corregirlo" },
  aviso: { Icono: CircleAlert, clase: "text-amber-300", etiqueta: "Conviene mirarlo" },
  bien: { Icono: CheckCircle2, clase: "text-emerald-300", etiqueta: "Bien" },
};

export function RevisionSemana({
  puntos,
  onAbrir,
  onPlanificar,
}: {
  puntos: PuntoRevision[];
  onAbrir: (dia: DiaKey, trabajo: Trabajo) => void;
  onPlanificar: (falta: NonNullable<PuntoRevision["falta"]>) => void;
}) {
  const [todos, setTodos] = useState(false);

  if (!puntos.length) return null;

  const pendientes = puntos.filter((punto) => punto.tono !== "bien").length;

  /*
  | Por gravedad (21/10/2026): lo que hay que corregir, lo que conviene mirar y
  | lo que ya está bien, al final. Antes las cuatro tarjetas pesaban igual y la
  | correcta («MD-1 de repaso») iba entre las urgentes. Se enseñan las tres más graves
  | y el resto se pliega en «Ver N más»; el objetivo de minutos manda dentro de
  | su tono.
  */
  const orden: Record<TonoRevision, number> = { alerta: 0, aviso: 1, bien: 2 };
  const ordenados = [...puntos].sort(
    (a, b) => orden[a.tono] - orden[b.tono] || Number(b.id === "minutos") - Number(a.id === "minutos"),
  );
  const visibles = todos ? ordenados : ordenados.slice(0, 3);
  const ocultos = ordenados.length - visibles.length;

  return (
    <Panel
      title="Revisión de la semana"
      subtitle={
        pendientes
          ? `${pendientes} ${pendientes === 1 ? "cosa que mirar" : "cosas que mirar"} antes de cerrarla`
          : "Lista para cerrarla"
      }
      icon={pendientes ? CircleAlert : CheckCircle2}
    >
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visibles.map((punto) => {
          const { Icono, clase, etiqueta } = ICONO[punto.tono];

          const abre = punto.dia && punto.trabajo ? () => onAbrir(punto.dia as DiaKey, punto.trabajo as Trabajo) : null;

          return (
            <li
              key={punto.id}
              className="flex min-w-0 items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
            >
              <Icono size={15} className={`mt-0.5 shrink-0 ${clase}`} aria-label={etiqueta} />

              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold leading-snug text-white">{punto.titulo}</p>

                <p className="mt-0.5 text-[11.5px] leading-snug text-white/55">{punto.detalle}</p>

                {(abre || punto.falta) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {abre && (
                      <button
                        type="button"
                        onClick={abre}
                        className="rounded-lg border border-white/12 px-2 py-0.5 text-[10.5px] font-medium text-white/65 transition hover:border-white/25 hover:text-white"
                      >
                        Abrir la tarea
                      </button>
                    )}

                    {punto.falta && (
                      <button
                        type="button"
                        onClick={() => onPlanificar(punto.falta as NonNullable<PuntoRevision["falta"]>)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2 py-0.5 text-[10.5px] font-medium text-white/65 transition hover:border-white/25 hover:text-white"
                      >
                        <Plus size={10} aria-hidden />
                        Añadir a la semana
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Lo que no cabe en las tres primeras tarjetas va dentro de «Ver N más», con la misma tarjeta, no en líneas sueltas. */}
      {(ocultos > 0 || todos) && ordenados.length > 1 && (
        <button
          type="button"
          onClick={() => setTodos((antes) => !antes)}
          aria-expanded={todos}
          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/12 px-2.5 py-1 text-[11.5px] font-medium text-white/65 transition hover:border-white/25 hover:text-white"
        >
          {todos ? "Ver menos" : `Ver ${ocultos} más`}
        </button>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  LO QUE DEJÓ EL PARTIDO                                             */
/* ------------------------------------------------------------------ */

function Fila({ uno }: { uno: LecturaAspecto }) {
  const color = LADO_COLOR[uno.lado];

  const lectura = !uno.acciones
    ? "no salió en el partido"
    : `${uno.acciones} ${uno.acciones === 1 ? "acción" : "acciones"}, ${uno.peligro} con peligro${
        uno.lado === "defensivo" ? " suyo" : ""
      }${uno.goles ? ` · ${uno.goles} ${uno.goles === 1 ? "gol" : "goles"}` : ""}`;

  /*
  | Todas las filas cierran con un veredicto (21/10/2026), y con menos de cinco
  | acciones es una tendencia: va en gris y lo dice, no en color como si fuera
  | una conclusión.
  */
  const base =
    uno.veredicto === "bien"
      ? { texto: uno.lado === "ofensivo" ? "Dio peligro" : "Sin peligro suyo", clase: "text-emerald-300" }
      : uno.veredicto === "mal"
        ? { texto: uno.goles ? "Nos marcaron" : "Nos crearon peligro", clase: "text-rose-300" }
        : { texto: "No dio peligro", clase: "text-white/55" };

  const marca =
    uno.acciones > 0 && uno.acciones < 5 && !uno.goles
      ? { texto: `${base.texto} · pocos casos (${uno.acciones})`, clase: "text-white/45" }
      : base;

  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-white/[0.06] py-2 last:border-b-0">
      <span
        className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
        style={{ backgroundColor: `${color}1F`, color: chipInk(color) }}
      >
        {LADO_LABEL[uno.lado]}
      </span>

      <span className="min-w-0 flex-1 text-[12.5px] font-medium text-white">{uno.label}</span>

      {uno.minutos > 0 && (
        <span className="text-[11px] tabular-nums text-white/45">{fmtMin(Math.round(uno.minutos))} en la semana</span>
      )}

      <span className="text-[11.5px] tabular-nums text-white/65">{lectura}</span>

      <span className={`text-[11px] font-semibold ${marca.clase}`}>{marca.texto}</span>
    </li>
  );
}

const minutoDe = (minuto: number | null) => (minuto != null ? `, ${minuto}′` : "");

/**
 * Lo que dejó el partido en tres frases (21/10/2026): el resultado, los goles
 * a balón parado y qué buscábamos → qué pasó → qué nos deja. Antes enumeraba
 * («9 aspectos salieron en el partido: 2 salieron bien…») sin concluir.
 */
export function conclusionDelPartido(lectura: LecturaPartido, marcador: string | null) {
  const [favor, contra] = (marcador ?? "").split("-").map((n) => Number.parseInt(n, 10));

  const resultado =
    Number.isFinite(favor) && Number.isFinite(contra)
      ? `${favor > contra ? "Ganamos" : favor < contra ? "Perdimos" : "Empatamos"} ${favor}-${contra}.`
      : "";

  const aFavor = lectura.goles.filter((gol) => gol.lado === "ofensivo");
  const enContra = lectura.goles.filter((gol) => gol.lado === "defensivo");

  const lista = (goles: typeof lectura.goles) =>
    goles.map((gol) => `${enFrase(gol.label)}${minutoDe(gol.minuto)}`).join("; ");

  const goles = lectura.goles.length
    ? `A balón parado: ${[
        aFavor.length ? `${aFavor.length} a favor (${lista(aFavor)})` : "",
        enContra.length ? `${enContra.length} en contra (${lista(enContra)})` : "",
      ]
        .filter(Boolean)
        .join(" y ")}.`
    : lectura.acciones
      ? "Ningún gol a balón parado, ni a favor ni en contra."
      : "";

  /* Lo que más trabajamos y cómo acabó. */
  const principal = [...lectura.trabajado].sort((a, b) => b.minutos - a.minutos)[0];

  const comoAcabo = (uno: LecturaAspecto) =>
    uno.lado === "ofensivo"
      ? uno.goles
        ? `acabó en gol`
        : uno.peligro
          ? `dio peligro en ${uno.peligro} de ${uno.acciones}`
          : `no llegó a dar peligro (${uno.acciones} ${uno.acciones === 1 ? "acción" : "acciones"})`
      : uno.goles
        ? `nos costó un gol`
        : uno.peligro
          ? `nos crearon peligro en ${uno.peligro} de ${uno.acciones}`
          : `no nos crearon nada (${uno.acciones} ${uno.acciones === 1 ? "acción" : "acciones"})`;

  const buscabamos = principal
    ? `Lo que más trabajamos, ${enFrase(principal.label)} ${principal.lado === "ofensivo" ? "atacando" : "defendiendo"} (${fmtMin(Math.round(principal.minutos))}), ${comoAcabo(principal)}`
    : "";

  /* Lo que nos hizo daño: defendiendo con peligro suyo, trabajado o no. */
  const dano = [
    ...lectura.trabajado.filter((uno) => uno.veredicto === "mal"),
    ...lectura.sinTrabajar.filter((uno) => uno.lado === "defensivo"),
  ].filter((uno) => uno !== principal);

  const minutosDano = Math.round(dano.reduce((total, uno) => total + uno.minutos, 0));

  const nosDeja = dano.length
    ? `nos hicieron daño en ${dano
        .slice(0, 3)
        .map((uno) => enFrase(uno.label))
        .join(", ")
        .replace(/, ([^,]*)$/, " y $1")}, ${minutosDano ? `a lo que dimos ${fmtMin(minutosDano)}` : "que no estaba en la semana"}`
    : "";

  const deja = [buscabamos, nosDeja].filter(Boolean).join("; ");

  return {
    resultado,
    goles,
    deja: deja ? `${deja.replace(/^./, (letra) => letra.toUpperCase())}.` : "",
  };
}

export function LecturaDelPartido({
  lectura,
  rival,
  marcador,
}: {
  lectura: LecturaPartido;
  rival: string;
  marcador: string | null;
}) {
  if (!lectura.trabajado.length && !lectura.sinTrabajar.length && !lectura.noSalio.length) return null;

  const frase = conclusionDelPartido(lectura, marcador);

  const ambas = lectura.trabajado.length > 0 && lectura.sinTrabajar.length > 0;

  return (
    <Panel
      title="Lo que dejó el partido"
      subtitle={`${rival}${marcador ? ` · ${marcador}` : ""} · lo trabajado en la semana, en el partido`}
      icon={CheckCircle2}
    >
      {frase.resultado && (
        <p className="mb-1 text-[13px] font-semibold leading-snug text-white">{frase.resultado}</p>
      )}

      {frase.goles && <p className="mb-1 text-[12.5px] leading-snug text-white/75">{frase.goles}</p>}

      {frase.deja && <p className="mb-3 text-[12.5px] leading-snug text-white/75">{frase.deja}</p>}

      <div className={`grid gap-5 ${ambas ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" : ""}`}>
        {lectura.trabajado.length > 0 && (
          <div className="min-w-0">
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/40">Lo que trabajamos</p>

            <ul>
              {lectura.trabajado.map((uno) => (
                <Fila key={`${uno.aspecto}-${uno.lado}`} uno={uno} />
              ))}
            </ul>
          </div>
        )}

        {lectura.sinTrabajar.length > 0 && (
          <div className="min-w-0">
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/40">
              Lo que no estaba en la semana y dio peligro
            </p>

            <ul>
              {lectura.sinTrabajar.map((uno) => (
                <Fila key={`${uno.aspecto}-${uno.lado}`} uno={uno} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {lectura.noSalio.length > 0 && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-white/50">
          <span className="font-semibold text-white/70">Trabajado y sin acciones en el partido: </span>
          {lectura.noSalio.join(", ")}.
        </p>
      )}
    </Panel>
  );
}
