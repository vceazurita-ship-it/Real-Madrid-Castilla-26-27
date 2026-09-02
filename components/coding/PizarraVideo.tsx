"use client";

/**
 * LA PIZARRA DE VÍDEO.
 *
 * La capa que va encima del `<video>` del coding y donde se pinta el análisis:
 * focos, aros de televisión, flechas, zonas, jugadores movidos a donde tenían
 * que estar. El motor —el modelo y todo lo que se pinta— está en
 * `lib/coding/telestracion.ts`; aquí sólo vive lo que necesita ratón y teclado.
 *
 * Cuatro cosas que explican cómo está montado:
 *
 * **El lienzo se pega a la imagen, no al hueco del vídeo.** Un `<video>` con
 * `object-fit: contain` deja franjas negras cuando el partido no es 16:9, y un
 * lienzo estirado sobre la etiqueta entera dejaría las flechas desplazadas
 * medio metro. Se mide el rectángulo de imagen de verdad (`useEncaje`) y el
 * lienzo se coloca justo ahí.
 *
 * **Ver y pintar son dos componentes.** `CapaVista` sólo enseña lo pintado
 * mientras el partido corre; `EditorPizarra` es el que tiene herramientas. Y el
 * editor lleva `key={escena.id}`: al cambiar de pizarra se monta uno nuevo, con
 * su copia de trabajo recién sacada de la sesión. Así no hace falta ningún
 * efecto que copie props a estado —que además el linter no deja—, y no puede
 * quedarse editando la pizarra de antes.
 *
 * **Mientras se dibuja, la escena vive en el editor.** Cada movimiento del
 * ratón que fuera al documento de la sesión repintaría la pantalla entera del
 * coding sesenta veces por segundo. La copia local sólo sube al documento al
 * soltar el botón: lo que se guarda es el resultado, no el temblor de la mano.
 *
 * **Se pinta con `requestAnimationFrame`, no con el estado de React.** Las
 * flechas que se trazan solas y el jugador que viaja hasta su sitio dependen
 * del reloj del vídeo, que avanza entre renders. El bucle lee el tiempo del
 * elemento directamente y repinta.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent as EventoRaton,
  type PointerEvent as EventoPuntero,
} from "react";
import {
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Copy,
  Droplet,
  Eraser,
  Flag,
  Layers,
  Lightbulb,
  Maximize2,
  Minus,
  MousePointer2,
  Move,
  PenTool,
  Pencil,
  Pentagon,
  Ruler,
  Snowflake,
  Square,
  Trash2,
  Type,
  Undo2,
  Users,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";

import {
  HERRAMIENTAS,
  PALETA_TEL,
  componeEscena,
  creaDibujo,
  dibujoEn,
  escenaEn,
  formaDe,
  mueveDibujo,
  pintaEscena,
  progresoEscena,
  tiradorEn,
  type DibujoTel,
  type EscenaTel,
  type PuntoTel,
  type TipoDibujo,
} from "@/lib/coding/telestracion";
import {
  duracionClip,
  formateaDuracion,
  formateaMs,
  type CategoriaCoding,
  type ClipCoding,
} from "@/lib/coding/modelo";
import { Button, Dialog } from "@/components/abp/ui";
import { FAMILIA_PORTADA, esperaFuentePortada } from "@/lib/rivals/portada-font";

/* ================================================================== */
/*  DÓNDE ESTÁ LA IMAGEN                                               */
/* ================================================================== */

type Encaje = { izquierda: number; arriba: number; ancho: number; alto: number };

const SIN_ENCAJE: Encaje = { izquierda: 0, arriba: 0, ancho: 0, alto: 0 };

/**
 * El rectángulo que ocupa la imagen dentro de la etiqueta `<video>`.
 *
 * La primera medida la da el propio `ResizeObserver`, que dispara nada más
 * observar: por eso no hay que llamar a `mide()` a mano dentro del efecto —que
 * sería un `setState` síncrono— y aun así el lienzo aparece colocado en el
 * primer fotograma.
 */
function useEncaje(video: HTMLVideoElement | null): Encaje {
  const [encaje, setEncaje] = useState<Encaje>(SIN_ENCAJE);

  useEffect(() => {
    if (!video) return;

    const mide = () => {
      const caja = video.getBoundingClientRect();

      const anchoVideo = video.videoWidth;
      const altoVideo = video.videoHeight;

      if (!anchoVideo || !altoVideo || !caja.width || !caja.height) {
        setEncaje({ izquierda: 0, arriba: 0, ancho: caja.width, alto: caja.height });

        return;
      }

      const escala = Math.min(caja.width / anchoVideo, caja.height / altoVideo);

      const ancho = anchoVideo * escala;
      const alto = altoVideo * escala;

      setEncaje({
        izquierda: (caja.width - ancho) / 2,
        arriba: (caja.height - alto) / 2,
        ancho,
        alto,
      });
    };

    const observador = new ResizeObserver(mide);

    observador.observe(video);

    video.addEventListener("loadedmetadata", mide);
    window.addEventListener("resize", mide);

    return () => {
      observador.disconnect();
      video.removeEventListener("loadedmetadata", mide);
      window.removeEventListener("resize", mide);
    };
  }, [video]);

  return encaje;
}

/** Las medidas del lienzo en píxeles de verdad, con el `devicePixelRatio`. */
function ajustaLienzo(lienzo: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;

  const ancho = Math.max(1, Math.round(lienzo.clientWidth * dpr));
  const alto = Math.max(1, Math.round(lienzo.clientHeight * dpr));

  if (lienzo.width !== ancho || lienzo.height !== alto) {
    lienzo.width = ancho;
    lienzo.height = alto;
  }

  return { ancho, alto };
}

/* ================================================================== */
/*  PIEZAS DE LA BARRA                                                 */
/* ================================================================== */

const ICONOS: Record<TipoDibujo | "mano", ComponentType<{ size?: number }>> = {
  mano: MousePointer2,
  foco: Lightbulb,
  anillo: CircleDot,
  flecha: ArrowUpRight,
  linea: Minus,
  libre: Pencil,
  zona: Pentagon,
  rect: Square,
  elipse: Circle,
  seleccion: Users,
  mover: Move,
  texto: Type,
  lupa: ZoomIn,
  difumina: Droplet,
  "fuera-juego": Flag,
  medida: Ruler,
};

