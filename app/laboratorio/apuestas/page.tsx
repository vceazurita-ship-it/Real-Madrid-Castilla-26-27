"use client";

/**
 * En obras · Apuestas del staff.
 *
 * Uno del cuerpo técnico tira una predicción, dice qué se juega y pone el día
 * en que se comprueba. Los demás se ponen a favor o en contra hasta ese día,
 * y llegado el día cualquiera que haya entrado dice si acertó o falló. El
 * marcador —aciertos y fallos de cada uno, lanzando y siguiendo— se cuenta
 * solo.
 *
 * Juegan las mismas personas que en la quiniela y con la misma cuenta: el
 * panel de acceso es el de allí (`components/quiniela/Acceso.tsx`). Las
 * reglas están en `lib/apuestas/modelo.ts` y las aplica el servidor en
 * `/api/apuestas/guardar`; aquí sólo se enseña y se pide.
 *
 * Si el staff pide otra cosa —puntos, apuestas con cuota, varias
 * comprobaciones— se cambia aquí sin tocar la quiniela.
 */

import { useMemo, useState } from "react";
import {
  CalendarCheck,
  Check,
  Dices,
  ListOrdered,
  Megaphone,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AbpHeader, Button, Field, Notice, Panel, TextArea } from "@/components/abp/ui";
import { Acceso } from "@/components/quiniela/Acceso";
import { Avatar } from "@/components/quiniela/Avatar";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useApuestasDoc } from "@/hooks/useApuestasDoc";
import { useAhora } from "@/hooks/useQuinielaDoc";
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion";
import {
  EN_JUEGO_MAXIMO,
  PREDICCION_MAXIMA,
  bandos,
  diasHasta,
  estadoDe,
  fechaLarga,
  hoyMadrid,
  marcador,
  ordenadas,
  puedePosicionarse,
  puedeResolverse,
  puedeRetirarse,
  sumaDias,
  type Apuesta,
  type EstadoApuesta,
  type Postura,
  type Veredicto,
} from "@/lib/apuestas/modelo";
import { PERSONA_POR_SLUG, nombreCorto } from "@/lib/quiniela/staff";

type Guarda = ReturnType<typeof useApuestasDoc>["guarda"];

const nombreDe = (slug: string) => PERSONA_POR_SLUG.get(slug)?.nombre ?? slug;

const cortoDe = (slug: string) => {
  const persona = PERSONA_POR_SLUG.get(slug);

  return persona ? nombreCorto(persona) : slug;
};

/** "2026-10-09T10:12:00.000Z" → "9 oct". */
function diaDe(iso: string) {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) return "";

  return `${fecha.getDate()} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][fecha.getMonth()]}`;
}

