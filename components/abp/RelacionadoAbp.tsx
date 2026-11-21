"use client";

/*
| LO QUE COMPLETA CADA PANTALLA DE BALÓN PARADO, A UN TOQUE (16/11/2026,
| jueces de la ronda 18).
|
| ABP ofensivo y defensivo y saque de banda ofensivo y defensivo abren en el
| último partido etiquetado, pero desde ahí no se llegaba ni al rival de ese
| partido ni al de la semana. Esta franja pone, con el rival ya elegido:
| - el rival del partido que se mira (oro): sus goles en vídeo, su ABP, el
|   plan de aquel partido y la pantalla hermana (ataque ↔ defensa);
| - el próximo rival (azul): su ABP, sus goles en vídeo, la pizarra de ABP
|   y el plan, y el microciclo de ABP de la semana.
| Y avisa si el último partido jugado (calendario de BeSoccer) aún no está
| en la hoja: el lunes no se puede leer la jornada anterior como la última.
|
| Las llaves: `?equipo=` para el ABP del rival y los goles, `?rival=ID` (hoja
| RIVALES) para el plan y la pizarra; sin ID, el enlace va pelado y la
| pantalla de destino abre en su próximo partido, como siempre.
| Lo que no se sabe (sin calendario, sin rival) no sale.
*/

import { useEsJugador } from "@/hooks/useRolPlataforma";
import { pantallaDeJugador } from "@/lib/acceso/rutas";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronRight, Film, ShieldHalf, Target } from "lucide-react";

import { useCalendario } from "@/hooks/useCalendario";
import { alrededorDe } from "@/lib/castilla/calendario";
import { nombreCorto } from "@/lib/abp/informe-graficos";
import { buscaJornada, cargaJornadas, enlaceAbpRival, enlacePlanDePartido, mismoEquipo, type JornadaRival } from "@/lib/abp/jornada";
import { BotonGolesEnVideo, type GolesEnVideo } from "@/components/rivals/BotonGolesEnVideo";
import { urlGolesDelEquipo } from "@/lib/rivals/goles-en-video";

export type PantallaAbp = "setpieces" | "setpieces_def" | "throw-ins" | "throw-ins-def";

const AZUL = "#4F8FE8";

const HERMANA: Record<PantallaAbp, { href: string; rotulo: string }> = {
  setpieces: { href: "/setpieces_def", rotulo: "Nuestro ABP defensivo" },
  setpieces_def: { href: "/setpieces", rotulo: "Nuestro ABP ofensivo" },
  "throw-ins": { href: "/throw-ins-def", rotulo: "Saque de banda defensivo" },
  "throw-ins-def": { href: "/throw-ins", rotulo: "Saque de banda ofensivo" },
};

const ofensiva = (p: PantallaAbp) => p === "setpieces" || p === "throw-ins";

