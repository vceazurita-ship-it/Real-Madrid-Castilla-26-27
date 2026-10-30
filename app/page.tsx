"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  ArrowRight,
  BarChart3,
  ChevronRight,
  LayoutGrid,
  Sigma,
  Users,
} from "lucide-react"

import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import ModulesExplorer from "@/components/ui/ModulesExplorer"
import { AlertasPortada } from "@/components/portada/AlertasPortada"
import { Cifras } from "@/components/portada/Cifras"
import { ProximoPartido } from "@/components/portada/ProximoPartido"
import { MisTareas } from "@/components/portada/MisTareas"
import { useAdmin } from "@/hooks/useAdmin"
import { trackModuleVisit } from "@/lib/module-usage"
import { usePlayers } from "@/hooks/usePlayers"
import { alineaSeguimiento, esDeSeguimiento, filasDeSeguimiento } from "@/lib/seguimiento"
import { SESIONES_CONTADAS_DESDE } from "@/lib/sesion-equipos/estadistica"
import { traeJson } from "@/lib/hojaCsv"
import { EstadoError } from "@/components/ui/estados"

type Seguimiento = {
  ID_JUGADOR?: string
  /* El nombre manda sobre el ID al atar cada registro: ver `lib/seguimiento`. */
  NOMBRE?: string
  FECHA?: string
}

const ENDPOINT_SEGUIMIENTO = "/api/rivals?action=seguimiento"

/**
 * Tiempo máximo de cada bloque lento. Con la copia del aparato la respuesta es
 * inmediata; sin ella el Apps Script en frío puede tardar 30-70 s, y un bloque
 * en esqueleto sin final no dice si hay algo roto. Pasado el tope el bloque
 * pinta su fallo y el «Reintentar» de siempre (que se salta la copia).
 */
const TOPE_BLOQUE_MS = 20_000

function conTope<T>(promesa: Promise<T>, ms = TOPE_BLOQUE_MS): Promise<T> {
  return new Promise<T>((resuelve, rechaza) => {
    const reloj = setTimeout(() => rechaza(new Error("tarda")), ms)

    promesa.then(
      (v) => {
        clearTimeout(reloj)
        resuelve(v)
      },
      (e) => {
        clearTimeout(reloj)
        rechaza(e)
      },
    )
  })
}

/*
| 30/10/2026: fuera de «El equipo en cifras» Ataque, Defensa y Cultura (el
| tamaño de los documentos del modelo, no rendimiento) y con ellas las dos
| hojas que se leían sólo para contarlas.
*/

/* ---------------------------------------------------------------
   Piezas compartidas.

   Un único sistema visual: el dorado es el color de la interfaz
   (rótulos, métricas propias) y el color solo cambia cuando
   identifica algo —el área de un módulo, la fase de juego—.
--------------------------------------------------------------- */

/**
 * Goles, esperados y la diferencia por partido con los MISMOS totales que se
 * leen en la tarjeta (29/10/2026): goles enteros y xG con un decimal. Sin xG
 * o sin partidos, la diferencia es la que llega.
 */
function golesFrenteXg(xg: number | null, golesMenosXg: number, partidos: number) {
  if (xg == null || !partidos) return { goles: 0, esperados: 0, diferencia: golesMenosXg }

  const goles = Math.round((xg + golesMenosXg) * partidos)
  const esperados = Math.round(xg * partidos * 10) / 10

  return { goles, esperados, diferencia: (goles - esperados) / partidos }
}

function SectionHeader({
  icon: Icon,
  title,
  caption,
}: {
  icon: React.ElementType
  title: string
  caption?: string
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#D8B45A]/25 bg-[#D8B45A]/[0.08]">
          <Icon className="h-4 w-4 text-[#D8B45A]" />
        </span>

        <h2 className="text-[13px] font-semibold uppercase tracking-[0.3em] text-white/85">
          {title}
        </h2>
      </div>

      {caption && (
        <p className="text-[12px] text-white/35">{caption}</p>
      )}
    </div>
  )
}

