"use client";

/**
 * ¿Quien mira es un jugador? (18/11/2026). Lee la cookie `plataforma_rol`,
 * que sólo sirve para pintar (menú, botones): lo que se ve o no lo decide el
 * proxy (proxy.ts), no esto.
 */
import { useSyncExternalStore } from "react";

const suscribe = () => () => {};
const lee = () => /(?:^|;\s*)plataforma_rol=jugador(?:;|$)/.test(document.cookie);
const enServidor = () => false;

export function useEsJugador() {
  return useSyncExternalStore(suscribe, lee, enServidor);
}
