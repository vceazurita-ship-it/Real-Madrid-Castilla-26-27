/*
|--------------------------------------------------------------------------
| LA BANDA SONORA DEL VÍDEO, COMPUESTA AQUÍ (13/10/2026)
|--------------------------------------------------------------------------
|
| El vídeo ya no lleva voz en off (lo pidió el cuerpo técnico): lleva música
| de retransmisión, sintetizada muestra a muestra, sin nada que licenciar ni
| cuota que gastar. Vale en el navegador y en Node (sólo aritmética).
|
| La pieza, a 118 pulsaciones en la menor (Am · F · C · G):
|   - bombo a negras, caja con palmada en 2 y 4, charles a corcheas con el
|     contratiempo acentuado y un abierto al final de cada compás;
|   - bajo en corcheas con la fundamental y su octava, filtrado;
|   - colchón de acordes con sierras desafinadas y un arpegio en semicorcheas;
|   - en cada cambio de escena, un barrido que sube y un golpe grave; en cada
|     gol, un impacto con platillo.
| Arreglo: entrada con el colchón y el charles filtrado, el ritmo completo,
| y un cierre que se apaga con un último golpe. Bajo los cortes del partido la
| música se aparta (se queda al 55 %) para que se oiga el estadio.
*/

export type OpcionesMusica = {
  /** Lo que dura el vídeo, en segundos. */
  total: number;
  /** Los segundos en que empieza cada escena (sin el 0). */
  cortes: number[];
  /** Tramos [desde, hasta] con cortes del partido: la música baja para dejar oír el estadio. */
  tramosConSonido?: [number, number][];
  /** Los segundos de cada gol: impacto y platillo. */
  golpes?: number[];
  frecuencia: number;
};

const BPM = 118;

/* Am, F, C, G: fundamental del bajo y notas del acorde (Hz). */
const ACORDES = [
  { bajo: 55.0, notas: [220.0, 261.63, 329.63, 440.0] },
  { bajo: 43.65, notas: [174.61, 220.0, 261.63, 349.23] },
  { bajo: 65.41, notas: [196.0, 261.63, 329.63, 392.0] },
  { bajo: 49.0, notas: [196.0, 246.94, 293.66, 392.0] },
];

/** Azar con semilla: la misma pieza cada vez, y el mismo ruido en los dos motores. */
function azar(semilla = 20261013) {
  let s = semilla >>> 0;

  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;

    return s / 4294967296;
  };
}

const sierra = (fase: number) => 2 * (fase - Math.floor(fase + 0.5));
const triangulo = (fase: number) => 1 - 4 * Math.abs(fase - Math.floor(fase + 0.5));

