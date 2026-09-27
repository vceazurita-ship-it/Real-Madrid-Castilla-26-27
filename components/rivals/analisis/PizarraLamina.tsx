"use client";

/**
 * La pizarra de una lámina de análisis.
 *
 * El fondo —campo, título y fichas— es el mismo SVG que sale en el PDF y en el
 * PPT (`laminaSvg` con `sinMarcas`), y encima va una capa con las marcas que se
 * ponen, se arrastran y se borran. Las coordenadas se pasan con
 * `getScreenCTM()`, que sigue valiendo aunque la lámina esté encogida para
 * caber en la columna: por eso aquí no se usa dnd-kit, que mide con
 * `getBoundingClientRect()` y bajo escala deja las cosas donde no están.
 *
 * Mientras se arrastra, la marca vive en un borrador local y sólo se guarda al
 * soltar: guardar el documento en cada píxel del ratón es llenar la cola de
 * guardado para nada.
 */

import {
  ArrowUpRight,
  Circle,
  MousePointer2,
  Plus,
  Spline,
  Tag,
  Trash2,
  Undo2,
  Redo2,
  CopyPlus,
  Eraser,
  X as Cruz,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  COLORES,
  type ColorMarca,
  type JugadorLamina,
  type Lamina,
  type Marca,
  nuevoIdAnalisis,
  type Punto,
} from "@/lib/rivals/analisis";
import {
  anchoEtiqueta,
  aMetros,
  aPx,
  escalaEn,
  type FichaLamina,
  LAMINA_H,
  LAMINA_W,
  laminaSvg,
  marcaSvg,
  ordenPintado,
  TABLERO,
} from "@/lib/rivals/analisis-svg";

type Herramienta = "mover" | "cruz" | "balon" | "etiqueta" | "flecha" | "zona" | "linea";

export type OpcionJugador = { clave: string; nombre: string; detalle: string };

type Props = {
  lamina: Lamina;
  onChange: (lamina: Lamina) => void;
  ficha: (clave: string, nombre: string) => FichaLamina | null;
  plantilla: OpcionJugador[];
  escudo?: string;
  equipo?: string;
  jornada?: string;
  soloLectura?: boolean;
};

/* Cada herramienta con su tecla: se dibuja con una mano en el ratón. */
const HERRAMIENTAS: { id: Herramienta; nombre: string; atajo: string; icono: React.ReactNode }[] = [
  { id: "mover", nombre: "Mover", atajo: "V", icono: <MousePointer2 size={15} /> },
  { id: "cruz", nombre: "Cruz", atajo: "X", icono: <Cruz size={15} /> },
  { id: "balon", nombre: "Balón", atajo: "B", icono: <Circle size={15} /> },
  { id: "etiqueta", nombre: "Rótulo", atajo: "T", icono: <Tag size={15} /> },
  { id: "flecha", nombre: "Flecha", atajo: "F", icono: <ArrowUpRight size={15} /> },
  { id: "zona", nombre: "Zona", atajo: "Z", icono: <Spline size={15} /> },
];

const COLOR_POR_NUMERO: ColorMarca[] = ["rojo", "amarillo", "azul", "blanco"];

/** Pasos que se pueden deshacer por lámina. */
const MAX_PASOS = 60;

const NOMBRE_COLOR: Record<ColorMarca, string> = {
  rojo: "Rojo",
  amarillo: "Amarillo",
  azul: "Azul",
  blanco: "Blanco",
};

type Arrastre =
  | { tipo: "marca"; id: string; desde: Punto; original: Marca }
  | { tipo: "punta"; id: string }
  | { tipo: "linea"; id: string; indice: number }
  | { tipo: "nueva-flecha"; id: string };

