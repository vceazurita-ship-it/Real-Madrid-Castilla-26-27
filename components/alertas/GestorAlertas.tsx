"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, TriangleAlert } from "lucide-react";

import ConfirmDialog from "@/components/season/ConfirmDialog";
import { useAlertas } from "@/hooks/useAlertas";
import { nuevaAlerta, type Alerta } from "@/lib/alertas/modelo";
import DialogoAlerta from "./DialogoAlerta";
import {
  proximoDesdeElPartido,
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
    motorCaido,
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
    if (cargando || partidos.length === 0) return;

    const ahora = Date.now();

    const desfasadas = alertas.filter((alerta) => {
      if (!alerta.activa || alerta.repeticion !== "partido") return false;

      const cuando = new Date(alerta.proximoEnvio).getTime();

      return !Number.isFinite(cuando) || cuando <= ahora;
    });

    if (desfasadas.length === 0) return;

    const id = setTimeout(() => {
      for (const alerta of desfasadas) {
        const puesta = conFechaDePartido(alerta, partidos);

        /* Si no hay partido por delante no se toca: se quedaría igual. */
        if (puesta.proximoEnvio && puesta.proximoEnvio !== alerta.proximoEnvio) {
          void guardar(puesta);
        }
      }
    }, 0);

    return () => clearTimeout(id);
  }, [alertas, cargando, guardar, partidos]);

  const [editando, setEditando] = useState<Alerta | null>(null);
  const [esNueva, setEsNueva] = useState(false);
  const [aBorrar, setABorrar] = useState<Alerta | null>(null);
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

  const enviarSuelta = async (alerta: Alerta) => {
    setOcupada(alerta.id);
    await enviarAhora(alerta.id);
    setOcupada(null);
  };

  const confirmarBorrado = async () => {
    if (!aBorrar) return;

    setOcupada(aBorrar.id);
    await borrar(aBorrar.id);
    setOcupada(null);
    setABorrar(null);
  };

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

      {/* ----------------------- NUEVA ------------------------- */}

      <button
        type="button"
        onClick={abrirNueva}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C8A96B] px-4 py-3 text-sm font-semibold text-[#0B0F14] transition hover:brightness-110"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nueva tarea con alerta
      </button>

      {/* ----------------------- LISTA ------------------------- */}

      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : (
        <ListaAlertas
          alertas={alertas}
          onEditar={abrirExistente}
          onEnviarAhora={(alerta) => void enviarSuelta(alerta)}
          onAlternarActiva={(alerta) => void alternarActiva(alerta)}
          onBorrar={setABorrar}
          ocupada={ocupada}
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
        open={Boolean(aBorrar)}
        title="Borrar la tarea"
        description={
          aBorrar
            ? `«${aBorrar.titulo}» dejará de avisar y desaparece de la hoja.`
            : undefined
        }
        loading={Boolean(aBorrar && ocupada === aBorrar.id)}
        onConfirm={() => void confirmarBorrado()}
        onCancel={() => setABorrar(null)}
      />
    </div>
  );
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
