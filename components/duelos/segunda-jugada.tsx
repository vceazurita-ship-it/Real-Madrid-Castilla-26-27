"use client";

/**
 * SEGUNDA JUGADA (19/11/2026, idea de X). Tras su balón largo, ¿quién se
 * queda el balón? Dos tarjetas: la del rival cuando lanza largo (qué parte
 * se queda, dónde cae el primer toque y sus tres que más la recogen) y la
 * del Castilla cuando defiende balones largos (qué parte ganamos, dónde y
 * quién de los nuestros las recoge).
 *
 * Datos: `opta:directo:archivo` y `opta:directo:<partido>` de los últimos
 * partidos de cada uno, por `useDocsOpta`. Las cuentas, en
 * `lib/duelos-segunda-jugada.ts`. Sin dato no se pinta; nada se pide hasta
 * que asoma.
 */

import { useMemo } from "react";

import { CampoOpta } from "@/components/campo/CampoOpta";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import {
  CX,
  CY,
  esJuegoDirecto,
  LARGO_M,
  MAX_PARTIDOS,
  segundaJugada,
  VENTANA_S,
  ZONA_MC,
  type SegundaJugada as Datos,
} from "@/lib/duelos-segunda-jugada";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { eventos?: TablaOpta; jugadores?: TablaOpta };

const ORO = "#C8A96B";
const NARANJA = "#D95F02";
const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Los nombres cortos de cada lado, para escribir a los de Opta como en el resto de la app. */
type Cortos = { nuestros?: string[]; suyos?: string[] };

const llano = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palabrasDe = (t: string) => llano(t).split(/[\s.-]+/).filter(Boolean);

/*
| «David Flakus Bosilj» → «Flakus», «Oscar Naasei» → «Óscar» (20/11/2026,
| jueces de fútbol): Opta da el nombre de la ficha federativa. Se busca el
| nombre corto de la plantilla cuyas palabras salen todas en el de Opta; si
| casan dos distintos, se deja el de Opta (mejor largo que equivocado).
*/
export function cortoDeOpta(nombre: string, cortos: string[] = []): string {
  const palabras = new Set(palabrasDe(nombre));
  const casan = [...new Set(cortos)].filter((c) => {
    const suyas = palabrasDe(c).filter((w) => w.length >= 2);
    return suyas.length > 0 && suyas.every((w) => palabras.has(w));
  });
  if (!casan.length) return nombre;
  const mejor = Math.max(...casan.map((c) => palabrasDe(c).length));
  const finalistas = casan.filter((c) => palabrasDe(c).length === mejor);
  return finalistas.length === 1 ? finalistas[0] : nombre;
}

export function SegundaJugada({ equipo, cortos = {} }: { equipo: string; cortos?: Cortos }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && equipo && <Indice equipo={equipo} cortos={cortos} />}</div>;
}

