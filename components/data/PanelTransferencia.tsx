"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Flame,
  Loader2,
  Timer,
  Users,
} from "lucide-react";

import { Notice, Panel } from "@/components/abp/ui";
import { Composicion, Lectura } from "@/components/data/formas";
import { MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import {
  FASES_TRANSFERENCIA,
  avisosDe,
  cruza,
  leeEntrenamientos,
  type Aviso,
  type SemanaCruzada,
  type TareaEntrenamiento,
} from "@/lib/data-analisis/transferencia";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import { esNuestro, evolucionDe } from "@/lib/data-analisis/individual";
import { traeJson } from "@/lib/hojaCsv";

/**
 * ENTRENAMIENTO Y COMPETICIÓN, EN LA MISMA PANTALLA.
 *
 * La plataforma tenía las dos mitades separadas: los microciclos por un lado y
 * los informes del partido por otro. Aquí se cruzan por el nombre del rival de
 * cada semana, que es lo que las ata sin inventarse nada.
 *
 * Lo que sale son avisos accionables el lunes —dónde hay tiempo puesto que no
 * se está viendo, y dónde falla algo que casi no se trabaja— y el reparto del
 * tiempo, la carga física y la carga cognitiva por momento del juego.
 */
export function PanelTransferencia({
  nuestros,
  liga,
  equipos,
  temporada,
  jugadores,
}: {
  nuestros: FilaPartido[];
  liga: FilaPartido[];
  equipos: string[];
  temporada: string;
  /** La plantilla con sus métricas, para cruzarla con los seguimientos. */
  jugadores: FilaJugador[];
}) {
  const [tareas, setTareas] = useState<TareaEntrenamiento[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;

    leeEntrenamientos()
      .then((t) => {
        if (vivo) setTareas(t);
      })
      .catch(() => {
        if (vivo) setError(true);
      });

    return () => {
      vivo = false;
    };
  }, []);

  const semanas = useMemo(
    () => (tareas ? cruza(tareas, nuestros, liga, equipos) : []),
    [equipos, liga, nuestros, tareas],
  );

  const avisos = useMemo(
    () => (tareas ? avisosDe(semanas, nuestros, liga, equipos) : []),
    [equipos, liga, nuestros, semanas, tareas],
  );

  if (error) {
    return (
      <div className="mt-5">
        <Notice tone="warn" title="No se ha podido leer la hoja de microciclos">
          Es la misma hoja que abre la pantalla de Microciclos. Si allí tampoco
          se ve, el problema es de la hoja y no de aquí.
        </Notice>
      </div>
    );
  }

  if (!tareas) {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 py-16 text-sm text-white/40">
        <Loader2 size={16} className="animate-spin" />
        Cruzando los microciclos con los informes de partido…
      </div>
    );
  }

  const conPartido = semanas.filter((s) => s.partido !== null);

  /* El reparto del tiempo de entrenamiento por momento del juego. */
  const reparto = FASES_TRANSFERENCIA.map((fase) => ({
    etiqueta: fase.label,
    valor: semanas.reduce((s, w) => s + (w.minutos[fase.key] ?? 0), 0),
  })).filter((t) => t.valor > 0);

  const alertas = avisos.filter((a) => a.tipo !== "bien");

  return (
    <>
      <div className="mt-5">
        <Notice title="Lo que se entrena contra lo que pasa el domingo">
          <p>
            Esto cruza <strong className="text-white/75">la hoja de
            microciclos</strong> —cada tarea con su fase, sus minutos y sus dos
            cargas— con{" "}
            <strong className="text-white/75">los informes del partido</strong>,
            atando cada semana con el rival que le toca. El nivel de cada fase
            se mide contra{" "}
            <strong className="text-white/75">la mediana de la categoría</strong>,
            no contra nosotros mismos: compararnos con nuestra propia media da
            cero siempre y no avisa de nada.
          </p>

          <p className="mt-2">
            <strong className="text-white/70">Es una alarma, no un
            veredicto.</strong> Con {conPartido.length}{" "}
            {conPartido.length === 1 ? "semana atada" : "semanas atadas"} a un
            partido, que una tarea del martes explique un córner del domingo no
            se demuestra: se sospecha. Sirve para decidir dónde mirar el vídeo.
          </p>
        </Notice>
      </div>

      {/* Los avisos, que es lo que se viene a buscar. */}
      <div className="mt-5">
        <Panel
          title={alertas.length ? "Dónde mirar esta semana" : "Sin avisos que dar"}
          subtitle="Tiempo de entrenamiento contra nivel en el partido, fase por fase"
          icon={AlertTriangle}
        >
          {conPartido.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-white/40">
              Ninguna semana de la hoja se ha podido atar a un informe de
              partido de {temporada}.
            </p>
          ) : (
            <div className="space-y-2.5">
              {avisos.map((aviso) => (
                <FilaAviso key={aviso.fase.key} aviso={aviso} />
              ))}
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Salta el aviso cuando una fase se lleva más de la quinta parte del
            tiempo y aun así queda por debajo de la categoría, o cuando queda
            por debajo y casi no se trabaja. Por debajo empieza en un 5 %, que
            es donde deja de ser ruido.
          </p>
        </Panel>
      </div>

      {/* El reparto: a qué se dedica el tiempo. */}
      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
        <Panel
          title="A qué se dedica el tiempo"
          subtitle="Minutos de tarea por momento del juego, en todos los microciclos"
          icon={Timer}
        >
          {reparto.length > 0 ? (
            <Composicion
              trozos={reparto}
              rotulo="El tiempo"
              lectura={lecturaDelReparto(reparto, avisos)}
            />
          ) : (
            <p className="py-8 text-center text-[12px] text-white/35">
              Sin minutos registrados.
            </p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Las tareas de competición y las globales no entran en ninguna fase:
            son partido, y el partido no es un contenido.
          </p>
        </Panel>

        <Panel
          title="Carga física y cognitiva"
          subtitle="Cuánto pesa cada momento del juego, no sólo cuánto dura"
          icon={Brain}
        >
          <CargasPorFase semanas={semanas} />

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            La carga se pondera por los minutos de cada tarea: una tarea corta
            muy intensa no pesa lo mismo que media hora suave.
          </p>
        </Panel>
      </div>

      {/* Semana a semana, para ver si la relación se sostiene. */}
      <div className="mt-5">
        <Panel
          title="Semana a semana"
          subtitle="Lo entrenado de cada fase y cómo salió esa fase en el partido de esa semana"
          icon={Flame}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                  <th className="pb-2 pr-3 font-medium">Semana</th>
                  <th className="pb-2 pr-3 text-right font-medium">Minutos</th>

                  {FASES_TRANSFERENCIA.map((f) => (
                    <th key={f.key} className="pb-2 pr-3 text-right font-medium">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {semanas.map((s) => (
                  <tr
                    key={s.micro}
                    className={`border-t border-white/[0.06] ${
                      s.partido ? "" : "opacity-45"
                    }`}
                  >
                    <td className="py-2 pr-3">
                      <span className="text-white/80">{s.rival || `Micro ${s.micro}`}</span>

                      <span className="ml-2 text-[11px] text-white/35">
                        {s.partido
                          ? `${s.partido.golesFavor}-${s.partido.golesContra}`
                          : "sin informe"}
                      </span>
                    </td>

                    <td className="py-2 pr-3 text-right tabular-nums text-white/55">
                      {s.minutosTotales.toFixed(0)}′
                    </td>

                    {FASES_TRANSFERENCIA.map((f) => {
                      const min = s.minutos[f.key] ?? 0;
                      const nivel = s.rendimiento[f.key];

                      return (
                        <td key={f.key} className="py-2 pr-3 text-right tabular-nums">
                          <span className="text-white/70">{min.toFixed(0)}′</span>

                          {nivel !== null && (
                            <span
                              className="ml-1.5 text-[11px]"
                              style={{ color: nivel >= 0 ? MEJOR : PEOR }}
                            >
                              {nivel >= 0 ? "+" : ""}
                              {nivel.toFixed(0)} %
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            En gris, las semanas cuyo partido todavía no tiene informe en la
            carpeta. El tanto por ciento es el nivel de esa fase en ese partido
            respecto a la mediana de la categoría.
          </p>
        </Panel>
      </div>

      {/* El trabajo individual: seguimientos, minutos y evolución. */}
      <TrabajoIndividual jugadores={jugadores} />
    </>
  );
}

/** Un aviso, con su color y su icono. */
function FilaAviso({ aviso }: { aviso: Aviso }) {
  const tono =
    aviso.tipo === "bien"
      ? { color: MEJOR, Icono: CheckCircle2, rotulo: "Va bien" }
      : aviso.tipo === "sin-transferencia"
        ? { color: PEOR, Icono: AlertTriangle, rotulo: "Se entrena y no se ve" }
        : { color: ORO, Icono: AlertTriangle, rotulo: "Falla y no se entrena" };

  return (
    <div
      className="rounded-xl border bg-white/[0.02] px-3.5 py-3"
      style={{ borderColor: `${tono.color}44` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-2">
          <tono.Icono size={14} style={{ color: tono.color }} />

          <span className="text-[13px] font-semibold text-white">
            {aviso.fase.label}
          </span>

          <span
            className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]"
            style={{ background: `${tono.color}1f`, color: tono.color }}
          >
            {tono.rotulo}
          </span>
        </span>

        <span className="text-[11px] tabular-nums text-white/40">
          {aviso.minutos.toFixed(0)}′ · {aviso.cuotaTiempo.toFixed(0)} % del tiempo
          {aviso.rendimiento !== null && (
            <span style={{ color: aviso.rendimiento >= 0 ? MEJOR : PEOR }}>
              {"  "}
              {aviso.rendimiento >= 0 ? "+" : ""}
              {aviso.rendimiento.toFixed(0)} % contra la liga
            </span>
          )}
        </span>
      </div>

      <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
        {aviso.texto}
      </p>

      <p className="mt-1 text-[11px] leading-relaxed text-white/30">
        {aviso.fase.pregunta}
      </p>
    </div>
  );
}

/** Las dos cargas, por fase, en la misma escala relativa. */
function CargasPorFase({ semanas }: { semanas: SemanaCruzada[] }) {
  const filas = FASES_TRANSFERENCIA.map((fase) => ({
    fase,
    carga: semanas.reduce((s, w) => s + (w.carga[fase.key] ?? 0), 0),
    cognitiva: semanas.reduce((s, w) => s + (w.cargaCog[fase.key] ?? 0), 0),
  })).filter((f) => f.carga > 0 || f.cognitiva > 0);

  const topeF = Math.max(...filas.map((f) => f.carga), 1);
  const topeC = Math.max(...filas.map((f) => f.cognitiva), 1);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-4 text-[10px] uppercase tracking-[0.16em]">
        <span className="flex items-center gap-1.5" style={{ color: ORO }}>
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: ORO }}
          />
          Física
        </span>

        <span className="flex items-center gap-1.5 text-white/40">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: tinta(0.32) }}
          />
          Cognitiva
        </span>
      </div>

      <div className="space-y-3">
        {filas.map((f) => (
          <div key={f.fase.key} className="min-w-0">
            <p className="mb-1 text-[12px] text-white/65">{f.fase.label}</p>

            {[
              { valor: f.carga, tope: topeF, color: ORO },
              { valor: f.cognitiva, tope: topeC, color: tinta(0.32) },
            ].map((barra, i) => (
              <div key={i} className="mt-1 flex items-center gap-2">
                <span className="h-2.5 min-w-0 flex-1">
                  <span
                    className="block h-2.5 rounded-[3px]"
                    style={{
                      width: `${(barra.valor / barra.tope) * 100}%`,
                      background: barra.color,
                    }}
                  />
                </span>

                <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-white/45">
                  {Math.round(barra.valor).toLocaleString("es-ES")}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LAS FRASES                                                         */
/* ------------------------------------------------------------------ */

function lecturaDelReparto(
  reparto: { etiqueta: string; valor: number }[],
  avisos: Aviso[],
) {
  const total = reparto.reduce((s, t) => s + t.valor, 0);

  if (total === 0) return "Sin minutos registrados.";

  const mayor = [...reparto].sort((a, b) => b.valor - a.valor)[0];

  const parte = (mayor.valor / total) * 100;

  const suAviso = avisos.find((a) => a.fase.label === mayor.etiqueta);

  const cola =
    suAviso?.rendimiento == null
      ? ""
      : suAviso.rendimiento >= 0
        ? ` Y es la fase donde mejor se está: ${suAviso.rendimiento.toFixed(0)} % por encima de la categoría.`
        : ` Y aun así queda ${Math.abs(suAviso.rendimiento).toFixed(0)} % por debajo de la categoría, que es donde hay que mirar.`;

  return `${parte.toFixed(0)} de cada 100 minutos de tarea van a ${mayor.etiqueta.toLowerCase()}.${cola}`;
}

/* ------------------------------------------------------------------ */
/*  EL TRABAJO INDIVIDUAL                                              */
/* ------------------------------------------------------------------ */

type FilaSeguimiento = { NOMBRE?: string; ID_JUGADOR?: string; FECHA?: string };

/** El nombre, sin acentos ni dobles espacios: la hoja los escribe a mano. */
const desnuda = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * ¿Se parecen estos dos nombres?
 *
 * Wyscout escribe «M. Rezola» y la hoja de seguimiento «Mikel Rezola». El
 * apellido es lo que manda: basta con que compartan una palabra de cinco
 * letras o más, que es lo que distingue a una persona de otra.
 */
function mismoJugador(deWyscout: string, deLaHoja: string) {
  const a = desnuda(deWyscout).split(" ").filter(Boolean);
  const b = desnuda(deLaHoja).split(" ").filter(Boolean);

  if (a.length === 0 || b.length === 0) return false;

  const largasA = a.filter((p) => p.length >= 5);
  const largasB = b.filter((p) => p.length >= 5);

  return largasA.some((p) => largasB.includes(p));
}

/**
 * LOS SEGUIMIENTOS CONTRA LO QUE PASA EN EL CAMPO.
 *
 * La otra mitad de la misma pregunta. De una fase de juego se puede decir «se
 * entrena mucho y no se ve»; de un jugador, «se le escriben ocho seguimientos
 * y no mejora», o al revés, «lleva mil minutos y nadie le ha anotado una
 * línea».
 *
 * La evolución se mide como en la ficha individual: **percentil contra su
 * categoría de cada año**, no el número suelto. Un jugador puede hacer menos
 * pases que el año pasado porque el equipo juega distinto; lo que no engaña es
 * si hace más o menos que sus iguales.
 */
function TrabajoIndividual({ jugadores }: { jugadores: FilaJugador[] }) {
  const [seguimientos, setSeguimientos] = useState<FilaSeguimiento[] | null>(null);

  useEffect(() => {
    let vivo = true;

    traeJson<unknown>("/api/rivals?action=seguimiento")
      .then((datos) => {
        if (vivo) {
          setSeguimientos(Array.isArray(datos) ? (datos as FilaSeguimiento[]) : []);
        }
      })
      .catch(() => {
        if (vivo) setSeguimientos([]);
      });

    return () => {
      vivo = false;
    };
  }, []);

  const filas = useMemo(() => {
    const nuestros = jugadores.filter(
      (j) => j.temporada === "actual" && esNuestro(j),
    );

    return nuestros
      .map((j) => {
        const suyos = (seguimientos ?? []).filter((s) =>
          mismoJugador(j.jugador, String(s.NOMBRE ?? "")),
        );

        const { antes, filas: evolucion, fiable } = evolucionDe(j, jugadores);

        /* El salto medio de percentil: si sube, ha mejorado respecto a sus
           iguales; si baja, ha perdido terreno aunque haga lo mismo. */
        const salto =
          fiable && evolucion.length
            ? evolucion.reduce((s, e) => s + e.salto, 0) / evolucion.length
            : null;

        return {
          jugador: j,
          seguimientos: suyos.length,
          tieneAnterior: Boolean(antes),
          fiable,
          salto,
        };
      })
      .sort((a, b) => b.jugador.minutos - a.jugador.minutos);
  }, [jugadores, seguimientos]);

  if (!seguimientos) {
    return (
      <div className="mt-5">
        <Panel
          title="El trabajo individual"
          subtitle="Seguimientos, minutos y evolución de cada jugador"
          icon={Users}
        >
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/40">
            <Loader2 size={16} className="animate-spin" />
            Leyendo la hoja de seguimiento…
          </div>
        </Panel>
      </div>
    );
  }

  if (filas.length === 0) return null;

  const tope = Math.max(...filas.map((f) => f.jugador.minutos), 1);

  const partidos = Math.max(...filas.map((f) => f.jugador.partidos), 1);

  /* Los tres casos que interesa que salten a la vista. */
  const sinSeguimiento = filas.filter(
    (f) => f.seguimientos === 0 && f.jugador.minutos >= partidos * 90 * 0.5,
  );

  const sinSubir = filas.filter(
    (f) => f.seguimientos >= 3 && f.salto !== null && f.salto < -3,
  );

  const subiendo = filas.filter(
    (f) => f.seguimientos >= 3 && f.salto !== null && f.salto > 3,
  );

  return (
    <div className="mt-5">
      <Panel
        title="El trabajo individual"
        subtitle="Seguimientos escritos, minutos jugados y evolución contra la categoría"
        icon={Users}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                <th className="pb-2 pr-3 font-medium">Jugador</th>
                <th className="pb-2 pr-3 font-medium">Minutos</th>
                <th className="pb-2 pr-3 text-right font-medium">Seguimientos</th>
                <th className="pb-2 text-right font-medium">Evolución</th>
              </tr>
            </thead>

            <tbody>
              {filas.map((f) => (
                <tr key={f.jugador.jugador} className="border-t border-white/[0.06]">
                  <td className="py-2 pr-3 text-white/80">{f.jugador.jugador}</td>

                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-28 shrink-0 overflow-hidden rounded-[3px] bg-white/[0.06]">
                        <span
                          className="block h-2.5 rounded-[3px]"
                          style={{
                            width: `${(f.jugador.minutos / tope) * 100}%`,
                            background: ORO,
                          }}
                        />
                      </span>

                      <span className="text-[11px] tabular-nums text-white/50">
                        {f.jugador.minutos}
                      </span>
                    </span>
                  </td>

                  <td
                    className="py-2 pr-3 text-right tabular-nums"
                    style={{ color: f.seguimientos === 0 ? PEOR : tinta(0.6) }}
                  >
                    {f.seguimientos}
                  </td>

                  <td className="py-2 text-right tabular-nums">
                    {f.salto === null ? (
                      <span className="text-white/25">
                        {f.tieneAnterior
                          ? "muestra corta el año pasado"
                          : "sin año anterior"}
                      </span>
                    ) : (
                      <span style={{ color: f.salto >= 0 ? MEJOR : PEOR }}>
                        {f.salto >= 0 ? "+" : ""}
                        {f.salto.toFixed(0)} de percentil
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Lectura>
          {lecturaDelTrabajo(
            filas.length,
            sinSeguimiento.map((f) => f.jugador.jugador),
            sinSubir.map((f) => f.jugador.jugador),
            subiendo.map((f) => f.jugador.jugador),
          )}
        </Lectura>

        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          La evolución es el salto medio de percentil contra su puesto en la
          categoría, del año pasado a éste: no mide que haga más cosas, mide que
          haga más que sus iguales. Los seguimientos se atan por apellido,
          porque Wyscout abrevia el nombre de pila y la hoja no.
        </p>
      </Panel>
    </div>
  );
}

function lecturaDelTrabajo(
  cuantos: number,
  sinSeguimiento: string[],
  sinSubir: string[],
  subiendo: string[],
) {
  const trozos: string[] = [];

  const lista = (nombres: string[]) => nombres.join(", ");

  if (sinSeguimiento.length) {
    trozos.push(
      sinSeguimiento.length === 1
        ? `${lista(sinSeguimiento)} está jugando y no tiene ningún seguimiento escrito: es un hueco de proceso, no de rendimiento.`
        : `${lista(sinSeguimiento)} están jugando y no tienen ningún seguimiento escrito: es un hueco de proceso, no de rendimiento.`,
    );
  }

  if (subiendo.length) {
    trozos.push(
      subiendo.length === 1
        ? `${lista(subiendo)} lleva tres o más seguimientos y ha subido de percentil respecto al año pasado: ahí el trabajo se está viendo.`
        : `${lista(subiendo)} llevan tres o más seguimientos y han subido de percentil respecto al año pasado: ahí el trabajo se está viendo.`,
    );
  }

  if (sinSubir.length) {
    trozos.push(
      sinSubir.length === 1
        ? `${lista(sinSubir)} se trabaja y aun así ha bajado respecto a sus iguales: conviene mirar si el contenido del seguimiento es el que toca.`
        : `${lista(sinSubir)} se trabajan y aun así han bajado respecto a sus iguales: conviene mirar si el contenido del seguimiento es el que toca.`,
    );
  }

  if (trozos.length === 0) {
    return `De ${cuantos} jugadores con minutos no salta ningún aviso: ni hay quien juegue sin seguimiento ni quien se trabaje y retroceda.`;
  }

  return trozos.join(" ");
}
