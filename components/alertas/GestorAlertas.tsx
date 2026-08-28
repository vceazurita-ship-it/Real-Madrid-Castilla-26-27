"use client";

import { useState } from "react";
import { Loader2, Plus, TriangleAlert } from "lucide-react";

import ConfirmDialog from "@/components/season/ConfirmDialog";
import { useAlertas } from "@/hooks/useAlertas";
import { nuevaAlerta, type Alerta } from "@/lib/alertas/modelo";
import DialogoAlerta from "./DialogoAlerta";
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
          onGuardar={guardar}
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
