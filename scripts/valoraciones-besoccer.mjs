/**
 * Valoraciones con los datos del partido de BeSoccer (05/11/2026).
 *
 *   node scripts/valoraciones-besoccer.mjs              en seco: dice qué cambiaría
 *   node scripts/valoraciones-besoccer.mjs --escribir   lo escribe
 *
 * De cada partido oficial del Castilla ya jugado baja la ficha de BeSoccer y
 * rellena en Valoraciones (`match_ratings`, temporada 2026-2027) los minutos,
 * la titularidad, los goles, las asistencias y las tarjetas de cada jugador.
 * Si el partido no está en Valoraciones, lo añade. **Las notas no se tocan**
 * (nota, «sin valorar», áreas y comentario): el cuerpo técnico sólo tiene que
 * ponerlas.
 *
 * - El jugador se ata por el id de BeSoccer de su foto contra
 *   `castilla:besoccer` (scripts/castilla-besoccer.mjs). Quien no está atado
 *   no se toca y se lista al final.
 * - El partido se busca por fecha (±1 día) entre los guardados; si no hay, se
 *   crea como «manual» (`m-<fecha>-<rival>`), igual que los que se crean a mano.
 * - Minutos: titular hasta su cambio o su roja (90 si no); suplente desde que
 *   entra. El añadido no cuenta.
 * - La escritura es condicional (mismo `updated_at` que al leer), como
 *   app/api/ratings/_lib/cambiaTemporada.ts: si alguien guarda en medio, no
 *   se pisa; se vuelve a leer y a aplicar.
 *
 * Corre en la pasada nocturna (scripts/jornada-nocturna.cmd): el partido
 * queda listo la noche que se juega, en cuanto BeSoccer publica la ficha.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";

import { leeAlineacion, leeCambios, leeGoles, leePartidos, leeSuplentes, leeTarjetas } from "./rivals-informe.mjs";

const SLUG = "rm-castilla";
const TEMPORADA = "2026-2027";
const TABLA = "match_ratings";
const ESCRIBIR = process.argv.includes("--escribir");

/* La misma plantilla que lee scripts/castilla-besoccer.mjs. */
const PLANTILLA_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=205498392&single=true&output=csv";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function readEnv() {
  const env = { ...process.env };

  if (fs.existsSync(".env.local")) {
    for (const linea of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = linea.match(/^(\w+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  return env;
}

async function pagina(url) {
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const salida = execFileSync(
        "curl",
        ["-s", "--compressed", "--max-time", "45", "-H", `User-Agent: ${UA}`, "-H", "Accept: text/html,application/xhtml+xml", "-H", "Accept-Language: es-ES,es;q=0.9", "-w", "\n@@%{http_code}", url],
        { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
      );
      const corte = salida.lastIndexOf("\n@@");
      const estado = Number(salida.slice(corte + 3));
      const html = salida.slice(0, corte);

      if (estado === 200 && html && !/<title>Besoccer-50[0-9]/.test(html)) return html;
    } catch {
      /* se reintenta */
    }

    await espera(2500 * intento);
  }

  return null;
}

const minuto = (valor) => Math.min(90, Number(String(valor ?? "").split("+")[0].replace(/\D/g, "")) || 0);

const clave = (nombre) =>
  String(nombre ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slug = (texto) => clave(texto).replace(/ /g, "-");

const idDeFoto = (foto) => String(foto ?? "").match(/players\/medium\/(\d+)\.jpg/)?.[1] ?? "";

/** El jugador del partido que lleva ese nombre en un evento («A. Carvajal»). */
function buscaEnPartido(nombre, gente) {
  const k = clave(nombre);
  if (!k) return null;

  const exacto = gente.find((g) => clave(g.nombre) === k);
  if (exacto) return exacto;

  const ultimo = k.split(" ").pop();
  const porApellido = gente.filter((g) => clave(g.nombre).split(" ").pop() === ultimo);

  return porApellido.length === 1 ? porApellido[0] : null;
}

/** Minutos, titularidad, goles, asistencias y tarjetas de nuestro lado de una ficha. */
function datosDelPartido(alineaciones, eventos, visitante) {
  const once = leeAlineacion(alineaciones, visitante)?.jugadores ?? [];
  const banquillo = leeSuplentes(alineaciones, visitante);

  if (once.length < 11) return null;

  const cambios = eventos ? leeCambios(eventos, visitante) : [];
  const tarjetas = eventos ? leeTarjetas(eventos, visitante) : [];
  const goles = eventos ? leeGoles(eventos, visitante) : [];

  const gente = [
    ...once.map((j) => ({ nombre: j.nombre, besoccerId: idDeFoto(j.foto), titular: true, desde: 0 })),
    ...banquillo.map((j) => ({ nombre: j.nombre, besoccerId: idDeFoto(j.foto), titular: false, desde: j.entra ? minuto(j.entra) : null })),
  ];

  for (const g of gente) {
    g.hasta = g.titular || g.desde !== null ? 90 : 0;
    g.goles = 0;
    g.asistencias = 0;
    g.amarillas = 0;
    g.roja = false;
  }

  for (const c of cambios) {
    const sale = buscaEnPartido(c.sale, gente);
    const entra = buscaEnPartido(c.entra, gente);

    if (sale) sale.hasta = Math.min(sale.hasta, minuto(c.minuto));
    if (entra && entra.desde === null) {
      entra.desde = minuto(c.minuto);
      entra.hasta = 90;
    }
  }

  for (const t of tarjetas) {
    const quien = buscaEnPartido(t.jugador, gente);
    if (!quien) continue;

    if (t.tipo === "amarilla") quien.amarillas = Math.min(2, quien.amarillas + 1);
    else {
      /* «Segunda amarilla» llega como roja: son dos amarillas y expulsión. */
      if (quien.amarillas === 1) quien.amarillas = 2;
      quien.roja = true;
      quien.hasta = Math.min(quien.hasta, minuto(t.minuto));
    }
  }

  for (const gol of goles) {
    if (!gol.propio || gol.tipo === "propia") continue;

    const autor = buscaEnPartido(gol.jugador, gente);
    if (autor) autor.goles += 1;

    const pase = gol.asistente ? buscaEnPartido(gol.asistente, gente) : null;
    if (pase) pase.asistencias += 1;
  }

  return gente.map((g) => ({
    ...g,
    minutos: g.desde === null ? 0 : Math.max(g.titular ? 0 : 1, g.hasta - g.desde),
  }));
}

async function main() {
  const env = readEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  /* Nuestra plantilla atada a BeSoccer. */
  const { data: cb } = await sb.from("app_documents").select("data").eq("key", "castilla:besoccer").maybeSingle();
  const porBesoccer = new Map();
  const atados = new Set();

  /*
  | El mapa trae cruces flojos repetidos (05/11/2026): Ginés y Álvaro González
  | «parecidos» a Leiva, Sergio Martínez a Mestre por el apodo. Si dos de los
  | nuestros comparten ficha, gana el cruce más seguro; el otro queda sin atar.
  */
  const FUERZA = { manual: 0, nombre: 1, apellido: 2, parecido: 3, apodo: 4 };
  const mejor = new Map();

  for (const [id, j] of Object.entries(cb?.data?.porJugador ?? {})) {
    if (!j?.besoccerId) continue;

    const k = String(j.besoccerId);
    const f = FUERZA[j.via] ?? 5;
    const hay = mejor.get(k);

    if (!hay || f < hay.f) mejor.set(k, { id, f });
  }

  for (const [k, { id }] of mejor) {
    porBesoccer.set(k, id);
    atados.add(id);
  }

  if (!porBesoccer.size) throw new Error("castilla:besoccer está vacío: corre antes scripts/castilla-besoccer.mjs");

  /* Los que BeSoccer pone y el mapa no ata («S. Martínez»): por inicial y apellido contra la hoja, sólo si es único. */
  const csv = await fetch(PLANTILLA_CSV, { cache: "no-store" }).then((r) => (r.ok ? r.text() : ""));
  const hoja = Papa.parse(csv, { header: true, skipEmptyLines: true }).data.filter((f) => f.ID_JUGADOR && f.ACTIVO === "TRUE");

  const yaPorNombre = new Map();

  const porNombre = (nombre) => {
    if (!yaPorNombre.has(nombre)) {
      const id = buscaEnHoja(nombre);
      yaPorNombre.set(nombre, id);
      /* Atado: si otro partido no lo trae, es que no jugó. */
      if (id) atados.add(id);
    }

    return yaPorNombre.get(nombre);
  };

  /* En la hoja con otro nombre: «Thiago» es «T. Pitarch» en BeSoccer. */
  const MANUAL = { "t pitarch": "JUG-51", "thiago pitarch": "JUG-51" };

  const buscaEnHoja = (nombre) => {
    if (MANUAL[clave(nombre)]) return MANUAL[clave(nombre)];

    const partes = clave(nombre).split(" ");
    const apellido = partes.pop();
    const inicial = partes[0]?.[0] ?? "";

    const candidatos = hoja.filter((f) => {
      if (atados.has(f.ID_JUGADOR)) return false;
      const suyo = clave(f.NOMBRE).split(" ");
      return suyo[suyo.length - 1] === apellido && (!inicial || suyo.length < 2 || suyo[0][0] === inicial);
    });

    return candidatos.length === 1 ? candidatos[0].ID_JUGADOR : null;
  };

  const calendario = await pagina(`https://es.besoccer.com/equipo/partidos/${SLUG}`);
  if (!calendario) throw new Error("BeSoccer no ha devuelto el calendario del Castilla");

  const jugados = leePartidos(calendario, SLUG).filter((p) => p.jugado && !/amistoso/i.test(p.competicion));

  console.log(`${jugados.length} partidos oficiales jugados en BeSoccer`);

  /* Se baja todo antes de leer la temporada: así la escritura va justo detrás de la lectura. */
  const fichas = [];

  for (const p of jugados) {
    const url = `https://es.besoccer.com/partido/${p.local.slug}/${p.visitante.slug}/${p.id}`;

    await espera(1200);
    const alineaciones = await pagina(`${url}/alineaciones`);
    await espera(1200);
    const eventos = await pagina(url);

    const datos = alineaciones ? datosDelPartido(alineaciones, eventos, !p.enCasa) : null;
    const rival = p.enCasa ? p.visitante.nombre : p.local.nombre;
    const fecha = String(p.fecha).slice(0, 10);

    if (!datos) {
      console.log(`  ${fecha} ${rival}: sin alineación publicada todavía`);
      continue;
    }

    fichas.push({ p, fecha, rival, datos, eventosOk: Boolean(eventos) });
  }

  const sinAtar = new Map();

  for (let intento = 1; intento <= 3; intento++) {
    const { data: fila, error } = await sb.from(TABLA).select("data, updated_at").eq("season", TEMPORADA).maybeSingle();
    if (error) throw new Error(error.message);
    if (!fila) throw new Error("No hay temporada guardada en match_ratings");

    const temporada = fila.data;
    const ahora = new Date().toISOString();
    let cambios = 0;

    for (const { p, fecha, rival, datos, eventosOk } of fichas) {
      const dia = (f) => new Date(`${f}T12:00:00Z`).getTime();
      const existente = Object.entries(temporada.matches).find(([, m]) => m.match?.date && Math.abs(dia(m.match.date) - dia(fecha)) <= 86400000);

      const gf = p.enCasa ? p.local.goles : p.visitante.goles;
      const ga = p.enCasa ? p.visitante.goles : p.local.goles;
      const result = `${p.local.goles}-${p.visitante.goles}`;

      let id;
      let registro;

      if (existente) {
        [id, registro] = existente;
        registro = { ...registro, players: { ...registro.players } };
        if (!registro.match.result) registro.match = { ...registro.match, result, gf, ga };
      } else {
        id = `m-${fecha}-${slug(rival)}`;
        registro = {
          match: { id, date: fecha, opponent: rival, competition: p.competicion || "Liga", isHome: p.enCasa, result, gf, ga, source: "manual" },
          players: {},
          updatedAt: ahora,
        };
        console.log(`  + partido nuevo: ${id}`);
      }

      const vistos = new Set();
      const resumen = [];

      for (const g of datos) {
        const jugadorId = porBesoccer.get(g.besoccerId) ?? porNombre(g.nombre);

        if (!jugadorId) {
          if (g.minutos > 0) sinAtar.set(g.nombre, (sinAtar.get(g.nombre) ?? 0) + 1);
          continue;
        }

        vistos.add(jugadorId);

        const antes = registro.players[jugadorId];
        const nuevo = {
          rating: 0,
          unrated: false,
          areas: {},
          note: "",
          ...antes,
          playerId: jugadorId,
          minutes: g.minutos,
          starter: g.titular,
          goals: g.goles,
          assists: g.asistencias,
          /* Sin la página de eventos no se sabe: se deja lo que hubiera. */
          yellow: eventosOk ? g.amarillas : (antes?.yellow ?? 0),
          red: eventosOk ? g.roja : Boolean(antes?.red),
        };

        if (!antes && nuevo.minutes === 0) continue;

        const cambiado = !antes || ["minutes", "starter", "goals", "assists", "yellow", "red"].some((k) => antes[k] !== nuevo[k]);

        if (cambiado) {
          registro.players[jugadorId] = { ...nuevo, updatedAt: ahora };
          cambios++;
          resumen.push(`${g.nombre} ${g.minutos}'${g.titular ? " T" : ""}${g.goles ? ` ${g.goles}G` : ""}${g.asistencias ? ` ${g.asistencias}A` : ""}${g.amarillas ? ` ${g.amarillas}🟨` : ""}${g.roja ? " 🟥" : ""}`);
        }
      }

      /* Atados que BeSoccer no pone en el partido: no jugaron. La nota se queda. */
      for (const [jugadorId, antes] of Object.entries(registro.players)) {
        if (vistos.has(jugadorId) || !atados.has(jugadorId)) continue;
        if (!antes.minutes && !antes.starter && !antes.goals && !antes.assists && !antes.yellow && !antes.red) continue;

        registro.players[jugadorId] = { ...antes, minutes: 0, starter: false, goals: 0, assists: 0, yellow: 0, red: false, updatedAt: ahora };
        cambios++;
        resumen.push(`${jugadorId} no jugó`);
      }

      if (resumen.length) {
        registro.updatedAt = ahora;
        temporada.matches[id] = registro;
      }

      if (intento === 1) console.log(`  ${fecha} ${rival} (${result})${eventosOk ? "" : " [sin eventos: tarjetas sin tocar]"}: ${resumen.length ? resumen.join(" · ") : "ya estaba al día"}`);
    }

    if (intento === 1 && sinAtar.size) {
      console.log(`\nSin atar a nuestra plantilla (no se tocan; añádelos al mapa MANUAL de castilla-besoccer.mjs): ${[...sinAtar.keys()].join(", ")}`);
    }

    if (!cambios) {
      console.log("\nNada que cambiar.");
      return;
    }

    if (!ESCRIBIR) {
      console.log(`\nEn seco: ${cambios} cambios. Para escribirlos, --escribir.`);
      return;
    }

    temporada.updatedAt = ahora;

    const { data: escritas, error: fallo } = await sb
      .from(TABLA)
      .update({ data: temporada, updated_at: ahora })
      .eq("season", TEMPORADA)
      .eq("updated_at", fila.updated_at)
      .select("season");

    if (fallo) throw new Error(fallo.message);

    if (escritas?.length === 1) {
      console.log(`\nEscrito: ${cambios} cambios en Valoraciones.`);
      return;
    }

    console.log("Alguien ha guardado en medio: se vuelve a leer y a aplicar.");
  }

  throw new Error("Tres choques seguidos con otro guardado: no se ha escrito nada");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