function BotonHerramienta({
  activo,
  titulo,
  icono: Icono,
  onClick,
}: {
  activo: boolean;
  titulo: string;
  icono: ComponentType<{ size?: number }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
        activo
          ? "border-[#C8A96B] bg-[#C8A96B] text-black"
          : "border-white/10 bg-black/40 text-white/60 hover:border-white/30 hover:text-white"
      }`}
    >
      <Icono size={15} />
    </button>
  );
}

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso = 1,
  sufijo = "",
  onChange,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso?: number;
  sufijo?: string;
  onChange: (valor: number) => void;
}) {
  const decimales = paso < 1 ? 100 : 1;

  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.12em] text-white/40">
        {etiqueta}
      </span>

      <input
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(evento) => onChange(Number(evento.target.value))}
        className="h-1 w-14 cursor-pointer accent-[#C8A96B]"
      />

      <span className="w-8 text-right font-mono text-[10px] tabular-nums text-white/50">
        {Math.round(valor * decimales) / decimales}
        {sufijo}
      </span>
    </label>
  );
}

function Interruptor({
  etiqueta,
  activo,
  onClick,
}: {
  etiqueta: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-lg border px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
        activo
          ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#C8A96B]"
          : "border-white/10 text-white/40 hover:text-white"
      }`}
    >
      {etiqueta}
    </button>
  );
}

/* ================================================================== */
/*  LA CAPA QUE SÓLO ENSEÑA                                            */
/* ================================================================== */

/**
 * Lo pintado, apareciendo solo al pasar el vídeo por encima.
 *
 * No recibe eventos —`pointer-events: none`— porque mientras se revisa el
 * partido el ratón es del reproductor, no de la pizarra.
 */
function CapaVista({
  video,
  escenas,
  encaje,
  visible,
}: {
  video: HTMLVideoElement;
  escenas: EscenaTel[];
  encaje: Encaje;
  visible: boolean;
}) {
  const lienzoRef = useRef<HTMLCanvasElement>(null);

  const datos = useRef({ escenas, visible, video });

  useEffect(() => {
    datos.current = { escenas, visible, video };
  });

  useEffect(() => {
    const lienzo = lienzoRef.current;

    if (!lienzo) return;

    let mano = 0;

    const pinta = () => {
      mano = requestAnimationFrame(pinta);

      const ctx = lienzo.getContext("2d");

      if (!ctx) return;

      const medidas = ajustaLienzo(lienzo);

      const { escenas: lista, visible: encendida, video: elemento } = datos.current;

      const escena = encendida
        ? escenaEn(lista, elemento.currentTime * 1000)
        : null;

      if (!escena) {
        ctx.clearRect(0, 0, medidas.ancho, medidas.alto);
        return;
      }

      pintaEscena(ctx, {
        escena,
        medidas,
        progreso: progresoEscena(escena, elemento.currentTime * 1000),
        imagen: elemento.readyState >= 2 ? elemento : null,
        imagenAncho: elemento.videoWidth,
        imagenAlto: elemento.videoHeight,
        familia: FAMILIA_PORTADA,
      });
    };

    mano = requestAnimationFrame(pinta);

    return () => cancelAnimationFrame(mano);
  }, []);

  return (
    <canvas
      ref={lienzoRef}
      style={{ width: encaje.ancho, height: encaje.alto }}
      className="pointer-events-none absolute left-0 top-0"
    />
  );
}

/* ================================================================== */
/*  EL EDITOR                                                          */
/* ================================================================== */

type Arrastre =
  | { modo: "crear" }
  | { modo: "mueve"; id: string; ultimo: PuntoTel }
  | { modo: "tirador"; id: string; indice: number };

type PropsEditor = {
  escena: EscenaTel;
  video: HTMLVideoElement;
  encaje: Encaje;
  herramienta: TipoDibujo | "mano";
  alHerramienta: (valor: TipoDibujo | "mano") => void;
  ajustes: Partial<DibujoTel>;
  alAjustes: (valor: Partial<DibujoTel>) => void;
  barra: boolean;
  alBarra: (valor: boolean) => void;
  alCambiar: (escena: EscenaTel) => void;
  alBorrar: (id: string) => void;
  alSalir: () => void;
};

