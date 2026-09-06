"use client"

import Link from "next/link"
import Image from "next/image"
import { chipInk } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import {
  Activity,
  BarChart3,
  ChevronRight,
  Handshake,
  LayoutGrid,
  Maximize2,
  Shield,
  Swords,
  Users,
} from "lucide-react"

import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import ModulesExplorer from "@/components/ui/ModulesExplorer"
import QuickAccess from "@/components/ui/QuickAccess"
import { trackModuleVisit, useModulosMasUsados } from "@/lib/module-usage"
import { pantallaCompletaAlNavegar } from "@/hooks/usePantallaCompleta"
import { usePlayers } from "@/hooks/usePlayers"
import { alineaSeguimiento } from "@/lib/seguimiento"
import { traeCsv, traeJson } from "@/lib/hojaCsv"

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

function Metric({ value, loading }: { value: number; loading: boolean }) {
  if (loading) {
    return (
      <span
        aria-hidden
        className="inline-block h-[0.8em] w-[2.2ch] animate-pulse rounded-md bg-white/10 align-baseline"
      />
    )
  }

  return <span className="tabular-nums">{value.toLocaleString("es-ES")}</span>
}

/**
 * Tarjeta de dato: el número manda y el resto acompaña.
 *
 * `destino` es el nombre de la pantalla a la que lleva, y no es opcional a
 * propósito. El rótulo de arriba nombra **la métrica** —«Seguimientos»,
 * «Promedio»— y eso no dice a dónde se va al pulsar: la tarjeta parecía un
 * dato y era un enlace. El nombre va al pie, con la flecha, igual en las seis.
 */
function StatCard({
  href,
  label,
  value,
  caption,
  destino,
  loading,
  icon: Icon,
  suffix,
}: {
  href: string
  label: string
  value: number
  caption: string
  destino: string
  loading: boolean
  icon: React.ElementType
  suffix?: string
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#07121F] to-[#040B14] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#D8B45A]/40 hover:shadow-[0_18px_50px_-20px_rgba(216,180,90,.35)] sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#D8B45A]/[0.08] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#D8B45A]">
          {label}
        </p>

        <Icon className="h-5 w-5 shrink-0 text-[#D8B45A]/60 transition group-hover:text-[#D8B45A]" />
      </div>

      <div className="relative mt-8">
        <p className="text-[40px] font-bold leading-none tracking-tight">
          <Metric value={value} loading={loading} />

          {suffix && (
            <span className="ml-0.5 text-xl font-semibold text-white/40">
              {suffix}
            </span>
          )}
        </p>

        <p className="mt-2.5 text-[13px] text-white/50">{caption}</p>

        <p className="mt-4 flex items-center gap-1.5 border-t border-white/[0.07] pt-3 text-[12px] font-medium text-white/45 transition-colors duration-300 group-hover:text-[#D8B45A]">
          {destino}
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </p>
      </div>
    </Link>
  )
}

/**
 * Tarjeta de fase de juego: aquí el color sí identifica (ataque / defensa /
 * cultura). Como la de dato, dice al pie a qué pantalla lleva: «Ataque» es la
 * fase del juego, no el sitio al que se va.
 */
function IdentityCard({
  href,
  title,
  value,
  caption,
  destino,
  loading,
  color,
  icon: Icon,
}: {
  href: string
  title: string
  value: number
  caption: string
  destino: string
  loading: boolean
  color: string
  icon: React.ElementType
}) {
  return (
    <Link
      href={href}
      style={{ ["--accent" as string]: chipInk(color) }}
      className="group relative flex items-center gap-5 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent)]/45 hover:bg-white/[0.04] sm:p-6"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-[color:var(--accent)] opacity-50 transition-opacity duration-300 group-hover:opacity-100"
      />

      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[color:var(--accent)] transition-colors duration-300 group-hover:border-[color:var(--accent)]/40 group-hover:bg-[color:var(--accent)]/10">
        <Icon className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold uppercase tracking-[0.22em] text-white/85">
          {title}
        </span>

        <span className="mt-1 block text-[12px] text-white/40">{caption}</span>

        <span className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-white/35 transition-colors duration-300 group-hover:text-[color:var(--accent)]">
          {destino}
          <ChevronRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      </span>

      <span className="text-[34px] font-bold leading-none text-[color:var(--accent)]">
        <Metric value={value} loading={loading} />
      </span>
    </Link>
  )
}