function Indice({ equipo, cortos }: { equipo: string; cortos: Cortos }) {
  const { docs } = useDocsOpta<[TablaOpta, Archivo]>(DOCS_OPTA.equipos, "opta:directo:archivo");
  const [tEquipos, archivo] = docs;

  const equipos = useMemo(
    () => (tEquipos ? aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") })) : []),
    [tEquipos],
  );
  const rival = useMemo(() => {
    const id = equipos.length ? casaEquipo(equipo, equipos) : null;
    if (!id || id === CASTILLA_OPTA) return null;
    return { id, nombre: equipos.find((e) => e.teamId === id)?.equipo || equipo };
  }, [equipos, equipo]);
  const castilla = equipos.find((e) => e.teamId === CASTILLA_OPTA)?.equipo ?? "";

  const idsDe = (nombre: string) =>
    !nombre || !Array.isArray(archivo?.partidos)
      ? []
      : archivo.partidos
          .filter((p) => p?.partido && (p.equipos ?? []).includes(nombre))
          .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")))
          .slice(0, MAX_PARTIDOS)
          .map((p) => String(p.partido));

  const idsRival = rival ? idsDe(rival.nombre) : [];
  const idsNuestros = idsDe(castilla);
  if (!rival || (!idsRival.length && !idsNuestros.length)) return null;
  return <Bloque equipo={equipo} teamId={rival.id} idsRival={idsRival} idsNuestros={idsNuestros} cortos={cortos} />;
}

function Bloque({ equipo, teamId, idsRival, idsNuestros, cortos }: { equipo: string; teamId: string; idsRival: string[]; idsNuestros: string[]; cortos: Cortos }) {
  const ids = useMemo(() => [...new Set([...idsRival, ...idsNuestros])], [idsRival, idsNuestros]);
  const { docs } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));

  const { suyo, nuestro } = useMemo(() => {
    const por = new Map<string, { partido: string; eventos: ReturnType<typeof leeEventos>; jugadores: ReturnType<typeof leeJugadores> }>();
    docs.forEach((d, i) => {
      if (!d) return;
      const eventos = leeEventos(d.eventos);
      if (eventos.length) por.set(ids[i], { partido: ids[i], eventos, jugadores: leeJugadores(d.jugadores) });
    });
    const de = (l: string[]) => l.map((id) => por.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    return {
      suyo: segundaJugada(de(idsRival), teamId),
      nuestro: segundaJugada(de(idsNuestros), CASTILLA_OPTA, { contrarios: true, recogeElEquipo: false }),
    };
  }, [docs, ids, idsRival, idsNuestros, teamId]);

  if (!suyo && !nuestro) return null;
  const directo = suyo ? esJuegoDirecto(suyo) : false;

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Segunda jugada · tras el balón largo, ¿quién se queda el balón?</p>
        {suyo && suyo.parteLargosRivales != null && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: `${directo ? NARANJA : "#4C8DCB"}22`, color: directo ? NARANJA : "#4C8DCB" }}
            title={`${pct(suyo.parteLargos)} de sus pases son largos; sus rivales, ${pct(suyo.parteLargosRivales)}`}
          >
            {directo ? `${equipo}: juego directo` : `${equipo}: no es su arma principal`} · {pct(suyo.parteLargos)} de sus pases, largos (sus rivales, {pct(suyo.parteLargosRivales)})
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-white/55">
        Quién toca primero el balón en los {VENTANA_S} s siguientes a cada pase largo; el duelo aéreo es la disputa, cuenta lo que cae después.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        {suyo ? (
          <Tarjeta
            datos={suyo}
            color={NARANJA}
            titulo={`Su balón largo: ${equipo} se queda`}
            cifra={suyo.parte}
            quien="Los suyos que más la recogen"
            cortos={cortos.suyos}
            ejes={`${equipo} lanza hacia la derecha: a la derecha, nuestra portería`}
            zona={
              suyo.enZonaMc
                ? `${pct(suyo.enZonaMc / suyo.conSegunda)} cae en la zona de nuestro mediocentro (pasillo central, entre el medio campo y el área); ahí sus rivales se quedan ${pct(suyo.defensaGanaZonaMc / suyo.enZonaMc)}`
                : null
            }
          />
        ) : (
          <p className="text-xs text-white/45">De {equipo} aún no hay balones largos suficientes en Opta.</p>
        )}
        {nuestro ? (
          <Tarjeta
            datos={nuestro}
            color={ORO}
            titulo="Cuando defendemos el balón largo: el Castilla gana"
            cifra={1 - nuestro.parte}
            quien="Los nuestros que más la recogen"
            cortos={cortos.nuestros}
            ejes="El rival lanza hacia la derecha: a la derecha, nuestra portería"
            zona={
              nuestro.enZonaMc
                ? `${pct(nuestro.enZonaMc / nuestro.conSegunda)} cae en la zona del mediocentro; ahí ganamos ${pct(nuestro.defensaGanaZonaMc / nuestro.enZonaMc)}${nuestro.defensaGanaZonaMc / nuestro.enZonaMc < 0.5 ? ": el mediocentro necesita ayuda en la caída" : ": esa zona es nuestra"}`
                : null
            }
          />
        ) : (
          <p className="text-xs text-white/45">Del Castilla aún no hay balones largos suficientes en Opta.</p>
        )}
      </div>

      <p className="mt-3 text-xs text-white/45">
        Opta, evento a evento de los últimos {MAX_PARTIDOS} partidos de cada uno. Balón largo: pase en juego o saque de puerta de {LARGO_M} m o más hacia delante (sin saques de banda). Si antes hay falta o no se toca en {VENTANA_S} s, no entra. Mapa: casillas de {Math.round(105 / CX)} × {Math.round(68 / CY)} m, del primer toque.
      </p>
    </div>
  );
}

