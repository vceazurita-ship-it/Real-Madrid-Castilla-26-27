import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { jugadoresDeXlsx, type FilaJugador } from "@/lib/data-analisis/leer";

export const dynamic = "force-dynamic";

/*
| LA ÉLITE PARA EL ÁREA DE MEJORA (05/11/2026)
|
| Los «Search results» de Wyscout de Primera y de la Premier, que baja cada
| mes `scripts/wyscout-elite.cmd` a public/data/wys-elite/<liga>/. Se leen con
| el mismo lector que la categoría y se quedan en memoria hasta que cambia la
| carpeta. Sólo van los que pueden servir de espejo: menores de 28 con 450′.
|
| Con `?todos=1` (18/11/2026, el analista: «un buscador por nombre de cualquier
| jugador de las dos ligas con independencia de la posición») va además
| `todos`: cualquier edad y puesto con 180′ o más, para el buscador libre del
| cara a cara de la ficha individual.
*/

const LIGAS = [
  { carpeta: "laliga", liga: "Primera" },
  { carpeta: "premier", liga: "Premier" },
];

const EDAD_MAXIMA = 28;
const MINUTOS = 450;
/** El buscador libre: cualquiera que haya jugado algo de verdad. */
const MINUTOS_TODOS = 180;

type Liga = { liga: string; jugadores: FilaJugador[] };
type Respuesta = { actualizado: string | null; ligas: Liga[]; todos: Liga[] };

let cache: { firma: string; datos: Respuesta } | null = null;

export async function GET(req: Request) {
  const conTodos = new URL(req.url).searchParams.get("todos") === "1";
  const raiz = path.join(process.cwd(), "public", "data", "wys-elite");
  const ficheros: { liga: string; ruta: string; mtime: number }[] = [];

  for (const { carpeta, liga } of LIGAS) {
    const dir = path.join(raiz, carpeta);
    const nombres = await fs.readdir(dir).catch(() => [] as string[]);

    for (const nombre of nombres.filter((n) => /\.xlsx$/i.test(n))) {
      const st = await fs.stat(path.join(dir, nombre));
      ficheros.push({ liga, ruta: path.join(dir, nombre), mtime: st.mtimeMs });
    }
  }

  const firma = ficheros.map((f) => `${f.ruta}:${f.mtime}`).join("|");

  if (cache?.firma !== firma) {
    const porLiga = new Map<string, Map<string, FilaJugador>>();
    const todosPorLiga = new Map<string, Map<string, FilaJugador>>();

    for (const f of ficheros) {
      const filas = jugadoresDeXlsx(await fs.readFile(f.ruta));
      const mapa = porLiga.get(f.liga) ?? new Map<string, FilaJugador>();
      const todos = todosPorLiga.get(f.liga) ?? new Map<string, FilaJugador>();

      for (const j of filas) {
        if (j.minutos >= MINUTOS_TODOS) {
          const clave = `${j.jugador}|${j.equipo}`;
          const hay = todos.get(clave);
          if (!hay || j.minutos > hay.minutos) todos.set(clave, { ...j, temporada: "actual" });
        }
        if (j.minutos < MINUTOS || !j.edad || j.edad > EDAD_MAXIMA) continue;
        const clave = `${j.jugador}|${j.equipo}`;
        const hay = mapa.get(clave);
        /* El mismo jugador en dos ficheros: el que lleva más minutos es el más reciente. */
        if (!hay || j.minutos > hay.minutos) mapa.set(clave, { ...j, temporada: "actual" });
      }

      porLiga.set(f.liga, mapa);
      todosPorLiga.set(f.liga, todos);
    }

    cache = {
      firma,
      datos: {
        actualizado: ficheros.length ? new Date(Math.max(...ficheros.map((f) => f.mtime))).toISOString().slice(0, 10) : null,
        ligas: [...porLiga].map(([liga, mapa]) => ({ liga, jugadores: [...mapa.values()] })),
        todos: [...todosPorLiga].map(([liga, mapa]) => ({ liga, jugadores: [...mapa.values()] })),
      },
    };
  }

  const { todos, ...base } = cache.datos;

  return NextResponse.json(conTodos ? { ...base, todos } : base, { headers: { "Cache-Control": "public, max-age=3600" } });
}
