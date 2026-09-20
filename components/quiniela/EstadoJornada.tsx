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

import { CheckCircle2, Clock, Lock, RefreshCw, Trophy } from "lucide-react";

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
  const color =
    tono === "oro" ? "#C8A96B" : tono === "aviso" ? "rgb(252 211 77)" : undefined;

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

  const apostaron = jugadores.filter((slug) => cuantosPuestos(slug) > 0).length;

  const completas = jugadores.filter((slug) => cuantosPuestos(slug) === partidos).length;

  const cuando = jornada.resultadosEn ? hace(jornada.resultadosEn, ahora) : "";

  const deDonde =
    jornada.origenResultados === "besoccer"
      ? "de BeSoccer, solo"
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
        pie={cerrada ? "Las apuestas ya no se tocan" : `Se cierra el ${cierre}`}
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
        pie={
          completas === jugadores.length
            ? "Todos con la suya completa"
            : apostaron > completas
              ? `${apostaron - completas} la tienen a medias`
              : `Faltan ${jugadores.length - apostaron} por empezar`
        }
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
            ? cerrada
              ? "Todavía no ha rodado el balón"
              : "Se juegan el fin de semana"
            : [cuando, deDonde].filter(Boolean).join(" · ")
        }
      >
        <span className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <span
            className="h-full rounded-full bg-emerald-400/70"
            style={{ width: `${(jugados / Math.max(1, partidos)) * 100}%` }}
          />
        </span>
      </Ficha>

      {/* 4. Quién va ganando. */}
      <Ficha
        icono={Trophy}
        rotulo="Va ganando"
        tono={jugados > 0 ? "oro" : "normal"}
        valor={
          jugados === 0 || !mejor || mejor.marcador.aciertos === 0 ? (
            <span className="text-base font-normal text-white/35">
              {jugados === 0 ? "Aún nada" : "Nadie ha acertado"}
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
          jugados === 0
            ? "Cuando haya resultados"
            : lideres.length > 1
              ? `Empatados ${lideres.length}, con ${mejor.marcador.aciertos} de ${jugados}`
              : `${mejor.marcador.aciertos} de ${jugados}`
        }
      />
    </div>
  );
}
