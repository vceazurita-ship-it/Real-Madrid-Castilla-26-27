/**
 * Lo que comparten `x-ideas.mjs` (leer X y sacar ideas) y `x-idea-aplica.mjs`
 * («Añadir» y «Deshacer» una idea) (12/11/2026): Supabase con escritura
 * condicional, Claude Code sin ventana y el reglamento de lib/x-ideas.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const require = createRequire(import.meta.url);

require(path.join(RAIZ, "scripts/cargador-ts.cjs"));

/** Las reglas y la forma de los documentos (lib/x-ideas.ts). */
export const X = require(path.join(RAIZ, "lib/x-ideas.ts"));

export const CACHE = path.join(RAIZ, ".cache", "x-ideas");

fs.mkdirSync(CACHE, { recursive: true });

export const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Una espera con un poco de azar: X se lee como lo leería una persona, sin prisa. */
export const pausa = (min, max) => espera(min + Math.random() * (max - min));

export const paso = (n, total, texto) => console.log(`PASO: ${n}/${total} · ${texto}`);

/* ------------------------------------------------------------------ */
/*  SUPABASE                                                           */
/* ------------------------------------------------------------------ */

let cliente = null;

export function supabase() {
  if (cliente) return cliente;

  const { entorno } = require(path.join(RAIZ, "scripts/supabase-local.cjs"));
  const env = entorno();

  if (!env) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");

  const { createClient } = require(path.join(RAIZ, "lib/datos/cliente.cjs")); /* con reserva */

  cliente = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  return cliente;
}

export async function leeDoc(clave) {
  const { data, error } = await supabase().from("app_documents").select("data").eq("key", clave).maybeSingle();

  if (error) throw new Error(error.message);

  return data?.data ?? null;
}

/**
 * Cambia un documento sólo si nadie lo ha tocado entre medias (como `cambiaDoc`
 * de lib/docStore.ts): la web escribe en `x:ideas` cuando se pulsa un botón.
 */
export async function cambiaDoc(clave, kind, cambia) {
  for (let i = 0; i < 8; i++) {
    const { data: fila, error } = await supabase().from("app_documents").select("data, updated_at").eq("key", clave).maybeSingle();

    if (error) throw new Error(error.message);

    const data = cambia(fila?.data ?? null);
    const updated_at = new Date().toISOString();

    if (!fila) {
      const { error: e } = await supabase().from("app_documents").insert({ key: clave, kind, data, updated_at });

      if (!e) return data;
      if (e.code !== "23505") throw new Error(e.message);
      continue;
    }

    const { data: filas, error: e2 } = await supabase()
      .from("app_documents")
      .update({ data, updated_at })
      .eq("key", clave)
      .eq("updated_at", fila.updated_at)
      .select("key");

    if (e2) throw new Error(e2.message);
    if (filas?.length) return data;

    await espera(200 + Math.random() * 400);
  }

  throw new Error(`el documento ${clave} cambia sin parar`);
}

/** Cambia una idea de `x:ideas` (releyendo justo antes). */
export function cambiaIdea(id, cambio) {
  return cambiaDoc(X.CLAVE_X_IDEAS, "x", (crudo) => {
    const doc = X.normalizaIdeas(crudo);

    return { ideas: doc.ideas.map((i) => (i.id === id ? cambio(i) : i)) };
  });
}

/* ------------------------------------------------------------------ */
/*  CLAUDE CODE SIN VENTANA                                            */
/* ------------------------------------------------------------------ */

export const CLAUDE = [
  path.join(process.env.USERPROFILE ?? "", ".local", "bin", "claude.exe"),
  path.join(process.env.APPDATA ?? "", "npm", "claude.cmd"),
].find((r) => fs.existsSync(r));

/**
 * Llama a `claude -p`. El encargo va SIEMPRE por la entrada estándar y nunca
 * en la línea de órdenes: lleva texto que viene de internet y un `.cmd` pasa
 * por cmd.exe, donde un «&» o unas comillas serían órdenes.
 */
export function claude(encargo, { cwd, argumentos = [], plazoMs = 15 * 60_000, alLinea } = {}) {
  if (!CLAUDE) return Promise.resolve({ codigo: -1, texto: "no está Claude Code en este ordenador (~/.local/bin/claude.exe)" });

  const esCmd = CLAUDE.endsWith(".cmd");
  const args = [...(esCmd ? ["/d", "/c", CLAUDE] : []), "-p", "--output-format", "text", ...argumentos];

  /* Dentro de otra sesión de Claude Code (pruebas a mano) no arranca si no se quitan. */
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  return new Promise((resolve) => {
    const hijo = spawn(esCmd ? "cmd.exe" : CLAUDE, args, { cwd, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let texto = "";
    let resto = "";

    const recoge = (trozo) => {
      texto = (texto + trozo.toString()).slice(-200_000);

      if (!alLinea) return;

      const lineas = (resto + trozo.toString()).split(/\r?\n/);
      resto = lineas.pop() ?? "";
      for (const l of lineas) alLinea(l);
    };

    hijo.stdout.on("data", recoge);
    hijo.stderr.on("data", recoge);

    const reloj = setTimeout(() => {
      texto += "\n(plazo agotado: se corta)";
      try {
        spawn("taskkill", ["/PID", String(hijo.pid), "/T", "/F"], { windowsHide: true });
      } catch {
        hijo.kill();
      }
    }, plazoMs);

    hijo.on("error", (e) => {
      clearTimeout(reloj);
      resolve({ codigo: -1, texto: e.message });
    });

    hijo.on("close", (codigo) => {
      clearTimeout(reloj);
      resolve({ codigo: codigo ?? -1, texto });
    });

    hijo.stdin.end(encargo, "utf8");
  });
}

/** Una línea legible de un error (sin páginas HTML de Cloudflare). */
export const claro = (e) => {
  const t = String(e?.message ?? e ?? "").trim();

  return t.startsWith("<") ? "Supabase no contesta" : t.split(/\r?\n/)[0].slice(0, 240);
};

/** Salir dejando que Supabase cierre (Windows y libuv: ver supabase-local.cjs). */
export function sal(codigo) {
  process.exitCode = codigo;
  setTimeout(() => process.exit(codigo), 300).unref();
}
