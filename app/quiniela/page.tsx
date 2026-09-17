"use client";

/**
 * LA QUINIELA DE LA SEMANA.
 *
 * Lo único de la plataforma que no es trabajo: cada uno pone su 1-X-2 a los
 * diez partidos de la jornada, se meten los resultados el lunes y el acierto
 * se cuenta solo. El cuerpo técnico compite entre sí toda la temporada.
 *
 * **El calendario es dato del repositorio** (`lib/quiniela/calendario.ts`), no
 * de la hoja: son treinta y ocho jornadas que no cambian, y en el proyecto no
 * había ninguna fuente con la jornada completa —sólo el partido del Castilla—,
 * así que se volcó una vez del Excel que trajo el cuerpo técnico.
 *
 * **Lo que se rellena vive en Supabase**, en un documento por temporada
 * (`quiniela`), con los pronósticos de cada uno y los resultados. Las reglas
 * de acierto están aparte, en `lib/quiniela/modelo.ts`, para poder
 * comprobarlas sin abrir el navegador: el ranking es lo único que la gente va
 * a discutir.
 */

import { useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  ListOrdered,
  Music,
  Quote,
  Smile,
  Trophy,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  AbpHeader,
  Button,
  Dialog,
  EmptyState,
  Field,
  Notice,
  Panel,
  SaveState,
  TextArea,
} from "@/components/abp/ui";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  JORNADAS,
  NOMBRE_DEL_SIGNO,
  QUINIELA_VACIA,
  SIGNOS,
  bloqueCerrado,
  bloqueDe,
  jornadaDeHoy,
  jornadaVacia,
  partidosDe,
  ranking,
  rankingDeBloque,
  rarezasDe,
  type DocumentoQuiniela,
  type ExtrasJugador,
  type JornadaQuiniela,
  type Signo,
} from "@/lib/quiniela/modelo";
import { Avatar } from "@/components/quiniela/Avatar";
import {
  INICIALES_SIN_DUENO,
  JUEGAN_POR_DEFECTO,
  PERSONA_POR_SLUG,
  STAFF,
  nombreCorto,
} from "@/lib/quiniela/staff";

