/*
| La lectura rápida de una pantalla de balón parado (02/11/2026).
|
| El analista pidió subir el nivel de ABP y saques de banda: el cuerpo técnico
| abría la pantalla y se encontraba una lista de frases y veinte gráficos. Lo
| que busca en diez segundos es otra cosa: qué funciona, qué falla y qué hay
| que entrenar, con la cifra y la muestra que lo sostienen.
|
| Es una cuenta pura y la comparten las cuatro pantallas (córner y falta a
| favor y en contra, saque de banda a favor y en contra): cada una dice qué es
| un acierto para ella, si subir es bueno o malo, y por qué dimensiones se
| puede cortar. El resto —buscar el grupo que más se aparta del resto y cuántas
| acciones explica esa diferencia— es igual en todas.
*/

import type { JornadaAbp } from "@/lib/abp/partido";

export type DimensionLectura<T> = {
  /** «zona de caída», «rutina», «tipo de envío»… */
  nombre: string;
  /** El valor de la fila en esa dimensión; vacío = la fila no cuenta aquí. */
  categoria: (fila: T) => string;
  /** Cómo se dice el valor en una frase («primer palo», «envío largo»). */
  rotulo?: (valor: string) => string;
  /** La tarea de entrenamiento cuando esta dimensión es la que falla. */
  entrenar?: (valor: string) => string;
};

export type HallazgoLectura = {
  dimension: string;
  valor: string;
  n: number;
  aciertos: number;
  tasa: number;
  /** La tasa del resto de acciones con dato en la misma dimensión. */
  tasaResto: number;
  /*
  | 10/11/2026 (jueces): el «resto» con el que se compara, con su cuenta. La
  | etiqueta decía «los otros N» con N = total − grupo, pero la tasa sale de
  | las acciones CON DATO en esa dimensión: «2 de 6 · los otros 11, 100 %» era
  | imposible con 11 de 17 retenidos. Ahora se escribe «los otros: 9 de 11».
  */
  /** Acciones con dato en la misma dimensión que no son del grupo. */
  resto: number;
  /** Aciertos de ese resto. */
  aciertosResto: number;
  /** Acciones que explica la diferencia con el resto (siempre positiva). */
  impacto: number;
};

export type LecturaRapida = {
  base: { n: number; jornadas: number; aciertos: number; tasa: number };
  funciona: HallazgoLectura | null;
  falla: HallazgoLectura | null;
  entrenar: { titulo: string; hallazgo: HallazgoLectura } | null;
};

export function lecturaRapida<T>({
  filas,
  acierto,
  mejorAlto,
  jornada,
  dimensiones,
}: {
  filas: T[];
  /** Lo que la pantalla cuenta como acierto (gol u ocasión, retención…). */
  acierto: (fila: T) => boolean;
  /** En las defensivas, si el acierto es del rival, subir es peor. */
  mejorAlto: boolean;
  jornada: (fila: T) => JornadaAbp;
  dimensiones: DimensionLectura<T>[];
}): LecturaRapida | null {
  const n = filas.length;

  /* Con menos de 8 acciones no hay grupo que se pueda comparar con nada. */
  if (n < 8) return null;

  const aciertos = filas.filter(acierto).length;
  const base = {
    n,
    jornadas: new Set(filas.map((fila) => jornada(fila).clave)).size,
    aciertos,
    tasa: aciertos / n,
  };

  /* Un grupo necesita al menos 3 acciones y un 10 % de la muestra: con dos
     córners cualquier zona sale al 100 %. */
  const minimo = Math.max(3, Math.ceil(n * 0.1));
  const candidatos: (HallazgoLectura & { bondad: number; dim: DimensionLectura<T> })[] = [];

  for (const dim of dimensiones) {
    const grupos = new Map<string, { n: number; aciertos: number }>();
    let conDato = 0;
    let aciertosConDato = 0;

    for (const fila of filas) {
      const valor = (dim.categoria(fila) || "").trim();

      if (!valor) continue;

      const ok = acierto(fila);
      const grupo = grupos.get(valor) ?? { n: 0, aciertos: 0 };

      grupo.n += 1;
      grupo.aciertos += ok ? 1 : 0;
      grupos.set(valor, grupo);
      conDato += 1;
      aciertosConDato += ok ? 1 : 0;
    }

    /* Una dimensión con un solo valor no compara nada. */
    if (grupos.size < 2) continue;

    for (const [valor, grupo] of grupos) {
      const resto = conDato - grupo.n;

      if (grupo.n < minimo || resto < minimo) continue;

      const tasa = grupo.aciertos / grupo.n;
      const tasaResto = (aciertosConDato - grupo.aciertos) / resto;
      const diferencia = tasa - tasaResto;

      /* Menos de 8 puntos de diferencia es ruido a este tamaño de muestra. */
      if (Math.abs(diferencia) < 0.08) continue;

      candidatos.push({
        dimension: dim.nombre,
        valor: dim.rotulo ? dim.rotulo(valor) : valor,
        n: grupo.n,
        aciertos: grupo.aciertos,
        tasa,
        tasaResto,
        resto,
        aciertosResto: aciertosConDato - grupo.aciertos,
        impacto: Math.abs(diferencia) * grupo.n,
        /* Positivo = mejor para nosotros; pesa por volumen para que un grupo
           grande que falla un poco cuente más que uno de tres que falla mucho. */
        bondad: (mejorAlto ? diferencia : -diferencia) * grupo.n,
        dim,
      });
    }
  }

  const ordenados = [...candidatos].sort((a, b) => b.bondad - a.bondad);
  const mejor = ordenados[0] && ordenados[0].bondad > 0 ? ordenados[0] : null;
  const peor =
    ordenados.length && ordenados[ordenados.length - 1].bondad < 0
      ? ordenados[ordenados.length - 1]
      : null;

  const limpio = (h: (typeof candidatos)[number] | null): HallazgoLectura | null =>
    h
      ? {
          dimension: h.dimension,
          valor: h.valor,
          n: h.n,
          aciertos: h.aciertos,
          tasa: h.tasa,
          tasaResto: h.tasaResto,
          resto: h.resto,
          aciertosResto: h.aciertosResto,
          impacto: h.impacto,
        }
      : null;

  const falla = limpio(peor);

  let entrenar: LecturaRapida["entrenar"] = null;

  /* La tarea sale de lo que falla, y sólo si la diferencia explica al menos
     una acción entera: «0 acciones» no es una tarea. */
  if (peor && falla && Math.round(falla.impacto) >= 1) {
    entrenar = {
      titulo: peor.dim.entrenar
        ? peor.dim.entrenar(falla.valor)
        : `${capital(peor.dim.nombre)}: ${falla.valor}`,
      hallazgo: falla,
    };
  }

  if (!mejor && !falla) return null;

  return { base, funciona: limpio(mejor), falla, entrenar };
}

function capital(texto: string) {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto;
}
