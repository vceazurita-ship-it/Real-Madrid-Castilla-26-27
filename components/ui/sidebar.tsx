"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react"
/*
| Un icono por entrada y ninguno repetido.
|
| El menú pasa la mayor parte del tiempo **plegado**: sin la etiqueta al lado,
| dos entradas con el mismo dibujo son la misma entrada. Los que se repetían
| se han repartido por lo que hace cada página, no por la sección en la que
| cae.
*/
import {
  Settings,
  ArrowLeft,
  BarChart3,
  Binoculars,
  BookOpen,
  Bus,
  CalendarCheck,
  CalendarClock,
  CalendarCog,
  CalendarDays,
  CalendarRange,
  Clapperboard,
  ClipboardCheck,
  Database,
  Dices,
  Dumbbell,
  Flag,
  FlaskConical,
  Gauge,
  Goal,
  Handshake,
  HeartHandshake,
  History,
  Home,
  LayoutGrid,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  ClipboardPlus,
  Crosshair,
  CircleDot,
  PencilRuler,
  Presentation,
  Projector,
  Scale,
  Scissors,
  Search,
  Shield,
  ShieldHalf,
  Sigma,
  Star,
  Target,
  Trophy,
  User,
  UserCheck,
  UserSearch,
  Users,
  UsersRound,
  X,
  Swords,
} from "lucide-react"

import { trackModuleVisit } from "@/lib/module-usage"
import { foldText } from "@/lib/modules"
import { cn } from "@/lib/utils"
import { useVolver } from "@/hooks/useVolver"
import { useAdmin } from "@/hooks/useAdmin"
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion"
import { useBodyScrollLock } from "@/components/season/useBodyScrollLock"

/*
|--------------------------------------------------------------------------
| EL MENÚ LATERAL
|--------------------------------------------------------------------------
|
| Cuarenta y tantas entradas en nueve secciones. Lo que hace que se pueda usar:
|
| - **En escritorio es un rail de 78 px que se despliega POR ENCIMA del
|   contenido**, no a su lado. Antes el `aside` crecía de 78 a 280 px dentro
|   del flujo y cada vez que el ratón lo rozaba la página entera se recolocaba
|   a la derecha. Ahora el hueco que ocupa en la página no cambia: lo que se
|   despliega es un panel absoluto con sombra, y el contenido no se mueve.
|   Se puede **fijar** (el botón de arriba, también para el iPad, donde no
|   hay ratón que pasar por encima); fijado sí ocupa sus 280 px de verdad y
|   se recuerda en este dispositivo.
|
| - **En móvil es un cajón, siempre con los rótulos.** Antes se abría como el
|   mismo rail plegado de 78 px —sólo iconos— porque `collapsed` nacía en
|   `true` y en un teléfono no hay `mouseenter` que lo pusiera a `false`.
|
| - **Un buscador**: se escribe un trozo del nombre y quedan sólo las
|   entradas que lo llevan, con su sección. Es la forma rápida en un teléfono
|   y en un rail que hay que desplazar.
|
| - **Se sabe dónde se está**: la entrada actual lleva una barra dorada y su
|   sección se ilumina, y al entrar en una página el listado se coloca solo
|   para que la entrada activa quede a la vista.
|
| Las entradas son datos (`SECCIONES`), no JSX: es lo que permite filtrarlas.
*/

type Entrada = {
  href: string
  label: string
  icon: ComponentType<{ size?: number; className?: string }>
  /** Sin enlace: la página existe pero está en obras. */
  obras?: string
}

type Seccion = { titulo: string; entradas: Entrada[] }

const EN_OBRAS = "Todavía estamos haciendo cambios"

