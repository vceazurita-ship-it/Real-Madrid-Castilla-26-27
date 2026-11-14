/* eslint-disable @typescript-eslint/no-require-imports -- módulo CommonJS compartido por la web y los scripts */
/*
|--------------------------------------------------------------------------
| CLIENTE DE DATOS CON RESERVA (14/11/2026)
|--------------------------------------------------------------------------
|
| Supabase cortó el servicio del plan gratis el 13/11 (media del ciclo por
| encima de 1 GB). Este módulo es un `createClient` que se comporta como el
| de supabase-js en lo que usa la app:
|
|   · sin DATOS_PG_URL  → el cliente de Supabase de siempre (nada cambia)
|   · con DATOS_PG_URL  → las tablas en un Postgres propio (Render, Neon…)
|                         y los ficheros en Backblaze B2 (scripts/b2.cjs)
|
| Sólo implementa lo que el código usa: select/insert/upsert/update/delete
| con eq, neq, in, like, ilike, is, gt/gte/lt/lte, order, limit, range,
| single, maybeSingle; y en storage upload, getPublicUrl, list, remove,
| download, createSignedUrl(s). Lo que no conoce lo devuelve como `error`,
| igual que supabase-js, en vez de reventar.
|
| Los ficheros que siguen en Supabase no se ven mientras dure el corte: los
| nuevos van a B2 y se sirven por /api/video/<ruta> (vale para cualquier tipo).
*/


const TABLAS = new Set(["app_documents", "general_seasons", "performance_seasons"]);
const COLUMNAS_JSON = new Set(["data"]);

let sqlCompartido = null;

function conexion() {
  if (sqlCompartido) return sqlCompartido;
  const postgres = require("postgres");
  sqlCompartido = postgres(process.env.DATOS_PG_URL, {
    max: Number(process.env.DATOS_PG_MAX || 5),
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: /localhost|127\.0\.0\.1/.test(process.env.DATOS_PG_URL) ? false : "require",
    prepare: false,
  });
  return sqlCompartido;
}

const enReserva = () => Boolean(process.env.DATOS_PG_URL);

/* ------------------------------ consultas ------------------------------ */

const id = (nombre) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(nombre)) throw new Error(`columna no válida: ${nombre}`);
  return `"${nombre}"`;
};

const columnasDe = (texto) =>
  !texto || texto.trim() === "*"
    ? "*"
    : texto
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .map(id)
        .join(", ");

class Consulta {
  constructor(tabla) {
    this.tabla = tabla;
    this.accion = "select";
    this.columnas = "*";
    this.filtros = [];
    this.orden = [];
    this.tope = null;
    this.desde = null;
    this.unico = null;
    this.devuelve = false;
    this.cuenta = false;
    this.soloCuenta = false;
    this.filas = null;
    this.cambios = null;
    this.conflicto = null;
    this.ignoraRepetidos = false;
  }

  select(columnas = "*", opciones = {}) {
    if (this.accion === "select") this.columnas = columnasDe(columnas);
    else {
      this.devuelve = true;
      this.columnas = columnasDe(columnas);
    }
    if (opciones.count) this.cuenta = true;
    if (opciones.head) this.soloCuenta = true;
    return this;
  }
  insert(filas) {
    this.accion = "insert";
    this.filas = Array.isArray(filas) ? filas : [filas];
    return this;
  }
  upsert(filas, opciones = {}) {
    this.accion = "upsert";
    this.filas = Array.isArray(filas) ? filas : [filas];
    this.conflicto = opciones.onConflict || (this.tabla === "app_documents" ? "key" : null);
    this.ignoraRepetidos = Boolean(opciones.ignoreDuplicates);
    return this;
  }
  update(cambios) {
    this.accion = "update";
    this.cambios = cambios;
    return this;
  }
  delete() {
    this.accion = "delete";
    return this;
  }

  filtro(columna, op, valor) {
    this.filtros.push({ columna, op, valor });
    return this;
  }
  eq(c, v) { return this.filtro(c, "=", v); }
  neq(c, v) { return this.filtro(c, "<>", v); }
  gt(c, v) { return this.filtro(c, ">", v); }
  gte(c, v) { return this.filtro(c, ">=", v); }
  lt(c, v) { return this.filtro(c, "<", v); }
  lte(c, v) { return this.filtro(c, "<=", v); }
  like(c, v) { return this.filtro(c, "like", v); }
  ilike(c, v) { return this.filtro(c, "ilike", v); }
  in(c, v) { return this.filtro(c, "in", v); }
  is(c, v) { return this.filtro(c, "is", v); }

