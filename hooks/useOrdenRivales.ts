"use client";

import { useCallback, useEffect, useState } from "react";

import {
  SIN_ORDEN,
  cargaOrdenRivales,
  comparaPorCalendario,
  esElProximo,
  type OrdenRivales,
} from "@/lib/rivals/orden-calendario";

/*
|--------------------------------------------------------------------------
| LOS RIVALES, POR CALENDARIO, EN CUALQUIER PANTALLA
|--------------------------------------------------------------------------
|
| `/rivals` ordena sus plantillas por cuándo toca jugar contra cada equipo y
| abre con el rival de la semana (ver `lib/rivals/orden-calendario.ts`). El
| resto de pantallas con selector de rival —ABP del rival, área del rival,
| duelos, la pizarra— salían por orden alfabético y abrían con el primero de
| la lista o con el último que se miró, que después del partido es el rival
| de la semana pasada.
|
| Este hook da la misma regla a todas: `ordena` coloca cualquier lista por el
| calendario y `proximoDe` dice cuál de esos nombres es el del próximo
| partido. Mientras la hoja no ha contestado —o si no contesta— el orden es
| el alfabético de siempre y no hay próximo: nunca deja una pantalla vacía.
*/
export function useOrdenRivales() {
  const [orden, setOrden] = useState<OrdenRivales>(SIN_ORDEN);

  /* Ya se sabe el orden (o que no se va a saber). */
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const control = new AbortController();

    /* `cargaOrdenRivales` nunca lanza: sin hoja devuelve `SIN_ORDEN`. */
    cargaOrdenRivales(control.signal).then((resultado) => {
      if (control.signal.aborted) return;

      setOrden(resultado);
      setListo(true);
    });

    return () => control.abort();
  }, []);

  const ordena = useCallback(
    <T,>(lista: T[], nombre: (elemento: T) => string) => {
      const compara = comparaPorCalendario(orden);

      return [...lista].sort((a, b) => compara(nombre(a), nombre(b)));
    },
    [orden],
  );

  /** El nombre de la lista que es el rival del próximo partido, o "". */
  const proximoDe = useCallback(
    (equipos: string[]) => equipos.find((equipo) => esElProximo(orden, equipo)) ?? "",
    [orden],
  );

  return { orden, listo, ordena, proximoDe };
}

export default useOrdenRivales;
