"use client";

/**
 * AJUSTES: LO QUE SE PUEDE PONER AL DÍA A MANO.
 *
 * Casi todo en esta plataforma se actualiza solo —la tarea nocturna del
 * ordenador del club baja lo de BeSoccer cada noche y el índice de Wyscout se
 * rehace al publicar— pero a veces no se quiere esperar: se acaba un partido un
 * martes, o la noche anterior el ordenador estaba apagado.
 *
 * Aquí están esos botones, y **cada uno dice lo que de verdad hace**, que es la
 * parte que importa:
 *
 * - **Los resultados de la quiniela** se piden en el momento: el servidor lee
 *   BeSoccer y escribe el 1-X-2. Puede no poder —BeSoccer contesta 403 o 406 a
 *   las IP de centro de datos— y entonces lo dice en vez de fingir que sí.
 * - **Los datos de los rivales** no: son media hora de trabajo y la misma
 *   puerta cerrada. El botón **deja un encargo**, y el ordenador del club lo
 *   atiende en su siguiente pasada —se despierta cada dos horas— aunque ya
 *   hubiera hecho la de hoy.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Download,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { AbpHeader, Button, Notice, Panel } from "@/components/abp/ui";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion";

type ParteJornada = {
  jornada: number;
  escritos: number;
  detalle: string[];
  saltada?: string;
};

type Mantenimiento = {
  pedidoEn?: string;
  pedidoPor?: string;
  hechoEn?: string;
  resultado?: string;
};

/** "hace 12 min", "hace 3 h", "ayer". */
function hace(iso?: string) {
  if (!iso) return "";

  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);

  if (!Number.isFinite(minutos) || minutos < 0) return "";

  if (minutos < 2) return "ahora mismo";

  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.round(minutos / 60);

  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.round(horas / 24);

  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