function Tarjeta({
  datos,
  color,
  titulo,
  cifra,
  quien,
  ejes,
  zona,
  cortos,
}: {
  cortos?: string[];
  datos: Datos;
  color: string;
  titulo: string;
  cifra: number;
  quien: string;
  ejes: string;
  zona: string | null;
}) {
  const w = 1050 / CX;
  const h = 680 / CY;
  return (
    <div className="min-w-0 rounded-xl border p-3" style={{ borderColor: `${color}55`, background: `${color}0d` }}>
      <p className="text-[12px] font-semibold text-white/80">{titulo}</p>
      <p className="fuente-club mt-1 text-[26px] font-bold uppercase leading-tight" style={{ color }}>
        {pct(cifra)} <span className="text-sm font-normal normal-case text-white/55">de {datos.conSegunda} segundas jugadas</span>
      </p>
      {/* Barra: la parte de cada uno, con la raya de la mitad. */}
      <div className="relative mt-1 flex h-2.5 w-full overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${pct(cifra)} de las segundas jugadas`}>
        <div style={{ width: `${cifra * 100}%`, background: color }} />
        <span className="absolute -bottom-0.5 -top-0.5 left-1/2 w-0.5 bg-white/60" aria-hidden />
      </div>

      <CampoOpta ariaLabel={`Mapa de calor del primer toque tras el balón largo. ${ejes}`} className="mt-3 w-full" maxAlto={220}>
        {() => (
          <g>
            {datos.malla.map((n, k) =>
              n > 0 ? (
                <rect
                  key={k}
                  x={(k % CX) * w}
                  y={(CY - 1 - Math.floor(k / CX)) * h}
                  width={w}
                  height={h}
                  fill={color}
                  fillOpacity={0.12 + 0.73 * (n / (datos.max || 1))}
                >
                  <title>{`${n} primeros toques`}</title>
                </rect>
              ) : null,
            )}
            {/* La zona del mediocentro de quien defiende. */}
            <rect
              x={(ZONA_MC.x0 / 100) * 1050}
              y={((100 - ZONA_MC.y1) / 100) * 680}
              width={((ZONA_MC.x1 - ZONA_MC.x0) / 100) * 1050}
              height={((ZONA_MC.y1 - ZONA_MC.y0) / 100) * 680}
              fill="none"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth={4}
              strokeDasharray="14 10"
            />
          </g>
        )}
      </CampoOpta>
      {/* Leyenda de la escala (20/11/2026, jueces de análisis): cuánto vale la casilla más intensa. */}
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/60">
        <span>{ejes}. Discontinua: zona del mediocentro.</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-12 rounded-sm" style={{ background: `linear-gradient(90deg, ${color}20, ${color}d9)` }} aria-hidden />
          de 1 a {datos.max} primeros toques por casilla
        </span>
      </p>
      {zona && <p className="mt-2 text-xs leading-relaxed text-white/70">{zona}.</p>}

      {datos.recogen.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-white/55">{quien}</p>
          <ol className="mt-1 space-y-0.5 text-sm">
            {datos.recogen.map((r, i) => (
              <li key={r.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-white/85">
                  {i + 1}. {cortoDeOpta(r.nombre, cortos)}
                </span>
                <b className="shrink-0 tabular-nums" style={{ color }}>
                  {r.veces}
                </b>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="mt-2 text-[11px] text-white/45">
        {datos.largos} balones largos en {datos.partidos} {datos.partidos === 1 ? "partido" : "partidos"}; {datos.conSegunda} con segunda jugada.
      </p>
    </div>
  );
}
