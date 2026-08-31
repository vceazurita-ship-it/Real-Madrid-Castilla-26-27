"use client";

/*
|--------------------------------------------------------------------------
| EL INFORME, ANTES DE EXPORTARLO
|--------------------------------------------------------------------------
|
| Se abre al pulsar «INFORME» en `/rivals`. El documento ya está montado con
| los datos de BeSoccer —lo hace `lib/rivals/informe-ppt.ts`— y aquí se le da
| el último repaso: mover un panel, estirar el campo, replicar una ficha,
| borrar los ocho equipos de la tabla que no vienen a cuento, escribir una nota
| encima.
|
| Cada pieza de la hoja es una imagen suelta (`informe-elementos.ts`), así que
| lo que se toca aquí es exactamente lo que sale en el `.pptx`: allí cada pieza
| es **un objeto propio de PowerPoint**, con su nombre en el panel de selección,
| y se sigue moviendo y borrando en Office.
|
| Lo que se puede hacer, y cómo:
|
|   · arrastrar con el ratón; con `Mayús`, sólo en horizontal o en vertical,
|   · estirar por cualquiera de las ocho asas; con `Mayús`, sin deformar,
|   · seleccionar varias con `Mayús`/`Ctrl` o con un lazo sobre el papel,
|   · `Ctrl+D` replicar, `Supr` borrar, flechas para afinar (con `Mayús`, ×10),
|   · `Ctrl+Z` y `Ctrl+Y`, que es lo primero que busca cualquiera,
|   · `Alt`+clic para ir bajando por las piezas apiladas en un mismo sitio.
|
| Las miniaturas de la izquierda enseñan sólo el papel de cada hoja, no las
| piezas: pintar las diez hojas enteras a la vez son varios cientos de imágenes
| en pantalla y el editor se arrastraba. El detalle se ve al abrir la hoja, que
| es donde se trabaja.
*/

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  Undo2,
  Redo2,
  X,
} from "lucide-react";

import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";

import {
  LIENZO_H,
  LIENZO_W,
  type ElementoInforme,
  type HojaInforme,
} from "@/lib/rivals/informe-elementos";

import { piezaDeTexto } from "@/lib/rivals/informe-ppt";

interface InformePptEditorProps {
  equipo: string;
  hojas: HojaInforme[];
  exportando: boolean;
  onExportar: (hojas: HojaInforme[]) => void;
  onCerrar: () => void;
}

/** Lo que hay que mover el dedo para que esto sea un arrastre y no un clic. */
const UMBRAL = 3;

/** Cuántos pasos de deshacer se guardan. */
const HISTORIAL = 40;