export default function Home() {
  /*
  | Los tres enlaces grandes de arriba llevaban destino fijo —el Área General y
  | dos calendarios— y no tenían por qué ser lo que se abre a diario. Ahora los
  | pone el propio uso de este dispositivo: el primero es lo que más se abre.
  |
  | Van con su nombre puesto, así que aunque cambien de sitio con el tiempo
  | nunca sorprenden: la tarjeta dice a dónde lleva.
  */
  const [masUsado, segundo, tercero] = useModulosMasUsados(3)

  const [ataqueApartados, setAtaqueApartados] = useState(0)
  const [defensaApartados, setDefensaApartados] = useState(0)
  const [principiosCultura, setPrincipiosCultura] = useState(0)

  const [filasSeguimiento, setFilasSeguimiento] = useState<Seguimiento[]>([])

  /* La ventana de treinta días se cuenta al llegar los datos y no al pintar:
     mirar el reloj durante el render es impuro y el linter lo para. */
  const [ultimos30Dias, setUltimos30Dias] = useState(0)

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
  const { players: plantilla, loading: cargandoPlantilla } = usePlayers()

  const totalJugadores = plantilla.length

  const { jugadoresSeguimiento, sesionesDeLaPlantilla } = useMemo(() => {
    if (plantilla.length === 0) {
      return { jugadoresSeguimiento: 0, sesionesDeLaPlantilla: 0 }
    }

    /* Por nombre, que es lo que manda: un ID viejo apunta hoy a otra persona. */
    const atados = alineaSeguimiento(
      filasSeguimiento.flatMap((fila) =>
        fila.ID_JUGADOR ? [{ ...fila, ID_JUGADOR: fila.ID_JUGADOR }] : [],
      ),
      plantilla,
    )

    const deLaPlantilla = new Set(plantilla.map((jugador) => jugador.id))

    const conRegistro = new Set<string>()

    let sesiones = 0

    for (const fila of atados) {
      if (!deLaPlantilla.has(fila.ID_JUGADOR)) continue

      conRegistro.add(fila.ID_JUGADOR)

      sesiones += 1
    }

    return { jugadoresSeguimiento: conRegistro.size, sesionesDeLaPlantilla: sesiones }
  }, [filasSeguimiento, plantilla])

  const seguimientos = filasSeguimiento.length

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

  useEffect(() => {
    traeCsv(CSV_CULTURA)
      .then((csv) => {
        const parsed = Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
        })

        setPrincipiosCultura(parsed.data.length)
      })
      .catch(() => {})
      .finally(() => setLoadingCultura(false))
  }, [])

  useEffect(() => {
    traeCsv(CSV_PRINCIPIOS)
      .then((csv) => {
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
      })
      .catch(() => {})
      .finally(() => setLoadingPrincipios(false))
  }, [])

  useEffect(() => {
    traeJson<unknown>(ENDPOINT_SEGUIMIENTO)
      .then((data) => {
        const filas: Seguimiento[] = Array.isArray(data) ? data : []

        setFilasSeguimiento(filas)

        const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

        setUltimos30Dias(
          filas.filter((fila) => {
            const fecha = new Date(fila.FECHA ?? "")

            return !isNaN(fecha.getTime()) && fecha >= limite
          }).length
        )
      })
      .catch(() => {})
      .finally(() => setLoadingSeguimiento(false))
  }, [])

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
                {/* ---------- IZQUIERDA: mensaje y arranque ---------- */}

                <div className="flex flex-col justify-center">
                  <div className="inline-flex w-fit items-center gap-3 rounded-full border border-[#D8B45A]/40 bg-[#D8B45A]/10 px-4 py-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F7D98B] opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F7D98B]" />
                    </span>

                    <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F7D98B]">
                      Temporada 26/27 · en curso
                    </span>
                  </div>

                  <h1 className="mt-6 text-[40px] font-bold leading-[0.95] tracking-[-0.035em] sm:text-[54px] xl:text-[64px] xl:leading-[0.92]">
                    Plataforma Integral
                    <br />
                    <span className="bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-white bg-clip-text text-transparent">
                      RMCF Castilla
                    </span>
                  </h1>

                  <div className="mt-6 flex gap-4">
                    <div className="w-[3px] shrink-0 rounded-full bg-gradient-to-b from-blue-400 via-blue-500 to-transparent" />

                    <p className="max-w-[620px] text-base leading-relaxed text-white/70 sm:text-[17px]">
                      Identidad, competición, desarrollo individual, rendimiento
                      colectivo y análisis del rival, en un mismo sitio.
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link
                      href={segundo.href}
                      onClick={() => trackModuleVisit(segundo.href)}
                      className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-6 py-3.5 text-[15px] font-medium shadow-[0_0_36px_rgba(37,99,235,.32)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_48px_rgba(37,99,235,.45)]"
                    >
                      <segundo.icon className="h-[18px] w-[18px]" />
                      {segundo.title}
                      <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>

                    <Link
                      href={tercero.href}
                      onClick={() => trackModuleVisit(tercero.href)}
                      className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-3.5 text-[15px] font-medium text-white/85 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/45 hover:bg-white/[0.07] hover:text-white"
                    >
                      <tercero.icon className="h-[18px] w-[18px] text-emerald-400" />
                      {tercero.title}
                      <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>

                    {/*
                      La pizarra, a pantalla completa desde el primer clic.

                      Es lo que se abre delante del grupo, y llegar con el menú
                      y la barra de arriba puestos obliga a buscar el botón de
                      agrandar mientras todos esperan. La pantalla completa se
                      pide **aquí**, aprovechando este mismo clic: el navegador
                      sólo la concede con un gesto de la persona y un efecto al
                      cargar la otra página llegaría tarde. Como Next navega sin
                      recargar el documento, se llega ya en grande.
                    */}
                    <Link
                      href="/pizarra-tactica"
                      onClick={() => {
                        trackModuleVisit("/pizarra-tactica")
                        pantallaCompletaAlNavegar()
                      }}
                      title="Abre la pizarra táctica ocupando toda la pantalla"
                      className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-6 py-3.5 text-[15px] font-medium text-[#C8A96B] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#C8A96B]/70 hover:bg-[#C8A96B]/20"
                    >
                      <Maximize2 className="h-[18px] w-[18px]" />
                      Pizarra táctica
                      <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>

                {/* ---------- DERECHA: visión global ---------- */}

                <Link
                  href={masUsado.href}
                  onClick={() => trackModuleVisit(masUsado.href)}
                  className="light-sweep group relative block min-h-[320px] overflow-hidden rounded-[28px] border border-white/10 xl:min-h-[400px]"
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

                  {/* La chapa dice a dónde lleva la tarjeta: el destino lo pone
                      el uso, así que tiene que ir con su nombre puesto. */}
                  <div className="absolute left-5 top-5 max-w-[calc(100%-40px)]">
                    <div className="flex items-center gap-2.5 rounded-full border border-cyan-500/30 bg-black/60 px-4 py-2 backdrop-blur-xl transition group-hover:border-cyan-400/60">
                      <masUsado.icon className="h-[15px] w-[15px] shrink-0 text-cyan-400" />

                      <p className="truncate text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-400">
                        {masUsado.title}
                      </p>

                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-cyan-400/70 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </div>
                  </div>

                  {/* Pie del panel: cobertura de seguimiento */}
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 rounded-[22px] border border-white/10 bg-black/50 px-5 py-4 backdrop-blur-xl">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">
                        Cobertura de seguimiento
                      </p>

                      <p className="mt-2 text-3xl font-bold leading-none text-white">
                        <Metric
                          value={cobertura}
                          loading={loadingSeguimiento || cargandoPlantilla}
                        />
                        <span className="ml-0.5 text-lg text-white/50">%</span>
                      </p>

                      <div className="mt-3 h-1 w-36 max-w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-1000 ease-out"
                          style={{ width: `${Math.min(cobertura, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">
                        Últimos 30 días
                      </p>

                      <p className="mt-2 text-3xl font-bold leading-none text-cyan-400">
                        <Metric value={ultimos30Dias} loading={loadingSeguimiento} />
                      </p>

                      <p className="mt-1 text-[11px] text-white/45">registros</p>
                    </div>
                  </div>

                  <div className="scan-line" aria-hidden />
                </Link>
              </div>
            </div>

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

            {/* ====================== DESARROLLO INDIVIDUAL ==================== */}

            <div>
              <SectionHeader
                icon={Users}
                title="Desarrollo individual"
                caption="Datos en vivo de la hoja de seguimiento"
              />

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <StatCard
                  href="/calendar"
                  label="Seguimientos"
                  value={seguimientos}
                  caption="Sesiones registradas"
                  destino="Calendario Seguimiento"
                  loading={loadingSeguimiento}
                  icon={Activity}
                />

                <StatCard
                  href="/individual"
                  label="Jugadores"
                  value={totalJugadores}
                  caption="Jugadores en plantilla"
                  destino="Plantilla"
                  loading={cargandoPlantilla}
                  icon={Users}
                />

                <StatCard
                  href="/individual_proc"
                  label="Promedio"
                  value={promedioSeguimientos}
                  caption="Seguimientos por jugador"
                  destino="Dashboard Seguimiento"
                  loading={loadingSeguimiento}
                  icon={BarChart3}
                />
              </div>
            </div>

            {/* ======================= IDENTIDAD DE JUEGO ====================== */}

            <div>
              <SectionHeader
                icon={Swords}
                title="Identidad de juego"
                caption="Apartados definidos del modelo"
              />

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <IdentityCard
                  href="/game-model#ATAQUE"
                  title="Ataque"
                  value={ataqueApartados}
                  caption="Apartados ofensivos"
                  destino="Identidad de Juego"
                  loading={loadingPrincipios}
                  color="#22D3EE"
                  icon={Swords}
                />

                <IdentityCard
                  href="/game-model#DEFENSA"
                  title="Defensa"
                  value={defensaApartados}
                  caption="Apartados defensivos"
                  destino="Identidad de Juego"
                  loading={loadingPrincipios}
                  color="#60A5FA"
                  icon={Shield}
                />

                <IdentityCard
                  href="/team-values"
                  title="Cultura"
                  value={principiosCultura}
                  caption="Elementos culturales"
                  destino="Dinámicas y Valores"
                  loading={loadingCultura}
                  color="#34D399"
                  icon={Handshake}
                />
              </div>
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
                className="text-[11px] uppercase tracking-[0.24em] text-white/20 transition-colors hover:text-white/50"
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
