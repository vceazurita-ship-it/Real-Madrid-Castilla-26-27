"use client";

/*
|--------------------------------------------------------------------------
| EDITAR VALORACIONES EMOCIONALES (31/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «que me dé la opción de editar los datos de emocional
| de cada jugador, o de varios a la vez, o de todos».
|
| Una tabla jugador × las cuatro dimensiones de los radares, editable celda a
| celda; casillas para elegir a uno, a varios o a todos, y una fila para
| aplicar a los elegidos (fijar un valor, sumar o restar puntos a una
| dimensión o a todas, o copiar la valoración de otro jugador). Nada sale de
| aquí hasta «Guardar»: el borrador vive en la ventana, con su «Deshacer».
|
| Quien no tiene valoración aparece con la media de la plantilla, en gris y
| con «media»; en cuanto se le toca una cifra pasa a tener la suya.
|
| En el móvil la tabla ancha no cabe: cada jugador es una tarjeta con sus
| cuatro cifras.
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Search, Undo2 } from "lucide-react";

import { Button, Dialog, sePuedeDescartar } from "@/components/abp/ui";
import { comaCorta } from "@/lib/formatoNumero";
import { posicionDe } from "@/lib/posiciones";

import { AXES, nombreLargo, type MetricKey } from "./modelo";

export type Valores = Record<MetricKey, number>;

export type CandidatoEmocional = {
  nombre: string;
  posicion: string;
  /** Su valoración de ahora (hoja o editada aquí); sin valoración, null. */
  valores: Valores | null;
  origen: "hoja" | "aqui" | "sinValorar";
  /** Lo que dice la hoja, para «Volver a la hoja». */
  enHoja: Valores | null;
  /** Está en el once de la pizarra. */
  titular: boolean;
};

export type CambioEmocional = { nombre: string; posicion: string; valores: Valores };

type Fila = {
  valores: Valores;
  /** Tiene valoración propia (de la hoja, de aquí, o porque se ha tocado). */
  propia: boolean;
  tocado: boolean;
  /** Se pidió volver a la hoja (o quitar lo editado). */
  quitar: boolean;
};

type Borrador = Record<string, Fila>;

type Modo = "fijar" | "sumar" | "restar" | "copiar";

const MAX_DESHACER = 60;

const redondea = (n: number) => Math.min(10, Math.max(0, Math.round(n * 10) / 10));

const iguales = (a: Valores, b: Valores) => AXES.every((x) => a[x.key] === b[x.key]);

const leeNumero = (texto: string) => {
  const n = Number(texto.trim().replace(",", "."));

  return texto.trim() !== "" && Number.isFinite(n) ? n : null;
};