/** Las ocho asas, con lo que tocan de la caja. */
const ASAS = [
  { id: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { id: "n", x: 0.5, y: 0, cursor: "ns-resize" },
  { id: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { id: "e", x: 1, y: 0.5, cursor: "ew-resize" },
  { id: "se", x: 1, y: 1, cursor: "nwse-resize" },
  { id: "s", x: 0.5, y: 1, cursor: "ns-resize" },
  { id: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { id: "w", x: 0, y: 0.5, cursor: "ew-resize" },
] as const;

type Asa = (typeof ASAS)[number]["id"];

/** Lo que dura un arrastre, sea de mover, de estirar o de lazo. */
type Gesto =
  | {
      tipo: "mover";
      x0: number;
      y0: number;
      origen: Map<string, { x: number; y: number }>;
    }
  | {
      tipo: "estirar";
      asa: Asa;
      x0: number;
      y0: number;
      caja: { x: number; y: number; w: number; h: number };
    }
  | { tipo: "lazo"; x0: number; y0: number; x1: number; y1: number };

export default function InformePptEditor({
  equipo,
  hojas: hojasIniciales,
  exportando,
  onExportar,
  onCerrar,
}: InformePptEditorProps) {
  useBodyScrollLock(true);

  const [hojas, setHojas] = useState<HojaInforme[]>(hojasIniciales);

  const [activa, setActiva] = useState(0);

  const [seleccion, setSeleccion] = useState<string[]>([]);

  const [pasado, setPasado] = useState<HojaInforme[][]>([]);

  const [futuro, setFuturo] = useState<HojaInforme[][]>([]);

  const [zoom, setZoom] = useState(0);

  const [gesto, setGesto] = useState<Gesto | null>(null);

  const [anadiendoTexto, setAnadiendoTexto] = useState(false);

  const lienzoRef = useRef<HTMLDivElement | null>(null);

  const marcoRef = useRef<HTMLDivElement | null>(null);

  /** Numera lo que se crea aquí —copias y notas— sin repetir nunca. */
  const siguienteId = useRef(1);

  const hoja = hojas[activa];

  /* ---------------------------------------------------------------- */
  /*  ESCALA                                                           */
  /* ---------------------------------------------------------------- */

  /*
  | La hoja se pinta a 1920×1080 de verdad y se encoge con `transform`, así que
  | por dentro se razona siempre en píxeles del documento: lo que se arrastra
  | son las mismas coordenadas que acaban en el `.pptx`.
  */
  const [ancho, setAncho] = useState(960);

  useEffect(() => {
    const marco = marcoRef.current;

    if (!marco) return;

    const mide = () => setAncho(marco.clientWidth);

    mide();

    const observador = new ResizeObserver(mide);

    observador.observe(marco);

    return () => observador.disconnect();
  }, []);

  const escala = useMemo(() => {
    const cabe = Math.max(0.1, (ancho - 24) / LIENZO_W);

    return zoom === 0 ? cabe : cabe * zoom;
  }, [ancho, zoom]);

  /* ---------------------------------------------------------------- */
  /*  CAMBIOS E HISTORIAL                                              */
  /* ---------------------------------------------------------------- */

  /*
  | Lo que hay ahora, en una referencia.
  |
  | El arrastre lo lee desde un escuchador de `window` que se suscribe una sola
  | vez: si dependiera del estado, el efecto se volvería a montar en cada
  | movimiento del ratón —y con él la marca de «ya he apuntado este arrastre en
  | el historial», que es lo que dejaba cuarenta pasos de deshacer para un solo
  | arrastre—.
  */
  const hojasRef = useRef(hojas);

  useEffect(() => {
    hojasRef.current = hojas;
  }, [hojas]);

  const empuja = useCallback(() => {
    setPasado((previo) => [...previo, hojasRef.current].slice(-HISTORIAL));
    setFuturo([]);
  }, []);

  /** Cambia las piezas de la hoja abierta. `marca` apunta el paso de deshacer. */
  const cambia = useCallback(
    (
      transforma: (elementos: ElementoInforme[]) => ElementoInforme[],
      marca = true,
    ) => {
      if (marca) empuja();

      setHojas((previas) =>
        previas.map((una, indice) =>
          indice === activa
            ? { ...una, elementos: transforma(una.elementos) }
            : una,
        ),
      );
    },
    [activa, empuja],
  );

  /* Los tres estados se tocan por fuera de los `set…`: cambiarlos dentro del
     actualizador de otro los duplicaría en modo estricto. */
  const deshacer = useCallback(() => {
    if (pasado.length === 0) return;

    setHojas(pasado[pasado.length - 1]);
    setPasado((previo) => previo.slice(0, -1));
    setFuturo((siguiente) => [hojas, ...siguiente].slice(0, HISTORIAL));
  }, [hojas, pasado]);

  const rehacer = useCallback(() => {
    if (futuro.length === 0) return;

    setHojas(futuro[0]);
    setFuturo((siguiente) => siguiente.slice(1));
    setPasado((previo) => [...previo, hojas].slice(-HISTORIAL));
  }, [futuro, hojas]);

  /* ---------------------------------------------------------------- */
  /*  ACCIONES SOBRE LA SELECCIÓN                                      */
  /* ---------------------------------------------------------------- */

  const elegidos = useMemo(
    () => (hoja?.elementos ?? []).filter((uno) => seleccion.includes(uno.id)),
    [hoja, seleccion],
  );

  const unico = elegidos.length === 1 ? elegidos[0] : null;

  const borra = useCallback(() => {
    if (seleccion.length === 0) return;

    cambia((elementos) =>
      elementos.filter((uno) => !seleccion.includes(uno.id)),
    );

    setSeleccion([]);
  }, [cambia, seleccion]);

  const replica = useCallback(() => {
    if (seleccion.length === 0) return;

    const nuevos: string[] = [];

    cambia((elementos) => {
      const copias = elementos
        .filter((uno) => seleccion.includes(uno.id))
        .map((uno) => {
          /*
          | Un id que no choque ni con los del guion ni con otras copias. El
          | contador no se reinicia al borrar: numerando por el tamaño de la
          | hoja, replicar-borrar-replicar repetía el id y React se quedaba con
          | dos piezas con la misma llave.
          */
          const id = `${uno.id}-copia${siguienteId.current++}`;

          nuevos.push(id);

          /* Desplazada, para que se vea que hay dos y se pueda agarrar la de
             arriba sin cazar la de debajo. */
          return { ...uno, id, x: uno.x + 20, y: uno.y + 20 };
        });

      return [...elementos, ...copias];
    });

    setSeleccion(nuevos);
  }, [cambia, seleccion]);

  const mueveSeleccion = useCallback(
    (dx: number, dy: number) => {
      if (seleccion.length === 0) return;

      cambia((elementos) =>
        elementos.map((uno) =>
          seleccion.includes(uno.id)
            ? { ...uno, x: uno.x + dx, y: uno.y + dy }
            : uno,
        ),
      );
    },
    [cambia, seleccion],
  );

  /** Sube o baja las piezas elegidas en la pila de la hoja. */
  const ordena = useCallback(
    (haciaArriba: boolean) => {
      if (seleccion.length === 0) return;

      cambia((elementos) => {
        const dentro = elementos.filter((uno) => seleccion.includes(uno.id));
        const fuera = elementos.filter((uno) => !seleccion.includes(uno.id));

        return haciaArriba ? [...fuera, ...dentro] : [...dentro, ...fuera];
      });
    },
    [cambia, seleccion],
  );

  const restauraHoja = useCallback(() => {
    empuja();

    setHojas((previas) =>
      previas.map((una, indice) =>
        indice === activa ? hojasIniciales[indice] ?? una : una,
      ),
    );

    setSeleccion([]);
  }, [activa, empuja, hojasIniciales]);

  /* ---------------------------------------------------------------- */
  /*  UNA NOTA ESCRITA A MANO                                          */
  /* ---------------------------------------------------------------- */

  /*
  | Lo único que se puede *escribir* aquí. El resto de las piezas ya vienen
  | pintadas y no se rehacen: cambiarle el texto a la tabla de clasificación
  | sería inventarse un dato, y para eso está la hoja de cálculo.
  */
  const anadeTexto = useCallback(async () => {
    setAnadiendoTexto(true);

    try {
      const pieza = await piezaDeTexto("ESCRIBE AQUÍ", {
        id: `nota-${activa + 1}-${siguienteId.current++}`,
        x: 120,
        y: LIENZO_H / 2 - 40,
      });

      cambia((elementos) => [...elementos, pieza]);

      setSeleccion([pieza.id]);
    } finally {
      setAnadiendoTexto(false);
    }
  }, [activa, cambia]);

  const reescribe = useCallback(
    async (elemento: ElementoInforme, contenido: string) => {
      if (!elemento.texto) return;

      const pieza = await piezaDeTexto(contenido, {
        id: elemento.id,
        x: elemento.x,
        y: elemento.y,
        ...elemento.texto,
      });

      cambia((elementos) =>
        elementos.map((uno) =>
          uno.id === elemento.id
            ? { ...pieza, opacidad: uno.opacidad, nombre: pieza.nombre }
            : uno,
        ),
      );
    },
    [cambia],
  );

  /* ---------------------------------------------------------------- */
  /*  TECLADO                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const enTecla = (evento: KeyboardEvent) => {
      const destino = evento.target as HTMLElement | null;

      /* Si se está escribiendo en un campo, las teclas son suyas. */
      if (
        destino &&
        (destino.tagName === "INPUT" ||
          destino.tagName === "TEXTAREA" ||
          destino.isContentEditable)
      ) {
        return;
      }

      const mando = evento.ctrlKey || evento.metaKey;

      if (evento.key === "Escape") {
        evento.preventDefault();

        if (seleccion.length > 0) setSeleccion([]);
        else onCerrar();

        return;
      }

      if (mando && evento.key.toLowerCase() === "z") {
        evento.preventDefault();

        if (evento.shiftKey) rehacer();
        else deshacer();

        return;
      }

      if (mando && evento.key.toLowerCase() === "y") {
        evento.preventDefault();
        rehacer();

        return;
      }

      if (mando && evento.key.toLowerCase() === "d") {
        evento.preventDefault();
        replica();

        return;
      }

      if (mando && evento.key.toLowerCase() === "a") {
        evento.preventDefault();
        setSeleccion((hoja?.elementos ?? []).map((uno) => uno.id));

        return;
      }

      if (evento.key === "Delete" || evento.key === "Backspace") {
        evento.preventDefault();
        borra();

        return;
      }

      const paso = evento.shiftKey ? 10 : 1;

      const flechas: Record<string, [number, number]> = {
        ArrowLeft: [-paso, 0],
        ArrowRight: [paso, 0],
        ArrowUp: [0, -paso],
        ArrowDown: [0, paso],
      };

      const salto = flechas[evento.key];

      if (salto) {
        evento.preventDefault();
        mueveSeleccion(salto[0], salto[1]);
      }
    };

    window.addEventListener("keydown", enTecla);

    return () => window.removeEventListener("keydown", enTecla);
  }, [
    borra,
    deshacer,
    hoja,
    mueveSeleccion,
    onCerrar,
    rehacer,
    replica,
    seleccion,
  ]);

  /* ---------------------------------------------------------------- */
  /*  RATÓN                                                            */
  /* ---------------------------------------------------------------- */

  /*
  | El arrastre se escucha en `window` y **se suscribe una sola vez**. Todo lo
  | que necesita saber va en referencias.
  |
  | Escuchándolo con dependencias, el efecto se desmontaba y se volvía a montar
  | en cada movimiento del ratón —el estado cambia en cada píxel— y con él se
  | perdía la marca de «este arrastre ya está apuntado en el historial»: mover
  | una pieza dejaba cuarenta pasos de deshacer y había que pulsar `Ctrl+Z`
  | cuarenta veces para volver a donde estaba.
  */
  const gestoRef = useRef<Gesto | null>(null);

  const marcadoRef = useRef(false);

  const escalaRef = useRef(escala);

  const activaRef = useRef(activa);

  const unicoRef = useRef<string | null>(null);

  const elementosRef = useRef<ElementoInforme[]>([]);

  useEffect(() => {
    escalaRef.current = escala;
  }, [escala]);

  useEffect(() => {
    activaRef.current = activa;
  }, [activa]);

  useEffect(() => {
    unicoRef.current = unico?.id ?? null;
  }, [unico]);

  useEffect(() => {
    elementosRef.current = hoja?.elementos ?? [];
  }, [hoja]);

  /** Arranca un gesto: al estado, para pintarlo, y a la referencia, para leerlo. */
  const arranca = useCallback((nuevo: Gesto | null) => {
    gestoRef.current = nuevo;
    marcadoRef.current = false;

    setGesto(nuevo);
  }, []);

  /** De la pantalla a los píxeles del documento. */
  const enHoja = useCallback(
    (evento: { clientX: number; clientY: number }) => {
      const caja = lienzoRef.current?.getBoundingClientRect();

      if (!caja) return { x: 0, y: 0 };

      return {
        x: (evento.clientX - caja.left) / escalaRef.current,
        y: (evento.clientY - caja.top) / escalaRef.current,
      };
    },
    [],
  );

  const empiezaMover = useCallback(
    (evento: ReactPointerEvent, elemento: ElementoInforme) => {
      evento.stopPropagation();

      const punto = enHoja(evento);

      let ahora = seleccion;

      if (evento.altKey) {
        /*
        | Alt va bajando por lo que hay debajo del cursor: en un panel con su
        | cinta y su título encima, es la única forma de agarrar el marco.
        */
        const debajo = (hoja?.elementos ?? []).filter(
          (uno) =>
            punto.x >= uno.x &&
            punto.x <= uno.x + uno.w &&
            punto.y >= uno.y &&
            punto.y <= uno.y + uno.h,
        );

        if (debajo.length > 0) {
          const donde = debajo.findIndex((uno) => seleccion.includes(uno.id));

          const siguiente =
            debajo[(donde - 1 + debajo.length) % debajo.length] ??
            debajo[debajo.length - 1];

          ahora = [siguiente.id];
        }
      } else if (evento.shiftKey || evento.ctrlKey || evento.metaKey) {
        ahora = seleccion.includes(elemento.id)
          ? seleccion.filter((id) => id !== elemento.id)
          : [...seleccion, elemento.id];
      } else if (!seleccion.includes(elemento.id)) {
        ahora = [elemento.id];
      }

      setSeleccion(ahora);

      const origen = new Map<string, { x: number; y: number }>();

      for (const uno of hoja?.elementos ?? []) {
        if (ahora.includes(uno.id)) origen.set(uno.id, { x: uno.x, y: uno.y });
      }

      arranca({ tipo: "mover", x0: punto.x, y0: punto.y, origen });
    },
    [arranca, enHoja, hoja, seleccion],
  );

  const empiezaEstirar = useCallback(
    (evento: ReactPointerEvent, asa: Asa) => {
      evento.stopPropagation();

      if (!unico) return;

      const punto = enHoja(evento);

      arranca({
        tipo: "estirar",
        asa,
        x0: punto.x,
        y0: punto.y,
        caja: { x: unico.x, y: unico.y, w: unico.w, h: unico.h },
      });
    },
    [arranca, enHoja, unico],
  );

  const empiezaLazo = useCallback(
    (evento: ReactPointerEvent) => {
      const punto = enHoja(evento);

      if (!evento.shiftKey && !evento.ctrlKey && !evento.metaKey) {
        setSeleccion([]);
      }

      arranca({ tipo: "lazo", x0: punto.x, y0: punto.y, x1: punto.x, y1: punto.y });
    },
    [arranca, enHoja],
  );

  useEffect(() => {
    /** El primer movimiento del arrastre apunta el paso de deshacer. Uno solo. */
    const marca = () => {
      if (marcadoRef.current) return;

      marcadoRef.current = true;
      empuja();
    };

    /** Cambia las piezas de la hoja abierta sin pasar por el historial. */
    const toca = (
      transforma: (elementos: ElementoInforme[]) => ElementoInforme[],
    ) =>
      setHojas((previas) =>
        previas.map((una, indice) =>
          indice === activaRef.current
            ? { ...una, elementos: transforma(una.elementos) }
            : una,
        ),
      );

    const enMover = (evento: PointerEvent) => {
      const gesto = gestoRef.current;

      if (!gesto) return;

      const punto = enHoja(evento);

      if (gesto.tipo === "mover") {
        let dx = punto.x - gesto.x0;
        let dy = punto.y - gesto.y0;

        /* Por debajo del umbral esto es un clic con pulso, no un arrastre. */
        if (!marcadoRef.current && Math.abs(dx) < UMBRAL && Math.abs(dy) < UMBRAL) {
          return;
        }

        /* Mayús deja el arrastre en un solo eje, que es como se alinean dos
           fichas sin volverse loco. */
        if (evento.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }

        marca();

        toca((elementos) =>
          elementos.map((uno) => {
            const desde = gesto.origen.get(uno.id);

            return desde ? { ...uno, x: desde.x + dx, y: desde.y + dy } : uno;
          }),
        );

        return;
      }

      if (gesto.tipo === "estirar") {
        const dx = punto.x - gesto.x0;
        const dy = punto.y - gesto.y0;

        const caja = { ...gesto.caja };

        const tira = gesto.asa;

        if (tira.includes("e")) caja.w = gesto.caja.w + dx;

        if (tira.includes("s")) caja.h = gesto.caja.h + dy;

        if (tira.includes("w")) {
          caja.x = gesto.caja.x + dx;
          caja.w = gesto.caja.w - dx;
        }

        if (tira.includes("n")) {
          caja.y = gesto.caja.y + dy;
          caja.h = gesto.caja.h - dy;
        }

        /* Sin Mayús se deforma; con Mayús se respeta la proporción, que es lo
           que hace falta en una foto o en un escudo. */
        if (evento.shiftKey && gesto.caja.w > 0 && gesto.caja.h > 0) {
          const razon = gesto.caja.h / gesto.caja.w;

          const alto = Math.max(8, Math.abs(caja.w) * razon);

          if (tira.includes("n")) caja.y = gesto.caja.y + gesto.caja.h - alto;

          caja.h = alto;
        }

        if (caja.w < 8 || caja.h < 8) return;

        marca();

        const quien = unicoRef.current;

        toca((elementos) =>
          elementos.map((uno) => (uno.id === quien ? { ...uno, ...caja } : uno)),
        );

        return;
      }

      const estirado = { ...gesto, x1: punto.x, y1: punto.y };

      gestoRef.current = estirado;

      setGesto(estirado);
    };

    const enSoltar = () => {
      const gesto = gestoRef.current;

      if (gesto?.tipo === "lazo") {
        const x0 = Math.min(gesto.x0, gesto.x1);
        const x1 = Math.max(gesto.x0, gesto.x1);
        const y0 = Math.min(gesto.y0, gesto.y1);
        const y1 = Math.max(gesto.y0, gesto.y1);

        if (x1 - x0 > 6 && y1 - y0 > 6) {
          const dentro = elementosRef.current
            .filter(
              (uno) =>
                uno.x + uno.w > x0 &&
                uno.x < x1 &&
                uno.y + uno.h > y0 &&
                uno.y < y1,
            )
            .map((uno) => uno.id);

          setSeleccion((previa) => [...new Set([...previa, ...dentro])]);
        }
      }

      if (gesto) arranca(null);
    };

    window.addEventListener("pointermove", enMover);
    window.addEventListener("pointerup", enSoltar);

    return () => {
      window.removeEventListener("pointermove", enMover);
      window.removeEventListener("pointerup", enSoltar);
    };
  }, [arranca, empuja, enHoja]);


  /* ---------------------------------------------------------------- */
  /*  CAMPOS DE LA PIEZA                                               */
  /* ---------------------------------------------------------------- */

  const ajusta = useCallback(
    (clave: "x" | "y" | "w" | "h" | "opacidad", valor: number) => {
      if (!unico) return;

      cambia((elementos) =>
        elementos.map((uno) =>
          uno.id === unico.id ? { ...uno, [clave]: valor } : uno,
        ),
      );
    },
    [cambia, unico],
  );

  if (!hoja) return null;

  const piezas = hoja.elementos;

  const lazo =
    gesto?.tipo === "lazo"
      ? {
          left: Math.min(gesto.x0, gesto.x1),
          top: Math.min(gesto.y0, gesto.y1),
          width: Math.abs(gesto.x1 - gesto.x0),
          height: Math.abs(gesto.y1 - gesto.y0),
        }
      : null;

  const estiloLienzo: CSSProperties = {
    width: LIENZO_W,
    height: LIENZO_H,
    transform: `scale(${escala})`,
    transformOrigin: "top left",
  };

  return (
    <div
      className="modal-veil fixed inset-0 z-[80] flex items-center justify-center p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Informe del rival antes de exportar"
    >
      <div className="flex h-[96vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11161D] shadow-2xl">
        {/* ---------------- CABECERA ---------------- */}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
              INFORME DEL RIVAL
              {equipo && (
                <span className="ml-2 normal-case tracking-normal text-white/30">
                  · {equipo}
                </span>
              )}
            </h2>

            <p className="mt-1 text-[11px] text-white/40">
              Arrastra, estira, replica o borra cualquier pieza. Al exportar,
              cada una es un objeto suelto de PowerPoint.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <BotonBarra
              titulo="Deshacer (Ctrl+Z)"
              onClick={deshacer}
              inactivo={pasado.length === 0}
            >
              <Undo2 size={13} />
            </BotonBarra>

            <BotonBarra
              titulo="Rehacer (Ctrl+Y)"
              onClick={rehacer}
              inactivo={futuro.length === 0}
            >
              <Redo2 size={13} />
            </BotonBarra>

            <BotonBarra
              titulo="Replicar (Ctrl+D)"
              onClick={replica}
              inactivo={seleccion.length === 0}
            >
              <Copy size={13} />
            </BotonBarra>

            <BotonBarra
              titulo="Borrar (Supr)"
              onClick={borra}
              inactivo={seleccion.length === 0}
            >
              <Trash2 size={13} />
            </BotonBarra>

            <BotonBarra
              titulo="Escribir una nota encima"
              onClick={() => void anadeTexto()}
              inactivo={anadiendoTexto}
            >
              {anadiendoTexto ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Type size={13} />
              )}
            </BotonBarra>

            <BotonBarra titulo="Dejar la hoja como estaba" onClick={restauraHoja}>
              <RotateCcw size={13} />
            </BotonBarra>

            <span className="mx-1 h-5 w-px bg-white/10" />

            <BotonBarra
              titulo="Alejar"
              onClick={() => setZoom((previo) => Math.max(0.5, (previo || 1) - 0.25))}
            >
              <Minus size={13} />
            </BotonBarra>

            <button
              type="button"
              onClick={() => setZoom(0)}
              title="Ajustar a la ventana"
              className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/50 transition hover:border-white/30 hover:text-white"
            >
              {Math.round(escala * 100)}%
            </button>

            <BotonBarra
              titulo="Acercar"
              onClick={() => setZoom((previo) => Math.min(3, (previo || 1) + 0.25))}
            >
              <Plus size={13} />
            </BotonBarra>

            <span className="mx-1 h-5 w-px bg-white/10" />

            <button
              type="button"
              onClick={() => onExportar(hojas)}
              disabled={exportando}
              className="flex items-center gap-1.5 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#C8A96B] transition hover:bg-[#C8A96B]/25 disabled:opacity-50"
            >
              {exportando ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              Exportar .pptx
            </button>

            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="rounded-full border border-white/10 p-2 text-white/40 transition hover:border-white/30 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ---------------- CUERPO ---------------- */}

        <div className="flex min-h-0 flex-1">
          {/* -------- HOJAS -------- */}

          <div className="hidden w-[150px] shrink-0 overflow-y-auto border-r border-white/10 p-2 md:block">
            {hojas.map((una, indice) => (
              <button
                key={una.id}
                type="button"
                onClick={() => {
                  setActiva(indice);
                  setSeleccion([]);
                }}
                className={`mb-2 block w-full overflow-hidden rounded-lg border text-left transition ${
                  indice === activa
                    ? "border-[#C8A96B] ring-1 ring-[#C8A96B]/40"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={una.fondo}
                  alt=""
                  className="block w-full"
                  draggable={false}
                />

                <span className="block truncate px-2 py-1 text-[10px] text-white/50">
                  {indice + 1}. {una.titulo}
                </span>

                <span className="block px-2 pb-1 text-[9px] text-white/25">
                  {una.elementos.length} piezas
                </span>
              </button>
            ))}
          </div>

          {/* -------- LIENZO -------- */}

          <div
            ref={marcoRef}
            className="min-w-0 flex-1 overflow-auto bg-[#070A0E] p-3"
          >
            <div
              style={{
                width: LIENZO_W * escala,
                height: LIENZO_H * escala,
              }}
              className="relative mx-auto"
            >
              <div
                ref={lienzoRef}
                style={estiloLienzo}
                className="relative select-none overflow-hidden shadow-2xl"
                onPointerDown={empiezaLazo}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hoja.fondo}
                  alt=""
                  width={LIENZO_W}
                  height={LIENZO_H}
                  className="pointer-events-none absolute inset-0 block"
                  draggable={false}
                />

                {piezas.map((pieza) => {
                  const elegida = seleccion.includes(pieza.id);

                  return (
                    <div
                      key={pieza.id}
                      title={pieza.nombre}
                      onPointerDown={(evento) => empiezaMover(evento, pieza)}
                      style={{
                        left: pieza.x,
                        top: pieza.y,
                        width: pieza.w,
                        height: pieza.h,
                        opacity: pieza.opacidad ?? 1,
                      }}
                      className={`absolute cursor-move ${
                        elegida
                          ? "outline outline-[3px] outline-[#C8A96B]"
                          : "hover:outline hover:outline-1 hover:outline-white/40"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pieza.imagen}
                        alt={pieza.nombre}
                        className="pointer-events-none block h-full w-full"
                        draggable={false}
                      />
                    </div>
                  );
                })}

                {/* Las asas, sólo cuando hay una pieza sola elegida. */}
                {unico &&
                  ASAS.map((asa) => (
                    <div
                      key={asa.id}
                      onPointerDown={(evento) => empiezaEstirar(evento, asa.id)}
                      style={{
                        left: unico.x + unico.w * asa.x,
                        top: unico.y + unico.h * asa.y,
                        cursor: asa.cursor,
                        width: 16 / escala,
                        height: 16 / escala,
                        marginLeft: -8 / escala,
                        marginTop: -8 / escala,
                      }}
                      className="absolute rounded-sm border-2 border-[#C8A96B] bg-white"
                    />
                  ))}

                {lazo && (
                  <div
                    style={lazo}
                    className="pointer-events-none absolute border border-dashed border-[#C8A96B] bg-[#C8A96B]/10"
                  />
                )}
              </div>
            </div>
          </div>

          {/* -------- PIEZAS -------- */}

          <div className="hidden w-[260px] shrink-0 flex-col border-l border-white/10 lg:flex">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Piezas de la hoja
              </span>

              <div className="flex gap-1">
                <BotonBarra
                  titulo="Traer al frente"
                  onClick={() => ordena(true)}
                  inactivo={seleccion.length === 0}
                >
                  <ChevronUp size={12} />
                </BotonBarra>

                <BotonBarra
                  titulo="Enviar al fondo"
                  onClick={() => ordena(false)}
                  inactivo={seleccion.length === 0}
                >
                  <ChevronDown size={12} />
                </BotonBarra>
              </div>
            </div>

            {/* Los números de la pieza elegida, para cuadrar al píxel. */}
            {unico && (
              <div className="border-b border-white/10 p-3">
                <p className="mb-2 truncate text-[11px] font-semibold text-white/70">
                  {unico.nombre}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Numero
                    rotulo="X"
                    valor={unico.x}
                    onCambio={(valor) => ajusta("x", valor)}
                  />
                  <Numero
                    rotulo="Y"
                    valor={unico.y}
                    onCambio={(valor) => ajusta("y", valor)}
                  />
                  <Numero
                    rotulo="Ancho"
                    valor={unico.w}
                    onCambio={(valor) => ajusta("w", Math.max(8, valor))}
                  />
                  <Numero
                    rotulo="Alto"
                    valor={unico.h}
                    onCambio={(valor) => ajusta("h", Math.max(8, valor))}
                  />
                </div>

                <label className="mt-3 block text-[10px] uppercase tracking-widest text-white/35">
                  Opacidad
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={Math.round((unico.opacidad ?? 1) * 100)}
                    onChange={(evento) =>
                      ajusta("opacidad", Number(evento.target.value) / 100)
                    }
                    className="mt-1 w-full accent-[#C8A96B]"
                  />
                </label>

                {unico.texto && (
                  <label className="mt-3 block text-[10px] uppercase tracking-widest text-white/35">
                    Texto
                    <input
                      type="text"
                      defaultValue={unico.texto.contenido}
                      onBlur={(evento) =>
                        void reescribe(unico, evento.target.value)
                      }
                      className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs normal-case tracking-normal text-white"
                    />
                  </label>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {piezas
                .slice()
                .reverse()
                .map((pieza) => (
                  <button
                    key={pieza.id}
                    type="button"
                    onClick={(evento) =>
                      setSeleccion((previa) =>
                        evento.shiftKey || evento.ctrlKey || evento.metaKey
                          ? previa.includes(pieza.id)
                            ? previa.filter((id) => id !== pieza.id)
                            : [...previa, pieza.id]
                          : [pieza.id],
                      )
                    }
                    className={`block w-full truncate rounded px-2 py-1 text-left text-[11px] transition ${
                      seleccion.includes(pieza.id)
                        ? "bg-[#C8A96B]/20 text-[#C8A96B]"
                        : "text-white/45 hover:bg-white/5 hover:text-white/80"
                    }`}
                  >
                    {pieza.nombre}
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PIEZAS DE LA INTERFAZ                                              */
/* ------------------------------------------------------------------ */

function BotonBarra({
  titulo,
  onClick,
  inactivo,
  children,
}: {
  titulo: string;
  onClick: () => void;
  inactivo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={inactivo}
      className="rounded-full border border-white/10 p-1.5 text-white/50 transition hover:border-white/30 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Numero({
  rotulo,
  valor,
  onCambio,
}: {
  rotulo: string;
  valor: number;
  onCambio: (valor: number) => void;
}) {
  return (
    <label className="block text-[10px] uppercase tracking-widest text-white/35">
      {rotulo}
      <input
        type="number"
        value={Math.round(valor)}
        onChange={(evento) => onCambio(Number(evento.target.value) || 0)}
        className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
      />
    </label>
  );
}
