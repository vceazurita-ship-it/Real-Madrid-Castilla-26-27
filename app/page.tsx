"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  BarChart3,
  ChevronRight,
  Plus,
  Users,
} from "lucide-react"

import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { AlertasPortada } from "@/components/portada/AlertasPortada"
import { AvisoConexionGoogle } from "@/components/portada/AvisoConexionGoogle"
import { Cifras } from "@/components/portada/Cifras"
import { ProximoPartido, portadaAlDia } from "@/components/portada/ProximoPartido"
import { MisTareas } from "@/components/portada/MisTareas"
import { PanelHoy } from "@/components/portada/PanelHoy"
import { DirectoPortada } from "@/components/portada/DirectoPortada"
import { OptaPortada } from "@/components/portada/OptaPortada"
import { UltimoPartido3D } from "@/components/portada/UltimoPartido3D"
import { CabeceraBloque } from "@/components/portada/CabeceraBloque"
import { VideosDelRival } from "@/components/portada/VideosDelRival"
import { enlacesDelRival, useJornadasRivales } from "@/components/rivals/EnlacesDelRival"
import { EVENTO_ABRIR as EVENTO_ABRIR_TAREAS } from "@/lib/portada/mis-tareas"
import { useAdmin } from "@/hooks/useAdmin"
import { trackModuleVisit } from "@/lib/module-usage"
import { usePlayers } from "@/hooks/usePlayers"
import { alineaSeguimiento, esDeSeguimiento, filasDeSeguimiento } from "@/lib/seguimiento"
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
import { ponEquipoElegido } from "@/lib/data-analisis/eleccion-compartida"
import { useEscudos } from "@/hooks/useEscudos"
import { useOptaLigero } from "@/hooks/useOptaLigero"
import { CASTILLA_OPTA, num as numOpta } from "@/lib/opta"
import { cifrasOptaDe, hastaOpta } from "@/lib/portada/cifras-opta"
import { SelloFuente } from "@/components/ui/SelloFuente"
import { chipInk } from "@/lib/theme"

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
/** Palabras que no distinguen a un equipo («Real», «CD», «Club»…): la sigla sale de la primera que sí. */
const SIN_SIGLA = new Set(["real", "club", "cd", "ud", "cf", "sd", "rcd", "ad", "ce", "fc", "sad", "cp", "rc", "at", "atletico", "atlético", "deportivo", "de", "del", "la", "el", "racing", "unión", "union"])

/** «Gimnàstic Tarragona» → «GIM»; «Real Murcia» → «MUR». */
function siglaEquipo(nombre: string) {
  const palabras = nombre.split(/[\s.\-]+/).filter(Boolean)
  const buena = palabras.find((p) => !SIN_SIGLA.has(p.toLowerCase())) ?? palabras[0] ?? ""

  return buena.normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3).toUpperCase()
}

/**
 * La ficha del próximo rival en el panel oscuro (11/11/2026, experto de
 * fútbol): puesto, puntos con su base y sus cinco últimos con el marcador
 * debajo de cada letra, para no tener que recordar contra quién fue cada una.
 * Colores en línea: el panel es oscuro también en modo día.
 */
