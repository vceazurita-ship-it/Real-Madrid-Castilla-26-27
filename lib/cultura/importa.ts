/**
 * Leer el bruto: convertir el HTML montado a mano en un documento del
 * repositorio.
 *
 * Los documentos de cultura se venían redactando como presentaciones HTML —una
 * `div.slide-container` por diapositiva, con el valor en la portada y las
 * conductas en tarjetas—, y de ahí salió el primero. Este módulo lee ese mismo
 * formato y devuelve un `DocumentoCultura`, para que el siguiente no haya que
 * pasarlo a mano a un fichero de datos: se sube el bruto y ya está dentro.
 *
 * Qué se limpia al leer, porque venía sucio del original:
 *
 * - **Las marcas `[cite: 2]`** que dejó la herramienta con la que se redactó.
 *   Iban impresas en las diapositivas.
 * - **El «INADMISIBLE:» del principio del párrafo**, que en el documento nuevo
 *   es la chapa del bloque y estorba repetido.
 * - Los espacios dobles y los saltos de línea del marcado.
 *
 * Lo que **no** se toca es el texto: si el bruto dice «Egoismo» sin tilde, el
 * documento dirá «Egoismo». Corregir la redacción es del cuerpo técnico, no de
 * un lector de ficheros.
 *
 * Se apoya en el `DOMParser` del navegador: el bruto es HTML de verdad —con
 * sus etiquetas mal cerradas y su `<i>` de iconos dentro de los títulos— y
 * leerlo con expresiones regulares sería pedir problemas.
 */

import type {
  BloqueConducta,
  Conducta,
  DiapositivaCultura,
  DocumentoCultura,
  Valor,
} from "@/lib/cultura/modelo";

/* ------------------------------------------------------------------ */
/*  LIMPIEZA                                                           */
/* ------------------------------------------------------------------ */

/** Quita las marcas de cita y aprieta los espacios del marcado. */
function limpia(texto: string) {
  return texto
    .replace(/\[cite[^\]]*\]/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/**
 * El texto de un nodo con sus negritas en `**`.
 *
 * Es el formato que entiende el documento (`partesRicas`), y se escribe así
 * para que el fichero de datos siga siendo legible por quien redacta.
 *
 * Se recorre a trozos con su peso —y no marcando el texto sobre la marcha—
 * por dos motivos: dos `<strong>` seguidos son una sola frase en negrita, y si
 * se marcaran por separado quedaría un `****` en medio; y los espacios de los
 * bordes tienen que quedarse fuera de los asteriscos, o el documento pinta
 * «** para aprender**» con el espacio dentro del resalte.
 */
function textoRico(nodo: Element | null): string {
  if (!nodo) return "";

  const trozos: { texto: string; fuerte: boolean }[] = [];

  const recorre = (actual: Node, fuerte: boolean) => {
    if (actual.nodeType === Node.TEXT_NODE) {
      const texto = actual.textContent ?? "";

      if (texto) trozos.push({ texto, fuerte });

      return;
    }

    if (!(actual instanceof Element)) return;

    const marca =
      fuerte || actual.tagName === "STRONG" || actual.tagName === "B";

    actual.childNodes.forEach((hijo) => recorre(hijo, marca));
  };

  nodo.childNodes.forEach((hijo) => recorre(hijo, false));

  /* Trozos contiguos del mismo peso, en uno solo. */
  const juntos: { texto: string; fuerte: boolean }[] = [];

  for (const trozo of trozos) {
    const ultimo = juntos[juntos.length - 1];

    if (ultimo && ultimo.fuerte === trozo.fuerte) ultimo.texto += trozo.texto;
    else juntos.push({ ...trozo });
  }

  return limpia(
    juntos
      .map(({ texto, fuerte }) => {
        if (!fuerte) return texto;

        const cuerpo = texto.trim();

        if (!cuerpo) return texto;

        const izquierda = /^\s/.test(texto) ? " " : "";
        const derecha = /\s$/.test(texto) ? " " : "";

        return `${izquierda}**${cuerpo}**${derecha}`;
      })
      .join(""),
  );
}

/** El texto plano de un nodo, sin marcas de negrita. */
function textoPlano(nodo: Element | null): string {
  return limpia(nodo?.textContent ?? "");
}

/* ------------------------------------------------------------------ */
/*  PIEZAS DEL BRUTO                                                   */
/* ------------------------------------------------------------------ */

/** «Valor N.º 1 · Votado por 9 jugadores» → `{ numero: 1, votos: "…" }`. */
function leeNumeroYVotos(texto: string, porDefecto: number) {
  const partes = texto.split("·").map((parte) => parte.trim());

  const numero = Number(partes[0]?.match(/\d+/)?.[0] ?? porDefecto);

  return {
    numero: Number.isFinite(numero) && numero > 0 ? numero : porDefecto,
    votos: partes.slice(1).join(" · ").trim(),
  };
}

/** «Humildad vs. Egoísmo (22) y Arrogancia (3)» → «Egoísmo (22) y …». */
function leeAntivalores(titulo: string) {
  const corte = titulo.split(/\s+vs\.?\s+/i);

  return corte.length > 1 ? corte.slice(1).join(" vs. ").trim() : "";
}

/**
 * «En el Campo (Entrenamiento y Partido)» → título y matiz.
 *
 * El paréntesis del original es justo el matiz que el documento nuevo pone
 * como rótulo pequeño debajo del título de la tarjeta.
 */
function leeTituloTarjeta(texto: string) {
  const conParentesis = texto.match(/^(.*?)\s*\(([^)]*)\)\s*$/);

  if (!conParentesis) return { titulo: texto, matiz: "" };

  return {
    titulo: conParentesis[1].trim(),
    matiz: conParentesis[2].trim(),
  };
}

