"use client";

/**
 * LOS ACCESOS DE UN RIVAL, CON EL RIVAL YA PUESTO (16/11/2026, jueces).
 *
 * Microciclos, el creador, los dos calendarios y el desplazamiento nombraban
 * al rival sin llevar a ningún sitio. Este componente pone, a un toque, lo
 * que completa a ese partido con las mismas llaves que la portada
 * (components/portada/ProximoPartido.tsx):
 * - `?rival=<ID de la hoja RIVALES>` para el Plan de partido (la fila se busca
 *   por la fecha antes que por el nombre: contra un equipo se juega dos veces);
 * - `?equipo=<NOMBRE>` para el ABP del rival y su plantilla;
 * - sus goles en vídeo: abren el pop-up de la portada (`golesEnVideo`,
 *   components/rivals/BotonGolesEnVideo.tsx, 18/11/2026); `href` sigue
 *   llevando a Análisis de goles para quien pinte el enlace a mano.
 * Sin la hoja todavía, los enlaces van pelados y la pantalla de destino abre
 * en su próximo partido, como siempre.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clapperboard, Flag, Goal, ShieldHalf } from "lucide-react";

import { aJornada, buscaJornada, mismoEquipo, type FilaRival, type JornadaRival } from "@/lib/abp/jornada";
import { BotonGolesEnVideo, EnlaceComoSonSusGoles, type GolesEnVideo } from "@/components/rivals/BotonGolesEnVideo";
import { traeJson } from "@/lib/hojaCsv";
import { urlGolesDelEquipo } from "@/lib/rivals/goles-en-video";

/* Una sola lectura por pantalla, la compartan los que la compartan. */
let enVuelo: Promise<JornadaRival[]> | null = null;

function cargaJornadas() {
  enVuelo ??= traeJson<unknown>("/api/rivals?action=rivales")
    .then((data) => (Array.isArray(data) ? (data as FilaRival[]).filter((f) => f && typeof f === "object").map(aJornada) : []))
    .catch(() => {
      enVuelo = null;

      return [];
    });

  return enVuelo;
}

export function useJornadasRivales() {
  const [jornadas, setJornadas] = useState<JornadaRival[]>([]);

  useEffect(() => {
    let vivo = true;

    void cargaJornadas().then((j) => {
      if (vivo) setJornadas(j);
    });

    return () => {
      vivo = false;
    };
  }, []);

  return jornadas;
}

export type EnlaceRival = {
  href: string;
  texto: string;
  title: string;
  Icono: typeof Flag;
  equipo: string;
  /** Si lo trae, el enlace se pinta como botón que abre el pop-up de los goles (`BotonGolesEnVideo`); `href` es la ida a Análisis de goles. */
  golesEnVideo?: GolesEnVideo;
};

/** Los enlaces de un rival; `fecha` en AAAA-MM-DD para dar con su fila. */
export function enlacesDelRival(jornadas: JornadaRival[], rival: string, fecha?: string): EnlaceRival[] {
  const nombre = rival.trim();

  if (!nombre) return [];

  const fila = buscaJornada(jornadas, { rival: nombre, fecha: fecha?.slice(0, 10) });
  /* Si la fila es de otro equipo (la fecha casó con otro partido), no se usa. */
  /*
  | Con fecha y sin fila de ese día (aplazado, 17/11/2026): la fila de ese
  | rival más cercana a esa fecha, no la primera (que podía ser la otra vuelta).
  */
  const cercana = () => {
    const dia = Date.parse(`${fecha!.slice(0, 10)}T12:00:00`);
    const suyas = jornadas.filter((j) => j.fecha && mismoEquipo(j.equipo, nombre));
    return suyas.sort((x, y) => Math.abs(Date.parse(`${x.fecha}T12:00:00`) - dia) - Math.abs(Date.parse(`${y.fecha}T12:00:00`) - dia))[0] ?? null;
  };
  const suya = fila && (!fecha || fila.fecha === fecha.slice(0, 10)) ? fila : fecha ? cercana() : buscaJornada(jornadas, { rival: nombre });
  const equipo = suya?.equipo || nombre;
  const conEquipo = (ruta: string) => `${ruta}?equipo=${encodeURIComponent(equipo)}`;
  const plan = suya?.id ? `/match-preparation?rival=${encodeURIComponent(suya.id)}` : "/match-preparation";

  return [
    { href: plan, texto: "Plan de partido", title: `El plan contra ${equipo}`, Icono: Flag, equipo },
    { href: conEquipo("/scout-rival-abp"), texto: "Su ABP", title: `El balón parado de ${equipo}`, Icono: Goal, equipo },
    { href: urlGolesDelEquipo(equipo), texto: "Sus goles en vídeo", title: `Los goles de ${equipo}, de seguido o uno a uno`, Icono: Clapperboard, equipo, golesEnVideo: { equipo, lado: "favor" } },
    { href: conEquipo("/rivals"), texto: "Su plantilla", title: `La plantilla de ${equipo}`, Icono: ShieldHalf, equipo },
  ];
}

const CLASE_ENLACE =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/[0.06] px-2.5 py-1 text-[12px] font-semibold text-sky-200 transition hover:bg-sky-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300";

/** Fila de accesos; `solo` limita a los que se nombran (por su texto). */
export function EnlacesDelRival({
  rival,
  fecha,
  solo,
  className = "",
  conNombre = false,
}: {
  rival: string;
  fecha?: string;
  solo?: string[];
  className?: string;
  /** «Su ABP · Rayo Majadahonda» (17/11/2026, jueces): el rival en el rótulo. */
  conNombre?: boolean;
}) {
  const jornadas = useJornadasRivales();
  const enlaces = enlacesDelRival(jornadas, rival, fecha).filter((e) => !solo || solo.includes(e.texto));

  if (!enlaces.length) return null;

  return (
    <nav aria-label={`Accesos de ${rival}`} className={`flex min-w-0 flex-wrap gap-1.5 ${className}`}>
      {enlaces.map(({ href, texto, title, Icono, equipo, golesEnVideo }) => {
        const contenido = (
          <>
            <Icono size={13} className="shrink-0" aria-hidden />
            {conNombre && texto.startsWith("Su") ? `${texto} · ${equipo}` : texto}
          </>
        );

        return golesEnVideo ? (
          <BotonGolesEnVideo key={texto} {...golesEnVideo} title={title} className={CLASE_ENLACE}>
            {contenido}
          </BotonGolesEnVideo>
        ) : (
          <Link key={texto} href={href} title={title} className={CLASE_ENLACE}>
            {contenido}
          </Link>
        );
      })}
      {/* 18/11/2026: aparte y secundaria, la ida a Análisis de goles (los vídeos, en el pop-up). */}
      {enlaces.some((e) => e.golesEnVideo) && <EnlaceComoSonSusGoles equipo={enlaces[0].equipo} />}
    </nav>
  );
}