/*
| El orden es el de la semana tal y como se trabaja: primero lo que se
| prepara —la metodología, el rival y el jugador— y después el partido.
| Balón parado va junto, lo que no es trabajo (la quiniela) al final, y lo que
| está en obras detrás de todo, para que no se cruce con la semana.
*/
const SECCIONES: Seccion[] = [
  {
    titulo: "Inicio",
    entradas: [{ href: "/", label: "Real Madrid Castilla", icon: Home }],
  },
  {
    titulo: "Identidad",
    entradas: [
      { href: "/team-values", label: "Dinámicas y Valores", icon: Handshake },
      { href: "/identidad-cultura", label: "Identidad y Cultura", icon: BookOpen },
      { href: "/game-model", label: "Identidad de Juego", icon: Network },
      { href: "/identidad-posicional", label: "Identidad Posicional", icon: LayoutGrid },
    ],
  },
  {
    titulo: "Metodología",
    entradas: [
      { href: "/micro_calendar", label: "Contenidos Microciclo", icon: BookOpen },
      { href: "/microcycles", label: "Microciclos", icon: CalendarDays },
      { href: "/laboratorio/microciclo", label: "Crear o editar microciclo", icon: ClipboardPlus },
      { href: "/jugadores-sesion", label: "Jugadores Sesión", icon: UsersRound },
      { href: "/calendar", label: "Calendario Seguimiento", icon: CalendarCheck },
      { href: "/individual_proc", label: "Dashboard Seguimiento", icon: BarChart3 },
    ],
  },
  {
    titulo: "Rival",
    entradas: [
      { href: "/rivals", label: "Plantillas", icon: Users },
      { href: "/scout-rival-individual", label: "Individual", icon: UserSearch },
      { href: "/scout-rival-collective", label: "Colectivo", icon: Binoculars },
      { href: "/scout-rival-abp", label: "ABP del Rival", icon: Target },
      { href: "/scout-rival-area", label: "Área del Rival", icon: CircleDot },
    ],
  },
  {
    titulo: "Individual",
    entradas: [
      { href: "/individual", label: "Plantilla", icon: User },
      { href: "/ratings", label: "Valoraciones", icon: Star },
      { href: "/comparative_ind", label: "Comparativa categoría", icon: Scale },
    ],
  },
  {
    /* Todo lo que rodea al partido, de arriba abajo: se prepara, se dibuja,
       se juega, se corta el vídeo y se lee lo que dejó. */
    titulo: "Competición",
    entradas: [
      { href: "/match-preparation", label: "Preparación de Partido", icon: ClipboardCheck },
      { href: "/duelos", label: "Duelos", icon: Swords },
      { href: "/pizarra-tactica", label: "Pizarra Táctica", icon: PenTool },
      { href: "/match-plans", label: "Vídeo Análisis Partidos", icon: Clapperboard },
      { href: "/coding", label: "Coding de Partido", icon: Scissors },
      { href: "/collective_history", label: "Histórico Competición", icon: History },
      { href: "/data-analisis", label: "Data Análisis", icon: Sigma },
      { href: "/laboratorio/transiciones", label: "Robos y transiciones", icon: Crosshair },
      { href: "/laboratorio/faltas", label: "Análisis de faltas", icon: Crosshair },
    ],
  },
  {
    titulo: "Balón Parado",
    entradas: [
      { href: "/setpieces", label: "ABP Ofensivo", icon: Goal },
      { href: "/setpieces_def", label: "ABP Defensivo", icon: Shield },
      { href: "/throw-ins", label: "Saque de Banda Ofensivo", icon: Flag },
      { href: "/throw-ins-def", label: "Saque de Banda Defensivo", icon: ShieldHalf },
      { href: "/abp-microciclo", label: "Microciclo ABP", icon: CalendarRange },
      { href: "/abp-pizarra", label: "Pizarra ABP", icon: Projector },
    ],
  },
  {
    titulo: "Relacional",
    entradas: [{ href: "/emotion", label: "Emocional", icon: HeartHandshake }],
  },
  {
    titulo: "Rendimiento",
    entradas: [
      { href: "/calendar_performance", label: "Calendario Condicional", icon: CalendarClock },
      { href: "/performance", label: "Área Condicional", icon: Dumbbell },
    ],
  },
  {
    titulo: "Operativa General",
    entradas: [
      { href: "/calendar_general", label: "Calendario Operativa", icon: CalendarCog },
      { href: "/desplazamiento", label: "Desplazamiento", icon: Bus },
      { href: "/general", label: "Repositorio", icon: Database },
    ],
  },
  {
    /* Lo único del menú que no es trabajo: se mira el lunes. */
    titulo: "La Quiniela",
    entradas: [{ href: "/quiniela", label: "Quiniela de la Semana", icon: Trophy }],
  },
  {
    titulo: "En obras",
    entradas: [
      { href: "/laboratorio/escudos", label: "Escudos de la liga", icon: Shield },
      { href: "/laboratorio/apuestas", label: "Apuestas del staff", icon: Dices },
      { href: "#pizarra-sesion", label: "Pizarra Sesión", icon: PencilRuler, obras: EN_OBRAS },
      { href: "#jugadores-sesion", label: "Jugadores Sesión", icon: UserCheck, obras: EN_OBRAS },
      { href: "#pizarra-competicion", label: "Pizarra Competición", icon: Presentation, obras: EN_OBRAS },
      { href: "#dashboard-individual", label: "Dashboard Individual", icon: Gauge, obras: EN_OBRAS },
      {
        href: "#laboratorio",
        label: "Laboratorio",
        icon: FlaskConical,
        obras:
          "La prueba del borrador del plan sigue en /laboratorio, pero no se entra desde aquí hasta que se decida si pasa a producción",
      },
    ],
  },
]

