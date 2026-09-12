import {
  METRICA_POR_KEY,
  formatea,
  type Metrica,
  type Unidad,
} from "./metricas";

/**
 * Lo que dice cada gráfico, escrito.
 *
 * Un dibujo enseña una forma; no dice qué hacer con ella. Y en un cuerpo
 * técnico de ocho personas, un gráfico sin frase debajo se lee de ocho maneras:
 * el que quería atacar ve que hay que atacar y el que quería replegarse ve que
 * hay que replegarse.
 *
 * Las frases de aquí se calculan **con los mismos números que el dibujo**, así
 * que no pueden contradecirlo, y están escritas para el que va a decidir algo:
 * no «el percentil es 12» sino «se circula de lado más que casi nadie». Cuando
 * los datos no dan para afirmar —dos partidos, un solo valor—, lo dicen en vez
 * de redondear hacia una conclusión.
 */

/** «por encima de 17 de los 21» y cosas así. */
function conCuantos(percentil: number, total: number) {
  const porDebajo = Math.round((percentil / 100) * total);

  return `por delante de ${porDebajo} de los ${total}`;
}

/** Un aviso cuando la muestra es demasiado corta para afirmar nada. */
export function avisoDeMuestra(partidos: number) {
  if (partidos >= 8) return null;

  if (partidos <= 2) {
    return `Con ${partidos} ${partidos === 1 ? "partido" : "partidos"} esto es una foto, no una tendencia: un rival fuerte o un expulsado mueven cualquier número.`;
  }

  return `Con ${partidos} partidos conviene leerlo con prudencia: hace falta alrededor de un tercio de liga para que estas cifras se asienten.`;
}

/* ------------------------------------------------------------------ */
/*  UN GRUPO DE PERCENTILES                                            */
/* ------------------------------------------------------------------ */

export type FilaLectura = {
  key: string;
  percentil: number | null;
  valor: number | null;
  mediana: number | null;
};

/**
 * La lectura de un bloque entero: dónde se está fuerte y dónde no.
 *
 * Se apoya en los extremos —lo mejor y lo peor— porque es lo accionable: la
 * media de doce percentiles no se puede entrenar.
 */
export function lecturaDeGrupo(filas: FilaLectura[]) {
  const utiles = filas
    .map((fila) => ({
      ...fila,
      metrica: METRICA_POR_KEY.get(fila.key),
    }))
    .filter(
      (fila): fila is typeof fila & { percentil: number; metrica: Metrica } =>
        fila.percentil !== null &&
        Boolean(fila.metrica) &&
        fila.metrica!.mejorAlto !== null,
    );

  if (utiles.length < 2) return null;

  const ordenadas = [...utiles].sort((a, b) => b.percentil - a.percentil);

  const arriba = ordenadas[0];
  const abajo = ordenadas[ordenadas.length - 1];

  const porEncima = utiles.filter((f) => f.percentil >= 50).length;

  const total = utiles.length;

  return {
    resumen: `En ${porEncima} de ${total} métricas de este bloque se está por encima de la mediana de la liga.`,
    fuerte:
      arriba.percentil >= 60
        ? `Lo más fuerte: ${arriba.metrica.nombre.toLowerCase()} (p${Math.round(arriba.percentil)}).`
        : null,
    debil:
      abajo.percentil <= 40
        ? `Lo más flojo: ${abajo.metrica.nombre.toLowerCase()} (p${Math.round(abajo.percentil)}).`
        : null,
  };
}

/* ------------------------------------------------------------------ */
/*  UNA MÉTRICA CONTRA LA LIGA                                         */
/* ------------------------------------------------------------------ */

