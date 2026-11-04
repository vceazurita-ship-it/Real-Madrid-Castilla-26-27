"use client";

/**
 * El diálogo de `confirmar()` y `pedirTexto()` de `lib/avisos.ts`, montado
 * una vez en el layout. Sustituye a las ventanas del navegador (04/11/2026).
 *
 * - `role="alertdialog"`: es una pregunta que corta lo que se estaba haciendo.
 *   No es `role="dialog"` a propósito: el botón de exportar busca ese rol
 *   para sacar el PNG del pop-up abierto, y esto no se exporta.
 * - Esc o tocar fuera = cancelar; Intro en el campo = aceptar; el foco se
 *   queda dentro y vuelve a donde estaba al cerrar.
 * - Con `peligro` el foco empieza en «Cancelar»: un Intro sin leer no borra.
 */

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, HelpCircle, PencilLine } from "lucide-react";

import { dialogos, escuchaErrores, marcaDialogosMontados, type Dialogo } from "@/lib/avisos";

const nada = () => null;

export function Dialogos() {
  const actual = useSyncExternalStore(dialogos.suscribe, dialogos.actual, nada);

  useEffect(() => {
    marcaDialogosMontados(true);

    return () => marcaDialogosMontados(false);
  }, []);

  return (
    <>
      <LectorErrores />
      {actual ? <Ventana key={actual.id} dialogo={actual} /> : null}
    </>
  );
}

/** Los errores, leídos como alerta por el lector de pantalla. */
function LectorErrores() {
  const [texto, setTexto] = useState("");

  useEffect(
    () =>
      escuchaErrores((nuevo) => {
        // Vaciar y volver a escribir: así se lee aunque sea el mismo mensaje.
        setTexto("");
        window.setTimeout(() => setTexto(nuevo), 60);
      }),
    [],
  );

  return (
    <div role="alert" aria-live="assertive" className="sr-only">
      {texto}
    </div>
  );
}

function Ventana({ dialogo }: { dialogo: Dialogo }) {
  const titulo = useId();
  const cuerpo = useId();
  const panel = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const aceptar = useRef<HTMLButtonElement>(null);

  const [valor, setValor] = useState(dialogo.tipo === "pedir" ? dialogo.valor ?? "" : "");
  const [tocado, setTocado] = useState(false);

  const peligro = dialogo.tipo === "confirmar" && dialogo.peligro;
  const fallo = dialogo.tipo === "pedir" && dialogo.valida && tocado ? dialogo.valida(valor.trim()) : null;

  const responde = (si: boolean) => {
    dialogos.quita(dialogo.id);

    if (dialogo.tipo === "confirmar") dialogo.responde(si);
    else dialogo.responde(si ? valor.trim() : null);
  };

  const intentaAceptar = () => {
    if (dialogo.tipo === "pedir" && dialogo.valida) {
      setTocado(true);

      if (dialogo.valida(valor.trim())) return;
    }

    responde(true);
  };

  // Foco al abrir y de vuelta al cerrar.
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;

    const primero = dialogo.tipo === "pedir" ? campo.current : peligro ? cancelar.current : aceptar.current;

    primero?.focus();

    if (dialogo.tipo === "pedir") campo.current?.select();

    const previo = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previo;

      if (antes && document.contains(antes)) antes.focus();
    };
  }, [dialogo, peligro]);

  const teclas = (evento: React.KeyboardEvent) => {
    /* Las teclas no llegan a la pantalla de detrás: los atajos de la pizarra
       o del coding (espacio, flechas, Supr) no deben moverse con esto abierto. */
    evento.stopPropagation();

    if (evento.key === "Escape") {
      evento.preventDefault();
      responde(false);

      return;
    }

    if (evento.key !== "Tab" || !panel.current) return;

    // El foco no se escapa del diálogo.
    const enfocables = [...panel.current.querySelectorAll<HTMLElement>("button, input, textarea")].filter((el) => !el.hasAttribute("disabled"));

    if (!enfocables.length) return;

    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  };

  const Icono = dialogo.tipo === "pedir" ? PencilLine : peligro ? AlertTriangle : HelpCircle;

  const etiquetaAceptar = dialogo.aceptar ?? (dialogo.tipo === "pedir" ? "Aceptar" : "Sí, seguir");

  return (
    <div className="modal-veil dlg-velo" onMouseDown={(e) => e.target === e.currentTarget && responde(false)} onKeyDown={teclas}>
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titulo}
        aria-describedby={dialogo.texto ? cuerpo : undefined}
        className="dlg-panel"
        data-peligro={peligro ? "true" : undefined}
      >
        <div className="dlg-cabeza">
          <span className="dlg-icono" aria-hidden="true">
            <Icono size={20} strokeWidth={2.2} />
          </span>

          <div className="min-w-0 flex-1">
            <h2 id={titulo} className="dlg-titulo">
              {dialogo.titulo}
            </h2>

            {dialogo.texto ? (
              <p id={cuerpo} className="dlg-texto">
                {dialogo.texto}
              </p>
            ) : null}
          </div>
        </div>

        {dialogo.tipo === "pedir" ? (
          <form
            className="dlg-campo"
            onSubmit={(e) => {
              e.preventDefault();
              intentaAceptar();
            }}
          >
            {dialogo.etiqueta ? (
              <label htmlFor={`${titulo}-campo`} className="dlg-etiqueta">
                {dialogo.etiqueta}
              </label>
            ) : null}

            {dialogo.largo ? (
              <textarea
                id={`${titulo}-campo`}
                ref={campo}
                rows={4}
                value={valor}
                placeholder={dialogo.placeholder}
                aria-invalid={fallo ? true : undefined}
                aria-label={dialogo.etiqueta ? undefined : dialogo.titulo}
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    intentaAceptar();
                  }
                }}
              />
            ) : (
              <input
                id={`${titulo}-campo`}
                ref={campo}
                type="text"
                value={valor}
                placeholder={dialogo.placeholder}
                aria-invalid={fallo ? true : undefined}
                aria-label={dialogo.etiqueta ? undefined : dialogo.titulo}
                onChange={(e) => setValor(e.target.value)}
              />
            )}

            {fallo ? <p className="dlg-fallo">{fallo}</p> : null}
          </form>
        ) : null}

        <div className="dlg-botones">
          <button ref={cancelar} type="button" className="dlg-boton dlg-boton-cancelar" onClick={() => responde(false)}>
            {dialogo.cancelar ?? "Cancelar"}
          </button>

          <button ref={aceptar} type="button" className="dlg-boton dlg-boton-aceptar" onClick={intentaAceptar}>
            {etiquetaAceptar}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dialogos;
