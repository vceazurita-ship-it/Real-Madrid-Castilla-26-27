"use client";

/*
|--------------------------------------------------------------------------
| useBorradorLocal
|--------------------------------------------------------------------------
|
| El borrador de un formulario, a salvo de cerrar la ventana.
|
| `useAutoSave` resuelve el trabajo que **ya tiene sitio** en el servidor: se
| escribe solo cada pocos segundos. Pero quedaban dos huecos que se llevaban
| texto tecleado sin avisar:
|
|   · **Las altas.** Un seguimiento nuevo o un vídeo nuevo no se pueden
|     autoguardar: cada pausa crearía una fila en la hoja. Así que el texto
|     vivía sólo en el estado de React y un clic fuera del modal lo borraba.
|   · **El rato entre teclear y que conteste el servidor.** En las hojas de
|     Google son de treinta a setenta segundos en frío.
|
| Aquí el borrador se copia en `localStorage` **en cuanto se escribe**, sin
| esperar a nada, y al volver a abrir el formulario se ofrece de vuelta. Lo
| recuperado nunca se aplica solo: entre medias el usuario puede haber
| cambiado de idea, y meterle texto viejo sin preguntar cambiaría una pérdida
| silenciosa por otra.
|
| Uso:
|
|     const borrador = useBorradorLocal({
|       clave: `individual:seguimiento:${idRegistro ?? "nuevo"}`,
|       valor: trackingForm,
|       activo: showTrackingForm,
|       vacio: (v) => !v.FECHA && !v.FEEDBACK,
|     });
|
|     {borrador.recuperado && (
|       <AvisoBorrador
|         fecha={borrador.recuperado.fecha}
|         onRecuperar={() => {
|           setTrackingForm(borrador.recuperado!.valor);
|           borrador.descarta();
|         }}
|         onDescartar={borrador.descarta}
|       />
|     )}
|
| Al guardar de verdad hay que llamar a `descarta()`: si no, el borrador
| seguiría ofreciéndose la próxima vez.
*/

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

export interface BorradorGuardado<T> {
  valor: T;
  /** Cuándo se escribió, en ISO. */
  fecha: string;
}

export interface BorradorLocal<T> {
  /**
   * Lo que quedó sin guardar la última vez, o `null`. Es una foto del momento
   * de abrir: no cambia mientras se teclea.
   */
  recuperado: BorradorGuardado<T> | null;
  /** Tira la copia: se ha aplicado, se ha guardado, o no se quiere. */
  descarta: () => void;
  /** Hay algo escrito sin guardar ahora mismo. */
  hayTexto: boolean;
}

interface Opciones<T> {
  /**
   * Dónde se copia, **una por registro**: el borrador de un jugador no puede
   * aparecer al abrir el de otro. Con `null` el hook no hace nada.
   */
  clave: string | null;
  valor: T;
  /** Mientras sea falso no se copia nada (el formulario está cerrado). */
  activo: boolean;
  /** Cuándo el formulario cuenta como vacío: un vacío no merece copia. */
  vacio: (valor: T) => boolean;
}

const prefijo = (clave: string) => `rmcf-borrador:${clave}`;

/*
| Los oyentes viven fuera del hook, por clave: dos formularios del mismo
| registro —o dos pestañas— tienen que enterarse de que la copia se ha tirado.
*/
const oyentes = new Map<string, Set<() => void>>();

function avisa(clave: string) {
  oyentes.get(clave)?.forEach((oyente) => oyente());
}

export function useBorradorLocal<T>({
  clave,
  valor,
  activo,
  vacio,
}: Opciones<T>): BorradorLocal<T> {
  const completa = clave ? prefijo(clave) : null;

  const vacioRef = useRef(vacio);

  useEffect(() => {
    vacioRef.current = vacio;
  });

  /* ------------------------------------------------------------------ */
  /*  LA COPIA                                                           */
  /* ------------------------------------------------------------------ */

  const hayTexto = !vacio(valor);

  useEffect(() => {
    if (!completa || !activo || typeof window === "undefined") return;

    try {
      if (vacioRef.current(valor)) {
        /* Vaciar el formulario es una forma de descartar. */
        window.localStorage.removeItem(completa);

        return;
      }

      window.localStorage.setItem(
        completa,
        JSON.stringify({ fecha: new Date().toISOString(), valor }),
      );
    } catch {
      /* Cuota llena o modo privado: se sigue sin red de seguridad. */
    }
  }, [completa, activo, valor]);

  /* ------------------------------------------------------------------ */
  /*  LO QUE QUEDÓ DE LA VEZ ANTERIOR                                    */
  /* ------------------------------------------------------------------ */

  /*
  | `useSyncExternalStore` y no un efecto con `setState`: `localStorage` es un
  | sistema de fuera de React y en el servidor no existe, así que leerlo en un
  | efecto daría un desajuste al hidratar.
  |
  | **Copiar no avisa a los oyentes, a propósito.** Si cada tecla refrescase la
  | lectura, «lo que quedó sin guardar» sería lo que se está escribiendo ahora
  | mismo. Lo que interesa es la foto de al abrir; por eso el único aviso desde
  | dentro es al cerrar el formulario, para que la próxima apertura lea lo
  | último.
  */
  const suscribe = useCallback(
    (oyente: () => void) => {
      if (!completa) return () => {};

      const grupo = oyentes.get(completa) ?? new Set<() => void>();

      grupo.add(oyente);
      oyentes.set(completa, grupo);

      /* Otra pestaña del mismo navegador también puede tirar la copia. */
      if (typeof window !== "undefined") {
        window.addEventListener("storage", oyente);
      }

      return () => {
        grupo.delete(oyente);

        if (grupo.size === 0) oyentes.delete(completa);

        if (typeof window !== "undefined") {
          window.removeEventListener("storage", oyente);
        }
      };
    },
    [completa],
  );

  const lee = useCallback(() => {
    if (!completa || typeof window === "undefined") return null;

    try {
      return window.localStorage.getItem(completa);
    } catch {
      return null;
    }
  }, [completa]);

  /* Se devuelve la cadena tal cual: un objeto nuevo en cada lectura dejaría a
     React renderizando sin parar. El objeto se arma después. */
  const crudo = useSyncExternalStore(suscribe, lee, () => null);

  const recuperado = useMemo<BorradorGuardado<T> | null>(() => {
    if (!crudo) return null;

    try {
      const leido = JSON.parse(crudo) as { fecha?: string; valor?: T };

      if (!leido || !("valor" in leido)) return null;

      return { valor: leido.valor as T, fecha: leido.fecha ?? "" };
    } catch {
      return null;
    }
  }, [crudo]);

  const descarta = useCallback(() => {
    if (!completa || typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(completa);
    } catch {
      /* nada que hacer */
    }

    avisa(completa);
  }, [completa]);

  /* Al cerrar el formulario se refresca la foto: la próxima apertura tiene que
     ofrecer lo último que se escribió, no lo que había al abrir esta vez. */
  useEffect(() => {
    if (activo || !completa) return;

    avisa(completa);
  }, [activo, completa]);

  return { recuperado, descarta, hayTexto };
}

export default useBorradorLocal;
