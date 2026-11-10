"use client";

/**
 * MOMENTOS DEL GOL (pestaña Talento, 10/11/2026).
 *
 * - «Goles que valen puntos»: el marcador de cada partido reconstruido con
 *   los goles de `opta:remates` y cuadrado con `opta:partidos`.
 * - «Desde el banquillo»: `opta:jugadores-partidos` con GS = 0.
 *
 * Los dos documentos pesan: se piden aquí y sólo aquí (`useDocsOpta`). Los
 * goles no se pasan a percentil: son pocos y se cuentan tal cual.
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { useDocsOpta } from "@/hooks/useDocsOpta";
import { CASTILLA_OPTA, DOCS_OPTA, aObjetos, type TablaOpta } from "@/lib/opta";
import { enAmbito, type Ambito } from "@/lib/opta-analisis";
import { desdeElBanquillo, golesConMarcador, goleadores, NOMBRE_MOMENTO, type MomentoGol, type Suplente } from "@/lib/opta-talento";

import { Botonera, Panel } from "./comun";
import { dec, equiposDe, pct, useRemates } from "./eventos";
import type { DatosOpta } from "./useOpta";

const CUANTOS = [
  { clave: "25", nombre: "25" },
  { clave: "50", nombre: "50" },
  { clave: "todos", nombre: "Todos" },
] as const;
type Cuantos = (typeof CUANTOS)[number]["clave"];

const MOMENTOS: MomentoGol[] = ["delante", "empate", "ampliar", "recortar"];
const CORTO_MOMENTO: Record<MomentoGol, string> = { delante: "Delante", empate: "Empatar", ampliar: "Ampliar", recortar: "Recortar" };

const FONDO_NUESTRO = { background: "rgba(200, 169, 107, 0.14)" };

function Cargando({ que }: { que: string }) {
  return <div className="h-48 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label={`Cargando ${que}`} />;
}

function SoloCastilla({ valor, alCambiar }: { valor: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-white/60">
      <input type="checkbox" checked={valor} onChange={(e) => alCambiar(e.target.checked)} className="accent-[#C8A96B]" />
      Sólo el Castilla
    </label>
  );
}

function recorta<T>(xs: T[], cuantos: Cuantos): T[] {
  return cuantos === "todos" ? xs : xs.slice(0, Number(cuantos));
}

/* ------------------------------------------------------------------ */
/*  GOLES QUE VALEN PUNTOS                                             */
/* ------------------------------------------------------------------ */

