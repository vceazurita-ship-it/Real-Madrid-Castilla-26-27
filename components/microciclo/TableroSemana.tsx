"use client";

/**
 * EL TABLERO DE LA SEMANA (21/10/2026).
 *
 * El microciclo de un vistazo, como lo piensa el cuerpo técnico: una columna
 * por día y una tarjeta por tarea. Se reorganiza aquí y se rellena abajo.
 *
 * - **Arrastrar y soltar** una tarjeta la lleva a otro día o a otra posición.
 * - **Sin ratón** (y en el móvil, donde arrastrar no existe): se pulsa la
 *   tarjeta y salen las flechas; con el teclado, Alt + flechas mueve la
 *   tarjeta que tiene el foco e Intro lleva a su ficha.
 * - **Copiar un día en otro** con el desplegable de su cabecera.
 * - **La carga del día frente a lo que suele llevar ese MD** en la hoja, con la
 *   marca de la media encima de la barra. Sin tres sesiones parecidas no se
 *   compara con nada.
 *
 * Es sólo la cara: los cambios los hace la página con `lib/registro/semana.ts`.
 */

import { useState, type DragEvent, type KeyboardEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Moon, PenLine, Plus, Trophy } from "lucide-react";

import { FASES_ABP, tareaEnBlanco, type MicroNuevo, type TareaNueva } from "@/lib/registro/hoja";
import { cargaDelDia, esCompeticion, frenteAReferencia, type ReferenciaMd } from "@/lib/registro/semana";
import { etiquetaDia } from "@/lib/abp/ventana";
import { chipInk } from "@/lib/theme";

/** El color de la fase, el mismo en la tarjeta y en la leyenda. */
export function colorDeFase(fase: string) {
  const f = fase.toLowerCase();

  if (FASES_ABP.some((una) => una.toLowerCase() === f) || f.startsWith("abp")) return "#C8A96B";
  if (f.includes("competici")) return "#C8A96B";
  if (f.startsWith("tr")) return "#A78BFA";
  if (f.startsWith("ofens")) return "#34D399";
  if (f.startsWith("defens")) return "#60A5FA";
  if (f.startsWith("global")) return "#F472B6";
  if (f.startsWith("conduct")) return "#94A3B8";

  return "#64748B";
}

export const LEYENDA_FASES = [
  { nombre: "Ofensiva", color: colorDeFase("Ofensiva") },
  { nombre: "Defensiva", color: colorDeFase("Defensiva") },
  { nombre: "Transición", color: colorDeFase("Tr Ofensiva") },
  { nombre: "Global", color: colorDeFase("Global") },
  { nombre: "Balón parado", color: colorDeFase("ABP Global") },
];

type Hueco = { sesion: number; indice: number };

const esPartido = (md: string) => /^MD$/i.test(md.trim());