function normaliza(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function EditorValoraciones({
  candidatos,
  media,
  onGuardar,
  onCerrar,
}: {
  candidatos: CandidatoEmocional[];
  /** Media de la plantilla: lo que lleva quien no tiene valoración. */
  media: Valores | null;
  onGuardar: (cambios: CambioEmocional[], quitar: string[]) => void;
  onCerrar: () => void;
}) {
  const mediaRedonda = useMemo<Valores>(
    () =>
      Object.fromEntries(AXES.map((a) => [a.key, redondea(media?.[a.key] ?? 5)])) as Valores,
    [media],
  );

  const porNombre = useMemo(() => new Map(candidatos.map((c) => [c.nombre, c])), [candidatos]);

  const [inicial] = useState<Borrador>(() =>
    Object.fromEntries(
      candidatos.map((c) => [
        c.nombre,
        { valores: c.valores ? { ...c.valores } : { ...mediaRedonda }, propia: Boolean(c.valores), tocado: false, quitar: false },
      ]),
    ),
  );

  const [borrador, setBorrador] = useState<Borrador>(inicial);
  const [historial, setHistorial] = useState<Borrador[]>([]);
  const [elegidos, setElegidos] = useState<Set<string>>(() => new Set());
  const [busqueda, setBusqueda] = useState("");

  const [modo, setModo] = useState<Modo>("fijar");
  const [eje, setEje] = useState<MetricKey | "todos">("todos");
  const [cantidad, setCantidad] = useState("");
  const [fuenteCopia, setFuenteCopia] = useState("");

  /* Cada cambio guarda la foto anterior: «Deshacer» vuelve paso a paso. */
  const conHistoria = useCallback(
    (fn: (b: Borrador) => Borrador) => {
      setHistorial((h) => [...h, borrador].slice(-MAX_DESHACER));
      setBorrador(fn);
    },
    [borrador],
  );

  const deshacer = useCallback(() => {
    if (historial.length === 0) return;

    setBorrador(historial[historial.length - 1]);
    setHistorial(historial.slice(0, -1));
  }, [historial]);

  /* Lo que se mandará al guardar. */
  const { cambios, quitar } = useMemo(() => {
    const cambios: CambioEmocional[] = [];
    const quitar: string[] = [];

    for (const c of candidatos) {
      const f = borrador[c.nombre];

      if (!f?.tocado) continue;

      if (f.quitar) {
        if (c.origen === "aqui") quitar.push(c.nombre);
        continue;
      }

      /* Quien no tenía valoración y se ha tocado pasa a tener la suya, aunque la cifra coincida con la media. */
      const cambiado = c.origen === "sinValorar" ? f.propia : !iguales(f.valores, inicial[c.nombre].valores);

      if (cambiado) cambios.push({ nombre: c.nombre, posicion: c.posicion, valores: f.valores });
    }

    return { cambios, quitar };
  }, [borrador, candidatos, inicial]);

  const pendientes = cambios.length + quitar.length;

  /* Ctrl+Z fuera de los campos: dentro, deshace lo tecleado en el campo. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;

      const t = e.target as HTMLElement | null;

      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;

      e.preventDefault();
      deshacer();
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [deshacer]);

  const fijaCelda = (nombre: string, clave: MetricKey, valor: number) => {
    const f = borrador[nombre];

    /* La misma cifra otra vez no es un cambio (ni un paso de «Deshacer»). */
    if (!f || (f.propia && !f.quitar && f.valores[clave] === redondea(valor))) return;

    conHistoria((b) => ({
      ...b,
      [nombre]: { ...b[nombre], valores: { ...b[nombre].valores, [clave]: redondea(valor) }, propia: true, tocado: true, quitar: false },
    }));
  };

  const vuelveALaHoja = (nombre: string) => {
    const c = porNombre.get(nombre);

    if (!c) return;

    conHistoria((b) => ({
      ...b,
      [nombre]: {
        valores: c.enHoja ? { ...c.enHoja } : { ...mediaRedonda },
        propia: Boolean(c.enHoja),
        tocado: true,
        quitar: true,
      },
    }));
  };

  /* ------------------------------------------------ Lista visible */
  const visibles = useMemo(() => {
    const q = normaliza(busqueda.trim());
    const lista = q ? candidatos.filter((c) => normaliza(c.nombre).includes(q)) : candidatos;

    /* El once primero, luego los valorados y al final quien aún no tiene valoración. */
    const peso = (c: CandidatoEmocional) => (c.titular ? 0 : c.origen === "sinValorar" ? 2 : 1);

    return [...lista].sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, "es"));
  }, [candidatos, busqueda]);

  const todosVisiblesElegidos = visibles.length > 0 && visibles.every((c) => elegidos.has(c.nombre));

  const alterna = (nombre: string) =>
    setElegidos((s) => {
      const n = new Set(s);

      if (n.has(nombre)) n.delete(nombre);
      else n.add(nombre);

      return n;
    });

  const eligeTodos = () =>
    setElegidos((s) => {
      const n = new Set(s);

      if (todosVisiblesElegidos) visibles.forEach((c) => n.delete(c.nombre));
      else visibles.forEach((c) => n.add(c.nombre));

      return n;
    });

  const eligeSi = (fn: (c: CandidatoEmocional) => boolean) => setElegidos(new Set(candidatos.filter(fn).map((c) => c.nombre)));

  /* ------------------------------------------------ Aplicar a los elegidos */
  const numero = leeNumero(cantidad);

  const destinos = [...elegidos].filter((n) => borrador[n] && (modo !== "copiar" || n !== fuenteCopia));

  const sePuedeAplicar = destinos.length > 0 && (modo === "copiar" ? Boolean(borrador[fuenteCopia]) : numero !== null && numero >= 0 && (modo !== "fijar" || numero <= 10));

  const aplica = () => {
    if (!sePuedeAplicar) return;

    const ejes = eje === "todos" ? AXES.map((a) => a.key) : [eje];

    conHistoria((b) => {
      const nuevo = { ...b };
      const fuente = modo === "copiar" ? b[fuenteCopia]?.valores : null;

      for (const n of destinos) {
        const f = b[n];
        const valores = { ...f.valores };

        for (const k of ejes) {
          if (modo === "copiar" && fuente) valores[k] = fuente[k];
          else if (modo === "fijar") valores[k] = redondea(numero ?? 0);
          else if (modo === "sumar") valores[k] = redondea(valores[k] + (numero ?? 0));
          else if (modo === "restar") valores[k] = redondea(valores[k] - (numero ?? 0));
        }

        nuevo[n] = { valores, propia: true, tocado: true, quitar: false };
      }

      return nuevo;
    });
  };

  const cierra = () => {
    if (sePuedeDescartar(pendientes > 0)) onCerrar();
  };

  const guarda = () => {
    if (pendientes === 0) {
      onCerrar();
      return;
    }

    onGuardar(cambios, quitar);
  };

  const nombreEje = eje === "todos" ? "las cuatro dimensiones" : nombreLargo(AXES.find((a) => a.key === eje)!).toLowerCase();

  const resumenAplicar =
    destinos.length === 0
      ? "Marca jugadores en la lista para cambiarlos a la vez."
      : modo === "copiar"
        ? fuenteCopia
          ? `Copia ${nombreEje} de ${fuenteCopia} a ${destinos.length} ${destinos.length === 1 ? "jugador" : "jugadores"}.`
          : "Elige de quién se copia."
        : numero === null
          ? "Escribe la cifra."
          : `${modo === "fijar" ? "Pone" : modo === "sumar" ? "Suma" : "Resta"} ${comaCorta(numero)} ${modo === "fijar" ? "en" : "a"} ${nombreEje} de ${destinos.length} ${destinos.length === 1 ? "jugador" : "jugadores"} (de 0 a 10).`;

  const campo =
    "rounded-lg border border-white/12 bg-white/[0.05] px-2 py-1.5 text-xs text-white outline-none transition focus:border-[#C8A96B]/60";

  return (
    <Dialog
      title="Editar valoraciones"
      subtitle="Lo que se cambia aquí manda sobre la hoja emocional, jugador a jugador."
      onClose={onCerrar}
      sinGuardar={pendientes > 0}
      footer={
        <>
          <span className="mr-auto text-[11px] text-white/50">
            {pendientes === 0
              ? "Ningún cambio todavía"
              : `${pendientes} ${pendientes === 1 ? "jugador cambiado" : "jugadores cambiados"} sin guardar`}
          </span>

          <Button icon={Undo2} onClick={deshacer} disabled={historial.length === 0} title="Deshacer el último cambio (Ctrl+Z)">
            Deshacer
          </Button>

          <Button onClick={cierra}>Cancelar</Button>

          <Button tone="primary" icon={Check} onClick={guarda} disabled={pendientes === 0}>
            Guardar
          </Button>
        </>
      }
    >
      {/* ------------------------------------------- Aplicar a los elegidos */}
      <div className="mb-4 rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.06] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#E4C977]">
            Aplicar a los seleccionados
            <span className="ml-2 tabular-nums text-white/55">{elegidos.size}</span>
          </p>

          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={eligeTodos} className="rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white">
              {todosVisiblesElegidos ? "Quitar a todos" : "Todos"}
            </button>
            {candidatos.some((c) => c.titular) && (
              <button type="button" onClick={() => eligeSi((c) => c.titular)} className="rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white">
                El once
              </button>
            )}
            {candidatos.some((c) => c.origen === "sinValorar") && (
              <button type="button" onClick={() => eligeSi((c) => c.origen === "sinValorar")} className="rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white">
                Sin valoración
              </button>
            )}
            {elegidos.size > 0 && (
              <button type="button" onClick={() => setElegidos(new Set())} className="rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white">
                Ninguno
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <select aria-label="Qué hacer" value={modo} onChange={(e) => setModo(e.target.value as Modo)} className={campo}>
            <option value="fijar">Fijar</option>
            <option value="sumar">Sumar</option>
            <option value="restar">Restar</option>
            <option value="copiar">Copiar de…</option>
          </select>

          <select aria-label="Dimensión" value={eje} onChange={(e) => setEje(e.target.value as MetricKey | "todos")} className={campo}>
            <option value="todos">Las cuatro</option>
            {AXES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.corto}
              </option>
            ))}
          </select>

          {modo === "copiar" ? (
            <select aria-label="Copiar la valoración de" value={fuenteCopia} onChange={(e) => setFuenteCopia(e.target.value)} className={`${campo} col-span-2 sm:min-w-[180px]`}>
              <option value="">Copiar de…</option>
              {candidatos.map((c) => (
                <option key={c.nombre} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={modo === "fijar" ? "Valor" : "Puntos"}
              inputMode="decimal"
              placeholder={modo === "fijar" ? "Valor (0 a 10)" : "Puntos"}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") aplica();
              }}
              className={`${campo} sm:w-[120px]`}
            />
          )}

          <Button tone="primary" onClick={aplica} disabled={!sePuedeAplicar}>
            Aplicar
          </Button>
        </div>

        <p className="mt-2 text-[11px] text-white/50">{resumenAplicar}</p>
      </div>

      {/* ------------------------------------------- Buscador */}
      <div className="relative mb-3">
        <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar jugador…"
          aria-label="Buscar jugador"
          className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-xs text-white outline-none transition placeholder:text-white/30 focus:border-[#C8A96B]/50"
        />
      </div>

      {/* ------------------------------------------- Tabla (escritorio) */}
      <table className="hidden w-full border-separate border-spacing-0 text-xs sm:table">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[.14em] text-white/45">
            <th className="w-8 border-b border-white/10 pb-2">
              <input type="checkbox" checked={todosVisiblesElegidos} onChange={eligeTodos} aria-label="Elegir a todos" className="accent-[#C8A96B]" />
            </th>
            <th className="border-b border-white/10 pb-2">Jugador</th>
            {AXES.map((a) => (
              <th key={a.key} className="w-[76px] border-b border-white/10 pb-2 text-center" title={`${a.label} · ${a.detail}`}>
                {a.corto}
              </th>
            ))}
            <th className="w-[96px] border-b border-white/10 pb-2" />
          </tr>
        </thead>
        <tbody>
          {visibles.map((c) => {
            const f = borrador[c.nombre];

            return (
              <tr key={c.nombre} className={elegidos.has(c.nombre) ? "bg-[#C8A96B]/[0.07]" : undefined}>
                <td className="border-b border-white/[0.06] py-1.5">
                  <input type="checkbox" checked={elegidos.has(c.nombre)} onChange={() => alterna(c.nombre)} aria-label={`Elegir a ${c.nombre}`} className="accent-[#C8A96B]" />
                </td>
                <td className="border-b border-white/[0.06] py-1.5 pr-2">
                  <Nombre c={c} f={f} />
                </td>
                {AXES.map((a) => (
                  <td key={a.key} className="border-b border-white/[0.06] px-1 py-1.5 text-center">
                    <Celda key={`${c.nombre}-${a.key}-${f.valores[a.key]}`} valor={f.valores[a.key]} media={!f.propia} etiqueta={`${nombreLargo(a)} de ${c.nombre}`} onCambia={(v) => fijaCelda(c.nombre, a.key, v)} />
                  </td>
                ))}
                <td className="border-b border-white/[0.06] py-1.5 text-right">
                  <Volver c={c} f={f} onVolver={() => vuelveALaHoja(c.nombre)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ------------------------------------------- Lista (móvil) */}
      <ul className="space-y-2 sm:hidden">
        <li className="flex items-center gap-2 px-1 text-[11px] text-white/55">
          <input type="checkbox" checked={todosVisiblesElegidos} onChange={eligeTodos} aria-label="Elegir a todos" className="h-4 w-4 accent-[#C8A96B]" />
          Elegir a todos
        </li>
        {visibles.map((c) => {
          const f = borrador[c.nombre];

          return (
            <li key={c.nombre} className={`rounded-xl border p-2.5 ${elegidos.has(c.nombre) ? "border-[#C8A96B]/40 bg-[#C8A96B]/[0.07]" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={elegidos.has(c.nombre)} onChange={() => alterna(c.nombre)} aria-label={`Elegir a ${c.nombre}`} className="mt-0.5 h-4 w-4 shrink-0 accent-[#C8A96B]" />
                <div className="min-w-0 flex-1">
                  <Nombre c={c} f={f} />
                </div>
                <Volver c={c} f={f} onVolver={() => vuelveALaHoja(c.nombre)} />
              </div>

              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {AXES.map((a) => (
                  <label key={a.key} className="flex flex-col items-center gap-1 text-[10px] text-white/50">
                    {a.corto}
                    <Celda key={`${c.nombre}-${a.key}-${f.valores[a.key]}`} valor={f.valores[a.key]} media={!f.propia} etiqueta={`${nombreLargo(a)} de ${c.nombre}`} onCambia={(v) => fijaCelda(c.nombre, a.key, v)} />
                  </label>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {visibles.length === 0 && <p className="py-6 text-center text-xs text-white/45">Ningún jugador con ese nombre.</p>}

      <p className="mt-4 text-[11px] leading-relaxed text-white/45">
        Cifras de 0 a 10, con un decimal. En gris y con «media», quien aún no tiene valoración: lleva la media de la plantilla y pasa a tener la suya en cuanto se cambia una cifra.
      </p>
    </Dialog>
  );
}

function Nombre({ c, f }: { c: CandidatoEmocional; f: Fila }) {
  const puesto = posicionDe(c.nombre, c.posicion).trim();

  const estado = f.quitar
    ? c.enHoja
      ? "vuelve a la hoja"
      : "vuelve a la media"
    : f.tocado && (f.propia || c.origen !== "sinValorar")
      ? "cambiado"
      : c.origen === "aqui"
        ? "editado aquí"
        : !f.propia
          ? "media"
          : "";

  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-white">{c.nombre}</p>
      <p className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-white/45">
        {puesto && <span>{puesto}</span>}
        {c.titular && <span className="text-[#E4C977]">once</span>}
        {estado && (
          <span className={estado === "cambiado" ? "font-semibold text-[#36DAFF]" : estado === "media" ? "italic" : "text-[#E4C977]/80"}>
            {estado}
          </span>
        )}
      </p>
    </div>
  );
}

function Volver({ c, f, onVolver }: { c: CandidatoEmocional; f: Fila; onVolver: () => void }) {
  if (c.origen !== "aqui" || f.quitar) return null;

  return (
    <button
      type="button"
      onClick={onVolver}
      title={c.enHoja ? "Quitar lo editado aquí y usar lo que dice la hoja" : "Quitar lo editado aquí: vuelve a llevar la media de la plantilla"}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/55 transition hover:border-white/30 hover:text-white"
    >
      <RotateCcw size={10} aria-hidden />
      {c.enHoja ? "A la hoja" : "Quitar"}
    </button>
  );
}

/* Una cifra: se escribe con coma o punto y se confirma al salir o con Intro. */
function Celda({ valor, media, etiqueta, onCambia }: { valor: number; media: boolean; etiqueta: string; onCambia: (v: number) => void }) {
  const [texto, setTexto] = useState(() => comaCorta(valor));

  const confirma = () => {
    const n = leeNumero(texto);

    if (n === null) {
      setTexto(comaCorta(valor));
      return;
    }

    const v = redondea(n);

    if (v !== valor || media) onCambia(v);
    else setTexto(comaCorta(v));
  };

  return (
    <input
      aria-label={etiqueta}
      inputMode="decimal"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => {
        if (texto !== comaCorta(valor)) confirma();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          /* Confirma el blur: así la cifra entra una sola vez. */
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setTexto(comaCorta(valor));
        }
      }}
      className={`w-full max-w-[64px] rounded-lg border px-1.5 py-1.5 text-center text-sm tabular-nums outline-none transition focus:border-[#C8A96B]/70 ${
        media ? "border-dashed border-white/15 bg-transparent italic text-white/45" : "border-white/12 bg-white/[0.05] font-semibold text-white"
      }`}
    />
  );
}
