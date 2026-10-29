"use client";

/**
 * EL DÍA DE UN VISTAZO, CON SUS CLIPS (29/10/2026).
 *
 * El analista: «que se pueda ver a través de visualizadores top… y siempre
 * vinculados a los clips que lo muestran; la sección está pobre aún». Con lo
 * que ya recoge la sección (objetivos, acciones con su minuto, validaciones y
 * clips) se arma, de arriba abajo:
 *
 *   1. Titular con la conclusión del día (acierto, meta, lo mejor y lo que
 *      más cuesta, y frente al último día analizado).
 *   2. Cifras clave (correctas, mejorables, con clip, objetivos en meta).
 *   3. Cumplimiento por objetivo: barra 100 % correcta/mejorable con la meta
 *      marcada y semáforo (icono + palabra, nunca sólo color).
 *   4. Cuándo pasa: histograma por tramos de la sesión y una calle por
 *      objetivo con cada acción en su minuto. Las acciones no traen sitio en
 *      el campo (la IA sólo da el minuto), así que el «mapa» es el tiempo.
 *   5. Por tarea y por jugador (sólo si hay más de uno de cada).
 *   6. Evolución entre sesiones (acierto de cada día analizado).
 *
 * Todo lo que se pinta es un botón que abre ./VisorClips.tsx con las
 * acciones que lo forman. Las descartadas no cuentan en ningún gráfico.
 * Lo que no tiene dato no se pinta: un bloque sin acciones desaparece.
 * Colores: la pareja validada de DATA (#1B9E77 / #D95F02); los textos van en
 * la tinta de la página, nunca en el color de la serie.
 */

import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Film, TrendingDown, TrendingUp } from "lucide-react";

import { accionesDelJugador, normaliza, type DiaEntreno } from "@/lib/entreno/jugador";
import { MINIMO_PORCENTAJE, cuentasDe, cumpleMeta, mmss, veredictoFinal, type AccionEntreno, type Cuentas, type ObjetivoEntreno, type Validacion } from "@/lib/entreno/modelo";

import { COLOR_BIEN, COLOR_MEJORABLE, VisorClips, claveDe, type PeticionVisor, type Pieza } from "./VisorClips";

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#C8A96B]";
const ddmm = (f: string) => f.split("-").reverse().slice(0, 2).join("/");
const corto = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/** Un objetivo medido del día con sus acciones vigentes (sin descartadas). */
type Fila = { objetivo: ObjetivoEntreno; numero: number; acciones: AccionEntreno[]; c: Cuentas; cumple: boolean | null };

/** Las filas medidas de un día: objetivos con texto que entraron en el análisis y dieron acciones. */
function filasDe(dia: DiaEntreno): Fila[] {
  if (!dia.analisis) return [];

  const val = dia.sesion.validaciones;

  return dia.sesion.objetivos
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => o.objetivo.trim() && dia.analisis?.objetivosAnalizados?.some((h) => h.startsWith(`${o.id}|`)))
    .map(({ o, i }) => {
      const acciones = (dia.analisis?.acciones ?? []).filter((a) => a.objetivoId === o.id && veredictoFinal(a, val) !== null);
      const c = cuentasDe(acciones, val);

      return { objetivo: o, numero: i + 1, acciones, c, cumple: cumpleMeta(c, o.meta) };
    })
    .filter((f) => f.c.total > 0);
}

