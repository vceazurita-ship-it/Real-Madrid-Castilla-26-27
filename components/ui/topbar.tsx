import Image from "next/image";

/**
 * La cabecera: el escudo, el nombre de la plataforma y la temporada.
 *
 * Va en todas las pantallas y no hace nada más. Aquí vivía además un asistente
 * de IA —panel lateral, preguntas al modelo, resumen de la página— cuyo botón
 * estaba comentado desde hacía tiempo: ciento veinte líneas que no se podían
 * abrir. Se quitó entero, con su contexto y su ruta de servidor. Está en el
 * historial de git si alguna vez se quiere recuperar.
 */
export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0F14]/85 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-4 md:px-10 md:py-5">
        {/*
          En móvil la esquina de arriba a la izquierda la ocupan dos botones
          fijos del menú —la hamburguesa y el «volver»—, así que la cabecera
          arranca después de los dos. En escritorio no hay nada que esquivar.
        */}
        <div className="ml-24 flex min-w-0 items-center gap-3 md:ml-0 md:gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_0_30px_rgba(200,169,107,0.08)] md:h-14 md:w-14">
            <Image
              src="/logo.png"
              alt="Real Madrid Castilla"
              width={34}
              height={34}
              priority
            />
          </div>

          {/*
            En un teléfono esto se partía en cuatro renglones: «REAL MADRID /
            CASTILLA», «Plataforma / Integral» y hasta el «2026 — / 2027» de la
            derecha, y la cabecera se comía un cuarto de la pantalla. El sitio
            que queda es el que queda —a la izquierda hay dos botones fijos del
            menú— así que lo que sobra se recorta en vez de bajar de línea.
          */}
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.28em] text-[#C8A96B] md:text-[11px] md:tracking-[0.35em]">
              Real Madrid Castilla
            </p>

            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-white sm:text-xl md:text-2xl">
              Plataforma Integral
            </h2>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/*
            La temporada no cabe en un teléfono y tampoco hace falta: no cambia
            en todo el año y está escrita en la portada. Desde una tableta para
            arriba vuelve.
          */}
          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 sm:block md:px-4 md:py-3">
            <p className="text-[9px] uppercase tracking-[0.22em] text-gray-500 md:text-[10px]">
              Season
            </p>

            <p className="mt-1 whitespace-nowrap text-sm font-medium text-white">
              2026 — 2027
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
