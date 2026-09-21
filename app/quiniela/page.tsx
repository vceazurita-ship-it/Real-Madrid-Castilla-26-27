"use client";

/**
 * LA QUINIELA DE LA SEMANA.
 *
 * Lo único de la plataforma que no es trabajo: cada uno pone su 1-X-2 a los
 * nueve partidos de la jornada —los de la liga sin el Castilla—, se meten los
 * resultados el lunes y el acierto se cuenta solo. El cuerpo técnico compite
 * entre sí toda la temporada.
 *
 * **Cada uno entra con su correo** (`/api/quiniela/cuenta`) y sólo puede tocar
 * lo suyo. La apuesta es un borrador hasta que se pulsa «Guardar mi apuesta»,
 * se puede cambiar las veces que haga falta y **se cierra el viernes a las
 * 12:00**, hora de Madrid (`lib/quiniela/cierre.ts`). Todo eso lo comprueba el
 * servidor (`/api/quiniela/guardar`), no esta pantalla: aquí sólo se enseña.
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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ImagePlus,
  KeyRound,
  ListOrdered,
  Lock,
  LogOut,
  Music,
  Quote,
  Save,
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
  Segmented,
  Select,
  TextArea,
} from "@/components/abp/ui";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useAhora, useQuinielaDoc } from "@/hooks/useQuinielaDoc";
import { useQuinielaSesion, type Yo } from "@/hooks/useQuinielaSesion";
import { cuandoCierra, estadoDe } from "@/lib/quiniela/cierre";
import {
  JORNADAS,
  NOMBRE_DEL_SIGNO,
  SIGNOS,
  bloqueCerrado,
  bloqueDe,
  jornadaDeHoy,
  jornadaVacia,
  partidosDe,
  ranking,
  rankingDeBloque,
  rarezasDe,
  type ExtrasJugador,
  type JornadaQuiniela,
  type Signo,
} from "@/lib/quiniela/modelo";
import { Avatar } from "@/components/quiniela/Avatar";
import { EstadoJornada } from "@/components/quiniela/EstadoJornada";
import { Historico } from "@/components/quiniela/Historico";
import { Parrilla } from "@/components/quiniela/Parrilla";
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

/** Dos listas de signos iguales, contando un hueco que falta como vacío. */
function mismosSignos(a: (Signo | null)[], b: (Signo | null)[], largo: number) {
  for (let i = 0; i < largo; i += 1) {
    if ((a[i] ?? null) !== (b[i] ?? null)) return false;
  }

  return true;
}

