"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  BarChart3,
  ChevronRight,
  LayoutGrid,
  Users,
} from "lucide-react"

import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import ModulesExplorer from "@/components/ui/ModulesExplorer"
import { AlertasPortada } from "@/components/portada/AlertasPortada"
import { Cifras } from "@/components/portada/Cifras"
import { ProximoPartido } from "@/components/portada/ProximoPartido"
import { MisTareas } from "@/components/portada/MisTareas"
import { EVENTO_ABRIR as EVENTO_ABRIR_TAREAS } from "@/lib/portada/mis-tareas"
import { useAdmin } from "@/hooks/useAdmin"
import { trackModuleVisit } from "@/lib/module-usage"
import { usePlayers } from "@/hooks/usePlayers"
import { alineaSeguimiento, esDeSeguimiento, filasDeSeguimiento } from "@/lib/seguimiento"
import { SESIONES_CONTADAS_DESDE } from "@/lib/sesion-equipos/estadistica"
import { traeJson } from "@/lib/hojaCsv"
import { EstadoError } from "@/components/ui/estados"
import { useCalendario } from "@/hooks/useCalendario"
import { alrededorDe } from "@/lib/castilla/calendario"
import { diaEnMadrid } from "@/lib/portada/proximo-partido"
import { mismoEquipo } from "@/lib/data-analisis/nombres"

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