function EditorPizarra({
  escena,
  video,
  encaje,
  herramienta,
  alHerramienta,
  ajustes,
  alAjustes,
  barra,
  alBarra,
  alCambiar,
  alBorrar,
  alSalir,
}: PropsEditor) {
  /*
  | La copia de trabajo.
  |
  | Sale de la escena de la sesión **una sola vez**, porque el componente se
  | monta con `key={escena.id}`: mientras se pinta, la de la sesión ya no manda
  | —si no, cada guardado devolvería el dibujo a medias del viaje anterior—.
  | El `ref` va emparejado con el estado porque entre dos `pointermove` no hay
  | ni un render y los manejadores necesitan el valor de ahora mismo.
  */
  const [local, setLocal] = useState<EscenaTel>(escena);
  const localRef = useRef<EscenaTel>(escena);

  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [escribiendo, setEscribiendo] = useState<string | null>(null);

  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const historial = useRef<EscenaTel[]>([]);
  const arrastre = useRef<Arrastre | null>(null);

  /*
  | El dibujo a medio hacer vive en un `ref`, no en un estado: entre el
  | `pointerdown` y el `pointerup` no hay ni un render, y como el lienzo se
  | repinta leyendo de aquí sesenta veces por segundo, un estado obligaría a
  | renderizar la barra entera en cada temblor del ratón.
  */
  const borrador = useRef<DibujoTel | null>(null);

  const seleccionRef = useRef<string | null>(null);

  useEffect(() => {
    seleccionRef.current = seleccion;
  });

  /* --------------------------------------------------------- pintado */

  useEffect(() => {
    const lienzo = lienzoRef.current;

    if (!lienzo) return;

    let mano = 0;

    const pinta = () => {
      mano = requestAnimationFrame(pinta);

      const ctx = lienzo.getContext("2d");

      if (!ctx) return;

      const medidas = ajustaLienzo(lienzo);

      const actual = localRef.current;

      pintaEscena(ctx, {
        escena: borrador.current
          ? { ...actual, dibujos: [...actual.dibujos, borrador.current] }
          : actual,
        medidas,
        /* En edición se ve todo terminado: animar mientras se dibuja sería
           pintar a ciegas. */
        progreso: 1,
        imagen: video.readyState >= 2 ? video : null,
        imagenAncho: video.videoWidth,
        imagenAlto: video.videoHeight,
        seleccion: seleccionRef.current,
        edicion: true,
        familia: FAMILIA_PORTADA,
      });
    };

    mano = requestAnimationFrame(pinta);

    return () => cancelAnimationFrame(mano);
  }, [video]);

  /* --------------------------------------------------------- cambios */

  const cambia = useCallback(
    (
      transforma: (escena: EscenaTel) => EscenaTel,
      opciones?: { guarda?: boolean; deshacer?: boolean },
    ) => {
      if (opciones?.deshacer) {
        historial.current = [...historial.current.slice(-39), localRef.current];
      }

      const siguiente = transforma(localRef.current);

      localRef.current = siguiente;
      setLocal(siguiente);

      if (opciones?.guarda !== false) alCambiar(siguiente);
    },
    [alCambiar],
  );

  const deshace = useCallback(() => {
    const anterior = historial.current[historial.current.length - 1];

    if (!anterior) {
      toast.info("No hay nada que deshacer en la pizarra");
      return;
    }

    historial.current = historial.current.slice(0, -1);

    localRef.current = anterior;
    setLocal(anterior);
    alCambiar(anterior);
  }, [alCambiar]);

  /* ------------------------------------------------------ el ratón */

  const puntoDe = useCallback((evento: EventoRaton<HTMLCanvasElement>) => {
    const caja = evento.currentTarget.getBoundingClientRect();

    return {
      x: Math.min(1, Math.max(0, (evento.clientX - caja.left) / (caja.width || 1))),
      y: Math.min(1, Math.max(0, (evento.clientY - caja.top) / (caja.height || 1))),
    };
  }, []);

  /*
  | Las medidas del lienzo **en píxeles de verdad**, leídas en el momento.
  |
  | No valen las del encaje: el lienzo se dibuja a la resolución del monitor, y
  | el alcance con el que se decide si el ratón ha tocado una flecha está en
  | esos mismos píxeles. Con las medidas en CSS, en una pantalla de retina hay
  | que pinchar al lado del dibujo para cogerlo.
  */
  const medidasAhora = useCallback(
    () => ({
      ancho: lienzoRef.current?.width || Math.max(1, encaje.ancho),
      alto: lienzoRef.current?.height || Math.max(1, encaje.alto),
    }),
    [encaje.alto, encaje.ancho],
  );

  /** El aspecto, para que un radio arrastrado en diagonal salga redondo. */
  const aspecto = encaje.ancho > 0 ? encaje.alto / encaje.ancho : 0.5625;

  const nuevoId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `dib-${crypto.randomUUID().slice(0, 8)}`
      : `dib-${Math.random().toString(36).slice(2, 10)}`;

  const alBajar = (evento: EventoPuntero<HTMLCanvasElement>) => {
    evento.currentTarget.setPointerCapture(evento.pointerId);

    const punto = puntoDe(evento);

    /* ------------------------------------------------ la mano */

    if (herramienta === "mano") {
      const medidas = medidasAhora();

      const elegido = dibujoEn(localRef.current, punto, medidas);

      if (!elegido) {
        setSeleccion(null);
        return;
      }

      setSeleccion(elegido.id);

      const tirador = tiradorEn(elegido, punto, medidas);

      arrastre.current =
        tirador >= 0
          ? { modo: "tirador", id: elegido.id, indice: tirador }
          : { modo: "mueve", id: elegido.id, ultimo: punto };

      historial.current = [...historial.current.slice(-39), localRef.current];

      return;
    }

    /* -------------------------------------------------- el texto */

    if (herramienta === "texto") {
      /*
      | Sin esto no se puede escribir.
      |
      | El lienzo no es enfocable, así que al pulsar encima el navegador se
      | lleva el foco al `body` —lo hace **después** de este manejador, con el
      | `mousedown` de compatibilidad—, el cuadro de escribir se queda sin
      | foco, salta su `blur` y se cierra en el acto: el rótulo se quedaba
      | siempre con el «Escribe aquí» de muestra. Quitarle el efecto por
      | omisión al `pointerdown` cancela ese `mousedown` y el foco se queda
      | donde lo acaba de poner el cuadro.
      */
      evento.preventDefault();

      /* Pinchando encima de uno que ya está, se reescribe ese: apilar dos
         chapas en el mismo sitio no lo quiere nadie. */
      const yaHay = dibujoEn(localRef.current, punto, medidasAhora());

      if (yaHay?.tipo === "texto") {
        setSeleccion(yaHay.id);
        setEscribiendo(yaHay.id);

        return;
      }

      const dibujo = creaDibujo("texto", [punto], ajustes, nuevoId());

      cambia((una) => ({ ...una, dibujos: [...una.dibujos, dibujo] }), {
        deshacer: true,
      });

      setSeleccion(dibujo.id);
      setEscribiendo(dibujo.id);

      return;
    }

    /* --------------------------------- polígonos: clic a clic */

    if (formaDe(herramienta) === "muchos" && herramienta !== "libre") {
      const actual = borrador.current;

      borrador.current =
        actual && actual.tipo === herramienta
          ? { ...actual, puntos: [...actual.puntos, punto] }
          : creaDibujo(herramienta, [punto, punto], ajustes, nuevoId());

      return;
    }

    /* ---------------------------------- todo lo demás: arrastrar */

    const puntos =
      herramienta === "anillo" || herramienta === "lupa" ? [punto] : [punto, punto];

    borrador.current = creaDibujo(herramienta, puntos, ajustes, nuevoId());

    arrastre.current = { modo: "crear" };
  };

  const alMover = (evento: EventoPuntero<HTMLCanvasElement>) => {
    const punto = puntoDe(evento);
    const accion = arrastre.current;
    const enCurso = borrador.current;

    /* La punta viva del polígono que se está cerrando. */
    if (!accion && enCurso && formaDe(enCurso.tipo) === "muchos") {
      borrador.current = {
        ...enCurso,
        puntos: [...enCurso.puntos.slice(0, -1), punto],
      };

      return;
    }

    if (!accion) return;

    if (accion.modo === "crear") {
      if (!enCurso) return;

      if (enCurso.tipo === "libre") {
        const ultimo = enCurso.puntos[enCurso.puntos.length - 1];

        if (Math.hypot(punto.x - ultimo.x, punto.y - ultimo.y) < 0.004) return;

        borrador.current = { ...enCurso, puntos: [...enCurso.puntos, punto] };

        return;
      }

      if (enCurso.tipo === "anillo" || enCurso.tipo === "lupa") {
        const centro = enCurso.puntos[0];

        /* El alto va en unidades de ancho: si no, un radio arrastrado en
           diagonal sale ovalado en cuanto el vídeo no es cuadrado. */
        const radio = Math.hypot(punto.x - centro.x, (punto.y - centro.y) * aspecto);

        borrador.current = { ...enCurso, radio: Math.max(0.015, radio) };

        return;
      }

      borrador.current = { ...enCurso, puntos: [enCurso.puntos[0], punto] };

      return;
    }

    if (accion.modo === "mueve") {
      const dx = punto.x - accion.ultimo.x;
      const dy = punto.y - accion.ultimo.y;

      arrastre.current = { ...accion, ultimo: punto };

      cambia(
        (una) => ({
          ...una,
          dibujos: una.dibujos.map((dibujo) =>
            dibujo.id === accion.id ? mueveDibujo(dibujo, dx, dy) : dibujo,
          ),
        }),
        { guarda: false },
      );

      return;
    }

    cambia(
      (una) => ({
        ...una,
        dibujos: una.dibujos.map((dibujo) =>
          dibujo.id === accion.id
            ? {
                ...dibujo,
                puntos: dibujo.puntos.map((uno, indice) =>
                  indice === accion.indice ? punto : uno,
                ),
              }
            : dibujo,
        ),
      }),
      { guarda: false },
    );
  };

  const alSoltar = () => {
    const accion = arrastre.current;

    arrastre.current = null;

    if (!accion) return;

    /* Lo movido ya está en la copia local: sólo falta subirlo. */
    if (accion.modo !== "crear") {
      alCambiar(localRef.current);
      return;
    }

    const enCurso = borrador.current;

    borrador.current = null;

    if (!enCurso) return;

    const listo = terminaDibujo(enCurso, aspecto);

    if (!listo) return;

    cambia((una) => ({ ...una, dibujos: [...una.dibujos, listo] }), {
      deshacer: true,
    });

    setSeleccion(listo.id);
  };

  /** Cierra el polígono que se estaba pinchando vértice a vértice. */
  const cierraPoligono = useCallback(() => {
    const enCurso = borrador.current;

    if (!enCurso) return;

    borrador.current = null;

    /* El último punto es el que seguía al ratón: fuera. */
    const puntos = enCurso.puntos.slice(0, -1);

    if (puntos.length < 2) return;

    const listo = { ...enCurso, puntos };

    cambia((una) => ({ ...una, dibujos: [...una.dibujos, listo] }), {
      deshacer: true,
    });

    setSeleccion(listo.id);
  }, [cambia]);

  /**
   * El doble clic: cierra el polígono a medias o reabre un rótulo.
   *
   * Un texto ya puesto no se podía corregir de ninguna manera —la barra sólo
   * enseña el campo del rótulo para la cota, el fuera de juego y las zonas—,
   * así que se reescribe donde se escribió: encima.
   */
  const alDobleClic = (evento: EventoRaton<HTMLCanvasElement>) => {
    if (borrador.current) {
      cierraPoligono();
      return;
    }

    const debajo = dibujoEn(localRef.current, puntoDe(evento), medidasAhora());

    if (debajo?.tipo !== "texto") return;

    setSeleccion(debajo.id);
    setEscribiendo(debajo.id);
  };

  /* --------------------------------------------------- propiedades */

  const elegido = local.dibujos.find((uno) => uno.id === seleccion) ?? null;

  const tipoActivo: TipoDibujo | "mano" = elegido?.tipo ?? herramienta;

  /**
   * Cambia un ajuste.
   *
   * Con algo elegido, cambia **ese** dibujo; sin nada elegido, cambia el
   * siguiente que se pinte. Es lo que hace que se pueda elegir el color antes
   * de dibujar y corregirlo después sin cambiar de sitio.
   */
  const ponAjuste = useCallback(
    (cambios: Partial<DibujoTel>) => {
      alAjustes({ ...ajustes, ...cambios });

      if (!seleccion) return;

      cambia(
        (una) => ({
          ...una,
          dibujos: una.dibujos.map((dibujo) =>
            dibujo.id === seleccion ? { ...dibujo, ...cambios } : dibujo,
          ),
        }),
        { deshacer: true },
      );
    },
    [ajustes, alAjustes, cambia, seleccion],
  );

  const borraElegido = useCallback(() => {
    if (!seleccionRef.current) return;

    const id = seleccionRef.current;

    cambia(
      (una) => ({
        ...una,
        dibujos: una.dibujos.filter((dibujo) => dibujo.id !== id),
      }),
      { deshacer: true },
    );

    setSeleccion(null);
  }, [cambia]);

  const duplicaElegido = useCallback(() => {
    const original = localRef.current.dibujos.find(
      (uno) => uno.id === seleccionRef.current,
    );

    if (!original) return;

    const copia: DibujoTel = {
      ...original,
      id: `dib-${Math.random().toString(36).slice(2, 10)}`,
      puntos: original.puntos.map((punto) => ({
        x: punto.x + 0.02,
        y: punto.y + 0.02,
      })),
    };

    cambia((una) => ({ ...una, dibujos: [...una.dibujos, copia] }), {
      deshacer: true,
    });

    setSeleccion(copia.id);
  }, [cambia]);

  const vacia = useCallback(() => {
    cambia((una) => ({ ...una, dibujos: [] }), { deshacer: true });

    borrador.current = null;
    setSeleccion(null);
  }, [cambia]);

  /* ------------------------------------------------------ el teclado */

  useEffect(() => {
    const escucha = (evento: KeyboardEvent) => {
      const destino = evento.target as HTMLElement | null;

      if (
        destino &&
        (destino.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(destino.tagName))
      ) {
        return;
      }

      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();

        if (borrador.current) borrador.current = null;
        else if (seleccionRef.current) setSeleccion(null);
        else alSalir();

        return;
      }

      if (evento.key === "Enter" && borrador.current) {
        evento.preventDefault();
        cierraPoligono();
        return;
      }

      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "z") {
        evento.preventDefault();
        deshace();
        return;
      }

      if (evento.ctrlKey || evento.metaKey || evento.altKey) return;

      if (evento.key === "Delete" || evento.key === "Backspace") {
        evento.preventDefault();
        borraElegido();
        return;
      }

      const tecla = evento.key.toLowerCase();

      if (tecla === "v") {
        evento.preventDefault();
        borrador.current = null;
        alHerramienta("mano");
        return;
      }

      const nueva = HERRAMIENTAS.find((una) => una.tecla === tecla);

      if (nueva) {
        evento.preventDefault();
        borrador.current = null;
        alHerramienta(nueva.tipo);
      }
    };

    window.addEventListener("keydown", escucha, true);

    return () => window.removeEventListener("keydown", escucha, true);
  }, [alHerramienta, alSalir, borraElegido, cierraPoligono, deshace]);

  /* ------------------------------------------------------- exportar */

  const exportaPng = useCallback(() => {
    const png = componeEscena(video, localRef.current, FAMILIA_PORTADA);

    if (!png) {
      toast.error("El navegador no deja exportar este vídeo (viene de otro dominio).");
      return;
    }

    const enlace = document.createElement("a");

    enlace.href = png;
    enlace.download = `pizarra-${Math.round(localRef.current.tMs / 1000)}s.png`;
    enlace.click();

    toast.success("Pizarra guardada como imagen");
  }, [video]);

  const pantallaCompleta = useCallback(() => {
    const contenedor = video.parentElement;

    if (!contenedor) return;

    if (document.fullscreenElement) void document.exitFullscreen();
    else void contenedor.requestFullscreen().catch(() => undefined);
  }, [video]);

  const enTexto = escribiendo
    ? (local.dibujos.find((uno) => uno.id === escribiendo) ?? null)
    : null;

  /* ---------------------------------------------------------- vista */

  return (
    <>
      <canvas
        ref={lienzoRef}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onDoubleClick={alDobleClic}
        style={{ width: encaje.ancho, height: encaje.alto }}
        className={`pointer-events-auto absolute left-0 top-0 touch-none ${
          herramienta === "mano" ? "cursor-pointer" : "cursor-crosshair"
        }`}
      />

      {/* --------------------------------- las herramientas ---------- */}

      <div className="pointer-events-auto absolute left-2 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-xl border border-white/10 bg-[#0B0F14]/85 p-1.5 backdrop-blur">
        <BotonHerramienta
          activo={herramienta === "mano"}
          titulo="Elegir y mover (V)"
          icono={ICONOS.mano}
          onClick={() => {
            borrador.current = null;
            alHerramienta("mano");
          }}
        />

        <span className="my-0.5 h-px bg-white/10" />

        {HERRAMIENTAS.map((una) => (
          <BotonHerramienta
            key={una.tipo}
            activo={herramienta === una.tipo}
            titulo={`${una.nombre} (${una.tecla.toUpperCase()}) · ${una.ayuda}`}
            icono={ICONOS[una.tipo]}
            onClick={() => {
              borrador.current = null;
              setSeleccion(null);
              alHerramienta(una.tipo);
            }}
          />
        ))}
      </div>

      {/* ------------------------------------------- la cabecera ----- */}

      <div className="pointer-events-auto absolute right-2 top-2 flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0B0F14]/85 px-2 py-1.5 backdrop-blur">
        <span className="font-mono text-[11px] tabular-nums text-[#C8A96B]">
          {formateaMs(local.tMs)}
        </span>

        <span className="h-3.5 w-px bg-white/10" />

        <button
          type="button"
          title="Deshacer (Ctrl+Z)"
          onClick={deshace}
          className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Undo2 size={14} />
        </button>

        <button
          type="button"
          title="Guardar la pizarra como imagen"
          onClick={exportaPng}
          className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Camera size={14} />
        </button>

        <button
          type="button"
          title="Pantalla completa"
          onClick={pantallaCompleta}
          className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Maximize2 size={14} />
        </button>

        <button
          type="button"
          title="Vaciar la pizarra"
          onClick={vacia}
          className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-red-300"
        >
          <Eraser size={14} />
        </button>

        <span className="h-3.5 w-px bg-white/10" />

        <button
          type="button"
          onClick={() => {
            alCambiar(localRef.current);
            alSalir();
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-[#C8A96B] px-2 py-1 text-[11px] font-semibold text-black transition hover:bg-[#d8bc82]"
        >
          <Check size={13} />
          Listo
        </button>
      </div>

      {/* --------------------------------------- los ajustes --------- */}

      <div className="pointer-events-auto absolute bottom-2 left-2 right-2 rounded-xl border border-white/10 bg-[#0B0F14]/88 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
          <div className="flex gap-1">
            {PALETA_TEL.map((una) => (
              <button
                key={una.color}
                type="button"
                title={una.nombre}
                aria-label={una.nombre}
                onClick={() => ponAjuste({ color: una.color })}
                style={{ background: una.color }}
                className={`h-5 w-5 rounded-md border transition ${
                  (elegido?.color ?? ajustes.color) === una.color
                    ? "scale-110 border-white"
                    : "border-white/20 hover:border-white/60"
                }`}
              />
            ))}
          </div>

          <span className="h-4 w-px bg-white/10" />

          <Deslizador
            etiqueta="Grosor"
            valor={elegido?.grosor ?? ajustes.grosor ?? 5}
            min={1}
            max={16}
            onChange={(valor) => ponAjuste({ grosor: valor })}
          />

          <Deslizador
            etiqueta="Opacidad"
            valor={elegido?.opacidad ?? ajustes.opacidad ?? 1}
            min={0.2}
            max={1}
            paso={0.05}
            onChange={(valor) => ponAjuste({ opacidad: valor })}
          />

          <button
            type="button"
            onClick={() => alBarra(!barra)}
            title={barra ? "Menos ajustes" : "Más ajustes"}
            className="ml-auto rounded-lg p-1 text-white/40 transition hover:text-white"
          >
            {barra ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {barra && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-2 py-1.5">
            {(tipoActivo === "flecha" || tipoActivo === "linea") && (
              <Deslizador
                etiqueta="Comba"
                valor={elegido?.curvatura ?? ajustes.curvatura ?? 0}
                min={-0.8}
                max={0.8}
                paso={0.05}
                onChange={(valor) => ponAjuste({ curvatura: valor })}
              />
            )}

            {(tipoActivo === "anillo" ||
              tipoActivo === "lupa" ||
              tipoActivo === "mover") && (
              <Deslizador
                etiqueta="Radio"
                valor={elegido?.radio ?? ajustes.radio ?? 0.05}
                min={0.015}
                max={0.2}
                paso={0.005}
                onChange={(valor) => ponAjuste({ radio: valor })}
              />
            )}

            {tipoActivo === "lupa" && (
              <Deslizador
                etiqueta="Aumento"
                valor={elegido?.zoom ?? ajustes.zoom ?? 2}
                min={1.2}
                max={5}
                paso={0.1}
                onChange={(valor) => ponAjuste({ zoom: valor })}
              />
            )}

            {tipoActivo === "foco" && (
              <Deslizador
                etiqueta="Oscuridad"
                valor={elegido?.intensidad ?? ajustes.intensidad ?? 0.66}
                min={0.2}
                max={0.9}
                paso={0.05}
                onChange={(valor) => ponAjuste({ intensidad: valor })}
              />
            )}

            {tipoActivo === "difumina" && (
              <Deslizador
                etiqueta="Desenfoque"
                valor={elegido?.intensidad ?? 14}
                min={4}
                max={40}
                onChange={(valor) => ponAjuste({ intensidad: valor })}
              />
            )}

            <Deslizador
              etiqueta="Letra"
              valor={elegido?.tamano ?? ajustes.tamano ?? 26}
              min={14}
              max={60}
              onChange={(valor) => ponAjuste({ tamano: valor })}
            />

            <Interruptor
              etiqueta="Relleno"
              activo={elegido?.relleno ?? ajustes.relleno ?? true}
              onClick={() =>
                ponAjuste({ relleno: !(elegido?.relleno ?? ajustes.relleno ?? true) })
              }
            />

            <Interruptor
              etiqueta="Discontinua"
              activo={elegido?.discontinua ?? ajustes.discontinua ?? false}
              onClick={() =>
                ponAjuste({
                  discontinua: !(
                    elegido?.discontinua ??
                    ajustes.discontinua ??
                    false
                  ),
                })
              }
            />

            <Interruptor
              etiqueta="Animar"
              activo={elegido?.animado ?? ajustes.animado ?? false}
              onClick={() =>
                ponAjuste({ animado: !(elegido?.animado ?? ajustes.animado ?? false) })
              }
            />

            {(tipoActivo === "anillo" ||
              tipoActivo === "mover" ||
              tipoActivo === "seleccion") && (
              <input
                value={elegido?.etiqueta ?? ""}
                onChange={(evento) => ponAjuste({ etiqueta: evento.target.value })}
                placeholder="Dorsal o nombre"
                aria-label="Dorsal o nombre"
                disabled={!elegido}
                className="w-28 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#C8A96B]/50 disabled:opacity-40"
              />
            )}

            {(tipoActivo === "medida" ||
              tipoActivo === "fuera-juego" ||
              tipoActivo === "zona" ||
              tipoActivo === "texto" ||
              tipoActivo === "seleccion") && (
              <input
                value={elegido?.texto ?? ""}
                onChange={(evento) => ponAjuste({ texto: evento.target.value })}
                placeholder={
                  tipoActivo === "medida"
                    ? "12 m"
                    : tipoActivo === "texto"
                      ? "El texto"
                      : "Rótulo"
                }
                aria-label="Rótulo"
                disabled={!elegido}
                className="w-24 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#C8A96B]/50 disabled:opacity-40"
              />
            )}

            <span className="h-4 w-px bg-white/10" />

            <Deslizador
              etiqueta="Dura"
              valor={Math.round(local.duracionMs / 1000)}
              min={1}
              max={30}
              sufijo="s"
              onChange={(valor) =>
                cambia((una) => ({ ...una, duracionMs: valor * 1000 }))
              }
            />

            <button
              type="button"
              onClick={() => cambia((una) => ({ ...una, congelada: !una.congelada }))}
              title="Parar el vídeo al llegar aquí, como en televisión"
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
                local.congelada
                  ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#C8A96B]"
                  : "border-white/10 text-white/40 hover:text-white"
              }`}
            >
              <Snowflake size={11} />
              Congela
            </button>

            {/* Congelada y con espera: la pizarra se descongela sola. */}
            {local.congelada && (
              <span
                title={
                  local.pausaMs > 0
                    ? "El vídeo se para aquí y sigue solo pasados esos segundos"
                    : "En 0 el vídeo se queda parado hasta que le des al play"
                }
                className="inline-flex items-center"
              >
                <Deslizador
                  etiqueta="Sigue a los"
                  valor={Math.round(local.pausaMs / 1000)}
                  min={0}
                  max={20}
                  sufijo="s"
                  onChange={(valor) =>
                    cambia((una) => ({ ...una, pausaMs: valor * 1000 }))
                  }
                />
              </span>
            )}

            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={duplicaElegido}
                disabled={!elegido}
                title="Duplicar"
                className="rounded-lg p-1 text-white/45 transition hover:text-white disabled:opacity-30"
              >
                <Copy size={14} />
              </button>

              <button
                type="button"
                onClick={borraElegido}
                disabled={!elegido}
                title="Borrar el dibujo (Supr)"
                className="rounded-lg p-1 text-white/45 transition hover:text-red-300 disabled:opacity-30"
              >
                <Trash2 size={14} />
              </button>

              <button
                type="button"
                onClick={() => {
                  alBorrar(local.id);
                  alSalir();
                }}
                className="rounded-lg border border-red-400/25 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-red-300/80 transition hover:border-red-400/60"
              >
                Borrar pizarra
              </button>
            </span>
          </div>
        )}
      </div>

      {/* ------------------------------------------- el texto -------- */}

      {enTexto && (
        <div
          className="pointer-events-auto absolute"
          style={{
            left: Math.min(
              enTexto.puntos[0].x * encaje.ancho,
              Math.max(0, encaje.ancho - 220),
            ),
            top: Math.max(0, enTexto.puntos[0].y * encaje.alto - 20),
          }}
        >
          <textarea
            autoFocus
            rows={2}
            value={enTexto.texto}
            aria-label="Texto de la pizarra"
            onChange={(evento) =>
              cambia(
                (una) => ({
                  ...una,
                  dibujos: una.dibujos.map((dibujo) =>
                    dibujo.id === enTexto.id
                      ? { ...dibujo, texto: evento.target.value }
                      : dibujo,
                  ),
                }),
                { guarda: false },
              )
            }
            onBlur={() => {
              /* Un rótulo sin una letra no se queda: en el lienzo saldría con
                 el «Escribe aquí» de muestra, que no lo ha escrito nadie. */
              if (!enTexto.texto.trim()) {
                cambia((una) => ({
                  ...una,
                  dibujos: una.dibujos.filter((dibujo) => dibujo.id !== enTexto.id),
                }));

                setSeleccion((actual) => (actual === enTexto.id ? null : actual));
              } else {
                alCambiar(localRef.current);
              }

              setEscribiendo(null);
            }}
            onKeyDown={(evento) => {
              if (evento.key === "Escape" || (evento.key === "Enter" && !evento.shiftKey)) {
                evento.preventDefault();
                evento.currentTarget.blur();
              }
            }}
            placeholder="Escribe y pulsa Intro"
            className="w-52 resize-none rounded-xl border border-[#C8A96B]/50 bg-[#0B0F14]/95 px-2 py-1.5 text-[12px] text-white outline-none placeholder:text-white/30"
          />
        </div>
      )}
    </>
  );
}

/**
 * Deja un dibujo recién arrastrado en condiciones, o lo tira.
 *
 * Un clic sin arrastre es lo más normal del mundo cuando se está señalando a
 * un jugador con el partido en marcha: en vez de crear una elipse de cero
 * píxeles, el foco sale con su tamaño de siempre y lo que no tiene sentido sin
 * recorrido —una flecha, una cota— se descarta sin ruido.
 */
function terminaDibujo(dibujo: DibujoTel, aspecto: number): DibujoTel | null {
  if (dibujo.tipo === "anillo" || dibujo.tipo === "lupa") return dibujo;

  if (dibujo.tipo === "libre") return dibujo.puntos.length >= 3 ? dibujo : null;

  const [a, b] = dibujo.puntos;

  if (!b) return null;

  const recorrido = Math.hypot(b.x - a.x, (b.y - a.y) * aspecto);

  if (recorrido >= 0.02) return dibujo;

  if (dibujo.tipo === "foco") {
    const radio = 0.07;

    return {
      ...dibujo,
      puntos: [
        { x: a.x - radio, y: a.y - radio / aspecto },
        { x: a.x + radio, y: a.y + radio / aspecto },
      ],
    };
  }

  return null;
}

/* ================================================================== */
/*  LA PIZARRA                                                         */
/* ================================================================== */

export type PizarraVideoProps = {
  video: HTMLVideoElement | null;
  escenas: EscenaTel[];
  /** La pizarra que se está pintando ahora, o `null` si sólo se mira. */
  editando: string | null;
  alEditar: (id: string | null) => void;
  alCambiar: (escena: EscenaTel) => void;
  alBorrar: (id: string) => void;
  /** Abre una pizarra en el instante en el que está el vídeo. */
  alPintar: () => void;
  /** Enseña lo pintado mientras se reproduce. */
  visible: boolean;
};

export function PizarraVideo({
  video,
  escenas,
  editando,
  alEditar,
  alCambiar,
  alBorrar,
  alPintar,
  visible,
}: PizarraVideoProps) {
  const encaje = useEncaje(video);

  /* La condensada del club, pedida antes de que haga falta: en un `<canvas>`
     no hay `font-display` que valga y la primera chapa saldría con Arial. */
  useEffect(() => {
    void esperaFuentePortada();
  }, []);

  /*
  | La herramienta y los ajustes viven **fuera** del editor.
  |
  | El editor se monta de nuevo con cada pizarra, y si el color y el grosor
  | fueran suyos, cada pizarra empezaría en oro del cinco: quien está marcando
  | a los centrales en rojo tendría que volver a elegirlo cada vez.
  */
  const [herramienta, setHerramienta] = useState<TipoDibujo | "mano">("foco");
  const [barra, setBarra] = useState(true);

  const [ajustes, setAjustes] = useState<Partial<DibujoTel>>({
    color: "#C8A96B",
    grosor: 5,
    opacidad: 1,
  });

  const salir = useCallback(() => alEditar(null), [alEditar]);

  if (!video || encaje.ancho <= 0) return null;

  const escena = editando
    ? (escenas.find((una) => una.id === editando) ?? null)
    : null;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: encaje.izquierda,
        top: encaje.arriba,
        width: encaje.ancho,
        height: encaje.alto,
      }}
    >
      {escena ? (
        <EditorPizarra
          key={escena.id}
          escena={escena}
          video={video}
          encaje={encaje}
          herramienta={herramienta}
          alHerramienta={setHerramienta}
          ajustes={ajustes}
          alAjustes={setAjustes}
          barra={barra}
          alBarra={setBarra}
          alCambiar={alCambiar}
          alBorrar={alBorrar}
          alSalir={salir}
        />
      ) : (
        <>
          <CapaVista
            video={video}
            escenas={escenas}
            encaje={encaje}
            visible={visible}
          />

          <button
            type="button"
            onClick={alPintar}
            className="pointer-events-auto absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#11161C]/85 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur transition hover:border-[#C8A96B]/60 hover:text-white"
          >
            <PenTool size={13} />
            Pizarra
          </button>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  LA LISTA DE PIZARRAS                                               */
/* ================================================================== */

export function FilaPizarra({
  escena,
  indice,
  activa,
  alAbrir,
  alEditar,
  alRepartir,
  alBorrar,
}: {
  escena: EscenaTel;
  indice: number;
  activa: boolean;
  alAbrir: () => void;
  alEditar: () => void;
  /** Abre el reparto de esta pizarra entre varios cortes. */
  alRepartir?: () => void;
  alBorrar: () => void;
}) {
  const nombre = escena.nombre.trim() || `Pizarra ${indice + 1}`;

  const reutilizada = escena.clipIds?.length ?? 0;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
        activa
          ? "border-[#C8A96B]/50 bg-[#C8A96B]/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/20"
      }`}
    >
      <button
        type="button"
        onClick={alAbrir}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="font-mono text-[11px] tabular-nums text-[#C8A96B]">
          {formateaMs(escena.tMs)}
        </span>

        <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">
          {nombre}
        </span>

        <span className="shrink-0 text-[10px] text-white/35">
          {escena.dibujos.length} · {Math.round(escena.duracionMs / 1000)}s
          {escena.congelada
            ? escena.pausaMs > 0
              ? ` · ❄ ${Math.round(escena.pausaMs / 1000)}s`
              : " · ❄"
            : ""}
        </span>
      </button>

      <button
        type="button"
        onClick={alEditar}
        title="Pintar en esta pizarra"
        aria-label="Pintar en esta pizarra"
        className="rounded-lg p-1 text-white/40 transition hover:text-white"
      >
        <PenTool size={13} />
      </button>

      {alRepartir && (
        <button
          type="button"
          onClick={alRepartir}
          title={
            reutilizada > 0
              ? `Se reutiliza en ${reutilizada} ${reutilizada === 1 ? "corte" : "cortes"} más`
              : "Usar esta pizarra en otros cortes"
          }
          aria-label="Usar esta pizarra en otros cortes"
          className={`flex items-center gap-0.5 rounded-lg p-1 text-[10px] tabular-nums transition ${
            reutilizada > 0
              ? "text-[#C8A96B]"
              : "text-white/40 hover:text-white"
          }`}
        >
          <Layers size={13} />
          {reutilizada > 0 && reutilizada}
        </button>
      )}

      <button
        type="button"
        onClick={alBorrar}
        title="Borrar la pizarra"
        aria-label="Borrar la pizarra"
        className="rounded-lg p-1 text-white/40 transition hover:text-red-300"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/* ================================================================== */
/*  UNA PIZARRA EN VARIOS CORTES                                       */
/* ================================================================== */

/**
 * Elegir en qué cortes se reutiliza una pizarra.
 *
 * Una pizarra sale sola en el corte que la contiene en el tiempo, y eso no se
 * toca: aquí se marcan **los demás**. El caso de verdad es el dibujo que
 * explica un concepto —cómo había que estar perfilado, dónde estaba el hueco—
 * y vale para las tres veces que pasó lo mismo; volver a pintarlo en cada
 * corte era el trabajo que esto se ahorra.
 *
 * En un corte reutilizado la pizarra se cuela **al principio**, antes de la
 * acción: lo que se quema es el fotograma de donde se pintó, y meterlo a
 * mitad de otra jugada la partiría por donde no toca.
 */
export function ReutilizaPizarra({
  escena,
  nombre,
  clips,
  categorias,
  onGuardar,
  onCerrar,
}: {
  escena: EscenaTel;
  nombre: string;
  /** Todos los cortes de la sesión, en el orden en el que van a salir. */
  clips: ClipCoding[];
  categorias: CategoriaCoding[];
  onGuardar: (clipIds: string[]) => void;
  onCerrar: () => void;
}) {
  const [elegidos, setElegidos] = useState<string[]>(escena.clipIds ?? []);

  /** ¿Este corte ya la enseña por su instante? Entonces no se puede quitar. */
  const suyo = (clip: ClipCoding) =>
    escena.tMs >= clip.inicioMs && escena.tMs <= clip.finMs;

  const alterna = (id: string) =>
    setElegidos((actual) =>
      actual.includes(id)
        ? actual.filter((uno) => uno !== id)
        : [...actual, id],
    );

  return (
    <Dialog
      title={`«${nombre}» en otros cortes`}
      subtitle="Sale al principio de cada corte que marques, antes de la acción"
      onClose={onCerrar}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-white/35">
            {elegidos.length === 0
              ? "Sólo donde cae por tiempo"
              : `${elegidos.length} ${elegidos.length === 1 ? "corte más" : "cortes más"}`}
          </span>

          <div className="flex items-center gap-2">
            <Button onClick={onCerrar}>Cancelar</Button>

            <Button tone="primary" onClick={() => onGuardar(elegidos)}>
              Guardar
            </Button>
          </div>
        </div>
      }
    >
      {clips.length === 0 ? (
        <p className="py-6 text-center text-xs text-white/30">
          Todavía no hay cortes donde ponerla.
        </p>
      ) : (
        <div className="max-h-[50vh] min-w-0 space-y-1 overflow-y-auto pr-1">
          {clips.map((clip) => {
            const propio = suyo(clip);
            const marcado = propio || elegidos.includes(clip.id);

            const categoria = categorias.find(
              (una) => una.id === clip.categoriaId,
            );

            return (
              <button
                key={clip.id}
                type="button"
                disabled={propio}
                onClick={() => alterna(clip.id)}
                className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                  marcado
                    ? "border-[#C8A96B]/50 bg-[#C8A96B]/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                } ${propio ? "cursor-default opacity-70" : ""}`}
              >
                <span
                  aria-hidden
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                    marcado
                      ? "border-[#C8A96B] bg-[#C8A96B]/20 text-[#C8A96B]"
                      : "border-white/20 text-transparent"
                  }`}
                >
                  ✓
                </span>

                <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/35">
                  {String(clip.numero).padStart(3, "0")}
                </span>

                <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">
                  {clip.jugadorNombre}
                  {categoria && (
                    <span className="text-white/35"> · {categoria.nombre}</span>
                  )}
                </span>

                <span className="shrink-0 text-[10px] tabular-nums text-white/30">
                  {formateaMs(clip.inicioMs)} · {formateaDuracion(duracionClip(clip))}
                </span>

                {propio && (
                  <span className="shrink-0 rounded-full bg-white/[0.08] px-1.5 text-[9px] uppercase tracking-[0.12em] text-white/40">
                    Sale sola
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
