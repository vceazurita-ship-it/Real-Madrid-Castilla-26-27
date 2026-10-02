/**
 * EL TURNO DEL CHROME DEL CLUB.
 *
 * La descarga de Wyscout (`wyscout-liga.mjs`) y Hudl (`hudl-chrome.mjs`)
 * manejan el mismo Chrome: mismo perfil (`rmcf-wyscout`) y mismo puerto
 * (9333). A la vez se pisan —Wyscout cierra las pestañas de Hudl al
 * conectar—, y el vigía sólo evita que coincidan los encargos, no la tarea
 * programada de los martes. Así que quien vaya a usarlo coge turno en
 * `.cache/wyscout/chrome.turno` y espera si lo tiene otro.
 *
 * Un turno se da por abandonado si el proceso que lo cogió ya no existe o si
 * tiene más de cuatro horas. Se suelta solo al salir el proceso.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const FICHERO = path.join(RAIZ, ".cache", "wyscout", "chrome.turno");

const CADUCA_MS = 4 * 3_600_000;

const vivo = (pid) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};

function quienLoTiene() {
  try {
    const turno = JSON.parse(fs.readFileSync(FICHERO, "utf8"));

    if (turno.pid === process.pid) return null;

    if (!vivo(turno.pid) || Date.now() - Date.parse(turno.desde) > CADUCA_MS) return null;

    return turno;
  } catch {
    return null;
  }
}

let mio = false;

export function sueltaTurno() {
  if (!mio) return;

  mio = false;

  try {
    const turno = JSON.parse(fs.readFileSync(FICHERO, "utf8"));

    if (turno.pid === process.pid) fs.rmSync(FICHERO, { force: true });
  } catch {
    /* ya no estaba */
  }
}

/**
 * Espera a que el Chrome esté libre y lo coge. Devuelve false si pasado el
 * plazo sigue ocupado (quien llama decide si sigue o no).
 */
export async function esperaTurno(quien, plazoMs = 90 * 60_000) {
  const hasta = Date.now() + plazoMs;

  let avisado = false;

  for (;;) {
    const otro = quienLoTiene();

    if (!otro) break;

    if (!avisado) {
      console.log(`  (el Chrome del club lo está usando «${otro.quien}» desde ${otro.desde}: se espera a que acabe)`);

      avisado = true;
    }

    if (Date.now() > hasta) return false;

    await new Promise((r) => setTimeout(r, 15_000));
  }

  fs.mkdirSync(path.dirname(FICHERO), { recursive: true });

  fs.writeFileSync(FICHERO, JSON.stringify({ pid: process.pid, quien, desde: new Date().toISOString() }), "utf8");

  mio = true;

  process.once("exit", sueltaTurno);

  return true;
}
