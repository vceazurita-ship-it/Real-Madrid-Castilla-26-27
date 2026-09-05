"use client";

/*
|--------------------------------------------------------------------------
| AVISO DE SIN CONEXIÓN
|--------------------------------------------------------------------------
|
| Desde que `public/sw.js` guarda las pantallas y los datos, la app abre sin
| cobertura. Eso está bien y es peligroso a la vez: **lo malo no es estar sin
| red, es no saberlo**. Abrir el once probable del rival en el vestuario y
| estar viendo el de la semana pasada creyendo que es el de hoy es peor que no
| poder abrirlo.
|
| Así que en cuanto se cae la conexión aparece esta franja, y no dice sólo
| «sin conexión»: dice **de cuándo son los datos que se están viendo**. La
| fecha la deja el propio trabajador en la caché cada vez que guarda una
| respuesta buena (`SELLO`).
|
| Va abajo y no arriba porque la esquina de arriba a la izquierda ya la ocupan
| en móvil la hamburguesa y el botón de volver. Y lleva `data-export-hide`
| para no colarse en los PNG y los PDF que exporta la app.
*/

import { useEffect, useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

/** La entrada inventada donde el trabajador anota la hora del último dato. */
const SELLO = "/__castilla/ultimo-dato";

function suscribe(avisa: () => void) {
  window.addEventListener("online", avisa);
  window.addEventListener("offline", avisa);

  return () => {
    window.removeEventListener("online", avisa);
    window.removeEventListener("offline", avisa);
  };
}

const hayRed = () => navigator.onLine;

/* En el servidor se da por buena la conexión: el aviso es cosa del navegador. */
const hayRedEnElServidor = () => true;

/** "sábado a las 12:40"; y si es de otro día, con la fecha delante. */
function comoSeLee(iso: string) {
  const cuando = new Date(iso);

  if (Number.isNaN(cuando.getTime())) return null;

  const hoy = new Date();

  const mismoDia =
    cuando.getDate() === hoy.getDate() &&
    cuando.getMonth() === hoy.getMonth() &&
    cuando.getFullYear() === hoy.getFullYear();

  const hora = cuando.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (mismoDia) return `hoy a las ${hora}`;

  const dia = cuando.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return `${dia} a las ${hora}`;
}

export function SinConexion() {
  const conectado = useSyncExternalStore(suscribe, hayRed, hayRedEnElServidor);

  const [guardadoEl, setGuardadoEl] = useState<string | null>(null);

  /*
  | La fecha se lee de la caché al perder la conexión, no antes: mientras haya
  | red no se enseña nada y no hace falta molestar al disco.
  */
  useEffect(() => {
    if (conectado) return;

    let cancelado = false;

    void (async () => {
      try {
        const respuesta = await caches.match(SELLO);

        if (!respuesta) return;

        const iso = await respuesta.text();

        if (!cancelado) setGuardadoEl(comoSeLee(iso));
      } catch {
        /* Navegador sin Cache API o en ventana privada: el aviso sale igual,
           sólo que sin poder decir de cuándo son los datos. */
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [conectado]);

  if (conectado) return null;

  return (
    <div
      data-export-hide
      role="status"
      aria-live="polite"
      className="
        fixed bottom-3 left-1/2 z-[60] -translate-x-1/2
        flex max-w-[calc(100vw-24px)] items-center gap-3
        rounded-2xl border border-amber-400/30 bg-[#2A1F06]/95 px-4 py-2.5
        text-white shadow-lg backdrop-blur-md
      "
    >
      <WifiOff size={18} className="shrink-0 text-amber-400" />

      <p className="text-sm leading-tight">
        <span className="font-medium">Sin conexión.</span>{" "}
        <span className="text-white/70">
          {guardadoEl
            ? `Estás viendo los datos guardados ${guardadoEl}.`
            : "Estás viendo lo último que se descargó."}
        </span>
      </p>
    </div>
  );
}