function FichaRival({
  ficha,
  empuja = true,
  escudo,
  partidos = [],
}: {
  /** El id de Opta de cada uno de sus últimos (mismo orden), para abrir su análisis; null si Opta no lo tiene. */
  partidos?: (string | null)[]
  /** El escudo, nítido junto al nombre (18/11/2026: de marca de agua pisaba los vídeos). */
  escudo?: string | null
  ficha: {
    nombre: string
    liga: { puesto: number; deCuantos: number; puntos: number; jugados: number } | null
    ultimos: NonNullable<EquipoPortada["ultimos"]>
    /** El próximo partido lo juega fuera de su casa (viene a la nuestra). */
    juegaFuera: boolean
  }
  /** Sin vídeos debajo, la ficha se queda arriba y el pie abajo; con ellos (semana del rival), todo seguido. */
  empuja?: boolean
}) {
  return (
    <div className={`relative px-5 pt-5 sm:px-6 sm:pt-6 ${empuja ? "mb-auto" : ""}`}>
      {/*
        18/11/2026 (ronda 23) la ficha iba en una caja opaca centrada: dejaba un
        hueco negro arriba y tapaba el estadio («se ve fea», el analista). Ahora
        sin caja: el contenido va al pie de la tarjeta, sobre el velo oscuro del
        panel (que ya lo hace legible), y la foto queda a la vista arriba.
      */}
      <div style={{ textShadow: "0 1px 10px rgba(6,13,28,.65)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#F7D98B" }}>
            El rival · BeSoccer
          </p>
          <p className="fuente-club mt-1.5 text-[30px] font-bold uppercase leading-none" style={{ color: "#fff" }}>
            {ficha.nombre}
          </p>
        </div>
        {escudo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={escudo} alt="" aria-hidden className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16" style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,.55))" }} />
        )}
      </div>

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
          {/* 17/11/2026 (ronda 21, análisis): más grande y más claro sobre la foto en el móvil. */}
          {/* 20/11/2026 (ronda 7, análisis y marketing): a 14 px, que en proyector no se leía. */}
          <p className="text-[14px] font-medium leading-snug" style={{ color: "rgba(255,255,255,.94)" }}>
            Sus últimos {ficha.ultimos.length} · el más reciente, a la derecha · C en casa, F fuera
            {partidos.some(Boolean) ? " · toca uno para su análisis" : ""}
          </p>
          {/* En una fila también en móvil (expertos: se partían 4 + 1). */}
          <ol className="mt-1.5 flex flex-nowrap gap-1">
            {ficha.ultimos.map((p, i) => {
              const color = p.signo === "V" ? "#34D399" : p.signo === "D" ? "#FB923C" : "#CBD5E1"
              const id = partidos[i] ?? null
              const titulo = `${p.enCasa ? "En casa con" : "En"} ${p.rival}${p.marcador ? ` · ${p.marcador}` : ""}`
              const dentro = (
                <>
                  <span
                    className="fuente-club flex h-9 w-9 items-center justify-center rounded-lg text-[18px] font-bold"
                    style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
                  >
                    {p.signo}
                  </span>
                  {p.marcador && (
                    <span className="mt-1 text-[13px] font-medium tabular-nums" style={{ color: "rgba(255,255,255,.92)" }}>
                      {p.marcador}
                    </span>
                  )}
                  {/* 17/11/2026 (fútbol): contra quién y dónde, como en los nuestros. */}
                  {p.rival && (
                    <span className="text-[12px] font-semibold uppercase leading-tight tracking-[0.02em]" style={{ color: "rgba(255,255,255,.85)" }}>
                      {siglaEquipo(p.rival)}·{p.enCasa ? "C" : "F"}
                    </span>
                  )}
                </>
              )

              /* 20/11/2026 (ronda 7, fútbol): cada resultado abre el análisis de ese partido del rival, como los nuestros. */
              return (
                <li key={`${i}-${p.rival}`} className="shrink-0">
                  {id ? (
                    <Link
                      href={`/data-analisis?area=directo&partido=${encodeURIComponent(id)}`}
                      onClick={() => trackModuleVisit("/data-analisis")}
                      title={`${titulo} · su análisis`}
                      aria-label={`${titulo}: abrir su análisis`}
                      className="pointer-events-auto flex w-[46px] flex-col items-center rounded-lg transition-transform hover:-translate-y-0.5 sm:w-[54px]"
                    >
                      {dentro}
                    </Link>
                  ) : (
                    <span className="flex w-[46px] flex-col items-center sm:w-[54px]" title={titulo}>
                      {dentro}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
          {/* 20/11/2026 (ronda 7, fútbol): las siglas, con su nombre entero (ZAR, JUV… no se explicaban). */}
          <p className="mt-1.5 text-[12.5px] leading-snug" style={{ color: "rgba(255,255,255,.85)" }}>
            {ficha.ultimos
              .filter((p) => p.rival)
              .map((p) => `${siglaEquipo(p.rival)} ${p.rival}`)
              .filter((t, i, todos) => todos.indexOf(t) === i)
              .join(" · ")}
          </p>
          <ResumenUltimos ultimos={ficha.ultimos} juegaFuera={ficha.juegaFuera} />
        </div>
      )}
      </div>
    </div>
  )
}

/*
| GOLES MENOS xG, PARTIDO A PARTIDO (20/11/2026, ronda 5, análisis): la cifra
| media del panel oscuro con su gráfico debajo, una barra por partido de Opta
| (hacia arriba, marcamos más de lo esperado; hacia abajo, menos) sobre la
| línea del 0. Colores en línea: el panel es oscuro también en modo día.
*/
function BarrasDiferencia({
  partidos,
  verde,
  naranja,
}: {
  partidos: { fecha: string; rival: string; goles: number; xg: number; dif: number }[]
  verde: string
  naranja: string
}) {
  if (partidos.length < 2) return null

  const tope = Math.max(0.5, ...partidos.map((p) => Math.abs(p.dif)))
  const alto = 36
  const fecha = (f: string) => `${Number(f.slice(8, 10))}/${Number(f.slice(5, 7))}`

  /*
  | 20/11/2026 (ronda 7, análisis): fuera del panel oscuro, en su tarjeta
  | clara (colores del tema) y con el eje rotulado: +tope arriba, 0 en la
  | línea y −tope abajo, en goles por partido, con letra de 12 px.
  */
  return (
    <figure className="mt-3" aria-label={`Goles menos xG en cada uno de los ${partidos.length} partidos`}>
      <div className="flex gap-2">
        <div aria-hidden className="flex w-8 shrink-0 flex-col justify-between text-right text-[12px] leading-none tabular-nums text-white/65" style={{ height: alto * 2 }}>
          <span>+{coma(tope, 1)}</span>
          <span>0</span>
          <span>−{coma(tope, 1)}</span>
        </div>
        <div className="relative flex min-w-0 flex-1 items-stretch gap-[3px]" style={{ height: alto * 2 }}>
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px" style={{ background: "rgb(var(--rmcf-ink-rgb) / .4)" }} />
          {partidos.map((p) => {
            const h = Math.max(2, (Math.abs(p.dif) / tope) * alto)
            const arriba = p.dif >= 0

            return (
              <span
                key={`${p.fecha}-${p.rival}`}
                className="relative flex-1"
                title={`${fecha(p.fecha)}${p.rival ? ` · ${p.rival}` : ""} · ${p.goles} ${p.goles === 1 ? "gol" : "goles"} − ${coma(p.xg, 1)} xG = ${p.dif >= 0 ? "+" : "−"}${coma(Math.abs(p.dif), 1)}`}
              >
                <span
                  className="absolute inset-x-0 rounded-[2px]"
                  style={{
                    background: arriba ? verde : naranja,
                    height: h,
                    ...(arriba ? { bottom: alto } : { top: alto }),
                  }}
                />
              </span>
            )
          })}
        </div>
      </div>
      <figcaption className="mt-1.5 flex justify-between gap-2 pl-10 text-[12px] tabular-nums text-white/65">
        <span>{fecha(partidos[0].fecha)}</span>
        <span className="text-center">un partido por barra · goles − xG de cada partido</span>
        <span>{fecha(partidos[partidos.length - 1].fecha)}</span>
      </figcaption>
    </figure>
  )
}

/*
| SUS ÚLTIMOS, EN CIFRAS (17/11/2026, ronda 21, fútbol): el hueco de foto bajo
| la forma se llena con lo que esa forma dice: puntos de los posibles, goles a
| favor y en contra y, aparte, cómo le va fuera (o en casa). El marcador de
| BeSoccer va con sus goles primero.
*/
function ResumenUltimos({ ultimos, juegaFuera }: { ultimos: NonNullable<EquipoPortada["ultimos"]>; juegaFuera: boolean }) {
  const goles = (m: string) => {
    const x = /^(\d+)\s*-\s*(\d+)$/.exec(m.trim())
    return x ? [Number(x[1]), Number(x[2])] as const : null
  }
  const cuenta = (lista: typeof ultimos) => {
    const pts = lista.reduce((s, p) => s + (p.signo === "V" ? 3 : p.signo === "E" ? 1 : 0), 0)
    const conGoles = lista.map((p) => goles(p.marcador ?? "")).filter((g): g is readonly [number, number] => g != null)
    return {
      n: lista.length,
      pts,
      v: lista.filter((p) => p.signo === "V").length,
      e: lista.filter((p) => p.signo === "E").length,
      d: lista.filter((p) => p.signo === "D").length,
      favor: conGoles.length === lista.length ? conGoles.reduce((s, g) => s + g[0], 0) : null,
      contra: conGoles.length === lista.length ? conGoles.reduce((s, g) => s + g[1], 0) : null,
    }
  }
  const todo = cuenta(ultimos)
  if (!todo.n) return null
  /* Donde juega el próximo partido: si viene a nuestra casa, cómo le va fuera (y al revés). */
  const alli = cuenta(ultimos.filter((p) => (juegaFuera ? !p.enCasa : p.enCasa)))
  const gol = (n: number) => `${n} ${n === 1 ? "gol" : "goles"}`

  /*
  | 18/11/2026 (ronda 22, análisis): eran tres filas («Sus últimos 5», «Fuera»,
  | «En casa») que un juez leyó como la forma repetida. Ahora UNA línea
  | compacta bajo sus cinco fichas, con sólo lo que las fichas no dicen.
  */
  return (
    <p className="mt-2 text-[13px] leading-snug tabular-nums" style={{ color: "rgba(255,255,255,.9)" }}>
      <span className="font-semibold" style={{ color: "#fff" }}>{todo.pts} de {todo.n * 3} pts</span>
      {todo.favor != null && todo.contra != null ? ` · ${gol(todo.favor)} a favor, ${todo.contra} en contra` : ""}
      {/* 18/11/2026 (ronda 23, fútbol): «fuera: 3 de 6» se leía como «ganó 3 de 6 fuera» y chocaba con la temporada de /rivals; ahora dice puntos y de cuántos partidos. */}
      {alli.n > 0 && alli.n < todo.n
        ? ` · ${juegaFuera ? "fuera" : "en casa"}: ${alli.pts} de ${alli.n * 3} pts en ${alli.n === 1 ? `su último partido ${juegaFuera ? "fuera" : "en casa"}` : `sus ${alli.n} últimos ${juegaFuera ? "fuera" : "en casa"}`}`
        : ""}
    </p>
  )
}

export default function Home() {
  /* «Mis tareas» del microciclo: una pestaña sólo para el administrador (28/10/2026). */
  const { admin } = useAdmin()
  const [vista, setVista] = useState<"portada" | "tareas">("portada")
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

  /* Los de las cifras: la temporada entera (16/11/2026). */
  const seguimientoCastilla = useMemo(() => {
    if (plantillaEntera.length === 0) return []

    /* Por nombre, que es lo que manda: un ID viejo apunta hoy a otra persona. */
    const atados = alineaSeguimiento(
      filasSeguimiento.flatMap((fila) =>
        fila.ID_JUGADOR ? [{ ...fila, ID_JUGADOR: fila.ID_JUGADOR }] : [],
      ),
      plantillaEntera,
    )

    /* La temporada entera: el corte del 21/10 es sólo para las sesiones (16/11/2026). */

    return filasDeSeguimiento(atados, plantilla).filter((fila) => {
      const fecha = new Date(fila.FECHA ?? "").getTime()

      return Number.isFinite(fecha)
    })
  }, [filasSeguimiento, plantillaEntera, plantilla])

  const jugadoresSeguimiento = useMemo(
    () => new Set(seguimientoCastilla.map((fila) => fila.ID_JUGADOR)).size,
    [seguimientoCastilla],
  )

  const seguimientos = seguimientoCastilla.length

  /*
  | El que menos seguimientos lleva (16/11/2026, marketing): la casilla «Con
  | seguimiento» abre su ficha, que es a quien toca mirar. Mismos registros
  | que las cifras (no cambia ningún recuento). Empate: el primero por nombre.
  */
  const menosSeguidos = useMemo(() => {
    if (!plantilla.length || !seguimientoCastilla.length) return []

    const cuenta = new Map<string, number>()

    for (const fila of seguimientoCastilla) cuenta.set(fila.ID_JUGADOR, (cuenta.get(fila.ID_JUGADOR) ?? 0) + 1)

    const orden = [...plantilla]
      .map((j) => ({ id: j.id, nombre: j.nombre, veces: cuenta.get(j.id) ?? 0 }))
      .filter((j) => j.nombre)
      .sort((a, b) => a.veces - b.veces || a.nombre.localeCompare(b.nombre, "es"))

    /* 17/11/2026 (marketing): los tres que menos llevan, cada uno con su ficha. */
    return orden.slice(0, 3)
  }, [plantilla, seguimientoCastilla])

  const menosSeguido = menosSeguidos[0] ?? null

  /*
  | 17/11/2026 (ronda 21, análisis): «1 seguimiento» es poco frente a qué. La
  | mediana de seguimientos por jugador de la misma plantilla (jugadores de
  | campo del Castilla: sin porteros, `esDeSeguimiento`), con los que no
  | llevan ninguno contados como cero.
  */
  const medianaSeguimientos = useMemo(() => {
    if (!plantilla.length || !seguimientoCastilla.length) return null

    const cuenta = new Map<string, number>()

    for (const fila of seguimientoCastilla) cuenta.set(fila.ID_JUGADOR, (cuenta.get(fila.ID_JUGADOR) ?? 0) + 1)

    const veces = plantilla.map((j) => cuenta.get(j.id) ?? 0).sort((a, b) => a - b)
    const mitad = Math.floor(veces.length / 2)

    return veces.length % 2 ? veces[mitad] : (veces[mitad - 1] + veces[mitad]) / 2
  }, [plantilla, seguimientoCastilla])

  /* Cuántos de la plantilla quedan por debajo de esa mediana (20/11/2026, ronda 7, análisis): la base de «los 3 que menos». */
  const bajoMediana = useMemo(() => {
    if (medianaSeguimientos == null) return null
    const cuenta = new Map<string, number>()
    for (const fila of seguimientoCastilla) cuenta.set(fila.ID_JUGADOR, (cuenta.get(fila.ID_JUGADOR) ?? 0) + 1)
    return plantilla.filter((j) => (cuenta.get(j.id) ?? 0) < medianaSeguimientos).length
  }, [plantilla, seguimientoCastilla, medianaSeguimientos])

  /* Seguimientos por semana, las 10 últimas (22/11/2026): la curva de la casilla. */
  const porSemana = useMemo(() => {
    if (ahora === 0) return []
    const semana = 7 * 24 * 60 * 60 * 1000
    const cuenta = Array.from({ length: 10 }, () => 0)
    for (const fila of seguimientoCastilla) {
      const fecha = new Date(fila.FECHA ?? "").getTime()
      if (!Number.isFinite(fecha) || fecha > ahora) continue
      const atras = Math.floor((ahora - fecha) / semana)
      if (atras < 10) cuenta[9 - atras] += 1
    }
    return cuenta
  }, [seguimientoCastilla, ahora])

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

  /*
  | 16/11/2026 (fútbol): la semana del rival se decide SÓLO con el calendario.
  | Antes dependía de que hubiera llegado el resumen de Wyscout: si tardaba,
  | la tarjeta caía en lo nuestro y el mismo miércoles el escritorio enseñaba
  | el xG del Castilla y el móvil «Cómo juega» del rival. Ahora, de MD-4 a
  | MD-1 la tarjeta espera con esqueleto a las cifras del rival y no enseña
  | nunca lo nuestro.
  */
  const rivalSemana = useMemo(() => {
    if (sinCalendario || !ahora) return null

    const proximo = alrededorDe(calendario, ahora)?.proximo

    if (!proximo) return null

    const hoy = diaEnMadrid(ahora)
    const faltan = Math.round(
      (Date.parse(`${proximo.cuando.slice(0, 10)}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000,
    )

    if (faltan < 1 || faltan > 4) return null

    const fila = resumenData?.liga?.find((f) => mismoEquipo(f.equipo, proximo.rival)) ?? null

    return {
      nombre: proximo.rival,
      faltan,
      /* Wyscout, de respaldo si Opta no casa el nombre. */
      wyscout: fila && fila.xg != null && fila.partidos ? { ...fila, xg: fila.xg } : null,
      deCuantos: resumenData?.liga?.length ?? 0,
    }
  }, [ahora, calendario, resumenData, sinCalendario])


  /*
  | LA FICHA DEL RIVAL EN EL PANEL (11/11/2026, experto de fútbol)
  |
  | El xG del Castilla se repetía en «Opta de un vistazo». En su sitio va lo
  | que sirve para preparar el partido: el puesto del rival, sus puntos y sus
  | cinco últimos, de BeSoccer. Es la misma respuesta (`?portada=1`) que lee
  | la tarjeta del partido: `traeJson` la sirve de la copia, sin otra bajada.
  */
  const [equiposPortada, setEquiposPortada] = useState<EquipoPortada[]>([])

  /* 20/11/2026 (ronda 5, fútbol): la misma lectura que la tarjeta del partido, al día con el calendario (`portadaAlDia`): escritorio y móvil, una sola tabla. */
  const jugadosCalendario = useMemo(
    () => (ahora ? (alrededorDe(calendario, ahora)?.todos ?? []).filter((uno) => uno.jugado).length : 0),
    [calendario, ahora],
  )

  useEffect(() => {
    if (sinCalendario || !ahora) return

    let vivo = true
    const pon = (r: Partial<RespuestaPortada> | null | undefined) => {
      if (vivo && Array.isArray(r?.equipos)) setEquiposPortada(r.equipos)
    }

    portadaAlDia(jugadosCalendario, pon)
      .then(pon)
      .catch(() => {
        /* Sin la ficha, el panel enseña lo de siempre. */
      })

    return () => {
      vivo = false
    }
  }, [sinCalendario, ahora, jugadosCalendario])

  const fichaRival = useMemo(() => {
    if (sinCalendario || !ahora) return null

    const proximo = alrededorDe(calendario, ahora)?.proximo

    if (!proximo) return null

    const equipo = equipoDelInforme(equiposPortada, proximo.rival)

    if (!equipo || (!equipo.liga && !equipo.ultimos?.length)) return null

    return { nombre: proximo.rival, liga: equipo.liga ?? null, ultimos: equipo.ultimos ?? [], juegaFuera: proximo.lado === "casa" }
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

  const optaNuestro = useMemo(() => (opta ? cifrasOptaDe(opta, CASTILLA_OPTA) : null), [opta])

  /* 20/11/2026 (ronda 5, análisis): goles − xG de cada partido nuestro en Opta, para el gráfico del panel. */
  const difPorPartido = useMemo(() => {
    if (!opta) return []
    const filas = opta.partidos

    return filas
      .filter((f) => String(f.teamId) === CASTILLA_OPTA)
      .map((f) => {
        const goles = numOpta(f.Goal)
        const xg = numOpta(f.ExpG)
        if (goles == null || xg == null) return null
        const otro = filas.find((o) => String(o.partido) === String(f.partido) && String(o.teamId) !== CASTILLA_OPTA)

        return { fecha: String(f.fecha ?? "").slice(0, 10), rival: String(otro?.equipo ?? ""), goles, xg, dif: goles - xg }
      })
      .filter((p): p is NonNullable<typeof p> => p != null && Boolean(p.fecha))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [opta])


  /* El rival del panel oscuro: el de la semana o, si no, el próximo del calendario (20/11/2026, ronda 7). */
  const nombrePanel = useMemo(() => {
    if (rivalSemana) return rivalSemana.nombre
    if (sinCalendario || !ahora) return ""
    return alrededorDe(calendario, ahora)?.proximo?.rival ?? ""
  }, [rivalSemana, sinCalendario, ahora, calendario])

  const escudoPanel = nombrePanel ? escudoDe(nombrePanel) : undefined

  /*
  | PREPARAR CONTRA ÉL (27/11/2026, jueces). La tarjeta del rival llevaba a sus
  | vídeos y a Análisis de datos, pero no a lo que se prepara en la semana: su
  | pizarra de ABP y el plan de partido, con el rival ya elegido (?rival=ID de
  | la hoja RIVALES, la fila de la fecha del partido).
  */
  const jornadasRivales = useJornadasRivales()
  const prepararContra = useMemo(() => {
    if (!nombrePanel || sinCalendario || !ahora) return []
    const proximo = alrededorDe(calendario, ahora)?.proximo
    const enlaces = enlacesDelRival(jornadasRivales, nombrePanel, proximo && proximo.rival === nombrePanel ? proximo.cuando : undefined)
    const plan = enlaces.find((e) => e.texto === "Plan de partido")
    const id = plan ? new URLSearchParams(plan.href.split("?")[1] ?? "").get("rival") : null
    return [
      ...(id ? [{ href: `/abp-pizarra?rival=${encodeURIComponent(id)}`, texto: "Pizarra ABP" }] : []),
      ...(plan ? [{ href: plan.href, texto: proximo?.jornada ? `Plan J${proximo.jornada}` : "Plan de partido" }] : []),
    ]
  }, [nombrePanel, sinCalendario, ahora, calendario, jornadasRivales])

  /*
  | SUS ÚLTIMOS 5, CADA UNO A SU ANÁLISIS (20/11/2026, ronda 7, fútbol): el
  | partido de Opta de cada resultado de BeSoccer, buscado entre los partidos
  | del rival por el nombre del contrario (del más reciente al más antiguo y
  | sin repetir). El que Opta no tenga se queda sin enlace.
  */
  const partidosUltimosRival = useMemo(() => {
    if (!opta || !fichaRival) return []
    const filas = opta.partidos
    const suyos = filas
      .filter((f) => mismoEquipo(String(f.equipo ?? ""), fichaRival.nombre))
      .map((f) => ({
        id: String(f.partido ?? ""),
        fecha: String(f.fecha ?? "").slice(0, 10),
        contrario: String(filas.find((o) => String(o.partido) === String(f.partido) && String(o.teamId) !== String(f.teamId))?.equipo ?? ""),
      }))
      .filter((x) => x.id && x.contrario)
      .sort((x, y) => y.fecha.localeCompare(x.fecha))
    const usados = new Set<string>()

    return [...fichaRival.ultimos].reverse().map((p) => {
      const uno = suyos.find((x) => !usados.has(x.id) && mismoEquipo(x.contrario, p.rival))
      if (!uno) return null
      usados.add(uno.id)
      return uno.id
    }).reverse()
  }, [opta, fichaRival])

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

  /* Opta aún en camino: la cifra espera (no Wyscout primero y Opta después). Con el mismo tope de 8 s que Wyscout: pasado, sale lo que haya. */
  const esperaOpta = cargandoOpta && !opta && !cifrasTarde

  /* La tarjeta del Castilla, cargando: Opta en camino o Wyscout sin llegar y sin nada que enseñar. */
  const cargandoTarjeta = esperaOpta || (cargandoData && !cifrasTarde && !nuestroXg)

  /* El sello de cada cifra: fuente, población y hasta dónde llega. */
  const selloDe = (fuente: "opta" | "wyscout", deCuantos: number, partidos: number) => ({
    fuente,
    /* 17/11/2026 (ronda 21): la misma fórmula que el bloque del rival. */
    poblacion: deCuantos ? `grupo de ${deCuantos} equipos` : undefined,
    hasta: fuente === "opta" ? hastaDeOpta || undefined : undefined,
    partidos,
  })

  /*
  | 20/11/2026 (ronda 7, fútbol y análisis): el «goles frente a lo esperado»
  | del Castilla sale del panel oscuro del rival (en el móvil nuestra curva
  | parecía del Real Murcia) y va en su propia tarjeta clara, junto a «Liga ·
  | BeSoccer», con los colores del tema y el eje del gráfico rotulado.
  */
  const VERDE_CLARO = "#1B9E77"
  const NARANJA_CLARO = "#D95F02"
  const tarjetaXg = rivalSemana ? null : cargandoTarjeta ? (
    <div className="portada-celda flex min-w-0 flex-col gap-2 p-4" aria-busy="true">
      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">Castilla · goles frente a lo esperado</span>
      <span className="h-10 w-40 animate-pulse rounded bg-white/10" />
    </div>
  ) : nuestroXg ? (
    <div className="portada-celda flex min-w-0 flex-col gap-4 p-4">
      {nuestroXg.fuente === "wyscout" && (
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">Castilla · goles esperados (xG)</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 leading-none">
            <span className="fuente-club text-[40px] font-bold leading-none tabular-nums text-white">{coma(nuestroXg.xg, 1)}</span>
            <span className="text-[14px] text-white/70">por partido · más es mejor</span>
          </p>
          <p className="mt-2 break-words text-[12.5px] leading-snug text-white/65">
            {[
              nuestroXg.puesto ? `${nuestroXg.puesto}º de ${nuestroXg.deCuantos} del grupo` : "",
              nuestroXg.mediana != null ? `mediana del grupo ${coma(nuestroXg.mediana, 1)}` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <SelloFuente envuelve {...selloDe(nuestroXg.fuente, nuestroXg.deCuantos, nuestroXg.partidos)} />
          </p>
        </div>
      )}

      {nuestroXg.diferencia != null && nuestroXg.goles != null && (() => {
        const arriba = nuestroXg.diferencia >= 0
        const total = nuestroXg.goles - nuestroXg.esperados
        const color = arriba ? VERDE_CLARO : NARANJA_CLARO

        return (
          <div className="min-w-0">
            <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Castilla · goles frente a lo esperado
              </span>
              <Link
                href={`/data-analisis?area=equipo&equipo=${encodeURIComponent("Real Madrid Castilla")}`}
                onClick={() => {
                  ponEquipoElegido("Real Madrid Castilla")
                  trackModuleVisit("/data-analisis")
                }}
                className="group inline-flex min-h-9 shrink-0 items-center gap-1 text-[13px] font-semibold"
                style={{ color: "var(--rmcf-gold-ink)" }}
              >
                Análisis de datos
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </p>

            <p className="mt-2 flex flex-wrap items-baseline gap-x-2 leading-none">
              <span className="fuente-club text-[44px] font-bold leading-[0.9] tabular-nums" style={{ color: chipInk(color) }}>
                {`${arriba ? "+" : "−"}${coma(Math.abs(nuestroXg.diferencia), Math.abs(nuestroXg.diferencia) < 0.05 ? 2 : 1)}`}
              </span>
              <span className="text-[14px] font-semibold text-white/85">goles por partido</span>
            </p>

            <p className="mt-2 text-[13px] leading-snug tabular-nums text-white/75">
              {nuestroXg.goles} goles − {coma(nuestroXg.esperados, 1)} esperados ={" "}
              <span className="font-semibold" style={{ color: chipInk(color) }}>
                {`${total >= 0 ? "+" : "−"}${coma(Math.abs(total), 1)}`}
              </span>{" "}
              en {nuestroXg.partidos} partidos
              {nuestroXg.partidos < 15 ? " · pocos partidos: léase como tendencia" : ""}
            </p>

            {nuestroXg.fuente === "opta" ? (
              <BarrasDiferencia partidos={difPorPartido} verde={VERDE_CLARO} naranja={NARANJA_CLARO} />
            ) : null}

            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/70">
              <span className={`inline-flex items-center gap-1.5 ${arriba ? "font-semibold text-white/90" : ""}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: VERDE_CLARO }} aria-hidden />
                marca más de lo esperado
              </span>
              <span className={`inline-flex items-center gap-1.5 ${!arriba ? "font-semibold text-white/90" : ""}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: NARANJA_CLARO }} aria-hidden />
                marca menos
              </span>
              <span>· más es mejor</span>
            </p>

            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* `envuelve`: en el móvil la píldora salía cortada («hasta el 15 n…»). */}
              <SelloFuente envuelve {...selloDe(nuestroXg.fuente, nuestroXg.deCuantos, nuestroXg.partidos)} />
            </p>
          </div>
        )
      })()}
    </div>
  ) : null


  return (
    <main className="min-h-screen bg-[#02060D] text-white">
      <div className="flex">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Topbar />

          {/* pb-24: el botón flotante de herramientas no tapa la última fila (30/10/2026).
              Y margen a la derecha: tapaba el borde de la tarjeta del partido.
              16/11/2026 (rediseño): el mismo aire entre todos los bloques.
              17/11/2026 (ronda 21, fútbol): en el móvil el ⋮ (36 px a 8 px del
              borde) montaba sobre el canto derecho de las tarjetas: pr-12
              deja su carril libre; desde sm vuelve el margen de siempre. */}
          <section className="space-y-6 pl-4 pr-12 py-4 pb-24 sm:space-y-8 sm:px-6 sm:py-6 sm:pb-24 xl:space-y-10 xl:py-10 xl:pb-24 xl:pl-10 xl:pr-[76px]">
            {admin && (
              /* Control segmentado: una sola pieza con dos opciones. */
              <div role="tablist" className="portada-celda inline-flex gap-1 p-1">
                {(["portada", "tareas"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={vista === v}
                    onClick={() => setVista(v)}
                    className={`min-h-9 rounded-xl px-4 text-sm font-semibold transition-colors ${vista === v ? "shadow-sm" : "text-white/70 hover:text-white"}`}
                    style={vista === v ? { background: "#D8B45A", color: "#0B0F14" } : undefined}
                  >
                    {v === "portada" ? "Portada" : "Mis tareas"}
                  </button>
                ))}
              </div>
            )}

            {enTareas ? <MisTareas /> : (<>
            {/* ============================ PORTADA ============================ */}

            {/*
              16/11/2026 (rediseño): el héroe es una tarjeta más del sistema de
              la portada (`.portada-heroe`: un radio, un canto y una sombra, con
              su fondo en los dos temas), con un filo dorado arriba.
            */}
            <div className="portada-entra portada-heroe protagonista relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-8 top-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(216,180,90,.7), transparent)" }}
              />

              <div className="relative z-10 grid items-stretch gap-6 p-4 sm:p-7 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)] xl:gap-8 xl:p-8">
                {/* ---------- IZQUIERDA: el próximo partido y la semana ---------- */}
                <ProximoPartido videosEnPanel={Boolean(nombrePanel)} junto={tarjetaXg} />

                {/* ---------- DERECHA: el rival (de MD-4 a MD-1) o lo nuestro ---------- */}

                {/*
                  Panel siempre oscuro (foto del Di Stéfano de noche y azul del
                  club), también en modo día: `siempre-oscuro` desanda la tabla
                  de equivalencias dentro. 16/11/2026 (fútbol): a toda la altura
                  de la columna, sin hueco blanco debajo en escritorio.
                  17/11/2026 (los tres jueces): deja de ser un único enlace para
                  llevar dentro los suyos (sus goles, cómo le marcan, su balón
                  parado); la tarjeta entera sigue abriendo Análisis de datos
                  con un enlace que la cubre por debajo del contenido.
                */}
                <div
                  /* 18/11/2026 (tarde, el analista: «se ve fea»): todo al pie, también en la semana del rival; arriba, la foto del estadio a la vista (centrado dejaba un hueco negro arriba y abajo). */
                  className={`siempre-oscuro portada-viva group relative flex min-h-[240px] flex-col justify-start overflow-hidden [&>div]:pointer-events-none [&>p]:pointer-events-none [&>span]:pointer-events-none`}
                  style={{
                    borderRadius: 20,
                    background:
                      "radial-gradient(120% 80% at 100% 0%, rgba(216,180,90,.18), transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(37,99,235,.22), transparent 60%), linear-gradient(160deg, #13284F 0%, #0B1833 55%, #060D1C 100%)",
                    boxShadow: "inset 0 0 0 1px rgba(216,180,90,.28), 0 24px 50px -24px rgba(6,13,28,.7)",
                  }}
                >
                  <Link
                    href={nombrePanel ? `/data-analisis?area=equipo&equipo=${encodeURIComponent(nombrePanel)}` : "/data-analisis"}
                    onClick={() => {
                      /* 17/11/2026 (ronda 21): «Un equipo de un vistazo» abre con este rival ya elegido. */
                      if (nombrePanel) ponEquipoElegido(nombrePanel)
                      trackModuleVisit("/data-analisis")
                    }}
                    aria-label={nombrePanel ? `${nombrePanel} de un vistazo, en Análisis de datos` : "Análisis de datos"}
                    title={
                      nombrePanel
                        ? `${nombrePanel} de un vistazo, en Análisis de datos`
                        : "Lo que dicen los informes de Wyscout y Opta: el Castilla contra su historia, contra el grupo y la categoría entera"
                    }
                    className="absolute inset-0 rounded-[20px]"
                  />
                  {/* 09/11/2026: de fondo, el Alfredo Di Stéfano de noche (petición del analista). */}
                  {/* 18/11/2026 (noche): en escritorio la tarjeta es alta y estrecha, y el tercio de arriba de la foto (cielo negro) dejaba
                      media tarjeta vacía. La foto se agranda por arriba (−45 %) para que el cielo quede fuera y la grada suba. */}
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-0 xl:-top-[45%]">
                    <Image
                      src="/stadium-bg.png"
                      alt=""
                      fill
                      sizes="(max-width: 1279px) 100vw, 900px"
                      priority
                      className="pointer-events-none object-cover object-[50%_45%] transition-transform duration-[4000ms] group-hover:scale-105"
                    />
                  </div>

                  {/* Velo: oscurece abajo para leer las cifras (más parejo en tableta y móvil, donde el texto ocupa casi todo). */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 hidden xl:block"
                    /* 20/11/2026 (ronda 7): el rival va arriba de la tarjeta; el velo oscurece arriba y deja ver la grada abajo. */
                    style={{ background: "linear-gradient(180deg, rgba(6,13,28,.95) 0%, rgba(11,24,51,.88) 50%, rgba(6,13,28,.6) 100%)" }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 xl:hidden"
                    style={{ background: "linear-gradient(180deg, rgba(6,13,28,.74) 0%, rgba(11,24,51,.86) 45%, rgba(6,13,28,.95) 100%)" }}
                  />

                  {/* 18/11/2026: el escudo ya no va de marca de agua (se montaba sobre los vídeos): va nítido junto al nombre, en FichaRival. */}

                  <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(216,180,90,.8), transparent)" }} />

                  {/* 11/11/2026 (fútbol): arriba, la ficha del rival de BeSoccer. */}
                  {fichaRival && <FichaRival ficha={fichaRival} empuja={false} escudo={escudoPanel} partidos={partidosUltimosRival} />}

                  {nombrePanel && !fichaRival && (
                    <p className="fuente-club relative px-5 pt-5 text-[28px] font-bold uppercase leading-none sm:px-6 sm:pt-6" style={{ color: "#fff" }}>
                      {nombrePanel}
                    </p>
                  )}

                  {/*
                    Pie del panel: el rival en vídeo y «Cómo juega». 20/11/2026
                    (ronda 7, marketing y fútbol): toda la semana, no sólo de MD-4
                    a MD-1. Sus goles, cómo le marcan y su ABP en vídeo, aquí, en
                    la tarjeta del rival (salen del héroe, donde se repetían), y
                    el «goles frente a lo esperado» del Castilla, a su tarjeta
                    clara junto a la liga (en el móvil parecía del rival).
                  */}
                  {nombrePanel ? (
                    <>
                      {/* Hijo directo de la tarjeta: `[&>div]` le quita el puntero; los vídeos lo recuperan dentro. */}
                      <div className="relative px-5 pt-5 sm:px-6">
                        <div className="pointer-events-auto">
                          <VideosDelRival key={nombrePanel} rival={nombrePanel} apilado />
                        </div>
                        {prepararContra.length ? (
                          <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,.7)" }}>
                              Preparar contra él
                            </span>
                            {prepararContra.map((e) => (
                              <Link
                                key={e.href}
                                href={e.href}
                                className="inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[13px] font-semibold transition hover:bg-white/10"
                                style={{ color: "#F7D98B", borderColor: "rgba(247,217,139,.4)", backgroundColor: "rgba(2,6,13,.55)" }}
                              >
                                {e.texto}
                                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <p className="relative flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
                        <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold" style={{ color: "rgba(255,255,255,.92)" }}>
                          Cómo juega, en Análisis de datos
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </p>
                    </>
                  ) : (
                    /* Sin cifras (09/11/2026): no la foto sola, sino adónde lleva. */
                    <span
                      className="relative m-4 inline-flex items-center gap-1.5 self-start rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] font-semibold backdrop-blur-xl"
                      style={{ color: "#F7D98B", backgroundColor: "rgba(2,6,13,.85)" }}
                    >
                      Análisis de datos
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 19/11/2026 (fútbol): de MD-4 a MD-1, «el rival frente a nosotros» va
                justo detrás del próximo partido, antes de «Tu día» y los atajos. */}
            {rivalSemana ? <OptaPortada /> : null}

            {/* ======================= TU DÍA Y MESA DE TRABAJO ================= */}

            {/* 13/11/2026: el directo de Opta de un toque (lanza y lleva a verlo). */}
            <DirectoPortada />

            <PanelHoy admin={Boolean(admin)} />

            {/* =========================== AVISOS ============================= */}

            {/* La conexión con Google (correo y YouTube), sólo si se ha caído y sólo al admin. */}
            <AvisoConexionGoogle />

            {/* Lo que se ha salido de lo normal; las alertas miran la última vez de cada uno, aunque sea de antes del 21/10. */}
            <AlertasPortada plantilla={plantilla} seguimiento={seguimientoTodo} />

            {/* ======================= EL ÚLTIMO PARTIDO ======================= */}

            {/*
              14/11/2026: el último partido en 3D (si ya tiene su evento a evento).
              10/11/2026: el próximo rival y nosotros en cuatro cifras de Opta.
              17/11/2026 (fútbol): de MD-4 a MD-1 manda el rival: Opta sube por
              encima del 3D; el resto de la semana, el 3D primero.
            */}
            {rivalSemana ? (
              <UltimoPartido3D />
            ) : (
              <>
                <UltimoPartido3D />
                <OptaPortada />
              </>
            )}

            {/* ========================== CIFRAS =============================== */}

            {/* 18/11/2026 (ronda 23, guionista): sólo trae seguimientos, así que se llama como lo que trae. */}
            <section className="portada-tarjeta p-4 sm:p-6" aria-label="Seguimiento de la plantilla">
              <CabeceraBloque
                icono={BarChart3}
                titulo="Seguimiento de la plantilla"
                sub="Seguimientos de la temporada · jugadores de campo del Castilla, sin porteros"
              />

              <div className="mt-5">
                {/*
                  Una población y una base por casilla (07/11/2026, análisis y marketing).
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
                            /* 16/11/2026 (marketing): abre la ficha del que menos seguimientos lleva. */
                            /* 18/11/2026 (ronda 22): su ficha, ya en la pestaña de seguimiento. */
                            /* 20/11/2026 (ronda 4, análisis): y la acción, no sólo el dato: abre «Nuevo seguimiento» con él ya elegido. */
                            href: menosSeguido
                              ? `/individual?player=${encodeURIComponent(menosSeguido.id)}&nombre=${encodeURIComponent(menosSeguido.nombre)}&nuevo=seguimiento`
                              : "/individual",
                            label: "Con seguimiento",
                            value: jugadoresSeguimiento,
                            suffix: totalJugadores ? ` de ${totalJugadores}` : undefined,
                            caption: totalJugadores
                              ? `jugadores de campo con al menos un seguimiento · ${cobertura} % de la plantilla`
                              : "jugadores de campo con al menos un seguimiento",
                            /* 17/11/2026 (ronda 20, fútbol): con empate no se nombra a uno solo como «el que menos». */
                            destino: menosSeguido
                              ? (() => {
                                  const empatados = menosSeguidos.filter((j) => j.veces === menosSeguido.veces)
                                  /* 18/11/2026 (ronda 22, fútbol y guionista): «Menos seguimientos: A y B (1 cada uno; mediana 20,5)». */
                                  const nombres = empatados.map((j) => j.nombre)
                                  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0]
                                  const cuantas = empatados.length > 1 ? `${menosSeguido.veces} cada uno` : `${menosSeguido.veces}`
                                  const mediana = medianaSeguimientos != null ? `; mediana ${coma(medianaSeguimientos, Number.isInteger(medianaSeguimientos) ? 0 : 1)}` : ""
                                  return `Menos seguimientos: ${lista} (${cuantas}${mediana}) · programar el siguiente`
                                })()
                              : "Abrir las fichas de nuestros jugadores",
                            loading: loadingSeguimiento || cargandoPlantilla,
                            icon: Users,
                            progreso: totalJugadores ? (jugadoresSeguimiento / totalJugadores) * 100 : undefined,
                          },
                          {
                            href: "/calendar",
                            label: "Seguimientos",
                            value: seguimientos,
                            caption: [
                              "en la temporada",
                              ultimos30Dias === seguimientos ? `${ultimos7Dias} esta semana` : `${ultimos30Dias} en los últimos 30 días`,
                            ].join(" · "),
                            destino: "Abrir los seguimientos",
                            loading: loadingSeguimiento,
                            icon: Activity,
                            serie: porSemana.some((n) => n > 0)
                              ? {
                                  valores: porSemana,
                                  descripcion: `Seguimientos por semana, de hace 10 semanas a esta: ${porSemana.join(", ")}`,
                                  textoVariacion: "frente a la semana anterior",
                                }
                              : undefined,
                          },
                        ]
                  }
                />
              </div>

              {/*
                17/11/2026 (ronda 21, análisis y marketing): cada uno con su
                ficha y su seguimiento (`?player=` + `pestana=seguimiento`, que
                es lo que lee /individual) y la mediana con la que se compara.
              */}
              {!errorSeguimiento && menosSeguidos.length > 1 && (
                <div className="portada-celda mt-4 p-3.5 sm:p-4">
                  <p className="text-[13px] leading-snug text-white/70">
                    {/* 18/11/2026: la mediana va ya en la casilla de arriba; aquí no se repite. */}
                    <span className="font-semibold text-white/90">Los {menosSeguidos.length} que menos seguimientos llevan</span>
                    {totalJugadores ? ` · de ${totalJugadores} jugadores de campo, sin porteros` : ""}
                    {/* 20/11/2026 (ronda 7, análisis): el criterio de orden y la base, a la vista. */}
                    {" · ordenados de menos a más"}
                    {bajoMediana != null && medianaSeguimientos != null && totalJugadores
                      ? ` · ${bajoMediana} de ${totalJugadores} por debajo de la mediana (${coma(medianaSeguimientos, Number.isInteger(medianaSeguimientos) ? 0 : 1)})`
                      : ""}
                  </p>
                  <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-3">
                    {menosSeguidos.map((j, i) => (
                      <li key={j.nombre} className="flex min-w-0 items-center gap-1.5">
                        <Link
                          href={`/individual?player=${encodeURIComponent(j.id)}&nombre=${encodeURIComponent(j.nombre)}`}
                          onClick={() => trackModuleVisit("/individual")}
                          className="portada-viva inline-flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-white/10 px-3 text-[13.5px] font-semibold text-white/90"
                          title={`Ficha de ${j.nombre}`}
                        >
                          <span className="min-w-0 truncate">
                            <span className="mr-1.5 tabular-nums text-white/55">{i + 1}.º</span>
                            {j.nombre}
                          </span>
                          {/* 20/11/2026 (ronda 4, fútbol): la cifra con su palabra, en plural cuando toca. */}
                          <span className="shrink-0 tabular-nums text-[12.5px] font-medium text-white/65">
                            {j.veces} {j.veces === 1 ? "seguimiento" : "seguimientos"}
                          </span>
                        </Link>
                        {/* 20/11/2026 (ronda 4, análisis): la acción —programar su seguimiento—, con él ya elegido. */}
                        <Link
                          href={`/individual?player=${encodeURIComponent(j.id)}&nombre=${encodeURIComponent(j.nombre)}&nuevo=seguimiento`}
                          onClick={() => trackModuleVisit("/individual")}
                          className="portada-viva inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-white/10 px-2.5 text-[12.5px] font-semibold"
                          style={{ color: "var(--rmcf-gold-ink)" }}
                          title={`Programar un seguimiento a ${j.nombre}`}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Programar
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sólo cuando algo no ha llegado: el botón para volver a pedirlo. */}
              {hayFallos && (
                <EstadoError
                  className="mt-3"
                  titulo="No se han podido cargar todas las cifras"
                  onReintentar={reintentar}
                  reintentando={loadingSeguimiento || cargandoData}
                />
              )}
            </section>

            {/* 17/11/2026 (fútbol): «Áreas de trabajo» vive ya dentro de «Atajos» (PanelHoy), plegada. */}
            </>)}
          </section>
        </div>
      </div>
    </main>
  )
}
