"use client";

/**
 * EL ONCE, MIRADO POR TRES SITIOS.
 *
 * Se elige un once —un jugador por puesto— y se mira contado por Wyscout, por
 * Opta o por el cuerpo técnico. Las tres vistas tienen la misma forma: una
 * rejilla de ítems por bloques y unas columnas, así que cambiar de fuente no
 * obliga a reaprender a leerla.
 *
 * **Las columnas se eligen**: por líneas —el once y sus tres líneas— o jugador
 * a jugador. Lo segundo es lo que faltaba: la descarga de Wyscout es
 * individual, y enseñar sólo la media de la línea escondía justo el dato que
 * hay.
 *
 * **Cada barra se pinta con su propia regla.** En Wyscout es el percentil
 * contra los de su puesto; en nuestra valoración, la nota sobre diez; en Opta,
 * el recuento contra la columna que más tiene. Por eso el número que se escribe
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
  HUECOS,
  VISTAS,
  armaOnce,
  casaNombre,
  ladoDeLaHoja,
  proponeOnce,
  puestoDeLaHoja,
  rejillaDe,
  sitioDe,
  vaAlLado,
  type CeldaOnce,
  type ColumnaOnce,
  type FilaOnce,
  type FuenteOnce,
  type LineaOnce,
  type VistaOnce,
} from "@/lib/data-analisis/once";
import {
  AMBITOS,
  PUESTOS,
  esNuestro,
  type Ambito,
} from "@/lib/data-analisis/individual";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import type { PartidoEventos } from "@/lib/data-analisis/eventos";

export function PanelOnce({
  jugadores,
  eventos,
  nuestros,
  sistema,
  competicion,
}: {
  /** Las filas de Wyscout, de todos los equipos: hacen falta para el percentil. */
  jugadores: FilaJugador[];
  eventos: PartidoEventos[];
  /**
   * Los partidos del Castilla que ha dejado pasar la barra de arriba, ya
   * recortados por temporada, competición y sistema.
   *
   * Es lo que ata esta pantalla a esos selectores: hasta ahora se enseñaban
   * encima del once y no hacían nada, que es peor que no tenerlos —se cambia
   * el sistema, no se mueve un número, y no hay forma de saber si es que no
   * hay dato o es que está roto—. Y son también el denominador del bloque
   * «Peso en el equipo».
   */
  nuestros: FilaPartido[];
  /** Lo elegido arriba, sólo para poder decir en qué se está mirando. */
  sistema: string;
  competicion: string;
}) {
  const { players, loading } = usePlayers();
  const { season } = useRatingsSeason();

  const [fuente, setFuente] = useState<FuenteOnce>("wyscout");
  const [vista, setVista] = useState<VistaOnce>("lineas");
  const [ambito, setAmbito] = useState<Ambito>("liga");

  /*
  | LAS FECHAS QUE ENTRAN.
  |
  | Se cruza **sólo por fecha**, y a propósito: Wyscout escribe «Real Madrid
  | Castilla» y el log de Opta «Real Madrid II», así que atar por nombre
  | obligaría a mantener una tabla de equivalencias que se rompe sola. Como el
  | conjunto de partida ya son NUESTROS partidos, una fecha identifica uno sin
  | ambigüedad: un equipo no juega dos veces el mismo día.
  */
  const fechas = useMemo(
    () => new Set(nuestros.map((uno) => uno.fecha)),
    [nuestros],
  );

  /* El log de Opta es por partido, así que se recorta de verdad. */
  const susEventos = useMemo(
    () => eventos.filter((uno) => fechas.has(uno.fecha)),
    [eventos, fechas],
  );

  /*
  | Y nuestras valoraciones también: son por partido (Individual →
  | Valoraciones), así que se recorta la temporada a los partidos elegidos y se
  | vuelve a resumir. Las medias, la forma y la tendencia salen ya sólo de
  | esos, en vez de ser las del curso entero con otro rótulo encima.
  */
  const suTemporada = useMemo(
    () => ({
      ...season,
      matches: Object.fromEntries(
        Object.entries(season.matches).filter(([, uno]) =>
          fechas.has(uno.match.date),
        ),
      ),
    }),
    [fechas, season],
  );

  /* Quién ocupa cada hueco. Vacío = se propone solo, por minutos jugados. */
  const [elegidos, setElegidos] = useState<Record<string, string>>({});

  const deCasa = useMemo(
    () => players.filter((uno) => uno.esCastilla),
    [players],
  );

  /* Las filas de Wyscout de los nuestros, que son las que dicen puesto y lado. */
  const nuestrosWys = useMemo(
    () => jugadores.filter((j) => esNuestro(j) && j.temporada === "actual"),
    [jugadores],
  );

  /**
   * Dónde juega cada uno de la plantilla, y cuántos minutos lleva.
   *
   * Se resuelve una vez y se reparte: lo usan el once que se propone solo, los
   * desplegables y el aviso de «la hoja y Wyscout no dicen lo mismo».
   */
  const ficha = useMemo(() => {
    const mapa = new Map<
      string,
      { sitio: ReturnType<typeof sitioDe>; minutos: number }
    >();

    for (const uno of deCasa) {
      const suya = casaNombre(uno.nombre, nuestrosWys, (j) => j.jugador);

      mapa.set(uno.id, {
        sitio: sitioDe(uno.posicion ?? "", suya?.posicion ?? null),
        minutos: suya?.minutos ?? 0,
      });
    }

    return mapa;
  }, [deCasa, nuestrosWys]);

  /* El once que se propone solo: la regla vive en el modelo, con su prueba. */
  const once = useMemo(() => {
    const candidatos = deCasa
      .map((uno) => {
        const suya = ficha.get(uno.id);

        return suya ? { id: uno.id, sitio: suya.sitio, minutos: suya.minutos } : null;
      })
      .filter((uno) => uno !== null);

    const puestos = proponeOnce(candidatos, elegidos);

    return HUECOS.map((hueco) => ({
      hueco,
      jugador: deCasa.find((uno) => uno.id === puestos[hueco.clave]),
    }));
  }, [deCasa, elegidos, ficha]);

  const resumenes = useMemo(
    () => [...summarizeAll(suTemporada).values()],
    [suTemporada],
  );

  const resuelto = useMemo(
    () =>
      armaOnce(
        once
          .filter((uno) => uno.jugador)
          .map((uno) => ({
            id: uno.jugador!.id,
            nombre: uno.jugador!.nombre,
            posicion: uno.jugador!.posicion ?? "",
            hueco: uno.hueco.clave,
          })),
        jugadores,
        resumenes,
        susEventos,
      ),
    [once, jugadores, resumenes, susEventos],
  );

  const rejilla = useMemo(
    () => rejillaDe(fuente, resuelto, jugadores, susEventos, ambito, vista, nuestros),
    [fuente, resuelto, jugadores, susEventos, ambito, vista, nuestros],
  );

  const pregunta = FUENTES.find((una) => una.key === fuente)?.pregunta ?? "";

  /*
  | QUÉ ALCANCE TIENE LO QUE SE ESTÁ MIRANDO.
  |
  | Las tres fuentes no obedecen igual al recorte de arriba, y callarlo sería
  | el peor de los fallos: enseñar la cifra de la temporada entera con un
  | «4-4-2» puesto en la barra la convierte en una mentira. Así que cada vista
  | dice qué está contando y, si no puede recortarse, lo dice también.
  */
  const recorte = sistema || competicion.replace(/^Spain\.\s*/, "");

  const alcance = useMemo(() => {
    const cuantos = nuestros.length;

    const partidos = `${cuantos} partido${cuantos === 1 ? "" : "s"} del Castilla`;

    if (fuente === "wyscout") {
      return recorte
        ? [
            `Wyscout da una fila por jugador y temporada, no por partido: los percentiles son los del curso entero y NO están recortados a ${recorte}.`,
            `Para ver el once por ${sistema ? "sistema" : "competición"}, cambia a Opta o a Nuestra valoración, que sí son por partido.`,
          ]
        : [];
    }

    if (cuantos === 0) {
      return [
        `No queda ningún partido del Castilla${recorte ? ` con ${recorte}` : ""} en lo elegido arriba.`,
      ];
    }

    const valorados = Object.keys(suTemporada.matches).length;

    return fuente === "nuestra"
      ? [
          `${partidos}${recorte ? ` con ${recorte}` : ""}, de los que ${valorados} ${
            valorados === 1 ? "está valorado" : "están valorados"
          }: las notas, la forma y la tendencia salen sólo de ésos.`,
        ]
      : [`${partidos}${recorte ? ` con ${recorte}` : ""} en lo elegido arriba.`];
  }, [fuente, nuestros.length, recorte, sistema, suTemporada.matches]);

  /*
  | CUANDO LA HOJA Y WYSCOUT NO DICEN LO MISMO.
  |
  | Manda Wyscout, porque es dónde ha jugado de verdad, pero cambiarle el
  | puesto a alguien sin decirlo sería peor que el fallo que se arregla: el
  | cuerpo técnico tiene que poder ver que la hoja se ha quedado atrás —o que
  | Wyscout se equivoca— y corregir a mano.
  */
  const discrepan = useMemo(
    () =>
      resuelto.filter((uno) => {
        if (uno.sitio.segun !== "wyscout" || !uno.sitio.hoja) return false;

        const puestoHoja = puestoDeLaHoja(uno.sitio.hoja);

        const ladoHoja = ladoDeLaHoja(uno.sitio.hoja);

        /* Que la hoja no diga el lado —«CENTRAL», «6»— no es discrepar: es que
           esa columna no lo escribe. Sólo se avisa cuando las dos lo dicen y
           dicen cosas distintas. */
        return (
          puestoHoja !== uno.puesto ||
          (ladoHoja !== "C" && uno.lado !== "C" && ladoHoja !== uno.lado)
        );
      }),
    [resuelto],
  );

  const avisos = useMemo(
    () => [...alcance, ...rejilla.avisos],
    [alcance, rejilla.avisos],
  );

  if (loading) {
    return (
      <p className="mt-5 px-1 py-8 text-center text-xs text-white/35">
        Cargando la plantilla…
      </p>
    );
  }

  return (
    <>
      {/* ---------------------- LOS CONMUTADORES -------------------- */}

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

        <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
          {VISTAS.map((una) => (
            <button
              key={una.key}
              type="button"
              onClick={() => setVista(una.key)}
              aria-pressed={vista === una.key}
              title={una.explica}
              className={`rounded-lg px-3 py-2 text-xs transition ${
                vista === una.key
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {una.label}
            </button>
          ))}
        </div>

        {/* Contra quién se compara. Sólo Wyscout tiene percentiles. */}
        {fuente === "wyscout" && (
          <label className="flex items-center gap-2 text-[11px] text-white/35">
            Comparado con
            <select
              value={ambito}
              onChange={(evento) => setAmbito(evento.target.value as Ambito)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white outline-none transition focus:border-[#C8A96B]/50"
            >
              {AMBITOS.map((uno) => (
                <option key={uno.key} value={uno.key} className="bg-[#11161C]">
                  {uno.label}
                </option>
              ))}
            </select>
          </label>
        )}

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
              /* Del puesto y del lado, del puesto, y el resto. */
              const suyo = (id: string) => ficha.get(id)?.sitio;

              const delLado = deCasa.filter((uno) => {
                const sitio = suyo(uno.id);

                return sitio?.puesto === hueco.puesto && vaAlLado(hueco, sitio.lado);
              });

              const delPuesto = deCasa.filter(
                (uno) =>
                  suyo(uno.id)?.puesto === hueco.puesto && !delLado.includes(uno),
              );

              /* Quien no sea del puesto también se puede poner: un central
                 puede jugar de lateral y el cuerpo técnico lo sabe mejor. */
              const resto = deCasa.filter(
                (uno) => !delLado.includes(uno) && !delPuesto.includes(uno),
              );

              const rotulo = (uno: (typeof deCasa)[number]) => {
                const sitio = suyo(uno.id);

                const etiqueta = sitio?.wyscout || sitio?.hoja || "";

                return `${uno.dorsal ? `${uno.dorsal} · ` : ""}${uno.nombre}${
                  etiqueta ? ` · ${etiqueta}` : ""
                }`;
              };

              const porNombre = (
                a: (typeof deCasa)[number],
                b: (typeof deCasa)[number],
              ) => a.nombre.localeCompare(b.nombre, "es");

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

                    {[...delLado].sort(porNombre).map((uno) => (
                      <option key={uno.id} value={uno.id} className="bg-[#11161C]">
                        {rotulo(uno)}
                      </option>
                    ))}

                    {delPuesto.length > 0 && (
                      <optgroup label="Del puesto, otro lado">
                        {[...delPuesto].sort(porNombre).map((uno) => (
                          <option key={uno.id} value={uno.id} className="bg-[#11161C]">
                            {rotulo(uno)}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {resto.length > 0 && (
                      <optgroup label="De otro puesto">
                        {[...resto].sort(porNombre).map((uno) => (
                          <option key={uno.id} value={uno.id} className="bg-[#11161C]">
                            {rotulo(uno)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/35">
            El puesto y el lado salen de Wyscout —«LB» es lateral izquierdo,
            «RCB» central derecho— y de la hoja de plantilla cuando no hay fila
            suya. Es lo que ordena los desplegables.
          </p>
        </Panel>

        {/* ----------------------- LA REJILLA ----------------------- */}

        <div className="min-w-0">
          {discrepan.length > 0 && (
            <div className="mb-4">
              <Notice tone="info" title="Wyscout y la hoja no dicen lo mismo">
                <ul className="space-y-1">
                  {discrepan.map((uno) => (
                    <li key={uno.id}>
                      <strong className="text-white/75">{uno.nombre}</strong>:
                      Wyscout lo tiene de{" "}
                      <strong className="text-white/75">{uno.sitio.wyscout}</strong>{" "}
                      y la hoja dice «{uno.sitio.hoja}». Manda Wyscout, que es
                      dónde ha jugado esta temporada.
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}

          {avisos.length > 0 && (
            <div className="mb-4">
              <Notice
                tone={
                  fuente === "opta" || (fuente === "wyscout" && recorte)
                    ? "warn"
                    : "info"
                }
                title={
                  fuente === "wyscout" && recorte
                    ? `Esta vista no se puede recortar a ${recorte}`
                    : fuente === "opta"
                      ? "Antes de leer esto"
                      : "Qué se está contando"
                }
              >
                <ul className="space-y-1">
                  {avisos.map((aviso) => (
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
              <table
                className="w-full text-[12px]"
                style={{ minWidth: `${260 + rejilla.columnas.length * 116}px` }}
              >
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                    <th className="pb-2 pt-1.5 text-left font-medium">&nbsp;</th>

                    {rejilla.columnas.map((columna) => (
                      <th
                        key={columna.key}
                        className={`pb-2 pt-1.5 text-center font-medium ${
                          columna.destacada ? "text-[#C8A96B]" : ""
                        }`}
                      >
                        <span className="block truncate">{columna.label}</span>

                        {columna.sub && (
                          <span className="block text-[9px] font-normal normal-case tracking-normal text-white/25">
                            {columna.sub}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rejilla.bloques.map((bloque) => (
                    <BloqueFilas
                      key={bloque.grupo}
                      bloque={bloque}
                      columnas={rejilla.columnas}
                    />
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
  columnas,
}: {
  bloque: { grupo: string; filas: FilaOnce[] };
  columnas: ColumnaOnce[];
}) {
  return (
    <>
      <tr>
        <td
          colSpan={columnas.length + 1}
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

          {columnas.map((columna) => (
            <Celda key={columna.key} celda={fila.celdas[columna.key]} />
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
 * no tienen «bueno» —la posesión, los rechaces, el reparto del peso— van en
 * dorado neutro.
 */
function Celda({ celda }: { celda?: CeldaOnce }) {
  if (!celda || celda.texto === null) {
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
    <td className="px-2 py-1.5" title={celda.detalle}>
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
