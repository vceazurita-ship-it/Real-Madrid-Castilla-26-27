"use client";

/**
 * EL DIRECTO DE OPTA, DE UN TOQUE (13/11/2026).
 *
 * Lo comparten la portada, Ajustes y la propia pantalla del directo:
 *
 * - `enMarcha`: el proceso de GitHub está corriendo (o en cola), según
 *   `/api/opta/directo` (sólo admin) o, para cualquiera, porque el índice
 *   `opta:directo` se ha escrito hace menos de 3 minutos y aún no ha pasado
 *   su `hasta`.
 * - `abre()`: si ya está en marcha, sólo lleva a la pantalla; si no, lo lanza
 *   (sin diálogo: en el partido no hay tiempo) y lleva a la pantalla con
 *   `?lanzado=` para que espere la primera lectura.
 *
 * Se vuelve a mirar cada 30 s mientras está en marcha y cada 2 min si no.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { traeOpta } from "@/lib/opta";

export const RUTA_DIRECTO = "/data-analisis?area=directo";

type Ultima = { estado: string; resultado: string | null; empezo: string; enlace: string } | null;
type IndiceDirecto = { actualizado?: string; hasta?: string; partidos?: { partido: string; equipos?: string[]; conDatos?: boolean }[] };

export type EstadoDirecto = {
  /** null = aún no se sabe. */
  preparado: boolean | null;
  ultima: Ultima;
  indice: IndiceDirecto | null;
};

const VIVO_MS = 3 * 60_000;

/** El índice se ha escrito hace poco y no ha llegado a su hora de acabar. */
export function indiceVivo(i: IndiceDirecto | null | undefined, ahora: number): boolean {
  if (!i?.actualizado) return false;
  const t = Date.parse(i.actualizado);
  if (!Number.isFinite(t) || ahora - t > VIVO_MS) return false;
  const h = i.hasta ? Date.parse(i.hasta) : NaN;
  return !Number.isFinite(h) || h > ahora;
}

export function useDirectoOpta(admin: boolean) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoDirecto>({ preparado: null, ultima: null, indice: null });
  const [ahora, setAhora] = useState(0);
  const [vuelta, setVuelta] = useState(0);
  const [lanzando, setLanzando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [g, indice] = await Promise.all([
        admin
          ? fetch("/api/opta/directo", { cache: "no-store" })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null),
        traeOpta<IndiceDirecto>("opta:directo"),
      ]);
      if (!vivo) return;
      setAhora(Date.now());
      setEstado({ preparado: g?.success ? !!g.preparado : admin ? false : null, ultima: g?.ultima ?? null, indice });
    })();
    return () => {
      vivo = false;
    };
  }, [admin, vuelta]);

  const corriendo = !!estado.ultima && estado.ultima.estado !== "completed";
  const enMarcha = corriendo || indiceVivo(estado.indice, ahora);

  useEffect(() => {
    const t = window.setInterval(() => setVuelta((v) => v + 1), enMarcha || lanzando ? 30_000 : 120_000);
    return () => window.clearInterval(t);
  }, [enMarcha, lanzando]);

  const abre = useCallback(async (alLanzar?: (en: number) => void) => {
    if (enMarcha) {
      router.push(RUTA_DIRECTO);
      return;
    }
    if (!admin) {
      router.push(RUTA_DIRECTO);
      return;
    }
    setLanzando(true);
    try {
      const r = await fetch("/api/opta/directo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duracion: 150 }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) throw new Error(j?.error ?? "No se ha podido lanzar.");
      toast.success("Directo en marcha", { description: "La primera lectura llega en uno o dos minutos." });
      const en = Date.now();
      if (alLanzar) {
        alLanzar(en);
        setLanzando(false);
        setVuelta((v) => v + 1);
      } else router.push(`${RUTA_DIRECTO}&lanzado=${en}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido lanzar.");
      setLanzando(false);
    }
  }, [admin, enMarcha, router]);

  return { ...estado, enMarcha, corriendo, lanzando, abre, recarga: () => setVuelta((v) => v + 1) };
}
