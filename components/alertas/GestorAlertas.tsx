"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BellOff, BellRing, CalendarCheck, ChevronRight, Loader2, Plus, RotateCw, TriangleAlert } from "lucide-react";

import ConfirmDialog from "@/components/season/ConfirmDialog";
import { confirmar } from "@/lib/avisos";
import { useAlertas } from "@/hooks/useAlertas";
import { nuevaAlerta, type Alerta } from "@/lib/alertas/modelo";
import DialogoAlerta from "./DialogoAlerta";
import {
  fechaLegible,
  proximoDesdeElPartido,
  saldriaSiSeReactiva,
  tituloLegible,
  type ContactoAgenda,
  type PartidoParaAlerta,
} from "@/lib/alertas/modelo";
import { CLAVE_CALENDARIO, comoNuestro, type PartidoCastilla } from "@/lib/castilla/calendario";
import ListaAlertas, { cuandoRelativo, listaDestino, nombresDestino } from "./ListaAlertas";
import { aJornada, type FilaRival, type JornadaRival } from "@/lib/abp/jornada";
import { traeJson } from "@/lib/hojaCsv";

/**
 * Todo el manejo de tareas con alerta, sin decidir dónde se pinta.
 *
 * Lo usan tal cual el panel del botón flotante y la página del módulo, para
 * que las dos entradas se comporten igual y no haya dos copias de la misma
 * lógica separándose con el tiempo.
 */

/**
 * `pantalla`: la página /alertas (no el panel del botón flotante). Sólo ahí
 * salen la línea de hoy y los enlaces al plan de partido con su rival.
 */
