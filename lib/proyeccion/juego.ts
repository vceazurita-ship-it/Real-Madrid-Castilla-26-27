/**
 * PROYECCIÓN DE LA JORNADA · EL JUEGO (12/11/2026).
 *
 * Lo mismo que `abp.ts`, para el juego: posesión, xG, remates, toques en el
 * área, centros, presión (PPDA), recuperaciones arriba y contraataques. Cada
 * cifra con el cruce de `base.ts` (A · D / L · H; la posesión en logit), el
 * porqué con su base, los puntos fuertes y débiles cruzados (su debilidad ×
 * nuestra fortaleza = ventaja; al revés, riesgo), el tipo de partido y dónde
 * hay más ventaja, con su consigna.
 *
 * Fuentes: Opta por partido (`opta:partidos`) y, para los contraataques,
 * Wyscout (Team Stats de `analisis.json`). Funciones puras.
 */

import { antesDe, coma, frenteA, liga, pct, proyecta, puestoEn, type Proyeccion, type Tabla } from "./base";

export type ClaveJuego = "Poss%" | "ExpG" | "ShtIncBl" | "TouchOpBox" | "Crosses" | "PPDA" | "PosWonA3rd" | "wContra";

export type MetricaJuego = {
  clave: ClaveJuego;
  nombre: string;
  /** Cuántos decimales se enseñan. */
  dec: number;
  cuota?: boolean;
  /** true: más es mejor para el que lo hace; null: estilo (no entra en ventajas). */
  bueno: boolean | null;
  fuente: "Opta" | "Wyscout";
  comoLeer: string;
};

export const METRICAS_JUEGO: MetricaJuego[] = [
  { clave: "Poss%", nombre: "Posesión", dec: 0, cuota: true, bueno: null, fuente: "Opta", comoLeer: "Parte del tiempo con el balón." },
  { clave: "ExpG", nombre: "xG", dec: 2, bueno: true, fuente: "Opta", comoLeer: "Goles esperados de los remates (sin contar si entran)." },
  { clave: "ShtIncBl", nombre: "Remates", dec: 1, bueno: true, fuente: "Opta", comoLeer: "Remates, también los bloqueados." },
  { clave: "TouchOpBox", nombre: "Toques en el área rival", dec: 1, bueno: true, fuente: "Opta", comoLeer: "Veces que se toca el balón dentro del área contraria." },
  { clave: "Crosses", nombre: "Centros", dec: 1, bueno: null, fuente: "Opta", comoLeer: "Centros al área. Es estilo: ni mejor ni peor." },
  { clave: "PPDA", nombre: "PPDA (presión)", dec: 1, bueno: null, fuente: "Opta", comoLeer: "Pases que se deja dar al rival por cada acción defensiva: cuanto más bajo, más se presiona." },
  { clave: "PosWonA3rd", nombre: "Recuperaciones en el último tercio", dec: 1, bueno: true, fuente: "Opta", comoLeer: "Balones recuperados cerca de la portería rival (lo que concede el otro: sus pérdidas cerca de su área)." },
  { clave: "wContra", nombre: "Contraataques", dec: 1, bueno: true, fuente: "Wyscout", comoLeer: "Ataques rápidos tras recuperar (Wyscout)." },
];

export type LineaJuego = {
  metrica: MetricaJuego;
  favor: Proyeccion;
  contra: Proyeccion;
  liga: number;
  real?: { favor: number | null; contra: number | null };
};

export type PuntoJuego = {
  clave: ClaveJuego;
  quien: "nos" | "riv";
  clase: "fuerte" | "debil";
  indice: number;
  frase: string;
};

export type VentajaJuego = { clave: ClaveJuego; indice: number; valor: number; frase: string; consigna: string };

export type ProyeccionJuego = {
  lineas: LineaJuego[];
  tipoPartido: string[];
  porque: string[];
  suFuerte: PuntoJuego | null;
  suDebil: PuntoJuego | null;
  nuestroFuerte: PuntoJuego | null;
  nuestroDebil: PuntoJuego | null;
  ventajas: VentajaJuego[];
  riesgos: VentajaJuego[];
  partidos: { nos: number; riv: number };
  hasta: string;
};

export type EntradaJuego = {
  tabla: Tabla;
  nos: string;
  riv: string;
  nosLocal: boolean | null;
  nombreRival: string;
  antesDe?: string | null;
};

const fmt = (m: MetricaJuego, v: number | null | undefined) => (m.cuota ? pct(v ?? null) : coma(v ?? null, m.dec));

function masUno(dia: string) {
  const d = Date.parse(`${dia}T12:00:00Z`);
  return Number.isFinite(d) ? new Date(d + 86_400_000).toISOString().slice(0, 10) : dia;
}

