"use client";

/**
 * AJUSTES: LO QUE SE PUEDE PONER AL DÍA A MANO.
 *
 * Casi todo en esta plataforma se actualiza solo —la tarea nocturna del
 * ordenador del club baja lo de BeSoccer cada noche y Wyscout se baja una vez
 * por semana— pero a veces no se quiere esperar: se acaba un partido un
 * sábado por la tarde y se quiere ver ya.
 *
 * Los tres botones hacen su trabajo **en el ordenador del club**, porque es el
 * único sitio desde donde se puede: BeSoccer contesta con páginas vacías a los
 * servidores y Wyscout sólo se baja manejando un Chrome con la sesión puesta.
 * El botón deja un encargo, el vigía de ese ordenador (`scripts/vigia.cjs`) lo
 * recoge en segundos y la pantalla va contando: pedido, en marcha, hecho y
 * cómo fue. Si el ordenador está apagado se dice, y el encargo espera a que se
 * encienda.
 *
 * La quiniela tiene un atajo: si el vigía no contesta, el servidor lo intenta
 * él mismo por si BeSoccer le deja algún día.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  Download,
  Loader2,
  Monitor,
  RefreshCw,
  Trophy,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { AbpHeader, Button, Notice, Panel } from "@/components/abp/ui";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion";
import {
  LIMITE_MIN,
  estadoEncargo,
  vigiaVivo,
  type EstadoEncargo,
  type Mantenimiento,
  type Tarea,
  type Vigia,
} from "@/lib/mantenimiento";

type ParteJornada = {
  jornada: number;
  escritos: number;
  detalle: string[];
  saltada?: string;
};

/** "hace 12 min", "hace 3 h", "ayer". */
function hace(iso: string | undefined, ahora: number) {
  if (!iso || !ahora) return "";

  const segundos = Math.round((ahora - new Date(iso).getTime()) / 1000);

  if (!Number.isFinite(segundos) || segundos < 0) return "ahora mismo";

  if (segundos < 60) return segundos < 10 ? "ahora mismo" : `hace ${segundos} s`;

  const minutos = Math.round(segundos / 60);

  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.round(minutos / 60);

  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.round(horas / 24);

  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

const NOMBRE: Record<Tarea, string> = {
  quiniela: "Resultados de la quiniela",
  rivales: "Jornada de BeSoccer",
  wyscout: "Datos de Wyscout",
};

const TARDA: Record<Tarea, string> = {
  quiniela: "suele tardar menos de un minuto",
  rivales: "suele tardar unos cuarenta minutos",
  wyscout: "suele tardar unos diez minutos",
};

/** Lo que dice el pie de cada panel. */
function EstadoLinea({
  tarea,
  estado,
  vigia,
  ahora,
  encargo,
}: {
  tarea: Tarea;
  estado: EstadoEncargo;
  vigia: Vigia | null;
  ahora: number;
  encargo: Mantenimiento[Tarea];
}) {
  const vivo = vigiaVivo(vigia, ahora);

  return (
    <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed">
      {estado === "pedido" && (
        <p className="flex items-start gap-1.5 text-amber-300">
          <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin" aria-hidden />
          <span>
            Pedido {hace(encargo?.pedidoEn, ahora)}.{" "}
            {vivo
              ? "El ordenador del club lo coge en unos segundos…"
              : "El ordenador del club está apagado: lo hará en cuanto se encienda."}
          </span>
        </p>
      )}

      {estado === "en-marcha" && (
        <p className="flex items-start gap-1.5 text-amber-300">
          <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin" aria-hidden />
          <span>
            En marcha{encargo?.empezadoEn ? ` desde ${hace(encargo.empezadoEn, ahora)}` : ""} ·{" "}
            {TARDA[tarea]}. Puedes cerrar esta página: sigue igual.
          </span>
        </p>
      )}

      {estado === "cortado" && (
        <p className="flex items-start gap-1.5 text-amber-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Empezó {hace(encargo?.empezadoEn, ahora)} y no terminó (más de{" "}
            {LIMITE_MIN[tarea]} min): se cortó. Se puede volver a pedir.
          </span>
        </p>
      )}

      {encargo?.hechoEn && (
        <p className="flex items-start gap-1.5 text-white/45">
          {encargo.ok === false ? (
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
          ) : (
            <Check size={12} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
          )}
          <span>
            Última vez: <span className="text-white/65">{hace(encargo.hechoEn, ahora)}</span>
            {encargo.resultado ? ` · ${encargo.resultado}` : ""}
          </span>
        </p>
      )}

      {!encargo?.hechoEn && estado === "libre" && (
        <p className="text-white/35">Todavía no se ha pedido desde aquí.</p>
      )}
    </div>
  );
}