export function TableroSemana({
  micro,
  referencia,
  onMueve,
  onCopiaDia,
  onLibre,
  onAnade,
  onAbre,
}: {
  micro: MicroNuevo;
  referencia: Record<string, ReferenciaMd>;
  onMueve: (desde: { sesion: number; tarea: number }, hasta: Hueco) => void;
  onCopiaDia: (desde: number, hasta: number) => void;
  onLibre: (fecha: string, libre: boolean) => void;
  onAnade: (sesion: number) => void;
  /** Lleva a la ficha de la tarea, más abajo. */
  onAbre: (sesion: number, tarea: number) => void;
}) {
  /* La tarjeta que se arrastra o que se ha pulsado (para las flechas). */
  const [arrastrando, setArrastrando] = useState<{ sesion: number; tarea: number } | null>(null);
  const [sobre, setSobre] = useState<Hueco | null>(null);
  const [elegida, setElegida] = useState<{ sesion: number; tarea: number } | null>(null);

  const sesiones = micro.sesiones;

  /* Para que la barra de carga de todos los días hable la misma escala. Sin
     el partido: sus 90′ a tope aplastaban los días de entreno. */
  const cargas = sesiones.map((sesion) => cargaDelDia(sesion));
  const escala = Math.max(
    1,
    ...sesiones.map((sesion, i) =>
      esPartido(sesion.md) ? 0 : Math.max(cargas[i].carga, (referencia[sesion.md.trim().toUpperCase()]?.carga ?? 0) * 1.15),
    ),
  );

  const suelta = (evento: DragEvent, hueco: Hueco) => {
    evento.preventDefault();
    evento.stopPropagation();

    const origen = arrastrando;

    setArrastrando(null);
    setSobre(null);

    if (!origen) return;

    onMueve(origen, hueco);
    setElegida(null);
  };

  const encima = (evento: DragEvent, hueco: Hueco) => {
    if (!arrastrando) return;

    evento.preventDefault();
    evento.stopPropagation();
    evento.dataTransfer.dropEffect = "move";

    if (sobre?.sesion !== hueco.sesion || sobre?.indice !== hueco.indice) setSobre(hueco);
  };

  /* Mover con flechas: a la columna de al lado (saltando nada) o un puesto. */
  /* Los huecos en blanco no se ven en el tablero: subir o bajar salta a la
     tarjeta de al lado que sí se ve, no a un hueco invisible. */
  const vecinas = (sesion: number, tarea: number) => {
    const vistas = sesiones[sesion].tareas
      .map((una, i) => ({ una, i }))
      .filter(({ una }) => !tareaEnBlanco(una) && !esCompeticion(una))
      .map(({ i }) => i);
    const aqui = vistas.indexOf(tarea);

    return { antes: aqui > 0 ? vistas[aqui - 1] : null, despues: aqui >= 0 && aqui < vistas.length - 1 ? vistas[aqui + 1] : null };
  };

  const mueveCon = (sesion: number, tarea: number, direccion: "izq" | "der" | "arriba" | "abajo") => {
    if (direccion === "arriba" || direccion === "abajo") {
      const { antes, despues } = vecinas(sesion, tarea);
      const otra = direccion === "arriba" ? antes : despues;

      if (otra === null) return;

      onMueve({ sesion, tarea }, { sesion, indice: direccion === "arriba" ? otra : otra + 1 });
      setElegida({ sesion, tarea: otra });

      return;
    }

    const otra = direccion === "izq" ? sesion - 1 : sesion + 1;

    if (otra < 0 || otra >= sesiones.length) return;

    const destino = sesiones[otra].tareas.filter((una) => !esCompeticion(una)).length;

    onMueve({ sesion, tarea }, { sesion: otra, indice: destino });
    setElegida({ sesion: otra, tarea: destino });
  };

  const teclas = (evento: KeyboardEvent, sesion: number, tarea: number) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      onAbre(sesion, tarea);

      return;
    }

    if (!evento.altKey) return;

    const direccion = { ArrowLeft: "izq", ArrowRight: "der", ArrowUp: "arriba", ArrowDown: "abajo" }[evento.key] as
      | "izq"
      | "der"
      | "arriba"
      | "abajo"
      | undefined;

    if (!direccion) return;

    evento.preventDefault();
    mueveCon(sesion, tarea, direccion);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/50">
        {LEYENDA_FASES.map((fase) => (
          <span key={fase.nombre} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: fase.color }} aria-hidden />
            {fase.nombre}
          </span>
        ))}

        <span className="hidden text-white/35 md:inline">
          · Arrastra una tarea a otro día, o púlsala y usa las flechas (Alt + flechas con el teclado)
        </span>
      </div>

      <div
        className="grid gap-2.5 md:grid-cols-[repeat(var(--dias),minmax(0,1fr))]"
        style={{ ["--dias" as string]: String(Math.max(1, sesiones.length)) }}
      >
        {sesiones.map((sesion, s) => {
          const partido = esPartido(sesion.md);
          const md = sesion.md.trim().toUpperCase();
          const ref = referencia[md];
          const dia = cargas[s];
          const frente = dia.completa ? frenteAReferencia(dia.carga, ref) : null;
          const visibles = sesion.tareas
            .map((tarea, t) => ({ tarea, t }))
            .filter(({ tarea }) => !tareaEnBlanco(tarea) || esCompeticion(tarea));
          const enBlanco = sesion.tareas.length - visibles.length;
          const resaltada = sobre?.sesion === s;

          return (
            <section
              key={`${sesion.fecha}-${s}`}
              aria-label={`${etiquetaDia(sesion.fecha)}, ${sesion.md || "sin MD"}`}
              onDragOver={(evento) => encima(evento, { sesion: s, indice: sesion.tareas.filter((una) => !esCompeticion(una)).length })}
              onDragLeave={(evento) => {
                if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setSobre(null);
              }}
              onDrop={(evento) => suelta(evento, { sesion: s, indice: sesion.tareas.filter((una) => !esCompeticion(una)).length })}
              className={`flex min-w-0 flex-col rounded-2xl border p-2.5 transition ${
                resaltada
                  ? "border-[#C8A96B]/60 bg-[#C8A96B]/[0.08]"
                  : partido
                    ? "border-[#C8A96B]/30 bg-[#C8A96B]/[0.05]"
                    : sesion.libre
                      ? "border-white/[0.06] bg-white/[0.015]"
                      : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <header className="mb-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold capitalize text-white/90">{etiquetaDia(sesion.fecha)}</p>

                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
                    style={partido ? { background: "rgb(200 169 107 / .18)", color: chipInk("#C8A96B") } : undefined}
                  >
                    {sesion.md || "¿MD?"}
                  </span>
                </div>

                {!sesion.libre && !partido && (
                  <div className="mt-1.5">
                    <div className="flex items-baseline justify-between text-[10px] tabular-nums text-white/50">
                      <span>{dia.minutos > 0 ? `${dia.minutos}′` : ""}</span>
                      {dia.carga > 0 && <span title="Carga = tiempo × intensidad">carga {dia.carga}</span>}
                    </div>

                    <div className="relative mt-1 h-1.5 rounded-full bg-white/[0.06]" aria-hidden>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (dia.carga / escala) * 100)}%`,
                          background: frente?.tono === "alta" ? "#F59E0B" : frente?.tono === "baja" ? "#60A5FA" : "#34D399",
                        }}
                      />

                      {ref && (
                        <span
                          className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-white/60"
                          style={{ left: `calc(${Math.min(100, (ref.carga / escala) * 100)}% - 1px)` }}
                        />
                      )}
                    </div>

                    {ref && (
                      <p className="mt-1 text-[10px] leading-snug text-white/40">
                        {frente
                          ? `${frente.diferencia > 0 ? "+" : ""}${frente.diferencia} % frente a su media (${ref.carga})`
                          : `media del ${md}: ${ref.carga} · ${ref.minutos}′`}
                      </p>
                    )}
                  </div>
                )}
              </header>

              {sesion.libre ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-2 py-5 text-center">
                  <Moon size={15} className="text-white/35" aria-hidden />
                  <p className="text-[11px] text-white/45">Día libre</p>
                  <button
                    type="button"
                    onClick={() => onLibre(sesion.fecha, false)}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-[#C8A96B] hover:bg-[#C8A96B]/10"
                  >
                    Entrenar este día
                  </button>
                </div>
              ) : (
                <ol className="flex flex-1 flex-col gap-1.5">
                  {visibles.map(({ tarea, t }) => (
                    <Tarjeta
                      key={`${sesion.fecha}-${t}-${tarea.tarea}`}
                      tarea={tarea}
                      elegida={elegida?.sesion === s && elegida?.tarea === t}
                      fantasma={arrastrando?.sesion === s && arrastrando?.tarea === t}
                      marcaEncima={sobre?.sesion === s && sobre?.indice === t && Boolean(arrastrando)}
                      puedeIzq={s > 0}
                      puedeDer={s < sesiones.length - 1}
                      puedeArriba={vecinas(s, t).antes !== null}
                      puedeAbajo={vecinas(s, t).despues !== null}
                      onElige={() => setElegida(elegida?.sesion === s && elegida?.tarea === t ? null : { sesion: s, tarea: t })}
                      onAbre={() => onAbre(s, t)}
                      onMueve={(direccion) => mueveCon(s, t, direccion)}
                      onTecla={(evento) => teclas(evento, s, t)}
                      onEmpieza={(evento) => {
                        evento.dataTransfer.effectAllowed = "move";
                        evento.dataTransfer.setData("text/plain", tarea.tarea);
                        setArrastrando({ sesion: s, tarea: t });
                      }}
                      onAcaba={() => {
                        setArrastrando(null);
                        setSobre(null);
                      }}
                      onEncima={(evento) => encima(evento, { sesion: s, indice: t })}
                      onSuelta={(evento) => suelta(evento, { sesion: s, indice: t })}
                    />
                  ))}

                  {visibles.length === 0 && (
                    <li className="rounded-xl border border-dashed border-white/10 px-2 py-4 text-center text-[11px] text-white/40">
                      {arrastrando ? "Suelta aquí" : "Sin tareas todavía"}
                    </li>
                  )}

                  {enBlanco > 0 && (
                    <li className="px-1 text-[10px] text-white/35">
                      + {enBlanco} hueco(s) en blanco, que no se escriben
                    </li>
                  )}
                </ol>
              )}

              {!sesion.libre && (
                <div className="mt-2 flex items-center gap-1.5 border-t border-white/[0.06] pt-2">
                  <button
                    type="button"
                    onClick={() => onAnade(s)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-white/55 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <Plus size={12} aria-hidden /> Tarea
                  </button>

                  {dia.tareas > 0 && !partido && (
                    <select
                      value=""
                      aria-label={`Copiar las tareas del ${etiquetaDia(sesion.fecha)} en otro día`}
                      onChange={(evento) => {
                        if (evento.target.value !== "") onCopiaDia(s, Number(evento.target.value));
                      }}
                      className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-transparent px-1 py-1 text-[11px] text-white/55"
                    >
                      <option value="">Copiar a…</option>
                      {sesiones.map((otra, o) =>
                        o === s || esPartido(otra.md) ? null : (
                          <option key={`${otra.fecha}-${o}`} value={o}>
                            {etiquetaDia(otra.fecha)} · {otra.md || "¿MD?"}
                            {otra.libre ? " (libre)" : ""}
                          </option>
                        ),
                      )}
                    </select>
                  )}

                  {!partido && dia.tareas === 0 && (
                    <button
                      type="button"
                      onClick={() => onLibre(sesion.fecha, true)}
                      className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-white/45 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <Moon size={11} aria-hidden /> Libre
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Tarjeta({
  tarea,
  elegida,
  fantasma,
  marcaEncima,
  puedeIzq,
  puedeDer,
  puedeArriba,
  puedeAbajo,
  onElige,
  onAbre,
  onMueve,
  onTecla,
  onEmpieza,
  onAcaba,
  onEncima,
  onSuelta,
}: {
  tarea: TareaNueva;
  elegida: boolean;
  fantasma: boolean;
  marcaEncima: boolean;
  puedeIzq: boolean;
  puedeDer: boolean;
  puedeArriba: boolean;
  puedeAbajo: boolean;
  onElige: () => void;
  onAbre: () => void;
  onMueve: (direccion: "izq" | "der" | "arriba" | "abajo") => void;
  onTecla: (evento: KeyboardEvent) => void;
  onEmpieza: (evento: DragEvent) => void;
  onAcaba: () => void;
  onEncima: (evento: DragEvent) => void;
  onSuelta: (evento: DragEvent) => void;
}) {
  const comp = esCompeticion(tarea);
  const color = colorDeFase(tarea.fase);
  const titulo = tarea.tipoTarea || (comp ? "Competición" : "Tarea sin tipo");
  const contenido = comp
    ? tarea.contenidoSecundario
    : [tarea.contenidoPrincipal, tarea.contenidoSecundario].filter(Boolean).join(" · ");
  const datos = [tarea.tiempo > 0 ? `${tarea.tiempo}′` : "", tarea.intensidad > 0 ? `int. ${tarea.intensidad}` : "", tarea.formato].filter(Boolean);

  const flecha =
    "flex h-7 w-7 items-center justify-center rounded-md text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-25";

  return (
    <li
      onDragOver={onEncima}
      onDrop={onSuelta}
      className={`relative ${marcaEncima ? "before:absolute before:-top-1 before:left-1 before:right-1 before:h-0.5 before:rounded before:bg-[#C8A96B]" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
        draggable={!comp}
        aria-pressed={elegida}
        aria-label={`${tarea.tarea}: ${titulo}${contenido ? `, ${contenido}` : ""}${datos.length ? `, ${datos.join(", ")}` : ""}. Intro para editar${comp ? "" : "; Alt y flechas para moverla"}.`}
        onClick={onElige}
        onDoubleClick={onAbre}
        onKeyDown={onTecla}
        onDragStart={onEmpieza}
        onDragEnd={onAcaba}
        className={`group rounded-xl border px-2.5 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#C8A96B]/60 ${
          comp ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        } ${fantasma ? "opacity-40" : ""} ${
          elegida ? "border-[#C8A96B]/60 bg-[#C8A96B]/[0.08]" : "border-white/[0.08] bg-white/[0.035] hover:border-white/20"
        }`}
        style={{ boxShadow: `inset 3px 0 0 ${color}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold tabular-nums text-white/45">{tarea.tarea}</span>
          {comp ? (
            <Trophy size={11} style={{ color: chipInk("#C8A96B") }} aria-hidden />
          ) : (
            tarea.fase && (
              <span className="truncate text-[10px]" style={{ color: chipInk(color) }}>
                {tarea.fase}
              </span>
            )
          )}
        </div>

        <p className="mt-0.5 text-[12px] font-medium leading-snug text-white/90">{titulo}</p>

        {contenido && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/55">{contenido}</p>}

        {datos.length > 0 && <p className="mt-1 text-[10px] tabular-nums text-white/45">{datos.join(" · ")}</p>}
      </div>

      {elegida && (
        <div className="mt-1 flex items-center justify-between gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1 py-0.5">
          {!comp && (
            <div className="flex">
              <button type="button" className={flecha} disabled={!puedeIzq} onClick={() => onMueve("izq")} aria-label="Al día anterior" title="Al día anterior">
                <ArrowLeft size={13} aria-hidden />
              </button>
              <button type="button" className={flecha} disabled={!puedeArriba} onClick={() => onMueve("arriba")} aria-label="Subir" title="Subir">
                <ArrowUp size={13} aria-hidden />
              </button>
              <button type="button" className={flecha} disabled={!puedeAbajo} onClick={() => onMueve("abajo")} aria-label="Bajar" title="Bajar">
                <ArrowDown size={13} aria-hidden />
              </button>
              <button type="button" className={flecha} disabled={!puedeDer} onClick={() => onMueve("der")} aria-label="Al día siguiente" title="Al día siguiente">
                <ArrowRight size={13} aria-hidden />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onAbre}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#C8A96B] hover:bg-[#C8A96B]/10"
          >
            <PenLine size={12} aria-hidden /> Editar
          </button>
        </div>
      )}
    </li>
  );
}
