"use client";

import Link from "next/link";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import Papa from "papaparse";
import { useData, type FilaDatos } from "@/app/contexts/data-context";
import { useMemo, useState, useSyncExternalStore } from "react";

type InfoArchivo = {
  fileName: string;
  records: number;
  updatedAt: string;
};

const TIPOS_CON_INFO = ["players", "team", "scout"] as const;

type TipoConCarga = (typeof TIPOS_CON_INFO)[number];

/*
| La ficha del último archivo de cada bloque vive en `localStorage`; se lee con
| `useSyncExternalStore` (en el servidor no hay nada) en vez de con un efecto
| que hace `setState`. Se lee junta, como un solo texto, para que la foto sea
| estable entre renders.
|
| 19/10/2026: con el almacenamiento bloqueado (ventana privada, Safari con
| datos de sitio borrados) `localStorage` lanza y la página entera se caía.
*/
const SIN_SUSCRIPCION = () => () => {};
const leeInfoGuardada = () => {
  try {
    return JSON.stringify(
      TIPOS_CON_INFO.map((tipo) => localStorage.getItem(`fileInfo_${tipo}`)),
    );
  } catch {
    return "[]";
  }
};
const sinInfoEnServidor = () => "[]";

/*
| LOS BLOQUES (19/10/2026)
|
| «Área Condicional» y «Hudl» tenían botón de subir, pero nada guardaba lo
| subido: la tarjeta decía «Cargado» y al recargar no quedaba nada. Ahora lo
| dicen —«todavía no se cargan aquí»— en vez de fingir que sí, y cada una
| apunta a dónde vive de verdad ese dato hoy.
*/
const blocks: {
  title: string;
  description: string;
  type: TipoConCarga | "conditional" | "hudl";
  /** Dónde está hoy ese dato, cuando no se sube aquí. */
  dondeEsta?: { texto: string; href: string; enlace: string };
}[] = [
  {
    title: "Jugadores Castilla",
    description: "Base de datos individual",
    type: "players",
  },
  {
    title: "Datos Colectivos",
    description: "Métricas de equipo",
    type: "team",
  },
  {
    title: "Scout Rival",
    description: "Informes rivales",
    type: "scout",
  },
  {
    title: "Área Condicional",
    description: "GPS · Wellness · Carga",
    type: "conditional",
    dondeEsta: {
      texto: "Todavía no se carga desde aquí. La carga de cada tarea se registra en",
      href: "/microcycles",
      enlace: "Microciclos",
    },
  },
  {
    title: "Hudl",
    description: "Integración vídeo",
    type: "hudl",
    dondeEsta: {
      texto: "Todavía no se carga desde aquí. Los timelines de Hudl se leen solos cada noche y se ven en",
      href: "/analisis-goles",
      enlace: "Análisis de goles",
    },
  },
];

const tieneCarga = (tipo: string): tipo is TipoConCarga =>
  (TIPOS_CON_INFO as readonly string[]).includes(tipo);