/** «2,09»: coma decimal y los decimales que se pidan. */
function coma(n: number, decimales: number) {
  return n.toFixed(decimales).replace(".", ",")
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

  /* «Ir a mis tareas» del aviso de pendientes: `/?tareas=1` al entrar, o el
     evento si ya se está en la portada (31/10/2026). */
  useEffect(() => {
    const abre = () => setVista("tareas")
    const id = setTimeout(() => {
      if (new URLSearchParams(window.location.search).has("tareas")) abre()
    }, 0)

    window.addEventListener(EVENTO_ABRIR_TAREAS, abre)

    return () => {
      clearTimeout(id)
      window.removeEventListener(EVENTO_ABRIR_TAREAS, abre)
    }
  }, [])

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
    /** Las cifras de cada equipo del grupo, para el rival de la semana (30/10/2026). */
    liga?: {
      equipo: string
      partidos: number
      xg: number | null
      xgContra: number | null
      posesion: number | null
      puestoXg: number | null
      puestoXgContra: number | null
      puestoPosesion: number | null
    }[]
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

  /*
  | EL RIVAL, DE MD-4 A MD-1 (30/10/2026, fútbol)
  |
  | Esos días lo que se prepara es al rival: la tarjeta oscura enseña sus
  | cifras de Wyscout (de `resumen.liga`) y lo nuestro baja a una línea. Del
  | partido al MD-5 sigue saliendo lo nuestro. El calendario es el mismo
  | documento que pinta el próximo partido.
  */
  const { partidos: calendario, cargando: sinCalendario } = useCalendario()

  const rivalSemana = useMemo(() => {
    if (sinCalendario || !ahora || !resumenData?.liga?.length) return null

    const proximo = alrededorDe(calendario, ahora)?.proximo

    if (!proximo) return null

    const hoy = diaEnMadrid(ahora)
    const faltan = Math.round(
      (Date.parse(`${proximo.cuando.slice(0, 10)}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000,
    )

    if (faltan < 1 || faltan > 4) return null

    const fila = resumenData.liga.find((f) => mismoEquipo(f.equipo, proximo.rival))

    if (!fila || fila.xg == null || !fila.partidos) return null

    return {
      ...fila,
      xg: fila.xg,
      nombre: proximo.rival,
      faltan,
      deCuantos: resumenData.liga.length,
    }
  }, [ahora, calendario, resumenData, sinCalendario])

  return (
    <main className="min-h-screen bg-[#02060D] text-white">
      <div className="flex">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Topbar />

          {/* pb-24: el botón flotante de herramientas no tapa la última fila (30/10/2026).
              Y margen a la derecha: tapaba el borde de la tarjeta del partido. */}
          <section className="space-y-12 py-4 pb-24 pl-4 pr-12 sm:py-6 sm:pb-24 sm:pl-6 sm:pr-[76px] xl:space-y-14 xl:py-10 xl:pb-24 xl:pl-10 xl:pr-[76px]">
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
                  href={rivalSemana ? "/data-analisis?area=equipo" : "/data-analisis"}
                  onClick={() => trackModuleVisit("/data-analisis")}
                  title={
                    rivalSemana
                      ? `${rivalSemana.nombre} de un vistazo, en Data Análisis`
                      : "Lo que dicen los informes de Wyscout y Opta: el Castilla contra su historia, contra el grupo y la categoría entera"
                  }
                  /* Más baja en el móvil (30/10/2026): ocupaba casi dos pantallas antes de «Datos destacados». */
                  className="light-sweep group relative block min-h-[340px] overflow-hidden rounded-[28px] border border-white/10 sm:min-h-[320px] xl:min-h-[400px]"
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

                  {/*
                    30/10/2026: fuera la chapa «Data Análisis» de encima de la
                    foto; el destino va en el título del panel de abajo. Queda
                    sólo la base de lo que se cuenta, en una línea corta.
                  */}
                  {/* 30/10/2026: la chapa sólo con el rival; lo nuestro lleva su base dentro del
                      panel, y sin datos queda la foto sola (sin rótulos sobre nada). */}
                  {rivalSemana && (
                  <div className="absolute left-4 top-4 max-w-[calc(100%-32px)]">
                    <p className="inline-block truncate rounded-full border border-white/10 px-3.5 py-1.5 text-[12px] leading-relaxed backdrop-blur-xl" style={{ color: "#fff", backgroundColor: "rgba(2,6,13,.94)", maxWidth: "100%" }}>
                      {`${rivalSemana.nombre} · ${rivalSemana.partidos} ${rivalSemana.partidos === 1 ? "partido" : "partidos"} · Wyscout`}
                    </p>
                  </div>
                  )}

                  {/*
                    Pie del panel: dos cifras de Data Análisis, o las del rival
                    de la semana de MD-4 a MD-1 (30/10/2026, fútbol: esos días
                    lo que se prepara es a él). Sólo se pinta mientras carga
                    (esqueleto) o si hay dato. Los textos van con color fijo
                    (`style`): el panel es siempre oscuro y en modo día el
                    blanco por clase se volvía tinta oscura sobre negro.
                  */}
                  {rivalSemana ? (
                    <div
                      className="absolute inset-x-3 bottom-3 rounded-[22px] border border-white/10 px-4 py-4 backdrop-blur-xl sm:inset-x-4 sm:bottom-4 sm:px-5"
                      style={{ backgroundColor: "rgba(2,6,13,.94)" }}
                    >
                      <p className="flex items-center justify-between gap-3 text-[12px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.9)" }}>
                        <span className="min-w-0 truncate">El rival · {rivalSemana.faltan === 1 ? "MD-1" : `MD-${rivalSemana.faltan}`}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 normal-case tracking-normal" style={{ color: "#F7D98B" }}>
                          Data análisis
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </p>

                      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 leading-none" style={{ color: "#fff" }}>
                        <span className="text-3xl font-bold tabular-nums">{coma(rivalSemana.xg, 2)}</span>
                        <span className="text-[13px]" style={{ color: "rgba(255,255,255,.9)" }}>
                          goles esperados por partido
                        </span>
                      </p>

                      <ul className="mt-3 space-y-1 text-[13px] leading-snug" style={{ color: "rgba(255,255,255,.9)" }}>
                        {rivalSemana.puestoXg != null && (
                          <li>{rivalSemana.puestoXg}º de {rivalSemana.deCuantos} del grupo generando ocasiones</li>
                        )}
                        {rivalSemana.xgContra != null && (
                          <li>
                            Concede {coma(rivalSemana.xgContra, 2)} esperados por partido
                            {rivalSemana.puestoXgContra != null && ` · ${rivalSemana.puestoXgContra}º de ${rivalSemana.deCuantos} (menos es mejor)`}
                          </li>
                        )}
                        {rivalSemana.posesion != null && (
                          <li>
                            {coma(rivalSemana.posesion, 0)} % de posesión media
                            {rivalSemana.puestoPosesion != null && ` · ${rivalSemana.puestoPosesion}º de ${rivalSemana.deCuantos}`}
                          </li>
                        )}
                      </ul>

                      {resumenData?.xg != null && (
                        <p className="mt-3 border-t border-white/10 pt-2 text-[12px] leading-snug" style={{ color: "rgba(255,255,255,.75)" }}>
                          Nosotros: {coma(resumenData.xg, 2)} esperados por partido
                          {resumenData.golesMenosXg != null &&
                            ` · ${(() => {
                              const d = golesFrenteXg(resumenData.xg, resumenData.golesMenosXg, resumenData.partidos).diferencia;

                              return `${d >= 0 ? "+" : "−"}${coma(Math.abs(d), 2)}`;
                            })()} goles por partido frente a lo esperado`}
                        </p>
                      )}
                    </div>
                  ) : cargandoData && resumenData?.xg == null ? (
                    /* Mientras llegan las cifras: una línea que lo dice, no dos títulos sobre un fondo vacío (30/10/2026). */
                    <div
                      className="absolute inset-x-3 bottom-3 rounded-[22px] border border-white/10 px-4 py-4 backdrop-blur-xl sm:inset-x-4 sm:bottom-4 sm:px-5"
                      style={{ backgroundColor: "rgba(2,6,13,.94)" }}
                      aria-busy="true"
                    >
                      <p className="flex items-center gap-2 text-[13px]" style={{ color: "rgba(255,255,255,.85)" }}>
                        <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: "#F7D98B" }} />
                        Cargando las cifras de Wyscout…
                      </p>
                      <span className="mt-3 block h-7 w-24 animate-pulse rounded bg-white/10" />
                    </div>
                  ) : resumenData?.xg != null && (
                  <div
                    className="absolute inset-x-3 bottom-3 flex flex-col gap-3 rounded-[22px] border border-white/10 px-4 py-4 backdrop-blur-xl sm:inset-x-4 sm:bottom-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-5 xl:flex-col xl:items-stretch xl:justify-start"
                    style={{ backgroundColor: "rgba(2,6,13,.94)" }}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center justify-between gap-3 text-[12px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.9)" }}>
                        <span className="min-w-0">Goles esperados (xG) por partido</span>
                        <span className="inline-flex shrink-0 items-center gap-1 normal-case tracking-normal sm:hidden xl:inline-flex" style={{ color: "#F7D98B" }}>
                          Data análisis
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </p>

                      <p className="mt-2 text-3xl font-bold leading-none" style={{ color: "#fff" }}>
                        {coma(resumenData.xg, 2)}
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

                      {/* Con su base, su fuente y su sentido (30/10/2026). */}
                      <p className="mt-2 break-words text-[12px] leading-snug" style={{ color: "rgba(255,255,255,.9)" }}>
                        {[
                          resumenData.puesto ? `${resumenData.puesto}º de ${resumenData.deCuantos} del grupo` : "",
                          "más es mejor",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-0.5 break-words text-[12px] leading-snug" style={{ color: "rgba(255,255,255,.7)" }}>
                        {[
                          `${resumenData.partidos} ${resumenData.partidos === 1 ? "partido" : "partidos"}`,
                          resumenData.mediana != null ? `frente a la mediana de los ${resumenData.equipos} equipos (${coma(resumenData.mediana, 2)})` : "",
                          "Wyscout",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    {resumenData.golesMenosXg != null && (
                      <div className="min-w-0 sm:shrink-0 sm:text-right xl:text-left">
                        <p className="text-[12px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.9)" }}>
                          Goles frente a lo esperado
                        </p>

                        {/* El naranja es «por debajo de lo esperado» y lo dice la frase de debajo. */}
                        <p
                          className="mt-2 flex flex-wrap items-baseline gap-x-1.5 leading-none sm:justify-end xl:justify-start"
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
                            <>
                              {/* 29/10/2026 (análisis): la cifra sale de los mismos totales
                                  redondeados que se leen debajo (11 y 18,8 en 9 → −0,87). */}
                              <span className="text-3xl font-bold">
                                {(() => {
                                  const d = golesFrenteXg(resumenData.xg, resumenData.golesMenosXg, resumenData.partidos).diferencia;

                                  return `${d >= 0 ? "+" : "−"}${coma(Math.abs(d), 2)}`;
                                })()}
                              </span>
                              <span className="text-[13px] font-medium">por partido</span>
                            </>
                          )}
                        </p>

                        {/* Sin «tendencia en 9 partidos» (30/10/2026): repetía la base y no decía nada. */}
                        {resumenData?.golesMenosXg != null && (
                          <p className="mt-1.5 break-words text-[12px] leading-snug" style={{ color: "rgba(255,255,255,.9)" }}>
                            {resumenData.xg != null && (() => {
                              const t = golesFrenteXg(resumenData.xg, resumenData.golesMenosXg, resumenData.partidos);

                              return `${t.goles} goles frente a ${coma(t.esperados, 1)} esperados en ${resumenData.partidos} partidos · `;
                            })()}
                            {resumenData.golesMenosXg >= 0
                              ? "marcamos más de lo esperado"
                              : "marcamos menos de lo esperado"}
                            {" · más es mejor"}
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
                {/* Si la hoja de seguimiento no contesta, su casilla no se pinta (sin
                    «—» ni «sin datos»): queda el «Reintentar» de debajo (30/10/2026). */}
                <Cifras
                  cifras={[
                    ...(errorSeguimiento
                      ? []
                      : [
                          {
                            href: "/calendar",
                            label: "Seguimientos",
                            value: seguimientos,
                            /* Con su base (30/10/2026): sin ella el 34 no se entendía sin leer el pie. */
                            caption: [
                              totalJugadores ? `de ${totalJugadores} jugadores` : "",
                              ultimos30Dias === seguimientos ? `${ultimos7Dias} esta semana` : `${ultimos30Dias} en los últimos 30 días`,
                            ]
                              .filter(Boolean)
                              .join(", "),
                            destino: "Calendario Seguimiento",
                            loading: loadingSeguimiento,
                            icon: Activity,
                          },
                        ]),
                    {
                      href: "/individual",
                      label: "Del Castilla",
                      value: totalJugadores,
                      caption: errorSeguimiento
                        ? "jugadores de campo"
                        : `jugadores de campo · ${jugadoresSeguimiento} de ${totalJugadores} con seguimiento (${cobertura} %)`,
                      /* «Plantilla» a secas se confundía con «Plantilla del rival» de la tarjeta del partido (30/10/2026). */
                      destino: "Fichas de nuestros jugadores",
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

              {/* Las 46 repetían el menú lateral (30/10/2026): el buscador y las
                  seis que más se usan; el resto detrás de «Ver todas las áreas».
                  Al buscar o filtrar salen todas las que casan. */}
              <ModulesExplorer limite={verAreas ? undefined : 6} />

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

            {/* El coding de rival ya no va suelto al pie (30/10/2026): es un
                acceso más de la fila «Del rival» de la tarjeta del partido. */}
            </>)}
          </section>
        </div>
      </div>
    </main>
  )
}