export function lecturaDeMetrica(
  metrica: Metrica,
  valor: number | null,
  medianaLiga: number | null,
  percentil: number | null,
  deCuantos: number,
) {
  if (valor === null || medianaLiga === null || percentil === null) {
    return "No hay dato suficiente de esta métrica en la temporada elegida.";
  }

  const diferencia = valor - medianaLiga;

  const sentido =
    metrica.mejorAlto === null
      ? diferencia > 0
        ? "más que"
        : "menos que"
      : percentil >= 50
        ? "mejor que"
        : "peor que";

  const cuanto =
    Math.abs(medianaLiga) > 0.001
      ? `${Math.abs((diferencia / medianaLiga) * 100).toFixed(0)} %`
      : "—";

  if (metrica.mejorAlto === null) {
    return `${formatea(valor, metrica.unidad)} frente a ${formatea(medianaLiga, metrica.unidad)} de la liga: un ${cuanto} ${sentido} la mediana. Es estilo, no rendimiento: dice cómo se juega, no si se juega bien.`;
  }

  return `${formatea(valor, metrica.unidad)} frente a ${formatea(medianaLiga, metrica.unidad)} de la liga, ${sentido} la mediana y ${conCuantos(percentil, deCuantos)}.`;
}

/* ------------------------------------------------------------------ */
/*  UNA COMPOSICIÓN                                                    */
/* ------------------------------------------------------------------ */

/**
 * Cómo se dice cada composición.
 *
 * «65 de cada 100 remates salen de ataque posicional» funciona; «49 de cada 100
 * pases salen de en horizontal» no. El sustantivo y el verbo cambian con lo que
 * se esté repartiendo, así que los pone quien llama, no la función.
 */
export type FraseComposicion = {
  /** «remates», «pases», «recuperaciones». */
  sustantivo: string;
  /** «salen de», «van», «se producen en». */
  verbo: string;
  /** Cómo se llama a un trozo: «vía», «dirección», «zona». */
  trozo: string;
};

export function lecturaDeComposicion(
  trozos: { etiqueta: string; valor: number }[],
  trozosLiga: { etiqueta: string; valor: number }[] | undefined,
  frase: FraseComposicion,
) {
  const total = trozos.reduce((s, t) => s + t.valor, 0);

  if (total <= 0) return `No hay ${frase.sustantivo} en el periodo elegido.`;

  const mayor = [...trozos].sort((a, b) => b.valor - a.valor)[0];

  const parte = (mayor.valor / total) * 100;

  let texto = `${parte.toFixed(0)} de cada 100 ${frase.sustantivo} ${frase.verbo} ${mayor.etiqueta.toLowerCase()}.`;

  if (trozosLiga) {
    const totalLiga = trozosLiga.reduce((s, t) => s + t.valor, 0);

    const suyo = trozosLiga.find((t) => t.etiqueta === mayor.etiqueta);

    if (totalLiga > 0 && suyo) {
      const parteLiga = (suyo.valor / totalLiga) * 100;

      const brecha = parte - parteLiga;

      texto +=
        Math.abs(brecha) < 3
          ? ` La liga reparte casi igual (${parteLiga.toFixed(0)} %).`
          : ` La liga está en ${parteLiga.toFixed(0)} %, así que se carga ${brecha > 0 ? "más" : "menos"} que el resto en esa ${frase.trozo}.`;
    }
  }

  return texto;
}

/* ------------------------------------------------------------------ */
/*  UNA DISTRIBUCIÓN                                                   */
/* ------------------------------------------------------------------ */

