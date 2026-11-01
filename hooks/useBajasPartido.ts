"use client";

/*
| Las bajas para el próximo partido, marcadas en la pizarra táctica
| (01/11/2026). Documento propio en Supabase (`tactics:bajas-partido`) con el
| autoguardado y la versión de siempre (`useRemoteDoc`). Ver
| `lib/tactics/disponibilidad.ts`.
|
| «Hoy» sale de un reloj externo y no del render (regla de pureza de React):
| a medianoche cambia y las bajas con fecha caducan solas.
*/

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  CLAVE_DOC_BAJAS,
  DOC_BAJAS_VACIO,
  TIPO_DOC_BAJAS,
  conBajas,
  hoyLocal,
  marcaBaja,
  normalizaDocBajas,
  quitaBaja,
  vigente,
  type BajaPartido,
  type ConBaja,
  type DocBajas,
} from "@/lib/tactics/disponibilidad";
import type { Player } from "@/types/player";

const cadaMinuto = (aviso: () => void) => {
  const reloj = window.setInterval(aviso, 60_000);

  return () => window.clearInterval(reloj);
};

/** Sin «hoy» (en el servidor) nada caduca: es la misma lista que verá el navegador al llegar. */
const useHoy = () => useSyncExternalStore(cadaMinuto, () => hoyLocal(), () => "");

export type BajasPartido = {
  /** Las vigentes, en el orden en que se marcaron. */
  bajas: BajaPartido[];
  hoy: string;
  marca: (p: Pick<Player, "id" | "nombre" | "apodo">, datos: Pick<BajaPartido, "motivo" | "detalle" | "hasta">) => void;
  quita: (p: Pick<Player, "nombre" | "apodo">) => void;
  /** No se ha podido leer ni guardar en el servidor: se trabaja sólo en este aparato. */
  soloAqui: boolean;
  cargando: boolean;
};

export function useBajasPartido<P extends Player>(plantilla: P[]): { plantilla: ConBaja<P>[]; bajas: BajasPartido } {
  const { value, setValue, status, localOnly } = useRemoteDoc<DocBajas>({
    key: CLAVE_DOC_BAJAS,
    kind: TIPO_DOC_BAJAS,
    fallback: DOC_BAJAS_VACIO,
  });

  const hoy = useHoy();
  const doc = useMemo(() => normalizaDocBajas(value), [value]);
  const conSuBaja = useMemo(() => conBajas(plantilla, doc, hoy), [plantilla, doc, hoy]);
  const vivas = useMemo(() => doc.bajas.filter((b) => vigente(b, hoy)), [doc, hoy]);

  const marca = useCallback<BajasPartido["marca"]>(
    (p, datos) => {
      const ahora = hoyLocal();

      setValue((antes) => marcaBaja(normalizaDocBajas(antes), p, datos, ahora));
    },
    [setValue],
  );

  const quita = useCallback<BajasPartido["quita"]>(
    (p) => {
      const ahora = hoyLocal();

      setValue((antes) => quitaBaja(normalizaDocBajas(antes), p, ahora));
    },
    [setValue],
  );

  return {
    plantilla: conSuBaja,
    bajas: { bajas: vivas, hoy, marca, quita, soloAqui: localOnly, cargando: status === "loading" },
  };
}