export function proyeccionJuego(e: EntradaJuego): ProyeccionJuego | null {
  const t = antesDe(e.tabla, e.antesDe ?? null);
  const { nos, riv, nombreRival: R } = e;
  const rivLocal = e.nosLocal == null ? null : !e.nosLocal;

  const lineas: LineaJuego[] = [];
  for (const m of METRICAS_JUEGO) {
    const L = liga(t, m.clave);
    if (!L) continue;
    const escala = m.cuota ? ("cuota" as const) : ("conteo" as const);
    const favor = proyecta(t, { ataca: nos, defiende: riv, local: e.nosLocal, metrica: m.clave, escala });
    const contra = proyecta(t, { ataca: riv, defiende: nos, local: rivLocal, metrica: m.clave, escala });
    /* Sin partidos de alguno de los dos (Wyscout no siempre está), la métrica no sale. */
    if (!favor || !contra || !favor.ataque.n || !favor.defensa.n) continue;
    lineas.push({ metrica: m, favor, contra, liga: L.media });
  }
  if (!lineas.length) return null;

  if (e.antesDe) {
    const dia = e.antesDe.slice(0, 10);
    const nuestra = e.tabla.filas.find((f) => f.equipo === nos && f.fecha >= dia && f.fecha <= masUno(dia) && e.tabla.contra.get(f)?.equipo === riv);
    const suya = nuestra ? e.tabla.contra.get(nuestra) : undefined;
    if (nuestra && suya) for (const l of lineas) l.real = { favor: nuestra.v[l.metrica.clave] ?? null, contra: suya.v[l.metrica.clave] ?? null };
  }

  const de = (c: ClaveJuego) => lineas.find((l) => l.metrica.clave === c);
  const pos = de("Poss%");
  const xg = de("ExpG");
  const rem = de("ShtIncBl");
  const ppda = de("PPDA");

  /* ------------------------ tipo de partido ------------------------ */
  const tipo: string[] = [];
  if (pos) {
    const p = pos.favor.valor;
    tipo.push(
      p >= 0.58
        ? `Dominio nuestro con balón (${pct(p)} de posesión esperada): el ${R} esperará y saldrá a la contra.`
        : p >= 0.53
          ? `Más balón nuestro que suyo (${pct(p)} de posesión esperada).`
          : p > 0.47
            ? `Posesión repartida (${pct(p)} para nosotros).`
            : p > 0.42
              ? `Más balón suyo que nuestro (${pct(p)} de posesión esperada para nosotros).`
              : `Dominio suyo con balón (${pct(p)} para nosotros): tocará defender y correr.`,
    );
  }
  if (xg) {
    const totalXg = xg.favor.valor + xg.contra.valor;
    const ref = 2 * xg.liga;
    const d = totalXg / ref - 1;
    tipo.push(
      d >= 0.12
        ? `Partido abierto: ${coma(totalXg, 2)} xG entre los dos, ${frenteA(totalXg, ref)} de un partido del grupo.`
        : d <= -0.12
          ? `Partido cerrado: ${coma(totalXg, 2)} xG entre los dos, ${frenteA(totalXg, ref)} de un partido del grupo.`
          : `Partido de ocasiones normales: ${coma(totalXg, 2)} xG entre los dos (un partido del grupo da ${coma(ref, 2)}).`,
    );
  }
  if (ppda) {
    const suya = ppda.contra.valor;
    const nuestra = ppda.favor.valor;
    const L = ppda.liga;
    const frase =
      suya <= 0.88 * L
        ? `El ${R} apretará arriba: PPDA esperado ${coma(suya)} (media ${coma(L)}; más bajo, más presión).`
        : suya >= 1.12 * L
          ? `El ${R} nos esperará en bloque: PPDA esperado ${coma(suya)} (media ${coma(L)}).`
          : `Presión del ${R} de grupo medio: PPDA esperado ${coma(suya)} (media ${coma(L)}).`;
    tipo.push(`${frase} El nuestro, ${coma(nuestra)}.`);
  }
  /* El estilo del rival con el balón: balón largo frente al grupo. */
  const Ld = liga(t, "directo");
  const dirRiv = Ld?.porEquipo.get(riv)?.propio ?? null;
  if (Ld && dirRiv != null) {
    const d = dirRiv / Ld.media - 1;
    if (Math.abs(d) >= 0.15)
      tipo.push(
        d > 0
          ? `El ${R} juega directo: ${pct(dirRiv)} de sus pases son en largo (grupo ${pct(Ld.media)}). Segundas jugadas y duelo aéreo.`
          : `El ${R} combina: sólo ${pct(dirRiv)} de sus pases son en largo (grupo ${pct(Ld.media)}). Saldrá jugando desde atrás.`,
      );
  }

  /* --------------------------- puntos ---------------------------- */
  const cand: PuntoJuego[] = [];
  for (const l of lineas) {
    if (!l.metrica.bueno) continue;
    const L = liga(t, l.metrica.clave);
    if (!L) continue;
    const sitio = (equipo: string, lado: "propio" | "concede") => {
      const p = puestoEn(L, equipo, lado);
      return p ? `${p.puesto}.º que más ${lado === "propio" ? "genera" : "concede"} de ${p.de}` : "";
    };
    const f = (v: number) => fmt(l.metrica, v);
    cand.push({ clave: l.metrica.clave, quien: "riv", clase: "fuerte", indice: l.contra.A / l.liga, frase: `${l.metrica.nombre}: el ${R} hace ${f(l.contra.ataque.temporada ?? 0)} por partido (media ${f(l.liga)}; ${sitio(riv, "propio")}).` });
    cand.push({ clave: l.metrica.clave, quien: "riv", clase: "debil", indice: l.favor.D / l.liga, frase: `${l.metrica.nombre}: el ${R} concede ${f(l.favor.defensa.temporada ?? 0)} por partido (media ${f(l.liga)}; ${sitio(riv, "concede")}).` });
    cand.push({ clave: l.metrica.clave, quien: "nos", clase: "fuerte", indice: l.favor.A / l.liga, frase: `${l.metrica.nombre}: hacemos ${f(l.favor.ataque.temporada ?? 0)} por partido (media ${f(l.liga)}; ${sitio(nos, "propio")}).` });
    cand.push({ clave: l.metrica.clave, quien: "nos", clase: "debil", indice: l.contra.D / l.liga, frase: `${l.metrica.nombre}: concedemos ${f(l.contra.defensa.temporada ?? 0)} por partido (media ${f(l.liga)}; ${sitio(nos, "concede")}).` });
  }
  const elige = (quien: "nos" | "riv", clase: "fuerte" | "debil") => cand.filter((c) => c.quien === quien && c.clase === clase).sort((a, b) => b.indice - a.indice)[0] ?? null;

  /* --------------------------- ventajas -------------------------- */
  const ventajas: VentajaJuego[] = [];
  const riesgos: VentajaJuego[] = [];
  for (const l of lineas) {
    if (!l.metrica.bueno) continue;
    const m = l.metrica;
    const D = fmt(m, l.favor.D);
    const A = fmt(m, l.contra.A);
    const Lm = fmt(m, l.liga);
    const cv: Record<string, string> = {
      ExpG: `Generar remates de calidad: el ${R} concede ${D} xG por partido (media ${Lm}). Llegar al área con gente en vez de rematar de lejos.`,
      ShtIncBl: `Terminar las jugadas: al ${R} le rematan ${D} veces por partido (media ${Lm}).`,
      TouchOpBox: `Pisar su área: concede ${D} toques en su área por partido (media ${Lm}). Llegadas de segunda línea.`,
      PosWonA3rd: `Presionar su salida: le recuperan ${D} balones en su último tercio por partido (media ${Lm}). Apretar su primer pase.`,
      wContra: `Correr al robo: concede ${D} contraataques por partido (media ${Lm}).`,
    };
    const cr: Record<string, string> = {
      ExpG: `Cerrar el área: el ${R} genera ${A} xG por partido (media ${Lm}).`,
      ShtIncBl: `Limitar sus remates: el ${R} remata ${A} veces por partido (media ${Lm}).`,
      TouchOpBox: `Defender el área: el ${R} da ${A} toques en el área rival por partido (media ${Lm}).`,
      PosWonA3rd: `Cuidar la salida de balón: el ${R} recupera ${A} balones en el último tercio por partido (media ${Lm}).`,
      wContra: `Vigilancias ante pérdida: el ${R} sale a la contra ${A} veces por partido (media ${Lm}).`,
    };
    ventajas.push({ clave: m.clave, indice: l.favor.valor / l.liga, valor: l.favor.valor, frase: `${m.nombre}: ${fmt(m, l.favor.valor)} esperados (${frenteA(l.favor.valor, l.liga)} del grupo).`, consigna: cv[m.clave] ?? "" });
    riesgos.push({ clave: m.clave, indice: l.contra.valor / l.liga, valor: l.contra.valor, frase: `${m.nombre} del ${R}: ${fmt(m, l.contra.valor)} esperados (${frenteA(l.contra.valor, l.liga)} del grupo).`, consigna: cr[m.clave] ?? "" });
  }
  ventajas.sort((a, b) => b.indice - a.indice);
  riesgos.sort((a, b) => b.indice - a.indice);

  /* --------------------------- porqué ---------------------------- */
  const porque: string[] = [];
  if (pos)
    porque.push(
      `Posesión ${pct(pos.favor.valor)}: tenemos ${pct(pos.favor.ataque.temporada)} de media (${pct(pos.favor.ataque.ultimos)} en los últimos ${Math.min(5, pos.favor.ataque.n)}) y los rivales del ${R} tienen ${pct(pos.favor.defensa.temporada)} contra él.`,
    );
  if (xg)
    porque.push(
      `xG ${coma(xg.favor.valor, 2)} a ${coma(xg.contra.valor, 2)}: generamos ${coma(xg.favor.ataque.temporada, 2)} por partido y el ${R} concede ${coma(xg.favor.defensa.temporada, 2)}; él genera ${coma(xg.contra.ataque.temporada, 2)} y nosotros concedemos ${coma(xg.contra.defensa.temporada, 2)} (media del grupo ${coma(xg.liga, 2)}).`,
    );
  if (rem)
    porque.push(
      `Remates ${coma(rem.favor.valor)} a ${coma(rem.contra.valor)}: rematamos ${coma(rem.favor.ataque.temporada)} por partido y al ${R} le rematan ${coma(rem.favor.defensa.temporada)}; él remata ${coma(rem.contra.ataque.temporada)} (media ${coma(rem.liga)}).`,
    );
  if (e.nosLocal != null && xg && Math.abs(xg.favor.H - 1) >= 0.03)
    porque.push(
      `Jugamos ${e.nosLocal ? "en casa" : "fuera"}: en el grupo, el ${e.nosLocal ? "local" : "visitante"} genera un ${Math.round(Math.abs(xg.favor.H - 1) * 100)} % ${xg.favor.H > 1 ? "más" : "menos"} de xG que la media.`,
    );
  const cambios: string[] = [];
  for (const l of lineas) {
    if (!l.metrica.bueno) continue;
    const a = l.contra.ataque;
    if (a.cambio && a.ultimos != null && a.previos != null)
      cambios.push(`el ${R} ${a.cambio === "sube" ? "genera más" : "genera menos"} ${l.metrica.nombre === "xG" ? "xG" : l.metrica.nombre.toLowerCase()} (${fmt(l.metrica, a.ultimos)} en los últimos 5, ${fmt(l.metrica, a.previos)} antes)`);
    const d = l.favor.defensa;
    if (d.cambio && d.ultimos != null && d.previos != null)
      cambios.push(`el ${R} ${d.cambio === "sube" ? "concede más" : "concede menos"} ${l.metrica.nombre === "xG" ? "xG" : l.metrica.nombre.toLowerCase()} (${fmt(l.metrica, d.ultimos)} en los últimos 5, ${fmt(l.metrica, d.previos)} antes)`);
  }
  if (cambios.length) porque.push(`Tendencia: ${cambios.slice(0, 2).join("; ")}.`);

  return {
    lineas,
    tipoPartido: tipo,
    porque: porque.slice(0, 5),
    suFuerte: elige("riv", "fuerte"),
    suDebil: elige("riv", "debil"),
    nuestroFuerte: elige("nos", "fuerte"),
    nuestroDebil: elige("nos", "debil"),
    ventajas,
    riesgos,
    partidos: { nos: lineas[0].favor.ataque.n, riv: lineas[0].contra.ataque.n },
    hasta: t.filas.reduce((m, f) => (f.fecha > m ? f.fecha : m), ""),
  };
}

