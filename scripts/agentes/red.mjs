/*
|--------------------------------------------------------------------------
| LA RED DE AGENTES DEL CASTILLA (19/10/2026)
|--------------------------------------------------------------------------
|
| El director de orquesta. NO es un agente: es código, para que el orden, los
| reintentos y las paradas sean siempre los mismos. Lanza los agentes de
| `.claude/agents/` con Claude Code sin ventana (`claude -p --agent …`), cada
| uno con su esquema de salida (`agentes/esquemas/`) y las reglas comunes
| (`agentes/reglas.md`). Ver agentes/README.md.
|
|   node scripts/agentes/red.mjs semana            post de la última jornada + previa de la siguiente
|   node scripts/agentes/red.mjs post   [--jornada N]
|   node scripts/agentes/red.mjs previa [--jornada N]
|   node scripts/agentes/red.mjs mantenimiento     el mantenedor lee los registros del vigía
|   node scripts/agentes/red.mjs revision --desde <commit>   el revisor mira los cambios
|   … --forzar   rehace aunque las entradas no hayan cambiado
|
| Nada sale de aquí: deja los JSON y un `informe.md` en `.cache/agentes/jNN/`.
| Mandar es siempre cosa del analista humano.
*/

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE = path.join(RAIZ, ".cache", "agentes");
const REGLAS = fs.readFileSync(path.join(RAIZ, "agentes", "reglas.md"), "utf8");
const esquema = (n) => fs.readFileSync(path.join(RAIZ, "agentes", "esquemas", `${n}.json`), "utf8");

const bandera = (n) => process.argv.includes(`--${n}`);
const valor = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const FORZAR = bandera("forzar");
const PLAZO_MS = 25 * 60_000;
const PARALELO = 3;

/* El mismo Claude Code que usa el análisis del partido en el ordenador del club. */
const CLAUDE = [
  path.join(process.env.USERPROFILE ?? "", ".local", "bin", "claude.exe"),
  path.join(process.env.APPDATA ?? "", "npm", "claude.cmd"),
].find((p) => fs.existsSync(p)) ?? "claude";

const registro = { inicio: new Date().toISOString(), pasos: [] };
const log = (...a) => console.log(new Date().toLocaleTimeString("es-ES"), ...a);

/* ------------------------------------------------------------------ */
/*  UN AGENTE                                                          */
/* ------------------------------------------------------------------ */

const huella = (...partes) => crypto.createHash("sha1").update(partes.join("|#|")).digest("hex").slice(0, 12);
const leeAgente = (n) => fs.readFileSync(path.join(RAIZ, ".claude", "agents", `${n}.md`), "utf8");

/**
 * El agente se lee de su fichero (`.claude/agents/<nombre>.md`): modelo,
 * herramientas e instrucciones. NO se lanza con `--agent`: con esa opción
 * Claude Code no aplica `--json-schema` (comprobado el 19/10/2026: con
 * agente devuelve texto libre; sin él, el JSON exacto). Así el mismo fichero
 * sirve de subagente en una sesión normal y aquí con salida garantizada.
 */