export default function Home() {
  /* «Mis tareas» del microciclo: una pestaña sólo para el administrador (28/10/2026). */
  const { admin } = useAdmin()
  const [vista, setVista] = useState<"portada" | "tareas">("portada")
  /* En el móvil las áreas de trabajo arrancan plegadas (29/10/2026). */
  const [verAreas, setVerAreas] = useState(false)
  const enTareas = admin && vista === "tareas"

  /*
  |------------------------------------------------------------------------
  | DATA ANÁLISIS EN LA PORTADA
  |------------------------------------------------------------------------
  |
  | La tarjeta grande de la derecha llevaba al módulo más abierto, que es una
  | información que ya da el acceso rápido de más abajo. Ahora lleva a Data
  | Análisis y **enseña dos cifras suyas**: sin ellas sería un enlace más, y
  | con ellas la portada dice de un vistazo cómo va el equipo.
  |
  | Se pide `?resumen=1` a propósito: el dataset entero es un mega y medio de
  | JSON y aquí sólo caben dos números. Los calcula el servidor con las mismas
  | funciones que la pantalla, así que no pueden discrepar.
  */
  type ResumenData = {
    temporada: string
    partidos: number
    equipos: number
    xg: number | null
    puesto: number | null
    deCuantos: number
    tope: number | null
    mediana?: number | null
    golesMenosXg: number | null
  }

  const [resumenData, setResumenData] = useState<ResumenData | null>(null)
  const [cargandoData, setCargandoData] = useState(true)

  const [filasSeguimiento, setFilasSeguimiento] = useState<Seguimiento[]>([])

  /* La hora a la que se abrió la pantalla, apuntada en un efecto: el linter
     de React no deja mirar el reloj dentro del render. */
  const [ahora, setAhora] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0)

    return () => clearTimeout(id)
  }, [])

  /* La ventana de treinta días se cuenta al llegar los datos y no al pintar:
     mirar el reloj durante el render es impuro y el linter lo para. */

  /*
  |------------------------------------------------------------------------
  | LA COBERTURA NO PUEDE PASAR DEL 100%
  |------------------------------------------------------------------------
  |
  | Y pasaba. Se contaban **todos los ID_JUGADOR distintos que aparecen en la
  | hoja de seguimiento** y se dividían entre la plantilla de ahora, que son
  | dos listas distintas: en el numerador entraban los que se fueron en verano
  | y los identificadores viejos —los JUG-XX se renumeraron en agosto de 2026,
  | ver `lib/seguimiento.ts`—, así que el número subía por encima del cien
  | mientras la barrita se quedaba clavada al tope y no lo delataba.
  |
  | Lo que se quiere saber es **a cuántos de los que están hoy se les ha hecho
  | seguimiento**, que es exactamente lo que cuenta la pantalla de
  | `/individual_proc`. Así los dos sitios dicen lo mismo.
  */
  const { players: plantillaEntera, loading: cargandoPlantilla } = usePlayers()

  /*
  | SÓLO LOS JUGADORES DE CAMPO DEL CASTILLA (11/10/2026)
  |
  | Las alertas y las cifras de seguimiento de esta pantalla cuentan a los
  | mismos que el Dashboard Seguimiento: licencia del Castilla y no portero
  | (`esDeSeguimiento`, en `lib/seguimiento.ts`). Los del RMC y del juvenil
  | que vienen a entrenar llevan su seguimiento en su equipo, y aquí sólo
  | hacían ruido: avisos de «lleva 45 días sin seguimiento» sobre gente que
  | no es nuestra y una cobertura hundida.
  |
  | El cruce por nombre se hace contra la plantilla ENTERA y se filtra
  | después: un registro de un portero o de uno del RMC tiene que resolverse a
  | su dueño, o se quedaría con un ID viejo que hoy puede ser de uno nuestro.
  */
  const plantilla = useMemo(
    () => plantillaEntera.filter(esDeSeguimiento),
    [plantillaEntera],
  )

  const totalJugadores = plantilla.length

  /* Los registros que son de los nuestros, ya atados a su jugador de ahora (todos, sin corte de fecha). */
  const seguimientoTodo = useMemo(() => {
    if (plantillaEntera.length === 0) return []

    return filasDeSeguimiento(
      alineaSeguimiento(
        filasSeguimiento.flatMap((fila) =>
          fila.ID_JUGADOR ? [{ ...fila, ID_JUGADOR: fila.ID_JUGADOR }] : [],
        ),
        plantillaEntera,
      ),
      plantilla,
    )
  }, [filasSeguimiento, plantillaEntera, plantilla])

  /* Los de las cifras: sólo desde el 21/10. */
  const seguimientoCastilla = useMemo(() => {
    if (plantillaEntera.length === 0) return []

    /* Por nombre, que es lo que manda: un ID viejo apunta hoy a otra persona. */
    const atados = alineaSeguimiento(
      filasSeguimiento.flatMap((fila) =>
        fila.ID_JUGADOR ? [{ ...fila, ID_JUGADOR: fila.ID_JUGADOR }] : [],
      ),
      plantillaEntera,
    )

    /* Sólo cuentan los registros desde el día en que se empezó a contar. */
    const desde = new Date(SESIONES_CONTADAS_DESDE).getTime()

    return filasDeSeguimiento(atados, plantilla).filter((fila) => {
      const fecha = new Date(fila.FECHA ?? "").getTime()

      return Number.isFinite(fecha) && fecha >= desde
    })
  }, [filasSeguimiento, plantillaEntera, plantilla])

  const jugadoresSeguimiento = useMemo(
    () => new Set(seguimientoCastilla.map((fila) => fila.ID_JUGADOR)).size,
    [seguimientoCastilla],
  )

  const seguimientos = seguimientoCastilla.length

  /* Y los de los últimos 30 días, de esos mismos registros. El reloj se mira
     en un efecto (ver `ahora`), nunca en el render. */
  const ultimos30Dias = useMemo(() => {
    if (ahora === 0) return 0

    const limite = ahora - 30 * 24 * 60 * 60 * 1000

    return seguimientoCastilla.filter((fila) => {
      const fecha = new Date(fila.FECHA ?? "").getTime()

      return Number.isFinite(fecha) && fecha >= limite
    }).length
  }, [seguimientoCastilla, ahora])

  /* Los de la última semana (29/10/2026, análisis): con la temporada empezada
     hace menos de un mes, «34» y «34 en los últimos 30 días» decían lo mismo. */
  const ultimos7Dias = useMemo(() => {
    if (ahora === 0) return 0

    const limite = ahora - 7 * 24 * 60 * 60 * 1000

    return seguimientoCastilla.filter((fila) => {
      const fecha = new Date(fila.FECHA ?? "").getTime()

      return Number.isFinite(fecha) && fecha >= limite
    }).length
  }, [seguimientoCastilla, ahora])

  const cobertura =
    totalJugadores > 0
      ? Math.round((jugadoresSeguimiento / totalJugadores) * 100)
      : 0

  // Estados de carga: evitan el parpadeo de ceros mientras llegan los datos.
  const [loadingSeguimiento, setLoadingSeguimiento] = useState(true)

  /*
  |------------------------------------------------------------------------
  | UN FALLO NO ES UN CERO (11/10/2026)
  |------------------------------------------------------------------------
  |
  | Cuando una hoja no contestaba, el error se tragaba y las cifras se
  | quedaban en 0: «0 seguimientos», «0 % de cobertura», como si no hubiera
  | nada registrado. Ahora cada carga apunta si falló; la cifra pinta «—» y
  | debajo de la fila hay un «Reintentar» que vuelve a pedirlas saltándose
  | la copia (`forzar`). Las que llegaron bien no se tocan.
  |
  | Todo entra por `traeCsv`/`traeJson`: la portada pinta al momento con la
  | copia del aparato y lo nuevo llega por detrás.
  */
  const [errorSeguimiento, setErrorSeguimiento] = useState(false)
  const [errorData, setErrorData] = useState(false)

  const [intentos, setIntentos] = useState(0)

  const reintentar = () => {
    /* Sólo vuelven a «cargando» las que fallaron: las demás ya se ven. */
    if (errorSeguimiento) setLoadingSeguimiento(true)
    if (errorData) setCargandoData(true)

    setErrorSeguimiento(false)
    setErrorData(false)

    setIntentos((n) => n + 1)
  }

  useEffect(() => {
    let vivo = true

    conTope(traeJson<unknown>(ENDPOINT_SEGUIMIENTO, { forzar: intentos > 0 }))
      .then((data) => {
        if (!vivo) return

        const filas: Seguimiento[] = Array.isArray(data) ? data : []

        setFilasSeguimiento(filas)
        setErrorSeguimiento(false)
      })
      .catch(() => {
        if (vivo) setErrorSeguimiento(true)
      })
      .finally(() => {
        if (vivo) setLoadingSeguimiento(false)
      })

    return () => {
      vivo = false
    }
  }, [intentos])

  useEffect(() => {
    let vivo = true

    conTope(traeJson<{ ok?: boolean; resumen?: ResumenData }>("/api/data-analisis?resumen=1", { forzar: intentos > 0 }))
      .then((r) => {
        if (!vivo) return

        if (r?.ok && r.resumen) {
          setResumenData(r.resumen)
          setErrorData(false)
        } else {
          setErrorData(true)
        }
      })
      .catch(() => {
        if (vivo) setErrorData(true)
      })
      .finally(() => {
        if (vivo) setCargandoData(false)
      })

    return () => {
      vivo = false
    }
  }, [intentos])

  const hayFallos = errorSeguimiento || errorData

  return (
    <main className="min-h-screen bg-[#02060D] text-white">
      <div className="flex">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Topbar />

          {/* pb-24: el botón flotante de herramientas no tapa la última fila (30/10/2026). */}
          <section className="space-y-12 p-4 pb-24 sm:p-6 sm:pb-24 xl:space-y-14 xl:p-10 xl:pb-24">
            {admin && (
              <div role="tablist" className="flex gap-2">
                {(["portada", "tareas"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={vista === v}
                    onClick={() => setVista(v)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold ${vista === v ? "bg-[#D8B45A] text-[#0B0F14]" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
                  >
                    {v === "portada" ? "Portada" : "Mis tareas"}
                  </button>
                ))}
              </div>
            )}

            {enTareas ? <MisTareas /> : (<>
            {/* ============================ PORTADA ============================ */}

            <div className="relative overflow-hidden rounded-[28px] border border-[#173A61]/60 bg-[#030B15] shadow-[0_0_80px_rgba(0,80,255,.08)] xl:rounded-[36px]">
              {/* Fondo ambiental: estadio + halos de color */}
              <Image
                src="/stadium-bg.png"
                alt=""
                fill
                sizes="100vw"
                /* Es la imagen grande de la portada: `priority` la saca de la
                   carga perezosa además de subirle la prioridad de red, que es
                   lo único que hacía `fetchPriority` por su cuenta. */
                priority
                className="pointer-events-none object-cover opacity-[0.10]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#030B15]/60 to-[#030B15]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(59,130,246,.20),transparent_38%)]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_85%,rgba(216,180,90,.12),transparent_35%)]"
              />

              <div className="relative z-10 grid items-stretch gap-8 p-5 sm:p-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)] xl:gap-10 xl:p-10">
                {/* ---------- IZQUIERDA: el próximo partido y la semana ---------- */}

                {/*
                  Lo que antes era el nombre de la plataforma en grande —que ya
                  está en la cabecera— ahora es el partido que viene, con sus
                  accesos. Ver components/portada/ProximoPartido.tsx.
                */}
                <ProximoPartido />

                {/* ---------- DERECHA: visión global ---------- */}

                <Link
                  href="/data-analisis"
                  onClick={() => trackModuleVisit("/data-analisis")}
                  title="Lo que dicen los informes de Opta y Wyscout: el Castilla contra su historia, contra la liga y la categoría entera"
                  className="light-sweep group relative block min-h-[440px] overflow-hidden rounded-[28px] border border-white/10 sm:min-h-[320px] xl:min-h-[400px]"
                >
                  <div
                    aria-hidden
                    className="animate-pulse-glow absolute left-1/2 top-1/2 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl"
                  />

                  <div className="particles" aria-hidden />

                  <Image
                    src="/hero-field.webp"
                    alt=""
                    fill
                    sizes="(max-width: 1279px) 100vw, 480px"
                    className="animate-hero object-cover transition-transform duration-[4000ms] group-hover:scale-110"
                  />

                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-[#02060D]/90 via-[#02060D]/25 to-transparent"
                  />

                  {/* La chapa dice a dónde lleva la tarjeta. Va en el dorado de
                      la casa, que es el color con el que Data Análisis pinta lo
                      nuestro en todos sus gráficos. */}
                  <div className="absolute left-5 top-5 max-w-[calc(100%-40px)]">
                    <div
                      className="flex items-center gap-2.5 rounded-full border border-[#D8B45A]/35 px-4 py-2 backdrop-blur-xl transition group-hover:border-[#D8B45A]/70"
                      /* Fondo opaco en línea: ni el modo día ni la foto clara
                         del césped lo aclaran (contraste medido 1,15). */
                      style={{ backgroundColor: "rgba(2,6,13,.94)" }}
                    >
                      <Sigma className="h-[15px] w-[15px] shrink-0 text-[#F7D98B]" />

                      <p className="truncate text-[11px] font-medium uppercase tracking-[0.22em] text-[#F7D98B]">
                        Data Análisis
                      </p>

                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#F7D98B]/70 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </div>
                  </div>

                  {/* Y debajo, de qué se está hablando: sin esto la cifra de
                      abajo podría ser de cualquier cosa. */}
                  {/* El césped de la foto es claro: sin fondo propio esta línea
                      se pierde. Va con el mismo cristal que la chapa. */}
                  <div className="absolute left-5 top-[58px] max-w-[calc(100%-40px)]">
                    <p className="inline-block rounded-full border border-white/10 px-3.5 py-1.5 text-[12px] leading-relaxed backdrop-blur-xl" style={{ color: "#fff", backgroundColor: "rgba(2,6,13,.94)" }}>
                      {resumenData
                        /* Más corta (30/10/2026): a 390 px se cortaba y pisaba la tarjeta. Un solo término: «del grupo». */
                        ? `${resumenData.partidos} ${resumenData.partidos === 1 ? "partido" : "partidos"} de ${resumenData.temporada} · frente a los ${resumenData.equipos} del grupo`
                        : "Opta y Wyscout, leídos de la carpeta de datos"}
                    </p>
                  </div>

                  {/*
                    Pie del panel: dos cifras de Data Análisis.

                    El xG por partido con su puesto en la categoría —que es lo
                    que contesta «¿generamos?»— y lo que se marca por encima de
                    lo que valían las ocasiones, que es la otra mitad. La barra
                    mide contra el mejor de la liga, no contra cien: así el
                    trozo lleno significa algo.

                    Sólo se pinta mientras carga (esqueleto) o si hay dato: sin
                    informes, o si la lectura falló, la tarjeta se queda con la
                    foto y su rótulo, sin un hueco a medias. Los textos van con
                    color fijo (`style`): el panel es siempre oscuro y en modo
                    día el blanco por clase se volvía tinta oscura sobre negro.
                  */}
                  {(cargandoData || resumenData?.xg != null) && (
                  <div
                    className="absolute inset-x-4 bottom-4 flex flex-col gap-4 rounded-[22px] border border-white/10 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between xl:flex-col xl:items-stretch xl:justify-start"
                    style={{ backgroundColor: "rgba(2,6,13,.94)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.9)" }}>
                        Goles esperados (xG) por partido
                      </p>

                      <p className="mt-2 text-3xl font-bold leading-none" style={{ color: "#fff" }}>
                        {cargandoData || resumenData?.xg == null ? (
                          <span className="inline-block h-7 w-16 animate-pulse rounded bg-white/10 align-middle" />
                        ) : (
                          resumenData.xg.toFixed(2).replace(".", ",")
                        )}
                      </p>

                      <div className="mt-3 h-1 w-36 max-w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#D8B45A] to-[#F7D98B] transition-[width] duration-1000 ease-out"
                          style={{
                            width: `${
                              resumenData?.xg && resumenData.tope
                                ? Math.min((resumenData.xg / resumenData.tope) * 100, 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>

                      {resumenData?.xg != null && (
                        <p className="mt-2 break-words text-[12px] leading-snug" style={{ color: "rgba(255,255,255,.9)" }}>
                          {resumenData.partidos} {resumenData.partidos === 1 ? "partido" : "partidos"}
                          {resumenData.puesto
                            ? ` · ${resumenData.puesto}º de ${resumenData.deCuantos} del grupo${resumenData.mediana != null ? ` · mediana del grupo: ${resumenData.mediana.toFixed(2).replace(".", ",")}` : ""}`
                            : ""}
                        </p>
                      )}
                    </div>

                    {(cargandoData || resumenData?.golesMenosXg != null) && (
                      <div className="min-w-0 sm:shrink-0 sm:text-right xl:text-left">
                        <p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.9)" }}>
                          Goles por partido frente a lo esperado
                        </p>

                        <p
                          className="mt-2 text-3xl font-bold leading-none"
                          style={{
                            color:
                              resumenData?.golesMenosXg == null
                                ? "rgb(255 255 255 / .4)"
                                : resumenData.golesMenosXg >= 0
                                  ? "#34D399"
                                  : "#FB923C",
                          }}
                        >
                          {cargandoData || resumenData?.golesMenosXg == null ? (
                            <span className="inline-block h-7 w-16 animate-pulse rounded bg-white/10 align-middle" />
                          ) : (
                            /* 29/10/2026 (análisis): la cifra sale de los mismos totales
                               redondeados que se leen debajo (11 y 18,8 en 9 → −0,87),
                               para que la cuenta cuadre al hacerla a mano. */
                            (() => {
                              const d = golesFrenteXg(resumenData.xg, resumenData.golesMenosXg, resumenData.partidos).diferencia;

                              return `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(2).replace(".", ",")}`;
                            })()
                          )}
                        </p>

                        {resumenData?.golesMenosXg != null && (
                          <p className="mt-1 break-words text-[12px] leading-snug" style={{ color: "rgba(255,255,255,.9)" }}>
                            {resumenData.xg != null && (() => {
                              const t = golesFrenteXg(resumenData.xg, resumenData.golesMenosXg, resumenData.partidos);

                              return `${t.goles} goles frente a ${t.esperados.toFixed(1).replace(".", ",")} esperados en ${resumenData.partidos} partidos · `;
                            })()}
                            {resumenData.golesMenosXg >= 0
                              ? "marcamos más de lo esperado"
                              : "marcamos menos de lo esperado"}
                            {/* Con menos de 15 partidos es tendencia, no veredicto (30/10/2026). */}
                            {resumenData.partidos < 15 ? ` · tendencia en ${resumenData.partidos} partidos` : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  )}

                  <div className="scan-line" aria-hidden />
                </Link>
              </div>
            </div>

            {/* =========================== ALERTAS ============================ */}

            {/*
              Va justo debajo de la portada y antes de los accesos a propósito:
              es lo único de esta pantalla que **no se sabe de antes**. Los
              accesos y los módulos están siempre ahí; esto cambia cada semana y
              es lo que hace que abrir la aplicación sirva para algo aunque no
              se venga a nada concreto. Si no hay nada que avisar, no se pinta.
            */}
            {/* Las alertas miran la última vez de cada uno, aunque sea de antes del 21/10:
                con el corte, quien no tenía registro esta semana salía «más de 45 días». */}
            <AlertasPortada plantilla={plantilla} seguimiento={seguimientoTodo} />

            {/* ACCESO RÁPIDO, fuera (30/10/2026): repetía los botones del héroe
                y la rejilla de áreas; tres caminos al mismo sitio. */}

            {/* ========================== CIFRAS =============================== */}

            {/*
              Seguimiento y modelo de juego en una sola fila. Antes eran dos
              secciones de tres tarjetas y las áreas de trabajo quedaban a dos
              pantallas de distancia. Cada celda sigue diciendo a dónde lleva.
            */}
            <div>
              <SectionHeader
                icon={BarChart3}
                title="El equipo en cifras"
                caption="Seguimiento de los jugadores de campo del Castilla, en vivo de la hoja"
              />

              <div className="mt-5">
                <Cifras
                  cifras={[
                    {
                      href: "/calendar",
                      label: "Seguimientos",
                      value: errorSeguimiento ? null : seguimientos,
                      caption: errorSeguimiento
                        ? "sin datos"
                        : ultimos30Dias === seguimientos
                          ? `${ultimos7Dias} en la última semana`
                          : `${ultimos30Dias} en los últimos 30 días`,
                      destino: "Calendario Seguimiento",
                      loading: loadingSeguimiento,
                      icon: Activity,
                    },
                    {
                      href: "/individual",
                      label: "Del Castilla",
                      value: totalJugadores,
                      caption: errorSeguimiento ? "sin datos de seguimiento" : `${cobertura} % con seguimiento`,
                      destino: "Plantilla",
                      loading: cargandoPlantilla,
                      icon: Users,
                    },
                  ]}
                />
              </div>

              {/* Sólo cuando algo no ha llegado: la fila ya enseña «—» donde
                  falta, y esto es el botón para volver a pedirlo. */}
              {hayFallos && (
                <EstadoError
                  className="mt-3"
                  titulo="No se han podido cargar todas las cifras"
                  onReintentar={reintentar}
                  reintentando={loadingSeguimiento || cargandoData}
                />
              )}
            </div>

            {/* ======================== ÁREAS DE TRABAJO ======================= */}

            <div className="border-t border-white/[0.07] pt-10">
              <SectionHeader
                icon={LayoutGrid}
                title="Áreas de trabajo"
                caption="Las mismas del menú lateral"
              />

              {/* Móvil (29/10/2026, análisis): las 46 tarjetas eran pantallas y
                  pantallas de scroll. 30/10/2026: también en escritorio, que
                  repetían el menú lateral; el buscador y las primeras, y el resto
                  detrás de «Ver todas las áreas». */}
              <div
                className={
                  verAreas
                    ? ""
                    : "relative max-h-[560px] overflow-hidden"
                }
              >
                <ModulesExplorer />

                {!verAreas && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#02060D] to-transparent"
                  />
                )}
              </div>

              {!verAreas && (
                <button
                  type="button"
                  onClick={() => setVerAreas(true)}
                  className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white sm:w-auto"
                >
                  Ver todas las áreas
                </button>
              )}
            </div>

            {/*
              El coding de rival, discreto.

              Es una herramienta de una persona —quien prepara el análisis
              individual del rival—, no del cuerpo técnico entero, así que no
              se le da una tarjeta en las áreas de trabajo: vive aquí abajo,
              donde lo encuentra quien lo busca y no distrae a quien no.
            */}
            {admin && <div className="flex justify-center pb-2 pt-6">
              <Link
                href="/coding?ambito=rival"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/65 transition-colors hover:border-white/25 hover:text-white"
              >
                Abrir el coding de rival
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>}
            </>)}
          </section>
        </div>
      </div>
    </main>
  )
}
