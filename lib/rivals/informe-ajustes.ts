import type {
  ElementoInforme,
  HojaInforme,
  TextoElemento,
} from "@/lib/rivals/informe-elementos";

/**
 * LO QUE SE TOCA EN EL EDITOR DEL INFORME, GUARDADO.
 *
 * Hasta ahora el editor no guardaba **nada**: ni en Supabase ni en el propio
 * navegador. Se movían paneles, se borraban filas de la tabla y se escribían
 * notas, se cerraba, y todo eso desaparecía. El 24/09/2026 se hizo un repaso
 * entero desde un Mac y al día siguiente no había ni rastro.
 *
 * **Lo que NO se guarda son las hojas.** Cada pieza lleva su PNG dentro
 * (`imagen`, un `data:` en base64) y una sola hoja pesa megas: subir las doce a
 * `app_documents` en cada arrastre sería absurdo y acabaría reventando.
 *
 * Lo que se guarda es **el retoque**: dónde acabó cada pieza, cuáles se
 * borraron, qué copias se hicieron y qué notas se escribieron. Son unos pocos
 * kilobytes. Y tiene una ventaja que la otra vía no daba: el informe se vuelve
 * a montar con los datos frescos de BeSoccer cada vez que se abre, y **los
 * retoques se le vuelven a aplicar encima**. Guardando las hojas, el repaso del
 * lunes seguiría enseñando la clasificación del lunes.
 *
 * **La pieza se reconoce por su id y se comprueba por su nombre.** Los ids son
 * estables —`informe-elementos.ts` los numera por hoja— pero si el guion cambia
 * (un jugador nuevo, una fila más en una tabla) un id podría apuntar a otra
 * pieza. Por eso cada ajuste guarda también el nombre que tenía, y si al
 * volver no coincide, **ese ajuste se descarta en vez de mover lo que no es**.
 */

/** Dónde acabó una pieza. En píxeles del lienzo de 1920×1080. */
export type CajaAjuste = {
  x: number;
  y: number;
  w: number;
  h: number;
  opacidad?: number;
  /** El que tenía al guardarlo, para no aplicarle esto a otra pieza. */
  nombre?: string;
};

/** Una pieza replicada con `Ctrl+D`: se clona de otra que sí está en el guion. */
export type CopiaAjuste = CajaAjuste & { id: string; de: string };

/** Una nota escrita en el editor. Se vuelve a pintar de cero al aplicarla. */
export type NotaAjuste = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  texto: TextoElemento;
};

export type AjustesHoja = {
  cajas?: Record<string, CajaAjuste>;
  borrados?: string[];
  copias?: CopiaAjuste[];
  notas?: NotaAjuste[];
};

export type AjustesEquipo = {
  actualizado: string;
  /** Quién lo dejó así, para que se sepa de dónde salió el cambio. */
  porHoja: Record<string, AjustesHoja>;
};

export type AjustesInforme = { porEquipo: Record<string, AjustesEquipo> };

export const AJUSTES_INFORME_KEY = "rivals:informe-ajustes";

export const AJUSTES_INFORME_VACIO: AjustesInforme = { porEquipo: {} };

/**
 * Con qué nombre se guarda cada hoja.
 *
 * **NO se usa el `id` de la hoja**, que es posicional (`h1`, `h2`… se asignan
 * con `hojas.length + 1` al montarlas). El informe no siempre trae las mismas:
 * las tres hojas de Wyscout sólo salen si hay datos, y las de partidos son dos
 * o tres según lo que se elija en el pop-up. Con el id, un informe con una
 * hoja menos convierte `h12` en otra distinta y el repaso aterriza donde no
 * es. Pasó de verdad: el repaso del 25/09 se guardó como h10/h11/h12
 * —Plantilla, Once probable y el primer Partidos— y al reabrir el informe sin
 * las hojas de Wyscout esos nombres ya eran otras hojas.
 *
 * El título sí es estable. Se repite en las de partidos, así que a la segunda
 * y siguientes se les pone el ordinal.
 */
