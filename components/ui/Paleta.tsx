"use client"

import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { CornerDownLeft, History, Search, X } from "lucide-react"

import { AJUSTES, entradasDelMenu, SECCIONES, type Entrada } from "@/components/ui/sidebar"
import { useBodyScrollLock } from "@/components/season/useBodyScrollLock"
import { useAdmin } from "@/hooks/useAdmin"
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion"
import { trackModuleVisit, useRutasMasVisitadas } from "@/lib/module-usage"
import { foldText } from "@/lib/modules"
import { cn } from "@/lib/utils"

/*
|--------------------------------------------------------------------------
| LA PALETA: Ctrl+K / Cmd+K
|--------------------------------------------------------------------------
|
| Cuarenta y tantas pantallas y un menú que hay que desplazar. Quien conoce
| la plataforma no quiere buscar la entrada con el ratón: teclea tres letras
| y entra. Es la misma lista que el menú lateral (`SECCIONES`, agrupada por
| sección) y los mismos permisos: «En obras» y Ajustes salen para quien los ve
| en el menú.
|
| - Se abre con Ctrl+K (Cmd+K en el Mac) desde cualquier pantalla, y con el
|   botón «Buscar» de la cabecera. Se monta UNA vez, en el `layout`, no en
|   cada página: el atajo tiene que estar siempre, no sólo donde se acordó
|   ponerlo.
| - Sin escribir nada enseña primero lo reciente —lo que más se abre en este
|   dispositivo— y debajo el menú entero.
| - La búsqueda no distingue acentos ni mayúsculas y perdona letras: «pzrra»
|   encuentra «Pizarra». Antes van las que empiezan por lo escrito, luego
|   las que lo contienen, y al final las que sólo lo llevan salteado.
| - Flechas para moverse, Intro para entrar, Escape para cerrar.
|
| Navega con el `router` y no con un `<Link>`: la fila activa se elige con el
| teclado y hay que poder entrar sin haberla tocado nunca.
*/

/** Para abrirla desde fuera (el botón de la cabecera) sin pasar props. */
const EVENTO_ABRIR = "rmcf-abre-paleta"

export function abrePaleta() {
  window.dispatchEvent(new Event(EVENTO_ABRIR))
}

type Fila = { seccion: string; entrada: Entrada }

/*
| Cuánto se parece lo escrito a una entrada. Cero = nada.
|
| Se compara contra el nombre y, más flojo, contra el rótulo de la sección,
| para que «rival» saque las cinco pantallas de rival.
*/
function puntua(clave: string, fila: Fila): number {
  const nombre = foldText(fila.entrada.label)
  const seccion = foldText(fila.seccion)

  if (nombre.startsWith(clave)) return 100
  if (nombre.split(" ").some((palabra) => palabra.startsWith(clave))) return 90
  if (nombre.includes(clave)) return 80
  if (seccion.includes(clave)) return 40

  /* Letras salteadas, en orden: la prisa se come vocales. */
  let i = 0
  for (const letra of nombre) {
    if (letra === clave[i]) i++
    if (i === clave.length) return 20
  }

  return 0
}