/** Quita el «INADMISIBLE:» de cabeza: en el documento nuevo es una chapa. */
function sinAviso(texto: string) {
  return texto
    .replace(/^\*\*\s*(inadmisible|prohibido)\s*:?\s*\*\*\s*/i, "")
    .replace(/^(inadmisible|prohibido)\s*:\s*/i, "")
    .replace(/\*\*/g, "")
    .trim();
}

/** Una tarjeta de conductas del bruto. */
function leeTarjeta(tarjeta: Element, indice: number): BloqueConducta | null {
  const { titulo, matiz } = leeTituloTarjeta(
    textoPlano(tarjeta.querySelector(".acts-card-title")),
  );

  const bloques = Array.from(tarjeta.querySelectorAll(".act-subblock"));

  const conducta = (bloque: Element | undefined): Conducta | null => {
    if (!bloque) return null;

    const etiqueta = bloque.querySelector(".act-subblock-label");
    const marca = textoPlano(etiqueta?.querySelector("span") ?? null);
    const entero = textoPlano(etiqueta ?? null);

    /* El rótulo es lo que queda del texto de la etiqueta al quitarle la
       píldora de «LO QUE SUMA» / «LO QUE RESTA». */
    const rotulo = entero.replace(marca, "").trim();

    const texto = sinAviso(textoRico(bloque.querySelector(".act-description")));

    if (!texto) return null;

    return { rotulo: rotulo || titulo, texto };
  };

  /*
  | Cuál es la buena y cuál la mala se decide por la clase `prohibited` del
  | original, no por el orden: en el bruto siempre iban suma y resta, pero un
  | documento nuevo podría escribirlas al revés.
  */
  const positivo = bloques.find(
    (bloque) => !bloque.querySelector(".act-description.prohibited"),
  );

  const negativo = bloques.find((bloque) =>
    bloque.querySelector(".act-description.prohibited"),
  );

  const suma = conducta(positivo ?? bloques[0]);
  const resta = conducta(negativo ?? bloques[1]);

  if (!suma || !resta) return null;

  const fuera =
    tarjeta.classList.contains("offpitch-card") ||
    /fuera/i.test(titulo) ||
    indice > 0;

  return {
    ambito: fuera ? "fuera" : "campo",
    titulo: titulo || (fuera ? "Fuera del campo" : "En el campo"),
    matiz,
    suma,
    resta,
  };
}

/* ------------------------------------------------------------------ */
/*  EL DOCUMENTO                                                       */
/* ------------------------------------------------------------------ */

/** Lo que el lector saca del bruto antes de que nadie retoque la ficha. */
export type BrutoLeido = {
  titulo: string;
  subtitulo: string;
  temporada: string;
  valores: Valor[];
  /** Diapositivas del bruto que no se han entendido. */
  descartadas: number;
};

/**
 * Lee el HTML de una presentación de cultura.
 *
 * Lanza si el fichero no es del formato esperado: es preferible decir que no
 * se entiende a guardar un documento con tres valores de los cinco.
 */