export const COMO_SE_CUENTA_JUEGO: string[] = [
  "Fuente: Opta, partido a partido, de los 20 equipos de nuestro grupo de Primera RFEF; los contraataques y el campo (local o visitante), de los Team Stats de Wyscout.",
  "Cada cifra: lo que hace el que ataca por partido × lo que concede el que defiende ÷ la media del grupo × el efecto del campo. Las tasas pesan más los últimos partidos (el de hace 8 jornadas, la mitad que el último) y se acercan a la media del grupo tanto más cuanto menos se distinguen los equipos en esa cifra.",
  "Medido en el grupo (140 casos del 25/09 al 08/11, cada uno proyectado con lo de antes): la posesión acierta un 15 % más que la media del grupo, los remates un 16 % y el xG un 4 %; el intervalo del 80 % recoge entre el 81 % y el 89 % de los casos.",
  "Posesión: el mismo cruce en razón de probabilidades (logit), para que los dos sumen el 100 %.",
  "Tipo de partido: posesión esperada; abierto o cerrado según el xG de los dos frente a un partido normal del grupo (±12 %); la presión, por el PPDA esperado (±12 % de la media); el estilo, por la parte de pases en largo del rival.",
  "Ventaja: lo que esperamos hacer frente a la media del grupo (su debilidad × nuestra fortaleza). Riesgo: lo mismo del rival.",
  "El intervalo es del 80 %: suma lo que varía un equipo de un partido a otro y la duda de las tasas.",
];
