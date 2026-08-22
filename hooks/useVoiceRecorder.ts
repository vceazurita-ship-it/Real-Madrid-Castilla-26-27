"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  MAX_RECORDING_MS,
  VOICE_MIME_TYPE,
  canRecord,
  toBase64,
  toWav,
} from "@/lib/voice/audio";

export type RecorderState = "idle" | "recording" | "encoding";

/** El soporte del navegador no cambia en caliente: no hay a qué suscribirse. */
const NO_SUBSCRIPTION = () => () => {};

export interface VoiceClip {
  /** WAV mono de 16 kHz en base64, sin cabecera `data:`. */
  data: string;
  mimeType: string;
  seconds: number;
}

interface Options {
  /** Se llama con el audio ya convertido en cuanto se detiene la grabación. */
  onClip: (clip: VoiceClip) => void | Promise<void>;
  onError?: (message: string) => void;
  maxMs?: number;
}

interface Result {
  state: RecorderState;
  /** Segundos grabados, para el contador. */
  seconds: number;
  /** Volumen instantáneo entre 0 y 1, para pintar el nivel de voz. */
  level: number;
  supported: boolean;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
}

/**
 * Graba por el micrófono y devuelve el audio listo para enviar al modelo.
 *
 * El navegador entrega WebM/Opus, así que al parar se convierte a WAV (ver
 * `lib/voice/audio`) antes de llamar a `onClip`. `cancel` descarta lo grabado.
 */
export function useVoiceRecorder({
  onClip,
  onError,
  maxMs = MAX_RECORDING_MS,
}: Options): Result {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const discarded = useRef(false);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const limit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meter = useRef<{ context: AudioContext; frame: number } | null>(null);

  /*
   * `canRecord` mira `window`, que en el servidor no existe: el primer pintado
   * da por bueno el soporte y React reajusta al hidratar con el valor real.
   */
  const supported = useSyncExternalStore(NO_SUBSCRIPTION, canRecord, () => true);

  const stopMeter = useCallback(() => {
    if (!meter.current) return;

    cancelAnimationFrame(meter.current.frame);
    void meter.current.context.close();

    meter.current = null;
    setLevel(0);
  }, []);

  const clearTimers = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (limit.current) clearTimeout(limit.current);

    timer.current = null;
    limit.current = null;
  }, []);

  /** Nivel de voz en tiempo real, solo para el indicador visual. */
  const startMeter = useCallback((stream: MediaStream) => {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!Ctor) return;

    const context = new Ctor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;

    context.createMediaStreamSource(stream).connect(analyser);

    const samples = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(samples);

      let sum = 0;

      for (let i = 0; i < samples.length; i += 1) {
        const value = (samples[i] - 128) / 128;
        sum += value * value;
      }

      setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));

      if (meter.current) {
        meter.current.frame = requestAnimationFrame(tick);
      }
    };

    meter.current = { context, frame: requestAnimationFrame(tick) };
  }, []);

  const start = useCallback(async () => {
    if (recorder.current) return;

    if (!canRecord()) {
      onError?.("Este navegador no permite grabar audio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const media = new MediaRecorder(stream);

      chunks.current = [];
      discarded.current = false;
      startedAt.current = Date.now();

      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };

      media.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        stopMeter();
        clearTimers();

        recorder.current = null;

        const elapsed = (Date.now() - startedAt.current) / 1000;
        const parts = chunks.current;

        chunks.current = [];

        if (discarded.current || parts.length === 0) {
          setState("idle");
          setSeconds(0);
          return;
        }

        setState("encoding");

        try {
          const wav = await toWav(new Blob(parts, { type: media.mimeType }));

          await onClip({
            data: await toBase64(wav),
            mimeType: VOICE_MIME_TYPE,
            seconds: Math.round(elapsed),
          });
        } catch (error) {
          console.error("[voz] no se pudo procesar el audio", error);
          onError?.("No se pudo procesar el audio grabado.");
        } finally {
          setState("idle");
          setSeconds(0);
        }
      };

      recorder.current = media;
      media.start();

      setState("recording");
      setSeconds(0);
      startMeter(stream);

      timer.current = setInterval(
        () => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)),
        250
      );

      limit.current = setTimeout(() => media.state !== "inactive" && media.stop(), maxMs);
    } catch (error) {
      console.error("[voz] no se pudo abrir el micrófono", error);
      onError?.("No se pudo acceder al micrófono. Revisa los permisos.");
      setState("idle");
    }
  }, [clearTimers, maxMs, onClip, onError, startMeter, stopMeter]);

  const stop = useCallback(() => {
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    discarded.current = true;
    stop();
  }, [stop]);

  // Al desmontar (cerrar el modal, cambiar de página) se suelta el micrófono.
  useEffect(() => {
    return () => {
      discarded.current = true;

      if (recorder.current?.state !== "inactive") recorder.current?.stop();

      clearTimers();
      stopMeter();
    };
  }, [clearTimers, stopMeter]);

  return { state, seconds, level, supported, start, stop, cancel };
}
