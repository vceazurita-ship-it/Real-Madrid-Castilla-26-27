/* Prueba local de datos-copia.mjs contra un Postgres en memoria. */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const ej = promisify(execFile);
import postgres from "postgres";
const db = await PGlite.create();
const s = new PGLiteSocketServer({ db, port: 54330, host: "127.0.0.1" });
await s.start();
const url = "postgres://postgres@127.0.0.1:54330/postgres";
const fichero = process.argv[2];
const corre = async () => { try { return (await ej("node", ["scripts/datos-copia.mjs", "--desde", fichero, "--hacia", url, "--hacer"])).stdout; } catch (e) { return String(e.stdout) + String(e.stderr); } };
console.log(await corre());
console.log(await corre());
const sql = postgres(url, { max: 1, ssl: false, prepare: false });
console.log(JSON.stringify([...(await sql.unsafe("select key, data from app_documents order by key"))]));
console.log(JSON.stringify([...(await sql.unsafe("select count(*)::int n from general_seasons"))]));
await sql.end(); await s.stop(); await db.close();
