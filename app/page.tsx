"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import {
  Activity,
  BarChart3,
  ChevronRight,
  Handshake,
  LayoutGrid,
  Shield,
  Sigma,
  Swords,
  Users,
} from "lucide-react"

import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import ModulesExplorer from "@/components/ui/ModulesExplorer"
import QuickAccess from "@/components/ui/QuickAccess"
import { AlertasPortada } from "@/components/portada/AlertasPortada"
import { Cifras } from "@/components/portada/Cifras"
import { ProximoPartido } from "@/components/portada/ProximoPartido"
import { trackModuleVisit } from "@/lib/module-usage"
import { usePlayers } from "@/hooks/usePlayers"
import { alineaSeguimiento, esDeSeguimiento, filasDeSeguimiento } from "@/lib/seguimiento"
import { traeCsv, traeJson } from "@/lib/hojaCsv"
import { EstadoError } from "@/components/ui/estados"

type Principio = {
  FASE: string
  BLOQUE: string
  APARTADO: string
}

type Seguimiento = {
  ID_JUGADOR?: string
  /* El nombre manda sobre el ID al atar cada registro: ver `lib/seguimiento`. */
  NOMBRE?: string
  FECHA?: string
}

const ENDPOINT_SEGUIMIENTO = "/api/rivals?action=seguimiento"

const CSV_CULTURA =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1367356753&single=true&output=csv"

const CSV_PRINCIPIOS =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1322156567&single=true&output=csv"