  order(columna, opciones = {}) {
    this.orden.push(`${id(columna)} ${opciones.ascending === false ? "desc" : "asc"}${opciones.nullsFirst ? " nulls first" : ""}`);
    return this;
  }
  limit(n) {
    this.tope = Number(n);
    return this;
  }
  range(desde, hasta) {
    this.desde = Number(desde);
    this.tope = Number(hasta) - Number(desde) + 1;
    return this;
  }
  single() {
    this.unico = "single";
    return this;
  }
  maybeSingle() {
    this.unico = "maybe";
    return this;
  }
  abortSignal() {
    return this;
  }

  /* El SQL con sus parámetros ($1, $2…). */
  donde(valores) {
    if (!this.filtros.length) return "";
    const partes = this.filtros.map(({ columna, op, valor }) => {
      if (op === "is") return `${id(columna)} is ${valor === null ? "null" : valor ? "true" : "false"}`;
      if (op === "in") {
        const lista = Array.isArray(valor) ? valor : [];
        if (!lista.length) return "false";
        return `${id(columna)} in (${lista.map((v) => (valores.push(v), `$${valores.length}`)).join(", ")})`;
      }
      valores.push(valor);
      return `${id(columna)} ${op} $${valores.length}`;
    });
    return ` where ${partes.join(" and ")}`;
  }

  valor(columna, v, valores) {
    valores.push(COLUMNAS_JSON.has(columna) && v !== null && v !== undefined ? JSON.stringify(v) : v);
    return COLUMNAS_JSON.has(columna) ? `$${valores.length}::text::jsonb` : `$${valores.length}`;
  }

  async ejecuta() {
    if (!TABLAS.has(this.tabla)) return { data: null, error: { message: `tabla desconocida en la reserva: ${this.tabla}` }, count: null };
    const sql = conexion();
    const t = id(this.tabla);
    const valores = [];
    let texto;

    if (this.accion === "select") {
      texto = `select ${this.soloCuenta ? "count(*)::int as n" : this.columnas} from ${t}${this.donde(valores)}`;
      if (!this.soloCuenta && this.orden.length) texto += ` order by ${this.orden.join(", ")}`;
      if (!this.soloCuenta && this.tope != null) texto += ` limit ${Math.max(0, this.tope | 0)}`;
      if (!this.soloCuenta && this.desde != null) texto += ` offset ${Math.max(0, this.desde | 0)}`;
    } else if (this.accion === "insert" || this.accion === "upsert") {
      if (!this.filas.length) return { data: [], error: null, count: null };
      const cols = [...new Set(this.filas.flatMap((f) => Object.keys(f)))];
      const tuplas = this.filas.map((f) => `(${cols.map((c) => (f[c] === undefined ? "default" : this.valor(c, f[c], valores))).join(", ")})`);
      texto = `insert into ${t} (${cols.map(id).join(", ")}) values ${tuplas.join(", ")}`;
      if (this.accion === "upsert" && this.conflicto) {
        const claves = this.conflicto.split(",").map((c) => c.trim());
        const resto = cols.filter((c) => !claves.includes(c));
        texto += ` on conflict (${claves.map(id).join(", ")}) ${
          this.ignoraRepetidos || !resto.length ? "do nothing" : `do update set ${resto.map((c) => `${id(c)} = excluded.${id(c)}`).join(", ")}`
        }`;
      }
      if (this.devuelve) texto += ` returning ${this.columnas}`;
    } else if (this.accion === "update") {
      const sets = Object.entries(this.cambios || {})
        .filter(([, v]) => v !== undefined)
        .map(([c, v]) => `${id(c)} = ${this.valor(c, v, valores)}`);
      if (!sets.length) return { data: [], error: null, count: null };
      texto = `update ${t} set ${sets.join(", ")}${this.donde(valores)}`;
      if (this.devuelve) texto += ` returning ${this.columnas}`;
    } else {
      if (!this.filtros.length) return { data: null, error: { message: "delete sin filtro" }, count: null };
      texto = `delete from ${t}${this.donde(valores)}`;
      if (this.devuelve) texto += ` returning ${this.columnas}`;
    }

    try {
      const filas = [...(await sql.unsafe(texto, valores))];
      if (this.soloCuenta) return { data: null, error: null, count: filas[0]?.n ?? 0 };
      const datos = this.accion === "select" || this.devuelve ? filas : null;
      const count = this.cuenta ? filas.length : null;
      if (this.unico) {
        if (filas.length > 1) return { data: null, error: { message: "varias filas para single()", code: "PGRST116" }, count };
        if (!filas.length) return this.unico === "single" ? { data: null, error: { message: "ninguna fila", code: "PGRST116" }, count } : { data: null, error: null, count };
        return { data: filas[0], error: null, count, status: 200 };
      }
      return { data: datos, error: null, count, status: 200 };
    } catch (e) {
      return { data: null, error: { message: e.message, code: e.code }, count: null, status: 500 };
    }
  }

