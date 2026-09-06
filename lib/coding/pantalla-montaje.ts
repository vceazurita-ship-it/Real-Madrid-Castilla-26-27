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
      paso.textContent = texto;

      barra.style.width = `${Math.min(100, Math.max(0, fraccion * 100)).toFixed(1)}%`;
    },

    cierra: () => {
      window.removeEventListener("keydown", teclas, true);

      video.pause();
      video.removeAttribute("src");
      video.load();

      raiz.remove();
    },
  };
}
