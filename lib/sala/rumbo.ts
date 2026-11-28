/*
|--------------------------------------------------------------------------
| HACIA DÓNDE VA EL PARTIDO Y EL PLAN EN EL CAMPO (27/11/2026)
|--------------------------------------------------------------------------
|
| El analista: «el fin es tener claridad y objetividad en lo que está
| sucediendo en directo y anticipar hacia dónde va el partido, incluso si
| suceden cambios, hacia dónde probablemente irá con esos cambios»; y «en la
| sala debe estar la información bien cruzada con el plan de partido si es un
| partido del Castilla».
|
| - rumbo(): los últimos 15′ contra lo de antes y, si ha habido cambios, antes
|   y después del último (con 8′ o más desde él). Cifras oficiales de Opta por
|   tramos de 5′ (xG, toques en el área, remates, posesión); sin tramos, el
|   evento a evento. La proyección hasta el final: el ritmo reciente (60 %) con
|   el del partido (40 %); probabilidad de marcar al menos uno = 1 − e^(−xG).
| - planEnElCampo(): cada línea del plan (claves, con y sin balón, ABP,
|   fortalezas y debilidades del rival) se lee por su tema (presión, posesión,
|   centros…) y se le pone al lado la cifra de Opta que la mide, con su media.
|   No se juzga la intención de quien escribió el plan: en lo nuestro se dice
|   «más / menos que nuestra media»; en lo del rival, si su fortaleza aparece
|   (malo) o se apaga (bueno), y si su debilidad se está atacando.
*/

import { DURACION, cifrasEntre, oficialEntre, posesion, type Lado, type Partido } from "./modelo";

const coma = (v: number, d = 1) => v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
const nombreDe = (p: Partido, l: Lado) => {
  const n = l === "L" ? p.local.nombre : p.visitante.nombre;
  return n === "Real Madrid Castilla" ? "Castilla" : n.replace(/^(Real|Club|CD|UD|SD|CF|FC|RCD|RC|AD|CE|SCR|Atlético)\s+(?=\S{4,})/i, "");
};

/** Por 90′ (xg, toques, tiros) y, al lado, lo contado de verdad en la ventana (n), para dar la base (28/11/2026). */
type Ritmo = { xg: number; toques: number; tiros: number; pos: number | null; n: { xg: number; toques: number; tiros: number } };

/** Por 90 minutos, en una ventana: oficial (tramos de Opta) si los hay; si no, el evento a evento. */
function ritmoEntre(p: Partido, desde: number, hasta: number): { L: Ritmo; V: Ritmo; min: number } | null {
  const min = hasta - desde;
  if (min < 4) return null;
  const por90 = (x: number) => (x * 90) / min;
  if (p.tramos.length) {
    const o = oficialEntre(p, desde, hasta);
    if (o.tramos || o.entero) {
      const r = (l: Lado): Ritmo => {
        const m = l === "L" ? o.L : o.V;
        const n = { xg: m.ExpG ?? 0, toques: m.TouchOpBox ?? 0, tiros: m.ShtIncBl ?? 0 };
        return { xg: por90(n.xg), toques: por90(n.toques), tiros: por90(n.tiros), pos: m["Poss%"] ?? null, n };
      };
      return { L: r("L"), V: r("V"), min };
    }
  }
  const c = cifrasEntre(p, desde, hasta);
  const pos = posesion(c);
  const r = (l: Lado): Ritmo => {
    const y = l === "L" ? c.L : c.V;
    const n = { xg: y.xg, toques: y.toquesArea, tiros: y.tiros };
    return { xg: por90(n.xg), toques: por90(n.toques), tiros: por90(n.tiros), pos: l === "L" ? pos.L : pos.V, n };
  };
  return { L: r("L"), V: r("V"), min };
}

export type Rumbo = {
  /** Frases: qué está cambiando ahora. */
  ahora: string[];
  /** Antes y después del último cambio (si lo hay y ya da para leerlo). */
  cambio: { titulo: string; frases: string[] } | null;
  /** Hasta el final, si sigue así. */
  proyeccion: { L: { xg: number; marca: number }; V: { xg: number; marca: number }; restante: number } | null;
};

