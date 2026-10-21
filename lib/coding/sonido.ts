/**
 * CODING · el sonido de cada corte, igualado en el navegador.
 *
 * Lo mismo que hace el servidor con `loudnorm` (-16 LUFS y un fundido de
 * 0,25 s al entrar y al salir), hecho a mano sobre las muestras ya
 * descodificadas del motor WebCodecs (`rapido.ts`).
 *
 * No es una medida de sonoridad de estudio —sin el filtro K de la norma—, es
 * un nivel medio por corte: lo que hace falta para que el grito de la grada
 * del minuto 80 y el corte siguiente casi mudo suenen parecido.
 */

/*
| El nivel al que se lleva cada corte. Con -17 dB de media salía a -17,8 LUFS
| medido con `ebur128` sobre el partido de prueba; con -16, cerca de los -16
| del servidor.
*/
const OBJETIVO_RMS = 10 ** (-16 / 20);

/** Ni se multiplica por más de 4 (ruido de fondo) ni se baja de una cuarta parte. */
const GANANCIA_MAX = 4;
const GANANCIA_MIN = 0.25;

/** Por debajo de esto es silencio: no cuenta para el nivel medio. */
const SILENCIO = 10 ** (-50 / 20);

const FUNDIDO_S = 0.25;

/**
 * Iguala y funde las muestras de un corte, en el sitio.
 *
 * Los picos que la ganancia sacaría de escala se doblan con una curva suave
 * en vez de recortarse: un recorte seco es un chasquido.
 */
export function igualaSonido(canales: Float32Array[], frecuencia: number) {
  let suma = 0;
  let cuantas = 0;

  for (const canal of canales) {
    for (let i = 0; i < canal.length; i += 1) {
      const v = canal[i];

      if (Math.abs(v) < SILENCIO) continue;

      suma += v * v;
      cuantas += 1;
    }
  }

  const rms = cuantas > 0 ? Math.sqrt(suma / cuantas) : 0;
  const ganancia =
    rms > 0
      ? Math.min(GANANCIA_MAX, Math.max(GANANCIA_MIN, OBJETIVO_RMS / rms))
      : 1;

  const largo = canales[0]?.length ?? 0;
  const fundido = Math.min(Math.round(FUNDIDO_S * frecuencia), Math.floor(largo / 3));

  for (const canal of canales) {
    for (let i = 0; i < canal.length; i += 1) {
      let v = canal[i] * ganancia;

      /* Por encima de 0,9, una curva que nunca llega a 1. */
      if (v > 0.9) v = 0.9 + 0.1 * Math.tanh((v - 0.9) / 0.1);
      else if (v < -0.9) v = -0.9 - 0.1 * Math.tanh((-v - 0.9) / 0.1);

      if (fundido > 0) {
        if (i < fundido) v *= i / fundido;
        else if (i >= canal.length - fundido) v *= (canal.length - 1 - i) / fundido;
      }

      canal[i] = v;
    }
  }

  return ganancia;
}
