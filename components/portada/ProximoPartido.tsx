"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bus,
  ChevronRight,
  ClipboardCheck,
  Goal,
  History,
  Maximize2,
  Trophy,
  Users,
} from "lucide-react";

import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { pantallaCompletaAlNavegar } from "@/hooks/usePantallaCompleta";
import {
  CLAVE_CALENDARIO,
  alrededorDe,
  comoSeLlama,
  formaSemana,
  type PartidoCastilla,
  type PartidoNuestro,
} from "@/lib/castilla/calendario";
import { trackModuleVisit } from "@/lib/module-usage";
import {
  cuantoFalta,
  diaEnMadrid,
  diaLargo,
  equipoDelInforme,
  horaCorta,
  signoResultado,
  type RespuestaPortada,
} from "@/lib/portada/proximo-partido";

/**
 * LA SEMANA, EN LA PORTADA.
 *
 * Antes la portada abría con el nombre de la plataforma en letras de sesenta
 * píxeles, que ya está escrito en la cabecera de todas las pantallas, y no
 * decía contra quién se juega el domingo. Esto es lo que se pregunta el cuerpo
 * técnico al abrir la aplicación: **qué partido viene, cuándo, dónde y en qué
 * día de la semana de trabajo estamos**. Y desde aquí, a un clic, lo que se
 * prepara para ese partido: su plantilla, el plan, el balón parado y el viaje.
 *
 * Nada de esto abre una hoja: el calendario es un documento de Supabase y los
 * escudos y la tabla los sirve el servidor ya recortados.
 */

const ORO = "#D8B45A";
const ORO_CLARO = "#F7D98B";
const VERDE = "#1B9E77";
const NARANJA = "#D95F02";