export default function GestorAlertas({ pantalla = false }: { pantalla?: boolean } = {}) {
  const {
    alertas,
    agenda,
    cargando,
    comprobando,
    motorCaido,
    fallo,
    reintentar,
    disparador,
    guardar,
    borrar,
    enviarAhora,
  } = useAlertas();

  /*
  | EL CALENDARIO, PARA LAS ALERTAS QUE VAN A TANTOS DÍAS DEL PARTIDO.
  |
  | La hoja no sabe cuándo se juega: el calendario vive en Supabase y lo
  | refresca el ordenador del club. Así que la fecha de esas alertas la calcula
  | la app —al guardarlas y cada vez que se abre esta pantalla— y la escribe en
  | la hoja como una fecha normal. El motor del Apps Script no se entera de
  | nada: manda lo que le digan y cuándo le digan.
  */
  const [partidos, setPartidos] = useState<PartidoParaAlerta[]>([]);

  /*
  | LO QUE IMPIDE UN BUCLE DE ESCRITURAS, Y NO ES PARANOIA.
  |
  | Guardar recarga la lista (`useAlertas.guardar` llama a `recargar`), así que
  | cada escritura devuelve un `alertas` nuevo y vuelve a disparar este efecto.
  | Para que pare hace falta que lo guardado vuelva IGUAL, y eso no está
  | garantizado: la fecha pasa por la hoja, que reinterpreta los valores
  | —Google convierte lo que le parece una fecha en un Date— y el Apps Script
  | la reescribe con `toISOString()` en SU huso. Basta con que vuelva
  | desplazada un segundo para que esto escribiera sin parar contra la hoja.
  |
  | Dos cinturones, porque el precio de equivocarse aquí es machacar la hoja:
  | se compara al minuto, no carácter a carácter, y cada alerta se reprograma
  | **una sola vez por sesión**.
  */
  const yaPuestas = useRef<Set<string>>(new Set());

  /* Las jornadas de la hoja RIVALES, para abrir el plan de partido con ?rival= (20/11/2026, ronda 7). Sólo en la pantalla. */
  const [jornadas, setJornadas] = useState<JornadaRival[]>([]);

  useEffect(() => {
    if (!pantalla) return;

    let vivo = true;

    traeJson<unknown>("/api/rivals?action=rivales")
      .then((data) => {
        if (!vivo || !Array.isArray(data)) return;
        setJornadas((data as FilaRival[]).filter((fila) => fila && typeof fila === "object").map(aJornada));
      })
      .catch(() => {
        /* Sin la hoja, el grupo sólo enlaza la plantilla del rival. */
      });

    return () => {
      vivo = false;
    };
  }, [pantalla]);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/docs?key=" + encodeURIComponent(CLAVE_CALENDARIO), {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((datos) => {
        if (cancelado) return;

        const lista = datos?.data?.partidos;

        setPartidos(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        if (!cancelado) setPartidos([]);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  /*
  | Y se reprograman solas al abrir la pantalla.
  |
  | El motor de la hoja no sabe rehacer la cuenta de una alerta «a X días del
  | partido» —no tiene el calendario—, así que después de mandarla la deja sin
  | fecha, como una de una sola vez. Quien la vuelve a poner en hora es esto:
  | se repasan al abrir, y la que esté sin fecha o con una ya pasada se apunta
  | al partido siguiente.
  |
  | Va con un `setTimeout` de cero porque guardar dispara estados del hook y
  | hacerlo en el cuerpo del efecto encadena renders (lo mismo que la tira de
  | alertas de la portada).
  */
  useEffect(() => {
    if (cargando || comprobando || partidos.length === 0) return;

    /*
    | Se recalculan TODAS, no sólo las vencidas.
    |
    | Antes sólo se tocaban las que ya habían pasado o no tenían fecha, y eso
    | dejaba fuera justo el caso que da sentido a esta periodicidad: que el
    | partido se mueva. Una jornada que pasa del domingo al miércoles deja un
    | MD-2 apuntando al viernes de antes —cinco días pronto—, y una adelantada
    | lo deja sonando DESPUÉS del partido. El formulario promete que «se mueve
    | solo», así que tiene que moverse.
    */
    const desfasadas = alertas.filter((alerta) => {
      if (!alerta.activa || alerta.repeticion !== "partido") return false;

      /* Una sola vez por alerta y por sesión: ver `yaPuestas`. */
      if (yaPuestas.current.has(alerta.id)) return false;

      const puesta = conFechaDePartido(alerta, partidos);

      return Boolean(puesta.proximoEnvio) && !mismoMinuto(puesta.proximoEnvio, alerta.proximoEnvio);
    });

    if (desfasadas.length === 0) return;

    const id = setTimeout(() => {
      for (const alerta of desfasadas) {
        const puesta = conFechaDePartido(alerta, partidos);

        if (!puesta.proximoEnvio) continue;

        yaPuestas.current.add(alerta.id);

        void guardar(puesta);
      }
    }, 0);

    return () => clearTimeout(id);
  }, [alertas, cargando, comprobando, guardar, partidos]);

  const [editando, setEditando] = useState<Alerta | null>(null);
  const [esNueva, setEsNueva] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const abrirNueva = () => {
    setEditando(nuevaAlerta());
    setEsNueva(true);
  };

  const abrirExistente = (alerta: Alerta) => {
    setEditando(alerta);
    setEsNueva(false);
  };

  const alternarActiva = async (alerta: Alerta) => {
    /* 17/11/2026 (ronda 20, análisis y marketing): reactivar una pregunta antes, con la tarea y a quién avisa (manda correos de verdad). */
    if (!alerta.activa) {
      const sigue = await confirmar({
        titulo: `¿Reactivar «${tituloLegible(alerta.titulo.replace(/^RMCF\s*[-–—·:]\s*/i, ""))}»?`,
        texto: `Volverá a mandar el correo a ${nombresDestino(alerta.destinatarios, agenda, true)}.`,
        aceptar: "Reactivar",
      });
      if (!sigue) return;
    }
    setOcupada(alerta.id);
    await guardar({ ...alerta, activa: !alerta.activa });
    setOcupada(null);
  };

  /*
  | «Enviar ahora» desde la lista pregunta antes (19/10/2026): manda un correo
  | de verdad a todos los destinatarios, y en el móvil está a un dedo de
  | «Editar». Un correo mandado no se puede deshacer.
  */
  const [aEnviar, setAEnviar] = useState<Alerta | null>(null);

  const enviarSuelta = async (alerta: Alerta) => {
    setOcupada(alerta.id);
    await enviarAhora(alerta.id);
    setOcupada(null);
    setAEnviar(null);
  };

  /* La confirmación vive en la propia tarjeta (ListaAlertas): aquí ya llega
     confirmada. */
  const borrarConfirmada = async (alerta: Alerta) => {
    setOcupada(alerta.id);
    await borrar(alerta.id);
    setOcupada(null);
  };

  /* El reloj se apunta en un efecto: mirarlo en el render es impuro. */
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0);

    return () => clearTimeout(id);
  }, []);

  /* Sólo las que volverían a salir: reactivar una caducada no hace nada (30/10/2026). */
  const reactivarTodas = async () => {
    setOcupada("todas");
    for (const a of alertas.filter((x) => !x.activa && reactivable(x) && !apartadas.has(x.id))) {
      await guardar({ ...a, activa: true });
    }
    setOcupada(null);
    setConfirmaReactivar(false);
    setApartadas(new Set());
  };

  /* 20/11/2026 (ronda 7, análisis): «Revisar y reactivar» deja elegir cuáles; las desmarcadas se quedan silenciadas. */
  const [apartadas, setApartadas] = useState<Set<string>>(new Set());

  /* «Reactivar todas» pregunta antes, con qué tareas y a quién (30/10/2026):
     de un toque volvían a salir correos a varias personas. */
  const [confirmaReactivar, setConfirmaReactivar] = useState(false);

  const todasSilenciadas = !cargando && !fallo && alertas.length > 0 && !alertas.some((a) => a.activa);

  const resumen = (() => {
    const vivas = alertas.filter((a) => a.activa);

    if (vivas.length === 0) return null;

    const proxima =
      vivas
        .filter((a) => {
          const t = new Date(a.proximoEnvio).getTime();

          return Number.isFinite(t) && ahora > 0 && t >= ahora;
        })
        .sort((a, b) => a.proximoEnvio.localeCompare(b.proximoEnvio))[0] ?? null;

    return { activas: vivas.length, proxima };
  })();

  /*
  | Cuántas se pueden reactivar y cuántas están caducadas (30/10/2026): el
  | aviso decía «Las 4 tareas están silenciadas» y la lista enseñaba 3
  | silenciadas y 1 caducada. La regla es la de la lista (`ListaAlertas`).
  */
  const reactivable = (a: Alerta) => {
    if (ahora === 0) return true;

    if (saldriaSiSeReactiva(a, partidos, new Date(ahora))) return true;

    const t = new Date(a.proximoEnvio).getTime();

    return Number.isFinite(t) && t > ahora;
  };
  const nSilenciadas = alertas.filter((a) => !a.activa && reactivable(a)).length;
  /* 17/11/2026 (ronda 20, fútbol): las caducadas se cuentan en el aviso de arriba, que al pie no se veían. */
  const nCaducadas = ahora > 0 ? alertas.filter((a) => !a.activa && !reactivable(a)).length : 0;

  /* A cuántas personas distintas avisarían las que se pueden reactivar. */
  const personasAlReactivar = new Set(
    alertas
      .filter((a) => !a.activa && reactivable(a))
      .flatMap((a) => a.destinatarios.map((d) => d.trim().toLowerCase()).filter(Boolean)),
  ).size;

  /* Si todas están silenciadas: la que saldría antes al reactivarlas. */
  const primeraAlReactivar = (() => {
    if (ahora === 0) return null;

    const salidas = alertas
      .map((a) => ({ a, s: saldriaSiSeReactiva(a, partidos, new Date(ahora)) }))
      .filter((x): x is { a: Alerta; s: { cuando: Date; dias: number } } => Boolean(x.s))
      .sort((x, y) => x.s.cuando.getTime() - y.s.cuando.getTime());

    return salidas[0]
      ? { titulo: salidas[0].a.titulo.trim(), cuando: salidas[0].s.cuando }
      : null;
  })();

  return (
    <div className="space-y-4">
      {/* --------------------- MOTOR CAÍDO --------------------- */}

      {motorCaido && (
        <div className="flex items-start gap-3 rounded-3xl bg-amber-500/10 px-4 py-3.5">
          <TriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
            aria-hidden
          />

          <div className="min-w-0 text-[13px] leading-relaxed text-amber-200">
            <p className="font-semibold">El motor de envío no responde.</p>

            <p className="mt-1 text-amber-200/80">
              Puedes seguir usando la pantalla, pero no saldrá ningún correo
              hasta instalar el Apps Script de las alertas en la hoja. Los pasos
              están en <code>scripts/apps-script/README.md</code>.
            </p>

            <p className="mt-1.5 text-amber-300/60">{motorCaido}</p>
          </div>
        </div>
      )}

      {/* -------------------- SIN DISPARADOR -------------------- */}

      {/*
      | El fallo silencioso del montaje.
      |
      | Con la hoja contestando, todo aparenta ir bien: se guarda, se lista y
      | «enviar ahora» manda el correo, porque eso lo dispara la propia
      | petición. Lo que no existe es quien repase el calendario, así que
      | ninguna alarma programada suena — y hasta ahora no había forma de
      | notarlo desde la pantalla, sólo esperar un aviso que no llegaba.
      */}
      {!motorCaido && disparador === false && (
        <div className="flex items-start gap-3 rounded-3xl bg-amber-500/10 px-4 py-3.5">
          <TriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
            aria-hidden
          />

          <div className="min-w-0 text-[13px] leading-relaxed text-amber-200">
            <p className="font-semibold">
              Nadie está repasando el calendario.
            </p>

            <p className="mt-1 text-amber-200/80">
              La hoja guarda las tareas y «Enviar ahora» funciona, pero{" "}
              <b>las alarmas programadas no van a sonar</b>: falta el disparador
              horario. Se pone en un minuto desde el editor de la hoja
              —Extensiones ▸ Apps Script—, eligiendo la función{" "}
              <code>instalarDisparadorDeAlertas</code> y pulsando Ejecutar.
              El paso 3 de <code>scripts/apps-script/README.md</code> lo cuenta
              entero.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------ HOY ------------------------ */}

      {/*
      | 20/11/2026 (ronda 7, análisis y fútbol): el día de partido la pantalla
      | saltaba a la semana siguiente sin decir nada del de hoy. Una línea con
      | hoy —y su partido si lo hay— y cuántas alertas salen hoy, con enlace a
      | «Tu día» en la portada.
      */}
      {pantalla && ahora > 0 && !cargando && !fallo
        ? (() => {
            const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const hoy = new Date(ahora);
            const deHoy = partidos.find((p) => String(p.cuando).slice(0, 10) === clave(hoy)) as (PartidoParaAlerta & Partial<PartidoCastilla>) | undefined;
            const nuestro = deHoy && deHoy.local && deHoy.visitante ? comoNuestro(deHoy as PartidoCastilla) : null;
            const salenHoy = alertas.filter((a) => a.activa && a.proximoEnvio && !Number.isNaN(new Date(a.proximoEnvio).getTime()) && clave(new Date(a.proximoEnvio)) === clave(hoy)).length;
            const fecha = hoy.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "");

            return (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13.5px] leading-snug text-white/75">
                <CalendarCheck className="h-4 w-4 shrink-0 text-[#C8A96B]" aria-hidden />
                <span className="min-w-0">
                  <b className="font-semibold text-white/90">
                    Hoy, {fecha}
                    {nuestro ? ` · ${nuestro.jornada ? `J${nuestro.jornada} ` : ""}${nuestro.lado === "casa" ? "vs" : "en"} ${nuestro.rival}` : ""}
                  </b>
                  {": "}
                  {salenHoy === 0 ? "ninguna alerta sale hoy" : salenHoy === 1 ? "sale 1 alerta hoy" : `salen ${salenHoy} alertas hoy`}
                </span>
                <Link href="/" className="inline-flex min-h-9 items-center gap-1 font-semibold text-[#C8A96B] underline-offset-4 hover:underline">
                  Tu día, en la portada
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </p>
            );
          })()
        : null}

      {/* ---------------------- RESUMEN ------------------------ */}

      {/* Lo que dice la pantalla en cinco segundos. Sin alertas con fecha, no sale. */}
      {!cargando && !fallo && !resumen && alertas.length > 0 && (
        /*
        | 10/11/2026 (análisis y marketing): un panel de estado con una frase y
        | una sola acción principal. El recuento por tipo ya lo dan los
        | títulos de «Silenciadas (3)» y «Caducadas (1)», debajo.
        */
        /* 17/11/2026 (fútbol): es lo único urgente de la pantalla; con borde, icono y titular, no el mismo peso que el resto. */
        /*
        | 20/11/2026 (ronda 4, los tres jueces): un solo estado, en neutro y
        | sin el titular de alarma («Ahora no sale ningún correo»): cuántas
        | están silenciadas, cuántos correos saldrían a cuántas personas y
        | cuándo el primero. Sin repetir el nombre de la primera tarea, que ya
        | está en su tarjeta.
        */
        <div className="rounded-2xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-3.5 text-[14px] leading-relaxed text-white/80">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px] font-bold text-white/90">
            <BellOff className="h-5 w-5 shrink-0 text-[#C8A96B]" aria-hidden />
            {/* 20/11/2026 (ronda 5, análisis): el estado claro, arriba: con todo apagado no sale ningún correo. */}
            No sale ningún correo
            <span className="font-semibold text-white/80">
              {" · "}
              {nSilenciadas > 0
                ? `${nSilenciadas} ${nSilenciadas === 1 ? "silenciada" : "silenciadas"}`
                : nCaducadas === 1
                  ? "1 caducada"
                  : `${nCaducadas} caducadas`}
            </span>
          </p>
          <p className="mt-1">
            {nSilenciadas > 0 ? (
              <>
                {primeraAlReactivar ? (
                  <>
                    La primera saldría{" "}
                    <b className="font-semibold text-white/90">{cuandoRelativo(primeraAlReactivar.cuando, ahora)}</b>.{" "}
                  </>
                ) : null}
                Si las reactivas saldrían{" "}
                <b className="font-semibold text-white/90">
                  {nSilenciadas === 1 ? "1 correo" : `${nSilenciadas} correos`}
                </b>{" "}
                a{" "}
                <b className="font-semibold text-white/90">
                  {personasAlReactivar === 1 ? "1 persona" : `${personasAlReactivar} personas`}
                </b>
                .
              </>
            ) : (
              "Necesitan fecha nueva para volver a salir."
            )}
            {nCaducadas > 0 && nSilenciadas > 0 ? (
              <span>{nCaducadas === 1 ? " 1 caducada, plegada al pie." : ` ${nCaducadas} caducadas, plegadas al pie.`}</span>
            ) : null}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          {nSilenciadas > 0 ? (
          <button
            type="button"
            onClick={() => setConfirmaReactivar(true)}
            disabled={ocupada !== null || comprobando}
            className="inline-flex max-w-full items-center gap-2 rounded-2xl bg-[#C8A96B] px-4 py-2 text-left text-[13.5px] font-semibold leading-tight text-[#0B0F14] transition hover:brightness-110 disabled:opacity-40"
          >
            <BellRing className="h-4 w-4 shrink-0" aria-hidden />
            {/*
              20/11/2026 (ronda 5, marketing): a quién llega, en el propio botón.
              20/11/2026 (ronda 7, fútbol y análisis): en dos renglones para que
              no se corte a 390 px —«Revisar y reactivar las 3» y, debajo, los
              correos y las personas— y abre la lista para elegir cuáles.
            */}
            <span className="min-w-0">
              <span className="block">{nSilenciadas === 1 ? "Revisar y reactivar la silenciada" : `Revisar y reactivar las ${nSilenciadas}`}</span>
              <span className="block text-[12px] font-medium opacity-80">
                {`${nSilenciadas === 1 ? "1 correo" : `${nSilenciadas} correos`} a ${personasAlReactivar === 1 ? "1 persona" : `${personasAlReactivar} personas`}`}
              </span>
            </span>
          </button>
          ) : null}
          {/* 20/11/2026 (ronda 5, análisis): un solo botón principal; «Nueva tarea con alerta» baja al pie de la lista. */}
          </div>
        </div>
      )}

      {!cargando && resumen && (
        <p className="rounded-2xl bg-[#C8A96B]/10 px-4 py-3 text-[13px] leading-relaxed text-white/70">
          <b className="font-semibold text-[#C8A96B]">
            {resumen.activas} {resumen.activas === 1 ? "alerta activa" : "alertas activas"}
          </b>
          {resumen.proxima && (
            <>
              {" · "}próximo aviso: {resumen.proxima.titulo},{" "}
              {fechaLegible(resumen.proxima.proximoEnvio)}
            </>
          )}
        </p>
      )}

      {/* ----------------------- NUEVA ------------------------- */}

      {/* Con el panel de estado a la vista, «Nueva tarea» va dentro de él. */}
      {!(!cargando && !fallo && !resumen && alertas.length > 0) && (
      <button
        type="button"
        onClick={abrirNueva}
        className={
          /* 29/10/2026: con todo silenciado el botón principal es «Reactivar todas»; el de nueva tarea baja de jerarquía. */
          todasSilenciadas
            ? "flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white @3xl:inline-flex @3xl:w-auto"
            : "flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C8A96B] px-4 py-3 text-sm font-semibold text-[#0B0F14] transition hover:brightness-110 @3xl:inline-flex @3xl:w-auto"
        }
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nueva tarea con alerta
      </button>
      )}

      {/* ----------------------- LISTA ------------------------- */}

      {comprobando && (
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-white/50"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Esto es lo último que se vio. Comprobando con la hoja…
        </p>
      )}

      {cargando ? (
        <div
          role="status"
          aria-label="Cargando las tareas"
          className="space-y-3"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
            />
          ))}

          <p className="text-center text-xs text-white/50">
            Pidiendo las tareas a la hoja. Si tarda, podrás reintentar.
          </p>
        </div>
      ) : fallo ? (
        <div className="rounded-3xl border border-dashed border-white/10 px-6 py-8 text-center">
          <p className="text-sm text-white/60">
            {fallo} Las tareas ya guardadas siguen en la hoja.
          </p>

          <button
            type="button"
            onClick={reintentar}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/50 px-4 py-2 text-sm font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            Reintentar
          </button>
        </div>
      ) : (
        <>
        <SemanaDeAlertas alertas={alertas} partidos={partidos} ahora={ahora} agenda={agenda} />
        <ListaAlertas
          alertas={alertas}
          comprobando={comprobando}
          onEditar={abrirExistente}
          onEnviarAhora={setAEnviar}
          onAlternarActiva={(alerta) => void alternarActiva(alerta)}
          onBorrar={(alerta) => void borrarConfirmada(alerta)}
          ocupada={ocupada}
          partidos={partidos}
          agenda={agenda}
          jornadas={jornadas}
        />
        {/* Con el panel de estado arriba, la nueva tarea va aquí, como acción secundaria. */}
        {!resumen && alertas.length > 0 ? (
          <button
            type="button"
            onClick={abrirNueva}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-[13px] font-medium text-white/75 underline decoration-white/30 underline-offset-4 transition hover:text-white"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nueva tarea con alerta
          </button>
        ) : null}
        </>
      )}

      {/* ---------------------- DIÁLOGOS ----------------------- */}

      {editando && (
        <DialogoAlerta
          alerta={editando}
          agenda={agenda}
          esNueva={esNueva}
          partidos={partidos}
          onGuardar={(alerta) => guardar(conFechaDePartido(alerta, partidos))}
          onEnviarAhora={(alerta) => enviarAhora(alerta.id)}
          onCerrar={() => setEditando(null)}
        />
      )}

      {confirmaReactivar && (
        <div className="modal-veil fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Revisar y reactivar" onClick={() => setConfirmaReactivar(false)}>
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#11161D] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[16px] font-semibold text-white">Elige cuáles reactivar</p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/60">Las que dejes sin marcar siguen silenciadas. Cada una vuelve a mandar su correo.</p>
            <ul className="mt-3 space-y-2">
              {alertas
                .filter((a) => !a.activa && reactivable(a))
                .map((a) => {
                  const sale = ahora > 0 ? saldriaSiSeReactiva(a, partidos, new Date(ahora)) : null;
                  const marcada = !apartadas.has(a.id);

                  return (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 px-3 py-2.5 text-[13px] leading-snug text-white/75 hover:bg-white/[0.04]">
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() =>
                            setApartadas((s) => {
                              const n = new Set(s);
                              if (n.has(a.id)) n.delete(a.id);
                              else n.add(a.id);
                              return n;
                            })
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#C8A96B]"
                        />
                        <span className="min-w-0">
                          <b className="block font-semibold text-white/90">{tituloLegible(a.titulo.replace(/^RMCF\s*[-–—·:]\s*/i, ""))}</b>
                          {sale ? <span className="block">Sale <b className="font-semibold text-white/85">{cuandoRelativo(sale.cuando, ahora)}</b></span> : null}
                          <span className="block">A {nombresDestino(a.destinatarios, agenda, true)}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => setConfirmaReactivar(false)} className="min-h-10 rounded-full px-4 text-[13px] font-medium text-white/70 hover:bg-white/[0.06] hover:text-white">
                Cancelar
              </button>
              {(() => {
                const n = alertas.filter((a) => !a.activa && reactivable(a) && !apartadas.has(a.id)).length;

                return (
                  <button
                    type="button"
                    onClick={() => void reactivarTodas()}
                    disabled={n === 0 || ocupada === "todas"}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#C8A96B] px-4 text-[13px] font-semibold text-[#0B0F14] transition hover:brightness-110 disabled:opacity-40"
                  >
                    {ocupada === "todas" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <BellRing className="h-4 w-4" aria-hidden />}
                    {ocupada === "todas" ? "Reactivando…" : n === 1 ? "Reactivar 1" : `Reactivar ${n}`}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(aEnviar)}
        title="Enviar el aviso ahora"
        description={
          aEnviar
            ? `«${aEnviar.titulo}» sale ya por correo a ${aEnviar.destinatarios.length} ${
                aEnviar.destinatarios.length === 1 ? "persona" : "personas"
              }.`
            : undefined
        }
        confirmLabel="Enviar"
        loadingLabel="Enviando…"
        loading={Boolean(aEnviar && ocupada === aEnviar.id)}
        onConfirm={() => aEnviar && void enviarSuelta(aEnviar)}
        onCancel={() => setAEnviar(null)}
      />
    </div>
  );
}

/** ¿Son la misma hora, al minuto? Lo que vuelve de la hoja puede venir con
 *  otros segundos o con el huso del script, y eso no es un cambio. */
function mismoMinuto(a: string, b: string) {
  const uno = new Date(a).getTime();
  const otro = new Date(b).getTime();

  if (!Number.isFinite(uno) || !Number.isFinite(otro)) return false;

  return Math.abs(uno - otro) < 60_000;
}

/**
 * Pone la fecha del próximo aviso cuando la alerta va a X días del partido.
 *
 * Se hace al guardar y no al vencer porque el motor de la hoja no tiene el
 * calendario: para él ésta es una alerta con una fecha y ya está. Lo que la
 * hace seguir al partido es que la app la recalcula cada vez que se abre esta
 * pantalla, que es a diario.
 *
 * Si no hay partido por delante se deja sin fecha: una alerta sin `proximoEnvio`
 * no se manda, que es mejor que mandarla en una fecha inventada.
 */
function conFechaDePartido(
  alerta: Alerta,
  partidos: PartidoParaAlerta[],
): Alerta {
  if (alerta.repeticion !== "partido") return alerta;

  /*
  | Sin calendario, no se toca la fecha.
  |
  | El calendario llega por su propia petición y tarda un momento; si alguien
  | guardaba en ese hueco, `proximoDesdeElPartido` no encontraba ningún partido
  | y la alerta se escribía con `proximoEnvio` vacío. El formulario ya la había
  | dado por buena porque TENÍA fecha, y el motor no manda las que no la
  | tienen: quedaba guardada y no sonaba nunca.
  */
  if (partidos.length === 0) return alerta;

  /* La hora que el usuario dejó puesta arriba, que es la que quiere. */
  const previa = new Date(alerta.proximoEnvio);

  const hora = Number.isNaN(previa.getTime())
    ? { horas: 9, minutos: 0 }
    : { horas: previa.getHours(), minutos: previa.getMinutes() };

  const cuando = proximoDesdeElPartido(
    partidos,
    alerta.diasAntesDelPartido ?? 2,
    hora,
    new Date(),
  );

  return { ...alerta, proximoEnvio: cuando ? cuando.toISOString() : "" };
}

/**
 * LA SEMANA DE LAS ALERTAS (17/11/2026, ronda 20; rehecha el 20/11/2026,
 * ronda 4, los tres jueces): una línea de tiempo con SÓLO los días que tienen
 * alguna tarea atada al partido —antes eran siete columnas y seis vacías— y
 * el partido al final. Cada pastilla lleva la hora a la que sale y abre su
 * tarjeta. La silenciada, con borde discontinuo y la campana tachada. Sale
 * también en el móvil (antes se escondía por debajo de 3xl).
 */
function SemanaDeAlertas({
  alertas,
  partidos,
  ahora,
  agenda = [],
}: {
  alertas: Alerta[];
  partidos: PartidoParaAlerta[];
  ahora: number;
  agenda?: ContactoAgenda[];
}) {
  const delPartido = alertas.filter((a) => a.repeticion === "partido");

  if (!delPartido.length) return null;

  const nombre = (a: Alerta) => tituloLegible(a.titulo.replace(/^RMCF\s*[-–—·:]\s*/i, ""));
  const diasDe = (a: Alerta) => Math.max(0, Math.round(a.diasAntesDelPartido ?? 2));

  /* Cuándo sale: la viva, su fecha; la silenciada, la que tendría al reactivarla. */
  const salida = (a: Alerta): Date | null => {
    if (a.activa) {
      const d = new Date(a.proximoEnvio);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return ahora > 0 ? saldriaSiSeReactiva(a, partidos, new Date(ahora))?.cuando ?? null : null;
  };
  const hora = (d: Date | null) => (d ? d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "");
  const dia = (d: Date | null) =>
    d ? d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "") : "";

  /*
  | 20/11/2026 (ronda 5, análisis y marketing): los siete días, de MD-6 al
  | partido, como el calendario de la portada, cada aviso en su día; y el
  | rótulo dice de qué partido es esa semana («J14 vs Rayo Majadahonda»), que
  | no tiene por qué ser el de hoy. En el móvil sólo salen los días con aviso
  | y el partido.
  */
  const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const primera = delPartido
    .map((a) => ({ a, s: salida(a) }))
    .filter((x): x is { a: Alerta; s: Date } => x.s !== null)
    .sort((x, y) => x.s.getTime() - y.s.getTime())[0];
  const diaPartido = (() => {
    if (!primera) return null;
    const d = new Date(primera.s.getTime());
    d.setDate(d.getDate() + diasDe(primera.a));
    d.setHours(12, 0, 0, 0);
    return d;
  })();
  const partido = diaPartido
    ? (partidos.find((p) => String(p.cuando).slice(0, 10) === clave(diaPartido)) as (PartidoParaAlerta & Partial<PartidoCastilla>) | undefined)
    : undefined;
  const nuestro = partido && partido.local && partido.visitante ? comoNuestro(partido as PartidoCastilla) : null;
  const rotulo = nuestro
    ? `${nuestro.jornada ? `J${nuestro.jornada} ` : ""}${nuestro.lado === "casa" ? "vs" : "en"} ${nuestro.rival}${diaPartido ? ` (${dia(diaPartido)})` : ""}`
    : "";

  const maxDias = Math.max(6, ...delPartido.map(diasDe));
  const semana = Array.from({ length: maxDias + 1 }, (_, i) => maxDias - i);
  const fechaDe = (md: number) => {
    if (!diaPartido) return null;
    const d = new Date(diaPartido.getTime());
    d.setDate(d.getDate() - md);
    return d;
  };

  /* Lleva a la tarjeta, abriendo su grupo plegado si hace falta. */
  const abrir = (a: Alerta) => {
    const el = document.getElementById(`alerta-${a.id}`);
    if (!el) return;
    const grupo = el.closest("details");
    if (grupo && !grupo.open) grupo.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section aria-label="Las tareas atadas al partido, día a día">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60">
        {rotulo ? (
          <>
            {/* 20/11/2026 (ronda 7, análisis): «Semana del siguiente partido» y la fecha de hoy, para que se vea que la de hoy ya no es esta. */}
            Semana del siguiente partido · <span className="normal-case tracking-normal text-white/85">{rotulo}</span>
            {ahora > 0 ? (
              <span className="normal-case tracking-normal text-white/60">
                {" · hoy "}
                {new Date(ahora).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "")}
              </span>
            ) : null}
          </>
        ) : (
          "La semana del partido · cuándo sale cada una"
        )}
      </p>
      {/* 20/11/2026 (ronda 7, análisis y marketing): los días con avisos, el doble de anchos (las horas se partían, «06:1 / 5»). */}
      <ol
        className="grid grid-cols-1 gap-1.5 @3xl:[grid-template-columns:var(--columnas)]"
        style={{ "--columnas": semana.map((d) => (delPartido.some((a) => diasDe(a) === d) ? "minmax(0,2.4fr)" : "minmax(0,1fr)")).join(" ") } as React.CSSProperties}
      >
        {semana.map((d) => {
          const del = delPartido
            .filter((a) => diasDe(a) === d)
            .sort((x, y) => (salida(x)?.getTime() ?? Infinity) - (salida(y)?.getTime() ?? Infinity));
          const fecha = dia(fechaDe(d) ?? (del[0] ? salida(del[0]) : null));
          const esPartido = d === 0;

          return (
            <li
              key={d}
              className={`min-w-0 rounded-2xl border p-2.5 ${
                esPartido ? "border-[#C8A96B]/50 bg-[#C8A96B]/10" : del.length ? "border-white/15 bg-white/[0.04]" : "hidden border-white/[0.06] @3xl:block"
              }`}
            >
              <p className={`text-[12px] font-bold uppercase tracking-[0.08em] ${esPartido ? "text-[#C8A96B]" : del.length ? "text-white/75" : "text-white/50"}`}>
                {esPartido ? "MD" : `MD-${d}`}
                {fecha ? <span className="ml-1.5 font-semibold normal-case tracking-normal text-white/60">{fecha}</span> : null}
              </p>
              {esPartido && nuestro ? (
                <p className="mt-1 text-[12.5px] font-semibold leading-tight text-white/85">{`${nuestro.lado === "casa" ? "vs" : "en"} ${nuestro.rival}`}</p>
              ) : null}
              {del.length ? (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {del.map((a) => (
                    <li key={a.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => abrir(a)}
                        title={a.activa ? "Va a salir · abrir su tarjeta" : "Silenciada · abrir su tarjeta"}
                        className={`flex min-h-9 w-full min-w-0 flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-semibold leading-tight transition ${
                          a.activa
                            ? "bg-[#C8A96B] text-[#0B0F14] hover:brightness-110"
                            : "border border-dashed border-white/30 text-white/70 hover:border-white/50 hover:text-white/85"
                        }`}
                      >
                        {/* La hora, entera y en negrita, en su renglón; el título debajo; y a quién llega, con sus iniciales. */}
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          {a.activa ? <BellRing className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <BellOff className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                          {hora(salida(a)) ? <b className="font-bold tabular-nums">{hora(salida(a))}</b> : null}
                        </span>
                        <span className="min-w-0 [overflow-wrap:anywhere]">{nombre(a)}</span>
                        {(() => {
                          const d = listaDestino(a.destinatarios, agenda);
                          const quienes = [...d.nombres.map((n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")), ...(d.externos ? [`+${d.externos}`] : [])];

                          return quienes.length ? (
                            <span className="mt-0.5 flex flex-wrap gap-1" aria-label={`A ${[...d.nombres, d.externo].filter(Boolean).join(", ")}`}>
                              {quienes.map((q, i) => (
                                <span key={i} className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-current px-1 text-[10.5px] font-bold opacity-80" title={d.nombres[i] ?? d.externo}>
                                  {q}
                                </span>
                              ))}
                            </span>
                          ) : null;
                        })()}
                        {a.activa ? null : <span className="sr-only">(silenciada)</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