export function lecturaDeDistribucion(
  puntos: { etiqueta: string; valor: number; nota?: string }[],
  unidad: Unidad,
  nombre: string,
  mejorAlto: boolean | null,
) {
  if (puntos.length < 2) return null;

  const valores = puntos.map((p) => p.valor);

  const min = Math.min(...valores);
  const max = Math.max(...valores);

  const media = valores.reduce((a, b) => a + b, 0) / valores.length;

  /* La desviación relativa dice si el equipo es regular o va a rachas. */
  const desviacion = Math.sqrt(
    valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length,
  );

  const relativa = Math.abs(media) > 0.001 ? desviacion / Math.abs(media) : 0;

  const mejorPartido =
    mejorAlto === false
      ? puntos.find((p) => p.valor === min)
      : puntos.find((p) => p.valor === max);

  const regularidad =
    relativa < 0.2
      ? "Es un equipo regular en esto: los partidos se parecen entre sí."
      : relativa > 0.45
        ? "Cambia mucho de un partido a otro, así que la media engaña: depende del rival o del plan."
        : "Hay variación normal entre partidos.";

  return `Entre ${formatea(min, unidad)} y ${formatea(max, unidad)}, con media de ${formatea(media, unidad)}. ${regularidad}${
    mejorPartido && mejorAlto !== null
      ? ` El mejor registro fue ${mejorPartido.etiqueta}${mejorPartido.nota ? ` (${mejorPartido.nota})` : ""}.`
      : ""
  }`;
}

/* ------------------------------------------------------------------ */
/*  A FAVOR Y EN CONTRA                                                */
/* ------------------------------------------------------------------ */

export function lecturaDeEnfrentado(
  pares: {
    etiqueta: string;
    aFavor: number | null;
    enContra: number | null;
    masEsMejor: boolean;
    unidad: Unidad;
  }[],
) {
  const utiles = pares.filter(
    (p): p is typeof p & { aFavor: number; enContra: number } =>
      p.aFavor !== null && p.enContra !== null,
  );

  if (utiles.length === 0) return null;

  const ganadas = utiles.filter((p) =>
    p.masEsMejor ? p.aFavor > p.enContra : p.aFavor < p.enContra,
  );

  const mayorBrecha = [...utiles].sort((a, b) => {
    const da = Math.abs(a.aFavor - a.enContra) / Math.max(a.enContra, 0.001);
    const db = Math.abs(b.aFavor - b.enContra) / Math.max(b.enContra, 0.001);

    return db - da;
  })[0];

  const gana = mayorBrecha.masEsMejor
    ? mayorBrecha.aFavor > mayorBrecha.enContra
    : mayorBrecha.aFavor < mayorBrecha.enContra;

  return `Se sale por delante en ${ganadas.length} de ${utiles.length}. La diferencia más marcada está en ${mayorBrecha.etiqueta.toLowerCase()}: ${formatea(mayorBrecha.aFavor, mayorBrecha.unidad)} frente a ${formatea(mayorBrecha.enContra, mayorBrecha.unidad)}, ${gana ? "a favor" : "en contra"}.`;
}

/* ------------------------------------------------------------------ */
/*  EVOLUCIÓN                                                          */
/* ------------------------------------------------------------------ */

export function lecturaDeEvolucion(
  serie: { etiqueta: string; valor: number | null }[],
  unidad: Unidad,
  nombre: string,
  mejorAlto: boolean | null,
) {
  const validos = serie.filter(
    (p): p is { etiqueta: string; valor: number } => p.valor !== null,
  );

  if (validos.length < 2) return null;

  const primero = validos[0];
  const ultimo = validos[validos.length - 1];

  const cambio = ultimo.valor - primero.valor;

  const relativo =
    Math.abs(primero.valor) > 0.001
      ? (cambio / Math.abs(primero.valor)) * 100
      : 0;

  const direccion = cambio > 0 ? "ha subido" : cambio < 0 ? "ha bajado" : "se mantiene";

  const juicio =
    mejorAlto === null || Math.abs(relativo) < 5
      ? ""
      : (cambio > 0) === mejorAlto
        ? " Va en la buena dirección."
        : " Va en la dirección contraria a la que interesa.";

  const mejor = [...validos].sort((a, b) =>
    mejorAlto === false ? a.valor - b.valor : b.valor - a.valor,
  )[0];

  return `De ${primero.etiqueta} a ${ultimo.etiqueta}, ${nombre.toLowerCase()} ${direccion} un ${Math.abs(relativo).toFixed(0)} % (${formatea(primero.valor, unidad)} → ${formatea(ultimo.valor, unidad)}).${juicio} El mejor registro es el de ${mejor.etiqueta} (${formatea(mejor.valor, unidad)}).`;
}

