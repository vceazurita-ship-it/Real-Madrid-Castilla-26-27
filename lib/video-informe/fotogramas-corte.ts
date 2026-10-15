/*
|--------------------------------------------------------------------------
| LOS FOTOGRAMAS DE UN CORTE, CON WEBCODECS (15/10/2026)
|--------------------------------------------------------------------------
|
| El montaje del navegador pedía cada fotograma a un `<video>` parado
| (`currentTime` + `seeked` + `drawImage`). Chrome no garantiza que un vídeo
| que no se reproduce tenga la imagen descodificada —y con la pestaña en
| segundo plano directamente no la descodifica—, así que la escena salía con
| el título sobre el fondo y sin la jugada. Medido en Chrome sin ventana: los
| cinco cortes de una prueba, vacíos.
|
| Aquí no hay `<video>`: se recorre el MP4 con el lector propio del coding
| (`lib/coding/mp4.ts`) y se descodifica con `VideoDecoder`, siempre hacia
| delante y a medida que el montaje pide cada instante. Se guarda sólo el
| fotograma que se está enseñando; los demás se cierran en el acto (el
| descodificador de Chrome se para si se le retienen más de nueve, ver
| `lib/coding/rapido.ts`).
*/

import { abreMp4, claveAntesDe, LectorMuestras, type PistaMp4 } from "@/lib/coding/mp4";

const respira = () => new Promise<void>((r) => setTimeout(r, 0));

export class FotogramasCorte {
  private descodificador: VideoDecoder | null = null;
  private cola: VideoFrame[] = [];
  private actual: VideoFrame | null = null;
  private siguiente = 0;
  private vaciado = false;
  private fallo = false;

  private constructor(
    private readonly pista: PistaMp4,
    private readonly config: VideoDecoderConfig,
    private readonly lector: LectorMuestras,
    /** Lo que dura el fichero, en segundos. */
    readonly duracion: number,
  ) {}

  /** El corte listo para pedirle fotogramas, o `null` si no es un MP4 que este navegador descodifique. */
  static async abre(fichero: Blob): Promise<FotogramasCorte | null> {
    if (typeof VideoDecoder === "undefined") return null;

    const abierto = await abreMp4(fichero).catch(() => null);
    const pista = abierto?.video;

    if (!pista || !pista.n) return null;

    const config: VideoDecoderConfig = {
      codec: pista.codec,
      description: pista.descripcion ?? undefined,
      codedWidth: pista.ancho,
      codedHeight: pista.alto,
      hardwareAcceleration: "no-preference",
    };

    try {
      if (!(await VideoDecoder.isConfigSupported(config)).supported) return null;
    } catch {
      return null;
    }

    const ultimo = pista.n - 1;
    const duracion = (pista.ptsUs[ultimo] + pista.duracionUs[ultimo] - pista.ptsUs[0]) / 1e6;

    return new FotogramasCorte(pista, config, new LectorMuestras(fichero), duracion);
  }

  private arranca(us: number) {
    this.cierra();

    this.fallo = false;
    this.vaciado = false;
    this.descodificador = new VideoDecoder({
      output: (f) => this.cola.push(f),
      error: () => {
        this.fallo = true;
      },
    });
    this.descodificador.configure(this.config);
    this.siguiente = claveAntesDe(this.pista, us);
  }

  /**
   * El fotograma que se ve en el segundo `s` del fichero (desde su primer
   * fotograma). Hacia delante es barato; hacia atrás vuelve a empezar desde el
   * fotograma clave anterior. `null` si no se ha podido descodificar nada.
   */
  async en(s: number): Promise<VideoFrame | null> {
    const us = this.pista.ptsUs[0] + Math.max(0, s) * 1e6;

    if (!this.descodificador || this.descodificador.state === "closed" || (this.actual && us < this.actual.timestamp - 1000)) this.arranca(us);

    const dec = this.descodificador!;

    for (let vuelta = 0; vuelta < 5000; vuelta += 1) {
      /* Lo ya descodificado que no pasa de este instante: el último es el que se ve. */
      while (this.cola.length && this.cola[0].timestamp <= us + 500) {
        this.actual?.close();
        this.actual = this.cola.shift()!;
      }

      /* El siguiente ya es de más adelante: el actual es el bueno (o, si aún no hay, el primero). */
      if (this.cola.length) return this.actual ?? this.cola[0];

      if (this.fallo) return this.actual;

      if (this.siguiente >= this.pista.n) {
        if (!this.vaciado && dec.state === "configured") {
          this.vaciado = true;
          await dec.flush().catch(() => undefined);
          continue;
        }

        return this.actual;
      }

      for (let k = 0; k < 4 && this.siguiente < this.pista.n; k += 1) {
        const i = this.siguiente++;
        const datos = await this.lector.dame(this.pista.offsets[i], this.pista.tam[i]);

        dec.decode(new EncodedVideoChunk({ type: this.pista.clave[i] ? "key" : "delta", timestamp: this.pista.ptsUs[i], duration: this.pista.duracionUs[i], data: datos }));
      }

      await respira();
    }

    return this.actual;
  }

  /** Suelta el descodificador y los fotogramas; se puede volver a pedir (arranca de nuevo). */
  cierra() {
    for (const f of this.cola) f.close();

    this.cola = [];
    this.actual?.close();
    this.actual = null;

    if (this.descodificador && this.descodificador.state !== "closed") this.descodificador.close();

    this.descodificador = null;
  }
}
