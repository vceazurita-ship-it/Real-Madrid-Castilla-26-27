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
import { CornerDownRight, Crosshair, Lightbulb, ShieldAlert, Sparkles, Swords, TrendingUp } from "lucide-react";

import { diaLargoDelCalendario, horaDelCalendarioLocal } from "@/lib/castilla/calendario";
import {
  COMO_SE_CUENTA_ABP,
  MIN_CORNERS_LADO,
  NOMBRE_ZONA_CORNER,
  dentroDelRango,
  type EntregaCorner,
  type EntregaLado,
  type ProyeccionAbp,
} from "@/lib/proyeccion/abp";
import { coma, pct, rango, type Proyeccion } from "@/lib/proyeccion/base";
import { COMO_SE_CUENTA_JUEGO, type ProyeccionJuego } from "@/lib/proyeccion/juego";
import type { PartidoObjetivo } from "@/lib/proyeccion/montaje";
import { fuerteYFlojoDelRival } from "@/components/rivals/VistazoRival";
import { useRivalPerfiles } from "@/hooks/useRivalPerfiles";
import { useOptaLigero } from "@/hooks/useOptaLigero";

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
  /* Lo fuerte, lo flojo y la presión del rival con la cuenta de Plantillas rivales (sólo el panel del juego). */
  const perfiles = useRivalPerfiles(tipo === "juego" ? (equipo ?? "") : "");
  /* La cifra que manda en presión, la misma de Plantillas y del Scout colectivo (lib/rivals/cifra-principal.ts, 16/11/2026). */
  const { tablas } = useOptaLigero();

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
  if (p && tipo === "juego" && datos?.juego) return (
      <PanelJuego
        partido={p}
        d={datos.juego}
        accion={boton}
        rival={perfiles && equipo ? { ...fuerteYFlojoDelRival(equipo, perfiles.aspectos ?? [], perfiles.equipos ?? 0, tablas), partidos: perfiles.partidos ?? 0 } : null}
      />
    );
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
  /* Si su córner repite una zona (Cómo saca el córner), el córner en contra entra siempre en los riesgos. */
  const enRiesgo = d.riesgos.slice(0, 2);
  const cornerC = d.entregaCorner?.mayor ? d.riesgos.find((v) => v.tipo === "corner") : undefined;
  if (cornerC && !enRiesgo.includes(cornerC)) enRiesgo.push(cornerC);
  const riesgos = enRiesgo.map((v) => ({ clave: v.tipo, frase: v.frase, consigna: v.consigna, tendencia: v.tendencia }));
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

      {d.entregaCorner && <ComoSacaElCorner e={d.entregaCorner} rival={partido.rival} />}

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
/*  CÓMO SACA EL CÓRNER (15/11/2026)                                   */
/* ------------------------------------------------------------------ */

/** Puntos de diferencia con signo: «+14», «−9». */
const puntos = (dif: number) => {
  const v = Math.round(dif * 100);
  return v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0";
};