export function rumbo(p: Partido, t: number): Rumbo {
  const ahora: string[] = [];
  const reciente = ritmoEntre(p, Math.max(0, t - 15), t);
  const antes = t >= 30 ? ritmoEntre(p, 0, t - 15) : null;
  const nom = (l: Lado) => nombreDe(p, l);

  if (reciente && antes) {
    for (const l of ["L", "V"] as Lado[]) {
      const a = antes[l], r = reciente[l];
      if (r.xg >= a.xg + 0.5 && r.xg >= a.xg * 1.5) ahora.push(`${nom(l)} ha subido: ${coma(r.xg, 1)} xG por 90′ en los últimos 15′, contra ${coma(a.xg, 1)} antes.`);
      else if (a.xg >= 0.8 && r.xg <= a.xg * 0.4) ahora.push(`${nom(l)} se ha apagado: ${coma(r.xg, 1)} xG por 90′ en los últimos 15′, contra ${coma(a.xg, 1)} antes.`);
      if (r.toques >= a.toques * 1.6 && r.toques - a.toques >= 8) ahora.push(`${nom(l)} pisa mucho más el área: ${Math.round(r.toques)} toques por 90′ ahora, ${Math.round(a.toques)} antes.`);
    }
    if (reciente.L.pos != null && antes.L.pos != null) {
      const d = reciente.L.pos - antes.L.pos;
      if (Math.abs(d) >= 0.1) {
        const quien: Lado = d > 0 ? "L" : "V";
        ahora.push(`La pelota se ha movido hacia ${nom(quien)}: ${Math.round((quien === "L" ? reciente.L.pos : 1 - reciente.L.pos) * 100)} % de posesión en los últimos 15′ (${Math.round((quien === "L" ? antes.L.pos : 1 - antes.L.pos) * 100)} % antes).`);
      }
    }
    if (!ahora.length) ahora.push(`Sin cambios de tendencia: los últimos 15′ van al ritmo del resto (${nom("L")} ${coma(reciente.L.xg, 1)} y ${nom("V")} ${coma(reciente.V.xg, 1)} xG por 90′).`);
  }

  /* El último cambio con al menos 8′ jugados después (y 10′ antes para comparar). */
  let cambio: Rumbo["cambio"] = null;
  const cambios = p.marcas.filter((m) => m.tipo === "cambio" && m.min <= t - 8 && m.min >= 10);
  const u = cambios.at(-1);
  if (u) {
    /* Los cambios del mismo minuto (o casi) van juntos. */
    const juntos = cambios.filter((m) => Math.abs(m.min - u.min) <= 2);
    const desde = Math.min(...juntos.map((m) => m.min));
    const pre = ritmoEntre(p, Math.max(0, desde - 20), desde);
    const post = ritmoEntre(p, desde, t);
    if (pre && post) {
      const quienes = juntos.map((m) => `${p.jugadores.get(m.entra ?? "")?.corto ?? "?"} (${nom(m.lado)})`).join(", ");
      const frases: string[] = [];
      /*
       * Con menos de 15′ desde el cambio (28/11/2026, jueces de fútbol y análisis), primero lo contado
       * de verdad y sus minutos («1 remate · 0,10 de xG · 2 toques en el área en 10′») y después el
       * ritmo por 90′, marcado como tendencia: antes se extrapolaba sin decirlo.
       */
      const corto = post.min < 15;
      const minPost = Math.max(1, Math.round(post.min));
      for (const l of ["L", "V"] as Lado[]) {
        const a = pre[l], b = post[l];
        const dx = b.xg - a.xg;
        const sentido = Math.abs(dx) >= 0.4 ? (dx > 0 ? " (a más)" : " (a menos)") : " (igual)";
        if (corto) {
          const rem = Math.round(b.n.tiros), toq = Math.round(b.n.toques);
          frases.push(
            `${nom(l)}: ${rem} ${rem === 1 ? "remate" : "remates"} · ${coma(b.n.xg, 2)} de xG · ${toq} ${toq === 1 ? "toque" : "toques"} en el área en ${minPost}′. Tendencia: ${coma(a.xg, 1)} → ${coma(b.xg, 1)} xG por 90′${sentido}.`,
          );
        } else frases.push(`${nom(l)}: ${coma(a.xg, 1)} → ${coma(b.xg, 1)} xG por 90′${sentido}, ${Math.round(a.toques)} → ${Math.round(b.toques)} toques en el área por 90′.`);
      }
      if (pre.L.pos != null && post.L.pos != null) frases.push(`Posesión de ${nom("L")}: ${Math.round(pre.L.pos * 100)} % → ${Math.round(post.L.pos * 100)} %.`);
      cambio = { titulo: `Desde ${juntos.length > 1 ? "los cambios" : "el cambio"} del ${Math.floor(desde) + 1}′: ${quienes}`, frases };
    }
  }

  /* Hasta el final: 60 % lo reciente, 40 % el partido. */
  let proyeccion: Rumbo["proyeccion"] = null;
  const restante = Math.max(0, DURACION - t);
  const todo = ritmoEntre(p, 0, t);
  if (restante >= 3 && todo && !p.acabado) {
    const ritmo = (l: Lado) => (reciente ? 0.6 * reciente[l].xg + 0.4 * todo[l].xg : todo[l].xg);
    const xL = (ritmo("L") * restante) / 90, xV = (ritmo("V") * restante) / 90;
    proyeccion = { L: { xg: xL, marca: 1 - Math.exp(-xL) }, V: { xg: xV, marca: 1 - Math.exp(-xV) }, restante };
  }
  return { ahora, cambio, proyeccion };
}

