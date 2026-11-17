"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { CuentaAtras } from "@/components/portada/CuentaAtras";
import { DiaRapido } from "@/components/portada/DiaRapido";
import { VideosDelRival } from "@/components/portada/VideosDelRival";
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
import { useAdmin } from "@/hooks/useAdmin";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { CASTILLA_OPTA } from "@/lib/opta";
import { ponEquipoElegido } from "@/lib/data-analisis/eleccion-compartida";
import {
  contenidosDelDia,
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

  /* El coding de rival es de quien prepara el análisis: sólo el administrador lo ve. */
  const { admin } = useAdmin();

  /* Lo que hay escrito para hoy en la hoja de registro, para el botón «Hoy». */
  const [contenidosHoy, setContenidosHoy] = useState<{ fecha: string; lista: string[] } | null>(null);

  useEffect(() => {
    if (!hoy) return;

    let vivo = true;

    contenidosDelDia(hoy)
      .then((lista) => {
        if (vivo) setContenidosHoy({ fecha: hoy, lista });
      })
      .catch(() => {
        if (vivo) setContenidosHoy({ fecha: hoy, lista: [] });
      });

    return () => {
      vivo = false;
    };
  }, [hoy]);

  const sesionDeHoy = contenidosHoy?.fecha === hoy ? contenidosHoy.lista : [];

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

  /*
  | 17/11/2026 (ronda 21, marketing): «Duelos» y «Sus jugadores» con las dos
  | llaves, `?rival=ID` (la de la app) y `?equipo=NOMBRE` (la que leen hoy
  | esas pantallas): abren con el rival elegido lean la que lean.
  */
  const conAmbos = (ruta: string) => {
    const q = new URLSearchParams();

    if (idRival) q.set("rival", idRival);
    if (nombreRival) q.set("equipo", nombreRival);

    const s = q.toString();

    return s ? `${ruta}?${s}` : ruta;
  };

  const enlacePlantilla = conEquipo("/rivals");

  /*
  | Lo que toca hoy según el día de la semana (MD-n): la víspera, la pizarra
  | para mandar a los jugadores; el día después, el post. Días naturales en
  | Madrid, como `cuantoFalta`.
  */
  const diasEntre = (desde: string, hasta: string) =>
    Math.round((Date.parse(`${hasta.slice(0, 10)}T12:00:00Z`) - Date.parse(`${desde.slice(0, 10)}T12:00:00Z`)) / 86_400_000);

  const faltan = proximo && hoy ? diasEntre(hoy, proximo.cuando) : null;

  /* De MD-4 a MD-1: la tarjeta oscura de la portada es la del rival (misma regla que `rivalSemana` en app/page.tsx). */
  const semanaDelRival = faltan !== null && faltan >= 1 && faltan <= 4;
  const pasados = anterior && hoy ? diasEntre(anterior.cuando, hoy) : null;

  const hoyToca: { rotulo: string; atajos: { href: string; texto: string; title: string }[] } | null =
    faltan !== null && faltan <= 1
      ? {
          rotulo: faltan <= 0 ? "MD" : "MD-1",
          atajos: [
            /* 10/11/2026 (fase 4): el día de partido, las cifras en directo, lo primero. */
            ...(faltan <= 0
              ? [{ href: "/data-analisis?area=directo", texto: "En directo", title: "Las cifras del partido mientras se juega" }]
              : []),
            { href: conRival("/abp-pizarra"), texto: "PDF y vídeo ABP por jugador", title: "La pizarra de balón parado: «PDF por jugador» para mandarlo por WhatsApp" },
            { href: conRival("/match-preparation"), texto: "Plan de partido", title: `El plan contra ${nombreRival}` },
            { href: conAmbos("/duelos"), texto: "Duelos", title: `Nuestro once contra el de ${nombreRival}` },
          ],
        }
      : pasados !== null && pasados >= 1 && pasados <= 2 && anterior
        ? {
            rotulo: `MD+${pasados}`,
            atajos: [
              { href: "/microcycles", texto: "Informe post", title: `El informe del partido contra ${anterior.rival}, desde Microciclos` },
              { href: "/data-analisis?area=post", texto: "Análisis de datos", title: "El post del último partido" },
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

        {/* 16/11/2026 (rediseño): una sola línea de contexto en vez de tres chapas; la única chapa es «Hoy MD-n», que es lo que cambia cada día. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {diaDeHoy && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.16em]"
              style={{ background: ORO, color: "#0B0F14" }}
            >
              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: "#0B0F14" }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "#0B0F14" }} />
              </span>
              Hoy {diaDeHoy.rotulo}
              {libres.has(diaDeHoy.fecha) && (
                <span className="font-medium normal-case tracking-normal opacity-80">
                  · libre
                </span>
              )}
            </span>
          )}

          <span className="portada-rotulo">
            {proximo ? `Jornada ${proximo.jornada} · ` : ""}Temporada 26/27
          </span>
        </div>

        {/* ---------- El partido ---------- */}

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          <Escudos proximo={proximo} escudoRival={rival?.escudo} cargando={cargando} />

          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/55">
              Próximo partido
            </p>

            {cargando ? (
              <>
                {/* Del alto del nombre y de la línea de debajo (que en el
                    móvil ocupa dos renglones): si no, todo lo de abajo
                    saltaba al llegar el calendario (14/10/2026). */}
                <span className="mt-1.5 block h-[38px] w-64 max-w-full animate-pulse rounded-lg bg-white/10 sm:h-[53px] xl:h-[61px]" />
                <span className="mt-3 block h-[46px] w-80 max-w-full animate-pulse rounded bg-white/10 sm:h-[30px]" />
                <span className="mt-4 block h-[60px] w-[220px] max-w-full animate-pulse rounded-2xl bg-white/[0.04]" />
              </>
            ) : proximo ? (
              <>
                {/* Letra del club (02/11/2026): Barlow Condensed, como las láminas y los PDF. */}
                <h1 className="fuente-club mt-1.5 text-[40px] font-bold uppercase leading-[0.95] tracking-[0.005em] text-white sm:text-[56px] xl:text-[64px]">
                  {proximo.rival}
                </h1>

                {/* 07/11/2026 (marketing): en el móvil el día va en su renglón y la hora
                    con el campo en el siguiente; antes quedaba un «·» huérfano al final. */}
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-white/70 sm:text-[15px]">
                  <span className="basis-full xl:basis-auto">{diaLargo(proximo.cuando)}</span>
                  <span className="hidden text-white/30 xl:inline">·</span>
                  {/* 09/11/2026: hora y campo en un solo trozo: en el móvil el campo largo bajaba de renglón y dejaba «21:15 ·» colgando. */}
                  <span>
                    <span className="tabular-nums">{horaCorta(proximo.cuando)}</span>
                    <span className="mx-2 text-white/30">·</span>
                    {proximo.lado === "casa"
                      ? "En casa"
                      : rival?.estadio
                        ? `Fuera · ${rival.estadio}${rival.ciudad ? `, ${rival.ciudad}` : ""}`
                        : "Fuera"}
                  </span>

                </p>

                {/* La chapa «en 5 días» pasa a cuenta atrás viva (02/11/2026):
                    el día de partido lo que se pregunta son las horas. */}
                <div className="mt-4">
                  <CuentaAtras cuando={proximo.cuando} />
                </div>
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
            <div className="mt-3 h-[33px]" />
          </div>
        )}

        {semana.length > 0 && (
          <div className="mt-6">
            {/* Una sola fila aunque el micro tenga más de siete días (02/11/2026). Desde el 09/11/2026 cada día tiene un ancho mínimo legible: con 8-9 días en el móvil quedaban palillos; si no caben, la tira se desliza. */}
            <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="grid gap-1 pb-1 sm:gap-1.5"
              /* 16/11/2026 (fútbol): siete días caben siempre a 390 px, con el MD a la vista; sólo un micro de ocho o más se desliza. */
              style={{ gridTemplateColumns: `repeat(${semana.length}, minmax(${semana.length > 7 ? 40 : 0}px, 1fr))` }}
            >
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
                    className={`portada-viva flex min-w-0 flex-col items-center rounded-xl border px-0 py-2 sm:px-1 ${
                      esHoy
                        ? "border-transparent shadow-[0_10px_24px_-12px_rgba(216,180,90,.9)]"
                        : esPartido
                          ? "border-[#D8B45A]/50 bg-[#D8B45A]/10"
                          : "portada-celda"
                    } ${pasado && !esHoy ? "opacity-45" : ""}`}
                    style={esHoy ? { background: ORO, color: "#0B0F14", borderRadius: 12 } : esPartido ? undefined : { borderRadius: 12 }}
                  >
                    <span
                      className={`whitespace-nowrap text-[11px] font-bold uppercase tracking-[-0.01em] sm:tracking-[0.14em] ${
                        esHoy ? "" : esPartido ? "text-[#F7D98B]" : "text-white/45"
                      }`}
                    >
                      {dia.rotulo}
                    </span>

                    <span
                      className={`fuente-club mt-1 text-[20px] font-bold leading-none tabular-nums ${
                        esHoy ? "" : "text-white/85"
                      }`}
                    >
                      {Number(dia.fecha.slice(8, 10))}
                    </span>

                    {/* En el móvil sólo «libre»: con el día de la semana debajo
                        no caben las siete casillas. */}
                    <span
                      className={`mt-1 text-[11px] uppercase tracking-tight sm:text-[11px] sm:tracking-normal ${
                        libre ? "" : "hidden sm:inline"
                      } ${esHoy ? "opacity-80" : "text-white/40"}`}
                    >
                      {libre ? "libre" : dia.nombre.slice(0, 3)}
                    </span>
                  </button>
                );
              })}
            </div>
            </div>

            {/* 30/10/2026 (fútbol): el botón dice qué toca —«Hoy MD-1 ·
                Activación + ABP ofensivo»— con lo escrito en la hoja de
                registro. Sin sesión escrita no sale: el día se sigue
                abriendo pinchando su casilla. */}
            {diaDeHoy && sesionDeHoy.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setDiaAbierto({ fecha: diaDeHoy.fecha, nombre: diaDeHoy.nombre, rotulo: diaDeHoy.rotulo })
                }
                title={`${/^MD-(\d+)$/.test(diaDeHoy.rotulo) ? `${diaDeHoy.rotulo}: ${diaDeHoy.rotulo.slice(3)} ${diaDeHoy.rotulo === "MD-1" ? "día" : "días"} antes del partido. ` : ""}${sesionDeHoy.join(" · ")}`}
                className="group mt-3 flex w-full max-w-full items-center justify-between gap-2 rounded-xl border border-[#D8B45A]/50 bg-[#D8B45A]/10 px-4 py-2.5 text-left text-[13px] font-semibold text-[#F7D98B] transition hover:-translate-y-0.5 hover:bg-[#D8B45A]/20 sm:inline-flex sm:w-auto"
              >
                {/* 07/11/2026 (fútbol): en escritorio, todos los contenidos del día (sin
                    «y 2 más»); en el móvil, el primero y cuántos quedan, en un renglón. */}
                {/* 11/11/2026 (fútbol): el contenido entero también en el móvil, sin «+2»; si no cabe, baja de renglón. */}
                <span className="min-w-0 break-words leading-snug">
                  {/* El día (MD-n) ya está en la etiqueta de la cabecera: aquí sólo la sesión. */}
                  {sesionDeHoy.join(" · ")}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
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
            {/* El estado del microciclo de un vistazo (02/11/2026): cuánto se
                ha recorrido de la semana, cuántas sesiones quedan y los libres. */}
            {(() => {
              const total = semana.length;
              const recorridos = hoy ? semana.filter((dia) => dia.fecha < hoy).length : 0;
              const posicion = Math.min(recorridos + 1, total);
              const quedan = semana.filter((dia) => dia.md > 0 && (!hoy || dia.fecha >= hoy) && !libres.has(dia.fecha)).length;
              const pct = total ? Math.round((posicion / total) * 100) : 0;

              return (
                <div className="mt-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12px]">
                    <span className="font-semibold uppercase tracking-[0.18em] text-white/65">
                      Microciclo · día {posicion} de {total}
                    </span>
                    <span className="text-white/55">
                      {quedan > 0 ? `${quedan} ${quedan === 1 ? "sesión" : "sesiones"} por delante` : "Semana de partido"}
                      {conTarea !== null && libresEnTexto ? ` · libre ${libresEnTexto}` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={posicion} aria-label="Avance del microciclo">
                    <div
                      className="portada-llena h-full rounded-full"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg, #C8A96B, #F7D98B)" }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ---------- Lo que se prepara para ese partido ---------- */}

        {/* Móvil: el azul ocupa la fila y debajo los otros tres en una sola fila (29/10/2026, fútbol). El hueco para el botón flotante lo da ya la portada entera (30/10/2026). Igual en tableta y portátil (02/11/2026): en fila suelta la «Pizarra táctica» se quedaba sola en otra línea. */}
        {/* 09/11/2026: fuera son cuatro accesos; en el móvil, dos por fila («Desplazamiento» no cabía en un cuarto de pantalla). */}
        <div className={`mt-6 grid gap-2 sm:gap-2.5 ${proximo?.lado === "fuera" ? "grid-cols-2 [&>a:first-child]:col-span-2 sm:grid-cols-4 sm:[&>a:first-child]:col-span-4" : "grid-cols-3 [&>a:first-child]:col-span-3"}`}>
          <Link
            href={enlacePlantilla}
            title={nombreRival ? `La plantilla de ${nombreRival}` : undefined}
            onClick={() => trackModuleVisit("/rivals")}
            className="group inline-flex min-h-[48px] items-center justify-center gap-2 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-5 py-3 text-[15px] font-semibold shadow-[0_14px_30px_-14px_rgba(37,99,235,.8)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-14px_rgba(37,99,235,.9)]"
            style={{ color: "#fff", borderRadius: 16 }}
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
            className={CLASE_ACCION}
          >
            <Maximize2 className="h-[17px] w-[17px] shrink-0" style={{ color: "var(--rmcf-gold-ink)" }} />
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
          /*
          | Un solo enlace por destino (30/10/2026): se compara la pantalla, no el
          | rótulo. «PDF y vídeo ABP por jugador» (Hoy) y «Pizarra ABP» (Del
          | rival) llevaban los dos a /abp-pizarra.
          */
          const enBotones = new Set(["/rivals", "/match-preparation", "/abp-microciclo", "/pizarra-tactica", "/desplazamiento"]);

          const deHoy = (hoyToca?.atajos ?? []).filter((atajo) => !enBotones.has(modulo(atajo.href)));

          const yaHoy = new Set(deHoy.map((atajo) => modulo(atajo.href)));

          const delRival = proximo
            ? [
                { href: conRival("/scout-rival-collective"), texto: "Scout colectivo", title: `El informe colectivo de ${nombreRival}` },
                { href: conEquipo("/scout-rival-abp"), texto: "ABP rival", title: `El balón parado de ${nombreRival}, a favor y en contra` },
                { href: conRival("/abp-pizarra"), texto: "Pizarra ABP", title: `Las diapositivas de balón parado del partido contra ${nombreRival}` },
                { href: conAmbos("/duelos"), texto: "Duelos", title: `Nuestro once contra el de ${nombreRival}, puesto a puesto` },
                /* 17/11/2026: «Sus jugadores», no «Individual» (se confundía con nuestras fichas de «Atajos»). */
                { href: conAmbos("/scout-rival-individual"), texto: "Sus jugadores", title: `Los vídeos de los jugadores de ${nombreRival}` },
                /* Antes, un botón suelto al pie de la portada sin contexto (30/10/2026). */
                ...(admin ? [{ href: "/coding?ambito=rival", texto: "Coding", title: `Marcar y cortar los clips de ${nombreRival}` }] : []),
              ].filter((atajo) => !yaHoy.has(modulo(atajo.href)) && !enBotones.has(modulo(atajo.href)))
            : [];

          if (!deHoy.length && !delRival.length && !nombreRival) return null;

          /*
          | Dos filas con rótulo y en chips (30/10/2026, marketing y análisis):
          | «Hoy» y «Del rival». Con puntos medios, en el móvil el «·» quedaba
          | huérfano al principio de línea y los enlaces se apiñaban.
          */
          /* En el móvil, una fila que se desliza (02/11/2026): la rejilla de dos por fila alargaba la portada y se veía tosca. */
          /* 16/11/2026 (rediseño): cada grupo con su rótulo encima y sus accesos en rejilla (dos por fila en el móvil, tres o cuatro en ancho). */
          const fila = (rotulo: ReactNode, atajos: { href: string; texto: string; title?: string; hoy?: boolean }[]) => (
            <div className="min-w-0">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">{rotulo}</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 max-sm:[&>a:last-child:nth-child(odd)]:col-span-2">
                {atajos.map((atajo) => (
                  <Atajo key={atajo.texto} href={atajo.href} texto={atajo.texto} title={atajo.title} hoy={atajo.hoy} />
                ))}
              </div>
            </div>
          );

          /*
          | 10/11/2026 (marketing): en el móvil, «Hoy» y «Del rival» en UNA fila
          | que se desliza, con los rótulos dentro y un fundido (máscara, sin color: vale en modo día) a la derecha que
          | dice que sigue (el corte sin aviso de «Individual» del 05/11 era por
          | no tenerlo). Ahorra dos o tres renglones del héroe. En tableta y
          | escritorio, las dos filas de siempre.
          */
          /*
          | 11/11/2026 (fútbol y marketing): fuera la fila que se deslizaba en
          | el móvil —a 390 px cortaba «Del rival» en el borde—. Dos filas que
          | bajan de renglón en todos los tamaños, cada una con un rótulo que
          | dice para qué es.
          */
          return (
            <div className="mt-5 space-y-4">
              {/* 16/11/2026 (los tres jueces): el rival en vídeo, lo primero de la fila del rival y con su propio rótulo; lo que el cuerpo técnico busca el lunes. */}
              {/* 17/11/2026: de MD-4 a MD-1 el vídeo del rival va en su tarjeta oscura, junto a sus cifras (una sola vez). */}
              {nombreRival && !semanaDelRival ? <VideosDelRival key={nombreRival} rival={nombreRival} /> : null}

              {/*
                17/11/2026 (fútbol): «Hoy toca» y «Más del rival» eran dos
                rejillas; ahora una sola, con lo de hoy primero y marcado en oro.
              */}
              {deHoy.length + delRival.length > 0 &&
                fila(
                  hoyToca && deHoy.length > 0 ? (
                    <>
                      Del rival · <span style={{ color: "var(--rmcf-gold-ink)" }}>lo de hoy ({hoyToca.rotulo}), primero</span>
                    </>
                  ) : (
                    "Del rival"
                  ),
                  [...deHoy.map((a) => ({ ...a, hoy: true })), ...delRival],
                )}
            </div>
          );
        })()}
      </div>

      {/* ---------- Cómo vamos: racha y clasificación ---------- */}

      {/* 16/11/2026 (rediseño): racha y tabla en dos tarjetas iguales, cada cifra grande con su base debajo. */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Racha ultimos={ultimos} cargando={cargando} ultimo={anterior} />

        <Clasificacion informe={informe} jugados={(alrededor?.todos ?? []).filter((uno) => uno.jugado).length} />
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
      className={CLASE_ACCION}
    >
      <Icono className="h-[17px] w-[17px] shrink-0" style={{ color: "var(--rmcf-gold-ink)" }} />
      {texto}
    </Link>
  );
}

/** Los accesos secundarios del partido: tarjeta pequeña, mismo canto y misma sombra que el resto de la portada. */
const CLASE_ACCION =
  "portada-celda portada-viva group inline-flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-2.5 text-center text-[13px] font-semibold leading-tight text-white/85 sm:min-h-[48px] sm:flex-row sm:gap-2 sm:px-4 sm:text-[14px]";

/**
 * Un acceso de la lista «Hoy toca» / «Más del rival» (16/11/2026, rediseño):
 * una fila con su flecha en vez de una píldora suelta; en el móvil, dos por
 * fila, y se lee como una lista, no como una nube de chapas.
 */
function Atajo({ href, texto, title, hoy = false }: { href: string; texto: string; title?: string; hoy?: boolean }) {
  return (
    <Link
      href={href}
      title={title}
      onClick={() => trackModuleVisit(modulo(href))}
      className={`portada-celda portada-viva group flex min-h-[44px] min-w-0 items-center justify-between gap-2 px-3 py-2 text-[13.5px] leading-tight text-white/85 ${hoy ? "font-semibold" : "font-medium"}`}
      style={hoy ? { borderRadius: 12, boxShadow: "inset 3px 0 0 #D8B45A" } : { borderRadius: 12 }}
    >
      <span className="min-w-0 break-words">{texto}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * Los últimos resultados, como se leen en cualquier clasificación: una ficha
 * por partido con el marcador debajo. Desde el 16/11/2026, en su tarjeta
 * (rediseño), con el último partido como base debajo.
 *
 * 17/11/2026 (ronda 20, los tres jueces): cada ficha abre el análisis de ESE
 * partido (Análisis de datos → El partido, con el partido de Opta ya elegido
 * por la fecha). Si Opta no lo tiene, la ficha no es enlace. El histórico
 * sigue a un toque en el icono de la cabecera.
 */
function Racha({ ultimos, cargando, ultimo }: { ultimos: PartidoNuestro[]; cargando: boolean; ultimo?: PartidoNuestro | null }) {
  const { opta } = useOptaLigero();

  /* El id de Opta de cada partido nuestro, por el día. */
  const idPorDia = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of opta?.partidos ?? []) {
      if (f.teamId !== CASTILLA_OPTA) continue;
      const dia = String(f.fecha ?? "").slice(0, 10);
      const id = String(f.partido ?? "");
      if (dia && id) m.set(dia, id);
    }
    return m;
  }, [opta]);

  /* Sin partidos jugados no hay racha que enseñar. */
  if (!cargando && ultimos.length === 0) return null;

  return (
    <div className="portada-celda flex min-w-0 flex-col gap-2.5 p-4">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">
          Castilla · últimos {ultimos.length || 5}
          <span className="ml-1.5 font-medium normal-case tracking-normal text-white/60">· toca uno para su análisis</span>
        </span>
        <Link
          href="/collective_history"
          onClick={() => trackModuleVisit("/collective_history")}
          title="Histórico de competición"
          aria-label="Histórico de competición"
          className="-m-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/40 transition-colors hover:text-[#D8B45A]"
        >
          <History className="h-4 w-4" />
        </Link>
      </span>

      <span className="flex items-center gap-1.5">
        {cargando
          ? Array.from({ length: 5 }, (_, i) => <span key={i} className="h-9 w-9 animate-pulse rounded-lg bg-white/10" />)
          : ultimos.map((partido) => {
              const signo = signoResultado(partido.golesFavor, partido.golesContra);

              const color = signo === "V" ? VERDE : signo === "D" ? NARANJA : "#94A3B8";

              const id = idPorDia.get(partido.cuando.slice(0, 10));

              const titulo = `J${partido.jornada} · ${partido.lado === "casa" ? "en casa con " : "en "}${partido.rival} · ${partido.golesFavor}-${partido.golesContra}`;

              /* 11/11/2026 (análisis): el marcador bajo cada letra; E/V/D ya no pide memoria. */
              const ficha = (
                <>
                  <span
                    className="fuente-club flex h-9 w-9 items-center justify-center rounded-lg text-[18px] font-bold transition-transform group-hover/ficha:-translate-y-0.5"
                    /* La letra con `chipInk`: el gris del empate y el verde
                       sobre el blanco del modo día no llegaban a 3:1. */
                    style={{ background: `${color}22`, color: chipInk(color), border: `1px solid ${color}55` }}
                  >
                    {signo}
                  </span>
                  {partido.golesFavor !== null && partido.golesContra !== null && (
                    <span className="mt-1 text-[12px] font-medium tabular-nums text-white/70">
                      {partido.golesFavor}-{partido.golesContra}
                    </span>
                  )}
                </>
              );

              return id ? (
                <Link
                  key={`${partido.jornada}-${partido.cuando}`}
                  href={`/data-analisis?area=directo&partido=${encodeURIComponent(id)}`}
                  onClick={() => trackModuleVisit("/data-analisis")}
                  title={`${titulo} · su análisis`}
                  aria-label={`${titulo}: abrir su análisis`}
                  className="group/ficha flex w-10 flex-col items-center rounded-lg"
                >
                  {ficha}
                </Link>
              ) : (
                <span key={`${partido.jornada}-${partido.cuando}`} title={titulo} className="flex w-10 flex-col items-center">
                  {ficha}
                </span>
              );
            })}
      </span>

      {!cargando && ultimo && ultimo.golesFavor !== null && ultimo.golesContra !== null && (
        /* Con fecha y jornada (07/11/2026, análisis). */
        <span className="text-[12.5px] leading-snug text-white/65">
          El último: <span className="font-semibold text-white/90">{ultimo.golesFavor}-{ultimo.golesContra} {ultimo.lado === "casa" ? "en casa con" : "en"} {ultimo.rival}</span>
          {(() => {
            const cuando = [ultimo.jornada ? `J${ultimo.jornada}` : "", diaCorto(ultimo.cuando)].filter(Boolean).join(" · ");

            return cuando ? <span> · {cuando}</span> : null;
          })()}
        </span>
      )}
    </div>
  );
}

/** «dom 1 nov»: el día del último partido, corto. */
function diaCorto(cuando: string) {
  const fecha = new Date(cuando);

  if (Number.isNaN(fecha.getTime())) return "";

  return fecha
    .toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" })
    .replace(/\./g, "")
    .replace(",", "");
}

/** Nuestra fila de la tabla, en su tarjeta: el puesto en grande y la base debajo. Lleva al equipo de un vistazo. */
function Clasificacion({ informe, jugados = 0 }: { informe: RespuestaPortada | null; jugados?: number }) {
  const fila = informe?.clasificacion ?? null;

  /* Con la lectura hecha y sin fila nuestra no hay nada que decir. */
  if (informe !== null && !fila) return null;

  const pj = fila ? fila.ganados + fila.empatados + fila.perdidos : 0;

  return (
    <Link
      href={`/data-analisis?area=equipo&equipo=${encodeURIComponent("Real Madrid Castilla")}`}
      onClick={() => {
        /* 17/11/2026 (ronda 21): abría con el próximo rival aunque el título promete el Castilla. */
        ponEquipoElegido("Real Madrid Castilla");
        trackModuleVisit("/data-analisis");
      }}
      className="portada-celda portada-viva group flex min-w-0 flex-col gap-2 p-4"
      title="El Castilla de un vistazo, en Data Análisis"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">
          Liga
          <span className="ml-1.5 font-medium normal-case tracking-normal text-white/55">· BeSoccer</span>
        </span>
        <Trophy className="h-4 w-4 shrink-0 text-white/40 transition-colors group-hover:text-[#D8B45A]" />
      </span>

      {informe === null ? (
        <span className="h-10 w-40 animate-pulse rounded bg-white/10" />
      ) : fila ? (
        <>
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="fuente-club text-[40px] font-bold leading-[0.9] tabular-nums text-white">{fila.puesto}º</span>
            <span className="text-[14px] text-white/65">de {fila.deCuantos}</span>
            <span className="ml-auto text-[14px] tabular-nums text-white/70">
              <span className="fuente-club text-[24px] font-bold text-white">{fila.puntos}</span> pts
            </span>
          </span>

          {/* La base pegada a la cifra: partidos, balance y goles. */}
          <span className="text-[12.5px] leading-snug tabular-nums text-white/65">
            {pj} partidos · {fila.ganados}V {fila.empatados}E {fila.perdidos}D · {fila.favor} goles a favor y {fila.contra} en contra
          </span>

          {/* Si el calendario ya tiene más partidos jugados que la tabla, se dice (expertos: 11 frente a 12 confundía). */}
          {jugados > pj && (
            <span className="text-[12px] font-semibold" style={{ color: "var(--rmcf-gold-ink)" }}>
              Sin la última jornada ({pj} de {jugados})
            </span>
          )}
        </>
      ) : null}
    </Link>
  );
}

export default ProximoPartido;
