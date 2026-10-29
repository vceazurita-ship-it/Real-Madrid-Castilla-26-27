"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
import { DiaRapido } from "@/components/portada/DiaRapido";
import { useCalendario } from "@/hooks/useCalendario";
import { pantallaCompletaAlNavegar } from "@/hooks/usePantallaCompleta";
import { aJornada, buscaJornada, type FilaRival, type JornadaRival } from "@/lib/abp/jornada";
import {
  alrededorDe,
  formaSemana,
  type PartidoNuestro,
} from "@/lib/castilla/calendario";
import { traeJson } from "@/lib/hojaCsv";
import { trackModuleVisit } from "@/lib/module-usage";
import { chipInk } from "@/lib/theme";
import {
  cuantoFalta,
  diaEnMadrid,
  diaLargo,
  equipoDelInforme,
  fechasConTarea,
  horaCorta,
  libresDeLaSemana,
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
 * El calendario es un documento de Supabase (`useCalendario`, una descarga
 * por pestaña) y los escudos y la tabla los sirve el servidor ya recortados.
 * Todo entra por `traeJson`: la portada pinta al momento con la copia del
 * aparato y lo nuevo llega por detrás.
 *
 * **Los accesos llevan el rival puesto (11/10/2026).** Sólo «Plantilla del
 * rival» sabía contra quién se juega; el plan, el scouting y el balón parado
 * abrían en blanco y había que volver a elegirlo. La hoja RIVALES es la que
 * da el `ID` con el que abren el plan, el informe colectivo y la pizarra, y se
 * busca su fila por la fecha del partido y por el nombre (`buscaJornada`).
 */

const ORO = "#D8B45A";
const ORO_CLARO = "#F7D98B";
const VERDE = "#1B9E77";
const NARANJA = "#D95F02";

export function ProximoPartido() {
  const { partidos, cargando: sinCalendario, fallo: calendarioTarda, reintentar: reintentaCalendario } = useCalendario();
  const [informe, setInforme] = useState<RespuestaPortada | null>(null);

  /* Las jornadas de la hoja RIVALES, sólo para dar con el `ID` del rival. */
  const [jornadas, setJornadas] = useState<JornadaRival[]>([]);

  /* El reloj se apunta una vez, fuera del render: ver AlertasPortada. */
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0);

    return () => clearTimeout(id);
  }, []);

  /*
  | Los días con tareas en la hoja de registro: con ellos la tira enseña los
  | libres que el microciclo tiene de verdad y no la propuesta de siempre.
  | `null` mientras no ha contestado; si la hoja falla, un conjunto vacío,
  | que vuelve a la propuesta.
  */
  const [conTarea, setConTarea] = useState<Set<string> | null>(null);
  /* El día que se ha pinchado en la tira: abre su sesión o un seguimiento (13/10/2026). */
  const [diaAbierto, setDiaAbierto] = useState<{ fecha: string; nombre: string; rotulo: string } | null>(null);

  useEffect(() => {
    let vivo = true;

    fechasConTarea()
      .then((fechas) => {
        if (vivo) setConTarea(fechas);
      })
      .catch(() => {
        if (vivo) setConTarea(new Set());
      });

    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;

    traeJson<Partial<RespuestaPortada>>("/api/data-analisis?portada=1")
      .then((r) => {
        if (!vivo) return;

        setInforme({
          equipos: Array.isArray(r?.equipos) ? r.equipos : [],
          clasificacion: r?.clasificacion ?? null,
        });
      })
      .catch(() => {
        /* Sin escudo ni tabla el partido se pinta igual: sigue valiendo. */
        if (vivo) setInforme({ equipos: [], clasificacion: null });
      });

    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;

    traeJson<unknown>("/api/rivals?action=rivales")
      .then((data) => {
        if (!vivo || !Array.isArray(data)) return;

        setJornadas(
          (data as FilaRival[]).filter((fila) => fila && typeof fila === "object").map(aJornada),
        );
      })
      .catch(() => {
        /* Sin la hoja, los accesos abren sin rival puesto: como hasta ahora. */
      });

    return () => {
      vivo = false;
    };
  }, []);

  const alrededor = useMemo(
    () => (!sinCalendario && ahora ? alrededorDe(partidos, ahora) : null),
    [partidos, sinCalendario, ahora],
  );

  const proximo = alrededor?.proximo ?? null;
  const anterior = alrededor?.anterior ?? null;

  const semana = useMemo(
    () => (proximo ? formaSemana(proximo.cuando, anterior?.cuando ?? null) : []),
    [proximo, anterior],
  );

  const hoy = ahora ? diaEnMadrid(ahora) : "";

  const diaDeHoy = semana.find((dia) => dia.fecha === hoy) ?? null;

  const { libres, delMicro } = useMemo(
    () => libresDeLaSemana(semana, conTarea),
    [semana, conTarea],
  );

  /* «sáb 10 y dom 11», para el pie de la tira. */
  const libresEnTexto = (() => {
    const nombres = semana
      .filter((dia) => libres.has(dia.fecha) && (!hoy || dia.fecha >= hoy))
      .map((dia) => `${dia.nombre.slice(0, 3)} ${Number(dia.fecha.slice(8, 10))}`);

    if (nombres.length <= 1) return nombres.join("");

    /* «sáb 10, dom 11 y jue 15», como se dice. */
    return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  })();

  const rival = proximo ? equipoDelInforme(informe?.equipos ?? [], proximo.rival) : null;

  /* Los cinco últimos, del más antiguo al más reciente: el de ayer, a la derecha. */
  const ultimos = useMemo(
    () => (alrededor?.todos ?? []).filter((uno) => uno.jugado).slice(-5),
    [alrededor],
  );

  const cargando = sinCalendario || ahora === 0;

  /*
  | El rival, de las dos maneras en que lo piden las pantallas:
  | - por nombre (`?equipo=`), como lo escribe la hoja de plantillas: la
  |   plantilla y el ABP del rival lo buscan así;
  | - por `ID` de la hoja RIVALES (`?rival=`): el plan de partido, el informe
  |   colectivo y la pizarra de balón parado abren por esa llave. La fila se
  |   busca por la fecha antes que por el nombre: contra un mismo equipo se
  |   juega dos veces.
  | Sin rival (o sin la hoja todavía) los enlaces van pelados y la pantalla
  | de destino abre en su próximo partido, que es lo que hacía siempre.
  */
  const nombreRival = proximo ? rival?.nombre || proximo.rival : "";

  const idRival = useMemo(() => {
    if (!proximo) return "";

    return (
      buscaJornada(jornadas, { rival: proximo.rival, fecha: proximo.cuando.slice(0, 10) })?.id ?? ""
    );
  }, [jornadas, proximo]);

  const conEquipo = (ruta: string) =>
    nombreRival ? `${ruta}?equipo=${encodeURIComponent(nombreRival)}` : ruta;

  const conRival = (ruta: string) =>
    idRival ? `${ruta}?rival=${encodeURIComponent(idRival)}` : ruta;

  const enlacePlantilla = conEquipo("/rivals");

  /*
  | Lo que toca hoy según el día de la semana (MD-n): la víspera, la pizarra
  | para mandar a los jugadores; el día después, el post. Días naturales en
  | Madrid, como `cuantoFalta`.
  */
  const diasEntre = (desde: string, hasta: string) =>
    Math.round((Date.parse(`${hasta.slice(0, 10)}T12:00:00Z`) - Date.parse(`${desde.slice(0, 10)}T12:00:00Z`)) / 86_400_000);

  const faltan = proximo && hoy ? diasEntre(hoy, proximo.cuando) : null;
  const pasados = anterior && hoy ? diasEntre(anterior.cuando, hoy) : null;

  const hoyToca: { rotulo: string; atajos: { href: string; texto: string; title: string }[] } | null =
    faltan !== null && faltan <= 1
      ? {
          rotulo: faltan <= 0 ? "MD" : "MD-1",
          atajos: [
            { href: conRival("/abp-pizarra"), texto: "PDF y vídeo ABP por jugador", title: "La pizarra de balón parado: «PDF por jugador» para mandarlo por WhatsApp" },
            { href: conRival("/match-preparation"), texto: "Plan de partido", title: `El plan contra ${nombreRival}` },
            { href: conEquipo("/duelos"), texto: "Duelos", title: `Nuestro once contra el de ${nombreRival}` },
          ],
        }
      : pasados !== null && pasados >= 1 && pasados <= 2 && anterior
        ? {
            rotulo: `MD+${pasados}`,
            atajos: [
              { href: "/microcycles", texto: "Informe post", title: `El informe del partido contra ${anterior.rival}, desde Microciclos` },
              { href: "/data-analisis", texto: "Data análisis", title: "Los datos del último partido" },
              { href: "/collective_history", texto: "Histórico", title: "Todos los partidos de la temporada" },
            ],
          }
        : faltan !== null && faltan <= 4
          ? {
              rotulo: `MD-${faltan}`,
              atajos: [
                { href: conRival("/scout-rival-collective"), texto: "Scout colectivo", title: `El informe colectivo de ${nombreRival}` },
                { href: conEquipo("/scout-rival-abp"), texto: "ABP rival", title: `El balón parado de ${nombreRival}` },
                { href: "/abp-microciclo", texto: "Microciclo ABP", title: "Qué se trabaja cada día a balón parado" },
              ],
            }
          : null;

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
              {libres.has(diaDeHoy.fecha) && (
                <span className="font-medium normal-case tracking-normal opacity-80">
                  · libre
                </span>
              )}
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
                {/* Del alto del nombre y de la línea de debajo (que en el
                    móvil ocupa dos renglones): si no, todo lo de abajo
                    saltaba al llegar el calendario (14/10/2026). */}
                <span className="mt-1.5 block h-[34px] w-64 max-w-full animate-pulse rounded-lg bg-white/10 sm:h-[48px] xl:h-[56px]" />
                <span className="mt-3 block h-[46px] w-80 max-w-full animate-pulse rounded bg-white/10 sm:h-[30px]" />
              </>
            ) : proximo ? (
              <>
                <h1 className="mt-1.5 text-[34px] font-bold leading-[1] tracking-[-0.03em] text-white sm:text-[48px] xl:text-[56px]">
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
                  {!(diaDeHoy && cuantoFalta(proximo.cuando, ahora) === "hoy") && (
                  <span className="ml-1 inline-flex items-center rounded-lg border border-[#D8B45A]/60 bg-[#D8B45A]/15 px-3 py-1 text-[13px] font-bold uppercase tracking-[0.18em] text-[#F7D98B] shadow-[0_0_24px_rgba(216,180,90,0.25)]">
                    {cuantoFalta(proximo.cuando, ahora)}
                  </span>
                  )}
                </p>
              </>
            ) : calendarioTarda && partidos.length === 0 ? (
              <>
                <h1 className="mt-1.5 text-[30px] font-bold leading-[1] tracking-[-0.03em] text-white sm:text-[38px]">
                  El calendario tarda en llegar
                </h1>

                <p className="mt-3 text-[14px] text-white/60">
                  No hemos podido leer el calendario de BeSoccer a tiempo.
                  Vuelve a pedirlo para ver el próximo partido.
                </p>

                <button
                  type="button"
                  onClick={reintentaCalendario}
                  className="mt-3 rounded-lg border border-[#D8B45A]/50 px-3 py-1.5 text-xs font-semibold text-[#F7D98B] transition hover:bg-[#D8B45A]/10"
                >
                  Reintentar
                </button>
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

        {/* Mientras llega el calendario, el hueco de la semana ya está: sin él,
            los botones de abajo bajaban de golpe al cargar (Lighthouse medía
            un salto de 0,2 en la portada, 14/10/2026). */}
        {cargando && semana.length === 0 && (
          <div aria-hidden className="mt-6">
            <div className="grid grid-cols-7 gap-1 pb-1 sm:gap-1.5">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="h-[69px] min-w-0 animate-pulse rounded-xl border border-white/[0.08] bg-white/[0.03]" />
              ))}
            </div>
            <div className="mt-2 h-[17px]" />
          </div>
        )}

        {semana.length > 0 && (
          <div className="mt-6">
            <div className="grid grid-cols-7 gap-1 pb-1 sm:gap-1.5">
              {semana.map((dia) => {
                const esHoy = dia.fecha === hoy;
                const esPartido = dia.md === 0;
                const pasado = dia.fecha < hoy;
                const libre = libres.has(dia.fecha);

                return (
                  <button
                    type="button"
                    onClick={() => setDiaAbierto({ fecha: dia.fecha, nombre: dia.nombre, rotulo: dia.rotulo })}
                    key={dia.fecha}
                    title={`${dia.nombre} ${Number(dia.fecha.slice(8, 10))} · ${dia.rotulo}${
                      libre
                        ? delMicro
                          ? " · libre (del microciclo)"
                          : " · libre (propuesto)"
                        : esPartido
                          ? " · partido"
                          : ""
                    } · pincha para la sesión o un seguimiento`}
                    className={`flex min-w-0 flex-col items-center rounded-xl border px-0.5 py-2 transition hover:-translate-y-0.5 sm:px-1 hover:border-[#D8B45A]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D8B45A] ${
                      esHoy
                        ? "border-transparent"
                        : esPartido
                          ? "border-[#D8B45A]/50 bg-[#D8B45A]/10"
                          : "border-white/[0.08] bg-white/[0.03]"
                    } ${pasado && !esHoy ? "opacity-45" : ""}`}
                    style={esHoy ? { background: ORO, color: "#0B0F14" } : undefined}
                  >
                    <span
                      className={`text-[9px] font-bold uppercase tracking-[0.06em] sm:tracking-[0.14em] ${
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

                    {/* En el móvil sólo «libre»: con el día de la semana debajo
                        no caben las siete casillas. */}
                    <span
                      className={`mt-1 text-[9px] uppercase ${
                        libre ? "" : "hidden sm:inline"
                      } ${esHoy ? "opacity-80" : "text-white/40"}`}
                    >
                      {libre ? "libre" : dia.nombre.slice(0, 3)}
                    </span>
                  </button>
                );
              })}
            </div>

            {diaDeHoy && (
              <button
                type="button"
                onClick={() =>
                  setDiaAbierto({ fecha: diaDeHoy.fecha, nombre: diaDeHoy.nombre, rotulo: diaDeHoy.rotulo })
                }
                className="group mt-3 inline-flex items-center gap-2 rounded-xl border border-[#D8B45A]/50 bg-[#D8B45A]/10 px-4 py-2 text-[13px] font-semibold text-[#F7D98B] transition hover:-translate-y-0.5 hover:bg-[#D8B45A]/20"
              >
                Qué toca hoy
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {diaAbierto &&
              createPortal(
                <DiaRapido
                  fecha={diaAbierto.fecha}
                  titulo={`${diaAbierto.nombre.charAt(0).toUpperCase()}${diaAbierto.nombre.slice(1)} ${Number(diaAbierto.fecha.slice(8, 10))}`}
                  rotulo={diaAbierto.rotulo}
                  onClose={() => setDiaAbierto(null)}
                />,
                document.body,
              )}

            {/* «Libre: sáb 10 y dom 11 · Último: Antequera CF 3-2 (V)». Los
                libres salen del microciclo escrito en la hoja; mientras no se
                escriba, se avisa de que son una propuesta. */}
            {/* El último resultado va junto a la racha (29/10/2026, experto de fútbol). */}
            {conTarea !== null && libresEnTexto && <p className="mt-2 text-[11px] text-white/40">Libre: {libresEnTexto}</p>}
          </div>
        )}

        {/* ---------- Lo que se prepara para ese partido ---------- */}

        {/* Móvil: el azul ocupa la fila y debajo los otros tres en una sola fila (29/10/2026, fútbol); hueco a la derecha para el botón flotante. En escritorio, una sola línea. */}
        <div className="mt-6 grid grid-cols-3 gap-2 pr-12 sm:flex sm:flex-wrap sm:gap-2.5 sm:pr-0 xl:flex-nowrap [&>a:first-child]:col-span-3">
          <Link
            href={enlacePlantilla}
            title={nombreRival ? `La plantilla de ${nombreRival}` : undefined}
            onClick={() => trackModuleVisit("/rivals")}
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-5 py-3 text-[14px] font-medium shadow-[0_0_36px_rgba(37,99,235,.32)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_48px_rgba(37,99,235,.45)]"
            style={{ color: "#fff" }}
          >
            <Users className="h-[17px] w-[17px]" />
            Plantilla del rival
            <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>

          <Accion
            href={conRival("/match-preparation")}
            icono={ClipboardCheck}
            texto="Plan de partido"
            title={nombreRival ? `El plan de partido contra ${nombreRival}` : undefined}
          />

          {/* El microciclo ABP no se abre por rival: es la semana de trabajo
              entera y él mismo sabe qué partido viene. */}
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
            className="group inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-1.5 py-2.5 text-center text-[12.5px] leading-tight sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-[14px] font-medium text-[#C8A96B] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#C8A96B]/70 hover:bg-[#C8A96B]/20"
          >
            <Maximize2 className="h-[17px] w-[17px]" />
            Pizarra táctica
          </Link>
        </div>

        {/*
          Lo que ya se sabe del rival, en una línea. Sólo van las pantallas
          que saben abrirse con el rival puesto: el área no lee nada de la URL
          y aquí sería un enlace más del menú. Duelos e individual se abren
          por `?equipo=` desde el 26/10/2026.
        */}
        {/*
          Una sola línea de accesos (29/10/2026, experto de fútbol): lo de hoy
          primero y después lo del rival, sin repetir nada de los botones de
          arriba ni de lo de hoy.
        */}
        {(() => {
          const enBotones = new Set(["Plantilla del rival", "Plan de partido", "Microciclo ABP", "Pizarra táctica", "Desplazamiento"]);

          const deHoy = (hoyToca?.atajos ?? []).filter((atajo) => !enBotones.has(atajo.texto));

          const yaHoy = new Set(deHoy.map((atajo) => atajo.texto));

          const delRival = proximo
            ? [
                { href: conRival("/scout-rival-collective"), texto: "Scout colectivo", title: `El informe colectivo de ${nombreRival}` },
                { href: conEquipo("/scout-rival-abp"), texto: "ABP rival", title: `El balón parado de ${nombreRival}, a favor y en contra` },
                { href: conRival("/abp-pizarra"), texto: "Pizarra ABP", title: `Las diapositivas de balón parado del partido contra ${nombreRival}` },
                { href: conEquipo("/duelos"), texto: "Duelos", title: `Nuestro once contra el de ${nombreRival}, puesto a puesto` },
                { href: conEquipo("/scout-rival-individual"), texto: "Individual", title: `Los vídeos de los jugadores de ${nombreRival}` },
              ].filter((atajo) => !yaHoy.has(atajo.texto))
            : [];

          if (!deHoy.length && !delRival.length) return null;

          const lista = (atajos: { href: string; texto: string; title?: string }[]) =>
            atajos.map((atajo, i) => (
              <span key={atajo.texto} className="inline-flex items-center gap-2">
                {i > 0 && <span className="text-white/20">·</span>}
                <Atajo href={atajo.href} texto={atajo.texto} title={atajo.title} />
              </span>
            ));

          return (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
              {/* Sin la cápsula «Hoy · MD-2» (29/10/2026, fútbol): ya sale
                  arriba. Los atajos de hoy van solos, delante de «Del rival». */}
              {hoyToca && deHoy.length > 0 && lista(deHoy)}

              {delRival.length > 0 && (
                <>
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45 ${deHoy.length ? "ml-3" : ""}`}>
                    Del rival
                  </span>
                  {lista(delRival)}
                </>
              )}
            </p>
          );
        })()}
      </div>

      {/* ---------- Cómo vamos: racha y clasificación ---------- */}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.08] pt-5">
        <Racha ultimos={ultimos} cargando={cargando} ultimo={anterior} />

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
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-[#D8B45A]/30 bg-white/[0.04] shadow-[0_0_56px_rgba(216,180,90,0.22)] sm:h-[96px] sm:w-[96px]">
        <Image src="/logo.png" alt="Real Madrid Castilla" width={48} height={48} priority />
      </span>

      <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/35">
        vs
      </span>

      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] sm:h-[96px] sm:w-[96px]">
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