/* ------------------------------------------------------------------ */
/*  EL PLAN EN EL CAMPO                                                */
/* ------------------------------------------------------------------ */

export type FilaPlan = Record<string, unknown>;

/** Los apartados del plan que se cruzan, y de quién habla cada uno. */
const APARTADOS: { campo: string; titulo: string; de: "nuestro" | "rival"; tipo?: "fortaleza" | "debilidad" }[] = [
  { campo: "CLAVES_PARTIDO", titulo: "Claves", de: "nuestro" },
  { campo: "ATAQUE", titulo: "Con balón", de: "nuestro" },
  { campo: "DEFENSA", titulo: "Sin balón", de: "nuestro" },
  { campo: "ABP_OF", titulo: "ABP ofensivo", de: "nuestro" },
  { campo: "ABP_DEF", titulo: "ABP defensivo", de: "rival" },
  { campo: "FORTALEZAS", titulo: "Fortaleza del rival", de: "rival", tipo: "fortaleza" },
  { campo: "DEBILIDADES", titulo: "Debilidad del rival", de: "rival", tipo: "debilidad" },
];

/* El tema de cada línea (el mismo criterio que el boceto del plan, lib/plan-partido/boceto.ts) y la cifra de Opta que lo mide. */
const TEMAS: { tema: string; re: RegExp; m: string; nombre: string; menos?: boolean; pct?: boolean; d?: number; suyo?: boolean }[] = [
  /* El orden importa: el balón parado y la falta van antes («córner directo» no es juego directo; «campo contrario» no es contragolpe). */
  { tema: "balón parado", re: /c[oó]rner|corner|bal[oó]n parado|balon parado|\babp\b|penalti|saque de banda|falta lateral|falta frontal/i, m: "Corners", nombre: "córners", suyo: true },
  { tema: "disciplina", re: /tarjeta|amarilla|disciplin|\bfaltas?\b/i, m: "FoulCom", nombre: "faltas", menos: true },
  { tema: "presión", re: /presi[oó]n|ppda|apret|robo|recuper|salida de bal[oó]n|sacar el bal[oó]n/i, m: "PPDA", nombre: "PPDA", menos: true, d: 1 },
  { tema: "duelos", re: /duelo|1v1|1 v 1|uno contra uno|agresiv/i, m: "Duel%", nombre: "duelos ganados", pct: true },
  { tema: "juego aéreo", re: /a[eé]re|cabez|altura|estatura/i, m: "Aerial%", nombre: "duelos aéreos ganados", pct: true },
  { tema: "posesión", re: /posesi[oó]n|circulaci|asociar|combinativ|toque|pausa/i, m: "Poss%", nombre: "posesión", pct: true, suyo: true },
  { tema: "finalización", re: /remat|finaliz|\bxg\b|ocasi|[aá]rea|definici|segunda l[ií]nea/i, m: "ExpG", nombre: "xG", d: 2, suyo: true },
  { tema: "centros", re: /centro|banda|lateral|extremo|amplitud|carril/i, m: "Crosses", nombre: "centros", suyo: true },
  { tema: "juego largo", re: /bal[oó]n largo|juego largo|pase largo|juego directo|segunda jugada|segundas jugadas|despej/i, m: "LgBall", nombre: "balones largos", suyo: true },
  { tema: "progresión", re: /progres|profund|desmarq|entre l[ií]neas|pase interior|transici|\bcontras?\b|contraataq|contragolpe|vertical|espald/i, m: "SeqEndInA3", nombre: "llegadas al último tercio", suyo: true },
];

export type Cruce = { apartado: string; linea: string; tema: string | null; cifra: string | null; lectura: string; tono: "bien" | "mal" | "neutro" };

