"use client";

/*
|--------------------------------------------------------------------------
| COPIAR UN DÍA (O UNA TAREA) DE OTRO MICROCICLO (02/11/2026)
|--------------------------------------------------------------------------
|
| Antes sólo se podía copiar la semana entera. Aquí se elige UN día de
| cualquier microciclo de la hoja —con buscador, los recientes arriba— o la
| sesión tipo de su MD, se ven sus tareas y se copian todas, unas cuantas o
| una sola, reemplazando lo que hay o añadiéndolo detrás. Nada se escribe en
| la hoja: entra en el micro de la pantalla y se deshace con Ctrl+Z.
|
| Teclado: el buscador tiene el foco al abrir; Intro abre el primer
| microciclo de la lista; Ctrl+Intro copia lo marcado.
*/

import { useMemo, useState, type KeyboardEvent } from "react";
import { ClipboardCopy, Search, Sparkles, Star } from "lucide-react";

import { Button, Dialog } from "@/components/abp/ui";
import type { RegistroTarea } from "@/lib/abp/registro";
import { etiquetaDia } from "@/lib/abp/ventana";
import {
  fechaCorta,
  filtraMicros,
  nombreDeEjercicio,
  ultimosDelMd,
  type MicroDeLaHoja,
  type ModoPegar,
  type SesionTipo,
} from "@/lib/registro/rellenar";
import { plural } from "@/lib/registro/semana";

type Fuente = { tipo: "dia"; clave: string; fecha: string } | { tipo: "tipo" };

export type CopiaElegida = {
  tareas: RegistroTarea[];
  modo: ModoPegar;
  conTiempos: boolean;
  /** «el MD-3 del micro 18 (ALGECIRAS)», para el aviso. */
  origen: string;
};

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

