"use client";

/**
 * La pantalla que se pone delante mientras se monta un vídeo.
 *
 * La usan los dos motores —el rápido, que descodifica con WebCodecs, y el de
 * respaldo, que graba el lienzo a tiempo real— y por eso vive aquí y no dentro
 * de ninguno de los dos.
 *
 * Se monta a mano y no con React a propósito: tiene que seguir viva durante
 * todo el montaje pase lo que pase con los renders de la página, y el
 * `<video>` del motor de respaldo tiene que estar **en pantalla** —un vídeo
 * que no se ve no se descodifica igual, y lo que se graba es lo que se
 * descodifica—. De paso hace de puerta: mientras se monta, las teclas del
 * coding no llegan a la página de detrás.
 */

const ORO = "#C8A96B";

/** El mensaje del corte cancelado a mano, para no enseñarlo como un error. */
export const CORTE_CANCELADO = "coding: montaje cancelado";

/** Una pizarra quemada: el fotograma ya compuesto y lo que dura la parada. */
export type ParadaNavegador = {
  /** `data:` URL con el fotograma pintado por `componeEscena`. */
  imagen: string;
  /** Desde el principio del clip. */
  enMs: number;
  duracionMs: number;
};

export type ClipNavegador = {
  /** Nombre del fichero, o ruta dentro del ZIP. **Sin extensión.** */
  nombre: string;
  inicioMs: number;
  finMs: number;
  paradas?: ParadaNavegador[];
};

export type PeticionNavegador = {
  /** El fichero abierto del disco. No se sube: se lee aquí. */
  fichero: Blob;
  clips: ClipNavegador[];
  formato: "clip" | "zip" | "unificado";
  /** Para la pantalla del montaje: «Castilla - Osasuna Promesas». */
  titulo?: string;
  /** La carátula del vídeo unificado, como `data:` URL. */
  portada?: string | null;
  portadaSegundos?: number;
  /** Los fotogramas por segundo de la sesión. */
  fps?: number;
  /**
   * Lo que puede pesar cada fichero de salida, en megas. `0` es sin tope.
   *
   * Un corte se manda por WhatsApp, se sube a un grupo o se lleva en un pen:
   * ahí no importa que el partido viniera a 40 Mb/s, importa que el fichero
   * quepa. El tope se convierte en caudal —lo que quepa entre lo que dura el
   * corte más largo— y se aplica al codificador, así que no hay que recortar
   * ni volver a pasar nada.
   */
  topeMegas?: number;
};

export type ResultadoNavegador = {
  blob: Blob;
  /** `mp4`, `webm` o `zip`. */
  extension: string;
  /** Con qué contenedor han salido los vídeos de dentro. */
  contenedor: "mp4" | "webm";
  conSonido: boolean;
  /** Lo que ha durado el montaje. */
  segundos: number;
  /** Cuántas veces más rápido que el tiempo real ha ido. */
  vecesReal?: number;
};

export type PantallaMontaje = ReturnType<typeof montaEscenario>;

/**
 * Lo que se lanza cuando el montaje deja de avanzar.
 *
 * Se distingue del cancelado a propósito: cancelar es una decisión y no se
 * avisa de nada; atascarse es una avería y hay que decirlo, y en el motor
 * rápido además vale para caerse al de respaldo, que quizá sí acabe.
 */
export const CORTE_ATASCADO = "El montaje se ha quedado atascado.";