export function clavesDeHoja(hojas: { id: string; titulo: string }[]) {
  const vistos = new Map<string, number>();

  return hojas.map((hoja) => {
    const n = (vistos.get(hoja.titulo) ?? 0) + 1;

    vistos.set(hoja.titulo, n);

    return n === 1 ? hoja.titulo : `${hoja.titulo}#${n}`;
  });
}

/** Medio píxel no es un cambio: es el redondeo de un arrastre. */
const IGUAL = 0.5;

const mismaCaja = (a: ElementoInforme, b: ElementoInforme) =>
  Math.abs(a.x - b.x) < IGUAL &&
  Math.abs(a.y - b.y) < IGUAL &&
  Math.abs(a.w - b.w) < IGUAL &&
  Math.abs(a.h - b.h) < IGUAL &&
  (a.opacidad ?? 1) === (b.opacidad ?? 1);

/** De qué pieza del guion es copia. `panel-3-copia7` -> `panel-3`. */
export function deQuienEsCopia(id: string) {
  const corte = id.lastIndexOf("-copia");

  return corte < 0 ? null : id.slice(0, corte);
}

/**
 * Lo que ha cambiado entre el informe recién montado y el que hay en pantalla.
 *
 * Se compara contra el guion original, no contra el estado anterior: así el
 * documento guardado es siempre el retoque completo y no una pila de parches
 * que haya que reproducir en orden.
 */
export function extraeAjustes(
  base: HojaInforme[],
  ahora: HojaInforme[],
): Record<string, AjustesHoja> {
  const porHoja: Record<string, AjustesHoja> = {};

  const claves = clavesDeHoja(base);

  const baseporId = new Map(base.map((h, i) => [h.id, { hoja: h, clave: claves[i] }]));

  for (const hoja of ahora) {
    const encontrada = baseporId.get(hoja.id);

    if (!encontrada) continue;

    const { hoja: original, clave } = encontrada;

    const originales = new Map(original.elementos.map((e) => [e.id, e]));

    const cajas: Record<string, CajaAjuste> = {};
    const copias: CopiaAjuste[] = [];
    const notas: NotaAjuste[] = [];

    for (const el of hoja.elementos) {
      const previo = originales.get(el.id);

      if (previo) {
        if (!mismaCaja(previo, el)) {
          cajas[el.id] = {
            x: el.x,
            y: el.y,
            w: el.w,
            h: el.h,
            ...(el.opacidad !== undefined ? { opacidad: el.opacidad } : {}),
            nombre: el.nombre,
          };
        }

        continue;
      }

      /* Lo que no estaba en el guion lo ha creado alguien aquí. */
      const de = deQuienEsCopia(el.id);

      if (de && originales.has(de)) {
        copias.push({
          id: el.id,
          de,
          x: el.x,
          y: el.y,
          w: el.w,
          h: el.h,
          ...(el.opacidad !== undefined ? { opacidad: el.opacidad } : {}),
        });

        continue;
      }

      if (el.texto) {
        notas.push({
          id: el.id,
          x: el.x,
          y: el.y,
          w: el.w,
          h: el.h,
          texto: el.texto,
        });
      }

      /*
      | Una copia de una copia, o una pieza de origen desconocido, se deja
      | pasar sin guardar. Es raro y no merece inventarse una cadena de
      | clonados que habría que reproducir en orden al volver.
      */
    }

    const vivos = new Set(hoja.elementos.map((e) => e.id));

    const borrados = original.elementos
      .map((e) => e.id)
      .filter((id) => !vivos.has(id));

    if (
      Object.keys(cajas).length === 0 &&
      borrados.length === 0 &&
      copias.length === 0 &&
      notas.length === 0
    ) {
      continue;
    }

    porHoja[clave] = {
      ...(Object.keys(cajas).length ? { cajas } : {}),
      ...(borrados.length ? { borrados } : {}),
      ...(copias.length ? { copias } : {}),
      ...(notas.length ? { notas } : {}),
    };
  }

  return porHoja;
}

