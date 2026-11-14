/* Postgres en memoria en 127.0.0.1:54331 con el esquema y un calendario, para probar la web con DATOS_PG_URL. Sólo local. */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
const db = await PGlite.create();
await db.exec(fs.readFileSync(new URL("../supabase/reserva-esquema.sql", import.meta.url), "utf8"));
await db.query("insert into app_documents (key, kind, data) values ($1, 'castilla', $2::jsonb)", ["castilla:calendario", JSON.stringify({ partidos: [{ jornada: 13, local: "Castilla", visitante: "Prueba", cuando: "2026-11-15T12:00" }] })]);
const s = new PGLiteSocketServer({ db, port: 54331, host: "127.0.0.1", maxConnections: 20 });
await s.start();
console.log("listo");