export function CopiarDia({
  micros,
  md,
  titulo,
  tipo,
  escritas,
  onCopia,
  onClose,
}: {
  /** Los microciclos de la hoja, recientes primero (sin el que se edita). */
  micros: MicroDeLaHoja[];
  /** El MD del día de destino: sus días salen primero. */
  md: string;
  /** «Martes 4 · MD-3», el día de destino. */
  titulo: string;
  tipo: SesionTipo | null;
  /** Tareas ya escritas en el día de destino: deciden el modo por defecto. */
  escritas: number;
  onCopia: (copia: CopiaElegida) => void;
  onClose: () => void;
}) {
  const mdDestino = md.trim().toUpperCase();
  const recientesDelMd = useMemo(() => ultimosDelMd(micros, mdDestino, 4), [micros, mdDestino]);

  /* Por defecto, el último día con el mismo MD; si no hay, el primer día del micro más reciente. */
  const inicial: Fuente | null = recientesDelMd[0]
    ? { tipo: "dia", clave: recientesDelMd[0].micro.clave, fecha: recientesDelMd[0].dia.fecha }
    : micros[0]?.dias[0]
      ? { tipo: "dia", clave: micros[0].clave, fecha: micros[0].dias[micros[0].dias.length - 1].fecha }
      : tipo
        ? { tipo: "tipo" }
        : null;

  const [fuente, setFuente] = useState<Fuente | null>(inicial);
  const [abierto, setAbierto] = useState<string>(inicial?.tipo === "dia" ? inicial.clave : (micros[0]?.clave ?? ""));
  const [consulta, setConsulta] = useState("");
  const [fuera, setFuera] = useState<Set<number>>(new Set());
  const [modo, setModo] = useState<ModoPegar>(escritas > 0 ? "anadir" : "reemplazar");
  const [conTiempos, setConTiempos] = useState(false);

  const filtrados = useMemo(() => filtraMicros(micros, consulta), [micros, consulta]);

  const microAbierto = micros.find((uno) => uno.clave === abierto) ?? null;

  const elegido = useMemo(() => {
    if (!fuente) return null;

    if (fuente.tipo === "tipo") {
      return tipo ? { tareas: tipo.tareas, origen: `la sesión tipo del ${tipo.md}`, nota: 0, minutos: tipo.tareas.reduce((s, t) => s + (t.tiempo || 0), 0) } : null;
    }

    const suyo = micros.find((uno) => uno.clave === fuente.clave);
    const dia = suyo?.dias.find((uno) => uno.fecha === fuente.fecha);

    if (!suyo || !dia) return null;

    return {
      tareas: dia.tareas,
      origen: `el ${etiquetaDia(dia.fecha)}${dia.md ? ` (${dia.md})` : ""} del micro ${suyo.micro}${suyo.rival ? ` · ${suyo.rival}` : ""}`,
      nota: dia.nota,
      minutos: dia.minutos,
    };
  }, [fuente, micros, tipo]);

  const marcadas = elegido ? elegido.tareas.filter((_, i) => !fuera.has(i)) : [];

  const eligeFuente = (nueva: Fuente) => {
    setFuente(nueva);
    setFuera(new Set());

    if (nueva.tipo === "dia") setAbierto(nueva.clave);
  };

  const copia = (tareas: RegistroTarea[], modoUsado: ModoPegar = modo) => {
    if (!elegido || tareas.length === 0) return;

    onCopia({ tareas, modo: modoUsado, conTiempos, origen: elegido.origen });
  };

  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault();
      copia(marcadas);
    }
  };

  const chip = (activo: boolean) =>
    `rounded-xl border px-2.5 py-1.5 text-left text-[12px] transition ${
      activo
        ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-white"
        : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white"
    }`;

  return (
    <Dialog
      title={`Copiar un día en el ${titulo}`}
      subtitle="Elige un día de cualquier microciclo (o la sesión tipo de su MD), marca sus tareas y cópialas. Se deshace con Ctrl+Z."
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex rounded-lg border border-white/10 p-0.5 text-[12px]" role="group" aria-label="Cómo se copia">
              <button
                type="button"
                aria-pressed={modo === "reemplazar"}
                onClick={() => setModo("reemplazar")}
                className={`rounded-md px-2.5 py-1 transition ${modo === "reemplazar" ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
              >
                Reemplazar
              </button>
              <button
                type="button"
                aria-pressed={modo === "anadir"}
                onClick={() => setModo("anadir")}
                className={`rounded-md px-2.5 py-1 transition ${modo === "anadir" ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
              >
                Añadir detrás
              </button>
            </div>

            <label className="flex items-center gap-2 text-[12px] text-white/60">
              <input
                type="checkbox"
                checked={conTiempos}
                onChange={(evento) => setConTiempos(evento.target.checked)}
                className="h-4 w-4 accent-[#C8A96B]"
              />
              Con tiempo e intensidad
            </label>
          </div>

          <Button onClick={onClose}>Cancelar</Button>

          <Button tone="primary" icon={ClipboardCopy} disabled={marcadas.length === 0} onClick={() => copia(marcadas)} title="Ctrl+Intro">
            {elegido && marcadas.length === elegido.tareas.length ? "Copiar este día" : `Copiar ${plural(marcadas.length, "tarea", "tareas")}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={alTeclear}>
        {/* ---- Atajos del mismo MD ---- */}
        {(tipo || recientesDelMd.length > 0) && (
          <section>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">Lo habitual en el {mdDestino}</p>

            <div className="flex flex-wrap gap-2">
              {tipo && (
                <button type="button" onClick={() => eligeFuente({ tipo: "tipo" })} className={chip(fuente?.tipo === "tipo")}>
                  <span className="flex items-center gap-1 font-semibold text-[#C8A96B]">
                    <Sparkles size={12} aria-hidden /> Sesión tipo del {tipo.md}
                  </span>
                  <span className="block text-[11px] text-white/50">
                    {plural(tipo.tareas.length, "tarea", "tareas")} · lo más repetido en {plural(tipo.sesiones, "sesión", "sesiones")}
                  </span>
                </button>
              )}

              {recientesDelMd.map(({ micro, dia }) => (
                <button
                  key={`${micro.clave}-${dia.fecha}`}
                  type="button"
                  onClick={() => eligeFuente({ tipo: "dia", clave: micro.clave, fecha: dia.fecha })}
                  className={chip(fuente?.tipo === "dia" && fuente.clave === micro.clave && fuente.fecha === dia.fecha)}
                >
                  <span className="block font-semibold">
                    Micro {micro.micro}
                    {micro.rival ? ` · ${micro.rival}` : ""}
                  </span>
                  <span className="block text-[11px] text-white/50">
                    {mayuscula(etiquetaDia(dia.fecha))} {fechaCorta(dia.fecha)} · {plural(dia.tareas.length, "tarea", "tareas")}
                    {dia.minutos > 0 ? ` · ${dia.minutos}′` : ""}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---- Cualquier microciclo ---- */}
        <section>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">O cualquier día de cualquier microciclo</p>

          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" aria-hidden />
            <input
              type="search"
              autoFocus
              value={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" && !evento.ctrlKey && !evento.metaKey && filtrados[0]) {
                  evento.preventDefault();
                  setAbierto(filtrados[0].clave);
                }
              }}
              placeholder="Buscar: «18», «Algeciras», «MD-3 rondo»"
              title="Busca por número, rival, MD, fecha o tipo de tarea"
              aria-label="Buscar un microciclo"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
            />
          </label>

          <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
            <ul className="max-h-56 space-y-1 overflow-y-auto pr-1 md:max-h-72" aria-label="Microciclos de la hoja">
              {filtrados.length === 0 ? (
                <li className="px-2 py-3 text-[12px] text-white/45">Ningún microciclo encaja con «{consulta}».</li>
              ) : (
                filtrados.map((uno) => (
                  <li key={uno.clave}>
                    <button
                      type="button"
                      onClick={() => setAbierto(uno.clave)}
                      aria-pressed={abierto === uno.clave}
                      className={`w-full ${chip(abierto === uno.clave)}`}
                    >
                      <span className="block truncate font-semibold">
                        Micro {uno.micro}
                        {uno.rival ? ` · ${uno.rival}` : ""}
                      </span>
                      <span className="block text-[11px] text-white/50">
                        {fechaCorta(uno.desde)}–{fechaCorta(uno.hasta)} · {plural(uno.dias.length, "día", "días")} · {plural(uno.tareas, "tarea", "tareas")}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="min-w-0">
              {microAbierto ? (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {microAbierto.dias.map((dia) => {
                    const activo = fuente?.tipo === "dia" && fuente.clave === microAbierto.clave && fuente.fecha === dia.fecha;
                    const mismoMd = dia.md === mdDestino;

                    return (
                      <button
                        key={dia.fecha}
                        type="button"
                        onClick={() => eligeFuente({ tipo: "dia", clave: microAbierto.clave, fecha: dia.fecha })}
                        aria-pressed={activo}
                        className={chip(activo)}
                      >
                        <span className="flex items-center gap-1.5 font-semibold">
                          {mayuscula(etiquetaDia(dia.fecha))}
                          {dia.md ? <span className={mismoMd ? "text-[#C8A96B]" : "text-white/50"}>{dia.md}</span> : null}
                          {mismoMd ? <Star size={11} className="text-[#C8A96B]" aria-label="Mismo MD" /> : null}
                        </span>
                        <span className="block text-[11px] text-white/50">
                          {plural(dia.tareas.length, "tarea", "tareas")}
                          {dia.minutos > 0 ? ` · ${dia.minutos}′` : ""}
                          {dia.nota > 0 ? ` · nota ${String(dia.nota).replace(".", ",")}` : ""}
                        </span>
                        {dia.resumen ? <span className="mt-0.5 block truncate text-[11px] text-white/40">{dia.resumen}</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="px-2 py-3 text-[12px] text-white/45">Elige un microciclo de la lista.</p>
              )}
            </div>
          </div>
        </section>

        {/* ---- Vista previa ---- */}
        {elegido && (
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[12px] font-semibold text-white/85">
                {mayuscula(elegido.origen)}
                <span className="ml-1.5 font-normal text-white/45">
                  · {plural(elegido.tareas.length, "tarea", "tareas")}
                  {elegido.minutos > 0 ? ` · ${elegido.minutos}′` : ""}
                </span>
              </p>

              <button
                type="button"
                onClick={() => setFuera(fuera.size === 0 ? new Set(elegido.tareas.map((_, i) => i)) : new Set())}
                className="text-[11px] font-semibold text-white/55 hover:text-white"
              >
                {fuera.size === 0 ? "Desmarcar todas" : "Marcar todas"}
              </button>
            </div>

            <ul className="space-y-1.5">
              {elegido.tareas.map((tarea, i) => (
                <li key={`${tarea.tarea}-${i}`} className="flex items-start gap-2 rounded-lg border border-white/[0.06] px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={!fuera.has(i)}
                    onChange={() => {
                      const siguiente = new Set(fuera);

                      if (siguiente.has(i)) siguiente.delete(i);
                      else siguiente.add(i);

                      setFuera(siguiente);
                    }}
                    aria-label={`Copiar ${nombreDeEjercicio(tarea) || tarea.tarea}`}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#C8A96B]"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-white/85">
                      <span className="font-semibold">{tarea.tipoTarea || tarea.tarea}</span>
                      {tarea.contenidoPrincipal ? ` · ${tarea.contenidoPrincipal}` : ""}
                      {tarea.contenidoSecundario ? ` / ${tarea.contenidoSecundario}` : ""}
                    </p>
                    <p className="text-[11px] text-white/45">
                      {[
                        tarea.fase,
                        tarea.formato,
                        tarea.espacio,
                        tarea.tiempo > 0 ? `${tarea.tiempo}′` : "",
                        tarea.intensidad > 0 ? `int. ${tarea.intensidad}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => copia([tarea], "anadir")}
                    title="Añade sólo esta tarea al día, detrás de lo que ya tiene"
                    className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-white/65 transition hover:border-white/25 hover:text-white"
                  >
                    Sólo esta
                  </button>
                </li>
              ))}
            </ul>

            {modo === "reemplazar" && escritas > 0 ? (
              <p className="mt-2 text-[11px] text-[#C8A96B]">
                Reemplazar quita lo que ya tiene el día ({plural(escritas, "tarea", "tareas")}; el partido se queda). Se recupera con Deshacer.
              </p>
            ) : null}
          </section>
        )}
      </div>
    </Dialog>
  );
}