/* Lo último del menú: no se entra aquí a trabajar, se entra a poner algo al día. */
const AJUSTES: Seccion = {
  titulo: "Ajustes",
  entradas: [{ href: "/ajustes", label: "Poner al día", icon: Settings }],
}

/* ------------------------------------------------------------------ */
/*  EL MENÚ FIJADO, RECORDADO EN ESTE DISPOSITIVO                      */
/* ------------------------------------------------------------------ */

const CLAVE_FIJADO = "rmcf-menu-fijado"

const oyentes = new Set<() => void>()

function suscribeFijado(avisa: () => void) {
  oyentes.add(avisa)
  window.addEventListener("storage", avisa)

  return () => {
    oyentes.delete(avisa)
    window.removeEventListener("storage", avisa)
  }
}

function leeFijado() {
  try {
    return localStorage.getItem(CLAVE_FIJADO) === "1"
  } catch {
    return false
  }
}

/* En el servidor —y en el primer pintado— el menú va plegado. */
const fijadoEnServidor = () => false

function guardaFijado(valor: boolean) {
  try {
    localStorage.setItem(CLAVE_FIJADO, valor ? "1" : "0")
  } catch {
    /* Modo privado: se fija sólo hasta recargar. */
  }

  oyentes.forEach((avisa) => avisa())
}

/* ------------------------------------------------------------------ */
/*  EL COMPONENTE                                                      */
/* ------------------------------------------------------------------ */

