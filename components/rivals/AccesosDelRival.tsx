"use client";

/*
|--------------------------------------------------------------------------
| ACCESOS DEL RIVAL: LA MISMA TIRA BAJO EL TÍTULO DE CADA PANTALLA (16/11/2026)
|--------------------------------------------------------------------------
|
| Ronda 18 (jueces de fútbol, análisis y marketing): «los enlaces entre
| pantallas del rival no están en un sitio fijo; Sus goles en vídeo, ABP, Plan
| y Duelos aparecen según la pantalla y casi nunca en la cabecera». Aquí está
| ese sitio fijo, igual en las ocho pantallas del rival y del partido:
|
|   ▶ Sus goles en vídeo · ▶ Cómo le marcan · ▶ Su último partido
|   Plan de partido J13 · Plantilla · Colectivo · Individual · ABP · Área ·
|   Duelos · Pizarra táctica · Pizarra ABP
|
| Cada enlace lleva el rival puesto con las dos llaves (`?equipo=` y
| `?rival=`, ver `lib/rivals/rival-en-curso.ts`): la pantalla sabe una y la
| otra se busca en la hoja RIVALES (la caché de `/api/rivals`, la que ya baja
| cualquier pantalla del área). La de la pantalla en la que se está no sale.
| Los vídeos se abren en un modal sin salir de la pantalla.
|
| Además deja apuntado el rival para la tira de pestañas de la sección.
*/

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { VideosDelRival } from "@/components/portada/VideosDelRival";
import type { Tipo } from "@/components/rivals/GolesDelRivalEnVideo";
import { aJornada, mismoEquipo, type FilaRival, type JornadaRival } from "@/lib/abp/jornada";
import { traeJson } from "@/lib/hojaCsv";
import { trackModuleVisit } from "@/lib/module-usage";
import { conRivalEnUrl, fijaRivalEnCurso } from "@/lib/rivals/rival-en-curso";

type Destino = { ruta: string; texto: string; title: (equipo: string) => string };

const DESTINOS: Destino[] = [
  { ruta: "/match-preparation", texto: "Plan de partido", title: (e) => `El plan contra ${e}` },
  { ruta: "/rivals", texto: "Plantilla", title: (e) => `La plantilla de ${e}, con el once probable` },
  { ruta: "/scout-rival-collective", texto: "Colectivo", title: (e) => `Cómo juega ${e}, fase a fase` },
  { ruta: "/scout-rival-individual", texto: "Individual", title: (e) => `Los vídeos de los jugadores de ${e}` },
  { ruta: "/scout-rival-abp", texto: "ABP", title: (e) => `El balón parado de ${e}, a favor y en contra` },
  { ruta: "/scout-rival-area", texto: "Área", title: (e) => `Cómo centra ${e} y cómo defiende los centros` },
  { ruta: "/duelos", texto: "Duelos", title: (e) => `Nuestro once contra el de ${e}, puesto a puesto` },
  { ruta: "/pizarra-tactica", texto: "Pizarra táctica", title: () => "Los onces de la semana en la pizarra" },
  { ruta: "/abp-pizarra", texto: "Pizarra ABP", title: (e) => `Las diapositivas de balón parado contra ${e}` },
];

const CHIP =
  "inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-[13px] font-medium text-white/75 transition hover:border-[#C8A96B] hover:text-white sm:min-h-0";

/** La fila de la hoja que le toca a este equipo: el próximo partido contra él y, si ya se jugaron los dos, el último. */
function filaDelEquipo(jornadas: JornadaRival[], equipo: string, hoy: string) {
  const suyas = jornadas.filter((j) => mismoEquipo(j.equipo, equipo));
  const porVenir = suyas.filter((j) => !j.fecha || j.fecha >= hoy).sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));

  return porVenir[0] ?? [...suyas].sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;
}

export function AccesosDelRival({
  equipo = "",
  rivalId = "",
  aqui,
  tipoVideo = "todos",
  className = "",
}: {
  /** El nombre del equipo, si la pantalla lo sabe. */
  equipo?: string;
  /** El `ID` de la fila RIVALES, si la pantalla lo sabe. */
  rivalId?: string;
  /** La ruta de la pantalla en la que se está: su enlace no sale. */
  aqui: string;
  /** «abp» en ABP del rival: los goles en vídeo, a balón parado. */
  tipoVideo?: Tipo;
  className?: string;
}) {
  const [jornadas, setJornadas] = useState<JornadaRival[]>([]);
  const [hoy, setHoy] = useState("");

  useEffect(() => {
    let vivo = true;

    traeJson<unknown>("/api/rivals?action=rivales")
      .then((data) => {
        if (!vivo || !Array.isArray(data)) return;

        setHoy(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date()));
        setJornadas((data as FilaRival[]).filter((fila) => fila && typeof fila === "object").map(aJornada));
      })
      .catch(() => {
        /* Sin la hoja, los enlaces llevan la llave que se sepa. */
      });

    return () => {
      vivo = false;
    };
  }, []);

  /* Las dos llaves: la que trae la pantalla y la que se busca en la hoja. */
  const fila = useMemo(() => {
    if (rivalId) {
      const atada = jornadas.find((j) => j.id === rivalId);

      if (atada) return atada;
    }

    return equipo && hoy ? filaDelEquipo(jornadas, equipo, hoy) : null;
  }, [jornadas, rivalId, equipo, hoy]);

  const nombre = equipo || fila?.equipo || "";
  const id = rivalId || fila?.id || "";
  const jornada = fila?.jornada ? `J${fila.jornada}` : "";

  useEffect(() => {
    if (nombre || id) fijaRivalEnCurso({ equipo: nombre, id });
  }, [nombre, id]);

  if (!nombre && !id) return null;

  const llaves = { equipo: nombre, id };

  return (
    <nav
      aria-label={nombre ? `Más de ${nombre}` : "Más de este rival"}
      data-export-hide
      className={`relative min-w-0 ${className}`}
    >
      {/*
        En varias filas también en el móvil (17/11/2026, jueces de marketing): la
        fila que se deslizaba cortaba «Sus goles en vídeo / Cómo le marcan / Plan»
        a la derecha y el resto no se veía.
      */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 pb-1">
        {nombre && <VideosDelRival key={`${nombre}-${tipoVideo}`} rival={nombre} etiqueta={`${nombre} · vídeo`} tipo={tipoVideo} />}
        {DESTINOS.filter((d) => d.ruta !== aqui).map((d) => {
          const href = d.ruta === "/pizarra-tactica" ? "/pizarra-tactica?once=1" : conRivalEnUrl(d.ruta, llaves);
          const esPlan = d.ruta === "/match-preparation";

          return (
            <Link
              key={d.ruta}
              href={href}
              title={d.title(nombre || "este rival")}
              onClick={() => trackModuleVisit(d.ruta)}
              className={
                esPlan
                  ? "inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full bg-[#C8A96B] px-3 py-1 text-[13px] font-semibold text-black transition hover:brightness-110 sm:min-h-0"
                  : CHIP
              }
            >
              {esPlan && jornada ? `${d.texto} ${jornada}` : d.texto}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default AccesosDelRival;