export function bandaSonora({ total, cortes, tramosConSonido = [], golpes = [], frecuencia }: OpcionesMusica): Float32Array {
  const n = Math.ceil(total * frecuencia);
  const salida = new Float32Array(n);
  const pulso = 60 / BPM;
  const compas = pulso * 4;
  const ruido = azar();
  const dt = 1 / frecuencia;

  /* Filtros de un polo, con su estado. */
  let lpBajo = 0;
  let lpBajo2 = 0;
  let lpColchon = 0;
  let hpCharles = 0;
  let ultimoRuidoCharles = 0;
  let lpCaja = 0;
  const fases = new Float64Array(16);

  const entrada = Math.min(4, total * 0.12);
  const finCierre = Math.max(entrada + 2, total - 3.5);

  for (let i = 0; i < n; i += 1) {
    const t = i * dt;
    const enCompas = t % compas;
    const nCompas = Math.floor(t / compas);
    const acorde = ACORDES[nCompas % ACORDES.length];
    const enPulso = t % pulso;
    const nPulso = Math.floor(t / pulso) % 4;
    const enCorchea = t % (pulso / 2);
    const nCorchea = Math.floor(t / (pulso / 2)) % 8;
    const enSemi = t % (pulso / 4);
    const nSemi = Math.floor(t / (pulso / 4)) % 16;

    /* El arreglo: cuánto suena cada capa ahora. */
    const intro = t < entrada;
    const cierre = t > finCierre;
    const ritmo = intro ? 0 : cierre ? Math.max(0, 1 - (t - finCierre) / 2.5) : 1;
    const general = Math.min(1, t / 1.2, Math.max(0, (total - t) / 1.8));
    let x = 0;

    /* Bombo: barrido de 120 a 45 Hz. */
    if (ritmo > 0) {
      const f = 45 + 75 * Math.exp(-enPulso * 28);

      fases[0] += f * dt;
      x += Math.sin(2 * Math.PI * fases[0]) * Math.exp(-enPulso * 9) * 0.55 * ritmo;

      if (enPulso < dt) fases[0] = 0;
    }

    /* Caja con palmada, en 2 y 4. */
    if (ritmo > 0 && (nPulso === 1 || nPulso === 3)) {
      const r = ruido() * 2 - 1;

      lpCaja += 0.35 * (r - lpCaja);
      const cuerpo = Math.sin(2 * Math.PI * 185 * enPulso) * Math.exp(-enPulso * 30);
      const palmada = (r - lpCaja) * (Math.exp(-enPulso * 22) + 0.6 * Math.exp(-Math.max(0, enPulso - 0.012) * 40));

      x += (cuerpo * 0.18 + palmada * 0.22) * ritmo;
    }

    /* Charles: corcheas, el contratiempo más fuerte, abierto en la última. */
    {
      const r = ruido() * 2 - 1;

      hpCharles = 0.92 * (hpCharles + r - ultimoRuidoCharles);
      ultimoRuidoCharles = r;

      const abierto = nCorchea === 7;
      const caida = abierto ? 9 : 55;
      const nivel = (nCorchea % 2 === 1 ? 0.07 : 0.04) * (intro ? 0.5 : ritmo);

      x += hpCharles * Math.exp(-enCorchea * caida) * nivel;
    }

    /* Bajo: corcheas con la fundamental y la octava, filtrado por dos polos. */
    if (ritmo > 0) {
      const nota = acorde.bajo * (nCorchea % 4 === 3 ? 2 : 1);

      fases[1] += nota * dt;
      const crudo = sierra(fases[1]) * 0.6 + Math.sin(2 * Math.PI * fases[1]) * 0.6;
      const env = Math.min(1, enCorchea / 0.004) * Math.exp(-enCorchea * 5);

      lpBajo += 0.06 * (crudo * env - lpBajo);
      lpBajo2 += 0.06 * (lpBajo - lpBajo2);
      x += lpBajo2 * 0.42 * ritmo;
    }

    /* Colchón: las cuatro notas del acorde con dos sierras desafinadas cada una. */
    {
      let c = 0;

      for (let k = 0; k < 4; k += 1) {
        const f = acorde.notas[k];

        fases[2 + k * 2] += f * 1.003 * dt;
        fases[3 + k * 2] += f * 0.997 * dt;
        c += sierra(fases[2 + k * 2]) + sierra(fases[3 + k * 2]);
      }

      /* El filtro se abre al entrar el ritmo y respira con el compás. */
      const corte = (intro ? 0.02 + 0.03 * (t / Math.max(0.1, entrada)) : 0.05) + 0.015 * Math.sin((2 * Math.PI * enCompas) / compas);
      const ataque = Math.min(1, enCompas / 0.08);

      lpColchon += corte * (c - lpColchon);
      x += lpColchon * 0.03 * ataque * (cierre ? 0.8 : 1);
    }

    /* Arpegio en semicorcheas (sube y baja por el acorde), con su eco. */
    if (ritmo > 0) {
      const orden = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 3, 1];
      const f = acorde.notas[orden[nSemi]] * 2;

      fases[10] += f * dt;
      x += triangulo(fases[10]) * Math.exp(-enSemi * 24) * 0.045 * ritmo;
    }

    salida[i] = x * general;
  }

  /* Eco del arpegio y del conjunto: un retardo a corchea con puntillo, suave. */
  const retardo = Math.round(pulso * 0.75 * frecuencia);

  for (let i = retardo; i < n; i += 1) salida[i] += salida[i - retardo] * 0.18;

  /* Transiciones: barrido que sube antes de cada cambio de escena y golpe al llegar. */
  const fx = azar(7);

  for (const c of cortes) {
    const desde = Math.round((c - 0.9) * frecuencia);
    let bp = 0;
    let bp2 = 0;

    for (let i = Math.max(0, desde); i < Math.min(n, desde + Math.round(0.9 * frecuencia)); i += 1) {
      const p = (i - desde) / (0.9 * frecuencia);
      const a = 0.04 + 0.4 * p * p;

      bp += a * (fx() * 2 - 1 - bp);
      bp2 += a * (bp - bp2);
      salida[i] += (bp - bp2) * p * p * 0.35;
    }

    const llegada = Math.round(c * frecuencia);
    let fase = 0;

    for (let i = llegada; i < Math.min(n, llegada + Math.round(0.6 * frecuencia)); i += 1) {
      const s = (i - llegada) / frecuencia;

      fase += (38 + 60 * Math.exp(-s * 18)) / frecuencia;
      salida[i] += Math.sin(2 * Math.PI * fase) * Math.exp(-s * 6) * 0.35 + (fx() * 2 - 1) * Math.exp(-s * 40) * 0.12;
    }
  }

  /* Goles: impacto grave y platillo largo. */
  for (const g of golpes) {
    const desde = Math.round(g * frecuencia);
    let fase = 0;
    let hp = 0;
    let previo = 0;

    for (let i = desde; i < Math.min(n, desde + Math.round(2.2 * frecuencia)); i += 1) {
      const s = (i - desde) / frecuencia;
      const r = fx() * 2 - 1;

      hp = 0.85 * (hp + r - previo);
      previo = r;
      fase += (32 + 50 * Math.exp(-s * 10)) / frecuencia;
      salida[i] += Math.sin(2 * Math.PI * fase) * Math.exp(-s * 3.5) * 0.4 + hp * Math.exp(-s * 2.2) * 0.1;
    }
  }

  /* Bajo los cortes del partido, la música se aparta con fundidos de 0,4 s. */
  if (tramosConSonido.length) {
    for (let i = 0; i < n; i += 1) {
      const t = i * dt;
      let g = 1;

      for (const [a, b] of tramosConSonido) {
        const dentro = Math.min(1, Math.max(0, (t - a) / 0.4), Math.max(0, (b - t) / 0.4));

        g = Math.min(g, 1 - 0.45 * dentro);
      }

      salida[i] *= g;
    }
  }

  /* Al final: saturación suave y nivel de salida (pico ~0,62: el sonido del estadio va encima). */
  let pico = 0;

  for (let i = 0; i < n; i += 1) {
    salida[i] = Math.tanh(salida[i] * 1.4);
    pico = Math.max(pico, Math.abs(salida[i]));
  }

  const ganancia = pico > 0 ? 0.62 / pico : 1;

  for (let i = 0; i < n; i += 1) salida[i] *= ganancia;

  return salida;
}

