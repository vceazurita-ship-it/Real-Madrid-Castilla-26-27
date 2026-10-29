"use client";

/**
 * CÓMO VA LA JORNADA, DE UN VISTAZO.
 *
 * Una franja compacta (antes cuatro fichas; 29/10/2026) encima de los partidos. Existe porque el fin de
 * semana la pregunta no es «cuál es el ranking de la temporada» sino **qué está
 * pasando ahora**: si aún se puede apostar, cuántos partidos se han jugado,
 * quién va ganando la jornada y de cuándo son los números que se están mirando.
 *
 * Esa última es la que más se olvida y la que más engaña: un 3 de 9 no
 * significa lo mismo a las once de la noche del sábado —con seis por jugar—
 * que el lunes. Por eso se dice la hora y de dónde salen: los baja solos de
 * BeSoccer el trabajo nocturno, o los ha puesto alguien a mano.
 */

import { CalendarDays, CheckCircle2, Clock, Lock, RefreshCw, Trophy } from "lucide-react";

import { Avatar } from "@/components/quiniela/Avatar";
import { marcadorDe, type JornadaQuiniela } from "@/lib/quiniela/modelo";
import { PERSONA_POR_SLUG, nombreCorto } from "@/lib/quiniela/staff";

/** "hace 12 minutos", "hace 3 horas", "ayer". */
function hace(iso: string, ahora: Date) {
  const minutos = Math.round((ahora.getTime() - new Date(iso).getTime()) / 60000);

  if (!Number.isFinite(minutos) || minutos < 0) return "";

  if (minutos < 2) return "ahora mismo";

  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.round(minutos / 60);

  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.round(horas / 24);

  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «2026-10-25» -> { largo: "domingo 25", corto: "dom 25 oct" }. */
function diaDe(fecha: string) {
  const dia = new Date(`${fecha}T12:00:00Z`);

  if (Number.isNaN(dia.getTime())) return null;

  const nombre = DIAS[dia.getUTCDay()];

  return {
    largo: `${nombre} ${dia.getUTCDate()}`,
    corto: `${nombre.slice(0, 3)} ${dia.getUTCDate()} ${MESES[dia.getUTCMonth()]}`,
  };
}

/** «A», «A y B», «A, B y C». */
function enLista(nombres: string[]) {
  if (nombres.length <= 1) return nombres.join("");

  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/*
| Un dato de la franja (29/10/2026, análisis y marketing): las cuatro fichas
| ocupaban casi una pantalla en el móvil y cortaban el texto con puntos
| suspensivos («Se cierra el viernes 30 de…»). Ahora es una franja compacta
| donde cada dato es una frase completa que baja de línea si no cabe.
*/
function Dato({
  icono: Icono,
  tono = "normal",
  children,
}: {
  icono: typeof Clock;
  tono?: "normal" | "oro" | "aviso";
  children: React.ReactNode;
}) {
  /* Con la tinta del tema (19/10/2026): el oro y el amarillo claros, sobre la
     ficha del modo día, se quedaban en 1,9:1. Así oscurecen de día y siguen
     igual de noche. */
  const color =
    tono === "oro"
      ? "var(--rmcf-gold-ink)"
      : tono === "aviso"
        ? "color-mix(in srgb, rgb(245 158 11) 70%, rgb(var(--rmcf-ink-rgb)))"
        : undefined;

  return (
    <p className="flex min-w-0 items-start gap-1.5 text-[12.5px] leading-snug text-white/70">
      <Icono size={13} aria-hidden className="mt-0.5 shrink-0" style={color ? { color } : undefined} />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function EstadoJornada({
  jornada,
  numero,
  jugadores,
  partidos,
  cerrada,
  ultimasHoras,
  cuandoCierra: cierre,
  ahora,
  primerPartido,
}: {
  jornada: JornadaQuiniela;
  numero: number;
  jugadores: string[];
  /** Cuántos partidos tiene la jornada. */
  partidos: number;
  cerrada: boolean;
  ultimasHoras: boolean;
  cuandoCierra: string;
  ahora: Date;
  /** El primero que se juega: con 0 jugados es lo que cuenta la cuarta ficha. */
  primerPartido?: { fecha: string; local: string; visitante: string };
}) {
  const jugados = jornada.resultados.filter(Boolean).length;

  /* Quién va ganando la jornada, con los partidos que ya se han jugado. */
  const marcadores = jugadores
    .map((slug) => ({ slug, marcador: marcadorDe(jornada, slug) }))
    .sort((a, b) => b.marcador.aciertos - a.marcador.aciertos);

  const mejor = marcadores[0];

  const lideres = marcadores.filter(
    (uno) => mejor && uno.marcador.aciertos === mejor.marcador.aciertos,
  );

  /*
  | Cuántos han dejado su apuesta: es el otro «estado» que se pregunta.
  |
  | **Se cuenta con `puestos`, no con los pronósticos.** Antes del viernes el
  | servidor sólo manda el pronóstico de quien pregunta —de los demás manda
  | cuántos signos llevan— así que contando aquí salía siempre «1 de 10» y el
  | pie decía «faltan 9 por empezar» con la quiniela de todos ya rellena. El
  | panel de al lado, que sí usa `puestos`, decía lo contrario en la misma
  | pantalla.
  */
  const cuantosPuestos = (slug: string) =>
    jornada.puestos?.[slug] ?? (jornada.pronosticos[slug] ?? []).filter(Boolean).length;

  const completas = jugadores.filter((slug) => cuantosPuestos(slug) === partidos).length;

  /* Quién falta ya no se dice aquí (29/10/2026, marketing): sale una sola vez,
     en «Quién juega». La franja se queda con la cuenta y la barra. */

  const diaPrimero = primerPartido ? diaDe(primerPartido.fecha) : null;

  const cuando = jornada.resultadosEn ? hace(jornada.resultadosEn, ahora) : "";

  const deDonde =
    jornada.origenResultados === "besoccer"
      ? "BeSoccer"
      : jornada.origenResultados === "mano"
        ? "puestos a mano"
        : "";

  const nombreDe = (slug: string) => {
    const persona = PERSONA_POR_SLUG.get(slug);

    return persona ? nombreCorto(persona) : slug;
  };

  return (
    <div
      className={`flex min-w-0 flex-col gap-2 rounded-2xl border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 ${
        cerrada
          ? "border-white/10 bg-white/[0.03]"
          : ultimasHoras
            ? "border-amber-400/30 bg-amber-400/[0.05]"
            : "border-[#C8A96B]/30 bg-[#C8A96B]/[0.05]"
      }`}
    >
      {/* 1. El plazo: es lo que más se pregunta, va primero y entero. */}
      <Dato icono={cerrada ? Lock : Clock} tono={cerrada ? "normal" : ultimasHoras ? "aviso" : "oro"}>
        <strong className="font-semibold text-white">
          Jornada {numero} {cerrada ? "cerrada" : ultimasHoras ? "· hoy cierra" : "abierta"}
        </strong>
        {!cerrada && cierre ? ` · se cierra el ${cierre}` : ""}
      </Dato>

      {/* 2. Quién ha apostado: la cuenta y la barra, sin nombres. */}
      <Dato icono={CheckCircle2}>
        <span className="inline-flex items-center gap-2">
          <span>
            <strong className="font-semibold tabular-nums text-white">
              {completas}/{jugadores.length}
            </strong>{" "}
            {cerrada ? "apostaron" : "con la apuesta completa"}
          </span>
          <span className="inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
            <span
              className="h-full rounded-full bg-[#C8A96B]/80"
              style={{ width: `${(completas / Math.max(1, jugadores.length)) * 100}%` }}
            />
          </span>
        </span>
      </Dato>

      {/* 3. Los partidos jugados; con 0, cuándo empieza y cuál es el primero. */}
      {jugados === 0 ? (
        diaPrimero && primerPartido ? (
          <Dato icono={CalendarDays}>
            Empieza el {diaPrimero.largo}: {primerPartido.local} – {primerPartido.visitante}
          </Dato>
        ) : null
      ) : (
        <Dato icono={RefreshCw}>
          <strong className="font-semibold tabular-nums text-white">
            {jugados}/{partidos}
          </strong>{" "}
          jugados
          {cuando ? ` · actualizado ${cuando}${deDonde ? ` (${deDonde})` : ""}` : deDonde ? ` · ${deDonde}` : ""}
        </Dato>
      )}

      {/* Abierta, «Lo que ha puesto cada uno» ya no es una tarjeta vacía: es esta
          línea (29/10/2026, marketing). */}
      {!cerrada && (
        <Dato icono={Lock}>Lo que ha puesto cada uno se verá al cerrar</Dato>
      )}

      {/* 4. Quién va ganando la jornada, con la base. */}
      {jugados > 0 && mejor && mejor.marcador.aciertos > 0 && (
        <Dato icono={Trophy} tono="oro">
          {lideres.length === 1 ? (
            <span className="inline-flex items-center gap-1.5">
              <Avatar slug={lideres[0].slug} lado={18} />
              <span>
                Va ganando <strong className="font-semibold text-white">{nombreDe(lideres[0].slug)}</strong>
                {` · ${mejor.marcador.aciertos} de ${jugados}`}
              </span>
            </span>
          ) : lideres.length > 3 ? (
            `${lideres.length} empatados a ${mejor.marcador.aciertos} de ${jugados}`
          ) : (
            `En cabeza con ${mejor.marcador.aciertos} de ${jugados}: ${enLista(lideres.map((uno) => nombreDe(uno.slug)))}`
          )}
        </Dato>
      )}
    </div>
  );
}
