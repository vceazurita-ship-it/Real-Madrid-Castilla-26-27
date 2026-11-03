"use client";

/*
|--------------------------------------------------------------------------
| LA PESTAÑA «ANÁLISIS TÉCNICO» DE /analisis-goles (03/11/2026)
|--------------------------------------------------------------------------
|
| Los goles del Castilla leídos desde nosotros, con las fichas de «Gol a
| gol» sumadas (`lib/goles/tecnico-analisis.ts`). El eje: nuestra fase × el
| campo desde el que arranca, y el tipo de acción. Alrededor: el origen, lo
| que falla o se repite, los jugadores, el ritmo y dónde nacen en el campo.
| En contra primero (lo que concedemos) y a favor después (lo que hacemos).
| Lo que no está en ninguna ficha no se pinta.
*/

import { useState, type ReactNode } from "react";
import { ClipboardCheck, MapPin, ShieldAlert, Swords } from "lucide-react";

import { Notice, Panel, Segmented, StatCard, StatRow } from "@/components/abp/ui";
import { CampoZonas, type PuntoCampo } from "@/components/campo/CampoZonas";
import { Lectura } from "@/components/data/formas";
import { fmt } from "@/lib/goles/analisis";
import { FASES_NUESTRAS, nombreCelda } from "@/lib/goles/tecnico";
import { lecturaTecnicaContra, lecturaTecnicaFavor, type Conteo, type GolTecnico, type LadoTecnico, type ResumenTecnico } from "@/lib/goles/tecnico-analisis";

/* El campo es oscuro en los dos temas (components/campo): los puntos llevan su color fijo. */
const PUNTO_FAVOR = "#C8A96B";
const PUNTO_CONTRA = "#D95F02";

