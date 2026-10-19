/*
|--------------------------------------------------------------------------
| EL PAQUETE DE LA SEMANA PARA LA RED DE AGENTES (19/10/2026)
|--------------------------------------------------------------------------
|
| Junta, SÓLO LEYENDO, todo lo que los agentes necesitan para una jornada y lo
| deja en `.cache/agentes/jNN/` como ficheros pequeños con un índice. No es un
| agente a propósito: recopilar es mecánico, y si lo hiciera un modelo podría
| «recordar» un dato en vez de leerlo. Los agentes sólo leen de aquí, y todo
| lo que afirman tiene que poder señalarse en uno de estos ficheros.
|
|   node scripts/agentes/paquete.mjs [--jornada N]   (sin jornada: la última jugada)
|
| Fuentes: castilla:calendario, goles:analisis, rivals:informe, rival-once:*,
| rival-tipologia:*, rival-analisis:*, cache:apps-script:rivales (plan de
| partido), abp-microciclo, public/data/analisis.json (Wyscout) y las hojas
| publicadas de ABP. Ver agentes/README.md.
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const { createClient } = require(path.join(RAIZ, "node_modules", "@supabase", "supabase-js"));
require(path.join(RAIZ, "node_modules", "dotenv")).config({ path: path.join(RAIZ, ".env.local"), quiet: true });

const ABP_OF = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=675048698&single=true&output=csv";
const ABP_DEF = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1071911136&single=true&output=csv";

/* Las métricas de Wyscout que entran (de 104): las que el cuerpo técnico usa para leer un partido. */
const METRICAS = [
  "Goles", "xG", "Tiros", "Tiros · a la portería", "Posesión del balón, %", "Pases %", "Pases hacia adelante %",
  "Ataques posicionales", "Ataques posicionales · con remate", "Contraataques", "Contraataques · con remate",
  "Jugadas a balón parado", "Jugadas a balón parado · con remate", "Córneres", "Córneres · con remate",
  "Centros", "Centros %", "Duelos %", "Duelos aéreos %", "Balones recuperados", "Balones recuperados · altos",
  "Balones perdidos", "Balones perdidos · bajos", "Entradas al área de penalti", "Toques en el área de penalti",
  "PPDA", "Intensidad de paso", "Faltas",
];

const valor = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const plano = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const VACIAS = new Set(["cf", "ud", "ad", "cd", "sd", "fc", "rcd", "club", "de", "b", "real", "sad", "ue", "cp", "rc"]);
/** La palabra que distingue a un equipo («Algeciras CF» → «algeciras»). */
const clave = (s) => plano(s).split(" ").filter((p) => p.length > 2 && !VACIAS.has(p)).sort((a, b) => b.length - a.length)[0] ?? plano(s);
const mismo = (a, b) => {
  const ka = clave(a);
  const pb = plano(b);
  return Boolean(ka) && (pb.includes(ka) || plano(a).includes(clave(b)));
};
const esCastilla = (s) => /castilla/i.test(String(s ?? ""));

