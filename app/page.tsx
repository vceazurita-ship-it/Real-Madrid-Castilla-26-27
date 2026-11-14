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
import { AvisoConexionGoogle } from "@/components/portada/AvisoConexionGoogle"
import { Cifras } from "@/components/portada/Cifras"
import { ProximoPartido } from "@/components/portada/ProximoPartido"
import { MisTareas } from "@/components/portada/MisTareas"
import { HREFS_MESA, PanelHoy } from "@/components/portada/PanelHoy"
import { DirectoPortada } from "@/components/portada/DirectoPortada"
import { OptaPortada } from "@/components/portada/OptaPortada"
import { UltimoPartido3D } from "@/components/portada/UltimoPartido3D"
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
import {
  diaEnMadrid,
  equipoDelInforme,
  type EquipoPortada,
  type RespuestaPortada,
} from "@/lib/portada/proximo-partido"
import { mismoEquipo } from "@/lib/data-analisis/nombres"
import { useEscudos } from "@/hooks/useEscudos"
import { useOptaLigero } from "@/hooks/useOptaLigero"
import { CASTILLA_OPTA } from "@/lib/opta"
import { equipoOptaDe } from "@/lib/opta-laboratorio"
import { cifrasOptaDe, hastaOpta } from "@/lib/portada/cifras-opta"
import { discrepancia } from "@/lib/fuentes"
import { SelloFuente } from "@/components/ui/SelloFuente"

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

        <h2 className="fuente-club text-[20px] font-bold uppercase tracking-[0.08em] text-white/85">
          {title}
        </h2>
      </div>

      {caption && (
        <p className="text-[12px] text-white/35">{caption}</p>
      )}
    </div>
  )
}

/**
 * El puesto en el grupo con color de significado (10/11/2026, análisis): el
 * tercio de arriba en verde y el de abajo en naranja, del lado del equipo que
 * se mide. Va en un panel siempre oscuro: colores en línea, no por clase.
 */
function Puesto({ puesto, de }: { puesto: number; de: number }) {
  const tercio = de > 0 ? puesto / de : 0.5
  const color = tercio <= 1 / 3 ? "#34D399" : tercio > 2 / 3 ? "#FB923C" : "rgba(255,255,255,.9)"

  return (
    <span className="font-semibold tabular-nums" style={{ color }}>
      {puesto}º de {de}
    </span>
  )
}

/**
 * La ficha del próximo rival en el panel oscuro (11/11/2026, experto de
 * fútbol): puesto, puntos con su base y sus cinco últimos con el marcador
 * debajo de cada letra, para no tener que recordar contra quién fue cada una.
 * Colores en línea: el panel es oscuro también en modo día.
 */