/* ---------------------------------------------------------------
   Piezas compartidas.

   Un único sistema visual: el dorado es el color de la interfaz
   (rótulos, métricas propias) y el color solo cambia cuando
   identifica algo —el área de un módulo, la fase de juego—.
--------------------------------------------------------------- */

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

  const [ataqueApartados, setAtaqueApartados] = useState(0)
  const [defensaApartados, setDefensaApartados] = useState(0)
  const [principiosCultura, setPrincipiosCultura] = useState(0)

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

  /* Los registros que son de los nuestros, ya atados a su jugador de ahora. */
  const seguimientoCastilla = useMemo(() => {
    if (plantillaEntera.length === 0) return []

    /* Por nombre, que es lo que manda: un ID viejo apunta hoy a otra persona. */
    const atados = alineaSeguimiento(
      filasSeguimiento.flatMap((fila) =>
        fila.ID_JUGADOR ? [{ ...fila, ID_JUGADOR: fila.ID_JUGADOR }] : [],
      ),
      plantillaEntera,
    )

    return filasDeSeguimiento(atados, plantilla)
  }, [filasSeguimiento, plantillaEntera, plantilla])

  const { jugadoresSeguimiento, sesionesDeLaPlantilla } = useMemo(() => {
    const conRegistro = new Set<string>()

    for (const fila of seguimientoCastilla) conRegistro.add(fila.ID_JUGADOR)

    return {
      jugadoresSeguimiento: conRegistro.size,
      sesionesDeLaPlantilla: seguimientoCastilla.length,
    }
  }, [seguimientoCastilla])

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

  /* El promedio, sólo con lo de los que siguen aquí: las sesiones de quien se
     fue no se reparten entre los que están. Es el mismo cálculo que hace el
     dashboard de seguimiento, para que las dos pantallas no se contradigan. */
  const promedioSeguimientos =
    jugadoresSeguimiento > 0
      ? Number((sesionesDeLaPlantilla / jugadoresSeguimiento).toFixed(1))
      : 0

  const cobertura =
    totalJugadores > 0
      ? Math.round((jugadoresSeguimiento / totalJugadores) * 100)
      : 0

  // Estados de carga: evitan el parpadeo de ceros mientras llegan los datos.
  const [loadingCultura, setLoadingCultura] = useState(true)
  const [loadingPrincipios, setLoadingPrincipios] = useState(true)
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
  const [errorCultura, setErrorCultura] = useState(false)
  const [errorPrincipios, setErrorPrincipios] = useState(false)
  const [errorSeguimiento, setErrorSeguimiento] = useState(false)
  const [errorData, setErrorData] = useState(false)

  const [intentos, setIntentos] = useState(0)

  const reintentar = () => {
    /* Sólo vuelven a «cargando» las que fallaron: las demás ya se ven. */
    if (errorCultura) setLoadingCultura(true)
    if (errorPrincipios) setLoadingPrincipios(true)
    if (errorSeguimiento) setLoadingSeguimiento(true)
    if (errorData) setCargandoData(true)

    setErrorCultura(false)
    setErrorPrincipios(false)
    setErrorSeguimiento(false)
    setErrorData(false)

    setIntentos((n) => n + 1)
  }

  useEffect(() => {
    let vivo = true

    traeCsv(CSV_CULTURA, { forzar: intentos > 0 })
      .then((csv) => {
        if (!vivo) return

        const parsed = Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
        })

        setPrincipiosCultura(parsed.data.length)
        setErrorCultura(false)
      })
      .catch(() => {
        if (vivo) setErrorCultura(true)
      })
      .finally(() => {
        if (vivo) setLoadingCultura(false)
      })

    return () => {
      vivo = false
    }
  }, [intentos])

  useEffect(() => {
    let vivo = true

    traeCsv(CSV_PRINCIPIOS, { forzar: intentos > 0 })
      .then((csv) => {
        if (!vivo) return

        const parsed = Papa.parse<Principio>(csv, {
          header: true,
          skipEmptyLines: true,
        })

        const rows = parsed.data

        const ataque = [
          ...new Set(
            rows.filter((r) => r.FASE === "ATAQUE").map((r) => r.APARTADO)
          ),
        ]

        const defensa = [
          ...new Set(
            rows.filter((r) => r.FASE === "DEFENSA").map((r) => r.APARTADO)
          ),
        ]

        setAtaqueApartados(ataque.length)
        setDefensaApartados(defensa.length)
        setErrorPrincipios(false)
      })
      .catch(() => {
        if (vivo) setErrorPrincipios(true)
      })
      .finally(() => {
        if (vivo) setLoadingPrincipios(false)
      })

    return () => {
      vivo = false
    }
  }, [intentos])

  useEffect(() => {
    let vivo = true

    traeJson<unknown>(ENDPOINT_SEGUIMIENTO, { forzar: intentos > 0 })
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

    traeJson<{ ok?: boolean; resumen?: ResumenData }>("/api/data-analisis?resumen=1", { forzar: intentos > 0 })
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

  const hayFallos = errorCultura || errorPrincipios || errorSeguimiento || errorData

  return (
    <main className="min-h-screen bg-[#02060D] text-white">
      <div className="flex">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Topbar />

          <section className="space-y-12 p-4 sm:p-6 xl:space-y-14 xl:p-10">
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
                    <div className="flex items-center gap-2.5 rounded-full border border-[#D8B45A]/35 bg-black/60 px-4 py-2 backdrop-blur-xl transition group-hover:border-[#D8B45A]/70">
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
                    <p className="inline-block rounded-full border border-white/10 bg-black/85 px-3.5 py-1.5 text-[11px] leading-relaxed backdrop-blur-xl" style={{ color: "rgba(255,255,255,.92)" }}>
                      {resumenData
                        ? `${resumenData.partidos} ${resumenData.partidos === 1 ? "partido leído" : "partidos leídos"} de ${resumenData.temporada}, contra los ${resumenData.equipos} de la categoría`
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
                  <div className="absolute inset-x-4 bottom-4 flex flex-col gap-4 rounded-[22px] border border-white/10 bg-black/85 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between xl:flex-col xl:items-stretch xl:justify-start">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,.9)" }}>
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
                        <p className="mt-2 break-words text-[11px] leading-snug" style={{ color: "rgba(255,255,255,.9)" }}>
                          {resumenData.partidos} {resumenData.partidos === 1 ? "partido" : "partidos"}
                          {resumenData.puesto
                            ? ` · ${resumenData.puesto}º de ${resumenData.deCuantos} en la categoría${resumenData.mediana != null ? ` · mediana de la liga: ${resumenData.mediana.toFixed(2).replace(".", ",")}` : ""}`
                            : ""}
                        </p>
                      )}
                    </div>

                    {(cargandoData || resumenData?.golesMenosXg != null) && (
                      <div className="min-w-0 sm:shrink-0 sm:text-right xl:text-left">
                        <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,.9)" }}>
                          Goles − xG por partido
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
                            `${resumenData.golesMenosXg >= 0 ? "+" : "−"}${Math.abs(resumenData.golesMenosXg).toFixed(2).replace(".", ",")}`
                          )}
                        </p>

                        {resumenData?.golesMenosXg != null && (
                          <p className="mt-1 break-words text-[11px] leading-snug" style={{ color: "rgba(255,255,255,.9)" }}>
                            {resumenData.xg != null && `${Math.round((resumenData.xg + resumenData.golesMenosXg) * resumenData.partidos)} goles frente a ${(resumenData.xg * resumenData.partidos).toFixed(1).replace(".", ",")} esperados en ${resumenData.partidos} partidos · `}
                            {resumenData.golesMenosXg >= 0
                              ? "marcamos más de lo esperado"
                              : "marcamos menos de lo esperado"}
                            {resumenData.partidos < 15 && ` · con ${resumenData.partidos} ${resumenData.partidos === 1 ? "partido" : "partidos"} es tendencia, no veredicto`}
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
            <AlertasPortada plantilla={plantilla} seguimiento={seguimientoCastilla} />

            {/* ========================= ACCESO RÁPIDO ========================= */}

            <div>
              <SectionHeader
                icon={Activity}
                title="Acceso rápido"
                caption="Se reordena según lo que más abres"
              />

              <div className="mt-5">
                <QuickAccess />
              </div>
            </div>

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
                caption="Seguimiento de los jugadores de campo del Castilla y modelo de juego, en vivo de las hojas"
              />

              <div className="mt-5">
                <Cifras
                  cifras={[
                    {
                      href: "/calendar",
                      label: "Seguimientos",
                      value: errorSeguimiento ? null : seguimientos,
                      caption: errorSeguimiento ? "sin datos" : `${ultimos30Dias} en los últimos 30 días`,
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
                    {
                      href: "/individual_proc",
                      label: "Promedio",
                      value: errorSeguimiento ? null : promedioSeguimientos,
                      caption: errorSeguimiento ? "sin datos" : "Seguimientos por jugador",
                      destino: "Dashboard Seguimiento",
                      loading: loadingSeguimiento,
                      icon: BarChart3,
                    },
                    {
                      href: "/game-model#ATAQUE",
                      label: "Ataque",
                      value: errorPrincipios ? null : ataqueApartados,
                      caption: errorPrincipios ? "sin datos" : "Apartados ofensivos del modelo",
                      destino: "Identidad de Juego",
                      loading: loadingPrincipios,
                      icon: Swords,
                      color: "#22D3EE",
                    },
                    {
                      href: "/game-model#DEFENSA",
                      label: "Defensa",
                      value: errorPrincipios ? null : defensaApartados,
                      caption: errorPrincipios ? "sin datos" : "Apartados defensivos del modelo",
                      destino: "Identidad de Juego",
                      loading: loadingPrincipios,
                      icon: Shield,
                      color: "#60A5FA",
                    },
                    {
                      href: "/team-values",
                      label: "Cultura",
                      value: errorCultura ? null : principiosCultura,
                      caption: errorCultura ? "sin datos" : "Elementos culturales definidos",
                      destino: "Dinámicas y Valores",
                      loading: loadingCultura,
                      icon: Handshake,
                      color: "#34D399",
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
                  reintentando={loadingCultura || loadingPrincipios || loadingSeguimiento || cargandoData}
                />
              )}
            </div>

            {/* ======================== ÁREAS DE TRABAJO ======================= */}

            <div className="border-t border-white/[0.07] pt-10">
              <SectionHeader
                icon={LayoutGrid}
                title="Áreas de trabajo"
                caption="Pulsa / para buscar"
              />

              <ModulesExplorer />
            </div>

            {/*
              El coding de rival, discreto.

              Es una herramienta de una persona —quien prepara el análisis
              individual del rival—, no del cuerpo técnico entero, así que no
              se le da una tarjeta en las áreas de trabajo: vive aquí abajo,
              donde lo encuentra quien lo busca y no distrae a quien no.
            */}
            <div className="flex justify-center pb-2 pt-6">
              <Link
                href="/coding?ambito=rival"
                className="text-[11px] uppercase tracking-[0.24em] text-white/40 transition-colors hover:text-white/70"
              >
                Coding de rival
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