export function Paleta() {
  const router = useRouter()
  const pathname = usePathname()

  const [abierta, setAbierta] = useState(false)
  const [clave, setClave] = useState("")
  const [activa, setActiva] = useState(0)

  const caja = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLDivElement>(null)

  /* Mismos permisos que el menú. Los dos hooks guardan su respuesta en el
     módulo, así que esto no añade ninguna petición. */
  const { admin } = useAdmin()
  const { yo } = useQuinielaSesion()
  const veAjustes = admin === true || yo?.slug === "victor-cea"

  useBodyScrollLock(abierta)

  const cierra = useCallback(() => {
    setAbierta(false)
    setClave("")
    setActiva(0)
  }, [])

  /* El atajo y el aviso del botón de la cabecera. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setAbierta((estaba) => !estaba)
      }
    }

    const abre = () => setAbierta(true)

    window.addEventListener("keydown", tecla)
    window.addEventListener(EVENTO_ABRIR, abre)

    return () => {
      window.removeEventListener("keydown", tecla)
      window.removeEventListener(EVENTO_ABRIR, abre)
    }
  }, [])

  /* Al abrir, el cursor en la caja: se abre para teclear. */
  useEffect(() => {
    if (!abierta) return

    const t = setTimeout(() => caja.current?.focus(), 30)

    return () => clearTimeout(t)
  }, [abierta])

  /* Si la página cambia por otro camino con la paleta abierta (atrás del
     navegador), se cierra. Estado derivado durante el render, sin efecto. */
  const [rutaVista, setRutaVista] = useState(pathname)

  if (rutaVista !== pathname) {
    setRutaVista(pathname)

    if (abierta) {
      setAbierta(false)
      setClave("")
      setActiva(0)
    }
  }

  const todas = useMemo<Fila[]>(
    () =>
      entradasDelMenu({ admin: admin === true, ajustes: veAjustes }).flatMap((seccion) =>
        seccion.entradas
          .filter((entrada) => !entrada.obras)
          .map((entrada) => ({ seccion: seccion.titulo, entrada })),
      ),
    [admin, veAjustes],
  )

  const masVisitadas = useRutasMasVisitadas(12, [pathname, "/"])

  const recientes = useMemo<Fila[]>(() => {
    const porHref = new Map<string, Fila>(
      SECCIONES.concat(AJUSTES).flatMap((seccion) =>
        seccion.entradas
          .filter((entrada) => !entrada.obras && !entrada.soloAdmin)
          .map((entrada): [string, Fila] => [entrada.href, { seccion: "Recientes", entrada }]),
      ),
    )

    const elegidas: Fila[] = []

    for (const href of masVisitadas) {
      const fila = porHref.get(href)

      if (!fila) continue
      if (fila.entrada.href === "/ajustes" && !veAjustes) continue

      elegidas.push(fila)
      if (elegidas.length === 5) break
    }

    return elegidas
  }, [masVisitadas, veAjustes])

  /* Las filas que se ven, ya en orden: es sobre esta lista sobre la que se
     mueve la flecha, por eso es plana y los grupos se pintan después. */
  const filas = useMemo<Fila[]>(() => {
    const buscado = foldText(clave)

    if (!buscado) return [...recientes, ...todas]

    return todas
      .map((fila, orden) => ({ fila, puntos: puntua(buscado, fila), orden }))
      .filter((x) => x.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden)
      .map((x) => x.fila)
  }, [clave, recientes, todas])

  /* La fila activa, a la vista cuando se baja con la flecha. */
  useEffect(() => {
    if (!abierta) return

    lista.current
      ?.querySelector<HTMLElement>(`[data-fila="${activa}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activa, abierta])

  const entra = useCallback(
    (fila: Fila) => {
      trackModuleVisit(fila.entrada.href)
      cierra()
      router.push(fila.entrada.href)
    },
    [cierra, router],
  )

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiva((n) => (filas.length ? (n + 1) % filas.length : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiva((n) => (filas.length ? (n - 1 + filas.length) % filas.length : 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const fila = filas[activa]
      if (fila) entra(fila)
    } else if (e.key === "Escape") {
      e.preventDefault()
      cierra()
    }
  }

  if (!abierta) return null

  return (
    <div
      data-export-hide
      onClick={cierra}
      className="modal-veil fixed inset-0 z-50 flex items-start justify-center p-3 pt-[10vh] backdrop-blur-sm sm:p-6 sm:pt-[12vh]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ir a una pantalla"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(70vh,560px)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#111827] shadow-[0_30px_90px_rgba(0,0,0,.55)]"
      >
        {/* ---------- LA CAJA ---------- */}

        <div className="relative shrink-0 border-b border-white/[0.08]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />

          <input
            ref={caja}
            value={clave}
            onChange={(e) => {
              /* Al cambiar el resultado, la primera fila es la activa. */
              setClave(e.target.value)
              setActiva(0)
            }}
            onKeyDown={alTeclear}
            placeholder="Ir a… (escribe el nombre de una pantalla)"
            aria-label="Buscar una pantalla"
            aria-controls="paleta-filas"
            aria-activedescendant={filas[activa] ? `paleta-fila-${activa}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent py-4 pl-11 pr-12 text-base text-white outline-none placeholder:text-white/30"
          />

          <button
            type="button"
            onClick={cierra}
            aria-label="Cerrar"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ---------- LAS FILAS ---------- */}

        <div
          ref={lista}
          id="paleta-filas"
          role="listbox"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {filas.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-white/35">
              Ninguna pantalla se llama «{clave}».
            </p>
          )}

          {filas.map((fila, i) => {
            const Icono = fila.entrada.icon
            const esActiva = i === activa

            /* Un rótulo cada vez que cambia la sección respecto de la fila anterior. */
            const nuevoGrupo = i === 0 || filas[i - 1].seccion !== fila.seccion

            return (
              <div key={`${fila.seccion}-${fila.entrada.href}`}>
                {nuevoGrupo && (
                  <p
                    className={cn(
                      "flex items-center gap-1.5 px-3 pb-1.5 text-[10px] uppercase tracking-[0.25em] text-gray-500",
                      i > 0 && "pt-4",
                    )}
                  >
                    {fila.seccion === "Recientes" && <History size={11} className="text-[#C8A96B]" />}
                    {fila.seccion}
                  </p>
                )}

                <button
                  type="button"
                  role="option"
                  id={`paleta-fila-${i}`}
                  data-fila={i}
                  aria-selected={esActiva}
                  onMouseMove={() => setActiva(i)}
                  onClick={() => entra(fila)}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm transition-colors",
                    esActiva ? "border border-white/10 bg-white/5 text-white" : "border border-transparent text-gray-300",
                  )}
                >
                  {esActiva && (
                    <span
                      aria-hidden
                      className="absolute inset-y-2 left-0 w-[3px] rounded-full"
                      style={{ background: "#D8B45A" }}
                    />
                  )}

                  <Icono size={18} className={cn("shrink-0", esActiva && "text-[#F7D98B]")} />

                  <span className="min-w-0 flex-1 truncate">{fila.entrada.label}</span>

                  {esActiva && (
                    <CornerDownLeft size={14} className="hidden shrink-0 text-white/30 sm:block" />
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* ---------- LAS TECLAS (no en el móvil: no hay teclado) ---------- */}

        <div className="hidden shrink-0 items-center gap-4 border-t border-white/[0.08] px-4 py-2.5 text-[11px] text-white/35 sm:flex">
          <span>
            <Tecla>↑</Tecla> <Tecla>↓</Tecla> moverse
          </span>
          <span>
            <Tecla>↵</Tecla> entrar
          </span>
          <span>
            <Tecla>Esc</Tecla> cerrar
          </span>
        </div>
      </div>
    </div>
  )
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-sans text-[10px] text-white/55">
      {children}
    </kbd>
  )
}

/*
| EL BOTÓN DE LA CABECERA
|
| Para quien no sabe que existe el atajo: un botón discreto a la derecha, con
| la tecla escrita al lado para que la próxima vez no haga falta el ratón. No
| sale en el móvil: ahí no hay Ctrl y el menú ya tiene su buscador.
*/
/* En el servidor —y en el primer pintado, para que coincidan— es Ctrl. */
const sinCambios = () => () => {}
const esMac = () => /Mac|iPhone|iPad/.test(navigator.platform)
const noEsMac = () => false

export function BotonPaleta() {
  const mac = useSyncExternalStore(sinCambios, esMac, noEsMac)

  return (
    <button
      type="button"
      onClick={abrePaleta}
      title="Ir a una pantalla (Ctrl+K)"
      aria-label="Buscar una pantalla"
      className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/45 transition hover:border-white/20 hover:text-white md:flex md:py-3"
    >
      <Search size={15} className="shrink-0" />
      <span>Buscar</span>
      <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 font-sans text-[10px] text-white/45">
        {mac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  )
}