export function leeBruto(html: string): BrutoLeido {
  if (typeof DOMParser === "undefined") {
    throw new Error("El bruto sólo se puede leer en el navegador.");
  }

  const doc = new DOMParser().parseFromString(html, "text/html");

  const hojas = Array.from(doc.querySelectorAll(".slide-container"));

  if (hojas.length === 0) {
    throw new Error(
      "No parece una presentación de cultura: no hay ninguna diapositiva " +
        "(«div.slide-container») en el fichero.",
    );
  }

  const valores: Valor[] = [];
  let descartadas = 0;

  for (const hoja of hojas) {
    const titulo = hoja.querySelector(".cover-title");

    /* --------------------------------------------- portada de valor */
    if (titulo) {
      const { numero, votos } = leeNumeroYVotos(
        textoPlano(hoja.querySelector(".cover-value-number")),
        valores.length + 1,
      );

      valores.push({
        numero,
        votos,
        titulo: textoPlano(titulo),
        antivalores: "",
        explicacion: textoRico(hoja.querySelector(".cover-explanation-box p")),
        bloques: [],
      });

      continue;
    }

    /* ------------------------------------------------- conductas */
    const tarjetas = Array.from(hoja.querySelectorAll(".acts-card"));
    const ultimo = valores[valores.length - 1];

    if (tarjetas.length === 0 || !ultimo) {
      descartadas += 1;
      continue;
    }

    ultimo.antivalores =
      leeAntivalores(textoPlano(hoja.querySelector(".slide-title"))) ||
      ultimo.antivalores;

    ultimo.bloques = tarjetas
      .map((tarjeta, indice) => leeTarjeta(tarjeta, indice))
      .filter((bloque): bloque is BloqueConducta => bloque !== null);
  }

  if (valores.length === 0) {
    throw new Error(
      "El fichero tiene diapositivas, pero ninguna con un valor: falta el " +
        "titular de la portada («.cover-title»).",
    );
  }

  const temporada = textoPlano(doc.querySelector(".season-title")).match(
    /(\d{2})\s*\/\s*(\d{2})/,
  );

  return {
    titulo:
      limpia(doc.querySelector("title")?.textContent ?? "") ||
      "Documento de cultura",
    subtitulo: textoPlano(doc.querySelector(".brand-subtitle")),
    temporada: temporada ? `${temporada[1]} / ${temporada[2]}` : "",
    valores,
    descartadas,
  };
}

/** La ficha que el usuario confirma antes de guardar el documento. */
export type FichaDocumento = {
  numero: string;
  titulo: string;
  subtitulo: string;
  resumen: string;
  temporada: string;
  entradilla: string;
  /** Nombre del fichero que se descargará, sin extensión. */
  archivo: string;
  /** De dónde salió: el nombre del bruto que se subió. */
  origen?: string;
};

/** La entradilla que se propone cuando el bruto no trae ninguna. */
export function entradillaPorDefecto(valores: number) {
  return (
    `Los ${valores} valores que ha votado la plantilla, cada uno enfrentado a ` +
    "**los antivalores que lo destruyen** y con las conductas por las que se " +
    "reconoce, dentro y fuera del campo. Lo que se mide no es lo que decimos, " +
    "es **lo que se ve cada día**."
  );
}

/** Junta lo leído del bruto con la ficha y devuelve el documento publicable. */
export function documentoDesdeBruto(
  bruto: BrutoLeido,
  ficha: FichaDocumento,
  id: string,
): DocumentoCultura {
  const temporada = ficha.temporada.trim();

  const diapositivas: DiapositivaCultura[] = [
    {
      tipo: "portada",
      titulo: ficha.titulo,
      subtitulo: temporada
        ? `Temporada ${temporada} · Real Madrid Castilla`
        : "Real Madrid Castilla",
      entradilla: ficha.entradilla,
      indice: bruto.valores.map((valor) => ({
        numero: valor.numero,
        titulo: valor.titulo,
        votos: valor.votos,
      })),
    },
    ...bruto.valores.flatMap((valor) => [
      { tipo: "valor" as const, valor },
      /* Un valor sin conductas se queda sólo con su portada: una hoja de
         tarjetas vacía diría menos que no ponerla. */
      ...(valor.bloques.length > 0
        ? [{ tipo: "conductas" as const, valor }]
        : []),
    ]),
  ];

  return {
    id,
    numero: ficha.numero,
    titulo: ficha.titulo,
    subtitulo: ficha.subtitulo,
    resumen: ficha.resumen,
    etiquetas: ["Cultura", "Valores", "Conductas observables"],
    temporada,
    archivo: ficha.archivo,
    origen: ficha.origen,
    diapositivas,
  };
}