export default function AjustesPage() {
  const { yo, cargando } = useQuinielaSesion();

  const [pidiendo, setPidiendo] = useState<"quiniela" | "rivales" | null>(null);

  const [parte, setParte] = useState<ParteJornada[] | null>(null);

  const [bloqueado, setBloqueado] = useState(false);

  const [mantenimiento, setMantenimiento] = useState<Mantenimiento | null>(null);

  const [testigo, setTestigo] = useState(0);

  /* El estado del encargo. La forma del efecto es la que pasa el linter. */
  useEffect(() => {
    let cancelado = false;

    fetch("/api/mantenimiento", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok?: boolean; estado?: Mantenimiento }>)
      .then((datos) => {
        if (!cancelado && datos.ok) setMantenimiento(datos.estado ?? {});
      })
      .catch(() => {
        /* Sin esto la pantalla sigue: es un añadido, no un requisito. */
      });

    return () => {
      cancelado = true;
    };
  }, [testigo]);

  const recarga = useCallback(() => setTestigo((n) => n + 1), []);

  const actualizaQuiniela = async () => {
    setPidiendo("quiniela");
    setParte(null);

    const aviso = toast.loading("Preguntando a BeSoccer…");

    try {
      const respuesta = await fetch("/api/quiniela/actualizar", { method: "POST" });

      const datos = (await respuesta.json()) as {
        ok?: boolean;
        cambios?: number;
        bloqueado?: boolean;
        jornadas?: ParteJornada[];
        error?: string;
      };

      if (!respuesta.ok || !datos.ok) throw new Error(datos.error ?? `HTTP ${respuesta.status}`);

      setParte(datos.jornadas ?? []);
      setBloqueado(Boolean(datos.bloqueado));

      if (datos.bloqueado) {
        toast.warning("BeSoccer no contesta desde el servidor", {
          id: aviso,
          description: "Lo hará el ordenador del club esta noche.",
        });
      } else if ((datos.cambios ?? 0) > 0) {
        toast.success(`${datos.cambios} resultado(s) puestos`, {
          id: aviso,
          description: "El ranking y la parrilla ya lo tienen.",
        });
      } else {
        toast.success("Nada nuevo", {
          id: aviso,
          description: "No hay ningún partido nuevo con resultado.",
        });
      }
    } catch (error) {
      toast.error("No se ha podido actualizar", {
        id: aviso,
        description: error instanceof Error ? error.message : "Inténtalo otra vez",
      });
    } finally {
      setPidiendo(null);
    }
  };

  const pideRivales = async () => {
    setPidiendo("rivales");

    try {
      const respuesta = await fetch("/api/mantenimiento", { method: "POST" });

      const datos = (await respuesta.json()) as { ok?: boolean; error?: string };

      if (!respuesta.ok || !datos.ok) throw new Error(datos.error ?? `HTTP ${respuesta.status}`);

      toast.success("Encargo dejado", {
        description: "El ordenador del club lo hará en su próxima pasada.",
      });

      recarga();
    } catch (error) {
      toast.error("No se ha podido dejar el encargo", {
        description: error instanceof Error ? error.message : "Inténtalo otra vez",
      });
    } finally {
      setPidiendo(null);
    }
  };

  const pendiente =
    mantenimiento?.pedidoEn &&
    (!mantenimiento.hechoEn ||
      Date.parse(mantenimiento.pedidoEn) > Date.parse(mantenimiento.hechoEn));

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Ajustes"
              title="Poner al día"
              lead="Lo que normalmente se actualiza solo, pedido a mano cuando no se quiere esperar."
            />

            {!cargando && !yo && (
              <div className="mt-6">
                <Notice tone="warn" title="Hay que entrar para usar esto">
                  Estos botones escriben en los datos del club, así que piden la
                  misma cuenta que la quiniela. Entra desde{" "}
                  <strong className="text-white/75">La Quiniela de la Semana</strong>{" "}
                  y vuelve.
                </Notice>
              </div>
            )}

            <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-2">
              {/* ------------------- LA QUINIELA ------------------- */}

              <Panel
                title="Resultados de la quiniela"
                subtitle="Los baja de BeSoccer y los escribe al momento"
                icon={Trophy}
                action={
                  <Button
                    tone="primary"
                    icon={RefreshCw}
                    disabled={!yo || pidiendo !== null}
                    onClick={() => void actualizaQuiniela()}
                  >
                    {pidiendo === "quiniela" ? "Mirando…" : "Actualizar ahora"}
                  </Button>
                }
              >
                <p className="text-[12px] leading-relaxed text-white/45">
                  Mira la jornada en curso y la anterior, y pone el 1-X-2 de los
                  partidos que ya se hayan jugado. No toca una jornada que no
                  apostó nadie: sin apuestas, poner resultados sólo repartiría
                  fallos.
                </p>

                <p className="mt-2 text-[11px] leading-relaxed text-white/30">
                  Esto mismo lo hace solo el ordenador del club cada noche, y se
                  repite cada dos horas si una pasada no sale.
                </p>

                {bloqueado && (
                  <div className="mt-3">
                    <Notice tone="warn" title="BeSoccer no deja mirar desde aquí">
                      Contesta 403 o 406 a las IP de centro de datos, y esta
                      página vive en una. No es un fallo del botón ni de la red
                      del club: desde el ordenador del club sí funciona, y es lo
                      que hace cada noche. Si corre prisa, doble clic en{" "}
                      <code className="text-white/60">scripts/jornada-nocturna.cmd</code>.
                    </Notice>
                  </div>
                )}

                {parte && parte.length > 0 && (
                  <ul className="mt-3 space-y-2 text-[11px] leading-relaxed">
                    {parte.map((jornada) => (
                      <li key={jornada.jornada} className="rounded-xl border border-white/[0.07] px-3 py-2">
                        <p className="flex items-center gap-1.5 text-white/70">
                          {jornada.escritos > 0 ? (
                            <Check size={12} className="text-emerald-300" aria-hidden />
                          ) : (
                            <AlertTriangle size={12} className="text-white/25" aria-hidden />
                          )}
                          Jornada {jornada.jornada}:{" "}
                          {jornada.saltada
                            ? jornada.saltada
                            : jornada.escritos > 0
                              ? `${jornada.escritos} resultado(s) puestos`
                              : "sin novedades"}
                        </p>

                        {jornada.detalle.length > 0 && (
                          <ul className="mt-1 space-y-0.5 pl-5 text-white/35">
                            {jornada.detalle.map((linea) => (
                              <li key={linea}>{linea}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {/* -------------------- LOS RIVALES ------------------- */}

              <Panel
                title="Datos de los rivales"
                subtitle="Informes, plantillas, fichas y clasificación"
                icon={Download}
                action={
                  <Button
                    icon={CalendarClock}
                    disabled={!yo || pidiendo !== null || Boolean(pendiente)}
                    onClick={() => void pideRivales()}
                  >
                    {pidiendo === "rivales"
                      ? "Pidiendo…"
                      : pendiente
                        ? "Ya está pedido"
                        : "Pedir actualización"}
                  </Button>
                }
              >
                <p className="text-[12px] leading-relaxed text-white/45">
                  Esto <strong className="text-white/70">no</strong> lo puede hacer esta página: es media hora de
                  descargas y BeSoccer no atiende a los servidores. El botón deja
                  un encargo y lo recoge el ordenador del club, que se despierta
                  cada dos horas y lo hará aunque ya hubiera pasado hoy.
                </p>

                <div className="mt-3 space-y-1 text-[11px] text-white/40">
                  {mantenimiento?.pedidoEn && (
                    <p>
                      Último encargo: <span className="text-white/65">{hace(mantenimiento.pedidoEn)}</span>
                      {pendiente ? " · todavía sin hacer" : ""}
                    </p>
                  )}

                  {mantenimiento?.hechoEn && (
                    <p>
                      Última pasada hecha:{" "}
                      <span className="text-white/65">{hace(mantenimiento.hechoEn)}</span>
                      {mantenimiento.resultado ? ` · ${mantenimiento.resultado}` : ""}
                    </p>
                  )}

                  {!mantenimiento?.pedidoEn && !mantenimiento?.hechoEn && (
                    <p>Todavía no se ha pedido ninguna desde aquí.</p>
                  )}
                </div>
              </Panel>
            </div>

            <div className="mt-5">
              <Notice tone="info" title="Lo que sigue haciéndose solo">
                <ul className="space-y-1">
                  <li>
                    El <strong className="text-white/75">correo de la quiniela</strong>,
                    los viernes a las 9:00, con los partidos y una frase.
                  </li>
                  <li>
                    Los <strong className="text-white/75">resultados</strong>, dos
                    veces al día —a las 21:00 y a medianoche— desde el propio
                    servidor, y otra vez de madrugada desde el ordenador del
                    club. El fin de semana se ponen solos.
                  </li>
                  <li>
                    La <strong className="text-white/75">foto semanal de Wyscout</strong>,
                    al bajar los datos, que es lo que permite ver después lo que
                    hizo cada uno en una jornada suelta.
                  </li>
                </ul>
              </Notice>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