export default function AjustesPage() {
  const { yo, cargando } = useQuinielaSesion();

  const [pidiendo, setPidiendo] = useState<Tarea | null>(null);

  const [parte, setParte] = useState<ParteJornada[] | null>(null);

  const [estado, setEstado] = useState<Mantenimiento>({});

  const [vigia, setVigia] = useState<Vigia | null>(null);

  /* El reloj de la pantalla: se pone al día con cada lectura. Así los «hace
     X min» se mueven sin llamar a Date.now() en el render. */
  const [ahora, setAhora] = useState(0);

  const [testigo, setTestigo] = useState(0);

  /* Lo que esta pantalla ha pedido y todavía no ha visto terminar, para
     avisar con un toast cuando acabe. */
  const esperando = useRef<Partial<Record<Tarea, string>>>({});

  const activo = (["quiniela", "rivales", "wyscout"] as Tarea[]).some((tarea) => {
    const suyo = estadoEncargo(tarea, estado[tarea], ahora);

    return suyo === "pedido" || suyo === "en-marcha";
  });

  /* Lee el estado; mientras haya algo en marcha, cada cinco segundos. */
  useEffect(() => {
    let cancelado = false;

    const lee = () =>
      fetch("/api/mantenimiento", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ ok?: boolean; estado?: Mantenimiento; vigia?: Vigia | null }>)
        .then((datos) => {
          if (cancelado || !datos.ok) return;

          const nuevo = datos.estado ?? {};

          setEstado(nuevo);
          setVigia(datos.vigia ?? null);
          setAhora(Date.now());

          for (const [tarea, pedidoEn] of Object.entries(esperando.current) as [Tarea, string][]) {
            const suyo = nuevo[tarea];

            if (suyo?.hechoEn && Date.parse(suyo.hechoEn) > Date.parse(pedidoEn)) {
              delete esperando.current[tarea];

              const decir = suyo.ok === false ? toast.warning : toast.success;

              decir(`${NOMBRE[tarea]}: ${suyo.ok === false ? "no ha salido" : "hecho"}`, {
                description: suyo.resultado,
              });
            }
          }
        })
        .catch(() => {
          /* Sin esto la pantalla sigue: se reintenta en la siguiente vuelta. */
        });

    void lee();

    const reloj = setInterval(() => void lee(), activo ? 5_000 : 30_000);

    return () => {
      cancelado = true;

      clearInterval(reloj);
    };
  }, [testigo, activo]);

  const recarga = useCallback(() => setTestigo((n) => n + 1), []);

  const pide = async (tarea: Tarea) => {
    setPidiendo(tarea);

    try {
      const respuesta = await fetch("/api/mantenimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarea }),
      });

      const datos = (await respuesta.json()) as {
        ok?: boolean;
        error?: string;
        estado?: Mantenimiento;
      };

      if (!respuesta.ok || !datos.ok) throw new Error(datos.error ?? `HTTP ${respuesta.status}`);

      esperando.current[tarea] = datos.estado?.[tarea]?.pedidoEn ?? new Date().toISOString();

      toast.success("Pedido", {
        description: vigiaVivo(vigia, Date.now())
          ? "El ordenador del club lo empieza en unos segundos."
          : "El ordenador del club está apagado: lo hará en cuanto se encienda.",
      });

      recarga();
    } catch (error) {
      toast.error("No se ha podido pedir", {
        description: error instanceof Error ? error.message : "Inténtalo otra vez",
      });
    } finally {
      setPidiendo(null);
    }
  };

  const actualizaQuiniela = async () => {
    setPidiendo("quiniela");
    setParte(null);

    const aviso = toast.loading("Pidiendo los resultados…");

    try {
      const respuesta = await fetch("/api/quiniela/actualizar", { method: "POST" });

      const datos = (await respuesta.json()) as {
        ok?: boolean;
        cambios?: number;
        bloqueado?: boolean;
        encargado?: boolean;
        jornadas?: ParteJornada[];
        error?: string;
      };

      if (!respuesta.ok || !datos.ok) throw new Error(datos.error ?? `HTTP ${respuesta.status}`);

      if (datos.encargado) {
        esperando.current.quiniela = new Date().toISOString();

        toast.success("Pedido al ordenador del club", {
          id: aviso,
          description: datos.bloqueado
            ? "BeSoccer no deja mirar desde el servidor y el ordenador del club no contesta: lo hará en cuanto se encienda."
            : "Lo está mirando en BeSoccer; en unos segundos lo verás aquí.",
        });
      } else {
        setParte(datos.jornadas ?? []);

        toast.success(
          (datos.cambios ?? 0) > 0 ? `${datos.cambios} resultado(s) puestos` : "Nada nuevo",
          { id: aviso, description: "El ranking y la parrilla ya lo tienen." },
        );
      }

      recarga();
    } catch (error) {
      toast.error("No se ha podido actualizar", {
        id: aviso,
        description: error instanceof Error ? error.message : "Inténtalo otra vez",
      });
    } finally {
      setPidiendo(null);
    }
  };

  /* Un pedido que el vigía dice tener entre manos ya está en marcha: pasa con
     la jornada de BeSoccer, que se apunta al empezar la tarea programada. */
  const deTarea = (tarea: Tarea): EstadoEncargo => {
    const suyo = estadoEncargo(tarea, estado[tarea], ahora);

    return suyo === "pedido" && vigiaVivo(vigia, ahora) && vigia?.ocupado?.includes(tarea)
      ? "en-marcha"
      : suyo;
  };

  const estados = {
    quiniela: deTarea("quiniela"),
    rivales: deTarea("rivales"),
    wyscout: deTarea("wyscout"),
  } satisfies Record<Tarea, EstadoEncargo>;

  const ocupada = (tarea: Tarea) =>
    estados[tarea] === "pedido" || estados[tarea] === "en-marcha";

  const vivo = vigiaVivo(vigia, ahora);

  const rotulo = (tarea: Tarea, libre: string) =>
    pidiendo === tarea
      ? "Pidiendo…"
      : estados[tarea] === "en-marcha"
        ? "En marcha…"
        : estados[tarea] === "pedido"
          ? "Pedido"
          : libre;

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

            {/* ---------------- EL ORDENADOR DEL CLUB ---------------- */}

            <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-white/[0.07] px-4 py-3 text-[12px] leading-relaxed">
              <Monitor
                size={15}
                className={`mt-0.5 shrink-0 ${vivo ? "text-emerald-300" : "text-amber-300"}`}
                aria-hidden
              />

              {!ahora ? (
                <p className="text-white/40">Mirando si el ordenador del club está escuchando…</p>
              ) : vivo ? (
                <p className="text-white/55">
                  <strong className="text-white/80">El ordenador del club está escuchando</strong>{" "}
                  (último aviso {hace(vigia?.vistoEn, ahora)}
                  {vigia?.equipo ? `, ${vigia.equipo}` : ""}). Lo que pidas aquí empieza en
                  unos segundos.
                </p>
              ) : (
                <p className="text-white/55">
                  <strong className="text-amber-300">El ordenador del club no contesta</strong>
                  {vigia?.vistoEn ? ` desde ${hace(vigia.vistoEn, ahora)}` : ""}.
                  Estará apagado o sin red: lo que pidas queda apuntado y se hace en
                  cuanto se encienda.
                </p>
              )}
            </div>

            <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-3">
              {/* ------------------- LA QUINIELA ------------------- */}

              <Panel
                title="Resultados de la quiniela"
                subtitle="El 1-X-2 de la jornada, de BeSoccer"
                icon={Trophy}
                action={
                  <Button
                    tone="primary"
                    icon={RefreshCw}
                    disabled={!yo || pidiendo !== null || ocupada("quiniela")}
                    onClick={() => void actualizaQuiniela()}
                  >
                    {rotulo("quiniela", "Actualizar ahora")}
                  </Button>
                }
              >
                <p className="text-[12px] leading-relaxed text-white/45">
                  Mira la jornada en curso y la anterior, y pone el 1-X-2 de los
                  partidos que ya se hayan jugado. No toca una jornada que no
                  apostó nadie: sin apuestas, poner resultados sólo repartiría
                  fallos.
                </p>

                <EstadoLinea
                  tarea="quiniela"
                  estado={estados.quiniela}
                  encargo={estado.quiniela}
                  vigia={vigia}
                  ahora={ahora}
                />

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

              {/* -------------------- BESOCCER ------------------- */}

              <Panel
                title="Jornada de BeSoccer"
                subtitle="Equipos y jugadores: rivales y los nuestros"
                icon={Download}
                action={
                  <Button
                    tone="primary"
                    icon={RefreshCw}
                    disabled={!yo || pidiendo !== null || ocupada("rivales")}
                    onClick={() => void pide("rivales")}
                  >
                    {rotulo("rivales", "Actualizar ahora")}
                  </Button>
                }
              >
                <p className="text-[12px] leading-relaxed text-white/45">
                  Resultados, goleadores y alineaciones de los rivales,
                  clasificación, las fichas de sus jugadores y de los nuestros,
                  altas, bajas, dorsales y las caras que falten. Es la misma
                  pasada que se hace cada noche, lanzada ahora.
                </p>

                <EstadoLinea
                  tarea="rivales"
                  estado={estados.rivales}
                  encargo={estado.rivales}
                  vigia={vigia}
                  ahora={ahora}
                />
              </Panel>

              {/* -------------------- WYSCOUT ------------------- */}

              <Panel
                title="Datos de Wyscout"
                subtitle="Los informes nuevos de toda la liga, y publicados"
                icon={BarChart3}
                action={
                  <Button
                    tone="primary"
                    icon={UploadCloud}
                    disabled={!yo || pidiendo !== null || ocupada("wyscout")}
                    onClick={() => void pide("wyscout")}
                  >
                    {rotulo("wyscout", "Traer y publicar")}
                  </Button>
                }
              >
                <p className="text-[12px] leading-relaxed text-white/45">
                  Baja de Wyscout la ficha de los veinte equipos del grupo y los
                  jugadores de toda la categoría, relee la carpeta, guarda la
                  foto de la jornada y lo publica: en un par de minutos más lo
                  tiene Data Análisis.
                </p>

                <p className="mt-2 text-[11px] leading-relaxed text-white/30">
                  En el ordenador del club se abre un Chrome que se mueve solo:
                  que nadie lo toque mientras trabaja. Si la sesión de Wyscout ha
                  caducado, alguien tiene que entrar una vez a mano
                  (<code className="text-white/50">scripts\actualizar-wys.cmd</code>).
                </p>

                <EstadoLinea
                  tarea="wyscout"
                  estado={estados.wyscout}
                  encargo={estado.wyscout}
                  vigia={vigia}
                  ahora={ahora}
                />
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
                    La <strong className="text-white/75">jornada de BeSoccer</strong> y
                    los <strong className="text-white/75">resultados</strong>, cada
                    noche desde el ordenador del club, con reintentos cada dos horas.
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