/**
 * El nivel de la mezcla como lo oye la gente, no la media de todo el fichero
 * (20/10/2026, crítica del editor: «sonido igualado entre vídeos»): bloques
 * de 0,4 s, y fuera los silencios (por debajo de −70 dB) y los tramos que
 * quedan 10 dB por debajo de la media de los demás, como hace la medida de
 * sonoridad de la tele (EBU R128). Así un vídeo con pausas o con mucho estadio
 * bajo no sale más alto que otro: los dos acaban igual de fuertes.
 */
export function rmsConPuerta(pista: Float32Array, frecuencia = 48_000) {
  const bloque = Math.max(1, Math.round(0.4 * frecuencia));
  const energias: number[] = [];

  for (let i = 0; i < pista.length; i += bloque) {
    const fin = Math.min(pista.length, i + bloque);
    let suma = 0;

    for (let j = i; j < fin; j += 1) suma += pista[j] * pista[j];

    energias.push(suma / Math.max(1, fin - i));
  }

  const absoluta = 1e-7; /* −70 dB */
  const sobre = energias.filter((e) => e > absoluta);

  if (!sobre.length) return 0;

  const relativa = (sobre.reduce((s, e) => s + e, 0) / sobre.length) * 0.1; /* −10 dB */
  const validos = sobre.filter((e) => e > relativa);
  const media = (validos.length ? validos : sobre).reduce((s, e) => s + e, 0) / (validos.length || sobre.length);

  return Math.sqrt(media);
}

/**
 * La masterización de la mezcla final (música + estadio), en su sitio: se
 * lleva a ~-17 LUFS en mono, que suena como -14 en estéreo (RMS objetivo 0,19), y se limita con una
 * saturación suave por debajo de 0 dB. Sin esto el vídeo salía a -21 LUFS,
 * flojo al lado de cualquier vídeo del móvil.
 */
export function masteriza(pista: Float32Array, rmsObjetivo = 0.19, frecuencia = 48_000) {
  const rms = rmsConPuerta(pista, frecuencia);
  const ganancia = rms > 1e-5 ? Math.min(4, rmsObjetivo / rms) : 1;
  const techo = 0.97;

  for (let i = 0; i < pista.length; i += 1) pista[i] = techo * Math.tanh((pista[i] * ganancia) / techo);

  return pista;
}