async function csv(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`${r.status} ${url.slice(0, 60)}`);
  return r.text();
}

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const doc = async (key) => {
    const { data } = await s.from("app_documents").select("data, updated_at").eq("key", key).maybeSingle();
    return data ? { data: data.data, actualizado: data.updated_at } : null;
  };

  /* ---------- el partido ---------- */
  const cal = await doc("castilla:calendario");
  if (!cal) throw new Error("No hay castilla:calendario");
  const partidos = cal.data.partidos ?? [];
  const jugados = partidos.filter((p) => p.golesLocal !== null && p.golesLocal !== undefined);
  const pedida = valor("jornada") ? Number(valor("jornada")) : jugados[jugados.length - 1]?.jornada;
  const partido = partidos.find((p) => p.jornada === pedida);
  if (!partido) throw new Error(`No está la jornada ${pedida} en el calendario`);

  const enCasa = esCastilla(partido.local);
  const rival = enCasa ? partido.visitante : partido.local;
  const jugado = partido.golesLocal !== null && partido.golesLocal !== undefined;
  const tipo = jugado ? "post" : "previa";
  const carpeta = path.join(RAIZ, ".cache", "agentes", `j${String(pedida).padStart(2, "0")}`);
  fs.mkdirSync(carpeta, { recursive: true });

  const indice = [];
  const frescura = {};
  const guarda = (nombre, descripcion, datos) => {
    const texto = typeof datos === "string" ? datos : JSON.stringify(datos, null, 1);
    fs.writeFileSync(path.join(carpeta, nombre), texto);
    indice.push({ fichero: nombre, descripcion, bytes: Buffer.byteLength(texto) });
  };

  const anterior = partidos.filter((p) => p.jornada < pedida && p.golesLocal !== null && p.golesLocal !== undefined).slice(-1)[0] ?? null;
  const siguiente = partidos.find((p) => p.jornada > pedida) ?? null;
  frescura.calendario = cal.actualizado;

  guarda("partido.json", "El partido de la jornada (hora de Madrid), el anterior y el siguiente. `tipo` dice si toca informe post o previa.", {
    jornada: pedida, tipo, rival, enCasa, cuando: partido.cuando,
    marcador: jugado ? { castilla: enCasa ? partido.golesLocal : partido.golesVisitante, rival: enCasa ? partido.golesVisitante : partido.golesLocal } : null,
    anterior, siguiente,
  });

  /* ---------- goles por minuto ---------- */
  const goles = await doc("goles:analisis");
  if (goles) {
    frescura.goles = goles.actualizado;
    const nuestros = (goles.data.partidos ?? []).filter((p) => esCastilla(p.local) || esCastilla(p.visitante));
    const suyos = (goles.data.partidos ?? []).filter((p) => mismo(rival, p.local) || mismo(rival, p.visitante));
    guarda("goles.json", "Goles con su minuto (BeSoccer) de todos nuestros partidos y de los del rival; `lado` es local/visitante de ese partido. Incluye la tipología de nuestros goles.", {
      nuestros, delRival: suyos, tipologia: goles.data.tipologia ?? null,
    });
  }

  /* ---------- Wyscout ---------- */
  const ws = JSON.parse(fs.readFileSync(path.join(RAIZ, "public", "data", "analisis.json"), "utf8"));
  frescura.wyscout = ws.fuentes?.leidoEn ?? null;
  const temporada = (p) => p.fecha >= "2026-07-01";
  const fila = (p) => ({ fecha: p.fecha, rival: p.rival, goles: `${p.golesFavor}-${p.golesContra}`, esquema: p.esquema, datos: Object.fromEntries(METRICAS.filter((m) => p.datos?.[m] !== undefined).map((m) => [m, p.datos[m]])) });
  const deEquipo = (pred) => ws.partidos.filter((p) => temporada(p) && pred(p.equipo)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const castillaWs = deEquipo(esCastilla);
  const rivalWs = deEquipo((e) => mismo(rival, e));
  const todos = ws.partidos.filter(temporada);
  const mediana = (xs) => {
    const v = xs.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  const media = (xs) => {
    const v = xs.filter((x) => typeof x === "number" && Number.isFinite(x));
    return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null;
  };
  guarda("wyscout.json", "Wyscout de esta temporada: cada partido nuestro y del rival con 28 métricas, sus medias, y la MEDIANA de la liga por partido. `tieneEstaJornada` dice si Wyscout ya trae este partido (se baja los martes).", {
    metricas: METRICAS,
    castilla: { partidos: castillaWs.map(fila), media: Object.fromEntries(METRICAS.map((m) => [m, media(castillaWs.map((p) => p.datos?.[m]))])) },
    rival: { nombre: rival, partidos: rivalWs.map(fila), media: Object.fromEntries(METRICAS.map((m) => [m, media(rivalWs.map((p) => p.datos?.[m]))])) },
    medianaLiga: Object.fromEntries(METRICAS.map((m) => [m, mediana(todos.map((p) => p.datos?.[m]))])),
    equiposEnLiga: new Set(todos.map((p) => p.equipo)).size,
    tieneEstaJornada: jugado ? castillaWs.some((p) => p.fecha.slice(0, 10) === String(partido.cuando).slice(0, 10)) : null,
  });

  /* ---------- el rival ---------- */
  const informe = await doc("rivals:informe");
  const ficha = informe ? Object.values(informe.data.porId ?? {}).find((r) => mismo(rival, r.nombre) || mismo(rival, r.nombreLargo)) : null;
  if (ficha) {
    frescura.rivalBesoccer = informe.actualizado;
    const { escudo: _e, onces, partidos: suyos, ...resto } = ficha;
    guarda("rival-ficha.json", "Ficha del rival en BeSoccer: clasificación, entrenador, goleadores, estructuras, sus últimos onces y sus partidos de la temporada.", {
      ...resto, onces: (onces ?? []).slice(-4), partidos: (suyos ?? []).filter((p) => p.jugado).slice(-8),
    });
  }

  const { data: claves } = await s.from("app_documents").select("key, updated_at").or("key.like.rival-once:%,key.like.rival-tipologia:%,key.like.rival-analisis:%");
  for (const pre of ["rival-once", "rival-tipologia", "rival-analisis"]) {
    const k = (claves ?? []).find((c) => c.key.startsWith(`${pre}:`) && mismo(rival, c.key.slice(pre.length + 1).replace(/-/g, " ")));
    if (!k) continue;
    const d = await doc(k.key);
    frescura[pre] = d?.actualizado ?? null;
    const que = {
      "rival-once": "El once probable del rival que marcó el analista (titulares, dibujo, dudas).",
      "rival-tipologia": "Cómo marca y cómo encaja goles el rival, por tipo (córner, centro, falta…).",
      "rival-analisis": "Notas del analista sobre el rival por jornada (Análisis visual).",
    }[pre];
    guarda(`${pre}.json`, que, d?.data ?? null);
  }

  /* ---------- el plan de partido y el microciclo de ABP ---------- */
  const plan = await doc("cache:apps-script:rivales");
  const filaPlan = (plan?.data?.data ?? []).find((r) => Number(String(r.JORNADA).replace(/\D/g, "")) === pedida || mismo(rival, r.EQUIPO));
  if (filaPlan) {
    frescura.planPartido = plan.actualizado;
    guarda("plan-partido.json", "La fila del plan de partido del rival (hoja RIVALES): fortalezas, debilidades, ataque, defensa, ABP ofensiva y defensiva tal como las escribió el cuerpo técnico.", filaPlan);
  }

  const micro = await doc("abp-microciclo");
  const delRival = Object.values(micro?.data?.micros ?? {}).filter((m) => mismo(rival, m.rival)).slice(-1)[0];
  if (delRival) {
    frescura.microAbp = micro.actualizado;
    guarda("microciclo-abp.json", "El microciclo de balón parado de la semana de este rival: días, tareas, minutos, aspectos trabajados.", delRival);
  }

  /* ---------- las hojas de ABP ---------- */
  for (const [nombre, url, que] of [
    ["abp-ofensivo.csv", ABP_OF, "Hoja de ABP ofensivo (acciones nuestras a balón parado), toda la temporada. JORNADA dice el partido."],
    ["abp-defensivo.csv", ABP_DEF, "Hoja de ABP defensivo (lo que nos lanzan), toda la temporada. No tiene columnas de marcador."],
  ]) {
    try {
      guarda(nombre, que, await csv(url));
      frescura[nombre] = "hoja publicada (al momento)";
    } catch (e) {
      frescura[nombre] = `ERROR: ${e.message}`;
    }
  }

  guarda("frescura.json", "Cuándo se actualizó cada fuente (ISO) o el error al leerla. Lo usa el vigilante de datos.", frescura);

  fs.writeFileSync(path.join(carpeta, "indice.json"), JSON.stringify({ jornada: pedida, tipo, rival, ficheros: indice }, null, 1));
  console.log(`Paquete J${pedida} (${tipo} · ${rival}): ${indice.length} ficheros en ${path.relative(RAIZ, carpeta)}`);
  console.log(`RESUMEN: paquete J${pedida} ${tipo} con ${indice.length} ficheros`);
}

main().catch((e) => {
  console.error(e);
  console.log(`RESUMEN: ERROR ${e.message}`);
  process.exit(1);
});
