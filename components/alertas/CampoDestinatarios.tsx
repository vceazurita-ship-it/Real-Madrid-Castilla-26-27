"use client";

import { useMemo, useRef, useState } from "react";
import { Mail, Plus, X } from "lucide-react";

import {
  esEmail,
  normalizaEmail,
  separaEmails,
  type ContactoAgenda,
} from "@/lib/alertas/modelo";

/**
 * Los correos de destino, con las direcciones que la app ya ha aprendido.
 *
 * La agenda no se escribe a mano en ninguna parte: la hoja apunta cada
 * dirección que se usa en una tarea y la devuelve ordenada por veces usada, así
 * que a la tercera o cuarta alerta ya casi nunca hay que teclear un correo
 * entero. Aquí solo se filtra por lo que se va escribiendo.
 */

interface Props {
  valor: string[];
  onChange: (destinatarios: string[]) => void;
  agenda: ContactoAgenda[];
}

export default function CampoDestinatarios({ valor, onChange, agenda }: Props) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const yaPuestos = useMemo(
    () => new Set(valor.map(normalizaEmail)),
    [valor],
  );

  /* Las que aún no están en la tarea y encajan con lo tecleado. */
  const sugerencias = useMemo(() => {
    const busqueda = texto.trim().toLowerCase();

    return agenda
      .filter((contacto) => !yaPuestos.has(contacto.email))
      .filter(
        (contacto) =>
          !busqueda ||
          contacto.email.includes(busqueda) ||
          contacto.nombre.toLowerCase().includes(busqueda),
      )
      .slice(0, 6);
  }, [agenda, texto, yaPuestos]);

  const añadir = (entrada: string) => {
    /* Pegar una lista copiada de otro correo tiene que funcionar de una vez. */
    const nuevos = separaEmails(entrada).filter(
      (email) => esEmail(email) && !yaPuestos.has(email),
    );

    if (nuevos.length) onChange([...valor, ...new Set(nuevos)]);

    setTexto("");
  };

  const quitar = (email: string) =>
    onChange(valor.filter((actual) => actual !== email));

  const alPulsar = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Enter" || evento.key === "," || evento.key === ";") {
      evento.preventDefault();
      añadir(texto);
      return;
    }

    /* Retroceso con el campo vacío borra la última ficha, como en Gmail. */
    if (evento.key === "Backspace" && !texto && valor.length) {
      quitar(valor[valor.length - 1]);
    }
  };

  const sinValidar = texto.trim() && !esEmail(texto.trim());

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        <Mail className="h-3.5 w-3.5" aria-hidden />
        Enviar a
      </label>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        {valor.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {valor.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-3 pr-1.5 text-xs text-white/80"
              >
                {email}

                <button
                  type="button"
                  onClick={() => quitar(email)}
                  aria-label={`Quitar ${email}`}
                  className="rounded-full p-0.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          ref={entrada}
          type="email"
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setAbierto(true);
          }}
          onKeyDown={alPulsar}
          onFocus={() => setAbierto(true)}
          /* Sin retardo se cierra antes de que el clic llegue a la sugerencia. */
          onBlur={() => {
            window.setTimeout(() => setAbierto(false), 150);
            añadir(texto);
          }}
          placeholder={
            valor.length ? "Añadir otro correo…" : "nombre@ejemplo.com"
          }
          className="w-full bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/30"
        />
      </div>

      {sinValidar && (
        <p className="text-xs text-amber-400">
          «{texto.trim()}» no parece un correo.
        </p>
      )}

      {abierto && sugerencias.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#11161D]">
          <p className="px-3 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
            Ya usados en otras tareas
          </p>

          <div className="p-1.5">
            {sugerencias.map((contacto) => (
              <button
                key={contacto.email}
                type="button"
                /* `onMouseDown` y no `onClick`: el blur del campo llega antes. */
                onMouseDown={(evento) => {
                  evento.preventDefault();
                  añadir(contacto.email);
                  entrada.current?.focus();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.06]"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-white/30" aria-hidden />

                <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                  {contacto.nombre || contacto.email}

                  {contacto.nombre && (
                    <span className="ml-2 text-xs text-white/40">
                      {contacto.email}
                    </span>
                  )}
                </span>

                {contacto.usos > 0 && (
                  <span className="shrink-0 text-[10px] text-white/30">
                    {contacto.usos}{" "}
                    {contacto.usos === 1 ? "envío" : "envíos"}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