/** El módulo que se cuenta en el acceso rápido es la ruta, sin el rival. */
const modulo = (href: string) => href.split("?")[0];

function Accion({
  href,
  icono: Icono,
  texto,
  title,
}: {
  href: string;
  icono: typeof Users;
  texto: string;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      onClick={() => trackModuleVisit(modulo(href))}
      className="group inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border border-white/12 bg-white/[0.04] px-1.5 py-2.5 text-center text-[12.5px] leading-tight sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-[14px] font-medium text-white/85 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
    >
      <Icono className="h-[17px] w-[17px] text-[#D8B45A]" />
      {texto}
    </Link>
  );
}

/** Un acceso de texto, para la línea «Del rival». */
function Atajo({ href, texto, title }: { href: string; texto: string; title?: string }) {
  return (
    <Link
      href={href}
      title={title}
      onClick={() => trackModuleVisit(modulo(href))}
      className="text-white/60 underline decoration-white/20 underline-offset-4 transition-colors hover:text-[#F7D98B] hover:decoration-[#D8B45A]/60"
    >
      {texto}
    </Link>
  );
}

/**
 * Los últimos resultados, como se leen en cualquier clasificación: una ficha
 * por partido, con el marcador al pasar por encima. Lleva al histórico.
 */
function Racha({ ultimos, cargando, ultimo }: { ultimos: PartidoNuestro[]; cargando: boolean; ultimo?: PartidoNuestro | null }) {
  /* Sin partidos jugados no hay racha que enseñar. */
  if (!cargando && ultimos.length === 0) return null;

  return (
    <Link
      href="/collective_history"
      onClick={() => trackModuleVisit("/collective_history")}
      className="group flex flex-wrap items-center gap-x-3 gap-y-1.5"
      title="Histórico de competición"
    >
      <History className="h-4 w-4 shrink-0 text-white/35 transition-colors group-hover:text-[#D8B45A]" />

      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
        Últimos 5
      </span>

      <span className="flex items-center gap-1.5">
        {cargando
          ? Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="h-7 w-7 animate-pulse rounded-lg bg-white/10" />
            ))
          : ultimos.map((partido) => {
                const signo = signoResultado(partido.golesFavor, partido.golesContra);

                const color = signo === "V" ? VERDE : signo === "D" ? NARANJA : "#94A3B8";

                return (
                  <span
                    key={`${partido.jornada}-${partido.cuando}`}
                    title={`J${partido.jornada} · ${partido.lado === "casa" ? "" : "en "}${partido.rival} · ${partido.golesFavor}-${partido.golesContra}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold"
                    /* La letra con `chipInk`: el gris del empate y el verde
                       sobre el blanco del modo día no llegaban a 3:1. */
                    style={{ background: `${color}22`, color: chipInk(color), border: `1px solid ${color}55` }}
                  >
                    {signo}
                  </span>
                );
              })}
      </span>
      {!cargando && ultimo && ultimo.golesFavor !== null && ultimo.golesContra !== null && (
        <span className="basis-full whitespace-nowrap text-[12px] text-white/50 sm:basis-auto">
          El último: <span className="text-white/75">{ultimo.golesFavor}-{ultimo.golesContra} {ultimo.lado === "casa" ? "en casa con" : "en"} {ultimo.rival}</span>
        </span>
      )}
    </Link>
  );
}

/** Nuestra fila de la tabla, en una línea. Lleva al equipo de un vistazo. */
function Clasificacion({ informe }: { informe: RespuestaPortada | null }) {
  const fila = informe?.clasificacion ?? null;

  /* Con la lectura hecha y sin fila nuestra no hay nada que decir. */
  if (informe !== null && !fila) return null;

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
            goles {fila.favor} a favor y {fila.contra} en contra
          </span>
          <span className="text-white/30">·</span>
          <span className="tabular-nums text-white/40">
            {fila.ganados + fila.empatados + fila.perdidos} partidos
          </span>
        </span>
      ) : null}
    </Link>
  );
}

export default ProximoPartido;