function GolesQueValen({ datos, ambito, nombres }: { datos: DatosOpta; ambito: Ambito; nombres: Map<string, string> }) {
  const { remates, cargando, hay } = useRemates(datos);
  const [cuantos, setCuantos] = useState<Cuantos>("25");
  const [solo, setSolo] = useState(false);

  const cuadre = useMemo(() => golesConMarcador(remates, datos.partidos), [remates, datos.partidos]);
  const lista = useMemo(
    () => goleadores(cuadre.goles).filter((r) => enAmbito(r.teamId, datos.grupos, ambito) && (!solo || r.teamId === CASTILLA_OPTA)),
    [cuadre, datos.grupos, ambito, solo],
  );

  if (cargando) return <Cargando que="los goles" />;
  if (!hay) return null;

  const partidosMal = new Set(cuadre.noCuadran.map((x) => x.partido)).size;
  const enPropia = cuadre.noCuadran.reduce((s, x) => s + Math.max(0, x.oficial - x.remates), 0);
  const vistos = recorta(lista, cuantos);
  const nuestrosFuera = cuantos === "todos" || solo ? [] : lista.map((r, i) => ({ r, i })).filter(({ r, i }) => r.teamId === CASTILLA_OPTA && i >= vistos.length);

  return (
    <Panel
      titulo="Goles que valen puntos"
      subtitulo="Un gol vale los puntos que su equipo habría perdido sin él: el 1-0 vale 2, el gol del empate a uno vale 1 y el tercero de un 3-0 no vale ninguno. Es decisivo si vale algo. El momento es el marcador justo antes del gol."
      derecha={
        <>
          <SoloCastilla valor={solo} alCambiar={setSolo} />
          <Botonera etiqueta="Cuántos" valor={cuantos} opciones={[...CUANTOS]} alCambiar={setCuantos} />
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[12px] tabular-nums">
          <thead>
            <tr className="border-b border-white/10 text-[11px] text-white/55">
              <th className="w-8 py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-3 font-semibold">Jugador</th>
              <th className="py-2 pr-3 text-right font-semibold">Goles</th>
              <th className="py-2 pr-3 text-right font-semibold text-white">Puntos</th>
              <th className="py-2 pr-3 text-right font-semibold">Decisivos</th>
              {MOMENTOS.map((m) => (
                <th key={m} className="py-2 pr-3 text-right font-semibold" title={NOMBRE_MOMENTO[m]}>
                  {CORTO_MOMENTO[m]}
                </th>
              ))}
              <th className="py-2 pr-2 text-right font-semibold">% decisivos</th>
            </tr>
          </thead>
          <tbody>
            {[...vistos.map((r, i) => ({ r, i })), ...nuestrosFuera].map(({ r, i }, k) => (
              <tr
                key={r.id}
                className={`border-b border-white/[0.06] ${k === vistos.length ? "border-t-2 border-t-white/15" : ""}`}
                style={r.teamId === CASTILLA_OPTA ? FONDO_NUESTRO : undefined}
              >
                <td className="py-1.5 pr-2 text-white/55">{i + 1}</td>
                <td className="max-w-[220px] py-1.5 pr-3">
                  <p className="truncate font-semibold text-white/90">{r.jugador}</p>
                  <p className="truncate text-[11px] text-white/50">
                    {nombres.get(r.teamId) ?? ""}
                    {r.penaltis ? ` · ${r.penaltis} de penalti` : ""}
                  </p>
                </td>
                <td className="py-1.5 pr-3 text-right text-white/80">{r.goles}</td>
                <td className="py-1.5 pr-3 text-right text-[13px] font-semibold text-white">{r.puntos}</td>
                <td className="py-1.5 pr-3 text-right text-white/80">{r.decisivos}</td>
                {MOMENTOS.map((m) => (
                  <td key={m} className="py-1.5 pr-3 text-right text-white/70">
                    {r.momentos[m] || ""}
                  </td>
                ))}
                <td className="py-1.5 pr-2 text-right text-white/80">{pct(r.pctDecisivos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/45">
        Ordenado por puntos; a igualdad, por goles decisivos.
        {nuestrosFuera.length ? " Debajo de la raya, los del Castilla que no entran en el corte." : ""}
        {partidosMal > 0 &&
          ` En ${partidosMal} ${partidosMal === 1 ? "partido" : "partidos"} los remates no suman el resultado: ${enPropia === 1 ? "es un gol" : `son ${enPropia} goles`} en propia puerta, que Opta no da como remate y no se le cuentan a nadie. Ahí el resultado final (y los puntos) sale de la tabla de partidos, y el marcador previo de sus ${cuadre.inciertos} goles se ajusta con el estado del partido que da Opta (ganando, empatando o perdiendo): en alguno, «para empatar» y «para recortar» pueden cruzarse.`}
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  DESDE EL BANQUILLO                                                 */
/* ------------------------------------------------------------------ */

type ColSup = "partidosSup" | "minSup" | "golesSup" | "tirosSup" | "xgSup" | "g90Sup" | "g90Tit";

const COLUMNAS: { k: ColSup; texto: string; titulo: string }[] = [
  { k: "partidosSup", texto: "PJ sup.", titulo: "Partidos saliendo desde el banquillo" },
  { k: "minSup", texto: "Min sup.", titulo: "Minutos jugados saliendo desde el banquillo" },
  { k: "golesSup", texto: "Goles", titulo: "Goles saliendo desde el banquillo" },
  { k: "tirosSup", texto: "Remates", titulo: "Remates (con los bloqueados) saliendo desde el banquillo" },
  { k: "xgSup", texto: "xG", titulo: "Goles esperados saliendo desde el banquillo" },
  { k: "g90Sup", texto: "Goles/90 sup.", titulo: "Goles por 90 de suplente (con 90′ o más en ese papel)" },
  { k: "g90Tit", texto: "Goles/90 tit.", titulo: "Goles por 90 de titular (con 90′ o más en ese papel)" },
];

function DesdeElBanquillo({ datos, ambito, nombres }: { datos: DatosOpta; ambito: Ambito; nombres: Map<string, string> }) {
  const { docs, cargando } = useDocsOpta<[TablaOpta]>(DOCS_OPTA.jugadoresPartidos);
  const [orden, setOrden] = useState<{ col: ColSup; desc: boolean }>({ col: "golesSup", desc: true });
  const [cuantos, setCuantos] = useState<Cuantos>("25");
  const [solo, setSolo] = useState(false);

  const todos = useMemo(() => desdeElBanquillo(aObjetos(docs[0])), [docs]);
  const lista = useMemo(() => {
    const v = (s: Suplente, c: ColSup) => s[c];
    return todos
      .filter((s) => enAmbito(s.teamId, datos.grupos, ambito) && (!solo || s.teamId === CASTILLA_OPTA))
      .sort((a, b) => {
        const x = v(a, orden.col);
        const y = v(b, orden.col);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (orden.desc ? y - x : x - y) || b.golesSup - a.golesSup || b.xgSup - a.xgSup;
      });
  }, [todos, datos.grupos, ambito, solo, orden]);

  if (cargando) return <Cargando que="los partidos de cada jugador" />;
  if (!docs[0]) return null;

  const vistos = recorta(lista, cuantos);
  const nuestrosFuera = cuantos === "todos" || solo ? [] : lista.map((s, i) => ({ s, i })).filter(({ s, i }) => s.teamId === CASTILLA_OPTA && i >= vistos.length);
  const pulsa = (col: ColSup) => setOrden((o) => (o.col === col ? { col, desc: !o.desc } : { col, desc: true }));

  return (
    <Panel
      titulo="Desde el banquillo"
      subtitulo="Lo que hace cada uno cuando sale de suplente, y su gol por 90 de titular al lado. El gol por 90 sólo se da con 90′ o más en ese papel. Pulsa una cabecera para ordenar."
      derecha={
        <>
          <SoloCastilla valor={solo} alCambiar={setSolo} />
          <Botonera etiqueta="Cuántos" valor={cuantos} opciones={[...CUANTOS]} alCambiar={setCuantos} />
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[12px] tabular-nums">
          <thead>
            <tr className="border-b border-white/10 text-[11px] text-white/55">
              <th className="w-8 py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-3 font-semibold">Jugador</th>
              {COLUMNAS.map((c) => (
                <th key={c.k} className="py-2 pr-3 text-right font-semibold">
                  <button type="button" onClick={() => pulsa(c.k)} title={c.titulo} className={`inline-flex items-center gap-0.5 hover:text-white ${orden.col === c.k ? "text-white" : ""}`}>
                    {c.texto}
                    {orden.col === c.k && (orden.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...vistos.map((s, i) => ({ s, i })), ...nuestrosFuera].map(({ s, i }, k) => (
              <tr
                key={s.id}
                className={`border-b border-white/[0.06] ${k === vistos.length ? "border-t-2 border-t-white/15" : ""}`}
                style={s.teamId === CASTILLA_OPTA ? FONDO_NUESTRO : undefined}
              >
                <td className="py-1.5 pr-2 text-white/55">{i + 1}</td>
                <td className="max-w-[220px] py-1.5 pr-3">
                  <p className="truncate font-semibold text-white/90">{s.jugador}</p>
                  <p className="truncate text-[11px] text-white/50">{nombres.get(s.teamId) ?? ""}</p>
                </td>
                <td className="py-1.5 pr-3 text-right text-white/70">{s.partidosSup}</td>
                <td className="py-1.5 pr-3 text-right text-white/70">{s.minSup}</td>
                <td className={`py-1.5 pr-3 text-right ${orden.col === "golesSup" ? "font-semibold text-white" : "text-white/80"}`}>{s.golesSup}</td>
                <td className="py-1.5 pr-3 text-right text-white/70">{s.tirosSup}</td>
                <td className="py-1.5 pr-3 text-right text-white/70">{dec(s.xgSup)}</td>
                <td className={`py-1.5 pr-3 text-right ${orden.col === "g90Sup" ? "font-semibold text-white" : "text-white/80"}`}>{dec(s.g90Sup)}</td>
                <td className="py-1.5 pr-3 text-right text-white/60">{dec(s.g90Tit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nuestrosFuera.length > 0 && <p className="mt-2 text-[11px] text-white/45">Debajo de la raya, los del Castilla que no entran en el corte.</p>}
    </Panel>
  );
}

export function MomentosGol({ datos, ambito }: { datos: DatosOpta; ambito: Ambito }) {
  const nombres = useMemo(() => new Map(equiposDe(datos).map((e) => [e.teamId, e.equipo])), [datos]);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Momentos del gol</h2>
        <p className="mt-0.5 text-xs text-white/55">Cuándo marca cada uno y qué le da a su equipo. Los goles se cuentan tal cual: son pocos para pasarlos a percentil.</p>
      </div>
      <GolesQueValen datos={datos} ambito={ambito} nombres={nombres} />
      <DesdeElBanquillo datos={datos} ambito={ambito} nombres={nombres} />
    </div>
  );
}
