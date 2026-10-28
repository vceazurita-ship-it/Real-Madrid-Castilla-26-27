"use client";

/**
 * Mis tareas del microciclo (28/10/2026): la agenda de responsabilidades del
 * analista entre el último partido y el próximo, con lo hecho marcado. Sólo
 * la ve el administrador (la monta la portada). Lo marcado se guarda en
 * `agenda:responsabilidades`, por partido, para verlo igual en el móvil.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { useCalendario } from "@/hooks/useCalendario";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { alrededorDe } from "@/lib/castilla/calendario";
import { agendaSemana, cierreQuinielaAntesDe } from "@/lib/portada/agenda-semana";

type Hechas = Record<string, true>;

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const rotuloDia = (fecha: string) => {
  const d = new Date(`${fecha}T12:00:00Z`);

  return `${DIAS[d.getUTCDay()]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
};

export function MisTareas() {
  const { partidos } = useCalendario();

  const [hoy, setHoy] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setHoy(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" })), 0);

    return () => clearTimeout(id);
  }, []);

  const { value: hechas, setValue } = useRemoteDoc<Hechas>({ key: "agenda:responsabilidades", kind: "agenda", fallback: {} });

  const alrededor = useMemo(() => (hoy && partidos.length ? alrededorDe(partidos, Date.parse(`${hoy}T12:00:00`)) : null), [partidos, hoy]);

  const proximo = alrededor?.proximo ?? null;

  const dias = useMemo(
    () => (proximo ? agendaSemana(alrededor?.anterior?.cuando ?? null, proximo.cuando, cierreQuinielaAntesDe(proximo.cuando)) : []),
    [proximo, alrededor],
  );

  if (!proximo) return <p className="rounded-2xl border border-white/10 p-5 text-sm text-white/60">Cargando el calendario…</p>;

  const clave = (fecha: string, id: string) => `${proximo.cuando.slice(0, 10)}|${fecha}|${id}`;

  const total = dias.reduce((n, d) => n + d.tareas.length, 0);

  const hechasN = dias.reduce((n, d) => n + d.tareas.filter((t) => hechas[clave(d.fecha, t.id)]).length, 0);

  const hechaId = (id: string) => dias.some((d) => hechas[clave(d.fecha, id)]);

  const nombreDe = (id: string) => dias.flatMap((d) => d.tareas).find((t) => t.id === id)?.texto ?? id;

  const alterna = (k: string) => {
    const nuevo = { ...hechas };

    if (nuevo[k]) delete nuevo[k];
    else nuevo[k] = true;

    setValue(nuevo);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white">Mis tareas del microciclo</h2>
          <p className="text-sm text-white/60">
            Hasta el partido ante {proximo.rival} · {hechasN} de {total} hechas
          </p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#D8B45A]" style={{ width: `${total ? (hechasN / total) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dias.map((d) => {
          const esHoy = d.fecha === hoy;
          const pasado = hoy && d.fecha < hoy;

          return (
            <section key={d.fecha} className={`min-w-0 rounded-2xl border p-4 ${esHoy ? "border-[#D8B45A]/60 bg-[#D8B45A]/10" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-white">{rotuloDia(d.fecha)}</h3>
                <span className="text-xs font-semibold text-white/55">{esHoy ? `HOY · ${d.md}` : d.md}</span>
              </div>

              <ul className="space-y-1.5">
                {d.tareas.map((t) => {
                  const k = clave(d.fecha, t.id);
                  const hecha = Boolean(hechas[k]);

                  return (
                    <li key={t.id} className="flex min-w-0 items-start gap-2">
                      <button
                        type="button"
                        onClick={() => alterna(k)}
                        aria-pressed={hecha}
                        aria-label={hecha ? `Desmarcar ${t.texto}` : `Marcar ${t.texto} como hecha`}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${hecha ? "border-emerald-400 bg-emerald-500/80" : pasado ? "border-red-400/70" : "border-white/30"}`}
                      >
                        {hecha && <Check className="h-3.5 w-3.5 text-white" />}
                      </button>
                      <div className="min-w-0">
                        {t.href ? (
                          <Link href={t.href} className={`text-sm font-medium hover:underline ${hecha ? "text-white/45 line-through" : pasado ? "text-red-300" : "text-white/90"}`}>
                            {t.texto}
                          </Link>
                        ) : (
                          <span className="text-sm text-white/90">{t.texto}</span>
                        )}
                        <p className="text-xs text-white/50">{t.hecho}</p>
                        {!hecha && t.requiere && !hechaId(t.requiere) && <p className="text-xs text-amber-300">Antes: {nombreDe(t.requiere)}</p>}
                        {t.recortable && <p className="text-xs text-white/40">Recortable esta semana</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