export function PanelVisual({ dias, fecha, onValida, onIrAlDia }: { dias: DiaEntreno[]; fecha: string; onValida: (id: string, v: Validacion | null) => void; onIrAlDia: (fecha: string) => void }) {
  const [visor, setVisor] = useState<PeticionVisor | null>(null);
  const dia = dias.find((d) => d.fecha === fecha) ?? null;
  const val = dia?.sesion.validaciones;
  const filas = dia ? filasDe(dia) : [];

  const validacionesDe = (f: string) => dias.find((d) => d.fecha === f)?.sesion.validaciones;
  const piezasDe = (d: DiaEntreno, fs: { objetivo: ObjetivoEntreno; numero: number; acciones: AccionEntreno[] }[]): Pieza[] =>
    fs.flatMap((f) => f.acciones.map((accion) => ({ accion, fecha: d.fecha, objetivo: `${f.numero}. ${f.objetivo.objetivo}`, fuenteUrl: d.analisis?.fuente.url ?? null })));
  const todas = dia ? piezasDe(dia, filas) : [];
  const abre = (titulo: string, piezas: Pieza[], subtitulo?: string, inicial?: string) => {
    if (piezas.length) setVisor({ titulo, subtitulo, piezas, inicial });
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
  const conMeta = filas.filter((f) => f.cumple !== null);
  const enMeta = conMeta.filter((f) => f.cumple).length;
  const comparables = filas.filter((f) => f.c.total >= 3);
  const ordenadas = [...comparables].sort((a, b) => (b.c.pctBruto ?? 0) - (a.c.pctBruto ?? 0));
  const mejor = ordenadas.length >= 2 ? ordenadas[0] : null;
  const peor = ordenadas.length >= 2 && (ordenadas.at(-1)?.c.pctBruto ?? 0) < (mejor?.c.pctBruto ?? 0) ? ordenadas.at(-1)! : null;
  const previo = evolucion.filter((x) => x.dia.fecha < fecha).at(-1) ?? null;
  const delta = previo && total.pctBruto !== null && previo.c.pctBruto !== null ? total.pctBruto - previo.c.pctBruto : null;

  const titular = total.pct !== null ? `${total.pct} % de acierto en ${total.total} acciones` : `${total.correctas} de ${total.total} acciones correctas`;
  const lectura = [
    conMeta.length ? `${enMeta} de ${conMeta.length} objetivos con meta la cumplen` : "",
    mejor ? `lo mejor: «${corto(mejor.objetivo.objetivo, 48)}» (${mejor.c.pctBruto} %)` : "",
    peor ? `lo que más cuesta: «${corto(peor.objetivo.objetivo, 48)}» (${peor.c.pctBruto} %)` : "",
  ].filter(Boolean);

  /* Tramos de la sesión: de 2 min hasta media hora, de 5 si es más larga. */
  const duracion = Math.max(dia.analisis.fuente.duracion || 0, ...todas.map((p) => p.accion.fin), 60);
  const tramo = duracion <= 1800 ? 120 : 300;
  const tramos = Array.from({ length: Math.ceil(duracion / tramo) }, (_, i) => {
    const piezas = todas.filter((p) => Math.min(Math.floor(p.accion.inicio / tramo), Math.ceil(duracion / tramo) - 1) === i);

    return { i, piezas, bien: deVeredicto(piezas, "correcta").length, mal: deVeredicto(piezas, "mejorable").length };
  });
  const maxTramo = Math.max(1, ...tramos.map((t) => t.piezas.length));
  const marcas = Array.from({ length: Math.floor(duracion / 900) + 1 }, (_, i) => i * 900).filter((s) => s <= duracion);

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

  /* Por jugador: con varios jugadores en un objetivo, la acción es de quien nombra la IA (lib/entreno/jugador.ts). */
  const nombres = new Map<string, string>();

  for (const f of filas) for (const j of f.objetivo.jugadores) if (normaliza(j.nombre)) nombres.set(normaliza(j.nombre), j.nombre);

  const porJugador = [...nombres.entries()]
    .map(([clave, nombre]) => {
      const fs = filas.map((f) => ({ ...f, acciones: f.objetivo.jugadores.some((j) => normaliza(j.nombre) === clave) ? accionesDelJugador(f.objetivo, f.acciones, clave) : [] })).filter((f) => f.acciones.length);

      return { clave, nombre, fs, c: cuentasDe(fs.flatMap((f) => f.acciones), val) };
    })
    .filter((j) => j.c.total > 0)
    .sort((a, b) => (b.c.pctBruto ?? 0) - (a.c.pctBruto ?? 0) || b.c.total - a.c.total);

  return (
    <section aria-labelledby="panel-visual" className="min-w-0 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      {/* 1. El titular */}
      <header className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96B]">El entrenamiento del {ddmm(fecha)} de un vistazo</p>
        <h2 id="panel-visual" className="text-xl font-semibold leading-tight text-white sm:text-2xl">
          {titular}
          {delta !== null && previo && Math.abs(delta) >= 5 ? (
            <span className="ml-2 inline-flex items-center gap-1 align-middle text-sm font-medium text-white/70">
              {delta > 0 ? <TrendingUp size={15} style={{ color: COLOR_BIEN }} aria-hidden /> : <TrendingDown size={15} style={{ color: COLOR_MEJORABLE }} aria-hidden />}
              {delta > 0 ? "+" : ""}
              {delta} puntos frente al {ddmm(previo.dia.fecha)}
            </span>
          ) : null}
        </h2>
        {lectura.length ? <p className="text-sm text-white/70">{lectura.join(" · ").replace(/^./, (l) => l.toUpperCase())}.</p> : null}
        <p className="text-[11px] text-white/45">Pulsa cualquier barra, punto o cifra para ver los clips que la forman.</p>
      </header>

      {/* 2. Cifras clave */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra valor={total.correctas} rotulo="Correctas" color={COLOR_BIEN} onClick={() => abre("Correctas del día", deVeredicto(todas, "correcta"))} />
        <Cifra valor={total.mejorables} rotulo="Mejorables" color={COLOR_MEJORABLE} onClick={() => abre("Mejorables del día", deVeredicto(todas, "mejorable"))} />
        {conClip.length ? <Cifra valor={conClip.length} rotulo="Con clip" icono={<Film size={13} className="text-[#C8A96B]" aria-hidden />} onClick={() => abre("Clips del día", conClip)} /> : null}
        {conMeta.length ? (
          <Cifra
            valor={`${enMeta}/${conMeta.length}`}
            rotulo="Objetivos en meta"
            icono={<CheckCircle2 size={13} style={{ color: COLOR_BIEN }} aria-hidden />}
            onClick={() => abre("Objetivos que cumplen su meta", piezasDe(dia, conMeta.filter((f) => f.cumple)))}
          />
        ) : total.pct !== null ? (
          <Cifra valor={`${total.pct} %`} rotulo="Acierto" onClick={() => abre("Todas las acciones del día", todas)} />
        ) : null}
      </div>

      <Leyenda />

      {/* 3. Cumplimiento por objetivo */}
      <Bloque titulo="Cumplimiento por objetivo" nota={`Barra = reparto de sus acciones; la raya dorada, la meta. Porcentaje con ${MINIMO_PORCENTAJE} acciones o más.`}>
        <div className="space-y-3">
          {filas.map((f) => (
            <FilaBarra
              key={f.objetivo.id}
              titulo={`${f.numero}. ${f.objetivo.objetivo}`}
              detalle={[f.objetivo.jugadores.map((j) => j.nombre).join(", "), f.objetivo.tarea ? `Tarea ${f.objetivo.tarea}` : ""].filter(Boolean).join(" · ")}
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
      <Bloque titulo="Cuándo pasa en la sesión" nota="Las acciones por minuto del vídeo: arriba, cuántas hay en cada tramo; debajo, cada objetivo en su calle. Relleno = validada; hueco = propuesta automática.">
        <div className="space-y-3">
          <div className="flex h-20 items-end gap-[2px]" role="group" aria-label="Acciones por tramo de la sesión">
            {tramos.map((t) =>
              t.piezas.length ? (
                <button
                  key={t.i}
                  type="button"
                  onClick={() => abre(`Del ${mmss(t.i * tramo)} al ${mmss(Math.min((t.i + 1) * tramo, duracion))}`, t.piezas)}
                  title={`${mmss(t.i * tramo)}–${mmss((t.i + 1) * tramo)}: ${t.bien} correctas, ${t.mal} mejorables`}
                  aria-label={`Del minuto ${mmss(t.i * tramo)} al ${mmss((t.i + 1) * tramo)}: ${t.bien} correctas y ${t.mal} mejorables`}
                  className={`group flex h-full min-w-0 flex-1 flex-col justify-end gap-[2px] rounded-sm ${FOCO}`}
                >
                  {t.mal ? <span className="block w-full rounded-t-[3px] transition-opacity group-hover:opacity-80" style={{ height: `${(78 * t.mal) / maxTramo}px`, background: COLOR_MEJORABLE }} /> : null}
                  {t.bien ? <span className={`block w-full transition-opacity group-hover:opacity-80 ${t.mal ? "" : "rounded-t-[3px]"}`} style={{ height: `${(78 * t.bien) / maxTramo}px`, background: COLOR_BIEN }} /> : null}
                </button>
              ) : (
                <span key={t.i} className="h-px min-w-0 flex-1 bg-white/10" aria-hidden />
              ),
            )}
          </div>

          <Eje marcas={marcas} duracion={duracion} />

          <div className="space-y-2.5">
            {filas.map((f) => {
              const ps = piezasDe(dia, [f]);

              return (
                <div key={f.objetivo.id} className="min-w-0">
                  <p className="truncate text-[11px] text-white/60" title={f.objetivo.objetivo}>
                    <span className="text-[#C8A96B]">{f.numero}.</span> {f.objetivo.objetivo}
                  </p>
                  <div className="relative h-6">
                    <span className="absolute inset-x-0 top-1/2 h-px bg-white/10" aria-hidden />
                    {ps.map((p) => {
                      const v = veredictoFinal(p.accion, val);
                      const validada = Boolean(val?.[p.accion.id]);
                      const color = v === "correcta" ? COLOR_BIEN : COLOR_MEJORABLE;

                      return (
                        <button
                          key={p.accion.id}
                          type="button"
                          onClick={() => abre(`${f.numero}. ${corto(f.objetivo.objetivo)}`, ps, undefined, claveDe(p))}
                          title={`${mmss(p.accion.inicio)} · ${v === "correcta" ? "correcta" : "mejorable"}${p.accion.clip ? " · con clip" : ""}`}
                          aria-label={`Minuto ${mmss(p.accion.inicio)}, ${v === "correcta" ? "correcta" : "mejorable"}${validada ? ", validada" : ", propuesta automática"}${p.accion.clip ? ", con clip" : ""}`}
                          className={`absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full hover:scale-125 ${FOCO}`}
                          style={{ left: `${Math.min(100, (100 * p.accion.inicio) / duracion)}%` }}
                        >
                          <span
                            className="block h-2.5 w-2.5 rounded-full"
                            style={{ background: validada ? color : "var(--rmcf-surface, #11161C)", border: `2px solid ${color}`, boxShadow: p.accion.clip ? "0 0 0 2px var(--rmcf-gold-ink)" : undefined }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {conClip.length ? (
            <p className="flex items-center gap-1.5 text-[11px] text-white/50">
              <span className="block h-2.5 w-2.5 rounded-full border-2 border-white/40" style={{ boxShadow: "0 0 0 2px var(--rmcf-gold-ink)" }} aria-hidden />
              Aro dorado = tiene clip cortado
            </p>
          ) : null}
        </div>
      </Bloque>

      {/* 5. Por tarea y por jugador */}
      {porTarea.length >= 2 || porJugador.length >= 2 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {porTarea.length >= 2 ? (
            <Bloque titulo="Por tarea" nota="Los objetivos atados a una tarea del registro, juntos.">
              <div className="space-y-3">
                {porTarea.map((t) => {
                  const c = cuentasDe(t.acciones, val);

                  return (
                    <FilaBarra
                      key={t.tarea}
                      titulo={`${t.tarea}${t.texto ? ` · ${t.texto}` : ""}`}
                      detalle={`${t.fs.length} ${t.fs.length === 1 ? "objetivo" : "objetivos"}`}
                      c={c}
                      onAbre={(v) => {
                        const ps = piezasDe(dia, t.fs);

                        abre(`Tarea ${t.tarea}`, v ? deVeredicto(ps, v) : ps, t.texto || undefined);
                      }}
                    />
                  );
                })}
              </div>
            </Bloque>
          ) : null}
          {porJugador.length >= 2 ? (
            <Bloque titulo="Por jugador" nota="Con varios jugadores en un objetivo, cuenta la acción de quien se nombra en el vídeo.">
              <div className="space-y-3">
                {porJugador.map((j) => (
                  <FilaBarra
                    key={j.clave}
                    titulo={j.nombre}
                    detalle={`${j.fs.length} ${j.fs.length === 1 ? "objetivo" : "objetivos"}`}
                    c={j.c}
                    onAbre={(v) => {
                      const ps = piezasDe(dia, j.fs);

                      abre(j.nombre, v ? deVeredicto(ps, v) : ps);
                    }}
                  />
                ))}
              </div>
            </Bloque>
          ) : null}
        </div>
      ) : null}

      {/* 6. Evolución entre sesiones */}
      {evolucion.length >= 2 ? (
        <Bloque titulo="Evolución entre sesiones" nota={`Acierto de cada entrenamiento analizado. Columna con borde discontinuo = menos de ${MINIMO_PORCENTAJE} acciones (tendencia).`}>
          <div className="flex h-40 items-end gap-2 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Acierto por sesión">
            {evolucion.map((x) => {
              const esHoy = x.dia.fecha === fecha;
              const pct = x.c.pctBruto ?? 0;
              const ps = piezasDe(x.dia, x.filas);

              return (
                <div key={x.dia.fecha} className="flex h-full min-w-[44px] flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[11px] font-semibold tabular-nums text-white/80">{x.c.pct !== null ? `${x.c.pct} %` : `${x.c.correctas}/${x.c.total}`}</span>
                  <button
                    type="button"
                    onClick={() => abre(`Entrenamiento del ${ddmm(x.dia.fecha)}`, ps, `${x.c.correctas} de ${x.c.total} correctas`)}
                    title={`${ddmm(x.dia.fecha)}: ${x.c.correctas} de ${x.c.total} correctas`}
                    aria-label={`${ddmm(x.dia.fecha)}: ${x.c.correctas} de ${x.c.total} correctas. Ver sus clips`}
                    className={`w-full max-w-[56px] rounded-t-[4px] hover:opacity-80 ${FOCO} ${x.c.muestraCorta ? "border-2 border-dashed" : ""}`}
                    style={{
                      height: `${Math.max(4, pct)}px`,
                      background: x.c.muestraCorta ? "transparent" : esHoy ? "var(--rmcf-gold-ink)" : "rgb(var(--rmcf-ink-rgb) / .28)",
                      borderColor: esHoy ? "var(--rmcf-gold-ink)" : "rgb(var(--rmcf-ink-rgb) / .4)",
                    }}
                  />
                  <button type="button" onClick={() => !esHoy && onIrAlDia(x.dia.fecha)} disabled={esHoy} className={`rounded text-[10px] tabular-nums ${FOCO} ${esHoy ? "font-semibold text-[#C8A96B]" : "text-white/55 hover:text-white hover:underline"}`} title={esHoy ? undefined : "Abrir ese día"}>
                    {ddmm(x.dia.fecha)}
                  </button>
                </div>
              );
            })}
          </div>
        </Bloque>
      ) : null}

      {visor ? <VisorClips peticion={visor} onClose={() => setVisor(null)} validacionesDe={validacionesDe} fechaEditable={fecha} onValida={onValida} /> : null}
    </section>
  );
}

function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-2.5 border-t border-white/10 pt-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{titulo}</h3>
        {nota ? <p className="text-[11px] text-white/45">{nota}</p> : null}
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
        <span className="h-3 w-0.5" style={{ background: "var(--rmcf-gold-ink)" }} /> Meta
      </span>
    </div>
  );
}

function Cifra({ valor, rotulo, color, icono, onClick }: { valor: number | string; rotulo: string; color?: string; icono?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-[#C8A96B]/50 ${FOCO}`} title="Ver los clips">
      <p className="truncate text-2xl font-semibold tabular-nums text-white">{valor}</p>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/50">
        {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden /> : icono}
        {rotulo}
      </p>
    </button>
  );
}

/** Una barra 100 % correcta/mejorable con su meta y su semáforo; cada trozo y cada cifra abren sus clips. */
function FilaBarra({ titulo, detalle, c, meta, cumple = null, onAbre }: { titulo: string; detalle?: string; c: Cuentas; meta?: number; cumple?: boolean | null; onAbre: (v: "correcta" | "mejorable" | null) => void }) {
  const pct = c.pctBruto ?? 0;

  return (
    <div className="grid min-w-0 gap-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-4">
      <button type="button" onClick={() => onAbre(null)} className={`min-w-0 rounded text-left ${FOCO}`} title={titulo}>
        <p className="truncate text-sm text-white/90 hover:underline">{titulo}</p>
        {detalle ? <p className="truncate text-[11px] text-white/50">{detalle}</p> : null}
      </button>
      <div className="min-w-0 space-y-1">
        <div className="relative">
          <div className="flex h-4 gap-[2px] overflow-hidden rounded-[4px]">
            {c.correctas ? (
              <button type="button" onClick={() => onAbre("correcta")} aria-label={`${c.correctas} correctas: ver clips`} title={`${c.correctas} correctas`} className={`h-full hover:opacity-80 ${FOCO}`} style={{ width: `${pct}%`, background: COLOR_BIEN }} />
            ) : null}
            {c.mejorables ? (
              <button type="button" onClick={() => onAbre("mejorable")} aria-label={`${c.mejorables} mejorables: ver clips`} title={`${c.mejorables} mejorables`} className={`h-full flex-1 hover:opacity-80 ${FOCO}`} style={{ background: COLOR_MEJORABLE }} />
            ) : null}
          </div>
          {meta ? <span className="pointer-events-none absolute -bottom-1 -top-1 w-0.5 rounded-full" style={{ left: `calc(${meta}% - 1px)`, background: "var(--rmcf-gold-ink)" }} aria-hidden title={`Meta ${meta} %`} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-white/65">
          {c.correctas ? (
            <button type="button" onClick={() => onAbre("correcta")} className={`rounded hover:text-white hover:underline ${FOCO}`}>
              {c.correctas} bien
            </button>
          ) : null}
          {c.mejorables ? (
            <button type="button" onClick={() => onAbre("mejorable")} className={`rounded hover:text-white hover:underline ${FOCO}`}>
              {c.mejorables} a mejorar
            </button>
          ) : null}
          <span className="font-semibold text-white/85">{c.pct !== null ? `${c.pct} %` : "tendencia"}</span>
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
