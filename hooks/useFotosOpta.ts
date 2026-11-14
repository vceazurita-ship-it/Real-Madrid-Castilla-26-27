"use client";

/**
 * FOTOS PARA LO DE OPTA (14/11/2026, petición del analista: «coge las fotos de
 * todos los jugadores de plantillas rivales para que quede mejor en todo lo de
 * Opta»).
 *
 * Opta no da fotos. Se cruzan sus nombres con:
 * - el Castilla: los recortes de la plantilla (lib/playerImages.ts);
 * - los rivales: la columna FOTO de las plantillas rivales
 *   (/api/rivals?action=rivalesPlantillas, fotos de BeSoccer por el proxy).
 *
 * El cruce exige el mismo club (mismoClub) y el mismo apellido (último
 * token); con nombre completo igual, mejor. Si hay dos candidatos con el mismo
 * apellido y ninguno con el nombre completo, no se pone ninguna foto: mejor
 * las iniciales que la cara de otro.
 */

import { useCallback, useEffect, useState } from "react";

import { traeJson } from "@/lib/hojaCsv";
import { getPlayerImage } from "@/lib/playerImages";
import { mismoClub } from "@/lib/rivals/mismoClub";

type Fila = Record<string, unknown>;
type Ficha = { equipo: string; nombre: string; tokens: string[]; foto: string };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((t) => t.length > 1);

const valida = (u: string) => /^https?:\/\//.test(u) && !/default\.png|placeholder|nofoto/i.test(u);

let cache: Promise<Ficha[]> | null = null;

function cargaFichas(): Promise<Ficha[]> {
  cache ??= traeJson<Fila[]>("/api/rivals?action=rivalesPlantillas")
    .then((filas) =>
      (Array.isArray(filas) ? filas : [])
        .map((f) => {
          const nombre = String(f.JUGADOR ?? f.NOMBRE ?? "").trim();
          const foto = String(f.FOTO ?? "").trim();
          return { equipo: String(f.NOMBRE_EQUIPO ?? "").trim(), nombre, tokens: norm(nombre), foto };
        })
        .filter((f) => f.nombre && f.equipo && valida(f.foto)),
    )
    .catch(() => {
      cache = null;
      return [];
    });
  return cache;
}

/** `foto(nombre, equipo, esCastilla)` → URL lista para <img>, o null. */
export function useFotosOpta() {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  useEffect(() => {
    let vivo = true;
    void cargaFichas().then((f) => vivo && setFichas(f));
    return () => {
      vivo = false;
    };
  }, []);

  return useCallback(
    (nombre: string, equipo: string, esCastilla = false): string | null => {
      if (!nombre) return null;
      if (esCastilla) return getPlayerImage(nombre, "cerca");
      const t = norm(nombre);
      if (!t.length) return null;
      const apellido = t[t.length - 1];
      const delClub = fichas.filter((f) => mismoClub(f.equipo, equipo));
      const exacta = delClub.find((f) => f.tokens.join(" ") === t.join(" "));
      const conApellido = exacta ? [exacta] : delClub.filter((f) => f.tokens.includes(apellido) && (t.length === 1 || f.tokens.some((x) => t.slice(0, -1).includes(x)) || f.tokens.length === 1));
      const una = conApellido.length === 1 ? conApellido[0] : delClub.filter((f) => f.tokens.includes(apellido)).length === 1 ? delClub.find((f) => f.tokens.includes(apellido)) : null;
      return una ? `/api/rivals/foto?url=${encodeURIComponent(una.foto)}` : null;
    },
    [fichas],
  );
}
