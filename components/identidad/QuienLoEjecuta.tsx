"use client";

/*
| 13/11/2026: «¿Quién lo ejecuta mejor?» en /identidad-posicional. Todos los
| jugadores de campo del Castilla (450′ de liga o más) ordenados por cómo
| cumplen los contenidos medidos del puesto elegido, contra los jugadores de
| ESE puesto en la categoría. Cada fila dice si es su puesto («natural») o no
| («otro puesto») y cuánto le saca o le falta al mejor especialista.
| El cálculo vive en `quienLoEjecutaMejor` (lib/identidad/campo.ts).
*/

import Link from "next/link";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/knowledge-kit";
import { MINUTOS_CONTENIDO, NOMBRE_PUESTO, type QuienLoEjecuta } from "@/lib/identidad/campo";

type Nombre = { corto: string; nombre: string };

const PLURAL: Record<string, string> = {
  CEN: "centrales",
  LAT: "laterales",
  MED: "centrocampistas",
  BAN: "extremos",
  DEL: "delanteros",
};

const signo = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : "0");

export function QuienLoEjecutaVista({
  datos,
  cargando,
  nombreDe,
}: {
  datos: QuienLoEjecuta | null;
  cargando: boolean;
  /** Del nombre de Wyscout al de la plantilla (corto para la fila, completo para el enlace). */
  nombreDe: (wyscout: string) => Nombre;
}) {
  if (cargando) {
    return <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-gray-500">Cargando las cifras de liga…</p>;
  }

  if (!datos || datos.filas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-gray-500">
        Este puesto no tiene al menos dos contenidos que se midan en el partido, o ningún jugador nuestro llega a {MINUTOS_CONTENIDO}′
        con cifra en todos.
      </p>
    );
  }

  const plural = PLURAL[datos.puesto] ?? "jugadores del puesto";
  const especialista = datos.mejorEspecialista;
  const porEncima = especialista ? datos.filas.filter((f) => !f.natural && f.encaje > especialista.encaje) : [];
  const etiquetaDe = new Map(datos.contenidos.map((c) => [c.columna, c.texto.replace(/\.$/, "")]));

  return (
    <section aria-label="¿Quién lo ejecuta mejor?" className="min-w-0">
      <p className="break-words text-sm text-gray-300">
        Cada jugador de campo del Castilla con {MINUTOS_CONTENIDO}′ o más de liga, medido contra los {datos.n} {plural} de la
        categoría en los {datos.contenidos.length} contenidos medibles del puesto. La cifra es la media de sus percentiles (0-100,
        más es mejor; 50 = la mediana del puesto).
      </p>

      {especialista && (
        <p className="mt-3 break-words border-l-2 border-amber-400/70 pl-3 text-sm text-gray-200">
          {porEncima.length > 0 ? (
            <>
              <span className="font-semibold text-white">
                {porEncima.length === 1 ? "Uno de otro puesto" : `${porEncima.length} de otro puesto`} por encima del mejor especialista
              </span>{" "}
              ({nombreDe(especialista.nombre).corto}, {especialista.encaje}):{" "}
              {porEncima.map((f) => `${nombreDe(f.nombre).corto} (${NOMBRE_PUESTO[f.puestoNatural].toLowerCase()}, ${f.encaje})`).join(", ")}.
            </>
          ) : (
            <>
              <span className="font-semibold text-white">Nadie de otro puesto supera al mejor especialista</span> (
              {nombreDe(especialista.nombre).corto}, {especialista.encaje}).
            </>
          )}
        </p>
      )}

      <ol className="mt-5 space-y-2">
        {datos.filas.map((f, i) => {
          const n = nombreDe(f.nombre);
          const esElMejor = especialista && f.natural && f.nombre === especialista.nombre;

          return (
            <li key={f.nombre} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-gray-500">{i + 1}.</span>
                <Link
                  href={`/individual?nombre=${encodeURIComponent(n.nombre)}&pestana=mejora`}
                  className={cn("min-w-0 break-words text-sm font-semibold text-white hover:underline", focusRing)}
                >
                  {n.corto}
                </Link>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    f.natural ? "bg-[#C8A96B]/15 text-[#C8A96B]" : "bg-sky-400/15 text-sky-300",
                  )}
                >
                  {f.natural ? "natural" : `otro puesto · ${NOMBRE_PUESTO[f.puestoNatural].toLowerCase()}`}
                </span>
                <span className="text-xs tabular-nums text-gray-500">{f.minutos.toLocaleString("es-ES")}′</span>

                <span className="ml-auto flex items-center gap-3">
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      esElMejor || f.diferencia === null
                        ? "text-gray-400"
                        : f.diferencia > 0
                          ? "font-semibold text-emerald-400"
                          : f.diferencia < 0
                            ? "text-amber-400"
                            : "text-gray-300",
                    )}
                  >
                    {esElMejor ? "mejor especialista" : f.diferencia === null ? "sin especialista" : `${signo(f.diferencia)} vs el mejor especialista`}
                  </span>
                  <span className="w-8 text-right text-lg font-bold tabular-nums text-white">{f.encaje}</span>
                </span>
              </div>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                <div
                  className={cn("h-full rounded-full", f.natural ? "bg-[#C8A96B]" : "bg-sky-400")}
                  style={{ width: `${Math.max(2, f.encaje)}%` }}
                />
              </div>

              <p className="mt-1.5 break-words text-[11px] leading-relaxed text-gray-400">
                {f.rasgos.map((r) => `${etiquetaDe.get(r.columna) ?? r.columna} ${r.percentil}`).join(" · ")}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 break-words text-xs text-gray-500">
        Fuente: Wyscout, liga de esta temporada. El puesto «natural» es la primera demarcación que le da Wyscout. Sólo entra quien
        tiene cifra en todos los contenidos medidos; los porteros no entran.
      </p>
    </section>
  );
}
