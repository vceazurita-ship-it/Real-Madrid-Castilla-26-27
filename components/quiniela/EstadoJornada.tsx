"use client";

/**
 * CÓMO VA LA JORNADA, DE UN VISTAZO.
 *
 * Una tira de cuatro fichas encima de los partidos. Existe porque el fin de
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

function Ficha({
  icono: Icono,
  rotulo,
  valor,
  pie,
  tono = "normal",
  children,
}: {
  icono: typeof Clock;
  rotulo: string;
  valor: React.ReactNode;
  pie?: string;
  tono?: "normal" | "oro" | "aviso";
  children?: React.ReactNode;
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
    <div
      className={`min-w-0 rounded-2xl border px-4 py-3.5 ${
        tono === "oro"
          ? "border-[#C8A96B]/35 bg-[#C8A96B]/[0.06]"
          : tono === "aviso"
            ? "border-amber-400/30 bg-amber-400/[0.05]"
            : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <p className="flex items-center gap-1.5 truncate text-[10px] uppercase tracking-[0.2em] text-white/40">
        <Icono size={11} aria-hidden />
        {rotulo}
      </p>

      <p
        className="mt-1.5 flex min-w-0 items-center gap-2 truncate text-[22px] font-semibold leading-tight tabular-nums"
        style={color ? { color } : undefined}
      >
        {valor}
      </p>

      {children}

      {pie && <p className="mt-1 truncate text-[11px] text-white/35">{pie}</p>}
    </div>
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

  /* Quién no ha acabado su apuesta, con nombre: «faltan 1» no decía quién. */
  const incompletos = jugadores
    .filter((slug) => cuantosPuestos(slug) < partidos)
    .map((slug) => {
      const persona = PERSONA_POR_SLUG.get(slug);

      return persona ? nombreCorto(persona) : slug;
    });

  const lista =
    incompletos.length > 3
      ? `${incompletos.slice(0, 2).join(", ")} y ${incompletos.length - 2} más`
      : enLista(incompletos);

  const pieApuestas =
    incompletos.length === 0
      ? "Todos con la suya completa"
      : cerrada
        ? incompletos.length === 1
          ? `${lista} no la completó`
          : `Sin completar: ${lista}`
        : incompletos.length === 1
          ? `Falta ${lista}`
          : `Faltan ${incompletos.length}: ${lista}`;

  const diaPrimero = primerPartido ? diaDe(primerPartido.fecha) : null;

  const cuando = jornada.resultadosEn ? hace(jornada.resultadosEn, ahora) : "";

  const deDonde =
    jornada.origenResultados === "besoccer"
      ? "BeSoccer"
      : jornada.origenResultados === "mano"
        ? "puestos a mano"
        : "";

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1. El plazo. */}
      <Ficha
        icono={cerrada ? Lock : Clock}
        rotulo={`Jornada ${numero}`}
        valor={cerrada ? "Cerrada" : ultimasHoras ? "Hoy cierra" : "Abierta"}
        tono={cerrada ? "normal" : ultimasHoras ? "aviso" : "oro"}
        pie={
          cerrada
            ? `${completas} de ${jugadores.length} han apostado: ya no se tocan`
            : `Se cierra el ${cierre}`
        }
      />

      {/* 2. Quién ha apostado. */}
      <Ficha
        icono={CheckCircle2}
        rotulo="Apuestas"
        valor={
          <>
            {completas}
            <span className="text-base font-normal text-white/30">
              /{jugadores.length}
            </span>
          </>
        }
        pie={pieApuestas}
      >
        <span className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <span
            className="h-full rounded-full bg-[#C8A96B]/80"
            style={{ width: `${(completas / Math.max(1, jugadores.length)) * 100}%` }}
          />
        </span>
      </Ficha>

      {/* 3. Los partidos jugados. */}
      <Ficha
        icono={RefreshCw}
        rotulo="Partidos jugados"
        valor={
          <>
            {jugados}
            <span className="text-base font-normal text-white/30">/{partidos}</span>
          </>
        }
        pie={
          jugados === 0
            ? diaPrimero
              ? `Empieza el ${diaPrimero.largo}`
              : undefined
            : cuando
              ? `Actualizado ${cuando}${deDonde ? ` (${deDonde})` : ""}`
              : deDonde
        }
      >
        <span className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <span
            className="h-full rounded-full bg-emerald-400/70"
            style={{ width: `${(jugados / Math.max(1, partidos)) * 100}%` }}
          />
        </span>
      </Ficha>

      {/* 4. Quién va ganando; hasta el primer resultado, el primer partido. */}
      {jugados === 0 ? (
        diaPrimero && primerPartido ? (
          <Ficha
            icono={CalendarDays}
            rotulo="Primer partido"
            valor={diaPrimero.corto}
            pie={`${primerPartido.local} – ${primerPartido.visitante}`}
          />
        ) : null
      ) : (
      <Ficha
        icono={Trophy}
        rotulo={lideres.length > 1 ? "En cabeza" : "Va ganando"}
        tono="oro"
        valor={
          !mejor || mejor.marcador.aciertos === 0 ? (
            <span className="text-base font-normal text-white/35">
              Nadie ha acertado
            </span>
          ) : lideres.length > 1 ? (
            <span className="truncate text-[17px]">
              {lideres.length > 3
                ? `${lideres.length} empatados a ${mejor.marcador.aciertos}`
                : `Empate entre ${lideres.length}`}
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar slug={lideres[0].slug} lado={24} />

              <span className="truncate text-[17px]">
                {(() => {
                  const persona = PERSONA_POR_SLUG.get(lideres[0].slug);

                  return persona ? nombreCorto(persona) : lideres[0].slug;
                })()}
              </span>

              <span className="shrink-0 text-[17px]">
                {mejor.marcador.aciertos}
              </span>
            </span>
          )
        }
        pie={
          lideres.length > 1
            ? (() => {
                /* Con tantos empatados la lista de nombres no informa y el valor
                   ya dice el empate: el pie da la base, cuántos partidos van. */
                if (lideres.length > 3)
                  return `${jugados} de ${partidos} ${partidos === 1 ? "partido jugado" : "partidos jugados"}`;

                const nombres = lideres.slice(0, 3).map((lider) => {
                  const persona = PERSONA_POR_SLUG.get(lider.slug);

                  return persona ? nombreCorto(persona) : lider.slug;
                });
                const resto = lideres.length - nombres.length;

                return `Con ${mejor.marcador.aciertos} de ${jugados}: ${nombres.join(", ")}${resto > 0 ? ` y ${resto} más` : ""}`;
              })()
            :`${mejor.marcador.aciertos} de ${jugados}`
        }
      />
      )}
    </div>
  );
}
