"use client";

/**
 * Laboratorio · pruebas que todavía no son parte del trabajo.
 *
 * Lo que hay aquí funciona con los datos de verdad pero **no escribe en
 * ninguno**: se mira, se juzga y se decide si merece pasar a su sección. Por
 * eso está aparte y por eso lo dice en grande.
 *
 * La primera prueba es la que más falta hacía esta semana: **del scouting al
 * borrador del plan de partido**. El análisis del rival se rellena viendo
 * vídeo y casi siempre está; el plan se escribe la noche antes y es lo que se
 * lleva a la charla. Lo segundo sale de lo primero más la identidad del
 * equipo, así que un modelo puede adelantar el borrador —nunca el plan— y
 * ahorrar la parte de mirar treinta campos y ordenarlos.
 *
 * El motivo de que exista, dicho sin adornos: el 9 de septiembre de 2026 se
 * perdió el plan del Águilas entero y el scouting sobrevivió. Con esto, de un
 * scouting que está se saca un borrador en veinte segundos.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Beaker,
  Binoculars,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Button, Notice, Panel } from "@/components/abp/ui";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { useEscudos } from "@/hooks/useEscudos";
import { cargaJornadas, type JornadaRival } from "@/lib/abp/jornada";
import {
  ETIQUETA_CAMPO,
  MOTORES,
  MOTOR_POR_DEFECTO,
  type Borrador,
  type CampoBorrador,
} from "@/lib/laboratorio/plan";

type Entrada = {
  rival: string;
  jornada: string;
  camposScouting: string[];
  ejemplos: string[];
  tokens: { entrada: number; salida: number };
};

export default function LaboratorioPage() {
  const escudoDe = useEscudos();

  const [jornadas, setJornadas] = useState<JornadaRival[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState("");

  const [rivalId, setRivalId] = useState("");
  const [motor, setMotor] = useState(MOTOR_POR_DEFECTO);

  const [trabajando, setTrabajando] = useState(false);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    const control = new AbortController();

    cargaJornadas(control.signal)
      .then((filas) => {
        if (control.signal.aborted) return;

        setJornadas(filas);
        setCargando(false);

        /* Se abre en el próximo partido, que es el que se está preparando. */
        const hoy = new Date().toISOString().slice(0, 10);

        const proximo =
          filas.find((fila) => fila.fecha && fila.fecha >= hoy) ?? filas[0];

        if (proximo) setRivalId(proximo.id);
      })
      .catch((error) => {
        if (control.signal.aborted) return;

        console.error("[laboratorio] hoja RIVALES", error);

        setFallo("No se ha podido leer la hoja RIVALES.");
        setCargando(false);
      });

    return () => control.abort();
  }, []);

  const elegido = useMemo(
    () => jornadas.find((fila) => fila.id === rivalId) ?? null,
    [jornadas, rivalId],
  );

  const motorElegido = useMemo(
    () => MOTORES.find((m) => m.key === motor) ?? MOTORES[0],
    [motor],
  );

  const genera = useCallback(async () => {
    if (!rivalId || trabajando) return;

    setTrabajando(true);
    setBorrador(null);
    setEntrada(null);

    const aviso = toast.loading(
      `Leyendo el scouting y redactando con ${motorElegido.label}…`,
    );

    try {
      const respuesta = await fetch("/api/laboratorio/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rivalId, motor }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) throw new Error(datos?.error ?? "No ha salido");

      setBorrador(datos.borrador as Borrador);
      setEntrada(datos.entrada as Entrada);

      toast.success(
        `Borrador listo · ${datos.borrador.campos.length} campos${
          datos.borrador.coste ? ` · unos ${datos.borrador.coste} céntimos` : " · sin coste"
        }`,
        { id: aviso },
      );
    } catch (error) {
      console.error("[laboratorio] borrador", error);

      toast.error(
        error instanceof Error ? error.message : "No se ha podido montar",
        { id: aviso },
      );
    } finally {
      setTrabajando(false);
    }
  }, [motor, motorElegido.label, rivalId, trabajando]);

  const copia = useCallback(async (campo: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);

      setCopiado(campo);

      toast.success("Copiado: pégalo en el plan de partido");
    } catch {
      toast.error("El navegador no ha dejado copiar");
    }
  }, []);

  const copiaTodo = useCallback(async () => {
    if (!borrador) return;

    const texto = borrador.campos
      .map(
        (campo) =>
          `${ETIQUETA_CAMPO[campo.campo as CampoBorrador] ?? campo.campo}\n${campo.texto}`,
      )
      .join("\n\n");

    await copia("__todo", texto);
  }, [borrador, copia]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Laboratorio"
              title="Del scouting al plan de partido"
              lead="Prueba: coge el análisis del rival que ya está escrito en la hoja y redacta un borrador del plan —claves, ataque, defensa, ABP, duelos y estructuras— imitando los planes que ya ha escrito el cuerpo técnico. No escribe nada: se lee, se corrige y se copia lo que valga."
              aside={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  <Beaker size={12} />
                  En pruebas
                </span>
              }
            />

            <div className="mt-5">
              <Notice title="Qué se puede y qué no, sin adornos">
                <p>
                  <strong className="text-white/75">GPT-6 Astra</strong> (OpenAI,
                  3 de septiembre de 2026) está disponible por API y se puede
                  usar aquí, pero <strong className="text-white/75">no es
                  gratis</strong>: se cobra por uso —10 $ el millón de tokens de
                  entrada y 50 $ el de salida—, o sea unos 14 céntimos por
                  borrador. No hace falta suscripción nueva: sale de la clave de
                  OpenAI que el proyecto ya tiene.
                </p>

                <p className="mt-2">
                  <strong className="text-white/75">Higgsfield</strong> se queda
                  fuera. Su plan gratuito da generaciones con marca de agua sobre
                  modelos básicos y sin crédito mensual, y los planes de pago
                  empiezan en 19 $/mes. Para vídeo del equipo no aporta nada que
                  se pueda usar gratis, así que no lo he montado.
                </p>

                <p className="mt-2">
                  Por eso la prueba abre con{" "}
                  <strong className="text-white/75">Gemini 2.5 Flash</strong>,
                  que ya usa esta app para el dictado por voz y cuyo plan
                  gratuito cubre de sobra unos cuantos borradores por semana.
                  Astra está ahí al lado para comparar.
                </p>
              </Notice>
            </div>

            {/* ===================== EL ENCARGO ===================== */}

            <div className="mt-5">
              <Panel
                title="Qué se redacta"
                subtitle="Elige el partido y con qué motor. El scouting sale de la hoja RIVALES."
                icon={Wand2}
                action={
                  elegido && (
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white/70">
                      <EscudoEquipo
                        nombre={elegido.equipo}
                        escudo={escudoDe(elegido.equipo)}
                        lado={26}
                      />

                      <span className="truncate">{elegido.equipo}</span>
                    </span>
                  )
                }
              >
                <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Partido
                    </span>

                    <select
                      value={rivalId}
                      onChange={(evento) => setRivalId(evento.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                    >
                      {jornadas.length === 0 && (
                        <option value="">
                          {cargando ? "Cargando la hoja…" : "Sin partidos"}
                        </option>
                      )}

                      {jornadas.map((fila) => (
                        <option
                          key={fila.id}
                          value={fila.id}
                          className="bg-[#11161C]"
                        >
                          {`J${String(fila.jornada).padStart(2, "0")} · ${fila.equipo}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                      Motor
                    </span>

                    <select
                      value={motor}
                      onChange={(evento) => setMotor(evento.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                    >
                      {MOTORES.map((item) => (
                        <option
                          key={item.key}
                          value={item.key}
                          className="bg-[#11161C]"
                        >
                          {item.label}
                          {item.gratis ? " · sin coste" : " · de pago"}
                        </option>
                      ))}
                    </select>

                    <span className="mt-1 block text-[10px] text-white/30">
                      {motorElegido.pista}
                    </span>
                  </label>

                  <div className="flex items-start">
                    <Button
                      tone="primary"
                      icon={Sparkles}
                      onClick={genera}
                      disabled={!rivalId || trabajando}
                    >
                      {trabajando ? "Redactando…" : "Redactar el borrador"}
                    </Button>
                  </div>
                </div>

                {fallo && (
                  <p className="mt-3 text-xs text-rose-300/80">{fallo}</p>
                )}
              </Panel>
            </div>

            {/* ==================== EL BORRADOR ==================== */}

            {borrador && (
              <>
                <div className="mt-5">
                  <Panel
                    title="Con qué se ha escrito"
                    subtitle="Sin esto no hay forma de juzgar si el borrador es flojo o es que el scouting lo era"
                    icon={Binoculars}
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          rotulo: "Campos de scouting usados",
                          dato: `${entrada?.camposScouting.length ?? 0}`,
                        },
                        {
                          rotulo: "Planes de ejemplo",
                          dato: entrada?.ejemplos.join(", ") || "—",
                        },
                        {
                          rotulo: "Motor y coste",
                          dato: `${borrador.motor} · ${
                            borrador.coste
                              ? `${borrador.coste} céntimos`
                              : "sin coste"
                          }`,
                        },
                      ].map((dato) => (
                        <div
                          key={dato.rotulo}
                          className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                        >
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                            {dato.rotulo}
                          </p>

                          <p className="mt-1 truncate text-sm text-white/80">
                            {dato.dato}
                          </p>
                        </div>
                      ))}
                    </div>

                    {borrador.huecos.length > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-amber-300">
                          <AlertTriangle size={12} />
                          Lo que el scouting no cuenta
                        </p>

                        <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-white/60">
                          {borrador.huecos.map((hueco) => (
                            <li key={hueco}>· {hueco}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Panel>
                </div>

                <div className="mt-5">
                  <Panel
                    title={`El borrador · ${borrador.campos.length} campos`}
                    subtitle="Ninguno de estos textos se ha escrito en la hoja. Copia el que te sirva y pégalo en el plan de partido."
                    icon={ClipboardList}
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        <Button icon={Copy} onClick={copiaTodo}>
                          Copiar todo
                        </Button>

                        <Link href="/match-preparation">
                          <Button icon={ClipboardCheck}>
                            Abrir el plan de partido
                          </Button>
                        </Link>
                      </div>
                    }
                  >
                    <div className="space-y-2.5">
                      {borrador.campos.map((campo) => (
                        <div
                          key={campo.campo}
                          className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C8A96B]">
                              {ETIQUETA_CAMPO[campo.campo as CampoBorrador] ??
                                campo.campo}
                            </p>

                            <Button
                              icon={copiado === campo.campo ? ClipboardCheck : Copy}
                              onClick={() => copia(campo.campo, campo.texto)}
                            >
                              {copiado === campo.campo ? "Copiado" : "Copiar"}
                            </Button>
                          </div>

                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                            {campo.texto}
                          </p>

                          {campo.seApoyaEn.length > 0 && (
                            <p className="mt-2 text-[10px] leading-relaxed text-white/30">
                              Se apoya en: {campo.seApoyaEn.join(" · ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </>
            )}

            {!borrador && !trabajando && (
              <p className="mt-8 text-center text-xs text-white/35">
                Elige un partido y pulsa «Redactar el borrador». Tarda unos
                veinte segundos.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
