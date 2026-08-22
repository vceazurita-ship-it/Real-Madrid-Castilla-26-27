"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DocStatus = "loading" | "saved" | "saving" | "offline" | "error";

interface Options<T> {
  /** Clave del documento en `app_documents`. */
  key: string;
  /** Etiqueta para agrupar documentos del mismo tipo. */
  kind: string;
  /** Estado inicial si no existe nada guardado. */
  fallback: T;
  /** Milisegundos de espera antes de guardar tras el último cambio. */
  debounce?: number;
}

interface Result<T> {
  value: T;
  setValue: (updater: T | ((current: T) => T)) => void;
  status: DocStatus;
  /** El almacén remoto no está disponible: se trabaja solo en local. */
  localOnly: boolean;
  lastSavedAt: string | null;
  reload: () => void;
}

/**
 * Estado persistido en Supabase con caché en `localStorage`.
 *
 * La caché local se pinta de inmediato (y sigue funcionando si Supabase falla
 * o la tabla `app_documents` todavía no existe), mientras el documento remoto
 * se carga en segundo plano y pasa a mandar en cuanto llega.
 */
export function useRemoteDoc<T>({
  key,
  kind,
  fallback,
  debounce = 900,
}: Options<T>): Result<T> {
  const storageKey = `rmcf-doc:${key}`;

  const [value, setInternal] = useState<T>(fallback);
  const [status, setStatus] = useState<DocStatus>("loading");
  const [localOnly, setLocalOnly] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /** Evita guardar durante la carga inicial y en el primer render. */
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<T | null>(null);

  const readCache = useCallback((): T | null => {
    if (typeof window === "undefined") return null;

    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const writeCache = useCallback(
    (next: T) => {
      if (typeof window === "undefined") return;

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* cuota llena o modo privado: seguimos sin caché */
      }
    },
    [storageKey]
  );

  // Carga inicial: caché primero, remoto después.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      ready.current = false;
      setStatus("loading");

      const cached = readCache();
      if (cached !== null) setInternal(cached);

      try {
        const response = await fetch(
          `/api/docs?key=${encodeURIComponent(key)}`,
          { cache: "no-store" }
        );

        const body = await response.json();

        if (cancelled) return;

        if (!response.ok || !body.success) throw new Error(body.error);

        if (body.missingTable) {
          setLocalOnly(true);
          setStatus("offline");
        } else {
          setLocalOnly(false);

          if (body.data !== null && body.data !== undefined) {
            setInternal(body.data as T);
            writeCache(body.data as T);
          } else if (cached === null) {
            setInternal(fallback);
          }

          setLastSavedAt(body.updatedAt ?? null);
          setStatus("saved");
        }
      } catch (error) {
        console.error("[useRemoteDoc] carga", error);

        if (cancelled) return;

        setLocalOnly(true);
        setStatus("offline");
      } finally {
        if (!cancelled) ready.current = true;
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // `fallback` se usa solo como valor inicial; no debe reiniciar la carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadToken, readCache, writeCache]);

  const flush = useCallback(async () => {
    const next = pending.current;

    pending.current = null;

    if (next === null) return;

    setStatus("saving");

    try {
      const response = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, kind, data: next }),
      });

      const body = await response.json();

      if (!response.ok || !body.success) throw new Error(body.error);

      if (body.missingTable) {
        setLocalOnly(true);
        setStatus("offline");
        return;
      }

      setLocalOnly(false);
      setLastSavedAt(body.updatedAt ?? null);
      setStatus("saved");
    } catch (error) {
      console.error("[useRemoteDoc] guardado", error);
      setStatus("error");
    }
  }, [key, kind]);

  const setValue = useCallback(
    (updater: T | ((current: T) => T)) => {
      setInternal((current) => {
        const next =
          typeof updater === "function"
            ? (updater as (value: T) => T)(current)
            : updater;

        writeCache(next);

        if (ready.current) {
          pending.current = next;

          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void flush(), debounce);
        }

        return next;
      });
    },
    [debounce, flush, writeCache]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { value, setValue, status, localOnly, lastSavedAt, reload };
}