export default function DataCenter() {
  const {
    playersData,
    teamData,
    scoutData,
    setPlayersData,
    setTeamData,
    setScoutData,
  } = useData();

  // Lo subido en esta sesión; manda sobre lo guardado.
  const [infoSubida, setFileInfo] = useState<Record<string, InfoArchivo>>({});

  /* El resultado de la última subida, escrito en la tarjeta en vez de un
     `alert()` que bloquea la pantalla (19/10/2026). */
  const [aviso, setAviso] = useState<{ tipo: string; ok: boolean; texto: string } | null>(null);

  const infoGuardadaCruda = useSyncExternalStore(
    SIN_SUSCRIPCION,
    leeInfoGuardada,
    sinInfoEnServidor,
  );

  const fileInfo = useMemo(() => {
    let guardadas: (string | null)[] = [];

    try {
      guardadas = JSON.parse(infoGuardadaCruda) as (string | null)[];
    } catch {
      guardadas = [];
    }

    const loaded: Record<string, InfoArchivo> = {};

    TIPOS_CON_INFO.forEach((tipo, i) => {
      const cruda = guardadas[i];
      if (!cruda) return;

      try {
        loaded[tipo] = JSON.parse(cruda) as InfoArchivo;
      } catch {
        /* Una ficha rota no tumba la página: esa tarjeta sale sin ficha. */
      }
    });

    return { ...loaded, ...infoSubida };
  }, [infoGuardadaCruda, infoSubida]);

  const registrosDe: Record<TipoConCarga, number> = {
    players: playersData.length,
    team: teamData.length,
    scout: scoutData.length,
  };

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: TipoConCarga,
  ) => {
    const input = event.target;
    const file = input.files?.[0];

    /* Se vacía el selector: sin esto, volver a subir el MISMO archivo (ya
       corregido) no dispara `onChange` y parece que el botón no hace nada. */
    input.value = "";

    if (!file) return;

    Papa.parse<FilaDatos>(file, {
      header: true,
      skipEmptyLines: true,

      complete: (results) => {
        if (results.data.length === 0) {
          setAviso({
            tipo: type,
            ok: false,
            texto: `«${file.name}» no trae ninguna fila. Comprueba que es un CSV con cabecera.`,
          });
          return;
        }

        if (type === "players") setPlayersData(results.data);
        if (type === "team") setTeamData(results.data);
        if (type === "scout") setScoutData(results.data);

        const info = {
          fileName: file.name,
          records: results.data.length,
          updatedAt: new Date().toLocaleString("es-ES"),
        };

        setFileInfo((prev) => ({ ...prev, [type]: info }));

        try {
          localStorage.setItem(`fileInfo_${type}`, JSON.stringify(info));
        } catch {
          /* Sin almacenamiento se queda para esta sesión, que es lo que hay. */
        }

        setAviso({
          tipo: type,
          ok: true,
          texto: `Cargado: ${results.data.length} filas.`,
        });
      },

      error: (error) => {
        setAviso({
          tipo: type,
          ok: false,
          texto: `No se ha podido leer «${file.name}»: ${error.message}`,
        });
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="p-4 sm:p-6 md:p-10">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Data Center
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Centro de Datos
            </h1>

            <p className="mt-3 text-white/60">
              Gestión centralizada de información y fuentes de datos.
            </p>

            {/*
              Lo que se sube aquí se queda en ESTE aparato (localStorage) y
              hoy no lo lee ninguna otra pantalla. Se dice para que nadie suba
              el informe de la semana aquí creyendo que llega a Data Análisis
              (19/10/2026).
            */}
            <p className="mt-3 max-w-3xl rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] leading-relaxed text-white/60">
              Los CSV que subas aquí se guardan sólo en este ordenador o tableta.
              Los informes de Wyscout y Opta de cada semana no se suben aquí: se
              dejan en la carpeta de datos y se ven en{" "}
              <Link href="/data-analisis" className="font-semibold text-[#C8A96B] underline-offset-2 hover:underline">
                Data Análisis
              </Link>
              .
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {blocks.map((block) => {
              const tipo = block.type;
              const conCarga = tieneCarga(tipo);
              const info = conCarga ? fileInfo[tipo] : undefined;
              const suAviso = aviso?.tipo === tipo ? aviso : null;

              return (
                <div
                  key={block.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h2 className="text-xl font-semibold">{block.title}</h2>

                  <p className="mt-3 text-white/60">{block.description}</p>

                  {conCarga ? (
                    <label className="mt-6 inline-block cursor-pointer rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5 focus-within:ring-2 focus-within:ring-[#C8A96B]/50">
                      Subir archivo CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        onChange={(e) => handleFileUpload(e, tipo)}
                      />
                    </label>
                  ) : (
                    block.dondeEsta && (
                      <p className="mt-6 text-[13px] leading-relaxed text-white/50">
                        {block.dondeEsta.texto}{" "}
                        <Link
                          href={block.dondeEsta.href}
                          className="font-semibold text-[#C8A96B] underline-offset-2 hover:underline"
                        >
                          {block.dondeEsta.enlace}
                        </Link>
                        .
                      </p>
                    )
                  )}

                  {suAviso && (
                    <p
                      role="status"
                      className={`mt-3 text-sm ${suAviso.ok ? "text-green-400" : "text-amber-300"}`}
                    >
                      {suAviso.texto}
                    </p>
                  )}

                  {info && (
                    <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-400" />
                        <span className="text-sm font-medium text-green-400">
                          Cargado
                        </span>
                      </div>

                      <p className="text-xs text-white/60">Archivo</p>
                      <p className="mb-3 break-all text-sm text-white">{info.fileName}</p>

                      <p className="text-xs text-white/60">Filas</p>
                      <p className="mb-3 text-sm text-white">{info.records}</p>

                      <p className="text-xs text-white/60">Última actualización</p>
                      <p className="text-sm text-white">{info.updatedAt}</p>
                    </div>
                  )}

                  {conCarga && (
                    <div className="mt-4">
                      <div className="h-px bg-white/10" />
                      <p className={`mt-3 text-sm ${registrosDe[tipo] ? "text-green-400" : "text-white/45"}`}>
                        {registrosDe[tipo]
                          ? `${registrosDe[tipo]} filas guardadas en este aparato`
                          : "Nada guardado todavía en este aparato"}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