export default function ApuestasPage() {
  const ahora = useAhora(60_000);

  const hoy = useMemo(() => hoyMadrid(ahora), [ahora]);

  const sesion = useQuinielaSesion();

  const yo = sesion.yo?.slug ?? null;

  const { doc, estado, guarda } = useApuestasDoc();

  const { vivas, resueltas } = useMemo(() => ordenadas(doc.apuestas, hoy), [doc, hoy]);

  const tabla = useMemo(() => marcador(doc.apuestas), [doc]);

  /* El titular es el dato: cuántas hay abiertas y cuándo se comprueba la
     primera. Sin apuestas, la descripción de siempre. */
  const titular =
    vivas.length > 0
      ? `${vivas.length === 1 ? "Una apuesta abierta" : `${vivas.length} apuestas abiertas`} · próxima comprobación el ${fechaLarga(vivas[0].comprobar)}`
      : "Uno tira una predicción y dice qué se juega. Los demás se ponen a favor o en contra, y el día señalado se comprueba quién tenía razón.";

  /* Quien no ha entrado lee primero lo que hay; el acceso baja debajo de la
     lista. Sin nada que leer, el acceso sigue arriba como invitación. */
  const accesoAbajo =
    !yo && !sesion.cargando && estado === "listo" && doc.apuestas.length > 0;

  /* Con apuestas abiertas, el acceso lo dice con el dato y el verbo. */
  const tituloAcceso =
    vivas.length > 0
      ? `${vivas.length === 1 ? "Una apuesta abierta" : `${vivas.length} apuestas abiertas`}: entra y ponte a favor o en contra`
      : estado === "listo" && doc.apuestas.length === 0
        ? "Entra y lanza la primera"
        : "Entra para apostar";

  const pasos = (
    <ol className="list-decimal space-y-1 pl-4">
      <li>Lanza tu predicción, di qué te juegas y pon el día de comprobación.</li>
      <li>Los demás se ponen a favor o en contra hasta el día antes.</li>
      <li>Ese día, cualquiera que haya entrado da el veredicto.</li>
    </ol>
  );

  const acceso = (
    <div id="acceso-apuestas" className="mt-5 scroll-mt-24">
      <Acceso
        yo={sesion.yo}
        cargando={sesion.cargando}
        manda={sesion.manda}
        titulo={tituloAcceso}
        subtitulo="Entra con tu cuenta de la quiniela"
      />
    </div>
  );

  const pide = async (cuerpo: Record<string, unknown>, exito: string) => {
    try {
      await guarda(cuerpo);

      toast.success(exito);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido");
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Laboratorio"
              title="Apuestas del staff"
              lead={titular}
            />

            {/* ------------------------ CÓMO FUNCIONA ------------------ */}

            <div className="mt-5">
              {estado === "listo" && doc.apuestas.length > 0 ? (
                <details className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                  <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60">
                    Cómo funciona
                  </summary>
                  <div className="mt-2">{pasos}</div>
                </details>
              ) : estado === "listo" ? null : (
                <Notice tone="info" title="Cómo funciona">
                  {pasos}
                </Notice>
              )}
            </div>

            {/* Sin ninguna apuesta publicada: el ejemplo, abierto y encima del
                acceso, para que la pantalla enseñe qué se ve aquí antes de pedir
                que entres. */}
            {estado === "listo" && doc.apuestas.length === 0 && (
              <details open className="group mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60">
                  Aún nadie ha lanzado una apuesta
                </summary>
                <div className="mt-3 space-y-3 text-sm text-white/70">
                  {pasos}
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60">
                    Así se ve una apuesta
                  </p>
                  <article className="flex max-w-xl flex-col gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4">
                    <span className="inline-flex w-fit items-center rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                      Ejemplo
                    </span>
                    <p className="text-[15px] font-medium leading-snug text-white/90">
                      «El Castilla acaba la primera vuelta entre los cinco primeros»
                    </p>
                    <p className="text-[12px] text-white/55">
                      <span className="uppercase tracking-[0.14em] text-white/35">Se juega</span>{" "}
                      <span className="text-[#E4CE9B]">Un desayuno para todo el staff</span>
                    </p>
                    <p className="text-[11px] text-white/45">
                      Se comprueba el último día de la vuelta. Hasta entonces, cada uno se pone a favor o en contra.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled
                        title="Entra para apostar"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] font-semibold text-white/45"
                      >
                        <ThumbsUp size={13} />
                        A favor
                      </button>
                      <button
                        type="button"
                        disabled
                        title="Entra para apostar"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] font-semibold text-white/45"
                      >
                        <ThumbsDown size={13} />
                        En contra
                      </button>
                    </div>
                  </article>
                </div>
              </details>
            )}

            {!accesoAbajo && acceso}

            {/* ------------------------ QUIÉN ERES --------------------- */}

            {/* ------------------------ LANZAR UNA --------------------- */}

            {yo && (
              <div className="mt-5">
                <Lanzar guarda={guarda} hoy={hoy} ocupado={estado === "guardando"} />
              </div>
            )}

            {/* ------------------------ EN JUEGO ----------------------- */}

            {/* Sin apuestas en juego el panel no sale: la invitación a lanzar
                la primera ya la hace el panel de arriba. */}
            {(estado === "cargando" || estado === "error" || vivas.length > 0) && (
            <div className="mt-5">
              <Panel
                title="En juego"
                subtitle={
                  vivas.length
                    ? `${vivas.length === 1 ? "Una apuesta" : `${vivas.length} apuestas`} sin resolver, la que antes se comprueba primero`
                    : undefined
                }
                icon={Dices}
              >
                {estado === "cargando" && (
                  <p className="text-sm text-white/50">Leyendo las apuestas…</p>
                )}

                {estado === "error" && (
                  <p className="text-sm text-[#F6AFB6]">
                    No se han podido leer las apuestas. Recarga en un momento.
                  </p>
                )}

                {vivas.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {vivas.map((apuesta) => (
                      <Tarjeta
                        key={apuesta.id}
                        apuesta={apuesta}
                        yo={yo}
                        hoy={hoy}
                        ocupado={estado === "guardando"}
                        pide={pide}
                      />
                    ))}
                  </div>
                )}
              </Panel>
            </div>
            )}

            {/* ------------------------ RESUELTAS ---------------------- */}

            {resueltas.length > 0 && (
              <div className="mt-5">
                <Panel
                  title="Quién tenía razón"
                  subtitle="Las apuestas ya comprobadas, de la última a la primera"
                  icon={CalendarCheck}
                >
                  <div className="grid gap-3 lg:grid-cols-2">
                    {resueltas.map((apuesta) => (
                      <Tarjeta
                        key={apuesta.id}
                        apuesta={apuesta}
                        yo={yo}
                        hoy={hoy}
                        ocupado={estado === "guardando"}
                        pide={pide}
                      />
                    ))}
                  </div>
                </Panel>
              </div>
            )}

            {/* ------------------------ MARCADOR ----------------------- */}

            {tabla.length > 0 && resueltas.length > 0 && (
            <div className="mt-5">
              <Panel
                title="Marcador"
                subtitle="Sólo cuentan las resueltas. Quien lanza acierta si se cumple; quien va a favor, con él; quien va en contra, si falla"
                icon={ListOrdered}
              >
                {(
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                          <th className="pb-2 pr-3 font-semibold">#</th>
                          <th className="pb-2 pr-3 font-semibold">Quién</th>
                          <th className="pb-2 pr-3 text-right font-semibold">Lanzadas</th>
                          <th className="pb-2 pr-3 text-right font-semibold">Seguidas</th>
                          <th className="pb-2 pr-3 text-right font-semibold">Aciertos</th>
                          <th className="pb-2 pr-3 text-right font-semibold">Fallos</th>
                          <th className="pb-2 text-right font-semibold">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabla.map((linea, indice) => (
                          <tr
                            key={linea.slug}
                            className={`border-t border-white/[0.06] ${linea.slug === yo ? "bg-[#C8A96B]/[0.06]" : ""}`}
                          >
                            <td className="py-2 pr-3 text-white/40">{indice + 1}</td>
                            <td className="py-2 pr-3">
                              <span className="inline-flex items-center gap-2">
                                <Avatar slug={linea.slug} lado={24} />
                                <span className="font-medium">{cortoDe(linea.slug)}</span>
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-white/70">{linea.lanzadas}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-white/70">{linea.seguidas}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-emerald-300">{linea.aciertos}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-rose-300">{linea.fallos}</td>
                            <td className="py-2 text-right font-semibold tabular-nums text-[#E4CE9B]">
                              {linea.balance > 0 ? `+${linea.balance}` : linea.balance}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
            )}

            {accesoAbajo && acceso}
          </div>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  LANZAR                                                            */
/* ------------------------------------------------------------------ */

function Lanzar({ guarda, hoy, ocupado }: { guarda: Guarda; hoy: string; ocupado: boolean }) {
  const [prediccion, setPrediccion] = useState("");
  const [enJuego, setEnJuego] = useState("");
  const [comprobar, setComprobar] = useState("");
  const [enviando, setEnviando] = useState(false);

  const lista =
    prediccion.trim().length >= 8 && enJuego.trim().length > 0 && comprobar > hoy;

  /* Lo que falta, dicho: el botón apagado sin más no explicaba nada. */
  const falta =
    prediccion.trim().length < 8
      ? "Escribe la predicción (al menos 8 letras)"
      : !enJuego.trim()
        ? "Di qué te juegas"
        : !comprobar
          ? "Pon el día en que se comprueba"
          : comprobar <= hoy
            ? "El día tiene que ser mañana como pronto"
            : "";

  const lanza = async () => {
    setEnviando(true);

    try {
      await guarda({
        accion: "nueva",
        prediccion: prediccion.trim(),
        enJuego: enJuego.trim(),
        comprobar,
      });

      setPrediccion("");
      setEnJuego("");
      setComprobar("");

      toast.success("Apuesta lanzada. A ver quién se moja");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Panel
      title="Lanzar una apuesta"
      subtitle="Qué va a pasar, qué te juegas y el día en que se mira"
      icon={Megaphone}
      action={
        <Button
          tone="primary"
          icon={Megaphone}
          disabled={!lista || enviando || ocupado}
          title={falta || undefined}
          onClick={() => void lanza()}
        >
          {enviando ? "Lanzando…" : "Lanzarla"}
        </Button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
        <TextArea
          label={`La predicción · ${prediccion.length}/${PREDICCION_MAXIMA}`}
          value={prediccion}
          onChange={(valor) => setPrediccion(valor.slice(0, PREDICCION_MAXIMA))}
          placeholder="El Castilla acaba la primera vuelta entre los cinco primeros"
          rows={3}
        />

        <Field
          label="Qué te juegas"
          value={enJuego}
          onChange={(valor) => setEnJuego(valor.slice(0, EN_JUEGO_MAXIMO))}
          placeholder="Un desayuno para todo el staff"
        />

        <Field
          label="Cuándo se comprueba"
          type="date"
          value={comprobar}
          onChange={setComprobar}
          /* Mañana como pronto, también en el calendario: antes dejaba
             elegir hoy o un día pasado y sólo se avisaba debajo (19/10/2026). */
          min={sumaDias(hoy, 1)}
          hint={
            comprobar && comprobar < hoy
              ? "Ese día ya ha pasado"
              : comprobar && comprobar === hoy
                ? "Hoy no: nadie podría ponerse a favor o en contra. Mañana como pronto"
                : comprobar
                  ? `Se mira el ${fechaLarga(comprobar)}. Hasta el día antes se admiten posturas`
                  : "Mañana como pronto. Hasta el día antes se admiten posturas"
          }
        />
      </div>

      {falta && (prediccion || enJuego || comprobar) && (
        <p className="mt-3 text-[11px] text-white/45">Para lanzarla: {falta.charAt(0).toLowerCase() + falta.slice(1)}.</p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  LA TARJETA                                                       */
/* ------------------------------------------------------------------ */

const CHIP: Record<EstadoApuesta, { texto: (a: Apuesta, hoy: string) => string; clase: string }> = {
  abierta: {
    texto: (a, hoy) => {
      const dias = diasHasta(a.comprobar, hoy);

      return dias === 1 ? "Se comprueba mañana" : `Se comprueba el ${fechaLarga(a.comprobar)}`;
    },
    clase: "border-[#C8A96B]/30 bg-[#C8A96B]/10 text-[#C8A96B]",
  },
  "a-comprobar": {
    texto: () => "Toca comprobarla",
    clase: "border-sky-300/30 bg-sky-300/10 text-sky-200",
  },
  acertada: {
    texto: () => "Acertada",
    clase: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  },
  fallada: {
    texto: () => "Fallada",
    clase: "border-rose-300/30 bg-rose-300/10 text-rose-200",
  },
};

function Tarjeta({
  apuesta,
  yo,
  hoy,
  ocupado,
  pide,
}: {
  apuesta: Apuesta;
  yo: string | null;
  hoy: string;
  ocupado: boolean;
  pide: (cuerpo: Record<string, unknown>, exito: string) => Promise<void>;
}) {
  const estado = estadoDe(apuesta, hoy);

  const chip = CHIP[estado];

  const { favor, contra } = bandos(apuesta);

  const miPostura: Postura | null = yo ? (apuesta.posturas[yo] ?? null) : null;

  const soyAutor = yo === apuesta.autor;

  const puedoPosicionarme = puedePosicionarse(apuesta, yo, hoy);

  const puedoResolver = puedeResolverse(apuesta, yo, hoy);

  const puedoRetirar = puedeRetirarse(apuesta, yo);

  /* Retirarla la borra para siempre y no tiene deshacer: se pregunta. */
  const retira = () => {
    if (!window.confirm("¿Retirar esta apuesta? Se borra y no se puede recuperar.")) return;

    void pide({ accion: "retirar", id: apuesta.id }, "Apuesta retirada");
  };

  const postura = (nueva: Postura) =>
    void pide(
      { accion: "postura", id: apuesta.id, postura: miPostura === nueva ? null : nueva },
      miPostura === nueva
        ? "Te has quitado"
        : nueva === "favor"
          ? "Vas a favor"
          : "Vas en contra",
    );

  const veredicto = (dado: Veredicto | null) =>
    void pide(
      { accion: "veredicto", id: apuesta.id, veredicto: dado },
      dado === null ? "Veredicto deshecho" : dado === "acertada" ? "Acertada" : "Fallada",
    );

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border p-4 ${
        estado === "acertada"
          ? "border-emerald-300/20 bg-emerald-300/[0.04]"
          : estado === "fallada"
            ? "border-rose-300/20 bg-rose-300/[0.04]"
            : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar slug={apuesta.autor} lado={36} />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {nombreDe(apuesta.autor)}
              {soyAutor && <span className="ml-1.5 text-[10px] uppercase tracking-[0.14em] text-[#C8A96B]">tú</span>}
            </p>
            <p className="text-[11px] text-white/40">Lanzada el {diaDe(apuesta.creadaEn)}</p>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${chip.clase}`}
        >
          {chip.texto(apuesta, hoy)}
        </span>
      </header>

      <p className="text-[15px] font-medium leading-snug text-white/90">
        «{apuesta.prediccion}»
      </p>

      <p className="text-[12px] text-white/55">
        <span className="uppercase tracking-[0.14em] text-white/35">Se juega</span>{" "}
        <span className="text-[#E4CE9B]">{apuesta.enJuego}</span>
      </p>

      {/* ---------------------- los bandos ---------------------- */}

      <div className="grid gap-2 sm:grid-cols-2">
        <Bando
          titulo="A favor"
          icono={ThumbsUp}
          gente={favor}
          autor={apuesta.autor}
          tono="emerald"
          activo={miPostura === "favor"}
          puedo={puedoPosicionarme && !ocupado}
          pideEntrar={!yo && estado === "abierta"}
          onPulsa={() => postura("favor")}
        />

        <Bando
          titulo="En contra"
          icono={ThumbsDown}
          gente={contra}
          tono="rose"
          activo={miPostura === "contra"}
          puedo={puedoPosicionarme && !ocupado}
          pideEntrar={!yo && estado === "abierta"}
          onPulsa={() => postura("contra")}
        />
      </div>

      {/* ---------------------- el veredicto -------------------- */}

      {apuesta.veredicto ? (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-white/45">
          <span>
            {apuesta.veredicto === "acertada" ? "Acertó" : "Falló"}
            {apuesta.resueltaPor ? ` · lo dio ${cortoDe(apuesta.resueltaPor)}` : ""}
            {apuesta.resueltaEn ? ` el ${diaDe(apuesta.resueltaEn)}` : ""}
          </span>

          {puedoResolver && (
            <Button icon={Undo2} disabled={ocupado} onClick={() => veredicto(null)}>
              Deshacer
            </Button>
          )}
        </footer>
      ) : estado === "a-comprobar" ? (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
          <span className="text-[11px] text-white/45">
            {puedoResolver ? "¿Qué ha pasado?" : "Entra para dar el veredicto"}
          </span>

          {puedoResolver && (
            <div className="flex flex-wrap gap-2">
              <Button icon={Check} tone="primary" disabled={ocupado} onClick={() => veredicto("acertada")}>
                Acertó
              </Button>
              <Button icon={X} tone="danger" disabled={ocupado} onClick={() => veredicto("fallada")}>
                Falló
              </Button>
              {puedoRetirar && (
                <Button icon={Trash2} disabled={ocupado} onClick={retira}>
                  Retirarla
                </Button>
              )}
            </div>
          )}
        </footer>
      ) : puedoRetirar ? (
        <footer className="flex items-center justify-end border-t border-white/[0.06] pt-3">
          <Button icon={Trash2} disabled={ocupado} onClick={retira}>
            Retirarla
          </Button>
        </footer>
      ) : null}
    </article>
  );
}

function Bando({
  titulo,
  icono: Icono,
  gente,
  autor,
  tono,
  activo,
  puedo,
  pideEntrar = false,
  onPulsa,
}: {
  titulo: string;
  icono: typeof ThumbsUp;
  gente: string[];
  /** En el bando de «a favor» va el autor el primero, marcado. */
  autor?: string;
  tono: "emerald" | "rose";
  activo: boolean;
  puedo: boolean;
  /** Sin sesión y abierta: el botón sale apagado y dice por qué. */
  pideEntrar?: boolean;
  onPulsa: () => void;
}) {
  const total = gente.length + (autor ? 1 : 0);

  const colores =
    tono === "emerald"
      ? {
          borde: activo ? "border-emerald-300/50 bg-emerald-300/10" : "border-white/10 bg-white/[0.02]",
          texto: "text-emerald-200",
        }
      : {
          borde: activo ? "border-rose-300/50 bg-rose-300/10" : "border-white/10 bg-white/[0.02]",
          texto: "text-rose-200",
        };

  return (
    <div className={`rounded-xl border p-2.5 ${colores.borde}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${colores.texto}`}>
          <Icono size={13} />
          {titulo}
          <span className="text-white/40">· {total}</span>
        </span>

        {puedo && (
          <button
            type="button"
            onClick={onPulsa}
            className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
              activo
                ? `${colores.texto} border-current`
                : "border-white/15 text-white/70 hover:border-white/30 hover:text-white"
            }`}
          >
            {activo ? "Quitarme" : titulo === "A favor" ? "Me apunto" : "Lo dudo"}
          </button>
        )}

        {pideEntrar && (
          <button
            type="button"
            disabled
            title="Entra para apostar"
            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-white/45"
          >
            Entra para apostar
          </button>
        )}
      </div>

      <div className="mt-2 flex min-h-[28px] flex-wrap items-center gap-1.5">
        {autor && (
          <span
            title={`${nombreDe(autor)} · lanzó la apuesta`}
            className="rounded-full ring-2 ring-[#C8A96B]/70"
          >
            <Avatar slug={autor} lado={26} />
          </span>
        )}

        {gente.map((slug) => (
          <Avatar key={slug} slug={slug} lado={26} />
        ))}
      </div>
    </div>
  );
}
