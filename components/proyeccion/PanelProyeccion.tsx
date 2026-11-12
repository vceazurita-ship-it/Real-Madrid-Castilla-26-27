"use client";

/**
 * «PROYECCIÓN DE LA JORNADA» (12/11/2026).
 *
 * Un panel para el balón parado (/scout-rival-abp, pestaña propia) y otro para
 * el juego (/match-preparation, debajo del contexto del partido). Lee
 * `/api/proyeccion` (sólo lectura) y enseña: cifras con su intervalo frente a
 * la media del grupo, el porqué, los puntos fuertes y débiles cruzados, dónde
 * hay más ventaja con su consigna y, plegado, cómo se cuenta. Si el partido ya
 * se jugó y Opta lo tiene, lo proyectado al lado de lo real.
 *
 * Lo que no tiene dato no sale (informes sin huecos). El fetch va dentro del
 * efecto con su bandera, como `useRemoteDoc` (regla de pureza de React 19).
 */

import { useEffect, useState, type ReactNode } from "react";
import { Crosshair, Lightbulb, ShieldAlert, Sparkles, Swords, TrendingUp } from "lucide-react";

import { diaLargoDelCalendario, horaDelCalendarioLocal } from "@/lib/castilla/calendario";
import { COMO_SE_CUENTA_ABP, dentroDelRango, type ProyeccionAbp } from "@/lib/proyeccion/abp";
import { coma, pct, rango, type Proyeccion } from "@/lib/proyeccion/base";
import { COMO_SE_CUENTA_JUEGO, type ProyeccionJuego } from "@/lib/proyeccion/juego";
import type { PartidoObjetivo } from "@/lib/proyeccion/montaje";

type Respuesta = {
  success: boolean;
  partido?: PartidoObjetivo;
  abp?: ProyeccionAbp | null;
  juego?: ProyeccionJuego | null;
};

type Props = {
  tipo: "abp" | "juego";
  /** El rival que se mira en la pantalla (el nombre de la hoja o de BeSoccer). */
  equipo?: string | null;
};

export function PanelProyeccion({ tipo, equipo }: Props) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  /* Ver el último partido jugado: lo proyectado frente a lo real (para calibrar). No guarda nada. */
  const [anterior, setAnterior] = useState(false);

  useEffect(() => {
    let vivo = true;
    const q = new URLSearchParams({ que: tipo });
    if (anterior) q.set("anterior", "1");
    else if (equipo) q.set("rival", equipo);
    fetch(`/api/proyeccion?${q.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Respuesta | null) => {
        if (!vivo) return;
        setDatos(j?.success ? j : null);
        setCargando(false);
      })
      .catch(() => {
        if (!vivo) return;
        setDatos(null);
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [tipo, equipo, anterior]);

  const cambia = () => {
    setCargando(true);
    setAnterior((x) => !x);
  };

  if (cargando)
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-7">
        <p className="animate-pulse text-sm text-white/50">Preparando la proyección de la jornada…</p>
      </section>
    );

  const p = datos?.partido;
  const boton = (
    <button
      type="button"
      onClick={cambia}
      className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[12px] text-white/70 hover:bg-white/[0.06]"
    >
      {anterior ? "Volver a la próxima jornada" : "Ver el último partido: proyectado y real"}
    </button>
  );
  if (p && tipo === "abp" && datos?.abp) return <PanelAbp partido={p} d={datos.abp} accion={boton} />;
  if (p && tipo === "juego" && datos?.juego) return <PanelJuego partido={p} d={datos.juego} accion={boton} />;
  /* Sin datos del último partido, que se pueda volver; sin datos de la próxima, el panel no sale. */
  return anterior ? <div className="flex justify-end">{boton}</div> : null;
}

/* ------------------------------------------------------------------ */
/*  PIEZAS COMUNES                                                     */
/* ------------------------------------------------------------------ */

function Cabecera({ partido, titulo, hasta, accion }: { partido: PartidoObjetivo; titulo: string; hasta: string; accion?: ReactNode }) {
  const hora = horaDelCalendarioLocal(partido.cuando);
  const dia = diaLargoDelCalendario(partido.cuando);
  const lado = partido.lado === "casa" ? "en casa" : "fuera";
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C8A96B]">
          Proyección de la jornada · J{partido.jornada}
        </p>
        <h2 className="mt-1 text-lg font-bold md:text-xl">
          {titulo} · {partido.rival} ({lado})
        </h2>
        <p className="mt-0.5 text-xs text-white/55">
          {dia ? `${dia.charAt(0).toUpperCase()}${dia.slice(1)}` : ""}
          {hora ? ` · ${hora}` : ""}
          {hasta ? ` · datos de Opta hasta el ${hasta.slice(8, 10)}/${hasta.slice(5, 7)}` : ""}
          {partido.jugado
            ? ` · jugado${partido.golesFavor != null && partido.golesContra != null ? ` (${partido.golesFavor}-${partido.golesContra})` : ""}: proyectado con lo de antes y, debajo, lo real`
            : ""}
        </p>
      </div>
      {accion}
    </div>
  );
}

function Tendencia() {
  return (
    <span className="ml-1 inline-block rounded border border-white/15 px-1 py-px align-middle text-[10px] font-medium uppercase tracking-wide text-white/50">
      tendencia
    </span>
  );
}

function Bloque({ titulo, icono, children }: { titulo: string; icono: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">
        {icono}
        {titulo}
      </p>
      {children}
    </div>
  );
}

function PorQue({ frases }: { frases: string[] }) {
  if (!frases.length) return null;
  return (
    <Bloque titulo="Por qué" icono={<Lightbulb size={13} className="text-[#C8A96B]" />}>
      <ul className="space-y-1.5 text-sm leading-snug text-white/80">
        {frases.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#C8A96B]" />
            <span className="min-w-0">{f}</span>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

function ComoSeCuenta({ lineas }: { lineas: string[] }) {
  return (
    <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/70">
      <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wider text-white/60">Cómo se cuenta</summary>
      <ul className="mt-2 space-y-1.5 leading-snug">
        {lineas.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </details>
  );
}

function Punto({ titulo, frase, tendencia, tono }: { titulo: string; frase?: string | null; tendencia?: boolean; tono: "oro" | "rojo" | "verde" }) {
  if (!frase) return null;
  const color = tono === "oro" ? "text-[#C8A96B]" : tono === "rojo" ? "text-rose-300" : "text-emerald-300";
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${color}`}>{titulo}</p>
      <p className="mt-1 text-sm leading-snug text-white/80">
        {frase}
        {tendencia && <Tendencia />}
      </p>
    </div>
  );
}