function FichaRival({
  ficha,
}: {
  ficha: {
    nombre: string
    liga: { puesto: number; deCuantos: number; puntos: number; jugados: number } | null
    ultimos: NonNullable<EquipoPortada["ultimos"]>
  }
}) {
  return (
    <div className="relative mb-auto px-5 pt-5 sm:px-6 sm:pt-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#F7D98B" }}>
        El rival · BeSoccer
      </p>
      <p className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-none" style={{ color: "#fff" }}>
        {ficha.nombre}
      </p>

      {ficha.liga && (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]" style={{ color: "rgba(255,255,255,.9)" }}>
          <span className="fuente-club text-[34px] font-bold leading-none tabular-nums" style={{ color: "#fff" }}>
            {ficha.liga.puesto}º
          </span>
          <span>de {ficha.liga.deCuantos}</span>
          <span className="tabular-nums">
            · <span className="font-semibold" style={{ color: "#fff" }}>{ficha.liga.puntos}</span> pts en {ficha.liga.jugados}{" "}
            {ficha.liga.jugados === 1 ? "partido" : "partidos"}
          </span>
        </p>
      )}

      {ficha.ultimos.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px]" style={{ color: "rgba(255,255,255,.78)" }}>
            Sus últimos {ficha.ultimos.length} · el más reciente, a la derecha
          </p>
          <ol className="mt-1.5 flex flex-wrap gap-1.5">
            {ficha.ultimos.map((p, i) => {
              const color = p.signo === "V" ? "#34D399" : p.signo === "D" ? "#FB923C" : "#CBD5E1"

              return (
                <li
                  key={`${i}-${p.rival}`}
                  className="flex w-[52px] flex-col items-center"
                  title={`${p.enCasa ? "En casa con" : "En"} ${p.rival}${p.marcador ? ` · ${p.marcador}` : ""}`}
                >
                  <span
                    className="fuente-club flex h-8 w-8 items-center justify-center rounded-lg text-[16px] font-bold"
                    style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
                  >
                    {p.signo}
                  </span>
                  {p.marcador && (
                    <span className="mt-1 text-[11px] tabular-nums" style={{ color: "rgba(255,255,255,.85)" }}>
                      {p.marcador}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
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

  /*
  | TOPE DEL «CARGANDO» DE WYSCOUT (07/11/2026, los tres jueces). En escritorio
  | la tarjeta se quedaba en «Cargando las cifras de Wyscout…» y parecía rota.
  | A los 8 s el aviso se retira y queda la foto sola; la petición sigue y, si
  | llega luego, la tarjeta sale con sus cifras.
  */
  const [cifrasTarde, setCifrasTarde] = useState(false)

  useEffect(() => {
    const reloj = setTimeout(() => setCifrasTarde(true), 8_000)

    return () => clearTimeout(reloj)
  }, [])

  /* Las cifras de Wyscout no son de «El equipo en cifras»: su fallo no pide reintentar ahí. */
  const hayFallos = errorSeguimiento

  /*
  | EL RIVAL, DE MD-4 A MD-1 (30/10/2026, fútbol)
  |
  | Esos días lo que se prepara es al rival: la tarjeta oscura enseña sus
  | cifras de Wyscout (de `resumen.liga`) y lo nuestro baja a una línea. Del
  | partido al MD-5 sigue saliendo lo nuestro. El calendario es el mismo
  | documento que pinta el próximo partido.
  */
  const { partidos: calendario, cargando: sinCalendario } = useCalendario()

  const escudoDe = useEscudos()

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

  const escudoRivalSemana = rivalSemana ? escudoDe(rivalSemana.nombre) : undefined

  /*
  | LA FICHA DEL RIVAL EN EL PANEL (11/11/2026, experto de fútbol)
  |
  | El xG del Castilla se repetía en «Opta de un vistazo». En su sitio va lo
  | que sirve para preparar el partido: el puesto del rival, sus puntos y sus
  | cinco últimos, de BeSoccer. Es la misma respuesta (`?portada=1`) que lee
  | la tarjeta del partido: `traeJson` la sirve de la copia, sin otra bajada.
  */
  const [equiposPortada, setEquiposPortada] = useState<EquipoPortada[]>([])

  useEffect(() => {
    let vivo = true

    traeJson<Partial<RespuestaPortada>>("/api/data-analisis?portada=1")
      .then((r) => {
        if (vivo && Array.isArray(r?.equipos)) setEquiposPortada(r.equipos)
      })
      .catch(() => {
        /* Sin la ficha, el panel enseña lo de siempre. */
      })

    return () => {
      vivo = false
    }
  }, [])

  const fichaRival = useMemo(() => {
    if (sinCalendario || !ahora) return null

    const proximo = alrededorDe(calendario, ahora)?.proximo

    if (!proximo) return null

    const equipo = equipoDelInforme(equiposPortada, proximo.rival)

    if (!equipo || (!equipo.liga && !equipo.ultimos?.length)) return null

    return { nombre: proximo.rival, liga: equipo.liga ?? null, ultimos: equipo.ultimos ?? [] }
  }, [ahora, calendario, equiposPortada, sinCalendario])

  /*
  | EL xG DE LA TARJETA LO MANDA OPTA (10/11/2026, fase 3: reglas de fuente)
  |
  | La tarjeta daba el xG de Wyscout («1,15 por partido») y, debajo, «Opta de
  | un vistazo» otro para lo mismo (1,06). La regla de `lib/fuentes.ts`: xG a
  | favor, en contra y posesión, Opta; Wyscout queda como segunda lectura
  | pequeña y, si las dos difieren más del umbral, una nota de método. Sin
  | Opta (no casa el nombre, o no ha llegado el documento) sale Wyscout con su
  | sello. Mientras Opta carga, la cifra espera: que no salte de una a otra.
  | Son los mismos documentos ligeros que pide `OptaPortada`: una sola
  | petición por clave.
  */
  const { opta, cargando: cargandoOpta } = useOptaLigero()

  const hastaDeOpta = useMemo(() => (opta ? hastaOpta(opta, calendario) : ""), [opta, calendario])

  const optaRival = useMemo(
    () => (opta && rivalSemana ? cifrasOptaDe(opta, equipoOptaDe(rivalSemana.nombre, opta.equipos)) : null),
    [opta, rivalSemana],
  )

  const optaNuestro = useMemo(() => (opta ? cifrasOptaDe(opta, CASTILLA_OPTA) : null), [opta])

  /* La cifra del Castilla en la tarjeta (del MD-5 al partido), de la fuente que manda. */
  const nuestroXg = useMemo(() => {
    if (optaNuestro?.xg != null && optaNuestro.goles != null && optaNuestro.esperados != null) {
      const esperados = Math.round(optaNuestro.esperados * 10) / 10

      return {
        fuente: "opta" as const,
        xg: optaNuestro.xg,
        puesto: optaNuestro.puestoXg,
        deCuantos: optaNuestro.deCuantos,
        tope: optaNuestro.tope,
        mediana: optaNuestro.mediana,
        partidos: optaNuestro.partidos,
        goles: optaNuestro.goles as number | null,
        esperados,
        diferencia: ((optaNuestro.goles - esperados) / optaNuestro.partidos) as number | null,
        wyscoutXg: resumenData?.xg ?? null,
      }
    }

    if (resumenData?.xg == null) return null

    const t = golesFrenteXg(resumenData.xg, resumenData.golesMenosXg ?? 0, resumenData.partidos)

    return {
      fuente: "wyscout" as const,
      xg: resumenData.xg,
      puesto: resumenData.puesto,
      deCuantos: resumenData.deCuantos,
      tope: resumenData.tope,
      mediana: resumenData.mediana ?? null,
      partidos: resumenData.partidos,
      goles: resumenData.golesMenosXg == null ? null : t.goles,
      esperados: t.esperados,
      diferencia: resumenData.golesMenosXg == null ? null : t.diferencia,
      wyscoutXg: null,
    }
  }, [optaNuestro, resumenData])

  /* Lo del rival, igual: Opta si casa, Wyscout si no. */
  const rivalXg = useMemo(() => {
    if (!rivalSemana) return null

    const o = optaRival?.xg != null ? optaRival : null

    return {
      fuente: o ? ("opta" as const) : ("wyscout" as const),
      xg: o?.xg ?? rivalSemana.xg,
      puestoXg: o ? o.puestoXg : rivalSemana.puestoXg,
      xgContra: o ? o.xgContra : rivalSemana.xgContra,
      puestoXgContra: o ? o.puestoXgContra : rivalSemana.puestoXgContra,
      posesion: o ? o.posesion : rivalSemana.posesion,
      puestoPosesion: o ? o.puestoPosesion : rivalSemana.puestoPosesion,
      deCuantos: o ? o.deCuantos : rivalSemana.deCuantos,
      partidos: o ? o.partidos : rivalSemana.partidos,
      /* La segunda lectura y las notas, sólo cuando la cifra es de Opta. */
      wyscoutXg: o ? rivalSemana.xg : null,
      notaXg: o ? discrepancia("xg", o.xg, rivalSemana.xg) : null,
      notaXgContra: o ? discrepancia("xgContra", o.xgContra, rivalSemana.xgContra) : null,
    }
  }, [optaRival, rivalSemana])

  /* Opta aún en camino: la cifra espera (no Wyscout primero y Opta después). Con el mismo tope de 8 s que Wyscout: pasado, sale lo que haya. */
  const esperaOpta = cargandoOpta && !opta && !cifrasTarde

  /* La tarjeta del Castilla, cargando: Opta en camino o Wyscout sin llegar y sin nada que enseñar. */
  const cargandoTarjeta = esperaOpta || (cargandoData && !cifrasTarde && !nuestroXg)

  /* El sello de cada cifra: fuente, población y hasta dónde llega. */
  const selloDe = (fuente: "opta" | "wyscout", deCuantos: number, partidos: number) => ({
    fuente,
    poblacion: deCuantos ? `grupo (${deCuantos} equipos)` : undefined,
    hasta: fuente === "opta" ? hastaDeOpta || undefined : undefined,
    partidos,
  })

  return (
    <main className="min-h-screen bg-[#02060D] text-white">
      <div className="flex">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Topbar />

          {/* pb-24: el botón flotante de herramientas no tapa la última fila (30/10/2026).
              Y margen a la derecha: tapaba el borde de la tarjeta del partido. */}
          <section className="space-y-8 py-4 pb-24 px-4 sm:py-6 sm:pb-24 sm:px-6 xl:space-y-10 xl:py-10 xl:pb-24 xl:pl-10 xl:pr-[76px]">
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

            <div className="portada-entra relative overflow-hidden rounded-[28px] border border-[#173A61]/60 bg-[#030B15] shadow-[0_0_80px_rgba(0,80,255,.08)] xl:rounded-[36px]">
              {/*
                Fondo (09/11/2026, «la foto se ve mal»): fuera la foto del
                estadio al 10 % detrás del texto —borrosa y lavada, sobre todo
                en modo día y en el móvil—. Queda el fondo limpio con sus halos
                y un filo dorado arriba; la foto va nítida en el panel de la
                derecha, a toda la altura.
              */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-8 top-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(216,180,90,.7), transparent)" }}
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
                  /* Más baja en el móvil (30/10/2026): ocupaba casi dos pantallas antes de «Datos destacados». Desde el 02/11/2026, en el móvil la tarjeta de cifras no flota sobre la foto: va bajo una franja de foto y la caja mide lo que la tarjeta. Desde el 05/11/2026, igual en escritorio: la foto sola ocupaba media cabecera. */
                  /* min-h (07/11/2026): sin cifras queda la foto sola, no una caja de alto cero. */
                  /* 09/11/2026: a toda la altura de la columna (antes quedaba media tarjeta vacía bajo la foto) y las cifras abajo. */
                  /* 09/11/2026 («la foto de la derecha no me gusta»): sin foto —era nuestra ciudad deportiva desde el aire, tapada por la tarjeta y sin nada que ver con el rival—. Panel propio en azul del club, siempre oscuro (colores en línea: igual en modo día), con el escudo del rival de marca de agua y las cifras directamente encima. */
                  className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-[28px] xl:min-h-[240px] xl:self-start"
                  style={{
                    background:
                      "radial-gradient(120% 80% at 100% 0%, rgba(216,180,90,.18), transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(37,99,235,.22), transparent 60%), linear-gradient(160deg, #13284F 0%, #0B1833 55%, #060D1C 100%)",
                    boxShadow: "inset 0 0 0 1px rgba(216,180,90,.28), 0 18px 50px rgba(6,13,28,.35)",
                  }}
                >
                  {/* 09/11/2026: de fondo, el Alfredo Di Stéfano de noche (petición del analista); el azul del club queda en el degradado, que oscurece abajo para leer las cifras. */}
                  <Image
                    src="/stadium-bg.png"
                    alt=""
                    fill
                    sizes="(max-width: 1279px) 100vw, 480px"
                    priority
                    className="pointer-events-none object-cover object-[50%_45%] transition-transform duration-[4000ms] group-hover:scale-105"
                  />

                  {/* En pantalla ancha el panel es alto y las cifras van abajo, sobre el césped; en tableta y móvil el texto ocupa casi todo y cae sobre la grada iluminada: velo más oscuro y parejo. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 hidden xl:block"
                    style={{ background: "linear-gradient(180deg, rgba(6,13,28,.30) 0%, rgba(6,13,28,.10) 30%, rgba(11,24,51,.78) 62%, rgba(6,13,28,.96) 100%)" }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 xl:hidden"
                    style={{ background: "linear-gradient(180deg, rgba(6,13,28,.72) 0%, rgba(11,24,51,.84) 45%, rgba(6,13,28,.94) 100%)" }}
                  />

                  {escudoRivalSemana && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={escudoRivalSemana}
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute -right-10 top-[34%] h-56 w-56 -translate-y-1/2 object-contain opacity-[0.28] transition-transform duration-700 group-hover:scale-105 xl:-right-12 xl:h-80 xl:w-80"
                      style={{ filter: "drop-shadow(0 10px 30px rgba(0,0,0,.55))" }}
                    />
                  )}

                  <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(216,180,90,.8), transparent)" }} />

                  {/*
                    30/10/2026: fuera la chapa «Data Análisis» de encima de la
                    foto; el destino va en el título del panel de abajo. Queda
                    sólo la base de lo que se cuenta, en una línea corta.
                  */}
                  {/* 30/10/2026: la chapa sólo con el rival; lo nuestro lleva su base dentro del
                      panel, y sin datos queda la foto sola (sin rótulos sobre nada). */}
                  {/* 11/11/2026 (fútbol): arriba, la ficha del rival de BeSoccer; llena el panel donde antes sólo había foto. */}
                  {fichaRival && <FichaRival ficha={fichaRival} />}

                  {rivalSemana && !fichaRival && (
                  <div className="absolute left-4 top-4 max-w-[calc(100%-32px)]">
                    <p className="inline-block truncate rounded-full px-3.5 py-1.5 text-[12px] font-semibold leading-relaxed" style={{ color: "#F7D98B", backgroundColor: "rgba(216,180,90,.14)", boxShadow: "inset 0 0 0 1px rgba(216,180,90,.35)", maxWidth: "100%" }}>
                      {/* 10/11/2026: sin «· Wyscout»; la fuente va en el sello de cada cifra. */}
                      {rivalSemana.nombre}
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
                  {rivalSemana && rivalXg ? (
                    <div
                      className={`relative px-5 pb-5 sm:px-6 sm:pb-6 ${fichaRival ? "pt-6" : "pt-16"}`}
                    >
                      <p className="flex items-center justify-between gap-3 text-[12px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.9)" }}>
                        <span className="min-w-0 truncate">Cómo juega · {rivalSemana.faltan === 1 ? "MD-1" : `MD-${rivalSemana.faltan}`}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 normal-case tracking-normal" style={{ color: "#F7D98B" }}>
                          Análisis de datos
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </p>

                      {esperaOpta ? (
                        <span className="mt-2 block h-8 w-40 animate-pulse rounded bg-white/10" aria-label="Cargando las cifras del rival" />
                      ) : (
                        <>
                          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 leading-none" style={{ color: "#fff" }}>
                            <span className="text-3xl font-bold tabular-nums">{coma(rivalXg.xg, 2)}</span>
                            <span className="text-[13px]" style={{ color: "rgba(255,255,255,.9)" }}>
                              goles esperados por partido
                            </span>
                          </p>

                          {/* 10/11/2026 (expertos): una sola fuente por cifra —Opta si la tiene, Wyscout si no— y el sello más grande: a 10,5 px no se leía sobre la foto. */}
                          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <SelloFuente oscuro className="text-[12px]!" {...selloDe(rivalXg.fuente, rivalXg.deCuantos, rivalXg.partidos)} />
                          </p>

                          {/*
                            10/11/2026 (expertos): tres líneas del rival con su base y el
                            puesto en color con significado —verde, de los mejores del
                            grupo; naranja, de los peores—, siempre de su lado. La
                            posesión es estilo, no mejor ni peor: sin color. Fuera la
                            nota «En contra, Wyscout da…» y la línea «Nosotros»: lo
                            nuestro ya está en «Opta de un vistazo».
                          */}
                          <ul className="mt-3 space-y-1 text-[13px] leading-snug" style={{ color: "rgba(255,255,255,.9)" }}>
                            {rivalXg.puestoXg != null && (
                              <li>
                                <Puesto puesto={rivalXg.puestoXg} de={rivalXg.deCuantos} /> generando ocasiones (más es mejor)
                              </li>
                            )}
                            {rivalXg.xgContra != null && (
                              <li>
                                Concede {coma(rivalXg.xgContra, 2)} esperados por partido
                                {rivalXg.puestoXgContra != null && (
                                  <>
                                    {" · "}
                                    <Puesto puesto={rivalXg.puestoXgContra} de={rivalXg.deCuantos} /> (menos es mejor)
                                  </>
                                )}
                              </li>
                            )}
                            {rivalXg.posesion != null && (
                              <li>
                                {coma(rivalXg.posesion, 0)} % de posesión media
                                {rivalXg.puestoPosesion != null && ` · ${rivalXg.puestoPosesion}º de ${rivalXg.deCuantos} en tener el balón`}
                              </li>
                            )}
                          </ul>
                        </>
                      )}

                    </div>
                  ) : cargandoTarjeta ? (
                    /* Mientras llegan las cifras: una línea que lo dice, no dos títulos sobre un fondo vacío (30/10/2026). */
                    <div
                      className="relative px-5 pb-5 pt-16 sm:px-6 sm:pb-6"
                      aria-busy="true"
                    >
                      <p className="flex items-center gap-2 text-[13px]" style={{ color: "rgba(255,255,255,.85)" }}>
                        <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: "#F7D98B" }} />
                        Cargando las cifras…
                      </p>
                      <span className="mt-3 block h-7 w-24 animate-pulse rounded bg-white/10" />
                    </div>
                  ) : nuestroXg && (
                  /* 10/11/2026: el xG del Castilla lo manda Opta (`lib/fuentes.ts`); sin Opta, Wyscout. Cada cifra con su sello. */
                  <div
                    className={`relative flex flex-col gap-3 px-5 pb-5 sm:px-6 sm:pb-6 xl:flex xl:flex-col xl:items-stretch xl:gap-3 ${fichaRival ? "pt-6" : "pt-16"} ${nuestroXg.fuente === "wyscout" ? "sm:grid sm:grid-cols-2 sm:items-end sm:gap-5" : ""}`}
                  >
                    {/* 11/11/2026 (fútbol): con Opta, el xG ya está en «Opta de un vistazo»; aquí sólo si es de Wyscout (sin Opta esa tabla no sale). */}
                    {nuestroXg.fuente === "wyscout" && (
                    <div className="min-w-0">
                      <p className="flex items-center justify-between gap-3 text-[12px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.9)" }}>
                        {/* Corto en el móvil (02/11/2026): el largo ocupaba tres renglones. */}
                        <span className="min-w-0">
                          <span className="sm:hidden">Goles esperados</span>
                          <span className="hidden sm:inline">Goles esperados (xG) por partido</span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 normal-case tracking-normal sm:hidden xl:inline-flex" style={{ color: "#F7D98B" }}>
                          Análisis de datos
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </p>

                      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 leading-none" style={{ color: "#fff" }}>
                        <span className="text-3xl font-bold">{coma(nuestroXg.xg, 2)}</span>
                        {/* En el móvil el rótulo es corto: la unidad va junto a la cifra (07/11/2026). */}
                        <span className="text-[13px] sm:hidden" style={{ color: "rgba(255,255,255,.9)" }}>por partido · calidad de las ocasiones</span>
                      </p>

                      <div className="mt-3 h-1 w-36 max-w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#D8B45A] to-[#F7D98B] transition-[width] duration-1000 ease-out"
                          style={{
                            width: `${
                              nuestroXg.xg && nuestroXg.tope
                                ? Math.min((nuestroXg.xg / nuestroXg.tope) * 100, 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>

                      {/* Con su base y su sentido (30/10/2026); la fuente, en el sello (10/11/2026). */}
                      <p className="mt-2 break-words text-[12px] leading-snug" style={{ color: "rgba(255,255,255,.9)" }}>
                        {[
                          nuestroXg.puesto ? `${nuestroXg.puesto}º de ${nuestroXg.deCuantos} del grupo` : "",
                          nuestroXg.mediana != null ? `mediana ${coma(nuestroXg.mediana, 2)}` : "",
                          "más es mejor",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <SelloFuente oscuro {...selloDe(nuestroXg.fuente, nuestroXg.deCuantos, nuestroXg.partidos)} />
                      </p>
                    </div>
                    )}

                    {nuestroXg.diferencia != null && nuestroXg.goles != null && (
                      <div className="min-w-0">
                        <p className="flex items-center justify-between gap-3 text-[12px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.9)" }}>
                          <span className="min-w-0">Goles del Castilla frente a lo esperado</span>
                          {nuestroXg.fuente === "opta" && (
                            <span className="inline-flex shrink-0 items-center gap-1 normal-case tracking-normal" style={{ color: "#F7D98B" }}>
                              Análisis de datos
                              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          )}
                        </p>

                        {/* El naranja es «por debajo de lo esperado» y lo dice la frase de debajo. */}
                        <p
                          className="mt-2 flex flex-wrap items-baseline gap-x-1.5 leading-none"
                          style={{ color: nuestroXg.diferencia >= 0 ? "#34D399" : "#FB923C" }}
                        >
                          {/* 29/10/2026 (análisis): la cifra sale de los mismos totales
                              redondeados que se leen debajo (11 y 18,8 en 9 → −0,87). */}
                          <span className={`font-bold ${nuestroXg.fuente === "opta" ? "text-[40px]" : "text-3xl"}`}>
                            {`${nuestroXg.diferencia >= 0 ? "+" : "−"}${coma(Math.abs(nuestroXg.diferencia), 2)}`}
                          </span>
                          {/* 11/11/2026 (análisis): el sentido del color, dicho en el mismo color. */}
                          <span className="text-[13px] font-medium">
                            por partido · {nuestroXg.diferencia >= 0 ? "por encima de lo esperado" : "por debajo de lo esperado"}
                          </span>
                        </p>

                        <p className="mt-2 break-words text-[12px] leading-snug" style={{ color: "rgba(255,255,255,.9)" }}>
                          {`${nuestroXg.goles} goles marcados frente a ${coma(nuestroXg.esperados, 1)} esperados en ${nuestroXg.partidos} partidos · más es mejor`}
                        </p>
                        {/* La fuente en la propia tarjeta y, con pocos partidos, que es tendencia. */}
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <SelloFuente oscuro {...selloDe(nuestroXg.fuente, nuestroXg.deCuantos, nuestroXg.partidos)} />
                          {nuestroXg.partidos < 15 && (
                            <span className="text-[11px]" style={{ color: "rgba(255,255,255,.7)" }}>
                              {nuestroXg.partidos} partidos: léase como tendencia
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Sin cifras (09/11/2026): no la foto sola, sino adónde lleva. */}
                  {!rivalSemana && !cargandoTarjeta && !nuestroXg && (
                    <span
                      className="relative m-4 inline-flex items-center gap-1.5 self-start rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] font-semibold backdrop-blur-xl"
                      style={{ color: "#F7D98B", backgroundColor: "rgba(2,6,13,.85)" }}
                    >
                      Análisis de datos
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}

                </Link>
              </div>
            </div>

            {/* ======================= TU DÍA Y MESA DE TRABAJO ================= */}

            {/* 02/11/2026: lo que toca hoy (tareas del micro, pendientes y envíos)
                y las herramientas de todos los días, con lo último abierto. */}
            {/* 13/11/2026: el directo de Opta de un toque (lanza y lleva a verlo). */}
            <DirectoPortada admin={Boolean(admin)} />

            <PanelHoy admin={Boolean(admin)} />

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
            {/* La conexión con Google (correo y YouTube), sólo si se ha caído y sólo al admin. */}
            <AvisoConexionGoogle />

            <AlertasPortada plantilla={plantilla} seguimiento={seguimientoTodo} />

            {/* ============================ OPTA =============================== */}

            {/* 10/11/2026: el próximo rival y nosotros en cuatro cifras de Opta, y el
                momentum del último partido. Sólo documentos ligeros: ver el componente. */}
            {/* 14/11/2026: el último partido en 3D (si ya tiene su evento a evento). */}
            <UltimoPartido3D />

            <OptaPortada />

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
                caption="Los jugadores de campo del Castilla"
              />

              <div className="mt-5">
                {/*
                  Una población y una base por casilla (07/11/2026, análisis y marketing):
                  «15 de 18 con seguimiento» es la cifra principal, con el % de apoyo;
                  los 44 dicen su periodo (desde el 21 oct) y no repiten el 18.
                  Si la hoja de seguimiento no contesta, sale sólo la plantilla y el
                  «Reintentar» de debajo (sin «—» ni «sin datos»).
                */}
                <Cifras
                  cifras={
                    errorSeguimiento
                      ? [
                          {
                            href: "/individual",
                            label: "Del Castilla",
                            value: totalJugadores,
                            caption: "jugadores de campo",
                            destino: "Abrir las fichas de nuestros jugadores",
                            loading: cargandoPlantilla,
                            icon: Users,
                          },
                        ]
                      : [
                          {
                            href: "/individual",
                            label: "Con seguimiento",
                            value: jugadoresSeguimiento,
                            suffix: totalJugadores ? ` de ${totalJugadores}` : undefined,
                            caption: totalJugadores
                              ? `jugadores de campo con al menos un seguimiento · ${cobertura} % de la plantilla`
                              : "jugadores de campo con al menos un seguimiento",
                            destino: "Abrir las fichas de nuestros jugadores",
                            loading: loadingSeguimiento || cargandoPlantilla,
                            icon: Users,
                          },
                          {
                            href: "/calendar",
                            label: "Seguimientos",
                            value: seguimientos,
                            caption: [
                              `registrados desde el ${new Date(`${SESIONES_CONTADAS_DESDE}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).replace(".", "")}`,
                              ultimos30Dias === seguimientos ? `${ultimos7Dias} esta semana` : `${ultimos30Dias} en los últimos 30 días`,
                            ].join(" · "),
                            destino: "Abrir los seguimientos",
                            loading: loadingSeguimiento,
                            icon: Activity,
                          },
                        ]
                  }
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
                caption="Otras seis de uso frecuente; el resto, en «Ver todas las áreas»"
              />

              {/* Las 46 repetían el menú lateral (30/10/2026): el buscador y las
                  seis que más se usan; el resto detrás de «Ver todas las áreas».
                  Al buscar o filtrar salen todas las que casan. */}
              <ModulesExplorer limite={verAreas ? undefined : 6} excluir={HREFS_MESA} />

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