function LadoEntrega({ l, rival }: { l: EntregaLado; rival: string }) {
  const corto = l.n < MIN_CORNERS_LADO;
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[12px] font-semibold text-white/85">
        Desde su {l.lado}
        <span className="ml-1.5 font-normal text-white/50">
          {l.n} {l.n === 1 ? "córner" : "córners"}
        </span>
        {corto && <Tendencia />}
      </p>
      <ul className="mt-2 space-y-2">
        {l.zonas.map((z) => {
          const tono = !z.destaca ? "text-white/45" : z.dif > 0 ? "text-rose-300" : "text-sky-300";
          return (
            <li
              key={z.zona}
              className={`rounded-lg px-2 py-1.5 ${z.destaca ? "border border-[#C8A96B]/40 bg-[#C8A96B]/10" : "border border-transparent"}`}
              title={`${rival}: ${pct(z.cuota)} desde la ${l.lado}; el resto del grupo, ${pct(z.cuotaGrupo)} (${l.nGrupo} córners)`}
            >
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="min-w-0 truncate text-white/80">{NOMBRE_ZONA_CORNER[z.zona]}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-white">{pct(z.cuota)}</span>
                  <span className="ml-1 text-white/45">grupo {pct(z.cuotaGrupo)}</span>
                  <span className={`ml-1.5 font-semibold ${tono}`}>{puntos(z.dif)}</span>
                </span>
              </div>
              {/* La barra es su parte; la raya, la del grupo. */}
              <div className="relative mt-1 h-1.5 rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 rounded-full bg-[#C8A96B]" style={{ width: `${Math.min(100, z.cuota * 100)}%` }} />
                <div className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-current text-white/70" style={{ left: `calc(${Math.min(100, z.cuotaGrupo * 100)}% - 1px)` }} />
              </div>
              {z.n > 0 && (
                <p className="mt-0.5 text-[11px] tabular-nums text-white/50">
                  {z.n} {z.n === 1 ? "córner" : "córners"} · {z.conRemate} con remate · {z.remates} {z.remates === 1 ? "remate" : "remates"} en la acción · {coma(z.xG, 2)} xG
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ComoSacaElCorner({ e, rival }: { e: EntregaCorner; rival: string }) {
  const m = e.mayor;
  return (
    <Bloque titulo="Cómo saca el córner" icono={<CornerDownRight size={13} className="text-[#C8A96B]" />}>
      <p className="mb-3 text-[12px] leading-snug text-white/60">
        {e.n} córners del {rival} en {e.partidos} {e.partidos === 1 ? "partido" : "partidos"}, por dónde caen (destino del pase de Opta) y frente al resto del grupo desde el mismo lado.
        Resaltado, lo que se separa 10 puntos o más{m ? "" : "; esta temporada no se separa en ninguna zona"}.
      </p>
      {m && (
        <p className="mb-3 rounded-lg border border-[#C8A96B]/25 bg-[#C8A96B]/10 px-3 py-2 text-sm text-white/85">
          Lo que más repite: <strong>{NOMBRE_ZONA_CORNER[m.zona.zona].toLowerCase()}</strong> desde su {m.lado}, {pct(m.zona.cuota)} frente a {pct(m.zona.cuotaGrupo)} del grupo ({puntos(m.zona.dif)}). Va a «Dónde más riesgo».
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {e.lados.filter((l) => l.n > 0).map((l) => (
          <LadoEntrega key={l.lado} l={l} rival={rival} />
        ))}
      </div>
    </Bloque>
  );
}

/* ------------------------------------------------------------------ */
/*  JUEGO                                                              */
/* ------------------------------------------------------------------ */

/** «Córners rematados 44,6 %» dicho en claro: qué es y por qué es malo para ellos (16/11/2026, ronda 17). */
export function enClaro(dato: string): string {
  const m = dato.match(/c[óo]rners rematados ([\d,]+ ?%)/i);
  return m ? `${dato}: de los córners que le sacan, el ${m[1].replace(/ ?%$/, " %")} acaba en remate del rival` : dato;
}

export function PanelJuego({
  partido,
  d,
  accion,
  rival,
}: {
  partido: PartidoObjetivo;
  d: ProyeccionJuego;
  accion?: ReactNode;
  /** Lo más fuerte y lo más flojo del rival y su presión, de la misma cuenta que Plantillas rivales (Wyscout). */
  rival?: { fuerte: string; flojo: string; ppda: { valor: string; puesto: number; de: number; proveedor?: string; partidos?: number | null } | null; partidos: number } | null;
}) {
  const f = (cuota: boolean | undefined, dec: number, v: number | null | undefined) => (cuota ? pct(v ?? null) : coma(v ?? null, dec));
  const ventajas = d.ventajas.slice(0, 2).map((v) => ({ clave: v.clave, frase: `${v.frase} ${v.entrena}`, consigna: v.consigna }));
  const riesgos = d.riesgos.slice(0, 2).map((v) => ({ clave: v.clave, frase: `${v.frase} ${v.entrena}`, consigna: v.consigna }));
  const fuenteW = rival?.partidos ? `Wyscout, ${rival.partidos} ${rival.partidos === 1 ? "partido" : "partidos"}` : "Wyscout";
  return (
    <section className="space-y-4 rounded-3xl border border-[#C8A96B]/20 bg-white/[0.03] p-5 md:p-7">
      <Cabecera partido={partido} titulo="Juego" hasta={d.hasta} accion={accion} />

      {d.tipoPartido.length > 0 && (
        <Bloque titulo="Tipo de partido" icono={<Swords size={13} className="text-[#C8A96B]" />}>
          {/*
            LA PRESIÓN, UNA SOLA HISTORIA (16/11/2026, jueces): arriba su presión de
            la temporada con la cifra y el puesto de Plantillas rivales; debajo lo
            esperado contra nosotros, que es otra cifra (Opta) y se dice por qué.
          */}
          {/*
            16/11/2026 (3.ª vuelta, jueces): la cifra principal es la de Opta de la
            temporada (lib/proyeccion/presion.ts), la de Plantillas rivales y el
            Scout colectivo; la de Wyscout, sólo como 2.ª lectura.
          */}
          {d.presion && (
            <p className="mb-1.5 text-sm font-semibold leading-snug text-white/90">
              Su presión en la temporada: PPDA {coma(d.presion.valor)}, {d.presion.puesto}.º de {d.presion.de} que más aprieta ({d.presion.proveedor}).
              {/* La de Wyscout sólo si da otro puesto, y con el motivo (16/11/2026, ronda 17). */}
              {rival?.ppda && rival.ppda.puesto !== d.presion.puesto && (
                <span className="ml-1 text-xs font-normal text-white/55">
                  Wyscout lo pone {rival.ppda.puesto}.º: cuenta distinto las acciones defensivas.
                </span>
              )}
            </p>
          )}
          {/* Tres frases como mucho: posesión, ocasiones y presión. El estilo va dentro de «Por qué». */}
          <ul className="space-y-1 text-sm leading-snug text-white/85">
            {d.tipoPartido.slice(0, 3).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {d.contraste && (
            <p className="mt-2 border-t border-white/10 pt-2 text-xs leading-snug text-white/65">
              <b className="font-semibold text-white/80">Contraste con los datos:</b> {d.contraste}
            </p>
          )}
        </Bloque>
      )}

      {/* «Por qué», en tabla (16/11/2026, jueces): nosotros, el rival y la media, con el sentido. */}
      {d.porqueTabla.length > 0 && (
        <Bloque titulo="Por qué" icono={<Lightbulb size={13} className="text-[#C8A96B]" />}>
          <p className="mb-2 text-xs leading-snug text-white/65">{d.comoSeCalcula}</p>
          {/* En el móvil, una tarjeta por cifra: la tabla se cortaba por la derecha (16/11/2026, jueces). */}
          <ul className="space-y-2 sm:hidden">
            {d.porqueTabla.map((r) => (
              <li key={r.cifra} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px]">
                <p className="font-semibold text-white/90">
                  {r.cifra} <span className="text-[11px] font-normal text-white/55">· {r.sentido}</span>
                </p>
                <p className="mt-0.5 tabular-nums text-white/75">
                  Nosotros {r.nosotros} · {partido.rival} {r.rival} ({r.rivalEs}) · media {r.media}
                </p>
                <p className="tabular-nums text-white/90">
                  Esperado <b>{r.esperado}</b> <span className="text-[11px] text-white/55">{r.consecuencia}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="-mx-1 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/55">
                  <th className="px-2 py-1.5 text-left font-semibold">Cifra · sentido</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Nosotros</th>
                  <th className="px-2 py-1.5 text-right font-semibold">{partido.rival}</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Media</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Esperado</th>
                </tr>
              </thead>
              <tbody>
                {d.porqueTabla.map((r) => (
                  <tr key={r.cifra} className="border-b border-white/5">
                    <td className="px-2 py-1.5 text-white/85">
                      {r.cifra} <span className="text-[11px] text-white/50">· {r.sentido}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-white/80">{r.nosotros}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-white/80">
                      {r.rival} <span className="text-[11px] text-white/50">{r.rivalEs}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-white/60">{r.media}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      <b className="text-white">{r.esperado}</b> <span className="text-[11px] text-white/50">{r.consecuencia}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-white/50">
            Por partido en la temporada (Opta, {d.partidos.nos} partidos nuestros y {d.partidos.riv} del {partido.rival}).
          </p>
          {[...d.porque, ...d.tipoPartido.slice(3)].length > 0 && (
            <ul className="mt-2 space-y-1 text-sm leading-snug text-white/75">
              {[...d.porque, ...d.tipoPartido.slice(3)].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </Bloque>
      )}

      <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <summary className="cursor-pointer select-none text-[12px] font-semibold text-white/75">
          Ver las {d.lineas.length} cifras del partido
          <span className="ml-1 font-normal text-white/50">· nosotros, {partido.rival} y la media del grupo</span>
        </summary>
        <div className="-mx-1 mt-2 overflow-x-auto">
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
                      <span className="ml-1 text-[11px] text-white/50">· {m.fuente}</span>
                      {(m.clave === "ExpG" || m.clave === "TouchOpBox" || m.clave === "PPDA") && (
                        <span className="block text-[11px] leading-snug text-white/50">{m.comoLeer}</span>
                      )}
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
        <p className="mt-1 text-[11px] text-white/50">Entre paréntesis, el intervalo del 80 %.</p>
      </details>

      {/*
        SU PUNTO FUERTE Y DÉBIL, LOS DE PLANTILLAS RIVALES (16/11/2026, jueces): su
        cifra más extrema de verdad (la cuenta común, entre los 6 de cada punta),
        no un 7.º de 20. Sin ellos, los de Opta, también sólo en los extremos.
      */}
      <div className="grid gap-3 md:grid-cols-3">
        <Punto titulo="Su punto fuerte" frase={rival?.fuerte ? `${rival.fuerte.charAt(0).toUpperCase()}${rival.fuerte.slice(1)} (${fuenteW}).` : d.suFuerte?.frase} tono="rojo" />
        <Punto titulo="Su punto débil" frase={rival?.flojo ? `${enClaro(rival.flojo.charAt(0).toUpperCase() + rival.flojo.slice(1))} (${fuenteW}).` : d.suDebil?.frase} tono="verde" />
        <Punto titulo="El nuestro" frase={d.nuestroFuerte?.frase} tono="oro" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Consignas titulo="Dónde más ventaja" icono={<Crosshair size={13} className="text-emerald-300" />} items={ventajas} />
        <Consignas titulo="Dónde más riesgo" icono={<TrendingUp size={13} className="text-rose-300" />} items={riesgos} />
      </div>

      {/* Fases (16/11/2026, jueces de fútbol): cómo sale cada uno ante la presión del otro y cómo transita. */}
      {d.fases.some((x) => x.consigna) && (
        <Bloque titulo="Fases del juego" icono={<CornerDownRight size={13} className="text-[#C8A96B]" />}>
          <ul className="grid gap-3 md:grid-cols-2">
            {d.fases.filter((x) => x.consigna).map((x) => (
              <li key={x.titulo} className="min-w-0 text-sm leading-snug">
                <p className="font-semibold text-white/90">{x.titulo}</p>
                <p className="mt-0.5 text-[13px] text-white/65">{x.frase}</p>
                {x.consigna && <p className="mt-0.5 text-white/85">{x.consigna}</p>}
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      <ComoSeCuenta lineas={COMO_SE_CUENTA_JUEGO} />
    </section>
  );
}

/** La proyección del juego de un rival, para quien la necesite fuera del panel (las tres ideas del Plan). */
export function useProyeccionJuego(equipo?: string | null) {
  const [datos, setDatos] = useState<{ equipo: string; juego: ProyeccionJuego | null } | null>(null);
  useEffect(() => {
    if (!equipo) return;
    let vivo = true;
    fetch(`/api/proyeccion?${new URLSearchParams({ que: "juego", rival: equipo }).toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Respuesta | null) => {
        if (vivo) setDatos({ equipo, juego: j?.success ? (j.juego ?? null) : null });
      })
      .catch(() => {
        if (vivo) setDatos({ equipo, juego: null });
      });
    return () => {
      vivo = false;
    };
  }, [equipo]);
  return datos && datos.equipo === equipo ? datos.juego : null;
}