/** Cuántos retoques hay guardados, para poder decirlo en pantalla. */
export function cuentaAjustes(porHoja: Record<string, AjustesHoja>) {
  return Object.values(porHoja ?? {}).reduce(
    (suma, h) =>
      suma +
      Object.keys(h.cajas ?? {}).length +
      (h.borrados?.length ?? 0) +
      (h.copias?.length ?? 0) +
      (h.notas?.length ?? 0),
    0,
  );
}

/**
 * Vuelve a poner los retoques encima del informe recién montado.
 *
 * `pintaNota` se le pasa desde fuera —es `piezaDeTexto`, que vive en
 * `informe-ppt.ts`— para no arrastrar aquí el módulo que dibuja el informe
 * entero: esto se carga en cuanto se abre el editor.
 */
export async function aplicaAjustes(
  hojas: HojaInforme[],
  porHoja: Record<string, AjustesHoja> | undefined,
  pintaNota: (
    contenido: string,
    opciones: {
      id: string;
      x: number;
      y: number;
      tamano?: number;
      tinta?: string;
      peso?: 500 | 600 | 700;
      espaciado?: number;
      conChapa?: boolean;
    },
  ) => Promise<ElementoInforme>,
): Promise<HojaInforme[]> {
  if (!porHoja || Object.keys(porHoja).length === 0) return hojas;

  const salida: HojaInforme[] = [];

  const claves = clavesDeHoja(hojas);

  for (const [indice, hoja] of hojas.entries()) {
    const ajuste = porHoja[claves[indice]];

    if (!ajuste) {
      salida.push(hoja);

      continue;
    }

    const borrados = new Set(ajuste.borrados ?? []);

    const elementos = hoja.elementos
      .filter((el) => !borrados.has(el.id))
      .map((el) => {
        const caja = ajuste.cajas?.[el.id];

        /* Si el guion ha cambiado y ese id ya no es esa pieza, no se toca. */
        if (!caja || (caja.nombre && caja.nombre !== el.nombre)) return el;

        return {
          ...el,
          x: caja.x,
          y: caja.y,
          w: caja.w,
          h: caja.h,
          ...(caja.opacidad !== undefined ? { opacidad: caja.opacidad } : {}),
        };
      });

    const porId = new Map(hoja.elementos.map((e) => [e.id, e]));

    for (const copia of ajuste.copias ?? []) {
      const madre = porId.get(copia.de);

      /* La pieza de la que salió ya no existe: la copia tampoco tiene sentido. */
      if (!madre) continue;

      elementos.push({
        ...madre,
        id: copia.id,
        x: copia.x,
        y: copia.y,
        w: copia.w,
        h: copia.h,
        ...(copia.opacidad !== undefined ? { opacidad: copia.opacidad } : {}),
      });
    }

    for (const nota of ajuste.notas ?? []) {
      try {
        const pieza = await pintaNota(nota.texto.contenido, {
          id: nota.id,
          x: nota.x,
          y: nota.y,
          tamano: nota.texto.tamano,
          tinta: nota.texto.tinta,
          peso: nota.texto.peso,
          espaciado: nota.texto.espaciado,
          conChapa: nota.texto.conChapa,
        });

        /* La nota se repinta, así que su caja es la que salga del dibujo; se
           respeta el ancho guardado sólo si alguien la estiró a mano. */
        elementos.push({
          ...pieza,
          ...(nota.w && nota.h ? { w: nota.w, h: nota.h } : {}),
        });
      } catch {
        /* Una nota que no se deja repintar no puede tumbar el informe. */
      }
    }

    salida.push({ ...hoja, elementos });
  }

  return salida;
}