export function PizarraLamina({
  lamina,
  onChange,
  ficha,
  plantilla,
  escudo,
  equipo,
  jornada,
  soloLectura,
}: Props) {
  const [herramienta, setHerramienta] = useState<Herramienta>("mover");
  const [color, setColor] = useState<ColorMarca>("rojo");
  const [elegida, setElegida] = useState<string | null>(null);

  /* Lo que se está arrastrando, antes de guardarse. */
  const [borrador, setBorrador] = useState<Lamina | null>(null);

  const arrastre = useRef<Arrastre | null>(null);
  const capa = useRef<SVGSVGElement | null>(null);

  const vista = borrador ?? lamina;

  /* Al cambiar de lámina no se arrastra nada de la anterior. */
  const [laminaVista, setLaminaVista] = useState(lamina.id);

  /* Deshacer y rehacer: copias enteras de la lámina, que pesan poco. */
  const [pasado, setPasado] = useState<Lamina[]>([]);
  const [futuro, setFuturo] = useState<Lamina[]>([]);

  /** Cuándo se guardó escribiendo por última vez: una palabra es un paso. */
  const escritoEn = useRef(0);

  if (laminaVista !== lamina.id) {
    setLaminaVista(lamina.id);
    setElegida(null);
    setBorrador(null);
    setPasado([]);
    setFuturo([]);
  }

  const fondo = useMemo(
    () => laminaSvg(vista, { ficha, escudo, equipo, jornada, sinMarcas: true }),
    /* Las marcas no cuentan: el fondo sólo cambia con título, fichas y
       consignas. La leyenda va con las marcas, en la capa de encima. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vista.titulo, vista.tituloJugadores, vista.jugadores, vista.notas, ficha, escudo, equipo, jornada],
  );

  const aLamina = useCallback((evento: { clientX: number; clientY: number }): Punto => {
    const svg = capa.current;

    const matriz = svg?.getScreenCTM();

    if (!svg || !matriz) return { x: 0, y: 0 };

    const punto = new DOMPoint(evento.clientX, evento.clientY).matrixTransform(matriz.inverse());

    return aMetros({ x: punto.x, y: punto.y });
  }, []);

  const cambiaMarcas = useCallback(
    (base: Lamina, cambia: (marcas: Marca[]) => Marca[]) => ({ ...base, marcas: cambia(base.marcas) }),
    [],
  );

  /*
  | Todo cambio pasa por aquí para poder deshacerlo. Lo que se escribe en un
  | campo se agrupa: sin eso, «CORTA» serían cinco pasos de deshacer.
  */
  const guarda = useCallback(
    (nueva: Lamina) => {
      const ahora = Date.now();
      const escribiendo = Boolean(
        typeof document !== "undefined" &&
          document.activeElement?.matches("input:not([type=checkbox]), textarea"),
      );

      if (!(escribiendo && ahora - escritoEn.current < 1500)) {
        setPasado((lista) => [...lista.slice(-(MAX_PASOS - 1)), lamina]);
      }

      escritoEn.current = escribiendo ? ahora : 0;

      setFuturo([]);
      setBorrador(null);
      onChange(nueva);
    },
    [lamina, onChange],
  );

  const deshaz = useCallback(() => {
    const previa = pasado[pasado.length - 1];

    if (!previa) return;

    setPasado((lista) => lista.slice(0, -1));
    setFuturo((lista) => [lamina, ...lista]);
    escritoEn.current = 0;
    onChange(previa);
  }, [lamina, onChange, pasado]);

  const rehaz = useCallback(() => {
    const siguiente = futuro[0];

    if (!siguiente) return;

    setFuturo((lista) => lista.slice(1));
    setPasado((lista) => [...lista, lamina]);
    escritoEn.current = 0;
    onChange(siguiente);
  }, [futuro, lamina, onChange]);

  const marcaElegida = vista.marcas.find((m) => m.id === elegida) ?? null;

  const borra = useCallback(() => {
    if (!elegida) return;

    guarda(cambiaMarcas(lamina, (marcas) => marcas.filter((m) => m.id !== elegida)));
    setElegida(null);
  }, [cambiaMarcas, elegida, guarda, lamina]);

  /** Mueve lo elegido unos centímetros: el ajuste fino que el ratón no da. */
  const empuja = useCallback(
    (dx: number, dy: number) => {
      if (!elegida) return;

      guarda(
        cambiaMarcas(lamina, (marcas) =>
          marcas.map((m) => {
            if (m.id !== elegida) return m;

            if (m.tipo === "flecha") return { ...m, x: m.x + dx, y: m.y + dy, x2: m.x2 + dx, y2: m.y2 + dy };

            return { ...m, x: m.x + dx, y: m.y + dy };
          }),
        ),
      );
    },
    [cambiaMarcas, elegida, guarda, lamina],
  );

  const duplica = useCallback(() => {
    const original = lamina.marcas.find((m) => m.id === elegida);

    if (!original) return;

    const id = nuevoIdAnalisis();

    const copia: Marca =
      original.tipo === "flecha"
        ? { ...original, id, x: original.x + 1.5, x2: original.x2 + 1.5 }
        : original.tipo === "etiqueta"
          ? { ...original, id, x: original.x + 1.5, a: original.a.map((p) => ({ ...p })) }
          : { ...original, id, x: original.x + 1.5 };

    guarda(cambiaMarcas(lamina, (marcas) => [...marcas, copia]));
    setElegida(id);
  }, [cambiaMarcas, elegida, guarda, lamina]);

  /*
  | EL TECLADO. Nada de esto actúa mientras se escribe en un campo.
  |
  | V X B T F Z: herramientas · 1-4: color · Supr: borrar · Esc: soltar ·
  | flechas: mover lo elegido (con Mayús, un metro) · Ctrl+D: duplicar ·
  | Ctrl+Z / Ctrl+Mayús+Z / Ctrl+Y: deshacer y rehacer.
  */
  useEffect(() => {
    if (soloLectura) return;

    const tecla = (evento: KeyboardEvent) => {
      const destino = evento.target as HTMLElement | null;

      if (destino?.closest("input, textarea, select, [contenteditable]")) return;

      const control = evento.ctrlKey || evento.metaKey;
      const letra = evento.key.toLowerCase();

      if (control && letra === "z") {
        evento.preventDefault();

        if (evento.shiftKey) rehaz();
        else deshaz();

        return;
      }

      if (control && letra === "y") {
        evento.preventDefault();
        rehaz();

        return;
      }

      if (control && letra === "d" && elegida) {
        evento.preventDefault();
        duplica();

        return;
      }

      if (control || evento.altKey) return;

      if ((evento.key === "Delete" || evento.key === "Backspace") && elegida) {
        evento.preventDefault();
        borra();

        return;
      }

      if (evento.key === "Escape") {
        setElegida(null);
        setHerramienta("mover");

        return;
      }

      const paso = evento.shiftKey ? 1 : 0.25;
      const flechas: Record<string, [number, number]> = {
        ArrowLeft: [-paso, 0],
        ArrowRight: [paso, 0],
        ArrowUp: [0, -paso],
        ArrowDown: [0, paso],
      };

      if (flechas[evento.key] && elegida) {
        evento.preventDefault();
        empuja(...flechas[evento.key]);

        return;
      }

      const herramientaTecla = HERRAMIENTAS.find((h) => h.atajo.toLowerCase() === letra);

      if (herramientaTecla) {
        setHerramienta(herramientaTecla.id);

        return;
      }

      const numero = Number(evento.key);

      if (numero >= 1 && numero <= COLOR_POR_NUMERO.length) setColor(COLOR_POR_NUMERO[numero - 1]);
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [borra, deshaz, duplica, elegida, empuja, rehaz, soloLectura]);

  /* ------------------------- arrastrar ------------------------- */

  const empiezaArrastre = useCallback(
    (nuevo: Arrastre, base: Lamina) => {
      arrastre.current = nuevo;

      let ultimo = base;

      const mueve = (evento: PointerEvent) => {
        const actual = arrastre.current;

        if (!actual) return;

        const p = aLamina(evento);

        ultimo = cambiaMarcas(base, (marcas) =>
          marcas.map((m) => {
            if (m.id !== actual.id) return m;

            if (actual.tipo === "marca") {
              const dx = p.x - actual.desde.x;
              const dy = p.y - actual.desde.y;
              const o = actual.original;

              if (o.tipo === "flecha") {
                return { ...o, x: o.x + dx, y: o.y + dy, x2: o.x2 + dx, y2: o.y2 + dy };
              }

              if (o.tipo === "etiqueta") {
                /* Las líneas se quedan donde apuntan: se mueve el rótulo. */
                return { ...o, x: o.x + dx, y: o.y + dy };
              }

              return { ...o, x: o.x + dx, y: o.y + dy };
            }

            if ((actual.tipo === "punta" || actual.tipo === "nueva-flecha") && m.tipo === "flecha") {
              return { ...m, x2: p.x, y2: p.y };
            }

            if (actual.tipo === "punta" && m.tipo === "zona") {
              return { ...m, rx: Math.max(0.5, Math.abs(p.x - m.x)), ry: Math.max(0.5, Math.abs(p.y - m.y)) };
            }

            if (actual.tipo === "linea" && m.tipo === "etiqueta") {
              return { ...m, a: m.a.map((q, i) => (i === actual.indice ? p : q)) };
            }

            return m;
          }),
        );

        setBorrador(ultimo);
      };

      const suelta = () => {
        window.removeEventListener("pointermove", mueve);
        window.removeEventListener("pointerup", suelta);
        window.removeEventListener("pointercancel", suelta);

        arrastre.current = null;

        guarda(ultimo);
      };

      /* En `window` y no en la marca: se suelta fuera del campo a menudo. */
      window.addEventListener("pointermove", mueve);
      window.addEventListener("pointerup", suelta);
      window.addEventListener("pointercancel", suelta);
    },
    [aLamina, cambiaMarcas, guarda],
  );

  /* --------------------- poner cosas en el campo --------------------- */

  const alPulsarCampo = (evento: React.PointerEvent) => {
    if (soloLectura) return;

    const p = aLamina(evento);

    if (herramienta === "mover") {
      setElegida(null);

      return;
    }

    if (herramienta === "linea") {
      if (marcaElegida?.tipo === "etiqueta") {
        guarda(
          cambiaMarcas(lamina, (marcas) =>
            marcas.map((m) => (m.id === marcaElegida.id && m.tipo === "etiqueta" ? { ...m, a: [...m.a, p] } : m)),
          ),
        );
      }

      return;
    }

    const id = nuevoIdAnalisis();

    let nueva: Marca;

    switch (herramienta) {
      case "cruz":
      case "balon":
        nueva = { id, tipo: herramienta, x: p.x, y: p.y, color };
        break;
      case "etiqueta":
        nueva = { id, tipo: "etiqueta", x: p.x, y: p.y, texto: "TEXTO", a: [] };
        break;
      case "flecha":
        nueva = { id, tipo: "flecha", x: p.x, y: p.y, x2: p.x, y2: p.y, color, discontinua: false };
        break;
      case "zona":
        nueva = { id, tipo: "zona", x: p.x, y: p.y, rx: 4, ry: 3, color };
        break;
    }

    const base = cambiaMarcas(lamina, (marcas) => [...marcas, nueva]);

    setElegida(id);

    if (herramienta === "flecha") {
      evento.preventDefault();
      setBorrador(base);
      empiezaArrastre({ tipo: "nueva-flecha", id }, base);

      return;
    }

    guarda(base);

    /* Un rótulo se escribe nada más ponerlo; lo demás se sigue poniendo. */
    if (herramienta === "etiqueta") setHerramienta("mover");
  };

  const alPulsarMarca = (evento: React.PointerEvent, marca: Marca) => {
    if (soloLectura) return;

    /* Con otra herramienta, pulsar encima de algo pone otra cosa encima. */
    if (herramienta !== "mover") return;

    evento.stopPropagation();
    evento.preventDefault();

    setElegida(marca.id);

    empiezaArrastre({ tipo: "marca", id: marca.id, desde: aLamina(evento), original: marca }, lamina);
  };

  /* ------------------------- fichas ------------------------- */

  const setJugadores = (jugadores: JugadorLamina[]) => guarda({ ...lamina, jugadores });

  const [candidato, setCandidato] = useState("");

  const disponibles = plantilla.filter((uno) => !lamina.jugadores.some((j) => j.clave === uno.clave));

  /* ------------------------- pintar ------------------------- */

  const marcasOrdenadas = [...vista.marcas].sort((a, b) => ordenPintado(a) - ordenPintado(b));

  const golpe = (marca: Marca) => {
    const c = aPx(marca);

    switch (marca.tipo) {
      case "cruz":
      case "balon":
        return <circle cx={c.x} cy={c.y} r={26} fill="transparent" />;
      case "etiqueta": {
        const w = anchoEtiqueta(marca.texto);

        return <rect x={c.x - w / 2} y={c.y - 24} width={w} height={48} fill="transparent" />;
      }
      case "flecha": {
        const b = aPx({ x: marca.x2, y: marca.y2 });

        return <line x1={c.x} y1={c.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={28} />;
      }
      case "zona": {
        const e = escalaEn(marca);

        return <ellipse cx={c.x} cy={c.y} rx={marca.rx * e.x} ry={marca.ry * e.y} fill="transparent" />;
      }
    }
  };

  const tiradores = (marca: Marca) => {
    const estilo = "cursor-grab fill-white stroke-[#0E1F5B]";

    if (marca.tipo === "flecha") {
      const b = aPx({ x: marca.x2, y: marca.y2 });

      return (
        <circle
          cx={b.x}
          cy={b.y}
          r={13}
          strokeWidth={4}
          className={estilo}
          onPointerDown={(e) => {
            e.stopPropagation();
            empiezaArrastre({ tipo: "punta", id: marca.id }, lamina);
          }}
        />
      );
    }

    if (marca.tipo === "zona") {
      const c = aPx(marca);
      const e = escalaEn(marca);

      return (
        <circle
          cx={c.x + marca.rx * e.x}
          cy={c.y + marca.ry * e.y}
          r={13}
          strokeWidth={4}
          className={estilo}
          onPointerDown={(e) => {
            e.stopPropagation();
            empiezaArrastre({ tipo: "punta", id: marca.id }, lamina);
          }}
        />
      );
    }

    if (marca.tipo === "etiqueta") {
      return marca.a.map((q, indice) => {
        const p = aPx(q);

        return (
          <circle
            key={indice}
            cx={p.x}
            cy={p.y}
            r={11}
            strokeWidth={4}
            className={estilo}
            onPointerDown={(e) => {
              e.stopPropagation();
              empiezaArrastre({ tipo: "linea", id: marca.id, indice }, lamina);
            }}
          />
        );
      });
    }

    return null;
  };

  const cursor = soloLectura ? "default" : herramienta === "mover" ? "default" : "crosshair";

  return (
    <div className="space-y-3">
      {!soloLectura && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
          {HERRAMIENTAS.map((uno) => (
            <button
              key={uno.id}
              type="button"
              onClick={() => setHerramienta(uno.id)}
              title={`${uno.nombre} (${uno.atajo})`}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition ${
                herramienta === uno.id
                  ? "bg-[#C8A96B] text-black"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              {uno.icono}
              {uno.nombre}
              <kbd className="hidden rounded bg-black/20 px-1 text-[9px] opacity-60 xl:inline">{uno.atajo}</kbd>
            </button>
          ))}

          <span className="mx-1 h-5 w-px bg-white/10" />

          {(Object.keys(COLORES) as ColorMarca[]).map((uno) => (
            <button
              key={uno}
              type="button"
              title={`${NOMBRE_COLOR[uno]} (${COLOR_POR_NUMERO.indexOf(uno) + 1})`}
              aria-label={NOMBRE_COLOR[uno]}
              onClick={() => {
                setColor(uno);

                /* Con algo elegido, el color se le cambia a eso. */
                if (marcaElegida && marcaElegida.tipo !== "etiqueta") {
                  guarda(
                    cambiaMarcas(lamina, (marcas) =>
                      marcas.map((m) => (m.id === marcaElegida.id && m.tipo !== "etiqueta" ? { ...m, color: uno } : m)),
                    ),
                  );
                }
              }}
              className={`h-6 w-6 rounded-full border-2 transition ${
                color === uno ? "scale-110 border-white" : "border-white/20"
              }`}
              style={{ background: COLORES[uno] }}
            />
          ))}

          <span className="mx-1 h-5 w-px bg-white/10" />

          <button
            type="button"
            onClick={deshaz}
            disabled={!pasado.length}
            title="Deshacer (Ctrl+Z)"
            aria-label="Deshacer"
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            onClick={rehaz}
            disabled={!futuro.length}
            title="Rehacer (Ctrl+Y)"
            aria-label="Rehacer"
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
          >
            <Redo2 size={15} />
          </button>
          <button
            type="button"
            onClick={duplica}
            disabled={!elegida}
            title="Duplicar lo elegido (Ctrl+D)"
            aria-label="Duplicar lo elegido"
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
          >
            <CopyPlus size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!lamina.marcas.length) return;

              guarda({ ...lamina, marcas: [] });
              setElegida(null);
            }}
            disabled={!lamina.marcas.length}
            title="Vaciar el campo (se puede deshacer)"
            aria-label="Vaciar el campo"
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
          >
            <Eraser size={15} />
          </button>

          <span className="ml-auto text-[11px] text-white/35">
            {herramienta === "mover"
              ? "Arrastra para mover · flechas para afinar · Supr borra · Ctrl+Z deshace"
              : herramienta === "flecha"
                ? "Pulsa y arrastra hasta donde acaba"
                : herramienta === "linea"
                  ? "Pulsa en el campo: cada clic añade una línea al rótulo"
                  : "Pulsa en el campo para ponerlo"}
          </span>
        </div>
      )}

      <div className="relative w-full overflow-hidden rounded-2xl border border-[#C8A96B]/25 bg-[#081524] shadow-[0_18px_44px_rgba(0,0,0,.45)]" style={{ aspectRatio: `${LAMINA_W} / ${LAMINA_H}` }}>
        <div
          className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: fondo }}
        />

        <svg
          ref={capa}
          viewBox={`0 0 ${LAMINA_W} ${LAMINA_H}`}
          className="absolute inset-0 h-full w-full touch-none select-none"
          style={{ cursor }}
        >
          <rect x={TABLERO.x} y={TABLERO.y} width={TABLERO.w} height={TABLERO.h} fill="transparent" onPointerDown={alPulsarCampo} />

          {marcasOrdenadas.map((marca) => (
            <g
              key={marca.id}
              onPointerDown={(e) => (herramienta === "mover" ? alPulsarMarca(e, marca) : alPulsarCampo(e))}
              style={{ cursor: herramienta === "mover" && !soloLectura ? "grab" : undefined }}
            >
              <g dangerouslySetInnerHTML={{ __html: marcaSvg(marca) }} />
              {golpe(marca)}
            </g>
          ))}

          {marcaElegida && !soloLectura && (
            <g>
              {(() => {
                const c = aPx(marcaElegida);
                const r =
                  marcaElegida.tipo === "etiqueta"
                    ? anchoEtiqueta(marcaElegida.texto) / 2 + 10
                    : marcaElegida.tipo === "zona"
                      ? Math.max(marcaElegida.rx * escalaEn(marcaElegida).x, marcaElegida.ry * escalaEn(marcaElegida).y) + 10
                      : 30;

                return (
                  <rect
                    x={c.x - r}
                    y={c.y - (marcaElegida.tipo === "etiqueta" ? 34 : r)}
                    width={r * 2}
                    height={marcaElegida.tipo === "etiqueta" ? 68 : r * 2}
                    fill="none"
                    stroke="#C8A96B"
                    strokeWidth={3}
                    strokeDasharray="10 6"
                    pointerEvents="none"
                  />
                );
              })()}
              {tiradores(marcaElegida)}
            </g>
          )}
        </svg>
      </div>

      {!soloLectura && marcaElegida && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/5 p-2 text-xs">
          <span className="text-white/50">Elegido:</span>

          {marcaElegida.tipo === "etiqueta" && (
            <>
              <input
                value={marcaElegida.texto}
                autoFocus
                onChange={(e) =>
                  guarda(
                    cambiaMarcas(lamina, (marcas) =>
                      marcas.map((m) => (m.id === marcaElegida.id ? { ...m, texto: e.target.value.toUpperCase() } : m)),
                    ),
                  )
                }
                className="w-40 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-white"
              />
              <button
                type="button"
                onClick={() => setHerramienta("linea")}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 ${herramienta === "linea" ? "bg-[#C8A96B] text-black" : "bg-white/10 text-white/80"}`}
              >
                <Plus size={13} /> Línea a un punto
              </button>
              {marcaElegida.a.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    guarda(
                      cambiaMarcas(lamina, (marcas) =>
                        marcas.map((m) => (m.id === marcaElegida.id && m.tipo === "etiqueta" ? { ...m, a: m.a.slice(0, -1) } : m)),
                      ),
                    )
                  }
                  className="rounded-lg bg-white/10 px-2 py-1 text-white/80"
                >
                  Quitar la última línea
                </button>
              )}
            </>
          )}

          {marcaElegida.tipo === "flecha" && (
            <label className="flex items-center gap-1.5 text-white/70">
              <input
                type="checkbox"
                checked={Boolean(marcaElegida.discontinua)}
                onChange={(e) =>
                  guarda(
                    cambiaMarcas(lamina, (marcas) =>
                      marcas.map((m) => (m.id === marcaElegida.id ? { ...m, discontinua: e.target.checked } : m)),
                    ),
                  )
                }
              />
              Discontinua
            </label>
          )}

          <button
            type="button"
            onClick={borra}
            className="ml-auto flex items-center gap-1 rounded-lg bg-red-500/15 px-2 py-1 text-red-300 hover:bg-red-500/25"
          >
            <Trash2 size={13} /> Borrar
          </button>
        </div>
      )}

      {!soloLectura && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <label className="block text-[11px] uppercase tracking-wider text-white/40">
              Título de la lámina
              <input
                value={lamina.titulo}
                onChange={(e) => guarda({ ...lamina, titulo: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm normal-case tracking-normal text-white"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              {(["rojo", "amarillo", "azul", "blanco"] as ColorMarca[]).map((uno) => (
                <label key={uno} className="flex items-center gap-2 text-[11px] text-white/50">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORES[uno] }} />
                  <input
                    value={lamina.leyenda?.[uno] ?? ""}
                    placeholder={`Leyenda ${NOMBRE_COLOR[uno].toLowerCase()}`}
                    onChange={(e) => guarda({ ...lamina, leyenda: { ...lamina.leyenda, [uno]: e.target.value.toUpperCase() } })}
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white"
                  />
                </label>
              ))}
            </div>

            <label className="block text-[11px] uppercase tracking-wider text-white/40">
              Consignas (una por línea; van a la lámina y al informe)
              <textarea
                value={lamina.notas ?? ""}
                rows={3}
                onChange={(e) => guarda({ ...lamina, notas: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm normal-case tracking-normal text-white"
              />
            </label>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <label className="block text-[11px] uppercase tracking-wider text-white/40">
              Rótulo de las fichas
              <input
                value={lamina.tituloJugadores ?? ""}
                placeholder="Sin rótulo"
                onChange={(e) => guarda({ ...lamina, tituloJugadores: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm normal-case tracking-normal text-white"
              />
            </label>

            <div className="space-y-1.5">
              {lamina.jugadores.map((jugador, i) => (
                <div key={jugador.clave || i} className="flex items-center gap-1.5">
                  <input
                    value={jugador.nombre}
                    title="Nombre en la ficha"
                    onChange={(e) =>
                      setJugadores(lamina.jugadores.map((j, k) => (k === i ? { ...j, nombre: e.target.value.toUpperCase() } : j)))
                    }
                    className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setJugadores(lamina.jugadores.map((j, k) => (k === i ? { ...j, dato: j.dato === "edad" ? "pie" : "edad" } : j)))
                    }
                    className="w-16 rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white/80"
                    title="Segundo dato de la ficha"
                  >
                    {jugador.dato === "edad" ? "Edad" : "Pie"}
                  </button>
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => {
                      const lista = [...lamina.jugadores];
                      [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]];
                      setJugadores(lista);
                    }}
                    className="rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white/70 disabled:opacity-30"
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => setJugadores(lamina.jugadores.filter((_, k) => k !== i))}
                    className="rounded-lg bg-red-500/15 px-2 py-1 text-red-300"
                    title="Quitar"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-1.5">
              <select
                value={candidato}
                onChange={(e) => setCandidato(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white"
              >
                <option value="">Añadir jugador…</option>
                {disponibles.map((uno) => (
                  <option key={uno.clave} value={uno.clave}>
                    {uno.nombre} · {uno.detalle}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!candidato}
                onClick={() => {
                  const uno = plantilla.find((p) => p.clave === candidato);

                  if (!uno) return;

                  setJugadores([
                    ...lamina.jugadores,
                    {
                      clave: uno.clave,
                      nombre: uno.nombre,
                      dato: lamina.seccion.startsWith("centros") ? "pie" : "edad",
                    },
                  ]);
                  setCandidato("");
                }}
                className="flex items-center gap-1 rounded-lg bg-[#C8A96B] px-2.5 py-1.5 text-xs font-medium text-black disabled:opacity-40"
              >
                <Plus size={13} /> Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
