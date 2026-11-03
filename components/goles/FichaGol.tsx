"use client";

/*
|--------------------------------------------------------------------------
| LA FICHA TÉCNICA DE UN GOL, DESDE EL CASTILLA (03/11/2026)
|--------------------------------------------------------------------------
|
| Lo que hicimos nosotros en ese gol. Arriba del todo, el eje que pidió el
| analista: la fase nuestra, el campo desde el que arranca esa fase y el tipo
| de acción que acaba en gol. Debajo, dónde nace la jugada (origen, zona en un
| campo de 3×3, carril, segundos y pases), quién de los nuestros interviene,
| qué hicimos bien o qué falló, la lectura técnica y la consigna para el
| entrenamiento.
|
| Lo de Hudl (`FichaAuto`) llega ya puesto; lo que se toca aquí se guarda en
| `goles:tecnico-manual` y manda campo a campo (`fichaDe`). Cada dato que
| viene de Hudl sin tocar lleva la marca «Hudl», sólo con los textos
| explicativos encendidos. Sin ficha de Hudl, la ficha sale igual para
| rellenarla a mano. Se guarda sola (useRemoteDoc).
*/

import { type ReactNode } from "react";
import { CircleCheck, Film, Plus, X } from "lucide-react";

import { TextArea } from "@/components/abp/ui";
import {
  ACCIONES,
  CAMPOS,
  CAUSAS_CONTRA,
  CLAVES_FAVOR,
  FASES_NUESTRAS,
  ORIGENES,
  nombreCelda,
  type Celda,
  type FichaAuto,
  type FichaManual,
  type FichaTecnica,
  type Implicado,
} from "@/lib/goles/tecnico";
import { ACCIONES_IMPLICADO } from "@/lib/goles/tecnico-analisis";

export type CambiaFicha = <K extends keyof FichaManual>(campo: K, valor: FichaManual[K] | undefined) => void;

const CARRILES = ["Izquierda", "Centro", "Derecha"] as const;

/* ------------------------------------------------------------------ */
/*  Piezas                                                             */
/* ------------------------------------------------------------------ */

function Rotulo({ children, hudl }: { children: ReactNode; hudl?: boolean }) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
      {children}
      {hudl ? (
        <span className="rounded border border-white/10 px-1 py-px text-[9px] font-semibold normal-case tracking-normal text-white/45" title="Sale del timeline de Hudl; si lo cambias, manda lo tuyo">
          Hudl
        </span>
      ) : null}
    </p>
  );
}

/** Un botón que se enciende y se apaga. */
export function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition sm:py-1 ${activo ? "border-[#C8A96B]/50 bg-[#C8A96B]/15 font-medium text-[#C8A96B]" : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
    >
      {children}
    </button>
  );
}

/**
 * El campo de 3×3 en pequeño, en la referencia del Castilla: nuestra
 * portería a la izquierda, atacamos hacia la derecha; el carril izquierdo es
 * el de arriba. La casilla elegida se pinta en oro; el carril de llegada, con
 * un trazo en su tercio. Con `onElige`, cada casilla se pincha.
 */
export function MiniCampo({ zona, carril, onElige, etiqueta }: { zona?: Celda; carril?: number; onElige?: (c: Celda) => void; etiqueta: string }) {
  const W = 105;
  const H = 68;

  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} className="block h-auto w-full max-w-[280px] text-white/40" role="img" aria-label={etiqueta}>
      <rect x={0} y={0} width={W} height={H} rx={2} fill="currentColor" fillOpacity={0.06} />
      {[0, 1, 2].map((t) =>
        [0, 1, 2].map((c) => {
          const elegida = zona?.tercio === t && zona?.carril === c;

          return (
            <rect
              key={`${t}${c}`}
              x={(W / 3) * t}
              y={(H / 3) * c}
              width={W / 3}
              height={H / 3}
              style={{ fill: elegida ? "var(--rmcf-gold-ink)" : "transparent", fillOpacity: elegida ? 0.45 : 0, cursor: onElige ? "pointer" : undefined }}
              role={onElige ? "button" : undefined}
              tabIndex={onElige ? 0 : undefined}
              aria-label={onElige ? nombreCelda({ tercio: t as 0 | 1 | 2, carril: c as 0 | 1 | 2 }) : undefined}
              aria-pressed={onElige ? elegida : undefined}
              onClick={onElige ? () => onElige({ tercio: t as 0 | 1 | 2, carril: c as 0 | 1 | 2 }) : undefined}
              onKeyDown={
                onElige
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onElige({ tercio: t as 0 | 1 | 2, carril: c as 0 | 1 | 2 });
                      }
                    }
                  : undefined
              }
            >
              <title>{nombreCelda({ tercio: t as 0 | 1 | 2, carril: c as 0 | 1 | 2 })}</title>
            </rect>
          );
        }),
      )}
      <g fill="none" stroke="currentColor" strokeWidth={0.6} style={{ pointerEvents: "none" }}>
        <rect x={0} y={0} width={W} height={H} rx={2} />
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} />
        <circle cx={W / 2} cy={H / 2} r={9.15} />
        <rect x={0} y={H / 2 - 20.15} width={16.5} height={40.3} />
        <rect x={W - 16.5} y={H / 2 - 20.15} width={16.5} height={40.3} />
        <rect x={0} y={H / 2 - 9.15} width={5.5} height={18.3} />
        <rect x={W - 5.5} y={H / 2 - 9.15} width={5.5} height={18.3} />
      </g>
      <g stroke="currentColor" strokeOpacity={0.6} strokeWidth={0.4} strokeDasharray="1.5 1.5" style={{ pointerEvents: "none" }}>
        <line x1={W / 3} y1={0} x2={W / 3} y2={H} />
        <line x1={(W / 3) * 2} y1={0} x2={(W / 3) * 2} y2={H} />
        <line x1={0} y1={H / 3} x2={W} y2={H / 3} />
        <line x1={0} y1={(H / 3) * 2} x2={W} y2={(H / 3) * 2} />
      </g>
      {carril !== undefined ? (
        <line
          x1={(W / 3) * 2 + 3}
          x2={W - 18}
          y1={(H / 3) * (carril + 0.5)}
          y2={(H / 3) * (carril + 0.5)}
          strokeWidth={2}
          strokeLinecap="round"
          style={{ stroke: "var(--rmcf-gold-ink)", pointerEvents: "none" }}
        />
      ) : null}
    </svg>
  );
}