export default function QuinielaPage() {
  const ahora = useAhora();

  const [jornada, setJornada] = useState(() => jornadaDeHoy(hoyTexto()));

  /* Si la jornada que se mira ya no se puede tocar. */
  const plazo = useMemo(() => estadoDe(jornada, ahora), [jornada, ahora]);

  /*
  | EL FIN DE SEMANA DE LA JORNADA.
  |
  | Desde que se cierra —el viernes a las 12:00— hasta tres días después, que
  | es cuando se juega y cuando el trabajo nocturno va escribiendo los
  | resultados que baja de BeSoccer. Fuera de esa ventana no hay nada que
  | esperar, y no se pide nada.
  */
  const enJuego = useMemo(() => {
    if (!plazo.cerrada || !plazo.viernes) return false;

    const desde = new Date(`${plazo.viernes}T12:00:00Z`).getTime();

    const dias = (ahora.getTime() - desde) / 86_400_000;

    return dias >= 0 && dias <= 3.5;
  }, [plazo, ahora]);

  /*
  | La pantalla se relee sola mientras la jornada está en juego.
  |
  | Los resultados los baja de BeSoccer el trabajo nocturno, así que quien
  | tenga esto abierto un domingo por la noche vería el marcador congelado
  | hasta recargar. Dos minutos basta: esto no es un directo.
  */
  const { doc, estado, guardadoEn, guarda, recarga } = useQuinielaDoc(
    enJuego ? 120_000 : 0,
  );

  const sesion = useQuinielaSesion();

  /* Quién ha entrado. Lo dice la cookie, que sólo lee el servidor. */
  const yo = sesion.yo?.slug ?? null;

  /*
  | Quién juega.
  |
  | Si nadie lo ha decidido todavía, juegan los diez que venían con columna en
  | el Excel del cuerpo técnico. No se guarda esa lista sola al entrar: hasta
  | que alguien toque algo, el documento sigue vacío y no se escribe nada.
  */
  const jugadores = doc.jugadores.length > 0 ? doc.jugadores : JUEGAN_POR_DEFECTO;

  /*
  | LA APUESTA EN BORRADOR, por jornada.
  |
  | Marcar un signo no guarda nada: se guarda con el botón. Así se puede
  | rellenar a medias, pensarlo y cambiarlo sin que cada clic sea una apuesta
  | ya hecha. El borrador es de la pestaña; lo guardado, del servidor.
  */
  const [borradores, setBorradores] = useState<Record<string, (Signo | null)[]>>({});

  const [guardandoApuesta, setGuardandoApuesta] = useState(false);

  const [eligiendoJugadores, setEligiendoJugadores] = useState(false);

  /* De quién se está viendo la canción, la frase y la foto de broma. */
  const [viendoExtras, setViendoExtras] = useState<string | null>(null);

  const [subiendoFoto, setSubiendoFoto] = useState(false);

  /*
  | Dos vistas: la semana y el histórico.
  |
  | La de la semana es la de siempre —apostar, meter resultados, la parrilla—.
  | El histórico contesta lo que se pregunta el lunes: cómo fue cada uno en
  | todas las jornadas jugadas, sin tener que ir una por una con las flechas.
  */
  const [vista, setVista] = useState<"jornada" | "historico">("jornada");

  const extras = doc.extras ?? {};

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

  const guardados = yo ? (laJornada.pronosticos[yo] ?? []) : [];

  const borrador = borradores[String(jornada)];

  /*
  | Con la jornada cerrada mandan los guardados, aunque haya borrador.
  |
  | Si alguien marcaba los nueve signos a las 11:59 y no pulsaba «Guardar», a
  | las 12:00 la pantalla le seguía enseñando SUS signos —el borrador— debajo
  | del cartel de «jornada cerrada», mientras la parrilla de al lado mostraba
  | su fila vacía. Se iba convencido de haber apostado.
  */
  const mios = plazo.cerrada ? guardados : (borrador ?? guardados);

  /* Y si se quedó a medias, se dice en vez de dejarlo a su interpretación. */
  const borradorPerdido =
    Boolean(yo) &&
    plazo.cerrada &&
    borrador !== undefined &&
    !mismosSignos(borrador, guardados, partidos.length);

  const sinGuardar =
    Boolean(yo) &&
    !plazo.cerrada &&
    borrador !== undefined &&
    !mismosSignos(borrador, guardados, partidos.length);

  /* Alguna jornada con cambios sin guardar —y que aún se puedan guardar—,
     para avisar antes de irse. */
  const hayBorradores = Object.entries(borradores).some(([clave, signos]) => {
    if (!yo || estadoDe(Number(clave), ahora).cerrada) return false;

    const guardada = doc.jornadas[clave]?.pronosticos[yo] ?? [];

    return !mismosSignos(signos, guardada, partidosDe(Number(clave)).length);
  });

  useEffect(() => {
    if (!hayBorradores) return;

    const avisa = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };

    window.addEventListener("beforeunload", avisa);

    return () => window.removeEventListener("beforeunload", avisa);
  }, [hayBorradores]);

  /** Un error del servidor, contado como se entiende. */
  const avisaError = (titulo: string, error: unknown) => {
    console.error(`[quiniela] ${titulo}`, error);

    toast.error(titulo, {
      description: error instanceof Error ? error.message : "Inténtalo otra vez",
    });
  };

  const ponPronostico = (indice: number, signo: Signo) => {
    if (!yo || plazo.cerrada) return;

    setBorradores((actuales) => {
      const base = actuales[String(jornada)] ?? guardados;

      const suyos = partidos.map((_, i) => base[i] ?? null);

      /* Volver a pulsar el mismo signo lo quita: rectificar no puede exigir
         recargar la página. */
      suyos[indice] = suyos[indice] === signo ? null : signo;

      return { ...actuales, [String(jornada)]: suyos };
    });
  };

  const guardaApuesta = async () => {
    if (!yo || !borrador) return;

    setGuardandoApuesta(true);

    try {
      await guarda({
        accion: "apuesta",
        jornada,
        signos: partidos.map((_, i) => borrador[i] ?? null),
      });

      setBorradores((actuales) => {
        const resto = { ...actuales };

        delete resto[String(jornada)];

        return resto;
      });

      const faltan = partidos.filter((_, i) => !borrador[i]).length;

      toast.success(`Apuesta de la jornada ${jornada} guardada`, {
        description:
          faltan > 0
            ? `Te faltan ${faltan}. Puedes cambiarla hasta el ${cuandoCierra(plazo.viernes)}.`
            : `Puedes cambiarla hasta el ${cuandoCierra(plazo.viernes)}.`,
      });
    } catch (error) {
      avisaError("No se ha guardado la apuesta", error);

      /* Si es que se cerró mientras tanto, que la pantalla lo sepa ya. */
      recarga();
    } finally {
      setGuardandoApuesta(false);
    }
  };

  const descartaBorrador = () =>
    setBorradores((actuales) => {
      const resto = { ...actuales };

      delete resto[String(jornada)];

      return resto;
    });

  const ponResultado = async (indice: number, signo: Signo) => {
    if (!yo) return;

    const actual = laJornada.resultados[indice] ?? null;

    try {
      await guarda({
        accion: "resultado",
        jornada,
        indice,
        signo: actual === signo ? null : signo,
      });
    } catch (error) {
      avisaError("No se ha guardado el resultado", error);
    }
  };

  const cambiaJugadores = async (lista: string[]) => {
    try {
      await guarda({ accion: "jugadores", jugadores: lista });
    } catch (error) {
      avisaError("No se ha cambiado quién juega", error);
    }
  };

  /** Guarda la canción, la frase y la foto de quien ha entrado. */
  const guardaExtras = async (nuevos: ExtrasJugador) => {
    try {
      await guarda({ accion: "extras", extras: nuevos });

      toast.success("Guardado");

      return true;
    } catch (error) {
      avisaError("No se ha guardado", error);

      return false;
    }
  };

  /**
   * Sube la foto de broma y devuelve su dirección.
   *
   * Por la misma puerta que los recursos del rival (`/api/rivals/media`), que
   * ya deja los ficheros en el almacén del club: una foto de guasa no merece
   * una ruta nueva ni un bucket aparte. La carpeta es `2026/quiniela`, y tiene
   * que estar en la lista de esa ruta: mandando `quiniela` a secas —como se
   * hizo hasta el 20/09/2026— contestaba «Carpeta no válida» y no subía nada.
   */
  const subeFoto = async (archivo: File): Promise<string | null> => {
    if (archivo.size > 4 * 1024 * 1024) {
      toast.error("La foto pesa demasiado", {
        description: "Máximo 4 MB. Con una del móvil reducida sobra.",
      });

      return null;
    }

    /*
    | El iPhone guarda en HEIC y el navegador no lo pinta.
    |
    | Subirlo funcionaría —el almacén se traga cualquier cosa— pero la foto
    | saldría como un hueco roto en la ficha de todo el mundo. Mejor decirlo
    | aquí, que tiene arreglo en dos toques desde el propio móvil.
    */
    if (!/^image\/(jpe?g|png|webp|gif|avif)$/i.test(archivo.type)) {
      toast.error("Ese formato de foto no se ve en el navegador", {
        description:
          archivo.type.includes("hei")
            ? "Es una foto HEIC del iPhone: ábrela y compártela como JPG, o haz una captura de pantalla."
            : "Vale JPG, PNG, WEBP o GIF.",
      });

      return null;
    }

    setSubiendoFoto(true);

    const aviso = toast.loading("Subiendo la foto…");

    try {
      const formulario = new FormData();

      formulario.append("file", archivo);
      formulario.append("folder", "2026/quiniela");

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

      toast.success("Foto subida", {
        id: aviso,
        description: "Pulsa «Guardar» para que se quede.",
      });

      return datos.url;
    } catch (error) {
      console.error("[quiniela] foto de broma", error);

      toast.error("No se ha podido subir la foto", {
        id: aviso,
        description: error instanceof Error ? error.message : "Inténtalo otra vez",
      });

      return null;
    } finally {
      setSubiendoFoto(false);
    }
  };

  const sinRellenar = yo
    ? partidos.filter((_, indice) => !mios[indice]).length
    : 0;

  const jugados = laJornada.resultados.filter(Boolean).length;

  /* El estado de guardado, en el idioma de `SaveState`. */
  const estadoGuardado =
    estado === "cargando"
      ? "loading"
      : estado === "guardando"
        ? "saving"
        : estado === "error"
          ? "error"
          : "saved";

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
              lead="Los nueve partidos de la jornada —la liga sin el Castilla—, el 1-X-2 de cada uno y el ranking de acierto de la temporada."
              aside={
                <SaveState
                  status={estadoGuardado}
                  savedAt={guardadoEn}
                  onGuardar={estado === "error" ? recarga : undefined}
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
                <Segmented
                  options={[
                    { key: "jornada" as const, label: "La jornada" },
                    { key: "historico" as const, label: "Jornadas anteriores" },
                  ]}
                  value={vista}
                  onChange={setVista}
                />

                <Button
                  icon={Users}
                  onClick={() => setEligiendoJugadores((v) => !v)}
                  title="Quién juega a la quiniela esta temporada"
                >
                  {jugadores.length} jugando
                </Button>
              </div>
            </div>

            {/* --------------- CÓMO VA LA JORNADA --------------------- */}

            <div className="mt-6">
              <EstadoJornada
                jornada={laJornada}
                numero={jornada}
                jugadores={jugadores}
                partidos={partidos.length}
                cerrada={plazo.cerrada}
                ultimasHoras={plazo.ultimasHoras}
                cuandoCierra={cuandoCierra(plazo.viernes)}
                ahora={ahora}
              />
            </div>

            {vista === "historico" && (
              <div className="mt-5">
                <Historico
                  doc={doc}
                  jugadores={jugadores}
                  jornadaAbierta={jornada}
                  onVerJornada={(numero) => {
                    setJornada(numero);
                    setVista("jornada");
                  }}
                />
              </div>
            )}

            {vista === "jornada" && (
              <>
            {/* ------------------------ QUIÉN ERES --------------------- */}

            <div className="mt-5">
              <Acceso
                yo={sesion.yo}
                cargando={sesion.cargando}
                manda={sesion.manda}
              />
            </div>

            {/* ------------------------ QUIÉN JUEGA -------------------- */}

            <div className="mt-5">
              <Panel
                title="Quién juega"
                subtitle={`Cómo va cada uno con la jornada ${jornada}. La carita abre su canción, su frase y su foto de broma`}
                icon={Users}
              >
                <div className="flex flex-wrap gap-2">
                  {jugadores.map((slug) => {
                    const persona = PERSONA_POR_SLUG.get(slug);

                    if (!persona) return null;

                    /* Con la jornada abierta, de los demás sólo llega el
                       recuento: los signos no viajan hasta que se cierra. */
                    const suyos = laJornada.pronosticos[slug] ?? [];

                    const puestos =
                      laJornada.puestos?.[slug] ?? suyos.filter(Boolean).length;
                    const soyYo = yo === slug;
                    const conExtras =
                      extras[slug] && Object.keys(extras[slug]).length > 0;

                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => setViendoExtras(slug)}
                        title={`${persona.nombre} — su canción, su frase y su foto de broma`}
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
                            {soyYo && (
                              <span className="ml-1 text-[10px] font-normal text-[#C8A96B]">
                                (tú)
                              </span>
                            )}
                          </span>

                          <span
                            className={`block text-[10px] ${
                              puestos === partidos.length
                                ? "text-emerald-300/70"
                                : "text-white/40"
                            }`}
                          >
                            {puestos === partidos.length
                              ? "Completa"
                              : puestos === 0
                                ? "Sin apostar"
                                : `${puestos}/${partidos.length}`}
                          </span>
                        </span>

                        <Smile
                          size={13}
                          aria-hidden
                          className={`shrink-0 ${
                            conExtras ? "text-[#C8A96B]" : "text-white/20"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {eligiendoJugadores && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Quién juega esta temporada
                    </p>

                    {!yo && (
                      <p className="mb-2 text-[11px] text-white/35">
                        Entra con tu correo para poder cambiar la lista.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {STAFF.map((persona) => {
                        const dentro = jugadores.includes(persona.slug);

                        return (
                          <button
                            key={persona.slug}
                            type="button"
                            disabled={!yo || estado === "guardando"}
                            onClick={() =>
                              void cambiaJugadores(
                                dentro
                                  ? jugadores.filter((uno) => uno !== persona.slug)
                                  : [...jugadores, persona.slug],
                              )
                            }
                            className={`rounded-lg border px-2 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
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

                    {INICIALES_SIN_DUENO.length > 0 && (
                      <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                        Del Excel del cuerpo técnico queda sin dueño{" "}
                        <strong className="text-white/55">
                          {INICIALES_SIN_DUENO.join(", ")}
                        </strong>
                        : dinos quién es y entra con su foto.
                      </p>
                    )}
                  </div>
                )}
              </Panel>
            </div>

            {/* --------------------- LOS PARTIDOS --------------------- */}

            <div className="mt-5">
              <Panel
                title="Los partidos"
                subtitle={
                  !yo
                    ? "Entra con tu correo para apostar y meter resultados"
                    : plazo.cerrada
                      ? "Jornada cerrada: tu apuesta ya no se puede cambiar"
                      : sinRellenar > 0
                        ? `Te faltan ${sinRellenar} por marcar`
                        : "Los tienes todos puestos"
                }
                icon={ListOrdered}
              >
                {/* Se quedó a medias: lo que se ve abajo es lo guardado, no lo
                    que marcó y no llegó a guardar. */}
                {borradorPerdido && (
                  <div className="mb-3">
                    <Notice tone="warn" title="Marcaste signos que no llegaste a guardar">
                      La jornada se cerró antes de pulsar «Guardar mi apuesta», así que lo que se
                      ve aquí es lo que había guardado, no lo que dejaste marcado. Ya no se puede
                      cambiar.
                    </Notice>
                  </div>
                )}

                {/* El plazo, siempre a la vista: es lo que más se pregunta. */}
                {plazo.viernes && (
                  <div
                    className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px] leading-snug ${
                      plazo.cerrada
                        ? "border-white/10 bg-white/[0.02] text-white/50"
                        : plazo.ultimasHoras
                          ? "border-amber-400/40 bg-amber-400/[0.08] text-amber-200"
                          : "border-[#C8A96B]/25 bg-[#C8A96B]/[0.05] text-white/70"
                    }`}
                  >
                    {plazo.cerrada ? (
                      <Lock size={13} aria-hidden className="mt-0.5 shrink-0" />
                    ) : (
                      <Clock size={13} aria-hidden className="mt-0.5 shrink-0" />
                    )}

                    <span>
                      {plazo.cerrada
                        ? `Cerrada desde el ${cuandoCierra(plazo.viernes)}.`
                        : plazo.ultimasHoras
                          ? `Hoy a las 12:00 se cierra. Lo que no esté guardado para entonces cuenta como fallo.`
                          : `Se puede apostar y cambiar hasta el ${cuandoCierra(plazo.viernes)}.`}
                    </span>
                  </div>
                )}

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

                        /*
                        | Cuántos de los que juegan lo han acertado: es lo que
                        | se comenta el lunes.
                        |
                        | Sólo se puede contar con la jornada cerrada: antes,
                        | el servidor no manda los pronósticos de los demás
                        | —y hace bien—, así que el recuento salía «1 de 10»
                        | aunque lo hubieran acertado todos.
                        */
                        const aciertan =
                          resultado && plazo.cerrada
                            ? jugadores.filter(
                                (slug) =>
                                  laJornada.pronosticos[slug]?.[indice] === resultado,
                              ).length
                            : null;

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
                                apagado={!yo || plazo.cerrada || guardandoApuesta}
                                resultado={resultado}
                              />
                            </td>

                            <td className="py-2 text-center">
                              <Tripleta
                                valor={resultado}
                                onElige={(signo) => void ponResultado(indice, signo)}
                                apagado={!yo || estado === "guardando"}
                                tono="neutro"
                              />
                            </td>

                            <td className="py-2 text-center text-[11px] tabular-nums text-white/45">
                              {aciertan === null ? "—" : `${aciertan}/${jugadores.length}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Guardar la apuesta: sólo si hay algo que guardar. */}
                {yo && !plazo.cerrada && (
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-3">
                    <span
                      className={`mr-auto text-[11px] ${
                        sinGuardar ? "text-amber-200/90" : "text-white/35"
                      }`}
                    >
                      {sinGuardar
                        ? "Tienes cambios sin guardar."
                        : guardados.some(Boolean)
                          ? "Tu apuesta está guardada. Puedes cambiarla hasta el cierre."
                          : "Marca tus signos y guarda la apuesta."}
                    </span>

                    {sinGuardar && (
                      <Button onClick={descartaBorrador} disabled={guardandoApuesta}>
                        Descartar
                      </Button>
                    )}

                    <Button
                      tone="primary"
                      icon={Save}
                      onClick={() => void guardaApuesta()}
                      disabled={!sinGuardar || guardandoApuesta}
                    >
                      {guardandoApuesta ? "Guardando…" : "Guardar mi apuesta"}
                    </Button>
                  </div>
                )}

                {yo && (
                  <p className="mt-3 text-[11px] text-white/35">
                    Los resultados se guardan al marcarlos y los puede meter
                    cualquiera que haya entrado; los pronósticos, sólo cada uno
                    el suyo.
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

            {/* --------------------- LA PARRILLA ---------------------- */}

            <div className="mt-5">
              <Parrilla
                jornada={laJornada}
                jugadores={jugadores}
                cerrada={plazo.cerrada}
                cuandoSeAbre={cuandoCierra(plazo.viernes)}
              />
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

                                  {/* Sólo el nombre: el puesto de cada uno no
                                      pinta nada en una apuesta entre
                                      compañeros (17/09/2026). */}
                                  <span className="min-w-0 truncate text-white/85">
                                    {persona.nombre}
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
                  Si hay empate en el segundo puesto no paga ninguno de los
                  empatados —inventar un desempate no lo acepta nadie—, salvo que
                  así no pagase nadie: entonces sólo se invita a quien va por
                  delante. Con cero aciertos no se invita a nadie.
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
              </>
            )}
          </div>
        </section>
      </div>

      {viendoExtras && (
        <FichaExtras
          key={viendoExtras}
          slug={viendoExtras}
          extras={extras[viendoExtras] ?? {}}
          editable={viendoExtras === yo}
          subiendo={subiendoFoto}
          onGuardar={guardaExtras}
          onFoto={subeFoto}
          onCerrar={() => setViendoExtras(null)}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  ENTRAR                                                             */
/* ------------------------------------------------------------------ */

/** Un campo de texto con el tipo que haga falta: correo o contraseña. */
function Entrada({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>

      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(evento) => onChange(evento.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
      />
    </label>
  );
}

type Manda = ReturnType<typeof useQuinielaSesion>["manda"];

/**
 * Registrarse, entrar, salir y cambiar la contraseña.
 *
 * Al registrarse **la contraseña es lo que va antes de la @ del correo**, y se
 * dice en pantalla tal cual: nadie tiene que repartir contraseñas por WhatsApp.
 * A cambio no es secreta, así que mientras alguien no la cambie se le recuerda.
 */
function Acceso({
  yo,
  cargando,
  manda,
}: {
  yo: Yo | null;
  cargando: boolean;
  manda: Manda;
}) {
  const [modo, setModo] = useState<"entrar" | "registrar">("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [quien, setQuien] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cambiando, setCambiando] = useState(false);

  const envia = async (cuerpo: Record<string, unknown>, exito: string) => {
    setEnviando(true);

    try {
      await manda(cuerpo);

      setClave("");
      toast.success(exito);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido");
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <Panel title="Tu cuenta" subtitle="Comprobando si ya habías entrado…" icon={KeyRound}>
        <div className="h-10" />
      </Panel>
    );
  }

  if (yo) {
    return (
      <Panel
        title={`Has entrado como ${yo.nombre}`}
        subtitle={yo.correo}
        icon={KeyRound}
        action={
          <div className="flex flex-wrap gap-2">
            <Button icon={KeyRound} onClick={() => setCambiando(true)}>
              Cambiar contraseña
            </Button>

            <Button
              icon={LogOut}
              disabled={enviando}
              onClick={() => void envia({ accion: "salir" }, "Has salido")}
            >
              Salir
            </Button>
          </div>
        }
      >
        {yo.inicial ? (
          <Notice tone="warn" title="Tu contraseña es la de registro">
            Es lo que va antes de la @ de tu correo, así que quien sepa tu
            correo puede entrar como tú. Cámbiala cuando puedas.
          </Notice>
        ) : (
          <p className="text-[11px] text-white/40">
            Sólo tú puedes poner y cambiar tu apuesta. La sesión dura un mes en
            este navegador.
          </p>
        )}

        {cambiando && (
          <CambiarClave manda={manda} onCerrar={() => setCambiando(false)} />
        )}
      </Panel>
    );
  }

  const registrando = modo === "registrar";

  const nombreCorreo = correo.includes("@") ? correo.split("@")[0] : "";

  return (
    <Panel
      title="Entra para apostar"
      subtitle="Cada uno pone sólo lo suyo. Ver el ranking no necesita entrar"
      icon={KeyRound}
      action={
        <Segmented
          ariaLabel="Entrar o registrarse"
          value={modo}
          onChange={setModo}
          options={[
            { key: "entrar", label: "Entrar" },
            { key: "registrar", label: "Registrarme" },
          ]}
        />
      }
    >
      <form
        onSubmit={(evento) => {
          evento.preventDefault();

          if (registrando) {
            void envia(
              { accion: "registrar", slug: quien, correo },
              "Registrado. Ya puedes apostar",
            );
          } else {
            void envia({ accion: "entrar", correo, clave }, "Dentro");
          }
        }}
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        {registrando ? (
          <Select
            label="Quién eres"
            value={quien}
            onChange={setQuien}
            options={[
              { value: "", label: "Elige tu nombre" },
              ...STAFF.map((persona) => ({
                value: persona.slug,
                label: persona.nombre,
              })),
            ]}
          />
        ) : null}

        <Entrada
          label="Tu correo"
          type="email"
          autoComplete="email"
          value={correo}
          onChange={setCorreo}
          placeholder="nombre@dominio.com"
        />

        {!registrando && (
          <Entrada
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={setClave}
          />
        )}

        <Button
          type="submit"
          tone="primary"
          disabled={
            enviando ||
            !correo.trim() ||
            (registrando ? !quien : !clave)
          }
        >
          {enviando ? "Un momento…" : registrando ? "Registrarme" : "Entrar"}
        </Button>
      </form>

      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        {registrando ? (
          <>
            Tu contraseña será lo que va antes de la @ de tu correo
            {nombreCorreo && (
              <>
                {" "}— en tu caso,{" "}
                <strong className="text-white/70">{nombreCorreo}</strong>
              </>
            )}
            . Después puedes cambiarla. Con ese correo te llegará el aviso de
            los viernes a las 9:00.
          </>
        ) : (
          <>
            ¿Primera vez? Pulsa «Registrarme». Si ya te registraste y no
            cambiaste la contraseña, es lo que va antes de la @ de tu correo.
          </>
        )}
      </p>
    </Panel>
  );
}

function CambiarClave({ manda, onCerrar }: { manda: Manda; onCerrar: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repite, setRepite] = useState("");
  const [enviando, setEnviando] = useState(false);

  const noCasan = repite.length > 0 && nueva !== repite;

  const cambia = async () => {
    setEnviando(true);

    try {
      await manda({ accion: "cambiar", actual, nueva });

      toast.success("Contraseña cambiada");
      onCerrar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      title="Cambiar la contraseña"
      subtitle="La de ahora, y dos veces la nueva"
      onClose={onCerrar}
      footer={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>

          <Button
            tone="primary"
            disabled={enviando || !actual || !nueva || nueva !== repite}
            onClick={() => void cambia()}
          >
            {enviando ? "Cambiando…" : "Cambiarla"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Entrada
          label="La de ahora"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={setActual}
        />

        <Entrada
          label="La nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={setNueva}
        />

        <Entrada
          label="Otra vez la nueva"
          type="password"
          autoComplete="new-password"
          value={repite}
          onChange={setRepite}
        />

        {noCasan && (
          <p className="text-[11px] text-rose-300/80">Las dos nuevas no coinciden.</p>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  LA COSECHA                                                         */
/* ------------------------------------------------------------------ */

/**
 * La cosecha de cada uno: su canción, su frase y su foto de broma.
 *
 * Cada uno edita **la suya** y ve la de los demás. Se escribe en un borrador y
 * se guarda con el botón: guardar a cada tecla serían decenas de escrituras por
 * una frase. La canción es un enlace y no un fichero: subir audio al almacén
 * del club para una broma sería pagar espacio y derechos por algo que ya está
 * en YouTube o en Spotify. La foto sí se sube, porque la gracia está en que sea
 * suya.
 */
function FichaExtras({
  slug,
  extras,
  editable,
  subiendo,
  onGuardar,
  onFoto,
  onCerrar,
}: {
  slug: string;
  extras: ExtrasJugador;
  editable: boolean;
  subiendo: boolean;
  onGuardar: (extras: ExtrasJugador) => Promise<boolean>;
  onFoto: (archivo: File) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const persona = PERSONA_POR_SLUG.get(slug);

  const entrada = useRef<HTMLInputElement | null>(null);

  const [borrador, setBorrador] = useState<ExtrasJugador>(extras);
  const [guardando, setGuardando] = useState(false);

  if (!persona) return null;

  const cambia = (cambio: Partial<ExtrasJugador>) =>
    setBorrador((actual) => ({ ...actual, ...cambio }));

  const iguales = (["cancion", "cancionNombre", "frase", "foto"] as const).every(
    (clave) => (borrador[clave] ?? "").trim() === (extras[clave] ?? "").trim(),
  );

  const guarda = async () => {
    setGuardando(true);

    const bien = await onGuardar(borrador);

    setGuardando(false);

    if (bien) onCerrar();
  };

  /* Lo de otro: sólo se mira. */
  if (!editable) {
    const vacio =
      !extras.cancion && !extras.cancionNombre && !extras.frase && !extras.foto;

    return (
      <Dialog
        title={`La cosecha de ${persona.nombre}`}
        subtitle="Cada uno pone la suya cuando quiere"
        onClose={onCerrar}
        footer={<Button onClick={onCerrar}>Cerrar</Button>}
      >
        {vacio ? (
          <EmptyState
            title="Todavía no ha puesto nada"
            description="Ni canción, ni frase, ni foto de broma. Ya caerá."
          />
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {extras.foto && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={extras.foto}
                alt={`La foto de broma de ${persona.nombre}`}
                className="h-40 w-40 shrink-0 rounded-xl object-cover"
              />
            )}

            <div className="min-w-0 space-y-3">
              {extras.frase && (
                <p className="text-[15px] italic leading-relaxed text-white/85">
                  «{extras.frase}»
                </p>
              )}

              {extras.cancion ? (
                <a
                  href={extras.cancion}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-[#C8A96B] underline underline-offset-2"
                >
                  <Music size={12} aria-hidden />
                  {extras.cancionNombre || "Su canción"}
                </a>
              ) : (
                /* Sin enlace pero con nombre: se dice igual, que para eso lo
                   ha escrito. */
                extras.cancionNombre && (
                  <p className="inline-flex items-center gap-1.5 text-[12px] text-white/55">
                    <Music size={12} aria-hidden />
                    {extras.cancionNombre}
                  </p>
                )
              )}
            </div>
          </div>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Tu cosecha"
      subtitle="Se puede rellenar cuando quieras, y cambiar las veces que haga falta"
      onClose={onCerrar}
      footer={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>

          <Button
            tone="primary"
            icon={Save}
            disabled={guardando || subiendo || iguales}
            onClick={() => void guarda()}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
            <Music size={11} aria-hidden />
            Tu canción
          </span>

          <Field
            label="Cómo se llama"
            value={borrador.cancionNombre ?? ""}
            onChange={(valor) => cambia({ cancionNombre: valor })}
            placeholder="Ej.: Paquito el Chocolatero"
          />

          <div className="mt-2">
            <Field
              label="Enlace"
              value={borrador.cancion ?? ""}
              onChange={(valor) => cambia({ cancion: valor })}
              placeholder="open.spotify.com/track/… o youtu.be/…"
              hint="No se sube el audio: va el enlace. Se puede pegar tal cual, sin https://"
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
            <Quote size={11} aria-hidden />
            Tu frase
          </span>

          <TextArea
            label=""
            value={borrador.frase ?? ""}
            onChange={(valor) => cambia({ frase: valor })}
            placeholder="La que quieras que te saquen cuando aciertes… o cuando falles"
            rows={2}
          />
        </div>

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
            <ImagePlus size={11} aria-hidden />
            Tu foto de broma
          </span>

          <div className="flex items-center gap-3">
            {borrador.foto ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={borrador.foto}
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

                  if (archivo) {
                    void onFoto(archivo).then((url) => {
                      if (url) cambia({ foto: url });
                    });
                  }

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
                {subiendo ? "Subiendo…" : borrador.foto ? "Cambiarla" : "Subir una"}
              </Button>

              {borrador.foto && (
                <button
                  type="button"
                  onClick={() => cambia({ foto: "" })}
                  className="ml-2 text-[11px] text-white/35 underline underline-offset-2 transition hover:text-white/70"
                >
                  Quitarla
                </button>
              )}

              <p className="mt-1.5 text-[11px] text-white/35">
                Hasta 4 MB. La ven todos al pulsar tu nombre.
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