/** «vie 20/11», en Madrid y sin reloj: la fecha la da BeSoccer tal cual. */
function fechaCorta(cuando: string) {
  const [a, m, d] = cuando.slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return "";
  const dia = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay()];
  return `${dia} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Con `goles`, el atajo abre el pop-up de los goles en vídeo (18/11/2026) en vez de ir a Análisis de goles. */
type Atajo = { href: string; texto: string; title: string; icono?: "video" | "abp" | "plan"; goles?: GolesEnVideo };

const CLASE_ATAJO =
  "inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-white/85 transition hover:bg-white/[0.08]";

function Atajos({ atajos: todos, color }: { atajos: Atajo[]; color: string }) {
  /* Los jugadores, sólo los atajos a pantallas que pueden abrir (18/11/2026): ni pizarra, ni microciclo, ni plan de partido. */
  const esJugador = useEsJugador();
  const atajos = esJugador ? todos.filter((a) => a.goles || pantallaDeJugador(a.href.split("?")[0])) : todos;
  if (!atajos.length) return null;
  return (
    <ul className="mt-2 flex min-w-0 flex-wrap gap-1.5">
      {atajos.map((a) => (
        <li key={a.href + a.texto} className="min-w-0">
          {a.goles ? (
            <BotonGolesEnVideo {...a.goles} title={a.title} className={CLASE_ATAJO}>
              <Film size={13} aria-hidden style={{ color }} />
              <span className="truncate">{a.texto}</span>
            </BotonGolesEnVideo>
          ) : (
          <Link href={a.href} title={a.title} className={CLASE_ATAJO}>
            {a.icono === "video" ? (
              <Film size={13} aria-hidden style={{ color }} />
            ) : a.icono === "abp" ? (
              <Target size={13} aria-hidden style={{ color }} />
            ) : a.icono === "plan" ? (
              <ShieldHalf size={13} aria-hidden style={{ color }} />
            ) : (
              <ChevronRight size={13} aria-hidden style={{ color }} />
            )}
            <span className="truncate">{a.texto}</span>
          </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function RelacionadoAbp({
  pantalla,
  rival,
  etiqueta,
  numeroEnHoja,
  marcado = false,
  className = "",
  compacto = false,
}: {
  pantalla: PantallaAbp;
  /** El rival del partido que se está mirando (vacío con varios rivales). */
  rival?: string;
  /** «Jornada 11», la del partido que se mira. */
  etiqueta?: string;
  /** El número de la última jornada de liga que tiene la hoja. */
  numeroEnHoja?: number | null;
  /** 17/11/2026 (ronda 19): la pantalla ve la temporada y este partido sólo va marcado. */
  marcado?: boolean;
  className?: string;
  /**
   * 20/11/2026 (ronda 7, ABP ofensivo, marketing): fila del próximo rival más
   * corta: su ABP se llama «Su ABP» (como en la del partido) y va primero, y
   * la pantalla hermana no se repite si ya está en la tarjeta del partido.
   */
  compacto?: boolean;
}) {
  const { partidos } = useCalendario();
  const [jornadas, setJornadas] = useState<JornadaRival[]>([]);

  /* Sólo para dar con el `ID` del rival (hoja RIVALES); si tarda o falla, los enlaces van pelados. */
  useEffect(() => {
    const ctrl = new AbortController();
    cargaJornadas(ctrl.signal)
      .then((lista) => setJornadas(lista))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, []);

  /*
  | 20/11/2026 (jueces, ronda 8): el próximo ya no es «el primero sin marcador».
  | Con una copia del calendario guardada en el aparato antes de que BeSoccer
  | apuntara el resultado, J11 seguía «sin jugar» el 20/11 y la tarjeta decía
  | Hércules en vez de Real Murcia. Ahora manda la fecha (hora de Madrid, tal
  | cual la da BeSoccer) con la misma regla que la portada: `alrededorDe`. El
  | reloj se apunta una vez, fuera del render.
  */
  const [ahora, setAhora] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0);
    return () => clearTimeout(id);
  }, []);

  const { proximo, ultimo } = useMemo(() => {
    if (!ahora) return { proximo: null, ultimo: null };
    const { proximo: sig, anterior } = alrededorDe(partidos, ahora);
    return { proximo: sig, ultimo: anterior };
  }, [partidos, ahora]);

  const of = ofensiva(pantalla);
  const banda = pantalla === "throw-ins" || pantalla === "throw-ins-def";

  const idDe = (nombre: string, cuando?: string) =>
    buscaJornada(jornadas, { rival: nombre, fecha: cuando?.slice(0, 10) }) ?? null;

  /* El partido que se mira: si es el último jugado, su fecha afina la fila de la hoja RIVALES. */
  const filaRival = rival ? idDe(rival, ultimo && mismoEquipo(ultimo.rival, rival) ? ultimo.cuando : undefined) : null;
  const filaProximo = proximo ? idDe(proximo.rival, proximo.cuando) : null;
  const proximoEsElMismo = Boolean(rival && proximo && mismoEquipo(rival, proximo.rival));

  const delPartido: Atajo[] = rival
    ? [
        {
          href: urlGolesDelEquipo(rival, of ? "contra" : "favor"),
          texto: of ? "▶ Cómo le marcan" : "▶ Sus goles en vídeo",
          title: of ? `Los goles que encaja ${nombreCorto(rival)}, en vídeo` : `Los goles que marca ${nombreCorto(rival)}, en vídeo`,
          icono: "video",
          goles: { equipo: rival, lado: of ? "contra" : "favor" },
        },
        { href: enlaceAbpRival(rival), texto: "Su ABP", title: `El balón parado de ${nombreCorto(rival)}: cómo ataca y cómo defiende`, icono: "abp" },
        ...(filaRival?.id
          ? [{ href: enlacePlanDePartido(filaRival), texto: "Plan de aquel partido", title: `El plan de partido contra ${nombreCorto(rival)}`, icono: "plan" as const }]
          : []),
        { href: HERMANA[pantalla].href, texto: HERMANA[pantalla].rotulo, title: "La otra mitad del balón parado del mismo partido" },
      ]
    : [{ href: HERMANA[pantalla].href, texto: HERMANA[pantalla].rotulo, title: "La otra mitad del balón parado" }];

  const conRival = (ruta: string) => (filaProximo?.id ? `${ruta}?rival=${encodeURIComponent(filaProximo.id)}` : ruta);

  const delProximo: Atajo[] = proximo
    ? [
        /* 20/11/2026 (jueces, ronda 4): desde el saque de banda, a SU saque de banda, no a córners y faltas. */
        banda
          ? {
              href: `${enlaceAbpRival(proximo.rival)}&vista=banda`,
              texto: "Su saque de banda",
              title: `Los saques de banda de ${nombreCorto(proximo.rival)}, por zona`,
              icono: "abp",
            }
          : {
              href: enlaceAbpRival(proximo.rival),
              texto: compacto ? "Su ABP" : of ? "Cómo defiende su ABP" : "Cómo ataca su ABP",
              title: `El balón parado de ${nombreCorto(proximo.rival)}`,
              icono: "abp",
            },
        {
          href: urlGolesDelEquipo(proximo.rival, of ? "contra" : "favor"),
          texto: of ? "▶ Cómo le marcan" : "▶ Sus goles en vídeo",
          title: of ? `Los goles que encaja ${nombreCorto(proximo.rival)}, en vídeo` : `Los goles que marca ${nombreCorto(proximo.rival)}, en vídeo`,
          icono: "video",
          goles: { equipo: proximo.rival, lado: of ? "contra" : "favor" },
        },
        { href: conRival("/abp-pizarra"), texto: "Pizarra ABP", title: `Las diapositivas de balón parado contra ${nombreCorto(proximo.rival)}` },
        /* 17/11/2026 (jueces, ronda 20): también desde el próximo rival, la otra mitad (ataque ↔ defensa). */
        { href: HERMANA[pantalla].href, texto: HERMANA[pantalla].rotulo, title: `La otra mitad del balón parado, para preparar a ${nombreCorto(proximo.rival)}` },
        { href: "/abp-microciclo", texto: banda ? "Microciclo · saque de banda" : "Microciclo ABP", title: "Qué se trabaja cada día de la semana a balón parado" },
        { href: conRival("/match-preparation"), texto: "Plan de partido", title: `El plan contra ${nombreCorto(proximo.rival)}`, icono: "plan" },
      ]
    : [];

  /* El último jugado que la hoja aún no tiene: se dice, para no leer la jornada anterior como la última. */
  const pendiente =
    ultimo && numeroEnHoja != null && ultimo.jornada > numeroEnHoja ? ultimo : null;

  if (!rival && !proximo) return null;

  return (
    <nav aria-label="Lo que completa esta pantalla" className={`min-w-0 space-y-2 ${className}`}>
      {pendiente ? (
        <p className="flex min-w-0 items-start gap-2 rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.07] px-3 py-2 text-[12px] leading-snug text-white/80">
          <CalendarClock size={14} className="mt-0.5 shrink-0" style={{ color: "var(--rmcf-gold-ink)" }} aria-hidden />
          <span className="min-w-0">
            La jornada {pendiente.jornada} ({nombreCorto(pendiente.rival)}, {fechaCorta(pendiente.cuando)}) ya se jugó y aún no está etiquetada en la hoja: lo último de liga que hay es
            la jornada {numeroEnHoja}.
          </span>
        </p>
      ) : null}

      <div className={`grid min-w-0 gap-2 ${proximo && !proximoEsElMismo && rival ? "lg:grid-cols-2" : ""}`}>
        {rival ? (
          <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3" style={{ borderLeft: "3px solid #C8A96B" }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              {proximoEsElMismo ? "Rival de la semana · el partido que se mira" : `${marcado ? "El último partido, marcado en oro" : "El partido que se mira"}${etiqueta ? ` · ${etiqueta}` : ""}`}
            </p>
            <p className="mt-0.5 truncate text-base font-bold uppercase tracking-[0.03em] text-white/90">{nombreCorto(rival)}</p>
            <Atajos atajos={proximoEsElMismo ? [...delPartido, ...delProximo.slice(2).filter((a) => a.href !== HERMANA[pantalla].href)] : delPartido} color="var(--rmcf-gold-ink)" />
          </section>
        ) : null}

        {proximo && !proximoEsElMismo ? (
          <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3" style={{ borderLeft: `3px solid ${AZUL}` }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              Próximo rival · J{proximo.jornada}
              {fechaCorta(proximo.cuando) ? ` · ${fechaCorta(proximo.cuando)}` : ""}
              {proximo.lado === "casa" ? " · en casa" : " · fuera"}
            </p>
            <p className="mt-0.5 truncate text-base font-bold uppercase tracking-[0.03em] text-white/90">{nombreCorto(proximo.rival)}</p>
            <Atajos atajos={compacto && rival ? delProximo.filter((a) => a.href !== HERMANA[pantalla].href) : delProximo} color={AZUL} />
          </section>
        ) : null}
      </div>
    </nav>
  );
}
