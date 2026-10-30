"use client";

/**
 * EL DÍA DE UN VISTAZO, CON SUS CLIPS (29/10/2026; revisado el 30/10/2026).
 *
 * El analista: «que se pueda ver a través de visualizadores top… y siempre
 * vinculados a los clips que lo muestran». Con lo que ya recoge la sección
 * (objetivos, acciones con su minuto, validaciones y clips) se arma, de
 * arriba abajo:
 *
 *   1. Titular con la conclusión del día (acierto, meta, lo mejor y lo que
 *      más cuesta, y frente al último día analizado).
 *   2. Cifras clave, SIEMPRE con su base: «7 de 12 correctas», «9 de 12
 *      revisadas», «2 de 3 objetivos en meta».
 *   3. Cumplimiento por objetivo: barra 100 % correcta/mejorable con la meta
 *      marcada y semáforo (icono + palabra, nunca sólo color). Lo que sigue
 *      como propuesta automática va RAYADO; lo validado, liso.
 *   4. Cuándo pasa: histograma por tramos de la sesión y una calle por
 *      objetivo con cada acción en su minuto. Los tramos que el análisis no
 *      pudo mirar se ven sombreados: ahí no hay acciones porque no se miró.
 *   5. Por tarea y por jugador (sólo si hay más de uno de cada).
 *   6. Evolución entre sesiones (acierto de cada día analizado).
 *
 * Todo lo que se pinta es un botón que abre ./VisorClips.tsx (el visor lo
 * monta la página: es el mismo con el que se revisa). Las descartadas no
 * cuentan en ningún gráfico. Lo que no tiene dato no se pinta.
 * Colores: la pareja validada de DATA (#1B9E77 / #D95F02); los textos van en
 * la tinta de la página, nunca en el color de la serie.
 *
 * `dias` llega ya con el análisis saneado y sólo las validaciones vigentes
 * (lib/entreno/modelo.ts, `normalizaAnalisis` y `sesionVigente`).
 */

import { type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";

import { accionesDelJugador, normaliza, sinDueno, type DiaEntreno } from "@/lib/entreno/jugador";
import { MINIMO_PORCENTAJE, cuentasDe, cumpleMeta, mmss, objetivoMedido, tramosSinMirar, veredictoFinal, type AccionEntreno, type Cuentas, type ObjetivoEntreno, type Validacion } from "@/lib/entreno/modelo";

import { COLOR_BIEN, COLOR_MEJORABLE, claveDe, type PeticionVisor, type Pieza } from "./VisorClips";

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#C8A96B]";
const ddmm = (f: string) => f.split("-").reverse().slice(0, 2).join("/");
const corto = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/** El relleno de lo que sigue como propuesta automática: rayado del color de su serie. */
export const rayado = (color: string) => `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 6px)`;

/** «58 %» con muestra suficiente; si no, la cuenta: «5 de 7». */
const acierto = (c: Cuentas) => (c.pct !== null ? `${c.pct} %` : `${c.correctas} de ${c.total}`);

/** Un objetivo medido del día con sus acciones vigentes (sin descartadas). */
type Fila = { objetivo: ObjetivoEntreno; numero: number; acciones: AccionEntreno[]; c: Cuentas; cumple: boolean | null };

/** Las filas medidas de un día: objetivos con texto que entraron en el análisis y dieron acciones. */
function filasDe(dia: DiaEntreno): Fila[] {
  if (!dia.analisis) return [];

  const val = dia.sesion.validaciones;

  return dia.sesion.objetivos
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => objetivoMedido(o, dia.analisis))
    .map(({ o, i }) => {
      const acciones = (dia.analisis?.acciones ?? []).filter((a) => a.objetivoId === o.id && veredictoFinal(a, val) !== null);
      const c = cuentasDe(acciones, val);

      return { objetivo: o, numero: i + 1, acciones, c, cumple: cumpleMeta(c, o.meta) };
    })
    .filter((f) => f.c.total > 0);
}