export function montaEscenario(titulo: string) {
  /*
  | El vídeo de la pantalla de detrás se para.
  |
  | Componer las pizarras lo deja como estaba —y eso puede ser reproduciendo—,
  | y dos partidos sonando a la vez mientras se monta no hay quien lo aguante.
  */
  for (const otro of document.querySelectorAll("video")) {
    if (!otro.paused) otro.pause();
  }

  const raiz = document.createElement("div");

  raiz.setAttribute("role", "dialog");
  raiz.setAttribute("aria-label", "Montando el vídeo");

  Object.assign(raiz.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    padding: "24px",
    background: "rgba(8,11,15,0.97)",
    color: "#fff",
    font: "13px/1.5 system-ui, -apple-system, Segoe UI, sans-serif",
  });

  const encabezado = document.createElement("div");

  encabezado.style.cssText =
    "text-align:center;letter-spacing:.16em;text-transform:uppercase;" +
    "font-size:10px;color:rgba(255,255,255,.35)";

  encabezado.textContent = titulo;

  const caja = document.createElement("div");

  caja.style.cssText =
    "position:relative;width:min(78vw,980px);aspect-ratio:16 / 9;" +
    "border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.1);" +
    "background:#000";

  const video = document.createElement("video");

  video.preload = "auto";
  video.playsInline = true;
  video.controls = false;

  video.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:contain";

  const lienzo = document.createElement("canvas");

  lienzo.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000";

  caja.append(video, lienzo);

  const paso = document.createElement("div");

  paso.style.cssText =
    "text-align:center;font-size:13px;color:rgba(255,255,255,.8)";

  const canal = document.createElement("div");

  canal.style.cssText =
    "width:min(78vw,980px);height:4px;border-radius:999px;" +
    "background:rgba(255,255,255,.08);overflow:hidden";

  const barra = document.createElement("div");

  barra.style.cssText = `height:100%;width:0%;background:${ORO};transition:width .25s linear`;

  canal.append(barra);

  const aviso = document.createElement("div");

  aviso.style.cssText =
    "max-width:640px;text-align:center;font-size:11px;line-height:1.6;" +
    "color:rgba(255,255,255,.35)";

  const cancelar = document.createElement("button");

  cancelar.type = "button";
  cancelar.textContent = "Cancelar";

  cancelar.style.cssText =
    "border:1px solid rgba(255,255,255,.15);background:transparent;" +
    "color:rgba(255,255,255,.7);border-radius:999px;padding:7px 18px;" +
    "font-size:12px;cursor:pointer";

  let cancelado = false;

  const cancela = () => {
    cancelado = true;

    cancelar.textContent = "Cancelando…";
    cancelar.disabled = true;
  };

  /*
  |--------------------------------------------------------------------------
  | EL VIGÍA: ESTA PANTALLA NO SE QUEDA COLGADA
  |--------------------------------------------------------------------------
  |
  | Un montaje puede atascarse por muchos sitios —un descodificador que se
  | queda tonto con un partido pesado, una grabadora que no suelta un byte, un
  | `seeked` que no llega— y todos acaban igual: la barra parada y nadie sabe
  | si está trabajando o si se ha muerto. En un partido de dos horas eso son
  | veinte minutos de reloj antes de sospechar.
  |
  | Cada motor avisa de lo que va haciendo por `dice()`. Eso es exactamente el
  | pulso: mientras la cuenta avance, hay vida. Si deja de avanzar, primero se
  | dice en pantalla —puede ser un tramo lento de verdad— y si sigue parada, se
  | da por atascado y el montaje se corta con un error que se puede leer.
  |
  | Va aquí y no en cada motor a propósito: es una sola red que cubre los
  | bucles de los dos, los de ahora y los que vengan.
  */

  /** Sin avanzar más de esto, se avisa en pantalla. */
  const AVISA_MS = 20_000;

  /** Y pasado esto, se da por atascado y se corta. */
  const RENDICION_MS = 90_000;

  /**
   * Lo que se le concede a un paso que **no puede informar**.
   *
   * Cerrar el vídeo es una sola llamada al codificador que puede tardar
   * minutos en un montaje largo y no da señales por el camino: con el plazo
   * normal, el vigía mataba un montaje que iba perfectamente. Estos pasos se
   * marcan con `esperando()` y tienen su propio plazo por dentro, así que
   * aquí sólo hace falta un techo por encima de aquél para que la garantía
   * siga en pie.
   */
  const PACIENCIA_MS = 240_000;

  let ultimoAvance = Date.now();
  let ultimaFraccion = -1;
  let atascado = false;

  /*
  | La rendición, como promesa.
  |
  | El aviso por bandera sólo sirve donde alguien lo mire, y un montaje puede
  | quedarse esperando en un sitio **sin bucle**: un `play()` que no arranca,
  | una grabadora que no suelta el primer byte, un descodificador dormido. Ahí
  | no hay vuelta donde comprobar nada, así que el vigía tiene que poder
  | terminar el montaje él mismo. Quien lo lanza corre esta promesa contra la
  | del montaje: pase lo que pase, alguna de las dos contesta.
  */
  let seRinde: (razon: Error) => void = () => undefined;
  let rendicion: Promise<never>;

  /*
  | Se rearma, y hace falta: una promesa rechazada lo está para siempre, así
  | que si el motor rápido se atasca y se cae al de respaldo, éste se
  | encontraría la carrera perdida antes de empezar. `reanuda()` pone una
  | nueva.
  */
  const armaRendicion = () => {
    rendicion = new Promise<never>((_, falla) => {
      seRinde = falla;
    });

    /* Nadie la espera hasta que se corre contra el montaje: sin esto, el
       navegador la contaría como un rechazo sin dueño. */
    rendicion.catch(() => undefined);
  };

  armaRendicion();

  /** Pasos en curso que no pueden informar, con el momento en que empezaron. */
  const esperas = new Map<number, { quien: string; desde: number }>();

  let numeroDeEspera = 0;

  const vigia = window.setInterval(() => {
    if (cancelado || atascado) return;

    /*
    | Con un paso de los que no informan en marcha, el reloj normal no cuenta:
    | lo que se mira es que ese paso no se eternice.
    */
    const enEspera = [...esperas.values()].sort((a, b) => a.desde - b.desde)[0];

    if (enEspera) {
      const rato = Date.now() - enEspera.desde;

      if (rato < PACIENCIA_MS) {
        if (rato >= AVISA_MS) {
          aviso.textContent =
            `${enEspera.quien}… ${Math.round(rato / 1000)} s. Es un paso que no ` +
            "puede ir contando, así que se le deja terminar.";
        }

        /* Mientras dure, el reloj de lo normal no corre. */
        ultimoAvance = Date.now();

        return;
      }

      atascado = true;

      paso.textContent = "El montaje se ha quedado atascado.";

      seRinde(new Error(CORTE_ATASCADO));

      return;
    }

    const parada = Date.now() - ultimoAvance;

    if (parada >= RENDICION_MS) {
      atascado = true;

      paso.textContent = "El montaje se ha quedado atascado.";

      seRinde(new Error(CORTE_ATASCADO));

      return;
    }

    if (parada >= AVISA_MS) {
      const segundos = Math.round(parada / 1000);

      aviso.textContent =
        `Sin avanzar desde hace ${segundos} s. Si es un partido muy pesado ` +
        `puede tardar; si no se mueve, se corta solo en ` +
        `${Math.round((RENDICION_MS - parada) / 1000)} s.`;
    }
  }, 1000);

  cancelar.addEventListener("click", cancela);

  /*
  | Mientras se monta, el teclado es de esta pantalla.
  |
  | La del coding escucha en `window`: sin esto, una tecla suelta durante los
  | minutos del montaje elegiría un jugador o abriría un clip a medias por
  | detrás.
  */
  const teclas = (evento: KeyboardEvent) => {
    evento.stopPropagation();

    if (evento.key === "Escape") {
      evento.preventDefault();
      cancela();
    }
  };

  window.addEventListener("keydown", teclas, true);

  raiz.append(encabezado, caja, paso, canal, aviso, cancelar);

  document.body.append(raiz);

  return {
    video,
    lienzo,

    cancelado: () => cancelado,

    /**
     * El montaje lleva demasiado tiempo sin avanzar.
     *
     * Se mira en los mismos sitios que `cancelado()` —los bucles de los dos
     * motores lo comprueban en cada vuelta— y hace que el montaje salga por
     * su propio pie en vez de quedarse dando vueltas para siempre.
     */
    atascado: () => atascado,

    /**
     * Se rechaza cuando el vigía se rinde. Nunca se cumple.
     *
     * Va contra la promesa del montaje en un `Promise.race`: es lo que
     * garantiza que la llamada termina aunque el motor se haya quedado
     * esperando en un sitio donde no hay bucle que mire la bandera.
     *
     * Es una función y no la promesa suelta porque `reanuda()` la cambia: la
     * carrera tiene que correr contra la de ahora, no contra la que ya
     * perdió el motor anterior.
     */
    rendicion: () => rendicion,

    /**
     * Marca un paso que **no puede informar** de lo que hace.
     *
     * Devuelve la función que lo cierra. Mientras haya alguno abierto, el
     * vigía no cuenta el silencio como atasco —sería matar un montaje que va
     * bien— pero sí vigila que ese paso no se eternice: lo que se envuelve
     * aquí tiene que traer su propio plazo por dentro.
     */
    esperando: (quien: string) => {
      numeroDeEspera += 1;

      const mio = numeroDeEspera;

      esperas.set(mio, { quien, desde: Date.now() });

      return () => {
        esperas.delete(mio);

        ultimoAvance = Date.now();

        aviso.textContent = "";
      };
    },

    /**
     * Borra el atasco y vuelve a contar desde cero.
     *
     * Lo llama el reparto de motores antes de caerse al de respaldo: el que se
     * ha atascado es el rápido, y el otro merece su oportunidad con el
     * cronómetro a cero. Cancelar no se borra nunca: eso lo ha pedido una
     * persona.
     */
    reanuda: () => {
      atascado = false;
      ultimoAvance = Date.now();
      ultimaFraccion = -1;

      /* Lo que estuviera esperando era del motor que se ha caído. */
      esperas.clear();

      aviso.textContent = "";

      armaRendicion();
    },

    /** La letra pequeña de abajo, distinta según el motor que esté montando. */
    explica: (texto: string) => {
      aviso.textContent = texto;
    },

    /** La medida real del vídeo, para que la caja no deforme la vista. */
    encaja: (ancho: number, alto: number) => {
      caja.style.aspectRatio = `${ancho} / ${alto}`;
    },

    /** El `<video>` sólo lo enseña el motor que reproduce para grabar. */
    enseñaVideo: (visible: boolean) => {
      video.style.display = visible ? "" : "none";
    },

    dice: (texto: string, fraccion: number) => {
      if (atascado) return;

      paso.textContent = texto;

      barra.style.width = `${Math.min(100, Math.max(0, fraccion * 100)).toFixed(1)}%`;

      /*
      | El pulso. Se mira la fracción y no el texto: el texto lleva el reloj
      | dentro y cambia cada segundo aunque el montaje no se mueva del sitio,
      | así que serviría de coartada para un atasco.
      */
      if (fraccion !== ultimaFraccion) {
        ultimaFraccion = fraccion;
        ultimoAvance = Date.now();

        aviso.textContent = "";
      }
    },

    cierra: () => {
      window.clearInterval(vigia);

      window.removeEventListener("keydown", teclas, true);

      video.pause();
      video.removeAttribute("src");
      video.load();

      raiz.remove();
    },
  };
}