/* ------------------------------------------------------------------ */
/*  LA LIGA ORDENADA                                                   */
/* ------------------------------------------------------------------ */

export function lecturaDeLiga(
  filas: { equipo: string; valor: number | null }[],
  nosotros: string,
  metrica: Metrica,
) {
  const conValor = filas.filter(
    (f): f is { equipo: string; valor: number } => f.valor !== null,
  );

  if (conValor.length < 3) return null;

  const orden = [...conValor].sort((a, b) =>
    metrica.mejorAlto === false ? a.valor - b.valor : b.valor - a.valor,
  );

  const puesto = orden.findIndex((f) => f.equipo === nosotros);

  const lider = orden[0];
  const ultimo = orden[orden.length - 1];

  const nuestro = puesto >= 0 ? orden[puesto] : null;

  const distancia =
    nuestro && Math.abs(lider.valor) > 0.001
      ? Math.abs(((nuestro.valor - lider.valor) / lider.valor) * 100)
      : null;

  return `Manda ${lider.equipo} con ${formatea(lider.valor, metrica.unidad)}; cierra ${ultimo.equipo} con ${formatea(ultimo.valor, metrica.unidad)}.${
    nuestro
      ? ` El Castilla va ${puesto + 1}º de ${orden.length} con ${formatea(nuestro.valor, metrica.unidad)}${
          distancia !== null && puesto > 0
            ? `, un ${distancia.toFixed(0)} % ${metrica.mejorAlto === false ? "por encima" : "por debajo"} del primero`
            : ""
        }.`
      : ""
  }`;
}

/* ------------------------------------------------------------------ */
/*  LA DISPERSIÓN                                                      */
/* ------------------------------------------------------------------ */

export function lecturaDeDispersion(
  puntos: { equipo: string; x: number; y: number }[],
  nosotros: string,
  metX: Metrica,
  metY: Metrica,
) {
  if (puntos.length < 4) return null;

  const xs = puntos.map((p) => p.x).sort((a, b) => a - b);
  const ys = puntos.map((p) => p.y).sort((a, b) => a - b);

  const medX = xs[Math.floor(xs.length / 2)];
  const medY = ys[Math.floor(ys.length / 2)];

  const nuestro = puntos.find((p) => p.equipo === nosotros);

  /* Correlación de Pearson: dice si las dos métricas van juntas en la liga. */
  const n = puntos.length;
  const mediaX = puntos.reduce((s, p) => s + p.x, 0) / n;
  const mediaY = puntos.reduce((s, p) => s + p.y, 0) / n;

  const cov = puntos.reduce((s, p) => s + (p.x - mediaX) * (p.y - mediaY), 0);
  const sx = Math.sqrt(puntos.reduce((s, p) => s + (p.x - mediaX) ** 2, 0));
  const sy = Math.sqrt(puntos.reduce((s, p) => s + (p.y - mediaY) ** 2, 0));

  const r = sx > 0 && sy > 0 ? cov / (sx * sy) : 0;

  const relacion =
    Math.abs(r) < 0.25
      ? "En esta liga las dos cosas van por libre: una no explica la otra."
      : `En esta liga las dos van ${r > 0 ? "de la mano" : "en sentido contrario"} (r = ${r.toFixed(2)}), así que subir una suele ${r > 0 ? "acompañar a" : "costar"} la otra.`;

  if (!nuestro) return relacion;

  const cuadrante = `${nuestro.x >= medX ? "alto" : "bajo"} en ${metX.nombre.toLowerCase()} y ${nuestro.y >= medY ? "alto" : "bajo"} en ${metY.nombre.toLowerCase()}`;

  return `El Castilla queda ${cuadrante} respecto a las medianas. ${relacion}`;
}