export function PanelVisual({ dias, fecha, onAbre, onIrAlDia }: { dias: DiaEntreno[]; fecha: string; onAbre: (p: PeticionVisor) => void; onIrAlDia: (fecha: string) => void }) {
  const dia = dias.find((d) => d.fecha === fecha) ?? null;
  const val = dia?.sesion.validaciones;
  const filas = dia ? filasDe(dia) : [];

  const validacionesDe = (f: string) => dias.find((d) => d.fecha === f)?.sesion.validaciones;
  const piezasDe = (d: DiaEntreno, fs: { objetivo: ObjetivoEntreno; numero: number; acciones: AccionEntreno[] }[]): Pieza[] =>
    fs.flatMap((f) => f.acciones.map((accion) => ({ accion, fecha: d.fecha, objetivo: `${f.numero}. ${f.objetivo.objetivo}`, fuenteUrl: d.analisis?.fuente.url ?? null })));
  const todas = dia ? piezasDe(dia, filas) : [];
  const abre = (titulo: string, piezas: Pieza[], subtitulo?: string, extra?: Partial<PeticionVisor>) => {
    if (piezas.length) onAbre({ titulo, subtitulo, piezas, ...extra });
  };
  const deVeredicto = (piezas: Pieza[], v: "correcta" | "mejorable") => piezas.filter((p) => veredictoFinal(p.accion, validacionesDe(p.fecha)) === v);

  /* La evolución: cada día analizado hasta el abierto, con sus filas. */
  const evolucion = dias
    .filter((d) => d.analisis && d.fecha <= fecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((d) => {
      const fs = filasDe(d);

      return { dia: d, filas: fs, c: cuentasDe(fs.flatMap((f) => f.acciones), d.sesion.validaciones) };
    })
    .filter((x) => x.c.total > 0)
    .slice(-10);

  if (!dia?.analisis || !filas.length) return null;

  const total = cuentasDe(
    filas.flatMap((f) => f.acciones),
    val,
  );
  const conClip = todas.filter((p) => p.accion.clip);
  const sinValidar = todas.filter((p) => !val?.[p.accion.id]);
  const conMeta = filas.filter((f) => f.cumple !== null);
  const enMeta = conMeta.filter((f) => f.cumple).length;
  /* Lo mejor y lo que más cuesta, sólo entre objetivos con muestra para porcentaje (antes bastaban 3 acciones y salían «67 %» de tres). */
  const comparables = filas.filter((f) => f.c.pct !== null);
  const ordenadas = [...comparables].sort((a, b) => (b.c.pct ?? 0) - (a.c.pct ?? 0));
  const mejor = ordenadas.length >= 2 ? ordenadas[0] : null;
  const peor = ordenadas.length >= 2 && (ordenadas.at(-1)?.c.pct ?? 0) < (mejor?.c.pct ?? 0) ? ordenadas.at(-1)! : null;
  const previo = evolucion.filter((x) => x.dia.fecha < fecha).at(-1) ?? null;
  /* La comparación con el día anterior, sólo si los dos tienen porcentaje (con muestra corta sería ruido). */
  const delta = previo && total.pct !== null && previo.c.pct !== null ? total.pct - previo.c.pct : null;

  const lectura = [
    conMeta.length ? `${enMeta} de ${conMeta.length} objetivos con meta la cumplen` : "",
    mejor ? `lo mejor: «${corto(mejor.objetivo.objetivo, 48)}» (${mejor.c.pct} %)` : "",
    peor ? `lo que más cuesta: «${corto(peor.objetivo.objetivo, 48)}» (${peor.c.pct} %)` : "",
  ].filter(Boolean);

  /* Tramos de la sesión: de 2 min hasta media hora, de 5 si es más larga. */
  const duracion = Math.max(dia.analisis.fuente.duracion || 0, ...todas.map((p) => p.accion.fin), 60);
  const tramo = duracion <= 1800 ? 120 : 300;
  const nTramos = Math.ceil(duracion / tramo);
  const tramos = Array.from({ length: nTramos }, (_, i) => {
    const piezas = todas.filter((p) => Math.min(Math.floor(p.accion.inicio / tramo), nTramos - 1) === i);

    return { i, piezas, bien: deVeredicto(piezas, "correcta").length, mal: deVeredicto(piezas, "mejorable").length };
  });
  const maxTramo = Math.max(1, ...tramos.map((t) => t.piezas.length));
  const marcas = Array.from({ length: Math.floor(duracion / 900) + 1 }, (_, i) => i * 900).filter((s) => s <= duracion);
  const sinMirar = tramosSinMirar(dia.analisis.avisos).filter((t) => t.desde < duracion);
  const finTramo = (i: number) => Math.min((i + 1) * tramo, duracion);

  /* Por tarea: sólo los objetivos atados a una tarea, y sólo si hay dos o más tareas. */
  /* A mano y no con Map.groupBy: los iPad con Safari anterior a 17.4 no lo tienen. */
  const grupos = new Map<string, Fila[]>();

  for (const f of filas) {
    const t = f.objetivo.tarea?.trim();

    if (t) grupos.set(t, [...(grupos.get(t) ?? []), f]);
  }

  const porTarea = [...grupos.entries()].map(([tarea, fs]) => ({
    tarea,
    texto: fs.find((f) => f.objetivo.tareaTexto)?.objetivo.tareaTexto ?? "",
    fs,
    acciones: fs.flatMap((f) => f.acciones),
  }));

  /* Por jugador: con varios jugadores en un objetivo, la acción es de quien nombra el análisis (lib/entreno/jugador.ts, `duenoDe`). */
  const nombres = new Map<string, string>();

  for (const f of filas) for (const j of f.objetivo.jugadores) if (normaliza(j.nombre)) nombres.set(normaliza(j.nombre), j.nombre);

  const porJugador = [...nombres.entries()]
    .map(([clave, nombre]) => {
      const fs = filas.map((f) => ({ ...f, acciones: f.objetivo.jugadores.some((j) => normaliza(j.nombre) === clave) ? accionesDelJugador(f.objetivo, f.acciones, clave) : [] })).filter((f) => f.acciones.length);

      return { clave, nombre, fs, c: cuentasDe(fs.flatMap((f) => f.acciones), val) };
    })
    .filter((j) => j.c.total > 0)
    .sort((a, b) => (b.c.pctBruto ?? 0) - (a.c.pctBruto ?? 0) || b.c.total - a.c.total);
  const deNadie = filas.flatMap((f) => sinDueno(f.objetivo, f.acciones).map((accion) => ({ accion, fila: f })));

  return (
    <section aria-labelledby="panel-visual" className="min-w-0 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      {/* 1. El titular */}
      <header className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">El entrenamiento del {ddmm(fecha)} de un vistazo</p>
        <h2 id="panel-visual" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-semibold leading-tight text-white sm:text-3xl">
          <span className="tabular-nums">{total.pct !== null ? `${total.pct} % de acierto` : `${total.correctas} de ${total.total} correctas`}</span>
          {total.pct !== null ? (
            <span className="text-base font-medium text-white/65">
              {total.correctas} de {total.total} acciones correctas
            </span>
          ) : (
            <span className="text-sm font-medium text-white/55">menos de {MINIMO_PORCENTAJE} acciones: tendencia, sin porcentaje</span>
          )}
          {delta !== null && previo && Math.abs(delta) >= 5 ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-white/70">
              {delta > 0 ? <TrendingUp size={15} style={{ color: COLOR_BIEN }} aria-hidden /> : <TrendingDown size={15} style={{ color: COLOR_MEJORABLE }} aria-hidden />}
              {delta > 0 ? "+" : ""}
              {delta} puntos frente al {ddmm(previo.dia.fecha)}
            </span>
          ) : null}
        </h2>
        {lectura.length ? <p className="text-sm text-white/70">{lectura.join(" · ").replace(/^./, (l) => l.toUpperCase())}.</p> : null}
        <p className="text-[11px] text-white/45">Pulsa cualquier barra, punto o cifra para ver los clips que la forman.</p>
      </header>

      {/* 2. Cifras clave, con su base */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Cifra valor={total.correctas} base={total.total} rotulo="Correctas" color={COLOR_BIEN} onClick={() => abre("Correctas del día", deVeredicto(todas, "correcta"))} />
        <Cifra valor={total.mejorables} base={total.total} rotulo="Mejorables" color={COLOR_MEJORABLE} onClick={() => abre("Mejorables del día", deVeredicto(todas, "mejorable"))} />
        <Cifra
          valor={total.validadas}
          base={total.total}
          rotulo="Revisadas"
          nota={sinValidar.length ? `${sinValidar.length} sin validar` : "todo validado"}
          onClick={() => (sinValidar.length ? abre("Por revisar", sinValidar, undefined, { filtro: "sin-validar", orden: "minuto" }) : abre("Todas las acciones del día", todas, undefined, { orden: "minuto" }))}
        />
        {conMeta.length ? (
          <Cifra valor={enMeta} base={conMeta.length} rotulo="Objetivos en meta" onClick={() => abre("Objetivos que cumplen su meta", piezasDe(dia, conMeta.filter((f) => f.cumple)))} />
        ) : conClip.length ? (
          <Cifra valor={conClip.length} base={total.total} rotulo="Con clip" onClick={() => abre("Clips del día", conClip)} />
        ) : null}
      </div>

      <Leyenda />

      {/* 3. Cumplimiento por objetivo */}
      <Bloque titulo="Cumplimiento por objetivo" nota={`Reparto de sus acciones; la raya dorada es la meta. Porcentaje con ${MINIMO_PORCENTAJE} acciones o más; por debajo, la cuenta.`}>
        <div className="space-y-3.5">
          {filas.map((f) => (
            <FilaBarra
              key={f.objetivo.id}
              titulo={`${f.numero}. ${f.objetivo.objetivo}`}
              detalle={[f.objetivo.jugadores.map((j) => j.nombre).join(", "), f.objetivo.tarea ? `Tarea ${f.objetivo.tarea}` : ""].filter(Boolean).join(" · ")}
              acciones={f.acciones}
              val={val}
              c={f.c}
              meta={f.objetivo.meta}
              cumple={f.cumple}
              onAbre={(v) => {
                const ps = piezasDe(dia, [f]);

                abre(`${f.numero}. ${corto(f.objetivo.objetivo)}`, v ? deVeredicto(ps, v) : ps, v === "correcta" ? "Correctas" : v === "mejorable" ? "Mejorables" : undefined);
              }}
            />
          ))}
        </div>
      </Bloque>

      {/* 4. Cuándo pasa en la sesión */}
      <Bloque
        titulo="Cuándo pasa en la sesión"
        nota={`Arriba, cuántas acciones hay en cada tramo de ${tramo / 60} min; debajo, cada objetivo en su calle. Punto relleno = validada; aro = propuesta automática; aro dorado = con clip.`}
      >
        <div className="space-y-3">
          <div className="relative">
            {sinMirar.map((t) => (
              <span
                key={t.desde}
                className="absolute inset-y-0 rounded-sm"
                style={{ left: `${(100 * t.desde) / duracion}%`, width: `${(100 * (Math.min(t.hasta, duracion) - t.desde)) / duracion}%`, background: rayado("rgb(var(--rmcf-ink-rgb) / .10)") }}
                title={`Del ${mmss(t.desde)} al ${mmss(t.hasta)}: no se pudo analizar`}
                aria-hidden
              />
            ))}
            <div className="relative flex h-24 items-end gap-[2px]" role="group" aria-label="Acciones por tramo de la sesión">
              {tramos.map((t) =>
                t.piezas.length ? (
                  <button
                    key={t.i}
                    type="button"
                    onClick={() => abre(`Del ${mmss(t.i * tramo)} al ${mmss(finTramo(t.i))}`, t.piezas, undefined, { orden: "minuto" })}
                    title={`${mmss(t.i * tramo)}–${mmss(finTramo(t.i))}: ${t.bien} correctas, ${t.mal} mejorables`}
                    aria-label={`Del minuto ${mmss(t.i * tramo)} al ${mmss(finTramo(t.i))}: ${t.bien} correctas y ${t.mal} mejorables`}
                    className={`group flex h-full min-w-0 flex-1 flex-col justify-end gap-[2px] rounded-sm ${FOCO}`}
                  >
                    <span className="text-center text-[9px] tabular-nums leading-none text-white/55 opacity-0 transition-opacity group-hover:opacity-100">{t.piezas.length}</span>
                    {t.mal ? <span className="block w-full rounded-t-[3px] transition-opacity group-hover:opacity-80" style={{ height: `${(84 * t.mal) / maxTramo}px`, background: COLOR_MEJORABLE }} /> : null}
                    {t.bien ? <span className={`block w-full transition-opacity group-hover:opacity-80 ${t.mal ? "" : "rounded-t-[3px]"}`} style={{ height: `${(84 * t.bien) / maxTramo}px`, background: COLOR_BIEN }} /> : null}
                  </button>
                ) : (
                  <span key={t.i} className="h-px min-w-0 flex-1 bg-white/10" aria-hidden />
                ),
              )}
            </div>
          </div>

          <Eje marcas={marcas} duracion={duracion} />

          <div className="space-y-2.5">
            {filas.map((f) => {
              const ps = piezasDe(dia, [f]);

              return (
                <div key={f.objetivo.id} className="min-w-0">
                  <p className="truncate text-[11px] text-white/60" title={f.objetivo.objetivo}>
                    <span className="font-semibold text-[#C8A96B]">{f.numero}.</span> {f.objetivo.objetivo}
                  </p>
                  <div className="relative h-7">
                    <span className="absolute inset-x-0 top-1/2 h-px bg-white/10" aria-hidden />
                    {sinMirar.map((t) => (
                      <span key={t.desde} className="absolute inset-y-1" style={{ left: `${(100 * t.desde) / duracion}%`, width: `${(100 * (Math.min(t.hasta, duracion) - t.desde)) / duracion}%`, background: rayado("rgb(var(--rmcf-ink-rgb) / .08)") }} aria-hidden />
                    ))}
                    {ps.map((p) => {
                      const v = veredictoFinal(p.accion, val);
                      const validada = Boolean(val?.[p.accion.id]);
                      const color = v === "correcta" ? COLOR_BIEN : COLOR_MEJORABLE;

                      return (
                        <button
                          key={p.accion.id}
                          type="button"
                          onClick={() => abre(`${f.numero}. ${corto(f.objetivo.objetivo)}`, ps, undefined, { inicial: claveDe(p), orden: "minuto" })}
                          title={`${mmss(p.accion.inicio)} · ${v === "correcta" ? "correcta" : "mejorable"} · ${validada ? "validada" : "propuesta automática"}${p.accion.clip ? " · con clip" : ""}`}
                          aria-label={`Minuto ${mmss(p.accion.inicio)}, ${v === "correcta" ? "correcta" : "mejorable"}${validada ? ", validada" : ", propuesta automática"}${p.accion.clip ? ", con clip" : ""}`}
                          className={`absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform hover:scale-125 ${FOCO}`}
                          style={{ left: `${Math.min(100, (100 * p.accion.inicio) / duracion)}%` }}
                        >
                          <span
                            className="block h-3 w-3 rounded-full"
                            style={{ background: validada ? color : "transparent", border: `2px solid ${color}`, boxShadow: p.accion.clip ? "0 0 0 2px var(--rmcf-gold-ink)" : undefined }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {sinMirar.length ? (
            <p className="flex items-center gap-1.5 text-[11px] text-white/55">
              <span className="block h-3 w-5 rounded-sm" style={{ background: rayado("rgb(var(--rmcf-ink-rgb) / .25)") }} aria-hidden />
              Tramo sombreado = el análisis no pudo mirarlo: ahí no hay acciones porque no se vieron, no porque no las hubiera.
            </p>
          ) : null}
        </div>
      </Bloque>

      {/* 5. Por tarea y por jugador */}
      {porTarea.length >= 2 || porJugador.length >= 2 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {porTarea.length >= 2 ? (
            <Bloque titulo="Por tarea" nota="Los objetivos atados a una tarea del registro, juntos.">
              <div className="space-y-3.5">
                {porTarea.map((t) => (
                  <FilaBarra
                    key={t.tarea}
                    titulo={`${t.tarea}${t.texto ? ` · ${t.texto}` : ""}`}
                    detalle={`${t.fs.length} ${t.fs.length === 1 ? "objetivo" : "objetivos"}`}
                    acciones={t.acciones}
                    val={val}
                    c={cuentasDe(t.acciones, val)}
                    onAbre={(v) => {
                      const ps = piezasDe(dia, t.fs);

                      abre(`Tarea ${t.tarea}`, v ? deVeredicto(ps, v) : ps, t.texto || undefined);
                    }}
                  />
                ))}
              </div>
            </Bloque>
          ) : null}
          {porJugador.length >= 2 ? (
            <Bloque titulo="Por jugador" nota="Con varios jugadores en un objetivo, a cada uno se le cuenta la acción en la que se le nombra.">
              <div className="space-y-3.5">
                {porJugador.map((j) => (
                  <FilaBarra
                    key={j.clave}
                    titulo={j.nombre}
                    detalle={`${j.fs.length} ${j.fs.length === 1 ? "objetivo" : "objetivos"}`}
                    acciones={j.fs.flatMap((f) => f.acciones)}
                    val={val}
                    c={j.c}
                    onAbre={(v) => {
                      const ps = piezasDe(dia, j.fs);

                      abre(j.nombre, v ? deVeredicto(ps, v) : ps);
                    }}
                  />
                ))}
                {deNadie.length ? (
                  <button
                    type="button"
                    onClick={() =>
                      abre(
                        "Acciones de grupo sin jugador reconocido",
                        deNadie.map(({ accion, fila }) => ({ accion, fecha: dia.fecha, objetivo: `${fila.numero}. ${fila.objetivo.objetivo}`, fuenteUrl: dia.analisis?.fuente.url ?? null })),
                        "Cuentan en su objetivo, no en ningún jugador",
                        { orden: "minuto" },
                      )
                    }
                    className={`rounded text-left text-[11px] text-white/55 hover:text-white hover:underline ${FOCO}`}
                  >
                    {deNadie.length} {deNadie.length === 1 ? "acción de un objetivo de grupo no nombra" : "acciones de objetivos de grupo no nombran"} a un jugador reconocible: cuentan en su objetivo, no aquí.
                  </button>
                ) : null}
              </div>
            </Bloque>
          ) : null}
        </div>
      ) : null}

      {/* 6. Evolución entre sesiones */}
      {evolucion.length >= 2 ? (
        <Bloque titulo="Evolución entre sesiones" nota={`Acierto de cada entrenamiento analizado (correctas ÷ acciones que cuentan). Columna rayada = menos de ${MINIMO_PORCENTAJE} acciones: tendencia.`}>
          <div className="relative">
            {/* Las líneas del 0, 50 y 100 %, para leer la altura sin adivinar. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-6 top-5" aria-hidden>
              {[100, 50, 0].map((p) => (
                <span key={p} className="absolute inset-x-0 flex items-center gap-1" style={{ bottom: `${p}%` }}>
                  <span className="w-7 shrink-0 text-right text-[9px] tabular-nums text-white/40">{p} %</span>
                  <span className="h-px flex-1 bg-white/[0.06]" />
                </span>
              ))}
            </div>
            <div className="relative flex gap-2 overflow-x-auto pl-8 scrollbar-none" role="group" aria-label="Acierto por sesión">
              {evolucion.map((x) => {
                const esHoy = x.dia.fecha === fecha;
                const pct = x.c.pctBruto ?? 0;
                const color = esHoy ? "var(--rmcf-gold-ink)" : "rgb(var(--rmcf-ink-rgb) / .35)";

                return (
                  <div key={x.dia.fecha} className="flex min-w-[48px] flex-1 flex-col items-center gap-1">
                    <span className="h-4 text-[11px] font-semibold tabular-nums text-white/85">{acierto(x.c)}</span>
                    <div className="flex h-32 w-full items-end justify-center">
                      <button
                        type="button"
                        onClick={() => abre(`Entrenamiento del ${ddmm(x.dia.fecha)}`, piezasDe(x.dia, x.filas), `${x.c.correctas} de ${x.c.total} correctas`)}
                        title={`${ddmm(x.dia.fecha)}: ${x.c.correctas} de ${x.c.total} correctas`}
                        aria-label={`${ddmm(x.dia.fecha)}: ${x.c.correctas} de ${x.c.total} correctas. Ver sus clips`}
                        className={`w-full max-w-[44px] rounded-t-[4px] transition-opacity hover:opacity-80 ${FOCO}`}
                        style={{ height: `${Math.max(3, pct)}%`, background: x.c.muestraCorta ? rayado(color) : color }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => !esHoy && onIrAlDia(x.dia.fecha)}
                      disabled={esHoy}
                      className={`h-5 rounded text-[10px] tabular-nums ${FOCO} ${esHoy ? "font-semibold text-[#C8A96B]" : "text-white/55 hover:text-white hover:underline"}`}
                      title={esHoy ? undefined : "Abrir ese día"}
                    >
                      {ddmm(x.dia.fecha)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </Bloque>
      ) : null}
    </section>
  );
}

function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-3 border-t border-white/10 pt-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{titulo}</h3>
        {nota ? <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{nota}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Leyenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60" aria-hidden>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_BIEN }} /> Correcta
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_MEJORABLE }} /> Mejorable
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm" style={{ background: rayado("rgb(var(--rmcf-ink-rgb) / .5)") }} /> Rayado = propuesta automática sin validar
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-0.5" style={{ background: "var(--rmcf-gold-ink)" }} /> Meta
      </span>
    </div>
  );
}

function Cifra({ valor, base, rotulo, color, nota, onClick }: { valor: number; base: number; rotulo: string; color?: string; nota?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`group min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left transition hover:bg-white/[0.06] ${FOCO}`} title="Ver los clips">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/55">
        {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden /> : null}
        {rotulo}
      </p>
      <p className="mt-0.5 truncate tabular-nums text-white">
        <span className="text-2xl font-semibold">{valor}</span>
        <span className="ml-1 text-sm text-white/55">de {base}</span>
      </p>
      {nota ? <p className="truncate text-[11px] text-white/50">{nota}</p> : null}
    </button>
  );
}

/**
 * Una barra 100 % correcta/mejorable con su meta y su semáforo; cada trozo y
 * cada cifra abren sus clips. Dentro de cada color, lo validado va liso y lo
 * que sigue como propuesta automática, rayado.
 */
function FilaBarra({
  titulo,
  detalle,
  acciones,
  val,
  c,
  meta,
  cumple = null,
  onAbre,
}: {
  titulo: string;
  detalle?: string;
  acciones: AccionEntreno[];
  val: Record<string, Validacion> | undefined;
  c: Cuentas;
  meta?: number;
  cumple?: boolean | null;
  onAbre: (v: "correcta" | "mejorable" | null) => void;
}) {
  const n = Math.max(1, c.total);
  const bienVal = acciones.filter((a) => veredictoFinal(a, val) === "correcta" && val?.[a.id]).length;
  const malVal = acciones.filter((a) => veredictoFinal(a, val) === "mejorable" && val?.[a.id]).length;
  const trozos = [
    { k: "correcta" as const, n: bienVal, validadas: true, fondo: COLOR_BIEN },
    { k: "correcta" as const, n: c.correctas - bienVal, validadas: false, fondo: rayado(COLOR_BIEN) },
    { k: "mejorable" as const, n: c.mejorables - malVal, validadas: false, fondo: rayado(COLOR_MEJORABLE) },
    { k: "mejorable" as const, n: malVal, validadas: true, fondo: COLOR_MEJORABLE },
  ].filter((t) => t.n > 0);

  return (
    <div className="grid min-w-0 gap-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-4">
      <button type="button" onClick={() => onAbre(null)} className={`min-w-0 rounded text-left ${FOCO}`} title={titulo}>
        <p className="truncate text-sm text-white/90 hover:underline">{titulo}</p>
        {detalle ? <p className="truncate text-[11px] text-white/50">{detalle}</p> : null}
      </button>
      <div className="min-w-0 space-y-1">
        <div className="relative">
          <div className="flex h-4 overflow-hidden rounded-[4px] bg-white/[0.04]">
            {trozos.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onAbre(t.k)}
                aria-label={`${t.n} ${t.k === "correcta" ? "correctas" : "mejorables"} ${t.validadas ? "validadas" : "sin validar"}: ver los clips`}
                title={`${t.n} ${t.k === "correcta" ? "correctas" : "mejorables"} ${t.validadas ? "validadas" : "sin validar"}`}
                className={`h-full transition-opacity hover:opacity-80 ${FOCO}`}
                style={{ width: `${(100 * t.n) / n}%`, background: t.fondo }}
              />
            ))}
          </div>
          {meta ? <span className="pointer-events-none absolute -bottom-1 -top-1 w-0.5 rounded-full" style={{ left: `calc(${meta}% - 1px)`, background: "var(--rmcf-gold-ink)" }} aria-hidden title={`Meta ${meta} %`} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-white/65">
          <span className="font-semibold text-white/90">{c.pct !== null ? `${c.pct} %` : "Tendencia"}</span>
          {c.correctas ? (
            <button type="button" onClick={() => onAbre("correcta")} className={`rounded hover:text-white hover:underline ${FOCO}`}>
              {c.correctas} de {c.total} bien
            </button>
          ) : (
            <span>0 de {c.total} bien</span>
          )}
          {c.mejorables ? (
            <button type="button" onClick={() => onAbre("mejorable")} className={`rounded hover:text-white hover:underline ${FOCO}`}>
              {c.mejorables} a mejorar
            </button>
          ) : null}
          <span className="text-white/50">{c.validadas === c.total ? "todas validadas" : `${c.validadas} de ${c.total} validadas`}</span>
          {meta ? <span className="text-white/50">meta {meta} %</span> : null}
          {cumple === true ? (
            <span className="inline-flex items-center gap-1 font-semibold text-white/85">
              <CheckCircle2 size={12} style={{ color: COLOR_BIEN }} aria-hidden /> Cumplida
            </span>
          ) : cumple === false ? (
            <span className="inline-flex items-center gap-1 font-semibold text-white/85">
              <AlertTriangle size={12} style={{ color: COLOR_MEJORABLE }} aria-hidden /> Por debajo
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Eje({ marcas, duracion }: { marcas: number[]; duracion: number }) {
  return (
    <div className="relative h-4 border-t border-white/10 text-[10px] tabular-nums text-white/45" aria-hidden>
      {marcas.map((s) => (
        <span key={s} className="absolute top-0.5 -translate-x-1/2 first:translate-x-0" style={{ left: `${(100 * s) / duracion}%` }}>
          {Math.round(s / 60)}′
        </span>
      ))}
    </div>
  );
}