function Consignas({ titulo, icono, items }: { titulo: string; icono: ReactNode; items: { clave: string; frase: string; consigna: string; tendencia?: boolean }[] }) {
  if (!items.length) return null;
  return (
    <Bloque titulo={titulo} icono={icono}>
      <ol className="space-y-2.5">
        {items.map((v, i) => (
          <li key={v.clave} className="text-sm leading-snug">
            <p className="font-semibold text-white/90">
              {i + 1}. {v.consigna}
              {v.tendencia && <Tendencia />}
            </p>
            <p className="mt-0.5 text-xs text-white/55">{v.frase}</p>
          </li>
        ))}
      </ol>
    </Bloque>
  );
}

/* ------------------------------------------------------------------ */
/*  BALÓN PARADO                                                       */
/* ------------------------------------------------------------------ */

function Celda({ p, real, tendencia, dec = 1 }: { p: Proyeccion; real?: number | null; tendencia?: boolean; dec?: number }) {
  const acierto = real != null ? dentroDelRango(p, real) : null;
  return (
    <td className="px-2 py-2 text-right align-top">
      <span className="font-semibold tabular-nums text-white">{coma(p.valor, dec)}</span>
      <span className="ml-1 text-[11px] tabular-nums text-white/45">({rango(p)})</span>
      {tendencia && <Tendencia />}
      {real != null && (
        <span className={`block text-[11px] tabular-nums ${acierto ? "text-emerald-300" : "text-amber-300"}`}>real {coma(real, 0)}</span>
      )}
    </td>
  );
}

