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
  BrickWall,
  BringToFront,
  Camera,
  Grid3x3,
  Highlighter,
  Link2,
  MessageSquare,
  Redo2,
  Scale,
  SendToBack,
  Spotlight,
  Tag,
  Triangle,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Cone,
  Copy,
  Droplet,
  Eraser,
  Flag,
  Clock3,
  Hash,
  Layers,
  Lightbulb,
  Maximize2,
  Minus,
  MousePointer2,
  Move,
  PenTool,
  Pencil,
  Pentagon,
  Route,
  Ruler,
  SkipBack,
  SkipForward,
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
  ESTILOS_FLECHA,
  GRUPOS_HERRAMIENTAS,
  HERRAMIENTAS,
  PALETA_TEL,
  componeEscena,
  creaDibujo,
  dibujoEn,
  escenaEn,
  esEscribible,
  esTrazoLibre,
  formaDe,
  minimoPuntos,
  mueveDibujo,
  pintaEscena,
  progresoEscena,
  tiradorEn,
  usaRadio,
  verticesFijos,
  type DibujoTel,
  type EscenaTel,
  type EstiloFlecha,
  type GrupoHerramienta,
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
  pasillo: Route,
  linea: Minus,
  libre: Pencil,
  zona: Pentagon,
  cono: Cone,
  rect: Square,
  elipse: Circle,
  seleccion: Users,
  mover: Move,
  texto: Type,
  numero: Hash,
  lupa: ZoomIn,
  difumina: Droplet,
  "fuera-juego": Flag,
  medida: Ruler,
  muro: BrickWall,
  rejilla: Grid3x3,
  cadena: Link2,
  llamada: MessageSquare,
  fluor: Highlighter,
  haz: Spotlight,
  chapa: Tag,
  recuento: Scale,
  triangulo: Triangle,
};

/** El color en `#rrggbb`, que es lo único que entiende `<input type="color">`. */
function hex6(color: string | undefined, respaldo = "#c8a96b") {
  const limpio = (color ?? "").trim();

  if (/^#[0-9a-f]{6}$/i.test(limpio)) return limpio.toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(limpio)) {
    return `#${limpio
      .slice(1)
      .split("")
      .map((letra) => letra + letra)
      .join("")}`.toLowerCase();
  }

  return respaldo;
}

/**
 * Un grupo de la barra: un botón que enseña la última herramienta usada de él
 * y, al pulsarlo, despliega las demás a su lado con su nombre y su tecla.
 */