const TERCIOS = ["Nuestro tercio", "Zona media", "Su tercio"];
const CARRILES = ["Izquierda", "Centro", "Derecha"];

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)} %` : "");

function Bloque({ titulo, base, children }: { titulo: string; base?: number; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {titulo}
        {base ? <span className="ml-1.5 font-normal normal-case tracking-normal text-white/35">sobre {base === 1 ? "1 gol" : `${base} goles`}</span> : null}
      </p>
      {children}
    </div>
  );
}

/** Barras horizontales: el nombre, la barra y la cifra con su porcentaje. */
function Barras({ filas, base, color }: { filas: Conteo[]; base: number; color: string }) {
  const max = Math.max(1, ...filas.map((f) => f.n));

  return (
    <ul className="space-y-1.5">
      {filas.map((f) => (
        <li key={f.clave} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-[12px] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]">
          <span className="min-w-0 truncate text-white/75" title={f.nombre}>
            {f.nombre}
          </span>
          <span className="col-span-2 row-start-2 h-2 min-w-0 rounded-full bg-white/[0.06] sm:col-span-1 sm:row-start-auto">
            <span className="block h-2 rounded-full" style={{ width: `${(f.n / max) * 100}%`, backgroundColor: color }} />
          </span>
          <span className="tabular-nums text-white/85">
            {f.n} <span className="text-white/40">· {pct(f.n, base)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** El cruce de nuestra fase con el campo desde el que arranca: cada celda, cuántos goles. */
function Cruce({ lado, bando }: { lado: LadoTecnico; bando: "favor" | "contra" }) {
  const filas = FASES_NUESTRAS[bando]
    .map((f) => ({
      fase: f,
      propio: lado.cruce.find((c) => c.fase === f.clave && c.campo === "propio")?.n ?? 0,
      contrario: lado.cruce.find((c) => c.fase === f.clave && c.campo === "contrario")?.n ?? 0,
      total: lado.fases.find((c) => c.clave === f.clave)?.n ?? 0,
    }))
    .filter((f) => f.total > 0);
  const max = Math.max(0, ...lado.cruce.map((c) => c.n));
  const celda = (n: number) => (
    <td className={`px-2 py-1.5 text-right tabular-nums ${n && n === max ? "rounded-md bg-[#C8A96B]/15 font-semibold text-[#C8A96B]" : "text-white/80"}`}>{n || ""}</td>
  );

  if (!filas.length) return null;

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.12em] text-white/40">
            <th className="px-2 py-1.5 text-left font-medium">Fase</th>
            <th className="px-2 py-1.5 text-right font-medium">Campo propio</th>
            <th className="px-2 py-1.5 text-right font-medium">Campo contrario</th>
            <th className="px-2 py-1.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.fase.clave} className="border-b border-white/[0.06] last:border-0">
              <td className="px-2 py-1.5 text-white/75">{f.fase.nombre}</td>
              {celda(f.propio)}
              {celda(f.contrario)}
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-white">{f.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Los jugadores que más salen en un papel. */
function Nombres({ titulo, lista }: { titulo: string; lista?: Conteo[] }) {
  if (!lista?.length) return null;

  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-semibold text-white/60">{titulo}</p>
      <ul className="space-y-0.5">
        {lista.slice(0, 4).map((x) => (
          <li key={x.clave} className="flex min-w-0 justify-between gap-2 text-[12px]">
            <span className="min-w-0 truncate text-white/75">{x.clave}</span>
            <span className="tabular-nums text-white/85">{x.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Lado({ lado, aFavor, color }: { lado: LadoTecnico; aFavor: boolean; color: string }) {
  const bando = aFavor ? "favor" : "contra";
  const frases = aFavor ? lecturaTecnicaFavor(lado) : lecturaTecnicaContra(lado);
  const ritmo = [
    !aFavor && lado.segundosPerdida ? { k: "De nuestra pérdida al gol", v: `${fmt(lado.segundosPerdida.media, 0)} s`, n: lado.segundosPerdida.n } : null,
    lado.segundos ? { k: "Del origen al gol", v: `${fmt(lado.segundos.media, 0)} s`, n: lado.segundos.n } : null,
    lado.pases ? { k: "Pases de la jugada", v: fmt(lado.pases.media, 1), n: lado.pases.n } : null,
  ].filter((x): x is { k: string; v: string; n: number } => x !== null);
  const conJugadores = aFavor ? Boolean(lado.papeles.recupera?.length || lado.papeles.asiste?.length || lado.papeles.remata?.length) : Boolean(lado.papeles.pierde?.length || lado.papeles.duelo?.length);

  if (!lado.total) return null;

  return (
    <Panel
      title={aFavor ? "Lo que hacemos: nuestros goles" : "Lo que concedemos: los goles que encajamos"}
      subtitle={`${lado.total} ${lado.total === 1 ? "gol" : "goles"} · ${lado.conFicha} con ficha · ${lado.revisados} revisados en vídeo`}
      icon={aFavor ? Swords : ShieldAlert}
      analisis={frases.length ? <div className="px-4 pb-4 sm:px-5"><Lectura>{frases.join(" ")}</Lectura></div> : undefined}
    >
      <div className="min-w-0 space-y-5">
        {lado.fases.length ? (
          <Bloque titulo="Nuestra fase y desde dónde arranca" base={lado.baseFases}>
            <Cruce lado={lado} bando={bando} />
          </Bloque>
        ) : null}
        {lado.acciones.length ? (
          <Bloque titulo="Tipo de acción" base={lado.baseAcciones}>
            <Barras filas={lado.acciones} base={lado.baseAcciones} color={color} />
          </Bloque>
        ) : null}
        {lado.origenes.length ? (
          <Bloque titulo={aFavor ? "Dónde robamos o arrancamos" : "Dónde perdimos el balón o cómo arranca"} base={lado.baseOrigenes}>
            <Barras filas={lado.origenes} base={lado.baseOrigenes} color={color} />
          </Bloque>
        ) : null}
        {lado.motivos.length ? (
          <Bloque titulo={aFavor ? "Lo que más se repite" : "Lo que más nos falla"} base={lado.baseMotivos}>
            <Barras filas={lado.motivos} base={lado.baseMotivos} color={color} />
          </Bloque>
        ) : null}
        {conJugadores ? (
          <Bloque titulo={aFavor ? "La cadena: quién recupera, asiste y remata" : "Los nuestros en las pérdidas y duelos"}>
            <div className="grid min-w-0 gap-4 sm:grid-cols-3">
              {aFavor ? (
                <>
                  <Nombres titulo="Recupera" lista={lado.papeles.recupera} />
                  <Nombres titulo="Asiste" lista={lado.papeles.asiste} />
                  <Nombres titulo="Remata" lista={lado.papeles.remata} />
                </>
              ) : (
                <>
                  <Nombres titulo="Pierde el balón" lista={lado.papeles.pierde} />
                  <Nombres titulo="Duelo perdido" lista={lado.papeles.duelo} />
                </>
              )}
            </div>
          </Bloque>
        ) : null}
        {ritmo.length ? (
          <div className="flex min-w-0 flex-wrap gap-2">
            {ritmo.map((r) => (
              <span key={r.k} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/60">
                {r.k}: <span className="font-semibold tabular-nums text-white">{r.v}</span> <span className="text-white/40">({r.n === 1 ? "1 gol" : `${r.n} goles`})</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

type QueVer = "contra" | "favor" | "todos";

export function AnalisisTecnico({ resumen, goles, onIrAGolAGol }: { resumen: ResumenTecnico; goles: GolTecnico[]; onIrAGolAGol: () => void }) {
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [queVer, setQueVer] = useState<QueVer>("contra");
  const { favor, contra } = resumen;
  const total = favor.total + contra.total;
  const conFicha = favor.conFicha + contra.conFicha;
  const revisados = favor.revisados + contra.revisados;

  const puntos: PuntoCampo[] = goles
    .filter((g) => g.ficha.zonaOrigen && (queVer === "todos" || (queVer === "favor") === g.aFavor))
    .map((g) => ({
      id: g.clave,
      zona: TERCIOS[g.ficha.zonaOrigen!.tercio],
      carril: CARRILES[g.ficha.zonaOrigen!.carril],
      color: g.aFavor ? PUNTO_FAVOR : PUNTO_CONTRA,
      titulo: `${g.aFavor ? "A favor" : "En contra"}${g.jugador ? ` · ${g.jugador}` : ""} · ${nombreCelda(g.ficha.zonaOrigen!)}`,
    }));
  const hayZonas = goles.some((g) => g.ficha.zonaOrigen);

  if (!total) return null;

  return (
    <div className="min-w-0 space-y-5">
      <StatRow>
        <StatCard label="Goles con ficha" value={`${conFicha} de ${total}`} hint={`${contra.conFicha} en contra · ${favor.conFicha} a favor`} />
        <StatCard label="Revisados en vídeo" value={`${revisados} de ${total}`} hint={revisados < total ? "se marcan en la ficha de cada gol" : "todos revisados"} accent={revisados === total ? "var(--rmcf-gold-ink)" : undefined} />
        {contra.segundosPerdida ? <StatCard label="De pérdida a gol" value={`${fmt(contra.segundosPerdida.media, 0)} s`} hint={`media de ${contra.segundosPerdida.n} ${contra.segundosPerdida.n === 1 ? "gol en contra" : "goles en contra"}`} accent={PUNTO_CONTRA} /> : null}
        {favor.segundos ? <StatCard label="Del robo o inicio al gol" value={`${fmt(favor.segundos.media, 0)} s`} hint={`media de ${favor.segundos.n} ${favor.segundos.n === 1 ? "gol nuestro" : "goles nuestros"}`} accent="var(--rmcf-gold-ink)" /> : null}
        {favor.pases ? <StatCard label="Pases en nuestros goles" value={fmt(favor.pases.media, 1)} hint={`media de ${favor.pases.n} ${favor.pases.n === 1 ? "gol" : "goles"}`} /> : null}
      </StatRow>

      {conFicha === 0 ? (
        <Notice tone="info" title="Las fichas técnicas se rellenan en Gol a gol">
          Cada gol tiene su ficha: nuestra fase, desde qué campo arranca, el tipo de acción y quién interviene.{" "}
          <button type="button" onClick={onIrAGolAGol} className="font-semibold text-[#C8A96B] underline underline-offset-2">
            Ir a Gol a gol
          </button>
        </Notice>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Lado lado={contra} aFavor={false} color={PUNTO_CONTRA} />
        <Lado lado={favor} aFavor color="var(--rmcf-gold-ink)" />
      </div>

      {hayZonas ? (
        <Panel
          title="Dónde nacen los goles"
          subtitle="Nuestra pérdida o su inicio en los que encajamos; el robo o el inicio en los nuestros. Atacamos hacia la derecha."
          icon={MapPin}
          action={
            <Segmented<QueVer>
              ariaLabel="Qué goles se ven en el campo"
              value={queVer}
              onChange={setQueVer}
              options={[
                { key: "contra", label: "En contra" },
                { key: "favor", label: "A favor" },
                { key: "todos", label: "Todos" },
              ]}
            />
          }
        >
          <CampoZonas
            puntos={puntos}
            zonas={TERCIOS}
            carriles={CARRILES}
            resaltado={resaltado}
            onResaltar={setResaltado}
            unidad={{ una: "gol", varias: "goles" }}
            ariaLabel="Dónde nacen los goles del Castilla"
            leyenda={
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PUNTO_CONTRA }} /> En contra
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PUNTO_FAVOR }} /> A favor
                </span>
              </>
            }
          />
        </Panel>
      ) : null}

      <p className="flex items-center gap-1.5 text-[11px] text-white/40">
        <ClipboardCheck size={13} aria-hidden /> Cada cifra cuenta sólo los goles que tienen ese dato en su ficha.
      </p>
    </div>
  );
}
