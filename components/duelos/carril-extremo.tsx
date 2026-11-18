"use client";

/**
 * ¿EXTREMO DE BANDA O FALSO EXTREMO? (18/11/2026, idea de X). En el duelo de
 * nuestro lateral contra su extremo, una franja con el carril donde toca el
 * balón en campo rival: pasillo exterior, carril intermedio y pasillo
 * central. Si más de la mitad cae dentro, «falso extremo: se va hacia
 * dentro» y se nombra a nuestro pivote de ese lado, que es quien se lo
 * encuentra; si no, se queda como 1c1 con nuestro lateral.
 *
 * Datos: `opta:directo:archivo` y `opta:directo:<partido>` de sus últimos
 * partidos, por `useDocsOpta` (los mismos que «Amplitud por banda» del
 * Colectivo). Las cuentas, en `lib/duelos-carril.ts`. Sin cruce o sin dato,
 * no se pinta. Nada se pide hasta que asoma.
 */

import { useEffect, useMemo } from "react";

import { COMPARADO, tinta } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import type { JugadorDuelo } from "@/lib/duelos";
import { carrilDelExtremo, MAX_PARTIDOS, ROTULO_CARRIL, UMBRAL_DENTRO, Y_EXTERIOR, Y_INTERMEDIO, type Carril } from "@/lib/duelos-carril";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { eventos?: TablaOpta; jugadores?: TablaOpta };

/** Fuera en azul (el duelo del lateral), dentro en naranja cada vez más intenso. */
export const COLOR_CARRIL: Record<Carril, string> = { exterior: COMPARADO, intermedio: "#E8984F", central: "#D95F02" };
const pct = (v: number) => `${Math.round(v * 100)} %`;
const corto = (j: JugadorDuelo) => j.corto ?? j.nombre.split(/\s+/).slice(-1)[0];

type Props = {
  equipo: string;
  extremo: JugadorDuelo;
  lateral: JugadorDuelo | null;
  /** Nuestro pivote del lado del duelo: el que se lo encuentra si se va dentro. */
  delLado: { jugador: JugadorDuelo; puesto: string } | null;
  /** Avisa a la tarjeta de la lectura (para el chip de la cabecera). */
  onLectura?: (falso: boolean | null) => void;
};

export function CarrilExtremo(props: Props) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && <Indice {...props} />}</div>;
}

function Indice(props: Props) {
  const { docs } = useDocsOpta<[TablaOpta, Archivo]>(DOCS_OPTA.equipos, "opta:directo:archivo");
  const [tEquipos, archivo] = docs;

  const rival = useMemo(() => {
    if (!tEquipos) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = casaEquipo(props.equipo, equipos);
    if (!id || id === CASTILLA_OPTA) return null;
    return { id, nombre: equipos.find((e) => e.teamId === id)?.equipo || props.equipo };
  }, [tEquipos, props.equipo]);

  const ids = useMemo(() => {
    if (!rival || !Array.isArray(archivo?.partidos)) return [];
    return archivo.partidos
      .filter((p) => p?.partido && (p.equipos ?? []).includes(rival.nombre))
      .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")))
      .slice(0, MAX_PARTIDOS)
      .map((p) => String(p.partido));
  }, [rival, archivo]);

  if (!rival || !ids.length) return null;
  return <Franja {...props} teamId={rival.id} ids={ids} />;
}

function Franja({ extremo, lateral, delLado, onLectura, teamId, ids }: Props & { teamId: string; ids: string[] }) {
  const { docs } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));

  const datos = useMemo(() => {
    const partidos = docs
      .map((d, i) => (d ? { partido: ids[i], eventos: leeEventos(d.eventos), jugadores: leeJugadores(d.jugadores) } : null))
      .filter((p): p is NonNullable<typeof p> => p != null && p.eventos.length > 0);
    return partidos.length ? carrilDelExtremo(partidos, teamId, [extremo.nombre, extremo.wyscout?.jugador ?? ""]) : null;
  }, [docs, ids, teamId, extremo]);

  const falso = datos ? datos.falsoExtremo : null;
  useEffect(() => {
    onLectura?.(falso);
  }, [falso, onLectura]);

  if (!datos) return null;
  const quien = corto(extremo);
  const nuestroLateral = lateral ? corto(lateral) : "nuestro lateral";
  const orden: Carril[] = ["exterior", "intermedio", "central"];
  const borde = datos.falsoExtremo ? "#D95F02" : COMPARADO;

  return (
    <div className="mt-3 rounded-xl border p-3" style={{ borderColor: `${borde}66`, background: `${borde}10` }} onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] font-semibold text-white/80">¿Extremo de banda o falso extremo? · por dónde toca en campo rival</p>
        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${borde}22`, color: borde }}>
          {datos.falsoExtremo ? "Falso extremo: se va hacia dentro" : "Extremo de banda: 1c1 con el lateral"}
        </span>
      </div>

      <p className="fuente-club mt-1.5 text-[22px] font-bold uppercase leading-tight text-white sm:text-[26px]">
        {quien}: <span style={{ color: borde }}>{pct(datos.dentro)}</span> de sus toques, dentro
      </p>

      {/* La franja: tres carriles y la raya de la mitad, que es la regla. */}
      <div className="relative mt-2">
        <div className="flex h-7 w-full overflow-hidden rounded-md" role="img" aria-label={orden.map((c) => `${ROTULO_CARRIL[c]} ${pct(datos.parte[c])}`).join(", ")}>
          {orden.map((c) =>
            datos.parte[c] > 0 ? (
              <div
                key={c}
                className="idea-aparece flex items-center justify-center overflow-hidden text-[11px] font-semibold tabular-nums text-white"
                style={{ width: `${datos.parte[c] * 100}%`, background: COLOR_CARRIL[c] }}
                title={`${ROTULO_CARRIL[c]}: ${datos.cuenta[c]} toques (${pct(datos.parte[c])})`}
              >
                {datos.parte[c] >= 0.1 ? pct(datos.parte[c]) : ""}
              </div>
            ) : null,
          )}
        </div>
        {/* La raya de la mitad: si el exterior (a la izquierda) no llega a ella, toca más dentro que fuera. */}
        <span className="absolute -bottom-1 -top-1 w-0.5" style={{ left: `${UMBRAL_DENTRO * 100}%`, background: tinta(0.75) }} aria-hidden />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
        {orden.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_CARRIL[c] }} />
            {ROTULO_CARRIL[c]} <b className="tabular-nums text-white/80">{pct(datos.parte[c])}</b>
          </span>
        ))}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-white/70">
        {datos.falsoExtremo ? (
          <>
            Se mete dentro: quien de verdad se lo encuentra es{" "}
            {delLado ? (
              <>
                <b className="text-[#C8A96B]">{corto(delLado.jugador)}</b> ({delLado.puesto})
              </>
            ) : (
              "nuestro pivote de ese lado"
            )}
            . {nuestroLateral} no sale a perseguirlo hacia dentro: lo pasa y guarda su espalda.
          </>
        ) : (
          <>Toca sobre todo por fuera: es duelo 1c1 con {nuestroLateral}, que no le deja girarse hacia el centro.</>
        )}
      </p>
      <p className="mt-1 text-xs text-white/45">
        Opta, {datos.total} toques en campo rival en {datos.partidos} {datos.partidos === 1 ? "partido" : "partidos"} como titular. Exterior: y &lt; {Y_EXTERIOR} o y &gt; {100 - Y_EXTERIOR}; central: de {Y_INTERMEDIO} a {100 - Y_INTERMEDIO}; intermedio, entre medias.
      </p>
    </div>
  );
}
