"use client";

import { useEffect } from "react";

/** Evita que la página de detrás haga scroll mientras hay un modal abierto. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