function defineAgente(nombre) {
  const texto = leeAgente(nombre).replace(/\r\n/g, "\n");
  const m = texto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${nombre}.md sin cabecera`);
  const campo = (k) => m[1].match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1].trim() ?? "";
  const permisos = campo("tools").split(/,\s*/).filter(Boolean);

  return {
    modelo: campo("model") || "sonnet",
    permisos,
    herramientas: [...new Set(permisos.map((t) => t.replace(/\(.*$/, "")))],
    instrucciones: m[2].trim(),
  };
}

/**
 * Lanza un agente y devuelve su salida estructurada. Si las entradas (el
 * agente, las reglas, el encargo y los ficheros que lee) no han cambiado
 * desde la última vez, devuelve la de entonces sin gastar nada.
 */
async function agente({ nombre, encargo, salida, esquemaDe, entradas = [] }) {
  const def = defineAgente(nombre);
  const contenido = entradas.map((f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "")).join("|#|");
  const h = huella(leeAgente(nombre), REGLAS, encargo, contenido, esquema(esquemaDe));

  if (!FORZAR && fs.existsSync(salida)) {
    const previa = JSON.parse(fs.readFileSync(salida, "utf8"));

    if (previa.huella === h) {
      log(`· ${nombre}: sin cambios, se reutiliza`);
      registro.pasos.push({ agente: nombre, salida: path.relative(RAIZ, salida), reutilizado: true });
      return previa.resultado;
    }
  }

  log(`▶ ${nombre}…`);
  const t0 = Date.now();
  const args = [
    "-p", encargo,
    "--model", def.modelo,
    "--append-system-prompt", `${def.instrucciones}\n\n${REGLAS}`,
    "--json-schema", esquema(esquemaDe),
    "--output-format", "json",
    "--no-session-persistence",
    /* Sin los conectores ni las habilidades (19/10/2026): sus definiciones
       eran 628.000 tokens por llamada y una pregunta de Haiku costaba 0,63 $;
       sin ellas, 0,003 $. Los agentes sólo leen ficheros del paquete. */
    "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
    "--disable-slash-commands",
    "--permission-mode", "dontAsk",
    "--tools", ...def.herramientas,
    "--allowedTools", ...def.permisos,
  ];

  /*
  | Con plazo por modelo y UN reintento (19/10/2026): el redactor se quedó
  | 94 minutos colgado en la primera pasada (solo, tarda 13 s), y en Windows
  | `kill()` no mataba a los hijos de claude.exe, así que el plazo no servía:
  | ahora se mata el árbol entero con taskkill.
  */
  const plazo = def.modelo === "opus" ? PLAZO_MS : 10 * 60_000;
  const lanza = () => new Promise((resuelve) => {
    const hijo = spawn(CLAUDE, args, { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"], shell: CLAUDE.endsWith(".cmd"), windowsHide: true });
    let out = "";
    let err = "";
    const reloj = setTimeout(() => {
      err += `\n(plazo de ${plazo / 60_000} min agotado)`;
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(hijo.pid), "/T", "/F"], { windowsHide: true });
      else hijo.kill("SIGKILL");
    }, plazo);

    hijo.stdout.on("data", (d) => (out += d));
    hijo.stderr.on("data", (d) => (err += d));
    hijo.on("close", (codigo) => {
      clearTimeout(reloj);
      resuelve({ codigo, out, err });
    });
  });

  let r = await lanza();

  if (!/"structured_output"/.test(r.out)) {
    log(`  ${nombre}: sin salida válida (${(r.err || r.out).trim().split("\n").pop()?.slice(0, 120) ?? ""}); un reintento`);
    r = await lanza();
  }

  let json = null;

  try {
    json = JSON.parse(r.out);
  } catch {
    /* abajo */
  }

  const resultado = json?.structured_output ?? (() => {
    try {
      return JSON.parse(String(json?.result ?? "").replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      return null;
    }
  })();

  const paso = {
    agente: nombre,
    segundos: Math.round((Date.now() - t0) / 1000),
    coste_usd: json?.total_cost_usd ?? null,
    turnos: json?.num_turns ?? null,
    ok: Boolean(resultado),
    salida: path.relative(RAIZ, salida),
  };

  registro.pasos.push(paso);

  if (!resultado) {
    paso.error = (json?.result || r.err || r.out).toString().slice(0, 400);
    log(`✗ ${nombre} (${paso.segundos} s): ${paso.error.split("\n")[0]}`);
    return null;
  }

  fs.writeFileSync(salida, JSON.stringify({ huella: h, resultado, coste_usd: paso.coste_usd, segundos: paso.segundos }, null, 1));
  log(`✓ ${nombre} (${paso.segundos} s${paso.coste_usd ? ` · ${paso.coste_usd.toFixed(2)} $` : ""})`);

  return resultado;
}

/** Hasta `n` a la vez. */
async function enParalelo(trabajos, n = PARALELO) {
  const res = new Array(trabajos.length);
  let i = 0;

  await Promise.all(Array.from({ length: Math.min(n, trabajos.length) }, async () => {
    while (i < trabajos.length) {
      const k = i++;
      res[k] = await trabajos[k]();
    }
  }));

  return res;
}

/* ------------------------------------------------------------------ */
/*  BORRADOR → VERIFICADO                                              */
/* ------------------------------------------------------------------ */

const ficherosDe = (carpeta) => fs.readdirSync(carpeta).filter((f) => /\.(json|csv)$/.test(f) && !/^(borrador|verificacion|final|mensaje|vigilancia|red|reparos|frescura)/.test(f)).map((f) => path.join(carpeta, f));

/**
 * Un analista escribe, el verificador coteja y, si no aprueba, el analista
 * corrige UNA vez con las revisiones delante. Si sigue sin aprobar, se para:
 * sale lo verificado (con las correcciones aplicadas y sin lo quitado) y las
 * discrepancias van a las dudas para el humano.
 */
async function escribeYVerifica({ carpeta, analista, tipo }) {
  const rel = path.relative(RAIZ, carpeta).replace(/\\/g, "/");
  const entradas = ficherosDe(carpeta);
  const fBorrador = path.join(carpeta, `borrador-${analista}.json`);
  const fVerif = path.join(carpeta, `verificacion-${analista}.json`);

  let borrador = await agente({
    nombre: analista, salida: fBorrador, esquemaDe: "borrador", entradas,
    encargo: `Informe ${tipo.toUpperCase()}. El paquete de la jornada está en la carpeta ${rel}/ (empieza por ${rel}/indice.json). Escribe tu borrador.`,
  });

  if (!borrador) return null;

  const verifica = (fuente) => agente({
    nombre: "verificador", salida: fVerif, esquemaDe: "verificacion", entradas: [...entradas, fuente],
    encargo: `Verifica el borrador ${path.relative(RAIZ, fuente).replace(/\\/g, "/")} contra el paquete de ${rel}/ (índice en ${rel}/indice.json).`,
  });

  let verificacion = await verifica(fBorrador);

  if (verificacion && !verificacion.aprobado) {
    log(`  ${analista}: el verificador no aprueba (${verificacion.revisiones.filter((r) => r.veredicto !== "ok").length} reparos): una corrección`);

    const fRevs = path.join(carpeta, `reparos-${analista}.json`);
    fs.writeFileSync(fRevs, JSON.stringify(verificacion.revisiones.filter((r) => r.veredicto !== "ok"), null, 1));

    const corregido = await agente({
      nombre: analista, salida: path.join(carpeta, `borrador-${analista}-2.json`), esquemaDe: "borrador", entradas: [...entradas, fBorrador, fRevs],
      encargo: `Informe ${tipo.toUpperCase()}. Paquete en ${rel}/. Tu borrador anterior (${path.relative(RAIZ, fBorrador).replace(/\\/g, "/")}) tiene reparos del verificador en ${path.relative(RAIZ, fRevs).replace(/\\/g, "/")}. Corrígelos todos (quita lo que dice quitar) y devuelve el borrador entero corregido.`,
    });

    if (corregido) {
      borrador = corregido;
      fs.copyFileSync(path.join(carpeta, `borrador-${analista}-2.json`), fBorrador);
      verificacion = await verifica(fBorrador);
    }
  }

  return { analista, borrador, verificacion };
}

/** Aplica el veredicto: las correcciones entran, lo quitado sale, y las secciones vacías desaparecen. */
function aplica({ borrador, verificacion }) {
  const porTexto = new Map((verificacion?.revisiones ?? []).map((r) => [r.texto.trim(), r]));
  const secciones = borrador.secciones
    .map((s) => ({
      ...s,
      afirmaciones: s.afirmaciones.flatMap((a) => {
        const r = porTexto.get(a.texto.trim());
        if (r?.veredicto === "quitar") return [];
        if (r?.veredicto === "corregir" && r.texto_corregido) return [{ ...a, texto: r.texto_corregido }];
        return [a];
      }),
    }))
    .filter((s) => s.afirmaciones.length);
  const pendientes = (verificacion?.revisiones ?? []).filter((r) => r.veredicto !== "ok").map((r) => `${r.veredicto}: «${r.texto.slice(0, 90)}» — ${r.motivo}`);

  return { ...borrador, secciones, dudas: [...borrador.dudas, ...(verificacion?.aprobado ? [] : pendientes)] };
}

const aMarkdown = (titulo, informe, mensaje, vigilancia) => [
  `# ${titulo}`,
  "",
  `**${informe.titular}**`,
  "",
  ...informe.secciones.flatMap((s) => [`## ${s.titulo}`, "", ...s.afirmaciones.map((a) => `- ${a.texto}  \n  <sub>${a.fuente}</sub>`), ""]),
  informe.claves.length ? "## Claves" : "",
  ...informe.claves.map((c) => `- ${c}`),
  "",
  mensaje ? `## Mensaje para los jugadores\n\n${mensaje.mensaje}\n` : "",
  informe.dudas.length ? `## Para el analista (no va en el informe)\n\n${informe.dudas.map((d) => `- ${d}`).join("\n")}\n` : "",
  vigilancia?.huecos?.length ? `## Datos\n\n${vigilancia.huecos.map((h) => `- [${h.gravedad}] ${h.fuente}: ${h.problema} → ${h.como_arreglar}`).join("\n")}\n` : "",
].filter((l) => l !== null).join("\n");