const esYoutube = (u: string) => /youtu\.?be/.test(u);

/* ------------------------------------------------------------------ */
/*  La ficha                                                           */
/* ------------------------------------------------------------------ */

export function FichaGol({
  aFavor,
  ficha,
  onCambia,
  explicativos,
  tipologia,
  nombres,
}: {
  aFavor: boolean;
  ficha: FichaTecnica;
  onCambia: CambiaFicha;
  explicativos: boolean;
  /** El selector de la tipología (cómo llega), que vive en la pantalla. */
  tipologia?: ReactNode;
  /** Nombres de los nuestros para sugerir al escribir un implicado. */
  nombres: string[];
}) {
  const bando = aFavor ? "favor" : "contra";
  const hudl = (k: keyof FichaAuto) => explicativos && ficha.deHudl.includes(k);
  const unico = <K extends "fase" | "campo" | "accion" | "origen">(k: K, v: FichaManual[K]) => onCambia(k, ficha[k] === v ? undefined : v);
  const motivos = aFavor ? CLAVES_FAVOR : CAUSAS_CONTRA;
  const elegidos = ((aFavor ? ficha.claves : ficha.causas) ?? []) as string[];
  const implicados = ficha.implicados ?? [];
  const idLista = `nombres-${aFavor ? "f" : "c"}`;

  const cambiaImplicados = (lista: Implicado[]) => onCambia("implicados", lista);
  const numero = (k: "segundos" | "pases", texto: string) => {
    const n = Number(texto.replace(",", "."));

    onCambia(k, texto.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : n);
  };

  return (
    <div className="min-w-0 space-y-5">
      {ficha.video ? (
        <div className="min-w-0">
          {esYoutube(ficha.video) ? (
            <a href={ficha.video} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:text-white">
              <Film size={15} className="text-[#C8A96B]" /> Ver el vídeo del gol
            </a>
          ) : (
            <video src={ficha.video} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black" />
          )}
        </div>
      ) : null}

      {/* ---------------- el eje: fase, campo y acción ---------------- */}
      <section className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div>
          <Rotulo hudl={hudl("fase")}>Nuestra fase</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {FASES_NUESTRAS[bando].map((f) => (
              <Chip key={f.clave} activo={ficha.fase === f.clave} onClick={() => unico("fase", f.clave)}>
                {f.nombre}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <Rotulo hudl={hudl("campo")}>Desde dónde arranca la fase</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {CAMPOS.map((c) => (
              <Chip key={c.clave} activo={ficha.campo === c.clave} onClick={() => unico("campo", c.clave)}>
                {c.nombre}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <Rotulo hudl={hudl("accion")}>Tipo de acción</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {ACCIONES.map((a) => (
              <Chip key={a.clave} activo={ficha.accion === a.clave} onClick={() => unico("accion", a.clave)}>
                {a.nombre}
              </Chip>
            ))}
          </div>
        </div>
        {tipologia ? (
          <div className="max-w-sm">
            <Rotulo>Cómo llega (tipología)</Rotulo>
            {tipologia}
          </div>
        ) : null}
      </section>

      {/* ---------------- cómo nace ---------------- */}
      <section className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
        <div className="min-w-0 space-y-3">
          <div>
            <Rotulo hudl={hudl("origen")}>{aFavor ? "Dónde nace (robo o inicio)" : "Dónde nace (nuestra pérdida o su inicio)"}</Rotulo>
            <div className="flex flex-wrap gap-1.5">
              {ORIGENES[bando].map((o) => (
                <Chip key={o.clave} activo={ficha.origen === o.clave} onClick={() => unico("origen", o.clave)}>
                  {o.nombre}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <Rotulo hudl={hudl("segundos")}>Segundos al gol</Rotulo>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={ficha.segundos ?? ""}
                onChange={(e) => numero("segundos", e.target.value)}
                className="w-24 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white outline-none focus:border-[#C8A96B]/50"
              />
            </label>
            <label className="block">
              <Rotulo hudl={hudl("pases")}>Pases</Rotulo>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={ficha.pases ?? ""}
                onChange={(e) => numero("pases", e.target.value)}
                className="w-24 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white outline-none focus:border-[#C8A96B]/50"
              />
            </label>
          </div>
          <div>
            <Rotulo hudl={hudl("carril")}>Carril por el que llega al área</Rotulo>
            <div className="flex flex-wrap gap-1.5">
              {CARRILES.map((c, i) => (
                <Chip key={c} activo={ficha.carril === i} onClick={() => onCambia("carril", ficha.carril === i ? undefined : (i as 0 | 1 | 2))}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <Rotulo hudl={hudl("zonaOrigen")}>Zona donde nace</Rotulo>
          <MiniCampo
            zona={ficha.zonaOrigen}
            carril={ficha.carril}
            etiqueta="Zona donde nace la jugada: pincha una casilla"
            onElige={(c) => onCambia("zonaOrigen", ficha.zonaOrigen?.tercio === c.tercio && ficha.zonaOrigen?.carril === c.carril ? undefined : c)}
          />
          <p className="mt-1 text-[11px] text-white/45">{ficha.zonaOrigen ? nombreCelda(ficha.zonaOrigen) : "Nuestra portería a la izquierda; atacamos hacia la derecha."}</p>
        </div>
      </section>

      {/* ---------------- los nuestros ---------------- */}
      <section className="min-w-0">
        <Rotulo hudl={hudl("implicados")}>Los nuestros que intervienen</Rotulo>
        <datalist id={idLista}>
          {nombres.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <ul className="space-y-1.5">
          {implicados.map((i, n) => (
            <li key={n} className="flex min-w-0 flex-wrap items-center gap-1.5">
              <input
                value={i.jugador}
                list={idLista}
                placeholder="Jugador"
                aria-label="Jugador"
                onChange={(e) => cambiaImplicados(implicados.map((x, k) => (k === n ? { ...x, jugador: e.target.value } : x)))}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#C8A96B]/50"
              />
              <select
                value={i.accion}
                aria-label="Qué hace"
                onChange={(e) => cambiaImplicados(implicados.map((x, k) => (k === n ? { ...x, accion: e.target.value } : x)))}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8A96B]/50"
              >
                {[...new Set([...ACCIONES_IMPLICADO[bando], ...ACCIONES_IMPLICADO[aFavor ? "contra" : "favor"], i.accion].filter(Boolean))].map((a) => (
                  <option key={a} value={a} className="bg-[#11161C]">
                    {a}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`Quitar a ${i.jugador || "este jugador"}`}
                onClick={() => cambiaImplicados(implicados.filter((_, k) => k !== n))}
                className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => cambiaImplicados([...implicados, { jugador: "", accion: ACCIONES_IMPLICADO[bando][0] }])}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.06] hover:text-white"
        >
          <Plus size={13} /> Añadir jugador
        </button>
      </section>

      {/* ---------------- lo que salió bien o mal ---------------- */}
      <section className="min-w-0">
        <Rotulo>{aFavor ? "Lo que hicimos bien" : "Lo que nos falló"}</Rotulo>
        <div className="flex flex-wrap gap-1.5">
          {motivos.map((m) => {
            const activo = elegidos.includes(m.clave);

            return (
              <Chip
                key={m.clave}
                activo={activo}
                onClick={() => {
                  const lista = activo ? elegidos.filter((x) => x !== m.clave) : [...elegidos, m.clave];

                  if (aFavor) onCambia("claves", lista.length ? (lista as FichaManual["claves"]) : undefined);
                  else onCambia("causas", lista.length ? (lista as FichaManual["causas"]) : undefined);
                }}
              >
                {m.nombre}
              </Chip>
            );
          })}
        </div>
      </section>

      <section className="grid min-w-0 gap-3 md:grid-cols-2">
        <TextArea label="Lectura técnica" value={ficha.lectura ?? ""} onChange={(v) => onCambia("lectura", v.trim() ? v : undefined)} placeholder={aFavor ? "Qué hicimos para llegar al gol" : "Qué hicimos nosotros en el gol que encajamos"} />
        <TextArea label={aFavor ? "Para repetir" : "Para corregir"} value={ficha.consigna ?? ""} onChange={(v) => onCambia("consigna", v.trim() ? v : undefined)} placeholder="Lo que nos llevamos al entrenamiento" />
      </section>

      {explicativos && ficha.motivo ? <p className="text-[11px] leading-relaxed text-white/40">Hudl: {ficha.motivo}</p> : null}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75">
        <input type="checkbox" checked={Boolean(ficha.revisado)} onChange={(e) => onCambia("revisado", e.target.checked ? true : undefined)} className="accent-[#C8A96B]" />
        <CircleCheck size={15} className={ficha.revisado ? "text-[#C8A96B]" : "text-white/35"} />
        Revisado en vídeo
      </label>
    </div>
  );
}