function GrupoBarra({
  nombre,
  tipos,
  herramienta,
  ultima,
  abierto,
  alAbrir,
  alElegir,
}: {
  nombre: string;
  tipos: TipoDibujo[];
  herramienta: TipoDibujo | "mano";
  ultima: TipoDibujo | undefined;
  abierto: boolean;
  alAbrir: (abrir: boolean) => void;
  alElegir: (tipo: TipoDibujo) => void;
}) {
  const dentro = tipos.includes(herramienta as TipoDibujo);
  const visible: TipoDibujo = dentro
    ? (herramienta as TipoDibujo)
    : ultima && tipos.includes(ultima)
      ? ultima
      : tipos[0];

  const ficha = HERRAMIENTAS.find((una) => una.tipo === visible);
  const Icono = ICONOS[visible];

  /*
  | Con el dedo (31/10/2026) el desplegable no cuelga del botón sino de lo alto
  | de la barra (por eso el `static`), con tope de alto y desplazable: a 40 px
  | por fila, un grupo de siete herramientas abierto desde el último botón se
  | salía por debajo del vídeo y las de abajo no se podían tocar.
  */
  return (
    <div className="relative pointer-coarse:static max-sm:static">
      <button
        type="button"
        title={`${nombre} · ${ficha?.nombre ?? ""} (${(ficha?.tecla ?? "").toUpperCase()}) · ${ficha?.ayuda ?? ""}`}
        aria-label={`${nombre}: ${ficha?.nombre ?? ""}`}
        aria-pressed={dentro}
        aria-expanded={abierto}
        onClick={() => {
          alElegir(visible);
          alAbrir(!abierto);
        }}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition ${
          dentro
            ? "border-[#C8A96B] bg-[#C8A96B] text-black"
            : "border-white/10 bg-black/40 text-white/60 hover:border-white/30 hover:text-white"
        }`}
      >
        <Icono size={15} />

        {/* La esquinita que avisa de que hay más debajo. */}
        <span
          aria-hidden
          className={`absolute bottom-0.5 right-0.5 h-0 w-0 border-l-[4px] border-t-[4px] border-l-transparent ${
            dentro ? "border-t-black/50" : "border-t-white/40"
          }`}
          style={{ transform: "rotate(180deg)" }}
        />
      </button>

      {abierto && (
        <div className="absolute left-full top-0 z-10 ml-2 w-52 overscroll-contain rounded-xl border border-white/10 bg-[#0B0F14]/[0.96] p-1 shadow-xl backdrop-blur pointer-coarse:max-h-[min(22rem,calc(100dvh-2rem))] pointer-coarse:overflow-y-auto max-sm:max-h-44 max-sm:overflow-y-auto">
          <p className="px-2 pb-1 pt-0.5 text-[9px] uppercase tracking-[0.16em] text-white/35">
            {nombre}
          </p>

          {tipos.map((tipo) => {
            const una = HERRAMIENTAS.find((h) => h.tipo === tipo);
            const IconoUna = ICONOS[tipo];

            if (!una) return null;

            return (
              <button
                key={tipo}
                type="button"
                title={una.ayuda}
                onClick={() => {
                  alElegir(tipo);
                  alAbrir(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition ${
                  herramienta === tipo
                    ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                    : "text-white/75 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <IconoUna size={14} />
                <span className="min-w-0 flex-1 truncate">{una.nombre}</span>
                <kbd className="rounded border border-white/15 px-1 font-mono text-[10px] text-white/45 pointer-coarse:hidden">
                  {una.tecla.toUpperCase()}
                </kbd>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
        className="h-1 w-14 cursor-pointer accent-[#C8A96B] pointer-coarse:w-28"
      />

      <span className="w-8 text-right font-mono text-[10px] tabular-nums text-white/50">
        {String(Math.round(valor * decimales) / decimales).replace(".", ",")}
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

    /*
    | Lo que lleva dibujado la pizarra que está en pantalla.
    |
    | Las flechas que se trazan solas y el jugador que viaja avanzaban SÓLO con
    | el reloj del vídeo. En una pizarra congelada el vídeo se para justo al
    | empezar la escena, así que se quedaban a medio pintar para siempre; y si
    | la congelada seguía sola a los N segundos, la animación volvía a empezar
    | desde cero, que parecía un bucle. Ahora, con el vídeo parado, el dibujo
    | termina con el reloj de la pared, y lo dibujado no retrocede mientras la
    | pizarra siga en pantalla.
    */
    let enPantalla: string | null = null;
    let dibujado = 0;
    let paradoDesde: number | null = null;
    let dibujadoAlParar = 0;

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
        enPantalla = null;
        dibujado = 0;
        paradoDesde = null;

        ctx.clearRect(0, 0, medidas.ancho, medidas.alto);
        return;
      }

      if (escena.id !== enPantalla) {
        enPantalla = escena.id;
        dibujado = 0;
        paradoDesde = null;
      }

      const porVideo = progresoEscena(escena, elemento.currentTime * 1000);

      let porReloj = 0;

      if (elemento.paused) {
        if (paradoDesde === null) {
          paradoDesde = performance.now();
          dibujadoAlParar = dibujado;
        }

        /* Entre medio segundo y segundo y medio, según lo que dure la escena. */
        const tarda = Math.max(400, Math.min(1500, escena.duracionMs));

        porReloj = dibujadoAlParar + (performance.now() - paradoDesde) / tarda;
      } else {
        paradoDesde = null;
      }

      dibujado = Math.min(1, Math.max(dibujado, porVideo, porReloj));

      pintaEscena(ctx, {
        escena,
        medidas,
        progreso: dibujado,
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
  /* Lo deshecho, para rehacerlo. Se vacía en cuanto se pinta algo nuevo. */
  const rehacer = useRef<EscenaTel[]>([]);
  const arrastre = useRef<Arrastre | null>(null);

  /* La barra por grupos: cuál está desplegado y lo último usado de cada uno. */
  const [grupoAbierto, setGrupoAbierto] = useState<GrupoHerramienta | null>(null);
  const [ultimas, setUltimas] = useState<Partial<Record<GrupoHerramienta, TipoDibujo>>>({});

  /* «Quitar todo» pide un segundo clic en la propia barra, sin ventanas del
     navegador que paren la pantalla. */
  const [confirmaVaciar, setConfirmaVaciar] = useState(false);

  /*
  | El dibujo a medio hacer vive en un `ref`, no en un estado: entre el
  | `pointerdown` y el `pointerup` no hay ni un render, y como el lienzo se
  | repinta leyendo de aquí sesenta veces por segundo, un estado obligaría a
  | renderizar la barra entera en cada temblor del ratón.
  */
  const borrador = useRef<DibujoTel | null>(null);

  const seleccionRef = useRef<string | null>(null);
  const herramientaRef = useRef<TipoDibujo | "mano">(herramienta);
  const grupoAbiertoRef = useRef<GrupoHerramienta | null>(null);

  useEffect(() => {
    seleccionRef.current = seleccion;
    herramientaRef.current = herramienta;
    grupoAbiertoRef.current = grupoAbierto;
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
        rehacer.current = [];
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
    rehacer.current = [...rehacer.current.slice(-39), localRef.current];

    localRef.current = anterior;
    setLocal(anterior);
    alCambiar(anterior);
  }, [alCambiar]);

  const rehace = useCallback(() => {
    const siguiente = rehacer.current[rehacer.current.length - 1];

    if (!siguiente) {
      toast.info("No hay nada que rehacer en la pizarra");
      return;
    }

    rehacer.current = rehacer.current.slice(0, -1);
    historial.current = [...historial.current.slice(-39), localRef.current];

    localRef.current = siguiente;
    setLocal(siguiente);
    alCambiar(siguiente);
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
    /* Un segundo dedo (o la palma en la tablet) no dibuja: sólo manda el
       primero que toca. */
    if (!evento.isPrimary) return;

    evento.currentTarget.setPointerCapture(evento.pointerId);

    const punto = puntoDe(evento);

    /* Pinchar en el vídeo cierra lo que estuviera desplegado. */
    if (grupoAbierto) setGrupoAbierto(null);
    if (confirmaVaciar) setConfirmaVaciar(false);

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

      if (yaHay && esEscribible(yaHay.tipo)) {
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

    /* ------------------------------------- el número de orden */

    if (herramienta === "numero") {
      /*
      | El número lo pone la pantalla, no la mano.
      |
      | Lo que se quiere al numerar una jugada es pinchar cuatro veces y que
      | salga 1, 2, 3, 4. Se cuenta lo que ya hay en ESTA pizarra: si se borra
      | el 2 y se vuelve a pinchar, el nuevo vuelve a ser un 2, que es lo que
      | espera cualquiera. Y como es un campo normal, se corrige a mano en la
      | barra cuando no cuadra.
      */
      const cuantos = localRef.current.dibujos.filter(
        (uno) => uno.tipo === "numero",
      ).length;

      const dibujo = {
        ...creaDibujo("numero", [punto], ajustes, nuevoId()),
        etiqueta: String(cuantos + 1),
      };

      cambia((una) => ({ ...una, dibujos: [...una.dibujos, dibujo] }), {
        deshacer: true,
      });

      setSeleccion(dibujo.id);

      return;
    }

    /* --------------------------------------- el recuento «3 v 2» */

    if (herramienta === "recuento") {
      /* Sale con el caso más típico y se corrige abajo: una chapa sin números
         no dice nada. */
      const dibujo = {
        ...creaDibujo("recuento", [punto], ajustes, nuevoId()),
        etiqueta: "3",
        texto: "2",
      };

      cambia((una) => ({ ...una, dibujos: [...una.dibujos, dibujo] }), {
        deshacer: true,
      });

      setSeleccion(dibujo.id);

      return;
    }

    /* --------------------------------- polígonos: clic a clic */

    if (formaDe(herramienta) === "muchos" && !esTrazoLibre(herramienta)) {
      const actual = borrador.current;

      /*
      | El vértice pinchado sustituye a la punta viva y se abre otra encima.
      |
      | Con ratón da lo mismo que añadirlo (la punta ya estaba donde se pincha),
      | pero con el dedo no hay `pointermove` sin tocar: la punta se quedaba en
      | el toque anterior y al cerrar se perdía el último vértice. El triángulo
      | no se cerraba nunca con el dedo (31/10/2026).
      */
      borrador.current =
        actual && actual.tipo === herramienta
          ? { ...actual, puntos: [...actual.puntos.slice(0, -1), punto, punto] }
          : creaDibujo(herramienta, [punto, punto], ajustes, nuevoId());

      /* El triángulo y la rejilla se cierran solos al llegar a su número de
         vértices (el último punto es siempre el que sigue al ratón). */
      const fijos = verticesFijos(herramienta);

      if (fijos && borrador.current.puntos.length - 1 >= fijos) cierraPoligono();

      return;
    }

    /* ---------------------------------- todo lo demás: arrastrar */

    const puntos = usaRadio(herramienta) ? [punto] : [punto, punto];

    borrador.current = creaDibujo(herramienta, puntos, ajustes, nuevoId());

    arrastre.current = { modo: "crear" };
  };

  const alMover = (evento: EventoPuntero<HTMLCanvasElement>) => {
    if (!evento.isPrimary) return;

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

      if (esTrazoLibre(enCurso.tipo)) {
        const ultimo = enCurso.puntos[enCurso.puntos.length - 1];

        if (Math.hypot(punto.x - ultimo.x, punto.y - ultimo.y) < 0.004) return;

        borrador.current = { ...enCurso, puntos: [...enCurso.puntos, punto] };

        return;
      }

      if (usaRadio(enCurso.tipo)) {
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
      /*
      | Un clic para elegir, sin mover nada, no es un paso que deshacer: el
      | `pointerdown` guardó la foto por si acaso, y si la escena sigue siendo
      | la misma se devuelve. Si se movió, lo deshecho deja de poder rehacerse.
      */
      if (historial.current[historial.current.length - 1] === localRef.current) {
        historial.current = historial.current.slice(0, -1);
        return;
      }

      rehacer.current = [];
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

    /* La llamada se escribe nada más ponerla, como el texto. */
    if (esEscribible(listo.tipo)) setEscribiendo(listo.id);
  };

  /** Cierra el polígono que se estaba pinchando vértice a vértice. */
  const cierraPoligono = useCallback(() => {
    const enCurso = borrador.current;

    if (!enCurso) return;

    borrador.current = null;

    /*
    | El último punto es el que seguía al ratón: fuera. Y los repetidos
    | seguidos también: el doble clic que cierra mete dos clics en el mismo
    | sitio, y en una cadena eso era un aro pintado dos veces y un tramo de
    | cero metros con su cota.
    */
    const puntos = enCurso.puntos
      .slice(0, -1)
      .filter(
        (punto, indice, todos) =>
          indice === 0 ||
          Math.hypot(punto.x - todos[indice - 1].x, punto.y - todos[indice - 1].y) > 0.003,
      );

    if (puntos.length < minimoPuntos(enCurso.tipo)) return;

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

    if (!debajo || !esEscribible(debajo.tipo)) return;

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

  /**
   * Trae el elegido al frente o lo manda al fondo.
   *
   * Lo que se pinta después tapa a lo de antes: una zona dibujada encima de
   * un anillo lo veló, y no había forma de arreglarlo sin borrar y repetir.
   * (El foco, la lupa y el difuminado siguen yendo por su capa: ver
   * `pintaEscena`.)
   */
  const ordenaElegido = useCallback(
    (hacia: "frente" | "fondo") => {
      const id = seleccionRef.current;

      if (!id) return;

      cambia(
        (una) => {
          const suyo = una.dibujos.find((dibujo) => dibujo.id === id);

          if (!suyo) return una;

          const resto = una.dibujos.filter((dibujo) => dibujo.id !== id);

          return {
            ...una,
            dibujos: hacia === "frente" ? [...resto, suyo] : [suyo, ...resto],
          };
        },
        { deshacer: true },
      );
    },
    [cambia],
  );

  const vacia = useCallback(() => {
    cambia((una) => ({ ...una, dibujos: [] }), { deshacer: true });

    borrador.current = null;
    setSeleccion(null);
    setConfirmaVaciar(false);

    toast.success("Pizarra en blanco", {
      action: { label: "Deshacer", onClick: () => deshace() },
    });
  }, [cambia, deshace]);

  /** Elige herramienta desde la barra o el teclado, y la recuerda en su grupo. */
  const eligeHerramienta = useCallback(
    (tipo: TipoDibujo | "mano") => {
      borrador.current = null;
      setSeleccion(null);
      alHerramienta(tipo);

      if (tipo === "mano") return;

      const grupo = GRUPOS_HERRAMIENTAS.find((uno) => uno.tipos.includes(tipo));

      if (grupo) setUltimas((antes) => ({ ...antes, [grupo.grupo]: tipo }));
    },
    [alHerramienta],
  );

  /*
  | Volver a pulsar «A» con la flecha puesta cambia su estilo (normal,
  | conducción, doble punta, en el suelo). Va por un `ref` porque el oyente
  | del teclado se registra una vez y necesita lo elegido de ahora mismo.
  */
  const cicloEstilo = useRef<() => void>(() => undefined);

  const estiloActual: EstiloFlecha =
    (elegido?.tipo === "flecha" ? elegido.estilo : undefined) ?? ajustes.estilo ?? "normal";

  useEffect(() => {
    cicloEstilo.current = () => {
      if (elegido && elegido.tipo !== "flecha") return;

      const orden = ESTILOS_FLECHA.map((uno) => uno.estilo);
      const siguiente = orden[(orden.indexOf(estiloActual) + 1) % orden.length];

      ponAjuste({ estilo: siguiente });

      toast.info(
        `Flecha: ${ESTILOS_FLECHA.find((uno) => uno.estilo === siguiente)?.nombre ?? ""}`,
      );
    };
  });

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
        else if (grupoAbiertoRef.current) setGrupoAbierto(null);
        else if (seleccionRef.current) setSeleccion(null);
        else alSalir();

        setConfirmaVaciar(false);

        return;
      }

      if (evento.key === "Enter" && borrador.current) {
        evento.preventDefault();
        cierraPoligono();
        return;
      }

      /*
      | Un rótulo elegido se reabre con Intro o F2.
      |
      | Se podía corregir de dos maneras —doble clic encima, o el campo de la
      | barra— y ninguna se ve. Intro sobre lo elegido es lo que hace todo el
      | mundo, y F2 es lo que hace quien viene de una hoja de cálculo.
      */
      if (
        (evento.key === "Enter" || evento.key === "F2") &&
        !evento.ctrlKey &&
        !evento.metaKey
      ) {
        /* Por el ref, como el resto de atajos: el oyente se registra una vez y
           con `seleccion` a secas miraría lo que estuviera elegido entonces. */
        const suyo = localRef.current.dibujos.find(
          (uno) => uno.id === seleccionRef.current,
        );

        if (suyo && esEscribible(suyo.tipo)) {
          evento.preventDefault();
          setEscribiendo(suyo.id);

          return;
        }
      }

      const conMando = evento.ctrlKey || evento.metaKey;
      const letra = evento.key.toLowerCase();

      /* Rehacer: Ctrl+Y, o Ctrl+Mayús+Z como en el Mac. */
      if (conMando && (letra === "y" || (letra === "z" && evento.shiftKey))) {
        evento.preventDefault();
        rehace();
        return;
      }

      if (conMando && letra === "z") {
        evento.preventDefault();
        deshace();
        return;
      }

      if (conMando && letra === "d") {
        evento.preventDefault();
        duplicaElegido();
        return;
      }

      if (conMando || evento.altKey) return;

      if (evento.key === "Delete" || evento.key === "Backspace") {
        evento.preventDefault();
        borraElegido();
        return;
      }

      /* Corchetes: al frente y al fondo, como en cualquier editor. */
      if (evento.key === "]" || evento.key === "[") {
        evento.preventDefault();
        ordenaElegido(evento.key === "]" ? "frente" : "fondo");
        return;
      }

      if (letra === "v") {
        evento.preventDefault();
        eligeHerramienta("mano");
        return;
      }

      const nueva = HERRAMIENTAS.find((una) => una.tecla === letra);

      if (nueva) {
        evento.preventDefault();

        if (nueva.tipo === "flecha" && herramientaRef.current === "flecha") {
          cicloEstilo.current();
          return;
        }

        eligeHerramienta(nueva.tipo);
      }
    };

    window.addEventListener("keydown", escucha, true);

    return () => window.removeEventListener("keydown", escucha, true);
  }, [
    alSalir,
    borraElegido,
    cierraPoligono,
    deshace,
    duplicaElegido,
    eligeHerramienta,
    ordenaElegido,
    rehace,
  ]);

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

  /* Dónde se abre el cuadro de escribir: el texto donde se pinchó; la
     llamada, donde va su chapa (el primer punto es lo que señala). */
  const anclaTexto = enTexto
    ? enTexto.tipo === "llamada"
      ? (enTexto.puntos[1] ?? enTexto.puntos[0])
      : enTexto.puntos[0]
    : null;

  /* ---------------------------------------------------------- vista */

  return (
    <>
      <canvas
        ref={lienzoRef}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={(evento) => {
          if (evento.isPrimary) alSoltar();
        }}
        onPointerCancel={(evento) => {
          if (evento.isPrimary) alSoltar();
        }}
        onDoubleClick={alDobleClic}
        style={{ width: encaje.ancho, height: encaje.alto }}
        /* `touch-none`: el dedo pinta y no mueve la página. Sin selección ni
           el menú de mantener pulsado del iPad, que salía al dejar el dedo
           quieto al empezar una flecha. */
        className={`pointer-events-auto absolute left-0 top-0 touch-none select-none [-webkit-touch-callout:none] ${
          herramienta === "mano" ? "cursor-pointer" : "cursor-crosshair"
        }`}
      />

      {/* --------------------------------- las herramientas ---------- */}

{/*
        LA BARRA SE PARTE EN COLUMNAS CUANDO NO CABE DE ALTO.
        Eran diecinueve botones en una sola columna, sin tope de alto y sin
        forma de desplazarla: con el vídeo en una ventana baja —media pantalla,
        un portátil, el móvil de lado— los de abajo se salían del hueco y NO
        HABÍA MANERA de llegar a ellos. La cota y el fuera de juego, que son
        los últimos, no existían. Con `flex-wrap` y el alto limitado al del
        vídeo, lo que no cabe salta a una segunda columna al lado, y a una
        tercera si hace falta: siempre se ven todas.
      */}
      {/*
        Y DESDE EL 30/10/2026 VA POR GRUPOS.
        Con las nueve herramientas nuevas eran veintisiete botones: ni en
        columnas cabían sin taparle medio vídeo al analista. Ahora son seis
        (la mano y cinco grupos); cada grupo enseña lo último que se usó de él
        y despliega el resto a su derecha, con nombre y tecla. Las teclas van
        directas a cada herramienta, así que quien ya se las sabe no nota nada.
      */}
      {/*
        Y EN EL TELÉFONO, EN DOS COLUMNAS Y ARRIBA (31/10/2026).
        De pie, el vídeo mide unos 220 px de alto, y seis botones de 40 px en
        columna no caben: el último quedaba fuera. En dos columnas son tres
        filas y la barra se pega arriba para no pisar los ajustes de abajo.
      */}
      <div className="pointer-events-auto absolute left-2 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-xl border border-white/10 bg-[#0B0F14]/92 p-1.5 backdrop-blur max-sm:top-2 max-sm:grid max-sm:translate-y-0 max-sm:grid-cols-2">
        <BotonHerramienta
          activo={herramienta === "mano"}
          titulo="Elegir y mover (V)"
          icono={ICONOS.mano}
          onClick={() => {
            setGrupoAbierto(null);
            eligeHerramienta("mano");
          }}
        />

        <span className="my-0.5 h-px w-8 shrink-0 bg-white/10 max-sm:hidden pointer-coarse:w-10" />

        {GRUPOS_HERRAMIENTAS.map((grupo) => (
          <GrupoBarra
            key={grupo.grupo}
            nombre={grupo.nombre}
            tipos={grupo.tipos}
            herramienta={herramienta}
            ultima={ultimas[grupo.grupo]}
            abierto={grupoAbierto === grupo.grupo}
            alAbrir={(abrir) => setGrupoAbierto(abrir ? grupo.grupo : null)}
            alElegir={eligeHerramienta}
          />
        ))}
      </div>

      {/* ------------------------------------------- la cabecera ----- */}

      {/* En el teléfono no cabe en una fila junto a la barra de la izquierda:
          se parte en dos renglones, pegados a la derecha. */}
      <div className="pointer-events-auto absolute right-2 top-2 flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0B0F14]/92 px-2 py-1.5 backdrop-blur max-sm:max-w-[calc(100%-7.5rem)] max-sm:flex-wrap max-sm:justify-end max-sm:gap-1 max-sm:px-1.5 max-sm:py-1">
        <span className="font-mono text-[11px] tabular-nums text-[#C8A96B]">
          {formateaMs(local.tMs)}
        </span>

        <span className="h-3.5 w-px bg-white/10 max-sm:hidden" />

        <button
          type="button"
          title="Deshacer (Ctrl+Z)"
          aria-label="Deshacer el último trazo"
          onClick={deshace}
          className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Undo2 size={14} />
        </button>

        <button
          type="button"
          title="Rehacer (Ctrl+Y)"
          aria-label="Rehacer lo deshecho"
          onClick={rehace}
          className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Redo2 size={14} />
        </button>

        <button
          type="button"
          title="Guardar la pizarra como imagen"
          aria-label="Guardar la pizarra como imagen"
          onClick={exportaPng}
          className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Camera size={14} />
        </button>

        <button
          type="button"
          title="Pantalla completa"
          aria-label="Pantalla completa"
          onClick={pantallaCompleta}
          className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Maximize2 size={14} />
        </button>

        <span className="relative">
          <button
            type="button"
            title="Quitar todos los dibujos (pide confirmación y se puede deshacer)"
            aria-label="Quitar todos los dibujos"
            aria-expanded={confirmaVaciar}
            onClick={() => {
              if (localRef.current.dibujos.length === 0) {
                toast.info("La pizarra ya está en blanco");
                return;
              }

              setConfirmaVaciar((antes) => !antes);
            }}
            className={`rounded-lg p-1 transition hover:bg-white/10 hover:text-red-300 ${
              confirmaVaciar ? "bg-red-500/15 text-red-300" : "text-white/50"
            }`}
          >
            <Eraser size={14} />
          </button>

          {/* La confirmación, en la propia barra: nada de ventanas del
              navegador que congelen la pantalla. */}
          {confirmaVaciar && (
            <span
              role="alertdialog"
              aria-label="Confirmar quitar todos los dibujos"
              className="absolute right-0 top-full z-10 mt-2 flex w-56 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-xl border border-red-400/30 bg-[#0B0F14]/[0.96] p-2.5 text-[11px] text-white/80 shadow-xl backdrop-blur"
            >
              <span>
                ¿Quitar {local.dibujos.length === 1 ? "el dibujo" : `los ${local.dibujos.length} dibujos`} de esta pizarra? Se puede deshacer.
              </span>

              <span className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmaVaciar(false)}
                  className="rounded-lg border border-white/10 px-2 py-1 text-white/60 transition hover:text-white"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={vacia}
                  className="rounded-lg bg-red-500/80 px-2 py-1 font-semibold text-white transition hover:bg-red-500"
                >
                  Quitar todo
                </button>
              </span>
            </span>
          )}
        </span>

        <span className="h-3.5 w-px bg-white/10 max-sm:hidden" />

        <button
          type="button"
          onClick={() => {
            alCambiar(localRef.current);
            alSalir();
          }}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#C8A96B] px-2 py-1 text-[11px] font-semibold text-black transition hover:bg-[#d8bc82] pointer-coarse:px-3"
        >
          <Check size={13} />
          Listo
        </button>
      </div>

      {/* --------------------------------------- los ajustes --------- */}

      {/* Y la de abajo tampoco puede comerse el vídeo: en una ventana
          estrecha los mandos se parten en cuatro o cinco renglones, así que se
          le pone tope y se desplaza. */}
      <div className="pointer-events-auto absolute bottom-2 left-2 right-2 max-h-[45%] overflow-y-auto rounded-xl border border-white/10 bg-[#0B0F14]/92 backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto px-2 py-1.5 [scrollbar-width:thin] [&>*]:shrink-0">
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

            {/* Cualquier otro color: la camiseta del rival rara vez es uno de
                los nueve de la paleta. */}
            <label
              title="Otro color"
              className="relative h-5 w-5 cursor-pointer overflow-hidden rounded-md border border-white/20 hover:border-white/60 pointer-coarse:h-10 pointer-coarse:w-10"
              style={{
                background:
                  "conic-gradient(#ef4444, #f59e0b, #22c55e, #22d3ee, #3b82f6, #a855f7, #ef4444)",
              }}
            >
              <input
                type="color"
                aria-label="Otro color"
                value={hex6(elegido?.color ?? ajustes.color)}
                onChange={(evento) => ponAjuste({ color: evento.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
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

          {/*
            Cerrar el polígono sin teclado ni doble clic (31/10/2026). Con el
            dedo no había forma: el doble toque no llega igual en todas las
            tablets y el Intro no existe. Sólo para las que se cierran a mano
            (las de vértices fijos, como el triángulo, se cierran solas).
          */}
          {!elegido &&
            herramienta !== "mano" &&
            formaDe(herramienta) === "muchos" &&
            !esTrazoLibre(herramienta) &&
            !verticesFijos(herramienta) && (
              <button
                type="button"
                onClick={cierraPoligono}
                title="Cerrar lo que se está dibujando punto a punto (Intro o doble clic)"
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#C8A96B]/60 bg-[#C8A96B]/15 px-2 py-1 text-[11px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/25"
              >
                <Check size={13} />
                Terminar
              </button>
            )}

          {/* Cómo se usa lo que hay en la mano: con tantas herramientas, el
              «doble clic para terminar» no se adivina. */}
          {!elegido && herramienta !== "mano" && (
            <span
              title={HERRAMIENTAS.find((una) => una.tipo === herramienta)?.ayuda}
              className="ml-auto hidden min-w-0 max-w-[45%] truncate text-[10px] text-white/40 md:block"
            >
              <span className="text-[#C8A96B]/80">
                {HERRAMIENTAS.find((una) => una.tipo === herramienta)?.nombre}
              </span>
              {" · "}
              {HERRAMIENTAS.find((una) => una.tipo === herramienta)?.ayuda}
            </span>
          )}

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
          <div className="flex items-center gap-2 overflow-x-auto border-t border-white/10 px-2 py-1.5 [scrollbar-width:thin] [&>*]:shrink-0">
            {tipoActivo === "flecha" && (
              <span
                role="group"
                aria-label="Estilo de la flecha"
                className="flex items-center gap-0.5 rounded-lg border border-white/10 p-0.5"
              >
                {ESTILOS_FLECHA.map((uno) => (
                  <button
                    key={uno.estilo}
                    type="button"
                    title={`${uno.ayuda} (pulsa A otra vez para cambiar)`}
                    aria-pressed={estiloActual === uno.estilo}
                    onClick={() => ponAjuste({ estilo: uno.estilo })}
                    className={`rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] transition ${
                      estiloActual === uno.estilo
                        ? "bg-[#C8A96B]/20 text-[#C8A96B]"
                        : "text-white/45 hover:text-white"
                    }`}
                  >
                    {uno.nombre}
                  </button>
                ))}
              </span>
            )}

            {tipoActivo === "muro" && (
              <Deslizador
                etiqueta="Altura"
                valor={elegido?.altura ?? ajustes.altura ?? 0.14}
                min={0.04}
                max={0.4}
                paso={0.01}
                onChange={(valor) => ponAjuste({ altura: valor })}
              />
            )}

            {tipoActivo === "rejilla" && (
              <>
                <Deslizador
                  etiqueta="Carriles"
                  valor={elegido?.carriles ?? ajustes.carriles ?? 5}
                  min={1}
                  max={8}
                  onChange={(valor) => ponAjuste({ carriles: valor })}
                />

                <Deslizador
                  etiqueta="Alturas"
                  valor={elegido?.alturas ?? ajustes.alturas ?? 0}
                  min={0}
                  max={6}
                  onChange={(valor) => ponAjuste({ alturas: valor })}
                />
              </>
            )}

            {tipoActivo === "cadena" && (
              <Deslizador
                etiqueta="Aro"
                valor={elegido?.radio ?? ajustes.radio ?? 0.018}
                min={0.008}
                max={0.06}
                paso={0.002}
                onChange={(valor) => ponAjuste({ radio: valor })}
              />
            )}

            {tipoActivo === "recuento" && (
              <label
                title="El color del rival"
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-white/40"
              >
                Rival
                <input
                  type="color"
                  aria-label="Color del rival"
                  value={hex6(elegido?.colorB ?? ajustes.colorB, "#ef4444")}
                  onChange={(evento) => ponAjuste({ colorB: evento.target.value })}
                  className="h-5 w-6 cursor-pointer rounded border border-white/20 bg-transparent p-0"
                />
              </label>
            )}

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

            {tipoActivo === "pasillo" && (
              <Deslizador
                etiqueta="Ancho"
                valor={elegido?.radio ?? ajustes.radio ?? 0.055}
                min={0.02}
                max={0.25}
                paso={0.005}
                onChange={(valor) => ponAjuste({ radio: valor })}
              />
            )}

            {tipoActivo === "cono" && (
              <Deslizador
                etiqueta="Apertura"
                valor={elegido?.apertura ?? ajustes.apertura ?? 0.32}
                min={0}
                max={1}
                paso={0.02}
                onChange={(valor) => ponAjuste({ apertura: valor })}
              />
            )}

            {tipoActivo === "numero" && (
              <Deslizador
                etiqueta="Tamaño"
                valor={elegido?.radio ?? ajustes.radio ?? 0.026}
                min={0.012}
                max={0.07}
                paso={0.002}
                onChange={(valor) => ponAjuste({ radio: valor })}
              />
            )}

            {(tipoActivo === "anillo" ||
              tipoActivo === "lupa" ||
              tipoActivo === "haz" ||
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
              tipoActivo === "numero" ||
              tipoActivo === "seleccion" ||
              tipoActivo === "haz" ||
              tipoActivo === "chapa" ||
              tipoActivo === "recuento") && (
              <input
                value={elegido?.etiqueta ?? ""}
                onChange={(evento) => ponAjuste({ etiqueta: evento.target.value })}
                placeholder={
                  tipoActivo === "numero"
                    ? "1"
                    : tipoActivo === "chapa"
                      ? "Dorsal"
                      : tipoActivo === "recuento"
                        ? "Nuestros"
                        : "Dorsal o nombre"
                }
                aria-label={
                  tipoActivo === "numero"
                    ? "Número"
                    : tipoActivo === "chapa"
                      ? "Dorsal"
                      : tipoActivo === "recuento"
                        ? "Cuántos nuestros"
                        : "Dorsal o nombre"
                }
                disabled={!elegido}
                className={`rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#C8A96B]/50 disabled:opacity-40 ${
                  tipoActivo === "chapa" || tipoActivo === "recuento" ? "w-20" : "w-28"
                }`}
              />
            )}

            {(tipoActivo === "medida" ||
              tipoActivo === "fuera-juego" ||
              tipoActivo === "zona" ||
              tipoActivo === "texto" ||
              tipoActivo === "pasillo" ||
              tipoActivo === "cono" ||
              tipoActivo === "numero" ||
              tipoActivo === "seleccion" ||
              tipoActivo === "muro" ||
              tipoActivo === "rejilla" ||
              tipoActivo === "cadena" ||
              tipoActivo === "llamada" ||
              tipoActivo === "haz" ||
              tipoActivo === "chapa" ||
              tipoActivo === "recuento" ||
              tipoActivo === "triangulo") && (
              <input
                value={elegido?.texto ?? ""}
                onChange={(evento) => ponAjuste({ texto: evento.target.value })}
                placeholder={
                  tipoActivo === "medida"
                    ? "12 m"
                    : tipoActivo === "texto" || tipoActivo === "llamada"
                      ? "El texto"
                      : tipoActivo === "chapa"
                        ? "Nombre"
                        : tipoActivo === "recuento"
                          ? "Rivales"
                          : tipoActivo === "cadena"
                            ? "8 m / 12 m / 9 m"
                            : "Rótulo"
                }
                aria-label={
                  tipoActivo === "chapa"
                    ? "Nombre del jugador"
                    : tipoActivo === "recuento"
                      ? "Cuántos rivales"
                      : tipoActivo === "cadena"
                        ? "Distancias de cada tramo"
                        : "Rótulo"
                }
                disabled={!elegido}
                /*
                | Ancho según lo que se escriba.
                |
                | Estaba fijo en 96 px para todos. En una cota cabe «12 m», pero
                | en un rótulo de pizarra cabe una frase, y en 96 px no se lee
                | lo que uno acaba de escribir: parecía que no se podía
                | corregir.
                */
                className={`rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#C8A96B]/50 disabled:opacity-40 ${
                  tipoActivo === "texto" || tipoActivo === "llamada"
                    ? "w-56"
                    : tipoActivo === "cadena" || tipoActivo === "chapa"
                      ? "w-36"
                      : tipoActivo === "recuento"
                        ? "w-20"
                        : "w-24"
                }`}
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
                title="Duplicar el dibujo elegido (Ctrl+D)"
                aria-label="Duplicar el dibujo elegido"
                className="rounded-lg p-1 text-white/45 transition hover:text-white disabled:opacity-30"
              >
                <Copy size={14} />
              </button>

              <button
                type="button"
                onClick={() => ordenaElegido("frente")}
                disabled={!elegido}
                title="Traer al frente (])"
                aria-label="Traer al frente el dibujo elegido"
                className="rounded-lg p-1 text-white/45 transition hover:text-white disabled:opacity-30"
              >
                <BringToFront size={14} />
              </button>

              <button
                type="button"
                onClick={() => ordenaElegido("fondo")}
                disabled={!elegido}
                title="Enviar al fondo ([)"
                aria-label="Enviar al fondo el dibujo elegido"
                className="rounded-lg p-1 text-white/45 transition hover:text-white disabled:opacity-30"
              >
                <SendToBack size={14} />
              </button>

              <button
                type="button"
                onClick={borraElegido}
                disabled={!elegido}
                title="Borrar el dibujo (Supr)"
                aria-label="Borrar el dibujo elegido"
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
                title="Borrar la pizarra entera (el aviso trae «Deshacer»)"
                className="rounded-lg border border-red-400/25 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-red-300/80 transition hover:border-red-400/60"
              >
                Borrar pizarra
              </button>
            </span>
          </div>
        )}
      </div>

      {/* ------------------------------------------- el texto -------- */}

      {enTexto && anclaTexto && (
        <div
          className="pointer-events-auto absolute"
          style={{
            left: Math.min(
              Math.max(
                0,
                anclaTexto.x * encaje.ancho - (enTexto.tipo === "llamada" ? 144 : 0),
              ),
              Math.max(0, encaje.ancho - 290),
            ),
            top: Math.max(0, anclaTexto.y * encaje.alto - 20),
          }}
        >
          <textarea
            autoFocus
            rows={3}
            value={enTexto.texto}
            aria-label="Texto de la pizarra"
            placeholder="Escribe y pulsa Intro"
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
            className="w-72 resize-none rounded-xl border border-[#C8A96B]/50 bg-[#0B0F14]/[0.96] px-2.5 py-2 text-[12px] leading-snug text-white outline-none placeholder:text-white/30"
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
  if (usaRadio(dibujo.tipo)) return dibujo;

  /* El número es un clic: no hay recorrido que exigirle. */
  if (dibujo.tipo === "numero" || dibujo.tipo === "recuento") return dibujo;

  if (esTrazoLibre(dibujo.tipo)) return dibujo.puntos.length >= 3 ? dibujo : null;

  const [a, b] = dibujo.puntos;

  if (!b) return null;

  const recorrido = Math.hypot(b.x - a.x, (b.y - a.y) * aspecto);

  if (recorrido >= 0.02) return dibujo;

  /*
  | La etiqueta y la llamada también valen con un clic: la chapa sale encima
  | de la cabeza y el bocadillo arriba a la derecha de lo que se señala, que
  | es donde los pondría cualquiera. Se recolocan luego con su tirador.
  */
  if (dibujo.tipo === "chapa") {
    return { ...dibujo, puntos: [a, { x: a.x, y: Math.max(0.04, a.y - 0.08) }] };
  }

  if (dibujo.tipo === "llamada") {
    return {
      ...dibujo,
      puntos: [
        a,
        { x: Math.min(0.9, a.x + 0.09), y: Math.max(0.06, a.y - 0.12) },
      ],
    };
  }

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
      className="siempre-oscuro pointer-events-none absolute"
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
            /* A la izquierda del tirador de tamaño del vídeo, que va en la esquina:
               montados en el mismo sitio, el tirador tapaba la palabra. */
            /* En el teléfono el tirador no está (el vídeo va de borde a borde),
               y con el dedo el tirador mide 40 px: se aparta más. */
            className="pointer-events-auto absolute bottom-3 right-11 inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#11161C]/85 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur transition hover:border-[#C8A96B]/60 hover:text-white max-sm:bottom-2 max-sm:right-2 pointer-coarse:min-h-10 sm:pointer-coarse:right-14"
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
  nombre: nombreMostrado,
  indice,
  activa,
  alAbrir,
  alEditar,
  alRepartir,
  alBorrar,
  alMover,
  alRenombrar,
  tiempoVideoMs,
  duracionVideoMs = 0,
  fps = 25,
}: {
  escena: EscenaTel;
  /** El nombre que se enseña, que puede ser el que se le calcula al vuelo. */
  nombre?: string;
  indice: number;
  activa: boolean;
  alAbrir: () => void;
  alEditar: () => void;
  /** Abre el reparto de esta pizarra entre varios cortes. */
  alRepartir?: () => void;
  alBorrar: () => void;
  /**
   * Llevar lo pintado a otro instante del vídeo.
   *
   * Marcando en directo la pausa se hace tarde, y el dibujo se quedaba
   * clavado donde cayó: para moverlo medio segundo había que borrarlo y
   * repetirlo entero. Los dibujos van en proporciones del lienzo, así que
   * mover la pizarra en el tiempo no toca el dibujo, sólo el fotograma de
   * debajo.
   */
  alMover?: (tMs: number) => void;
  /** Ponerle nombre a la pizarra: se ve aquí y en la línea de tiempo. */
  alRenombrar?: (nombre: string) => void;
  /** Dónde va el vídeo ahora mismo, para poder traerla aquí de un botón. */
  tiempoVideoMs?: number;
  duracionVideoMs?: number;
  fps?: number;
}) {
  const nombre =
    (nombreMostrado ?? escena.nombre).trim() || `Pizarra ${indice + 1}`;

  const reutilizada = escena.clipIds?.length ?? 0;

  /* El panel de ajuste, cerrado: la lista tiene que seguir leyéndose. */
  const [ajustando, setAjustando] = useState(false);

  const unFotograma = Math.max(1, Math.round(1000 / Math.max(1, fps)));

  const lleva = (ms: number) => {
    if (!alMover) return;

    const techo =
      duracionVideoMs > 0 ? duracionVideoMs : Number.MAX_SAFE_INTEGER;

    alMover(Math.max(0, Math.min(techo, Math.round(escena.tMs + ms))));
  };

  return (
    <div
      className={`rounded-xl border transition ${
        activa
          ? "border-[#C8A96B]/50 bg-[#C8A96B]/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/20"
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
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

          {/*
          | Con palabras (19/10/2026): «3 · 4s · ❄ 3s» había que saber leerlo.
          | El título lo cuenta entero para quien pase el ratón.
          */}
          <span
            className="shrink-0 text-[10px] text-white/35"
            title={`${escena.dibujos.length} ${
              escena.dibujos.length === 1 ? "dibujo" : "dibujos"
            } · se ve ${Math.round(escena.duracionMs / 1000)} s${
              escena.congelada
                ? escena.pausaMs > 0
                  ? ` · el vídeo se para ${Math.round(escena.pausaMs / 1000)} s y sigue solo`
                  : " · el vídeo se queda parado hasta darle al play"
                : ""
            }`}
          >
            {escena.dibujos.length === 0
              ? "vacía"
              : `${escena.dibujos.length} ${
                  escena.dibujos.length === 1 ? "dibujo" : "dibujos"
                }`}{" "}
            · {Math.round(escena.duracionMs / 1000)} s
            {escena.congelada
              ? escena.pausaMs > 0
                ? ` · ❄ para ${Math.round(escena.pausaMs / 1000)} s`
                : " · ❄ parada"
              : ""}
          </span>
        </button>

        {(alMover || alRenombrar) && (
          <button
            type="button"
            onClick={() => setAjustando((abierto) => !abierto)}
            title="Mover la pizarra en el tiempo y ponerle nombre"
            aria-label="Ajustar la pizarra"
            aria-expanded={ajustando}
            className={`rounded-lg p-1 transition ${
              ajustando ? "text-[#C8A96B]" : "text-white/40 hover:text-white"
            }`}
          >
            <Clock3 size={13} />
          </button>
        )}

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

      {/* ------------------------ MOVERLA Y NOMBRARLA ------------------ */}

      {ajustando && (alMover || alRenombrar) && (
        <div className="space-y-2 border-t border-white/10 px-2.5 py-2">
          {alRenombrar && (
            <input
              value={escena.nombre}
              onChange={(evento) => alRenombrar(evento.target.value)}
              placeholder={`Pizarra ${indice + 1}`}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[12px] text-white/85 outline-none transition focus:border-[#C8A96B]/60"
            />
          )}

          {alMover && (
            <>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => lleva(-1000)}
                  title="Un segundo antes"
                  className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-white/50 transition hover:text-white"
                >
                  <SkipBack size={11} className="inline" /> 1s
                </button>

                <button
                  type="button"
                  onClick={() => lleva(-unFotograma)}
                  title="Un fotograma antes"
                  className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-white/50 transition hover:text-white"
                >
                  ◀ 1f
                </button>

                <span className="min-w-[4.5rem] text-center font-mono text-[11px] tabular-nums text-[#C8A96B]">
                  {formateaMs(escena.tMs)}
                </span>

                <button
                  type="button"
                  onClick={() => lleva(unFotograma)}
                  title="Un fotograma después"
                  className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-white/50 transition hover:text-white"
                >
                  1f ▶
                </button>

                <button
                  type="button"
                  onClick={() => lleva(1000)}
                  title="Un segundo después"
                  className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-white/50 transition hover:text-white"
                >
                  1s <SkipForward size={11} className="inline" />
                </button>
              </div>

              {tiempoVideoMs !== undefined && (
                <button
                  type="button"
                  onClick={() => alMover(Math.max(0, Math.round(tiempoVideoMs)))}
                  disabled={Math.abs(tiempoVideoMs - escena.tMs) < 40}
                  className="w-full rounded-lg border border-[#C8A96B]/40 px-2 py-1 text-[11px] text-[#C8A96B] transition hover:bg-[#C8A96B]/10 disabled:border-white/10 disabled:text-white/25"
                >
                  Traerla a donde va el vídeo ({formateaMs(tiempoVideoMs)})
                </button>
              )}

              <p className="text-[10px] leading-relaxed text-white/30">
                El dibujo no se toca: lo que cambia es el fotograma de debajo.
                En la línea de tiempo también se arrastra la muesca dorada.
              </p>
            </>
          )}
        </div>
      )}
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
