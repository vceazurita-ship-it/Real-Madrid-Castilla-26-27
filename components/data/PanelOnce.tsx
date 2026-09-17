"use client";

/**
 * EL ONCE, MIRADO POR TRES SITIOS.
 *
 * Se elige un once —un jugador por puesto— y se mira contado por Wyscout, por
 * Opta o por el cuerpo técnico. Las tres vistas tienen la misma forma: una
 * rejilla de ítems por bloques y cuatro columnas —el once entero y sus tres
 * líneas—, así que cambiar de fuente no obliga a reaprender a leerla.
 *
 * **Cada barra se pinta con su propia regla.** En Wyscout es el percentil
 * contra los de su puesto; en nuestra valoración, la nota sobre diez; en Opta,
 * el recuento contra la línea que más tiene. Por eso el número que se escribe
 * es siempre el valor de verdad y la barra sólo ordena la vista: mezclarlas en
 * una escala común habría dado una cifra que no significa nada.
 *
 * El cálculo vive en `lib/data-analisis/once.ts`; aquí sólo se pinta.
 */

import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import { Notice, Panel } from "@/components/abp/ui";
import { MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { usePlayers } from "@/hooks/usePlayers";
import { useRatingsSeason } from "@/hooks/useRatings";
import { summarizeAll } from "@/lib/ratings/compute";
import {
  FUENTES,
  LINEAS,
  armaOnce,
  puestoDeLaHoja,
  rejillaDe,
  type FuenteOnce,
  type LineaOnce,
} from "@/lib/data-analisis/once";
import { PUESTOS, type Puesto } from "@/lib/data-analisis/individual";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import type { PartidoEventos } from "@/lib/data-analisis/eventos";

/** Los once puestos de la pizarra, en el orden en que se rellena un once. */
const HUECOS: { clave: string; rotulo: string; puesto: Puesto }[] = [
  { clave: "por", rotulo: "Portero", puesto: "POR" },
  { clave: "lat-d", rotulo: "Lateral derecho", puesto: "LAT" },
  { clave: "cen-d", rotulo: "Central derecho", puesto: "CEN" },
  { clave: "cen-i", rotulo: "Central izquierdo", puesto: "CEN" },
  { clave: "lat-i", rotulo: "Lateral izquierdo", puesto: "LAT" },
  { clave: "med-d", rotulo: "Medio derecho", puesto: "MED" },
  { clave: "med-c", rotulo: "Medio centro", puesto: "MED" },
  { clave: "med-i", rotulo: "Medio izquierdo", puesto: "MED" },
  { clave: "ban-d", rotulo: "Banda derecha", puesto: "BAN" },
  { clave: "del", rotulo: "Delantero", puesto: "DEL" },
  { clave: "ban-i", rotulo: "Banda izquierda", puesto: "BAN" },
];

export function PanelOnce({
  jugadores,
  eventos,
}: {
  /** Las filas de Wyscout, de todos los equipos: hacen falta para el percentil. */
  jugadores: FilaJugador[];
  eventos: PartidoEventos[];
}) {
  const { players, loading } = usePlayers();
  const { season } = useRatingsSeason();

  const [fuente, setFuente] = useState<FuenteOnce>("wyscout");

  /* Quién ocupa cada hueco. Vacío = se propone solo, por minutos jugados. */
  const [elegidos, setElegidos] = useState<Record<string, string>>({});

  const deCasa = useMemo(
    () => players.filter((uno) => uno.esCastilla),
    [players],
  );

  /*
  | El once que se propone solo: por cada hueco, el que más ha jugado de ese
  | puesto y no esté ya puesto en otro sitio.
  |
  | Se propone en vez de dejarlo vacío porque la pantalla con once desplegables
  | en blanco no dice nada, y lo primero que se quiere ver es el once de la
  | semana pasada, no rellenar un formulario.
  */
  const minutosDe = useMemo(() => {
    const mapa = new Map<string, number>();

    for (const fila of jugadores) {
      mapa.set(fila.jugador.toLowerCase(), fila.minutos);
    }

    return mapa;
  }, [jugadores]);

  const once = useMemo(() => {
    const puestos = new Map<string, string>();

    const usados = new Set<string>();

    for (const hueco of HUECOS) {
      const aMano = elegidos[hueco.clave];

      if (aMano) {
        puestos.set(hueco.clave, aMano);
        usados.add(aMano);
      }
    }

    /* Los que más han jugado primero: es el criterio de «quién es titular». */
    const porMinutos = (a: (typeof deCasa)[number], b: (typeof deCasa)[number]) =>
      (minutosDe.get(b.nombre.toLowerCase()) ?? 0) -
      (minutosDe.get(a.nombre.toLowerCase()) ?? 0);

    for (const hueco of HUECOS) {
      if (puestos.has(hueco.clave)) continue;

      const libres = deCasa.filter((uno) => !usados.has(uno.id));

      /*
      | Si no queda nadie de ese puesto, se pone al que más haya jugado de los
      | que quedan, en vez de dejar el hueco en blanco.
      |
      | Pasa de verdad: la plantilla tiene cuatro medios contando a uno que ya
      | no está en el club, así que al tercer medio no le queda candidato. Un
      | desplegable vacío no dice nada y además deja la rejilla coja; puesto
      | alguien, se ve el once entero y se cambia a mano en un toque.
      */
      const candidato =
        libres
          .filter((uno) => puestoDeLaHoja(uno.posicion ?? "") === hueco.puesto)
          .sort(porMinutos)[0] ?? libres.sort(porMinutos)[0];

      if (candidato) {
        puestos.set(hueco.clave, candidato.id);
        usados.add(candidato.id);
      }
    }

    return HUECOS.map((hueco) => {
      const id = puestos.get(hueco.clave);

      const jugador = deCasa.find((uno) => uno.id === id);

      return { hueco, jugador };
    });
  }, [deCasa, elegidos, minutosDe]);

  const resumenes = useMemo(() => [...summarizeAll(season).values()], [season]);

  const resuelto = useMemo(
    () =>
      armaOnce(
        once
          .filter((uno) => uno.jugador)
          .map((uno) => ({
            id: uno.jugador!.id,
            nombre: uno.jugador!.nombre,
            posicion: uno.jugador!.posicion ?? "",
          })),
        jugadores,
        resumenes,
        eventos,
      ),
    [once, jugadores, resumenes, eventos],
  );

  const rejilla = useMemo(
    () => rejillaDe(fuente, resuelto, jugadores, eventos),
    [fuente, resuelto, jugadores, eventos],
  );

  const pregunta = FUENTES.find((una) => una.key === fuente)?.pregunta ?? "";

  if (loading) {
    return (
      <p className="mt-5 px-1 py-8 text-center text-xs text-white/35">
        Cargando la plantilla…
      </p>
    );
  }

  return (
    <>
      {/* ---------------------- EL CONMUTADOR ---------------------- */}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
          {FUENTES.map((una) => (
            <button
              key={una.key}
              type="button"
              onClick={() => setFuente(una.key)}
              aria-pressed={fuente === una.key}
              title={una.pregunta}
              className={`rounded-lg px-3 py-2 text-xs transition ${
                fuente === una.key
                  ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {una.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-white/35">{pregunta}</span>
      </div>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* ------------------------ EL ONCE ------------------------ */}

        <Panel
          title="El once"
          subtitle="Cambia a quien quieras: la rejilla se rehace"
          icon={Users}
        >
          <div className="space-y-2">
            {once.map(({ hueco, jugador }) => {
              const delPuesto = deCasa
                .filter((uno) => puestoDeLaHoja(uno.posicion ?? "") === hueco.puesto)
                .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

              /* Quien no sea del puesto también se puede poner: un central
                 puede jugar de lateral y el cuerpo técnico lo sabe mejor. */
              const resto = deCasa
                .filter((uno) => puestoDeLaHoja(uno.posicion ?? "") !== hueco.puesto)
                .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

              return (
                <label key={hueco.clave} className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-white/35">
                    {hueco.rotulo}
                  </span>

                  <select
                    value={jugador?.id ?? ""}
                    onChange={(evento) =>
                      setElegidos((antes) => ({
                        ...antes,
                        [hueco.clave]: evento.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                  >
                    <option value="" className="bg-[#11161C]">
                      — sin elegir —
                    </option>

                    {delPuesto.map((uno) => (
                      <option key={uno.id} value={uno.id} className="bg-[#11161C]">
                        {uno.dorsal ? `${uno.dorsal} · ` : ""}
                        {uno.nombre}
                      </option>
                    ))}

                    {resto.length > 0 && (
                      <optgroup label="De otro puesto">
                        {resto.map((uno) => (
                          <option key={uno.id} value={uno.id} className="bg-[#11161C]">
                            {uno.dorsal ? `${uno.dorsal} · ` : ""}
                            {uno.nombre}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
              );
            })}
          </div>
        </Panel>

        {/* ----------------------- LA REJILLA ----------------------- */}

        <div className="min-w-0">
          {rejilla.avisos.length > 0 && (
            <div className="mb-4">
              <Notice
                tone={fuente === "opta" ? "warn" : "info"}
                title={
                  fuente === "opta"
                    ? "Antes de leer esto"
                    : "Lo que falta por cubrir"
                }
              >
                <ul className="space-y-1">
                  {rejilla.avisos.map((aviso) => (
                    <li key={aviso}>{aviso}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}

          {rejilla.bloques.length === 0 ? (
            <p className="px-1 py-10 text-center text-xs text-white/35">
              No hay datos de esta fuente para el once elegido.
            </p>
          ) : (
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                    <th className="pb-2 pt-1.5 text-left font-medium">&nbsp;</th>

                    {LINEAS.map((linea) => (
                      <th
                        key={linea.key}
                        className={`w-[132px] pb-2 pt-1.5 text-center font-medium ${
                          linea.key === "once" ? "text-[#C8A96B]" : ""
                        }`}
                      >
                        {linea.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rejilla.bloques.map((bloque) => (
                    <BloqueFilas key={bloque.grupo} bloque={bloque} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Un grupo de la rejilla: su rótulo y sus filas. */
function BloqueFilas({
  bloque,
}: {
  bloque: { grupo: string; filas: import("@/lib/data-analisis/once").FilaOnce[] };
}) {
  return (
    <>
      <tr>
        <td
          colSpan={LINEAS.length + 1}
          className="pb-1 pt-4 text-[10px] uppercase tracking-[0.16em] text-[#C8A96B]"
        >
          {bloque.grupo}
        </td>
      </tr>

      {bloque.filas.map((fila) => (
        <tr key={fila.clave} className="border-t border-white/[0.06]">
          <td
            className="max-w-[260px] truncate py-1.5 pr-3 text-white/70"
            title={fila.comoLeer}
          >
            {fila.etiqueta}
          </td>

          {LINEAS.map((linea) => (
            <Celda key={linea.key} celda={fila.celdas[linea.key]} />
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Una casilla: la cifra y su barra.
 *
 * El color sale del **sentido** de la métrica, no del valor: en pérdidas o en
 * PPDA, mucho no es bueno, y pintarlo verde sería mentir con un color. Las que
 * no tienen «bueno» —la posesión, los rechaces— van en dorado neutro.
 */
function Celda({
  celda,
}: {
  celda: import("@/lib/data-analisis/once").CeldaOnce;
}) {
  if (celda.texto === null) {
    return <td className="py-1.5 text-center text-white/20">—</td>;
  }

  const fuerza = celda.fuerza ?? 0;

  const color =
    celda.sentido === null
      ? ORO
      : fuerza >= 0.66
        ? MEJOR
        : fuerza <= 0.33
          ? PEOR
          : ORO;

  return (
    <td className="px-2 py-1.5">
      <span className="flex items-center gap-2">
        <span
          className="relative h-[18px] min-w-0 flex-1 overflow-hidden rounded"
          style={{ background: tinta(0.06) }}
        >
          <span
            className="absolute inset-y-0 left-0 rounded"
            style={{
              width: `${Math.max(3, Math.min(100, fuerza * 100))}%`,
              background: color,
              opacity: 0.85,
            }}
          />
        </span>

        <span className="w-[54px] shrink-0 text-right tabular-nums text-white/80">
          {celda.texto}
        </span>
      </span>
    </td>
  );
}

export { PUESTOS };
export type { LineaOnce };