export function ProximoPartido() {
  const [partidos, setPartidos] = useState<PartidoCastilla[] | null>(null);
  const [informe, setInforme] = useState<RespuestaPortada | null>(null);

  /* El reloj se apunta una vez, fuera del render: ver AlertasPortada. */
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0);

    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const control = new AbortController();

    fetch(`/api/docs?key=${encodeURIComponent(CLAVE_CALENDARIO)}`, {
      cache: "no-store",
      signal: control.signal,
    })
      .then((r) => r.json())
      .then((r: { data?: { partidos?: PartidoCastilla[] } }) => {
        if (control.signal.aborted) return;

        setPartidos(Array.isArray(r?.data?.partidos) ? r.data.partidos : []);
      })
      .catch(() => {
        if (!control.signal.aborted) setPartidos([]);
      });

    return () => control.abort();
  }, []);

  useEffect(() => {
    const control = new AbortController();

    fetch("/api/data-analisis?portada=1", { signal: control.signal })
      .then((r) => r.json())
      .then((r: Partial<RespuestaPortada> & { ok?: boolean }) => {
        if (control.signal.aborted) return;

        setInforme({
          equipos: Array.isArray(r?.equipos) ? r.equipos : [],
          clasificacion: r?.clasificacion ?? null,
        });
      })
      .catch(() => {
        if (!control.signal.aborted) setInforme({ equipos: [], clasificacion: null });
      });

    return () => control.abort();
  }, []);

  const alrededor = useMemo(
    () => (partidos && ahora ? alrededorDe(partidos, ahora) : null),
    [partidos, ahora],
  );

  const proximo = alrededor?.proximo ?? null;
  const anterior = alrededor?.anterior ?? null;

  const semana = useMemo(
    () => (proximo ? formaSemana(proximo.cuando, anterior?.cuando ?? null) : []),
    [proximo, anterior],
  );

  const hoy = ahora ? diaEnMadrid(ahora) : "";

  const diaDeHoy = semana.find((dia) => dia.fecha === hoy) ?? null;

  const rival = proximo ? equipoDelInforme(informe?.equipos ?? [], proximo.rival) : null;

  /* Los cinco últimos, del más antiguo al más reciente: el de ayer, a la derecha. */
  const ultimos = useMemo(
    () => (alrededor?.todos ?? []).filter((uno) => uno.jugado).slice(-5),
    [alrededor],
  );

  const cargando = partidos === null || ahora === 0;

  /* Con el nombre de la hoja, la plantilla abre con el equipo puesto. */
  const enlacePlantilla = proximo
    ? `/rivals?equipo=${encodeURIComponent(rival?.nombre || proximo.rival)}`
    : "/rivals";

  return (
    /* `min-w-0`: es un hijo de un grid, y sin esto la tira de días —que es
       más ancha que un teléfono— empuja la columna fuera de la pantalla en vez
       de desplazarse dentro de su caja. */
    <div className="flex h-full min-w-0 flex-col justify-between gap-7">
      <div className="min-w-0">
        {/* ---------- Rótulos: temporada, jornada y día de la semana ---------- */}

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: ORO_CLARO }}
              />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: ORO_CLARO }} />
            </span>

            <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#F7D98B]">
              Temporada 26/27
            </span>
          </span>

          {proximo && (
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70">
              Jornada {proximo.jornada}
            </span>
          )}

          {diaDeHoy && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.26em]"
              style={{ background: ORO, color: "#0B0F14" }}
            >
              Hoy {diaDeHoy.rotulo}
              <span className="font-medium normal-case tracking-normal opacity-80">
                · {diaDeHoy.nombre}
              </span>
            </span>
          )}
        </div>

        {/* ---------- El partido ---------- */}

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          <Escudos proximo={proximo} escudoRival={rival?.escudo} cargando={cargando} />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#D8B45A]">
              Próximo partido
            </p>

            {cargando ? (
              <>
                <span className="mt-2 block h-10 w-64 max-w-full animate-pulse rounded-lg bg-white/10" />
                <span className="mt-3 block h-4 w-80 max-w-full animate-pulse rounded bg-white/10" />
              </>
            ) : proximo ? (
              <>
                <h1 className="mt-1.5 text-[34px] font-bold leading-[1] tracking-[-0.03em] text-white sm:text-[42px] xl:text-[48px]">
                  {proximo.rival}
                </h1>

                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-white/70 sm:text-[15px]">
                  <span>{diaLargo(proximo.cuando)}</span>
                  <span className="text-white/30">·</span>
                  <span className="tabular-nums">{horaCorta(proximo.cuando)}</span>
                  <span className="text-white/30">·</span>
                  <span>
                    {proximo.lado === "casa"
                      ? "En casa"
                      : rival?.estadio
                        ? `Fuera · ${rival.estadio}${rival.ciudad ? `, ${rival.ciudad}` : ""}`
                        : "Fuera"}
                  </span>

                  {/* Con clases y no con un color fijo: en modo día el dorado
                      claro sobre fondo claro no se veía, y la tabla de
                      `globals.css` sí sabe oscurecer `text-[#F7D98B]`. */}
                  <span className="ml-1 inline-flex items-center rounded-md border border-[#D8B45A]/50 bg-[#D8B45A]/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#F7D98B]">
                    {cuantoFalta(proximo.cuando, ahora)}
                  </span>
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-1.5 text-[30px] font-bold leading-[1] tracking-[-0.03em] text-white sm:text-[38px]">
                  Sin partido a la vista
                </h1>

                <p className="mt-3 text-[14px] text-white/60">
                  El calendario de BeSoccer no tiene ninguno pendiente. Se
                  renueva cada noche desde el ordenador del club.
                </p>
              </>
            )}
          </div>
        </div>

        {/* ---------- La semana de trabajo ---------- */}

        {semana.length > 0 && (
          <div className="mt-6">
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
              {semana.map((dia) => {
                const esHoy = dia.fecha === hoy;
                const esPartido = dia.md === 0;
                const pasado = dia.fecha < hoy;

                return (
                  <span
                    key={dia.fecha}
                    title={`${dia.nombre} ${Number(dia.fecha.slice(8, 10))} · ${dia.rotulo}${
                      dia.descanso ? " · descanso" : esPartido ? " · partido" : ""
                    }`}
                    className={`flex min-w-[46px] flex-1 flex-col items-center rounded-xl border px-1 py-2 transition ${
                      esHoy
                        ? "border-transparent"
                        : esPartido
                          ? "border-[#D8B45A]/50 bg-[#D8B45A]/10"
                          : "border-white/[0.08] bg-white/[0.03]"
                    } ${pasado && !esHoy ? "opacity-45" : ""}`}
                    style={esHoy ? { background: ORO, color: "#0B0F14" } : undefined}
                  >
                    <span
                      className={`text-[9px] font-bold uppercase tracking-[0.14em] ${
                        esHoy ? "" : esPartido ? "text-[#F7D98B]" : "text-white/45"
                      }`}
                    >
                      {dia.rotulo}
                    </span>

                    <span
                      className={`mt-1 text-[16px] font-bold leading-none tabular-nums ${
                        esHoy ? "" : "text-white/85"
                      }`}
                    >
                      {Number(dia.fecha.slice(8, 10))}
                    </span>

                    <span
                      className={`mt-1 text-[9px] uppercase ${
                        esHoy ? "opacity-80" : "text-white/40"
                      }`}
                    >
                      {dia.descanso ? "libre" : dia.nombre.slice(0, 3)}
                    </span>
                  </span>
                );
              })}
            </div>

            <p className="mt-2 text-[11px] text-white/40">
              Semana {comoSeLlama(semana, anterior?.cuando ?? null)}
              {anterior && (
                <>
                  {" "}
                  · el anterior:{" "}
                  <span className="text-white/60">
                    {anterior.lado === "casa" ? "" : "en "}
                    {anterior.rival} {anterior.golesFavor}-{anterior.golesContra}
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        {/* ---------- Lo que se prepara para ese partido ---------- */}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <Link
            href={enlacePlantilla}
            onClick={() => trackModuleVisit("/rivals")}
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-5 py-3 text-[14px] font-medium shadow-[0_0_36px_rgba(37,99,235,.32)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_48px_rgba(37,99,235,.45)]"
            style={{ color: "#fff" }}
          >
            <Users className="h-[17px] w-[17px]" />
            Plantilla del rival
            <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>

          <Accion href="/match-preparation" icono={ClipboardCheck} texto="Plan de partido" />

          <Accion href="/abp-microciclo" icono={Goal} texto="Microciclo ABP" />

          {proximo?.lado === "fuera" && (
            <Accion href="/desplazamiento" icono={Bus} texto="Desplazamiento" />
          )}

          {/*
            La pizarra, a pantalla completa desde el primer clic. Se pide aquí,
            con el gesto de la persona, porque un efecto al cargar la otra
            página llegaría tarde: el navegador sólo la concede en un clic.
          */}
          <Link
            href="/pizarra-tactica?once=1"
            onClick={() => {
              trackModuleVisit("/pizarra-tactica");
              pantallaCompletaAlNavegar();
            }}
            title="Abre la pizarra táctica a pantalla completa, con los dos onces puestos en 4-2-3-1"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-5 py-3 text-[14px] font-medium text-[#C8A96B] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#C8A96B]/70 hover:bg-[#C8A96B]/20"
          >
            <Maximize2 className="h-[17px] w-[17px]" />
            Pizarra táctica
          </Link>
        </div>
      </div>

      {/* ---------- Cómo vamos: racha y clasificación ---------- */}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.08] pt-5">
        <Racha ultimos={ultimos} cargando={cargando} />

        <Clasificacion informe={informe} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

/** Los dos escudos, con el «vs» entre medias: nosotros siempre a la izquierda. */
function Escudos({
  proximo,
  escudoRival,
  cargando,
}: {
  proximo: PartidoNuestro | null;
  escudoRival?: string;
  cargando: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_0_40px_rgba(200,169,107,0.10)] sm:h-[84px] sm:w-[84px]">
        <Image src="/logo.png" alt="Real Madrid Castilla" width={48} height={48} priority />
      </span>

      <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/35">
        vs
      </span>

      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] sm:h-[84px] sm:w-[84px]">
        {cargando ? (
          <span className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
        ) : (
          <EscudoEquipo
            nombre={proximo?.rival ?? "?"}
            escudo={escudoRival}
            lado={52}
            className="!border-0 !bg-transparent text-[22px]"
          />
        )}
      </span>
    </div>
  );
}

function Accion({
  href,
  icono: Icono,
  texto,
}: {
  href: string;
  icono: typeof Users;
  texto: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackModuleVisit(href)}
      className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3 text-[14px] font-medium text-white/85 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
    >
      <Icono className="h-[17px] w-[17px] text-[#D8B45A]" />
      {texto}
    </Link>
  );
}

/**
 * Los últimos resultados, como se leen en cualquier clasificación: una ficha
 * por partido, con el marcador al pasar por encima. Lleva al histórico.
 */
function Racha({ ultimos, cargando }: { ultimos: PartidoNuestro[]; cargando: boolean }) {
  return (
    <Link
      href="/collective_history"
      onClick={() => trackModuleVisit("/collective_history")}
      className="group flex items-center gap-3"
      title="Histórico de competición"
    >
      <History className="h-4 w-4 shrink-0 text-white/35 transition-colors group-hover:text-[#D8B45A]" />

      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
        Últimos
      </span>

      <span className="flex items-center gap-1.5">
        {cargando
          ? Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="h-7 w-7 animate-pulse rounded-lg bg-white/10" />
            ))
          : ultimos.length === 0
            ? <span className="text-[12px] text-white/40">sin partidos jugados</span>
            : ultimos.map((partido) => {
                const signo = signoResultado(partido.golesFavor, partido.golesContra);

                const color = signo === "V" ? VERDE : signo === "D" ? NARANJA : "#94A3B8";

                return (
                  <span
                    key={`${partido.jornada}-${partido.cuando}`}
                    title={`J${partido.jornada} · ${partido.lado === "casa" ? "" : "en "}${partido.rival} · ${partido.golesFavor}-${partido.golesContra}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold"
                    style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
                  >
                    {signo}
                  </span>
                );
              })}
      </span>
    </Link>
  );
}

/** Nuestra fila de la tabla, en una línea. Lleva al equipo de un vistazo. */
function Clasificacion({ informe }: { informe: RespuestaPortada | null }) {
  const fila = informe?.clasificacion ?? null;

  return (
    <Link
      href="/data-analisis?area=equipo"
      onClick={() => trackModuleVisit("/data-analisis")}
      className="group flex min-w-0 items-center gap-3"
      title="El Castilla de un vistazo, en Data Análisis"
    >
      <Trophy className="h-4 w-4 shrink-0 text-white/35 transition-colors group-hover:text-[#D8B45A]" />

      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
        Liga
      </span>

      {informe === null ? (
        <span className="h-5 w-40 animate-pulse rounded bg-white/10" />
      ) : fila ? (
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[13px] text-white/70">
          <span className="text-[20px] font-bold leading-none tabular-nums text-white">
            {fila.puesto}º
          </span>
          <span className="text-white/40">de {fila.deCuantos}</span>
          <span className="tabular-nums">
            <span className="font-semibold text-white/85">{fila.puntos}</span> pts
          </span>
          <span className="text-white/30">·</span>
          <span className="tabular-nums">
            {fila.ganados}V {fila.empatados}E {fila.perdidos}D
          </span>
          <span className="text-white/30">·</span>
          <span className="tabular-nums">
            {fila.favor}-{fila.contra}
          </span>
        </span>
      ) : (
        <span className="text-[12px] text-white/40">sin tabla todavía</span>
      )}
    </Link>
  );
}

export default ProximoPartido;