export function Sidebar() {
  const pathname = usePathname()

  const { visible: puedeVolver, volver } = useVolver()

  /* Cajón del móvil. */
  const [open, setOpen] = useState(false)

  /* Escritorio: el ratón está encima (se despliega sin fijar). */
  const [encima, setEncima] = useState(false)

  const fijado = useSyncExternalStore(suscribeFijado, leeFijado, fijadoEnServidor)

  const [busca, setBusca] = useState("")

  const nav = useRef<HTMLElement>(null)
  const cajaBusca = useRef<HTMLInputElement>(null)

  /* Ajustes sólo para Víctor: con la sesión de administrador o con su cuenta. */
  const { admin } = useAdmin()
  const { yo } = useQuinielaSesion()
  const veAjustes = admin === true || yo?.slug === "victor-cea"

  /* En escritorio, desplegado = ratón encima o fijado. En móvil siempre. */
  const desplegado = encima || fijado

  useBodyScrollLock(open)

  /* Escape cierra el cajón del móvil. */
  useEffect(() => {
    if (!open) return

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", tecla)

    return () => window.removeEventListener("keydown", tecla)
  }, [open])

  /*
  | El rail no se despliega al primer roce.
  |
  | Cruzar la pantalla con el ratón pasa por el rail, y si se abriera al
  | instante parpadearía cada vez. Un cuarto de segundo distingue «paso por
  | aquí» de «vengo a mirar el menú». Al salir se pliega en el acto.
  */
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)

  const alEntrar = useCallback(() => {
    if (window.innerWidth < 768) return

    espera.current = setTimeout(() => setEncima(true), 220)
  }, [])

  const alSalir = useCallback(() => {
    if (espera.current) clearTimeout(espera.current)

    setEncima(false)
  }, [])

  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current)
  }, [])

  /*
  | La entrada activa, a la vista.
  |
  | Con cuarenta entradas la de la página actual suele estar por debajo del
  | borde. Al cambiar de página —y al abrir el cajón— el listado se coloca
  | para que quede centrada. Se mueve el `scrollTop` del `nav`, no
  | `scrollIntoView`, que también arrastraría la página de detrás.
  */
  useEffect(() => {
    const lista = nav.current

    if (!lista) return

    const activa = lista.querySelector<HTMLElement>('[aria-current="page"]')

    if (!activa) return

    const destino = activa.offsetTop - lista.clientHeight / 2 + activa.offsetHeight / 2

    lista.scrollTop = Math.max(0, destino)
  }, [pathname, open])

  const secciones = useMemo(() => {
    const todas = veAjustes ? [...SECCIONES, AJUSTES] : SECCIONES

    const clave = foldText(busca.trim())

    if (!clave) return todas

    return todas
      .map((seccion) => ({
        ...seccion,
        entradas: seccion.entradas.filter(
          (entrada) =>
            foldText(entrada.label).includes(clave) ||
            foldText(seccion.titulo).includes(clave),
        ),
      }))
      .filter((seccion) => seccion.entradas.length > 0)
  }, [busca, veAjustes])

  const seccionActiva = useMemo(
    () =>
      SECCIONES.concat(AJUSTES).find((seccion) =>
        seccion.entradas.some((entrada) => entrada.href === pathname),
      )?.titulo ?? "",
    [pathname],
  )

  const cierra = () => {
    setOpen(false)
    setBusca("")
  }

  /* El icono plegado se centra; desplegado va con su rótulo al lado. */
  const soloIcono = (ocultoEnEscritorio: boolean) =>
    cn("md:hidden", !ocultoEnEscritorio && "md:inline")

  return (
    <>
      {/* BOTÓN MÓVIL */}
      <button
        data-export-hide
        onClick={() => setOpen(true)}
        aria-label="Abrir el menú"
        className="fixed left-1 top-1 z-50 rounded-2xl border border-white/10 bg-[#111827]/90 p-3 text-white backdrop-blur-md shadow-lg md:hidden"
      >
        <Menu size={20} />
      </button>

      {/*
        VOLVER — MÓVIL

        Al lado de la hamburguesa y no dentro del menú: si hay que abrir el
        menú para volver, ya no es un atajo. Va más estrecho que ella a
        propósito, para que la cabecera siga cabiendo en un móvil de 360 px.
      */}
      {puedeVolver && (
        <button
          data-export-hide
          onClick={volver}
          title="Volver a la página anterior"
          aria-label="Volver a la página anterior"
          className="fixed left-[52px] top-1 z-50 rounded-2xl border border-white/10 bg-[#111827]/90 p-2.5 text-white backdrop-blur-md shadow-lg md:hidden"
        >
          <ArrowLeft size={18} />
        </button>
      )}

      {/* VELO MÓVIL */}
      {open && (
        <div
          data-export-hide
          onClick={cierra}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
        />
      )}

      {/*
        EL HUECO EN LA PÁGINA

        En escritorio este contenedor es lo único que ocupa sitio en el flujo:
        78 px plegado, 280 fijado. Es pegajoso y mide la pantalla de alto, y el
        panel de dentro va en absoluto respecto de él: puede desplegarse por
        encima del contenido sin que éste se mueva. En móvil no ocupa nada
        (el panel es `fixed`).
      */}
      <div
        data-export-hide
        /*
          El `z-40` va AQUÍ y no sólo en el panel: un elemento `sticky` crea su
          propio contexto de apilado, así que el `z` del panel no sale de él y
          el menú desplegado se quedaba por debajo de la cabecera (`z-30`) y de
          las fotos de la página. Por debajo de los modales (`z-50`) sigue.
        */
        className={cn(
          "relative w-0 shrink-0 self-start transition-[width] duration-300 ease-in-out md:sticky md:top-0 md:z-40 md:h-[100dvh]",
          fijado ? "md:w-[280px]" : "md:w-[78px]",
        )}
      >
      <aside
        onMouseEnter={alEntrar}
        onMouseLeave={alSalir}
        aria-label="Menú de la plataforma"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(300px,86vw)] flex-col border-r border-white/10 bg-[#111827] transition-[transform,width,box-shadow] duration-300 ease-in-out",
          open ? "translate-x-0 shadow-[24px_0_80px_rgba(0,0,0,.5)]" : "-translate-x-full",
          /* En escritorio: en absoluto dentro del hueco, siempre a la vista. */
          "md:absolute md:inset-y-0 md:left-0 md:z-40 md:translate-x-0 md:shadow-none",
          desplegado ? "md:w-[280px]" : "md:w-[78px]",
          /* Desplegado por el ratón (no fijado) va por encima: con sombra. */
          encima && !fijado && "md:shadow-[24px_0_80px_rgba(0,0,0,.45)]",
        )}
      >
        {/* ---------- CABECERA ---------- */}

        <div
          className={cn(
            "flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 py-3 md:py-4",
            !desplegado && "md:justify-center md:px-0",
          )}
        >
          {/* Móvil: el escudo y el nombre; escritorio: el botón de fijar. */}
          <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              <Image src="/logo.png" alt="" width={22} height={22} />
            </span>

            <span className="min-w-0">
              <span className="block truncate text-[10px] uppercase tracking-[0.28em] text-[#C8A96B]">
                Real Madrid Castilla
              </span>
              <span className="block truncate text-sm font-semibold text-white">
                Plataforma Integral
              </span>
            </span>
          </div>

          <button
            onClick={cierra}
            aria-label="Cerrar el menú"
            className="shrink-0 rounded-xl p-2 text-white/70 hover:bg-white/5 hover:text-white md:hidden"
          >
            <X size={20} />
          </button>

          {/*
            FIJAR EL MENÚ

            Fijado deja de depender del ratón —que en el iPad no existe— y
            ocupa su sitio en la página. Se recuerda en este dispositivo.
          */}
          <button
            onClick={() => guardaFijado(!fijado)}
            title={fijado ? "Soltar el menú: se pliega y se abre al pasar el ratón" : "Fijar el menú abierto"}
            aria-label={fijado ? "Soltar el menú" : "Fijar el menú abierto"}
            aria-pressed={fijado}
            className={cn(
              "hidden items-center gap-3 rounded-2xl px-3 py-2 text-gray-300 transition hover:bg-white/5 hover:text-white md:flex",
              desplegado ? "w-full" : "justify-center",
            )}
          >
            {fijado ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}

            {desplegado && (
              <span className="truncate text-[12px] uppercase tracking-[0.2em] text-gray-500">
                {fijado ? "Soltar menú" : "Fijar menú"}
              </span>
            )}
          </button>
        </div>

        {/* ---------- VOLVER (escritorio) y BUSCAR ---------- */}

        <div className={cn("shrink-0 space-y-2 px-3 pt-3", !desplegado && "md:px-2")}>
          {puedeVolver && (
            <button
              onClick={volver}
              title="Volver a la página anterior"
              aria-label="Volver a la página anterior"
              className={cn(
                "hidden w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white md:flex",
                !desplegado && "md:justify-center md:px-0",
              )}
            >
              <ArrowLeft size={18} className="shrink-0" />
              {desplegado && <span>Volver</span>}
            </button>
          )}

          {/* Plegado, la lupa despliega y enfoca; desplegado, es la caja. */}
          {desplegado || open ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />

              <input
                ref={cajaBusca}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setBusca("")}
                placeholder="Buscar en el menú…"
                aria-label="Buscar en el menú"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-9 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#D8B45A]/50 focus:bg-white/[0.06]"
              />

              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  aria-label="Limpiar la búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                guardaFijado(true)
                setTimeout(() => cajaBusca.current?.focus(), 50)
              }}
              title="Buscar en el menú"
              aria-label="Buscar en el menú"
              className="hidden w-full items-center justify-center rounded-2xl px-0 py-2.5 text-gray-300 transition hover:bg-white/5 hover:text-white md:flex"
            >
              <Search size={18} />
            </button>
          )}
        </div>

        {/* ---------- LAS ENTRADAS ---------- */}

        {/*
          Más alto que la pantalla: scrollea aquí dentro, no en la página. Así
          el listado entero se alcanza siempre, aunque el contenedor de la
          página cree su propio contexto de scroll.
        */}
        <nav
          ref={nav}
          className={cn(
            "min-h-0 flex-1 space-y-7 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-8 pt-4",
            !desplegado && "md:px-2",
          )}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {secciones.length === 0 && (
            <p className="px-2 py-6 text-center text-[12px] text-white/35">
              Nada en el menú se llama «{busca}».
            </p>
          )}

          {secciones.map((seccion) => {
            const activa = seccion.titulo === seccionActiva

            return (
              <div key={seccion.titulo}>
                {/*
                  Plegado no cabe el rótulo: va una rayita, y la de la sección
                  en la que se está, dorada. Desplegado, el rótulo entero.
                */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "mx-auto mb-3 hidden h-px w-7",
                    activa ? "bg-[#D8B45A]/70" : "bg-white/10",
                    !desplegado && "md:block",
                  )}
                />

                <p
                  className={cn(
                    "mb-2 flex items-center gap-2 px-2 text-[11px] uppercase tracking-[0.25em]",
                    activa ? "text-[#D8B45A]" : "text-gray-500",
                    !desplegado && "md:hidden",
                  )}
                >
                  {seccion.titulo}
                </p>

                <div className="space-y-1 text-sm">
                  {seccion.entradas.map((entrada) => {
                    const Icono = entrada.icon

                    const esActiva = pathname === entrada.href

                    if (entrada.obras) {
                      return (
                        <div
                          key={entrada.href}
                          aria-disabled="true"
                          title={`${entrada.label} — ${entrada.obras}`}
                          className={cn(
                            "flex cursor-not-allowed select-none items-center gap-3 rounded-2xl px-4 py-2.5 text-gray-500 opacity-60",
                            !desplegado && "md:justify-center md:px-0",
                          )}
                        >
                          <Icono size={18} className="shrink-0" />

                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate line-through decoration-gray-600",
                              soloIcono(!desplegado),
                            )}
                          >
                            {entrada.label}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <Link
                        key={entrada.href}
                        href={entrada.href}
                        title={entrada.label}
                        aria-current={esActiva ? "page" : undefined}
                        onClick={() => {
                          trackModuleVisit(entrada.href)
                          cierra()
                        }}
                        className={cn(
                          "relative flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-all duration-200",
                          esActiva
                            ? "border border-white/10 bg-white/5 text-white"
                            : "text-gray-300 hover:bg-white/5 hover:text-white",
                          !desplegado && "md:justify-center md:px-0",
                        )}
                      >
                        {/* La barra dorada: se ve también plegado. */}
                        {esActiva && (
                          <span
                            aria-hidden
                            className="absolute inset-y-2 left-0 w-[3px] rounded-full"
                            style={{ background: "#D8B45A" }}
                          />
                        )}

                        <Icono
                          size={18}
                          className={cn("shrink-0", esActiva && "text-[#F7D98B]")}
                        />

                        <span className={cn("min-w-0 flex-1 truncate", soloIcono(!desplegado))}>
                          {entrada.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </aside>
      </div>
    </>
  )
}
