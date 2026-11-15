"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { AJUSTES, SECCIONES } from "@/components/ui/sidebar"

/*
| El nombre de la pantalla en la pestaña (15/11/2026).
|
| Hasta ahora todas las pestañas, el historial, los marcadores y el selector
| de apps del móvil decían «Real Madrid CF Castilla»: con cinco pestañas
| abiertas no se sabía cuál era cuál. Las pantallas son de cliente y no
| pueden exportar `metadata`, así que el nombre sale del menú (la misma
| etiqueta que se ve a la izquierda). Si una ruta ya trae su propio título
| (`/general`, `/performance`), se respeta.
*/
const POR_DEFECTO = "Real Madrid CF Castilla"
/** Lo último que puso este componente: al cambiar de pantalla se sustituye. */
let puestoAntes = ""
const ENTRADAS = [...SECCIONES, AJUSTES].flatMap((s) => s.entradas).filter((e) => e.href !== "/")

function nombreDe(ruta: string): string | null {
  let mejor: { href: string; label: string } | null = null
  for (const e of ENTRADAS) {
    if (ruta === e.href || ruta.startsWith(e.href + "/")) {
      if (!mejor || e.href.length > mejor.href.length) mejor = e
    }
  }
  return mejor?.label ?? null
}

export function TituloPestana() {
  const ruta = usePathname()

  useEffect(() => {
    const nombre = nombreDe(ruta || "/")
    const puesto = nombre ? `${nombre} · RMCF Castilla` : POR_DEFECTO
    const pon = () => {
      const t = document.title
      if (t === POR_DEFECTO || t === "" || t === puestoAntes) {
        document.title = puesto
        puestoAntes = puesto
      }
    }
    pon()
    /* Next vuelve a escribir el título de la ruta justo después de navegar. */
    const t = window.setTimeout(pon, 300)
    return () => window.clearTimeout(t)
  }, [ruta])

  return null
}
