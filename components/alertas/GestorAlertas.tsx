"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Loader2, Plus, RotateCw, TriangleAlert } from "lucide-react";

import ConfirmDialog from "@/components/season/ConfirmDialog";
import { useAlertas } from "@/hooks/useAlertas";
import { nuevaAlerta, type Alerta } from "@/lib/alertas/modelo";
import DialogoAlerta from "./DialogoAlerta";
import {
  fechaLegible,
  proximoDesdeElPartido,
  saldriaSiSeReactiva,
  type PartidoParaAlerta,
} from "@/lib/alertas/modelo";
import { CLAVE_CALENDARIO } from "@/lib/castilla/calendario";
import ListaAlertas from "./ListaAlertas";

/**
 * Todo el manejo de tareas con alerta, sin decidir dónde se pinta.
 *
 * Lo usan tal cual el panel del botón flotante y la página del módulo, para
 * que las dos entradas se comporten igual y no haya dos copias de la misma
 * lógica separándose con el tiempo.
 */

export default function GestorAlertas() {
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

  const reactivarTodas = async () => {
    setOcupada("todas");
    for (const a of alertas.filter((x) => !x.activa)) {
      await guardar({ ...a, activa: true });
    }
    setOcupada(null);
  };

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

          <div className="min-w-0 text-xs leading-relaxed text-amber-200">
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

          <div className="min-w-0 text-xs leading-relaxed text-amber-200">
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

      {/* ---------------------- RESUMEN ------------------------ */}

      {/* Lo que dice la pantalla en cinco segundos. Sin alertas con fecha, no sale. */}
      {!cargando && !fallo && !resumen && alertas.length > 0 && (
        <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
          <p>
            <b className="font-semibold">
              {alertas.length === 1
                ? "La tarea está silenciada: no saldrá ningún correo."
                : `Las ${alertas.length} tareas están silenciadas: no saldrá ningún correo.`}
            </b>
            {primeraAlReactivar && (
              <>
                {" "}Si las reactivas, el primero saldría el {fechaLegible(primeraAlReactivar.cuando.toISOString())}.
              </>
            )}
          </p>

          <button
            type="button"
            onClick={() => void reactivarTodas()}
            disabled={ocupada !== null || comprobando}
            className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#C8A96B] px-4 py-2 text-[13px] font-semibold text-[#0B0F14] transition hover:brightness-110 disabled:opacity-40"
          >
            <BellRing className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">
              {alertas.length === 1 ? "Reactivar" : "Reactivar todas"}
            </span>
          </button>
        </div>
      )}

      {!cargando && resumen && (
        <p className="rounded-2xl bg-[#C8A96B]/10 px-4 py-3 text-xs leading-relaxed text-white/70">
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
        />
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