export function PanelAbp({ partido, d, accion }: { partido: PartidoObjetivo; d: ProyeccionAbp; accion?: ReactNode }) {
  const hayReal = d.lineas.some((l) => l.real && l.real.favor != null);
  const ventajas = d.ventajas.slice(0, 2).map((v) => ({ clave: v.tipo, frase: v.frase, consigna: v.consigna, tendencia: v.tendencia }));
  const riesgos = d.riesgos.slice(0, 2).map((v) => ({ clave: v.tipo, frase: v.frase, consigna: v.consigna, tendencia: v.tendencia }));
  return (
    <section className="space-y-4 rounded-3xl border border-[#C8A96B]/20 bg-white/[0.03] p-5 md:p-7">
      <Cabecera partido={partido} titulo="Balón parado" hasta={d.hasta} accion={accion} />

      {d.tipoPartido && (
        <p className="flex items-start gap-2 rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/10 px-3 py-2 text-sm text-white/85">
          <Swords size={15} className="mt-0.5 shrink-0 text-[#C8A96B]" />
          <span className="min-w-0">
            {d.tipoPartido}
            {d.posesion ? ` (${pct(d.posesion.valor)} de posesión esperada para nosotros).` : "."}
          </span>
        </p>
      )}

      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/50">
              <th className="px-2 py-2 text-left font-semibold">Acción</th>
              <th className="px-2 py-2 text-right font-semibold">A favor</th>
              <th className="px-2 py-2 text-right font-semibold">En contra</th>
              <th className="px-2 py-2 text-right font-semibold">Media del grupo</th>
            </tr>
          </thead>
          <tbody>
            {d.lineas.map((l) => (
              <tr key={l.tipo} className="border-b border-white/5">
                <td className="px-2 py-2 align-top text-white/85">{l.nombre}</td>
                <Celda p={l.favor.acciones} real={l.real?.favor} tendencia={l.favor.tendencia} />
                <Celda p={l.contra.acciones} real={l.real?.contra} tendencia={l.contra.tendencia} />
                <td className="px-2 py-2 text-right align-top tabular-nums text-white/60">{coma(l.liga)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-white/80">
              <td className="px-2 pt-3 text-[11px] uppercase tracking-wider text-white/50">xG de balón parado</td>
              <td className="px-2 pt-3 text-right tabular-nums">
                {coma(d.total.xGFavor, 2)}
                {hayReal && <span className="block text-[11px] text-white/50">real {coma(d.lineas.reduce((s, l) => s + (l.real?.xGFavor ?? 0), 0), 2)}</span>}
              </td>
              <td className="px-2 pt-3 text-right tabular-nums">
                {coma(d.total.xGContra, 2)}
                {hayReal && <span className="block text-[11px] text-white/50">real {coma(d.lineas.reduce((s, l) => s + (l.real?.xGContra ?? 0), 0), 2)}</span>}
              </td>
              <td className="px-2 pt-3 text-right tabular-nums text-white/60">{coma(d.lineas.reduce((s, l) => s + l.ligaXG, 0), 2)}</td>
            </tr>
            <tr className="text-white/80">
              <td className="px-2 pt-1 text-[11px] uppercase tracking-wider text-white/50">Gol a balón parado (al menos uno)</td>
              <td className="px-2 pt-1 text-right tabular-nums">{pct(d.total.golFavor)}</td>
              <td className="px-2 pt-1 text-right tabular-nums">{pct(d.total.golContra)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-white/45">
        Entre paréntesis, el intervalo del 80 %. Remates esperados de balón parado:{" "}
        {coma(d.lineas.reduce((s, l) => s + l.favor.conversion.remates, 0))} a favor y {coma(d.lineas.reduce((s, l) => s + l.contra.conversion.remates, 0))} en contra.
      </p>

      <PorQue frases={d.porque} />

      <div className="grid gap-3 md:grid-cols-3">
        <Punto titulo="Su punto fuerte" frase={d.suFuerte?.frase} tendencia={d.suFuerte?.tendencia} tono="rojo" />
        <Punto titulo="Su punto débil" frase={d.suDebil?.frase} tendencia={d.suDebil?.tendencia} tono="verde" />
        <Punto titulo="El nuestro" frase={d.nuestroFuerte?.frase} tendencia={d.nuestroFuerte?.tendencia} tono="oro" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Consignas titulo="Dónde más ventaja" icono={<Sparkles size={13} className="text-emerald-300" />} items={ventajas} />
        <Consignas titulo="Dónde más riesgo" icono={<ShieldAlert size={13} className="text-rose-300" />} items={riesgos} />
      </div>

      {(d.amenaza || d.nuestroRematador) && (
        <div className="grid gap-3 md:grid-cols-2">
          {d.amenaza && (
            <Punto
              titulo="Su rematador a balón parado"
              frase={`${d.amenaza.tirador}: ${d.amenaza.remates} remates${d.amenaza.cabeza ? ` (${d.amenaza.cabeza} de cabeza)` : ""}, ${coma(d.amenaza.xG, 2)} xG${d.amenaza.goles ? ` y ${d.amenaza.goles} ${d.amenaza.goles === 1 ? "gol" : "goles"}` : ""}.`}
              tono="rojo"
            />
          )}
          {d.nuestroRematador && (
            <Punto
              titulo="Nuestro rematador a balón parado"
              frase={`${d.nuestroRematador.tirador}: ${d.nuestroRematador.remates} remates${d.nuestroRematador.cabeza ? ` (${d.nuestroRematador.cabeza} de cabeza)` : ""}, ${coma(d.nuestroRematador.xG, 2)} xG${d.nuestroRematador.goles ? ` y ${d.nuestroRematador.goles} ${d.nuestroRematador.goles === 1 ? "gol" : "goles"}` : ""}.`}
              tono="oro"
            />
          )}
        </div>
      )}

      <ComoSeCuenta lineas={COMO_SE_CUENTA_ABP} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  JUEGO                                                              */
/* ------------------------------------------------------------------ */

export function PanelJuego({ partido, d, accion }: { partido: PartidoObjetivo; d: ProyeccionJuego; accion?: ReactNode }) {
  const f = (cuota: boolean | undefined, dec: number, v: number | null | undefined) => (cuota ? pct(v ?? null) : coma(v ?? null, dec));
  const ventajas = d.ventajas.slice(0, 2).map((v) => ({ clave: v.clave, frase: v.frase, consigna: v.consigna }));
  const riesgos = d.riesgos.slice(0, 2).map((v) => ({ clave: v.clave, frase: v.frase, consigna: v.consigna }));
  return (
    <section className="space-y-4 rounded-3xl border border-[#C8A96B]/20 bg-white/[0.03] p-5 md:p-7">
      <Cabecera partido={partido} titulo="Juego" hasta={d.hasta} accion={accion} />

      {d.tipoPartido.length > 0 && (
        <Bloque titulo="Tipo de partido" icono={<Swords size={13} className="text-[#C8A96B]" />}>
          <ul className="space-y-1 text-sm leading-snug text-white/85">
            {d.tipoPartido.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Bloque>
      )}

      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/50">
              <th className="px-2 py-2 text-left font-semibold">Cifra</th>
              <th className="px-2 py-2 text-right font-semibold">Nosotros</th>
              <th className="px-2 py-2 text-right font-semibold">{partido.rival}</th>
              <th className="px-2 py-2 text-right font-semibold">Media del grupo</th>
            </tr>
          </thead>
          <tbody>
            {d.lineas.map((l) => {
              const m = l.metrica;
              const celda = (p: Proyeccion, real: number | null | undefined) => {
                const dentro = real != null ? real >= p.bajo && real <= p.alto : null;
                return (
                  <td className="px-2 py-2 text-right align-top">
                    <span className="font-semibold tabular-nums text-white">{f(m.cuota, m.dec, p.valor)}</span>
                    <span className="ml-1 text-[11px] tabular-nums text-white/45">
                      ({f(m.cuota, m.dec, p.bajo)}-{f(m.cuota, m.dec, p.alto)})
                    </span>
                    {real != null && (
                      <span className={`block text-[11px] tabular-nums ${dentro ? "text-emerald-300" : "text-amber-300"}`}>real {f(m.cuota, m.dec, real)}</span>
                    )}
                  </td>
                );
              };
              return (
                <tr key={m.clave} className="border-b border-white/5">
                  <td className="px-2 py-2 align-top text-white/85" title={m.comoLeer}>
                    {m.nombre}
                    {m.fuente === "Wyscout" && <span className="ml-1 text-[10px] text-white/40">Wyscout</span>}
                  </td>
                  {celda(l.favor, l.real?.favor)}
                  {celda(l.contra, l.real?.contra)}
                  <td className="px-2 py-2 text-right align-top tabular-nums text-white/60">{f(m.cuota, m.dec, l.liga)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-white/45">Entre paréntesis, el intervalo del 80 %. PPDA: cuanto más bajo, más presión.</p>

      <PorQue frases={d.porque} />

      <div className="grid gap-3 md:grid-cols-3">
        <Punto titulo="Su punto fuerte" frase={d.suFuerte?.frase} tono="rojo" />
        <Punto titulo="Su punto débil" frase={d.suDebil?.frase} tono="verde" />
        <Punto titulo="El nuestro" frase={d.nuestroFuerte?.frase} tono="oro" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Consignas titulo="Dónde más ventaja" icono={<Crosshair size={13} className="text-emerald-300" />} items={ventajas} />
        <Consignas titulo="Dónde más riesgo" icono={<TrendingUp size={13} className="text-rose-300" />} items={riesgos} />
      </div>

      <ComoSeCuenta lineas={COMO_SE_CUENTA_JUEGO} />
    </section>
  );
}
