"use client";

/**
 * Los documentos grandes de Opta (evento a evento), pedidos SÓLO cuando los
 * monta la pieza que los usa y compartidos después: los remates pesan ~3 MB
 * y los saques de balón parado ~6 MB, así que no van en la carga del área.
 *
 * Una promesa por clave para toda la pestaña del navegador; si falla (o el
 * documento aún no existe), se olvida y el siguiente montaje lo vuelve a
 * pedir. Con la forma que pasa el linter de React 19: el `setState` va en el
 * `then`, nunca síncrono dentro del efecto.
 */

import { useEffect, useState } from "react";

import { traeOpta } from "@/lib/opta";

const enVuelo = new Map<string, Promise<unknown>>();
const listos = new Map<string, unknown>();

/** El aviso con el que «Actualizar datos» pide a todas las piezas montadas que vuelvan a pedir lo suyo. */
const EVENTO_RECARGA = "rmcf:opta-docs-recarga";

/**
 * Olvida todo lo bajado (10/11/2026): el «Actualizar datos» de Análisis de
 * datos sólo recargaba Wyscout; ahora también estos documentos.
 */
export function olvidaDocsOpta() {
  enVuelo.clear();
  listos.clear();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_RECARGA));
}

function trae(clave: string): Promise<unknown> {
  let p = enVuelo.get(clave);
  if (!p) {
    p = traeOpta<unknown>(clave).then((d) => {
      if (d == null) enVuelo.delete(clave);
      else listos.set(clave, d);
      return d;
    });
    enVuelo.set(clave, p);
  }
  return p;
}

/**
 * `docs[i]` es el documento de `claves[i]` (null si no existe). `cargando`
 * mientras falte alguno por llegar.
 */
export function useDocsOpta<T extends unknown[]>(...claves: string[]): { docs: { [K in keyof T]: T[K] | null }; cargando: boolean } {
  const firma = claves.join("\n");
  const [llegados, setLlegados] = useState<{ firma: string; docs: unknown[] } | null>(null);
  const [testigo, setTestigo] = useState(0);

  useEffect(() => {
    const otraVez = () => setTestigo((n) => n + 1);
    window.addEventListener(EVENTO_RECARGA, otraVez);
    return () => window.removeEventListener(EVENTO_RECARGA, otraVez);
  }, []);

  useEffect(() => {
    let vivo = true;
    const lista = firma.split("\n");
    if (lista.every((c) => listos.has(c))) return;
    void Promise.all(lista.map(trae)).then((docs) => {
      if (vivo) setLlegados({ firma, docs });
    });
    return () => {
      vivo = false;
    };
  }, [firma, testigo]);

  const lista = firma.split("\n");
  const enCache = lista.every((c) => listos.has(c));
  const docs = enCache ? lista.map((c) => listos.get(c) ?? null) : llegados?.firma === firma ? llegados.docs : lista.map(() => null);
  const cargando = !enCache && llegados?.firma !== firma;
  return { docs: docs as { [K in keyof T]: T[K] | null }, cargando };
}