/** El día de hoy en "2026-09-16", que es como se guardan las fechas. */
function hoyTexto() {
  const ahora = new Date();

  const dos = (n: number) => String(n).padStart(2, "0");

  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/** "2026-08-30" → "30 ago". */
function fechaCorta(fecha: string) {
  if (!fecha) return "";

  const [, mes, dia] = fecha.split("-");

  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  return `${Number(dia)} ${meses[Number(mes) - 1] ?? ""}`;
}

export default function QuinielaPage() {
  const {
    value: doc,
    setValue: setDoc,
    status,
    localOnly,
    lastSavedAt,
  } = useRemoteDoc<DocumentoQuiniela>({
    key: "quiniela",
    kind: "quiniela",
    fallback: QUINIELA_VACIA,
  });

  /*
  | Quién juega.
  |
  | Si nadie lo ha decidido todavía, juegan los diez que venían con columna en
  | el Excel del cuerpo técnico. No se guarda esa lista sola al entrar: hasta
  | que alguien toque algo, el documento sigue vacío y no se escribe nada.
  */
  const jugadores = doc.jugadores.length > 0 ? doc.jugadores : JUEGAN_POR_DEFECTO;

  const [jornada, setJornada] = useState(() => jornadaDeHoy(hoyTexto()));

  /* Quién está rellenando. Es de la pestaña, no del documento: cada uno entra
     desde su ordenador y pone lo suyo. */
  const [yo, setYo] = useState<string | null>(null);

  const [eligiendoJugadores, setEligiendoJugadores] = useState(false);

  /* De quién se está editando la canción, la frase y la foto de broma. */
  const [editandoExtras, setEditandoExtras] = useState<string | null>(null);

  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const extras = doc.extras ?? {};

  /**
   * Guarda lo que alguien se pone de su cosecha.
   *
   * Va aparte de los pronósticos a propósito: esto no caduca con la jornada y
   * se puede rellenar cualquier día, que es justo lo que se pidió.
   */
  const ponExtras = (slug: string, cambio: Partial<ExtrasJugador>) => {
    setDoc((actual) => {
      const base = actual ?? QUINIELA_VACIA;

      const suyos = base.extras?.[slug] ?? {};

      /* Un campo vacío se borra en vez de guardarse en blanco. */
      const fundidos = { ...suyos, ...cambio };

      for (const clave of Object.keys(fundidos) as (keyof ExtrasJugador)[]) {
        if (!String(fundidos[clave] ?? "").trim()) delete fundidos[clave];
      }

      return {
        ...base,
        jornadas: base.jornadas ?? {},
        jugadores: base.jugadores?.length ? base.jugadores : JUEGAN_POR_DEFECTO,
        extras: { ...base.extras, [slug]: fundidos },
      };
    });
  };

  /**
   * Sube la foto de broma.
   *
   * Por la misma puerta que los recursos del rival (`/api/rivals/media`), que
   * ya deja los ficheros en el almacén del club: una foto de guasa no merece
   * una ruta nueva ni un bucket aparte.
   */
  const subeFoto = async (slug: string, archivo: File) => {
    if (archivo.size > 4 * 1024 * 1024) {
      toast.error("La foto pesa demasiado", {
        description: "Máximo 4 MB. Con una del móvil reducida sobra.",
      });

      return;
    }

    setSubiendoFoto(true);

    const aviso = toast.loading("Subiendo la foto…");

    try {
      const formulario = new FormData();

      formulario.append("file", archivo);
      formulario.append("folder", "quiniela");

      const respuesta = await fetch("/api/rivals/media", {
        method: "POST",
        body: formulario,
      });

      const datos = (await respuesta.json()) as {
        success?: boolean;
        url?: string;
        error?: string;
      };

      if (!respuesta.ok || !datos.success || !datos.url) {
        throw new Error(datos.error || `HTTP ${respuesta.status}`);
      }

      ponExtras(slug, { foto: datos.url });

      toast.success("Foto puesta", { id: aviso });
    } catch (error) {
      console.error("[quiniela] foto de broma", error);

      toast.error("No se ha podido subir la foto", {
        id: aviso,
        description: error instanceof Error ? error.message : "Inténtalo otra vez",
      });
    } finally {
      setSubiendoFoto(false);
    }
  };

  /* En qué bloque de diez jornadas estamos y cómo va la comida. */
  const bloque = useMemo(() => bloqueDe(jornada), [jornada]);

  const tablaBloque = useMemo(
    () => rankingDeBloque(doc, jugadores, bloque),
    [doc, jugadores, bloque],
  );

  const cerrado = useMemo(() => bloqueCerrado(doc, bloque), [doc, bloque]);

  const partidos = useMemo(() => partidosDe(jornada), [jornada]);

  const laJornada: JornadaQuiniela =
    doc.jornadas[String(jornada)] ?? jornadaVacia(jornada);

  const tabla = useMemo(
    () => ranking(doc, jugadores, jornada),
    [doc, jugadores, jornada],
  );

  const rarezas = useMemo(
    () => rarezasDe(laJornada, jugadores),
    [laJornada, jugadores],
  );

  /** Cambia la jornada que se está mirando, dejándola creada si hacía falta. */
  const cambiaJornada = (
    cambio: (actual: JornadaQuiniela) => JornadaQuiniela,
  ) => {
    setDoc((actual) => {
      const base = actual ?? QUINIELA_VACIA;

      const previa = base.jornadas?.[String(jornada)] ?? jornadaVacia(jornada);

      return {
        ...base,
        jugadores: base.jugadores?.length ? base.jugadores : JUEGAN_POR_DEFECTO,
        jornadas: {
          ...base.jornadas,
          [String(jornada)]: cambio(previa),
        },
      };
    });
  };

  const ponPronostico = (indice: number, signo: Signo) => {
    if (!yo) return;

    cambiaJornada((actual) => {
      const suyos = [...(actual.pronosticos[yo] ?? partidos.map(() => null))];

      /* Volver a pulsar el mismo signo lo quita: rectificar no puede exigir
         recargar la página. */
      suyos[indice] = suyos[indice] === signo ? null : signo;

      return { ...actual, pronosticos: { ...actual.pronosticos, [yo]: suyos } };
    });
  };

  const ponResultado = (indice: number, signo: Signo) => {
    cambiaJornada((actual) => {
      const resultados = [...actual.resultados];

      while (resultados.length < partidos.length) resultados.push(null);

      resultados[indice] = resultados[indice] === signo ? null : signo;

      return { ...actual, resultados };
    });
  };

  const mios = yo ? (laJornada.pronosticos[yo] ?? []) : [];

  const sinRellenar = yo
    ? partidos.filter((_, indice) => !mios[indice]).length
    : 0;

  const jugados = laJornada.resultados.filter(Boolean).length;

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Entre nosotros"
              title="La Quiniela de la Semana"
              lead="Los diez partidos de la jornada, el 1-X-2 de cada uno y el ranking de acierto de la temporada."
              aside={
                <SaveState
                  status={status}
                  localOnly={localOnly}
                  savedAt={lastSavedAt}
                />
              }
            />

            {/* ---------------------- LA JORNADA ---------------------- */}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                <button
                  type="button"
                  onClick={() => setJornada((n) => Math.max(JORNADAS[0], n - 1))}
                  disabled={jornada <= JORNADAS[0]}
                  aria-label="Jornada anterior"
                  className="rounded-lg px-2 py-2 text-white/50 transition hover:text-white disabled:opacity-25"
                >
                  <ChevronLeft size={15} />
                </button>

                <span className="min-w-[92px] text-center text-sm font-semibold tabular-nums text-[#C8A96B]">
                  Jornada {jornada}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setJornada((n) =>
                      Math.min(JORNADAS[JORNADAS.length - 1], n + 1),
                    )
                  }
                  disabled={jornada >= JORNADAS[JORNADAS.length - 1]}
                  aria-label="Jornada siguiente"
                  className="rounded-lg px-2 py-2 text-white/50 transition hover:text-white disabled:opacity-25"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <span className="inline-flex items-center gap-1.5 text-[11px] text-white/35">
                <CalendarDays size={12} />
                {fechaCorta(partidos[0]?.fecha ?? "")} · {partidos.length} partidos
                {jugados > 0 && ` · ${jugados} con resultado`}
              </span>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  icon={Users}
                  onClick={() => setEligiendoJugadores((v) => !v)}
                  title="Quién juega a la quiniela esta temporada"
                >
                  {jugadores.length} jugando
                </Button>
              </div>
            </div>

            {/* ------------------- QUIÉN ESTÁ RELLENANDO -------------- */}

            <div className="mt-5">
              <Panel
                title="Quién rellena"
                subtitle={
                  yo
                    ? `Estás poniendo los pronósticos de ${PERSONA_POR_SLUG.get(yo)?.nombre ?? yo}`
                    : "Elígete para poder marcar tus resultados"
                }
                icon={Users}
              >
                <div className="flex flex-wrap gap-2">
                  {jugadores.map((slug) => {
                    const persona = PERSONA_POR_SLUG.get(slug);

                    if (!persona) return null;

                    const suyos = laJornada.pronosticos[slug] ?? [];
                    const puestos = suyos.filter(Boolean).length;
                    const soyYo = yo === slug;

                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => setYo(soyYo ? null : slug)}
                        aria-pressed={soyYo}
                        title={`${persona.nombre} · ${persona.rol}`}
                        className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 transition ${
                          soyYo
                            ? "border-[#C8A96B] bg-[#C8A96B]/[0.12]"
                            : "border-white/10 bg-white/[0.02] hover:border-white/25"
                        }`}
                      >
                        <Avatar slug={slug} lado={28} />

                        <span className="text-left">
                          <span className="block text-[12px] font-medium text-white">
                            {nombreCorto(persona)}
                          </span>

                          <span className="block text-[10px] text-white/40">
                            {puestos === partidos.length
                              ? "Completa"
                              : `${puestos}/${partidos.length}`}
                          </span>
                        </span>

                        {/* Su cosecha: canción, frase y foto de broma. */}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`La cosecha de ${persona.nombre}`}
                          title="Su canción, su frase y su foto de broma"
                          onClick={(evento) => {
                            evento.stopPropagation();
                            setEditandoExtras(slug);
                          }}
                          onKeyDown={(evento) => {
                            if (evento.key === "Enter" || evento.key === " ") {
                              evento.stopPropagation();
                              setEditandoExtras(slug);
                            }
                          }}
                          className={`shrink-0 rounded-full p-1 transition hover:bg-white/10 ${
                            extras[slug] && Object.keys(extras[slug]).length > 0
                              ? "text-[#C8A96B]"
                              : "text-white/20"
                          }`}
                        >
                          <Smile size={13} aria-hidden />
                        </span>
                      </button>
                    );
                  })}
                </div>

                {eligiendoJugadores && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Quién juega esta temporada
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {STAFF.map((persona) => {
                        const dentro = jugadores.includes(persona.slug);

                        return (
                          <button
                            key={persona.slug}
                            type="button"
                            onClick={() =>
                              setDoc((actual) => {
                                const base = actual ?? QUINIELA_VACIA;

                                const lista = base.jugadores?.length
                                  ? base.jugadores
                                  : JUEGAN_POR_DEFECTO;

                                return {
                                  ...base,
                                  jornadas: base.jornadas ?? {},
                                  jugadores: dentro
                                    ? lista.filter((uno) => uno !== persona.slug)
                                    : [...lista, persona.slug],
                                };
                              })
                            }
                            className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                              dentro
                                ? "border-[#C8A96B]/50 bg-[#C8A96B]/10 text-[#C8A96B]"
                                : "border-white/10 text-white/45 hover:border-white/25"
                            }`}
                          >
                            {dentro && <Check size={10} className="mr-1 inline" />}
                            {persona.nombre}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                      El Excel traía diez columnas de pronóstico. Nueve se
                      reconocen por sus iniciales;{" "}
                      <strong className="text-white/55">
                        {INICIALES_SIN_DUENO.join(", ")}
                      </strong>{" "}
                      no casa con nadie del cuerpo técnico, así que no se le ha
                      asignado dueño: dinos quién es y entra con su foto.
                    </p>
                  </div>
                )}
              </Panel>
            </div>

            {/* --------------------- LOS PARTIDOS --------------------- */}

            <div className="mt-5">
              <Panel
                title="Los partidos"
                subtitle={
                  yo
                    ? sinRellenar > 0
                      ? `Te faltan ${sinRellenar} por marcar`
                      : "Los tienes todos puestos"
                    : "Elige arriba quién eres para marcar; abajo se meten los resultados"
                }
                icon={ListOrdered}
              >
                <div className="min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-[12px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                        <th className="w-7 pb-2 pt-1.5 text-right font-medium">#</th>
                        <th className="pb-2 pl-2 pt-1.5 text-left font-medium">Partido</th>
                        <th className="w-[132px] pb-2 pt-1.5 text-center font-medium">
                          Tu pronóstico
                        </th>
                        <th className="w-[132px] pb-2 pt-1.5 text-center font-medium">
                          Resultado
                        </th>
                        <th className="w-16 pb-2 pt-1.5 text-center font-medium">Aciertos</th>
                      </tr>
                    </thead>

                    <tbody>
                      {partidos.map((partido, indice) => {
                        const resultado = laJornada.resultados[indice] ?? null;
                        const mio = mios[indice] ?? null;

                        const acertado = resultado && mio === resultado;
                        const fallado = resultado && mio && mio !== resultado;

                        /* Cuántos de los que juegan lo han acertado: es lo
                           que se comenta el lunes. */
                        const aciertan = resultado
                          ? jugadores.filter(
                              (slug) =>
                                laJornada.pronosticos[slug]?.[indice] === resultado,
                            ).length
                          : 0;

                        return (
                          <tr
                            key={`${partido.local}-${partido.visitante}`}
                            className={`border-t border-white/[0.06] ${
                              acertado
                                ? "bg-emerald-400/[0.05]"
                                : fallado
                                  ? "bg-rose-400/[0.04]"
                                  : ""
                            }`}
                          >
                            <td className="py-2 text-right text-[10px] tabular-nums text-white/25">
                              {indice + 1}
                            </td>

                            <td className="py-2 pl-2">
                              <span className="block truncate text-white/85">
                                {partido.local}
                              </span>

                              <span className="block truncate text-[11px] text-white/40">
                                {partido.visitante}
                              </span>
                            </td>

                            <td className="py-2 text-center">
                              <Tripleta
                                valor={mio}
                                onElige={(signo) => ponPronostico(indice, signo)}
                                apagado={!yo}
                                resultado={resultado}
                              />
                            </td>

                            <td className="py-2 text-center">
                              <Tripleta
                                valor={resultado}
                                onElige={(signo) => ponResultado(indice, signo)}
                                tono="neutro"
                              />
                            </td>

                            <td className="py-2 text-center text-[11px] tabular-nums text-white/45">
                              {resultado ? `${aciertan}/${jugadores.length}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {!yo && (
                  <p className="mt-3 text-[11px] text-white/35">
                    Los resultados los puede meter cualquiera; los pronósticos,
                    sólo el suyo.
                  </p>
                )}

                {(rarezas.todos.length > 0 || rarezas.nadie.length > 0) && (
                  <div className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/45">
                    {rarezas.todos.length > 0 && (
                      <p>
                        <span className="text-emerald-300/80">Lo vio todo el mundo:</span>{" "}
                        {rarezas.todos
                          .map((i) => `${partidos[i]?.local} – ${partidos[i]?.visitante}`)
                          .join(" · ")}
                      </p>
                    )}

                    {rarezas.nadie.length > 0 && (
                      <p className="mt-1">
                        <span className="text-rose-300/80">No lo vio nadie:</span>{" "}
                        {rarezas.nadie
                          .map((i) => `${partidos[i]?.local} – ${partidos[i]?.visitante}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </Panel>
            </div>

            {/* ---------------------- EL RANKING ---------------------- */}

            <div className="mt-5">
              <Panel
                title="Ranking de acierto"
                subtitle="Toda la temporada. Se ordena por porcentaje, no por aciertos: quien se incorpora tarde no arranca con una desventaja imposible"
                icon={Trophy}
              >
                {tabla.every((fila) => fila.total.jugados === 0) ? (
                  <EmptyState
                    title="Todavía no hay nada que contar"
                    description="En cuanto se metan los resultados de una jornada, el ranking se calcula solo."
                  />
                ) : (
                  <div className="min-w-0 overflow-x-auto">
                    <table className="w-full min-w-[620px] text-[12px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                          <th className="w-7 pb-2 pt-1.5 text-right font-medium">#</th>
                          <th className="pb-2 pl-2 pt-1.5 text-left font-medium">Quién</th>
                          <th className="w-20 pb-2 pt-1.5 text-right font-medium">Acierto</th>
                          <th className="w-20 pb-2 pt-1.5 text-right font-medium">Aciertos</th>
                          <th className="w-24 pb-2 pt-1.5 text-right font-medium">Esta jornada</th>
                          <th className="w-20 pb-2 pt-1.5 text-right font-medium">Jornadas</th>
                        </tr>
                      </thead>

                      <tbody>
                        {tabla.map((fila, indice) => {
                          const persona = PERSONA_POR_SLUG.get(fila.slug);

                          if (!persona) return null;

                          const lider = indice === 0 && fila.total.jugados > 0;

                          return (
                            <tr
                              key={fila.slug}
                              className={`border-t border-white/[0.06] ${
                                lider ? "bg-[#C8A96B]/[0.07]" : ""
                              }`}
                            >
                              <td className="py-1.5 text-right text-[10px] tabular-nums text-white/25">
                                {indice + 1}
                              </td>

                              <td className="py-1.5 pl-2">
                                <span className="flex items-center gap-2">
                                  <Avatar slug={fila.slug} lado={24} />

                                  <span className="min-w-0">
                                    <span className="block truncate text-white/85">
                                      {persona.nombre}
                                    </span>

                                    <span className="block truncate text-[10px] text-white/35">
                                      {persona.rol}
                                    </span>
                                  </span>
                                </span>
                              </td>

                              <td
                                className={`py-1.5 text-right tabular-nums ${
                                  lider ? "font-semibold text-[#C8A96B]" : "text-white/75"
                                }`}
                              >
                                {fila.total.jugados > 0
                                  ? `${fila.total.porcentaje.toFixed(0)} %`
                                  : "—"}
                              </td>

                              <td className="py-1.5 text-right tabular-nums text-white/55">
                                {fila.total.aciertos}
                                <span className="text-white/25">
                                  /{fila.total.jugados}
                                </span>
                              </td>

                              <td className="py-1.5 text-right tabular-nums text-white/55">
                                {fila.semana.jugados > 0
                                  ? `${fila.semana.aciertos}/${fila.semana.jugados}`
                                  : "—"}
                              </td>

                              <td className="py-1.5 text-right tabular-nums text-white/45">
                                {fila.jornadasGanadas > 0 ? fila.jornadasGanadas : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>

            {/* ---------------------- LA COMIDA ----------------------- */}

            <div className="mt-5">
              <Panel
                title={`La comida · jornadas ${bloque.desde} a ${bloque.hasta}`}
                subtitle={
                  cerrado
                    ? "Bloque cerrado: éstos son los dos que no pagan"
                    : "Cada diez jornadas, los dos primeros comen invitados por el resto. Así va el bloque en marcha."
                }
                icon={UtensilsCrossed}
              >
                <div className="flex flex-wrap gap-2">
                  {tablaBloque.map((fila, indice) => {
                    const persona = PERSONA_POR_SLUG.get(fila.slug);

                    if (!persona) return null;

                    return (
                      <div
                        key={fila.slug}
                        className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                          fila.invitado
                            ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.10]"
                            : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <span className="text-[10px] tabular-nums text-white/25">
                          {indice + 1}
                        </span>

                        <Avatar slug={fila.slug} lado={26} />

                        <span className="min-w-0">
                          <span
                            className={`block truncate text-[12px] ${
                              fila.invitado
                                ? "font-semibold text-[#C8A96B]"
                                : "text-white/75"
                            }`}
                          >
                            {nombreCorto(persona)}
                          </span>

                          <span className="block text-[10px] tabular-nums text-white/40">
                            {fila.jugados > 0
                              ? `${fila.aciertos}/${fila.jugados} · ${fila.porcentaje.toFixed(0)} %`
                              : "sin jugar"}
                          </span>
                        </span>

                        {fila.invitado && (
                          <UtensilsCrossed
                            size={13}
                            className="shrink-0 text-[#C8A96B]"
                            aria-label="No paga"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                  {cerrado
                    ? "Las diez jornadas están jugadas, así que esto ya no cambia."
                    : `Provisional: faltan jornadas del bloque por jugar.`}{" "}
                  Si hay empate en el segundo puesto no pagan todos los empatados:
                  inventar un desempate en una apuesta entre compañeros no lo acepta
                  nadie.
                </p>
              </Panel>
            </div>

            <div className="mt-5">
              <Notice tone="info" title="Cómo se cuenta">
                Un partido sin resultado no cuenta para nadie, ni a favor ni en
                contra: el porcentaje del lunes es el de los partidos ya
                jugados. No pronosticar sí cuenta como fallo, pero sólo cuando
                el partido se ha jugado. «Jornadas» son las que se han ganado —
                acertar más que todos los demás—; si empatan dos, la ganan los
                dos.
              </Notice>
            </div>
          </div>
        </section>
      </div>

      {editandoExtras && (
        <FichaExtras
          slug={editandoExtras}
          extras={extras[editandoExtras] ?? {}}
          subiendo={subiendoFoto}
          onCambia={(cambio) => ponExtras(editandoExtras, cambio)}
          onFoto={(archivo) => void subeFoto(editandoExtras, archivo)}
          onCerrar={() => setEditandoExtras(null)}
        />
      )}
    </main>
  );
}

/**
 * La cosecha de cada uno: su canción, su frase y su foto de broma.
 *
 * Se puede dejar a medias y volver otro día —no hay nada obligatorio— y por eso
 * se guarda según se escribe, sin botón de guardar. La canción es un enlace y no
 * un fichero: subir audio al almacén del club para una broma sería pagar espacio
 * y derechos por algo que ya está en YouTube o en Spotify. La foto sí se sube,
 * porque la gracia está en que sea suya.
 */
function FichaExtras({
  slug,
  extras,
  subiendo,
  onCambia,
  onFoto,
  onCerrar,
}: {
  slug: string;
  extras: ExtrasJugador;
  subiendo: boolean;
  onCambia: (cambio: Partial<ExtrasJugador>) => void;
  onFoto: (archivo: File) => void;
  onCerrar: () => void;
}) {
  const persona = PERSONA_POR_SLUG.get(slug);

  const entrada = useRef<HTMLInputElement | null>(null);

  if (!persona) return null;

  return (
    <Dialog
      title={`La cosecha de ${persona.nombre}`}
      subtitle="Se puede rellenar cuando quieras, y cambiar las veces que haga falta"
      onClose={onCerrar}
      footer={<Button onClick={onCerrar}>Cerrar</Button>}
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
            <Music size={11} aria-hidden />
            Su canción
          </span>

          <Field
            label="Cómo se llama"
            value={extras.cancionNombre ?? ""}
            onChange={(valor) => onCambia({ cancionNombre: valor })}
            placeholder="Ej.: Paquito el Chocolatero"
          />

          <div className="mt-2">
            <Field
              label="Enlace"
              value={extras.cancion ?? ""}
              onChange={(valor) => onCambia({ cancion: valor })}
              placeholder="Pega el enlace de YouTube o Spotify"
              hint="Suena cuando gane una jornada. No se sube el audio: va el enlace."
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
            <Quote size={11} aria-hidden />
            Su frase
          </span>

          <TextArea
            label=""
            value={extras.frase ?? ""}
            onChange={(valor) => onCambia({ frase: valor })}
            placeholder="La que quiera que le saquen cuando acierte… o cuando falle"
            rows={2}
          />
        </div>

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
            <ImagePlus size={11} aria-hidden />
            Su foto de broma
          </span>

          <div className="flex items-center gap-3">
            {extras.foto ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={extras.foto}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 text-white/20">
                <Smile size={20} aria-hidden />
              </span>
            )}

            <div className="min-w-0">
              <input
                ref={entrada}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(evento) => {
                  const archivo = evento.target.files?.[0];

                  if (archivo) onFoto(archivo);

                  /* Se limpia para que elegir la misma foto otra vez vuelva a
                     disparar el cambio. */
                  evento.target.value = "";
                }}
              />

              <Button
                icon={ImagePlus}
                disabled={subiendo}
                onClick={() => entrada.current?.click()}
              >
                {subiendo ? "Subiendo…" : extras.foto ? "Cambiarla" : "Subir una"}
              </Button>

              {extras.foto && (
                <button
                  type="button"
                  onClick={() => onCambia({ foto: "" })}
                  className="ml-2 text-[11px] text-white/35 underline underline-offset-2 transition hover:text-white/70"
                >
                  Quitarla
                </button>
              )}

              <p className="mt-1.5 text-[11px] text-white/35">
                Hasta 4 MB. Sale junto a su nombre en el ranking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Los tres botones del 1-X-2.
 *
 * Se usa para el pronóstico y para el resultado, que es la misma elección con
 * distinto peso: el pronóstico se pinta en verde o rojo cuando ya se sabe si
 * acertó, y el resultado siempre en dorado, porque es el dato.
 */
function Tripleta({
  valor,
  onElige,
  apagado,
  tono = "propio",
  resultado,
}: {
  valor: Signo | null;
  onElige: (signo: Signo) => void;
  apagado?: boolean;
  tono?: "propio" | "neutro";
  /** El resultado del partido, para saber si lo elegido acertó. */
  resultado?: Signo | null;
}) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
      {SIGNOS.map((signo) => {
        const puesto = valor === signo;

        const acierta = puesto && resultado && resultado === signo;
        const falla = puesto && resultado && resultado !== signo;

        const estilo = !puesto
          ? "text-white/30 hover:text-white/70"
          : acierta
            ? "bg-emerald-400/20 text-emerald-200"
            : falla
              ? "bg-rose-400/20 text-rose-200"
              : tono === "neutro"
                ? "bg-[#C8A96B]/20 text-[#C8A96B]"
                : "bg-white/15 text-white";

        return (
          <button
            key={signo}
            type="button"
            disabled={apagado}
            onClick={() => onElige(signo)}
            aria-pressed={puesto}
            title={NOMBRE_DEL_SIGNO[signo]}
            className={`h-7 w-9 rounded-md text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${estilo}`}
          >
            {signo}
          </button>
        );
      })}
    </span>
  );
}
