/*
|--------------------------------------------------------------------------
| LA VOZ DEL VÍDEO: REMUESTREO Y REPARTO POR ESCENAS (PURO)
|--------------------------------------------------------------------------
|
| Vale en el navegador y en Node. La voz llega ENTERA en una sola petición
| (la cuota gratuita del TTS de Gemini es de 10 al día: no da para una por
| escena) y aquí se parte: el corte de cada escena se predice por la
| fracción de texto que lleva y se ajusta al silencio más cercano, que es
| la pausa entre párrafos que se le pidió a la voz.
*/

/** La única frecuencia que el codificador AAC de Chrome acepta sin protestar (además de 44,1 kHz). */
export const FRECUENCIA_AAC = 48_000;

/** Remuestreo lineal: para voz a 24 kHz → 48 kHz sobra, y no hace falta nada más. */
export function remuestrea(pista: Float32Array, de: number, a: number): Float32Array {
  if (de === a) return pista;

  const n = Math.round((pista.length * a) / de);
  const salida = new Float32Array(n);
  const paso = de / a;

  for (let i = 0; i < n; i += 1) {
    const x = i * paso;
    const k = Math.floor(x);
    const f = x - k;
    const a0 = pista[k] ?? 0;
    const a1 = pista[k + 1] ?? a0;

    salida[i] = a0 + (a1 - a0) * f;
  }

  return salida;
}

/** PCM de 16 bits con signo, little-endian → flotante [-1, 1]. */
export function pcm16aFlotante(bytes: Uint8Array): Float32Array {
  const enteros = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const flot = new Float32Array(enteros.length);

  for (let i = 0; i < enteros.length; i += 1) flot[i] = enteros[i] / 32768;

  return flot;
}

/** Los silencios de una pista: tramos de al menos `minimoMs` por debajo del umbral, como [inicio, fin] en muestras. */
export function silenciosDe(pista: Float32Array, frecuencia: number, minimoMs = 220, umbral = 0.012) {
  const ventana = Math.round(frecuencia * 0.02);
  const minimo = Math.round(minimoMs / 20);
  const silencios: [number, number][] = [];
  let seguidas = 0;

  for (let i = 0; i + ventana <= pista.length; i += ventana) {
    let energia = 0;

    for (let k = i; k < i + ventana; k += 1) energia += pista[k] * pista[k];

    if (Math.sqrt(energia / ventana) < umbral) seguidas += 1;
    else {
      if (seguidas >= minimo) silencios.push([i - seguidas * ventana, i]);

      seguidas = 0;
    }
  }

  if (seguidas >= minimo) silencios.push([pista.length - seguidas * ventana, pista.length]);

  return silencios;
}

/** Parte la voz entera por escenas: corte previsto por la fracción de texto, ajustado al silencio más cercano (≤1,6 s). */
export function reparteVoz(entera: Float32Array, textos: string[], frecuencia: number): (Float32Array | null)[] {
  const silencios = silenciosDe(entera, frecuencia);
  const primero = silencios[0]?.[0] === 0 ? silencios[0][1] : 0;
  const ultimo = silencios.length && silencios[silencios.length - 1][1] === entera.length ? silencios[silencios.length - 1][0] : entera.length;
  const hablado = Math.max(1, ultimo - primero);

  const largos = textos.map((t) => t.length);
  const totalTexto = largos.reduce((s, n) => s + n, 0) || 1;
  const cortes: number[] = [primero];
  let acumulado = 0;

  for (let k = 0; k < textos.length - 1; k += 1) {
    acumulado += largos[k];

    const previsto = primero + Math.round((acumulado / totalTexto) * hablado);
    const margen = frecuencia * 1.6;
    let mejor = previsto;
    let distancia = Infinity;

    for (const [a, b] of silencios) {
      const centro = Math.round((a + b) / 2);
      const d = Math.abs(centro - previsto);

      if (centro > cortes[cortes.length - 1] && d < distancia && d <= margen) {
        mejor = centro;
        distancia = d;
      }
    }

    cortes.push(Math.max(cortes[cortes.length - 1], mejor));
  }

  cortes.push(ultimo);

  return textos.map((t, k) => (t && cortes[k + 1] > cortes[k] ? entera.slice(cortes[k], cortes[k + 1]) : null));
}

/**
 * Una cama de sonido sintetizada sin WebAudio (vale en Node y de respaldo):
 * un acorde grave muy bajo filtrado, que respira, y un soplo de ruido en
 * cada cambio de escena.
 */
export function camaSintetica(total: number, cortes: number[], frecuencia = FRECUENCIA_AAC): Float32Array {
  const n = Math.ceil(total * frecuencia);
  const salida = new Float32Array(n);
  const voces: [number, number][] = [
    [55, 0.9],
    [110, 0.5],
    [164.81, 0.35],
    [220, 0.25],
    [329.63, 0.12],
  ];
  let filtrado = 0;

  for (let i = 0; i < n; i += 1) {
    const t = i / frecuencia;
    let x = 0;

    for (const [hz, nivel] of voces) x += Math.sin(2 * Math.PI * hz * t) * nivel;

    /* Un paso bajo de un polo cuya frecuencia respira entre 280 y 560 Hz. */
    const fc = 420 + 140 * Math.sin(2 * Math.PI * 0.09 * t);
    const alfa = 1 - Math.exp((-2 * Math.PI * fc) / frecuencia);

    filtrado += alfa * (x - filtrado);

    const envolvente = Math.min(1, t / 2, Math.max(0, (total - t) / 2.5));

    salida[i] = filtrado * 0.03 * envolvente;
  }

  for (const c of cortes) {
    const desde = Math.round(c * frecuencia);
    const largo = Math.round(0.35 * frecuencia);
    let bp = 0;
    let bp2 = 0;

    for (let i = 0; i < largo && desde + i < n; i += 1) {
      const ruido = Math.random() * 2 - 1;

      /* Un paso de banda tosco: dos integradores en cascada. */
      bp += 0.18 * (ruido - bp);
      bp2 += 0.18 * (bp - bp2);

      const env = i < 0.05 * frecuencia ? i / (0.05 * frecuencia) : Math.exp(-(i - 0.05 * frecuencia) / (0.08 * frecuencia));

      salida[desde + i] += (bp - bp2) * 0.5 * env;
    }
  }

  return salida;
}
