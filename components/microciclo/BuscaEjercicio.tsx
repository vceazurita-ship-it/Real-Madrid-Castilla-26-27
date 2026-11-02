"use client";

/*
|--------------------------------------------------------------------------
| RELLENAR UNA TAREA CON UN EJERCICIO YA HECHO (02/11/2026)
|--------------------------------------------------------------------------
|
| Se escriben dos letras —«rondo», «finaliz», «4v4»— y salen los ejercicios
| de la hoja que encajan, los del mismo MD primero. Al elegir uno se rellenan
| de golpe tipo, fase, formato, grupo, contenidos, espacio, jugadores y la
| demanda cognitiva; el tiempo y la intensidad se respetan (los pone quien
| dirige la sesión), aunque se enseñan los habituales.
|
| Teclado: flechas para moverse, Intro para elegir, Escape para cerrar.
*/

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { buscaEjercicios, fechaCorta, nombreDeEjercicio, type Ejercicio } from "@/lib/registro/rellenar";
import { plural } from "@/lib/registro/semana";

export function BuscaEjercicio({
  catalogo,
  md,
  onElige,
}: {
  catalogo: Ejercicio[];
  md: string;
  onElige: (ejercicio: Ejercicio) => void;
}) {
  const id = useId();
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const opciones = useMemo(() => (abierto ? buscaEjercicios(catalogo, consulta, md, 8) : []), [abierto, catalogo, consulta, md]);

  if (catalogo.length === 0) return null;

  const elige = (ejercicio: Ejercicio | undefined) => {
    if (!ejercicio) return;

    onElige(ejercicio);
    setConsulta("");
    setAbierto(false);
    setActivo(0);
  };

  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="sr-only">
        Rellenar con un ejercicio ya hecho
      </label>

      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" aria-hidden />

      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={abierto && opciones.length > 0}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        autoComplete="off"
        value={consulta}
        placeholder="Rellenar con un ejercicio ya hecho: «rondo», «finalización», «4v4»…"
        onFocus={() => setAbierto(true)}
        onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
        onChange={(evento) => {
          setConsulta(evento.target.value);
          setAbierto(true);
          setActivo(0);
        }}
        onKeyDown={(evento) => {
          if (evento.key === "ArrowDown") {
            evento.preventDefault();
            setAbierto(true);
            setActivo((n) => Math.min(n + 1, Math.max(0, opciones.length - 1)));
          } else if (evento.key === "ArrowUp") {
            evento.preventDefault();
            setActivo((n) => Math.max(0, n - 1));
          } else if (evento.key === "Enter" && abierto && opciones.length > 0) {
            evento.preventDefault();
            elige(opciones[activo]);
          } else if (evento.key === "Escape" && abierto) {
            evento.stopPropagation();
            setAbierto(false);
          }
        }}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-8 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/30 focus:border-[#C8A96B]/50"
      />

      {abierto && opciones.length > 0 && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#11161C] p-1 shadow-2xl"
        >
          {opciones.map((ejercicio, i) => (
            <li
              key={ejercicio.clave}
              role="option"
              aria-selected={i === activo}
              onMouseDown={(evento) => {
                /* Antes que el blur del campo, que cerraría la lista. */
                evento.preventDefault();
                elige(ejercicio);
              }}
              onMouseEnter={() => setActivo(i)}
              className={`cursor-pointer rounded-lg px-2.5 py-2 ${i === activo ? "bg-white/[0.08]" : ""}`}
            >
              <p className="truncate text-[12px] font-semibold text-white/90">{nombreDeEjercicio(ejercicio.modelo)}</p>
              <p className="truncate text-[11px] text-white/50">
                {[
                  ejercicio.modelo.fase,
                  plural(ejercicio.usos, "vez", "veces"),
                  ejercicio.ultima ? `última ${fechaCorta(ejercicio.ultima)}` : "",
                  ejercicio.mds[0] ?? "",
                  ejercicio.tiempo > 0 ? `suele durar ${ejercicio.tiempo}′` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