  then(ok, mal) {
    return this.ejecuta().then(ok, mal);
  }
  catch(mal) {
    return this.ejecuta().catch(mal);
  }
}

/* ------------------------------ ficheros ------------------------------ */

const SITIO = () => (process.env.SITIO_PUBLICO || "https://rmcf-castilla.onrender.com").replace(/\/$/, "");
const b2 = () => require("../../scripts/b2.cjs");
const publica = (ruta) => `${SITIO()}/api/video/${ruta.split("/").map(encodeURIComponent).join("/")}`;

async function aBuffer(cuerpo) {
  if (Buffer.isBuffer(cuerpo)) return cuerpo;
  if (typeof cuerpo === "string") return Buffer.from(cuerpo);
  if (cuerpo instanceof ArrayBuffer) return Buffer.from(cuerpo);
  if (ArrayBuffer.isView(cuerpo)) return Buffer.from(cuerpo.buffer, cuerpo.byteOffset, cuerpo.byteLength);
  if (cuerpo && typeof cuerpo.arrayBuffer === "function") return Buffer.from(await cuerpo.arrayBuffer());
  throw new Error("cuerpo de fichero no reconocido");
}

function almacen(cubo) {
  const prefijo = (r) => `${cubo === "performance" ? "" : `${cubo}/`}${String(r).replace(/^\/+/, "")}`;
  return {
    async upload(ruta, cuerpo, opciones = {}) {
      try {
        const datos = await aBuffer(cuerpo);
        await b2().sube(prefijo(ruta), datos, opciones.contentType || "application/octet-stream");
        return { data: { path: ruta, id: ruta, fullPath: `${cubo}/${ruta}` }, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },
    getPublicUrl(ruta) {
      return { data: { publicUrl: publica(prefijo(ruta)) } };
    },
    async createSignedUrl(ruta) {
      return { data: { signedUrl: publica(prefijo(ruta)) }, error: null };
    },
    async createSignedUrls(rutas) {
      return { data: rutas.map((r) => ({ path: r, signedUrl: publica(prefijo(r)), error: null })), error: null };
    },
    async createSignedUploadUrl() {
      return { data: null, error: { message: "Subida directa no disponible mientras Supabase está cortado" } };
    },
    async list(carpeta = "", opciones = {}) {
      try {
        const base = prefijo(carpeta ? `${carpeta.replace(/\/$/, "")}/` : "");
        const todo = await b2().lista(base);
        const vistos = new Map();
        for (const [nombre, bytes] of todo) {
          const resto = nombre.slice(base.length);
          const [primero, ...mas] = resto.split("/");
          if (!primero) continue;
          if (mas.length) {
            if (!vistos.has(primero)) vistos.set(primero, { name: primero, id: null, metadata: null });
          } else vistos.set(primero, { name: primero, id: nombre, metadata: { size: bytes }, created_at: null, updated_at: null });
        }
        const lista = [...vistos.values()].sort((a, b) => a.name.localeCompare(b.name));
        const desde = Number(opciones.offset || 0);
        return { data: lista.slice(desde, desde + Number(opciones.limit || 100)), error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },
    async remove(rutas) {
      try {
        for (const r of rutas) await b2().oculta(prefijo(r));
        return { data: rutas.map((r) => ({ name: r })), error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },
    async download(ruta) {
      try {
        const r = await fetch(await b2().urlPublica(prefijo(ruta)));
        if (!r.ok) return { data: null, error: { message: `HTTP ${r.status}` } };
        return { data: await r.blob(), error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },
  };
}

/* ------------------------------ el cliente ------------------------------ */

function clienteReserva() {
  return {
    reserva: true,
    from: (tabla) => new Consulta(tabla),
    storage: { from: almacen },
    rpc: async (nombre) => ({ data: null, error: { message: `rpc ${nombre} no disponible en la reserva` } }),
  };
}

function createClient(url, clave, opciones) {
  if (enReserva()) return clienteReserva();
  const { createClient: real } = require("@supabase/supabase-js");
  return real(url, clave, opciones);
}

module.exports = { createClient, enReserva, conexion };