/* ------------------------------------------------------------------ */
/*  LOS FLUJOS                                                         */
/* ------------------------------------------------------------------ */

function paquete(jornada) {
  const r = spawnSync(process.execPath, [path.join(RAIZ, "scripts", "agentes", "paquete.mjs"), ...(jornada ? ["--jornada", String(jornada)] : [])], { cwd: RAIZ, encoding: "utf8", windowsHide: true });
  if (r.status !== 0) throw new Error(`paquete: ${(r.stdout + r.stderr).trim().split("\n").pop()}`);
  const m = r.stdout.match(/Paquete J(\d+) \((post|previa)/);
  return { jornada: Number(m[1]), tipo: m[2], carpeta: path.join(CACHE, `j${m[1].padStart(2, "0")}`) };
}

async function informeDe(jornada) {
  const p = paquete(jornada);
  const rel = path.relative(RAIZ, p.carpeta).replace(/\\/g, "/");
  log(`— J${p.jornada} · ${p.tipo} —`);

  const vigilancia = await agente({
    nombre: "vigilante-datos", salida: path.join(p.carpeta, "vigilancia.json"), esquemaDe: "vigilancia",
    entradas: [path.join(p.carpeta, "frescura.json"), path.join(p.carpeta, "indice.json"), path.join(p.carpeta, "partido.json")],
    encargo: `Revisa el paquete de ${rel}/ para el informe ${p.tipo.toUpperCase()}.`,
  });

  if (vigilancia && !vigilancia.listo[p.tipo]) log(`  ⚠ el vigilante dice que faltan datos que bloquean (${vigilancia.huecos.filter((h) => h.gravedad === "bloquea").length}): se sigue, y queda escrito`);

  const analistas = p.tipo === "post" ? ["analista-partido", "analista-abp"] : ["analista-rival", "analista-abp"];
  const partes = (await enParalelo(analistas.map((a) => () => escribeYVerifica({ carpeta: p.carpeta, analista: a, tipo: p.tipo })))).filter(Boolean);

  if (!partes.length) throw new Error("Ningún analista ha devuelto borrador");

  /* Se junta: el principal manda en titular y claves; ABP aporta sus secciones. */
  const hechas = partes.map(aplica);
  const principal = hechas[0];
  const final = {
    titular: principal.titular,
    secciones: hechas.flatMap((h) => h.secciones),
    claves: [...principal.claves, ...hechas.slice(1).flatMap((h) => h.claves)].slice(0, 5),
    dudas: hechas.flatMap((h) => h.dudas),
    aprobado: partes.every((x) => x.verificacion?.aprobado),
  };
  const fFinal = path.join(p.carpeta, `final-${p.tipo}.json`);
  fs.writeFileSync(fFinal, JSON.stringify(final, null, 1));

  const mensaje = await agente({
    nombre: "redactor-jugadores", salida: path.join(p.carpeta, `mensaje-${p.tipo}.json`), esquemaDe: "mensaje", entradas: [fFinal],
    encargo: `Mensaje ${p.tipo.toUpperCase()} para el grupo de jugadores a partir del informe verificado ${path.relative(RAIZ, fFinal).replace(/\\/g, "/")}.`,
  });

  const md = aMarkdown(`J${p.jornada} · ${p.tipo === "post" ? "Post" : "Previa"} — borrador de la red de agentes`, final, mensaje, vigilancia);
  fs.writeFileSync(path.join(p.carpeta, `informe-${p.tipo}.md`), md);
  log(`  → ${path.relative(RAIZ, path.join(p.carpeta, `informe-${p.tipo}.md`))} (${final.aprobado ? "verificado" : "con reparos para el humano"})`);

  const { rival } = JSON.parse(fs.readFileSync(path.join(p.carpeta, "partido.json"), "utf8"));

  return { jornada: p.jornada, tipo: p.tipo, rival, md, aprobado: final.aprobado, secciones: final.secciones.length, afirmaciones: final.secciones.reduce((s, x) => s + x.afirmaciones.length, 0) };
}

async function main() {
  const orden = process.argv[2] ?? "semana";
  const jornada = valor("jornada") ? Number(valor("jornada")) : undefined;
  fs.mkdirSync(CACHE, { recursive: true });
  const hechos = [];

  if (orden === "semana" || orden === "post") hechos.push(await informeDe(orden === "post" ? jornada : undefined));

  if (orden === "semana" || orden === "previa") {
    const ultima = jornada ?? hechos[0]?.jornada ?? paquete().jornada;
    hechos.push(await informeDe(orden === "previa" && jornada ? jornada : ultima + 1));
  }

  if (orden === "mantenimiento") {
    const d = await agente({
      nombre: "mantenedor", salida: path.join(CACHE, "diagnostico.json"), esquemaDe: "diagnostico",
      entradas: [path.join(RAIZ, ".cache", "vigia", "vigia.log")],
      encargo: "Diagnostica el estado del ordenador del club con .cache/vigia/vigia.log y los registros de .cache/vigia/ de las últimas 48 horas.",
    });
    hechos.push({ mantenimiento: d?.estado ?? "sin respuesta", problemas: d?.problemas?.length ?? 0, diagnostico: d });
  }

  if (orden === "revision") {
    const desde = valor("desde") ?? "HEAD~5";
    const d = await agente({
      nombre: "revisor-cambios", salida: path.join(CACHE, "revision.json"), esquemaDe: "revision",
      encargo: `Revisa los cambios de ${desde}..HEAD (git diff ${desde}..HEAD).`,
    });
    hechos.push({ revision: d?.riesgo ?? "sin respuesta", hallazgos: d?.hallazgos?.length ?? 0 });
  }

  /*
  | EL EQUIPO DE EXPERTOS (20/10/2026, lo pidió el usuario): fútbol,
  | análisis, marketing, guion, edición y producción de vídeo juzgan los
  | informes de partido y de ABP (previa y post), el vídeo y el análisis de
  | entrenamiento, y cada uno devuelve sus mejoras priorizadas (esquema
  | «critica»). Sólo opinan: los cambios se programan después.
  | El material se prepara antes en .cache/expertos/ (capturas, textos y PDF
  | de los informes tal como se ven, y la hoja de escenas del vídeo).
  */
  if (orden === "expertos") {
    const comun = [
      "Material en .cache/expertos/:",
      "- informes/: los cuatro informes TAL COMO LOS VE EL CUERPO TÉCNICO hoy (sin enviar): partido-previa-resumen.txt y partido-previa-informe-completo.txt (previa J9 Algeciras), partido-post-resumen.txt y partido-post-informe-completo.txt (post J8 Antequera 3-2), abp-previa.txt y abp-post.txt; sus capturas (*.jpg) y los PDF que saca cada diálogo en informes/<informe>-pdf/.",
      "- muestra-video/hoja.png: todas las escenas del vídeo de informe (datos inventados).",
      "Código: components/informe-partido/ (diálogo, Diapositivas.tsx), lib/informe-partido/ (modelo, textos), components/abp/InformeMicroDialog.tsx y lib/abp/informe-micro.ts (ABP), lib/video-informe/ (guion.ts, dibujo.ts, monta.ts), app/obras/entrenamiento/ y lib/entreno/ (análisis de entrenamiento: objetivos individuales medidos con IA sobre el vídeo de la sesión, con clips de lo correcto y lo mejorable).",
      "Contexto: AGENTS.md, agentes/README.md. Reglas del usuario: lo que no tiene dato no se nombra en un informe; español de España; todo gratis (sin servicios de pago).",
      "Da como mucho 12 mejoras, las de más impacto primero, concretas y programables en esta plataforma.",
    ].join("\n");
    const foco = {
      "experto-futbol": "¿Sirven los cuatro informes y el análisis de entrenamiento para preparar y corregir de verdad? Qué falta, qué sobra, qué orden, qué conclusiones accionables.",
      "experto-analisis": "Rigor y lectura de cifras, comparaciones y gráficos de los cuatro informes y del análisis de entrenamiento; métricas que faltan y ya hay en la plataforma.",
      "experto-marketing": "Primer vistazo, asuntos, titulares, WhatsApp, portada del PDF, póster del vídeo y longitud de los cuatro informes; reescribe lo mejorable.",
      guionista: "El relato de cada informe (arco, gancho, transiciones, cierre) y los textos de pantalla del vídeo (lib/video-informe/guion.ts); reescribe titulares y textos.",
      "editor-video": "El montaje del vídeo de informe: ritmo, duración por escena (SEGUNDOS en dibujo.ts), estructura, rótulos, transiciones y sonido; mira hoja.png y el código.",
      "productor-video": "Qué piezas de vídeo hacer cada semana (cuerpo técnico, jugadores, ABP), en qué formato y canal, y cómo producirlas sin coste y sin trabajo extra para el analista.",
    };
    const carpeta = path.join(RAIZ, ".cache", "expertos");
    const res = await enParalelo(
      Object.entries(foco).map(([nombre, f]) => () =>
        agente({ nombre, salida: path.join(carpeta, `critica-${nombre}.json`), esquemaDe: "critica", entradas: [], encargo: `${comun}\n\nTU FOCO: ${f}` }),
      ),
    );
    hechos.push({ expertos: res.filter(Boolean).length });
  }

  registro.fin = new Date().toISOString();
  registro.hechos = hechos;
  registro.coste_usd = +registro.pasos.reduce((s, p) => s + (p.coste_usd ?? 0), 0).toFixed(2);
  fs.writeFileSync(path.join(CACHE, "red.json"), JSON.stringify(registro, null, 1));

  const nuevos = registro.pasos.filter((p) => !p.reutilizado).length;
  const resumen = hechos
    .map((h) =>
      h.tipo
        ? `J${h.jornada} ${h.tipo} ${h.aprobado ? "verificado" : "con reparos"} (${h.afirmaciones} afirmaciones)`
        : h.mantenimiento
          ? `mantenimiento ${h.mantenimiento} (${h.problemas} problemas)`
          : h.expertos !== undefined
            ? `expertos ${h.expertos}/6`
            : `revisión ${h.revision} (${h.hallazgos} hallazgos)`,
    )
    .join(" · ");

  /*
  | El aviso por correo (19/10/2026, para el vigía): sólo si esta pasada ha
  | hecho algo NUEVO —si todo se reutilizó, no hay nada que contar— y, en el
  | mantenimiento, sólo si algo falla. Sale de la cuenta del club
  | (scripts/aviso-correo.mjs) y es para el analista: el informe se revisa y
  | se manda desde la plataforma, como siempre.
  */
  const para = valor("avisar");

  if (para && nuevos) {
    const cuerpo = [];
    let asunto = "";

    for (const h of hechos) {
      if (h.tipo) {
        asunto ||= `Borrador ${h.tipo === "post" ? "del post" : "de la previa"} · J${h.jornada} ${h.rival}${h.aprobado ? "" : " (con reparos)"}`;
        cuerpo.push(h.md.replace(/\s*<sub>[^<]*<\/sub>/g, "").replace(/\*\*/g, ""));
      } else if (h.mantenimiento && h.mantenimiento !== "ok" && h.diagnostico) {
        asunto ||= `El ordenador del club: ${h.problemas} ${h.problemas === 1 ? "cosa que mirar" : "cosas que mirar"}`;
        for (const p of h.diagnostico.problemas) cuerpo.push(`- ${p.donde}: ${p.sintoma}\n  Qué hacer: ${p.arreglo_propuesto}${p.requiere_humano ? " (te toca a ti)" : ""}`);
      }
    }

    if (asunto) {
      cuerpo.push("", `(La red de agentes, desde el ordenador del club: ${nuevos} pasos nuevos, ${registro.coste_usd} $. Los ficheros están en .cache/agentes/. Nada de esto se ha mandado a nadie más.)`);

      const r = spawnSync(process.execPath, [path.join(RAIZ, "scripts", "aviso-correo.mjs"), para, asunto, cuerpo.join("\n")], { cwd: RAIZ, encoding: "utf8", windowsHide: true });

      log(r.status === 0 ? `  ✉ aviso a ${para}` : `  ✉ el aviso no ha salido: ${(r.stdout + r.stderr).trim().split("\n").pop()}`);
    }
  }

  console.log(`RESUMEN: ${resumen || "nada"} · ${nuevos ? `${nuevos} pasos nuevos` : "sin cambios"} · ${registro.coste_usd} $`);
}

main().catch((e) => {
  console.error(e);
  console.log(`RESUMEN: ERROR ${e.message}`);
  process.exit(1);
});
