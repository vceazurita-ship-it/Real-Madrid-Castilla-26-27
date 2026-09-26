"use client";

/**
 * PONER AL DÍA LOS ROBOS, CON EL PARTIDO QUE SEA.
 *
 * Lo único que cambia cada jornada es **dónde está el vídeo**, y hasta ahora esa
 * ruta vivía dentro de un script: había que abrirlo para cambiarla y acordarse
 * de los filtros de ffmpeg de memoria. Aquí se escribe la ruta y salen las
 * órdenes ya hechas, listas para pegar en la consola del ordenador del club.
 *
 * **No se puede lanzar desde el navegador, y decirlo evita buscar un botón que
 * no existe.** Son varios gigas de vídeo que hay que abrir con el ffmpeg del
 * proyecto y, sobre todo, hay que MIRAR el partido: ninguna de las dos cosas
 * pasa por una página web.
 *
 * Es el mismo patrón que el panel de faltas, a propósito: quien sepa actualizar
 * una sección sabe actualizar la otra.
 */

import { useMemo, useState } from "react";
import { Check, Copy, TerminalSquare } from "lucide-react";

import { Panel } from "@/components/abp/ui";

/** Windows escribe las rutas con barra invertida y la consola se atraganta. */
const conBarras = (ruta: string) => ruta.trim().replace(/\\/g, "/").replace(/\/+$/, "");

/** «SANT ANDREU - RM CASTILLA.mov» → «sant-andreu-rm-castilla». */
function apodoDeVideo(ruta: string) {
  const fichero = conBarras(ruta).split("/").pop() ?? "";

  return (
    fichero
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "partido"
  );
}

export function ComoActualizar({
  videoPorDefecto = "",
  partidoPorDefecto = "",
}: {
  /** El vídeo del último partido etiquetado, para no empezar en blanco. */
  videoPorDefecto?: string;
  partidoPorDefecto?: string;
}) {
  const [video, setVideo] = useState(videoPorDefecto);
  const [partido, setPartido] = useState(partidoPorDefecto);
  const [detalle, setDetalle] = useState<"fino" | "rapido">("rapido");
  const [copiada, setCopiada] = useState<string | null>(null);

  const ruta = useMemo(
    () => conBarras(video) || "C:/ruta/al/PARTIDO.mov",
    [video],
  );

  /* Si no se pone id, se saca del nombre del fichero: es lo que se acierta. */
  const id = useMemo(
    () => partido.trim() || apodoDeVideo(video),
    [partido, video],
  );

  const ordenes = useMemo(
    () => [
      {
        clave: "preparar",
        titulo: "1 · Sacar las imágenes del partido y armar los bloques",
        orden:
          `node scripts/transiciones-preparar.mjs --video "${ruta}" --partido ${id}` +
          (detalle === "rapido" ? " --cada 4" : ""),
      },
      {
        clave: "datos",
        titulo: "2 · Cuando estén etiquetados, rehacer los datos de la pantalla",
        orden: "node scripts/transiciones-datos.mjs",
      },
    ],
    [ruta, id, detalle],
  );

  const copia = async (clave: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);

      setCopiada(clave);
    } catch {
      setCopiada(null);
    }
  };

  return (
    <Panel
      title="Poner al día los robos de un partido"
      subtitle="Se lanza en el ordenador del club, no desde aquí: son varios gigas de vídeo"
      icon={TerminalSquare}
    >
      <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
        <label className="block min-w-0">
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            Vídeo del partido
          </span>

          <input
            value={video}
            onChange={(e) => setVideo(e.target.value)}
            placeholder="C:\\Users\\...\\SANT ANDREU - RM CASTILLA.mov"
            spellCheck={false}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
          />

          <span className="mt-1 block text-[11px] text-white/35">
            Pégala tal cual: las barras se arreglan solas.
          </span>
        </label>

        <label className="block min-w-0">
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            Nombre corto del partido
          </span>

          <input
            value={partido}
            onChange={(e) => setPartido(e.target.value)}
            placeholder={apodoDeVideo(video)}
            spellCheck={false}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
          />

          <span className="mt-1 block text-[11px] text-white/35">
            Es la carpeta del etiquetado. Si lo dejas vacío, sale del nombre del
            fichero.
          </span>
        </label>
      </div>

      {/* ----------------------------- con qué lupa ----------------------- */}

      <div className="mt-4">
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          Con cuánta lupa
        </span>

        <div className="mt-1.5 flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
          {(
            [
              { key: "rapido" as const, label: "Rápido · una imagen cada 8 s" },
              { key: "fino" as const, label: "Fino · el partido entero, 2 s" },
            ]
          ).map((uno) => (
            <button
              key={uno.key}
              type="button"
              onClick={() => setDetalle(uno.key)}
              aria-pressed={detalle === uno.key}
              className={`rounded-lg px-3 py-2 text-xs transition ${
                detalle === uno.key
                  ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {uno.label}
            </button>
          ))}
        </div>

        {/*
          Esto no es una preferencia de gusto, y por eso se explica al lado del
          botón: la lupa cambia lo que los números SIGNIFICAN. En rápido, los
          robos son un suelo y el reparto entre «hacia delante» y «horizontal o
          atrás» no se puede comparar con un partido mirado del tirón.
        */}
        <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-white/40">
          {detalle === "rapido"
            ? "Cuesta cuatro veces menos, y a cambio los robos que salgan son un suelo, no un total: el que empieza y acaba entre dos imágenes no se ve. Y el sesgo no es sólo de cantidad —se ven sobre todo los robos que llevan a algo—, así que ese partido no se puede comparar en porcentajes con uno mirado en fino. Hay que decirlo en las notas del partido."
            : "El partido imagen a imagen, que es lo que da el número de robos de verdad y lo único comparable entre partidos. Coste medido: un límite de sesión por cada 20-25 minutos de partido."}
        </p>
      </div>

      {/* ----------------------------- las órdenes ------------------------ */}

      <div className="mt-4 space-y-3">
        {ordenes.map((una) => (
          <div key={una.clave}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/45">{una.titulo}</span>

              <button
                type="button"
                onClick={() => copia(una.clave, una.orden)}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/45 transition hover:border-white/30 hover:text-white"
              >
                {copiada === una.clave ? <Check size={11} /> : <Copy size={11} />}
                {copiada === una.clave ? "Copiada" : "Copiar"}
              </button>
            </div>

            <pre className="mt-1 overflow-x-auto rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-[#E4CE9B]">
              {una.orden}
            </pre>
          </div>
        ))}
      </div>

      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-white/40">
        El paso 1 deja las imágenes en <code>.cache/transiciones/{id}</code>,
        repartidas en bloques de cinco minutos, y un CSV vacío por bloque en{" "}
        <code>ANALISIS TRANSICIONES/{id}/bloques/</code>. Un bloque ya
        etiquetado no se pisa, así que se puede volver a lanzar sin miedo.
      </p>

      <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-white/40">
        El paso de en medio —mirar los bloques y escribir el CSV— es el que
        cuesta, y el criterio de lo que cuenta como robo está en{" "}
        <code>ANALISIS TRANSICIONES/MANUAL_ETIQUETADO.md</code>. Para que el
        partido nuevo salga en esta pantalla hay que añadirlo a{" "}
        <code>PARTIDOS</code>, arriba de{" "}
        <code>scripts/transiciones-datos.mjs</code>: son la jornada, el rival,
        la fecha y cuánto dura el vídeo.
      </p>
    </Panel>
  );
}