/** La fila del plan de este partido: el rival (mismo club) con la fecha más cercana al partido, a 4 días como mucho. */
export function filaDelPlan(filas: FilaPlan[], p: Partido, mismoClub: (a: string, b: string) => boolean): FilaPlan | null {
  if (!p.nuestro) return null;
  const rival = (p.nuestro === "L" ? p.visitante : p.local).nombre;
  const dia = Date.parse(`${p.fecha.slice(0, 10)}T12:00:00Z`);
  let mejor: { f: FilaPlan; d: number } | null = null;
  for (const f of filas) {
    if (!mismoClub(String(f.EQUIPO ?? ""), rival)) continue;
    const fe = Date.parse(`${String(f.FECHA ?? "").slice(0, 10)}T12:00:00Z`);
    const d = Number.isFinite(fe) && Number.isFinite(dia) ? Math.abs(fe - dia) / 864e5 : 99;
    if (!mejor || d < mejor.d) mejor = { f, d };
  }
  return mejor && mejor.d <= 4 ? mejor.f : null;
}

export function planEnElCampo(p: Partido, fila: FilaPlan, t: number): Cruce[] {
  if (!p.nuestro) return [];
  const yo = p.nuestro, el: Lado = yo === "L" ? "V" : "L";
  const o = oficialEntre(p, 0, t);
  const minutos = Math.max(1, Math.min(90, t));
  const salida: Cruce[] = [];
  for (const a of APARTADOS) {
    const texto = String(fila[a.campo] ?? "").trim();
    if (!texto) continue;
    const lineas = texto
      .split(a.tipo ? /\n|;/ : /\n/)
      .map((x) => x.replace(/^[\s•\-–*·?]+/, "").trim())
      .filter((x) => x.length > 3 && !/^[A-ZÁÉÍÓÚÑ0-9 .:/()-]+$/.test(x));
    for (const linea of lineas) {
      const t1 = TEMAS.find((x) => x.re.test(linea));
      if (!t1) {
        salida.push({ apartado: a.titulo, linea, tema: null, cifra: null, lectura: "sin cifra de Opta que la mida", tono: "neutro" });
        continue;
      }
      /* De quién es la cifra: lo nuestro, nuestro; la fortaleza del rival, suya; su debilidad, cómo la atacamos nosotros; ABP defensivo, lo que nos hace él. */
      /* En «sin balón», los temas de ataque (xG, centros, llegadas, posesión) se miden en el rival: lo que le dejamos hacer. */
      const loQueNosHace = a.campo === "DEFENSA" && !!t1.suyo;
      const quien: Lado = loQueNosHace ? el : a.de === "nuestro" || a.tipo === "debilidad" ? yo : el;
      const eq = quien === "L" ? p.local : p.visitante;
      const v = (quien === "L" ? o.L : o.V)[t1.m] ?? null;
      const media0 = eq.previa?.medias[t1.m];
      if (v == null) {
        salida.push({ apartado: a.titulo, linea, tema: t1.tema, cifra: null, lectura: `${t1.nombre}: Opta lo da con el partido hasta ahora`, tono: "neutro" });
        continue;
      }
      const porMinuto = !t1.pct && t1.m !== "PPDA";
      const media = media0 == null ? null : porMinuto ? (media0 * minutos) / 90 : media0;
      const muestra = (x: number) => (t1.pct ? `${Math.round(x * 100)} %` : coma(x, t1.d ?? 0));
      const cifra = `${muestra(v)} ${t1.nombre}${media != null ? ` (su media, ${muestra(media)})` : ""} · ${nombreDe(p, quien)}`;
      if (media == null || !media) {
        salida.push({ apartado: a.titulo, linea, tema: t1.tema, cifra, lectura: "sin media para comparar", tono: "neutro" });
        continue;
      }
      const r = v / media - 1;
      const mas = r >= 0.15, menos = r <= -0.15;
      const hace = t1.menos ? menos : mas; /* «lo hace más» (en PPDA y faltas, menos es más) */
      const deja = t1.menos ? mas : menos;
      let lectura = mas ? `${Math.round(r * 100)} % más que su media` : menos ? `${Math.round(-r * 100)} % menos que su media` : "como su media";
      let tono: Cruce["tono"] = "neutro";
      if (a.tipo === "fortaleza") {
        if (hace) { lectura = `su fortaleza está apareciendo (${lectura})`; tono = "mal"; }
        else if (deja) { lectura = `la estamos apagando (${lectura})`; tono = "bien"; }
      } else if (a.tipo === "debilidad") {
        if (hace) { lectura = `la estamos atacando (${lectura})`; tono = "bien"; }
        else if (deja) { lectura = `no la estamos atacando (${lectura})`; tono = "mal"; }
      } else if (a.campo === "ABP_DEF" || loQueNosHace) {
        if (hace) { lectura = `le dejamos más de lo que suele (${lectura})`; tono = "mal"; }
        else if (deja) { lectura = `le dejamos menos de lo que suele (${lectura})`; tono = "bien"; }
      }
      salida.push({ apartado: a.titulo, linea, tema: t1.tema, cifra, lectura, tono });
    }
  }
  return salida;
}
