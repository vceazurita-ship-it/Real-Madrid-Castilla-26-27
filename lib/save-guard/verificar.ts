/*
|--------------------------------------------------------------------------
| VERIFICACIÓN DE GUARDADO
|--------------------------------------------------------------------------
|
| Casi todas las escrituras de la app acaban en una hoja de cálculo a través
| de Apps Script. Ese destino escribe **por nombre de columna**: si un campo
| que enviamos no tiene cabecera en la hoja, el valor se descarta y aun así la
| respuesta llega con `success: true`. El usuario ve "guardado", recarga y el
| texto ya no está.
|
| Por eso ningún guardado puede darse por bueno solo porque el servidor diga
| que sí. Después de escribir se vuelve a leer el registro y se compara con lo
| que se envió: lo que no haya llegado se considera pérdida y se avisa antes
| de cerrar el formulario.
|
| La comparación es deliberadamente conservadora. Solo se marca lo que es
| pérdida real y demostrable, porque un aviso que salta en guardados correctos
| se aprende a ignorar y deja de proteger:
|
|   · columna-inexistente -> el campo ni siquiera existe en el destino.
|   · vacio               -> enviamos texto y el destino lo devuelve en blanco.
|   · truncado            -> el destino devuelve solo el principio de lo enviado.
|
| Un valor que vuelve reformateado (fechas que la hoja convierte a ISO,
| números, booleanos en otra caja) NO es pérdida y no se marca.
*/

export type MotivoPerdida =
  | "columna-inexistente"
  | "vacio"
  | "truncado"
  /** El servidor contestó con error a este cambio concreto. */
  | "rechazado";

export interface CampoPerdido {
  campo: string;
  motivo: MotivoPerdida;
  /** Lo que escribió el usuario. Es el texto que hay que rescatar. */
  enviado: string;
  /** Lo que ha quedado en el servidor (vacío salvo en truncados). */
  guardado: string;
}

/** Parámetros de transporte: viajan en el cuerpo pero no son datos. */
const CAMPOS_DE_CONTROL = ["action", "accion", "token", "callback"] as const;

export function normalizarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  return String(valor).replace(/\r\n/g, "\n").trim();
}

export interface OpcionesComparacion {
  /**
   * Campos que el servidor puede reescribir legítimamente (IDs que genera él,
   * marcas de tiempo, columnas calculadas). No se comparan.
   */
  ignorar?: readonly string[];
  /**
   * Limita la detección a columnas inexistentes.
   *
   * Se usa cuando la relectura viene de un CSV publicado: Google los sirve
   * cacheados varios minutos, así que el *contenido* puede ser viejo y marcar
   * pérdidas que no existen. La fila de cabeceras, en cambio, sí es fiable —
   * una columna que no está no aparece por mucho que se refresque la caché.
   */
  soloColumnas?: boolean;
}

/**
 * Compara lo enviado con lo que el servidor tiene después de guardar.
 *
 * Devuelve solo los campos perdidos; una lista vacía significa que todo el
 * contenido que llevaba texto ha llegado a su destino.
 */
export function compararGuardado(
  enviado: Record<string, unknown>,
  guardado: Record<string, unknown> | null | undefined,
  opciones: OpcionesComparacion = {}
): CampoPerdido[] {
  /* Sin registro releído no se puede afirmar nada: lo trata `useSaveGuard`
     como "no verificado", que no es lo mismo que "perdido". */
  if (!guardado) return [];

  const ignorar = new Set<string>([
    ...CAMPOS_DE_CONTROL,
    ...(opciones.ignorar ?? []),
  ]);

  const perdidos: CampoPerdido[] = [];

  for (const [campo, valor] of Object.entries(enviado)) {
    if (ignorar.has(campo)) continue;

    const textoEnviado = normalizarValor(valor);

    /* Si no enviábamos contenido no hay nada que perder. */
    if (!textoEnviado) continue;

    if (!(campo in guardado)) {
      perdidos.push({
        campo,
        motivo: "columna-inexistente",
        enviado: textoEnviado,
        guardado: "",
      });

      continue;
    }

    if (opciones.soloColumnas) continue;

    const textoGuardado = normalizarValor(guardado[campo]);

    if (!textoGuardado) {
      perdidos.push({
        campo,
        motivo: "vacio",
        enviado: textoEnviado,
        guardado: "",
      });

      continue;
    }

    /* Truncado: lo que hay guardado es exactamente el principio de lo que
       mandamos. Pasa con los límites de longitud de celda. */
    if (
      textoGuardado.length < textoEnviado.length &&
      textoEnviado.startsWith(textoGuardado)
    ) {
      perdidos.push({
        campo,
        motivo: "truncado",
        enviado: textoEnviado,
        guardado: textoGuardado,
      });
    }
  }

  return perdidos;
}

export function explicarMotivo(motivo: MotivoPerdida): string {
  switch (motivo) {
    case "columna-inexistente":
      return "La columna no existe en la hoja de destino";
    case "vacio":
      return "El servidor ha guardado el campo en blanco";
    case "truncado":
      return "Solo se ha guardado el principio del texto";
    case "rechazado":
      return "El servidor ha rechazado el cambio";
  }
}

/**
 * Construye la lista de pérdidas para cambios que el servidor ha rechazado.
 *
 * No hay nada que comparar: sabemos que no han entrado, así que se marcan
 * directamente para que el usuario pueda rescatar el texto.
 */
export function marcarComoRechazados(
  campos: Record<string, string>
): CampoPerdido[] {
  return Object.entries(campos)
    .filter(([, valor]) => normalizarValor(valor))
    .map(([campo, valor]) => ({
      campo,
      motivo: "rechazado" as const,
      enviado: normalizarValor(valor),
      guardado: "",
    }));
}

/** Resumen corto para el toast y el título del aviso. */
export function resumirPerdida(perdidos: CampoPerdido[]): string {
  if (perdidos.length === 1) return "1 campo no se ha guardado";

  return `${perdidos.length} campos no se han guardado`;
}
